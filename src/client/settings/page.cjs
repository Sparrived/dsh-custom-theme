/**
 * settings/page.cjs — the settings page: the pickers, the controls and the two switches.
 */
const { h } = require('../shared/element.cjs')
const { icon: svgIcon } = require('../shared/icons.cjs')
const React = require('react')

module.exports = function (deps) {
  const { UpdateRow, applyAppearance, applyBackgroundsWhenReady, applyBranding, applyTheme, ctx, effortLevelsRow, injectionSeamOf, listBackgrounds, listThemes, setInjectionSettings, setWorkingSettings, signal, themeChangeListeners, uploadBackground } = deps

  const { APPEARANCE_KEY, LINE_GAPS, STREAM_FADE_DURATION_MAX, STREAM_FADE_DURATION_MIN, STREAM_FADE_DURATION_STEP, STREAM_FADE_INK_MAX, STREAM_FADE_INK_MIN, readSavedAppearance } = require('../appearance/constants.cjs')
  const { readSavedBackgrounds, writeSavedBackgrounds } = require('../backgrounds/store.cjs')
  const { BLUR_MAX, BLUR_MIN, OPACITY_MAX, OPACITY_MIN, POSITIONS, ZONES, positionKey } = require('../backgrounds/zones.cjs')
  const { BrandingRow } = require('../branding/row.cjs')
  const { readSavedBranding } = require('../branding/store.cjs')
  const { readSavedEffortTheme, writeSavedEffortTheme } = require('../effort/constants.cjs')
  const { readSavedInjections } = require('../injections/state.cjs')
  const { HeatmapRow } = require('../heatmap/row.cjs')
  const { readSavedHeatmap, writeSavedHeatmap } = require('../heatmap/store.cjs')
  const { EFFORT_LEVELS_URL } = require('../shared/endpoints.cjs')
  const { TrayRow } = require('../tray/settings.cjs')
  const { readSaved, writeSaved } = require('../theme/selection.cjs')
  const { importFailureFor, importMessage } = require('../update/client.cjs')
  const { WORKING_EFFECTS, WORKING_EFFECT_LABELS, WORKING_INTERVALS, WORKING_SHIMMER_LABELS, WORKING_SHIMMER_STYLES, readSavedWorking } = require('../working/constants.cjs')

  /** Reasoning disclosure mode descriptions mapped to i18n keys. */
  const REASONING_DESCRIPTIONS = {
    streaming: 'reasoningDetailStreaming',
    keep: 'reasoningDetailKeep',
    always: 'reasoningDetailAlways',
    off: 'reasoningDetailOff',
  }

  /** Quick presets for streaming fade-in. */
  const FADE_PRESETS = [
    { id: 'default', labelKey: 'fadePresetDefault', tipKey: 'fadePresetDefaultTip', duration: 520, ink: 0.3 },
    { id: 'fast', labelKey: 'fadePresetFast', tipKey: 'fadePresetFastTip', duration: 250, ink: 0.5 },
    { id: 'soft', labelKey: 'fadePresetSoft', tipKey: 'fadePresetSoftTip', duration: 800, ink: 0.15 },
    { id: 'off', labelKey: 'fadePresetOff', tipKey: 'fadePresetOffTip', duration: 150, ink: 1.0 },
  ]

  /**
   * Card container: groups related settings into a cohesive card section.
   */
  function Card({ id, icon, title, desc, children }) {
    return h('section', { className: 'dct-card', 'data-card': id },
      h('div', { className: 'dct-card-header' },
        h('div', { className: 'dct-card-title' },
          icon ? h('span', { className: 'dct-card-icon', 'aria-hidden': true }, icon) : null,
          title),
        desc ? h('div', { className: 'dct-card-desc' }, desc) : null),
      h('div', { className: 'dct-card-body' }, children))
  }

  /**
   * Capsule / Segmented control:
   * Provides sleek pill-shaped toggle buttons for options with fixed choices.
   */
  function Capsule({ value, options, onChange, disabled = false, size = 'normal', ariaLabel }) {
    return h('div', {
      className: `dct-capsule-group${size === 'small' ? ' dct-capsule-sm' : ''}`,
      role: 'radiogroup',
      'aria-label': ariaLabel,
    }, options.map((opt) => {
      const isSelected = String(opt.value) === String(value)
      return h('button', {
        key: String(opt.value),
        type: 'button',
        className: `dct-capsule-btn${isSelected ? ' selected' : ''}`,
        role: 'radio',
        'aria-checked': isSelected,
        disabled: disabled || opt.disabled,
        title: opt.title || opt.label,
        onClick: () => {
          if (!isSelected && !disabled && !opt.disabled) onChange(opt.value)
        },
      },
      opt.icon ? h('span', { className: 'dct-capsule-icon', 'aria-hidden': true }, opt.icon) : null,
      h('span', { className: 'dct-capsule-text' }, opt.label))
    }))
  }

  /**
   * Interactive slider with linked number input and unit readout.
   */
  function SliderControl({ value, min, max, step = 1, unit = '', onChange, title, disabled = false, inputClass = '' }) {
    return h('div', { className: 'dct-slider-control' },
      h('input', {
        type: 'range',
        className: 'dct-slider',
        min,
        max,
        step,
        value,
        disabled,
        'aria-label': title,
        onChange: (event) => onChange(Number(event.target.value)),
      }),
      h('div', { className: 'dct-slider-input-wrap' },
        h('input', {
          type: 'number',
          className: `dct-number ${inputClass}`.trim(),
          min,
          max,
          step,
          value,
          disabled,
          title,
          'aria-label': title,
          onChange: (event) => {
            const val = Number(event.target.value)
            if (Number.isFinite(val)) onChange(Math.min(max, Math.max(min, Math.round(val))))
          },
        }),
        unit ? h('span', { className: 'dct-unit' }, unit) : null))
  }

function ThemeRow(props) {
  const t = typeof props?.t === 'function' ? props.t : (ctx?.locale?.bind?.(deps.LOCALE_NS || 'dshCustomTheme') || ((k) => k))
  const [themes, setThemes] = React.useState([])
  const [selected, setSelected] = React.useState(readSaved)
  const [status, setStatus] = React.useState('idle')
  const [images, setImages] = React.useState([])
  const [backgrounds, setBackgrounds] = React.useState(readSavedBackgrounds)
  const [zone, setZone] = React.useState('global')
  const [importing, setImporting] = React.useState(false)
  const [importFailure, setImportFailure] = React.useState(null)
  const [preference, setPreference] = React.useState(() => ctx.theme.getTheme().preference)
  const [appearance, setAppearance] = React.useState(readSavedAppearance)
  const [working, setWorking] = React.useState(readSavedWorking)
  const [branding, setBranding] = React.useState(readSavedBranding)
  const [injections, setInjections] = React.useState(readSavedInjections)
  const [heatmap, setHeatmap] = React.useState(readSavedHeatmap)
  const [efforts, setEfforts] = React.useState(null)
  const [effortTheme, setEffortTheme] = React.useState(readSavedEffortTheme)
  /** Which phrase the page's own sample of the running label is showing. */
  const [previewIndex, setPreviewIndex] = React.useState(0)
  const [selectedTab, setSelectedTab] = React.useState('theme')
  const [mountedSubplugins, setMountedSubplugins] = React.useState(null)

  React.useEffect(() => {
    let live = true
    if (typeof deps.listSubplugins === 'function') {
      deps.listSubplugins(signal).then((list) => {
        if (live && Array.isArray(list)) setMountedSubplugins(new Set(list))
      }).catch(() => {})
    }
    return () => { live = false }
  }, [])

  const isUnavailable = (ns) => {
    if (mountedSubplugins !== null && mountedSubplugins.size > 0 && mountedSubplugins.has('custom-theme')) {
      return !mountedSubplugins.has(ns)
    }
    return false
  }

  function UnavailableCard({ id, icon, title, desc }) {
    return h('section', { className: 'dct-card dsh-extra-card', 'data-card': id, key: id },
      h('div', { className: 'dct-card-header dsh-extra-cardHead' },
        h('div', { className: 'dct-card-title dsh-extra-title' },
          icon ? h('span', { className: 'dct-card-icon dsh-extra-cardIcon', 'aria-hidden': true }, icon) : null,
          title),
        desc ? h('div', { className: 'dct-card-desc dsh-extra-summary' }, desc) : null),
      h('div', { className: 'dct-card-body' },
        h('div', { className: 'dct-unavailable dsh-extra-unavailable' },
          t('rowNotMounted'))))
  }

  const rescan = React.useCallback(async () => {
    setStatus('loading')
    try {
      const [ids, names] = await Promise.all([listThemes(signal), listBackgrounds(signal)])
      setThemes(ids)
      setImages(names)
      setSelected((current) => (current !== '' && !ids.includes(current) ? '' : current))
      setStatus('idle')
    } catch (error) {
      setStatus(error.name === 'AbortError' ? 'idle' : 'failed')
    }
  }, [])

  React.useEffect(() => { rescan() }, [rescan])

  // The official Appearance row can drop a single-palette theme; follow it so
  // the select never shows a theme the window is not painting.
  React.useEffect(() => {
    themeChangeListeners.add(setSelected)
    return () => { themeChangeListeners.delete(setSelected) }
  }, [])

  // The shell renders one settings section at a time, so the official
  // appearance row is off-screen whenever this page is open. This page carries
  // its own switch for the same preference: both write through `setTheme` and
  // this follows `theme/change`, so the two can never disagree.
  React.useEffect(() => ctx.on('theme/change', (snapshot) => {
    setPreference(snapshot.preference)
  }), [])

  const onSelect = React.useCallback(async (event) => {
    const id = event.target.value
    setSelected(id)
    setStatus('loading')
    try {
      const applied = await applyTheme(id)
      if (applied) writeSaved(id)
      // A panel fill is built from the live surface colour, so the zones have to
      // be repainted whenever the palette under them changes.
      applyBackgroundsWhenReady(backgrounds)
      setStatus(applied ? 'idle' : 'failed')
    } catch (error) {
      setStatus(error.name === 'AbortError' ? 'idle' : 'failed')
    }
  }, [backgrounds])

  /** Patch one field of the selected zone. The store and the picture follow below. */
  const updateZone = React.useCallback((patch) => {
    setBackgrounds((current) => ({ ...current, [zone]: { ...current[zone], ...patch } }))
  }, [zone])

  /*
   * Persist the zone settings and repaint, from the state that was committed.
   */
  React.useEffect(() => {
    writeSavedBackgrounds(backgrounds)
    applyBackgroundsWhenReady(backgrounds)
  }, [backgrounds])

  /** The hidden picker the import button drives. */
  const fileInput = React.useRef(null)

  const onPickFile = React.useCallback(async (event) => {
    const file = event.target.files && event.target.files[0]
    event.target.value = ''
    if (!file) return
    const was = backgrounds[zone].name
    setImporting(true)
    setImportFailure(null)
    try {
      const stored = await uploadBackground(file)
      setImages(await listBackgrounds(signal))
      setBackgrounds((current) => (current[zone].name === was
        ? { ...current, [zone]: { ...current[zone], name: stored } }
        : current))
    } catch (error) {
      setImportFailure(importFailureFor(error))
    } finally {
      setImporting(false)
    }
  }, [backgrounds, zone])

  /** Persist one conversation-stream choice, then redeclare the overrides. */
  const updateAppearance = React.useCallback((patch) => {
    setAppearance((current) => {
      const next = { ...current, ...patch }
      localStorage.setItem(APPEARANCE_KEY, JSON.stringify(next))
      applyAppearance(next)
      return next
    })
  }, [])

  /** Persist one working-indicator choice; the live transcript row repaints itself. */
  const updateWorking = React.useCallback((patch) => {
    setWorking((current) => {
      setWorkingSettings({ ...current, ...patch })
      return readSavedWorking()
    })
  }, [])

  /** Persist the branding choices; the sheet, the seats and the wording follow. */
  const updateBranding = React.useCallback((next) => {
    applyBranding(next)
    setBranding(readSavedBranding())
  }, [])

  /** Persist the injected-row choice; the live bridge re-registers the Definition. */
  const updateInjections = React.useCallback((patch) => {
    setInjections((current) => {
      setInjectionSettings({ ...current, ...patch })
      return readSavedInjections()
    })
  }, [])

  /** Persist the heatmap choices; the hero seat hears the store and repaints. */
  const updateHeatmap = React.useCallback((patch) => {
    setHeatmap((current) => writeSavedHeatmap({ ...current, ...patch }))
  }, [])

  /*
   * The reasoning-level switch.
   */
  React.useEffect(() => {
    let live = true
    fetch(EFFORT_LEVELS_URL, { cache: 'no-store' })
      .then((response) => (response.ok
        ? response.json()
        : { failure: `HTTP ${response.status}`, status: response.status }))
      .then((body) => { if (live) setEfforts(body) })
      .catch((error) => { if (live) setEfforts({ failure: error.message }) })
    return () => { live = false }
  }, [])

  const updateEfforts = React.useCallback(async (enabled) => {
    setEfforts((current) => ({ ...(current ?? {}), enabled, busy: true }))
    try {
      const response = await fetch(EFFORT_LEVELS_URL, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
      // A Host that does not know the route answers 404 or 405, which the hint names.
      setEfforts(response.ok
        ? await response.json()
        : { failure: `HTTP ${response.status}`, status: response.status, enabled })
    } catch (error) {
      setEfforts({ failure: error.message, enabled })
    }
  }, [])

  const updateEffortTheme = React.useCallback((next) => {
    setEffortTheme(next)
    writeSavedEffortTheme(next)
  }, [])

  const config = backgrounds[zone]
  const configured = ZONES.filter((item) => backgrounds[item.id].name !== '').length
  const busy = status === 'loading'
  const noImage = config.name === ''
  const active = ZONES.find((item) => item.id === zone)

  const previewTexts = working.texts.length > 0 ? working.texts : [t('workPlaceholder')]
  const previewKey = previewTexts.join('\n')
  const previewText = previewTexts[previewIndex % previewTexts.length]
  React.useEffect(() => { setPreviewIndex(0) }, [previewKey])
  React.useEffect(() => {
    if (previewTexts.length < 2) return undefined
    const timer = window.setTimeout(() => setPreviewIndex((index) => index + 1), working.interval)
    return () => window.clearTimeout(timer)
  }, [previewIndex, previewKey, previewTexts.length, working.interval])

  /** One colour choice with picker and hex readout. */
  const colorField = (className, label, value, onChange) => h('label', { className: `dct-color ${className}` },
    h('input', {
      type: 'color',
      className: 'dct-color-input',
      value,
      'aria-label': label,
      onChange: (event) => onChange(event.target.value),
    }),
    h('code', { className: 'dct-color-code' }, value))

  /** One clickable region of the layout schematic. */
  const region = (id, extra) => h('button', {
    type: 'button',
    className: `${extra}${zone === id ? ' selected' : ''}${backgrounds[id].name === '' ? '' : ' has-image'}`,
    'data-dct-pick': id,
    'aria-pressed': zone === id,
    disabled: busy,
    onClick: () => setZone(id),
  }, h('span', null, t(ZONES.find((item) => item.id === id).labelKey)))

  // Scheme capsule options
  const schemeOptions = [
    { value: 'light', label: t('schemeLight'), icon: svgIcon('sun') },
    { value: 'dark', label: t('schemeDark'), icon: svgIcon('moon') },
    { value: 'system', label: t('schemeSystem'), icon: svgIcon('monitor') },
  ]

  // Line gap capsule options with sensible presets
  const LINE_GAP_PRESETS = [-2, 0, 2, 4, 6]
  const gapName = (gap) => {
    switch (gap) {
      case -2: return t('gapTight')
      case 0: return t('gapNormal')
      case 2: return t('gapRelaxed')
      case 4: return t('gapLoose')
      case 6: return t('gapLarge')
      default: return `${gap > 0 ? '+' : ''}${gap}px`
    }
  }
  const lineGapOptions = LINE_GAP_PRESETS.map((gap) => ({
    value: gap,
    label: `${gap > 0 ? '+' : ''}${gap}px`,
    title: gapName(gap),
  }))
  if (!LINE_GAP_PRESETS.includes(appearance.lineGap)) {
    lineGapOptions.push({
      value: appearance.lineGap,
      label: `${appearance.lineGap > 0 ? '+' : ''}${appearance.lineGap}px`,
      title: gapName(appearance.lineGap),
    })
  }

  // Reasoning disclosure capsule options
  const reasoningOptions = [
    { value: 'streaming', label: t('reasoningModeStreaming') },
    { value: 'keep', label: t('reasoningModeKeep') },
    { value: 'always', label: t('reasoningModeAlways') },
    { value: 'off', label: t('reasoningModeOff') },
  ]

  // Working text intervals
  const INTERVAL_PRESETS = [1200, 1800, 2400, 3000, 4000]
  const intervalOptions = INTERVAL_PRESETS.map((ms) => ({ value: ms, label: `${ms / 1000}s` }))
  if (!INTERVAL_PRESETS.includes(working.interval)) {
    intervalOptions.push({ value: working.interval, label: `${working.interval / 1000}s` })
  }

  // Working effect capsule options
  const effectOptions = WORKING_EFFECTS.map((effect) => ({
    value: effect,
    label: t(WORKING_EFFECT_LABELS[effect]),
  }))

  // Shimmer style capsule options
  const shimmerOptions = WORKING_SHIMMER_STYLES.map((style) => ({
    value: style,
    label: t(WORKING_SHIMMER_LABELS[style]),
  }))

  // Background fit capsule options
  const fitOptions = [
    { value: 'cover', label: t('bgCover') },
    { value: 'contain', label: t('bgContain') },
  ]

  /* ─── Card 1: Theme & Color Palette ─── */
  const themeCard = isUnavailable('custom-theme-themes')
    ? h(UnavailableCard, { id: 'theme', icon: svgIcon('palette'), title: t('cardTheme'), desc: t('cardThemeDesc') })
    : h(Card, { id: 'theme', icon: svgIcon('palette'), title: t('cardTheme'), desc: t('cardThemeDesc') },
        h('div', { className: 'dct-row' },
          h('div', { className: 'dct-text' },
            h('div', { className: 'dct-title' }, t('title')),
            h('div', { className: 'dct-hint' }, busy ? t('loading') : t('hint'))),
          h('div', { className: 'dct-control' },
            h('select', {
              className: 'dct-select dct-theme',
              value: selected,
              disabled: busy,
              'aria-label': t('title'),
              onChange: onSelect,
            },
            h('option', { value: '' }, t('none')),
            themes.map((id) => h('option', { key: id, value: id }, id))),
            h('button', {
              type: 'button',
              className: 'dct-button dct-rescan',
              disabled: busy,
              onClick: rescan,
            }, t('refresh')))),
        h('div', { className: 'dct-row' },
          h('div', { className: 'dct-text' },
            h('div', { className: 'dct-title' }, t('scheme')),
            h('div', { className: 'dct-hint' }, t('schemeHint'))),
          h('div', { className: 'dct-control' },
            h(Capsule, {
              value: preference,
              options: schemeOptions,
              ariaLabel: t('scheme'),
              onChange: (val) => { ctx.theme.setTheme(val) },
            }),
            // Accessible synchronized select for test driver compatibility
            h('select', {
              className: 'dct-select dct-scheme dct-sr-only',
              value: preference,
              'aria-label': t('scheme'),
              tabIndex: -1,
              onChange: (event) => { ctx.theme.setTheme(event.target.value) },
            },
            h('option', { value: 'light' }, t('schemeLight')),
            h('option', { value: 'dark' }, t('schemeDark')),
            h('option', { value: 'system' }, t('schemeSystem'))))))

  /* ─── Card 2: Line spacing ─── */
  const typographyCard = isUnavailable('custom-theme-appearance')
    ? h(UnavailableCard, { id: 'typography', icon: svgIcon('pen'), title: t('cardTypography'), desc: t('cardTypographyDesc') })
    : h(Card, { id: 'typography', icon: svgIcon('pen'), title: t('cardTypography'), desc: t('cardTypographyDesc') },
        h('div', { className: 'dct-row' },
          h('div', { className: 'dct-text' },
            h('div', { className: 'dct-title' },
              t('lineGap'),
              h('span', { className: 'dct-badge' }, gapName(appearance.lineGap))),
            h('div', { className: 'dct-hint' }, t('lineGapDesc'))),
          h('div', { className: 'dct-control' },
            h(Capsule, {
              value: appearance.lineGap,
              options: lineGapOptions,
              ariaLabel: t('lineGap'),
              onChange: (gap) => updateAppearance({ lineGap: gap }),
            }),
            h('select', {
              className: 'dct-select dct-linegap dct-sr-only',
              value: String(appearance.lineGap),
              'aria-label': t('lineGap'),
              tabIndex: -1,
              onChange: (event) => updateAppearance({ lineGap: Number(event.target.value) }),
            }, LINE_GAPS.map((gap) => h('option', { key: gap, value: String(gap) }, gap > 0 ? `+${gap}px` : `${gap}px`))))))

  /* ─── Card 3: Streaming Text Animation ─── */
  const streamingCard = isUnavailable('custom-theme-appearance')
    ? null
    : h(Card, { id: 'streaming', icon: svgIcon('wave'), title: t('cardStreaming'), desc: t('cardStreamingDesc') },
        h('div', { className: 'dct-presets-row' },
          h('span', { className: 'dct-presets-label' }, t('fadePresets')),
          h('div', { className: 'dct-capsule-group dct-capsule-sm', role: 'group' },
            FADE_PRESETS.map((preset) => {
              const isMatch = appearance.streamingFadeDuration === preset.duration
                && Math.abs(appearance.streamingFadeInk - preset.ink) < 0.04
              return h('button', {
                key: preset.id,
                type: 'button',
                className: `dct-capsule-btn${isMatch ? ' selected' : ''}`,
                title: t(preset.tipKey),
                onClick: () => updateAppearance({
                  streamingFadeDuration: preset.duration,
                  streamingFadeInk: preset.ink,
                }),
              }, t(preset.labelKey))
            }))),
        h('div', { className: 'dct-row' },
          h('div', { className: 'dct-text' },
            h('div', { className: 'dct-title' }, t('streamFadeDuration')),
            h('div', { className: 'dct-hint' }, t('fadeDurationDesc'))),
          h('div', { className: 'dct-control' },
            h(SliderControl, {
              value: appearance.streamingFadeDuration,
              min: STREAM_FADE_DURATION_MIN,
              max: STREAM_FADE_DURATION_MAX,
              step: STREAM_FADE_DURATION_STEP,
              unit: 'ms',
              title: t('streamFadeDuration'),
              inputClass: 'dct-fade-duration',
              onChange: (ms) => updateAppearance({ streamingFadeDuration: ms }),
            }))),
        h('div', { className: 'dct-row' },
          h('div', { className: 'dct-text' },
            h('div', { className: 'dct-title' }, t('streamFadeInk')),
            h('div', { className: 'dct-hint' }, t('fadeInkDesc'))),
          h('div', { className: 'dct-control' },
            h(SliderControl, {
              value: Math.round(appearance.streamingFadeInk * 100),
              min: Math.round(STREAM_FADE_INK_MIN * 100),
              max: Math.round(STREAM_FADE_INK_MAX * 100),
              step: 5,
              unit: '%',
              title: t('streamFadeInk'),
              inputClass: 'dct-fade-ink',
              onChange: (percent) => updateAppearance({ streamingFadeInk: percent / 100 }),
            }))))

  /* ─── Card 3b: Start-page usage heatmap ─── */
  const heatmapCard = isUnavailable('custom-theme-heatmap')
    ? h(UnavailableCard, { id: 'heatmap', icon: svgIcon('heatmap'), title: t('cardHeatmap'), desc: t('cardHeatmapDesc') })
    : h(Card, { id: 'heatmap', icon: svgIcon('heatmap'), title: t('cardHeatmap'), desc: t('cardHeatmapDesc') },
        h(HeatmapRow, { t, value: heatmap, apply: updateHeatmap }))

  /* ─── Card 4: Reasoning Disclosure Strategy ─── */
  const reasoningCard = isUnavailable('custom-theme-reasoning')
    ? h(UnavailableCard, { id: 'reasoning', icon: svgIcon('brain'), title: t('cardReasoning'), desc: t('cardReasoningDesc') })
    : h(Card, { id: 'reasoning', icon: svgIcon('brain'), title: t('cardReasoning'), desc: t('cardReasoningDesc') },
        h('div', { className: 'dct-row' },
          h('div', { className: 'dct-text' },
            h('div', { className: 'dct-title' }, t('reasoningExpandTitle')),
            h('div', { className: 'dct-hint' }, t('reasoningExpandHint'))),
          h('div', { className: 'dct-control' },
            h(Capsule, {
              value: appearance.reasoningExpand,
              options: reasoningOptions,
              ariaLabel: t('reasoningExpandTitle'),
              onChange: (val) => updateAppearance({ reasoningExpand: val }),
            }),
            h('select', {
              className: 'dct-select dct-reasoning-expand dct-sr-only',
              value: appearance.reasoningExpand,
              'aria-label': t('reasoningExpandTitle'),
              tabIndex: -1,
              onChange: (event) => updateAppearance({ reasoningExpand: event.target.value }),
            },
            h('option', { value: 'streaming' }, t('reasoningExpandStreaming')),
            h('option', { value: 'keep' }, t('reasoningExpandKeep')),
            h('option', { value: 'always' }, t('reasoningExpandAlways')),
            h('option', { value: 'off' }, t('reasoningExpandFollow'))))),
        h('div', { className: 'dct-detail-banner' },
          h('span', { className: 'dct-detail-icon', 'aria-hidden': true }, svgIcon('bulb')),
          h('span', null, t(REASONING_DESCRIPTIONS[appearance.reasoningExpand] || 'reasoningExpandHint'))))

  /* ─── Card 5: Effort Levels Slider ─── */
  const effortCard = isUnavailable('custom-theme-effort')
    ? h(UnavailableCard, { id: 'effort', icon: svgIcon('planet'), title: t('effortThemeTitle') || '思考深度调节滑块', desc: t('effortThemeHint') || '在输入框底部提供直观调节模型思考努力度的星轨滑块与主题' })
    : h(Card, { id: 'effort', icon: svgIcon('planet'), title: t('effortThemeTitle'), desc: t('effortThemeHint') },
        typeof effortLevelsRow === 'function' ? effortLevelsRow(h, t, efforts, updateEfforts) : null,
        h('div', { className: 'dct-row dct-sub' },
          h('div', { className: 'dct-text' },
            h('div', { className: 'dct-title' }, t('effortThemeTitle')),
            h('div', { className: 'dct-hint' }, t('effortThemeHint'))),
          h('div', { className: 'dct-control' },
            h(Capsule, {
              value: effortTheme,
              options: [
                { value: 'codex', label: t('effortThemeCodex'), icon: svgIcon('sparkle') },
                { value: 'deepseek', label: t('effortThemeDeepSeek'), icon: svgIcon('whale') },
                { value: 'gemini', label: t('effortThemeGemini'), icon: svgIcon('star4') },
                { value: 'claude', label: t('effortThemeClaude'), icon: svgIcon('asterisk') },
              ],
              ariaLabel: t('effortThemeTitle'),
              onChange: (val) => updateEffortTheme(val),
            }))))

  /* ─── Card 6: Working Status & Effects ─── */
  const workingCard = isUnavailable('custom-theme-working')
    ? h(UnavailableCard, { id: 'working', icon: svgIcon('chat'), title: t('cardWorking'), desc: t('cardWorkingDesc') })
    : h(Card, { id: 'working', icon: svgIcon('chat'), title: t('cardWorking'), desc: t('cardWorkingDesc') },
        h('div', { className: 'dct-row dct-sub' },
          h('div', { className: 'dct-text' },
            h('div', { className: 'dct-title' },
              t('workTitle'),
              h('span', { className: 'dct-badge' },
                working.texts.length > 0 ? t('workingTextsCount', { n: working.texts.length }) : t('workingTextsEmpty'))),
            h('div', { className: 'dct-hint' }, t('workHint'))),
          h('div', { className: 'dct-control' },
            h('textarea', {
              className: 'dct-area dct-working',
              value: working.texts.join('\n'),
              placeholder: t('workPlaceholder'),
              'aria-label': t('workTitle'),
              onChange: (event) => updateWorking({ texts: event.target.value.split('\n') }),
            }))),
        h('div', { className: 'dct-row' },
          h('div', { className: 'dct-text' },
            h('div', { className: 'dct-title' }, t('workInterval')),
            h('div', { className: 'dct-hint' }, t('workIntervalDesc'))),
          h('div', { className: 'dct-control' },
            h(Capsule, {
              value: working.interval,
              options: intervalOptions,
              ariaLabel: t('workInterval'),
              onChange: (ms) => updateWorking({ interval: ms }),
            }),
            h('select', {
              className: 'dct-select dct-interval dct-sr-only',
              value: String(working.interval),
              'aria-label': t('workInterval'),
              tabIndex: -1,
              onChange: (event) => updateWorking({ interval: Number(event.target.value) }),
            }, WORKING_INTERVALS.map((ms) => h('option', { key: ms, value: String(ms) }, `${ms / 1000}s`))))),
        h('div', { className: 'dct-row' },
          h('div', { className: 'dct-text' },
            h('div', { className: 'dct-title' }, t('workEffectTitle')),
            h('div', { className: 'dct-hint' }, t('workEffectHint'))),
          h('div', { className: 'dct-control' },
            h(Capsule, {
              value: working.effect,
              options: effectOptions,
              ariaLabel: t('workEffectTitle'),
              onChange: (eff) => updateWorking({ effect: eff }),
            }),
            h('select', {
              className: 'dct-select dct-effect dct-sr-only',
              value: working.effect,
              'aria-label': t('workEffectTitle'),
              tabIndex: -1,
              onChange: (event) => updateWorking({ effect: event.target.value }),
            }, WORKING_EFFECTS.map((effect) => h('option', { key: effect, value: effect }, t(WORKING_EFFECT_LABELS[effect])))))),
        working.effect === 'shimmer' ? h('div', { className: 'dct-row' },
          h('div', { className: 'dct-text' },
            h('div', { className: 'dct-title' }, t('workShimmerStyle')),
            h('div', { className: 'dct-hint' }, t('workShimmerMatte') + ' / ' + t('workShimmerRainbow'))),
          h('div', { className: 'dct-control' },
            h(Capsule, {
              value: working.shimmer,
              options: shimmerOptions,
              ariaLabel: t('workShimmerStyle'),
              onChange: (shim) => updateWorking({ shimmer: shim }),
            }),
            h('select', {
              className: 'dct-select dct-shimmer dct-sr-only',
              value: working.shimmer,
              'aria-label': t('workShimmerStyle'),
              tabIndex: -1,
              onChange: (event) => updateWorking({ shimmer: event.target.value }),
            }, WORKING_SHIMMER_STYLES.map((style) => h('option', { key: style, value: style }, t(WORKING_SHIMMER_LABELS[style])))))) : null,
        working.effect !== 'official' ? h('div', { className: 'dct-row' },
          h('div', { className: 'dct-text' },
            h('div', { className: 'dct-title' }, t('workColorsDesc'))),
          h('div', { className: 'dct-control dct-wrap' },
            colorField('dct-work-color', t('workColor'), working.color, (color) => updateWorking({ color })),
            working.effect === 'shimmer' && working.shimmer === 'matte'
              ? colorField('dct-work-sweep-color', t('workSweepColor'), working.sweep, (sweep) => updateWorking({ sweep }))
              : null)) : null,
        h('div', { className: 'dct-work-preview' },
          working.effect === 'hidden'
            ? h('span', { className: 'dct-work-preview-note' }, t('workPreviewHidden'))
            : h('span', { className: 'dct-work-effect' },
              previewText,
              h('span', { className: 'dct-work-sweep', 'aria-hidden': true },
                h('span', { className: 'dct-work-sweep-text' }, previewText))),
          h('small', null, t('workPreviewCaption'))))

  /* ─── Card 7: Branding & Custom CSS ─── */
  const brandingCard = isUnavailable('custom-theme-branding')
    ? h(UnavailableCard, { id: 'branding', icon: svgIcon('tag'), title: t('cardBranding'), desc: t('cardBrandingDesc') })
    : h(Card, { id: 'branding', icon: svgIcon('tag'), title: t('cardBranding'), desc: t('cardBrandingDesc') },
        h(BrandingRow, { t, value: branding, apply: updateBranding }))

  /* ─── Card 8: Injections ─── */
  const injectionsCard = isUnavailable('custom-theme-injections')
    ? h(UnavailableCard, { id: 'injections', icon: svgIcon('sliders'), title: t('cardInjections'), desc: t('cardInjectionsDesc') })
    : h(Card, { id: 'injections', icon: svgIcon('sliders'), title: t('cardInjections'), desc: t('cardInjectionsDesc') },
        h('div', { className: 'dct-row dct-sub' },
          h('div', { className: 'dct-text' },
            h('div', { className: 'dct-title' }, t('injSettingTitle')),
            h('div', { className: 'dct-hint' }, t('injHint')),
            injectionSeamOf() === 'absent' ? h('div', { className: 'dct-note' }, t('injUnavailable')) : null),
          h('div', { className: 'dct-control' },
            h('label', { className: 'dct-toggle' },
              h('input', {
                type: 'checkbox',
                className: 'dct-injections',
                checked: injections.show,
                'aria-label': t('injSettingTitle'),
                onChange: (event) => updateInjections({ show: event.target.checked }),
              }),
              h('span', null, injections.show ? t('injShow') : t('injFollow'))))))

  /* ─── Card 9: Background & Wallpapers ─── */
  const backgroundsCard = isUnavailable('custom-theme-backgrounds')
    ? h(UnavailableCard, { id: 'background', icon: svgIcon('image'), title: t('cardBackground'), desc: t('cardBackgroundDesc') })
    : h(Card, { id: 'background', icon: svgIcon('image'), title: t('cardBackground'), desc: t('cardBackgroundDesc') },
        h('div', { className: 'dct-row dct-sub' },
          h('div', { className: 'dct-text' },
            h('div', { className: 'dct-title' }, t('bgTitle')),
            h('div', { className: 'dct-hint' },
              importMessage(t, importFailure) ?? (configured > 0 ? t('bgConfigured') : t('bgHint')))),
          h('div', { className: 'dct-control dct-wrap' },
            h('input', {
              ref: fileInput,
              className: 'dct-file',
              type: 'file',
              accept: 'image/*',
              'aria-label': t('bgImport'),
              onChange: onPickFile,
            }),
            h('button', {
              type: 'button',
              className: 'dct-button dct-import',
              disabled: busy || importing,
              onClick: () => { if (fileInput.current) fileInput.current.click() },
            }, importing ? t('bgImporting') : t('bgImport')))),
        h('div', { className: 'dct-zones', role: 'group', 'aria-label': t('bgZonesHint') },
          ZONES.map((item) => h('button', {
            key: item.id,
            type: 'button',
            className: `dct-zone-tab${zone === item.id ? ' selected' : ''}${backgrounds[item.id].name === '' ? '' : ' has-image'}`,
            'data-dct-tab': item.id,
            'aria-pressed': zone === item.id,
            disabled: busy,
            onClick: () => setZone(item.id),
          },
          h('strong', null, t(item.labelKey)),
          h('small', null, backgrounds[item.id].name === '' ? t('bgUnset') : backgrounds[item.id].name)))),
        h('div', { className: 'dct-schematic', role: 'group', 'aria-label': t('bgSchematic') },
          region('global', 'dct-schematic-global'),
          region('windowbar', 'dct-schematic-windowbar'),
          region('sidebar', 'dct-schematic-sidebar'),
          h('div', { className: 'dct-schematic-main' },
            region('conversation', 'dct-schematic-conversation'),
            region('composer', 'dct-schematic-composer')),
          region('dock', 'dct-schematic-dock')),
        h('div', { className: 'dct-row dct-sub' },
          h('div', { className: 'dct-text' },
            h('div', { className: 'dct-title' }, `${t('bgZone')} · ${t(active.labelKey)}`),
            h('div', { className: 'dct-hint' }, noImage ? t('bgUnset') : config.name)),
          h('div', { className: 'dct-control dct-wrap' },
            h('select', {
              className: 'dct-select dct-image',
              value: config.name,
              disabled: busy,
              'aria-label': t('bgImage'),
              onChange: (event) => updateZone({ name: event.target.value }),
            },
            h('option', { value: '' }, t('bgNone')),
            images.map((name) => h('option', { key: name, value: name }, name))),
            h(Capsule, {
              value: config.size,
              options: fitOptions,
              disabled: busy || noImage,
              ariaLabel: t('bgFit'),
              size: 'small',
              onChange: (size) => updateZone({ size }),
            }),
            h('select', {
              className: 'dct-select dct-fit dct-sr-only',
              value: config.size,
              disabled: busy || noImage,
              'aria-label': t('bgFit'),
              tabIndex: -1,
              onChange: (event) => updateZone({ size: event.target.value }),
            },
            h('option', { value: 'cover' }, t('bgCover')),
            h('option', { value: 'contain' }, t('bgContain'))),
            h('select', {
              className: 'dct-select dct-position',
              value: config.position,
              disabled: busy || noImage,
              'aria-label': t('bgPosition'),
              onChange: (event) => updateZone({ position: event.target.value }),
            }, POSITIONS.map((pos) => h('option', { key: pos, value: pos }, t(positionKey(pos))))),
            h('input', {
              className: 'dct-number dct-opacity',
              type: 'number',
              min: OPACITY_MIN * 100,
              max: OPACITY_MAX * 100,
              step: 5,
              value: Math.round(config.opacity * 100),
              disabled: busy || noImage,
              title: t('bgOpacity'),
              'aria-label': t('bgOpacity'),
              onChange: (event) => {
                const percent = Number(event.target.value)
                if (Number.isFinite(percent)) {
                  updateZone({ opacity: Math.min(OPACITY_MAX * 100, Math.max(OPACITY_MIN * 100, percent)) / 100 })
                }
              },
            }),
            h('input', {
              className: 'dct-number dct-blur',
              type: 'number',
              min: BLUR_MIN,
              max: BLUR_MAX,
              step: 1,
              value: config.blur,
              disabled: busy || noImage,
              title: t('bgBlur'),
              'aria-label': t('bgBlur'),
              onChange: (event) => {
                const pixels = Number(event.target.value)
                if (Number.isFinite(pixels)) {
                  updateZone({ blur: Math.min(BLUR_MAX, Math.max(BLUR_MIN, Math.round(pixels))) })
                }
              },
            }),
            h('button', {
              type: 'button',
              className: 'dct-button dct-clear',
              disabled: noImage,
              onClick: () => updateZone({ name: '' }),
            }, t('bgClear')))))

  /* ─── Card 10: Desktop Tray ─── */
  const trayCard = isUnavailable('custom-theme-tray')
    ? h(UnavailableCard, { id: 'tray', icon: svgIcon('monitor'), title: t('trayTitle'), desc: t('trayDescription') })
    : h(TrayRow, { t, controller: deps.trayController })

  /* ─── Card 11: Plugin Update ─── */
  const updateCard = h(UpdateRow, { t })

  const TABS = [
    { id: 'theme', label: t('tabTheme'), render: () => [themeCard, backgroundsCard].filter(Boolean) },
    { id: 'appearance', label: t('tabAppearance'), render: () => [typographyCard, streamingCard].filter(Boolean) },
    { id: 'heatmap', label: t('tabHeatmap'), render: () => [heatmapCard].filter(Boolean) },
    { id: 'injections', label: t('tabInjections'), render: () => [injectionsCard].filter(Boolean) },
    { id: 'reasoning', label: t('tabReasoning'), render: () => [reasoningCard, effortCard].filter(Boolean) },
    { id: 'effects', label: t('tabEffects'), render: () => [workingCard, brandingCard].filter(Boolean) },
    { id: 'tray', label: t('tabTray'), render: () => [trayCard, updateCard].filter(Boolean) },
  ]

  let SegmentedControl = null
  try {
    const primitives = require('@deepseek-ai/dsh-client-ui-primitives')
    if (primitives && typeof primitives.SegmentedControl === 'function') {
      SegmentedControl = primitives.SegmentedControl
    }
  } catch {}

  const activeTab = TABS.find((tab) => tab.id === selectedTab) || TABS[0]

  // Whichever strip draws the tabs decides what the ids are called: the shell's
  // `SegmentedControl` names its tab `<base>-<tab>` and points `aria-controls` at
  // `<base>-<tab>-panel`, while this card's own tablist spells the same pair under
  // `custom-theme-tab`. The panels answer to that same base, so `aria-controls` and
  // `aria-labelledby` resolve to real elements under either rendering instead of naming
  // ids that only one of them renders.
  const tabBase = typeof SegmentedControl === 'function' ? 'custom-theme-tabs' : 'custom-theme-tab'

  const tabBar = typeof SegmentedControl === 'function'
    ? h(SegmentedControl, {
        key: 'tabs',
        id: tabBase,
        value: activeTab.id,
        label: t('tabGroup'),
        options: TABS.map((tab) => ({ value: tab.id, label: tab.label })),
        onChange: (next) => setSelectedTab(next),
      })
    : h('div', {
        key: 'tabs',
        className: 'dct-tabs',
        role: 'tablist',
        'data-tabs': 'custom-theme-tabs',
        'aria-label': t('tabGroup'),
      }, ...TABS.map((tab) => {
        const isSelected = tab.id === activeTab.id
        return h('button', {
          key: tab.id,
          type: 'button',
          role: 'tab',
          id: `${tabBase}-${tab.id}`,
          'aria-selected': isSelected,
          'aria-controls': `${tabBase}-${tab.id}-panel`,
          className: `dct-tab-btn${isSelected ? ' selected' : ''}`,
          onClick: () => setSelectedTab(tab.id),
        }, tab.label)
      }))

  const tabPanels = TABS.map((tab) => h('div', {
    key: tab.id,
    className: 'dct-tab-panel dsh-extra-tabPanel',
    role: 'tabpanel',
    id: `${tabBase}-${tab.id}-panel`,
    'aria-labelledby': `${tabBase}-${tab.id}`,
    style: { display: activeTab.id === tab.id ? 'flex' : 'none' },
  }, ...tab.render()))

  return h('div', { className: 'dct-page dsh-extra-page' },
    h('h2', { className: 'dct-heading dsh-extra-heading' },
      h('span', { className: 'dsh-extra-headingIcon', 'aria-hidden': true }, svgIcon('palette')),
      h('span', null, t('nav'))),
    h('p', { className: 'dct-intro dsh-extra-intro' },
      t('pageIntro')),
    tabBar,
    ...tabPanels,
    status === 'failed' ? h('div', { className: 'dct-error', role: 'status' }, t('failed')) : null)
}

  return { ThemeRow }
}
