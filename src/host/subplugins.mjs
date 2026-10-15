/**
 * subplugins.mjs — registry of active/mounted sub-plugin fibers.
 *
 * Each sub-plugin row registers itself when its Cordis fiber mounts and unregisters
 * on disposal. This lets the host route report mounted sub-plugins to the client.
 */

const activeSubplugins = new Set(['custom-theme'])

/**
 * Mark a sub-plugin as active during its fiber lifetime.
 * @param {string} id - Sub-plugin row ID.
 * @returns {() => void} Cleanup function to call on fiber disposal.
 */
export function markSubpluginActive(id) {
  activeSubplugins.add(id)
  return () => {
    activeSubplugins.delete(id)
  }
}

/**
 * Check if a sub-plugin is currently active.
 * @param {string} id - Sub-plugin row ID.
 * @returns {boolean}
 */
export function isSubpluginActive(id) {
  return activeSubplugins.has(id)
}

/**
 * Get the list of all currently active sub-plugins.
 * @returns {string[]}
 */
export function getActiveSubplugins() {
  return Array.from(activeSubplugins)
}
