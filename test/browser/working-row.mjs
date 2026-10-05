import assert from 'node:assert/strict'
import { launch, attach, delay } from './driver.mjs'

/**
 * The working-text control in a real window.
 *
 * The configured phrase rewrites the wording the shell's running label is built from
 * («深度求索中»), and that label is only drawn while a turn is live — which this suite
 * cannot start. What a window can show, and what is asserted here, is the control
 * itself and its blast radius: the phrase is stored as typed, and configuring one adds
 * nothing to the transcript. The shipped rows stay exactly where they were, which is
 * the regression the row-cloning implementation had — it put its own row above the
 * reasoning rows instead of rewording the label.
 *
 * The swap itself is covered by `test/client.test.mjs`, which drives the locale lookup
 * the label is read through. What the label looks like on screen, with the phrase in
 * place of the shipped wording and the shell's own clock after it, is verified by hand:
 * it needs a live turn, and reading it needs the phrase configured first.
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

/** The shell's own disclosure rows, and the replacement this plugin used to mount. */
const SHIPPED_ROWS = `document.querySelectorAll('[data-turn-process]').length`
const OUR_ROWS = `document.querySelectorAll('.dct-turn-row').length`
/** The stylesheet the replacement row carried, addressed by its own data attributes. */
const OUR_STYLES = `document.querySelectorAll('style[data-plugin="dsh-custom-theme"][data-role="turn-row"]').length`
/** The stored choices, as the plugin persists them. */
const STORED = `(() => {
  try { return JSON.parse(localStorage.getItem('dsh-custom-theme.working') ?? 'null') } catch { return 'unparsable' }
})()`

const browser = await launch({ port: 9361 })
const page = await attach(browser.endpoint)

try {
  await page.navigate(`${BASE}/?token=${TOKEN}`)
  await page.waitFor(`typeof window.__DSH_BOOT__ !== 'undefined'`)
  await delay(4500)

  console.log('\nthe plugin owns no transcript row')
  await step('a session with turns shows the shipped rows only', async () => {
    const opened = await page.evaluate(`(() => {
      const rows = [...document.querySelectorAll('[role="treeitem"]')]
        .filter((el) => /(分钟|小时)/.test(el.innerText || ''))
      if (rows.length === 0) return null
      rows[0].click()
      return (rows[0].innerText || '').slice(0, 30)
    })()`)
    assert.ok(opened !== null, 'no session row to open')
    await page.waitFor(`${SHIPPED_ROWS} > 0`, { timeout: 30_000 })
    assert.equal(await page.evaluate(OUR_ROWS), 0, 'a replacement row is mounted')
    assert.equal(await page.evaluate(OUR_STYLES), 0, "the replacement row's stylesheet is installed")
  })

  console.log('\nthe control stores what is typed')
  await step('configuring a phrase stores it', async () => {
    await page.clickText('设置')
    await page.waitFor(`document.body.innerText.includes('通用设置')`)
    await page.clickText('主题与背景')
    await page.waitFor(`document.querySelector('.dct-working') !== null`, { timeout: 30_000 })
    await page.setValue('.dct-working', '正在深度求索\n稍等片刻')
    await page.waitFor(`JSON.stringify((${STORED})?.texts) === '["正在深度求索","稍等片刻"]'`, { timeout: 10_000 })
    const stored = await page.evaluate(STORED)
    assert.deepEqual(stored.texts, ['正在深度求索', '稍等片刻'], `the phrase list was not stored: ${JSON.stringify(stored)}`)
    assert.equal(typeof stored.interval, 'number', 'the rotation interval was not stored')
  })

  console.log('\nand the transcript is left alone')
  await step('a configured phrase adds no row and no stylesheet', async () => {
    assert.equal(await page.evaluate(OUR_ROWS), 0, 'a replacement row appeared once a phrase was configured')
    assert.equal(await page.evaluate(OUR_STYLES), 0, "the replacement row's stylesheet appeared once a phrase was configured")
    assert.ok(await page.evaluate(SHIPPED_ROWS) > 0, 'the shipped rows disappeared')
  })

  console.log('\nclearing the phrase empties the list')
  await step('an emptied list is stored as no phrases', async () => {
    await page.setValue('.dct-working', '')
    await page.waitFor(`JSON.stringify((${STORED})?.texts) === '[]'`, { timeout: 10_000 })
    const stored = await page.evaluate(STORED)
    assert.deepEqual(stored.texts, [], `the phrase list was not cleared: ${JSON.stringify(stored)}`)
    assert.equal(await page.evaluate(OUR_ROWS), 0, 'a replacement row came back')
  })

  console.log(`\n${steps - failures}/${steps} steps passed`)
  if (failures > 0) process.exitCode = 1
} finally {
  console.log('diagnostics:', page.diagnostics.length === 0 ? 'clean' : page.diagnostics.slice(0, 3).join(' | '))
  page.close()
  await browser.close()
}
