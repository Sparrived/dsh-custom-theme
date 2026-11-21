/**
 * theme/accent.cjs — one accent colour laid over whatever theme is active.
 *
 * A theme states the colour its own actions use. This turns one chosen colour
 * into the light and dark pair the theme runtime needs, nudging each until it
 * still reads on that palette's canvas: a picker offers a colour, not a
 * contrast guarantee, and a pale pick would otherwise vanish on a light canvas.
 */

/** Swatches offered beside "follow the theme", in picker order. */
const ACCENT_PRESETS = [
  { id: 'violet', color: '#5744a7' },
  { id: 'blue', color: '#2f6fd0' },
  { id: 'teal', color: '#12897b' },
  { id: 'amber', color: '#b4661a' },
  { id: 'rose', color: '#b1345e' },
  { id: 'green', color: '#2f7d3f' },
]

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/iu

/** Canvas each scheme resolves against, as the darkest and lightest we ship. */
const CANVAS = { light: '#ffffff', dark: '#101217' }

/** Contrast an accent has to reach on its own scheme's canvas. */
const CONTRAST = { light: 4.6, dark: 4.9 }

/** The colour a stored value names as `#rrggbb`, or `''` when it names none. */
function normaliseAccent(value) {
  if (typeof value !== 'string') return ''
  const match = HEX.exec(value.trim())
  if (match === null) return ''
  const digits = match[1].length === 3 ? [...match[1]].map((digit) => digit + digit).join('') : match[1]
  return `#${digits.toLowerCase()}`
}

/** RGB channels of a normalised colour. */
function channels(hex) {
  return [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16) / 255)
}

/** Rec. 709 relative luminance of a normalised colour. */
function luminance(hex) {
  const [r, g, b] = channels(hex).map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Contrast ratio between two luminances. */
function contrastOf(one, other) {
  return (Math.max(one, other) + 0.05) / (Math.min(one, other) + 0.05)
}

/** HSL of a normalised colour, hue in degrees and the rest on 0–1. */
function toHsl(hex) {
  const [r, g, b] = channels(hex)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lightness = (max + min) / 2
  if (max === min) return [0, 0, lightness]
  const delta = max - min
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  const hue = max === r
    ? ((g - b) / delta + (g < b ? 6 : 0)) / 6
    : max === g ? ((b - r) / delta + 2) / 6 : ((r - g) / delta + 4) / 6
  return [hue, saturation, lightness]
}

/** Normalised colour of an HSL triple. */
function fromHsl([hue, saturation, lightness]) {
  const channel = (offset) => {
    const k = (offset + hue * 12) % 12
    const a = saturation * Math.min(lightness, 1 - lightness)
    return Math.round(255 * (lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
  }
  return `#${[0, 8, 4].map((offset) => channel(offset).toString(16).padStart(2, '0')).join('')}`
}

/** The same colour with its lightness moved, its hue and saturation kept. */
function shift(hex, delta) {
  const [hue, saturation, lightness] = toHsl(hex)
  return fromHsl([hue, saturation, Math.max(0, Math.min(1, lightness + delta))])
}

/**
 * A colour of `hex`'s hue that reaches the scheme's contrast on its canvas.
 * @param hex - Normalised colour.
 * @param scheme - `'light'` or `'dark'`.
 * @returns Normalised colour.
 */
function fit(hex, scheme) {
  const canvas = luminance(CANVAS[scheme])
  let color = hex
  for (let step = 0; step < 40 && contrastOf(luminance(color), canvas) < CONTRAST[scheme]; step += 1) {
    color = shift(color, scheme === 'light' ? -0.02 : 0.02)
  }
  return color
}

/** Ink that reads on top of a filled action of this colour. */
function inkFor(hex) {
  return luminance(hex) > 0.21 ? '#141118' : '#ffffff'
}

/**
 * The token pairs one accent colour contributes.
 *
 * A pair, because the runtime takes light and dark for every token; the shapes
 * the theme states are the ones overridden, so nothing else in the palette moves.
 * @param value - Stored accent value; anything unreadable contributes nothing.
 * @returns Token name to `{ light, dark }`.
 */
function accentTokens(value) {
  const color = normaliseAccent(value)
  if (color === '') return {}
  const light = fit(color, 'light')
  const dark = fit(color, 'dark')
  const pair = (lightValue, darkValue = lightValue) => ({ light: lightValue, dark: darkValue })
  return {
    '--dsw-alias-brand-primary': pair(light, dark),
    '--dsw-alias-brand-primary-new-colorprimary-new-color': pair(light, dark),
    '--dsw-alias-button-primary-fill': pair(light, dark),
    '--dsw-alias-button-info-fill': pair(light, dark),
    '--dsw-alias-button-info-hover': pair(shift(light, -0.05), shift(dark, 0.05)),
    '--dsw-alias-state-business-primary': pair(light, dark),
    '--dsw-alias-state-business-tertiary': pair(`${light}22`, `${dark}33`),
    '--dsw-alias-button-primary-hover': pair(shift(light, -0.05), shift(dark, 0.05)),
    '--dsw-alias-brand-text': pair(inkFor(light), inkFor(dark)),
    '--dsw-alias-link': pair(light, dark),
    '--dsw-alias-button-ghost-active-border': pair(light, dark),
    '--dsw-alias-interactive-bg-hover-accent': pair(`${light}1f`, `${dark}29`),
    '--dct-prism-ring': pair(light, dark),
  }
}

module.exports = { ACCENT_PRESETS, normaliseAccent, accentTokens, contrastOf, luminance }
