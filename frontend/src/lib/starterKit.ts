/**
 * A designer's starter kit: the front and back of a card as artboards at the
 * real size, with bleed, the trim line, the safe area and the punch drawn as
 * guides, and the personalised layers already named.
 *
 * The point is that artwork drawn on these comes back into the app ready to
 * print, with nothing to set up:
 *
 * - The card is a rectangle named `guide_trim`. A layer name is the one thing
 *   Illustrator, Affinity and Inkscape all keep on SVG export, so the app reads
 *   the card area from it on import — no Card Area step, no guessing from the
 *   file's units.
 * - Every guide sits in a layer whose name starts with `guide`, and the punch
 *   in one named `punch_…`. They are shown while editing and never printed.
 * - Fixed text lives under `artwork`, so labels like "NAME" never turn into
 *   fields; the placeholders use the standard field names, so they map
 *   themselves.
 *
 * Units are millimetres with the origin on the card's top-left corner, so the
 * coordinates in the file read as measurements on the card.
 */

import { CARD_FORMATS } from './cardTrim'
import { getPunchRect, MAGNETIC_TRACKS_MM, type PunchPosition, type PunchShape } from './cardBlanks'

/** 1/16 in — what the reference artwork and most card printers expect. */
export const STARTER_BLEED_MM = 1.5875
export const STARTER_SAFE_MM = 3
/** ISO/IEC 7810 ID-1 corner radius. The die cuts it; it is a guide only. */
export const CARD_CORNER_RADIUS_MM = 3.18

export type StarterOrientation = 'landscape' | 'portrait'

export type StarterKitOptions = {
  orientation: StarterOrientation
  punch?: PunchPosition
  punchShape?: PunchShape
  /** Mark where a magnetic stripe sits on the back. */
  magneticStripe?: boolean
  /** Name of the organisation, as sample artwork. */
  organisation?: string
}

const ID1 = CARD_FORMATS.find((format) => format.id === 'id-1')!

function r(value: number): string {
  return String(Math.round(value * 1000) / 1000)
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Generic on purpose: the designer picks the real typeface, and a named font
// here would only be reported missing.
const FONT = 'sans-serif'

function guides(width: number, height: number, side: 'front' | 'back', options: StarterKitOptions): string[] {
  const b = STARTER_BLEED_MM
  const s = STARTER_SAFE_MM
  const label = (x: number, y: number, text: string, fill: string, anchor = 'start') =>
    `      <text x="${r(x)}" y="${r(y)}" font-family="${FONT}" font-size="1.4" fill="${fill}" stroke="none" text-anchor="${anchor}">${text}</text>`
  const lines = [
    '  <g id="guides" fill="none" stroke-width="0.15" pointer-events="none">',
    `    <rect id="guide_bleed" x="${r(-b)}" y="${r(-b)}" width="${r(width + 2 * b)}" height="${r(height + 2 * b)}" stroke="#ff9500" stroke-dasharray="1 0.6"/>`,
    `    <rect id="guide_trim" x="0" y="0" width="${r(width)}" height="${r(height)}" stroke="#ff00c8"/>`,
    `    <rect id="guide_corners" x="0" y="0" width="${r(width)}" height="${r(height)}" rx="${r(CARD_CORNER_RADIUS_MM)}" stroke="#ff00c8" stroke-dasharray="0.6 0.6"/>`,
    `    <rect id="guide_safe" x="${r(s)}" y="${r(s)}" width="${r(width - 2 * s)}" height="${r(height - 2 * s)}" stroke="#34c759" stroke-dasharray="1 0.6"/>`,
    '    <g id="guide_labels">',
    label(0.4, -0.35, `BLEED ${r(b)} mm — extend backgrounds to here`, '#ff9500'),
    label(width - 0.4, height + 1.25, `TRIM ${r(width)} × ${r(height)} mm`, '#ff00c8', 'end'),
    label(s + 0.4, s + 1.6, `SAFE AREA — keep text and logos inside`, '#34c759'),
    '    </g>',
  ]
  if (side === 'back' && options.magneticStripe) {
    const stripeTop = 4
    const stripeHeight = 12.7
    lines.push(
      `    <g id="guide_magnetic_stripe">`,
      `      <rect x="${r(-b)}" y="${r(stripeTop)}" width="${r(width + 2 * b)}" height="${r(stripeHeight)}" fill="#1a1a1a" fill-opacity="0.3" stroke="none"/>`,
      ...MAGNETIC_TRACKS_MM.map(
        (track) => `      <rect x="0" y="${r(track.top)}" width="${r(width)}" height="${r(track.bottom - track.top)}" stroke="#00d0ff" stroke-dasharray="1 1"/>`,
      ),
      label(width / 2, stripeTop + stripeHeight / 2 + 0.5, 'MAGNETIC STRIPE — not printed; keep artwork clear', '#ffffff', 'middle'),
      '    </g>',
    )
  }
  lines.push('  </g>')
  return lines
}

function punchLayer(width: number, height: number, options: StarterKitOptions): string[] {
  const punch = options.punch ?? 'none'
  const shape = options.punchShape ?? 'slot'
  const rect = getPunchRect({ punch, punchShape: shape, widthMm: width, heightMm: height })
  if (!rect || punch === 'none') return []
  const id = `punch_${shape}_${punch.replace(/-/g, '_')}`
  const radius = Math.min(rect.width, rect.height) / 2
  return [
    `  <g id="${id}" fill="none" stroke="#ff2d55" stroke-width="0.2" stroke-dasharray="0.8 0.6">`,
    `    <rect x="${r(rect.x)}" y="${r(rect.y)}" width="${r(rect.width)}" height="${r(rect.height)}" rx="${r(radius)}"/>`,
    '  </g>',
  ]
}

function text(id: string, x: number, y: number, size: number, sample: string, weight = 400, fill = '#111111'): string {
  return `  <text id="${id}" x="${r(x)}" y="${r(y)}" font-family="${FONT}" font-size="${r(size)}" font-weight="${weight}" fill="${fill}"><tspan x="${r(x)}" y="${r(y)}">${escapeXml(sample)}</tspan></text>`
}

function frontContent(width: number, height: number, portrait: boolean, organisation: string): string[] {
  const s = STARTER_SAFE_MM
  if (portrait) {
    const photoW = width - 2 * s - 12
    const photoH = photoW * 1.25
    const photoX = (width - photoW) / 2
    // Below where a top punch goes.
    const photoY = 16
    const textX = width / 2
    return [
      '  <g id="artwork">',
      `    <text x="${r(textX)}" y="${r(12)}" font-family="${FONT}" font-size="3.4" font-weight="700" fill="#111111" text-anchor="middle">${escapeXml(organisation)}</text>`,
      '  </g>',
      `  <g id="photo"><rect x="${r(photoX)}" y="${r(photoY)}" width="${r(photoW)}" height="${r(photoH)}" fill="#e9ecef"/></g>`,
      text('fullName_First_Last', textX, photoY + photoH + 7, 4.2, 'Sample Person', 700).replace('<text ', '<text text-anchor="middle" '),
      text('position', textX, photoY + photoH + 12, 3, 'Position').replace('<text ', '<text text-anchor="middle" '),
      text('studentId', textX, height - s - 2, 2.8, '000000000').replace('<text ', '<text text-anchor="middle" '),
    ]
  }
  const photoW = 22
  const photoH = 28
  const textX = s + photoW + 4
  return [
    '  <g id="artwork">',
    `    <text x="${r(s)}" y="${r(12)}" font-family="${FONT}" font-size="3.4" font-weight="700" fill="#111111">${escapeXml(organisation)}</text>`,
    '  </g>',
    `  <g id="photo"><rect x="${r(s)}" y="${r(height - s - photoH)}" width="${r(photoW)}" height="${r(photoH)}" fill="#e9ecef"/></g>`,
    text('fullName_First_Last', textX, height - s - 20, 4.2, 'Sample Person', 700),
    text('position', textX, height - s - 14.5, 3, 'Position'),
    text('studentId', textX, height - s - 9, 2.8, '000000000'),
  ]
}

function backContent(width: number, height: number, portrait: boolean, organisation: string, magneticStripe: boolean): string[] {
  const s = STARTER_SAFE_MM
  // Below the stripe, or below where a top punch goes.
  const top = magneticStripe ? 4 + 12.7 + 3 : 8
  const centre = width / 2
  const barcodeY = portrait ? height - s - 6 : height - s - 2
  return [
    '  <g id="artwork">',
    `    <text x="${r(centre)}" y="${r(top + 4)}" font-family="${FONT}" font-size="2.6" font-weight="700" fill="#111111" text-anchor="middle">${escapeXml(organisation)}</text>`,
    `    <text x="${r(centre)}" y="${r(top + 8)}" font-family="${FONT}" font-size="2" fill="#444444" text-anchor="middle">If found, please return to the address on the front.</text>`,
    `    <text x="${r(s)}" y="${r(barcodeY - 13)}" font-family="${FONT}" font-size="2.4" fill="#111111">ID number:</text>`,
    '  </g>',
    text('studentId', s + 15, barcodeY - 13, 2.4, '000000000'),
    // The barcode layer's font size is its height and its x/y place it; the
    // width keeps it inside the safe area (set Width in the app to change it).
    text('barcode_code128_studentId', s, barcodeY, portrait ? 7 : 9, '000000000').replace(
      '<text ',
      `<text data-barcode-width="${r(Math.min(width - 2 * s, 50))}" `,
    ),
  ]
}

/** One side of the kit as SVG markup. */
export function createStarterArtboard(side: 'front' | 'back', input: StarterKitOptions): string {
  const portrait = input.orientation === 'portrait'
  // A stripe runs along the card's long edge, which on a portrait card is a
  // side, not the top; the kit leaves that to the designer rather than guess.
  const options = portrait ? { ...input, magneticStripe: false } : input
  const width = portrait ? ID1.heightMm : ID1.widthMm
  const height = portrait ? ID1.widthMm : ID1.heightMm
  const b = STARTER_BLEED_MM
  const organisation = options.organisation?.trim() || 'ORGANISATION NAME'
  const title = `Card ${side} — ${options.orientation}`

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${r(width + 2 * b)}mm" height="${r(height + 2 * b)}mm" ` +
      `viewBox="${r(-b)} ${r(-b)} ${r(width + 2 * b)} ${r(height + 2 * b)}" data-card-format="id-1" ` +
      `data-trim-box="0 0 ${r(width)} ${r(height)}">`,
    `  <title>${title}</title>`,
    `  <desc>ID-1 card, ${r(width)} × ${r(height)} mm plus ${r(b)} mm bleed. Units are millimetres from the card's top-left corner. ` +
      'Layers named guide… and punch… are not printed. See README.txt in the starter kit for the layer names.</desc>',
    `  <rect id="artwork_background" x="${r(-b)}" y="${r(-b)}" width="${r(width + 2 * b)}" height="${r(height + 2 * b)}" fill="#ffffff"/>`,
    ...(side === 'front'
      ? frontContent(width, height, portrait, organisation)
      : backContent(width, height, portrait, organisation, Boolean(options.magneticStripe))),
    ...punchLayer(width, height, options),
    ...guides(width, height, side, options),
    '</svg>',
    '',
  ].join('\n')
}

/** The README that goes in the kit: what each layer name does. */
export function starterKitReadme(options: StarterKitOptions): string {
  const portrait = options.orientation === 'portrait'
  const width = portrait ? ID1.heightMm : ID1.widthMm
  const height = portrait ? ID1.widthMm : ID1.heightMm
  return `CARD DESIGN STARTER KIT
=======================

card-front.svg and card-back.svg are the two sides of an ID-1 (CR80) card,
${r(width)} × ${r(height)} mm (${options.orientation}), each drawn with ${r(STARTER_BLEED_MM)} mm
(1/16 in) of bleed. Open them in Illustrator, Affinity Designer, Inkscape or
Figma and design on top. Units are millimetres from the card's top-left corner.

THE GUIDES (never printed)
  guide_bleed    outer edge. Run backgrounds and bands all the way to here,
                 so a slightly misaligned cut never shows a white edge.
  guide_trim     where the card is cut. The app reads the card's size and
                 position from this rectangle, so keep it and keep its name.
  guide_corners  the 3.18 mm rounded corners the die cuts.
  guide_safe     keep text, logos and the photo inside this (3 mm in).
  punch_…        where the lanyard slot or hole is punched. Keep artwork that
                 matters away from it. Rename to e.g. punch_round_top_center,
                 or delete it for a card with no punch.
${options.magneticStripe && !portrait ? `  guide_magnetic_stripe   where the stripe on the card stock sits. Ink on
                 the stripe can stop it reading — leave this band empty.
` : ''}
THE PERSONALISED LAYERS (filled in for each person)
  photo                      a rectangle (or group with a rectangle) where the
                             photo goes. Rounded corners or a circle are kept.
  fullName_First_Last        the name. Other formats: fullName_Last_Comma_First,
                             fullName_First_LineBreak_Last (two lines),
                             fullName_First_LastInitial ("Ahmad J"), add
                             _AllCaps for capitals.
  position, department, studentId, email, grade, issueDate, expiryDate
  barcode_code128_studentId  a generated barcode of studentId. Its x/y place
                             it; its font size is its height. Other types:
                             barcode_codabar_…, barcode_code39_…,
                             barcode_qrcode_…. Do not use a barcode font.
  customAnything             fixed text you want to change in the app
                             without editing the artwork (e.g. customValidYears).

FIXED ARTWORK
  Put labels and other text that is part of the design ("NAME", the address)
  in a layer named artwork (or static…). Text there is never offered as a
  field.

EXPORTING FROM ILLUSTRATOR
  File > Export > Export As… > SVG, then:
    Styling: Internal CSS      Font: SVG (keep text as text)
    Images: Embed              Object IDs: Layer Names
    Decimal: 3                 Minify: off      Responsive: off
  Layer names become the ids the app reads — spaces and punctuation get
  mangled, so stick to the names above.

VARIANTS
  Several looks of the same card (a different watermark, with and without a
  punch, Student and Staff) are separate SVGs with the same layer names. Open
  one in the app, then add the others under Variants: they share the fields,
  the mappings and the back, and one package (.zip) carries them all.
`
}

/** The whole kit as a zip: both sides and the README. */
export async function createStarterKitZip(options: StarterKitOptions): Promise<Blob> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  zip.file('card-front.svg', createStarterArtboard('front', options))
  zip.file('card-back.svg', createStarterArtboard('back', options))
  zip.file('README.txt', starterKitReadme(options))
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
}

export function starterKitFileName(options: StarterKitOptions): string {
  return `card-starter-kit-${options.orientation}.zip`
}
