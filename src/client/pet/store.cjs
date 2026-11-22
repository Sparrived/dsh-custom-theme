/**
 * pet/store.cjs — the companion's on/off choice, shared by the card and the settings row.
 *
 * The settings page and the dock seat are different React trees; a module-level
 * listener set is what lets a switch in one reach the other without a store service.
 */
const { readPetEnabled, writePetEnabled } = require('./constants.cjs')

let enabled = null
const listeners = new Set()

/** The choice in force, read from storage on first use. */
function read() {
  if (enabled === null) enabled = readPetEnabled()
  return enabled
}

/** Change the choice, persist it, and tell whoever is drawing it. */
function write(next) {
  enabled = next === true
  writePetEnabled(enabled)
  for (const listener of listeners) listener(enabled)
}

/** @returns An unsubscribe function. */
function subscribe(listener) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

module.exports = { read, write, subscribe }
