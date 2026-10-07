/** Real Chromium rendering/keyboard test of the standalone popup; no DSH server or credentials. */
import assert from 'node:assert/strict'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { attach, launch } from './driver.mjs'

const browser = await launch({ port: Number(process.env.DCT_CDP_PORT ?? 9415) })
let page
try {
  page = await attach(browser.endpoint)
  const initial = {
    locale: 'zh', dark: true, colors: { background: '#20242d', foreground: '#e9ebef', muted: '#9da7bb', accent: '#72b7e9', border: '#3b4457' },
    words: { unread: '未读', recent: '最近', more: '更多', back: '返回', newChat: '新会话', showMain: '打开 DeepSeek Harness', quit: '退出 DeepSeek Harness', running: '运行中', idle: '空闲', empty: '暂无会话' },
    unread: [{ sessionId: 'unread', title: '托盘功能迁移完成', context: 'dsh-custom-theme', status: 'unread' }],
    recent: [{ sessionId: 'running', title: '检查主题与背景渲染', context: '项目工作区', status: 'running' }, { sessionId: 'literal', title: '<img src=x onerror=alert(1)>', context: '标题按纯文本显示', status: 'idle' }],
    more: [{ sessionId: 'more', title: '更早的会话', context: 'Archive', status: 'idle' }],
  }
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.trayTest = { snapshot: ${JSON.stringify(initial)}, actions: [], resized: [] }; window.trayPopup = { ready: async () => {}, snapshot: async () => window.trayTest.snapshot, resize: async height => { window.trayTest.resized.push(height); return true }, run: async action => { window.trayTest.actions.push(action); if (window.trayTest.fail) throw new Error('simulated failure'); }, subscribe: callback => { window.trayTest.publish = callback; return () => {}; } };` })
  await page.send('Emulation.setDeviceMetricsOverride', { width: 320, height: 420, deviceScaleFactor: 1, mobile: false })
  await page.navigate(pathToFileURL(fileURLToPath(new URL('../../src/desktop/popup.html', import.meta.url))).href)
  assert.equal(await page.evaluate(`document.querySelectorAll('.session').length`), 3)
  assert.equal(await page.evaluate(`document.querySelectorAll('img').length`), 0, 'session titles must not be parsed as HTML')
  assert.equal(await page.evaluate(`getComputedStyle(document.body).backgroundColor`), 'rgb(32, 36, 45)')
  // The canvas carries the same token: a window taller than its menu must not show a
  // band of the window's own background under the last item.
  assert.equal(await page.evaluate(`getComputedStyle(document.documentElement).backgroundColor`), 'rgb(32, 36, 45)')
  // The document measures itself so the window can shrink to it.
  const fitted = await page.evaluate('window.trayTest.resized.at(-1)')
  assert.equal(typeof fitted, 'number', 'the popup never reported its height')
  assert.equal(fitted > 100 && fitted <= 420, true, `implausible popup height: ${fitted}`)
  assert.equal(await page.evaluate('Math.ceil(document.getElementById("menu").getBoundingClientRect().height) + 18 === window.trayTest.resized.at(-1)'), true)
  assert.equal(await page.evaluate(`document.body.scrollWidth <= innerWidth`), true)
  await page.evaluate(`document.querySelector('button').focus(); document.getElementById('menu').dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}))`)
  assert.equal(await page.evaluate(`document.activeElement.dataset.key`), 'quit')
  await page.evaluate(`document.getElementById('menu').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}))`)
  assert.equal(await page.evaluate(`document.activeElement.dataset.key`), 'unread')
  await page.clickText('更多 ›')
  assert.equal(await page.evaluate(`document.querySelectorAll('.session').length`), 1)
  assert.equal(await page.evaluate('window.trayTest.resized.at(-1) < 420'), true, 'the more view is shorter and the window follows it')
  await page.evaluate(`document.getElementById('menu').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`)
  assert.equal(await page.evaluate(`document.querySelectorAll('.session').length`), 3)
  await page.evaluate(`document.querySelector('[data-key="literal"]').click()`)
  assert.deepEqual(await page.evaluate('window.trayTest.actions.at(-1)'), { type: 'session', sessionId: 'literal' })
  await page.evaluate(`window.trayTest.fail = true; document.querySelector('[data-key="newChat"]').click()`)
  assert.equal(await page.evaluate(`document.getElementById('error').textContent`), 'simulated failure')
  await page.evaluate(`window.trayTest.fail = false; window.trayTest.publish({...window.trayTest.snapshot, reset:true})`)
  assert.equal(await page.evaluate(`document.getElementById('error').textContent`), '')
  await page.screenshot(resolve('.tmp/tray-popup-dark.png'))
  await page.evaluate(`window.trayTest.publish({...window.trayTest.snapshot, dark:false, colors:{}, reset:true})`)
  assert.equal(await page.evaluate(`getComputedStyle(document.body).backgroundColor`), 'rgb(255, 255, 255)')
  await page.screenshot(resolve('.tmp/tray-popup-light.png'))
  assert.deepEqual(page.diagnostics, [])
  console.log('PASS: popup text safety, light/dark, keyboard, more/back, actions, errors, layout; no server started')
} finally {
  page?.close()
  await browser.close()
}
