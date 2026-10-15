/**
 * Host sub-plugin: Branding & Hero Greetings.
 */
import { markSubpluginActive } from '../host/subplugins.mjs'

export const name = 'custom-theme-branding'

export function apply(ctx) {
  ctx.effect(() => markSubpluginActive(name))
}
