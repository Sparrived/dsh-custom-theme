/**
 * What a dense streaming reply costs the frame clock, per plugin feature.
 *
 * `lib/client.js` carries two features that look expensive while a reply streams:
 * the streaming ink, which registers one `CSS.highlights` entry and starts one CSS
 * animation of a registered custom property for every text node that just grew, and
 * the whole-window background picture, which is painted as a `::before` layer on
 * every zone surface it is spread over — up to five full-viewport layers, each with
 * `background-attachment: fixed` and (at the shipped maximum) `filter: blur(16px)`.
 *
 * Neither cost can be seen from the Node suite: the ink needs a real `Highlight`
 * registry and a real animation timeline, and the picture needs a real compositor.
 * So this harness stands both up in a real headless browser, on a synthetic page
 * that shims only the module-loader surface `test/harness.mjs` already fakes for
 * Node, and measures the frame clock while a markdown-dense reply streams into a
 * shell-shaped DOM.
 *
 * It is a measurement, not a gate: it prints a table and exits non-zero only when a
 * configuration throws, when the page reports an exception, or when a sanity check
 * proves the fixture stopped exercising the feature it claims to (a broken harness
 * must not produce numbers that look like a result).
 *
 * The third family of rows answers a different question: whether a container the stream
 * rebuilds wholesale per chunk — the shape `CodeBlock`'s `dangerouslySetInnerHTML` arm has,
 * where every text node inside the container is cast into the page again — is what drives
 * the ink into its costly regime. Those rows stream 1, 2 and 4 such containers at once, each
 * with a matched no-plugin row, because a re-render that is expensive on its own must not be
 * reported as the ink's cost.
 *
 * Usage:
 *   node test/browser/frame-cost.mjs
 *
 * Environment:
 *   DCT_FRAME_CDP_PORT   DevTools port for the throwaway browser (default 9411).
 *   DCT_FRAME_STREAM_MS  Length of each measured stream, ms (default 4000).
 */

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

import { attach, launch } from './driver.mjs'

/** The browser half, served to the page as the shell's module system would. */
const CLIENT_URL = new URL('../../lib/client.js', import.meta.url)

/** DevTools port; off the suites' own 9400 so a running smoke test is not disturbed. */
const CDP_PORT = Number(process.env.DCT_FRAME_CDP_PORT ?? 9411)

/** How long each configuration streams while frames are recorded. */
const STREAM_MS = Number(process.env.DCT_FRAME_STREAM_MS ?? 4000)

/** How long the stream runs before recording starts, so the first numbers are steady. */
const WARMUP_MS = 700

/** Text nodes written into per stream tick, and ticks between committed blocks. */
const STREAM_SHAPE = { nodes: 3, blockEvery: 6 }

/**
 * Lines one wholesale-rewritten container is rebuilt from.
 *
 * The cap is a fence's visible window: the container stops growing past this many lines, so
 * the per-chunk rebuild stays a constant size and the 1/2/4-container comparison measures the
 * number of rewritten containers rather than the length of the reply. `cap: 0` lifts it, which
 * is the literal "the whole accumulated fence is re-set on every chunk" reading.
 */
const REWRITE_LINE_CAP = 12

/**
 * The fan-out sweep.
 *
 * The ink can only have as many animations live at once as there are distinct text
 * nodes written into during one fade duration, so the interesting question is not
 * "is the ink expensive" but "how many concurrently-written nodes does it take to
 * become expensive". Each step runs the same stream with and without the plugin, so
 * the difference is the ink and nothing else.
 */
const SWEEP = [6, 12, 24]

/**
 * The configurations printed in the main table.
 *
 * `plugin: false` is the floor: no observer, no stylesheet, no layer — the stream
 * alone. `a2` separates the plugin's own always-on work (the mutation observer, the
 * reasoning pass, the appearance sheet) from the two suspects.
 */
const CONFIGS = [
  { key: 'a', label: 'no plugin (baseline)', plugin: false, ink: false, blur: null },
  { key: 'a2', label: 'plugin, ink off, no picture', plugin: true, ink: false, blur: null },
  { key: 'b', label: 'plugin, ink on, no picture', plugin: true, ink: true, blur: null },
  { key: 'c', label: 'plugin, ink off, picture blur(16px)', plugin: true, ink: false, blur: 16 },
  { key: 'c2', label: 'plugin, ink off, picture blur(0)', plugin: true, ink: false, blur: 0 },
  { key: 'd', label: 'plugin, ink on, picture blur(16px)', plugin: true, ink: true, blur: 16 },
]

/**
 * The exposure probe.
 *
 * A React renderer commits a new markdown block by inserting the element that already
 * carries its text nodes, while the text node of the block it is still writing into is
 * updated in place. `streamInkTargets` only looks at added nodes of type 3, so the two
 * arrive differently at the ink. This runs the same dense stream with no live tail at
 * all — every new text node comes in inside its element — and asks what the ink does
 * with it. `enforceInk` is off because this row is the question, not the answer.
 */
const EXPOSURE = [
  { key: 'x', label: 'plugin, ink on, committed blocks only', plugin: true, ink: true, blur: null, enforceInk: false },
  { key: 'x0', label: 'no plugin, committed blocks only', plugin: false, ink: false, blur: null, enforceInk: false },
]

/** One sweep step: the same stream, with and without the ink, at a given fan-out. */
function sweepConfigs(nodes) {
  return [
    { key: `n${nodes}`, label: `no plugin, ${nodes} nodes/tick`, plugin: false, ink: false, blur: null },
    { key: `n${nodes}i`, label: `ink on, ${nodes} nodes/tick`, plugin: true, ink: true, blur: null },
  ]
}

/**
 * The wholesale-rewrite probe.
 *
 * Four shapes of "the container is rebuilt from scratch on every chunk", because what the
 * observer sees differs between them and that is the whole question:
 *
 * - `fence` re-sets the inner HTML of a `<pre class="shiki"><code>` tree, which is what
 *   `CodeBlock`'s shiki arm does (`dangerouslySetInnerHTML`, `CodeBlock.tsx:184`). Every token
 *   span is recreated per chunk, but the replaced HTML arrives as *elements*, and the ink only
 *   ingests text nodes a mutation record names (`streamInkTargets`, `lib/client.js`), while the
 *   separator newlines that are named sit inside `pre`/`code`, which `STREAM_INK_SKIP_SELECTOR`
 *   excludes. `enforceInk` is off on this row because "no ink registered" is the prediction,
 *   not a broken fixture.
 * - `prose` re-sets the inner HTML of a plain container of inline spans: the same wholesale
 *   replacement without the `pre`/`code` skip, so it separates "the observer cannot see inside
 *   an innerHTML rewrite" from "the ink refuses code".
 * - `texts` replaces the container's children with freshly created text nodes, which is the
 *   only shape whose text nodes a mutation record names directly. It is the adversarial upper
 *   bound — every text node in the container is new on every chunk and the ink sees all of
 *   them — and its `enforceInk` stays on so a dead row fails loudly. Its sweep is capped at two
 *   lines so one, two and four containers land in the same per-chunk node band the fan-out
 *   sweep above explored; {@link REWRITE_DEEP} takes the same arm to a fence's full depth.
 * - `cells` is the same new-text-node-per-chunk load, but every node is swapped into a stable
 *   element of its own instead of every node piling onto one parent. The ink starts its ramp on
 *   the node's parent element, so the `texts` arm animates 14 to 84 properties on a single
 *   element; this arm keeps the node count and spreads the ramps the way a real block of prose
 *   would, which is what makes the `texts` numbers attributable to the ink rather than to one
 *   element carrying an implausible number of animations.
 *
 * @param mode - `fence`, `prose`, `texts` or `cells`.
 * @param prefix - Key prefix for the rows.
 * @param what - Short noun phrase naming the shape in the label.
 * @param enforceInk - Whether a row with the ink on must have started a ramp.
 * @param cap - Lines of rebuilt content; see {@link REWRITE_LINE_CAP}.
 * @returns The `1`, `2` and `4` container rows plus one ink-off control at 4.
 */
function rewriteConfigs(mode, prefix, what, enforceInk, cap) {
  const rows = []
  for (const containers of [1, 2, 4]) {
    rows.push({
      key: `${prefix}${containers}`, label: `no plugin, ${containers} ${what}`,
      plugin: false, ink: false, blur: null, mode, containers, cap,
    })
    rows.push({
      key: `${prefix}${containers}i`, label: `ink on, ${containers} ${what}`,
      plugin: true, ink: true, blur: null, mode, containers, cap, enforceInk,
    })
  }
  rows.push({
    key: `${prefix}4n`, label: `plugin ink off, 4 ${what}`,
    plugin: true, ink: false, blur: null, mode, containers: 4, cap,
  })
  return rows
}

/**
 * The same wholesale text replacement at a fence's real depth.
 *
 * The `texts` sweep above rebuilds a two-line container, which puts the new-text-node count per
 * chunk in the same band as the existing `n6`/`n12`/`n24` sweep. These two rows rebuild a
 * twelve-line fence's worth of token text instead — the dense-reply case — with its matched
 * no-plugin row, so the ink's cost and the DOM churn's cost can still be told apart.
 */
const REWRITE_DEEP = [
  { key: 't4b', label: 'no plugin, 4 text rewrites, 12-line cap', plugin: false, ink: false, blur: null, mode: 'texts', containers: 4, cap: REWRITE_LINE_CAP },
  { key: 't4bi', label: 'ink on, 4 text rewrites, 12-line cap', plugin: true, ink: true, blur: null, mode: 'texts', containers: 4, cap: REWRITE_LINE_CAP, enforceInk: true },
]

/**
 * The `cells` arm at the same depth, mirroring {@link REWRITE_DEEP}: if the pile-up on one
 * parent element is what the `texts` rows are really measuring, these two rows stay cheap.
 */
const REWRITE_CELLS_DEEP = [
  { key: 'k4b', label: 'no plugin, 4 per-cell rewrites, 12-line', plugin: false, ink: false, blur: null, mode: 'cells', containers: 4, cap: REWRITE_LINE_CAP },
  { key: 'k4bi', label: 'ink on, 4 per-cell rewrites, 12-line', plugin: true, ink: true, blur: null, mode: 'cells', containers: 4, cap: REWRITE_LINE_CAP, enforceInk: true },
]

/**
 * The literal reading of the suspicion: the whole accumulated fence is re-set on every chunk,
 * so the rebuild grows with the reply instead of staying at the length of a visible window.
 */
const REWRITE_GROW = [
  { key: 'f4g', label: 'no plugin, 4 unbounded fence rewrites', plugin: false, ink: false, blur: null, mode: 'fence', containers: 4, cap: 0 },
  { key: 'f4gi', label: 'ink on, 4 unbounded fence rewrites', plugin: true, ink: true, blur: null, mode: 'fence', containers: 4, cap: 0, enforceInk: false },
]

/*
 * The page.
 *
 * It is served over http on a loopback ephemeral port rather than loaded as a
 * `data:` URL, because the plugin builds its picture URL relative to the page
 * (`/dsh-custom-theme/background/<name>`), and a non-hierarchical document URL
 * cannot resolve that. The local server also lets the page boot itself from the
 * query string, so every configuration is a real navigation and therefore a clean
 * start: fresh document, fresh stylesheets, fresh animation timeline.
 *
 * The page script is written without template literals or backslashes so it can be
 * embedded here without escaping rules getting in the way.
 */
const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>dsh-custom-theme frame cost</title>
<style>
  html, body { margin: 0; height: 100%; }
  body { font: 14px/1.55 "Segoe UI", system-ui, sans-serif; color: #e6e6e6; background: #141419; overflow: hidden; }
  /* The shell's own shape: a frame holding a header and three columns, each column
     painted by a covering opaque component root, which is the element the plugin's
     surface search is written to find. */
  .Shell_frame { display: flex; flex-direction: column; height: 100vh; background: #1b1b21; }
  .Bar_header { flex: 0 0 40px; display: flex; align-items: center; gap: 10px; padding: 0 14px; background: #1b1b21; border-bottom: 0.5px solid #303038; }
  .Shell_body { flex: 1 1 auto; display: flex; min-height: 0; }
  .Shell_sidebarCol { flex: 0 0 232px; min-height: 0; background: #17171d; border-right: 0.5px solid #2a2a32; }
  .Shell_sidebarSurface { height: 100%; padding: 10px; background: #17171d; overflow: hidden; }
  .Shell_centerCol { flex: 1 1 auto; display: flex; flex-direction: column; min-width: 0; min-height: 0; background: #101014; }
  .Shell_centerSurface { flex: 1 1 auto; display: flex; flex-direction: column; min-height: 0; background: #101014; }
  .Shell_centerHeader { flex: 0 0 36px; display: flex; align-items: center; padding: 0 14px; background: #101014; border-bottom: 0.5px solid #26262e; }
  .Shell_titleRow { font-size: 13px; color: #b9b9c4; }
  .scroller { flex: 1 1 auto; min-height: 0; padding: 14px 18px 24px; overflow: hidden; }
  .turn { max-width: 760px; }
  .turn h3 { margin: 14px 0 6px; font-size: 15px; }
  .turn p { margin: 6px 0; }
  .turn li { margin: 3px 0 3px 20px; }
  .turn code { padding: 1px 4px; font-family: Consolas, monospace; font-size: 12.5px; background: #1e1e26; border-radius: 4px; }
  .turn pre { margin: 8px 0; padding: 10px; background: #16161c; border-radius: 6px; overflow: hidden; }
  .turn table { border-collapse: collapse; margin: 8px 0; }
  .turn td { padding: 3px 10px; border: 1px solid #2a2a32; }
  .turn blockquote { margin: 8px 0; padding-left: 10px; border-left: 2px solid #3a3a44; color: #b9b9c4; }
  .livep { margin: 4px 0; }
  /* The wholesale-rewrite containers: a fence-shaped block, and bare prose whose lines are
     block spans so the rebuilt content lays out like the prose it models. */
  .md-rewrite { margin: 8px 0; }
  .md-rewrite .line { display: block; }
  .md-rewrite .tok { font-family: Consolas, monospace; font-size: 12.5px; }
  [data-composer-seat] { flex: 0 0 auto; padding: 8px 14px 14px; background: #15151b; }
  .Composer_surface { height: 74px; background: #15151b; border: 1px solid #2e2e38; border-radius: 10px; }
  [data-rightbar-col] { flex: 0 0 216px; background: #17171d; border-left: 0.5px solid #2a2a32; }
  .Shell_dockSurface { height: 100%; background: #17171d; }
</style>
</head>
<body>
<div class="Shell_frame">
  <header class="Bar_header"><span class="Shell_titleRow">DeepSeek Harness</span></header>
  <div class="Shell_body">
    <div class="Shell_sidebarCol"><div class="Shell_sidebarSurface"></div></div>
    <div class="Shell_centerCol">
      <div class="Shell_centerSurface">
        <div class="Shell_centerHeader"><span class="Shell_titleRow">Conversation</span></div>
        <div class="scroller" id="scroller"><div class="turn" data-streaming="true" id="turn"><div class="live" id="live"></div></div></div>
        <div data-composer-seat><div class="Composer_surface"></div></div>
      </div>
    </div>
    <div data-rightbar-col><div class="Shell_dockSurface"></div></div>
  </div>
</div>
<script>window.__dctHarness = { ready: false, bootError: null, applied: false, controls: null, warnings: [], measure: null };</script>
<script>window.__ModuleLoader__ = { load: function (definition) { window.__dctDefinition = definition } };</script>
<script src="/lib/client.js"></script>
<script>
(function () {
  'use strict';

  var harness = window.__dctHarness;
  var APPEARANCE_KEY = 'dsh-custom-theme.appearance';
  var BACKGROUNDS_KEY = 'dsh-custom-theme.backgrounds';
  var PICTURE = 'gradient.png';
  var ZONES = ['global', 'windowbar', 'sidebar', 'conversation', 'composer', 'dock'];
  /* The shell's own per-zone fill opacities, as defaultZoneConfig carries them. */
  var PANEL_OPACITY = { global: 100, windowbar: 94, sidebar: 92, conversation: 91, composer: 91, dock: 92 };

  function params() { return new URLSearchParams(window.location.search) }

  /* The configuration this navigation stands for, read off its own query string. */
  function readConfig() {
    var query = params();
    return {
      plugin: query.get('plugin') !== '0',
      ink: query.get('ink') === '1',
      picture: query.get('picture') === 'on',
      blur: Number(query.get('blur') || 16),
      nodes: Number(query.get('nodes') || 3),
      blockEvery: Number(query.get('blockEvery') || 6),
      /* The wholesale-rewrite family: how many containers are rebuilt per tick, in which of
         the three shapes, and how many lines the rebuilt content is capped at (0 = uncapped,
         so the rebuilt content grows with the stream). */
      mode: query.get('mode') || 'texts',
      containers: Number(query.get('containers') || 0),
      cap: query.get('cap') === null ? 12 : Number(query.get('cap')),
    };
  }

  /* The payloads the shell would have left in the store: the appearance entry, and
     for the whole-window picture the global entry the plugin spreads over every zone. */
  function seedStorage(config) {
    var backgrounds = {};
    for (var i = 0; i < ZONES.length; i++) {
      backgrounds[ZONES[i]] = { name: '', opacity: 0.18, panelOpacity: PANEL_OPACITY[ZONES[i]], blur: 0, size: 'cover', position: 'center' };
    }
    if (config.picture) {
      backgrounds.global = { name: PICTURE, opacity: 0.25, panelOpacity: 92, blur: config.blur, size: 'cover', position: 'center' };
    }
    var appearance = {
      lineGap: 0,
      fontFamily: '',
      codeFontFamily: '',
      /* 1 is the plugin's own off switch: a writing ink at the maximum clears everything. */
      streamingFadeInk: config.ink ? 0.3 : 1,
      streamingFadeDuration: 520,
      reasoningExpand: 'streaming',
    };
    try { window.localStorage.clear() } catch (error) {}
    window.localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance));
    if (config.picture) window.localStorage.setItem(BACKGROUNDS_KEY, JSON.stringify(backgrounds));
    return { appearance: appearance, backgrounds: backgrounds };
  }

  var REACT = {
    createElement: function (type, props) {
      var children = Array.prototype.slice.call(arguments, 2);
      return { type: type, props: props, children: children };
    },
    Fragment: 'Fragment',
    memo: function (component) { return component },
    useState: function (initial) { return [typeof initial === 'function' ? initial() : initial, function () {}] },
    useEffect: function () {},
    useMemo: function (factory) { return factory() },
    useCallback: function (callback) { return callback },
    useRef: function (initial) { return { current: initial === undefined ? null : initial } },
  };

  function fakeRequire(id) {
    if (id === 'react') return REACT;
    if (id === '@deepseek-ai/dsh-ui-primitives' || id === '@deepseek-ai/dsh-client-ui-primitives') return {};
    throw new Error('unexpected require: ' + id);
  }

  /* A locale service with the three methods the plugin touches: the per-namespace
     binding, the registration, and the lookup the running-label patch replaces. */
  function createLocale() {
    var dictionaries = {};
    var bound = {};
    var service = {
      bind: function (ns) {
        if (!bound[ns]) bound[ns] = function (key) { return key };
        return bound[ns];
      },
      register: function (ns, locales) { dictionaries[ns] = locales; return function () {} },
      translate: function (ns, key) { return dictionaries[ns] && dictionaries[ns].zh && dictionaries[ns].zh[key] ? dictionaries[ns].zh[key] : key },
    };
    return service;
  }

  /* The plugin context, as much of the shell's as apply reaches for. */
  function createContext() {
    var scheme = 'dark';
    return {
      logger: { warn: function () { harness.warnings.push(Array.prototype.join.call(arguments, ' ')) } },
      effect: function (factory) { factory() },
      on: function () { return function () {} },
      theme: {
        getTheme: function () { return { preference: 'system', fontSize: 14, active: { colorScheme: scheme } } },
        setTheme: function (next) { scheme = next },
        setFontSize: function () {},
        overrideTokens: function () { return function () {} },
      },
      slots: { inject: function () { return function () {} }, register: function () { return function () {} } },
      locale: createLocale(),
    };
  }

  /* ---- the stream ---------------------------------------------------------- */

  /* Prose the pooled nodes grow into. Never rewritten shorter: the ink's baseline is
     the length a node has been seen at, so a node that shrinks would silently stop
     being inked until it grew past its high-water mark again. */
  var FILLER = 'A streaming reply commits one paragraph at a time, and every commit is a style recalculation plus a layout pass over the transcript. '
    + '中英混排的正文会让每次布局重新塑形字形，行盒的高度因此不再是一个常数。 '
    + 'The ink is the only thing on this path that starts an animation, one per text node that grew during the frame. '
    + 'A highlight range is not a node, so React never sees it and never tries to detach it. ';

  /* One committed block of the reply, in the shapes a dense markdown answer uses:
     headings, prose, inline code, list items, table rows, a formula and a fence. */
  var CORPUS = [
    { tag: 'h3', text: 'Streaming paint budget' },
    { tag: 'p', text: 'Each chunk costs one style recalculation and one layout pass; the ink adds an animation per text node.' },
    { tag: 'li', text: 'A highlight rule of its own, claimed once per live ink' },
    { tag: 'p', text: 'Inline \`CSS.highlights\` keeps the node tree untouched', code: true },
    { tag: 'td', text: 'p95 frame delta', table: true },
    { tag: 'p', text: '∫₀¹ x² dx = 1/3 and E = ½mv² are typeset from the same text node', math: true },
    { tag: 'pre', text: 'const frames = new Set(); // a fence is never inked' },
    { tag: 'blockquote', text: 'The blurred layer is re-rastered whenever the transcript repaints.' },
    { tag: 'li', text: '中英混排的列表项同样会触发字形塑形' },
    { tag: 'p', text: 'A heading, a list item, a table row and inline code arriving in one dense reply.' },
  ];

  var POOL_CAP = 240;
  var offset = 0;

  function nextSlice(length) {
    if (offset + length > FILLER.length) offset = 0;
    var slice = FILLER.slice(offset, offset + length);
    offset += length;
    return slice;
  }

  function buildChurn(spec, index) {
    var text = spec.text + ' [' + index + ']';
    if (spec.tag === 'pre') {
      var pre = document.createElement('pre');
      var preCode = document.createElement('code');
      preCode.appendChild(document.createTextNode(text));
      pre.appendChild(preCode);
      return pre;
    }
    var host = document.createElement(spec.tag === 'li' ? 'li' : spec.tag);
    if (spec.math) host.className = 'math-inline';
    var pieces = text.split('\`');
    for (var i = 0; i < pieces.length; i++) {
      if (pieces[i] === '') continue;
      if (i % 2 === 1) {
        var inline = document.createElement('code');
        inline.appendChild(document.createTextNode(pieces[i]));
        host.appendChild(inline);
      } else {
        host.appendChild(document.createTextNode(pieces[i]));
      }
    }
    if (spec.table) {
      var row = document.createElement('tr');
      row.appendChild(host);
      var body = document.createElement('tbody');
      body.appendChild(row);
      var table = document.createElement('table');
      table.appendChild(body);
      return table;
    }
    if (spec.tag === 'li') {
      var list = document.createElement('ul');
      list.appendChild(host);
      return list;
    }
    return host;
  }

  var stream = {
    turn: null,
    scroller: null,
    live: null,
    pool: [],
    corpus: 0,
    ticks: 0,
    blocks: 0,
    writes: 0,
    /* Counted so the peak ink count can be explained rather than assumed: every write
       explains one live ink, and every commitment whose node is no longer in the
       document explains a second one that is registered but paints nothing. */
    recycles: 0,
    recycledDetached: 0,
  };

  function refs() {
    if (stream.turn === null) {
      stream.turn = document.getElementById('turn');
      stream.scroller = document.getElementById('scroller');
      stream.live = document.getElementById('live');
    }
  }

  /* One pooled text node: the element goes in first and the text node second, which is
     how a commit that appends an empty block and then fills it arrives as mutations
     (one childList record naming an element — which the ink ignores — and one naming a
     text node, which it inks). */
  function newSlot(index) {
    var paragraph = document.createElement('p');
    paragraph.className = 'livep';
    stream.live.appendChild(paragraph);
    var node = document.createTextNode(nextSlice(8 + (index % 5)));
    paragraph.appendChild(node);
    return { el: paragraph, node: node };
  }

  function recycleSlot(index) {
    var old = stream.pool[index];
    var fresh = newSlot(index);
    stream.live.replaceChild(fresh.el, old.el);
    stream.pool[index] = fresh;
    stream.recycles += 1;
    if (!old.el.isConnected) stream.recycledDetached += 1;
  }

  function ensurePool(size) {
    refs();
    while (stream.pool.length < size) stream.pool.push(newSlot(stream.pool.length));
    while (stream.pool.length > size) stream.live.removeChild(stream.pool.pop().el);
  }

  function churnBlock() {
    var spec = CORPUS[stream.corpus % CORPUS.length];
    stream.corpus += 1;
    stream.blocks += 1;
    stream.turn.insertBefore(buildChurn(spec, stream.corpus), stream.live);
  }

  /* ---- the wholesale-rewrite stream ----------------------------------------- */

  /* Tokens a rebuilt container is composed from, one appended per tick. The three modes
     below share this model and differ only in how the accumulated text reaches the DOM. */
  var REWRITE_WORDS = [
    'const', 'frames', '=', 'new', 'Set', 'stream', 'chunk', 'layout', 'ink', 'repaint',
    '中英', '混排', 'span', 'node', 'text', 'fade',
  ];
  var REWRITE_TOKENS_PER_LINE = 6;
  /* Written without a backslash, because this page script is embedded in a template literal. */
  var REWRITE_NEWLINE = String.fromCharCode(10);

  var rewrite = {
    host: null,
    containers: [],
    tokens: 0,
    chunks: 0,
    writes: 0,
    textNodes: 0,
  };

  function rewriteHost() {
    if (rewrite.host === null) {
      refs();
      rewrite.host = document.createElement('div');
      rewrite.host.className = 'rewrite-host';
      stream.turn.insertBefore(rewrite.host, stream.live);
    }
    return rewrite.host;
  }

  /* One container, in the shape its mode rebuilds. The target is the element whose content is
     replaced each chunk: the code element of a fence, or the container itself for bare prose and
     for the text-node arm. */
  function newRewriteContainer(mode, cellCount) {
    var host = rewriteHost();
    var outer = document.createElement('div');
    outer.className = 'md-rewrite md-rewrite-' + mode;
    host.appendChild(outer);
    if (mode === 'cells') {
      /* The parents are built once and never replaced; only the text node inside each one is
         new on every chunk. */
      var cells = [];
      for (var index = 0; index < cellCount; index++) {
        var cell = document.createElement('span');
        cell.className = 'cell';
        outer.appendChild(cell);
        cells.push(cell);
      }
      return { outer: outer, target: outer, cells: cells };
    }
    if (mode !== 'fence') return { outer: outer, target: outer };
    var pre = document.createElement('pre');
    pre.className = 'shiki';
    var code = document.createElement('code');
    pre.appendChild(code);
    outer.appendChild(pre);
    return { outer: outer, target: code };
  }

  function ensureRewrite(config) {
    if (config.containers <= 0) return;
    /* One text node per token plus one per line, the content the texts arm writes too. */
    var cellCount = 7 * (config.cap > 0 ? config.cap : 12);
    while (rewrite.containers.length < config.containers) {
      rewrite.containers.push(newRewriteContainer(config.mode, cellCount));
    }
    while (rewrite.containers.length > config.containers) {
      rewrite.host.removeChild(rewrite.containers.pop().outer);
    }
  }

  /* The token grid the container is rebuilt from right now: the most recent tokens, laid out
     REWRITE_TOKENS_PER_LINE to a line. A cap of 0 grows without bound, which is the literal
     "the whole accumulated fence is re-set per chunk" reading and turns the rebuild quadratic
     over the stream. */
  function rewriteRows(cap) {
    var live = cap > 0 ? Math.min(rewrite.tokens, cap * REWRITE_TOKENS_PER_LINE) : rewrite.tokens;
    var first = rewrite.tokens - live;
    var rows = [];
    for (var index = 0; index < live; index += REWRITE_TOKENS_PER_LINE) {
      var row = [];
      for (var step = 0; step < REWRITE_TOKENS_PER_LINE && index + step < live; step++) {
        row.push(REWRITE_WORDS[(first + index + step) % REWRITE_WORDS.length]);
      }
      rows.push(row);
    }
    if (rows.length === 0) rows.push([]);
    return rows;
  }

  /* The rebuilt markup. The fence separates its lines with the same newline text node
     CodeBlock.renderLine emits, because that node is the one a mutation record names and it
     is exactly the node the pre/code arm of STREAM_INK_SKIP_SELECTOR covers. The prose arm emits no
     such separator: a bare text node at the top level of the replaced markup would be named by
     a record, and this arm exists to show the wholesale replacement *without* that accident. */
  function rewriteHtml(rows, mode) {
    var out = '';
    for (var index = 0; index < rows.length; index++) {
      if (mode === 'fence' && index > 0) out += REWRITE_NEWLINE;
      out += '<span class="line">';
      for (var step = 0; step < rows[index].length; step++) {
        if (step > 0) out += ' ';
        out += '<span class="tok">' + rows[index][step] + '</span>';
      }
      out += '</span>';
    }
    return out;
  }

  /* The model flattened the way the rebuilt text is actually written: one entry per token,
     then one entry for the line break that ends its row. */
  function rewriteFlat(rows) {
    var flat = [];
    for (var index = 0; index < rows.length; index++) {
      for (var step = 0; step < rows[index].length; step++) {
        flat.push((step > 0 ? ' ' : '') + rows[index][step]);
      }
      flat.push(REWRITE_NEWLINE);
    }
    return flat;
  }

  /* Rebuild every container from scratch, one chunk of the reply. Which DOM operation each
     mode uses is the point of the exercise: innerHTML replaces the subtree with *elements*,
     while replaceChildren with text nodes is the shape whose text nodes the ink can see. */
  function rewriteTick(config) {
    rewrite.tokens += 1;
    rewrite.chunks += 1;
    var rows = rewriteRows(config.cap);
    var flat = config.mode === 'cells' ? rewriteFlat(rows) : null;
    for (var index = 0; index < rewrite.containers.length; index++) {
      var container = rewrite.containers[index];
      var target = container.target;
      if (config.mode === 'cells') {
        /* One fresh text node per stable parent, each in its own element: the same new-node
           load as the texts arm, spread the way a block of inline prose would spread it. */
        for (var cellIndex = 0; cellIndex < container.cells.length; cellIndex++) {
          container.cells[cellIndex].replaceChildren(
            document.createTextNode(flat[cellIndex] === undefined ? '' : flat[cellIndex]),
          );
          rewrite.textNodes += 1;
        }
      } else if (config.mode === 'texts') {
        var nodes = [];
        for (var rowIndex = 0; rowIndex < rows.length; rowIndex++) {
          for (var step = 0; step < rows[rowIndex].length; step++) {
            nodes.push(document.createTextNode((step > 0 ? ' ' : '') + rows[rowIndex][step]));
          }
          nodes.push(document.createTextNode(REWRITE_NEWLINE));
        }
        target.replaceChildren.apply(target, nodes);
        rewrite.textNodes += nodes.length;
      } else {
        target.innerHTML = rewriteHtml(rows, config.mode);
      }
      rewrite.writes += 1;
    }
    /* The shell's auto-scroll, forced for every mode alike: reading scrollHeight lays out the
       subtree that was just rebuilt, which is the layout the reply's own append would dirty. */
    stream.scroller.scrollTop = stream.scroller.scrollHeight;
  }

  /* One tick of the reply: every pooled node grows by a few characters, every few ticks a
     whole block is committed, and every configured container is rebuilt from scratch. */
  function streamTick(config) {
    refs();
    stream.ticks += 1;
    for (var i = 0; i < stream.pool.length; i++) {
      if (stream.pool[i].node.nodeValue.length >= POOL_CAP) recycleSlot(i);
      stream.pool[i].node.nodeValue += nextSlice(4 + ((i * 7 + stream.ticks) % 5));
      stream.writes += 1;
    }
    if (config.containers > 0) rewriteTick(config);
    /* A shape that asks for no committed blocks passes 0; the tail rows all pass a period. */
    if (config.blockEvery > 0 && stream.ticks % config.blockEvery === 0) {
      churnBlock();
      /* The shell's auto-scroll: reading scrollHeight forces the layout the appends
         already dirtied, in every configuration alike. */
      stream.scroller.scrollTop = stream.scroller.scrollHeight;
    }
  }

  /* ---- measuring ----------------------------------------------------------- */

  /* Peak liveness of the ink.
     Two numbers, because they answer different questions and they are not the same.
     The highlight registry holds one entry per ink the plugin has claimed and not yet
     released; an animated ramp runs for one fade duration and is then released, so a
     text node the shell detaches mid-fade keeps its entry alive until the timer fires
     even though there is no longer anything under it to paint. The animation timeline
     is the other side of that: document.getAnimations() only lists animations whose
     element is still in the document, so it counts exactly the ramps that are costing
     anything. The detached-range probe below is what proves the two can differ. */
  function samplePeak(peak) {
    var ink = 0;
    var animations = 0;
    var inkAnimations = 0;
    try {
      if (window.CSS && CSS.highlights) {
        var names = CSS.highlights.keys();
        for (var step = names.next(); !step.done; step = names.next()) {
          if (step.value.indexOf('dsh-custom-theme-ink-') === 0) ink += 1;
        }
      }
    } catch (error) {}
    try {
      var list = document.getAnimations();
      animations = list.length;
      for (var i = 0; i < list.length; i++) {
        var animation = list[i];
        var frames = animation.effect && animation.effect.getKeyframes ? animation.effect.getKeyframes() : [];
        for (var j = 0; j < frames.length; j++) {
          if (Object.prototype.hasOwnProperty.call(frames[j], '--dct-stream-ink')) { inkAnimations += 1; break }
        }
      }
    } catch (error) {}
    if (ink > peak.inkRegistry) peak.inkRegistry = ink;
    if (animations > peak.animations) peak.animations = animations;
    if (inkAnimations > peak.inkAnimations) peak.inkAnimations = inkAnimations;
  }

  function countTextNodes(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var count = 0;
    while (walker.nextNode() !== null) count += 1;
    return count;
  }

  /* Record the frame clock and the long tasks while the reply streams for the measured
     window, after a warmup of the same work so the DOM is already populated when
     recording starts. Resolves with the raw per-frame deltas; the percentiles are
     computed by the caller so what is printed is what was recorded. */
  harness.measure = function (options) {
    var wanted = options || {};
    var config = {
      /* Read with an explicit fallback: zero live nodes is a shape this harness asks
         for on purpose, and a shorthand-or default would quietly turn it back into
         three. */
      streamMs: wanted.streamMs === undefined ? 4000 : wanted.streamMs,
      warmupMs: wanted.warmupMs === undefined ? 700 : wanted.warmupMs,
      nodes: wanted.nodes === undefined ? 3 : wanted.nodes,
      blockEvery: wanted.blockEvery === undefined ? 6 : wanted.blockEvery,
      /* The wholesale-rewrite shape; zero containers is every tail-only row. */
      mode: wanted.mode === undefined ? 'texts' : wanted.mode,
      containers: wanted.containers === undefined ? 0 : wanted.containers,
      cap: wanted.cap === undefined ? 12 : wanted.cap,
    };
    return new Promise(function (resolve) {
      ensurePool(config.nodes);
      ensureRewrite(config);
      var frames = [];
      var longTasks = [];
      var errors = [];
      var peak = { inkRegistry: 0, animations: 0, inkAnimations: 0 };
      var phase = 'warmup';
      var startedAt = performance.now();
      var measuredAt = 0;
      var counter = 0;
      var observer = null;
      try {
        if (typeof PerformanceObserver === 'function') {
          observer = new PerformanceObserver(function (list) {
            var entries = list.getEntries();
            for (var i = 0; i < entries.length; i++) longTasks.push(entries[i].duration);
          });
          observer.observe({ entryTypes: ['longtask'] });
        }
      } catch (error) {
        errors.push('longtask observer unavailable: ' + error.message);
      }

      var last = startedAt;
      function frame(now) {
        counter += 1;
        if (phase === 'measure') {
          frames.push(now - last);
          if (counter % 4 === 0) samplePeak(peak);
        }
        last = now;
        window.requestAnimationFrame(frame);
      }
      window.requestAnimationFrame(frame);

      function finish(now) {
        if (observer !== null) observer.disconnect();
        resolve({
          frames: frames,
          longTasks: longTasks,
          elapsedMs: now - measuredAt,
          errors: errors,
          peak: peak,
          stream: { ticks: stream.ticks, writes: stream.writes, blocks: stream.blocks, recycles: stream.recycles, recycledDetached: stream.recycledDetached },
          rewrite: {
            mode: config.mode,
            containers: rewrite.containers.length,
            cap: config.cap,
            tokens: rewrite.tokens,
            chunks: rewrite.chunks,
            writes: rewrite.writes,
            textNodes: rewrite.textNodes,
          },
          dom: {
            elements: stream.turn.querySelectorAll('*').length,
            textNodes: countTextNodes(stream.turn),
            /* The rebuilt containers read back off the document, so a row that claims to have
               streamed them proves it rather than reporting the configuration it asked for. */
            containers: document.querySelectorAll('.md-rewrite').length,
            /* Every surface the picture pass claimed, with the declarations its own
               layer rule gave the pseudo-element. This is the evidence that the row
               really did paint full-viewport blurred layers rather than nothing. */
            layers: (function () {
              var nodes = document.querySelectorAll('[data-dct-zone]');
              var out = [];
              for (var i = 0; i < nodes.length; i++) {
                var node = nodes[i];
                var rect = node.getBoundingClientRect();
                var before = window.getComputedStyle(node, '::before');
                out.push({
                  zone: node.getAttribute('data-dct-zone'),
                  layer: node.getAttribute('data-dct-layer'),
                  width: Math.round(rect.width),
                  height: Math.round(rect.height),
                  filter: before.filter || 'none',
                  attachment: before.backgroundAttachment || '',
                  opacity: before.opacity || '',
                });
              }
              return out;
            })(),
          },
        });
      }

      function tick() {
        var now = performance.now();
        streamTick(config);
        if (phase === 'warmup' && now - startedAt >= config.warmupMs) {
          phase = 'measure';
          measuredAt = now;
          frames.length = 0;
          longTasks.length = 0;
        }
        if (phase === 'measure' && now - measuredAt >= config.streamMs) {
          finish(now);
          return;
        }
        window.setTimeout(tick, 16);
      }
      window.setTimeout(tick, 16);
    });
  };

  /* A self-test of how an ink is judged while the shell is rewriting its own tree.
     A live Range: when the text node under it leaves the document, the range's
     boundary point moves out to the parent rather than staying on the detached node,
     so asking the range whether it is connected answers "yes" for an ink that has
     nothing left to paint. The check below pins that behaviour down, which is why the
     harness reads the animation timeline for the live ramps and treats the registry
     size as a separate, larger number. */
  harness.probeDetachedRange = function () {
    var host = document.createElement('div');
    document.body.appendChild(host);
    var node = document.createTextNode('probe');
    host.appendChild(node);
    var range = document.createRange();
    range.setStart(node, 0);
    range.setEnd(node, 5);
    var snapshot = {
      startIsNodeBefore: range.startContainer === node,
      nodeBefore: node.isConnected,
    };
    host.remove();
    snapshot.nodeAfter = node.isConnected;
    snapshot.startIsNodeAfter = range.startContainer === node;
    snapshot.rangeLooksConnected = range.startContainer.isConnected;
    snapshot.detachedRangeMovesOut = snapshot.nodeAfter === false && snapshot.startIsNodeAfter === false;
    return snapshot;
  };

  /* ---- boot ---------------------------------------------------------------- */

  function boot() {
    try {
      var config = readConfig();
      harness.controls = config;
      harness.storage = seedStorage(config);
      harness.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!config.plugin) return;
      if (!window.__dctDefinition || typeof window.__dctDefinition.factory !== 'function') {
        throw new Error('the module loader shim never received a definition');
      }
      window.__dctDefinition.factory(fakeRequire).apply(createContext());
      harness.applied = true;
    } catch (error) {
      harness.bootError = String(error && error.stack ? error.stack : error);
    } finally {
      harness.ready = true;
    }
  }

  boot();
})();
</script>
</body>
</html>
`

/**
 * Encode a small gradient PNG, so the page has a real raster picture to blur.
 *
 * A one-pixel image would let the renderer skip most of the blur work, and a data
 * URI cannot be used: the plugin builds the `background-image` URL itself, so the
 * bytes have to be served at the path it asks for.
 * @param size - Edge length in pixels.
 * @returns The PNG bytes.
 */
function gradientPng(size = 256) {
  const stride = size * 3 + 1
  const raw = Buffer.alloc(size * stride)
  for (let y = 0; y < size; y++) {
    let cursor = y * stride
    raw[cursor++] = 0
    for (let x = 0; x < size; x++) {
      raw[cursor++] = Math.round((255 * x) / (size - 1))
      raw[cursor++] = Math.round((255 * y) / (size - 1))
      raw[cursor++] = Math.round((255 * ((x * 3 + y * 5) % 64)) / 63)
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 2
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return Buffer.concat([
    signature,
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw, { level: 6 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let value = n
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    table[n] = value >>> 0
  }
  return table
})()

/**
 * One PNG chunk, checksum included.
 * @param type - Four-character chunk type.
 * @param data - Chunk payload.
 * @returns The framed chunk.
 */
function pngChunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  let checksum = 0xffffffff
  for (const byte of body) checksum = CRC_TABLE[(checksum ^ byte) & 0xff] ^ (checksum >>> 8)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE((checksum ^ 0xffffffff) >>> 0, 0)
  return Buffer.concat([length, body, crc])
}

/**
 * The fixture origin: the page, the plugin source, and the picture the plugin asks for.
 * @param client - `lib/client.js` text.
 * @param picture - PNG bytes for any `/dsh-custom-theme/background/…` request.
 * @returns A server already listening on loopback.
 */
async function startServer(client, picture) {
  const server = createServer((request, response) => {
    const path = new URL(request.url, 'http://127.0.0.1').pathname
    const send = (status, contentType, body) => {
      response.writeHead(status, { 'content-type': contentType, 'cache-control': 'no-store' })
      response.end(body)
    }
    if (path === '/') return send(200, 'text/html; charset=utf-8', PAGE)
    if (path === '/lib/client.js') return send(200, 'text/javascript; charset=utf-8', client)
    if (path.startsWith('/dsh-custom-theme/background/')) return send(200, 'image/png', picture)
    if (path === '/dsh-custom-theme/themes') return send(200, 'application/json', '{"themes":[]}')
    if (path === '/dsh-custom-theme/backgrounds') return send(200, 'application/json', '{"backgrounds":[]}')
    if (path === '/favicon.ico') return send(204, 'image/x-icon', '')
    send(404, 'text/plain; charset=utf-8', 'not found')
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return server
}

/**
 * Percentiles of one run's frame deltas.
 *
 * The deltas are recorded against whatever cadence this browser runs its animation
 * frames at, so the two slow-frame counts matter more than the percentiles: a frame
 * past 16.7ms is a frame a 60Hz display could not have drawn on time, and one past
 * 33.3ms is a visibly dropped frame.
 * @param deltas - Per-frame intervals in ms.
 * @returns The summary the table prints.
 */
function summarize(deltas) {
  const sorted = [...deltas].sort((a, b) => a - b)
  const at = (quantile) => {
    if (sorted.length === 0) return 0
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(quantile * sorted.length) - 1))
    return sorted[index]
  }
  const total = sorted.reduce((sum, value) => sum + value, 0)
  return {
    count: sorted.length,
    mean: sorted.length === 0 ? 0 : total / sorted.length,
    p50: at(0.5),
    p95: at(0.95),
    worst: sorted.length === 0 ? 0 : sorted[sorted.length - 1],
    over16: sorted.filter((value) => value > 16.7).length,
    over33: sorted.filter((value) => value > 33.3).length,
  }
}

const ms = (value) => `${value.toFixed(1)}ms`
const fixed = (value, digits = 1) => value.toFixed(digits)

/**
 * Run one configuration in a freshly navigated page and read back its frames.
 * @param session - Driver session.
 * @param origin - Fixture origin.
 * @param config - A row of {@link CONFIGS} or {@link sweepConfigs}.
 * @param shape - `nodes` and `blockEvery` for the stream.
 * @returns The measurement, plus everything needed to sanity-check it.
 */
async function runConfig(session, origin, config, shape) {
  /* A rewrite row carries its own stream shape; every tail row uses the shape argument. */
  const effective = {
    nodes: shape.nodes,
    blockEvery: shape.blockEvery,
    mode: config.mode ?? 'texts',
    containers: config.containers ?? 0,
    cap: config.cap ?? REWRITE_LINE_CAP,
  }
  const query = new URLSearchParams({
    plugin: config.plugin ? '1' : '0',
    ink: config.ink ? '1' : '0',
    picture: config.blur === null ? 'off' : 'on',
    blur: String(config.blur ?? 16),
    nodes: String(effective.nodes),
    blockEvery: String(effective.blockEvery),
    mode: effective.mode,
    containers: String(effective.containers),
    cap: String(effective.cap),
  })
  const before = session.diagnostics.length
  await session.navigate(`${origin}/?${query.toString()}`)
  await session.waitFor('window.__dctHarness && window.__dctHarness.ready === true', {
    timeout: 15_000,
    label: `the fixture at ?${query.toString()} to boot`,
  })

  const bootError = await session.evaluate('window.__dctHarness.bootError')
  if (bootError) throw new Error(`the plugin threw while booting: ${bootError}`)
  const reduceMotion = await session.evaluate('window.__dctHarness.reduceMotion')
  if (reduceMotion) throw new Error('the browser reports prefers-reduced-motion: reduce, which disables the ink entirely')

  const applied = await session.evaluate('window.__dctHarness.applied')
  if (applied !== config.plugin) throw new Error(`the plugin ${config.plugin ? 'was not applied' : 'was applied'}`)

  const probe = await session.evaluate('window.__dctHarness.probeDetachedRange()')
  if (!probe.detachedRangeMovesOut) throw new Error(`a range over a detached text node no longer relocation-checks: ${JSON.stringify(probe)}`)

  const warnings = await session.evaluate('window.__dctHarness.warnings')
  const result = await session.evaluate(
    `window.__dctHarness.measure(${JSON.stringify({ streamMs: STREAM_MS, warmupMs: WARMUP_MS, ...effective })})`,
  )

  const fresh = session.diagnostics.slice(before)
  if (fresh.length > 0) throw new Error(`${config.key} at ?${query.toString()} reported ${fresh.length} diagnostic(s): ${fresh.join(' | ')}`)

  // A harness check, not a plugin check: if the feature under test was not live, the
  // row would be a copy of another row wearing a different label.
  const inkMustBeLive = config.enforceInk ?? config.ink
  if (inkMustBeLive && result.peak.inkAnimations === 0) throw new Error('ink was configured on, but no ramp ever ran')
  if (!config.ink && result.peak.inkRegistry !== 0) throw new Error('ink was configured off, but ink was registered anyway')
  if (config.ink && result.peak.inkRegistry < result.peak.inkAnimations) throw new Error('more ramps ran than inks were registered')
  if (config.blur === null && result.dom.layers.length !== 0) throw new Error(`no picture was configured, but ${result.dom.layers.length} surface(s) were claimed`)
  if (config.blur !== null && result.dom.layers.length === 0) throw new Error('a picture was configured, but no surface was claimed')

  // The rewrite rows must have really rebuilt what they claim to: a container that was never
  // built, or a stream that never ticked, would make the matched pair meaningless.
  if (effective.containers > 0) {
    if (result.dom.containers !== effective.containers) {
      throw new Error(`the fixture built ${result.dom.containers} rewrite container(s), not ${effective.containers}`)
    }
    if (result.rewrite.chunks < 8 || result.rewrite.writes !== result.rewrite.chunks * effective.containers) {
      throw new Error(`the rewrite stream did not run as asked: ${JSON.stringify(result.rewrite)}`)
    }
    if (effective.mode === 'texts' && result.rewrite.textNodes === 0) {
      throw new Error('the text-node rewrite arm wrote no text nodes')
    }
  } else if (result.dom.containers !== 0) {
    throw new Error('rewrite containers were built for a row that asked for none')
  }

  return { result, warnings, stats: summarize(result.frames), longTasks: result.longTasks }
}

/**
 * Print one table of measurements.
 * @param title - Heading to print above it.
 * @param rows - `{ config, run }` in presentation order.
 */
function printTable(title, rows) {
  console.log(`\n${title}`)
  const header = [
    'config'.padEnd(38),
    'frames'.padStart(7),
    'mean'.padStart(8),
    'p50'.padStart(8),
    'p95'.padStart(8),
    'worst'.padStart(9),
    '>16.7ms'.padStart(9),
    '>33.3ms'.padStart(9),
    'long'.padStart(6),
    'longTotal'.padStart(11),
    'longMax'.padStart(9),
    'inkReg'.padStart(8),
    'inkRamp'.padStart(9),
    'layers'.padStart(7),
    'blocks'.padStart(7),
  ].join('')
  console.log(header)
  console.log('-'.repeat(header.length))
  for (const { config, run } of rows) {
    const { stats, result } = run
    const longTotal = run.longTasks.reduce((total, value) => total + value, 0)
    const longMax = run.longTasks.length === 0 ? 0 : Math.max(...run.longTasks)
    console.log([
      `${config.key}. ${config.label}`.padEnd(38).slice(0, 38),
      String(stats.count).padStart(7),
      ms(stats.mean).padStart(8),
      ms(stats.p50).padStart(8),
      ms(stats.p95).padStart(8),
      ms(stats.worst).padStart(9),
      String(stats.over16).padStart(9),
      String(stats.over33).padStart(9),
      String(run.longTasks.length).padStart(6),
      ms(longTotal).padStart(11),
      ms(longMax).padStart(9),
      String(result.peak.inkRegistry).padStart(8),
      String(result.peak.inkAnimations).padStart(9),
      String(result.dom.layers.length).padStart(7),
      String(result.stream.blocks).padStart(7),
    ].join(''))
  }
}

async function main() {
  const client = await readFile(CLIENT_URL, 'utf8')
  const picture = gradientPng()
  const server = await startServer(client, picture)
  const origin = `http://127.0.0.1:${server.address().port}`
  const browser = await launch({ port: CDP_PORT })
  const session = await attach(browser.endpoint)
  let failures = 0

  try {
    console.log(`browser: ${browser.browser}`)
    console.log(`fixture: ${origin}  stream: ${STREAM_MS}ms per configuration, ${WARMUP_MS}ms warmup`)

    const measureAll = async (configs, shape) => {
      const rows = []
      for (const config of configs) {
        const run = await runConfig(session, origin, config, shape)
        if (run.warnings.length > 0) {
          // A zone that matched nothing means the fixture no longer looks like the shell.
          throw new Error(`${config.key}: the plugin warned ${run.warnings.join(' | ')}`)
        }
        rows.push({ config, run })
      }
      return rows
    }

    const mainRows = await measureAll(CONFIGS, STREAM_SHAPE)
    printTable(`frames during a dense streaming reply (${STREAM_SHAPE.nodes} text nodes written per tick, one block every ${STREAM_SHAPE.blockEvery} ticks)`, mainRows)

    const sweepRows = []
    for (const nodes of SWEEP) {
      sweepRows.push(...await measureAll(sweepConfigs(nodes), { nodes, blockEvery: STREAM_SHAPE.blockEvery }))
    }
    printTable('the same stream with a wider live tail: how many concurrently-written nodes the ink needs to cost anything', sweepRows)

    const exposureRows = await measureAll(EXPOSURE, { nodes: 0, blockEvery: STREAM_SHAPE.blockEvery })
    printTable('the same stream with no live tail: every text node arrives inside the element that carries it, as a committed markdown block does', exposureRows)

    /* The wholesale-rewrite family. Every row carries its own shape — no pooled text nodes and
       no committed blocks — so the only DOM churn on the page is the rebuilt container itself,
       and the matched no-plugin row prices that churn without the ink. */
    const rewriteShape = { nodes: 0, blockEvery: 0 }
    const rewriteRows = []
    for (const [mode, prefix, what, enforceInk, cap] of [
      ['fence', 'f', 'fence innerHTML rewrites', false, REWRITE_LINE_CAP],
      ['prose', 'p', 'prose innerHTML rewrites', false, REWRITE_LINE_CAP],
      ['texts', 't', 'wholesale text rewrites', true, 2],
      ['cells', 'k', 'per-cell text rewrites', true, 2],
    ]) {
      const rows = await measureAll(rewriteConfigs(mode, prefix, what, enforceInk, cap), rewriteShape)
      /* The same arm at a fence's depth, printed in the same table because it is the same
         question asked where a dense reply actually lives. */
      if (mode === 'texts') rows.push(...await measureAll(REWRITE_DEEP, rewriteShape))
      if (mode === 'cells') rows.push(...await measureAll(REWRITE_CELLS_DEEP, rewriteShape))
      printTable(`${what}, streamed at 1, 2 and 4 containers, each with its matched no-plugin row` +
        (mode === 'texts' || mode === 'cells'
          ? ` (the sweep is a ${cap}-line container; the last two rows are ${REWRITE_LINE_CAP}-line)`
          : ` (${cap}-line container)`), rows)
      rewriteRows.push(...rows)
    }
    const growRows = await measureAll(REWRITE_GROW, rewriteShape)
    printTable('the same fence rewrite with the cap lifted: the whole accumulated fence is re-set on every chunk', growRows)

    const allRows = [...mainRows, ...sweepRows, ...exposureRows, ...rewriteRows, ...growRows]
    for (const { config, run } of allRows) {
      const { result } = run
      const seconds = result.elapsedMs / 1000
      console.log(
        `\n${config.key}: ${result.stream.ticks} ticks, ${result.stream.writes} text writes, ` +
        `${result.stream.blocks} blocks committed (${fixed(seconds === 0 ? 0 : result.stream.blocks / seconds, 1)}/s), ` +
        `${result.stream.recycles} node commitments (${result.stream.recycledDetached} of them left the document), ` +
        `${result.dom.elements} elements / ${result.dom.textNodes} text nodes live, ${fixed(result.elapsedMs, 0)}ms recorded, ` +
        `${result.peak.animations} animations on the page, of which ${result.peak.inkAnimations} were ink ramps` +
        (result.rewrite.containers > 0
          ? `, rebuilding ${result.rewrite.containers} ${result.rewrite.mode} container(s) over ${result.rewrite.chunks} chunks ` +
            `(${result.rewrite.textNodes} text nodes written, cap ${result.rewrite.cap === 0 ? 'none' : result.rewrite.cap})`
          : '') +
        (result.errors.length > 0 ? `\nerrors: ${result.errors.join(' | ')}` : ''),
      )
    }

    /* The picture rows are only interesting if the layers they claim are really there
       and really blurred; this is that evidence, read back from the fixture's own
       computed styles rather than assumed from the settings that were seeded. */
    const pictured = allRows.filter(({ run }) => run.result.dom.layers.length > 0)
    if (pictured.length > 0) {
      console.log('\nwhat the picture rows actually painted (computed ::before of every claimed surface)')
      for (const { config, run } of pictured.slice(0, 1)) {
        for (const layer of run.result.dom.layers) {
          console.log(
            `  ${config.key}  zone ${String(layer.zone).padEnd(13)} layer ${String(layer.layer).padEnd(3)} ` +
            `${layer.width}x${layer.height}  filter ${String(layer.filter).padEnd(12)} attachment ${String(layer.attachment || 'scroll').padEnd(7)} opacity ${layer.opacity}`,
          )
        }
      }
      const blur16 = pictured.find(({ config }) => config.blur === 16)
      const blur0 = pictured.find(({ config }) => config.blur === 0)
      const filters = (row) => row.run.result.dom.layers.map((layer) => `${layer.zone}:${layer.filter}`).join(' ')
      if (blur16) console.log(`  blur 16 -> ${filters(blur16)}`)
      if (blur0) console.log(`  blur  0 -> ${filters(blur0)}`)
    }
    console.log('')
  } catch (error) {
    failures += 1
    console.error(`\nFAIL ${error.message}`)
    for (const line of session.diagnostics.slice(-8)) console.error(`  page> ${line}`)
  } finally {
    session.close()
    await browser.close()
    await new Promise((resolve) => server.close(resolve))
  }

  if (failures > 0) process.exitCode = 1
}

await main()
