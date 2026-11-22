/**
 * pet/row.cjs — the companion's controls on the settings page.
 */
const { h } = require('../shared/element.cjs')
const React = require('react')
const { OFFSET_MIN, OFFSET_MAX } = require('./constants.cjs')
const store = require('./store.cjs')

/**
 * @param props - `t` from the settings page.
 * @returns The two rows: whether the companion is drawn, and where it stands.
 */
function PetRow(props) {
  const { t } = props
  const [config, setConfig] = React.useState(() => store.read())
  React.useEffect(() => store.subscribe(setConfig), [])
  return h('div', { className: 'dct-pet-settings' },
    h('div', { className: 'dct-row dct-sub' },
      h('div', { className: 'dct-text' },
        h('div', { className: 'dct-title' }, t('petEnable')),
        h('div', { className: 'dct-hint' }, t('petEnableHint'))),
      h('div', { className: 'dct-control' },
        h('label', { className: 'dct-toggle' },
          h('input', {
            type: 'checkbox',
            checked: config.enabled,
            'aria-label': t('petEnable'),
            onChange: (event) => store.write({ enabled: event.target.checked }),
          }),
          h('span', null, config.enabled ? t('petOn') : t('petOff'))))),
    h('div', { className: 'dct-row dct-sub' },
      h('div', { className: 'dct-text' },
        h('div', { className: 'dct-title' }, t('petOffset')),
        h('div', { className: 'dct-hint' }, t('petOffsetHint'))),
      h('div', { className: 'dct-control dct-pet-anchor' },
        h('input', {
          type: 'range',
          min: OFFSET_MIN,
          max: OFFSET_MAX,
          step: 1,
          value: config.offset,
          disabled: !config.enabled,
          'aria-label': t('petOffset'),
          onChange: (event) => store.write({ offset: Number(event.target.value) }),
        }),
        h('span', { className: 'dct-pet-anchor-value' }, config.offset + '%'))))
}

module.exports = { PetRow }
