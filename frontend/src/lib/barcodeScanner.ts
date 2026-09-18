/**
 * Reading a barcode out of an image.
 *
 * Useful for going the other way round from generation: point it at a photo or
 * scan of an existing card and get back the symbology and the value, so a
 * template can be set up to reproduce it.
 */

import type { BarcodeSymbology } from './barcode'

export type ScannedBarcode = {
  /** The decoded value, exactly as encoded. */
  text: string
  /** ZXing's name for the symbology it found. */
  formatName: string
  /** The matching generator symbology, when we can generate this format. */
  symbology: BarcodeSymbology | null
  /**
   * For Codabar, the start and stop characters carried by the value. These are
   * part of the encoding and are usually not printed under the bars.
   */
  codabarStartStop?: { start: string; stop: string }
}

/** ZXing format names mapped onto the symbologies we can generate. */
const FORMAT_TO_SYMBOLOGY: Record<string, BarcodeSymbology> = {
  CODABAR: 'codabar',
  CODE_128: 'code128',
  CODE_39: 'code39',
  EAN_13: 'ean13',
  QR_CODE: 'qrcode',
}

/**
 * ZXing pulls in a large decoder table, so it is loaded only when an image is
 * actually scanned.
 */
async function loadReader() {
  const { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } = await import('@zxing/library')

  const hints = new Map()
  // Restricting the formats makes 1D decoding markedly more reliable on photos.
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.CODABAR,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.CODE_93,
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.ITF,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.QR_CODE,
    BarcodeFormat.DATA_MATRIX,
    BarcodeFormat.PDF_417,
    BarcodeFormat.AZTEC,
  ])
  // Spend more effort per image: this is a one-off upload, not a video stream.
  hints.set(DecodeHintType.TRY_HARDER, true)

  return { reader: new BrowserMultiFormatReader(hints), BarcodeFormat }
}

function describeCodabar(text: string): ScannedBarcode['codabarStartStop'] {
  const start = text.charAt(0)
  const stop = text.charAt(text.length - 1)
  if (/[A-Da-d]/.test(start) && /[A-Da-d]/.test(stop) && text.length > 1) {
    return { start, stop }
  }
  return undefined
}

/**
 * Decode the first barcode found in an image.
 *
 * Throws when nothing decodes — a blurred photo, too small a crop, or a
 * symbology outside the list above.
 */
export async function scanBarcodeFromImage(source: Blob | string): Promise<ScannedBarcode> {
  const { reader } = await loadReader()
  const url = typeof source === 'string' ? source : URL.createObjectURL(source)

  try {
    const result = await reader.decodeFromImageUrl(url)
    const formatName = String(result.getBarcodeFormat?.() ?? '')
    // ZXing returns the enum value; map it back to its name.
    const { BarcodeFormat } = await import('@zxing/library')
    const name =
      Object.keys(BarcodeFormat).find(
        (key) => Number.isNaN(Number(key)) && BarcodeFormat[key as keyof typeof BarcodeFormat] === result.getBarcodeFormat(),
      ) ?? formatName

    const text = result.getText()
    return {
      text,
      formatName: name,
      symbology: FORMAT_TO_SYMBOLOGY[name] ?? null,
      codabarStartStop: name === 'CODABAR' ? describeCodabar(text) : undefined,
    }
  } catch (error) {
    if (error instanceof Error && /NotFound/i.test(error.name)) {
      throw new Error(
        'No barcode found in that image. Crop closer to the barcode, and make sure the bars are sharp and the whole symbol including its quiet zones is visible.',
      )
    }
    throw error
  } finally {
    if (typeof source !== 'string') URL.revokeObjectURL(url)
  }
}

/** A readable description of what was found. */
export function describeScan(scan: ScannedBarcode): string {
  const format = scan.formatName.replace(/_/g, ' ')
  if (scan.codabarStartStop) {
    const { start, stop } = scan.codabarStartStop
    return `${format} — start "${start}", stop "${stop}"`
  }
  return format
}
