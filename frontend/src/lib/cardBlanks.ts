/**
 * Blank card templates.
 *
 * Produces an ID-1 (CR80) card as a correctly named, correctly sized SVG, so a
 * designer starts from real geometry instead of guessing where the bleed, the
 * safe area and the magnetic stripe go.
 *
 * Dimensions follow ISO/IEC 7810 ID-1 and ISO/IEC 7811-2. Card printers vary,
 * so treat the defaults as a starting point and check them against the printer
 * you actually use.
 */

import type { BarcodeSymbology } from './barcode'

const SVG_NS = 'http://www.w3.org/2000/svg'

/** ISO/IEC 7810 ID-1: the size of a bank card, in millimetres. */
export const ID1_WIDTH_MM = 85.6
export const ID1_HEIGHT_MM = 53.98

/** Usual bleed for card printing. */
export const DEFAULT_BLEED_MM = 1
/** Keep artwork that must not be trimmed inside this margin. */
export const DEFAULT_SAFE_MARGIN_MM = 3

/**
 * The three magnetic tracks of ISO/IEC 7811-2, measured from the card's top
 * edge on the back. The physical stripe has to cover all three.
 */
export const MAGNETIC_TRACKS_MM = [
  { track: 1, top: 5.54, bottom: 8.0 },
  { track: 2, top: 8.46, bottom: 10.92 },
  { track: 3, top: 11.38, bottom: 13.84 },
]

/**
 * Default stripe geometry: half-inch tape placed to cover all three tracks
 * with a margin either side.
 */
export const DEFAULT_MAGNETIC_STRIPE = {
  /** Distance from the top edge of the card to the top of the stripe. */
  topMm: 4,
  /** 12.7 mm is half-inch tape; 15.88 mm (0.625") is the other common size. */
  heightMm: 12.7,
}

/** Where a lanyard slot or hole is punched. */
export type PunchPosition =
  | 'none'
  | 'top-center'
  | 'top-left'
  | 'top-right'
  | 'left-center'
  | 'right-center'
  | 'bottom-center'

export type PunchShape = 'slot' | 'round'

export const PUNCH_POSITIONS: PunchPosition[] = [
  'none',
  'top-center',
  'top-left',
  'top-right',
  'left-center',
  'right-center',
  'bottom-center',
]

export const PUNCH_POSITION_LABELS: Record<PunchPosition, string> = {
  none: 'No punch',
  'top-center': 'Top, centred',
  'top-left': 'Top left',
  'top-right': 'Top right',
  'left-center': 'Left edge, centred',
  'right-center': 'Right edge, centred',
  'bottom-center': 'Bottom, centred',
}

/** A typical badge slot is 3 mm x 12 mm; a round hole is 5 mm across. */
export const DEFAULT_PUNCH = {
  slotWidthMm: 12,
  slotHeightMm: 3,
  roundDiameterMm: 5,
  /** Distance from the card edge to the near side of the punch. */
  edgeOffsetMm: 3,
}

export type CardBlankOptions = {
  side: 'front' | 'back'
  widthMm?: number
  heightMm?: number
  bleedMm?: number
  safeMarginMm?: number
  /** Draw the ISO magnetic stripe. Backs only. */
  magneticStripe?: boolean
  magneticStripeTopMm?: number
  magneticStripeHeightMm?: number
  /** Draw the ISO track boundaries inside the stripe, as a guide. */
  showMagneticTracks?: boolean
  punch?: PunchPosition
  punchShape?: PunchShape
  /** Draw a signature panel below the stripe. Backs only. */
  signaturePanel?: boolean
  /** Add a placeholder photo layer. Fronts only. */
  photo?: boolean
  /** Add a barcode placeholder layer of this symbology. */
  barcode?: BarcodeSymbology | null
  /** The field a barcode placeholder encodes. */
  barcodeField?: string
  /** Include the bleed and safe-area guide layer. */
  guides?: boolean
}

type Rect = { x: number; y: number; width: number; height: number }

/**
 * Where the punch sits, in card coordinates.
 */
export function getPunchRect(
  options: Pick<CardBlankOptions, 'punch' | 'punchShape'> & { widthMm: number; heightMm: number },
): Rect | null {
  const { punch = 'none', punchShape = 'slot', widthMm, heightMm } = options
  if (punch === 'none') return null

  const horizontal = punch.startsWith('top') || punch.startsWith('bottom')
  const slotLong = DEFAULT_PUNCH.slotWidthMm
  const slotShort = DEFAULT_PUNCH.slotHeightMm

  const width =
    punchShape === 'round' ? DEFAULT_PUNCH.roundDiameterMm : horizontal ? slotLong : slotShort
  const height =
    punchShape === 'round' ? DEFAULT_PUNCH.roundDiameterMm : horizontal ? slotShort : slotLong

  const offset = DEFAULT_PUNCH.edgeOffsetMm
  const centreX = widthMm / 2 - width / 2
  const centreY = heightMm / 2 - height / 2

  switch (punch) {
    case 'top-center':
      return { x: centreX, y: offset, width, height }
    case 'top-left':
      return { x: widthMm * 0.25 - width / 2, y: offset, width, height }
    case 'top-right':
      return { x: widthMm * 0.75 - width / 2, y: offset, width, height }
    case 'bottom-center':
      return { x: centreX, y: heightMm - offset - height, width, height }
    case 'left-center':
      return { x: offset, y: centreY, width, height }
    case 'right-center':
      return { x: widthMm - offset - width, y: centreY, width, height }
    default:
      return null
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function round(value: number): string {
  return String(Math.round(value * 1000) / 1000)
}

/**
 * Build a blank card template as SVG markup.
 *
 * Everything is laid out in millimetres, and the viewBox uses the same units,
 * so numbers in the file read as real card measurements.
 */
export function createCardBlankSvg(options: CardBlankOptions): string {
  const {
    side,
    widthMm = ID1_WIDTH_MM,
    heightMm = ID1_HEIGHT_MM,
    bleedMm = DEFAULT_BLEED_MM,
    safeMarginMm = DEFAULT_SAFE_MARGIN_MM,
    magneticStripe = false,
    magneticStripeTopMm = DEFAULT_MAGNETIC_STRIPE.topMm,
    magneticStripeHeightMm = DEFAULT_MAGNETIC_STRIPE.heightMm,
    showMagneticTracks = false,
    punch = 'none',
    punchShape = 'slot',
    signaturePanel = false,
    photo = side === 'front',
    barcode = null,
    barcodeField = 'studentId',
    guides = true,
  } = options

  const parts: string[] = []

  parts.push(`  <rect id="cardBackground" x="0" y="0" width="${round(widthMm)}" height="${round(heightMm)}" fill="#ffffff"/>`)

  if (magneticStripe && side === 'back') {
    parts.push('  <g id="magneticStripe">')
    parts.push(
      `    <rect x="0" y="${round(magneticStripeTopMm)}" width="${round(widthMm)}" ` +
        `height="${round(magneticStripeHeightMm)}" fill="#1a1a1a"/>`,
    )
    if (showMagneticTracks) {
      for (const track of MAGNETIC_TRACKS_MM) {
        parts.push(
          `    <rect class="magneticTrackGuide" x="0" y="${round(track.top)}" width="${round(widthMm)}" ` +
            `height="${round(track.bottom - track.top)}" fill="none" stroke="#00d0ff" ` +
            `stroke-width="0.12" stroke-dasharray="1 1"/>`,
        )
      }
    }
    parts.push('  </g>')
  }

  if (signaturePanel && side === 'back') {
    const panelTop = magneticStripe ? magneticStripeTopMm + magneticStripeHeightMm + 3 : 8
    parts.push(
      `  <rect id="signaturePanel" x="${round(safeMarginMm)}" y="${round(panelTop)}" ` +
        `width="${round(widthMm - safeMarginMm * 2)}" height="10" fill="#f2f2f2" stroke="#cccccc" stroke-width="0.2"/>`,
    )
  }

  if (photo && side === 'front') {
    parts.push(
      `  <rect id="photo" x="${round(safeMarginMm)}" y="${round(safeMarginMm + 4)}" width="22" height="28" ` +
        `fill="#e4e4e7" stroke="#b4b4bb" stroke-width="0.2"/>`,
    )
  }

  if (side === 'front') {
    const textX = safeMarginMm + 26
    parts.push(
      `  <text id="fullName_First_LineBreak_Last" x="${round(textX)}" y="${round(safeMarginMm + 12)}" ` +
        `font-family="Helvetica, Arial, sans-serif" font-size="4.2" font-weight="700" fill="#111111">` +
        `<tspan x="${round(textX)}" y="${round(safeMarginMm + 12)}">Sample</tspan>` +
        `<tspan x="${round(textX)}" y="${round(safeMarginMm + 17)}">Person</tspan></text>`,
    )
    parts.push(
      `  <text id="position_AllCaps" x="${round(textX)}" y="${round(safeMarginMm + 23)}" ` +
        `font-family="Helvetica, Arial, sans-serif" font-size="2.6" fill="#444444">POSITION</text>`,
    )
    parts.push(
      `  <text id="studentId" x="${round(textX)}" y="${round(safeMarginMm + 28)}" ` +
        `font-family="Helvetica, Arial, sans-serif" font-size="2.8" fill="#111111">000000000</text>`,
    )
  }

  if (barcode) {
    const layerId = barcodeField ? `barcode_${barcode}_${barcodeField}` : `barcode_${barcode}`
    const barcodeY = side === 'back' ? heightMm - safeMarginMm - 2 : heightMm - safeMarginMm - 2
    parts.push(
      `  <text id="${escapeXml(layerId)}" x="${round(safeMarginMm)}" y="${round(barcodeY)}" ` +
        `font-family="Helvetica, Arial, sans-serif" font-size="9" fill="#111111">000000000</text>`,
    )
  }

  const punchRect = getPunchRect({ punch, punchShape, widthMm, heightMm })
  if (punchRect) {
    parts.push('  <g id="punchGuide" fill="none" stroke="#ff2d55" stroke-width="0.2" stroke-dasharray="0.8 0.6">')
    if (punchShape === 'round') {
      parts.push(
        `    <circle cx="${round(punchRect.x + punchRect.width / 2)}" cy="${round(punchRect.y + punchRect.height / 2)}" ` +
          `r="${round(punchRect.width / 2)}"/>`,
      )
    } else {
      const radius = Math.min(punchRect.width, punchRect.height) / 2
      parts.push(
        `    <rect x="${round(punchRect.x)}" y="${round(punchRect.y)}" width="${round(punchRect.width)}" ` +
          `height="${round(punchRect.height)}" rx="${round(radius)}"/>`,
      )
    }
    parts.push('  </g>')
  }

  if (guides) {
    parts.push('  <g id="printGuides" fill="none" stroke-width="0.15" pointer-events="none">')
    parts.push(
      `    <rect x="${round(-bleedMm)}" y="${round(-bleedMm)}" width="${round(widthMm + bleedMm * 2)}" ` +
        `height="${round(heightMm + bleedMm * 2)}" stroke="#ff9500" stroke-dasharray="1 1"/>`,
    )
    parts.push(
      `    <rect x="${round(safeMarginMm)}" y="${round(safeMarginMm)}" width="${round(widthMm - safeMarginMm * 2)}" ` +
        `height="${round(heightMm - safeMarginMm * 2)}" stroke="#34c759" stroke-dasharray="1 1"/>`,
    )
    parts.push('  </g>')
  }

  const title = side === 'front' ? 'Card front' : 'Card back'
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="${SVG_NS}" width="${round(widthMm)}mm" height="${round(heightMm)}mm" ` +
      `viewBox="0 0 ${round(widthMm)} ${round(heightMm)}">`,
    `  <title>${title}</title>`,
    `  <desc>ID-1 card blank, ${round(widthMm)} x ${round(heightMm)} mm. Units are millimetres.</desc>`,
    ...parts,
    '</svg>',
    '',
  ].join('\n')
}

/**
 * A file name for a generated blank.
 */
export function cardBlankFileName(options: Pick<CardBlankOptions, 'side' | 'magneticStripe'>): string {
  const suffix = options.magneticStripe && options.side === 'back' ? '-magstripe' : ''
  return `card-${options.side}${suffix}.svg`
}

/**
 * Whether a punch would cut through the magnetic stripe.
 *
 * Punching the stripe destroys the encoding under the hole and is a common way
 * to ruin a batch of cards, so mag-stripe cards are normally punched on an end
 * (left or right, centred) or along the bottom edge.
 */
export function punchConflictsWithStripe(options: {
  punch?: PunchPosition
  punchShape?: PunchShape
  widthMm?: number
  heightMm?: number
  magneticStripeTopMm?: number
  magneticStripeHeightMm?: number
}): boolean {
  const {
    punch = 'none',
    punchShape = 'slot',
    widthMm = ID1_WIDTH_MM,
    heightMm = ID1_HEIGHT_MM,
    magneticStripeTopMm = DEFAULT_MAGNETIC_STRIPE.topMm,
    magneticStripeHeightMm = DEFAULT_MAGNETIC_STRIPE.heightMm,
  } = options

  const rect = getPunchRect({ punch, punchShape, widthMm, heightMm })
  if (!rect) return false

  const stripeTop = magneticStripeTopMm
  const stripeBottom = magneticStripeTopMm + magneticStripeHeightMm
  return rect.y < stripeBottom && rect.y + rect.height > stripeTop
}

/** Punch positions that clear a magnetic stripe. */
export const STRIPE_SAFE_PUNCHES: PunchPosition[] = ['left-center', 'right-center', 'bottom-center']
