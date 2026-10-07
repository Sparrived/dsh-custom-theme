/**
 * The user's DSH profile: finding the patch file this plugin edits, and keeping the
 * reasoning-level switch in it in step with what the settings page holds.
 *
 * The profile's patch file is the only layer that wins over the row a user wrote
 * there by hand, so the file has to be identified exactly — a guess would edit the
 * wrong profile. Every candidate is therefore only used once it really holds a
 * patch file.
 *
 * Edits are conservative in the same spirit: the file is written beside itself and
 * moved into place, the first edit keeps a copy, and only lines carrying this
 * plugin's own marker are added or removed. A hand-declared level list is never
 * touched.
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { applyEffortLevels, inspectEffortLevels, revertEffortLevels } from '../effort-levels.mjs'
import { dshHome } from './home.mjs'

/** The profile layer this plugin edits when it attaches reasoning levels. */
const PROFILE_PATCH_FILE = 'cordis.patch.yml'

/** Where the switch for that feature is remembered, inside the DSH home. */
const EFFORT_STATE_FILE = 'dsh-custom-theme.effort-levels.json'

/**
 * The profiles this build could belong to, nearest first.
 *
 * The profile's own patch file is the only layer that wins over the `llm-pi-ai` row the user
 * wrote there, so the one being run has to be identified exactly. DSH names it in
 * `DSH_PROFILE_DIR`; failing that, this package normally sits inside the profile that loaded it —
 * one directory above `node_modules`. A linked or globally installed copy is in neither place, so
 * the command line and the environment are asked as well. Every candidate is only ever used when
 * it really holds a patch file, so a wrong guess costs a read and nothing else.
 * @returns Candidate profile directories, most likely first.
 */
function profileCandidates() {
  const candidates = []
  const declared = process.env.DSH_PROFILE_DIR
  if (typeof declared === 'string' && declared.trim() !== '') candidates.push(declared)
  try {
    candidates.push(fileURLToPath(new URL('../../../../', import.meta.url)))
  } catch {
    // A module URL without a directory is simply not a candidate.
  }
  const fromArgv = process.argv.find((value) => typeof value === 'string' && /[\\/]profiles[\\/][^\\/]+[\\/]?$/u.test(value))
  if (fromArgv !== undefined) candidates.push(fromArgv)
  const profile = process.env.DSH_PROFILE
  if (typeof profile === 'string' && profile.trim() !== '') candidates.push(join(dshHome(), 'profiles', profile))
  return candidates.map((directory) => directory.replace(/[\\/]+$/u, ''))
}

/**
 * The profile patch file this plugin edits.
 * @returns Its absolute path, or `undefined` when no candidate holds one.
 */
async function findProfilePatch() {
  for (const directory of profileCandidates()) {
    const file = join(directory, PROFILE_PATCH_FILE)
    const present = await readFile(file, 'utf8').then(() => true, () => false)
    if (present) return file
  }
  return undefined
}

/**
 * Read the reasoning-level switch.
 *
 * Defaults to on: a model that declares no levels has no effort row at all, so the automatic
 * answer is the useful one, and the settings page is where it is turned off again.
 * @param home - DSH home directory.
 * @returns `{ enabled }`.
 */
async function readEffortState(home) {
  try {
    const parsed = JSON.parse(await readFile(join(home, EFFORT_STATE_FILE), 'utf8'))
    return { enabled: parsed?.enabled !== false }
  } catch {
    return { enabled: true }
  }
}

/**
 * Remember the reasoning-level switch.
 * @param home - DSH home directory.
 * @param state - `{ enabled }`.
 */
async function writeEffortState(home, state) {
  await mkdir(home, { recursive: true })
  await writeFile(join(home, EFFORT_STATE_FILE), `${JSON.stringify({ enabled: state.enabled === true }, null, 2)}\n`, 'utf8')
}

/**
 * Bring the profile's patch file in line with the switch.
 *
 * The file is written beside itself and moved into place, so a crash mid-write cannot leave a
 * half-edited profile, and the first edit keeps a copy of what the user had. Only lines carrying
 * this plugin's marker are added or removed; a hand-declared level list is never touched.
 * @param options - `{ home, enabled, logger }`.
 * @returns The state the settings page reports.
 */
async function syncEffortLevels({ home, enabled, logger }) {
  const status = { enabled, file: null, changed: false, restartRequired: false, models: [], managed: [], undeclared: [], missing: [] }
  const file = await findProfilePatch()
  if (file === undefined) {
    logger.warn('dsh-custom-theme: no %s found for the reasoning levels; nothing was edited', PROFILE_PATCH_FILE)
    return status
  }
  status.file = file
  const text = await readFile(file, 'utf8')
  const result = enabled ? applyEffortLevels(text) : revertEffortLevels(text)
  const seen = inspectEffortLevels(result.changed ? result.text : text)
  status.changed = result.changed
  status.models = result.models.filter((model) => model.action !== 'kept' && model.action !== 'unchanged').map((model) => model.id)
  status.managed = seen.managed
  status.undeclared = seen.undeclared
  if (result.changed) {
    const backup = `${file}.dct-backup`
    const hasBackup = await readFile(backup).then(() => true, () => false)
    if (!hasBackup) await writeFile(backup, text, 'utf8')
    await writeFile(`${file}.dct-tmp`, result.text, 'utf8')
    await rename(`${file}.dct-tmp`, file)
    status.restartRequired = true
  }
  return status
}

/**
 * The reasoning-level switch the route exposes to the browser half.
 *
 * This runs from `apply` rather than from the route, so a profile that never opens
 * the settings page still gets its levels. It edits the profile's patch file, which
 * is read at boot: a change is therefore reported as needing a restart instead of
 * pretending it is already in force.
 *
 * The profile is read once at boot, so a file this session rewrote is not in force
 * yet — and stays that way, however many times the page asks, until DSH restarts.
 * @param options - `{ home, logger }`.
 * @returns `{ status, set }`, the two calls the route makes.
 */
export function createEffortSwitch({ home, logger }) {
  let effortStatus = null
  let effortFailure = null
  let effortStale = false
  const effortReady = (async () => {
    const state = await readEffortState(home)
    effortStatus = await syncEffortLevels({ home, enabled: state.enabled, logger })
    effortStale = effortStatus.changed
    if (effortStatus.changed) {
      logger.info('dsh-custom-theme: reasoning levels %s %s in %s — restart to take effect',
        effortStatus.enabled ? 'added' : 'removed',
        effortStatus.models.length > 0 ? `for ${effortStatus.models.join(', ')}` : '(for no model)',
        effortStatus.file)
    }
  })().catch((error) => {
    effortFailure = error.message
    logger.warn('dsh-custom-theme: reasoning levels failed: %s', error.message)
  })

  /**
   * Read the file again and say what it holds now.
   *
   * The pass is idempotent, so reading is also how a block the user removed by hand comes back,
   * and `changed` then means "this call edited the file" rather than "one day it did".
   * @returns The state the settings page reports.
   */
  async function readEffort() {
    await effortReady
    const state = await readEffortState(home)
    const fresh = await syncEffortLevels({ home, enabled: state.enabled, logger })
    effortStale = effortStale || fresh.changed
    effortStatus = { ...fresh, restartRequired: fresh.restartRequired || effortStale }
    return { ...effortStatus, failure: effortFailure }
  }

  return {
    /** What the switch currently says, and what the file currently holds. */
    status: readEffort,
    /** Turn it on or off, and apply that to the file right away. */
    async set(enabled) {
      await effortReady
      await writeEffortState(home, { enabled })
      const fresh = await syncEffortLevels({ home, enabled, logger })
      effortStale = effortStale || fresh.changed
      effortStatus = { ...fresh, restartRequired: fresh.restartRequired || effortStale }
      effortFailure = null
      return { ...effortStatus, failure: null }
    },
  }
}
