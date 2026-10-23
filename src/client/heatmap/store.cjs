/**
 * heatmap/store.cjs — the two choices the heatmap panel keeps.
 *
 * The panel and its settings card are two seats in the same page, so they read
 * and write one module-local store instead of passing values through the shell.
 * A write notifies both seats; the panel re-renders without a reload.
 */
const { normalizeRange } = require('./model.cjs')

const HEATMAP_KEY = 'dsh-custom-theme.heatmap'

let current = null

/** Keep only the fields and values this version understands. */
function normalizeHeatmap(value) {
  const source = value !== null && typeof value === 'object' ? value : {}
  return {
    enabled: source.enabled !== false,
    range: normalizeRange(source.range),
  }
}

/** Read the saved choices once, then serve the shared copy. */
function readSavedHeatmap() {
  if (current !== null) return current
  let parsed = null
  try {
    parsed = JSON.parse(localStorage.getItem(HEATMAP_KEY) ?? 'null')
  } catch {
    parsed = null
  }
  current = normalizeHeatmap(parsed)
  return current
}

/** Persist one whole choice object and wake every seat. */
function writeSavedHeatmap(next) {
  current = normalizeHeatmap(next)
  try {
    localStorage.setItem(HEATMAP_KEY, JSON.stringify(current))
  } catch {
    // A locked-down browser still gets the in-memory choice for this page.
  }
  for (const listener of listeners) listener()
  return current
}

const listeners = new Set()

/** Observe changes made by either seat. */
function subscribeHeatmap(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

module.exports = {
  HEATMAP_KEY,
  normalizeHeatmap,
  readSavedHeatmap,
  subscribeHeatmap,
  writeSavedHeatmap,
}
