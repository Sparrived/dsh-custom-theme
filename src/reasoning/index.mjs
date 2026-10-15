/**
 * Host sub-plugin: Reasoning Auto-Expand & Fold.
 */
import { markSubpluginActive } from '../host/subplugins.mjs'

export const name = 'custom-theme-reasoning'

export function apply(ctx) {
  ctx.effect(() => markSubpluginActive(name))
}
