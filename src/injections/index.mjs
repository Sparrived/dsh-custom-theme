/**
 * Host sub-plugin: Injected Context Rows.
 */
import { markSubpluginActive } from '../host/subplugins.mjs'

export const name = 'custom-theme-injections'

export function apply(ctx) {
  ctx.effect(() => markSubpluginActive(name))
}
