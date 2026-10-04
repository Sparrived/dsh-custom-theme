# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-10-04

Adds update detection and a one-click upgrade, offered both on this plugin's own
settings card and on the plugin manager's page for this bundle.

### Added

**Updates**

- The Host asks npm for the package's latest release once per boot, and caches the
  answer for six hours (a failure is cached for one minute, so a blip cannot hide an
  update for the rest of the window). The registry it asks comes from the profile's
  own plugin-manager configuration — the configured registry first, then pnpm's
  resolved one, then the configured fallbacks — so a mirror or a private registry
  stays authoritative and is never silently widened to the public one. `null` there
  means "what pnpm's config names", which resolves to npm official by default.
- `GET /dsh-custom-theme/update` answers the cached state as JSON: the running
  version, the latest one, whether it is an upgrade, and the registry that answered.
- `POST /dsh-custom-theme/update/check` asks the registries again, ignoring the cache.
- `POST /dsh-custom-theme/update/apply` installs the release the last check resolved,
  through the plugin manager's own `installBundle`. Only these two actions answer
  POST: a GET stays safe for a link, a prefetch or an image, none of which may start
  an install. Replacing a package cannot hot-swap the Host module, so an upgrade
  always reports that a restart is required, and the state then carries
  `pendingRestart` instead of offering the same upgrade again.
- A row on **设置 → 主题与背景** shows the running version, offers **检查更新**, and
  grows an **升级** button when a newer release exists.
- Two contributions to the plugin manager's bundle page (`plugins.detail.badge` and
  `plugins.detail.section`), so the page where plugins are managed is also where a
  newer release is mentioned. Both render nothing for any other subject, and neither
  touches the page's own version tag or switch.
- `updateCheck: false` in the plugin config skips the check at boot; the manual
  button and both routes still work.

### Fixed

- A failed install was reported as a success. `installBundle` resolves for a failed
  run too — the outcome is in `application`, not in whether the promise rejected — so
  an `ERR_PNPM_EPERM` was answered with `status: "ok"` and a pending restart, which
  would have sent a user looking for a restart that could not help. Any outcome other
  than `applied` or `restart-required` is now an error carrying the plugin manager's
  own diagnostic, and the upgrade stays on offer.
- The browser appearance suite failed four visibility steps on a freshly created
  profile. It was not the plugin: that profile opens DSH's own `预览版说明` first-run
  notice, whose backdrop covers the window and answers every `elementFromPoint`
  query, so the sampling read nothing while the assertions before it — which read the
  tagged surfaces and their layers directly — still passed, and the picture rendered
  correctly. The suite now dismisses that notice after boot and again before
  sampling.

## [0.1.0] - 2026-10-04

First release. A DSH bundle that contributes an editable theme directory and a
background-image model to the Web GUI and the Desktop app, with a settings page of
its own under **设置 → 主题与背景**.

### Added

**Themes**

- A theme **directory** at `$DSH_HOME/themes` (override with `themesDir`). Adding a
  theme is dropping in a `.css` file and pressing **Rescan**; the file only needs to
  override `--dsw-alias-*` custom properties.
- Three seeded themes — `gov`, `monokai-pro` and `one-dark` — each carrying both a
  light and a dark set. They are managed files, re-synced when the seed generation
  advances.
- Two ways to carry a palette: a single set, or one set per colour scheme
  (`data-ds-dark-theme`, `[data-theme="dark"]` and `prefers-color-scheme` are all
  recognised). A single-palette theme also selects the matching base palette, read
  from the luma of its `--dsw-alias-bg-base`, so it cannot end up with a light theme
  on dark composer and menu surfaces. A `/* dsh:color-scheme dark */` directive
  overrides that reading.
- A theme's tokens ride the official theme runtime as an override layer and its base
  palette goes to `ctx.theme.setTheme`, so a theme colours the whole window rather
  than one surface.

**Background images**

- Six independently configured zones: whole app, title bar, sidebar, conversation,
  composer and tool panel. Each holds its own image, picture opacity, blur, fit
  (`cover`/`contain`) and position.
- Images are read from `$DSH_HOME/backgrounds` (override with `backgroundsDir`) and
  served over the plugin's own route. Served extensions are
  `.png .jpg .jpeg .webp .gif .avif .bmp`, up to 16 MiB each.
- The picture is painted on its own `::before` layer rather than as the surface's
  `background-image`, so its opacity and blur are channels of their own and the
  shell's text stays sharp at every setting. `blur` is 0–16 px (default 0);
  picture opacity is 0.05–0.45 (default 0.18); both match Deeptop's model.
- **Panel fill** is a separate per-zone channel at Deeptop's defaults — the whole-app
  frame stays opaque, while the title bar (94%), sidebar (92%), conversation (91%),
  composer (91%) and tool panel (92%) let the app backdrop show faintly through.

**Conversation stream**

- Text size (12–17 px, through the official runtime's own preference), line spacing
  via `--dsh-content-font-delta`, and text and code font pickers.
- An optional replacement for the working-indicator row, driven by a configurable
  phrase list with a rotation interval.

**Host**

- Routes: `GET /dsh-custom-theme/themes`, `/theme/<id>.css`, `/backgrounds` and
  `/background/<name>`. Ids and image names are whitelisted against directory
  traversal, and a Windows device name is refused.
- Zero third-party dependencies in the Host half.

[0.1.1]: https://github.com/Sparrived/dsh-custom-theme/releases/tag/v0.1.1
[0.1.0]: https://github.com/Sparrived/dsh-custom-theme/releases/tag/v0.1.0
