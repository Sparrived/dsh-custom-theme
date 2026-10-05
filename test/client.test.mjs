/**
 * Client-half tests.
 *
 * `lib/client.js` is the browser half: hand-written JavaScript that the shell's client
 * module system materializes in the page. `test/harness.mjs` materializes it the same
 * way — a fake `window.__ModuleLoader__` capturing the definition, a fake `require` for
 * the two modules it asks for, and a context double carrying only the faces `apply`
 * touches — and this suite asserts on the one thing it does to the shell: the wording of
 * the running label, and the stylesheet each text effect writes.
 *
 * Both are reached through the locale service and through the plugin's own style element
 * rather than the DOM, which is what makes them drivable from here at all: no browser and
 * no live turn are needed to read what `chat.deepDiving` resolves to or which rules an
 * effect emits. What only a real window can show — the label on screen, its shimmer, the
 * clock beside it, and the pixels an effect paints — is `test/browser/working-effects.mjs`
 * and `test/browser/working-row.mjs`.
 */

import assert from "node:assert/strict"
import test from "node:test"

import { CHAT, boot, createLocale, definition, fakeRequire } from "./harness.mjs"

test('the browser half asks the loader for the faces it uses', () => {
  assert.equal(definition.id, 'dsh-custom-theme')
  const plugin = definition.factory(fakeRequire)
  assert.deepEqual(plugin.inject, ['slots', 'locale', 'theme'])
  assert.equal(typeof plugin.apply, 'function')
})

test('no phrase leaves the shell lookup untouched', () => {
  const booted = boot()
  assert.equal(booted.locale.translate, booted.originalTranslate, 'the lookup was replaced with no phrase configured')
  assert.equal(booted.t('chat.deepDiving'), '深度求索中')
  assert.equal(booted.t('chat.deepDivingFor', { duration: '13秒' }), '深度求索中，用时 13秒 ···')
})

test('a phrase replaces the wording and keeps everything the shell puts after it', () => {
  const booted = boot({ working: { texts: ['大肥鱼吃饭中'], interval: 2400 } })
  assert.equal(booted.t('chat.deepDiving'), '大肥鱼吃饭中')
  assert.equal(booted.t('chat.deepDivingFor', { duration: '13秒' }), '大肥鱼吃饭中，用时 13秒 ···')
})

test('a clock template with no parameter-free sibling still gets the phrase', () => {
  // The older build keys the clock template `message.turnProcess.deepDivingFor` and
  // ships no `message.turnProcess.deepDiving` beside it, so the wording it is built on
  // can only be learned from the reads the row makes itself.
  const locale = createLocale({
    chat: {
      zh: { ...CHAT.zh, 'message.turnProcess.deepDivingFor': '深度求索中，用时 {duration}' },
      en: CHAT.en,
    },
  })
  const booted = boot({ working: { texts: ['大肥鱼吃饭中'], interval: 2400 }, locale })
  assert.equal(
    booted.locale.bind('chat')('message.turnProcess.deepDivingFor', { duration: '13秒' }),
    '深度求索中，用时 13秒',
    'a template whose wording is not known yet was rewritten anyway',
  )
  assert.equal(booted.t('chat.deepDiving'), '大肥鱼吃饭中')
  assert.equal(
    booted.locale.bind('chat')('message.turnProcess.deepDivingFor', { duration: '13秒' }),
    '大肥鱼吃饭中，用时 13秒',
  )
})

test('every other key reads as shipped, this plugin’s own namespace included', () => {
  const booted = boot({ working: { texts: ['大肥鱼吃饭中'], interval: 2400 } })
  assert.equal(booted.t('message.turnProcess.worked'), '已完成')
  assert.equal(booted.t('message.turnProcess.took'), '已完成，用时 ')
  assert.equal(booted.t('message.turnProcess.failed'), '处理失败')
  assert.equal(booted.locale.bind('dshCustomTheme')('nav'), '主题与背景')
  assert.equal(booted.locale.bind('dshCustomTheme')('workTitle'), '工作时文字')
})

test('the phrase rotates on the reads the shell makes, and restarts with a turn', (t) => {
  t.mock.timers.enable({ apis: ['Date'] })
  const booted = boot({ working: { texts: ['甲', '乙'], interval: 1200 } })
  t.mock.timers.setTime(1000)
  assert.equal(booted.t('chat.deepDiving'), '甲', 'the first read of a turn shows the first phrase')
  t.mock.timers.setTime(2300)
  assert.equal(booted.t('chat.deepDiving'), '乙', 'the next read is one interval later')
  t.mock.timers.setTime(3500)
  assert.equal(booted.t('chat.deepDiving'), '甲', 'the rotation keeps wrapping inside one turn')
  // Five and a half seconds with no read is longer than a live turn ever goes quiet, so
  // the next read is a new turn: the list starts over rather than continuing to '乙',
  // which is where the uninterrupted clock would have it (9000 / 1200 % 2).
  t.mock.timers.setTime(9000)
  assert.equal(booted.t('chat.deepDiving'), '甲', 'a gap in the reads did not restart the rotation')
})

test('an empty stored list reads back as no phrase at all', () => {
  const booted = boot({ working: { texts: [], interval: 1200 } })
  assert.equal(booted.t('chat.deepDiving'), '深度求索中')
})

test('a corrupt stored list falls back to the shipped label', () => {
  const booted = boot({ raw: '{ this is not json' })
  assert.equal(booted.t('chat.deepDiving'), '深度求索中')
})

test('disposing the plugin puts the shell lookup back', () => {
  const booted = boot({ working: { texts: ['大肥鱼吃饭中'], interval: 2400 } })
  assert.equal(booted.t('chat.deepDiving'), '大肥鱼吃饭中')
  booted.dispose()
  assert.equal(booted.locale.translate, booted.originalTranslate, 'the original lookup was not restored')
  assert.equal(booted.t('chat.deepDiving'), '深度求索中')
  assert.equal(booted.t('chat.deepDivingFor', { duration: '13秒' }), '深度求索中，用时 13秒 ···')
})

test('a service that refuses the replacement leaves the shipped label in place', () => {
  const frozen = createLocale()
  Object.freeze(frozen)
  const booted = boot({ working: { texts: ['大肥鱼吃饭中'], interval: 2400 }, locale: frozen })
  assert.equal(booted.t('chat.deepDiving'), '深度求索中')
  assert.ok(
    booted.warnings.some((line) => line.includes('no locale lookup the running label can be reworded through')),
    `the refusal was not reported: ${JSON.stringify(booted.warnings)}`,
  )
  booted.dispose()
})

test('a shell exposing no lookup is reported rather than crashed into', () => {
  const booted = boot({ working: { texts: ['大肥鱼吃饭中'] }, locale: createLocale({ translate: false }) })
  assert.ok(
    booted.warnings.some((line) => line.includes('no locale lookup the running label can be reworded through')),
    `the missing lookup was not reported: ${JSON.stringify(booted.warnings)}`,
  )
  booted.dispose()
})

test('the plugin adds no chat-node renderer of its own', () => {
  const booted = boot({ working: { texts: ['大肥鱼吃饭中'], interval: 2400 } })
  assert.ok(!booted.injected.includes('conversation.chat.node'), 'a chat-node entry is still registered')
  assert.deepEqual(booted.injected, [
    'settings.section',
    'plugins.detail.actions',
    'plugins.detail.badge',
    'plugins.detail.section',
  ])
})

/**
 * The two marks the shipped build puts on the row the effects dress: the bar itself,
 * which carries the label's colour and the token its band is painted with, and the
 * decorative copy of the text that band is drawn from. Hashed class names are never
 * addressed, because they change between builds.
 */
const BAR = '[data-chat-running], .dct-work-preview'
const BAND = '[data-chat-running] [data-shimmer] > span[aria-hidden="true"], '
  + '[data-chat-running] [data-text-shimmer] > span[aria-hidden="true"], '
  + '.dct-work-effect .dct-work-sweep'
const BAND_TEXT = '[data-chat-running] [data-shimmer] > span[aria-hidden="true"] [data-shimmer-text], '
  + '[data-chat-running] [data-text-shimmer] > span[aria-hidden="true"] [data-shimmer-text], '
  + '.dct-work-effect .dct-work-sweep-text'

/** The generated rules, one per line. */
const rulesOf = (css) => css.split('\n').filter(Boolean)

test('the shipped look writes no effect into the page', () => {
  const booted = boot({ working: { texts: ['大肥鱼吃饭中'], interval: 2400 } })
  assert.equal(booted.effectCss(), '', 'a stylesheet was written for the shipped look')
  assert.ok(booted.workingStyle() !== null, 'the stylesheet the effect is written into is missing')
})

test('a matte shimmer tints the shell’s own band and leaves the glyphs alone', () => {
  const booted = boot({
    working: { texts: ['大肥鱼吃饭中'], interval: 2400, effect: 'shimmer', shimmer: 'matte', color: '#ff0000', sweep: '#00ff00' },
  })
  // One rule, and it only sets colours: the label keeps a solid fill and the shell's own
  // masked band keeps travelling, which is what the official look is made of.
  const css = booted.effectCss()
  assert.equal(css, `${BAR} { color: #ff0000 !important; --dsw-alias-label-shimmer: #00ff00 !important; }\n`)
  assert.ok(!css.includes('text-fill-color'), 'the glyphs were filled, which is the glossy look this replaced')
  assert.ok(!css.includes('background-image'), 'the glyphs got a gradient behind them')
  assert.ok(!css.includes('animation'), 'the band is already animated by the shell')
  assert.ok(!css.includes('display: none'), 'the shell’s own band was switched off, so nothing would sweep at all')
})

test('a rainbow shimmer puts the spectrum in the band, not over the label', () => {
  const css = boot({ working: { texts: ['甲'], effect: 'shimmer', shimmer: 'rainbow', color: '#ff0000', sweep: '#00ff00' } }).effectCss()
  const rules = rulesOf(css)
  assert.equal(rules.length, 2, `the rainbow should add exactly one rule to the colours: ${css}`)
  assert.equal(rules[0], `${BAR} { color: #ff0000 !important; --dsw-alias-label-shimmer: #00ff00 !important; }`)
  const band = rules[1]
  // The band's own copy of the text is what carries the spectrum — the label underneath
  // keeps its solid colour, which is what keeps the look matte.
  assert.ok(band.startsWith(`${BAND_TEXT} { `), `the spectrum is not written on the band: ${band}`)
  assert.ok(band.includes('background-image: linear-gradient(100deg, #ff5a5a 0%, #ffb03a 7%'), 'the spectrum is not the Deeptop one')
  assert.ok(band.includes('background-size: 100% 100% !important;'), 'the spectrum should sit still under the band’s mask')
  assert.ok(band.includes('background-repeat: no-repeat !important;'), 'the spectrum should cover the band once')
  assert.ok(band.includes('background-clip: text !important;'), 'the spectrum is not clipped to the glyphs')
  assert.ok(band.includes('-webkit-text-fill-color: transparent !important;'), 'the band’s copy would be painted twice')
  assert.ok(!band.includes('animation'), 'the band is already animated by the shell')
  assert.ok(!band.includes('background-position'), 'the spectrum should not travel inside the travelling mask')
})

test('静态 keeps the colour and stops the band', () => {
  const css = boot({ working: { texts: ['甲'], effect: 'none', color: '#123456', sweep: '#654321' } }).effectCss()
  assert.deepEqual(rulesOf(css), [
    `${BAR} { color: #123456 !important; --dsw-alias-label-shimmer: #654321 !important; }`,
    `${BAND} { display: none !important; }`,
  ], 'a still label needs its colour, and the band it must not have')
})

test('隐藏 collapses the bar and keeps the announcement', () => {
  const booted = boot({ working: { texts: ['甲'], effect: 'hidden' } })
  assert.equal(booted.effectCss(), '[data-chat-running] > :not([role="status"]) { display: none !important; }\n')
  // The page shows its own note instead of a sample, so nothing addresses the sample.
  assert.ok(!booted.effectCss().includes('.dct-work-effect'))
})

test('an unknown effect, shimmer or colour falls back rather than reaching the stylesheet', () => {
  // The two effects this plugin no longer offers are unknown now, and fall back with the
  // rest: a stored value can only pick from what the select offers.
  for (const effect of ['pulse', 'glow', 'sparkle']) {
    const unknown = boot({ working: { texts: ['甲'], effect } })
    assert.equal(unknown.effectCss(), '', `a stored ${effect} still produced rules`)
  }
  const shimmer = boot({
    working: { texts: ['甲'], effect: 'shimmer', shimmer: 'sparkle', color: '#ff0000; } body { display: none', sweep: '#12345' },
  })
  assert.equal(
    shimmer.effectCss(),
    `${BAR} { color: #4176e6 !important; --dsw-alias-label-shimmer: #5ee0ff !important; }\n`,
    'the stored colours were not normalized away',
  )
  assert.ok(!shimmer.effectCss().includes('body { display: none'), 'a stored value reached the stylesheet unchecked')
})

test('disposing the plugin takes the effect stylesheet with it', () => {
  const booted = boot({ working: { texts: ['甲'], effect: 'shimmer' } })
  assert.ok(booted.effectCss() !== '')
  booted.dispose()
  assert.equal(booted.workingStyle(), null, 'the effect stylesheet outlived the plugin')
})

test('the appearance stylesheet carries default streaming fade rules and variables', () => {
  const booted = boot()
  const css = booted.appearanceCss()
  assert.ok(css.includes('--stream-fade-duration: 520ms;'))
  assert.ok(css.includes('--stream-fade-ink: 0.3;'))
  assert.ok(css.includes('.stream-ink {'))
  assert.ok(css.includes('@keyframes stream-ink-in'))
  assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'))
  booted.dispose()
})

test('custom streaming fade choices apply to the stylesheet and clamp within bounds', () => {
  const booted = boot({ appearance: { streamingFadeDuration: 750, streamingFadeInk: 0.45 } })
  const css = booted.appearanceCss()
  assert.ok(css.includes('--stream-fade-duration: 750ms;'))
  assert.ok(css.includes('--stream-fade-ink: 0.45;'))
  booted.dispose()

  const clamped = boot({ appearance: { streamingFadeDuration: 50, streamingFadeInk: 1.5 } })
  const clampedCss = clamped.appearanceCss()
  assert.ok(clampedCss.includes('--stream-fade-duration: 150ms;'))
  assert.ok(clampedCss.includes('--stream-fade-ink: 1;'))
  clamped.dispose()

  const clampedMin = boot({ appearance: { streamingFadeDuration: 2500, streamingFadeInk: 0.01 } })
  const clampedMinCss = clampedMin.appearanceCss()
  assert.ok(clampedMinCss.includes('--stream-fade-duration: 1500ms;'))
  assert.ok(clampedMinCss.includes('--stream-fade-ink: 0.05;'))
  clampedMin.dispose()
})

test('a corrupt appearance payload falls back safely to default streaming fade values', () => {
  const booted = boot({ rawAppearance: '{"streamingFadeDuration":"xyz","streamingFadeInk":null}' })
  const css = booted.appearanceCss()
  assert.ok(css.includes('--stream-fade-duration: 520ms;'))
  assert.ok(css.includes('--stream-fade-ink: 0.3;'))
  booted.dispose()
})

test('disposing the plugin takes the appearance stylesheet with it', () => {
  const booted = boot()
  assert.ok(booted.appearanceStyle() !== null)
  booted.dispose()
  assert.equal(booted.appearanceStyle(), null, 'the appearance stylesheet outlived the plugin')
})

test('applying monokai-pro theme synthesizes shiki tokens and strips root token declarations', async () => {
  const booted = boot({ themeId: 'monokai-pro' })
  await booted.waitTheme()

  const overrides = booted.appliedOverrides()
  assert.ok(overrides !== null, 'theme tokens were registered')
  assert.equal(overrides.source, 'dsh-custom-theme')

  const tokens = overrides.tokens
  assert.deepEqual(tokens['--dsw-alias-label-primary'], { light: '#2d2a2e', dark: '#fcfcfa' })
  // Shiki foreground must be synthesized from label-primary so untokenized runs/diffs invert in dark mode
  assert.deepEqual(tokens['--shiki-foreground'], { light: '#2d2a2e', dark: '#fcfcfa' })
  // Shiki background must be synthesized from bg-base (as markdown-code-block is not explicitly defined)
  assert.deepEqual(tokens['--shiki-background'], { light: '#fbfaf9', dark: '#2d2a2e' })

  // Pure token declarations must be stripped from the theme stylesheet to avoid :root pollution
  const css = booted.themeCss()
  assert.equal(css, '', 'monokai-pro has no non-token rules, so stylesheet text is empty')
  booted.dispose()
})

test('applying gov theme keeps non-token rules and synthesizes shiki tokens', async () => {
  const booted = boot({ themeId: 'gov' })
  await booted.waitTheme()

  const overrides = booted.appliedOverrides()
  assert.ok(overrides !== null)
  const tokens = overrides.tokens
  assert.deepEqual(tokens['--shiki-foreground'], { light: '#1a1714', dark: '#f0e6d2' })
  assert.deepEqual(tokens['--shiki-background'], { light: '#f4eee3', dark: '#1f1a14' })

  // Non-token font-family rule is preserved, while custom properties are stripped
  const css = booted.themeCss()
  assert.ok(css.includes('font-family: "Source Han Serif SC"'))
  assert.ok(!css.includes('--dsw-alias-bg-base'))
  assert.ok(!css.includes('--dsw-alias-label-primary'))
  booted.dispose()
})

test('applying one-dark dual-palette theme populates both light and dark shiki tokens', async () => {
  const booted = boot({ themeId: 'one-dark' })
  await booted.waitTheme()

  const overrides = booted.appliedOverrides()
  assert.ok(overrides !== null)
  const tokens = overrides.tokens
  assert.deepEqual(tokens['--shiki-foreground'], { light: '#282c34', dark: '#abb2bf' })
  assert.deepEqual(tokens['--shiki-background'], { light: '#f6f8fb', dark: '#282c34' })
  assert.equal(booted.themeCss(), '')
  booted.dispose()
})

test('custom theme preserves explicit shiki tokens and adapts dark non-token selectors', async () => {
  const customCss = `
:root {
  --dsw-alias-label-primary: #111;
  --dsw-alias-bg-base: #fff;
  --shiki-foreground: #333;
}
:root[data-theme="dark"] {
  --dsw-alias-label-primary: #eee;
  --dsw-alias-bg-base: #000;
  --shiki-foreground: #ccc;
  font-size: 15px;
}
`
  const booted = boot({ themeId: 'custom-theme', themeCssMock: customCss })
  await booted.waitTheme()

  const overrides = booted.appliedOverrides()
  assert.ok(overrides !== null)
  const tokens = overrides.tokens
  // Explicit shiki token is preserved without being overwritten by label-primary
  assert.deepEqual(tokens['--shiki-foreground'], { light: '#333', dark: '#ccc' })
  // Background synthesized from bg-base fallback
  assert.deepEqual(tokens['--shiki-background'], { light: '#fff', dark: '#000' })

  // Dark selector adapted to body[data-ds-dark-theme]
  const css = booted.themeCss()
  assert.ok(css.includes('body[data-ds-dark-theme] {\n  font-size: 15px;\n}'))
  assert.ok(!css.includes('--dsw-alias-label-primary'))
  booted.dispose()
})