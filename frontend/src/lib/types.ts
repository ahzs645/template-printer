import type { TemplateSummary } from './templates'

export type FieldType = 'text' | 'image' | 'barcode' | 'date'

export type TemplateMeta = {
  name: string
  width: number
  height: number
  unit: 'px' | 'mm'
  viewBox?: {
    x: number
    y: number
    width: number
    height: number
  }
  rawSvg: string
  objectUrl: string
  fonts: string[]
}

export type ImageValue = {
  src: string
  offsetX?: number
  offsetY?: number
  scale?: number
}

export type CardDataValue = string | ImageValue

export type FieldDefinition = {
  id: string
  label: string
  type: FieldType
  x: number
  y: number
  width?: number
  height?: number
  fontSize?: number
  color?: string
  align?: 'left' | 'center' | 'right'
  auto?: boolean
  fontFamily?: string
  fontWeight?: number
  sourceId?: string
}

export type CardData = Record<string, CardDataValue>

export type TemplateExtractionResult = {
  metadata: TemplateMeta
  autoFields: FieldDefinition[]
}

export type CardDesignMode = 'template' | 'canvas'

export type PrintLayout = {
  id: string
  sourceId?: number | null
  name: string
  pageWidth: string
  pageHeight: string
  orientation: 'P' | 'L'
  cardsPerRow: number
  cardsPerPage: number
  pageMarginTop: string
  pageMarginLeft: string
  cardMarginRight: string
  cardMarginBottom: string
  cardWidth: string
  cardHeight: string
  bleedWidth: string
  bleedHeight: string
  paperSize?: string | null
  printMedia?: string | null
  instructions?: string | null
  isBuiltin: boolean
  createdAt?: string | null
}

export type CardDesign = {
  id: string
  name: string
  description?: string | null
  // Template-based design (existing)
  frontTemplateId: string | null
  backTemplateId: string | null
  frontTemplate?: TemplateSummary | null
  backTemplate?: TemplateSummary | null
  // Canvas-based design (new)
  designerMode?: CardDesignMode
  frontCanvasData?: string | null   // Fabric.js JSON
  backCanvasData?: string | null    // Fabric.js JSON
  cardWidth?: number                // mm (default: 86)
  cardHeight?: number               // mm (default: 54)
  // Timestamps
  createdAt?: string | null
  updatedAt?: string | null
}
