/**
 * The renderer half of the runtime tray, tested without a shell: the two globals the
 * main process pulls, the action validation, and the switch the settings row drives.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { buildTraySnapshot, trayWords } = require('../src/client/tray/model.cjs')
const { createTrayHooks, trayPresentation } = require('../src/client/tray/hooks.cjs')

const row = (id, patch = {}) => ({ id, title: `Title ${id}`, updatedAt: Number(id) || 0, running: false, blank: false, cwd: 'C:\\work\\project', retainedBy: {}, ...patch })
function catalog(rows) { return { ids: rows.map((row) => row.id), byId: Object.fromEntries(rows.map((row) => [row.id, row])), phase: 'ready' } }
function store(value) {
  let current = value
  const listeners = new Set()
  return { getSnapshot: () => current, subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn) }, set(next) { current = next; for (const fn of listeners) fn() }, count: () => listeners.size }
}

test('tray model ports 3 unread / 4 recent / 12 more, filters blank/archive/subagent but keeps forks', () => {
  const rows = Array.from({ length: 25 }, (_, i) => row(String(i + 1)))
  rows.push(row('blank', { blank: true }), row('archived'), row('subagent', { origin: 'subagent' }), row('fork', { parentId: '1', updatedAt: 100 }))
  const statuses = new Map(rows.slice(0, 5).map((row) => [row.id, { completionUnread: true }]))
  const snapshot = buildTraySnapshot(catalog(rows), statuses, { archivedSessionIds: ['archived'], items: [{ title: 'Workspace', sessionIds: ['fork'] }] })
  assert.deepEqual(snapshot.unread.map((row) => row.sessionId), ['5', '4', '3'])
  assert.equal(snapshot.recent.length, 4)
  assert.equal(snapshot.more.length, 12)
  assert.equal(snapshot.recent[0].sessionId, 'fork')
  assert.equal(snapshot.recent[0].context, 'Workspace')
  assert.equal(snapshot.recent[1].context, 'project')
  const ids = [...snapshot.unread, ...snapshot.recent, ...snapshot.more].map((row) => row.sessionId)
  assert.equal(ids.length, new Set(ids).size)
  assert.ok(!ids.includes('blank') && !ids.includes('archived') && !ids.includes('subagent'))
})

test('tray uses official pending/completion facts, excludes current from unread and does not invent errors', () => {
  const rows = [row('1', { retainedBy: { mainView: 1 } }), row('2'), row('3', { running: true }), row('4')]
  const statuses = new Map([['1', { completionUnread: true }], ['2', { pendingInteraction: { kind: 'question' } }], ['4', { running: true, error: true }]])
  const list = catalog(rows)
  list.byId.extra = row('extra')
  const result = buildTraySnapshot(list, statuses, { items: [] })
  assert.deepEqual(result.unread.map((row) => row.sessionId), ['2'])
  assert.equal(result.recent.find((row) => row.sessionId === '3').status, 'running')
  assert.equal(result.recent.find((row) => row.sessionId === '4').status, 'running')
  assert.ok(!result.recent.some((row) => row.sessionId === 'extra'))
})

test('tray wording follows the shell language and covers every menu label', () => {
  for (const locale of ['zh', 'en']) {
    const words = trayWords(locale)
    assert.deepEqual(Object.keys(words).sort(), ['back', 'empty', 'more', 'newChat', 'quit', 'recent', 'running', 'showMain', 'unread'])
    for (const value of Object.values(words)) assert.equal(typeof value === 'string' && value.length > 0, true)
  }
  assert.equal(trayWords('en').quit, 'Quit')
  assert.equal(trayWords('zh').quit, '退出')
})

/** A fresh injected scope per test, like the one the plugin receives. */
function makeScope(overrides = {}) {
  const sources = {
    list: store(catalog([row('1'), row('2')])),
    status: store(new Map()),
    workspaces: store({ phase: 'ready', items: [], archivedSessionIds: [] }),
    connection: store('connected'),
  }
  const navigated = []
  const scope = {
    sessions: { list: sources.list },
    uiSession: { sessionStatus: sources.status },
    workspaces: { list: sources.workspaces },
    connection: { state: sources.connection },
    uiWorkspace: { openSession: (id) => navigated.push(id), startSession: () => navigated.push('new') },
    ...overrides,
  }
  return { scope, sources, navigated }
}

const withWindow = (fn) => {
  const previous = globalThis.window
  globalThis.window = {}
  try {
    return fn(globalThis.window)
  } finally {
    if (previous === undefined) delete globalThis.window
    else globalThis.window = previous
  }
}

test('bind installs the two globals the main process pulls, and dispose takes them away', () => {
  withWindow(() => {
    const { scope, sources } = makeScope()
    const hooks = createTrayHooks()
    const dispose = hooks.bind(scope, () => ({ locale: 'en', words: trayWords('en') }))
    assert.equal(typeof globalThis.window.__dctTraySnapshot, 'function')
    assert.equal(typeof globalThis.window.__dctTrayAction, 'function')
    const view = JSON.parse(globalThis.window.__dctTraySnapshot())
    assert.deepEqual([...view.unread, ...view.recent].map((row) => row.sessionId), ['2', '1'])
    assert.equal(view.words.quit, 'Quit')
    assert.equal(view.locale, 'en')
    // A pull reads the stores at call time, so nothing needs to be subscribed.
    sources.connection.set('disconnected')
    assert.equal(globalThis.window.__dctTraySnapshot(), null)
    sources.connection.set('connected')
    sources.list.set({ ...catalog([]), phase: 'pending' })
    assert.equal(globalThis.window.__dctTraySnapshot(), null)
    sources.list.set(catalog([row('9')]))
    assert.equal(JSON.parse(globalThis.window.__dctTraySnapshot()).recent.length, 1)
    dispose()
    assert.equal(globalThis.window.__dctTraySnapshot, undefined)
    assert.equal(globalThis.window.__dctTrayAction, undefined)
  })
})

test('tray actions only reach listed sessions, and malformed or stale ones are refused', () => {
  withWindow(() => {
    const { scope, sources, navigated } = makeScope()
    const hooks = createTrayHooks()
    const dispose = hooks.bind(scope, () => ({ locale: 'zh', words: trayWords('zh') }))
    const action = globalThis.window.__dctTrayAction
    assert.equal(action({ type: 'newChat' }), true)
    assert.equal(action({ type: 'session', sessionId: '1' }), true)
    assert.deepEqual(navigated, ['new', '1'])
    assert.equal(action({ type: 'session', sessionId: 'arbitrary' }), false)
    assert.equal(action({ type: 'session' }), false)
    assert.equal(action({ type: 'plant' }), false)
    assert.equal(action(null), false)
    assert.equal(action({ type: 'session', sessionId: 42 }), false)
    // The main process hands over the action itself; a JSON string is a caller that is
    // out of step with this contract, and it must not open anything.
    assert.equal(action('{"type":"newChat"}'), false, 'a stringified action is not an action')
    assert.deepEqual(navigated, ['new', '1'], 'nothing else was opened')
    sources.workspaces.set({ phase: 'ready', items: [], archivedSessionIds: ['1'] })
    assert.equal(action({ type: 'session', sessionId: '1' }), false, 'a session that just left the list is refused')
    assert.equal(action({ type: 'newChat' }), true, 'the session list itself is not required to start a chat')
    dispose()
  })
})

test('the switch travels over the route and failures stay inside the row', async () => {
  const calls = []
  const answer = (body) => ({ ok: true, json: async () => body })
  const hooks = createTrayHooks({
    fetchImpl: async (url, options = {}) => {
      calls.push([url, options.method ?? 'GET', options.body])
      if (options.method === 'POST') return answer({ enabled: JSON.parse(options.body).enabled, desktop: true, active: true, trays: 1 })
      return answer({ enabled: false, desktop: true, active: false, trays: 0, error: '' })
    },
  })
  let notified = 0
  hooks.subscribe(() => { notified += 1 })
  await hooks.refresh()
  assert.deepEqual(calls[0], ['/dsh-custom-theme/desktop-tray', 'GET', undefined])
  assert.equal(hooks.getSnapshot().enabled, false)
  assert.equal(hooks.getSnapshot().desktop, true)
  assert.equal(hooks.getSnapshot().loading, false)
  await hooks.setEnabled(true)
  assert.equal(calls[1][1], 'POST')
  assert.equal(calls[1][2], '{"enabled":true}')
  assert.equal(hooks.getSnapshot().enabled, true)
  assert.equal(hooks.getSnapshot().active, true)
  assert.equal(hooks.getSnapshot().trays, 1)
  assert.equal(notified > 0, true)

  const broken = createTrayHooks({ fetchImpl: async () => { throw new Error('offline') } })
  await broken.refresh()
  assert.equal(broken.getSnapshot().failed, true)
  assert.match(broken.getSnapshot().error, /offline/)
  await broken.setEnabled(true)
  assert.equal(broken.getSnapshot().failed, true)
})

test('presentation exposes only tokens, never arbitrary CSS, and survives a bare theme service', () => {
  const style = { getPropertyValue: (property) => (property.endsWith('bg-base') ? '#101014' : '') }
  const previous = globalThis.getComputedStyle
  const previousDocument = globalThis.document
  globalThis.getComputedStyle = () => style
  globalThis.document = { documentElement: { lang: 'en-US' } }
  try {
    const presentation = trayPresentation({ theme: { getTheme: () => ({ active: { colorScheme: 'dark' } }) } })
    assert.deepEqual(presentation.colors, { background: '#101014', foreground: '', muted: '', accent: '', border: '' })
    assert.equal(presentation.locale, 'en')
    assert.equal(presentation.dark, true)
    assert.equal(presentation.words.newChat, 'New chat')
    const zh = trayPresentation({ theme: { getTheme: () => ({ active: { colorScheme: 'light' } }) }, locale: 'zh' })
    globalThis.document.documentElement.lang = 'zh-CN'
    assert.equal(trayPresentation({ theme: { getTheme: () => ({ active: { colorScheme: 'light' } }) } }).locale, 'zh')
    assert.equal(zh.dark, false)
  } finally {
    globalThis.getComputedStyle = previous
    if (previousDocument === undefined) delete globalThis.document
    else globalThis.document = previousDocument
  }
})
