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

module.exports = { effortErrorText, effortMessage, effortLevelsRow }
