/* Local-only tray document. Render titles as text, never HTML or script. */
const menu = document.getElementById('menu')
const error = document.getElementById('error')
let snapshot = null
let view = 'root'
/* The window takes focus so that clicking anywhere else dismisses it, but a menu opened
   with the mouse must not shade its first row: the list itself holds the focus, and the
   arrow keys below still start from the first item. */
const focusFirst = () => {
  menu.focus({ preventScroll: true })
  if (document.activeElement !== menu) menu.querySelector('button')?.focus()
}
function button(label, action, key) {
  const element = document.createElement('button')
  element.type = 'button'
  element.role = 'menuitem'
  element.dataset.key = key
  element.textContent = label
  element.addEventListener('click', action)
  return element
}
function run(action) {
  error.textContent = ''
  window.trayPopup.run(action).catch((reason) => { error.textContent = String(reason.message || reason) })
}
/* A tray menu is as tall as what it holds. The window is created at the configured
   height, so the document measures itself and asks the main process to shrink or grow. */
let fitted = 0
function fit() {
  const height = Math.ceil(menu.getBoundingClientRect().height) + 18
  if (height === fitted) return
  fitted = height
  try {
    window.trayPopup.resize(height)?.catch?.(() => {})
  } catch {
    // A host that cannot resize keeps the configured height.
  }
}
function session(row) {
  const element = button('', () => run({ type: 'session', sessionId: row.sessionId }), row.sessionId)
  element.className = 'session'
  element.title = row.title + (row.context ? ` · ${row.context}` : '')
  const dot = document.createElement('span')
  dot.className = `dot ${row.status}`
  dot.setAttribute('aria-label', snapshot.words[row.status] || row.status)
  const copy = document.createElement('span')
  copy.className = 'copy'
  const title = document.createElement('strong')
  title.textContent = row.title
  copy.append(title)
  if (row.context) { const context = document.createElement('small'); context.textContent = row.context; copy.append(context) }
  element.append(dot, copy)
  return element
}
function render(next) {
  snapshot = next
  const focused = document.activeElement?.dataset.key
  const scroll = menu.scrollTop
  if (next.reset) { view = 'root'; error.textContent = '' }
  const root = document.documentElement
  root.lang = next.locale
  root.dataset.dark = String(next.dark === true)
  for (const key of ['background', 'foreground', 'muted', 'accent', 'border']) {
    root.style.removeProperty(`--${key}`)
    if (next.colors[key]) root.style.setProperty(`--${key}`, next.colors[key])
  }
  menu.replaceChildren()
  const switchView = (value) => { view = value; render({ ...snapshot, reset: false }); focusFirst() }
  if (view === 'more') {
    menu.append(button(`‹ ${next.words.back}`, () => switchView('root'), 'back'))
    menu.append(...next.more.map(session))
  } else {
    for (const group of ['unread', 'recent']) if (next[group].length) {
      const heading = document.createElement('div'); heading.className = 'heading'; heading.textContent = next.words[group]
      menu.append(heading, ...next[group].map(session))
    }
    if (next.more.length) menu.append(button(`${next.words.more} ›`, () => switchView('more'), 'more'))
    if (!next.unread.length && !next.recent.length && !next.more.length) { const empty = document.createElement('div'); empty.className = 'heading'; empty.textContent = next.words.empty; menu.append(empty) }
    menu.append(document.createElement('hr'))
    for (const type of ['newChat', 'showMain', 'quit']) {
      const element = button(next.words[type], () => run({ type }), type)
      if (type === 'quit') element.className = 'danger'
      menu.append(element)
    }
  }
  if (next.reset) { menu.scrollTop = 0; focusFirst() }
  else { [...menu.querySelectorAll('button')].find((el) => el.dataset.key === focused)?.focus(); menu.scrollTop = scroll }
  fit()
}
menu.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault()
    if (view === 'more') { view = 'root'; render({ ...snapshot, reset: false }); focusFirst() }
    else run({ type: 'dismiss' })
    return
  }
  const items = [...menu.querySelectorAll('button')]
  if (!items.length) return
  const index = items.indexOf(document.activeElement)
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : event.key === 'ArrowDown' ? (index + 1) % items.length : event.key === 'ArrowUp' ? (index <= 0 ? items.length : index) - 1 : null
  if (next !== null) { event.preventDefault(); items[next].focus() }
})
window.addEventListener('focus', focusFirst)
window.trayPopup.subscribe(render)
window.trayPopup.snapshot().then((next) => { if (next && !snapshot) render(next); return window.trayPopup.ready() }).catch((reason) => { error.textContent = String(reason.message || reason) })
