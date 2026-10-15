/**
 * Host sub-plugin: Working Status Label & Shimmer Effects.
 */
import { markSubpluginActive } from '../host/subplugins.mjs'

export const name = 'custom-theme-working'

export function apply(ctx) {
  ctx.effect(() => markSubpluginActive(name))
}
