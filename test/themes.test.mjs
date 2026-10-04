// Pure theme-directory model coverage.

import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  BUNDLED_THEME_IDS,
  backgroundContentType,
  backgroundsDirectory,
  isBackgroundName,
  isBundledThemeId,
  isThemeId,
  orderThemeIds,
  themesDirectory,
} from '../src/themes.mjs'

test('accepts ordinary ids and rejects anything that could escape the directory', () => {
  for (const id of ['gov', 'my-theme', 'My_Theme.v2', 'a', 'a1']) assert.ok(isThemeId(id), id)

  for (const id of [
    '', '.', '..', '.hidden',
    '../etc/passwd', '..\\windows', 'a/b', 'a\\b',
    '-lead', '_lead', '.lead',
    'a'.repeat(65),
  ]) {
    assert.equal(isThemeId(id), false, JSON.stringify(id))
  }
  assert.equal(isThemeId(undefined), false)
  assert.equal(isThemeId(7), false)
})

test('resolves the directory from config first, then the home argument', () => {
  const home = 'C:/home/.dsh'
  assert.equal(themesDirectory({ themesDir: 'D:/t' }, home), 'D:/t')
  assert.equal(themesDirectory({ themesDir: '   ' }, home), join(home, 'themes'))
  assert.equal(themesDirectory(undefined, home), join(home, 'themes'))
  assert.equal(themesDirectory({}, home), join(home, 'themes'))
})

test('orders bundled ids first, then the rest alphabetically, de-duplicated', () => {
  assert.deepEqual(orderThemeIds(['zeta', 'gov', 'alpha', 'one-dark', 'monokai-pro']), [
    'gov', 'monokai-pro', 'one-dark', 'alpha', 'zeta',
  ])
  assert.deepEqual(orderThemeIds(['gov', 'gov', 'alpha', 'alpha']), ['gov', 'alpha'])
  // Ids that fail validation never reach the picker.
  assert.deepEqual(orderThemeIds(['gov', '../x', '.hidden', 'ok']), ['gov', 'ok'])
  assert.deepEqual(orderThemeIds([]), [])
})

test('reports bundled membership from the one id list', () => {
  for (const id of BUNDLED_THEME_IDS) assert.ok(isBundledThemeId(id), id)
  assert.equal(isBundledThemeId('my-theme'), false)
})

test('accepts image names and rejects anything that could escape the directory', () => {
  for (const name of ['a.png', 'sky.JPG', 'my-photo.jpeg', 'x.webp', 'x.gif', 'x.avif', 'x.bmp']) {
    assert.ok(isBackgroundName(name), name)
  }
  for (const name of [
    '', 'png', '.png', 'a.txt', 'a.css', 'a.png.txt', 'a.svg',
    '../a.png', '..\\a.png', 'sub/a.png', '.hidden.png', '-a.png',
    'a.png/../b.png',
  ]) {
    assert.equal(isBackgroundName(name), false, JSON.stringify(name))
  }
  assert.equal(isBackgroundName(undefined), false)
})

test('maps image extensions to media types, case-insensitively', () => {
  assert.equal(backgroundContentType('a.png'), 'image/png')
  assert.equal(backgroundContentType('a.JPG'), 'image/jpeg')
  assert.equal(backgroundContentType('a.jpeg'), 'image/jpeg')
  assert.equal(backgroundContentType('a.webp'), 'image/webp')
  assert.equal(backgroundContentType('a.avif'), 'image/avif')
})

test('resolves the background directory from config first, then the home argument', () => {
  const home = 'C:/home/.dsh'
  assert.equal(backgroundsDirectory({ backgroundsDir: 'D:/bg' }, home), 'D:/bg')
  assert.equal(backgroundsDirectory({ backgroundsDir: '  ' }, home), join(home, 'backgrounds'))
  assert.equal(backgroundsDirectory(undefined, home), join(home, 'backgrounds'))
  // Themes and backgrounds are separate directories by default.
  assert.notEqual(backgroundsDirectory({}, home), themesDirectory({}, home))
})
