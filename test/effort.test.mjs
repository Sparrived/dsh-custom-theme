/**
 * The reasoning-effort slider.
 *
 * `lib/client.js` dresses the shell's model menu with the slider
 * `dsh-codex-effort-slider` (MIT) draws: a continuous track, a fill that runs blue → violet →
 * deep violet, and — from the second level rightwards — a purple nebula with a starfield that
 * thickens and quickens as the knob travels.
 *
 * Two things are asserted here that no other suite can reach:
 *
 *  1. **The numbers.** The effect is an invariant of position — which colour a position has,
 *     how many stars it lights, how long one takes to cross, how the 22 phases are spread —
 *     and every one of those is a pure function of an index. They are read off `__internals`,
 *     the seam `test/client.test.mjs` does not use.
 *  2. **The control, rendered.** The suite runs a small stateful React double (hooks, effects,
 *     portals) against a fake official menu whose shape is copied from the installed build's
 *     `ModelSelect`: a seat with `aria-haspopup`/`aria-expanded`/`aria-controls`, a menu whose
 *     only two `menuitem` rows are the model and the effort, and a `cellValue` span carrying
 *     the level's name. What a real window would add — pixels, the compositor — is the one
 *     thing left to `test/browser/`.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { createStorage, definition } from './harness.mjs'

/* ═══════════════════════════ The doubles ═══════════════════════════ */

/**
 * One attribute test, in both quote styles: `[a="b"]`, `[a*='b']`, `[a]`.
 * @param node - The node to test.
 * @param selector - One simple selector, tag and attributes only.
 * @returns Whether the node matches.
 */
function matches(node, selector) {
  for (const part of selector.split(',')) {
    const trimmed = part.trim()
    if (trimmed === '') continue
    if (matchOne(node, trimmed)) return true
  }
  return false
}

function matchOne(node, selector) {
  const tag = /^[A-Za-z0-9-]+/u.exec(selector)
  const tagText = tag === null ? '' : tag[0]
  if (tagText !== '' && node.tagName !== tagText.toUpperCase()) return false
  for (const [, name, operator, doubleQuoted, singleQuoted, bare] of selector.matchAll(
    /\[([A-Za-z0-9_-]+)(?:([*^$~|]?=)(?:"([^"]*)"|'([^']*)'|([^\]]+)))?\]/gu,
  )) {
    const value = node.getAttribute(name)
    if (value === null) return false
    const wanted = doubleQuoted ?? singleQuoted ?? bare ?? ''
    if (operator === '=' && value !== wanted) return false
    if (operator === '*=' && !value.includes(wanted)) return false
    if (operator === '^=' && !value.startsWith(wanted)) return false
    if (operator === '$=' && !value.endsWith(wanted)) return false
    if (operator === '~=' && !value.split(/\s+/u).includes(wanted)) return false
  }
  return true
}

/** One element: an element's shape, with the parent pointer and a box the pointer can hit. */
class FakeNode {
  constructor(tagName) {
    this.tagName = String(tagName).toUpperCase()
    this.attributes = new Map()
    this.children = []
    this.parentNode = null
    this.style = {}
    this.className = ''
    // The notice hushes the shell's own value text with a class, so the double has to keep them.
    const classes = new Set()
    this.classList = {
      toggle: (name, on) => {
        const wanted = on === undefined ? !classes.has(name) : on === true
        if (wanted) classes.add(name)
        else classes.delete(name)
        return wanted
      },
      contains: (name) => classes.has(name),
    }
    this.handlers = {}
    this.listeners = new Map()
    this.rectReads = 0
    this._text = undefined
    // A track is 200px wide in this double, which makes a position easy to compute by hand.
    this.rect = { left: 0, top: 0, right: 200, bottom: 28, width: 200, height: 28 }
  }

  /** The bridge walks up with `parentNode`, and tests text nodes for `nodeType === 3`. */
  get nodeType() {
    return this.tagName === '#TEXT' ? 3 : 1
  }

  get textContent() {
    if (this._text !== undefined) return this._text
    return this.children.map((child) => child.textContent).join('')
  }

  set textContent(value) {
    this._text = String(value)
    this.children = []
  }

  appendChild(child) {
    if (child.parentNode) child.parentNode.removeChild(child)
    child.parentNode = this
    this.children.push(child)
    return child
  }

  removeChild(child) {
    const index = this.children.indexOf(child)
    if (index >= 0) this.children.splice(index, 1)
    child.parentNode = null
    return child
  }

  remove() {
    if (this.parentNode) this.parentNode.removeChild(this)
  }

  setAttribute(name, value) {
    this.attributes.set(String(name), String(value))
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null
  }

  hasAttribute(name) {
    return this.attributes.has(name)
  }

  removeAttribute(name) {
    this.attributes.delete(name)
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type).add(listener)
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener)
  }

  /** Fire a React-style handler (`onPointerDown`, `onKeyDown`, …). */
  fire(prop, event) {
    const handler = this.handlers[prop]
    if (typeof handler !== 'function') return undefined
    return handler({
      currentTarget: this,
      target: this,
      pointerId: 1,
      preventDefault() {},
      stopPropagation() {},
      ...event,
    })
  }

  dispatch(type, event) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      listener({ type, target: this, preventDefault() {}, ...event })
    }
  }

  contains(node) {
    let current = node
    while (current) {
      if (current === this) return true
      current = current.parentNode
    }
    return false
  }

  getBoundingClientRect() {
    // Counting the reads is the only way to see a forced layout from here: in a real document
    // this is what makes the browser stop and lay out again, so a drag must not do it per move.
    this.rectReads += 1
    return this.rect
  }

  setPointerCapture(pointerId) {
    this.capturedPointer = pointerId
  }

  releasePointerCapture() {
    this.capturedPointer = null
  }

  querySelectorAll(selector) {
    const found = []
    const walk = (node) => {
      for (const child of node.children) {
        if (matches(child, selector)) found.push(child)
        walk(child)
      }
    }
    walk(this)
    return found
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null
  }
}

/** A document double: the head and body, and `getElementById` over the whole tree. */
function createDocument() {
  const documentElement = new FakeNode('html')
  const head = new FakeNode('head')
  const body = new FakeNode('body')
  documentElement.appendChild(head)
  documentElement.appendChild(body)
  return {
    documentElement,
    head,
    body,
    createElement: (tag) => new FakeNode(tag),
    querySelector: (selector) => documentElement.querySelector(selector),
    querySelectorAll: (selector) => documentElement.querySelectorAll(selector),
    getElementById: (id) => documentElement.querySelectorAll(`[id="${id}"]`)[0] ?? null,
    addEventListener: (type, listener) => documentElement.addEventListener(type, listener),
    removeEventListener: (type, listener) => documentElement.removeEventListener(type, listener),
    dispatch: (type, event) => documentElement.dispatch(type, event),
  }
}

/**
 * The official model menu, in the shape the installed shell renders.
 *
 * Every menu gets its own `aria-controls` id, the way the shell's own do: `getElementById` is
 * document-wide, so two menus sharing one id would have this bridge dressing the wrong one.
 *
 * @param doc - The document double.
 * @param options - `effort` (the level caption), `open`, `controls` (the seat's
 *   `aria-controls`), `rows` (how many `menuitem` rows the menu carries).
 * @returns Handles onto every node the assertions read.
 */
function createOfficialMenu(doc, options = {}) {
  const id = `model-menu-${(createOfficialMenu.menus += 1)}`
  const composer = new FakeNode('div')
  composer.setAttribute('data-composer-card', '')
  doc.body.appendChild(composer)

  const seat = new FakeNode('button')
  seat.setAttribute('aria-haspopup', 'menu')
  seat.setAttribute('aria-expanded', options.open === false ? 'false' : 'true')
  if (options.controls !== null) seat.setAttribute('aria-controls', options.controls ?? id)
  const seatModel = new FakeNode('span')
  seatModel.className = 'wq12jW_triggerLabel'
  seatModel.textContent = 'DeepSeek-V41-Flash'
  const seatEffort = new FakeNode('span')
  seatEffort.className = 'wq12jW_triggerEffort'
  seatEffort.textContent = options.effort ?? 'High'
  seat.appendChild(seatModel)
  seat.appendChild(seatEffort)
  composer.appendChild(seat)

  const menu = new FakeNode('div')
  menu.setAttribute('role', 'menu')
  menu.setAttribute('id', id)
  // The shell portals its menu to the body, so the row is *not* inside the composer.
  doc.body.appendChild(menu)

  const makeRow = (label, value) => {
    const row = new FakeNode('button')
    row.setAttribute('role', 'menuitem')
    row.className = 'wq12jW_cell'
    const labelSpan = new FakeNode('span')
    labelSpan.className = 'wq12jW_cellLabel'
    labelSpan.textContent = label
    const valueSpan = new FakeNode('span')
    valueSpan.className = 'wq12jW_cellValue'
    valueSpan.textContent = value
    row.appendChild(labelSpan)
    row.appendChild(valueSpan)
    row.appendChild(new FakeNode('svg'))
    menu.appendChild(row)
    return { row, valueSpan }
  }

  const rows = options.rows ?? 2
  const model = rows >= 1 ? makeRow('模型', 'DeepSeek-V41-Flash') : null
  const effort = rows >= 2 ? makeRow('推理等级', options.effort ?? 'High') : null
  if (rows > 2) makeRow('旁路', 'x')

  return {
    composer,
    seat,
    seatEffort,
    menu,
    modelRow: model?.row ?? null,
    effortRow: effort?.row ?? null,
    effortValue: effort?.valueSpan ?? null,
    close() {
      seat.setAttribute('aria-expanded', 'false')
      menu.remove()
    },
  }
}
createOfficialMenu.menus = 0

/* ── React, small enough to reason about ─────────────────────────────────────── */

const FRAGMENT = Symbol.for('react.fragment')
const ELEMENT = Symbol.for('react.element')

function sameDeps(a, b) {
  if (a === undefined || b === undefined) return false
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
  return a.every((value, index) => Object.is(value, b[index]))
}

/**
 * A function-component renderer with real hooks and no diffing.
 *
 * The slider is the only component in the tree that uses hooks, so one shared hook list is
 * enough; the wrapper this suite mounts is hook-free. Portals render into their own container,
 * which is how the control reaches the shell's row.
 */
function createReactStub() {
  const hooks = []
  const portalHosts = []
  let cursor = 0
  let currentRoot = null
  let pendingEffects = []
  let scheduled = false
  let rendering = false
  let snapshots = 0

  function slotAt(index, kind) {
    if (hooks.length <= index) hooks.push({ kind })
    const slot = hooks[index]
    if (slot.kind !== kind) throw new Error(`hook order changed at slot ${index}: ${slot.kind} → ${kind}`)
    return slot
  }

  function scheduleRender() {
    if (scheduled || rendering) return
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      if (currentRoot !== null) render()
    })
  }

  const react = {
    Fragment: FRAGMENT,
    createPortal(children, container) {
      return { __portal: true, props: { children }, container }
    },
    createElement(type, props, ...children) {
      const normalized = { ...(props ?? {}) }
      const flat = []
      const push = (child) => {
        if (Array.isArray(child)) return child.forEach(push)
        if (child === null || child === undefined || typeof child === 'boolean') return
        flat.push(child)
      }
      push(children)
      normalized.children = flat.length <= 1 ? flat[0] : flat
      return { $$typeof: ELEMENT, type, props: normalized }
    },
    useState(initial) {
      const slot = slotAt(cursor++, 'state')
      if (!slot.ready) {
        slot.value = typeof initial === 'function' ? initial() : initial
        slot.ready = true
      }
      return [slot.value, (next) => {
        const value = typeof next === 'function' ? next(slot.value) : next
        if (Object.is(value, slot.value)) return
        slot.value = value
        scheduleRender()
      }]
    },
    useRef(initial) {
      const slot = slotAt(cursor++, 'ref')
      if (!slot.ready) {
        slot.value = { current: initial }
        slot.ready = true
      }
      return slot.value
    },
    useMemo(factory, deps) {
      const slot = slotAt(cursor++, 'memo')
      if (!slot.ready || !sameDeps(slot.deps, deps)) {
        slot.value = factory()
        slot.deps = deps
        slot.ready = true
      }
      return slot.value
    },
    useCallback(factory, deps) {
      return react.useMemo(() => factory, deps)
    },
    useEffect(effect, deps) {
      const slot = slotAt(cursor++, 'effect')
      if (!slot.ready || !sameDeps(slot.deps, deps)) {
        slot.deps = deps
        slot.ready = true
        pendingEffects.push({ slot, effect })
      }
      return undefined
    },
    // The double has no commit phase to tell the two apart: a layout effect runs where an effect does.
    useLayoutEffect(effect, deps) {
      return react.useEffect(effect, deps)
    },
    useSyncExternalStore(subscribe, getSnapshot) {
      const slot = slotAt(cursor++, 'store')
      if (!slot.ready || slot.subscribe !== subscribe) {
        slot.unsubscribe?.()
        slot.subscribe = subscribe
        slot.unsubscribe = subscribe(scheduleRender)
        slot.ready = true
      }
      const value = getSnapshot()
      slot.value = value
      slot.getSnapshot = getSnapshot
      return value
    },
  }

  function renderElement(element, parent) {
    if (element === null || element === undefined || typeof element === 'boolean') return null
    if (typeof element === 'string' || typeof element === 'number') {
      const text = new FakeNode('#text')
      text.textContent = String(element)
      parent?.appendChild(text)
      return text
    }
    if (element.__portal === true) {
      if (element.container && !portalHosts.includes(element.container)) portalHosts.push(element.container)
      renderChildren(element.props.children, element.container)
      return null
    }
    const { type, props } = element
    if (type === FRAGMENT) return renderChildren(props.children, parent)
    if (typeof type === 'function') return renderElement(type(props), parent)

    const node = new FakeNode(type)
    for (const key of Object.keys(props)) {
      if (key === 'children') continue
      const value = props[key]
      if (key === 'style') {
        node.style = { ...value }
        continue
      }
      if (key === 'ref') {
        if (typeof value === 'function') value(node)
        else if (value && typeof value === 'object') value.current = node
        continue
      }
      if (key.startsWith('on') && typeof value === 'function') {
        node.handlers[key] = value
        continue
      }
      if (key === 'className') {
        node.className = value
        node.setAttribute('class', value)
        continue
      }
      if (value === undefined || value === null || value === false) continue
      if (value === true) {
        node.setAttribute(key, '')
        continue
      }
      node.setAttribute(key, value)
    }
    parent?.appendChild(node)
    renderChildren(props.children, node)
    return node
  }

  function renderChildren(children, parent) {
    if (children === null || children === undefined || typeof children === 'boolean') return
    if (Array.isArray(children)) return children.forEach((child) => renderElement(child, parent))
    renderElement(children, parent)
  }

  function render() {
    rendering = true
    cursor = 0
    pendingEffects = []
    // No diffing: the old root is detached and every portal container emptied first, so a
    // re-render cannot leave two copies of the track behind for an assertion to find.
    currentRoot?.node?.remove()
    for (const container of portalHosts) container.children.length = 0
    portalHosts.length = 0
    const parent = currentRoot.parent
    const host = parent ?? new FakeNode('div')
    renderElement(react.createElement(currentRoot.type, currentRoot.props), host)
    currentRoot.node = parent !== null ? host.children[host.children.length - 1] ?? null : host.children[0] ?? null
    rendering = false

    for (const { slot, effect } of pendingEffects) {
      try {
        slot.cleanup?.()
      } catch {
        // A failing cleanup must not stop the others.
      }
      const cleanup = effect()
      slot.cleanup = typeof cleanup === 'function' ? cleanup : undefined
    }
    pendingEffects = []

    // `useSyncExternalStore` re-reads after rendering; a snapshot that is a new object every
    // time would spin forever, so the double calls that out instead of looping.
    for (const slot of hooks) {
      if (slot.kind !== 'store' || typeof slot.getSnapshot !== 'function') continue
      if (Object.is(slot.getSnapshot(), slot.value)) continue
      snapshots += 1
      if (snapshots > 40) throw new Error('the store snapshot is unstable: getSnapshot() returns a new object every time')
      scheduleRender()
      return
    }
    snapshots = 0
  }

  const stub = {
    ...react,
    mount(Component, props, parent) {
      hooks.length = 0
      cursor = 0
      portalHosts.length = 0
      currentRoot = { type: Component, props: props ?? {}, parent: parent ?? null }
      render()
      return stub
    },
    find(part) {
      for (const root of [stub.tree, ...portalHosts].filter(Boolean)) {
        if (root.getAttribute?.('data-ces-part') === part) return root
        const found = root.querySelector(`[data-ces-part="${part}"]`)
        if (found) return found
      }
      return null
    },
    findAll(part) {
      const out = []
      for (const root of [stub.tree, ...portalHosts].filter(Boolean)) {
        if (root.getAttribute?.('data-ces-part') === part) out.push(root)
        out.push(...root.querySelectorAll(`[data-ces-part="${part}"]`))
      }
      return out
    },
    get tree() {
      return currentRoot ? currentRoot.node : null
    },
    get portalHosts() {
      return [...portalHosts]
    },
    unmount() {
      for (const slot of hooks) {
        try {
          slot.cleanup?.()
        } catch {
          // Ignored: the suite is asserting on the DOM, not on cleanup errors.
        }
        slot.cleanup = undefined
        slot.unsubscribe?.()
        slot.unsubscribe = undefined
      }
      currentRoot = null
    },
  }
  return stub
}

/** A store the component subscribes to, with the same four faces the shell's has. */
function createStore(initial) {
  let snapshot = initial
  const listeners = new Set()
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    set(next) {
      snapshot = next
      for (const listener of [...listeners]) listener()
    },
    listenerCount: () => listeners.size,
  }
}

const LEVELS = [
  { id: 'off', name: 'Off' },
  { id: 'low', name: 'Low' },
  { id: 'high', name: 'High' },
  { id: 'max', name: 'Max' },
]

/** A directory snapshot for one level, in the shape the shell's store serves. */
function snapshotFor(effortId) {
  return {
    current: { provider: 'deepseek', model: 'v41', reasoningEffort: effortId },
    groups: [{ id: 'deepseek', models: [{ id: 'v41', reasoning: { efforts: LEVELS, defaultEffort: 'high' } }] }],
    failures: [],
    status: 'ok',
    pending: null,
    error: null,
  }
}

/** The shell's model directory, as much of it as the control touches. */
function createDirectory(effortId = 'high', { fail = false } = {}) {
  const store = createStore(snapshotFor(effortId))
  return {
    store,
    loads: 0,
    selects: [],
    load() {
      this.loads += 1
      return Promise.resolve()
    },
    select(selection) {
      this.selects.push(selection)
      if (fail) return Promise.resolve({ ok: false, error: { message: 'the host refused' } })
      // A real host reports back through the store; without this the control would sit on its
      // optimistic value until the deadline.
      Promise.resolve().then(() => store.set(snapshotFor(selection.reasoningEffort)))
      return Promise.resolve({ ok: true })
    },
  }
}

/* ── Globals, then the module ────────────────────────────────────────────────── */

const storage = createStorage()
const doc = createDocument()

class FakeMutationObserver {
  constructor(callback) {
    this.callback = callback
    FakeMutationObserver.instances.push(this)
  }

  observe() {}

  disconnect() {
    FakeMutationObserver.instances = FakeMutationObserver.instances.filter((instance) => instance !== this)
  }

  trigger() {
    this.callback([], this)
  }
}
FakeMutationObserver.instances = []

class FakeEvent {
  constructor(type) {
    this.type = type
  }
}

const resizes = []
const win = {
  localStorage: storage,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  requestAnimationFrame: (callback) => { callback(); return 0 },
  MutationObserver: FakeMutationObserver,
  Event: FakeEvent,
  matchMedia: () => ({ matches: false }),
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: (event) => { resizes.push(event.type); return true },
  __ModuleLoader__: null,
}
globalThis.window = win
globalThis.document = doc
globalThis.localStorage = storage
globalThis.MutationObserver = FakeMutationObserver

/** The one React double the module is materialized against; `mount` resets it per test. */
const stubReact = createReactStub()

/**
 * `react-dom`, as much of it as the control touches. `flushSync` runs what it is given and counts
 * the call, which is how a test tells a render the control committed on the spot from one it left
 * to the update already under way.
 */
const stubReactDom = {
  flushSyncCalls: 0,
  createPortal: (children, container) => ({ __portal: true, props: { children }, container }),
  flushSync(work) {
    stubReactDom.flushSyncCalls += 1
    return work()
  },
}

const internals = definition.factory((id) => {
  if (id === 'react') return stubReact
  if (id === 'react-dom') return stubReactDom
  throw new Error(`unexpected require: ${id}`)
}).__internals

/** A `t` that resolves the plugin's own keys the way its locale service would. */
const STRINGS = {
  effortLabel: '推理等级',
  effortTitle: '推理等级：{name}',
  effortReducedMotion: '（系统「减少动态效果」已开启：粒子已放缓）',
  effortQuotaNotice: '将使用更多额度',
  effortErrorGeneric: '档位切换失败',
  effortErrorTimeout: '档位切换超时',
  effortErrorNoCatalog: '模型目录尚未就绪',
  effortErrorNoDirectory: '模型目录不可用',
}
const t = (key, params) => {
  const template = STRINGS[key] ?? key
  return params === undefined ? template : template.replace(/\{(\w+)\}/gu, (_, name) => String(params[name] ?? ''))
}

/** Let the microtask queue drain: one render, one store notification, one select. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

/** Mount the control against one fake menu and one fake directory. */
function mountControl(options = {}) {
  win.matchMedia = () => ({ matches: options.reducedMotion === true })
  // The shell renders the row's caption from the store itself; the plugin never writes text.
  const effort = options.effort ?? 'high'
  const caption = options.caption ?? `${effort[0].toUpperCase()}${effort.slice(1)}`
  const menu = createOfficialMenu(doc, { ...options.menu, effort: caption })
  const directory = options.directory ?? createDirectory(effort)
  // The scope the registration hands the control: the nested injection's, which is the only
  // context that carries `modelDirectories` — the plugin's own context never declares it.
  const scope = { slots: {}, modelDirectories: { directoryFor: () => directory } }
  const Entry = internals.effortSliderEntry(scope)
  stubReact.mount(Entry, { sessionId: 'session-1', t, theme: options.theme }, menu.composer)
  return { menu, directory, stub: stubReact }
}

/* ═══════════════════════ The numbers the effect is made of ═══════════════════════ */

test('a position maps to one place for the fill, the knob and every tick', () => {
  const { knobOffsetOf, KNOB_RADIUS, TRACK_HEIGHT, KNOB_SIZE } = internals
  // Radius + pct × (100% − diameter): the centre stays inside the cap at both ends, so the
  // circle is never cut, and the three layers that share it cannot drift apart.
  assert.equal(knobOffsetOf(0), 'calc(14px + 0 * (100% - 28px))')
  assert.equal(knobOffsetOf(1), 'calc(14px + 1 * (100% - 28px))')
  assert.equal(knobOffsetOf(1 / 3), 'calc(14px + 0.3333 * (100% - 28px))')
  assert.equal(knobOffsetOf(2), knobOffsetOf(1), 'a position past the end must clamp, not run out of the track')
  assert.equal(knobOffsetOf(-1), knobOffsetOf(0))
  assert.equal(knobOffsetOf(Number.NaN), knobOffsetOf(0))
  // The knob is the track's own height, which is what makes it a ball in a tube.
  assert.equal(KNOB_SIZE, TRACK_HEIGHT)
  assert.equal(KNOB_RADIUS * 2, KNOB_SIZE)
})

test('the fill runs blue, then violet, then deep violet', () => {
  const { fillColorFor, fillBackgroundFor, COLOR_BLUE, COLOR_VIOLET, COLOR_DEEP, ENERGY_START, ENERGY_END } = internals
  const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`
  // The first level is blue and the second still is: violet is what "more than the default"
  // looks like, and it does not appear until the level that means it.
  assert.equal(fillColorFor(0), rgb(COLOR_BLUE))
  assert.equal(fillColorFor(ENERGY_START), rgb(COLOR_BLUE))
  assert.equal(fillColorFor(ENERGY_END), rgb(COLOR_VIOLET))
  assert.equal(fillColorFor(1), rgb(COLOR_DEEP))
  assert.equal(fillBackgroundFor(0), `linear-gradient(90deg, rgb(77,147,248), rgb(77,147,248))`)
  // Monotone in position, in the two channels the ramp actually moves: green and blue only
  // ever fall, red rises up to the violet end and falls after it. (The fill *deepens* past
  // violet — that is the point of the deep end — so total brightness is not the invariant.)
  let previousRed = -1
  let falling = false
  for (let step = 0; step <= 20; step += 1) {
    const [red, green, blue] = fillColorFor(step / 20).match(/\d+/gu).map(Number)
    if (step > 0) {
      const [pr, pg, pb] = fillColorFor((step - 1) / 20).match(/\d+/gu).map(Number)
      assert.ok(green <= pg, `the fill got greener between ${step - 1} and ${step}`)
      assert.ok(blue <= pb, `the fill got bluer between ${step - 1} and ${step}`)
      if (step / 20 > ENERGY_END) falling = true
      if (falling) assert.ok(red <= pr + 1, `the deep end brightened at step ${step}`)
      else assert.ok(red >= previousRed - 1, `the ramp dimmed before violet at step ${step}`)
    }
    previousRed = red
  }
})

test('a colour mix clamps the way clamp01 does, not merely the way it looks', () => {
  const { mixColor, COLOR_BLUE, COLOR_DEEP } = internals
  // `mixColor` cannot import `clamp01`: the maths module owns it and mixes colours, so the
  // import would be a cycle, and the clamp is therefore written out. These are the inputs
  // where a hand-written `t < 0 ? 0 : t > 1 ? 1 : t` would part company with it — a NaN or
  // an absent position has to land on the first colour rather than reach CSS as rgb(NaN,…).
  for (const broken of [Number.NaN, undefined, null, Number.NEGATIVE_INFINITY, -1, -0.0001]) {
    assert.deepEqual(mixColor(COLOR_BLUE, COLOR_DEEP, broken), mixColor(COLOR_BLUE, COLOR_DEEP, 0), `${String(broken)} must clamp to 0`)
  }
  for (const high of [Number.POSITIVE_INFINITY, 2, 1]) {
    assert.deepEqual(mixColor(COLOR_BLUE, COLOR_DEEP, high), mixColor(COLOR_BLUE, COLOR_DEEP, 1), `${String(high)} must clamp to 1`)
  }
  // And inside the range it is still a plain ramp: the midpoint sits between the ends.
  const middle = mixColor(COLOR_BLUE, COLOR_DEEP, 0.5)
  middle.forEach((channel, index) => {
    const low = Math.min(COLOR_BLUE[index], COLOR_DEEP[index])
    const high = Math.max(COLOR_BLUE[index], COLOR_DEEP[index])
    assert.ok(channel >= low && channel <= high, `channel ${index} left the ramp at ${channel}`)
  })
})

test('the value text goes blue to violet but never into the fill’s deep end', () => {
  const { valueColorFor, COLOR_TEXT_VIOLET, COLOR_DEEP } = internals
  const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`
  assert.equal(valueColorFor(0, LEVELS[1]), 'rgb(77,147,248)')
  assert.equal(valueColorFor(1, LEVELS[3]), rgb(COLOR_TEXT_VIOLET))
  // Deep violet is nearly invisible on a dark surface, so text stops at the mid violet.
  assert.notEqual(rgb(COLOR_TEXT_VIOLET), `rgb(${COLOR_DEEP[0]},${COLOR_DEEP[1]},${COLOR_DEEP[2]})`)
  // Off keeps the shell's own grey: an empty colour is what clears the inline style.
  assert.equal(valueColorFor(1, LEVELS[0]), '')
  assert.equal(valueColorFor(0, null), 'rgb(77,147,248)', 'a position with no level still colours')
})

test('Off is recognised in every spelling the shell might use', () => {
  const { isOffLevel } = internals
  for (const level of [{ id: 'off' }, { id: 'x', name: 'Off' }, { id: 'none' }, { name: '关闭' }, { name: ' 无 ' }]) {
    assert.ok(isOffLevel(level), `${JSON.stringify(level)} should read as off`)
  }
  for (const level of [null, undefined, { id: 'low', name: 'Low' }, { id: 'high' }, { id: 'offline', name: 'Offline' }]) {
    assert.ok(!isOffLevel(level), `${JSON.stringify(level)} should not read as off`)
  }
})

test('energy starts at the second level and only reaches full at the last', () => {
  const { energyFor, ENERGY_START, ENERGY_END, clamp01 } = internals
  assert.equal(energyFor(0), 0)
  assert.equal(energyFor(ENERGY_START), 0, 'the default level must not light the track')
  assert.ok(Math.abs(energyFor(ENERGY_END) - 0.5) < 1e-9, `the high level is not half lit: ${energyFor(ENERGY_END)}`)
  assert.equal(energyFor(1), 1)
  assert.equal(energyFor(0.5), clamp01((0.5 - ENERGY_START) / (1 - ENERGY_START)))
  // Monotone, and clamped outside the track.
  assert.ok(energyFor(0.9) > energyFor(0.7))
  assert.equal(energyFor(-1), 0)
  assert.equal(energyFor(4), 1)
})

test('the starfield thickens, quickens and brightens with the position', () => {
  const { starCountFor, particleCountFor, starLayerOpacityFor, speedFor, starBrightnessFor, EFFORT_STARS } = internals
  assert.equal(EFFORT_STARS.length, 22)
  // Density is the expression of energy — the layer's own opacity only has a floor.
  assert.equal(starCountFor(0), 0)
  assert.equal(starCountFor(1 / 3), 0)
  assert.equal(starCountFor(2 / 3), 11)
  assert.equal(starCountFor(1), 22)
  assert.equal(particleCountFor(1), EFFORT_STARS.length)
  assert.equal(starLayerOpacityFor(0), 0.6)
  assert.equal(starLayerOpacityFor(1), 1)
  // The middle of the track is the 1× that felt right; the top level doubles it and the left
  // end is floored rather than frozen.
  assert.equal(speedFor(2 / 3), 1)
  assert.equal(speedFor(1), 2)
  assert.equal(speedFor(0.5), 0.5)
  assert.equal(speedFor(0), 0.35)
  for (let index = 0; index < EFFORT_STARS.length; index += 1) {
    const brightness = starBrightnessFor(index)
    assert.ok(brightness >= 0.5 && brightness <= 1, `star ${index} is outside the brightness range: ${brightness}`)
  }
})

test('a star crosses the track in the time the position asks for, ±8%', () => {
  const { starDurationFor, MAX_SPEED_FACTOR, STARFIELD_DURATION_MEAN, STARFIELD_DURATION_SPREAD, EFFORT_STARS } = internals
  const durationsAt = (speed) => EFFORT_STARS.map((_, index) => starDurationFor(index, speed))
  const fastest = durationsAt(MAX_SPEED_FACTOR)
  const middle = durationsAt(1)
  const slowest = durationsAt(0.35)
  // The base time belongs to the fastest position: 1.5s at the top level, 3s at 1×, and about
  // 8.6s at the left end.
  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length
  assert.ok(Math.abs(mean(fastest) - STARFIELD_DURATION_MEAN) < 0.05, `the top level is not 1.5s: ${mean(fastest)}`)
  assert.ok(Math.abs(mean(middle) - 3) < 0.1, `the 1× level is not 3s: ${mean(middle)}`)
  assert.ok(Math.abs(mean(slowest) - 8.571) < 0.3, `the left end is not ~8.6s: ${mean(slowest)}`)
  // The spread is small on purpose: a star twice as quick would lap the slower ones into clumps.
  const ratio = Math.max(...middle) / Math.min(...middle)
  assert.ok(ratio <= 1 + 2 * STARFIELD_DURATION_SPREAD + 0.001, `the spread is too wide: ${ratio}`)
  // A speed asked for outside the range is clamped, not obeyed.
  assert.deepEqual(durationsAt(99), durationsAt(MAX_SPEED_FACTOR))
  assert.deepEqual(durationsAt(0), durationsAt(0.35))
})

test('the field’s speed is a playback rate in whole steps, played over stars written for the fastest position', () => {
  const { starRateFor, speedFor, starDurationFor, MAX_SPEED_FACTOR, STAR_RATE_STEPS } = internals
  // The top level plays at full speed and the 1× level at half of it.
  assert.equal(starRateFor(1), 1)
  assert.equal(starRateFor(2 / 3), 0.5)
  // Never zero — a rate of 0 pauses an animation — and floored where the speed is.
  assert.ok(starRateFor(0) > 0, 'the field stops at the left end')
  assert.equal(starRateFor(0), starRateFor(0.2))
  let previous = 0
  for (let step = 0; step <= 100; step += 1) {
    const rate = starRateFor(step / 100)
    // A rate is only worth writing when it has moved far enough to be seen, so it comes in steps…
    assert.ok(Math.abs(rate * STAR_RATE_STEPS - Math.round(rate * STAR_RATE_STEPS)) < 1e-9, `${rate} is not a whole step`)
    assert.ok(rate >= previous, `the field slowed down as the knob went right, at ${step}%`)
    assert.ok(rate <= 1)
    previous = rate
    // …and each is within half a step of what the position asks for.
    const ideal = speedFor(step / 100) / MAX_SPEED_FACTOR
    assert.ok(Math.abs(rate - ideal) <= 0.5 / STAR_RATE_STEPS + 1e-9, `at ${step}% the rate ${rate} is further than a step from ${ideal}`)
  }
  // A star written once, for the fastest position, crosses in the time the position asks for when it
  // is played at that position's rate (to the step): this is what stands in for rewriting the duration.
  for (const index of [0, 5, 13, 21]) {
    const written = starDurationFor(index, MAX_SPEED_FACTOR)
    for (const pct of [0.5, 2 / 3, 0.8, 1]) {
      const crossing = written / starRateFor(pct)
      const wanted = starDurationFor(index, speedFor(pct))
      assert.ok(Math.abs(crossing / wanted - 1) < 0.06, `star ${index} at ${pct} crosses in ${crossing}s, not ${wanted}s`)
    }
  }
})

test('the 22 stars are spread by phase, never sorted by height', () => {
  const { EFFORT_STARS, GOLDEN_RATIO, MIN_HEIGHT_SLOTS } = internals
  // Phase is a golden-ratio low-discrepancy sequence, so any prefix of it is still spread out.
  for (const [index, star] of EFFORT_STARS.entries()) {
    assert.ok(Math.abs(star.phase - ((index + 1) * GOLDEN_RATIO) % 1) < 1e-12, `star ${index} has the wrong phase`)
    assert.ok(star.y >= 8 && star.y <= 92, `star ${index} is outside the track: ${star.y}%`)
  }
  // Height is a *shuffle*: an earlier version took both from the same sequence and sorted the
  // field into a diagonal (a measured correlation of 0.999).
  const n = EFFORT_STARS.length
  const meanPhase = EFFORT_STARS.reduce((sum, star) => sum + star.phase, 0) / n
  const meanY = EFFORT_STARS.reduce((sum, star) => sum + star.y, 0) / n
  let covariance = 0
  let variancePhase = 0
  let varianceY = 0
  for (const star of EFFORT_STARS) {
    covariance += (star.phase - meanPhase) * (star.y - meanY)
    variancePhase += (star.phase - meanPhase) ** 2
    varianceY += (star.y - meanY) ** 2
  }
  const correlation = covariance / Math.sqrt(variancePhase * varianceY)
  assert.ok(Math.abs(correlation) < 0.35, `phase and height are correlated at ${correlation.toFixed(3)}`)
  // Stars whose phases are neighbours travel side by side, so they must not share a line: at
  // least three height slots, and a slot is 4% of the track.
  const byPhase = [...EFFORT_STARS].sort((a, b) => a.phase - b.phase)
  for (let index = 1; index < byPhase.length; index += 1) {
    const gap = Math.abs(byPhase[index].y - byPhase[index - 1].y)
    assert.ok(gap >= MIN_HEIGHT_SLOTS * 4 - 1e-9, `two neighbouring stars share a line: ${gap}%`)
  }
})

test('a star’s phase does not depend on how many stars are showing', () => {
  const { starDelayFor, starDurationFor, EFFORT_STARS } = internals
  for (const index of [0, 1, 7, 21]) {
    const atFull = starDelayFor(index, 1.5)
    // The delay is a fraction of the duration, so the two grow together and a star never
    // restarts when the energy — which only changes *how many* are shown — moves.
    const ratio = atFull / 1.5
    assert.ok(ratio > -1 && ratio <= 0, `star ${index} has a delay outside one cycle: ${atFull}`)
    assert.ok(Math.abs(starDelayFor(index, 3) / 3 - ratio) < 1e-9, `star ${index} re-phases when the duration changes`)
    assert.ok(starDelayFor(index, starDurationFor(index, 2)) < 0, 'a phase must be a negative delay')
  }
  // Deterministic: the same index gives the same phase, so a render never reshuffles the field.
  assert.equal(starDelayFor(5, 2), starDelayFor(5, 2))
  assert.equal(EFFORT_STARS.length, 22)
})

/* ═══════════════════════════ The DOM bridge ═══════════════════════════ */

test('the row is claimed, dressed, and the menu asked to measure again', () => {
  const menu = createOfficialMenu(doc)
  const anchor = new FakeNode('span')
  menu.composer.appendChild(anchor)
  let host = null
  const bridge = internals.createEffortBridge({
    doc,
    win,
    anchor: () => anchor,
    active: () => true,
    onChange: (next) => { host = next },
    seatLabels: () => ['High'],
  })
  resizes.length = 0
  bridge.start()

  assert.ok(host !== null, 'the effort row was never claimed')
  assert.equal(menu.effortRow.style.height, 'auto')
  assert.equal(menu.effortRow.style.flexWrap, 'wrap')
  assert.equal(menu.effortRow.style.paddingTop, internals.ROW_PADDING_BLOCK)
  assert.equal(menu.effortRow.style.paddingBottom, internals.ROW_PADDING_BLOCK)
  const container = menu.effortRow.querySelector('[data-ces-part="host"]')
  assert.ok(container !== null, 'no container was hung in the row')
  // The menu measures itself once and then sits at a fixed position, so the taller row has to
  // ask it to measure again.
  assert.deepEqual(resizes, ['resize'])
  bridge.dispose()
})

test('releasing the row puts every style back', () => {
  const menu = createOfficialMenu(doc)
  const anchor = new FakeNode('span')
  menu.composer.appendChild(anchor)
  // Something the shell wrote itself must survive the round trip.
  menu.effortRow.style.height = '34px'
  const bridge = internals.createEffortBridge({
    doc, win, anchor: () => anchor, active: () => true, onChange: () => {}, seatLabels: () => [],
  })
  bridge.start()
  assert.equal(menu.effortRow.style.height, 'auto')
  bridge.dispose()
  assert.equal(menu.effortRow.style.height, '34px', 'the shell’s own height was not restored')
  assert.equal(menu.effortRow.style.flexWrap, '')
  assert.equal(menu.effortRow.style.paddingTop, '')
  assert.equal(menu.effortRow.querySelector('[data-ces-part="host"]'), null, 'the container stayed behind')
})

test('an unopened menu, a missing anchor and a pane of many rows are all left alone', () => {
  const cases = [
    { name: 'the menu is closed', menu: { open: false } },
    { name: 'the seat names no menu', menu: { controls: null } },
    { name: 'the pane has more than two rows', menu: { rows: 3 } },
  ]
  for (const item of cases) {
    const menu = createOfficialMenu(doc, item.menu)
    const anchor = new FakeNode('span')
    menu.composer.appendChild(anchor)
    const bridge = internals.createEffortBridge({
      doc, win, anchor: () => anchor, active: () => true, onChange: () => {}, seatLabels: () => [],
    })
    bridge.start()
    assert.equal(menu.effortRow.querySelector('[data-ces-part="host"]'), null, `${item.name}: the row was dressed anyway`)
    // The shell's own list is untouched: nothing was added to the row at all.
    assert.equal(menu.effortRow.children.length, 3, `${item.name}: the row gained a child`)
    bridge.dispose()
  }
})

test('a row that already carries a slider keeps it', () => {
  const menu = createOfficialMenu(doc)
  const anchor = new FakeNode('span')
  menu.composer.appendChild(anchor)
  const foreign = new FakeNode('div')
  foreign.setAttribute('data-ces-part', 'host')
  menu.effortRow.appendChild(foreign)
  const bridge = internals.createEffortBridge({
    doc, win, anchor: () => anchor, active: () => true, onChange: () => {}, seatLabels: () => [],
  })
  bridge.start()
  const hosts = menu.effortRow.querySelectorAll('[data-ces-part="host"]')
  assert.equal(hosts.length, 1, 'two sliders were stacked in one row')
  assert.equal(hosts[0], foreign, 'the copy already in the row was replaced')
  bridge.dispose()
})

test('another composer’s menu is never touched', () => {
  const mine = createOfficialMenu(doc)
  const anchor = new FakeNode('span')
  mine.composer.appendChild(anchor)
  const other = createOfficialMenu(doc)
  // The anchor belongs to `mine`, so the bridge must skip the other session's row even though
  // it is open, in the document, and shaped exactly right.
  const bridge = internals.createEffortBridge({
    doc, win, anchor: () => anchor, active: () => true, onChange: () => {}, seatLabels: () => [],
  })
  bridge.start()
  assert.ok(mine.effortRow.querySelector('[data-ces-part="host"]') !== null, 'the control never claimed its own row')
  assert.equal(other.effortRow.querySelector('[data-ces-part="host"]'), null, 'the control dressed another session’s row')
  bridge.dispose()
})

test('the collapsed seat’s level text is coloured, and given back', () => {
  const menu = createOfficialMenu(doc, { effort: 'Max' })
  const anchor = new FakeNode('span')
  menu.composer.appendChild(anchor)
  const bridge = internals.createEffortBridge({
    doc, win, anchor: () => anchor, active: () => true, onChange: () => {}, seatLabels: () => ['Max'],
  })
  bridge.start()
  bridge.setSeatColor('rgb(139,92,246)')
  assert.equal(menu.seatEffort.style.color, 'rgb(139,92,246)')
  // A re-render that replaces the span: the colour is the bridge's to reapply.
  menu.seatEffort.style.color = ''
  bridge.setSeatColor('rgb(139,92,246)')
  assert.equal(menu.seatEffort.style.color, 'rgb(139,92,246)')
  bridge.dispose()
  assert.equal(menu.seatEffort.style.color, '', 'the seat kept the plugin’s colour after unload')
})

/* ═══════════════════════════ The quota notice ═══════════════════════════ */

/** The notice this plugin draws over the row's value cell, or null. */
function noticeOf(menu) {
  return menu.effortRow.children.find((child) => child.getAttribute('data-ces-part') === 'notice') ?? null
}

test('the notice sits over the value cell, flips in place, and leaves with the row', () => {
  const menu = createOfficialMenu(doc, { effort: 'Max' })
  const anchor = new FakeNode('span')
  menu.composer.appendChild(anchor)
  const bridge = internals.createEffortBridge({
    doc, win, anchor: () => anchor, active: () => true, onChange: () => {}, seatLabels: () => ['Max'],
  })
  bridge.start()
  assert.equal(noticeOf(menu), null, 'a notice appeared before anything asked for one')

  // A value cell 40px wide at the row's right edge; the notice takes that box and nothing else.
  menu.effortValue.rect = { left: 150, top: 4, right: 190, bottom: 24, width: 40, height: 20 }
  bridge.notice({ front: '将使用更多额度', back: 'Max', color: 'rgb(109,40,217)', flipped: false })
  const notice = noticeOf(menu)
  assert.ok(notice !== null, 'the notice never reached the shell’s row')
  const faces = notice.children[0].children
  assert.equal(faces[0].textContent, '将使用更多额度', 'the warning is not what the notice shows first')
  assert.equal(faces[1].textContent, 'Max', 'the flip has no level name to land on')
  assert.equal(notice.style.color, 'rgb(109,40,217)', 'the notice is not in the level’s own colour')
  assert.equal(notice.style.top, '4px')
  assert.equal(notice.style.height, '20px')
  assert.equal(notice.style.left, '150px')
  assert.equal(notice.style.width, '40px')
  assert.equal(notice.style.background, undefined, 'the notice paints a background of its own')
  assert.equal(notice.getAttribute('data-flipped'), '0')
  // The shell's text is hushed rather than covered: same text, invisible, given back after.
  assert.equal(menu.effortValue.classList.contains('ces-cell-hushed'), true,
    'the shell’s own value would read through the notice')
  assert.equal(menu.effortValue.textContent, 'Max', 'the notice rewrote the shell’s value text')

  // The flip is a state on the same element: replacing it would restart the animation instead.
  bridge.notice({ front: '将使用更多额度', back: 'Max', color: 'rgb(109,40,217)', flipped: true })
  assert.equal(noticeOf(menu), notice, 'the flip replaced the element instead of turning it')
  assert.equal(notice.getAttribute('data-flipped'), '1')

  // Clearing takes it away; so does unloading, and the row keeps no style of ours.
  bridge.notice(null)
  assert.equal(noticeOf(menu), null, 'the notice outlived the state that asked for it')
  assert.equal(menu.effortValue.classList.contains('ces-cell-hushed'), false,
    'the shell’s value stayed invisible after the notice left')
  bridge.notice({ front: '将使用更多额度', back: 'Max', color: '', flipped: false })
  assert.ok(noticeOf(menu) !== null)
  bridge.dispose()
  assert.equal(noticeOf(menu), null, 'the notice outlived the bridge')
  assert.equal(menu.effortValue.classList.contains('ces-cell-hushed'), false,
    'unloading left the shell’s value invisible')
  assert.equal(menu.effortRow.style.position, '', 'the row kept a position the plugin wrote')
})

test('reaching the top level warns for a second and then flips to the level’s name', async () => {
  const { menu, stub } = mountControl({ effort: 'high' })
  await tick()
  assert.equal(noticeOf(menu), null, 'a menu opened below the top level already warns')

  const track = stub.find('track')
  track.fire('onPointerDown', { clientX: 5 })
  track.fire('onPointerMove', { clientX: 186 })
  track.fire('onPointerUp', {})
  await tick()
  assert.equal(stub.find('track').getAttribute('aria-valuetext'), 'Max')

  const notice = noticeOf(menu)
  assert.ok(notice !== null, 'the top level never warned about what it costs')
  assert.equal(notice.children[0].children[0].textContent, '将使用更多额度')
  assert.equal(notice.getAttribute('data-flipped'), '0')
  // The shell's own text is the shell's: the warning is an overlay over it, never a rewrite.
  // This fixture never re-renders its caption, so what it rendered stays byte for byte — which
  // is the whole assertion: the plugin's text never becomes the shell's text.
  assert.equal(menu.effortValue.textContent, 'High', 'the notice rewrote the shell’s value text')

  await new Promise((resolve) => setTimeout(resolve, internals.QUOTA_NOTICE_MS + 150))
  assert.equal(notice.getAttribute('data-flipped'), '1', 'the notice never flipped to the level')
  assert.equal(notice.children[0].children[1].textContent, 'Max')
  assert.equal(menu.effortValue.textContent, 'High', 'the flip rewrote the shell’s value text')

  // Leaving the top level takes the notice with it.
  track.fire('onPointerDown', { clientX: 5 })
  track.fire('onPointerMove', { clientX: 5 })
  track.fire('onPointerUp', {})
  await tick()
  assert.equal(noticeOf(menu), null, 'the notice stayed after the level left the top')
  stub.unmount()
})

test('the notice follows the value cell when the shell re-renders it', () => {
  const menu = createOfficialMenu(doc, { effort: 'Max' })
  const anchor = new FakeNode('span')
  menu.composer.appendChild(anchor)
  const bridge = internals.createEffortBridge({
    doc, win, anchor: () => anchor, active: () => true, onChange: () => {}, seatLabels: () => ['Max'],
  })
  bridge.start()
  bridge.notice({ front: '将使用更多额度', back: 'Max', color: 'rgb(1,2,3)', flipped: false })
  const first = menu.effortValue
  assert.equal(first.classList.contains('ces-cell-hushed'), true)

  // The shell writes its text on the element it already has; a re-render that hands back a new
  // one must not leave the old cell hushed while the new one shows through the notice.
  const next = new FakeNode('span')
  next.className = 'wq12jW_cellValue'
  next.textContent = 'Max'
  next.rect = { left: 120, top: 6, right: 180, bottom: 26, width: 60, height: 20 }
  menu.effortRow.appendChild(next)
  bridge.scan()
  assert.equal(first.classList.contains('ces-cell-hushed'), false, 'the cell the row no longer has stayed hushed')
  assert.equal(next.classList.contains('ces-cell-hushed'), true, 'the cell the row has now was not hushed')
  assert.equal(noticeOf(menu).style.left, '120px', 'the notice did not follow the new cell')
  assert.equal(noticeOf(menu).style.width, '60px')
  bridge.dispose()
  assert.equal(next.classList.contains('ces-cell-hushed'), false, 'unloading left the new cell hushed')
})

/* ═══════════════════════════ The control, rendered ═══════════════════════════ */

test('the control renders a track, a tick per level and a knob at the level in use', async () => {
  const { menu, stub } = mountControl({ effort: 'high' })
  await tick()
  const track = stub.find('track')
  assert.ok(track !== null, 'the track never reached the shell’s row')
  assert.ok(menu.effortRow.children.some((child) => child.getAttribute('data-ces-part') === 'host'),
    'the control rendered somewhere other than the effort row')
  assert.equal(track.getAttribute('role'), 'slider')
  assert.equal(track.getAttribute('aria-valuenow'), '2')
  assert.equal(track.getAttribute('aria-valuetext'), 'High')
  assert.equal(track.getAttribute('aria-valuemax'), '3')
  assert.equal(track.getAttribute('title'), '推理等级：High')
  assert.equal(stub.findAll('tick').length, 4, 'there is not one tick per level')
  assert.deepEqual(stub.findAll('tick').map((node) => node.getAttribute('data-on')), ['1', '1', '1', '0'])
  // The fill ends, and the knob sits, at the level's own position.
  assert.equal(stub.find('knob').style.left, internals.knobOffsetOf(2 / 3))
  assert.equal(stub.find('fill').style.width, stub.find('knob').style.left)
  stub.unmount()
})

test('the nebula and the stars cover the completed part only', async () => {
  const { stub } = mountControl({ effort: 'max' })
  await tick()
  const fill = stub.find('fill').style.width
  assert.equal(stub.find('energy').style.width, fill, 'the nebula covers more than the completed part')
  assert.equal(stub.find('stars').style.width, fill)
  assert.equal(stub.find('root').getAttribute('data-energy'), '1')
  const shown = stub.findAll('star').filter((node) => node.style.display !== 'none')
  assert.equal(shown.length, 22, 'the top level does not light the whole field')
  // Every star is built whether or not the position shows it: the field thickens by hiding one,
  // and taking nodes in and out of the shell's row inside a drag re-runs its mutation watcher.
  assert.equal(stub.findAll('star').length, 22)
  // Brightness is a variable on the dot, and every star crosses with the position's timing.
  const first = stub.findAll('star')[0]
  assert.match(first.style.animationDuration, /^\d+\.\d{3}s$/u)
  assert.ok(first.style.animationDelay.startsWith('-'), 'a star has no phase')
  assert.equal(first.children[0].style['--ces-b'], first.children[0].getAttribute('data-brightness'))

  // The default level: no nebula, no stars, and the layer is still there and invisible-safe.
  const low = mountControl({ effort: 'low' })
  await tick()
  assert.equal(low.stub.find('root').getAttribute('data-energy'), '0')
  const hidden = low.stub.findAll('star')
  assert.equal(hidden.length, 22, 'the field is not kept in place')
  assert.equal(hidden.filter((node) => node.style.display !== 'none').length, 0, 'stars show with no energy')
  assert.equal(low.stub.findAll('tick').map((node) => node.getAttribute('data-on')).join(''), '1100')
  low.stub.unmount()
  stub.unmount()
})

test('dragging selects the level the pointer is over', async () => {
  const { directory, stub } = mountControl({ effort: 'high' })
  await tick()
  const track = stub.find('track')
  track.fire('onPointerDown', { clientX: 5 })
  track.fire('onPointerMove', { clientX: 186 })
  // What lands is the release: it lands on the level the pointer was released over rather than
  // the one it started on.
  track.fire('onPointerUp', {})
  await tick()
  assert.deepEqual(directory.selects, [{ provider: 'deepseek', model: 'v41', reasoningEffort: 'max' }])
  // The host reported the new level, so the knob now shows Max without an optimistic overlay.
  assert.equal(stub.find('track').getAttribute('aria-valuetext'), 'Max')
  assert.equal(stub.find('knob').style.left, internals.knobOffsetOf(1))
  stub.unmount()
})

test('a drag paints on the display frame, and the release lands where it was let go', async () => {
  const { directory, stub } = mountControl({ effort: 'low' })
  await tick()
  const track = stub.find('track')
  // The knob follows the pointer continuously during a drag, so an expected offset is the raw
  // geometry the visuals use rather than a level's own position.
  const offsetFor = (clientX) => internals.knobOffsetOf(
    (clientX - internals.KNOB_RADIUS) / (200 - internals.KNOB_RADIUS * 2),
  )
  // A drag paints on the display's clock, so the test owns that clock: a frame happens when this
  // says so, and no assertion has to race a real one. The host's commit throttle and its deadline
  // are timers; holding those means nothing fires behind the assertions either.
  const frames = []
  const realRequest = win.requestAnimationFrame
  const realCancel = win.cancelAnimationFrame
  win.requestAnimationFrame = (callback) => {
    frames.push(callback)
    return frames.length
  }
  win.cancelAnimationFrame = (handle) => {
    frames[handle - 1] = null
  }
  const realSetTimeout = globalThis.setTimeout
  const realClearTimeout = globalThis.clearTimeout
  const timers = []
  globalThis.setTimeout = (fn, delay) => {
    timers.push({ fn, delay })
    return timers.length
  }
  globalThis.clearTimeout = (handle) => {
    if (handle) timers[handle - 1] = null
  }
  const owed = () => frames.filter((callback) => callback !== null)
  const fireFrame = () => {
    const callback = owed()[0]
    frames[frames.indexOf(callback)] = null
    callback()
  }
  const settle = () => Promise.resolve().then(() => Promise.resolve())
  try {
    // Going down is the pointer's own frame, and it paints where the pointer went down.
    track.fire('onPointerDown', { clientX: 14 })
    await settle()
    assert.equal(stub.find('knob').style.left, offsetFor(14), 'the drag did not start under the pointer')
    const reads = stub.find('track').rectReads
    // A move is owed the next frame rather than painted at once, and a second move in the same
    // frame does not ask for one of its own: one frame carries the newest position, not the first.
    track.fire('onPointerMove', { clientX: 60 })
    await settle()
    assert.equal(owed().length, 1, 'a move was not owed a frame')
    assert.equal(stub.find('knob').style.left, offsetFor(14), 'a move painted before its frame')
    track.fire('onPointerMove', { clientX: 90 })
    await settle()
    assert.equal(owed().length, 1, 'the second move in the frame asked for a frame of its own')
    assert.equal(stub.find('knob').style.left, offsetFor(14), 'the second move in the frame painted too')
    // The owed frame arrives, and paints where the pointer is now rather than where it first asked.
    fireFrame()
    await settle()
    assert.equal(stub.find('knob').style.left, offsetFor(90), 'the owed frame painted a position the pointer had left')
    assert.equal(owed().length, 0, 'the drag kept the frame it had already painted')
    // Measuring the track is a forced layout, and a drag is worth exactly one of them.
    assert.equal(stub.find('track').rectReads, reads, 'the drag measured the track on a move')
    // A frame still owed when the pointer lets go is dropped, and what it was holding is what the
    // release writes: the level the pointer was over, not the last one a frame happened to paint.
    track.fire('onPointerMove', { clientX: 120 })
    await settle()
    assert.equal(owed().length, 1, 'a move was not owed a frame')
    assert.equal(stub.find('knob').style.left, offsetFor(90), 'a move painted before its frame')
    track.fire('onPointerUp', {})
    assert.equal(owed().length, 0, 'the drag kept its frame after the release')
  } finally {
    win.requestAnimationFrame = realRequest
    win.cancelAnimationFrame = realCancel
    globalThis.setTimeout = realSetTimeout
    globalThis.clearTimeout = realClearTimeout
  }
  await tick()
  // Only the release can have written `high`: a move that far along the track is the position it
  // was holding, and nothing else in this drag reaches that level.
  assert.deepEqual(
    directory.selects.map((entry) => entry.reasoningEffort).filter((id) => id === 'high'),
    ['high'],
    'the release wrote a level the pointer had already left',
  )
  assert.equal(stub.find('track').getAttribute('aria-valuetext'), 'High')
  stub.unmount()
})

test('a drag paints the knob every frame and the ambience behind it on its own cadence', async () => {
  const { stub } = mountControl({ effort: 'low' })
  await tick()
  const track = stub.find('track')
  const pctFor = (clientX) => (clientX - internals.KNOB_RADIUS) / (200 - internals.KNOB_RADIUS * 2)
  const offsetFor = (clientX) => internals.knobOffsetOf(pctFor(clientX))
  const energyAt = (clientX) => String(internals.energyFor(pctFor(clientX)))
  const rateAt = (clientX) => internals.starRateFor(pctFor(clientX)).toFixed(4)
  const energy = () => stub.find('root').style['--ces-energy']
  const rate = () => stub.find('stars').getAttribute('data-rate')
  // What every star was written with. A star is written once, for the fastest position: a CSS
  // animation whose duration is rewritten re-maps its progress by however long it has been running,
  // so a field re-timed during a drag jumps — tens of pixels at a time, on every frame.
  const timing = () => stub.findAll('star').map((star) => `${star.style.animationDuration} ${star.style.animationDelay}`).join('|')
  const realRequest = win.requestAnimationFrame
  // A frame the moment a move asks for one: this test is about what a frame paints, not about
  // which frame paints it — the drag test above owns that question.
  win.requestAnimationFrame = (callback) => {
    callback()
    return 0
  }
  const move = async (clientX) => {
    track.fire('onPointerMove', { clientX })
    await tick()
  }
  const settleDrag = async (clientX) => {
    track.fire('onPointerDown', { clientX })
    await tick()
  }
  try {
    const written = timing()
    assert.equal(
      stub.findAll('star')[0].style.animationDuration,
      `${internals.starDurationFor(0, internals.MAX_SPEED_FACTOR).toFixed(3)}s`,
      'a star was not written for the fastest position',
    )
    // Going down is the pointer's own frame, and it sets the ambience too: the glow and the field
    // may be a frame behind the pointer, but never behind the level the knob is standing in.
    await settleDrag(160)
    assert.equal(stub.find('knob').style.left, offsetFor(160))
    assert.equal(energy(), energyAt(160), 'the drag did not light the field it started in')
    assert.equal(rate(), rateAt(160), 'the drag did not set the field’s speed')
    const held = energyAt(160)
    const heldRate = rateAt(160)
    // Two more frames inside the same level: the knob and the fill follow the pointer on both of
    // them — that is the control feeling like it is under the finger — while the glow and the
    // field’s speed stay where they were, because the stylesheet eases the one and a rate is only
    // worth writing once it has moved far enough to be seen.
    await move(177)
    assert.equal(stub.find('knob').style.left, offsetFor(177), 'the knob did not follow the pointer')
    assert.equal(stub.find('fill').style.width, offsetFor(177), 'the fill did not follow the knob')
    assert.equal(energy(), held, 'the ambience followed a frame it did not have to')
    assert.equal(rate(), heldRate, 'the field’s speed followed a frame it did not have to')
    assert.notEqual(rateAt(177), heldRate, 'the frames of this drag no longer move the rate, so the check above proves nothing')
    // The stars themselves are never re-written: their speed is a rate, not a timing.
    assert.equal(timing(), written, 'a star was re-timed in the middle of a drag')
    await move(170)
    assert.equal(stub.find('knob').style.left, offsetFor(170))
    assert.equal(energy(), held, 'the ambience followed a frame it did not have to')
    assert.equal(rate(), heldRate, 'the field’s speed followed a frame it did not have to')
    // The third frame of the drag is the one it follows on.
    await move(165)
    assert.equal(stub.find('knob').style.left, offsetFor(165))
    assert.equal(energy(), energyAt(165), 'the ambience never caught up with the drag')
    assert.equal(rate(), rateAt(165), 'the field’s speed never caught up with the drag')
    // And a frame that changes the level carries the ambience with it, however recently it followed.
    await move(30)
    assert.equal(stub.find('knob').style.left, offsetFor(30))
    assert.equal(energy(), energyAt(30), 'the ambience lagged the level the knob was standing in')
    assert.equal(rate(), rateAt(30), 'the field’s speed lagged the level the knob was standing in')
    assert.equal(stub.find('root').getAttribute('data-energy'), '0')
    assert.equal(timing(), written, 'a star was re-timed by the end of the drag')
  } finally {
    win.requestAnimationFrame = realRequest
  }
  stub.unmount()
})

test('the Claude spark’s bloom rides the ambience, and the knob under it follows every frame', async () => {
  const { stub } = mountControl({ effort: 'low', theme: 'claude' })
  await tick()
  const track = stub.find('track')
  const pctFor = (clientX) => (clientX - internals.KNOB_RADIUS) / (200 - internals.KNOB_RADIUS * 2)
  // Every move below stays on the top level, so the level the bloom is read through never changes.
  const bloomAt = (clientX) => internals.claudeBloomFor(pctFor(clientX), LEVELS[3]).toFixed(3)
  const bloom = () => stub.find('root').style['--ces-bloom']
  const realRequest = win.requestAnimationFrame
  win.requestAnimationFrame = (callback) => {
    callback()
    return 0
  }
  try {
    track.fire('onPointerDown', { clientX: 160 })
    await tick()
    assert.equal(bloom(), bloomAt(160), 'the drag did not open the spark it started on')
    assert.equal(stub.find('root').getAttribute('data-ultra'), '1')
    // Each of the twelve rays opens on its own 0.42s transition, which SVG cannot hand to the
    // compositor: a target written on every frame restarts a dozen of them, a style pass and an SVG
    // layout each, on every frame — for a spark that is still on its way to the last one.
    for (const clientX of [177, 170]) {
      track.fire('onPointerMove', { clientX })
      await tick()
      assert.equal(stub.find('knob').style.left, internals.knobOffsetOf(pctFor(clientX)), 'the knob did not follow the pointer')
      assert.equal(bloom(), bloomAt(160), 'the bloom followed a frame it did not have to')
    }
    track.fire('onPointerMove', { clientX: 165 })
    await tick()
    assert.equal(bloom(), bloomAt(165), 'the bloom never caught up with the drag')
  } finally {
    win.requestAnimationFrame = realRequest
  }
  stub.unmount()
})

test('the field’s speed reaches the stars as a playback rate, and no timing is rewritten to get it there', async () => {
  // The Web Animations API, as much of it as the control touches: one animation per star that is
  // showing, and a log of every rate it was asked to play at.
  const asked = []
  const made = new WeakMap()
  FakeNode.prototype.getAnimations = function getAnimations() {
    if (this.className !== 'ces-star' || this.style.display === 'none') return []
    if (!made.has(this)) {
      made.set(this, [{
        playbackRate: 1,
        updatePlaybackRate(rate) {
          this.playbackRate = rate
          asked.push(rate)
        },
      }])
    }
    return made.get(this)
  }
  const realRequest = win.requestAnimationFrame
  win.requestAnimationFrame = (callback) => {
    callback()
    return 0
  }
  try {
    // `high` of four levels sits two thirds along the track: eleven stars, at the 1× speed.
    const { stub } = mountControl({ effort: 'high' })
    await tick()
    const rateHere = internals.starRateFor(2 / 3)
    assert.equal(stub.findAll('star').filter((star) => star.style.display !== 'none').length, 11)
    assert.deepEqual(asked, new Array(11).fill(rateHere), 'a star that is showing was not played at the position’s speed')
    assert.equal(rateHere, 0.5)
    // A drag to the left thins the field and slows it, and each step that does so is a rate for the
    // stars that are left — never a new duration or delay on them.
    const written = stub.findAll('star').map((star) => `${star.style.animationDuration} ${star.style.animationDelay}`).join('|')
    const track = stub.find('track')
    track.fire('onPointerDown', { clientX: 100 })
    await tick()
    const pct = (100 - internals.KNOB_RADIUS) / (200 - internals.KNOB_RADIUS * 2)
    const shown = stub.findAll('star').filter((star) => star.style.display !== 'none').length
    assert.equal(shown, internals.starCountFor(pct))
    assert.deepEqual(asked.slice(11), new Array(shown).fill(internals.starRateFor(pct)), 'the thinner field was not slowed to the position’s speed')
    assert.equal(
      stub.findAll('star').map((star) => `${star.style.animationDuration} ${star.style.animationDelay}`).join('|'),
      written,
      'a star was re-timed to change its speed',
    )
    track.fire('onPointerUp', {})
    await tick()
    stub.unmount()
  } finally {
    delete FakeNode.prototype.getAnimations
    win.requestAnimationFrame = realRequest
  }
})

test('a drag writes nothing to the host until it is let go', async () => {
  const { directory, stub } = mountControl({ effort: 'low' })
  await tick()
  const track = stub.find('track')
  track.fire('onPointerDown', { clientX: 14 })
  await tick()
  // Off, Low, High, High and Max in turn: every one of the three levels passed on the way is a
  // position the knob is merely crossing, not one that was chosen.
  for (const clientX of [60, 100, 150, 186]) {
    track.fire('onPointerMove', { clientX })
    await tick()
  }
  assert.equal(stub.find('track').getAttribute('aria-valuetext'), 'Max', 'the knob did not follow the pointer')
  // Longer than the throttle this used to be written on: nothing may be on its way.
  await new Promise((resolve) => setTimeout(resolve, 250))
  assert.deepEqual(directory.selects, [], 'the drag wrote a level it was only passing through')
  // The shell’s own text is still the level in force, and it is the release that changes it.
  track.fire('onPointerUp', {})
  await tick()
  assert.deepEqual(directory.selects.map((selection) => selection.reasoningEffort), ['max'])
  stub.unmount()
})

test('a drag that ends where it began writes nothing at all', async () => {
  const { directory, stub } = mountControl({ effort: 'high' })
  await tick()
  const track = stub.find('track')
  // `high` is the third of four levels, two thirds along the track.
  track.fire('onPointerDown', { clientX: 129 })
  await tick()
  track.fire('onPointerMove', { clientX: 14 })
  await tick()
  assert.equal(stub.find('track').getAttribute('aria-valuetext'), 'Off')
  track.fire('onPointerMove', { clientX: 129 })
  await tick()
  track.fire('onPointerUp', {})
  await tick()
  assert.deepEqual(directory.selects, [], 'a release on the level already in force was written')
  assert.equal(stub.find('track').getAttribute('aria-valuetext'), 'High')
  stub.unmount()
})

test('losing the pointer capture ends the drag where it stands, once', async () => {
  const { directory, stub } = mountControl({ effort: 'low' })
  await tick()
  const track = stub.find('track')
  track.fire('onPointerDown', { clientX: 14 })
  track.fire('onPointerMove', { clientX: 186 })
  await tick()
  assert.deepEqual(directory.selects, [])
  // The window lost focus, or the pointer was taken away: no pointer-up will come, and with nothing
  // written during the drag this event is the only thing that can end it.
  track.fire('onLostPointerCapture', {})
  await tick()
  assert.deepEqual(directory.selects.map((selection) => selection.reasoningEffort), ['max'])
  // The pointer-up that follows a normal release finds the drag already over.
  track.fire('onPointerUp', {})
  await tick()
  assert.equal(directory.selects.length, 1, 'the same release was written twice')
  stub.unmount()
})

test('a menu closed under a held pointer takes the drag with it, and writes nothing', async () => {
  const { directory, menu, stub } = mountControl({ effort: 'low' })
  await tick()
  const track = stub.find('track')
  track.fire('onPointerDown', { clientX: 14 })
  track.fire('onPointerMove', { clientX: 186 })
  await tick()
  assert.equal(stub.find('track').getAttribute('aria-valuetext'), 'Max', 'the knob did not follow the pointer')
  // Escape closes the menu while the button is still down: the track goes, and the release this drag
  // is waiting for will never reach it.
  menu.close()
  for (const observer of [...FakeMutationObserver.instances]) observer.trigger()
  await tick()
  assert.equal(stub.find('track'), null, 'the track outlived its menu')
  await new Promise((resolve) => setTimeout(resolve, 50))
  assert.deepEqual(directory.selects, [], 'a drag the menu was closed under chose a level')
  // The menu opens again: the knob stands on the level in force, not where the dead drag left it.
  doc.body.appendChild(menu.menu)
  menu.seat.setAttribute('aria-expanded', 'true')
  for (const observer of [...FakeMutationObserver.instances]) observer.trigger()
  await tick()
  assert.equal(stub.find('track').getAttribute('aria-valuetext'), 'Low', 'the knob came back where the dead drag left it')
  assert.equal(stub.find('root').getAttribute('data-energy'), '0', 'the field stayed lit from the dead drag')
  assert.deepEqual(directory.selects, [])
  stub.unmount()
})

test('each frame of a drag is committed inside the frame it paints for, and nothing else is', async () => {
  const { stub } = mountControl({ effort: 'low' })
  await tick()
  const track = stub.find('track')
  const frames = []
  const realRequest = win.requestAnimationFrame
  const realCancel = win.cancelAnimationFrame
  win.requestAnimationFrame = (callback) => {
    frames.push(callback)
    return frames.length
  }
  win.cancelAnimationFrame = (handle) => {
    frames[handle - 1] = null
  }
  const owed = () => frames.filter((callback) => callback !== null)
  const fireFrame = () => {
    const callback = owed()[0]
    frames[frames.indexOf(callback)] = null
    callback()
  }
  try {
    // A render left to React's own scheduler lands in the task after the frame was drawn: the knob
    // would be a frame late, and the DOM it wrote would still be dirty when the next frame's pointer
    // event arrived, whose hit test then recalculates style and layout on the spot.
    track.fire('onPointerDown', { clientX: 14 })
    await tick()
    const before = stubReactDom.flushSyncCalls
    track.fire('onPointerMove', { clientX: 100 })
    await tick()
    assert.equal(stubReactDom.flushSyncCalls, before, 'a move was committed before its frame')
    fireFrame()
    assert.equal(stubReactDom.flushSyncCalls, before + 1, 'the frame did not commit its own paint')
    // The pointer going down and coming up are the shell’s own events, and join the update already
    // under way instead of forcing one of their own.
    track.fire('onPointerMove', { clientX: 150 })
    track.fire('onPointerUp', {})
    await tick()
    assert.equal(stubReactDom.flushSyncCalls, before + 1, 'a release was committed through flushSync')
    assert.equal(owed().length, 0, 'the release left a frame behind')
  } finally {
    win.requestAnimationFrame = realRequest
    win.cancelAnimationFrame = realCancel
  }
  stub.unmount()
})

test('a write the host refuses rolls back and says so', async () => {
  const directory = createDirectory('high', { fail: true })
  const { stub } = mountControl({ directory })
  await tick()
  const track = stub.find('track')
  track.fire('onPointerDown', { clientX: 186 })
  track.fire('onPointerUp', {})
  await tick()
  assert.equal(directory.selects.length, 1, 'the write never reached the host')
  const error = stub.find('error')
  assert.ok(error !== null, 'a refused write said nothing')
  assert.equal(error.textContent, 'the host refused')
  // Back on the level that is really in force, rather than on the one that was asked for.
  assert.equal(stub.find('track').getAttribute('aria-valuetext'), 'High')
  stub.unmount()
})

test('the keyboard moves one level at a time, and Home and End jump', async () => {
  const { directory, stub } = mountControl({ effort: 'high' })
  await tick()
  // Each press re-renders, so the track is re-read: pressing the node a render has already
  // detached would test a stale closure rather than the control.
  const press = async (key) => {
    stub.find('track').fire('onKeyDown', { key })
    await tick()
    return stub.find('track').getAttribute('aria-valuetext')
  }
  assert.equal(await press('ArrowRight'), 'Max')
  assert.equal(await press('ArrowLeft'), 'High')
  assert.equal(await press('Home'), 'Off')
  assert.equal(await press('End'), 'Max')
  assert.deepEqual(directory.selects.map((selection) => selection.reasoningEffort), ['max', 'high', 'off', 'max'])
  // A key the shell owns is left to the shell.
  await press('Escape')
  assert.equal(directory.selects.length, 4)
  stub.unmount()
})

test('Off keeps the shell’s own grey on the row and on the seat', async () => {
  const { menu, stub } = mountControl({ effort: 'off' })
  await tick()
  assert.equal(menu.effortValue.style.color, '', 'the value text was coloured for an Off level')
  assert.equal(menu.seatEffort.style.color, '', 'the seat was coloured for an Off level')
  stub.unmount()
  assert.equal(menu.effortValue.style.color, '', 'the value’s colour outlived the control')
})

test('the row’s value text follows the position, and only its colour', async () => {
  const { menu, stub } = mountControl({ effort: 'max' })
  await tick()
  assert.equal(menu.effortValue.textContent, 'Max', 'the control rewrote the shell’s own text')
  assert.equal(menu.effortValue.style.color, internals.valueColorFor(1, LEVELS[3]))
  assert.equal(menu.seatEffort.style.color, internals.valueColorFor(1, LEVELS[3]))
  // A lit control draws a violet edge around the shell’s own row.
  assert.match(menu.effortRow.style.boxShadow, /^inset 0 0 0 1px rgba\(168,85,247,/u)
  stub.unmount()
})

test('reduced motion slows every star by the same factor', async () => {
  const { stub } = mountControl({ effort: 'max', reducedMotion: true })
  await tick()
  assert.equal(stub.find('root').getAttribute('data-motion'), 'reduced')
  const star = stub.findAll('star')[0]
  const expected = internals.starDurationFor(0, internals.MAX_SPEED_FACTOR) * internals.REDUCED_MOTION_SLOWDOWN
  assert.equal(star.style.animationDuration, `${expected.toFixed(3)}s`)
  assert.equal(stub.find('track').getAttribute('title'), '推理等级：Max（系统「减少动态效果」已开启：粒子已放缓）')
  stub.unmount()
})

test('closing the menu takes the slider with it, and reopening brings it back', async () => {
  const { menu, stub } = mountControl({ effort: 'high' })
  await tick()
  assert.ok(menu.effortRow.querySelector('[data-ces-part="host"]') !== null)
  menu.close()
  // The menu is unmounted, which no state of this control can observe: the observer is what
  // notices, and it is what has to put the row back.
  for (const observer of [...FakeMutationObserver.instances]) observer.trigger()
  await tick()
  assert.equal(menu.effortRow.querySelector('[data-ces-part="host"]'), null, 'the slider outlived its menu')
  assert.equal(menu.effortRow.style.height, '', 'the row kept the slider’s own height')
  stub.unmount()
})

test('DeepSeek ocean theme fill and value colors follow the abyssal cyan palette', () => {
  const {
    fillColorFor,
    fillBackgroundFor,
    valueColorFor,
    COLOR_DEEPSEEK_BASE,
    COLOR_DEEPSEEK_CYAN,
    COLOR_DEEPSEEK_ABYSS,
    COLOR_DEEPSEEK_TEXT,
    ENERGY_START,
    ENERGY_END,
  } = internals
  const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`

  assert.equal(fillColorFor(0, 'deepseek'), rgb(COLOR_DEEPSEEK_BASE))
  assert.equal(fillColorFor(ENERGY_START, 'deepseek'), rgb(COLOR_DEEPSEEK_BASE))
  assert.equal(fillColorFor(ENERGY_END, 'deepseek'), rgb(COLOR_DEEPSEEK_CYAN))
  assert.equal(fillColorFor(1, 'deepseek'), rgb(COLOR_DEEPSEEK_ABYSS))
  assert.equal(fillBackgroundFor(0, 'deepseek'), `linear-gradient(90deg, rgb(14,165,233), rgb(14,165,233))`)

  assert.equal(valueColorFor(0, LEVELS[1], 'deepseek'), rgb(COLOR_DEEPSEEK_BASE))
  assert.equal(valueColorFor(1, LEVELS[3], 'deepseek'), rgb(COLOR_DEEPSEEK_TEXT))
  assert.equal(valueColorFor(1, LEVELS[0], 'deepseek'), '', 'off level clears color')
})

test('Gemini quad-color theme fill and value colors follow the Google signature palette', () => {
  const {
    fillColorFor,
    fillBackgroundFor,
    valueColorFor,
    COLOR_GEMINI_BASE,
    COLOR_GEMINI_YELLOW,
    COLOR_GEMINI_RED,
    COLOR_GEMINI_TEXT,
    ENERGY_START,
    ENERGY_END,
  } = internals
  const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`

  assert.equal(fillColorFor(0, 'gemini'), rgb(COLOR_GEMINI_BASE))
  assert.equal(fillColorFor(ENERGY_START, 'gemini'), rgb(COLOR_GEMINI_BASE))
  assert.equal(fillColorFor(ENERGY_END, 'gemini'), rgb(COLOR_GEMINI_YELLOW))
  assert.equal(fillColorFor(1, 'gemini'), rgb(COLOR_GEMINI_RED))
  assert.equal(fillBackgroundFor(0, 'gemini'), `linear-gradient(90deg, rgb(66,133,244), rgb(66,133,244))`)

  assert.equal(valueColorFor(0, LEVELS[1], 'gemini'), rgb(COLOR_GEMINI_BASE))
  assert.equal(valueColorFor(1, LEVELS[3], 'gemini'), rgb(COLOR_GEMINI_TEXT))
  assert.equal(valueColorFor(1, LEVELS[0], 'gemini'), '', 'off level clears color')
})

test('Claude terracotta theme fill and value colors deepen from the spark orange through Crail', () => {
  const {
    fillColorFor,
    fillBackgroundFor,
    valueColorFor,
    COLOR_CLAUDE_CLAY,
    COLOR_CLAUDE_BASE,
    COLOR_CLAUDE_CRAIL,
    COLOR_CLAUDE_EMBER,
    COLOR_CLAUDE_TEXT,
    ENERGY_START,
    ENERGY_END,
  } = internals
  const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`

  assert.equal(fillColorFor(0, 'claude'), rgb(COLOR_CLAUDE_BASE))
  assert.equal(fillColorFor(ENERGY_START, 'claude'), rgb(COLOR_CLAUDE_BASE))
  assert.equal(fillColorFor(ENERGY_END, 'claude'), rgb(COLOR_CLAUDE_CRAIL))
  assert.equal(fillColorFor(1, 'claude'), rgb(COLOR_CLAUDE_EMBER))
  // The gradient's left end is the wet clay the Claude track is made of, and its right end is the
  // position's own colour, so the fill and the knob can never disagree about where the knob is.
  assert.equal(fillBackgroundFor(0, 'claude'),
    `linear-gradient(90deg, ${rgb(COLOR_CLAUDE_CLAY)}, ${rgb(COLOR_CLAUDE_BASE)})`)
  assert.equal(fillBackgroundFor(1, 'claude'),
    `linear-gradient(90deg, ${rgb(COLOR_CLAUDE_CLAY)}, ${rgb(COLOR_CLAUDE_EMBER)})`)

  assert.equal(valueColorFor(0, LEVELS[1], 'claude'), rgb(COLOR_CLAUDE_BASE))
  assert.equal(valueColorFor(1, LEVELS[3], 'claude'), rgb(COLOR_CLAUDE_TEXT))
  assert.equal(valueColorFor(1, LEVELS[0], 'claude'), '', 'off level clears color')
})

test('Crail stands in for the text violet, so the Claude value text reads exactly as well', () => {
  const { COLOR_BLUE, COLOR_CLAUDE_BASE, COLOR_CLAUDE_TEXT, COLOR_TEXT_VIOLET } = internals
  // WCAG relative luminance: contrast against any surface is a function of it alone, so equal
  // luminance means the same ratio on white and on the dark chrome alike.
  const channel = (value) => {
    const c = value / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  assert.ok(Math.abs(luminance(COLOR_CLAUDE_TEXT) - luminance(COLOR_TEXT_VIOLET)) < 0.001,
    'the Claude text end is not as readable as the violet it stands in for')
  assert.ok(Math.abs(luminance(COLOR_CLAUDE_BASE) - luminance(COLOR_BLUE)) < 0.01,
    'the Claude orange is not as readable as the blue it stands in for')
})

test('the Claude spark is twelve rays from one hub, every cap inside its own box', () => {
  const { CLAUDE_SPARK, CLAUDE_SPARK_RAYS, EFFORT_CSS, claudeRayOpenness } = internals
  // The table is the spark: one `[bearing clockwise from twelve o'clock, length]` per ray, and the
  // constant is that table already turned into the points the markup writes, so a render never
  // re-derives a coordinate.
  assert.equal(CLAUDE_SPARK_RAYS.length, 12)
  assert.equal(CLAUDE_SPARK.length, 12)
  // The sheet's own stroke, read back rather than restated: a round cap reaches half a stroke past
  // its ray's end, and the box the spark is drawn in is 24 units across, centred on the hub.
  const stroke = /\.ces-claude-ray \{ [^}]*stroke-width: ([\d.]+)px/u.exec(EFFORT_CSS)
  assert.ok(stroke !== null, 'the spark has no stroke of its own for its caps to be cut by')
  for (const [index, [degrees, length]] of CLAUDE_SPARK_RAYS.entries()) {
    const ray = CLAUDE_SPARK[index]
    const radians = (degrees * Math.PI) / 180
    assert.equal(ray.x, Math.round(Math.sin(radians) * length * 100) / 100, `ray ${index} points off its bearing`)
    assert.equal(ray.y, Math.round(-Math.cos(radians) * length * 100) / 100, `ray ${index} points off its bearing`)
    assert.ok(Math.hypot(ray.x, ray.y) + Number(stroke[1]) / 2 <= 12, `a ray's cap is cut by the box: ${ray.x} ${ray.y}`)
  }
  // Twelve o'clock is straight up, which in SVG's coordinates is negative y.
  assert.equal(CLAUDE_SPARK[0].x, 0)
  assert.ok(CLAUDE_SPARK[0].y < 0, 'the first ray does not stand straight up')
  // The spark is one constant the stylesheet scales: bare on the seed at the start of the track,
  // and every ray open by its end.
  for (const ray of CLAUDE_SPARK) {
    assert.equal(claudeRayOpenness(0, ray.opensAt), 0, 'a ray is already open on the seed')
    assert.equal(claudeRayOpenness(1, ray.opensAt), 1, 'a ray is still shut at the top of the track')
  }
})

test('slider theme setting normalizes, persists, and notifies', () => {
  const {
    normalizeEffortTheme,
    readSavedEffortTheme,
    writeSavedEffortTheme,
    EFFORT_THEME_KEY,
  } = internals

  assert.equal(normalizeEffortTheme('unknown'), 'codex')
  assert.equal(normalizeEffortTheme('deepseek'), 'deepseek')
  assert.equal(normalizeEffortTheme('gemini'), 'gemini')
  assert.equal(normalizeEffortTheme('claude'), 'claude')
  assert.equal(normalizeEffortTheme('codex'), 'codex')

  writeSavedEffortTheme('claude')
  assert.equal(readSavedEffortTheme(), 'claude')
  assert.equal(win.localStorage.getItem(EFFORT_THEME_KEY), 'claude')

  writeSavedEffortTheme('gemini')
  assert.equal(readSavedEffortTheme(), 'gemini')
  assert.equal(win.localStorage.getItem(EFFORT_THEME_KEY), 'gemini')

  writeSavedEffortTheme('deepseek')
  assert.equal(readSavedEffortTheme(), 'deepseek')
  assert.equal(win.localStorage.getItem(EFFORT_THEME_KEY), 'deepseek')

  writeSavedEffortTheme('codex')
  assert.equal(readSavedEffortTheme(), 'codex')
  assert.equal(win.localStorage.getItem(EFFORT_THEME_KEY), 'codex')
})

test('DeepSeek theme renders swimming whale and deep-sea styling', async () => {
  const { menu, stub } = mountControl({ effort: 'high', theme: 'deepseek' })
  await tick()

  assert.equal(stub.find('root').getAttribute('data-theme'), 'deepseek')
  assert.ok(stub.find('whale-track') !== null, 'the whale track layer is mounted')
  assert.ok(stub.find('whale') !== null, 'the whale element is rendered')
  assert.match(menu.effortRow.style.boxShadow, /^inset 0 0 0 1px rgba\(56,189,248,/u)
  stub.unmount()
})

test('Gemini theme renders sparkle constellation and aurora styling', async () => {
  const { menu, stub } = mountControl({ effort: 'high', theme: 'gemini' })
  await tick()

  assert.equal(stub.find('root').getAttribute('data-theme'), 'gemini')
  assert.ok(stub.find('gemini-track') !== null, 'the gemini track layer is mounted')
  assert.ok(stub.find('gemini-sparkle') !== null, 'the gemini sparkle element is rendered')
  assert.match(menu.effortRow.style.boxShadow, /^inset 0 0 0 1px rgba\(66,133,244,/u)
  stub.unmount()
})

test('Claude theme carries its spark on the knob and edges the row in terracotta', async () => {
  const { menu, stub } = mountControl({ effort: 'high', theme: 'claude' })
  await tick()

  assert.equal(stub.find('root').getAttribute('data-theme'), 'claude')
  const spark = stub.find('claude-spark')
  assert.ok(spark !== null, 'the Claude spark is not rendered')
  // The spark rides the knob rather than a track of its own, so it is wherever the effort is.
  assert.equal(spark.parentNode, stub.find('knob'), 'the spark is not on the knob')
  assert.equal(spark.getAttribute('aria-hidden'), 'true', 'the spark is decoration and must say so')
  // The spark the knob carries is the constant, ray for ray: twelve lines out of the hub, the seed
  // on that hub, and nothing else drawn in the box.
  const svg = stub.find('claude-seed').parentNode
  assert.equal(svg.getAttribute('viewBox'), '-12 -12 24 24', 'the spark is not drawn in the box the rays are sized for')
  const rays = stub.findAll('claude-ray')
  assert.equal(rays.length, 12, 'the knob does not carry the twelve-ray spark')
  assert.ok(rays.every((ray) => ray.getAttribute('x1') === '0' && ray.getAttribute('y1') === '0'),
    'a ray does not start at the hub')
  assert.deepEqual(
    rays.map((ray) => [ray.getAttribute('x2'), ray.getAttribute('y2')]),
    internals.CLAUDE_SPARK.map((ray) => [String(ray.x), String(ray.y)]),
    'the knob draws a spark the theme does not define',
  )
  assert.equal(svg.children.length, rays.length + 1, 'the spark draws something besides its rays and the seed on its hub')
  // A level with thinking behind it keeps its spark turning, and the sheet parks the spark on the
  // off level alone, so the attribute that rule reads has to be there.
  assert.equal(stub.find('root').getAttribute('data-off'), '0', 'a level that thinks reads as off')
  assert.equal(stub.find('whale-track'), null, 'whale track should not be present in claude mode')
  assert.equal(stub.find('gemini-track'), null, 'gemini track should not be present in claude mode')
  assert.match(menu.effortRow.style.boxShadow, /^inset 0 0 0 1px rgba\(217,119,87,/u)
  assert.equal(menu.effortValue.style.color, internals.valueColorFor(2 / 3, LEVELS[2], 'claude'))
  stub.unmount()

  // The other end of that same attribute: on Off there is nothing to think about, so the sheet
  // parks the spark this control drew.
  const off = mountControl({ effort: 'off', theme: 'claude' })
  await tick()
  assert.equal(off.stub.find('root').getAttribute('data-off'), '1', 'the off level leaves the spark turning')
  off.stub.unmount()
})

test('Codex theme does not render whale track, gemini track or the Claude spark', async () => {
  const { menu, stub } = mountControl({ effort: 'high', theme: 'codex' })
  await tick()

  assert.equal(stub.find('root').getAttribute('data-theme'), 'codex')
  assert.equal(stub.find('whale-track'), null, 'whale track should not be present in codex mode')
  assert.equal(stub.find('gemini-track'), null, 'gemini track should not be present in codex mode')
  assert.equal(stub.find('claude-spark'), null, 'the Claude spark should not be present in codex mode')
  assert.match(menu.effortRow.style.boxShadow, /^inset 0 0 0 1px rgba\(168,85,247,/u)
  stub.unmount()
})

test('the Claude spark blooms by the stop that shows it: six rays, then nine, then all twelve', () => {
  const { CLAUDE_BLOOM_FLOOR, CLAUDE_SPARK, CLAUDE_SPARK_RAYS, claudeBloomFor, claudeBloomStepFor, claudeRayOpenness } = internals
  const count = (bloom, test) => CLAUDE_SPARK.filter((ray) => test(claudeRayOpenness(bloom, ray.opensAt))).length
  // Each group is whole by its own stop and the next has not begun, so a level never shows a
  // spark caught halfway through unfurling.
  for (const [bloom, rays] of [[0, 0], [1 / 3, 6], [2 / 3, 9], [1, 12]]) {
    assert.equal(count(bloom, (open) => open === 1), rays, `the spark at ${bloom.toFixed(2)} is not ${rays} rays`)
    assert.equal(count(bloom, (open) => open > 0 && open < 1), 0, `the spark at ${bloom.toFixed(2)} is caught mid-unfurl`)
  }
  // The six that open first are the six long rays: the first spark is an asterisk, never a + or
  // a × — which on a knob would read as "add" or "close".
  const first = CLAUDE_SPARK_RAYS.filter((_, index) => claudeRayOpenness(1 / 3, CLAUDE_SPARK[index].opensAt) === 1)
  const rest = CLAUDE_SPARK_RAYS.filter((_, index) => claudeRayOpenness(1 / 3, CLAUDE_SPARK[index].opensAt) === 0)
  assert.ok(Math.min(...first.map(([, length]) => length)) > Math.max(...rest.map(([, length]) => length)),
    'the first rays to open are not the long ones')
  // An off level keeps the seed wherever it sits; a level that reasons never shows less than the
  // first group, wherever its ladder puts it — a ladder that starts at "low" puts it at 0.
  assert.equal(claudeBloomFor(0, LEVELS[0]), 0)
  assert.equal(claudeBloomFor(1, LEVELS[0]), 0, 'an off level opened its spark')
  assert.equal(claudeBloomFor(0, { id: 'low', name: 'Low' }), CLAUDE_BLOOM_FLOOR, 'a level that reasons reads as off')
  assert.equal(claudeBloomFor(2 / 3, LEVELS[2]), 2 / 3)
  assert.equal(claudeBloomFor(1, null), 0, 'no level at all opened the spark')
  // The stops are inked with the spark the knob will be standing there.
  assert.deepEqual(LEVELS.map((level, index) => claudeBloomStepFor(index / 3, level)), [0, 1, 2, 3])
})

test('ultrathink is the top of the ladder, and the clay says calm words, deep words or the magic word', () => {
  const { CLAUDE_VERBS, claudeUltraFor, claudeVerbSetFor } = internals
  assert.equal(claudeUltraFor(3, 4, LEVELS[3]), true)
  assert.equal(claudeUltraFor(2, 4, LEVELS[2]), false)
  assert.equal(claudeUltraFor(0, 1, { id: 'on', name: 'On' }), false, 'a ladder of one has no top to reach')
  assert.equal(claudeUltraFor(1, 2, { id: 'none', name: 'None' }), false, 'an off level was taken for ultrathink')
  assert.equal(claudeVerbSetFor(0, LEVELS[0], false), null, 'an off level is thinking out loud')
  assert.equal(claudeVerbSetFor(1 / 3, LEVELS[1], false), 'calm')
  assert.equal(claudeVerbSetFor(2 / 3, LEVELS[2], false), 'deep')
  assert.equal(claudeVerbSetFor(1, LEVELS[3], true), 'ultra')
  assert.deepEqual(CLAUDE_VERBS.ultra, ['ultrathink'])
  // Claude Code's words, as the CLI spells them: capitalised, and ended with its one-character
  // ellipsis rather than three dots.
  for (const word of [...CLAUDE_VERBS.calm, ...CLAUDE_VERBS.deep]) assert.match(word, /^[A-Z][a-z]+ing…$/u)
})

test('Claude renders the bloom, the inked stops and the words the position calls for', async () => {
  const bloomsOf = (stub) => stub.findAll('tick').map((tick) => tick.getAttribute('data-bloom'))
  const wordsOf = (stub) => stub.findAll('claude-verb').map((word) => word.textContent)

  // Off: the seed alone, nothing said, and every stop ahead inked with what it will open into.
  let mounted = mountControl({ effort: 'off', theme: 'claude' })
  await tick()
  let root = mounted.stub.find('root')
  assert.equal(root.getAttribute('data-ultra'), '0')
  assert.equal(root.style['--ces-bloom'], '0.000')
  assert.equal(mounted.stub.find('claude-verbs'), null, 'an off level is thinking out loud')
  assert.deepEqual(bloomsOf(mounted.stub), ['0', '1', '2', '3'])
  mounted.stub.unmount()

  // High: nine rays and the deep words, all three of them taking turns.
  mounted = mountControl({ effort: 'high', theme: 'claude' })
  await tick()
  root = mounted.stub.find('root')
  assert.equal(root.style['--ces-bloom'], (2 / 3).toFixed(3))
  assert.equal(root.getAttribute('data-ultra'), '0')
  assert.equal(mounted.stub.find('claude-verbs').getAttribute('data-set'), 'deep')
  assert.deepEqual(wordsOf(mounted.stub), [...internals.CLAUDE_VERBS.deep])
  // The words end a knob's radius and a gap short of the knob's centre, wherever that is.
  assert.equal(mounted.stub.find('claude-verbs').style.width,
    `calc(${internals.knobOffsetOf(2 / 3)} - ${internals.KNOB_RADIUS + internals.CLAUDE_VERB_GAP}px)`)
  mounted.stub.unmount()

  // Max: ultrathink — the whole spark, and the one word.
  mounted = mountControl({ effort: 'max', theme: 'claude' })
  await tick()
  root = mounted.stub.find('root')
  assert.equal(root.getAttribute('data-ultra'), '1')
  assert.equal(root.style['--ces-bloom'], '1.000')
  assert.deepEqual(wordsOf(mounted.stub), ['ultrathink'])
  assert.match(mounted.stub.find('claude-verb').getAttribute('class'), /\bces-claude-verb--ultra\b/u)
  mounted.stub.unmount()
})

test('a held Claude knob lifts, and only while it is held', async () => {
  const { stub } = mountControl({ effort: 'high', theme: 'claude' })
  await tick()
  assert.equal(stub.find('root').getAttribute('data-dragging'), '0')
  stub.find('track').fire('onPointerDown', { clientX: 186 })
  await tick()
  assert.equal(stub.find('root').getAttribute('data-dragging'), '1', 'the knob does not lift under the finger')
  // The drag already stands on the top level, and ultrathink follows the hand, not the store.
  assert.equal(stub.find('root').getAttribute('data-ultra'), '1')
  stub.find('track').fire('onPointerUp', {})
  await tick()
  assert.equal(stub.find('root').getAttribute('data-dragging'), '0', 'the knob stays lifted after the release')
  stub.unmount()
})

test('the Claude sheet is written from the theme’s own numbers', () => {
  const { CLAUDE_RAINBOW, CLAUDE_RAY_UNFURL, CLAUDE_VERB_ROOM, EFFORT_CSS, claudeSparkPolygon } = internals
  // A ray opens by the same arithmetic as claudeRayOpenness, so the stylesheet and the schedule
  // pinned above cannot drift apart.
  assert.ok(EFFORT_CSS.includes(`(var(--ces-bloom, 0) - var(--ces-ray-opens, 0)) / ${CLAUDE_RAY_UNFURL}`),
    'the rays open by a different unfurl than the schedule')
  // A set waits for room for its widest word rather than showing its tail.
  assert.ok(/\.ces-claude-verbs \{[^}]*container-type: inline-size/u.test(EFFORT_CSS), 'the words box is not its own container')
  for (const [set, room] of Object.entries(CLAUDE_VERB_ROOM)) {
    assert.ok(EFFORT_CSS.includes(`@container (width < ${room}px) { .ces-claude-verbs[data-set='${set}'] .ces-claude-verb { visibility: hidden; } }`),
      `the ${set} words have no room rule`)
  }
  // The background shorthand resets the clip, so a background with no clip after it paints a
  // rainbow rectangle instead of a rainbow word.
  const ultra = /\.ces-claude-verb--ultra \{([^}]*)\}/u.exec(EFFORT_CSS)?.[1] ?? ''
  assert.ok(ultra.lastIndexOf('background-clip: text') > ultra.indexOf('background:'), `ultrathink is clipped before its background: ${ultra}`)
  // Every stop ahead is inked with the knob's own spark at that stop.
  for (const step of [1, 2, 3]) {
    assert.ok(EFFORT_CSS.includes(`.ces-tick[data-bloom='${step}'] {`) && EFFORT_CSS.includes(claudeSparkPolygon(15, step)),
      `stop ${step} is not inked with the spark it will show`)
  }
  // ultrathink colours the rays round the same rainbow the word flows through.
  for (const [k, color] of CLAUDE_RAINBOW.entries()) {
    assert.ok(EFFORT_CSS.includes(`.ces-claude-ray:nth-of-type(${CLAUDE_RAINBOW.length}n+${k + 1}) { stroke: ${color}; }`), `no ray takes ${color}`)
  }
  // Reaching it fires the flare once, not on a loop.
  assert.ok(/\[data-ultra='1'\] \.ces-knob::after \{ animation: ces-claude-flare [^;]* 1; \}/u.test(EFFORT_CSS), 'the flare does not fire exactly once')
})

test('no theme hides its own part through the bridge’s host', async () => {
  // The host the bridge hangs in the shell's row is a .ces-inline as well, and it carries no
  // theme: the root inside it does. So a bare `.ces-inline:not([data-theme=…]) .part` matches
  // through the host under every theme, its own included, and the part never shows in the shell
  // — while a suite that renders without the host, or without CSS, sees nothing wrong.
  const { stub, menu } = mountControl({ effort: 'high', theme: 'claude' })
  await tick()
  const host = menu.effortRow.querySelector('[data-ces-part="host"]')
  assert.ok(host !== null && host.className === 'ces-inline', 'the host is no longer a .ces-inline; this guard can be revisited')
  assert.equal(host.getAttribute('data-theme'), null)
  stub.unmount()
  const throughHost = internals.EFFORT_CSS.replace(/\/\*[\s\S]*?\*\//gu, '').match(/\.ces-inline:not\(\[data-theme[^\]]*\]\)\s+[^{]+/gu) ?? []
  assert.deepEqual(throughHost, [], 'a rule hides a theme part through the theme-less host')
})
