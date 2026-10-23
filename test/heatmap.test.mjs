/**
 * The heatmap's arithmetic, away from a browser.
 *
 * The panel's only inputs are the session-list projections, so the cases that
 * matter are the ones the list can actually produce: four token buckets, a
 * blank draft, a subagent row, and a prompt older than the selected range.
 */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const {
  HEATMAP_WEEKS,
  buildHeatmap,
  compactTokens,
  dayKey,
  formatCount,
  formatHour,
  heatGrid,
  normalizeRange,
  tokenTotal,
} = require('../src/client/heatmap/model.cjs')

const NOW = new Date(2026, 9, 24, 12, 0, 0)

/** One list row in the shape `sessions.list.getSnapshot().byId` exposes. */
function row(id, options = {}) {
  const {
    tokens = 0,
    lastAt = NOW.getTime(),
    model = 'deepseek-v4',
    blank = false,
    origin = undefined,
    usage = { uncachedInputTokens: tokens },
  } = options
  return {
    id,
    blank,
    ...(origin === undefined ? {} : { origin }),
    updatedAt: lastAt,
    projectionValues: {
      tokenUsage: usage,
      sessionListMetadata: { blank, lastPromptAt: lastAt },
      modelSelection: { lastUsed: { provider: 'deepseek', model }, next: null },
    },
  }
}

/** Wrap rows the way the session-list store wraps them. */
function snapshot(rows, phase = 'ready') {
  return {
    phase,
    ids: rows.map((entry) => entry.id),
    byId: Object.fromEntries(rows.map((entry) => [entry.id, entry])),
  }
}

test('a token total adds all four usage buckets', () => {
  assert.equal(tokenTotal({
    uncachedInputTokens: 10,
    outputTokens: 20,
    cacheReadTokens: 30,
    cacheWriteTokens: 40,
  }), 100)
  assert.equal(tokenTotal({}), 0)
  assert.equal(tokenTotal({ outputTokens: '12' }), 12)
})

test('the grid starts on Sunday and levels the busiest day at the top step', () => {
  const today = new Date(2026, 9, 24, 9, 0, 0)
  const yesterday = new Date(2026, 9, 23, 9, 0, 0)
  const grid = heatGrid([
    { tokens: 1000, lastAt: today.getTime() },
    { tokens: 500, lastAt: yesterday.getTime() },
  ], today)
  assert.ok(grid.cells.length >= HEATMAP_WEEKS * 7, 'at least 26 full weeks')
  assert.ok(grid.cells.length <= HEATMAP_WEEKS * 7 + 6, 'no more than one partial week')
  assert.equal(new Date(`${grid.cells[0].date}T00:00:00`).getDay(), 0, 'Sunday first')
  assert.equal(grid.cells.at(-1).date, dayKey(today), 'today last')
  assert.equal(grid.cells.find((cell) => cell.date === dayKey(today)).level, 4)
  assert.equal(grid.cells.find((cell) => cell.date === dayKey(yesterday)).level, 2)
})

test('the range narrows the stats but the grid keeps its 26-week window', () => {
  const old = new Date(2026, 8, 10, 9, 0, 0)
  const recent = new Date(2026, 9, 14, 9, 0, 0)
  const today = new Date(2026, 9, 24, 9, 0, 0)
  const list = snapshot([
    row('old', { tokens: 900, lastAt: old.getTime() }),
    row('recent', { tokens: 300, lastAt: recent.getTime() }),
    row('today', { tokens: 100, lastAt: today.getTime() }),
  ])

  const all = buildHeatmap(list, 'all', NOW)
  assert.equal(all.sessions, 3)
  assert.equal(all.tokens, 1300)
  assert.equal(all.activeDays, 3)

  const month = buildHeatmap(list, '30d', NOW)
  assert.equal(month.sessions, 2)
  assert.equal(month.tokens, 400)
  assert.equal(month.activeDays, 2)

  const week = buildHeatmap(list, '7d', NOW)
  assert.equal(week.sessions, 1)
  assert.equal(week.tokens, 100)
  assert.equal(week.grid.cells.length, all.grid.cells.length)
})

test('blank drafts and subagent rows stay out of every figure', () => {
  const nine = new Date(2026, 9, 24, 9, 0, 0)
  const three = new Date(2026, 9, 24, 15, 0, 0)
  const list = snapshot([
    row('a', { tokens: 100, lastAt: nine.getTime(), model: 'model-a' }),
    row('b', { tokens: 200, lastAt: nine.getTime(), model: 'model-a' }),
    row('c', { tokens: 50, lastAt: three.getTime(), model: 'model-b' }),
    row('draft', { tokens: 99999, blank: true }),
    row('child', { tokens: 88888, origin: 'subagent' }),
  ])
  const data = buildHeatmap(list, 'all', NOW)
  assert.equal(data.sessions, 3)
  assert.equal(data.tokens, 350)
  assert.equal(data.peakHour, 9)
  assert.equal(data.model, 'model-a')
  assert.equal(data.daily, 350)
})

test('a pending list is unknown rather than a confident zero', () => {
  const pending = buildHeatmap(snapshot([], 'pending'), 'all', NOW)
  assert.equal(pending.known, false)
  assert.equal(pending.total, 0)
  assert.equal(buildHeatmap(snapshot([]), 'all', NOW).known, true)
})

test('the compact figures and locale labels match the panel copy', () => {
  assert.equal(formatCount(13262), '13,262')
  assert.equal(compactTokens(950), '950')
  assert.equal(compactTokens(1500), '1.5K')
  assert.equal(compactTokens(2_000_000), '2M')
  assert.equal(compactTokens(1_250_000_000), '1.3B')
  assert.equal(formatHour(0, 'zh'), '上午 12 点')
  assert.equal(formatHour(15, 'zh'), '下午 3 点')
  assert.equal(formatHour(15, 'en'), '3 PM')
  assert.equal(normalizeRange('nonsense'), 'all')
})
