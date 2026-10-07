/** Tray grouping ported from Deeptop (MIT, Copyright 2026 Sparrived). */
const compact = (value, cap) => typeof value === 'string' ? [...value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()].slice(0, cap).join('') : ''

function buildTraySnapshot(list, statuses, workspaces, presentation = {}) {
  const archived = new Set(workspaces.archivedSessionIds || [])
  const titles = new Map()
  for (const workspace of workspaces.items || []) for (const id of workspace.sessionIds || []) {
    if (!titles.has(id)) titles.set(id, compact(workspace.title, 80))
  }
  const rows = [...new Set(list.ids || [])].map((id) => list.byId?.[id])
    .filter((row) => typeof row?.id === 'string' && row.id.length <= 256 && row.id && !/[\u0000-\u0020\u007f]/u.test(row.id) && !archived.has(row.id) && !row.blank && row.origin !== 'subagent')
    .sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0) || a.id.localeCompare(b.id))
  const unreadIds = new Set(rows.filter((row) => {
    const status = statuses.get(row.id)
    return !(row.retainedBy?.mainView > 0) && (status?.pendingInteraction != null || status?.completionUnread === true)
  }).map((row) => row.id))
  const item = (row) => ({
    sessionId: row.id,
    title: compact(row.title, 160) || (presentation.locale === 'en' ? 'Untitled session' : '未命名会话'),
    context: titles.get(row.id) || compact(row.cwd?.replace(/[\\/]+$/u, '').split(/[\\/]/u).at(-1), 80),
    status: unreadIds.has(row.id) ? 'unread' : (statuses.get(row.id)?.running ?? row.running) ? 'running' : 'idle',
  })
  const unread = rows.filter((row) => unreadIds.has(row.id)).slice(0, 3).map(item)
  const recent = rows.filter((row) => !unreadIds.has(row.id)).slice(0, 4).map(item)
  const visible = new Set([...unread, ...recent].map((row) => row.sessionId))
  const more = rows.filter((row) => !visible.has(row.id)).slice(0, 12).map(item)
  return { ...presentation, unread, recent, more }
}

/** The wording the popup and the native menu use, in the shell's language. */
function trayWords(locale) {
  return locale === 'en'
    ? { unread: 'Unread', recent: 'Recent', more: 'More', newChat: 'New chat', showMain: 'Open DeepSeek Harness', quit: 'Quit', back: 'Back', empty: 'No sessions', running: 'Running' }
    : { unread: '未读', recent: '最近', more: '更多', newChat: '新建会话', showMain: '打开 DeepSeek Harness', quit: '退出', back: '返回', empty: '没有会话', running: '运行中' }
}

module.exports = { buildTraySnapshot, trayWords }
