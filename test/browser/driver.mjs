/**
 * Minimal Chrome DevTools Protocol driver used by `appearance.mjs`.
 *
 * There is no Playwright or Puppeteer in this checkout, so this launches an
 * installed Chromium browser (headless by default), attaches to a page target
 * over the DevTools WebSocket, and exposes the handful of operations a UI smoke
 * test needs: evaluate, wait, click by text, set a controlled input, screenshot.
 *
 * Not shipped: `files` in package.json lists only `src`, `lib/client.js`,
 * `themes`, the patch file and the README.
 */

import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

const BROWSER_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/microsoft-edge',
  '/usr/bin/google-chrome',
]

/** Locate an installed Chromium browser. @returns Executable path. */
export function findBrowser() {
  const found = BROWSER_CANDIDATES.find((candidate) => existsSync(candidate))
  if (found === undefined) throw new Error(`no Chromium browser found; tried ${BROWSER_CANDIDATES.join(', ')}`)
  return found
}

/** Sleep. @param ms - Milliseconds. @returns Resolves after the delay. */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Launch a headless browser with DevTools enabled.
 * @param options - `port` (DevTools port) and `headless`.
 * @returns `{ endpoint, close }`; `close` kills the browser and removes its profile.
 */
export async function launch({ port = 9222, headless = true } = {}) {
  const executable = findBrowser()
  const userDataDir = await mkdtemp(join(tmpdir(), 'dct-browser-'))
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-sync',
    '--window-size=1440,960',
    ...(headless ? ['--headless=new', '--hide-scrollbars'] : []),
    'about:blank',
  ]
  // `stdio: 'ignore'` keeps the browser's streams out of this process, which the
  // DSH file sandbox requires for a spawned child.
  const child = spawn(executable, args, { stdio: 'ignore', windowsHide: true })

  const deadline = Date.now() + 30_000
  let version
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (response.ok) {
        version = await response.json()
        break
      }
    } catch {
      // The port is not listening yet.
    }
    await delay(250)
  }
  if (version === undefined) throw new Error('the browser never opened its DevTools port')

  return {
    endpoint: `http://127.0.0.1:${port}`,
    browser: version.Browser,
    async close() {
      child.kill()
      await delay(300)
      await rm(userDataDir, { recursive: true, force: true }).catch(() => {})
    },
  }
}

/**
 * Attach to the first page target, creating one when the browser has none.
 * @param endpoint - DevTools HTTP endpoint from {@link launch}.
 * @returns CDP session helpers.
 */
export async function attach(endpoint) {
  let targets = await (await fetch(`${endpoint}/json/list`)).json()
  let page = targets.find((target) => target.type === 'page')
  if (page === undefined) {
    page = await (await fetch(`${endpoint}/json/new?about:blank`, { method: 'PUT' })).json()
  }

  const socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.onopen = resolve
    socket.onerror = () => reject(new Error('DevTools WebSocket failed to open'))
  })

  let nextId = 1
  const pending = new Map()
  /** Page-side errors and warnings seen since attach, for failure diagnosis. */
  const diagnostics = []
  /** Handlers for requests the Fetch domain paused; see `stubFetch`. */
  const pausedHandlers = []
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (message.method === 'Fetch.requestPaused') {
      for (const handler of pausedHandlers) handler(message.params)
    } else if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params.exceptionDetails
      diagnostics.push(`exception: ${details.exception?.description ?? details.text}`)
    } else if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params.type)) {
      diagnostics.push(`console.${message.params.type}: ${message.params.args.map((a) => a.value ?? a.description ?? a.type).join(' ')}`)
    }
    const entry = message.id === undefined ? undefined : pending.get(message.id)
    if (entry === undefined) return
    pending.delete(message.id)
    if (message.error) entry.reject(new Error(`${message.error.message} (${JSON.stringify(message.error.data ?? null)})`))
    else entry.resolve(message.result)
  }

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })

  await send('Page.enable')
  await send('Runtime.enable')

  /**
   * Evaluate an expression in the page and return its value.
   * @param expression - Expression; may use `await` when it evaluates to a promise.
   * @returns The JSON value of the result.
   */
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })
    if (result.exceptionDetails) {
      throw new Error(`page exception: ${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text}`)
    }
    return result.result.value
  }

  return {
    send,
    evaluate,
    diagnostics,
    /**
     * Answer a route from the test instead of from the Host.
     *
     * This is how the suite stands in front of a Host older than the page it is serving.
     * A plugin updated in place does exactly that: the bundle is read from disk on every
     * request, so a refresh brings up the new panel, while the Host half — imported once
     * at boot — still answers `405` to a route the panel has started using.
     * @param pattern - URL substring to intercept; other requests are left alone.
     * @param reply - `{ status, body }` to answer matching requests with.
     * @param options - `method` limits the stub to one HTTP method.
     */
    async stubFetch(pattern, reply, { method } = {}) {
      pausedHandlers.push((params) => {
        const request = params.request
        const matches = request.url.includes(pattern) && (method === undefined || request.method === method)
        // A pattern can catch a sibling request — the listing shares the upload path — so
        // anything that is not the stubbed call is passed through untouched.
        if (!matches) return send('Fetch.continueRequest', { requestId: params.requestId })
        return send('Fetch.fulfillRequest', {
          requestId: params.requestId,
          responseCode: reply.status,
          responseHeaders: [{ name: 'content-type', value: reply.contentType ?? 'text/plain; charset=utf-8' }],
          body: Buffer.from(reply.body ?? '').toString('base64'),
        })
      })
      await send('Fetch.enable', { patterns: [{ urlPattern: `*${pattern}*` }] })
    },
    /** Stop standing in for the Host, so later steps reach the real one again. */
    async clearStub() {
      pausedHandlers.length = 0
      await send('Fetch.disable')
    },
    /** Navigate and wait for the load event. @param url - Target URL. */
    async navigate(url) {
      const loaded = new Promise((resolve) => {
        socket.addEventListener('message', function onMessage(event) {
          if (JSON.parse(event.data).method === 'Page.loadEventFired') {
            socket.removeEventListener('message', onMessage)
            resolve()
          }
        })
      })
      await send('Page.navigate', { url })
      await Promise.race([loaded, delay(20_000)])
    },
    /**
     * Poll an expression until it is truthy.
     * @param expression - Expression evaluated repeatedly.
     * @param options - `timeout` in ms and a `label` used in the error.
     * @returns The first truthy value.
     */
    async waitFor(expression, { timeout = 20_000, label = expression } = {}) {
      const deadline = Date.now() + timeout
      let last
      while (Date.now() < deadline) {
        last = await evaluate(expression).catch((error) => `error: ${error.message}`)
        if (last) return last
        await delay(200)
      }
      throw new Error(`timed out waiting for ${label}; last value: ${JSON.stringify(last)}`)
    },
    /**
     * Click the first element whose trimmed text equals `text`.
     * @param text - Exact visible label.
     * @returns True when something was clicked.
     */
    clickText(text) {
      return evaluate(`(() => {
        const wanted = ${JSON.stringify(text)};
        const nodes = [...document.querySelectorAll('button, [role="button"], [role="tab"], a, li, div[tabindex]')];
        const hit = nodes.find((n) => (n.innerText || '').trim() === wanted)
          ?? nodes.find((n) => (n.innerText || '').trim().split('\\n').includes(wanted));
        if (!hit) return false;
        hit.scrollIntoView({ block: 'center' });
        hit.click();
        return true;
      })()`)
    },
    /**
     * Set a controlled form value the way React observes it.
     * @param selector - Target element selector.
     * @param value - New value.
     * @returns True when the element existed.
     */
    setValue(selector, value) {
      return evaluate(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return false;
        const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype
          : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()`)
    },
    /**
     * Choose the zone being edited, through the workbench tab that names it.
     * @param id - Zone id, as carried by the tab's `data-dct-tab`.
     * @returns True when the tab existed.
     */
    clickZone(id) {
      return evaluate(`(() => {
        const tab = document.querySelector('[data-dct-tab="' + ${JSON.stringify(id)} + '"]');
        if (!tab) return false;
        tab.scrollIntoView({ block: 'center' });
        tab.click();
        return true;
      })()`)
    },
    /**
     * Capture a screenshot.
     * @param path - Output PNG path.
     * @returns The path written.
     */
    async screenshot(path) {
      // The directory is the caller's to choose, and a run that names a fresh one
      // should write into it rather than die on the first capture.
      await mkdir(dirname(path), { recursive: true })
      // `captureBeyondViewport` (the default in recent builds) resizes the layout
      // viewport for a full-page capture, which re-renders a responsive shell and
      // can close the panel under test.
      const { data } = await send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false,
        fromSurface: true,
      })
      await writeFile(path, Buffer.from(data, 'base64'))
      return path
    },
    close() {
      socket.close()
    },
  }
}

export { delay }
