/**
 * The DSH home this plugin writes under.
 *
 * Separate from the profile lookup and the stores because more than one of them
 * needs it, and none of them should own it.
 */

import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Resolve the DSH home, honouring the environment override the runtime sets.
 * @returns The home directory whose `themes` directory this plugin owns.
 */
export function dshHome() {
  const configured = process.env.DSH_HOME
  return typeof configured === 'string' && configured.trim() !== '' ? configured : join(homedir(), '.dsh')
}
