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
    contentFontSize: body.getPropertyValue('--dsh-content-font-size').trim(),
    rootFontFamily: root.getPropertyValue('--dsw-font-family').trim(),
    codeFontFamily: root.getPropertyValue('--ds-font-family-code').trim(),
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
const EXPECTED_OPTIONS = ['', 'gov', 'monokai-pro', 'one-dark']
const BACKGROUND_NAME = process.env.DCT_BACKGROUND ?? 'test-gradient.png'
const STRIPES_NAME = process.env.DCT_BACKGROUND_ALT ?? 'test-stripes.png'

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
 * `background-image`, which the layer rewrite must leave alone. `painted` says
 * whether this plugin tagged the zone at all, and `visible[0]` is the first
 * background a user actually meets under the cursor, read through both the elements
 * and their layers — which is what proves the layer is still on screen.
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
      filter: layer.filter,
      opacity: layer.opacity,
      zIndex: layer.zIndex,
      selfImage: self.backgroundImage,
      computed: self.backgroundColor,
      isolation: self.isolation,
      position_: self.position,
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
  // The surface must no longer carry the picture inline: that is the whole point of
  // the layer, so anything found here means the rewrite did not take effect.
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

const browser = await launch({ port: PORT })
const page = await attach(browser.endpoint)
let failures = 0

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

/** Load the app fresh with the token, and wait for the first paint. */
async function boot() {
  await page.navigate(`${BASE}/?token=${TOKEN}`)
  await page.waitFor(`typeof window.__DSH_BOOT__ !== 'undefined'`, { label: '__DSH_BOOT__' })
  await page.waitFor(`document.body.innerText.length > 50`, { label: 'the first paint' })
  await settled()
}

/**
 * Bring the Settings panel to a known state: open, with the card's options loaded.
 *
 * Only opening is attempted. The panel is a toggle with its own close button, so
 * guessing at a second click to close it is unreliable; the card renders before
 * its `fetch` resolves, so the loaded options are what this waits for.
 */
async function ensureCard() {
  if (!await page.evaluate(PANEL)) await page.clickText('设置')
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
async function selectTheme(id) {
  const stored = id === '' ? null : id
  const bytes = id === '' ? '=== 0' : '> 100'
  let lastError
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await ensureCard()
      assert.equal(await page.setValue('.dct-theme', id), true, 'the card select was not in the document')
      await page.waitFor(`localStorage.getItem('dsh-custom-theme.selected') === ${JSON.stringify(stored)}`,
        { label: 'the persisted selection', timeout: 8000 })
      await page.waitFor(`(document.querySelector('style[data-plugin="dsh-custom-theme"][data-role="theme"]')?.textContent ?? '').length ${bytes}`,
        { label: 'the stylesheet text', timeout: 8000 })
      return
    } catch (error) {
      lastError = error
      if (attempt < 3) await boot()
    }
  }
  throw lastError
}

try {
  console.log(`browser: ${browser.browser}`)
  await boot()

  console.log('\ncard discovery')
  await step('the plugin injected one style tag per concern', async () => {
    assert.equal((await page.evaluate(probe)).styleTags, 5)
  })
  await step('the controls render only on their own settings page', async () => {
    assert.equal(await page.evaluate(`document.querySelectorAll('.dct-theme').length`), 0)
    assert.equal(await page.clickText('设置'), true, 'no Settings button found')
    await page.waitFor(PANEL, { label: 'the settings panel' })
    assert.equal(await page.evaluate(`document.querySelectorAll('.dct-theme').length`), 0,
      'the controls rendered before their page was opened')
    assert.equal(await page.clickText(NAV_LABEL), true, 'no theme page in the settings nav')
    await page.waitFor(`document.querySelectorAll('.dct-theme').length === 1`, { label: 'the controls' })
  })
  await step('the card lists the Host directory themes', async () => {
    await ensureCard()
    const actual = await page.waitFor(OPTIONS_SETTLED, { label: 'the Host theme listing', timeout: 15_000 })
    assert.deepEqual(actual, EXPECTED_OPTIONS)
  })

  const baseline = await page.evaluate(probe)
  console.log(`\nbaseline --dsw-alias-bg-base on body: ${baseline.bodyBgBase}`)

  // Every bundled theme carries a light and a dark set, the way the files it was
  // ported from do, so the appearance switch has to move the theme between its two
  // sets and keep it selected. A theme that states one palette instead is dropped
  // by the switch, because half its tokens cannot follow the base palette.
  for (const id of ['gov', 'monokai-pro', 'one-dark']) {
    const light = await themeToken(id, '--dsw-alias-bg-base', 'light')
    const dark = await themeToken(id, '--dsw-alias-bg-base', 'dark')
    console.log(`\napplying ${id} (light ${light}, dark ${dark})`)
    await step(`selecting ${id} loads its stylesheet and persists it`, async () => {
      await selectTheme(id)
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
    await selectTheme('')
    const value = await page.evaluate(`(() => ({
      bgBase: getComputedStyle(document.body).getPropertyValue('--dsw-alias-bg-base').trim(),
      themeStyleBytes: (document.querySelector('style[data-plugin="dsh-custom-theme"][data-role="theme"]')?.textContent ?? '').length,
    }))()`)
    // A pair theme leaves the scheme to the preference, so what the built-in
    // palette resolves to depends on which side is active — what must be gone is
    // any token a theme declares, light or dark, which no built-in palette can
    // produce.
    const declared = await Promise.all(['gov', 'monokai-pro', 'one-dark'].flatMap((id) =>
      ['light', 'dark'].map((scheme) => themeToken(id, '--dsw-alias-bg-base', scheme))))
    assert.ok(!declared.includes(value.bgBase), `a themed token survived the clear: ${value.bgBase}`)
    assert.equal(value.themeStyleBytes, 0, 'the theme stylesheet was not emptied')
  })

  console.log('\nconversation stream')
  await step('the font-size control drives the official runtime', async () => {
    await page.setValue('.dct-fontsize', '16')
    await page.waitFor(`(${probe}).contentFontSize === '16px'`)
  })

  await step('the line-spacing control shifts every content line height', async () => {
    // Back to the shell's own size first, so the baseline is the 24px the shell
    // derives at 14px and the only variable left is the spacing this page adds.
    await page.setValue('.dct-fontsize', '14')
    await page.waitFor(`(${probe}).lineHeightProbe === '24px'`)
    await page.setValue('.dct-linegap', '3')
    await page.waitFor(`(${probe}).lineHeightProbe === '27px'`)
  })

  await step('the fonts are chosen from presets and persist', async () => {
    const controls = await page.evaluate(`(() => ({
      font: document.querySelector('.dct-font')?.tagName ?? null,
      code: document.querySelector('.dct-codefont')?.tagName ?? null,
      options: document.querySelectorAll('.dct-font option').length,
    }))()`)
    assert.equal(controls.font, 'SELECT', 'the text font is still free text')
    assert.equal(controls.code, 'SELECT', 'the code font is still free text')
    assert.ok(controls.options > 1, 'the text font offers no presets')
    await page.setValue('.dct-font', 'Georgia, "Times New Roman", serif')
    await page.setValue('.dct-codefont', '"Cascadia Mono", Consolas, monospace')
    await page.waitFor(`(${probe}).rootFontFamily.includes('Georgia')`)
    const value = await page.evaluate(probe)
    assert.ok(value.rootFontFamily.includes('Georgia'), `the text font did not apply: ${value.rootFontFamily}`)
    assert.ok(value.codeFontFamily.includes('Cascadia'), `the code font did not apply: ${value.codeFontFamily}`)
    assert.ok(value.appearanceCss.includes('--dsh-content-font-delta'), 'the delta override is missing from the stylesheet')
    assert.ok(value.savedAppearance?.includes('Georgia'), 'the choice was not persisted')
  })

  console.log('\npersistence across a reload')
  await step('a saved theme re-applies on boot, before Settings opens', async () => {
    await selectTheme('gov')
    await boot()
    await page.waitFor(`(document.querySelector('style[data-plugin="dsh-custom-theme"][data-role="theme"]')?.textContent ?? '').length > 100`,
      { label: 'the saved theme to apply on boot' })
    const value = await page.evaluate(probe)
    // The scheme the last theme was on persists too, so the expected set is
    // whichever one the booted window came up in.
    const scheme = await page.evaluate(`document.body.hasAttribute('data-ds-dark-theme') ? 'dark' : 'light'`)
    const expected = await themeToken('gov', '--dsw-alias-bg-base', scheme)
    assert.equal(value.bodyBgBase, expected)
    assert.equal(value.bodyColor, toRgb(expected))
  })
  await delay(300)
  await page.screenshot(`${SHOT_DIR}/shot-reloaded.png`)

  console.log('\nbackground images')
  await step('the font and line-spacing choices re-apply on boot', async () => {
    const value = await page.evaluate(probe)
    assert.equal(value.lineHeightProbe, '27px', 'the line spacing did not survive the reload')
    assert.ok(value.rootFontFamily.includes('Georgia'), `the text font did not survive the reload: ${value.rootFontFamily}`)
    assert.ok(value.codeFontFamily.includes('Consolas'), `the code font did not survive the reload: ${value.codeFontFamily}`)
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

  await step('the card lists every image dropped into the background directory', async () => {
    await ensureCard()
    await page.waitFor(`document.querySelectorAll('.dct-image option').length > 2`,
      { label: 'the background image options' })
    const names = await page.evaluate(`[...document.querySelectorAll('.dct-image option')].map((o) => o.value)`)
    assert.ok(names.includes(BACKGROUND_NAME) && names.includes(STRIPES_NAME), `options were ${JSON.stringify(names)}`)
  })

  await step('a global image paints every zone and is visible in them', async () => {
    await ensureCard()
    assert.equal(await page.evaluate(`document.querySelector('.dct-zone').value`), 'global')
    assert.equal(await page.setValue('.dct-image', BACKGROUND_NAME), true)
    await page.waitFor(`document.querySelectorAll('[data-dct-zone]').length >= 2`,
      { label: 'the painted zone surfaces' })
    const value = await page.evaluate(bgProbe)
    // The columns cover the frame completely, and their tints are translucent, so
    // the frame is deliberately left unpainted: painting it too would show the
    // same image twice and read stronger than the configured strength.
    assert.equal(value.global.painted, false, 'the fully covered frame was painted as well')
    const saved = JSON.parse(value.saved)
    for (const zone of ['windowbar', 'sidebar', 'conversation', 'composer']) {
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
    }
    // The tool panel column only exists while the dock is open.
    if (await page.evaluate(`document.querySelector('[data-rightbar-col]') !== null`)) {
      assert.equal(value.dock.painted, true, 'the open dock was not painted')
    }

    // The Settings panel is portalled over the whole window, so what is visible
    // under the cursor can only be sampled with it closed.
    const seen = await closedZones()
    for (const zone of ['global', 'sidebar', 'conversation']) {
      assert.ok(seen[zone].visible.length > 0, `nothing paints a background at the ${zone} sample point`)
      assert.ok(seen[zone].visible[0].image.includes(BACKGROUND_NAME),
        `the ${zone} sample point shows ${JSON.stringify(seen[zone].visible[0])}`)
    }
    await page.screenshot(`${SHOT_DIR}/shot-bg-global.png`)
  })

  await step('a per-zone image replaces the global one in that zone only', async () => {
    await ensureCard()
    assert.equal(await page.setValue('.dct-zone', 'sidebar'), true)
    assert.equal(await page.setValue('.dct-image', STRIPES_NAME), true)
    await page.waitFor(`getComputedStyle(document.querySelector('[data-dct-zone="sidebar"]'), '::before').backgroundImage.includes(${JSON.stringify(STRIPES_NAME)})`,
      { label: 'the sidebar image to change' })
    const value = await page.evaluate(bgProbe)
    assert.ok(value.conversation.image.includes(BACKGROUND_NAME), `conversation image was ${value.conversation.image}`)
    const seen = await closedZones()
    assert.ok(seen.sidebar.visible[0].image.includes(STRIPES_NAME), `the sidebar shows ${JSON.stringify(seen.sidebar.visible[0])}`)
    assert.ok(seen.conversation.visible[0].image.includes(BACKGROUND_NAME), `the conversation shows ${JSON.stringify(seen.conversation.visible[0])}`)
  })

  await step('the picture alpha moves only the zone it belongs to, not the panel fill', async () => {
    await ensureCard()
    // Re-opening the panel resets the zone picker, so select the sidebar again.
    assert.equal(await page.setValue('.dct-zone', 'sidebar'), true)
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
    assert.equal(await page.setValue('.dct-zone', 'sidebar'), true)
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
    assert.equal(await page.setValue('.dct-zone', 'sidebar'), true)
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
    assert.equal(await page.setValue('.dct-zone', 'sidebar'), true)
    assert.equal(await page.setValue('.dct-opacity', '90'), true)
    const saved = JSON.parse(await page.evaluate(`localStorage.getItem('dsh-custom-theme.backgrounds')`))
    assert.equal(saved.sidebar.opacity, 0.45, 'a value above the ceiling was not clamped')
    assert.equal(await page.evaluate(`document.querySelector('.dct-opacity').getAttribute('max')`), '45')
  })

  await step('the conversation zone can carry its own image too', async () => {
    await ensureCard()
    assert.equal(await page.setValue('.dct-zone', 'conversation'), true)
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
    for (const zoneId of ['global', 'sidebar', 'conversation']) {
      assert.equal(await page.setValue('.dct-zone', zoneId), true)
      assert.equal(await page.clickText('清除'), true, 'no clear button')
      await page.waitFor(`document.querySelector('.dct-image').value === ''`, { label: `the ${zoneId} zone to clear` })
    }
    const value = await page.evaluate(bgProbe)
    assert.equal(value.leftovers, 0, 'an inline background-image survived the clear')
    assert.deepEqual(value.inlineImages, [], 'a surface still carries an inline background-image')
    assert.deepEqual(value.inlineIsolation, [], 'a surface still carries the layer stacking context')
    assert.equal(value.zoneNodes, 0, 'a zone or layer attribute survived the clear')
    for (const zone of ['global', 'sidebar', 'conversation']) {
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
    assert.equal(await page.setValue('.dct-zone', 'global'), true)
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

  console.log(`\n${failures === 0 ? 'ALL STEPS PASSED' : `${failures} STEP(S) FAILED`}`)
  console.log(`screenshots in ${SHOT_DIR}`)
} finally {
  page.close()
  await browser.close()
  await delay(200)
}

process.exit(failures === 0 ? 0 : 1)
