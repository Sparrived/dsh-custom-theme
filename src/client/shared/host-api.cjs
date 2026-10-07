/**
 * shared/host-api.cjs — the three calls into the Host half's route.
 */
const { BACKGROUNDS_URL, LIST_URL } = require('./endpoints.cjs')

/**
 * Fetch the theme ids the Host half found in the theme directory.
 * @param signal - Cancels the listing when the plugin is torn down.
 * @returns Theme ids.
 */
async function listThemes(signal) {
  const response = await fetch(LIST_URL, { signal, cache: 'no-store' })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const payload = await response.json()
  return Array.isArray(payload?.themes)
    ? payload.themes.map((theme) => theme.id).filter((id) => typeof id === 'string')
    : []
}
/**
 * Names of the images the Host lists.
 * @param signal - Cancels the listing when the plugin is torn down.
 * @returns Image file names in the background directory.
 */
async function listBackgrounds(signal) {
  const response = await fetch(BACKGROUNDS_URL, { signal, cache: 'no-store' })
  if (!response.ok) throw new Error(`backgrounds listing failed: ${response.status}`)
  const payload = await response.json()
  return Array.isArray(payload.backgrounds) ? payload.backgrounds.map((entry) => entry.name) : []
}
/**
 * Hand one picture the user picked to the Host, which stores it in the background
 * directory beside the images dropped in by hand.
 *
 * The bytes go up as the body and the reported name as a query parameter: the Host
 * decides the stored name from the bytes and its own directory, so a name it cannot
 * serve is folded rather than refused.
 * @param file - The file the picker produced.
 * @returns The name the Host stored it under.
 */
async function uploadBackground(file) {
  const response = await fetch(`${BACKGROUNDS_URL}?name=${encodeURIComponent(file.name)}`, {
    method: 'POST',
    cache: 'no-store',
    body: file,
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    // The status travels with the failure because it is usually the whole diagnosis:
    // a Host that does not know this route answers 405 to it.
    const failure = new Error(payload.error ?? `background upload failed: ${response.status}`)
    failure.status = response.status
    throw failure
  }
  return payload.name
}

module.exports = { listThemes, listBackgrounds, uploadBackground }
