#!/usr/bin/env node
/*
 * dsh-custom-theme — restore the installed plugin from the instrument-build
 * backup, and verify the result by hash.
 *
 *   node test/diagnostics/restore.mjs [--profile <dir>] [--verify-only]
 *
 * `--verify-only` reports whether the installed files are currently pristine
 * (they match the backup manifest) or instrumented, without writing anything.
 * A plain run puts the pristine files back through the same
 * temp-file-then-rename write the installer used, so the pnpm store hardlinks
 * stay untouched, and then re-reads both files to prove the hashes match.
 */

import { createHash } from 'node:crypto'
import { readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

const DEFAULT_PLUGIN = 'C:\\Users\\ASUS\\.dsh\\profiles\\desktop\\node_modules\\dsh-custom-theme'
const BACKUP_DIRNAME = '.dct-diag-backup'

function parseArgs(argv) {
  const options = { profile: DEFAULT_PLUGIN, verifyOnly: false }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--verify-only') options.verifyOnly = true
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

async function hashOf(path) {
  try {
    return sha256(await readFile(path))
  } catch (error) {
    return error.code === 'ENOENT' ? null : `error:${error.code}`
  }
}

/** Write without following a hardlink into the pnpm store (see install.mjs). */
async function replaceFile(target, contents) {
  const temp = `${target}.dct-diag-restore`
  await writeFile(temp, contents)
  await rm(target, { force: true })
  await rename(temp, target)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log('usage: node test/diagnostics/restore.mjs [--profile <plugin dir>] [--verify-only]')
    return
  }
  const plugin = resolve(options.profile)
  const backupDir = join(plugin, BACKUP_DIRNAME)
  const manifest = JSON.parse(await readFile(join(backupDir, 'manifest.json'), 'utf8'))
  const clientPath = manifest.client.target ?? join(plugin, 'lib', 'client.js')
  const hostPath = manifest.host.target ?? join(plugin, 'src', 'index.mjs')

  const before = { client: await hashOf(clientPath), host: await hashOf(hostPath) }
  const pristine = { client: before.client === manifest.client.sha256, host: before.host === manifest.host.sha256 }
  // `instrumented` is only meaningful when the installer refreshed the manifest.
  const instrumented = {
    client: manifest.instrument !== undefined && before.client === manifest.instrument.client,
    host: manifest.instrument !== undefined && before.host === manifest.instrument.host,
  }

  if (options.verifyOnly) {
    const state = pristine.client && pristine.host
      ? 'pristine'
      : instrumented.client && instrumented.host
        ? 'instrumented'
        : 'unknown'
    console.log(JSON.stringify({
      // A known state is a pass: this reports which of the two expected builds is
      // on disk. Only bytes matching neither one is a failure.
      ok: state !== 'unknown',
      verifyOnly: true,
      state,
      client: { path: clientPath, sha256: before.client, pristine: pristine.client, expected: manifest.client.sha256 },
      host: { path: hostPath, sha256: before.host, pristine: pristine.host, expected: manifest.host.sha256 },
      instrumented,
    }, null, 2))
    process.exitCode = state === 'unknown' ? 1 : 0
    return
  }

  const backupClient = await readFile(join(backupDir, manifest.client.file ?? 'client.js'))
  const backupHost = await readFile(join(backupDir, manifest.host.file ?? 'index.mjs'))
  if (sha256(backupClient) !== manifest.client.sha256 || sha256(backupHost) !== manifest.host.sha256) {
    throw new Error(`the backup in ${backupDir} no longer matches its recorded hashes; refusing to restore`)
  }

  await replaceFile(clientPath, backupClient)
  await replaceFile(hostPath, backupHost)

  const after = { client: await hashOf(clientPath), host: await hashOf(hostPath) }
  const restored = { client: after.client === manifest.client.sha256, host: after.host === manifest.host.sha256 }
  const links = { client: (await stat(clientPath)).nlink, host: (await stat(hostPath)).nlink }
  console.log(JSON.stringify({
    ok: restored.client && restored.host,
    restored,
    client: { path: clientPath, sha256: after.client, bytes: Buffer.byteLength(backupClient, 'utf8') },
    host: { path: hostPath, sha256: after.host, bytes: Buffer.byteLength(backupHost, 'utf8') },
    hardlinks: links,
    backupDirectory: backupDir,
  }, null, 2))
  if (!restored.client || !restored.host) {
    console.error('restore verification failed: a file does not match the pristine hash')
    process.exitCode = 1
  }
}

await main().catch((error) => {
  console.error(`restore failed: ${error.message}`)
  process.exitCode = 1
})
