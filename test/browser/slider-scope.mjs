/**
 * Real Chromium proof that a slider style keeps its own chrome to itself.
 *
 * The slider is built in two pieces: the bridge creates a host container —
 * `div.ces-inline[data-ces-part="host"]`, and deliberately no theme on it (`bridge.cjs`) — and the
 * React slider portals a themed root inside it, `div.ces-inline[data-ces-part="root"][data-theme=X]`
 * (`slider.cjs`). The stylesheet scopes each style's brand part with a descendant selector, so the
 * theme has to be on the element that selector matches. Written without that requirement —
 * `.ces-inline:not([data-theme='deepseek']) .ces-whale-track` — the rule matches through the
 * theme-less host, which is an ancestor of *every* part under *every* theme: the whale, the Gemini
 * track and the Claude spark are then hidden always, under their own style too.
 *
 * That is a cascade bug, so the verdict here is the browser's, never the stylesheet's text: the
 * fixture is the product's own DOM shape, the stylesheet is the string `styles.cjs` itself exports,
 * and what is asked is `getComputedStyle(...).display` plus `getClientRects()` — what a user sees.
 *
 * Two controls keep the answer honest:
 *   - every case also carries the shared `.ces-track`, which no style hides; if the fixture failed
 *     to lay out, or a future rule hid a whole subtree, that part goes missing and the test says so
 *     instead of passing because "everything is hidden" happens to match;
 *   - each case is measured twice, with and without the bridge's host container, and the two
 *     verdicts must agree. A theme-less host that changes what is visible is the bug; a host that
 *     carries a theme (someone "simplifying" the two-piece DOM) is the other way this regresses, so
 *     the host's own `data-theme` is asserted empty as well.
 *
 * No DSH server and no credentials: the fixture is a local file, written to `.tmp/slider-scope/`.
 */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { attach, launch } from './driver.mjs'

const require = createRequire(import.meta.url)
// The plugin's own stylesheet and the attribute its bridge gives the host: neither is copied here,
// so a renamed part or a moved host cannot leave the fixture testing a DOM that no longer exists.
const { EFFORT_CSS } = require('../../src/client/effort/styles.cjs')
const { EFFORT_HOST_PART } = require('../../src/client/effort/constants.cjs')

const OUT = resolve('.tmp/slider-scope')

/** The four styles, and the one whose chrome each brand part is. */
const THEMES = ['deepseek', 'gemini', 'claude', 'codex']
const PARTS = [
  { className: 'ces-whale-track', part: 'whale-track', owner: 'deepseek' },
  { className: 'ces-gemini-track', part: 'gemini-track', owner: 'gemini' },
  { className: 'ces-claude-spark', part: 'claude-spark', owner: 'claude' },
]
/** Chrome every style shows; nothing is allowed to hide it. */
const SHARED = { className: 'ces-track', part: 'track' }

/**
 * One slider, in the DOM shape the product builds.
 *
 * `wrapped` is the bridge's host container — the theme-less `.ces-inline` this whole test exists
 * for. The brand parts sit inside `.ces-track`, which is where `slider.cjs` renders them, so the
 * descendant selector under test walks the same chain it does in the app.
 */
function caseHtml(theme, wrapped) {
  const root = `<div class="ces-inline" data-ces-part="root" data-theme="${theme}" data-energy="1" data-motion="full" data-busy="0">
        <div class="${SHARED.className}" data-ces-part="${SHARED.part}">
          ${PARTS.map((entry) => `<div class="${entry.className}" data-ces-part="${entry.part}"></div>`).join('\n          ')}
        </div>
      </div>`
  return `<div class="case" data-case="${theme}" data-set="${wrapped ? 'host' : 'bare'}">
      ${wrapped ? `<div class="ces-inline" data-ces-part="${EFFORT_HOST_PART}">\n      ${root}\n      </div>` : root}
    </div>`
}

/**
 * The fixture's own rules: a page, a box per case, and a box per part.
 *
 * None of this touches `display` on a part — that is the product stylesheet's answer alone — it
 * only gives every part a box so `getClientRects()` has something to report.
 */
const FIXTURE_CSS = `
  body { margin: 0; background: #151517; font: 13px/1.5 system-ui, "Segoe UI", sans-serif }
  .case { padding: 12px }
  /* The shell's composer would size the slider; the fixture only needs a stable box. Position
     relative gives the absolutely positioned parts the same containing block the real track does. */
  .ces-inline[data-ces-part="root"] { position: relative; width: 260px; }
  .ces-whale-track, .ces-gemini-track, .ces-claude-spark { width: 120px; height: 10px }
`

const FIXTURE = `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>slider style scope</title>
<style>${FIXTURE_CSS}</style>
<style id="effort-css">${EFFORT_CSS}</style>
</head>
<body>
${THEMES.map((theme) => [true, false].map((wrapped) => caseHtml(theme, wrapped)).join('\n')).join('\n')}
</body>
</html>
`

/**
 * What each case shows.
 *
 * `visible` is the user-facing question — a part is visible when the browser gives it a display
 * other than `none` *and* a box. Both are reported either way, so a failure says which one it was.
 */
const VERDICT = `(() => {
  const cases = {};
  for (const box of document.querySelectorAll('[data-case]')) {
    const host = box.querySelector('.ces-inline[data-ces-part="${EFFORT_HOST_PART}"]');
    const root = box.querySelector('.ces-inline[data-ces-part="root"]');
    const parts = {};
    for (const node of box.querySelectorAll('.ces-whale-track, .ces-gemini-track, .ces-claude-spark, .${SHARED.className}')) {
      const style = getComputedStyle(node);
      const rects = node.getClientRects().length;
      parts[node.className] = { display: style.display, rects, visible: style.display !== 'none' && rects > 0 };
    }
    cases[box.getAttribute('data-case') + '/' + box.getAttribute('data-set')] = {
      theme: root === null ? null : root.getAttribute('data-theme'),
      rootIsInline: root === null ? false : root.classList.contains('ces-inline'),
      hostTheme: host === null ? null : host.getAttribute('data-theme'),
      hostHasHostPart: host === null ? false : host.getAttribute('data-ces-part') === ${JSON.stringify(EFFORT_HOST_PART)},
      parts,
    };
  }
  return cases;
})()`

const describe = (seen) => `display: ${seen.display}, ${seen.rects} box(es)`

await mkdir(OUT, { recursive: true })
const fixturePath = resolve(OUT, 'fixture.html')
await writeFile(fixturePath, FIXTURE)
assert.ok(EFFORT_CSS.length > 0, 'the plugin stylesheet came back empty, so there is nothing to cascade')

const browser = await launch({ port: Number(process.env.DCT_CDP_PORT ?? 9418) })
let page
try {
  page = await attach(browser.endpoint)
  await page.send('Emulation.setDeviceMetricsOverride', { width: 900, height: 700, deviceScaleFactor: 1, mobile: false })
  await page.navigate(pathToFileURL(fixturePath).href)
  await page.waitFor(`document.querySelectorAll('[data-case]').length === ${THEMES.length * 2}`, { label: 'the fixture' })

  // The stylesheet has to reach the browser as rules, not as a string this test believes in.
  const rules = await page.evaluate(`document.getElementById('effort-css').sheet.cssRules.length`)
  assert.ok(rules > 20, `the browser parsed almost nothing of the plugin stylesheet (${rules} rules)`)

  const verdict = await page.evaluate(VERDICT)
  await page.screenshot(resolve(OUT, 'slider-scope.png'))

  /** The summary the run prints, so a passing run still records what it saw. */
  const seen = []
  for (const theme of THEMES) {
    const scope = verdict[`${theme}/host`]
    assert.ok(scope !== undefined, `the ${theme} case never made it into the page`)
    assert.equal(scope.theme, theme, `the ${theme} case is not a themed root`)
    assert.equal(scope.rootIsInline, true, `the ${theme} root is not the slider element the stylesheet scopes`)
    // The two-piece DOM is what the stylesheet's descendant selectors assume; a theme on the host
    // means someone moved it, and every rule below would then be answering a different question.
    assert.equal(scope.hostTheme, null,
      `the bridge's host container carries a theme (${scope.hostTheme}); the stylesheet scopes the portalled root, not the host`)
    assert.equal(scope.hostHasHostPart, true, `the ${theme} host is not the container the bridge creates`)

    for (const entry of PARTS) {
      const own = entry.owner === theme
      const withHost = scope.parts[entry.className]
      const withoutHost = verdict[`${theme}/bare`].parts[entry.className]
      assert.ok(withHost !== undefined, `the ${theme} case has no ${entry.className} to look at`)

      assert.equal(withHost.visible, own, own
        ? `the ${theme} slider hides its own ${entry.className} (${describe(withHost)})`
        : `the ${theme} slider shows ${entry.className}, which belongs to ${entry.owner} (${describe(withHost)})`)

      // Same subtree, no host container: the answer may not depend on it.
      assert.equal(withoutHost.visible, own,
        `without the bridge host the ${theme} case disagrees about ${entry.className} (${describe(withoutHost)})`)
      assert.equal(withHost.display, withoutHost.display,
        `the bridge host changed ${entry.className}'s display under ${theme}: ${withHost.display} with it, ${withoutHost.display} without it`)
    }

    // The shared chrome proves the case is a laid-out slider rather than a subtree that is hidden
    // wholesale — that is what makes the "codex shows none of the three" line mean something.
    for (const setName of ['host', 'bare']) {
      const shared = verdict[`${theme}/${setName}`].parts[SHARED.className]
      assert.equal(shared.visible, true,
        `the shared ${SHARED.className} is not on screen in the ${theme} case (${setName} shape), so nothing there was measured (${describe(shared)})`)
    }

    const showing = PARTS.filter((entry) => scope.parts[entry.className].visible).map((entry) => entry.className)
    seen.push(`${theme}: ${showing.length === 0 ? 'no brand part (as designed)' : showing.join(', ')}`)
  }

  assert.deepEqual(page.diagnostics, [])
  console.log(`PASS: each slider style shows its own chrome only — ${seen.join('; ')}; the theme-less bridge host changed nothing; no server started`)
  console.log(`screenshot: ${OUT}\\slider-scope.png`)
} finally {
  page?.close()
  await browser.close()
}
