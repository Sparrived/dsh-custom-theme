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
