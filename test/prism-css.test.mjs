/**
 * The Prism sheets: structure a reader can rely on without a browser.
 *
 * A stray brace or an unpaired palette value costs a whole rule silently, so
 * the shapes every shipped sheet has to keep are asserted here. What a sheet
 * looks like once resolved is a browser question, not this suite's.
 */

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const SHEETS = ['prism', 'prism-obsidian', 'prism-alabaster']
const read = (id) => readFile(new URL(`../themes/${id}.css`, import.meta.url), 'utf8')

/** Declarations of one selector block, as name to value. */
function blockOf(css, selector) {
  const at = css.indexOf(`${selector} {`)
  assert.notEqual(at, -1, `${selector} is missing`)
  const body = css.slice(at + selector.length + 2, css.indexOf('\n}', at))
  return new Map([...body.matchAll(/--([a-z0-9-]+):\s*([^;]+);/gu)].map((m) => [m[1], m[2].trim()]))
}

test('every sheet keeps its braces and trailing newline', async () => {
  for (const id of SHEETS) {
    const css = await read(id)
    assert.equal((css.match(/\{/gu) ?? []).length, (css.match(/\}/gu) ?? []).length, `${id} has an unbalanced block`)
    assert.ok(css.endsWith('\n'), `${id} lost its trailing newline`)
    assert.ok(!css.includes('\r'), `${id} carries CRLF`)
  }
})

test('both palettes declare the same names, so neither mode inherits a stray value', async () => {
  for (const id of SHEETS) {
    const css = await read(id)
    const light = blockOf(css, ':root')
    const dark = blockOf(css, ':root[data-theme="dark"]')
    assert.deepEqual([...light.keys()].sort(), [...dark.keys()].sort(), `${id} palettes disagree`)
  }
})

test('the control material and filled-action tokens ship with every sheet', async () => {
  for (const id of SHEETS) {
    const css = await read(id)
    for (const token of ['dct-prism-sheen', 'dct-prism-shade', 'dsw-alias-button-info-fill', 'dsw-alias-state-business-primary']) {
      assert.ok(css.includes(`--${token}:`), `${id} is missing ${token}`)
    }
    for (const rule of ['button[type="submit"]', '[role="menuitem"]', ':focus-visible']) {
      assert.ok(css.includes(rule), `${id} lost the ${rule} rule`)
    }
  }
})
