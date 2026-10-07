#!/usr/bin/env node
/*
 * dsh-custom-theme — read and summarise the renderer diagnostics log.
 *
 *   node test/diagnostics/read-log.mjs [--file <log>] [--top 15] [--json]
 *
 * The log is JSON lines, one object per posted payload:
 *   { "receivedAt": "...", "payload": { schema, session, seq, reason, ... } }
 *
 * The point of the summary is the one question this instrument exists for: when
 * the renderer stalled, was the plugin's own code running? Each stall carries
 * the plugin passes that intersect it (`p`), how much of the stall those
 * top-level passes account for (`cover`, `pluginMs`), and the pass that finished
 * closest before the stall ended (`near`). `p: []` with a near-zero `cover` means
 * the shell owned the stall.
 */

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const DEFAULT_LOG = 'C:\\Users\\ASUS\\.dsh\\profiles\\desktop\\dct-diagnostics.log'

function parseArgs(argv) {
  const options = { file: DEFAULT_LOG, top: 15, json: false }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--json') options.json = true
    else if (arg === '--file') {
      index += 1
      if (argv[index] === undefined) throw new Error('--file needs a path')
      options.file = argv[index]
    } else if (arg === '--top') {
      index += 1
      options.top = Number.parseInt(argv[index] ?? '15', 10)
    } else if (arg === '--help' || arg === '-h') options.help = true
    else throw new Error(`unknown argument: ${arg}`)
  }
  return options
}

const ms = (value) => `${value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${Math.round(value)}ms`}`

/** Group raw payloads into sessions, keeping only what the summary reads. */
function collect(payloads) {
  const sessions = new Map()
  let bad = 0
  for (const entry of payloads) {
    const payload = entry?.payload
    if (payload === null || typeof payload !== 'object' || typeof payload.session !== 'string') {
      bad += 1
      continue
    }
    let session = sessions.get(payload.session)
    if (session === undefined) {
      session = {
        id: payload.session,
        bootAt: payload.bootAt,
        url: payload.url,
        ua: payload.ua,
        firstAt: entry.receivedAt,
        lastAt: entry.receivedAt,
        samples: 0,
        reasons: {},
        stalls: [],
        longTasks: [],
        signals: [],
        noise: [],
        passStats: {},
        queries: null,
        longTaskTotals: null,
        console: null,
        context: null,
        dropped: 0,
        longTaskSupported: null,
      }
      sessions.set(payload.session, session)
    }
    session.samples += 1
    session.lastAt = entry.receivedAt
    session.reasons[payload.reason] = (session.reasons[payload.reason] ?? 0) + 1
    if (Array.isArray(payload.stalls)) session.stalls.push(...payload.stalls)
    if (Array.isArray(payload.longTasks)) session.longTasks.push(...payload.longTasks)
    if (Array.isArray(payload.signals)) session.signals.push(...payload.signals)
    if (Array.isArray(payload.consoleNoise) && payload.consoleNoise.length > 0) session.noise.push(...payload.consoleNoise)
    if (payload.passStats !== null && typeof payload.passStats === 'object') Object.assign(session.passStats, payload.passStats)
    if (payload.queries !== null && typeof payload.queries === 'object') session.queries = payload.queries
    if (payload.longTaskTotals !== null && typeof payload.longTaskTotals === 'object') session.longTaskTotals = payload.longTaskTotals
    if (payload.console !== null && typeof payload.console === 'object') session.console = payload.console
    if (payload.context !== null && typeof payload.context === 'object') session.context = payload.context
    if (payload.dropped && typeof payload.dropped.passes === 'number') session.dropped = payload.dropped.passes
    if (typeof payload.longTaskSupported === 'boolean') session.longTaskSupported = payload.longTaskSupported
  }
  return { sessions: [...sessions.values()], bad }
}

/**
 * Who held the thread.
 *
 * The test is coverage, not "were there any overlapping passes": every stall
 * window opens at the previous animation frame, which is the same task that ran
 * that frame's plugin passes, so a sliver of plugin time is inside every window
 * by construction (reported as `head`). What matters is how much of the window,
 * measured from where the thread was last free, the plugin's own top-level passes
 * account for.
 */
function classify(stall) {
  const cover = typeof stall.cover === 'number' ? stall.cover : 0
  if (cover >= 0.5) return 'plugin'
  if (cover >= 0.15) return 'mixed'
  return 'shell'
}

function summariseSession(session, top) {
  const stalls = session.stalls.slice().sort((left, right) => right.d - left.d)
  const over1s = session.stalls.filter((stall) => stall.severe === true)
  const attribution = { shell: 0, mixed: 0, plugin: 0 }
  const over1sAttribution = { shell: 0, mixed: 0, plugin: 0 }
  for (const stall of session.stalls) attribution[classify(stall)] += 1
  for (const stall of over1s) over1sAttribution[classify(stall)] += 1
  const shellMs = session.stalls.reduce((total, stall) => total + (classify(stall) === 'shell' ? stall.d : 0), 0)
  const pluginCoveredMs = session.stalls.reduce((total, stall) => total + (classify(stall) === 'plugin' ? stall.d : 0), 0)
  return {
    id: session.id,
    bootAt: session.bootAt,
    firstSampleAt: session.firstAt,
    lastSampleAt: session.lastAt,
    samples: session.samples,
    reasons: session.reasons,
    stalls: {
      count: session.stalls.length,
      over1s: over1s.length,
      maxMs: stalls.length > 0 ? Math.round(stalls[0].d) : 0,
      totalMs: Math.round(session.stalls.reduce((total, stall) => total + stall.d, 0)),
      attribution,
      over1sAttribution,
      shellOnlyMs: Math.round(shellMs),
      pluginCoveredMs: Math.round(pluginCoveredMs),
      pluginPassMs: Math.round(session.stalls.reduce((total, stall) => total + (stall.pluginMs ?? 0), 0)),
    },
    longTasks: session.longTaskTotals,
    longTaskSupported: session.longTaskSupported,
    queries: session.queries,
    console: session.console,
    context: session.context,
    droppedPasses: session.dropped,
    passStats: session.passStats,
    topStalls: stalls.slice(0, top).map((stall) => ({
      endedAt: stall.endWall,
      durationMs: Math.round(stall.d),
      startMs: stall.s,
      endMs: stall.e,
      attribution: classify(stall),
      pluginMs: stall.pluginMs,
      coverage: stall.cover,
      windowMs: stall.win,
      frameTaskTailMs: stall.head,
      elements: stall.elems,
      liveInk: stall.ink,
      textNodesInFrame: stall.txn,
      visible: stall.visible,
      passes: (stall.p ?? []).map((hit) => `${hit.n}${hit.x > 0 ? `(depth ${hit.x})` : ''}[${hit.g}] ${ms(hit.d)} overlap ${ms(hit.o)}`),
      nearestPassBefore: stall.near === null || stall.near === undefined ? null : `${stall.near.n}[${stall.near.g}] ended ${ms(stall.near.gapMs)} before the stall did`,
    })),
    connectionSignals: session.signals
      .filter((signal) => signal.m === true && (signal.k.startsWith('console.') || signal.k === 'online' || signal.k === 'offline' || signal.k === 'visibilitychange' || signal.k === 'pagehide'))
      .map((signal) => `${signal.at} ${signal.k} ${signal.t}`),
    longTasksTop: session.longTasks.slice().sort((left, right) => right.d - left.d).slice(0, top).map((task) => ({
      atMs: task.s,
      durationMs: Math.round(task.d),
      kind: task.k,
      pluginMs: task.pm,
      passes: (task.p ?? []).map((hit) => hit.n),
    })),
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log('usage: node test/diagnostics/read-log.mjs [--file <log>] [--top 15] [--json]')
    return
  }
  const file = resolve(options.file)
  let text
  try {
    text = await readFile(file, 'utf8')
  } catch (error) {
    console.error(`cannot read ${file}: ${error.message}`)
    if (error.code === 'ENOENT') {
      console.error('the log is written by the Host route on the first flush after a restart of the DSH Desktop app')
    }
    process.exitCode = 1
    return
  }

  const payloads = []
  let unparsed = 0
  for (const line of text.split(/\r?\n/u)) {
    if (line.trim() === '') continue
    try {
      payloads.push(JSON.parse(line))
    } catch {
      unparsed += 1
    }
  }
  const { sessions, bad } = collect(payloads)
  const summarised = sessions.map((session) => summariseSession(session, options.top))

  if (options.json) {
    console.log(JSON.stringify({ file, lines: payloads.length, unparsed, unusable: bad, sessions: summarised }, null, 2))
    return
  }

  console.log(`log       ${file}`)
  console.log(`lines     ${payloads.length}${unparsed > 0 ? ` (${unparsed} unparsed)` : ''}${bad > 0 ? ` (${bad} without a session)` : ''}`)
  console.log(`sessions  ${summarised.length}`)
  if (summarised.length === 0) {
    console.log('\nno diagnostics payload has been flushed yet: the instrument build has not run, or the Host route never answered.')
    return
  }

  for (const session of summarised) {
    const stalls = session.stalls
    const durationS = Math.round((Date.parse(session.lastSampleAt) - Date.parse(session.firstSampleAt)) / 1000)
    console.log(`\n=== session ${session.id} — booted ${session.bootAt}, observed ${durationS}s over ${session.samples} flushes ===`)
    console.log(`context   ${JSON.stringify(session.context)}`)
    console.log(`stalls    ${stalls.count} over 250ms, ${stalls.over1s} over 1s, longest ${ms(stalls.maxMs)}, total ${ms(stalls.totalMs)}`)
    console.log(`  over 250ms: shell ${stalls.attribution.shell} · mixed ${stalls.attribution.mixed} · plugin ${stalls.attribution.plugin}`)
    console.log(`  over 1s   : shell ${stalls.over1sAttribution.shell} · mixed ${stalls.over1sAttribution.mixed} · plugin ${stalls.over1sAttribution.plugin}`)
    console.log(`  stall time: ${ms(stalls.shellOnlyMs)} attributed to the shell · ${ms(stalls.pluginCoveredMs)} to the plugin · ${ms(stalls.totalMs - stalls.shellOnlyMs - stalls.pluginCoveredMs)} mixed`)
    console.log(`  plugin passes ran for ${ms(stalls.pluginPassMs)} inside those windows (a sliver of every window is the frame task that opened it — see the tail column below)`)
    if (session.longTasks !== null) {
      console.log(`longtasks ${session.longTasks.count} (shell ${session.longTasks.shell} · mixed ${session.longTasks.mixed} · plugin ${session.longTasks.plugin}), longest ${ms(session.longTasks.maxMs)}, supported=${session.longTaskSupported}`)
    } else {
      console.log(`longtasks unsupported in this renderer (supported=${session.longTaskSupported})`)
    }
    if (session.queries !== null) {
      console.log(`reasoning query  calls ${session.queries.calls}, total ${ms(session.queries.totalMs)}, max ${ms(session.queries.maxMs)}, last ${ms(session.queries.lastMs)} over ${session.queries.lastCount} nodes`)
    }
    console.log('pass totals')
    for (const [name, stats] of Object.entries(session.passStats).sort((left, right) => right[1].totalMs - left[1].totalMs)) {
      console.log(`  ${name.padEnd(24)} calls ${String(stats.calls).padStart(6)}  total ${ms(stats.totalMs).padStart(8)}  max ${ms(stats.maxMs).padStart(8)}  last trigger ${stats.lastTrigger}`)
    }
    if (session.connectionSignals.length > 0) {
      console.log('connection/lifecycle signals')
      for (const line of session.connectionSignals.slice(-40)) console.log(`  ${line}`)
    }
    if (session.topStalls.length > 0) {
      console.log(`top ${session.topStalls.length} stalls`)
      for (const stall of session.topStalls) {
        console.log(`  ${stall.endedAt}  ${ms(stall.durationMs).padStart(8)}  ${stall.attribution.padEnd(6)} plugin ${ms(stall.pluginMs)} (${Math.round(stall.coverage * 100)}%)  tail ${ms(stall.frameTaskTailMs)}  window ${ms(stall.windowMs)}  elems ${stall.elements}  ink ${stall.liveInk}  textNodes/frame ${stall.textNodesInFrame}  visible ${stall.visible}`)
        for (const pass of stall.passes) console.log(`      overlap: ${pass}`)
        if (stall.nearestPassBefore !== null) console.log(`      last plugin pass: ${stall.nearestPassBefore}`)
      }
    }
    if (session.droppedPasses > 0) console.log(`dropped   ${session.droppedPasses} per-pass records (cap reached while the route was failing)`)
  }

  const total = summarised.reduce((accumulator, session) => {
    accumulator.over1s += session.stalls.over1s
    accumulator.shell += session.stalls.over1sAttribution.shell
    accumulator.mixed += session.stalls.over1sAttribution.mixed
    accumulator.plugin += session.stalls.over1sAttribution.plugin
    return accumulator
  }, { over1s: 0, shell: 0, mixed: 0, plugin: 0 })
  console.log(`\nverdict   ${total.over1s} stalls over 1s: shell ${total.shell}, mixed ${total.mixed}, plugin-attributed ${total.plugin}`)
  if (total.over1s === 0) console.log('          no freeze-scale stall was captured; check that the repro ran with the instrument build loaded')
  else if (total.shell > total.plugin) console.log('          most long stalls have no plugin pass covering them: the shell held the main thread')
  else if (total.plugin > total.shell) console.log('          most long stalls are covered by plugin passes: see the overlap lines above for which one')
  else console.log('          the long stalls split between the shell and this plugin: read the top-stall lines individually')
}

await main().catch((error) => {
  console.error(`read-log failed: ${error.message}`)
  process.exitCode = 1
})
