/**
 * dsh-custom-theme — browser half. GENERATED FILE, DO NOT EDIT.
 *
 * Built from the CommonJS modules under `src/client` by `npm run build:client`.
 * The repository holds both, and `npm test` fails when they drift apart: edit
 * the module that owns the code, then rebuild, rather than editing this file.
 *
 * The shell runs this script to register one lazy factory, and running it does
 * nothing else: every module body below runs at materialization, not at load.
 */

window.__ModuleLoader__.load({
  id: "dsh-custom-theme",
  factory(require) {
    /** Module bodies, keyed by id. A body runs once, at first require. */
    const bodies = Object.create(null)
    /** What each materialized module exported, keyed by id. */
    const loaded = Object.create(null)

    /**
     * Resolve a request against the module that made it.
     * @param from - Id of the requesting module.
     * @param request - A relative request.
     * @returns The resolved module id.
     */
    function resolve(from, request) {
      const segments = `${from.slice(0, from.lastIndexOf("/"))}/${request}`.split("/")
      const parts = []
      for (const segment of segments) {
        if (segment === "" || segment === ".") continue
        if (segment === "..") parts.pop()
        else parts.push(segment)
      }
      return `./${parts.join("/")}`
    }

    /**
     * Materialize one module: run its body once, then hand back its exports.
     * @param id - Resolved module id.
     * @param from - Id of the module that asked, for the failure message.
     * @returns The module's exports.
     */
    function load(id, from) {
      if (id in loaded) return loaded[id]
      const body = bodies[id]
      if (body === undefined) {
        throw new Error(`dsh-custom-theme: no client module ${id} (required from ${from})`)
      }
      const module = { exports: {} }
      loaded[id] = module.exports
      body(module, module.exports, (request) => {
        if (request.startsWith(".")) return load(resolve(id, request), id)
        return require(request)
      })
      loaded[id] = module.exports
      return module.exports
    }

    /** appearance/constants.cjs */
    bodies["./appearance/constants.cjs"   ] = function (module, exports, require) {
  /**
   * appearance/constants.cjs — the appearance choices: presets, ranges and the stored payload.
   */
  const { h } = require('../shared/element.cjs')

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

  /** Streaming ink: how long the newest characters take to settle, and how faint they start. */
  const STREAM_FADE_DURATION_DEFAULT = 520
  const STREAM_FADE_DURATION_MIN = 150
  const STREAM_FADE_DURATION_MAX = 1500
  const STREAM_FADE_DURATION_STEP = 50
  const STREAM_FADE_INK_DEFAULT = 0.3
  const STREAM_FADE_INK_MIN = 0.05
  const STREAM_FADE_INK_MAX = 1

  /** Auto-expand reasoning mode options. */
  const REASONING_EXPAND_OPTIONS = ['streaming', 'keep', 'always', 'off']
  const REASONING_EXPAND_DEFAULT = 'streaming'

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
    const rawExpand = typeof raw.reasoningExpand === 'string' ? raw.reasoningExpand.trim() : ''
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
      reasoningExpand: REASONING_EXPAND_OPTIONS.includes(rawExpand)
        ? rawExpand
        : REASONING_EXPAND_DEFAULT,
    }
  }

  module.exports = { APPEARANCE_KEY, LINE_GAP_MIN, LINE_GAP_MAX, LINE_GAPS, FONT_SIZES, TEXT_FONT_PRESETS, CODE_FONT_PRESETS, fontOptions, cleanFont, STREAM_FADE_DURATION_DEFAULT, STREAM_FADE_DURATION_MIN, STREAM_FADE_DURATION_MAX, STREAM_FADE_DURATION_STEP, STREAM_FADE_INK_DEFAULT, STREAM_FADE_INK_MIN, STREAM_FADE_INK_MAX, REASONING_EXPAND_OPTIONS, REASONING_EXPAND_DEFAULT, readSavedAppearance }
    }

    /** appearance/index.cjs */
    bodies["./appearance/index.cjs"       ] = function (module, exports, require) {
  /**
   * appearance/index.cjs — the font, line-gap and streaming-fade sheet.
   */

  module.exports = function (deps) {
    const { ctx, tickReasoningExpand, tickStreamInk } = deps

    const { readSavedAppearance } = require('./constants.cjs')

  /**
   * Stylesheet carrying the conversation-stream choices.
   *
   * The shell declares the font families on `:root` and the line-height delta on
   * `body`, so each override has to be declared on the same element the shell
   * uses: a value inherited from `:root` loses to the shell's own `body` rule.
   */
  /** Removal of that sheet, handed to the composition root's teardown. */
  let cleanupFontStyle = () => {}
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
    // Raised specificity, not source order: the shell installs its own palette
    // styles at boot and may do so after this plugin runs, so an equal-specificity
    // `:root`/`body` rule would lose to it depending on who ran last.
    fontStyle.textContent = [
      root.length > 0 ? `html:root {\n  ${root.join('\n  ')}\n}` : '',
      body.length > 0 ? `html body {\n  ${body.join('\n  ')}\n}` : '',
    ].filter(Boolean).join('\n')

    tickStreamInk()
    tickReasoningExpand()
  }

    return {
      applyAppearance,
      // Read by features that re-read the live choices instead of a React seat:
      // the ink and the reasoning expansion consult it on every tick.
      settings: () => currentAppearanceSettings,
      disposeFontStyle: () => cleanupFontStyle(),
    }
  }
    }

    /** backgrounds/paint.cjs */
    bodies["./backgrounds/paint.cjs"      ] = function (module, exports, require) {
  /**
   * backgrounds/paint.cjs — painting the chosen pictures onto the zones, and keeping them painted.
   */

  module.exports = function (deps) {
    const { ctx } = deps

    const { readSavedBackgrounds } = require('./store.cjs')
    const { ZONES, ZONE_CHROME } = require('./zones.cjs')
    const { parseColor, withAlpha } = require('../shared/color.cjs')
    const { BACKGROUND_URL } = require('../shared/endpoints.cjs')

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

      /** The fill opacity written on each painted surface this pass, keyed by its element. */
      let paintedFills = new Map()

      /** The zone that painted each surface this pass, keyed by its element. */
      let paintedOwners = new Map()

      /** The picture each painted surface shows this pass, keyed by its element. */
      let paintedPictures = new Map()

      /**
       * The zone element each painted surface was resolved from, keyed by the surface.
       *
       * The observer cannot judge a mutation by the surface alone. A zone's own element is
       * often painted before the surface that belongs on it exists, and the shell can then
       * mount that surface without taking anything away: the picture stays on the zone's
       * element, behind the element that arrived, and only the zone says which is which.
       */
      let paintedAnchors = new Map()

      /** Watches for the shell replacing a painted surface; see {@link watchPaintedZones}. */
      let zoneObserver = null

      /**
       * The picture-layer stylesheet.
       *
       * A `::before` layer cannot be styled inline, so its declarations live here. Each
       * rule names the surface through the generated `data-dct-layer` attribute the
       * paint pass sets, which keeps two zones that land on one surface from having to
       * share a selector. The sheet is rebuilt on every pass and emptied on every
       * clear, so a zone with no picture leaves nothing behind.
       */
      /** Removal of that sheet, handed to the composition root's teardown. */
      let cleanupLayerStyle = () => {}
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

      /**
       * Take the shell's own rules and fades out of the way of a painted zone.
       *
       * The rules go into the same per-pass sheet as the pictures, so a zone that loses its
       * picture — or the next pass — puts the shell's chrome back with nothing left to undo.
       * @param zone - The zone being painted, from {@link ZONES}.
       */
      function addZoneChrome(zone) {
        const chrome = ZONE_CHROME[zone.id]
        if (chrome === undefined) return
        for (const entry of chrome) {
          const scope = entry.selector === '' ? zone.selector : `${zone.selector} ${entry.selector}`
          layerRules.push(`${scope} { ${entry.declarations} !important; }`)
        }
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
        paintedFills = new Map()
        paintedOwners = new Map()
        paintedPictures = new Map()
        paintedAnchors = new Map()
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
       * The panel fill a nested zone needs to reach its configured opacity.
       *
       * Fills composite: an outer fill of `outer` under an inner one of `inner` leaves
       * `1 - (1 - outer)(1 - inner)` of whatever is behind them covered. Solving that for the
       * inner fill is what keeps a zone nested in another — the composer seat inside the
       * conversation column — at the opacity the user configured for it, instead of quietly
       * compounding the two into a near-black block.
       * @param target - The zone's configured fill opacity, 0–1.
       * @param outer - The opacity of the painted fill already covering it, 0–1.
       * @returns The opacity this surface's own fill should be written with.
       */
      function fillAlpha(target, outer) {
        if (outer <= 0) return target
        if (outer >= 1) return 0
        const alpha = 1 - (1 - target) / (1 - outer)
        return alpha < 0 ? 0 : alpha
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
      function paintZone(zone, anchor, config, spread) {
        const surface = surfaceOf(anchor)
        const basis = tintBasis(surface)
        const color = parseColor(basis)
        // A zone nested inside another painted zone — the composer seat sits inside the
        // conversation column — must not stack a second fill on the outer one: two 91%
        // fills composite to 99%, which reads as an opaque black block over the picture,
        // and it is the picture that a nested zone is changing the look of. So this zone
        // brings the fill the user configured for it, and nothing more.
        //
        // The `global` entry is the whole-window picture, painted on the frame and spread
        // over every zone precisely because the shell's columns are opaque: a layer on the
        // frame is behind those columns and invisible in all of them. It therefore never
        // counts as a fill already under a zone, or the spread would cancel itself out.
        const enclosing = paintedSurfaces.filter((element) => element !== surface
          && typeof element.contains === 'function' && element.contains(anchor)
          && paintedOwners.get(element) !== 'global')
        // The panel fill sits under the picture, so its own alpha is what decides how
        // much of the app backdrop shows through. Only an incomplete fill is written:
        // leaving the shell's own colour alone at 100% keeps whatever alpha it had.
        if (config.panelOpacity < 100) {
          const target = config.panelOpacity / 100
          const outer = enclosing.length === 0
            ? 0
            : Math.max(...enclosing.map((element) => paintedFills.get(element) ?? 0))
          const alpha = fillAlpha(target, outer)
          setZoneProperty(surface, 'background-color', withAlpha(color, alpha))
          paintedFills.set(surface, alpha)
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
        // A nested zone only skips its own layer when the picture behind it is the very same
        // one — same image, same sizing, same strength, same anchoring — because then a
        // second copy would only read stronger than the user asked for. A nested zone with a
        // picture of its own keeps it: dropping it is how the whole-window entry once wiped
        // every zone's layer at once, since they are all nested in the frame.
        const picture = `${config.name}|${config.size}|${config.position}|${config.opacity}|${config.blur}|${spread ? 'fixed' : 'boxed'}`
        const covered = enclosing.some((element) => paintedPictures.get(element) === picture)
        if (!covered) {
          const theLayer = String(++layerSerial)
          surface.setAttribute('data-dct-layer', theLayer)
          zoneAttributes.push({ element: surface, name: 'data-dct-layer' })
          addLayerRule(theLayer, config, spread)
        }
        paintedPictures.set(surface, picture)
        addZoneChrome(zone)
        paintedOwners.set(surface, zone.id)
        paintedAnchors.set(surface, anchor)
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
            paintZone(zone, anchor, { ...settings.global, panelOpacity: settings[zone.id].panelOpacity, zone: zone.id }, true)
          }
        }
        for (const zone of ordered) {
          const anchor = targets.get(zone.id)
          if (anchor === undefined || settings[zone.id].name === '') continue
          paintZone(zone, anchor, { ...settings[zone.id], zone: zone.id }, false)
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
       * which is not rebuilt, keeps its picture — the conversation half goes bare until
       * something asks for a repaint.
       *
       * That repaint happens here, synchronously, and never on a timer: a MutationObserver
       * callback runs before the browser paints, so the replacement elements are painted in
       * the same frame the shell put them in and no bare column is ever shown. A debounce
       * used to sit here — 150 ms, to keep a running turn from repainting the app on every
       * mutation — and that delay was itself the flash: the new column existed, visibly
       * unpainted, until the timer fired. The check is now one identity test per painted
       * surface, which is cheap enough to run on every mutation.
       *
       * Only the child list is watched. The pass writes attributes and a stylesheet, never
       * nodes, so its own work cannot reach this and there is no repaint loop to guard
       * against; an attribute change could not detach a surface anyway.
       */
      function watchPaintedZones() {
        if (zoneObserver !== null || typeof window.MutationObserver === 'undefined') return
        zoneObserver = new window.MutationObserver((records) => {
          // Nothing to do unless the shell actually took a painted element away, or put one
          // where a painted picture now sits behind it: a running turn adds nodes to the
          // transcript steadily, and the second test is what keeps that free.
          if (!paintedSurfaces.some((element) => !element.isConnected)
            && !mountedOverAPicture(records)) return
          // Read fresh rather than reused from the pass that painted last: a repaint is
          // triggered by the shell rebuilding, not by a settings change, so it belongs to no
          // one pass, and the store is where the current settings live between them.
          applyBackgroundsWhenReady(readSavedBackgrounds())
        })
        zoneObserver.observe(document.body, { childList: true, subtree: true })
      }

      /** Stop watching, because no picture is painted or the plugin is being torn down. */
      function unwatchPaintedZones() {
        if (zoneObserver !== null) {
          zoneObserver.disconnect()
          zoneObserver = null
        }
      }

      /**
       * Whether this mutation put an element where a painted picture now sits behind it.
       *
       * The shell mounts a zone's surface on its own schedule, and a pass can land in the gap.
       * The conversation column is the one that matters: the column is rendered a commit before
       * the panel that fills it, so a pass in between resolves the zone to the column itself and
       * paints the picture there. When the panel arrives it covers the picture, and it stays
       * covered — nothing the pass painted left the document, so the identity test in
       * {@link watchPaintedZones} cannot see it, and without this the zone is never looked at
       * again. That is the session switch that lost its background.
       *
       * An element the shell adds inside a zone, but outside the surface that zone's picture is
       * on, is exactly that shape: the element is new, it is in the zone, and the picture is not
       * on it. Nodes that arrive inside the painted surface are the shell's own content — a reply
       * streaming into a painted conversation is the common one — and they cannot change where
       * the picture is, so they stay off the repaint path.
       *
       * The whole-window entry is exempt: its anchor is the app frame, which holds every later
       * node in the window, so testing it would repaint the app on every reply.
       * @param records - The mutation records the observer was handed.
       * @returns True when a repaint is owed.
       */
      function mountedOverAPicture(records) {
        for (const record of records) {
          if (record === null || record === undefined) continue
          for (const node of record.addedNodes ?? []) {
            if (node === null || node === undefined || node.nodeType !== 1) continue
            for (const surface of paintedSurfaces) {
              if (paintedOwners.get(surface) === 'global') continue
              const anchor = paintedAnchors.get(surface)
              if (anchor === undefined || !anchor.contains(node)) continue
              // The picture is on the surface, so the shell's own content inside it is not
              // behind the picture and owes nothing. On a zone painted at its anchor the two
              // are the same element, and then any arrival inside the zone is above it.
              if (surface !== anchor && surface.contains(node)) continue
              return true
            }
          }
        }
        return false
      }

    return { applyBackgrounds, applyBackgroundsWhenReady, watchPaintedZones, unwatchPaintedZones, clearZoneProperties, setZoneProperty, mountedOverAPicture, disposeLayerStyle: () => cleanupLayerStyle() }
  }
    }

    /** backgrounds/store.cjs */
    bodies["./backgrounds/store.cjs"      ] = function (module, exports, require) {
  /**
   * backgrounds/store.cjs — the per-zone picture choice, as remembered between sessions.
   */
  const { BLUR_MAX, BLUR_MIN, OPACITY_MAX, OPACITY_MIN, POSITIONS, ZONES, defaultZoneConfig } = require('./zones.cjs')
  const { STORAGE_KEY_BACKGROUNDS } = require('../shared/keys.cjs')

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

  module.exports = { readSavedBackgrounds, writeSavedBackgrounds }
    }

    /** backgrounds/zones.cjs */
    bodies["./backgrounds/zones.cjs"      ] = function (module, exports, require) {
  /**
   * backgrounds/zones.cjs — the zone model: which surfaces a picture can be painted onto.
   */
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

  /**
   * The shell's own chrome that a picture would otherwise be cut across by.
   *
   * Each zone lists the selectors inside it — or, with `''`, the zone's own element — whose
   * rule or fade has to step aside while that zone carries a picture. They are named as
   * tightly as the shell allows: `[class*="_header"]` on its own also matches the header of
   * every code card, terminal block and question panel inside a reply, so the conversation's
   * own header is named as the one that holds a title row.
   *
   * The declarations are written `!important` because the shell's rule has the same
   * specificity and may well come later in the document.
   */
  const ZONE_CHROME = {
    // The column's own 0.5px rule against the conversation, and the list's bottom fade.
    sidebar: [
      { selector: '', declarations: 'border-color: transparent' },
      { selector: '[class*="_treeBody"] > [class*="_fade"]', declarations: 'background-image: none' },
    ],
    // The column's own rule, the header's rule, and the composer seat's mask.
    //
    // The shell's sticky composer seat paints a dark linear gradient over the transcript so
    // scrolling messages do not show through the input box. Over a custom background picture,
    // that gradient reads as an opaque dark block. Clearing the gradient alone would let the
    // transcript slide underneath the floating composer card; instead, the seat is pinned to
    // the bottom of the conversation body, the scroll container is offset above it by
    // `--dsh-composer-height`, and the bottom-follow button and turn rail are aligned to match.
    conversation: [
      { selector: '', declarations: 'border-color: transparent' },
      { selector: '[class*="_header"]:has([class*="_titleRow"])', declarations: 'border-color: transparent' },
      { selector: ':is([class*="_body"], [class*="_embeddedBody"])', declarations: 'position: relative' },
      { selector: '[class*="_composerSeat"]', declarations: 'background: none; background-image: none' },
      { selector: ':is([data-phase=active], [data-content-phase=active]) [class*="_composerSeat"]', declarations: 'position: absolute; bottom: 0; left: 0; right: 0; background: none; background-image: none' },
      { selector: ':is([data-phase=active], [data-content-phase=active]) [class*="_composerSeat"]:has([data-trigger-menu])', declarations: 'z-index: 9' },
      { selector: ':is([data-phase=active], [data-content-phase=active]) [class*="_scrollBody"]', declarations: 'position: static; margin-bottom: var(--dsh-composer-height, 140px)' },
      { selector: '[data-conversation-scroll] [class*="_toBottomSlot"]', declarations: 'bottom: 16px' },
      { selector: '[data-conversation-scroll] [class*="_frame"]:has([class*="_scroller"])', declarations: '--turn-rail-band: var(--dsh-conversation-viewport-height, 100dvh)' },
    ],
    composer: [
      { selector: '', declarations: 'background: none; background-image: none' },
    ],
  }

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

  module.exports = { ZONES, POSITIONS, ZONE_CHROME, positionKey, OPACITY_MIN, OPACITY_MAX, BLUR_MIN, BLUR_MAX, PANEL_OPACITY, defaultZoneConfig }
    }

    /** effort/bridge.cjs */
    bodies["./effort/bridge.cjs"          ] = function (module, exports, require) {
  /**
   * effort/bridge.cjs — claiming the effort row, and giving every inline style back on release.
   */
  const { EFFORT_HOST_PART, ROW_PADDING_BLOCK } = require('./constants.cjs')
  const { findEffortRow, findEffortValueElement, findSeatEffort } = require('./dom-probe.cjs')

  /**
   * Watch the document and hang the slider's container in that row.
   *
   * @param options - `doc` and `win` are the host's; `anchor` returns this session's element
   *   in the composer; `active` says whether there is anything to draw; `onChange` receives
   *   the host record (or null) as the row is claimed and released; `seatLabels` returns
   *   every level name the collapsed seat might be showing.
   */
  function createEffortBridge(options) {
    const doc = options.doc
    const win = options.win
    const anchor = options.anchor
    const active = options.active
    const onChange = options.onChange
    const seatLabels = options.seatLabels
    if (!doc || typeof doc.createElement !== 'function') return null

    let current = null
    let seat = null
    let seatColor = ''
    let noticeEl = null
    let noticeFront = null
    let noticeBack = null
    // The value cell whose own text is currently invisible, so it can be given back.
    let hushedCell = null
    let observer = null
    let timer = null
    let disposed = false

    /** This session's composer: the shell's own marker, found upwards from the anchor. */
    function composerOf() {
      const node = anchor()
      if (!node) return null
      let el = node
      while (el && el.nodeType === 1) {
        if (typeof el.getAttribute === 'function' && el.getAttribute('data-composer-card') !== null) return el
        el = el.parentNode
      }
      return null
    }

    /**
     * The quota notice: the text this plugin draws over the row's value cell.
     *
     * An overlay, never a rewrite — the shell's own value text stays exactly as it rendered,
     * so nothing here can be mistaken for this plugin owning that text. The box is measured
     * from the value cell, and the cell's own text is hushed with a rule of ours while the
     * notice is up: that is what an overlay has to do to be readable, and it is the reason
     * nothing has to be painted behind it.
     */
    function dropNotice() {
      if (noticeEl !== null) {
        try {
          if (typeof noticeEl.remove === 'function') noticeEl.remove()
        } catch {
          // The shell may have emptied the row already.
        }
      }
      noticeEl = null
      noticeFront = null
      noticeBack = null
      hushCell(null, false)
    }

    /**
     * Make one value cell's own text invisible, or give it back.
     *
     * A class rather than an inline colour: the slider writes the cell's colour inline on
     * every pass, so only a rule of ours outranks it — and taking the class off hands the cell
     * back exactly as it was, whatever colour that happens to be.
     * @param element - The cell to hush, or `null` to give back the one that is hushed.
     * @param hushing - Whether its text should be invisible.
     */
    function hushCell(element, hushing) {
      const node = hushing ? element : (element ?? hushedCell)
      hushedCell = hushing ? node : null
      if (!node || typeof node !== 'object') return
      try {
        if (node.classList && typeof node.classList.toggle === 'function') {
          node.classList.toggle('ces-cell-hushed', hushing === true)
        }
      } catch {
        // A cell without a usable class list is simply left alone.
      }
    }

    /** Keep the notice exactly over the value cell, so the flip turns where the text is. */
    function placeNotice() {
      const row = current?.row
      const value = current?.value
      if (noticeEl === null || !row || !value) return
      try {
        if (typeof row.getBoundingClientRect !== 'function' || typeof value.getBoundingClientRect !== 'function') return
        const rowBox = row.getBoundingClientRect()
        const cellBox = value.getBoundingClientRect()
        noticeEl.style.top = `${Math.round(cellBox.top - rowBox.top)}px`
        noticeEl.style.height = `${Math.round(cellBox.height)}px`
        // Both edges, not just the right one: the box has to be the cell's own, because the
        // text inside it is aligned to that box's right edge — where the shell draws the value.
        noticeEl.style.left = `${Math.round(cellBox.left - rowBox.left)}px`
        noticeEl.style.width = `${Math.round(cellBox.width)}px`
      } catch {
        // A document without layout still gets the text, just not the exact box.
      }
    }

    /**
     * Put the notice back on the cell the row has now.
     *
     * The shell re-renders the value it shows whenever the level moves, and a row that is
     * re-rendered can hand back a different element for it: the cell that was hushed would
     * then be a cell nobody is looking at, and the new one would show its text through the
     * notice. Cheap enough to run on every pass the bridge already makes.
     */
    function refreshNotice() {
      if (noticeEl === null || current === null) return
      const value = findEffortValueElement(current.row)
      if (value !== null && value !== current.value) {
        hushCell(null, false)
        current = { ...current, value }
      }
      if (current.value !== null && current.value !== undefined) hushCell(current.value, true)
      placeNotice()
    }

    /**
     * Draw the notice, or clear it.
     *
     * `state` is `null` to clear, otherwise `{ front, back, color, flipped }`: the text shown
     * first, the text the flip lands on, and the colour both carry — the level's own.
     */
    function showNotice(state) {
      if (disposed || state === null || current === null) {
        dropNotice()
        return
      }
      if (noticeEl === null) {
        noticeEl = doc.createElement('div')
        noticeEl.className = 'ces-notice'
        noticeEl.setAttribute('data-ces-part', 'notice')
        // Decorative: the value cell right underneath already carries the level's name.
        noticeEl.setAttribute('aria-hidden', 'true')
        const inner = doc.createElement('span')
        inner.className = 'ces-notice__inner'
        noticeFront = doc.createElement('span')
        noticeFront.className = 'ces-notice__face'
        noticeBack = doc.createElement('span')
        noticeBack.className = 'ces-notice__face ces-notice__face--back'
        inner.appendChild(noticeFront)
        inner.appendChild(noticeBack)
        noticeEl.appendChild(inner)
        try {
          current.row.appendChild(noticeEl)
        } catch {
          dropNotice()
          return
        }
      }
      if (noticeFront.textContent !== state.front) noticeFront.textContent = state.front
      if (noticeBack.textContent !== state.back) noticeBack.textContent = state.back
      noticeEl.style.color = typeof state.color === 'string' ? state.color : ''
      noticeEl.setAttribute('data-flipped', state.flipped === true ? '1' : '0')
      // The shell's own text is hidden rather than covered, so nothing is painted behind the
      // notice and no two texts can ever read through each other mid-flip.
      hushCell(current.value, true)
      placeNotice()
    }

    function detach() {
      if (current === null) return
      const { row, container, value, previous } = current
      dropNotice()
      try {
        // `.remove()` on the container this plugin appended itself: never a node React
        // rendered, and never a child-removal call into the shell's own tree — which is
        // exactly what broke 0.3.1's streaming fade.
        if (container && typeof container.remove === 'function') container.remove()
      } catch {
        // The shell may have unmounted the row already.
      }
      try {
        if (row?.style) {
          row.style.height = previous.height
          row.style.flexWrap = previous.flexWrap
          row.style.paddingTop = previous.paddingTop
          row.style.paddingBottom = previous.paddingBottom
          row.style.boxShadow = previous.boxShadow
          // Written so the quota notice has a box to sit in; the shell never set it.
          row.style.position = previous.position
        }
        // The value's colour is ours too, so it goes back with the rest.
        if (value?.style) value.style.color = previous.valueColor
      } catch {
        // A failed restore does not stop the shell's menu from working.
      }
      current = null
      onChange(null)
    }

    /** Put the collapsed seat's text back and forget it. */
    function releaseSeat() {
      if (seat === null) return
      try {
        if (seat.el?.style) seat.el.style.color = seat.previousColor
      } catch {
        // The element may already be gone.
      }
      seat = null
    }

    /**
     * Keep the collapsed seat's colour current.
     *
     * The element is re-found only when it is missing or was replaced by a re-render — the
     * text changing does not replace it — so a level change never flickers through a
     * restore-then-recolour.
     */
    function syncSeat() {
      const composer = composerOf()
      if (composer === null || active() !== true) {
        releaseSeat()
        return
      }
      if (seat !== null && seat.el && doc.documentElement?.contains(seat.el)) {
        // The shell clears inline styles on its own re-render; put ours back.
        if (seatColor && seat.el.style) seat.el.style.color = seatColor
        return
      }
      releaseSeat()
      const el = findSeatEffort(doc, composer, typeof seatLabels === 'function' ? seatLabels() : null)
      if (el === null || !el.style) return
      seat = { el, previousColor: el.style.color || '' }
      if (seatColor) el.style.color = seatColor
    }

    function scan() {
      if (disposed) return
      // The seat is independent of the row: one failing must not take the other down.
      try {
        syncSeat()
      } catch {
        // Nothing to report.
      }
      try {
        const composer = composerOf()
        if (composer === null || active() !== true) {
          detach()
          return
        }
        // Already hung and still in the document: nothing to do but keep the notice on the
        // cell the row has *now* — the shell re-renders that text while the notice is up.
        if (current !== null && current.row && doc.documentElement?.contains(current.row)) {
          refreshNotice()
          return
        }

        const row = findEffortRow(doc, composer)
        if (row === null) {
          detach()
          return
        }
        detach()
        // A row that already carries a copy of this slider keeps it. Two sliders stacked in
        // one row is worse than none, and the standalone reference plugin draws its own.
        if (typeof row.querySelector === 'function' && row.querySelector(`[data-ces-part="${EFFORT_HOST_PART}"]`) !== null) return

        const value = findEffortValueElement(row)
        const previous = {
          // Unset inline properties read as '' in a real document; keeping that (rather than
          // `undefined`) is what stops a restore from writing the literal string back.
          height: row.style.height || '',
          flexWrap: row.style.flexWrap || '',
          paddingTop: row.style.paddingTop || '',
          paddingBottom: row.style.paddingBottom || '',
          boxShadow: row.style.boxShadow || '',
          position: row.style.position || '',
          valueColor: value?.style ? value.style.color || '' : '',
        }
        // Taller, and wrapping: that is what lets the slider fall onto a second line and
        // take the row's full width. Relative, so the quota notice can be placed over the
        // value cell without moving anything else in the row.
        row.style.height = 'auto'
        row.style.flexWrap = 'wrap'
        row.style.position = 'relative'
        row.style.paddingTop = ROW_PADDING_BLOCK
        row.style.paddingBottom = ROW_PADDING_BLOCK

        const container = doc.createElement('div')
        container.className = 'ces-inline'
        container.setAttribute('data-ces-part', EFFORT_HOST_PART)
        row.appendChild(container)

        current = { row, container, value, previous }
        onChange(current)

        // The menu measures itself and then sits at a fixed position, so it has to measure
        // again now that the row is taller. A resize is the shell's own cue to do that.
        try {
          win.dispatchEvent(new win.Event('resize'))
        } catch {
          // A host without an Event constructor re-measures on its next state change.
        }
      } catch {
        try {
          detach()
        } catch {
          // Bottom of the barrel.
        }
      }
    }

    function start() {
      scan()
      const MutationObserverCtor = win?.MutationObserver ?? (typeof MutationObserver === 'function' ? MutationObserver : null)
      if (typeof MutationObserverCtor === 'function') {
        try {
          observer = new MutationObserverCtor(() => scan())
          observer.observe(doc.body || doc.documentElement, { childList: true, subtree: true })
          return
        } catch {
          observer = null
        }
      }
      // Without an observer, a slow poll does the same job for a page's worth of nothing.
      if (win && typeof win.setInterval === 'function') timer = win.setInterval(scan, 400)
    }

    return {
      scan,
      start,
      /** Draw or clear the quota notice over the row's value cell. */
      notice(state) {
        showNotice(state ?? null)
      },
      /** The colour the seat should carry; the bridge applies it whenever it grabs the span. */
      setSeatColor(color) {
        seatColor = typeof color === 'string' ? color : ''
        if (seat?.el?.style) {
          try {
            seat.el.style.color = seatColor
          } catch {
            // Nothing to report.
          }
        }
      },
      dispose() {
        disposed = true
        if (observer !== null) {
          try {
            observer.disconnect()
          } catch {
            // Nothing to report.
          }
          observer = null
        }
        if (timer !== null) {
          try {
            win.clearInterval(timer)
          } catch {
            // Nothing to report.
          }
          timer = null
        }
        releaseSeat()
        detach()
      },
      host() {
        return current
      },
    }
  }

  module.exports = { createEffortBridge }
    }

    /** effort/constants.cjs */
    bodies["./effort/constants.cjs"       ] = function (module, exports, require) {
  /**
   * effort/constants.cjs — the slider's geometry, colour, motion and slot.
   */
  /*
   * The reasoning-effort slider's geometry, colour and motion.
   *
   * These are declared **before** `PAGE_CSS` on purpose: the stylesheet interpolates
   * the three geometry constants, and a template literal that reads one before its
   * declaration bakes `undefinedpx` into the track's height — the track then collapses
   * to nothing on a real page while every assertion that reads the stylesheet still
   * passes. Keeping the constants above the sheet is what makes that impossible.
   *
   * The numbers themselves come from dsh-codex-effort-slider (MIT), whose slider this
   * control re-implements; the effects are meant to be indistinguishable from it, so
   * the constants are its constants and the class names below are its class names.
   */
  /** Track height in px. The knob is the same diameter as the track — a ball in a tube. */
  const TRACK_HEIGHT = 28
  const KNOB_SIZE = TRACK_HEIGHT
  /** Knob radius: the centre's travel is inset by this at both ends, so the circle is never clipped. */
  const KNOB_RADIUS = KNOB_SIZE / 2
  /** The extra block padding the effort row takes so the slider fits on its second line. */
  const ROW_PADDING_BLOCK = '10px'
  /** Write-back throttle while dragging, in ms. A release always lands immediately. */
  const COMMIT_THROTTLE_MS = 120
  /**
   * How many painted drag frames pass between updates of the ambience behind the knob.
   *
   * The knob, the fill's edge and its colour are the pointer's own geometry, and the starfield's
   * timing has to stay continuous — re-timing an animation mid-flight re-maps its progress, so a
   * stepped clock would make the field hop. The rest of what the position decides is a value rather
   * than a motion: the energy that drives the track's glow and the nebula's opacity, the field's
   * density, the stars' layer opacity. The stylesheet already eases every one of those over 0.2s,
   * so a step of ~18ms at 165Hz is inside the easing — while re-rastering a blur radius, repainting
   * the shell's own row and re-writing a layer's opacity 165 times a second is work the frame the
   * pointer needs is short of.
   */
  const AMBIENCE_FRAME_EVERY = 3
  /** How long a commit may stay unacknowledged before the display rolls back, in ms. */
  const COMMIT_DEADLINE_MS = 10000
  /** Backoff for a directory that is not ready yet: about nine seconds in total. */
  const RETRY_DELAYS = [60, 240, 540, 960, 1500, 3000, 3000]
  /**
   * How long the quota notice stands before it flips to the level's own name, in ms.
   *
   * Long enough to be read at a glance, short enough that the value is back where the user
   * expects it before the eye returns to it.
   */
  const QUOTA_NOTICE_MS = 1000
  /**
   * The starfield's base crossing time in seconds, and each star's share of spread around it.
   *
   * The base is what the fastest position (`MAX_SPEED_FACTOR`) crosses in: the top level
   * takes 1.5s, the level that reads as 1× takes 3s, and the left end about 8.6s. ±8% keeps
   * "some stars a little quicker" without letting a fast star lap a slow one into a clump.
   */
  const STARFIELD_DURATION_MEAN = 1.5
  const STARFIELD_DURATION_SPREAD = 0.08
  /** The dimmest/smallest a star may be; 1 is the full 3px dot at full brightness. */
  const STARFIELD_MIN = 0.5
  /** The golden ratio, which spreads the stars' phases as a low-discrepancy sequence. */
  const GOLDEN_RATIO = 0.6180339887498949
  /** The fastest position factor, which the base crossing time is aligned to. */
  const MAX_SPEED_FACTOR = 2
  /** Reduced motion slows the stars by this factor rather than freezing them. */
  const REDUCED_MOTION_SLOWDOWN = 2.6
  /** Stars whose phases are neighbours must differ by this many height slots (1 slot = 4%). */
  const MIN_HEIGHT_SLOTS = 3
  /** Energy begins at the second stop and reaches full at the last one. */
  const ENERGY_START = 1 / 3
  const ENERGY_END = 2 / 3
  /** Blue → violet → deep violet. The first stop to the second stays blue. */
  const COLOR_BLUE = [77, 147, 248]
  const COLOR_VIOLET = [147, 51, 234]
  const COLOR_DEEP = [76, 29, 149]
  /**
   * The value text's own violet end.
   *
   * Text cannot follow the fill down into `COLOR_DEEP`, which is nearly invisible on a
   * dark surface, so it stops at this mid violet: about 4.2:1 on white and 4.0:1 on the
   * dark chrome, so both palettes stay readable.
   */
  const COLOR_TEXT_VIOLET = [139, 92, 246]
  /** DeepSeek ocean theme palette: base cyan-blue → luminous bioluminescent cyan → abyssal blue. */
  const COLOR_DEEPSEEK_BASE = [14, 165, 233]
  const COLOR_DEEPSEEK_CYAN = [56, 189, 248]
  const COLOR_DEEPSEEK_ABYSS = [3, 105, 161]
  const COLOR_DEEPSEEK_TEXT = [2, 132, 199]
  /** The storage key and themes for slider visual styling: Codex starfield vs DeepSeek ocean whale. */
  const EFFORT_THEME_KEY = 'dsh-custom-theme.effort-theme'
  const EFFORT_THEME_DEFAULT = 'codex'
  const EFFORT_THEMES = Object.freeze(['codex', 'deepseek'])

  /** Normalize an arbitrary theme string to a supported theme. */
  function normalizeEffortTheme(theme) {
    return EFFORT_THEMES.includes(theme) ? theme : EFFORT_THEME_DEFAULT
  }

  /** Read the stored slider theme, defaulting to 'codex'. */
  function readSavedEffortTheme() {
    try {
      if (typeof localStorage === 'undefined') return EFFORT_THEME_DEFAULT
      const value = localStorage.getItem(EFFORT_THEME_KEY)
      return normalizeEffortTheme(value)
    } catch {
      return EFFORT_THEME_DEFAULT
    }
  }

  /** Persist the slider theme and notify active sliders in real time. */
  function writeSavedEffortTheme(theme) {
    const normalized = normalizeEffortTheme(theme)
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(EFFORT_THEME_KEY, normalized)
      }
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('dsh-effort-theme-change', { detail: normalized }))
      }
    } catch {
      // Storage sandboxed or unavailable
    }
  }
  /** The effort row's captions, as the shell spells them; the second one is the fallback. */
  const EFFORT_ROW_LABELS = ['推理等级', 'Effort']
  const EFFORT_SLOT = 'conversation.input.right'
  const EFFORT_ENTRY_ID = 'dsh-custom-theme-effort'
  const EFFORT_ENTRY_ORDER = 40
  /** The class the slider's own nodes carry, and the marker a foreign copy of it leaves. */
  const EFFORT_HOST_PART = 'host'

  module.exports = {
    TRACK_HEIGHT,
    KNOB_SIZE,
    KNOB_RADIUS,
    ROW_PADDING_BLOCK,
    COMMIT_THROTTLE_MS,
    AMBIENCE_FRAME_EVERY,
    COMMIT_DEADLINE_MS,
    RETRY_DELAYS,
    QUOTA_NOTICE_MS,
    STARFIELD_DURATION_MEAN,
    STARFIELD_DURATION_SPREAD,
    STARFIELD_MIN,
    GOLDEN_RATIO,
    MAX_SPEED_FACTOR,
    REDUCED_MOTION_SLOWDOWN,
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
    EFFORT_ROW_LABELS,
    EFFORT_SLOT,
    EFFORT_ENTRY_ID,
    EFFORT_ENTRY_ORDER,
    EFFORT_HOST_PART,
  }
    }

    /** effort/directory-access.cjs */
    bodies["./effort/directory-access.cjs"] = function (module, exports, require) {
  /**
   * effort/directory-access.cjs — the session's model directory, read and written through the shell.
   */
  const { RETRY_DELAYS } = require('./constants.cjs')
  const { EMPTY_MODEL_SNAPSHOT } = require('./math.cjs')

  /**
   * One session's view of its model directory.
   *
   * `directoryFor(sessionId)` throws by design until a session's scope is bound, and the
   * directory itself can be rebuilt (a model generation change, a reconnect), so the
   * instance is resolved on every read rather than caught once and kept. A resolution that
   * fails backs off and retries; the subscription follows the instance.
   */
  function createEffortDirectoryAccess(ctx, sessionId, timers) {
    const listeners = new Set()
    let directory = null
    let unsubscribe = null
    let last = EMPTY_MODEL_SNAPSHOT
    let retryIndex = 0
    let retryTimer = null
    let closed = false
    let lastLoadAt = 0

    function notify() {
      for (const listener of [...listeners]) {
        try {
          listener()
        } catch {
          // One subscriber's failure is not the others' problem.
        }
      }
    }

    function scheduleRetry() {
      if (closed || retryTimer !== null || retryIndex >= RETRY_DELAYS.length) return
      const delay = RETRY_DELAYS[retryIndex]
      retryIndex += 1
      retryTimer = timers.set(() => {
        retryTimer = null
        // A retry that succeeds has to announce itself: the caller (React's store
        // subscription) is waiting for the store to exist.
        if (resolve() !== null) {
          notify()
          return
        }
        // Without this the self-healing chain dies at the first failed retry and the
        // control stays silently dead — the exact "one bad moment at startup becomes a
        // permanently broken control" failure this is here to prevent.
        scheduleRetry()
      }, delay)
    }

    /** Resolve the directory again; re-subscribe when the instance changed. */
    function resolve() {
      if (closed) return null
      let fresh = null
      try {
        fresh = ctx.modelDirectories.directoryFor(sessionId)
      } catch {
        fresh = null
      }
      if (!fresh?.store || typeof fresh.store.getSnapshot !== 'function') fresh = null
      if (fresh === directory) return directory
      if (unsubscribe !== null) {
        try {
          unsubscribe()
        } catch {
          // A failed unsubscribe does not stop the new subscription.
        }
        unsubscribe = null
      }
      directory = fresh
      if (directory !== null) {
        retryIndex = 0
        try {
          unsubscribe = typeof directory.store.subscribe === 'function' ? directory.store.subscribe(notify) : null
        } catch {
          unsubscribe = null
        }
        kickLoad()
      }
      return directory
    }

    /** Pull the directory once: without a load the store sits idle and serves no levels. */
    function kickLoad() {
      if (closed || directory === null || typeof directory.load !== 'function') return
      const now = Date.now()
      if (now - lastLoadAt < 400) return
      lastLoadAt = now
      const target = directory
      try {
        Promise.resolve(target.load()).catch(() => {
          // The reason is carried in the store's own error field.
        })
      } catch {
        // A synchronous throw is the store's to report as well.
      }
    }

    return {
      getSnapshot() {
        if (closed) return EMPTY_MODEL_SNAPSHOT
        if (directory === null) {
          resolve()
          if (directory === null) scheduleRetry()
        }
        if (directory !== null) {
          try {
            const value = directory.store.getSnapshot()
            if (value && typeof value === 'object') last = value
          } catch {
            // Keep the previous snapshot rather than breaking the render.
          }
        }
        return last
      },
      subscribe(listener) {
        if (closed) return () => {}
        listeners.add(listener)
        if (directory === null) {
          resolve()
          if (directory === null) scheduleRetry()
        }
        // StrictMode subscribes and unsubscribes twice; unsubscribing must not close the access.
        return () => {
          listeners.delete(listener)
        }
      },
      /** The directory to write through, resolved at the moment of the call. */
      directory() {
        const fresh = resolve()
        return fresh !== null ? fresh : directory
      },
      load: kickLoad,
      dispose() {
        closed = true
        listeners.clear()
        if (retryTimer !== null) {
          try {
            timers.clear(retryTimer)
          } catch {
            // Nothing to report.
          }
          retryTimer = null
        }
        if (unsubscribe !== null) {
          try {
            unsubscribe()
          } catch {
            // Nothing to report.
          }
          unsubscribe = null
        }
        directory = null
      },
    }
  }

  module.exports = { createEffortDirectoryAccess }
    }

    /** effort/dom-probe.cjs */
    bodies["./effort/dom-probe.cjs"       ] = function (module, exports, require) {
  /**
   * effort/dom-probe.cjs — finding the effort row, its value cell and its seat by semantics.
   */
  const { EFFORT_ROW_LABELS } = require('./constants.cjs')

  /* ── The menu row's DOM, read and dressed ─────────────────────────────────── */

  /** The first non-empty text a row carries. */
  function firstSpanText(row) {
    try {
      for (const span of row.querySelectorAll('span')) {
        if (typeof span.textContent === 'string' && span.textContent.length > 0) return span.textContent
      }
    } catch {
      // Falling through to the structural answer is the caller's business.
    }
    return ''
  }

  /**
   * The row's value text — the `cellValue` span holding "Max" / "High".
   *
   * The class is a hashed one, so a miss falls back to structure: the last span inside the
   * row that carries text (the value sits after the label and before the chevron). Only its
   * colour is ever written; the text itself belongs to the shell.
   */
  function findEffortValueElement(row) {
    if (!row || typeof row.querySelectorAll !== 'function') return null
    try {
      const byClass = row.querySelectorAll("span[class*='cellValue']")
      if (byClass.length > 0) return byClass[byClass.length - 1]
      let found = null
      for (const span of row.querySelectorAll('span')) {
        if (typeof span.textContent === 'string' && span.textContent.replace(/\s+/gu, '').length > 0) found = span
      }
      return found
    } catch {
      return null
    }
  }

  /**
   * The level's name on the collapsed seat (`DeepSeek-V41-Flash  High  ⌄`).
   *
   * That span's class is hashed and changes with the build, so it is found by *text*: what
   * the seat shows is a level's own name, which is the same datum this plugin reads from the
   * directory. All known names are matched, not just the current one — the shell has not
   * re-rendered the seat yet the instant a level changes, and matching only the new name
   * would let the colour slip for a frame. No known name means no match, and nothing else on
   * the seat is ever touched.
   */
  function findSeatEffort(doc, composer, expectedLabels) {
    if (!doc || !composer || typeof doc.querySelectorAll !== 'function') return null
    const list = typeof expectedLabels === 'string' ? [expectedLabels] : expectedLabels
    if (!Array.isArray(list)) return null
    const wanted = []
    for (const label of list) {
      const name = typeof label === 'string' ? label.replace(/\s+/gu, '') : ''
      if (name.length > 0 && !wanted.includes(name)) wanted.push(name)
    }
    if (wanted.length === 0) return null
    try {
      for (const seat of doc.querySelectorAll('button[aria-haspopup="menu"]')) {
        if (!composer.contains(seat)) continue
        for (const span of seat.querySelectorAll('span')) {
          const text = span.textContent
          if (typeof text === 'string' && wanted.includes(text.replace(/\s+/gu, ''))) return span
        }
      }
    } catch {
      return null
    }
    return null
  }

  /**
   * The open model menu's reasoning-effort row, in this session's own composer.
   *
   * The seat is the shell's own trigger (`aria-haspopup="menu"` and `aria-expanded="true"`),
   * the menu is what its `aria-controls` names, and the row is one of the menu's two
   * `menuitem` buttons. The sub-panes use `menuitemradio`, so two `menuitem`s *is* the root
   * panel — and its second row is the effort row whether or not the caption is recognised.
   */
  function findEffortRow(doc, composer) {
    if (!doc || !composer || typeof doc.querySelectorAll !== 'function') return null
    let seat = null
    for (const candidate of doc.querySelectorAll('button[aria-haspopup="menu"][aria-expanded="true"]')) {
      if (composer.contains(candidate)) {
        seat = candidate
        break
      }
    }
    if (seat === null) return null
    const menuId = typeof seat.getAttribute === 'function' ? seat.getAttribute('aria-controls') : null
    const menu = menuId && typeof doc.getElementById === 'function' ? doc.getElementById(menuId) : null
    if (!menu) return null
    const items = menu.querySelectorAll('button[role="menuitem"]')
    if (items.length !== 2) return null
    for (const item of items) {
      if (EFFORT_ROW_LABELS.includes(firstSpanText(item))) return item
    }
    return items[1]
  }

  module.exports = { firstSpanText, findEffortValueElement, findSeatEffort, findEffortRow }
    }

    /** effort/entry.cjs */
    bodies["./effort/entry.cjs"           ] = function (module, exports, require) {
  /**
   * effort/entry.cjs — the slot entry the row registers, and the context a slot does not carry.
   */
  const { EffortSlider } = require('./slider.cjs')
  const { h } = require('../shared/element.cjs')

  /**
   * The slot entry: the control plus the context a slot does not carry.
   *
   * `ctx` has to be the scope that injected `modelDirectories` rather than the plugin's own
   * context — the control reads `ctx.modelDirectories.directoryFor` and nothing else, and the
   * plugin deliberately does not declare that service.
   */
  function effortSliderEntry(ctx) {
    return function EffortSliderEntry(props) {
      return h(EffortSlider, { ...props, __ctx: ctx })
    }
  }

  module.exports = { effortSliderEntry }
    }

    /** effort/math.cjs */
    bodies["./effort/math.cjs"            ] = function (module, exports, require) {
  /**
   * effort/math.cjs — the arithmetic behind the slider — pure, so the effect is testable.
   */
  const {
    COLOR_BLUE,
    COLOR_DEEP,
    COLOR_TEXT_VIOLET,
    COLOR_VIOLET,
    COLOR_DEEPSEEK_BASE,
    COLOR_DEEPSEEK_CYAN,
    COLOR_DEEPSEEK_ABYSS,
    COLOR_DEEPSEEK_TEXT,
    ENERGY_END,
    ENERGY_START,
    GOLDEN_RATIO,
    KNOB_RADIUS,
    MAX_SPEED_FACTOR,
    MIN_HEIGHT_SLOTS,
    STARFIELD_DURATION_MEAN,
    STARFIELD_DURATION_SPREAD,
    STARFIELD_MIN,
  } = require('./constants.cjs')
  const { mixColor, rgbOf } = require('../shared/color.cjs')

  const EMPTY_MODEL_SNAPSHOT = Object.freeze({
    current: null,
    groups: [],
    failures: [],
    status: 'idle',
    pending: null,
    error: null,
    retainedEffort: undefined,
  })

  /** The current model's entry in a directory snapshot, or null. */
  function modelOf(state) {
    const current = state?.current
    if (typeof current?.provider !== 'string' || typeof current?.model !== 'string') return null
    const groups = Array.isArray(state.groups) ? state.groups : []
    for (const group of groups) {
      if (group?.id !== current.provider) continue
      const models = Array.isArray(group.models) ? group.models : []
      for (const model of models) {
        if (model?.id === current.model) return model
      }
    }
    return null
  }

  /** The levels the current model actually serves, in the directory's own order. */
  function effortLevelsOf(state) {
    const model = modelOf(state)
    const efforts = Array.isArray(model?.reasoning?.efforts) ? model.reasoning.efforts : []
    const levels = []
    for (const effort of efforts) {
      if (typeof effort?.id !== 'string' || effort.id.length === 0) continue
      levels.push({
        id: effort.id,
        name: typeof effort.name === 'string' && effort.name.length > 0 ? effort.name : effort.id,
      })
    }
    return levels
  }

  /**
   * The level in force: the session's own choice, or the model's default when it has none —
   * the shell's `intended.reasoningEffort ?? reasoning.defaultEffort`, read the same way.
   */
  function effectiveEffortId(state) {
    const current = state?.current
    if (typeof current?.reasoningEffort === 'string' && current.reasoningEffort.length > 0) {
      return current.reasoningEffort
    }
    const fallback = modelOf(state)?.reasoning?.defaultEffort
    return typeof fallback === 'string' && fallback.length > 0 ? fallback : null
  }

  /** The index of a level id, or -1. */
  function indexOfLevel(levels, id) {
    if (typeof id !== 'string') return -1
    return levels.findIndex((level) => level.id === id)
  }

  /** Clamp to 0..1, NaN included. */
  function clamp01(value) {
    if (!(value > 0)) return 0
    return value > 1 ? 1 : value
  }

  /** A track position to the level it snaps to: the track is continuous, the levels are not. */
  function indexFromPct(pct, count) {
    if (count <= 1) return 0
    return Math.max(0, Math.min(count - 1, Math.round(clamp01(pct) * (count - 1))))
  }

  /** A level to its position on the track, so a tick and the knob share one geometry. */
  function pctFromIndex(index, count) {
    if (count <= 1) return 0
    return Math.max(0, Math.min(count - 1, index)) / (count - 1)
  }
  /**
   * The starfield, derived entirely from the index.
   *
   * 22 stars, no random numbers: the same render draws the same field, and every property
   * below can be asserted offline.
   *
   * Height and phase are dealt from **two unrelated** sequences on purpose. An earlier
   * version took both from `frac((i + 1) × φ)`, which sorted the stars into a diagonal —
   * "the further right, the higher" (a measured correlation of 0.999). Phase stays a
   * golden-ratio low-discrepancy sequence, so any prefix of it is still spread out, while
   * height is a deterministic *shuffle* of evenly spaced slots, and the salt is chosen so
   * that stars whose phases are neighbours — the ones that travel side by side — are at
   * least `MIN_HEIGHT_SLOTS` apart.
   */
  const EFFORT_STARS = (function buildEffortStars() {
    const count = 22
    const stars = []
    for (let i = 0; i < count; i += 1) stars.push({ y: 0, phase: ((i + 1) * GOLDEN_RATIO) % 1 })
    const byPhase = stars.map((_, i) => i).sort((a, b) => stars[a].phase - stars[b].phase)
    let slots = null
    for (let salt = 71; salt < 4000 && slots === null; salt += 1) {
      const candidate = stars.map((_, i) => i)
      candidate.sort((a, b) => {
        const ha = starHash01(a, salt)
        const hb = starHash01(b, salt)
        return ha === hb ? a - b : ha - hb
      })
      let ok = true
      for (let k = 1; k < count && ok; k += 1) {
        if (Math.abs(candidate[k] - candidate[k - 1]) < MIN_HEIGHT_SLOTS) ok = false
      }
      if (ok) slots = candidate
    }
    if (slots === null) {
      // A fallback that is still a permutation: a stride of 5 is coprime with 22.
      slots = stars.map((_, i) => (i * 5) % count)
    }
    for (let rank = 0; rank < count; rank += 1) stars[byPhase[rank]].y = 8 + (slots[rank] / (count - 1)) * 84
    return stars
  })()

  /** A deterministic pseudo-random number in [0, 1): no `Math.random`, so renders never jump. */
  function starHash01(index, salt) {
    const value = ((index + 1) * salt * 2654435761) % 4294967296
    return ((value >>> 8) % 1000) / 1000
  }

  /** Mix two `[r, g, b]` colours. */

  /** The position's own colour: blue until the second stop, then violet, then deep violet. */
  function fillColorFor(pct, theme = 'codex') {
    const t = clamp01(pct)
    if (theme === 'deepseek') {
      if (t <= ENERGY_START) return rgbOf(COLOR_DEEPSEEK_BASE)
      if (t <= ENERGY_END) return rgbOf(mixColor(COLOR_DEEPSEEK_BASE, COLOR_DEEPSEEK_CYAN, (t - ENERGY_START) / (ENERGY_END - ENERGY_START)))
      return rgbOf(mixColor(COLOR_DEEPSEEK_CYAN, COLOR_DEEPSEEK_ABYSS, (t - ENERGY_END) / (1 - ENERGY_END)))
    }
    if (t <= ENERGY_START) return rgbOf(COLOR_BLUE)
    if (t <= ENERGY_END) return rgbOf(mixColor(COLOR_BLUE, COLOR_VIOLET, (t - ENERGY_START) / (ENERGY_END - ENERGY_START)))
    return rgbOf(mixColor(COLOR_VIOLET, COLOR_DEEP, (t - ENERGY_END) / (1 - ENERGY_END)))
  }

  /** The fill's gradient: blue on the left, the position's own colour at the knob. */
  function fillBackgroundFor(pct, theme = 'codex') {
    const start = theme === 'deepseek' ? rgbOf(COLOR_DEEPSEEK_BASE) : rgbOf(COLOR_BLUE)
    return `linear-gradient(90deg, ${start}, ${fillColorFor(pct, theme)})`
  }

  /**
   * Whether a level means "reasoning off".
   *
   * DeepSeek spells it id `off` and name `Off`, but the id belongs to the provider, so both
   * are checked, plus the spellings other providers use. An off level keeps the shell's own
   * grey: the caller writes an empty colour, which is what clears an inline colour.
   */
  function isOffLevel(level) {
    if (!level) return false
    return [level.id, level.name].some((candidate) => {
      if (typeof candidate !== 'string') return false
      const flat = candidate.replace(/\s+/gu, '').toLowerCase()
      return flat === 'off' || flat === 'none' || flat === '关闭' || flat === '无'
    })
  }

  /** The value text's colour for a position: blue → violet/cyan, and nothing at all when off. */
  function valueColorFor(pct, level, theme = 'codex') {
    if (isOffLevel(level)) return ''
    if (theme === 'deepseek') {
      return rgbOf(mixColor(COLOR_DEEPSEEK_BASE, COLOR_DEEPSEEK_TEXT, energyFor(pct)))
    }
    return rgbOf(mixColor(COLOR_BLUE, COLOR_TEXT_VIOLET, energyFor(pct)))
  }

  /**
   * The energy at a position, 0..1: the whole nebula-and-stars effect is driven by this one
   * number, and it is driven by *position*, not by the number of levels. Nothing lights up
   * before the second stop, so the left half stays a clean blue.
   */
  function energyFor(pct) {
    return clamp01((clamp01(pct) - ENERGY_START) / (1 - ENERGY_START))
  }

  /**
   * The starfield's speed factor at a position.
   *
   * The middle of the track reads as 1× — "the speed that felt right" — and the top level as
   * 2×; to the left the same slope continues, floored at 0.35× so the field never freezes.
   */
  function speedFor(pct) {
    return Math.min(2, Math.max(0.35, 3 * clamp01(pct) - 1))
  }

  /** How many of the 22 stars a position shows: the field thickens as energy rises. */
  function particleCountFor(pct) {
    return Math.round(energyFor(pct) * EFFORT_STARS.length)
  }

  /** How bright and how large a star is, in [STARFIELD_MIN, 1]: brighter is also bigger. */
  function starBrightnessFor(index) {
    return STARFIELD_MIN + (1 - STARFIELD_MIN) * starHash01(index, 61)
  }

  /**
   * How long a star takes to cross the whole track, in seconds.
   *
   * Speed follows the position — the top level crosses in 1.5s, the 1× level in 3s, the left
   * end in about 8.6s — with only ±8% between individual stars, so quicker stars never lap
   * slower ones into a queue.
   */
  function starDurationFor(index, speedFactor) {
    const speed = Math.min(MAX_SPEED_FACTOR, Math.max(0.35, typeof speedFactor === 'number' ? speedFactor : MAX_SPEED_FACTOR))
    const spread = 1 - STARFIELD_DURATION_SPREAD + 2 * STARFIELD_DURATION_SPREAD * starHash01(index, 29)
    return (STARFIELD_DURATION_MEAN * MAX_SPEED_FACTOR) / speed * spread
  }

  /**
   * A star's phase, as a negative delay in seconds.
   *
   * The phase depends on the index only — never on how many stars are currently shown. Were
   * it `i / count`, dragging would rewrite the `animation-delay` of stars that are already
   * animating, and the whole field would shuffle on every energy step.
   */
  function starDelayFor(index, duration) {
    const phase = EFFORT_STARS[index]?.phase ?? 0
    const jitter = starHash01(index, 53) * 0.03
    return -(((phase + jitter) % 1)) * duration
  }

  /** How many stars a position shows. */
  function starCountFor(pct) {
    return particleCountFor(pct)
  }

  /**
   * The starfield layer's own opacity.
   *
   * The nebula's opacity *is* the energy, which is only 0.5 at the high level; stars nested
   * inside it would be halved with it and read as missing, so they ride their own layer with
   * a floor instead. "Appearing gradually" is expressed by the star count.
   */
  function starLayerOpacityFor(pct) {
    return 0.6 + 0.4 * energyFor(pct)
  }

  /**
   * Where the knob's centre, the fill's end and every tick sit:
   * `radius + pct × (100% − diameter)`.
   *
   * Insetting by a radius at both ends is what keeps the circle whole: at either extreme its
   * centre is still inside the track's rounded cap, so the shell's `overflow: hidden` has
   * nothing to cut.
   */
  function knobOffsetOf(pct) {
    const t = Math.round(clamp01(pct) * 10000) / 10000
    return `calc(${KNOB_RADIUS}px + ${t} * (100% - ${KNOB_RADIUS * 2}px))`
  }

  module.exports = { EMPTY_MODEL_SNAPSHOT, modelOf, effortLevelsOf, effectiveEffortId, indexOfLevel, clamp01, indexFromPct, pctFromIndex, EFFORT_STARS, starHash01, fillColorFor, fillBackgroundFor, isOffLevel, valueColorFor, energyFor, speedFor, particleCountFor, starBrightnessFor, starDurationFor, starDelayFor, starCountFor, starLayerOpacityFor, knobOffsetOf }
    }

    /** effort/messages.cjs */
    bodies["./effort/messages.cjs"        ] = function (module, exports, require) {
  /**
   * effort/messages.cjs — the control's strings, and the settings row that switches the feature.
   */
  /** A failure the slider can describe, preferring whatever the host said. */
  function effortErrorText(error, t) {
    if (error === null || error === undefined) return t('effortErrorGeneric')
    if (typeof error === 'string') return error
    if (typeof error.message === 'string' && error.message.length > 0) return error.message
    if (typeof error.code === 'string' && error.code.length > 0) return error.code
    return String(error)
  }

  /**
   * The sentence the reasoning-level row shows under its switch.
   *
   * A read that has not answered yet, a Host too old to know the route, and a profile the
   * feature cannot help are three different situations, and each gets its own answer: only the
   * last one is about the models themselves.
   * @param t - Locale lookup.
   * @param state - The Host's answer, or `null` before the first one.
   * @returns The hint text.
   */
  function effortMessage(t, state) {
    if (state === null) return t('effortsLoading')
    if (state.status === 404 || state.status === 405) return t('effortsStale')
    if (typeof state.failure === 'string' && state.failure !== '') {
      return t('effortsFailed') + (typeof state.status === 'number' ? ` (HTTP ${state.status})` : '')
    }
    if (state.file === null || state.file === undefined) return t('effortsNoProfile')
    if (state.enabled === false) {
      const waiting = Array.isArray(state.undeclared) ? state.undeclared.length : 0
      return waiting === 0 ? t('effortsOff') : `${t('effortsOff')} · ${t('effortsWaiting')} ${waiting}`
    }
    const managed = Array.isArray(state.managed) ? state.managed.length : 0
    if (managed === 0) return t('effortsNothing')
    const restart = state.restartRequired === true ? ` · ${t('effortsRestart')}` : ''
    return `${t('effortsManaged')} ${managed}${restart}`
  }

  /**
   * The settings row that carries the reasoning-level switch.
   *
   * Built by its own function rather than written into the page, because the page's component
   * cannot be rendered outside a browser: hooks are what make it one, and the offline suite has
   * none. This half — the tree, and what each state shows — is the half that can be asserted
   * without a renderer.
   * @param h - Element factory.
   * @param t - Locale lookup.
   * @param state - The Host's answer, or `null` before the first one.
   * @param onToggle - Called with the wanted state when the switch moves.
   * @returns The row element.
   */
  function effortLevelsRow(h, t, state, onToggle) {
    const on = state !== null && state.enabled === true
    return h('div', { className: 'dct-row dct-sub' },
      h('div', { className: 'dct-text' },
        h('div', { className: 'dct-title' }, t('effortsTitle')),
        h('div', { className: 'dct-hint' }, t('effortsHint')),
        state === null ? null : h('div', { className: 'dct-note' }, effortMessage(t, state))),
      h('div', { className: 'dct-control' },
        h('label', { className: 'dct-toggle' },
          h('input', {
            type: 'checkbox',
            className: 'dct-efforts',
            checked: on,
            // Nothing can be turned on before the state is known, and nothing can be turned off
            // where the Host found no file to edit: the switch has no work to ask for.
            disabled: state === null || state.busy === true || typeof state.file !== 'string',
            'aria-label': t('effortsTitle'),
            onChange: (event) => onToggle(event.target.checked),
          }),
          h('span', null, on ? t('effortsOnLabel') : t('effortsOffLabel')))))
  }

  /* ═════════════════ The injected-context rows ═════════════════
   *
   * Every piece of text the harness injects into the model's conversation — a skill's
   * instructions, the skill catalog, the workspace's rules, an `@session` recall, a
   * notice — is logged as a `user/message` (or `developer/message`) whose source is not
   * `user`, and the shell used to draw each one as its 「上下文注入」 disclosure row. The
   * installed build hides them: `isVisibleChatNode` keeps a context row only when the
   * injection also records a tool addition or removal, so an ordinary injection is
   * invisible in the transcript although it is still logged and still reaches the model.
   *
   * This restores those rows behind a setting, and it does so through the seams the shell
   * itself uses rather than by patching anything. Two registrations make one row:
   *
   *  1. a Conversation **Definition** on `uiConversation.events`, which classifies the
   *     same durable events and builds a Node of this plugin's own kind; and
   *  2. a **keyed entry** in `conversation.chat.node` under that kind, which draws it.
   *
   * The shell's own `input-message` Definition keeps its node, its key and its
   * classification: this adds a second Definition beside it and never touches the first,
   * so the shell's filter and everything that reads the shell's nodes are unaffected.
   *
   * Two details are deliberate.
   *
   *  - **The classification is the shell's, not an approximation.** A waking message —
   *    a queued message that starts a new Turn — is drawn by the shell as its own trigger
   *    row, so the Definition reads the same `inbox-next-turn` / `inbox-next-step` states
   *    the shell reads and leaves that node hidden. It uses the shell's own mechanism for
   *    that: `isVisibleChatNode` honours `visibility: 'hidden'`.
   *
   *  - **Off means the shipped behaviour.** With the switch off no Definition is
   *    registered at all, so the Node store, the grouping and the transcript are exactly
   *    what the shell builds on its own. Toggling re-registers it, and a Definition
   *    change is what makes the conversation engine rebuild every open transcript — which
   *    is why the restored rows appear in an already-open session rather than only in the
   *    next one.
   *
   * Everything here is a pure function of a durable event and the state the setting reads,
   * so it lives beside the other helpers rather than inside `apply`: the wiring that
   * reaches `uiConversation` is the only part that needs the services.
   */

  module.exports = { effortErrorText, effortMessage, effortLevelsRow }
    }

    /** effort/slider.cjs */
    bodies["./effort/slider.cjs"          ] = function (module, exports, require) {
  /**
   * effort/slider.cjs — the control itself: the track, its layers, the drag and the keyboard path.
   */
  const { createEffortBridge } = require('./bridge.cjs')
  const { COMMIT_DEADLINE_MS, AMBIENCE_FRAME_EVERY, COMMIT_THROTTLE_MS, EFFORT_THEME_KEY, EFFORT_THEMES, KNOB_RADIUS, QUOTA_NOTICE_MS, REDUCED_MOTION_SLOWDOWN, readSavedEffortTheme } = require('./constants.cjs')
  const { createEffortDirectoryAccess } = require('./directory-access.cjs')
  const { EFFORT_STARS, EMPTY_MODEL_SNAPSHOT, clamp01, effectiveEffortId, effortLevelsOf, energyFor, fillBackgroundFor, indexFromPct, indexOfLevel, knobOffsetOf, pctFromIndex, speedFor, starBrightnessFor, starCountFor, starDelayFor, starDurationFor, starLayerOpacityFor, valueColorFor } = require('./math.cjs')
  const { effortErrorText } = require('./messages.cjs')
  const { h } = require('../shared/element.cjs')
  const React = require('react')
  const ReactDOM = require('react-dom')

  /* ── The control ──────────────────────────────────────────────────────────── */

  /**
   * The slider.
   *
   * One component holds the anchor, the bridge and the control itself, so the hooks belong
   * to a single instance that never re-orders them when the menu opens and closes. The
   * control is portalled into the container the bridge put in the shell's row; the component
   * itself renders the invisible anchor that keeps its place in the composer.
   */
  function EffortSlider(props) {
    const sessionId = typeof props.sessionId === 'string' && props.sessionId.length > 0 ? props.sessionId : null
    const locked = props.locked === true
    const ctx = props.__ctx
    const t = typeof props.t === 'function' ? props.t : (key) => key

    const [savedTheme, setSavedTheme] = React.useState(readSavedEffortTheme)
    const activeTheme = props.theme || savedTheme

    React.useEffect(() => {
      if (typeof window === 'undefined') return undefined
      const onThemeChange = (event) => {
        if (event?.detail && EFFORT_THEMES.includes(event.detail)) {
          setSavedTheme(event.detail)
        }
      }
      const onStorage = (event) => {
        if (event?.key === EFFORT_THEME_KEY) {
          setSavedTheme(readSavedEffortTheme())
        }
      }
      window.addEventListener('dsh-effort-theme-change', onThemeChange)
      window.addEventListener('storage', onStorage)
      return () => {
        window.removeEventListener('dsh-effort-theme-change', onThemeChange)
        window.removeEventListener('storage', onStorage)
      }
    }, [])

    /** Reduced motion changes how strong the effect is, never whether it works. */
    let reducedMotion = false
    try {
      reducedMotion = typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches === true
    } catch {
      reducedMotion = false
    }

    const access = React.useMemo(
      () => (sessionId === null || !ctx
        ? null
        : createEffortDirectoryAccess(ctx, sessionId, {
          set: (fn, delay) => setTimeout(fn, delay),
          clear: (handle) => clearTimeout(handle),
        })),
      [ctx, sessionId],
    )

    React.useEffect(() => () => {
      if (access !== null) access.dispose()
    }, [access])

    const subscribe = React.useCallback(
      (listener) => (access === null ? () => {} : access.subscribe(listener)),
      [access],
    )
    const getSnapshot = React.useCallback(
      () => (access === null ? EMPTY_MODEL_SNAPSHOT : access.getSnapshot()),
      [access],
    )
    const state = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

    const levels = effortLevelsOf(state)
    const effectiveId = effectiveEffortId(state)
    const committedIndex = indexOfLevel(levels, effectiveId)
    const levelCount = levels.length

    const [draft, setDraft] = React.useState(null)
    const [optimistic, setOptimistic] = React.useState(null)
    const [errorText, setError] = React.useState(null)
    const [busy, setBusy] = React.useState(false)
    const [host, setHost] = React.useState(null)

    const anchorRef = React.useRef(null)
    const trackRef = React.useRef(null)
    const optimisticIdRef = React.useRef(null)
    /**
     * The drag's latest position lives in a ref as well as in state: React batches the
     * `setState`s of one tick, so a release that read the position from state could write
     * the level it was on one frame ago.
     */
    const draftRef = React.useRef(null)
    const commitRef = React.useRef({ timer: null, inFlight: false, queued: null })
    const draggingRef = React.useRef(false)
    /**
     * A drag paints on the display's own clock: one frame per frame, and never two in one.
     *
     * Pointer events arrive in bursts — a high-polling mouse, a tablet, a browser that hands over
     * a frame's worth at once — and painting each one would do the same work twice for one
     * picture. What a drag must never do is paint *slower* than the display: a knob that steps at
     * 60Hz on a 165Hz panel stops feeling like it is under the finger. So the newest position is
     * kept in a ref and painted by the next frame callback, which is at most a frame behind the
     * pointer and exactly one paint per frame.
     */
    const pendingMoveRef = React.useRef(null)
    const moveFrameRef = React.useRef(null)
    const dragRectRef = React.useRef(null)
    /**
     * The ambience behind the knob, and how many frames have been painted since it last followed.
     *
     * `null` means "nothing to say": the render then reads the position in force, which is what the
     * control shows whenever the pointer is not on it. A drag fills it in every
     * `AMBIENCE_FRAME_EVERY`th frame, and on any frame that changes the level.
     */
    const [ambience, setAmbience] = React.useState(null)
    const ambienceRef = React.useRef({ pct: null, index: -1 })
    const paintedFramesRef = React.useRef(0)
    /** The last style this component wrote onto the shell's row and its value: seen, not rewritten. */
    const ringRef = React.useRef({ host: null, value: '' })
    const tintRef = React.useRef({ host: null, value: '' })
    const levelCountRef = React.useRef(0)
    const seatNamesRef = React.useRef([])
    const bridgeRef = React.useRef(null)
    levelCountRef.current = levelCount

    /* The bridge: find the shell's row and hang the container in it. */
    React.useEffect(() => {
      if (sessionId === null || !ctx) return undefined
      const bridge = createEffortBridge({
        doc: typeof document === 'undefined' ? null : document,
        win: typeof window === 'undefined' ? null : window,
        anchor: () => anchorRef.current,
        active: () => levelCountRef.current > 0,
        onChange: (next) => setHost(next),
        seatLabels: () => seatNamesRef.current,
      })
      if (bridge === null) return undefined
      bridgeRef.current = bridge
      bridge.start()
      return () => {
        bridgeRef.current = null
        bridge.dispose()
      }
    }, [ctx, sessionId])

    /**
     * The levels arrive *after* the menu does (the directory has to load first), and that
     * changes no DOM, so no mutation will be seen. Re-scanning when the count changes is
     * what keeps a late directory from leaving the slider off the row for good.
     */
    React.useEffect(() => {
      bridgeRef.current?.scan()
    }, [levelCount])

    const optimisticId = typeof optimistic?.id === 'string' ? optimistic.id : null
    const optimisticIndex = optimisticId === null ? -1 : indexOfLevel(levels, optimisticId)

    // The level in force — the optimistic one first — is what the collapsed seat shows.
    let effectiveIndex = committedIndex >= 0 ? committedIndex : 0
    if (optimisticIndex >= 0) effectiveIndex = optimisticIndex
    const effectivePct = pctFromIndex(effectiveIndex, levelCount)
    const effectiveLevel = levels[effectiveIndex] || null
    // A level change may not have reached the seat's text yet, so every name is offered.
    seatNamesRef.current = levels.map((level) => level.name).filter((name) => typeof name === 'string' && name.length > 0)

    // What the control shows: the draft while dragging, the level in force otherwise.
    const shownIndex = draft !== null ? draft.index : effectiveIndex
    const shownPct = draft !== null && typeof draft.pct === 'number' ? draft.pct : effectivePct
    const shownLevel = levels[shownIndex] || null

    // Three quantities, all driven by the position: the fill's colour, the energy, the speed.
    // Two readings of the same strip, at two different cadences.
    //
    // What the pointer is on is painted on every frame: the knob's position, the fill's edge, and
    // the fill's own colour, which is what makes the control read as being dragged rather than
    // followed. So is the starfield's timing, which has to stay continuous. Everything that is a
    // *value* rather than a motion — the energy that drives the glow and the nebula, the field's
    // density and layer opacity — is read as ambience and follows on `AMBIENCE_FRAME_EVERY` frames,
    // because the stylesheet already eases those over 0.2s and the raster work behind them (a blur
    // radius, the shell row's own repaint) is what the frame the pointer needs is short of.
    const ambiencePct = ambience !== null && typeof ambience.pct === 'number' ? ambience.pct : shownPct
    const energy = energyFor(ambiencePct)
    const energyOn = energy > 0
    const fillBackground = fillBackgroundFor(shownPct, activeTheme)
    const knobOffset = knobOffsetOf(shownPct)

    // The row takes a violet/cyan edge whose strength follows the energy.
    //
    // Both of these write a style the shell does not know about, straight onto its elements,
    // and both are driven by the pointer's position — so they run once per painted drag frame.
    // The strings are quantised on the way out, which means most frames arrive at the value the
    // last one already wrote: writing the same declaration again is a repaint the compositor
    // has to do for nothing, so the last one is remembered instead.
    React.useEffect(() => {
      if (!host?.row?.style) return
      const glowColor = activeTheme === 'deepseek' ? '56,189,248' : '168,85,247'
      const next = energyOn ? `inset 0 0 0 1px rgba(${glowColor},${(0.16 + 0.34 * energy).toFixed(2)})` : ''
      if (ringRef.current.host === host && ringRef.current.value === next) return
      ringRef.current = { host, value: next }
      host.row.style.boxShadow = next
    }, [host, energyOn, energy, activeTheme])

    // The row's value text follows as well — its colour only, never its text.
    React.useEffect(() => {
      if (!host?.value?.style) return
      const next = valueColorFor(shownPct, shownLevel, activeTheme)
      if (tintRef.current.host === host && tintRef.current.value === next) return
      tintRef.current = { host, value: next }
      host.value.style.color = next
    }, [host, shownPct, shownLevel, activeTheme])

    // The collapsed seat follows the level in force, not the draft. The bridge owns the
    // colour, so a re-render that replaces the span still gets it immediately.
    React.useEffect(() => {
      bridgeRef.current?.setSeatColor(valueColorFor(effectivePct, effectiveLevel, activeTheme))
    }, [levelCount, effectivePct, effectiveLevel, activeTheme])

    /*
     * The quota notice.
     *
     * The top level is the one position that costs noticeably more, so the row's value cell
     * says so — in the level's own colour — for a second, and then flips to the level's own
     * name. Only a level the user actually adjusted to raises it: a menu opened while the
     * level already sits at the top says nothing, because nothing was adjusted, and closing
     * the menu forgets that too.
     */
    const rowPresent = host?.row != null
    const atTop = rowPresent && levelCount > 0 && shownIndex === levelCount - 1
    const [notice, setNotice] = React.useState(null)
    const leftTopRef = React.useRef(false)
    React.useEffect(() => {
      if (!rowPresent || levelCount === 0) {
        leftTopRef.current = false
        setNotice(null)
        return undefined
      }
      if (!atTop) {
        leftTopRef.current = true
        setNotice(null)
        return undefined
      }
      if (!leftTopRef.current) return undefined
      setNotice({ flipped: false })
      const handle = setTimeout(() => setNotice({ flipped: true }), QUOTA_NOTICE_MS)
      return () => clearTimeout(handle)
    }, [atTop, levelCount, rowPresent])

    React.useEffect(() => {
      const top = levelCount > 0 ? levels[levelCount - 1] : null
      bridgeRef.current?.notice(notice === null || top === null || !rowPresent
        ? null
        : {
          front: t('effortQuotaNotice'),
          back: top.name,
          color: valueColorFor(1, top, activeTheme),
          flipped: notice.flipped === true,
        })
    }, [notice, rowPresent, levelCount, activeTheme])

    // The host caught up with the optimistic value: drop it and follow the directory again.
    React.useEffect(() => {
      if (optimisticId !== null && effectiveId === optimisticId) setOptimistic(null)
    }, [effectiveId, optimisticId])

    // A host that never answers rolls the display back and says so, rather than pretending.
    React.useEffect(() => {
      if (optimisticId === null) return undefined
      const handle = setTimeout(() => {
        if (optimisticIdRef.current === optimisticId) {
          optimisticIdRef.current = null
          setOptimistic(null)
          setError(t('effortErrorTimeout'))
        }
      }, COMMIT_DEADLINE_MS)
      return () => clearTimeout(handle)
    }, [optimisticId])

    // Unmounting clears the throttle timer and the frame a drag was waiting on, either of which
    // would otherwise write after the fact.
    React.useEffect(() => () => {
      const pending = commitRef.current
      if (pending.timer !== null) {
        clearTimeout(pending.timer)
        pending.timer = null
      }
      pending.queued = null
      dropPendingMove()
      draggingRef.current = false
    }, [])

    function currentState() {
      return access === null ? EMPTY_MODEL_SNAPSHOT : access.getSnapshot()
    }

    function flush() {
      const pending = commitRef.current
      if (pending.timer !== null) {
        clearTimeout(pending.timer)
        pending.timer = null
      }
      const levelId = pending.queued
      pending.queued = null
      if (levelId === null || levelId === undefined || access === null) return

      const snapshot = currentState()
      const current = snapshot?.current
      if (typeof current?.provider !== 'string' || typeof current?.model !== 'string') {
        setError(t('effortErrorNoCatalog'))
        return
      }
      // The host may have written this level already: the second gate of the de-duplication.
      if (effectiveEffortId(snapshot) === levelId) return

      const directory = access.directory()
      if (directory === null || typeof directory.select !== 'function') {
        setError(t('effortErrorNoDirectory'))
        return
      }

      pending.inFlight = true
      optimisticIdRef.current = levelId
      setOptimistic({ id: levelId })
      setError(null)
      setBusy(true)

      let result
      try {
        result = directory.select({ provider: current.provider, model: current.model, reasoningEffort: levelId })
      } catch (error) {
        result = Promise.reject(error)
      }

      Promise.resolve(result).then(
        (outcome) => {
          pending.inFlight = false
          if (outcome && outcome.ok === false) {
            optimisticIdRef.current = null
            setOptimistic(null)
            setError(effortErrorText(outcome.error, t))
          }
        },
        (error) => {
          pending.inFlight = false
          optimisticIdRef.current = null
          setOptimistic(null)
          setError(effortErrorText(error, t))
        },
      ).then(() => {
        setBusy(false)
        // Work that arrived while this was in flight goes out now.
        if (pending.queued !== null) flush()
      })
    }

    /** Ask for a level: same-level de-duplication, in-flight merging, and a throttle. */
    function requestCommit(levelId, immediate) {
      if (levelId === null || levelId === undefined) return
      const pending = commitRef.current
      const snapshot = currentState()
      if (effectiveEffortId(snapshot) === levelId && pending.queued === null && !pending.inFlight) return
      pending.queued = levelId
      if (pending.inFlight) return
      if (immediate === true) {
        flush()
        return
      }
      if (pending.timer !== null) return
      pending.timer = setTimeout(() => {
        pending.timer = null
        flush()
      }, COMMIT_THROTTLE_MS)
    }

    /**
     * Where a pointer sits on the track, mapped through the same inset geometry the visuals use.
     *
     * During a drag the geometry is read once, on the way in: the popover does not move while a
     * finger is on it, and re-measuring per frame would force a layout per frame.
     */
    function pctAt(clientX) {
      const track = trackRef.current
      const rect = dragRectRef.current
        ?? (track && typeof track.getBoundingClientRect === 'function' ? track.getBoundingClientRect() : null)
      if (!rect) return null
      const usable = rect.width - KNOB_RADIUS * 2
      if (!(usable > 0)) return null
      return clamp01((clientX - rect.left - KNOB_RADIUS) / usable)
    }

    /** The control lives inside the shell's own button; its events must not reach that row. */
    function swallow(event) {
      if (event && typeof event.stopPropagation === 'function') event.stopPropagation()
    }

    /** Paint one drag position: the knob, the fill, the energy, and the commit it implies. */
    function paintMove(clientX, immediate) {
      const pct = pctAt(clientX)
      if (pct === null) return
      const index = indexFromPct(pct, levelCount)
      const next = { pct, index }
      draftRef.current = next
      setDraft(next)
      // The ambience behind the knob — the glow, the nebula, the starfield's speed and density —
      // follows on its own cadence rather than on the pointer's; see `AMBIENCE_FRAME_EVERY`. A level
      // change updates it at once, so the field never lags the level the knob is standing in.
      const last = ambienceRef.current
      const due = last.pct === null
        || last.index !== index
        || paintedFramesRef.current % AMBIENCE_FRAME_EVERY === 0
      paintedFramesRef.current += 1
      if (due) {
        ambienceRef.current = { pct, index }
        setAmbience({ pct })
      }
      requestCommit(levels[index].id, immediate === true)
    }

    /**
     * The host's frame clock, or null where there is none.
     *
     * `requestAnimationFrame` is the display's own cadence — a callback per frame, no more and no
     * less — which is exactly the rate a knob under a finger wants to be painted at, on a 60Hz
     * screen as much as on a 165Hz one. A host without it (a test double, an old shell) paints
     * the move where it stands instead of deferring it.
     */
    function frameClock() {
      const host = typeof window === 'undefined' ? null : window
      if (host === null || typeof host.requestAnimationFrame !== 'function') return null
      return {
        request: (callback) => host.requestAnimationFrame(callback),
        cancel: typeof host.cancelAnimationFrame === 'function' ? (handle) => host.cancelAnimationFrame(handle) : null,
      }
    }

    /**
     * Take a drag position: keep the newest one, and let the next frame paint it.
     *
     * Nothing is dropped, so the knob is never painted where the pointer no longer is; nothing is
     * painted twice for one frame either, so a burst of events costs one frame of work.
     */
    function queueMove(clientX) {
      pendingMoveRef.current = clientX
      if (moveFrameRef.current !== null) return
      const frame = frameClock()
      if (frame === null) {
        flushMove()
        return
      }
      // The token is claimed before the host is asked, and the callback only clears the token it
      // owns: a clock that calls back synchronously (a test double) would otherwise leave a dead
      // token behind and stall every move after the first.
      const token = { handle: null }
      moveFrameRef.current = token
      token.handle = frame.request(() => {
        if (moveFrameRef.current !== token) return
        moveFrameRef.current = null
        flushMove()
      })
    }

    /** Paint the position the last move asked for. */
    function flushMove() {
      const pending = pendingMoveRef.current
      if (pending === null) return
      pendingMoveRef.current = null
      paintMove(pending, false)
    }

    /** Let go of the frame being waited on, keeping the position it was going to paint. */
    function cancelMoveFrame() {
      const token = moveFrameRef.current
      if (token === null) return
      moveFrameRef.current = null
      const frame = frameClock()
      if (frame !== null && frame.cancel !== null && token.handle !== null && token.handle !== undefined) {
        frame.cancel(token.handle)
      }
    }

    /** Forget a move that was queued and never painted: a new drag starts from its own point. */
    function dropPendingMove() {
      cancelMoveFrame()
      pendingMoveRef.current = null
    }

    /** The drag is over: its last position is the one that counts, and it is painted now. */
    function settleDrag() {
      cancelMoveFrame()
      flushMove()
      dragRectRef.current = null
    }

    function endDrag() {
      if (!draggingRef.current) return
      draggingRef.current = false
      settleDrag()
      const latest = draftRef.current
      if (latest !== null && levelCount > 0) requestCommit(levels[latest.index].id, true)
      draftRef.current = null
      setDraft(null)
      // The ambience goes back to reading the level in force, so the glow and the field settle on
      // the level the release chose rather than on the last frame the pointer painted.
      ambienceRef.current = { pct: null, index: -1 }
      paintedFramesRef.current = 0
      setAmbience(null)
    }

    function onTrackPointerDown(event) {
      if (locked || levelCount === 0) return
      swallow(event)
      draggingRef.current = true
      dropPendingMove()
      const track = trackRef.current
      if (track && typeof track.getBoundingClientRect === 'function') {
        try {
          dragRectRef.current = track.getBoundingClientRect()
        } catch {
          dragRectRef.current = null
        }
      }
      try {
        if (event.currentTarget?.setPointerCapture && event.pointerId !== undefined) {
          event.currentTarget.setPointerCapture(event.pointerId)
        }
      } catch {
        // Failing to capture does not stop the drag.
      }
      paintMove(event.clientX, false)
    }

    function onTrackPointerMove(event) {
      if (!draggingRef.current) return
      swallow(event)
      queueMove(event.clientX)
    }

    function onKeyDown(event) {
      if (locked || levelCount === 0) return
      const index = draftRef.current !== null ? draftRef.current.index : shownIndex
      let next = null
      if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = Math.max(0, index - 1)
      else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = Math.min(levelCount - 1, index + 1)
      else if (event.key === 'Home') next = 0
      else if (event.key === 'End') next = levelCount - 1
      // Escape, Enter and Tab are the shell's own to handle.
      else return
      swallow(event)
      if (typeof event.preventDefault === 'function') event.preventDefault()
      setDraft(null)
      // A keyboard move lands on a level's own position: the ambience follows it exactly, so the
      // glow and the field never show the level the pointer left behind.
      ambienceRef.current = { pct: null, index: -1 }
      paintedFramesRef.current = 0
      setAmbience(null)
      requestCommit(levels[next].id, true)
    }

    let trackTitle = shownLevel === null ? t('effortLabel') : t('effortTitle', { name: shownLevel.name })
    if (reducedMotion) trackTitle += t('effortReducedMotion')

    const tickNodes = []
    for (let index = 0; index < levelCount; index += 1) {
      tickNodes.push(h('span', {
        key: `tick-${levels[index].id}`,
        className: 'ces-tick',
        'data-ces-part': 'tick',
        'data-on': index <= shownIndex ? '1' : '0',
        style: { left: knobOffsetOf(pctFromIndex(index, levelCount)) },
      }))
    }

    // The starfield. Every level that shows particles uses this one animation: a full-width
    // crossing, no disappearance, and brightness that is also size.
    //
    // All of them are built, always, and a star the position does not show is left in the tree with
    // `display: none` rather than taken out of it. The field thickens by one star at a time as the
    // knob travels, and adding and removing nodes for that would re-run the shell's own mutation
    // watcher — which re-hangs this whole control — several times inside a single drag. Twenty-two
    // hidden elements look exactly like none.
    //
    // The timing stays on every painted frame, unlike the rest of the ambience. A duration is not a
    // value the eye reads, but changing one mid-flight re-maps the animation's progress: a star at
    // half its crossing would jump by however much the duration moved, and at three frames a step
    // that hop is around ten pixels at a brisk drag. The field would read as stuttering even while
    // the glow behind it was eased. So the speed is recomputed per frame and the moving picture
    // stays continuous; only the *count* — a star that appears or goes — follows the ambience.
    const positionSpeed = speedFor(shownPct)
    const starCount = starCountFor(ambiencePct)
    const starLayerOpacity = starLayerOpacityFor(ambiencePct)
    const particleNodes = React.useMemo(() => {
      const nodes = []
      for (let index = 0; index < EFFORT_STARS.length; index += 1) {
        const brightness = starBrightnessFor(index)
        // Reduced motion is applied here, where the duration is computed: the duration is an
        // inline style, so a media query could not reach it.
        const duration = starDurationFor(index, positionSpeed) * (reducedMotion ? REDUCED_MOTION_SLOWDOWN : 1)
        nodes.push(h(
          'span',
          {
            key: `star-${index}`,
            className: 'ces-star',
            'data-ces-part': 'star',
            'data-shown': index < starCount ? '1' : '0',
            style: {
              top: `${EFFORT_STARS[index].y}%`,
              display: index < starCount ? undefined : 'none',
              // Duration and negative delay must be inline: as custom properties the delay is
              // not honoured in the real host, which left every star bunched at the start.
              animationDuration: `${duration.toFixed(3)}s`,
              animationDelay: `${starDelayFor(index, duration).toFixed(3)}s`,
            },
          },
          h('span', {
            className: 'ces-star__dot',
            'data-ces-part': 'particle',
            'data-brightness': brightness.toFixed(3),
            style: { '--ces-b': brightness.toFixed(3) },
          }),
        ))
      }
      return nodes
    }, [starCount, positionSpeed, reducedMotion])

    const whaleNode = React.useMemo(() => {
      if (activeTheme !== 'deepseek') return null
      return h(
        'div',
        {
          className: 'ces-whale-track',
          'data-ces-part': 'whale-track',
          style: { width: knobOffset },
        },
        h(
          'div',
          {
            className: 'ces-whale',
            'data-ces-part': 'whale',
          },
          h(
            'svg',
            {
              className: 'ces-whale__svg',
              viewBox: '0 0 32 16',
              width: '28',
              height: '14',
              xmlns: 'http://www.w3.org/2000/svg',
            },
            h('path', {
              d: 'M 3,8 C 1.5,8.8 0.5,10.2 0.5,11.5 C 0.5,13.2 2,14 4.5,14 C 8.5,14 12,13.2 15,11.8 C 19,10 23,9.6 26,10.2 L 29,12.8 C 29.8,13.4 30.6,12.8 30.3,12 L 29,9.2 L 30.3,6.5 C 30.6,5.7 29.8,5.1 29,5.7 L 26,8.2 C 22.8,7.6 19,6 14.5,4.8 C 10,3.5 5.5,5.8 3,8 Z',
              fill: 'currentColor',
            }),
            h('path', {
              d: 'M 10.5,11.2 C 12,13 13.5,14.2 15.2,14.2 C 16,14.2 16.2,13.5 15.6,12.8 C 14.8,11.8 13.6,11.2 12.5,11 Z',
              fill: 'currentColor',
              opacity: '0.8',
            }),
            h('circle', {
              cx: '4.2',
              cy: '9.5',
              r: '0.7',
              fill: '#ffffff',
            }),
            h('circle', {
              cx: '8',
              cy: '3.6',
              r: '0.6',
              fill: '#ffffff',
              opacity: '0.8',
            }),
          ),
        ),
      )
    }, [activeTheme, knobOffset])

    let ui = null
    if (host?.container && levelCount > 0) {
      ui = ReactDOM.createPortal(
        h(
          'div',
          {
            className: 'ces-inline',
            'data-ces-part': 'root',
            'data-theme': activeTheme,
            'data-energy': energyOn ? '1' : '0',
            'data-motion': reducedMotion ? 'reduced' : 'full',
            'data-busy': busy ? '1' : '0',
            style: { '--ces-energy': String(energy) },
          },
          h(
            'div',
            {
              ref: trackRef,
              className: 'ces-track',
              'data-ces-part': 'track',
              role: 'slider',
              tabIndex: locked ? -1 : 0,
              'aria-label': t('effortLabel'),
              'aria-valuemin': 0,
              'aria-valuemax': Math.max(0, levelCount - 1),
              'aria-valuenow': shownIndex,
              'aria-valuetext': shownLevel !== null ? shownLevel.name : '',
              'aria-disabled': locked ? 'true' : undefined,
              title: trackTitle,
              onPointerDown: onTrackPointerDown,
              onPointerMove: onTrackPointerMove,
              onPointerUp: endDrag,
              onPointerCancel: endDrag,
              onKeyDown,
              onClick: swallow,
            },
            h('div', {
              className: 'ces-fill',
              'data-ces-part': 'fill',
              // The fill ends at the knob's centre, and runs from blue to the position's colour.
              style: { width: knobOffset, background: fillBackground },
            }),
            // The nebula and its sweep: the opacity *is* the energy, which is the fade-in.
            h(
              'div',
              { className: 'ces-energy', 'data-ces-part': 'energy', style: { width: knobOffset } },
              h('div', { className: 'ces-energy__sweep', 'data-ces-part': 'sweep' }),
            ),
            whaleNode,
            // The stars, on a layer of their own so the nebula's half-opacity cannot dim them.
            h(
              'div',
              {
                className: 'ces-stars',
                'data-ces-part': 'stars',
                style: { width: knobOffset, opacity: starLayerOpacity.toFixed(3) },
              },
              particleNodes,
            ),
            tickNodes,
            h('div', { className: 'ces-knob', 'data-ces-part': 'knob', style: { left: knobOffset } }),
          ),
          errorText !== null
            ? h('div', { className: 'ces-error', 'data-ces-part': 'error', role: 'status' }, errorText)
            : null,
        ),
        host.container,
      )
    }

    // The anchor: invisible, occupying nothing, and the two things this control needs from
    // the composer — the session id the slot hands it, and a way back to its own composer.
    return h('span', {
      ref: anchorRef,
      hidden: true,
      'data-ces-part': 'anchor',
      'aria-hidden': 'true',
    }, ui)
  }

  module.exports = { EffortSlider }
    }

    /** effort/styles.cjs */
    bodies["./effort/styles.cjs"          ] = function (module, exports, require) {
  /**
   * effort/styles.cjs — the slider's stylesheet.
   */
  const { KNOB_RADIUS, KNOB_SIZE, TRACK_HEIGHT } = require('./constants.cjs')

  /*
   * The slider's stylesheet.
   *
   * Colour comes from the shell's own design tokens, so both palettes follow for free:
   * the track's bed is the border token, and the blue is the shell's business accent with
   * the reference's `#4d93f8` behind it.
   *
   * Four layers ride the same geometry (the fill's width, the knob's left and every tick
   * all resolve to the knob's centre, so a level's mark and its fill end together):
   *
   *   .ces-fill    the completed part, "blue on the left → the colour of where you are"
   *   .ces-energy  the purple nebula and its sweep, opacity = the position's energy
   *   .ces-stars   the starfield, a layer of its own so the nebula's half-opacity at the
   *                high level cannot dim it out of sight
   *   .ces-knob    the thumb, as wide as the track is tall
   *
   * Energy covers only the completed part, so the track to the right of the knob keeps its
   * plain bed. Every star is one full-width strip crossing right to left with only the two
   * ends — both outside the visible window — fading, which is why the particles read as
   * never disappearing.
   */

      const EFFORT_CSS = `
.ces-inline { --ces-accent: var(--dsw-alias-state-business-primary, var(--dsw-static-blue-450, #4d93f8)); box-sizing: border-box; flex-basis: 100%; width: 100%; min-width: 0; }
.ces-track { position: relative; box-sizing: border-box; height: ${TRACK_HEIGHT}px; margin-top: 2px; border-radius: 999px; background: var(--dsw-alias-border-l1, rgba(15, 17, 21, .08)); cursor: pointer; touch-action: none; user-select: none; -webkit-user-select: none; }
.ces-track:focus-visible { outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--ces-accent)); outline-offset: 2px; }
.ces-fill { position: absolute; top: 0; bottom: 0; left: 0; border-radius: 999px; pointer-events: none; }
.ces-tick { position: absolute; top: 50%; width: 3px; height: 3px; margin: -1.5px 0 0 -1.5px; border-radius: 50%; background: color-mix(in srgb, var(--dsw-alias-label-primary, #0f1115) 26%, transparent); pointer-events: none; }
.ces-tick[data-on='1'] { background: rgba(255, 255, 255, .5); }
/* The knob is the track's height across, so it fills the tube's mouth and never shows a cut edge. */
.ces-knob { position: absolute; top: 50%; width: ${KNOB_SIZE}px; height: ${KNOB_SIZE}px; margin: ${-KNOB_RADIUS}px 0 0 ${-KNOB_RADIUS}px; border-radius: 50%; background: #fff; box-shadow: 0 1px 5px rgba(0, 0, 0, .34), 0 0 0 .5px rgba(0, 0, 0, .06); pointer-events: none; }
.ces-error { margin-top: 6px; font-size: 11px; line-height: 16px; color: var(--dsw-alias-state-error-primary, #e5484d); }
/* Reaching the top level replaces the row's value text with the quota notice for a second, then
   flips it to the level's own name. It is an overlay this plugin draws and never a rewrite: the
   phrase is laid over the value cell, the shell's own text is hushed rather than changed, and the
   moment the flip ends the two are indistinguishable, which is why the notice can simply be
   dropped again. Nothing is painted behind it — a copied backdrop is one more colour to get
   wrong — so the notice is text on whatever the row already has.

   Both faces end at the cell's right edge, which is where the shell draws the value: the cell is
   wider than the word it holds, so centring would strand a short name like "Max" in the middle of
   the row. The wider phrase simply spills to the left of the same edge. */
.ces-notice { position: absolute; display: flex; align-items: center; justify-content: flex-end; white-space: nowrap; pointer-events: none; perspective: 260px; }
.ces-notice__inner { position: absolute; inset: 0; transform-style: preserve-3d; transition: transform .42s cubic-bezier(.2, .7, .3, 1); }
.ces-notice[data-flipped='1'] .ces-notice__inner { transform: rotateX(180deg); }
/* Both faces fill the same box, so the flip turns one line over in place instead of swapping two. */
.ces-notice__face { position: absolute; inset: 0; display: flex; align-items: center; justify-content: flex-end; backface-visibility: hidden; -webkit-backface-visibility: hidden; }
.ces-notice__face--back { transform: rotateX(180deg); }
/* The shell's own value text while the notice covers it: invisible, still exactly as it was. */
.ces-cell-hushed { color: transparent !important; }
/* The lit state: one variable drives it. Only the track's glow and the energy layer's opacity
   interpolate it, so "powering up" is a composited colour transition rather than a per-frame
   script. With no energy the particles are paused instead of animating invisibly. */
.ces-inline[data-energy='1'] .ces-track { box-shadow: 0 0 calc(var(--ces-energy, 0) * 16px) rgba(168, 85, 247, .5); }
.ces-inline[data-energy='0'] .ces-star, .ces-inline[data-energy='0'] .ces-energy__sweep { animation-play-state: paused; }
.ces-energy { position: absolute; top: 0; bottom: 0; left: 0; border-radius: 999px; overflow: hidden; pointer-events: none; opacity: var(--ces-energy, 0); transition: opacity .2s ease; background: linear-gradient(90deg, #3b1178 0%, #6d28d9 30%, #9333ea 62%, #c084fc 100%); }
/* The stars ride their own layer, and their opacity has a floor: at the high level the nebula
   above is only half opaque, and nesting them inside it would halve every star again. Density
   is what expresses "more energy", not the layer's fade. */
.ces-stars { position: absolute; top: 0; bottom: 0; left: 0; border-radius: 999px; overflow: hidden; pointer-events: none; transition: opacity .2s ease; }
/* Durations and phases are written inline on the elements by the component and deliberately do
   not travel through custom properties: a var() in an animation's timing is not honoured for
   a negative delay in the real host, which left every star bunched at the start.
   --ces-b is not part of the timing, only of the dot's size and brightness. */
.ces-star { position: absolute; left: 0; right: 0; height: 3px; margin-top: -1.5px; pointer-events: none; animation-name: ces-star-sweep; animation-timing-function: linear; animation-iteration-count: infinite; }
.ces-star__dot { position: absolute; left: 100%; top: 0; width: 3px; height: 3px; margin-left: -1.5px; border-radius: 50%; background: #fff; box-shadow: 0 0 4px rgba(255, 255, 255, .85); opacity: var(--ces-b, 1); transform: scale(var(--ces-b, 1)); }
@keyframes ces-star-sweep { 0% { transform: translate3d(0, 0, 0); opacity: 0; } 6% { opacity: 1; } 94% { opacity: 1; } 100% { transform: translate3d(-100%, 0, 0); opacity: 0; } }
.ces-energy__sweep { position: absolute; inset: 0; background: linear-gradient(100deg, transparent 18%, rgba(255, 255, 255, .30) 50%, transparent 82%); transform: translateX(100%); animation: ces-sweep 2.4s linear infinite; }
@keyframes ces-sweep { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
body[data-ds-dark-theme] .ces-star__dot { background: #f5f3ff; box-shadow: 0 0 5px rgba(216, 180, 254, .95); }
/* DeepSeek deep sea whale theme: ocean bioluminescence, drifting bubbles, and cruising whale */
.ces-inline[data-theme='deepseek'][data-energy='1'] .ces-track { box-shadow: 0 0 calc(var(--ces-energy, 0) * 16px) rgba(56, 189, 248, .6); }
.ces-inline[data-energy='0'] .ces-whale { animation-play-state: paused; }
.ces-inline[data-theme='deepseek'] .ces-energy { background: linear-gradient(90deg, #082f49 0%, #0369a1 30%, #0284c7 62%, #38bdf8 100%); }
.ces-inline[data-theme='deepseek'] .ces-energy__sweep { background: linear-gradient(100deg, transparent 15%, rgba(56, 189, 248, .25) 35%, rgba(255, 255, 255, .45) 50%, rgba(56, 189, 248, .25) 65%, transparent 85%); animation: ces-ocean-sweep 2.6s linear infinite; }
@keyframes ces-ocean-sweep { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
.ces-inline[data-theme='deepseek'] .ces-star { animation-name: ces-bubble-sweep; }
.ces-inline[data-theme='deepseek'] .ces-star__dot { width: 4px; height: 4px; margin-left: -2px; border-radius: 50%; background: radial-gradient(circle at 30% 30%, #ffffff 10%, rgba(125, 211, 252, .9) 45%, rgba(14, 165, 233, .35) 85%, transparent 100%); border: 0.5px solid rgba(224, 242, 254, .85); box-shadow: 0 0 4px rgba(56, 189, 248, .75); }
body[data-ds-dark-theme] .ces-inline[data-theme='deepseek'] .ces-star__dot { background: radial-gradient(circle at 30% 30%, #ffffff 15%, #38bdf8 55%, rgba(2, 132, 199, .4) 90%); box-shadow: 0 0 5px rgba(56, 189, 248, .9); }
@keyframes ces-bubble-sweep { 0% { transform: translate3d(0, 0, 0); opacity: 0; } 6% { opacity: 1; } 30% { transform: translate3d(-30%, -1.5px, 0); } 65% { transform: translate3d(-65%, 1.2px, 0); } 94% { opacity: 1; } 100% { transform: translate3d(-100%, 0, 0); opacity: 0; } }
.ces-whale-track { position: absolute; top: 0; bottom: 0; left: 0; border-radius: 999px; overflow: hidden; pointer-events: none; }
.ces-inline[data-theme='codex'] .ces-whale-track { display: none; }
.ces-whale { position: absolute; top: 50%; left: 0; right: 0; height: 14px; margin-top: -7px; pointer-events: none; opacity: var(--ces-energy, 0); transition: opacity .2s ease; animation-name: ces-whale-swim; animation-duration: 5.5s; animation-timing-function: linear; animation-iteration-count: infinite; }
.ces-whale__svg { position: absolute; left: 100%; top: 0; color: #38bdf8; filter: drop-shadow(0 0 4px rgba(56, 189, 248, .85)); pointer-events: none; }
body[data-ds-dark-theme] .ces-whale__svg { color: #7dd3fc; filter: drop-shadow(0 0 5px rgba(125, 211, 252, .95)); }
@keyframes ces-whale-swim { 0% { transform: translate3d(0, 0, 0); opacity: 0; } 8% { opacity: 1; transform: translate3d(-8%, -1.8px, 0); } 25% { transform: translate3d(-25%, 1.5px, 0); } 50% { transform: translate3d(-50%, -1.8px, 0); } 75% { transform: translate3d(-75%, 1.5px, 0); } 92% { opacity: 1; transform: translate3d(-92%, -1px, 0); } 100% { transform: translate3d(calc(-100% - 32px), 0, 0); opacity: 0; } }
/* A reader who asked for less motion keeps the energy and loses the travel: the sweep is
   dropped and the stars are slowed in the component, not frozen here. */
@media (prefers-reduced-motion: reduce) { .ces-energy { transition: none; } .ces-energy__sweep { display: none; } .ces-notice__inner { transition-duration: 1ms; } .ces-whale { animation: none; } }
.ces-inline[data-motion='reduced'] .ces-whale { animation: none; }
`

  module.exports = { EFFORT_CSS }
    }

    /** i18n/dictionary.cjs */
    bodies["./i18n/dictionary.cjs"        ] = function (module, exports, require) {
  /**
   * i18n/dictionary.cjs — the half's strings, under the namespace the shell's registry is given.
   *
   * Every word the settings page draws, in the shell's two locales. `LOCALE_NS` is
   * the namespace the shell registers them under; the page asks for the same keys.
   */
  const LOCALE_NS = 'dshCustomTheme'

  const DICTIONARY = {
  zh: {
    nav: '主题与背景',
    cardTheme: '主题与色彩',
    cardThemeDesc: '全局配色方案与明暗显示模式',
    cardTypography: '正文排版与字体',
    cardTypographyDesc: '微调会话流中正文字号、行间距以及显示字体',
    cardStreaming: '流式渐显动效',
    cardStreamingDesc: '文字流输出时逐字平滑淡入，减少打字跳动感',
    cardReasoning: '思考内容展开策略',
    cardReasoningDesc: '控制模型思考推理过程的展开与收起时机',
    cardWorking: '运行状态文案与特效',
    cardWorkingDesc: '模型处于思考或工具调用时，状态提示栏的文案与特效',
    cardInjections: '高级与注入提示',
    cardInjectionsDesc: '会话流注入提示与模型推理档位配置',
    cardBackground: '背景图片与壁纸',
    cardBackgroundDesc: '为窗口各独立区域设置壁纸图片、透明度与虚化',
    fontSizeDesc: '对话正文基础文字大小（默认 14px）',
    lineGapDesc: '在默认行高基础上的额外间距增量',
    fontFamilyDesc: '消息正文文本字体族',
    codeFontFamilyDesc: '代码块与行内等宽代码字体族',
    gapTight: '-2px (紧凑)',
    gapNormal: '0px (默认)',
    gapRelaxed: '+2px (舒适)',
    gapLoose: '+4px (宽松)',
    gapLarge: '+6px (大)',
    fadeDurationDesc: '新字从淡入到实心的过渡时长 (150ms ~ 1500ms)',
    fadeInkDesc: '刚落笔时的初始浓度（100% 即关闭渐显）',
    fadePresets: '快捷预设',
    fadePresetDefault: '默认',
    fadePresetFast: '清爽快速',
    fadePresetSoft: '柔和缓显',
    fadePresetOff: '关闭渐显',
    fadePresetDefaultTip: '默认 (520ms / 30%)',
    fadePresetFastTip: '清爽快速 (250ms / 50%)',
    fadePresetSoftTip: '柔和缓显 (800ms / 15%)',
    fadePresetOffTip: '关闭渐显 (即时输出)',
    reasoningModeStreaming: '思考中展开',
    reasoningModeKeep: '保持展开',
    reasoningModeAlways: '始终展开',
    reasoningModeOff: '跟随官方',
    reasoningDetailStreaming: '模型思考时自动展开推理过程；思考完毕后自动折叠推理，聚焦最终回复。',
    reasoningDetailKeep: '模型思考时自动展开；思考完毕后保持展开，方便阅读思考细节。',
    reasoningDetailAlways: '无论新旧消息，所有推理过程始终保持展开状态。',
    reasoningDetailOff: '官方默认行为（默认折叠，需手动点击展开）。',
    workingTextsCount: '已设置 {n} 条轮播文案',
    workingTextsEmpty: '未设置（沿用官方「深度求索中」）',
    bgZoneCurrent: '当前配置区域',
    bgImageSelect: '壁纸图片',
    bgImageDesc: '从已上传图片中选择，或点击右侧上传新图片',
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
    streamFadeHint: '文字流输出时逐字淡入；渐显时长与落笔墨量（100% 即关闭）右侧依次对应',
    streamFadeDuration: '流式渐显时长',
    streamFadeDurationHint: '每个字从落笔淡到实心的时间；越长越舒缓。',
    streamFadeInk: '落笔墨量',
    streamFadeInkHint: '刚落笔文字的浓度；调到 100% 即关闭渐显。',
    reasoningExpandTitle: '思考内容展开',
    reasoningExpandHint: '模型思考时自动展开推理过程；支持思考中展开、始终展开或跟随官方',
    reasoningExpandFollow: '跟随官方（默认折叠）',
    reasoningExpandStreaming: '仅思考中展开（结束后折叠）',
    reasoningExpandKeep: '思考中展开并保持（结束后不折叠）',
    reasoningExpandAlways: '始终展开（含历史消息）',
    workTitle: '工作时文字',
    workHint: '一行一条，运行时轮播替换「深度求索中」；留空则完全沿用官方文案',
    workPlaceholder: '深度求索中',
    workInterval: '轮播间隔',
    workIntervalDesc: '多条提示词之间的切换等待时长',
    workColorsDesc: '自定义文字与流光颜色',
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
    injSettingTitle: '注入提示',
    injHint: 'DSH 现在只在注入同时增删了工具时保留「上下文注入」行，普通注入（技能、规则、目录、引用）都被隐藏；打开后按原来的位置显示这些提示。',
    injShow: '显示',
    injFollow: '跟随官方',
    injTitle: '上下文注入',
    injRecall: '会话引用',
    injEmpty: '（无文本内容）',
    injUnavailable: '当前 DSH 没有暴露会话定义接口，这一项不起作用',
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
    effortLabel: '推理等级',
    effortTitle: '推理等级：{name}',
    effortReducedMotion: '（系统「减少动态效果」已开启：粒子已放缓）',
    effortQuotaNotice: '将使用更多额度',
    effortErrorGeneric: '档位切换失败',
    effortErrorTimeout: '档位切换超时，宿主未回报结果（已回滚显示）',
    effortErrorNoCatalog: '模型目录尚未就绪，无法写入档位',
    effortErrorNoDirectory: '模型目录不可用，档位未写入',
    effortsTitle: '自动补全推理档位',
    effortsHint: '未声明档位的第三方模型自动获得 off / low / high / max',
    effortsLoading: '读取中…',
    effortsOn: '补全中',
    effortsOff: '已关闭',
    effortsOnLabel: '自动',
    effortsOffLabel: '关闭',
    effortsStale: '插件已更新，重启 DSH 后这一项才会生效',
    effortsFailed: '宿主未能读写配置，详见日志',
    effortsNoProfile: '未在 profile 中找到 cordis.patch.yml，无法补全',
    effortsNothing: '所有模型都已自己声明档位，无需补全',
    effortsManaged: '已补全模型数：',
    effortsWaiting: '待补全模型数：',
    effortsRestart: '重启 DSH 后生效',
    effortThemeTitle: '滑条特效风格',
    effortThemeHint: '选择推理滑条的视觉主题：Codex 星空星轨 或 DeepSeek 深海游鲸',
    effortThemeCodex: 'Codex 星空',
    effortThemeDeepSeek: 'DeepSeek 深海',
  },
  en: {
    nav: 'Theme & background',
    cardTheme: 'Theme & Colors',
    cardThemeDesc: 'Overall color palette and dark/light appearance mode',
    cardTypography: 'Typography & Layout',
    cardTypographyDesc: 'Fine-tune font size, line spacing, and fonts in conversation',
    cardStreaming: 'Streaming Text Animation',
    cardStreamingDesc: 'Progressive character fade-in during generation for smoother reading',
    cardReasoning: 'Reasoning Disclosure',
    cardReasoningDesc: 'Manage when thinking and reasoning blocks expand and collapse',
    cardWorking: 'Working Status & Effects',
    cardWorkingDesc: 'Prompt wording and visual shimmer when the model is working',
    cardInjections: 'Advanced & Injections',
    cardInjectionsDesc: 'Context injection notices and reasoning effort level filling',
    cardBackground: 'Background Wallpaper',
    cardBackgroundDesc: 'Custom background images, opacity, and blur per window zone',
    fontSizeDesc: 'Base font size for message content (default 14px)',
    lineGapDesc: 'Additional line spacing on top of default line height',
    fontFamilyDesc: 'Font family for message body text',
    codeFontFamilyDesc: 'Font family for code blocks and monospace text',
    gapTight: '-2px (Tight)',
    gapNormal: '0px (Default)',
    gapRelaxed: '+2px (Relaxed)',
    gapLoose: '+4px (Loose)',
    gapLarge: '+6px (Large)',
    fadeDurationDesc: 'Duration for characters to fade in completely (150ms - 1500ms)',
    fadeInkDesc: 'Initial visibility of freshly written text (100% turns off fade)',
    fadePresets: 'Presets',
    fadePresetDefault: 'Default',
    fadePresetFast: 'Fast',
    fadePresetSoft: 'Soft',
    fadePresetOff: 'Off',
    fadePresetDefaultTip: 'Default (520ms / 30%)',
    fadePresetFastTip: 'Fast (250ms / 50%)',
    fadePresetSoftTip: 'Soft (800ms / 15%)',
    fadePresetOffTip: 'Off (instant)',
    reasoningModeStreaming: 'While Thinking',
    reasoningModeKeep: 'Keep Open',
    reasoningModeAlways: 'Always Open',
    reasoningModeOff: 'Follow Official',
    reasoningDetailStreaming: 'Auto-expands while thinking; collapses once finished to focus on the final answer.',
    reasoningDetailKeep: 'Auto-expands while thinking; stays open once finished for easy review.',
    reasoningDetailAlways: 'All reasoning blocks stay expanded across both new and historical turns.',
    reasoningDetailOff: 'Follows official default behavior (collapsed by default; click to expand).',
    workingTextsCount: '{n} phrases configured',
    workingTextsEmpty: 'Not set (using official "Deep diving...")',
    bgZoneCurrent: 'Selected zone',
    bgImageSelect: 'Wallpaper image',
    bgImageDesc: 'Select an image or upload a new one',
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
    reasoningExpandTitle: 'Reasoning disclosure',
    reasoningExpandHint: 'Auto-expand thinking content while reasoning; support streaming unfold, keep open, or follow official.',
    reasoningExpandFollow: 'Follow official (collapsed)',
    reasoningExpandStreaming: 'During thinking (collapse on finish)',
    reasoningExpandKeep: 'During thinking (keep open on finish)',
    reasoningExpandAlways: 'Always expanded (including history)',
    workTitle: 'Working text',
    workHint: 'One phrase per line, cycled over the official “Deep diving”. Leave it empty to keep the shipped wording.',
    workPlaceholder: 'Deep diving...',
    workInterval: 'Rotation',
    workIntervalDesc: 'Interval before rotating to the next status phrase',
    workColorsDesc: 'Custom text and shimmer sweep colors',
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
    injSettingTitle: 'Injection notices',
    injHint: 'DSH now keeps a context-injection row only when the injection adds or removes tools; ordinary injections (skills, rules, the catalog, recalls) stay hidden. Turn this on to show them again where they belong.',
    injShow: 'Show',
    injFollow: 'Follow DSH',
    injTitle: 'Context injection',
    injRecall: 'Session recall',
    injEmpty: '(no text content)',
    injUnavailable: 'This DSH build exposes no conversation Definition registry, so this switch does nothing',
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
    effortLabel: 'Reasoning effort',
    effortTitle: 'Reasoning effort: {name}',
    effortReducedMotion: ' (reduced motion is on: the particles are slowed)',
    effortQuotaNotice: 'More quota will be used',
    effortErrorGeneric: 'The level could not be changed',
    effortErrorTimeout: 'The level change timed out and the host never reported back (the display was rolled back)',
    effortErrorNoCatalog: 'The model directory is not ready, so no level was written',
    effortErrorNoDirectory: 'The model directory is unavailable, so no level was written',
    effortsTitle: 'Reasoning levels for every model',
    effortsHint: 'A third-party model that declares none gets off / low / high / max',
    effortsLoading: 'Reading…',
    effortsOn: 'Filling in',
    effortsOff: 'Off',
    effortsOnLabel: 'Automatic',
    effortsOffLabel: 'Off',
    effortsStale: 'The plugin was updated — restart DSH for this switch to work',
    effortsFailed: 'The host could not read or write the profile; see the log',
    effortsNoProfile: 'No cordis.patch.yml in this profile, so nothing can be filled in',
    effortsNothing: 'Every model declares its own levels',
    effortsManaged: 'Models given levels:',
    effortsWaiting: 'Models still without levels:',
    effortsRestart: 'restart DSH to activate it',
    effortThemeTitle: 'Slider Effect Theme',
    effortThemeHint: 'Choose the visual theme for the effort slider: Codex Astra nebula or DeepSeek deep sea whale',
    effortThemeCodex: 'Codex Astra',
    effortThemeDeepSeek: 'DeepSeek Deep Sea',
  },
  }

  module.exports = { LOCALE_NS, DICTIONARY }
    }

    /** index.cjs */
    bodies["./index.cjs"                  ] = function (module, exports, require) {
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

      const { ThemeRow } = createSettingsPage({
        UpdateRow,
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
    }

    /** injections/bridge.cjs */
    bodies["./injections/bridge.cjs"      ] = function (module, exports, require) {
  /**
   * injections/bridge.cjs — subscribing the conversation's event log to the registry.
   */
  const { injectionSettingsOf } = require('./state.cjs')
  const { registerInjectionDefinition } = require('./view.cjs')

  /**
   * Keep one registered Definition in step with the setting.
   *
   * Registering and unregistering — rather than registering once and answering "off" from
   * `match` — is what makes the switch take effect on a transcript that is already open:
   * the registry notifies the conversation engine, and the engine rebuilds every binding
   * from the Definitions in force.
   */
  function createInjectionBridge(ctx, conversation) {
    let disposeDefinition = null
    return {
      sync() {
        const injectionSettings = injectionSettingsOf()
        if (injectionSettings.show && disposeDefinition === null) {
          disposeDefinition = registerInjectionDefinition(ctx, conversation)
        } else if (!injectionSettings.show && disposeDefinition !== null) {
          disposeDefinition()
          disposeDefinition = null
        }
      },
      dispose() {
        if (disposeDefinition === null) return
        disposeDefinition()
        disposeDefinition = null
      },
    }
  }

  module.exports = { createInjectionBridge }
    }

    /** injections/constants.cjs */
    bodies["./injections/constants.cjs"   ] = function (module, exports, require) {
  /**
   * injections/constants.cjs — the restored row's kind, seat, caps and stylesheet.
   */
      /*
       * The restored injected-context row's stylesheet.
       *
       * The shell draws these rows as a disclosure — a chevron, the row's role, the producer
       * its durable source names, a one-line summary, and the injected text in a bounded,
       * scrollable block — and this keeps that shape with this plugin's own class names,
       * because the shell's are CSS-module hashes that change between builds. Colours come
       * from the design tokens, so both palettes follow for free, and the measurements are
       * the shell's own (`--dsh-content-font-size-secondary`, the 141px cap) so a restored
       * row sits in the transcript exactly like one the shell would have drawn.
       *
       * Like `EFFORT_CSS`, this is declared before `PAGE_CSS` because the page sheet
       * interpolates it.
       */

      const INJECTION_CSS = `
.dct-inj { min-width: 0; }
.dct-inj-head { display: flex; align-items: center; gap: 4px; width: 100%; min-width: 0; padding: 0; font: inherit; color: var(--dsw-alias-label-tertiary, inherit); background: none; border: 0; cursor: pointer; text-align: left; }
.dct-inj-head:hover { color: var(--dsw-alias-label-secondary, inherit); }
.dct-inj-head:focus-visible { outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, currentColor); outline-offset: 2px; border-radius: 4px; }
.dct-inj-chevron { flex: none; width: 0; height: 0; margin: 0 2px 0 6px; border-left: 4px solid currentColor; border-top: 3.5px solid transparent; border-bottom: 3.5px solid transparent; transition: transform .12s ease; }
.dct-inj[data-open='1'] .dct-inj-chevron { transform: rotate(90deg); }
.dct-inj-title { flex: none; font-size: var(--dsh-content-font-size-secondary, 13px); line-height: calc(24px + var(--dsh-content-font-delta, 0px)); }
.dct-inj-sep { flex: none; width: 2px; height: 2px; margin: 0 4px; border-radius: 1px; background: var(--dsw-alias-label-caption, currentColor); }
.dct-inj-source, .dct-inj-summary { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: var(--dsh-content-font-size-secondary, 13px); line-height: calc(24px + var(--dsh-content-font-delta, 0px)); }
.dct-inj-source { flex: none; max-width: 45%; }
.dct-inj-summary { flex: auto; }
.dct-inj-body { box-sizing: border-box; width: calc(100% - 22px - var(--dsh-content-font-delta, 0px)); max-height: 141px; margin: 4px 0 0 calc(22px + var(--dsh-content-font-delta, 0px)); padding: 10px 16px 12px 12px; overflow: auto; border-radius: var(--dsw-radius-md, 6px); background: var(--dsw-alias-markdown-code-block, rgba(127, 127, 127, .12)); color: var(--dsw-alias-label-tertiary, inherit); font: 400 11px/16px var(--ds-font-family-code, ui-monospace, monospace); white-space: pre-wrap; overflow-wrap: anywhere; }
/* The settings page's own switch for the rows. */
.dct-toggle { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--dsw-alias-label-primary, inherit); }
.dct-note { margin-top: 2px; font-size: 12px; color: var(--dsw-alias-label-caption, inherit); }
`
  /** localStorage key holding the injected-row choice. */
  const INJECTIONS_KEY = 'dsh-custom-theme.injections'
  /** The Chat Node kind this plugin contributes for one restored row. */
  const INJECTION_KIND = 'dct-context-injection'
  /** The keyed slot ui-chat dispatches every rendered Chat node through. */
  const INJECTION_NODE_SLOT = 'conversation.chat.node'
  /** Order of this plugin's renderer among that slot's entries. */
  const INJECTION_ENTRY_ORDER = 20
  /** How much injected text one row carries into the page, in characters. */
  const INJECTION_TEXT_LIMIT = 40000
  /** How much of the text's first line the collapsed row shows. */
  const INJECTION_SUMMARY_LIMIT = 72
  /** The presentation forms the shell renders structurally; the rest stay opaque. */
  const INJECTION_FORMS = ['instructions', 'catalog', 'snapshot', 'notice', 'relay', 'recall']

  module.exports = { INJECTIONS_KEY, INJECTION_KIND, INJECTION_NODE_SLOT, INJECTION_ENTRY_ORDER, INJECTION_TEXT_LIMIT, INJECTION_SUMMARY_LIMIT, INJECTION_FORMS, INJECTION_CSS }
    }

    /** injections/definition.cjs */
    bodies["./injections/definition.cjs"  ] = function (module, exports, require) {
  /**
   * injections/definition.cjs — the Definition the conversation's own registry is given.
   */
  const { INJECTION_KIND, INJECTION_SUMMARY_LIMIT } = require('./constants.cjs')
  const { injectionState } = require('./model.cjs')

  /**
   * The Definition restoring the hidden rows.
   *
   * It matches what the shell's own message Definitions match, minus the messages the
   * shell already draws as themselves: an append-origin `user/message` whose source is
   * not `user` (a steering message is a user source, and a waking one is the shell's own
   * trigger), and a `developer/message`. Replacement surfaces are model-only and are left
   * out, exactly as the shell leaves them out of the human transcript.
   */
  const injectionDefinition = {
    kind: INJECTION_KIND,
    target: 'chat',
    match: (event) => {
      if (event.type === 'developer/message') {
        const id = event.data?.message?.id
        return id === undefined ? null : { id: String(id), role: 'start' }
      }
      if (event.type !== 'user/message') return null
      if (event.surfaceOp !== 'append') return null
      if (event.data?.source?.kind === 'user') return null
      const id = event.data?.id
      return id === undefined ? null : { id: String(id), role: 'start' }
    },
    start: (context, match, reader) => injectionState(match, reader),
    update: (context) => context.state,
    buildViewNode: (context) => {
      const state = context.state
      if (state === undefined) return null
      return {
        key: context.key,
        kind: INJECTION_KIND,
        id: context.id,
        target: 'chat',
        anchorSeq: state.seq,
        location: context.start?.location ?? context.matches[0]?.location ?? { kind: 'unresolved' },
        // A waking message already has the shell's own trigger row; the shell's
        // visibility flag is what keeps this node out of the transcript.
        visibility: state.waking ? 'hidden' : 'visible',
        data: state,
      }
    },
  }

  /** The collapsed row's one-line summary: the text's first non-empty line, clipped. */
  function injectionSummary(text) {
    const line = String(text ?? '')
      .split('\n')
      .map((part) => part.trim())
      .find((part) => part !== '') ?? ''
    const collapsed = line.replace(/\s+/gu, ' ')
    if (collapsed === '') return ''
    return collapsed.length > INJECTION_SUMMARY_LIMIT
      ? `${collapsed.slice(0, INJECTION_SUMMARY_LIMIT - 1).trimEnd()}…`
      : collapsed
  }

  module.exports = { injectionDefinition, injectionSummary }
    }

    /** injections/model.cjs */
    bodies["./injections/model.cjs"       ] = function (module, exports, require) {
  /**
   * injections/model.cjs — reading a logged message as an injected-context row, or as nothing.
   */
  const { INJECTION_FORMS, INJECTION_TEXT_LIMIT } = require('./constants.cjs')

  /** The text a logged message carries, as one block. */
  function injectionText(content) {
    return (Array.isArray(content) ? content : [])
      .filter((block) => block !== null && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text)
      .join('\n\n')
      .slice(0, INJECTION_TEXT_LIMIT)
  }

  /** One field collected from a source's object list, joined, or null when it has none. */
  function injectionNames(source, member, field) {
    const list = source[member]
    if (!Array.isArray(list)) return null
    const seen = []
    for (const entry of list) {
      const value = entry !== null && typeof entry === 'object' && typeof entry[field] === 'string' && entry[field] !== '' ? entry[field] : null
      if (value !== null && !seen.includes(value)) seen.push(value)
    }
    return seen.length > 0 ? seen.join(', ') : null
  }

  /**
   * The role and producer label a durable source names, as the shell classifies them.
   *
   * The producers the shell dresses are read the same way here — a recall cites the
   * sessions it pulled in, an instruction injection the files it changed, a skill its
   * name — and every other source falls back to its own kind, which is the shell's own
   * fallback.
   */
  function injectionProducer(source) {
    const record = source !== null && typeof source === 'object' ? source : null
    const kind = record !== null && typeof record.kind === 'string' && record.kind !== '' ? record.kind : null
    if (kind === null) return { role: 'inject', label: null }
    if (kind === 'session-reference') return { role: 'recall', label: injectionNames(record, 'references', 'label') ?? kind }
    if (kind === 'agent-instructions') return { role: 'inject', label: injectionNames(record, 'changes', 'path') ?? kind }
    if (kind === 'skill-invocation') return { role: 'inject', label: typeof record.name === 'string' && record.name !== '' ? record.name : kind }
    return { role: 'inject', label: kind }
  }

  /** The shell's presentation form for a source, when it is one the shell knows. */
  function injectionForm(source) {
    const form = source !== null && typeof source === 'object' && typeof source.form === 'string' ? source.form : null
    return form !== null && INJECTION_FORMS.includes(form) ? form : null
  }

  /** Whether the shell draws this injected message as its own waking notification. */
  function injectionIsWaking(match, reader) {
    const event = match === undefined || match === null ? undefined : match.event
    if (event === undefined || event.type !== 'user/message') return false
    const id = String(event.data?.id ?? '')
    const nextTurn = reader.previous('inbox-next-turn')?.state
    const nextStep = reader.previous('inbox-next-step')?.state
    const claimed = (state) => state !== undefined && state !== null && typeof state.currentClaimed?.has === 'function' && state.currentClaimed.has(id)
    if (claimed(nextTurn)) return true
    // The shell's idle-steer case: a claimed message that woke a Turn which had already
    // begun, at its first step, with no human message claimed by the same claim.
    const location = match.location
    if (location === undefined || location.kind !== 'step' || location.step?.step !== 1) return false
    const turnStart = location.turn?.start?.seq
    if (turnStart === undefined) return false
    return (nextStep?.claimSeq ?? -1) > turnStart
      && (nextTurn?.claimSeq ?? -1) < turnStart
      && nextStep?.claimedHuman === false
      && claimed(nextStep)
  }

  /** One injected message's row state, as the renderer reads it. */
  function injectionState(match, reader) {
    const event = match.event
    const message = event.type === 'developer/message' ? event.data?.message : event.data
    const record = message !== null && typeof message === 'object' ? message : {}
    const content = Array.isArray(record.content) ? record.content : []
    return {
      seq: event.seq,
      time: event.time,
      content,
      source: record.source ?? null,
      producer: injectionProducer(record.source),
      form: injectionForm(record.source),
      waking: injectionIsWaking(match, reader),
      text: injectionText(content),
    }
  }

  module.exports = { injectionText, injectionNames, injectionProducer, injectionForm, injectionIsWaking, injectionState }
    }

    /** injections/state.cjs */
    bodies["./injections/state.cjs"       ] = function (module, exports, require) {
  /**
   * injections/state.cjs — the switch, the seam the shell exposes, and the bridge seat.
   */
  const { INJECTIONS_KEY } = require('./constants.cjs')

  /** Read the persisted injected-row choice; only `show: true` turns the rows on. */
  function readSavedInjections() {
    try {
      const parsed = JSON.parse(localStorage.getItem(INJECTIONS_KEY) ?? '{}')
      return { show: parsed !== null && typeof parsed === 'object' && parsed.show === true }
    } catch {
      // A corrupt entry means the shipped behaviour: the shell's own filter decides.
      return { show: false }
    }
  }

  /** Persist the injected-row choice. The bridge beside it re-registers from the result. */
  function writeSavedInjections(next) {
    try {
      localStorage.setItem(INJECTIONS_KEY, JSON.stringify({ show: next.show === true }))
    } catch {
      // A blocked storage backend is a supported state for this row, as for the others.
    }
  }

  let injectionSettings = readSavedInjections()
  /** Set by `apply` once the conversation seam is available; null when it is not. */
  let injectionBridge = null
  /** Whether the shell exposed the Definition registry, for the settings row. */
  let injectionSeam = 'unknown'

  /** The choices in force, read live: the bridge consults them on every switch. */
  function injectionSettingsOf() {
    return injectionSettings
  }

  /** How the injected rows reached the conversation: `unknown`, `ready`, or `absent`. */
  function injectionSeamOf() {
    return injectionSeam
  }

  /**
   * Remember how the registration attempt went, so the settings row can say so.
   * @param value - `ready` when the registry took the Definition, `absent` when the
   * shell exposes no registry at all.
   */
  function setInjectionSeam(value) {
    injectionSeam = value
  }

  /**
   * Point the settings row's switch at the registration it drives.
   * @param bridge - The bridge `apply` built, or null while there is none.
   */
  function setInjectionBridge(bridge) {
    injectionBridge = bridge
  }

  /** Persist one injected-row choice and re-point the registered Definition. */
  function setInjectionSettings(next) {
    writeSavedInjections(next)
    injectionSettings = readSavedInjections()
    if (injectionBridge !== null) injectionBridge.sync()
  }

  module.exports = {
    readSavedInjections,
    writeSavedInjections,
    setInjectionSettings,
    injectionSettingsOf,
    injectionSeamOf,
    setInjectionSeam,
    setInjectionBridge,
  }
    }

    /** injections/view.cjs */
    bodies["./injections/view.cjs"        ] = function (module, exports, require) {
  /**
   * injections/view.cjs — the disclosure row, and the registration of its Definition.
   */
  const { injectionDefinition, injectionSummary } = require('./definition.cjs')
  const { h } = require('../shared/element.cjs')
  const React = require('react')

  /**
   * One restored injected-context row.
   *
   * It reads the state the Definition built and holds only its own disclosure: the row is
   * collapsed until it is asked to open, because that is what the shell's row did, and
   * the collapsed line already answers what was injected and by what.
   */
  function InjectionNodeView({ node, t }) {
    const data = node === undefined || node === null ? {} : node.data ?? {}
    const [open, setOpen] = React.useState(false)
    const text = typeof data.text === 'string' ? data.text : ''
    const label = typeof data.producer?.label === 'string' && data.producer.label !== '' ? data.producer.label : null
    const summary = injectionSummary(text)
    const title = data.producer?.role === 'recall' ? t('injRecall') : t('injTitle')
    return h('div', { className: 'dct-inj', 'data-dct-injection': true, 'data-open': open ? '1' : '0' },
      h('button', {
        type: 'button',
        className: 'dct-inj-head',
        'aria-expanded': open,
        'aria-label': label === null ? title : `${title} · ${label}`,
        onClick: () => setOpen((current) => !current),
      },
      h('span', { className: 'dct-inj-chevron', 'aria-hidden': true }),
      h('span', { className: 'dct-inj-title' }, title),
      label === null ? null : h('span', { className: 'dct-inj-sep', 'aria-hidden': true }),
      label === null ? null : h('span', { className: 'dct-inj-source' }, label),
      h('span', { className: 'dct-inj-sep', 'aria-hidden': true }),
      h('span', { className: 'dct-inj-summary' }, summary === '' ? t('injEmpty') : summary)),
      open ? h('pre', { className: 'dct-inj-body', 'data-dct-injection-body': true }, text === '' ? t('injEmpty') : text) : null)
  }

  /**
   * Register the Definition for the caller's lifetime.
   *
   * @returns its disposer, or null when the registry refused it — which is not fatal:
   *   the setting row still works and the next toggle tries again.
   */
  function registerInjectionDefinition(ctx, conversation) {
    try {
      const dispose = conversation.events.register(injectionDefinition)
      return typeof dispose === 'function' ? dispose : () => {}
    } catch (error) {
      ctx.logger.warn(`dsh-custom-theme: the injected-context rows could not be registered (${error instanceof Error ? error.message : String(error)})`)
      return null
    }
  }

  module.exports = { InjectionNodeView, registerInjectionDefinition }
    }

    /** reasoning/auto-expand.cjs */
    bodies["./reasoning/auto-expand.cjs"  ] = function (module, exports, require) {
  /**
   * reasoning/auto-expand.cjs — the live reasoning block, and the mutation pump behind the effects.
   */

  module.exports = function (deps) {
    const { appearanceSettings, clearStreamInk, disposeInkStyle, scheduleStreamInk, streamInkTargets } = deps

    // Both are filled in further down: the observer is created only where the page
    // has a body to watch, and the listener detach only where a document exists.
    let cleanupReasoningObserver = () => {}
    let cleanupReasoningExpand = () => {}

  /**
   * Auto-expand reasoning (ported from Deeptop).
   *
   * Deeptop automatically unfolds the live reasoning block while streaming, then
   * collapses it back into a one-line chip once thinking completes. Here we provide
   * configuration options:
   * - 'streaming': auto-expand while thinking, auto-collapse on finish (Deeptop default)
   * - 'keep': auto-expand while thinking, keep open on finish
   * - 'always': always keep all thinking content expanded (including historical turns)
   * - 'off': follow official DSH behavior (default collapsed, manual click only)
   *
   * Manual user toggle (clicking the disclosure row) is respected via WeakSet so
   * user intention is never overwritten.
   */
  const thinkUserInteracted = new WeakSet()
  const thinkAutoExpanded = new WeakSet()
  const thinkAutoCollapsed = new WeakSet()
  const thinkLastState = new WeakMap()

  function findToggleElement(root) {
    if (!root || typeof root.querySelector !== 'function') return null
    return root.querySelector('[data-disclosure-row][data-expandable], [data-disclosure-row][role="button"], button[aria-expanded], [data-disclosure-row]')
  }

  function isThinkExpanded(root) {
    if (!root) return false
    if (typeof root.hasAttribute === 'function' && root.hasAttribute('data-expanded')) return true
    const toggle = findToggleElement(root)
    if (toggle && typeof toggle.getAttribute === 'function') {
      return toggle.getAttribute('aria-expanded') === 'true'
    }
    return false
  }

  function isUserSelectingIn(root) {
    if (typeof window === 'undefined' || typeof window.getSelection !== 'function') return false
    try {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return false
      const node = sel.anchorNode
      return Boolean(node && root.contains(node))
    } catch {
      return false
    }
  }

  function handleUserDisclosureToggle(event) {
    if (!event || !event.isTrusted) return
    if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return
    const target = event.target
    if (!target || typeof target.closest !== 'function') return
    const toggle = target.closest('[data-disclosure-row], button[aria-expanded]')
    if (!toggle) return
    const thinkRoot = toggle.closest('[data-variant="think"]')
    if (thinkRoot) {
      thinkUserInteracted.add(thinkRoot)
    }
  }

  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('click', handleUserDisclosureToggle, { capture: true, passive: true })
    document.addEventListener('keydown', handleUserDisclosureToggle, { capture: true, passive: true })
  }

  /**
   * Click a disclosure row without re-entering React's own commit.
   *
   * {@link tickReasoningExpand} runs from a MutationObserver callback, which a
   * browser may deliver while React is still committing. A synchronous `click()`
   * there re-enters the renderer's event path mid-commit, so the synthetic click is
   * deferred to a macrotask — the same window a user's own click arrives in.
   * @param toggle - The disclosure row to click.
   */
  function clickToggleSoon(toggle) {
    const schedule = typeof window !== 'undefined' && typeof window.setTimeout === 'function'
      ? window.setTimeout.bind(window)
      : setTimeout
    schedule(() => {
      if (toggle.isConnected === false) return
      const click = toggle.click
      if (typeof click === 'function') click.call(toggle)
    }, 0)
  }

  /** The shell's reasoning turns: the blocks the reasoning pass expands and collapses. */
  const REASONING_SELECTOR = '[data-variant="think"]'

  /** Whether one changed node is a reasoning turn, or holds one. */
  function touchesReasoning(node) {
    if (node === null || node === undefined) return false
    if (node.nodeType === 3) {
      const parent = node.parentElement
      if (parent === null || parent === undefined || typeof parent.closest !== 'function') return false
      return parent.closest(REASONING_SELECTOR) !== null
    }
    if (node.nodeType !== 1) return false
    // `closest` covers the node itself, which is what an attribute record names.
    if (typeof node.closest === 'function' && node.closest(REASONING_SELECTOR) !== null) return true
    return typeof node.querySelector === 'function' && node.querySelector(REASONING_SELECTOR) !== null
  }

  /**
   * Whether a batch of mutation records could have changed a reasoning turn.
   *
   * Asking the document for every think block is the reasoning pass's first act, and on a
   * long transcript that one query is the whole cost of the pass. A reply that is not
   * thinking cannot have changed a turn, so this answers from the records instead — which is
   * what keeps the query off the streaming path. A call with no records is a direct request,
   * from a boot or a settings change, and always checks.
   * @param records - Mutation records, as the observer received them.
   * @returns Whether the pass is worth running.
   */
  function reasoningTouched(records) {
    if (!Array.isArray(records) || records.length === 0) return true
    for (const record of records) {
      if (record === null || record === undefined) continue
      if (record.type === 'attributes') {
        if (touchesReasoning(record.target)) return true
        continue
      }
      // A removed turn has nothing left to expand and a text change cannot start or settle
      // one, so only an added node can matter here.
      if (record.type !== 'childList') continue
      for (const node of record.addedNodes ?? []) {
        if (touchesReasoning(node)) return true
      }
    }
    return false
  }

  function tickReasoningExpand() {
    if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return
    const mode = appearanceSettings()?.reasoningExpand || 'streaming'
    if (mode === 'off') return

    const thinkNodes = document.querySelectorAll('[data-variant="think"]')
    if (!thinkNodes || thinkNodes.length === 0) return

    for (const root of thinkNodes) {
      if (root.isConnected === false) continue
      if (thinkUserInteracted.has(root)) continue

      const state = typeof root.getAttribute === 'function' ? root.getAttribute('data-state') : null
      const isRunning = state === 'running'
      const open = isThinkExpanded(root)

      const lastState = thinkLastState.get(root)
      if (lastState !== state) {
        thinkLastState.set(root, state)
        if (isRunning && thinkAutoCollapsed.has(root)) {
          thinkAutoCollapsed.delete(root)
        }
      }

      if (mode === 'streaming') {
        if (isRunning) {
          if (!open && !thinkAutoExpanded.has(root)) {
            const toggle = findToggleElement(root)
            if (toggle && typeof toggle.click === 'function') {
              thinkAutoExpanded.add(root)
              clickToggleSoon(toggle)
            }
          }
        } else if (state === 'ok' || state === 'done' || (!isRunning && state !== null)) {
          if (thinkAutoExpanded.has(root) && !thinkAutoCollapsed.has(root)) {
            if (isUserSelectingIn(root)) continue

            if (open) {
              const toggle = findToggleElement(root)
              if (toggle && typeof toggle.click === 'function') {
                thinkAutoExpanded.delete(root)
                thinkAutoCollapsed.add(root)
                clickToggleSoon(toggle)
              }
            } else {
              thinkAutoExpanded.delete(root)
              thinkAutoCollapsed.add(root)
            }
          }
        }
      } else if (mode === 'keep') {
        if (isRunning && !open && !thinkAutoExpanded.has(root)) {
          const toggle = findToggleElement(root)
          if (toggle && typeof toggle.click === 'function') {
            thinkAutoExpanded.add(root)
            clickToggleSoon(toggle)
          }
        }
      } else if (mode === 'always') {
        if (!open && !thinkAutoExpanded.has(root)) {
          const toggle = findToggleElement(root)
          if (toggle && typeof toggle.click === 'function') {
            thinkAutoExpanded.add(root)
            clickToggleSoon(toggle)
          }
        }
      }
    }
  }

  cleanupReasoningExpand = function cleanupReasoningExpand() {
    if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
      document.removeEventListener('click', handleUserDisclosureToggle, { capture: true })
      document.removeEventListener('keydown', handleUserDisclosureToggle, { capture: true })
    }
  }

  let reasoningObserver = null
  let isStreamMutating = false
  if (typeof window !== 'undefined' && typeof document !== 'undefined' && typeof window.MutationObserver !== 'undefined' && document.body) {
    reasoningObserver = new window.MutationObserver((records) => {
      if (isStreamMutating) return
      isStreamMutating = true
      try {
        scheduleStreamInk(streamInkTargets(records))
        if (reasoningTouched(records)) tickReasoningExpand()
      } finally {
        isStreamMutating = false
      }
    })
    reasoningObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['data-streaming', 'data-state'],
    })
  }

  cleanupReasoningObserver = function cleanupReasoningObserver() {
    if (reasoningObserver !== null) {
      reasoningObserver.disconnect()
      reasoningObserver = null
    }
    clearStreamInk()
    disposeInkStyle()
  }

  /**
   * Detach everything this module installed: the document listeners and the
   * mutation observer that pumps both the ink and the expansion.
   */
  function dispose() {
    cleanupReasoningObserver()
    cleanupReasoningExpand()
  }

    return { tickReasoningExpand, dispose }
  }
    }

    /** settings/page.cjs */
    bodies["./settings/page.cjs"          ] = function (module, exports, require) {
  /**
   * settings/page.cjs — the settings page: the pickers, the controls and the two switches.
   */
  const { h } = require('../shared/element.cjs')
  const React = require('react')

  module.exports = function (deps) {
    const { UpdateRow, applyAppearance, applyBackgroundsWhenReady, applyTheme, ctx, effortLevelsRow, injectionSeamOf, listBackgrounds, listThemes, setInjectionSettings, setWorkingSettings, signal, themeChangeListeners, uploadBackground } = deps

    const { APPEARANCE_KEY, CODE_FONT_PRESETS, FONT_SIZES, LINE_GAPS, STREAM_FADE_DURATION_MAX, STREAM_FADE_DURATION_MIN, STREAM_FADE_DURATION_STEP, STREAM_FADE_INK_MAX, STREAM_FADE_INK_MIN, TEXT_FONT_PRESETS, fontOptions, readSavedAppearance } = require('../appearance/constants.cjs')
    const { readSavedBackgrounds, writeSavedBackgrounds } = require('../backgrounds/store.cjs')
    const { BLUR_MAX, BLUR_MIN, OPACITY_MAX, OPACITY_MIN, POSITIONS, ZONES, positionKey } = require('../backgrounds/zones.cjs')
    const { readSavedEffortTheme, writeSavedEffortTheme } = require('../effort/constants.cjs')
    const { readSavedInjections } = require('../injections/state.cjs')
    const { EFFORT_LEVELS_URL } = require('../shared/endpoints.cjs')
    const { readSaved, writeSaved } = require('../theme/selection.cjs')
    const { importFailureFor, importMessage } = require('../update/client.cjs')
    const { WORKING_EFFECTS, WORKING_EFFECT_LABELS, WORKING_INTERVALS, WORKING_SHIMMER_LABELS, WORKING_SHIMMER_STYLES, readSavedWorking } = require('../working/constants.cjs')

    /** Reasoning disclosure mode descriptions mapped to i18n keys. */
    const REASONING_DESCRIPTIONS = {
      streaming: 'reasoningDetailStreaming',
      keep: 'reasoningDetailKeep',
      always: 'reasoningDetailAlways',
      off: 'reasoningDetailOff',
    }

    /** Quick presets for streaming fade-in. */
    const FADE_PRESETS = [
      { id: 'default', labelKey: 'fadePresetDefault', tipKey: 'fadePresetDefaultTip', duration: 520, ink: 0.3 },
      { id: 'fast', labelKey: 'fadePresetFast', tipKey: 'fadePresetFastTip', duration: 250, ink: 0.5 },
      { id: 'soft', labelKey: 'fadePresetSoft', tipKey: 'fadePresetSoftTip', duration: 800, ink: 0.15 },
      { id: 'off', labelKey: 'fadePresetOff', tipKey: 'fadePresetOffTip', duration: 150, ink: 1.0 },
    ]

    /**
     * Card container: groups related settings into a cohesive card section.
     */
    function Card({ id, icon, title, desc, children }) {
      return h('section', { className: 'dct-card', 'data-card': id },
        h('div', { className: 'dct-card-header' },
          h('div', { className: 'dct-card-title' },
            icon ? h('span', { className: 'dct-card-icon', 'aria-hidden': true }, icon) : null,
            title),
          desc ? h('div', { className: 'dct-card-desc' }, desc) : null),
        h('div', { className: 'dct-card-body' }, children))
    }

    /**
     * Capsule / Segmented control:
     * Provides sleek pill-shaped toggle buttons for options with fixed choices.
     */
    function Capsule({ value, options, onChange, disabled = false, size = 'normal', ariaLabel }) {
      return h('div', {
        className: `dct-capsule-group${size === 'small' ? ' dct-capsule-sm' : ''}`,
        role: 'radiogroup',
        'aria-label': ariaLabel,
      }, options.map((opt) => {
        const isSelected = String(opt.value) === String(value)
        return h('button', {
          key: String(opt.value),
          type: 'button',
          className: `dct-capsule-btn${isSelected ? ' selected' : ''}`,
          role: 'radio',
          'aria-checked': isSelected,
          disabled: disabled || opt.disabled,
          title: opt.title || opt.label,
          onClick: () => {
            if (!isSelected && !disabled && !opt.disabled) onChange(opt.value)
          },
        },
        opt.icon ? h('span', { className: 'dct-capsule-icon', 'aria-hidden': true }, opt.icon) : null,
        h('span', { className: 'dct-capsule-text' }, opt.label))
      }))
    }

    /**
     * Interactive slider with linked number input and unit readout.
     */
    function SliderControl({ value, min, max, step = 1, unit = '', onChange, title, disabled = false, inputClass = '' }) {
      return h('div', { className: 'dct-slider-control' },
        h('input', {
          type: 'range',
          className: 'dct-slider',
          min,
          max,
          step,
          value,
          disabled,
          'aria-label': title,
          onChange: (event) => onChange(Number(event.target.value)),
        }),
        h('div', { className: 'dct-slider-input-wrap' },
          h('input', {
            type: 'number',
            className: `dct-number ${inputClass}`.trim(),
            min,
            max,
            step,
            value,
            disabled,
            title,
            'aria-label': title,
            onChange: (event) => {
              const val = Number(event.target.value)
              if (Number.isFinite(val)) onChange(Math.min(max, Math.max(min, Math.round(val))))
            },
          }),
          unit ? h('span', { className: 'dct-unit' }, unit) : null))
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
    const [injections, setInjections] = React.useState(readSavedInjections)
    const [efforts, setEfforts] = React.useState(null)
    const [effortTheme, setEffortTheme] = React.useState(readSavedEffortTheme)
    /** Which phrase the page's own sample of the running label is showing. */
    const [previewIndex, setPreviewIndex] = React.useState(0)

    const rescan = React.useCallback(async () => {
      setStatus('loading')
      try {
        const [ids, names] = await Promise.all([listThemes(signal), listBackgrounds(signal)])
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
     */
    React.useEffect(() => {
      writeSavedBackgrounds(backgrounds)
      applyBackgroundsWhenReady(backgrounds)
    }, [backgrounds])

    /** The hidden picker the import button drives. */
    const fileInput = React.useRef(null)

    const onPickFile = React.useCallback(async (event) => {
      const file = event.target.files && event.target.files[0]
      event.target.value = ''
      if (!file) return
      const was = backgrounds[zone].name
      setImporting(true)
      setImportFailure(null)
      try {
        const stored = await uploadBackground(file)
        setImages(await listBackgrounds(signal))
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

    /** Persist the injected-row choice; the live bridge re-registers the Definition. */
    const updateInjections = React.useCallback((patch) => {
      setInjections((current) => {
        setInjectionSettings({ ...current, ...patch })
        return readSavedInjections()
      })
    }, [])

    /*
     * The reasoning-level switch.
     */
    React.useEffect(() => {
      let live = true
      fetch(EFFORT_LEVELS_URL, { cache: 'no-store' })
        .then((response) => (response.ok
          ? response.json()
          : { failure: `HTTP ${response.status}`, status: response.status }))
        .then((body) => { if (live) setEfforts(body) })
        .catch((error) => { if (live) setEfforts({ failure: error.message }) })
      return () => { live = false }
    }, [])

    const updateEfforts = React.useCallback(async (enabled) => {
      setEfforts((current) => ({ ...(current ?? {}), enabled, busy: true }))
      try {
        const response = await fetch(EFFORT_LEVELS_URL, {
          method: 'POST',
          cache: 'no-store',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ enabled }),
        })
        // A Host that does not know the route answers 404 or 405, which the hint names.
        setEfforts(response.ok
          ? await response.json()
          : { failure: `HTTP ${response.status}`, status: response.status, enabled })
      } catch (error) {
        setEfforts({ failure: error.message, enabled })
      }
    }, [])

    const updateEffortTheme = React.useCallback((next) => {
      setEffortTheme(next)
      writeSavedEffortTheme(next)
    }, [])

    const config = backgrounds[zone]
    const configured = ZONES.filter((item) => backgrounds[item.id].name !== '').length
    const busy = status === 'loading'
    const noImage = config.name === ''
    const active = ZONES.find((item) => item.id === zone)

    const previewTexts = working.texts.length > 0 ? working.texts : [t('workPlaceholder')]
    const previewKey = previewTexts.join('\n')
    const previewText = previewTexts[previewIndex % previewTexts.length]
    React.useEffect(() => { setPreviewIndex(0) }, [previewKey])
    React.useEffect(() => {
      if (previewTexts.length < 2) return undefined
      const timer = window.setTimeout(() => setPreviewIndex((index) => index + 1), working.interval)
      return () => window.clearTimeout(timer)
    }, [previewIndex, previewKey, previewTexts.length, working.interval])

    /** One colour choice with picker and hex readout. */
    const colorField = (className, label, value, onChange) => h('label', { className: `dct-color ${className}` },
      h('input', {
        type: 'color',
        className: 'dct-color-input',
        value,
        'aria-label': label,
        onChange: (event) => onChange(event.target.value),
      }),
      h('code', { className: 'dct-color-code' }, value))

    /** One clickable region of the layout schematic. */
    const region = (id, extra) => h('button', {
      type: 'button',
      className: `${extra}${zone === id ? ' selected' : ''}${backgrounds[id].name === '' ? '' : ' has-image'}`,
      'data-dct-pick': id,
      'aria-pressed': zone === id,
      disabled: busy,
      onClick: () => setZone(id),
    }, h('span', null, t(ZONES.find((item) => item.id === id).labelKey)))

    // Scheme capsule options
    const schemeOptions = [
      { value: 'light', label: t('schemeLight'), icon: '☀️' },
      { value: 'dark', label: t('schemeDark'), icon: '🌙' },
      { value: 'system', label: t('schemeSystem'), icon: '💻' },
    ]

    // Font size capsule options
    const fontSizeOptions = FONT_SIZES.map((px) => ({ value: px, label: `${px}px` }))

    // Line gap capsule options with sensible presets
    const LINE_GAP_PRESETS = [-2, 0, 2, 4, 6]
    const gapName = (gap) => {
      switch (gap) {
        case -2: return t('gapTight')
        case 0: return t('gapNormal')
        case 2: return t('gapRelaxed')
        case 4: return t('gapLoose')
        case 6: return t('gapLarge')
        default: return `${gap > 0 ? '+' : ''}${gap}px`
      }
    }
    const lineGapOptions = LINE_GAP_PRESETS.map((gap) => ({
      value: gap,
      label: `${gap > 0 ? '+' : ''}${gap}px`,
      title: gapName(gap),
    }))
    if (!LINE_GAP_PRESETS.includes(appearance.lineGap)) {
      lineGapOptions.push({
        value: appearance.lineGap,
        label: `${appearance.lineGap > 0 ? '+' : ''}${appearance.lineGap}px`,
        title: gapName(appearance.lineGap),
      })
    }

    // Reasoning disclosure capsule options
    const reasoningOptions = [
      { value: 'streaming', label: t('reasoningModeStreaming') },
      { value: 'keep', label: t('reasoningModeKeep') },
      { value: 'always', label: t('reasoningModeAlways') },
      { value: 'off', label: t('reasoningModeOff') },
    ]

    // Working text intervals
    const INTERVAL_PRESETS = [1200, 1800, 2400, 3000, 4000]
    const intervalOptions = INTERVAL_PRESETS.map((ms) => ({ value: ms, label: `${ms / 1000}s` }))
    if (!INTERVAL_PRESETS.includes(working.interval)) {
      intervalOptions.push({ value: working.interval, label: `${working.interval / 1000}s` })
    }

    // Working effect capsule options
    const effectOptions = WORKING_EFFECTS.map((effect) => ({
      value: effect,
      label: t(WORKING_EFFECT_LABELS[effect]),
    }))

    // Shimmer style capsule options
    const shimmerOptions = WORKING_SHIMMER_STYLES.map((style) => ({
      value: style,
      label: t(WORKING_SHIMMER_LABELS[style]),
    }))

    // Background fit capsule options
    const fitOptions = [
      { value: 'cover', label: t('bgCover') },
      { value: 'contain', label: t('bgContain') },
    ]

    return h('div', { className: 'dct-page' },
      h('h2', { className: 'dct-heading' },
        h('span', null, '🎨'),
        h('span', null, t('nav'))),

      /* ─── Card 1: Theme & Color Palette ─── */
      h(Card, { id: 'theme', icon: '🎨', title: t('cardTheme'), desc: t('cardThemeDesc') },
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
            h(Capsule, {
              value: preference,
              options: schemeOptions,
              ariaLabel: t('scheme'),
              onChange: (val) => { ctx.theme.setTheme(val) },
            }),
            // Accessible synchronized select for test driver compatibility
            h('select', {
              className: 'dct-select dct-scheme dct-sr-only',
              value: preference,
              'aria-label': t('scheme'),
              tabIndex: -1,
              onChange: (event) => { ctx.theme.setTheme(event.target.value) },
            },
            h('option', { value: 'light' }, t('schemeLight')),
            h('option', { value: 'dark' }, t('schemeDark')),
            h('option', { value: 'system' }, t('schemeSystem')))))),

      /* ─── Card 2: Typography & Layout (Replaces confusing Dialogue Stream row) ─── */
      h(Card, { id: 'typography', icon: '✍️', title: t('cardTypography'), desc: t('cardTypographyDesc') },
        h('div', { className: 'dct-row' },
          h('div', { className: 'dct-text' },
            h('div', { className: 'dct-title' }, t('fontSize')),
            h('div', { className: 'dct-hint' }, t('fontSizeDesc'))),
          h('div', { className: 'dct-control' },
            h(Capsule, {
              value: fontSize,
              options: fontSizeOptions,
              ariaLabel: t('fontSize'),
              onChange: (px) => {
                ctx.theme.setFontSize(px)
                setFontSize(px)
              },
            }),
            h('select', {
              className: 'dct-select dct-fontsize dct-sr-only',
              value: String(fontSize),
              'aria-label': t('fontSize'),
              tabIndex: -1,
              onChange: (event) => {
                const px = Number(event.target.value)
                ctx.theme.setFontSize(px)
                setFontSize(px)
              },
            }, FONT_SIZES.map((px) => h('option', { key: px, value: String(px) }, `${px}px`))))),
        h('div', { className: 'dct-row' },
          h('div', { className: 'dct-text' },
            h('div', { className: 'dct-title' },
              t('lineGap'),
              h('span', { className: 'dct-badge' }, gapName(appearance.lineGap))),
            h('div', { className: 'dct-hint' }, t('lineGapDesc'))),
          h('div', { className: 'dct-control' },
            h(Capsule, {
              value: appearance.lineGap,
              options: lineGapOptions,
              ariaLabel: t('lineGap'),
              onChange: (gap) => updateAppearance({ lineGap: gap }),
            }),
            h('select', {
              className: 'dct-select dct-linegap dct-sr-only',
              value: String(appearance.lineGap),
              'aria-label': t('lineGap'),
              tabIndex: -1,
              onChange: (event) => updateAppearance({ lineGap: Number(event.target.value) }),
            }, LINE_GAPS.map((gap) => h('option', { key: gap, value: String(gap) }, gap > 0 ? `+${gap}px` : `${gap}px`))))),
        h('div', { className: 'dct-row' },
          h('div', { className: 'dct-text' },
            h('div', { className: 'dct-title' }, t('fontFamily')),
            h('div', { className: 'dct-hint' }, t('fontFamilyDesc'))),
          h('div', { className: 'dct-control' },
            h('select', {
              className: 'dct-select dct-font',
              value: appearance.fontFamily,
              'aria-label': t('fontFamily'),
              onChange: (event) => updateAppearance({ fontFamily: event.target.value }),
            }, fontOptions(TEXT_FONT_PRESETS, appearance.fontFamily, t)))),
        h('div', { className: 'dct-row' },
          h('div', { className: 'dct-text' },
            h('div', { className: 'dct-title' }, t('codeFontFamily')),
            h('div', { className: 'dct-hint' }, t('codeFontFamilyDesc'))),
          h('div', { className: 'dct-control' },
            h('select', {
              className: 'dct-select dct-codefont',
              value: appearance.codeFontFamily,
              'aria-label': t('codeFontFamily'),
              onChange: (event) => updateAppearance({ codeFontFamily: event.target.value }),
            }, fontOptions(CODE_FONT_PRESETS, appearance.codeFontFamily, t))))),

      /* ─── Card 3: Streaming Text Animation (Replaces confusing 520ms / 30% row) ─── */
      h(Card, { id: 'streaming', icon: '🌊', title: t('cardStreaming'), desc: t('cardStreamingDesc') },
        h('div', { className: 'dct-presets-row' },
          h('span', { className: 'dct-presets-label' }, t('fadePresets')),
          h('div', { className: 'dct-capsule-group dct-capsule-sm', role: 'group' },
            FADE_PRESETS.map((preset) => {
              const isMatch = appearance.streamingFadeDuration === preset.duration
                && Math.abs(appearance.streamingFadeInk - preset.ink) < 0.04
              return h('button', {
                key: preset.id,
                type: 'button',
                className: `dct-capsule-btn${isMatch ? ' selected' : ''}`,
                title: t(preset.tipKey),
                onClick: () => updateAppearance({
                  streamingFadeDuration: preset.duration,
                  streamingFadeInk: preset.ink,
                }),
              }, t(preset.labelKey))
            }))),
        h('div', { className: 'dct-row' },
          h('div', { className: 'dct-text' },
            h('div', { className: 'dct-title' }, t('streamFadeDuration')),
            h('div', { className: 'dct-hint' }, t('fadeDurationDesc'))),
          h('div', { className: 'dct-control' },
            h(SliderControl, {
              value: appearance.streamingFadeDuration,
              min: STREAM_FADE_DURATION_MIN,
              max: STREAM_FADE_DURATION_MAX,
              step: STREAM_FADE_DURATION_STEP,
              unit: 'ms',
              title: t('streamFadeDuration'),
              inputClass: 'dct-fade-duration',
              onChange: (ms) => updateAppearance({ streamingFadeDuration: ms }),
            }))),
        h('div', { className: 'dct-row' },
          h('div', { className: 'dct-text' },
            h('div', { className: 'dct-title' }, t('streamFadeInk')),
            h('div', { className: 'dct-hint' }, t('fadeInkDesc'))),
          h('div', { className: 'dct-control' },
            h(SliderControl, {
              value: Math.round(appearance.streamingFadeInk * 100),
              min: Math.round(STREAM_FADE_INK_MIN * 100),
              max: Math.round(STREAM_FADE_INK_MAX * 100),
              step: 5,
              unit: '%',
              title: t('streamFadeInk'),
              inputClass: 'dct-fade-ink',
              onChange: (percent) => updateAppearance({ streamingFadeInk: percent / 100 }),
            })))),

      /* ─── Card 4: Reasoning Disclosure Strategy ─── */
      h(Card, { id: 'reasoning', icon: '🧠', title: t('cardReasoning'), desc: t('cardReasoningDesc') },
        h('div', { className: 'dct-row' },
          h('div', { className: 'dct-text' },
            h('div', { className: 'dct-title' }, t('reasoningExpandTitle')),
            h('div', { className: 'dct-hint' }, t('reasoningExpandHint'))),
          h('div', { className: 'dct-control' },
            h(Capsule, {
              value: appearance.reasoningExpand,
              options: reasoningOptions,
              ariaLabel: t('reasoningExpandTitle'),
              onChange: (val) => updateAppearance({ reasoningExpand: val }),
            }),
            h('select', {
              className: 'dct-select dct-reasoning-expand dct-sr-only',
              value: appearance.reasoningExpand,
              'aria-label': t('reasoningExpandTitle'),
              tabIndex: -1,
              onChange: (event) => updateAppearance({ reasoningExpand: event.target.value }),
            },
            h('option', { value: 'streaming' }, t('reasoningExpandStreaming')),
            h('option', { value: 'keep' }, t('reasoningExpandKeep')),
            h('option', { value: 'always' }, t('reasoningExpandAlways')),
            h('option', { value: 'off' }, t('reasoningExpandFollow'))))),
        h('div', { className: 'dct-detail-banner' },
          h('span', { className: 'dct-detail-icon' }, '💡'),
          h('span', null, t(REASONING_DESCRIPTIONS[appearance.reasoningExpand] || 'reasoningExpandHint')))),

      /* ─── Card 5: Working Status & Effects ─── */
      h(Card, { id: 'working', icon: '💬', title: t('cardWorking'), desc: t('cardWorkingDesc') },
        h('div', { className: 'dct-row dct-sub' },
          h('div', { className: 'dct-text' },
            h('div', { className: 'dct-title' },
              t('workTitle'),
              h('span', { className: 'dct-badge' },
                working.texts.length > 0 ? t('workingTextsCount', { n: working.texts.length }) : t('workingTextsEmpty'))),
            h('div', { className: 'dct-hint' }, t('workHint'))),
          h('div', { className: 'dct-control' },
            h('textarea', {
              className: 'dct-area dct-working',
              value: working.texts.join('\n'),
              placeholder: t('workPlaceholder'),
              'aria-label': t('workTitle'),
              onChange: (event) => updateWorking({ texts: event.target.value.split('\n') }),
            }))),
        h('div', { className: 'dct-row' },
          h('div', { className: 'dct-text' },
            h('div', { className: 'dct-title' }, t('workInterval')),
            h('div', { className: 'dct-hint' }, t('workIntervalDesc'))),
          h('div', { className: 'dct-control' },
            h(Capsule, {
              value: working.interval,
              options: intervalOptions,
              ariaLabel: t('workInterval'),
              onChange: (ms) => updateWorking({ interval: ms }),
            }),
            h('select', {
              className: 'dct-select dct-interval dct-sr-only',
              value: String(working.interval),
              'aria-label': t('workInterval'),
              tabIndex: -1,
              onChange: (event) => updateWorking({ interval: Number(event.target.value) }),
            }, WORKING_INTERVALS.map((ms) => h('option', { key: ms, value: String(ms) }, `${ms / 1000}s`))))),
        h('div', { className: 'dct-row' },
          h('div', { className: 'dct-text' },
            h('div', { className: 'dct-title' }, t('workEffectTitle')),
            h('div', { className: 'dct-hint' }, t('workEffectHint'))),
          h('div', { className: 'dct-control' },
            h(Capsule, {
              value: working.effect,
              options: effectOptions,
              ariaLabel: t('workEffectTitle'),
              onChange: (eff) => updateWorking({ effect: eff }),
            }),
            h('select', {
              className: 'dct-select dct-effect dct-sr-only',
              value: working.effect,
              'aria-label': t('workEffectTitle'),
              tabIndex: -1,
              onChange: (event) => updateWorking({ effect: event.target.value }),
            }, WORKING_EFFECTS.map((effect) => h('option', { key: effect, value: effect }, t(WORKING_EFFECT_LABELS[effect])))))),
        working.effect === 'shimmer' ? h('div', { className: 'dct-row' },
          h('div', { className: 'dct-text' },
            h('div', { className: 'dct-title' }, t('workShimmerStyle')),
            h('div', { className: 'dct-hint' }, t('workShimmerMatte') + ' / ' + t('workShimmerRainbow'))),
          h('div', { className: 'dct-control' },
            h(Capsule, {
              value: working.shimmer,
              options: shimmerOptions,
              ariaLabel: t('workShimmerStyle'),
              onChange: (shim) => updateWorking({ shimmer: shim }),
            }),
            h('select', {
              className: 'dct-select dct-shimmer dct-sr-only',
              value: working.shimmer,
              'aria-label': t('workShimmerStyle'),
              tabIndex: -1,
              onChange: (event) => updateWorking({ shimmer: event.target.value }),
            }, WORKING_SHIMMER_STYLES.map((style) => h('option', { key: style, value: style }, t(WORKING_SHIMMER_LABELS[style])))))) : null,
        working.effect !== 'official' ? h('div', { className: 'dct-row' },
          h('div', { className: 'dct-text' },
            h('div', { className: 'dct-title' }, t('workColorsDesc'))),
          h('div', { className: 'dct-control dct-wrap' },
            colorField('dct-work-color', t('workColor'), working.color, (color) => updateWorking({ color })),
            working.effect === 'shimmer' && working.shimmer === 'matte'
              ? colorField('dct-work-sweep-color', t('workSweepColor'), working.sweep, (sweep) => updateWorking({ sweep }))
              : null)) : null,
        h('div', { className: 'dct-work-preview' },
          working.effect === 'hidden'
            ? h('span', { className: 'dct-work-preview-note' }, t('workPreviewHidden'))
            : h('span', { className: 'dct-work-effect' },
              previewText,
              h('span', { className: 'dct-work-sweep', 'aria-hidden': true },
                h('span', { className: 'dct-work-sweep-text' }, previewText))),
          h('small', null, t('workPreviewCaption')))),

      /* ─── Card 6: Advanced & Injections ─── */
      h(Card, { id: 'injections', icon: '⚙️', title: t('cardInjections'), desc: t('cardInjectionsDesc') },
        h('div', { className: 'dct-row dct-sub' },
          h('div', { className: 'dct-text' },
            h('div', { className: 'dct-title' }, t('injSettingTitle')),
            h('div', { className: 'dct-hint' }, t('injHint')),
            injectionSeamOf() === 'absent' ? h('div', { className: 'dct-note' }, t('injUnavailable')) : null),
          h('div', { className: 'dct-control' },
            h('label', { className: 'dct-toggle' },
              h('input', {
                type: 'checkbox',
                className: 'dct-injections',
                checked: injections.show,
                'aria-label': t('injSettingTitle'),
                onChange: (event) => updateInjections({ show: event.target.checked }),
              }),
              h('span', null, injections.show ? t('injShow') : t('injFollow'))))),
        effortLevelsRow(h, t, efforts, updateEfforts),
        h('div', { className: 'dct-row dct-sub' },
          h('div', { className: 'dct-text' },
            h('div', { className: 'dct-title' }, t('effortThemeTitle')),
            h('div', { className: 'dct-hint' }, t('effortThemeHint'))),
          h('div', { className: 'dct-control' },
            h(Capsule, {
              value: effortTheme,
              options: [
                { value: 'codex', label: t('effortThemeCodex'), icon: '✨' },
                { value: 'deepseek', label: t('effortThemeDeepSeek'), icon: '🐋' },
              ],
              ariaLabel: t('effortThemeTitle'),
              onChange: (val) => updateEffortTheme(val),
            })))),

      /* ─── Card 7: Background & Wallpapers ─── */
      h(Card, { id: 'background', icon: '🖼️', title: t('cardBackground'), desc: t('cardBackgroundDesc') },
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
            h(Capsule, {
              value: config.size,
              options: fitOptions,
              disabled: busy || noImage,
              ariaLabel: t('bgFit'),
              size: 'small',
              onChange: (size) => updateZone({ size }),
            }),
            h('select', {
              className: 'dct-select dct-fit dct-sr-only',
              value: config.size,
              disabled: busy || noImage,
              'aria-label': t('bgFit'),
              tabIndex: -1,
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
            }, POSITIONS.map((pos) => h('option', { key: pos, value: pos }, t(positionKey(pos))))),
            h('input', {
              className: 'dct-number dct-opacity',
              type: 'number',
              min: OPACITY_MIN * 100,
              max: OPACITY_MAX * 100,
              step: 5,
              value: Math.round(config.opacity * 100),
              disabled: busy || noImage,
              title: t('bgOpacity'),
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
              title: t('bgBlur'),
              'aria-label': t('bgBlur'),
              onChange: (event) => {
                const pixels = Number(event.target.value)
                if (Number.isFinite(pixels)) {
                  updateZone({ blur: Math.min(BLUR_MAX, Math.max(BLUR_MIN, Math.round(pixels))) })
                }
              },
            }),
            h('button', {
              type: 'button',
              className: 'dct-button dct-clear',
              disabled: noImage,
              onClick: () => updateZone({ name: '' }),
            }, t('bgClear'))))),

      /* ─── Plugin Update Row ─── */
      h(UpdateRow, { t }),
      status === 'failed' ? h('div', { className: 'dct-error', role: 'status' }, t('failed')) : null)
  }

    return { ThemeRow }
  }
    }

    /** settings/styles.cjs */
    bodies["./settings/styles.cjs"        ] = function (module, exports, require) {
  /**
   * settings/styles.cjs — the settings page's own stylesheet.
   */
  const { EFFORT_CSS } = require('../effort/styles.cjs')
  const { INJECTION_CSS } = require('../injections/constants.cjs')

  const PAGE_CSS = `
.dct-page { display: flex; flex-direction: column; gap: 14px; max-width: 780px; padding: 4px 0 28px; }
.dct-heading { margin: 0 0 2px; font-size: 16px; font-weight: 600; color: var(--dsw-alias-label-primary, inherit); display: flex; align-items: center; gap: 8px; }

/* Modern Card Layout */
.dct-card {
  box-sizing: border-box;
  background: var(--dsw-alias-bg-layer-1, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.16));
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  transition: border-color 0.18s ease;
  max-width: 100%;
}
.dct-card:hover { border-color: var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.28)); }
.dct-card-header { display: flex; flex-direction: column; gap: 2px; padding-bottom: 8px; border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.1)); }
.dct-card-title { font-size: 14px; font-weight: 600; color: var(--dsw-alias-label-primary, inherit); display: flex; align-items: center; gap: 6px; }
.dct-card-icon { font-size: 15px; line-height: 1; }
.dct-card-desc { font-size: 12px; color: var(--dsw-alias-label-secondary, inherit); line-height: 1.4; }
.dct-card-body { display: flex; flex-direction: column; gap: 12px; }

/* Rows and items */
.dct-row { display: flex; align-items: center; justify-content: space-between; gap: 12px 16px; padding: 4px 0; flex-wrap: wrap; box-sizing: border-box; }
.dct-row-divider { border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.08)); padding-bottom: 10px; }
.dct-text { flex: 1 1 180px; min-width: 140px; }
.dct-title { font-size: 13px; font-weight: 500; color: var(--dsw-alias-label-primary, inherit); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.dct-hint { margin-top: 2px; font-size: 12px; color: var(--dsw-alias-label-secondary, inherit); line-height: 1.4; }
.dct-note { margin-top: 4px; font-size: 11px; color: var(--dsw-alias-label-caption, inherit); }
.dct-badge { display: inline-block; padding: 1px 6px; font-size: 11px; font-weight: 400; border-radius: 4px; background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.12)); color: var(--dsw-alias-label-secondary, inherit); }

.dct-control { display: flex; flex: 0 0 auto; align-items: center; gap: 8px; max-width: 100%; margin-left: auto; }
.dct-wrap { flex-wrap: wrap; justify-content: flex-end; gap: 8px; max-width: 65%; }

/* Capsule Segmented Control */
.dct-capsule-group {
  display: inline-flex;
  align-items: center;
  background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.1));
  border: 1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.18));
  border-radius: 9999px;
  padding: 2px;
  gap: 2px;
  user-select: none;
  max-width: 100%;
  box-sizing: border-box;
}
.dct-capsule-group.dct-capsule-sm .dct-capsule-btn { padding: 3px 8px; font-size: 11px; }
.dct-capsule-btn {
  border: none;
  background: transparent;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--dsw-alias-label-secondary, inherit);
  border-radius: 9999px;
  cursor: pointer;
  transition: all 0.16s cubic-bezier(0.4, 0, 0.2, 1);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  white-space: nowrap;
  line-height: 1.3;
}
.dct-capsule-btn:hover:not(:disabled) {
  color: var(--dsw-alias-label-primary, inherit);
  background: rgba(127, 127, 127, 0.12);
}
.dct-capsule-btn.selected {
  background: var(--dsw-alias-bg-layer-1, #ffffff);
  color: var(--dsw-alias-label-primary, inherit);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 0 0 1px var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.08));
}
.dct-capsule-btn:disabled { opacity: 0.45; cursor: default; }

/* Interactive Range Slider + Number control */
.dct-slider-control { display: inline-flex; align-items: center; gap: 10px; width: 100%; max-width: 280px; }
.dct-slider {
  flex: 1 1 auto;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.25));
  border-radius: 4px;
  outline: none;
  cursor: pointer;
  transition: background 0.15s ease;
}
.dct-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--dsw-alias-brand-primary, #4078c0);
  border: 2px solid var(--dsw-alias-bg-layer-1, #ffffff);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  cursor: pointer;
  transition: transform 0.12s ease;
}
.dct-slider::-webkit-slider-thumb:hover { transform: scale(1.2); }
.dct-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--dsw-alias-brand-primary, #4078c0);
  border: 2px solid var(--dsw-alias-bg-layer-1, #ffffff);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  cursor: pointer;
}
.dct-slider-input-wrap { display: inline-flex; align-items: center; gap: 4px; }

/* Informative Detail Banner */
.dct-detail-banner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--dsw-alias-label-secondary, inherit);
  background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.08));
  border: 1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.14));
  border-radius: 8px;
}
.dct-detail-icon { font-size: 14px; line-height: 1; flex-shrink: 0; }

/* Preset pills */
.dct-presets-row { display: flex; align-items: center; justify-content: space-between; gap: 8px 12px; padding: 2px 0 6px; flex-wrap: wrap; }
.dct-presets-label { font-size: 12px; color: var(--dsw-alias-label-secondary, inherit); font-weight: 500; }

/* Hidden accessible element (synchronizes native selects/inputs with capsules for test & a11y compatibility) */
.dct-sr-only {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip: rect(0, 0, 0, 0) !important;
  white-space: nowrap !important;
  border: 0 !important;
  pointer-events: none !important;
  opacity: 0 !important;
}

/* Base select and button */
.dct-select {
  max-width: 240px;
  padding: 5px 10px;
  font: inherit;
  font-size: 13px;
  color: var(--dsw-alias-label-primary, inherit);
  background: var(--dsw-alias-bg-layer-2, transparent);
  border: 1px solid var(--dsw-alias-border-l1, currentColor);
  border-radius: 7px;
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.dct-select:hover { border-color: var(--dsw-alias-border-l2, currentColor); }
.dct-select:focus { border-color: var(--dsw-alias-brand-primary, #4078c0); box-shadow: 0 0 0 2px rgba(64, 120, 192, 0.15); }
.dct-button {
  padding: 5px 12px;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  color: var(--dsw-alias-label-primary, inherit);
  background: var(--dsw-alias-bg-layer-2, transparent);
  border: 1px solid var(--dsw-alias-border-l1, currentColor);
  border-radius: 7px;
  cursor: pointer;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.dct-button:hover:not(:disabled) {
  background: var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.15));
  border-color: var(--dsw-alias-border-l2, currentColor);
}
.dct-button:active:not(:disabled) { transform: scale(0.98); }
.dct-button:disabled, .dct-select:disabled { opacity: 0.5; cursor: default; }

.dct-error { margin-top: 6px; font-size: 12px; color: var(--dsw-alias-state-error-primary, #d33); }
.dct-number {
  width: 64px;
  padding: 4px 6px;
  font: inherit;
  font-size: 13px;
  text-align: center;
  color: var(--dsw-alias-label-primary, inherit);
  background: var(--dsw-alias-bg-layer-2, transparent);
  border: 1px solid var(--dsw-alias-border-l1, currentColor);
  border-radius: 7px;
}
.dct-unit { font-size: 12px; color: var(--dsw-alias-label-secondary, inherit); margin: 0 2px 0 1px; align-self: center; }
.dct-sub { margin-top: 2px; align-items: flex-start; }
.dct-sub .dct-wrap .dct-select { max-width: 140px; }
.dct-area {
  width: 100%;
  max-width: 320px;
  min-height: 60px;
  padding: 6px 10px;
  font: inherit;
  font-size: 13px;
  line-height: 1.45;
  color: var(--dsw-alias-label-primary, inherit);
  background: var(--dsw-alias-bg-layer-2, transparent);
  border: 1px solid var(--dsw-alias-border-l1, currentColor);
  border-radius: 8px;
  resize: vertical;
  outline: none;
  transition: border-color 0.15s;
}
.dct-area:focus { border-color: var(--dsw-alias-brand-primary, #4078c0); box-shadow: 0 0 0 2px rgba(64, 120, 192, 0.15); }
.dct-area::placeholder { color: var(--dsw-alias-label-caption, currentColor); opacity: 0.85; }
.dct-sub .dct-wrap .dct-input { width: 130px; }

/* Color pickers */
.dct-color { display: inline-flex; align-items: center; gap: 6px; }
.dct-color-input {
  width: 32px;
  height: 26px;
  padding: 1px;
  background: transparent;
  border: 1px solid var(--dsw-alias-border-l1, currentColor);
  border-radius: 6px;
  cursor: pointer;
}
.dct-color-code { font-size: 11px; color: var(--dsw-alias-label-secondary, inherit); font-family: monospace; }

/* Status Text Live Preview */
.dct-work-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 38px;
  margin: 4px 0 0;
  padding: 10px 14px;
  font-size: 14px;
  background: var(--dsw-alias-bg-layer-2, rgba(0, 0, 0, 0.05));
  border: 1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.18));
  border-radius: 9px;
}
.dct-work-preview > small { margin-left: auto; font-size: 11px; color: var(--dsw-alias-label-secondary, inherit); }
.dct-work-preview-note { font-size: 12px; color: var(--dsw-alias-label-secondary, inherit); }

/* Animated sample band */
.dct-work-effect { position: relative; display: inline-block; white-space: pre; }
.dct-work-sweep {
  position: absolute;
  inset: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-shimmer, currentColor);
  pointer-events: none;
  user-select: none;
  mask-image: linear-gradient(105deg, transparent 0%, black 40% 60%, transparent 100%);
  -webkit-mask-image: linear-gradient(105deg, transparent 0%, black 40% 60%, transparent 100%);
  transform: translateX(-100%);
  animation: dct-work-band 1.5s steps(48, end) infinite;
}
.dct-work-sweep-text {
  display: block;
  width: 100%;
  height: 100%;
  color: inherit;
  transform: translateX(100%);
  animation: dct-work-band-text 1.5s steps(48, end) infinite;
}
@keyframes dct-work-band { 0% { transform: translateX(-100%); } 66.6667%, 100% { transform: translateX(100%); } }
@keyframes dct-work-band-text { 0% { transform: translateX(100%); } 66.6667%, 100% { transform: translateX(-100%); } }
@media (prefers-reduced-motion: reduce) { .dct-work-sweep { display: none; } }

/* Modern toggle switch for injections and checkboxes */
.dct-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  font-size: 13px;
  color: var(--dsw-alias-label-primary, inherit);
}
.dct-toggle input[type="checkbox"] {
  cursor: pointer;
  width: 16px;
  height: 16px;
  accent-color: var(--dsw-alias-brand-primary, #4078c0);
}

/* Update section */
.dct-update-badge { padding: 2px 8px; font-size: 12px; color: var(--dsw-alias-label-primary, inherit); background: var(--dsw-alias-bg-layer-2, transparent); border: 1px solid var(--dsw-alias-border-l1, currentColor); border-radius: 10px; }
.dct-update-section { margin-top: 6px; padding-top: 12px; border-top: 1px solid var(--dsw-alias-border-l1, currentColor); }
.dct-update-section .dct-text { margin-bottom: 8px; }
.dct-update-section .dct-control { justify-content: flex-start; }

/* Background Workbench */
.dct-file { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
.dct-zones { display: grid; grid-template-columns: repeat(auto-fit, minmax(84px, 1fr)); gap: 6px; margin-top: 4px; }
.dct-zone-tab {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 6px 10px;
  font: inherit;
  text-align: left;
  color: var(--dsw-alias-label-secondary, inherit);
  background: var(--dsw-alias-bg-layer-2, transparent);
  border: 1px solid var(--dsw-alias-border-l1, currentColor);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.dct-zone-tab:hover { border-color: var(--dsw-alias-border-l2, currentColor); }
.dct-zone-tab.selected { color: var(--dsw-alias-label-primary, inherit); border-color: var(--dsw-alias-brand-primary, var(--dsw-alias-label-primary, currentColor)); background: var(--dsw-alias-bg-layer-1, rgba(255,255,255,0.06)); font-weight: 500; }
.dct-zone-tab:disabled { opacity: 0.5; cursor: default; }
.dct-zone-tab strong { font-size: 13px; font-weight: 500; }
.dct-zone-tab small { max-width: 100%; overflow: hidden; font-size: 11px; color: var(--dsw-alias-label-caption, inherit); text-overflow: ellipsis; white-space: nowrap; }
.dct-zone-tab.has-image strong::after { content: "●"; margin-left: 5px; font-size: 8px; vertical-align: middle; color: var(--dsw-alias-brand-primary, #4078c0); }

/* Schematic preview */
.dct-schematic {
  position: relative;
  isolation: isolate;
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr) 84px;
  grid-template-rows: 28px minmax(0, 1fr);
  grid-template-areas: "windowbar windowbar windowbar" "sidebar main dock";
  gap: 6px;
  min-height: 154px;
  margin-top: 6px;
  padding: 18px 12px 12px;
  border-radius: 9px;
  background: var(--dsw-alias-bg-layer-2, rgba(0, 0, 0, 0.04));
  border: 1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.15));
}
.dct-schematic button {
  min-width: 0;
  display: grid;
  place-items: center;
  padding: 6px;
  font: inherit;
  font-size: 11px;
  color: var(--dsw-alias-label-secondary, inherit);
  background: var(--dsw-alias-bg-layer-1, transparent);
  border: 1px solid var(--dsw-alias-border-l1, currentColor);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.12s ease;
}
.dct-schematic button:hover { border-color: var(--dsw-alias-border-l2, currentColor); }
.dct-schematic button.selected { color: var(--dsw-alias-label-primary, inherit); border-color: var(--dsw-alias-brand-primary, var(--dsw-alias-label-primary, currentColor)); font-weight: 600; }
.dct-schematic button:disabled { opacity: 0.5; cursor: default; }
.dct-schematic button.has-image::before { content: "●"; margin-right: 4px; font-size: 8px; color: var(--dsw-alias-brand-primary, #4078c0); }
.dct-schematic button.dct-schematic-global {
  position: absolute;
  inset: 0;
  z-index: 0;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: 4px 10px;
  border: 1px dashed var(--dsw-alias-border-l1, currentColor);
  border-radius: 9px;
  background: transparent;
}
.dct-schematic button.dct-schematic-global.selected { color: var(--dsw-alias-label-primary, inherit); border-color: var(--dsw-alias-brand-primary, var(--dsw-alias-label-primary, currentColor)); }
.dct-schematic button.dct-schematic-global.has-image { border-style: solid; }
.dct-schematic button.dct-schematic-global.has-image::before { margin-top: 3px; }
.dct-schematic-windowbar { grid-area: windowbar; z-index: 1; position: relative; }
.dct-schematic-sidebar { grid-area: sidebar; z-index: 1; position: relative; }
.dct-schematic-dock { grid-area: dock; z-index: 1; position: relative; }
.dct-schematic-main { grid-area: main; z-index: 1; position: relative; display: grid; grid-template-rows: minmax(0, 1fr) 28px; gap: 6px; }

${INJECTION_CSS}
${EFFORT_CSS}
`

  module.exports = { PAGE_CSS }
    }

    /** shared/color.cjs */
    bodies["./shared/color.cjs"           ] = function (module, exports, require) {
  /**
   * shared/color.cjs — the colour primitives the hot paths build on.
   *
   * Nothing here may import `effort/math.cjs`: the maths module mixes colours, so
   * reaching back for its `clamp01` would be a cycle. The clamp below is therefore
   * written out, and it is `clamp01` exactly — `!(t > 0) → 0`, else `t > 1 ? 1 : t` —
   * so a NaN or an absent `t` still lands on the ramp's first colour instead of
   * reaching CSS as `rgb(NaN,NaN,NaN)`.
   */
  function mixColor(from, to, t) {
    const k = t > 0 ? (t > 1 ? 1 : t) : 0
    return [
      Math.round(from[0] + (to[0] - from[0]) * k),
      Math.round(from[1] + (to[1] - from[1]) * k),
      Math.round(from[2] + (to[2] - from[2]) * k),
    ]
  }

  /** An `[r, g, b]` triple as CSS. */
  function rgbOf(color) {
    return `rgb(${color[0]},${color[1]},${color[2]})`
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

  module.exports = { mixColor, rgbOf, parseColor, withAlpha }
    }

    /** shared/element.cjs */
    bodies["./shared/element.cjs"         ] = function (module, exports, require) {
  /**
   * shared/element.cjs — the element factory the whole half builds markup with.
   *
   * `h` is React's own element factory, and every component in this half builds its
   * markup with it. The shell seeds `react` into the module loader, so requiring it
   * here costs nothing and needs no install; keeping the pragma in one place is what
   * lets a feature module be a plain file rather than a slice of the entry.
   */
  const React = require('react')

  /** `React.createElement`, under the name the whole half reads it by. */
  const h = React.createElement

  module.exports = { h }
    }

    /** shared/endpoints.cjs */
    bodies["./shared/endpoints.cjs"       ] = function (module, exports, require) {
  /**
   * shared/endpoints.cjs — every URL the half fetches, mirroring the Host half's route.
   */
  const LIST_URL = '/dsh-custom-theme/themes'
  const CSS_URL = (id) => `/dsh-custom-theme/theme/${encodeURIComponent(id)}.css`
  const BACKGROUNDS_URL = '/dsh-custom-theme/backgrounds'
  const BACKGROUND_URL = (name) => `/dsh-custom-theme/background/${encodeURIComponent(name)}`
  const UPDATE_URL = '/dsh-custom-theme/update'
  const UPDATE_CHECK_URL = '/dsh-custom-theme/update/check'
  const UPDATE_APPLY_URL = '/dsh-custom-theme/update/apply'
  const EFFORT_LEVELS_URL = '/dsh-custom-theme/effort-levels'

  module.exports = { LIST_URL, CSS_URL, BACKGROUNDS_URL, BACKGROUND_URL, UPDATE_URL, UPDATE_CHECK_URL, UPDATE_APPLY_URL, EFFORT_LEVELS_URL }
    }

    /** shared/host-api.cjs */
    bodies["./shared/host-api.cjs"        ] = function (module, exports, require) {
  /**
   * shared/host-api.cjs — the three calls into the Host half's route.
   */
  const { BACKGROUNDS_URL, LIST_URL } = require('./endpoints.cjs')

  /**
   * Fetch the theme ids the Host half found in the theme directory.
   * @param signal - Cancels the listing when the plugin is torn down.
   * @returns Theme ids.
   */
  async function listThemes(signal) {
    const response = await fetch(LIST_URL, { signal, cache: 'no-store' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const payload = await response.json()
    return Array.isArray(payload?.themes)
      ? payload.themes.map((theme) => theme.id).filter((id) => typeof id === 'string')
      : []
  }
  /**
   * Names of the images the Host lists.
   * @param signal - Cancels the listing when the plugin is torn down.
   * @returns Image file names in the background directory.
   */
  async function listBackgrounds(signal) {
    const response = await fetch(BACKGROUNDS_URL, { signal, cache: 'no-store' })
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

  module.exports = { listThemes, listBackgrounds, uploadBackground }
    }

    /** shared/keys.cjs */
    bodies["./shared/keys.cjs"            ] = function (module, exports, require) {
  /**
   * shared/keys.cjs — the localStorage keys this half owns.
   */
  const STORAGE_KEY = 'dsh-custom-theme.selected'
  const STORAGE_KEY_BACKGROUNDS = 'dsh-custom-theme.backgrounds'

  module.exports = { STORAGE_KEY, STORAGE_KEY_BACKGROUNDS }
    }

    /** stream-ink/index.cjs */
    bodies["./stream-ink/index.cjs"       ] = function (module, exports, require) {
  /**
   * stream-ink/index.cjs — the streaming ink: the characters that just arrived, ramped in.
   */

  module.exports = function (deps) {
    const { appearanceSettings, ctx } = deps

    const { STREAM_FADE_DURATION_MAX, STREAM_FADE_DURATION_MIN, STREAM_FADE_INK_MAX, STREAM_FADE_INK_MIN } = require('../appearance/constants.cjs')

  const STREAM_INK_HIGHLIGHT_PREFIX = 'dsh-custom-theme-ink-'
  /** Non-prose hosts and inline maths keep their own colours, so they are never inked. */
  const STREAM_INK_SKIP_SELECTOR = 'pre, code, .katex, .math-inline, .math-display'
  /** The turns that are still being written. */
  const STREAM_INK_LIVE_SELECTOR = '[data-streaming="true"], [data-variant="think"][data-state="running"]'
  /**
   * The registered custom property the ramp animates.
   *
   * Registered because an unregistered custom property is a string, and a string has
   * nothing to interpolate between the writing ink and 1. The highlight rule reads it for
   * its alpha, which is what lets the ramp be one CSS animation on the element instead of a
   * timer rewriting the rule thirty times a second.
   */
  const STREAM_INK_PROPERTY = '--dct-stream-ink'
  /**
   * Live ink, one entry per text node the shell is writing into.
   *
   * Per node rather than per turn, so one chunk's ramp runs to its own end instead of being
   * cut off by the next one; a Map rather than a WeakMap, because an entry removes itself
   * once its ramp settles.
   */
  const streamInkNodes = new WeakMap()
  /**
   * The inks with a ramp or a highlight still live, so they can be withdrawn as a set.
   *
   * Kept apart from the baseline above on purpose. A settled ink keeps its place in the
   * baseline — the next chunk has to know where the last one ended, or it would claim the
   * whole text node again and fade the paragraph a second time — while it leaves this set,
   * which is the one a settings change and an unload walk. The baseline is a `WeakMap`, so
   * a node that leaves the transcript takes its entry with it.
   */
  const streamInkLive = new Set()
  /** Text nodes reported since the last frame, so a burst of chunks costs one pass. */
  const streamInkPending = new Set()
  let streamInkQueued = false
  let streamInkSequence = 0
  let streamInkStyle = null

  /** Whether this browser can paint a highlight at all. */
  function streamInkSupported() {
    return typeof CSS !== 'undefined' && CSS !== null && typeof CSS.highlights === 'object' && CSS.highlights !== null
      && typeof Highlight === 'function' && typeof document.createRange === 'function'
  }

  /** The plugin's own stylesheet, holding one rule per live ink. */
  function streamInkStylesheet() {
    if (streamInkStyle === null) {
      streamInkStyle = document.createElement('style')
      streamInkStyle.dataset.plugin = 'dsh-custom-theme'
      streamInkStyle.dataset.role = 'stream-ink'
      document.head.append(streamInkStyle)
      // Registered once, on the first sheet. Registering the same property twice throws, and
      // a property another context already registered is exactly what this wants anyway.
      if (typeof CSS !== 'undefined' && CSS !== null && typeof CSS.registerProperty === 'function') {
        try {
          CSS.registerProperty({ name: STREAM_INK_PROPERTY, syntax: '<number>', inherits: true, initialValue: '1' })
        } catch {
          // Already registered: the ramp uses the registration that exists.
        }
      }
    }
    return streamInkStyle
  }

  /** Whether one text node is prose the shell is still writing into. */
  function streamInkTarget(node) {
    if (node === null || node === undefined || node.nodeType !== 3) return false
    const parent = node.parentElement
    if (parent === null || parent === undefined || typeof parent.closest !== 'function') return false
    if (parent.closest(STREAM_INK_SKIP_SELECTOR) !== null) return false
    return parent.closest(STREAM_INK_LIVE_SELECTOR) !== null
  }

  /**
   * Claim a rule for one ink, once, at the end of the plugin's own sheet.
   *
   * The rule is written once and never touched again: its alpha comes from the custom
   * property the ramp animates, so a chunk costs one animation and no restyling at all.
   * @param state - The ink.
   * @param colour - The prose colour the highlighted characters settle into.
   * @returns Whether the browser gave it a rule.
   */
  function claimStreamInkRule(state, colour) {
    if (state.rule !== null) return true
    const sheet = streamInkStylesheet().sheet
    if (sheet === null || sheet === undefined || typeof sheet.insertRule !== 'function') return false
    streamInkSequence += 1
    state.name = `${STREAM_INK_HIGHLIGHT_PREFIX}${streamInkSequence}`
    try {
      sheet.insertRule(
        `::highlight(${state.name}) { color: rgba(${colour.r}, ${colour.g}, ${colour.b}, var(${STREAM_INK_PROPERTY})) }`,
        sheet.cssRules.length,
      )
      // The rule is taken back out of the sheet instead of from the call's own return value.
      // The spec returns the rule that was inserted; current Chromium returns its index, and
      // the sheet is the one reading that means the same thing on both. It matters beyond
      // tidiness: {@link releaseStreamInk} has to recognise this exact rule to withdraw it,
      // and an index is not something it can recognise later — the rules around it leave all
      // the time — so on a browser that returns one the ink sheet grew by a rule for every
      // chunk ever inked, and every recalculation of the document matched all of them.
      const rules = sheet.cssRules
      state.rule = rules.length === 0 ? null : rules[rules.length - 1]
    } catch {
      return false
    }
    return state.rule !== null
  }

  /**
   * Whether the text an ink is painted over is still where the shell put it.
   *
   * A `Range` whose node left the document paints nothing, so an ink the shell detached
   * mid-ramp is a registry entry, a rule and a timer spent on empty space. `isConnected`
   * is a flag rather than a query, so reading it costs less than the timer it replaces.
   * @param node - The text node an ink is painted over.
   * @returns Whether that text is still in the document.
   */
  function streamInkAttached(node) {
    if (node === null || node === undefined || node.nodeType !== 3) return false
    // A node taken out of its parent keeps no parent element; a node inside a subtree the
    // shell replaced keeps the pointer, but that element is no longer connected. An
    // environment without the flag reads as connected: keeping an ink to its own timer is
    // exactly today's behaviour, while retiring one the reader can still see is not.
    const parent = node.parentElement
    if (parent === null || parent === undefined) return false
    return parent.isConnected !== false
  }

  /**
   * Retire the inks whose text the shell has taken out of the document.
   *
   * The shell detaching a subtree is itself a mutation record, so a frame is already
   * following it: sweeping there costs one flag read per live ink and no pass of its own,
   * and keeps the registry at the size of the ramps that are really running instead of
   * holding a dead entry — and its rule and timer — for the rest of the fade. Only
   * {@link streamInkLive} shrinks; the settled baseline is untouched, so the same node
   * coming back is still inked from where it left off rather than from zero.
   */
  function retireDetachedStreamInk() {
    for (const state of streamInkLive) {
      // Deleting the entry being visited is defined for a Set, so this copies nothing per
      // frame — which matters, because this runs on every one of them.
      if (!streamInkAttached(state.node)) releaseStreamInk(state)
    }
  }

  /** The colour the shell gives that text, as `{ r, g, b }`, or null when it cannot be read. */
  function streamInkColour(element) {
    if (element === null || element === undefined || typeof getComputedStyle !== 'function') return null
    let resolved = ''
    try {
      resolved = getComputedStyle(element).color ?? ''
    } catch {
      return null
    }
    const match = /rgba?\(\s*([0-9.]+)[,\s]+([0-9.]+)[,\s]+([0-9.]+)/u.exec(resolved)
    if (match === null) return null
    return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) }
  }

  /** The reader's motion preference, when the environment has one. */
  function reducedMotion() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch {
      return false
    }
  }

  /** Hand a settled node back to the shell: its ramp, its highlight entry and its rule. */
  function releaseStreamInk(state) {
    if (state.timer !== 0) {
      clearTimeout(state.timer)
      state.timer = 0
    }
    if (state.animation !== null && state.animation !== undefined) {
      state.animation.cancel()
      state.animation = null
    }
    if (state.name !== '' && typeof CSS !== 'undefined' && CSS !== null && CSS.highlights !== null) CSS.highlights.delete(state.name)
    if (state.rule !== null) {
      const sheet = streamInkStylesheet().sheet
      // Walked rather than copied. `[...sheet.cssRules]` built an array as long as every ink
      // still ramping just to find one index, once per release; the list is live, so this
      // pays the same search without the allocation. Deleting by index is the only handle
      // CSSOM offers for a rule it was never handed the position of.
      if (sheet !== null && sheet !== undefined && typeof sheet.deleteRule === 'function') {
        const rules = sheet.cssRules
        for (let step = 0; step < rules.length; step += 1) {
          if (rules[step] === state.rule) {
            sheet.deleteRule(step)
            break
          }
        }
      }
      state.rule = null
    }
    state.range = null
    streamInkLive.delete(state)
  }

  /**
   * Ramp one ink from the writing ink to the text colour.
   *
   * The ramp is one CSS animation of the registered property, started on the element that
   * owns the text node — the element the highlight reads the property from. Nothing here
   * runs per frame, and no stylesheet is touched: a chunk costs one animation and one timer
   * for the release, which leaves the main thread and the style engine to the shell while a
   * reply streams.
   * @param state - The ink.
   * @param element - The element the highlighted text belongs to.
   * @param settings - The fade duration and writing ink in force.
   * @returns Whether a ramp was started.
   */
  function rampStreamInk(state, element, settings) {
    if (element === null || element === undefined || typeof element.animate !== 'function') return false
    const duration = Math.min(STREAM_FADE_DURATION_MAX, Math.max(STREAM_FADE_DURATION_MIN, settings.streamingFadeDuration))
    const ink = Math.min(STREAM_FADE_INK_MAX, Math.max(STREAM_FADE_INK_MIN, settings.streamingFadeInk))
    if (state.animation !== null && state.animation !== undefined) state.animation.cancel()
    if (state.timer !== 0) clearTimeout(state.timer)
    try {
      state.animation = element.animate(
        [{ [STREAM_INK_PROPERTY]: ink }, { [STREAM_INK_PROPERTY]: 1 }],
        { duration, easing: 'cubic-bezier(.25, .2, .35, 1)', fill: 'forwards' },
      )
    } catch {
      // An element the browser refuses to animate: no ink rather than ink stuck faint.
      return false
    }
    state.timer = setTimeout(() => releaseStreamInk(state), duration)
    return true
  }

  /** Claim the characters between two offsets of one text node and start them settling. */
  function paintStreamInk(plan, settings) {
    const { state, node, element, start, end, colour } = plan
    if (colour === null) return
    const range = document.createRange()
    try {
      range.setStart(node, start)
      range.setEnd(node, end)
    } catch {
      // Offsets a concurrent render invalidated: this chunk simply gets no ink.
      return
    }
    if (!claimStreamInkRule(state, colour)) return
    state.range = range
    state.colour = colour
    CSS.highlights.set(state.name, new Highlight(range))
    streamInkLive.add(state)
    if (!rampStreamInk(state, element, settings)) {
      // Nothing to animate, so the highlight would sit at the writing ink forever: hand the
      // characters straight back instead of leaving them faint.
      releaseStreamInk(state)
    }
  }

  /**
   * What one ink will need, read off the node and nothing else.
   *
   * Kept apart from {@link paintStreamInk} because the pass's colour reads and its stylesheet
   * writes must not be interleaved (see {@link tickStreamInk}). This touches no stylesheet and
   * resolves no style, so it is free to run as often as the records name a node.
   * @param node - A text node the observer named.
   * @returns What the pass needs to paint it, or null when it has nothing new to ink.
   */
  function planStreamInk(node) {
    const text = typeof node.nodeValue === 'string' ? node.nodeValue : ''
    let state = streamInkNodes.get(node)
    if (state === undefined) {
      // A node the plugin has not seen before is one the shell has just written, so all of
      // it is new — which is why the baseline starts at zero rather than at its length.
      state = { node, name: '', rule: null, seen: 0, range: null, timer: 0, animation: null, colour: null }
      streamInkNodes.set(node, state)
    }
    if (text.length <= state.seen) return null
    const start = state.seen
    // Advanced here, exactly as the ink has always advanced it: a chunk whose paint fails —
    // a colour that cannot be read, offsets a render invalidated — is given up rather than
    // retried on every frame for the rest of the stream.
    state.seen = text.length
    return { state, node, element: node.parentElement ?? null, start, end: text.length, colour: null }
  }

  /**
   * Resolve the prose colour of every ink this pass will start.
   *
   * The answer is kept per element rather than per node, so a paragraph the shell writes
   * several text nodes into is priced once: the highlight a text node inherits is the
   * element's own computed colour, and siblings share it.
   * @param planned - The plans from {@link planStreamInk}, in the order they were planned.
   */
  function resolveStreamInkColours(planned) {
    const colours = new Map()
    for (const plan of planned) {
      const element = plan.element
      if (colours.has(element)) {
        plan.colour = colours.get(element)
        continue
      }
      const colour = streamInkColour(element)
      colours.set(element, colour)
      plan.colour = colour
    }
  }

  /** Withdraw every live ink: the fade is off, or the plugin is unloading. */
  function clearStreamInk() {
    for (const state of [...streamInkLive]) releaseStreamInk(state)
    streamInkPending.clear()
  }

  /**
   * Ink the characters the shell has just written.
   *
   * The observer hands over the text nodes its records named, so this never has to ask the
   * document where the streaming turns are. The same pass also retires the inks whose text
   * the shell has taken away, because a detach is one of those records. An appearance change
   * calls it with nothing: with the writing ink at 100% there is nothing to paint and
   * everything live is withdrawn, which is what turning the fade off means.
   *
   * The pass runs in two phases, and the order is the whole point. Writing a rule into the
   * sheet invalidates style, and the *next* colour read then resolves it — which, because a
   * newly inserted rule can match anything, means recalculating the whole document. Reading a
   * colour, claiming its rule and reading the next one therefore costs one full recalculation
   * per inked node: at the 190 text nodes a dense reply can name in a single frame, on a
   * transcript of 7 000 elements, that was tens of seconds of frozen main thread in one call
   * (measured in the shell: `tickStreamInk` at 5.63s, with the style recalculation covering
   * 71-87% of a 5.9-6.7s stall, and the connection dropped 12ms after one of them began).
   * So every colour this pass needs is resolved first — reads only, one recalculation, the one
   * the frame was going to pay anyway — and only then is a rule claimed for each of them.
   * @param nodes - Text nodes seen since the last frame; empty for a settings change.
   */
  function tickStreamInk(nodes = []) {
    if (typeof document === 'undefined' || !streamInkSupported()) return
    const settings = appearanceSettings()
    if (settings === null || settings === undefined || settings.streamingFadeInk >= STREAM_FADE_INK_MAX) {
      clearStreamInk()
      return
    }
    if (reducedMotion()) {
      clearStreamInk()
      return
    }
    // What the shell detached is retired on this same pass, before what it wrote is inked:
    // a node that left takes its registry slot, its rule and its timer with it, rather than
    // holding all three until the fade would have ended.
    retireDetachedStreamInk()
    const planned = []
    for (const node of nodes) {
      if (!streamInkTarget(node)) continue
      const plan = planStreamInk(node)
      if (plan !== null) planned.push(plan)
    }
    // Phase one: every read. Phase two: every write.
    resolveStreamInkColours(planned)
    for (const plan of planned) paintStreamInk(plan, settings)
  }

  /**
   * Queue text nodes for the next frame.
   *
   * A streaming reply can write hundreds of times a second. Coalescing those into one pass
   * per frame is what keeps the ink from competing with the shell for the main thread — and
   * the shell's own deferred work, such as rendering the maths in a long reply, is exactly
   * what a per-character pass would starve.
   * @param nodes - Text nodes to look at.
   */
  function scheduleStreamInk(nodes) {
    for (const node of nodes) streamInkPending.add(node)
    if (streamInkQueued) return
    streamInkQueued = true
    const run = () => {
      streamInkQueued = false
      const batch = [...streamInkPending]
      streamInkPending.clear()
      tickStreamInk(batch)
    }
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(run)
    else run()
  }

  /**
   * The text nodes a batch of mutation records wrote into.
   *
   * Read off the records rather than by asking the document, which is what makes the ink
   * affordable on a fast stream: a record names the node that changed.
   * @param records - Mutation records, or nothing when a caller triggers the observer bare.
   * @returns Nodes to consider, possibly empty.
   */
  function streamInkTargets(records) {
    const nodes = []
    if (!Array.isArray(records)) return nodes
    for (const record of records) {
      if (record === null || record === undefined) continue
      if (record.type === 'characterData') {
        nodes.push(record.target)
        continue
      }
      const added = record.addedNodes
      if (added === null || added === undefined) continue
      for (const node of added) nodes.push(node)
    }
    return nodes
  }

  /**
   * Drop every live highlight and the rule that paints them, for teardown: the
   * ranges point at nodes React owns, and the sheet is this plugin's own.
   */
  function disposeInkStyle() {
    clearStreamInk()
    if (streamInkStyle !== null) {
      streamInkStyle.remove()
      streamInkStyle = null
    }
  }

    // The sheet is created by the first apply, so it is read through a call rather than handed out as
    // a value: a snapshot here would still be the `null` from before that apply.
    return { clearStreamInk, disposeInkStyle, tickStreamInk, scheduleStreamInk, streamInkTargets, streamInkStyle: () => streamInkStyle }
  }
    }

    /** theme/overrides.cjs */
    bodies["./theme/overrides.cjs"        ] = function (module, exports, require) {
  /**
   * theme/overrides.cjs — a theme stylesheet applied as an override layer.
   */

  module.exports = function (deps) {
    const { ctx, signal, style } = deps

    const { CSS_URL } = require('../shared/endpoints.cjs')
    const { writeSaved } = require('./selection.cjs')

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
    style.textContent = ''
    if (id === '') return true
    const response = await fetch(CSS_URL(id), { signal, cache: 'no-store' })
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
    style.textContent = extractNonTokenRules(css)
    return true
  }

    // Read through the binding rather than handing out its value: the disposer is installed by the
    // first apply, long after this object is built, so a snapshot here would be the no-op it replaced.
    return { applyTheme, syncSelection, themeChangeListeners, releaseOverrides: () => releaseOverrides() }
  }
    }

    /** theme/selection.cjs */
    bodies["./theme/selection.cjs"        ] = function (module, exports, require) {
  /**
   * theme/selection.cjs — the selected theme id, as remembered between sessions.
   */
  const { STORAGE_KEY } = require('../shared/keys.cjs')

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

  module.exports = { readSaved, writeSaved }
    }

    /** update/client.cjs */
    bodies["./update/client.cjs"          ] = function (module, exports, require) {
  /**
   * update/client.cjs — the update snapshot: one shared check, its cache and the two actions.
   */
  const { UPDATE_APPLY_URL, UPDATE_CHECK_URL, UPDATE_URL } = require('../shared/endpoints.cjs')
  const React = require('react')

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

  module.exports = { importFailureFor, importMessage, PLUGIN_PACKAGE, publishUpdate, readUpdate, loadUpdate, applyUpdateNow, useUpdate }
    }

    /** update/rows.cjs */
    bodies["./update/rows.cjs"            ] = function (module, exports, require) {
  /**
   * update/rows.cjs — the update rows on the plugin manager's page, and the hint under them.
   */
  const { PLUGIN_PACKAGE, applyUpdateNow, loadUpdate, useUpdate } = require('./client.cjs')
  const { h } = require('../shared/element.cjs')

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

  module.exports = { updateText, canUpgrade, UpdateRow, isOwnBundle, PluginUpdateBadge, PluginUpdateAction, PluginUpdateSection }
    }

    /** working/constants.cjs */
    bodies["./working/constants.cjs"      ] = function (module, exports, require) {
  /**
   * working/constants.cjs — the working-text model: effects, intervals, shimmer styles and colours.
   */
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

  module.exports = { WORKING_KEY, WORKING_MAX_TEXTS, WORKING_MAX_LENGTH, WORKING_INTERVALS, WORKING_INTERVAL_DEFAULT, WORKING_EFFECTS, WORKING_EFFECT_LABELS, WORKING_SHIMMER_STYLES, WORKING_SHIMMER_LABELS, WORKING_EFFECT_DEFAULT, WORKING_SHIMMER_DEFAULT, WORKING_COLOR_DEFAULT, WORKING_SWEEP_DEFAULT, WORKING_HEX, normalizeWorkingTexts, readWorkingColor, readSavedWorking, RUNNING_LABEL_KEY, PHRASE_STREAK_GAP, WORKING_BAR, WORKING_BAND, WORKING_BAND_TEXT, WORKING_SPECTRUM, workingEffectCss }
    }

    /** working/index.cjs */
    bodies["./working/index.cjs"          ] = function (module, exports, require) {
  /**
   * working/index.cjs — the running phrase: rotation, streak resets and the settings behind them.
   */

  module.exports = function (deps) {
    const { ctx } = deps

    const { PHRASE_STREAK_GAP, WORKING_KEY, normalizeWorkingTexts, readSavedWorking } = require('./constants.cjs')

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

  /** Wall clock of the first read of the current label streak. */
  let phraseStreakStart = 0
  /** Wall clock of the most recent read. */
  let phraseLastRead = 0
  /** Wall clock the cached phrase belongs to, and the phrase itself. */
  let phraseAt = 0
  let phraseText = ''
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
   * Point the running label's own rewrite at the seat that keeps it in step with
   * the phrase the indicator is about to draw.
   * @param sync - Called after every settings change.
   */
  function setRunningLabelSync(sync) {
    runningLabelSync = sync
  }

  /** The choices in force, re-read on every settings change. */
  function settings() {
    return workingSettings
  }

    // The settings in force are read through `settings()`: they are replaced on every settings
    // change, so handing the value out here would freeze the choices the module booted with.
    return {
      setWorkingSettings,
      setRunningLabelSync,
      currentPhrase,
      settings,
    }
  }
    }

    /** working/label.cjs */
    bodies["./working/label.cjs"          ] = function (module, exports, require) {
  /**
   * working/label.cjs — the shell's own running label, reworded through its locale lookup.
   */

  module.exports = function (deps) {
    const { ctx, currentPhrase } = deps

    const { RUNNING_LABEL_KEY } = require('./constants.cjs')

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

    return { installRunningLabel }
  }
    }

    return load("./index.cjs", '<entry>')
  },
})
