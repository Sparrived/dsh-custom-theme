/**
 * pet/view.cjs — the companion perched on the composer card.
 *
 * It is plain DOM rather than a slot component: the seat it belongs on is the input
 * card itself, and that card is rebuilt by the shell whenever it likes. A bounded
 * retry finds it at start-up and the focus events that change its pose re-attach the
 * perch if the card was replaced — no document observer, so a session switch costs
 * this feature nothing.
 */
const { bodyRects, eyeRects } = require('./art.cjs')
const { PIXEL_SIZE } = require('./constants.cjs')

const SVG_NS = 'http://www.w3.org/2000/svg'
const BODY = bodyRects()
const EYES_OPEN = eyeRects(false)
const EYES_SHUT = eyeRects(true)

/**
 * Build one group of pixel rects.
 * @param doc - The host document.
 * @param rects - Rects from `art.cjs`.
 * @param className - Class for the group.
 * @returns The SVG group element.
 */
function group(doc, rects, className) {
  const node = doc.createElementNS(SVG_NS, 'g')
  node.setAttribute('class', className)
  for (const rect of rects) {
    const pixel = doc.createElementNS(SVG_NS, 'rect')
    pixel.setAttribute('x', String(rect.x))
    pixel.setAttribute('y', String(rect.y))
    pixel.setAttribute('width', String(rect.width))
    pixel.setAttribute('height', String(rect.height))
    pixel.setAttribute('fill', rect.fill)
    node.append(pixel)
  }
  return node
}

/**
 * Build the perch and keep its pose in step with the composer's focus.
 *
 * @param options - `doc` is the host document; `label` names it for assistive tools.
 * @returns `{ element, dispose }`.
 */
function createPetCard({ doc, label }) {
  const perch = doc.createElement('div')
  perch.className = 'dct-pet-perch'
  perch.dataset.dctPet = 'idle'

  const size = 16 * PIXEL_SIZE
  const svg = doc.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('class', 'dct-pet')
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(size))
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.setAttribute('role', 'img')
  svg.setAttribute('aria-label', label)
  svg.setAttribute('shape-rendering', 'crispEdges')
  svg.append(
    group(doc, BODY, 'dct-pet-body'),
    group(doc, EYES_OPEN, 'dct-pet-eyes-open'),
    group(doc, EYES_SHUT, 'dct-pet-eyes-closed'),
  )
  perch.append(svg)

  const read = () => {
    const card = perch.parentElement
    perch.dataset.dctPet = card !== null && card.matches(':focus-within') ? 'attentive' : 'idle'
  }
  doc.addEventListener('focusin', read, true)
  doc.addEventListener('focusout', read, true)

  return {
    element: perch,
    refresh: read,
    dispose() {
      doc.removeEventListener('focusin', read, true)
      doc.removeEventListener('focusout', read, true)
      perch.remove()
    },
  }
}

module.exports = { createPetCard }
