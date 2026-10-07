/**
 * working/label.cjs — the shell's own running label, reworded through its locale lookup.
 */

module.exports = function (deps) {
  const { ctx, currentPhrase } = deps

  const { RUNNING_LABEL_KEY } = require('./constants.cjs')

/**
 * Reword the running label through the shell's own lookup.
 *
 * The label cannot be replaced at a seat of its own: the shell draws that row
 * inside its Chat view and registers no slot for it, and `ctx.locale.register`
 * throws for a namespace and locale pair that already exist. Every bound `t`
 * dispatches through `translate` though, so replacing that one method reaches the
 * wording itself and leaves everything around it — the whale-tail glyph, the
 * shimmer, the row's layout, the elapsed time the shell interpolates and the
 * announcement that mirrors the label — exactly as shipped.
 * @param locale - The shell's locale service.
 * @returns A detach function, or null when the service exposes no `translate`.
 */
function installRunningLabel(locale) {
  const original = locale?.translate
  if (typeof original !== 'function') return null
  /** Whether the service already carried its own `translate`, rather than a prototype one. */
  const own = Object.prototype.hasOwnProperty.call(locale, 'translate')
  /**
   * Shipped parameter-free wording, remembered per namespace as it is read.
   *
   * One shell keys its clock template `chat.deepDivingFor` beside
   * `chat.deepDiving`; another keys the same pair `message.turnProcess.*` with no
   * parameter-free sibling at all. Remembering the wording whenever it is read
   * rewords either build, and only ever costs the first read of a render.
   */
  const bareWording = new Map()
  /**
   * The shell's own lookup, with the running wording swapped.
   * @param ns - dictionary namespace.
   * @param key - dictionary key.
   * @param params - placeholder values, when the caller passes any.
   * @returns The shipped text everywhere but the running label.
   */
  const patched = function (ns, key, params) {
    const text = original.call(this, ns, key, params)
    if (typeof key !== 'string' || !RUNNING_LABEL_KEY.test(key)) return text
    const phrase = currentPhrase()
    if (phrase === '') return text
    if (!key.endsWith('For')) {
      bareWording.set(ns, text)
      return phrase
    }
    // The elapsed-time template reads `〈wording〉，用时 {duration} ···`, so only the
    // wording is swapped: whatever the shell puts after it — the clock it passes
    // in, the separators, the trailing marks — is kept as it is.
    const plain = key.slice(0, -'For'.length)
    const sibling = original.call(this, ns, plain)
    const wording = sibling !== plain ? sibling : bareWording.get(ns) ?? ''
    return wording !== '' && text.startsWith(wording) ? phrase + text.slice(wording.length) : text
  }
  try {
    // The service is a plain instance in the shipped shell; a composition that
    // refuses an own property still exposes the same method on its prototype.
    locale.translate = patched
    if (locale.translate === patched) {
      return () => { if (own) locale.translate = original; else delete locale.translate }
    }
    const prototype = Object.getPrototypeOf(locale)
    prototype.translate = patched
    return () => { prototype.translate = original }
  } catch {
    // A frozen or exotic service is a supported failure: the label stays as shipped.
    return null
  }
}

  return { installRunningLabel }
}
