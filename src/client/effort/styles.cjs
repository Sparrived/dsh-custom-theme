/**
 * effort/styles.cjs — the slider's stylesheet.
 */
const { CLAUDE_RAINBOW, CLAUDE_RAY_UNFURL, CLAUDE_VERB_ROOM, KNOB_RADIUS, KNOB_SIZE, TRACK_HEIGHT } = require('./constants.cjs')
const { claudeSparkPolygon } = require('./math.cjs')

/**
 * One tile of paper grain for the Claude theme: fractal noise with its colour taken out, so the
 * blend it is drawn with can only add tooth to the paper and the clay, never tint them.
 */
const CLAUDE_GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='96' height='96' filter='url(%23g)'/%3E%3C/svg%3E")`

/*
 * The slider's stylesheet.
 *
 * Colour comes from the shell's own design tokens, so both palettes follow for free:
 * the track's bed is the border token, and the blue is the shell's business accent with
 * the reference's `#4d93f8` behind it.
 *
 * Four layers ride the same geometry (the fill's width, the knob's left and every tick
 * all resolve to the knob's centre, so a level's mark and its fill end together):
 *
 *   .ces-fill    the completed part, "blue on the left → the colour of where you are"
 *   .ces-energy  the purple nebula and its sweep, opacity = the position's energy
 *   .ces-stars   the starfield, a layer of its own so the nebula's half-opacity at the
 *                high level cannot dim it out of sight
 *   .ces-knob    the thumb, as wide as the track is tall
 *
 * Energy covers only the completed part, so the track to the right of the knob keeps its
 * plain bed. Every star is one full-width strip crossing right to left with only the two
 * ends — both outside the visible window — fading, which is why the particles read as
 * never disappearing.
 */

    const EFFORT_CSS = `
.ces-inline { --ces-accent: var(--dsw-alias-state-business-primary, var(--dsw-static-blue-450, #4d93f8)); box-sizing: border-box; flex-basis: 100%; width: 100%; min-width: 0; }
.ces-track { position: relative; box-sizing: border-box; height: ${TRACK_HEIGHT}px; margin-top: 2px; border-radius: 999px; background: var(--dsw-alias-border-l1, rgba(15, 17, 21, .08)); cursor: pointer; touch-action: none; user-select: none; -webkit-user-select: none; }
.ces-track:focus-visible { outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--ces-accent)); outline-offset: 2px; }
.ces-fill { position: absolute; top: 0; bottom: 0; left: 0; border-radius: 999px; pointer-events: none; }
.ces-tick { position: absolute; top: 50%; width: 3px; height: 3px; margin: -1.5px 0 0 -1.5px; border-radius: 50%; background: color-mix(in srgb, var(--dsw-alias-label-primary, #0f1115) 26%, transparent); pointer-events: none; }
.ces-tick[data-on='1'] { background: rgba(255, 255, 255, .5); }
/* The knob is the track's height across, so it fills the tube's mouth and never shows a cut edge. */
.ces-knob { position: absolute; top: 50%; width: ${KNOB_SIZE}px; height: ${KNOB_SIZE}px; margin: ${-KNOB_RADIUS}px 0 0 ${-KNOB_RADIUS}px; border-radius: 50%; background: #fff; box-shadow: 0 1px 5px rgba(0, 0, 0, .34), 0 0 0 .5px rgba(0, 0, 0, .06); pointer-events: none; }
.ces-error { margin-top: 6px; font-size: 11px; line-height: 16px; color: var(--dsw-alias-state-error-primary, #e5484d); }
/* Reaching the top level replaces the row's value text with the quota notice for a second, then
   flips it to the level's own name. It is an overlay this plugin draws and never a rewrite: the
   phrase is laid over the value cell, the shell's own text is hushed rather than changed, and the
   moment the flip ends the two are indistinguishable, which is why the notice can simply be
   dropped again. Nothing is painted behind it — a copied backdrop is one more colour to get
   wrong — so the notice is text on whatever the row already has.

   Both faces end at the cell's right edge, which is where the shell draws the value: the cell is
   wider than the word it holds, so centring would strand a short name like "Max" in the middle of
   the row. The wider phrase simply spills to the left of the same edge. */
.ces-notice { position: absolute; display: flex; align-items: center; justify-content: flex-end; white-space: nowrap; pointer-events: none; perspective: 260px; }
.ces-notice__inner { position: absolute; inset: 0; transform-style: preserve-3d; transition: transform .42s cubic-bezier(.2, .7, .3, 1); }
.ces-notice[data-flipped='1'] .ces-notice__inner { transform: rotateX(180deg); }
/* Both faces fill the same box, so the flip turns one line over in place instead of swapping two. */
.ces-notice__face { position: absolute; inset: 0; display: flex; align-items: center; justify-content: flex-end; backface-visibility: hidden; -webkit-backface-visibility: hidden; }
.ces-notice__face--back { transform: rotateX(180deg); }
/* The shell's own value text while the notice covers it: invisible, still exactly as it was. */
.ces-cell-hushed { color: transparent !important; }
/* The lit state: one variable drives it. Only the track's glow and the energy layer's opacity
   interpolate it, so "powering up" is a composited colour transition rather than a per-frame
   script. With no energy the particles are paused instead of animating invisibly. */
.ces-inline[data-energy='1'] .ces-track { box-shadow: 0 0 calc(var(--ces-energy, 0) * 16px) rgba(168, 85, 247, .5); }
.ces-inline[data-energy='0'] .ces-star, .ces-inline[data-energy='0'] .ces-energy__sweep { animation-play-state: paused; }
.ces-energy { position: absolute; top: 0; bottom: 0; left: 0; border-radius: 999px; overflow: hidden; pointer-events: none; opacity: var(--ces-energy, 0); transition: opacity .2s ease; background: linear-gradient(90deg, #3b1178 0%, #6d28d9 30%, #9333ea 62%, #c084fc 100%); }
/* The stars ride their own layer, and their opacity has a floor: at the high level the nebula
   above is only half opaque, and nesting them inside it would halve every star again. Density
   is what expresses "more energy", not the layer's fade. */
.ces-stars { position: absolute; top: 0; bottom: 0; left: 0; border-radius: 999px; overflow: hidden; pointer-events: none; transition: opacity .2s ease; }
/* Durations and phases are written inline on the elements by the component and deliberately do
   not travel through custom properties: a var() in an animation's timing is not honoured for
   a negative delay in the real host, which left every star bunched at the start.
   --ces-b is not part of the timing, only of the dot's size and brightness. */
.ces-star { position: absolute; left: 0; right: 0; height: 3px; margin-top: -1.5px; pointer-events: none; animation-name: ces-star-sweep; animation-timing-function: linear; animation-iteration-count: infinite; }
.ces-star__dot { position: absolute; left: 100%; top: 0; width: 3px; height: 3px; margin-left: -1.5px; border-radius: 50%; background: #fff; box-shadow: 0 0 4px rgba(255, 255, 255, .85); opacity: var(--ces-b, 1); transform: scale(var(--ces-b, 1)); }
@keyframes ces-star-sweep { 0% { transform: translate3d(0, 0, 0); opacity: 0; } 6% { opacity: 1; } 94% { opacity: 1; } 100% { transform: translate3d(-100%, 0, 0); opacity: 0; } }
.ces-energy__sweep { position: absolute; inset: 0; background: linear-gradient(100deg, transparent 18%, rgba(255, 255, 255, .30) 50%, transparent 82%); transform: translateX(100%); animation: ces-sweep 2.4s linear infinite; }
@keyframes ces-sweep { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
body[data-ds-dark-theme] .ces-star__dot { background: #f5f3ff; box-shadow: 0 0 5px rgba(216, 180, 254, .95); }
/* DeepSeek deep sea whale theme: ocean bioluminescence, drifting bubbles, and cruising whale */
.ces-inline[data-theme='deepseek'][data-energy='1'] .ces-track { box-shadow: 0 0 calc(var(--ces-energy, 0) * 16px) rgba(56, 189, 248, .6); }
.ces-inline[data-energy='0'] .ces-whale { animation-play-state: paused; }
.ces-inline[data-theme='deepseek'] .ces-energy { background: linear-gradient(90deg, #082f49 0%, #0369a1 30%, #0284c7 62%, #38bdf8 100%); }
.ces-inline[data-theme='deepseek'] .ces-energy__sweep { background: linear-gradient(100deg, transparent 15%, rgba(56, 189, 248, .25) 35%, rgba(255, 255, 255, .45) 50%, rgba(56, 189, 248, .25) 65%, transparent 85%); animation: ces-ocean-sweep 2.6s linear infinite; }
@keyframes ces-ocean-sweep { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
.ces-inline[data-theme='deepseek'] .ces-star { animation-name: ces-bubble-sweep; }
.ces-inline[data-theme='deepseek'] .ces-star__dot { width: 4px; height: 4px; margin-left: -2px; border-radius: 50%; background: radial-gradient(circle at 30% 30%, #ffffff 10%, rgba(125, 211, 252, .9) 45%, rgba(14, 165, 233, .35) 85%, transparent 100%); border: 0.5px solid rgba(224, 242, 254, .85); box-shadow: 0 0 4px rgba(56, 189, 248, .75); }
body[data-ds-dark-theme] .ces-inline[data-theme='deepseek'] .ces-star__dot { background: radial-gradient(circle at 30% 30%, #ffffff 15%, #38bdf8 55%, rgba(2, 132, 199, .4) 90%); box-shadow: 0 0 5px rgba(56, 189, 248, .9); }
@keyframes ces-bubble-sweep { 0% { transform: translate3d(0, 0, 0); opacity: 0; } 6% { opacity: 1; } 30% { transform: translate3d(-30%, -1.5px, 0); } 65% { transform: translate3d(-65%, 1.2px, 0); } 94% { opacity: 1; } 100% { transform: translate3d(-100%, 0, 0); opacity: 0; } }
.ces-whale-track { position: absolute; top: 0; bottom: 0; left: 0; border-radius: 999px; overflow: hidden; pointer-events: none; }
/* A theme's own part is hidden under another theme by the root's [data-theme], never by a bare
   .ces-inline: the bridge's host in the shell's row is a .ces-inline too, with no theme on it,
   so a bare :not([data-theme=…]) matches through the host and hides the part under its own theme. */
.ces-inline[data-theme]:not([data-theme='deepseek']) .ces-whale-track { display: none; }
.ces-whale { position: absolute; top: 50%; left: 0; right: 0; height: 14px; margin-top: -7px; pointer-events: none; opacity: var(--ces-energy, 0); transition: opacity .2s ease; animation-name: ces-whale-swim; animation-duration: 5.5s; animation-timing-function: linear; animation-iteration-count: infinite; }
.ces-whale__svg { position: absolute; left: 100%; top: 0; color: #38bdf8; filter: drop-shadow(0 0 4px rgba(56, 189, 248, .85)); pointer-events: none; }
body[data-ds-dark-theme] .ces-whale__svg { color: #7dd3fc; filter: drop-shadow(0 0 5px rgba(125, 211, 252, .95)); }
@keyframes ces-whale-swim { 0% { transform: translate3d(0, 0, 0); opacity: 0; } 8% { opacity: 1; transform: translate3d(-8%, -1.8px, 0); } 25% { transform: translate3d(-25%, 1.5px, 0); } 50% { transform: translate3d(-50%, -1.8px, 0); } 75% { transform: translate3d(-75%, 1.5px, 0); } 92% { opacity: 1; transform: translate3d(-92%, -1px, 0); } 100% { transform: translate3d(calc(-100% - 32px), 0, 0); opacity: 0; } }
/* Google & Gemini theme: Google signature quad-color ribbon (#4285F4, #34A853, #FBBC05, #EA4335), multi-scale rotating sparkle stars, and twin-star constellation */
.ces-inline[data-theme='gemini'][data-energy='1'] .ces-track { box-shadow: 0 0 calc(var(--ces-energy, 0) * 12px) rgba(66, 133, 244, .55), 0 0 calc(var(--ces-energy, 0) * 16px) rgba(234, 67, 53, .45), 0 0 calc(var(--ces-energy, 0) * 8px) rgba(251, 188, 5, .4); }
.ces-inline[data-energy='0'] .ces-gemini-sparkle { animation-play-state: paused; }
.ces-inline[data-theme='gemini'] .ces-energy { background: linear-gradient(90deg, #4285f4 0%, #34a853 32%, #fbbc05 66%, #ea4335 100%); background-size: 200% 100%; animation: ces-gemini-flow 4s ease-in-out infinite alternate; }
@keyframes ces-gemini-flow { 0% { background-position: 0% 50%; filter: brightness(1); } 100% { background-position: 100% 50%; filter: brightness(1.15); } }
.ces-inline[data-theme='gemini'] .ces-energy__sweep { display: none; }
.ces-inline[data-theme='gemini'] .ces-stars { opacity: 1 !important; z-index: 3; }
.ces-inline[data-theme='gemini'] .ces-star { animation-name: ces-gemini-star-sweep; }
.ces-inline[data-theme='gemini'][data-energy='1'] .ces-star:nth-child(-n+12) { display: block !important; }
.ces-inline[data-theme='gemini'] .ces-star__dot { position: absolute; left: 100%; top: 50%; border-radius: 0; clip-path: polygon(50% 0%, 63% 37%, 100% 50%, 63% 63%, 50% 100%, 37% 63%, 0% 50%, 37% 37%); transform-origin: center center; animation: ces-gemini-spin-twinkle 3s ease-in-out infinite alternate; }
/* Multi-scale particle depth: Hero sparkles (12px), medium stars (9px), and star dust (6px) */
.ces-inline[data-theme='gemini'] .ces-star:nth-child(3n+1) .ces-star__dot { width: 12px; height: 12px; margin: -6px 0 0 -6px; }
.ces-inline[data-theme='gemini'] .ces-star:nth-child(3n+2) .ces-star__dot { width: 9px; height: 9px; margin: -4.5px 0 0 -4.5px; }
.ces-inline[data-theme='gemini'] .ces-star:nth-child(3n) .ces-star__dot { width: 6px; height: 6px; margin: -3px 0 0 -3px; }
/* Google signature 4-colors with vivid halos and brilliant white cores */
.ces-inline[data-theme='gemini'] .ces-star:nth-child(4n+1) .ces-star__dot { background: radial-gradient(circle at center, #ffffff 30%, #60a5fa 65%, #4285f4 100%); box-shadow: 0 0 6px rgba(66, 133, 244, 1), 0 0 10px rgba(66, 133, 244, 0.7); }
.ces-inline[data-theme='gemini'] .ces-star:nth-child(4n+2) .ces-star__dot { background: radial-gradient(circle at center, #ffffff 30%, #f87171 65%, #ea4335 100%); box-shadow: 0 0 6px rgba(234, 67, 53, 1), 0 0 10px rgba(234, 67, 53, 0.7); }
.ces-inline[data-theme='gemini'] .ces-star:nth-child(4n+3) .ces-star__dot { background: radial-gradient(circle at center, #ffffff 30%, #fde047 65%, #fbbc05 100%); box-shadow: 0 0 7px rgba(251, 188, 5, 1), 0 0 12px rgba(251, 188, 5, 0.8); }
.ces-inline[data-theme='gemini'] .ces-star:nth-child(4n) .ces-star__dot { background: radial-gradient(circle at center, #ffffff 30%, #4ade80 65%, #34a853 100%); box-shadow: 0 0 6px rgba(52, 168, 83, 1), 0 0 10px rgba(52, 168, 83, 0.7); }
/* Pure horizontal translation with gentle y-oscillation — NO container rotation */
@keyframes ces-gemini-star-sweep { 0% { transform: translate3d(0, 0, 0); opacity: 0; } 8% { opacity: 1; } 25% { transform: translate3d(-25%, -1.2px, 0); } 50% { transform: translate3d(-50%, 1.2px, 0); } 75% { transform: translate3d(-75%, -1px, 0); } 92% { opacity: 1; } 100% { transform: translate3d(-100%, 0, 0); opacity: 0; } }
/* In-place rotation and twinkling on the particle dot itself */
@keyframes ces-gemini-spin-twinkle { 0% { transform: rotate(0deg) scale(0.85); filter: brightness(0.95); } 50% { transform: rotate(90deg) scale(1.2); filter: brightness(1.35); } 100% { transform: rotate(180deg) scale(0.85); filter: brightness(0.95); } }
.ces-gemini-track { position: absolute; top: 0; bottom: 0; left: 0; border-radius: 999px; overflow: hidden; pointer-events: none; }
.ces-inline[data-theme]:not([data-theme='gemini']) .ces-gemini-track { display: none; }
.ces-gemini-sparkle { position: absolute; top: 50%; left: 0; right: 0; height: 14px; margin-top: -7px; pointer-events: none; opacity: var(--ces-energy, 0); transition: opacity .2s ease; animation-name: ces-gemini-sparkle-float; animation-duration: 5s; animation-timing-function: linear; animation-iteration-count: infinite; }
.ces-gemini-sparkle__svg { position: absolute; left: 100%; top: 0; filter: drop-shadow(0 0 4px rgba(66, 133, 244, .9)) drop-shadow(0 0 6px rgba(234, 67, 53, .75)); pointer-events: none; }
@keyframes ces-gemini-sparkle-float { 0% { transform: translate3d(0, 0, 0) scale(0.95); opacity: 0; } 8% { opacity: 1; transform: translate3d(-8%, -1.5px, 0) scale(1.05); } 30% { transform: translate3d(-30%, 1.2px, 0) scale(1); } 60% { transform: translate3d(-60%, -1.5px, 0) scale(1.08); } 90% { opacity: 1; transform: translate3d(-90%, 0.8px, 0) scale(0.98); } 100% { transform: translate3d(calc(-100% - 32px), 0, 0) scale(0.95); opacity: 0; } }
.ces-inline[data-theme='gemini'] .ces-knob { box-shadow: 0 1px 4px rgba(0, 0, 0, .26), 0 0 0 1px rgba(255, 255, 255, .9), 0 0 6px rgba(66, 133, 244, .4); }
.ces-inline[data-theme='gemini'][data-energy='1'] .ces-knob { box-shadow: 0 1px 5px rgba(0, 0, 0, .32), 0 0 0 1.5px rgba(255, 255, 255, .95), 0 0 calc(var(--ces-energy, 0) * 8px) rgba(234, 67, 53, .55), 0 0 calc(var(--ces-energy, 0) * 12px) rgba(66, 133, 244, .45), 0 0 calc(var(--ces-energy, 0) * 6px) rgba(251, 188, 5, .4); }
.ces-inline[data-theme='gemini'][data-energy='1'] .ces-knob::before { content: ''; position: absolute; top: -5px; right: -4px; width: 9px; height: 9px; clip-path: polygon(50% 0%, 63% 37%, 100% 50%, 63% 63%, 50% 100%, 37% 63%, 0% 50%, 37% 37%); background: radial-gradient(circle at center, #ffffff 30%, #fbbc05 90%); box-shadow: 0 0 6px rgba(251, 188, 5, .95); animation: ces-gemini-sat-1 3s ease-in-out infinite alternate; pointer-events: none; }
.ces-inline[data-theme='gemini'][data-energy='1'] .ces-knob::after { content: ''; position: absolute; bottom: -5px; left: -3px; width: 8px; height: 8px; clip-path: polygon(50% 0%, 63% 37%, 100% 50%, 63% 63%, 50% 100%, 37% 63%, 0% 50%, 37% 37%); background: radial-gradient(circle at center, #ffffff 30%, #4285f4 90%); box-shadow: 0 0 6px rgba(66, 133, 244, .95); animation: ces-gemini-sat-2 2.6s ease-in-out infinite alternate; pointer-events: none; }
@keyframes ces-gemini-sat-1 { 0% { transform: translate(0, 0) rotate(0deg) scale(0.85); opacity: 0.7; } 50% { transform: translate(-3px, -2px) rotate(90deg) scale(1.15); opacity: 1; } 100% { transform: translate(2px, -3px) rotate(180deg) scale(0.9); opacity: 0.8; } }
@keyframes ces-gemini-sat-2 { 0% { transform: translate(0, 0) rotate(0deg) scale(0.8); opacity: 0.7; } 50% { transform: translate(2px, 3px) rotate(-90deg) scale(1.1); opacity: 1; } 100% { transform: translate(-2px, 2px) rotate(-180deg) scale(0.85); opacity: 0.7; } }
/* ── Claude: the spark that blooms ──────────────────────────────────────────────────────────
   Not a skin over the starfield: this theme draws Claude thinking. The track is a groove pressed
   into paper, and the fill is clay that thinks out loud — Claude Code's spinner words, lettered
   behind the knob. The knob is the Claude spark, bloomed as far as the position says, and every
   stop still ahead is inked with the glyph the spark will become there. At the top the clay
   fires into a kiln and the word is \`ultrathink\`, in the colours the CLI gives it.

   The palette lives in variables the dark palette re-points, and the glows compose through
   them, so no state has to restate the groove or the pebble it sits on. */
.ces-inline[data-theme='claude'] { --ces-claude-paper: #ece6dc; --ces-claude-groove: inset 0 1px 2px rgba(74, 46, 24, .18), inset 0 -1px 0 rgba(255, 255, 255, .6); --ces-claude-ink: rgba(110, 68, 44, .45); --ces-claude-pebble: radial-gradient(circle at 34% 28%, #fffefb 0%, #f7f2ea 58%, #e9e1d3 100%); --ces-claude-glow: 0 0 0 transparent; --ces-claude-halo: 0 0 0 transparent; }
body[data-ds-dark-theme] .ces-inline[data-theme='claude'] { --ces-claude-paper: #2b2825; --ces-claude-groove: inset 0 1px 2px rgba(0, 0, 0, .55), inset 0 -1px 0 rgba(255, 255, 255, .05); --ces-claude-ink: rgba(240, 222, 204, .36); --ces-claude-pebble: radial-gradient(circle at 34% 28%, #fdfaf4 0%, #f1ebe0 58%, #ddd4c5 100%); }
.ces-inline[data-theme='claude'][data-energy='1'] { --ces-claude-glow: 0 0 calc(var(--ces-energy, 0) * 12px) rgba(217, 119, 87, .32); --ces-claude-halo: 0 0 calc(var(--ces-energy, 0) * 12px) rgba(217, 119, 87, .5); }
.ces-inline[data-theme='claude'][data-ultra='1'] { --ces-claude-glow: 0 0 14px rgba(235, 95, 87, .22), 0 0 24px rgba(130, 170, 220, .2); --ces-claude-halo: 0 0 10px 1px rgba(250, 195, 95, .55), 0 0 18px 3px rgba(200, 130, 180, .32); }
.ces-inline[data-theme='claude'] .ces-track { background: var(--ces-claude-paper); box-shadow: var(--ces-claude-groove), var(--ces-claude-glow); }
/* Paper and clay share one grain, blended so it can only add tooth, never colour. */
.ces-inline[data-theme='claude'] .ces-track::before, .ces-inline[data-theme='claude'] .ces-fill::after { content: ''; position: absolute; inset: 0; border-radius: inherit; background: ${CLAUDE_GRAIN} 0 0 / 96px 96px; mix-blend-mode: soft-light; opacity: .55; pointer-events: none; }
/* The stops still ahead are inked with the spark they will show — the seed, then the spark with
   one, two or all three of its groups open — so the track reads as its own legend. Passed stops
   sink into the clay. */
.ces-inline[data-theme='claude'] .ces-tick { width: 8px; height: 8px; margin: -4px 0 0 -4px; border-radius: 0; background: var(--ces-claude-ink); transition: opacity .3s ease; }
.ces-inline[data-theme='claude'] .ces-tick[data-bloom='0'] { width: 3px; height: 3px; margin: -1.5px 0 0 -1.5px; border-radius: 50%; }
.ces-inline[data-theme='claude'] .ces-tick[data-bloom='1'] { clip-path: ${claudeSparkPolygon(15, 1)}; }
.ces-inline[data-theme='claude'] .ces-tick[data-bloom='2'] { width: 9px; height: 9px; margin: -4.5px 0 0 -4.5px; clip-path: ${claudeSparkPolygon(15, 2)}; }
.ces-inline[data-theme='claude'] .ces-tick[data-bloom='3'] { width: 10px; height: 10px; margin: -5px 0 0 -5px; clip-path: ${claudeSparkPolygon(15, 3)}; }
.ces-inline[data-theme='claude'] .ces-tick[data-on='1'] { opacity: 0; }
/* The kiln is the energy layer, re-purposed: nothing until \`ultrathink\`, when the clay fires —
   dark through, with the heat at the knob and a faint rainbow passing through it. */
.ces-inline[data-theme='claude'] .ces-energy { opacity: 0; transition: opacity .5s ease; background: radial-gradient(130% 170% at 100% 50%, rgba(255, 138, 70, .42) 0%, rgba(255, 138, 70, 0) 46%), linear-gradient(90deg, #22100a 0%, #34170d 55%, #4a1f10 100%); }
.ces-inline[data-theme='claude'][data-ultra='1'] .ces-energy { opacity: 1; }
.ces-inline[data-theme='claude'] .ces-energy__sweep { background: linear-gradient(100deg, transparent 25%, rgba(250, 195, 95, .16) 42%, rgba(130, 170, 220, .16) 58%, transparent 75%); animation: ces-sweep 3.6s ease-in-out infinite; }
/* Embers rise only in the kiln — drifting back from the knob and up out of the clay, flickering.
   Below \`ultrathink\` the field is not drawn at all, so it costs nothing. */
.ces-inline[data-theme='claude']:not([data-ultra='1']) .ces-stars { display: none; }
.ces-inline[data-theme='claude'] .ces-star { animation-name: ces-claude-ember; }
.ces-inline[data-theme='claude'] .ces-star__dot { top: .5px; width: 2px; height: 2px; margin-left: -1px; background: #ffd9b0; box-shadow: 0 0 4px 1px rgba(255, 138, 76, .55); }
@keyframes ces-claude-ember { 0% { transform: translate3d(0, 0, 0); opacity: 0; } 8% { opacity: 1; } 40% { opacity: .55; } 60% { opacity: 1; } 100% { transform: translate3d(-100%, -8px, 0); opacity: 0; } }
/* The words, lettered in ink on the clay and ending short of the knob, with Claude Code's glint
   passing through them. Three take turns. A set only shows once the clay has room for its widest
   word — the words box is its own container, so the room is measured where it is, not guessed —
   and the soft left edge keeps a word that has just made room from starting on a hard cut. The
   background shorthand resets the clip, so every rule that sets a background sets it again. */
.ces-claude-verbs { position: absolute; top: 0; bottom: 0; left: 0; overflow: hidden; pointer-events: none; container-type: inline-size; -webkit-mask-image: linear-gradient(90deg, transparent, #000 6px); mask-image: linear-gradient(90deg, transparent, #000 6px); }
@container (width < ${CLAUDE_VERB_ROOM.calm}px) { .ces-claude-verbs[data-set='calm'] .ces-claude-verb { visibility: hidden; } }
@container (width < ${CLAUDE_VERB_ROOM.deep}px) { .ces-claude-verbs[data-set='deep'] .ces-claude-verb { visibility: hidden; } }
.ces-claude-verb { position: absolute; right: 0; top: 50%; font: italic 500 12px/1 "Copernicus", "Tiempos Text", Georgia, "Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif; letter-spacing: .01em; white-space: nowrap; color: transparent; background: linear-gradient(100deg, #4a2210 0%, #4a2210 44%, #fbe1cf 50%, #4a2210 56%, #4a2210 100%) 0 0 / 300% 100%; -webkit-background-clip: text; background-clip: text; opacity: 0; transform: translateY(-50%); animation: ces-claude-verb 8.4s ease-in-out infinite, ces-claude-glint 2.8s linear infinite; }
.ces-claude-verb:nth-child(2) { animation-delay: -5.6s; }
.ces-claude-verb:nth-child(3) { animation-delay: -2.8s; }
.ces-claude-verb--ultra { opacity: 1; font-weight: 600; letter-spacing: .03em; background: linear-gradient(90deg, ${CLAUDE_RAINBOW.join(', ')}, ${CLAUDE_RAINBOW[0]}) 0 0 / 200% 100%; -webkit-background-clip: text; background-clip: text; animation: ces-claude-rainbow 3.2s linear infinite; filter: drop-shadow(0 0 5px rgba(250, 195, 95, .3)); }
@keyframes ces-claude-verb { 0% { opacity: 0; transform: translateY(-10%); } 5% { opacity: 1; transform: translateY(-50%); } 28% { opacity: 1; transform: translateY(-50%); } 33.33%, 100% { opacity: 0; transform: translateY(-90%); } }
@keyframes ces-claude-glint { 0% { background-position: 100% 0; } 100% { background-position: 0% 0; } }
@keyframes ces-claude-rainbow { 0% { background-position: 0% 0; } 100% { background-position: 200% 0; } }
/* The knob is an ivory pebble carrying the spark, lifted a little while it is held. Reaching
   \`ultrathink\` fires one flare off it: the rule starts to match when the level does, which is
   what starts the animation, and it runs once. */
.ces-inline[data-theme='claude'] .ces-knob { background: var(--ces-claude-pebble); box-shadow: 0 1px 2px rgba(74, 42, 20, .28), 0 3px 9px rgba(74, 42, 20, .16), inset 0 0 0 .5px rgba(120, 80, 50, .22), var(--ces-claude-halo); transition: transform .18s ease; }
.ces-inline[data-theme='claude'][data-dragging='1'] .ces-knob { transform: scale(1.08); }
.ces-inline[data-theme='claude'] .ces-knob::after { content: ''; position: absolute; inset: 0; border-radius: 50%; pointer-events: none; opacity: 0; box-shadow: 0 0 0 2px rgba(250, 195, 95, .9), 0 0 12px 2px rgba(235, 95, 87, .55); }
.ces-inline[data-theme='claude'][data-ultra='1'] .ces-knob::after { animation: ces-claude-flare .9s cubic-bezier(.15, .7, .3, 1) 1; }
@keyframes ces-claude-flare { 0% { opacity: .95; transform: scale(1); } 100% { opacity: 0; transform: scale(1.7); } }
/* The spark turns slowly while there is any thinking, breathes, and whirls for \`ultrathink\`
   alone: three nested boxes, so starting or stopping one never makes the others jump. */
.ces-claude-spark { position: absolute; top: 50%; left: 50%; width: 20px; height: 20px; margin: -10px 0 0 -10px; pointer-events: none; animation: ces-claude-turn 18s linear infinite; }
.ces-claude-spark__whirl, .ces-claude-spark__breath { width: 100%; height: 100%; }
.ces-claude-spark__whirl { animation: ces-claude-turn 3s linear infinite paused; }
.ces-claude-spark__breath { animation: ces-claude-breathe 3.2s ease-in-out infinite; }
.ces-claude-spark svg { display: block; width: 100%; height: 100%; overflow: visible; }
.ces-inline[data-theme]:not([data-theme='claude']) .ces-claude-spark { display: none; }
.ces-inline[data-off='1'] .ces-claude-spark, .ces-inline[data-off='1'] .ces-claude-spark__breath { animation-play-state: paused; }
.ces-inline[data-ultra='1'] .ces-claude-spark__whirl { animation-play-state: running; }
/* A ray opens with the bloom alone — the arithmetic of claudeRayOpenness — and springs a little
   past its length on the way. Its stroke ignores the scale, so a closing ray stays a round
   petal all the way down into the seed. */
.ces-claude-seed { fill: #d97757; }
.ces-claude-ray { stroke: #d97757; stroke-width: 2.4px; stroke-linecap: round; vector-effect: non-scaling-stroke; transform-box: view-box; transform-origin: 0 0; transform: scale(clamp(0, calc((var(--ces-bloom, 0) - var(--ces-ray-opens, 0)) / ${CLAUDE_RAY_UNFURL}), 1)); transition: transform .42s cubic-bezier(.2, .9, .3, 1.25), stroke .45s ease; }
${CLAUDE_RAINBOW.map((color, k) => `.ces-inline[data-ultra='1'] .ces-claude-ray:nth-of-type(${CLAUDE_RAINBOW.length}n+${k + 1}) { stroke: ${color}; }`).join('\n')}
@keyframes ces-claude-turn { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
@keyframes ces-claude-breathe { 0%, 100% { transform: scale(.93); } 50% { transform: scale(1.05); } }
/* A reader who asked for less motion keeps the energy and loses the travel: the sweep is
   dropped and the stars are slowed in the component, not frozen here. */
@media (prefers-reduced-motion: reduce) { .ces-energy { transition: none; animation: none; } .ces-energy__sweep { display: none; } .ces-notice__inner { transition-duration: 1ms; } .ces-whale { animation: none; } .ces-gemini-sparkle { animation: none; } .ces-knob::before, .ces-knob::after { animation: none; } .ces-claude-spark, .ces-claude-spark__whirl, .ces-claude-spark__breath, .ces-claude-verb { animation: none; } .ces-claude-verb:first-child { opacity: 1; } }
.ces-inline[data-motion='reduced'] .ces-whale { animation: none; }
.ces-inline[data-motion='reduced'] .ces-gemini-sparkle { animation: none; }
.ces-inline[data-motion='reduced'] .ces-knob::before, .ces-inline[data-motion='reduced'] .ces-knob::after { animation: none; }
/* The spark stops turning and the words stop taking turns: the first one stands, unglinted, and
   the rainbow holds still. The bloom itself is left alone — it only ever answers the hand. */
.ces-inline[data-motion='reduced'] .ces-claude-spark, .ces-inline[data-motion='reduced'] .ces-claude-spark__whirl, .ces-inline[data-motion='reduced'] .ces-claude-spark__breath, .ces-inline[data-motion='reduced'] .ces-claude-verb { animation: none; }
.ces-inline[data-motion='reduced'] .ces-claude-verb:first-child { opacity: 1; }
`

module.exports = { EFFORT_CSS }
