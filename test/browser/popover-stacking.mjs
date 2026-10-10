/**
 * Real Chromium proof that the window bar's picture leaves the shell's own popovers on top.
 *
 * The shell keeps its session header actions — and the popovers they open, the background-jobs
 * list among them — inside its `<header>`, and it leaves every ancestor of those popovers
 * unstacked on purpose: the popover carries `z-index: 100` and floats over the conversation by
 * escaping to the root stacking context. A paint pass that makes that header a stacking context
 * — `isolation: isolate`, which is how a `::before` picture layer is kept under the element's
 * content — traps the popover instead, and the conversation's own positioned content then paints
 * over it: the jobs panel ends up behind the transcript. That is the reported symptom, and this
 * test is the reproduction.
 *
 * Nothing here is hand-tuned to the plugin's internals. The declarations applied to the header
 * are the ones `boot()` really produces for the window bar, the fixture is built from the values
 * the shell's own stylesheets use (quoted at each rule), and the verdict is the browser's answer
 * to "which element is on top here" — `elementFromPoint`, which walks the same paint order the
 * user sees. The pre-fix stacking context is replayed as well, so the test fails if the point it
 * measures ever stops distinguishing the two.
 *
 * No DSH server and no credentials: the fixture is a local file.
 */
import assert from 'node:assert/strict'
import { writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { attach, launch } from './driver.mjs'
import { boot } from '../harness.mjs'

const OUT = resolve('.tmp/popover-stacking')

/**
 * The fixture's shell-shaped document.
 *
 * Each rule carries the shell's own value where it decides the outcome:
 * `.centerCol` and `.root` are opaque (`--dsw-alias-bg-base`), `.header` is static, transparent
 * and unstacked, `.body` is `position: relative` (that is what a trapped popover is painted
 * under), and the popover is `position: absolute; z-index: 100` under a `position: relative`
 * host — the background-jobs dropdown's own geometry.
 */
const FIXTURE = `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>window bar popover stacking</title>
<style>
  /* .BynINW_frame: the app frame, and the column holding it. */
  body { margin: 0; background: #101014; font: 13px/1.5 system-ui, "Segoe UI", sans-serif }
  .frame { display: grid; grid-template-columns: 200px 1fr; height: 420px; position: relative; overflow: hidden; background: #151517 }
  .sidebarCol { background: #1b1b1e; border-right: .5px solid #2a2a2e }
  /* .BynINW_centerCol: no background of its own, the panel inside it paints. */
  .centerCol { display: flex; flex-direction: column; overflow: hidden; min-width: 0 }
  /* .Dc7zOa_root: opaque, and its own stacking context is not created (z-index: auto). */
  .root { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; background: #131315 }
  /* .Dc7zOa_header: static, no z-index, transparent — the shell relies on the popover escaping. */
  .header { display: flex; align-items: center; gap: 10px; height: 40px; padding: 0 12px; box-sizing: border-box }
  .titleRow { font-size: 12px; color: #8a8f98; white-space: nowrap }
  /* .foD-wG_root / .foD-wG_menu: the jobs trigger and its dropdown. */
  .menuRoot { position: relative; margin-left: auto }
  .trigger { font: inherit; color: #c9ccd4; background: none; border: 0; padding: 4px 6px }
  .menu { z-index: 100; position: absolute; top: calc(100% + 5px); right: 0; width: 300px; box-sizing: border-box;
          padding: 8px 10px; border-radius: 12px; color: #e6e8ee; background: rgba(58, 56, 60, .92); backdrop-filter: blur(24px) }
  .menu h4 { margin: 2px 0 6px; font-size: 11px; font-weight: 600; color: #9aa0ab }
  .menu .job { padding: 6px 0; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
  /* .Dc7zOa_body / .Dc7zOa_scrollBody: the transcript, positioned, and under the popover. */
  .body { position: relative; flex: 1; min-height: 0 }
  .scrollBody { overflow-y: auto; height: 100%; padding: 4px 12px; box-sizing: border-box }
  .transcript p { margin: 6px 0; color: #adb0b8 }
</style>
</head>
<body>
<div class="frame">
  <div class="sidebarCol"></div>
  <div class="centerCol">
    <div class="root">
      <header class="header" data-window-drag>
        <div class="titleRow">标准模式</div>
        <div class="menuRoot">
          <button class="trigger" type="button" aria-expanded="true">1 个后台任务运行中</button>
          <div class="menu" role="menu" aria-label="后台任务">
            <h4>进行中</h4>
            <div class="job">cd D:\\Code\\Kiln pnpm -F @kiln/server exec vitest run 2&gt;&amp;1 | Select-String…</div>
            <div class="job">pwsh　52 秒</div>
            <h4>&gt; 已结束 6</h4>
            <div class="job">清空</div>
          </div>
        </div>
      </header>
      <div class="body">
        <div class="scrollBody">
          <div class="transcript">
            <p>face) with a comment + re-export of the shared type, and the tool column keeps its own header while the picture is painted behind the whole column of the conversation.</p>
            <p>The second line runs just as far, so the panel has transcript glyphs underneath it for the whole height of the dropdown, which is what the report shows.</p>
            <p>A third line for the record, and a fourth one under the panel's lower edge where the panel no longer overlaps any text.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
</body>
</html>
`

/**
 * The point where the popover and a transcript line overlap, and what is on top there.
 *
 * The line is chosen inside the panel's box, so the answer is decided by paint order alone.
 */
const OVERLAP = `(() => {
  const menu = document.querySelector('.menu');
  const box = menu.getBoundingClientRect();
  const line = [...document.querySelectorAll('.transcript p')].find((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top > box.top + 6 && rect.bottom < box.bottom - 6 && rect.right > box.left + 40 && rect.left < box.left;
  });
  if (line === undefined) return { point: null, top: null };
  const rect = line.getBoundingClientRect();
  const x = box.left + 30;
  const y = (rect.top + rect.bottom) / 2;
  const hit = document.elementFromPoint(x, y);
  return {
    point: { x: Math.round(x), y: Math.round(y) },
    top: hit === null ? null
      : hit.closest('.menu') !== null ? 'menu'
        : hit.closest('.transcript') !== null ? 'transcript'
          : hit.tagName.toLowerCase(),
    sample: (hit?.textContent ?? '').trim().slice(0, 32),
  };
})()`

await mkdir(OUT, { recursive: true })
const fixturePath = resolve(OUT, 'fixture.html')
await writeFile(fixturePath, FIXTURE)

// The declarations the plugin really writes for the window bar: `padding` is the paint pass's own
// `setZoneProperty`, so what is applied below is the pass's output rather than a copy of it.
const picture = { name: 'bg.jpg', opacity: 0.25, panelOpacity: 94, blur: 4, size: 'cover', position: 'center' }
const booted = boot({ backgrounds: { windowbar: picture } })
const header = booted.document.querySelector('header')
const painted = {
  zone: header.getAttribute('data-dct-zone'),
  layer: header.getAttribute('data-dct-layer'),
  declarations: Object.fromEntries(
    ['isolation', 'position', 'background-color', 'background-image', 'background-repeat', 'background-size', 'background-position', 'background-attachment']
      .map((property) => [property, header.style.getPropertyValue(property)])
      .filter(([, value]) => value !== ''),
  ),
}
booted.dispose()

assert.equal(painted.zone, 'windowbar', 'the window bar was not painted at all, so there is nothing to check')
assert.equal(painted.declarations.isolation, undefined, 'the paint pass isolated the shell’s own popover host')

const browser = await launch({ port: Number(process.env.DCT_CDP_PORT ?? 9417) })
let page
try {
  page = await attach(browser.endpoint)
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1000, height: 460, deviceScaleFactor: 1, mobile: false })
  await page.navigate(pathToFileURL(fixturePath).href)
  await page.waitFor(`document.querySelector('.menu') !== null`, { label: 'the fixture' })

  /** Apply one set of declarations the way the paint pass does: inline, and important. */
  const apply = (declarations) => page.evaluate(`(() => {
    const header = document.querySelector('header');
    for (const property of ['isolation', 'position', 'background-color', 'background-image', 'background-repeat', 'background-size', 'background-position', 'background-attachment', 'filter']) {
      header.style.removeProperty(property);
    }
    const next = ${JSON.stringify(declarations)};
    for (const [property, value] of Object.entries(next)) header.style.setProperty(property, value, 'important');
    return getComputedStyle(header).isolation;
  })()`)

  // The reported symptom, replayed: a stacking context on the header is what puts the panel
  // behind the transcript. `z-index: -1` on the layer is what the context is there for, and
  // `position: absolute` is what the layer needs to cover the bar.
  const isolated = await apply({ ...painted.declarations, isolation: 'isolate', position: 'relative' })
  assert.equal(isolated, 'isolate', 'the browser did not apply the stacking context the replay needs')
  await page.evaluate(`(() => {
    const header = document.querySelector('header');
    const style = document.createElement('style');
    style.textContent = 'header[data-dct-layer]::before { content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none; background-image: url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%272%27 height=%272%27%3E%3Crect width=%272%27 height=%272%27 fill=%27%23ff00ff%27/%3E%3C/svg%3E"); opacity: .25 }';
    document.head.append(style);
    header.setAttribute('data-dct-layer', '1');
    header.style.setProperty('background-image', 'none', 'important');
  })()`)
  const broken = await page.evaluate(OVERLAP)
  await page.screenshot(resolve(OUT, 'windowbar-isolated.png'))
  assert.equal(broken.top, 'transcript',
    `the replay did not reproduce the reported symptom (top: ${JSON.stringify(broken)})`)

  // The pass as it stands: the picture rides on the header's own background, no stacking context,
  // and the popover is on top at the same point where the transcript used to win.
  await page.evaluate(`document.querySelector('header').removeAttribute('data-dct-layer')`)
  const computed = await apply(painted.declarations)
  assert.equal(computed, 'auto', 'the header is still a stacking context after the pass’s own declarations')
  const fixed = await page.evaluate(OVERLAP)
  await page.screenshot(resolve(OUT, 'windowbar-flat.png'))
  assert.equal(fixed.top, 'menu',
    `the shell’s popover is still painted under the conversation (top: ${JSON.stringify(fixed)})`)
  assert.equal(fixed.point.y, broken.point.y, 'the two measurements did not look at the same point')

  // The declarations have to survive the browser's own parsing: a dropped value would leave the
  // bar unpainted, which is the other way this fix can fail.
  const painted2 = await page.evaluate(`(() => {
    const style = getComputedStyle(document.querySelector('header'));
    return {
      image: style.backgroundImage,
      size: style.backgroundSize,
      position: style.backgroundPosition,
      color: style.backgroundColor,
      isolation: style.isolation,
      position1: style.position,
      bars: document.querySelectorAll('header[data-dct-zone="windowbar"]').length,
    };
  })()`)
  assert.ok(painted2.image.includes('linear-gradient'), `the wash was dropped by the browser: ${painted2.image}`)
  assert.ok(painted2.image.includes('bg.jpg'), `the picture was dropped by the browser: ${painted2.image}`)
  // The wash is the first layer, so it paints over the picture: reversed, the bar would show an
  // untinted picture at full strength instead of the strength the user asked for.
  assert.ok(painted2.image.indexOf('linear-gradient') < painted2.image.indexOf('bg.jpg'),
    `the wash is not over the picture: ${painted2.image}`)
  assert.equal(painted2.size, '100% 100%, cover', `the layers were sized wrong: ${painted2.size}`)
  // The browser resolves the keywords: the wash covers the bar, the picture sits centred in it.
  assert.equal(painted2.position, '0px 0px, 50% 50%', `the layers were placed wrong: ${painted2.position}`)
  assert.match(painted2.color, /^rgba\(24, 24, 24, 0\.9\d+\)$/, `the panel fill is not the 94% of the basis: ${painted2.color}`)
  assert.equal(painted2.position1, 'static', 'the pass positioned the shell’s header')

  // The header's own content stays above its picture: that is the whole point of painting it as
  // the element's background rather than as a positioned layer.
  const overTitle = await page.evaluate(`(() => {
    const title = document.querySelector('.titleRow');
    const rect = title.getBoundingClientRect();
    const hit = document.elementFromPoint((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2);
    return hit === null ? null : hit.closest('.titleRow') !== null;
  })()`)
  assert.equal(overTitle, true, 'the bar’s picture covers the header’s own labels')

  assert.deepEqual(page.diagnostics, [])
  console.log(`PASS: window bar keeps the shell’s popover on top (${fixed.point.x},${fixed.point.y}); under the old stacking context the transcript won; pictures; no server started`)
  console.log(`screenshots: ${OUT}\\windowbar-isolated.png, ${OUT}\\windowbar-flat.png`)
} finally {
  page?.close()
  await browser.close()
}
