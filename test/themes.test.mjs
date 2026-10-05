// Pure theme-directory model coverage.

import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  BUNDLED_THEME_IDS,
  backgroundContentType,
  backgroundNameFrom,
  backgroundsDirectory,
  isBackgroundName,
  isBundledThemeId,
  isThemeId,
  orderThemeIds,
  sniffImageMediaType,
  themesDirectory,
  uniqueBackgroundName,
} from '../src/themes.mjs'

/** Leading bytes for each accepted format, as an upload would carry them. */
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00])
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
const GIF = Buffer.concat([Buffer.from('GIF89a', 'latin1'), Buffer.alloc(4)])
const WEBP = Buffer.concat([Buffer.from('RIFF', 'latin1'), Buffer.alloc(4), Buffer.from('WEBP', 'latin1')])
const AVIF = Buffer.concat([Buffer.alloc(4), Buffer.from('ftypavif', 'latin1')])
const BMP = Buffer.from([0x42, 0x4d, 0x36, 0x00])

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

test('identifies an upload from its own bytes', () => {
  assert.equal(sniffImageMediaType(PNG), 'image/png')
  assert.equal(sniffImageMediaType(JPEG), 'image/jpeg')
  assert.equal(sniffImageMediaType(GIF), 'image/gif')
  assert.equal(sniffImageMediaType(WEBP), 'image/webp')
  assert.equal(sniffImageMediaType(AVIF), 'image/avif')
  assert.equal(sniffImageMediaType(BMP), 'image/bmp')
})

test('refuses bytes that are no picture it can serve', () => {
  // A name and a declared content type are both the browser's word; only the bytes are
  // evidence, so an HTML document dressed as a .png must not be stored.
  assert.equal(sniffImageMediaType(Buffer.from('<html><body>hi', 'utf8')), undefined)
  assert.equal(sniffImageMediaType(Buffer.from('')), undefined)
  assert.equal(sniffImageMediaType(Buffer.from('GIF', 'latin1')), undefined)
  assert.equal(sniffImageMediaType(PNG.subarray(0, 6)), undefined)
  // A RIFF container that is not a WEBP is not an image either.
  assert.equal(sniffImageMediaType(Buffer.concat([Buffer.from('RIFF', 'latin1'), Buffer.alloc(4), Buffer.from('WAVE', 'latin1')])), undefined)
  assert.equal(sniffImageMediaType('not bytes'), undefined)
  assert.equal(sniffImageMediaType(undefined), undefined)
})

test('turns a reported file name into one the directory will serve', () => {
  assert.equal(backgroundNameFrom('wallpaper.png', 'image/png'), 'wallpaper.png')
  // The extension follows the sniffed bytes, not the name.
  assert.equal(backgroundNameFrom('wallpaper.gif', 'image/png'), 'wallpaper.png')
  assert.equal(backgroundNameFrom('holiday photo (1).jpeg', 'image/jpeg'), 'holiday-photo-1.jpg')
  // Some platforms report a full path.
  assert.equal(backgroundNameFrom('C:\\Users\\me\\Pictures\\sky.png', 'image/png'), 'sky.png')
  assert.equal(backgroundNameFrom('/home/me/sky.png', 'image/png'), 'sky.png')
  // Traversal never survives the fold, so nothing can escape the directory.
  assert.equal(backgroundNameFrom('../../secret.png', 'image/png'), 'secret.png')
  assert.equal(backgroundNameFrom('..\\..\\secret.png', 'image/png'), 'secret.png')
  assert.equal(backgroundNameFrom('.hidden.png', 'image/png'), 'hidden.png')
  // A name with nothing usable left still yields a servable one.
  assert.equal(backgroundNameFrom('我的壁纸.png', 'image/png'), 'background.png')
  assert.equal(backgroundNameFrom('', 'image/png'), 'background.png')
  assert.equal(backgroundNameFrom(undefined, 'image/png'), 'background.png')
  assert.equal(backgroundNameFrom('!!!.png', 'image/png'), 'background.png')
  // An unserved type has no name at all.
  assert.equal(backgroundNameFrom('a.png', 'image/tiff'), undefined)
  assert.equal(backgroundNameFrom('a.png', undefined), undefined)
})

test('every produced name survives the directory whitelist', () => {
  for (const original of ['a.png', '  spaced  .png', '-lead.png', 'trail-.png', 'a'.repeat(200) + '.png', '我的壁纸.png', '...png', 'a b/c d.png']) {
    const name = backgroundNameFrom(original, 'image/png')
    assert.ok(isBackgroundName(name), `${JSON.stringify(original)} produced ${JSON.stringify(name)}`)
  }
})

test('picks a free name so an upload never overwrites an existing picture', () => {
  assert.equal(uniqueBackgroundName('sky.png', []), 'sky.png')
  assert.equal(uniqueBackgroundName('sky.png', ['other.png']), 'sky.png')
  assert.equal(uniqueBackgroundName('sky.png', ['sky.png']), 'sky-1.png')
  assert.equal(uniqueBackgroundName('sky.png', ['sky.png', 'sky-1.png']), 'sky-2.png')
  // The extension is kept, and a dotted stem keeps its own dots.
  assert.equal(uniqueBackgroundName('a.b.webp', ['a.b.webp']), 'a.b-1.webp')
  // A name with no extension cannot be suffixed, and a full directory gives up.
  assert.equal(uniqueBackgroundName('sky', ['sky']), undefined)
  const all = ['sky.png', ...Array.from({ length: 999 }, (_, index) => `sky-${index + 1}.png`)]
  assert.equal(uniqueBackgroundName('sky.png', all), undefined)
})
