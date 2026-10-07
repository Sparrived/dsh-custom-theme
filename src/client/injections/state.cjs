/**
 * injections/state.cjs — the switch, the seam the shell exposes, and the bridge seat.
 */
const { INJECTIONS_KEY } = require('./constants.cjs')

/** Read the persisted injected-row choice; only `show: true` turns the rows on. */
function readSavedInjections() {
  try {
    const parsed = JSON.parse(localStorage.getItem(INJECTIONS_KEY) ?? '{}')
    return { show: parsed !== null && typeof parsed === 'object' && parsed.show === true }
  } catch {
    // A corrupt entry means the shipped behaviour: the shell's own filter decides.
    return { show: false }
  }
}

/** Persist the injected-row choice. The bridge beside it re-registers from the result. */
function writeSavedInjections(next) {
  try {
    localStorage.setItem(INJECTIONS_KEY, JSON.stringify({ show: next.show === true }))
  } catch {
    // A blocked storage backend is a supported state for this row, as for the others.
  }
}

let injectionSettings = readSavedInjections()
/** Set by `apply` once the conversation seam is available; null when it is not. */
let injectionBridge = null
/** Whether the shell exposed the Definition registry, for the settings row. */
let injectionSeam = 'unknown'

/** The choices in force, read live: the bridge consults them on every switch. */
function injectionSettingsOf() {
  return injectionSettings
}

/** How the injected rows reached the conversation: `unknown`, `ready`, or `absent`. */
function injectionSeamOf() {
  return injectionSeam
}

/**
 * Remember how the registration attempt went, so the settings row can say so.
 * @param value - `ready` when the registry took the Definition, `absent` when the
 * shell exposes no registry at all.
 */
function setInjectionSeam(value) {
  injectionSeam = value
}

/**
 * Point the settings row's switch at the registration it drives.
 * @param bridge - The bridge `apply` built, or null while there is none.
 */
function setInjectionBridge(bridge) {
  injectionBridge = bridge
}

/** Persist one injected-row choice and re-point the registered Definition. */
function setInjectionSettings(next) {
  writeSavedInjections(next)
  injectionSettings = readSavedInjections()
  if (injectionBridge !== null) injectionBridge.sync()
}

module.exports = {
  readSavedInjections,
  writeSavedInjections,
  setInjectionSettings,
  injectionSettingsOf,
  injectionSeamOf,
  setInjectionSeam,
  setInjectionBridge,
}
