/**
 * update/client.cjs — the update snapshot: one shared check, its cache and the two actions.
 */
const { UPDATE_APPLY_URL, UPDATE_CHECK_URL, UPDATE_URL } = require('../shared/endpoints.cjs')
const React = require('react')

/**
 * Which sentence an upload failure deserves.
 *
 * A 404 or a 405 is not about the picture at all: it means the Host serving this page
 * has no such route, which is what a plugin updated in place looks like until DSH
 * restarts. The bundle is read from disk on each request, so a refresh picks up a new
 * panel, while the Host half — imported once at boot — stays as it was. Blaming the
 * picture there sends the user off to try other files for no reason.
 * @param error - Whatever the upload threw.
 * @returns The locale key to show, and the status to show beside the generic one.
 */
function importFailureFor(error) {
  const status = error && typeof error === 'object' ? error.status : undefined
  if (status === 404 || status === 405) return { key: 'bgImportStale' }
  if (status === 413) return { key: 'bgImportTooLarge' }
  if (status === 415) return { key: 'bgImportUnsupported' }
  return { key: 'bgImportFailed', status }
}

/**
 * The sentence an upload failure shows, or `null` while nothing has failed.
 *
 * The status is appended only to the generic sentence: where the picture's own
 * reason is not known, the status is the only clue there is.
 * @param t - Locale lookup.
 * @param failure - What `importFailureFor` returned, or `null`.
 * @returns The text to show, or `null` to fall back to the row's usual hint.
 */
function importMessage(t, failure) {
  if (failure === null) return null
  const suffix = failure.status === undefined ? '' : ` (HTTP ${failure.status})`
  return t(failure.key) + suffix
}

/*
 * Update state, shared by the two places that show it: this card's own row and
 * the entry contributed to the plugin manager's page. The Host caches its check,
 * so both surfaces read one request instead of racing two.
 */
/** This package's name, which the detail-page subject is matched against. */
const PLUGIN_PACKAGE = 'dsh-custom-theme'

/** Latest snapshot: `phase` is `idle`, `loading`, `applying` or `failed`. */
let updateSnapshot = { phase: 'idle', state: null, reason: '', result: null }
const updateListeners = new Set()

/** Publish a snapshot to every mounted surface. */
function publishUpdate(next) {
  updateSnapshot = next
  for (const listener of updateListeners) listener(next)
}

/** The current snapshot without subscribing, for a mount that just needs it. */
function readUpdate() {
  return updateSnapshot
}

/** The in-flight load, so two surfaces mounting together ask the Host once. */
let updateLoad = null

/**
 * Load the Host's update state.
 * @param options - `force` asks the Host to query the registries again rather
 *   than answer from its cache.
 */
function loadUpdate({ force = false } = {}) {
  if (updateLoad !== null) return updateLoad
  const promise = (async () => {
    publishUpdate({ ...updateSnapshot, phase: 'loading', reason: '' })
    try {
      const response = force
        ? await fetch(UPDATE_CHECK_URL, { method: 'POST', cache: 'no-store' })
        : await fetch(UPDATE_URL, { cache: 'no-store' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      publishUpdate({ phase: 'idle', state: await response.json(), reason: '', result: null })
    } catch (error) {
      publishUpdate({ ...updateSnapshot, phase: 'failed', reason: error.message })
    }
  })()
  updateLoad = promise
  const clear = () => { if (updateLoad === promise) updateLoad = null }
  promise.then(clear, clear)
  return promise
}

/** Install the release the last check resolved, then re-read what the Host reports. */
async function applyUpdateNow() {
  publishUpdate({ ...updateSnapshot, phase: 'applying', reason: '' })
  try {
    const response = await fetch(UPDATE_APPLY_URL, { method: 'POST', cache: 'no-store' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const result = await response.json()
    if (result.status !== 'ok') {
      publishUpdate({ ...updateSnapshot, phase: 'failed', reason: result.reason ?? '' })
      return
    }
    // The Host now reports a pending restart in place of the same upgrade.
    await loadUpdate()
    publishUpdate({ ...readUpdate(), result })
  } catch (error) {
    publishUpdate({ ...updateSnapshot, phase: 'failed', reason: error.message })
  }
}

/** Subscribe to the shared snapshot, loading it once per page. */
function useUpdate() {
  const [snapshot, setSnapshot] = React.useState(readUpdate)
  React.useEffect(() => {
    updateListeners.add(setSnapshot)
    setSnapshot(readUpdate())
    // A failed load leaves no state behind, so reopening a surface retries it.
    if (readUpdate().state === null) loadUpdate()
    return () => { updateListeners.delete(setSnapshot) }
  }, [])
  return snapshot
}

module.exports = { importFailureFor, importMessage, PLUGIN_PACKAGE, publishUpdate, readUpdate, loadUpdate, applyUpdateNow, useUpdate }
