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
 * The inspector listing carries no reliable identity: Electron used to title its main
 * process target `electron/js2c/browser_init`, and 44.7 titles it after the executable.
 * What a target is is therefore asked over the debugger — its own pid and process type —
 * and other local inspectors that share the same ports are skipped, never patched and
 * never closed.
 *
 * Every step is defensive. A failure leaves the official tray exactly as it was:
 * the caller gets `{ ok: false, reason }` and nothing else happens.
 */

import { createRequire } from 'node:module'

import { connectCdp, evaluateValue } from './cdp.mjs'

const require = createRequire(import.meta.url)
const payload = require('./tray-main.cjs')

/**
 * Node's inspector opens on 9229. A development `--inspect` falls back to the next free
 * port, but the runtime-opened inspector this module asks for does not, so another
 * process holding 9229 makes the injection fail (reported, official tray kept). The scan
 * still covers the neighbours so an inspector a user opened with `--inspect=<port>` is
 * found and reused.
 */
const INSPECTOR_PORTS = Array.from({ length: 11 }, (_, index) => 9229 + index)
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
 * Find a loopback inspector listening on the usual ports.
 * @param fetchImpl - Fetch implementation.
 * @param ports - Ports to probe.
 * @param ignore - Debugger urls already known to belong to another process.
 * @returns The loopback debugger target, or `undefined`.
 */
export async function findInspector({ fetchImpl = globalThis.fetch, ports = INSPECTOR_PORTS, ignore } = {}) {
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
      // Only this machine's loopback can be the main process's inspector; the debugger
      // client refuses any other url as well.
      const loopback = typeof url === 'string' ? /^ws:\/\/127\.0\.0\.1:(\d+)\//u.exec(url) : null
      if (loopback === null) continue
      if (ignore?.has?.(url) === true) continue
      return { port: Number(loopback[1]), url, title: String(entry.title) }
    }
  }
  return undefined
}

/**
 * Whether a debugger target is the Desktop main process.
 *
 * Only that process can report its own pid, and a foreign local inspector reports its
 * own, different one. A target that cannot answer the question — for instance a page
 * target, which has no `process` — is not taken for the main process either.
 * @param client - Connected debugger client.
 * @param pid - The main process pid this feature belongs to.
 * @returns Whether it is that process; never throws.
 */
async function isMainProcess(client, pid) {
  try {
    const identity = evaluateValue(await client.send('Runtime.evaluate', {
      expression: `({ pid: process.pid, type: process.type })`,
      includeCommandLineAPI: true,
      returnByValue: true,
    }))
    return identity?.pid === pid && identity?.type === 'browser'
  } catch {
    return false
  }
}

/**
 * Reach the main process's inspector, skipping inspectors of other local processes.
 *
 * Ports are shared: a user's own `node --inspect` can hold one of the same ports, and
 * that inspector must not be patched or closed. A target is asked for its own pid and
 * process type before anything else happens to it; one that is not the Desktop main
 * process is remembered for the rest of the attempt and the search continues.
 * @returns The verified target and its connected client, or `undefined` when none is
 *   listening on the probed ports.
 */
async function findMainInspector({ connect, find, fetchImpl, pid, ignore }) {
  for (;;) {
    const found = await find({ fetchImpl, ignore }).catch(() => undefined)
    if (found === undefined) return undefined
    let client
    try {
      client = await connect(found.url)
      if (await isMainProcess(client, pid)) return { found, client }
    } catch {
      // A target that cannot be connected to or read is not this process's inspector.
    }
    client?.close()
    ignore.add(found.url)
  }
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

  // Inspectors that exist on the probed ports but belong to another process.
  const ignore = new Set()
  let client
  let opened = false
  try {
    let inspector = await findMainInspector({ connect, find, fetchImpl, pid, ignore })
    if (inspector === undefined) {
      // No inspector belongs to this process yet: ask it to open one. The port exists
      // only for the length of this function and is closed in `finally`.
      try {
        debugProcess(pid)
        opened = true
      } catch (error) {
        return { ok: false, reason: `runtime inspector unavailable: ${error.message}` }
      }
      for (let attempt = 0; attempt < attempts && inspector === undefined; attempt += 1) {
        await wait(interval)
        inspector = await findMainInspector({ connect, find, fetchImpl, pid, ignore })
      }
    }
    if (inspector === undefined) return { ok: false, reason: 'runtime inspector did not open' }
    client = inspector.client
    const target = inspector.found
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
