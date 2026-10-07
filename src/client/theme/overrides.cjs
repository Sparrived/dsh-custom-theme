/**
 * theme/overrides.cjs — a theme stylesheet applied as an override layer.
 */

module.exports = function (deps) {
  const { ctx, signal, style } = deps

  const { CSS_URL } = require('../shared/endpoints.cjs')
  const { writeSaved } = require('./selection.cjs')

/**
 * Selectors that scope a rule to the dark palette.
 *
 * `data-ds-dark-theme` is what this shell sets on `body`; `data-theme="dark"`
 * is the convention Deeptop's own theme files use, so a file written for it
 * classifies correctly here even though the attribute name differs.
 */
const DARK_SCOPE = /data-ds-dark-theme|data-theme\s*=\s*["']?dark|prefers-color-scheme\s*:\s*dark/iu

/** One custom-property declaration, quoted values kept intact. */
const TOKEN_DECLARATION = /(--[A-Za-z0-9_-]+)\s*:\s*((?:[^;{}"']|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')+)/gu

/**
 * Call `visit` with the body of every rule in a stylesheet and whether that
 * rule sits under a dark scope.
 *
 * Recurses through at-rules, so a dark set written as
 * `@media (prefers-color-scheme: dark) { :root { … } }` is classified the same
 * as one written behind `body[data-ds-dark-theme]`.
 * @param source - Stylesheet text, comments already removed.
 * @param dark - Whether an enclosing rule already scoped this region dark.
 * @param visit - Receives each rule body and its dark scope.
 */
function eachRuleBody(source, dark, visit) {
  let cursor = 0
  for (;;) {
    const open = source.indexOf('{', cursor)
    if (open === -1) return
    const header = source.slice(cursor, open).trim()
    let depth = 1
    let position = open + 1
    while (position < source.length && depth > 0) {
      if (source[position] === '{') depth += 1
      else if (source[position] === '}') depth -= 1
      position += 1
    }
    const body = source.slice(open + 1, position - 1)
    const scoped = dark || DARK_SCOPE.test(header)
    if (header.startsWith('@')) eachRuleBody(body, scoped, visit)
    else visit(body, scoped)
    cursor = position
  }
}

/**
 * Collect the custom-property declarations of a stylesheet, split by palette.
 *
 * Theme authors write `:root { --dsw-alias-bg-base: … }` because that is the
 * CSS convention, but the declarations are re-applied through the official
 * theme runtime (see `applyTheme`), so this reads them out of any selector
 * block. A theme may carry one palette or a light/dark pair, the pair written
 * the way the shell writes its own — see {@link DARK_SCOPE}.
 * @param css - Stylesheet text.
 * @returns `light` and `dark` token names to values, later declarations winning.
 */
function parseTokenDeclarations(css) {
  const source = css.replace(/\/\*[\s\S]*?\*\//gu, '')
  const light = new Map()
  const dark = new Map()
  eachRuleBody(source, false, (body, isDark) => {
    for (const match of body.matchAll(TOKEN_DECLARATION)) {
      // A trailing `!important` would be part of the value once the runtime
      // re-emits it as an inline custom property.
      const value = match[2].trim().replace(/\s*!important\s*$/iu, '').trim()
      if (value !== '') (isDark ? dark : light).set(match[1], value)
    }
  })
  return { light, dark }
}

/** Override-layer source id; also names the layer's origin for inspection. */
const THEME_ID_PREFIX = 'dsh-custom-theme'

/**
 * Rec. 709 luma of a colour, in whatever syntax its author wrote it.
 *
 * The stylesheet states the colour however it likes, so this hands the value
 * to the browser instead of recognising syntaxes. A probe inside `body`
 * resolves it — including a `var()` naming a token the shell declares, which
 * a detached element could not see — and a canvas pixel then converts the
 * result to sRGB: `getComputedStyle().color` alone is not enough, because it
 * reports `oklch()` and friends back in the colour space they were written in.
 * @param value - A colour as written in the theme.
 * @returns Luma on 0–1, or `null` when the browser accepts no such colour.
 */
function resolveLuma(value) {
  if (typeof value !== 'string' || value.trim() === '') return null
  const probe = document.createElement('span')
  probe.style.color = value
  if (probe.style.color === '') return null
  probe.style.position = 'absolute'
  probe.style.visibility = 'hidden'
  document.body.append(probe)
  const computed = getComputedStyle(probe).color
  probe.remove()
  if (computed === '' || !CSS.supports('color', computed)) return null
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const context = canvas.getContext('2d')
  if (context === null) return null
  context.fillStyle = computed
  context.fillRect(0, 0, 1, 1)
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

/**
 * Which base palette a theme builds on, or `null` when it does not say.
 *
 * The shell switches its entire base palette from `body[data-ds-dark-theme]`,
 * so a theme that overrides alias tokens alone inherits the base of whichever
 * scheme the user last picked, and every token it does not override keeps that
 * scheme's colour — a light theme over a dark base leaves dark surfaces behind.
 * `setTheme` is what switches that attribute, so asking for the scheme is what
 * lets a partial palette come out coherent instead of half-applied.
 *
 * Only a theme with no dark set of its own needs this; one carrying a pair
 * leaves the preference alone. An explicit `/* dsh:color-scheme light *\/`
 * directive wins; otherwise the luma of `--dsw-alias-bg-base` decides. A colour
 * this cannot read yields `null`, and the caller then leaves the preference
 * where the user put it rather than guessing a scheme for it.
 * @param css - Stylesheet text.
 * @param tokens - The theme's light-palette token declarations.
 * @returns `'light'`, `'dark'`, or `null`.
 */
function themeColorScheme(css, tokens) {
  const declared = /\/\*\s*dsh:color-scheme\s+(light|dark)\s*\*\//u.exec(css)
  if (declared !== null) return declared[1]
  const luma = resolveLuma(tokens.get('--dsw-alias-bg-base'))
  if (luma === null) return null
  return luma > 0.5 ? 'light' : 'dark'
}

/**
 * Split declarations in a CSS rule body while respecting quotes and parentheses.
 * @param body - Rule body text without enclosing braces.
 * @returns Array of declaration strings.
 */
function parseDeclarations(body) {
  const decls = []
  let start = 0
  let inSingle = false
  let inDouble = false
  let parenDepth = 0

  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i]
    if (ch === '\\' && (inSingle || inDouble)) {
      i += 1
      continue
    }
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble
    } else if (!inSingle && !inDouble) {
      if (ch === '(') parenDepth += 1
      else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1)
      else if (ch === ';' && parenDepth === 0) {
        const item = body.slice(start, i).trim()
        if (item !== '') decls.push(item)
        start = i + 1
      }
    }
  }
  const tail = body.slice(start).trim()
  if (tail !== '') decls.push(tail)
  return decls
}

/**
 * Adapt dark theme selectors to match DSH's body attribute.
 * @param selector - Raw CSS selector.
 * @returns Adapted selector targeting DSH's dark-theme attribute.
 */
function adaptDarkSelector(selector) {
  return selector
    .replace(/:root\[data-theme=["']?dark["']?\]/gu, 'body[data-ds-dark-theme]')
    .replace(/html\[data-theme=["']?dark["']?\]/gu, 'body[data-ds-dark-theme]')
    .replace(/\[data-theme=["']?dark["']?\]/gu, '[data-ds-dark-theme]')
}

/**
 * Extract only non-token rules from a theme stylesheet.
 *
 * Custom properties (`--*`) are registered with the official theme runtime and
 * applied as inline properties on `document.body.style`. Leaving them in an
 * injected stylesheet would let root declarations shadow active dark/light mode
 * overrides. Only actual CSS rules (e.g. font-family, keyframes, layout adjustments)
 * reach the theme stylesheet.
 * @param css - Stylesheet text.
 * @returns Stylesheet containing only non-token rules.
 */
function extractNonTokenRules(css) {
  const source = css.replace(/\/\*[\s\S]*?\*\//gu, '')

  function processBlock(input) {
    let result = ''
    let cursor = 0
    while (cursor < input.length) {
      const open = input.indexOf('{', cursor)
      if (open === -1) break
      const header = input.slice(cursor, open).trim()
      let depth = 1
      let pos = open + 1
      while (pos < input.length && depth > 0) {
        if (input[pos] === '{') depth += 1
        else if (input[pos] === '}') depth -= 1
        pos += 1
      }
      const body = input.slice(open + 1, pos - 1)
      cursor = pos

      if (!header) continue

      if (header.startsWith('@')) {
        const lower = header.toLowerCase()
        if (lower.startsWith('@keyframes') || lower.startsWith('@font-face') || lower.startsWith('@counter-style')) {
          result += `${header} {\n${body.trim()}\n}\n`
        } else {
          const inner = processBlock(body)
          if (inner.trim() !== '') {
            result += `${header} {\n${inner.trim()}\n}\n`
          }
        }
      } else {
        const decls = parseDeclarations(body)
        const nonTokens = []
        for (const decl of decls) {
          const colon = decl.indexOf(':')
          if (colon === -1) continue
          const prop = decl.slice(0, colon).trim()
          const val = decl.slice(colon + 1).trim()
          if (!prop.startsWith('--')) {
            nonTokens.push(`  ${prop}: ${val};`)
          }
        }
        if (nonTokens.length > 0) {
          result += `${adaptDarkSelector(header)} {\n${nonTokens.join('\n')}\n}\n`
        }
      }
    }
    return result
  }

  return processBlock(source).trim()
}

/**
 * Disposer of the override layer currently stacked on the official runtime.
 *
 * A layer rather than a registered theme: a layer applies on top of whichever
 * theme is active and survives a preference change, so a settings transport
 * that lands after boot cannot silently undo it.
 */
let releaseOverrides = () => {}

/**
 * Serial number of the newest apply request.
 *
 * The layer is identified by one source, so a boot-time apply that is still
 * fetching must lose to a selection made while it was in flight.
 */
let applySeq = 0

/** Scheme a single-palette theme forced, or `null` when the theme adapts. */
let appliedScheme = null

/** Notified when the applied theme is dropped outside this card's own select. */
const themeChangeListeners = new Set()

/**
 * Drop a single-palette theme once the base palette moves to the other scheme.
 *
 * A pair theme adapts, so the appearance preference keeps deciding and this
 * leaves it alone. A single-palette theme cannot adapt: its layer carries one
 * set of values for both modes, so switching scheme keeps every token it
 * declares while the base palette flips, leaving a window split across the two.
 * Unloading it returns the whole window to the built-in palette instead.
 */
function syncSelection() {
  if (appliedScheme === null) return
  if (ctx.theme.getTheme().active.colorScheme === appliedScheme) return
  // Deferred: releasing the layer publishes, and a nested publish lets the
  // remaining listeners of the outer emit apply its now-stale snapshot, which
  // still carries the theme's values. Let the current emit finish first.
  const scheme = appliedScheme
  queueMicrotask(() => {
    if (appliedScheme !== scheme) return
    releaseOverrides()
    appliedScheme = null
    writeSaved('')
    for (const listener of themeChangeListeners) listener('')
  })
}
ctx.on('theme/change', syncSelection)

/**
 * Apply one theme, or clear back to the built-in palette.
 *
 * The tokens go to the official theme runtime as an override layer rather
 * than into a stylesheet, so the presenter applies them exactly as it applies
 * its own. `setTheme` still selects the base palette the theme asks for: the
 * override layer covers only the tokens the theme declares, and every token it
 * leaves alone would otherwise keep the colour of whichever scheme the user
 * last picked. Only the theme's non-token rules reach a stylesheet.
 * @param id - Theme id, or an empty string to clear.
 * @returns Whether the theme was applied.
 */
async function applyTheme(id) {
  const seq = ++applySeq
  releaseOverrides()
  appliedScheme = null
  style.textContent = ''
  if (id === '') return true
  const response = await fetch(CSS_URL(id), { signal, cache: 'no-store' })
  if (!response.ok) return false
  const css = await response.text()
  if (seq !== applySeq) return false
  const { light, dark } = parseTokenDeclarations(css)
  // A token declared in one palette only still has to reach both, or it would
  // be undefined in the other — the API takes a pair for every token.
  const modes = {}
  for (const name of new Set([...light.keys(), ...dark.keys()])) {
    modes[name] = {
      light: light.get(name) ?? dark.get(name),
      dark: dark.get(name) ?? light.get(name),
    }
  }
  // Syntax-highlighting tokens default to the theme's label and code-block
  // tokens so untokenized runs and diffs inherit the active mode's colors.
  if (!modes['--shiki-foreground'] && modes['--dsw-alias-label-primary']) {
    modes['--shiki-foreground'] = {
      light: modes['--dsw-alias-label-primary'].light,
      dark: modes['--dsw-alias-label-primary'].dark,
    }
  }
  if (!modes['--shiki-background']) {
    const bg = modes['--dsw-alias-markdown-code-block'] ?? modes['--dsw-alias-bg-base']
    if (bg) {
      modes['--shiki-background'] = {
        light: bg.light,
        dark: bg.dark,
      }
    }
  }
  releaseOverrides = ctx.theme.overrideTokens(THEME_ID_PREFIX, modes)
  // A theme with a dark set of its own adapts, and the appearance preference
  // keeps deciding which set applies. A theme stating one palette states one
  // look, so the base palette has to follow it: every token it leaves alone
  // would otherwise keep the other scheme's colour. Assigned after `setTheme`,
  // whose `theme/change` must not see this as a pending drop. A theme whose
  // base colour cannot be read gets no scheme of its own, so the user's
  // preference stands rather than being moved on a guess.
  if (dark.size === 0 && light.size > 0) {
    const scheme = themeColorScheme(css, light)
    if (scheme !== null) {
      ctx.theme.setTheme(scheme)
      appliedScheme = scheme
    }
  }
  style.textContent = extractNonTokenRules(css)
  return true
}

  // Read through the binding rather than handing out its value: the disposer is installed by the
  // first apply, long after this object is built, so a snapshot here would be the no-op it replaced.
  return { applyTheme, syncSelection, themeChangeListeners, releaseOverrides: () => releaseOverrides() }
}
