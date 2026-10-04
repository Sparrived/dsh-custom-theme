/**
 * Update detection and upgrade planning for dsh-custom-theme.
 *
 * Pure version arithmetic and the registry query, kept apart from the route so it
 * can be exercised without a Host. Nothing here is imported from a package: the row
 * has to stay loadable by a profile that links this package directly, with no peer
 * resolution — the same reason the rest of the Host half imports nothing.
 *
 * The registry is asked directly rather than through `pluginManager.inspect`.
 * `inspect` is the pre-install check for a spec the user typed, and it refuses an
 * already-installed package with `already-installed` for every form of the spec —
 * including a version that does not exist — so it can never answer "what is the
 * latest release". The registry list it *does* expose, `registries()`, is used for
 * the query instead, which keeps a configured mirror or private registry in charge.
 */

/** The package this row is published as. */
export const PACKAGE_NAME = 'dsh-custom-theme'

/** The registry asked when the profile names neither a registry nor a resolved one. */
export const DEFAULT_REGISTRY = 'https://registry.npmjs.org/'

/** How long a successful answer is reused before the registry is asked again. */
export const CACHE_TTL_MS = 6 * 60 * 60 * 1000

/** How long a failed answer is reused, so a blip does not hide an update for hours. */
export const FAILURE_TTL_MS = 60 * 1000

/** Per-registry request budget. */
export const FETCH_TIMEOUT_MS = 15_000

/**
 * Parse a semver string into its comparable parts.
 *
 * Build metadata is ignored, as the specification requires: it never takes part in
 * precedence. A leading `v` is tolerated because registries answer with one or
 * without it depending on the tool.
 * @param value - Candidate version text.
 * @returns The parts, or `undefined` when the text is not a version.
 */
export function parseVersion(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/u.exec(String(value ?? '').trim())
  if (match === null) return undefined
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] === undefined ? [] : match[4].split('.'),
  }
}

/**
 * Compare two versions by semver precedence.
 * @param left - Left version text.
 * @param right - Right version text.
 * @returns `-1`, `0` or `1`, or `undefined` when either text is not a version.
 */
export function compareVersions(left, right) {
  const a = parseVersion(left)
  const b = parseVersion(right)
  if (a === undefined || b === undefined) return undefined
  for (const part of ['major', 'minor', 'patch']) {
    if (a[part] !== b[part]) return a[part] < b[part] ? -1 : 1
  }
  // A release outranks any prerelease of the same core version.
  if (a.prerelease.length === 0 && b.prerelease.length === 0) return 0
  if (a.prerelease.length === 0) return 1
  if (b.prerelease.length === 0) return -1
  const length = Math.max(a.prerelease.length, b.prerelease.length)
  for (let index = 0; index < length; index += 1) {
    const l = a.prerelease[index]
    const r = b.prerelease[index]
    // A shorter identifier list is lower when every preceding one is equal.
    if (l === undefined) return -1
    if (r === undefined) return 1
    const lNumeric = /^\d+$/u.test(l)
    const rNumeric = /^\d+$/u.test(r)
    if (lNumeric && rNumeric) {
      if (Number(l) !== Number(r)) return Number(l) < Number(r) ? -1 : 1
      continue
    }
    // Numeric identifiers always have lower precedence than alphanumeric ones.
    if (lNumeric !== rNumeric) return lNumeric ? -1 : 1
    if (l !== r) return l < r ? -1 : 1
  }
  return 0
}

/**
 * Whether `latest` is a strictly newer release than `current`.
 *
 * A version that cannot be parsed never counts as an update: offering an upgrade to
 * something unreadable is worse than staying quiet.
 * @param latest - Version the registry answered with.
 * @param current - Version this build runs.
 * @returns True when an upgrade is warranted.
 */
export function isUpdateAvailable(latest, current) {
  return compareVersions(latest, current) === 1
}

/**
 * The registries to ask, in order, without repeats.
 *
 * `pluginManager.registries()` reports the configured first registry (`null` when
 * pnpm's own configuration decides), the registry that resolves to, and the
 * configured fallbacks. A profile pointed at a private registry therefore asks only
 * that one and its own fallbacks; the public registry is appended only when the
 * profile names nothing at all.
 * @param registries - The service's answer, read defensively.
 * @returns Registry base URLs, each without a trailing slash.
 */
export function registryCandidates(registries) {
  const seen = new Set()
  const out = []
  const push = (value) => {
    if (typeof value !== 'string') return
    const trimmed = value.trim().replace(/\/+$/u, '')
    if (trimmed === '' || seen.has(trimmed)) return
    seen.add(trimmed)
    out.push(trimmed)
  }
  push(registries?.registry)
  push(registries?.resolved)
  for (const entry of Array.isArray(registries?.fallbackRegistries) ? registries.fallbackRegistries : []) push(entry)
  if (out.length === 0) push(DEFAULT_REGISTRY)
  return out
}

/**
 * Ask each candidate registry for this package's latest published version.
 *
 * A registry that is unreachable, refuses, or answers without a usable version
 * passes the question to the next one, so a stale mirror does not read as "no
 * update". Every failure is returned as a state rather than thrown, because the
 * caller renders it: a profile with no network access must still show its own
 * version and say why the check could not run.
 * @param options - `registries` from the plugin manager, plus optional `current`,
 *   `packageName`, request `timeoutMs` and a `fetchImpl` for tests.
 * @returns A state whose `status` is `ok`, `unavailable` or `error`.
 */
export async function fetchLatestVersion({
  registries,
  current,
  packageName = PACKAGE_NAME,
  timeoutMs = FETCH_TIMEOUT_MS,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    return { status: 'unavailable', current, reason: 'this runtime has no fetch' }
  }
  const candidates = registryCandidates(registries)
  const asked = []
  let reason = 'no registry answered'
  for (const base of candidates) {
    const url = `${base}/${packageName}/latest`
    asked.push(base)
    try {
      const response = await fetchImpl(url, {
        headers: { accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!response.ok) {
        reason = `${base} answered HTTP ${response.status}`
        continue
      }
      const body = await response.json()
      const latest = body?.version
      if (parseVersion(latest) === undefined) {
        reason = `${base} answered without a usable version`
        continue
      }
      return {
        status: 'ok',
        current,
        latest,
        updateAvailable: isUpdateAvailable(latest, current),
        registry: base,
        description: typeof body?.description === 'string' ? body.description : undefined,
        checkedAt: new Date().toISOString(),
      }
    } catch (error) {
      reason = `${base} failed: ${error?.message ?? String(error)}`
    }
  }
  return { status: 'error', current, reason, registries: asked, checkedAt: new Date().toISOString() }
}

/**
 * Detect whether a newer release exists.
 * @param options - `manager` is the Host's plugin-manager service; the rest is
 *   forwarded to {@link fetchLatestVersion}.
 * @returns A state whose `status` is `ok`, `unavailable` or `error`.
 */
export async function checkForUpdate({ manager, current, ...rest } = {}) {
  if (manager === undefined || manager === null || typeof manager.registries !== 'function') {
    return { status: 'unavailable', current, reason: 'the plugin manager service is not mounted' }
  }
  let registries
  try {
    registries = await manager.registries()
  } catch (error) {
    return { status: 'error', current, reason: error?.message ?? String(error) }
  }
  return fetchLatestVersion({ ...rest, registries, current })
}

/**
 * Cache one update state.
 *
 * The check runs once at startup, so without this every page load would ask the
 * registry again. A failure is cached for less time than a success, so a transient
 * network problem does not hide an update for hours.
 * @param options - `ttl` for a successful answer, `failureTtl` for a failed one.
 * @returns `read`, `write`, `clear` and the current `value`.
 */
export function createCache({ ttl = CACHE_TTL_MS, failureTtl = FAILURE_TTL_MS } = {}) {
  let entry = null
  return {
    /** The stored state, whether or not it is still fresh. */
    get value() {
      return entry === null ? null : entry.state
    },
    /** The stored state while it is still fresh, otherwise null. */
    read() {
      if (entry === null) return null
      const age = Date.now() - entry.at
      return age < (entry.state?.status === 'ok' ? ttl : failureTtl) ? entry.state : null
    },
    /** Store a state, stamped with the current time. */
    write(state) {
      entry = { state, at: Date.now() }
      return state
    },
    /** Forget the stored state. */
    clear() {
      entry = null
    },
  }
}
