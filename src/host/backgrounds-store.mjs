/**
 * The background-image directory: listing it, reading one image out of it, and
 * storing an upload in it.
 *
 * A picture is only ever addressed by a file name the whitelist accepts, and only
 * ever written under a name no existing picture uses, so a request cannot reach
 * outside the directory and an upload cannot overwrite what is already there.
 * Nothing here trusts the uploaded file's own name or type.
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import {
  MAX_BACKGROUND_BYTES,
  backgroundNameFrom,
  isBackgroundName,
  sniffImageMediaType,
  uniqueBackgroundName,
} from '../themes.mjs'
import { backgroundUrl } from './urls.mjs'

/**
 * List the background images present in the directory.
 * @param directory - Background directory.
 * @returns File names in alphabet order; an absent directory lists nothing.
 */
export async function scanBackgrounds(directory) {
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
export async function readBackground(directory, name) {
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
 * The background listing the read route and an upload both answer with.
 * @param directory - Background directory.
 * @returns `{ backgrounds, dir }`, one served url per image.
 */
export async function backgroundListing(directory) {
  const names = await scanBackgrounds(directory)
  return {
    backgrounds: names.map((name) => ({ name, url: backgroundUrl(name) })),
    dir: directory,
  }
}

/**
 * Store one uploaded picture: read the body under the size cap, identify it from its own
 * bytes, then write it under a name no existing picture uses.
 *
 * The bytes are what lands in the directory, so a picture picked from the file dialog is
 * the same kind of citizen as one dropped in by hand: every zone can select it, and it
 * outlives the browser that uploaded it.
 * @param req - Request carrying the image bytes as its body.
 * @param url - Parsed request URL; its `name` parameter carries the browser file name.
 * @param directory - Background directory.
 * @returns `{ status, body }`; a success body carries the stored name and the new listing.
 */
export async function receiveBackground(req, url, directory) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BACKGROUND_BYTES) {
      // Stop reading rather than buffer the rest of a body this large.
      req.destroy()
      return { status: 413, body: { error: `the picture is larger than ${MAX_BACKGROUND_BYTES} bytes` } }
    }
    chunks.push(chunk)
  }
  if (size === 0) return { status: 400, body: { error: 'the request carried no picture' } }

  const bytes = Buffer.concat(chunks)
  const mediaType = sniffImageMediaType(bytes)
  if (mediaType === undefined) {
    return { status: 415, body: { error: 'the bytes are no png, jpeg, gif, webp, avif or bmp picture' } }
  }

  const desired = backgroundNameFrom(url.searchParams.get('name'), mediaType)
  const taken = await scanBackgrounds(directory)
  let name = desired
  if (taken.includes(desired)) {
    // Picking the same file twice should not pile up copies, but a different picture
    // that happens to share a name must not overwrite the one already there.
    const existing = await readFile(join(directory, desired)).catch(() => undefined)
    if (existing !== undefined && existing.equals(bytes)) {
      return { status: 200, body: { name: desired, ...await backgroundListing(directory) } }
    }
    name = uniqueBackgroundName(desired, taken)
    if (name === undefined) return { status: 409, body: { error: `no free name is left beside ${desired}` } }
  }

  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, name), bytes)
  return { status: 200, body: { name, ...await backgroundListing(directory) } }
}
