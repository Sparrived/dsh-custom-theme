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
import { readFileSync } from "node:fs"
import test from "node:test"

import { CHAT, boot, createElement, createLocale, createTextNode, definition, fakeRequire, highlights, registeredProperties, storage, zoneSurface } from "./harness.mjs"

/** The browser half's own source: asserted on where a live window cannot reach. */
const CLIENT_SOURCE = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8")

test('the browser half asks the loader for the faces it uses', () => {
  assert.equal(definition.id, 'dsh-custom-theme')
  const asked = []
  const plugin = definition.factory((id) => {
    asked.push(id)
    return fakeRequire(id)
  })
  assert.deepEqual(plugin.inject, ['slots', 'locale', 'theme'])
  assert.equal(typeof plugin.apply, 'function')
  // The slider draws into the shell's own menu row, so the module needs a portal as well as
  // elements. A host that cannot answer `react-dom` fails here rather than in the composer.
  assert.ok(asked.includes('react'), `the module never asked for React: ${asked.join(', ')}`)
  assert.ok(asked.includes('react-dom'), `the module never asked for react-dom: ${asked.join(', ')}`)
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

test('the browser half never restructures nodes the shell renders', () => {
  // 0.3.1's streaming fade rewrote the live message into its own spans. React still held
  // the original text nodes, so its next commit threw `NotFoundError: Failed to execute
  // 'removeChild' on 'Node'` out of `conversation.chat.node`, and the shell dropped the
  // whole assistant body. Every one of these APIs can do the same thing again: the plugin
  // creates its own elements and styles the surfaces it marks with `data-dct-*`, and it
  // never edits a node inside content the shell renders. (Writing `textContent` or calling
  // `remove()` on the plugin's own `<style>` / probe elements stays allowed — both are
  // asserted elsewhere in this suite.)
  const forbidden = [
    'createTextNode', 'splitText', 'replaceChild', 'removeChild', 'insertBefore',
    'replaceWith', 'insertAdjacentHTML', 'insertAdjacentElement', 'insertAdjacentText',
    'innerHTML', 'outerHTML', 'document.write', '.before(', '.after(', '.data =',
  ]
  for (const api of forbidden) {
    assert.ok(!CLIENT_SOURCE.includes(api), `the client uses ${api}: it must not touch nodes React owns`)
  }
})

/**
 * A streaming root holding prose: the shape the shell renders while a reply is arriving.
 * @param initial - Text already written into the tail.
 * @returns The root, its paragraph, and the shell's own text node.
 */
function streamingTail(initial) {
  const text = createTextNode(initial)
  const paragraph = createElement('p')
  const root = createElement('div')
  paragraph.append(text)
  root.append(paragraph)
  root.setAttribute('data-streaming', 'true')
  return { root, paragraph, text }
}

/** The ink's own rules, read back through the CSSOM it wrote them with. */
function inkRules(booted) {
  const element = booted.document.head.children.find((candidate) => candidate.dataset?.role === 'stream-ink')
  const sheet = element?.sheet
  return sheet === undefined || sheet === null ? [] : [...sheet.cssRules]
}

/** Those rules as text: the colour is mutated in place, so it is read separately. */
function inkCss(booted) {
  return inkRules(booted).map((rule) => `${rule.cssText} ${rule.style.color}`).join('\n')
}

/** One chunk written into one text node, as the observer's record would report it. */
function chunk(node) {
  return [{ type: 'characterData', target: node }]
}

test('the writing ink claims the newest characters with a range and ramps the alpha', () => {
  highlights.clear()
  const booted = boot({ appearance: { streamingFadeDuration: 200, streamingFadeInk: 0.4 } })
  const { root, paragraph, text } = streamingTail('你好')
  booted.document.body.append(root)

  booted.triggerMutation(chunk(text))
  booted.runFrame()
  assert.equal(highlights.size, 1, 'no highlight was registered')
  const [entry] = [...highlights.values()]
  assert.equal(entry.ranges.length, 1, 'the ink did not claim exactly one range')
  assert.equal(entry.ranges[0].startNode, text, "the ink claimed something other than the shell's text node")
  assert.equal(entry.ranges[0].startOffset, 0)
  assert.equal(entry.ranges[0].endOffset, 2)
  assert.equal(inkRules(booted).length, 1, 'the ink did not claim exactly one rule')
  assert.ok(inkCss(booted).includes('rgba(0, 0, 0, var(--dct-stream-ink))'), `the rule does not read the ramp: ${inkCss(booted)}`)
  assert.ok(registeredProperties.has('--dct-stream-ink'), 'the ramp property was never registered, so it cannot animate')
  // The ramp is one animation on the element that owns the text node: no per-frame JS, and no
  // stylesheet touched while it runs.
  const ramp = paragraph.animations[0]
  assert.ok(ramp !== undefined, 'the ink did not start a ramp')
  assert.equal(ramp.keyframes[0]['--dct-stream-ink'], 0.4, 'the ramp did not start at the writing ink')
  assert.equal(ramp.keyframes[1]['--dct-stream-ink'], 1, 'the ramp did not settle at the text colour')
  assert.equal(ramp.options.duration, 200, 'the ramp did not use the chosen duration')

  // React appends the next chunk the way its commit does: same node, longer text.
  text.nodeValue = '你好呀'
  booted.triggerMutation(chunk(text))
  booted.runFrame()
  assert.equal(highlights.size, 1, 'a second highlight was registered for the same node')
  const [grown] = [...highlights.values()]
  assert.equal(grown.ranges[0].startOffset, 2, 'the ink did not start where the previous chunk ended')
  assert.equal(grown.ranges[0].endOffset, 3, 'the ink did not cover the new characters')
  assert.equal(inkRules(booted).length, 1, 'a second rule was claimed for the same node')
  assert.equal(paragraph.animations.length, 2, 'the next chunk did not restart the ramp')
  assert.equal(paragraph.animations[0].cancelled, true, 'the superseded ramp was left running')
  booted.dispose()
})

test('the writing ink never restructures the node React renders', () => {
  highlights.clear()
  const booted = boot({ appearance: { streamingFadeInk: 0.3 } })
  const { root, paragraph, text } = streamingTail('流')
  booted.document.body.append(root)

  booted.triggerMutation(chunk(text))
  booted.runFrame()
  text.nodeValue = '流式'
  booted.triggerMutation(chunk(text))
  booted.runFrame()

  // The shell's own node sits exactly where the shell left it: same object, same parent,
  // nothing beside it. The ink only ever holds a Range over it.
  assert.equal(paragraph.lastChild, text, 'the text node was replaced or moved')
  assert.equal(text.parent, paragraph, 'the text node changed parent')
  assert.equal(paragraph.children.length, 1, "a node was added inside the shell's paragraph")
  assert.equal(root.children.length, 1, 'a node was added inside the streaming root')
  assert.equal(highlights.size, 1, 'the ink did not settle on one highlight')
  booted.dispose()
})

test('a burst of chunks costs one pass per frame', () => {
  highlights.clear()
  const booted = boot({ appearance: { streamingFadeDuration: 200, streamingFadeInk: 0.3 } })
  const { root, paragraph, text } = streamingTail('一')
  booted.document.body.append(root)

  booted.triggerMutation(chunk(text))
  assert.equal(highlights.size, 0, 'the ink painted before a frame ran')
  booted.runFrame()
  assert.equal(highlights.size, 1, 'the frame painted nothing')

  // Three more chunks arriving before the next frame collapse into one pass, not three.
  text.nodeValue = '一二'
  booted.triggerMutation(chunk(text))
  text.nodeValue = '一二三'
  booted.triggerMutation(chunk(text))
  text.nodeValue = '一二三四'
  booted.triggerMutation(chunk(text))
  assert.equal(paragraph.animations.length, 1, 'a chunk started a ramp before the frame ran')
  booted.runFrame()
  assert.equal(paragraph.animations.length, 2, 'the burst started a ramp per chunk instead of per frame')
  assert.equal(inkRules(booted).length, 1, 'the burst claimed a rule per chunk instead of one per ink')
  const [entry] = [...highlights.values()]
  assert.equal(entry.ranges[0].endOffset, 4, 'the coalesced pass did not cover every chunk')
  booted.dispose()
})

test('a chunk after the ink settled claims only its own characters', async () => {
  highlights.clear()
  const booted = boot({ appearance: { streamingFadeDuration: 150, streamingFadeInk: 0.3 } })
  const { root, text } = streamingTail('你好')
  booted.document.body.append(root)

  booted.triggerMutation(chunk(text))
  booted.runFrame()
  assert.equal(highlights.size, 1, 'no ink was registered to settle')
  // The release is a real timer in the harness too: let the ramp run out.
  await new Promise((resolve) => setTimeout(resolve, 400))
  assert.equal(highlights.size, 0, 'the ink did not settle')

  // The same text node grows again. The baseline the settled ink left behind is what keeps
  // this chunk from claiming the whole node; without it the paragraph fades a second time.
  text.nodeValue = '你好呀'
  booted.triggerMutation(chunk(text))
  booted.runFrame()
  assert.equal(highlights.size, 1, 'the later chunk was not inked at all')
  const [entry] = [...highlights.values()]
  assert.equal(entry.ranges[0].startOffset, 2, 'the later chunk re-claimed characters that had already settled')
  assert.equal(entry.ranges[0].endOffset, 3, 'the later chunk did not claim its own characters')
  booted.dispose()
})

test('an ink whose text leaves the document is retired on the next pass, not on its timer', () => {
  highlights.clear()
  // The longest fade the plugin offers, and the pass below runs immediately: nothing here
  // waits, so a release that came from the timer would still be holding both the entry and
  // the rule when the assertions read them.
  const booted = boot({ appearance: { streamingFadeDuration: 1500, streamingFadeInk: 0.3 } })
  const { root, paragraph, text } = streamingTail('答')
  const keptParagraph = createElement('p')
  const kept = createTextNode('留')
  keptParagraph.append(kept)
  root.append(keptParagraph)
  booted.document.body.append(root)

  booted.triggerMutation(chunk(text))
  booted.triggerMutation(chunk(kept))
  booted.runFrame()
  assert.equal(highlights.size, 2, 'the two live tails were not both inked')
  assert.equal(inkRules(booted).length, 2, 'each live tail did not claim a rule of its own')
  assert.equal(paragraph.animations.length, 1, 'the detached tail never started a ramp')

  // The shell detaches one tail while its ramp is still running — a failed turn, a
  // conversation switch, a rebuild — which reaches the observer as a removal record on the
  // parent that lost it. The frame that record schedules is the one that has to notice.
  paragraph.remove()
  booted.triggerMutation([{ type: 'childList', target: root, addedNodes: [], removedNodes: [paragraph] }])
  booted.runFrame()

  // Gone from the registry, gone from the stylesheet, its ramp cancelled: the entry was
  // retired by the pass, not left to sit out the 1500 ms it had left.
  assert.equal(highlights.size, 1, 'the ink over the detached text was not retired')
  const [left] = [...highlights.values()]
  assert.equal(left.ranges[0].startNode, kept, 'the wrong ink was retired')
  assert.equal(inkRules(booted).length, 1, 'the detached ink kept its rule')
  assert.equal(paragraph.animations[0].cancelled, true, 'the detached ink kept its ramp')
  // The tail still on screen is untouched: this retires what left, not what is painted.
  assert.equal(keptParagraph.animations.length, 1, 'the connected ink was re-ramped')
  assert.equal(keptParagraph.animations[0].cancelled, false, 'the connected ink was withdrawn with the detached one')
  booted.dispose()
})

test('a writing ink of 100% paints nothing', () => {
  highlights.clear()
  const booted = boot({ appearance: { streamingFadeInk: 1 } })
  const { root, text } = streamingTail('淡')
  booted.document.body.append(root)

  booted.triggerMutation(chunk(text))
  booted.runFrame()
  text.nodeValue = '淡化'
  booted.triggerMutation(chunk(text))
  booted.runFrame()

  assert.equal(highlights.size, 0, 'the fade painted while it was turned off')
  assert.equal(inkCss(booted), '', 'the fade wrote a rule while it was turned off')
  booted.dispose()
})

test('disposing the plugin withdraws the ink and its stylesheet', () => {
  highlights.clear()
  const booted = boot({ appearance: { streamingFadeInk: 0.3 } })
  const { root, text } = streamingTail('墨')
  booted.document.body.append(root)
  booted.triggerMutation(chunk(text))
  booted.runFrame()
  assert.equal(highlights.size, 1, 'no ink was registered to withdraw')

  booted.dispose()
  assert.equal(highlights.size, 0, 'the highlight outlived the plugin')
  assert.equal(inkCss(booted), '', 'the ink stylesheet outlived the plugin')
})

/**
 * Watch the ink's stylesheet from the moment the pass creates it.
 *
 * The sheet does not exist until the first ink claims a rule, so the only place to wrap it is
 * the head append that puts it there.
 * @param booted - A booted plugin.
 * @param options - `order` to record `write` in, and `returnIndex` to report the insertion
 *   index from `insertRule` instead of the rule, which is what current Chromium returns.
 * @returns A function that puts the head's own append back.
 */
function watchInkSheet(booted, { order = null, returnIndex = false } = {}) {
  const head = booted.document.head
  const append = head.append
  // The plugin appends several sheets in one call, so every argument has to be forwarded.
  head.append = function (...elements) {
    const result = append.apply(head, elements)
    for (const element of elements) {
      if (element.dataset?.role !== 'stream-ink') continue
      const sheet = element.sheet
      const insertRule = sheet.insertRule
      sheet.insertRule = function (text, index) {
        insertRule.call(sheet, text, index)
        if (order !== null) order.push('write')
        return returnIndex ? sheet.cssRules.length - 1 : sheet.cssRules[sheet.cssRules.length - 1]
      }
    }
    return result
  }
  return () => { head.append = append }
}

test('a pass resolves every colour it needs before it writes a rule', () => {
  // The freeze, in one assertion. A stylesheet write invalidates style, so a colour read after
  // one recalculates the whole document: reading, writing and reading again costs one
  // recalculation per inked node, which at 190 nodes in a frame on a transcript of 7 000
  // elements is seconds of frozen main thread. The pass must therefore read first and write
  // second — and read once per element, since the highlight a text node settles into is its
  // parent's own colour.
  highlights.clear()
  const order = []
  const reads = globalThis.getComputedStyle
  let restore = () => {}
  globalThis.getComputedStyle = (element) => {
    order.push('read')
    return reads(element)
  }
  try {
    const booted = boot({ appearance: { streamingFadeDuration: 200, streamingFadeInk: 0.3 } })
    restore = watchInkSheet(booted, { order })
    // Booting is not the pass under test: only what the frame below does is recorded.
    order.length = 0

    // Three live tails, and a fourth text node sharing the first tail's paragraph.
    const tails = [streamingTail('甲'), streamingTail('乙'), streamingTail('丙')]
    const shared = createTextNode('丁')
    tails[0].paragraph.append(shared)
    for (const tail of tails) booted.document.body.append(tail.root)

    for (const tail of tails) booted.triggerMutation(chunk(tail.text))
    booted.triggerMutation(chunk(shared))
    booted.runFrame()

    assert.equal(inkRules(booted).length, 4, 'the four live tails did not each claim a rule')
    assert.deepEqual(
      order,
      ['read', 'read', 'read', 'write', 'write', 'write', 'write'],
      `the pass interleaved its colour reads with its stylesheet writes: ${order.join(', ')}`,
    )
    booted.dispose()
  } finally {
    restore()
    globalThis.getComputedStyle = reads
  }
})

test('a rule is withdrawn on a browser whose insertRule answers with an index', async () => {
  // The rule has to be recognised again when the ink settles, and current Chromium's
  // `insertRule` answers with the index it inserted at rather than the rule. Taking the return
  // value for the rule left every settled ink's rule in the sheet for the life of the page —
  // one per chunk ever inked, all of them matched by every recalculation of the document.
  highlights.clear()
  const booted = boot({ appearance: { streamingFadeDuration: 150, streamingFadeInk: 0.3 } })
  const restore = watchInkSheet(booted, { returnIndex: true })
  try {
    const { root, text } = streamingTail('墨')
    booted.document.body.append(root)

    booted.triggerMutation(chunk(text))
    booted.runFrame()
    assert.equal(inkRules(booted).length, 1, 'no rule was claimed')

    await new Promise((resolve) => setTimeout(resolve, 400))
    assert.equal(highlights.size, 0, 'the ink did not settle')
    assert.equal(inkRules(booted).length, 0, 'the settled ink left its rule in the stylesheet')
  } finally {
    booted.dispose()
    restore()
  }
})

test('a rebuilt zone is repainted inside the observer callback, not on a timer', () => {
  const picture = { name: 'bg.jpg', opacity: 0.2, panelOpacity: 90, blur: 0, size: 'cover', position: 'center' }
  const booted = boot({ backgrounds: { global: picture } })
  const surface = zoneSurface('[class*="_centerCol"]')
  assert.ok(surface !== null, 'the harness handed out no conversation surface')
  assert.equal(surface.getAttribute('data-dct-zone'), 'conversation', 'the conversation zone was never painted')

  // Re-reading the stored choices is what a repaint does, so counting reads counts repaints.
  const originalGetItem = storage.getItem
  let reads = 0
  storage.getItem = (key) => {
    reads += 1
    return originalGetItem(key)
  }
  try {
    // The shell swaps the panel for a fresh element; the painted one goes with it.
    surface.remove()
    booted.triggerMutation()
    assert.ok(reads > 0, 'the rebuild was not repainted by the time the callback returned')
  } finally {
    storage.getItem = originalGetItem
  }
  booted.dispose()
})

test('a surface the shell mounts after a pass is painted, not left behind the picture', () => {
  const picture = { name: 'bg.jpg', opacity: 0.2, panelOpacity: 90, blur: 0, size: 'cover', position: 'center' }
  const booted = boot({ backgrounds: { global: picture } })
  const column = booted.document.querySelector('[class*="_centerCol"]')
  const oldSurface = zoneSurface('[class*="_centerCol"]')

  // A session switch: the shell tears the conversation's panel down and mounts the next one a
  // commit later, and the observer is only told about the commit it lands in. Here the pass
  // runs with the panel already gone, so the column is all it can paint — exactly what the
  // shell's own timing produces.
  oldSurface.remove()
  booted.triggerMutation([{ type: 'childList', target: column, addedNodes: [], removedNodes: [oldSurface] }])
  assert.equal(column.getAttribute('data-dct-zone'), 'conversation',
    'the pass did not fall back to the column with the panel gone')

  // The replacement panel then arrives. Nothing the pass painted left the document, so only
  // the zone can say that the picture is now behind an element newer than itself; without
  // that the column keeps a picture nothing can see for the rest of the session.
  const surface = createElement('div')
  surface.rect = { ...column.rect }
  surface.computedBackground = 'rgb(24, 24, 24)'
  column.append(surface)
  booted.triggerMutation([{ type: 'childList', target: column, addedNodes: [surface], removedNodes: [] }])

  assert.equal(surface.getAttribute('data-dct-zone'), 'conversation',
    'the panel that arrived after the pass was left off the picture')
  assert.equal(column.getAttribute('data-dct-zone'), null, 'the column kept a picture it no longer shows')
  booted.dispose()
})

test('a growing transcript does not repaint the zones', () => {
  const picture = { name: 'bg.jpg', opacity: 0.2, panelOpacity: 90, blur: 0, size: 'cover', position: 'center' }
  const booted = boot({ backgrounds: { global: picture } })
  const surface = zoneSurface('[class*="_centerCol"]')
  assert.equal(surface.getAttribute('data-dct-zone'), 'conversation', 'the conversation zone was never painted')

  // Re-reading the stored choices is what a repaint does, so counting reads counts repaints.
  const originalGetItem = storage.getItem
  let reads = 0
  storage.getItem = (key) => {
    reads += 1
    return originalGetItem(key)
  }
  // The gate runs on every commit of a reply, so it may not read layout either: a forced reflow
  // per commit is the cost the pass itself is kept away from. Every box the gate could ask about
  // is counted — the painted surface, the zone element it was resolved from, the blocks that
  // arrive.
  let boxes = 0
  const countBox = (element) => {
    const original = element.getBoundingClientRect
    element.getBoundingClientRect = function countedBox(...args) {
      boxes += 1
      return original.apply(this, args)
    }
  }
  countBox(surface)
  countBox(surface.parent)
  try {
    // A streaming reply commits blocks into the transcript, which is inside the panel the
    // picture was painted on. That is a childList mutation inside a zone the picture is on,
    // but nothing the pass painted leaves the document and nothing arrives outside it, so the
    // observer must return without re-reading the store. This is what keeps a markdown-dense
    // reply off the repaint path entirely.
    for (let index = 0; index < 20; index += 1) {
      const block = createElement('p')
      countBox(block)
      surface.append(block)
      booted.triggerMutation([{ type: 'childList', target: surface, addedNodes: [block], removedNodes: [] }])
    }
    assert.equal(reads, 0, 'a growing transcript re-ran the repaint pass')
    assert.equal(boxes, 0, 'the zone observer read layout to decide whether a reply commit owed a repaint')
  } finally {
    storage.getItem = originalGetItem
  }
  booted.dispose()
})

/** One of the plugin's own stylesheets, by the role it publishes. */
function sheetCss(booted, role) {
  const element = booted.document.head.children.find((candidate) => candidate.dataset?.role === role)
  return element === undefined || element === null ? '' : element.textContent
}

test('the zone picker spreads across the whole row', () => {
  const page = sheetCss(boot({}), 'page')
  const row = page.match(/\.dct-zones \{[^}]*\}/)?.[0] ?? ''
  assert.ok(row.includes('display: grid'), `the zone picker is not a grid: ${row}`)
  assert.ok(row.includes('repeat(auto-fit, minmax(84px, 1fr))'), `the zone picker does not fill its row: ${row}`)
  assert.ok(!row.includes('flex-wrap'), 'the content-sized flex row is what left the picker short of the row')
})

test('a painted zone takes the shell’s own rules and fades out of the picture', () => {
  const picture = { name: 'bg.jpg', opacity: 0.2, panelOpacity: 90, blur: 0, size: 'cover', position: 'center' }

  const sidebar = boot({ backgrounds: { sidebar: picture } })
  const sidebarCss = sheetCss(sidebar, 'background-layer')
  assert.ok(sidebarCss.includes('[class*="_sidebarCol"] { border-color: transparent !important; }'),
    `the sidebar's own rule was left over the picture: ${sidebarCss}`)
  assert.ok(sidebarCss.includes('[class*="_treeBody"] > [class*="_fade"] { background-image: none !important; }'),
    `the workspace list fade was left over the picture: ${sidebarCss}`)
  // A zone with no picture keeps its chrome, and no other zone's chrome is written for it.
  assert.ok(!sidebarCss.includes('_header'), 'conversation chrome was written for a zone with no picture')
  assert.ok(!sidebarCss.includes('_composerSeat'), 'the composer fade was written for a zone with no picture')
  sidebar.dispose()

  const conversation = boot({ backgrounds: { conversation: picture } })
  const conversationCss = sheetCss(conversation, 'background-layer')
  // `:has(titleRow)` is what separates the conversation's header from the header of every code
  // card, terminal block and question panel that renders inside a reply.
  assert.ok(conversationCss.includes('[class*="_centerCol"] [class*="_header"]:has([class*="_titleRow"]) { border-color: transparent !important; }'),
    `the conversation header's rule was left over the picture: ${conversationCss}`)
  // The seat's dark gradient is cleared so a custom background picture shows through without
  // an opaque block, and the scroll container is offset by the composer height so messages do
  // not run underneath the input box.
  assert.ok(conversationCss.includes('[class*="_composerSeat"] { background: none; background-image: none !important; }'),
    `the composer's gradient was left over a picture: ${conversationCss}`)
  assert.ok(conversationCss.includes('margin-bottom: var(--dsh-composer-height'),
    `the transcript was not offset above the composer: ${conversationCss}`)
  assert.ok(!conversationCss.includes('_treeBody'), 'the sidebar fade was written for a zone with no picture')
  conversation.dispose()

  // A spread picture paints every zone, so every zone's chrome steps aside with it.
  const spread = boot({ backgrounds: { global: picture } })
  const spreadCss = sheetCss(spread, 'background-layer')
  assert.ok(spreadCss.includes('[class*="_treeBody"] > [class*="_fade"]'), `a spread picture left the workspace list fade: ${spreadCss}`)
  assert.ok(spreadCss.includes('[class*="_header"]:has([class*="_titleRow"])'), `a spread picture left the conversation header's rule: ${spreadCss}`)
  assert.ok(spreadCss.includes('[class*="_composerSeat"] { background: none; background-image: none !important; }'),
    `a spread picture left the composer with its dark gradient: ${spreadCss}`)
  spread.dispose()
})

test('a zone nested inside another writes its own fill instead of stacking it', () => {
  const picture = { name: 'bg.jpg', opacity: 0.25, panelOpacity: 91, blur: 0, size: 'cover', position: 'center' }
  const booted = boot({ backgrounds: { global: picture } })
  const surface = zoneSurface('[class*="_centerCol"]')
  const seat = surface.children.find((child) => child.getAttribute('data-composer-seat') !== null)
  assert.ok(seat !== undefined, 'the double no longer hangs the composer seat inside the conversation surface')
  assert.ok(surface.getAttribute('data-dct-layer') !== null, 'the conversation surface got no picture layer')

  // The seat sits inside the panel, so that picture is already behind it: a second copy of the
  // same image would read stronger than the opacity the user asked for.
  assert.equal(seat.getAttribute('data-dct-layer'), null, 'the nested zone painted a second copy of the same picture')

  // Two 91% fills composite to 99% — the near-black block over the picture — so the inner
  // fill is written for the two of them to come to the configured 91% together, which for
  // equal values means no fill at all.
  const fill = seat.style.getPropertyValue('background-color')
  assert.ok(/(^|,\s*)0\)$/.test(fill), `the nested fill was left to compound the outer one: ${fill}`)
  booted.dispose()
})

test('the whole-window picture reaches the zones the frame covers', () => {
  const picture = { name: 'bg.jpg', opacity: 0.25, panelOpacity: 91, blur: 16, size: 'cover', position: 'center' }
  const booted = boot({ backgrounds: { global: picture } })
  const frame = booted.document.querySelector('[class*="_frame"]')
  const sidebar = booted.document.querySelector('[class*="_sidebarCol"]')
  const column = booted.document.querySelector('[class*="_centerCol"]')
  assert.ok(frame.contains(column), 'the double no longer hangs the columns inside the frame')

  // The frame's layer sits behind the shell's opaque columns, so it is invisible in every
  // zone — which is the whole reason the spread pass paints each zone as well. Counting the
  // frame as covering them left the entire window without a picture.
  for (const [name, element] of [['sidebar', sidebar], ['conversation', zoneSurface('[class*="_centerCol"]')]]) {
    assert.ok(element.getAttribute('data-dct-layer') !== null,
      `the ${name} zone got no picture layer with only the whole-window picture set`)
  }
  assert.ok(sheetCss(booted, 'background-layer').includes('background-attachment: fixed'),
    'the spread picture lost its viewport anchoring')
  booted.dispose()
})

test('a mutation that cannot touch a reasoning turn never asks the document for one', () => {
  const booted = boot({ appearance: { reasoningExpand: 'always' } })
  const calls = []
  const original = booted.document.querySelectorAll
  booted.document.querySelectorAll = (selector) => {
    calls.push(selector)
    return original.call(booted.document, selector)
  }
  try {
    // Ordinary prose: no changed node holds a think block, so the pass stands down.
    const { root, text } = streamingTail('普通文本')
    booted.document.body.append(root)
    booted.triggerMutation([{ type: 'characterData', target: text }])
    assert.equal(calls.length, 0, 'the reasoning pass queried the whole document for a reply that cannot hold a turn')

    // A record that names a turn, though, has to be looked at.
    const think = createElement('div')
    think.setAttribute('data-variant', 'think')
    booted.triggerMutation([{ type: 'childList', addedNodes: [think] }])
    assert.ok(calls.length > 0, 'the reasoning pass never looked at the turn that was added')
  } finally {
    booted.document.querySelectorAll = original
    booted.dispose()
  }
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
  // The override layer is stacked on the shell's own theme runtime rather than registered as a
  // theme, so disposing has to take it off again: one unload must not leave a layer behind for the
  // next one to stack on top of.
  assert.equal(booted.appliedOverrides(), null, 'the override layer outlived the plugin')
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

function createMockThinkRow(initialState = 'running', expanded = false) {
  const thinkRoot = createElement('div')
  thinkRoot.setAttribute('data-variant', 'think')
  thinkRoot.setAttribute('data-state', initialState)
  if (expanded) thinkRoot.setAttribute('data-expanded', 'true')

  const row = createElement('div')
  row.setAttribute('data-disclosure-row', '')
  row.setAttribute('data-expandable', 'true')
  row.setAttribute('role', 'button')
  row.setAttribute('aria-expanded', expanded ? 'true' : 'false')

  let isExpanded = expanded
  row.onClick = () => {
    isExpanded = !isExpanded
    row.setAttribute('aria-expanded', isExpanded ? 'true' : 'false')
    if (isExpanded) {
      thinkRoot.setAttribute('data-expanded', 'true')
    } else {
      thinkRoot.removeAttribute('data-expanded')
    }
  }
  thinkRoot.append(row)
  return { thinkRoot, row, isExpanded: () => isExpanded }
}

test('appearance settings read reasoningExpand defaulting to streaming', () => {
  const booted = boot()
  assert.equal(booted.locale.bind('dshCustomTheme')('reasoningExpandTitle'), '思考内容展开')
  assert.equal(booted.locale.bind('dshCustomTheme')('reasoningExpandStreaming'), '仅思考中展开（结束后折叠）')
  assert.equal(booted.locale.bind('dshCustomTheme')('reasoningExpandKeep'), '思考中展开并保持（结束后不折叠）')
  assert.equal(booted.locale.bind('dshCustomTheme')('reasoningExpandAlways'), '始终展开（含历史消息）')
  assert.equal(booted.locale.bind('dshCustomTheme')('reasoningExpandFollow'), '跟随官方（默认折叠）')
  booted.dispose()
})

test('custom reasoningExpand choices persist and clamp to allowed options', () => {
  const bootedAlways = boot({ appearance: { reasoningExpand: 'always' } })
  assert.equal(bootedAlways.savedAppearance().reasoningExpand, 'always')
  bootedAlways.dispose()

  const bootedOff = boot({ appearance: { reasoningExpand: 'off' } })
  assert.equal(bootedOff.savedAppearance().reasoningExpand, 'off')
  bootedOff.dispose()

  const bootedKeep = boot({ appearance: { reasoningExpand: 'keep' } })
  assert.equal(bootedKeep.savedAppearance().reasoningExpand, 'keep')
  bootedKeep.dispose()
})

/**
 * Let the deferred synthetic toggle run.
 *
 * The client never clicks a disclosure synchronously: it schedules the click on a
 * macrotask so it cannot re-enter a React commit (`clickToggleSoon`).
 */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

test('reasoningExpand: streaming auto-expands on running and auto-collapses on finish', async () => {
  const booted = boot({ appearance: { reasoningExpand: 'streaming' } })
  const { thinkRoot, isExpanded } = createMockThinkRow('running', false)
  booted.document.body.append(thinkRoot)
  assert.equal(isExpanded(), false)

  booted.triggerMutation()
  await settle()
  assert.equal(isExpanded(), true, 'should auto-expand while running')

  // Still running: trigger mutation again does not double-toggle
  booted.triggerMutation()
  await settle()
  assert.equal(isExpanded(), true)

  // State transitions to ok: auto-collapses
  thinkRoot.setAttribute('data-state', 'ok')
  booted.triggerMutation()
  await settle()
  assert.equal(isExpanded(), false, 'should auto-collapse once finished')

  booted.dispose()
})

test('reasoningExpand: keep auto-expands on running and stays expanded on finish', async () => {
  const booted = boot({ appearance: { reasoningExpand: 'keep' } })
  const { thinkRoot, isExpanded } = createMockThinkRow('running', false)
  booted.document.body.append(thinkRoot)

  booted.triggerMutation()
  await settle()
  assert.equal(isExpanded(), true, 'should auto-expand while running')

  // State transitions to ok: stays expanded
  thinkRoot.setAttribute('data-state', 'ok')
  booted.triggerMutation()
  await settle()
  assert.equal(isExpanded(), true, 'should remain open on finish')

  booted.dispose()
})

test('reasoningExpand: always auto-expands running and completed reasoning blocks', async () => {
  const booted = boot({ appearance: { reasoningExpand: 'always' } })
  const { thinkRoot: runningRow, isExpanded: isRunningExpanded } = createMockThinkRow('running', false)
  const { thinkRoot: doneRow, isExpanded: isDoneExpanded } = createMockThinkRow('ok', false)
  booted.document.body.append(runningRow, doneRow)

  booted.triggerMutation()
  await settle()
  assert.equal(isRunningExpanded(), true, 'should auto-expand running block')
  assert.equal(isDoneExpanded(), true, 'should auto-expand completed block')

  booted.dispose()
})

test('reasoningExpand: off does not auto-expand running blocks', async () => {
  const booted = boot({ appearance: { reasoningExpand: 'off' } })
  const { thinkRoot, isExpanded } = createMockThinkRow('running', false)
  booted.document.body.append(thinkRoot)

  booted.triggerMutation()
  await settle()
  assert.equal(isExpanded(), false, 'should remain collapsed when off')

  booted.dispose()
})

test('reasoningExpand respects manual user interaction', async () => {
  const booted = boot({ appearance: { reasoningExpand: 'streaming' } })
  const { thinkRoot, row, isExpanded } = createMockThinkRow('running', false)
  booted.document.body.append(thinkRoot)

  booted.triggerMutation()
  await settle()
  assert.equal(isExpanded(), true, 'initially auto-expanded')

  // User manually clicks to collapse while running
  row.click()
  booted.document.dispatchDocEvent({ type: 'click', isTrusted: true, target: row })
  assert.equal(isExpanded(), false, 'collapsed by user')

  // Subsequent mutation while still running does not re-expand against user will
  booted.triggerMutation()
  await settle()
  assert.equal(isExpanded(), false, 'stays collapsed after user manual interaction')

  // Finished: does not toggle
  thinkRoot.setAttribute('data-state', 'ok')
  booted.triggerMutation()
  await settle()
  assert.equal(isExpanded(), false)

  booted.dispose()
})

/**
 * The reasoning-effort slider's stylesheet and wiring.
 *
 * `lib/client.js` writes the control into the always-on page sheet under `.ces-*` — the class
 * names `dsh-codex-effort-slider` (MIT) uses, kept verbatim so the two stylesheets can be read
 * side by side rule for rule, which is what "the effects match" means in practice. The control
 * itself, its maths and its DOM bridge are driven in `test/effort.test.mjs`, which has a
 * stateful React double; what is asserted here is the sheet and the wiring a page needs before
 * any component renders.
 */

/** The slider's own section of the page sheet, from its first rule to the end of the sheet. */
function sliderCss() {
  const page = sheetCss(boot({}), 'page')
  const at = page.indexOf('.ces-inline {')
  assert.ok(at >= 0, 'the page sheet carries no effort slider')
  return page.slice(at)
}

/**
 * One rule's declarations, read at the selector the sheet writes it with.
 * @param css - Stylesheet text.
 * @param selector - Selector text, before the rule's opening brace.
 * @returns The declarations, or the empty string when no rule names that selector.
 */
function ruleAt(css, selector) {
  const at = css.indexOf(`${selector} {`)
  if (at < 0) return ''
  const open = css.indexOf('{', at)
  const close = css.indexOf('}', open)
  return open < 0 || close < 0 ? '' : css.slice(open + 1, close)
}

/**
 * Every rule body written at this selector.
 *
 * A selector can be written twice — the rail names the focused stop once for its label and
 * once for its ring — so a caller that means the pair reads them together.
 * @param css - Stylesheet text.
 * @param selector - Selector text, before the rule's opening brace.
 * @returns One entry per rule, in source order.
 */
function rulesAt(css, selector) {
  const bodies = []
  let cursor = 0
  for (;;) {
    const at = css.indexOf(`${selector} {`, cursor)
    if (at < 0) return bodies
    const open = css.indexOf('{', at)
    const close = css.indexOf('}', open)
    if (open < 0 || close < 0) return bodies
    bodies.push(css.slice(open + 1, close))
    cursor = close
  }
}

/**
 * The body of the first at-rule opened by this header, braces balanced.
 * @param css - Stylesheet text.
 * @param header - The at-rule's header, e.g. `@media (prefers-reduced-motion: reduce)`.
 * @returns The block's text, or the empty string when the at-rule is not there.
 */
function blockAt(css, header) {
  const at = css.indexOf(header)
  if (at < 0) return ''
  const open = css.indexOf('{', at)
  if (open < 0) return ''
  let depth = 0
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1
    else if (css[index] === '}') {
      depth -= 1
      if (depth === 0) return css.slice(open + 1, index)
    }
  }
  return ''
}

/**
 * Every rule of a stylesheet as `{ selector, body }`, comments dropped and at-rule headers
 * unwrapped, so a rule nested in a media query is reported by its own selector.
 * @param css - Stylesheet text.
 * @returns One entry per rule, in source order.
 */
function leafRules(css) {
  return [...css.replace(/\/\*[\s\S]*?\*\//gu, '').matchAll(/([^{}]+)\{([^{}]*)\}/gu)]
    .map(([, selector, body]) => ({ selector: selector.replace(/\s+/gu, ' ').trim(), body }))
    .filter((rule) => rule.selector !== '')
}

test('the track, its parts and the knob share one geometry', () => {
  const css = sliderCss()
  const track = ruleAt(css, '.ces-track')
  assert.ok(track.includes('height: 28px'), `the track is not 28px tall: ${track}`)
  assert.ok(track.includes('border-radius: 999px'), `the track is not a pill: ${track}`)
  assert.ok(track.includes('touch-action: none'), 'a touch drag would scroll the menu under the finger')
  assert.ok(track.includes('cursor: pointer'), 'the track does not read as something to press and drag')
  // The knob is the track's own height across, and centred on the position it is handed, so
  // the circle is never cut by the menu's overflow the way a narrower set of insets would be.
  const knob = ruleAt(css, '.ces-knob')
  assert.ok(knob.includes('width: 28px') && knob.includes('height: 28px'), `the knob is not the track's height: ${knob}`)
  assert.ok(knob.includes('margin: -14px 0 0 -14px'), `the knob is not centred on its position: ${knob}`)
  // Nothing but the track itself is hit-testable; everything else is painted over it. The dot
  // is left out of the list on purpose: `pointer-events` inherits from its `.ces-star` strip.
  for (const part of ['.ces-knob', '.ces-fill', '.ces-tick', '.ces-star', '.ces-stars', '.ces-energy']) {
    assert.ok(ruleAt(css, part).includes('pointer-events: none'), `${part} would take the track's own presses`)
  }
  assert.ok(ruleAt(css, '.ces-track:focus-visible').includes('var(--dsw-focus-ring-color'),
    'the keyboard lost its ring')
  assert.ok(ruleAt(css, '.ces-error').includes('var(--dsw-alias-state-error-primary'),
    'a failed write is not shown in the shell’s error colour')
})

test('the energy is one variable driving the nebula, the glow and the parking', () => {
  const css = sliderCss()
  const energy = ruleAt(css, '.ces-energy')
  assert.ok(energy.includes('opacity: var(--ces-energy, 0)'), `the nebula is not driven by the energy: ${energy}`)
  assert.ok(energy.includes('linear-gradient(90deg, #3b1178 0%, #6d28d9 30%, #9333ea 62%, #c084fc 100%)'),
    `the nebula is not the reference's gradient: ${energy}`)
  // The component gives this layer exactly the fill's width, so the nebula stops at the knob.
  assert.ok(energy.includes('left: 0'), 'the nebula would not start at the track’s left end')
  // The row's glow follows the same number, so "powering up" is one composited transition.
  assert.ok(ruleAt(css, ".ces-inline[data-energy='1'] .ces-track").includes('calc(var(--ces-energy, 0) * 16px)'),
    'the lit track does not glow with the energy')
  // Invisible stars must not animate: 22 of them would burn a compositor layer for nothing.
  const parked = ruleAt(css, ".ces-inline[data-energy='0'] .ces-star, .ces-inline[data-energy='0'] .ces-energy__sweep")
  assert.ok(parked.includes('animation-play-state: paused'), `the particles keep running while invisible: ${parked}`)
  // The sweep is the only travelling light in the nebula. It is read by its whole selector:
  // the parked rule above also ends in `.ces-energy__sweep`.
  const sweep = leafRules(css).find((rule) => rule.selector === '.ces-energy__sweep')
  assert.ok(sweep !== undefined, 'the nebula has no sweep rule of its own')
  assert.ok(sweep.body.includes('animation: ces-sweep 2.4s linear infinite'),
    `the nebula has no travelling light: ${sweep.body}`)
})

test('the starfield never disappears, and bright is also bigger', () => {
  const css = sliderCss()
  // Every star is a full-width strip crossing the track; only the two ends fade, and both are
  // outside the visible window — which is what makes the field look as if it never empties.
  const star = ruleAt(css, '.ces-star')
  assert.ok(star.includes('animation-name: ces-star-sweep'), `the stars do not cross: ${star}`)
  assert.ok(star.includes('left: 0') && star.includes('right: 0'), `a star does not span the track: ${star}`)
  const frames = blockAt(css, '@keyframes ces-star-sweep')
  assert.ok(frames.includes('translate3d(-100%, 0, 0)'), `the crossing is not a full width: ${frames}`)
  assert.match(frames, /0% \{[^}]*opacity: 0/u, `a star is visible at the track's edge: ${frames}`)
  assert.match(frames, /6% \{ opacity: 1; \}/u, `the fade-in is not over the first few percent: ${frames}`)
  assert.match(frames, /94% \{ opacity: 1; \}/u, `the fade-out starts too early: ${frames}`)
  // Brightness is size as well as opacity, so the field reads with depth rather than as dots.
  const dot = ruleAt(css, '.ces-star__dot')
  assert.ok(dot.includes('opacity: var(--ces-b, 1)'), `the dot has no brightness variable: ${dot}`)
  assert.ok(dot.includes('transform: scale(var(--ces-b, 1))'), `the dot's size does not follow its brightness: ${dot}`)
  // The stars ride their own layer: nesting them in the nebula would halve them with its opacity.
  assert.ok(!ruleAt(css, '.ces-stars').includes('opacity: var(--ces-energy'), 'the stars fade with the nebula')
  // Only composited properties move, so no frame of the field touches layout.
  const cheap = new Set(['transform', 'opacity'])
  for (const [, property] of frames.matchAll(/([a-z-]+)\s*:/gu)) {
    assert.ok(cheap.has(property), `the starfield animates ${property}, which is not a cheap property`)
  }
})

test('the slider is dressed in the shell’s tokens and names no hashed class', () => {
  const css = sliderCss()
  assert.ok(ruleAt(css, '.ces-track').includes('var(--dsw-alias-border-l1'), 'the track bed ignores the palette')
  assert.ok(ruleAt(css, '.ces-inline').includes('var(--dsw-alias-state-business-primary'), 'the accent is not the shell’s')
  assert.ok(ruleAt(css, '.ces-inline').includes('var(--dsw-static-blue-450, #4d93f8)'),
    'the reference’s own blue is not the last fallback')
  assert.ok(ruleAt(css, '.ces-tick').includes('color-mix(in srgb, var(--dsw-alias-label-primary'),
    'the ticks do not follow the palette')
  assert.ok(css.includes('body[data-ds-dark-theme] .ces-star__dot'), 'the dark palette has no star colour of its own')
  for (const rule of leafRules(css)) {
    if (rule.selector === 'from' || rule.selector === 'to' || /^[\d@]/u.test(rule.selector)) continue
    assert.ok(!/\[class[*^~|$]?=/u.test(rule.selector), `a class fragment cannot survive a rebuild: ${rule.selector}`)
    assert.ok(!/\.[A-Za-z0-9-]+_[A-Za-z0-9-]+/u.test(rule.selector), `a hashed class name: ${rule.selector}`)
  }
})

test('reduced motion keeps the energy and drops the travel', () => {
  const css = sliderCss()
  const guard = blockAt(css, '@media (prefers-reduced-motion: reduce)')
  assert.ok(guard.includes('.ces-energy__sweep { display: none; }'), `the guard leaves the sweep running: ${guard}`)
  assert.ok(guard.includes('transition: none'), `the guard leaves the nebula's fade animating: ${guard}`)
  // The stars are slowed in the component instead: their durations are inline, where a media
  // query cannot reach them, and freezing them would erase the "energy is flowing" reading.
  assert.ok(!guard.includes('.ces-star'), 'a media query cannot reach an inline animation duration')
})

test('the quota notice is a text-only overlay that flips in place', () => {
  const css = sliderCss()
  const notice = ruleAt(css, '.ces-notice')
  assert.ok(notice.includes('position: absolute'), `the notice would take a line of the row: ${notice}`)
  assert.ok(notice.includes('pointer-events: none'), 'the notice swallows the clicks meant for the row')
  assert.ok(notice.includes('white-space: nowrap'), 'the warning is wider than the value cell and must not wrap')
  // The cell is wider than the word in it and the shell draws that word flush right, so both
  // faces end at the cell's right edge: centring strands a short name like "Max" mid-row.
  assert.ok(notice.includes('justify-content: flex-end'), `the phrase is not drawn where the value is: ${notice}`)
  const inner = ruleAt(css, '.ces-notice__inner')
  assert.ok(inner.includes('transform-style: preserve-3d'), 'a flat box cannot carry two faces')
  assert.ok(inner.includes('inset: 0'), `the box is not the cell's own: ${inner}`)
  assert.ok(inner.includes('transition: transform'), `the flip is not animated: ${inner}`)
  // Both faces fill the same box: a flip that leaves one of them in flow is a swap, not a turn.
  const face = ruleAt(css, '.ces-notice__face')
  assert.ok(face.includes('position: absolute') && face.includes('inset: 0'), `the faces are not one box: ${face}`)
  assert.ok(face.includes('backface-visibility: hidden'), 'both faces would show through each other')
  assert.ok(face.includes('justify-content: flex-end'), `a face is not aligned on the other: ${face}`)
  assert.ok(ruleAt(css, '.ces-notice__face--back').includes('rotateX(180deg)'), 'the second face is not mirrored')
  assert.ok(ruleAt(css, ".ces-notice[data-flipped='1'] .ces-notice__inner").includes('rotateX(180deg)'),
    'the notice has no flipped state to land on')
  // The shell's own value text is hushed instead of covered, which is what lets the notice be
  // text on the row's own look rather than a box that has to match a colour it guessed.
  assert.ok(ruleAt(css, '.ces-cell-hushed').includes('color: transparent !important'),
    'the cell under the notice is not hushed')
  // Reduced motion keeps the flip; it only stops it travelling.
  const guard = blockAt(css, '@media (prefers-reduced-motion: reduce)')
  assert.ok(guard.includes('.ces-notice__inner { transition-duration: 1ms; }'), `the guard misses the flip: ${guard}`)
})

/*
 * The wiring.
 *
 * The control is not registered on the plugin's own injection list. A shell that does not
 * expose `modelDirectories` must still get the themes, the backgrounds and the rest, so the
 * slider asks for the service in a nested injection and only the slider goes quiet when it is
 * missing — which is the difference between a control that is absent and a settings page that
 * never loads.
 */

test('the effort control asks for the model directory in a nested injection', () => {
  const booted = boot({ modelDirectories: { directoryFor: () => { throw new Error('the session scope is not bound yet') } } })
  try {
    const nested = booted.nestedInjections.filter((entry) => entry.services.includes('modelDirectories'))
    assert.equal(nested.length, 1, 'the control never asked for the model directory')
    assert.deepEqual(nested[0].services, ['slots', 'modelDirectories'])
    assert.ok(nested[0].ran, 'the injection never ran although the service was there')
    assert.ok(booted.injected.includes('conversation.input.right'),
      `the control registered nowhere: ${booted.injected.join(', ')}`)
  } finally {
    booted.dispose()
  }
})

test('the control reads the model directory off the scope it was handed, not the plugin context', () => {
  const directories = { directoryFor: () => { throw new Error('the session scope is not bound yet') } }
  const booted = boot({ modelDirectories: directories })
  try {
    const entry = booted.registrations.find((row) => row.options.id === 'dsh-custom-theme-effort')
    assert.ok(entry !== undefined, 'the control registered no entry in the composer slot')
    // Rendering the entry is what makes the context it closes over visible. A context that
    // never injected `modelDirectories` reads undefined there, so the directory never resolves,
    // the level list stays empty and the slider stays invisible — while its anchor still
    // renders and every other row of the plugin keeps working.
    const element = entry.component({ sessionId: 'session-1' })
    assert.equal(element.props.__ctx.modelDirectories, directories,
      'the control was handed a context it cannot read modelDirectories from')
  } finally {
    booted.dispose()
  }
})

test('a shell without the model directory still gets everything else', () => {
  const booted = boot()
  try {
    assert.ok(!booted.injected.includes('conversation.input.right'),
      'the control registered although its service was never available')
    const page = sheetCss(booted, 'page')
    assert.ok(page.includes('.dct-page {'), 'the settings page stylesheet went missing')
    assert.ok(page.includes('.ces-track {'), 'the slider stylesheet went missing with the service')
  } finally {
    booted.dispose()
  }
})

test('the plugin’s own injection list stays the three faces it always was', () => {
  assert.deepEqual(definition.factory(fakeRequire).inject, ['slots', 'locale', 'theme'])
})

test('the replaced rail is gone from the page sheet', () => {
  const css = sheetCss(boot({}), 'page')
  for (const gone of ['dct-effort-accent', 'dct-effort-fill', 'dct-effort-thumb', 'menuitemradio', 'nth-of-type(-n+']) {
    assert.ok(!css.includes(gone), `the replaced rail is still in the sheet: ${gone}`)
  }
  // What replaced it: the effort row is now dressed by the slider's own rules.
  assert.ok(css.includes('.ces-inline {'), 'nothing replaced the rail')
})

test('the reasoning-level switch is wired to the route the host half serves', () => {
  const exposed = definition.factory(fakeRequire).__internals
  assert.equal(exposed.EFFORT_LEVELS_URL, '/dsh-custom-theme/effort-levels')
  // The row asks the Host to write the profile file, so it posts: a read-only call would leave
  // the switch looking like it worked while the file stayed exactly as it was.
  assert.match(CLIENT_SOURCE, /EFFORT_LEVELS_URL, \{\s*method: 'POST'/u, 'the switch never writes')
  assert.ok(CLIENT_SOURCE.includes("body: JSON.stringify({ enabled })"), 'the switch sends no state to write')
  assert.ok(CLIENT_SOURCE.includes("className: 'dct-efforts'"), 'the row is not in the settings page')
  // The Host can be older than the bundle — it is imported once at boot — so the row has to
  // recognise the route's absence rather than report a failure about the models.
  assert.ok(CLIENT_SOURCE.includes('status: response.status'), 'the row cannot tell an old Host from a broken one')
})

test('the switch says what the profile holds, in the plugin’s own words', () => {
  const booted = boot({})
  try {
    const message = definition.factory(fakeRequire).__internals.effortMessage
    const t = booted.locale.bind('dshCustomTheme')
    // A key the dictionaries do not carry resolves to the key itself, so these assertions are
    // also what keeps the two dictionaries in step.
    assert.equal(message(t, null), '读取中…')
    assert.equal(message(t, { status: 404 }), '插件已更新，重启 DSH 后这一项才会生效')
    assert.equal(message(t, { status: 405 }), '插件已更新，重启 DSH 后这一项才会生效')
    assert.equal(message(t, { failure: 'boom' }), '宿主未能读写配置，详见日志')
    assert.equal(message(t, { failure: 'boom', status: 500 }), '宿主未能读写配置，详见日志 (HTTP 500)')
    assert.equal(message(t, { file: null, enabled: true }), '未在 profile 中找到 cordis.patch.yml，无法补全')
    assert.equal(message(t, { file: 'cordis.patch.yml', enabled: false, undeclared: [] }), '已关闭')
    assert.equal(message(t, { file: 'cordis.patch.yml', enabled: false, undeclared: ['a', 'b'] }),
      '已关闭 · 待补全模型数： 2')
    assert.equal(message(t, { file: 'cordis.patch.yml', enabled: true, managed: ['a'], restartRequired: true }),
      '已补全模型数： 1 · 重启 DSH 后生效')
    assert.equal(message(t, { file: 'cordis.patch.yml', enabled: true, managed: ['a'], restartRequired: false }),
      '已补全模型数： 1')
    assert.equal(message(t, { file: 'cordis.patch.yml', enabled: true, managed: [] }),
      '所有模型都已自己声明档位，无需补全')
  } finally {
    booted.dispose()
  }
})

test('the row the settings page adds shows the state and asks for the change', () => {
  const booted = boot({})
  try {
    const row = definition.factory(fakeRequire).__internals.effortLevelsRow
    const t = booted.locale.bind('dshCustomTheme')
    const asked = []
    const render = (state) => row(fakeRequire('react').createElement, t, state, (next) => asked.push(next))
    const [text, control] = render({ file: 'cordis.patch.yml', enabled: true, managed: ['a'], restartRequired: true }).children
    assert.equal(text.children[0].children[0], '自动补全推理档位')
    assert.equal(text.children[1].children[0], '未声明档位的第三方模型自动获得 off / low / high / max')
    assert.equal(text.children[2].children[0], '已补全模型数： 1 · 重启 DSH 后生效')
    const label = control.children[0]
    const box = label.children[0]
    assert.equal(box.props.type, 'checkbox')
    assert.equal(box.props.className, 'dct-efforts')
    assert.equal(box.props.checked, true)
    assert.equal(box.props.disabled, false)
    assert.equal(box.props['aria-label'], '自动补全推理档位')
    assert.equal(label.children[1].children[0], '自动')
    box.props.onChange({ target: { checked: false } })
    assert.deepEqual(asked, [false], 'moving the switch asked for nothing')

    // Before the first answer, and while a write is in flight, there is no state to show and
    // nothing to click; a profile the Host cannot find is shown the same way.
    for (const state of [null, { file: 'x', enabled: true, busy: true }, { file: null, enabled: true }]) {
      const [, pending] = render(state).children
      const pendingBox = pending.children[0].children[0]
      assert.equal(pendingBox.props.disabled, true, `the switch is live with nothing to write: ${JSON.stringify(state)}`)
      // What it shows is the wish, not the file: a write in flight stays on, and a profile with
      // no patch file still reports the state the Host remembered.
      assert.equal(pendingBox.props.checked, state !== null && state.enabled === true)
    }
    // Off says so, and the models still waiting are counted.
    const [, off] = render({ file: 'x', enabled: false, undeclared: ['a', 'b'] }).children
    assert.equal(off.children[0].children[0].props.checked, false)
    assert.equal(off.children[0].children[1].children[0], '关闭')
  } finally {
    booted.dispose()
  }
})

test('the DeepSeek deep-sea and whale styles are included in the page stylesheet', () => {
  const css = sliderCss()
  assert.ok(css.includes(".ces-inline[data-theme='deepseek'] .ces-energy"), 'DeepSeek energy style is missing')
  assert.ok(css.includes('#082f49 0%, #0369a1 30%, #0284c7 62%, #38bdf8 100%'), 'DeepSeek gradient is missing')
  assert.ok(css.includes('rgba(56, 189, 248, .6)'), 'DeepSeek cyan track glow is missing')
  assert.ok(css.includes('@keyframes ces-whale-swim'), 'Whale swimming animation is missing')
  assert.ok(css.includes('@keyframes ces-bubble-sweep'), 'Bubble sweep animation is missing')
  assert.ok(css.includes('@keyframes ces-ocean-sweep'), 'Ocean sweep animation is missing')
  assert.ok(css.includes('.ces-whale__svg'), 'Whale svg styling is missing')

  const booted = boot({})
  try {
    const tZh = booted.locale.bind('dshCustomTheme')
    assert.equal(tZh('effortThemeTitle'), '滑条特效风格')
    assert.equal(tZh('effortThemeCodex'), 'Codex 星空')
    assert.equal(tZh('effortThemeDeepSeek'), 'DeepSeek 深海')
  } finally {
    booted.dispose()
  }
})