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

function matchesSelector(node, selector) {
  if (!node || !selector) return false
  const parts = selector.split(',').map((s) => s.trim())
  for (const part of parts) {
    if (matchSingle(node, part)) return true
  }
  return false
}

function matchSingle(node, selector) {
  const tagMatch = selector.match(/^[a-zA-Z0-9_-]+/u)
  if (tagMatch) {
    const tag = tagMatch[0].toUpperCase()
    if (node.tagName !== tag) return false
  }
  const classMatches = selector.matchAll(/\.([a-zA-Z0-9_-]+)/gu)
  for (const m of classMatches) {
    const cls = m[1]
    const nodeClass = node.getAttribute?.('class') || ''
    if (!nodeClass.split(/\s+/u).includes(cls)) return false
  }
  const attrMatches = selector.matchAll(/\[([a-zA-Z0-9_-]+)(?:([*^$~|]?=)(?:"([^"]*)"|'([^']*)'|([^\]]+)))?\]/gu)
  for (const m of attrMatches) {
    const attrName = m[1]
    const op = m[2]
    const val = m[3] ?? m[4] ?? m[5] ?? ''
    const nodeVal = node.getAttribute?.(attrName)
    if (nodeVal === null || nodeVal === undefined) return false
    if (!op) continue
    if (op === '=' && nodeVal !== val) return false
    if (op === '*=' && !nodeVal.includes(val)) return false
    if (op === '^=' && !nodeVal.startsWith(val)) return false
    if (op === '$=' && !nodeVal.endsWith(val)) return false
  }
  return true
}

/**
 * One element double: an element's shape without a layout engine behind it.
 * @param tagName - Tag the plugin asked for.
 * @returns The element.
 */
export function createElement(tagName) {
  const attributes = new Map()
  const eventListeners = new Map()
  const el = {
    tagName: String(tagName).toUpperCase(),
    nodeType: 1,
    dataset: {},
    // Inline properties are recorded rather than dropped: the paint pass writes the zone
    // fills this way, and a double that swallowed them could not be asked whether two
    // nested zones compounded their fills.
    style: {
      properties: new Map(),
      setProperty(name, value) { this.properties.set(name, String(value)) },
      removeProperty(name) { this.properties.delete(name) },
      getPropertyValue(name) { return this.properties.get(name) ?? '' },
    },
    children: [],
    parent: null,
    textContent: '',
    isConnected: true,
    append(...nodes) {
      for (const node of nodes) {
        node.parent = this
        this.children.push(node)
      }
    },
    remove() {
      if (this.parent !== null) this.parent.children = this.parent.children.filter((node) => node !== this)
      this.isConnected = false
    },
    setAttribute(name, value) {
      attributes.set(name, String(value))
      if (name.startsWith('data-')) {
        const camel = name.slice(5).replace(/-([a-z])/gu, (_, c) => c.toUpperCase())
        this.dataset[camel] = String(value)
      }
    },
    removeAttribute(name) {
      attributes.delete(name)
      if (name.startsWith('data-')) {
        const camel = name.slice(5).replace(/-([a-z])/gu, (_, c) => c.toUpperCase())
        delete this.dataset[camel]
      }
    },
    hasAttribute(name) {
      return attributes.has(name)
    },
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null
    },
    addEventListener(type, listener) {
      if (!eventListeners.has(type)) eventListeners.set(type, [])
      eventListeners.get(type).push(listener)
    },
    removeEventListener(type, listener) {
      if (!eventListeners.has(type)) return
      eventListeners.set(type, eventListeners.get(type).filter((l) => l !== listener))
    },
    dispatchEvent(event) {
      const list = eventListeners.get(event?.type) || []
      for (const l of list) l(event)
      return true
    },
    click() {
      if (typeof this.onClick === 'function') {
        this.onClick({ isTrusted: false, target: this, type: 'click' })
      }
      this.dispatchEvent({ isTrusted: false, target: this, type: 'click' })
    },
    // A zero box unless one was assigned. Zone anchors get real ones, because whether the
    // shell's frame counts as fully covered by its columns — and so whether the whole-window
    // picture is painted on the frame at all — is decided by that geometry alone.
    getBoundingClientRect() { return this.rect ?? { width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0 } },
    querySelector(selector) {
      for (const child of this.children) {
        if (matchesSelector(child, selector)) return child
        const found = child.querySelector?.(selector)
        if (found) return found
      }
      return null
    },
    querySelectorAll(selector) {
      const list = []
      function walk(node) {
        for (const child of node.children || []) {
          if (matchesSelector(child, selector)) list.push(child)
          walk(child)
        }
      }
      walk(this)
      return list
    },
    get firstElementChild() { return this.children[0] ?? null },
    get lastElementChild() { return this.children[this.children.length - 1] ?? null },
    get lastChild() { return this.children[this.children.length - 1] ?? null },
    get parentElement() { return this.parent ?? null },
    get previousElementSibling() {
      if (!this.parent) return null
      const idx = this.parent.children.indexOf(this)
      return idx > 0 ? this.parent.children[idx - 1] : null
    },
    get nextElementSibling() {
      if (!this.parent) return null
      const idx = this.parent.children.indexOf(this)
      return idx >= 0 && idx < this.parent.children.length - 1 ? this.parent.children[idx + 1] : null
    },
    get classList() {
      const self = this
      return {
        contains(c) {
          const cls = self.getAttribute('class') || ''
          return cls.split(/\s+/u).includes(c)
        },
      }
    },
    closest(selector) {
      let cur = this
      while (cur) {
        if (matchesSelector(cur, selector)) return cur
        cur = cur.parent
      }
      return null
    },
    contains(other) {
      let cur = other
      while (cur) {
        if (cur === this) return true
        cur = cur.parent
      }
      return false
    },
  }
  // A `<style>` element's sheet, as much of one as the plugin touches: the streaming ink
  // inserts one rule and then mutates that rule's colour in place. A real sheet is reached
  // through this same CSSOM, so the tests drive the path the browser takes.
  if (el.tagName === 'STYLE') {
    const rules = []
    el.sheet = {
      get cssRules() { return rules },
      insertRule(text, index) {
        const rule = { cssText: String(text), style: { color: '' } }
        rules.splice(index === undefined ? rules.length : index, 0, rule)
        return rule
      },
      deleteRule(index) { rules.splice(index, 1) },
    }
  }
  // Web Animations, reduced to what the ink starts and cancels: one ramp per pass, on the
  // element that owns the text node, so a test can count passes and read the keyframes back.
  el.animations = []
  el.animate = (keyframes, options) => {
    const animation = { keyframes, options, cancelled: false, cancel() { this.cancelled = true } }
    el.animations.push(animation)
    return animation
  }
  return el
}

/**
 * A text node: the shape the streaming ink reads, and nothing more.
 *
 * The browser half must never create one of these — `test/client.test.mjs` asserts the
 * source cannot even name `createTextNode` — but the shell's own text nodes are what the
 * ink measures, so the tests need to be able to stand one up.
 * @param value - Initial text.
 * @returns The node double.
 */
export function createTextNode(value) {
  return {
    nodeType: 3,
    nodeValue: String(value),
    parent: null,
    get parentElement() { return this.parent ?? null },
  }
}

export const storage = createStorage()

const docListeners = new Map()

/**
 * The shell's zone anchors, one stable element per selector.
 *
 * Stable on purpose: a real anchor is one element, and a test that holds the element a pass
 * painted has to be holding the one the next pass will find. The map is emptied by `boot`, so
 * one test's anchors are never another's.
 */
const zoneAnchors = new Map()

/**
 * The element a zone's picture really belongs on, where the double has one.
 *
 * The shell does not paint a zone's surface from the zone's own element: it mounts a
 * component root that covers it. Only the conversation column is modelled that way here,
 * because it is the one the shell mounts a commit after the column itself — which is the
 * gap a pass can land in.
 */
const zoneSurfaces = new Map()

/** The element the paint pass resolves a zone to: its surface, or its anchor without one. */
export function zoneSurface(selector) {
  return zoneSurfaces.get(selector) ?? zoneAnchors.get(selector) ?? null
}

export const documentStub = {
  head: createElement('head'),
  body: createElement('body'),
  documentElement: createElement('html'),
  createElement,
  createTextNode,
  // Ranges are objects, not nodes: this double exists so the ink's offsets can be read back.
  createRange: () => ({
    startNode: null,
    startOffset: 0,
    endNode: null,
    endOffset: 0,
    setStart(node, offset) { this.startNode = node; this.startOffset = offset },
    setEnd(node, offset) { this.endNode = node; this.endOffset = offset },
  }),
  // A zone anchor that always exists keeps the boot pass from arming its retry timer.
  querySelector: (selector) => {
    // The shell has no `<header>`: its window bar is a slot host with `display: contents`,
    // so the windowbar zone matches nothing there. A double that invented one would let the
    // zones cover the frame and hide the path the whole-window picture really takes.
    if (selector === 'header') return null
    if (selector.includes('_frame') || selector.includes('_sidebarCol') || selector.includes('header') || selector.includes('_centerCol')) {
      if (!zoneAnchors.has(selector)) {
        const node = createElement('div')
        // The frame holds the columns, and the columns start below the window bar: the strip
        // they leave uncovered is what keeps the frame from counting as fully covered.
        const box = selector.includes('_frame') ? { left: 0, top: 0, right: 1600, bottom: 900 }
          : selector.includes('_sidebarCol') ? { left: 0, top: 32, right: 300, bottom: 900 }
            : { left: 300, top: 32, right: 1600, bottom: 900 }
        node.rect = { ...box, width: box.right - box.left, height: box.bottom - box.top }
        // The shell's own frame really does hold its columns, and the whole-window entry is
        // painted on the frame and spread over them. A double that made them siblings would
        // hide that nesting from the paint pass, which is exactly what this suite is for.
        if (selector.includes('_sidebarCol') || selector.includes('_centerCol')) {
          if (!zoneAnchors.has('[class*="_frame"]')) {
            const frame = createElement('div')
            frame.rect = { left: 0, top: 0, right: 1600, bottom: 900, width: 1600, height: 900 }
            documentStub.body.append(frame)
            zoneAnchors.set('[class*="_frame"]', frame)
          }
          zoneAnchors.get('[class*="_frame"]').append(node)
        } else {
          documentStub.body.append(node)
        }
        zoneAnchors.set(selector, node)
        // The conversation's own panel root. The shell renders the column first and mounts
        // this a commit later, so the double keeps them as two elements: a zone painted onto
        // the column in that gap sits behind this panel, which is the background a session
        // switch used to lose. Everything else about the box is the column's.
        if (selector.includes('_centerCol')) {
          const surface = createElement('div')
          surface.rect = { ...node.rect }
          surface.computedBackground = 'rgb(24, 24, 24)'
          node.append(surface)
          zoneSurfaces.set(selector, surface)
        }
      }
      return zoneAnchors.get(selector)
    }
    // The composer seat is inside the conversation's panel root, so it is hung off that
    // surface: a double that put it on the body would hide the nesting from anything that
    // looks for it, which is what the paint pass does.
    if (selector.includes('composer-seat') && !zoneAnchors.has(selector)) {
      const seat = createElement('div')
      seat.setAttribute('data-composer-seat', '')
      seat.rect = { left: 400, top: 800, right: 1500, bottom: 890, width: 1100, height: 90 }
      const column = zoneSurfaces.get('[class*="_centerCol"]') ?? zoneAnchors.get('[class*="_centerCol"]')
      if (column === undefined) documentStub.body.append(seat)
      else column.append(seat)
      zoneAnchors.set(selector, seat)
      return seat
    }
    if (matchesSelector(documentStub.body, selector)) return documentStub.body
    return documentStub.body.querySelector(selector)
  },
  querySelectorAll: (selector) => documentStub.body.querySelectorAll(selector),
  addEventListener: (type, listener) => {
    if (!docListeners.has(type)) docListeners.set(type, [])
    docListeners.get(type).push(listener)
  },
  removeEventListener: (type, listener) => {
    if (!docListeners.has(type)) return
    docListeners.set(type, docListeners.get(type).filter((l) => l !== listener))
  },
  dispatchDocEvent: (event) => {
    const list = docListeners.get(event?.type) || []
    for (const l of list) l(event)
  },
}

export class MockMutationObserver {
  constructor(callback) {
    this.callback = callback
    MockMutationObserver.instances.push(this)
  }
  observe(target, options) {
    this.target = target
    this.options = options
  }
  disconnect() {
    MockMutationObserver.instances = MockMutationObserver.instances.filter((i) => i !== this)
  }
  trigger(mutations = []) {
    this.callback(mutations, this)
  }
}
MockMutationObserver.instances = []

globalThis.document = documentStub
globalThis.localStorage = storage
globalThis.MutationObserver = MockMutationObserver
globalThis.getComputedStyle = (element) => ({
  color: 'rgb(0, 0, 0)',
  // Only the boxes the double marks opaque answer with a colour, which is what lets the pass
  // resolve a zone to the element the shell paints its surface from.
  backgroundColor: element?.computedBackground ?? 'rgba(0, 0, 0, 0)',
  position: 'static',
})

/** The Custom Highlight API, reduced to what the streaming ink registers and withdraws. */
export const highlights = new Map()
/** The custom properties the plugin registered: the ramp cannot animate an unregistered one. */
export const registeredProperties = new Set()
globalThis.CSS = {
  highlights: {
    set: (name, value) => { highlights.set(name, value) },
    delete: (name) => highlights.delete(name),
    has: (name) => highlights.has(name),
    clear: () => { highlights.clear() },
  },
  // The real API throws on a second registration of the same name, which is what the plugin's
  // guard is for; mirroring that keeps the guard honest.
  registerProperty: ({ name }) => {
    if (registeredProperties.has(name)) throw new TypeError(`the custom property '${name}' is already registered`)
    registeredProperties.add(name)
  },
}
globalThis.Highlight = class Highlight {
  constructor(...ranges) { this.ranges = ranges }
}
/**
 * Queued animation frames.
 *
 * The ink coalesces a burst of chunks into one pass per frame, so the harness hands out a
 * frame instead of running the callback the moment it is asked for — that is what lets a test
 * prove the coalescing rather than assume it.
 */
const frames = []

globalThis.window = {
  localStorage: storage,
  setTimeout,
  clearTimeout,
  requestAnimationFrame: (callback) => {
    frames.push(callback)
    return frames.length
  },
  __ModuleLoader__: null,
  MutationObserver: MockMutationObserver,
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
  // The slider portals into a container the DOM bridge owns. This suite never renders the
  // component (that is `test/effort.test.mjs`, which drives a stateful React double), so the
  // face only has to exist.
  if (id === 'react-dom') return { createPortal: (children) => children }
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

/** The store key the per-zone background choices live under; kept in step with the client. */
export const BACKGROUNDS_KEY = 'dsh-custom-theme.backgrounds'

/**
 * Materialize the browser half the way the page does and run its `apply`.
 * @param options - `working` seeds the stored choices, `raw` seeds them verbatim,
 *   `appearance` seeds appearance choices, `rawAppearance` seeds them verbatim,
 *   `backgrounds` seeds the per-zone pictures, `locale` overrides the service.
 * @returns Handles for asserting on the booted plugin.
 */
export function boot({ working, raw, locale, appearance, rawAppearance, themeId, themeCssMock, backgrounds, modelDirectories } = {}) {
  storage.entries.clear()
  if (raw !== undefined) storage.entries.set(WORKING_KEY, raw)
  else if (working !== undefined) storage.entries.set(WORKING_KEY, JSON.stringify(working))
  if (rawAppearance !== undefined) storage.entries.set(APPEARANCE_KEY, rawAppearance)
  else if (appearance !== undefined) storage.entries.set(APPEARANCE_KEY, JSON.stringify(appearance))
  if (backgrounds !== undefined) storage.entries.set(BACKGROUNDS_KEY, JSON.stringify(backgrounds))
  if (themeId !== undefined) {
    storage.entries.set(THEME_SELECTED_KEY, themeId)
    if (themeCssMock !== undefined) {
      customThemeCssMocks.set(themeId, themeCssMock)
    }
  }
  // A boot is a fresh page for these assertions: the previous one's stylesheets are not
  // part of the document the plugin is booting into.
  documentStub.head.children.length = 0
  documentStub.body.children.length = 0
  // The document's own listeners belong to that page as well. The registry is module-level, so
  // without this a previous boot's handler would still answer this page's events — and a
  // handler a test forgot to dispose would look like the plugin under test.
  docListeners.clear()
  // The shell's anchors belong to the page, not to the boot: a fresh page gets fresh ones.
  zoneAnchors.clear()
  zoneSurfaces.clear()
  frames.length = 0
  for (const obs of MockMutationObserver.instances) {
    obs.disconnect()
  }
  MockMutationObserver.instances.length = 0
  const service = locale ?? createLocale()
  const originalTranslate = service.translate
  const injected = []
  /**
   * The nested injections the plugin asked for, as `[services, ran]`.
   *
   * The reasoning-effort slider reaches `modelDirectories` through a nested `ctx.inject`, so
   * that a shell without it still boots everything else. A boot can withhold the service and
   * assert that the control — and only the control — goes quiet.
   */
  const nestedInjections = []
  /**
   * The entries `slots.register` was handed, as `{ options, component }`.
   *
   * A test renders one of these to see the context the control was given: the slider reads
   * `modelDirectories` off the context, and the service is only readable from the scope that
   * injected it, so "which context" is a thing worth pinning.
   */
  const registrations = []
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
    inject: (services, callback) => {
      const entry = { services, ran: false }
      nestedInjections.push(entry)
      if (typeof callback === 'function' && modelDirectories !== undefined) {
        entry.ran = true
        callback({ slots: ctx.slots, modelDirectories })
      }
      return () => {}
    },
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
      // The shell runs the callback and keeps its return value as the unsubscriber; the
      // callback is where a plugin registers its entry.
      inject: (name, callback) => {
        injected.push(name)
        const dispose = typeof callback === 'function' ? callback() : undefined
        return typeof dispose === 'function' ? dispose : () => {}
      },
      register: (options, component) => {
        registrations.push({ options, component })
        return () => {}
      },
    },
    locale: service,
  }
  definition.factory(fakeRequire).apply(ctx)
  return {
    locale: service,
    originalTranslate,
    injected,
    nestedInjections,
    registrations,
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
    /** The stylesheet carrying the appearance overrides. */
    appearanceStyle: () => documentStub.head.children.find((node) => node.dataset.role === 'appearance') ?? null,
    /** That stylesheet's text. */
    appearanceCss: () => documentStub.head.children.find((node) => node.dataset.role === 'appearance')?.textContent ?? '',
    /** The label as the shell would read it, through the namespace it binds. */
    t: (key, params) => service.bind('chat')(key, params),
    /** Direct handle to the document stub. */
    document: documentStub,
    /** Read parsed appearance options from storage. */
    savedAppearance: () => JSON.parse(storage.getItem(APPEARANCE_KEY) ?? '{}'),
    /**
     * Trigger a mutation observer cycle.
     * @param records - Mutation records to hand the observers, as the browser would.
     */
    triggerMutation: (records = []) => {
      for (const obs of MockMutationObserver.instances) {
        obs.trigger(records)
      }
    },
    /** Run the callbacks queued on `requestAnimationFrame`, as one frame would. */
    runFrame: () => {
      const batch = frames.splice(0, frames.length)
      for (const callback of batch) callback()
    },
    /** Dispose everything `apply` registered, the way unloading the plugin does. */
    dispose: () => { for (const dispose of disposers) dispose() },
  }
}
