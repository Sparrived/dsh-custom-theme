/**
 * Host sub-plugin: Start-page usage heatmap.
 */
import { markSubpluginActive } from '../host/subplugins.mjs'

export const name = 'custom-theme-heatmap'

export function apply(ctx) {
  ctx.effect(() => markSubpluginActive(name))
}
