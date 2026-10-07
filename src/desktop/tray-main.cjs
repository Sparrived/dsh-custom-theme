/**
 * The payload installed into the Desktop **main process** at run time.
 *
 * It is serialized and evaluated inside another process, so it is written as one
 * self-contained function: no imports, no closure over this file, and everything it
 * needs arrives as `electron` (the Electron module of the target process) and
 * `config`. `this` is the list of live `Tray` objects the injector found.
 *
 * The renderer is a peer, not a source of truth: every string, id and colour that
 * arrives from it is re-validated here before it reaches a menu, a tooltip or the popup.
 *
 * The patch is memory-only and reversible: the stock tooltip and context menu the
 * application installed are recorded before they are replaced, so `mode: 'uninstall'`
 * puts the tray back exactly as it was, without a restart.
 *
 * Nothing may live at module scope: only the function below is serialized, so every
 * constant it needs has to be declared inside it. `test/desktop-inject.test.mjs`
 * reconstructs the payload from its own source to keep that true.
 */

module.exports = function installRuntimeTray(electron, config) {
  const ROWS = [['unread', 3], ['recent', 4], ['more', 12]]
  const MAX_TEXT = 160
  const MAX_SNAPSHOT = 64 * 1024
  const COLOR = /^(?:#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}|rgba?\([0-9.,%\s/]{1,40}\))$/u
  const APP_URL = 'dsh-app://app'
  const WORD_KEYS = ['unread', 'recent', 'more', 'newChat', 'showMain', 'quit', 'back', 'empty', 'running']
  const FALLBACK_WORDS = {
    zh: { unread: '未读', recent: '最近', more: '更多', newChat: '新建会话', showMain: '打开 DeepSeek Harness', quit: '退出', back: '返回', empty: '没有会话', running: '运行中' },
    en: { unread: 'Unread', recent: 'Recent', more: 'More', newChat: 'New chat', showMain: 'Open DeepSeek Harness', quit: 'Quit', back: 'Back', empty: 'No sessions', running: 'Running' },
  }
  /*
   * The state lives on `globalThis` so a second injection into the same process — an
   * install after an uninstall, or a newer payload after a plugin update — continues
   * from what the first one recorded instead of starting over.
   */
  const state = (globalThis.__dctRuntimeTray ??= {})
  state.version = 1
  state.trays ??= []
  state.popup ??= null
  state.view ??= null
  state.timer ??= null
  state.channels ??= []
  state.originals ??= []
  state.stock ??= new WeakMap()
  state.applying ??= false
  state.height ??= 0
  state.loaded ??= false
  state.pendingShow ??= false
  state.showTimer ??= null

  const text = (value, cap = MAX_TEXT) => {
    const clean = typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/gu, ' ').replace(/\s+/gu, ' ').trim() : ''
    return clean.length > cap ? `${clean.slice(0, cap - 1)}…` : clean
  }
  /**
   * Whether a tray the debugger found is still usable.
   *
   * `Runtime.queryObjects` also returns trays that have already been destroyed, and on
   * those *every* method — `isDestroyed` included — throws "Illegal invocation". Asking
   * is therefore the only way to find out, so the question has to survive the answer.
   */
  const alive = (tray) => {
    try {
      return typeof tray?.isDestroyed === 'function' && tray.isDestroyed() === false
    } catch {
      return false
    }
  }
  const identity = (value) => (typeof value === 'string' && value.length > 0 && value.length <= 256 && !/[\u0000-\u0020\u007f]/u.test(value) ? value : undefined)

  /** Re-validate the renderer's view model before anything renders it. */
  function sanitize(raw) {
    if (raw === null || typeof raw !== 'object') return null
    const view = { unread: [], recent: [], more: [], words: {}, colors: {}, dark: raw.dark === true, locale: raw.locale === 'en' ? 'en' : 'zh' }
    for (const [group, cap] of ROWS) {
      const seen = new Set()
      for (const row of (Array.isArray(raw[group]) ? raw[group] : []).slice(0, cap)) {
        const sessionId = identity(row?.sessionId)
        if (sessionId === undefined || seen.has(sessionId)) continue
        seen.add(sessionId)
        view[group].push({
          sessionId,
          title: text(row?.title) || sessionId,
          context: text(row?.context, 80),
          status: row?.status === 'unread' || row?.status === 'running' ? row.status : 'idle',
        })
      }
    }
    const words = FALLBACK_WORDS[view.locale]
    for (const key of WORD_KEYS) view.words[key] = text(raw?.words?.[key], 40) || words[key]
    for (const key of ['background', 'foreground', 'muted', 'accent', 'border']) {
      const value = raw?.colors?.[key]
      if (typeof value === 'string' && COLOR.test(value.trim())) view.colors[key] = value.trim()
    }
    view.counts = {
      unread: [...view.unread, ...view.recent, ...view.more].filter((row) => row.status === 'unread').length,
      running: [...view.unread, ...view.recent, ...view.more].filter((row) => row.status === 'running').length,
      total: view.unread.length + view.recent.length + view.more.length,
    }
    while (JSON.stringify(view).length > MAX_SNAPSHOT && view.more.length > 0) view.more.pop()
    return view
  }

  function appWindow() {
    for (const window of electron.BrowserWindow.getAllWindows()) {
      if (window.isDestroyed()) continue
      if (window.webContents.getURL().startsWith(APP_URL)) return window
    }
    return undefined
  }

  /** The renderer half exposes these globals; only the application document answers them. */
  async function rendererCall(expression) {
    const window = appWindow()
    if (window === undefined) return undefined
    return window.webContents.executeJavaScript(expression, true)
  }
  async function snapshot() {
    const answer = await rendererCall('window.__dctTraySnapshot ? window.__dctTraySnapshot() : null')
    if (typeof answer !== 'string' || answer.length > MAX_SNAPSHOT) return null
    try {
      return sanitize(JSON.parse(answer))
    } catch {
      return null
    }
  }
  async function dispatch(action) {
    const type = identity(action?.type)
    if (type !== 'session' && type !== 'newChat') return false
    const sessionId = type === 'session' ? identity(action?.sessionId) : undefined
    if (type === 'session' && sessionId === undefined) return false
    const argument = JSON.stringify(JSON.stringify({ type, sessionId }))
    const answer = await rendererCall(`window.__dctTrayAction ? window.__dctTrayAction(${argument}) : false`)
    return answer === true
  }

  function showMain() {
    const window = appWindow()
    if (window === undefined) return false
    if (window.isMinimized()) window.restore()
    if (!window.isVisible()) window.show()
    window.focus()
    return true
  }

  function menuTemplate(view) {
    const words = view?.words ?? FALLBACK_WORDS.zh
    const rows = []
    for (const [group] of ROWS) {
      const entries = view?.[group] ?? []
      if (entries.length === 0) continue
      rows.push({ label: words[group], enabled: false })
      for (const row of entries) {
        const parts = [row.status === 'running' ? '◉ ' : row.status === 'unread' ? '● ' : '', row.title, row.context === '' ? '' : ` · ${row.context}`, row.status === 'running' ? ` (${words.running})` : '']
        rows.push({
          label: text(parts.join('').replace(/&/gu, '&&'), 150),
          click: () => { dispatch({ type: 'session', sessionId: row.sessionId }).catch(() => {}) },
        })
      }
    }
    if (rows.length === 0) rows.push({ label: words.empty, enabled: false })
    rows.push(
      { type: 'separator' },
      { label: words.newChat, click: () => { dispatch({ type: 'newChat' }).catch(() => {}) } },
      { label: words.showMain, click: () => showMain() },
      { type: 'separator' },
      { label: words.quit, click: () => electron.app.quit() },
    )
    return rows
  }

  function tooltip(view, tray) {
    const base = text(state.stock.get(tray)?.tooltip, 120) || 'DeepSeek Harness'
    if (view === null) return base
    const parts = []
    if (view.counts.unread > 0) parts.push(`${view.counts.unread} ${view.words.unread}`)
    if (view.counts.running > 0) parts.push(`${view.counts.running} ${view.words.running}`)
    return parts.length === 0 ? base : `${base} — ${parts.join(' · ')}`
  }

  function popupBounds(height = config.popup?.height ?? 420) {
    const point = electron.screen.getCursorScreenPoint()
    const area = electron.screen.getDisplayNearestPoint(point).workArea
    const width = Math.min(config.popup?.width ?? 320, area.width)
    const tall = Math.max(96, Math.min(Math.round(height) || 0, area.height))
    const x = Math.max(area.x, Math.min(point.x - Math.round(width / 2), area.x + area.width - width))
    const above = point.y - tall
    const y = above >= area.y ? above : Math.min(point.y + 8, area.y + area.height - tall)
    return { x: Math.round(x), y: Math.round(y), width, height: tall }
  }

  function popupWindow() {
    if (state.popup !== null && !state.popup.isDestroyed()) return state.popup
    const colors = state.view?.colors ?? {}
    const window = new electron.BrowserWindow({
      width: config.popup?.width ?? 320,
      height: config.popup?.height ?? 420,
      show: false,
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      backgroundColor: colors.background ?? (state.view?.dark === true ? '#16181d' : '#ffffff'),
      webPreferences: {
        preload: config.popup.preload,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        devTools: false,
        spellcheck: false,
        partition: config.popup.partition,
      },
    })
    window.setMenuBarVisibility?.(false)
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    window.webContents.on('will-navigate', (event) => event.preventDefault())
    window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
    window.webContents.on('render-process-gone', () => { if (!window.isDestroyed()) window.destroy() })
    window.on('closed', () => { if (state.popup === window) { state.popup = null; state.loaded = false; state.pendingShow = false } })
    window.on('blur', () => { if (!window.isDestroyed() && window.isVisible()) window.hide() })
    state.popup = window
    window.loadFile(config.popup.html).catch(() => { if (!window.isDestroyed()) window.destroy() })
    return window
  }

  function push(view, reset) {
    const window = state.popup
    if (window === null || window.isDestroyed()) return
    window.webContents.send('dct-tray:popup:snapshot', reset ? { ...(view ?? { empty: true }), reset: true } : view)
  }

  /**
   * Show the popup once its document has painted.
   *
   * It is created hidden at the configured size and shrinks to its content before it
   * appears, so the first open does not flash a full-height window and the remembered
   * height makes every later open exact. `show`, not `showInactive`: a window that never
   * took focus never loses it, and "click anywhere else and the menu closes" *is* a
   * focus loss.
   */
  function reveal() {
    if (state.showTimer !== null) { clearTimeout(state.showTimer); state.showTimer = null }
    const popup = state.popup
    if (!state.pendingShow || popup === null || popup.isDestroyed()) return
    state.pendingShow = false
    state.loaded = true
    popup.setBounds(popupBounds(state.height || (config.popup?.height ?? 420)))
    if (!popup.isVisible()) popup.show()
  }

  async function togglePopup() {
    const existing = state.popup
    if (existing !== null && !existing.isDestroyed() && existing.isVisible()) {
      existing.hide()
      return
    }
    state.view = (await snapshot()) ?? state.view
    const popup = popupWindow()
    state.pendingShow = true
    popup.setBounds(popupBounds(state.height || (config.popup?.height ?? 420)))
    push(state.view, true)
    if (state.loaded) reveal()
    else if (state.showTimer === null) state.showTimer = setTimeout(reveal, 600)
  }

  /** Every IPC handler re-checks that the caller really is our own popup document. */
  function ownsPopup(event) {
    const window = state.popup
    if (window === null || window.isDestroyed()) return false
    if (event.sender !== window.webContents) return false
    if (window.webContents.mainFrame !== undefined && event.senderFrame !== window.webContents.mainFrame) return false
    const url = window.webContents.getURL()
    return url.startsWith('file://') && url.endsWith('popup.html')
  }

  function registerChannels() {
    if (state.channels.length > 0) return
    const handle = (name, listener) => {
      electron.ipcMain.removeHandler(name)
      electron.ipcMain.handle(name, listener)
      state.channels.push(name)
    }
    handle('dct-tray:popup:snapshot', (event) => {
      if (!ownsPopup(event)) throw new Error('rejected tray popup sender')
      return state.view
    })
    handle('dct-tray:popup:ready', (event) => {
      if (!ownsPopup(event)) throw new Error('rejected tray popup sender')
      state.loaded = true
      reveal()
      return true
    })
    handle('dct-tray:popup:resize', (event, height) => {
      if (!ownsPopup(event)) throw new Error('rejected tray popup sender')
      const popup = state.popup
      // The first measurement arrives while the window is still hidden and waiting to be
      // revealed, which is precisely the case this has to serve.
      if (popup === null || popup.isDestroyed()) return false
      const wanted = Math.round(Number(height))
      if (!Number.isFinite(wanted)) return false
      const bounds = popupBounds(wanted)
      state.height = bounds.height
      const current = popup.getBounds()
      if (current.height !== bounds.height || current.width !== bounds.width) popup.setBounds(bounds)
      reveal()
      return true
    })
    handle('dct-tray:popup:run', async (event, action) => {
      if (!ownsPopup(event)) throw new Error('rejected tray popup sender')
      const type = identity(action?.type)
      if (type === 'dismiss') { state.popup?.hide(); return true }
      if (type === 'showMain') return showMain()
      if (type === 'quit') { electron.app.quit(); return true }
      const done = await dispatch(action)
      if (done && type === 'session') state.popup?.hide()
      return done
    })
    const hide = 'dct-tray:popup:hide'
    const listener = (event) => { if (ownsPopup(event)) state.popup?.hide() }
    electron.ipcMain.removeListener(hide, listener)
    electron.ipcMain.on(hide, listener)
    state.channels.push(hide)
  }

  async function refresh(reassert) {
    state.applying = true
    try {
      const view = await snapshot().catch(() => null)
      if (view !== null || reassert) state.view = view ?? state.view
      for (const tray of state.trays) {
        if (!alive(tray)) continue
        tray.setToolTip(tooltip(state.view, tray))
        if (reassert) tray.setContextMenu(electron.Menu.buildFromTemplate(menuTemplate(state.view)))
      }
      push(state.view, false)
    } finally {
      state.applying = false
    }
  }

  /** Record the stock tooltip and menu once, so uninstall can restore them untouched. */
  function remember(tray) {
    let record = state.stock.get(tray)
    if (record === undefined) {
      record = {}
      state.stock.set(tray, record)
    }
    return record
  }

  /** Adopt trays that appear after this injection: the application builds one in its constructor. */
  function watchPrototype() {
    if (state.originals.length > 0) return
    const prototype = electron.Tray.prototype
    for (const method of ['setToolTip', 'setContextMenu']) {
      const original = prototype[method]
      state.originals.push([prototype, method, original])
      prototype[method] = function patched(...args) {
        const record = remember(this)
        if (!state.applying) {
          if (method === 'setToolTip') record.tooltip = args[0]
          else record.menu = args[0]
        }
        if (!state.trays.includes(this)) {
          state.trays.push(this)
          // The application calls these from its constructor, so adopting waits for it.
          setTimeout(() => { adopt(this).catch(() => {}) }, 0)
        }
        return original.apply(this, args)
      }
    }
  }

  /**
   * Take the prototype hooks away again.
   *
   * Without this, uninstalling would only hold until the application next calls
   * `setToolTip` — which it does on every locale change — and the tray would quietly
   * be adopted (and patched) a second time.
   */
  function unwatchPrototype() {
    for (const [prototype, method, original] of state.originals) prototype[method] = original
    state.originals = []
  }

  async function adopt(tray) {
    if (!alive(tray)) return false
    tray.removeAllListeners('click')
    tray.removeAllListeners('double-click')
    tray.on('click', () => { togglePopup().catch(() => {}) })
    tray.on('double-click', () => { showMain() })
    await refresh(true)
    return true
  }

  async function uninstall() {
    if (state.timer !== null) { clearInterval(state.timer); state.timer = null }
    if (state.showTimer !== null) { clearTimeout(state.showTimer); state.showTimer = null }
    state.pendingShow = false
    state.loaded = false
    state.height = 0
    unwatchPrototype()
    for (const name of state.channels) if (!name.endsWith(':hide')) electron.ipcMain.removeHandler(name)
    state.channels = []
    for (const tray of state.trays) {
      if (!alive(tray)) continue
      const record = state.stock.get(tray) ?? {}
      tray.removeAllListeners('click')
      tray.removeAllListeners('double-click')
      tray.on('click', () => { showMain() })
      tray.setToolTip(record.tooltip ?? 'DeepSeek Harness')
      if (record.menu !== undefined) tray.setContextMenu(record.menu)
    }
    state.trays = []
    if (state.popup !== null && !state.popup.isDestroyed()) state.popup.destroy()
    state.popup = null
    state.view = null
    return { ok: true, mode: 'uninstall', trays: 0 }
  }

  watchPrototype()
  if (config.mode === 'uninstall') return Promise.resolve().then(uninstall)

  const found = []
  for (const tray of Array.isArray(this) ? this : []) {
    if (!alive(tray)) continue
    if (!state.trays.includes(tray)) state.trays.push(tray)
    found.push(tray)
  }
  registerChannels()
  if (state.timer === null) {
    state.timer = setInterval(() => { refresh(true).catch(() => {}) }, 20000)
    // The application keeps the loop alive; this timer must never be a reason to stay up.
    state.timer.unref?.()
  }
  return Promise.all(found.map((tray) => adopt(tray)))
    .then(() => refresh(true))
    .then(() => ({ ok: true, mode: 'install', trays: state.trays.filter(alive).length, adopted: found.length }))
}
