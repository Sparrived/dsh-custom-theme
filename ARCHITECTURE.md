# Architecture

`dsh-custom-theme` is one npm package that runs in two places at once. The **Host
half** is a Cordis row loaded by the DSH profile; the **Browser half** is a client
module the Web GUI loads into its own page. They meet at one prefix route.

This document is the map: what each layer may do, where a change belongs, and which
checks hold the shape in place.

## The two halves

| Half | Source | Ships as | Runs in | Owns |
| --- | --- | --- | --- | --- |
| Host | `src/index.mjs` + `src/host/`, `src/themes.mjs`, `src/effort-levels.mjs`, `src/update.mjs` | `src/index.mjs` (plain ESM, no build) | the DSH process, as a Cordis row | the theme and background directories, the profile's patch file, the update check, and the one HTTP route |
| Browser | `src/client/` (38 CommonJS modules) | **one** linked file, `lib/client.js` | the Web GUI page, as a lazy client module | everything the user sees: the settings page, the painted backgrounds, the appearance sheet, the slider, the strings |

Both are zero-dependency. The package installs nothing: `react` and `react-dom` are
seeded into the page by the shell, and the Host half imports only `node:` builtins.

## Why the browser half is one file

DSH's client module system runs a script that calls
`window.__ModuleLoader__.load({ id, factory })`. The `factory` may only `require`
what the page has already seeded — React and React DOM — and it runs *lazily*, when
the shell first resolves the row. A second package-local script is a separate,
asynchronously fetched resource that a factory cannot pull in synchronously.

So the sources live as normal CommonJS modules under `src/client/`, and
`scripts/build-client.mjs` links them into that one file. Each module's text is
embedded as it stands — every line indented two columns so the registry reads as one
file, and CRLF normalized to LF — with its `require` calls left in place, because the
bundle carries the resolver that runs them. What the build decides, once, is whether
every request is one the page can satisfy: a path that does not exist fails the build
instead of the page.

## Layout

```
src/
  index.mjs                 the Host row: resolve directories, start seeding,
                            build the two surfaces, register the route
  host/                     the Host half's implementation
  client/                   the Browser half's sources (one module per concern)
  themes.mjs                pure theme/picture rules: ids, byte caps, name
                            sanitising, content types  (no fs)
  effort-levels.mjs         pure text surgery on the profile's cordis.patch.yml
  update.mjs                pure npm-registry client: version compare, cache
lib/client.js               GENERATED — the linked Browser half. Do not edit.
themes/                     the three seeded stylesheets (gov, monokai-pro, one-dark)
cordis.patch.yml            the bundle's own patch layer
scripts/build-client.mjs    the linker (also exported, for the drift guard)
test/                       the suites, one file per concern
test/browser/               fixtures that need a real browser
test/diagnostics/           on-machine checks against a running DSH install
```

### The Host half

| Module | Owns |
| --- | --- |
| `index.mjs` | the row: `name`, `apply`. It wires, it does not implement |
| `host/home.mjs` | `$DSH_HOME`, honouring the environment override |
| `host/urls.mjs` | the route prefix and the URL one stored picture is served at |
| `host/http.mjs` | `send`, `decodePath`, `readJson` — the small HTTP layer |
| `host/route.mjs` | the handler for the whole subtree under the prefix |
| `host/themes-store.mjs` | seeding the bundled stylesheets, listing and reading them |
| `host/backgrounds-store.mjs` | listing pictures, serving one, storing an upload |
| `host/profile.mjs` | finding the profile's patch file, and the reasoning-level switch |
| `host/updates.mjs` | the version this build runs, the check, and the install |
| `themes.mjs` | the rules all of the above obey (ids, caps, sanitising, sniffing) |
| `effort-levels.mjs` | the patch text: apply, revert, inspect |
| `update.mjs` | registry candidates, version precedence, cache windows |

The split is by *effect*: `themes.mjs`, `effort-levels.mjs` and `update.mjs` touch
no filesystem and no network, which is why they are unit-tested directly, while
`host/*` owns every read, write and fetch.

### The Browser half

Modules are grouped by the feature they belong to; `index.cjs` is the only one that
knows how they fit together.

| Module | Owns |
| --- | --- |
| `index.cjs` | the composition root: strings, the three sheets, every feature built once, the slot registrations, the teardown, and `__internals` |
| `shared/element.cjs` | `h = React.createElement`, required once for the whole half |
| `shared/endpoints.cjs` | every URL the half fetches |
| `shared/keys.cjs` | the `localStorage` keys |
| `shared/color.cjs` | colour primitives (mix, emit, parse, re-alpha) |
| `shared/host-api.cjs` | the three calls into the Host route |
| `i18n/dictionary.cjs` | the namespace and every string |
| `theme/selection.cjs` | the selected theme id |
| `theme/overrides.cjs` | a theme stylesheet as an override layer: tokens to the shell's runtime, non-token rules into this plugin's sheet |
| `backgrounds/zones.cjs` | the zone model and the ranges one zone's settings take |
| `backgrounds/store.cjs` | the per-zone picture choice |
| `backgrounds/paint.cjs` | painting the zones, and re-painting across shell re-renders |
| `appearance/constants.cjs` | the appearance choices and their stored payload |
| `appearance/index.cjs` | the font, line-gap and streaming-fade sheet |
| `stream-ink/index.cjs` | the ink: the newest characters, ramped in |
| `reasoning/auto-expand.cjs` | the live reasoning block, plus the mutation pump |
| `working/constants.cjs` | the working-text model |
| `working/index.cjs` | the running phrase |
| `working/label.cjs` | the shell's running label, reworded through its lookup |
| `effort/constants.cjs` | the slider's geometry, colour, motion and slot |
| `effort/styles.cjs` | the slider's stylesheet |
| `effort/math.cjs` | the arithmetic behind the slider — pure, so the effect is testable |
| `effort/directory-access.cjs` | the session's model directory, read and written through the shell |
| `effort/dom-probe.cjs` | finding the effort row, its value cell and its seat by semantics |
| `effort/bridge.cjs` | claiming the effort row, and giving every inline style back on release |
| `effort/slider.cjs` | the control itself: the track, its layers, the drag and the keyboard path |
| `effort/messages.cjs` | the control's strings, and the settings row that switches the feature |
| `effort/entry.cjs` | the slot entry the row registers, and the context a slot does not carry |
| `injections/constants.cjs` | the restored row's kind, seat, caps and stylesheet |
| `injections/model.cjs` | reading a logged message as an injected-context row, or as nothing |
| `injections/definition.cjs` | the Definition the conversation's own registry is given |
| `injections/state.cjs` | the switch, the seam the shell exposes, and the bridge seat |
| `injections/view.cjs` | the disclosure row, and the registration of its Definition |
| `injections/bridge.cjs` | subscribing the conversation's event log to the registry |
| `settings/styles.cjs` | `PAGE_CSS` |
| `settings/page.cjs` | the settings page itself |
| `update/client.cjs` | the update snapshot and its two actions |
| `update/rows.cjs` | the update rows on the plugin manager's page |

## The rules

1. **One direction between the halves.** The browser half reaches the Host half only
   through the documented route. The Host half never imports `src/client/`, never
   imports `lib/client.js`, and never sends the page anything but JSON, CSS or
   image bytes.
2. **No cycles.** A cycle makes load order load-bearing and is invisible in review —
   it is checked.
3. **Features are wired only from the entry.** A feature module takes what it needs
   through its factory's `deps` or through a `require` of a leaf module. It never
   reaches back into `index.cjs`, and it never registers a slot of its own: the
   entry owns the list of what is installed.
4. **No runtime dependencies.** The Host half imports `node:` builtins only; the
   browser half imports `react` and `react-dom` only, and the build refuses anything
   else, because the page has nothing else to give.
5. **Effects are owned.** Anything a feature installs — an observer, a listener, a
   `<style>`, an override layer — is undone by the entry's teardown effect, in the
   reverse order it was installed. A disposer is installed by the *first apply*, after
   the module has already returned, so it is reached through a call
   (`releaseOverrides: () => releaseOverrides()`) and never exported as a value: the
   value would be the no-op the binding started as, and the layer would outlive the
   plugin while every test still passed.
6. **The text is the behavior.** The strings, the CSS, the selectors and the
   comments came across from the single-file version line for line, and the split was
   verified against a frozen copy of it — every code line, every string value in
   both locales, and every template literal. "Line for line" is checked, not assumed:
   36 of the original's lines have no counterpart in `src/client/` — a rename, an
   accessor standing where a value was read, the loader wrapper the linker now
   generates — and each of the 36 was inspected for the behaviour it carried. The one
   deliberate difference is line endings: the modules are normalized to LF, so a
   stylesheet template that used to carry CRLF now carries LF, which no CSS parser
   distinguishes. A reformat of a template literal is a behavior change: the page
   paints whatever the string says.

## The build

```sh
npm run build:client     # write lib/client.js from src/client/
npm run check:client     # fail when lib/client.js is stale
```

`scripts/build-client.mjs` is also importable: `build()` returns the bundle text, which
is how the drift guard compares the committed artifact with the sources — the same
function the command line writes with, so the check cannot pass on a different
code path than the build.

Editing `lib/client.js` directly is never right. It is generated, and the guard
fails when it stops matching `src/client/`.

## The guardrails

`test/architecture.test.mjs` holds the shape in place. It checks that:

- every module in `src/client/` is reachable from `index.cjs` — a module nothing
  imports is dead code that still ships;
- every import names something its target exports — destructuring a name a module
  does not export is `undefined`, and the failure surfaces far away;
- the module graph has no cycle;
- `lib/client.js` is byte-for-byte what the sources link to;
- the Host half never imports the Browser half or the built bundle, and the Browser
  half never requires a Node builtin, however it is spelled (`node:fs` and `fs`);
- neither half hard-codes an absolute machine path — a Windows drive, or a POSIX path
  under a system root;
- `package.json` ships both halves, both documents, and every entry in `files` exists
  on disk.

Each one was mutation-tested: it fails when the fault it describes is planted. One
limit is worth naming, because the failure is loud rather than silent: the linker's
request scanner reads `require(` inside a regex literal as a request, so a module
whose pattern matches that text fails the build with "is not available in the page"
until the pattern is spelled differently.

## Adding a feature

1. **Decide the half.** Anything that reads or writes the user's disk, or touches the
   profile, belongs to the Host half — the Browser half has no filesystem. Anything
   the user sees belongs to the Browser half.
2. **Host**: put the work in `src/host/<concern>.mjs`, keep the pure rules in
   `src/<concern>.mjs`, and add the surface to the object the route is handed in
   `src/index.mjs`. A route that writes answers `POST` only.
3. **Browser**: add a module under `src/client/<feature>/`, give it a factory taking
   `deps`, import only leaf modules, and wire it from `src/client/index.cjs` — build
   it, hand it its neighbours, register its slots, and undo it in the teardown.
4. **Tests**: one file per concern. The browser half is exercised through
   `test/harness.mjs`, which materializes the bundle the way the page does.
5. **Build and document**: `npm run build:client`, then a line in the table above and
   in the README if the shape changed.
