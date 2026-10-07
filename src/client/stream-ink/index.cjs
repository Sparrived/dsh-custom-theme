/**
 * stream-ink/index.cjs — the streaming ink: the characters that just arrived, ramped in.
 */

module.exports = function (deps) {
  const { appearanceSettings, ctx } = deps

  const { STREAM_FADE_DURATION_MAX, STREAM_FADE_DURATION_MIN, STREAM_FADE_INK_MAX, STREAM_FADE_INK_MIN } = require('../appearance/constants.cjs')

const STREAM_INK_HIGHLIGHT_PREFIX = 'dsh-custom-theme-ink-'
/** Non-prose hosts and inline maths keep their own colours, so they are never inked. */
const STREAM_INK_SKIP_SELECTOR = 'pre, code, .katex, .math-inline, .math-display'
/** The turns that are still being written. */
const STREAM_INK_LIVE_SELECTOR = '[data-streaming="true"], [data-variant="think"][data-state="running"]'
/**
 * The registered custom property the ramp animates.
 *
 * Registered because an unregistered custom property is a string, and a string has
 * nothing to interpolate between the writing ink and 1. The highlight rule reads it for
 * its alpha, which is what lets the ramp be one CSS animation on the element instead of a
 * timer rewriting the rule thirty times a second.
 */
const STREAM_INK_PROPERTY = '--dct-stream-ink'
/**
 * Live ink, one entry per text node the shell is writing into.
 *
 * Per node rather than per turn, so one chunk's ramp runs to its own end instead of being
 * cut off by the next one; a Map rather than a WeakMap, because an entry removes itself
 * once its ramp settles.
 */
const streamInkNodes = new WeakMap()
/**
 * The inks with a ramp or a highlight still live, so they can be withdrawn as a set.
 *
 * Kept apart from the baseline above on purpose. A settled ink keeps its place in the
 * baseline — the next chunk has to know where the last one ended, or it would claim the
 * whole text node again and fade the paragraph a second time — while it leaves this set,
 * which is the one a settings change and an unload walk. The baseline is a `WeakMap`, so
 * a node that leaves the transcript takes its entry with it.
 */
const streamInkLive = new Set()
/** Text nodes reported since the last frame, so a burst of chunks costs one pass. */
const streamInkPending = new Set()
let streamInkQueued = false
let streamInkSequence = 0
let streamInkStyle = null

/** Whether this browser can paint a highlight at all. */
function streamInkSupported() {
  return typeof CSS !== 'undefined' && CSS !== null && typeof CSS.highlights === 'object' && CSS.highlights !== null
    && typeof Highlight === 'function' && typeof document.createRange === 'function'
}

/** The plugin's own stylesheet, holding one rule per live ink. */
function streamInkStylesheet() {
  if (streamInkStyle === null) {
    streamInkStyle = document.createElement('style')
    streamInkStyle.dataset.plugin = 'dsh-custom-theme'
    streamInkStyle.dataset.role = 'stream-ink'
    document.head.append(streamInkStyle)
    // Registered once, on the first sheet. Registering the same property twice throws, and
    // a property another context already registered is exactly what this wants anyway.
    if (typeof CSS !== 'undefined' && CSS !== null && typeof CSS.registerProperty === 'function') {
      try {
        CSS.registerProperty({ name: STREAM_INK_PROPERTY, syntax: '<number>', inherits: true, initialValue: '1' })
      } catch {
        // Already registered: the ramp uses the registration that exists.
      }
    }
  }
  return streamInkStyle
}

/** Whether one text node is prose the shell is still writing into. */
function streamInkTarget(node) {
  if (node === null || node === undefined || node.nodeType !== 3) return false
  const parent = node.parentElement
  if (parent === null || parent === undefined || typeof parent.closest !== 'function') return false
  if (parent.closest(STREAM_INK_SKIP_SELECTOR) !== null) return false
  return parent.closest(STREAM_INK_LIVE_SELECTOR) !== null
}

/**
 * Claim a rule for one ink, once, at the end of the plugin's own sheet.
 *
 * The rule is written once and never touched again: its alpha comes from the custom
 * property the ramp animates, so a chunk costs one animation and no restyling at all.
 * @param state - The ink.
 * @param colour - The prose colour the highlighted characters settle into.
 * @returns Whether the browser gave it a rule.
 */
function claimStreamInkRule(state, colour) {
  if (state.rule !== null) return true
  const sheet = streamInkStylesheet().sheet
  if (sheet === null || sheet === undefined || typeof sheet.insertRule !== 'function') return false
  streamInkSequence += 1
  state.name = `${STREAM_INK_HIGHLIGHT_PREFIX}${streamInkSequence}`
  try {
    sheet.insertRule(
      `::highlight(${state.name}) { color: rgba(${colour.r}, ${colour.g}, ${colour.b}, var(${STREAM_INK_PROPERTY})) }`,
      sheet.cssRules.length,
    )
    // The rule is taken back out of the sheet instead of from the call's own return value.
    // The spec returns the rule that was inserted; current Chromium returns its index, and
    // the sheet is the one reading that means the same thing on both. It matters beyond
    // tidiness: {@link releaseStreamInk} has to recognise this exact rule to withdraw it,
    // and an index is not something it can recognise later — the rules around it leave all
    // the time — so on a browser that returns one the ink sheet grew by a rule for every
    // chunk ever inked, and every recalculation of the document matched all of them.
    const rules = sheet.cssRules
    state.rule = rules.length === 0 ? null : rules[rules.length - 1]
  } catch {
    return false
  }
  return state.rule !== null
}

/**
 * Whether the text an ink is painted over is still where the shell put it.
 *
 * A `Range` whose node left the document paints nothing, so an ink the shell detached
 * mid-ramp is a registry entry, a rule and a timer spent on empty space. `isConnected`
 * is a flag rather than a query, so reading it costs less than the timer it replaces.
 * @param node - The text node an ink is painted over.
 * @returns Whether that text is still in the document.
 */
function streamInkAttached(node) {
  if (node === null || node === undefined || node.nodeType !== 3) return false
  // A node taken out of its parent keeps no parent element; a node inside a subtree the
  // shell replaced keeps the pointer, but that element is no longer connected. An
  // environment without the flag reads as connected: keeping an ink to its own timer is
  // exactly today's behaviour, while retiring one the reader can still see is not.
  const parent = node.parentElement
  if (parent === null || parent === undefined) return false
  return parent.isConnected !== false
}

/**
 * Retire the inks whose text the shell has taken out of the document.
 *
 * The shell detaching a subtree is itself a mutation record, so a frame is already
 * following it: sweeping there costs one flag read per live ink and no pass of its own,
 * and keeps the registry at the size of the ramps that are really running instead of
 * holding a dead entry — and its rule and timer — for the rest of the fade. Only
 * {@link streamInkLive} shrinks; the settled baseline is untouched, so the same node
 * coming back is still inked from where it left off rather than from zero.
 */
function retireDetachedStreamInk() {
  for (const state of streamInkLive) {
    // Deleting the entry being visited is defined for a Set, so this copies nothing per
    // frame — which matters, because this runs on every one of them.
    if (!streamInkAttached(state.node)) releaseStreamInk(state)
  }
}

/** The colour the shell gives that text, as `{ r, g, b }`, or null when it cannot be read. */
function streamInkColour(element) {
  if (element === null || element === undefined || typeof getComputedStyle !== 'function') return null
  let resolved = ''
  try {
    resolved = getComputedStyle(element).color ?? ''
  } catch {
    return null
  }
  const match = /rgba?\(\s*([0-9.]+)[,\s]+([0-9.]+)[,\s]+([0-9.]+)/u.exec(resolved)
  if (match === null) return null
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) }
}

/** The reader's motion preference, when the environment has one. */
function reducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/** Hand a settled node back to the shell: its ramp, its highlight entry and its rule. */
function releaseStreamInk(state) {
  if (state.timer !== 0) {
    clearTimeout(state.timer)
    state.timer = 0
  }
  if (state.animation !== null && state.animation !== undefined) {
    state.animation.cancel()
    state.animation = null
  }
  if (state.name !== '' && typeof CSS !== 'undefined' && CSS !== null && CSS.highlights !== null) CSS.highlights.delete(state.name)
  if (state.rule !== null) {
    const sheet = streamInkStylesheet().sheet
    // Walked rather than copied. `[...sheet.cssRules]` built an array as long as every ink
    // still ramping just to find one index, once per release; the list is live, so this
    // pays the same search without the allocation. Deleting by index is the only handle
    // CSSOM offers for a rule it was never handed the position of.
    if (sheet !== null && sheet !== undefined && typeof sheet.deleteRule === 'function') {
      const rules = sheet.cssRules
      for (let step = 0; step < rules.length; step += 1) {
        if (rules[step] === state.rule) {
          sheet.deleteRule(step)
          break
        }
      }
    }
    state.rule = null
  }
  state.range = null
  streamInkLive.delete(state)
}

/**
 * Ramp one ink from the writing ink to the text colour.
 *
 * The ramp is one CSS animation of the registered property, started on the element that
 * owns the text node — the element the highlight reads the property from. Nothing here
 * runs per frame, and no stylesheet is touched: a chunk costs one animation and one timer
 * for the release, which leaves the main thread and the style engine to the shell while a
 * reply streams.
 * @param state - The ink.
 * @param element - The element the highlighted text belongs to.
 * @param settings - The fade duration and writing ink in force.
 * @returns Whether a ramp was started.
 */
function rampStreamInk(state, element, settings) {
  if (element === null || element === undefined || typeof element.animate !== 'function') return false
  const duration = Math.min(STREAM_FADE_DURATION_MAX, Math.max(STREAM_FADE_DURATION_MIN, settings.streamingFadeDuration))
  const ink = Math.min(STREAM_FADE_INK_MAX, Math.max(STREAM_FADE_INK_MIN, settings.streamingFadeInk))
  if (state.animation !== null && state.animation !== undefined) state.animation.cancel()
  if (state.timer !== 0) clearTimeout(state.timer)
  try {
    state.animation = element.animate(
      [{ [STREAM_INK_PROPERTY]: ink }, { [STREAM_INK_PROPERTY]: 1 }],
      { duration, easing: 'cubic-bezier(.25, .2, .35, 1)', fill: 'forwards' },
    )
  } catch {
    // An element the browser refuses to animate: no ink rather than ink stuck faint.
    return false
  }
  state.timer = setTimeout(() => releaseStreamInk(state), duration)
  return true
}

/** Claim the characters between two offsets of one text node and start them settling. */
function paintStreamInk(plan, settings) {
  const { state, node, element, start, end, colour } = plan
  if (colour === null) return
  const range = document.createRange()
  try {
    range.setStart(node, start)
    range.setEnd(node, end)
  } catch {
    // Offsets a concurrent render invalidated: this chunk simply gets no ink.
    return
  }
  if (!claimStreamInkRule(state, colour)) return
  state.range = range
  state.colour = colour
  CSS.highlights.set(state.name, new Highlight(range))
  streamInkLive.add(state)
  if (!rampStreamInk(state, element, settings)) {
    // Nothing to animate, so the highlight would sit at the writing ink forever: hand the
    // characters straight back instead of leaving them faint.
    releaseStreamInk(state)
  }
}

/**
 * What one ink will need, read off the node and nothing else.
 *
 * Kept apart from {@link paintStreamInk} because the pass's colour reads and its stylesheet
 * writes must not be interleaved (see {@link tickStreamInk}). This touches no stylesheet and
 * resolves no style, so it is free to run as often as the records name a node.
 * @param node - A text node the observer named.
 * @returns What the pass needs to paint it, or null when it has nothing new to ink.
 */
function planStreamInk(node) {
  const text = typeof node.nodeValue === 'string' ? node.nodeValue : ''
  let state = streamInkNodes.get(node)
  if (state === undefined) {
    // A node the plugin has not seen before is one the shell has just written, so all of
    // it is new — which is why the baseline starts at zero rather than at its length.
    state = { node, name: '', rule: null, seen: 0, range: null, timer: 0, animation: null, colour: null }
    streamInkNodes.set(node, state)
  }
  if (text.length <= state.seen) return null
  const start = state.seen
  // Advanced here, exactly as the ink has always advanced it: a chunk whose paint fails —
  // a colour that cannot be read, offsets a render invalidated — is given up rather than
  // retried on every frame for the rest of the stream.
  state.seen = text.length
  return { state, node, element: node.parentElement ?? null, start, end: text.length, colour: null }
}

/**
 * Resolve the prose colour of every ink this pass will start.
 *
 * The answer is kept per element rather than per node, so a paragraph the shell writes
 * several text nodes into is priced once: the highlight a text node inherits is the
 * element's own computed colour, and siblings share it.
 * @param planned - The plans from {@link planStreamInk}, in the order they were planned.
 */
function resolveStreamInkColours(planned) {
  const colours = new Map()
  for (const plan of planned) {
    const element = plan.element
    if (colours.has(element)) {
      plan.colour = colours.get(element)
      continue
    }
    const colour = streamInkColour(element)
    colours.set(element, colour)
    plan.colour = colour
  }
}

/** Withdraw every live ink: the fade is off, or the plugin is unloading. */
function clearStreamInk() {
  for (const state of [...streamInkLive]) releaseStreamInk(state)
  streamInkPending.clear()
}

/**
 * Ink the characters the shell has just written.
 *
 * The observer hands over the text nodes its records named, so this never has to ask the
 * document where the streaming turns are. The same pass also retires the inks whose text
 * the shell has taken away, because a detach is one of those records. An appearance change
 * calls it with nothing: with the writing ink at 100% there is nothing to paint and
 * everything live is withdrawn, which is what turning the fade off means.
 *
 * The pass runs in two phases, and the order is the whole point. Writing a rule into the
 * sheet invalidates style, and the *next* colour read then resolves it — which, because a
 * newly inserted rule can match anything, means recalculating the whole document. Reading a
 * colour, claiming its rule and reading the next one therefore costs one full recalculation
 * per inked node: at the 190 text nodes a dense reply can name in a single frame, on a
 * transcript of 7 000 elements, that was tens of seconds of frozen main thread in one call
 * (measured in the shell: `tickStreamInk` at 5.63s, with the style recalculation covering
 * 71-87% of a 5.9-6.7s stall, and the connection dropped 12ms after one of them began).
 * So every colour this pass needs is resolved first — reads only, one recalculation, the one
 * the frame was going to pay anyway — and only then is a rule claimed for each of them.
 * @param nodes - Text nodes seen since the last frame; empty for a settings change.
 */
function tickStreamInk(nodes = []) {
  if (typeof document === 'undefined' || !streamInkSupported()) return
  const settings = appearanceSettings()
  if (settings === null || settings === undefined || settings.streamingFadeInk >= STREAM_FADE_INK_MAX) {
    clearStreamInk()
    return
  }
  if (reducedMotion()) {
    clearStreamInk()
    return
  }
  // What the shell detached is retired on this same pass, before what it wrote is inked:
  // a node that left takes its registry slot, its rule and its timer with it, rather than
  // holding all three until the fade would have ended.
  retireDetachedStreamInk()
  const planned = []
  for (const node of nodes) {
    if (!streamInkTarget(node)) continue
    const plan = planStreamInk(node)
    if (plan !== null) planned.push(plan)
  }
  // Phase one: every read. Phase two: every write.
  resolveStreamInkColours(planned)
  for (const plan of planned) paintStreamInk(plan, settings)
}

/**
 * Queue text nodes for the next frame.
 *
 * A streaming reply can write hundreds of times a second. Coalescing those into one pass
 * per frame is what keeps the ink from competing with the shell for the main thread — and
 * the shell's own deferred work, such as rendering the maths in a long reply, is exactly
 * what a per-character pass would starve.
 * @param nodes - Text nodes to look at.
 */
function scheduleStreamInk(nodes) {
  for (const node of nodes) streamInkPending.add(node)
  if (streamInkQueued) return
  streamInkQueued = true
  const run = () => {
    streamInkQueued = false
    const batch = [...streamInkPending]
    streamInkPending.clear()
    tickStreamInk(batch)
  }
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(run)
  else run()
}

/**
 * The text nodes a batch of mutation records wrote into.
 *
 * Read off the records rather than by asking the document, which is what makes the ink
 * affordable on a fast stream: a record names the node that changed.
 * @param records - Mutation records, or nothing when a caller triggers the observer bare.
 * @returns Nodes to consider, possibly empty.
 */
function streamInkTargets(records) {
  const nodes = []
  if (!Array.isArray(records)) return nodes
  for (const record of records) {
    if (record === null || record === undefined) continue
    if (record.type === 'characterData') {
      nodes.push(record.target)
      continue
    }
    const added = record.addedNodes
    if (added === null || added === undefined) continue
    for (const node of added) nodes.push(node)
  }
  return nodes
}

/**
 * Drop every live highlight and the rule that paints them, for teardown: the
 * ranges point at nodes React owns, and the sheet is this plugin's own.
 */
function disposeInkStyle() {
  clearStreamInk()
  if (streamInkStyle !== null) {
    streamInkStyle.remove()
    streamInkStyle = null
  }
}

  // The sheet is created by the first apply, so it is read through a call rather than handed out as
  // a value: a snapshot here would still be the `null` from before that apply.
  return { clearStreamInk, disposeInkStyle, tickStreamInk, scheduleStreamInk, streamInkTargets, streamInkStyle: () => streamInkStyle }
}
