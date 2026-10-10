/**
 * settings/styles.cjs — the settings page's own stylesheet.
 */
const { EFFORT_CSS } = require('../effort/styles.cjs')
const { INJECTION_CSS } = require('../injections/constants.cjs')

const PAGE_CSS = `
.dct-page { display: flex; flex-direction: column; gap: 14px; max-width: 780px; padding: 4px 0 28px; }
.dct-heading { margin: 0 0 2px; font-size: 16px; font-weight: 600; color: var(--dsw-alias-label-primary, inherit); display: flex; align-items: center; gap: 8px; }

/* Modern Card Layout */
.dct-card {
  box-sizing: border-box;
  background: var(--dsw-alias-bg-layer-1, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.16));
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  transition: border-color 0.18s ease;
  max-width: 100%;
}
.dct-card:hover { border-color: var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.28)); }
.dct-card-header { display: flex; flex-direction: column; gap: 2px; padding-bottom: 8px; border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.1)); }
.dct-card-title { font-size: 14px; font-weight: 600; color: var(--dsw-alias-label-primary, inherit); display: flex; align-items: center; gap: 6px; }
.dct-card-icon { font-size: 15px; line-height: 1; }
.dct-card-desc { font-size: 12px; color: var(--dsw-alias-label-secondary, inherit); line-height: 1.4; }
.dct-card-body { display: flex; flex-direction: column; gap: 12px; }

/* Rows and items */
.dct-row { display: flex; align-items: center; justify-content: space-between; gap: 12px 16px; padding: 4px 0; flex-wrap: wrap; box-sizing: border-box; }
.dct-row-divider { border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.08)); padding-bottom: 10px; }
.dct-text { flex: 1 1 180px; min-width: 140px; }
.dct-title { font-size: 13px; font-weight: 500; color: var(--dsw-alias-label-primary, inherit); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.dct-hint { margin-top: 2px; font-size: 12px; color: var(--dsw-alias-label-secondary, inherit); line-height: 1.4; }
.dct-note { margin-top: 4px; font-size: 11px; color: var(--dsw-alias-label-caption, inherit); }
.dct-badge { display: inline-block; padding: 1px 6px; font-size: 11px; font-weight: 400; border-radius: 4px; background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.12)); color: var(--dsw-alias-label-secondary, inherit); }

.dct-control { display: flex; flex: 0 0 auto; align-items: center; gap: 8px; max-width: 100%; margin-left: auto; }
.dct-wrap { flex-wrap: wrap; justify-content: flex-end; gap: 8px; max-width: 65%; }

/* Capsule Segmented Control */
.dct-capsule-group {
  display: inline-flex;
  align-items: center;
  background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.1));
  border: 1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.18));
  border-radius: 9999px;
  padding: 2px;
  gap: 2px;
  user-select: none;
  max-width: 100%;
  box-sizing: border-box;
}
.dct-capsule-group.dct-capsule-sm .dct-capsule-btn { padding: 3px 8px; font-size: 11px; }
.dct-capsule-btn {
  border: none;
  background: transparent;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--dsw-alias-label-secondary, inherit);
  border-radius: 9999px;
  cursor: pointer;
  transition: all 0.16s cubic-bezier(0.4, 0, 0.2, 1);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  white-space: nowrap;
  line-height: 1.3;
}
.dct-capsule-btn:hover:not(:disabled) {
  color: var(--dsw-alias-label-primary, inherit);
  background: rgba(127, 127, 127, 0.12);
}
.dct-capsule-btn.selected {
  background: var(--dsw-alias-bg-layer-1, #ffffff);
  color: var(--dsw-alias-label-primary, inherit);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 0 0 1px var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.08));
}
.dct-capsule-btn:disabled { opacity: 0.45; cursor: default; }

/* Interactive Range Slider + Number control */
.dct-slider-control { display: inline-flex; align-items: center; gap: 10px; width: 100%; max-width: 280px; }
.dct-slider {
  flex: 1 1 auto;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.25));
  border-radius: 4px;
  outline: none;
  cursor: pointer;
  transition: background 0.15s ease;
}
.dct-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--dsw-alias-brand-primary, #4078c0);
  border: 2px solid var(--dsw-alias-bg-layer-1, #ffffff);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  cursor: pointer;
  transition: transform 0.12s ease;
}
.dct-slider::-webkit-slider-thumb:hover { transform: scale(1.2); }
.dct-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--dsw-alias-brand-primary, #4078c0);
  border: 2px solid var(--dsw-alias-bg-layer-1, #ffffff);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  cursor: pointer;
}
.dct-slider-input-wrap { display: inline-flex; align-items: center; gap: 4px; }

/* Informative Detail Banner */
.dct-detail-banner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--dsw-alias-label-secondary, inherit);
  background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.08));
  border: 1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.14));
  border-radius: 8px;
}
.dct-detail-icon { font-size: 14px; line-height: 1; flex-shrink: 0; }

/* Preset pills */
.dct-presets-row { display: flex; align-items: center; justify-content: space-between; gap: 8px 12px; padding: 2px 0 6px; flex-wrap: wrap; }
.dct-presets-label { font-size: 12px; color: var(--dsw-alias-label-secondary, inherit); font-weight: 500; }

/* Hidden accessible element (synchronizes native selects/inputs with capsules for test & a11y compatibility) */
.dct-sr-only {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip: rect(0, 0, 0, 0) !important;
  white-space: nowrap !important;
  border: 0 !important;
  pointer-events: none !important;
  opacity: 0 !important;
}

/* Base select and button */
.dct-select {
  max-width: 240px;
  padding: 5px 10px;
  font: inherit;
  font-size: 13px;
  color: var(--dsw-alias-label-primary, inherit);
  background: var(--dsw-alias-bg-layer-2, transparent);
  border: 1px solid var(--dsw-alias-border-l1, currentColor);
  border-radius: 7px;
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.dct-select:hover { border-color: var(--dsw-alias-border-l2, currentColor); }
.dct-select:focus { border-color: var(--dsw-alias-brand-primary, #4078c0); box-shadow: 0 0 0 2px rgba(64, 120, 192, 0.15); }
.dct-button {
  padding: 5px 12px;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  color: var(--dsw-alias-label-primary, inherit);
  background: var(--dsw-alias-bg-layer-2, transparent);
  border: 1px solid var(--dsw-alias-border-l1, currentColor);
  border-radius: 7px;
  cursor: pointer;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.dct-button:hover:not(:disabled) {
  background: var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.15));
  border-color: var(--dsw-alias-border-l2, currentColor);
}
.dct-button:active:not(:disabled) { transform: scale(0.98); }
.dct-button:disabled, .dct-select:disabled { opacity: 0.5; cursor: default; }

.dct-error { margin-top: 6px; font-size: 12px; color: var(--dsw-alias-state-error-primary, #d33); }
.dct-number {
  width: 64px;
  padding: 4px 6px;
  font: inherit;
  font-size: 13px;
  text-align: center;
  color: var(--dsw-alias-label-primary, inherit);
  background: var(--dsw-alias-bg-layer-2, transparent);
  border: 1px solid var(--dsw-alias-border-l1, currentColor);
  border-radius: 7px;
}
.dct-unit { font-size: 12px; color: var(--dsw-alias-label-secondary, inherit); margin: 0 2px 0 1px; align-self: center; }
.dct-sub { margin-top: 2px; align-items: flex-start; }
.dct-sub .dct-wrap .dct-select { max-width: 140px; }
.dct-area {
  width: 100%;
  max-width: 320px;
  min-height: 60px;
  padding: 6px 10px;
  font: inherit;
  font-size: 13px;
  line-height: 1.45;
  color: var(--dsw-alias-label-primary, inherit);
  background: var(--dsw-alias-bg-layer-2, transparent);
  border: 1px solid var(--dsw-alias-border-l1, currentColor);
  border-radius: 8px;
  resize: vertical;
  outline: none;
  transition: border-color 0.15s;
}
.dct-area:focus { border-color: var(--dsw-alias-brand-primary, #4078c0); box-shadow: 0 0 0 2px rgba(64, 120, 192, 0.15); }
.dct-area::placeholder { color: var(--dsw-alias-label-caption, currentColor); opacity: 0.85; }
/* Single-line fields take the same frame as the textareas, without their height. */
.dct-field {
  width: 100%;
  max-width: 320px;
  padding: 6px 10px;
  font: inherit;
  font-size: 13px;
  color: var(--dsw-alias-label-primary, inherit);
  background: var(--dsw-alias-bg-layer-2, transparent);
  border: 1px solid var(--dsw-alias-border-l1, currentColor);
  border-radius: 8px;
  outline: none;
  transition: border-color 0.15s;
}
.dct-field:focus { border-color: var(--dsw-alias-brand-primary, #4078c0); box-shadow: 0 0 0 2px rgba(64, 120, 192, 0.15); }
.dct-field::placeholder { color: var(--dsw-alias-label-caption, currentColor); opacity: 0.85; }
/* The three stylesheet boxes are code, and are read as such: alignment is kept, and a
   long rule wraps instead of scrolling sideways out of the box. */
.dct-branding .dct-area {
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
}
.dct-sub .dct-wrap .dct-input { width: 130px; }

/* Color pickers */
.dct-color { display: inline-flex; align-items: center; gap: 6px; }
.dct-color-input {
  width: 32px;
  height: 26px;
  padding: 1px;
  background: transparent;
  border: 1px solid var(--dsw-alias-border-l1, currentColor);
  border-radius: 6px;
  cursor: pointer;
}
.dct-color-code { font-size: 11px; color: var(--dsw-alias-label-secondary, inherit); font-family: monospace; }

/* Status Text Live Preview */
.dct-work-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 38px;
  margin: 4px 0 0;
  padding: 10px 14px;
  font-size: 14px;
  background: var(--dsw-alias-bg-layer-2, rgba(0, 0, 0, 0.05));
  border: 1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.18));
  border-radius: 9px;
}
.dct-work-preview > small { margin-left: auto; font-size: 11px; color: var(--dsw-alias-label-secondary, inherit); }
.dct-work-preview-note { font-size: 12px; color: var(--dsw-alias-label-secondary, inherit); }

/* Animated sample band */
.dct-work-effect { position: relative; display: inline-block; white-space: pre; }
.dct-work-sweep {
  position: absolute;
  inset: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-shimmer, currentColor);
  pointer-events: none;
  user-select: none;
  mask-image: linear-gradient(105deg, transparent 0%, black 40% 60%, transparent 100%);
  -webkit-mask-image: linear-gradient(105deg, transparent 0%, black 40% 60%, transparent 100%);
  transform: translateX(-100%);
  animation: dct-work-band 1.5s steps(48, end) infinite;
}
.dct-work-sweep-text {
  display: block;
  width: 100%;
  height: 100%;
  color: inherit;
  transform: translateX(100%);
  animation: dct-work-band-text 1.5s steps(48, end) infinite;
}
@keyframes dct-work-band { 0% { transform: translateX(-100%); } 66.6667%, 100% { transform: translateX(100%); } }
@keyframes dct-work-band-text { 0% { transform: translateX(100%); } 66.6667%, 100% { transform: translateX(-100%); } }
@media (prefers-reduced-motion: reduce) { .dct-work-sweep { display: none; } }

/* Modern toggle switch for injections and checkboxes */
.dct-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  font-size: 13px;
  color: var(--dsw-alias-label-primary, inherit);
}
.dct-toggle input[type="checkbox"] {
  cursor: pointer;
  width: 16px;
  height: 16px;
  accent-color: var(--dsw-alias-brand-primary, #4078c0);
}

/* Update section */
.dct-update-badge { padding: 2px 8px; font-size: 12px; color: var(--dsw-alias-label-primary, inherit); background: var(--dsw-alias-bg-layer-2, transparent); border: 1px solid var(--dsw-alias-border-l1, currentColor); border-radius: 10px; }
.dct-update-section { margin-top: 6px; padding-top: 12px; border-top: 1px solid var(--dsw-alias-border-l1, currentColor); }
.dct-update-section .dct-text { margin-bottom: 8px; }
.dct-update-section .dct-control { justify-content: flex-start; }

/* Background Workbench */
.dct-file { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
.dct-zones { display: grid; grid-template-columns: repeat(auto-fit, minmax(84px, 1fr)); gap: 6px; margin-top: 4px; }
.dct-zone-tab {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 6px 10px;
  font: inherit;
  text-align: left;
  color: var(--dsw-alias-label-secondary, inherit);
  background: var(--dsw-alias-bg-layer-2, transparent);
  border: 1px solid var(--dsw-alias-border-l1, currentColor);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.dct-zone-tab:hover { border-color: var(--dsw-alias-border-l2, currentColor); }
.dct-zone-tab.selected { color: var(--dsw-alias-label-primary, inherit); border-color: var(--dsw-alias-brand-primary, var(--dsw-alias-label-primary, currentColor)); background: var(--dsw-alias-bg-layer-1, rgba(255,255,255,0.06)); font-weight: 500; }
.dct-zone-tab:disabled { opacity: 0.5; cursor: default; }
.dct-zone-tab strong { font-size: 13px; font-weight: 500; }
.dct-zone-tab small { max-width: 100%; overflow: hidden; font-size: 11px; color: var(--dsw-alias-label-caption, inherit); text-overflow: ellipsis; white-space: nowrap; }
.dct-zone-tab.has-image strong::after { content: "●"; margin-left: 5px; font-size: 8px; vertical-align: middle; color: var(--dsw-alias-brand-primary, #4078c0); }

/* Schematic preview */
.dct-schematic {
  position: relative;
  isolation: isolate;
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr) 84px;
  grid-template-rows: 28px minmax(0, 1fr);
  grid-template-areas: "windowbar windowbar windowbar" "sidebar main dock";
  gap: 6px;
  min-height: 154px;
  margin-top: 6px;
  padding: 18px 12px 12px;
  border-radius: 9px;
  background: var(--dsw-alias-bg-layer-2, rgba(0, 0, 0, 0.04));
  border: 1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.15));
}
.dct-schematic button {
  min-width: 0;
  display: grid;
  place-items: center;
  padding: 6px;
  font: inherit;
  font-size: 11px;
  color: var(--dsw-alias-label-secondary, inherit);
  background: var(--dsw-alias-bg-layer-1, transparent);
  border: 1px solid var(--dsw-alias-border-l1, currentColor);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.12s ease;
}
.dct-schematic button:hover { border-color: var(--dsw-alias-border-l2, currentColor); }
.dct-schematic button.selected { color: var(--dsw-alias-label-primary, inherit); border-color: var(--dsw-alias-brand-primary, var(--dsw-alias-label-primary, currentColor)); font-weight: 600; }
.dct-schematic button:disabled { opacity: 0.5; cursor: default; }
.dct-schematic button.has-image::before { content: "●"; margin-right: 4px; font-size: 8px; color: var(--dsw-alias-brand-primary, #4078c0); }
.dct-schematic button.dct-schematic-global {
  position: absolute;
  inset: 0;
  z-index: 0;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: 4px 10px;
  border: 1px dashed var(--dsw-alias-border-l1, currentColor);
  border-radius: 9px;
  background: transparent;
}
.dct-schematic button.dct-schematic-global.selected { color: var(--dsw-alias-label-primary, inherit); border-color: var(--dsw-alias-brand-primary, var(--dsw-alias-label-primary, currentColor)); }
.dct-schematic button.dct-schematic-global.has-image { border-style: solid; }
.dct-schematic button.dct-schematic-global.has-image::before { margin-top: 3px; }
.dct-schematic-windowbar { grid-area: windowbar; z-index: 1; position: relative; }
.dct-schematic-sidebar { grid-area: sidebar; z-index: 1; position: relative; }
.dct-schematic-dock { grid-area: dock; z-index: 1; position: relative; }
.dct-schematic-main { grid-area: main; z-index: 1; position: relative; display: grid; grid-template-rows: minmax(0, 1fr) 28px; gap: 6px; }

${INJECTION_CSS}
${EFFORT_CSS}
`

module.exports = { PAGE_CSS }
