/**
 * effort/math.cjs — the arithmetic behind the slider — pure, so the effect is testable.
 */
const {
  COLOR_BLUE,
  COLOR_DEEP,
  COLOR_TEXT_VIOLET,
  COLOR_VIOLET,
  COLOR_DEEPSEEK_BASE,
  COLOR_DEEPSEEK_CYAN,
  COLOR_DEEPSEEK_ABYSS,
  COLOR_DEEPSEEK_TEXT,
  ENERGY_END,
  ENERGY_START,
  GOLDEN_RATIO,
  KNOB_RADIUS,
  MAX_SPEED_FACTOR,
  MIN_HEIGHT_SLOTS,
  STARFIELD_DURATION_MEAN,
  STARFIELD_DURATION_SPREAD,
  STARFIELD_MIN,
} = require('./constants.cjs')
const { mixColor, rgbOf } = require('../shared/color.cjs')

const EMPTY_MODEL_SNAPSHOT = Object.freeze({
  current: null,
  groups: [],
  failures: [],
  status: 'idle',
  pending: null,
  error: null,
  retainedEffort: undefined,
})

/** The current model's entry in a directory snapshot, or null. */
function modelOf(state) {
  const current = state?.current
  if (typeof current?.provider !== 'string' || typeof current?.model !== 'string') return null
  const groups = Array.isArray(state.groups) ? state.groups : []
  for (const group of groups) {
    if (group?.id !== current.provider) continue
    const models = Array.isArray(group.models) ? group.models : []
    for (const model of models) {
      if (model?.id === current.model) return model
    }
  }
  return null
}

/** The levels the current model actually serves, in the directory's own order. */
function effortLevelsOf(state) {
  const model = modelOf(state)
  const efforts = Array.isArray(model?.reasoning?.efforts) ? model.reasoning.efforts : []
  const levels = []
  for (const effort of efforts) {
    if (typeof effort?.id !== 'string' || effort.id.length === 0) continue
    levels.push({
      id: effort.id,
      name: typeof effort.name === 'string' && effort.name.length > 0 ? effort.name : effort.id,
    })
  }
  return levels
}

/**
 * The level in force: the session's own choice, or the model's default when it has none —
 * the shell's `intended.reasoningEffort ?? reasoning.defaultEffort`, read the same way.
 */
function effectiveEffortId(state) {
  const current = state?.current
  if (typeof current?.reasoningEffort === 'string' && current.reasoningEffort.length > 0) {
    return current.reasoningEffort
  }
  const fallback = modelOf(state)?.reasoning?.defaultEffort
  return typeof fallback === 'string' && fallback.length > 0 ? fallback : null
}

/** The index of a level id, or -1. */
function indexOfLevel(levels, id) {
  if (typeof id !== 'string') return -1
  return levels.findIndex((level) => level.id === id)
}

/** Clamp to 0..1, NaN included. */
function clamp01(value) {
  if (!(value > 0)) return 0
  return value > 1 ? 1 : value
}

/** A track position to the level it snaps to: the track is continuous, the levels are not. */
function indexFromPct(pct, count) {
  if (count <= 1) return 0
  return Math.max(0, Math.min(count - 1, Math.round(clamp01(pct) * (count - 1))))
}

/** A level to its position on the track, so a tick and the knob share one geometry. */
function pctFromIndex(index, count) {
  if (count <= 1) return 0
  return Math.max(0, Math.min(count - 1, index)) / (count - 1)
}
/**
 * The starfield, derived entirely from the index.
 *
 * 22 stars, no random numbers: the same render draws the same field, and every property
 * below can be asserted offline.
 *
 * Height and phase are dealt from **two unrelated** sequences on purpose. An earlier
 * version took both from `frac((i + 1) × φ)`, which sorted the stars into a diagonal —
 * "the further right, the higher" (a measured correlation of 0.999). Phase stays a
 * golden-ratio low-discrepancy sequence, so any prefix of it is still spread out, while
 * height is a deterministic *shuffle* of evenly spaced slots, and the salt is chosen so
 * that stars whose phases are neighbours — the ones that travel side by side — are at
 * least `MIN_HEIGHT_SLOTS` apart.
 */
const EFFORT_STARS = (function buildEffortStars() {
  const count = 22
  const stars = []
  for (let i = 0; i < count; i += 1) stars.push({ y: 0, phase: ((i + 1) * GOLDEN_RATIO) % 1 })
  const byPhase = stars.map((_, i) => i).sort((a, b) => stars[a].phase - stars[b].phase)
  let slots = null
  for (let salt = 71; salt < 4000 && slots === null; salt += 1) {
    const candidate = stars.map((_, i) => i)
    candidate.sort((a, b) => {
      const ha = starHash01(a, salt)
      const hb = starHash01(b, salt)
      return ha === hb ? a - b : ha - hb
    })
    let ok = true
    for (let k = 1; k < count && ok; k += 1) {
      if (Math.abs(candidate[k] - candidate[k - 1]) < MIN_HEIGHT_SLOTS) ok = false
    }
    if (ok) slots = candidate
  }
  if (slots === null) {
    // A fallback that is still a permutation: a stride of 5 is coprime with 22.
    slots = stars.map((_, i) => (i * 5) % count)
  }
  for (let rank = 0; rank < count; rank += 1) stars[byPhase[rank]].y = 8 + (slots[rank] / (count - 1)) * 84
  return stars
})()

/** A deterministic pseudo-random number in [0, 1): no `Math.random`, so renders never jump. */
function starHash01(index, salt) {
  const value = ((index + 1) * salt * 2654435761) % 4294967296
  return ((value >>> 8) % 1000) / 1000
}

/** Mix two `[r, g, b]` colours. */

/** The position's own colour: blue until the second stop, then violet, then deep violet. */
function fillColorFor(pct, theme = 'codex') {
  const t = clamp01(pct)
  if (theme === 'deepseek') {
    if (t <= ENERGY_START) return rgbOf(COLOR_DEEPSEEK_BASE)
    if (t <= ENERGY_END) return rgbOf(mixColor(COLOR_DEEPSEEK_BASE, COLOR_DEEPSEEK_CYAN, (t - ENERGY_START) / (ENERGY_END - ENERGY_START)))
    return rgbOf(mixColor(COLOR_DEEPSEEK_CYAN, COLOR_DEEPSEEK_ABYSS, (t - ENERGY_END) / (1 - ENERGY_END)))
  }
  if (t <= ENERGY_START) return rgbOf(COLOR_BLUE)
  if (t <= ENERGY_END) return rgbOf(mixColor(COLOR_BLUE, COLOR_VIOLET, (t - ENERGY_START) / (ENERGY_END - ENERGY_START)))
  return rgbOf(mixColor(COLOR_VIOLET, COLOR_DEEP, (t - ENERGY_END) / (1 - ENERGY_END)))
}

/** The fill's gradient: blue on the left, the position's own colour at the knob. */
function fillBackgroundFor(pct, theme = 'codex') {
  const start = theme === 'deepseek' ? rgbOf(COLOR_DEEPSEEK_BASE) : rgbOf(COLOR_BLUE)
  return `linear-gradient(90deg, ${start}, ${fillColorFor(pct, theme)})`
}

/**
 * Whether a level means "reasoning off".
 *
 * DeepSeek spells it id `off` and name `Off`, but the id belongs to the provider, so both
 * are checked, plus the spellings other providers use. An off level keeps the shell's own
 * grey: the caller writes an empty colour, which is what clears an inline colour.
 */
function isOffLevel(level) {
  if (!level) return false
  return [level.id, level.name].some((candidate) => {
    if (typeof candidate !== 'string') return false
    const flat = candidate.replace(/\s+/gu, '').toLowerCase()
    return flat === 'off' || flat === 'none' || flat === '关闭' || flat === '无'
  })
}

/** The value text's colour for a position: blue → violet/cyan, and nothing at all when off. */
function valueColorFor(pct, level, theme = 'codex') {
  if (isOffLevel(level)) return ''
  if (theme === 'deepseek') {
    return rgbOf(mixColor(COLOR_DEEPSEEK_BASE, COLOR_DEEPSEEK_TEXT, energyFor(pct)))
  }
  return rgbOf(mixColor(COLOR_BLUE, COLOR_TEXT_VIOLET, energyFor(pct)))
}

/**
 * The energy at a position, 0..1: the whole nebula-and-stars effect is driven by this one
 * number, and it is driven by *position*, not by the number of levels. Nothing lights up
 * before the second stop, so the left half stays a clean blue.
 */
function energyFor(pct) {
  return clamp01((clamp01(pct) - ENERGY_START) / (1 - ENERGY_START))
}

/**
 * The starfield's speed factor at a position.
 *
 * The middle of the track reads as 1× — "the speed that felt right" — and the top level as
 * 2×; to the left the same slope continues, floored at 0.35× so the field never freezes.
 */
function speedFor(pct) {
  return Math.min(2, Math.max(0.35, 3 * clamp01(pct) - 1))
}

/** How many of the 22 stars a position shows: the field thickens as energy rises. */
function particleCountFor(pct) {
  return Math.round(energyFor(pct) * EFFORT_STARS.length)
}

/** How bright and how large a star is, in [STARFIELD_MIN, 1]: brighter is also bigger. */
function starBrightnessFor(index) {
  return STARFIELD_MIN + (1 - STARFIELD_MIN) * starHash01(index, 61)
}

/**
 * How long a star takes to cross the whole track, in seconds.
 *
 * Speed follows the position — the top level crosses in 1.5s, the 1× level in 3s, the left
 * end in about 8.6s — with only ±8% between individual stars, so quicker stars never lap
 * slower ones into a queue.
 */
function starDurationFor(index, speedFactor) {
  const speed = Math.min(MAX_SPEED_FACTOR, Math.max(0.35, typeof speedFactor === 'number' ? speedFactor : MAX_SPEED_FACTOR))
  const spread = 1 - STARFIELD_DURATION_SPREAD + 2 * STARFIELD_DURATION_SPREAD * starHash01(index, 29)
  return (STARFIELD_DURATION_MEAN * MAX_SPEED_FACTOR) / speed * spread
}

/**
 * A star's phase, as a negative delay in seconds.
 *
 * The phase depends on the index only — never on how many stars are currently shown. Were
 * it `i / count`, dragging would rewrite the `animation-delay` of stars that are already
 * animating, and the whole field would shuffle on every energy step.
 */
function starDelayFor(index, duration) {
  const phase = EFFORT_STARS[index]?.phase ?? 0
  const jitter = starHash01(index, 53) * 0.03
  return -(((phase + jitter) % 1)) * duration
}

/** How many stars a position shows. */
function starCountFor(pct) {
  return particleCountFor(pct)
}

/**
 * The starfield layer's own opacity.
 *
 * The nebula's opacity *is* the energy, which is only 0.5 at the high level; stars nested
 * inside it would be halved with it and read as missing, so they ride their own layer with
 * a floor instead. "Appearing gradually" is expressed by the star count.
 */
function starLayerOpacityFor(pct) {
  return 0.6 + 0.4 * energyFor(pct)
}

/**
 * Where the knob's centre, the fill's end and every tick sit:
 * `radius + pct × (100% − diameter)`.
 *
 * Insetting by a radius at both ends is what keeps the circle whole: at either extreme its
 * centre is still inside the track's rounded cap, so the shell's `overflow: hidden` has
 * nothing to cut.
 */
function knobOffsetOf(pct) {
  const t = Math.round(clamp01(pct) * 10000) / 10000
  return `calc(${KNOB_RADIUS}px + ${t} * (100% - ${KNOB_RADIUS * 2}px))`
}

module.exports = { EMPTY_MODEL_SNAPSHOT, modelOf, effortLevelsOf, effectiveEffortId, indexOfLevel, clamp01, indexFromPct, pctFromIndex, EFFORT_STARS, starHash01, fillColorFor, fillBackgroundFor, isOffLevel, valueColorFor, energyFor, speedFor, particleCountFor, starBrightnessFor, starDurationFor, starDelayFor, starCountFor, starLayerOpacityFor, knobOffsetOf }
