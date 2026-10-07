# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.3] - 2026-10-07

The reasoning row of the model menu becomes a slider, the injected-context rows the shell hides
come back behind a switch, and third-party models that declare no reasoning levels are given them.
The picture 0.4.2 hid is back and the composer's mask stays where it was; behind all of it the code
is now two halves with an explicit module graph.

### Added

- **The 「上下文注入」 rows come back, behind a switch.** Every piece of text the harness injects
  into the model's conversation — a skill's instructions, the skill catalog, the workspace's rules,
  an `@session` recall, a notice — is logged as a `user/message` or `developer/message` whose source
  is not `user`, and the shell used to draw each one as its own disclosure row. The installed build
  hides them: its Chat filter keeps a context row only when the injection also records a tool
  addition or removal, so an ordinary injection is invisible in the transcript although it is still
  logged and still reaches the model. The settings page now carries **注入提示 / Injection notices**
  in the conversation section — **跟随官方** (the default, the shipped behaviour) or **显示**, which
  restores the rows where they belong.

- **`test/injection.test.mjs`**, which drives the feature through the two services it is a contract
  with — a Definition registry that keeps what it is given, and a slot service whose declared seat
  hands the renderer back — plus a stateful React double for the disclosure itself: what the shell
  logs and what it must not, the producer labels and presentation forms, the four ways the shell's
  waking case is decided, the collapsed and opened row, and the two invariants that matter most (off
  registers nothing at all, and a waking message's node stays hidden).


- **The reasoning-level slider.** The row the shell renders for reasoning effort stops being a
  rail of stops: it now carries the control
  [dsh-codex-effort-slider](https://github.com/Microqian2th/dsh-codex-effort-slider) (MIT) draws,
  re-implemented here so the two read the same at a glance. One continuous track, a fill that runs
  blue → violet → deep violet with the knob's position, the level's name coloured in the row and on
  the collapsed seat, and — from the second level rightwards — a purple nebula whose 22-star field
  thickens, quickens and brightens as the knob travels. Dragging anywhere on the track selects the
  nearest level, the arrow keys move one level at a time and Home/End jump to the ends. The row is
  dressed taller and wrapping (`padding-block: 10px`) to make room, and the menu is asked to
  measure again.

- **A drag costs one frame's work per frame, not per pointer event.** On a 165Hz panel the
  reference's drag path — and this port of it — ran its whole update per `pointermove`: a React
  pass, a style write on the shell's row, a style write on its value cell, four layer widths, the
  energy variable every rule under it reads, and a `getBoundingClientRect` on the track that stops
  the browser to lay out again before every one of them. The whole desktop pays for the frames
  nobody can see: on a laptop whose wallpaper is animating on the same GPU, dragging the knob
  stuttered the wallpaper too. A drag now paints once per animation frame — the display's own
  cadence, so the knob never lags the pointer by more than a frame, and a burst of events costs
  one frame of work rather than one update each. It also measures the track once for the whole
  gesture, keeps the starfield built rather than rebuilt, and skips a style write whose value the
  last frame already wrote. Nothing about the picture changes, and a release still lands on the
  level the pointer was over, including one that arrived inside the last frame.

  What is left on that frame is what the pointer is on: the knob, the fill's edge and the fill's
  own colour, and the starfield's timing, which stays continuous because re-timing an animation
  mid-flight re-maps its progress — a duration changed in steps would make the field hop, which is
  the stutter this was meant to remove. What follows on every third frame is the part that is a
  value rather than a motion: the energy behind the track's glow and the nebula's opacity, the
  field's density, the stars' layer opacity. The stylesheet already eases all of those over 0.2s,
  so an ~18ms step at 165Hz is inside the easing, while re-rastering a blur radius and repainting
  the shell's own row 165 times a second is work the frame the pointer needs is short of. The 22
  stars are also built once and a star the position does not show is hidden with `display: none`
  rather than taken out of the tree, so crossing a level during a drag no longer adds and removes
  nodes inside the shell's own menu and wakes the watcher that re-hangs this control.

- **Adjusting into Max warns what it costs.** A drag that lands on the top level draws
  **将使用更多额度 / More quota will be used** over the row's own value cell in that level's colour,
  and one second later the line turns over (`rotateX(180deg)`) to show the level's name. Both faces
  fill the same box and end at the value cell's right edge — the cell is wider than the word in it,
  and centring would strand a short name like `Max` mid-row — so the text itself flips in place
  rather than one line being swapped for another. It is an overlay this plugin owns: it paints no
  background of its own — the shell's own value text is hushed with a colour rule while the notice
  stands on it, and given back untouched — so the phrase can never land on a shade it guessed wrong,
  and the row still says `Max` and the menu still reports `Max` throughout. The notice appears only
  for an adjustment into the top level — opening the menu already sitting there says nothing — and
  leaves with the level or the row.

- **Third-party models that declare no reasoning levels are given `off` / `low` / `high` / `max`.**
  A gateway that does not spell its thinking levels out gets none: `dsh-llm-pi-ai` reports the model
  with no `reasoning` at all, the shell draws no effort row for it, and any level picked by hand is
  refused with `UNSUPPORTED_REASONING_EFFORT` before the request is built. The host half now rewrites
  the models of the profile's own `cordis.patch.yml` that declare nothing (or `reasoningEfforts: false`)
  and gives them the four levels. **自动补全推理档位 / Reasoning levels for every model** in the
  settings page shows what the file holds and switches the feature off, which takes the added lines
  back out and puts a `false` the file had back as it was. The edit is a change to the profile, which
  is read at boot, so the row says **重启 DSH 后生效** until DSH restarts.

- **`test/effort.test.mjs`**, which asserts the effect as arithmetic — the fill's two ends, where
  energy starts and where it saturates, the durations at each speed, the phase/height decorrelation
  of the field — and then drives the rendered control against a fake official menu and a stateful
  React double: the track and its ticks, the drag, the keyboard, a refused write, the
  reduced-motion path, and the row being put back when the menu closes. It also covers the quota
  notice: that the overlay is placed on the value cell, that the flip is a state on the element the
  notice already is rather than a replacement, and that a drag into the top level warns first and
  shows the level's name after the second.

- **`test/effort-levels.test.mjs`**, which attacks the level patch from the side that matters most —
  what it must *not* change. A fixture in the user's own shape (comments above the provider and the
  list, a hand-declared level dict, a `reasoningEfforts: false`) is patched, re-patched, reverted and
  compared: only lines carrying this plugin's marker ever move, the second pass is a no-op, the
  revert restores the file byte for byte, CRLF and the final newline survive, and a profile without
  the provider row is left alone. Six more tests in `test/host.test.mjs` drive the same feature
  through the real route against a home and profile of the plugin's own: the boot pass, the switch,
  a second boot, which profile gets edited, a profile with no patch file, and the refused methods.
  Three in `test/client.test.mjs` cover the page's half: the route the row posts to, every sentence
  the row can show (which is also what keeps the two dictionaries in step), and the row's own tree —
  the switch's checked, disabled and change handler.

### Changed

- **The project is laid out as two halves with an explicit module graph.** The browser half was one
  5,787-line `lib/client.js` (the working tree's — the last released one is 3,633 lines); it is now 38
 CommonJS modules under `src/client/` — `shared/`, `theme/`,
  `backgrounds/`, `appearance/`, `stream-ink/`, `reasoning/`, `working/`, `effort/`, `injections/`,
  `settings/`, `update/` — linked back into the same single artifact by
  `scripts/build-client.mjs`. The Host half's single `src/index.mjs`, which by then also carried the
  update surface, is now an 83-line Cordis row over `src/host/` (home, URLs, HTTP, route, theme
  store, background store, profile, updates), with the pure rules it obeys left in `src/themes.mjs`,
  `src/effort-levels.mjs` and `src/update.mjs`. The
  published package, every route, every string, every stylesheet and every selector are unchanged:
  the code moved as it stood, and the modules were checked name by name against a frozen copy of the
  file they came from — every code line, every string value in both locales, and every template
  literal (identical apart from the line endings, now LF). 36 of the original's lines are
  re-expressed rather than copied — a rename, an accessor where a value was read, the loader wrapper
  the linker now generates — and each was inspected for the behaviour it carried.

- **The build is a command, not a convention.** `npm run build:client` links `src/client/` into
  `lib/client.js`, and `npm run check:client` fails when the two have drifted apart. Editing the
  bundle by hand is no longer possible to do by accident: the suite fails on it.

### Fixed

- **The slider could never appear in the shipped app.** The entry registered correctly — its
  invisible anchor rendered in the composer — but the component was handed the plugin's own
  context, and that context never injects `modelDirectories`: a Cordis service is readable only
  from the context that injected it, so `directoryFor` never ran, the level list stayed empty and
  the bridge never claimed the menu's row. It is now handed the nested injection's *scope*, which
  is the context that carries the service. The offline suite hid this because its double put
  `modelDirectories` on the context it passed to `effortSliderEntry` directly; the harness now
  runs `slots.inject`'s callback and keeps what `slots.register` is given, and a new test renders
  the registered entry and asserts where it reads the directory from.

- **A session switch no longer loses the background over the conversation.** The shell renders the
  conversation's column a commit before the panel that fills it, and the pass runs on DOM
  mutations, so a pass could land in that gap: it resolved the zone to the column and painted the
  picture there, and the panel that arrived next covered it. The observer's test — "was anything I
  painted taken away?" — could not see it, because the column itself was still in the document, and
  the conversation stayed bare for the rest of the session. The observer now also repaints when the
  shell adds an element inside a zone but outside the surface that zone's picture is on, which is
  that shape exactly. Content committed inside a painted surface — a reply streaming into a painted
  conversation — is untouched by the test and stays off the repaint path; the whole-window entry is
  exempt, since its anchor is the frame every later node in the window lands in.

- **The whole-window picture disappeared.** 0.4.2 taught a zone nested inside another to skip its own
  picture layer when one was already painted behind it. The shell's frame is painted too — it is only
  skipped when the zones cover it, and the window bar they do not cover keeps it in the pass — and
  every zone is nested inside the frame, so that single frame layer took the picture off the sidebar,
  the conversation, the composer and the right bar at once. A zone now skips its own layer only when
  the picture already behind it is the very same one (same image, sizing, position, strength and
  anchoring), and the frame's layer never counts as covering: it sits behind the shell's opaque
  columns, which is the reason the whole-window entry is spread over the zones at all.

- **The composer's mask was written off.** 0.4.2 also cleared the gradient the shell keeps on the
  composer seat whenever a picture was painted. That gradient is what holds the bottom of the
  transcript back, so a reply scrolling past the input showed through it and the input read as a
  floating box. The seat's own background is left alone again: the only fade this plugin takes out of
  the way is the workspace list's, at the bottom of the sidebar.

### Notes

- **`ARCHITECTURE.md`** is the map: the two halves, the module-by-module tables, the six rules
  (one direction between the halves, no cycles, features wired only from the entry, no runtime
  dependencies, every effect owned and undone, the text is the behavior), the build, and how to add
  a feature.

- **`test/architecture.test.mjs`** holds the shape in place with seven checks: every module under
  `src/client/` is reachable from the entry, every import names something its target exports, the
  module graph has no cycle, `lib/client.js` is byte-for-byte what the sources link to, neither half
  reaches into the other's layer (a Node builtin however it is spelled), no machine path is
  hard-coded, and `package.json` ships both halves, both documents, and only entries that exist.
  Each check was mutation-tested — planting the fault it describes makes it fail.

- The rows are drawn through the shell's own machinery rather than by patching it. One Conversation
  **Definition** registered on `uiConversation.events` classifies the durable events into a Node of
  this plugin's own kind (`dct-context-injection`), and one **keyed entry** in the
  `conversation.chat.node` slot under that kind draws it. The shell's own Definition keeps its node,
  its key and its classification, so nothing that reads the shell's nodes is affected — no filter is
  overridden and no private API is touched.

- The classification is copied from the shell rather than approximated. An append-origin
  `user/message` whose source is not `user`, and a `developer/message`, are the whole of it: a human
  message, a steering message and a *waking* message (a queued message that starts a new Turn, which
  the shell draws as its own trigger row) are all left to the shell. The waking case reads the same
  `inbox-next-turn` / `inbox-next-step` states the shell reads — including its idle-steer test — and
  answers with `visibility: 'hidden'`, the very flag the shell's filter honours.

- With the switch **off**, no Definition is registered at all: the Node store, the grouping and the
  transcript are exactly what the shell builds on its own. Toggling registers or disposes it, and a
  Definition change is what makes the conversation engine rebuild every open transcript — which is
  why the restored rows appear in a session that is already open instead of only in the next one.

- The registration is nested (`inject(['slots', 'uiConversation'])`) for the reason the slider's is:
  a build that exposes no Definition registry still gets the themes, the backgrounds and the settings
  page, and loses only this switch — which says so under itself instead of doing nothing silently. A
  registry that refuses the Definition is reported once and retried on the next toggle.


- The control is registered from a nested `inject(['slots', 'modelDirectories'])` rather than the
  plugin's own list, so a shell that exposes no model directory still gets the themes, the
  backgrounds and the settings page, and loses only the slider. The control is handed that nested
  **scope** rather than the plugin's `ctx`: the scope is the only one of the two from which the
  service can be read.
- The write is optimistic, throttled to one every 120 ms with a 10s deadline: the knob lands where
  the finger left it, and a refused or unanswered write rolls back to the level really in force and
  says so under the track.
- `prefers-reduced-motion` slows every crossing by 2.6× and drops the nebula's sweep. The sweep is
  a stylesheet rule; the durations are inline, so the slowdown is applied in script.
- The rail this replaces (`dct-effort-*`, the `:has()`-driven fill and the drag that clicked the
  shell's own stops) never shipped in a release and is gone; the selectors this row uses now are
  the reference plugin's own (`ces-*`, `data-ces-part`), which keeps the two stylesheets
  comparable rule for rule.
- The notice is drawn where the level is shown rather than inside the track: it takes the value
  cell's whole box, paints no background of its own (the shell's value text is hushed, not
  rewritten, while it is up), and is `pointer-events: none` and `aria-hidden`, so it can never
  swallow a click or be read twice.
- The level patch is line-based and marked, because the file it edits is the user's document: a
  YAML round-trip would drop the comments that say why a gateway takes `off` and not `minimal`.
  Every line this plugin writes carries `# dsh-custom-theme:managed` (or `:managed-from-false`, which
  is what makes the way back restore a `false` instead of deleting the key), the first edit keeps
  `<file>.dct-backup`, and the write goes to a sibling temporary file and is moved into place, so a
  crash mid-write cannot leave a half-edited profile. Nothing else in the file is ever rewritten —
  `test/effort-levels.test.mjs` asserts that as a property, not as an example.
- `off` is written quoted (`"off": "off"`), since YAML reads a bare `off` as a boolean. Whether an
  upstream accepts `off` is the upstream's business — the DeepSeek models accept it and some
  gateways answer 400 — so the switch is the way to take the whole set back out.
- The switch's state lives in `$DSH_HOME/dsh-custom-theme.effort-levels.json` and defaults to on; the
  boot pass is idempotent, so a block removed by hand comes back, and every read the settings page
  makes is also a repair. A profile whose patch file cannot be found is reported as such and never
  guessed at, and one the host cannot write is a warning in the log rather than a failed boot.
- The profile is found through `DSH_PROFILE_DIR` first — the variable DSH exports for the profile it
  is running — and only then through this package's own location, the command line and `DSH_PROFILE`.
  The order matters because these tests are run from inside DSH, where those variables name a real
  profile: `test/host.test.mjs` now points them at a temporary home before every `apply`, so a suite
  run can no longer edit the profile of whoever ran it. (`test/effort-levels.test.mjs` never touches
  a file at all.)

- **The front page is two documents now.** `README.md` is the Chinese original and the one a
  visitor lands on; `README.en.md` is its English twin, and both ship in the tarball. Every picture
  in them was taken from a running DSH by `scripts/capture-readme-shots.mjs`, which drives a headless
  Chromium over the DevTools protocol — the same driver `test/browser/` uses — so the screenshots
  show the real app rather than a mock-up.

## [0.4.2] - 2026-10-06

The edges of the picture. A background image is no longer cut across by the shell's own rules and
fades, nor blacked out where one zone sits inside another, and the zone picker fills the row it is
given.

### Changed

- **A picture now takes the shell's chrome with it.** While a zone shows one, the rules and fades that
  would otherwise cut across it step aside: the conversation header's bottom rule, the fade the
  transcript has above the composer seat, and the workspace list's fade at the bottom of the sidebar.
  They come back when the picture does — these rules go into the same per-pass sheet as the picture, so
  there is nothing left behind to undo.
- **A zone nested inside another no longer stacks its panel fill.** The composer seat sits inside the
  conversation column, and two 91% fills composite to 99%: a near-black block over the picture, which
  is what a new session showed in the middle of the column, around the welcome block and the input
  card. The inner fill is now written for the two together to come to the opacity configured for that
  zone, and that zone no longer paints a second copy of the same picture over the first.
- **The zone picker fills the row**: six equal columns instead of tabs sized by their own text, which
  left the row short of its width.

### Fixed

- **The reasoning pass queried the whole document on every mutation.** It asked for every think block
  before it checked whether the mode needed one, so a reply that was not thinking paid a
  full-document query per chunk. The mutation records now decide first — a text change cannot start or
  settle a turn, and a removed one has nothing left to expand — so the query runs only when a turn
  actually changed. The modes themselves are unchanged.

### Notes

- The picture's opacity, blur, size and per-zone panel opacity are unchanged. What changed is what
  sits on top of the picture.
- The streaming fade and the writing ink are untouched by this release.
- The maths-rendering delay reported against 0.4.1 is still not claimed fixed: it needs a long reply
  with formulas to reproduce, and this release did not address it.

## [0.4.1] - 2026-10-06

A performance release for the two things the fade and the background were felt to cost. The streaming
fade no longer competes with the shell for the main thread, and switching conversations no longer
flashes a bare column.

### Changed

- **The streaming ink costs the main thread nothing while it ramps**: it is driven by the mutation
  records the observer already receives rather than by a query over the document for every chunk,
  the records of one frame collapse into a single pass, and that pass touches no stylesheet. The
  ramp is now one CSS animation of a registered custom property (`--dct-stream-ink`) on the element
  that owns the text node — the element the `::highlight()` rule reads its alpha from — instead of
  the previous timer that rewrote the rule about thirty times a second. A chunk costs one animation
  and one timer, however long the reply is.

### Fixed

- **The flash when switching conversations**: 0.4.0 debounced the repaint that follows the shell
  rebuilding the conversation column by 150 ms, and that delay was itself the visible flash — the
  picture went with the old column and only came back a moment later. The check the debounce existed
  to skip (one identity test per painted surface) is cheap enough to run on every mutation, and the
  repaint now happens inside the observer callback, before the browser paints the new column.
- **The stutter while a reply streams**: with the fade on, a long reply spent its frames inside the
  plugin's script and stylesheet rather than in the shell's own work, which is what made the fade
  feel heavy — and any deferred work the shell had queued for that reply, such as rendering its
  maths, had to compete with it for the main thread.

### Notes

- The fade itself is unchanged: duration 150–1500 ms and writing ink 5–100% behave as in 0.4.0, and
  the new ramp was checked in a real browser, where the highlight's resolved alpha tracked the
  animation at every point.
- The browser half still may not name `createTextNode`, `splitText`, `replaceChild`, `removeChild`,
  `insertBefore` or `innerHTML`; the 0.3.2 ban and the source assertion that holds it are untouched.
- The live suites (`test:working`, `test:browser`) need a live DSH window and a `DCT_TOKEN` and were
  not run for this release; `npm test` (86 tests) and `npm run test:effects` (6 steps) were.

## [0.4.0] - 2026-10-06

The streaming text fade is back. 0.3.2 withdrew it to stop replies disappearing, which answered the
symptom by deleting the feature; this release paints the same effect without touching the nodes
React owns, so 0.3.1's crash is gone and the fade is not.

### Added

- **Streaming text fade (流式渐显), restored**: the characters arriving from a reply settle from
  the writing ink to the text colour instead of appearing at full strength. Both controls are back
  on the Appearance page — duration (150–1500 ms, default 520) and writing ink (5–100%, default
  30%; 100% turns the fade off) — and a value stored by 0.3.0/0.3.1 is read again.
- **Painted with `CSS.highlights` instead of DOM surgery**: the ink is a `Range` over the
  characters written since the last length the plugin saw, registered as a `CSS.highlights` entry
  and painted by one `::highlight()` rule whose alpha ramps from the writing ink to the text
  colour. React can rewrite that text node's value and the ink follows it, because no node is
  created, split, moved or removed.

### Changed

- **The 0.3.2 ban stays in force**: the browser half still may not name `createTextNode`,
  `splitText`, `replaceChild`, `removeChild`, `insertBefore` or `innerHTML` at all, and
  `test/client.test.mjs` asserts it on the source. The ink is what shows the ban costs nothing.

### Fixed

- **The 0.3.1 crash, without withdrawing the feature**: the `.stream-ink` spans made React's
  commit throw `NotFoundError: Failed to execute 'removeChild' on 'Node'` out of
  `conversation.chat.node`, and the shell's slot boundary dropped the whole assistant body. The ink
  paints with `Range` objects instead, which React never sees.

### Notes

- The two live suites (`test:working`, `test:browser`) need a live DSH window and a `DCT_TOKEN`;
  they were not run for this release, so the rendered result was not re-verified inside the app.
  A headless-Chrome page was used instead to check the mechanism directly — rewriting a
  `nodeValue` the way React's commit does left every registered range intact and threw nothing.
- `::highlight()` replaces the colour of the characters it covers, so the newest characters inside
  a differently-coloured run (a link, a bold fragment) settle from the surrounding prose colour
  rather than their own.
- `npm test` is 83 tests now: four cover the ink — its offsets, its alpha, that the node it paints
  over keeps the same object and parent with no new siblings, and that it is withdrawn when the
  writing ink is 100% or the plugin is disposed.

## [0.3.2] - 2026-10-06

A fix for replies that disappeared. With 0.3.1 loaded, an assistant message could render as its
process header with nothing under it — the text was in the session all along, and the shell threw
it away while rendering.

### Fixed

- **Assistant replies rendered as an empty process header**: 0.3.1's streaming fade rewrote the
  live reply into its own `.stream-ink` spans as the text arrived. React still held the original
  text nodes, so its next commit called `removeChild` on a node that was no longer its child and
  threw `NotFoundError: Failed to execute 'removeChild' on 'Node'` out of the
  `conversation.chat.node` slot; the shell's slot boundary then dropped the whole message body,
  leaving only the header and the action bar, and the same message kept failing on every later
  render — which is why reloading never brought the text back. It showed up on long reply runs,
  where there are the most nodes to rewrite. The fade is gone, and the plugin no longer adds,
  splits, moves or removes any node inside content the shell renders.

### Changed

- **The two streaming fade controls are gone** from Appearance settings (流式渐显时长 and
  落笔墨量). A value stored by 0.3.0/0.3.1 is simply ignored.
- Reasoning auto-expand is unchanged in behaviour, with two hardenings: the synthetic click that
  opens or closes a disclosure row is deferred to a macrotask so it can never re-enter a React
  commit, and the observer behind it watches `data-state` alone again.

### Notes

- `test/client.test.mjs` now asserts the browser half never calls `createTextNode`, `splitText`,
  `replaceChild`, `removeChild`, `insertBefore`, `replaceWith`, `insertAdjacentHTML`,
  `insertAdjacentElement`, `insertAdjacentText`, `innerHTML`, `outerHTML` or `document.write`,
  so this class of breakage cannot return unnoticed.
- The node suite (81 tests) and `test:effects` (6 steps) pass. The two live suites —
  `test:working` (10 steps) and `test:browser` (39 steps) — were **not run** for this release:
  they need a token and a DSH window, and they do not drive the transcript's streamed rendering,
  which is the path this fix changes.

## [0.3.1] - 2026-10-06

Three background fixes and a port of Deeptop's reasoning auto-expand. A whole-window picture
is one image across the window again instead of one crop per zone, switching conversations no
longer leaves the conversation half bare, a picture picked from the file dialog can no longer be
overtaken by its own upload, and the live reasoning block can unfold itself while the model
thinks and fold away again when it stops.

### Added

- **Auto-expand reasoning content (ported from Deeptop)**: Automatically unfolds the live
  reasoning row (`[data-variant="think"]`) while thinking deltas are streaming, and folds it back
  into a single-line summary chip once finished.
- **Configurable reasoning expand modes** (`reasoningExpand` in Appearance settings):
  - **仅思考中展开（结束后折叠）** (`streaming`, default): Deeptop's default behavior.
  - **思考中展开并保持（结束后不折叠）** (`keep`): Unfolds during thinking and remains expanded after finish.
  - **始终展开（含历史消息）** (`always`): Automatically expands all reasoning blocks.
  - **跟随官方（默认折叠）** (`off`): Standard DSH behavior with no automatic toggling.
  - Respects user manual interaction: clicking the reasoning header prevents subsequent automatic toggling.

### Fixed

- **A whole-window picture was cropped once per zone**: The frame cannot be painted behind
  the shell's opaque columns, so a spread picture goes on every zone — and measured against
  each zone it was cropped once per zone: a band per column and per bar, each showing its own
  slice, with the seams between them reading as a stack of pieces rather than a background.
  A spread picture is now anchored to the viewport (`background-attachment: fixed`), so every
  zone shows its own window onto the same picture and the seams disappear. A zone with a
  picture of its own still covers that zone, which is what picking one for that zone means.
- **The conversation half went bare after switching conversations**: Opening a conversation
  makes the shell throw the column, its header and the composer seat away and build new ones,
  and the markers and inline declarations the plugin had written went with the old elements.
  Only the sidebar, which is not rebuilt, kept its picture. The plugin now notices that a
  surface it painted has left the document and paints the zones again, from the saved
  settings.
- **A picture could be overtaken by the upload that stored it**: Picking a file is a round
  trip, and the picture was selected whenever that trip finished — so a choice made while it
  was in flight, from the list or from a second upload, was silently replaced by the one that
  happened to land last, leaving the picker showing one picture and the window another. The
  upload now only selects its picture while the zone still holds what it held when the file
  was picked; the file is stored either way.
- Zone settings are persisted and painted from the committed state rather than from inside a
  `setState` updater. React may run an updater more than once — against bases of different
  ages, and for renders it then discards — so a store write and a repaint living there could
  put back a value the user had already moved past.

### Notes

- The browser suites pass again. Six assertions had been left measuring things the 0.3.0 theme
  work changed, and none of them was reachable by any plugin behaviour: a theme's palette is
  routed through the runtime, so its stylesheet holds only that theme's non-token rules — gov
  one `font-family` rule, monokai-pro and one-dark none at all — and the checks that counted
  those bytes as proof a theme had loaded could no longer pass, nor could the colour fields
  that were driven by their wrapper `<label>` instead of the input inside it. They now read
  the theme's own base colour out of the cascade, which is stronger than counting bytes, and
  address the input. No plugin behaviour was changed for this.

## [0.3.0] - 2026-10-05

Two Deeptop ports and one theme fix. Streaming text fades in as it is written, the running
indicator can be dressed with Deeptop's text effects — with 流光 rebuilt on the mechanic the
shell's own shimmer uses, so it stays matte — and custom themes stop inverting the colours of
code blocks.

### Added

- **Text streaming progressive fade-in (ported from Deeptop)**: Incoming text during
  streaming is dynamically segmented into subtle staggered `.stream-ink` spans using a
  non-invasive DOM observer, creating a soft typewriter fade-in effect. Once streaming completes
  or settles, all temporary `.stream-ink` spans are automatically merged back into clean text
  nodes.
- Configurable **流式渐显时长** (`streamingFadeDuration`, 150–1500 ms, default 520 ms) and
  **落笔墨量** (`streamingFadeInk`, 5%–100%, default 30%, 100% disables fade) in Appearance settings.
- Respects `prefers-reduced-motion: reduce` by bypassing animations and rendering text solid immediately.
- **Text effects, ported from Deeptop's running indicator** under its names: 静态
  (`none`), 流光 (`shimmer`, in 哑光 `matte` and 七彩光 `rainbow`) and 隐藏 (`hidden`),
  with its two colours — text `#4176e6`, sweep `#5ee0ff` — and its rotation range, 1.2–10 s,
  which is the interval the phrases cycle on. **跟随官方** (`official`) is this plugin's own
  addition and the default: nothing is injected, so the shell keeps drawing and animating its
  label until an effect is chosen.
- 流光 uses the official mechanic rather than Deeptop's gloss. The label keeps one solid
  colour and only the band the shell sweeps across it takes a tint, through the very token
  the shell paints that band with (`--dsw-alias-label-shimmer`); the shell's mask, its two
  animations and its reduced-motion handling are left whole, so nothing here re-times or
  re-shapes the sweep — which is what makes the finish matte. 七彩光 is the one thing a
  single colour token cannot express, so there the band's own copy of the text is filled with
  the spectrum, still clipped to the glyphs and still only visible through the band's mask
  while the label underneath stays solid.
- The effect is written as a stylesheet of its own —
  `style[data-plugin="dsh-custom-theme"][data-role="working"]`, removed with the plugin —
  addressing the marks the shell puts on that row rather than its hashed class names:
  `[data-chat-running]` for the bar and its colour, `[data-shimmer]` /
  `[data-text-shimmer]` for the label, and the decorative `aria-hidden` band with the
  `[data-shimmer-text]` copy a spectrum is clipped to. Every rule is `!important`, because
  the shell's own label rules are already in the document and this sheet is injected beside
  them rather than instead of them.
- 隐藏 collapses everything in the bar except the `role="status"` span, so the indicator
  leaves the screen and the announcement stays; 静态 keeps the label's colour and switches
  the band off.
- The settings page samples the label under the controls, wearing the same rules and
  carrying its own band built the same way, rotating on the configured interval, so an
  effect can be judged without a live turn.

### Fixed

- **Text color inversion under custom themes**: Custom theme stylesheets now strip `--*` custom properties from injected stylesheets, preventing `:root` pollution where light-mode values shadowed dark-mode tokens. Synthesized `--shiki-foreground` and `--shiki-background` overrides into the active theme runtime so code blocks, diff views (`FileDiff`), and untokenized runs invert properly according to the active theme palette. Adapted `:root[data-theme="dark"]` selectors to DSH's `body[data-ds-dark-theme]` attribute for non-token rules.

### Notes

- 呼吸 (`pulse`) and 发光 (`glow`) are not ported: neither could be given without filling
  the glyphs, which is the look this release moved away from.
- Nothing fills the glyphs any more, so the failure a text-clipped gradient invites — an
  untiled or pinned one leaving glyphs with no fill and nothing behind them — cannot happen,
  and the shimmer needs no `prefers-reduced-motion` rule of this plugin's own.
- The effects are scoped to the running indicator and to that sample: a chosen colour
  never reaches a transcript row.
- Failures stay quiet: a shell that renames those keys or those marks stops being
  reworded or dressed and keeps its own label, which is what `official` does by choice.
- `test/client.test.mjs` grows fifteen cases over this release — seven over the stylesheet
  each effect choice writes, and four each for the streaming fade's sheet (its defaults, its
  clamp, its fallback and its removal) and for the theme fix (that each bundled theme's
  `--*` declarations are stripped from what is injected, that the shiki foreground and
  background are synthesised for its palette, that explicit ones survive, and that dark
  non-token rules move onto `body[data-ds-dark-theme]`) — and
  `test/browser/working-row.mjs` grows the steps that drive the controls and read the
  sample's computed style back, ten steps in all.
- `test/browser/working-effects.mjs` is new, and is the only suite that needs neither DSH
  nor a live turn: it stands the shell's running row and the page's own sample up as
  fixtures — the markup transcribed from the installed build, the stylesheets from the
  plugin itself — injects the rules each choice generates, and counts the pixels that
  change. That is what made the mechanic checkable rather than merely plausible: the band
  tints the end it has arrived at and leaves the end it has not reached untouched, and the
  label with the band away is pixel-for-pixel what it is with the band switched off
  entirely. `npm run test:effects` runs it, and it is the suite that writes the
  `shot-work-*.png` captures; `npm run test:working` is the one that drives the real page.

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

[0.3.1]: https://github.com/Sparrived/dsh-custom-theme/releases/tag/v0.3.1
[0.3.0]: https://github.com/Sparrived/dsh-custom-theme/releases/tag/v0.3.0
[0.2.1]: https://github.com/Sparrived/dsh-custom-theme/releases/tag/v0.2.1
[0.2.0]: https://github.com/Sparrived/dsh-custom-theme/releases/tag/v0.2.0
[0.1.2]: https://github.com/Sparrived/dsh-custom-theme/releases/tag/v0.1.2
[0.1.1]: https://github.com/Sparrived/dsh-custom-theme/releases/tag/v0.1.1
[0.1.0]: https://github.com/Sparrived/dsh-custom-theme/releases/tag/v0.1.0
