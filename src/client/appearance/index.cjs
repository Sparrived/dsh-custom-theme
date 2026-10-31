/**
 * appearance/index.cjs — the line-gap sheet.
 */

module.exports = function () {
/**
 * Stylesheet carrying the conversation-stream choices.
 *
 * The shell derives every content line height from `--dsh-content-font-delta` on
 * `body`, so the extra spacing has to be declared on the same element: a value
 * inherited from `:root` loses to the shell's own `body` rule.
 */
/** Removal of that sheet, handed to the composition root's teardown. */
let cleanupAppearanceStyle = () => {}
const appearanceStyle = document.createElement('style')
appearanceStyle.dataset.plugin = 'dsh-custom-theme'
appearanceStyle.dataset.role = 'appearance'
cleanupAppearanceStyle = () => { appearanceStyle.remove() }
document.head.append(appearanceStyle)

/**
 * Declare the line-spacing override, or withdraw it once it is back at the
 * shell's default.
 * @param settings - Choices from {@link readSavedAppearance}.
 */
function applyAppearance(settings) {
  // The shell derives every content line height from this delta, so adding to
  // it keeps the whole stream in step instead of pinning one absolute height.
  // Raised specificity, not source order: the shell installs its own styles at
  // boot and may do so after this plugin runs, so an equal-specificity `body`
  // rule would lose to it depending on who ran last.
  appearanceStyle.textContent = settings.lineGap === 0
    ? ''
    : `html body {\n  --dsh-content-font-delta: calc(var(--dsh-content-font-size, 14px) - 14px + ${settings.lineGap}px);\n}`
}

  return {
    applyAppearance,
    disposeStyle: () => cleanupAppearanceStyle(),
  }
}
