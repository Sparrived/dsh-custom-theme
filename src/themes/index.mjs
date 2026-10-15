/**
 * Host sub-plugin: CSS Themes & Palettes.
 */
import { themesDirectory } from '../themes.mjs'
import { dshHome } from '../host/home.mjs'
import { seedThemes } from '../host/themes-store.mjs'
import { markSubpluginActive } from '../host/subplugins.mjs'

export const name = 'custom-theme-themes'

export function apply(ctx, config) {
  ctx.effect(() => markSubpluginActive(name))
  const home = dshHome()
  const themes = themesDirectory(config, home)
  seedThemes(themes).catch((error) => {
    ctx.logger?.warn?.('custom-theme-themes: seeding themes failed: %s', error.message)
  })
}
