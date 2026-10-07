/**
 * effort/styles.cjs — the slider's stylesheet.
 */
const { KNOB_RADIUS, KNOB_SIZE, TRACK_HEIGHT } = require('./constants.cjs')

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
.ces-inline[data-theme='codex'] .ces-whale-track { display: none; }
.ces-whale { position: absolute; top: 50%; left: 0; right: 0; height: 14px; margin-top: -7px; pointer-events: none; opacity: var(--ces-energy, 0); transition: opacity .2s ease; animation-name: ces-whale-swim; animation-duration: 5.5s; animation-timing-function: linear; animation-iteration-count: infinite; }
.ces-whale__svg { position: absolute; left: 100%; top: 0; color: #38bdf8; filter: drop-shadow(0 0 4px rgba(56, 189, 248, .85)); pointer-events: none; }
body[data-ds-dark-theme] .ces-whale__svg { color: #7dd3fc; filter: drop-shadow(0 0 5px rgba(125, 211, 252, .95)); }
@keyframes ces-whale-swim { 0% { transform: translate3d(0, 0, 0); opacity: 0; } 8% { opacity: 1; transform: translate3d(-8%, -1.8px, 0); } 25% { transform: translate3d(-25%, 1.5px, 0); } 50% { transform: translate3d(-50%, -1.8px, 0); } 75% { transform: translate3d(-75%, 1.5px, 0); } 92% { opacity: 1; transform: translate3d(-92%, -1px, 0); } 100% { transform: translate3d(calc(-100% - 32px), 0, 0); opacity: 0; } }
/* A reader who asked for less motion keeps the energy and loses the travel: the sweep is
   dropped and the stars are slowed in the component, not frozen here. */
@media (prefers-reduced-motion: reduce) { .ces-energy { transition: none; } .ces-energy__sweep { display: none; } .ces-notice__inner { transition-duration: 1ms; } .ces-whale { animation: none; } }
.ces-inline[data-motion='reduced'] .ces-whale { animation: none; }
`

module.exports = { EFFORT_CSS }
