/**
 * dsh-custom-theme — Reasoning levels for the models that declare none.
 *
 * A third-party gateway that does not spell out its thinking levels gets none: `dsh-llm-pi-ai`
 * reports the model with no `reasoning` at all, the shell therefore draws no effort row, and any
 * level selected by hand is refused with `UNSUPPORTED_REASONING_EFFORT` before the request is
 * even built. The one place a level can be attached is the provider profile — so this module
 * edits the profile's own patch file and gives every such model `off/low/high/max`.
 *
 * The edit is line-based on purpose. That file is the user's document: their comments explain
 * why a gateway takes `off` and not `minimal`, and a YAML round-trip would throw all of it away.
 * Every line this module does not own comes back byte for byte, and everything it writes carries
 * a marker, so it can be recognised, refreshed and taken back out again.
 */

/**
 * The levels attached to a model that declares none, as `[level, wire value]`.
 *
 * A thinking level is the level's own name on the wire, but `off` carries **no value on purpose**.
 * The shell reads a declared `off` *with* a value as "send that value", and pi-ai's effort-less
 * paths then send it: automatic compaction (`purpose: "compaction"`) and session titles ask for a
 * summary without naming a level, and `Provider default` is the absence of one. A value there is
 * therefore a spelling spoken on the model's behalf in every one of those requests — `off` is right
 * for the DeepSeek upstreams that accept it and a 400 for an OpenAI-style gateway, where thinking
 * off is `none`. Leaving the value out keeps `off` out of the thinking map, which pi-ai reads as
 * "supported, send nothing" — not thinking is the parameter's absence — and each format then does
 * what it means: `thinking: { type: "disabled" }` on a DeepSeek-format route, `effort: "none"` on
 * the Responses and OpenRouter ones. A gateway that wants an explicit spelling still gets one from
 * a hand-written list, which this module never touches.
 *
 * The key is quoted in the file because YAML reads a bare `off` as a boolean.
 */
export const DEFAULT_EFFORT_LEVELS = [
  ['off', null],
  ['low', 'low'],
  ['high', 'high'],
  ['max', 'max'],
]

/** Marks a level list this plugin wrote. */
export const MANAGED_MARK = '# dsh-custom-theme:managed'

/**
 * Marks a level list this plugin wrote where the file said `reasoningEfforts: false`.
 *
 * Kept apart from the plain mark so turning the feature off can put the user's own `false` back
 * rather than leaving the model with no declaration at all.
 */
export const MANAGED_FROM_FALSE_MARK = '# dsh-custom-theme:managed-from-false'

/** The provider row this module is allowed to touch. */
const PROVIDER_ID = 'llm-pi-ai'

/** A model list item, at the indent its dashes sit at. */
const MODEL_ITEM = /^(\s*)-\s+id:\s*(\S.*?)\s*$/u

/** The key whose value decides whether a model needs levels. */
const EFFORT_KEY = /^(\s*)reasoningEfforts\s*:(.*)$/u

/** Scalars YAML would read as something other than a string. */
const QUOTED_SCALARS = new Set(['off', 'on', 'yes', 'no', 'true', 'false', 'null', '~'])

/** Characters at which a trailing comment starts in the values this module writes. */
const COMMENT = '#'

/**
 * The indentation of a line.
 * @param line - One line of the file.
 * @returns Its leading spaces as a number.
 */
function indentOf(line) {
  const match = /^(\s*)/u.exec(line)
  return match === null ? 0 : match[1].length
}

/**
 * A YAML scalar spelled so it survives being read back.
 * @param value - The token to write.
 * @returns The token, quoted when YAML would read it as a boolean or a number.
 */
function scalar(value) {
  const text = String(value)
  return QUOTED_SCALARS.has(text.toLowerCase()) || /^[\d.+-]+$/u.test(text) ? `"${text}"` : text
}

/**
 * The value of a key line, comment removed.
 * @param rest - Everything after the colon.
 * @returns The trimmed value with any trailing comment dropped.
 */
function valueOf(rest) {
  const at = rest.indexOf(COMMENT)
  return (at < 0 ? rest : rest.slice(0, at)).trim()
}

/**
 * One level line of the block.
 *
 * A level with no wire value is written as a key with nothing after it (`"off":`) rather than as an
 * empty string, which the shell refuses, or a guessed spelling, which every effort-less request
 * would then carry.
 * @param pad - The line's indentation.
 * @param level - The level's name, as the selector shows it.
 * @param wire - The value dispatch sends, or `null` for "send nothing".
 * @returns The line.
 */
function levelLine(pad, level, wire) {
  if (wire === null || wire === undefined) return `${pad}${scalar(level)}:`
  return `${pad}${scalar(level)}: ${scalar(wire)}`
}

/**
 * The `reasoningEfforts` block this plugin writes, as whole lines.
 * @param indent - Indentation of the key.
 * @param levels - `[level, wire]` pairs.
 * @param fromFalse - Whether the file declared `false` here.
 * @returns The lines of the block.
 */
function blockLines(indent, levels, fromFalse) {
  const pad = ' '.repeat(indent)
  const nested = ' '.repeat(indent + 2)
  return [
    `${pad}reasoningEfforts: ${fromFalse ? MANAGED_FROM_FALSE_MARK : MANAGED_MARK}`,
    ...levels.map(([level, wire]) => levelLine(nested, level, wire)),
  ]
}

/**
 * Whether a key line is one this plugin wrote.
 * @param line - The key line.
 * @returns `'plain'`, `'false'`, or `null` when the user wrote it.
 */
function managedKind(line) {
  if (!line.includes(MANAGED_MARK) && !line.includes(MANAGED_FROM_FALSE_MARK)) return null
  return line.includes(MANAGED_FROM_FALSE_MARK) ? 'false' : 'plain'
}

/**
 * Walk the models of every provider in the patch file's `llm-pi-ai` row.
 *
 * Each model is reported with the range of lines it occupies, so a caller can rewrite exactly
 * that model's `reasoningEfforts` without touching a neighbour.
 * @param lines - The file's lines.
 * @returns The model entries, in source order.
 */
function modelsOf(lines) {
  const rows = []
  const start = lines.findIndex((line) => new RegExp(`^-\\s+id:\\s*['"]?${PROVIDER_ID}['"]?\\s*$`, 'u').test(line))
  if (start < 0) return rows
  let end = lines.length
  for (let index = start + 1; index < lines.length; index += 1) {
    // A top-level entry at column 0 ends the row; everything nested belongs to it.
    if (/^-\s/u.test(lines[index]) && indentOf(lines[index]) === 0) {
      end = index
      break
    }
  }
  for (let index = start; index < end; index += 1) {
    const modelsKey = /^(\s*)models\s*:\s*$/u.exec(lines[index])
    if (modelsKey === null) continue
    const listIndent = modelsKey[1].length
    let itemIndent = null
    const items = []
    let cursor = index + 1
    while (cursor < end) {
      const line = lines[cursor]
      if (line.trim() !== '' && indentOf(line) <= listIndent) break
      const item = MODEL_ITEM.exec(line)
      if (item !== null) {
        const indent = item[1].length
        if (itemIndent === null) itemIndent = indent
        if (indent === itemIndent) items.push({ at: cursor, indent, id: item[2].replace(/^['"]|['"]$/gu, '') })
      }
      cursor += 1
    }
    items.forEach((item, position) => {
      const stop = position + 1 < items.length ? items[position + 1].at : cursor
      rows.push({ ...item, stop })
    })
    index = cursor - 1
  }
  return rows
}

/**
 * The line range of one model's `reasoningEfforts`, when it has one.
 * @param lines - The file's lines.
 * @param model - A row from `modelsOf`.
 * @returns `{ at, indent, value, kind, end }`, or `null` when the model declares none.
 */
function effortOf(lines, model) {
  for (let index = model.at + 1; index < model.stop; index += 1) {
    const match = EFFORT_KEY.exec(lines[index])
    if (match === null) continue
    const indent = match[1].length
    let end = index + 1
    while (end < model.stop && lines[end].trim() !== '' && indentOf(lines[end]) > indent) end += 1
    return { at: index, indent, value: valueOf(match[2]), kind: managedKind(lines[index]), end }
  }
  return null
}

/**
 * The indentation a new key under one model takes.
 * @param lines - The file's lines.
 * @param model - A row from `modelsOf`.
 * @returns The indent of the model's first field, or the dash's own indent plus two.
 */
function fieldIndentOf(lines, model) {
  for (let index = model.at + 1; index < model.stop; index += 1) {
    if (lines[index].trim() !== '') return indentOf(lines[index])
  }
  return model.indent + 2
}

/**
 * Rewrite the file's lines, from the last edit backwards so earlier offsets stay valid.
 * @param lines - The file's lines.
 * @param edits - `{ at, remove, insert }` records.
 * @returns The edited lines.
 */
function applyEdits(lines, edits) {
  const out = [...lines]
  for (const edit of [...edits].sort((left, right) => right.at - left.at)) {
    out.splice(edit.at, edit.remove, ...edit.insert)
  }
  return out
}

/**
 * Split text into lines and the ending style to put back.
 * @param text - File text.
 * @returns `{ lines, eol, finalNewline }`.
 */
function splitText(text) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const finalNewline = /\r?\n$/u.test(text)
  const lines = text.split(/\r?\n/u)
  if (finalNewline) lines.pop()
  return { lines, eol, finalNewline }
}

/**
 * Join lines back into text.
 * @param lines - The lines.
 * @param style - `{ eol, finalNewline }` from `splitText`.
 * @returns The file's new text.
 */
function joinText(lines, style) {
  return lines.join(style.eol) + (style.finalNewline ? style.eol : '')
}

/**
 * Read what the file currently says about reasoning levels.
 *
 * `undeclared` is the list the feature exists for: models the shell can offer nothing for.
 * `managed` is what this plugin already wrote.
 * @param text - The patch file's text.
 * @returns `{ undeclared, managed, declared }`, each a list of model ids.
 */
export function inspectEffortLevels(text) {
  const { lines } = splitText(text)
  const undeclared = []
  const managed = []
  const declared = []
  for (const model of modelsOf(lines)) {
    const effort = effortOf(lines, model)
    if (effort === null) undeclared.push(model.id)
    else if (effort.kind !== null) managed.push(model.id)
    else if (effort.value === 'false') undeclared.push(model.id)
    else declared.push(model.id)
  }
  return { undeclared, managed, declared }
}

/**
 * Attach the default levels to every model that declares none.
 *
 * Idempotent: a model that already carries this plugin's block is left as it is when the block
 * already matches, and rewritten when it does not. A model whose levels the user wrote down is
 * never touched, whatever it says.
 * @param text - The patch file's text.
 * @param levels - `[level, wire]` pairs to attach.
 * @returns `{ text, changed, models }`, where each model carries `id` and `action`.
 */
export function applyEffortLevels(text, levels = DEFAULT_EFFORT_LEVELS) {
  const style = splitText(text)
  const lines = style.lines
  const edits = []
  const models = []
  for (const model of modelsOf(lines)) {
    const effort = effortOf(lines, model)
    if (effort === null) {
      edits.push({ at: model.at + 1, remove: 0, insert: blockLines(fieldIndentOf(lines, model), levels, false) })
      models.push({ id: model.id, action: 'added' })
      continue
    }
    if (effort.kind !== null) {
      const block = blockLines(effort.indent, levels, effort.kind === 'false')
      edits.push({ at: effort.at, remove: effort.end - effort.at, insert: block })
      const current = lines.slice(effort.at, effort.end)
      models.push({ id: model.id, action: current.join('\n') === block.join('\n') ? 'unchanged' : 'updated' })
      continue
    }
    if (effort.value === 'false') {
      edits.push({ at: effort.at, remove: effort.end - effort.at, insert: blockLines(effort.indent, levels, true) })
      models.push({ id: model.id, action: 'replaced-false' })
      continue
    }
    models.push({ id: model.id, action: 'kept' })
  }
  const next = joinText(applyEdits(lines, edits), style)
  return { text: next, changed: next !== text, models }
}

/**
 * Take every managed level list back out.
 *
 * A model this plugin gave levels to because the file said `false` gets that `false` back; one
 * that had no key at all gets no key again.
 * @param text - The patch file's text.
 * @returns `{ text, changed, models }`.
 */
export function revertEffortLevels(text) {
  const style = splitText(text)
  const lines = style.lines
  const edits = []
  const models = []
  for (const model of modelsOf(lines)) {
    const effort = effortOf(lines, model)
    if (effort === null || effort.kind === null) continue
    const restore = effort.kind === 'false' ? [`${' '.repeat(effort.indent)}reasoningEfforts: false`] : []
    edits.push({ at: effort.at, remove: effort.end - effort.at, insert: restore })
    models.push({ id: model.id, action: effort.kind === 'false' ? 'restored-false' : 'removed' })
  }
  const next = joinText(applyEdits(lines, edits), style)
  return { text: next, changed: next !== text, models }
}
