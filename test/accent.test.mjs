/**
 * The accent colour laid over a theme: pure arithmetic, and the layer it builds.
 *
 * No browser and no shell: the module states what a chosen colour becomes, and
 * the client suite covers how that layer reaches the theme runtime.
 */

import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const { ACCENT_PRESETS, accentTokens, contrastOf, luminance, normaliseAccent } = require('../src/client/theme/accent.cjs')

/** Canvas each scheme is measured against, as the module states them. */
const CANVAS = { light: luminance('#ffffff'), dark: luminance('#101217') }

test('a stored accent is read as one #rrggbb colour, or not at all', () => {
  assert.equal(normaliseAccent('#2F6FD0'), '#2f6fd0')
  assert.equal(normaliseAccent('2f6fd0'), '#2f6fd0')
  assert.equal(normaliseAccent('#abc'), '#aabbcc')
  assert.equal(normaliseAccent('  #FFF  '), '#ffffff')
  for (const value of ['', 'red', '#12345', '#gggggg', null, 7]) assert.equal(normaliseAccent(value), '', String(value))
  assert.deepEqual(accentTokens(''), {})
  assert.deepEqual(accentTokens('not a colour'), {})
})

test('every offered swatch reaches its contrast on both canvases', () => {
  for (const preset of ACCENT_PRESETS) {
    const tokens = accentTokens(preset.color)
    for (const scheme of ['light', 'dark']) {
      const accent = tokens['--dsw-alias-brand-primary'][scheme]
      const ink = tokens['--dsw-alias-brand-text'][scheme]
      assert.ok(contrastOf(luminance(accent), CANVAS[scheme]) >= 4.5,
        `${preset.id} loses its contrast on the ${scheme} canvas`)
      assert.ok(contrastOf(luminance(accent), luminance(ink)) >= 4.5,
        `${preset.id} carries unreadable label ink on the ${scheme} scheme`)
    }
  }
})

test('a pale pick is lowered until it reads, and its hue survives', () => {
  const pale = '#ffe680'
  const tokens = accentTokens(pale)
  assert.ok(contrastOf(luminance(tokens['--dsw-alias-brand-primary'].light), CANVAS.light) >= 4.5)
  const [dr, dg, db] = [1, 3, 5].map((at) => Number.parseInt(tokens['--dsw-alias-brand-primary'].light.slice(at, at + 2), 16))
  assert.ok(dr > db && dg > db, 'the fitted colour lost its warm hue')
})

test('an accent moves the action tokens only, never the canvas', () => {
  const tokens = accentTokens('#2f6fd0')
  assert.deepEqual(Object.keys(tokens).sort(), [
    '--dct-prism-ring',
    '--dsw-alias-brand-primary',
    '--dsw-alias-brand-primary-new-colorprimary-new-color',
    '--dsw-alias-brand-text',
    '--dsw-alias-button-ghost-active-border',
    '--dsw-alias-button-info-fill',
    '--dsw-alias-button-info-hover',
    '--dsw-alias-button-primary-fill',
    '--dsw-alias-button-primary-hover',
    '--dsw-alias-interactive-bg-hover-accent',
    '--dsw-alias-link',
    '--dsw-alias-state-business-primary',
    '--dsw-alias-state-business-tertiary',
  ])
  for (const name of Object.keys(tokens)) {
    assert.equal(typeof tokens[name].light, 'string', name)
    assert.equal(typeof tokens[name].dark, 'string', name)
  }
})
