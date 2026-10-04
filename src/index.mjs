/**
 * dsh-custom-theme — Host half.
 *
 * Owns a user-editable CSS theme directory (`$DSH_HOME/themes`) and serves it to
 * the browser half over a prefix route on the Web Host. Bundled themes are
 * seeded once, and a user who drops an extra `.css` file into the directory gets
 * a new entry in the Appearance picker without touching any configuration.
 *
 * Imports no third-party modules: the row must stay loadable by a profile that
 * links this package directly, with no peer resolution for a Schemastery `Config`
 * schema yet. `config` is therefore read defensively.
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  BUNDLED_THEME_IDS,
  MAX_BACKGROUND_BYTES,
  MAX_THEME_BYTES,
  SEED_VERSION,
  backgroundContentType,
  backgroundsDirectory,
  isBackgroundName,
  isBundledThemeId,
  isThemeId,
  orderThemeIds,
  themesDirectory,
} from './themes.mjs'

/**
 * Prefix route owned by this plugin. `dsh-client-ui-theme` and the SPA dist use
 * other paths.
 *
 * No trailing slash: the webserver matches a prefix `p` against `p` itself and
 * `p/<anything>`, so registering `'/dsh-custom-theme/'` would only ever match
 * `'/dsh-custom-theme//…'` and every real request would fall through.
 */
const ROUTE_PATH = '/dsh-custom-theme'

/** Seeded stylesheets live beside the package root, one level above this module. */
const SEED_ROOT = fileURLToPath(new URL('../themes/', import.meta.url))

export const name = 'dsh-custom-theme'

/**
 * Resolve the DSH home, honouring the environment override the runtime sets.
 * @returns The home directory whose `themes` directory this plugin owns.
 */
function dshHome() {
  const configured = process.env.DSH_HOME
  return typeof configured === 'string' && configured.trim() !== '' ? configured : join(homedir(), '.dsh')
}

/**
 * Copy each bundled stylesheet into the theme directory.
 *
 * Within one seed generation an existing file is left alone, so a user edit
 * survives every restart and a deletion is only repaired. When the generation
 * advances the bundled stylesheets are written again, because a fixed or extended
 * bundled palette has to reach a machine that already holds the older copy. Only
 * bundled ids are ever written; anything else in the directory is the user's.
 *
 * The theme directory is owned by this plugin, and `themes/*.css` documents that
 * a customised palette belongs in a copy under its own name rather than in an
 * edited bundled file.
 * @param directory - Theme directory, created when missing.
 * @returns Ids written by this call, for the startup log.
 */
async function seedThemes(directory) {
  await mkdir(directory, { recursive: true })
  const marker = join(directory, '.seed-version')
  let generation = null
  try {
    generation = Number.parseInt(await readFile(marker, 'utf8'), 10)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  // A missing marker is a directory this plugin has not seeded, so every bundled
  // file is written even if an unrelated file of the same name is already there.
  const stale = generation !== SEED_VERSION
  const seeded = []
  for (const id of BUNDLED_THEME_IDS) {
    const target = join(directory, `${id}.css`)
    if (!stale) {
      try {
        await readFile(target)
        continue
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }
    }
    await writeFile(target, await readFile(join(SEED_ROOT, `${id}.css`), 'utf8'), 'utf8')
    seeded.push(id)
  }
  if (generation !== SEED_VERSION) await writeFile(marker, String(SEED_VERSION), 'utf8')
  return seeded
}

/**
 * List the theme ids present in the directory.
 * @param directory - Theme directory.
 * @returns Ordered ids without the `.css` suffix.
 */
async function scanThemes(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const ids = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.css') && !entry.name.startsWith('.'))
    .map((entry) => entry.name.slice(0, -'.css'.length))
  return orderThemeIds(ids)
}

/**
 * Write one response. Handlers own the raw `ServerResponse`.
 * @param res - Response owned by this handler.
 * @param status - HTTP status code.
 * @param contentType - Response media type.
 * @param body - Response body as text or bytes; empty for error statuses.
 */
function send(res, status, contentType, body = '') {
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
function decodePath(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return undefined
  }
}

/**
 * List the background images present in the directory.
 * @param directory - Background directory.
 * @returns File names in alphabet order; an absent directory lists nothing.
 */
async function scanBackgrounds(directory) {
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
  return entries
    .filter((entry) => entry.isFile() && !entry.name.startsWith('.') && isBackgroundName(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))
}

/**
 * Read one background image under the file-name whitelist.
 * @param directory - Background directory.
 * @param name - Candidate file name from the request path.
 * @returns The image bytes, or `undefined` when no such image exists or it is oversized.
 */
async function readBackground(directory, name) {
  if (!isBackgroundName(name)) return undefined
  let bytes
  try {
    bytes = await readFile(join(directory, name))
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EISDIR') return undefined
    throw error
  }
  return bytes.length > MAX_BACKGROUND_BYTES ? undefined : bytes
}

/**
 * Read one theme stylesheet under the id whitelist.
 * @param directory - Theme directory.
 * @param id - Candidate theme id from the request path.
 * @returns Stylesheet text, or `undefined` when no such theme exists or it is oversized.
 */
async function readTheme(directory, id) {
  if (!isThemeId(id)) return undefined
  let text
  try {
    text = await readFile(join(directory, `${id}.css`), 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EISDIR') return undefined
    throw error
  }
  return Buffer.byteLength(text) > MAX_THEME_BYTES ? undefined : text
}

/**
 * Answer the listing, stylesheet and background routes. Every other path under
 * the prefix is a 404; the route is `prefix`, so this handler owns the whole
 * subtree.
 * @param req - Request from the application origin.
 * @param res - Response owned by this handler.
 * @param paths - `themes` and `backgrounds` directories, plus `ready`, which
 *   settles once the initial seeding pass finished, so a request that arrives
 *   during startup never scans a directory that does not exist yet.
 */
async function handleRoute(req, res, paths) {
  await paths.ready
  const url = new URL(req.url ?? '/', 'http://localhost')
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, 'text/plain; charset=utf-8', 'method not allowed')
    return
  }
  const rest = decodePath(url.pathname.slice(ROUTE_PATH.length + 1))
  if (rest === undefined) {
    send(res, 400, 'text/plain; charset=utf-8', 'malformed path')
    return
  }
  if (rest === 'themes') {
    const themes = (await scanThemes(paths.themes)).map((id) => ({ id, bundled: isBundledThemeId(id) }))
    send(res, 200, 'application/json; charset=utf-8', JSON.stringify({ themes, dir: paths.themes }))
    return
  }
  if (rest === 'backgrounds') {
    const names = await scanBackgrounds(paths.backgrounds)
    const backgrounds = names.map((name) => ({ name, url: `${ROUTE_PATH}/background/${encodeURIComponent(name)}` }))
    send(res, 200, 'application/json; charset=utf-8', JSON.stringify({ backgrounds, dir: paths.backgrounds }))
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

/**
 * Seed the theme directory and expose both directories over the Web Host.
 *
 * The route is registered through `ctx.inject` so a profile without
 * `dsh-host-webserver` still seeds the theme directory instead of failing to
 * load.
 * @param ctx - Host Cordis context of this row.
 * @param config - Row configuration; `themesDir` and `backgroundsDir` override
 *   the default locations.
 */
export function apply(ctx, config) {
  const themes = themesDirectory(config, dshHome())
  const backgrounds = backgroundsDirectory(config, dshHome())
  ctx.logger.info('dsh-custom-theme: themes directory %s', themes)
  ctx.logger.info('dsh-custom-theme: backgrounds directory %s', backgrounds)
  const ready = Promise.all([
    seedThemes(themes).then((ids) => {
      if (ids.length > 0) ctx.logger.info('dsh-custom-theme: seeded %s', ids.join(', '))
    }),
    // The background directory holds only user-supplied images, so it is created
    // but never seeded; the card lists it as empty until something is dropped in.
    mkdir(backgrounds, { recursive: true }),
  ]).then(() => {}, (error) => {
    ctx.logger.warn('dsh-custom-theme: preparing directories failed: %s', error.message)
  })

  ctx.inject(['webServer'], (child) => {
    child.effect(() => child.webServer.register({
      kind: 'prefix',
      path: ROUTE_PATH,
      handler: (req, res) => handleRoute(req, res, { themes, backgrounds, ready }).catch((error) => {
        child.logger.warn('dsh-custom-theme: %s failed: %s', req.url, error.message)
        if (!res.headersSent) send(res, 500, 'text/plain; charset=utf-8', 'theme read failed')
      }),
    }), 'dsh-custom-theme: route')
    child.logger.info('dsh-custom-theme: serving %s', ROUTE_PATH)
  })
}
