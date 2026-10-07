/**
 * The update surface: the version this build runs, the registry check, and the
 * install the plugin manager performs.
 *
 * The check needs two things the row cannot demand — the version this build runs
 * and the profile's plugin-manager service for the registry list and the install —
 * so both are read defensively: a profile without the service still reports its own
 * version and says why the check cannot run.
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { PACKAGE_NAME, checkForUpdate, createCache } from '../update.mjs'

/**
 * This package's manifest, read for the version the update check compares against.
 * The manifest ships in the published tarball, so the lookup never depends on a
 * checkout being present.
 */
const PACKAGE_JSON = fileURLToPath(new URL('../../package.json', import.meta.url))

/**
 * Read the version this build runs.
 * @returns The version, or `undefined` when the manifest is missing or malformed;
 *   the update check then reports that it cannot compare rather than guessing.
 */
async function readOwnVersion() {
  try {
    const manifest = JSON.parse(await readFile(PACKAGE_JSON, 'utf8'))
    return typeof manifest?.version === 'string' ? manifest.version : undefined
  } catch {
    return undefined
  }
}

/**
 * One log line for an update state.
 * @param state - A state from the update module.
 * @returns Text for the startup log.
 */
function describeState(state) {
  if (state.status === 'ok') {
    return state.updateAvailable
      ? `${state.latest} is available (running ${state.current}, from ${state.registry})`
      : `running the latest release (${state.current}, from ${state.registry})`
  }
  return `${state.status}: ${state.reason}`
}

/**
 * Build the update surface and start the one startup check.
 * @param options - `{ ctx, config }`; `config.updateCheck: false` skips that check.
 * @returns `{ updates }`, the three calls the route makes.
 */
export function createUpdateSurface({ ctx, config }) {
  let manager
  let currentVersion
  let pendingRestart
  const cache = createCache()
  const ownVersion = readOwnVersion().then((version) => {
    currentVersion = version
  })

  /**
   * Run one check, sharing a check that is already running.
   *
   * An `unavailable` answer — no service mounted yet — is deliberately not cached:
   * the injection below can settle after the first caller arrives, and caching the
   * interim answer would report it as the result for the whole failure window.
   * @returns The settled update state.
   */
  let inFlight = null
  function refresh() {
    if (inFlight !== null) return inFlight
    const promise = (async () => {
      await ownVersion
      const state = await checkForUpdate({ manager, current: currentVersion })
      return state.status === 'unavailable' ? state : cache.write(state)
    })().finally(() => {
      if (inFlight === promise) inFlight = null
    })
    inFlight = promise
    return promise
  }

  ctx.inject(['pluginManager'], (service) => {
    manager = service.pluginManager
    service.effect(() => () => {
      manager = undefined
    })
    // The startup check runs from here rather than from `apply` itself: this is the
    // moment the registry list and the install both become reachable, so a profile
    // that mounts the service late still gets one check and no useless early answer.
    if (config?.updateCheck !== false) {
      refresh().then((state) => {
        ctx.logger.info('dsh-custom-theme: update check %s', describeState(state))
      }, (error) => {
        ctx.logger.warn('dsh-custom-theme: update check failed: %s', error.message)
      })
    }
  })

  return {
    /** The update surface the route exposes to the browser half. */
    updates: {
      /** The cached state, a running check, or a fresh check when neither exists. */
      async state() {
        const state = cache.read() ?? await refresh()
        return { ...state, package: PACKAGE_NAME, pendingRestart }
      },
      /** Ask the registries again, ignoring the cache. */
      async check() {
        return { ...await refresh(), package: PACKAGE_NAME, pendingRestart }
      },
      /** Install the newer release the last check resolved. */
      async apply() {
        const state = cache.read() ?? cache.value
        const base = { package: PACKAGE_NAME, current: currentVersion, pendingRestart }
        if (state === null || state.status !== 'ok') {
          return { ...base, status: 'error', reason: 'no release has been resolved yet; check for updates first' }
        }
        if (state.updateAvailable !== true) {
          return { ...base, status: 'error', reason: 'the running build is already the latest release', latest: state.latest }
        }
        if (manager === undefined || typeof manager.installBundle !== 'function') {
          return { ...base, status: 'error', reason: 'the plugin manager service is not mounted', latest: state.latest }
        }
        const spec = `${PACKAGE_NAME}@${state.latest}`
        try {
          const result = await manager.installBundle(spec, { enabled: true })
          const application = result?.application
          // `installBundle` resolves for a failed run too: the outcome lives in the
          // result, not in whether the promise rejected. Only these two mean the files
          // are in place; anything else left the profile as it was, and saying the
          // upgrade succeeded would send the user looking for a restart that cannot help.
          if (application !== 'applied' && application !== 'restart-required') {
            const detail = result?.error?.diagnostic ?? result?.error?.code
            return {
              ...base,
              status: 'error',
              latest: state.latest,
              spec,
              stage: result?.stage,
              application,
              restartRequired: false,
              reason: detail === undefined
                ? `the ${result?.stage ?? 'install'} step did not complete (${application ?? 'no outcome'})`
                : `the ${result?.stage ?? 'install'} step did not complete: ${detail}`,
            }
          }
          pendingRestart = state.latest
          cache.write({ ...state, updateAvailable: false, pendingRestart })
          return {
            status: 'ok',
            package: PACKAGE_NAME,
            current: currentVersion,
            latest: state.latest,
            spec,
            stage: result?.stage,
            application,
            // Replacing a package cannot hot-swap the Host module: the new code is
            // installed but the running process still holds the old one until restart.
            restartRequired: application === 'restart-required',
            pendingRestart,
          }
        } catch (error) {
          return { ...base, status: 'error', reason: error?.message ?? String(error), latest: state.latest, spec }
        }
      },
    },
  }
}
