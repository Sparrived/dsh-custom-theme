/**
 * The theme directory: seeding the bundled stylesheets into it and reading one
 * back out.
 *
 * The directory is the plugin's own, and everything here treats it that way: only
 * bundled ids are ever written, and a read is bounded by the byte cap the theme
 * rules declare.
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { BUNDLED_THEME_IDS, MAX_THEME_BYTES, SEED_VERSION, isThemeId, orderThemeIds } from '../themes.mjs'

/** Seeded stylesheets live beside the package root, one level above this module. */
const SEED_ROOT = fileURLToPath(new URL('../../themes/', import.meta.url))

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
export async function seedThemes(directory) {
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
export async function scanThemes(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const ids = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.css') && !entry.name.startsWith('.'))
    .map((entry) => entry.name.slice(0, -'.css'.length))
  return orderThemeIds(ids)
}

/**
 * Read one theme stylesheet under the id whitelist.
 * @param directory - Theme directory.
 * @param id - Candidate theme id from the request path.
 * @returns Stylesheet text, or `undefined` when no such theme exists or it is oversized.
 */
export async function readTheme(directory, id) {
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
