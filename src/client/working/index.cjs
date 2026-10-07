/**
 * working/index.cjs — the running phrase: rotation, streak resets and the settings behind them.
 */

module.exports = function (deps) {
  const { ctx } = deps

  const { PHRASE_STREAK_GAP, WORKING_KEY, normalizeWorkingTexts, readSavedWorking } = require('./constants.cjs')

let workingSettings = readSavedWorking()
/** Set by `apply` to re-point the running label as phrases come and go. */
let runningLabelSync = null

/** Persist the working-indicator choices and re-point the running label. */
function setWorkingSettings(next) {
  // Normalize on the way in, so what is written is what the reader would have
  // accepted anyway: an emptied box stores no phrases rather than one empty one.
  localStorage.setItem(WORKING_KEY, JSON.stringify({
    texts: normalizeWorkingTexts(next.texts),
    interval: next.interval,
    effect: next.effect,
    shimmer: next.shimmer,
    color: next.color,
    sweep: next.sweep,
  }))
  // Re-read rather than trust the caller, so the stored and live values share
  // one normalization path and cannot drift apart.
  workingSettings = readSavedWorking()
  if (runningLabelSync !== null) runningLabelSync()
}

/** Wall clock of the first read of the current label streak. */
let phraseStreakStart = 0
/** Wall clock of the most recent read. */
let phraseLastRead = 0
/** Wall clock the cached phrase belongs to, and the phrase itself. */
let phraseAt = 0
let phraseText = ''
function currentPhrase() {
  const texts = workingSettings.texts
  if (texts.length === 0) return ''
  const now = Date.now()
  // One render reads the label twice — the row and the announcement that mirrors
  // it — so the millisecond they share resolves to one phrase.
  if (now === phraseAt) return phraseText
  if (now - phraseLastRead > PHRASE_STREAK_GAP) phraseStreakStart = now
  phraseLastRead = now
  phraseAt = now
  phraseText = texts.length === 1
    ? texts[0]
    : texts[Math.floor((now - phraseStreakStart) / workingSettings.interval) % texts.length]
  return phraseText
}

/**
 * Point the running label's own rewrite at the seat that keeps it in step with
 * the phrase the indicator is about to draw.
 * @param sync - Called after every settings change.
 */
function setRunningLabelSync(sync) {
  runningLabelSync = sync
}

/** The choices in force, re-read on every settings change. */
function settings() {
  return workingSettings
}

  // The settings in force are read through `settings()`: they are replaced on every settings
  // change, so handing the value out here would freeze the choices the module booted with.
  return {
    setWorkingSettings,
    setRunningLabelSync,
    currentPhrase,
    settings,
  }
}
