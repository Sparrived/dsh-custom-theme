/**
 * The small HTTP layer the route is written against.
 *
 * Kept apart from the route so the route reads as a list of paths and answers,
 * and so the two places that read a body out of a request share one cap.
 */

/** Largest JSON body this route accepts; the switch is one boolean. */
const MAX_JSON_BYTES = 4096

/**
 * Write one response. Handlers own the raw `ServerResponse`.
 * @param res - Response owned by this handler.
 * @param status - HTTP status code.
 * @param contentType - Response media type.
 * @param body - Response body as text or bytes; empty for error statuses.
 */
export function send(res, status, contentType, body = '') {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(body)
  res.writeHead(status, {
    'content-type': contentType,
    'cache-control': 'no-store',
    'content-length': payload.length,
  })
  res.end(payload)
}

/**
 * Percent-decode a request path.
 * @param value - Raw path below the route prefix.
 * @returns Decoded text, or `undefined` when the escape sequence is malformed.
 */
export function decodePath(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return undefined
  }
}

/**
 * Read a JSON request body.
 * @param req - Request.
 * @returns The parsed body; an empty body reads as `{}`.
 */
export async function readJson(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_JSON_BYTES) throw new Error(`the body is larger than ${MAX_JSON_BYTES} bytes`)
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks).toString('utf8').trim()
  return text === '' ? {} : JSON.parse(text)
}
