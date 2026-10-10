/**
 * branding/locale.cjs — the hero's own two strings, reworded through the shell's lookup.
 */
/**
 * The hero cannot be reworded at a seat of its own: the shell draws the headline
 * and its preview badge from the `conversation` dictionary inside its Hero shell,
 * and declares a slot for the mark beside them but none for the text. Every bound
 * `t` dispatches through `translate`, though, so replacing that one method reaches
 * the wording itself and leaves the row's layout, its type and its animated mark
 * exactly as shipped — the same route the running label takes.
 */
const HERO_NS = 'conversation'

/** The hero keys this feature rewords, and the choice each one reads. */
const HERO_KEYS = {
  'hero.headline': 'heroHeadline',
  'hero.preview': 'heroBadge',
}

/**
 * Install the hero's wording, and keep it installed.
 *
 * Another feature patches the same lookup (the running-label effect), and either
 * may install over the other: when that one withdraws itself it restores the value
 * it captured, which can drop this wrapper out of the chain. So arming is a probe
 * rather than a state check — the shell's own lookup is asked what it would show,
 * and the wrapper is installed again whenever the answer is no longer the choice in
 * force. A wrapper that has been withdrawn but is still wrapped by something else
 * passes through, and drops itself the first time it is called and finds itself
 * outermost again.
 * @param deps - `locale` (the shell's service), `settings` (the live choices), and
 *   `warn` for a service that refuses the patch.
 * @returns `{ arm, dispose }`.
 */
module.exports = function (deps) {
  const { locale, settings, warn } = deps

  /** The wrapper this feature holds, or null when it holds none. */
  let patched = null
  /** The lookup the wrapper was installed over; kept while the wrapper can still run. */
  let saved = null
  /** False once the wrapper is withdrawn, so it stops answering with a choice. */
  let enabled = false

  /**
   * The wording this feature wants for one lookup key.
   * @param ns - Dictionary namespace.
   * @param key - Dictionary key.
   * @returns The custom text, or null to leave the shipped wording alone.
   */
  function overrideFor(ns, key) {
    if (ns !== HERO_NS || !Object.prototype.hasOwnProperty.call(HERO_KEYS, key)) return null
    const text = settings()[HERO_KEYS[key]]
    return text === '' ? null : text
  }

  /**
   * The shell's own lookup, with the hero's wording swapped.
   * @param ns - Dictionary namespace.
   * @param key - Dictionary key.
   * @param params - Placeholder values, when the caller passes any.
   * @returns The shipped text everywhere but the two hero keys.
   */
  function wrapper(ns, key, params) {
    if (typeof saved !== 'function') return typeof key === 'string' ? key : ''
    if (!enabled) {
      // Withdrawn, but still wrapped by a patch installed later. It delegates, and takes
      // itself out of the chain as soon as it is the outermost lookup again.
      if (locale.translate === wrapper) locale.translate = saved
      return saved.call(this, ns, key, params)
    }
    const text = overrideFor(ns, key)
    return text === null ? saved.call(this, ns, key, params) : text
  }

  /**
   * Whether the shell's lookup already answers with the choice in force.
   * @returns Whether arming again would change nothing.
   */
  function live() {
    const choices = settings()
    const key = choices.heroHeadline !== '' ? 'hero.headline' : 'hero.preview'
    const wanted = choices[HERO_KEYS[key]]
    if (wanted === '') return true
    if (typeof locale?.bind !== 'function') return false
    try {
      return locale.bind(HERO_NS)(key) === wanted
    } catch {
      // A service that cannot answer the probe is one this feature cannot read; the
      // wrapper is installed anyway and the lookup decides.
      return false
    }
  }

  /** Forget the wrapper, without touching a lookup that something else now holds. */
  function release() {
    enabled = false
    patched = null
    saved = null
  }

  /** Put the wrapper into the lookup, over whatever is there now. */
  function install() {
    const original = locale?.translate
    if (typeof original !== 'function') {
      if (typeof warn === 'function') warn('dsh-custom-theme: the shell exposes no locale lookup; hero wording stays as shipped')
      return
    }
    saved = original
    enabled = true
    patched = wrapper
    try {
      // The service is a plain instance in the shipped shell, so the own property is the
      // whole patch. A service that refuses it — frozen, or holding the method on its
      // prototype — is the only case the second attempt exists for, and it is refused
      // outright when that prototype is `Object.prototype`: the honest reading there is
      // that this service cannot carry the patch, not that every object in the page can.
      locale.translate = wrapper
      if (locale.translate !== wrapper) {
        const prototype = Object.getPrototypeOf(locale)
        const patchable = prototype !== null && prototype !== Object.prototype
          && Object.prototype.hasOwnProperty.call(prototype, 'translate')
        if (!patchable) {
          release()
          if (typeof warn === 'function') warn('dsh-custom-theme: the shell refuses a locale lookup patch; hero wording stays as shipped')
          return
        }
        prototype.translate = wrapper
        if (locale.translate !== wrapper) release()
      }
    } catch {
      // A frozen or exotic service is a supported failure: the hero stays as shipped.
      release()
      if (typeof warn === 'function') warn('dsh-custom-theme: the shell refuses a locale lookup patch; hero wording stays as shipped')
    }
  }

  /**
   * Take the wrapper out of the lookup.
   *
   * When a patch installed later holds it, the wrapper is only disabled: restoring
   * the captured lookup there would cut that patch out of the chain instead. The
   * disabled wrapper delegates until it is outermost again, then removes itself.
   */
  function withdraw() {
    if (patched === null) return
    enabled = false
    if (locale.translate !== patched) return
    const restore = saved
    release()
    locale.translate = restore
  }

  /**
   * Point the lookup at the choices in force.
   *
   * Called on every settings change, and again after the running-label effect
   * re-installs its own patch, which is the one event that can drop this wrapper.
   */
  function arm() {
    const choices = settings()
    if (choices.heroHeadline === '' && choices.heroBadge === '') {
      withdraw()
      return
    }
    if (enabled && live()) return
    if (patched !== null) withdraw()
    install()
  }

  return { arm, dispose: withdraw }
}
