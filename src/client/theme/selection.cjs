/**
 * theme/selection.cjs — the selected theme id and its accent, as remembered
 * between sessions.
 */
const { STORAGE_KEY, STORAGE_KEY_ACCENT } = require('../shared/keys.cjs')

/** Read the persisted selection; an unreadable store means no selection. */
function readSaved() {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return typeof value === 'string' ? value : ''
  } catch {
    return ''
  }
}

/** Persist the selection; an unwritable store leaves the in-memory choice only. */
function writeSaved(id) {
  try {
    if (id === '') window.localStorage.removeItem(STORAGE_KEY)
    else window.localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // A blocked storage backend is a supported state for this row.
  }
}

/** Read the accent colour laid over the theme; empty means the theme's own. */
function readAccent() {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY_ACCENT)
    return typeof value === 'string' ? value : ''
  } catch {
    return ''
  }
}

/** Persist the accent; an unwritable store leaves the in-memory choice only. */
function writeAccent(value) {
  try {
    if (value === '') window.localStorage.removeItem(STORAGE_KEY_ACCENT)
    else window.localStorage.setItem(STORAGE_KEY_ACCENT, value)
  } catch {
    // A blocked storage backend is a supported state for this row.
  }
}

module.exports = { readSaved, writeSaved, readAccent, writeAccent }
