/**
 * dsh-custom-theme — browser half.
 *
 * Hand-written in the client module system's lazy-CJS factory format, like the
 * `fixture-input-extension` package: running this script only registers the
 * package name and a factory, and the body runs at first materialization.
 *
 * Registers one Appearance row into the General settings section. The theme list
 * and the stylesheet text come from the Host half's `/dsh-custom-theme/` route,
 * which the Desktop shell forwards to its authenticated Web Host like any other
 * local application request.
 */

window.__ModuleLoader__.load({
  id: 'dsh-custom-theme',
  factory(require) {
    const React = require('react')
    const { IconChevronDownOutlineRegular } = require('@deepseek-ai/dsh-client-ui-primitives')
    const h = React.createElement

    const LIST_URL = '/dsh-custom-theme/themes'
    const CSS_URL = (id) => `/dsh-custom-theme/theme/${encodeURIComponent(id)}.css`
    const BACKGROUNDS_URL = '/dsh-custom-theme/backgrounds'
    const BACKGROUND_URL = (name) => `/dsh-custom-theme/background/${encodeURIComponent(name)}`
    const UPDATE_URL = '/dsh-custom-theme/update'
    const UPDATE_CHECK_URL = '/dsh-custom-theme/update/check'
    const UPDATE_APPLY_URL = '/dsh-custom-theme/update/apply'
    const STORAGE_KEY = 'dsh-custom-theme.selected'
    const STORAGE_KEY_BACKGROUNDS = 'dsh-custom-theme.backgrounds'
    const LOCALE_NS = 'dshCustomTheme'

    /**
     * Zones a background image can be painted on, and the shell element each one
     * targets.
     *
     * The shell's class names are CSS-module hashes (`BynINW_sidebarCol`), so these
     * match the author-chosen suffix instead of a build-specific hash. `global`
     * targets the app frame, which is the element that already paints the base
     * surface. Verified against the shell at the time of writing; a rename in a
     * later shell build leaves the zone inert rather than breaking the card.
     */
    const ZONES = [
      { id: 'global', labelKey: 'zoneGlobal', selector: '[class*="_frame"]' },
      { id: 'windowbar', labelKey: 'zoneWindowbar', selector: 'header' },
      { id: 'sidebar', labelKey: 'zoneSidebar', selector: '[class*="_sidebarCol"]' },
      { id: 'conversation', labelKey: 'zoneConversation', selector: '[class*="_centerCol"]' },
      { id: 'composer', labelKey: 'zoneComposer', selector: '[data-composer-seat]' },
      { id: 'dock', labelKey: 'zoneDock', selector: '[data-rightbar-col]' },
    ]

    /** `background-position` keywords offered per zone. */
    const POSITIONS = ['center', 'top', 'bottom', 'left', 'right']

    /** Locale key for one of {@link POSITIONS}. */
    const positionKey = (position) => `pos${position.charAt(0).toUpperCase()}${position.slice(1)}`

    /**
     * Picture-alpha bounds.
     *
     * Deeptop caps this well below 1 so a picture can never obscure the shell's own
     * surfaces; the same cap is kept here.
     */
    const OPACITY_MIN = 0.05
    const OPACITY_MAX = 0.45

    /**
     * Picture-blur bounds, in px.
     *
     * Deeptop's range: 0 (the default) leaves the picture sharp, 16 is its ceiling.
     */
    const BLUR_MIN = 0
    const BLUR_MAX = 16

    /**
     * How opaque each zone's own panel fill stays, as a percentage.
     *
     * Deeptop's per-zone defaults: only the whole-app frame is fully opaque, so the
     * app backdrop shows faintly through the panels. Bounded to 0–100.
     */
    const PANEL_OPACITY = {
      global: 100,
      windowbar: 94,
      sidebar: 92,
      conversation: 91,
      composer: 91,
      dock: 92,
    }

    /** Defaults for one zone, matching the Deeptop background model. */
    function defaultZoneConfig(zone) {
      return {
        name: '',
        opacity: 0.18,
        panelOpacity: PANEL_OPACITY[zone] ?? 100,
        blur: 0,
        size: 'cover',
        position: 'center',
      }
    }

    const PAGE_CSS = `
.dct-page { display: flex; flex-direction: column; max-width: 760px; }
.dct-heading { margin: 0 0 6px; font-size: 15px; font-weight: 600; color: var(--dsw-alias-label-primary, inherit); }
.dct-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 0; }
.dct-text { flex: 1 1 auto; min-width: 160px; }
.dct-title { font-size: 14px; color: var(--dsw-alias-label-primary, inherit); }
.dct-hint { margin-top: 2px; font-size: 12px; color: var(--dsw-alias-label-secondary, inherit); }
.dct-control { display: flex; flex: none; align-items: center; gap: 8px; }
.dct-select { max-width: 220px; padding: 4px 8px; font: inherit; font-size: 13px; color: var(--dsw-alias-label-primary, inherit); background: var(--dsw-alias-bg-layer-2, transparent); border: 1px solid var(--dsw-alias-border-l1, currentColor); border-radius: 6px; }
.dct-button { padding: 4px 10px; font: inherit; font-size: 13px; color: var(--dsw-alias-label-primary, inherit); background: var(--dsw-alias-bg-layer-2, transparent); border: 1px solid var(--dsw-alias-border-l1, currentColor); border-radius: 6px; cursor: pointer; }
.dct-button:disabled, .dct-select:disabled { opacity: 0.5; cursor: default; }
.dct-error { margin-top: 6px; font-size: 12px; color: var(--dsw-alias-state-error-primary, #d33); }
/* The background row carries six controls, so it wraps to the width it is given
   rather than squeezing the label down to one character per line. */
.dct-wrap { flex-wrap: wrap; justify-content: flex-end; gap: 6px; max-width: 62%; }
.dct-number { width: 58px; padding: 4px 6px; font: inherit; font-size: 13px; color: var(--dsw-alias-label-primary, inherit); background: var(--dsw-alias-bg-layer-2, transparent); border: 1px solid var(--dsw-alias-border-l1, currentColor); border-radius: 6px; }
.dct-sub { margin-top: 4px; align-items: flex-start; }
.dct-sub .dct-wrap .dct-select { max-width: 130px; }
.dct-area { width: 260px; min-height: 54px; padding: 4px 8px; font: inherit; font-size: 13px; color: var(--dsw-alias-label-primary, inherit); background: var(--dsw-alias-bg-layer-2, transparent); border: 1px solid var(--dsw-alias-border-l1, currentColor); border-radius: 6px; resize: vertical; }
.dct-area::placeholder { color: var(--dsw-alias-label-caption, currentColor); opacity: 0.85; }
.dct-sub .dct-wrap .dct-input { width: 130px; }
/* The update row, the badge beside the plugin page's title, and the section that
   page renders under its own content. */
.dct-update-badge { padding: 2px 8px; font-size: 12px; color: var(--dsw-alias-label-primary, inherit); background: var(--dsw-alias-bg-layer-2, transparent); border: 1px solid var(--dsw-alias-border-l1, currentColor); border-radius: 10px; }
.dct-update-section { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--dsw-alias-border-l1, currentColor); }
.dct-update-section .dct-text { margin-bottom: 8px; }
.dct-update-section .dct-control { justify-content: flex-start; }
`

    /** Read the persisted selection; an unreadable store means no selection. */
    function readSaved() {
      try {
        const value = window.localStorage.getItem(STORAGE_KEY)
        return typeof value === 'string' ? value : ''
      } catch {
        return ''
      }
    }

    /** Persist the selection; an unwritable store leaves the in-memory choice only. */
    function writeSaved(id) {
      try {
        if (id === '') window.localStorage.removeItem(STORAGE_KEY)
        else window.localStorage.setItem(STORAGE_KEY, id)
      } catch {
        // A blocked storage backend is a supported state for this row.
      }
    }

    return {
      inject: ['slots', 'locale', 'theme'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(LOCALE_NS, {
          zh: {
            nav: '主题与背景',
            convTitle: '对话流',
            convHint: '正文字号、行距、正文字体、代码字体，右侧四项依次对应',
            fontSize: '正文字号',
            lineGap: '行距',
            fontFamily: '正文字体',
            codeFontFamily: '代码字体',
            fontFollow: '跟随官方默认',
            fontSystem: '系统默认',
            fontYahei: '微软雅黑',
            fontNoto: 'Noto Sans SC',
            fontSerif: 'Georgia 衬线',
            fontCustom: '自定义（沿用旧值）',
            codeCascadia: 'Cascadia Mono',
            codeJetbrains: 'JetBrains Mono',
            codeSarasa: 'Sarasa Mono SC',
            workTitle: '工作时文字',
            workHint: '一行一条，运行期间轮播；留空则完全沿用官方文案',
            workPlaceholder: '深度求索中',
            workInterval: '轮播间隔',
            title: '自定义主题',
            scheme: '明暗模式',
            schemeHint: '主题自带深浅两套时，跟随这里切换',
            schemeLight: '浅色',
            schemeDark: '深色',
            schemeSystem: '跟随系统',
            hint: '从主题目录读取 CSS；也可直接向该目录放入新的 .css 文件',
            none: '跟随官方主题',
            refresh: '重新扫描',
            loading: '正在加载…',
            failed: '主题加载失败',
            bgTitle: '背景图片',
            bgHint: '从背景目录选择图片；也可直接向该目录放入图片文件',
            bgConfigured: '部分区域已设置背景',
            bgZone: '区域',
            bgImage: '图片',
            bgNone: '无',
            bgOpacity: '图片透明度',
            bgBlur: '背景模糊',
            bgFit: '填充',
            bgCover: '覆盖',
            bgContain: '完整显示',
            bgPosition: '位置',
            bgClear: '清除',
            zoneGlobal: '整体',
            zoneWindowbar: '标题栏',
            zoneSidebar: '侧边栏',
            zoneConversation: '会话区',
            zoneComposer: '对话框',
            zoneDock: '工具面板',
            posCenter: '居中',
            posTop: '顶部',
            posBottom: '底部',
            posLeft: '左侧',
            posRight: '右侧',
            updateTitle: '插件更新',
            updateHint: '从 npm 检查这个插件的新版本；升级会自动装好，重启后生效',
            updateCurrent: '当前版本',
            updateCheck: '检查更新',
            updateChecking: '检查中…',
            updateLatest: '最新版本',
            updateUpgrade: '升级',
            updateUpgrading: '升级中…',
            updateRestart: '新版本已装好，重启 DeepSeek Harness 后生效',
            updateUpToDate: '已是最新版本',
            updateUnavailable: '插件管理器不可用，无法检查更新',
            updateFailed: '检查更新失败',
            updateBadge: '有更新',
          },
          en: {
            nav: 'Theme & background',
            convTitle: 'Conversation stream',
            convHint: 'Text size, line spacing, text font and code font — the four controls on the right in that order.',
            fontSize: 'Text size',
            lineGap: 'Line spacing',
            fontFamily: 'Text font',
            codeFontFamily: 'Code font',
            fontFollow: 'Follow the official default',
            fontSystem: 'System default',
            fontYahei: 'Microsoft YaHei',
            fontNoto: 'Noto Sans SC',
            fontSerif: 'Georgia (serif)',
            fontCustom: 'Custom (kept value)',
            codeCascadia: 'Cascadia Mono',
            codeJetbrains: 'JetBrains Mono',
            codeSarasa: 'Sarasa Mono SC',
            workTitle: 'Working text',
            workHint: 'One phrase per line, cycled while a turn runs. Leave it empty to keep the official wording.',
            workPlaceholder: 'Deep diving...',
            workInterval: 'Rotation',
            title: 'Custom theme',
            scheme: 'Light and dark',
            schemeHint: 'A theme carrying both sets follows this',
            schemeLight: 'Light',
            schemeDark: 'Dark',
            schemeSystem: 'Follow the system',
            hint: 'Reads CSS from the theme directory; drop in another .css file to add one',
            none: 'Follow the built-in theme',
            refresh: 'Rescan',
            loading: 'Loading…',
            failed: 'Theme failed to load',
            bgTitle: 'Background image',
            bgHint: 'Pick an image from the background directory; drop image files in to add them',
            bgConfigured: 'Some zones have a background',
            bgZone: 'Zone',
            bgImage: 'Image',
            bgNone: 'None',
            bgOpacity: 'Image opacity',
            bgBlur: 'Background blur',
            bgFit: 'Fit',
            bgCover: 'Cover',
            bgContain: 'Contain',
            bgPosition: 'Position',
            bgClear: 'Clear',
            zoneGlobal: 'Whole app',
            zoneWindowbar: 'Title bar',
            zoneSidebar: 'Sidebar',
            zoneConversation: 'Conversation',
            zoneComposer: 'Composer',
            zoneDock: 'Tool panel',
            posCenter: 'Center',
            posTop: 'Top',
            posBottom: 'Bottom',
            posLeft: 'Left',
            posRight: 'Right',
            updateTitle: 'Plugin update',
            updateHint: 'Checks npm for a newer release; upgrading installs it, and a restart makes it active',
            updateCurrent: 'Installed',
            updateCheck: 'Check for updates',
            updateChecking: 'Checking…',
            updateLatest: 'Latest',
            updateUpgrade: 'Upgrade',
            updateUpgrading: 'Upgrading…',
            updateRestart: 'Installed; restart DeepSeek Harness to activate it',
            updateUpToDate: 'Up to date',
            updateUnavailable: 'The plugin manager is unavailable, so updates cannot be checked',
            updateFailed: 'The update check failed',
            updateBadge: 'Update available',
          },
        }))

        const controller = new AbortController()
        const themeStyle = document.createElement('style')
        themeStyle.dataset.plugin = 'dsh-custom-theme'
        themeStyle.dataset.role = 'theme'
        const pageStyle = document.createElement('style')
        pageStyle.dataset.plugin = 'dsh-custom-theme'
        pageStyle.dataset.role = 'page'
        pageStyle.textContent = PAGE_CSS
        document.head.append(themeStyle, pageStyle)
        ctx.effect(() => () => {
          controller.abort()
          releaseOverrides()
          clearZoneProperties()
          themeStyle.remove()
          pageStyle.remove()
        })

        /** Fetch the theme ids the Host half found in the theme directory. */
        async function listThemes() {
          const response = await fetch(LIST_URL, { signal: controller.signal, cache: 'no-store' })
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const payload = await response.json()
          return Array.isArray(payload?.themes)
            ? payload.themes.map((theme) => theme.id).filter((id) => typeof id === 'string')
            : []
        }

    /**
     * Selectors that scope a rule to the dark palette.
     *
     * `data-ds-dark-theme` is what this shell sets on `body`; `data-theme="dark"`
     * is the convention Deeptop's own theme files use, so a file written for it
     * classifies correctly here even though the attribute name differs.
     */
    const DARK_SCOPE = /data-ds-dark-theme|data-theme\s*=\s*["']?dark|prefers-color-scheme\s*:\s*dark/iu

    /** One custom-property declaration, quoted values kept intact. */
    const TOKEN_DECLARATION = /(--[A-Za-z0-9_-]+)\s*:\s*((?:[^;{}"']|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')+)/gu

    /**
     * Call `visit` with the body of every rule in a stylesheet and whether that
     * rule sits under a dark scope.
     *
     * Recurses through at-rules, so a dark set written as
     * `@media (prefers-color-scheme: dark) { :root { … } }` is classified the same
     * as one written behind `body[data-ds-dark-theme]`.
     * @param source - Stylesheet text, comments already removed.
     * @param dark - Whether an enclosing rule already scoped this region dark.
     * @param visit - Receives each rule body and its dark scope.
     */
    function eachRuleBody(source, dark, visit) {
      let cursor = 0
      for (;;) {
        const open = source.indexOf('{', cursor)
        if (open === -1) return
        const header = source.slice(cursor, open).trim()
        let depth = 1
        let position = open + 1
        while (position < source.length && depth > 0) {
          if (source[position] === '{') depth += 1
          else if (source[position] === '}') depth -= 1
          position += 1
        }
        const body = source.slice(open + 1, position - 1)
        const scoped = dark || DARK_SCOPE.test(header)
        if (header.startsWith('@')) eachRuleBody(body, scoped, visit)
        else visit(body, scoped)
        cursor = position
      }
    }

    /**
     * Collect the custom-property declarations of a stylesheet, split by palette.
     *
     * Theme authors write `:root { --dsw-alias-bg-base: … }` because that is the
     * CSS convention, but the declarations are re-applied through the official
     * theme runtime (see `applyTheme`), so this reads them out of any selector
     * block. A theme may carry one palette or a light/dark pair, the pair written
     * the way the shell writes its own — see {@link DARK_SCOPE}.
     * @param css - Stylesheet text.
     * @returns `light` and `dark` token names to values, later declarations winning.
     */
    function parseTokenDeclarations(css) {
      const source = css.replace(/\/\*[\s\S]*?\*\//gu, '')
      const light = new Map()
      const dark = new Map()
      eachRuleBody(source, false, (body, isDark) => {
        for (const match of body.matchAll(TOKEN_DECLARATION)) {
          // A trailing `!important` would be part of the value once the runtime
          // re-emits it as an inline custom property.
          const value = match[2].trim().replace(/\s*!important\s*$/iu, '').trim()
          if (value !== '') (isDark ? dark : light).set(match[1], value)
        }
      })
      return { light, dark }
    }

    /** Override-layer source id; also names the layer's origin for inspection. */
    const THEME_ID_PREFIX = 'dsh-custom-theme'

    /**
     * Rec. 709 luma of a colour, in whatever syntax its author wrote it.
     *
     * The stylesheet states the colour however it likes, so this hands the value
     * to the browser instead of recognising syntaxes. A probe inside `body`
     * resolves it — including a `var()` naming a token the shell declares, which
     * a detached element could not see — and a canvas pixel then converts the
     * result to sRGB: `getComputedStyle().color` alone is not enough, because it
     * reports `oklch()` and friends back in the colour space they were written in.
     * @param value - A colour as written in the theme.
     * @returns Luma on 0–1, or `null` when the browser accepts no such colour.
     */
    function resolveLuma(value) {
      if (typeof value !== 'string' || value.trim() === '') return null
      const probe = document.createElement('span')
      probe.style.color = value
      if (probe.style.color === '') return null
      probe.style.position = 'absolute'
      probe.style.visibility = 'hidden'
      document.body.append(probe)
      const computed = getComputedStyle(probe).color
      probe.remove()
      if (computed === '' || !CSS.supports('color', computed)) return null
      const canvas = document.createElement('canvas')
      canvas.width = 1
      canvas.height = 1
      const context = canvas.getContext('2d')
      if (context === null) return null
      context.fillStyle = computed
      context.fillRect(0, 0, 1, 1)
      const [r, g, b] = context.getImageData(0, 0, 1, 1).data
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
    }

    /**
     * Which base palette a theme builds on, or `null` when it does not say.
     *
     * The shell switches its entire base palette from `body[data-ds-dark-theme]`,
     * so a theme that overrides alias tokens alone inherits the base of whichever
     * scheme the user last picked, and every token it does not override keeps that
     * scheme's colour — a light theme over a dark base leaves dark surfaces behind.
     * `setTheme` is what switches that attribute, so asking for the scheme is what
     * lets a partial palette come out coherent instead of half-applied.
     *
     * Only a theme with no dark set of its own needs this; one carrying a pair
     * leaves the preference alone. An explicit `/* dsh:color-scheme light *\/`
     * directive wins; otherwise the luma of `--dsw-alias-bg-base` decides. A colour
     * this cannot read yields `null`, and the caller then leaves the preference
     * where the user put it rather than guessing a scheme for it.
     * @param css - Stylesheet text.
     * @param tokens - The theme's light-palette token declarations.
     * @returns `'light'`, `'dark'`, or `null`.
     */
    function themeColorScheme(css, tokens) {
      const declared = /\/\*\s*dsh:color-scheme\s+(light|dark)\s*\*\//u.exec(css)
      if (declared !== null) return declared[1]
      const luma = resolveLuma(tokens.get('--dsw-alias-bg-base'))
      if (luma === null) return null
      return luma > 0.5 ? 'light' : 'dark'
    }

    /**
     * Drop `!important` from the token declarations of an injected theme sheet.
     *
     * The official runtime applies the palette as inline custom properties, and an
     * important stylesheet declaration outranks a normal inline one — so leaving
     * the author's `!important` in place would let this sheet shadow the runtime it
     * just handed the same values to. Non-token rules (`body { font-family }`)
     * keep theirs.
     * @param css - Stylesheet text.
     * @returns The stylesheet with token declarations de-escalated.
     */
    function relaxTokenPriority(css) {
      return css.replace(
        /(--[A-Za-z0-9_-]+\s*:\s*(?:[^;{}"']|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')+?)\s*!important/gu,
        '$1',
      )
    }

    /**
     * Disposer of the override layer currently stacked on the official runtime.
     *
     * A layer rather than a registered theme: a layer applies on top of whichever
     * theme is active and survives a preference change, so a settings transport
     * that lands after boot cannot silently undo it.
     */
    let releaseOverrides = () => {}

    /**
     * Serial number of the newest apply request.
     *
     * The layer is identified by one source, so a boot-time apply that is still
     * fetching must lose to a selection made while it was in flight.
     */
    let applySeq = 0

    /** Scheme a single-palette theme forced, or `null` when the theme adapts. */
    let appliedScheme = null

    /** Notified when the applied theme is dropped outside this card's own select. */
    const themeChangeListeners = new Set()

    /**
     * Drop a single-palette theme once the base palette moves to the other scheme.
     *
     * A pair theme adapts, so the appearance preference keeps deciding and this
     * leaves it alone. A single-palette theme cannot adapt: its layer carries one
     * set of values for both modes, so switching scheme keeps every token it
     * declares while the base palette flips, leaving a window split across the two.
     * Unloading it returns the whole window to the built-in palette instead.
     */
    function syncSelection() {
      if (appliedScheme === null) return
      if (ctx.theme.getTheme().active.colorScheme === appliedScheme) return
      // Deferred: releasing the layer publishes, and a nested publish lets the
      // remaining listeners of the outer emit apply its now-stale snapshot, which
      // still carries the theme's values. Let the current emit finish first.
      const scheme = appliedScheme
      queueMicrotask(() => {
        if (appliedScheme !== scheme) return
        releaseOverrides()
        appliedScheme = null
        writeSaved('')
        for (const listener of themeChangeListeners) listener('')
      })
    }
    ctx.on('theme/change', syncSelection)

    /**
     * Apply one theme, or clear back to the built-in palette.
     *
     * The tokens go to the official theme runtime as an override layer rather
     * than into a stylesheet, so the presenter applies them exactly as it applies
     * its own. `setTheme` still selects the base palette the theme asks for: the
     * override layer covers only the tokens the theme declares, and every token it
     * leaves alone would otherwise keep the colour of whichever scheme the user
     * last picked. Only the theme's non-token rules reach a stylesheet.
     * @param id - Theme id, or an empty string to clear.
     * @returns Whether the theme was applied.
     */
    async function applyTheme(id) {
      const seq = ++applySeq
      releaseOverrides()
      appliedScheme = null
      themeStyle.textContent = ''
      if (id === '') return true
      const response = await fetch(CSS_URL(id), { signal: controller.signal, cache: 'no-store' })
      if (!response.ok) return false
      const css = await response.text()
      if (seq !== applySeq) return false
      const { light, dark } = parseTokenDeclarations(css)
      // A token declared in one palette only still has to reach both, or it would
      // be undefined in the other — the API takes a pair for every token.
      const modes = {}
      for (const name of new Set([...light.keys(), ...dark.keys()])) {
        modes[name] = {
          light: light.get(name) ?? dark.get(name),
          dark: dark.get(name) ?? light.get(name),
        }
      }
      releaseOverrides = ctx.theme.overrideTokens(THEME_ID_PREFIX, modes)
      // A theme with a dark set of its own adapts, and the appearance preference
      // keeps deciding which set applies. A theme stating one palette states one
      // look, so the base palette has to follow it: every token it leaves alone
      // would otherwise keep the other scheme's colour. Assigned after `setTheme`,
      // whose `theme/change` must not see this as a pending drop. A theme whose
      // base colour cannot be read gets no scheme of its own, so the user's
      // preference stands rather than being moved on a guess.
      if (dark.size === 0 && light.size > 0) {
        const scheme = themeColorScheme(css, light)
        if (scheme !== null) {
          ctx.theme.setTheme(scheme)
          appliedScheme = scheme
        }
      }
      themeStyle.textContent = relaxTokenPriority(css)
      return true
    }

        /**
     * Parse the `rgb()`/`rgba()` form `getComputedStyle` returns, including its
     * alpha, so a fully transparent surface can be told from a painted one.
     */
    function parseColor(value) {
      const match = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?\s*\)$/u
        .exec(typeof value === 'string' ? value : '')
      if (match === null) return null
      return {
        r: Number(match[1]),
        g: Number(match[2]),
        b: Number(match[3]),
        a: match[4] === undefined ? 1 : Number(match[4]),
      }
    }

    /**
     * Re-emit a parsed colour at a new alpha; opaque black when unparseable.
     *
     * The alpha is rounded because it is usually computed as `1 - opacity`, and
     * that subtraction leaves values like `0.19999999999999996` in the DOM.
     */
    function withAlpha(color, alpha) {
      const rounded = Math.round(alpha * 1000) / 1000
      return color === null ? `rgba(0, 0, 0, ${rounded})` : `rgba(${color.r}, ${color.g}, ${color.b}, ${rounded})`
    }

    /** Read the per-zone background settings, dropping anything out of range. */
    function readSavedBackgrounds() {
      const settings = {}
      for (const zone of ZONES) settings[zone.id] = defaultZoneConfig(zone.id)
      try {
        const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY_BACKGROUNDS) ?? 'null')
        if (parsed === null || typeof parsed !== 'object') return settings
        for (const zone of ZONES) {
          const stored = parsed[zone.id]
          if (stored === null || typeof stored !== 'object') continue
          const config = settings[zone.id]
          if (typeof stored.name === 'string') config.name = stored.name
          const opacity = Number(stored.opacity)
          if (Number.isFinite(opacity)) config.opacity = Math.min(OPACITY_MAX, Math.max(OPACITY_MIN, opacity))
          const panelOpacity = Number(stored.panelOpacity)
          if (Number.isFinite(panelOpacity)) {
            config.panelOpacity = Math.min(100, Math.max(0, panelOpacity))
          }
          const blur = Number(stored.blur)
          if (Number.isFinite(blur)) config.blur = Math.min(BLUR_MAX, Math.max(BLUR_MIN, Math.round(blur)))
          if (stored.size === 'cover' || stored.size === 'contain') config.size = stored.size
          if (POSITIONS.includes(stored.position)) config.position = stored.position
        }
      } catch {
        // A blocked or corrupt store means the defaults.
      }
      return settings
    }

    /** Persist the per-zone settings; an all-empty set removes the entry. */
    function writeSavedBackgrounds(settings) {
      try {
        if (ZONES.every((zone) => settings[zone.id].name === '')) {
          window.localStorage.removeItem(STORAGE_KEY_BACKGROUNDS)
        } else {
          window.localStorage.setItem(STORAGE_KEY_BACKGROUNDS, JSON.stringify(settings))
        }
      } catch {
        // A blocked storage backend is a supported state for this row.
      }
    }

    /** Inline properties this plugin set on shell elements, for exact removal. */
    let zoneProperties = []

    /**
     * The colour each painted surface's panel fill is based on, for the current pass.
     *
     * Two zones can resolve to the same surface — the composer seat and the tool
     * column both sit inside the conversation column — and the second paint would
     * otherwise read the translucent fill the first one wrote as its basis and
     * compound the transparency. Reset per pass, alongside the removed overrides.
     */
    let zoneBases = new Map()

    /** Attributes this plugin set on shell elements, for exact removal. */
    let zoneAttributes = []

    /** Timer for the bounded retry that waits for the shell's zones to mount. */
    let zoneTimer = null

    /**
     * The picture-layer stylesheet.
     *
     * A `::before` layer cannot be styled inline, so its declarations live here. Each
     * rule names the surface through the generated `data-dct-layer` attribute the
     * paint pass sets, which keeps two zones that land on one surface from having to
     * share a selector. The sheet is rebuilt on every pass and emptied on every
     * clear, so a zone with no picture leaves nothing behind.
     */
    const layerStyle = document.createElement('style')
    layerStyle.dataset.plugin = 'dsh-custom-theme'
    layerStyle.dataset.role = 'background-layer'
    document.head.append(layerStyle)

    /** The layer rules of the current pass, in zone order. */
    let layerRules = []

    /**
     * Serial number behind each layer's own `data-dct-layer` attribute.
     *
     * The rule cannot be keyed on `data-dct-zone`: two zones can resolve to the same
     * surface element (the composer seat sits inside the conversation column), and an
     * element carries one value of each attribute, so the first zone's rule would
     * stop matching as soon as the second zone overwrote the tag. A per-pass serial
     * gives every painted layer a selector that is unique by construction.
     */
    let layerSerial = 0

    /** Drop every layer rule; called at the start of each pass. */
    function clearLayerRules() {
      layerRules = []
      layerSerial = 0
      layerStyle.textContent = ''
    }

    /**
     * Record one zone's picture layer.
     *
     * The declaration block is what makes the picture its own layer rather than the
     * surface's `background-image`: only a separate box can carry the picture's own
     * alpha and a blur without fading or smearing the shell's text, which shares the
     * surface element. `z-index: -1` puts it under the shell's content, and
     * `inset: 0` sizes it to the surface, so the stack is panel fill → picture →
     * content.
     * @param theLayer - The selector's unique identifier.
     * @param config - `name`, `opacity`, `size`, `position` and `blur` for the zone.
     */
    function addLayerRule(theLayer, config) {
      layerRules.push(`[data-dct-layer="${theLayer}"]::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background-image: url("${BACKGROUND_URL(config.name)}");
  background-repeat: no-repeat;
  background-size: ${config.size};
  background-position: ${config.position};
  ${config.blur > 0 ? `filter: blur(${config.blur}px);` : ''}
  opacity: ${Math.round(config.opacity * 1000) / 1000};
}`)
    }

    /** Publish the pass's layer rules as one sheet. */
    function flushLayerRules() {
      layerStyle.textContent = layerRules.join('\n')
    }

    /** Remove every inline property and attribute the previous application set. */
    function clearZoneProperties() {
      for (const { element, property } of zoneProperties) element.style.removeProperty(property)
      zoneProperties = []
      zoneBases = new Map()
      for (const { element, name } of zoneAttributes) element.removeAttribute(name)
      zoneAttributes = []
      clearLayerRules()
      if (zoneTimer !== null) {
        window.clearTimeout(zoneTimer)
        zoneTimer = null
      }
    }

    /** Set one inline property and remember it for {@link clearZoneProperties}. */
    function setZoneProperty(element, property, value) {
      element.style.setProperty(property, value, 'important')
      zoneProperties.push({ element, property })
    }

    /**
     * Find the element that actually paints a zone's visible surface.
     *
     * A zone is an outer layout box, and the shell paints the surface the user
     * sees from a descendant component root that covers that box completely. The
     * deepest such opaque descendant is the one to paint on; painting the outer
     * box would be hidden behind it.
     * @param anchor - The zone's outer element.
     * @returns The deepest opaque descendant covering `anchor`, else `anchor`.
     */
    function surfaceOf(anchor) {
      const anchorRect = anchor.getBoundingClientRect()
      const covers = (rect) => rect.width >= anchorRect.width - 1 && rect.height >= anchorRect.height - 1
        && rect.left <= anchorRect.left + 1 && rect.top <= anchorRect.top + 1
        && rect.right >= anchorRect.right - 1 && rect.bottom >= anchorRect.bottom - 1
      let best = { element: anchor, depth: -1 }
      let budget = 20000
      const walk = (element, depth) => {
        for (const child of element.children) {
          if (budget-- <= 0) return
          // The shell wraps its painted roots in zero-size or transparent boxes,
          // so the search descends through elements that do not cover the zone
          // themselves. Only a covering, opaque element can become the surface.
          if (covers(child.getBoundingClientRect())) {
            const color = parseColor(getComputedStyle(child).backgroundColor)
            if (color !== null && color.a > 0 && depth > best.depth) best = { element: child, depth }
          }
          walk(child, depth + 1)
        }
      }
      walk(anchor, 0)
      return best.element
    }

    /**
     * The colour a zone's panel fill is built from.
     *
     * Some anchors — the header, the composer seat, the dock column — have a
     * transparent background of their own and take their colour from an ancestor.
     * Building a fill from such a surface would leave the picture at full strength
     * whatever the fill is set to, so the nearest opaque ancestor supplies the
     * colour instead.
     * @param surface - The painted element.
     * @returns A colour string.
     */
    function tintBasis(surface) {
      const known = zoneBases.get(surface)
      if (known !== undefined) return known
      let fallback = null
      for (let node = surface; node !== null; node = node.parentElement) {
        const color = getComputedStyle(node).backgroundColor
        if (color === '' || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') continue
        // A translucent colour is skipped rather than used: it is either the shell's
        // own panel fill or this plugin's own override from an earlier paint, and
        // neither is a stable basis for a fill. `rgb(...)` is opaque by definition.
        if (color.startsWith('rgb(') || color.endsWith(', 1)')) {
          zoneBases.set(surface, color)
          return color
        }
        if (fallback === null) fallback = color
      }
      const basis = fallback ?? 'rgb(0, 0, 0)'
      zoneBases.set(surface, basis)
      return basis
    }

    /**
     * Paint one zone's picture.
     *
     * The surface element only keeps the two things the layer needs from it: the
     * panel fill, and a stacking context for the layer to sit in. The picture itself
     * goes on a `::before` layer, so the stack reads panel fill → picture → the
     * shell's own content.
     *
     * `isolation: isolate` is what makes that order hold. Without it the layer's
     * `z-index: -1` escapes to the nearest ancestor stacking context and can be
     * hidden behind a background that is painted there; with it, the layer is
     * confined to this surface, above its own background and below its content, and
     * no `z-index` is put on the surface itself, so the shell's own layering is left
     * alone. A `static` surface also needs `position: relative` for the layer to be
     * constrained by it.
     * @param anchor - The zone's outer element.
     * @param config - `name`, `opacity`, `panelOpacity`, `size`, `position` and
     * `blur` for the zone.
     */
    function paintZone(anchor, config) {
      const surface = surfaceOf(anchor)
      const basis = tintBasis(surface)
      const color = parseColor(basis)
      // The panel fill sits under the picture, so its own alpha is what decides how
      // much of the app backdrop shows through. Only an incomplete fill is written:
      // leaving the shell's own colour alone at 100% keeps whatever alpha it had.
      if (config.panelOpacity < 100) {
        setZoneProperty(surface, 'background-color', withAlpha(color, config.panelOpacity / 100))
      }
      // The layer escapes to the nearest ancestor stacking context unless this
      // surface becomes one, which would let an ancestor's background cover the
      // picture. `isolation` creates that context without adding a `z-index`, so the
      // shell's own layering is left exactly as it was.
      setZoneProperty(surface, 'isolation', 'isolate')
      // An absolutely positioned layer is laid out against its nearest positioned
      // ancestor, so a static surface would let the picture escape the element it is
      // meant to fill. This only ever runs on a static surface: one that is already
      // positioned keeps the containing block its own descendants already use.
      if (getComputedStyle(surface).position === 'static') setZoneProperty(surface, 'position', 'relative')
      // The colour the fill was built from, recorded so tooling and tests can read the
      // basis. `basis` was captured before the fill above overrode the element's own
      // computed colour, so what is recorded is the surface's real colour.
      surface.setAttribute('data-dct-tint', basis)
      zoneAttributes.push({ element: surface, name: 'data-dct-tint' })
      surface.setAttribute('data-dct-zone', config.zone)
      zoneAttributes.push({ element: surface, name: 'data-dct-zone' })
      const theLayer = String(++layerSerial)
      surface.setAttribute('data-dct-layer', theLayer)
      zoneAttributes.push({ element: surface, name: 'data-dct-layer' })
      addLayerRule(theLayer, config)
    }

    /**
     * Whether a set of boxes together covers `anchor`.
     *
     * Sampled on a grid rather than compared edge by edge, because the shell's
     * boxes overlap arbitrarily.
     * @param anchor - The element to cover.
     * @param others - Candidate covering elements; `undefined` entries are skipped.
     * @returns True when every sampled point lies inside some box.
     */
    function fullyCovered(anchor, others) {
      const rect = anchor.getBoundingClientRect()
      const boxes = others.filter((element) => element !== undefined).map((element) => element.getBoundingClientRect())
      const steps = 8
      for (let column = 0; column <= steps; column++) {
        for (let row = 0; row <= steps; row++) {
          const x = rect.left + (rect.width * column) / steps
          const y = rect.top + (rect.height * row) / steps
          if (!boxes.some((box) => x >= box.left && x <= box.right && y >= box.top && y <= box.bottom)) return false
        }
      }
      return true
    }

    /**
     * Paint every configured zone.
     *
     * `global` paints the other zones as well, because the shell's columns cover
     * the frame completely and only their own surfaces are visible. A zone with
     * its own image is painted after the global one, so it wins.
     * @param settings - Per-zone settings from {@link readSavedBackgrounds}.
     * @returns Whether the shell's zone elements were found.
     */
    function applyBackgrounds(settings) {
      clearZoneProperties()
      const targets = new Map()
      for (const zone of ZONES) {
        const element = document.querySelector(zone.selector)
        if (element !== null) targets.set(zone.id, element)
      }
      const ordered = ZONES.filter((zone) => zone.id !== 'global')
      if (settings.global.name !== '') {
        const others = ordered.map((zone) => targets.get(zone.id))
        for (const zone of ZONES) {
          const anchor = targets.get(zone.id)
          if (anchor === undefined) continue
          // A zone with an image of its own is painted below, over the global one.
          if (zone.id !== 'global' && settings[zone.id].name !== '') continue
          // The column fills are translucent, so painting a fully covered frame as
          // well would show the same picture twice and read stronger than configured.
          if (zone.id === 'global' && fullyCovered(anchor, others)) continue
          // The global entry supplies the picture, its alpha and its blur; how opaque
          // the panel fill stays is a property of the zone itself, so it is taken from
          // that zone's own entry even when the picture comes from the global one.
          paintZone(anchor, { ...settings.global, panelOpacity: settings[zone.id].panelOpacity, zone: zone.id })
        }
      }
      for (const zone of ordered) {
        const anchor = targets.get(zone.id)
        if (anchor === undefined || settings[zone.id].name === '') continue
        paintZone(anchor, { ...settings[zone.id], zone: zone.id })
      }
      // Only a zone the user actually configured can be reported missing; a warn
      // on every repaint would fire for everyone who never sets a background.
      for (const zone of ZONES) {
        if (settings[zone.id].name !== '' && !targets.has(zone.id)) {
          ctx.logger.warn('dsh-custom-theme: zone %s has an image but matched no element (%s)', zone.id, zone.selector)
        }
      }
      flushLayerRules()
      return targets.size > 0
    }

    /**
     * Apply the backgrounds once the shell has rendered its zones.
     *
     * At boot the plugin can run before the shell mounts, so a bounded retry waits
     * for the zone elements instead of dropping the settings silently.
     * @param settings - Per-zone settings.
     * @param attempt - Retry counter; the wait gives up after roughly five seconds.
     */
    function applyBackgroundsWhenReady(settings, attempt = 0) {
      if (applyBackgrounds(settings)) return
      if (attempt >= 20) return
      zoneTimer = window.setTimeout(() => {
        zoneTimer = null
        applyBackgroundsWhenReady(settings, attempt + 1)
      }, 250)
    }

    /** localStorage key holding the conversation-stream choices. */
    const APPEARANCE_KEY = 'dsh-custom-theme.appearance'
    /** Extra line spacing the user may add, in px, on top of the shell's line height. */
    const LINE_GAP_MIN = -4
    const LINE_GAP_MAX = 8
    const LINE_GAPS = Array.from({ length: LINE_GAP_MAX - LINE_GAP_MIN + 1 }, (_, index) => LINE_GAP_MIN + index)
    /** Content font sizes the official runtime accepts (`FONT_SIZE_MIN`..`FONT_SIZE_MAX`). */
    const FONT_SIZES = [12, 13, 14, 15, 16, 17]

    /** Text stacks offered for the stream. The empty value leaves the shell's own. */
    const TEXT_FONT_PRESETS = [
      { value: '', labelKey: 'fontFollow' },
      { value: '"Segoe UI Variable", "Segoe UI", "Microsoft YaHei UI", sans-serif', labelKey: 'fontSystem' },
      { value: '"Microsoft YaHei UI", "Microsoft YaHei", sans-serif', labelKey: 'fontYahei' },
      { value: '"Noto Sans SC", "Noto Sans CJK SC", sans-serif', labelKey: 'fontNoto' },
      { value: 'Georgia, "Times New Roman", serif', labelKey: 'fontSerif' },
    ]

    /** Code stacks offered for fenced blocks. */
    const CODE_FONT_PRESETS = [
      { value: '', labelKey: 'fontFollow' },
      { value: '"Cascadia Mono", Consolas, monospace', labelKey: 'codeCascadia' },
      { value: '"JetBrains Mono", "Cascadia Mono", Consolas, monospace', labelKey: 'codeJetbrains' },
      { value: '"Sarasa Mono SC", "Cascadia Mono", Consolas, monospace', labelKey: 'codeSarasa' },
    ]

    /**
     * Preset options, plus the stored value itself when it is not one of them, so a
     * stack an earlier version or a hand-edited entry left behind stays selectable
     * instead of silently resetting.
     * @param presets - Offered stacks.
     * @param current - The stored stack.
     * @param t - The page's translate seat.
     * @returns Option elements.
     */
    function fontOptions(presets, current, t) {
      const options = presets.map((preset) => h('option', { key: preset.value, value: preset.value }, t(preset.labelKey)))
      if (current !== '' && !presets.some((preset) => preset.value === current)) {
        options.push(h('option', { key: 'custom', value: current }, t('fontCustom')))
      }
      return options
    }

    /** Strip the characters that would end a declaration early. */
    function cleanFont(value) {
      return typeof value === 'string' ? value.replace(/[;{}]/gu, '').trim() : ''
    }

    /** Read the saved conversation-stream choices, clamped to what the runtime accepts. */
    function readSavedAppearance() {
      let raw = {}
      try {
        const parsed = JSON.parse(localStorage.getItem(APPEARANCE_KEY) ?? '{}')
        if (parsed !== null && typeof parsed === 'object') raw = parsed
      } catch {
        // A corrupt entry falls back to the shell's own rendering.
      }
      const gap = Number(raw.lineGap)
      return {
        lineGap: Number.isFinite(gap) ? Math.min(LINE_GAP_MAX, Math.max(LINE_GAP_MIN, Math.round(gap))) : 0,
        fontFamily: cleanFont(raw.fontFamily),
        codeFontFamily: cleanFont(raw.codeFontFamily),
      }
    }

    /**
     * Stylesheet carrying the conversation-stream choices.
     *
     * The shell declares the font families on `:root` and the line-height delta on
     * `body`, so each override has to be declared on the same element the shell
     * uses: a value inherited from `:root` loses to the shell's own `body` rule.
     */
    const fontStyle = document.createElement('style')
    fontStyle.dataset.plugin = 'dsh-custom-theme'
    fontStyle.dataset.role = 'appearance'
    document.head.append(fontStyle)

    /**
     * Declare the conversation-stream overrides, or withdraw a field by leaving it
     * out once it is back at the shell's default.
     * @param settings - Choices from {@link readSavedAppearance}.
     */
    function applyAppearance(settings) {
      const root = []
      const body = []
      if (settings.fontFamily !== '') root.push(`--dsw-font-family: ${settings.fontFamily};`)
      if (settings.codeFontFamily !== '') root.push(`--ds-font-family-code: ${settings.codeFontFamily};`)
      // The shell derives every content line height from this delta, so adding to
      // it keeps the whole stream in step instead of pinning one absolute height.
      if (settings.lineGap !== 0) {
        body.push(`--dsh-content-font-delta: calc(var(--dsh-content-font-size, 14px) - 14px + ${settings.lineGap}px);`)
      }
      // Raised specificity, not source order: the shell installs its own palette
      // styles at boot and may do so after this plugin runs, so an equal-specificity
      // `:root`/`body` rule would lose to it depending on who ran last.
      fontStyle.textContent = [
        root.length > 0 ? `html:root {\n  ${root.join('\n  ')}\n}` : '',
        body.length > 0 ? `html body {\n  ${body.join('\n  ')}\n}` : '',
      ].filter(Boolean).join('\n')
    }

    /** localStorage key holding the working-indicator choices. */
    const WORKING_KEY = 'dsh-custom-theme.working'
    /** Caps the official indicator accepts: at most 12 phrases of 120 characters. */
    const WORKING_MAX_TEXTS = 12
    const WORKING_MAX_LENGTH = 120
    /** Rotation intervals offered, in ms. */
    const WORKING_INTERVALS = [1200, 1800, 2400, 3000, 4000, 6000, 8000, 10000]
    const WORKING_INTERVAL_DEFAULT = 2400

    /** Read the saved working-indicator choices. */
    function readSavedWorking() {
      let raw = {}
      try {
        const parsed = JSON.parse(localStorage.getItem(WORKING_KEY) ?? '{}')
        if (parsed !== null && typeof parsed === 'object') raw = parsed
      } catch {
        // A corrupt entry falls back to the official label.
      }
      const texts = (Array.isArray(raw.texts) ? raw.texts : [])
        .filter((item) => typeof item === 'string')
        .map((item) => item.trim().slice(0, WORKING_MAX_LENGTH))
        .filter(Boolean)
        .slice(0, WORKING_MAX_TEXTS)
      const interval = Number(raw.interval)
      return {
        texts,
        interval: WORKING_INTERVALS.includes(interval) ? interval : WORKING_INTERVAL_DEFAULT,
      }
    }

    let workingSettings = readSavedWorking()
    /** Rows subscribe here, because the indicator lives outside the settings page. */
    const workingListeners = new Set()
    /** Set by `apply` to mount or unmount the replacement row as phrases come and go. */
    let turnRowSync = null

    /** Persist the working-indicator choices and repaint every subscriber. */
    function setWorkingSettings(next) {
      localStorage.setItem(WORKING_KEY, JSON.stringify({ texts: next.texts, interval: next.interval }))
      // Re-read rather than trust the caller, so the stored and live values share
      // one normalization path and cannot drift apart.
      workingSettings = readSavedWorking()
      for (const listener of workingListeners) listener()
      if (turnRowSync !== null) turnRowSync()
    }

    /**
     * Whether whole-turn collapse is unavailable.
     *
     * Restated from the shell's `turnProcessAlwaysOpen`: live, stopped and failed
     * Turns stay open.
     * @param node - Node carrying the owning Turn.
     * @returns Whether the row must not be collapsible.
     */
    function turnProcessAlwaysOpen(node) {
      const location = node?.location
      if (location?.kind !== 'turn' && location?.kind !== 'step') return false
      const reason = location.turn.end?.data.reason.kind
      return location.turn.status === 'open' || reason === 'aborted' || reason === 'error'
    }

    /**
     * The official turn-process row under this plugin's class names.
     *
     * Every declaration is copied from `ui-chat/chat/TurnProcessNodeView.module.css`
     * and `accessibility.module.css` so a replaced row keeps the shipped look.
     */
    const TURN_ROW_CSS = [
      '.dct-turn-row { box-sizing: border-box; display: flex; align-items: center; width: 100%; min-width: 0;',
      '  height: calc(33px + var(--dsh-content-font-delta, 0px)); padding: 0 0 8px; border: none;',
      '  border-bottom: 0.5px solid var(--dsw-alias-border-l2); background: none; color: var(--dsw-alias-label-tertiary);',
      '  cursor: pointer; text-align: left; transition: color 100ms ease; }',
      '.dct-turn-row:disabled { cursor: default; }',
      '.dct-turn-row:not(:disabled):hover { color: var(--dsw-alias-label-primary); }',
      '.dct-turn-row:not([data-open]) { margin-bottom: 8px; }',
      '.dct-turn-chevron { flex: none; width: 14px; height: 14px; margin-left: 4px;',
      '  color: var(--dsw-alias-label-caption); transition: transform 100ms ease; }',
      '.dct-turn-row[data-open] .dct-turn-chevron { transform: rotate(180deg); }',
      '.dct-turn-label { min-width: 0; overflow: hidden; font-size: var(--dsh-content-font-size, 14px);',
      '  line-height: calc(24px + var(--dsh-content-font-delta, 0px)); text-overflow: ellipsis; white-space: nowrap; }',
      '.dct-visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden;',
      '  clip: rect(0 0 0 0); white-space: nowrap; }',
      '@media (prefers-reduced-motion: reduce) { .dct-turn-row, .dct-turn-chevron { transition: none; } }',
    ].join('\n')

    const turnRowStyle = document.createElement('style')
    turnRowStyle.dataset.plugin = 'dsh-custom-theme'
    turnRowStyle.dataset.role = 'turn-row'
    turnRowStyle.textContent = TURN_ROW_CSS
    document.head.append(turnRowStyle)

    /**
     * Replacement for the shell's `turn-process` row.
     *
     * Reproduces the official component's markup, styling, icon, locale strings,
     * duration formatting and collapse rule. The one intended difference is that a
     * configured phrase replaces the running label; with none configured the label
     * resolves through the same official keys, so the row reads as shipped.
     * @param props - The owner props the official row receives.
     * @returns The disclosure row, or null while the Turn carries no start.
     */
    function TurnProcessRow({ node, turnProcess, t }) {
      if (turnProcess === undefined) throw new Error('turn-process node requires Turn process owner state')
      const open = !turnProcess.foldable || turnProcess.open
      const turn = node.location.kind === 'turn' || node.location.kind === 'step' ? node.location.turn : undefined
      const [spoken, setSpoken] = React.useState(0)
      const [, setRevision] = React.useState(0)
      const ticking = turn?.status === 'open'
      const texts = workingSettings.texts
      // The phrase clock restarts with each live Turn.
      React.useEffect(() => {
        if (!ticking) return undefined
        setSpoken(0)
        if (texts.length < 2) return undefined
        const timer = setInterval(() => { setSpoken((value) => value + 1) }, workingSettings.interval)
        return () => { clearInterval(timer) }
      }, [ticking, texts.length, workingSettings.interval])
      // The row lives in the transcript, so it has to hear about settings changes.
      React.useEffect(() => {
        const listener = () => setRevision((value) => value + 1)
        workingListeners.add(listener)
        return () => { workingListeners.delete(listener) }
      }, [])
      if (turn?.start === undefined && turn?.status !== 'closed') return null
      const canCollapse = turnProcess.foldable && turnProcess.hasContent && !turnProcessAlwaysOpen(node)
      const running = turn.status === 'open'
      const reason = turn.end?.data.reason.kind
      // Only parameter-free keys: the seat a replacement row receives does not
      // interpolate parameters, so a template carrying a placeholder renders with the
      // slot empty. The shipped row shows an elapsed time, which is part of why it is
      // left in place until a phrase makes the replacement worthwhile.
      const phrase = texts[spoken % texts.length]
      const label = running ? phrase
        : reason === 'aborted' ? t('message.stopped')
          : reason === 'error' ? t('message.turnProcess.failed')
            : t('message.turnProcess.worked')
      const announcement = label
      return h(React.Fragment, null,
        h('span', {
          className: 'dct-visually-hidden',
          role: 'status',
          'aria-live': 'polite',
          'aria-atomic': 'true',
        }, announcement),
        h('button', {
          type: 'button',
          className: 'dct-turn-row',
          'data-open': open || undefined,
          'data-turn-process': node.data.turn,
          'data-turn-process-messages': node.data.messageCount,
          'data-turn-process-tool-calls': node.data.toolCallCount,
          'data-turn-process-subagents': node.data.subagentCount,
          disabled: !canCollapse,
          'aria-expanded': turnProcess.hasContent ? open : undefined,
          onClick: (event) => {
            event.currentTarget.focus()
            turnProcess.setOpen(!open)
          },
        },
        h('span', { className: 'dct-turn-label' }, label),
        canCollapse ? h(IconChevronDownOutlineRegular, { className: 'dct-turn-chevron' }) : null))
    }

    const saved = readSaved()
    if (saved !== '') {
      applyTheme(saved).then((applied) => {
        if (!applied) {
          ctx.logger.warn('dsh-custom-theme: saved theme %s is missing', saved)
          writeSaved('')
        }
      }).catch((error) => {
        ctx.logger.warn('dsh-custom-theme: applying %s failed: %s', saved, error.message)
      })
    }
    // Backgrounds apply on boot whether or not the settings page is ever opened.
    applyBackgroundsWhenReady(readSavedBackgrounds())
    // So do the font and line-spacing choices, which need no shell element to exist.
    applyAppearance(readSavedAppearance())

    /**
     * Names of the images the Host lists.
     * @returns Image file names in the background directory.
     */
    async function listBackgrounds() {
      const response = await fetch(BACKGROUNDS_URL, { signal: controller.signal, cache: 'no-store' })
      if (!response.ok) throw new Error(`backgrounds listing failed: ${response.status}`)
      const payload = await response.json()
      return Array.isArray(payload.backgrounds) ? payload.backgrounds.map((entry) => entry.name) : []
    }

    /*
     * Update state, shared by the two places that show it: this card's own row and
     * the entry contributed to the plugin manager's page. The Host caches its check,
     * so both surfaces read one request instead of racing two.
     */
    /** This package's name, which the detail-page subject is matched against. */
    const PLUGIN_PACKAGE = 'dsh-custom-theme'

    /** Latest snapshot: `phase` is `idle`, `loading`, `applying` or `failed`. */
    let updateSnapshot = { phase: 'idle', state: null, reason: '', result: null }
    const updateListeners = new Set()

    /** Publish a snapshot to every mounted surface. */
    function publishUpdate(next) {
      updateSnapshot = next
      for (const listener of updateListeners) listener(next)
    }

    /** The current snapshot without subscribing, for a mount that just needs it. */
    function readUpdate() {
      return updateSnapshot
    }

    /** The in-flight load, so two surfaces mounting together ask the Host once. */
    let updateLoad = null

    /**
     * Load the Host's update state.
     * @param options - `force` asks the Host to query the registries again rather
     *   than answer from its cache.
     */
    function loadUpdate({ force = false } = {}) {
      if (updateLoad !== null) return updateLoad
      const promise = (async () => {
        publishUpdate({ ...updateSnapshot, phase: 'loading', reason: '' })
        try {
          const response = force
            ? await fetch(UPDATE_CHECK_URL, { method: 'POST', cache: 'no-store' })
            : await fetch(UPDATE_URL, { cache: 'no-store' })
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          publishUpdate({ phase: 'idle', state: await response.json(), reason: '', result: null })
        } catch (error) {
          publishUpdate({ ...updateSnapshot, phase: 'failed', reason: error.message })
        }
      })()
      updateLoad = promise
      const clear = () => { if (updateLoad === promise) updateLoad = null }
      promise.then(clear, clear)
      return promise
    }

    /** Install the release the last check resolved, then re-read what the Host reports. */
    async function applyUpdateNow() {
      publishUpdate({ ...updateSnapshot, phase: 'applying', reason: '' })
      try {
        const response = await fetch(UPDATE_APPLY_URL, { method: 'POST', cache: 'no-store' })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const result = await response.json()
        if (result.status !== 'ok') {
          publishUpdate({ ...updateSnapshot, phase: 'failed', reason: result.reason ?? '' })
          return
        }
        // The Host now reports a pending restart in place of the same upgrade.
        await loadUpdate()
        publishUpdate({ ...readUpdate(), result })
      } catch (error) {
        publishUpdate({ ...updateSnapshot, phase: 'failed', reason: error.message })
      }
    }

    /** Subscribe to the shared snapshot, loading it once per page. */
    function useUpdate() {
      const [snapshot, setSnapshot] = React.useState(readUpdate)
      React.useEffect(() => {
        updateListeners.add(setSnapshot)
        setSnapshot(readUpdate())
        // A failed load leaves no state behind, so reopening a surface retries it.
        if (readUpdate().state === null) loadUpdate()
        return () => { updateListeners.delete(setSnapshot) }
      }, [])
      return snapshot
    }

    /**
     * The line of state text under the update controls.
     * @param snapshot - The shared snapshot.
     * @param t - Translate function for this plugin's namespace.
     * @returns One sentence describing what the Host reported.
     */
    function updateText(snapshot, t) {
      const state = snapshot.state
      // A failure outranks the state text: the state still describes the release it
      // found, so repeating that here would hide why the upgrade did not happen.
      if (snapshot.phase === 'failed') return `${t('updateFailed')}: ${snapshot.reason}`
      if (state === null) return t('updateChecking')
      // A finished upgrade outranks everything else the state could say: the files
      // are in place, and only a restart is left.
      if (state.pendingRestart !== undefined && state.pendingRestart !== null) {
        return `${t('updateRestart')} (${state.pendingRestart})`
      }
      if (state.status === 'unavailable') return t('updateUnavailable')
      if (state.status !== 'ok') return `${t('updateFailed')}: ${state.reason ?? ''}`
      if (state.updateAvailable === true) return `${t('updateLatest')} ${state.latest}`
      return `${t('updateUpToDate')} (${state.current})`
    }

    /** Whether the shared snapshot justifies offering the upgrade control. */
    function canUpgrade(snapshot) {
      const state = snapshot.state
      return state !== null
        && state.status === 'ok'
        && state.updateAvailable === true
        && (state.pendingRestart === undefined || state.pendingRestart === null)
    }

    /**
     * The update controls, rendered both as a row on this card and as a section on
     * the plugin manager's page for this bundle.
     * @param props - `t` plus `as`, the element and class the controls sit in.
     */
    function UpdateRow({ t, as = 'row' }) {
      const snapshot = useUpdate()
      const busy = snapshot.phase === 'loading' || snapshot.phase === 'applying'
      const controls = [
        canUpgrade(snapshot) ? h('button', {
          key: 'upgrade',
          type: 'button',
          className: 'dct-button dct-upgrade',
          disabled: busy,
          onClick: () => { applyUpdateNow() },
        }, snapshot.phase === 'applying' ? t('updateUpgrading') : `${t('updateUpgrade')} ${snapshot.state.latest}`) : null,
        h('button', {
          key: 'check',
          type: 'button',
          className: 'dct-button dct-check-update',
          disabled: busy,
          onClick: () => { loadUpdate({ force: true }) },
        }, snapshot.phase === 'loading' ? t('updateChecking') : t('updateCheck')),
      ]
      const body = [
        h('div', { key: 'text', className: 'dct-text' },
          h('div', { className: 'dct-title' }, t('updateTitle')),
          h('div', { className: 'dct-hint' }, updateText(snapshot, t))),
        h('div', { key: 'control', className: 'dct-control' }, controls),
      ]
      return as === 'section'
        ? h('section', { className: 'dct-update-section' }, body)
        : h('div', { className: 'dct-row dct-update-row' }, body)
    }

    /** Whether a detail-page subject is this plugin's own bundle. */
    function isOwnBundle(subject) {
      return subject !== null && subject !== undefined
        && subject.kind === 'bundle'
        && subject.pkg !== undefined
        && subject.pkg.name === PLUGIN_PACKAGE
    }

    /**
     * The badge beside the plugin's title, drawn only when a newer release exists.
     * Every other subject renders nothing, which is what the slot expects.
     */
    function PluginUpdateBadge({ subject, t }) {
      const snapshot = useUpdate()
      if (!isOwnBundle(subject)) return null
      if (!canUpgrade(snapshot)) return null
      return h('span', { className: 'dct-update-badge' }, `${t('updateBadge')} ${snapshot.state.latest}`)
    }

    /** The update section under the plugin page's own content. */
    function PluginUpdateSection({ subject, t }) {
      if (!isOwnBundle(subject)) return null
      return h(UpdateRow, { t, as: 'section' })
    }

    function ThemeRow({ t }) {
      const [themes, setThemes] = React.useState([])
      const [selected, setSelected] = React.useState(readSaved)
      const [status, setStatus] = React.useState('idle')
      const [images, setImages] = React.useState([])
      const [backgrounds, setBackgrounds] = React.useState(readSavedBackgrounds)
      const [zone, setZone] = React.useState('global')
      const [preference, setPreference] = React.useState(() => ctx.theme.getTheme().preference)
      const [appearance, setAppearance] = React.useState(readSavedAppearance)
      const [fontSize, setFontSize] = React.useState(() => ctx.theme.getTheme().fontSize)
      const [working, setWorking] = React.useState(readSavedWorking)

      const rescan = React.useCallback(async () => {
        setStatus('loading')
        try {
          const [ids, names] = await Promise.all([listThemes(), listBackgrounds()])
          setThemes(ids)
          setImages(names)
          setSelected((current) => (current !== '' && !ids.includes(current) ? '' : current))
          setStatus('idle')
        } catch (error) {
          setStatus(error.name === 'AbortError' ? 'idle' : 'failed')
        }
      }, [])

      React.useEffect(() => { rescan() }, [rescan])

      // The official Appearance row can drop a single-palette theme; follow it so
      // the select never shows a theme the window is not painting.
      React.useEffect(() => {
        themeChangeListeners.add(setSelected)
        return () => { themeChangeListeners.delete(setSelected) }
      }, [])

      // The shell renders one settings section at a time, so the official
      // appearance row is off-screen whenever this page is open. This page carries
      // its own switch for the same preference: both write through `setTheme` and
      // this follows `theme/change`, so the two can never disagree.
      React.useEffect(() => ctx.on('theme/change', (snapshot) => {
        setPreference(snapshot.preference)
        setFontSize(snapshot.fontSize)
      }), [])

      const onSelect = React.useCallback(async (event) => {
        const id = event.target.value
        setSelected(id)
        setStatus('loading')
        try {
          const applied = await applyTheme(id)
          if (applied) writeSaved(id)
          // A panel fill is built from the live surface colour, so the zones have to
          // be repainted whenever the palette under them changes.
          applyBackgroundsWhenReady(backgrounds)
          setStatus(applied ? 'idle' : 'failed')
        } catch (error) {
          setStatus(error.name === 'AbortError' ? 'idle' : 'failed')
        }
      }, [backgrounds])

      /** Patch one field of the selected zone, then persist and repaint. */
      const updateZone = React.useCallback((patch) => {
        setBackgrounds((current) => {
          const next = { ...current, [zone]: { ...current[zone], ...patch } }
          writeSavedBackgrounds(next)
          applyBackgroundsWhenReady(next)
          return next
        })
      }, [zone])

      /** Persist one conversation-stream choice, then redeclare the overrides. */
      const updateAppearance = React.useCallback((patch) => {
        setAppearance((current) => {
          const next = { ...current, ...patch }
          localStorage.setItem(APPEARANCE_KEY, JSON.stringify(next))
          applyAppearance(next)
          return next
        })
      }, [])

      /** Persist one working-indicator choice; the live transcript row repaints itself. */
      const updateWorking = React.useCallback((patch) => {
        setWorking((current) => {
          setWorkingSettings({ ...current, ...patch })
          return readSavedWorking()
        })
      }, [])

      const config = backgrounds[zone]
      const configured = ZONES.filter((item) => backgrounds[item.id].name !== '').length
      const busy = status === 'loading'
      const noImage = config.name === ''

      return h('div', { className: 'dct-page' },
        h('h2', { className: 'dct-heading' }, t('nav')),
        h('div', { className: 'dct-row' },
          h('div', { className: 'dct-text' },
            h('div', { className: 'dct-title' }, t('title')),
            h('div', { className: 'dct-hint' }, busy ? t('loading') : t('hint'))),
          h('div', { className: 'dct-control' },
            h('select', {
              className: 'dct-select dct-theme',
              value: selected,
              disabled: busy,
              'aria-label': t('title'),
              onChange: onSelect,
            },
            h('option', { value: '' }, t('none')),
            themes.map((id) => h('option', { key: id, value: id }, id))),
            h('button', {
              type: 'button',
              className: 'dct-button dct-rescan',
              disabled: busy,
              onClick: rescan,
            }, t('refresh')))),
        h('div', { className: 'dct-row' },
          h('div', { className: 'dct-text' },
            h('div', { className: 'dct-title' }, t('scheme')),
            h('div', { className: 'dct-hint' }, t('schemeHint'))),
          h('div', { className: 'dct-control' },
            h('select', {
              className: 'dct-select dct-scheme',
              value: preference,
              'aria-label': t('scheme'),
              onChange: (event) => { ctx.theme.setTheme(event.target.value) },
            },
            h('option', { value: 'light' }, t('schemeLight')),
            h('option', { value: 'dark' }, t('schemeDark')),
            h('option', { value: 'system' }, t('schemeSystem'))))),
        h('div', { className: 'dct-row dct-sub' },
          h('div', { className: 'dct-text' },
            h('div', { className: 'dct-title' }, t('convTitle')),
            h('div', { className: 'dct-hint' }, t('convHint'))),
          h('div', { className: 'dct-control dct-wrap' },
            h('select', {
              className: 'dct-select dct-fontsize',
              value: String(fontSize),
              'aria-label': t('fontSize'),
              onChange: (event) => {
                const px = Number(event.target.value)
                ctx.theme.setFontSize(px)
                setFontSize(px)
              },
            }, FONT_SIZES.map((px) => h('option', { key: px, value: String(px) }, `${px}px`))),
            h('select', {
              className: 'dct-select dct-linegap',
              value: String(appearance.lineGap),
              'aria-label': t('lineGap'),
              onChange: (event) => updateAppearance({ lineGap: Number(event.target.value) }),
            }, LINE_GAPS.map((gap) => h('option', { key: gap, value: String(gap) }, gap > 0 ? `+${gap}px` : `${gap}px`))),
            h('select', {
              className: 'dct-select dct-font',
              value: appearance.fontFamily,
              'aria-label': t('fontFamily'),
              onChange: (event) => updateAppearance({ fontFamily: event.target.value }),
            }, fontOptions(TEXT_FONT_PRESETS, appearance.fontFamily, t)),
            h('select', {
              className: 'dct-select dct-codefont',
              value: appearance.codeFontFamily,
              'aria-label': t('codeFontFamily'),
              onChange: (event) => updateAppearance({ codeFontFamily: event.target.value }),
            }, fontOptions(CODE_FONT_PRESETS, appearance.codeFontFamily, t)))),
        h('div', { className: 'dct-row dct-sub' },
          h('div', { className: 'dct-text' },
            h('div', { className: 'dct-title' }, t('workTitle')),
            h('div', { className: 'dct-hint' }, t('workHint'))),
          h('div', { className: 'dct-control dct-wrap' },
            h('textarea', {
              className: 'dct-area dct-working',
              value: working.texts.join('\n'),
              placeholder: t('workPlaceholder'),
              'aria-label': t('workTitle'),
              onChange: (event) => updateWorking({ texts: event.target.value.split('\n') }),
            }),
            h('select', {
              className: 'dct-select dct-interval',
              value: String(working.interval),
              'aria-label': t('workInterval'),
              onChange: (event) => updateWorking({ interval: Number(event.target.value) }),
            }, WORKING_INTERVALS.map((ms) => h('option', { key: ms, value: String(ms) }, `${ms / 1000}s`))))),
        h('div', { className: 'dct-row dct-sub' },
          h('div', { className: 'dct-text' },
            h('div', { className: 'dct-title' }, t('bgTitle')),
            h('div', { className: 'dct-hint' }, configured > 0 ? t('bgConfigured') : t('bgHint'))),
          h('div', { className: 'dct-control dct-wrap' },
            h('select', {
              className: 'dct-select dct-zone',
              value: zone,
              disabled: busy,
              'aria-label': t('bgZone'),
              onChange: (event) => setZone(event.target.value),
            }, ZONES.map((item) => h('option', { key: item.id, value: item.id }, t(item.labelKey)))),
            h('select', {
              className: 'dct-select dct-image',
              value: config.name,
              disabled: busy,
              'aria-label': t('bgImage'),
              onChange: (event) => updateZone({ name: event.target.value }),
            },
            h('option', { value: '' }, t('bgNone')),
            images.map((name) => h('option', { key: name, value: name }, name))),
            h('input', {
              className: 'dct-number dct-opacity',
              type: 'number',
              min: OPACITY_MIN * 100,
              max: OPACITY_MAX * 100,
              step: 5,
              value: Math.round(config.opacity * 100),
              disabled: busy || noImage,
              'aria-label': t('bgOpacity'),
              onChange: (event) => {
                const percent = Number(event.target.value)
                if (Number.isFinite(percent)) {
                  updateZone({ opacity: Math.min(OPACITY_MAX * 100, Math.max(OPACITY_MIN * 100, percent)) / 100 })
                }
              },
            }),
            h('input', {
              className: 'dct-number dct-blur',
              type: 'number',
              min: BLUR_MIN,
              max: BLUR_MAX,
              step: 1,
              value: config.blur,
              disabled: busy || noImage,
              'aria-label': t('bgBlur'),
              onChange: (event) => {
                const pixels = Number(event.target.value)
                if (Number.isFinite(pixels)) {
                  updateZone({ blur: Math.min(BLUR_MAX, Math.max(BLUR_MIN, Math.round(pixels))) })
                }
              },
            }),
            h('select', {
              className: 'dct-select dct-fit',
              value: config.size,
              disabled: busy || noImage,
              'aria-label': t('bgFit'),
              onChange: (event) => updateZone({ size: event.target.value }),
            },
            h('option', { value: 'cover' }, t('bgCover')),
            h('option', { value: 'contain' }, t('bgContain'))),
            h('select', {
              className: 'dct-select dct-position',
              value: config.position,
              disabled: busy || noImage,
              'aria-label': t('bgPosition'),
              onChange: (event) => updateZone({ position: event.target.value }),
            }, POSITIONS.map((position) => h('option', { key: position, value: position }, t(positionKey(position))))),
            h('button', {
              type: 'button',
              className: 'dct-button dct-clear',
              disabled: noImage,
              onClick: () => updateZone({ name: '' }),
            }, t('bgClear')))),
        h(UpdateRow, { t }),
        status === 'failed' ? h('div', { className: 'dct-error', role: 'status' }, t('failed')) : null)
    }

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
         * The running label is `chat.deepDiving`, owned by the shell's `chat`
         * namespace. `ctx.locale.register` throws for a namespace and locale that
         * already exist, and no slot carries that label on its own, so replacing the
         * row is the only way to reword it.
         *
         * The replacement is opt-in. The official component cannot be rendered from
         * here, so replacing it by default would mean reproducing a shell build this
         * plugin cannot read — and the installed build already differs from the
         * published sources in both wording and copy, so a copy would silently miss.
         * With no phrase configured, the shipped row stays exactly in place.
         */
        let turnRowInject = null
        function syncTurnRow() {
          if (turnRowInject !== null) {
            turnRowInject()
            turnRowInject = null
          }
          if (workingSettings.texts.length === 0) return
          turnRowInject = ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
            name: 'conversation.chat.node',
            key: 'turn-process',
            priority: -1,
            locale: 'chat',
          }, TurnProcessRow))
        }
        turnRowSync = syncTurnRow
        syncTurnRow()
      },
    }
  },
})
