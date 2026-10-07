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
/** The storage key and themes for slider visual styling: Codex starfield vs DeepSeek ocean whale. */
const EFFORT_THEME_KEY = 'dsh-custom-theme.effort-theme'
const EFFORT_THEME_DEFAULT = 'codex'
const EFFORT_THEMES = Object.freeze(['codex', 'deepseek'])

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
