/**
 * heatmap/row.cjs — the two controls the settings page gives the panel.
 *
 * The row switch is still the feature's real on/off: this card changes what the
 * panel draws once the row is mounted, not whether the row itself is loaded.
 */
const { h } = require('../shared/element.cjs')

const RANGE_OPTIONS = [
  { id: 'all', labelKey: 'heatmapRangeAll' },
  { id: '30d', labelKey: 'heatmapRange30' },
  { id: '7d', labelKey: 'heatmapRange7' },
]

function HeatmapRow(props) {
  const { t, value, apply } = props
  return h('div', { className: 'dct-heatmap-settings' },
    h('div', { className: 'dct-row dct-sub' },
      h('div', { className: 'dct-text' },
        h('div', { className: 'dct-title' }, t('heatmapEnable')),
        h('div', { className: 'dct-hint' }, t('heatmapEnableHint'))),
      h('div', { className: 'dct-control' },
        h('label', { className: 'dct-toggle' },
          h('input', {
            type: 'checkbox',
            checked: value.enabled,
            'aria-label': t('heatmapEnable'),
            onChange: (event) => apply({ enabled: event.target.checked }),
          }),
          h('span', null, value.enabled ? t('heatmapOn') : t('heatmapOff'))))),
    h('div', { className: 'dct-row dct-sub' },
      h('div', { className: 'dct-text' },
        h('div', { className: 'dct-title' }, t('heatmapRange')),
        h('div', { className: 'dct-hint' }, t('heatmapRangeHint'))),
      h('div', { className: 'dct-control' },
        h('select', {
          className: 'dct-select',
          value: value.range,
          'aria-label': t('heatmapRange'),
          onChange: (event) => apply({ range: event.target.value }),
        }, RANGE_OPTIONS.map((option) => h('option', { key: option.id, value: option.id }, t(option.labelKey)))))),
    h('div', { className: 'dct-note' }, t('heatmapDataNote')))
}

module.exports = { HeatmapRow }
