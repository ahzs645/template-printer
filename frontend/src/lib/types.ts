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
