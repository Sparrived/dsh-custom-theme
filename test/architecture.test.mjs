// The shape of the project itself: the two halves, the bundle between them, what
// ships, and the two ways a mechanical split can break silently.

/*
 * These are the checks that keep the refactor from decaying.
 *
 * A layered split has failure modes no behavioral test reaches: a module that
 * nothing imports (dead code that still ships in the bundle), an import of a name
 * the target does not export (`undefined` until some far-away branch runs), a
 * dependency cycle (loads, but in an order nobody reasoned about), a bundle that no
 * longer matches its sources, and a package that lists files it does not ship. Each
 * one is quiet at run time and obvious here.
 */

import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { BUNDLE_PATH, build, moduleRequests } from '../scripts/build-client.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CLIENT_ROOT = join(ROOT, 'src', 'client')
const ENTRY = './index.cjs'

/** Every file below a directory, as absolute paths. */
function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = join(directory, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}

/** The id a client module is registered under, the way the builder spells it. */
function idOf(absolute) {
  return `./${relative(CLIENT_ROOT, absolute).split(sep).join('/')}`
}

/**
 * The module ids one browser-half module requires, in source order.
 *
 * The scanner is the linker's own, so a request this suite cannot see is a request the build
 * cannot see either: a second, simpler scanner here would disagree with the build in exactly the
 * cases that matter (a `require` inside a comment, a string, or a template literal).
 */
const requestsOf = (source, id) => moduleRequests(source, id)

/** The names nothing in the page provides, however they are spelled. */
const NODE_BUILTINS = new Set(builtinModules.filter((name) => !name.startsWith('_')))

/** Resolve one relative request against the module that made it. */
function resolveRequest(from, request) {
  const segments = `${dirname(from)}/${request}`.split('/')
  const parts = []
  for (const segment of segments) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') parts.pop()
    else parts.push(segment)
  }
  return `./${parts.join('/')}`
}

/** The names a module exports, out of its `module.exports = {…}` / `return {…}`. */
function exportsOf(source) {
  const names = new Set()
  const lines = source.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(?:module\.exports = |  return |    return )\{(.*)/u.exec(lines[index])
    if (match === null) continue
    let body = match[1]
    let cursor = index
    while (!body.includes('}') && cursor + 1 < lines.length) {
      cursor += 1
      body += ` ${lines[cursor].trim()}`
    }
    for (const piece of body.slice(0, body.indexOf('}')).split(',')) {
      const name = piece.split(':')[0].trim()
      if (/^[A-Za-z_$][\w$]*$/u.test(name)) names.add(name)
    }
    index = cursor
  }
  return names
}

/** The browser half, as { id: source } plus its require edges. */
const modules = new Map()
for (const file of walk(CLIENT_ROOT).filter((candidate) => candidate.endsWith('.cjs'))) {
  const id = idOf(file)
  const source = readFileSync(file, 'utf8')
  const requests = requestsOf(source, id)
  modules.set(id, {
    file,
    source,
    requests: requests.filter((request) => request.startsWith('.')),
    all: requests,
  })
}

test('the browser half is one entry plus modules it actually reaches', () => {
  assert.ok(modules.has(ENTRY), `${ENTRY} is missing`)
  const reached = new Set()
  const queue = [ENTRY]
  while (queue.length > 0) {
    const id = queue.pop()
    if (reached.has(id)) continue
    reached.add(id)
    const module = modules.get(id)
    assert.ok(module !== undefined, `${id} is required but does not exist`)
    for (const request of module.requests) queue.push(resolveRequest(id, request))
  }
  const orphans = [...modules.keys()].filter((id) => !reached.has(id)).sort()
  assert.deepEqual(orphans, [], 'modules nothing imports still ship in the bundle')
})

test('every browser-half import names something its target exports', () => {
  const failures = []
  for (const [id, module] of modules) {
    for (const match of module.source.matchAll(/const \{([^}]*)\} = require\('(\.[^']+)'\)/gu)) {
      const target = resolveRequest(id, match[2])
      const other = modules.get(target)
      assert.ok(other !== undefined, `${id}: require('${match[2]}') is not a module in the half`)
      const offered = exportsOf(other.source)
      for (const piece of match[1].split(',')) {
        const name = piece.split(':')[0].trim()
        if (!/^[A-Za-z_$][\w$]*$/u.test(name)) continue
        if (!offered.has(name)) failures.push(`${id}: '${name}' is not exported by ${target}`)
      }
    }
    // The same, for a whole-module factory import.
    for (const match of module.source.matchAll(/^const ([A-Za-z_$][\w$]*) = require\('(\.[^']+)'\)/gmu)) {
      const target = resolveRequest(id, match[2])
      if (!modules.has(target)) assert.fail(`${id}: require('${match[2]}') is not a module in the half`)
    }
  }
  assert.deepEqual(failures, [])
})

test('the browser half has no dependency cycle', () => {
  const state = new Map()
  const cycles = []
  const visit = (id, path) => {
    if (state.get(id) === 'done') return
    if (state.get(id) === 'open') {
      cycles.push([...path.slice(path.indexOf(id)), id].join(' -> '))
      return
    }
    state.set(id, 'open')
    for (const request of modules.get(id)?.requests ?? []) visit(resolveRequest(id, request), [...path, id])
    state.set(id, 'done')
  }
  for (const id of modules.keys()) visit(id, [])
  assert.deepEqual(cycles, [], 'a cycle makes load order load-bearing')
})

test('lib/client.js is exactly what the sources link to', async () => {
  const shipped = readFileSync(BUNDLE_PATH, 'utf8')
  const linked = await build()
  assert.equal(shipped, linked, 'lib/client.js is stale: run `npm run build:client`')
})

test('the halves keep their layer: the host never reaches into the browser half', () => {
  const hostFiles = [
    ...walk(join(ROOT, 'src', 'host')),
    ...readdirSync(join(ROOT, 'src')).filter((name) => name.endsWith('.mjs')).map((name) => join(ROOT, 'src', name)),
  ]
  for (const file of hostFiles) {
    const source = readFileSync(file, 'utf8')
    const label = relative(ROOT, file).split(sep).join('/')
    // Every specifier an import or export statement names, including a bare
    // `import './x.cjs'`, which carries no `from` clause to match on: a side-effect
    // import of the browser half would load it in the DSH process, where the client
    // module system and the DOM do not exist.
    const specifiers = [
      ...[...source.matchAll(/^\s*(?:import|export)\b[^'"]*'([^']+)'/gmu)].map((match) => match[1]),
      ...[...source.matchAll(/\bfrom '([^']+)'/gu)].map((match) => match[1]),
    ]
    for (const request of specifiers) {
      assert.ok(!request.includes('client/'), `${label} imports the browser half ('${request}')`)
      assert.ok(!request.includes('/lib/') && !request.startsWith('../lib'), `${label} imports the built bundle ('${request}')`)
    }
  }
  for (const [id, module] of modules) {
    for (const request of module.all) {
      // Both spellings: `node:fs` and the bare `fs` name the same thing, and the page has neither.
      const name = request.startsWith('node:') ? request.slice('node:'.length) : request
      assert.ok(
        !NODE_BUILTINS.has(name) && !NODE_BUILTINS.has(name.split('/')[0]),
        `${id} imports the Node builtin '${request}', which the page does not have`,
      )
    }
  }
})

test('the halves only ever read and write inside the package', () => {
  // The plugin runs in a user's profile: a stray absolute path would still work on
  // the machine it was written on and fail everywhere else. The roots below are the
  // ones a hard-coded path realistically starts with; a URL path such as the route
  // `/dsh-custom-theme` is not a filesystem path and must stay allowed.
  const ABSOLUTE = /['"]([A-Za-z]:[\\/]|\/(?:home|Users|opt|etc|usr|var|tmp|srv|mnt|media|root|Applications|System|Library)\/)[^'"]*['"]/gu
  for (const file of [...walk(join(ROOT, 'src'))]) {
    const source = readFileSync(file, 'utf8')
    const label = relative(ROOT, file).split(sep).join('/')
    for (const match of source.matchAll(ABSOLUTE)) {
      assert.fail(`${label} hard-codes the path ${match[1]}`)
    }
  }
})

test('package.json ships both halves and both entry points exist', () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  assert.equal(manifest.type, 'module')
  assert.equal(manifest.exports['.'], './src/index.mjs')
  assert.equal(manifest.exports['./client'], './lib/client.js')
  assert.equal(manifest.dsh.client.platform, 'web')
  assert.ok(manifest.files.includes('src'), 'the host half ships from src/')
  assert.ok(manifest.files.includes('lib/client.js'), 'the browser half ships as lib/client.js')
  assert.ok(manifest.files.includes('cordis.patch.yml'))
  // The map and the front page are part of the package, not just the repository: they are how a
  // reader of an installed plugin learns which half does what.
  for (const documented of ['ARCHITECTURE.md', 'README.md']) {
    assert.ok(manifest.files.includes(documented), `package.json does not ship ${documented}`)
  }
  // A `files` entry is a promise about the tarball. Naming a directory that does not exist packs
  // nothing and says nothing, which is how a renamed directory ships an empty package.
  for (const entry of manifest.files) {
    assert.ok(existsSync(join(ROOT, entry)), `package.json ships ${entry}, which does not exist`)
  }
  for (const target of [manifest.exports['.'], manifest.exports['./client'], manifest.dsh.bundle.patch]) {
    const file = join(ROOT, target)
    assert.ok(statSync(file).isFile(), `${target} is listed but does not exist`)
  }
  // Every module the bundle links is below src/client, which `files` already ships.
  for (const id of modules.keys()) {
    const file = join(CLIENT_ROOT, id.slice(2))
    assert.ok(statSync(file).isFile(), `${id} is missing on disk`)
  }
})
