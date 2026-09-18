/**
 * Barcode generation.
 *
 * Barcodes are generated as vector geometry with bwip-js rather than drawn with
 * a barcode font. A font looks the same on screen but carries several failure
 * modes that only show up after a print run:
 *
 * - If the font is missing, the browser silently falls back and prints the
 *   literal characters. A generated barcode either renders or errors.
 * - The font cannot enforce a symbology's rules. Codabar, for example, requires
 *   a start and stop character; typing bare digits produces bars that no
 *   scanner will decode.
 * - There is no quiet zone (most barcode fonts give the space glyph zero
 *   advance) and no control over the narrow-bar width, which is what a scanner
 *   actually cares about.
 * - Every export has to embed or outline the font.
 */

import bwipjs from 'bwip-js'

export type BarcodeSymbology = 'codabar' | 'code128' | 'code39' | 'ean13' | 'qrcode'

export const BARCODE_SYMBOLOGIES: BarcodeSymbology[] = [
  'codabar',
  'code128',
  'code39',
  'ean13',
  'qrcode',
]

/** Our names mapped onto bwip-js encoder ids. */
const SYMBOLOGY_ENCODERS: Record<BarcodeSymbology, string> = {
  // "Rationalized" Codabar is the ANSI/AIM variant libraries and ID systems use.
  codabar: 'rationalizedCodabar',
  code128: 'code128',
  code39: 'code39',
  ean13: 'ean13',
  qrcode: 'qrcode',
}

export const BARCODE_SYMBOLOGY_LABELS: Record<BarcodeSymbology, string> = {
  codabar: 'Codabar',
  code128: 'Code 128',
  code39: 'Code 39',
  ean13: 'EAN-13',
  qrcode: 'QR Code',
}

/** Codabar's four interchangeable start/stop characters. */
const CODABAR_START_STOP = /^[A-Da-d]$/
const CODABAR_BODY = /^[0-9\-$:/.+]*$/
const DEFAULT_CODABAR_START = 'A'
const DEFAULT_CODABAR_STOP = 'B'

/**
 * Font families that draw barcodes as text. Templates using one are flagged on
 * import so they can be moved onto a generated barcode layer.
 */
const BARCODE_FONT_PATTERN = /(codabar|code\s?39|code\s?128|barcode|ean13|i25|interleaved)/i

export function isBarcodeFontFamily(fontFamily: string | undefined | null): boolean {
  return Boolean(fontFamily && BARCODE_FONT_PATTERN.test(fontFamily))
}

export function isBarcodeSymbology(value: string): value is BarcodeSymbology {
  return (BARCODE_SYMBOLOGIES as string[]).includes(value)
}

/**
 * Resolve a symbology name written in a layer id, case-insensitively.
 */
export function normalizeSymbology(value: string): BarcodeSymbology | null {
  const normalized = value.toLowerCase().replace(/[\s_-]+/g, '')
  for (const symbology of BARCODE_SYMBOLOGIES) {
    if (symbology === normalized) return symbology
  }
  // A few spellings designers reach for.
  if (normalized === 'qr') return 'qrcode'
  if (normalized === 'code128b' || normalized === 'c128') return 'code128'
  if (normalized === 'code3of9' || normalized === 'c39') return 'code39'
  if (normalized === 'ean' || normalized === 'ean13') return 'ean13'
  return null
}

/**
 * Bring a value into a form the symbology accepts.
 *
 * For Codabar this supplies the start and stop characters when they are absent,
 * which is the usual reason a font-drawn Codabar fails to scan.
 */
export function normalizeBarcodeText(symbology: BarcodeSymbology, text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return trimmed

  if (symbology !== 'codabar') return trimmed

  const first = trimmed.charAt(0)
  const last = trimmed.charAt(trimmed.length - 1)
  const hasStart = CODABAR_START_STOP.test(first)
  const hasStop = trimmed.length > 1 && CODABAR_START_STOP.test(last)
  if (hasStart && hasStop) return trimmed

  const body = trimmed.slice(hasStart ? 1 : 0, hasStop ? -1 : undefined)
  const start = hasStart ? first : DEFAULT_CODABAR_START
  const stop = hasStop ? last : DEFAULT_CODABAR_STOP
  return `${start}${body}${stop}`
}

export type BarcodeValidation = { valid: boolean; error?: string; normalized: string }

export function validateBarcodeText(symbology: BarcodeSymbology, text: string): BarcodeValidation {
  const normalized = normalizeBarcodeText(symbology, text)

  if (!normalized) {
    return { valid: false, error: 'Barcode value is empty.', normalized }
  }

  switch (symbology) {
    case 'codabar': {
      const body = normalized.slice(1, -1)
      if (!CODABAR_BODY.test(body)) {
        return {
          valid: false,
          error: 'Codabar accepts digits and - $ : / . + only.',
          normalized,
        }
      }
      break
    }
    case 'ean13':
      if (!/^\d{12,13}$/.test(normalized)) {
        return { valid: false, error: 'EAN-13 requires 12 or 13 digits.', normalized }
      }
      break
    case 'code39':
      if (!/^[0-9A-Z\-. $/+%]*$/.test(normalized)) {
        return {
          valid: false,
          error: 'Code 39 accepts digits, capitals and - . $ / + % and space.',
          normalized,
        }
      }
      break
    case 'code128':
    case 'qrcode':
      break
  }

  return { valid: true, normalized }
}

export type BarcodeRenderOptions = {
  symbology: BarcodeSymbology
  text: string
  /** Bar height in bwip-js units; the caller scales the result to fit its box. */
  height?: number
  /** Narrow-element width multiplier. Higher is more robust but wider. */
  scale?: number
  /** Bar colour as a CSS hex colour. */
  color?: string
  /** Print the value underneath the bars. */
  includeText?: boolean
}

export type GeneratedBarcode = {
  /** Standalone SVG markup. */
  svg: string
  /** Natural size of that markup, from its viewBox. */
  width: number
  height: number
}

function toBwipColor(color: string | undefined): string | undefined {
  if (!color) return undefined
  const hex = color.trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return hex
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return hex
      .split('')
      .map((char) => char + char)
      .join('')
  }
  return undefined
}

/**
 * Generate a barcode as standalone SVG markup.
 *
 * Throws when the value cannot be encoded — a barcode that cannot be scanned is
 * worse than a visible failure.
 */
export function generateBarcodeSvg(options: BarcodeRenderOptions): GeneratedBarcode {
  const { symbology, text, height = 10, scale = 3, color, includeText = false } = options

  const validation = validateBarcodeText(symbology, text)
  if (!validation.valid) {
    throw new Error(validation.error ?? 'Barcode value is not valid.')
  }

  const barColor = toBwipColor(color)
  const svg = bwipjs.toSVG({
    bcid: SYMBOLOGY_ENCODERS[symbology],
    text: validation.normalized,
    scale,
    // QR codes are sized by their module count, not a bar height.
    ...(symbology === 'qrcode' ? {} : { height }),
    includetext: includeText && symbology !== 'qrcode',
    textxalign: 'center',
    // bwip-js rejects the key outright when the value is undefined.
    ...(barColor ? { barcolor: barColor } : {}),
  })

  const viewBox = /viewBox="([^"]+)"/.exec(svg)
  const [, , width, viewHeight] = viewBox
    ? viewBox[1].split(/[\s,]+/).map(Number)
    : [0, 0, 0, 0]

  return {
    svg,
    width: Number.isFinite(width) && width > 0 ? width : 1,
    height: Number.isFinite(viewHeight) && viewHeight > 0 ? viewHeight : 1,
  }
}
