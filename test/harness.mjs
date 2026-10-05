/**
 * Materializing the browser half outside a browser.
 *
 * `lib/client.js` is hand-written JavaScript that the shell's client module system
 * materializes in the page. Both the unit suite and the headless fixture suite need the
 * same two things from it — the definitions it registers, and the environment its `apply`
 * touches — so the doubles live here and the suites only assert.
 *
 * The doubles are deliberately thin: no layout, no React renderer, no shell. A suite
 * that needs any of those drives a real browser instead (see `test/browser/`).
 */

import fs from "node:fs"
import path from "node:path"

/**
 * The shell's `chat` dictionary for both shipped locales, as the installed build has it.
 */
export const CHAT = {
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
export const WORKING_KEY = 'dsh-custom-theme.working'

/** localStorage key the plugin reads its conversation appearance choices from. */
export const APPEARANCE_KEY = 'dsh-custom-theme.appearance'

/** localStorage key the plugin reads its selected theme id from. */
export const THEME_SELECTED_KEY = 'dsh-custom-theme.selected'

export const customThemeCssMocks = new Map()

export function setMockThemeCss(id, css) {
  customThemeCssMocks.set(id, css)
}

export function clearMockThemeCss() {
  customThemeCssMocks.clear()
}

const originalFetch = globalThis.fetch
globalThis.fetch = async (input, init) => {
  const url = String(input)
  if (url.startsWith('/dsh-custom-theme/theme/')) {
    const id = decodeURIComponent(url.replace('/dsh-custom-theme/theme/', '').replace(/\.css(?:\?.*)?$/u, ''))
    if (customThemeCssMocks.has(id)) {
      return {
        ok: true,
        status: 200,
        text: async () => customThemeCssMocks.get(id),
        json: async () => ({}),
      }
    }
    const filePath = path.resolve(import.meta.dirname, '..', 'themes', `${id}.css`)
    if (fs.existsSync(filePath)) {
      const text = fs.readFileSync(filePath, 'utf-8')
      return {
        ok: true,
        status: 200,
        text: async () => text,
        json: async () => ({}),
      }
    }
    return { ok: false, status: 404, text: async () => '', json: async () => ({}) }
  }
  return originalFetch ? originalFetch(input, init) : { ok: false, status: 404, text: async () => '', json: async () => ({}) }
}

/**
 * A localStorage double: what the plugin writes is what it reads back.
 * @returns The storage, with its `entries` exposed for assertions.
 */
export function createStorage() {
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
export function createElement(tagName) {
  return {
    tagName: String(tagName).toUpperCase(),
    dataset: {},
    style: { setProperty() {}, removeProperty() {} },
    children: [],
    parent: null,
    textContent: '',
    append(...nodes) {
      for (const node of nodes) {
        node.parent = this
        this.children.push(node)
      }
    },
    remove() {
      if (this.parent !== null) this.parent.children = this.parent.children.filter((node) => node !== this)
    },
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

export const storage = createStorage()

export const documentStub = {
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
export let definition = null
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

/** The `require` the browser half calls with, standing in for the shell's loader. */
export const fakeRequire = (id) => {
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
export function createLocale({ translate = true, chat } = {}) {
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
 * @param options - `working` seeds the stored choices, `raw` seeds them verbatim,
 *   `appearance` seeds appearance choices, `rawAppearance` seeds them verbatim,
 *   `locale` overrides the service.
 * @returns Handles for asserting on the booted plugin.
 */
export function boot({ working, raw, locale, appearance, rawAppearance, themeId, themeCssMock } = {}) {
  storage.entries.clear()
  if (raw !== undefined) storage.entries.set(WORKING_KEY, raw)
  else if (working !== undefined) storage.entries.set(WORKING_KEY, JSON.stringify(working))
  if (rawAppearance !== undefined) storage.entries.set(APPEARANCE_KEY, rawAppearance)
  else if (appearance !== undefined) storage.entries.set(APPEARANCE_KEY, JSON.stringify(appearance))
  if (themeId !== undefined) {
    storage.entries.set(THEME_SELECTED_KEY, themeId)
    if (themeCssMock !== undefined) {
      customThemeCssMocks.set(themeId, themeCssMock)
    }
  }
  // A boot is a fresh page for these assertions: the previous one's stylesheets are not
  // part of the document the plugin is booting into.
  documentStub.head.children.length = 0
  const service = locale ?? createLocale()
  const originalTranslate = service.translate
  const injected = []
  const disposers = []
  const warnings = []
  let appliedOverrides = null
  let activeScheme = 'dark'
  const ctx = {
    logger: { warn: (...args) => warnings.push(args.map((value) => String(value)).join(' ')) },
    effect: (factory) => {
      const dispose = factory()
      if (typeof dispose === 'function') disposers.push(dispose)
    },
    on: () => () => {},
    theme: {
      getTheme: () => ({ preference: 'system', fontSize: 14, active: { colorScheme: activeScheme } }),
      setTheme(s) { activeScheme = s },
      setFontSize() {},
      overrideTokens: (source, tokens) => {
        appliedOverrides = { source, tokens }
        return () => {
          if (appliedOverrides?.source === source) appliedOverrides = null
        }
      },
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
    /** The stylesheet carrying the theme's non-token rules, or null once removed. */
    themeStyle: () => documentStub.head.children.find((node) => node.dataset.role === 'theme') ?? null,
    /** That stylesheet's text. */
    themeCss: () => documentStub.head.children.find((node) => node.dataset.role === 'theme')?.textContent ?? '',
    /** Current overrides passed to ctx.theme.overrideTokens, or null. */
    appliedOverrides: () => appliedOverrides,
    /** Current active color scheme reported by the theme runtime. */
    activeScheme: () => activeScheme,
    /** Wait for async theme fetch and apply cycle to settle. */
    waitTheme: async () => {
      await new Promise((resolve) => setTimeout(resolve, 30))
    },
    /** The stylesheet carrying the running label's effect, or null once removed. */
    workingStyle: () => documentStub.head.children.find((node) => node.dataset.role === 'working') ?? null,
    /** That stylesheet's text, empty while the shipped look is the choice. */
    effectCss: () => documentStub.head.children.find((node) => node.dataset.role === 'working')?.textContent ?? '',
    /**
     * The page's own stylesheet, which among other things builds the sample's band.
     *
     * The fixture suite needs it to stand the sample up the way the page does; nothing in
     * it depends on the choices, which is why it is not the sheet under test.
     */
    pageCss: () => documentStub.head.children.find((node) => node.dataset.role === 'page')?.textContent ?? '',
    /** The stylesheet carrying the appearance overrides and stream fade rules. */
    appearanceStyle: () => documentStub.head.children.find((node) => node.dataset.role === 'appearance') ?? null,
    /** That stylesheet's text. */
    appearanceCss: () => documentStub.head.children.find((node) => node.dataset.role === 'appearance')?.textContent ?? '',
    /** The label as the shell would read it, through the namespace it binds. */
    t: (key, params) => service.bind('chat')(key, params),
    /** Dispose everything `apply` registered, the way unloading the plugin does. */
    dispose: () => { for (const dispose of disposers) dispose() },
  }
}
