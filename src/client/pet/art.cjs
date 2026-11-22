/**
 * pet/art.cjs — the companion's pixels, as data.
 *
 * The art is a grid of single characters rather than SVG paths: one character per
 * pixel, one run per colour per row once merged, so the whole companion is a few
 * hundred bytes and the browser draws a handful of rects instead of a raster image.
 *
 * Drawn for this plugin; no asset was copied from anywhere.
 */

/**
 * What each character paints.
 *
 * Every shade is derived from the theme's brand colour rather than borrowed from
 * its text or border tokens: those flip with the palette (a dark theme's "primary
 * text" is nearly white), so a fixed assignment made the cat read as a pale blob
 * under some themes. Mixing toward a near-black ink keeps the outline darker than
 * the body in both modes, whatever hue the theme picked.
 */
const BRAND = 'var(--dsw-alias-brand-primary, #5744a7)'
const PALETTE = {
  '#': `color-mix(in srgb, ${BRAND} 34%, #14121c)`,
  b: BRAND,
  l: `color-mix(in srgb, ${BRAND} 52%, #ffffff)`,
  p: 'color-mix(in srgb, #f08a8a 82%, white)',
  e: `color-mix(in srgb, ${BRAND} 12%, #14121c)`,
  w: '#ffffff',
}

/** A 16×16 cat: ears, head, two eyes and two blush patches. */
const CAT = [
  '................',
  '...#........#...',
  '..#l#......#l#..',
  '..#ll#....#ll#..',
  '..#lll####lll#..',
  '.#bbbbbbbbbbbb#.',
  '.#bbbbbbbbbbbb#.',
  '.#bbeebbbbeebb#.',
  '.#bbeebbbbeebb#.',
  '.#bbppbbbbppbb#.',
  '.#bbbbbppbbbbb#.',
  '..#bbbb##bbbb#..',
  '..#bbbbbbbbbb#..',
  '..##bbbbbbbb##..',
  '...#ll####ll#...',
  '....#######.....',
]

/** Where the eyes are, so a blink can close them without a second grid. */
const EYES = [
  { x: 4, y: 7 }, { x: 5, y: 7 }, { x: 4, y: 8 }, { x: 5, y: 8 },
  { x: 10, y: 7 }, { x: 11, y: 7 }, { x: 10, y: 8 }, { x: 11, y: 8 },
]

/**
 * Merge each row's same-coloured neighbours into one rect.
 *
 * @param rows - Grid of palette characters; '.' is empty.
 * @returns Rects in a 16×16 box, in row order.
 */
function pixelRects(rows) {
  const rects = []
  rows.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const key = row[x]
      if (key === '.' || PALETTE[key] === undefined) { x += 1; continue }
      let width = 1
      while (x + width < row.length && row[x + width] === key) width += 1
      rects.push({ x, y, width, height: 1, fill: PALETTE[key] })
      x += width
    }
  })
  return rects
}

/** The body as rects, with the eyes removed so they can blink on their own. */
function bodyRects() {
  const rows = CAT.map((row) => row.replaceAll('e', 'b'))
  return pixelRects(rows)
}

/** One eye cell, collapsed to the body colour when closed. */
function eyeRects(closed) {
  return EYES.map(({ x, y }) => ({
    x, y, width: 1, height: 1,
    fill: closed ? PALETTE.b : PALETTE.e,
  }))
}

module.exports = { CAT, EYES, PALETTE, pixelRects, bodyRects, eyeRects }
