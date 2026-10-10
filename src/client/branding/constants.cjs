/**
 * branding/constants.cjs — the two customizable regions, the fields, and the sheet they emit.
 *
 * Everything here is pure: what a stored choice may contain, what the shipped
 * state is, and the stylesheet text one set of choices produces.
 */

/**
 * Longest custom wording accepted, in characters.
 *
 * The two regions this feature touches are a wordmark and a headline; a value
 * longer than this is a paste accident, and the row would draw it as one clipped
 * line either way.
 */
const TEXT_MAX = 200

/** Longest image address accepted, in characters — a data URL included. */
const URL_MAX = 2048

/** Longest custom stylesheet accepted, per box, in characters. */
const CSS_MAX = 20000

/**
 * The shipped state: every field empty, which leaves each surface exactly as the
 * shell draws it. An empty field is also how a row asks for the shell's own
 * occupant back, so there is no separate "enabled" switch to keep in step.
 */
const BRANDING_DEFAULTS = {
  brandName: '',
  brandMark: '',
  heroHeadline: '',
  heroBadge: '',
  heroMark: '',
  cssBrand: '',
  cssHero: '',
  cssGlobal: '',
}

/** The fields of a stored choice, each with the cap it is held to. */
const BRANDING_FIELDS = {
  brandName: TEXT_MAX,
  brandMark: URL_MAX,
  heroHeadline: TEXT_MAX,
  heroBadge: TEXT_MAX,
  heroMark: URL_MAX,
  cssBrand: CSS_MAX,
  cssHero: CSS_MAX,
  cssGlobal: CSS_MAX,
}

/**
 * The regions a stylesheet can name, and the shell element each one resolves to.
 *
 * The shell's class names are CSS-module hashes (`_2H3hWW_brandIdentity`), so each
 * pattern matches the author-chosen suffix instead of a build-specific hash — the
 * same trade the background zones make. One rule holds the element the user
 * highlighted: the brand block beside the collapse control, and the hero headline row
 * with the preview badge inside it.
 *
 * The hero row is reached *from* its badge rather than by a class of its own. The
 * conversation bundle carries a second `_headline` — the context meter's popup — and
 * a rule that landed on that one instead would dress an element the user never meant.
 * The badge is rendered unconditionally inside the row, so walking up from it is both
 * simpler and narrower than matching a name two elements share.
 *
 * These are stamped as attributes rather than used as selectors: `data-dct-brand`
 * survives a shell rebuild that renames the hash, and a rule the user wrote against
 * it keeps working. A rename in a later shell build only leaves the hook unstamped.
 */
const REGIONS = [
  { id: 'brand', attribute: 'data-dct-brand', selector: '[class*="_brandIdentity"]' },
  { id: 'heroBadge', attribute: 'data-dct-hero-badge', selector: '[class*="_previewBadge"]' },
  { id: 'hero', attribute: 'data-dct-hero', selector: '[class*="_previewBadge"]', ascendTo: '[class*="_headline"]' },
]

/**
 * The element that reports which view the conversation is showing.
 *
 * The hero exists only while that element says so, and the attribute is what makes
 * the region pass affordable: while a session is streaming, a pass reads this one
 * attribute instead of asking the document for a headline that is not there.
 */
const PHASE_SELECTOR = '[data-phase]'

/** The phrase the phase element carries while the empty-session hero is up. */
const HERO_PHASE = 'hero'

/**
 * The rules the parts this plugin renders need of their own.
 *
 * The shell's seat supplies the type: the sidebar name sits inside the shell's own
 * `brandName` span and the hero mark inside its `headline` row, so only what those
 * rows do not already say is declared here — an image that keeps its ratio, and a
 * name long enough to need clipping.
 */
const BRANDING_BASE_CSS = `.dct-brand-text {
  letter-spacing: 0.04em;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.dct-brand-img,
.dct-hero-img {
  display: block;
  object-fit: contain;
}`

/**
 * One stored value, as a string held to its cap.
 *
 * Whitespace is kept as written, because the card edits these strings one keystroke
 * at a time: a value trimmed on the way through would swallow the space between two
 * words as the user types it. A value that is nothing but whitespace is the empty
 * value, which is how the card asks for the shell's own surface back.
 * @param value - Whatever the store held for the field.
 * @param cap - Longest value accepted.
 * @returns The field's value, empty when the store held something else.
 */
function brandingField(value, cap) {
  if (typeof value !== 'string' || value.trim() === '') return ''
  return value.length > cap ? value.slice(0, cap) : value
}

/**
 * The stored form of a candidate choice: every field a string, each held to its cap.
 * @param raw - The parsed entry, or anything else the store held.
 * @returns A complete choice set.
 */
function normalizeBranding(raw) {
  const source = raw !== null && typeof raw === 'object' ? raw : {}
  const next = {}
  for (const field of Object.keys(BRANDING_FIELDS)) next[field] = brandingField(source[field], BRANDING_FIELDS[field])
  return next
}

/** Whether a choice set asks for anything at all. */
function brandingIsDefault(settings) {
  return Object.keys(BRANDING_FIELDS).every((field) => settings[field] === '')
}

/**
 * One labelled block of the sheet, or nothing when its box is empty.
 * @param label - Where the block's rules land, for the reader of the sheet.
 * @param text - The rules the user wrote.
 * @returns The block, ready to concatenate.
 */
function cssBlock(label, text) {
  return text === '' ? '' : `/* ${label} */\n${text}`
}

/**
 * The stylesheet one choice set produces.
 *
 * The three boxes are emitted verbatim and in a fixed order — the two regions, then
 * the page — so a rule may address a region directly, address the hook stamped on
 * it, or reach anything else in the shell. Nothing is scoped on the user's behalf:
 * a stylesheet that only wanted one region can name it, and one that wants to move
 * the composer can do that too.
 * @param settings - A choice set from {@link normalizeBranding}.
 * @returns The sheet's text.
 */
function brandingCss(settings) {
  return [
    BRANDING_BASE_CSS,
    cssBlock('dsh-custom-theme / sidebar brand', settings.cssBrand),
    cssBlock('dsh-custom-theme / hero', settings.cssHero),
    cssBlock('dsh-custom-theme / page', settings.cssGlobal),
  ].filter((block) => block !== '').join('\n')
}

module.exports = {
  TEXT_MAX,
  URL_MAX,
  CSS_MAX,
  BRANDING_DEFAULTS,
  BRANDING_FIELDS,
  REGIONS,
  PHASE_SELECTOR,
  HERO_PHASE,
  BRANDING_BASE_CSS,
  brandingField,
  normalizeBranding,
  brandingIsDefault,
  brandingCss,
}
