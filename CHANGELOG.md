# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2026-10-04

The working text rewords the shell's own running label instead of mounting a row of its
own, and an upload that fails says which part failed.

### Fixed

- **An upload that fails says what failed.** Every failure read 「图片未能上传，请换一张再试」,
  which sent the user off to try other pictures even when the picture was never the
  problem. The row now tells them apart: a Host that predates the route asks for a
  restart, a picture over the cap says so, a file that is no served format says so, and
  anything else carries the status it answered with. A stale Host is what an in-place
  plugin update looks like until DSH restarts — the panel is read from the bundle on
  disk, so a refresh brings up the new one, while the Host half was imported once at boot
  and answers `405` to a route it has never heard of.
- **The configured phrase replaces 「深度求索中」 itself.** The shell draws that label
  inside its own Chat view — 「深度求索中，用时 13秒 ···」 at the foot of the transcript,
  beside a whale-tail glyph and a shimmer — and registers no slot for it. 0.2.0 replaced
  `conversation.chat.node` / key `turn-process` instead, which put a phrase row of its own
  above the reasoning rows while the label it was meant to reword stayed untouched: the
  installed shell draws that disclosure only once a Turn has closed. The wording is now
  swapped on the locale lookup every bound `t` dispatches through, so the glyph, the
  shimmer, the row's layout and the elapsed time the shell interpolates all stay as
  shipped and only the words change.
- Only a key ending in `.deepDiving` / `.deepDivingFor` is touched. A shell that renames
  them stops being reworded rather than rendering something wrong, and a service that
  refuses the replacement leaves the shipped label in place and reports why.

### Removed

- The `conversation.chat.node` / `turn-process` replacement, its `dct-turn-*` stylesheet
  and its DOM. Nothing is added to the transcript any more.

### Notes

- A finished turn keeps its elapsed time: 「已完成，用时 …」 is the shell's own label
  again, rather than one a replacement row drew without the `{duration}` it could not
  interpolate.
- The rotation is driven by the shell's own one-second re-reads instead of a timer here,
  and a gap in them restarts the list, so each new turn opens on the first phrase.
- `test/client.test.mjs` covers the swap headlessly, through the same lookup the label is
  read through; the browser suite now asserts the plugin owns no transcript row.

## [0.2.0] - 2026-10-04

The background row becomes a workbench, and a picture no longer has to be found and
copied into the directory before it can be used.

### Added

- **A zone workbench.** Tabs naming each zone plus a schematic of the window whose
  regions are clickable replace the old zone dropdown, so the choice of which zone is
  being edited is made by pointing at it rather than by reading a list. Both mark a
  zone that already carries a picture, and the whole-window zone owns the frame the
  other regions sit inside — dashed while it is empty, solid once it carries one.
- **A file picker.** **选择图片…** uploads a picture straight into the background
  directory, so it becomes selectable for every zone without leaving the settings
  page. Reached in the browser suite by putting a real `File` on the input, which is
  the state the dialog leaves behind.
- `POST /dsh-custom-theme/backgrounds?name=<file>`, which stores the request body as a
  picture and answers with the name it stored, alongside the refreshed listing.

### Notes

- The stored format follows the uploaded bytes, not the file's name or its declared
  type: the Host sniffs the signature and refuses anything that is no served format.
- The name is folded into the ASCII the directory whitelist accepts, and a name
  already in use stays with the picture that holds it — the same bytes reuse it,
  different bytes take the next free `-1`, `-2`, … beside it. So an upload never
  overwrites a picture that is already there.

## [0.1.2] - 2026-10-04

Completes the plugin manager page's update surface: it now uses all three slots that
page declares, instead of the two 0.1.1 shipped with.

### Added

- `plugins.detail.actions`, the page's actions area beside the enable switch and
  uninstall, carries the **升级** button when a newer release exists. This is the
  page's own home for an action, so the section below drops its copy of the same
  button rather than drawing it twice: the head carries the action, the badge beside
  the title carries the fact, and the section carries the detail and **检查更新**.

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

[0.2.0]: https://github.com/Sparrived/dsh-custom-theme/releases/tag/v0.2.0
[0.1.2]: https://github.com/Sparrived/dsh-custom-theme/releases/tag/v0.1.2
[0.1.1]: https://github.com/Sparrived/dsh-custom-theme/releases/tag/v0.1.1
[0.1.0]: https://github.com/Sparrived/dsh-custom-theme/releases/tag/v0.1.0
