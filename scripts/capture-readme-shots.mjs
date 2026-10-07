import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import { launch, attach, delay } from '../test/browser/driver.mjs'

function decodeBase64Url(value) {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  return Buffer.from(value.replaceAll('-', '+').replaceAll('_', '/') + padding, 'base64')
}
function encodeBase64Url(value) {
  return Buffer.from(value).toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

async function main() {
  const rawSecret = 'f1QYNbDOCzz9Epg0KN8wVWtDPKYHUSGVSr-0ZIh37mw'
  const secret = decodeBase64Url(rawSecret)
  const authority = '127.0.0.1:19387'
  const cookieName = 'dsh-auth-' + encodeBase64Url(crypto.createHash('sha256').update(authority).digest())
  const issuedAt = Date.now()
  const expiresAt = issuedAt + 30 * 24 * 3600 * 1000
  const payload = { version: 1, authority, issuedAt, expiresAt }
  const body = encodeBase64Url(Buffer.from(JSON.stringify(payload), 'utf8'))
  const sig = crypto.createHmac('sha256', secret).update(body).digest()
  const cookieValue = 'v1.' + body + '.' + encodeBase64Url(sig)

  await fs.mkdir('docs/images', { recursive: true })

  console.log('Launching browser (1440x960)...')
  const browser = await launch({ port: 9555, headless: true })
  const page = await attach(browser.endpoint)
  await page.send('Network.enable')
  await page.send('Network.setCookie', { name: cookieName, value: cookieValue, domain: '127.0.0.1', path: '/' })

  await page.navigate('http://127.0.0.1:19387/')
  await delay(2500)
  try { await page.clickText('继续') } catch (e) {}
  await delay(500)

  // 1. Open a session from sidebar
  console.log('Opening a session...')
  await page.evaluate(`(() => {
    const sessionItem = [...document.querySelectorAll('div, li, button')].find(el => el.innerText && el.innerText.includes('双语 README'));
    if (sessionItem) sessionItem.click();
  })()`)
  await delay(2000)

  // 2. Open model menu and capture reasoning slider
  console.log('Capturing reasoning slider...')
  await page.evaluate(`(() => {
    const btn = document.querySelector('button[aria-label*="选择模型"]') || document.querySelector('button.wq12jW_trigger');
    if (btn) btn.click();
  })()`)
  await delay(1200)
  await page.screenshot('docs/images/reasoning-slider-showcase.png')
  console.log('Saved reasoning-slider-showcase.png')

  // Close model menu by clicking background / body
  await page.evaluate(`(() => {
    // Click outside composer and outside menu
    const target = document.querySelector('[class*="_sidebarCol"]') || document.body;
    target.click();
  })()`)
  await delay(800)

  // Verify menu closed
  await page.evaluate(`(() => {
    const openMenu = document.querySelector('[role="menu"]');
    if (openMenu) openMenu.remove();
  })()`)
  await delay(300)

  // Helper functions
  async function openSettings() {
    await page.evaluate(`(() => {
      const btn = document.querySelector('button[aria-label="设置"]') || document.querySelector('button.wCInkW_trigger');
      if (btn) btn.click();
    })()`)
    await delay(1000)
    await page.clickText('主题与背景')
    await delay(1200)
  }

  async function closeSettings() {
    await page.evaluate(`(() => {
      const closeBtn = document.querySelector('button.wCInkW_close') || document.querySelector('button[class*="_close"]');
      if (closeBtn) closeBtn.click();
    })()`)
    await delay(800)
  }

  // 3. Open Settings and capture cards cleanly
  console.log('Capturing Settings cards...')
  await openSettings()

  // Theme & Typography & Streaming Ink
  await page.evaluate(`(() => {
    const card = document.querySelector('[data-card="theme"]');
    if (card) card.scrollIntoView({ block: 'start' });
  })()`)
  await delay(600)
  await page.screenshot('docs/images/settings-themes.png')
  console.log('Saved settings-themes.png')

  // Background workbench
  await page.evaluate(`(() => {
    const card = document.querySelector('[data-card="background"]');
    if (card) card.scrollIntoView({ block: 'start' });
  })()`)
  await delay(600)
  await page.screenshot('docs/images/settings-backgrounds.png')
  console.log('Saved settings-backgrounds.png')

  // Working text & effects
  await page.evaluate(`(() => {
    const card = document.querySelector('[data-card="working"]');
    if (card) card.scrollIntoView({ block: 'start' });
  })()`)
  await delay(600)
  await page.screenshot('docs/images/settings-working.png')
  console.log('Saved settings-working.png')

  // Streaming, Reasoning auto-expand, Injections
  await page.evaluate(`(() => {
    const card = document.querySelector('[data-card="streaming"]') || document.querySelector('[data-card="reasoning"]');
    if (card) card.scrollIntoView({ block: 'start' });
  })()`)
  await delay(600)
  await page.screenshot('docs/images/settings-advanced.png')
  console.log('Saved settings-advanced.png')

  // 4. Test One Dark theme & screenshot chat
  console.log('Switching to One Dark...')
  await page.evaluate(`(() => {
    const card = document.querySelector('[data-card="theme"]');
    if (card) card.scrollIntoView({ block: 'start' });
  })()`)
  await delay(300)
  await page.setValue('.dct-theme', 'one-dark')
  await delay(1000)
  await closeSettings()
  await delay(1000)
  await page.screenshot('docs/images/chat-one-dark.png')
  console.log('Saved chat-one-dark.png')

  // 5. Test Monokai Pro theme & screenshot chat
  console.log('Switching to Monokai Pro...')
  await openSettings()
  await page.setValue('.dct-theme', 'monokai-pro')
  await delay(1000)
  await closeSettings()
  await delay(1000)
  await page.screenshot('docs/images/chat-monokai-pro.png')
  console.log('Saved chat-monokai-pro.png')

  // 6. Test Gov theme & screenshot chat
  console.log('Switching to Gov...')
  await openSettings()
  await page.setValue('.dct-theme', 'gov')
  await delay(1000)
  await closeSettings()
  await delay(1000)
  await page.screenshot('docs/images/chat-gov.png')
  console.log('Saved chat-gov.png')

  // 7. Reset theme back to default
  await openSettings()
  await page.setValue('.dct-theme', '')
  await delay(800)
  await closeSettings()

  await browser.close()
  console.log('All clean showcase images successfully generated!')
}

main().catch(console.error)
