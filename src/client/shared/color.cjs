/**
 * shared/color.cjs — the colour primitives the hot paths build on.
 *
 * Nothing here may import `effort/math.cjs`: the maths module mixes colours, so
 * reaching back for its `clamp01` would be a cycle. The clamp below is therefore
 * written out, and it is `clamp01` exactly — `!(t > 0) → 0`, else `t > 1 ? 1 : t` —
 * so a NaN or an absent `t` still lands on the ramp's first colour instead of
 * reaching CSS as `rgb(NaN,NaN,NaN)`.
 */
function mixColor(from, to, t) {
  const k = t > 0 ? (t > 1 ? 1 : t) : 0
  return [
    Math.round(from[0] + (to[0] - from[0]) * k),
    Math.round(from[1] + (to[1] - from[1]) * k),
    Math.round(from[2] + (to[2] - from[2]) * k),
  ]
}

/** An `[r, g, b]` triple as CSS. */
function rgbOf(color) {
  return `rgb(${color[0]},${color[1]},${color[2]})`
}

/**
 * Parse the `rgb()`/`rgba()` form `getComputedStyle` returns, including its
 * alpha, so a fully transparent surface can be told from a painted one.
 */
function parseColor(value) {
  const match = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?\s*\)$/u
    .exec(typeof value === 'string' ? value : '')
  if (match === null) return null
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: match[4] === undefined ? 1 : Number(match[4]),
  }
}

/**
 * Re-emit a parsed colour at a new alpha; opaque black when unparseable.
 *
 * The alpha is rounded because it is usually computed as `1 - opacity`, and
 * that subtraction leaves values like `0.19999999999999996` in the DOM.
 */
function withAlpha(color, alpha) {
  const rounded = Math.round(alpha * 1000) / 1000
  return color === null ? `rgba(0, 0, 0, ${rounded})` : `rgba(${color.r}, ${color.g}, ${color.b}, ${rounded})`
}

module.exports = { mixColor, rgbOf, parseColor, withAlpha }
