/**
 * update/rows.cjs — the update rows on the plugin manager's page, and the hint under them.
 */
const { PLUGIN_PACKAGE, applyUpdateNow, loadUpdate, useUpdate } = require('./client.cjs')
const { h } = require('../shared/element.cjs')

/**
 * The line of state text under the update controls.
 * @param snapshot - The shared snapshot.
 * @param t - Translate function for this plugin's namespace.
 * @returns One sentence describing what the Host reported.
 */
function updateText(snapshot, t) {
  const state = snapshot.state
  // A failure outranks the state text: the state still describes the release it
  // found, so repeating that here would hide why the upgrade did not happen.
  if (snapshot.phase === 'failed') return `${t('updateFailed')}: ${snapshot.reason}`
  if (state === null) return t('updateChecking')
  // A finished upgrade outranks everything else the state could say: the files
  // are in place, and only a restart is left.
  if (state.pendingRestart !== undefined && state.pendingRestart !== null) {
    return `${t('updateRestart')} (${state.pendingRestart})`
  }
  if (state.status === 'unavailable') return t('updateUnavailable')
  if (state.status !== 'ok') return `${t('updateFailed')}: ${state.reason ?? ''}`
  if (state.updateAvailable === true) return `${t('updateLatest')} ${state.latest}`
  return `${t('updateUpToDate')} (${state.current})`
}

function canUpgrade(snapshot) {
  const state = snapshot.state
  return state !== null
    && state.status === 'ok'
    && state.updateAvailable === true
    && (state.pendingRestart === undefined || state.pendingRestart === null)
}

/**
 * The update controls, rendered as a row on this card and as a section on the
 * plugin manager's page for this bundle.
 * @param props - `t`; `as`, the element and class the controls sit in; and
 *   `primary`, which drops the upgrade button where the page's own actions area
 *   already carries it, so the same button is never drawn twice on one page.
 */
function UpdateRow({ t, as = 'row', primary = true }) {
  const snapshot = useUpdate()
  const busy = snapshot.phase === 'loading' || snapshot.phase === 'applying'
  const controls = [
    primary && canUpgrade(snapshot) ? h('button', {
      key: 'upgrade',
      type: 'button',
      className: 'dct-button dct-upgrade',
      disabled: busy,
      onClick: () => { applyUpdateNow() },
    }, snapshot.phase === 'applying' ? t('updateUpgrading') : `${t('updateUpgrade')} ${snapshot.state.latest}`) : null,
    h('button', {
      key: 'check',
      type: 'button',
      className: 'dct-button dct-check-update',
      disabled: busy,
      onClick: () => { loadUpdate({ force: true }) },
    }, snapshot.phase === 'loading' ? t('updateChecking') : t('updateCheck')),
  ]
  const body = [
    h('div', { key: 'text', className: 'dct-text' },
      h('div', { className: 'dct-title' }, t('updateTitle')),
      h('div', { className: 'dct-hint' }, updateText(snapshot, t))),
    h('div', { key: 'control', className: 'dct-control' }, controls),
  ]
  return as === 'section'
    ? h('section', { className: 'dct-update-section' }, body)
    : h('div', { className: 'dct-row dct-update-row' }, body)
}

/** Whether a detail-page subject is this plugin's own bundle. */
function isOwnBundle(subject) {
  return subject !== null && subject !== undefined
    && subject.kind === 'bundle'
    && subject.pkg !== undefined
    && subject.pkg.name === PLUGIN_PACKAGE
}

/**
 * The badge beside the plugin's title, drawn only when a newer release exists.
 * Every other subject renders nothing, which is what the slot expects.
 */
function PluginUpdateBadge({ subject, t }) {
  const snapshot = useUpdate()
  if (!isOwnBundle(subject)) return null
  if (!canUpgrade(snapshot)) return null
  return h('span', { className: 'dct-update-badge' }, `${t('updateBadge')} ${snapshot.state.latest}`)
}

/**
 * The upgrade button in the plugin page's own actions area, beside its enable
 * switch and uninstall. Drawn only for this bundle and only when a newer release
 * exists, so every other plugin's page is left exactly as the shell built it.
 */
function PluginUpdateAction({ subject, t }) {
  const snapshot = useUpdate()
  if (!isOwnBundle(subject)) return null
  if (!canUpgrade(snapshot)) return null
  const busy = snapshot.phase === 'loading' || snapshot.phase === 'applying'
  return h('button', {
    type: 'button',
    className: 'dct-button dct-upgrade',
    disabled: busy,
    onClick: () => { applyUpdateNow() },
  }, snapshot.phase === 'applying' ? t('updateUpgrading') : `${t('updateUpgrade')} ${snapshot.state.latest}`)
}

/** The update section under the plugin page's own content. */
function PluginUpdateSection({ subject, t }) {
  if (!isOwnBundle(subject)) return null
  return h(UpdateRow, { t, as: 'section', primary: false })
}

module.exports = { updateText, canUpgrade, UpdateRow, isOwnBundle, PluginUpdateBadge, PluginUpdateAction, PluginUpdateSection }
