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
.dct-unit { font-size: 12px; color: var(--dsw-alias-label-secondary, inherit); margin: 0 4px 0 1px; align-self: center; }
.dct-sub { margin-top: 4px; align-items: flex-start; }
.dct-sub .dct-wrap .dct-select { max-width: 130px; }
.dct-area { width: 260px; min-height: 54px; padding: 4px 8px; font: inherit; font-size: 13px; color: var(--dsw-alias-label-primary, inherit); background: var(--dsw-alias-bg-layer-2, transparent); border: 1px solid var(--dsw-alias-border-l1, currentColor); border-radius: 6px; resize: vertical; }
.dct-area::placeholder { color: var(--dsw-alias-label-caption, currentColor); opacity: 0.85; }
.dct-sub .dct-wrap .dct-input { width: 130px; }
/* One colour choice: the picker, and the value it is sitting on. */
.dct-color { display: inline-flex; align-items: center; gap: 6px; }
.dct-color-input { width: 34px; height: 26px; padding: 2px; background: transparent; border: 1px solid var(--dsw-alias-border-l1, currentColor); border-radius: 6px; cursor: pointer; }
.dct-color-code { font-size: 11px; color: var(--dsw-alias-label-secondary, inherit); }
/* The page's sample of the running label. It carries no effect rules of its own: the
   stylesheet the effect writes addresses .dct-work-preview and .dct-work-effect exactly
   as it addresses the transcript's bar, so the sample is dressed by the same declarations
   — including the token its band is painted with, which is why the caption takes its own
   colour back below. */
.dct-work-preview { display: flex; align-items: center; gap: 10px; min-height: 34px; margin: 0 0 12px; padding: 9px 12px; font-size: 14px; background: var(--dsw-alias-bg-layer-2, transparent); border: 1px solid var(--dsw-alias-border-l1, currentColor); border-radius: 8px; }
.dct-work-preview > small { margin-left: auto; font-size: 11px; color: var(--dsw-alias-label-secondary, inherit); }
.dct-work-preview-note { font-size: 12px; color: var(--dsw-alias-label-secondary, inherit); }
/* The sample's band, built the way the shell builds its own: the label is the solid
   colour, and a decorative copy of the text sits in a masked window that slides across
   it while the copy slides the other way, so the glyphs stay put and the tint travels.
   The tint is the shell's own shimmer token, which is what one colour choice sets for
   both the sample and the real label. */
.dct-work-effect { position: relative; display: inline-block; white-space: pre; }
.dct-work-sweep { position: absolute; inset: 0; overflow: hidden; color: var(--dsw-alias-label-shimmer, currentColor); pointer-events: none; user-select: none;
  mask-image: linear-gradient(105deg, transparent 0%, black 40% 60%, transparent 100%);
  -webkit-mask-image: linear-gradient(105deg, transparent 0%, black 40% 60%, transparent 100%);
  transform: translateX(-100%); animation: dct-work-band 1.5s steps(48, end) infinite; }
.dct-work-sweep-text { display: block; width: 100%; height: 100%; color: inherit; transform: translateX(100%); animation: dct-work-band-text 1.5s steps(48, end) infinite; }
@keyframes dct-work-band { 0% { transform: translateX(-100%); } 66.6667%, 100% { transform: translateX(100%); } }
@keyframes dct-work-band-text { 0% { transform: translateX(100%); } 66.6667%, 100% { transform: translateX(-100%); } }
@media (prefers-reduced-motion: reduce) { .dct-work-sweep { display: none; } }
/* The update row, the badge beside the plugin page's title, and the section that
   page renders under its own content. */
.dct-update-badge { padding: 2px 8px; font-size: 12px; color: var(--dsw-alias-label-primary, inherit); background: var(--dsw-alias-bg-layer-2, transparent); border: 1px solid var(--dsw-alias-border-l1, currentColor); border-radius: 10px; }
.dct-update-section { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--dsw-alias-border-l1, currentColor); }
.dct-update-section .dct-text { margin-bottom: 8px; }
.dct-update-section .dct-control { justify-content: flex-start; }
/* The background workbench: a row of zone tabs above a schematic of the window. Both
   decide which zone the controls below are editing, so both mark the same two states. */
.dct-file { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
.dct-zones { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.dct-zone-tab { display: flex; flex-direction: column; gap: 1px; min-width: 0; padding: 5px 10px; font: inherit; text-align: left; color: var(--dsw-alias-label-secondary, inherit); background: var(--dsw-alias-bg-layer-2, transparent); border: 1px solid var(--dsw-alias-border-l1, currentColor); border-radius: 6px; cursor: pointer; }
.dct-zone-tab:hover { border-color: var(--dsw-alias-border-l2, currentColor); }
.dct-zone-tab.selected { color: var(--dsw-alias-label-primary, inherit); border-color: var(--dsw-alias-label-primary, currentColor); }
.dct-zone-tab:disabled { opacity: 0.5; cursor: default; }
.dct-zone-tab strong { font-size: 13px; font-weight: 500; }
.dct-zone-tab small { max-width: 130px; overflow: hidden; font-size: 11px; color: var(--dsw-alias-label-caption, inherit); text-overflow: ellipsis; white-space: nowrap; }
.dct-zone-tab.has-image strong::after { content: "●"; margin-left: 5px; font-size: 8px; vertical-align: middle; }
.dct-schematic { position: relative; isolation: isolate; display: grid; grid-template-columns: 96px minmax(0, 1fr) 84px; grid-template-rows: 26px minmax(0, 1fr); grid-template-areas: "windowbar windowbar windowbar" "sidebar main dock"; gap: 5px; min-height: 152px; margin-top: 8px; padding: 18px 12px 12px; border-radius: 8px; }
.dct-schematic button { min-width: 0; display: grid; place-items: center; padding: 5px; font: inherit; font-size: 11px; color: var(--dsw-alias-label-secondary, inherit); background: var(--dsw-alias-bg-layer-2, transparent); border: 1px solid var(--dsw-alias-border-l1, currentColor); border-radius: 6px; cursor: pointer; }
.dct-schematic button:hover { border-color: var(--dsw-alias-border-l2, currentColor); }
.dct-schematic button.selected { color: var(--dsw-alias-label-primary, inherit); border-color: var(--dsw-alias-label-primary, currentColor); }
.dct-schematic button:disabled { opacity: 0.5; cursor: default; }
.dct-schematic button.has-image::before { content: "●"; margin-right: 4px; font-size: 8px; }
/* The whole-window zone is the frame the other regions sit inside rather than another
   region beside them, so it owns the outer border: dashed while that zone is empty,
   solid once it carries a picture, and highlighted when it is the one being edited.
   Its label sits in the band the container's top padding leaves free, because every
   other pixel of the frame is covered by a region.
   These rules are written as button.dct-schematic-global on purpose: the shared
   .dct-schematic button rule above is a class plus an element, so it outranks a
   single class and would otherwise centre this label behind the regions. */
.dct-schematic button.dct-schematic-global { position: absolute; inset: 0; z-index: 0; display: flex; align-items: flex-start; justify-content: flex-end; padding: 3px 10px; border: 1px dashed var(--dsw-alias-border-l1, currentColor); border-radius: 8px; background: transparent; }
.dct-schematic button.dct-schematic-global.selected { color: var(--dsw-alias-label-primary, inherit); border-color: var(--dsw-alias-label-primary, currentColor); }
.dct-schematic button.dct-schematic-global.has-image { border-style: solid; }
/* The mark sits on the label's line rather than its own, since the frame lays its
   contents out in a row. */
.dct-schematic button.dct-schematic-global.has-image::before { margin-top: 3px; }
.dct-schematic-windowbar { grid-area: windowbar; z-index: 1; position: relative; }
.dct-schematic-sidebar { grid-area: sidebar; z-index: 1; position: relative; }
.dct-schematic-dock { grid-area: dock; z-index: 1; position: relative; }
.dct-schematic-main { grid-area: main; z-index: 1; position: relative; display: grid; grid-template-rows: minmax(0, 1fr) 26px; gap: 5px; }
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
            streamFadeTitle: '流式渐显',
            streamFadeHint: '文字流输出时逐段淡入；渐显时长与落笔墨量（100% 即关闭）右侧依次对应',
            streamFadeDuration: '流式渐显时长',
            streamFadeDurationHint: '每个字从落笔淡到实心的时间；越长越舒缓。',
            streamFadeInk: '落笔墨量',
            streamFadeInkHint: '刚落笔文字的浓度；调到 100% 即关闭渐显。',
            workTitle: '工作时文字',
            workHint: '一行一条，运行时轮播替换「深度求索中」；留空则完全沿用官方文案',
            workPlaceholder: '深度求索中',
            workInterval: '轮播间隔',
            workEffectTitle: '文字特效',
            workEffectHint: '只作用于运行中的提示，不改变消息正文；「跟随官方」保留 DSH 自己的扫光',
            workEffectOfficial: '跟随官方',
            workEffectShimmer: '流光',
            workEffectNone: '静态',
            workEffectHidden: '隐藏',
            workShimmerStyle: '流光样式',
            workShimmerMatte: '哑光',
            workShimmerRainbow: '七彩光',
            workColor: '文本颜色',
            workSweepColor: '扫光颜色',
            workPreviewCaption: '预览 · 与运行中的提示同一套样式',
            workPreviewHidden: '已隐藏：模型工作时不再显示提示文字',
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
            bgHint: '选择图片文件，或直接向背景目录放入图片',
            bgConfigured: '部分区域已设置背景',
            bgZone: '区域',
            bgZonesHint: '点击区域标签或下方示意图，选中要修改的位置',
            bgSchematic: '布局示意图',
            bgUnset: '未设置',
            bgImport: '选择图片…',
            bgImporting: '上传中…',
            bgImportFailed: '图片未能上传',
            bgImportStale: '插件已更新，重启 DSH 后再试',
            bgImportTooLarge: '图片超过 16 MiB',
            bgImportUnsupported: '这个格式不能用作背景图',
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
            streamFadeTitle: 'Streaming text fade',
            streamFadeHint: 'Live progressive fade-in during text streaming; fade duration and writing ink (100% turns off fade) on the right in order.',
            streamFadeDuration: 'Streaming fade duration',
            streamFadeDurationHint: 'How long each freshly written piece takes to settle; longer is softer.',
            streamFadeInk: 'Writing-point ink',
            streamFadeInkHint: 'Opacity of freshly written text; set to 100% to turn the fade off.',
            workTitle: 'Working text',
            workHint: 'One phrase per line, cycled over the official “Deep diving”. Leave it empty to keep the shipped wording.',
            workPlaceholder: 'Deep diving...',
            workInterval: 'Rotation',
            workEffectTitle: 'Text effect',
            workEffectHint: 'Applies to the running indicator only, never to message text; “As shipped” keeps the shell’s own sweep',
            workEffectOfficial: 'As shipped',
            workEffectShimmer: 'Shimmer',
            workEffectNone: 'Static',
            workEffectHidden: 'Hidden',
            workShimmerStyle: 'Shimmer style',
            workShimmerMatte: 'Matte',
            workShimmerRainbow: 'Rainbow',
            workColor: 'Text colour',
            workSweepColor: 'Sweep colour',
            workPreviewCaption: 'Preview · the same styling the running label wears',
            workPreviewHidden: 'Hidden: no indicator text is shown while the model works',
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
            bgHint: 'Pick a picture file, or drop one into the background directory',
            bgConfigured: 'Some zones have a background',
            bgZone: 'Zone',
            bgZonesHint: 'Pick a zone from the tabs, or click the layout below',
            bgSchematic: 'Layout schematic',
            bgUnset: 'Not set',
            bgImport: 'Choose a picture…',
            bgImporting: 'Uploading…',
            bgImportFailed: 'The picture could not be uploaded',
            bgImportStale: 'The plugin was updated — restart DSH and try again',
            bgImportTooLarge: 'That picture is over 16 MiB',
            bgImportUnsupported: 'That picture is not a format a background can be',
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
        // The running label's effect is written here rather than into the page sheet,
        // because it dresses an element the shell owns and has to be replaced whenever
        // the choice changes.
        const workingStyle = document.createElement('style')
        workingStyle.dataset.plugin = 'dsh-custom-theme'
        workingStyle.dataset.role = 'working'
        let cleanupLayerStyle = () => {}
        let cleanupFontStyle = () => {}
        let cleanupStreamInk = () => {}
        document.head.append(themeStyle, pageStyle, workingStyle)
        ctx.effect(() => () => {
          controller.abort()
          releaseOverrides()
          unwatchPaintedZones()
          clearZoneProperties()
          if (runningLabelPatch !== null) {
            runningLabelPatch()
            runningLabelPatch = null
          }
          themeStyle.remove()
          pageStyle.remove()
          workingStyle.remove()
          cleanupLayerStyle()
          cleanupFontStyle()
          cleanupStreamInk()
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
     * Split declarations in a CSS rule body while respecting quotes and parentheses.
     * @param body - Rule body text without enclosing braces.
     * @returns Array of declaration strings.
     */
    function parseDeclarations(body) {
      const decls = []
      let start = 0
      let inSingle = false
      let inDouble = false
      let parenDepth = 0

      for (let i = 0; i < body.length; i += 1) {
        const ch = body[i]
        if (ch === '\\' && (inSingle || inDouble)) {
          i += 1
          continue
        }
        if (ch === "'" && !inDouble) {
          inSingle = !inSingle
        } else if (ch === '"' && !inSingle) {
          inDouble = !inDouble
        } else if (!inSingle && !inDouble) {
          if (ch === '(') parenDepth += 1
          else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1)
          else if (ch === ';' && parenDepth === 0) {
            const item = body.slice(start, i).trim()
            if (item !== '') decls.push(item)
            start = i + 1
          }
        }
      }
      const tail = body.slice(start).trim()
      if (tail !== '') decls.push(tail)
      return decls
    }

    /**
     * Adapt dark theme selectors to match DSH's body attribute.
     * @param selector - Raw CSS selector.
     * @returns Adapted selector targeting DSH's dark-theme attribute.
     */
    function adaptDarkSelector(selector) {
      return selector
        .replace(/:root\[data-theme=["']?dark["']?\]/gu, 'body[data-ds-dark-theme]')
        .replace(/html\[data-theme=["']?dark["']?\]/gu, 'body[data-ds-dark-theme]')
        .replace(/\[data-theme=["']?dark["']?\]/gu, '[data-ds-dark-theme]')
    }

    /**
     * Extract only non-token rules from a theme stylesheet.
     *
     * Custom properties (`--*`) are registered with the official theme runtime and
     * applied as inline properties on `document.body.style`. Leaving them in an
     * injected stylesheet would let root declarations shadow active dark/light mode
     * overrides. Only actual CSS rules (e.g. font-family, keyframes, layout adjustments)
     * reach the theme stylesheet.
     * @param css - Stylesheet text.
     * @returns Stylesheet containing only non-token rules.
     */
    function extractNonTokenRules(css) {
      const source = css.replace(/\/\*[\s\S]*?\*\//gu, '')

      function processBlock(input) {
        let result = ''
        let cursor = 0
        while (cursor < input.length) {
          const open = input.indexOf('{', cursor)
          if (open === -1) break
          const header = input.slice(cursor, open).trim()
          let depth = 1
          let pos = open + 1
          while (pos < input.length && depth > 0) {
            if (input[pos] === '{') depth += 1
            else if (input[pos] === '}') depth -= 1
            pos += 1
          }
          const body = input.slice(open + 1, pos - 1)
          cursor = pos

          if (!header) continue

          if (header.startsWith('@')) {
            const lower = header.toLowerCase()
            if (lower.startsWith('@keyframes') || lower.startsWith('@font-face') || lower.startsWith('@counter-style')) {
              result += `${header} {\n${body.trim()}\n}\n`
            } else {
              const inner = processBlock(body)
              if (inner.trim() !== '') {
                result += `${header} {\n${inner.trim()}\n}\n`
              }
            }
          } else {
            const decls = parseDeclarations(body)
            const nonTokens = []
            for (const decl of decls) {
              const colon = decl.indexOf(':')
              if (colon === -1) continue
              const prop = decl.slice(0, colon).trim()
              const val = decl.slice(colon + 1).trim()
              if (!prop.startsWith('--')) {
                nonTokens.push(`  ${prop}: ${val};`)
              }
            }
            if (nonTokens.length > 0) {
              result += `${adaptDarkSelector(header)} {\n${nonTokens.join('\n')}\n}\n`
            }
          }
        }
        return result
      }

      return processBlock(source).trim()
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
      // Syntax-highlighting tokens default to the theme's label and code-block
      // tokens so untokenized runs and diffs inherit the active mode's colors.
      if (!modes['--shiki-foreground'] && modes['--dsw-alias-label-primary']) {
        modes['--shiki-foreground'] = {
          light: modes['--dsw-alias-label-primary'].light,
          dark: modes['--dsw-alias-label-primary'].dark,
        }
      }
      if (!modes['--shiki-background']) {
        const bg = modes['--dsw-alias-markdown-code-block'] ?? modes['--dsw-alias-bg-base']
        if (bg) {
          modes['--shiki-background'] = {
            light: bg.light,
            dark: bg.dark,
          }
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
      themeStyle.textContent = extractNonTokenRules(css)
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
     * The surfaces the last pass painted.
     *
     * Kept because a later DOM change has to be judged against what was actually painted:
     * the global entry supplies a picture to zones that have none of their own, so the set
     * of painted zones is not the set of configured ones.
     */
    let paintedSurfaces = []

    /** Watches for the shell replacing a painted surface; see {@link watchPaintedZones}. */
    let zoneObserver = null
    let zoneRepaintTimer = null

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
    cleanupLayerStyle = () => { layerStyle.remove() }
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
     *
     * A spread picture is anchored to the viewport instead of to its own box, and that is
     * what makes the whole-window entry look like one picture. The shell's columns are
     * opaque, so the frame alone cannot be painted behind them and the picture has to go
     * on every zone; sized against each zone it would be cropped once per zone — a band per
     * column and per bar, each showing its own slice, which reads as a stack of pieces
     * rather than a background. `fixed` moves the positioning area to the viewport, so
     * every zone shows its own window onto the same picture and the seams disappear. A zone
     * with a picture of its own keeps the default: there the picture belongs to that zone,
     * and covering the zone is exactly what was asked for.
     * @param theLayer - The selector's unique identifier.
     * @param config - `name`, `opacity`, `size`, `position` and `blur` for the zone.
     * @param spread - True when the picture comes from the whole-window entry and is being
     * spread over a zone that has none of its own.
     */
    function addLayerRule(theLayer, config, spread) {
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
  ${spread ? 'background-attachment: fixed;' : ''}
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
      paintedSurfaces = []
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
     * @param spread - True when the picture is the whole-window one, spread over this zone.
     */
    function paintZone(anchor, config, spread) {
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
      addLayerRule(theLayer, config, spread)
      paintedSurfaces.push(surface)
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
          paintZone(anchor, { ...settings.global, panelOpacity: settings[zone.id].panelOpacity, zone: zone.id }, true)
        }
      }
      for (const zone of ordered) {
        const anchor = targets.get(zone.id)
        if (anchor === undefined || settings[zone.id].name === '') continue
        paintZone(anchor, { ...settings[zone.id], zone: zone.id }, false)
      }
      // Only a zone the user actually configured can be reported missing; a warn
      // on every repaint would fire for everyone who never sets a background.
      for (const zone of ZONES) {
        if (settings[zone.id].name !== '' && !targets.has(zone.id)) {
          ctx.logger.warn('dsh-custom-theme: zone %s has an image but matched no element (%s)', zone.id, zone.selector)
        }
      }
      flushLayerRules()
      if (paintedSurfaces.length > 0) watchPaintedZones()
      else unwatchPaintedZones()
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

    /**
     * Watch for the shell replacing an element a picture was painted on.
     *
     * The shell rebuilds whole subtrees as the user moves around: opening a conversation
     * swaps the column, its header and the composer seat for new elements, and the markers
     * and inline properties the pass wrote go away with the old ones. Only the sidebar,
     * which is not rebuilt, keeps its picture — the conversation half goes bare, and since
     * nothing else asks for a repaint it stays that way until the settings are touched
     * again. This is the thing that asks.
     *
     * Only the child list is watched. The pass writes attributes, never nodes, so its own
     * work cannot reach this and there is no repaint loop to guard against; an attribute
     * change could not detach a surface anyway.
     */
    function watchPaintedZones() {
      if (zoneObserver !== null || typeof window.MutationObserver === 'undefined') return
      zoneObserver = new window.MutationObserver(() => {
        // A running turn mutates the transcript steadily, so the check is debounced and
        // kept cheap: it only asks whether the painted elements are still in the document.
        if (zoneRepaintTimer !== null) return
        zoneRepaintTimer = window.setTimeout(() => {
          zoneRepaintTimer = null
          if (!paintedSurfaces.some((element) => !element.isConnected)) return
          // Read fresh rather than reused from the pass that painted last: a repaint is
          // triggered by the shell rebuilding, not by a settings change, so it belongs to no
          // one pass, and the store is where the current settings live between them.
          applyBackgroundsWhenReady(readSavedBackgrounds())
        }, 150)
      })
      zoneObserver.observe(document.body, { childList: true, subtree: true })
    }

    /** Stop watching, because no picture is painted or the plugin is being torn down. */
    function unwatchPaintedZones() {
      if (zoneObserver !== null) {
        zoneObserver.disconnect()
        zoneObserver = null
      }
      if (zoneRepaintTimer !== null) {
        window.clearTimeout(zoneRepaintTimer)
        zoneRepaintTimer = null
      }
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

    /** Streaming fade duration range (ms). */
    const STREAM_FADE_DURATION_DEFAULT = 520
    const STREAM_FADE_DURATION_MIN = 150
    const STREAM_FADE_DURATION_MAX = 1500
    const STREAM_FADE_DURATION_STEP = 50

    /** Streaming fade ink opacity range (0.05-1.0; 1.0 disables fade). */
    const STREAM_FADE_INK_DEFAULT = 0.3
    const STREAM_FADE_INK_MIN = 0.05
    const STREAM_FADE_INK_MAX = 1.0
    const STREAM_FADE_INK_STEP = 0.05

    /** Keyframes and rules for progressive text stream fade-in. */
    const STREAM_INK_CSS = `
.stream-ink {
  animation-name: stream-ink-in;
  animation-duration: var(--stream-fade-duration, 520ms);
  animation-timing-function: var(--motion-ease-enter, cubic-bezier(.25, .2, .35, 1));
  animation-fill-mode: backwards;
}
@keyframes stream-ink-in {
  from { opacity: var(--stream-fade-ink, .3); }
  to { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .stream-ink {
    animation: none !important;
    opacity: 1 !important;
  }
}
`.trim()

    /** Read the saved conversation-stream choices, clamped to what the runtime accepts. */
    function readSavedAppearance() {
      let raw = {}
      try {
        const parsed = JSON.parse(localStorage.getItem(APPEARANCE_KEY) ?? '{}')
        if (parsed !== null && typeof parsed === 'object') raw = parsed
      } catch {
        // A corrupt entry falls back to the shell's own rendering.
      }
      const validNumber = (val) => (typeof val === 'number' && Number.isFinite(val)) || (typeof val === 'string' && val.trim() !== '' && Number.isFinite(Number(val)))
      const gap = validNumber(raw.lineGap) ? Number(raw.lineGap) : NaN
      const duration = validNumber(raw.streamingFadeDuration) ? Number(raw.streamingFadeDuration) : NaN
      const ink = validNumber(raw.streamingFadeInk) ? Number(raw.streamingFadeInk) : NaN
      return {
        lineGap: Number.isFinite(gap) ? Math.min(LINE_GAP_MAX, Math.max(LINE_GAP_MIN, Math.round(gap))) : 0,
        fontFamily: cleanFont(raw.fontFamily),
        codeFontFamily: cleanFont(raw.codeFontFamily),
        streamingFadeDuration: Number.isFinite(duration)
          ? Math.min(STREAM_FADE_DURATION_MAX, Math.max(STREAM_FADE_DURATION_MIN, Math.round(duration)))
          : STREAM_FADE_DURATION_DEFAULT,
        streamingFadeInk: Number.isFinite(ink)
          ? Math.min(STREAM_FADE_INK_MAX, Math.max(STREAM_FADE_INK_MIN, Math.round(ink * 100) / 100))
          : STREAM_FADE_INK_DEFAULT,
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
    cleanupFontStyle = () => { fontStyle.remove() }
    document.head.append(fontStyle)

    let currentAppearanceSettings = readSavedAppearance()

    /**
     * Declare the conversation-stream overrides, or withdraw a field by leaving it
     * out once it is back at the shell's default.
     * @param settings - Choices from {@link readSavedAppearance}.
     */
    function applyAppearance(settings) {
      currentAppearanceSettings = settings
      const root = []
      const body = []
      if (settings.fontFamily !== '') root.push(`--dsw-font-family: ${settings.fontFamily};`)
      if (settings.codeFontFamily !== '') root.push(`--ds-font-family-code: ${settings.codeFontFamily};`)
      // The shell derives every content line height from this delta, so adding to
      // it keeps the whole stream in step instead of pinning one absolute height.
      if (settings.lineGap !== 0) {
        body.push(`--dsh-content-font-delta: calc(var(--dsh-content-font-size, 14px) - 14px + ${settings.lineGap}px);`)
      }
      root.push(`--stream-fade-duration: ${settings.streamingFadeDuration}ms;`)
      root.push(`--stream-fade-ink: ${settings.streamingFadeInk};`)
      // Raised specificity, not source order: the shell installs its own palette
      // styles at boot and may do so after this plugin runs, so an equal-specificity
      // `:root`/`body` rule would lose to it depending on who ran last.
      fontStyle.textContent = [
        root.length > 0 ? `html:root {\n  ${root.join('\n  ')}\n}` : '',
        body.length > 0 ? `html body {\n  ${body.join('\n  ')}\n}` : '',
        STREAM_INK_CSS,
      ].filter(Boolean).join('\n')

      if (settings.streamingFadeInk >= 1.0) {
        tickStreamInk()
      }
    }

    /** Progressive text streaming fade-in runtime (ported from Deeptop). */
    const STREAM_INK_GROUP = 6
    const STREAM_INK_STAGGER_MS = 14
    const STREAM_INK_STAGGER_LEVELS = 24
    const STREAM_INK_STAGGER_MAX_MS = 360
    const STREAM_INK_MAX_AGE = 2000
    const STREAM_INK_SKIP_TAGS = new Set(['STYLE', 'SCRIPT', 'TEXTAREA', 'INPUT', 'BUTTON', 'SVG'])
    const STREAM_INK_SKIP_CLASSES = new Set(['stream-ink', 'katex', 'math-inline', 'math-display'])

    function staggerSpread(len, offset) {
      const groups = Math.max(1, Math.ceil(len / STREAM_INK_GROUP))
      const levels = Math.min(STREAM_INK_STAGGER_LEVELS, groups)
      if (levels <= 1) return 0
      const group = Math.floor(offset / STREAM_INK_GROUP)
      const level = Math.min(levels - 1, Math.floor((group * levels) / groups))
      const span = Math.min((groups - 1) * STREAM_INK_STAGGER_MS, STREAM_INK_STAGGER_MAX_MS)
      return (level * span) / (levels - 1)
    }

    function splitDeltaIntoRuns(delta) {
      const len = delta.length
      const runs = []
      for (let i = 0; i < len; i += STREAM_INK_GROUP) {
        const chunkText = delta.slice(i, Math.min(i + STREAM_INK_GROUP, len))
        const delay = Math.round(staggerSpread(len, i))
        const prev = runs[runs.length - 1]
        if (prev !== undefined && prev.delay === delay) {
          prev.text += chunkText
        } else {
          runs.push({ text: chunkText, delay })
        }
      }
      return runs
    }

    function findTrailingElement(root) {
      let curr = root
      while (curr !== null) {
        if (STREAM_INK_SKIP_TAGS.has(curr.tagName)) return null
        let next = curr.lastElementChild
        while (next !== null && next.classList && (next.classList.contains('stream-ink') || STREAM_INK_SKIP_CLASSES.has(next.className))) {
          next = next.previousElementSibling
        }
        if (next === null) return curr
        curr = next
      }
      return curr
    }

    const streamInkTracked = new WeakMap()
    const streamInkActiveRoots = new Set()

    function cleanSettled(root) {
      const spans = root.querySelectorAll('.stream-ink')
      for (let i = 0; i < spans.length; i++) {
        const span = spans[i]
        const parent = span.parentNode
        if (parent) {
          parent.replaceChild(parent.ownerDocument.createTextNode(span.textContent || ''), span)
          parent.normalize()
        }
      }
    }

    function processStreamingRoot(root) {
      const target = findTrailingElement(root)
      if (target === null) return

      const currentText = target.textContent || ''
      let state = streamInkTracked.get(target)
      if (state === undefined) {
        state = { lastText: '', pending: [] }
        streamInkTracked.set(target, state)
      }

      if (currentText === state.lastText) return

      if (!currentText.startsWith(state.lastText)) {
        state.lastText = ''
        state.pending = []
      }

      const delta = currentText.slice(state.lastText.length)
      if (!delta) return

      const now = typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now()
      while (state.pending.length > 0 && now - state.pending[0].at >= STREAM_INK_MAX_AGE) {
        const item = state.pending.shift()
        if (item.span.parentNode) {
          item.span.parentNode.replaceChild(item.span.ownerDocument.createTextNode(item.span.textContent || ''), item.span)
        }
      }
      target.normalize()

      const runs = splitDeltaIntoRuns(delta)
      const doc = target.ownerDocument || document
      const frag = doc.createDocumentFragment()
      for (let i = 0; i < runs.length; i++) {
        const run = runs[i]
        const span = doc.createElement('span')
        span.className = 'stream-ink'
        span.style.animationDelay = `${run.delay}ms`
        span.textContent = run.text
        frag.appendChild(span)
        state.pending.push({ span, at: now })
      }

      let remainingDeltaLen = delta.length
      for (let i = target.childNodes.length - 1; i >= 0 && remainingDeltaLen > 0; i--) {
        const child = target.childNodes[i]
        if (child.nodeType === 3) {
          if (child.data.length <= remainingDeltaLen) {
            remainingDeltaLen -= child.data.length
            child.remove()
          } else {
            child.data = child.data.slice(0, child.data.length - remainingDeltaLen)
            remainingDeltaLen = 0
          }
        }
      }

      target.appendChild(frag)
      state.lastText = currentText
    }

    function tickStreamInk() {
      const settings = currentAppearanceSettings
      if (settings.streamingFadeInk >= 1.0) {
        for (const root of streamInkActiveRoots) {
          cleanSettled(root)
        }
        streamInkActiveRoots.clear()
        return
      }

      if (typeof document === 'undefined') return
      const currentStreaming = new Set(document.querySelectorAll('[data-streaming="true"], [data-variant="think"][data-state="running"]'))
      for (const root of streamInkActiveRoots) {
        if (!currentStreaming.has(root) || !root.isConnected) {
          cleanSettled(root)
          streamInkActiveRoots.delete(root)
        }
      }
      for (const root of currentStreaming) {
        streamInkActiveRoots.add(root)
        processStreamingRoot(root)
      }
    }

    let streamObserver = null
    let isStreamMutating = false
    if (typeof window !== 'undefined' && typeof document !== 'undefined' && typeof window.MutationObserver !== 'undefined' && document.body) {
      streamObserver = new window.MutationObserver(() => {
        if (isStreamMutating) return
        isStreamMutating = true
        try {
          tickStreamInk()
        } finally {
          isStreamMutating = false
        }
      })
      streamObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['data-streaming', 'data-state'],
      })
    }

    cleanupStreamInk = function cleanupStreamInk() {
      if (streamObserver !== null) {
        streamObserver.disconnect()
        streamObserver = null
      }
      for (const root of streamInkActiveRoots) {
        cleanSettled(root)
      }
      streamInkActiveRoots.clear()
    }

    /** localStorage key holding the working-indicator choices. */
    const WORKING_KEY = 'dsh-custom-theme.working'
    /** Caps the official indicator accepts: at most 12 phrases of 120 characters. */
    const WORKING_MAX_TEXTS = 12
    const WORKING_MAX_LENGTH = 120
    /** Rotation intervals offered, in ms. */
    const WORKING_INTERVALS = [1200, 1800, 2400, 3000, 4000, 6000, 8000, 10000]
    const WORKING_INTERVAL_DEFAULT = 2400
    /**
     * The text effects, ported from Deeptop's running indicator.
     *
     * `official` is this plugin's own addition and its default: nothing is injected, so
     * the shell keeps drawing and animating its label exactly as it ships. The rest are
     * Deeptop's, in its order, minus the two — 呼吸 and 发光 — that its look could not be
     * given without filling the glyphs.
     */
    const WORKING_EFFECTS = ['official', 'shimmer', 'none', 'hidden']
    /** The locale key naming each effect, in the order the select offers them. */
    const WORKING_EFFECT_LABELS = {
      official: 'workEffectOfficial',
      shimmer: 'workEffectShimmer',
      none: 'workEffectNone',
      hidden: 'workEffectHidden',
    }
    /**
     * The two ways the shimmer's band is coloured.
     *
     * `matte` is the official look: one flat tint sweeping the label. `rainbow` keeps
     * Deeptop's spectrum, but inside that band rather than over the whole label.
     */
    const WORKING_SHIMMER_STYLES = ['matte', 'rainbow']
    /** The locale key naming each shimmer style. */
    const WORKING_SHIMMER_LABELS = { matte: 'workShimmerMatte', rainbow: 'workShimmerRainbow' }
    const WORKING_EFFECT_DEFAULT = 'official'
    const WORKING_SHIMMER_DEFAULT = 'matte'
    /** Deeptop's own default colours, which its effect rules are written around. */
    const WORKING_COLOR_DEFAULT = '#4176e6'
    const WORKING_SWEEP_DEFAULT = '#5ee0ff'
    /** The only colour shape accepted, because it is the only one a picker reports. */
    const WORKING_HEX = /^#[0-9a-f]{6}$/i

    /** Normalize a phrase list to the shape the official indicator accepts. */
    function normalizeWorkingTexts(value) {
      return (Array.isArray(value) ? value : [])
        .filter((item) => typeof item === 'string')
        .map((item) => item.trim().slice(0, WORKING_MAX_LENGTH))
        .filter(Boolean)
        .slice(0, WORKING_MAX_TEXTS)
    }

    /** Read one stored colour, or the fallback when it is missing or is not a colour. */
    function readWorkingColor(value, fallback) {
      return typeof value === 'string' && WORKING_HEX.test(value) ? value.toLowerCase() : fallback
    }

    /** Read the saved working-indicator choices. */
    function readSavedWorking() {
      let raw = {}
      try {
        const parsed = JSON.parse(localStorage.getItem(WORKING_KEY) ?? '{}')
        if (parsed !== null && typeof parsed === 'object') raw = parsed
      } catch {
        // A corrupt entry falls back to the official label.
      }
      const interval = Number(raw.interval)
      return {
        texts: normalizeWorkingTexts(raw.texts),
        interval: WORKING_INTERVALS.includes(interval) ? interval : WORKING_INTERVAL_DEFAULT,
        // An unknown effect or shimmer is dropped rather than passed on: both end up in
        // a stylesheet, and only the listed ones have rules that reach it.
        effect: WORKING_EFFECTS.includes(raw.effect) ? raw.effect : WORKING_EFFECT_DEFAULT,
        shimmer: WORKING_SHIMMER_STYLES.includes(raw.shimmer) ? raw.shimmer : WORKING_SHIMMER_DEFAULT,
        color: readWorkingColor(raw.color, WORKING_COLOR_DEFAULT),
        sweep: readWorkingColor(raw.sweep, WORKING_SWEEP_DEFAULT),
      }
    }

    let workingSettings = readSavedWorking()
    /** Set by `apply` to re-point the running label as phrases come and go. */
    let runningLabelSync = null

    /** Persist the working-indicator choices and re-point the running label. */
    function setWorkingSettings(next) {
      // Normalize on the way in, so what is written is what the reader would have
      // accepted anyway: an emptied box stores no phrases rather than one empty one.
      localStorage.setItem(WORKING_KEY, JSON.stringify({
        texts: normalizeWorkingTexts(next.texts),
        interval: next.interval,
        effect: next.effect,
        shimmer: next.shimmer,
        color: next.color,
        sweep: next.sweep,
      }))
      // Re-read rather than trust the caller, so the stored and live values share
      // one normalization path and cannot drift apart.
      workingSettings = readSavedWorking()
      if (runningLabelSync !== null) runningLabelSync()
    }

    /**
     * Keys whose text is the running indicator's own wording.
     *
     * `chat.deepDivingFor` is what a live turn draws — 「深度求索中，用时 13秒 ···」 —
     * and `chat.deepDiving` is its parameter-free sibling: the wording the row shows
     * before its clock has a start time, and the one the visually hidden status span
     * reads out. Both live in the shell's `chat` namespace.
     */
    const RUNNING_LABEL_KEY = /\.deepDiving(?:For)?$/

    /**
     * How long a gap between label reads means the turn ended, in ms.
     *
     * The shell re-reads the label on its own one-second clock while a turn runs, so
     * a wider gap can only mean the label stopped being drawn.
     */
    const PHRASE_STREAK_GAP = 2500

    /** Wall clock of the first read of the current label streak. */
    let phraseStreakStart = 0
    /** Wall clock of the most recent read. */
    let phraseLastRead = 0
    /** Wall clock the cached phrase belongs to, and the phrase itself. */
    let phraseAt = 0
    let phraseText = ''

    /**
     * The running bar, and this page's own sample of it.
     *
     * Both carry the two declarations an effect is made of: the label's own colour, and
     * the colour of the band that sweeps it. The sample reads the same token the shell's
     * band does, so one rule dresses both.
     */
    const WORKING_BAR = '[data-chat-running], .dct-work-preview'
    /**
     * The band the shell sweeps the label with.
     *
     * The shipped build draws it as a decorative copy of the text — an `aria-hidden` span
     * inside the label, masked to a soft travelling band and driven by two animations —
     * and an older one marks the label `data-text-shimmer` instead. The sample carries its
     * own copy of that structure. This is what `none` switches off, because a still label
     * with a band still gliding over it is not still.
     */
    const WORKING_BAND = '[data-chat-running] [data-shimmer] > span[aria-hidden="true"], '
      + '[data-chat-running] [data-text-shimmer] > span[aria-hidden="true"], '
      + '.dct-work-effect .dct-work-sweep'
    /**
     * The text inside that band.
     *
     * A spectrum cannot be expressed as one colour, so the rainbow style fills the band's
     * own copy of the glyphs with it rather than tinting them through the token. It is
     * still only visible through the band's mask, which is what keeps the look matte: the
     * label underneath keeps its solid colour.
     */
    const WORKING_BAND_TEXT = '[data-chat-running] [data-shimmer] > span[aria-hidden="true"] [data-shimmer-text], '
      + '[data-chat-running] [data-text-shimmer] > span[aria-hidden="true"] [data-shimmer-text], '
      + '.dct-work-effect .dct-work-sweep-text'
    /** Deeptop's spectrum, which its 七彩光 sweep travels. */
    const WORKING_SPECTRUM = 'linear-gradient(100deg, #ff5a5a 0%, #ffb03a 7%, #ffe95a 14%, #4ade80 21%, #38bdf8 28%, #818cf8 35%, #e879f9 42%, #ff5a5a 50%, #ffb03a 57%, #ffe95a 64%, #4ade80 71%, #38bdf8 78%, #818cf8 85%, #e879f9 92%, #ff5a5a 100%)'

    /**
     * The stylesheet that gives the running label its chosen effect.
     *
     * The shimmer here is the official mechanic rather than Deeptop's: the glyphs keep one
     * solid colour and a soft masked band glides over them, which is what reads as matte.
     * Deeptop filled the glyphs themselves with a travelling gradient, and that is what
     * made its look glossier than the shell's own — so the band is the only thing that
     * takes a colour, through the very token the shell paints its own sweep with. Every
     * rule is `!important`, because the shell's own label rules are already in the
     * document and this sheet is injected after them rather than instead of them.
     * @param working - Normalized working-indicator choices.
     * @returns The stylesheet text, empty while the shipped look is the choice.
     */
    function workingEffectCss(working) {
      if (working.effect === 'official') return ''
      // `hidden` is about the bar as a whole and needs no rule on the label itself; its
      // text is still announced, because the span carrying the announcement is kept.
      if (working.effect === 'hidden') {
        return `[data-chat-running] > :not([role="status"]) { display: none !important; }\n`
      }
      const rules = [
        // The label's colour, and the band's: the shell paints its sweep with
        // `--dsw-alias-label-shimmer`, and the sample's own band reads that token too.
        `${WORKING_BAR} { color: ${working.color} !important; --dsw-alias-label-shimmer: ${working.sweep} !important; }`,
      ]
      if (working.effect === 'shimmer') {
        // No `prefers-reduced-motion` rule is needed: the shell stops its own band for
        // that preference, and the band is the whole animation here.
        if (working.shimmer === 'rainbow') {
          rules.push(
            `${WORKING_BAND_TEXT} {`
            + ` background-image: ${WORKING_SPECTRUM} !important;`
            // One tile across the band's own copy of the text. The shell's mask and its
            // two animations already travel; a gradient travelling a second time inside a
            // moving window would leave the colour standing still.
            + ' background-repeat: no-repeat !important;'
            + ' background-size: 100% 100% !important;'
            + ' background-clip: text !important;'
            + ' -webkit-background-clip: text !important;'
            + ' -webkit-text-fill-color: transparent !important; }',
          )
        }
      } else {
        // Static: the label keeps its colour and the band stops being drawn at all.
        rules.push(`${WORKING_BAND} { display: none !important; }`)
      }
      return `${rules.join('\n')}\n`
    }

    /**
     * The phrase to show right now.
     *
     * Nothing drives this on a timer of its own: the shell re-reads the label every
     * second while a turn runs, which advances the rotation, and a gap in those reads
     * restarts it — the same moment a new turn's label first appears.
     * @returns The phrase, or an empty string while none is configured.
     */
    function currentPhrase() {
      const texts = workingSettings.texts
      if (texts.length === 0) return ''
      const now = Date.now()
      // One render reads the label twice — the row and the announcement that mirrors
      // it — so the millisecond they share resolves to one phrase.
      if (now === phraseAt) return phraseText
      if (now - phraseLastRead > PHRASE_STREAK_GAP) phraseStreakStart = now
      phraseLastRead = now
      phraseAt = now
      phraseText = texts.length === 1
        ? texts[0]
        : texts[Math.floor((now - phraseStreakStart) / workingSettings.interval) % texts.length]
      return phraseText
    }

    /**
     * Reword the running label through the shell's own lookup.
     *
     * The label cannot be replaced at a seat of its own: the shell draws that row
     * inside its Chat view and registers no slot for it, and `ctx.locale.register`
     * throws for a namespace and locale pair that already exist. Every bound `t`
     * dispatches through `translate` though, so replacing that one method reaches the
     * wording itself and leaves everything around it — the whale-tail glyph, the
     * shimmer, the row's layout, the elapsed time the shell interpolates and the
     * announcement that mirrors the label — exactly as shipped.
     * @param locale - The shell's locale service.
     * @returns A detach function, or null when the service exposes no `translate`.
     */
    function installRunningLabel(locale) {
      const original = locale?.translate
      if (typeof original !== 'function') return null
      /** Whether the service already carried its own `translate`, rather than a prototype one. */
      const own = Object.prototype.hasOwnProperty.call(locale, 'translate')
      /**
       * Shipped parameter-free wording, remembered per namespace as it is read.
       *
       * One shell keys its clock template `chat.deepDivingFor` beside
       * `chat.deepDiving`; another keys the same pair `message.turnProcess.*` with no
       * parameter-free sibling at all. Remembering the wording whenever it is read
       * rewords either build, and only ever costs the first read of a render.
       */
      const bareWording = new Map()
      /**
       * The shell's own lookup, with the running wording swapped.
       * @param ns - dictionary namespace.
       * @param key - dictionary key.
       * @param params - placeholder values, when the caller passes any.
       * @returns The shipped text everywhere but the running label.
       */
      const patched = function (ns, key, params) {
        const text = original.call(this, ns, key, params)
        if (typeof key !== 'string' || !RUNNING_LABEL_KEY.test(key)) return text
        const phrase = currentPhrase()
        if (phrase === '') return text
        if (!key.endsWith('For')) {
          bareWording.set(ns, text)
          return phrase
        }
        // The elapsed-time template reads `〈wording〉，用时 {duration} ···`, so only the
        // wording is swapped: whatever the shell puts after it — the clock it passes
        // in, the separators, the trailing marks — is kept as it is.
        const plain = key.slice(0, -'For'.length)
        const sibling = original.call(this, ns, plain)
        const wording = sibling !== plain ? sibling : bareWording.get(ns) ?? ''
        return wording !== '' && text.startsWith(wording) ? phrase + text.slice(wording.length) : text
      }
      try {
        // The service is a plain instance in the shipped shell; a composition that
        // refuses an own property still exposes the same method on its prototype.
        locale.translate = patched
        if (locale.translate === patched) {
          return () => { if (own) locale.translate = original; else delete locale.translate }
        }
        const prototype = Object.getPrototypeOf(locale)
        prototype.translate = patched
        return () => { prototype.translate = original }
      } catch {
        // A frozen or exotic service is a supported failure: the label stays as shipped.
        return null
      }
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

    /**
     * Hand one picture the user picked to the Host, which stores it in the background
     * directory beside the images dropped in by hand.
     *
     * The bytes go up as the body and the reported name as a query parameter: the Host
     * decides the stored name from the bytes and its own directory, so a name it cannot
     * serve is folded rather than refused.
     * @param file - The file the picker produced.
     * @returns The name the Host stored it under.
     */
    async function uploadBackground(file) {
      const response = await fetch(`${BACKGROUNDS_URL}?name=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        cache: 'no-store',
        body: file,
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        // The status travels with the failure because it is usually the whole diagnosis:
        // a Host that does not know this route answers 405 to it.
        const failure = new Error(payload.error ?? `background upload failed: ${response.status}`)
        failure.status = response.status
        throw failure
      }
      return payload.name
    }

    /**
     * Which sentence an upload failure deserves.
     *
     * A 404 or a 405 is not about the picture at all: it means the Host serving this page
     * has no such route, which is what a plugin updated in place looks like until DSH
     * restarts. The bundle is read from disk on each request, so a refresh picks up a new
     * panel, while the Host half — imported once at boot — stays as it was. Blaming the
     * picture there sends the user off to try other files for no reason.
     * @param error - Whatever the upload threw.
     * @returns The locale key to show, and the status to show beside the generic one.
     */
    function importFailureFor(error) {
      const status = error && typeof error === 'object' ? error.status : undefined
      if (status === 404 || status === 405) return { key: 'bgImportStale' }
      if (status === 413) return { key: 'bgImportTooLarge' }
      if (status === 415) return { key: 'bgImportUnsupported' }
      return { key: 'bgImportFailed', status }
    }

    /**
     * The sentence an upload failure shows, or `null` while nothing has failed.
     *
     * The status is appended only to the generic sentence: where the picture's own
     * reason is not known, the status is the only clue there is.
     * @param t - Locale lookup.
     * @param failure - What `importFailureFor` returned, or `null`.
     * @returns The text to show, or `null` to fall back to the row's usual hint.
     */
    function importMessage(t, failure) {
      if (failure === null) return null
      const suffix = failure.status === undefined ? '' : ` (HTTP ${failure.status})`
      return t(failure.key) + suffix
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
     * The update controls, rendered as a row on this card and as a section on the
     * plugin manager's page for this bundle.
     * @param props - `t`; `as`, the element and class the controls sit in; and
     *   `primary`, which drops the upgrade button where the page's own actions area
     *   already carries it, so the same button is never drawn twice on one page.
     */
    function UpdateRow({ t, as = 'row', primary = true }) {
      const snapshot = useUpdate()
      const busy = snapshot.phase === 'loading' || snapshot.phase === 'applying'
      const controls = [
        primary && canUpgrade(snapshot) ? h('button', {
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

    /**
     * The upgrade button in the plugin page's own actions area, beside its enable
     * switch and uninstall. Drawn only for this bundle and only when a newer release
     * exists, so every other plugin's page is left exactly as the shell built it.
     */
    function PluginUpdateAction({ subject, t }) {
      const snapshot = useUpdate()
      if (!isOwnBundle(subject)) return null
      if (!canUpgrade(snapshot)) return null
      const busy = snapshot.phase === 'loading' || snapshot.phase === 'applying'
      return h('button', {
        type: 'button',
        className: 'dct-button dct-upgrade',
        disabled: busy,
        onClick: () => { applyUpdateNow() },
      }, snapshot.phase === 'applying' ? t('updateUpgrading') : `${t('updateUpgrade')} ${snapshot.state.latest}`)
    }

    /** The update section under the plugin page's own content. */
    function PluginUpdateSection({ subject, t }) {
      if (!isOwnBundle(subject)) return null
      return h(UpdateRow, { t, as: 'section', primary: false })
    }

    function ThemeRow({ t }) {
      const [themes, setThemes] = React.useState([])
      const [selected, setSelected] = React.useState(readSaved)
      const [status, setStatus] = React.useState('idle')
      const [images, setImages] = React.useState([])
      const [backgrounds, setBackgrounds] = React.useState(readSavedBackgrounds)
      const [zone, setZone] = React.useState('global')
      const [importing, setImporting] = React.useState(false)
      const [importFailure, setImportFailure] = React.useState(null)
      const [preference, setPreference] = React.useState(() => ctx.theme.getTheme().preference)
      const [appearance, setAppearance] = React.useState(readSavedAppearance)
      const [fontSize, setFontSize] = React.useState(() => ctx.theme.getTheme().fontSize)
      const [working, setWorking] = React.useState(readSavedWorking)
      /** Which phrase the page's own sample of the running label is showing. */
      const [previewIndex, setPreviewIndex] = React.useState(0)

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

      /** Patch one field of the selected zone. The store and the picture follow below. */
      const updateZone = React.useCallback((patch) => {
        setBackgrounds((current) => ({ ...current, [zone]: { ...current[zone], ...patch } }))
      }, [zone])

      /*
       * Persist the zone settings and repaint, from the state that was committed.
       *
       * Not from inside the updater above. React may run an updater more than once — against
       * bases of different ages, and for renders it then throws away — so a store write and a
       * paint living there can land after a newer choice and put the older one back, leaving
       * the picker showing one picture and the window another. Both effects are idempotent,
       * so running them once per committed state is the whole job.
       */
      React.useEffect(() => {
        writeSavedBackgrounds(backgrounds)
        applyBackgroundsWhenReady(backgrounds)
      }, [backgrounds])

      /** The hidden picker the import button drives. */
      const fileInput = React.useRef(null)

      /**
       * Store a picture the user picked, then select it for the zone being edited.
       *
       * The picker is cleared before anything else so choosing the same file twice still
       * fires a change, and the listing is re-read afterwards because the Host decides
       * the stored name — a name it cannot serve comes back folded.
       *
       * The picture is only selected while the zone still holds what it held when the file
       * was picked. An upload is a round trip, so a picture chosen from the list — or from a
       * second upload — while it was in flight is the newer choice, and it has to win over
       * the one that merely happened to finish last; otherwise the picker keeps showing the
       * newer picture and the window silently follows the older one.
       */
      const onPickFile = React.useCallback(async (event) => {
        const file = event.target.files && event.target.files[0]
        event.target.value = ''
        if (!file) return
        const was = backgrounds[zone].name
        setImporting(true)
        setImportFailure(null)
        try {
          const stored = await uploadBackground(file)
          setImages(await listBackgrounds())
          setBackgrounds((current) => (current[zone].name === was
            ? { ...current, [zone]: { ...current[zone], name: stored } }
            : current))
        } catch (error) {
          setImportFailure(importFailureFor(error))
        } finally {
          setImporting(false)
        }
      }, [backgrounds, zone])

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
      const active = ZONES.find((item) => item.id === zone)

      /*
       * The page's own sample of the running label.
       *
       * It wears the very rules the transcript's label wears, so an effect can be
       * judged without waiting for a turn; with no phrase configured it shows the
       * shipped wording the effect would otherwise dress. It rotates on the configured
       * interval for the same reason, restarting whenever the list does — which is also
       * when the live label restarts.
       */
      const previewTexts = working.texts.length > 0 ? working.texts : [t('workPlaceholder')]
      const previewKey = previewTexts.join('\n')
      const previewText = previewTexts[previewIndex % previewTexts.length]
      React.useEffect(() => { setPreviewIndex(0) }, [previewKey])
      React.useEffect(() => {
        if (previewTexts.length < 2) return undefined
        const timer = window.setTimeout(() => setPreviewIndex((index) => index + 1), working.interval)
        return () => window.clearTimeout(timer)
      }, [previewIndex, previewKey, previewTexts.length, working.interval])

      /**
       * One colour choice: the picker plus the value it is currently on.
       *
       * `input[type=color]` reports `#rrggbb` and nothing else, which is exactly what is
       * stored, so the value beside it is a readout rather than a second editable copy.
       */
      const colorField = (className, label, value, onChange) => h('label', { className: `dct-color ${className}` },
        h('input', {
          type: 'color',
          className: 'dct-color-input',
          value,
          'aria-label': label,
          onChange: (event) => onChange(event.target.value),
        }),
        h('code', { className: 'dct-color-code' }, value))

      /**
       * One clickable region of the layout schematic.
       *
       * A region marks itself when its zone already carries a picture, which is the
       * question the schematic exists to answer at a glance.
       */
      const region = (id, extra) => h('button', {
        type: 'button',
        className: `${extra}${zone === id ? ' selected' : ''}${backgrounds[id].name === '' ? '' : ' has-image'}`,
        'data-dct-pick': id,
        'aria-pressed': zone === id,
        disabled: busy,
        onClick: () => setZone(id),
      }, h('span', null, t(ZONES.find((item) => item.id === id).labelKey)))

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
            h('div', { className: 'dct-title' }, t('streamFadeTitle')),
            h('div', { className: 'dct-hint' }, t('streamFadeHint'))),
          h('div', { className: 'dct-control dct-wrap' },
            h('input', {
              className: 'dct-number dct-fade-duration',
              type: 'number',
              min: STREAM_FADE_DURATION_MIN,
              max: STREAM_FADE_DURATION_MAX,
              step: STREAM_FADE_DURATION_STEP,
              value: appearance.streamingFadeDuration,
              title: t('streamFadeDurationHint'),
              'aria-label': t('streamFadeDuration'),
              onChange: (event) => {
                const ms = Number(event.target.value)
                if (Number.isFinite(ms)) {
                  updateAppearance({ streamingFadeDuration: Math.min(STREAM_FADE_DURATION_MAX, Math.max(STREAM_FADE_DURATION_MIN, Math.round(ms))) })
                }
              },
            }),
            h('span', { className: 'dct-unit' }, 'ms'),
            h('input', {
              className: 'dct-number dct-fade-ink',
              type: 'number',
              min: Math.round(STREAM_FADE_INK_MIN * 100),
              max: Math.round(STREAM_FADE_INK_MAX * 100),
              step: 5,
              value: Math.round(appearance.streamingFadeInk * 100),
              title: t('streamFadeInkHint'),
              'aria-label': t('streamFadeInk'),
              onChange: (event) => {
                const percent = Number(event.target.value)
                if (Number.isFinite(percent)) {
                  updateAppearance({ streamingFadeInk: Math.min(STREAM_FADE_INK_MAX * 100, Math.max(STREAM_FADE_INK_MIN * 100, percent)) / 100 })
                }
              },
            }),
            h('span', { className: 'dct-unit' }, '%'))),
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
            h('div', { className: 'dct-title' }, t('workEffectTitle')),
            h('div', { className: 'dct-hint' }, t('workEffectHint'))),
          h('div', { className: 'dct-control dct-wrap' },
            h('select', {
              className: 'dct-select dct-effect',
              value: working.effect,
              'aria-label': t('workEffectTitle'),
              onChange: (event) => updateWorking({ effect: event.target.value }),
            }, WORKING_EFFECTS.map((effect) => h('option', { key: effect, value: effect }, t(WORKING_EFFECT_LABELS[effect])))),
            // The two choices that only exist for the effect they belong to are simply
            // absent otherwise, rather than shown disabled: what is not offered cannot
            // be set to something no rule reaches.
            working.effect === 'shimmer' ? h('select', {
              className: 'dct-select dct-shimmer',
              value: working.shimmer,
              'aria-label': t('workShimmerStyle'),
              onChange: (event) => updateWorking({ shimmer: event.target.value }),
            }, WORKING_SHIMMER_STYLES.map((style) => h('option', { key: style, value: style }, t(WORKING_SHIMMER_LABELS[style])))) : null,
            working.effect === 'official'
              ? null
              : colorField('dct-work-color', t('workColor'), working.color, (color) => updateWorking({ color })),
            // The sweep colour is what the band is tinted with. The rainbow style fills
            // the band with the spectrum instead, so the choice is not offered there.
            working.effect === 'shimmer' && working.shimmer === 'matte'
              ? colorField('dct-work-sweep-color', t('workSweepColor'), working.sweep, (sweep) => updateWorking({ sweep }))
              : null)),
        h('div', { className: 'dct-work-preview' },
          working.effect === 'hidden'
            ? h('span', { className: 'dct-work-preview-note' }, t('workPreviewHidden'))
            : h('span', { className: 'dct-work-effect' },
              previewText,
              // The sample's band, built like the shell's: a decorative copy of the same
              // text inside a masked window. It is dressed by the very rules the
              // transcript's band is, so the sample shows the real mechanic.
              h('span', { className: 'dct-work-sweep', 'aria-hidden': true },
                h('span', { className: 'dct-work-sweep-text' }, previewText))),
          h('small', null, t('workPreviewCaption'))),
        h('div', { className: 'dct-row dct-sub' },
          h('div', { className: 'dct-text' },
            h('div', { className: 'dct-title' }, t('bgTitle')),
            h('div', { className: 'dct-hint' },
              importMessage(t, importFailure) ?? (configured > 0 ? t('bgConfigured') : t('bgHint')))),
          h('div', { className: 'dct-control dct-wrap' },
            h('input', {
              ref: fileInput,
              className: 'dct-file',
              type: 'file',
              accept: 'image/*',
              'aria-label': t('bgImport'),
              onChange: onPickFile,
            }),
            h('button', {
              type: 'button',
              className: 'dct-button dct-import',
              disabled: busy || importing,
              onClick: () => { if (fileInput.current) fileInput.current.click() },
            }, importing ? t('bgImporting') : t('bgImport')))),
        /*
         * The tabs and the schematic are two views of one choice, so either can decide
         * which zone the controls below edit: the tabs name every zone, the schematic
         * shows where each one sits in the window. Both mark a zone that already
         * carries a picture, since that is the question the panel exists to answer.
         */
        h('div', { className: 'dct-zones', role: 'group', 'aria-label': t('bgZonesHint') },
          ZONES.map((item) => h('button', {
            key: item.id,
            type: 'button',
            className: `dct-zone-tab${zone === item.id ? ' selected' : ''}${backgrounds[item.id].name === '' ? '' : ' has-image'}`,
            'data-dct-tab': item.id,
            'aria-pressed': zone === item.id,
            disabled: busy,
            onClick: () => setZone(item.id),
          },
          h('strong', null, t(item.labelKey)),
          h('small', null, backgrounds[item.id].name === '' ? t('bgUnset') : backgrounds[item.id].name)))),
        h('div', { className: 'dct-schematic', role: 'group', 'aria-label': t('bgSchematic') },
          // `global` covers the whole window, so it is drawn as the frame the rest of
          // the schematic sits inside rather than as another region beside them.
          region('global', 'dct-schematic-global'),
          region('windowbar', 'dct-schematic-windowbar'),
          region('sidebar', 'dct-schematic-sidebar'),
          h('div', { className: 'dct-schematic-main' },
            region('conversation', 'dct-schematic-conversation'),
            region('composer', 'dct-schematic-composer')),
          region('dock', 'dct-schematic-dock')),
        h('div', { className: 'dct-row dct-sub' },
          h('div', { className: 'dct-text' },
            h('div', { className: 'dct-title' }, `${t('bgZone')} · ${t(active.labelKey)}`),
            h('div', { className: 'dct-hint' }, noImage ? t('bgUnset') : config.name)),
          h('div', { className: 'dct-control dct-wrap' },
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
        let runningLabelPatch = null
        function syncRunningLabel() {
          workingStyle.textContent = workingEffectCss(workingSettings)
          if (runningLabelPatch !== null) {
            runningLabelPatch()
            runningLabelPatch = null
          }
          if (workingSettings.texts.length === 0) return
          runningLabelPatch = installRunningLabel(ctx.locale)
          if (runningLabelPatch === null) {
            ctx.logger.warn('dsh-custom-theme: this shell exposes no locale lookup the running label can be reworded through')
          }
        }
        runningLabelSync = syncRunningLabel
        syncRunningLabel()
      },
    }
  },
})
