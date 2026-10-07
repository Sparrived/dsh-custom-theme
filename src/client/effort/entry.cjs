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
