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
