#!/usr/bin/env node
/*
 * dsh-custom-theme — functional check for the instrument build's HOST half.
 *
 *   node test/diagnostics/host-route-check.mjs [--host <installed src/index.mjs>]
 *
 * The diagnostics sink is a route inside the installed `src/index.mjs`, which is
 * not exported; this reads that file, lifts the inserted block verbatim, and runs
 * it against stub `send`/fs helpers with a fake request. It proves the parts the
 * Lead depends on without a running app:
 *
 *   · `POST /diag` creates the log directory and appends one JSON line;
 *   · the line carries `receivedAt` and the posted payload;
 *   · `GET /diag` answers with the log path (the liveness probe);
 *   · a body that is not JSON (or is empty, or too large) is answered with
 *     `{ ok: false }` and never throws out of the route;
 *   · `DCT_DIAG_LOG` moves the file.
 */

import { createHash } from 'node:crypto'
import { appendFile, mkdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const DEFAULT_HOST = 'C:\\Users\\ASUS\\.dsh\\profiles\\desktop\\node_modules\\dsh-custom-theme\\src\\index.mjs'
const checks = []
function check(name, ok, detail) {
  checks.push({ name, ok: ok === true })
  console.log(`${ok === true ? 'ok  ' : 'FAIL'}  ${name}${detail === undefined ? '' : ` — ${detail}`}`)
}

function parseArgs(argv) {
  const options = { host: DEFAULT_HOST }
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--host') {
      index += 1
      options.host = argv[index]
    }
  }
  return options
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex')
}

/** A request whose body iterates once, like the inbound stream the route reads. */
function makeRequest(method, body) {
  const chunks = body === undefined ? [] : [Buffer.from(body)]
  return {
    method,
    url: '/dsh-custom-theme/diag',
    destroyed: false,
    destroy() { this.destroyed = true },
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk
    },
  }
}

function makeResponse() {
  return {
    headersSent: false,
    status: 0,
    contentType: '',
    body: '',
    writeHead(status, headers) {
      this.status = status
      this.contentType = headers?.['content-type'] ?? ''
      this.headersSent = true
    },
    end(payload) {
      this.body = Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload ?? '')
      this.headersSent = true
    },
  }
}

const options = parseArgs(process.argv.slice(2))
const hostPath = resolve(options.host)
const source = await readFile(hostPath, 'utf8')

const start = source.indexOf('/** Environment override for the diagnostic log path')
const end = source.indexOf('async function handleRoute')
check('the installed host half carries the diag route', start !== -1 && end > start, hostPath)
if (start === -1 || end <= start) {
  console.log('\n0/1 checks passed')
  process.exit(1)
}

// The block is executed with the same helpers the row gives it. `send` is the
// row's own writer, reproduced here exactly as `src/index.mjs` defines it.
const send = (res, status, contentType, body = '') => {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(body)
  res.writeHead(status, { 'content-type': contentType, 'cache-control': 'no-store', 'content-length': payload.length })
  res.end(payload)
}
const factory = new Function(
  'send', 'mkdir', 'appendFile', 'dirname', 'join', 'dshHome',
  `${source.slice(start, end)}\nreturn handleDiagnostics`,
)
const workdir = join(tmpdir(), `dct-diag-route-${Date.now()}`)
// The default is `<dshHome>/profiles/desktop/dct-diagnostics.log`, and the
// `profiles/desktop` directory is deliberately absent here: the route has to
// create it.
const logFile = join(workdir, 'profiles', 'desktop', 'dct-diagnostics.log')
const handleDiagnostics = factory(send, mkdir, appendFile, dirname, join, () => workdir)

const payload = { schema: 'dct-diag/1', session: 'check', seq: 1, stalls: [{ d: 421 }] }
const post = makeResponse()
await handleDiagnostics(makeRequest('POST', JSON.stringify(payload)), post, 'POST')
check('POST answers ok', post.status === 200 && JSON.parse(post.body).ok === true, post.body.slice(0, 120))

const written = await readFile(logFile, 'utf8')
const lines = written.trim().split('\n')
check('one JSON line was appended to a directory that did not exist', lines.length === 1, `${written.length} bytes`)
const record = JSON.parse(lines[0])
check('the line carries receivedAt and the posted payload', typeof record.receivedAt === 'string'
  && record.payload.schema === 'dct-diag/1' && record.payload.stalls[0].d === 421)

const get = makeResponse()
await handleDiagnostics(makeRequest('GET'), get, 'GET')
check('GET is a liveness probe naming the file', JSON.parse(get.body).ok === true && JSON.parse(get.body).file === logFile, get.body)

const bad = makeResponse()
await handleDiagnostics(makeRequest('POST', 'not json at all'), bad, 'POST')
const secondLine = (await readFile(logFile, 'utf8')).trim().split('\n')[1]
check('a non-JSON body still lands, flagged as unparsed', bad.status === 200 && JSON.parse(secondLine).payload.unparsed === 'not json at all')

const empty = makeResponse()
await handleDiagnostics(makeRequest('POST', ''), empty, 'POST')
check('an empty body is answered without throwing', empty.status === 200 && JSON.parse(empty.body).ok === false)

const wrong = makeResponse()
await handleDiagnostics(makeRequest('PUT', 'x'), wrong, 'PUT')
check('another method is refused', wrong.status === 405)

const envLog = join(workdir, 'env.log')
process.env.DCT_DIAG_LOG = envLog
const moved = makeResponse()
await handleDiagnostics(makeRequest('POST', JSON.stringify({ probe: true })), moved, 'POST')
check('DCT_DIAG_LOG moves the file', (await readFile(envLog, 'utf8')).includes('"probe":true'))
delete process.env.DCT_DIAG_LOG

await rm(workdir, { recursive: true, force: true })
const failed = checks.filter((entry) => !entry.ok)
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed  (host ${sha256(source).slice(0, 12)})`)
process.exit(failed.length === 0 ? 0 : 1)
