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

import { CHAT, boot, createElement, createLocale, createTextNode, definition, fakeRequire, highlights, registeredProperties, storage } from "./harness.mjs"

/** The browser half's own source: asserted on where a live window cannot reach. */
const CLIENT_SOURCE = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8")

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

test('a rebuilt zone is repainted inside the observer callback, not on a timer', () => {
  const picture = { name: 'bg.jpg', opacity: 0.2, panelOpacity: 90, blur: 0, size: 'cover', position: 'center' }
  const booted = boot({ backgrounds: { global: picture } })
  const anchor = booted.document.querySelector('[class*="_centerCol"]')
  assert.ok(anchor !== null && anchor !== undefined, 'the harness handed out no conversation anchor')
  assert.equal(anchor.getAttribute('data-dct-zone'), 'conversation', 'the conversation zone was never painted')

  // Re-reading the stored choices is what a repaint does, so counting reads counts repaints.
  const originalGetItem = storage.getItem
  let reads = 0
  storage.getItem = (key) => {
    reads += 1
    return originalGetItem(key)
  }
  try {
    // The shell swaps the column for a fresh element; the painted one goes with it.
    anchor.remove()
    booted.triggerMutation()
    assert.ok(reads > 0, 'the rebuild was not repainted by the time the callback returned')
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
  // The seat's gradient is the mask that keeps the transcript from showing through the input
  // as it scrolls past. It must survive a picture, or text runs through the composer.
  assert.ok(!conversationCss.includes('_composerSeat'), `the composer's mask was written off over a picture: ${conversationCss}`)
  assert.ok(!conversationCss.includes('_treeBody'), 'the sidebar fade was written for a zone with no picture')
  conversation.dispose()

  // A spread picture paints every zone, so every zone's chrome steps aside with it. The
  // composer may be skipped there — the conversation's box covers it — but the fade above
  // the seat is the conversation's own chrome and is written either way.
  const spread = boot({ backgrounds: { global: picture } })
  const spreadCss = sheetCss(spread, 'background-layer')
  assert.ok(spreadCss.includes('[class*="_treeBody"] > [class*="_fade"]'), `a spread picture left the workspace list fade: ${spreadCss}`)
  assert.ok(spreadCss.includes('[class*="_header"]:has([class*="_titleRow"])'), `a spread picture left the conversation header's rule: ${spreadCss}`)
  assert.ok(!spreadCss.includes('_composerSeat'), `a spread picture left the composer without its mask: ${spreadCss}`)
  spread.dispose()
})

test('a zone nested inside another writes its own fill instead of stacking it', () => {
  const picture = { name: 'bg.jpg', opacity: 0.25, panelOpacity: 91, blur: 0, size: 'cover', position: 'center' }
  const booted = boot({ backgrounds: { global: picture } })
  const column = booted.document.querySelector('[class*="_centerCol"]')
  const seat = column.children.find((child) => child.getAttribute('data-composer-seat') !== null)
  assert.ok(seat !== undefined, 'the double no longer hangs the composer seat inside the conversation column')
  assert.ok(column.getAttribute('data-dct-layer') !== null, 'the conversation column got no picture layer')

  // The seat sits inside the column, so the column's picture is already behind it: a second
  // copy of the same image would read stronger than the opacity the user asked for.
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
  for (const [name, element] of [['sidebar', sidebar], ['conversation', column]]) {
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
 * The effort rail.
 *
 * `lib/client.js` dresses the shell's reasoning-effort picker into a slider through the
 * selectors below. The shell's side of that contract is
 * `ui-model-selection/src/client/ModelSelect.tsx`: the pane is a `role="menu"` whose direct
 * children are one `role="menuitemradio"` button per level, each holding the level's name in a
 * leading span and the shell's own check in a trailing one, with `aria-checked="true"` on the
 * level in use. Two facts about that markup decide the selectors and are asserted below: the
 * menu primitive always renders its material backing as the surface's first child, and a
 * failed catalog load renders an error strip before the rows — neither is a stop, so a
 * button's child index is not its stop index, while the sibling buttons are exactly the stops.
 *
 * These read the rules back out of the page sheet, which is the always-on sheet the rail is
 * written into. What only a window can show — the rail's pixels and the flowing gradient —
 * needs a human eye.
 */
const RAIL = '[role="menu"]:has(> [role="menuitemradio"])'
const RAIL_STOP = `${RAIL} > [role="menuitemradio"]`
const RAIL_MARKER = `${RAIL_STOP} > span:last-child`
/** The fill rule for a checked stop: the container's `:has()` names the stop in use, the
 * stop's `:nth-of-type` range covers the stops before it. */
const fillSelector = (checked, covered) =>
  `[role="menu"]:has(> [role="menuitemradio"]:nth-of-type(${checked})[aria-checked="true"]) > [role="menuitemradio"]:nth-of-type(-n+${covered})::before`

/** The rail's own section of the page sheet, from its first rule to the end of the sheet. */
function railCss() {
  const page = sheetCss(boot({}), 'page')
  const at = page.indexOf(RAIL)
  assert.ok(at >= 0, 'the page sheet carries no effort rail')
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

test('the effort pane is laid out as a rail of stops', () => {
  const rail = railCss()
  const pane = ruleAt(rail, RAIL)
  assert.ok(pane.includes('flex-direction: row'), `the pane is still a column of rows: ${pane}`)
  const stop = ruleAt(rail, RAIL_STOP)
  assert.ok(stop.includes('flex: 1 1 0'), `the stops are not equal shares of the row: ${stop}`)
  assert.ok(stop.includes('min-width: 0'), `the shell's full-width row minimum is still in force: ${stop}`)
  assert.ok(stop.includes('flex-direction: column'), `the marker does not sit above its name: ${stop}`)
  assert.ok(stop.includes('text-align: center'), `the stops are still left-aligned rows: ${stop}`)
  // The name is capped to its stop, so a long level ellipsizes inside it.
  assert.ok(ruleAt(rail, `${RAIL_STOP} > span:first-child`).includes('max-width: 100%'),
    'a long level name would run under its neighbours')
  // The track runs from one marker to the next, and the last stop has nothing to reach.
  const segment = ruleAt(rail, `${RAIL_STOP}::before`)
  assert.ok(segment.includes('left: 50%') && segment.includes('right: -50%'),
    `a segment does not reach from its own stop to the next: ${segment}`)
  assert.ok(segment.includes('pointer-events: none'),
    'the overhanging half of a segment would take the next stop’s clicks')
  assert.ok(ruleAt(rail, `${RAIL_STOP}:last-of-type::before`).includes('right: 50%'),
    'the last stop draws a segment past itself')
  // The marker is the row's own check slot: it moves above the name without a node of ours.
  const marker = ruleAt(rail, RAIL_MARKER)
  assert.ok(marker.includes('order: -1'), `the marker stayed beside the name: ${marker}`)
  assert.ok(marker.includes('z-index: 1'), `the marker would be painted under the track: ${marker}`)
  // The error strip a failed catalog load renders keeps a line of its own above the rail.
  const strip = `${RAIL}:has(> :not([role="menuitemradio"]):not([aria-hidden="true"]))`
  assert.ok(ruleAt(rail, strip).includes('padding-top'), 'the error strip would sit inside the rail')
})

test('the track fills exactly up to the level in use', () => {
  const rail = railCss()
  // Every filled selector names one checked stop and covers the stops before it. The
  // arithmetic is what is under test: a fill that ran the other way would light the stops
  // above the level instead of the ones below it.
  const fill = /\[role="menu"\]:has\(> \[role="menuitemradio"\]:nth-of-type\((\d+)\)\[aria-checked="true"\]\) > \[role="menuitemradio"\]:nth-of-type\(-n\+(\d+)\)::before/gu
  const filled = [...rail.matchAll(fill)].map(([, checked, covered]) => [Number(checked), Number(covered)])
  assert.deepEqual(filled, [[2, 1], [3, 2], [4, 3], [5, 4], [6, 5]],
    `the fills do not cover the stops before the checked one: ${JSON.stringify(filled)}`)
  assert.ok(!rail.includes(':nth-of-type(n+'), 'a forward range would fill from the checked stop onward')
  // An unchecked rail is a track: the muted tone, no accent, nothing moving.
  const track = ruleAt(rail, `${RAIL_STOP}::before`)
  assert.ok(track.includes('background-color: var(--dsw-alias-border-l3'), `the track is not the muted tone: ${track}`)
  assert.ok(!track.includes('dct-effort-accent'), `every stop is filled before anything is checked: ${track}`)
  assert.ok(!track.includes('animation'), `the unfilled track should not animate: ${track}`)
  // The filled part is the theme's accent, and it flows.
  const filledBody = ruleAt(rail, fillSelector(6, 5))
  assert.ok(filledBody.includes('background-color: var(--dct-effort-accent)'),
    `the filled part is not the accent: ${filledBody}`)
  assert.ok(filledBody.includes('animation: dct-effort-fill'), `the filled part does not flow: ${filledBody}`)
})

test('the rail takes its accent from the theme', () => {
  const rail = railCss()
  // One property, in one place, derived from the theme's own primary — the token all three
  // palettes this plugin ships define, so monokai-pro's teal and the government theme's red
  // both reach the rail — with the shell's business accent and its blue behind it.
  const accent = ruleAt(rail, RAIL)
  assert.ok(accent.includes('--dct-effort-accent: var(--dsw-alias-brand-primary'),
    `the rail does not follow the theme's primary: ${accent}`)
  assert.ok(accent.includes('var(--dsw-alias-state-business-primary'), 'the accent has no fallback to the shell’s own')
  for (const rule of [`${RAIL_STOP}[aria-checked="true"] > span:last-child::before`,
    `${RAIL_STOP}[aria-checked="true"] > span:last-child::after`]) {
    assert.ok(ruleAt(rail, rule).includes('var(--dct-effort-accent)'), `${rule} does not wear the rail's accent`)
  }
  // The sheen is a step away from the accent, not a colour of its own, so it stays visible
  // on every palette. The five fill selectors share one body, written after the last of them.
  const filled = ruleAt(rail, fillSelector(6, 5))
  assert.ok(filled.includes('color-mix(in srgb, var(--dct-effort-accent)'), `the sheen is a fixed colour: ${filled}`)
})

test('the filled track flows, and stops flowing when motion is reduced', () => {
  const rail = railCss()
  const filled = ruleAt(rail, fillSelector(6, 5))
  assert.ok(filled.includes('background-image: linear-gradient('), `the flow has no gradient behind it: ${filled}`)
  assert.ok(filled.includes('background-size: 220% 100%'), `the gradient has nowhere to travel: ${filled}`)
  // One stop out of step per segment, so the crest travels along the rail rather than every
  // filled segment brightening at once — and the delays stay after the shorthand that resets
  // them.
  assert.ok(ruleAt(rail, `${RAIL_STOP}:nth-of-type(3)::before`).includes('animation-delay'),
    'every filled segment would brighten in lockstep')
  assert.ok(rail.indexOf('animation: dct-effort-fill') < rail.indexOf(`${RAIL_STOP}:nth-of-type(2)::before`),
    'the animation shorthand is declared after a delay, and would reset it')
  // The thumb is the level in use, and a ring leaves it.
  const ring = ruleAt(rail, `${RAIL_STOP}[aria-checked="true"] > span:last-child::after`)
  assert.ok(ring.includes('animation: dct-effort-thumb'), `the thumb does not pulse: ${ring}`)
  // Only paint and composite properties move: no frame of either animation touches layout.
  const cheap = new Set(['background-position', 'background-size', 'transform', 'opacity'])
  for (const name of ['dct-effort-fill', 'dct-effort-thumb']) {
    const frames = blockAt(rail, `@keyframes ${name}`)
    assert.ok(frames !== '', `the ${name} keyframes are missing`)
    for (const [, property] of frames.matchAll(/([a-z-]+)\s*:/gu)) {
      assert.ok(cheap.has(property), `${name} animates ${property}, which is not a cheap property`)
    }
  }
  // A reader who asked for less motion loses the travel in all three places it lives.
  const guard = blockAt(rail, '@media (prefers-reduced-motion: reduce)')
  assert.ok(guard.includes('animation: none'), `the guard does not stop the flow: ${guard}`)
  assert.ok(guard.includes(`${RAIL_STOP}::before`), `the guard does not name the track: ${guard}`)
  assert.ok(guard.includes('span:last-child::after'), `the guard does not name the thumb's ring: ${guard}`)
  assert.ok(guard.includes('transition: none'), `the guard leaves the marker's size change animating: ${guard}`)
})

test('the rail is the effort pane’s alone, and names no build-specific class', () => {
  const rail = railCss()
  for (const rule of leafRules(rail)) {
    if (rule.selector === 'from' || rule.selector === 'to') continue
    // The direct-child step is what keeps the model pane's own radios — nested inside a
    // role="group" — out of the skin.
    for (const [, inner] of rule.selector.matchAll(/:has\(([^)]*)/gu)) {
      assert.ok(inner.startsWith('> '), `a descendant :has() would also match the model pane: ${rule.selector}`)
    }
    assert.ok(rule.selector.includes('menuitemradio'), `a rule outside the pane: ${rule.selector}`)
    assert.ok(!/\[class[*^~|$]?=/u.test(rule.selector), `a class fragment cannot survive a rebuild: ${rule.selector}`)
    assert.ok(!/\.[A-Za-z0-9-]+_[A-Za-z0-9-]+/u.test(rule.selector), `a hashed class name: ${rule.selector}`)
  }
  assert.ok(!rail.includes(':nth-child'),
    'the material backing the menu renders first makes a child index the wrong stop index')
  assert.ok(rail.includes(':nth-of-type(2)[aria-checked="true"]'), 'the stop in use is not read by position')
})

test('the rail hides no stop, no name and no focus ring', () => {
  const rail = railCss()
  for (const rule of leafRules(rail)) {
    assert.ok(!/display:\s*none|visibility:\s*hidden/u.test(rule.body),
      `${rule.selector} takes a stop, its name or its check out of the shell's tree`)
  }
  // The check the shell renders stays where it is, and stays visible on the marker.
  assert.ok(ruleAt(rail, `${RAIL_MARKER} > svg`).includes('z-index: 1'),
    'the check would be painted under the marker')
  assert.ok(ruleAt(rail, `${RAIL_MARKER} > svg:not([data-state])`).includes('width: 9px'),
    'the shell’s check glyph is not sized to the marker')
  // The keyboard keeps a ring of its own.
  const ring = rulesAt(rail, `${RAIL_STOP}:focus-visible`).join(' ')
  assert.ok(ring.includes('outline'), 'the shell’s focus fill is the only focus affordance left')
  assert.ok(ring.includes('var(--dsw-focus-ring-color'), 'the focus ring should be the shell’s own token')
})

// The rail is dragged, not only clicked. The plugin still adds no node of its own: a drag
// hit-tests the shell's own stops and clicks the one under the pointer, and a press that never
// moves stays the ordinary tap the shell already handled.

/** One stop of a fake rail: a menu radio with a box the pointer can be hit-tested against. */
function railStop(checked, left, width) {
  const stop = createElement('button')
  stop.setAttribute('role', 'menuitemradio')
  stop.setAttribute('aria-checked', String(checked))
  stop.rect = { left, top: 0, width, height: 20, right: left + width, bottom: 20 }
  stop.clicks = []
  // A real click on a stop goes through the shell's handler, which re-renders the pane with
  // that stop checked. The double has to do the same, or the rail would look as if selecting
  // the level already in use were still worth a Host call.
  stop.onClick = () => {
    stop.clicks.push(stop.getAttribute('aria-checked'))
    stop.setAttribute('aria-checked', 'true')
  }
  return stop
}

/** A fake effort pane. Its own children are its stops, which is how the drag finds them. */
function railOf(stops) {
  const pane = createElement('div')
  pane.setAttribute('role', 'menu')
  for (const stop of stops) {
    pane.append(stop)
  }
  return pane
}

/** A press, a move or a release, as the document would deliver it. */
function pointer(doc, type, extra) {
  doc.dispatchDocEvent({ type, button: 0, ...extra })
}

test('dragging the effort rail selects the stop the pointer is over', () => {
  const booted = boot({})
  try {
    const stops = [railStop(true, 0, 60), railStop(false, 60, 60), railStop(false, 120, 60)]
    railOf(stops)
    const doc = booted.document
    pointer(doc, 'pointerdown', { target: stops[0], clientX: 10 })
    pointer(doc, 'pointermove', { clientX: 150 })
    assert.deepEqual(stops[2].clicks, ['false'], 'the stop under the pointer was never selected')
    assert.deepEqual(stops[0].clicks, [], 'the stop the press began on was selected instead')
    pointer(doc, 'pointerup', { clientX: 150 })
    assert.equal(stops[2].clicks.length, 1, 'the release selected the same stop a second time')
  } finally {
    booted.dispose()
  }
})

test('a press that never moves stays the ordinary tap it was', () => {
  const booted = boot({})
  try {
    const stops = [railStop(true, 0, 60), railStop(false, 60, 60)]
    railOf(stops)
    pointer(booted.document, 'pointerdown', { target: stops[0], clientX: 10 })
    pointer(booted.document, 'pointerup', { clientX: 11 })
    assert.deepEqual(stops[0].clicks, [], 'a tap was turned into a synthetic selection')
    assert.deepEqual(stops[1].clicks, [], 'a tap reached a stop the pointer never touched')
  } finally {
    booted.dispose()
  }
})

test('the click a drag leaves on the stop it began at is swallowed, once', () => {
  const booted = boot({})
  try {
    const stops = [railStop(true, 0, 60), railStop(false, 60, 60), railStop(false, 120, 60)]
    railOf(stops)
    const doc = booted.document
    pointer(doc, 'pointerdown', { target: stops[0], clientX: 10 })
    pointer(doc, 'pointermove', { clientX: 130 })
    let prevented = 0
    const click = { target: stops[0], preventDefault: () => { prevented += 1 }, stopPropagation: () => {} }
    doc.dispatchDocEvent({ type: 'click', ...click })
    assert.equal(prevented, 1, 'the click left on the stop the drag began at was let through')
    doc.dispatchDocEvent({ type: 'click', ...click })
    assert.equal(prevented, 1, 'an ordinary click after the drag was swallowed too')
    pointer(doc, 'pointerup', { clientX: 130 })
  } finally {
    booted.dispose()
  }
})

test('a menu of one stop is not a rail, and is left to the shell', () => {
  const booted = boot({})
  try {
    const solo = railStop(false, 0, 60)
    railOf([solo])
    const doc = booted.document
    pointer(doc, 'pointerdown', { target: solo, clientX: 10 })
    pointer(doc, 'pointermove', { clientX: 55 })
    pointer(doc, 'pointerup', { clientX: 55 })
    assert.deepEqual(solo.clicks, [], 'a lone stop was dragged along a rail it does not have')
  } finally {
    booted.dispose()
  }
})

test('disposing the plugin takes the drag listeners with it', () => {
  const booted = boot({})
  booted.dispose()
  const stops = [railStop(true, 0, 60), railStop(false, 60, 60), railStop(false, 120, 60)]
  railOf(stops)
  const doc = booted.document
  pointer(doc, 'pointerdown', { target: stops[0], clientX: 10 })
  pointer(doc, 'pointermove', { clientX: 150 })
  pointer(doc, 'pointerup', { clientX: 150 })
  assert.deepEqual(stops[2].clicks, [], 'a disposed plugin still dragged the rail')
})

test('the rail claims the gesture instead of letting the menu scroll', () => {
  const booted = boot({})
  try {
    const css = sheetCss(booted, 'page')
    assert.ok(css.includes('touch-action: none'), 'a touch drag would scroll the menu under the finger')
    assert.match(css, /padding: 0 3px 6px;[\s\S]{0,220}?cursor: pointer;/u,
      'a stop does not read as something to press and drag')
  } finally {
    booted.dispose()
  }
})