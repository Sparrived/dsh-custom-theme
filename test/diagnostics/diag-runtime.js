/*
 * dsh-custom-theme — temporary renderer diagnostics (instrument build only).
 *
 * DCT DIAGNOSTICS — this file is NOT part of the plugin's release sources.
 * `install.mjs` copies it verbatim into a `const __dctDiag = (() => { ... })()`
 * binding at the top of the INSTALLED `lib/client.js` factory; the repository
 * copy is never touched, and `restore.mjs` puts the pristine file back.
 * The marker above is what the installer uses to refuse a double install.
 *
 * What it records, all fail-safe and allocation-bounded:
 *   1. renderer stalls — a requestAnimationFrame watchdog logging every gap over
 *      250 ms (>= 1000 ms flagged severe), plus `longtask` PerformanceObserver
 *      entries;
 *   2. attribution — the plugin's own passes (`pass`), timed with the trigger
 *      that ran them, so a stall's overlapping plugin work is known: no overlap
 *      means the shell owned the stall;
 *   3. shell signals — `console.warn`/`console.error` copied through unchanged
 *      and matched against the shell's `[connection] … retry #N` line, plus
 *      online/offline, visibilitychange and pagehide;
 *   4. context per sample — rendered element count, live ink count, and the
 *      per-frame count of new text nodes the plugin's mutation records named.
 *
 * The only DOM writes are none at all: it never creates, moves or removes a
 * node, and never assigns to an element. It adds listeners, patches `console`
 * (always delegating to the original), and starts one rAF loop.
 *
 * The event log is flushed as JSON to the plugin's own Host route
 * `POST /dsh-custom-theme/diag`, which appends it to a file; the latest summary
 * is also mirrored into `localStorage['dsh-custom-theme.diagnostics']`, which is
 * the fallback when the route is unreachable.
 */

const __dctDiag = (() => {
  /*
   * The no-op surface handed back when this is not a browser, when a second
   * materialization sees the singleton, or when initialization threw. `pass`
   * and `query` still run the wrapped call, so instrumented call sites behave
   * exactly like the uninstrumented code.
   */
  const DISABLED = {
    version: 'disabled',
    pass: (_name, fn) => fn(),
    query: (fn) => fn(),
    countTextNodes: () => {},
    setContextSource: () => {},
    flush: () => {},
    snapshot: () => null,
  }
  if (typeof window === 'undefined' || typeof document === 'undefined') return DISABLED
  try {
    // One runtime per page: a hot reload re-materializes the factory and must
    // not leave a second watchdog or a second flush timer behind.
    const existing = window.__DCT_DIAG__
    if (existing !== undefined && existing !== null) return existing
    const runtime = createRuntime()
    window.__DCT_DIAG__ = runtime
    return runtime
  } catch (error) {
    return DISABLED
  }

  function createRuntime() {
    /* ------------------------------------------------------------------ *
     * Constants and clock
     * ------------------------------------------------------------------ */

    const VERSION = 'dct-diag/1'
    const DIAG_URL = '/dsh-custom-theme/diag'
    const STORAGE_KEY = 'dsh-custom-theme.diagnostics'
    /** A frame gap above this is a stall. */
    const STALL_MS = 250
    /** A stall above this is flagged on its own, as the freeze scale. */
    const SEVERE_MS = 1000
    const FLUSH_MS = 3000
    const CAP_STALLS = 200
    const CAP_LONG_TASKS = 200
    const CAP_PASS_LOG = 128
    const CAP_SIGNALS = 160
    const CAP_CONSOLE_NOISE = 40
    const CAP_FRAMES = 240
    const MAX_PENDING_PASSES = 4000
    const HEARTBEAT_EVERY = 5
    const CONNECTION_RE = /\[connection\]|connection lost|retry #\d+|remote\.mux|websocket|reconnect/i

    const hasPerf = typeof performance !== 'undefined' && performance !== null && typeof performance.now === 'function'
    const mono = hasPerf ? () => performance.now() : () => Date.now()
    const wall = () => Date.now()
    const iso = (value) => {
      try { return new Date(value).toISOString() } catch (error) { return '' }
    }
    const round2 = (value) => (typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) / 100 : 0)
    const rel = (value) => round2(value - bootMono)
    const bootMono = mono()
    const bootWall = wall()
    const sessionId = `${bootWall.toString(36)}-${Math.random().toString(36).slice(2, 8)}`

    /* ------------------------------------------------------------------ *
     * State — ring buffers, never unbounded
     * ------------------------------------------------------------------ */

    /** Completed passes, newest last: the attribution window. */
    const recentPasses = []
    /** Pass records not yet flushed. */
    let pendingPasses = []
    /** Passes whose start was never balanced by an end (should stay empty). */
    const active = []
    /** Per pass name: calls, total, max and the last invocation. */
    const passStats = Object.create(null)
    /** The document query behind the reasoning pass. */
    const queryStats = { calls: 0, totalMs: 0, maxMs: 0, lastMs: 0, lastCount: -1 }

    let pendingStalls = []
    const stalls = []
    let pendingLongTasks = []
    const longTasks = []
    const longTaskStats = { count: 0, totalMs: 0, maxMs: 0, shell: 0, plugin: 0, mixed: 0, shellMs: 0 }
    let longTaskSupported = null

    let pendingSignals = []
    const signals = []
    const consoleNoise = []
    const consoleStats = { warn: 0, error: 0, matched: 0 }

    // Parallel typed rings: a frame sample costs no allocation.
    const frameGaps = new Float64Array(CAP_FRAMES)
    const frameCounts = new Int32Array(CAP_FRAMES)
    let frameWrite = 0
    let frameSamples = 0
    const frameStats = { count: 0, totalGapMs: 0, maxGapMs: 0, textNodes: 0, maxTextNodes: 0 }

    let textNodesThisFrame = 0
    let droppedPasses = 0
    let sequence = 0
    let flushInFlight = false
    let flushQueued = false
    let queuedForce = false
    let flushTimer = null
    let stopped = false
    let lastStallAt = 0
    let lastFrameAt = null
    let hiddenAtMono = null
    let hiddenAtWall = null
    const contextSources = []

    /* ------------------------------------------------------------------ *
     * Small helpers
     * ------------------------------------------------------------------ */

    function pushRing(list, item, cap) {
      list.push(item)
      if (list.length > cap) list.splice(0, list.length - cap)
    }

    function elementCount() {
      try {
        const body = document.body
        if (body && typeof body.getElementsByTagName === 'function') return body.getElementsByTagName('*').length
      } catch (error) { /* fall through */ }
      try {
        if (typeof document.querySelectorAll === 'function') return document.querySelectorAll('*').length
      } catch (error) { /* fall through */ }
      return -1
    }

    function extraContext() {
      const out = {}
      for (let index = 0; index < contextSources.length; index += 1) {
        try { Object.assign(out, contextSources[index]()) } catch (error) { /* ignore */ }
      }
      return out
    }

    function isHidden() {
      try { return document.visibilityState === 'hidden' } catch (error) { return false }
    }

    function onlineState() {
      try { return typeof navigator !== 'undefined' && navigator !== null ? navigator.onLine : undefined } catch (error) { return undefined }
    }

    function safeStringify(value) {
      try { return JSON.stringify(value) } catch (error) { return null }
    }

    /* ------------------------------------------------------------------ *
     * 2. Attribution — pass timing
     * ------------------------------------------------------------------ */

    function recordPass(frame) {
      const name = frame.name
      let stats = passStats[name]
      if (stats === undefined) {
        stats = { calls: 0, totalMs: 0, maxMs: 0, lastStart: 0, lastDur: 0, lastTrigger: '' }
        passStats[name] = stats
      }
      stats.calls += 1
      stats.totalMs += frame.dur
      if (frame.dur > stats.maxMs) stats.maxMs = frame.dur
      stats.lastStart = frame.start
      stats.lastDur = frame.dur
      stats.lastTrigger = frame.trigger
      pushRing(recentPasses, frame, CAP_PASS_LOG)
      if (pendingPasses.length >= MAX_PENDING_PASSES) {
        // Drop the oldest quarter in one step: keeps the cost off the hot path.
        pendingPasses.splice(0, MAX_PENDING_PASSES >> 2)
        droppedPasses += MAX_PENDING_PASSES >> 2
      }
      // The compact shape is what leaves the page, so a failed flush can put it
      // back unchanged.
      pendingPasses.push({ n: frame.name, g: frame.trigger, t: rel(frame.start), d: round2(frame.dur), x: frame.depth })
    }

    /**
     * Time one plugin pass. The wrapped call runs exactly as it would without
     * instrumentation and its exception, if any, is re-thrown unchanged.
     */
    function pass(name, fn, trigger) {
      const start = mono()
      const frame = { name, trigger: trigger === undefined ? '' : String(trigger), start, end: 0, dur: 0, depth: active.length }
      active.push(frame)
      try {
        return fn()
      } finally {
        try {
          active.pop()
          frame.end = mono()
          frame.dur = frame.end - frame.start
          recordPass(frame)
        } catch (error) { /* an instrumentation failure must not surface */ }
      }
    }

    /** Time a document query the plugin runs (the reasoning pass's own lookup). */
    function query(fn) {
      const start = mono()
      let result
      try {
        result = fn()
      } finally {
        try {
          const duration = mono() - start
          queryStats.calls += 1
          queryStats.totalMs += duration
          if (duration > queryStats.maxMs) queryStats.maxMs = duration
          queryStats.lastMs = duration
          queryStats.lastCount = result !== undefined && result !== null && typeof result.length === 'number' ? result.length : -1
        } catch (error) { /* ignore */ }
      }
      return result
    }

    /** Count the text nodes a batch of mutation records named, per frame. */
    function countTextNodes(count) {
      if (typeof count !== 'number' || !(count > 0)) return
      textNodesThisFrame += count
      frameStats.textNodes += count
    }

    function setContextSource(fn) {
      if (typeof fn === 'function' && contextSources.length < 8) contextSources.push(fn)
    }

    /**
     * Which recorded plugin passes intersect a window, and how much of that
     * window the plugin's own top-level passes account for.
     *
     * The window opens at the previous animation frame, which in a browser is the
     * same task that ran that frame's plugin passes: their tail is therefore
     * inside every window by construction. That tail is measured and reported
     * (`head`, and a coverage computed from the window's real start afterwards)
     * rather than being mistaken for the thing that blocked the thread.
     */
    function attribute(start, end) {
      const hits = []
      let innerStart = start
      for (let index = 0; index < recentPasses.length; index += 1) {
        const frame = recentPasses[index]
        if (frame.start <= start && frame.end <= end && frame.end > innerStart) innerStart = frame.end
      }
      let pluginMs = 0
      for (let index = 0; index < recentPasses.length; index += 1) {
        const frame = recentPasses[index]
        if (frame.end < innerStart || frame.start > end) continue
        const overlap = Math.min(frame.end, end) - Math.max(frame.start, innerStart)
        if (!(overlap > 0)) continue
        hits.push({
          n: frame.name,
          g: frame.trigger,
          d: round2(frame.dur),
          x: frame.depth,
          o: round2(overlap),
          t: round2(frame.start - start),
          e: round2(frame.end - start),
        })
        if (frame.depth === 0) pluginMs += overlap
      }
      return { hits, pluginMs, innerStart }
    }

    /** The last pass that had finished by `end`, and how long before it ended. */
    function nearestBefore(end) {
      let best = null
      for (let index = 0; index < recentPasses.length; index += 1) {
        const frame = recentPasses[index]
        if (frame.end > end) continue
        if (best === null || frame.end > best.end) best = frame
      }
      if (best === null) return null
      return { n: best.name, g: best.trigger, d: round2(best.dur), gapMs: round2(end - best.end) }
    }

    /* ------------------------------------------------------------------ *
     * 1. Renderer stalls — rAF watchdog and longtask observer
     * ------------------------------------------------------------------ */

    function recordStall(start, end, gap) {
      const { hits, pluginMs, innerStart } = attribute(start, end)
      // Coverage is measured from where the thread was actually free again: the
      // tail of the plugin pass that opened the window is reported as `head`.
      const window = end - innerStart
      const coverage = window > 0 ? pluginMs / window : 0
      const record = {
        // Monotonic ms since boot; the flush carries the wall-clock anchor.
        s: rel(start),
        e: rel(end),
        d: round2(gap),
        severe: gap > SEVERE_MS,
        startWall: iso(wall() - (mono() - start)),
        endWall: iso(wall() - (mono() - end)),
        visible: !isHidden(),
        // A gap that spans a hidden window is throttling, not a stall.
        suspended: hiddenAtMono !== null && hiddenAtMono > start,
        elems: elementCount(),
        ink: -1,
        txn: textNodesThisFrame,
        head: round2(innerStart - start),
        win: round2(window),
        pluginMs: round2(pluginMs),
        cover: Math.round(coverage * 1000) / 1000,
        // A `cover` near zero over a window of hundreds of ms is the finding: no
        // plugin pass of this plugin's was running; the shell held the thread.
        p: hits,
        near: nearestBefore(end),
        running: active.map((frame) => frame.name),
      }
      try { Object.assign(record, extraContext()) } catch (error) { /* ignore */ }
      lastStallAt = end
      pushRing(stalls, record, CAP_STALLS)
      pendingStalls.push(record)
      if (gap > SEVERE_MS) flush('stall')
    }

    function frameTick() {
      try {
        const timestamp = mono()
        const textNodes = textNodesThisFrame
        textNodesThisFrame = 0
        if (lastFrameAt !== null) {
          const gap = timestamp - lastFrameAt
          if (gap > 0) {
            frameStats.count += 1
            frameStats.totalGapMs += gap
            if (gap > frameStats.maxGapMs) frameStats.maxGapMs = gap
            if (textNodes > frameStats.maxTextNodes) frameStats.maxTextNodes = textNodes
            frameGaps[frameWrite] = gap
            frameCounts[frameWrite] = textNodes
            frameWrite = (frameWrite + 1) % CAP_FRAMES
            if (frameSamples < CAP_FRAMES) frameSamples += 1
            if (gap > STALL_MS) recordStall(lastFrameAt, timestamp, gap)
          }
        }
        lastFrameAt = timestamp
      } catch (error) { /* the watchdog never breaks the page */ }
      try {
        if (!stopped && typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(frameTick)
      } catch (error) { /* a lost frame just ends the watchdog */ }
    }

    function recordLongTask(entry) {
      const start = entry.startTime
      const duration = entry.duration
      if (!(duration > 0)) return
      const end = start + duration
      const { hits, pluginMs, innerStart } = attribute(start, end)
      const window = end - innerStart
      const coverage = window > 0 ? pluginMs / window : 0
      const kind = coverage >= 0.5 ? 'plugin' : coverage >= 0.15 ? 'mixed' : 'shell'
      longTaskStats.count += 1
      longTaskStats.totalMs += duration
      if (duration > longTaskStats.maxMs) longTaskStats.maxMs = duration
      longTaskStats[kind] += 1
      if (kind === 'shell') longTaskStats.shellMs += duration
      const record = {
        s: rel(start),
        d: round2(duration),
        w: round2(window),
        k: kind,
        pm: round2(pluginMs),
        c: Math.round(coverage * 1000) / 1000,
        p: hits,
      }
      pushRing(longTasks, record, CAP_LONG_TASKS)
      pendingLongTasks.push(record)
      if (duration > SEVERE_MS) flush('longtask')
    }

    function observeLongTasks() {
      if (typeof PerformanceObserver !== 'function') return false
      const handle = (list) => {
        try {
          const entries = list.getEntries()
          for (let index = 0; index < entries.length; index += 1) recordLongTask(entries[index])
        } catch (error) { /* ignore */ }
      }
      try {
        new PerformanceObserver(handle).observe({ type: 'longtask', buffered: true })
        return true
      } catch (error) { /* fall through to the older form */ }
      try {
        new PerformanceObserver(handle).observe({ entryTypes: ['longtask'] })
        return true
      } catch (error) {
        return false
      }
    }

    /* ------------------------------------------------------------------ *
     * 3. Shell signals
     * ------------------------------------------------------------------ */

    function recordSignal(kind, text, matched) {
      const record = {
        at: iso(wall()),
        mono: round2(mono() - bootMono),
        k: kind,
        m: matched === true,
        t: typeof text === 'string' ? text.slice(0, 300) : '',
      }
      pushRing(signals, record, CAP_SIGNALS)
      pendingSignals.push(record)
    }

    function describe(value) {
      if (value === null) return 'null'
      const type = typeof value
      if (type === 'string') return value
      if (type === 'number' || type === 'boolean' || type === 'undefined' || type === 'bigint') return String(value)
      if (type === 'function') return `[function ${value.name || 'anonymous'}]`
      if (type === 'symbol') return value.toString()
      if (value instanceof Error) return `${value.name}: ${value.message}`
      if (Array.isArray(value)) return `[array(${value.length})]`
      if (type === 'object') {
        // The constructor name only: reading fields could run a getter.
        const name = value.constructor && value.constructor.name
        return name !== undefined && name !== 'Object' ? `[${name}]` : '[object]'
      }
      return `[${type}]`
    }

    function captureConsole(level, args) {
      let text = ''
      try {
        const parts = []
        for (let index = 0; index < args.length && index < 6; index += 1) parts.push(describe(args[index]))
        text = parts.join(' ')
      } catch (error) {
        text = '<unreadable console arguments>'
      }
      const matched = CONNECTION_RE.test(text)
      consoleStats[level] += 1
      if (matched) {
        consoleStats.matched += 1
        recordSignal(`console.${level}`, text, true)
        // The reconnect loop is the symptom under study: it goes out at once.
        flush('connection')
        return
      }
      pushRing(consoleNoise, { at: iso(wall()), k: `console.${level}`, t: text.slice(0, 240) }, CAP_CONSOLE_NOISE)
    }

    function patchConsole() {
      if (typeof console === 'undefined' || console === null) return
      for (const level of ['warn', 'error']) {
        try {
          const original = console[level]
          if (typeof original !== 'function') continue
          console[level] = function patchedConsole(...args) {
            try { captureConsole(level, args) } catch (error) { /* copy-through still happens */ }
            return original.apply(console, args)
          }
        } catch (error) { /* a locked console keeps its own behaviour */ }
      }
    }

    function installListeners() {
      try {
        if (typeof window.addEventListener === 'function') {
          window.addEventListener('online', () => recordSignal('online', `navigator.onLine=${String(onlineState())}`, true))
          window.addEventListener('offline', () => recordSignal('offline', `navigator.onLine=${String(onlineState())}`, true))
          window.addEventListener('pagehide', () => {
            recordSignal('pagehide', String(isHidden()), true)
            flush('pagehide')
          })
        }
      } catch (error) { /* ignore */ }
      try {
        if (typeof document.addEventListener === 'function') {
          document.addEventListener('visibilitychange', () => {
            const hidden = isHidden()
            if (hidden) {
              hiddenAtMono = mono()
              hiddenAtWall = wall()
            } else {
              hiddenAtMono = null
              hiddenAtWall = null
            }
            recordSignal('visibilitychange', hidden ? 'hidden' : 'visible', true)
            if (hidden) flush('visibility-hidden')
          })
        }
      } catch (error) { /* ignore */ }
    }

    /* ------------------------------------------------------------------ *
     * Flush — the Host route first, localStorage as the fallback
     * ------------------------------------------------------------------ */

    function passStatsCopy() {
      const out = {}
      for (const name in passStats) {
        const stats = passStats[name]
        out[name] = {
          calls: stats.calls,
          totalMs: round2(stats.totalMs),
          maxMs: round2(stats.maxMs),
          lastStartMs: rel(stats.lastStart),
          lastMs: round2(stats.lastDur),
          lastTrigger: stats.lastTrigger,
        }
      }
      return out
    }

    function frameSamplesCopy() {
      const take = Math.min(frameSamples, 30)
      const out = []
      for (let offset = take; offset > 0; offset -= 1) {
        const index = (frameWrite - offset + CAP_FRAMES * 2) % CAP_FRAMES
        out.push([round2(frameGaps[index]), frameCounts[index]])
      }
      return out
    }

    function buildPayload(reason, compact) {
      sequence += 1
      const context = {
        elements: elementCount(),
        frames: frameStats.count,
        maxGapMs: round2(frameStats.maxGapMs),
        textNodes: frameStats.textNodes,
        maxTextNodesPerFrame: frameStats.maxTextNodes,
        hidden: isHidden(),
        online: onlineState(),
      }
      try { Object.assign(context, extraContext()) } catch (error) { /* ignore */ }
      const payload = {
        schema: VERSION,
        session: sessionId,
        seq: sequence,
        reason,
        bootAt: iso(bootWall),
        wall: iso(wall()),
        sentMs: rel(mono()),
        context,
        passStats: passStatsCopy(),
        queries: {
          calls: queryStats.calls,
          totalMs: round2(queryStats.totalMs),
          maxMs: round2(queryStats.maxMs),
          lastMs: round2(queryStats.lastMs),
          lastCount: queryStats.lastCount,
        },
        stalls: pendingStalls,
        longTasks: pendingLongTasks,
        signals: pendingSignals,
        passes: compact ? [] : pendingPasses,
        frames: frameSamplesCopy(),
        dropped: { passes: droppedPasses },
        longTaskSupported,
        longTaskTotals: {
          count: longTaskStats.count,
          totalMs: round2(longTaskStats.totalMs),
          maxMs: round2(longTaskStats.maxMs),
          shell: longTaskStats.shell,
          plugin: longTaskStats.plugin,
          mixed: longTaskStats.mixed,
          shellMs: round2(longTaskStats.shellMs),
        },
        stallTotals: stallTotals(),
        console: { warn: consoleStats.warn, error: consoleStats.error, matched: consoleStats.matched },
        consoleNoise: compact ? [] : consoleNoise.slice(-10),
      }
      if (typeof location !== 'undefined' && location !== null) {
        try { payload.url = String(location.href) } catch (error) { /* ignore */ }
      }
      if (typeof navigator !== 'undefined' && navigator !== null) {
        try { payload.ua = String(navigator.userAgent) } catch (error) { /* ignore */ }
      }
      pendingStalls = []
      pendingLongTasks = []
      pendingSignals = []
      pendingPasses = []
      return payload
    }

    function stallTotals() {
      let over250 = 0
      let over1s = 0
      let totalMs = 0
      let maxMs = 0
      let shellOnly = 0
      let mixed = 0
      let pluginOwned = 0
      let shellMs = 0
      let pluginMsTotal = 0
      for (let index = 0; index < stalls.length; index += 1) {
        const record = stalls[index]
        over250 += 1
        if (record.severe) over1s += 1
        totalMs += record.d
        if (record.d > maxMs) maxMs = record.d
        pluginMsTotal += record.pluginMs
        if (record.cover >= 0.5) pluginOwned += 1
        else if (record.cover >= 0.15) mixed += 1
        else {
          shellOnly += 1
          shellMs += record.d
        }
      }
      return {
        over250,
        over1s,
        totalMs: round2(totalMs),
        maxMs: round2(maxMs),
        shellOnly,
        mixed,
        pluginOwned,
        shellMs: round2(shellMs),
        pluginMs: round2(pluginMsTotal),
      }
    }

    /** Keep the last summary where DevTools and the fallback dump can read it. */
    function writeFallback(payload) {
      try {
        const storage = window.localStorage
        if (storage === null || storage === undefined || typeof storage.setItem !== 'function') return
        storage.setItem(STORAGE_KEY, JSON.stringify({
          schema: payload.schema,
          session: payload.session,
          seq: payload.seq,
          reason: payload.reason,
          bootAt: payload.bootAt,
          wall: payload.wall,
          context: payload.context,
          stallTotals: payload.stallTotals,
          longTaskTotals: payload.longTaskTotals,
          passStats: payload.passStats,
          queries: payload.queries,
          console: payload.console,
          stalls: payload.stalls.slice(-25),
          signals: payload.signals.slice(-25),
          longTasks: payload.longTasks.slice(-15),
        }))
      } catch (error) { /* a denied or full store must not break the page */ }
    }

    function summarise() {
      return safeStringify({
        schema: VERSION,
        session: sessionId,
        bootAt: iso(bootWall),
        wall: iso(wall()),
        context: extraContext(),
        stallTotals: stallTotals(),
        longTaskTotals: longTaskStats,
        passStats: passStatsCopy(),
        queries: queryStats,
        console: consoleStats,
        lastStall: stalls.length > 0 ? stalls[stalls.length - 1] : null,
        signals: signals.slice(-30),
      })
    }

    function send(body, keepalive) {
      let request
      try {
        // Mirrors how this half already talks to its own routes: same-origin,
        // no custom headers beyond the JSON content type, no cache. `keepalive`
        // is only used for an unload flush, where a normal request can be cut
        // off; it caps the body, so a big one is sent without it.
        request = fetch(DIAG_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
          cache: 'no-store',
          keepalive: keepalive === true && body.length < 60000,
        })
      } catch (error) {
        request = null
      }
      if (request === null || request === undefined || typeof request.then !== 'function') return Promise.resolve(false)
      return Promise.resolve(request).then(
        (response) => response !== null && response !== undefined && response.ok === true,
        () => false,
      ).catch(() => false)
    }

    function flush(reason, force) {
      if (stopped === true && reason !== 'manual') return
      try {
        const unloading = reason === 'pagehide' || reason === 'visibility-hidden'
        // The one-shot hello, a manual dump and an unload must not be swallowed by
        // a request that is already in flight; everything else waits its turn.
        const urgent = unloading || reason === 'hello' || reason === 'manual'
        if (flushInFlight === true && !urgent) {
          // Queue the request rather than drop it — and remember whether it was
          // forced, so it is not then skipped for being empty when its turn comes.
          flushQueued = true
          queuedForce = queuedForce || force === true
          return
        }
        const heartbeatDue = sequence % HEARTBEAT_EVERY === 0
        const anything = pendingStalls.length > 0 || pendingLongTasks.length > 0 || pendingSignals.length > 0
          || pendingPasses.length > 0 || textNodesThisFrame > 0
        // An unload flush is the last chance to get anything out, so it is never
        // skipped just because nothing new accumulated since the previous one —
        // and it goes out beside an in-flight request rather than waiting for a
        // promise that the unload may never let settle.
        if (!anything && !heartbeatDue && force !== true && !unloading) return
        let payload = buildPayload(reason, unloading)
        let body = safeStringify(payload)
        if (body === null) return
        if (body.length > 120000 && !unloading) {
          // Never post an unbounded body: the aggregates and the stall records
          // are the point, the per-pass invocation log is the first thing to go.
          payload = { ...payload, passes: [] }
          body = safeStringify(payload)
          if (body === null) return
        }
        flushInFlight = true
        writeFallback(payload)
        send(body, unloading).then((ok) => {
          flushInFlight = false
          if (!ok) {
            // The route did not take it: put the records back so the next flush
            // (or the localStorage mirror) can still carry them.
            restore(payload)
            try { writeFallback(payload) } catch (error) { /* ignore */ }
          }
          if (flushQueued === true) {
            const queued = queuedForce
            flushQueued = false
            queuedForce = false
            flush('queued', queued)
          }
        })
      } catch (error) {
        flushInFlight = false
      }
    }

    function restore(payload) {
      try {
        // Restored records come first: they were already drained once and are
        // the older evidence. A cap overflow drops the newest, which the next
        // flush carries anyway.
        if (payload.stalls.length > 0) pendingStalls = payload.stalls.concat(pendingStalls).slice(0, CAP_STALLS)
        if (payload.longTasks.length > 0) pendingLongTasks = payload.longTasks.concat(pendingLongTasks).slice(0, CAP_LONG_TASKS)
        if (payload.signals.length > 0) pendingSignals = payload.signals.concat(pendingSignals).slice(0, CAP_SIGNALS)
        if (payload.passes.length > 0) pendingPasses = payload.passes.concat(pendingPasses).slice(0, MAX_PENDING_PASSES)
      } catch (error) { /* ignore */ }
    }

    function scheduleFlush() {
      try {
        const timer = typeof window.setTimeout === 'function' ? window.setTimeout : setTimeout
        flushTimer = timer(() => {
          flushTimer = null
          if (!stopped) {
            flush('periodic', true)
            scheduleFlush()
          }
        }, FLUSH_MS)
        // In a browser `setTimeout` returns a number and this is skipped; under
        // Node (the harness-based tests) it keeps a page-level instrument from
        // holding the process open forever.
        if (flushTimer !== null && typeof flushTimer === 'object' && typeof flushTimer.unref === 'function') flushTimer.unref()
      } catch (error) { /* ignore */ }
    }

    /* ------------------------------------------------------------------ *
     * Start
     * ------------------------------------------------------------------ */

    patchConsole()
    installListeners()
    try { longTaskSupported = observeLongTasks() } catch (error) { longTaskSupported = false }
    try {
      if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(frameTick)
      else stopped = true
    } catch (error) { stopped = true }
    scheduleFlush()
    // One immediate hello: it proves the whole route in one restart without
    // waiting for a freeze, and dates the instrumented session. It is urgent, so
    // an in-flight request cannot swallow it.
    try {
      setTimeout(() => flush('hello', true), 0)
    } catch (error) { /* ignore */ }

    return {
      version: VERSION,
      pass,
      query,
      countTextNodes,
      setContextSource,
      flush: (reason) => flush(reason === undefined ? 'manual' : reason, true),
      snapshot: summarise,
    }
  }
})()
