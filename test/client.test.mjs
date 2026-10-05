/**
 * Client-half tests.
 *
 * `lib/client.js` is the browser half: hand-written JavaScript that the shell's client
 * module system materializes in the page. This suite materializes it the same way — a
 * fake `window.__ModuleLoader__` capturing the definition, a fake `require` for the two
 * modules it asks for, and a context double carrying only the faces `apply` touches —
 * and then asserts on the one thing it does to the shell: the wording of the running
 * label.
 *
 * That wording is reached through the locale service rather than the DOM, which is what
 * makes it drivable from here at all: no browser and no live turn are needed to read
 * what `chat.deepDiving` resolves to. What only a real window can show — the label on
 * screen, its shimmer and the clock beside it — is `test/browser/working-row.mjs`.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

/** The shell's `chat` dictionary for both shipped locales, as the installed build has it. */
const CHAT = {
  zh: {
    'chat.deepDiving': '深度求索中',
    'chat.deepDivingFor': '深度求索中，用时 {duration} ···',
    'message.turnProcess.worked': '已完成',
    'message.turnProcess.took': '已完成，用时 ',
    'message.turnProcess.failed': '处理失败',
  },
  en: {
    'chat.deepDiving': 'Deep diving',
    'chat.deepDivingFor': 'Deep diving for {duration} ···',
    'message.turnProcess.worked': 'Worked',
    'message.turnProcess.took': 'Took ',
    'message.turnProcess.failed': 'Failed',
  },
}

/** localStorage key the plugin reads its phrase list from. */
const WORKING_KEY = 'dsh-custom-theme.working'

/**
 * A localStorage double: what the plugin writes is what it reads back.
 * @returns The storage, with its `entries` exposed for assertions.
 */
function createStorage() {
  const entries = new Map()
  return {
    entries,
    getItem: (key) => (entries.has(key) ? entries.get(key) : null),
    setItem: (key, value) => { entries.set(key, String(value)) },
    removeItem: (key) => { entries.delete(key) },
  }
}

/**
 * One element double: an element's shape without a layout engine behind it.
 * @param tagName - Tag the plugin asked for.
 * @returns The element.
 */
function createElement(tagName) {
  return {
    tagName: String(tagName).toUpperCase(),
    dataset: {},
    style: { setProperty() {}, removeProperty() {} },
    children: [],
    textContent: '',
    append(...nodes) { this.children.push(...nodes) },
    remove() {},
    setAttribute() {},
    removeAttribute() {},
    getAttribute() { return null },
    addEventListener() {},
    removeEventListener() {},
    getBoundingClientRect() { return { width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0 } },
    querySelector() { return null },
    querySelectorAll() { return [] },
  }
}

const storage = createStorage()
const documentStub = {
  head: createElement('head'),
  body: createElement('body'),
  documentElement: createElement('html'),
  createElement,
  // A zone anchor that always exists keeps the boot pass from arming its retry timer.
  querySelector: () => createElement('div'),
  querySelectorAll: () => [],
  addEventListener() {},
  removeEventListener() {},
}

globalThis.document = documentStub
globalThis.localStorage = storage
globalThis.getComputedStyle = () => ({ color: 'rgb(0, 0, 0)', backgroundColor: 'rgba(0, 0, 0, 0)', position: 'static' })
globalThis.window = {
  localStorage: storage,
  setTimeout,
  clearTimeout,
  __ModuleLoader__: null,
}

/** The definition the browser half registers with the module loader. */
let definition = null
window.__ModuleLoader__ = {
  load(loaded) { definition = loaded },
}
await import('../lib/client.js')

/** The two modules the factory asks for, as much of them as it touches. */
const REACT = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  Fragment: Symbol('Fragment'),
  memo: (component) => component,
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect: () => {},
  useMemo: (factory) => factory(),
  useCallback: (callback) => callback,
  useRef: (initial) => ({ current: initial ?? null }),
}
const fakeRequire = (id) => {
  if (id === 'react') return REACT
  if (id === '@deepseek-ai/dsh-client-ui-primitives') return {}
  throw new Error(`unexpected require: ${id}`)
}

/**
 * A locale-service double: the dictionaries, the per-namespace binding and the lookup
 * every bound `t` dispatches through.
 * @param options - `chat` overrides the shell's `chat` dictionary, `translate` false
 *   omits the lookup, as a shell that exposes none.
 * @returns The service.
 */
function createLocale({ translate = true, chat } = {}) {
  const dicts = new Map([['chat', new Map(Object.entries(chat ?? CHAT))]])
  const bound = new Map()
  const service = {
    bind(ns) {
      if (!bound.has(ns)) bound.set(ns, (key, params) => service.translate(ns, key, params))
      return bound.get(ns)
    },
    register(ns, localeOrDicts, dict) {
      const pairs = typeof localeOrDicts === 'string' ? [[localeOrDicts, dict]] : Object.entries(localeOrDicts)
      if (!dicts.has(ns)) dicts.set(ns, new Map())
      for (const [locale, entries] of pairs) dicts.get(ns).set(locale, entries)
      return () => {}
    },
  }
  if (translate) {
    service.translate = function (ns, key, params) {
      const locales = dicts.get(ns)
      const template = locales?.get('zh')?.[key] ?? locales?.get('en')?.[key] ?? key
      if (params === undefined) return template
      return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match))
    }
  }
  return service
}

/**
 * Materialize the browser half the way the page does and run its `apply`.
 * @param options - `working` seeds the stored phrase list, `raw` seeds it verbatim,
 *   `locale` overrides the service.
 * @returns Handles for asserting on the booted plugin.
 */
function boot({ working, raw, locale } = {}) {
  storage.entries.clear()
  if (raw !== undefined) storage.entries.set(WORKING_KEY, raw)
  else if (working !== undefined) storage.entries.set(WORKING_KEY, JSON.stringify(working))
  const service = locale ?? createLocale()
  const originalTranslate = service.translate
  const injected = []
  const disposers = []
  const warnings = []
  const ctx = {
    logger: { warn: (...args) => warnings.push(args.map((value) => String(value)).join(' ')) },
    effect: (factory) => {
      const dispose = factory()
      if (typeof dispose === 'function') disposers.push(dispose)
    },
    on: () => () => {},
    theme: {
      getTheme: () => ({ preference: 'system', fontSize: 14, active: { colorScheme: 'dark' } }),
      setTheme() {},
      setFontSize() {},
      overrideTokens: () => () => {},
    },
    slots: {
      inject: (name) => { injected.push(name); return () => {} },
      register: () => () => {},
    },
    locale: service,
  }
  definition.factory(fakeRequire).apply(ctx)
  return {
    locale: service,
    originalTranslate,
    injected,
    warnings,
    /** The label as the shell would read it, through the namespace it binds. */
    t: (key, params) => service.bind('chat')(key, params),
    /** Dispose everything `apply` registered, the way unloading the plugin does. */
    dispose: () => { for (const dispose of disposers) dispose() },
  }
}

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
