/**
 * heatmap/view.cjs — the card that sits between the greeting and the composer.
 *
 * It draws its frame from the list snapshot even before the projections land:
 * the stat cells and the heat grid keep their geometry, and only their values
 * change when the local list answers, so the hero never jumps under the caret.
 */
const React = require('react')
const { h } = require('../shared/element.cjs')
const { HEATMAP_WEEKS, buildHeatmap, compactTokens, formatCount, formatDay, formatHour } = require('./model.cjs')
const { readSavedHeatmap, subscribeHeatmap, writeSavedHeatmap } = require('./store.cjs')

const RANGES = [
  { id: 'all', labelKey: 'heatmapRangeAll' },
  { id: '30d', labelKey: 'heatmapRange30' },
  { id: '7d', labelKey: 'heatmapRange7' },
]

/** The shell switches `lang` on the document; the fallback follows it. */
function pageLocale() {
  return String(document.documentElement.lang || '').toLowerCase().startsWith('en') ? 'en' : 'zh'
}

/** Settings written by either seat wake this component. */
function useHeatmapSettings() {
  const [settings, setSettings] = React.useState(readSavedHeatmap)
  React.useEffect(() => subscribeHeatmap(() => setSettings(readSavedHeatmap())), [])
  return settings
}

/** The shell only draws the hero card while this marker is present. */
function readHeroPhase() {
  return typeof document === 'object' && document !== null
    ? document.querySelector('[data-content-phase="hero"]') !== null
    : false
}

/**
 * Follow the shell's page phase without subscribing to its session store while
 * a conversation is open. The dock seat stays mounted there, so a hidden card
 * must not keep rebuilding 182 cells on every streamed token.
 */
function useHeroPhase() {
  const [hero, setHero] = React.useState(readHeroPhase)
  React.useEffect(() => {
    let current = readHeroPhase()
    setHero(current)
    const observer = new MutationObserver(() => {
      const next = readHeroPhase()
      if (next === current) return
      current = next
      setHero(next)
    })
    observer.observe(document.documentElement, {
      attributes: true,
      subtree: true,
      attributeFilter: ['data-content-phase'],
    })
    return () => observer.disconnect()
  }, [])
  return hero
}

/**
 * One subscription to the shell's list store, throttled to a readable cadence:
 * the store publishes on animation frames while an answer streams, and the card
 * only needs a few updates per second. The timer is cleared on teardown so a
 * hidden or disposed card leaves no work behind.
 */
const SNAPSHOT_THROTTLE_MS = 400

function useListSnapshot(list) {
  const [snapshot, setSnapshot] = React.useState(() => (typeof list?.getSnapshot === 'function' ? list.getSnapshot() : null))
  React.useEffect(() => {
    if (list === null || typeof list?.subscribe !== 'function' || typeof list?.getSnapshot !== 'function') return undefined
    let timer = null
    let hasPending = false
    let first = true
    let stopped = false
    const publish = () => {
      timer = null
      if (stopped || !hasPending) return
      hasPending = false
      setSnapshot(list.getSnapshot())
    }
    const update = () => {
      hasPending = true
      if (first) {
        first = false
        publish()
        return
      }
      if (timer !== null) return
      timer = setTimeout(publish, SNAPSHOT_THROTTLE_MS)
    }
    update()
    const unsubscribe = list.subscribe(update)
    return () => {
      stopped = true
      if (timer !== null) clearTimeout(timer)
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [list])
  return snapshot
}

/** The slot entry factory: one closure over the scope that carries `sessions`. */
function createHeatmapView(scope, fallbackT) {
  return function HeatmapView(props) {
    const t = typeof props.t === 'function' ? props.t : fallbackT
    const settings = useHeatmapSettings()
    const hero = useHeroPhase()
    const list = hero && settings.enabled ? scope.sessions.list : null
    const snapshot = useListSnapshot(list)
    const data = React.useMemo(() => buildHeatmap(snapshot, settings.range), [snapshot, settings.range])
    const locale = pageLocale()
    if (!settings.enabled || !hero) return null

    const known = data.known
    const value = (text) => (known ? text : '—')
    const stat = (label, text, title) => h('div', { className: 'dct-heatmap-stat' },
      h('div', { className: 'dct-heatmap-stat-label' }, label),
      h('div', { className: 'dct-heatmap-stat-value', title: title ?? text }, text))

    const rangeButtons = RANGES.map((range) => h('button', {
      key: range.id,
      type: 'button',
      className: 'dct-heatmap-range',
      'data-active': settings.range === range.id ? '' : undefined,
      'aria-pressed': settings.range === range.id,
      onClick: () => writeSavedHeatmap({ ...settings, range: range.id }),
    }, t(range.labelKey)))

    return h('section', {
      className: 'dct-heatmap-card',
      'data-dct-heatmap': '',
      'data-loading': known ? undefined : '',
      'aria-busy': known ? 'false' : 'true',
    },
      h('div', { className: 'dct-heatmap-head' },
        h('span', { className: 'dct-heatmap-title' }, t('heatmapTitle')),
        h('div', { className: 'dct-heatmap-ranges', role: 'group', 'aria-label': t('heatmapRange') }, rangeButtons)),
      h('div', { className: 'dct-heatmap-stats' },
        stat(t('heatmapSessions'), value(formatCount(data.sessions))),
        stat(t('heatmapTokens'), value(compactTokens(data.tokens))),
        stat(t('heatmapActiveDays'), value(formatCount(data.activeDays))),
        stat(t('heatmapPeakHour'), value(formatHour(data.peakHour, locale))),
        stat(t('heatmapDaily'), value(compactTokens(data.daily))),
        stat(t('heatmapTopModel'), value(data.model ?? '—'), data.model ?? undefined)),
      h('div', {
        className: 'dct-heatmap-grid',
        role: 'img',
        'aria-label': t('heatmapAria', { n: HEATMAP_WEEKS, days: data.grid.activeDays }),
      }, data.grid.cells.map((cell) => {
        const tip = t('heatmapTip', { date: formatDay(cell.date, locale), tokens: compactTokens(cell.tokens) })
        return h('span', {
          key: cell.date,
          className: 'dct-heatmap-cell',
          'data-level': cell.level,
          'data-tip': tip,
          'aria-hidden': 'true',
        })
      })),
      h('div', { className: 'dct-heatmap-foot' },
        h('span', null, known
          ? (data.total === 0
              ? t('heatmapEmpty')
              : `${t('heatmapWeeks', { n: HEATMAP_WEEKS })} · ${t('heatmapActiveCaption', { n: data.grid.activeDays })}`)
          : t('heatmapLoading')),
        h('span', null, t('heatmapFootnote'))))
  }
}

module.exports = { createHeatmapView }
