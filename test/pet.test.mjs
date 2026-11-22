/**
 * The companion's art: a grid of characters that becomes the fewest rects.
 *
 * No browser is involved — the art is data and its merge is arithmetic, which is
 * exactly the part a rendered page cannot show you.
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { CAT, EYES, PALETTE, pixelRects, bodyRects, eyeRects } = require('../src/client/pet/art.cjs')

/** Every cell a rect covers, as `x:y`. */
function covered(rects) {
  const cells = new Set()
  for (const rect of rects) {
    for (let dx = 0; dx < rect.width; dx++) {
      for (let dy = 0; dy < rect.height; dy++) cells.add((rect.x + dx) + ':' + (rect.y + dy))
    }
  }
  return cells
}

test('the grid is square and only uses characters it can paint', () => {
  assert.equal(CAT.length, 16)
  for (const row of CAT) {
    assert.equal(row.length, 16, `row width: ${row}`)
    for (const key of row) assert.ok(key === '.' || PALETTE[key] !== undefined, `unknown pixel: ${key}`)
  }
})

test('neighbouring pixels merge into single rects', () => {
  const rects = pixelRects(['bb..bb', '.b....'])
  assert.deepEqual(rects.map((r) => [r.x, r.y, r.width]), [[0, 0, 2], [4, 0, 2], [1, 1, 1]])
  assert.equal(rects[0].fill, PALETTE.b)
})

test('the body keeps every painted cell, the eye cells included', () => {
  const body = bodyRects()
  const cells = covered(body)
  CAT.forEach((row, y) => {
    [...row].forEach((key, x) => {
      if (key === '.') return
      assert.ok(cells.has(x + ':' + y), `cell ${x}:${y} is not painted by the body`)
    })
  })
  // The eyes are drawn by their own group: the body must have filled those cells
  // with the body colour, whichever string the palette gives them.
  const at = (x, y) => body.find((rect) => rect.y === y && x >= rect.x && x < rect.x + rect.width)
  for (const eye of EYES) {
    assert.equal(at(eye.x, eye.y)?.fill, PALETTE.b, 'an eye cell is not body-coloured underneath')
  }
})

test('the stored anchor is kept inside the card, whatever arrives', () => {
  const { clampOffset, DEFAULT_OFFSET, OFFSET_MIN, OFFSET_MAX } = require('../src/client/pet/constants.cjs')
  assert.equal(clampOffset(93), 93)
  assert.equal(clampOffset('40'), 40)
  assert.equal(clampOffset(-5), OFFSET_MIN, 'a negative anchor would put the companion off the card')
  assert.equal(clampOffset(500), OFFSET_MAX, 'an anchor past the right edge would do the same')
  assert.equal(clampOffset(Number.NaN), DEFAULT_OFFSET)
  assert.equal(clampOffset(undefined), DEFAULT_OFFSET)
  assert.equal(clampOffset(12.6), 13, 'the stored value is a whole percent')
})

test('a blink closes exactly the eye cells', () => {
  const open = eyeRects(false)
  const shut = eyeRects(true)
  assert.equal(open.length, EYES.length)
  assert.deepEqual(open.map((r) => [r.x, r.y]), EYES.map((e) => [e.x, e.y]))
  assert.ok(open.every((rect) => rect.fill === PALETTE.e), 'an open eye is not drawn in the eye colour')
  assert.ok(shut.every((rect) => rect.fill === PALETTE.b), 'a closed eye is not drawn as body colour')
})
