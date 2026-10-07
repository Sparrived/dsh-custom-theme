# dsh-custom-theme — temporary renderer diagnostics (instrument build)

**This is instrumentation, not a fix.** It exists to answer one question about a
reproducible DSH Desktop freeze:

> When the renderer stops drawing for seconds, whose code is running — this
> plugin's passes, or the shell's own rendering?

Everything here is disposable: `restore.mjs` puts the pristine plugin back, byte
for byte, and verifies it by SHA-256.

*Nothing in this directory is part of the plugin's release sources.* The
repository's `lib/client.js`, `test/client.test.mjs`, `test/harness.mjs`,
`package.json`, `CHANGELOG.md`, `README.md` and `releases/**` are only ever *read*.

---

## What was installed, and where

Two places, and nowhere else:

| File | What was added |
| --- | --- |
| `<profile>\node_modules\dsh-custom-theme\lib\client.js` | a self-contained `const __dctDiag = (() => { … })()` runtime at the top of the factory, plus timers around the six existing pass functions |
| `<profile>\node_modules\dsh-custom-theme\src\index.mjs` | a dev-only `GET`/`POST /dsh-custom-theme/diag` route that appends JSON lines to a log file |

Pristine copies of both live in `<plugin>\.dct-diag-backup\` with a
`manifest.json` recording their hashes.

The installed files are **new inodes**: the profile's files are hardlinks of the
pnpm content-addressed store, so the installer writes a temp sibling, deletes the
target and renames — writing in place would corrupt the store and every other
profile that shares it. `nlink` is verified to be 1 afterwards, and the store
files and `profiles\dct-repro`'s copy are re-hashed to prove they did not move.

### The log

```
C:\Users\ASUS\.dsh\profiles\desktop\dct-diagnostics.log
```

JSON Lines: one line per flushed payload, `{"receivedAt": …, "payload": { … }}`.
The path is fixed regardless of any profile rename; `DCT_DIAG_LOG` overrides it
for the Host process.

---

## Arming it

The Host computes the client bundle's revision from the file's mtime, size and
ctime, and the client bundle is served **as-is** (there is no build step), so:

1. **Restart the DSH Desktop app once.** Nothing else. No rebuild, no server.

   *(The restart is left to you on purpose — this instrument build does not
   restart anybody's app.)*

2. Reproduce the freeze: stream a markdown-dense reply and watch the connection
   pill cycle 重新连接中 → 连接成功.

3. After a restart, the log file appears **within seconds** with a `hello` line
   even if nothing has gone wrong yet. If it does not appear, the instrumented
   bundle is not what the app loaded — see *Caveats* below.

`localStorage['dsh-custom-theme.diagnostics']` holds a readable mirror of the
most recent samples if the route never answers (dump it from DevTools → Console:
`copy(localStorage.getItem('dsh-custom-theme.diagnostics'))`).

---

## Reading the log

```powershell
# the whole picture: sessions, stall totals, attribution, pass totals, verdict
node test/diagnostics/read-log.mjs

# a different file, or more than the top 15 stalls
node test/diagnostics/read-log.mjs --file C:\path\to\dct-diagnostics.log --top 40

# machine-readable
node test/diagnostics/read-log.mjs --json
```

Use the bundled Node if `node` is not on `PATH`:

```powershell
& "C:\Users\ASUS\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe" test/diagnostics/read-log.mjs
```

Quick spot checks without the tool:

```powershell
# is the instrument build alive at all?
Test-Path C:\Users\ASUS\.dsh\profiles\desktop\dct-diagnostics.log
# every connection/lifecycle signal with its wall-clock time
Select-String -Path C:\Users\ASUS\.dsh\profiles\desktop\dct-diagnostics.log -Pattern 'connection lost|retry #|online|offline|visibilitychange'
# stalls of 1s or more, with who held the thread
Get-Content C:\Users\ASUS\.dsh\profiles\desktop\dct-diagnostics.log |
  ForEach-Object { ($_ | ConvertFrom-Json).payload } |
  ForEach-Object { $_.stalls } | Where-Object { $_.d -ge 1000 } |
  Select-Object endWall, d, cover, pluginMs, head, win, elems, ink, txn
```

### How to read a stall

Each stall record is the rAF watchdog's gap, bracketed by wall-clock time:

| Field | Meaning |
| --- | --- |
| `d` | the gap in ms (the freeze as felt) |
| `s` / `e` | start/end in ms since the plugin booted; `startWall` / `endWall` are absolute |
| `head` | ms of the window that belongs to the *frame task that opened it* — that task ran the frame's plugin passes, so its tail is inside every window by construction |
| `win` | the window measured after that tail: `e − s − head` |
| `pluginMs` | how much of `win` this plugin's own top-level passes were actually running |
| `cover` | `pluginMs / win` — **the decisive number** |
| `p[]` | every intersecting pass: name, trigger, depth, its own duration, and its overlap |
| `near` | the plugin pass that finished closest before the stall ended, and how long before |
| `elems`, `ink`, `txn` | `document.body` element count, live ink count, and text nodes the mutation records named since the last frame |
| `suspended` | the gap spans a hidden window, i.e. throttling rather than a stall |

**`cover` near 0 over hundreds of ms is the finding: no pass of this plugin's was
running, so the shell held the main thread.** `cover` near 1 is this plugin.
0.15–0.5 is genuinely mixed — read `p[]` and `near` for which pass.

`longTasks` (the `PerformanceObserver`) is the independent second opinion, with
the same `cover` split; `c` is its coverage, `k` its classification.

---

## What is recorded

* **rAF watchdog** — every frame gap over 250 ms, flagged `severe` over 1 s, with
  start/end/duration and the wall-clock window; plus `PerformanceObserver('longtask')`
  (buffered). A gap spanning a hidden window is marked `suspended`, not blamed.
* **Attribution** — `tickStreamInk` (both the rAF batch and the observer call),
  the zone observer's synchronous pass, `applyBackgroundsWhenReady` (including
  retries and the boot call), `tickReasoningExpand` and its
  `querySelectorAll('[data-variant="think"]')`, and the reasoning/zone mutation
  observers — each as name, start, duration, and trigger.
* **Shell signals** — `console.warn` / `console.error` are intercepted **and
  copied through** (never swallowed), matched against
  `[connection]|connection lost|retry #N|remote.mux|websocket|reconnect`;
  plus `navigator.onLine` transitions and `visibilitychange` / `pagehide`.
* **Per-frame context** — element count, live ink count, and the count of new
  text nodes named by mutation records, recorded as counters (no per-frame objects).

Cost: counters per mutation, fixed ring buffers, one small POST every few seconds
plus one on each severe stall, the unload flush, and a manual flush. The runtime
is wrapped so that **no path can throw into the plugin or the shell**, no pass is
ever skipped, and the plugin is never blocked.

### How the flush reaches the Host

Every few seconds and on `pagehide` / `visibilitychange` (hidden) / severe stall,
the client POSTs JSON to `/dsh-custom-theme/diag` on the plugin's own route
prefix — the same origin and default credentials as the plugin's existing
requests. The Host route creates the log directory if needed, appends one line,
and never throws: a malformed, empty or oversized body is answered `{ok:false}`.
If the POST fails the samples are restored to the pending buffers, and the
`localStorage` mirror is always written first.

---

## Restoring

```powershell
# put the pristine files back and verify them by SHA-256
node test/diagnostics/restore.mjs

# check the current state without writing anything
node test/diagnostics/restore.mjs --verify-only
```

`--verify-only` reports `pristine` (the installed files match the backup) and
`instrumented` (they match the instrumented build). It also works after a profile
rename, because it reads the manifest rather than any hard-coded path.

**The app must be restarted once after restoring**, for the same reason it had to
be restarted after installing: the bundle revision comes from the file's mtime.

Use `--profile <dir>` for either tool if the plugin is not in
`profiles\desktop\node_modules\dsh-custom-theme`.

---

## Checks that were run (all pass)

```powershell
node test/diagnostics/smoke.mjs               # 22/22  the runtime inside the repo's DOM harness
node test/diagnostics/host-route-check.mjs    #  9/9   the Host route, driven with fake requests
node test/diagnostics/end-to-end-check.mjs    #  8/8   client → route → log file → parser
node test/diagnostics/suite-check.mjs         # generates patched copies of the repo's own suite
```

`smoke.mjs` proves the fail-safe properties: an instrumented pass still re-throws
the original error, `console.warn` is still delivered, the plugin still paints its
ink and still disposes cleanly, and a 420 ms synthetic stall is attributed to the
plugin while a stall with no pass is attributed to the shell.

`suite-check.mjs` runs the repository's **own 58 client tests** against the
*installed instrumented bundle* — including its source-level assertions, which are
pointed at the installed file, so they check the bytes that are really there. It
writes its patched copies to a temp directory and never touches the originals:

```powershell
node test/diagnostics/suite-check.mjs
node --test "$env:TEMP\dct-diag-suite\client-suite.mjs"    # 58/58
```

`read-log.mjs` is itself exercised against `test/diagnostics/.e2e-sample.log`, a
log produced by `end-to-end-check.mjs` (one shell-attributed stall, one
plugin-attributed stall, one connection warn):

```powershell
node test/diagnostics/read-log.mjs --file test/diagnostics/.e2e-sample.log
```

---

## Caveats — what is *not* covered

* **A profile rename moves the installation.** If the app migrates
  `profiles\desktop` → `profiles\deeptop` on its next start, the instrumented
  files move with the directory (they are inside it), so they still load; pass
  `--profile …\profiles\deeptop\node_modules\dsh-custom-theme` to the tools
  afterwards. The *log* stays where it is: `profiles\desktop\dct-diagnostics.log`.
* **If the app loads the plugin from somewhere else** — a `dev.overlay.yml` or a
  `file:` dependency pointing at the repository — the instrumented bundle will
  not be loaded, and the log will stay empty. `profiles\desktop\package.json`
  depends on the registry version, so the installed copy is what loads.
* **`longtask` needs the observer.** If the renderer does not support it,
  `longTaskSupported: false` is reported rather than silently assumed; the rAF
  watchdog is the primary instrument either way.
* **The watchdog measures gaps, not causes.** It cannot see inside the shell: a
  stall with `cover ≈ 0` says the shell held the thread, not *which* shell code
  did it. The per-chunk KaTeX re-typeset hypothesis has to be tested by the shell
  side (e.g. gating the streaming fade), not from here.
* **Console interception is best-effort** for the shell's own logger: `console.warn`
  and `console.error` are wrapped defensively, and the original is always called
  first. If the shell captured a reference to the original before this plugin
  loaded, those calls bypass the wrapper (the connection warn is emitted through
  `console.warn` directly, so it is captured).
* **`pagehide` flushes are best-effort by nature.** The unload flush is `keepalive`
  and is sent beside any in-flight request, but a hard process kill can still lose
  the last few seconds; the periodic flush bounds that loss.
