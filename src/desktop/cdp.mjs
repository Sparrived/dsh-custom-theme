/**
 * The smallest CDP client this feature needs.
 *
 * It speaks to the inspector Node already exposes, over the WebSocket client the
 * runtime provides. Nothing here is specific to the tray: it correlates responses by
 * id, fails pending calls when the socket closes, and never leaves a request hanging.
 */

/** @param url - A `ws://127.0.0.1:…` debugger URL from the inspector's own listing. */
export async function connectCdp(url, { WebSocketImpl = globalThis.WebSocket, timeout = 10000 } = {}) {
  if (typeof WebSocketImpl !== 'function') throw new Error('this runtime has no WebSocket client')
  if (!/^ws:\/\/127\.0\.0\.1:\d+\//u.test(url)) throw new Error('refusing a non-loopback debugger URL')
  const socket = new WebSocketImpl(url)
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('debugger socket did not open')), timeout)
    socket.onopen = () => { clearTimeout(timer); resolve() }
    socket.onerror = () => { clearTimeout(timer); reject(new Error('debugger socket failed')) }
  })
  let nextId = 0
  const pending = new Map()
  socket.onmessage = (event) => {
    let message
    try {
      message = JSON.parse(event.data)
    } catch {
      return
    }
    const waiter = pending.get(message.id)
    if (waiter === undefined) return
    pending.delete(message.id)
    if (message.error !== undefined) waiter.reject(new Error(message.error.message ?? 'debugger call failed'))
    else waiter.resolve(message.result)
  }
  const fail = () => {
    for (const waiter of pending.values()) waiter.reject(new Error('debugger socket closed'))
    pending.clear()
  }
  socket.onclose = fail
  socket.onerror = fail
  return {
    /** @param method - CDP method name. @param params - Its parameters. */
    send(method, params = {}) {
      const id = ++nextId
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { if (pending.delete(id)) reject(new Error(`${method} timed out`)) }, timeout)
        pending.set(id, {
          resolve: (value) => { clearTimeout(timer); resolve(value) },
          reject: (error) => { clearTimeout(timer); reject(error) },
        })
        socket.send(JSON.stringify({ id, method, params }))
      })
    },
    /** A call whose answer may never arrive (the inspector is closing under it). */
    fire(method, params = {}) {
      try {
        socket.send(JSON.stringify({ id: ++nextId, method, params }))
      } catch {
        // The socket is already gone, which is the expected outcome here.
      }
    },
    close() {
      fail()
      try {
        socket.close()
      } catch {
        // Closing a socket that already closed is not an error worth reporting.
      }
    },
  }
}

/** @param value - A CDP `Runtime.evaluate` result. @returns Its value, or throws the page's error. */
export function evaluateValue(result) {
  if (result?.exceptionDetails !== undefined) {
    const details = result.exceptionDetails
    throw new Error(details.exception?.description ?? details.text ?? 'evaluation failed')
  }
  return result?.result?.value
}
