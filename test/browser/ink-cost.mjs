/**
 * What one streaming-ink pass costs on a transcript the size of the live one.
 *
 * `frame-cost.mjs` and `repaint-cost.mjs` both missed this: `frame-cost.mjs` streams into a
 * small, cascade-light page, so a style recalculation of its document is cheap enough to
 * hide the ink pass's real cost, and `repaint-cost.mjs` prices the background pass, not the
 * ink. The live measurement (`test/diagnostics/`, the user's own profile) is what named the
 * shape the two missed:
 *
 *   tickStreamInk   587 calls  total 22.3-35.1s  max 5.63s
 *   stalls          6.71s / 6.45s / 5.92s with tickStreamInk covering 71-87% of each
 *   context         7 200-9 200 elements, live ink 0-16, up to 190 text nodes named in one frame
 *   connection      the 5.92s stall began 12ms before `connection lost, retry #1`
 *
 * The mechanism this harness is built to confirm: the pass reads the prose colour per node —
 * `getComputedStyle(element).color` — and writes `sheet.insertRule(...)` for the same node,
 * interleaved. The read is the expensive half and it is expensive only because of the write: a
 * `getComputedStyle` call hands back a live declaration, and it is the property access that
 * resolves the element's style, so every `insertRule` in front of it forces a full
 * recalculation of the whole document — O(nodes inked in the frame) full recalcs of a
 * 7 000+ element document per pass. (This harness times the property access, not the
 * `getComputedStyle` call, because a CPU profile of one pass puts 94% of it in the plugin's
 * own `streamInkColour`, with the wrapper around `getComputedStyle` accounting for
 * microseconds: the call is lazy, the read is not.)
 *
 * The fixture therefore carries the three properties that matter, and only those:
 *
 *   - a large transcript (7 000-10 000 elements of nested markdown-shaped blocks), built
 *     before the plugin boots, so a recalculation is genuinely expensive;
 *   - a live streaming tail that names up to ~190 fresh text nodes in a single frame, all
 *     in one task, so the observer's records coalesce into one pass (the app's own
 *     `maxTextNodesPerFrame`), and each node is new, so each one claims its own rule;
 *   - the plugin's writing ink at its default setting.
 *
 * What is measured, per burst, from inside the page and from the browser's own counters:
 *
 *   - `tickStreamInk`'s own duration, timed on the `requestAnimationFrame` callback the ink
 *     pass runs in (the plugin registers exactly one rAF, `scheduleStreamInk`, so a
 *     post-boot rAF callback is the pass and nothing else);
 *   - the frame clock's worst gap across the burst — the freeze as the user feels it, and
 *     the number the connection's pong deadline is really about;
 *   - the resolved-colour reads and the time inside them (the property access, which is the
 *     read the pass actually pays for) and `CSSStyleSheet.insertRule` calls and the time
 *     inside them, so the pass's cost is attributed to reads or writes rather than assumed;
 *   - `RecalcStyleCount` / `RecalcStyleDuration` from the DevTools Performance domain: how
 *     many times the document's style was actually recalculated. This is the decisive
 *     number, because it counts the thing the mechanism claims, not the time it took.
 *
 * It is a gate as well as a measurement, because the fix has to be provable. Three gates, one
 * per claim:
 *
 *   - the mechanism: a burst of 190 fresh nodes may not pay more than a handful of style
 *     recalculations of the document ({@link GATE_RECALCS}). This is the one that does not
 *     depend on the machine — pre-fix the burst pays ~190, post-fix two or three.
 *   - the frame: the worst single pass may not cost more than {@link RECALC_ALLOWANCE} of this
 *     document's own forced recalculation, measured in the same run, or {@link BUDGET_MS} —
 *     the 250ms the live instrument calls a stall, which is the threshold the shell's pong
 *     deadline rides on. The floor keeps a document whose recalculation is cheap from buying
 *     a pass more time than a stall.
 *   - the sheet: once every ramp has settled, the ink's stylesheet must be empty again. The
 *     ink claims a rule per freshly inked chunk, so a rule that is never withdrawn is one the
 *     next recalculation of the document matches, and the next, for the life of the page.
 *
 * Every configuration also has to prove it exercised what its label claims: the ink rows must
 * have claimed a rule and started a ramp per fresh node, and the ink-off rows must have touched
 * neither the sheet nor the computed style.
 *
 * Usage:
 *   node test/browser/ink-cost.mjs
 *
 * Environment:
 *   DCT_INK_CDP_PORT        DevTools port for the throwaway browser (default 9413).
 *   DCT_INK_ELEMENTS        Transcript element target (default 8000).
 *   DCT_INK_NODES           Text nodes named in one burst (default 190).
 *   DCT_INK_BURSTS          Measured bursts per configuration (default 3).
 *   DCT_INK_BUDGET_MS       Per-pass time floor in ms (default 250).
 *   DCT_INK_RECALC_ALLOWANCE  Recalculations one pass may cost (default 2).
 *   DCT_INK_GATE_RECALCS    Recalculations one burst may pay (default 8).
 *   DCT_INK_GATE_RULES      Rules the ink sheet may still hold once settled (default 0).
 *   DCT_INK_CLIENT          Another copy of the browser half to price, e.g. the pre-fix one
 *                           (`git show HEAD:lib/client.js > /tmp/pre.js`), so the before and
 *                           the after come from the same harness.
 */

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { attach, launch } from './driver.mjs'

/** The browser half, served to the page as the shell's module system would. */
const CLIENT_URL = process.env.DCT_INK_CLIENT === undefined
  ? new URL('../../lib/client.js', import.meta.url)
  : pathToFileURL(resolve(process.env.DCT_INK_CLIENT))

/** DevTools port; off the suites' own 9400, frame-cost's 9411 and repaint-cost's 9412. */
const CDP_PORT = Number(process.env.DCT_INK_CDP_PORT ?? 9413)

/** Transcript element target: the live profile measured 7 200-9 200 elements. */
const ELEMENTS = Number(process.env.DCT_INK_ELEMENTS ?? 8000)

/** Text nodes a single burst names: the live profile's `maxTextNodesPerFrame`. */
const NODES = Number(process.env.DCT_INK_NODES ?? 190)

/** Measured bursts per configuration. */
const BURSTS = Number(process.env.DCT_INK_BURSTS ?? 3)

/** The per-pass time floor: the live instrument's own stall threshold. */
const BUDGET_MS = Number(process.env.DCT_INK_BUDGET_MS ?? 250)

/** How many of this document's own forced recalculations one pass may cost. */
const RECALC_ALLOWANCE = Number(process.env.DCT_INK_RECALC_ALLOWANCE ?? 2)

/**
 * How many style recalculations of the document one burst of fresh nodes may pay.
 *
 * A pass that reads every colour before it writes a rule pays the recalculation the frame
 * owed anyway, and leaves one behind for its own rule writes to be rendered: a handful. A
 * pass that interleaves the two pays one per node — 190 in the live profile, which is the
 * freeze. Eight is well clear of both ends.
 */
const GATE_RECALCS = Number(process.env.DCT_INK_GATE_RECALCS ?? 8)

/**
 * How many rules the ink's stylesheet may still carry once every ramp has settled.
 *
 * Zero: the ink claims a rule per freshly inked chunk and gives it back when the ink settles,
 * so a leftover rule is one the next recalculation of the document has to match for the life
 * of the page. Raising this prices an unfixed copy — the numbers still print, the row is just
 * marked as not meeting the bar.
 */
const GATE_RULES = Number(process.env.DCT_INK_GATE_RULES ?? 0)

/** The fade each burst's ink ramps over, and the idle gap that lets it settle. */
const FADE_MS = 300
const GAP_MS = 700

/**
 * The configurations printed in the table.
 *
 * `off` is the floor: the same bursts of the same fresh text nodes with no plugin on the
 * page at all. `inkoff` adds the plugin's always-on work (its observer and reasoning pass)
 * with the writing ink at 100%, which is the plugin's own off switch — it must touch
 * neither the ink sheet nor `getComputedStyle`. `ink` is the configuration the freeze was
 * recorded in.
 */
const CONFIGS = [
  { key: 'off', label: 'no plugin', plugin: false, ink: false },
  { key: 'inkoff', label: 'plugin, writing ink 100% (off)', plugin: true, ink: false },
  { key: 'ink', label: 'plugin, writing ink 30% (default)', plugin: true, ink: true },
]

/*
 * The page.
 *
 * Served over http on a loopback ephemeral port and booted from its own query string, the
 * way `frame-cost.mjs` and `repaint-cost.mjs` do it: every configuration is a real
 * navigation and therefore a fresh document, fresh stylesheet and fresh animation timeline.
 *
 * The page script is written without template literals or backslashes so it can be embedded
 * here without escaping rules getting in the way.
 */
const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>dsh-custom-theme ink cost</title>
<style>
  html, body { margin: 0; height: 100%; }
  body { font: 14px/1.55 "Segoe UI", system-ui, sans-serif; color: #e6e6e6; background: #141419; overflow: hidden; }
  /* The shell's own shape: a frame holding a window bar and three columns, each column
     painted by a covering component root. The ink does not care about the zones; the shape
     is here so the transcript sits in a document the size of the real one. */
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
  /* The markdown a dense reply renders into: headings, prose, lists, quotes, fences, tables
     and inline code. This cascade is what every style recalculation has to match against,
     and it is deliberately a realistic transcript's rather than a light page's. */
  .turn { max-width: 760px; }
  .turn h1, .turn h2, .turn h3, .turn h4 { margin: 14px 0 6px; font-size: 15px; font-weight: 600; line-height: 1.35; }
  .turn p { margin: 6px 0; }
  .turn em { font-style: italic; }
  .turn strong { font-weight: 600; }
  .turn li { margin: 3px 0 3px 20px; }
  .turn li::marker { color: #8a8a96; }
  .turn code { padding: 1px 4px; font-family: Consolas, monospace; font-size: 12.5px; background: #1e1e26; border-radius: 4px; }
  .turn pre { margin: 8px 0; padding: 10px; background: #16161c; border-radius: 6px; overflow: hidden; }
  .turn pre code { padding: 0; background: transparent; }
  .turn table { border-collapse: collapse; margin: 8px 0; }
  .turn th, .turn td { padding: 3px 10px; border: 1px solid #2a2a32; text-align: left; }
  .turn blockquote { margin: 8px 0; padding-left: 10px; border-left: 2px solid #3a3a44; color: #b9b9c4; }
  .turn a { color: #7aa2f7; text-decoration: none; }
  .turn hr { border: 0; border-top: 1px solid #2a2a32; margin: 12px 0; }
  .turn .token { color: #c0caf5; }
  .turn .token.keyword { color: #bb9af7; }
  .turn .token.string { color: #9ece6a; }
  .turn .token.comment { color: #565f89; }
  .turn .token.number { color: #ff9e64; }
  .turn .token.function { color: #7aa2f7; }
  .turn .md-rewrite .line { display: block; }
  .turn .livep { margin: 4px 0; }
  .turn .livep code { background: #1e1e26; }
  .turn .livep em { color: #b9b9c4; }
  .turn .livep a { color: #7aa2f7; }
  .turn section.blk { display: block; }
  .turn section.blk > h3 { margin-top: 10px; }
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
        <div class="scroller" id="scroller">
          <div class="turn" data-streaming="true" id="turn">
            <div id="committed"></div>
            <div id="live"></div>
          </div>
        </div>
        <div data-composer-seat><div class="Composer_surface"></div></div>
      </div>
    </div>
    <div data-rightbar-col><div class="Shell_dockSurface"></div></div>
  </div>
</div>
<script>window.__dctHarness = { ready: false, bootError: null, applied: false, controls: null, warnings: [], errors: [], passes: [], reads: 0, colours: 0, colourMs: 0, ruleInserts: 0, ruleInsertMs: 0, longTasks: [], writes: 0, transcriptElements: 0, documentElements: 0, liveNodes: 0, inkSheets: [], ruleTexts: [] };</script>
<script>window.__ModuleLoader__ = { load: function (definition) { window.__dctDefinition = definition } };</script>
<script src="/lib/client.js"></script>
<script>
(function () {
  'use strict';

  var harness = window.__dctHarness;
  var APPEARANCE_KEY = 'dsh-custom-theme.appearance';
  /* The highlight-name prefix the client writes its ink rules under, read out of the client
     itself when this page is served, so renaming it cannot silently empty the sheet gate. */
  var INK_RULE_PREFIX = '__DCT_INK_RULE_PREFIX__';

  function params() { return new URLSearchParams(window.location.search) }

  function readConfig() {
    var query = params();
    return {
      plugin: query.get('plugin') !== '0',
      ink: query.get('ink') === '1',
      elements: Number(query.get('elements') || 8000),
      nodes: Number(query.get('nodes') || 190),
    };
  }

  /* 1 is the plugin's own off switch for the ink: a writing ink at the maximum clears
     everything and paints nothing. */
  function seedStorage(config) {
    var appearance = {
      lineGap: 0,
      fontFamily: '',
      codeFontFamily: '',
      streamingFadeInk: config.ink ? 0.3 : 1,
      streamingFadeDuration: 300,
      reasoningExpand: 'off',
    };
    try { window.localStorage.clear() } catch (error) {}
    window.localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance));
    return { appearance: appearance };
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

  function createLocale() {
    var dictionaries = {};
    var bound = {};
    return {
      bind: function (ns) {
        if (!bound[ns]) bound[ns] = function (key) { return key };
        return bound[ns];
      },
      register: function (ns, locales) { dictionaries[ns] = locales; return function () {} },
      translate: function (ns, key) { return key },
    };
  }

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

  /* ---- the transcript ------------------------------------------------------ */

  var PROSE = 'A streaming reply commits one paragraph at a time, and every commit is a style recalculation plus a layout pass over the transcript. ';
  var CODE = 'const frames = new Set(); // a fence is never inked';
  var CELLS = ['p95 frame delta', '7 000 element document'];

  var made = 0;

  function el(tag, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    made += 1;
    return node;
  }

  function textEl(tag, className, value) {
    var node = el(tag, className);
    node.appendChild(document.createTextNode(value));
    return node;
  }

  /* One committed block of the reply: 18 elements laid out like rendered markdown. */
  function buildBlock(index) {
    var section = el('section', 'blk');
    section.appendChild(textEl('h3', '', 'Streaming paint budget ' + index));
    var paragraph = el('p');
    paragraph.appendChild(document.createTextNode(PROSE));
    paragraph.appendChild(textEl('code', '', 'CSS.highlights'));
    paragraph.appendChild(document.createTextNode(' keeps the node tree untouched, and '));
    paragraph.appendChild(textEl('em', '', 'emphasis'));
    paragraph.appendChild(document.createTextNode(' arrives in the same block.'));
    section.appendChild(paragraph);
    var list = el('ul');
    list.appendChild(textEl('li', '', 'A highlight rule of its own, claimed once per live ink ' + index));
    list.appendChild(textEl('li', '', '中英混排的列表项同样会触发字形塑形'));
    section.appendChild(list);
    var quote = el('blockquote');
    quote.appendChild(textEl('p', '', 'A detached range paints nothing, so the ink is retired on the next pass.'));
    section.appendChild(quote);
    var pre = el('pre');
    pre.appendChild(textEl('code', '', CODE));
    section.appendChild(pre);
    var table = el('table');
    var body = el('tbody');
    var row = el('tr');
    row.appendChild(textEl('td', '', CELLS[0]));
    row.appendChild(textEl('td', '', CELLS[1]));
    body.appendChild(row);
    table.appendChild(body);
    section.appendChild(table);
    return section;
  }

  function fillTranscript(target, size) {
    var fragment = document.createDocumentFragment();
    var index = 0;
    while (made < size) {
      fragment.appendChild(buildBlock(index));
      index += 1;
    }
    target.appendChild(fragment);
    return made;
  }

  /* ---- the live tail ------------------------------------------------------- */

  /* One paragraph per text node the shell is writing into, which is what a committed
     markdown block leaves behind: the ink starts its ramp on the node's parent element, and
     a real reply spreads its live nodes over many paragraphs rather than piling them onto
     one. Each burst replaces every paragraph's text node with a fresh one, because a fresh
     text node is exactly what the observer names and what has to claim a new rule — the
     app's own count of text nodes named in a frame (190) is the number of them. */
  var live = { pool: [], host: null, texts: 0 };

  function buildLive(count) {
    live.host = document.getElementById('live');
    var fragment = document.createDocumentFragment();
    for (var index = 0; index < count; index++) {
      var paragraph = document.createElement('p');
      paragraph.className = 'livep';
      paragraph.appendChild(document.createTextNode(''));
      fragment.appendChild(paragraph);
      live.pool.push(paragraph);
    }
    live.host.appendChild(fragment);
    return live.pool.length;
  }

  /* ---- instrumentation ----------------------------------------------------- */

  /* The frame clock, on a captured native rAF: the pass wrapper below replaces
     window.requestAnimationFrame, and the clock must not be timed as a pass. */
  var nativeRaf = window.requestAnimationFrame.bind(window);
  var frameClock = { last: performance.now(), deltas: [] };
  function clockTick(now) {
    frameClock.deltas.push({ at: now, delta: now - frameClock.last });
    frameClock.last = now;
    nativeRaf(clockTick);
  }

  var nativeGetComputedStyle = window.getComputedStyle.bind(window);
  var nativeInsertRule = CSSStyleSheet.prototype.insertRule;

  /* Time the callback the ink pass runs in. The plugin registers exactly one
     requestAnimationFrame (scheduleStreamInk), and the page registers none after boot, so
     every wrapped callback after the plugin is applied is one tickStreamInk pass. */
  function wrapFrameClock() {
    window.requestAnimationFrame = function (callback) {
      return nativeRaf(function (now) {
        var started = performance.now();
        try {
          return callback(now);
        } finally {
          harness.passes.push(performance.now() - started);
        }
      });
    };
  }

  /* Count every computed-style lookup and time the colour read off the declaration it hands
     back. The lookup itself is lazy and cheap; resolving the colour property is what
     resolves the element's style, and — when a stylesheet write has dirtied the document
     since the last resolution — what forces a full recalculation of it. Blink installs the
     colour accessor as an own property of each declaration (not on
     CSSStyleDeclaration.prototype), so the declaration is handed back behind a proxy that
     times exactly that one property and forwards everything else untouched. */
  function wrapComputedStyle() {
    window.getComputedStyle = function () {
      harness.reads += 1;
      var declaration = nativeGetComputedStyle.apply(null, arguments);
      return new Proxy(declaration, {
        get: function (target, property) {
          if (property === 'color') {
            var started = performance.now();
            var value = target.color;
            harness.colours += 1;
            harness.colourMs += performance.now() - started;
            return value;
          }
          var forwarded = Reflect.get(target, property, target);
          // A native method called on the proxy instead of the declaration is an illegal
          // invocation, so functions are handed back bound to the declaration itself.
          return typeof forwarded === 'function' ? forwarded.bind(target) : forwarded;
        },
      });
    };
    return true;
  }

  /* Count and time every sheet insertion: the ink's rule per freshly inked node. The sheets
     that receive one are remembered, because the plugin drops and rebuilds its stylesheet when
     it re-applies — a sheet object outlives its element, so this is the reading that still
     works after one. */
  function wrapInsertRule() {
    CSSStyleSheet.prototype.insertRule = function () {
      var started = performance.now();
      var rule = nativeInsertRule.apply(this, arguments);
      harness.ruleInserts += 1;
      harness.ruleInsertMs += performance.now() - started;
      var text = String(arguments[0]);
      if (harness.ruleTexts.length < 3) harness.ruleTexts.push(text.slice(0, 60));
      if (text.indexOf('::highlight(' + INK_RULE_PREFIX) >= 0) {
        var known = false;
        for (var index = 0; index < harness.inkSheets.length; index++) {
          if (harness.inkSheets[index] === this) { known = true; break }
        }
        if (!known) harness.inkSheets.push(this);
      }
      return rule;
    };
  }

  if (typeof PerformanceObserver === 'function') {
    try {
      new PerformanceObserver(function (list) {
        var entries = list.getEntries();
        for (var index = 0; index < entries.length; index++) harness.longTasks.push(entries[index].duration);
      }).observe({ entryTypes: ['longtask'] });
    } catch (error) {
      harness.errors.push('longtask observer unavailable: ' + error.message);
    }
  }

  function afterFrames(count) {
    return new Promise(function (resolve) {
      var left = count;
      function step() {
        if (left <= 0) { resolve(); return }
        left -= 1;
        nativeRaf(step);
      }
      step();
    });
  }

  function worstFrame(from) {
    var worst = 0;
    for (var index = from; index < frameClock.deltas.length; index++) {
      if (frameClock.deltas[index].delta > worst) worst = frameClock.deltas[index].delta;
    }
    return worst;
  }

  /* How much ink the page is carrying, and how many ramps are really running. The registry
     can hold an entry whose text has left the document; the animation timeline cannot. */
  function inkState() {
    var registered = 0;
    var ramps = 0;
    try {
      if (window.CSS && CSS.highlights) {
        var names = CSS.highlights.keys();
        for (var step = names.next(); !step.done; step = names.next()) {
          if (step.value.indexOf('dsh-custom-theme-ink-') === 0) registered += 1;
        }
      }
    } catch (error) {}
    try {
      var list = document.getAnimations();
      for (var index = 0; index < list.length; index++) {
        var frames = list[index].effect && list[index].effect.getKeyframes ? list[index].effect.getKeyframes() : [];
        for (var frame = 0; frame < frames.length; frame++) {
          if (Object.prototype.hasOwnProperty.call(frames[frame], '--dct-stream-ink')) { ramps += 1; break }
        }
      }
    } catch (error) {}
    return { registered: registered, ramps: ramps };
  }

  /* ---- measuring ----------------------------------------------------------- */

  /* One burst: every live paragraph gets a fresh text node in a single task, so the
     observer's records coalesce into one ink pass — the app's shape at its worst. The
     resolution waits three animation frames, which is after the pass the plugin scheduled
     for this burst has run (however long it took). */
  harness.burst = function () {
    var count = live.pool.length;
    return new Promise(function (resolve) {
      var marks = {
        passes: harness.passes.length,
        reads: harness.reads,
        colours: harness.colours,
        colourMs: harness.colourMs,
        inserts: harness.ruleInserts,
        insertMs: harness.ruleInsertMs,
        frames: frameClock.deltas.length,
        writes: harness.writes,
        longTasks: harness.longTasks.length,
      };
      var started = performance.now();
      for (var index = 0; index < count; index++) {
        live.pool[index].replaceChildren(document.createTextNode('落笔即墨 ink ' + index + ' 流式渐显 ' + harness.writes));
        harness.writes += 1;
      }
      var domMs = performance.now() - started;
      afterFrames(3).then(function () {
        var passes = harness.passes.slice(marks.passes);
        var total = 0;
        var worst = 0;
        for (var step = 0; step < passes.length; step++) {
          total += passes[step];
          if (passes[step] > worst) worst = passes[step];
        }
        var ink = inkState();
        var long = harness.longTasks.slice(marks.longTasks);
        resolve({
          nodes: count,
          writes: harness.writes - marks.writes,
          longTasks: long,
          longMax: long.length === 0 ? 0 : Math.max.apply(null, long),
          domMs: domMs,
          elapsedMs: performance.now() - started,
          passes: passes,
          passCount: passes.length,
          passMax: worst,
          passTotal: total,
          reads: harness.reads - marks.reads,
          colours: harness.colours - marks.colours,
          colourMs: harness.colourMs - marks.colourMs,
          inserts: harness.ruleInserts - marks.inserts,
          insertMs: harness.ruleInsertMs - marks.insertMs,
          frameWorst: worstFrame(marks.frames),
          registered: ink.registered,
          ramps: ink.ramps,
        });
      });
    });
  };

  /* Let the ramps from the last burst settle, so every burst starts from the same state
     (an empty ink sheet) and the measurement is of one pass, not of a growing pile. */
  harness.idle = function (ms) {
    return new Promise(function (resolve) { window.setTimeout(resolve, ms) });
  };

  /* One forced recalculation of this document, measured through the native reader so the
     counters stay clean: the price a single read-after-write pays in this fixture. */
  harness.probeRecalc = function () {
    var probe = document.querySelector('.blk p');
    var started = performance.now();
    document.body.style.setProperty('--dct-probe-recalc', '1');
    var colour = probe === null ? '' : nativeGetComputedStyle(probe).color;
    var ms = performance.now() - started;
    document.body.style.removeProperty('--dct-probe-recalc');
    return { ms: ms, colour: colour };
  };

  /* The pair the mechanism is made of: write one rule, then resolve one colour. The rule
     goes into a scratch sheet of this page's own, so the price is of this document and of
     nothing else — and the colour resolved is the same kind of prose element the ink reads. */
  harness.probeRuleThenRead = function () {
    var style = document.createElement('style');
    document.head.appendChild(style);
    var sheet = style.sheet;
    var probe = document.querySelector('.blk p');
    var started = performance.now();
    for (var index = 0; index < 8; index++) {
      sheet.insertRule('::highlight(dct-probe-' + index + ') { color: rgba(1, 2, 3, 0.5) }', sheet.cssRules.length);
      var ignored = nativeGetComputedStyle(probe).color;
      if (ignored === '') harness.errors.push('the probe resolved no colour');
    }
    var ms = performance.now() - started;
    style.remove();
    return { ms: ms, pairs: 8 };
  };

  /* The same eight colour resolutions with no sheet write in front of them: the read the fix
     batches, priced when the document's style is clean. Together with the pair above this is
     the entire mechanism — one whole-document recalculation per read-after-write. */
  harness.probeReadsFirst = function () {
    var probe = document.querySelector('.blk p');
    var style = document.createElement('style');
    document.head.appendChild(style);
    var sheet = style.sheet;
    var reads = [];
    var started = performance.now();
    for (var index = 0; index < 8; index++) {
      var ignored = nativeGetComputedStyle(probe).color;
      if (ignored === '') harness.errors.push('the probe resolved no colour');
      reads.push(ignored);
    }
    var readAt = performance.now();
    for (var step = 0; step < 8; step++) {
      sheet.insertRule('::highlight(dct-probe-first-' + step + ') { color: rgba(4, 5, 6, 0.5) }', sheet.cssRules.length);
    }
    var ms = performance.now() - started;
    style.remove();
    return { ms: ms, readMs: readAt - started, pairs: 8, colours: reads.length };
  };

  harness.dom = function () {
    /* The sheets the ink rules went into, still readable after the plugin drops the element
       that carried them: this is what says whether a settled ink really gave its rule back. */
    var inkRules = 0;
    for (var index = 0; index < harness.inkSheets.length; index++) {
      try { inkRules += harness.inkSheets[index].cssRules.length } catch (error) { harness.errors.push('ink sheet unreadable: ' + error.message) }
    }
    return {
      transcriptElements: document.getElementById('turn').querySelectorAll('*').length,
      documentElements: document.body.querySelectorAll('*').length,
      liveNodes: live.pool.length,
      inkStyle: document.querySelector('style[data-role="stream-ink"]') === null ? null : 'present',
      inkSheets: harness.inkSheets.length,
      inkRules: inkRules,
      ruleTexts: harness.ruleTexts.slice(0, 3),
      reduceMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    };
  };

  harness.inkState = inkState;

  /* ---- boot ---------------------------------------------------------------- */

  function boot() {
    try {
      var config = readConfig();
      harness.controls = config;
      harness.storage = seedStorage(config);
      harness.transcriptElements = fillTranscript(document.getElementById('committed'), config.elements);
      harness.liveNodes = buildLive(config.nodes);
      harness.documentElements = document.body.querySelectorAll('*').length;
      nativeRaf(clockTick);
      harness.colourWrapped = wrapComputedStyle();
      wrapInsertRule();
      if (!config.plugin) return;
      if (!window.__dctDefinition || typeof window.__dctDefinition.factory !== 'function') {
        throw new Error('the module loader shim never received a definition');
      }
      /* The rAF wrapper goes on immediately before apply, so the plugin's boot is not a
         pass and every later callback is one. */
      wrapFrameClock();
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
 * The fixture origin: the page and the plugin source. Nothing else is fetched: the ink
 * needs no picture and no KaTeX.
 * @param client - `lib/client.js` text.
 * @returns A server already listening on loopback.
 */
async function startServer(client, inkPrefix) {
  const server = createServer((request, response) => {
    const path = new URL(request.url, 'http://127.0.0.1').pathname
    const send = (status, contentType, body) => {
      response.writeHead(status, { 'content-type': contentType, 'cache-control': 'no-store' })
      response.end(body)
    }
    if (path === '/') return send(200, 'text/html; charset=utf-8', PAGE.replace('__DCT_INK_RULE_PREFIX__', inkPrefix))
    if (path === '/lib/client.js') return send(200, 'text/javascript; charset=utf-8', client)
    if (path === '/dsh-custom-theme/themes') return send(200, 'application/json', '{"themes":[]}')
    if (path === '/dsh-custom-theme/backgrounds') return send(200, 'application/json', '{"backgrounds":[]}')
    if (path === '/favicon.ico') return send(204, 'image/x-icon', '')
    send(404, 'text/plain; charset=utf-8', 'not found')
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return server
}

/** The browser's own counters, by name. @param session - Driver session. @returns Name to value. */
async function browserMetrics(session) {
  const result = await session.send('Performance.getMetrics')
  const metrics = new Map()
  for (const entry of result.metrics) metrics.set(entry.name, entry.value)
  return metrics
}

/**
 * The delta of two browser counter snapshots.
 * @param before - Snapshot taken before the burst.
 * @param after - Snapshot taken after it.
 * @param names - Counter names to difference.
 * @returns Name to delta.
 */
function metricDelta(before, after, names) {
  const delta = {}
  for (const name of names) delta[name] = (after.get(name) ?? 0) - (before.get(name) ?? 0)
  return delta
}

const num = (value) => String(Math.round(value))
const one = (value) => value.toFixed(1)
const ms = (value) => `${one(value)}ms`

/**
 * Run one configuration in a freshly navigated page: warm the fixture, then take `BURSTS`
 * measured bursts, each with the browser's own counters around it.
 * @param session - Driver session.
 * @param origin - Fixture origin.
 * @param config - A row of {@link CONFIGS}.
 * @returns The per-burst measurements and the page's own sanity numbers.
 */
async function runConfig(session, origin, config) {
  const query = new URLSearchParams({
    plugin: config.plugin ? '1' : '0',
    ink: config.ink ? '1' : '0',
    elements: String(ELEMENTS),
    nodes: String(NODES),
  })
  const before = session.diagnostics.length
  await session.navigate(`${origin}/?${query.toString()}`)
  await session.waitFor('window.__dctHarness && window.__dctHarness.ready === true', {
    timeout: 30_000,
    label: `the fixture at ?${query.toString()} to boot`,
  })

  const bootError = await session.evaluate('window.__dctHarness.bootError')
  if (bootError) throw new Error(`the fixture threw while booting: ${bootError}`)
  const applied = await session.evaluate('window.__dctHarness.applied')
  if (applied !== config.plugin) throw new Error(`the plugin ${config.plugin ? 'was not applied' : 'was applied'}`)

  const dom = await session.evaluate('window.__dctHarness.dom()')
  if (dom.reduceMotion) throw new Error('the browser reports prefers-reduced-motion: reduce, which disables the ink entirely')
  const colourWrapped = await session.evaluate(`(function () {
    if (window.__dctHarness.colourWrapped !== true) return false
    var before = window.__dctHarness.colours
    var ignored = window.getComputedStyle(document.body).color
    return ignored !== '' && window.__dctHarness.colours > before
  })()`)
  if (!colourWrapped) throw new Error('the computed-style wrapper is not installed: this harness cannot attribute the pass to the colour read')
  if (dom.transcriptElements < ELEMENTS) {
    throw new Error(`the transcript is ${dom.transcriptElements} elements, below the ${ELEMENTS} asked for`)
  }
  if (dom.liveNodes !== NODES) throw new Error(`the live tail has ${dom.liveNodes} node(s), not ${NODES}`)

  /* One unmeasured burst, so the pass and the fixture's own writes are warm before the
     numbers that are reported. */
  await session.evaluate('window.__dctHarness.burst()')
  await session.evaluate(`window.__dctHarness.idle(${GAP_MS})`)

  const bursts = []
  for (let index = 0; index < BURSTS; index += 1) {
    const counters = await browserMetrics(session)
    const result = await session.evaluate('window.__dctHarness.burst()')
    const after = await browserMetrics(session)
    result.counters = metricDelta(counters, after, ['RecalcStyleCount', 'RecalcStyleDuration', 'LayoutCount', 'LayoutDuration', 'ScriptDuration'])
    bursts.push(result)
    await session.evaluate(`window.__dctHarness.idle(${GAP_MS})`)
  }

  const warnings = await session.evaluate('window.__dctHarness.warnings')
  if (warnings.length > 0) throw new Error(`the plugin warned: ${warnings.join(' | ')}`)
  const errors = await session.evaluate('window.__dctHarness.errors')
  if (errors.length > 0) throw new Error(`the page reported: ${errors.join(' | ')}`)

  const fresh = session.diagnostics.slice(before)
  if (fresh.length > 0) throw new Error(`${config.key} at ?${query.toString()} reported ${fresh.length} diagnostic(s): ${fresh.join(' | ')}`)

  /* A row has to prove it exercised what its label claims. The ink rows must have claimed a
     rule per fresh node and started a ramp; the ink-off rows must have touched neither the
     sheet nor the computed style; the no-plugin row must have touched neither. */
  for (const burst of bursts) {
    if (burst.nodes !== NODES || burst.writes !== NODES) {
      throw new Error(`a burst wrote ${burst.writes} of ${NODES} node(s): ${JSON.stringify(burst)}`)
    }
    if (config.ink) {
      if (burst.passCount < 1) throw new Error('the ink was configured on, but no pass ran for a burst')
      if (burst.inserts < NODES) throw new Error(`only ${burst.inserts} rule(s) were claimed for ${NODES} fresh node(s)`)
      if (burst.colours < NODES) throw new Error(`only ${burst.colours} colour(s) were resolved for ${NODES} fresh node(s)`)
      if (burst.ramps < 1) throw new Error('the ink was configured on, but no ramp ever ran')
    } else {
      if (burst.inserts !== 0) throw new Error(`the ink was configured off, but ${burst.inserts} rule(s) were claimed`)
      if (burst.reads !== 0) throw new Error(`the ink was configured off, but ${burst.reads} computed style(s) were read`)
      if (burst.colours !== 0) throw new Error(`the ink was configured off, but ${burst.colours} colour(s) were resolved`)
    }
  }
  if (!config.plugin && dom.inkStyle !== null) throw new Error('no plugin was configured, but the ink stylesheet exists')
  /* Every ramp has settled by the time the row is read, so the ink sheet has to be empty again.
     A rule that is never withdrawn is one more rule every recalculation of the document has to
     match, for the life of the page — and the ink claims a rule per freshly inked chunk. This
     is read after the bursts: at boot the ink has not written a rule yet. */
  const settled = await session.evaluate('window.__dctHarness.dom()')
  if (config.ink) {
    if (settled.inkSheets < 1) throw new Error(`the ink was configured on, but no ink rule was ever watched: ${JSON.stringify(settled)}`)
    if (settled.inkRules > GATE_RULES) {
      throw new Error(`the ink's stylesheet still carries ${settled.inkRules} rule(s) after every ramp settled, over the ${GATE_RULES} allowed: ${JSON.stringify(settled)}`)
    }
  }

  return { dom, settled, bursts, warnings }
}

/**
 * Print the table of measurements.
 * @param title - Heading above it.
 * @param rows - `{ config, run }` in presentation order.
 * @returns The worst single pass seen, and the row it was in.
 */
function printTable(title, rows) {
  console.log(`\n${title}`)
  const header = [
    'config'.padEnd(34),
    'elems'.padStart(6),
    'nodes'.padStart(6),
    'passMax'.padStart(9),
    'passMed'.padStart(9),
    'passSum'.padStart(9),
    'colours'.padStart(8),
    'colourMs'.padStart(10),
    'inserts'.padStart(8),
    'insMs'.padStart(8),
    'recalcs'.padStart(8),
    'recalcMs'.padStart(10),
    'frameMax'.padStart(9),
    'longMax'.padStart(9),
    'ramps'.padStart(7),
    'rules'.padStart(6),
  ].join('')
  console.log(header)
  console.log('-'.repeat(header.length))
  let worst = { value: 0, key: '' }
  for (const { config, run } of rows) {
    const { bursts, dom, settled } = run
    const passMax = bursts.map((burst) => burst.passMax)
    const passTotal = bursts.reduce((total, burst) => total + burst.passTotal, 0)
    const colours = bursts.reduce((total, burst) => total + burst.colours, 0)
    const colourMs = bursts.reduce((total, burst) => total + burst.colourMs, 0)
    const inserts = bursts.reduce((total, burst) => total + burst.inserts, 0)
    const insertMs = bursts.reduce((total, burst) => total + burst.insertMs, 0)
    const recalcs = bursts.reduce((total, burst) => total + burst.counters.RecalcStyleCount, 0)
    const recalcMs = bursts.reduce((total, burst) => total + burst.counters.RecalcStyleDuration, 0) * 1000
    const frameMax = Math.max(...bursts.map((burst) => burst.frameWorst))
    const longMax = Math.max(...bursts.map((burst) => burst.longMax))
    const ramps = Math.max(...bursts.map((burst) => burst.ramps))
    const median = [...passMax].sort((left, right) => left - right)[Math.floor(passMax.length / 2)]
    const most = Math.max(...passMax)
    if (most > worst.value) worst = { value: most, key: config.key }
    console.log([
      `${config.key}. ${config.label}`.padEnd(34).slice(0, 34),
      String(dom.documentElements).padStart(6),
      String(bursts[0].nodes).padStart(6),
      ms(most).padStart(9),
      ms(median).padStart(9),
      ms(passTotal).padStart(9),
      String(colours).padStart(8),
      ms(colourMs).padStart(10),
      String(inserts).padStart(8),
      ms(insertMs).padStart(8),
      String(recalcs).padStart(8),
      ms(recalcMs).padStart(10),
      ms(frameMax).padStart(9),
      ms(longMax).padStart(9),
      String(ramps).padStart(7),
      String(settled.inkRules).padStart(6),
    ].join(''))
  }
  return worst
}

async function main() {
  const client = await readFile(CLIENT_URL, 'utf8')
  /* Read the ink rule's highlight-name prefix out of the client under test: the page needs it
     to recognise the ink's own insertions, and a client that no longer names them the way this
     harness expects has to fail loudly rather than leave a gate watching nothing. */
  const prefix = /STREAM_INK_HIGHLIGHT_PREFIX\s*=\s*'([^']+)'/u.exec(client)
  if (prefix === null) {
    console.error('FAIL the client no longer defines STREAM_INK_HIGHLIGHT_PREFIX; the ink sheet cannot be watched')
    process.exitCode = 1
    return
  }
  const server = await startServer(client, prefix[1])
  const origin = `http://127.0.0.1:${server.address().port}`
  const browser = await launch({ port: CDP_PORT })
  const session = await attach(browser.endpoint)
  await session.send('Performance.enable')
  let failures = 0

  try {
    console.log(`browser: ${browser.browser}`)
    console.log(`client:  ${process.env.DCT_INK_CLIENT ?? new URL('../../lib/client.js', import.meta.url).pathname}`)
    console.log(`fixture: ${origin}  transcript ${ELEMENTS} elements, ${NODES} fresh text nodes per burst, ${BURSTS} measured burst(s)`)
    console.log(`gate:    one burst may pay ${GATE_RECALCS} style recalcs of the document, one pass may cost ${RECALC_ALLOWANCE} of this document's own (floor ${BUDGET_MS}ms, the live instrument's stall threshold), and the ink sheet may hold ${GATE_RULES} rule(s) once its ramps settle`)

    const rows = []
    for (const config of CONFIGS) {
      try {
        rows.push({ config, run: await runConfig(session, origin, config) })
      } catch (error) {
        failures += 1
        console.error(`\nFAIL ${config.key}: ${error.message}`)
        for (const line of session.diagnostics.slice(-8)) console.error(`  page> ${line}`)
      }
    }

    const worst = printTable('what one burst of fresh live text costs (each burst = one pass of the ink; passMax is tickStreamInk, frameMax is the worst rAF gap across the burst)', rows)

    /* The fixture's own price list: one forced recalculation of this document, and the
       read-after-write pair the pre-fix pass repeats once per node, beside the same reads
       with nothing written in front of them. Measured on the ink row's own page, which is
       still loaded, and used for the frame-cost gate below. */
    const probePage = rows.length > 0 ? rows[rows.length - 1] : null
    let oneRecalcMs = 0
    if (probePage !== null) {
      const recalc = await session.evaluate('window.__dctHarness.probeRecalc()')
      const pair = await session.evaluate('window.__dctHarness.probeRuleThenRead()')
      const batch = await session.evaluate('window.__dctHarness.probeReadsFirst()')
      const dom = probePage.run.dom
      oneRecalcMs = recalc.ms
      console.log(`\nthe fixture's price list (measured on the ${probePage.config.key} page, still loaded; the same shape as the pass, without the plugin)`)
      console.log(`  elements in the document                     ${dom.documentElements}`)
      console.log(`  one forced full recalc                        ${ms(recalc.ms)}   (colour read back: ${recalc.colour})`)
      console.log(`  insert a rule, then resolve a colour          ${ms(pair.ms / pair.pairs)} per pair  (${pair.pairs} pairs)`)
      console.log(`  resolve ${batch.pairs} colours with no write first   ${ms(batch.readMs / batch.pairs)} per colour (${ms(batch.readMs)} of ${ms(batch.ms)})`)
      console.log(`  so a pass that interleaves the two over ${NODES} nodes pays up to ${num((pair.ms / pair.pairs) * NODES)}ms of forced recalculation,`)
      console.log(`  and the same ${NODES} reads batched pay ${num(batch.readMs / batch.pairs * NODES)}ms.`)
    }

    /* The freeze question, as the live instrument asks it. Two gates, because the absolute
       milliseconds depend on the machine and the mechanism does not:
         - the pass may not pay a style recalculation per inked node. A fixed pass pays the
           one the frame was going to pay anyway plus the one its own rule writes leave for
           the frame's rendering; eight is a generous ceiling over that, and two orders of
           magnitude under the 190 the freeze was made of.
         - it may not cost more than {@link RECALC_ALLOWANCE} of this fixture's own forced
           recalculations, measured above on the same document in the same run — or
           {@link BUDGET_MS} when a recalculation here is cheaper than that. */
    const inkRow = rows.find(({ config }) => config.ink)
    if (inkRow === undefined) {
      failures += 1
      console.error('\nFAIL the ink row never ran, so the gate could not be applied')
    } else {
      const most = Math.max(...inkRow.run.bursts.map((burst) => burst.passMax))
      const frame = Math.max(...inkRow.run.bursts.map((burst) => burst.frameWorst))
      const recalcs = Math.max(...inkRow.run.bursts.map((burst) => burst.counters.RecalcStyleCount))
      const budget = Math.max(BUDGET_MS, RECALC_ALLOWANCE * oneRecalcMs)
      console.log(`\nverdict: the worst single ink pass with the writing ink on was ${ms(most)} (${worst.key}) over ${NODES} fresh nodes; ` +
        `the worst frame gap across a burst was ${ms(frame)}.`)
      console.log(`         style recalcs in that burst: ${recalcs} (gate ${GATE_RECALCS}); ` +
        `cost ${one((most / budget) * 100)}% of the ${ms(budget)} budget (${RECALC_ALLOWANCE} x this document's ${ms(oneRecalcMs)} recalculation, floor ${BUDGET_MS}ms).`)
      if (recalcs > GATE_RECALCS) {
        failures += 1
        console.error(`GATE FAILED  a burst of ${NODES} fresh nodes paid ${recalcs} style recalculations of the document, over the ${GATE_RECALCS} allowed: ` +
          'the pass is still reading colours between its stylesheet writes, which is what turns one pass into one recalculation per node.')
      }
      if (most > budget) {
        failures += 1
        console.error(`GATE FAILED  a single tickStreamInk pass took ${ms(most)}, over the ${ms(budget)} budget: ` +
          'one pass is a stall on its own, which is what the shell\'s pong deadline cannot survive.')
      }
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
