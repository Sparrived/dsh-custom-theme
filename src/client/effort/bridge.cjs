/**
 * effort/bridge.cjs — claiming the effort row, and giving every inline style back on release.
 */
const { EFFORT_HOST_PART, ROW_PADDING_BLOCK } = require('./constants.cjs')
const { findEffortRow, findEffortValueElement, findSeatEffort } = require('./dom-probe.cjs')

/**
 * Watch the document and hang the slider's container in that row.
 *
 * @param options - `doc` and `win` are the host's; `anchor` returns this session's element
 *   in the composer; `active` says whether there is anything to draw; `onChange` receives
 *   the host record (or null) as the row is claimed and released; `seatLabels` returns
 *   every level name the collapsed seat might be showing.
 */
function createEffortBridge(options) {
  const doc = options.doc
  const win = options.win
  const anchor = options.anchor
  const active = options.active
  const onChange = options.onChange
  const seatLabels = options.seatLabels
  if (!doc || typeof doc.createElement !== 'function') return null

  let current = null
  let seat = null
  let seatColor = ''
  let noticeEl = null
  let noticeFront = null
  let noticeBack = null
  // The value cell whose own text is currently invisible, so it can be given back.
  let hushedCell = null
  let observer = null
  let timer = null
  let disposed = false

  /** This session's composer: the shell's own marker, found upwards from the anchor. */
  function composerOf() {
    const node = anchor()
    if (!node) return null
    let el = node
    while (el && el.nodeType === 1) {
      if (typeof el.getAttribute === 'function' && el.getAttribute('data-composer-card') !== null) return el
      el = el.parentNode
    }
    return null
  }

  /**
   * The quota notice: the text this plugin draws over the row's value cell.
   *
   * An overlay, never a rewrite — the shell's own value text stays exactly as it rendered,
   * so nothing here can be mistaken for this plugin owning that text. The box is measured
   * from the value cell, and the cell's own text is hushed with a rule of ours while the
   * notice is up: that is what an overlay has to do to be readable, and it is the reason
   * nothing has to be painted behind it.
   */
  function dropNotice() {
    if (noticeEl !== null) {
      try {
        if (typeof noticeEl.remove === 'function') noticeEl.remove()
      } catch {
        // The shell may have emptied the row already.
      }
    }
    noticeEl = null
    noticeFront = null
    noticeBack = null
    hushCell(null, false)
  }

  /**
   * Make one value cell's own text invisible, or give it back.
   *
   * A class rather than an inline colour: the slider writes the cell's colour inline on
   * every pass, so only a rule of ours outranks it — and taking the class off hands the cell
   * back exactly as it was, whatever colour that happens to be.
   * @param element - The cell to hush, or `null` to give back the one that is hushed.
   * @param hushing - Whether its text should be invisible.
   */
  function hushCell(element, hushing) {
    const node = hushing ? element : (element ?? hushedCell)
    hushedCell = hushing ? node : null
    if (!node || typeof node !== 'object') return
    try {
      if (node.classList && typeof node.classList.toggle === 'function') {
        node.classList.toggle('ces-cell-hushed', hushing === true)
      }
    } catch {
      // A cell without a usable class list is simply left alone.
    }
  }

  /** Keep the notice exactly over the value cell, so the flip turns where the text is. */
  function placeNotice() {
    const row = current?.row
    const value = current?.value
    if (noticeEl === null || !row || !value) return
    try {
      if (typeof row.getBoundingClientRect !== 'function' || typeof value.getBoundingClientRect !== 'function') return
      const rowBox = row.getBoundingClientRect()
      const cellBox = value.getBoundingClientRect()
      noticeEl.style.top = `${Math.round(cellBox.top - rowBox.top)}px`
      noticeEl.style.height = `${Math.round(cellBox.height)}px`
      // Both edges, not just the right one: the box has to be the cell's own, because the
      // text inside it is aligned to that box's right edge — where the shell draws the value.
      noticeEl.style.left = `${Math.round(cellBox.left - rowBox.left)}px`
      noticeEl.style.width = `${Math.round(cellBox.width)}px`
    } catch {
      // A document without layout still gets the text, just not the exact box.
    }
  }

  /**
   * Put the notice back on the cell the row has now.
   *
   * The shell re-renders the value it shows whenever the level moves, and a row that is
   * re-rendered can hand back a different element for it: the cell that was hushed would
   * then be a cell nobody is looking at, and the new one would show its text through the
   * notice. Cheap enough to run on every pass the bridge already makes.
   */
  function refreshNotice() {
    if (noticeEl === null || current === null) return
    const value = findEffortValueElement(current.row)
    if (value !== null && value !== current.value) {
      hushCell(null, false)
      current = { ...current, value }
    }
    if (current.value !== null && current.value !== undefined) hushCell(current.value, true)
    placeNotice()
  }

  /**
   * Draw the notice, or clear it.
   *
   * `state` is `null` to clear, otherwise `{ front, back, color, flipped }`: the text shown
   * first, the text the flip lands on, and the colour both carry — the level's own.
   */
  function showNotice(state) {
    if (disposed || state === null || current === null) {
      dropNotice()
      return
    }
    if (noticeEl === null) {
      noticeEl = doc.createElement('div')
      noticeEl.className = 'ces-notice'
      noticeEl.setAttribute('data-ces-part', 'notice')
      // Decorative: the value cell right underneath already carries the level's name.
      noticeEl.setAttribute('aria-hidden', 'true')
      const inner = doc.createElement('span')
      inner.className = 'ces-notice__inner'
      noticeFront = doc.createElement('span')
      noticeFront.className = 'ces-notice__face'
      noticeBack = doc.createElement('span')
      noticeBack.className = 'ces-notice__face ces-notice__face--back'
      inner.appendChild(noticeFront)
      inner.appendChild(noticeBack)
      noticeEl.appendChild(inner)
      try {
        current.row.appendChild(noticeEl)
      } catch {
        dropNotice()
        return
      }
    }
    if (noticeFront.textContent !== state.front) noticeFront.textContent = state.front
    if (noticeBack.textContent !== state.back) noticeBack.textContent = state.back
    noticeEl.style.color = typeof state.color === 'string' ? state.color : ''
    noticeEl.setAttribute('data-flipped', state.flipped === true ? '1' : '0')
    // The shell's own text is hidden rather than covered, so nothing is painted behind the
    // notice and no two texts can ever read through each other mid-flip.
    hushCell(current.value, true)
    placeNotice()
  }

  function detach() {
    if (current === null) return
    const { row, container, value, previous } = current
    dropNotice()
    try {
      // `.remove()` on the container this plugin appended itself: never a node React
      // rendered, and never a child-removal call into the shell's own tree — which is
      // exactly what broke 0.3.1's streaming fade.
      if (container && typeof container.remove === 'function') container.remove()
    } catch {
      // The shell may have unmounted the row already.
    }
    try {
      if (row?.style) {
        row.style.height = previous.height
        row.style.flexWrap = previous.flexWrap
        row.style.paddingTop = previous.paddingTop
        row.style.paddingBottom = previous.paddingBottom
        row.style.boxShadow = previous.boxShadow
        // Written so the quota notice has a box to sit in; the shell never set it.
        row.style.position = previous.position
      }
      // The value's colour is ours too, so it goes back with the rest.
      if (value?.style) value.style.color = previous.valueColor
    } catch {
      // A failed restore does not stop the shell's menu from working.
    }
    current = null
    onChange(null)
  }

  /** Put the collapsed seat's text back and forget it. */
  function releaseSeat() {
    if (seat === null) return
    try {
      if (seat.el?.style) seat.el.style.color = seat.previousColor
    } catch {
      // The element may already be gone.
    }
    seat = null
  }

  /**
   * Keep the collapsed seat's colour current.
   *
   * The element is re-found only when it is missing or was replaced by a re-render — the
   * text changing does not replace it — so a level change never flickers through a
   * restore-then-recolour.
   */
  function syncSeat() {
    const composer = composerOf()
    if (composer === null || active() !== true) {
      releaseSeat()
      return
    }
    if (seat !== null && seat.el && doc.documentElement?.contains(seat.el)) {
      // The shell clears inline styles on its own re-render; put ours back.
      if (seatColor && seat.el.style) seat.el.style.color = seatColor
      return
    }
    releaseSeat()
    const el = findSeatEffort(doc, composer, typeof seatLabels === 'function' ? seatLabels() : null)
    if (el === null || !el.style) return
    seat = { el, previousColor: el.style.color || '' }
    if (seatColor) el.style.color = seatColor
  }

  function scan() {
    if (disposed) return
    // The seat is independent of the row: one failing must not take the other down.
    try {
      syncSeat()
    } catch {
      // Nothing to report.
    }
    try {
      const composer = composerOf()
      if (composer === null || active() !== true) {
        detach()
        return
      }
      // Already hung and still in the document: nothing to do but keep the notice on the
      // cell the row has *now* — the shell re-renders that text while the notice is up.
      if (current !== null && current.row && doc.documentElement?.contains(current.row)) {
        refreshNotice()
        return
      }

      const row = findEffortRow(doc, composer)
      if (row === null) {
        detach()
        return
      }
      detach()
      // A row that already carries a copy of this slider keeps it. Two sliders stacked in
      // one row is worse than none, and the standalone reference plugin draws its own.
      if (typeof row.querySelector === 'function' && row.querySelector(`[data-ces-part="${EFFORT_HOST_PART}"]`) !== null) return

      const value = findEffortValueElement(row)
      const previous = {
        // Unset inline properties read as '' in a real document; keeping that (rather than
        // `undefined`) is what stops a restore from writing the literal string back.
        height: row.style.height || '',
        flexWrap: row.style.flexWrap || '',
        paddingTop: row.style.paddingTop || '',
        paddingBottom: row.style.paddingBottom || '',
        boxShadow: row.style.boxShadow || '',
        position: row.style.position || '',
        valueColor: value?.style ? value.style.color || '' : '',
      }
      // Taller, and wrapping: that is what lets the slider fall onto a second line and
      // take the row's full width. Relative, so the quota notice can be placed over the
      // value cell without moving anything else in the row.
      row.style.height = 'auto'
      row.style.flexWrap = 'wrap'
      row.style.position = 'relative'
      row.style.paddingTop = ROW_PADDING_BLOCK
      row.style.paddingBottom = ROW_PADDING_BLOCK

      const container = doc.createElement('div')
      container.className = 'ces-inline'
      container.setAttribute('data-ces-part', EFFORT_HOST_PART)
      row.appendChild(container)

      current = { row, container, value, previous }
      onChange(current)

      // The menu measures itself and then sits at a fixed position, so it has to measure
      // again now that the row is taller. A resize is the shell's own cue to do that.
      try {
        win.dispatchEvent(new win.Event('resize'))
      } catch {
        // A host without an Event constructor re-measures on its next state change.
      }
    } catch {
      try {
        detach()
      } catch {
        // Bottom of the barrel.
      }
    }
  }

  function start() {
    scan()
    const MutationObserverCtor = win?.MutationObserver ?? (typeof MutationObserver === 'function' ? MutationObserver : null)
    if (typeof MutationObserverCtor === 'function') {
      try {
        observer = new MutationObserverCtor(() => scan())
        observer.observe(doc.body || doc.documentElement, { childList: true, subtree: true })
        return
      } catch {
        observer = null
      }
    }
    // Without an observer, a slow poll does the same job for a page's worth of nothing.
    if (win && typeof win.setInterval === 'function') timer = win.setInterval(scan, 400)
  }

  return {
    scan,
    start,
    /** Draw or clear the quota notice over the row's value cell. */
    notice(state) {
      showNotice(state ?? null)
    },
    /** The colour the seat should carry; the bridge applies it whenever it grabs the span. */
    setSeatColor(color) {
      seatColor = typeof color === 'string' ? color : ''
      if (seat?.el?.style) {
        try {
          seat.el.style.color = seatColor
        } catch {
          // Nothing to report.
        }
      }
    },
    dispose() {
      disposed = true
      if (observer !== null) {
        try {
          observer.disconnect()
        } catch {
          // Nothing to report.
        }
        observer = null
      }
      if (timer !== null) {
        try {
          win.clearInterval(timer)
        } catch {
          // Nothing to report.
        }
        timer = null
      }
      releaseSeat()
      detach()
    },
    host() {
      return current
    },
  }
}

module.exports = { createEffortBridge }
