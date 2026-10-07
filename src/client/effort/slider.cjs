/**
 * effort/slider.cjs — the control itself: the track, its layers, the drag and the keyboard path.
 */
const { createEffortBridge } = require('./bridge.cjs')
const { COMMIT_DEADLINE_MS, AMBIENCE_FRAME_EVERY, COMMIT_THROTTLE_MS, EFFORT_THEME_KEY, EFFORT_THEMES, KNOB_RADIUS, QUOTA_NOTICE_MS, REDUCED_MOTION_SLOWDOWN, readSavedEffortTheme } = require('./constants.cjs')
const { createEffortDirectoryAccess } = require('./directory-access.cjs')
const { EFFORT_STARS, EMPTY_MODEL_SNAPSHOT, clamp01, effectiveEffortId, effortLevelsOf, energyFor, fillBackgroundFor, indexFromPct, indexOfLevel, knobOffsetOf, pctFromIndex, speedFor, starBrightnessFor, starCountFor, starDelayFor, starDurationFor, starLayerOpacityFor, valueColorFor } = require('./math.cjs')
const { effortErrorText } = require('./messages.cjs')
const { h } = require('../shared/element.cjs')
const React = require('react')
const ReactDOM = require('react-dom')

/* ── The control ──────────────────────────────────────────────────────────── */

/**
 * The slider.
 *
 * One component holds the anchor, the bridge and the control itself, so the hooks belong
 * to a single instance that never re-orders them when the menu opens and closes. The
 * control is portalled into the container the bridge put in the shell's row; the component
 * itself renders the invisible anchor that keeps its place in the composer.
 */
function EffortSlider(props) {
  const sessionId = typeof props.sessionId === 'string' && props.sessionId.length > 0 ? props.sessionId : null
  const locked = props.locked === true
  const ctx = props.__ctx
  const t = typeof props.t === 'function' ? props.t : (key) => key

  const [savedTheme, setSavedTheme] = React.useState(readSavedEffortTheme)
  const activeTheme = props.theme || savedTheme

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const onThemeChange = (event) => {
      if (event?.detail && EFFORT_THEMES.includes(event.detail)) {
        setSavedTheme(event.detail)
      }
    }
    const onStorage = (event) => {
      if (event?.key === EFFORT_THEME_KEY) {
        setSavedTheme(readSavedEffortTheme())
      }
    }
    window.addEventListener('dsh-effort-theme-change', onThemeChange)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('dsh-effort-theme-change', onThemeChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  /** Reduced motion changes how strong the effect is, never whether it works. */
  let reducedMotion = false
  try {
    reducedMotion = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches === true
  } catch {
    reducedMotion = false
  }

  const access = React.useMemo(
    () => (sessionId === null || !ctx
      ? null
      : createEffortDirectoryAccess(ctx, sessionId, {
        set: (fn, delay) => setTimeout(fn, delay),
        clear: (handle) => clearTimeout(handle),
      })),
    [ctx, sessionId],
  )

  React.useEffect(() => () => {
    if (access !== null) access.dispose()
  }, [access])

  const subscribe = React.useCallback(
    (listener) => (access === null ? () => {} : access.subscribe(listener)),
    [access],
  )
  const getSnapshot = React.useCallback(
    () => (access === null ? EMPTY_MODEL_SNAPSHOT : access.getSnapshot()),
    [access],
  )
  const state = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const levels = effortLevelsOf(state)
  const effectiveId = effectiveEffortId(state)
  const committedIndex = indexOfLevel(levels, effectiveId)
  const levelCount = levels.length

  const [draft, setDraft] = React.useState(null)
  const [optimistic, setOptimistic] = React.useState(null)
  const [errorText, setError] = React.useState(null)
  const [busy, setBusy] = React.useState(false)
  const [host, setHost] = React.useState(null)

  const anchorRef = React.useRef(null)
  const trackRef = React.useRef(null)
  const optimisticIdRef = React.useRef(null)
  /**
   * The drag's latest position lives in a ref as well as in state: React batches the
   * `setState`s of one tick, so a release that read the position from state could write
   * the level it was on one frame ago.
   */
  const draftRef = React.useRef(null)
  const commitRef = React.useRef({ timer: null, inFlight: false, queued: null })
  const draggingRef = React.useRef(false)
  /**
   * A drag paints on the display's own clock: one frame per frame, and never two in one.
   *
   * Pointer events arrive in bursts — a high-polling mouse, a tablet, a browser that hands over
   * a frame's worth at once — and painting each one would do the same work twice for one
   * picture. What a drag must never do is paint *slower* than the display: a knob that steps at
   * 60Hz on a 165Hz panel stops feeling like it is under the finger. So the newest position is
   * kept in a ref and painted by the next frame callback, which is at most a frame behind the
   * pointer and exactly one paint per frame.
   */
  const pendingMoveRef = React.useRef(null)
  const moveFrameRef = React.useRef(null)
  const dragRectRef = React.useRef(null)
  /**
   * The ambience behind the knob, and how many frames have been painted since it last followed.
   *
   * `null` means "nothing to say": the render then reads the position in force, which is what the
   * control shows whenever the pointer is not on it. A drag fills it in every
   * `AMBIENCE_FRAME_EVERY`th frame, and on any frame that changes the level.
   */
  const [ambience, setAmbience] = React.useState(null)
  const ambienceRef = React.useRef({ pct: null, index: -1 })
  const paintedFramesRef = React.useRef(0)
  /** The last style this component wrote onto the shell's row and its value: seen, not rewritten. */
  const ringRef = React.useRef({ host: null, value: '' })
  const tintRef = React.useRef({ host: null, value: '' })
  const levelCountRef = React.useRef(0)
  const seatNamesRef = React.useRef([])
  const bridgeRef = React.useRef(null)
  levelCountRef.current = levelCount

  /* The bridge: find the shell's row and hang the container in it. */
  React.useEffect(() => {
    if (sessionId === null || !ctx) return undefined
    const bridge = createEffortBridge({
      doc: typeof document === 'undefined' ? null : document,
      win: typeof window === 'undefined' ? null : window,
      anchor: () => anchorRef.current,
      active: () => levelCountRef.current > 0,
      onChange: (next) => setHost(next),
      seatLabels: () => seatNamesRef.current,
    })
    if (bridge === null) return undefined
    bridgeRef.current = bridge
    bridge.start()
    return () => {
      bridgeRef.current = null
      bridge.dispose()
    }
  }, [ctx, sessionId])

  /**
   * The levels arrive *after* the menu does (the directory has to load first), and that
   * changes no DOM, so no mutation will be seen. Re-scanning when the count changes is
   * what keeps a late directory from leaving the slider off the row for good.
   */
  React.useEffect(() => {
    bridgeRef.current?.scan()
  }, [levelCount])

  const optimisticId = typeof optimistic?.id === 'string' ? optimistic.id : null
  const optimisticIndex = optimisticId === null ? -1 : indexOfLevel(levels, optimisticId)

  // The level in force — the optimistic one first — is what the collapsed seat shows.
  let effectiveIndex = committedIndex >= 0 ? committedIndex : 0
  if (optimisticIndex >= 0) effectiveIndex = optimisticIndex
  const effectivePct = pctFromIndex(effectiveIndex, levelCount)
  const effectiveLevel = levels[effectiveIndex] || null
  // A level change may not have reached the seat's text yet, so every name is offered.
  seatNamesRef.current = levels.map((level) => level.name).filter((name) => typeof name === 'string' && name.length > 0)

  // What the control shows: the draft while dragging, the level in force otherwise.
  const shownIndex = draft !== null ? draft.index : effectiveIndex
  const shownPct = draft !== null && typeof draft.pct === 'number' ? draft.pct : effectivePct
  const shownLevel = levels[shownIndex] || null

  // Three quantities, all driven by the position: the fill's colour, the energy, the speed.
  // Two readings of the same strip, at two different cadences.
  //
  // What the pointer is on is painted on every frame: the knob's position, the fill's edge, and
  // the fill's own colour, which is what makes the control read as being dragged rather than
  // followed. So is the starfield's timing, which has to stay continuous. Everything that is a
  // *value* rather than a motion — the energy that drives the glow and the nebula, the field's
  // density and layer opacity — is read as ambience and follows on `AMBIENCE_FRAME_EVERY` frames,
  // because the stylesheet already eases those over 0.2s and the raster work behind them (a blur
  // radius, the shell row's own repaint) is what the frame the pointer needs is short of.
  const ambiencePct = ambience !== null && typeof ambience.pct === 'number' ? ambience.pct : shownPct
  const energy = energyFor(ambiencePct)
  const energyOn = energy > 0
  const fillBackground = fillBackgroundFor(shownPct, activeTheme)
  const knobOffset = knobOffsetOf(shownPct)

  // The row takes a violet/cyan edge whose strength follows the energy.
  //
  // Both of these write a style the shell does not know about, straight onto its elements,
  // and both are driven by the pointer's position — so they run once per painted drag frame.
  // The strings are quantised on the way out, which means most frames arrive at the value the
  // last one already wrote: writing the same declaration again is a repaint the compositor
  // has to do for nothing, so the last one is remembered instead.
  React.useEffect(() => {
    if (!host?.row?.style) return
    const glowColor = activeTheme === 'deepseek' ? '56,189,248' : '168,85,247'
    const next = energyOn ? `inset 0 0 0 1px rgba(${glowColor},${(0.16 + 0.34 * energy).toFixed(2)})` : ''
    if (ringRef.current.host === host && ringRef.current.value === next) return
    ringRef.current = { host, value: next }
    host.row.style.boxShadow = next
  }, [host, energyOn, energy, activeTheme])

  // The row's value text follows as well — its colour only, never its text.
  React.useEffect(() => {
    if (!host?.value?.style) return
    const next = valueColorFor(shownPct, shownLevel, activeTheme)
    if (tintRef.current.host === host && tintRef.current.value === next) return
    tintRef.current = { host, value: next }
    host.value.style.color = next
  }, [host, shownPct, shownLevel, activeTheme])

  // The collapsed seat follows the level in force, not the draft. The bridge owns the
  // colour, so a re-render that replaces the span still gets it immediately.
  React.useEffect(() => {
    bridgeRef.current?.setSeatColor(valueColorFor(effectivePct, effectiveLevel, activeTheme))
  }, [levelCount, effectivePct, effectiveLevel, activeTheme])

  /*
   * The quota notice.
   *
   * The top level is the one position that costs noticeably more, so the row's value cell
   * says so — in the level's own colour — for a second, and then flips to the level's own
   * name. Only a level the user actually adjusted to raises it: a menu opened while the
   * level already sits at the top says nothing, because nothing was adjusted, and closing
   * the menu forgets that too.
   */
  const rowPresent = host?.row != null
  const atTop = rowPresent && levelCount > 0 && shownIndex === levelCount - 1
  const [notice, setNotice] = React.useState(null)
  const leftTopRef = React.useRef(false)
  React.useEffect(() => {
    if (!rowPresent || levelCount === 0) {
      leftTopRef.current = false
      setNotice(null)
      return undefined
    }
    if (!atTop) {
      leftTopRef.current = true
      setNotice(null)
      return undefined
    }
    if (!leftTopRef.current) return undefined
    setNotice({ flipped: false })
    const handle = setTimeout(() => setNotice({ flipped: true }), QUOTA_NOTICE_MS)
    return () => clearTimeout(handle)
  }, [atTop, levelCount, rowPresent])

  React.useEffect(() => {
    const top = levelCount > 0 ? levels[levelCount - 1] : null
    bridgeRef.current?.notice(notice === null || top === null || !rowPresent
      ? null
      : {
        front: t('effortQuotaNotice'),
        back: top.name,
        color: valueColorFor(1, top, activeTheme),
        flipped: notice.flipped === true,
      })
  }, [notice, rowPresent, levelCount, activeTheme])

  // The host caught up with the optimistic value: drop it and follow the directory again.
  React.useEffect(() => {
    if (optimisticId !== null && effectiveId === optimisticId) setOptimistic(null)
  }, [effectiveId, optimisticId])

  // A host that never answers rolls the display back and says so, rather than pretending.
  React.useEffect(() => {
    if (optimisticId === null) return undefined
    const handle = setTimeout(() => {
      if (optimisticIdRef.current === optimisticId) {
        optimisticIdRef.current = null
        setOptimistic(null)
        setError(t('effortErrorTimeout'))
      }
    }, COMMIT_DEADLINE_MS)
    return () => clearTimeout(handle)
  }, [optimisticId])

  // Unmounting clears the throttle timer and the frame a drag was waiting on, either of which
  // would otherwise write after the fact.
  React.useEffect(() => () => {
    const pending = commitRef.current
    if (pending.timer !== null) {
      clearTimeout(pending.timer)
      pending.timer = null
    }
    pending.queued = null
    dropPendingMove()
    draggingRef.current = false
  }, [])

  function currentState() {
    return access === null ? EMPTY_MODEL_SNAPSHOT : access.getSnapshot()
  }

  function flush() {
    const pending = commitRef.current
    if (pending.timer !== null) {
      clearTimeout(pending.timer)
      pending.timer = null
    }
    const levelId = pending.queued
    pending.queued = null
    if (levelId === null || levelId === undefined || access === null) return

    const snapshot = currentState()
    const current = snapshot?.current
    if (typeof current?.provider !== 'string' || typeof current?.model !== 'string') {
      setError(t('effortErrorNoCatalog'))
      return
    }
    // The host may have written this level already: the second gate of the de-duplication.
    if (effectiveEffortId(snapshot) === levelId) return

    const directory = access.directory()
    if (directory === null || typeof directory.select !== 'function') {
      setError(t('effortErrorNoDirectory'))
      return
    }

    pending.inFlight = true
    optimisticIdRef.current = levelId
    setOptimistic({ id: levelId })
    setError(null)
    setBusy(true)

    let result
    try {
      result = directory.select({ provider: current.provider, model: current.model, reasoningEffort: levelId })
    } catch (error) {
      result = Promise.reject(error)
    }

    Promise.resolve(result).then(
      (outcome) => {
        pending.inFlight = false
        if (outcome && outcome.ok === false) {
          optimisticIdRef.current = null
          setOptimistic(null)
          setError(effortErrorText(outcome.error, t))
        }
      },
      (error) => {
        pending.inFlight = false
        optimisticIdRef.current = null
        setOptimistic(null)
        setError(effortErrorText(error, t))
      },
    ).then(() => {
      setBusy(false)
      // Work that arrived while this was in flight goes out now.
      if (pending.queued !== null) flush()
    })
  }

  /** Ask for a level: same-level de-duplication, in-flight merging, and a throttle. */
  function requestCommit(levelId, immediate) {
    if (levelId === null || levelId === undefined) return
    const pending = commitRef.current
    const snapshot = currentState()
    if (effectiveEffortId(snapshot) === levelId && pending.queued === null && !pending.inFlight) return
    pending.queued = levelId
    if (pending.inFlight) return
    if (immediate === true) {
      flush()
      return
    }
    if (pending.timer !== null) return
    pending.timer = setTimeout(() => {
      pending.timer = null
      flush()
    }, COMMIT_THROTTLE_MS)
  }

  /**
   * Where a pointer sits on the track, mapped through the same inset geometry the visuals use.
   *
   * During a drag the geometry is read once, on the way in: the popover does not move while a
   * finger is on it, and re-measuring per frame would force a layout per frame.
   */
  function pctAt(clientX) {
    const track = trackRef.current
    const rect = dragRectRef.current
      ?? (track && typeof track.getBoundingClientRect === 'function' ? track.getBoundingClientRect() : null)
    if (!rect) return null
    const usable = rect.width - KNOB_RADIUS * 2
    if (!(usable > 0)) return null
    return clamp01((clientX - rect.left - KNOB_RADIUS) / usable)
  }

  /** The control lives inside the shell's own button; its events must not reach that row. */
  function swallow(event) {
    if (event && typeof event.stopPropagation === 'function') event.stopPropagation()
  }

  /** Paint one drag position: the knob, the fill, the energy, and the commit it implies. */
  function paintMove(clientX, immediate) {
    const pct = pctAt(clientX)
    if (pct === null) return
    const index = indexFromPct(pct, levelCount)
    const next = { pct, index }
    draftRef.current = next
    setDraft(next)
    // The ambience behind the knob — the glow, the nebula, the starfield's speed and density —
    // follows on its own cadence rather than on the pointer's; see `AMBIENCE_FRAME_EVERY`. A level
    // change updates it at once, so the field never lags the level the knob is standing in.
    const last = ambienceRef.current
    const due = last.pct === null
      || last.index !== index
      || paintedFramesRef.current % AMBIENCE_FRAME_EVERY === 0
    paintedFramesRef.current += 1
    if (due) {
      ambienceRef.current = { pct, index }
      setAmbience({ pct })
    }
    requestCommit(levels[index].id, immediate === true)
  }

  /**
   * The host's frame clock, or null where there is none.
   *
   * `requestAnimationFrame` is the display's own cadence — a callback per frame, no more and no
   * less — which is exactly the rate a knob under a finger wants to be painted at, on a 60Hz
   * screen as much as on a 165Hz one. A host without it (a test double, an old shell) paints
   * the move where it stands instead of deferring it.
   */
  function frameClock() {
    const host = typeof window === 'undefined' ? null : window
    if (host === null || typeof host.requestAnimationFrame !== 'function') return null
    return {
      request: (callback) => host.requestAnimationFrame(callback),
      cancel: typeof host.cancelAnimationFrame === 'function' ? (handle) => host.cancelAnimationFrame(handle) : null,
    }
  }

  /**
   * Take a drag position: keep the newest one, and let the next frame paint it.
   *
   * Nothing is dropped, so the knob is never painted where the pointer no longer is; nothing is
   * painted twice for one frame either, so a burst of events costs one frame of work.
   */
  function queueMove(clientX) {
    pendingMoveRef.current = clientX
    if (moveFrameRef.current !== null) return
    const frame = frameClock()
    if (frame === null) {
      flushMove()
      return
    }
    // The token is claimed before the host is asked, and the callback only clears the token it
    // owns: a clock that calls back synchronously (a test double) would otherwise leave a dead
    // token behind and stall every move after the first.
    const token = { handle: null }
    moveFrameRef.current = token
    token.handle = frame.request(() => {
      if (moveFrameRef.current !== token) return
      moveFrameRef.current = null
      flushMove()
    })
  }

  /** Paint the position the last move asked for. */
  function flushMove() {
    const pending = pendingMoveRef.current
    if (pending === null) return
    pendingMoveRef.current = null
    paintMove(pending, false)
  }

  /** Let go of the frame being waited on, keeping the position it was going to paint. */
  function cancelMoveFrame() {
    const token = moveFrameRef.current
    if (token === null) return
    moveFrameRef.current = null
    const frame = frameClock()
    if (frame !== null && frame.cancel !== null && token.handle !== null && token.handle !== undefined) {
      frame.cancel(token.handle)
    }
  }

  /** Forget a move that was queued and never painted: a new drag starts from its own point. */
  function dropPendingMove() {
    cancelMoveFrame()
    pendingMoveRef.current = null
  }

  /** The drag is over: its last position is the one that counts, and it is painted now. */
  function settleDrag() {
    cancelMoveFrame()
    flushMove()
    dragRectRef.current = null
  }

  function endDrag() {
    if (!draggingRef.current) return
    draggingRef.current = false
    settleDrag()
    const latest = draftRef.current
    if (latest !== null && levelCount > 0) requestCommit(levels[latest.index].id, true)
    draftRef.current = null
    setDraft(null)
    // The ambience goes back to reading the level in force, so the glow and the field settle on
    // the level the release chose rather than on the last frame the pointer painted.
    ambienceRef.current = { pct: null, index: -1 }
    paintedFramesRef.current = 0
    setAmbience(null)
  }

  function onTrackPointerDown(event) {
    if (locked || levelCount === 0) return
    swallow(event)
    draggingRef.current = true
    dropPendingMove()
    const track = trackRef.current
    if (track && typeof track.getBoundingClientRect === 'function') {
      try {
        dragRectRef.current = track.getBoundingClientRect()
      } catch {
        dragRectRef.current = null
      }
    }
    try {
      if (event.currentTarget?.setPointerCapture && event.pointerId !== undefined) {
        event.currentTarget.setPointerCapture(event.pointerId)
      }
    } catch {
      // Failing to capture does not stop the drag.
    }
    paintMove(event.clientX, false)
  }

  function onTrackPointerMove(event) {
    if (!draggingRef.current) return
    swallow(event)
    queueMove(event.clientX)
  }

  function onKeyDown(event) {
    if (locked || levelCount === 0) return
    const index = draftRef.current !== null ? draftRef.current.index : shownIndex
    let next = null
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = Math.max(0, index - 1)
    else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = Math.min(levelCount - 1, index + 1)
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = levelCount - 1
    // Escape, Enter and Tab are the shell's own to handle.
    else return
    swallow(event)
    if (typeof event.preventDefault === 'function') event.preventDefault()
    setDraft(null)
    // A keyboard move lands on a level's own position: the ambience follows it exactly, so the
    // glow and the field never show the level the pointer left behind.
    ambienceRef.current = { pct: null, index: -1 }
    paintedFramesRef.current = 0
    setAmbience(null)
    requestCommit(levels[next].id, true)
  }

  let trackTitle = shownLevel === null ? t('effortLabel') : t('effortTitle', { name: shownLevel.name })
  if (reducedMotion) trackTitle += t('effortReducedMotion')

  const tickNodes = []
  for (let index = 0; index < levelCount; index += 1) {
    tickNodes.push(h('span', {
      key: `tick-${levels[index].id}`,
      className: 'ces-tick',
      'data-ces-part': 'tick',
      'data-on': index <= shownIndex ? '1' : '0',
      style: { left: knobOffsetOf(pctFromIndex(index, levelCount)) },
    }))
  }

  // The starfield. Every level that shows particles uses this one animation: a full-width
  // crossing, no disappearance, and brightness that is also size.
  //
  // All of them are built, always, and a star the position does not show is left in the tree with
  // `display: none` rather than taken out of it. The field thickens by one star at a time as the
  // knob travels, and adding and removing nodes for that would re-run the shell's own mutation
  // watcher — which re-hangs this whole control — several times inside a single drag. Twenty-two
  // hidden elements look exactly like none.
  //
  // The timing stays on every painted frame, unlike the rest of the ambience. A duration is not a
  // value the eye reads, but changing one mid-flight re-maps the animation's progress: a star at
  // half its crossing would jump by however much the duration moved, and at three frames a step
  // that hop is around ten pixels at a brisk drag. The field would read as stuttering even while
  // the glow behind it was eased. So the speed is recomputed per frame and the moving picture
  // stays continuous; only the *count* — a star that appears or goes — follows the ambience.
  const positionSpeed = speedFor(shownPct)
  const starCount = starCountFor(ambiencePct)
  const starLayerOpacity = starLayerOpacityFor(ambiencePct)
  const particleNodes = React.useMemo(() => {
    const nodes = []
    for (let index = 0; index < EFFORT_STARS.length; index += 1) {
      const brightness = starBrightnessFor(index)
      // Reduced motion is applied here, where the duration is computed: the duration is an
      // inline style, so a media query could not reach it.
      const duration = starDurationFor(index, positionSpeed) * (reducedMotion ? REDUCED_MOTION_SLOWDOWN : 1)
      nodes.push(h(
        'span',
        {
          key: `star-${index}`,
          className: 'ces-star',
          'data-ces-part': 'star',
          'data-shown': index < starCount ? '1' : '0',
          style: {
            top: `${EFFORT_STARS[index].y}%`,
            display: index < starCount ? undefined : 'none',
            // Duration and negative delay must be inline: as custom properties the delay is
            // not honoured in the real host, which left every star bunched at the start.
            animationDuration: `${duration.toFixed(3)}s`,
            animationDelay: `${starDelayFor(index, duration).toFixed(3)}s`,
          },
        },
        h('span', {
          className: 'ces-star__dot',
          'data-ces-part': 'particle',
          'data-brightness': brightness.toFixed(3),
          style: { '--ces-b': brightness.toFixed(3) },
        }),
      ))
    }
    return nodes
  }, [starCount, positionSpeed, reducedMotion])

  const whaleNode = React.useMemo(() => {
    if (activeTheme !== 'deepseek') return null
    return h(
      'div',
      {
        className: 'ces-whale-track',
        'data-ces-part': 'whale-track',
        style: { width: knobOffset },
      },
      h(
        'div',
        {
          className: 'ces-whale',
          'data-ces-part': 'whale',
        },
        h(
          'svg',
          {
            className: 'ces-whale__svg',
            viewBox: '0 0 32 16',
            width: '28',
            height: '14',
            xmlns: 'http://www.w3.org/2000/svg',
          },
          h('path', {
            d: 'M 3,8 C 1.5,8.8 0.5,10.2 0.5,11.5 C 0.5,13.2 2,14 4.5,14 C 8.5,14 12,13.2 15,11.8 C 19,10 23,9.6 26,10.2 L 29,12.8 C 29.8,13.4 30.6,12.8 30.3,12 L 29,9.2 L 30.3,6.5 C 30.6,5.7 29.8,5.1 29,5.7 L 26,8.2 C 22.8,7.6 19,6 14.5,4.8 C 10,3.5 5.5,5.8 3,8 Z',
            fill: 'currentColor',
          }),
          h('path', {
            d: 'M 10.5,11.2 C 12,13 13.5,14.2 15.2,14.2 C 16,14.2 16.2,13.5 15.6,12.8 C 14.8,11.8 13.6,11.2 12.5,11 Z',
            fill: 'currentColor',
            opacity: '0.8',
          }),
          h('circle', {
            cx: '4.2',
            cy: '9.5',
            r: '0.7',
            fill: '#ffffff',
          }),
          h('circle', {
            cx: '8',
            cy: '3.6',
            r: '0.6',
            fill: '#ffffff',
            opacity: '0.8',
          }),
        ),
      ),
    )
  }, [activeTheme, knobOffset])

  let ui = null
  if (host?.container && levelCount > 0) {
    ui = ReactDOM.createPortal(
      h(
        'div',
        {
          className: 'ces-inline',
          'data-ces-part': 'root',
          'data-theme': activeTheme,
          'data-energy': energyOn ? '1' : '0',
          'data-motion': reducedMotion ? 'reduced' : 'full',
          'data-busy': busy ? '1' : '0',
          style: { '--ces-energy': String(energy) },
        },
        h(
          'div',
          {
            ref: trackRef,
            className: 'ces-track',
            'data-ces-part': 'track',
            role: 'slider',
            tabIndex: locked ? -1 : 0,
            'aria-label': t('effortLabel'),
            'aria-valuemin': 0,
            'aria-valuemax': Math.max(0, levelCount - 1),
            'aria-valuenow': shownIndex,
            'aria-valuetext': shownLevel !== null ? shownLevel.name : '',
            'aria-disabled': locked ? 'true' : undefined,
            title: trackTitle,
            onPointerDown: onTrackPointerDown,
            onPointerMove: onTrackPointerMove,
            onPointerUp: endDrag,
            onPointerCancel: endDrag,
            onKeyDown,
            onClick: swallow,
          },
          h('div', {
            className: 'ces-fill',
            'data-ces-part': 'fill',
            // The fill ends at the knob's centre, and runs from blue to the position's colour.
            style: { width: knobOffset, background: fillBackground },
          }),
          // The nebula and its sweep: the opacity *is* the energy, which is the fade-in.
          h(
            'div',
            { className: 'ces-energy', 'data-ces-part': 'energy', style: { width: knobOffset } },
            h('div', { className: 'ces-energy__sweep', 'data-ces-part': 'sweep' }),
          ),
          whaleNode,
          // The stars, on a layer of their own so the nebula's half-opacity cannot dim them.
          h(
            'div',
            {
              className: 'ces-stars',
              'data-ces-part': 'stars',
              style: { width: knobOffset, opacity: starLayerOpacity.toFixed(3) },
            },
            particleNodes,
          ),
          tickNodes,
          h('div', { className: 'ces-knob', 'data-ces-part': 'knob', style: { left: knobOffset } }),
        ),
        errorText !== null
          ? h('div', { className: 'ces-error', 'data-ces-part': 'error', role: 'status' }, errorText)
          : null,
      ),
      host.container,
    )
  }

  // The anchor: invisible, occupying nothing, and the two things this control needs from
  // the composer — the session id the slot hands it, and a way back to its own composer.
  return h('span', {
    ref: anchorRef,
    hidden: true,
    'data-ces-part': 'anchor',
    'aria-hidden': 'true',
  }, ui)
}

module.exports = { EffortSlider }
