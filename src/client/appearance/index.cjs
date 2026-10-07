/**
 * appearance/index.cjs — the font, line-gap and streaming-fade sheet.
 */

module.exports = function (deps) {
  const { ctx, tickReasoningExpand, tickStreamInk } = deps

  const { readSavedAppearance } = require('./constants.cjs')

/**
 * Stylesheet carrying the conversation-stream choices.
 *
 * The shell declares the font families on `:root` and the line-height delta on
 * `body`, so each override has to be declared on the same element the shell
 * uses: a value inherited from `:root` loses to the shell's own `body` rule.
 */
/** Removal of that sheet, handed to the composition root's teardown. */
let cleanupFontStyle = () => {}
const fontStyle = document.createElement('style')
fontStyle.dataset.plugin = 'dsh-custom-theme'
fontStyle.dataset.role = 'appearance'
cleanupFontStyle = () => { fontStyle.remove() }
document.head.append(fontStyle)

let currentAppearanceSettings = readSavedAppearance()

/**
 * Declare the conversation-stream overrides, or withdraw a field by leaving it
 * out once it is back at the shell's default.
 * @param settings - Choices from {@link readSavedAppearance}.
 */
function applyAppearance(settings) {
  currentAppearanceSettings = settings
  const root = []
  const body = []
  if (settings.fontFamily !== '') root.push(`--dsw-font-family: ${settings.fontFamily};`)
  if (settings.codeFontFamily !== '') root.push(`--ds-font-family-code: ${settings.codeFontFamily};`)
  // The shell derives every content line height from this delta, so adding to
  // it keeps the whole stream in step instead of pinning one absolute height.
  if (settings.lineGap !== 0) {
    body.push(`--dsh-content-font-delta: calc(var(--dsh-content-font-size, 14px) - 14px + ${settings.lineGap}px);`)
  }
  // Raised specificity, not source order: the shell installs its own palette
  // styles at boot and may do so after this plugin runs, so an equal-specificity
  // `:root`/`body` rule would lose to it depending on who ran last.
  fontStyle.textContent = [
    root.length > 0 ? `html:root {\n  ${root.join('\n  ')}\n}` : '',
    body.length > 0 ? `html body {\n  ${body.join('\n  ')}\n}` : '',
  ].filter(Boolean).join('\n')

  tickStreamInk()
  tickReasoningExpand()
}

  return {
    applyAppearance,
    // Read by features that re-read the live choices instead of a React seat:
    // the ink and the reasoning expansion consult it on every tick.
    settings: () => currentAppearanceSettings,
    disposeFontStyle: () => cleanupFontStyle(),
  }
}
