/*
 * The restored injected-context rows.
 *
 * The feature is a contract with two of the shell's own services — the conversation's
 * Definition registry and the Chat view's node slot — so this suite drives it the way the
 * shell does rather than through the plugin's private helpers alone: a registry that keeps
 * the Definitions it is given, a slot service that hands the CLI the entry it registered,
 * and the durable event shapes the harness writes to a session log. What the shell would
 * see is what these tests pin.
 *
 * Two invariants matter more than the rest, and each has its own section below:
 *
 *  - **Off is the shipped behaviour.** With the choice off, no Definition is registered at
 *    all, so the transcript is the shell's own; the renderer may sit unused in the slot
 *    because a key nothing produces never renders.
 *  - **The hidden rows stay hidden.** A waking message is drawn by the shell as its own
 *    trigger row, and the plugin's node for it must carry `visibility: 'hidden'`, which is
 *    the same flag the shell's `isVisibleChatNode` filters on.
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { boot, definition, storage } from './harness.mjs'

/** The client's own store key; asserted against `internals` below, never trusted alone. */
const KEY = 'dsh-custom-theme.injections'
/** The plugin's locale namespace, as its nav row registers it. */
const NAMESPACE = 'dshCustomTheme'

/* ═══════════════════════════ The doubles ═══════════════════════════ */

/**
 * A React double with the two hooks the row uses.
 *
 * `mount` renders once and re-renders whenever the row's own `setState` runs, which is what
 * makes the disclosure testable: the body is absent until the head is clicked.
 */
function createReactStub() {
  const stub = {
    hooks: [],
    cursor: 0,
    tree: null,
    createElement: (type, props, ...children) => ({
      type,
      props: props ?? {},
      children: children.filter((child) => child !== null && child !== undefined && child !== false),
    }),
    Fragment: 'Fragment',
    // The page's other rows lean on these; the row under test uses only the first, but the
    // settings component is rendered whole, so the double has to carry the whole set.
    useEffect: () => {},
    useMemo: (factory) => factory(),
    useCallback: (callback) => callback,
    useRef: (initial) => ({ current: initial ?? null }),
    useSyncExternalStore: (subscribe, getSnapshot) => getSnapshot(),
    useState(initial) {
      const index = stub.cursor
      stub.cursor += 1
      if (stub.hooks[index] === undefined) stub.hooks[index] = { value: typeof initial === 'function' ? initial() : initial }
      const slot = stub.hooks[index]
      return [slot.value, (next) => {
        slot.value = typeof next === 'function' ? next(slot.value) : next
        stub.draw()
      }]
    },
    mount(component, props) {
      stub.hooks = []
      stub.component = component
      stub.props = props
      stub.draw()
      return stub
    },
    draw() {
      stub.cursor = 0
      stub.tree = stub.component(stub.props)
    },
    /** Click the row's head, the way a reader opens the injected text. */
    click() {
      const head = findNode(stub.tree, (node) => node.props?.className === 'dct-inj-head')
      assert.ok(head !== null, 'the row has no disclosure head')
      head.props.onClick()
      return stub
    },
  }
  return stub
}

/** Depth-first search for the first node a predicate accepts. */
function findNode(node, predicate) {
  if (node === null || node === undefined || typeof node !== 'object') return null
  if (predicate(node)) return node
  for (const child of node.children ?? []) {
    const found = findNode(child, predicate)
    if (found !== null) return found
  }
  return null
}

/** The text a rendered element carries, concatenated. */
function textOf(node) {
  if (typeof node === 'string') return node
  if (node === null || node === undefined || typeof node !== 'object') return ''
  return (node.children ?? []).map(textOf).join('')
}

/** A Definition registry, as `uiConversation.events` presents one. */
function createRegistry() {
  const definitions = []
  return {
    definitions,
    register(definition) {
      definitions.push(definition)
      return () => {
        const index = definitions.indexOf(definition)
        if (index >= 0) definitions.splice(index, 1)
      }
    },
  }
}

/**
 * A slot service.
 *
 * `inject` records a registration request the way the shell's deferred injection does;
 * `declare` is the shell later announcing the slot, which is what runs those requests. The
 * shell's own declaration is not observable from here, so the test declares it by name.
 */
function createSlots() {
  const entries = []
  const waiting = []
  return {
    entries,
    inject(name, callback) {
      waiting.push({ name, callback })
    },
    register(options, component) {
      entries.push({ options, component })
      return () => {}
    },
    declare(name) {
      for (const entry of waiting.splice(0)) {
        if (entry.name === name) entry.callback()
      }
    },
  }
}

/**
 * A plugin context: the services the browser half declares, plus the nested injection it
 * asks for. `scope` is what a nested `ctx.inject` is answered with, so a test can answer it
 * with a shell that has the conversation seam and one that does not.
 */
function createContext({ scope, slots }) {
  const warnings = []
  const services = []
  const effects = []
  const dictionaries = new Map()
  const ctx = {
    logger: { warn: (...args) => warnings.push(args.map((value) => String(value)).join(' ')) },
    effect(factory) {
      const dispose = factory()
      if (typeof dispose === 'function') effects.push(dispose)
    },
    on: () => () => {},
    inject(names, callback) {
      services.push(names)
      callback(scope)
    },
    theme: {
      getTheme: () => ({ preference: 'system', fontSize: 14, active: { colorScheme: 'dark' } }),
      setTheme() {},
      setFontSize() {},
      overrideTokens: () => () => {},
    },
    slots,
    locale: {
      bind: (namespace) => (key) => dictionaries.get(namespace)?.zh?.[key] ?? key,
      register(namespace, localeOrDicts, dict) {
        const pairs = typeof localeOrDicts === 'string' ? [[localeOrDicts, dict]] : Object.entries(localeOrDicts)
        const target = dictionaries.get(namespace) ?? {}
        for (const [locale, entries] of pairs) target[locale] = entries
        dictionaries.set(namespace, target)
        return () => {}
      },
    },
  }
  return { ctx, warnings, services, effects, dictionaries }
}

/* ═══════════════════════════ The fixtures ═══════════════════════════ */

/** One injected `user/message`, as the harness logs a skill's instructions. */
function injectedMessage(overrides = {}) {
  return {
    seq: 12,
    time: '2026-10-07T01:30:00.000Z',
    type: 'user/message',
    surfaceOp: 'append',
    data: {
      id: 'inj-1',
      source: { kind: 'skill-invocation', name: 'dsh-custom-theme-release' },
      content: [{ type: 'text', text: 'Read the skill.\nThen cut the release.' }],
    },
    ...overrides,
  }
}

/** One injected `developer/message`, as the harness logs the workspace rules. */
function developerMessage(overrides = {}) {
  return {
    seq: 4,
    time: '2026-10-07T01:00:00.000Z',
    type: 'developer/message',
    data: {
      message: {
        id: 'dev-1',
        source: { kind: 'agent-instructions', form: 'instructions', changes: [{ path: '/a.md' }, { path: '/a.md' }, { path: '/b.md' }] },
        content: [{ type: 'text', text: 'Follow the workspace rules.' }],
      },
    },
    ...overrides,
  }
}

/** A reader that answers the two inbox Definitions the waking test reads. */
function createReader(states = {}) {
  return {
    previous: (kind) => (states[kind] === undefined ? undefined : { key: kind, kind, id: kind, state: states[kind] }),
  }
}

/* ═══════════════════════════ The harness ═══════════════════════════ */

/** Materialize the browser half; each call is a fresh plugin with fresh module state. */
function materialize() {
  const react = createReactStub()
  const plugin = definition.factory((id) => {
    if (id === 'react') return react
    if (id === 'react-dom') return { createPortal: (children) => children }
    if (id === '@deepseek-ai/dsh-client-ui-primitives') return {}
    throw new Error(`unexpected require: ${id}`)
  })
  return { plugin, internals: plugin.__internals, react }
}

/** Materialize one plugin and run its `apply` against a context, as the page does. */
function applyPlugin(scope = {}) {
  const materialized = materialize()
  const slots = scope.slots ?? createSlots()
  const context = createContext({ scope: { ...scope, slots }, slots })
  materialized.plugin.apply(context.ctx)
  return { ...materialized, ...context, slots }
}

/**
 * Drive the Definition the way the engine does: `match` reads the definition's own result,
 * and the match the Definition then sees is the engine's `{ event, role, location }` record,
 * not that result (see `conversationMatch` in the conversation engine).
 */
function buildNode(internals, event, { location = { kind: 'unresolved' }, reader = createReader() } = {}) {
  const matched = internals.injectionDefinition.match(event)
  assert.notEqual(matched, null, 'the event should have matched the injection Definition')
  const match = { event, role: matched.role, location }
  const state = internals.injectionDefinition.start({ matches: [match] }, match, reader)
  const context = {
    key: `chat:${internals.INJECTION_KIND}:${matched.id}`,
    kind: internals.INJECTION_KIND,
    id: matched.id,
    matches: [match],
    start: match,
    state,
  }
  return { match: matched, state, context, node: internals.injectionDefinition.buildViewNode(context) }
}

/* ═══════════════════════ What the plugin declares ═══════════════════════ */

test('the injected-row switch is stored under one key and starts off', () => {
  const { internals } = materialize()
  assert.equal(internals.INJECTIONS_KEY, KEY)
  storage.entries.delete(KEY)
  assert.deepEqual(internals.readSavedInjections(), { show: false })
  internals.writeSavedInjections({ show: true })
  assert.equal(storage.entries.get(KEY), '{"show":true}')
  assert.deepEqual(internals.readSavedInjections(), { show: true })
})

test('only a literal true turns the rows on, and a broken entry leaves them off', () => {
  const { internals } = materialize()
  for (const raw of ['not json at all', 'null', '[]', '{"show":1}', '{"show":"yes"}', '{}']) {
    storage.entries.set(KEY, raw)
    assert.deepEqual(internals.readSavedInjections(), { show: false }, `"${raw}" should not turn the rows on`)
  }
  storage.entries.set(KEY, JSON.stringify({ show: true, extra: 'ignored' }))
  assert.deepEqual(internals.readSavedInjections(), { show: true })
  storage.entries.delete(KEY)
})

test('the switch carries a label, a hint and both locales', () => {
  const slots = createSlots()
  const registry = createRegistry()
  const { dictionaries } = applyPlugin({ slots, uiConversation: { events: registry } })
  const dictionary = dictionaries.get(NAMESPACE)
  assert.ok(dictionary !== undefined, 'the plugin registered no dictionary')
  for (const locale of ['zh', 'en']) {
    for (const key of ['injSettingTitle', 'injHint', 'injShow', 'injFollow', 'injTitle', 'injRecall', 'injEmpty', 'injUnavailable']) {
      assert.equal(typeof dictionary[locale]?.[key], 'string', `the ${locale} dictionary has no ${key}`)
    }
  }
  // The row must never draw a raw key: its fallback path is the shell's, and the note for a
  // shell without the seam has to exist in the shipped wording too.
  assert.match(dictionary.zh.injTitle, /上下文注入/u)
  assert.match(dictionary.zh.injEmpty, /无文本/u)
})

test('the row is drawn through the Chat node slot under the plugin’s own key', () => {
  const slots = createSlots()
  const registry = createRegistry()
  const { internals } = applyPlugin({ slots, uiConversation: { events: registry } })
  slots.declare(internals.INJECTION_NODE_SLOT)
  assert.equal(slots.entries.length, 1, 'the renderer was not registered')
  const [entry] = slots.entries
  assert.equal(entry.options.name, 'conversation.chat.node')
  assert.equal(entry.options.key, internals.INJECTION_KIND)
  assert.equal(entry.options.locale, NAMESPACE)
  // The shell dispatches by key, so a second entry for the same key would be rejected as an
  // occupant: this one has to be the plugin's own kind and nothing the shell already draws.
  assert.ok(!['user', 'context', 'assistant-step', 'turn-trigger'].includes(entry.options.key))
  assert.equal(entry.component, internals.InjectionNodeView)
})

/* ═════════════════ Off is the shipped transcript, on is the restored one ═════════════════ */

test('with the switch off no Definition reaches the shell', () => {
  storage.entries.delete(KEY)
  const slots = createSlots()
  const registry = createRegistry()
  const { internals } = applyPlugin({ slots, uiConversation: { events: registry } })
  assert.equal(registry.definitions.length, 0, 'the switch was off and a Definition was still registered')
  assert.equal(internals.injectionSeamOf(), 'ready')
  // The renderer is registered either way; a key nothing produces never renders.
  slots.declare(internals.INJECTION_NODE_SLOT)
  assert.equal(slots.entries.length, 1)
})

test('with the switch on the Definition is registered, and toggling disposes it', () => {
  storage.entries.set(KEY, JSON.stringify({ show: true }))
  const slots = createSlots()
  const registry = createRegistry()
  const { internals, effects } = applyPlugin({ slots, uiConversation: { events: registry } })
  assert.equal(registry.definitions.length, 1)
  assert.equal(registry.definitions[0], internals.injectionDefinition)

  internals.setInjectionSettings({ show: false })
  assert.equal(registry.definitions.length, 0, 'turning the switch off left the Definition registered')
  assert.equal(storage.entries.get(KEY), '{"show":false}')

  internals.setInjectionSettings({ show: true })
  assert.equal(registry.definitions.length, 1, 'turning the switch back on did not register the Definition again')
  assert.equal(storage.entries.get(KEY), '{"show":true}')

  // Unloading the plugin is the other way the Definition goes away, and it must not throw
  // when the switch already took it away.
  for (const dispose of effects) dispose()
  assert.equal(registry.definitions.length, 0)
  assert.equal(internals.injectionSeamOf(), 'unknown')
  storage.entries.delete(KEY)
})

test('a registry that refuses the Definition is reported and retried', () => {
  storage.entries.set(KEY, JSON.stringify({ show: true }))
  let refuse = true
  const definitions = []
  const conversation = {
    events: {
      register(definition) {
        if (refuse) throw new Error('the registry is not ready')
        definitions.push(definition)
        return () => {}
      },
    },
  }
  const { internals, warnings } = applyPlugin({ slots: createSlots(), uiConversation: conversation })
  assert.equal(definitions.length, 0)
  assert.equal(warnings.length, 1, `the refusal was not reported: ${JSON.stringify(warnings)}`)
  assert.match(warnings[0], /injected-context rows could not be registered/u)
  assert.match(warnings[0], /the registry is not ready/u)
  // The switch stays usable: the next transition tries again, and by then it works.
  refuse = false
  internals.setInjectionSettings({ show: false })
  internals.setInjectionSettings({ show: true })
  assert.equal(definitions.length, 1, 'the retry never reached the registry')
  storage.entries.delete(KEY)
})

test('a shell without the conversation seam keeps everything else', () => {
  storage.entries.set(KEY, JSON.stringify({ show: true }))
  const { internals, warnings, services } = applyPlugin({ slots: createSlots() })
  assert.deepEqual(services, [['slots', 'modelDirectories'], ['slots', 'uiConversation']])
  assert.equal(internals.injectionSeamOf(), 'absent')
  // A missing service is a supported shell, not a failure: the row explains itself in the
  // page instead, and nothing is logged for a build that simply predates the seam.
  assert.deepEqual(warnings, [])
  storage.entries.delete(KEY)
})

/* ═══════════════════════ What the Definition classifies ═══════════════════════ */

test('the Definition matches the injections the shell logs and nothing else', () => {
  const { internals } = materialize()
  const { match } = internals.injectionDefinition

  assert.deepEqual(match(injectedMessage()), { id: 'inj-1', role: 'start' })
  assert.deepEqual(match(developerMessage()), { id: 'dev-1', role: 'start' })

  // A human message, a steering message and a waking trigger all belong to the shell: it
  // draws them itself, so the plugin must not draw a second row for them.
  assert.equal(match(injectedMessage({ data: { id: 'u-1', source: { kind: 'user' }, content: [] } })), null)
  assert.equal(match({ ...injectedMessage(), surfaceOp: 'replace' }), null)
  assert.equal(match({ ...injectedMessage(), surfaceOp: undefined }), null)
  // Replacement surfaces are model-only; only an append reaches the human transcript.
  assert.equal(match({ ...injectedMessage(), type: 'assistant/message' }), null)
  assert.equal(match({ ...injectedMessage(), type: 'tool/result' }), null)
  // No id means no stable node identity, and a Definition that returns no state throws.
  assert.equal(match(injectedMessage({ data: { source: { kind: 'skill-invocation' }, content: [] } })), null)
  assert.equal(match(developerMessage({ data: {} })), null)
  assert.equal(match(developerMessage({ data: { message: { content: [] } } })), null)
})

test('a matched event becomes the row’s own state, and buildViewNode wraps it', () => {
  const { internals } = materialize()
  const location = { kind: 'step', step: { step: 3 } }
  const { state, node, context } = buildNode(internals, injectedMessage(), { location })

  assert.equal(state.seq, 12)
  assert.equal(state.time, '2026-10-07T01:30:00.000Z')
  assert.equal(state.text, 'Read the skill.\nThen cut the release.')
  assert.deepEqual(state.producer, { role: 'inject', label: 'dsh-custom-theme-release' })
  assert.equal(state.form, null)
  assert.equal(state.waking, false)
  assert.equal(state.source.kind, 'skill-invocation')

  assert.equal(node.key, context.key)
  assert.equal(node.kind, internals.INJECTION_KIND)
  assert.equal(node.id, 'inj-1')
  assert.equal(node.target, 'chat')
  assert.equal(node.anchorSeq, 12)
  assert.deepEqual(node.location, location)
  assert.equal(node.visibility, 'visible')
  assert.equal(node.data, state)

  // The engine updates by re-reading the state it handed out; a Definition that returned
  // `undefined` here would throw inside the rebuild.
  assert.equal(internals.injectionDefinition.update(context), state)
})

test('the Definition is quiet about a state it never built', () => {
  const { internals } = materialize()
  assert.equal(internals.injectionDefinition.buildViewNode({ state: undefined }), null)
})

test('a recalled session keeps the shell’s recall role and cites what it pulled in', () => {
  const { internals } = materialize()
  const event = injectedMessage({
    data: {
      id: 'recall-1',
      source: { kind: 'session-reference', form: 'recall', references: [{ label: 'earlier work' }, { label: 'earlier work' }, { label: 'the plan' }] },
      content: [{ type: 'text', text: 'Recalled.' }],
    },
  })
  const { state, node } = buildNode(internals, event)
  assert.deepEqual(state.producer, { role: 'recall', label: 'earlier work, the plan' })
  assert.equal(state.form, 'recall')
  assert.equal(node.visibility, 'visible')
})

test('a developer message is classified through its own envelope', () => {
  const { internals } = materialize()
  const { state, node } = buildNode(internals, developerMessage())
  assert.equal(state.text, 'Follow the workspace rules.')
  assert.deepEqual(state.producer, { role: 'inject', label: '/a.md, /b.md' })
  assert.equal(state.form, 'instructions')
  assert.equal(state.waking, false)
  assert.equal(node.anchorSeq, 4)
  assert.equal(node.visibility, 'visible')
})

test('an unknown producer falls back to its own kind, and an unknown form to none', () => {
  const { internals } = materialize()
  const { state } = buildNode(internals, injectedMessage({
    data: { id: 'x-1', source: { kind: 'tool-addition', form: 'not-a-form' }, content: [] },
  }))
  assert.deepEqual(state.producer, { role: 'inject', label: 'tool-addition' })
  assert.equal(state.form, null)
  assert.equal(state.text, '')
  assert.deepEqual(internals.injectionProducer(null), { role: 'inject', label: null })
  assert.deepEqual(internals.injectionProducer('not an object'), { role: 'inject', label: null })
  assert.deepEqual(internals.injectionProducer({ kind: '' }), { role: 'inject', label: null })
})

/* ═══════════════════════ The hidden rows stay hidden ═══════════════════════ */

test('a message claimed by the next Turn is left to the shell’s own trigger row', () => {
  const { internals } = materialize()
  const reader = createReader({ 'inbox-next-turn': { currentClaimed: new Set(['inj-1']), claimSeq: 20 } })
  const { state, node } = buildNode(internals, injectedMessage(), { reader })
  assert.equal(state.waking, true)
  assert.equal(node.visibility, 'hidden')
})

test('the shell’s idle-steer case hides a message that woke a running Turn', () => {
  const { internals } = materialize()
  const location = { kind: 'step', step: { step: 1 }, turn: { start: { seq: 100 } } }
  const woke = {
    'inbox-next-turn': { currentClaimed: new Set(), claimSeq: 90 },
    'inbox-next-step': { currentClaimed: new Set(['inj-1']), claimSeq: 120, claimedHuman: false },
  }
  assert.equal(buildNode(internals, injectedMessage(), { location, reader: createReader(woke) }).node.visibility, 'hidden')

  // Each half of that test is load-bearing, so each gets a counter-example.
  const cases = {
    'a later step is not the wake-up': { ...woke, 'inbox-next-step': { ...woke['inbox-next-step'], currentClaimed: new Set(['inj-1']) } },
    'a human message in the same claim': { ...woke, 'inbox-next-step': { ...woke['inbox-next-step'], claimedHuman: true } },
    'a claim older than the Turn': { ...woke, 'inbox-next-step': { ...woke['inbox-next-step'], claimSeq: 50 } },
    'a Turn that started after the claim': { ...woke, 'inbox-next-turn': { currentClaimed: new Set(), claimSeq: 150 } },
    'a message nobody claimed': { ...woke, 'inbox-next-step': { currentClaimed: new Set(), claimSeq: 120, claimedHuman: false } },
  }
  for (const [name, states] of Object.entries(cases)) {
    const stepped = name === 'a later step is not the wake-up'
      ? { ...location, step: { step: 2 } }
      : location
    const { node } = buildNode(internals, injectedMessage(), { location: stepped, reader: createReader(states) })
    assert.equal(node.visibility, 'visible', `${name} should stay visible`)
  }

  // A message outside a step — or with no Turn start to compare against — cannot be the
  // idle-steer case at all.
  assert.equal(buildNode(internals, injectedMessage(), { reader: createReader(woke) }).node.visibility, 'visible')
  assert.equal(buildNode(internals, injectedMessage(), {
    location: { kind: 'step', step: { step: 1 } },
    reader: createReader(woke),
  }).node.visibility, 'visible')
})

test('a reader that answers nothing keeps the row visible instead of throwing', () => {
  const { internals } = materialize()
  const { node } = buildNode(internals, injectedMessage(), { reader: { previous: () => undefined } })
  assert.equal(node.visibility, 'visible')
  // A waking-looking location with no inbox state at all: the shell's own shapes, absent.
  const { state } = buildNode(internals, injectedMessage(), {
    location: { kind: 'step', step: { step: 1 }, turn: { start: { seq: 5 } } },
    reader: { previous: () => undefined },
  })
  assert.equal(state.waking, false)
})

/* ═══════════════════════ The row’s text and summary ═══════════════════════ */

test('the text is every text block, joined, and nothing else', () => {
  const { internals } = materialize()
  assert.equal(internals.injectionText([
    { type: 'text', text: 'first' },
    { type: 'image', source: {} },
    null,
    { type: 'text', text: 'second' },
    { type: 'text', text: 42 },
  ]), 'first\n\nsecond')
  assert.equal(internals.injectionText(undefined), '')
  assert.equal(internals.injectionText('not a list'), '')
  // One row carries bounded text into the page, whatever the injection was.
  const huge = `x`.repeat(internals.INJECTION_TEXT_LIMIT + 500)
  assert.equal(internals.injectionText([{ type: 'text', text: huge }]).length, internals.INJECTION_TEXT_LIMIT)
})

test('the summary is the first non-empty line, flattened and clipped', () => {
  const { internals } = materialize()
  assert.equal(internals.injectionSummary('\n\n  Hello   world  \nsecond'), 'Hello world')
  assert.equal(internals.injectionSummary(''), '')
  assert.equal(internals.injectionSummary(undefined), '')
  const long = 'a'.repeat(internals.INJECTION_SUMMARY_LIMIT + 30)
  const summary = internals.injectionSummary(long)
  assert.equal(summary.length, internals.INJECTION_SUMMARY_LIMIT)
  assert.ok(summary.endsWith('…'))
})

/* ═══════════════════════ The row as it is drawn ═══════════════════════ */

/** The `t` the shell binds into the slot entry, resolved from the plugin's own dictionary. */
const T = {
  injSettingTitle: '注入提示',
  injHint: '打开后在原来的位置显示这些提示。',
  injShow: '显示',
  injFollow: '跟随官方',
  injUnavailable: '这一项在当前 DSH 上不起作用',
  injTitle: '上下文注入',
  injRecall: '会话引用',
  injEmpty: '（无文本内容）',
}
const t = (key) => T[key] ?? key

test('the row is collapsed until it is opened, and then shows the injected text', () => {
  const { internals, react } = materialize()
  const { node } = buildNode(internals, injectedMessage())
  react.mount(internals.InjectionNodeView, { node, t })

  const row = react.tree
  assert.equal(row.props.className, 'dct-inj')
  assert.equal(row.props['data-dct-injection'], true)
  assert.equal(row.props['data-open'], '0')
  const head = findNode(row, (candidate) => candidate.props?.className === 'dct-inj-head')
  assert.equal(head.props.type, 'button')
  assert.equal(head.props['aria-expanded'], false)
  assert.equal(head.props['aria-label'], '上下文注入 · dsh-custom-theme-release')
  assert.equal(textOf(row), '上下文注入dsh-custom-theme-releaseRead the skill.')
  // The body is what the disclosure is for: it must not be in the page until asked for.
  assert.equal(findNode(row, (candidate) => candidate.props?.className === 'dct-inj-body'), null)

  react.click()
  assert.equal(react.tree.props['data-open'], '1')
  const body = findNode(react.tree, (candidate) => candidate.props?.className === 'dct-inj-body')
  assert.ok(body !== null, 'the opened row has no body')
  assert.equal(body.type, 'pre')
  assert.equal(body.props['data-dct-injection-body'], true)
  assert.deepEqual(body.children, ['Read the skill.\nThen cut the release.'])

  react.click()
  assert.equal(findNode(react.tree, (candidate) => candidate.props?.className === 'dct-inj-body'), null)
})

test('a recall is titled as a recall, and an empty injection says so', () => {
  const { internals, react } = materialize()
  const recall = buildNode(internals, injectedMessage({
    data: { id: 'recall-1', source: { kind: 'session-reference', references: [{ label: 'earlier work' }] }, content: [{ type: 'text', text: 'Recalled.' }] },
  })).node
  react.mount(internals.InjectionNodeView, { node: recall, t })
  assert.match(textOf(react.tree), /会话引用/u)

  const empty = buildNode(internals, injectedMessage({ data: { id: 'e-1', source: { kind: 'skill-invocation' }, content: [] } })).node
  react.mount(internals.InjectionNodeView, { node: empty, t })
  assert.match(textOf(react.tree), /（无文本内容）/u)
  react.click()
  const body = findNode(react.tree, (candidate) => candidate.props?.className === 'dct-inj-body')
  assert.deepEqual(body.children, ['（无文本内容）'])
})

test('a row without a node still renders, so a store race cannot break the transcript', () => {
  const { internals, react } = materialize()
  react.mount(internals.InjectionNodeView, { node: undefined, t })
  assert.match(textOf(react.tree), /上下文注入/u)
  assert.match(textOf(react.tree), /（无文本内容）/u)
})

test('a producer with no label leaves the separator out rather than drawing an empty one', () => {
  const { internals, react } = materialize()
  const { node } = buildNode(internals, injectedMessage({
    data: { id: 'n-1', content: [{ type: 'text', text: 'Heads up.' }] },
  }))
  react.mount(internals.InjectionNodeView, { node, t })
  const row = react.tree
  assert.equal(findNode(row, (candidate) => candidate.props?.className === 'dct-inj-source'), null)
  const head = findNode(row, (candidate) => candidate.props?.className === 'dct-inj-head')
  assert.equal(head.children.filter((child) => child?.props?.className === 'dct-inj-sep').length, 1)
  assert.equal(textOf(row), '上下文注入Heads up.')
})

/* ═══════════════════════ The switch on the settings page ═══════════════════════ */

test('the settings page carries the switch, and using it persists the choice', () => {
  storage.entries.delete(KEY)
  const { slots, react } = applyPlugin({ uiConversation: { events: createRegistry() } })
  slots.declare('settings.section')
  const section = slots.entries.find((entry) => entry.options.name === 'settings.section')
  assert.ok(section !== undefined, 'the settings page was never registered')

  react.mount(section.component, { t })
  const box = () => findNode(react.tree, (node) => node.props?.className === 'dct-injections')
  const label = () => textOf(findNode(react.tree, (node) => node.props?.className === 'dct-toggle'))
  assert.ok(box() !== null, 'the settings page has no injected-row switch')
  assert.equal(box().props.type, 'checkbox')
  assert.equal(box().props.checked, false)
  assert.equal(label(), '跟随官方')
  // The row's own words are on the page, and the note for a shell without the seam is not:
  // this shell has one.
  assert.ok(textOf(react.tree).includes(T.injSettingTitle), 'the switch has no title')
  assert.ok(textOf(react.tree).includes(T.injHint), 'the switch has no hint')
  assert.ok(!textOf(react.tree).includes(T.injUnavailable), 'the switch says it is unavailable on a shell that has the seam')

  box().props.onChange({ target: { checked: true } })
  assert.equal(storage.entries.get(KEY), '{"show":true}')
  assert.equal(box().props.checked, true)
  assert.equal(label(), '显示')
  storage.entries.delete(KEY)
})

test('a shell without the conversation seam says so under the switch', () => {
  const { slots, react } = applyPlugin()
  slots.declare('settings.section')
  const section = slots.entries.find((entry) => entry.options.name === 'settings.section')
  react.mount(section.component, { t })
  assert.ok(textOf(react.tree).includes(T.injUnavailable), 'a shell without the seam is not told')
})

/* ═══════════════════════ The sheet the row wears ═══════════════════════ */

test('the row’s rules are in the page sheet, and they name no hashed shell class', () => {
  const { internals } = materialize()
  for (const selector of ['.dct-inj {', '.dct-inj-head', '.dct-inj-chevron', '.dct-inj-body', ".dct-inj[data-open='1']"]) {
    assert.ok(internals.INJECTION_CSS.includes(selector), `the row’s sheet has no rule for ${selector}`)
  }
  assert.ok(internals.INJECTION_CSS.includes('--dsh-content-font-size-secondary'), 'the row does not follow the transcript’s type scale')
  assert.ok(!/_[a-zA-Z0-9]{5,}/u.test(internals.INJECTION_CSS), 'the sheet names a hashed shell class')

  const page = boot({})
  const element = page.document.head.children.find((candidate) => candidate.dataset?.role === 'page')
  assert.ok(element !== undefined && element !== null, 'the page sheet is missing')
  assert.ok(element.textContent.includes('.dct-inj-body {'), 'the row’s rules never reached the page sheet')
})
