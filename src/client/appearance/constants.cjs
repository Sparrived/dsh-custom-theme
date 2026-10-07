/**
 * appearance/constants.cjs — the appearance choices: presets, ranges and the stored payload.
 */
const { h } = require('../shared/element.cjs')

/** localStorage key holding the conversation-stream choices. */
const APPEARANCE_KEY = 'dsh-custom-theme.appearance'
/** Extra line spacing the user may add, in px, on top of the shell's line height. */
const LINE_GAP_MIN = -4
const LINE_GAP_MAX = 8
const LINE_GAPS = Array.from({ length: LINE_GAP_MAX - LINE_GAP_MIN + 1 }, (_, index) => LINE_GAP_MIN + index)
/** Content font sizes the official runtime accepts (`FONT_SIZE_MIN`..`FONT_SIZE_MAX`). */
const FONT_SIZES = [12, 13, 14, 15, 16, 17]

/** Text stacks offered for the stream. The empty value leaves the shell's own. */
const TEXT_FONT_PRESETS = [
  { value: '', labelKey: 'fontFollow' },
  { value: '"Segoe UI Variable", "Segoe UI", "Microsoft YaHei UI", sans-serif', labelKey: 'fontSystem' },
  { value: '"Microsoft YaHei UI", "Microsoft YaHei", sans-serif', labelKey: 'fontYahei' },
  { value: '"Noto Sans SC", "Noto Sans CJK SC", sans-serif', labelKey: 'fontNoto' },
  { value: 'Georgia, "Times New Roman", serif', labelKey: 'fontSerif' },
]

/** Code stacks offered for fenced blocks. */
const CODE_FONT_PRESETS = [
  { value: '', labelKey: 'fontFollow' },
  { value: '"Cascadia Mono", Consolas, monospace', labelKey: 'codeCascadia' },
  { value: '"JetBrains Mono", "Cascadia Mono", Consolas, monospace', labelKey: 'codeJetbrains' },
  { value: '"Sarasa Mono SC", "Cascadia Mono", Consolas, monospace', labelKey: 'codeSarasa' },
]

/**
 * Preset options, plus the stored value itself when it is not one of them, so a
 * stack an earlier version or a hand-edited entry left behind stays selectable
 * instead of silently resetting.
 * @param presets - Offered stacks.
 * @param current - The stored stack.
 * @param t - The page's translate seat.
 * @returns Option elements.
 */
function fontOptions(presets, current, t) {
  const options = presets.map((preset) => h('option', { key: preset.value, value: preset.value }, t(preset.labelKey)))
  if (current !== '' && !presets.some((preset) => preset.value === current)) {
    options.push(h('option', { key: 'custom', value: current }, t('fontCustom')))
  }
  return options
}

/** Strip the characters that would end a declaration early. */
function cleanFont(value) {
  return typeof value === 'string' ? value.replace(/[;{}]/gu, '').trim() : ''
}

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
    fontFamily: cleanFont(raw.fontFamily),
    codeFontFamily: cleanFont(raw.codeFontFamily),
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

module.exports = { APPEARANCE_KEY, LINE_GAP_MIN, LINE_GAP_MAX, LINE_GAPS, FONT_SIZES, TEXT_FONT_PRESETS, CODE_FONT_PRESETS, fontOptions, cleanFont, STREAM_FADE_DURATION_DEFAULT, STREAM_FADE_DURATION_MIN, STREAM_FADE_DURATION_MAX, STREAM_FADE_DURATION_STEP, STREAM_FADE_INK_DEFAULT, STREAM_FADE_INK_MIN, STREAM_FADE_INK_MAX, REASONING_EXPAND_OPTIONS, REASONING_EXPAND_DEFAULT, readSavedAppearance }
