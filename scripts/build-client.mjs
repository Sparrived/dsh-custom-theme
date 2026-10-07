#!/usr/bin/env node
/**
 * dsh-custom-theme — client bundle builder.
 *
 * The browser half ships as one file, `lib/client.js`, because that is the only
 * shape DSH's client module system can load: the shell runs a script that
 * registers a lazy factory, and a factory may only `require` what the page has
 * already seeded (React, React DOM). A second package-local script is a separate,
 * asynchronously fetched resource — a factory cannot pull one in synchronously.
 *
 * So the sources live as CommonJS modules under `src/client/`, each one importing
 * what it uses, and this script links them into that single lazy-CJS bundle. It is
 * deliberately small and dependency-free. Each module's text is embedded as it
 * stands — every line indented by two columns so the registry reads as one file, and
 * CRLF normalised to LF — with its `require` calls left in place, because the bundle
 * carries the resolver that runs them. What is resolved *here*, once, is whether each
 * request is one the page can satisfy, so a path that does not exist fails the build
 * instead of the page.
 *
 * Usage:
 *   node scripts/build-client.mjs            # write lib/client.js
 *   node scripts/build-client.mjs --check    # fail when lib/client.js is stale
 *   node scripts/build-client.mjs --stdout   # print the bundle
 *
 * `build()` is exported so the suite can link the sources in memory and compare the
 * result with the committed artifact, without starting a second process.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE_ROOT = join(ROOT, 'src', 'client')
const ENTRY = './index.cjs'
const OUTPUT = join(ROOT, 'lib', 'client.js')

/**
 * Module requests a factory may hand to the shell's loader.
 *
 * The page seeds React and Cordis; every other package a plugin wants has to be
 * named in `dsh.client.external` in `package.json`. This package declares none:
 * it depends on React and React DOM and nothing else.
 */
const EXTERNAL = new Set(['react', 'react-dom'])

/** The bundle's identity: the id the shell registers and resolves the row by. */
const MODULE_ID = 'dsh-custom-theme'

/**
 * Skip one quoted string or template literal.
 * @param source - Source text.
 * @param start - Index of the opening quote.
 * @returns The index just past the literal.
 */
function skipLiteral(source, start) {
  const quote = source[start]
  let index = start + 1
  while (index < source.length) {
    if (source[index] === '\\') { index += 2; continue }
    if (source[index] === quote) return index + 1
    index += 1
  }
  return source.length
}

/**
 * Every module request a source file makes, comments and strings excluded.
 *
 * A request must be a literal: the bundle resolves ids at build time and has no
 * directory to search, so a computed one is a build error.
 * @param source - Module source text.
 * @param id - Module id, for failure messages.
 * @returns The request strings, in source order.
 */
export function moduleRequests(source, id) {
  const requests = []
  let index = 0
  while (index < source.length) {
    const character = source[index]
    if (character === '/' && source[index + 1] === '/') {
      const end = source.indexOf('\n', index)
      index = end === -1 ? source.length : end + 1
      continue
    }
    if (character === '/' && source[index + 1] === '*') {
      const end = source.indexOf('*/', index + 2)
      index = end === -1 ? source.length : end + 2
      continue
    }
    if (character === '"' || character === "'" || character === '`') {
      index = skipLiteral(source, index)
      continue
    }
    if (source.startsWith('require', index)
      && !/[\w$.]/u.test(source[index - 1] ?? '')
      && !/[\w$]/u.test(source[index + 'require'.length] ?? '')) {
      let cursor = index + 'require'.length
      while (/\s/u.test(source[cursor] ?? '')) cursor += 1
      if (source[cursor] === '(') {
        cursor += 1
        while (/\s/u.test(source[cursor] ?? '')) cursor += 1
        const quote = source[cursor]
        if (quote !== '"' && quote !== "'") {
          throw new Error(`${id}: a computed require() cannot be linked`)
        }
        const end = source.indexOf(quote, cursor + 1)
        if (end === -1) throw new Error(`${id}: unterminated require() argument`)
        requests.push(source.slice(cursor + 1, end))
        index = end + 1
        continue
      }
    }
    index += 1
  }
  return requests
}

/**
 * Read every client module under `src/client`.
 * @returns Absolute paths, in a stable order.
 */
async function listSources() {
  const found = []
  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const full = join(directory, entry.name)
      if (entry.isDirectory()) await walk(full)
      else if (entry.isFile() && entry.name.endsWith('.cjs')) found.push(full)
    }
  }
  await walk(SOURCE_ROOT)
  return found
}

/**
 * The id a source path is registered under: `./` plus its path below
 * `src/client`, with forward slashes on every platform.
 * @param absolute - Absolute path of a client module.
 * @returns The module id, such as `./effort/slider.cjs`.
 */
function idOf(absolute) {
  return `./${relative(SOURCE_ROOT, absolute).split(sep).join('/')}`
}

/**
 * Resolve one relative request against the module that made it, the way Node
 * does, so a module can move without its requests being rewritten.
 * @param from - Id of the requesting module.
 * @param request - The relative request.
 * @returns The resolved module id.
 */
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

/**
 * The lines that sit inside a multi-line string or template literal.
 *
 * Those lines carry content, not layout: the CSS and markup in this package live
 * in template literals, so shifting them would edit what the plugin injects.
 * @param lines - The module's lines.
 * @returns Indices of the lines that must not be re-indented.
 */
function literalLines(lines) {
  const frozen = new Set()
  let inside = false
  for (let index = 0; index < lines.length; index += 1) {
    if (inside) frozen.add(index)
    const line = lines[index]
    let cursor = 0
    while (cursor < line.length) {
      const character = line[cursor]
      if (inside) {
        if (character === '\\') { cursor += 2; continue }
        if (character === '`') inside = false
        cursor += 1
        continue
      }
      if (character === '/' && line[cursor + 1] === '/') break
      if (character === '"' || character === "'") {
        cursor = skipLiteral(line, cursor)
        continue
      }
      if (character === '`') {
        inside = true
        cursor += 1
        continue
      }
      cursor += 1
    }
  }
  return frozen
}

/**
 * One module body, indented to sit inside its wrapper.
 *
 * Line endings are normalized here: the artifact is generated, so it carries one
 * convention rather than whatever an editor left in a module.
 * @param source - The module's source text.
 * @returns Text for the wrapper body.
 */
function moduleBody(source) {
  const lines = source.replace(/\r\n/gu, '\n').replace(/\n$/u, '').split('\n')
  const frozen = literalLines(lines)
  return lines
    .map((line, index) => (line === '' || frozen.has(index) ? line : `  ${line}`))
    .join('\n')
}

export const BUNDLE_PATH = OUTPUT

/**
 * Link the client modules into the single lazy-CJS bundle the shell loads.
 * @returns The bundle text.
 */
export async function build() {
  const files = await listSources()
  if (files.length === 0) throw new Error(`no client modules under ${SOURCE_ROOT}`)

  const modules = new Map()
  for (const file of files) {
    const id = idOf(file)
    const source = await readFile(file, 'utf8')
    if (!source.endsWith('\n')) throw new Error(`${id}: the file does not end with a newline`)
    modules.set(id, { id, source, requests: moduleRequests(source, id) })
  }
  if (!modules.has(ENTRY)) throw new Error(`the client entry ${ENTRY} is missing`)

  for (const module of modules.values()) {
    for (const request of module.requests) {
      if (!request.startsWith('./') && !request.startsWith('../')) {
        if (!EXTERNAL.has(request)) {
          throw new Error(
            `${module.id}: require('${request}') is not available in the page; ` +
            `only ${[...EXTERNAL].map((name) => `'${name}'`).join(' and ')} are seeded, ` +
            'and anything else has to be declared in dsh.client.external',
          )
        }
        continue
      }
      const target = resolveRequest(module.id, request)
      if (!modules.has(target)) {
        const hint = modules.has(`${target}.cjs`) ? ` (did you mean '${request}.cjs'?)` : ''
        throw new Error(`${module.id}: require('${request}') resolves to '${target}', which is no client module${hint}`)
      }
    }
  }

  // Every module must be reachable from the entry: an unreachable one would still
  // ship, and its body would never run — dead weight nobody notices.
  const reachable = new Set()
  const pending = [ENTRY]
  while (pending.length > 0) {
    const id = pending.pop()
    if (reachable.has(id)) continue
    reachable.add(id)
    for (const request of modules.get(id).requests) {
      if (request.startsWith('./') || request.startsWith('../')) pending.push(resolveRequest(id, request))
    }
  }
  const orphans = [...modules.keys()].filter((id) => !reachable.has(id))
  if (orphans.length > 0) throw new Error(`client modules unreachable from ${ENTRY}: ${orphans.join(', ')}`)

  const ids = [...modules.keys()].sort()
  const widest = Math.max(...ids.map((id) => id.length))
  const parts = [
    '/**',
    ' * dsh-custom-theme — browser half. GENERATED FILE, DO NOT EDIT.',
    ' *',
    ' * Built from the CommonJS modules under `src/client` by `npm run build:client`.',
    ' * The repository holds both, and `npm test` fails when they drift apart: edit',
    ' * the module that owns the code, then rebuild, rather than editing this file.',
    ' *',
    ' * The shell runs this script to register one lazy factory, and running it does',
    ' * nothing else: every module body below runs at materialization, not at load.',
    ' */',
    '',
    'window.__ModuleLoader__.load({',
    `  id: ${JSON.stringify(MODULE_ID)},`,
    '  factory(require) {',
    '    /** Module bodies, keyed by id. A body runs once, at first require. */',
    '    const bodies = Object.create(null)',
    '    /** What each materialized module exported, keyed by id. */',
    '    const loaded = Object.create(null)',
    '',
    '    /**',
    '     * Resolve a request against the module that made it.',
    '     * @param from - Id of the requesting module.',
    '     * @param request - A relative request.',
    '     * @returns The resolved module id.',
    '     */',
    '    function resolve(from, request) {',
    '      const segments = `${from.slice(0, from.lastIndexOf("/"))}/${request}`.split("/")',
    '      const parts = []',
    '      for (const segment of segments) {',
    '        if (segment === "" || segment === ".") continue',
    '        if (segment === "..") parts.pop()',
    '        else parts.push(segment)',
    '      }',
    '      return `./${parts.join("/")}`',
    '    }',
    '',
    '    /**',
    '     * Materialize one module: run its body once, then hand back its exports.',
    '     * @param id - Resolved module id.',
    '     * @param from - Id of the module that asked, for the failure message.',
    '     * @returns The module\'s exports.',
    '     */',
    '    function load(id, from) {',
    '      if (id in loaded) return loaded[id]',
    '      const body = bodies[id]',
    '      if (body === undefined) {',
    '        throw new Error(`dsh-custom-theme: no client module ${id} (required from ${from})`)',
    '      }',
    '      const module = { exports: {} }',
    '      loaded[id] = module.exports',
    '      body(module, module.exports, (request) => {',
    '        if (request.startsWith(".")) return load(resolve(id, request), id)',
    '        return require(request)',
    '      })',
    '      loaded[id] = module.exports',
    '      return module.exports',
    '    }',
    '',
  ]
  for (const id of ids) {
    parts.push(`    /** ${id.slice('./'.length)} */`)
    parts.push(`    bodies[${JSON.stringify(id).padEnd(widest + 2)}] = function (module, exports, require) {`)
    parts.push(moduleBody(modules.get(id).source))
    parts.push('    }')
    parts.push('')
  }
  parts.push(`    return load(${JSON.stringify(ENTRY)}, '<entry>')`)
  parts.push('  },')
  parts.push('})')
  parts.push('')
  return parts.join('\n')
}

/** Run the command line when this file is the process entry, not when it is imported. */
async function main() {
  const flags = new Set(process.argv.slice(2))
  const bundle = await build()
  if (flags.has('--stdout')) {
    process.stdout.write(bundle)
  } else if (flags.has('--check')) {
    let current = null
    try {
      current = await readFile(OUTPUT, 'utf8')
    } catch (error) {
      // A missing artifact is stale by definition. Anything else — a permission problem, a lock —
      // is a read failure, and calling that "stale" sends the reader to rebuild a file they may not
      // be able to read at all.
      if (error?.code !== 'ENOENT') throw error
    }
    if (current !== bundle) {
      console.error('lib/client.js is stale: run `npm run build:client` and commit the result')
      console.error('(if a build is running right now, wait for it: a half-written file reads as stale)')
      process.exit(1)
    }
    console.log('lib/client.js matches src/client/')
  } else {
    await writeFile(OUTPUT, bundle, 'utf8')
    const count = [...bundle.matchAll(/bodies\["/gu)].length
    console.log(`wrote lib/client.js: ${count} modules, ${Buffer.byteLength(bundle)} bytes`)
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main()
}
