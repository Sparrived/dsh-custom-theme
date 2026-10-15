/**
 * Host sub-plugin: Typography & Stream Ink.
 */
import { markSubpluginActive } from '../host/subplugins.mjs'

export const name = 'custom-theme-appearance'

export function apply(ctx) {
  ctx.effect(() => markSubpluginActive(name))
}
