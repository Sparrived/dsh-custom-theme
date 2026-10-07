/**
 * Install the tray behaviour into the **running** Desktop main process.
 *
 * There is no supported extension point for the tray: it is a native Electron object
 * owned by the main process. This module therefore uses the one execution channel the
 * Desktop host already has — it is the main process's own child, so it can ask Node to
 * start the main process's inspector (`process._debugProcess`), attach over loopback,
 * evaluate the payload in `src/desktop/tray-main.cjs` and then close the inspector
 * again. Nothing is written to disk, no launch flag is changed and no restart is
 * needed; the patch lives in the main process's memory only.
 *
 * Every step is defensive. A failure leaves the official tray exactly as it was:
 * the caller gets `{ ok: false, reason }` and nothing else happens.
 */

import { createRequire } from 'node:module'

import { connectCdp, evaluateValue } from './cdp.mjs'

const require = createRequire(import.meta.url)
const payload = require('./tray-main.cjs')

/** Node's inspector opens on 9229 and walks upward when the port is taken. */
const INSPECTOR_PORTS = Array.from({ length: 11 }, (_, index) => 9229 + index)
const MAIN_TARGET = /browser_init/u
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * The Desktop main process this host belongs to, when there is one.
 *
 * The plugin's Host half also runs under plain Node (`dsh web`, the CLI), where there
 * is no Electron main process to talk to and no tray at all. What identifies a Desktop
 * Host is the bootstrap it was started from: `ELECTRON_RUN_AS_NODE` is inherited by every
 * descendant — a `dsh web` started from a Desktop session has it too — so the environment
 * variable alone is never taken as evidence, and a Web or CLI host is ignored outright.
 * @param runtime - The process to inspect; the tests pass a stand-in.
 * @returns Its pid, or `undefined` when this is not a Desktop host.
 */
export function desktopMainPid(runtime = process) {
  if (typeof runtime.versions?.electron !== 'string') return undefined
  const host = Array.isArray(runtime.argv) && runtime.argv.some((value) => typeof value === 'string' && value.includes('dsh-desktop-host'))
  if (!host) return undefined
  const pid = runtime.ppid
  if (!Number.isSafeInteger(pid) || pid <= 0 || pid === runtime.pid) return undefined
  return pid
}

/**
 * Find the main process's inspector, if it is already listening.
 * @param fetchImpl - Fetch implementation.
 * @param ports - Ports to probe.
 * @returns The loopback debugger target, or `undefined`.
 */
export async function findInspector({ fetchImpl = globalThis.fetch, ports = INSPECTOR_PORTS } = {}) {
  if (typeof fetchImpl !== 'function') return undefined
  for (const port of ports) {
    let list
    try {
      const response = await fetchImpl(`http://127.0.0.1:${port}/json/list`, { cache: 'no-store' })
      if (!response.ok) continue
      list = await response.json()
    } catch {
      continue
    }
    if (!Array.isArray(list)) continue
    for (const entry of list) {
      const url = entry?.webSocketDebuggerUrl
      // The title identifies the Electron bootstrap: another inspector on this machine
      // (a plain Node process, or this host's own debug port) must never be used.
      const loopback = typeof url === 'string' ? /^ws:\/\/127\.0\.0\.1:(\d+)\//u.exec(url) : null
      if (loopback === null) continue
      if (!MAIN_TARGET.test(String(entry?.title ?? ''))) continue
      return { port: Number(loopback[1]), url, title: String(entry.title) }
    }
  }
  return undefined
}

/**
 * Patch, or restore, the tray of the Desktop main process this host is a child of.
 * @param options - `mode` (`install` or `uninstall`), the payload `config`, an optional
 *   logger, and the primitives the tests replace (debugger client, inspector lookup,
 *   fetch, timing and the payload source).
 * @returns `{ ok, mode?, trays?, reason? }` — never throws.
 */
export async function applyRuntimeTray({
  mode = 'install',
  config = {},
  logger,
  mainPid,
  payloadSource = String(payload),
  connect = connectCdp,
  find = findInspector,
  fetchImpl = globalThis.fetch,
  debugProcess = (pid) => process._debugProcess(pid),
  wait = sleep,
  attempts = 40,
  interval = 250,
} = {}) {
  const pid = mainPid ?? desktopMainPid()
  if (pid === undefined) return { ok: false, reason: 'not a Desktop host process' }

  // An inspector that is already open belongs to whoever opened it (a development
  // `--inspect`): it is used, but never closed on the way out.
  const existing = await find({ fetchImpl }).catch(() => undefined)
  let opened = false
  if (existing === undefined) {
    try {
      debugProcess(pid)
      opened = true
    } catch (error) {
      return { ok: false, reason: `runtime inspector unavailable: ${error.message}` }
    }
  }
  let target = existing
  for (let attempt = 0; target === undefined && opened && attempt < attempts; attempt += 1) {
    await wait(interval)
    target = await find({ fetchImpl }).catch(() => undefined)
  }
  if (target === undefined) {
    if (opened) await closeInspector({ connect, target: undefined, logger })
    return { ok: false, reason: 'runtime inspector did not open' }
  }

  let client
  try {
    client = await connect(target.url)
    const evaluate = (expression) => client.send('Runtime.evaluate', { expression, includeCommandLineAPI: true, objectGroup: 'dct-tray' })
    const electron = await evaluate(`require('electron')`)
    const electronId = electron?.result?.objectId
    if (typeof electronId !== 'string') throw new Error('the main process exposed no Electron module')
    const prototype = await evaluate(`require('electron').Tray.prototype`)
    const prototypeId = prototype?.result?.objectId
    if (typeof prototypeId !== 'string') throw new Error('the main process exposed no Tray prototype')
    const objects = await client.send('Runtime.queryObjects', { prototypeObjectId: prototypeId })
    const objectsId = objects?.objects?.objectId
    if (typeof objectsId !== 'string') throw new Error('the main process exposed no tray instances')
    const call = await client.send('Runtime.callFunctionOn', {
      objectId: objectsId,
      functionDeclaration: payloadSource,
      arguments: [{ objectId: electronId }, { value: config }],
      returnByValue: true,
      awaitPromise: true,
      includeCommandLineAPI: true,
    })
    const value = evaluateValue(call)
    if (value?.ok !== true) throw new Error('the tray payload refused to install')
    logger?.info?.('dsh-custom-theme: %s tray patch applied over the %s inspector (%s tray(s))', mode, target.port, value.trays ?? 0)
    return value
  } catch (error) {
    return { ok: false, reason: error.message }
  } finally {
    if (client !== undefined) {
      if (opened) {
        // The debug port must not outlive the injection.
        client.fire('Runtime.evaluate', { expression: `require('inspector').close()`, includeCommandLineAPI: true })
        await wait(120)
      }
      client.close()
    }
  }
}

/** Best-effort close of an inspector this module opened, used when nothing else can. */
async function closeInspector({ connect, target, logger }) {
  const found = target ?? (await findInspector().catch(() => undefined))
  if (found === undefined) return
  try {
    const client = await connect(found.url)
    client.fire('Runtime.evaluate', { expression: `require('inspector').close()`, includeCommandLineAPI: true })
    await sleep(120)
    client.close()
  } catch (error) {
    logger?.warn?.('dsh-custom-theme: could not close the runtime inspector: %s', error.message)
  }
}
