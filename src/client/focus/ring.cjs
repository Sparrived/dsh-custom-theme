/**
 * focus/ring.cjs — the composer's focus ring, drawn as one rounded stroke.
 *
 * A background gradient cannot draw a *partial* rounded border: the sweep starts
 * and closes at the same angle, so a wide, short card shows a bright wedge where
 * it starts and a notch where it closes. A stroke has neither problem — its dash
 * offset simply walks along the real rounded path, and a CSS transition on that
 * offset grows the ring on focus and retracts it from wherever it had reached
 * when focus leaves.
 *
 * The ring is a decoration of an element the shell owns, so it is injected as an
 * inert child and re-created whenever the shell re-renders the card: nothing here
 * reads or writes the composer's own state.
 */

const SVG_NS = 'http://www.w3.org/2000/svg'

/**
 * Stroke for one composer box.
 *
 * The path starts at the middle of the top edge and runs clockwise, which is the
 * Two halves are returned, each starting at the middle of the top edge and
 * meeting at the middle of the bottom edge: one runs clockwise, the other
 * counter-clockwise. Drawn together they grow from the top centre outwards and
 * close at the bottom, which is what a border reads as doing on this card; one
 * half alone looked like it was crawling round the box.
 * @param width - Card width in px.
 * @param height - Card height in px.
 * @param inset - Stroke centre inset from the card's edge.
 * @param radius - The card's border radius.
 * @returns Both half paths, the half length each dash needs, and the drawn box.
 */
function ringGeometry(width, height, inset, radius) {
  const w = Math.max(0, width - inset * 2)
  const h = Math.max(0, height - inset * 2)
  const r = Math.max(0, Math.min(radius - inset, Math.min(w, h) / 2))
  const left = inset
  const top = inset
  const right = left + w
  const bottom = top + h
  const middle = left + w / 2
  const sweep = (clockwise, x, y) => `A ${r} ${r} 0 0 ${clockwise ? 1 : 0} ${x} ${y}`
  const half = (clockwise) => [
    `M ${middle} ${top}`,
    clockwise ? `H ${right - r}` : `H ${left + r}`,
    r > 0 ? sweep(clockwise, clockwise ? right : left, top + r) : '',
    `V ${bottom - r}`,
    r > 0 ? sweep(clockwise, clockwise ? right - r : left + r, bottom) : '',
    `H ${middle}`,
  ].filter((part) => part !== '').join(' ')
  // Each half is half the perimeter by construction: the two straight runs it
  // covers plus one vertical run plus one quarter-circle pair.
  const length = 2 * (w - 2 * r) + 2 * (h - 2 * r) + 2 * Math.PI * r
  return { clockwise: half(true), counterClockwise: half(false), length, half: length / 2, width: right, height: bottom }
}

/** The sheet that dresses every injected ring. */
const RING_CSS = `
[data-dct-focus-ring] {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  overflow: visible;
  z-index: 2;
}
[data-dct-focus-ring] path {
  fill: none;
  stroke: var(--dct-prism-ring, var(--dsw-alias-brand-primary, #7460bf));
  stroke-width: 2px;
  stroke-linecap: round;
  /* A dash as long as the path, shifted by its own length, is entirely off the
   * path: the ring is invisible at rest without any opacity trick, so the only
   * thing that ever moves is the stroke's own end. */
  stroke-dasharray: var(--dct-ring-length, 0);
  stroke-dashoffset: var(--dct-ring-length, 0);
  transition: stroke-dashoffset 560ms cubic-bezier(.4, 0, .2, 1);
}
[data-composer-card][data-dct-ring="on"] > [data-dct-focus-ring] path {
  stroke-dashoffset: 0;
}
@media (prefers-reduced-motion: reduce) {
  [data-dct-focus-ring] path { transition: none; }
}
/* Forced colours own the stroke colour; the geometry still applies. */
@media (forced-colors: active) {
  [data-dct-focus-ring] path { stroke: Highlight; }
}
`

/**
 * Watch for composer cards and draw the ring on the focused one.
 *
 * @param options - `doc` and `win` are the host's; `enabled` reports whether the
 *   active theme asked for this decoration.
 * @returns `{ sync, dispose }`; `sync` re-reads the theme's wish after a switch.
 */
function createFocusRing({ doc, win, enabled }) {
  if (!doc || typeof doc.createElementNS !== 'function' || typeof doc.querySelectorAll !== 'function') return null
  if (typeof win?.MutationObserver !== 'function') return null

  const style = doc.createElement('style')
  style.dataset.plugin = 'dsh-custom-theme'
  style.dataset.role = 'focus-ring'
  style.textContent = RING_CSS
  doc.head.append(style)

  let live = true
  const rings = new WeakMap()

  const radiusOf = (card) => {
    const value = Number.parseFloat(win.getComputedStyle(card).borderTopLeftRadius)
    return Number.isFinite(value) ? value : 16
  }

  const ensure = (card) => {
    if (!live) return null
    let ring = rings.get(card)
    if (ring !== undefined && card.contains(ring)) return ring
    if (win.getComputedStyle(card).position === 'static') card.style.position = 'relative'
    ring = doc.createElementNS(SVG_NS, 'svg')
    ring.setAttribute('data-dct-focus-ring', '')
    ring.setAttribute('aria-hidden', 'true')
    ring.setAttribute('focusable', 'false')
    const paths = [doc.createElementNS(SVG_NS, 'path'), doc.createElementNS(SVG_NS, 'path')]
    ring.append(...paths)
    // Measured while detached: a stroke that gains its dash length only after it
    // is in the page would animate from zero on every mount.
    const size = () => {
      const box = card.getBoundingClientRect()
      const geometry = ringGeometry(box.width, box.height, 1.5, radiusOf(card))
      ring.setAttribute('width', String(geometry.width))
      ring.setAttribute('height', String(geometry.height))
      ring.setAttribute('viewBox', `0 0 ${geometry.width} ${geometry.height}`)
      paths[0].setAttribute('d', geometry.clockwise)
      paths[1].setAttribute('d', geometry.counterClockwise)
      // Each dash covers its own half, so both halves finish together.
      for (const path of paths) path.style.setProperty('--dct-ring-length', String(geometry.half))
    }
    size()
    card.append(ring)
    if (typeof win.ResizeObserver === 'function') {
      const observer = new win.ResizeObserver(size)
      observer.observe(card)
      ring.__dctResize = observer
    }
    rings.set(card, ring)
    return ring
  }

  const cards = () => Array.from(doc.querySelectorAll('[data-composer-card]'))

  const paint = (card) => {
    if (!live) return
    if (!enabled()) {
      card.removeAttribute('data-dct-ring')
      return
    }
    ensure(card)
    const focused = card.matches(':focus-within')
    if (focused) card.setAttribute('data-dct-ring', 'on')
    else card.removeAttribute('data-dct-ring')
  }

  const scan = () => { for (const card of cards()) paint(card) }

  const onFocus = () => scan()

  doc.addEventListener('focusin', onFocus, true)
  doc.addEventListener('focusout', onFocus, true)
  const observer = new win.MutationObserver(scan)
  observer.observe(doc.body, { childList: true, subtree: true })
  scan()

  return {
    sync: scan,
    dispose() {
      live = false
      doc.removeEventListener('focusin', onFocus, true)
      doc.removeEventListener('focusout', onFocus, true)
      observer.disconnect()
      for (const card of cards()) {
        const ring = rings.get(card)
        if (ring === undefined) continue
        ring.__dctResize?.disconnect()
        ring.remove()
        card.removeAttribute('data-dct-ring')
      }
      style.remove()
    },
  }
}

module.exports = { createFocusRing, ringGeometry, RING_CSS }
