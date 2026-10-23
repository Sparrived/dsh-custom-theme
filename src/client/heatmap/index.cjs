/**
 * heatmap/index.cjs — the browser half of the independent heatmap row.
 *
 * The host row only says the feature is mounted. This module finds the shell's
 * session list and puts one card in the composer dock; the card only draws in
 * the hero phase, so the same dock seat is empty inside a session.
 */
const { LOCALE_NS } = require('../i18n/dictionary.cjs')
const { listSubplugins } = require('../shared/host-api.cjs')
const { HEATMAP_CSS } = require('./styles.cjs')
const { createHeatmapView } = require('./view.cjs')

const DOCK_SLOT = 'conversation.input.dock'
const HEATMAP_ENTRY_ID = 'dsh-custom-theme-heatmap'
const HEATMAP_ENTRY_ORDER = 35
const HEATMAP_ROW_ID = 'custom-theme-heatmap'

/**
 * @param {object} deps - The composition root's context and teardown signal.
 * @returns {{dispose: () => void}} Removes the sheet and the slot registration.
 */
function createHeatmap({ ctx, signal }) {
  const style = document.createElement('style')
  style.dataset.plugin = 'dsh-custom-theme'
  style.dataset.role = 'heatmap'
  style.textContent = HEATMAP_CSS

  const fallbackT = typeof ctx.locale?.bind === 'function'
    ? ctx.locale.bind(LOCALE_NS)
    : (key) => key
  let disposed = false
  let registration = null

  /** Wait for both the row switch and the shell seats before touching the page. */
  async function start() {
    const active = await listSubplugins(signal)
    if (disposed) return
    // A null answer means the route could not be read (an old Host); the row
    // being loaded is the only evidence available then, so the card is shown.
    if (Array.isArray(active) && !active.includes(HEATMAP_ROW_ID)) return
    if (typeof ctx.inject !== 'function') return
    ctx.inject(['slots', 'sessions'], (scope) => {
      if (disposed) return
      if (scope?.sessions?.list === undefined || typeof scope.slots?.inject !== 'function') return
      document.head.append(style)
      registration = scope.slots.inject(DOCK_SLOT, () => scope.slots.register({
        name: DOCK_SLOT,
        id: HEATMAP_ENTRY_ID,
        order: HEATMAP_ENTRY_ORDER,
        locale: LOCALE_NS,
      }, createHeatmapView(scope, fallbackT)))
    })
  }

  start().catch((error) => {
    ctx.logger?.warn?.('dsh-custom-theme: heatmap could not start: %s', error?.message ?? error)
  })

  return {
    dispose() {
      disposed = true
      if (typeof registration === 'function') registration()
      registration = null
      style.remove()
    },
  }
}

module.exports = createHeatmap
