// The reasoning-level patch: what it writes, what it must never touch, and the way back.
//
// The profile's patch file is the user's own document — comments, hand-declared levels and all —
// so most of these tests are about what does *not* change.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  DEFAULT_EFFORT_LEVELS,
  MANAGED_FROM_FALSE_MARK,
  MANAGED_MARK,
  applyEffortLevels,
  inspectEffortLevels,
  revertEffortLevels,
} from '../src/effort-levels.mjs'

/** A profile patch file with one declared model, one `false`, one undeclared, and comments. */
const FIXTURE = `# Your patch layer.
- id: llm-pi-ai
  name: "@deepseek-ai/dsh-llm-pi-ai"
  config:
    providers:
      amkr:
        apiKeyEnv: AMKR_API_KEY
        baseURL: https://example.invalid/v1
        # 档位按网关逐个实测后声明（未声明的档位不会出现在菜单中）：
        #   · off 仅 deepseek 系列接受，其余上游 400，故只在 deepseek 上提供。
        models:
          - id: deepseek-v4.1-flash
            name: deepseek-v4.1-flash
            reasoningEfforts:
              "off": "off"
              low: low
              high: high
              max: max
          # 非推理模型：选择器不再显示没有实际作用的档位。
          - id: glm-5.3-flash
            name: glm-5.3-flash
            reasoningEfforts: false
          - id: unified-model
            name: unified-model
            input:
              - text
              - image
- id: agent-default-model
  name: "@deepseek-ai/dsh-agent-default-model"
  config:
    provider: amkr
    model: deepseek-v4.1-flash
`

/** The lines that differ between two texts, in order. */
function diffLines(before, after) {
  const from = before.split(/\r?\n/u)
  const to = after.split(/\r?\n/u)
  return {
    removed: from.filter((line) => !to.includes(line)),
    added: to.filter((line) => !from.includes(line)),
  }
}

test('attaches off/low/high/max to the model that declares nothing and the one that said false', () => {
  const result = applyEffortLevels(FIXTURE)
  assert.equal(result.changed, true)
  assert.deepEqual(result.models, [
    { id: 'deepseek-v4.1-flash', action: 'kept' },
    { id: 'glm-5.3-flash', action: 'replaced-false' },
    { id: 'unified-model', action: 'added' },
  ])
  // `off` is quoted: YAML reads a bare off as a boolean. It carries no value: a value would be
  // sent on every request that names no level, which is what automatic compaction does.
  assert.match(result.text, /reasoningEfforts: # dsh-custom-theme:managed-from-false\n\s+"off":\n\s+low: low\n\s+high: high\n\s+max: max\n/u)
  assert.match(result.text, /reasoningEfforts: # dsh-custom-theme:managed\n\s+"off":\n\s+low: low\n\s+high: high\n\s+max: max\n/u)
  // The user's own declaration is untouched, and so is every comment around it.
  assert.ok(result.text.includes('              "off": "off"\n              low: low'), 'the declared list moved')
  assert.ok(result.text.includes('        # 档位按网关逐个实测后声明（未声明的档位不会出现在菜单中）：'),
    'a comment above the list went missing')
  assert.ok(result.text.includes('          # 非推理模型：选择器不再显示没有实际作用的档位。'),
    'a comment above the model went missing')
})

test('nothing but the lines this plugin owns is ever rewritten', () => {
  const result = applyEffortLevels(FIXTURE)
  const { removed, added } = diffLines(FIXTURE, result.text)
  // What goes away is exactly the user's `false`; what arrives is exactly the managed blocks.
  assert.deepEqual(removed, ['            reasoningEfforts: false'])
  assert.ok(added.every((line) => line.includes(MANAGED_MARK) || /^\s+("?off"?|low|high|max):/u.test(line)),
    `a line this plugin does not own was written: ${JSON.stringify(added)}`)
  const owned = (line) => line.includes('dsh-custom-theme') || /reasoningEfforts/u.test(line) || /^\s+("?off"?|low|high|max):/u.test(line)
  assert.ok([...removed, ...added].every(owned), 'a foreign line changed')
})

test('a second pass changes nothing at all', () => {
  const once = applyEffortLevels(FIXTURE)
  const twice = applyEffortLevels(once.text)
  assert.equal(twice.changed, false, 'the pass is not idempotent')
  assert.equal(twice.text, once.text)
  assert.deepEqual(twice.models.map((model) => model.action), ['kept', 'unchanged', 'unchanged'])
})

test('the way back restores the file byte for byte, false and all', () => {
  const once = applyEffortLevels(FIXTURE)
  const back = revertEffortLevels(once.text)
  assert.equal(back.text, FIXTURE, 'the revert did not restore the original')
  assert.deepEqual(back.models, [
    { id: 'glm-5.3-flash', action: 'restored-false' },
    { id: 'unified-model', action: 'removed' },
  ])
  assert.equal(revertEffortLevels(back.text).changed, false, 'the revert is not idempotent')
})

test('a block this plugin wrote is refreshed when the levels change', () => {
  const once = applyEffortLevels(FIXTURE)
  const fewer = applyEffortLevels(once.text, [['low', 'low'], ['high', 'high']])
  assert.equal(fewer.changed, true)
  assert.ok(fewer.text.includes(`reasoningEfforts: ${MANAGED_FROM_FALSE_MARK}\n              low: low\n              high: high`),
    'the managed block was not refreshed in place')
  // The user's own list still declares `max`; only the blocks this plugin wrote dropped it.
  assert.equal((fewer.text.match(/max: max/gu) ?? []).length, 1, 'the level that was dropped stayed in the file')
  assert.ok(fewer.text.includes(`reasoningEfforts: ${MANAGED_MARK}\n              low: low\n              high: high`),
    'the inserted block was not refreshed in place')
  // And the way back still restores what the user wrote, not what this plugin last wrote.
  assert.equal(revertEffortLevels(fewer.text).text, FIXTURE)
})

test('the inspection says what the file needs, what it has, and what the user declared', () => {
  assert.deepEqual(inspectEffortLevels(FIXTURE), {
    undeclared: ['glm-5.3-flash', 'unified-model'],
    managed: [],
    declared: ['deepseek-v4.1-flash'],
  })
  const managed = applyEffortLevels(FIXTURE)
  assert.deepEqual(inspectEffortLevels(managed.text), {
    undeclared: [],
    managed: ['glm-5.3-flash', 'unified-model'],
    declared: ['deepseek-v4.1-flash'],
  })
})

test('a profile without the provider row, or without models, is left alone', () => {
  const other = '- id: ui-chat\n  name: "@deepseek-ai/dsh-client-ui-chat"\n  config:\n    transcriptView: standard\n'
  assert.equal(applyEffortLevels(other).changed, false)
  assert.equal(applyEffortLevels(other).text, other)
  const empty = '- id: llm-pi-ai\n  config:\n    providers:\n      amkr:\n        models:\n'
  assert.equal(applyEffortLevels(empty).changed, false)
})

test('every provider of the row is covered, and the row ends where the next entry starts', () => {
  const two = `- id: llm-pi-ai
  config:
    providers:
      amkr:
        models:
          - id: a
            name: a
      other:
        models:
          - id: b
            name: b
- id: ui-chat
  config:
    models:
      - id: not-a-provider-model
`
  const result = applyEffortLevels(two)
  assert.deepEqual(result.models.map((model) => model.id), ['a', 'b'])
  assert.ok(!result.text.includes('not-a-provider-model\n            reasoningEfforts'),
    'a model outside the provider row was touched')
})

test('the file’s own line endings and final newline survive', () => {
  const crlf = FIXTURE.replace(/\n/gu, '\r\n')
  const result = applyEffortLevels(crlf)
  // Four lines replace the user's `false`, five are inserted under the undeclared model.
  assert.equal((result.text.match(/\r\n/gu) ?? []).length, (crlf.match(/\r\n/gu) ?? []).length + 9)
  assert.ok(!/[^\r]\n/u.test(result.text), 'a bare LF appeared in a CRLF file')
  const noFinal = FIXTURE.slice(0, -1)
  assert.equal(applyEffortLevels(noFinal).text.endsWith('\n'), false, 'a final newline was added')
  assert.equal(applyEffortLevels(FIXTURE).text.endsWith('\n'), true, 'the final newline was dropped')
})

test('the levels it attaches are the ones the feature promises', () => {
  assert.deepEqual(DEFAULT_EFFORT_LEVELS, [['off', null], ['low', 'low'], ['high', 'high'], ['max', 'max']])
})

test('the plugin never writes a wire value for off, so no request is spoken for', () => {
  const result = applyEffortLevels(FIXTURE)
  // The only `off` with a value left in the file is the one the user wrote; every block this
  // plugin wrote names `off` and stops there. A value here would be sent by pi-ai's effort-less
  // paths — automatic compaction and session titles — where `off` is a 400 on an OpenAI-style
  // gateway and `none` is the level's real spelling.
  assert.equal((result.text.match(/"off": "off"/gu) ?? []).length, 1, 'a managed block carries an off value')
  assert.equal((result.text.match(/"off":\n/gu) ?? []).length, 2, 'a managed block is missing its bare off')
  // Valueless is a property of what is written, not of the shape a caller passes: a caller that
  // hands a value over gets one, because that is a hand-written list, not this default.
  const explicit = applyEffortLevels(FIXTURE, [['off', 'none'], ['low', 'low'], ['high', 'high']])
  assert.match(explicit.text, /"off": none\n\s+low: low\n\s+high: high/u)
  // The block is refreshed in place, so a profile a previous version filled in is repaired.
  const old = applyEffortLevels(FIXTURE, [['off', 'off'], ['low', 'low'], ['high', 'high'], ['max', 'max']])
  const repaired = applyEffortLevels(old.text)
  assert.equal(repaired.changed, true, 'the old block was not refreshed')
  assert.equal(repaired.text, result.text, 'the repaired file is not the one the default writes')
})
