/**
 * pet/index.cjs — the companion perched on the input card.
 *
 * Finding the card is most of the job: the shell draws it after this plugin boots
 * and replaces it on a session switch, so the search is a cheap liveness check
 * rather than an observer over the whole document.
 *
 * A new session opens on the hero page, where the heatmap sits above the composer.
 * When that card is on screen the companion starts on its right-hand edge and hops
 * down onto the input card once the page has settled — it then stays there, at the
 * fraction of the card's width the settings page remembers.
 */
const { LOCALE_NS } = require('../i18n/dictionary.cjs')
const { PET_CSS } = require('./styles.cjs')
const { HOP_DELAY_MS, HOP_MS, KEEPALIVE_MS, RETRY_MS } = require('./constants.cjs')
const { createPetCard } = require('./view.cjs')
const store = require('./store.cjs')

/** Where the heatmap card and the hero phase are marked, from the heatmap feature. */
const HEATMAP_SELECTOR = '[data-dct-heatmap]'
const HERO_SELECTOR = '[data-content-phase="hero"]'

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
  if (typeof window.matchMedia !== 'function') {
    // Without the media query there is no way to honour "reduce motion"; sit still.
  }

  const style = document.createElement('style')
  style.dataset.plugin = 'dsh-custom-theme'
  style.dataset.role = 'pet'
  style.textContent = PET_CSS
  document.head.append(style)

  const t = typeof ctx.locale?.bind === 'function' ? ctx.locale.bind(LOCALE_NS) : (key) => key
  const card = createPetCard({ doc: document, label: t('petLabel') })
  let timer = null
  let beat = null
  let hop = null
  let disposed = false
  let begun = false

  /** Draw the configured anchor; the card reads it from its own custom property. */
  function applyConfig() {
    const config = store.read()
    card.setOffset(config.offset)
    return config
  }

  /** Put the perch on the input card, if the card is there and the row is on. */
  function attach(known) {
    if (disposed) return
    const config = applyConfig()
    if (!config.enabled) {
      card.element.remove()
      return
    }
    const host = known ?? document.querySelector('[data-composer-card]')
    if (host === null || host === undefined) {
      if (timer !== null) return
      timer = window.setTimeout(() => { timer = null; attach() }, RETRY_MS)
      return
    }
    if (host.contains(card.element)) { card.refresh(); return }
    card.element.removeAttribute('data-dct-pet-flight')
    card.element.style.removeProperty('left')
    card.element.style.removeProperty('top')
    card.element.style.removeProperty('transform')
    if (host.style && window.getComputedStyle(host).position === 'static') host.style.position = 'relative'
    host.append(card.element)
    card.refresh()
  }

  /** Whether this page is a new session with the heatmap card drawn on it. */
  function heroWithHeatmap() {
    if (document.querySelector(HERO_SELECTOR) === null) return null
    const heat = document.querySelector(HEATMAP_SELECTOR)
    if (heat === null) return null
    const rect = heat.getBoundingClientRect()
    return rect.width === 0 ? null : { heat, rect }
  }

  /**
   * Start beside the heatmap and hop down onto the input card.
   *
   * The perch is fixed to the page for the duration and only its transform moves,
   * so the hop composites without re-laying out the transcript under it.
   * @returns Whether a hop was started.
   */
  function startHop(host) {
    if (typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
    const hero = heroWithHeatmap()
    if (hero === null) return false
    const target = host.getBoundingClientRect()
    if (target.width === 0) return false
    const config = applyConfig()
    if (!config.enabled) return false

    const startX = hero.rect.right - 24
    const startY = hero.rect.top
    const endX = target.left + target.width * (config.offset / 100)
    const endY = target.top

    card.element.style.left = '0px'
    card.element.style.top = '0px'
    card.element.style.setProperty('--dct-pet-hop-ms', HOP_MS + 'ms')
    card.element.setAttribute('data-dct-pet-flight', '')
    card.element.style.transform = `translate(${startX}px, ${startY}px) translate(-50%, -100%)`
    document.body.append(card.element)

    const land = () => {
      if (disposed) return
      card.element.removeAttribute('data-dct-pet-flight')
      card.element.style.removeProperty('transform')
      attach()
    }

    hop = window.setTimeout(() => {
      hop = null
      if (disposed) return
      // The next frame is what makes the transition run: the browser has to see the
      // starting transform applied before the ending one is set.
      window.requestAnimationFrame(() => {
        card.element.style.transform = `translate(${endX}px, ${endY}px) translate(-50%, -100%)`
        hop = window.setTimeout(land, HOP_MS + 40)
      })
    }, HOP_DELAY_MS)
    return true
  }

  /** First placement: hop down from the heatmap when it is there, otherwise sit on the card. */
  function begin() {
    if (disposed || begun) return
    const host = document.querySelector('[data-composer-card]')
    if (host === null) {
      if (timer !== null) return
      timer = window.setTimeout(() => { timer = null; begin() }, RETRY_MS)
      return
    }
    begun = true
    if (!store.read().enabled) { card.element.remove(); return }
    if (!startHop(host)) attach(host)
  }

  /**
   * The shell replaces the whole input card when the user opens another session, and
   * the perch goes with it. A half-second liveness test puts it back: the test is a
   * single boolean while the companion is on screen, and only a replaced card costs a
   * lookup. A document observer would instead run on every mutation of every render.
   */
  function keepAlive() {
    if (disposed || card.element.isConnected) return
    if (timer !== null || hop !== null) return
    attach()
  }

  const onFocus = () => { if (!card.element.isConnected) keepAlive() }
  document.addEventListener('focusin', onFocus, true)
  const unsubscribe = store.subscribe(() => {
    applyConfig()
    if (!card.element.isConnected) return
    if (!store.read().enabled) card.element.remove()
  })

  beat = window.setInterval(keepAlive, KEEPALIVE_MS)
  begin()

  return {
    dispose() {
      disposed = true
      unsubscribe()
      document.removeEventListener('focusin', onFocus, true)
      if (timer !== null) window.clearTimeout(timer)
      if (hop !== null) window.clearTimeout(hop)
      if (beat !== null) window.clearInterval(beat)
      timer = null
      hop = null
      beat = null
      card.dispose()
      style.remove()
    },
  }
}

module.exports = createPet
