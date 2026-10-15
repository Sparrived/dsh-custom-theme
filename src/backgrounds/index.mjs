/**
 * Host sub-plugin: Multi-Zone Backgrounds.
 */
import { mkdir } from 'node:fs/promises'
import { backgroundsDirectory } from '../themes.mjs'
import { dshHome } from '../host/home.mjs'
import { markSubpluginActive } from '../host/subplugins.mjs'

export const name = 'custom-theme-backgrounds'

export function apply(ctx, config) {
  ctx.effect(() => markSubpluginActive(name))
  const home = dshHome()
  const backgrounds = backgroundsDirectory(config, home)
  mkdir(backgrounds, { recursive: true }).catch((error) => {
    ctx.logger?.warn?.('custom-theme-backgrounds: preparing directory failed: %s', error.message)
  })
}
