#!/usr/bin/env node
/*
 * dsh-custom-theme — run the repository's own client suite against the
 * INSTALLED instrument build.
 *
 *   node test/diagnostics/suite-check.mjs [--client <path>] [--out <dir>]
 *
 * The repository's `test/client.test.mjs` and `test/harness.mjs` are read and
 * never written: this generates patched copies in a temp directory that load the
 * instrumented bundle instead of `lib/client.js`, then prints the `node --test`
 * command to run. Nothing is spawned here, so the sandbox's pipe restriction does
 * not apply to the suite run itself.
 *
 * The suite's source-level assertions (which encode the "never create, replace or
 * remove a node the shell renders" rule) are pointed at the instrumented file
 * too, so they check the bytes that are actually installed.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_TEST = resolve(HERE, '..')
const DEFAULT_CLIENT = 'C:\\Users\\ASUS\\.dsh\\profiles\\desktop\\node_modules\\dsh-custom-theme\\lib\\client.js'

function parseArgs(argv) {
  const options = { client: DEFAULT_CLIENT, out: join(tmpdir(), 'dct-diag-suite') }
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--client') {
      index += 1
      options.client = argv[index]
    } else if (argv[index] === '--out') {
      index += 1
      options.out = argv[index]
    }
  }
  return options
}

function replaceOnce(source, find, replace, what) {
  const index = source.indexOf(find)
  if (index === -1) throw new Error(`the repository test source changed: ${what} not found`)
  return source.slice(0, index) + replace + source.slice(index + find.length)
}

const options = parseArgs(process.argv.slice(2))
const clientPath = resolve(options.client)
const out = resolve(options.out)
await mkdir(out, { recursive: true })

const harnessSource = await readFile(join(REPO_TEST, 'harness.mjs'), 'utf8')
const suiteSource = await readFile(join(REPO_TEST, 'client.test.mjs'), 'utf8')

const harnessPath = join(out, 'harness-instrumented.mjs')
const suitePath = join(out, 'client-suite.mjs')

const patchedHarness = replaceOnce(
  replaceOnce(
    harnessSource,
    "await import('../lib/client.js')",
    `await import(${JSON.stringify(pathToFileURL(clientPath).href)})`,
    'the client import',
  ),
  "path.resolve(import.meta.dirname, '..', 'themes', `${id}.css`)",
  `path.resolve(${JSON.stringify(join(REPO_TEST, '..', 'themes'))}, \`\${id}.css\`)`,
  'the bundled-theme lookup',
)

const patchedSuite = replaceOnce(
  replaceOnce(
    suiteSource,
    'from "./harness.mjs"',
    `from ${JSON.stringify(pathToFileURL(harnessPath).href)}`,
    'the harness import',
  ),
  'readFileSync(new URL("../lib/client.js", import.meta.url), "utf8")',
  `readFileSync(${JSON.stringify(clientPath)}, "utf8")`,
  'the client-source read',
)

await writeFile(harnessPath, patchedHarness, 'utf8')
await writeFile(suitePath, patchedSuite, 'utf8')

console.log(JSON.stringify({
  ok: true,
  client: clientPath,
  harness: harnessPath,
  suite: suitePath,
  run: `node --test "${suitePath}"`,
  note: 'the repository test sources are only read; the patched copies live in a temp directory',
}, null, 2))
