/**
 * pet/styles.cjs — the companion's sheet.
 *
 * Everything animates through CSS: the card has no timers, no requestAnimationFrame
 * and no listeners of its own beyond the focus events that switch its pose, so a
 * companion that is merely sitting there costs the page nothing between paints.
 */
const PET_CSS = `
/* Standing on the input card's top edge, near its right corner: the whole
 * companion sits above the border and its feet rest on it. */
.dct-pet-perch {
  position: absolute;
  top: 0;
  /* Clear of the composer's own top-right controls. */
  right: 68px;
  transform: translateY(-100%);
  pointer-events: none;
  z-index: 3;
  line-height: 0;
  transform-origin: 50% 100%;
}

.dct-pet {
  display: block;
  overflow: visible;
  transform-origin: 50% 100%;
  animation: dct-pet-breathe 3.4s ease-in-out infinite;
}

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

@media (prefers-reduced-motion: reduce) {
  .dct-pet, .dct-pet-perch[data-dct-pet="attentive"] .dct-pet { animation: none; }
  .dct-pet-eyes-closed { animation: none; opacity: 0; }
}
`

module.exports = { PET_CSS }
