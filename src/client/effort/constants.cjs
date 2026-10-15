/**
 * effort/constants.cjs — the slider's geometry, colour, motion and slot.
 */
/*
 * The reasoning-effort slider's geometry, colour and motion.
 *
 * These are declared **before** `PAGE_CSS` on purpose: the stylesheet interpolates
 * the three geometry constants, and a template literal that reads one before its
 * declaration bakes `undefinedpx` into the track's height — the track then collapses
 * to nothing on a real page while every assertion that reads the stylesheet still
 * passes. Keeping the constants above the sheet is what makes that impossible.
 *
 * The numbers themselves come from dsh-codex-effort-slider (MIT), whose slider this
 * control re-implements; the effects are meant to be indistinguishable from it, so
 * the constants are its constants and the class names below are its class names.
 */
/** Track height in px. The knob is the same diameter as the track — a ball in a tube. */
const TRACK_HEIGHT = 28
const KNOB_SIZE = TRACK_HEIGHT
/** Knob radius: the centre's travel is inset by this at both ends, so the circle is never clipped. */
const KNOB_RADIUS = KNOB_SIZE / 2
/** The extra block padding the effort row takes so the slider fits on its second line. */
const ROW_PADDING_BLOCK = '10px'
/** Write-back throttle while dragging, in ms. A release always lands immediately. */
const COMMIT_THROTTLE_MS = 120
/**
 * How many painted drag frames pass between updates of the ambience behind the knob.
 *
 * The knob, the fill's edge and its colour are the pointer's own geometry, and the starfield's
 * timing has to stay continuous — re-timing an animation mid-flight re-maps its progress, so a
 * stepped clock would make the field hop. The rest of what the position decides is a value rather
 * than a motion: the energy that drives the track's glow and the nebula's opacity, the field's
 * density, the stars' layer opacity. The stylesheet already eases every one of those over 0.2s,
 * so a step of ~18ms at 165Hz is inside the easing — while re-rastering a blur radius, repainting
 * the shell's own row and re-writing a layer's opacity 165 times a second is work the frame the
 * pointer needs is short of.
 */
const AMBIENCE_FRAME_EVERY = 3
/** How long a commit may stay unacknowledged before the display rolls back, in ms. */
const COMMIT_DEADLINE_MS = 10000
/** Backoff for a directory that is not ready yet: about nine seconds in total. */
const RETRY_DELAYS = [60, 240, 540, 960, 1500, 3000, 3000]
/**
 * How long the quota notice stands before it flips to the level's own name, in ms.
 *
 * Long enough to be read at a glance, short enough that the value is back where the user
 * expects it before the eye returns to it.
 */
const QUOTA_NOTICE_MS = 1000
/**
 * The starfield's base crossing time in seconds, and each star's share of spread around it.
 *
 * The base is what the fastest position (`MAX_SPEED_FACTOR`) crosses in: the top level
 * takes 1.5s, the level that reads as 1× takes 3s, and the left end about 8.6s. ±8% keeps
 * "some stars a little quicker" without letting a fast star lap a slow one into a clump.
 */
const STARFIELD_DURATION_MEAN = 1.5
const STARFIELD_DURATION_SPREAD = 0.08
/** The dimmest/smallest a star may be; 1 is the full 3px dot at full brightness. */
const STARFIELD_MIN = 0.5
/** The golden ratio, which spreads the stars' phases as a low-discrepancy sequence. */
const GOLDEN_RATIO = 0.6180339887498949
/** The fastest position factor, which the base crossing time is aligned to. */
const MAX_SPEED_FACTOR = 2
/** Reduced motion slows the stars by this factor rather than freezing them. */
const REDUCED_MOTION_SLOWDOWN = 2.6
/** Stars whose phases are neighbours must differ by this many height slots (1 slot = 4%). */
const MIN_HEIGHT_SLOTS = 3
/** Energy begins at the second stop and reaches full at the last one. */
const ENERGY_START = 1 / 3
const ENERGY_END = 2 / 3
/** Blue → violet → deep violet. The first stop to the second stays blue. */
const COLOR_BLUE = [77, 147, 248]
const COLOR_VIOLET = [147, 51, 234]
const COLOR_DEEP = [76, 29, 149]
/**
 * The value text's own violet end.
 *
 * Text cannot follow the fill down into `COLOR_DEEP`, which is nearly invisible on a
 * dark surface, so it stops at this mid violet: about 4.2:1 on white and 4.0:1 on the
 * dark chrome, so both palettes stay readable.
 */
const COLOR_TEXT_VIOLET = [139, 92, 246]
/** DeepSeek ocean theme palette: base cyan-blue → luminous bioluminescent cyan → abyssal blue. */
const COLOR_DEEPSEEK_BASE = [14, 165, 233]
const COLOR_DEEPSEEK_CYAN = [56, 189, 248]
const COLOR_DEEPSEEK_ABYSS = [3, 105, 161]
const COLOR_DEEPSEEK_TEXT = [2, 132, 199]
/** Google & Gemini quad-color theme palette: Google Blue #4285F4, Red #EA4335, Yellow #FBBC05, Green #34A853. */
const COLOR_GOOGLE_BLUE = [66, 133, 244]
const COLOR_GOOGLE_RED = [234, 67, 53]
const COLOR_GOOGLE_YELLOW = [251, 188, 5]
const COLOR_GOOGLE_GREEN = [52, 168, 83]
const COLOR_GEMINI_BASE = COLOR_GOOGLE_BLUE
const COLOR_GEMINI_YELLOW = COLOR_GOOGLE_YELLOW
const COLOR_GEMINI_RED = COLOR_GOOGLE_RED
const COLOR_GEMINI_TEXT = COLOR_GOOGLE_RED
/*
 * The Claude theme is not a palette over the starfield: it is Claude thinking, drawn as a slider.
 *
 * The knob is the Claude spark, and the position is how far it has bloomed — a seed at Off, then
 * six rays, nine and all twelve, the way Claude Code's spinner opens ("· ✢ ✳ ✶ ✻ ✽"). The track is a
 * groove pressed into paper, the fill is clay, and the clay thinks out loud: Claude Code's
 * spinner words ride behind the knob. The top level is `ultrathink`, the CLI's magic word, and
 * it gets what the CLI gives it — the rainbow — on a fill that has darkened into a kiln.
 */
/**
 * Claude clay palette. The fill runs from a pale wet clay at its start to the position's own
 * terracotta at the knob: the orange the Claude spark is drawn in (#D97757), its darker Crail
 * (#C15F3C), and an ember for the last stretch before the kiln takes over.
 *
 * The orange stands where the blue does, at the same contrast (3.1:1 on white). Crail is the value
 * text's end for the reason `COLOR_TEXT_VIOLET` exists: its luminance is that violet's to within
 * a thousandth, so it keeps the same 4.2:1 on white and 4.0:1 on the dark chrome.
 */
const COLOR_CLAUDE_CLAY = [238, 184, 156]
const COLOR_CLAUDE_BASE = [217, 119, 87]
const COLOR_CLAUDE_CRAIL = [193, 95, 60]
const COLOR_CLAUDE_EMBER = [160, 66, 36]
const COLOR_CLAUDE_TEXT = COLOR_CLAUDE_CRAIL
/**
 * `ultrathink`'s rainbow, as Claude Code paints the word: warm red round to orchid, soft enough
 * to sit on the kiln without shouting. The word flows through it, and the spark's rays take one
 * colour each.
 */
const CLAUDE_RAINBOW = Object.freeze(['#eb5f57', '#f58b57', '#fac35f', '#91c882', '#82aadc', '#9b82c8', '#c882b4'])
/**
 * The Claude spark the knob carries: twelve round-capped rays from one hub, each its own length
 * and a few degrees off the even spacing, which is what makes it read as drawn rather than as a
 * sun. Each ray is `[degrees clockwise from twelve o'clock, length]`, in the 24-unit box the
 * spark's `viewBox` is centred on.
 */
const CLAUDE_SPARK_RAYS = Object.freeze([
  [0, 10.2], [32, 7.4], [58, 9.4], [91, 8.2], [121, 10], [148, 7.2],
  [182, 9.6], [211, 8], [239, 10.2], [270, 7.6], [301, 9.2], [329, 8.4],
])
/**
 * The order the rays open in: the six long rays first, an asterisk (✶), then three of the short
 * ones between them, then the last three, which complete the spark.
 *
 * Six first, not four: a four-rayed knob reads as + or ×, and on a control those say "add" and
 * "close" — the spin passes through both.
 */
const CLAUDE_SPARK_GROUPS = Object.freeze([
  Object.freeze([0, 2, 4, 6, 8, 10]),
  Object.freeze([1, 5, 9]),
  Object.freeze([3, 7, 11]),
])
/**
 * The bloom at which each group starts to open, the lag between neighbouring rays of one group,
 * and the bloom one ray takes to open fully. Each group is complete by the stop that shows it:
 * the first by a third, the second by two thirds, the last by the end of the track.
 */
const CLAUDE_GROUP_OPENS = Object.freeze([0.02, 0.36, 0.69])
const CLAUDE_RAY_STAGGER = 0.02
const CLAUDE_RAY_UNFURL = 0.2
/**
 * A level that reasons at all keeps its first group open. A model whose levels start at "low"
 * puts that level at the left end of the track, and a seed there would say "off" about a level
 * that thinks.
 */
const CLAUDE_BLOOM_FLOOR = 1 / 3
/**
 * Claude Code's own spinner words, spelled as the CLI spells them, ellipsis and all. They stay in
 * English in both locales on purpose: they are the brand's voice, the way the ✻ is its mark.
 * A calm set for the lower half of the track, a deep set above it, and the magic word on top;
 * the set's name is also what the stylesheet keys it by.
 */
const CLAUDE_VERBS = Object.freeze({
  calm: Object.freeze(['Musing…', 'Mulling…', 'Vibing…']),
  deep: Object.freeze(['Pondering…', 'Percolating…', 'Ruminating…']),
  ultra: Object.freeze(['ultrathink']),
})
/**
 * The room, in px, a set needs before it is shown at all: its widest word, measured in the
 * stack's italic, plus a hair. A word with less room than that would show only its tail — "ing…"
 * reads as a glitch, not as a word arriving — so the set waits for room instead. `ultrathink`
 * needs no entry: on the top level the clay spans the track.
 */
const CLAUDE_VERB_ROOM = Object.freeze({ calm: 55, deep: 78 })
/** Where on the track the calm words give way to the deep ones. */
const CLAUDE_DEEP_FROM = 0.5
/** The gap the words keep from the knob's edge, in px, so the last letter never runs under it. */
const CLAUDE_VERB_GAP = 6
/** The storage key and themes for slider visual styling: Codex starfield vs DeepSeek ocean whale vs Gemini quad-color aurora vs Claude blooming spark. */
const EFFORT_THEME_KEY = 'dsh-custom-theme.effort-theme'
const EFFORT_THEME_DEFAULT = 'codex'
const EFFORT_THEMES = Object.freeze(['codex', 'deepseek', 'gemini', 'claude'])

/** Normalize an arbitrary theme string to a supported theme. */
function normalizeEffortTheme(theme) {
  return EFFORT_THEMES.includes(theme) ? theme : EFFORT_THEME_DEFAULT
}

/** Read the stored slider theme, defaulting to 'codex'. */
function readSavedEffortTheme() {
  try {
    if (typeof localStorage === 'undefined') return EFFORT_THEME_DEFAULT
    const value = localStorage.getItem(EFFORT_THEME_KEY)
    return normalizeEffortTheme(value)
  } catch {
    return EFFORT_THEME_DEFAULT
  }
}

/** Persist the slider theme and notify active sliders in real time. */
function writeSavedEffortTheme(theme) {
  const normalized = normalizeEffortTheme(theme)
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(EFFORT_THEME_KEY, normalized)
    }
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('dsh-effort-theme-change', { detail: normalized }))
    }
  } catch {
    // Storage sandboxed or unavailable
  }
}
/** The effort row's captions, as the shell spells them; the second one is the fallback. */
const EFFORT_ROW_LABELS = ['推理等级', 'Effort']
const EFFORT_SLOT = 'conversation.input.right'
const EFFORT_ENTRY_ID = 'dsh-custom-theme-effort'
const EFFORT_ENTRY_ORDER = 40
/** The class the slider's own nodes carry, and the marker a foreign copy of it leaves. */
const EFFORT_HOST_PART = 'host'

module.exports = {
  TRACK_HEIGHT,
  KNOB_SIZE,
  KNOB_RADIUS,
  ROW_PADDING_BLOCK,
  COMMIT_THROTTLE_MS,
  AMBIENCE_FRAME_EVERY,
  COMMIT_DEADLINE_MS,
  RETRY_DELAYS,
  QUOTA_NOTICE_MS,
  STARFIELD_DURATION_MEAN,
  STARFIELD_DURATION_SPREAD,
  STARFIELD_MIN,
  GOLDEN_RATIO,
  MAX_SPEED_FACTOR,
  REDUCED_MOTION_SLOWDOWN,
  MIN_HEIGHT_SLOTS,
  ENERGY_START,
  ENERGY_END,
  COLOR_BLUE,
  COLOR_VIOLET,
  COLOR_DEEP,
  COLOR_TEXT_VIOLET,
  COLOR_DEEPSEEK_BASE,
  COLOR_DEEPSEEK_CYAN,
  COLOR_DEEPSEEK_ABYSS,
  COLOR_DEEPSEEK_TEXT,
  COLOR_GOOGLE_BLUE,
  COLOR_GOOGLE_RED,
  COLOR_GOOGLE_YELLOW,
  COLOR_GOOGLE_GREEN,
  COLOR_GEMINI_BASE,
  COLOR_GEMINI_YELLOW,
  COLOR_GEMINI_RED,
  COLOR_GEMINI_TEXT,
  COLOR_CLAUDE_CLAY,
  COLOR_CLAUDE_BASE,
  COLOR_CLAUDE_CRAIL,
  COLOR_CLAUDE_EMBER,
  COLOR_CLAUDE_TEXT,
  CLAUDE_RAINBOW,
  CLAUDE_SPARK_RAYS,
  CLAUDE_SPARK_GROUPS,
  CLAUDE_GROUP_OPENS,
  CLAUDE_RAY_STAGGER,
  CLAUDE_RAY_UNFURL,
  CLAUDE_BLOOM_FLOOR,
  CLAUDE_VERBS,
  CLAUDE_VERB_ROOM,
  CLAUDE_DEEP_FROM,
  CLAUDE_VERB_GAP,
  EFFORT_THEME_KEY,
  EFFORT_THEME_DEFAULT,
  EFFORT_THEMES,
  normalizeEffortTheme,
  readSavedEffortTheme,
  writeSavedEffortTheme,
  EFFORT_ROW_LABELS,
  EFFORT_SLOT,
  EFFORT_ENTRY_ID,
  EFFORT_ENTRY_ORDER,
  EFFORT_HOST_PART,
}
