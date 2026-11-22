/** Where the companion's choices are remembered. */
const STORAGE_KEY_PET = 'dsh-custom-theme.pet'

/** How long to wait before looking for the input card again. */
const RETRY_MS = 250

/** How often to check that the companion is still on the page, once it is. */
const KEEPALIVE_MS = 500

/** One art pixel's size on screen, in CSS pixels. */
const PIXEL_SIZE = 3

/**
 * Where the companion stands along the input card's top edge, as a percentage of
 * the card's width. 93% is the right-hand spot it has always used, kept as the
 * default so an existing setup looks unchanged.
 */
const DEFAULT_OFFSET = 93
const OFFSET_MIN = 2
const OFFSET_MAX = 98

/** How long the companion waits beside the heatmap before hopping down. */
const HOP_DELAY_MS = 900
/** How long that hop takes. */
const HOP_MS = 640

/**
 * Keep an anchor inside the card, whatever is stored or handed in.
 * @param value - Candidate percentage.
 * @returns A number in [OFFSET_MIN, OFFSET_MAX]; the default when unreadable.
 */
function clampOffset(value) {
  const number = typeof value === 'number' ? value : Number.parseFloat(value)
  if (!Number.isFinite(number)) return DEFAULT_OFFSET
  return Math.min(OFFSET_MAX, Math.max(OFFSET_MIN, Math.round(number)))
}

/** The stored choices; a missing or unreadable entry means the defaults. */
function readPetConfig() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_PET)
    if (raw === null) return { enabled: true, offset: DEFAULT_OFFSET }
    const parsed = JSON.parse(raw)
    return {
      enabled: typeof parsed?.enabled === 'boolean' ? parsed.enabled : true,
      offset: clampOffset(parsed?.offset ?? DEFAULT_OFFSET),
    }
  } catch {
    return { enabled: true, offset: DEFAULT_OFFSET }
  }
}

/** Persist the choices; an unwritable store leaves the in-memory value only. */
function writePetConfig(config) {
  try {
    window.localStorage.setItem(STORAGE_KEY_PET, JSON.stringify({
      enabled: config.enabled === true,
      offset: clampOffset(config.offset),
    }))
  } catch {
    // A blocked storage backend is a supported state.
  }
}

module.exports = {
  STORAGE_KEY_PET, RETRY_MS, KEEPALIVE_MS, PIXEL_SIZE,
  DEFAULT_OFFSET, OFFSET_MIN, OFFSET_MAX, HOP_DELAY_MS, HOP_MS,
  clampOffset, readPetConfig, writePetConfig,
}
