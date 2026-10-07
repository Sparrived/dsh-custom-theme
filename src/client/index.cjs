/**
 * index.cjs — the browser half's composition root.
 *
 * This is the only module that knows how the half is put together: it registers
 * the strings, owns the sheets the page keeps in `<head>`, builds each feature
 * once, hands every feature the neighbours it works with, registers the seats the
 * shell draws it in, and takes the whole thing down again when the plugin is
 * disposed. The features themselves live in the modules beside this one; what is
 * here is wiring.
 *
 * The shell runs `lib/client.js` to register one lazy factory, and calling that
 * factory materializes this module. A factory may only `require` what the page has
 * already seeded — React and React DOM — so every module here is linked into that
 * one bundle by `npm run build:client` instead of being fetched separately.
 *
 * The theme list, the stylesheet text and the update metadata come from the Host
 * half's `/dsh-custom-theme/` route, which the Desktop shell forwards to its
 * authenticated Web Host like any other local application request.
 */
const { DICTIONARY, LOCALE_NS } = require('./i18n/dictionary.cjs')
const { PAGE_CSS } = require('./settings/styles.cjs')
const { mixColor } = require('./shared/color.cjs')
const { EFFORT_LEVELS_URL } = require('./shared/endpoints.cjs')
const { listBackgrounds, listThemes, uploadBackground } = require('./shared/host-api.cjs')
const {
  COLOR_BLUE,
  COLOR_DEEP,
  COLOR_TEXT_VIOLET,
  COLOR_VIOLET,
  COLOR_DEEPSEEK_BASE,
  COLOR_DEEPSEEK_CYAN,
  COLOR_DEEPSEEK_ABYSS,
  COLOR_DEEPSEEK_TEXT,
  COMMIT_DEADLINE_MS,
  COMMIT_THROTTLE_MS,
  EFFORT_ENTRY_ID,
  EFFORT_ENTRY_ORDER,
  EFFORT_SLOT,
  EFFORT_THEME_KEY,
  EFFORT_THEME_DEFAULT,
  EFFORT_THEMES,
  normalizeEffortTheme,
  readSavedEffortTheme,
  writeSavedEffortTheme,
  ENERGY_END,
  ENERGY_START,
  GOLDEN_RATIO,
  KNOB_RADIUS,
  KNOB_SIZE,
  MAX_SPEED_FACTOR,
  MIN_HEIGHT_SLOTS,
  QUOTA_NOTICE_MS,
  REDUCED_MOTION_SLOWDOWN,
  ROW_PADDING_BLOCK,
  STARFIELD_DURATION_MEAN,
  STARFIELD_DURATION_SPREAD,
  STARFIELD_MIN,
  TRACK_HEIGHT,
} = require('./effort/constants.cjs')
const { EFFORT_CSS } = require('./effort/styles.cjs')
const {
  EFFORT_STARS,
  EMPTY_MODEL_SNAPSHOT,
  clamp01,
  effectiveEffortId,
  effortLevelsOf,
  energyFor,
  fillBackgroundFor,
  fillColorFor,
  indexFromPct,
  indexOfLevel,
  isOffLevel,
  knobOffsetOf,
  modelOf,
  particleCountFor,
  pctFromIndex,
  speedFor,
  starBrightnessFor,
  starCountFor,
  starDelayFor,
  starDurationFor,
  starHash01,
  starLayerOpacityFor,
  valueColorFor,
} = require('./effort/math.cjs')
const { createEffortDirectoryAccess } = require('./effort/directory-access.cjs')
const { createEffortBridge } = require('./effort/bridge.cjs')
const { findEffortRow, findEffortValueElement, findSeatEffort } = require('./effort/dom-probe.cjs')
const { effortErrorText, effortLevelsRow, effortMessage } = require('./effort/messages.cjs')
const { effortSliderEntry } = require('./effort/entry.cjs')
const { readSavedBackgrounds } = require('./backgrounds/store.cjs')
const { readSavedAppearance } = require('./appearance/constants.cjs')
const { readSaved, writeSaved } = require('./theme/selection.cjs')
const { workingEffectCss } = require('./working/constants.cjs')
const {
  INJECTION_CSS,
  INJECTION_ENTRY_ORDER,
  INJECTION_KIND,
  INJECTION_NODE_SLOT,
  INJECTION_SUMMARY_LIMIT,
  INJECTION_TEXT_LIMIT,
  INJECTIONS_KEY,
} = require('./injections/constants.cjs')
const { injectionDefinition, injectionSummary } = require('./injections/definition.cjs')
const { injectionForm, injectionIsWaking, injectionProducer, injectionState, injectionText } = require('./injections/model.cjs')
const { createInjectionBridge } = require('./injections/bridge.cjs')
const { InjectionNodeView, registerInjectionDefinition } = require('./injections/view.cjs')
const {
  injectionSeamOf,
  readSavedInjections,
  setInjectionBridge,
  setInjectionSeam,
  setInjectionSettings,
  writeSavedInjections,
} = require('./injections/state.cjs')
const { PluginUpdateAction, PluginUpdateBadge, PluginUpdateSection, UpdateRow } = require('./update/rows.cjs')

const createThemeOverrides = require('./theme/overrides.cjs')
const createBackgrounds = require('./backgrounds/paint.cjs')
const createAppearance = require('./appearance/index.cjs')
const createStreamInk = require('./stream-ink/index.cjs')
const createReasoningExpand = require('./reasoning/auto-expand.cjs')
const createWorking = require('./working/index.cjs')
const createRunningLabel = require('./working/label.cjs')
const createSettingsPage = require('./settings/page.cjs')
const { createTrayHooks, trayPresentation } = require('./tray/hooks.cjs')

module.exports = {
  inject: ['slots', 'locale', 'theme'],

  /**
   * Build the browser half.
   *
   * Everything a feature needs from another one is handed over here, and nothing
   * reaches back into this scope for it: that is what keeps the features testable
   * on their own and this function short enough to read as a list of what the
   * plugin actually installs.
   * @param ctx - The plugin's own context.
   */
  apply(ctx) {
    ctx.effect(() => ctx.locale.register(LOCALE_NS, DICTIONARY))

    const controller = new AbortController()
    const signal = controller.signal
    const themeStyle = document.createElement('style')
    themeStyle.dataset.plugin = 'dsh-custom-theme'
    themeStyle.dataset.role = 'theme'
    const pageStyle = document.createElement('style')
    pageStyle.dataset.plugin = 'dsh-custom-theme'
    pageStyle.dataset.role = 'page'
    pageStyle.textContent = PAGE_CSS
    // The running label's effect is written here rather than into the page sheet,
    // because it dresses an element the shell owns and has to be replaced whenever
    // the choice changes.
    const workingStyle = document.createElement('style')
    workingStyle.dataset.plugin = 'dsh-custom-theme'
    workingStyle.dataset.role = 'working'
    document.head.append(themeStyle, pageStyle, workingStyle)

    /*
     * The features, built in the order their own setup assumes: the three sheets
     * above are in the document before the background layer and the font sheet
     * append theirs, so equal-specificity rules keep the order they had.
     *
     * `appearance` names the ink and the reasoning tick before either exists —
     * applying the font choices re-ticks both — so it is handed calls that resolve
     * when they run, which is after the two below are built.
     */
    const ticks = { ink: () => {}, reasoning: () => {} }
    const theme = createThemeOverrides({ ctx, signal, style: themeStyle })
    const backgrounds = createBackgrounds({ ctx })
    const appearance = createAppearance({
      ctx,
      tickReasoningExpand: () => ticks.reasoning(),
      tickStreamInk: () => ticks.ink(),
    })
    /** The conversation-stream choices in force, read live by the two features below. */
    const appearanceSettings = () => appearance.settings()
    const ink = createStreamInk({ ctx, appearanceSettings })
    const reasoning = createReasoningExpand({
      appearanceSettings,
      clearStreamInk: ink.clearStreamInk,
      disposeInkStyle: ink.disposeInkStyle,
      scheduleStreamInk: ink.scheduleStreamInk,
      streamInkTargets: ink.streamInkTargets,
    })
    ticks.ink = ink.tickStreamInk
    ticks.reasoning = reasoning.tickReasoningExpand
    const working = createWorking({ ctx })
    const runningLabel = createRunningLabel({ ctx, currentPhrase: working.currentPhrase })

    // The runtime tray pulls through two globals; installing them costs nothing when
    // the Desktop was never patched, and they disappear with the plugin.
    const trayController = createTrayHooks()
    if (typeof ctx.inject === 'function') {
      ctx.inject(['sessions', 'uiSession', 'uiWorkspace', 'workspaces', 'connection'], (scope) => {
        // A scope without `effect` cannot hand out a lifetime, so there is nothing to bind.
        if (typeof scope?.effect !== 'function') return
        scope.effect(() => trayController.bind(scope, () => trayPresentation(ctx)))
      })
    }

    const { ThemeRow } = createSettingsPage({
      UpdateRow,
      trayController,
      applyAppearance: appearance.applyAppearance,
      applyBackgroundsWhenReady: backgrounds.applyBackgroundsWhenReady,
      applyTheme: theme.applyTheme,
      ctx,
      effortLevelsRow,
      injectionSeamOf,
      listBackgrounds,
      listThemes,
      setInjectionSettings,
      setWorkingSettings: working.setWorkingSettings,
      signal,
      themeChangeListeners: theme.themeChangeListeners,
      uploadBackground,
    })

    // Boot: the saved theme, the pictures and the font choices all take effect
    // whether or not the settings page is ever opened.
    const saved = readSaved()
    if (saved !== '') {
      theme.applyTheme(saved).then((applied) => {
        if (!applied) {
          ctx.logger.warn('dsh-custom-theme: saved theme %s is missing', saved)
          writeSaved('')
        }
      }).catch((error) => {
        ctx.logger.warn('dsh-custom-theme: applying %s failed: %s', saved, error.message)
      })
    }
    backgrounds.applyBackgroundsWhenReady(readSavedBackgrounds())
    // The font and line-spacing choices need no shell element to exist.
    appearance.applyAppearance(readSavedAppearance())

    /** The detach function of the running label's rewrite, while one is installed. */
    let runningLabelPatch = null
    ctx.effect(() => () => {
      controller.abort()
      theme.releaseOverrides()
      backgrounds.unwatchPaintedZones()
      backgrounds.clearZoneProperties()
      if (runningLabelPatch !== null) {
        runningLabelPatch()
        runningLabelPatch = null
      }
      themeStyle.remove()
      pageStyle.remove()
      workingStyle.remove()
      backgrounds.disposeLayerStyle()
      appearance.disposeFontStyle()
      reasoning.dispose()
    })

    ctx.slots.inject('settings.section', () => ctx.slots.register({
      name: 'settings.section',
      id: 'dsh-custom-theme',
      order: 30,
      // The shell re-reads the label on every projection, so binding here keeps
      // the nav row following a locale change without re-registering.
      label: () => ctx.locale.bind(LOCALE_NS)('nav'),
      locale: LOCALE_NS,
    }, ThemeRow))

    /*
     * The plugin manager's own page declares these list slots so a bundle can
     * speak about itself where users manage plugins, which is the one place a
     * newer release is worth mentioning. Both entries render null for any other
     * subject; the page's own version and switch stay untouched.
     */
    ctx.slots.inject('plugins.detail.actions', () => ctx.slots.register({
      name: 'plugins.detail.actions',
      id: 'dsh-custom-theme-update',
      order: 40,
      label: () => ctx.locale.bind(LOCALE_NS)('updateTitle'),
      locale: LOCALE_NS,
    }, PluginUpdateAction))

    ctx.slots.inject('plugins.detail.badge', () => ctx.slots.register({
      name: 'plugins.detail.badge',
      id: 'dsh-custom-theme-update',
      order: 40,
      label: () => ctx.locale.bind(LOCALE_NS)('updateTitle'),
      locale: LOCALE_NS,
    }, PluginUpdateBadge))

    ctx.slots.inject('plugins.detail.section', () => ctx.slots.register({
      name: 'plugins.detail.section',
      id: 'dsh-custom-theme-update',
      order: 40,
      label: () => ctx.locale.bind(LOCALE_NS)('updateTitle'),
      locale: LOCALE_NS,
    }, PluginUpdateSection))

    /*
     * The reasoning-effort slider.
     *
     * The entry registers into the composer's own right-hand slot, but draws nothing
     * there: what it is for is the footing. Every session gets an instance, and that
     * instance holds the session id and a hidden element inside *its own* composer — which
     * is how the DOM bridge tells one session's model menu from another's before it
     * dresses the effort row.
     *
     * The injection is nested rather than declared on the plugin itself: `modelDirectories`
     * is the shell's, but a shell that does not expose it must still get the themes, the
     * backgrounds and everything else here. Declaring it at the top would hold the whole
     * row pending, so only this one control goes quiet instead.
     *
     * The *scope* is what the control is handed, not the plugin's own `ctx`: in Cordis a
     * service is readable only from a context that injected it, and this plugin never
     * declares `modelDirectories` (that is the whole point of nesting). Reading it off the
     * outer `ctx` yields undefined, `directoryFor` never runs, the level list stays empty
     * and the slider silently never appears — while the anchor still renders, which is the
     * confusing half of the failure.
     */
    if (typeof ctx.inject === 'function') {
      ctx.inject(['slots', 'modelDirectories'], (scope) => {
        scope.slots.inject(EFFORT_SLOT, () => scope.slots.register({
          name: EFFORT_SLOT,
          id: EFFORT_ENTRY_ID,
          order: EFFORT_ENTRY_ORDER,
          label: () => ctx.locale.bind(LOCALE_NS)('effortLabel'),
          locale: LOCALE_NS,
          // The slot's own props usually carry the session; this is the second way in.
          inject: (sessionId) => ({ sessionId }),
        }, effortSliderEntry(scope)))
      })
    }

    /*
     * The restored injected-context rows.
     *
     * One Definition on the conversation's own registry and one keyed entry in the Chat
     * view's node slot; between them they put back the rows the shell stopped drawing.
     * The injection is nested for the same reason the slider's is — `uiConversation` is
     * the shell's, and a build that does not expose it must still get the themes, the
     * backgrounds and the settings page. Only the switch in the page goes quiet, and the
     * row says so.
     *
     * With the choice off, nothing is registered and the transcript is the shell's own.
     */
    if (typeof ctx.inject === 'function') {
      ctx.inject(['slots', 'uiConversation'], (scope) => {
        if (scope.uiConversation === undefined || typeof scope.uiConversation.events?.register !== 'function') {
          setInjectionSeam('absent')
          return
        }
        setInjectionSeam('ready')
        scope.slots.inject(INJECTION_NODE_SLOT, () => scope.slots.register({
          name: INJECTION_NODE_SLOT,
          key: INJECTION_KIND,
          order: INJECTION_ENTRY_ORDER,
          locale: LOCALE_NS,
        }, InjectionNodeView))
        const bridge = createInjectionBridge(ctx, scope.uiConversation)
        setInjectionBridge(bridge)
        bridge.sync()
        ctx.effect(() => () => {
          setInjectionBridge(null)
          setInjectionSeam('unknown')
          bridge.dispose()
        })
      })
    }

    /*
     * The running label is `chat.deepDiving` / `chat.deepDivingFor`, owned by the
     * shell's `chat` namespace and drawn inside its own Chat view: no slot carries
     * it, and `ctx.locale.register` throws for a namespace and locale that already
     * exist. The wording is therefore swapped one level down, on the lookup every
     * bound `t` dispatches through.
     *
     * The swap is opt-in: with no phrase configured the shipped label is read
     * exactly as it is. The effect beside it is opt-in in the same way — with
     * `official` chosen, no rule is written and the shell keeps its own sweep.
     */
    function syncRunningLabel() {
      workingStyle.textContent = workingEffectCss(working.settings())
      if (runningLabelPatch !== null) {
        runningLabelPatch()
        runningLabelPatch = null
      }
      if (working.settings().texts.length === 0) return
      runningLabelPatch = runningLabel.installRunningLabel(ctx.locale)
      if (runningLabelPatch === null) {
        ctx.logger.warn('dsh-custom-theme: this shell exposes no locale lookup the running label can be reworded through')
      }
    }
    working.setRunningLabelSync(syncRunningLabel)
    syncRunningLabel()
  },

  /**
   * The slider's own parts, exposed for the offline suite.
   *
   * The effect is an *invariant of numbers* — a fill colour at a position, how many stars
   * a position lights, how long one takes to cross — and a suite that could only look at a
   * rendered page could check none of it without a browser. Nothing here is a supported
   * entry point for other plugins: it is the same module, handed to `test/effort.test.mjs`.
   */
  __internals: {
    EMPTY_MODEL_SNAPSHOT,
    EFFORT_CSS,
    EFFORT_SLOT,
    EFFORT_STARS,
    GOLDEN_RATIO,
    modelOf,
    effortLevelsOf,
    effectiveEffortId,
    indexOfLevel,
    clamp01,
    indexFromPct,
    pctFromIndex,
    fillColorFor,
    fillBackgroundFor,
    // Exposed because its clamp is written out rather than imported: `effort/math.cjs`
    // owns `clamp01` and mixes colours, so importing it back would be a cycle. The test
    // pins that the written-out clamp still behaves exactly like it.
    mixColor,
    valueColorFor,
    isOffLevel,
    energyFor,
    speedFor,
    particleCountFor,
    starHash01,
    starBrightnessFor,
    starDurationFor,
    starDelayFor,
    starCountFor,
    starLayerOpacityFor,
    knobOffsetOf,
    createEffortDirectoryAccess,
    createEffortBridge,
    findEffortRow,
    findEffortValueElement,
    findSeatEffort,
    effortErrorText,
    effortSliderEntry,
    effortMessage,
    effortLevelsRow,
    EFFORT_LEVELS_URL,
    ROW_PADDING_BLOCK,
    COMMIT_THROTTLE_MS,
    COMMIT_DEADLINE_MS,
    QUOTA_NOTICE_MS,
    TRACK_HEIGHT,
    KNOB_SIZE,
    KNOB_RADIUS,
    REDUCED_MOTION_SLOWDOWN,
    STARFIELD_DURATION_MEAN,
    STARFIELD_DURATION_SPREAD,
    STARFIELD_MIN,
    MAX_SPEED_FACTOR,
    MIN_HEIGHT_SLOTS,
    ENERGY_START,
    ENERGY_END,
    COLOR_BLUE,
    COLOR_VIOLET,
    COLOR_DEEP,
    COLOR_TEXT_VIOLET,
    COLOR_DEEPSEEK_BASE,
    COLOR_DEEPSEEK_CYAN,
    COLOR_DEEPSEEK_ABYSS,
    COLOR_DEEPSEEK_TEXT,
    EFFORT_THEME_KEY,
    EFFORT_THEME_DEFAULT,
    EFFORT_THEMES,
    normalizeEffortTheme,
    readSavedEffortTheme,
    writeSavedEffortTheme,
    INJECTIONS_KEY,
    INJECTION_CSS,
    INJECTION_KIND,
    INJECTION_NODE_SLOT,
    INJECTION_SUMMARY_LIMIT,
    INJECTION_TEXT_LIMIT,
    injectionDefinition,
    injectionState,
    injectionIsWaking,
    injectionText,
    injectionSummary,
    injectionProducer,
    injectionForm,
    createInjectionBridge,
    registerInjectionDefinition,
    injectionSeamOf,
    readSavedInjections,
    writeSavedInjections,
    setInjectionSettings,
    InjectionNodeView,
  },
}
