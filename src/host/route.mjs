/**
 * The plugin's one route handler.
 *
 * It owns the whole subtree under the prefix: the theme listing and stylesheets,
 * the background listing, bytes and upload, the update actions and their state, and
 * the reasoning-level switch. Every other path under the prefix is a 404.
 *
 * Two shapes are deliberate and worth keeping: the actions that write answer `POST`
 * only, so a link, a prefetch or a cross-site navigation can never start an install
 * or edit the profile, and the read paths answer `GET` and `HEAD` only.
 */

import { backgroundContentType, isBundledThemeId } from '../themes.mjs'
import { backgroundListing, readBackground, receiveBackground } from './backgrounds-store.mjs'
import { decodePath, readJson, send } from './http.mjs'
import { readTheme, scanThemes } from './themes-store.mjs'
import { ROUTE_PATH } from './urls.mjs'

/**
 * Answer the listing, stylesheet, background and update routes. Every other path
 * under the prefix is a 404; the route is `prefix`, so this handler owns the whole
 * subtree.
 * @param req - Request from the application origin.
 * @param res - Response owned by this handler.
 * @param paths - `themes` and `backgrounds` directories, `ready`, which settles
 *   once the initial seeding pass finished, `updates`, the update state's
 *   `state`, `check` and `apply` handlers, and `efforts`, the reasoning-level
 *   switch's `status` and `set`.
 */
export async function handleRoute(req, res, paths) {
  await paths.ready
  const url = new URL(req.url ?? '/', 'http://localhost')
  const rest = decodePath(url.pathname.slice(ROUTE_PATH.length + 1))
  if (rest === undefined) {
    send(res, 400, 'text/plain; charset=utf-8', 'malformed path')
    return
  }
  const method = req.method ?? 'GET'

  // The two update actions change the profile, so they answer POST only. A GET has
  // to stay safe for a link, a prefetch or an image, none of which may start an
  // install; that also keeps a cross-site navigation from reaching them.
  if (rest === 'update/check' || rest === 'update/apply') {
    if (method !== 'POST') {
      send(res, 405, 'text/plain; charset=utf-8', 'method not allowed')
      return
    }
    const answer = rest === 'update/check' ? await paths.updates.check() : await paths.updates.apply()
    send(res, 200, 'application/json; charset=utf-8', JSON.stringify(answer))
    return
  }
  // A picture the user picked is posted as the raw body, so it lands in the directory
  // the same way a dropped-in file does and every zone can then select it. This is a
  // POST because it writes, and it carries no JSON, so it is read as bytes.
  if (rest === 'backgrounds' && method === 'POST') {
    const answer = await receiveBackground(req, url, paths.backgrounds)
    send(res, answer.status, 'application/json; charset=utf-8', JSON.stringify(answer.body))
    return
  }
  // The reasoning-level switch writes to the profile's patch file, so it answers POST too.
  if (rest === 'effort-levels' && method === 'POST') {
    let body
    try {
      body = await readJson(req)
    } catch (error) {
      send(res, 400, 'text/plain; charset=utf-8', `malformed request: ${error.message}`)
      return
    }
    const answer = await paths.efforts.set(body?.enabled !== false)
    send(res, 200, 'application/json; charset=utf-8', JSON.stringify(answer))
    return
  }
  if (method !== 'GET' && method !== 'HEAD') {
    send(res, 405, 'text/plain; charset=utf-8', 'method not allowed')
    return
  }
  if (rest === 'update') {
    send(res, 200, 'application/json; charset=utf-8', JSON.stringify(await paths.updates.state()))
    return
  }
  if (rest === 'effort-levels') {
    send(res, 200, 'application/json; charset=utf-8', JSON.stringify(await paths.efforts.status()))
    return
  }
  if (rest === 'themes') {
    const themes = (await scanThemes(paths.themes)).map((id) => ({ id, bundled: isBundledThemeId(id) }))
    send(res, 200, 'application/json; charset=utf-8', JSON.stringify({ themes, dir: paths.themes }))
    return
  }
  if (rest === 'backgrounds') {
    send(res, 200, 'application/json; charset=utf-8', JSON.stringify(await backgroundListing(paths.backgrounds)))
    return
  }
  const theme = /^theme\/([^/]+)\.css$/u.exec(rest)
  if (theme !== null) {
    const text = await readTheme(paths.themes, theme[1])
    if (text === undefined) {
      send(res, 404, 'text/plain; charset=utf-8', 'theme not found')
      return
    }
    send(res, 200, 'text/css; charset=utf-8', text)
    return
  }
  const background = /^background\/([^/]+)$/u.exec(rest)
  const bytes = background === null ? undefined : await readBackground(paths.backgrounds, background[1])
  if (bytes === undefined) {
    send(res, 404, 'text/plain; charset=utf-8', 'background not found')
    return
  }
  send(res, 200, backgroundContentType(background[1]), bytes)
}
