#!/usr/bin/env node
/*
 * dsh-custom-theme — install the temporary diagnostics instrument build.
 *
 *   node test/diagnostics/install.mjs [--profile <dir>] [--dry-run]
 *
 * Only the INSTALLED plugin is written; the repository's own `lib/client.js` and
 * `src/index.mjs` are never touched. Before writing, the pristine files are
 * copied into `<plugin>/.dct-diag-backup/` with a manifest of their SHA-256s;
 * `restore.mjs` puts them back.
 *
 * Why the write is not a plain overwrite: the installed files are pnpm
 * store hardlinks (`fsutil hardlink list` shows
 * `...\pnpm\store\v11\files\..\..`), and `src/index.mjs` is additionally shared
 * with other profiles. Writing in place would edit the content-addressed store
 * and every other profile linked to the same content. The installer therefore
 * writes a sibling temp file and renames it over the target, which breaks the
 * link and leaves every other copy byte-identical.
 */

import { createHash } from 'node:crypto'
import { cp, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

/** Marker written into both halves; its presence means "already instrumented". */
const MARKER = 'DCT DIAGNOSTICS'
/** Marker for the Host half. */
const HOST_MARKER = 'dsh-custom-theme-diag/1'
/** Backup directory inside the installed package. */
const BACKUP_DIRNAME = '.dct-diag-backup'

const DEFAULT_PLUGIN = 'C:\\Users\\ASUS\\.dsh\\profiles\\desktop\\node_modules\\dsh-custom-theme'

function parseArgs(argv) {
  const options = { profile: DEFAULT_PLUGIN, dryRun: false }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--profile') {
      index += 1
      if (argv[index] === undefined) throw new Error('--profile needs a directory')
      options.profile = argv[index]
    } else if (arg === '--help' || arg === '-h') options.help = true
    else throw new Error(`unknown argument: ${arg}`)
  }
  return options
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

/** The dominant line ending of a file, so an edit keeps the file's own style. */
function eolOf(source) {
  return source.includes('\r\n') ? '\r\n' : '\n'
}

/** Rewrite every line ending in a literal to `eol` (the shipped bundle is CRLF). */
function toEol(text, eol) {
  return text.replace(/\r\n/gu, '\n').split('\n').join(eol)
}

/** The anchors of an edit list, expressed in one file's line endings. */
function inEol(edits, eol) {
  return edits.map((edit) => ({ ...edit, find: toEol(edit.find, eol), replace: toEol(edit.replace, eol) }))
}

/**
 * Replace one anchor exactly once.
 * @param source - File text.
 * @param edit - `{ find, replace, what }`.
 * @returns The text with the anchor replaced.
 */
function applyEdit(source, edit) {
  const first = source.indexOf(edit.find)
  if (first === -1) throw new Error(`anchor missing (${edit.what}): ${JSON.stringify(edit.find.slice(0, 70))}`)
  if (source.indexOf(edit.find, first + 1) !== -1) throw new Error(`anchor is not unique (${edit.what})`)
  return source.slice(0, first) + edit.replace + source.slice(first + edit.find.length)
}

function applyEdits(source, edits) {
  let out = source
  for (const edit of edits) out = applyEdit(out, edit)
  return out
}

/** The client-half wiring: the runtime plus one wrapper per instrumented pass. */
function clientEdits(runtime) {
  return [
    {
      what: 'runtime',
      find: '    const h = React.createElement\n',
      replace: `    const h = React.createElement\n\n${runtime}\n`,
    },
    {
      what: 'applyBackgrounds call',
      find: '      if (applyBackgrounds(settings)) return\n',
      replace: "      if (__dctDiag.pass('applyBackgrounds', () => applyBackgrounds(settings), 'when-ready')) return\n",
    },
    {
      what: 'applyBackgroundsWhenReady retry',
      find: '        applyBackgroundsWhenReady(settings, attempt + 1)\n',
      replace: "        __dctDiag.pass('applyBackgroundsWhenReady', () => applyBackgroundsWhenReady(settings, attempt + 1), 'retry')\n",
    },
    {
      what: 'zone observer open',
      find: '      zoneObserver = new window.MutationObserver(() => {\n',
      replace: "      zoneObserver = new window.MutationObserver(() => {\n        __dctDiag.pass('zoneObserver', () => {\n",
    },
    {
      what: 'zone observer body',
      find: '        applyBackgroundsWhenReady(readSavedBackgrounds())\n      })\n      zoneObserver.observe(document.body, { childList: true, subtree: true })\n',
      replace: "        __dctDiag.pass('applyBackgroundsWhenReady', () => applyBackgroundsWhenReady(readSavedBackgrounds()), 'zone-observer')\n        }, 'mutation')\n      })\n      zoneObserver.observe(document.body, { childList: true, subtree: true })\n",
    },
    {
      what: 'appearance passes',
      find: '      tickStreamInk()\n      tickReasoningExpand()\n',
      replace: "      __dctDiag.pass('tickStreamInk', () => tickStreamInk(), 'appearance')\n      __dctDiag.pass('tickReasoningExpand', () => tickReasoningExpand(), 'appearance')\n",
    },
    {
      what: 'stream ink frame batch',
      find: '        tickStreamInk(batch)\n',
      replace: "        __dctDiag.pass('tickStreamInk', () => tickStreamInk(batch), 'raf-batch')\n",
    },
    {
      what: 'live ink context source',
      find: '    const streamInkLive = new Set()\n',
      replace: '    const streamInkLive = new Set()\n    // DCT DIAG: the live-ink count carried as context on every sample.\n    __dctDiag.setContextSource(() => ({ ink: streamInkLive.size }))\n',
    },
    {
      what: 'reasoning document query',
      find: '      const thinkNodes = document.querySelectorAll(\'[data-variant="think"]\')\n',
      replace: "      const thinkNodes = __dctDiag.query(() => document.querySelectorAll('[data-variant=\"think\"]'))\n",
    },
    {
      what: 'reasoning observer open',
      find: '      reasoningObserver = new window.MutationObserver((records) => {\n',
      replace: "      reasoningObserver = new window.MutationObserver((records) => {\n        __dctDiag.pass('mutationObserver', () => {\n",
    },
    {
      what: 'reasoning observer body',
      find: '          scheduleStreamInk(streamInkTargets(records))\n          if (reasoningTouched(records)) tickReasoningExpand()\n',
      replace: "          const targets = streamInkTargets(records)\n          __dctDiag.countTextNodes(targets.length)\n          scheduleStreamInk(targets)\n          if (reasoningTouched(records)) __dctDiag.pass('tickReasoningExpand', () => tickReasoningExpand(), 'mutation-observer')\n",
    },
    {
      what: 'reasoning observer close',
      find: '          isStreamMutating = false\n        }\n      })\n',
      replace: "          isStreamMutating = false\n        }\n        }, `records=${records.length}`)\n      })\n",
    },
    {
      what: 'boot backgrounds',
      find: '    // Backgrounds apply on boot whether or not the settings page is ever opened.\n    applyBackgroundsWhenReady(readSavedBackgrounds())\n',
      replace: "    // Backgrounds apply on boot whether or not the settings page is ever opened.\n    __dctDiag.pass('applyBackgroundsWhenReady', () => applyBackgroundsWhenReady(readSavedBackgrounds()), 'boot')\n",
    },
    {
      what: 'settings theme change repaint',
      find: '          // be repainted whenever the palette under them changes.\n          applyBackgroundsWhenReady(backgrounds)\n',
      replace: "          // be repainted whenever the palette under them changes.\n          __dctDiag.pass('applyBackgroundsWhenReady', () => applyBackgroundsWhenReady(backgrounds), 'settings-theme-change')\n",
    },
    {
      what: 'settings zone commit repaint',
      find: '        writeSavedBackgrounds(backgrounds)\n        applyBackgroundsWhenReady(backgrounds)\n',
      replace: "        writeSavedBackgrounds(backgrounds)\n        __dctDiag.pass('applyBackgroundsWhenReady', () => applyBackgroundsWhenReady(backgrounds), 'settings-zone-commit')\n",
    },
  ]
}

/** The host-half wiring: the diag route and its two imports. */
function hostEdits(snippet) {
  return [
    {
      what: 'fs import',
      find: "import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'\n",
      replace: "import { appendFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'\n",
    },
    {
      what: 'path import',
      find: "import { join } from 'node:path'\n",
      replace: "import { dirname, join } from 'node:path'\n",
    },
    {
      what: 'diag route helpers',
      find: 'function decodePath(value) {\n  try {\n    return decodeURIComponent(value)\n  } catch {\n    return undefined\n  }\n}\n',
      replace: `function decodePath(value) {\n  try {\n    return decodeURIComponent(value)\n  } catch {\n    return undefined\n  }\n}\n\n${snippet}\n`,
    },
    {
      what: 'diag route dispatch',
      find: '  const method = req.method ?? \'GET\'\n',
      replace: "  const method = req.method ?? 'GET'\n\n  // DCT DIAG (instrument build): the renderer's diagnostics are appended to a\n  // JSON-lines file on disk. Additive: this branch answers and returns, so every\n  // route below it is untouched.\n  if (rest === 'diag') {\n    await handleDiagnostics(req, res, method)\n    return\n  }\n",
    },
  ]
}

/**
 * Write a file without touching a shared inode: a sibling temp file is renamed
 * over the target, so any hardlink the target had is broken rather than edited.
 * @param target - Absolute file path.
 * @param text - New contents.
 */
async function replaceFile(target, text) {
  const temp = `${target}.dct-diag-new`
  await writeFile(temp, text, 'utf8')
  await rm(target, { force: true })
  await rename(temp, target)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log('usage: node test/diagnostics/install.mjs [--profile <plugin dir>] [--dry-run]')
    return
  }
  const plugin = resolve(options.profile)
  const clientPath = join(plugin, 'lib', 'client.js')
  const hostPath = join(plugin, 'src', 'index.mjs')
  const backupDir = join(plugin, BACKUP_DIRNAME)

  const clientSource = await readFile(clientPath, 'utf8')
  const hostSource = await readFile(hostPath, 'utf8')
  if (clientSource.includes(MARKER) || hostSource.includes(HOST_MARKER)) {
    console.error(`refusing to install: ${plugin} is already instrumented. Run restore.mjs first.`)
    process.exitCode = 2
    return
  }

  const runtime = (await readFile(join(HERE, 'diag-runtime.js'), 'utf8')).trimEnd()
  const snippet = (await readFile(join(HERE, 'diag-host-route.js'), 'utf8')).trimEnd()
  const clientEol = eolOf(clientSource)
  const hostEol = eolOf(hostSource)
  const instrumentedClient = applyEdits(clientSource, inEol(clientEdits(runtime), clientEol))
  const instrumentedHost = applyEdits(hostSource, inEol(hostEdits(snippet), hostEol))

  // Parse the client bundle without running it, and import the host module for
  // real: a syntax error in either is caught before anything is written.
  try {
    // eslint-disable-next-line no-new-func
    new Function(instrumentedClient)
  } catch (error) {
    console.error(`the instrumented client bundle does not parse: ${error.message}`)
    process.exitCode = 3
    return
  }

  const report = {
    plugin,
    client: { path: clientPath, before: sha256(clientSource), after: sha256(instrumentedClient), bytes: Buffer.byteLength(instrumentedClient, 'utf8') },
    host: { path: hostPath, before: sha256(hostSource), after: sha256(instrumentedHost), bytes: Buffer.byteLength(instrumentedHost, 'utf8') },
  }

  if (options.dryRun) {
    console.log(JSON.stringify({ ...report, dryRun: true }, null, 2))
    return
  }

  // Back up first, and never overwrite an existing backup: after a first
  // install the on-disk files are instrumented, so a second run must not
  // mistake them for pristine.
  await mkdir(backupDir, { recursive: true })
  const manifestPath = join(backupDir, 'manifest.json')
  let manifest
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  } catch {
    manifest = null
  }
  if (manifest === null) {
    await cp(clientPath, join(backupDir, 'client.js'), { force: true })
    await cp(hostPath, join(backupDir, 'index.mjs'), { force: true })
    const backupClient = await readFile(join(backupDir, 'client.js'))
    const backupHost = await readFile(join(backupDir, 'index.mjs'))
    if (sha256(backupClient) !== report.client.before || sha256(backupHost) !== report.host.before) {
      throw new Error('the backup copy does not match the file it was taken from')
    }
    manifest = {
      createdAt: new Date().toISOString(),
      plugin,
      client: { file: 'client.js', target: clientPath, sha256: report.client.before, bytes: Buffer.byteLength(backupClient, 'utf8') },
      host: { file: 'index.mjs', target: hostPath, sha256: report.host.before, bytes: Buffer.byteLength(backupHost, 'utf8') },
      instrument: { client: report.client.after, host: report.host.after },
    }
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  } else if (manifest.client.sha256 !== report.client.before || manifest.host.sha256 !== report.host.before) {
    throw new Error(`the on-disk files do not match the pristine backup in ${backupDir}; refusing to install over them`)
  } else {
    // A re-install keeps the pristine hashes but must refresh what "instrumented"
    // means, so `restore.mjs --verify-only` still reports the current build.
    manifest.instrument = { client: report.client.after, host: report.host.after }
    manifest.reinstalledAt = new Date().toISOString()
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  }

  await replaceFile(clientPath, instrumentedClient)
  await replaceFile(hostPath, instrumentedHost)

  // Verify what landed, and that the pnpm store links were broken rather than
  // followed: a target with more than one link is still shared with the store.
  const wroteClient = await readFile(clientPath, 'utf8')
  const links = { client: (await stat(clientPath)).nlink, host: (await stat(hostPath)).nlink }
  const hostModule = await import(`${pathToFileURL(hostPath).href}?dct-diag=${Date.now()}`)
  console.log(JSON.stringify({
    ok: true,
    ...report,
    backup: { directory: backupDir, manifest: manifestPath },
    verified: {
      clientParses: true,
      clientShaMatches: sha256(wroteClient) === report.client.after,
      hostExports: { name: hostModule.name, apply: typeof hostModule.apply },
      hardlinks: links,
    },
    logFile: process.env.DCT_DIAG_LOG ?? join(dirname(dirname(plugin)), 'dct-diagnostics.log'),
  }, null, 2))
  if (links.client !== 1 || links.host !== 1) {
    console.error('warning: a target still has more than one hardlink; verify the pnpm store was not edited')
  }
}

await main().catch((error) => {
  console.error(`install failed: ${error.message}`)
  process.exitCode = 1
})
