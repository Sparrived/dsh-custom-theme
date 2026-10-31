/**
 * appearance/constants.cjs — the appearance choices: line spacing and the stored payload.
 */

/** localStorage key holding the conversation-stream choices. */
const APPEARANCE_KEY = 'dsh-custom-theme.appearance'
/** Extra line spacing the user may add, in px, on top of the shell's line height. */
const LINE_GAP_MIN = -4
const LINE_GAP_MAX = 8
const LINE_GAPS = Array.from({ length: LINE_GAP_MAX - LINE_GAP_MIN + 1 }, (_, index) => LINE_GAP_MIN + index)

/** Read the saved line-spacing choice, clamped to what the runtime accepts. */
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
  return {
    lineGap: Number.isFinite(gap) ? Math.min(LINE_GAP_MAX, Math.max(LINE_GAP_MIN, Math.round(gap))) : 0,
  }
}

module.exports = { APPEARANCE_KEY, LINE_GAP_MIN, LINE_GAP_MAX, LINE_GAPS, readSavedAppearance }
