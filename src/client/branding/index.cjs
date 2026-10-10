/**
 * branding/index.cjs — the branding feature: the sheet, the wording, the seats and the hooks.
 */
/**
 * The four things a branding choice reaches, and why they are four:
 *
 * - the hero's wording cannot be replaced at a seat (the shell declares none for it),
 *   so it goes through the shell's lookup;
 * - the three marks and the wordmark do have seats, so they are filled there;
 * - a custom stylesheet is just text, so it becomes this feature's own `<style>`;
 * - the region hooks are attributes on elements the shell owns, so a pass stamps them.
 *
 * The feature owns all four and hands the entry one `applyBranding`, which is what the
 * settings row calls with the choice it just drew.
 */
const createBrandSlots = require('./slots.cjs')
const createHeroWording = require('./locale.cjs')
const createRegionTags = require('./tags.cjs')
const { brandingCss, normalizeBranding } = require('./constants.cjs')
const { readSavedBranding, writeSavedBranding } = require('./store.cjs')

/**
 * @param deps - `ctx` (the shell's context) and `locale` (its dictionary service).
 * @returns `{ applyBranding, armWording, dispose }`.
 */
module.exports = function (deps) {
  const { ctx, locale } = deps

  const sheet = document.createElement('style')
  sheet.dataset.plugin = 'dsh-custom-theme'
  sheet.dataset.role = 'branding'
  document.head.append(sheet)

  /** The choices in force, read by every part of the feature through this closure. */
  let settings = readSavedBranding()

  const slots = createBrandSlots({ ctx })
  const wording = createHeroWording({
    locale,
    settings: () => settings,
    warn: (message) => ctx.logger.warn('%s', message),
  })
  const tags = createRegionTags()

  slots.bind()

  /** Draw the choices in force over the shell's own surfaces. */
  function sync() {
    sheet.textContent = brandingCss(settings)
    slots.sync(settings)
    wording.arm()
  }

  /**
   * Store one choice and put it to work.
   *
   * This is the whole surface the settings row needs: it hands over the choice it
   * just drew, and the sheet, the seats and the wording follow from it.
   * @param next - The complete choice set, as the row holds it.
   */
  function applyBranding(next) {
    settings = normalizeBranding(next)
    writeSavedBranding(settings)
    sync()
  }

  sync()
  tags.start()

  /** Undo everything this feature installed. */
  function dispose() {
    tags.stop()
    slots.dispose()
    wording.dispose()
    sheet.remove()
  }

  return {
    applyBranding,
    // The running-label effect re-installs its own lookup patch, which is the one event
    // that can drop the hero's wrapper; the entry asks for it again right afterwards.
    armWording: () => wording.arm(),
    dispose,
  }
}
