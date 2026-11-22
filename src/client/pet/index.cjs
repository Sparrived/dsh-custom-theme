/**
 * pet/index.cjs — the companion perched on the input card.
 *
 * Finding the card is the whole job: the shell draws it after this plugin boots and
 * replaces it on a session switch, so the search is a bounded retry (the pattern the
 * branding hooks already use) rather than an observer over the whole document.
 */
const { LOCALE_NS } = require('../i18n/dictionary.cjs')
const { PET_CSS } = require('./styles.cjs')
const { KEEPALIVE_MS, RETRY_MS, readPetEnabled } = require('./constants.cjs')
const { createPetCard } = require('./view.cjs')
const store = require('./store.cjs')

/**
 * @param deps - The composition root's context and teardown signal.
 * @returns `{ dispose }`.
 */
function createPet({ ctx }) {
  // A host that cannot build SVG (a test double, or a shell without the DOM APIs)
  // gets no companion and no error: the rest of the plugin still boots.
  if (typeof document.createElementNS !== 'function' || typeof window.setTimeout !== 'function') {
    return { dispose() {} }
  }
  const style = document.createElement('style')
  style.dataset.plugin = 'dsh-custom-theme'
  style.dataset.role = 'pet'
  style.textContent = PET_CSS
  document.head.append(style)

  const t = typeof ctx.locale?.bind === 'function' ? ctx.locale.bind(LOCALE_NS) : (key) => key
  let card = createPetCard({ doc: document, label: t('petLabel') })
  let timer = null
  let beat = null
  let disposed = false

  /** Put the perch on the input card, if the card is there and the row is on. */
  function attach() {
    if (disposed) return
    if (!readPetEnabled()) {
      card.element.remove()
      return
    }
    const host = document.querySelector('[data-composer-card]')
    if (host === null) {
      // Not drawn yet: try again in a moment rather than spinning.
      if (timer !== null) return
      timer = window.setTimeout(() => { timer = null; attach() }, RETRY_MS)
      return
    }
    if (host.contains(card.element)) { card.refresh(); return }
    if (host.style && window.getComputedStyle(host).position === 'static') host.style.position = 'relative'
    host.append(card.element)
    card.refresh()
  }

  /**
   * The shell replaces the whole input card when the user opens another session, and
   * the perch goes with it. A one-second liveness test puts it back: the test is a
   * single boolean while the companion is on screen, and only a replaced card costs a
   * lookup. A document observer would instead run on every mutation of every render.
   */
  function keepAlive() {
    if (disposed || card.element.isConnected) return
    if (timer !== null) return
    attach()
  }

  const onFocus = () => { if (!card.element.isConnected) keepAlive() }
  document.addEventListener('focusin', onFocus, true)

  const unsubscribe = store.subscribe(() => attach())
  beat = window.setInterval(keepAlive, KEEPALIVE_MS)
  attach()

  return {
    dispose() {
      disposed = true
      unsubscribe()
      document.removeEventListener('focusin', onFocus, true)
      if (timer !== null) window.clearTimeout(timer)
      timer = null
      if (beat !== null) window.clearInterval(beat)
      beat = null
      card.dispose()
      style.remove()
    },
  }
}

module.exports = createPet
