#!/usr/bin/env node
/*
 * dsh-custom-theme — smoke test for the instrument build's CLIENT half.
 *
 *   node test/diagnostics/smoke.mjs [--client <installed lib/client.js>]
 *
 * It reuses the repository's own DOM harness (`test/harness.mjs`, read-only) to
 * materialize the *installed, instrumented* bundle in Node, then proves the
 * things the instrumentation is for and the things it must never do:
 *
 *   · boot and teardown still work, with the plugin's own paths intact;
 *   · a 250 ms+ frame gap is recorded, and a gap with no plugin pass in it is
 *     attributed to the shell while a gap covered by one is attributed to the
 *     plugin;
 *   · the plugin's passes (streaming ink, mutation observer, reasoning query,
 *     zone repaint) are timed and counted;
 *   · `console.warn` is still delivered to the original and its
 *     `[connection] connection lost, retry #N` line is captured;
 *   · the flush payload posts to the plugin's own route and mirrors into
 *     localStorage;
 *   · an exception thrown by an instrumented pass still propagates unchanged.
 *
 * This is a Node/DOM-stub test: it does not (and cannot) prove how the live
 * WebView2 renderer behaves. It proves the instrumentation itself is sound.
 */

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const DEFAULT_CLIENT = 'C:\\Users\\ASUS\\.dsh\\profiles\\desktop\\node_modules\\dsh-custom-theme\\lib\\client.js'
const DIAG_URL = '/dsh-custom-theme/diag'

const checks = []
function check(name, ok, detail) {
  checks.push({ name, ok: ok === true, detail })
  console.log(`${ok === true ? 'ok  ' : 'FAIL'}  ${name}${detail === undefined ? '' : ` — ${detail}`}`)
}

function busy(ms) {
  const until = Date.now() + ms
  while (Date.now() < until) { /* hold the thread, exactly as a long task does */ }
}

function parseArgs(argv) {
  const options = { client: DEFAULT_CLIENT }
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--client') {
      index += 1
      options.client = argv[index]
    }
  }
  return options
}

const options = parseArgs(process.argv.slice(2))
const clientPath = resolve(options.client)
const source = await readFile(clientPath, 'utf8')
console.log(`client    ${clientPath}`)
check('the client bundle is the instrument build', source.includes('DCT DIAGNOSTICS'))

/* The repository harness registers the CLEAN bundle on import; importing the
 * installed one afterwards re-registers `definition`, so `boot()` materializes
 * the instrument build. */
const harness = await import('../harness.mjs')

// A console spy that stands in for the shell's console: the runtime must copy
// through to it, and the copied line is what proves it.
const copied = []
console.warn = (...args) => { copied.push(args.map((value) => String(value)).join(' ')) }
console.error = (...args) => { copied.push(args.map((value) => String(value)).join(' ')) }

// The diagnostics POST is captured synchronously; everything else falls through
// to the harness's own fetch double.
const posts = []
const innerFetch = globalThis.fetch
globalThis.fetch = (input, init) => {
  if (String(input) === DIAG_URL) {
    posts.push(String(init?.body ?? ''))
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) })
  }
  return innerFetch(input, init)
}

await import(`${pathToFileURL(clientPath).href}?dct-diag-smoke=${Date.now()}`)

const windowListeners = new Map()
const windowStub = globalThis.window
windowStub.addEventListener = (type, listener) => {
  if (!windowListeners.has(type)) windowListeners.set(type, [])
  windowListeners.get(type).push(listener)
}
windowStub.removeEventListener = (type, listener) => {
  const list = windowListeners.get(type) ?? []
  windowListeners.set(type, list.filter((entry) => entry !== listener))
}

const picture = { name: 'smoke.png', opacity: 0.18, panelOpacity: 91, blur: 0, size: 'cover', position: 'center' }
const app = harness.boot({
  appearance: { streamingFadeInk: 0.35, reasoningExpand: 'streaming' },
  backgrounds: { global: picture, conversation: picture },
})

const diag = globalThis.window.__DCT_DIAG__
check('the runtime installed itself on window', diag !== undefined && diag !== null && diag.version === 'dct-diag/1', diag?.version)
check('the plugin booted without a warning', app.warnings.length === 0, app.warnings.join(' | ') || 'none')

/* A streaming turn, as the shell writes one, plus a running reasoning block. */
const turn = app.document.createElement('div')
turn.setAttribute('data-streaming', 'true')
app.document.body.append(turn)
const paragraph = app.document.createElement('p')
turn.append(paragraph)
const textNode = app.document.createTextNode('a streamed sentence')
paragraph.append(textNode)
const think = app.document.createElement('div')
think.setAttribute('data-variant', 'think')
think.setAttribute('data-state', 'running')
app.document.body.append(think)

app.triggerMutation([{ type: 'characterData', target: textNode }, { type: 'childList', addedNodes: [think] }])
app.runFrame()
app.runFrame()

check('the streaming ink painted (the plugin still works)', harness.highlights.size > 0, `${harness.highlights.size} live highlights`)

/* Stall 1: the thread is held with no plugin pass anywhere near it. */
busy(420)
app.runFrame()
/* Stall 2: the thread is held from inside a plugin pass. */
diag.pass('syntheticHeavyPass', () => busy(420), 'smoke')
app.runFrame()

/* The pass contract: an exception is re-thrown untouched, and still recorded. */
let thrown = false
try {
  diag.pass('syntheticBoom', () => { throw new Error('boom') }, 'smoke')
} catch (error) {
  thrown = error.message === 'boom'
}
check('an instrumented pass re-throws the original error', thrown)

/* Shell signal: the reconnect warn must reach the original console and be captured. */
console.warn('[connection] connection lost, retry #4')
check('console.warn is copied through to the original', copied.length === 1 && copied[0].includes('retry #4'), copied.join(' | '))

/* Unload path: a pagehide flush must post too. */
for (const listener of windowListeners.get('pagehide') ?? []) listener({ type: 'pagehide' })

await new Promise((done) => setTimeout(done, 30))
const hello = posts.map((body) => JSON.parse(body)).find((payload) => payload.reason === 'hello')
const connection = posts.map((body) => JSON.parse(body)).find((payload) => payload.reason === 'connection')
const pagehide = posts.map((body) => JSON.parse(body)).find((payload) => payload.reason === 'pagehide')
check('the boot hello flushed through the plugin route', hello !== undefined, `${posts.length} posts`)
check('the connection signal flushed its own payload', connection !== undefined
  && connection.signals.some((signal) => signal.k === 'console.warn' && signal.t.includes('retry #4')), connection?.signals?.length)
check('pagehide flushed a compact payload', pagehide !== undefined && pagehide.passes.length === 0)

diag.flush('manual')
await new Promise((done) => setTimeout(done, 30))
const allPayloads = posts.map((body) => JSON.parse(body))
const manual = allPayloads.filter((payload) => payload.reason === 'manual').pop()
// Stall records are drained by whichever flush comes next, so they are read
// across every payload rather than from the manual one alone.
const allStalls = allPayloads.flatMap((payload) => payload.stalls ?? [])
check('a manual flush posted a payload', manual !== undefined)
if (manual !== undefined) {
  check('the payload carries the schema and session', manual.schema === 'dct-diag/1' && typeof manual.session === 'string')
  const shellStall = allStalls.find((stall) => stall.d > 250 && stall.cover < 0.15)
  const pluginStall = allStalls.find((stall) => stall.p.some((hit) => hit.n === 'syntheticHeavyPass'))
  check('a stall with no plugin pass is recorded and attributed to the shell', shellStall !== undefined,
    shellStall === undefined ? '' : `${Math.round(shellStall.d)}ms, cover ${shellStall.cover}`)
  check('a stall covered by a plugin pass is attributed to the plugin', pluginStall !== undefined && pluginStall.cover >= 0.9,
    pluginStall === undefined ? '' : `${Math.round(pluginStall.d)}ms, cover ${pluginStall.cover}, pass ${pluginStall.p[0]?.n}`)
  check('every stall carries start, end, duration and context', allStalls.length > 0
    && allStalls.every((stall) => typeof stall.s === 'number' && typeof stall.e === 'number' && typeof stall.d === 'number'
      && typeof stall.elems === 'number' && typeof stall.ink === 'number' && typeof stall.txn === 'number'))
  check('the plugin passes are timed with their triggers', manual.passStats.tickStreamInk !== undefined
    && manual.passStats.tickStreamInk.lastTrigger === 'raf-batch'
    && manual.passStats.mutationObserver !== undefined
    && manual.passStats.applyBackgroundsWhenReady !== undefined, Object.keys(manual.passStats).join(', '))
  check('the zone observer pass is timed', manual.passStats.zoneObserver !== undefined,
    `calls ${manual.passStats.zoneObserver?.calls ?? 0}`)
  check('the reasoning document query is timed and counted', manual.queries.calls > 0 && manual.queries.lastCount >= 1,
    `calls ${manual.queries.calls}, nodes ${manual.queries.lastCount}`)
  check('the mutation records named text nodes per frame', manual.context.textNodes > 0, String(manual.context.textNodes))
  check('longtask support is reported, not assumed', typeof manual.longTaskSupported === 'boolean', String(manual.longTaskSupported))
}

const mirror = harness.storage.getItem('dsh-custom-theme.diagnostics')
let mirrored = null
try { mirrored = JSON.parse(mirror) } catch { mirrored = null }
check('the summary is mirrored into localStorage', mirrored !== null && mirrored.stallTotals.over250 >= 2, mirror === null ? 'missing' : `${mirror.length} bytes`)

/* Teardown must still work, and the watchdog must survive it (it is a page-level
 * instrument, not a plugin one). */
let disposed = false
try {
  app.dispose()
  disposed = true
} catch (error) {
  disposed = false
}
check('the plugin still disposes cleanly', disposed)
app.runFrame()
diag.flush('manual')
await new Promise((done) => setTimeout(done, 30))
check('the runtime keeps reporting after a plugin teardown', posts.map((body) => JSON.parse(body)).filter((payload) => payload.reason === 'manual').length >= 2)

const failed = checks.filter((entry) => !entry.ok)
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
process.exit(failed.length === 0 ? 0 : 1)
