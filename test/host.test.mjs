// Host half coverage: exports, directory preparation, seeding, the listing and
// asset routes, path-traversal rejection, and the guarantee that a later start
// never overwrites a user's file.

import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import * as plugin from '../src/index.mjs'

/**
 * Build a context double that captures the registered routes.
 * @param options - `manager` is the plugin-manager double to mount. Without it the
 *   service is modelled as absent, which is what a profile without it looks like:
 *   the injection callback never runs.
 */
function makeContext({ manager } = {}) {
  const routes = []
  const logger = { info() {}, warn() {} }
  const child = {
    logger,
    effect: (fn) => fn(),
    webServer: {
      register(route) {
        routes.push(route)
        return () => {}
      },
    },
  }
  const ctx = {
    logger,
    effect: (fn) => fn(),
    inject(names, callback) {
      if (names.length === 1 && names[0] === 'webServer') {
        callback(child)
        return
      }
      if (names.length === 1 && names[0] === 'pluginManager') {
        if (manager !== undefined) callback({ logger, effect: (fn) => fn(), pluginManager: manager })
        return
      }
      assert.fail(`unexpected inject ${JSON.stringify(names)}`)
    },
  }
  return { ctx, routes }
}

/** Drive one request through a captured route and collect the response. */
function request(route, path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const res = {
      headersSent: false,
      writeHead(status, headers) {
        this.status = status
        this.headers = headers
        this.headersSent = true
      },
      end(body) {
        resolve({ status: this.status, headers: this.headers, body })
      },
    }
    Promise.resolve(route.handler({ url: path, method }, res)).catch(reject)
  })
}

/**
 * Apply the plugin against fresh temporary directories.
 *
 * Both directories are always passed: `apply` creates them, and letting it fall
 * back to `$DSH_HOME` would touch the machine running the tests.
 *
 * `apply` returns before its preparation pass settles, so this awaits one listing
 * request: the route awaits the same promise, which makes the contract under test
 * "the directories are ready once the route answers".
 * @returns `{ themes, backgrounds, route, cleanup }`.
 */
async function start({ manager } = {}) {
  const themes = await mkdtemp(join(tmpdir(), 'dsh-custom-theme-'))
  const backgrounds = await mkdtemp(join(tmpdir(), 'dsh-custom-backgrounds-'))
  const { ctx, routes } = makeContext({ manager })
  plugin.apply(ctx, { themesDir: themes, backgroundsDir: backgrounds })
  assert.equal(routes.length, 1)
  const [route] = routes
  assert.equal(route.kind, 'prefix')
  // No trailing slash: `WebServer.match` tests `pathname === prefix` or
  // `pathname.startsWith(prefix + '/')`, so a trailing slash never matches.
  assert.equal(route.path, '/dsh-custom-theme')
  assert.equal((await request(route, '/dsh-custom-theme/themes')).status, 200)
  return {
    themes,
    backgrounds,
    route,
    async cleanup() {
      await rm(themes, { recursive: true, force: true })
      await rm(backgrounds, { recursive: true, force: true })
    },
  }
}

test('exports the function-plugin form with no default export', () => {
  assert.equal(plugin.name, 'dsh-custom-theme')
  assert.equal(typeof plugin.apply, 'function')
  assert.equal(plugin.default, undefined)
})

test('seeds bundled themes, repairs deletions, and re-syncs on a new generation', async () => {
  const { themes, backgrounds, cleanup } = await start()
  try {
    for (const id of ['gov', 'monokai-pro', 'one-dark']) {
      assert.match(await readFile(join(themes, `${id}.css`), 'utf8'), /--dsw-alias-bg-base/u)
    }
    assert.equal((await readFile(join(themes, '.seed-version'), 'utf8')).trim(), '2')

    // An edited file survives a later start within the same generation.
    const edited = join(themes, 'gov.css')
    await writeFile(edited, ':root { --dsw-alias-bg-base: #010203; }\n', 'utf8')
    const second = makeContext()
    plugin.apply(second.ctx, { themesDir: themes, backgroundsDir: backgrounds })
    assert.equal((await request(second.routes[0], '/dsh-custom-theme/themes')).status, 200)
    assert.match(await readFile(edited, 'utf8'), /#010203/u)

    // A deleted file is repaired by the next start.
    await rm(edited)
    const third = makeContext()
    plugin.apply(third.ctx, { themesDir: themes, backgroundsDir: backgrounds })
    assert.equal((await request(third.routes[0], '/dsh-custom-theme/themes')).status, 200)
    assert.match(await readFile(edited, 'utf8'), /--dsw-alias-brand-primary: #c8161d/u)

    // A stale generation re-syncs the bundled files, and only those: a corrected
    // bundled palette has to reach a machine still holding the old copy, while a
    // theme the user added under its own name is never touched.
    await writeFile(edited, ':root { --dsw-alias-bg-base: #010203; }\n', 'utf8')
    const mine = join(themes, 'my-theme.css')
    await writeFile(mine, ':root { --dsw-alias-bg-base: #abcdef; }\n', 'utf8')
    await writeFile(join(themes, '.seed-version'), '1', 'utf8')
    const fourth = makeContext()
    plugin.apply(fourth.ctx, { themesDir: themes, backgroundsDir: backgrounds })
    assert.equal((await request(fourth.routes[0], '/dsh-custom-theme/themes')).status, 200)
    assert.match(await readFile(edited, 'utf8'), /--dsw-alias-brand-primary: #c8161d/u)
    assert.match(await readFile(mine, 'utf8'), /#abcdef/u)
  } finally {
    await cleanup()
  }
})

test('lists bundled ids first, then extra ids in alphabet order', async () => {
  const { themes, route, cleanup } = await start()
  try {
    await writeFile(join(themes, 'zeta.css'), ':root {}\n', 'utf8')
    await writeFile(join(themes, 'alpha.css'), ':root {}\n', 'utf8')
    await writeFile(join(themes, 'notes.txt'), 'ignored\n', 'utf8')
    await writeFile(join(themes, '.hidden.css'), ':root {}\n', 'utf8')
    const response = await request(route, '/dsh-custom-theme/themes')
    assert.equal(response.status, 200)
    assert.equal(response.headers['content-type'], 'application/json; charset=utf-8')
    const payload = JSON.parse(response.body)
    assert.deepEqual(payload.themes, [
      { id: 'gov', bundled: true },
      { id: 'monokai-pro', bundled: true },
      { id: 'one-dark', bundled: true },
      { id: 'alpha', bundled: false },
      { id: 'zeta', bundled: false },
    ])
    assert.equal(payload.dir, themes)
  } finally {
    await cleanup()
  }
})

test('serves one stylesheet and refuses everything else', async () => {
  const { route, cleanup } = await start()
  try {
    const ok = await request(route, '/dsh-custom-theme/theme/gov.css')
    assert.equal(ok.status, 200)
    assert.equal(ok.headers['content-type'], 'text/css; charset=utf-8')
    // Both palettes have to reach the browser, not just the light one.
    const body = ok.body.toString('utf8')
    assert.match(body, /--dsw-alias-brand-primary: #c8161d/u)
    assert.match(body, /\[data-theme="dark"\][\s\S]*--dsw-alias-brand-primary: #e64c50/u)

    assert.equal((await request(route, '/dsh-custom-theme/theme/missing.css')).status, 404)
    assert.equal((await request(route, '/dsh-custom-theme/')).status, 404)
    assert.equal((await request(route, '/dsh-custom-theme/themes', 'POST')).status, 405)

    // Traversal attempts: encoded separators, plain separators, and bare dots.
    for (const path of [
      '/dsh-custom-theme/theme/..%2F..%2Fetc%2Fpasswd.css',
      '/dsh-custom-theme/theme/../../index.js.css',
      '/dsh-custom-theme/theme/...css',
      '/dsh-custom-theme/theme/%2e%2e.css',
    ]) {
      assert.equal((await request(route, path)).status, 404, path)
    }
    assert.equal((await request(route, '/dsh-custom-theme/theme/%2.css')).status, 400)
  } finally {
    await cleanup()
  }
})

test('a user theme is served with its own text', async () => {
  const { themes, route, cleanup } = await start()
  try {
    await writeFile(join(themes, 'my-theme.css'), ':root { --dsw-alias-bg-base: #abcdef !important; }\n', 'utf8')
    const response = await request(route, '/dsh-custom-theme/theme/my-theme.css')
    assert.equal(response.status, 200)
    assert.match(response.body.toString('utf8'), /#abcdef/u)
  } finally {
    await cleanup()
  }
})

test('lists background images and serves their bytes', async () => {
  const { backgrounds, route, cleanup } = await start()
  try {
    const empty = await request(route, '/dsh-custom-theme/backgrounds')
    assert.equal(empty.status, 200)
    assert.deepEqual(JSON.parse(empty.body.toString('utf8')), { backgrounds: [], dir: backgrounds })

    // A one-pixel PNG, so the response can be checked byte for byte.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
      'base64')
    await writeFile(join(backgrounds, 'sky.png'), png)
    await writeFile(join(backgrounds, 'notes.txt'), 'ignored\n', 'utf8')
    await writeFile(join(backgrounds, '.hidden.png'), png)

    const listed = await request(route, '/dsh-custom-theme/backgrounds')
    const payload = JSON.parse(listed.body.toString('utf8'))
    assert.deepEqual(payload.backgrounds, [
      { name: 'sky.png', url: '/dsh-custom-theme/background/sky.png' },
    ])

    const image = await request(route, '/dsh-custom-theme/background/sky.png')
    assert.equal(image.status, 200)
    assert.equal(image.headers['content-type'], 'image/png')
    assert.deepEqual(image.body, png)
  } finally {
    await cleanup()
  }
})

test('refuses background names outside the image whitelist', async () => {
  const { backgrounds, route, cleanup } = await start()
  try {
    await writeFile(join(backgrounds, 'secret.txt'), 'not an image\n', 'utf8')
    assert.equal((await request(route, '/dsh-custom-theme/background/secret.txt')).status, 404)
    assert.equal((await request(route, '/dsh-custom-theme/background/missing.png')).status, 404)
    for (const path of [
      '/dsh-custom-theme/background/..%2F..%2Fsecret.txt',
      '/dsh-custom-theme/background/%2e%2e.png',
      '/dsh-custom-theme/background/.hidden.png',
    ]) {
      assert.equal((await request(route, path)).status, 404, path)
    }
  } finally {
    await cleanup()
  }
})

/**
 * Install a `fetch` double for one test.
 *
 * The Host queries the registry with the runtime's own `fetch`, so the check is
 * stubbed here rather than reached through configuration.
 * @param table - `url` to `{ status, body }`, or to an `Error` to throw.
 * @returns The urls asked and a restore function.
 */
function stubFetch(table) {
  const original = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    const entry = table[String(url)]
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
  return {
    calls,
    restore() {
      globalThis.fetch = original
    },
  }
}

/** A plugin-manager double reporting one registry. */
function managerOn(registry, extra = {}) {
  return {
    async registries() {
      return { registry, fallbackRegistries: [] }
    },
    ...extra,
  }
}

test('reports its own version and says so when no plugin manager is mounted', async () => {
  const { route, cleanup } = await start()
  try {
    const answer = await request(route, '/dsh-custom-theme/update')
    assert.equal(answer.status, 200)
    const state = JSON.parse(answer.body)
    assert.equal(state.status, 'unavailable')
    assert.equal(state.package, 'dsh-custom-theme')
    // The running version is read from this package's own manifest, so it tracks
    // the release a user actually has rather than a build-time constant.
    const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
    assert.equal(state.current, manifest.version)
  } finally {
    await cleanup()
  }
})

test('reports an available release and the registry that answered', async () => {
  const stub = stubFetch({ 'https://mirror.example/dsh-custom-theme/latest': { body: { version: '99.0.0' } } })
  const { route, cleanup } = await start({ manager: managerOn('https://mirror.example/') })
  try {
    const state = JSON.parse((await request(route, '/dsh-custom-theme/update')).body)
    assert.equal(state.status, 'ok')
    assert.equal(state.latest, '99.0.0')
    assert.equal(state.updateAvailable, true)
    assert.equal(state.registry, 'https://mirror.example')
    assert.equal(state.pendingRestart, undefined)
  } finally {
    stub.restore()
    await cleanup()
  }
})

test('a second read is served from the cache until a check is asked for', async () => {
  const stub = stubFetch({ 'https://mirror.example/dsh-custom-theme/latest': { body: { version: '99.0.0' } } })
  const { route, cleanup } = await start({ manager: managerOn('https://mirror.example/') })
  try {
    await request(route, '/dsh-custom-theme/update')
    await request(route, '/dsh-custom-theme/update')
    const afterReads = stub.calls.length
    assert.equal(afterReads, 1, 'a cached answer must not ask the registry again')
    // The explicit check ignores the cache and asks once more.
    const checked = JSON.parse((await request(route, '/dsh-custom-theme/update/check', 'POST')).body)
    assert.equal(checked.status, 'ok')
    assert.equal(stub.calls.length, 2)
  } finally {
    stub.restore()
    await cleanup()
  }
})

test('the update actions answer POST only', async () => {
  const { route, cleanup } = await start()
  try {
    // A GET has to stay safe for a link, a prefetch or an image, none of which may
    // start an install.
    assert.equal((await request(route, '/dsh-custom-theme/update/check', 'GET')).status, 405)
    assert.equal((await request(route, '/dsh-custom-theme/update/apply', 'GET')).status, 405)
    assert.equal((await request(route, '/dsh-custom-theme/update', 'POST')).status, 405)
    // The read route keeps answering normally.
    assert.equal((await request(route, '/dsh-custom-theme/update')).status, 200)
  } finally {
    await cleanup()
  }
})

test('applying installs the resolved version and reports the required restart', async () => {
  const stub = stubFetch({ 'https://mirror.example/dsh-custom-theme/latest': { body: { version: '99.0.0' } } })
  const installed = []
  const manager = managerOn('https://mirror.example/', {
    async installBundle(spec, options) {
      installed.push({ spec, options })
      return { stage: 'enable', application: 'restart-required' }
    },
  })
  const { route, cleanup } = await start({ manager })
  try {
    await request(route, '/dsh-custom-theme/update')
    const answer = JSON.parse((await request(route, '/dsh-custom-theme/update/apply', 'POST')).body)
    assert.equal(answer.status, 'ok')
    assert.equal(answer.spec, 'dsh-custom-theme@99.0.0')
    assert.deepEqual(installed, [{ spec: 'dsh-custom-theme@99.0.0', options: { enabled: true } }])
    assert.equal(answer.application, 'restart-required')
    assert.equal(answer.restartRequired, true)
    assert.equal(answer.pendingRestart, '99.0.0')
    // The next read reports the pending restart instead of offering it all over
    // again: the new code is on disk, but this process still runs the old module.
    const after = JSON.parse((await request(route, '/dsh-custom-theme/update')).body)
    assert.equal(after.updateAvailable, false)
    assert.equal(after.pendingRestart, '99.0.0')
  } finally {
    stub.restore()
    await cleanup()
  }
})

test('applying refuses when nothing newer is known', async () => {
  const stub = stubFetch({ 'https://mirror.example/dsh-custom-theme/latest': { body: { version: '0.0.1' } } })
  const { route, cleanup } = await start({ manager: managerOn('https://mirror.example/') })
  try {
    await request(route, '/dsh-custom-theme/update')
    const answer = JSON.parse((await request(route, '/dsh-custom-theme/update/apply', 'POST')).body)
    assert.equal(answer.status, 'error')
    assert.match(answer.reason, /already the latest/u)
  } finally {
    stub.restore()
    await cleanup()
  }
})

test('applying refuses when the plugin manager is not mounted', async () => {
  const { route, cleanup } = await start()
  try {
    const answer = JSON.parse((await request(route, '/dsh-custom-theme/update/apply', 'POST')).body)
    assert.equal(answer.status, 'error')
    assert.match(answer.reason, /has been resolved yet/u)
  } finally {
    await cleanup()
  }
})

test('a failed install is reported as a failure, not as a pending restart', async () => {
  // `installBundle` resolves for a failed run too, so a resolved promise is not
  // evidence that the upgrade happened.
  const stub = stubFetch({ 'https://mirror.example/dsh-custom-theme/latest': { body: { version: '99.0.0' } } })
  const manager = managerOn('https://mirror.example/', {
    async installBundle() {
      return {
        stage: 'install',
        application: 'failed',
        error: { code: 'operation-error', diagnostic: 'EPERM: operation not permitted, rename' },
      }
    },
  })
  const { route, cleanup } = await start({ manager })
  try {
    await request(route, '/dsh-custom-theme/update')
    const answer = JSON.parse((await request(route, '/dsh-custom-theme/update/apply', 'POST')).body)
    assert.equal(answer.status, 'error')
    assert.equal(answer.application, 'failed')
    assert.equal(answer.restartRequired, false)
    assert.match(answer.reason, /EPERM/u)
    // Nothing was installed, so the upgrade must still be on offer.
    const after = JSON.parse((await request(route, '/dsh-custom-theme/update')).body)
    assert.equal(after.updateAvailable, true)
    assert.equal(after.pendingRestart, undefined)
  } finally {
    stub.restore()
    await cleanup()
  }
})
