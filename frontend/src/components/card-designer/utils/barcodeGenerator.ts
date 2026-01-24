import bwipjs from 'bwip-js'

export type BarcodeType = 'code128' | 'qrcode' | 'ean13' | 'code39'

export interface BarcodeOptions {
  type: BarcodeType
  text: string
  width?: number   // Width in pixels
  height?: number  // Height in pixels
  scale?: number   // Scale factor
  includeText?: boolean
}

// Map our type names to bwip-js type names
const BARCODE_TYPE_MAP: Record<BarcodeType, string> = {
  code128: 'code128',
  qrcode: 'qrcode',
  ean13: 'ean13',
  code39: 'code39',
}

/**
 * Generate a barcode as a data URL image
 */
export async function generateBarcodeDataUrl(options: BarcodeOptions): Promise<string> {
  const { type, text, width = 100, height = 40, scale = 2, includeText = true } = options

  // Create a canvas element
  const canvas = document.createElement('canvas')

  try {
    // Generate barcode
    await bwipjs.toCanvas(canvas, {
      bcid: BARCODE_TYPE_MAP[type],
      text: text || 'SAMPLE',
      scale: scale,
      height: type === 'qrcode' ? undefined : height / scale / 2, // bwip uses different height calc
      width: type === 'qrcode' ? width / scale : undefined,
      includetext: includeText && type !== 'qrcode',
      textxalign: 'center',
    })

    // Convert to data URL
    return canvas.toDataURL('image/png')
  } catch (error) {
    console.error('Failed to generate barcode:', error)
    // Return a placeholder image
    return createPlaceholderBarcode(type, width, height)
  }
}

/**
 * Create a placeholder barcode image for preview
 */
function createPlaceholderBarcode(type: BarcodeType, width: number, height: number): string {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  if (!ctx) return ''

  // White background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  // Gray border
  ctx.strokeStyle = '#cccccc'
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, width - 2, height - 2)

  // Placeholder text
  ctx.fillStyle = '#999999'
  ctx.font = '12px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(type.toUpperCase(), width / 2, height / 2)

  return canvas.toDataURL('image/png')
}

/**
 * Generate a barcode preview for use in the designer
 * Uses a sample text to show what the barcode will look like
 */
export async function generateBarcodePreview(
  type: BarcodeType,
  width: number,
  height: number
): Promise<string> {
  const sampleText = {
    code128: '12345678',
    qrcode: 'SAMPLE',
    ean13: '5901234123457',
    code39: 'SAMPLE',
  }

  return generateBarcodeDataUrl({
    type,
    text: sampleText[type],
    width,
    height,
  })
}

/**
 * Validate barcode text for a given type
 */
export function validateBarcodeText(type: BarcodeType, text: string): { valid: boolean; error?: string } {
  if (!text || text.trim() === '') {
    return { valid: false, error: 'Text is required' }
  }

  switch (type) {
    case 'ean13':
      if (!/^\d{12,13}$/.test(text)) {
        return { valid: false, error: 'EAN-13 requires 12 or 13 digits' }
      }
      break
    case 'code128':
    case 'code39':
    case 'qrcode':
      // These support most characters
      break
  }

  return { valid: true }
}
