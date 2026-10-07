/*
 * dsh-custom-theme — temporary diagnostic sink for the Host half (instrument
 * build only).
 *
 * `install.mjs` inserts this block verbatim into the INSTALLED `src/index.mjs`,
 * after the helpers it uses (`send`, `decodePath`) and before `handleRoute`, then
 * wires one dispatch branch inside `handleRoute`:
 *
 *   if (rest === 'diag') {
 *     await handleDiagnostics(req, res, method)
 *     return
 *   }
 *
 * It also adds `appendFile` to the `node:fs/promises` import and `dirname` to the
 * `node:path` import. Nothing else in the row changes: the route is additive, it
 * never throws out (every failure answers `{ ok: false }`), it creates the log
 * directory when missing, and it appends one JSON line per posted payload.
 */

/** Environment override for the diagnostic log path; the default lives in the desktop profile. */
const DIAG_LOG_ENV = 'DCT_DIAG_LOG'

/**
 * Where the renderer diagnostics are appended.
 *
 * The default is the profile directory this instrument build was installed into,
 * so the Lead can read it from disk without knowing anything about the app's
 * request routing. `DCT_DIAG_LOG` overrides it.
 * @returns The absolute log file path.
 */
function diagLogFile() {
  const configured = process.env[DIAG_LOG_ENV]
  if (typeof configured === 'string' && configured.trim() !== '') return configured.trim()
  return join(dshHome(), 'profiles', 'desktop', 'dct-diagnostics.log')
}

/**
 * Read a request body under a size cap.
 * @param req - Request whose body is the payload.
 * @param limit - Maximum accepted bytes.
 * @returns The body, or `undefined` when it exceeded the cap (the request is destroyed).
 */
async function diagReadBody(req, limit) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) {
      req.destroy()
      return undefined
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

/**
 * Answer `GET /diag` (a liveness probe naming the log file) and
 * `POST /diag` (append one JSON line). Every failure is reported in the body
 * rather than thrown, so a diagnostics problem can never disturb the app.
 * @param req - Request from the application origin.
 * @param res - Response owned by this handler.
 * @param method - Request method, already read by the caller.
 */
async function handleDiagnostics(req, res, method) {
  const file = diagLogFile()
  try {
    if (method === 'GET' || method === 'HEAD') {
      send(res, 200, 'application/json; charset=utf-8', JSON.stringify({ ok: true, instrument: 'dsh-custom-theme-diag/1', file }))
      return
    }
    if (method !== 'POST') {
      send(res, 405, 'text/plain; charset=utf-8', 'method not allowed')
      return
    }
    const body = await diagReadBody(req, 4 * 1024 * 1024)
    if (body === undefined || body.length === 0) {
      send(res, 200, 'application/json; charset=utf-8', JSON.stringify({ ok: false, error: 'empty or oversized body', file }))
      return
    }
    let payload
    const text = body.toString('utf8')
    try {
      payload = JSON.parse(text)
    } catch {
      payload = { unparsed: text.slice(0, 20000) }
    }
    const line = `${JSON.stringify({ receivedAt: new Date().toISOString(), payload })}\n`
    await mkdir(dirname(file), { recursive: true })
    await appendFile(file, line, 'utf8')
    send(res, 200, 'application/json; charset=utf-8', JSON.stringify({ ok: true, file, bytes: Buffer.byteLength(line) }))
  } catch (error) {
    try {
      send(res, 200, 'application/json; charset=utf-8', JSON.stringify({ ok: false, error: error?.message ?? String(error), file }))
    } catch (inner) {
      // The response is already gone; there is nothing left to report on.
    }
  }
}
