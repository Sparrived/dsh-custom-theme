// Pure theme-directory model: id validation, picker ordering, directory
// resolution. No filesystem and no Cordis, so `node --test` drives it directly.

import { join } from 'node:path'

/** Distinct bundle themes, in picker order. Mirrors the ids of `themes/*.css`. */
export const BUNDLED_THEME_IDS = ['gov', 'monokai-pro', 'one-dark']

/**
 * Seed generation.
 *
 * Bumping it re-syncs the bundled stylesheets on the next start, because a
 * corrected or extended bundled palette has to reach a machine that already has
 * the older copy. Files whose id is not bundled are never touched, and
 * `themes/*.css` is documented as managed so a customised palette belongs in a
 * copy under its own name.
 */
export const SEED_VERSION = 2

/** Refuse to serve or read a stylesheet larger than this; a theme is a few KiB. */
export const MAX_THEME_BYTES = 1024 * 1024

/**
 * Theme ids that may reach the filesystem. Must start alphanumeric, so a name
 * can never be `.`, `..`, or a dotfile, and contains no separator.
 */
const THEME_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u

/**
 * Whether a request-supplied id may be turned into a path.
 * @param value - Candidate id from a request path or a directory entry.
 * @returns True when the id is safe to join under the theme directory.
 */
export function isThemeId(value) {
  return typeof value === 'string' && THEME_ID.test(value)
}

/**
 * Resolve the theme directory: an explicit `themesDir` config value wins, then
 * `<home>/themes`.
 * @param config - Row configuration from the profile patch; every field is optional.
 * @param home - The DSH home directory, resolved by the caller.
 * @returns Theme directory path.
 */
export function themesDirectory(config, home) {
  if (typeof config?.themesDir === 'string' && config.themesDir.trim() !== '') return config.themesDir
  return join(home, 'themes')
}

/**
 * Order the ids found in the theme directory: bundled ids first in their fixed
 * order, then every other id in alphabet order.
 * @param ids - Ids present in the directory, in any order and possibly with duplicates.
 * @returns Ordered, de-duplicated ids.
 */
export function orderThemeIds(ids) {
  const unique = [...new Set(ids)].filter(isThemeId)
  const bundled = BUNDLED_THEME_IDS.filter((id) => unique.includes(id))
  const extra = unique
    .filter((id) => !BUNDLED_THEME_IDS.includes(id))
    .sort((left, right) => left.localeCompare(right))
  return [...bundled, ...extra]
}

/**
 * Whether an id is one of the themes this package seeds.
 * @param id - Candidate id.
 * @returns True for a bundled id.
 */
export function isBundledThemeId(id) {
  return BUNDLED_THEME_IDS.includes(id)
}

/** Background image extensions this plugin serves, with their media types. */
const BACKGROUND_TYPES = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.avif', 'image/avif'],
  ['.bmp', 'image/bmp'],
])

/** Refuse to serve an image larger than this. */
export const MAX_BACKGROUND_BYTES = 16 * 1024 * 1024

/**
 * Whether a request-supplied name may be turned into a path under the
 * background directory: a valid id plus one served image extension.
 * @param value - Candidate file name from a request path or a directory entry.
 * @returns True when the name is safe to join under the background directory.
 */
export function isBackgroundName(value) {
  if (typeof value !== 'string') return false
  const dot = value.lastIndexOf('.')
  if (dot <= 0) return false
  return isThemeId(value.slice(0, dot)) && BACKGROUND_TYPES.has(value.slice(dot).toLowerCase())
}

/**
 * Media type for a background file name.
 * @param name - File name already accepted by {@link isBackgroundName}.
 * @returns The media type; `application/octet-stream` when the extension is unknown.
 */
export function backgroundContentType(name) {
  return BACKGROUND_TYPES.get(name.slice(name.lastIndexOf('.')).toLowerCase()) ?? 'application/octet-stream'
}

/**
 * Resolve the background directory: an explicit `backgroundsDir` config value
 * wins, then `<home>/backgrounds`. Nothing is seeded here; the directory only
 * holds images the user put there.
 * @param config - Row configuration from the profile patch; every field is optional.
 * @param home - The DSH home directory, resolved by the caller.
 * @returns Background directory path.
 */
export function backgroundsDirectory(config, home) {
  if (typeof config?.backgroundsDir === 'string' && config.backgroundsDir.trim() !== '') return config.backgroundsDir
  return join(home, 'backgrounds')
}
