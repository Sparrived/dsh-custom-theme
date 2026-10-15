/**
 * Host sub-plugin: Reasoning Effort Slider.
 */
import { dshHome } from '../host/home.mjs'
import { createEffortSwitch } from '../host/profile.mjs'
import { markSubpluginActive } from '../host/subplugins.mjs'

export const name = 'custom-theme-effort'

export function apply(ctx) {
  ctx.effect(() => markSubpluginActive(name))
  const home = dshHome()
  createEffortSwitch({ home, logger: ctx.logger })
}
