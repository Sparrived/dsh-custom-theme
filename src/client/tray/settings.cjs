const React = require('react')
const { h } = require('../shared/element.cjs')

/** The switch is a Host setting because the Host is what patches the tray at startup. */
function TrayRow({ t, controller }) {
  const state = React.useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  React.useEffect(() => { controller.refresh() }, [controller])
  const status = !state.desktop
    ? 'trayUnavailable'
    : state.active
      ? 'trayConnected'
      : state.enabled
        ? 'trayWaiting'
        : 'trayDisabled'
  return h('section', { className: 'dct-card', 'data-card': 'desktop-tray' },
    h('div', { className: 'dct-card-header' },
      h('div', { className: 'dct-card-title' }, t('trayTitle')),
      h('div', { className: 'dct-card-desc' }, t('trayDescription'))),
    h('div', { className: 'dct-card-body' },
      h('label', { className: 'dct-field' },
        h('input', {
          type: 'checkbox',
          checked: state.enabled,
          disabled: state.loading || !state.desktop,
          onChange: (event) => controller.setEnabled(event.target.checked),
        }),
        ' ', t('trayEnable')),
      h('p', { role: 'status' }, state.loading ? t('trayChecking') : t(status)),
      h('p', null, t('trayRisk')),
      state.error ? h('p', { className: 'dct-error', role: 'alert' }, state.error) : null))
}

module.exports = { TrayRow }
