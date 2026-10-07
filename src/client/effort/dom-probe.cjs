/**
 * effort/dom-probe.cjs — finding the effort row, its value cell and its seat by semantics.
 */
const { EFFORT_ROW_LABELS } = require('./constants.cjs')

/* ── The menu row's DOM, read and dressed ─────────────────────────────────── */

/** The first non-empty text a row carries. */
function firstSpanText(row) {
  try {
    for (const span of row.querySelectorAll('span')) {
      if (typeof span.textContent === 'string' && span.textContent.length > 0) return span.textContent
    }
  } catch {
    // Falling through to the structural answer is the caller's business.
  }
  return ''
}

/**
 * The row's value text — the `cellValue` span holding "Max" / "High".
 *
 * The class is a hashed one, so a miss falls back to structure: the last span inside the
 * row that carries text (the value sits after the label and before the chevron). Only its
 * colour is ever written; the text itself belongs to the shell.
 */
function findEffortValueElement(row) {
  if (!row || typeof row.querySelectorAll !== 'function') return null
  try {
    const byClass = row.querySelectorAll("span[class*='cellValue']")
    if (byClass.length > 0) return byClass[byClass.length - 1]
    let found = null
    for (const span of row.querySelectorAll('span')) {
      if (typeof span.textContent === 'string' && span.textContent.replace(/\s+/gu, '').length > 0) found = span
    }
    return found
  } catch {
    return null
  }
}

/**
 * The level's name on the collapsed seat (`DeepSeek-V41-Flash  High  ⌄`).
 *
 * That span's class is hashed and changes with the build, so it is found by *text*: what
 * the seat shows is a level's own name, which is the same datum this plugin reads from the
 * directory. All known names are matched, not just the current one — the shell has not
 * re-rendered the seat yet the instant a level changes, and matching only the new name
 * would let the colour slip for a frame. No known name means no match, and nothing else on
 * the seat is ever touched.
 */
function findSeatEffort(doc, composer, expectedLabels) {
  if (!doc || !composer || typeof doc.querySelectorAll !== 'function') return null
  const list = typeof expectedLabels === 'string' ? [expectedLabels] : expectedLabels
  if (!Array.isArray(list)) return null
  const wanted = []
  for (const label of list) {
    const name = typeof label === 'string' ? label.replace(/\s+/gu, '') : ''
    if (name.length > 0 && !wanted.includes(name)) wanted.push(name)
  }
  if (wanted.length === 0) return null
  try {
    for (const seat of doc.querySelectorAll('button[aria-haspopup="menu"]')) {
      if (!composer.contains(seat)) continue
      for (const span of seat.querySelectorAll('span')) {
        const text = span.textContent
        if (typeof text === 'string' && wanted.includes(text.replace(/\s+/gu, ''))) return span
      }
    }
  } catch {
    return null
  }
  return null
}

/**
 * The open model menu's reasoning-effort row, in this session's own composer.
 *
 * The seat is the shell's own trigger (`aria-haspopup="menu"` and `aria-expanded="true"`),
 * the menu is what its `aria-controls` names, and the row is one of the menu's two
 * `menuitem` buttons. The sub-panes use `menuitemradio`, so two `menuitem`s *is* the root
 * panel — and its second row is the effort row whether or not the caption is recognised.
 */
function findEffortRow(doc, composer) {
  if (!doc || !composer || typeof doc.querySelectorAll !== 'function') return null
  let seat = null
  for (const candidate of doc.querySelectorAll('button[aria-haspopup="menu"][aria-expanded="true"]')) {
    if (composer.contains(candidate)) {
      seat = candidate
      break
    }
  }
  if (seat === null) return null
  const menuId = typeof seat.getAttribute === 'function' ? seat.getAttribute('aria-controls') : null
  const menu = menuId && typeof doc.getElementById === 'function' ? doc.getElementById(menuId) : null
  if (!menu) return null
  const items = menu.querySelectorAll('button[role="menuitem"]')
  if (items.length !== 2) return null
  for (const item of items) {
    if (EFFORT_ROW_LABELS.includes(firstSpanText(item))) return item
  }
  return items[1]
}

module.exports = { firstSpanText, findEffortValueElement, findSeatEffort, findEffortRow }
