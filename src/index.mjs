/**
 * dsh-custom-theme — Host half.
 *
 * Owns a user-editable CSS theme directory (`$DSH_HOME/themes`) and serves it to
 * the browser half over a prefix route on the Web Host. Bundled themes are
 * seeded once, and a user who drops an extra `.css` file into the directory gets
 * a new entry in the Appearance picker without touching any configuration.
 *
 * This module is the row and nothing else: it resolves the two directories, starts
 * the seeding pass, builds the two surfaces the route answers with, and registers
 * the route. The work behind each of those lives under `src/host/`, and the pure
 * rules it obeys — theme ids, byte caps, name sanitising, the patch text — live in
 * the modules beside this one.
 *
 * Imports no third-party modules: the row must stay loadable by a profile that
 * links this package directly, with no peer resolution for a Schemastery `Config`
 * schema yet. `config` is therefore read defensively.
 */

import { mkdir } from 'node:fs/promises'

import { backgroundsDirectory, themesDirectory } from './themes.mjs'
import { dshHome } from './host/home.mjs'
import { send } from './host/http.mjs'
import { createEffortSwitch } from './host/profile.mjs'
import { handleRoute } from './host/route.mjs'
import { seedThemes } from './host/themes-store.mjs'
import { createUpdateSurface } from './host/updates.mjs'
import { ROUTE_PATH } from './host/urls.mjs'

export const name = 'dsh-custom-theme'

/**
 * Seed the theme directory and expose both directories over the Web Host.
 *
 * The route is registered through `ctx.inject` so a profile without
 * `dsh-host-webserver` still seeds the theme directory instead of failing to
 * load.
 * @param ctx - Host Cordis context of this row.
 * @param config - Row configuration; `themesDir` and `backgroundsDir` override
 *   the default locations.
 */
export function apply(ctx, config) {
  const home = dshHome()
  const themes = themesDirectory(config, home)
  const backgrounds = backgroundsDirectory(config, home)
  ctx.logger.info('dsh-custom-theme: themes directory %s', themes)
  ctx.logger.info('dsh-custom-theme: backgrounds directory %s', backgrounds)
  const ready = Promise.all([
    seedThemes(themes).then((ids) => {
      if (ids.length > 0) ctx.logger.info('dsh-custom-theme: seeded %s', ids.join(', '))
    }),
    // The background directory holds only user-supplied images, so it is created
    // but never seeded; the card lists it as empty until something is dropped in.
    mkdir(backgrounds, { recursive: true }),
  ]).then(() => {}, (error) => {
    ctx.logger.warn('dsh-custom-theme: preparing directories failed: %s', error.message)
  })

  // The reasoning-level pass runs from `apply` rather than from the route, so a
  // profile that never opens the settings page still gets its levels.
  const efforts = createEffortSwitch({ home, logger: ctx.logger })

  /*
   * The update check needs two things the row cannot demand: the version this build
   * runs, and the profile's plugin-manager service for the registry list and the
   * install. Both are read defensively, so a profile without the service still
   * reports its own version and says why the check cannot run.
   */
  const { updates } = createUpdateSurface({ ctx, config })

  ctx.inject(['webServer'], (child) => {
    child.effect(() => child.webServer.register({
      kind: 'prefix',
      path: ROUTE_PATH,
      handler: (req, res) => handleRoute(req, res, { themes, backgrounds, ready, updates, efforts }).catch((error) => {
        child.logger.warn('dsh-custom-theme: %s failed: %s', req.url, error.message)
        if (!res.headersSent) send(res, 500, 'text/plain; charset=utf-8', 'theme read failed')
      }),
    }), 'dsh-custom-theme: route')
    child.logger.info('dsh-custom-theme: serving %s', ROUTE_PATH)
  })
}
