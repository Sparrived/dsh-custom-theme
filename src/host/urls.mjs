/**
 * The URL layout of this plugin's Host half.
 *
 * It lives in one module because two sides have to agree on it: the route matches
 * the paths, and every listing hands the browser half `url` values that it fetches
 * verbatim. A listing that built those differently from the way the route matches
 * them would serve 404s for pictures that are on disk.
 */

/**
 * Prefix route owned by this plugin. `dsh-client-ui-theme` and the SPA dist use
 * other paths.
 *
 * No trailing slash: the webserver matches a prefix `p` against `p` itself and
 * `p/<anything>`, so registering `'/dsh-custom-theme/'` would only ever match
 * `'/dsh-custom-theme//…'` and every real request would fall through.
 */
export const ROUTE_PATH = '/dsh-custom-theme'

/**
 * Where one stored picture is served from.
 * @param name - The stored file name.
 * @returns The url a listing hands the browser half.
 */
export function backgroundUrl(name) {
  return `${ROUTE_PATH}/background/${encodeURIComponent(name)}`
}
