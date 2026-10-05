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

/** The extension a stored upload of each accepted media type gets. */
const EXTENSION_BY_MEDIA_TYPE = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/gif', '.gif'],
  ['image/webp', '.webp'],
  ['image/avif', '.avif'],
  ['image/bmp', '.bmp'],
])

/**
 * The image formats this plugin accepts, each identified by its leading bytes.
 *
 * Both the declared content type and the file-name extension arrive from the browser
 * and neither is trustworthy, so an upload is stored under the format its own bytes
 * show rather than the one it claims.
 */
const IMAGE_SIGNATURES = [
  { mediaType: 'image/png', test: (bytes) => bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a },
  { mediaType: 'image/jpeg', test: (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  { mediaType: 'image/gif', test: (bytes) => bytes.length >= 6 && bytes.subarray(0, 4).toString('latin1') === 'GIF8' },
  { mediaType: 'image/webp', test: (bytes) => bytes.length >= 12 && bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP' },
  { mediaType: 'image/avif', test: (bytes) => bytes.length >= 12 && bytes.subarray(4, 8).toString('latin1') === 'ftyp' && ['avif', 'avis'].includes(bytes.subarray(8, 12).toString('latin1')) },
  { mediaType: 'image/bmp', test: (bytes) => bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d },
]

/**
 * Identify an uploaded image from its leading bytes.
 * @param bytes - The uploaded bytes.
 * @returns The media type, or `undefined` when the bytes are no format this plugin serves.
 */
export function sniffImageMediaType(bytes) {
  if (!Buffer.isBuffer(bytes)) return undefined
  for (const signature of IMAGE_SIGNATURES) {
    if (signature.test(bytes)) return signature.mediaType
  }
  return undefined
}

/**
 * Turn the file name a browser reported into one this plugin will serve.
 *
 * The background directory's whitelist is ASCII, and a stored file has to pass it to be
 * listed or served at all, so everything outside it is folded into dashes here rather
 * than refused — an upload the user asked for should not fail over its name. The
 * extension comes from the sniffed bytes, never from the request.
 * @param original - File name the browser reported, possibly as a full path.
 * @param mediaType - Media type accepted by {@link sniffImageMediaType}.
 * @returns A name accepted by {@link isBackgroundName}, or `undefined` for an unserved type.
 */
export function backgroundNameFrom(original, mediaType) {
  const extension = EXTENSION_BY_MEDIA_TYPE.get(mediaType)
  if (extension === undefined) return undefined
  // Some platforms report a full path, so only the last segment is a name.
  const base = String(original ?? '').split(/[\\/]/u).pop() ?? ''
  const stem = base
    .replace(/\.[^.]*$/u, '')
    .replace(/[^A-Za-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 48)
    // A name cut mid-separator would otherwise end on a dash.
    .replace(/-+$/gu, '')
  return `${stem === '' ? 'background' : stem}${extension}`
}

/**
 * Pick a name no existing entry uses, so an upload never overwrites a picture the user
 * already had in the directory.
 * @param name - Desired name, already accepted by {@link isBackgroundName}.
 * @param taken - Names already present in the directory.
 * @returns `name`, the same stem with the first free `-<n>` suffix, or `undefined` when none is free.
 */
export function uniqueBackgroundName(name, taken) {
  const used = new Set(taken)
  if (!used.has(name)) return name
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return undefined
  const stem = name.slice(0, dot)
  const extension = name.slice(dot)
  for (let index = 1; index < 1000; index += 1) {
    const candidate = `${stem}-${index}${extension}`
    if (!used.has(candidate)) return candidate
  }
  return undefined
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
