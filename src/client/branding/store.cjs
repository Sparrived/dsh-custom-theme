/**
 * branding/store.cjs — the wording, marks and stylesheets, as remembered between sessions.
 */
const { brandingIsDefault, normalizeBranding } = require('./constants.cjs')
const { STORAGE_KEY_BRANDING } = require('../shared/keys.cjs')

/** Read the stored choices; anything unreadable reads as the shipped state. */
function readSavedBranding() {
  try {
    return normalizeBranding(JSON.parse(window.localStorage.getItem(STORAGE_KEY_BRANDING) ?? 'null'))
  } catch {
    // A blocked or corrupt store means the shell's own surfaces, as for every other row.
    return normalizeBranding(null)
  }
}

/** Persist the choices; a set that asks for nothing removes the entry instead. */
function writeSavedBranding(settings) {
  const normalized = normalizeBranding(settings)
  try {
    if (brandingIsDefault(normalized)) window.localStorage.removeItem(STORAGE_KEY_BRANDING)
    else window.localStorage.setItem(STORAGE_KEY_BRANDING, JSON.stringify(normalized))
  } catch {
    // A blocked storage backend is a supported state for this row.
  }
}

module.exports = { readSavedBranding, writeSavedBranding }
