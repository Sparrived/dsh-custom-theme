/**
 * The runtime tray patch: the injector that opens the main process's inspector, and
 * the payload that runs inside it. The payload is the real shipped function, driven
 * here by a mock Electron module, so menu building, sanitising, trust checks and
 * uninstall are exercised without a Desktop.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'

import { applyRuntimeTray, desktopMainPid, findInspector } from '../src/desktop/inject.mjs'
import { connectCdp } from '../src/desktop/cdp.mjs'

const require = createRequire(import.meta.url)
/**
 * The payload is never `require`d by the process it patches: the injector serializes the
 * function and evaluates that source alone. Rebuilding it here the same way means a
 * constant left at module scope fails these tests instead of failing on a user's desktop.
 */
const payload = new Function(`return (${String(require('../src/desktop/tray-main.cjs'))})`)()
const tick = () => new Promise((resolve) => setImmediate(resolve))

function mockElectron() {
  const record = { menus: [], tooltips: [], windows: [], handlers: new Map(), ipcListeners: new Map(), quit: 0, deniedPermissions: 0, sent: [], focused: 0, show: 0, showInactive: 0 }
  class Tray {
    constructor() { this.destroyed = false; this.listeners = new Map() }
    on(event, listener) { if (!this.listeners.has(event)) this.listeners.set(event, []); this.listeners.get(event).push(listener); return this }
    removeAllListeners(event) { this.listeners.delete(event); return this }
    emit(event, ...args) { for (const listener of [...(this.listeners.get(event) ?? [])]) listener(...args); return (this.listeners.get(event) ?? []).length }
    setToolTip(value) { this.tooltip = value; record.tooltips.push(value) }
    setContextMenu(menu) { this.menu = menu; record.menus.push(menu) }
    isDestroyed() { return this.destroyed }
    destroy() { this.destroyed = true }
  }
  class Contents {
    constructor(owner) { this.owner = owner; this.url = owner?.url ?? 'file:///popup.html'; this.mainFrame = { url: this.url } }
    getURL() { return this.url }
    executeJavaScript(expression) { return Promise.resolve(record.onEvaluate?.(expression)) }
    send(channel, view) { record.sent.push([channel, view]) }
    setWindowOpenHandler() {}
    on() {}
    get session() { return { setPermissionRequestHandler: () => { record.deniedPermissions += 1 } } }
  }
  class BrowserWindow {
    static all = []
    static getAllWindows() { return BrowserWindow.all.filter((window) => !window.destroyed) }
    constructor(options = {}) {
      this.options = options
      this.url = options.url ?? 'file:///popup.html'
      this.destroyed = false
      this.shown = false
      this.minimized = false
      this.webContents = new Contents(this)
      BrowserWindow.all.push(this)
      record.windows.push(this)
    }
    isDestroyed() { return this.destroyed }
    setMenuBarVisibility() {}
    loadFile() { return Promise.resolve() }
    setBounds(bounds) { this.bounds = { ...this.bounds, ...bounds } }
    getBounds() { return { x: 0, y: 0, width: 320, height: 420, ...this.bounds } }
    showInactive() { this.shown = true; record.showInactive += 1 }
    isVisible() { return this.shown }
    hide() { this.shown = false }
    show() { this.shown = true; record.show += 1 }
    focus() { record.focused += 1 }
    isMinimized() { return this.minimized }
    restore() { this.minimized = false }
    destroy() { this.destroyed = true; this.shown = false }
    on() {}
  }
  const electron = {
    Tray,
    BrowserWindow,
    Menu: { buildFromTemplate: (template) => ({ template }) },
    ipcMain: {
      handle: (name, listener) => record.handlers.set(name, listener),
      removeHandler: (name) => record.handlers.delete(name),
      on: (name, listener) => record.ipcListeners.set(name, listener),
      removeListener: (name) => record.ipcListeners.delete(name),
    },
    app: { quit: () => { record.quit += 1 } },
    screen: {
      getCursorScreenPoint: () => ({ x: 400, y: 600 }),
      getDisplayNearestPoint: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1040 } }),
    },
  }
  const appWindow = () => new BrowserWindow({ url: 'dsh-app://app/index.html' })
  return { electron, record, appWindow, Tray }
}

const CONFIG = { mode: 'install', popup: { html: 'C:\\plugin\\popup.html', preload: 'C:\\plugin\\popup-preload.cjs', partition: 'dct-tray-popup', width: 320, height: 420 } }
const VIEW = { unread: [{ sessionId: 'a', title: 'First', context: 'work', status: 'unread' }], recent: [], more: [], words: { unread: '未读', recent: '最近', more: '更多', newChat: '新建会话', showMain: '打开', quit: '退出', back: '返回', empty: '没有会话', running: '运行中' }, colors: { background: '#101014' }, dark: true, locale: 'zh' }

test('the injector refuses to run where there is no Desktop main process', async () => {
  assert.equal(desktopMainPid(), undefined)
  const answer = await applyRuntimeTray({ find: async () => undefined, debugProcess: () => { throw new Error('must not be called') } })
  assert.equal(answer.ok, false)
  assert.match(answer.reason, /not a Desktop host/)
})

test('a Web or CLI host is never mistaken for a Desktop host', () => {
  const host = 'C:\\Program Files\\DeepSeek Harness\\resources\\app.asar\\dsh\\node_modules\\@deepseek-ai\\dsh-desktop-host\\lib\\index.js'
  const electron = { versions: { electron: '44.0.0' }, ppid: 16852, pid: 20068 }
  assert.equal(desktopMainPid({ ...electron, argv: ['DeepSeek Harness.exe', host, 'C:\\app.asar\\dsh'] }), 16852)
  // `dsh web` started from a Desktop session inherits ELECTRON_RUN_AS_NODE, and even the
  // Electron binary: only the Desktop Host bootstrap path proves what this process is.
  assert.equal(desktopMainPid({ ...electron, env: { ELECTRON_RUN_AS_NODE: '1' }, argv: ['DeepSeek Harness.exe', 'C:\\app.asar\\dsh\\lib\\bin.mjs', 'web'] }), undefined)
  assert.equal(desktopMainPid({ ...electron, versions: {}, argv: ['node', host] }), undefined, 'plain Node has no Electron main process')
  assert.equal(desktopMainPid({ ...electron, argv: ['DeepSeek Harness.exe', host], ppid: 0 }), undefined)
  assert.equal(desktopMainPid({ ...electron, argv: ['DeepSeek Harness.exe', host], ppid: 20068 }), undefined, 'a process that is its own parent')
})

test('inspector discovery only accepts the Electron bootstrap on loopback', async () => {
  const listing = (entries) => async () => ({ ok: true, json: async () => entries })
  assert.equal(await findInspector({ fetchImpl: listing([{ webSocketDebuggerUrl: 'ws://10.0.0.5:9229/x', title: 'electron/js2c/browser_init' }]) }), undefined)
  assert.equal(await findInspector({ fetchImpl: listing([{ webSocketDebuggerUrl: 'ws://127.0.0.1:9229/x', title: 'not-the-main-process' }]) }), undefined)
  assert.equal(await findInspector({ fetchImpl: async () => { throw new Error('down') } }), undefined)
  const found = await findInspector({ fetchImpl: listing([{ webSocketDebuggerUrl: 'ws://127.0.0.1:9231/abc', title: 'electron/js2c/browser_init' }]) })
  assert.deepEqual(found, { port: 9231, url: 'ws://127.0.0.1:9231/abc', title: 'electron/js2c/browser_init' })
})

test('the injector opens the inspector, patches the tray and closes the port it opened', async () => {
  const events = []
  let lookups = 0
  const client = {
    send: async (method, params) => {
      events.push(method)
      if (method === 'Runtime.evaluate') return { result: { objectId: params.expression.includes('prototype') ? 'prototype' : 'electron' } }
      if (method === 'Runtime.queryObjects') return { objects: { objectId: 'objects' } }
      if (method === 'Runtime.callFunctionOn') return { result: { value: { ok: true, mode: 'install', trays: 1 } } }
      throw new Error(`unexpected ${method}`)
    },
    fire: (method, params) => events.push(`fire:${params.expression}`),
    close: () => events.push('close'),
  }
  const answer = await applyRuntimeTray({
    mainPid: 4242,
    config: CONFIG,
    debugProcess: (pid) => events.push(`debug:${pid}`),
    find: async () => { lookups += 1; return lookups < 3 ? undefined : { port: 9229, url: 'ws://127.0.0.1:9229/x', title: 'electron/js2c/browser_init' } },
    connect: async () => client,
    wait: async () => {},
  })
  assert.deepEqual(answer, { ok: true, mode: 'install', trays: 1 })
  assert.equal(events[0], 'debug:4242')
  assert.ok(events.includes('Runtime.queryObjects'))
  assert.ok(events.includes('Runtime.callFunctionOn'))
  assert.ok(events.some((event) => typeof event === 'string' && event.startsWith('fire:') && event.includes('inspector')))
  assert.equal(events.at(-1), 'close')
})

test('an inspector that was already open belongs to its owner and is left alone', async () => {
  const events = []
  const client = {
    send: async (method, params) => {
      events.push(method)
      if (method === 'Runtime.evaluate') return { result: { objectId: params.expression.includes('prototype') ? 'prototype' : 'electron' } }
      if (method === 'Runtime.queryObjects') return { objects: { objectId: 'objects' } }
      return { result: { value: { ok: true, mode: 'install', trays: 2 } } }
    },
    fire: () => events.push('fire'),
    close: () => events.push('close'),
  }
  const answer = await applyRuntimeTray({
    mainPid: 4242,
    find: async () => ({ port: 9229, url: 'ws://127.0.0.1:9229/x', title: 'electron/js2c/browser_init' }),
    connect: async () => client,
    debugProcess: () => events.push('debug'),
    wait: async () => {},
  })
  assert.equal(answer.ok, true)
  assert.equal(events.includes('debug'), false)
  assert.equal(events.includes('fire'), false)
  assert.equal(events.at(-1), 'close')
})

test('a payload that refuses leaves the tray alone and still closes the port', async () => {
  const events = []
  const client = {
    send: async (method, params) => {
      if (method === 'Runtime.evaluate') return { result: { objectId: params.expression.includes('prototype') ? 'prototype' : 'electron' } }
      if (method === 'Runtime.queryObjects') return { objects: { objectId: 'objects' } }
      return { result: { value: { ok: false, reason: 'refused' } } }
    },
    fire: () => events.push('fire'),
    close: () => {},
  }
  let lookups = 0
  const answer = await applyRuntimeTray({
    mainPid: 1,
    find: async () => { lookups += 1; return lookups < 2 ? undefined : { port: 9229, url: 'ws://127.0.0.1:9229/x', title: 'electron/js2c/browser_init' } },
    connect: async () => client,
    debugProcess: () => {},
    wait: async () => {},
  })
  assert.equal(answer.ok, false)
  assert.equal(events.includes('fire'), true)
})

test('the debugger client refuses anything that is not a loopback inspector', async () => {
  await assert.rejects(() => connectCdp('ws://192.168.1.10:9229/x'), /non-loopback/)
  await assert.rejects(() => connectCdp('ws://127.0.0.1:9229/x', { WebSocketImpl: null }), /no WebSocket/)
})

test('installing adopts the live tray: left click opens the popup, double click shows the app', async () => {
  const { electron, record, appWindow, Tray } = mockElectron()
  globalThis.__dctRuntimeTray = undefined
  const window = appWindow()
  record.onEvaluate = (expression) => (expression.includes('__dctTraySnapshot') ? JSON.stringify(VIEW) : true)
  const tray = new Tray()
  tray.emit('click') // the application's own handler, present before the patch
  const answer = await payload.call([tray], electron, CONFIG)
  assert.equal(answer.ok, true)
  assert.equal(answer.trays, 1)
  assert.equal('click' in Object.fromEntries(tray.listeners), true)
  assert.equal(tray.emit('click'), 1)
  await tick()
  const popup = record.windows.find((candidate) => candidate !== window && candidate !== tray)
  assert.ok(popup !== undefined, 'a popup window was created')
  // It is created hidden, measures itself and is revealed on its own first render.
  assert.equal(popup.shown, false)
  assert.equal(record.showInactive, 0, 'a window that never took focus can never lose it')
  const ready = record.handlers.get('dct-tray:popup:ready')
  assert.equal(ready({ sender: popup.webContents, senderFrame: popup.webContents.mainFrame }), true)
  assert.equal(popup.shown, true)
  assert.equal(record.show, 1)
  assert.equal(popup.options.webPreferences.preload, CONFIG.popup.preload)
  assert.equal(popup.options.webPreferences.sandbox, true)
  assert.equal(popup.options.webPreferences.nodeIntegration, false)
  assert.equal(record.deniedPermissions > 0, true)
  assert.equal(tray.emit('double-click'), 1)
  assert.equal(record.focused, 1)
  const menu = tray.menu.template
  assert.equal(menu[0].label, '未读')
  assert.match(menu[1].label, /First · work/)
  assert.equal(menu.at(-1).label, '退出')
  assert.match(tray.tooltip, /1 未读/)
  globalThis.__dctRuntimeTray = undefined
})

test('the popup is sized to its content, clamped to the work area, and only its own document may ask', async () => {
  const { electron, record, appWindow, Tray } = mockElectron()
  globalThis.__dctRuntimeTray = undefined
  appWindow()
  record.onEvaluate = (expression) => (expression.includes('__dctTraySnapshot') ? JSON.stringify(VIEW) : true)
  const tray = new Tray()
  await payload.call([tray], electron, CONFIG)
  tray.emit('click')
  await tick()
  const popup = record.windows.find((candidate) => candidate.options?.url === undefined)
  const resize = record.handlers.get('dct-tray:popup:resize')
  const own = { sender: popup.webContents, senderFrame: popup.webContents.mainFrame }
  assert.throws(() => resize({ sender: {}, senderFrame: {} }, 300), /rejected/)
  assert.equal(resize(own, 373), true)
  assert.equal(popup.getBounds().height, 373)
  assert.equal(popup.shown, true, 'the measurement is what reveals it')
  assert.equal(resize(own, 5000), true)
  assert.equal(popup.getBounds().height, 1040, 'the work area is the ceiling')
  assert.equal(resize(own, 'nonsense'), false)
  tray.emit('click') // hides it
  await tick()
  tray.emit('click') // and this open already knows its height
  await tick()
  assert.equal(popup.shown, true)
  assert.equal(record.show, 2)
  assert.equal(popup.getBounds().height, 1040)
  globalThis.__dctRuntimeTray = undefined
})

test('the popup IPC answers only its own document and dispatches fixed actions', async () => {
  const { electron, record, appWindow, Tray } = mockElectron()
  globalThis.__dctRuntimeTray = undefined
  appWindow()
  const seen = []
  const delivered = []
  record.onEvaluate = (expression) => {
    if (expression.includes('__dctTraySnapshot')) return JSON.stringify(VIEW)
    seen.push(expression)
    // Run the expression against a receiver that behaves like the renderer half: it takes
    // an action object, so a JSON string would be refused here exactly as it is in the app.
    const window = {
      __dctTraySnapshot: () => JSON.stringify(VIEW),
      __dctTrayAction: (action) => {
        delivered.push(action)
        return typeof action === 'object' && action !== null
          && (action.type === 'newChat' || (action.type === 'session' && typeof action.sessionId === 'string'))
      },
    }
    return new Function('window', `return ${expression}`)(window)
  }
  const tray = new Tray()
  await payload.call([tray], electron, CONFIG)
  tray.emit('click')
  await tick()
  const handler = record.handlers.get('dct-tray:popup:snapshot')
  const popup = record.windows.find((candidate) => candidate.options?.url === undefined)
  assert.throws(() => handler({ sender: {}, senderFrame: {} }), /rejected/)
  assert.equal(handler({ sender: popup.webContents, senderFrame: popup.webContents.mainFrame }).unread.length, 1)
  const run = record.handlers.get('dct-tray:popup:run')
  await assert.rejects(() => run({ sender: {}, senderFrame: {} }, { type: 'newChat' }), /rejected/)
  assert.equal(await run({ sender: popup.webContents, senderFrame: popup.webContents.mainFrame }, { type: 'newChat' }), true)
  assert.equal(await run({ sender: popup.webContents, senderFrame: popup.webContents.mainFrame }, { type: 'session', sessionId: 'a' }), true)
  assert.equal(seen.length, 2)
  assert.match(seen[0], /__dctTrayAction/)
  // The action reaches the renderer as an object; the id is what the popup clicked.
  assert.deepEqual(delivered, [{ type: 'newChat' }, { type: 'session', sessionId: 'a' }])
  const quit = record.handlers.get('dct-tray:popup:run')
  await quit({ sender: popup.webContents, senderFrame: popup.webContents.mainFrame }, { type: 'quit' })
  assert.equal(record.quit, 1)
  globalThis.__dctRuntimeTray = undefined
})

test('renderer text, colours and ids are re-validated before they reach a menu or the popup', async () => {
  const { electron, record, appWindow, Tray } = mockElectron()
  globalThis.__dctRuntimeTray = undefined
  appWindow()
  const hostile = {
    unread: [
      { sessionId: 'ok', title: '<b>bold</b>', context: 'c', status: 'unread' },
      { sessionId: 'bad id', title: 'spaced' },
      { sessionId: 'ok', title: 'duplicate' },
      { sessionId: 'x'.repeat(300), title: 'long' },
      { sessionId: 'ctrl', title: 'a\u0000b' },
    ],
    recent: [{ sessionId: 'r', title: 'y'.repeat(1000), status: 'nonsense' }],
    more: [],
    words: { unread: 'U'.repeat(400) },
    colors: { background: 'url(javascript:alert(1))', accent: '#0af' },
    dark: 'yes',
    locale: 'en',
  }
  record.onEvaluate = (expression) => (expression.includes('__dctTraySnapshot') ? JSON.stringify(hostile) : true)
  const tray = new Tray()
  await payload.call([tray], electron, CONFIG)
  tray.emit('click')
  await tick()
  const menu = tray.menu.template
  const labels = menu.map((entry) => entry.label).join('\n')
  assert.match(labels, /<b>bold<\/b>/, 'angle brackets stay literal text, never markup')
  assert.doesNotMatch(labels, /spaced|duplicate/)
  assert.equal(menu.filter((entry) => entry.enabled === false).length >= 1, true)
  assert.equal(menu.some((entry) => (entry.label ?? '').length > 151), false, 'labels are capped')
  assert.equal(tray.menu.template[0].label.length, 40)
  const pushed = record.sent.at(-1)[1]
  assert.equal(pushed.colors.background, undefined, 'a non-colour is dropped')
  assert.equal(pushed.colors.accent, '#0af')
  assert.equal(pushed.dark, false)
  assert.equal(pushed.locale, 'en')
  assert.equal(pushed.counts.unread, 1)
  record.onEvaluate = (expression) => (expression.includes('__dctTraySnapshot') ? JSON.stringify({ ...VIEW, locale: 'fr' }) : true)
  tray.emit('click') // hides the visible popup
  await tick()
  tray.emit('click') // and this one re-reads the snapshot and shows it again
  await tick()
  assert.equal(record.sent.at(-1)[1].locale, 'zh', 'an unknown locale falls back')
  globalThis.__dctRuntimeTray = undefined
})

test('a tray the debugger found but that is already destroyed is skipped, not fatal', async () => {
  const { electron, record, appWindow, Tray } = mockElectron()
  globalThis.__dctRuntimeTray = undefined
  appWindow()
  record.onEvaluate = (expression) => (expression.includes('__dctTraySnapshot') ? JSON.stringify(VIEW) : true)
  // A destroyed native Tray throws on every method, `isDestroyed` included.
  const dead = new Tray()
  dead.isDestroyed = () => { throw new TypeError('Illegal invocation: Function must be called on an object of type Tray') }
  const live = new Tray()
  const answer = await payload.call([dead, live], electron, CONFIG)
  assert.equal(answer.ok, true)
  assert.equal(answer.adopted, 1)
  assert.equal(answer.trays, 1)
  assert.equal(live.emit('click'), 1)
  globalThis.__dctRuntimeTray = undefined
})

test('uninstall takes the prototype hooks away, so a later tray is never adopted again', async () => {
  const { electron, record, appWindow, Tray } = mockElectron()
  globalThis.__dctRuntimeTray = undefined
  appWindow()
  record.onEvaluate = () => JSON.stringify(VIEW)
  const tray = new Tray()
  await payload.call([tray], electron, CONFIG)
  await payload.call([tray], electron, { mode: 'uninstall' })
  // The application relabels its tooltip on every locale change; that must not be a
  // back door that silently patches the tray again.
  const later = new Tray()
  later.on('click', () => {})
  later.setToolTip('About DeepSeek Harness')
  later.setContextMenu({ template: [] })
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.equal(globalThis.__dctRuntimeTray.trays.length, 0)
  const windows = record.windows.length
  assert.equal(later.emit('click'), 1, 'only the stock handler is attached')
  await tick()
  assert.equal(record.windows.length, windows, 'no popup was created for it')
  globalThis.__dctRuntimeTray = undefined
})

test('a tray created after the patch is adopted, and uninstall restores the stock menu', async () => {
  const { electron, record, appWindow, Tray } = mockElectron()
  globalThis.__dctRuntimeTray = undefined
  appWindow()
  record.onEvaluate = (expression) => (expression.includes('__dctTraySnapshot') ? JSON.stringify(VIEW) : true)
  await payload.call([], electron, CONFIG)
  const tray = new Tray()
  const stock = { template: [{ label: 'Open' }, { type: 'separator' }, { label: 'Quit' }] }
  tray.on('click', () => {})
  tray.setToolTip('About DeepSeek Harness')
  tray.setContextMenu(stock)
  await new Promise((resolve) => setTimeout(resolve, 10))
  const own = tray.menu
  assert.notEqual(own, stock)
  assert.equal(tray.emit('click'), 1)
  const answer = await payload.call([tray], electron, { mode: 'uninstall' })
  assert.deepEqual(answer, { ok: true, mode: 'uninstall', trays: 0 })
  assert.equal(tray.menu, stock, 'the stock menu object is restored untouched')
  assert.equal(tray.tooltip, 'About DeepSeek Harness')
  assert.equal(record.handlers.size, 0)
  tray.emit('click')
  assert.equal(record.focused > 0, true, 'left click opens the application again')
  globalThis.__dctRuntimeTray = undefined
})
