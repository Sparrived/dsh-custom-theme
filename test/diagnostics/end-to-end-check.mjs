#!/usr/bin/env node
/*
 * dsh-custom-theme — end-to-end check: instrumented client → diag route → log file.
 *
 *   node test/diagnostics/end-to-end-check.mjs [--plugin <plugin dir>] [--out <log>]
 *
 * This wires the two installed halves together in one Node process: the
 * instrumented client half runs inside the repository's DOM harness, its `fetch`
 * to `/dsh-custom-theme/diag` is handed to the block inserted in the installed
 * Host half (lifted verbatim, as in `host-route-check.mjs`), and the resulting
 * JSON-lines file is then read back and asserted — and can be handed straight to
 * `read-log.mjs` to check the parser the Lead will use.
 *
 * Default output: `<tmp>/dct-e2e/dct-diagnostics.log`.
 */

import { appendFile, mkdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const DEFAULT_PLUGIN = 'C:\\Users\\ASUS\\.dsh\\profiles\\desktop\\node_modules\\dsh-custom-theme'

const checks = []
function check(name, ok, detail) {
  checks.push({ name, ok: ok === true })
  console.log(`${ok === true ? 'ok  ' : 'FAIL'}  ${name}${detail === undefined ? '' : ` — ${detail}`}`)
}

function busy(ms) {
  const until = Date.now() + ms
  while (Date.now() < until) { /* hold the thread */ }
}

function parseArgs(argv) {
  const options = {
    plugin: DEFAULT_PLUGIN,
    out: join(tmpdir(), `dct-e2e-${Date.now()}`, 'dct-diagnostics.log'),
  }
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--plugin') {
      index += 1
      options.plugin = argv[index]
    } else if (argv[index] === '--out') {
      index += 1
      options.out = argv[index]
    }
  }
  return options
}

const options = parseArgs(process.argv.slice(2))
const plugin = resolve(options.plugin)
const clientPath = join(plugin, 'lib', 'client.js')
const hostPath = join(plugin, 'src', 'index.mjs')
const logFile = resolve(options.out)
// A rerun must not read the previous run's lines.
await rm(logFile, { force: true })

/* The Host half's route, lifted from the installed file. */
const hostSource = await readFile(hostPath, 'utf8')
const start = hostSource.indexOf('/** Environment override for the diagnostic log path')
const end = hostSource.indexOf('async function handleRoute')
if (start === -1 || end <= start) throw new Error('the installed host half does not carry the diag route')
const send = (res, status, contentType, body = '') => {
  res.writeHead(status, { 'content-type': contentType })
  res.end(body)
}
const handleDiagnostics = new Function(
  'send', 'mkdir', 'appendFile', 'dirname', 'join', 'dshHome',
  `${hostSource.slice(start, end)}\nreturn handleDiagnostics`,
)(send, mkdir, appendFile, dirname, join, () => join(plugin, '..', '..'))

/* Point the route at the check's log file. */
process.env.DCT_DIAG_LOG = logFile

/* The client half, in the repository's DOM harness. */
const harness = await import('../harness.mjs')
const copied = []
console.warn = (...args) => { copied.push(args.map((value) => String(value)).join(' ')) }
console.error = () => {}

const handed = []
const innerFetch = globalThis.fetch
globalThis.fetch = async (input, init) => {
  if (String(input) === '/dsh-custom-theme/diag') {
    const body = String(init?.body ?? '')
    handed.push(body)
    // Exactly the request shape the row's handler sees.
    const request = {
      method: 'POST',
      url: '/dsh-custom-theme/diag',
      destroy() {},
      async *[Symbol.asyncIterator]() { yield Buffer.from(body) },
    }
    const response = { writeHead() {}, end() {} }
    await handleDiagnostics(request, response, 'POST')
    return { ok: true, status: 200, json: async () => ({ ok: true }) }
  }
  return innerFetch(input, init)
}

const windowStub = globalThis.window
windowStub.addEventListener = () => {}
windowStub.removeEventListener = () => {}

await import(`${pathToFileURL(clientPath).href}?dct-diag-e2e=${Date.now()}`)

const picture = { name: 'e2e.png', opacity: 0.18, panelOpacity: 91, blur: 0, size: 'cover', position: 'center' }
const app = harness.boot({
  appearance: { streamingFadeInk: 0.35, reasoningExpand: 'streaming' },
  backgrounds: { global: picture, conversation: picture },
})

const turn = app.document.createElement('div')
turn.setAttribute('data-streaming', 'true')
app.document.body.append(turn)
const paragraph = app.document.createElement('p')
turn.append(paragraph)
const textNode = app.document.createTextNode('end to end')
paragraph.append(textNode)
const think = app.document.createElement('div')
think.setAttribute('data-variant', 'think')
think.setAttribute('data-state', 'running')
app.document.body.append(think)

app.triggerMutation([{ type: 'characterData', target: textNode }, { type: 'childList', addedNodes: [think] }])
app.runFrame()
busy(400)
app.runFrame()
globalThis.window.__DCT_DIAG__.pass('syntheticHeavyPass', () => busy(420), 'e2e')
app.runFrame()
console.warn('[connection] connection lost, retry #7')
await new Promise((done) => setTimeout(done, 40))
globalThis.window.__DCT_DIAG__.flush('manual')
await new Promise((done) => setTimeout(done, 40))

check('the client handed payloads to the route', handed.length >= 3, `${handed.length} posts: ${handed.map((body) => JSON.parse(body).reason).join(', ')}`)

const lines = (await readFile(logFile, 'utf8')).trim().split('\n').filter((line) => line.trim() !== '')
check('the route appended one JSON line per payload', lines.length === handed.length, `${lines.length} lines`)
let parsed = []
try {
  parsed = lines.map((line) => JSON.parse(line))
} catch (error) {
  check('every line is valid JSON', false, error.message)
}
check('every line carries receivedAt and the payload', parsed.length === lines.length
  && parsed.every((entry) => typeof entry.receivedAt === 'string' && typeof entry.payload?.session === 'string'))

const stalls = parsed.flatMap((entry) => entry.payload?.stalls ?? [])
check('a shell-attributed stall reached the file', stalls.some((stall) => stall.cover < 0.15 && stall.d > 250),
  stalls.map((stall) => `${Math.round(stall.d)}ms/${stall.cover}/tail ${stall.head}`).join(' '))
check('a plugin-attributed stall reached the file', stalls.some((stall) => stall.p.some((hit) => hit.n === 'syntheticHeavyPass') && stall.cover >= 0.9))
check('the pass table reached the file', parsed.some((entry) => entry.payload.passStats?.tickStreamInk !== undefined))
check('the connection warn reached the file', parsed.some((entry) => (entry.payload.signals ?? [])
  .some((signal) => signal.k === 'console.warn' && signal.t.includes('retry #7'))))
check('console.warn was still delivered to the console', copied.some((line) => line.includes('retry #7')))

const failed = checks.filter((entry) => !entry.ok)
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
console.log(`log       ${logFile}`)
console.log(`read it   node test/diagnostics/read-log.mjs --file "${logFile}"`)
if (failed.length === 0 && process.env.DCT_DIAG_KEEP !== '1') {
  // Left in place for the read-log step that follows this check.
}
process.exit(failed.length === 0 ? 0 : 1)
