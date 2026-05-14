import assert from 'node:assert/strict'
import sharp from 'sharp'

const SCALE = 10
const CARD_WIDTH_MM = 85.6
const CARD_HEIGHT_MM = 54
const CARD_WIDTH = Math.round(CARD_WIDTH_MM * SCALE)
const CARD_HEIGHT = Math.round(CARD_HEIGHT_MM * SCALE)
const COLS = 11
const ROWS = 7
const GAP_MM = 0.5
const MARGIN_MM = 5
const MARKER_GRID_INDICES = new Set([0, 10, 66, 76])
const EMPTY_SWATCH = '#E5E7EB'

const DEFAULT_SWATCHES = [
  '#FF0000', '#00FF00', '#0000FF', '#00FFFF', '#FF00FF',
  '#FFFF00', '#FFA500', '#BFFF00', '#008080', '#800080',
  '#FBE8D3', '#F3C6A5', '#E0AC69', '#C68642', '#8D5524', '#5A3825',
  '#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF', '#E0BBE4', '#D5F4E6', '#F6E2B3',
  '#8B4513', '#A0522D', '#CD853F', '#D2B48C', '#556B2F', '#6B8E23',
  '#FFFFFF', '#E0E0E0', '#C0C0C0', '#A0A0A0', '#808080', '#606060', '#404040', '#303030', '#202020', '#000000',
  '#1A0000', '#330000', '#4D0000', '#660000', '#800000', '#990000', '#B30000', '#CC0000', '#E60000', '#FF0000',
  '#001A00', '#003300', '#004D00', '#006600', '#008000', '#009900', '#00B300', '#00CC00', '#00E600', '#00FF00',
  '#00001A', '#000033', '#00004D', '#000066', '#000080', '#000099', '#0000B3', '#0000CC', '#0000E6', '#0000FF',
]

const SAFE_SWATCHES = Array.from({ length: DEFAULT_SWATCHES.length }, (_, index) => {
  const r = 48 + ((index * 37) % 145)
  const g = 48 + ((index * 61) % 145)
  const b = 48 + ((index * 83) % 145)
  return rgbToHex({ r, g, b })
})

const ARUCO_PATTERNS = {
  0: [
    [0, 0, 1, 1, 1],
    [1, 0, 0, 1, 0],
    [0, 1, 0, 1, 0],
    [0, 0, 1, 0, 0],
    [1, 0, 1, 1, 1],
  ],
  1: [
    [0, 1, 0, 1, 0],
    [1, 0, 1, 0, 1],
    [0, 1, 0, 1, 0],
    [1, 0, 1, 0, 1],
    [0, 1, 0, 1, 0],
  ],
  2: [
    [0, 0, 0, 1, 1],
    [1, 0, 0, 1, 0],
    [0, 1, 1, 0, 0],
    [0, 1, 0, 1, 0],
    [0, 1, 0, 0, 1],
  ],
  3: [
    [1, 0, 0, 0, 1],
    [0, 1, 0, 0, 0],
    [0, 0, 1, 1, 0],
    [1, 0, 1, 0, 0],
    [1, 1, 0, 0, 1],
  ],
}

function hexToRgb(hex) {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  }
}

function rgbToHex({ r, g, b }) {
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase()
}

function clamp(value) {
  return Math.max(0, Math.min(255, value))
}

function calculateLayout() {
  const gap = GAP_MM * SCALE
  const margin = MARGIN_MM * SCALE
  const totalGapWidth = gap * (COLS - 1)
  const totalGapHeight = gap * (ROWS - 1)
  const availableWidth = CARD_WIDTH - (2 * margin) - totalGapWidth
  const availableHeight = CARD_HEIGHT - (2 * margin) - totalGapHeight
  const swatchSize = Math.min(availableWidth / COLS, availableHeight / ROWS)
  const gridWidth = (COLS * swatchSize) + totalGapWidth
  const gridHeight = (ROWS * swatchSize) + totalGapHeight

  return {
    gap,
    swatchSize,
    centerX: (CARD_WIDTH - gridWidth) / 2,
    centerY: (CARD_HEIGHT - gridHeight) / 2,
  }
}

function getGridPosition(gridIndex, layout = calculateLayout()) {
  const row = Math.floor(gridIndex / COLS)
  const col = gridIndex % COLS

  return {
    x: layout.centerX + (col * (layout.swatchSize + layout.gap)),
    y: layout.centerY + (row * (layout.swatchSize + layout.gap)),
    width: layout.swatchSize,
    height: layout.swatchSize,
  }
}

function swatchIndexToGridIndex(swatchIndex) {
  let swatchCount = 0
  for (let gridIndex = 0; gridIndex < COLS * ROWS; gridIndex += 1) {
    if (MARKER_GRID_INDICES.has(gridIndex)) continue
    if (swatchCount === swatchIndex) return gridIndex
    swatchCount += 1
  }
  throw new Error(`Swatch index ${swatchIndex} is outside the CR80 grid`)
}

function createPixelBuffer() {
  const pixels = Buffer.alloc(CARD_WIDTH * CARD_HEIGHT * 4)
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 255
    pixels[i + 1] = 255
    pixels[i + 2] = 255
    pixels[i + 3] = 255
  }
  return pixels
}

function setPixel(pixels, x, y, { r, g, b }) {
  if (x < 0 || x >= CARD_WIDTH || y < 0 || y >= CARD_HEIGHT) return
  const index = ((y * CARD_WIDTH) + x) * 4
  pixels[index] = r
  pixels[index + 1] = g
  pixels[index + 2] = b
  pixels[index + 3] = 255
}

function fillRect(pixels, rect, color) {
  const x0 = Math.round(rect.x)
  const y0 = Math.round(rect.y)
  const x1 = Math.round(rect.x + rect.width)
  const y1 = Math.round(rect.y + rect.height)

  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      setPixel(pixels, x, y, color)
    }
  }
}

function drawMarker(pixels, gridIndex, markerId) {
  const rect = getGridPosition(gridIndex)
  const cellSize = rect.width / 7
  const pattern = ARUCO_PATTERNS[markerId]

  for (let row = 0; row < 7; row += 1) {
    for (let col = 0; col < 7; col += 1) {
      const isWhite = row > 0 && row < 6 && col > 0 && col < 6 && pattern[row - 1][col - 1] === 1
      fillRect(pixels, {
        x: rect.x + (col * cellSize),
        y: rect.y + (row * cellSize),
        width: cellSize,
        height: cellSize,
      }, isWhite ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 })
    }
  }
}

function renderExport(colors, mutateColor = (color) => color) {
  const pixels = createPixelBuffer()
  const markerIdsByGridIndex = new Map([[0, 0], [10, 1], [66, 2], [76, 3]])

  for (let gridIndex = 0; gridIndex < COLS * ROWS; gridIndex += 1) {
    if (MARKER_GRID_INDICES.has(gridIndex)) {
      drawMarker(pixels, gridIndex, markerIdsByGridIndex.get(gridIndex))
      continue
    }

    let swatchIndex = 0
    for (let i = 0; i < gridIndex; i += 1) {
      if (!MARKER_GRID_INDICES.has(i)) swatchIndex += 1
    }

    const color = hexToRgb(colors[swatchIndex] ?? EMPTY_SWATCH)
    fillRect(pixels, getGridPosition(gridIndex), mutateColor(color))
  }

  return pixels
}

function sampleAverageColor(pixels, centerX, centerY, radius = 2) {
  let r = 0
  let g = 0
  let b = 0
  let count = 0

  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      const index = ((y * CARD_WIDTH) + x) * 4
      r += pixels[index]
      g += pixels[index + 1]
      b += pixels[index + 2]
      count += 1
    }
  }

  return rgbToHex({
    r: Math.round(r / count),
    g: Math.round(g / count),
    b: Math.round(b / count),
  })
}

function scanExport(pixels, referenceColors) {
  return referenceColors.map((original, swatchIndex) => {
    const gridIndex = swatchIndexToGridIndex(swatchIndex)
    const rect = getGridPosition(gridIndex)
    const scanned = sampleAverageColor(
      pixels,
      Math.round(rect.x + (rect.width / 2)),
      Math.round(rect.y + (rect.height / 2)),
    )
    const expected = hexToRgb(original)
    const actual = hexToRgb(scanned)

    return {
      original: original.toUpperCase(),
      scanned,
      difference: {
        r: actual.r - expected.r,
        g: actual.g - expected.g,
        b: actual.b - expected.b,
      },
    }
  })
}

function applyInverseCorrection(scanned, difference) {
  const rgb = hexToRgb(scanned)
  return rgbToHex({
    r: clamp(rgb.r - difference.r),
    g: clamp(rgb.g - difference.g),
    b: clamp(rgb.b - difference.b),
  })
}

async function writeDebugImage(path, pixels) {
  await sharp(pixels, {
    raw: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      channels: 4,
    },
  }).png().toFile(path)
}

const exactPixels = renderExport(DEFAULT_SWATCHES)
const exactScan = scanExport(exactPixels, DEFAULT_SWATCHES)
const mismatches = exactScan.filter(({ original, scanned }) => original !== scanned)

assert.deepEqual(mismatches, [], 'Export-as-scan should produce a 100% color match')

const drift = { r: -12, g: 18, b: -7 }
const driftedPixels = renderExport(SAFE_SWATCHES, ({ r, g, b }) => ({
  r: clamp(r + drift.r),
  g: clamp(g + drift.g),
  b: clamp(b + drift.b),
}))
const driftedScan = scanExport(driftedPixels, SAFE_SWATCHES)

for (const comparison of driftedScan) {
  assert.deepEqual(comparison.difference, drift, `${comparison.original} should report the applied RGB drift`)
  assert.equal(
    applyInverseCorrection(comparison.scanned, comparison.difference),
    comparison.original,
    `${comparison.original} should be recovered by inverse correction`,
  )
}

await writeDebugImage('/tmp/calibration-export-exact.png', exactPixels)
await writeDebugImage('/tmp/calibration-export-drifted.png', driftedPixels)

console.log(`Exact export scan: ${exactScan.length}/${DEFAULT_SWATCHES.length} colors matched`)
console.log(`Manipulated scan: ${driftedScan.length}/${SAFE_SWATCHES.length} colors detected drift ${JSON.stringify(drift)} and corrected back`)
console.log('Debug images: /tmp/calibration-export-exact.png, /tmp/calibration-export-drifted.png')
