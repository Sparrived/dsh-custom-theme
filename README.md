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
| Browser | `lib/client.js` | Its own settings page (**主题与背景**), registered into `settings.section` with theme, colour-scheme, conversation-stream, working-text (phrases and Deeptop's text effects) and background controls. A theme's tokens go to the official theme runtime as an override layer and its base palette to `ctx.theme.setTheme`; the `<style>` element carries only its non-token rules. Backgrounds are written as inline `!important` properties on the painted surface plus one injected rule per picture layer, since a `::before` layer cannot be styled inline |

Served routes:

| Route | Response |
| --- | --- |
| `GET /dsh-custom-theme/themes` | `{ themes: [{ id, bundled }], dir }` |
| `GET /dsh-custom-theme/theme/<id>.css` | The stylesheet text |
| `GET /dsh-custom-theme/backgrounds` | `{ backgrounds: [{ name, url }], dir }` |
| `POST /dsh-custom-theme/backgrounds?name=<file>` | Stores the body as a picture and answers `{ name, backgrounds, dir }` with the name it stored |
| `GET /dsh-custom-theme/background/<name>` | The image bytes |
| `GET /dsh-custom-theme/update` | The cached update state — see [Updates](#updates) |
| `POST /dsh-custom-theme/update/check` | Asks the registries again, ignoring the cache |
| `POST /dsh-custom-theme/update/apply` | Installs the release the last check resolved |

The plugin also watches its own releases: it reports a newer one and upgrades to it on
request, from its settings card or from the plugin manager's page for this bundle. See
[Updates](#updates).

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

While a turn runs, the shell draws its own label at the foot of the transcript —
「深度求索中，用时 13秒 ···」 — beside a whale-tail glyph and a shimmer, and mirrors it
into a visually hidden `role="status"` span. The wording is `chat.deepDiving` /
`chat.deepDivingFor` in the shell's `chat` namespace. Neither a slot nor a dictionary
reaches it: the shell draws that row inside its own Chat view, and
`ctx.locale.register` throws for a namespace and locale pair that already exist.

The one seam that does reach it is the lookup underneath every bound `t`. This plugin
replaces `translate` on the locale service — on the instance where a plain assignment
sticks, on its prototype otherwise — and rewrites only the running-label keys:

- With **no phrase configured nothing is replaced**: the service is left exactly as it
  was found, and the shipped wording is read as it is.
- With phrases, the wording that opens the label becomes the phrase, so the line reads
  「大肥鱼吃饭中，用时 13秒 ···」. Only the wording moves: the elapsed time the shell
  interpolates, the punctuation around it, the trailing marks, the glyph, the shimmer
  and the row's own layout are the shell's, untouched.
- Nothing else is affected — the finished 「已完成，用时 …」 row included, which is why a
  configured phrase no longer costs a finished turn its elapsed time.
- Only a key ending in `.deepDiving` / `.deepDivingFor` is looked at, and the longer
  form is rewritten by swapping out the wording it is built on — its parameter-free
  sibling where the shell ships one (`chat.deepDiving`), and the wording read from the
  row itself where it ships none (the `message.turnProcess.deepDivingFor` pair older
  builds use, which has no sibling). A key the shell renames stops being reworded rather
  than being rendered wrongly.

Rotation needs no timer of its own. The shell re-reads the label on its own one-second
clock while a turn runs, which advances the rotation; a gap in those reads can only mean
the label stopped being drawn, and the next read starts the list over — so each new turn
opens on the first phrase.

All of it sits under **工作时文字** in Settings: the phrases, one per line and up to a dozen
of 120 characters each; the interval they rotate on (1.2–10 s, Deeptop's range); the text
effect and the colours that belong to it; and a sample of the label underneath, which wears
the very rules the transcript's label wears.

#### Text effects

Deeptop's running-indicator effects are ported in its order and under its names —
**静态** (`none`), **流光** (`shimmer`, in **哑光** `matte` and **七彩光** `rainbow`) and
**隐藏** (`hidden`) — with its two colours (text `#4176e6`, sweep `#5ee0ff` by default).
**跟随官方** (`official`) is this plugin's own addition and the default: nothing is
injected at all, so the shell keeps drawing and animating the label it ships. Deeptop's
**呼吸** (`pulse`) and **发光** (`glow`) are not ported: neither could be given without
filling the glyphs, which is the look the rest of this section exists to avoid.

The effects cannot go through a slot either, so they are written as a stylesheet of this
plugin's own — `style[data-plugin="dsh-custom-theme"][data-role="working"]` — which
addresses the row by the marks the shell itself puts on it:

- `[data-chat-running]` is the bar: it is where the shell colours the label and its
  whale, so a chosen colour is set there.
- `[data-shimmer]` (and `[data-text-shimmer]` on an older build) is the label's own
  element.
- `[data-shimmer] > span[aria-hidden="true"]` is the decorative copy the shipped build
  sweeps across the text — the **band**. Its `[data-shimmer-text]` child draws the glyphs
  a spectrum is clipped to.

Every rule is `!important`, because the shell's own label rules are already in the
document and this sheet is injected beside them rather than instead of them. **隐藏**
collapses everything in the bar except the `role="status"` span, so the indicator leaves
the screen and the announcement stays.

##### The matte shimmer

流光 is built the way the shell's own shimmer is, rather than the way Deeptop's was.
Deeptop filled the glyphs themselves with a travelling gradient and made their fill
transparent; the shell instead keeps one solid colour and glides a soft masked band over
it, which is what reads as matte. So the port keeps the shell's mechanics whole:

- the label keeps its colour, and the band is tinted through the very token the shell
  paints its own sweep with (`--dsw-alias-label-shimmer`). One declaration dresses both
  the transcript's label and the page's sample, because the sample's band reads that
  token too;
- the shell's own mask, its two animations and its `prefers-reduced-motion` handling are
  left exactly as they are — nothing here re-times or re-shapes the sweep;
- **七彩光** is the one thing the token cannot express, so there the band's own copy of
  the text is filled with the spectrum instead — still clipped to the glyphs and still
  only visible through the band's mask, while the label underneath keeps its solid colour.

**静态** is the same two declarations with the band switched off, since a still label with
a band gliding over it is not still. Because no effect fills the glyphs any more, the
failure that used to be possible — an untiled or mispositioned gradient leaving glyphs
with no fill and nothing behind them — cannot happen, and the shell's own reduced-motion
rule covers the shimmer without this plugin adding one.

The page shows a sample of the label under the controls, wearing the very rules the
transcript's label wears and carrying its own band built the same way, which is what makes
an effect checkable without a live turn; it rotates on the configured interval for the
same reason.

The swap and the effects are guarded by `test/client.test.mjs`, which materializes the
browser half the way the page does, drives the very lookup the label is read through, and
reads back the stylesheet each choice writes. What the label looks like on screen is
verified by hand, because it needs a live turn;
`test/browser/working-row.mjs` asserts in a real window that the controls store what was
chosen, that the sample's glyphs and its band really wear the rules (through computed
style), and that the plugin adds no row of its own to the transcript.
`test/browser/working-effects.mjs` needs neither DSH nor a live turn: it stands the
shell's row and the page's sample up as fixtures and counts the pixels that change, which
is what holds the mechanic in place — the band tints the end it has reached, leaves the
end it has not reached untouched, and paints nothing at all once it is past the label.

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
| Streaming text fade (`streamingFadeDuration`, `streamingFadeInk`) | Ported from Deeptop: the characters arriving from the reply settle from the writing ink to the text colour instead of appearing at full strength. Duration 150–1500 ms (default 520) and writing ink 5–100% (default 30%, 100% turns it off). Painted with a `CSS.highlights` entry, so it never touches a node — see [The streaming ink](#the-streaming-ink). |
| Reasoning disclosure (`reasoningExpand`) | Ported from Deeptop: automatically unfolds the live reasoning block (`[data-variant="think"]`) while streaming, and collapses it back into a one-line summary chip once finished (`streaming`, default). Also supports keeping it open (`keep`), always keeping all reasoning blocks open including historical turns (`always`), or following the official shell's default collapsed behavior (`off`). User manual clicks on the disclosure header are recorded and preserved; the synthetic clicks that open and close a block are deferred to a macrotask so they never re-enter a React commit. |

Two details worth keeping:

Line spacing rides the shell's delta rather than pinning an absolute
`line-height`, because every content surface computes its own base
(`calc(24px + delta)` on the assistant flow, `calc(22px + delta)` on the user
bubble) — one delta moves them together.

The declarations are emitted at raised specificity (`html:root` / `html body`)
rather than relying on source order. The shell installs its palette styles at
boot and may do so after this plugin runs, so an equal-specificity `:root` or
`body` rule would lose depending on who ran last.

### The streaming ink

Ported from Deeptop: as a reply streams in, the characters just written settle from
the writing ink to the text colour instead of appearing at full strength. Duration
(150–1500 ms, default 520) and writing ink (5–100%, default 30%; 100% turns the fade
off) are both on the settings page.

0.3.1 did this by wrapping the live text in `.stream-ink` spans as it arrived, and it
broke the transcript. React still held the original text nodes, so its next commit
tried to detach a node from a parent that no longer owned it, threw `NotFoundError`
out of `conversation.chat.node`, and the shell's slot boundary dropped the whole
assistant body — the reply showed as a process header with nothing under it, and it
stayed that way across reloads. 0.3.2 withdrew the fade rather than fix it; the fade is
back, done this way instead.

A `::highlight()` rule is written once per live ink and then never touched again. Its alpha
comes from a registered custom property (`--dct-stream-ink`), and the ramp from the writing
ink to the text colour is one CSS animation of that property, started on the element that
owns the text node — the element the highlight reads the property from. That path was
checked in a real browser: the highlight's resolved alpha tracked the animation exactly at
every point of the ramp, and a highlight with no animation came back at the registered
initial value. A chunk therefore costs one animation and one timer for the release, and the
ramp costs no script at all: nothing of the plugin runs per frame while characters settle.

Three costs are kept deliberately small, because a streaming reply writes hundreds of times
a second and competing with the shell for the main thread is how a long reply's own deferred
work — rendering its maths, for one — goes missing. A mutation record is read rather than a
document queried; the records of one frame collapse into one pass; and that pass touches no
stylesheet. `test/client.test.mjs` asserts all three: the coalescing by driving the
harness's frame by hand, the pass by counting the ramps it started, and the rule count by
counting the sheet.

A `Range` is an object React never sees: React's next commit can rewrite that text node's
value and the ink simply follows it, which is exactly what the span version could not
survive.

`test/client.test.mjs` drives the ink against the harness's own text nodes and asserts
its offsets, its alpha, and that the node it paints over keeps the same object, the
same parent and no new siblings. It also asserts, on the source, that the browser half
may not name `createTextNode`, `splitText`, `replaceChild`, `removeChild`,
`insertBefore` or `innerHTML` at all — that rule is what keeps the transcript safe.

One trade-off: `::highlight()` replaces the colour of the characters it covers, so the
newest characters inside a differently-coloured run (a link, a bold fragment) settle
from the surrounding prose colour rather than their own.

Two smaller ones. The ramp lives on the element that owns the text node, so two chunks
written into the same element share it — the newer chunk's ramp restarts and carries the
older ink with it. And a browser that cannot resolve `var()` inside `::highlight()` drops
the colour declaration rather than painting it, which leaves the text at its own colour:
the fade would be missing, and nothing else would change.

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

Two ways in: press **选择图片…** in the **背景图片** row and pick a file, or drop one
into the background directory (`$DSH_HOME/backgrounds` by default) and press
**Rescan**. A picked file is uploaded to the Host, which stores it in that same
directory, so it becomes the same kind of citizen as one dropped in by hand and every
zone can select it. Served extensions are `.png .jpg .jpeg .webp .gif .avif .bmp`,
up to 16 MiB each.

What gets stored is decided by the bytes, not by the file's name or its declared type:
the Host sniffs the leading bytes and refuses anything that is no served format. The
name is folded into the ASCII the directory whitelist accepts (`suite upload.png` →
`suite-upload.png`), and a name already in use stays with the picture that holds it —
picking the same file twice reuses it, a different picture takes the next free `-1`,
`-2`, … beside it. Storing is a round trip, so a picture picked there only takes over the
zone if nothing else was chosen for it in the meantime: a choice made while the upload was
in flight is the newer one and wins.

Which zone the controls below edit is chosen in the **workbench**: a row of tabs naming
each zone, and a schematic of the window whose regions are clickable. Both mark a zone
that already carries a picture, so the panel answers at a glance what is set where. The
**整体** label belongs to the whole-window zone, which owns the frame the other regions
sit inside — dashed while it is empty, solid once it carries a picture.

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

The **整体** entry is one picture across the window, not one crop per zone. The shell's
columns are opaque, so the frame itself cannot be painted behind them and the picture has
to go on every zone; measured against each zone it would then be cropped once per zone —
a band per column and per bar, each showing its own slice, with the seams between them
reading as a stack of pieces rather than a background. So a spread picture is anchored to
the viewport instead, and every zone shows its own window onto the same picture. A zone
with a picture of its own keeps covering that zone, which is what picking one for that
zone means.

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

The shell rebuilds whole subtrees as you move around: opening a conversation throws the
column, its header and the composer seat away and builds new ones, and the markers and
inline declarations go with the old elements. Only the sidebar, which is not rebuilt,
would keep its picture — the conversation half would go bare. The plugin watches for a
surface it painted leaving the document and paints the zones again, from the saved
settings, so the picture follows the shell rather than staying on elements that are gone.

That repaint runs inside the observer callback and never on a timer. A `MutationObserver`
callback runs before the browser paints, so the replacement elements are painted in the
same frame the shell put them in and no bare column is ever shown. 0.4.0 waited 150 ms
first, to keep a running turn from repainting the app on every mutation; that delay was
itself the flash a conversation switch showed, and the check it was debouncing — one
identity test per painted surface — is cheap enough not to need one.
`test/client.test.mjs` holds it in place: with the debounce restored the test fails,
because the rebuild has not been repainted by the time the callback returns.

### What the picture takes out of the way

The shell draws its own chrome over the zones it hands the plugin: a 0.5px rule under the
conversation header, the fade the transcript has above the composer seat, and the workspace
list's fade at the bottom of the sidebar. On a bare panel those read as structure; over a
picture they read as lines and black bands across it. A zone that carries a picture
therefore takes them out of the way, in rules that go into the same per-pass sheet as the
picture and so are gone with it.

The selectors are named as tightly as the shell allows. `[class*="_header"]` alone would
also match the header of every code card, terminal block, search block and question panel
rendered inside a reply — each is a real class in the shell — so the conversation's own
header is named as the one that holds a title row, which nothing else does. The sidebar's
fade is the `.fade` the workspace browser renders as a child of its `.treeBody`, and the
composer's is on the seat itself, which is also the zone's anchor.

Zones can also sit inside one another: the composer seat is a descendant of the
conversation column, so both are painted and both would write a panel fill. Two 91% fills
composite to 99%, and the result is a near-black block over the picture — which is what a
new session showed in the middle of the column, around the welcome block and the input
card. A nested zone therefore writes only the fill that brings the two of them to the
opacity configured for that zone together (for equal values, no fill of its own at all,
because the outer one already covers it) and paints no second copy of the same picture,
because the outer layer is already behind it.

The whole-window entry is the one layer that never counts as covering a zone. It is painted
on the frame, and the frame sits behind the shell's opaque columns, so its layer is
invisible in every zone — which is exactly why that entry is also spread over the zones.
Counting it as covering them took the picture off the entire window at once, because every
zone is nested inside the frame.

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
pnpm pack                                                        # -> dsh-custom-theme-<version>.tgz
dsh plugin --profile <name> add ./dsh-custom-theme-<version>.tgz
```

### Releasing (maintainer)

Every release carries a note for the person upgrading, in `releases/v<version>.md`, filled
from the template in `.dsh/skills/dsh-custom-theme-release/`; that workspace skill
(`dsh-custom-theme-release`) walks the whole thing — pre-flight, version, changelog, note,
tag, publish, GitHub release — and the four artefacts it names have to agree:

```sh
git tag v<version> && git push origin v<version>
pnpm pack
npm publish --access public
gh release create v<version> --title "v<version> — <headline>" \
  --notes-file releases/v<version>.md dsh-custom-theme-<version>.tgz
```

npm requires two-factor authentication for **every** publish. A passkey (Windows
Hello) has no 6-digit code to type, so the publishing token must carry the bypass:
create a **Granular Access Token** with **Bypass two-factor authentication (2FA)**
ticked and `Read and write` on packages. A token without that flag is refused with
`E403 ... granular access token with bypass 2fa enabled is required to publish`,
and weakening the account's 2FA mode to `auth-only` does not change that.

### Configuring the directories

`themesDir` and `backgroundsDir` can be overridden on the row; otherwise
`$DSH_HOME/themes` and `$DSH_HOME/backgrounds` are used. `updateCheck: false` skips
the update check at boot, while the settings card's own button and both routes keep
working:

```yaml
- id: custom-theme
  name: 'dsh-custom-theme'
  config:
    themesDir: D:/themes/dsh
    backgroundsDir: D:/wallpapers/dsh
    updateCheck: true
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

`test/browser/working-effects.mjs` is the exception: it needs no instance, no
token and no live turn. It stands the shell's running row up as a fixture in a
browser it starts itself and injects the rules each text effect generates, so
`npm run test:effects` runs anywhere the driver finds a Chromium browser.

## Updates

The plugin checks npm for a newer release once per boot and caches the answer for six
hours; a failed check is cached for one minute, so a blip cannot hide an update for
the rest of the window. A manual **检查更新** ignores the cache.

Nothing is replaced behind your back. The check only reports, and the upgrade is a
button: no code is swapped until you click it.

**Where it shows up.** Both surfaces read the same cached answer:

- A row on **设置 → 主题与背景**, next to the theme and background pickers.
- Three contributions to the plugin manager's own page for this bundle, each with one
  job: **升级** in the page's actions area beside the enable switch and uninstall, an
  *Update available* badge beside the title, and a section under the page's content
  carrying the version detail and **检查更新**. All three are drawn only when a newer
  release exists, and every other plugin's page is untouched — an entry renders nothing
  for a subject it has nothing to say about. The upgrade button lives in one place, so
  the section does not repeat it.

**Upgrading.** **升级** installs the exact version the check resolved, through the
plugin manager's own `installBundle`, so the profile's lockfile and bundle list stay
consistent with anything you install from the Plugins page. Replacing a package cannot
hot-swap the Host module, so an upgrade always ends with *restart DeepSeek Harness*;
the row then says so instead of offering the same upgrade again.

**Which registry.** The check asks the profile's plugin-manager configuration, in its
order: the configured registry, then the one pnpm resolves, then the configured
fallbacks. A mirror or private registry therefore stays authoritative and is never
silently widened to the public one. With nothing configured, that resolves to
`https://registry.npmjs.org/`.

**Routes**, under the plugin's prefix and reachable with the page's own token:

| Route | Method | Answers |
| --- | --- | --- |
| `/dsh-custom-theme/update` | `GET` | The cached state: running version, latest, whether it is an upgrade, and the registry that answered. |
| `/dsh-custom-theme/update/check` | `POST` | Asks the registries again, ignoring the cache. |
| `/dsh-custom-theme/update/apply` | `POST` | Installs the release the last check resolved. |

Only the two actions answer `POST`: a `GET` stays safe for a link, a prefetch or an
`<img>`, none of which may start an install. A run that does not end in `applied` or
`restart-required` is reported as an error carrying the plugin manager's own
diagnostic, and the upgrade stays on offer.

## Verify

Verified against `dsh` 0.2.0-rc.2 on Windows:

- `node --test "test/**/*.test.mjs"` — 74 tests, all passing: 47 on the Host half, then the
  27 of the browser half broken out below. The Host half covers id and image-name
  whitelists, ordering, directory resolution, seeding, re-sync on a new seed
  generation, both asset routes, both listings, traversal, extension and method
  rejection, image sniffing from the leading bytes, the upload-name fold and its
  collision rule, and the upload route — that it stores the bytes it was handed, that
  a name it cannot serve is folded rather than refused, that it cannot be made to name
  a path outside the directory, and that an oversized, empty or non-image body is
  refused — and the update surface: semver precedence including prerelease ordering,
  registry-candidate order and the private-registry rule, the registry query falling
  through a failure to the next candidate, the cache's success and failure windows, and
  all three update routes, including that a failed install is reported as a failure
  rather than as a pending restart.
- `node test/client.test.mjs` — 27 tests of the browser half, which this suite
  materializes the way the page does, through the doubles in `test/harness.mjs`: a fake
  module loader, a fake `require` for the two modules it asks for, a localStorage double
  and a locale service carrying the shell's `chat` dictionary (the same file the fixture
  suite boots the plugin with, so both generate the rules from the plugin itself rather
  than from a copy of them). For the wording they assert that an empty list leaves the
  service's `translate` identical, that a phrase replaces the wording while the shell's
  `{duration}` and the punctuation after it survive (「大肥鱼吃饭中，用时 13秒 ···」), that a
  clock
  template whose parameter-free sibling the shell does not ship is reworded from the
  wording it reads, that every other key — the finished 「已完成，用时 …」, the plugin's own
  namespace — reads as shipped, that the phrase rotates on the reads the shell makes and
  starts over after a gap wider than a turn's own clock, that a corrupt or empty list falls
  back to the shipped label, that disposing the plugin restores the original lookup, that a
  service which refuses the replacement or exposes no lookup at all is reported rather than
  crashed into, and that no `conversation.chat.node` entry is registered any more. For the
  effects they read back the stylesheet each choice writes: that the shipped look writes
  none, that the matte shimmer is one rule setting the label's colour and the token its
  band is painted with — with no fill, no background and no animation of its own, and with
  the shell's band left running — that the rainbow adds exactly one rule, which puts the
  spectrum on the band's own copy of the text and leaves the label's colour alone, that
  `静态` keeps the colour and switches the band off, that hiding collapses the bar with
  `:not([role="status"])` and leaves the sample alone, that an unknown effect, shimmer or
  colour falls back instead of reaching the stylesheet — including the two effects this
  plugin no longer ports — and that disposing the plugin takes the stylesheet with it.
  For the streaming fade they assert that the default sheet carries its two variables, that
  chosen values reach it and are clamped to the allowed range, that a corrupt payload falls
  back to the defaults, and that disposal removes that sheet as well; and, for the theme
  fix, that applying each bundled theme strips `--*` declarations out of the sheet it
  injects, synthesises the shiki foreground and background for the theme's palette, keeps
  explicit ones it is given, and moves dark non-token rules onto `body[data-ds-dark-theme]`.
- `node test/browser/appearance.mjs` — 39 steps in a real headless Edge, all
  passing. It boots the app, asserts the controls are absent from the chat view and
  still absent once Settings opens, then opens the plugin's own page from the nav
  and drives it. It asserts on rendered state: each bundled theme paints its light
  set and then follows the page's colour-scheme control into its dark set without
  being dropped, the empty option restores a built-in token, a saved theme and
  background both re-apply on boot before Settings is opened, and the writing ink's two
  controls render and persist both values. For the
  background
  workbench it checks that every zone is reachable both as a tab and as a schematic
  region, and that clicking the picture of a zone moves the very selection the tabs
  report. For the file picker it puts a real `File` on the input — the state the
  dialog leaves behind — and asserts the picture is uploaded, comes back under the
  folded name, is added to the listing, is selected for the zone that was being
  edited, and is genuinely painted on that zone. It also stands the panel in front of a
  Host from before this feature by answering that one route with the `405` such a Host
  sends, and asserts the row asks for a restart instead of blaming the picture; and it
  uploads a file that is no picture, asserting the row names the format. For backgrounds it
  checks that the picture really is on the layer and not on the surface element, that
  the layer's own alpha is the configured picture opacity while the panel fill stays
  at its per-zone percentage, that a blur lands on the picture layer and nowhere a
  text-bearing element could inherit it, that both new controls clamp at Deeptop's
  ceilings, and that clearing a zone removes its inline properties, its attributes and
  every injected layer rule. The whole-window picture is asserted to be anchored to the
  viewport on every zone it is spread over, and a zone's own picture to be anchored to
  that zone instead. Finally it stands in for the shell's own rebuild — the thing that
  used to leave half the window bare — by replacing a painted element with a fresh copy
  carrying none of what the plugin wrote, and asserting the picture reaches the
  replacement on its own, with the zones the shell left alone untouched. Finally, with the
  panel closed, since the panel is
  portalled over the whole window, it asserts that the image is what
  `elementFromPoint` actually finds at a point inside each zone — which is what keeps
  the negative-`z-index` layer from silently disappearing behind a surface. That
  sampling is the one thing DSH's own UI can disturb: a freshly created profile opens
  the `预览版说明` first-run notice, whose backdrop covers the window and answers every
  `elementFromPoint` query, so those four visibility steps read nothing even though the
  assertions before them — which read the tagged surfaces and the layers beside them
  directly — still pass. The suite dismisses the notice after boot and again before
  sampling, so it is verified both on a freshly created profile and on a long-lived
  one.
- `node test/browser/working-effects.mjs` (`npm run test:effects`) — 6 steps against a
  real headless Edge, and the one suite that needs neither DSH nor a live turn: it stands
  the running row up as a fixture — the markup and the module CSS transcribed from the
  installed build, `data-shimmer` root, the decorative `aria-hidden` band and the two
  animations that slide it across the text — injects the very rules the plugin generates
  for each choice, and does the same for the page's own sample, built from the page
  stylesheet the plugin itself writes. Beyond the computed styles it counts changed
  pixels, which is what makes the mechanic checkable rather than merely plausible: the
  label's fill is the chosen colour and no background is painted behind the glyphs, the
  band tints the end it has arrived at (188 pixels at the near end when it enters), leaves
  the end it has not reached untouched (0 pixels at the far end at the same moment, and 0
  at the near end once it has gone past — the asymmetry that separates a travelling tint
  from a fill of the whole label), the label with the band away is pixel-for-pixel what it
  is with the band switched off entirely, the spectrum rides in the band while the label
  stays solid, `静态` does not move a single pixel, and `隐藏` leaves the live-region span
  behind while everything else in the bar stops being drawn. The last step holds the
  sample's copy of the band to the label it tints: at the point where both translations are
  zero the two boxes must agree to within a pixel. It writes `shot-work-*.png` beside the
  other suites' captures.
- `node test/browser/working-row.mjs` (`npm run test:working`) — 10 steps against a session
  that already has turns, in a real headless Edge. It asserts the plugin owns no row in the
  transcript: the shell's own `[data-turn-process]` rows are there and no replacement row,
  and no `data-role="turn-row"` stylesheet, is. It then drives the controls — typing two
  phrases stores both with an interval, choosing each effect stores it and writes its
  rules, both colours come from their pickers into the rules — and reads the sample's
  *computed* style back to prove the rules reached it: the glyphs keep the chosen colour
  while the band beside them takes the sweep colour and runs the page's own animation, the
  spectrum lands on the band's copy with the glyphs still solid, `静态` switches the band
  off and keeps the colour, the note replaces the sample for `hidden`, and choosing the
  shipped look again leaves nothing of the plugin's behind. Finally it re-asserts that a
  configured phrase and effect add nothing to the transcript, which is the regression the
  row-cloning implementation had.
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

- **The running label is reached through the locale service and its own attributes, not
  a slot.** The shell draws that row itself, registers no seat for it and refuses a second
  dictionary for a namespace and locale pair it already has, so the wording is swapped on
  the lookup every bound `t` dispatches through, and an effect is written as a stylesheet
  against `[data-chat-running]`, `[data-shimmer]` / `[data-text-shimmer]` and
  `[data-shimmer-text]`. The failure mode of either is the same and is quiet: a shell that
  renames those keys or those marks stops being reworded or dressed and keeps its own
  label. It cannot render something wrong in their place. The matte shimmer needs the least
  of this and fails the most quietly of all: it only recolours the band the shell already
  draws, so a build that draws none shows the label in the chosen colour with no sweep,
  rather than a broken one.
- **The running phrase itself is verified by hand.** It only renders while a turn is
  live, which the browser suite does not start; `test/client.test.mjs` proves what the
  lookup resolves to and which rules each effect writes, and the browser suite proves the
  sample wears them in a real window. Rotation is driven by the shell's own one-second
  re-reads rather than by a timer here, and the sample under the controls rotates on the
  configured interval.
- **An effect applies to the running indicator only.** Deeptop dresses the label and its
  colour and leaves message text alone, and so does this: the rules are scoped to
  `[data-chat-running]` and to the page's own sample, so a chosen colour never reaches a
  transcript row.

- **A picked file keeps its bytes, not its name.** The background directory's
  whitelist is ASCII, and a stored file has to pass it to be listed or served at all,
  so a name outside it is folded rather than refused: `我的壁纸.png` is stored as
  `background.png`. The picture and its selection are unaffected. Allowing Unicode
  names would mean relaxing that whitelist, which is the boundary guarding every read
  from the directory, so it is left strict.
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
- **An upgrade needs a restart.** Replacing a package cannot hot-swap the Host module,
  so after an upgrade the new code is on disk while the running process keeps the old
  one. The row says a restart is pending rather than offering the same upgrade again;
  the Browser half comes back with that restart too.
- **The update check needs the plugin-manager service.** Without it the row reports
  that updates cannot be checked rather than guessing. That service names the
  registries to ask and performs the install, which is why the check follows its
  configuration instead of a hard-coded URL.
- **A check answers from a six-hour cache.** The boot check and the first page open
  share one answer, so a release published in between waits for the next window or for
  **检查更新**.
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
