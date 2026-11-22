/**
 * pet/styles.cjs — the companion's sheet.
 *
 * Everything animates through CSS: the card has no timers of its own beyond the
 * liveness check, so a companion that is merely sitting there costs the page
 * nothing between paints.
 */
const PET_CSS = `
/* Standing on the input card's top edge, at the configured fraction of its width:
 * the perch is centred on that point and sits entirely above the border. */
.dct-pet-perch {
  position: absolute;
  top: 0;
  left: calc(var(--dct-pet-x, 93) * 1%);
  transform: translate(-50%, -100%);
  pointer-events: none;
  z-index: 3;
  line-height: 0;
  transform-origin: 50% 100%;
}

/* While hopping down from the heatmap the perch is fixed to the page instead, and
 * only its transform moves — one composited property, no layout on the way. */
.dct-pet-perch[data-dct-pet-flight] {
  position: fixed;
  left: 0;
  top: 0;
  transform: translate3d(0, 0, 0);
  transition: transform var(--dct-pet-hop-ms, 640ms) cubic-bezier(.34, 1.24, .54, 1);
  will-change: transform;
}

.dct-pet { display: block; overflow: visible; animation: dct-pet-breathe 3.4s ease-in-out infinite; }

/* Closed eyes are the same cells in the body colour, faded in for one blink. */
.dct-pet-eyes-closed { opacity: 0; animation: dct-pet-blink 6.2s steps(1, end) infinite; }

/* Attentive: faster breathing and a small lift, as if it sat up. */
.dct-pet-perch[data-dct-pet="attentive"] .dct-pet {
  animation-duration: 1.6s;
  animation-name: dct-pet-alert;
}

@keyframes dct-pet-breathe {
  0%, 100% { transform: translateY(0) scaleY(1); }
  50% { transform: translateY(-1px) scaleY(1.03); }
}

@keyframes dct-pet-alert {
  0%, 100% { transform: translateY(0) scaleX(1); }
  50% { transform: translateY(-2px) scaleX(1.04); }
}

@keyframes dct-pet-blink {
  0%, 95.5%, 100% { opacity: 0; }
  96%, 99% { opacity: 1; }
}

/* The anchor control on the settings page. */
.dct-pet-settings { display: flex; flex-direction: column; gap: 10px; }
.dct-pet-anchor { display: flex; align-items: center; gap: 10px; }
.dct-pet-anchor input[type="range"] { width: 180px; accent-color: var(--dsw-alias-brand-primary, #5744a7); }
.dct-pet-anchor-value { min-width: 40px; font-size: 12px; color: var(--dsw-alias-label-secondary, inherit); }

@media (prefers-reduced-motion: reduce) {
  .dct-pet, .dct-pet-perch[data-dct-pet="attentive"] .dct-pet { animation: none; }
  .dct-pet-eyes-closed { animation: none; opacity: 0; }
  .dct-pet-perch[data-dct-pet-flight] { transition: none; }
}
`

module.exports = { PET_CSS }
