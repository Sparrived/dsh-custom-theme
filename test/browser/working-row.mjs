import assert from 'node:assert/strict'
import { launch, attach, delay } from './driver.mjs'

/**
 * The working text and its effects in a real window.
 *
 * The configured phrase rewrites the wording the shell's running label is built from
 * («深度求索中»), and that label is only drawn while a turn is live — which this suite
 * cannot start. What a window can show, and what is asserted here, is everything around
 * it: the controls store what was chosen, the sample under them really wears the rules
 * the effect writes — read back through computed style rather than through the
 * stylesheet, on the sample's glyphs and on the band that sweeps them — and the plugin
 * adds nothing to the transcript, which is the regression the row-cloning implementation
 * had.
 *
 * The wording swap itself is covered by `test/client.test.mjs`, which drives the locale
 * lookup the label is read through. What the live label looks like, with the phrase and
 * the effect on it, is verified by hand: it needs a live turn.
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
/** The stylesheet the running label's effect is written into. */
const SHEET = `document.querySelector('style[data-plugin="dsh-custom-theme"][data-role="working"]')?.textContent ?? ''`
/** The stored choices, as the plugin persists them. */
const STORED = `(() => {
  try { return JSON.parse(localStorage.getItem('dsh-custom-theme.working') ?? 'null') } catch { return 'unparsable' }
})()`
/** The sample's own computed style, which is the only proof an effect reached it. */
const SAMPLE = (property) => `(() => {
  const sample = document.querySelector('.dct-work-effect')
  return sample === null ? null : getComputedStyle(sample)['${property}']
})()`
/** The sample's band, which is the half of it an effect tints. */
const BAND = (property) => `(() => {
  const band = document.querySelector('.dct-work-sweep')
  return band === null ? null : getComputedStyle(band)['${property}']
})()`
/** The copy of the text inside that band, which is what a spectrum fills. */
const BAND_TEXT = (property) => `(() => {
  const copy = document.querySelector('.dct-work-sweep-text')
  return copy === null ? null : getComputedStyle(copy)['${property}']
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

  console.log('\nthe controls store what is chosen')
  await step('configuring phrases stores them', async () => {
    await page.clickText('设置')
    await page.waitFor(`document.body.innerText.includes('通用设置')`)
    await page.clickText('主题与背景')
    await page.waitFor(`document.querySelector('.dct-working') !== null`, { timeout: 30_000 })
    await page.setValue('.dct-working', '正在深度求索\n稍等片刻')
    await page.waitFor(`JSON.stringify((${STORED})?.texts) === '["正在深度求索","稍等片刻"]'`, { timeout: 10_000 })
    const stored = await page.evaluate(STORED)
    assert.deepEqual(stored.texts, ['正在深度求索', '稍等片刻'], `the phrase list was not stored: ${JSON.stringify(stored)}`)
    assert.equal(typeof stored.interval, 'number', 'the rotation interval was not stored')
    // The shipped look is what an untouched plugin carries, and it writes no rules. The
    // choice is set rather than assumed, so a run after an aborted one starts level.
    assert.equal(await page.setValue('.dct-effect', 'official'), true, 'no effect control on the page')
    assert.equal(await page.evaluate(SHEET), '', 'an effect was written for the shipped look')
    assert.ok(await page.evaluate(`document.querySelector('.dct-work-effect') !== null`), 'the page shows no sample of the label')
  })

  console.log('\nthe sample wears the effect that is chosen')
  await step('a matte shimmer tints the sample’s band and leaves its glyphs solid', async () => {
    assert.equal(await page.setValue('.dct-effect', 'shimmer'), true, 'no effect control on the page')
    await page.waitFor(`(${SHEET}).includes('--dsw-alias-label-shimmer')`, { timeout: 10_000 })
    const sheet = await page.evaluate(SHEET)
    assert.ok(sheet.includes('color: #4176e6 !important;'), 'the label’s own colour is not in the rules')
    assert.ok(sheet.includes('--dsw-alias-label-shimmer: #5ee0ff !important;'), 'the band’s colour is not in the rules')
    assert.ok(!sheet.includes('display: none'), "the shell's own band was switched off, so nothing would sweep at all")
    assert.ok(!sheet.includes('text-fill-color'), 'the glyphs were filled, which is the look the matte style replaced')
    // Computed style is the proof it reached the element: the sample's own glyphs keep
    // their colour, and the band carrying the tint is a separate element that runs.
    assert.equal(await page.evaluate(SAMPLE('webkitTextFillColor')), 'rgb(65, 118, 230)', 'the sample’s glyphs are not painted by their own colour')
    assert.equal(await page.evaluate(BAND('color')), 'rgb(94, 224, 255)', 'the sample’s band did not take the colour')
    assert.ok((await page.evaluate(BAND('animationName'))).includes('dct-work-band'), 'the sample’s band is not animating')
    assert.equal(await page.evaluate(`(${STORED})?.effect`), 'shimmer', 'the effect was not stored')
    // The choices that belong to this effect are the ones the page offers beside it.
    assert.equal(await page.evaluate(`document.querySelector('.dct-shimmer') !== null`), true, 'the shimmer style control is missing')
    assert.equal(await page.evaluate(`document.querySelector('.dct-work-sweep-color') !== null`), true, 'the sweep colour control is missing')
  })

  await step('七彩光 puts the spectrum in the band, not over the sample', async () => {
    assert.equal(await page.setValue('.dct-shimmer', 'rainbow'), true, 'no shimmer style control on the page')
    await page.waitFor(`(${SHEET}).includes('#ff5a5a')`, { timeout: 10_000 })
    const sheet = await page.evaluate(SHEET)
    assert.ok(sheet.includes('.dct-work-effect .dct-work-sweep-text {'), 'the sample’s band carries no spectrum')
    // The label underneath keeps its solid colour, which is what the matte rework is for.
    assert.equal(await page.evaluate(SAMPLE('webkitTextFillColor')), 'rgb(65, 118, 230)', 'the sample’s own glyphs were filled with the spectrum')
    const band = await page.evaluate(BAND_TEXT('backgroundImage'))
    assert.ok(/rgb\(255, 90, 90\)/.test(band), `the sample’s band is not wearing the spectrum: ${band}`)
    // The spectrum is fixed, so the sweep colour is not offered beside it.
    assert.equal(await page.evaluate(`document.querySelector('.dct-work-sweep-color') !== null`), false, 'a colour the style cannot use is still offered')
  })

  await step('a colour is taken from the picker into the rules', async () => {
    assert.equal(await page.setValue('.dct-shimmer', 'matte'), true, 'no shimmer style control on the page')
    await page.waitFor(`document.querySelector('.dct-work-sweep-color') !== null`, { timeout: 10_000 })
    assert.equal(await page.setValue('.dct-work-color', '#ff0000'), true, 'no colour control on the page')
    await page.waitFor(`(${SHEET}).includes('color: #ff0000 !important')`, { timeout: 10_000 })
    assert.equal(await page.evaluate(SAMPLE('color')), 'rgb(255, 0, 0)', 'the sample did not take the chosen colour')
    assert.equal(await page.evaluate(`(${STORED})?.color`), '#ff0000', 'the colour was not stored')
    assert.equal(await page.setValue('.dct-work-sweep-color', '#00ff00'), true, 'no sweep colour control on the page')
    await page.waitFor(`(${SHEET}).includes('--dsw-alias-label-shimmer: #00ff00 !important')`, { timeout: 10_000 })
    assert.equal(await page.evaluate(BAND('color')), 'rgb(0, 255, 0)', 'the sample’s band did not take the chosen colour')
    assert.equal(await page.evaluate(`(${STORED})?.sweep`), '#00ff00', 'the sweep colour was not stored')
  })

  await step('静态 keeps the sample’s colour and stops its band', async () => {
    assert.equal(await page.setValue('.dct-effect', 'none'), true)
    await page.waitFor(`(${SHEET}).includes('display: none !important')`, { timeout: 10_000 })
    assert.equal(await page.evaluate(BAND('display')), 'none', 'the sample’s band still glides over a still label')
    assert.equal(await page.evaluate(SAMPLE('color')), 'rgb(255, 0, 0)', 'the still sample did not keep the colour that was chosen')
  })

  await step('hiding the indicator shows the note and collapses the bar', async () => {
    assert.equal(await page.setValue('.dct-effect', 'hidden'), true)
    await page.waitFor(`document.querySelector('.dct-work-preview-note') !== null`, { timeout: 10_000 })
    assert.equal(await page.evaluate(SHEET), '[data-chat-running] > :not([role="status"]) { display: none !important; }\n')
    assert.equal(await page.evaluate(`document.querySelector('.dct-work-effect') !== null`), false, 'a sample is still shown for a hidden indicator')
  })

  await step('going back to the shipped look takes the rules away', async () => {
    assert.equal(await page.setValue('.dct-effect', 'official'), true)
    await page.waitFor(`(${SHEET}) === ''`, { timeout: 10_000 })
    // Nothing of the plugin's is left on the sample: with no rules of its own the band is
    // painted by the shell's palette token again, as the shipped look paints it.
    const colour = await page.evaluate(BAND('color'))
    assert.notEqual(colour, 'rgb(0, 255, 0)', 'the sample kept the colour an effect had set')
  })

  console.log('\nand the transcript is left alone')
  await step('a configured phrase and effect add no row and no stylesheet', async () => {
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
