/**
 * injections/model.cjs — reading a logged message as an injected-context row, or as nothing.
 */
const { INJECTION_FORMS, INJECTION_TEXT_LIMIT } = require('./constants.cjs')

/** The text a logged message carries, as one block. */
function injectionText(content) {
  return (Array.isArray(content) ? content : [])
    .filter((block) => block !== null && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n\n')
    .slice(0, INJECTION_TEXT_LIMIT)
}

/** One field collected from a source's object list, joined, or null when it has none. */
function injectionNames(source, member, field) {
  const list = source[member]
  if (!Array.isArray(list)) return null
  const seen = []
  for (const entry of list) {
    const value = entry !== null && typeof entry === 'object' && typeof entry[field] === 'string' && entry[field] !== '' ? entry[field] : null
    if (value !== null && !seen.includes(value)) seen.push(value)
  }
  return seen.length > 0 ? seen.join(', ') : null
}

/**
 * The role and producer label a durable source names, as the shell classifies them.
 *
 * The producers the shell dresses are read the same way here — a recall cites the
 * sessions it pulled in, an instruction injection the files it changed, a skill its
 * name — and every other source falls back to its own kind, which is the shell's own
 * fallback.
 */
function injectionProducer(source) {
  const record = source !== null && typeof source === 'object' ? source : null
  const kind = record !== null && typeof record.kind === 'string' && record.kind !== '' ? record.kind : null
  if (kind === null) return { role: 'inject', label: null }
  if (kind === 'session-reference') return { role: 'recall', label: injectionNames(record, 'references', 'label') ?? kind }
  if (kind === 'agent-instructions') return { role: 'inject', label: injectionNames(record, 'changes', 'path') ?? kind }
  if (kind === 'skill-invocation') return { role: 'inject', label: typeof record.name === 'string' && record.name !== '' ? record.name : kind }
  return { role: 'inject', label: kind }
}

/** The shell's presentation form for a source, when it is one the shell knows. */
function injectionForm(source) {
  const form = source !== null && typeof source === 'object' && typeof source.form === 'string' ? source.form : null
  return form !== null && INJECTION_FORMS.includes(form) ? form : null
}

/** Whether the shell draws this injected message as its own waking notification. */
function injectionIsWaking(match, reader) {
  const event = match === undefined || match === null ? undefined : match.event
  if (event === undefined || event.type !== 'user/message') return false
  const id = String(event.data?.id ?? '')
  const nextTurn = reader.previous('inbox-next-turn')?.state
  const nextStep = reader.previous('inbox-next-step')?.state
  const claimed = (state) => state !== undefined && state !== null && typeof state.currentClaimed?.has === 'function' && state.currentClaimed.has(id)
  if (claimed(nextTurn)) return true
  // The shell's idle-steer case: a claimed message that woke a Turn which had already
  // begun, at its first step, with no human message claimed by the same claim.
  const location = match.location
  if (location === undefined || location.kind !== 'step' || location.step?.step !== 1) return false
  const turnStart = location.turn?.start?.seq
  if (turnStart === undefined) return false
  return (nextStep?.claimSeq ?? -1) > turnStart
    && (nextTurn?.claimSeq ?? -1) < turnStart
    && nextStep?.claimedHuman === false
    && claimed(nextStep)
}

/** One injected message's row state, as the renderer reads it. */
function injectionState(match, reader) {
  const event = match.event
  const message = event.type === 'developer/message' ? event.data?.message : event.data
  const record = message !== null && typeof message === 'object' ? message : {}
  const content = Array.isArray(record.content) ? record.content : []
  return {
    seq: event.seq,
    time: event.time,
    content,
    source: record.source ?? null,
    producer: injectionProducer(record.source),
    form: injectionForm(record.source),
    waking: injectionIsWaking(match, reader),
    text: injectionText(content),
  }
}

module.exports = { injectionText, injectionNames, injectionProducer, injectionForm, injectionIsWaking, injectionState }
