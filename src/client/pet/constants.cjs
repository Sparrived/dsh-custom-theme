/** Where the companion's on/off choice is remembered. */
const STORAGE_KEY_PET = 'dsh-custom-theme.pet'

/** How long to wait before looking for the input card again. */
const RETRY_MS = 250

/** How often to check that the companion is still on the page, once it is. */
const KEEPALIVE_MS = 500

/** One art pixel's size on screen, in CSS pixels. */
const PIXEL_SIZE = 3

/** Whether the companion is shown; a missing or unreadable value means "yes". */
function readPetEnabled() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_PET)
    if (raw === null) return true
    const parsed = JSON.parse(raw)
    return typeof parsed?.enabled === 'boolean' ? parsed.enabled : true
  } catch {
    return true
  }
}

/** Persist the choice; an unwritable store leaves the in-memory value only. */
function writePetEnabled(enabled) {
  try {
    window.localStorage.setItem(STORAGE_KEY_PET, JSON.stringify({ enabled }))
  } catch {
    // A blocked storage backend is a supported state.
  }
}

module.exports = { STORAGE_KEY_PET, RETRY_MS, KEEPALIVE_MS, PIXEL_SIZE, readPetEnabled, writePetEnabled }
