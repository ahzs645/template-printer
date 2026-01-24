import type { FabricObject } from 'fabric'

// Element types supported by the designer
export type DesignerElementType =
  | 'text'
  | 'dynamic-text'
  | 'image-placeholder'
  | 'rectangle'
  | 'circle'
  | 'line'
  | 'barcode'

// Configuration for dynamic text fields
export type DynamicTextConfig = {
  fieldId: string
  defaultText: string
}

// Configuration for image placeholder fields
export type ImagePlaceholderConfig = {
  fieldId: string
  fitMode: 'cover' | 'contain' | 'fill'
}

// Configuration for barcode fields
export type BarcodeConfig = {
  fieldId: string
  barcodeType: 'code128' | 'qr' | 'ean13'
}

// Custom data attached to Fabric.js objects
export type DesignerObjectData = {
  elementType: DesignerElementType
  fieldId?: string
  isDynamic?: boolean
  dynamicConfig?: DynamicTextConfig
  imagePlaceholderConfig?: ImagePlaceholderConfig
  barcodeConfig?: BarcodeConfig
}

// Card side type
export type CardSide = 'front' | 'back'

// Card dimensions preset
export type CardPreset = {
  name: string
  width: number  // mm
  height: number // mm
}

// Standard card presets
export const CARD_PRESETS: CardPreset[] = [
  { name: 'CR80 (Standard)', width: 85.6, height: 53.98 },
  { name: 'CR80 Rounded', width: 86, height: 54 },
  { name: 'CR79', width: 83.9, height: 51 },
  { name: 'CR100', width: 100, height: 70 },
  { name: 'Custom', width: 86, height: 54 },
]

// Canvas state for a single side
export type CanvasSideState = {
  json: string | null
  objects: FabricObject[]
}

// Designer state
export type DesignerState = {
  activeSide: CardSide
  cardWidth: number
  cardHeight: number
  front: CanvasSideState
  back: CanvasSideState
  selectedObjectIds: string[]
  zoom: number
  showGrid: boolean
  snapToGrid: boolean
  gridSize: number
}

// Toolbar action types
export type ToolbarAction =
  | { type: 'add-text' }
  | { type: 'add-dynamic-text'; fieldId: string }
  | { type: 'add-image-placeholder'; fieldId: string }
  | { type: 'add-rectangle' }
  | { type: 'add-circle' }
  | { type: 'add-line' }
  | { type: 'add-barcode'; fieldId: string; barcodeType: 'code128' | 'qr' }

// Property types for the properties panel
export type CommonProperties = {
  left: number
  top: number
  width: number
  height: number
  angle: number
  opacity: number
  visible: boolean
  locked: boolean
}

export type TextProperties = CommonProperties & {
  text: string
  fontFamily: string
  fontSize: number
  fontWeight: number | string
  fontStyle: 'normal' | 'italic'
  fill: string
  textAlign: 'left' | 'center' | 'right'
  underline: boolean
}

export type ShapeProperties = CommonProperties & {
  fill: string
  stroke: string
  strokeWidth: number
  rx?: number // corner radius for rect
  ry?: number
}

export type ImagePlaceholderProperties = CommonProperties & {
  fieldId: string
  fitMode: 'cover' | 'contain' | 'fill'
  stroke: string
  strokeWidth: number
  strokeDashArray: number[] | null
}

// Default values for new elements
export const DEFAULT_TEXT_PROPS: Partial<TextProperties> = {
  fontFamily: 'Arial',
  fontSize: 24,
  fontWeight: 'normal',
  fontStyle: 'normal',
  fill: '#000000',
  textAlign: 'left',
  underline: false,
  opacity: 1,
}

export const DEFAULT_SHAPE_PROPS: Partial<ShapeProperties> = {
  fill: '#3b82f6',
  stroke: '#1e40af',
  strokeWidth: 0,
  opacity: 1,
}

export const DEFAULT_IMAGE_PLACEHOLDER_PROPS: Partial<ImagePlaceholderProperties> = {
  fill: '#f3f4f6',
  stroke: '#9ca3af',
  strokeWidth: 2,
  strokeDashArray: [5, 5],
  opacity: 1,
  fitMode: 'cover',
}
