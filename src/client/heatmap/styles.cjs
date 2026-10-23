/**
 * heatmap/styles.cjs — the panel's own sheet.
 *
 * The panel is a flex item in the shell's composer stack, above the composer
 * and below the greeting. It is hidden outside the hero phase by the phase
 * marker the shell puts on the hero body; the dock seat exists in a
 * conversation too, but the heatmap belongs to the start page.
 */
const HEATMAP_CSS = String.raw`
.dct-heatmap-card {
  --dct-heat-ink: #4f7df3;
  box-sizing: border-box;
  display: none;
  /* The hero's workspace/model row is a sibling above this dock slot. The card
   * takes the earlier flex position so that row moves below it, next to the
   * composer, instead of sitting between the greeting and the card. The
   * composer wrapper is another sibling; it stays last. */
  order: 1;
  width: min(100%, 520px);
  margin: 0 auto 10px;
  padding: 12px 14px 10px;
  overflow: visible;
  color: var(--dsw-alias-label-primary, #1f2329);
  font-family: var(--dsw-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
  font-size: 12px;
  line-height: 1.4;
  background: color-mix(in srgb, var(--dsw-alias-label-primary, #1f2329) 3%, var(--dsw-alias-bg-layer-2, #fff));
  border: 1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.16));
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}
[data-content-phase="hero"] .dct-heatmap-card { display: block; }
/* The card is one flex item of the composer stack; the hero workspace row and
 * the composer are the next two. Their order puts the row under the card while
 * leaving the greeting and the composer where the shell drew them. */
[data-content-phase="hero"] [class*="heroWorkspaceRow"] { order: 2; }
[data-content-phase="hero"] [data-slot="conversation.composer.bar"] > * { order: 3; }
.dct-heatmap-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 9px;
}
.dct-heatmap-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
}
.dct-heatmap-ranges {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 2px;
  padding: 2px;
  background: color-mix(in srgb, var(--dsw-alias-label-primary, #1f2329) 6%, transparent);
  border-radius: 7px;
}
.dct-heatmap-range {
  padding: 2px 7px;
  font: inherit;
  font-size: 11px;
  line-height: 1.45;
  color: var(--dsw-alias-label-secondary, #667085);
  background: transparent;
  border: 0;
  border-radius: 5px;
  cursor: pointer;
}
.dct-heatmap-range:hover { color: var(--dsw-alias-label-primary, #1f2329); }
.dct-heatmap-range[data-active] {
  color: var(--dsw-alias-label-primary, #1f2329);
  background: var(--dsw-alias-bg-layer-2, #fff);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}
.dct-heatmap-range:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary, #4f7df3);
  outline-offset: 1px;
}
.dct-heatmap-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  margin-bottom: 10px;
}
.dct-heatmap-stat {
  min-width: 0;
  padding: 5px 8px 4px;
  background: color-mix(in srgb, var(--dsw-alias-label-primary, #1f2329) 6.5%, transparent);
  border-radius: 7px;
}
.dct-heatmap-stat-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10px;
  color: var(--dsw-alias-label-secondary, #667085);
}
.dct-heatmap-stat-value {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 1px;
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-primary, #1f2329);
}
.dct-heatmap-grid {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  grid-template-rows: repeat(7, minmax(0, 1fr));
  gap: 3px;
  width: 100%;
}
.dct-heatmap-cell {
  position: relative;
  min-width: 0;
  aspect-ratio: 1;
  border-radius: 2.5px;
  background: color-mix(in srgb, var(--dsw-alias-label-primary, #1f2329) 8%, transparent);
  transition: background-color 0.12s ease;
}
.dct-heatmap-cell[data-level="1"] { background: color-mix(in srgb, var(--dct-heat-ink) 24%, transparent); }
.dct-heatmap-cell[data-level="2"] { background: color-mix(in srgb, var(--dct-heat-ink) 44%, transparent); }
.dct-heatmap-cell[data-level="3"] { background: color-mix(in srgb, var(--dct-heat-ink) 66%, transparent); }
.dct-heatmap-cell[data-level="4"] { background: color-mix(in srgb, var(--dct-heat-ink) 88%, transparent); }
.dct-heatmap-cell:hover {
  outline: 1.5px solid color-mix(in srgb, var(--dct-heat-ink) 70%, var(--dsw-alias-label-primary, #1f2329));
  outline-offset: 1px;
}
.dct-heatmap-cell::after {
  position: absolute;
  z-index: 4;
  bottom: calc(100% + 6px);
  left: 50%;
  display: none;
  padding: 3px 7px;
  content: attr(data-tip);
  transform: translateX(-50%);
  white-space: nowrap;
  font-size: 10px;
  font-weight: 500;
  line-height: 1.5;
  color: var(--dsw-alias-bg-layer-2, #fff);
  background: var(--dsw-alias-label-primary, #1f2329);
  border-radius: 5px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.16);
  pointer-events: none;
}
.dct-heatmap-cell:hover::after { display: block; }
.dct-heatmap-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 7px;
  font-size: 10px;
  color: var(--dsw-alias-label-caption, var(--dsw-alias-label-secondary, #667085));
}
.dct-heatmap-foot > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dct-heatmap-foot > span:last-child { flex: 0 0 auto; }
.dct-heatmap-card[data-loading] .dct-heatmap-stat-value { color: var(--dsw-alias-label-caption, #98a2b3); }
.dct-heatmap-card[data-loading] .dct-heatmap-cell { animation: dct-heatmap-pulse 1.4s ease-in-out infinite; }
@keyframes dct-heatmap-pulse {
  0%, 100% { opacity: 0.45; }
  50% { opacity: 1; }
}
:root[data-theme="dark"] .dct-heatmap-card,
body[data-ds-dark-theme] .dct-heatmap-card { --dct-heat-ink: #7b9cff; }
@media (max-width: 560px) {
  .dct-heatmap-card { padding: 10px 10px 8px; border-radius: 10px; }
  .dct-heatmap-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dct-heatmap-foot > span:last-child { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .dct-heatmap-card[data-loading] .dct-heatmap-cell { animation: none; }
  .dct-heatmap-cell { transition: none; }
}
`

module.exports = { HEATMAP_CSS }
