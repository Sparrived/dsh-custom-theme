/**
 * working/constants.cjs — the working-text model: effects, intervals, shimmer styles and colours.
 */
const WORKING_KEY = 'dsh-custom-theme.working'
/** Caps the official indicator accepts: at most 12 phrases of 120 characters. */
const WORKING_MAX_TEXTS = 12
const WORKING_MAX_LENGTH = 120
/** Rotation intervals offered, in ms. */
const WORKING_INTERVALS = [1200, 1800, 2400, 3000, 4000, 6000, 8000, 10000]
const WORKING_INTERVAL_DEFAULT = 2400
/**
 * The text effects, ported from Deeptop's running indicator.
 *
 * `official` is this plugin's own addition and its default: nothing is injected, so
 * the shell keeps drawing and animating its label exactly as it ships. The rest are
 * Deeptop's, in its order, minus the two — 呼吸 and 发光 — that its look could not be
 * given without filling the glyphs.
 */
const WORKING_EFFECTS = ['official', 'shimmer', 'none', 'hidden']
/** The locale key naming each effect, in the order the select offers them. */
const WORKING_EFFECT_LABELS = {
  official: 'workEffectOfficial',
  shimmer: 'workEffectShimmer',
  none: 'workEffectNone',
  hidden: 'workEffectHidden',
}
/**
 * The two ways the shimmer's band is coloured.
 *
 * `matte` is the official look: one flat tint sweeping the label. `rainbow` keeps
 * Deeptop's spectrum, but inside that band rather than over the whole label.
 */
const WORKING_SHIMMER_STYLES = ['matte', 'rainbow']
/** The locale key naming each shimmer style. */
const WORKING_SHIMMER_LABELS = { matte: 'workShimmerMatte', rainbow: 'workShimmerRainbow' }
const WORKING_EFFECT_DEFAULT = 'official'
const WORKING_SHIMMER_DEFAULT = 'matte'
/** Deeptop's own default colours, which its effect rules are written around. */
const WORKING_COLOR_DEFAULT = '#4176e6'
const WORKING_SWEEP_DEFAULT = '#5ee0ff'
/** The only colour shape accepted, because it is the only one a picker reports. */
const WORKING_HEX = /^#[0-9a-f]{6}$/i

/** Normalize a phrase list to the shape the official indicator accepts. */
function normalizeWorkingTexts(value) {
  return (Array.isArray(value) ? value : [])
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim().slice(0, WORKING_MAX_LENGTH))
    .filter(Boolean)
    .slice(0, WORKING_MAX_TEXTS)
}

/** Read one stored colour, or the fallback when it is missing or is not a colour. */
function readWorkingColor(value, fallback) {
  return typeof value === 'string' && WORKING_HEX.test(value) ? value.toLowerCase() : fallback
}

/** Read the saved working-indicator choices. */
function readSavedWorking() {
  let raw = {}
  try {
    const parsed = JSON.parse(localStorage.getItem(WORKING_KEY) ?? '{}')
    if (parsed !== null && typeof parsed === 'object') raw = parsed
  } catch {
    // A corrupt entry falls back to the official label.
  }
  const interval = Number(raw.interval)
  return {
    texts: normalizeWorkingTexts(raw.texts),
    interval: WORKING_INTERVALS.includes(interval) ? interval : WORKING_INTERVAL_DEFAULT,
    // An unknown effect or shimmer is dropped rather than passed on: both end up in
    // a stylesheet, and only the listed ones have rules that reach it.
    effect: WORKING_EFFECTS.includes(raw.effect) ? raw.effect : WORKING_EFFECT_DEFAULT,
    shimmer: WORKING_SHIMMER_STYLES.includes(raw.shimmer) ? raw.shimmer : WORKING_SHIMMER_DEFAULT,
    color: readWorkingColor(raw.color, WORKING_COLOR_DEFAULT),
    sweep: readWorkingColor(raw.sweep, WORKING_SWEEP_DEFAULT),
  }
}
/**
 * Keys whose text is the running indicator's own wording.
 *
 * `chat.deepDivingFor` is what a live turn draws — 「深度求索中，用时 13秒 ···」 —
 * and `chat.deepDiving` is its parameter-free sibling: the wording the row shows
 * before its clock has a start time, and the one the visually hidden status span
 * reads out. Both live in the shell's `chat` namespace.
 */
const RUNNING_LABEL_KEY = /\.deepDiving(?:For)?$/

/**
 * How long a gap between label reads means the turn ended, in ms.
 *
 * The shell re-reads the label on its own one-second clock while a turn runs, so
 * a wider gap can only mean the label stopped being drawn.
 */
const PHRASE_STREAK_GAP = 2500

/**
 * The running bar, and this page's own sample of it.
 *
 * Both carry the two declarations an effect is made of: the label's own colour, and
 * the colour of the band that sweeps it. The sample reads the same token the shell's
 * band does, so one rule dresses both.
 */
const WORKING_BAR = '[data-chat-running], .dct-work-preview'
/**
 * The band the shell sweeps the label with.
 *
 * The shipped build draws it as a decorative copy of the text — an `aria-hidden` span
 * inside the label, masked to a soft travelling band and driven by two animations —
 * and an older one marks the label `data-text-shimmer` instead. The sample carries its
 * own copy of that structure. This is what `none` switches off, because a still label
 * with a band still gliding over it is not still.
 */
const WORKING_BAND = '[data-chat-running] [data-shimmer] > span[aria-hidden="true"], '
  + '[data-chat-running] [data-text-shimmer] > span[aria-hidden="true"], '
  + '.dct-work-effect .dct-work-sweep'
/**
 * The text inside that band.
 *
 * A spectrum cannot be expressed as one colour, so the rainbow style fills the band's
 * own copy of the glyphs with it rather than tinting them through the token. It is
 * still only visible through the band's mask, which is what keeps the look matte: the
 * label underneath keeps its solid colour.
 */
const WORKING_BAND_TEXT = '[data-chat-running] [data-shimmer] > span[aria-hidden="true"] [data-shimmer-text], '
  + '[data-chat-running] [data-text-shimmer] > span[aria-hidden="true"] [data-shimmer-text], '
  + '.dct-work-effect .dct-work-sweep-text'
/** Deeptop's spectrum, which its 七彩光 sweep travels. */
const WORKING_SPECTRUM = 'linear-gradient(100deg, #ff5a5a 0%, #ffb03a 7%, #ffe95a 14%, #4ade80 21%, #38bdf8 28%, #818cf8 35%, #e879f9 42%, #ff5a5a 50%, #ffb03a 57%, #ffe95a 64%, #4ade80 71%, #38bdf8 78%, #818cf8 85%, #e879f9 92%, #ff5a5a 100%)'

/**
 * The stylesheet that gives the running label its chosen effect.
 *
 * The shimmer here is the official mechanic rather than Deeptop's: the glyphs keep one
 * solid colour and a soft masked band glides over them, which is what reads as matte.
 * Deeptop filled the glyphs themselves with a travelling gradient, and that is what
 * made its look glossier than the shell's own — so the band is the only thing that
 * takes a colour, through the very token the shell paints its own sweep with. Every
 * rule is `!important`, because the shell's own label rules are already in the
 * document and this sheet is injected after them rather than instead of them.
 * @param working - Normalized working-indicator choices.
 * @returns The stylesheet text, empty while the shipped look is the choice.
 */
function workingEffectCss(working) {
  if (working.effect === 'official') return ''
  // `hidden` is about the bar as a whole and needs no rule on the label itself; its
  // text is still announced, because the span carrying the announcement is kept.
  if (working.effect === 'hidden') {
    return `[data-chat-running] > :not([role="status"]) { display: none !important; }\n`
  }
  const rules = [
    // The label's colour, and the band's: the shell paints its sweep with
    // `--dsw-alias-label-shimmer`, and the sample's own band reads that token too.
    `${WORKING_BAR} { color: ${working.color} !important; --dsw-alias-label-shimmer: ${working.sweep} !important; }`,
  ]
  if (working.effect === 'shimmer') {
    // No `prefers-reduced-motion` rule is needed: the shell stops its own band for
    // that preference, and the band is the whole animation here.
    if (working.shimmer === 'rainbow') {
      rules.push(
        `${WORKING_BAND_TEXT} {`
        + ` background-image: ${WORKING_SPECTRUM} !important;`
        // One tile across the band's own copy of the text. The shell's mask and its
        // two animations already travel; a gradient travelling a second time inside a
        // moving window would leave the colour standing still.
        + ' background-repeat: no-repeat !important;'
        + ' background-size: 100% 100% !important;'
        + ' background-clip: text !important;'
        + ' -webkit-background-clip: text !important;'
        + ' -webkit-text-fill-color: transparent !important; }',
      )
    }
  } else {
    // Static: the label keeps its colour and the band stops being drawn at all.
    rules.push(`${WORKING_BAND} { display: none !important; }`)
  }
  return `${rules.join('\n')}\n`
}

module.exports = { WORKING_KEY, WORKING_MAX_TEXTS, WORKING_MAX_LENGTH, WORKING_INTERVALS, WORKING_INTERVAL_DEFAULT, WORKING_EFFECTS, WORKING_EFFECT_LABELS, WORKING_SHIMMER_STYLES, WORKING_SHIMMER_LABELS, WORKING_EFFECT_DEFAULT, WORKING_SHIMMER_DEFAULT, WORKING_COLOR_DEFAULT, WORKING_SWEEP_DEFAULT, WORKING_HEX, normalizeWorkingTexts, readWorkingColor, readSavedWorking, RUNNING_LABEL_KEY, PHRASE_STREAK_GAP, WORKING_BAR, WORKING_BAND, WORKING_BAND_TEXT, WORKING_SPECTRUM, workingEffectCss }
