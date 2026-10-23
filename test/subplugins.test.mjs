/**
 * Test for sub-plugins and settings page tabs styling.
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { getActiveSubplugins, markSubpluginActive } from '../src/host/subplugins.mjs'

const ROOT = process.cwd()
const MANIFEST = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const PATCH_YML = readFileSync(join(ROOT, 'cordis.patch.yml'), 'utf8')

const SUBPLUGIN_IDS = [
  'custom-theme-themes',
  'custom-theme-backgrounds',
  'custom-theme-appearance',
  'custom-theme-reasoning',
  'custom-theme-effort',
  'custom-theme-working',
  'custom-theme-branding',
  'custom-theme-heatmap',
  'custom-theme-injections',
  'custom-theme-tray',
]

const SUBPLUGIN_DIRS = [
  'themes',
  'backgrounds',
  'appearance',
  'reasoning',
  'effort',
  'working',
  'branding',
  'heatmap',
  'injections',
  'tray',
]

test('every sub-plugin has entry point, package.json, icons, and locales', () => {
  for (const dir of SUBPLUGIN_DIRS) {
    const pkgPath = join(ROOT, 'src', dir, 'package.json')
    const indexPath = join(ROOT, 'src', dir, 'index.mjs')
    const iconPath = join(ROOT, 'src', dir, 'icon.svg')
    const zhPath = join(ROOT, 'src', dir, 'locale', 'zh.json')
    const enPath = join(ROOT, 'src', dir, 'locale', 'en.json')

    assert.ok(existsSync(pkgPath), `${dir}/package.json exists`)
    assert.ok(existsSync(indexPath), `${dir}/index.mjs exists`)
    assert.ok(existsSync(iconPath), `${dir}/icon.svg exists`)
    assert.ok(existsSync(zhPath), `${dir}/locale/zh.json exists`)
    assert.ok(existsSync(enPath), `${dir}/locale/en.json exists`)

    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    assert.equal(pkg.name, `custom-theme-${dir}`)
    assert.ok(typeof pkg.description === 'string' && pkg.description.length > 0)
    assert.equal(pkg.icon, './icon.svg')

    const zh = JSON.parse(readFileSync(zhPath, 'utf8'))
    const en = JSON.parse(readFileSync(enPath, 'utf8'))
    assert.ok(typeof zh.meta?.title === 'string' && zh.meta.title.length > 0)
    assert.ok(typeof zh.meta?.description === 'string' && zh.meta.description.length > 0)
    assert.ok(typeof en.meta?.title === 'string' && en.meta.title.length > 0)
    assert.ok(typeof en.meta?.description === 'string' && en.meta.description.length > 0)
  }
})

test('package.json exports all sub-plugin paths and metadata', () => {
  for (const dir of SUBPLUGIN_DIRS) {
    assert.equal(MANIFEST.exports[`./${dir}`], `./src/${dir}/index.mjs`)
    assert.equal(MANIFEST.exports[`./${dir}/package.json`], `./src/${dir}/package.json`)
    assert.equal(MANIFEST.exports[`./${dir}/locale/*.json`], `./src/${dir}/locale/*.json`)
  }
})

test('cordis.patch.yml defines bare root package and all sub-plugin rows', () => {
  assert.ok(PATCH_YML.includes("name: 'dsh-custom-theme'"))
  for (const id of SUBPLUGIN_IDS) {
    const sub = id.replace('custom-theme-', '')
    assert.ok(PATCH_YML.includes(`id: ${id}`), `patch includes ${id}`)
    assert.ok(PATCH_YML.includes(`name: 'dsh-custom-theme/${sub}'`), `patch includes subpath ${sub}`)
  }
})

test('sub-plugin registry tracks active fibers', () => {
  const unmark = markSubpluginActive('test-plugin')
  assert.ok(getActiveSubplugins().includes('test-plugin'))
  unmark()
  assert.ok(!getActiveSubplugins().includes('test-plugin'))
})
