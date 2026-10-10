/**
 * branding/row.cjs — the settings rows: what each region is replaced with, and its CSS.
 */
const React = require('react')

const { h } = require('../shared/element.cjs')
const { CSS_MAX, TEXT_MAX, URL_MAX } = require('./constants.cjs')

/**
 * One labelled control of the card.
 * @param props - The wording, the value, and the change seat; `lines` above zero asks
 *   for a multi-line box, which is what the three stylesheets are edited in.
 * @returns The row.
 */
function field(props) {
  const { id, title, hint, placeholder, value, maxLength, onChange, lines = 0 } = props
  const common = {
    className: lines > 0 ? `dct-area ${id}` : `dct-field ${id}`,
    value,
    maxLength,
    placeholder,
    'aria-label': title,
    spellCheck: false,
    onChange: (event) => onChange(event.target.value),
  }
  return h('div', { className: 'dct-row dct-sub' },
    h('div', { className: 'dct-text' },
      h('div', { className: 'dct-title' }, title),
      h('div', { className: 'dct-hint' }, hint)),
    h('div', { className: 'dct-control' },
      lines > 0
        ? h('textarea', { ...common, rows: lines })
        : h('input', { ...common, type: 'text' })))
}

/**
 * The branding card's body.
 *
 * Every control is a text box over one choice, and every choice applies as it is
 * typed: there is no save button, and clearing a box is how the shell's own wording,
 * mark or stylesheet comes back. The three stylesheet boxes are the escape hatch for
 * everything these rows do not name — hiding a region, moving it, animating it — and
 * they are injected as written, so the row's own hint only has to say what can be
 * named, not what may be written.
 * @param props - `t` (the page's translate seat), `value` (the choices in force) and
 *   `apply` (the seat the card calls with the whole choice set).
 * @returns The card body.
 */
function BrandingRow({ t, value, apply }) {
  const set = (patch) => apply({ ...value, ...patch })
  return h('div', { className: 'dct-branding' },
    field({
      id: 'dct-brand-name',
      title: t('brandNameTitle'),
      hint: t('brandNameHint'),
      placeholder: t('brandNamePlaceholder'),
      value: value.brandName,
      maxLength: TEXT_MAX,
      onChange: (brandName) => set({ brandName }),
    }),
    field({
      id: 'dct-brand-mark',
      title: t('brandMarkTitle'),
      hint: t('brandMarkHint'),
      placeholder: t('brandMarkPlaceholder'),
      value: value.brandMark,
      maxLength: URL_MAX,
      onChange: (brandMark) => set({ brandMark }),
    }),
    field({
      id: 'dct-hero-headline',
      title: t('heroHeadlineTitle'),
      hint: t('heroHeadlineHint'),
      placeholder: t('heroHeadlinePlaceholder'),
      value: value.heroHeadline,
      maxLength: TEXT_MAX,
      onChange: (heroHeadline) => set({ heroHeadline }),
    }),
    field({
      id: 'dct-hero-badge',
      title: t('heroBadgeTitle'),
      hint: t('heroBadgeHint'),
      placeholder: t('heroBadgePlaceholder'),
      value: value.heroBadge,
      maxLength: TEXT_MAX,
      onChange: (heroBadge) => set({ heroBadge }),
    }),
    field({
      id: 'dct-hero-mark',
      title: t('heroMarkTitle'),
      hint: t('heroMarkHint'),
      placeholder: t('heroMarkPlaceholder'),
      value: value.heroMark,
      maxLength: URL_MAX,
      onChange: (heroMark) => set({ heroMark }),
    }),
    field({
      id: 'dct-css-brand',
      title: t('cssBrandTitle'),
      hint: t('cssBrandHint'),
      placeholder: t('cssPlaceholder'),
      value: value.cssBrand,
      maxLength: CSS_MAX,
      lines: 4,
      onChange: (cssBrand) => set({ cssBrand }),
    }),
    field({
      id: 'dct-css-hero',
      title: t('cssHeroTitle'),
      hint: t('cssHeroHint'),
      placeholder: t('cssPlaceholder'),
      value: value.cssHero,
      maxLength: CSS_MAX,
      lines: 4,
      onChange: (cssHero) => set({ cssHero }),
    }),
    field({
      id: 'dct-css-global',
      title: t('cssGlobalTitle'),
      hint: t('cssGlobalHint'),
      placeholder: t('cssPlaceholder'),
      value: value.cssGlobal,
      maxLength: CSS_MAX,
      lines: 6,
      onChange: (cssGlobal) => set({ cssGlobal }),
    }),
    h('div', { className: 'dct-detail-banner' },
      h('span', { className: 'dct-detail-icon', 'aria-hidden': true }, '💡'),
      h('span', null, t('brandHooksHint'))))
}

module.exports = { BrandingRow }
