/**
 * pet/store.cjs — the companion's choices, shared by the perch and the settings row.
 *
 * The settings page and the page's own seat are different trees; a module-level
 * listener set lets a change in one reach the other without a store service.
 */
const { readPetConfig, writePetConfig } = require('./constants.cjs')

let config = null
const listeners = new Set()

/** The choices in force, read from storage on first use. */
function read() {
  if (config === null) config = readPetConfig()
  return config
}

/** Change one field, persist, and tell whoever is drawing the companion. */
function write(patch) {
  config = { ...read(), ...patch }
  writePetConfig(config)
  for (const listener of listeners) listener(config)
}

/** @returns An unsubscribe function. */
function subscribe(listener) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

module.exports = { read, write, subscribe }
