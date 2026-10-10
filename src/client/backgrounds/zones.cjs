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
  // The window bar is the shell's conversation header — a real `<header>`, the one carrying
  // the session's title, its tabs and its header actions — and the shell renders the
  // popovers those actions open inside it: the background-jobs list carries `z-index: 100`,
  // and every element between it and the root is left unstacked, so it floats over the
  // conversation by escaping to the root stacking context. A surface that becomes a stacking
  // context traps it under the conversation's own positioned content, which is how the jobs
  // panel ends up behind the transcript.
  //
  // `flat` is how this zone keeps its picture without that context: the picture rides on the
  // element's own background instead of a `::before` layer, and a background is painted under
  // its element's content by definition, so nothing has to be isolated. Two things follow.
  // The whole-window picture is not spread onto this zone at all — the header is transparent,
  // so the conversation column behind it already shows that picture at the strength and blur
  // the user asked for, and a second copy here would be the one sharp picture in a blurred
  // window. And a picture chosen for the bar alone cannot carry the zone's blur, because a
  // background layer has no filter of its own.
  { id: 'windowbar', labelKey: 'zoneWindowbar', selector: 'header', flat: true },
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
