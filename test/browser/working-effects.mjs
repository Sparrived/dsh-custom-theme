import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { boot } from '../harness.mjs'
import { launch, attach, delay } from './driver.mjs'

/**
 * The working-label effects against the row they dress, in a real browser.
 *
 * This suite needs no DSH instance and no live turn, because the thing under test is the
 * stylesheet: it stands the shell's running row up as a fixture — the markup and the
 * module CSS transcribed from the installed build, `data-shimmer` root, the decorative
 * `aria-hidden` band and the two animations that slide it across the text — and then
 * injects the very rules the plugin generates for each choice.
 *
 * What is at stake is the finish. The effects used to fill the glyphs themselves with a
 * travelling gradient and make their fill transparent, which is a glossier look than the
 * shell's and which fails badly when the gradient runs out: those glyphs have no fill and
 * nothing behind them. Now the label keeps one solid colour and only the shell's own
 * masked band is tinted, so the interesting claims are that the band really is a window —
 * it paints as it crosses and paints nothing at all once it is past either end — and that
 * nothing but the label's own colour draws it.
 *
 * The last step stands the plugin page's sample up the same way, from the page stylesheet
 * the plugin itself writes, because that sample is a second carrier of the same mechanic.
 * `working-row.mjs` drives the real page; this one drives the real CSS.
 */

/** The running row as the installed build renders it, with its class names spelled out. */
const ROW = `
<div class="bar" data-chat-running="">
  <span class="visually-hidden" role="status" aria-live="polite" aria-atomic="true">深度求索中</span>
  <span class="divider" aria-hidden="true"></span>
  <span class="content">
    <span class="icon" aria-hidden="true"></span>
    <span class="root" data-shimmer="">
      <span class="content" data-shimmer-content="">
        <span class="text" data-shimmer-text="深度求索中，用时 13秒 ···"></span>
      </span>
      <span class="decoration" aria-hidden="true" inert="">
        <span class="sweep">
          <span class="content highlight" data-shimmer-content="">
            <span class="text" data-shimmer-text="深度求索中，用时 13秒 ···"></span>
          </span>
        </span>
      </span>
    </span>
  </span>
</div>
`

/** The plugin page's sample, as its own JSX renders it: the label, and its band. */
const SAMPLE = `
<div class="dct-work-preview">
  <span class="dct-work-effect">深度求索中，用时 13秒 ···<span class="dct-work-sweep" aria-hidden="true"><span class="dct-work-sweep-text">深度求索中，用时 13秒 ···</span></span></span>
  <small>预览</small>
</div>
`

/**
 * The shell's own CSS for that row, as installed: the bar's colour and stacking, and the
 * sweep the shell runs across the text (`--dsw-alias-label-shimmer` is near-white in the
 * dark palette, so the band is the one thing an effect has to recolour rather than hide).
 */
const SHELL_CSS = `
body { margin: 0; padding: 24px; background: #1b1b1f; color: #e6e6e6; font: 14px/1.5 system-ui, sans-serif; }
.bar { --dsw-alias-label-deep-diving: #4176e6; --dsw-alias-label-shimmer: #f5f6f7;
  display: flex; flex-direction: column; align-items: flex-start; color: var(--dsw-alias-label-deep-diving);
  font-size: 12px; line-height: 22px; }
.divider { width: 100%; height: 0.5px; margin: 8px 0 10px; background: currentColor; display: none; }
.content { display: inline-flex; align-items: center; gap: 6px; min-width: 0; }
.icon { display: inline-block; width: 12px; height: 12px; background: currentColor; contain: strict; }
.visually-hidden { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip-path: inset(50%); }
.root { position: relative; display: inline-grid; width: max-content; max-width: 100%; vertical-align: top; }
.root > .content { display: flex; align-items: center; min-width: 0; }
.text[data-shimmer-text]::after { content: attr(data-shimmer-text); }
.decoration { position: absolute; inset: 0; overflow: clip; pointer-events: none; user-select: none; }
.sweep { position: absolute; inset: 0; overflow: hidden; color: var(--dsw-alias-label-shimmer);
  mask-image: linear-gradient(105deg, transparent 0%, black 40% 60%, transparent 100%);
  transform: translateX(-100%); animation: dsh-row-shimmer-sweep 1.5s steps(48, end) infinite; }
.sweep [data-shimmer-decoration] { background: currentColor; }
.sweep * { color: inherit !important; }
.highlight { width: 100%; height: 100%; transform: translateX(100%); animation: dsh-row-shimmer-highlight 1.5s steps(48, end) infinite; }
@keyframes dsh-row-shimmer-sweep { 0% { transform: translateX(-100%); } 66.6667%, 100% { transform: translateX(100%); } }
@keyframes dsh-row-shimmer-highlight { 0% { transform: translateX(100%); } 66.6667%, 100% { transform: translateX(-100%); } }
`

/** The plugin page's own stylesheet, which is what builds the sample's band. */
const PAGE_CSS = boot({ working: { texts: ['深度求索中'] } }).pageCss()
assert.ok(PAGE_CSS.includes('@keyframes dct-work-band'), 'the page stylesheet no longer carries the sample’s band')

/** The choices the fixtures are dressed with: Deeptop's own defaults. */
const CHOICES = { texts: ['深度求索中'], interval: 2400, color: '#4176e6', sweep: '#5ee0ff' }
const TEXT_COLOUR = 'rgb(65, 118, 230)'
const SWEEP_COLOUR = 'rgb(94, 224, 255)'
/** The palette's own band colour, which the shipped look should still be wearing. */
const SHIPPED_SWEEP = 'rgb(245, 246, 247)'

/** The rules the plugin generates for each choice, through the same boot the unit suite uses. */
function effectCss(working) {
  return boot({ working: { ...CHOICES, ...working } }).effectCss()
}

const EFFECTS = {
  official: effectCss({ effect: 'official' }),
  matte: effectCss({ effect: 'shimmer', shimmer: 'matte' }),
  rainbow: effectCss({ effect: 'shimmer', shimmer: 'rainbow' }),
  none: effectCss({ effect: 'none' }),
  hidden: effectCss({ effect: 'hidden' }),
}

/** Where the diagnostic captures go, as the other browser suite does it. */
const SHOT_DIR = process.env.DCT_SHOT_DIR ?? fileURLToPath(new URL('../../', import.meta.url))

assert.equal(EFFECTS.official, '', 'the shipped look should write nothing at all')
assert.ok(EFFECTS.matte.includes('--dsw-alias-label-shimmer: #5ee0ff'), 'the matte rules were not generated')
assert.ok(EFFECTS.rainbow.includes('#ff5a5a'), 'the spectrum rules were not generated')

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

const CSS_OF = (selector, property) => `(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  return el === null ? null : getComputedStyle(el)[${JSON.stringify(property)}];
})()`

const BOX_OF = (selector) => `(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (el === null) return null;
  const box = el.getBoundingClientRect();
  return { width: Math.round(box.width * 10) / 10, height: Math.round(box.height * 10) / 10, left: Math.round(box.left * 10) / 10, top: Math.round(box.top * 10) / 10 };
})()`

/** Add a stylesheet after the effect's, the way a stronger override arrives. */
const OVERRIDE = (css) => `(() => {
  const style = document.createElement('style');
  style.textContent = ${JSON.stringify(css)};
  document.head.append(style);
  return true;
})()`

const browser = await launch({ port: 9362 })
const page = await attach(browser.endpoint)

/**
 * Stand a fixture up with one effect's rules beside the shell's own.
 * @param css - The generated effect stylesheet, empty for the shipped look.
 * @param options - `markup` to render, and whether the page's own stylesheet comes too.
 */
async function render(css, options = {}) {
  const { markup = ROW, page: withPage = false } = options
  await page.evaluate(`(() => {
    document.head.innerHTML = '';
    const shell = document.createElement('style');
    shell.textContent = ${JSON.stringify(SHELL_CSS)};
    document.head.append(shell);
    ${withPage ? `const pageStyle = document.createElement('style');
    pageStyle.textContent = ${JSON.stringify(PAGE_CSS)};
    document.head.append(pageStyle);` : ''}
    const effect = document.createElement('style');
    effect.textContent = ${JSON.stringify(css)};
    document.head.append(effect);
    document.body.innerHTML = ${JSON.stringify(markup)};
    return true;
  })()`)
  await delay(120)
}

/** The box a selector occupies on screen, as a capture region. */
async function clipOf(selector) {
  const box = await page.evaluate(BOX_OF(selector))
  assert.ok(box !== null && box.width > 0, `${selector} has no box to capture`)
  return { x: box.left, y: box.top, width: box.width, height: box.height, scale: 1 }
}

/** Capture a region of the page. @param clip - Capture region. @returns Base64 PNG data. */
async function frame(clip) {
  const { data } = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, clip })
  return data
}

/**
 * Park every animation at a point in its cycle.
 *
 * The band's two animations are 1.5 s long and travel from one end of the label to the
 * other: parked at 0 ms it sits entirely before the label, at 500 ms it is over it, and
 * from 1250 ms it has gone past it — the travel is stepped, so the last step lands a
 * little after the 1000 ms keyframe rather than exactly on it. Freezing there is what
 * makes two captures comparable, and what turns "the band tints the label as it crosses"
 * into something a pixel can answer.
 * @param ms - The point to park at.
 */
async function freeze(ms) {
  await page.evaluate(`document.getAnimations().forEach((animation) => { animation.pause(); animation.currentTime = ${ms} })`)
  await delay(60)
}

/**
 * A horizontal slice of a capture region, as fractions of its width.
 * @param clip - The region to slice.
 * @param from - Left edge, as a fraction.
 * @param to - Right edge, as a fraction.
 * @returns The slice, as a capture region.
 */
function slice(clip, from, to) {
  return {
    x: Math.round(clip.x + clip.width * from),
    y: clip.y,
    width: Math.max(2, Math.round(clip.width * (to - from))),
    height: clip.height,
    scale: 1,
  }
}

/**
 * How many pixels two captures differ in.
 *
 * Byte equality is the wrong question to ask of two captures of a live page: the shell's
 * own text is composited again for each one, and a channel can land a step or two away
 * from where it landed before without anything having been painted. Difference is counted
 * where the four channels together move by more than that rounding, which is what makes
 * "the band paints here" and "the band paints nothing there" answerable in numbers.
 * @param first - One capture, as base64 PNG data.
 * @param second - The other.
 * @returns The number of pixels that really changed.
 */
function changedPixels(first, second) {
  return page.evaluate(`(async () => {
    const load = async (data) => createImageBitmap(new Blob([Uint8Array.from(atob(data), (character) => character.charCodeAt(0))], { type: 'image/png' }));
    const [left, right] = await Promise.all([load(${JSON.stringify(first)}), load(${JSON.stringify(second)})]);
    const canvas = document.createElement('canvas');
    canvas.width = left.width;
    canvas.height = left.height;
    const context = canvas.getContext('2d');
    context.drawImage(left, 0, 0);
    const before = context.getImageData(0, 0, left.width, left.height).data;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(right, 0, 0);
    const after = context.getImageData(0, 0, left.width, left.height).data;
    let changed = 0;
    for (let index = 0; index < before.length; index += 4) {
      const delta = Math.abs(before[index] - after[index])
        + Math.abs(before[index + 1] - after[index + 1])
        + Math.abs(before[index + 2] - after[index + 2])
        + Math.abs(before[index + 3] - after[index + 3]);
      if (delta > 8) changed += 1;
    }
    return changed;
  })()`)
}

/**
 * The pixel claims that hold the matte mechanism up.
 *
 * The band's travel is the shell's own 1.5 s cycle, so three points settle what it is:
 * past the far end of the travel nothing of it is over the label, at 250 ms it is over
 * the near end and cannot have reached the far one, and at 750 ms it is the other way
 * round. A tint that paints what it has arrived at and leaves what it has not reached
 * untouched is a travelling band; one that paints the whole label is the fill this
 * replaced.
 * @param clip - The label's own box.
 * @param label - What the captures belong to, for the failure messages.
 * @returns The label with the band away from it, for a caller to compare against.
 */
async function proveTravellingBand(clip, label) {
  const leftEnd = slice(clip, 0, 0.2)
  const middle = slice(clip, 0.3, 0.6)
  const rightEnd = slice(clip, 0.8, 1)
  await freeze(1250)
  const away = { all: await frame(clip), left: await frame(leftEnd), middle: await frame(middle), right: await frame(rightEnd) }
  await freeze(250)
  const entering = { left: await frame(leftEnd), middle: await frame(middle), right: await frame(rightEnd) }
  await freeze(750)
  const leaving = { left: await frame(leftEnd), middle: await frame(middle), right: await frame(rightEnd) }
  const atNearEnd = await changedPixels(entering.left, away.left)
  const atFarEnd = await changedPixels(leaving.right, away.right)
  assert.ok(atNearEnd > 20, `${label}: the band paints nothing as it arrives at the near end of the label (${atNearEnd} pixels)`)
  assert.ok(atFarEnd > 20, `${label}: the band paints nothing as it arrives at the far end of the label (${atFarEnd} pixels)`)
  assert.equal(
    await changedPixels(entering.right, away.right),
    0,
    `${label}: the band paints the far end of the label before it has reached it, so it is a fill rather than a travelling tint`,
  )
  assert.equal(
    await changedPixels(leaving.left, away.left),
    0,
    `${label}: the band is still painting the near end of the label after it has gone past, so it is a fill rather than a travelling tint`,
  )
  assert.ok(
    await changedPixels(entering.middle, leaving.middle) > 20,
    `${label}: the middle of the label looks the same on both sides of the band`,
  )
  return away.all
}

/**
 * Capture the label and the whale beside it, at 2× for a legible artefact.
 * @param name - Effect name, used in the file name.
 * @param selectors - The boxes to include; whichever are laid out decide the region.
 */
async function shoot(name, selectors = ['.bar > .content', '.root']) {
  const boxes = []
  for (const selector of selectors) {
    const box = await page.evaluate(BOX_OF(selector))
    if (box !== null) boxes.push(box)
  }
  assert.ok(boxes.length > 0, `nothing to capture for ${name}`)
  const left = Math.max(0, Math.min(...boxes.map((box) => box.left)) - 10)
  const top = Math.max(0, Math.min(...boxes.map((box) => box.top)) - 10)
  const right = Math.max(...boxes.map((box) => box.left + box.width))
  const bottom = Math.max(...boxes.map((box) => box.top + box.height))
  const clip = {
    x: left,
    y: top,
    width: Math.max(right - left + 10, 220),
    height: Math.max(bottom - top + 10, 34),
    scale: 2,
  }
  await writeFile(`${SHOT_DIR}/shot-work-${name}.png`, Buffer.from(await frame(clip), 'base64'))
}

try {
  await page.navigate('about:blank')

  console.log('\nthe shipped look is left alone')
  await step('with no effect chosen the shell keeps drawing and colouring its own band', async () => {
    await render(EFFECTS.official)
    assert.ok(
      (await page.evaluate(CSS_OF('.sweep', 'animationName'))).includes('dsh-row-shimmer-sweep'),
      'the shipped sweep is not running',
    )
    assert.equal(await page.evaluate(CSS_OF('.decoration', 'display')), 'block', 'the shipped band is hidden without an effect')
    assert.equal(await page.evaluate(CSS_OF('.sweep', 'color')), SHIPPED_SWEEP, 'the shipped band was recoloured without an effect')
    assert.equal(await page.evaluate(CSS_OF('.bar', 'color')), TEXT_COLOUR, 'the shipped label lost the palette colour')
    assert.notEqual(await page.evaluate(CSS_OF('.text', 'webkitTextFillColor')), 'rgba(0, 0, 0, 0)', 'the shipped label was left with a transparent fill')
    await shoot('official')
    const clip = await clipOf('.root')
    const first = await frame(clip)
    await delay(400)
    const moved = await changedPixels(first, await frame(clip))
    assert.ok(moved > 20, `the shipped sweep is not moving any pixels (${moved} changed)`)
  })

  console.log('\nthe effects dress the row the shell drew')
  await step('哑光 tints the shell’s own band and leaves the glyphs solid', async () => {
    await render(EFFECTS.matte)
    assert.equal(await page.evaluate(CSS_OF('.bar', 'color')), TEXT_COLOUR, 'the label did not take the chosen colour')
    assert.equal(await page.evaluate(CSS_OF('.sweep', 'color')), SWEEP_COLOUR, 'the shipped band did not take the chosen colour')
    assert.equal(await page.evaluate(CSS_OF('.decoration', 'display')), 'block', 'the shipped band was switched off, so nothing would sweep at all')
    assert.ok(
      (await page.evaluate(CSS_OF('.sweep', 'animationName'))).includes('dsh-row-shimmer-sweep'),
      'the band is no longer the shell’s own animation',
    )
    // The matte decision itself: nothing is painted behind the glyphs, and the fill is
    // their colour rather than transparent.
    assert.equal(await page.evaluate(CSS_OF('.text', 'webkitTextFillColor')), TEXT_COLOUR, 'the glyphs are filled by something other than the chosen colour')
    assert.equal(await page.evaluate(CSS_OF('.text', 'backgroundImage')), 'none', 'the glyphs got a gradient behind them')
    const clip = await clipOf('.root')
    const away = await proveTravellingBand(clip, '哑光')
    await freeze(500)
    await shoot('shimmer-matte')
    // Everything on screen is the label's own colour: switch the band off entirely and
    // the label is unchanged, so no part of it came from a background.
    await page.evaluate(OVERRIDE(EFFECTS.none))
    await freeze(1250)
    const leaked = await changedPixels(await frame(clip), away)
    assert.equal(leaked, 0, `with the band switched off the label looks different in ${leaked} pixels, so something other than its colour is painting it`)
  })

  await step('七彩光 puts the spectrum in the band, not over the label', async () => {
    await render(EFFECTS.rainbow)
    assert.equal(await page.evaluate(CSS_OF('.text', 'webkitTextFillColor')), TEXT_COLOUR, 'the label itself was filled with the spectrum, which is the look this replaced')
    assert.equal(await page.evaluate(CSS_OF('.text', 'backgroundImage')), 'none', 'the spectrum was painted over the whole label')
    const band = await page.evaluate(CSS_OF('.decoration .text', 'backgroundImage'))
    assert.ok(band.includes('rgb(255, 90, 90)'), `the band’s copy is not wearing the spectrum: ${band}`)
    assert.ok(band.includes('rgb(232, 121, 249)'), `the spectrum is not the whole rainbow: ${band}`)
    assert.equal(await page.evaluate(CSS_OF('.decoration .text', 'webkitTextFillColor')), 'rgba(0, 0, 0, 0)', 'the band’s copy would be painted twice')
    assert.equal(await page.evaluate(CSS_OF('.decoration .text', 'backgroundClip')), 'text', 'the browser did not take the spectrum’s clip to the glyphs')
    const clip = await clipOf('.root')
    await proveTravellingBand(clip, '七彩光')
    await freeze(500)
    await shoot('shimmer-rainbow')
  })

  await step('静态 keeps the label’s colour and stops the band', async () => {
    await render(EFFECTS.none)
    assert.equal(await page.evaluate(CSS_OF('.decoration', 'display')), 'none', 'the band still glides over a still label')
    assert.equal(await page.evaluate(CSS_OF('.bar', 'color')), TEXT_COLOUR, 'the still label did not take the chosen colour')
    assert.equal(await page.evaluate(CSS_OF('.text', 'webkitTextFillColor')), TEXT_COLOUR, 'the still label is not painted by its own colour')
    const clip = await clipOf('.root')
    const first = await frame(clip)
    await delay(400)
    const moved = await changedPixels(first, await frame(clip))
    assert.equal(moved, 0, `the static label is moving (${moved} pixels changed)`)
    await shoot('none')
  })

  await step('隐藏 collapses the bar and keeps the announcement', async () => {
    await render(EFFECTS.hidden)
    // The rule addresses the bar's own children, so that is what stops being drawn:
    // everything inside them goes with it, and the boxes prove it.
    for (const selector of ['.content', '.divider']) {
      assert.equal(await page.evaluate(CSS_OF(selector, 'display')), 'none', `${selector} is still drawn`)
    }
    for (const selector of ['.root', '.icon']) {
      const box = await page.evaluate(BOX_OF(selector))
      assert.equal(box.width, 0, `${selector} is still laid out: ${JSON.stringify(box)}`)
    }
    // The live-region span is the one child that stays, which is the whole point of
    // hiding the bar rather than the row.
    assert.equal(await page.evaluate(`document.querySelector('.bar > [role="status"]') !== null`), true, 'the announcement was hidden with the bar')
    assert.equal(await page.evaluate(CSS_OF('.bar > [role="status"]', 'clipPath')), 'inset(50%)', 'the announcement stopped being a live region')
    await shoot('hidden')
  })

  console.log('\nthe page’s own sample carries the same band')
  await step('the sample is dressed by the page stylesheet, and its copy lines up', async () => {
    await render(EFFECTS.matte, { markup: SAMPLE, page: true })
    assert.equal(await page.evaluate(CSS_OF('.dct-work-effect', 'color')), TEXT_COLOUR, 'the sample did not take the chosen colour')
    assert.equal(await page.evaluate(CSS_OF('.dct-work-sweep', 'color')), SWEEP_COLOUR, 'the sample’s band did not take the chosen colour')
    assert.ok(
      (await page.evaluate(CSS_OF('.dct-work-sweep', 'animationName'))).includes('dct-work-band'),
      'the sample’s band is not the animation the page stylesheet defines',
    )
    assert.ok(
      (await page.evaluate(CSS_OF('.dct-work-sweep-text', 'animationName'))).includes('dct-work-band-text'),
      'the sample’s copy does not counter-travel, so it would drift away from the label',
    )
    // At the point where both translations are zero the copy must sit exactly on the
    // label: anything else and the band tints a copy of the text that is not there.
    await freeze(500)
    const label = await page.evaluate(BOX_OF('.dct-work-effect'))
    const copy = await page.evaluate(BOX_OF('.dct-work-sweep-text'))
    for (const edge of ['left', 'top', 'width', 'height']) {
      assert.ok(
        Math.abs(label[edge] - copy[edge]) <= 1,
        `the sample’s copy is ${label[edge]} against the label’s ${copy[edge]} for ${edge}`,
      )
    }
    const clip = await clipOf('.dct-work-effect')
    const away = await proveTravellingBand(clip, '渲染示例')
    await freeze(500)
    await shoot('sample', ['.dct-work-preview'])
    await page.evaluate(OVERRIDE(EFFECTS.none))
    await freeze(1250)
    const leaked = await changedPixels(await frame(clip), away)
    assert.equal(leaked, 0, `with the sample’s band switched off the label looks different in ${leaked} pixels`)
  })

  console.log(`\n${steps - failures}/${steps} steps passed`)
  if (failures > 0) process.exitCode = 1
} finally {
  console.log('diagnostics:', page.diagnostics.length === 0 ? 'clean' : page.diagnostics.slice(0, 3).join(' | '))
  page.close()
  await browser.close()
}
