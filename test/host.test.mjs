// Host half coverage: exports, directory preparation, seeding, the listing and
// asset routes, path-traversal rejection, and the guarantee that a later start
// never overwrites a user's file.

import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import * as plugin from '../src/index.mjs'
import { MAX_BACKGROUND_BYTES } from '../src/themes.mjs'

/** Bytes carrying a real PNG signature, so sniffing accepts them. */
function pngBytes(payload = 'x') {
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from(payload, 'utf8'),
  ])
}

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

/**
 * Drive one request through a captured route and collect the response.
 * @param route - Captured route.
 * @param path - Request path, query string included.
 * @param method - HTTP method.
 * @param body - Optional request body; the request yields it as one chunk.
 */
function request(route, path, method = 'GET', body) {
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
    const req = {
      url: path,
      method,
      destroyed: false,
      destroy() {
        this.destroyed = true
      },
      async *[Symbol.asyncIterator]() {
        if (body !== undefined) yield Buffer.isBuffer(body) ? body : Buffer.from(body)
      },
    }
    Promise.resolve(route.handler(req, res)).catch(reject)
  })
}

/**
 * Give this process a home of its own, so a test can never reach a real profile.
 *
 * The reasoning-level feature edits the profile that loaded the plugin, and it finds it through
 * the environment DSH exports — which a suite started from inside DSH inherits. Without this,
 * every `apply` in this file would resolve that feature against the machine's own profile.
 * @param home - Temporary home directory.
 * @param profile - Profile directory to point `DSH_PROFILE_DIR` at, or `null` for a name no
 *   profile has: the feature then finds no patch file and writes nothing.
 * @returns A function that puts the environment back as it was.
 */
function isolateDshHome(home, profile = null) {
  const previous = {
    home: process.env.DSH_HOME,
    profile: process.env.DSH_PROFILE,
    directory: process.env.DSH_PROFILE_DIR,
  }
  process.env.DSH_HOME = home
  process.env.DSH_PROFILE = 'dsh-custom-theme-test'
  if (profile === null) delete process.env.DSH_PROFILE_DIR
  else process.env.DSH_PROFILE_DIR = profile
  return () => {
    for (const [name, value] of [['DSH_HOME', previous.home], ['DSH_PROFILE', previous.profile], ['DSH_PROFILE_DIR', previous.directory]]) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
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
  const home = await mkdtemp(join(tmpdir(), 'dsh-custom-home-'))
  const restore = isolateDshHome(home)
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
      restore()
      await rm(themes, { recursive: true, force: true })
      await rm(backgrounds, { recursive: true, force: true })
      await rm(home, { recursive: true, force: true })
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

test('stores an uploaded picture and offers it to every zone', async () => {
  const { backgrounds, route, cleanup } = await start()
  try {
    const answer = await request(route, '/dsh-custom-theme/backgrounds?name=wallpaper.png', 'POST', pngBytes('one'))
    assert.equal(answer.status, 200)
    const body = JSON.parse(answer.body)
    assert.equal(body.name, 'wallpaper.png')
    // What lands on disk is exactly what was uploaded, so a picture picked from the
    // file dialog is the same kind of citizen as one dropped into the directory.
    assert.deepEqual(await readdir(backgrounds), ['wallpaper.png'])
    assert.deepEqual(await readFile(join(backgrounds, 'wallpaper.png')), pngBytes('one'))
    assert.deepEqual(body.backgrounds, [{ name: 'wallpaper.png', url: '/dsh-custom-theme/background/wallpaper.png' }])

    // And it is then served back with the type its own bytes show.
    const served = await request(route, '/dsh-custom-theme/background/wallpaper.png')
    assert.equal(served.status, 200)
    assert.equal(served.headers['content-type'], 'image/png')
    assert.deepEqual(served.body, pngBytes('one'))
  } finally {
    await cleanup()
  }
})

test('re-uploading the same picture reuses its name instead of piling up copies', async () => {
  const { backgrounds, route, cleanup } = await start()
  try {
    const first = JSON.parse((await request(route, '/dsh-custom-theme/backgrounds?name=sky.png', 'POST', pngBytes('same'))).body)
    const second = JSON.parse((await request(route, '/dsh-custom-theme/backgrounds?name=sky.png', 'POST', pngBytes('same'))).body)
    assert.equal(first.name, 'sky.png')
    assert.equal(second.name, 'sky.png')
    assert.deepEqual(await readdir(backgrounds), ['sky.png'])
  } finally {
    await cleanup()
  }
})

test('a different picture with the same name is kept beside the first, never over it', async () => {
  const { backgrounds, route, cleanup } = await start()
  try {
    const first = JSON.parse((await request(route, '/dsh-custom-theme/backgrounds?name=sky.png', 'POST', pngBytes('first'))).body)
    const second = JSON.parse((await request(route, '/dsh-custom-theme/backgrounds?name=sky.png', 'POST', pngBytes('second'))).body)
    assert.equal(first.name, 'sky.png')
    assert.equal(second.name, 'sky-1.png')
    assert.deepEqual((await readdir(backgrounds)).sort(), ['sky-1.png', 'sky.png'])
    assert.deepEqual(await readFile(join(backgrounds, 'sky.png')), pngBytes('first'))
  } finally {
    await cleanup()
  }
})

test('an upload is stored under the format its bytes show, not the name it claims', async () => {
  const { backgrounds, route, cleanup } = await start()
  try {
    // A browser-reported name and content type are both the caller's word.
    const body = JSON.parse((await request(route, '/dsh-custom-theme/backgrounds?name=holiday.gif', 'POST', pngBytes('real'))).body)
    assert.equal(body.name, 'holiday.png')
    assert.deepEqual(await readdir(backgrounds), ['holiday.png'])
  } finally {
    await cleanup()
  }
})

test('an upload cannot name a path outside the background directory', async () => {
  const { backgrounds, route, cleanup } = await start()
  try {
    for (const [index, name] of ['..%2F..%2Fevil.png', '..%5C..%5Cevil.png', '%2Fabs%2Fevil.png'].entries()) {
      const body = JSON.parse((await request(route, `/dsh-custom-theme/backgrounds?name=${name}`, 'POST', pngBytes(`x${index}`))).body)
      // Only the last segment survives as the name; the traversal is gone. The three
      // bodies differ, so each lands under the next free name.
      assert.match(body.name, /^evil(-\d+)?\.png$/u, name)
    }
    // All three landed inside the directory under the folded name: had any escaped,
    // the names below would be missing.
    assert.deepEqual((await readdir(backgrounds)).sort(), ['evil-1.png', 'evil-2.png', 'evil.png'])
  } finally {
    await cleanup()
  }
})

test('refuses an upload that is no picture, empty, or too large', async () => {
  const { backgrounds, route, cleanup } = await start()
  try {
    const notImage = await request(route, '/dsh-custom-theme/backgrounds?name=x.png', 'POST', Buffer.from('<html><body>hi', 'utf8'))
    assert.equal(notImage.status, 415)

    const empty = await request(route, '/dsh-custom-theme/backgrounds?name=x.png', 'POST', Buffer.alloc(0))
    assert.equal(empty.status, 400)

    // The size is checked while reading, so an oversized body is never buffered whole
    // and never reaches the directory.
    const huge = await request(route, '/dsh-custom-theme/backgrounds?name=x.png', 'POST', Buffer.concat([pngBytes(''), Buffer.alloc(MAX_BACKGROUND_BYTES)]))
    assert.equal(huge.status, 413)

    assert.deepEqual(await readdir(backgrounds), [])
  } finally {
    await cleanup()
  }
})

test('the upload route is not reachable as a read', async () => {
  const { route, cleanup } = await start()
  try {
    // Only the write method may store a picture; a GET and a PUT stay refused.
    assert.equal((await request(route, '/dsh-custom-theme/backgrounds?name=x.png', 'PUT', pngBytes('x'))).status, 405)
    assert.equal((await request(route, '/dsh-custom-theme/backgrounds', 'GET')).status, 200)
  } finally {
    await cleanup()
  }
})

/*
 * The reasoning levels.
 *
 * The feature edits the *profile's* patch file, so these tests give the plugin a home and a
 * profile of its own: nothing else on the machine is read, and nothing else is written.
 */

/** A profile patch file with a declared model, a `false` one and an undeclared one. */
const PROFILE_PATCH = `- id: llm-pi-ai
  name: "@deepseek-ai/dsh-llm-pi-ai"
  config:
    providers:
      amkr:
        apiKeyEnv: AMKR_API_KEY
        models:
          - id: declared
            name: declared
            reasoningEfforts:
              low: low
              high: high
          # 非推理模型。
          - id: false-one
            name: false-one
            reasoningEfforts: false
          - id: bare
            name: bare
- id: ui-chat
  name: "@deepseek-ai/dsh-client-ui-chat"
  config:
    transcriptView: standard
`

/**
 * Start the plugin with a home and a profile of its own.
 * @param options - `patch` is the file's text; `null` leaves the profile without one.
 * @returns The paths, the captured route and a cleanup that also puts the environment back.
 */
async function startProfile({ patch = PROFILE_PATCH } = {}) {
  const home = await mkdtemp(join(tmpdir(), 'dsh-custom-home-'))
  const themes = await mkdtemp(join(tmpdir(), 'dsh-custom-theme-'))
  const backgrounds = await mkdtemp(join(tmpdir(), 'dsh-custom-backgrounds-'))
  const profile = join(home, 'profiles', 'p1')
  await mkdir(profile, { recursive: true })
  const file = join(profile, 'cordis.patch.yml')
  if (patch !== null) await writeFile(file, patch)
  // The shape DSH really exports for a running profile, which is also what the feature reads.
  const restore = isolateDshHome(home, profile)
  const { ctx, routes } = makeContext({})
  plugin.apply(ctx, { themesDir: themes, backgroundsDir: backgrounds })
  assert.equal(routes.length, 1)
  return {
    home,
    themes,
    backgrounds,
    profile,
    file,
    route: routes[0],
    async cleanup() {
      // The environment is global: a test that leaves it set changes what the next one sees.
      restore()
      for (const directory of [home, themes, backgrounds]) await rm(directory, { recursive: true, force: true })
    },
  }
}

/** The state the route reports. */
async function effortState(route) {
  const answer = await request(route, '/dsh-custom-theme/effort-levels')
  assert.equal(answer.status, 200)
  return JSON.parse(answer.body)
}

test('a model that declares no reasoning levels is given them, and a copy of the file is kept', async () => {
  const run = await startProfile()
  try {
    // The boot pass runs on its own; the route is where it is awaited. A read changes nothing —
    // what it reports is the file it found, and that the running profile has not read it yet.
    const answer = await effortState(run.route)
    assert.equal(answer.enabled, true)
    assert.equal(answer.changed, false, 'a read edited the file')
    assert.equal(answer.restartRequired, true, 'a patch the runtime has not read is not in force yet')
    assert.equal(answer.file, run.file)
    assert.deepEqual(answer.undeclared, [], 'the file still holds a model with nothing to offer')
    assert.deepEqual(answer.managed, ['false-one', 'bare'])

    const text = await readFile(run.file, 'utf8')
    assert.ok(text.includes('reasoningEfforts: # dsh-custom-theme:managed-from-false'), 'the false was not replaced')
    assert.match(text, /reasoningEfforts: # dsh-custom-theme:managed$/mu)
    assert.ok(text.includes('              low: low\n              high: high'), 'the declared list moved')
    // `off` is named and stops there. A value on it would be sent by every request that names no
    // level — automatic compaction and session titles among them — and an OpenAI-style gateway
    // spells thinking off `none`, so `off` is a 400 there.
    assert.equal((text.match(/^\s+"off":$/gmu) ?? []).length, 2, 'a managed off is not valueless')
    assert.equal(/(?:^|\n)\s+"off": \S/u.test(text), false, 'a managed off carries a wire value')
    assert.ok(text.includes('          # 非推理模型。'), 'a comment went missing')
    assert.equal(await readFile(`${run.file}.dct-backup`, 'utf8'), PROFILE_PATCH, 'the original was not kept')
  } finally {
    await run.cleanup()
  }
})

test('the switch takes every managed level back out and restores the false', async () => {
  const run = await startProfile()
  try {
    await effortState(run.route)
    const answer = JSON.parse((await request(run.route, '/dsh-custom-theme/effort-levels', 'POST',
      JSON.stringify({ enabled: false }))).body)
    assert.equal(answer.enabled, false)
    assert.equal(answer.changed, true)
    assert.deepEqual(answer.models, ['false-one', 'bare'])
    assert.deepEqual(answer.managed, [])
    assert.equal(await readFile(run.file, 'utf8'), PROFILE_PATCH, 'the file did not come back as the user wrote it')
    // The choice is remembered, and asking again changes nothing.
    assert.deepEqual(JSON.parse(await readFile(join(run.home, 'dsh-custom-theme.effort-levels.json'), 'utf8')),
      { enabled: false })
    const again = await effortState(run.route)
    assert.equal(again.enabled, false)
    assert.equal(again.changed, false)
    assert.equal(await readFile(run.file, 'utf8'), PROFILE_PATCH)
  } finally {
    await run.cleanup()
  }
})

test('a second boot leaves a file that already matches alone, backup included', async () => {
  const run = await startProfile()
  try {
    await effortState(run.route)
    const patched = await readFile(run.file, 'utf8')
    const backup = await readFile(`${run.file}.dct-backup`, 'utf8')
    const { ctx, routes } = makeContext({})
    plugin.apply(ctx, { themesDir: run.themes, backgroundsDir: run.backgrounds })
    const answer = await effortState(routes[0])
    assert.equal(answer.changed, false, 'the second boot rewrote a file that already matched')
    assert.deepEqual(answer.managed, ['false-one', 'bare'])
    assert.equal(await readFile(run.file, 'utf8'), patched)
    assert.equal(await readFile(`${run.file}.dct-backup`, 'utf8'), backup, 'the backup was overwritten')
  } finally {
    await run.cleanup()
  }
})

test('the profile DSH names is the file that gets edited', async () => {
  // `DSH_PROFILE_DIR` is what a running profile exports, and it wins over every other way of
  // finding one: the fallbacks exist for a copy that is not inside a profile, and a wrong pick
  // would edit a profile that is not the one being run.
  const run = await startProfile()
  try {
    process.env.DSH_PROFILE = 'a-profile-that-does-not-exist'
    await effortState(run.route)
    const text = await readFile(run.file, 'utf8')
    assert.equal(text.includes('reasoningEfforts: # dsh-custom-theme:managed'), true,
      'the named profile was ignored')
    await assert.rejects(readdir(join(run.home, 'profiles', 'a-profile-that-does-not-exist')))
  } finally {
    await run.cleanup()
  }
})

test('a profile without a patch file is reported, never guessed at', async () => {
  const run = await startProfile({ patch: null })
  try {
    const answer = await effortState(run.route)
    assert.equal(answer.file, null)
    assert.equal(answer.changed, false)
    assert.equal(answer.restartRequired, false)
    assert.deepEqual(await readdir(run.profile), [], 'something was written into the profile')
  } finally {
    await run.cleanup()
  }
})

test('the reasoning-level route refuses a malformed body and every other method', async () => {
  const run = await startProfile()
  try {
    await effortState(run.route)
    assert.equal((await request(run.route, '/dsh-custom-theme/effort-levels', 'POST', '{nope')).status, 400)
    assert.equal((await request(run.route, '/dsh-custom-theme/effort-levels', 'PUT')).status, 405)
    // An empty body reads as "on", the state the settings page starts from.
    await request(run.route, '/dsh-custom-theme/effort-levels', 'POST', JSON.stringify({ enabled: false }))
    const answer = JSON.parse((await request(run.route, '/dsh-custom-theme/effort-levels', 'POST', '{}')).body)
    assert.equal(answer.enabled, true)
    assert.equal(answer.changed, true)
    assert.notEqual(await readFile(run.file, 'utf8'), PROFILE_PATCH)
  } finally {
    await run.cleanup()
  }
})
