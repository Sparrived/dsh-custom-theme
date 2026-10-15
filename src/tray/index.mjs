/**
 * Host sub-plugin: Desktop System Tray Integration.
 */
import { dshHome } from '../host/home.mjs'
import { createTrayRuntime } from '../desktop/tray-runtime.mjs'
import { markSubpluginActive } from '../host/subplugins.mjs'

export const name = 'custom-theme-tray'

export function apply(ctx) {
  ctx.effect(() => markSubpluginActive(name))
  const home = dshHome()
  const tray = createTrayRuntime({ home, logger: ctx.logger })
  tray.autoStart().catch((error) => {
    ctx.logger?.warn?.('custom-theme-tray: desktop tray startup failed: %s', error.message)
  })
}
