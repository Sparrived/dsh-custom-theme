/**
 * The renderer half of the runtime tray.
 *
 * The main process *pulls* instead of receiving pushed state: it calls the two globals
 * installed here, and each call reads the official stores at that moment. That removes
 * the whole push pipeline the previous design needed — no lease, no queue, no
 * heartbeat, and nothing that can go stale while the window is hidden.
 *
 * The switch itself lives in the Host half, because the Host is what patches the tray
 * at startup; this module only reads and writes it over the route.
 */
const { buildTraySnapshot, trayWords } = require('./model.cjs')
const { TRAY_URL } = require('../shared/endpoints.cjs')

const EMPTY = { enabled: false, desktop: false, active: false, trays: 0, error: '', loading: true, failed: false }

/**
 * Build the renderer side of the tray feature.
 * @param options - `fetchImpl` for the settings calls, replaced by the tests.
 * @returns The controller the settings row and the plugin wiring use.
 */
function createTrayHooks({ fetchImpl } = {}) {
  let state = { ...EMPTY }
  const listeners = new Set()
  const publish = (patch) => {
    const next = { ...state, ...patch }
    if (Object.keys(next).every((key) => next[key] === state[key])) return
    state = next
    for (const listener of listeners) listener()
  }
  const request = async (method, body) => {
    const send = fetchImpl ?? globalThis.fetch
    if (typeof send !== 'function') throw new Error('this shell has no fetch')
    const response = await send(TRAY_URL, {
      method,
      cache: 'no-store',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json()
  }
  const adopt = (payload) => publish({
    enabled: payload?.enabled === true,
    desktop: payload?.desktop === true,
    active: payload?.active === true,
    trays: Number(payload?.trays) || 0,
    error: typeof payload?.error === 'string' ? payload.error : '',
    loading: false,
    failed: false,
  })

  let installed = false
  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    /** Read the switch and the patch state from the Host half. */
    async refresh() {
      try {
        adopt(await request('GET'))
      } catch (error) {
        publish({ loading: false, failed: true, error: error.message })
      }
    },
    /** Store the choice, then patch or unpatch the running Desktop. */
    async setEnabled(value) {
      publish({ loading: true, error: '' })
      try {
        adopt(await request('POST', { enabled: value === true }))
      } catch (error) {
        publish({ loading: false, failed: true, error: error.message })
      }
    },
    /**
     * Install the two globals the main process calls, and take them away on dispose.
     * @param scope - The injected client scope holding the official session stores.
     * @param presentation - Reads the current colours, language and wording.
     */
    bind(scope, presentation) {
      if (installed) return () => {}
      // The same module runs in shells that have no document at all (tests, the CLI
      // Host). Installing the hooks there is meaningless, and failing would take the
      // whole plugin down with it.
      const target = typeof window === 'object' && window !== null ? window : undefined
      if (target === undefined || scope === null || typeof scope !== 'object') return () => {}
      installed = true
      const ready = () => scope.connection.state.getSnapshot() === 'connected'
        && scope.sessions.list.getSnapshot().phase === 'ready'
        && scope.workspaces.list.getSnapshot().phase === 'ready'
      const snapshot = () => {
        try {
          if (!ready()) return null
          return JSON.stringify(buildTraySnapshot(
            scope.sessions.list.getSnapshot(),
            scope.uiSession.sessionStatus.getSnapshot(),
            scope.workspaces.list.getSnapshot(),
            presentation(),
          ))
        } catch {
          return null
        }
      }
      const act = (action) => {
        try {
          if (action?.type === 'newChat') {
            scope.uiWorkspace.startSession()
            return true
          }
          if (action?.type !== 'session' || typeof action.sessionId !== 'string') return false
          const fresh = buildTraySnapshot(
            scope.sessions.list.getSnapshot(),
            scope.uiSession.sessionStatus.getSnapshot(),
            scope.workspaces.list.getSnapshot(),
          )
          // The tray may show a session that has since gone; only a listed one is opened.
          if (![...fresh.unread, ...fresh.recent, ...fresh.more].some((row) => row.sessionId === action.sessionId)) return false
          scope.uiWorkspace.openSession(action.sessionId)
          return true
        } catch {
          return false
        }
      }
      try {
        target.__dctTraySnapshot = snapshot
        target.__dctTrayAction = act
      } catch {
        installed = false
        return () => {}
      }
      return () => {
        installed = false
        if (target.__dctTraySnapshot === snapshot) delete target.__dctTraySnapshot
        if (target.__dctTrayAction === act) delete target.__dctTrayAction
      }
    },
  }
}

/** Only presentation tokens cross processes; arbitrary CSS, paths and HTML never do. */
function trayPresentation(ctx) {
  const style = getComputedStyle(document.documentElement)
  const colors = {}
  for (const [key, token] of [['background', 'bg-base'], ['foreground', 'label-primary'], ['muted', 'label-secondary'], ['accent', 'brand-primary'], ['border', 'border-base']]) colors[key] = style.getPropertyValue(`--dsw-alias-${token}`).trim()
  const locale = document.documentElement.lang.startsWith('en') ? 'en' : 'zh'
  return { colors, dark: ctx.theme.getTheme().active.colorScheme === 'dark', locale, words: trayWords(locale) }
}

module.exports = { createTrayHooks, trayPresentation }
