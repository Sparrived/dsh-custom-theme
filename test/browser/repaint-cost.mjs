/**
 * What one zone repaint costs the main thread, at transcript-sized DOMs.
 *
 * `lib/client.js` repaints every painted zone whenever the shell disconnects a surface a
 * picture was painted on (`watchPaintedZones`), and it does so synchronously inside the
 * MutationObserver callback — deliberately, so the replacement element is painted in the
 * frame the shell created it in. The pass is heavy on paper: `surfaceOf` walks the zone's
 * subtree with a 20 000-node budget reading `getBoundingClientRect` on every element,
 * `fullyCovered` samples an 81-point grid, `getComputedStyle` is read per covering
 * candidate, and `flushLayerRules` rewrites a stylesheet — all interleaved with the inline
 * writes of the previous zone, so each zone's walk can force a fresh layout of whatever the
 * previous zone dirtied.
 *
 * This harness asks how large that is when the transcript is a markdown-dense reply. It
 * builds a shell-shaped page with a synthetic transcript of roughly 2 000, 10 000 and
 * 30 000 elements, boots the plugin with a whole-window picture configured (the state the
 * user is in), and then performs the rebuild the shell performs when it swaps a column for
 * a fresh element — timing the synchronous repaint that follows, with the same rebuild and
 * no picture as the control.
 *
 * It is a measurement, not a gate: it prints a table and exits non-zero only when a
 * configuration throws, when the page reports a diagnostic, or when a sanity check proves
 * the fixture stopped exercising the path it claims to (a broken harness must not produce
 * numbers that look like a result).
 *
 * Usage:
 *   node test/browser/repaint-cost.mjs
 *
 * Environment:
 *   DCT_REPAINT_CDP_PORT  DevTools port for the throwaway browser (default 9412).
 *   DCT_REPAINT_RUNS      Rebuilds per configuration (default 5).
 *   DCT_REPAINT_SIZES     Comma-separated transcript element targets (default 2000,10000,30000).
 */

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { deflateSync } from 'node:zlib'

import { attach, launch } from './driver.mjs'

/** The browser half, served to the page as the shell's module system would. */
const CLIENT_URL = new URL('../../lib/client.js', import.meta.url)

/** DevTools port; off the suites' own 9400 and frame-cost's 9411. */
const CDP_PORT = Number(process.env.DCT_REPAINT_CDP_PORT ?? 9412)

/** Rebuilds per configuration; the pass is timed once per rebuild. */
const RUNS = Number(process.env.DCT_REPAINT_RUNS ?? 5)

/** Transcript element targets. */
const SIZES = (process.env.DCT_REPAINT_SIZES ?? '2000,10000,30000')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value > 0)

/** How long each streaming-reply row streams while the frame clock is recorded. */
const STREAM_MS = Number(process.env.DCT_REPAINT_STREAM_MS ?? 2000)

/**
 * What is disconnected, and therefore which painted surfaces the observer sees leave.
 *
 * `conversation` is the shell swapping the whole conversation half — the column, its
 * header and the composer seat — which is what opening a conversation does.
 * `composer` replaces only the composer seat inside a column that stays. `small` replaces
 * the three small painted surfaces and leaves the conversation column alone. `all` does
 * both halves in one task, so the observer callback sees several surfaces leave at once.
 */
const KINDS = [
  { key: 'conversation', label: 'the conversation column is swapped' },
  { key: 'composer', label: 'the composer seat alone is swapped' },
  { key: 'small', label: 'composer + sidebar + dock are swapped' },
  { key: 'all', label: 'the conversation half and both side columns are swapped' },
]

/**
 * The page.
 *
 * Shell-shaped and served over http on a loopback ephemeral port, for the same reasons
 * `frame-cost.mjs` does it: the plugin builds its picture URL relative to the page, and a
 * real navigation is the only clean start for a fresh document and stylesheet.
 *
 * The transcript is built by the page itself before the plugin boots, so the boot pass
 * walks the same DOM the measured pass does, and the rebuild under measurement re-parents
 * the transcript instead of recreating it — the measured span is then the plugin's pass,
 * not the fixture's own DOM churn, and the no-picture control performs the identical
 * operation.
 *
 * The page script is written without template literals or backslashes so it can be
 * embedded here without escaping rules getting in the way.
 */
const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>dsh-custom-theme repaint cost</title>
<style>
  html, body { margin: 0; height: 100%; }
  body { font: 14px/1.55 "Segoe UI", system-ui, sans-serif; color: #e6e6e6; background: #141419; overflow: hidden; }
  /* The shell's own shape: a frame holding a window bar and three columns, each column
     painted by a covering component root, which is the element the plugin's surface search
     is written to find. */
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
        <div class="scroller"><div class="turn" id="turn"></div></div>
        <div data-composer-seat><div class="Composer_surface"></div></div>
      </div>
    </div>
    <div data-rightbar-col><div class="Shell_dockSurface"></div></div>
  </div>
</div>
<script>window.__dctHarness = { ready: false, bootError: null, applied: false, controls: null, warnings: [], errors: [], spans: [], longTasks: [], frames: [], reads: 0, transcriptElements: 0, documentElements: 0 };</script>
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

  function readConfig() {
    var query = params();
    return {
      plugin: query.get('plugin') !== '0',
      picture: query.get('picture') === 'on',
      elements: Number(query.get('elements') || 2000),
    };
  }

  function seedStorage(config) {
    var backgrounds = {};
    for (var i = 0; i < ZONES.length; i++) {
      backgrounds[ZONES[i]] = { name: '', opacity: 0.18, panelOpacity: PANEL_OPACITY[ZONES[i]], blur: 0, size: 'cover', position: 'center' };
    }
    if (config.picture) {
      backgrounds.global = { name: PICTURE, opacity: 0.25, panelOpacity: 91, blur: 0, size: 'cover', position: 'center' };
    }
    var appearance = { lineGap: 0, fontFamily: '', codeFontFamily: '', /* 1 is the plugin's own off switch for the ink. */ streamingFadeInk: 1, streamingFadeDuration: 520, reasoningExpand: 'streaming' };
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

  /* Rendered markdown blocks, in the shapes a dense reply uses: headings, prose with
     inline code and emphasis, list items, a table, a quote and a fence. Every block is the
     same shape, so the element count is what the size knob moves. */
  var PROSE = 'A streaming reply commits one paragraph at a time, and every commit is a style recalculation plus a layout pass over the transcript. '
    + 'The picture pass walks the column it was painted on, which is the same subtree the reply is growing. '
    + 'A zone anchor is an outer layout box and the surface the user sees is a covering descendant of it. ';
  var CODE = 'const frames = new Set(); // a fence is never inked';
  var CELLS = ['p95 frame delta', '20 000 node budget'];

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

  /* One committed block of the reply: 18 elements, laid out like rendered markdown. */
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
    quote.appendChild(textEl('p', '', 'The blurred layer is re-rastered whenever the transcript repaints.'));
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

  /* ---- instrumentation ----------------------------------------------------- */

  /* Every MutationObserver callback the plugin installs, timed. The repaint runs inside
     the zone observer's callback and is synchronous, so this span is the pass. */
  var NativeObserver = window.MutationObserver;
  function TimedObserver(callback) {
    var wrapped = function (records, observer) {
      var started = performance.now();
      try {
        return callback.call(this, records, observer);
      } finally {
        harness.spans.push({ ms: performance.now() - started, records: records.length });
      }
    };
    return new NativeObserver(wrapped);
  }
  TimedObserver.prototype = NativeObserver.prototype;
  window.MutationObserver = TimedObserver;

  /* readSavedBackgrounds is what a repaint reads, so counting reads of that key counts
     repaints. The patch is on the prototype because localStorage denies expando writes
     to its named properties. */
  var nativeGetItem = Storage.prototype.getItem;
  Storage.prototype.getItem = function (key) {
    if (key === BACKGROUNDS_KEY) harness.reads += 1;
    return nativeGetItem.call(this, key);
  };

  if (typeof PerformanceObserver === 'function') {
    try {
      new PerformanceObserver(function (list) {
        var entries = list.getEntries();
        for (var i = 0; i < entries.length; i++) harness.longTasks.push({ startTime: entries[i].startTime, duration: entries[i].duration });
      }).observe({ entryTypes: ['longtask'] });
    } catch (error) {
      harness.errors.push('longtask observer unavailable: ' + error.message);
    }
  }

  var frameClock = { last: performance.now(), deltas: [] };
  function tick(now) {
    frameClock.deltas.push({ at: now, delta: now - frameClock.last });
    frameClock.last = now;
    window.requestAnimationFrame(tick);
  }
  window.requestAnimationFrame(tick);

  function worstFrame(from, to) {
    var worst = 0;
    for (var i = 0; i < frameClock.deltas.length; i++) {
      var entry = frameClock.deltas[i];
      if (entry.at >= from && entry.at <= to + 40 && entry.delta > worst) worst = entry.delta;
    }
    return worst;
  }

  /* ---- what the shell does to a painted surface ----------------------------- */

  function buildSeat() {
    var seat = document.createElement('div');
    seat.setAttribute('data-composer-seat', '');
    var composer = document.createElement('div');
    composer.className = 'Composer_surface';
    seat.appendChild(composer);
    return seat;
  }

  function buildColumn(transcript) {
    var column = document.createElement('div');
    column.className = 'Shell_centerCol';
    var surface = document.createElement('div');
    surface.className = 'Shell_centerSurface';
    var header = document.createElement('div');
    header.className = 'Shell_centerHeader';
    var title = document.createElement('span');
    title.className = 'Shell_titleRow';
    title.appendChild(document.createTextNode('Conversation'));
    header.appendChild(title);
    var scroller = document.createElement('div');
    scroller.className = 'scroller';
    /* The transcript moves with the column rather than being rebuilt, so the measured span
       is the plugin's pass and not the fixture's own DOM work. */
    scroller.appendChild(transcript);
    surface.appendChild(header);
    surface.appendChild(scroller);
    surface.appendChild(buildSeat());
    column.appendChild(surface);
    return column;
  }

  function rebuildConversation() {
    var column = document.querySelector('[class*="_centerCol"]');
    var transcript = document.getElementById('turn');
    column.parentElement.replaceChild(buildColumn(transcript), column);
  }

  function rebuildComposer() {
    var seat = document.querySelector('[data-composer-seat]');
    seat.parentElement.replaceChild(buildSeat(), seat);
  }

  function rebuildSidebar() {
    var column = document.querySelector('[class*="_sidebarCol"]');
    var fresh = document.createElement('div');
    fresh.className = 'Shell_sidebarCol';
    var surface = document.createElement('div');
    surface.className = 'Shell_sidebarSurface';
    fresh.appendChild(surface);
    column.parentElement.replaceChild(fresh, column);
  }

  function rebuildDock() {
    var column = document.querySelector('[data-rightbar-col]');
    var fresh = document.createElement('div');
    fresh.setAttribute('data-rightbar-col', '');
    var surface = document.createElement('div');
    surface.className = 'Shell_dockSurface';
    fresh.appendChild(surface);
    column.parentElement.replaceChild(fresh, column);
  }

  harness.rebuild = function (kind) {
    if (kind === 'conversation') return rebuildConversation();
    if (kind === 'composer') return rebuildComposer();
    if (kind === 'all') {
      rebuildConversation();
      rebuildComposer();
      rebuildSidebar();
      rebuildDock();
      return;
    }
    if (kind === 'small') {
      rebuildComposer();
      rebuildSidebar();
      rebuildDock();
      return;
    }
    throw new Error('unknown rebuild kind: ' + kind);
  };

  /* ---- measuring ----------------------------------------------------------- */

  /* One rebuild, and the synchronous work the plugin does in response to it.
     The observer callback is a microtask queued by the mutation itself, so the
     continuation below runs after the pass has finished. Two macrotask turns then give
     the PerformanceObserver its delivery turn before the entries are read. */
  harness.repaint = function (kind) {
    return new Promise(function (resolve) {
      var spanMark = harness.spans.length;
      var readMark = harness.reads;
      var durations = [];
      var observer = null;
      try {
        observer = new PerformanceObserver(function (list) {
          var entries = list.getEntries();
          for (var i = 0; i < entries.length; i++) durations.push(entries[i].duration);
        });
        observer.observe({ entryTypes: ['longtask'] });
      } catch (error) {
        harness.errors.push('per-run longtask observer unavailable: ' + error.message);
      }
      var t0 = performance.now();
      harness.rebuild(kind);
      var tDom = performance.now();
      Promise.resolve().then(function () {
        var tMicro = performance.now();
        window.setTimeout(function () {
          window.setTimeout(function () {
            var tEnd = performance.now();
            if (observer !== null) observer.disconnect();
            var spans = harness.spans.slice(spanMark);
            resolve({
              kind: kind,
              domMs: tDom - t0,
              callbackMs: tMicro - tDom,
              totalMs: tEnd - t0,
              spans: spans.map(function (entry) { return entry.ms }),
              spanRecords: spans.map(function (entry) { return entry.records }),
              reads: harness.reads - readMark,
              longTasks: durations,
              frameWorst: worstFrame(t0, tEnd),
            });
          }, 0);
        }, 0);
      });
    });
  };

  /* The plugin's surfaceOf walk, re-implemented here so its cost can be timed from
     outside the plugin. It is the same budget, the same geometry test and the same
     traversal order. */
  function surfaceWalk(anchor) {
    var anchorRect = anchor.getBoundingClientRect();
    var reads = 0;
    var visited = 0;
    function covers(rect) {
      reads += 1;
      return rect.width >= anchorRect.width - 1 && rect.height >= anchorRect.height - 1
        && rect.left <= anchorRect.left + 1 && rect.top <= anchorRect.top + 1
        && rect.right >= anchorRect.right - 1 && rect.bottom >= anchorRect.bottom - 1;
    }
    var budget = 20000;
    var walk = function (element) {
      for (var index = 0; index < element.children.length; index++) {
        if (budget-- <= 0) return;
        visited += 1;
        var child = element.children[index];
        covers(child.getBoundingClientRect());
        walk(child);
      }
    };
    walk(anchor);
    return { reads: reads, visited: visited };
  }

  harness.probeWalk = function () {
    var anchor = document.querySelector('[class*="_centerCol"]');
    var t0 = performance.now();
    var out = surfaceWalk(anchor);
    out.ms = performance.now() - t0;
    return out;
  };

  /* The same walk the moment a zone's own inline properties have been rewritten, which is
     the state the pass leaves behind for the next zone's walk. */
  harness.probeWalkAfterWrite = function () {
    var anchor = document.querySelector('[class*="_centerCol"]');
    var surface = anchor.querySelector('[class*="_centerSurface"]');
    surface.style.removeProperty('position');
    surface.style.removeProperty('background-color');
    surface.style.removeProperty('isolation');
    surface.style.setProperty('position', 'relative', 'important');
    surface.style.setProperty('isolation', 'isolate', 'important');
    var t0 = performance.now();
    var out = surfaceWalk(anchor);
    out.ms = performance.now() - t0;
    return out;
  };

  /* The plugin's fullyCovered, re-implemented: an 81-point grid against the other zones. */
  harness.probeCoverage = function () {
    var anchor = document.querySelector('[class*="_frame"]');
    var others = ['header', '[class*="_sidebarCol"]', '[class*="_centerCol"]', '[data-composer-seat]', '[data-rightbar-col]']
      .map(function (selector) { return document.querySelector(selector) });
    var t0 = performance.now();
    var rect = anchor.getBoundingClientRect();
    var boxes = others.filter(function (element) { return element !== null && element !== undefined })
      .map(function (element) { return element.getBoundingClientRect() });
    var steps = 8;
    var covered = true;
    for (var column = 0; column <= steps && covered; column++) {
      for (var row = 0; row <= steps && covered; row++) {
        var x = rect.left + (rect.width * column) / steps;
        var y = rect.top + (rect.height * row) / steps;
        var inside = false;
        for (var index = 0; index < boxes.length; index++) {
          var box = boxes[index];
          if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) { inside = true; break }
        }
        if (!inside) covered = false;
      }
    }
    return { ms: performance.now() - t0, covered: covered, boxes: boxes.length, points: (steps + 1) * (steps + 1) };
  };

  /* The shell's own rebuild, split into its DOM work and the layout that work forces. Run
     on a page with no picture there is no observer, so this is the rebuild and nothing
     else: the floor the plugin's pass adds to, and the layout the pass would otherwise
     leave to the rendering step of the same frame. */
  harness.probeRebuild = function (kind) {
    var t0 = performance.now();
    harness.rebuild(kind);
    var tBuilt = performance.now();
    /* Reading the new column's height is what forces the layout the rebuild dirtied. */
    var height = document.querySelector('[class*="_centerCol"]').offsetHeight;
    var tLaid = performance.now();
    return { buildMs: tBuilt - t0, layoutMs: tLaid - tBuilt, height: height };
  };

  /* The layer sheet rewritten, and the style recalculation it forces: the pass's own
     stylesheet work, priced apart from the walk. */
  harness.probeSheetRewrite = function () {
    var style = document.querySelector('style[data-role="background-layer"]');
    if (style === null) return { ms: 0, chars: 0, rules: 0 };
    var text = style.textContent;
    var probe = document.querySelector('.blk');
    var t0 = performance.now();
    style.textContent = text;
    var color = probe === null ? '' : window.getComputedStyle(probe).color;
    return { ms: performance.now() - t0, chars: text.length, rules: text.split('}').length - 1, color: color };
  };

  /* A streaming reply: the shell commits one markdown block at a time into the transcript.
     This asks the question the freeze turns on — whether a dense stream ever disconnects a
     painted surface, and so ever runs the repaint pass at all — and reads back the frame
     clock and the long tasks while it does. */
  harness.stream = function (options) {
    var wanted = options || {};
    var lengthMs = wanted.ms === undefined ? 2000 : wanted.ms;
    var blockMs = wanted.blockMs === undefined ? 16 : wanted.blockMs;
    return new Promise(function (resolve) {
      var readMark = harness.reads;
      var spanMark = harness.spans.length;
      var durations = [];
      var observer = null;
      try {
        observer = new PerformanceObserver(function (list) {
          var entries = list.getEntries();
          for (var i = 0; i < entries.length; i++) durations.push(entries[i].duration);
        });
        observer.observe({ entryTypes: ['longtask'] });
      } catch (error) {
        harness.errors.push('stream longtask observer unavailable: ' + error.message);
      }
      var target = document.getElementById('turn');
      var started = performance.now();
      var beforeElements = target.querySelectorAll('*').length;
      var added = 0;
      function finish(now) {
        if (observer !== null) observer.disconnect();
        resolve({
          blocks: added,
          elements: target.querySelectorAll('*').length - beforeElements,
          ms: now - started,
          reads: harness.reads - readMark,
          spans: harness.spans.slice(spanMark).map(function (entry) { return entry.ms }),
          longTasks: durations,
          frameWorst: worstFrame(started, now),
        });
      }
      function step() {
        if (performance.now() - started >= lengthMs) {
          finish(performance.now());
          return;
        }
        target.appendChild(buildBlock(100000 + added));
        added += 1;
        window.setTimeout(step, blockMs);
      }
      window.setTimeout(step, blockMs);
    });
  };

  harness.dom = function () {
    return {
      transcriptElements: document.getElementById('turn').querySelectorAll('*').length,
      documentElements: document.body.querySelectorAll('*').length,
      zones: document.querySelectorAll('[data-dct-zone]').length,
      layers: document.querySelectorAll('[data-dct-layer]').length,
      zoneNames: Array.prototype.map.call(document.querySelectorAll('[data-dct-zone]'), function (node) { return node.getAttribute('data-dct-zone') }).join(','),
      layerCss: (function () {
        var style = document.querySelector('style[data-role="background-layer"]');
        return style === null ? '' : style.textContent;
      })(),
    };
  };

  /* ---- boot ---------------------------------------------------------------- */

  function boot() {
    try {
      var config = readConfig();
      harness.controls = config;
      harness.storage = seedStorage(config);
      harness.transcriptElements = fillTranscript(document.getElementById('turn'), config.elements);
      harness.documentElements = document.body.querySelectorAll('*').length;
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
 * Encode a small gradient PNG, so the page has a real raster picture behind the layers.
 *
 * A one-pixel image would let the renderer skip most of the work, and a data URI cannot be
 * used: the plugin builds the `background-image` URL itself, so the bytes have to be served
 * at the path it asks for.
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

/** Median of a list of numbers; 0 for an empty list. */
function median(values) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

const ms = (value) => `${value.toFixed(1)}ms`
const num = (value) => String(Math.round(value))

/**
 * Fail when the page reported anything since `mark`.
 * @param session - Driver session.
 * @param mark - `session.diagnostics.length` taken before the step.
 * @param label - What was running, for the message.
 */
function assertQuiet(session, mark, label) {
  const fresh = session.diagnostics.slice(mark)
  if (fresh.length > 0) throw new Error(`${label} reported ${fresh.length} diagnostic(s): ${fresh.join(' | ')}`)
}

/**
 * Run one configuration in a freshly navigated page: rebuild the named surface `RUNS`
 * times with a picture configured, and read back what each rebuild cost.
 * @param session - Driver session.
 * @param origin - Fixture origin.
 * @param row - `{ size, kind, picture }`.
 * @returns The per-rebuild measurements plus the page's own sanity numbers.
 */
async function runRow(session, origin, row) {
  const query = new URLSearchParams({
    plugin: '1',
    picture: row.picture ? 'on' : 'off',
    elements: String(row.size),
  })
  const before = session.diagnostics.length
  await session.navigate(`${origin}/?${query.toString()}`)
  await session.waitFor('window.__dctHarness && window.__dctHarness.ready === true', {
    timeout: 30_000,
    label: `the fixture at ?${query.toString()} to boot`,
  })

  const bootError = await session.evaluate('window.__dctHarness.bootError')
  if (bootError) throw new Error(`the plugin threw while booting: ${bootError}`)
  const applied = await session.evaluate('window.__dctHarness.applied')
  if (applied !== true) throw new Error('the plugin was not applied')
  const warnings = await session.evaluate('window.__dctHarness.warnings')
  if (warnings.length > 0) throw new Error(`the plugin warned: ${warnings.join(' | ')}`)

  const dom = await session.evaluate('window.__dctHarness.dom()')
  if (row.picture && dom.zones < 4) throw new Error(`a whole-window picture was configured, but only ${dom.zones} zone(s) were claimed (${dom.zoneNames})`)
  if (row.picture && !dom.zoneNames.split(',').includes('conversation')) throw new Error(`the conversation zone was not painted: ${dom.zoneNames}`)
  if (row.picture && !dom.layerCss.includes('background-image')) throw new Error('the layer sheet carries no picture')
  if (!row.picture && dom.zones !== 0) throw new Error(`no picture was configured, but ${dom.zones} zone(s) were claimed`)
  if (dom.transcriptElements < row.size) throw new Error(`the transcript is ${dom.transcriptElements} elements, below the ${row.size} asked for`)

  const runs = []
  for (let index = 0; index < RUNS; index += 1) {
    const measured = await session.evaluate(`window.__dctHarness.repaint(${JSON.stringify(row.kind)})`)
    runs.push(measured)
  }
  const after = await session.evaluate('window.__dctHarness.dom()')
  if (after.zones !== dom.zones) throw new Error(`the pass left ${after.zones} painted zone(s), not ${dom.zones}`)
  const errors = await session.evaluate('window.__dctHarness.errors')
  if (errors.length > 0) throw new Error(`the page reported: ${errors.join(' | ')}`)

  assertQuiet(session, before, `${row.size}/${row.kind}`)

  return { runs, dom, after }
}

/**
 * Print one row's numbers.
 * @param row - The configuration.
 * @param run - The `runRow` result.
 */
function printRow(row, run) {
  const { runs } = run
  const callback = runs.map((entry) => entry.callbackMs)
  const total = runs.map((entry) => entry.totalMs)
  const dom = runs.map((entry) => entry.domMs)
  const frames = runs.map((entry) => entry.frameWorst)
  const longTasks = runs.flatMap((entry) => entry.longTasks)
  const reads = runs.map((entry) => entry.reads)
  console.log([
    String(row.size).padStart(6),
    row.kind.padEnd(14),
    (row.picture ? 'on' : 'off').padStart(4),
    num(median(dom)).padStart(8),
    num(median(callback)).padStart(9),
    num(Math.max(...callback)).padStart(9),
    num(median(total)).padStart(9),
    num(Math.max(...total)).padStart(9),
    num(Math.min(...reads)).padStart(7),
    String(longTasks.length).padStart(6),
    num(longTasks.length === 0 ? 0 : Math.max(...longTasks)).padStart(9),
    num(median(frames)).padStart(11),
    num(Math.max(...frames)).padStart(9),
  ].join(''))
}

/**
 * Print the cross-check probes for one size.
 * @param size - Transcript element target.
 * @param probes - `{ walk, dirtyWalk, coverage, sheet }`.
 */
function printProbe(size, probes) {
  console.log([
    String(size).padStart(6),
    num(probes.walk.ms).padStart(10),
    num(probes.walk.reads).padStart(11),
    num(probes.walk.visited).padStart(13),
    num(probes.dirtyWalk.ms).padStart(13),
    num(probes.dirtyWalk.reads).padStart(14),
    num(probes.coverage.ms * 1000).padStart(14),
    String(probes.coverage.boxes).padStart(7),
    String(probes.coverage.covered).padStart(8),
    num(probes.sheet.ms).padStart(11),
    String(probes.sheet.rules).padStart(7),
    num(probes.sheet.chars).padStart(8),
  ].join(''))
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
    console.log(`fixture: ${origin}  ${RUNS} rebuild(s) per configuration, sizes ${SIZES.join(', ')}`)

    const header = [
      '  size'.padStart(6),
      'kind'.padEnd(14),
      ' pic'.padStart(4),
      'domMs'.padStart(8),
      'cbMed'.padStart(9),
      'cbMax'.padStart(9),
      'totMed'.padStart(9),
      'totMax'.padStart(9),
      'reads'.padStart(7),
      'long'.padStart(6),
      'longMax'.padStart(9),
      'frameMed'.padStart(11),
      'frameMax'.padStart(9),
    ].join('')
    console.log('\nwhat one painted-surface disconnect costs (the callback is the plugin repaint, timed inside the MutationObserver)')
    console.log(header)
    console.log('-'.repeat(header.length))

    const domBySize = new Map()
    const medians = new Map()

    for (const size of SIZES) {
      for (const kind of KINDS) {
        for (const pictureOn of [true, false]) {
          const row = { size, kind: kind.key, picture: pictureOn }
          try {
            const run = await runRow(session, origin, row)
            printRow(row, run)
            if (pictureOn) domBySize.set(size, run.dom)
            medians.set(`${size}/${kind.key}/${pictureOn ? 'on' : 'off'}`, {
              total: median(run.runs.map((entry) => entry.totalMs)),
              callback: median(run.runs.map((entry) => entry.callbackMs)),
              longestSpan: Math.max(...run.runs.flatMap((entry) => entry.spans.concat([0]))),
              reads: median(run.runs.map((entry) => entry.reads)),
            })
          } catch (error) {
            failures += 1
            console.error(`\nFAIL ${size}/${kind.key}/${pictureOn ? 'on' : 'off'}: ${error.message}`)
          }
        }
      }
    }

    /* The scripted parts, timed from outside the plugin, in one fresh page per size so the
       probes do not run against a DOM a previous probe already dirtied. */
    const probeHeader = [
      '  size'.padStart(6),
      'walkMs'.padStart(10),
      'walkRects'.padStart(11),
      'walkVisited'.padStart(13),
      'dirtyWalkMs'.padStart(13),
      'dirtyRects'.padStart(14),
      'coverageUs'.padStart(14),
      'boxes'.padStart(7),
      'covered'.padStart(8),
      'sheetMs'.padStart(11),
      'rules'.padStart(7),
      'sheetChars'.padStart(11),
    ].join('')
    console.log('\nthe scripted parts, re-implemented and timed from outside the plugin (one run each)')
    console.log(probeHeader)
    console.log('-'.repeat(probeHeader.length))
    for (const size of SIZES) {
      try {
        const query = new URLSearchParams({ plugin: '1', picture: 'on', elements: String(size) })
        const mark = session.diagnostics.length
        await session.navigate(`${origin}/?${query.toString()}`)
        await session.waitFor('window.__dctHarness && window.__dctHarness.ready === true', { timeout: 30_000, label: `the fixture at ?${query.toString()}` })
        const walk = await session.evaluate('window.__dctHarness.probeWalk()')
        const dirtyWalk = await session.evaluate('window.__dctHarness.probeWalkAfterWrite()')
        const coverage = await session.evaluate('window.__dctHarness.probeCoverage()')
        const sheet = await session.evaluate('window.__dctHarness.probeSheetRewrite()')
        assertQuiet(session, mark, `the probe page at ?${query.toString()}`)
        printProbe(size, { walk, dirtyWalk, coverage, sheet })
      } catch (error) {
        failures += 1
        console.error(`\nFAIL probe ${size}: ${error.message}`)
      }
    }

    /* What the rebuild costs with no picture painted, and so no observer installed: the
       DOM work, and the layout that work forces. This is the part of the measured callback
       the plugin did not cause and cannot avoid — the same layout lands in the same frame
       either way. */
    const rebuildHeader = [
      '  size'.padStart(6),
      'kind'.padEnd(14),
      'buildMs'.padStart(9),
      'layoutMs'.padStart(10),
      'sumMs'.padStart(8),
    ].join('')
    console.log('\nthe same rebuild with no picture painted at all: the shell\'s own DOM work and the layout it forces')
    console.log(rebuildHeader)
    console.log('-'.repeat(rebuildHeader.length))
    for (const size of SIZES) {
      try {
        const query = new URLSearchParams({ plugin: '1', picture: 'off', elements: String(size) })
        const mark = session.diagnostics.length
        await session.navigate(`${origin}/?${query.toString()}`)
        await session.waitFor('window.__dctHarness && window.__dctHarness.ready === true', { timeout: 30_000, label: `the fixture at ?${query.toString()}` })
        for (const kind of KINDS) {
          const probe = await session.evaluate(`window.__dctHarness.probeRebuild(${JSON.stringify(kind.key)})`)
          console.log([
            String(size).padStart(6),
            kind.key.padEnd(14),
            num(probe.buildMs).padStart(9),
            num(probe.layoutMs).padStart(10),
            num(probe.buildMs + probe.layoutMs).padStart(8),
          ].join(''))
        }
        assertQuiet(session, mark, `the rebuild page at ?${query.toString()}`)
      } catch (error) {
        failures += 1
        console.error(`\nFAIL rebuild probe ${size}: ${error.message}`)
      }
    }

    /* Whether a dense stream reaches this path at all. The observer returns early unless a
       painted surface was disconnected, so a stream that only appends committed blocks
       should run no pass and read the store zero times. */
    const streamHeader = [
      '  size'.padStart(6),
      ' pic'.padStart(4),
      'blocks'.padStart(7),
      'added'.padStart(6),
      'repaints'.padStart(9),
      'cbTotal'.padStart(8),
      'long'.padStart(6),
      'longMax'.padStart(9),
      'frameMax'.padStart(9),
      'streamMs'.padStart(9),
    ].join('')
    console.log(`\na dense streaming reply (${STREAM_MS}ms, one committed block every 16ms): does it ever run the repaint pass?`)
    console.log(streamHeader)
    console.log('-'.repeat(streamHeader.length))
    for (const size of SIZES) {
      for (const pictureOn of [true, false]) {
        try {
          const query = new URLSearchParams({ plugin: '1', picture: pictureOn ? 'on' : 'off', elements: String(size) })
          const mark = session.diagnostics.length
          await session.navigate(`${origin}/?${query.toString()}`)
          await session.waitFor('window.__dctHarness && window.__dctHarness.ready === true', { timeout: 30_000, label: `the fixture at ?${query.toString()}` })
          const result = await session.evaluate(`window.__dctHarness.stream({ ms: ${STREAM_MS} })`)
          assertQuiet(session, mark, `the stream page at ?${query.toString()}`)
          if (pictureOn && result.reads !== 0) throw new Error(`a streaming reply ran ${result.reads} repaint pass(es)`)
          if (pictureOn) {
            const painted = await session.evaluate('window.__dctHarness.dom()')
            if (painted.zones < 4) throw new Error(`the picture stopped being painted while the reply streamed: ${painted.zones} zone(s)`)
          }
          console.log([
            String(size).padStart(6),
            (pictureOn ? 'on' : 'off').padStart(4),
            String(result.blocks).padStart(7),
            String(result.elements).padStart(6),
            String(result.reads).padStart(9),
            num(result.spans.reduce((total, value) => total + value, 0)).padStart(8),
            String(result.longTasks.length).padStart(6),
            num(result.longTasks.length === 0 ? 0 : Math.max(...result.longTasks)).padStart(9),
            num(result.frameWorst).padStart(9),
            num(result.ms).padStart(9),
          ].join(''))
        } catch (error) {
          failures += 1
          console.error(`\nFAIL stream ${size}/${pictureOn ? 'on' : 'off'}: ${error.message}`)
        }
      }
    }

    console.log('\nthe DOM each size actually built')
    for (const [size, dom] of domBySize) {
      console.log(`  target ${String(size).padStart(6)}: ${String(dom.transcriptElements).padStart(6)} transcript elements, ${String(dom.documentElements).padStart(6)} document elements, ${dom.zones} painted zone(s) [${dom.zoneNames}]`)
    }

    console.log('\nthe pass, with a picture minus the same rebuild with no picture')
    for (const size of SIZES) {
      const parts = []
      for (const kind of KINDS) {
        const on = medians.get(`${size}/${kind.key}/on`)
        const off = medians.get(`${size}/${kind.key}/off`)
        if (on === undefined || off === undefined) continue
        const delta = on.total - off.total
        parts.push(`${kind.key} ${num(delta)}ms (${on.callback.toFixed(1)}ms in the callback, longest span ${num(on.longestSpan)}ms, ${num(on.reads)} store read(s))`)
      }
      console.log(`  ${size}: ${parts.join(' | ')}`)
    }

    /* The one number the freeze question needs: the most expensive single synchronous pass
       measured, against the 4-6 s the Host tolerates before it drops the socket. */
    let worst = { value: 0, key: '' }
    for (const [key, entry] of medians) {
      if (!key.endsWith('/on')) continue
      if (entry.longestSpan > worst.value) worst = { value: entry.longestSpan, key }
    }
    const budget = 5000
    console.log(`\nverdict: the most expensive single synchronous pass measured was ${num(worst.value)}ms (${worst.key || 'none'}), ` +
      `${(worst.value / budget * 100).toFixed(2)}% of a ${budget}ms block. ` +
      'A pass would have to be thousands of milliseconds to explain a 4-6s stall on its own.')
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
