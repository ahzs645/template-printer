import type { CardDesign, FieldDefinition, TemplateMeta } from './types'
import { parseTemplateString } from './svgTemplate'
import { generateSvgFromCanvasData } from '../components/card-designer/utils/fabricToSvg'

export type CanvasDesignSide = 'front' | 'back'

export type CanvasDesignRenderResult = {
  svg: string
  meta: TemplateMeta
  fields: FieldDefinition[]
}

export function getCanvasDesignSideData(
  design: CardDesign,
  side: CanvasDesignSide,
): string | null | undefined {
  return side === 'front' ? design.frontCanvasData : design.backCanvasData
}

export function hasCanvasDesignSide(design: CardDesign, side: CanvasDesignSide): boolean {
  return Boolean(getCanvasDesignSideData(design, side))
}

export async function renderCanvasDesignSide(
  design: CardDesign,
  side: CanvasDesignSide = 'front',
): Promise<CanvasDesignRenderResult> {
  const canvasData = getCanvasDesignSideData(design, side)
  if (!canvasData) {
    throw new Error(`No ${side} canvas design data.`)
  }

  const cardWidth = design.cardWidth ?? 86
  const cardHeight = design.cardHeight ?? 54
  const svg = await generateSvgFromCanvasData(canvasData, cardWidth, cardHeight)
  const { metadata, autoFields } = await parseTemplateString(svg, `${design.name} ${side}`)

  return {
    svg,
    meta: {
      ...metadata,
      name: design.name,
      width: cardWidth,
      height: cardHeight,
      unit: 'mm',
      rawSvg: svg,
    },
    fields: autoFields,
  }
}
