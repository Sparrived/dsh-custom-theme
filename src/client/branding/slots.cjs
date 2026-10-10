/**
 * branding/slots.cjs — the seats the shell declares for its own marks, filled from the choices.
 */
const React = require('react')

const { h } = require('../shared/element.cjs')

/**
 * The priority the overrides register at.
 *
 * A `single` seat renders its lowest-priority entry, and the shell's own brand
 * plugin occupies the sidebar's two at the default priority 0 — so an override has
 * to be negative to be seen, and one value is used everywhere so that two of this
 * feature's occupiers can never collide with each other.
 */
const OVERRIDE_PRIORITY = -10

/**
 * @param deps - `ctx`, for the slot registry and the logger.
 * @returns `{ bind, sync, dispose }`.
 */
module.exports = function (deps) {
  const { ctx } = deps

  /** The choices in force; the views below re-render whenever this is replaced. */
  let current = null
  /** The views reading {@link current}. */
  const listeners = new Set()

  /** The store the shell's renderer subscribes to on behalf of the views. */
  const live = {
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    get: () => current,
  }

  /** One choice, read the way a seat's occupant reads it. */
  function useChoices() {
    return React.useSyncExternalStore(live.subscribe, live.get, live.get)
  }

  /**
   * The image one of the marks is replaced with.
   * @param className - This plugin's own class for the image.
   * @param field - The choice holding the address.
   * @param attribute - The region hook the image carries.
   * @param fallbackSize - Pixels, for a seat that asked for none.
   * @returns The seat's component.
   */
  function markView(className, field, attribute, fallbackSize) {
    return function Mark({ size }) {
      const choices = useChoices()
      const address = choices?.[field] ?? ''
      if (address === '') return null
      const pixels = size ?? fallbackSize
      return h('img', {
        className,
        [attribute]: '',
        src: address,
        alt: '',
        width: pixels,
        height: pixels,
      })
    }
  }

  /** The sidebar's wordmark, as the wording the user configured. */
  function BrandName() {
    const choices = useChoices()
    const text = choices?.brandName ?? ''
    if (text === '') return null
    return h('span', { className: 'dct-brand-text', 'data-dct-brand-name': '' }, text)
  }

  /**
   * The seats this feature may occupy.
   *
   * Each is a `single` seat the shell declares for a mark of its own: the two in the
   * sidebar header, and the animated fish beside the hero headline. The address the
   * user configured is what fills it; an empty address leaves the shell's occupant.
   */
  const SEATS = [
    { name: 'sidebar.brand.mark', field: 'brandMark', component: markView('dct-brand-img', 'brandMark', 'data-dct-brand-mark', 24) },
    { name: 'sidebar.brand.name', field: 'brandName', component: BrandName },
    { name: 'conversation.hero.brand.mark', field: 'heroMark', component: markView('dct-hero-img', 'heroMark', 'data-dct-hero-mark', 34) },
  ]

  /** The seats the shell has declared; a seat not declared cannot be filled. */
  const declared = new Set()
  /** The live registration of each seat, by name. */
  const held = new Map()
  /** The shell's handles on the injections asked for, one per seat. */
  const stops = []

  /**
   * Give one seat back to the shell.
   * @param name - Seat name.
   */
  function release(name) {
    const dispose = held.get(name)
    if (dispose === undefined) return
    held.delete(name)
    try {
      dispose()
    } catch {
      // A seat torn down with its declaration needs no release.
    }
  }

  /**
   * Fill one seat with this feature's occupant.
   * @param seat - A seat from {@link SEATS}.
   */
  function register(seat) {
    if (held.has(seat.name)) return
    try {
      held.set(seat.name, ctx.slots.register({ name: seat.name, priority: OVERRIDE_PRIORITY }, seat.component))
    } catch (error) {
      // Another occupant at the same priority is the one way this throws, and a seat
      // someone else already shadows is a supported outcome: the shell's own mark stays.
      ctx.logger.warn('dsh-custom-theme: seat %s is taken at priority %d (%s)', seat.name, OVERRIDE_PRIORITY, error?.message ?? error)
    }
  }

  /** Ask the shell for every seat, and fill the ones already declared from the current choices. */
  function bind() {
    for (const seat of SEATS) {
      stops.push(ctx.slots.inject(seat.name, () => {
        declared.add(seat.name)
        if (current !== null && current[seat.field] !== '') register(seat)
        return () => {
          declared.delete(seat.name)
          release(seat.name)
        }
      }))
    }
  }

  /**
   * Point every seat at the choices in force.
   *
   * Occupiers are withdrawn before the new choices are published and filled after it,
   * in that order: an occupant left mounted while its field is empty renders nothing
   * at all, where the shell's own mark is what an empty field asks for. Once
   * published, an occupant that stays mounted re-renders in place, so typing an
   * address into the card does not reload the image on every keystroke.
   * @param next - A choice set from the store.
   */
  function sync(next) {
    for (const seat of SEATS) if (next[seat.field] === '') release(seat.name)
    current = next
    for (const listener of [...listeners]) listener()
    for (const seat of SEATS) if (next[seat.field] !== '' && declared.has(seat.name)) register(seat)
  }

  /** Take every occupant out, and stop listening for seats. */
  function dispose() {
    for (const stop of stops.splice(0, stops.length)) {
      try {
        stop()
      } catch {
        // The injection is already gone with the slot's declaration.
      }
    }
    for (const seat of SEATS) release(seat.name)
    declared.clear()
    listeners.clear()
    current = null
  }

  return { bind, sync, dispose }
}
