/**
 * branding/tags.cjs — the two regions, marked so a stylesheet can name them.
 */
/**
 * The shell's class names are CSS-module hashes, so a stylesheet the user writes
 * against them goes stale the moment the shell is rebuilt. This pass stamps the
 * regions with `data-dct-*` attributes instead: stable names a rule can rely on,
 * and the hooks the settings card documents.
 *
 * The pass is built around one cheap read. The hero's two regions exist only while
 * the conversation is showing the empty-session hero, and that is decided by an
 * attribute on an element that outlives every session switch — so a pass during a
 * streaming reply reads that attribute and stops, instead of asking the document
 * for a headline that is not in it. Only an element that left the document, or a
 * phase that has just become the hero, costs a lookup.
 */
const { HERO_PHASE, PHASE_SELECTOR, REGIONS } = require('./constants.cjs')

/** The three regions, by name, in the order a pass resolves them. */
const [BRAND, HERO_BADGE, HERO] = REGIONS

/** How long to wait between attempts to find surfaces the shell has not mounted yet. */
const RETRY_MS = 250
/** How many attempts that wait allows before giving up, roughly five seconds. */
const RETRY_LIMIT = 20

/**
 * @returns `{ start, stop }`.
 */
module.exports = function () {
  /** The element each region was last stamped on, by region id. */
  const stamped = new Map()
  /** The element reporting the conversation's phase, once found. */
  let phase = null
  /** The mutation observer, while the pass is watching. */
  let observer = null
  /** The pending retry timer, while the shell has yet to mount a region. */
  let retry = null
  /** Attempts made by {@link retry} so far. */
  let attempts = 0

  /**
   * Mark one region, if the shell has drawn it.
   *
   * A region may be reached through an element it always contains rather than by a
   * class of its own: the hero's row is found by walking up from its badge, because a
   * second element in the same bundle carries a `_headline` class too.
   * @param region - A region from {@link REGIONS}.
   * @returns Whether the region was found.
   */
  function stamp(region) {
    const anchor = document.querySelector(region.selector)
    const element = anchor === null || region.ascendTo === undefined
      ? anchor
      : anchor.closest(region.ascendTo)
    if (element === null) {
      stamped.delete(region.id)
      return false
    }
    element.setAttribute(region.attribute, '')
    stamped.set(region.id, element)
    return true
  }

  /**
   * Whether the empty-session hero is the view on screen.
   *
   * The phase element is not the hero itself: the shell keeps one element for the
   * whole conversation and switches the attribute on it, so this is a read rather
   * than a lookup on every pass.
   * @returns Whether the hero is up.
   */
  function heroShowing() {
    if (phase === null || !phase.isConnected) phase = document.querySelector(PHASE_SELECTOR)
    return phase !== null && phase.getAttribute('data-phase') === HERO_PHASE
  }

  /**
   * Mark every region that is on screen and not yet marked.
   *
   * Cheap by construction: each region is one identity test while the element it was
   * stamped on is still in the document, and the hero's two are not even asked for
   * unless the conversation says it is showing them.
   */
  function pass() {
    const brand = stamped.get('brand')
    if (brand === undefined || !brand.isConnected) stamp(BRAND)
    if (!heroShowing()) return
    const badge = stamped.get('heroBadge')
    if (badge === undefined || !badge.isConnected) stamp(HERO_BADGE)
    const hero = stamped.get('hero')
    if (hero === undefined || !hero.isConnected) stamp(HERO)
  }

  /** Whether both regions that always exist for a settled shell have been found. */
  function settled() {
    return stamped.has('brand') && phase !== null
  }

  /**
   * Keep looking for a shell that has not mounted its surfaces yet.
   *
   * The observer covers this in practice — a shell still drawing is a shell still
   * mutating — and this bounded retry covers the case it cannot: a page that settles
   * without another mutation after the one the plugin's own boot made.
   */
  function schedule() {
    if (retry !== null || attempts >= RETRY_LIMIT) return
    retry = window.setTimeout(() => {
      retry = null
      attempts += 1
      pass()
      if (!settled()) schedule()
    }, RETRY_MS)
  }

  /** Watch the shell's child lists, which is how a region leaves or arrives. */
  function watch() {
    if (observer !== null || typeof window.MutationObserver === 'undefined') return
    // A module can be loaded while the document has no body yet; the element is then the
    // only root there is, and the observer moves down to the body with the next load.
    const root = document.body ?? document.documentElement
    if (root === null || root === undefined) return
    // Child lists only: the pass writes attributes, never nodes, so its own work cannot
    // reach this callback and there is no pass loop to guard against.
    observer = new window.MutationObserver(() => { pass() })
    observer.observe(root, { childList: true, subtree: true })
  }

  /** Mark what is on screen, and keep marking it as the shell rebuilds. */
  function start() {
    pass()
    watch()
    if (!settled()) schedule()
  }

  /** Take the marks away, and stop watching. */
  function stop() {
    if (observer !== null) {
      observer.disconnect()
      observer = null
    }
    if (retry !== null) {
      window.clearTimeout(retry)
      retry = null
    }
    for (const region of REGIONS) {
      const element = stamped.get(region.id)
      if (element !== undefined) element.removeAttribute(region.attribute)
    }
    stamped.clear()
    phase = null
    attempts = 0
  }

  return { start, stop }
}
