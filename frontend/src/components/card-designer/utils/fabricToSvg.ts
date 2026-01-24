import type { Canvas, FabricObject, Textbox, Rect } from 'fabric'
import type { DesignerObjectData } from '../types'

// Pixels per mm at 96 DPI
const PX_PER_MM = 96 / 25.4

/**
 * Convert Fabric.js canvas to SVG with field placeholders
 * The output SVG is compatible with the existing renderSvgWithData() function
 */
export function fabricCanvasToSvg(
  canvas: Canvas,
  cardWidthMm: number,
  cardHeightMm: number
): string {
  // Get base SVG from Fabric.js
  const canvasWidthPx = cardWidthMm * PX_PER_MM
  const canvasHeightPx = cardHeightMm * PX_PER_MM

  let svg = canvas.toSVG({
    width: `${cardWidthMm}mm`,
    height: `${cardHeightMm}mm`,
    viewBox: {
      x: 0,
      y: 0,
      width: canvasWidthPx,
      height: canvasHeightPx,
    },
  })

  // Process dynamic elements to add field placeholders
  const objects = canvas.getObjects()

  for (const obj of objects) {
    const data = obj.get('data') as DesignerObjectData | undefined
    if (!data) continue

    const objId = obj.get('id') as string

    if (data.elementType === 'dynamic-text' && data.fieldId) {
      // Replace text content with placeholder pattern
      svg = replaceDynamicTextInSvg(svg, objId, data.fieldId)
    }

    if (data.elementType === 'image-placeholder' && data.fieldId) {
      // Add image placeholder group with the field pattern
      svg = addImagePlaceholderToSvg(svg, objId, data.fieldId)
    }

    if (data.elementType === 'barcode' && data.fieldId && data.barcodeConfig) {
      // Add barcode placeholder
      svg = addBarcodePlaceholderToSvg(svg, objId, data.fieldId, data.barcodeConfig.barcodeType)
    }
  }

  return svg
}

/**
 * Replace dynamic text element content with field placeholder pattern
 */
function replaceDynamicTextInSvg(svg: string, objId: string, fieldId: string): string {
  // Fabric.js generates text elements with data-id attribute
  // We need to find the text content and wrap it with the placeholder pattern

  // The placeholder pattern used by the existing system
  const placeholder = `{{field:${fieldId}}}`

  // Try to find and update the text element
  // Fabric generates tspan elements for text
  const idPattern = new RegExp(`id="${objId}"`, 'g')
  if (idPattern.test(svg)) {
    // Add a data attribute to mark this as a dynamic field
    svg = svg.replace(
      new RegExp(`(id="${objId}")`, 'g'),
      `$1 data-field-id="${fieldId}" data-field-type="text"`
    )
  }

  return svg
}

/**
 * Add image placeholder group to SVG
 */
function addImagePlaceholderToSvg(svg: string, objId: string, fieldId: string): string {
  // Mark the rect element as an image placeholder
  const idPattern = new RegExp(`id="${objId}"`, 'g')
  if (idPattern.test(svg)) {
    svg = svg.replace(
      new RegExp(`(id="${objId}")`, 'g'),
      `$1 data-field-id="${fieldId}" data-field-type="image"`
    )
  }

  return svg
}

/**
 * Add barcode placeholder to SVG
 */
function addBarcodePlaceholderToSvg(
  svg: string,
  objId: string,
  fieldId: string,
  barcodeType: string
): string {
  const idPattern = new RegExp(`id="${objId}"`, 'g')
  if (idPattern.test(svg)) {
    svg = svg.replace(
      new RegExp(`(id="${objId}")`, 'g'),
      `$1 data-field-id="${fieldId}" data-field-type="barcode" data-barcode-type="${barcodeType}"`
    )
  }

  return svg
}

/**
 * Extract field definitions from a canvas-generated SVG
 * This is used when loading a canvas design for export
 */
export function extractFieldsFromCanvasSvg(svg: string): Array<{
  fieldId: string
  fieldType: 'text' | 'image' | 'barcode'
  barcodeType?: string
}> {
  const fields: Array<{
    fieldId: string
    fieldType: 'text' | 'image' | 'barcode'
    barcodeType?: string
  }> = []

  // Parse data-field attributes
  const fieldPattern = /data-field-id="([^"]+)"\s+data-field-type="([^"]+)"(?:\s+data-barcode-type="([^"]+)")?/g
  let match

  while ((match = fieldPattern.exec(svg)) !== null) {
    fields.push({
      fieldId: match[1],
      fieldType: match[2] as 'text' | 'image' | 'barcode',
      barcodeType: match[3],
    })
  }

  return fields
}

/**
 * Generate SVG template from canvas data (JSON string)
 * This creates an SVG that can be used with the existing export system
 */
export async function generateSvgFromCanvasData(
  canvasJson: string,
  cardWidthMm: number,
  cardHeightMm: number
): Promise<string> {
  // Dynamically import fabric to avoid loading it when not needed
  const { Canvas } = await import('fabric')

  // Create a temporary canvas
  const canvasWidthPx = cardWidthMm * PX_PER_MM
  const canvasHeightPx = cardHeightMm * PX_PER_MM

  // Create an offscreen canvas element
  const canvasElement = document.createElement('canvas')
  canvasElement.width = canvasWidthPx
  canvasElement.height = canvasHeightPx

  const fabricCanvas = new Canvas(canvasElement, {
    width: canvasWidthPx,
    height: canvasHeightPx,
  })

  // Load the canvas data
  const parsed = JSON.parse(canvasJson)
  await fabricCanvas.loadFromJSON(parsed)

  // Generate SVG
  const svg = fabricCanvasToSvg(fabricCanvas, cardWidthMm, cardHeightMm)

  // Clean up
  fabricCanvas.dispose()

  return svg
}
