/**
 * The invariants that decide whether this feature is safe to ship: the browser half
 * stays a plain client module, the Host half patches nothing on disk, and the asar
 * surgery the earlier design used can never come back by accident.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readdir, readFile } from 'node:fs/promises'

const read = (name) => readFile(new URL(name, import.meta.url), 'utf8')

test('the browser half never reaches for the debugger, the process or the filesystem', async () => {
  const sources = await Promise.all(['../src/client/tray/hooks.cjs', '../src/client/tray/model.cjs', '../src/client/tray/settings.cjs'].map(read))
  for (const source of sources) {
    assert.doesNotMatch(source, /_debugProcess|queryObjects|inspector|child_process|node:fs|require\('fs'\)/u)
    assert.doesNotMatch(source, /desktop\//u)
  }
  const bundle = await read('../lib/client.js')
  assert.doesNotMatch(bundle, /_debugProcess|queryObjects|tray-main|desktop\/inject/u)
})

test('the Host half patches memory, not files, and never leaves its debug port open', async () => {
  const inject = await read('../src/desktop/inject.mjs')
  const runtime = await read('../src/desktop/tray-runtime.mjs')
  const payload = await read('../src/desktop/tray-main.cjs')
  assert.doesNotMatch(inject + runtime, /app\.asar|asar\.mjs|buildPatchedArchive|changeInstallation|EmbeddedAsarIntegrity/u)
  assert.doesNotMatch(payload, /writeFile|appendFile|renameSync|unlink|rmSync|createWriteStream/u)
  assert.match(inject, /require\('inspector'\)\.close\(\)/u)
  assert.match(inject, /if \(opened\) \{/u)
  assert.match(payload, /electron\.app\.quit\(\)/u, 'quitting stays the application’s own business')
  assert.match(runtime, /autoStart/u)
})

test('the asar patch, its CLI and its launch-time injection are gone for good', async () => {
  const files = await readdir(new URL('../src/desktop', import.meta.url))
  for (const gone of ['asar.mjs', 'patch.mjs', 'install.mjs', 'cli.mjs', 'runtime.cjs', 'app-preload.cjs']) assert.equal(files.includes(gone), false, `${gone} must stay deleted`)
  const pkg = JSON.parse(await read('../package.json'))
  assert.equal(pkg.bin, undefined)
  assert.equal(pkg.scripts.tray, undefined)
  for (const name of ['../src/index.mjs', '../src/host/route.mjs']) {
    const source = await read(name)
    assert.doesNotMatch(source, /changeInstallation|buildPatchedArchive/u)
  }
  assert.match(await read('../src/index.mjs'), /createTrayRuntime/u, 'the Host applies the switch at startup')
  assert.match(await read('../src/host/route.mjs'), /desktop-tray/u, 'the settings row has a route to talk to')
})
