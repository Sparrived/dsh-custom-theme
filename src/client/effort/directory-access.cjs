/**
 * effort/directory-access.cjs — the session's model directory, read and written through the shell.
 */
const { RETRY_DELAYS } = require('./constants.cjs')
const { EMPTY_MODEL_SNAPSHOT } = require('./math.cjs')

/**
 * One session's view of its model directory.
 *
 * `directoryFor(sessionId)` throws by design until a session's scope is bound, and the
 * directory itself can be rebuilt (a model generation change, a reconnect), so the
 * instance is resolved on every read rather than caught once and kept. A resolution that
 * fails backs off and retries; the subscription follows the instance.
 */
function createEffortDirectoryAccess(ctx, sessionId, timers) {
  const listeners = new Set()
  let directory = null
  let unsubscribe = null
  let last = EMPTY_MODEL_SNAPSHOT
  let retryIndex = 0
  let retryTimer = null
  let closed = false
  let lastLoadAt = 0

  function notify() {
    for (const listener of [...listeners]) {
      try {
        listener()
      } catch {
        // One subscriber's failure is not the others' problem.
      }
    }
  }

  function scheduleRetry() {
    if (closed || retryTimer !== null || retryIndex >= RETRY_DELAYS.length) return
    const delay = RETRY_DELAYS[retryIndex]
    retryIndex += 1
    retryTimer = timers.set(() => {
      retryTimer = null
      // A retry that succeeds has to announce itself: the caller (React's store
      // subscription) is waiting for the store to exist.
      if (resolve() !== null) {
        notify()
        return
      }
      // Without this the self-healing chain dies at the first failed retry and the
      // control stays silently dead — the exact "one bad moment at startup becomes a
      // permanently broken control" failure this is here to prevent.
      scheduleRetry()
    }, delay)
  }

  /** Resolve the directory again; re-subscribe when the instance changed. */
  function resolve() {
    if (closed) return null
    let fresh = null
    try {
      fresh = ctx.modelDirectories.directoryFor(sessionId)
    } catch {
      fresh = null
    }
    if (!fresh?.store || typeof fresh.store.getSnapshot !== 'function') fresh = null
    if (fresh === directory) return directory
    if (unsubscribe !== null) {
      try {
        unsubscribe()
      } catch {
        // A failed unsubscribe does not stop the new subscription.
      }
      unsubscribe = null
    }
    directory = fresh
    if (directory !== null) {
      retryIndex = 0
      try {
        unsubscribe = typeof directory.store.subscribe === 'function' ? directory.store.subscribe(notify) : null
      } catch {
        unsubscribe = null
      }
      kickLoad()
    }
    return directory
  }

  /** Pull the directory once: without a load the store sits idle and serves no levels. */
  function kickLoad() {
    if (closed || directory === null || typeof directory.load !== 'function') return
    const now = Date.now()
    if (now - lastLoadAt < 400) return
    lastLoadAt = now
    const target = directory
    try {
      Promise.resolve(target.load()).catch(() => {
        // The reason is carried in the store's own error field.
      })
    } catch {
      // A synchronous throw is the store's to report as well.
    }
  }

  return {
    getSnapshot() {
      if (closed) return EMPTY_MODEL_SNAPSHOT
      if (directory === null) {
        resolve()
        if (directory === null) scheduleRetry()
      }
      if (directory !== null) {
        try {
          const value = directory.store.getSnapshot()
          if (value && typeof value === 'object') last = value
        } catch {
          // Keep the previous snapshot rather than breaking the render.
        }
      }
      return last
    },
    subscribe(listener) {
      if (closed) return () => {}
      listeners.add(listener)
      if (directory === null) {
        resolve()
        if (directory === null) scheduleRetry()
      }
      // StrictMode subscribes and unsubscribes twice; unsubscribing must not close the access.
      return () => {
        listeners.delete(listener)
      }
    },
    /** The directory to write through, resolved at the moment of the call. */
    directory() {
      const fresh = resolve()
      return fresh !== null ? fresh : directory
    },
    load: kickLoad,
    dispose() {
      closed = true
      listeners.clear()
      if (retryTimer !== null) {
        try {
          timers.clear(retryTimer)
        } catch {
          // Nothing to report.
        }
        retryTimer = null
      }
      if (unsubscribe !== null) {
        try {
          unsubscribe()
        } catch {
          // Nothing to report.
        }
        unsubscribe = null
      }
      directory = null
    },
  }
}

module.exports = { createEffortDirectoryAccess }
