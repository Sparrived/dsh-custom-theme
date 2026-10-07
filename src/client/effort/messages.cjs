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
