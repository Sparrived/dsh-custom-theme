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
