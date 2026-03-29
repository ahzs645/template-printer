import { PDFDocument } from 'pdf-lib'
import { jsPDF } from 'jspdf'
import 'svg2pdf.js'
import type { CardData, FieldDefinition, ImageValue, PrintLayout, TemplateMeta } from './types'
import type { UserData } from './fieldParser'
import { parseField } from './fieldParser'
import type { ColorProfile } from './calibration/exportUtils'
import { applyColorCorrection, correctColorValue } from './calibration/colorCorrection'

// Slot assignment for multi-card layouts
export type SlotAssignment = {
  source: 'custom' | 'empty' | string  // 'custom' for manual fields, 'empty' for a blank slot, or user ID
  side: 'front' | 'back'     // Which side of the card design to use
  templateId?: string | null // Optional: override with a different design template
}
import {
  buildCanvasFontString,
  clamp,
  convertTextToOutlines,
  loadImageElement,
  loadSvgAsImage,
  renderSvgWithData,
} from './svgTemplate'

const PX_PER_MM = 3.779527559055
const MM_PER_INCH = 25.4
const POINTS_PER_INCH = 72
const DEFAULT_EXPORT_DPI = 300
const PREVIEW_BASE_WIDTH = 420
const SVG_NS = 'http://www.w3.org/2000/svg'
const XLINK_NS = 'http://www.w3.org/1999/xlink'

// Module-level font buffer cache for text-to-outlines conversion in vector PDF exports
let _outlineFontBuffers: Map<string, ArrayBuffer> | null = null

export function setOutlineFontBuffers(fontBuffers: Map<string, ArrayBuffer>): void {
  _outlineFontBuffers = fontBuffers
}

export function clearOutlineFontBuffers(): void {
  _outlineFontBuffers = null
}

/**
 * Check if rotating a card 90° would give a significantly better fit within a slot.
 */
function cardNeedsRotation(
  cardWidth: number,
  cardHeight: number,
  slotWidth: number,
  slotHeight: number,
): boolean {
  const normalScale = Math.min(slotWidth / cardWidth, slotHeight / cardHeight)
  const rotatedScale = Math.min(slotWidth / cardHeight, slotHeight / cardWidth)
  return rotatedScale > normalScale * 1.05
}

/**
 * Rotate a canvas 90° clockwise, swapping width and height.
 */
function rotateCanvas90CW(source: HTMLCanvasElement): HTMLCanvasElement {
  const rotated = document.createElement('canvas')
  rotated.width = source.height
  rotated.height = source.width
  const ctx = rotated.getContext('2d')
  if (!ctx) return source
  ctx.translate(source.height, 0)
  ctx.rotate(Math.PI / 2)
  ctx.drawImage(source, 0, 0)
  return rotated
}

function asImageValue(value: CardData[string]): ImageValue | undefined {
  if (!value || typeof value !== 'object') return undefined
  if (!('src' in value)) return undefined
  return value as ImageValue
}

function renderCardSvgMarkup(
  template: TemplateMeta,
  fields: FieldDefinition[],
  cardData: CardData,
  colorProfile?: ColorProfile | null,
): string {
  const svgMarkup = renderSvgWithData(template, fields, cardData)
  return colorProfile ? applyColorCorrection(svgMarkup, colorProfile) : svgMarkup
}

export async function exportSingleCard(
  template: TemplateMeta,
  fields: FieldDefinition[],
  cardData: CardData,
  dpi: number = DEFAULT_EXPORT_DPI,
  maintainVectors = false,
  colorProfile?: ColorProfile | null,
): Promise<void> {
  if (maintainVectors) {
    await exportSingleCardVector(template, fields, cardData, colorProfile)
    return
  }

  const canvas = await renderCardToCanvas(template, fields, cardData, dpi, colorProfile)
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
  maintainVectors = false,
  colorProfile?: ColorProfile | null,
): Promise<void> {
  if (maintainVectors) {
    await exportWithPrintLayoutVector(template, fields, cardData, printLayoutSvgPath, colorProfile)
    return
  }

  let canvas = await renderCardToCanvas(template, fields, cardData, dpi, colorProfile)
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

  let { widthPoints: cardWidthPoints, heightPoints: cardHeightPoints } = getTemplateSizeInPoints(template)

  // Rotate the card if it would fit significantly better in the layout slots
  const firstSlot = layout.placeholders[0]
  if (firstSlot && cardNeedsRotation(cardWidthPoints, cardHeightPoints, firstSlot.width, firstSlot.height)) {
    canvas = rotateCanvas90CW(canvas)
    ;[cardWidthPoints, cardHeightPoints] = [cardHeightPoints, cardWidthPoints]
  }

  const cardPngBytes = await dataUrlToUint8Array(canvas.toDataURL('image/png'))
  const cardImage = await pdfDoc.embedPng(cardPngBytes)

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
  maintainVectors = false,
  colorProfile?: ColorProfile | null,
): Promise<void> {
  if (maintainVectors) {
    await exportBatchCardsVector(template, fields, users, fieldMappings, customValues, colorProfile)
    return
  }

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
    const canvas = await renderCardToCanvas(template, fields, cardData, dpi, colorProfile)
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
  maintainVectors = false,
  colorProfile?: ColorProfile | null,
): Promise<void> {
  if (maintainVectors) {
    await exportBatchCardsWithPrintLayoutVector(
      template,
      fields,
      users,
      fieldMappings,
      printLayoutSvgPath,
      customValues,
      colorProfile,
    )
    return
  }

  const layout = await loadPrintLayout(printLayoutSvgPath)
  const pdfDoc = await PDFDocument.create()
  let { widthPoints: cardWidthPoints, heightPoints: cardHeightPoints } = getTemplateSizeInPoints(template)

  // Check if cards need rotation to fit the layout slots
  const firstSlot = layout.placeholders[0]
  const rotate = firstSlot != null && cardNeedsRotation(cardWidthPoints, cardHeightPoints, firstSlot.width, firstSlot.height)
  if (rotate) {
    ;[cardWidthPoints, cardHeightPoints] = [cardHeightPoints, cardWidthPoints]
  }

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

    let canvas = await renderCardToCanvas(template, fields, cardData, dpi, colorProfile)
    if (rotate) canvas = rotateCanvas90CW(canvas)
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
  const bleedWidth = parseFloat(layout.bleedWidth) * POINTS_PER_INCH
  const bleedHeight = parseFloat(layout.bleedHeight) * POINTS_PER_INCH
  const placedWidth = cardWidth + bleedWidth
  const placedHeight = cardHeight + bleedHeight

  for (let i = 0; i < cardCount; i++) {
    const slotIndex = i % layout.cardsPerPage
    const col = slotIndex % layout.cardsPerRow
    const row = Math.floor(slotIndex / layout.cardsPerRow)
    const page = Math.floor(i / layout.cardsPerPage)
    const trimX = pageMarginLeft + col * (cardWidth + cardSpacingX)
    const trimY = pageMarginTop + row * (cardHeight + cardSpacingY)

    positions.push({
      page,
      x: trimX - bleedWidth / 2,
      y: trimY - bleedHeight / 2,
      width: placedWidth,
      height: placedHeight,
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
  maintainVectors = false,
  colorProfile?: ColorProfile | null,
): Promise<void> {
  if (maintainVectors) {
    await exportWithJsonLayoutVector(template, fields, cardData, layout, colorProfile)
    return
  }

  let canvas = await renderCardToCanvas(template, fields, cardData, dpi, colorProfile)

  const pageWidth = parseFloat(layout.pageWidth) * POINTS_PER_INCH
  const pageHeight = parseFloat(layout.pageHeight) * POINTS_PER_INCH

  const pdfDoc = await PDFDocument.create()

  // Calculate positions for all slots on the page (fill with same card)
  const positions = calculateCardPositions(layout, layout.cardsPerPage)

  let { widthPoints: cardWidthPt, heightPoints: cardHeightPt } = getTemplateSizeInPoints(template)

  // Rotate the card if it would fit significantly better in the slot
  const firstPos = positions[0]
  if (firstPos && cardNeedsRotation(cardWidthPt, cardHeightPt, firstPos.width, firstPos.height)) {
    canvas = rotateCanvas90CW(canvas)
    ;[cardWidthPt, cardHeightPt] = [cardHeightPt, cardWidthPt]
  }

  const cardPngBytes = await dataUrlToUint8Array(canvas.toDataURL('image/png'))
  const cardImage = await pdfDoc.embedPng(cardPngBytes)

  const page = pdfDoc.addPage([pageWidth, pageHeight])

  // Place the same card in each slot, scaling proportionally
  for (const pos of positions) {
    const scale = Math.min(pos.width / cardWidthPt, pos.height / cardHeightPt)
    const drawWidth = cardWidthPt * scale
    const drawHeight = cardHeightPt * scale
    // PDF coordinates are from bottom-left, so flip Y, then center within slot
    const pdfY = pageHeight - pos.y - pos.height
    const offsetX = pos.x + (pos.width - drawWidth) / 2
    const offsetY = pdfY + (pos.height - drawHeight) / 2

    page.drawImage(cardImage, {
      x: offsetX,
      y: offsetY,
      width: drawWidth,
      height: drawHeight,
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
  maintainVectors = false,
  colorProfile?: ColorProfile | null,
): Promise<void> {
  if (maintainVectors) {
    await exportBatchCardsWithJsonLayoutVector(
      template,
      fields,
      users,
      fieldMappings,
      layout,
      customValues,
      colorProfile,
    )
    return
  }

  const pdfDoc = await PDFDocument.create()

  const pageWidth = parseFloat(layout.pageWidth) * POINTS_PER_INCH
  const pageHeight = parseFloat(layout.pageHeight) * POINTS_PER_INCH

  const positions = calculateCardPositions(layout, users.length)
  let { widthPoints: cardWidthPt, heightPoints: cardHeightPt } = getTemplateSizeInPoints(template)

  // Check if cards need rotation to fit the placed slot, including bleed.
  const firstPos = positions[0]
  const slotWidth = firstPos?.width ?? parseFloat(layout.cardWidth) * POINTS_PER_INCH
  const slotHeight = firstPos?.height ?? parseFloat(layout.cardHeight) * POINTS_PER_INCH
  const rotate = cardNeedsRotation(cardWidthPt, cardHeightPt, slotWidth, slotHeight)
  if (rotate) {
    ;[cardWidthPt, cardHeightPt] = [cardHeightPt, cardWidthPt]
  }

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

    let canvas = await renderCardToCanvas(template, fields, cardData, dpi, colorProfile)
    if (rotate) canvas = rotateCanvas90CW(canvas)
    const cardPngBytes = await dataUrlToUint8Array(canvas.toDataURL('image/png'))
    const cardImage = await pdfDoc.embedPng(cardPngBytes)
    cardImages.push(cardImage)
  }

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

      // Scale proportionally and center within the slot
      const scale = Math.min(pos.width / cardWidthPt, pos.height / cardHeightPt)
      const drawWidth = cardWidthPt * scale
      const drawHeight = cardHeightPt * scale
      const pdfY = pageHeight - pos.y - pos.height
      const offsetX = pos.x + (pos.width - drawWidth) / 2
      const offsetY = pdfY + (pos.height - drawHeight) / 2

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
  maintainVectors = false,
  colorProfile?: ColorProfile | null,
): Promise<void> {
  if (maintainVectors) {
    await exportWithSlotAssignmentsVector(
      defaultTemplate,
      backTemplate,
      fields,
      customCardData,
      users,
      fieldMappings,
      layout,
      slotAssignments,
      customValues,
      allTemplates,
      allFieldMappings,
      colorProfile,
    )
    return
  }

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

  const positions = calculateCardPositions(layout, slotAssignments.length)
  const firstPos = positions[0]
  const slotWidth = firstPos?.width ?? parseFloat(layout.cardWidth) * POINTS_PER_INCH
  const slotHeight = firstPos?.height ?? parseFloat(layout.cardHeight) * POINTS_PER_INCH

  // Pre-render each slot's card based on its assignment
  const cardImages: Array<{ image: Awaited<ReturnType<typeof pdfDoc.embedPng>>; cardWidthPt: number; cardHeightPt: number } | null> = []
  for (const assignment of slotAssignments) {
    if (assignment.source === 'empty') {
      cardImages.push(null)
      continue
    }

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

    let canvas = await renderCardToCanvas(template, templateFields, cardData, dpi, colorProfile)
    let { widthPoints: cw, heightPoints: ch } = getTemplateSizeInPoints(template)

    // Rotate if this card's orientation doesn't match the slot
    if (cardNeedsRotation(cw, ch, slotWidth, slotHeight)) {
      canvas = rotateCanvas90CW(canvas)
      ;[cw, ch] = [ch, cw]
    }

    const cardPngBytes = await dataUrlToUint8Array(canvas.toDataURL('image/png'))
    const cardImage = await pdfDoc.embedPng(cardPngBytes)
    cardImages.push({ image: cardImage, cardWidthPt: cw, cardHeightPt: ch })
  }

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
      const entry = cardImages[pos.cardIndex]
      if (!entry) continue  // Skip null images

      // Scale proportionally and center within the slot
      const scale = Math.min(pos.width / entry.cardWidthPt, pos.height / entry.cardHeightPt)
      const drawWidth = entry.cardWidthPt * scale
      const drawHeight = entry.cardHeightPt * scale
      const pdfY = pageHeight - pos.y - pos.height
      const offsetX = pos.x + (pos.width - drawWidth) / 2
      const offsetY = pdfY + (pos.height - drawHeight) / 2

      page.drawImage(entry.image, {
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
  const baseName = defaultTemplate?.name.replace(/\.svg$/i, '') || 'id-cards'

  downloadLink.href = downloadUrl
  downloadLink.download = `${baseName}-${layout.name.replace(/[^a-z0-9]/gi, '-')}.pdf`
  document.body.appendChild(downloadLink)
  downloadLink.click()
  downloadLink.remove()
  URL.revokeObjectURL(downloadUrl)
}

type VectorCardEntry = {
  svgMarkup: string
  cardWidthPt: number
  cardHeightPt: number
}

async function exportSingleCardVector(
  template: TemplateMeta,
  fields: FieldDefinition[],
  cardData: CardData,
  colorProfile?: ColorProfile | null,
): Promise<void> {
  const { widthPoints, heightPoints } = getTemplateSizeInPoints(template)
  const pdf = createVectorPdfDocument(widthPoints, heightPoints)
  await drawSvgMarkupOnPdf(pdf, renderCardSvgMarkup(template, fields, cardData, colorProfile), 0, 0, widthPoints, heightPoints)
  downloadBlob(pdf.output('blob'), `${template.name.replace(/\.svg$/i, '') || 'id-card'}.pdf`)
}

async function exportWithPrintLayoutVector(
  template: TemplateMeta,
  fields: FieldDefinition[],
  cardData: CardData,
  printLayoutSvgPath: string,
  colorProfile?: ColorProfile | null,
): Promise<void> {
  const layout = await loadPrintLayout(printLayoutSvgPath)
  const pdf = createVectorPdfDocument(layout.widthPoints, layout.heightPoints)
  await drawSvgMarkupOnPdf(pdf, layout.backgroundSvg, 0, 0, layout.widthPoints, layout.heightPoints)

  let cardMarkup = renderCardSvgMarkup(template, fields, cardData, colorProfile)
  let { widthPoints: cardWidthPoints, heightPoints: cardHeightPoints } = getTemplateSizeInPoints(template)

  const firstSlot = layout.placeholders[0]
  if (firstSlot && cardNeedsRotation(cardWidthPoints, cardHeightPoints, firstSlot.width, firstSlot.height)) {
    cardMarkup = rotateSvgMarkup90CW(cardMarkup, template.width, template.height)
    ;[cardWidthPoints, cardHeightPoints] = [cardHeightPoints, cardWidthPoints]
  }

  for (const slot of layout.placeholders) {
    const scale = Math.min(slot.width / cardWidthPoints, slot.height / cardHeightPoints)
    const drawWidth = cardWidthPoints * scale
    const drawHeight = cardHeightPoints * scale
    const offsetX = slot.x + (slot.width - drawWidth) / 2
    const offsetY = slot.y + (slot.height - drawHeight) / 2
    await drawSvgMarkupOnPdf(pdf, cardMarkup, offsetX, offsetY, drawWidth, drawHeight)
  }

  downloadBlob(pdf.output('blob'), `${template.name.replace(/\.svg$/i, '') || 'id-card'}-print-layout.pdf`)
}

async function exportBatchCardsVector(
  template: TemplateMeta,
  fields: FieldDefinition[],
  users: UserData[],
  fieldMappings: Record<string, string>,
  customValues?: Record<string, string>,
  colorProfile?: ColorProfile | null,
): Promise<void> {
  const { widthPoints, heightPoints } = getTemplateSizeInPoints(template)
  const pdf = createVectorPdfDocument(widthPoints, heightPoints)

  for (const [index, user] of users.entries()) {
    if (index > 0) {
      pdf.addPage([widthPoints, heightPoints], getPageOrientation(widthPoints, heightPoints))
    }

    const cardData: CardData = {}
    fields.forEach(field => {
      const layerId = field.sourceId || field.id
      const standardFieldName = fieldMappings[layerId]
      if (standardFieldName) {
        const customValue = customValues?.[layerId]
        cardData[field.id] = parseField(standardFieldName, user, customValue)
      }
    })

    await drawSvgMarkupOnPdf(pdf, renderCardSvgMarkup(template, fields, cardData, colorProfile), 0, 0, widthPoints, heightPoints)
  }

  downloadBlob(pdf.output('blob'), `${template.name.replace(/\.svg$/i, '') || 'id-cards'}-batch-${users.length}-cards.pdf`)
}

async function exportBatchCardsWithPrintLayoutVector(
  template: TemplateMeta,
  fields: FieldDefinition[],
  users: UserData[],
  fieldMappings: Record<string, string>,
  printLayoutSvgPath: string,
  customValues?: Record<string, string>,
  colorProfile?: ColorProfile | null,
): Promise<void> {
  const layout = await loadPrintLayout(printLayoutSvgPath)
  const pdf = createVectorPdfDocument(layout.widthPoints, layout.heightPoints)
  let { widthPoints: cardWidthPoints, heightPoints: cardHeightPoints } = getTemplateSizeInPoints(template)

  const firstSlot = layout.placeholders[0]
  const rotate = firstSlot != null && cardNeedsRotation(cardWidthPoints, cardHeightPoints, firstSlot.width, firstSlot.height)
  if (rotate) {
    ;[cardWidthPoints, cardHeightPoints] = [cardHeightPoints, cardWidthPoints]
  }

  const cardMarkups: string[] = []
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

    let cardMarkup = renderCardSvgMarkup(template, fields, cardData, colorProfile)
    if (rotate) {
      cardMarkup = rotateSvgMarkup90CW(cardMarkup, template.width, template.height)
    }
    cardMarkups.push(cardMarkup)
  }

  let cardIndex = 0
  let isFirstPage = true
  while (cardIndex < cardMarkups.length) {
    if (!isFirstPage) {
      pdf.addPage([layout.widthPoints, layout.heightPoints], getPageOrientation(layout.widthPoints, layout.heightPoints))
    }
    isFirstPage = false

    await drawSvgMarkupOnPdf(pdf, layout.backgroundSvg, 0, 0, layout.widthPoints, layout.heightPoints)

    for (const slot of layout.placeholders) {
      if (cardIndex >= cardMarkups.length) break
      const cardMarkup = cardMarkups[cardIndex++]
      const scale = Math.min(slot.width / cardWidthPoints, slot.height / cardHeightPoints)
      const drawWidth = cardWidthPoints * scale
      const drawHeight = cardHeightPoints * scale
      const offsetX = slot.x + (slot.width - drawWidth) / 2
      const offsetY = slot.y + (slot.height - drawHeight) / 2
      await drawSvgMarkupOnPdf(pdf, cardMarkup, offsetX, offsetY, drawWidth, drawHeight)
    }
  }

  downloadBlob(
    pdf.output('blob'),
    `${template.name.replace(/\.svg$/i, '') || 'id-cards'}-batch-${users.length}-cards-print-layout.pdf`,
  )
}

async function exportWithJsonLayoutVector(
  template: TemplateMeta,
  fields: FieldDefinition[],
  cardData: CardData,
  layout: PrintLayout,
  colorProfile?: ColorProfile | null,
): Promise<void> {
  const pageWidth = parseFloat(layout.pageWidth) * POINTS_PER_INCH
  const pageHeight = parseFloat(layout.pageHeight) * POINTS_PER_INCH
  const positions = calculateCardPositions(layout, layout.cardsPerPage)
  const pdf = createVectorPdfDocument(pageWidth, pageHeight)

  let cardMarkup = renderCardSvgMarkup(template, fields, cardData, colorProfile)
  let { widthPoints: cardWidthPt, heightPoints: cardHeightPt } = getTemplateSizeInPoints(template)
  const firstPos = positions[0]
  if (firstPos && cardNeedsRotation(cardWidthPt, cardHeightPt, firstPos.width, firstPos.height)) {
    cardMarkup = rotateSvgMarkup90CW(cardMarkup, template.width, template.height)
    ;[cardWidthPt, cardHeightPt] = [cardHeightPt, cardWidthPt]
  }

  for (const pos of positions) {
    const scale = Math.min(pos.width / cardWidthPt, pos.height / cardHeightPt)
    const drawWidth = cardWidthPt * scale
    const drawHeight = cardHeightPt * scale
    const offsetX = pos.x + (pos.width - drawWidth) / 2
    const offsetY = pos.y + (pos.height - drawHeight) / 2
    await drawSvgMarkupOnPdf(pdf, cardMarkup, offsetX, offsetY, drawWidth, drawHeight)
  }

  downloadBlob(pdf.output('blob'), `${template.name.replace(/\.svg$/i, '') || 'id-card'}-${layout.name.replace(/[^a-z0-9]/gi, '-')}.pdf`)
}

async function exportBatchCardsWithJsonLayoutVector(
  template: TemplateMeta,
  fields: FieldDefinition[],
  users: UserData[],
  fieldMappings: Record<string, string>,
  layout: PrintLayout,
  customValues?: Record<string, string>,
  colorProfile?: ColorProfile | null,
): Promise<void> {
  const pageWidth = parseFloat(layout.pageWidth) * POINTS_PER_INCH
  const pageHeight = parseFloat(layout.pageHeight) * POINTS_PER_INCH
  const positions = calculateCardPositions(layout, users.length)
  const pageGroups = new Map<number, CardPosition[]>()
  const pdf = createVectorPdfDocument(pageWidth, pageHeight)

  let { widthPoints: cardWidthPt, heightPoints: cardHeightPt } = getTemplateSizeInPoints(template)
  const firstPos = positions[0]
  const slotWidth = firstPos?.width ?? parseFloat(layout.cardWidth) * POINTS_PER_INCH
  const slotHeight = firstPos?.height ?? parseFloat(layout.cardHeight) * POINTS_PER_INCH
  const rotate = cardNeedsRotation(cardWidthPt, cardHeightPt, slotWidth, slotHeight)
  if (rotate) {
    ;[cardWidthPt, cardHeightPt] = [cardHeightPt, cardWidthPt]
  }

  const cardMarkups: string[] = []
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

    let cardMarkup = renderCardSvgMarkup(template, fields, cardData, colorProfile)
    if (rotate) {
      cardMarkup = rotateSvgMarkup90CW(cardMarkup, template.width, template.height)
    }
    cardMarkups.push(cardMarkup)
  }

  for (const pos of positions) {
    if (!pageGroups.has(pos.page)) {
      pageGroups.set(pos.page, [])
    }
    pageGroups.get(pos.page)!.push(pos)
  }

  let isFirstPage = true
  for (const [_pageNum, pagePositions] of pageGroups) {
    if (!isFirstPage) {
      pdf.addPage([pageWidth, pageHeight], getPageOrientation(pageWidth, pageHeight))
    }
    isFirstPage = false

    for (const pos of pagePositions) {
      if (pos.cardIndex >= cardMarkups.length) break
      const cardMarkup = cardMarkups[pos.cardIndex]
      const scale = Math.min(pos.width / cardWidthPt, pos.height / cardHeightPt)
      const drawWidth = cardWidthPt * scale
      const drawHeight = cardHeightPt * scale
      const offsetX = pos.x + (pos.width - drawWidth) / 2
      const offsetY = pos.y + (pos.height - drawHeight) / 2
      await drawSvgMarkupOnPdf(pdf, cardMarkup, offsetX, offsetY, drawWidth, drawHeight)
    }
  }

  downloadBlob(
    pdf.output('blob'),
    `${template.name.replace(/\.svg$/i, '') || 'id-cards'}-batch-${users.length}-cards-${layout.name.replace(/[^a-z0-9]/gi, '-')}.pdf`,
  )
}

async function exportWithSlotAssignmentsVector(
  defaultTemplate: TemplateMeta | null,
  backTemplate: TemplateMeta | null,
  fields: FieldDefinition[],
  customCardData: CardData,
  users: UserData[],
  fieldMappings: Record<string, string>,
  layout: PrintLayout,
  slotAssignments: SlotAssignment[],
  customValues?: Record<string, string>,
  allTemplates?: Map<string, TemplateMeta>,
  allFieldMappings?: Map<string, Record<string, string>>,
  colorProfile?: ColorProfile | null,
): Promise<void> {
  const pdf = createVectorPdfDocument(
    parseFloat(layout.pageWidth) * POINTS_PER_INCH,
    parseFloat(layout.pageHeight) * POINTS_PER_INCH,
  )
  const pageWidth = parseFloat(layout.pageWidth) * POINTS_PER_INCH
  const pageHeight = parseFloat(layout.pageHeight) * POINTS_PER_INCH

  const userMap = new Map<string, UserData>()
  for (const user of users) {
    if (user.id) {
      userMap.set(user.id, user)
    }
  }

  const positions = calculateCardPositions(layout, slotAssignments.length)
  const firstPos = positions[0]
  const slotWidth = firstPos?.width ?? parseFloat(layout.cardWidth) * POINTS_PER_INCH
  const slotHeight = firstPos?.height ?? parseFloat(layout.cardHeight) * POINTS_PER_INCH

  const cardEntries: Array<VectorCardEntry | null> = []
  for (const assignment of slotAssignments) {
    if (assignment.source === 'empty') {
      cardEntries.push(null)
      continue
    }

    let template: TemplateMeta | null = null
    let slotFieldMappings = fieldMappings

    if (assignment.templateId && allTemplates?.has(assignment.templateId)) {
      template = allTemplates.get(assignment.templateId)!
      if (allFieldMappings?.has(assignment.templateId)) {
        slotFieldMappings = allFieldMappings.get(assignment.templateId)!
      }
    } else {
      template = assignment.side === 'back' && backTemplate ? backTemplate : defaultTemplate
    }

    if (!template) {
      cardEntries.push(null)
      continue
    }

    const templateFields = fields
    let slotCardData: CardData
    if (assignment.source === 'custom') {
      slotCardData = customCardData
    } else {
      const user = userMap.get(assignment.source)
      if (!user) {
        cardEntries.push(null)
        continue
      }

      slotCardData = {}
      templateFields.forEach(field => {
        const layerId = field.sourceId || field.id
        const standardFieldName = slotFieldMappings[layerId]
        if (standardFieldName) {
          const customValue = customValues?.[layerId]
          slotCardData[field.id] = parseField(standardFieldName, user, customValue)
        }
      })
    }

    let svgMarkup = renderCardSvgMarkup(template, templateFields, slotCardData, colorProfile)
    let { widthPoints: cardWidthPt, heightPoints: cardHeightPt } = getTemplateSizeInPoints(template)
    if (cardNeedsRotation(cardWidthPt, cardHeightPt, slotWidth, slotHeight)) {
      svgMarkup = rotateSvgMarkup90CW(svgMarkup, template.width, template.height)
      ;[cardWidthPt, cardHeightPt] = [cardHeightPt, cardWidthPt]
    }

    cardEntries.push({ svgMarkup, cardWidthPt, cardHeightPt })
  }

  const pageGroups = new Map<number, CardPosition[]>()
  for (const pos of positions) {
    if (!pageGroups.has(pos.page)) {
      pageGroups.set(pos.page, [])
    }
    pageGroups.get(pos.page)!.push(pos)
  }

  let isFirstPage = true
  for (const [_pageNum, pagePositions] of pageGroups) {
    if (!isFirstPage) {
      pdf.addPage([pageWidth, pageHeight], getPageOrientation(pageWidth, pageHeight))
    }
    isFirstPage = false

    for (const pos of pagePositions) {
      if (pos.cardIndex >= cardEntries.length) break
      const entry = cardEntries[pos.cardIndex]
      if (!entry) continue

      const scale = Math.min(pos.width / entry.cardWidthPt, pos.height / entry.cardHeightPt)
      const drawWidth = entry.cardWidthPt * scale
      const drawHeight = entry.cardHeightPt * scale
      const offsetX = pos.x + (pos.width - drawWidth) / 2
      const offsetY = pos.y + (pos.height - drawHeight) / 2
      await drawSvgMarkupOnPdf(pdf, entry.svgMarkup, offsetX, offsetY, drawWidth, drawHeight)
    }
  }

  downloadBlob(
    pdf.output('blob'),
    `${defaultTemplate?.name.replace(/\.svg$/i, '') || 'id-cards'}-${layout.name.replace(/[^a-z0-9]/gi, '-')}.pdf`,
  )
}

function createVectorPdfDocument(pageWidth: number, pageHeight: number): jsPDF {
  return new jsPDF({
    orientation: getPageOrientation(pageWidth, pageHeight),
    unit: 'pt',
    format: [pageWidth, pageHeight],
    compress: true,
    putOnlyUsedFonts: true,
  })
}

function getPageOrientation(pageWidth: number, pageHeight: number): 'portrait' | 'landscape' {
  return pageWidth > pageHeight ? 'landscape' : 'portrait'
}

async function drawSvgMarkupOnPdf(
  pdf: jsPDF,
  svgMarkup: string,
  x: number,
  y: number,
  width: number,
  height: number,
): Promise<void> {
  let markup = svgMarkup
  if (_outlineFontBuffers && _outlineFontBuffers.size > 0) {
    markup = await convertTextToOutlines(markup, _outlineFontBuffers)
  }
  const svgElement = parseSvgMarkup(markup)
  await pdf.svg(svgElement, {
    x,
    y,
    width,
    height,
    loadExternalStyleSheets: false,
  })
}

function parseSvgMarkup(svgMarkup: string): SVGElement {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgMarkup, 'image/svg+xml')
  return doc.documentElement as unknown as SVGElement
}

function rotateSvgMarkup90CW(svgMarkup: string, fallbackWidth: number, fallbackHeight: number): string {
  const parser = new DOMParser()
  const originalDoc = parser.parseFromString(svgMarkup, 'image/svg+xml')
  const originalRoot = originalDoc.documentElement
  const { width, height } = getSvgSourceSize(originalRoot, fallbackWidth, fallbackHeight)
  const wrapperDoc = parser.parseFromString(
    `<svg xmlns="${SVG_NS}" xmlns:xlink="${XLINK_NS}" viewBox="0 0 ${height} ${width}" width="${height}" height="${width}"></svg>`,
    'image/svg+xml',
  )
  const wrapperRoot = wrapperDoc.documentElement
  const group = wrapperDoc.createElementNS(SVG_NS, 'g')
  group.setAttribute('transform', `translate(${height} 0) rotate(90)`)

  const nestedSvg = wrapperDoc.importNode(originalRoot, true) as Element
  nestedSvg.setAttribute('x', '0')
  nestedSvg.setAttribute('y', '0')
  nestedSvg.setAttribute('width', String(width))
  nestedSvg.setAttribute('height', String(height))
  if (!nestedSvg.getAttribute('viewBox')) {
    nestedSvg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  }

  group.appendChild(nestedSvg)
  wrapperRoot.appendChild(group)
  return new XMLSerializer().serializeToString(wrapperRoot)
}

function getSvgSourceSize(svgRoot: Element, fallbackWidth: number, fallbackHeight: number): { width: number; height: number } {
  const viewBox = svgRoot.getAttribute('viewBox')
  if (viewBox) {
    const parts = viewBox.split(/[\s,]+/).map(Number)
    if (parts.length === 4 && Number.isFinite(parts[2]) && Number.isFinite(parts[3]) && parts[2] > 0 && parts[3] > 0) {
      return { width: parts[2], height: parts[3] }
    }
  }

  const width = parseFloat(svgRoot.getAttribute('width') ?? '')
  const height = parseFloat(svgRoot.getAttribute('height') ?? '')
  return {
    width: Number.isFinite(width) && width > 0 ? width : fallbackWidth,
    height: Number.isFinite(height) && height > 0 ? height : fallbackHeight,
  }
}

function downloadBlob(blob: Blob, fileName: string): void {
  const downloadUrl = URL.createObjectURL(blob)
  const downloadLink = document.createElement('a')
  downloadLink.href = downloadUrl
  downloadLink.download = fileName
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
  colorProfile?: ColorProfile | null,
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
    const svgMarkup = renderCardSvgMarkup(template, fields, cardData, colorProfile)
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
      color: correctColorValue(field.color ?? '#000000', colorProfile),
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
