/**
 * heatmap/model.cjs — the start-page usage heatmap's arithmetic.
 *
 * The panel has one source: the shell's session list. Every listed row carries
 * its durable `tokenUsage` projection, the `sessionListMetadata` projection that
 * says when the user last prompted, and the model-selection projection. The list
 * is a snapshot, so the whole panel can be derived without a Host route or a
 * second scan of the session logs.
 *
 * A session can span days, but the list only knows the day of its last prompt.
 * Its whole token total is therefore bucketed onto that day: the panel says so
 * in its footnote rather than pretending to know the split.
 */

/** Weeks a heat grid covers, running back from today. */
const HEATMAP_WEEKS = 26
/** Heat steps above zero; the empty cell is level 0. */
const HEATMAP_STEPS = 4
/** Ranges the stats cells can be narrowed to. */
const HEATMAP_RANGES = ['all', '30d', '7d']
/** Calendar days a range keeps; all time has no lower bound. */
const HEATMAP_RANGE_DAYS = { all: 0, '30d': 30, '7d': 7 }

/** Narrow one stored range id to a value the panel knows. */
function normalizeRange(value) {
  return HEATMAP_RANGES.includes(value) ? value : 'all'
}

/** Local calendar day as `YYYY-MM-DD`, the unit the heat grid is keyed by. */
function dayKey(date) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Midnight of the day `date` falls on, in the page's own time zone. */
function startOfDay(date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

/** A finite non-negative number, or zero. */
function numberOrZero(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

/** A finite timestamp in milliseconds, or zero. */
function timeOrZero(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

/** The four buckets one token-usage projection carries, added up. */
function tokenTotal(usage) {
  if (usage === null || typeof usage !== 'object') return 0
  return numberOrZero(usage.uncachedInputTokens)
    + numberOrZero(usage.outputTokens)
    + numberOrZero(usage.cacheReadTokens)
    + numberOrZero(usage.cacheWriteTokens)
}

/**
 * The main sessions in one list snapshot, with the fields the panel reads.
 *
 * Blank drafts and subagent rows are left out: neither is a conversation the
 * start page should count, and the list mirrors subagents back into `byId` for
 * the sidebar's own tree.
 */
function listedSessions(snapshot) {
  if (snapshot === null || typeof snapshot !== 'object') return []
  const byId = snapshot.byId
  if (byId === null || typeof byId !== 'object') return []
  const ids = Array.isArray(snapshot.ids) ? snapshot.ids : Object.keys(byId)
  const rows = []
  for (const id of ids) {
    const row = byId[id]
    if (row === null || typeof row !== 'object') continue
    if (row.blank === true || row.origin === 'subagent') continue
    const values = row.projectionValues ?? row.projections?.values ?? {}
    const metadata = values.sessionListMetadata ?? {}
    const selection = values.modelSelection ?? {}
    const model = selection.lastUsed?.model ?? selection.next?.model ?? null
    rows.push({
      id: String(row.id ?? id),
      tokens: tokenTotal(values.tokenUsage),
      lastAt: timeOrZero(metadata.lastPromptAt) || timeOrZero(row.updatedAt),
      model: typeof model === 'string' && model !== '' ? model : null,
    })
  }
  return rows
}

/** The rows whose last prompt falls inside one range window. */
function rowsInRange(rows, range, now) {
  const days = HEATMAP_RANGE_DAYS[normalizeRange(range)]
  if (days === 0) return rows
  const start = startOfDay(now)
  start.setDate(start.getDate() - (days - 1))
  return rows.filter((row) => row.lastAt >= start.getTime())
}

/** The most frequent value of `pick`, with the smallest value breaking a tie. */
function mostFrequent(rows, pick) {
  const counts = new Map()
  for (const row of rows) {
    const value = pick(row)
    if (value === null || value === undefined || value === '') continue
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  let best = null
  let bestCount = 0
  for (const [value, count] of counts) {
    const tieBreak = best !== null && (typeof value === 'number' && typeof best === 'number'
      ? value < best
      : String(value) < String(best))
    if (count > bestCount || (count === bestCount && tieBreak)) {
      best = value
      bestCount = count
    }
  }
  return best
}

/**
 * One cell per day, weeks as columns, Sunday first, running back far enough to
 * hold at least `HEATMAP_WEEKS` full weeks. Days with no session are level 0.
 */
function heatGrid(rows, now = new Date()) {
  const totals = new Map()
  for (const row of rows) {
    if (row.lastAt === 0) continue
    const key = dayKey(new Date(row.lastAt))
    totals.set(key, (totals.get(key) ?? 0) + row.tokens)
  }

  const today = startOfDay(now)
  const start = new Date(today)
  start.setDate(start.getDate() - (HEATMAP_WEEKS * 7 - 1))
  start.setDate(start.getDate() - start.getDay())

  const cells = []
  let peak = 0
  for (const cursor = new Date(start); cursor <= today; cursor.setDate(cursor.getDate() + 1)) {
    const key = dayKey(cursor)
    const tokens = totals.get(key) ?? 0
    if (tokens > peak) peak = tokens
    cells.push({ date: key, tokens, level: 0 })
  }
  for (const cell of cells) {
    if (cell.tokens === 0 || peak === 0) continue
    cell.level = Math.max(1, Math.min(HEATMAP_STEPS, Math.ceil(cell.tokens / peak * HEATMAP_STEPS)))
  }
  return { cells, peak, activeDays: cells.filter((cell) => cell.tokens > 0).length }
}

/**
 * Everything the panel draws for one list snapshot and range.
 *
 * `known` is false while the list is still pending; the panel then keeps its
 * geometry and shows placeholders instead of calling an unanswered figure zero.
 */
function buildHeatmap(snapshot, range = 'all', now = new Date()) {
  const rows = listedSessions(snapshot)
  const selected = rowsInRange(rows, range, now)
  const activeDays = new Set(selected.filter((row) => row.lastAt > 0).map((row) => dayKey(new Date(row.lastAt))))
  const tokens = selected.reduce((sum, row) => sum + row.tokens, 0)
  const model = mostFrequent(selected, (row) => row.model)
  const peakHour = mostFrequent(
    selected.filter((row) => row.lastAt > 0),
    (row) => new Date(row.lastAt).getHours(),
  )
  return {
    known: snapshot !== null && snapshot !== undefined && snapshot.phase !== 'pending',
    sessions: selected.length,
    tokens,
    activeDays: activeDays.size,
    peakHour: peakHour === null ? null : Number(peakHour),
    model,
    daily: activeDays.size === 0 ? 0 : Math.round(tokens / activeDays.size),
    grid: heatGrid(rows, now),
    total: rows.length,
  }
}

/** A count with thousands separators: 13,262. */
function formatCount(value) {
  const number = Math.round(Number(value) || 0)
  return String(number).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** A token figure in the compact K/M/B form the panel's cells use. */
function compactTokens(value) {
  const number = Number(value) || 0
  const trim = (text) => text.replace(/\.0$/u, '')
  if (number >= 1e9) return `${trim((number / 1e9).toFixed(1))}B`
  if (number >= 1e6) return `${trim((number / 1e6).toFixed(1))}M`
  if (number >= 1e3) return `${trim((number / 1e3).toFixed(1))}K`
  return String(Math.round(number))
}

/** One hour in the panel's language: "5 AM" / "下午 3 点". */
function formatHour(hour, locale) {
  if (hour === null || hour === undefined) return '—'
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  if (String(locale).toLowerCase().startsWith('en')) return `${h12} ${hour < 12 ? 'AM' : 'PM'}`
  return `${hour < 12 ? '上午' : '下午'} ${h12} 点`
}

/** One day key in the page's language: "Aug 26" / "8月26日". */
function formatDay(day, locale) {
  const parts = String(day).split('-')
  if (parts.length !== 3) return String(day)
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' })
    .format(new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])))
}

module.exports = {
  HEATMAP_RANGES,
  HEATMAP_WEEKS,
  buildHeatmap,
  compactTokens,
  dayKey,
  formatCount,
  formatDay,
  formatHour,
  heatGrid,
  normalizeRange,
  tokenTotal,
}
