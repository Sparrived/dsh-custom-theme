import assert from 'node:assert/strict'
import { launch, attach, delay } from './driver.mjs'

/**
 * The working-indicator row is opt-in: with no phrase configured the shell's own
 * row must stay exactly in place, and a configured phrase must swap in the
 * plugin's replacement.
 *
 * The phrase itself only renders while a Turn is live, which this suite cannot
 * start; what it can prove is the swap, and the label the replacement resolves for
 * a finished Turn. The running-phrase rotation is verified by hand instead.
 */

const TOKEN = process.env.DCT_TOKEN
if (TOKEN === undefined) throw new Error('DCT_TOKEN is required')
const BASE = process.env.DCT_BASE ?? 'http://127.0.0.1:3080'

let failures = 0
let steps = 0

async function step(name, fn) {
  steps += 1
  try {
    await fn()
    console.log(`  PASS  ${name}`)
  } catch (error) {
    failures += 1
    console.log(`  FAIL  ${name}\n        ${error.message}`)
  }
}

/** The shipped row is `[data-turn-process]`; the replacement carries this class. */
const OFFICIAL = `document.querySelectorAll('[data-turn-process]').length`
const MINE = `document.querySelectorAll('.dct-turn-row').length`
const MY_LABEL = `document.querySelector('.dct-turn-label')?.textContent ?? null`

/** Geometry probe, so the shipped row and the replacement can be compared. */
const geometry = (selector) => `(() => {
  const row = document.querySelector('${selector}')
  if (row === null) return null
  const style = getComputedStyle(row)
  const label = row.children[0]
  return {
    display: style.display,
    padding: style.padding,
    height: style.height,
    borderBottom: style.borderBottom,
    color: style.color,
    labelFontSize: getComputedStyle(label).fontSize,
    labelLineHeight: getComputedStyle(label).lineHeight,
    statusRole: row.previousElementSibling?.getAttribute('role') ?? null,
    turn: row.getAttribute('data-turn-process'),
  }
})()`

/** Geometry of the shipped row, captured before the replacement takes over. */
let shipped = null
const browser = await launch({ port: 9360 })
const page = await attach(browser.endpoint)

try {
  await page.navigate(`${BASE}/?token=${TOKEN}`)
  await page.waitFor(`typeof window.__DSH_BOOT__ !== 'undefined'`)
  await delay(4500)

  console.log('\nthe shipped row stays in place')
  await step('a session with turns exposes the shipped row and nothing of ours', async () => {
    const opened = await page.evaluate(`(() => {
      const rows = [...document.querySelectorAll('[role="treeitem"]')]
        .filter((el) => /(分钟|小时)/.test(el.innerText || ''))
      if (rows.length === 0) return null
      rows[0].click()
      return (rows[0].innerText || '').slice(0, 30)
    })()`)
    assert.ok(opened !== null, 'no session row to open')
    await page.waitFor(`${OFFICIAL} > 0`, { timeout: 30_000 })
    shipped = await page.evaluate(geometry('[data-turn-process]'))
    assert.ok(shipped !== null, 'no shipped row to measure')
    assert.equal(await page.evaluate(MINE), 0, 'the replacement row mounted with no phrase configured')
  })

  console.log('\na phrase swaps in the replacement')
  await step('configuring a phrase mounts the replacement row', async () => {
    await page.clickText('设置')
    await page.waitFor(`document.body.innerText.includes('通用设置')`)
    await page.clickText('主题与背景')
    await page.waitFor(`document.querySelector('.dct-working') !== null`, { timeout: 30_000 })
    await page.setValue('.dct-working', '正在深度求索\n稍等片刻')
    await page.waitFor(`${MINE} > 0`, { timeout: 30_000 })
    assert.ok(await page.evaluate(MINE) > 0, 'the replacement did not mount')
  })

  await step('the replacement reproduces the shipped row, property by property', async () => {
    const mine = await page.evaluate(geometry('.dct-turn-row'))
    assert.ok(mine !== null, 'no replacement row to measure')
    const differences = Object.keys(shipped)
      .filter((key) => shipped[key] !== mine[key])
      .map((key) => `${key}: shipped ${shipped[key]} vs replacement ${mine[key]}`)
    assert.deepEqual(differences, [], `the replacement drifted from the shipped row:\n        ${differences.join('\n        ')}`)
  })

  await step('a finished turn reads with a shipped phrasing, not a broken template', async () => {
    const label = await page.evaluate(MY_LABEL)
    assert.ok(typeof label === 'string' && label.length > 0, `the label is empty: ${label}`)
    assert.ok(!label.includes('{') && !label.includes('duration.'), `a placeholder leaked into the label: ${label}`)
  })

  console.log('\nclearing the phrase restores the shipped row')
  await step('emptying the phrase unmounts the replacement', async () => {
    await page.setValue('.dct-working', '')
    await page.waitFor(`${MINE} === 0`, { timeout: 30_000 })
    assert.equal(await page.evaluate(MINE), 0, 'the replacement stayed mounted')
    assert.ok(await page.evaluate(OFFICIAL) > 0, 'the shipped row did not come back')
  })

  console.log(`\n${steps - failures}/${steps} steps passed`)
  if (failures > 0) process.exitCode = 1
} finally {
  console.log('diagnostics:', page.diagnostics.length === 0 ? 'clean' : page.diagnostics.slice(0, 3).join(' | '))
  page.close()
  await browser.close()
}
