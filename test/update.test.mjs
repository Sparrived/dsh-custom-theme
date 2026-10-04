// Update detection coverage: semver precedence, registry candidate ordering, the
// registry query's fallback behaviour, the plugin-manager hand-off, and the cache.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  CACHE_TTL_MS,
  DEFAULT_REGISTRY,
  checkForUpdate,
  compareVersions,
  createCache,
  fetchLatestVersion,
  isUpdateAvailable,
  parseVersion,
  registryCandidates,
} from '../src/update.mjs'

/** A `fetch` double answering from a table of `url -> response`. */
function fakeFetch(table) {
  const calls = []
  const impl = async (url) => {
    calls.push(url)
    const entry = table[url]
    if (entry === undefined) throw new Error(`unexpected url ${url}`)
    if (entry instanceof Error) throw entry
    return {
      ok: entry.status === undefined || entry.status === 200,
      status: entry.status ?? 200,
      async json() {
        return entry.body
      },
    }
  }
  return { impl, calls }
}

test('parseVersion reads the core, the prerelease and ignores build metadata', () => {
  assert.deepEqual(parseVersion('1.2.3'), { major: 1, minor: 2, patch: 3, prerelease: [] })
  assert.deepEqual(parseVersion('v1.2.3'), { major: 1, minor: 2, patch: 3, prerelease: [] })
  assert.deepEqual(parseVersion(' 1.2.3+build.5 '), { major: 1, minor: 2, patch: 3, prerelease: [] })
  assert.deepEqual(parseVersion('1.2.3-rc.1'), { major: 1, minor: 2, patch: 3, prerelease: ['rc', '1'] })
  assert.equal(parseVersion('1.2'), undefined)
  assert.equal(parseVersion('latest'), undefined)
  assert.equal(parseVersion(''), undefined)
  assert.equal(parseVersion(undefined), undefined)
  assert.equal(parseVersion('1.2.3.4'), undefined)
})

test('compareVersions orders the core parts', () => {
  assert.equal(compareVersions('1.0.0', '1.0.0'), 0)
  assert.equal(compareVersions('2.0.0', '1.9.9'), 1)
  assert.equal(compareVersions('1.10.0', '1.9.0'), 1)
  assert.equal(compareVersions('1.0.1', '1.0.2'), -1)
  // Compared as numbers, not as text: `10` is above `9`.
  assert.equal(compareVersions('1.0.10', '1.0.9'), 1)
})

test('compareVersions applies the prerelease rules', () => {
  // A release outranks any prerelease of the same core version.
  assert.equal(compareVersions('1.0.0', '1.0.0-rc.1'), 1)
  assert.equal(compareVersions('1.0.0-rc.1', '1.0.0'), -1)
  assert.equal(compareVersions('1.0.0-alpha', '1.0.0-beta'), -1)
  // Numeric identifiers rank below alphanumeric ones.
  assert.equal(compareVersions('1.0.0-1', '1.0.0-alpha'), -1)
  assert.equal(compareVersions('1.0.0-2', '1.0.0-10'), -1)
  // A shorter identifier list is lower when every preceding one is equal.
  assert.equal(compareVersions('1.0.0-alpha', '1.0.0-alpha.1'), -1)
  assert.equal(compareVersions('1.0.0-rc.1', '1.0.0-rc.1'), 0)
})

test('compareVersions refuses text it cannot read', () => {
  assert.equal(compareVersions('nonsense', '1.0.0'), undefined)
  assert.equal(compareVersions('1.0.0', 'nonsense'), undefined)
})

test('isUpdateAvailable only fires for a strictly newer release', () => {
  assert.equal(isUpdateAvailable('0.2.0', '0.1.0'), true)
  assert.equal(isUpdateAvailable('0.1.0', '0.1.0'), false)
  assert.equal(isUpdateAvailable('0.1.0', '0.2.0'), false)
  // A prerelease of the running version is not an upgrade.
  assert.equal(isUpdateAvailable('0.1.0-rc.1', '0.1.0'), false)
  assert.equal(isUpdateAvailable('0.2.0-rc.1', '0.1.0'), true)
  assert.equal(isUpdateAvailable('nonsense', '0.1.0'), false)
})

test('registryCandidates keeps the configured order and drops repeats', () => {
  assert.deepEqual(registryCandidates({ registry: 'https://a/', resolved: 'https://b/', fallbackRegistries: ['https://c/'] }),
    ['https://a', 'https://b', 'https://c'])
  // A trailing slash never doubles up.
  assert.deepEqual(registryCandidates({ registry: 'https://a', resolved: 'https://a/', fallbackRegistries: [] }), ['https://a'])
  // `registry: null` means pnpm's own configuration decides, which is `resolved`.
  assert.deepEqual(registryCandidates({ registry: null, resolved: 'https://registry.npmjs.org/', fallbackRegistries: ['https://registry.npmmirror.com/'] }),
    ['https://registry.npmjs.org', 'https://registry.npmmirror.com'])
  // A private registry is never widened to the public one.
  assert.deepEqual(registryCandidates({ registry: 'https://private.example/', fallbackRegistries: [] }), ['https://private.example'])
  // Nothing configured at all falls back to the public registry.
  assert.deepEqual(registryCandidates({}), [DEFAULT_REGISTRY.replace(/\/+$/u, '')])
  assert.deepEqual(registryCandidates(undefined), [DEFAULT_REGISTRY.replace(/\/+$/u, '')])
})

test('fetchLatestVersion reports the version and whether it is newer', async () => {
  const { impl, calls } = fakeFetch({
    'https://registry.npmjs.org/dsh-custom-theme/latest': { body: { version: '0.2.0', description: 'themes' } },
  })
  const state = await fetchLatestVersion({
    registries: { registry: null, resolved: 'https://registry.npmjs.org/', fallbackRegistries: [] },
    current: '0.1.0',
    fetchImpl: impl,
  })
  assert.equal(state.status, 'ok')
  assert.equal(state.latest, '0.2.0')
  assert.equal(state.updateAvailable, true)
  assert.equal(state.registry, 'https://registry.npmjs.org')
  assert.equal(state.description, 'themes')
  assert.equal(calls.length, 1)
})

test('fetchLatestVersion passes over a registry that fails or answers nothing usable', async () => {
  const { impl, calls } = fakeFetch({
    'https://first.example/dsh-custom-theme/latest': new Error('ECONNREFUSED'),
    'https://second.example/dsh-custom-theme/latest': { status: 404, body: {} },
    'https://third.example/dsh-custom-theme/latest': { body: { version: 'not-a-version' } },
    'https://fourth.example/dsh-custom-theme/latest': { body: { version: '0.3.0' } },
  })
  const state = await fetchLatestVersion({
    registries: {
      registry: 'https://first.example/',
      resolved: 'https://second.example/',
      fallbackRegistries: ['https://third.example/', 'https://fourth.example/'],
    },
    current: '0.1.0',
    fetchImpl: impl,
  })
  assert.equal(state.status, 'ok')
  assert.equal(state.latest, '0.3.0')
  assert.equal(state.registry, 'https://fourth.example')
  // Every registry before the answering one was really asked, in order.
  assert.deepEqual(calls.map((url) => new URL(url).host), ['first.example', 'second.example', 'third.example', 'fourth.example'])
})

test('fetchLatestVersion reports an error once every registry failed', async () => {
  const { impl } = fakeFetch({ 'https://only.example/dsh-custom-theme/latest': new Error('offline') })
  const state = await fetchLatestVersion({
    registries: { registry: 'https://only.example/', fallbackRegistries: [] },
    current: '0.1.0',
    fetchImpl: impl,
  })
  assert.equal(state.status, 'error')
  assert.match(state.reason, /offline/u)
  assert.deepEqual(state.registries, ['https://only.example'])
})

test('fetchLatestVersion says so when the runtime has no fetch', async () => {
  const state = await fetchLatestVersion({ registries: {}, current: '0.1.0', fetchImpl: null })
  assert.equal(state.status, 'unavailable')
})

test('checkForUpdate needs the plugin manager service', async () => {
  const missing = await checkForUpdate({ manager: undefined, current: '0.1.0' })
  assert.equal(missing.status, 'unavailable')
  assert.match(missing.reason, /plugin manager/u)

  const throwing = await checkForUpdate({
    manager: { async registries() { throw new Error('service unloaded') } },
    current: '0.1.0',
  })
  assert.equal(throwing.status, 'error')
  assert.match(throwing.reason, /service unloaded/u)
})

test('checkForUpdate asks the registries the manager reports', async () => {
  const { impl, calls } = fakeFetch({
    'https://mirror.example/dsh-custom-theme/latest': { body: { version: '1.0.0' } },
  })
  const manager = {
    async registries() {
      return { registry: 'https://mirror.example/', resolved: 'https://registry.npmjs.org/', fallbackRegistries: [] }
    },
  }
  const state = await checkForUpdate({ manager, current: '1.0.0', fetchImpl: impl })
  assert.equal(state.status, 'ok')
  assert.equal(state.updateAvailable, false)
  assert.deepEqual(calls, ['https://mirror.example/dsh-custom-theme/latest'])
})

test('the cache serves a fresh answer and expires it by status', () => {
  const cache = createCache({ ttl: CACHE_TTL_MS, failureTtl: 0 })
  assert.equal(cache.read(), null)
  const ok = cache.write({ status: 'ok', latest: '0.2.0' })
  assert.equal(cache.read(), ok)
  assert.equal(cache.value, ok)
  // A failure with a zero failure window is stale immediately, so a blip cannot
  // hide an update for the whole success window.
  const failed = cache.write({ status: 'error', reason: 'offline' })
  assert.equal(cache.read(), null)
  assert.equal(cache.value, failed)
  cache.clear()
  assert.equal(cache.value, null)
})
