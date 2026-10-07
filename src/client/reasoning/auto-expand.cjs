/**
 * reasoning/auto-expand.cjs — the live reasoning block, and the mutation pump behind the effects.
 */

module.exports = function (deps) {
  const { appearanceSettings, clearStreamInk, disposeInkStyle, scheduleStreamInk, streamInkTargets } = deps

  // Both are filled in further down: the observer is created only where the page
  // has a body to watch, and the listener detach only where a document exists.
  let cleanupReasoningObserver = () => {}
  let cleanupReasoningExpand = () => {}

/**
 * Auto-expand reasoning (ported from Deeptop).
 *
 * Deeptop automatically unfolds the live reasoning block while streaming, then
 * collapses it back into a one-line chip once thinking completes. Here we provide
 * configuration options:
 * - 'streaming': auto-expand while thinking, auto-collapse on finish (Deeptop default)
 * - 'keep': auto-expand while thinking, keep open on finish
 * - 'always': always keep all thinking content expanded (including historical turns)
 * - 'off': follow official DSH behavior (default collapsed, manual click only)
 *
 * Manual user toggle (clicking the disclosure row) is respected via WeakSet so
 * user intention is never overwritten.
 */
const thinkUserInteracted = new WeakSet()
const thinkAutoExpanded = new WeakSet()
const thinkAutoCollapsed = new WeakSet()
const thinkLastState = new WeakMap()

function findToggleElement(root) {
  if (!root || typeof root.querySelector !== 'function') return null
  return root.querySelector('[data-disclosure-row][data-expandable], [data-disclosure-row][role="button"], button[aria-expanded], [data-disclosure-row]')
}

function isThinkExpanded(root) {
  if (!root) return false
  if (typeof root.hasAttribute === 'function' && root.hasAttribute('data-expanded')) return true
  const toggle = findToggleElement(root)
  if (toggle && typeof toggle.getAttribute === 'function') {
    return toggle.getAttribute('aria-expanded') === 'true'
  }
  return false
}

function isUserSelectingIn(root) {
  if (typeof window === 'undefined' || typeof window.getSelection !== 'function') return false
  try {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return false
    const node = sel.anchorNode
    return Boolean(node && root.contains(node))
  } catch {
    return false
  }
}

function handleUserDisclosureToggle(event) {
  if (!event || !event.isTrusted) return
  if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return
  const target = event.target
  if (!target || typeof target.closest !== 'function') return
  const toggle = target.closest('[data-disclosure-row], button[aria-expanded]')
  if (!toggle) return
  const thinkRoot = toggle.closest('[data-variant="think"]')
  if (thinkRoot) {
    thinkUserInteracted.add(thinkRoot)
  }
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('click', handleUserDisclosureToggle, { capture: true, passive: true })
  document.addEventListener('keydown', handleUserDisclosureToggle, { capture: true, passive: true })
}

/**
 * Click a disclosure row without re-entering React's own commit.
 *
 * {@link tickReasoningExpand} runs from a MutationObserver callback, which a
 * browser may deliver while React is still committing. A synchronous `click()`
 * there re-enters the renderer's event path mid-commit, so the synthetic click is
 * deferred to a macrotask — the same window a user's own click arrives in.
 * @param toggle - The disclosure row to click.
 */
function clickToggleSoon(toggle) {
  const schedule = typeof window !== 'undefined' && typeof window.setTimeout === 'function'
    ? window.setTimeout.bind(window)
    : setTimeout
  schedule(() => {
    if (toggle.isConnected === false) return
    const click = toggle.click
    if (typeof click === 'function') click.call(toggle)
  }, 0)
}

/** The shell's reasoning turns: the blocks the reasoning pass expands and collapses. */
const REASONING_SELECTOR = '[data-variant="think"]'

/** Whether one changed node is a reasoning turn, or holds one. */
function touchesReasoning(node) {
  if (node === null || node === undefined) return false
  if (node.nodeType === 3) {
    const parent = node.parentElement
    if (parent === null || parent === undefined || typeof parent.closest !== 'function') return false
    return parent.closest(REASONING_SELECTOR) !== null
  }
  if (node.nodeType !== 1) return false
  // `closest` covers the node itself, which is what an attribute record names.
  if (typeof node.closest === 'function' && node.closest(REASONING_SELECTOR) !== null) return true
  return typeof node.querySelector === 'function' && node.querySelector(REASONING_SELECTOR) !== null
}

/**
 * Whether a batch of mutation records could have changed a reasoning turn.
 *
 * Asking the document for every think block is the reasoning pass's first act, and on a
 * long transcript that one query is the whole cost of the pass. A reply that is not
 * thinking cannot have changed a turn, so this answers from the records instead — which is
 * what keeps the query off the streaming path. A call with no records is a direct request,
 * from a boot or a settings change, and always checks.
 * @param records - Mutation records, as the observer received them.
 * @returns Whether the pass is worth running.
 */
function reasoningTouched(records) {
  if (!Array.isArray(records) || records.length === 0) return true
  for (const record of records) {
    if (record === null || record === undefined) continue
    if (record.type === 'attributes') {
      if (touchesReasoning(record.target)) return true
      continue
    }
    // A removed turn has nothing left to expand and a text change cannot start or settle
    // one, so only an added node can matter here.
    if (record.type !== 'childList') continue
    for (const node of record.addedNodes ?? []) {
      if (touchesReasoning(node)) return true
    }
  }
  return false
}

function tickReasoningExpand() {
  if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return
  const mode = appearanceSettings()?.reasoningExpand || 'streaming'
  if (mode === 'off') return

  const thinkNodes = document.querySelectorAll('[data-variant="think"]')
  if (!thinkNodes || thinkNodes.length === 0) return

  for (const root of thinkNodes) {
    if (root.isConnected === false) continue
    if (thinkUserInteracted.has(root)) continue

    const state = typeof root.getAttribute === 'function' ? root.getAttribute('data-state') : null
    const isRunning = state === 'running'
    const open = isThinkExpanded(root)

    const lastState = thinkLastState.get(root)
    if (lastState !== state) {
      thinkLastState.set(root, state)
      if (isRunning && thinkAutoCollapsed.has(root)) {
        thinkAutoCollapsed.delete(root)
      }
    }

    if (mode === 'streaming') {
      if (isRunning) {
        if (!open && !thinkAutoExpanded.has(root)) {
          const toggle = findToggleElement(root)
          if (toggle && typeof toggle.click === 'function') {
            thinkAutoExpanded.add(root)
            clickToggleSoon(toggle)
          }
        }
      } else if (state === 'ok' || state === 'done' || (!isRunning && state !== null)) {
        if (thinkAutoExpanded.has(root) && !thinkAutoCollapsed.has(root)) {
          if (isUserSelectingIn(root)) continue

          if (open) {
            const toggle = findToggleElement(root)
            if (toggle && typeof toggle.click === 'function') {
              thinkAutoExpanded.delete(root)
              thinkAutoCollapsed.add(root)
              clickToggleSoon(toggle)
            }
          } else {
            thinkAutoExpanded.delete(root)
            thinkAutoCollapsed.add(root)
          }
        }
      }
    } else if (mode === 'keep') {
      if (isRunning && !open && !thinkAutoExpanded.has(root)) {
        const toggle = findToggleElement(root)
        if (toggle && typeof toggle.click === 'function') {
          thinkAutoExpanded.add(root)
          clickToggleSoon(toggle)
        }
      }
    } else if (mode === 'always') {
      if (!open && !thinkAutoExpanded.has(root)) {
        const toggle = findToggleElement(root)
        if (toggle && typeof toggle.click === 'function') {
          thinkAutoExpanded.add(root)
          clickToggleSoon(toggle)
        }
      }
    }
  }
}

cleanupReasoningExpand = function cleanupReasoningExpand() {
  if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
    document.removeEventListener('click', handleUserDisclosureToggle, { capture: true })
    document.removeEventListener('keydown', handleUserDisclosureToggle, { capture: true })
  }
}

let reasoningObserver = null
let isStreamMutating = false
if (typeof window !== 'undefined' && typeof document !== 'undefined' && typeof window.MutationObserver !== 'undefined' && document.body) {
  reasoningObserver = new window.MutationObserver((records) => {
    if (isStreamMutating) return
    isStreamMutating = true
    try {
      scheduleStreamInk(streamInkTargets(records))
      if (reasoningTouched(records)) tickReasoningExpand()
    } finally {
      isStreamMutating = false
    }
  })
  reasoningObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['data-streaming', 'data-state'],
  })
}

cleanupReasoningObserver = function cleanupReasoningObserver() {
  if (reasoningObserver !== null) {
    reasoningObserver.disconnect()
    reasoningObserver = null
  }
  clearStreamInk()
  disposeInkStyle()
}

/**
 * Detach everything this module installed: the document listeners and the
 * mutation observer that pumps both the ink and the expansion.
 */
function dispose() {
  cleanupReasoningObserver()
  cleanupReasoningExpand()
}

  return { tickReasoningExpand, dispose }
}
