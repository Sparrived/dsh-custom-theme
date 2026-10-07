/**
 * The Host half's view of the runtime tray patch.
 *
 * The switch lives in the DSH home rather than in the browser, because the decision to
 * patch has to be made by the Host process at startup — before any page exists. This
 * module owns that file, the injection attempts, and the status the settings page reads.
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { applyRuntimeTray, desktopMainPid } from './inject.mjs'

/** Where the switch is remembered, inside the DSH home. */
const STATE_FILE = 'dsh-custom-theme.desktop-tray.json'

/** The assets the injected payload loads into its popup window. */
const POPUP = {
  html: fileURLToPath(new URL('./popup.html', import.meta.url)),
  preload: fileURLToPath(new URL('./popup-preload.cjs', import.meta.url)),
  partition: 'dct-tray-popup',
  width: 320,
  height: 420,
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Build the tray runtime for one Host process.
 * @param options - `home` (DSH home), `logger`, and the injection primitive the tests replace.
 * @returns `status`, `set`, `autoStart` and `dispose`.
 */
export function createTrayRuntime({ home, logger, apply = applyRuntimeTray, detect = desktopMainPid, attempts = 5, backoff = 1500 } = {}) {
  const file = join(home, STATE_FILE)
  let enabled = false
  let loaded = false
  let last = { ok: false }
  let timer

  async function read() {
    try {
      const parsed = JSON.parse(await readFile(file, 'utf8'))
      enabled = parsed?.enabled === true
    } catch {
      enabled = false
    }
    loaded = true
    return enabled
  }
  async function write(value) {
    await mkdir(dirname(file), { recursive: true })
    const temporary = `${file}.tmp`
    await writeFile(temporary, `${JSON.stringify({ enabled: value === true }, null, 2)}\n`)
    await rename(temporary, file)
  }

  const desktop = () => detect() !== undefined
  function status() {
    return {
      enabled,
      desktop: desktop(),
      active: last.ok === true && last.mode !== 'uninstall',
      trays: Number(last.trays) || 0,
      error: last.ok === false ? String(last.reason ?? '') : '',
    }
  }

  async function run(mode) {
    const answer = await apply({ mode, config: { mode, popup: POPUP }, logger }).catch((error) => ({ ok: false, reason: error.message }))
    last = mode === 'uninstall' && answer.ok === true ? { ok: true, mode: 'uninstall', trays: 0 } : answer
    if (last.ok !== true) logger?.warn?.('dsh-custom-theme: desktop tray %s failed: %s', mode, last.reason)
    return status()
  }

  return {
    status,
    /** Turn the runtime tray on or off, persisting the choice first. */
    async set(value) {
      if (!loaded) await read()
      await write(value === true)
      enabled = value === true
      if (!desktop()) return status()
      return run(enabled ? 'install' : 'uninstall')
    },
    /**
     * Apply a switch that is already on, once the Desktop main process is up.
     *
     * The tray is created a moment after the main process starts, so the first
     * attempt can legitimately find nothing yet; the payload is written to cope with
     * that and the retries cover a window that opens later.
     */
    async autoStart() {
      if (!loaded) await read().catch(() => false)
      if (!enabled || !desktop()) return status()
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const answer = await run('install')
        if (answer.active) return answer
        if (attempt < attempts - 1) await wait(backoff * (attempt + 1))
      }
      return status()
    },
    dispose() {
      if (timer !== undefined) clearTimeout(timer)
    },
  }
}
