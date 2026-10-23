/**
 * Real-browser smoke test for the Appearance card.
 *
 * Boots a headless Chromium browser against a running `dsh web` instance, opens
 * Settings → General, and drives the card the way a user does: it reads the
 * theme list from the Host route, applies a theme, and asserts that the rendered
 * page actually repaints. Node's own test runner cannot see any of this: the
 * cascade that makes a theme visible only exists once a real engine has resolved
 * the shell stylesheet.
 *
 * Usage:
 *   dsh --profile <name> --patch dev.overlay.yml --no-open
 *   set DCT_TOKEN=<token from the printed URL>
 *   node test/browser/appearance.mjs
 *
 * Exits non-zero on the first failed assertion.
 */

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { attach, delay, launch } from './driver.mjs'

const BASE = process.env.DCT_BASE ?? 'http://127.0.0.1:3080'
const TOKEN = process.env.DCT_TOKEN
const SHOT_DIR = process.env.DCT_SHOT_DIR ?? fileURLToPath(new URL('../../', import.meta.url))
const PORT = Number(process.env.DCT_CDP_PORT ?? 9400)

if (!TOKEN) {
  console.error('DCT_TOKEN is required: copy it from the "dsh web: http://…/?token=…" line.')
  process.exit(2)
}

/** Read one custom-property value out of a bundled theme file, per palette. */
async function themeToken(id, token, scheme = 'light') {
  // Comments are stripped first: the files mention `[data-theme="dark"]` in their
  // header prose, which would otherwise be found ahead of the real selector.
  const css = (await readFile(fileURLToPath(new URL(`../../themes/${id}.css`, import.meta.url)), 'utf8'))
    .replace(/\/\*[\s\S]*?\*\//gu, '')
  const split = css.indexOf('[data-theme="dark"]')
  if (split === -1) throw new Error(`${id}.css declares no dark palette`)
  const region = scheme === 'dark' ? css.slice(split) : css.slice(0, split)
  const match = new RegExp(`${token}\\s*:\\s*([^;!]+)`, 'u').exec(region)
  if (match === null) throw new Error(`${id}.css does not declare ${token} in its ${scheme} palette`)
  return match[1].trim()
}

/** `#rrggbb` or `#rgb` to the `rgb(r, g, b)` form `getComputedStyle` reports. */
function toRgb(hex) {
  const digits = hex.replace('#', '')
  const full = digits.length === 3 ? [...digits].map((d) => d + d).join('') : digits
  const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16))
  return `rgb(${r}, ${g}, ${b})`
}

/** Everything the assertions read, in one round trip. */
const probe = `(() => {
  const root = getComputedStyle(document.documentElement);
  const body = getComputedStyle(document.body);
  return {
    rootBgBase: root.getPropertyValue('--dsw-alias-bg-base').trim(),
    bodyBgBase: body.getPropertyValue('--dsw-alias-bg-base').trim(),
    bodyColor: body.backgroundColor,
    themeStyleBytes: (document.querySelector('style[data-plugin="dsh-custom-theme"][data-role="theme"]')?.textContent ?? '').length,
    saved: localStorage.getItem('dsh-custom-theme.selected'),
    options: [...document.querySelectorAll('.dct-select option')].map((o) => o.value),
    appearanceCss: document.querySelector('style[data-plugin="dsh-custom-theme"][data-role="appearance"]')?.textContent ?? '',
    savedAppearance: localStorage.getItem('dsh-custom-theme.appearance'),
    /**
     * Resolves the shell's own content line height — \`calc(24px + delta)\` — the
     * way every message surface does, so a delta override is measured as the used
     * px value rather than as an unevaluated \`calc()\` token.
     */
    lineHeightProbe: (() => {
      const el = document.createElement('div');
      el.style.position = 'absolute';
      el.style.visibility = 'hidden';
      el.style.lineHeight = 'calc(24px + var(--dsh-content-font-delta, 0px))';
      el.textContent = 'x';
      document.body.appendChild(el);
      const value = getComputedStyle(el).lineHeight;
      el.remove();
      return value;
    })(),
    styleTags: document.querySelectorAll('style[data-plugin="dsh-custom-theme"]').length,
  };
})()`

const PANEL = `document.body.innerText.includes('通用设置')`
/** Nav label of the plugin's own settings page, as the zh dictionary spells it. */
const NAV_LABEL = '主题与背景'
const EXPECTED_OPTIONS = ['', 'gov', 'monokai-pro', 'one-dark', 'claude']
const BACKGROUND_NAME = process.env.DCT_BACKGROUND ?? 'test-gradient.png'
const STRIPES_NAME = process.env.DCT_BACKGROUND_ALT ?? 'test-stripes.png'
/** A PNG signature: the only part of an upload the Host takes on trust. */
const PNG_BYTES = [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]
/** Bytes carrying no image signature at all, for the refusal step. */
const NOT_A_PICTURE = [...Buffer.from('this is not a picture')]

/**
 * Expression that yields the option list only once it matches the Host listing.
 *
 * Comparing inside the polled expression, rather than reading after a separate
 * wait, keeps a read from landing on the empty first render of a re-mounted card.
 */
const OPTIONS_SETTLED = `(() => {
  const values = [...document.querySelectorAll('.dct-theme option')].map((o) => o.value);
  return JSON.stringify(values) === ${JSON.stringify(JSON.stringify(EXPECTED_OPTIONS))} ? values : false;
})()`
const CARD_READY = `${PANEL} && Boolean(${OPTIONS_SETTLED})`

/**
 * Everything the background assertions read.
 *
 * The picture lives on a `::before` layer of the tagged surface rather than on the
 * element itself, so each zone resolves to that layer: `image`, `size`, `position`,
 * `filter` and `opacity` are the layer's, while `computed` and `isolation` belong
 * to the surface that carries it. `selfImage` is the surface's own
 * `background-image`, which the layer rewrite must leave alone — except in the one
 * flat zone, whose element the shell renders its own popovers in: there the picture
 * is on the surface's own background by design and the layer fields stay empty, so
 * `selfImage`, `selfSize`, `selfPosition` and `selfAttachment` are what its
 * assertions read. `layerTag` is the generated layer attribute, absent for that
 * zone. `painted` says whether this plugin tagged the zone at all, and `visible[0]`
 * is the first background a user actually meets under the cursor, read through both
 * the elements and their layers — which is what proves the layer is still on screen.
 */
const bgProbe = `(() => {
  const zones = {
    global: '[class*="_frame"]',
    windowbar: 'header',
    sidebar: '[class*="_sidebarCol"]',
    conversation: '[class*="_centerCol"]',
    composer: '[data-composer-seat]',
    dock: '[data-rightbar-col]',
  };
  const read = (element) => {
    if (element === null) return null;
    const self = getComputedStyle(element);
    const layer = getComputedStyle(element, '::before');
    return {
      image: layer.backgroundImage,
      size: layer.backgroundSize,
      position: layer.backgroundPosition,
      attachment: layer.backgroundAttachment,
      filter: layer.filter,
      opacity: layer.opacity,
      zIndex: layer.zIndex,
      selfImage: self.backgroundImage,
      selfSize: self.backgroundSize,
      selfPosition: self.backgroundPosition,
      selfAttachment: self.backgroundAttachment,
      computed: self.backgroundColor,
      isolation: self.isolation,
      position_: self.position,
      layerTag: element.getAttribute('data-dct-layer'),
      className: element.className,
    };
  };
  const visible = (selector, fx, fy) => {
    const anchor = document.querySelector(selector);
    if (anchor === null) return null;
    const rect = anchor.getBoundingClientRect();
    const start = document.elementFromPoint(rect.left + rect.width * fx, rect.top + rect.height * fy);
    const chain = [];
    for (let node = start; node !== null; node = node.parentElement) {
      const image = getComputedStyle(node).backgroundImage;
      const layer = getComputedStyle(node, '::before').backgroundImage;
      if (image !== 'none') chain.push({ className: node.className, image });
      if (layer !== 'none') chain.push({ className: node.className + '::before', image: layer });
    }
    return chain;
  };
  const out = {};
  for (const [name, selector] of Object.entries(zones)) {
    const tagged = document.querySelector('[data-dct-zone="' + name + '"]');
    const entry = read(tagged);
    // Sample points avoid the settings dialog, which covers the middle of the window.
    const spot = name === 'global' ? [0.02, 0.5] : name === 'conversation' ? [0.92, 0.3] : [0.5, 0.5];
    // A zone the plugin deliberately leaves unpainted — a frame the columns cover
    // completely — has no tagged element, but something still paints there, so the
    // visibility sample is taken whether or not this plugin owns the element.
    out[name] = entry === null
      ? { painted: false, visible: visible(selector, spot[0], spot[1]) }
      : {
          ...entry,
          painted: true,
          tint: tagged.getAttribute('data-dct-tint'),
          // Whether the zone's own anchor is the element that got painted.
          anchorIsPainted: tagged === document.querySelector(selector),
          visible: visible(selector, spot[0], spot[1]),
        };
  }
  // The surface must no longer carry the picture inline: that is the whole point of the
  // layer, so anything found here means the rewrite did not take effect. A cleared zone is
  // not tagged at all, and the one flat zone — whose picture is inline by design — has had
  // its zone cleared by this point, so what is left here has to be empty of both.
  out.inlineImages = [...document.querySelectorAll('[data-dct-zone]')]
    .map((node) => node.style.getPropertyValue('background-image'))
    .filter((value) => value !== '');
  // The stacking context and the containing block are inline overrides too, so a
  // clear has to take them back off the shell's elements.
  out.inlineIsolation = [...document.querySelectorAll('[data-dct-zone], [class*="_frame"], header, [class*="_sidebarCol"], [class*="_centerCol"], [data-composer-seat], [data-rightbar-col]')]
    .map((node) => node.style.getPropertyValue('isolation'))
    .filter((value) => value !== '');
  out.zoneNodes = document.querySelectorAll('[data-dct-zone], [data-dct-layer]').length;
  out.leftovers = [...document.querySelectorAll('*')]
    .filter((node) => node.style.getPropertyValue('background-image').includes('/dsh-custom-theme/background/')).length;
  out.layerCss = document.querySelector('style[data-plugin="dsh-custom-theme"][data-role="background-layer"]')?.textContent ?? '';
  out.saved = localStorage.getItem('dsh-custom-theme.backgrounds');
  return out;
})()`

/**
 * Rewrite an `rgb(r, g, b)` computed colour as the same colour at `alpha`.
 *
 * The panel fill is built from the surface's own colour, which the plugin records
 * on `data-dct-tint`, so both sides of the expectation are read from the live
 * surface rather than written out: the assertions keep holding when the active
 * theme repaints the palette underneath them.
 */
function tinted(solidColor, alpha) {
  const match = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/u.exec(solidColor ?? '')
  assert.ok(match, `expected a solid computed colour, got ${JSON.stringify(solidColor)}`)
  return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${Math.round(alpha * 1000) / 1000})`
}

/** The alpha channel of a computed `rgb()`/`rgba()` colour. */
function alphaOf(color) {
  const match = /^rgba\([\d\s,]+?,\s*([\d.]+)\)$/u.exec(color ?? '')
  return match === null ? 1 : Number(match[1])
}

const browser = await launch({ port: PORT })
const page = await attach(browser.endpoint)
let failures = 0
/** The line-height probe with the +3px line-spacing choice applied, read before the reload. */
let spacedLineHeight = ''

/** Run one named step, reporting PASS/FAIL without aborting the run. */
async function step(name, fn) {
  try {
    await fn()
    console.log(`  PASS  ${name}`)
  } catch (error) {
    failures++
    console.log(`  FAIL  ${name}\n        ${error.message}`)
    for (const line of page.diagnostics.slice(-6)) console.log(`        page> ${line}`)
  }
}

/**
 * Select the zone under edit the way a user does: by clicking its workbench tab.
 *
 * The tab reports the selection on itself through `aria-pressed`, so waiting on that is
 * waiting on React to have taken the click, which the next step then depends on.
 * @param id - Zone id.
 * @returns True once that tab is the selected one.
 */
async function pickZone(id) {
  if (!await page.clickZone(id)) return false
  await page.waitFor(
    `document.querySelector('[data-dct-tab="${id}"]').getAttribute('aria-pressed') === 'true'`,
    { label: `the ${id} zone tab to become selected` })
  return true
}

/**
 * Where an upload failure is reported: the hint beside the import button.
 *
 * The card has more than one `.dct-hint`, so this reaches the one in the row the file
 * input belongs to rather than whichever happens to come first on the page.
 */
const importHint = `document.querySelector('.dct-file').closest('.dct-row').querySelector('.dct-hint').textContent`

/**
 * Put a file on the card's hidden input.
 *
 * That is the state the file dialog leaves behind, so it drives the picker path without
 * a dialog. No type is declared: the Host decides what a picture is from its bytes, and
 * leaving the type off is what makes that visible.
 * @param name - The name the browser would report for the file.
 * @param bytes - The file's contents.
 * @returns True when the card carried the input.
 */
function pickFile(name, bytes) {
  return page.evaluate(`(() => {
    const input = document.querySelector('.dct-file');
    if (!input) return false;
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array(${JSON.stringify(bytes)})], ${JSON.stringify(name)}));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`)
}

/**
 * Wait until the browser stops fetching resources.
 *
 * Boot loads well over a hundred plugin bundles, and a request issued during that
 * burst queues behind them on the per-origin connection limit. Driving the card
 * before the burst drains makes the first `fetch` look slow when it is only
 * queued, so the app is allowed to settle first.
 */
async function settled() {
  let previous = -1
  for (let i = 0; i < 60; i++) {
    const count = await page.evaluate(`performance.getEntriesByType('resource').length`)
    if (count === previous) return
    previous = count
    await delay(400)
  }
}

/** Whether DSH's own first-run notice is on screen. */
const NOTICE = `document.body.innerText.includes('预览版说明')`
/** Whether no modal backdrop is left to intercept `elementFromPoint`. */
const NO_MASK = `![...document.querySelectorAll('*')].some((n) => String(n.className).includes('_mask_'))`

/** Set once the notice has been dismissed, so later boots do not re-poll for it. */
let noticeDismissed = false

/**
 * Dismiss DSH's own first-run notice if it appears.
 *
 * A freshly created profile opens the "预览版说明" dialog, whose backdrop covers the
 * whole window. `elementFromPoint` then answers every query with that backdrop, and
 * its ancestors paint no image, so the zone-visibility checks find nothing even
 * though the zones are painted — which reads as a plugin failure but is not one.
 * Dismissing it once is enough: the profile records that the notice was seen, so it
 * does not come back on the next reload.
 *
 * The dialog is rendered from stored state, so it can arrive a beat after the first
 * paint; `timeout` is how long to keep looking before concluding there is none.
 * @param timeout - Milliseconds to wait for the notice to show up.
 */
async function dismissNotice({ timeout = 0 } = {}) {
  if (noticeDismissed) return
  const deadline = Date.now() + timeout
  while (!await page.evaluate(NOTICE)) {
    if (Date.now() >= deadline) return
    await delay(250)
  }
  assert.equal(await page.clickText('继续'), true, 'the first-run notice had no continue button')
  await page.waitFor(`!(${NOTICE}) && ${NO_MASK}`,
    { label: 'the notice and its backdrop to go', timeout: 10_000 })
  noticeDismissed = true
}

/** Load the app fresh with the token, and wait for the first paint. */
async function boot() {
  await page.navigate(`${BASE}/?token=${TOKEN}`)
  await page.waitFor(`typeof window.__DSH_BOOT__ !== 'undefined'`, { label: '__DSH_BOOT__' })
  await page.waitFor(`document.body.innerText.length > 50`, { label: 'the first paint' })
  await settled()
  await dismissNotice({ timeout: 5000 })
}

/**
 * Open the Settings panel the way the shell now asks: its entry lives in the
 * account menu at the bottom of the sidebar, so open that menu and pick it.
 */
async function openSettings() {
  if (await page.evaluate(PANEL)) return
  const opened = await page.evaluate(`(() => {
    const trigger = document.querySelector('[data-slot="settings.launcher"] button[aria-haspopup="menu"]')
    if (trigger === null) return false
    trigger.click()
    return true
  })()`)
  assert.equal(opened, true, 'no account menu to open Settings from')
  await page.waitFor(`document.body.innerText.includes('设置')`, { label: 'the account menu' })
  assert.equal(await page.clickText('设置'), true, 'no Settings entry in the account menu')
  await page.waitFor(PANEL, { label: 'the settings panel' })
}

/**
 * Bring the Settings panel to a known state: open, with the card's options loaded.
 *
 * Only opening is attempted. The panel is a toggle with its own close button, so
 * guessing at a second click to close it is unreliable; the card renders before
 * its `fetch` resolves, so the loaded options are what this waits for.
 */
async function ensureCard() {
  await openSettings()
  // The controls have a settings page of their own, reached from the nav rail, so
  // opening the panel is not enough to render them.
  if (!await page.evaluate(CARD_READY)) {
    assert.equal(await page.clickText(NAV_LABEL), true, 'no theme page in the settings nav')
  }
  await page.waitFor(CARD_READY, { label: 'the theme settings page with its options', timeout: 30_000 })
}

/**
 * Close the Settings panel.
 *
 * The panel is portalled over the whole window, so it answers every
 * `elementFromPoint` query while it is open; the zone-visibility checks need it
 * out of the way, which is also how a user sees a background.
 */
async function closeSettings() {
  if (!await page.evaluate(PANEL)) return
  assert.equal(await page.clickText('关闭'), true, 'no close button in the panel')
  await page.waitFor(`!(${PANEL})`, { label: 'the panel to close', timeout: 5000 })
}

/** Close the panel, then report what each zone actually shows under the cursor. */
async function closedZones() {
  await closeSettings()
  await delay(200)
  // Cheap safety net: by now the app has been up for a while, so a notice that is
  // going to show is already in the document and no polling window is needed.
  await dismissNotice()
  return page.evaluate(bgProbe)
}

/**
 * Select a theme through the card and wait for its effects to land.
 *
 * Retried on a bounded budget, each attempt starting from a fresh page load: the
 * shell re-mounts the Settings panel while the page settles, so an interaction
 * can hit a torn-down DOM. A reload is a deterministic reset, and the assertions
 * stay strict, so a retry can only turn a torn-down DOM into a real result,
 * never a false pass.
 * @param id - Theme id, or `''` for the built-in palette.
 */
async function selectTheme(id, expected = []) {
  const stored = id === '' ? null : id
  assert.ok(id === '' || expected.length === 2, `selectTheme(${id}) was not given the theme's two palettes`)
  // The tag holds a theme's non-token rules only — its palette is routed through the runtime
  // — so a theme that states tokens alone leaves it empty: gov leaves one font-family rule,
  // monokai-pro, one-dark and claude leave none. Its length therefore says nothing about whether the
  // theme arrived, and counting it as if it did is what left these steps red. The base colour
  // the theme declares does say it, so that is what this waits for — whichever of the two
  // palettes the preference has active, since a pair theme follows the scheme.
  const wanted = id === ''
    ? `(document.querySelector('style[data-plugin="dsh-custom-theme"][data-role="theme"]')?.textContent ?? '').length === 0`
    : `${JSON.stringify(expected)}.includes(getComputedStyle(document.body).getPropertyValue('--dsw-alias-bg-base').trim())`
  let lastError
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await ensureCard()
      assert.equal(await page.setValue('.dct-theme', id), true, 'the card select was not in the document')
      await page.waitFor(`localStorage.getItem('dsh-custom-theme.selected') === ${JSON.stringify(stored)}`,
        { label: 'the persisted selection', timeout: 8000 })
      await page.waitFor(wanted, { label: 'the theme to reach the cascade', timeout: 8000 })
      return
    } catch (error) {
      lastError = error
      if (attempt < 3) await boot()
    }
  }
  throw lastError
}

/**
 * The settings page's six tabs, in the order the strip shows them, and the cards each
 * one owns.
 *
 * The strip prefers the shell's `SegmentedControl` and falls back to the card's own
 * `role="tablist"` when that primitive is missing. The two renderings disagree about the
 * ids they give the tabs and panels — `custom-theme-tabs-<id>` against
 * `custom-theme-tab-<id>` — and the first tab's label is also the nav-rail entry that opens
 * this page, so `clickText` would land on that nav cell rather than on the tab. The click
 * therefore goes by id, with the role and visible label as a fallback, and the panel is
 * followed from the tab that names it through `aria-controls`, so the step reads whichever
 * ids the strip in use actually rendered.
 */
const TABS = [
  { id: 'theme', label: '主题与背景', cards: ['theme', 'background'] },
  { id: 'appearance', label: '排版渐显', cards: ['typography', 'streaming'] },
  { id: 'injections', label: '注入显示', cards: ['injections'] },
  { id: 'reasoning', label: '思考与滑块', cards: ['reasoning', 'effort'] },
  { id: 'effects', label: '状态与品牌', cards: ['working', 'branding'] },
  // The update row is the shell's own and carries no card of its own.
  { id: 'tray', label: '桌面与更新', cards: ['desktop-tray'] },
]

/** The tab's own button, under either rendering. */
const tabButtonOf = (tab) => `(document.querySelector('#custom-theme-tabs-${tab.id}')
    ?? document.querySelector('#custom-theme-tab-${tab.id}')
    ?? [...document.querySelectorAll('[role="tab"]')].find((node) => (node.innerText || '').trim() === ${JSON.stringify(tab.label)}))`

/**
 * The panel that tab owns, followed from the tab itself.
 *
 * A tab that points `aria-controls` at nothing resolves to null here, and the step that
 * needs it fails on that rather than on a guessed id.
 */
const panelOf = (tab) => `document.getElementById(${tabButtonOf(tab)}?.getAttribute('aria-controls') ?? '')`

/** Click one tab the way a user does. @returns True when the tab was found. */
const clickTab = (tab) => page.evaluate(`(() => {
  const hit = ${tabButtonOf(tab)};
  if (!hit) return false;
  hit.scrollIntoView({ block: 'center' });
  hit.click();
  return true;
})()`)

/** What the active tab shows: its own panel, its cards, and any panel left visible. */
const readTabPanel = (tab) => page.evaluate(`(() => {
  const panel = ${panelOf(tab)};
  if (panel === null) return null;
  const scope = panel.closest('.dct-page') ?? document;
  const shown = (node) => node.getClientRects().length > 0;
  return {
    id: panel.id,
    display: getComputedStyle(panel).display,
    shown: shown(panel),
    cards: [...panel.querySelectorAll('[data-card]')].map((node) => node.getAttribute('data-card')),
    placeholders: panel.querySelectorAll('.dct-unavailable').length,
    visible: [...scope.querySelectorAll('.dct-tab-panel')].filter(shown).map((node) => node.id),
  };
})()`)

try {
  console.log(`browser: ${browser.browser}`)
  await boot()

  console.log('\ncard discovery')
  await step('the plugin injected one style tag per concern', async () => {
    // Themes, the settings page's own rules, the appearance text, the writing ink,
    // the working indicator effect, and the branding sheet. The picture-layer style
    // is not counted here: it is added with the first picture.
    assert.equal((await page.evaluate(probe)).styleTags, 6)
  })
  await step('the controls render only on their own settings page', async () => {
    assert.equal(await page.evaluate(`document.querySelectorAll('.dct-theme').length`), 0)
    await openSettings()
    assert.equal(await page.evaluate(`document.querySelectorAll('.dct-theme').length`), 0,
      'the controls rendered before their page was opened')
    assert.equal(await page.clickText(NAV_LABEL), true, 'no theme page in the settings nav')
    await page.waitFor(`document.querySelectorAll('.dct-theme').length === 1`, { label: 'the controls' })
  })

  // Every card now lives behind one of six tabs, and the suite drives the two the first
  // tab owns. A card that quietly moved to a tab nothing opens, or a tab that renders
  // nothing at all, would otherwise still read as a pass, so each tab is opened the way a
  // user opens it and has to show its own cards — with the inactive ones hidden rather
  // than unmounted, which is what makes the click the thing under test.
  console.log('\nsettings tabs')
  for (const tab of TABS) {
    await step(`the ${tab.label} tab shows its own cards`, async () => {
      await ensureCard()
      assert.equal(await clickTab(tab), true, `no ${tab.label} tab on the settings page`)
      await page.waitFor(`(${panelOf(tab)})?.getClientRects().length > 0`,
        { label: `the ${tab.label} panel to show` })
      const panel = await readTabPanel(tab)
      assert.ok(panel !== null, `no panel answers the ${tab.label} tab's aria-controls`)
      assert.notEqual(panel.display, 'none', `the ${tab.label} panel is still hidden`)
      assert.ok(panel.cards.length >= 1, `the ${tab.label} tab rendered no card`)
      for (const cardId of tab.cards) {
        assert.ok(panel.cards.includes(cardId),
          `the ${tab.label} tab lost its ${cardId} card (it shows ${JSON.stringify(panel.cards)})`)
      }
      assert.equal(panel.placeholders, 0, `the ${tab.label} tab rendered an unmounted card`)
      assert.deepEqual(panel.visible, [panel.id], 'the tab left another panel on screen')
    })
  }
  await step('the tabs come back to the theme page the rest of the suite drives', async () => {
    const theme = TABS[0]
    assert.equal(await clickTab(theme), true, `no ${theme.label} tab to come back to`)
    await page.waitFor(`(${panelOf(theme)})?.getClientRects().length > 0`,
      { label: 'the theme panel to come back' })
    const panel = await readTabPanel(theme)
    assert.equal(panel.shown, true, 'the theme panel is not the one the strip activated')
    assert.deepEqual(panel.visible, [panel.id], 'another panel stayed on screen')
  })

  await step('the card lists the Host directory themes', async () => {
    await ensureCard()
    const actual = await page.waitFor(OPTIONS_SETTLED, { label: 'the Host theme listing', timeout: 15_000 })
    assert.deepEqual(actual, EXPECTED_OPTIONS)
  })

  const baseline = await page.evaluate(probe)
  const baselineScheme = await page.evaluate(`document.body.hasAttribute('data-ds-dark-theme') ? 'dark' : 'light'`)
  console.log(`\nbaseline --dsw-alias-bg-base on body: ${baseline.bodyBgBase} (${baselineScheme})`)

  // Every bundled theme carries a light and a dark set, the way the files it was
  // ported from do, so the appearance switch has to move the theme between its two
  // sets and keep it selected. A theme that states one palette instead is dropped
  // by the switch, because half its tokens cannot follow the base palette.
  for (const id of ['gov', 'monokai-pro', 'one-dark', 'claude']) {
    const light = await themeToken(id, '--dsw-alias-bg-base', 'light')
    const dark = await themeToken(id, '--dsw-alias-bg-base', 'dark')
    console.log(`\napplying ${id} (light ${light}, dark ${dark})`)
    await step(`selecting ${id} loads its stylesheet and persists it`, async () => {
      await selectTheme(id, [light, dark])
    })
    await page.setValue('.dct-scheme', 'light')
    await page.waitFor(`!document.body.hasAttribute('data-ds-dark-theme')`,
      { label: 'the light base palette' })
    await step(`${id} paints its light palette and repaints the page`, async () => {
      const value = await page.evaluate(probe)
      assert.equal(value.bodyBgBase, light, 'the token was declared but did not win the cascade')
      assert.equal(value.bodyColor, toRgb(light), 'the body background-color did not follow the token')
    })
    await step(`${id} follows the appearance switch into its own dark set`, async () => {
      // Driven from this page's own control: the official appearance row lives on
      // the General section, and the shell renders only the active section.
      assert.equal(await page.setValue('.dct-scheme', 'dark'), true, 'no scheme control on the page')
      await page.waitFor(`document.body.hasAttribute('data-ds-dark-theme')`,
        { label: 'the dark base palette' })
      const value = await page.evaluate(probe)
      assert.equal(value.bodyBgBase, dark, 'the theme did not follow the switch to its dark set')
      assert.equal(value.bodyColor, toRgb(dark), 'the body background-color did not follow the dark token')
    })
    await step(`the switch keeps ${id} selected instead of dropping it`, async () => {
      const kept = await page.evaluate(`document.querySelector('.dct-theme')?.value ?? null`)
      assert.equal(kept, id, 'the appearance switch dropped the theme')
    })
    // Settle before the screenshot: it is a diagnostic artefact, and a capture
    // issued while the next theme is already switching paints the wrong palette.
    await delay(900)
    await page.screenshot(`${SHOT_DIR}/shot-${id}.png`)
  }

  console.log('\nclearing back to the built-in palette')
  await step('the empty option restores the built-in tokens', async () => {
    // The built-in palette is scheme-dependent, so return to the scheme the
    // baseline was read in before comparing. This also keeps a theme whose
    // canvas happens to be the built-in white from hiding a leftover layer.
    await page.setValue('.dct-scheme', baselineScheme)
    await page.waitFor(`document.body.hasAttribute('data-ds-dark-theme') === ${baselineScheme === 'dark'}`,
      { label: `the ${baselineScheme} base palette` })
    await selectTheme('')
    const value = await page.evaluate(`(() => ({
      bgBase: getComputedStyle(document.body).getPropertyValue('--dsw-alias-bg-base').trim(),
      bodyColor: getComputedStyle(document.body).backgroundColor,
      themeStyleBytes: (document.querySelector('style[data-plugin="dsh-custom-theme"][data-role="theme"]')?.textContent ?? '').length,
    }))()`)
    assert.equal(value.bgBase, baseline.bodyBgBase, `a themed token survived the clear: ${value.bgBase}`)
    assert.equal(value.bodyColor, baseline.bodyColor, 'the painted canvas did not return to the built-in colour')
    assert.equal(value.themeStyleBytes, 0, 'the theme stylesheet was not emptied')
  })

  console.log('\nconversation stream')
  await step('the font controls now belong to the shell and are not duplicated here', async () => {
    const removed = await page.evaluate("[...document.querySelectorAll('.dct-fontsize, .dct-font, .dct-codefont')].length")
    assert.equal(removed, 0, 'the removed font controls are still rendered')
    const value = await page.evaluate(probe)
    assert.ok(!value.appearanceCss.includes('--dsw-font-family'), 'the appearance sheet still overrides the text font')
    assert.ok(!value.appearanceCss.includes('--ds-font-family-code'), 'the appearance sheet still overrides the code font')
  })

  await step('the line-spacing control shifts every content line height', async () => {
    // Read the used line height first: the shell derives it from the official text
    // size, so the expectation is that value plus the spacing this page adds.
    const baseline = parseFloat(await page.evaluate(`(${probe}).lineHeightProbe`))
    await page.setValue('.dct-linegap', '3')
    await page.waitFor(`parseFloat((${probe}).lineHeightProbe) === ${baseline + 3}`)
    spacedLineHeight = await page.evaluate(`(${probe}).lineHeightProbe`)
    const value = await page.evaluate(probe)
    assert.ok(value.appearanceCss.includes('--dsh-content-font-delta'), 'the delta override is missing from the stylesheet')
  })

  await step('the writing ink controls apply and persist', async () => {
    const controls = await page.evaluate(`(() => ({
      duration: document.querySelector('.dct-fade-duration')?.tagName ?? null,
      ink: document.querySelector('.dct-fade-ink')?.tagName ?? null,
    }))()`)
    assert.equal(controls.duration, 'INPUT', 'the fade duration control is missing')
    assert.equal(controls.ink, 'INPUT', 'the fade ink control is missing')
    await page.setValue('.dct-fade-duration', '900')
    await page.setValue('.dct-fade-ink', '55')
    await page.waitFor(`document.querySelector('.dct-fade-ink').value === '55'`)
    const value = await page.evaluate(probe)
    assert.ok(value.savedAppearance?.includes('"streamingFadeDuration":900'), `the fade duration was not persisted: ${value.savedAppearance}`)
    assert.ok(value.savedAppearance?.includes('"streamingFadeInk":0.55'), `the writing ink was not persisted: ${value.savedAppearance}`)
  })

  console.log('\npersistence across a reload')
  await step('a saved theme re-applies on boot, before Settings opens', async () => {
    const palette = await Promise.all(['light', 'dark'].map((scheme) =>
      themeToken('gov', '--dsw-alias-bg-base', scheme)))
    await selectTheme('gov', palette)
    await boot()
    // The scheme the last theme was on persists too, so the expected set is
    // whichever one the booted window came up in. The tag holds only gov's non-token rules,
    // so what proves the saved theme came back is that palette, not the bytes in the tag.
    const scheme = await page.evaluate(`document.body.hasAttribute('data-ds-dark-theme') ? 'dark' : 'light'`)
    const expected = await themeToken('gov', '--dsw-alias-bg-base', scheme)
    await page.waitFor(`getComputedStyle(document.body).getPropertyValue('--dsw-alias-bg-base').trim() === ${JSON.stringify(expected)}`,
      { label: 'the saved theme to apply on boot' })
    const value = await page.evaluate(probe)
    assert.equal(value.bodyBgBase, expected)
    assert.equal(value.bodyColor, toRgb(expected))
  })
  await delay(300)
  await page.screenshot(`${SHOT_DIR}/shot-reloaded.png`)

  console.log('\nbackground images')
  await step('the line-spacing choice re-applies on boot', async () => {
    const value = await page.evaluate(probe)
    assert.equal(value.lineHeightProbe, spacedLineHeight, 'the line spacing did not survive the reload')
    assert.ok(value.savedAppearance?.includes('"lineGap":3'), 'the line spacing was not persisted')
    assert.ok(value.savedAppearance?.includes('"streamingFadeDuration":900'), 'the fade duration did not survive the reload')
    assert.ok(value.savedAppearance?.includes('"streamingFadeInk":0.55'), 'the writing ink did not survive the reload')
  })

  await step('the shell exposes exactly one anchor per zone', async () => {
    const counts = await page.evaluate(`(() => {
      const count = (selector) => document.querySelectorAll(selector).length;
      return {
        frame: count('[class*="_frame"]'),
        sidebar: count('[class*="_sidebarCol"]'),
        conversation: count('[class*="_centerCol"]'),
      };
    })()`)
    assert.deepEqual(counts, { frame: 1, sidebar: 1, conversation: 1 })
  })

  await step('the workbench picks the zone from either the tabs or the schematic', async () => {
    await ensureCard()
    // Both views of the choice have to cover every zone the plugin paints, or a zone
    // would be reachable from one and invisible in the other.
    const zones = await page.evaluate(`(() => ({
      tabs: [...document.querySelectorAll('[data-dct-tab]')].map((n) => n.dataset.dctTab),
      picks: [...document.querySelectorAll('[data-dct-pick]')].map((n) => n.dataset.dctPick).sort(),
    }))()`)
    assert.deepEqual(zones.tabs, ['global', 'windowbar', 'sidebar', 'conversation', 'composer', 'dock'])
    assert.deepEqual(zones.picks, ['composer', 'conversation', 'dock', 'global', 'sidebar', 'windowbar'])

    // The tabs name a zone; the schematic shows where it sits. Clicking the picture of
    // the zone has to move the very selection the tabs report.
    await page.evaluate(`document.querySelector('[data-dct-pick="dock"]').click()`)
    await page.waitFor(`document.querySelector('[data-dct-tab="dock"]').getAttribute('aria-pressed') === 'true'`,
      { label: 'the schematic click to move the selection' })
    assert.equal(
      await page.evaluate(`document.querySelector('[data-dct-pick="dock"]').getAttribute('aria-pressed')`),
      'true')
    // Back to where the remaining steps expect to start.
    assert.equal(await pickZone('global'), true)
  })

  await step('the card lists every image dropped into the background directory', async () => {
    await ensureCard()
    await page.waitFor(`document.querySelectorAll('.dct-image option').length > 2`,
      { label: 'the background image options' })
    const names = await page.evaluate(`[...document.querySelectorAll('.dct-image option')].map((o) => o.value)`)
    assert.ok(names.includes(BACKGROUND_NAME) && names.includes(STRIPES_NAME), `options were ${JSON.stringify(names)}`)
  })

  await step('a picture picked from the file dialog is stored and selected for the zone', async () => {
    await ensureCard()
    assert.equal(await pickZone('composer'), true)
    // Drive the picker path the dialog itself leaves behind: a File on the input.
    assert.equal(await pickFile('suite upload.png', PNG_BYTES), true, 'the card carries no file input')

    // The name is the one the Host could serve, not the one the browser reported, and
    // the client selects what came back rather than what it sent.
    await page.waitFor(`document.querySelector('.dct-image').value === 'suite-upload.png'`,
      { label: 'the uploaded picture to be selected' })
    const options = await page.evaluate(`[...document.querySelectorAll('.dct-image option')].map((o) => o.value)`)
    assert.ok(options.includes('suite-upload.png'), `options were ${JSON.stringify(options)}`)
    // Stored is not the same as painted, so the zone itself has to show it.
    await page.waitFor(
      `getComputedStyle(document.querySelector('[data-dct-zone="composer"]'), '::before').backgroundImage.includes('suite-upload.png')`,
      { label: 'the uploaded picture to paint the composer zone' })
    // Leave the zone empty, and the workbench back on the whole-window zone, for the
    // steps that follow.
    assert.equal(await page.setValue('.dct-image', ''), true)
    assert.equal(await pickZone('global'), true)
  })

  await step('a Host that predates the route asks for a restart, not another picture', async () => {
    await ensureCard()
    // Stand in front of a Host from before this feature. Updating a plugin in place makes
    // exactly that pair: the panel is read from the bundle on disk, so a refresh brings up
    // the new one, while the Host comes from the process that booted before it and has
    // never heard of the route the panel now posts to. It answers 405, the way it answers
    // any method it lacks — which the panel used to report as the picture's fault.
    const before = await page.evaluate(`[...document.querySelectorAll('.dct-image option')].map((o) => o.value)`)
    await page.stubFetch('/dsh-custom-theme/backgrounds',
      { status: 405, body: 'method not allowed' }, { method: 'POST' })
    try {
      assert.equal(await pickFile('stale.png', PNG_BYTES), true)
      await page.waitFor(`${importHint}.includes('重启')`, { label: 'the restart hint' })
      // The picture was never the problem, so nothing may have been stored from it.
      const after = await page.evaluate(`[...document.querySelectorAll('.dct-image option')].map((o) => o.value)`)
      assert.deepEqual(after, before, 'the refused upload changed the listing')
    } finally {
      await page.clearStub()
    }
  })

  await step('a file that is no picture is refused for its format', async () => {
    await ensureCard()
    // A real refusal from the real Host: the bytes carry no signature it serves, and the
    // file declared no type either, so the format is the only thing it can be judged on.
    assert.equal(await pickFile('not-a-picture.png', NOT_A_PICTURE), true)
    await page.waitFor(`${importHint}.includes('格式')`, { label: 'the unsupported-format hint' })
    // A failure is not sticky: the next picture that works has to take it away again. The
    // bytes are ones already stored, so the listing does not grow and the zone is left as
    // the earlier steps left it.
    assert.equal(await pickFile('suite upload.png', PNG_BYTES), true)
    await page.waitFor(`!${importHint}.includes('格式')`, { label: 'the failure to clear' })
    assert.equal(await page.setValue('.dct-image', ''), true)
  })

  await step('a global image paints every zone and is visible in them', async () => {
    await ensureCard()
    // The workbench opens on the whole-window zone.
    assert.equal(
      await page.evaluate(`document.querySelector('[data-dct-tab="global"]').getAttribute('aria-pressed')`),
      'true')
    assert.equal(await page.setValue('.dct-image', BACKGROUND_NAME), true)
    await page.waitFor(`document.querySelectorAll('[data-dct-zone]').length >= 2`,
      { label: 'the painted zone surfaces' })
    const value = await page.evaluate(bgProbe)
    // The columns cover the frame completely, and their tints are translucent, so
    // the frame is deliberately left unpainted: painting it too would show the
    // same image twice and read stronger than the configured strength.
    assert.equal(value.global.painted, false, 'the fully covered frame was painted as well')
    const saved = JSON.parse(value.saved)
    // The picture is painted once on the surface of the column, then the fill goes over it.
    for (const zone of ['sidebar', 'conversation']) {
      const painted = value[zone]
      assert.equal(painted.painted, true, `the ${zone} zone was not painted`)
      // The picture is on the layer, so the surface's own background must be
      // untouched by this plugin, and the layer must be the one carrying the image.
      assert.equal(painted.selfImage, 'none', `${zone} still carries a background-image on the surface itself`)
      assert.ok(painted.image.startsWith('url('), `${zone} layer image was ${painted.image}`)
      assert.ok(painted.image.includes(BACKGROUND_NAME), `${zone} image was ${painted.image}`)
      // The picture's alpha is the layer's own opacity, independent of the panel fill.
      assert.equal(painted.opacity, '0.18', `${zone} picture alpha was ${painted.opacity}`)
      // The fill is a separate channel on the surface, built from that surface's own
      // colour and kept at this zone's Deeptop percentage.
      assert.equal(painted.computed, tinted(painted.tint, saved[zone].panelOpacity / 100),
        `${zone} panel fill was ${painted.computed}`)
      // Under the content, inside this surface's own stacking context.
      assert.equal(painted.zIndex, '-1', `${zone} layer z-index was ${painted.zIndex}`)
      assert.equal(painted.isolation, 'isolate', `${zone} surface does not isolate its layer`)
      assert.equal(painted.size, 'cover')
      // The whole-window picture is one picture, not one crop per zone. The shell's
      // columns are opaque, so the frame cannot be painted behind them and every zone has
      // to carry the picture; anchored to the viewport, each zone shows its own window onto
      // the same one. Anchored to its own box instead, each would show its own crop and the
      // seams between the columns, the bar and the composer would read as a stack of
      // pieces.
      assert.equal(painted.attachment, 'fixed', `${zone} does not anchor the picture to the viewport`)
    }
    // The composer seat sits inside the conversation column, and on the current shell that
    // column is itself the painted surface — the seat is already behind this same picture,
    // at the same strength and with the same viewport anchor. A second copy there would
    // read stronger than the user asked for, so the seat brings the panel fill and no
    // layer: the column's picture shows through it.
    const nested = value.composer
    assert.equal(nested.painted, true, 'the composer zone was not painted')
    assert.equal(nested.selfImage, 'none', 'the composer still carries a background-image on the surface itself')
    assert.equal(nested.image, 'none', `the composer painted a second copy of the picture: ${nested.image}`)
    assert.equal(nested.layerTag, null, 'the composer grew a layer of its own; the column behind it already carries the picture')
    assert.equal(nested.computed, tinted(nested.tint, 0),
      `composer panel fill was ${nested.computed}; the column's fill already covers it`)
    assert.equal(nested.isolation, 'isolate', 'the composer surface does not isolate its fill')
    // What the user meets there is still the picture: the column's layer is in the chain
    // under the cursor, read once more with the Settings panel out of the way below.

    // The tool panel column only exists while the dock is open.
    if (await page.evaluate(`document.querySelector('[data-rightbar-col]') !== null`)) {
      assert.equal(value.dock.painted, true, 'the open dock was not painted')
    }

    // The window bar is the one zone the whole-window picture does not reach, and the one zone
    // painted without a layer. Its element is the shell's own conversation header, and the
    // header actions open their popovers inside it — the background-jobs list carries
    // `z-index: 100` and floats over the transcript by escaping to the root stacking context.
    // A layer needs a stacking context on that header, which traps those popovers under the
    // conversation's own positioned content; the header is transparent, so the column behind it
    // already shows this same picture at the strength and blur the user asked for, and the bar
    // is left to carry it.
    assert.equal(value.windowbar.painted, false,
      'the spread painted the window bar, whose popovers cannot survive a stacking context')

    // A picture the user picks for the bar alone has no such substitute: it is painted on the
    // element's own background, over the panel fill and under the header's buttons and labels.
    assert.equal(await pickZone('windowbar'), true)
    assert.equal(await page.setValue('.dct-image', BACKGROUND_NAME), true)
    await page.waitFor(`document.querySelector('[data-dct-zone="windowbar"]') !== null`,
      { label: 'the window bar picture' })
    const after = await page.evaluate(bgProbe)
    const bar = after.windowbar
    assert.equal(bar.isolation, 'auto', 'the window bar became a stacking context the shell’s popovers cannot escape')
    assert.equal(bar.layerTag, null, 'the window bar got a picture layer, which needs a stacking context to stay under its content')
    assert.equal(bar.image, 'none', `the window bar wrote a layer anyway: ${bar.image}`)
    // A background layer has no alpha of its own, so the picture's strength is a wash of the
    // fill's colour laid over it, and the picture is the second layer.
    assert.ok(bar.selfImage.startsWith('linear-gradient('), `the window bar's wash is missing: ${bar.selfImage}`)
    assert.ok(bar.selfImage.includes(BACKGROUND_NAME), `the window bar's picture is missing: ${bar.selfImage}`)
    assert.equal(bar.selfSize, '100% 100%, cover', `the window bar's layers were sized ${bar.selfSize}`)
    // On the current shell the header sits inside the painted conversation column, so its
    // fill is the inner fill that completes the column's fill to the configured percentage —
    // 1 - (1 - outer)(1 - inner) — rather than that percentage written a second time.
    const target = saved.windowbar.panelOpacity / 100
    const outer = alphaOf(after.conversation.computed)
    assert.equal(bar.computed, tinted(bar.tint, outer >= 1 ? 0 : Math.max(0, 1 - (1 - target) / (1 - outer))),
      `the window bar's panel fill was ${bar.computed}, over the column's ${outer}`)
    // Read back through the element under the cursor once the Settings panel is out of the
    // way, below: the bar's picture has to be on screen.
    // Everything below works on the whole-window zone again.
    assert.equal(await pickZone('global'), true)

    // The Settings panel is portalled over the whole window, so what is visible
    // under the cursor can only be sampled with it closed.
    const seen = await closedZones()
    for (const zone of ['global', 'sidebar', 'conversation']) {
      assert.ok(seen[zone].visible.length > 0, `nothing paints a background at the ${zone} sample point`)
      assert.ok(seen[zone].visible[0].image.includes(BACKGROUND_NAME),
        `the ${zone} sample point shows ${JSON.stringify(seen[zone].visible[0])}`)
    }
    // The composer has no layer of its own, so the picture is reached through the column's
    // layer in its ancestor chain rather than as the first background under the cursor.
    assert.ok(seen.composer.visible.some((entry) => entry.image.includes(BACKGROUND_NAME)),
      `nothing paints the composer under the cursor: ${JSON.stringify(seen.composer.visible)}`)
    // The bar's picture is on the header's own background, so it is the first entry in the
    // chain under the cursor instead of a layer.
    assert.ok(seen.windowbar.visible.some((entry) => entry.image.includes(BACKGROUND_NAME)),
      `nothing paints the window bar under the cursor: ${JSON.stringify(seen.windowbar.visible)}`)
    await page.screenshot(`${SHOT_DIR}/shot-bg-global.png`)
  })

  await step('a per-zone image replaces the global one in that zone only', async () => {
    await ensureCard()
    assert.equal(await pickZone('sidebar'), true)
    assert.equal(await page.setValue('.dct-image', STRIPES_NAME), true)
    await page.waitFor(`getComputedStyle(document.querySelector('[data-dct-zone="sidebar"]'), '::before').backgroundImage.includes(${JSON.stringify(STRIPES_NAME)})`,
      { label: 'the sidebar image to change' })
    const value = await page.evaluate(bgProbe)
    // The picture that belongs to a zone is that zone's own, so it covers the zone rather
    // than a window-sized frame: only the spread one is anchored to the viewport.
    assert.equal(value.sidebar.attachment, 'scroll', 'a zone picture was anchored to the viewport')
    assert.equal(value.conversation.attachment, 'fixed', 'the spread picture lost its viewport anchor')
    assert.ok(value.conversation.image.includes(BACKGROUND_NAME), `conversation image was ${value.conversation.image}`)
    const seen = await closedZones()
    assert.ok(seen.sidebar.visible[0].image.includes(STRIPES_NAME), `the sidebar shows ${JSON.stringify(seen.sidebar.visible[0])}`)
    assert.ok(seen.conversation.visible[0].image.includes(BACKGROUND_NAME), `the conversation shows ${JSON.stringify(seen.conversation.visible[0])}`)
  })

  await step('the picture alpha moves only the zone it belongs to, not the panel fill', async () => {
    await ensureCard()
    // Re-opening the panel resets the zone picker, so select the sidebar again.
    assert.equal(await pickZone('sidebar'), true)
    const fillBefore = (await page.evaluate(bgProbe)).sidebar.computed
    assert.equal(await page.setValue('.dct-opacity', '40'), true)
    await page.waitFor(`getComputedStyle(document.querySelector('[data-dct-zone="sidebar"]'), '::before').opacity === '0.4'`,
      { label: 'the re-alphaed sidebar layer' })
    const value = await page.evaluate(bgProbe)
    assert.equal(value.sidebar.opacity, '0.4', `sidebar picture alpha was ${value.sidebar.opacity}`)
    // The layer's own opacity is the picture alpha; the fill is a separate channel
    // on the surface and must not have followed it.
    assert.equal(value.sidebar.computed, fillBefore, 'the panel fill moved with the picture alpha')
    assert.ok(value.sidebar.computed.startsWith('rgba(') && !value.sidebar.computed.endsWith(', 1)'),
      `the sidebar panel fill is opaque: ${value.sidebar.computed}`)
    assert.equal(JSON.parse(value.saved).sidebar.opacity, 0.4)
    assert.equal(JSON.parse(value.saved).global.opacity, 0.18, 'the global zone must keep its own alpha')
  })

  await step('blur reaches the picture layer only, never the content', async () => {
    await ensureCard()
    assert.equal(await pickZone('sidebar'), true)
    assert.equal(await page.setValue('.dct-blur', '8'), true)
    await page.waitFor(`getComputedStyle(document.querySelector('[data-dct-zone="sidebar"]'), '::before').filter === 'blur(8px)'`,
      { label: 'the blurred sidebar layer' })
    const value = await page.evaluate(bgProbe)
    assert.equal(value.sidebar.filter, 'blur(8px)', `sidebar layer filter was ${value.sidebar.filter}`)
    // The blur must not have landed on the surface that holds the text, nor on any
    // other zone's layer.
    assert.equal(value.sidebar.selfImage, 'none', 'the surface itself carries a background-image')
    assert.equal(await page.evaluate(`getComputedStyle(document.querySelector('[data-dct-zone="sidebar"]')).filter`), 'none',
      'the surface carrying the content was filtered')
    assert.equal(value.conversation.filter, 'none', 'the blur leaked into another zone')
    assert.equal(JSON.parse(value.saved).sidebar.blur, 8)
    // A blur of 0 must drop the declaration entirely rather than write blur(0px).
    assert.equal(await page.setValue('.dct-blur', '0'), true)
    await page.waitFor(`getComputedStyle(document.querySelector('[data-dct-zone="sidebar"]'), '::before').filter === 'none'`,
      { label: 'the unblurred sidebar layer' })
  })

  await step('the blur control cannot exceed the Deeptop ceiling', async () => {
    await ensureCard()
    assert.equal(await pickZone('sidebar'), true)
    assert.equal(await page.setValue('.dct-blur', '99'), true)
    const saved = JSON.parse(await page.evaluate(`localStorage.getItem('dsh-custom-theme.backgrounds')`))
    assert.equal(saved.sidebar.blur, 16, 'a value above the blur ceiling was not clamped')
    assert.equal(await page.evaluate(`document.querySelector('.dct-blur').getAttribute('max')`), '16')
    assert.equal(await page.setValue('.dct-blur', '0'), true)
  })

  await step('an incomplete panel fill follows the Deeptop per-zone default', async () => {
    // Re-opening the panel repaints every zone, so the defaults apply again.
    await ensureCard()
    const fills = await page.evaluate(`(() => {
      const out = {};
      for (const zone of ['global', 'sidebar', 'conversation', 'composer', 'dock']) {
        const tagged = [...document.querySelectorAll('[data-dct-zone]')].find((el) => el.getAttribute('data-dct-zone') === zone);
        out[zone] = tagged === undefined ? null : getComputedStyle(tagged).backgroundColor;
      }
      return out;
    })()`)
    // Only the frame stays fully opaque; the panels let the app backdrop through.
    for (const zone of ['sidebar', 'conversation']) {
      assert.ok(fills[zone] !== null, `the ${zone} zone was not repainted`)
      assert.ok(fills[zone].startsWith('rgba(') && !fills[zone].endsWith(', 1)'),
        `the ${zone} panel fill is still opaque: ${fills[zone]}`)
    }
  })

  await step('the picture opacity control cannot exceed the Deeptop ceiling', async () => {
    await ensureCard()
    assert.equal(await pickZone('sidebar'), true)
    assert.equal(await page.setValue('.dct-opacity', '90'), true)
    const saved = JSON.parse(await page.evaluate(`localStorage.getItem('dsh-custom-theme.backgrounds')`))
    assert.equal(saved.sidebar.opacity, 0.45, 'a value above the ceiling was not clamped')
    assert.equal(await page.evaluate(`document.querySelector('.dct-opacity').getAttribute('max')`), '45')
  })

  await step('the conversation zone can carry its own image too', async () => {
    await ensureCard()
    assert.equal(await pickZone('conversation'), true)
    assert.equal(await page.setValue('.dct-image', STRIPES_NAME), true)
    await page.waitFor(`getComputedStyle(document.querySelector('[data-dct-zone="conversation"]'), '::before').backgroundImage.includes(${JSON.stringify(STRIPES_NAME)})`,
      { label: 'the conversation image' })
    const seen = await closedZones()
    assert.ok(seen.conversation.visible[0].image.includes(STRIPES_NAME),
      `the conversation shows ${JSON.stringify(seen.conversation.visible[0])}`)
    await page.screenshot(`${SHOT_DIR}/shot-bg-zones.png`)
  })

  await step('clearing each zone leaves nothing of this plugin behind', async () => {
    await ensureCard()
    for (const zoneId of ['global', 'windowbar', 'sidebar', 'conversation']) {
      assert.equal(await pickZone(zoneId), true)
      assert.equal(await page.clickText('清除'), true, 'no clear button')
      await page.waitFor(`document.querySelector('.dct-image').value === ''`, { label: `the ${zoneId} zone to clear` })
    }
    const value = await page.evaluate(bgProbe)
    assert.equal(value.leftovers, 0, 'an inline background-image survived the clear')
    assert.deepEqual(value.inlineImages, [], 'a surface still carries an inline background-image')
    assert.deepEqual(value.inlineIsolation, [], 'a surface still carries the layer stacking context')
    assert.equal(value.zoneNodes, 0, 'a zone or layer attribute survived the clear')
    for (const zone of ['global', 'windowbar', 'sidebar', 'conversation']) {
      assert.equal(value[zone].painted, false, `${zone} is still tagged`)
    }
    // Every injected layer rule goes with the zones it belonged to.
    assert.ok(!value.layerCss.includes('/dsh-custom-theme/background/'),
      `a layer rule survived the clear:\n${value.layerCss}`)
    assert.equal(value.saved, null, 'an all-empty set should not stay in storage')
  })

  console.log('\nbackground persistence')
  await step('a saved background re-applies on boot', async () => {
    await ensureCard()
    assert.equal(await pickZone('global'), true)
    assert.equal(await page.setValue('.dct-image', BACKGROUND_NAME), true)
    await page.waitFor(`localStorage.getItem('dsh-custom-theme.backgrounds') !== null`,
      { label: 'the saved background' })
    await boot()
    await page.waitFor(`document.querySelector('[data-dct-zone="sidebar"]') !== null`,
      { label: 'the background to apply on boot' })
    // Nothing is opened here: the background has to come back on its own.
    const value = await page.evaluate(bgProbe)
    assert.ok(value.sidebar.visible[0].image.includes(BACKGROUND_NAME), 'the restored background is not visible')
    await page.screenshot(`${SHOT_DIR}/shot-bg-reloaded.png`)
  })

  console.log('\nbackground surfaces the shell replaces')
  await step('a surface the shell throws away is painted again', async () => {
    // Opening a conversation makes the shell throw the column, its header and the composer
    // seat away and build new ones. Everything the plugin wrote — the markers and the inline
    // declarations, the bar's own background layers included — goes with the old elements, and
    // only the sidebar, which is not rebuilt, keeps its picture: the conversation half goes
    // bare. Nothing the user does asks for the replacement to be painted, so it only happens if
    // the plugin notices that the surface it painted is gone.
    await ensureCard()
    // The bar carries a picture of its own for this. A whole-window picture is never spread
    // onto it — its popovers cannot survive the stacking context a layer needs — so the zone
    // has to be the one asked for the image, which is also the case the repaint has to cover.
    assert.equal(await pickZone('windowbar'), true)
    assert.equal(await page.setValue('.dct-image', BACKGROUND_NAME), true)
    await page.waitFor(`document.querySelector('[data-dct-zone="windowbar"]') !== null`,
      { label: 'the window bar picture the zone set earlier left behind' })
    // The stand-in for the shell's own swap: same element, same children, none of what the
    // plugin had written to it. The bar's picture is inline — a flat zone has no layer to
    // hold it — so the clone has to drop the background declarations as well.
    const swapped = await page.evaluate(`(() => {
      const old = document.querySelector('[data-dct-zone="windowbar"]');
      const fresh = old.cloneNode(true);
      for (const name of ['data-dct-zone', 'data-dct-layer', 'data-dct-tint']) fresh.removeAttribute(name);
      for (const property of ['isolation', 'position', 'background-color', 'background-image', 'background-repeat', 'background-size', 'background-position', 'background-attachment']) fresh.style.removeProperty(property);
      old.replaceWith(fresh);
      return {
        detached: !old.isConnected,
        tagged: document.querySelectorAll('[data-dct-zone="windowbar"]').length,
      };
    })()`)
    assert.ok(swapped.detached, 'the replaced surface is still in the document')
    assert.equal(swapped.tagged, 0, 'the replacement arrived carrying the old markers')

    await page.waitFor(`document.querySelector('[data-dct-zone="windowbar"]') !== null`,
      { label: 'the replacement to be painted', timeout: 15_000 })
    const value = await page.evaluate(bgProbe)
    assert.ok(value.windowbar.selfImage.includes(BACKGROUND_NAME), `the replacement shows ${value.windowbar.selfImage}`)
    assert.equal(value.windowbar.isolation, 'auto', 'the repaint made the shell’s own header a stacking context')
    // The zones the shell left alone keep the picture they already had, and the whole-window
    // picture keeps its viewport anchoring through the repaint.
    assert.ok(value.sidebar.image.includes(BACKGROUND_NAME), `the sidebar shows ${value.sidebar.image}`)
    assert.equal(value.sidebar.attachment, 'fixed', 'the repaint lost the viewport anchor')
    await page.screenshot(`${SHOT_DIR}/shot-bg-repainted.png`)
  })

  console.log(`\n${failures === 0 ? 'ALL STEPS PASSED' : `${failures} STEP(S) FAILED`}`)
  console.log(`screenshots in ${SHOT_DIR}`)
} finally {
  page.close()
  await browser.close()
  await delay(200)
}

process.exit(failures === 0 ? 0 : 1)
