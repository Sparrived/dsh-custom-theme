/**
 * shared/icons.cjs — the inline SVG icon set for the settings page.
 *
 * Every pictogram this half draws is a small inline SVG built with the shared
 * `h` factory, so it inherits `currentColor`, scales with font size, and stays
 * sharp in both light and dark themes — none of which an emoji glyph can
 * promise. Paths are 24×24, stroke-based where a fill would read as a blob.
 *
 * `icon(name)` returns a React element; pass it anywhere a text emoji used to
 * sit (`Card`, `Capsule`, detail banners).
 */
const React = require('react')
const { h } = require('./element.cjs')

/**
 * Build one `<svg>` element from path/shape children.
 * @param attrs - Extra svg attributes (e.g. a different viewBox).
 * @param children - SVG child elements.
 */
function svg(attrs, ...children) {
  return h('svg', {
    viewBox: '0 0 24 24',
    width: '1em',
    height: '1em',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    focusable: false,
    ...attrs,
  }, ...children)
}

/** Shorthand for one `<path>` element. */
const path = (d, extra = {}) => h('path', { d, ...extra })

/** Shorthand for one `<circle>` element. */
const circle = (cx, cy, r, extra = {}) => h('circle', { cx, cy, r, ...extra })

/** Shorthand for one `<rect>` element. */
const rect = (x, y, width, height, extra = {}) => h('rect', { x, y, width, height, ...extra })

/** Sun: colour scheme — light. */
function sun() {
  const rays = []
  for (let index = 0; index < 8; index += 1) {
    const angle = (index * Math.PI) / 4
    const x1 = 12 + 5.2 * Math.cos(angle)
    const y1 = 12 + 5.2 * Math.sin(angle)
    const x2 = 12 + 8.4 * Math.cos(angle)
    const y2 = 12 + 8.4 * Math.sin(angle)
    rays.push(h('line', { key: index, x1: x1.toFixed(2), y1: y1.toFixed(2), x2: x2.toFixed(2), y2: y2.toFixed(2) }))
  }
  return svg({}, circle(12, 12, 3.4), ...rays)
}

/** Moon: colour scheme — dark. */
function moon() {
  return svg({}, path('M20 13.2A8.1 8.1 0 0 1 10.8 4 6.6 6.6 0 1 0 20 13.2Z'))
}

/** Monitor: colour scheme — follow system, and the desktop tray. */
function monitor() {
  return svg({},
    rect(3, 4.5, 18, 12.5, { rx: 1.6 }),
    h('line', { x1: 9, y1: 20.5, x2: 15, y2: 20.5 }),
    h('line', { x1: 12, y1: 17, x2: 12, y2: 20.5 }))
}

/** Palette: theme card and page heading. */
function palette() {
  return svg({},
    path('M12 21a9 9 0 1 1 9-9c0 2-1.5 3-3 3h-2.2a2.3 2.3 0 0 0-1.8 3.7c.7.9.2 2.3-1 2.3Z'),
    circle(7.6, 10.2, 1.05, { fill: 'currentColor', stroke: 'none' }),
    circle(11, 7.4, 1.05, { fill: 'currentColor', stroke: 'none' }),
    circle(15.2, 8.6, 1.05, { fill: 'currentColor', stroke: 'none' }))
}

/** Pen nib: typography card. */
function pen() {
  return svg({},
    path('M12 3.5 15.8 9 14.4 15.5 12 20.5 9.6 15.5 8.2 9Z'),
    circle(12, 11.6, 1.3),
    h('line', { x1: 12, y1: 12.9, x2: 12, y2: 17.5 }))
}

/** Wave: streaming text card. */
function wave() {
  return svg({},
    path('M3 9c2.4 0 2.4 2.2 4.8 2.2S10.2 9 12.6 9s2.4 2.2 4.8 2.2S19.8 9 21 9'),
    path('M3 14.5c2.4 0 2.4 2.2 4.8 2.2s2.4-2.2 4.8-2.2 2.4 2.2 4.8 2.2 2.4-2.2 3.6-2.2'))
}

/** Head with a spark: reasoning disclosure card. */
function brain() {
  return svg({},
    path('M9 20v-2.2A6.5 6.5 0 0 1 5.5 12 6.5 6.5 0 0 1 12 5.5 6.5 6.5 0 0 1 18.5 12c0 1.5-.5 2.9-1.4 4'),
    path('M12 8.5v3l2 1.6'),
    path('M15.5 17.5c.8.5 1.2 1.4 1.2 2.5'))
}

/** Ringed planet: effort slider card. */
function planet() {
  return svg({},
    circle(12, 12, 4.6),
    path('M3.6 15.9c-1.1-.6-1.2-1.6-.2-2.3 2.4-1.7 6.3-2.9 10-3.2 3.9-.3 7 .4 7.4 1.4.3.8-.6 1.6-2.3 2.3', { transform: 'rotate(-18 12 12)' }))
}

/** Speech bubble: working status card. */
function chat() {
  return svg({},
    path('M20 11.6c0 4.1-3.6 7.4-8 7.4-1 0-2-.2-2.9-.5L4 20l1.3-3.6A7 7 0 0 1 4 11.6C4 7.5 7.6 4.2 12 4.2s8 3.3 8 7.4Z'),
    circle(8.8, 11.6, 0.9, { fill: 'currentColor', stroke: 'none' }),
    circle(12, 11.6, 0.9, { fill: 'currentColor', stroke: 'none' }),
    circle(15.2, 11.6, 0.9, { fill: 'currentColor', stroke: 'none' }))
}

/** Price tag: branding card. */
function tag() {
  return svg({},
    path('M20.6 13.4 13.4 20.6a1.8 1.8 0 0 1-2.5 0L3.5 13.2V3.5h9.7l7.4 7.4a1.8 1.8 0 0 1 0 2.5Z'),
    circle(7.6, 7.6, 1.2))
}

/** Sliders: injections card. */
function sliders() {
  return svg({},
    h('line', { x1: '5', y1: '7.5', x2: '19', y2: '7.5' }),
    h('line', { x1: '5', y1: '12', x2: '19', y2: '12' }),
    h('line', { x1: '5', y1: '16.5', x2: '19', y2: '16.5' }),
    circle(9.5, 7.5, 1.9, { fill: 'var(--dsw-alias-bg-layer-1, #fff)' }),
    circle(14.5, 12, 1.9, { fill: 'var(--dsw-alias-bg-layer-1, #fff)' }),
    circle(7.5, 16.5, 1.9, { fill: 'var(--dsw-alias-bg-layer-1, #fff)' }))
}

/** Framed picture: background card. */
function image() {
  return svg({},
    rect(3.5, 4.5, 17, 15, { rx: 1.6 }),
    circle(8.6, 9.4, 1.4),
    path('M4.5 17.5 9.5 12.5l3 3 3.5-3.5 3.5 3.5'))
}

/** Lightbulb: detail-banner hint icon. */
function bulb() {
  return svg({},
    path('M9.2 17.5h5.6'),
    path('M10 20.5h4'),
    path('M12 3.5a5.4 5.4 0 0 0-3.2 9.8c.7.6 1.2 1.4 1.2 2.2h4c0-.8.5-1.6 1.2-2.2A5.4 5.4 0 0 0 12 3.5Z'))
}

/** Four-point sparkle: Codex effort theme. */
function sparkle() {
  return svg({},
    path('M12 4c.7 3.8 2.4 5.5 6.2 6.2-3.8.7-5.5 2.4-6.2 6.2-.7-3.8-2.4-5.5-6.2-6.2C9.6 9.5 11.3 7.8 12 4Z'),
    path('M18.6 15.6c.3 1.6 1 2.3 2.6 2.6-1.6.3-2.3 1-2.6 2.6-.3-1.6-1-2.3-2.6-2.6 1.6-.3 2.3-1 2.6-2.6Z', { strokeWidth: 1.4 }))
}

/** Whale: DeepSeek effort theme. */
function whale() {
  return svg({},
    path('M3.5 13.2c0-3.6 3.4-6.4 7.6-6.4 3.6 0 6.6 2.1 7.4 5l2-1.7c-.5 1.8-.5 3.6 0 5.4l-2-1.7c-.8 2.9-3.8 5-7.4 5-4.2 0-7.6-2.8-7.6-6.4Z'),
    circle(8.4, 11.6, 0.9, { fill: 'currentColor', stroke: 'none' }),
    path('M6.8 6.4C6.8 5 7.8 4 9.2 4c-.4 1-.4 2 0 2.9', { strokeWidth: 1.4 }))
}

/** Four-point star, open: Gemini effort theme. */
function star4() {
  return svg({}, path('M12 3.5c.9 4.4 2.9 6.4 7.3 7.3-4.4.9-6.4 2.9-7.3 7.3-.9-4.4-2.9-6.4-7.3-7.3 4.4-.9 6.4-2.9 7.3-7.3Z'))
}

/** Six-petal asterisk: Claude effort theme. */
function asterisk() {
  const petals = []
  for (let index = 0; index < 6; index += 1) {
    petals.push(h('ellipse', {
      key: index,
      cx: 12,
      cy: 12,
      rx: 2.1,
      ry: 6.4,
      transform: `rotate(${index * 30} 12 12)`,
    }))
  }
  return svg({}, ...petals)
}

const ICONS = {
  sun,
  moon,
  monitor,
  palette,
  pen,
  wave,
  brain,
  planet,
  chat,
  tag,
  sliders,
  image,
  bulb,
  sparkle,
  whale,
  star4,
  asterisk,
}

/**
 * Build the SVG element for one named icon.
 * @param name - One of the keys in `ICONS`.
 * @returns A React element, or `null` for an unknown name.
 */
function icon(name) {
  const factory = ICONS[name]
  return typeof factory === 'function' ? factory() : null
}

module.exports = { ICONS, icon }
