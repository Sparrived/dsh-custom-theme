/**
 * Real-browser smoke test for the start-page heatmap.
 *
 * The card only exists after the shell has drawn its hero and mounted the
 * composer dock, so this drives a running `dsh web` the way a user does:
 * switch ranges, open Settings → 热力图, turn the card off and on, and open a
 * conversation to make sure the dock seat leaves no panel behind.
 *
 * Usage:
 *   dsh --profile <name> --patch dev.heatmap.yml --no-open
 *   set DCT_TOKEN=<token from the printed URL>
 *   node test/browser/heatmap.mjs
 */
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { attach, delay, launch } from './driver.mjs'

const BASE = process.env.DCT_BASE ?? 'http://127.0.0.1:3099'
const TOKEN = process.env.DCT_TOKEN
const PORT = Number(process.env.DCT_CDP_PORT ?? 9426)
const SHOT_DIR = process.env.DCT_SHOT_DIR ?? fileURLToPath(new URL('../../', import.meta.url))

if (!TOKEN) {
  console.error('DCT_TOKEN is required: copy it from the "dsh web: http://…/?token=…" line.')
  process.exit(2)
}

const PAGE_URL = `${BASE}/?token=${encodeURIComponent(TOKEN)}`
const CARD = `document.querySelector('[data-dct-heatmap]')`

/** Open the account menu and the Settings panel, the way the shell asks. */
async function openSettings(page) {
  const opened = await page.evaluate(`(() => {
    const trigger = document.querySelector('[data-slot="settings.launcher"] button[aria-haspopup="menu"]');
    if (!trigger) return false;
    trigger.click();
    return true;
  })()`)
  assert.equal(opened, true, 'no account menu to open Settings from')
  await page.waitFor(`document.body.innerText.includes('设置')`, { timeout: 5000 })
  assert.equal(await page.clickText('设置'), true, 'no Settings entry in the account menu')
  await page.waitFor(`document.body.innerText.includes('通用设置')`, { timeout: 15000 })
}

/** Reach the plugin's own page, then its heatmap tab. */
async function openHeatmapCard(page) {
  await openSettings(page)
  const nav = await page.evaluate(`(() => {
    const hit = [...document.querySelectorAll('button')].find((button) =>
      button.textContent.trim() === '主题与背景' && button.closest('[role="tablist"]') === null);
    if (!hit) return false;
    hit.click();
    return true;
  })()`)
  assert.equal(nav, true, 'no plugin settings nav entry')
  const tab = await page.evaluate(`(() => {
    const hit = [...document.querySelectorAll('.dct-page [role="tablist"] button[role="tab"]')].find((button) => button.textContent.trim() === '热力图');
    if (!hit) return false;
    hit.click();
    return true;
  })()`)
  assert.equal(tab, true, 'no heatmap settings tab')
  await page.waitFor(`document.querySelector('.dct-page [role="tablist"] button[aria-selected="true"]')?.textContent.trim() === '热力图'`, { timeout: 5000 })
  await page.waitFor(`document.querySelector('[data-card="heatmap"]')`, { timeout: 15000 })
  const tabs = await page.evaluate(`[...document.querySelectorAll('.dct-page [role="tablist"] button[role="tab"]')].map((tab) => ({
    text: tab.textContent.trim(),
    width: tab.clientWidth,
    needed: tab.scrollWidth,
  }))`)
  assert.ok(tabs.length >= 7, 'the heatmap tab did not join the settings strip')
  assert.ok(tabs.every((tab) => tab.text.length > 0 && tab.needed <= tab.width + 1), `a settings tab is clipped: ${JSON.stringify(tabs)}`)
}

/** Close the settings panel through its own button. */
async function closeSettings(page) {
  assert.equal(await page.clickText('关闭'), true, 'no close button in Settings')
  await page.waitFor(`!document.body.innerText.includes('通用设置')`, { timeout: 5000 })
}

/** Click one heatmap range pill. */
async function clickRange(page, label) {
  const clicked = await page.evaluate(`(() => {
    const hit = [...document.querySelectorAll('.dct-heatmap-range')].find((button) => button.textContent.trim() === ${JSON.stringify(label)});
    if (!hit) return false;
    hit.click();
    return true;
  })()`)
  assert.equal(clicked, true, `no ${label} range pill`)
  await page.waitFor(`localStorage.getItem('dsh-custom-theme.heatmap')?.includes(${JSON.stringify(`"range":"${label === '30 天' ? '30d' : label === '7 天' ? '7d' : 'all'}"`)})`, { timeout: 5000 })
}

const browser = await launch({ port: PORT })
const page = await attach(browser.endpoint)
try {
  await page.navigate(PAGE_URL)
  await page.waitFor(`document.body && document.body.innerText.length > 20`, { timeout: 30000 })
  await page.evaluate(`localStorage.removeItem('dsh-custom-theme.heatmap')`)
  await page.navigate(PAGE_URL)
  await page.waitFor(CARD, { timeout: 30000 })
  await delay(800)

  const initial = await page.evaluate(`(() => {
    const card = ${CARD};
    const values = [...card.querySelectorAll('.dct-heatmap-stat-value')].map((node) => node.textContent.trim());
    const cells = [...card.querySelectorAll('.dct-heatmap-cell')];
    const textarea = document.querySelector('textarea, [contenteditable="true"], [role="textbox"]');
    const workspace = document.querySelector('[class*="heroWorkspaceRow"]');
    const composer = document.querySelector('[data-slot="conversation.composer.bar"] > *');
    return {
      display: getComputedStyle(card).display,
      values,
      cells: cells.length,
      levels: [...new Set(cells.map((cell) => cell.getAttribute('data-level')))].sort(),
      cardBottom: card.getBoundingClientRect().bottom,
      textareaTop: textarea ? textarea.getBoundingClientRect().top : Infinity,
      workspaceTop: workspace ? workspace.getBoundingClientRect().top : Infinity,
      workspaceBottom: workspace ? workspace.getBoundingClientRect().bottom : Infinity,
      composerTop: composer ? composer.getBoundingClientRect().top : Infinity,
      ranges: [...card.querySelectorAll('.dct-heatmap-range')].map((button) => button.textContent.trim()),
    };
  })()`)
  assert.equal(initial.display, 'block', 'the heatmap is not visible on the hero')
  assert.equal(initial.values.length, 6, 'the panel does not draw six stat cells')
  assert.ok(initial.values.every((value) => value.length > 0), 'a stat cell is empty')
  assert.ok(initial.cells >= 26 * 7, 'the grid does not cover 26 weeks')
  assert.deepEqual(initial.ranges, ['全部', '30 天', '7 天'])
  assert.ok(initial.cardBottom <= initial.textareaTop, 'the card is not above the composer')
  assert.ok(initial.cardBottom <= initial.workspaceTop, 'the workspace row did not move below the card')
  assert.ok(initial.workspaceBottom <= initial.composerTop, 'the workspace row is not directly above the composer')
  assert.ok(initial.levels.some((level) => Number(level) > 0), 'the grid has no filled day')

  const allSessions = Number(initial.values[0].replaceAll(',', ''))
  await clickRange(page, '7 天')
  const week = await page.evaluate(`(() => {
    const card = ${CARD};
    return {
      sessions: Number(card.querySelectorAll('.dct-heatmap-stat-value')[0].textContent.replaceAll(',', '')),
      pressed: [...card.querySelectorAll('.dct-heatmap-range')].find((button) => button.textContent.trim() === '7 天').getAttribute('aria-pressed'),
    };
  })()`)
  assert.equal(week.pressed, 'true', 'the 7-day pill did not become active')
  assert.ok(week.sessions <= allSessions, 'the 7-day range increased the session count')
  await clickRange(page, '全部')
  await delay(200)
  await page.screenshot(`${SHOT_DIR}/shot-heatmap-start.png`)

  // The settings card is the same store as the hero panel: turning it off
  // removes the dock content, and turning it on brings it back without a reload.
  await openHeatmapCard(page)
  const settings = await page.evaluate(`(() => {
    const card = document.querySelector('[data-card="heatmap"]');
    return {
      text: card.innerText,
      enabled: card.querySelector('input[type="checkbox"]').checked,
      range: card.querySelector('select').value,
    };
  })()`)
  assert.match(settings.text, /开始页面热力图/u)
  assert.equal(settings.enabled, true)
  assert.equal(settings.range, 'all')
  await page.screenshot(`${SHOT_DIR}/shot-heatmap-settings.png`)

  await page.evaluate(`document.querySelector('[data-card="heatmap"] input[type="checkbox"]').click()`)
  await page.waitFor(`!document.querySelector('[data-dct-heatmap]')`, { timeout: 5000 })
  assert.match(await page.evaluate(`localStorage.getItem('dsh-custom-theme.heatmap')`), /"enabled":false/u)
  await page.evaluate(`document.querySelector('[data-card="heatmap"] input[type="checkbox"]').click()`)
  await page.waitFor(CARD, { timeout: 5000 })
  assert.equal(await page.evaluate(`document.querySelector('[data-card="heatmap"] input[type="checkbox"]').checked`), true)
  await closeSettings(page)
  await page.waitFor(CARD, { timeout: 5000 })

  // A conversation shares the dock seat; the card must leave the DOM entirely.
  const opened = await page.evaluate(`(() => {
    const row = document.querySelector('[data-row-key^="session:"]:not([aria-selected="true"])');
    if (!row) return false;
    row.click();
    return true;
  })()`)
  assert.equal(opened, true, 'no session row to open')
  await page.waitFor(`document.querySelector('[data-content-phase="active"]')`, { timeout: 10000 })
  assert.equal(await page.evaluate(`document.querySelector('[data-dct-heatmap]') === null`), true, 'the card stayed in a conversation')
  const newSession = await page.evaluate(`(() => {
    const button = document.querySelector('[aria-label="新建会话"]');
    if (!button) return false;
    button.click();
    return true;
  })()`)
  assert.equal(newSession, true, 'no new-session button to return to the hero')
  await page.waitFor(`document.querySelector('[data-content-phase="hero"]') && ${CARD}`, { timeout: 15000 })
  assert.equal(await page.evaluate(`getComputedStyle(${CARD}).display`), 'block', 'the heatmap did not return to the hero')
  console.log('heatmap browser smoke test passed')
} finally {
  await page.evaluate(`localStorage.setItem('dsh-custom-theme.heatmap', JSON.stringify({ enabled: true, range: 'all' }))`).catch(() => {})
  await page.close()
  await browser.close()
}
