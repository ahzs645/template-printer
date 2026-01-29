import { PDFDocument } from 'pdf-lib'
import type { CardData, FieldDefinition, ImageValue, PrintLayout, TemplateMeta } from './types'
import type { UserData } from './fieldParser'
import { parseField } from './fieldParser'

// Slot assignment for multi-card layouts
export type SlotAssignment = {
  source: 'custom' | string  // 'custom' for manual fields, or user ID
  side: 'front' | 'back'     // Which side of the card design to use
  templateId?: string | null // Optional: override with a different design template
}
import {
  buildCanvasFontString,
  clamp,
  loadImageElement,
  loadSvgAsImage,
  renderSvgWithData,
} from './svgTemplate'

const PX_PER_MM = 3.779527559055
const MM_PER_INCH = 25.4
const POINTS_PER_INCH = 72
const DEFAULT_EXPORT_DPI = 300
const PREVIEW_BASE_WIDTH = 420

function asImageValue(value: CardData[string]): ImageValue | undefined {
  if (!value || typeof value !== 'object') return undefined
  if (!('src' in value)) return undefined
  return value as ImageValue
}

export async function exportSingleCard(
  template: TemplateMeta,
  fields: FieldDefinition[],
  cardData: CardData,
  dpi: number = DEFAULT_EXPORT_DPI,
): Promise<void> {
  const canvas = await renderCardToCanvas(template, fields, cardData, dpi)
  const { widthPoints, heightPoints } = getTemplateSizeInPoints(template)

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([widthPoints, heightPoints])

  const cardPngBytes = await dataUrlToUint8Array(canvas.toDataURL('image/png'))
  const cardImage = await pdfDoc.embedPng(cardPngBytes)

  page.drawImage(cardImage, {
    x: 0,
    y: 0,
    width: widthPoints,
    height: heightPoints,
  })

  const pdfBytes = await pdfDoc.save()
  const blob = new Blob([pdfBytes], { type: 'application/pdf' })
  const downloadUrl = URL.createObjectURL(blob)
  const downloadLink = document.createElement('a')
  const baseName = template.name.replace(/\.svg$/i, '') || 'id-card'

  downloadLink.href = downloadUrl
  downloadLink.download = `${baseName}.pdf`
  document.body.appendChild(downloadLink)
  downloadLink.click()
  downloadLink.remove()
  URL.revokeObjectURL(downloadUrl)
}

export async function exportWithPrintLayout(
  template: TemplateMeta,
  fields: FieldDefinition[],
  cardData: CardData,
  printLayoutSvgPath: string,
  dpi: number = DEFAULT_EXPORT_DPI,
): Promise<void> {
  const canvas = await renderCardToCanvas(template, fields, cardData, dpi)
  const layout = await loadPrintLayout(printLayoutSvgPath)

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([layout.widthPoints, layout.heightPoints])

  const layoutPngBytes = await svgMarkupToPngBytes(layout.backgroundSvg)
  const layoutImage = await pdfDoc.embedPng(layoutPngBytes)
  page.drawImage(layoutImage, {
    x: 0,
    y: 0,
    width: layout.widthPoints,
    height: layout.heightPoints,
  })

  const cardPngBytes = await dataUrlToUint8Array(canvas.toDataURL('image/png'))
  const cardImage = await pdfDoc.embedPng(cardPngBytes)

  const { widthPoints: cardWidthPoints, heightPoints: cardHeightPoints } = getTemplateSizeInPoints(template)

  layout.placeholders.forEach((slot) => {
    const scale = Math.min(slot.width / cardWidthPoints, slot.height / cardHeightPoints)
    const drawWidth = cardWidthPoints * scale
    const drawHeight = cardHeightPoints * scale
    const offsetX = slot.x + (slot.width - drawWidth) / 2
    const offsetY = layout.heightPoints - slot.y - slot.height + (slot.height - drawHeight) / 2

    page.drawImage(cardImage, {
      x: offsetX,
      y: offsetY,
      width: drawWidth,
      height: drawHeight,
    })
  })

  const pdfBytes = await pdfDoc.save()
  const blob = new Blob([pdfBytes], { type: 'application/pdf' })
  const downloadUrl = URL.createObjectURL(blob)
  const downloadLink = document.createElement('a')
  const baseName = template.name.replace(/\.svg$/i, '') || 'id-card'

  downloadLink.href = downloadUrl
  downloadLink.download = `${baseName}-print-layout.pdf`
  document.body.appendChild(downloadLink)
  downloadLink.click()
  downloadLink.remove()
  URL.revokeObjectURL(downloadUrl)
}

/**
 * Export multiple cards for multiple users to a single PDF
 */
export async function exportBatchCards(
  template: TemplateMeta,
  fields: FieldDefinition[],
  users: UserData[],
  fieldMappings: Record<string, string>, // Map of field IDs to standard field names
  dpi: number = DEFAULT_EXPORT_DPI,
  customValues?: Record<string, string>, // Map of field IDs to custom static values
): Promise<void> {
  const { widthPoints, heightPoints } = getTemplateSizeInPoints(template)
  const pdfDoc = await PDFDocument.create()

  for (const user of users) {
    // Convert user data to card data using field mappings
    // fieldMappings: { svgLayerId: standardFieldName }
    // We need to find the field with matching sourceId and use that field's ID
    const cardData: CardData = {}

    fields.forEach(field => {
      // Check if this field has a mapping (check sourceId first, then id as fallback)
      const layerId = field.sourceId || field.id
      const standardFieldName = fieldMappings[layerId]
      if (standardFieldName) {
        const customValue = customValues?.[layerId]
        cardData[field.id] = parseField(standardFieldName, user, customValue)
      }
    })

    // Render this user's card
    const canvas = await renderCardToCanvas(template, fields, cardData, dpi)
    const page = pdfDoc.addPage([widthPoints, heightPoints])

    const cardPngBytes = await dataUrlToUint8Array(canvas.toDataURL('image/png'))
    const cardImage = await pdfDoc.embedPng(cardPngBytes)

    page.drawImage(cardImage, {
      x: 0,
      y: 0,
      width: widthPoints,
      height: heightPoints,
    })
  }

  const pdfBytes = await pdfDoc.save()
  const blob = new Blob([pdfBytes], { type: 'application/pdf' })
  const downloadUrl = URL.createObjectURL(blob)
  const downloadLink = document.createElement('a')
  const baseName = template.name.replace(/\.svg$/i, '') || 'id-cards'

  downloadLink.href = downloadUrl
  downloadLink.download = `${baseName}-batch-${users.length}-cards.pdf`
  document.body.appendChild(downloadLink)
  downloadLink.click()
  downloadLink.remove()
  URL.revokeObjectURL(downloadUrl)
}

/**
 * Export multiple cards for multiple users with print layout to a single PDF
 * Each page in the PDF will have the print layout with cards in the placeholder slots
 */
export async function exportBatchCardsWithPrintLayout(
  template: TemplateMeta,
  fields: FieldDefinition[],
  users: UserData[],
  fieldMappings: Record<string, string>,
  printLayoutSvgPath: string,
  dpi: number = DEFAULT_EXPORT_DPI,
  customValues?: Record<string, string>,
): Promise<void> {
  const layout = await loadPrintLayout(printLayoutSvgPath)
  const pdfDoc = await PDFDocument.create()
  const { widthPoints: cardWidthPoints, heightPoints: cardHeightPoints } = getTemplateSizeInPoints(template)

  // Pre-render each user's card as a PDF image
  const cardImages = []
  for (const user of users) {
    const cardData: CardData = {}
    fields.forEach(field => {
      const layerId = field.sourceId || field.id
      const standardFieldName = fieldMappings[layerId]
      if (standardFieldName) {
        const customValue = customValues?.[layerId]
        cardData[field.id] = parseField(standardFieldName, user, customValue)
      }
    })

    const canvas = await renderCardToCanvas(template, fields, cardData, dpi)
    const cardPngBytes = await dataUrlToUint8Array(canvas.toDataURL('image/png'))
    const cardImage = await pdfDoc.embedPng(cardPngBytes)
    cardImages.push(cardImage)
  }

  const layoutPngBytes = await svgMarkupToPngBytes(layout.backgroundSvg)
  const layoutImage = await pdfDoc.embedPng(layoutPngBytes)

  const slotsPerPage = layout.placeholders.length || 1
  let cardIndex = 0

  while (cardIndex < cardImages.length) {
    const page = pdfDoc.addPage([layout.widthPoints, layout.heightPoints])

    page.drawImage(layoutImage, {
      x: 0,
      y: 0,
      width: layout.widthPoints,
      height: layout.heightPoints,
    })

    for (const slot of layout.placeholders) {
      if (cardIndex >= cardImages.length) break
      const cardImage = cardImages[cardIndex++]

      const scale = Math.min(slot.width / cardWidthPoints, slot.height / cardHeightPoints)
      const drawWidth = cardWidthPoints * scale
      const drawHeight = cardHeightPoints * scale
      const offsetX = slot.x + (slot.width - drawWidth) / 2
      const offsetY = layout.heightPoints - slot.y - slot.height + (slot.height - drawHeight) / 2

      page.drawImage(cardImage, {
        x: offsetX,
        y: offsetY,
        width: drawWidth,
        height: drawHeight,
      })
    }
  }

  const pdfBytes = await pdfDoc.save()
  const blob = new Blob([pdfBytes], { type: 'application/pdf' })
  const downloadUrl = URL.createObjectURL(blob)
  const downloadLink = document.createElement('a')
  const baseName = template.name.replace(/\.svg$/i, '') || 'id-cards'

  downloadLink.href = downloadUrl
  downloadLink.download = `${baseName}-batch-${users.length}-cards-print-layout.pdf`
  document.body.appendChild(downloadLink)
  downloadLink.click()
  downloadLink.remove()
  URL.revokeObjectURL(downloadUrl)
}

// ============================================
// JSON PRINT LAYOUT EXPORT FUNCTIONS
// ============================================

type CardPosition = {
  page: number
  x: number
  y: number
  width: number
  height: number
  cardIndex: number
}

/**
 * Calculate card positions from a JSON print layout configuration
 */
export function calculateCardPositions(layout: PrintLayout, cardCount: number): CardPosition[] {
  const positions: CardPosition[] = []

  const pageMarginTop = parseFloat(layout.pageMarginTop) * POINTS_PER_INCH
  const pageMarginLeft = parseFloat(layout.pageMarginLeft) * POINTS_PER_INCH
  const cardSpacingX = parseFloat(layout.cardMarginRight) * POINTS_PER_INCH
  const cardSpacingY = parseFloat(layout.cardMarginBottom) * POINTS_PER_INCH
  const cardWidth = parseFloat(layout.cardWidth) * POINTS_PER_INCH
  const cardHeight = parseFloat(layout.cardHeight) * POINTS_PER_INCH

  for (let i = 0; i < cardCount; i++) {
    const slotIndex = i % layout.cardsPerPage
    const col = slotIndex % layout.cardsPerRow
    const row = Math.floor(slotIndex / layout.cardsPerRow)
    const page = Math.floor(i / layout.cardsPerPage)

    positions.push({
      page,
      x: pageMarginLeft + col * (cardWidth + cardSpacingX),
      y: pageMarginTop + row * (cardHeight + cardSpacingY),
      width: cardWidth,
      height: cardHeight,
      cardIndex: i,
    })
  }

  return positions
}

/**
 * Export a single card using a JSON print layout
 */
export async function exportWithJsonLayout(
  template: TemplateMeta,
  fields: FieldDefinition[],
  cardData: CardData,
  layout: PrintLayout,
  dpi: number = DEFAULT_EXPORT_DPI,
): Promise<void> {
  const canvas = await renderCardToCanvas(template, fields, cardData, dpi)

  const pageWidth = parseFloat(layout.pageWidth) * POINTS_PER_INCH
  const pageHeight = parseFloat(layout.pageHeight) * POINTS_PER_INCH

  const pdfDoc = await PDFDocument.create()

  // Calculate positions for all slots on the page (fill with same card)
  const positions = calculateCardPositions(layout, layout.cardsPerPage)

  const cardPngBytes = await dataUrlToUint8Array(canvas.toDataURL('image/png'))
  const cardImage = await pdfDoc.embedPng(cardPngBytes)

  const page = pdfDoc.addPage([pageWidth, pageHeight])

  // Place the same card in each slot
  for (const pos of positions) {
    // PDF coordinates are from bottom-left, so flip Y
    const pdfY = pageHeight - pos.y - pos.height

    page.drawImage(cardImage, {
      x: pos.x,
      y: pdfY,
      width: pos.width,
      height: pos.height,
    })
  }

  const pdfBytes = await pdfDoc.save()
  const blob = new Blob([pdfBytes], { type: 'application/pdf' })
  const downloadUrl = URL.createObjectURL(blob)
  const downloadLink = document.createElement('a')
  const baseName = template.name.replace(/\.svg$/i, '') || 'id-card'

  downloadLink.href = downloadUrl
  downloadLink.download = `${baseName}-${layout.name.replace(/[^a-z0-9]/gi, '-')}.pdf`
  document.body.appendChild(downloadLink)
  downloadLink.click()
  downloadLink.remove()
  URL.revokeObjectURL(downloadUrl)
}

/**
 * Export multiple cards for multiple users with JSON print layout
 */
export async function exportBatchCardsWithJsonLayout(
  template: TemplateMeta,
  fields: FieldDefinition[],
  users: UserData[],
  fieldMappings: Record<string, string>,
  layout: PrintLayout,
  dpi: number = DEFAULT_EXPORT_DPI,
  customValues?: Record<string, string>,
): Promise<void> {
  const pdfDoc = await PDFDocument.create()

  const pageWidth = parseFloat(layout.pageWidth) * POINTS_PER_INCH
  const pageHeight = parseFloat(layout.pageHeight) * POINTS_PER_INCH

  // Pre-render each user's card
  const cardImages = []
  for (const user of users) {
    const cardData: CardData = {}
    fields.forEach(field => {
      const layerId = field.sourceId || field.id
      const standardFieldName = fieldMappings[layerId]
      if (standardFieldName) {
        const customValue = customValues?.[layerId]
        cardData[field.id] = parseField(standardFieldName, user, customValue)
      }
    })

    const canvas = await renderCardToCanvas(template, fields, cardData, dpi)
    const cardPngBytes = await dataUrlToUint8Array(canvas.toDataURL('image/png'))
    const cardImage = await pdfDoc.embedPng(cardPngBytes)
    cardImages.push(cardImage)
  }

  // Calculate all positions
  const positions = calculateCardPositions(layout, users.length)

  // Group positions by page
  const pageGroups = new Map<number, CardPosition[]>()
  for (const pos of positions) {
    if (!pageGroups.has(pos.page)) {
      pageGroups.set(pos.page, [])
    }
    pageGroups.get(pos.page)!.push(pos)
  }

  // Create pages and place cards
  for (const [_pageNum, pagePositions] of pageGroups) {
    const page = pdfDoc.addPage([pageWidth, pageHeight])

    for (const pos of pagePositions) {
      if (pos.cardIndex >= cardImages.length) break
      const cardImage = cardImages[pos.cardIndex]

      // PDF coordinates are from bottom-left, so flip Y
      const pdfY = pageHeight - pos.y - pos.height

      page.drawImage(cardImage, {
        x: pos.x,
        y: pdfY,
        width: pos.width,
        height: pos.height,
      })
    }
  }

  const pdfBytes = await pdfDoc.save()
  const blob = new Blob([pdfBytes], { type: 'application/pdf' })
  const downloadUrl = URL.createObjectURL(blob)
  const downloadLink = document.createElement('a')
  const baseName = template.name.replace(/\.svg$/i, '') || 'id-cards'

  downloadLink.href = downloadUrl
  downloadLink.download = `${baseName}-batch-${users.length}-cards-${layout.name.replace(/[^a-z0-9]/gi, '-')}.pdf`
  document.body.appendChild(downloadLink)
  downloadLink.click()
  downloadLink.remove()
  URL.revokeObjectURL(downloadUrl)
}

/**
 * Export cards with per-slot assignments
 * Each slot can have its own data source (custom or user), template, and side (front/back)
 */
export async function exportWithSlotAssignments(
  defaultTemplate: TemplateMeta | null,
  backTemplate: TemplateMeta | null,
  fields: FieldDefinition[],
  customCardData: CardData,
  users: UserData[],
  fieldMappings: Record<string, string>,
  layout: PrintLayout,
  slotAssignments: SlotAssignment[],
  dpi: number = DEFAULT_EXPORT_DPI,
  customValues?: Record<string, string>,
  allTemplates?: Map<string, TemplateMeta>,  // Map of template ID to template meta
  allFieldMappings?: Map<string, Record<string, string>>,  // Map of template ID to field mappings
): Promise<void> {
  const pdfDoc = await PDFDocument.create()

  const pageWidth = parseFloat(layout.pageWidth) * POINTS_PER_INCH
  const pageHeight = parseFloat(layout.pageHeight) * POINTS_PER_INCH

  // Create a map of user ID to user data for quick lookup
  const userMap = new Map<string, UserData>()
  for (const user of users) {
    if (user.id) {
      userMap.set(user.id, user)
    }
  }

  // Pre-render each slot's card based on its assignment
  const cardImages = []
  for (const assignment of slotAssignments) {
    // Determine which template to use
    let template: TemplateMeta | null = null
    let slotFieldMappings = fieldMappings

    if (assignment.templateId && allTemplates?.has(assignment.templateId)) {
      // Use the specific template selected for this slot
      template = allTemplates.get(assignment.templateId)!
      // Use that template's field mappings if available
      if (allFieldMappings?.has(assignment.templateId)) {
        slotFieldMappings = allFieldMappings.get(assignment.templateId)!
      }
    } else {
      // Fall back to default template based on side
      template = assignment.side === 'back' && backTemplate ? backTemplate : defaultTemplate
    }

    if (!template) {
      // Skip if no template available
      cardImages.push(null)
      continue
    }

    // Get fields for this template (use default fields for now, templates should have their own)
    const templateFields = fields

    // Determine card data based on source
    let cardData: CardData
    if (assignment.source === 'custom') {
      // Use custom card data entered in the form
      cardData = customCardData
    } else {
      // Use data from a specific user
      const user = userMap.get(assignment.source)
      if (!user) {
        // User not found, skip this slot
        cardImages.push(null)
        continue
      }

      // Build card data from user and field mappings
      cardData = {}
      templateFields.forEach(field => {
        const layerId = field.sourceId || field.id
        const standardFieldName = slotFieldMappings[layerId]
        if (standardFieldName) {
          const customValue = customValues?.[layerId]
          cardData[field.id] = parseField(standardFieldName, user, customValue)
        }
      })
    }

    const canvas = await renderCardToCanvas(template, templateFields, cardData, dpi)
    const cardPngBytes = await dataUrlToUint8Array(canvas.toDataURL('image/png'))
    const cardImage = await pdfDoc.embedPng(cardPngBytes)
    cardImages.push(cardImage)
  }

  // Calculate positions for all slots
  const positions = calculateCardPositions(layout, slotAssignments.length)

  // Group positions by page
  const pageGroups = new Map<number, CardPosition[]>()
  for (const pos of positions) {
    if (!pageGroups.has(pos.page)) {
      pageGroups.set(pos.page, [])
    }
    pageGroups.get(pos.page)!.push(pos)
  }

  // Create pages and place cards
  for (const [_pageNum, pagePositions] of pageGroups) {
    const page = pdfDoc.addPage([pageWidth, pageHeight])

    for (const pos of pagePositions) {
      if (pos.cardIndex >= cardImages.length) break
      const cardImage = cardImages[pos.cardIndex]
      if (!cardImage) continue  // Skip null images

      // PDF coordinates are from bottom-left, so flip Y
      const pdfY = pageHeight - pos.y - pos.height

      page.drawImage(cardImage, {
        x: pos.x,
        y: pdfY,
        width: pos.width,
        height: pos.height,
      })
    }
  }

  const pdfBytes = await pdfDoc.save()
  const blob = new Blob([pdfBytes], { type: 'application/pdf' })
  const downloadUrl = URL.createObjectURL(blob)
  const downloadLink = document.createElement('a')
  const baseName = defaultTemplate?.name.replace(/\.svg$/i, '') || 'id-cards'

  downloadLink.href = downloadUrl
  downloadLink.download = `${baseName}-${layout.name.replace(/[^a-z0-9]/gi, '-')}.pdf`
  document.body.appendChild(downloadLink)
  downloadLink.click()
  downloadLink.remove()
  URL.revokeObjectURL(downloadUrl)
}

export async function renderCardToCanvas(
  template: TemplateMeta,
  fields: FieldDefinition[],
  cardData: CardData,
  dpi: number = DEFAULT_EXPORT_DPI,
): Promise<HTMLCanvasElement> {
  const { widthMm, heightMm } = getTemplateSizeInMm(template)
  const canvasWidth = Math.max(1, Math.round((widthMm / MM_PER_INCH) * dpi))
  const canvasHeight = Math.max(1, Math.round((heightMm / MM_PER_INCH) * dpi))

  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = canvasHeight

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas 2D rendering is not supported in this environment.')
  }

  if (document.fonts?.ready) {
    try {
      await document.fonts.ready
    } catch (error) {
      console.warn('Fonts may not be fully loaded before export.', error)
    }
  }

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvasWidth, canvasHeight)

  try {
    const svgMarkup = renderSvgWithData(template, fields, cardData)
    // Set explicit width/height on SVG to ensure fonts scale correctly when rendered
    const scaledSvgMarkup = setSvgDimensions(svgMarkup, canvasWidth, canvasHeight)
    const background = await loadSvgAsImage(scaledSvgMarkup)
    context.drawImage(background, 0, 0, canvasWidth, canvasHeight)
  } catch (error) {
    console.warn('Unable to draw template background, exporting fields only.', error)
  }

  const fontScale = canvasWidth / PREVIEW_BASE_WIDTH

  for (const field of fields) {
    if (field.type === 'image') {
      if (field.sourceId) {
        continue
      }
      const imageValue = asImageValue(cardData[field.id])
      if (!imageValue) continue

      const containerWidth = (field.width ?? 20) / 100 * canvasWidth
      const containerHeight = (field.height ?? 30) / 100 * canvasHeight
      const x = clamp((field.x / 100) * canvasWidth, 0, canvasWidth - containerWidth)
      const y = clamp((field.y / 100) * canvasHeight, 0, canvasHeight - containerHeight)

      const scaleFactor = Math.max(0.1, imageValue.scale)
      const drawWidth = containerWidth * scaleFactor
      const drawHeight = containerHeight * scaleFactor
      const offsetXPx = imageValue.offsetX * containerWidth
      const offsetYPx = imageValue.offsetY * containerHeight
      const drawX = x + offsetXPx - (drawWidth - containerWidth) / 2
      const drawY = y + offsetYPx - (drawHeight - containerHeight) / 2

      try {
        const image = await loadImageElement(imageValue.src)
        context.save()
        context.beginPath()
        context.rect(x, y, containerWidth, containerHeight)
        context.clip()
        context.drawImage(image, drawX, drawY, drawWidth, drawHeight)
        context.restore()
      } catch (error) {
        console.warn(`Failed to place image field "${field.label}"`, error)
      }
      continue
    }

    if (field.sourceId && field.type === 'text') {
      continue
    }

    const fieldValue = cardData[field.id]
    const rawValue = typeof fieldValue === 'string' && fieldValue.trim().length > 0 ? fieldValue : field.label
    if (!rawValue) continue

    const textX = clamp((field.x / 100) * canvasWidth, 0, canvasWidth)
    const textY = clamp((field.y / 100) * canvasHeight, 0, canvasHeight)
    const maxWidth = field.width ? (field.width / 100) * canvasWidth : undefined
    const fontSize = Math.max(8, Math.round((field.fontSize ?? 16) * fontScale))

    drawTextField(context, {
      text: rawValue,
      x: textX,
      y: textY,
      fontSize,
      color: field.color ?? '#000000',
      maxWidth,
      align: field.align ?? 'left',
      fontFamily: field.fontFamily,
      fontWeight: field.fontWeight,
    })
  }

  return canvas
}

type DrawTextOptions = {
  text: string
  x: number
  y: number
  fontSize: number
  color: string
  maxWidth?: number
  align: FieldDefinition['align']
  fontFamily?: string
  fontWeight?: number
}

function drawTextField(context: CanvasRenderingContext2D, options: DrawTextOptions) {
  const { text, x, y, fontSize, color, maxWidth, align, fontFamily, fontWeight } = options
  context.save()
  context.fillStyle = color
  context.font = buildCanvasFontString(fontFamily, fontWeight, fontSize)
  context.textBaseline = 'top'

  let drawX = x
  let textAlign: CanvasTextAlign = 'left'

  if (align === 'center' && maxWidth) {
    textAlign = 'center'
    drawX = x + maxWidth / 2
  } else if (align === 'right' && maxWidth) {
    textAlign = 'right'
    drawX = x + maxWidth
  }

  context.textAlign = textAlign

  const lines = breakIntoLines(context, text, maxWidth)
  const lineHeight = fontSize * 1.2

  lines.forEach((line, index) => {
    context.fillText(line, drawX, y + index * lineHeight)
  })

  context.restore()
}

function breakIntoLines(context: CanvasRenderingContext2D, text: string, maxWidth?: number): string[] {
  const sanitized = text.replace(/\r/g, '')
  if (!maxWidth || maxWidth <= 0) {
    return sanitized.split('\n')
  }

  const paragraphs = sanitized.split('\n')
  const lines: string[] = []

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push('')
      continue
    }

    const words = paragraph.split(/\s+/)
    let currentLine = ''

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const metrics = context.measureText(testLine)
      if (metrics.width <= maxWidth || !currentLine) {
        currentLine = testLine
      } else {
        lines.push(currentLine)
        currentLine = word
      }
    }

    if (currentLine) {
      lines.push(currentLine)
    }
  }

  return lines.length ? lines : ['']
}

function getTemplateSizeInMm(template: TemplateMeta): { widthMm: number; heightMm: number } {
  const widthMm = template.unit === 'mm' ? template.width : template.width / PX_PER_MM
  const heightMm = template.unit === 'mm' ? template.height : template.height / PX_PER_MM
  return { widthMm, heightMm }
}

function getTemplateSizeInPoints(template: TemplateMeta): { widthPoints: number; heightPoints: number } {
  const { widthMm, heightMm } = getTemplateSizeInMm(template)
  return {
    widthPoints: (widthMm / MM_PER_INCH) * POINTS_PER_INCH,
    heightPoints: (heightMm / MM_PER_INCH) * POINTS_PER_INCH,
  }
}

/**
 * Set explicit width and height attributes on an SVG to ensure proper font scaling
 * when the SVG is rendered to a canvas. Without explicit dimensions, fonts defined
 * in pixels won't scale correctly when the SVG is stretched to fit the canvas.
 */
function setSvgDimensions(svgMarkup: string, width: number, height: number): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgMarkup, 'image/svg+xml')
  const svgRoot = doc.documentElement

  // Set explicit width and height to ensure proper rendering at target size
  svgRoot.setAttribute('width', `${width}`)
  svgRoot.setAttribute('height', `${height}`)

  return new XMLSerializer().serializeToString(svgRoot)
}

async function dataUrlToUint8Array(dataUrl: string): Promise<Uint8Array> {
  const response = await fetch(dataUrl)
  const buffer = await response.arrayBuffer()
  return new Uint8Array(buffer)
}

type LayoutPlaceholder = {
  id: string
  x: number
  y: number
  width: number
  height: number
}

type LayoutTemplate = {
  backgroundSvg: string
  widthPoints: number
  heightPoints: number
  placeholders: LayoutPlaceholder[]
}

async function loadPrintLayout(layoutSvgPath: string): Promise<LayoutTemplate> {
  const response = await fetch(layoutSvgPath)
  if (!response.ok) {
    throw new Error('Unable to load print layout template')
  }
  const rawSvgMarkup = await response.text()
  const parser = new DOMParser()
  const doc = parser.parseFromString(rawSvgMarkup, 'image/svg+xml')
  const svgRoot = doc.documentElement
  const viewBoxAttr = svgRoot.getAttribute('viewBox')
  if (!viewBoxAttr) {
    throw new Error('Print layout template is missing a viewBox')
  }
  const [, , viewWidth, viewHeight] = viewBoxAttr.split(/\s+/).map(parseFloat)
  if (!Number.isFinite(viewWidth) || !Number.isFinite(viewHeight)) {
    throw new Error('Print layout template has an invalid viewBox')
  }

  const mmToPoints = POINTS_PER_INCH / MM_PER_INCH
  const widthPoints = viewWidth * mmToPoints
  const heightPoints = viewHeight * mmToPoints

  const placeholders: LayoutPlaceholder[] = []
  const groupsToRemove: Element[] = []

  ;['Topcard', 'Bottomcard'].forEach((groupId) => {
    const group = doc.getElementById(groupId)
    if (!group) return
    const rects = Array.from(group.querySelectorAll('rect'))
    const targetRect = rects[rects.length - 1]
    if (!targetRect) return
    const x = parseFloat(targetRect.getAttribute('x') ?? '0')
    const y = parseFloat(targetRect.getAttribute('y') ?? '0')
    const width = parseFloat(targetRect.getAttribute('width') ?? '0')
    const height = parseFloat(targetRect.getAttribute('height') ?? '0')
    if ([x, y, width, height].some((value) => !Number.isFinite(value))) return
    placeholders.push({
      id: groupId,
      x: x * mmToPoints,
      y: y * mmToPoints,
      width: width * mmToPoints,
      height: height * mmToPoints,
    })
    groupsToRemove.push(group)
  })

  if (placeholders.length === 0) {
    throw new Error('Print layout template does not define any card placeholders')
  }

  groupsToRemove.forEach((group) => group.parentNode?.removeChild(group))

  const serializer = new XMLSerializer()
  const cleanedSvgMarkup = serializer.serializeToString(svgRoot)

  return {
    backgroundSvg: cleanedSvgMarkup,
    widthPoints,
    heightPoints,
    placeholders,
  }
}

async function svgMarkupToPngBytes(svgMarkup: string): Promise<Uint8Array> {
  const image = await loadSvgAsImage(svgMarkup)
  const canvas = document.createElement('canvas')
  const pixelWidth = Math.max(1, image.naturalWidth || 3400)
  const pixelHeight = Math.max(1, image.naturalHeight || 3430)
  canvas.width = pixelWidth
  canvas.height = pixelHeight
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas 2D rendering is not supported in this environment.')
  }
  context.drawImage(image, 0, 0, pixelWidth, pixelHeight)
  const dataUrl = canvas.toDataURL('image/png')
  return dataUrlToUint8Array(dataUrl)
}
