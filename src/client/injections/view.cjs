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
