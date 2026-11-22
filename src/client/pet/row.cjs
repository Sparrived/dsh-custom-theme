/**
 * pet/row.cjs — the companion's switch on the settings page.
 */
const { h } = require('../shared/element.cjs')
const React = require('react')
const store = require('./store.cjs')

/**
 * @param props - `t` from the settings page.
 * @returns One row: what the companion is, and whether it is drawn.
 */
function PetRow(props) {
  const { t } = props
  const [enabled, setEnabled] = React.useState(() => store.read())
  React.useEffect(() => store.subscribe(setEnabled), [])
  return h('div', { className: 'dct-row dct-sub' },
    h('div', { className: 'dct-text' },
      h('div', { className: 'dct-title' }, t('petEnable')),
      h('div', { className: 'dct-hint' }, t('petEnableHint'))),
    h('div', { className: 'dct-control' },
      h('label', { className: 'dct-toggle' },
        h('input', {
          type: 'checkbox',
          checked: enabled,
          'aria-label': t('petEnable'),
          onChange: (event) => store.write(event.target.checked),
        }),
        h('span', null, enabled ? t('petOn') : t('petOff')))))
}

module.exports = { PetRow }
