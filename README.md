# dsh-custom-theme

[![npm version](https://img.shields.io/npm/v/dsh-custom-theme.svg)](https://www.npmjs.com/package/dsh-custom-theme)
[![license](https://img.shields.io/npm/l/dsh-custom-theme.svg)](https://github.com/Sparrived/dsh-custom-theme/blob/main/LICENSE)

User-editable CSS themes for the DeepSeek Harness Web GUI and Desktop app.

This ports the one UI-customization capability DSH does not have: a theme
**directory** a user can edit or extend. DSH ships `light`, `dark` and `system`,
plus an in-process `ctx.theme.register()` seam for code-authored token
overrides, but it has no way for a user to supply CSS.

## What it does

| Half | File | Owns |
| --- | --- | --- |
| Host | `src/index.mjs` | `$DSH_HOME/themes/` and `$DSH_HOME/backgrounds/` — seeds `gov`, `monokai-pro` and `one-dark`, re-syncs them when the seed generation advances, serves both directories over `/dsh-custom-theme/` |
| Browser | `lib/client.js` | Its own settings page (**主题与背景**), registered into `settings.section` with theme, colour-scheme, conversation-stream, working-text and background controls. A theme's tokens go to the official theme runtime as an override layer and its base palette to `ctx.theme.setTheme`; the `<style>` element carries only its non-token rules. Backgrounds are written as inline `!important` properties on the painted surface plus one injected rule per picture layer, since a `::before` layer cannot be styled inline |

Served routes:

| Route | Response |
| --- | --- |
| `GET /dsh-custom-theme/themes` | `{ themes: [{ id, bundled }], dir }` |
| `GET /dsh-custom-theme/theme/<id>.css` | The stylesheet text |
| `GET /dsh-custom-theme/backgrounds` | `{ backgrounds: [{ name, url }], dir }` |
| `GET /dsh-custom-theme/background/<name>` | The image bytes |

Adding a theme is dropping a `.css` file into the theme directory and pressing
**Rescan**; the file only needs to override `--dsw-alias-*` custom properties.
Seeded ids come first in the picker, extra ids after them in alphabet order.

The three seeded files are managed: they are written when the directory is first
created and rewritten when the bundled palettes change, so an edit inside
`gov.css` will not survive that. Put a customised palette in a copy under its own
name — any id other than the three is never touched.

```css
/* $DSH_HOME/themes/my-theme.css */
:root {
  --dsw-alias-bg-base: #1b1d23;
  --dsw-alias-brand-primary: #7aa2f7;
  --dsw-alias-label-primary: #c0caf5;
}
```

A theme states its **palette**, not its `!important` fights: the plugin reads the
token declarations out of the stylesheet and hands them to the official theme
runtime as a token override layer, so the presenter applies them the same way it
applies its own palette. `!important` on a token declaration is therefore
unnecessary — the plugin de-escalates it on the way in, so a leftover one from an
older theme is harmless.

### The working text

While a turn runs, that label is `chat.deepDiving` (「深度求索中」) from the shell's
`chat` namespace. `ctx.locale.register` throws for a namespace and locale pair that
already exist — there is no override layer — and no slot carries the label on its
own, so replacing the row is the only way to reword it.

The replacement is **opt-in**. It registers `conversation.chat.node` / key
`turn-process` at `priority: -1` (the lowest live entry renders), and only when at
least one phrase is configured; with an empty list the shipped row is left exactly
in place. Opting in rather than replacing by default is deliberate:

- A plugin cannot render the official component — it is not exported — so a default
  replacement would mean reproducing a shell build this plugin cannot read.
- The installed shell is not the published source. Reading the live row showed its
  finished label carries an elapsed time and reads 「已完成，用时 …」, and its label
  font size follows the primary content size; the vendored sources say otherwise on
  both counts. A copy would have missed both, silently.
- The translate seat a replacement row receives does not interpolate parameters: a
  template carrying a placeholder comes back with the slot empty. The replacement
  therefore uses parameter-free keys only, and does not re-attach an elapsed time.

Fidelity is guarded by `test/browser/working-row.mjs`, which captures the shipped
row's computed geometry before a phrase is configured and compares the replacement
against it property by property.

### The settings page

The controls live on a settings page of their own rather than as a card inside
General. That is a single `settings.section` registration: it creates both the nav
row and the panel. The row sits at `order: 30`, after the built-in sections, and
its label is the `nav` key of this plugin's locale namespace, re-read on every
projection so it follows a locale change. The shell chooses the nav glyph from the
entry id and falls back to a generic settings gear for an id it does not know, so
the page cannot supply its own icon.

The shell renders one settings section at a time, which would put the official
appearance row out of sight while this page is open. The page therefore carries
its own light/dark/system control for the same preference. Both it and the
official row write through `ctx.theme.setTheme`, and this control follows
`theme/change`, so the two cannot disagree — and a theme with a light/dark pair
stays switchable without leaving the page.

### The conversation stream

| Control | Route |
| --- | --- |
| Text size | `ctx.theme.setFontSize(px)` — the official runtime's own preference, 12–17. The shell persists it, so this plugin writes it and reads it back from `ThemeSnapshot.fontSize`. |
| Line spacing | Adds px to `--dsh-content-font-delta`, the delta the shell derives from the font size and folds into every content line height. At 0 the shell's own value is left untouched. |
| Text font / code font | `--dsw-font-family` and `--ds-font-family-code`, picked from a preset list rather than typed: **跟随官方默认** (declare nothing), then the system, Microsoft YaHei, Noto Sans SC and Georgia stacks for text, and Cascadia Mono, JetBrains Mono and Sarasa Mono SC for code. A stack that is not one of them still shows up as its own option, so a value written by an earlier version is never silently reset. |

Two details worth keeping:

Line spacing rides the shell's delta rather than pinning an absolute
`line-height`, because every content surface computes its own base
(`calc(24px + delta)` on the assistant flow, `calc(22px + delta)` on the user
bubble) — one delta moves them together.

The declarations are emitted at raised specificity (`html:root` / `html body`)
rather than relying on source order. The shell installs its palette styles at
boot and may do so after this plugin runs, so an equal-specificity `:root` or
`body` rule would lose depending on who ran last.

There is no streaming-fade control. Nothing in the client renders streamed text as
per-chunk elements and no chunk timestamp reaches CSS, so a fade could only be
faked as a single mask animation per render — visibly wrong, so it is not offered.

### One palette, or a light/dark pair

A theme may carry a single palette, or one set per colour scheme:

```css
:root { --dsw-alias-bg-base: #f0f7ff; }                     /* light */
body[data-ds-dark-theme] { --dsw-alias-bg-base: #0a1520; }   /* dark */
```

Any dark selector the shell could be expected to write counts: `data-ds-dark-theme`
is what this shell sets on `body`, `[data-theme="dark"]` is the convention
Deeptop's own theme files use, and `@media (prefers-color-scheme: dark)` is read
the same way. All three bundled themes carry both sets, ported from the two-set
files they came from, so 浅色/深色 moves each of them between its own light and
dark palette.

With a pair the theme adapts: the official choice keeps deciding which set
applies, and the theme stays selected across the switch. A token declared in only
one of the two sets reaches both, so a pair may override as few or as many tokens
as it likes.

With a single palette the theme states one look, so the plugin also selects the
base palette that matches it — otherwise every token the theme does *not* override
keeps the colour of whichever scheme the user last picked, which is what leaves a
light theme with dark composer and menu surfaces. The scheme is the luma of
`--dsw-alias-bg-base`, read by handing the value to the browser, so a hex, a named
colour, `hsl()`, `oklch()`, `color-mix()` or a `var()` naming a shell token all
work. A directive overrides the reading when a theme wants to be explicit, and a
base colour the browser accepts but cannot reduce to a luma leaves the appearance
preference where the user put it rather than guessing:

```css
/* dsh:color-scheme dark */
:root {
  --dsw-alias-bg-base: #101418;
}
```

Selecting a single-palette theme therefore also moves the official appearance
preference, and like any other appearance choice that survives a restart. Moving
that preference to the other scheme afterwards **unloads the theme** instead of
keeping it: its layer carries one set of values for both modes, so letting the
base palette flip underneath it would leave a window split across the two — every
token the theme declares in one scheme's colours and everything it does not in the
other's. The page's selector falls back to its built-in entry to match the window.

## Background images

Drop an image into the background directory (`$DSH_HOME/backgrounds` by default),
press **Rescan**, and pick it in the **Background image** row. Served extensions
are `.png .jpg .jpeg .webp .gif .avif .bmp`, up to 16 MiB each.

Each of six zones holds its own image, picture opacity, blur, fit and position:

| Zone | Painted on |
| --- | --- |
| Whole app | The frame, and every zone below it |
| Title bar | The shell's header |
| Sidebar | The sidebar column |
| Conversation | The main column |
| Composer | The composer seat |
| Tool panel | The tool-panel column, while the dock is open |

The zones are the shell's own layout boxes, found by the stable part of their
CSS-module class names (`_frame`, `_sidebarCol`, `_centerCol`) and by `data-*`
hooks where the shell provides them (`[data-composer-seat]`, `[data-rightbar-col]`).
The picture is
**not** painted on that box directly: the shell paints the visible surface from a
component root nested a few levels below it, often under a zero-size wrapper, so
the plugin descends to the deepest opaque element covering the box and paints
that. Each painted surface is tagged `data-dct-zone`, which makes the target
visible in the inspector and gives the browser test something to assert on; the
picture layer itself is addressed by a generated `data-dct-layer`, because two
zones can resolve to the same surface and an element holds one value per attribute.

Three of those anchors — the header, the composer seat and the tool-panel column —
have a transparent background of their own and take their colour from an ancestor,
so the panel fill is built from the nearest opaque ancestor instead. Without that the
picture would show at full strength whatever the fill is set to.

**Image opacity** is the picture's own alpha, and it is a channel of its own: the
picture is painted on a separate layer at that alpha, so it no longer shares a
gradient with the panel fill. It is bounded to `0.05`–`0.45` with a default of
`0.18`, the same range and default Deeptop's model uses, so a picture can never
obscure the shell's own surfaces. Because the panel fill is read from the live
surface, the composite follows the active theme. A fully covered frame is
deliberately left unpainted — otherwise the same image would show twice through the
column fills and read stronger than configured.

**Blur** softens the picture alone, `0`–`16` px with a default of `0`, the range and
default Deeptop's model uses. It is applied to the picture layer, never to an
element that holds text, so the shell's content stays sharp at every setting. At `0`
the declaration is dropped entirely rather than written as `blur(0px)`.

**Panel fill** follows Deeptop's per-zone defaults: the whole-app frame stays fully
opaque, while the title bar (94%), sidebar (92%), conversation (91%), composer (91%)
and tool panel (92%) let the app backdrop show faintly through. The value is bounded
to 0–100 and only written below 100, so a zone at 100 keeps whatever alpha the
shell's own colour already had. It applies whether or not that zone has a picture,
and it is always read from the zone's own entry — the global entry supplies only the
picture, its alpha and its blur. The fill is built from the nearest **opaque**
ancestor colour, because a translucent one is either the shell's own panel fill or an
override this plugin wrote on an earlier pass, and neither is a stable basis.

### How the picture is stacked

The picture is **not** an element's `background-image`. It is a `::before` layer on
the painted surface, so the stack from the bottom reads: the shell's surface colour →
the panel fill → the picture at its own alpha, blurred if asked → the shell's own
content. Only a separate box can carry the picture's alpha and blur without fading or
smearing the text that shares the surface element, which is what makes the two
controls above possible at all.

Three declarations arrange that, all written by the plugin rather than assumed of the
shell:

- `::before { position: absolute; inset: 0; z-index: -1 }` sizes the layer to the
  surface and puts it under the shell's content. A layer at `z-index: 0` or `auto`
  would be a positioned element drawn **over** the shell's normal-flow content and
  would cover the text.
- `isolation: isolate` on the surface creates the stacking context that keeps it
  there. Without it the layer's `z-index: -1` escapes to the nearest ancestor
  stacking context and can be hidden behind a background painted at that level. It
  creates a stacking context without setting a `z-index` and without affecting
  layout, so the shell's own layering is left alone.
- `position: relative`, written **only when the surface is `static`**, gives the
  absolutely positioned layer something to be laid out against. See the risk note
  below.

The plugin writes only inline `!important` declarations and injected layer rules, and
removes exactly the properties, attributes and rules it added, so switching zones or
clearing a zone restores the shell's own styling — including the layer stylesheet,
which is emptied on every pass.

## Install

This package is a DSH **bundle**: it declares `dsh.bundle.patch`, so installing it
into a profile contributes the `custom-theme` row. The Host plugin and the browser
half ride that one row, so one install brings up both halves — there is nothing to
enable separately.

Every path below ends with `dsh plugin --profile <name> remove dsh-custom-theme`,
which removes both the dependency and the layer.

### From a local checkout

```sh
dsh plugin --profile <name> add /path/to/dsh-custom-theme   # links the checkout
dsh --profile <name> --dump-config                          # shows a "# == dsh-custom-theme" layer
dsh --profile <name> --no-open
```

### From GitHub

```sh
dsh plugin --profile <name> add github:Sparrived/dsh-custom-theme
```

Pin a commit when you want a later push to be unable to change what runs:

```sh
dsh plugin --profile <name> add github:Sparrived/dsh-custom-theme#<sha>
```

A git install fetches **source, not build artifacts**, which is the step where a
TypeScript plugin arrives without its compiled `lib/` and fails to load — the
official guide's *"installing from GitHub: the build-script catch"* section is
about exactly that case, and its fix is a `prepare` script plus an `allowBuilds`
grant. **This package does not need either.** `src/index.mjs` (Host) and
`lib/client.js` (browser) are hand-written JavaScript that Node and the browser
load directly, so there is no build step for `prepare` to run and nothing to
allowlist: the install completes with no code-execution prompt.

### From npm

```sh
dsh plugin --profile <name> add dsh-custom-theme
```

### From a tarball

`pnpm pack` produces the same prebuilt code as a single file:

```sh
pnpm pack                                                   # -> dsh-custom-theme-0.1.0.tgz
dsh plugin --profile <name> add ./dsh-custom-theme-0.1.0.tgz
```

### Releasing (maintainer)

```sh
git tag v0.1.0 && git push origin v0.1.0
gh release create v0.1.0 --title v0.1.0 --notes-file CHANGELOG.md
npm publish --access public
```

npm requires two-factor authentication for **every** publish. A passkey (Windows
Hello) has no 6-digit code to type, so the publishing token must carry the bypass:
create a **Granular Access Token** with **Bypass two-factor authentication (2FA)**
ticked and `Read and write` on packages. A token without that flag is refused with
`E403 ... granular access token with bypass 2fa enabled is required to publish`,
and weakening the account's 2FA mode to `auth-only` does not change that.

### Configuring the directories

`themesDir` and `backgroundsDir` can be overridden on the row; otherwise
`$DSH_HOME/themes` and `$DSH_HOME/backgrounds` are used:

```yaml
- id: custom-theme
  name: 'dsh-custom-theme'
  config:
    themesDir: D:/themes/dsh
    backgroundsDir: D:/wallpapers/dsh
```

### Desktop app

Install from the **Plugins** page, which uses Desktop's bundled pnpm and is the GUI
equivalent of `dsh plugin --profile desktop`; point it at the checkout or the
tarball, then restart the app. Booting the `desktop` profile from the CLI is refused
by design — *"profile desktop is managed exclusively by the Electron application"* —
so the Plugins page owns that profile.

### Local development without installing

A `--patch` overlay row pointing at the source file is enough, because the client
module system resolves the owning `package.json` by walking up from the entry
file — the browser half attaches even though the row is a `file://` specifier:

```sh
dsh --profile <name> --patch dev.overlay.yml --no-open
```

`dev.overlay.yml` names `./src/index.mjs`, a path the loader resolves against the
overlay file itself, so a fresh clone works without editing it.

The browser test drives a real browser against a booted instance, so it needs the
token from the printed URL:

```sh
set DCT_TOKEN=<token from the "dsh web: http://…/?token=…" line>
node test/browser/appearance.mjs
```

`DCT_BASE` (default `http://127.0.0.1:3080`), `DCT_CDP_PORT` and `DCT_SHOT_DIR`
override the target, the debugging port and where screenshots land. The test
imports `test/browser/driver.mjs`, a small CDP driver over Node's built-in
`WebSocket`; no browser automation dependency is installed.

## Verify

Verified against `dsh` 0.2.0-rc.2 on Windows:

- `node --test "test/**/*.test.mjs"` — 14 tests, all passing: id and image-name
  whitelists, ordering, directory resolution, seeding, re-sync on a new seed
  generation, both asset routes, both listings, and traversal, extension and
  method rejection.
- `node test/browser/appearance.mjs` — 33 steps in a real headless Edge, all
  passing. It boots the app, asserts the controls are absent from the chat view and
  still absent once Settings opens, then opens the plugin's own page from the nav
  and drives it. It asserts on rendered state: each bundled theme paints its light
  set and then follows the page's colour-scheme control into its dark set without
  being dropped, the empty option restores a built-in token, a saved theme and
  background both re-apply on boot before Settings is opened. For backgrounds it
  checks that the picture really is on the layer and not on the surface element, that
  the layer's own alpha is the configured picture opacity while the panel fill stays
  at its per-zone percentage, that a blur lands on the picture layer and nowhere a
  text-bearing element could inherit it, that both new controls clamp at Deeptop's
  ceilings, and that clearing a zone removes its inline properties, its attributes and
  every injected layer rule. Finally, with the panel closed, since the panel is
  portalled over the whole window, it asserts that the image is what
  `elementFromPoint` actually finds at a point inside each zone — which is what keeps
  the negative-`z-index` layer from silently disappearing behind a surface.
- `node test/browser/working-row.mjs` — 5 steps against a session that already has
  turns. It reads the shipped row's computed geometry, asserts the replacement is
  absent while no phrase is configured, configures one, then compares the
  replacement against the captured geometry property by property and asserts no
  placeholder leaked into its label.
- A theme stating one palette was driven by hand across the official schemes: the
  plugin drops it rather than half-applying it, which no bundled theme exercises
  because all three carry a pair. That path is covered by the host tests only
  through the seeding and serving assertions.
- Composed into a real profile (`--dump-config`), then booted: the row loads,
  `$DSH_HOME/themes/` is seeded, `GET /dsh-custom-theme/themes` returns `200`
  with `{"themes":[{"id":"gov","bundled":true},…]}`, `GET /dsh-custom-theme/theme/gov.css`
  returns `200 text/css`, an unknown id returns `404`, and
  `GET /dsh-custom-theme/backgrounds` plus the image route serve a dropped-in
  `.png` as `image/png` while `evil.txt` and `missing.png` return `404`.
- The browser half composes into `window.__DSH_BOOT__` as
  `{"id":"dsh-custom-theme","url":"plugins/??dsh-custom-theme/client.js&rev=…","rev":"…","inject":["@deepseek-ai/dsh-client-ui-settings"]}`,
  and that URL serves `200 text/javascript` containing the
  `settings.section` registration. The `inject` field is
  `dsh.client.inject` reaching the boot graph.
- Both halves were driven from a `--patch` row as well as a bare-package row,
  and `config.themesDir` was confirmed to redirect the directory: dropping a
  `solarized.css` into it made the listing return
  `{"id":"solarized","bundled":false}` and the stylesheet serve `200 text/css`.

Still to confirm by hand, in the running app: the Appearance rows render in
Settings → General, selecting a theme repaints immediately, and disabling the
row removes the rows and the palette together.

## Known limitations

- **A configured phrase drops the elapsed time on finished turns.** The seat a
  replacement row receives does not interpolate parameters, so the shipped
  `{duration}` template would render with an empty slot; the replacement uses only
  parameter-free keys instead. Leave the phrase list empty to keep the shipped row,
  elapsed time included.
- **The running phrase itself is verified by hand.** It only renders while a turn is
  live, which the browser suite does not start; the suite proves the opt-in swap, the
  geometry match and the finished-turn label. The rotation is driven by a
  `setInterval` on the configured interval.

- **The page cannot choose its nav icon.** `settings.section` has no icon field;
  the shell maps the entry id to a glyph and falls back to a generic settings gear
  for an id it does not know, which is what this page gets.
- **One settings section renders at a time.** The official appearance row is on
  the General section, so it is off-screen while this page is open. The page's own
  colour-scheme control covers that case; it drives the same preference.
- **Which custom theme is selected lives in `localStorage`.** The tokens and the
  base palette go to the official runtime, but the official preference field
  accepts only the three built-in ids, so `setTheme` does not persist a custom
  selection and the plugin restores it from `localStorage` on boot. Durable
  cross-device persistence would need a Schemastery `Config` on the Host row plus
  `ctx.configForms`.
- **A theme colours the whole window, buttons and menus included.** There is no
  longer a surface a token theme cannot reach: the tokens ride the official
  runtime, and the base palette follows the theme — for a pair, by the appearance
  preference choosing one of the theme's two sets; for a single palette, by the
  plugin selecting the set that palette belongs to. Reducing the theme's claimed
  coverage is not possible by accident — ask for fewer tokens and you get the
  base palette for the rest.
- **Background zones bind to the shell's DOM skeleton.** The six zone anchors are
  found by the stable half of the shell's CSS-module class names (`_frame`,
  `_sidebarCol`, `_centerCol`) and, where the shell offers one, by a `data-*` hook
  (`[data-composer-seat]`, `[data-rightbar-col]`, and `header` for the title bar).
  Every class the shell hashes keeps its authored name as a suffix, so a rebuild
  does not move them; only renaming those classes or restructuring the layout
  would. `test/browser/appearance.mjs` asserts that each zone paints with the
  global image, so a moved anchor breaks loudly in the test rather than silently
  for a user.
- **A painted surface is given `position: relative` when it was `static`.** The
  picture layer is absolutely positioned, so a `static` surface has to become a
  positioned one for the layer to be laid out against it. That changes the
  containing block for any absolutely positioned descendant the shell has inside
  that surface, which is the one way this feature can move shell layout. It is done
  only where `static` was actually computed, so a surface the shell already
  positions is never touched, and both are removed when the zone is cleared. The
  alternative — leaving the surface `static` — lets the picture escape the element
  it is meant to fill, so it is not an option.
- **A picture layer needs a `::before` free on the surface.** The shell currently
  uses no `::before` content on any of the six zone surfaces (verified in a live
  window: zero elements in the whole shell style one with content), so the layer
  gets that pseudo-element to itself. A future shell build that starts using
  `::before` on one of these surfaces would collide with it; the plugin's rule sets
  `content`, `position`, `inset`, `z-index` and the picture, so the shell's own
  `::before` content would be replaced rather than merged.
- **No Schemastery `Config` schema**, so `config` is read defensively and never
  validated. That is also why the package carries no peer dependencies at all.
- **No live file watching.** A new or edited file needs **Rescan**, and an edited
  *active* theme needs re-selecting.
- **The CSS targets the official DOM**, which is pre-1.0 and changes. Themes
  built on `--dsw-*` alias tokens survive layout changes far better than themes
  that style class names directly.
- **`body { font-family }` in `gov.css` is a deliberate whole-app restyle**, not
  a token override; drop that block if only the palette is wanted.
- **Browser halves are not sandboxed.** This plugin runs in the same realm and
  document as the shell; so does every client plugin, including the official
  theme package.
