/**
 * appearance/constants.cjs — the appearance choices: line spacing, stream ink and the stored payload.
 */

/** localStorage key holding the conversation-stream choices. */
const APPEARANCE_KEY = 'dsh-custom-theme.appearance'
/** Extra line spacing the user may add, in px, on top of the shell's line height. */
const LINE_GAP_MIN = -4
const LINE_GAP_MAX = 8
const LINE_GAPS = Array.from({ length: LINE_GAP_MAX - LINE_GAP_MIN + 1 }, (_, index) => LINE_GAP_MIN + index)

/** Streaming ink: how long the newest characters take to settle, and how faint they start. */
const STREAM_FADE_DURATION_DEFAULT = 520
const STREAM_FADE_DURATION_MIN = 150
const STREAM_FADE_DURATION_MAX = 1500
const STREAM_FADE_DURATION_STEP = 50
const STREAM_FADE_INK_DEFAULT = 0.3
const STREAM_FADE_INK_MIN = 0.05
const STREAM_FADE_INK_MAX = 1

/** Auto-expand reasoning mode options. */
const REASONING_EXPAND_OPTIONS = ['streaming', 'keep', 'always', 'off']
const REASONING_EXPAND_DEFAULT = 'streaming'

/** Read the saved conversation-stream choices, clamped to what the runtime accepts. */
function readSavedAppearance() {
  let raw = {}
  try {
    const parsed = JSON.parse(localStorage.getItem(APPEARANCE_KEY) ?? '{}')
    if (parsed !== null && typeof parsed === 'object') raw = parsed
  } catch {
    // A corrupt entry falls back to the shell's own rendering.
  }
  const validNumber = (val) => (typeof val === 'number' && Number.isFinite(val)) || (typeof val === 'string' && val.trim() !== '' && Number.isFinite(Number(val)))
  const gap = validNumber(raw.lineGap) ? Number(raw.lineGap) : NaN
  const duration = validNumber(raw.streamingFadeDuration) ? Number(raw.streamingFadeDuration) : NaN
  const ink = validNumber(raw.streamingFadeInk) ? Number(raw.streamingFadeInk) : NaN
  const rawExpand = typeof raw.reasoningExpand === 'string' ? raw.reasoningExpand.trim() : ''
  return {
    lineGap: Number.isFinite(gap) ? Math.min(LINE_GAP_MAX, Math.max(LINE_GAP_MIN, Math.round(gap))) : 0,
    streamingFadeDuration: Number.isFinite(duration)
      ? Math.min(STREAM_FADE_DURATION_MAX, Math.max(STREAM_FADE_DURATION_MIN, Math.round(duration)))
      : STREAM_FADE_DURATION_DEFAULT,
    streamingFadeInk: Number.isFinite(ink)
      ? Math.min(STREAM_FADE_INK_MAX, Math.max(STREAM_FADE_INK_MIN, Math.round(ink * 100) / 100))
      : STREAM_FADE_INK_DEFAULT,
    reasoningExpand: REASONING_EXPAND_OPTIONS.includes(rawExpand)
      ? rawExpand
      : REASONING_EXPAND_DEFAULT,
  }
}

module.exports = { APPEARANCE_KEY, LINE_GAP_MIN, LINE_GAP_MAX, LINE_GAPS, STREAM_FADE_DURATION_DEFAULT, STREAM_FADE_DURATION_MIN, STREAM_FADE_DURATION_MAX, STREAM_FADE_DURATION_STEP, STREAM_FADE_INK_DEFAULT, STREAM_FADE_INK_MIN, STREAM_FADE_INK_MAX, REASONING_EXPAND_OPTIONS, REASONING_EXPAND_DEFAULT, readSavedAppearance }
