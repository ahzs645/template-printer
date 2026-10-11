/**
 * How big the card is, how big the artwork around it is, and where the one sits
 * inside the other — in millimetres.
 *
 * A declared card area says all of that. Without one the artwork still says a
 * lot: a file drawn taller than it is wide is a portrait badge, and an
 * Illustrator export (drawn in points) or a browser export (in CSS pixels) that
 * comes out a few millimetres bigger than a card all round is that card with
 * bleed. Falling back to a landscape ID-1 card regardless squashed portrait
 * artwork sideways, which is what the lanyard view and the guides were showing.
 */

import { trimRectInMm } from './cardTrim'
import { ID1_HEIGHT_MM, ID1_WIDTH_MM } from './cardBlanks'
import type { TemplateMeta } from './types'

export type CardGeometry = {
  card: { width: number; height: number }
  artwork: { width: number; height: number }
  /** Where the card's top-left corner sits inside the artwork. */
  origin: { x: number; y: number }
}

/** The most bleed that still reads as bleed rather than as a different card, per side. */
const MAX_BLEED_MM = 5

const UNITS_PER_INCH = [72, 96]

export function inferCardGeometry(template: TemplateMeta | null | undefined): CardGeometry {
  const landscape = { width: ID1_WIDTH_MM, height: ID1_HEIGHT_MM }
  if (!template) return { card: landscape, artwork: landscape, origin: { x: 0, y: 0 } }

  const artworkBox = template.viewBox ?? { x: 0, y: 0, width: template.width, height: template.height }

  if (template.cardArea) {
    const { trimBox, trimWidthMm, trimHeightMm } = template.cardArea
    const card = { width: trimWidthMm, height: trimHeightMm }
    const artwork =
      template.unit === 'mm' && template.width && template.height
        ? { width: template.width, height: template.height }
        : {
            width: (artworkBox.width * trimWidthMm) / trimBox.width,
            height: (artworkBox.height * trimHeightMm) / trimBox.height,
          }
    // Millimetres per unit come from the card itself, which is right whether
    // the file is drawn in millimetres, pixels or points.
    const rect = trimRectInMm(
      trimBox,
      artworkBox,
      (artworkBox.width * trimWidthMm) / trimBox.width,
      (artworkBox.height * trimHeightMm) / trimBox.height,
    )
    return { card, artwork, origin: { x: rect.x, y: rect.y } }
  }

  if (template.unit === 'mm' && template.width && template.height) {
    const size = { width: template.width, height: template.height }
    return { card: size, artwork: size, origin: { x: 0, y: 0 } }
  }

  const width = artworkBox.width || template.width
  const height = artworkBox.height || template.height
  if (!width || !height) return { card: landscape, artwork: landscape, origin: { x: 0, y: 0 } }

  const portrait = height > width
  const card = portrait ? { width: ID1_HEIGHT_MM, height: ID1_WIDTH_MM } : landscape

  for (const perInch of UNITS_PER_INCH) {
    const artwork = { width: (width * 25.4) / perInch, height: (height * 25.4) / perInch }
    const bleedX = (artwork.width - card.width) / 2
    const bleedY = (artwork.height - card.height) / 2
    if (bleedX >= -0.25 && bleedY >= -0.25 && bleedX <= MAX_BLEED_MM && bleedY <= MAX_BLEED_MM) {
      // Within a quarter of a millimetre is the card itself, drawn to size.
      if (bleedX < 0.25 && bleedY < 0.25) return { card, artwork: card, origin: { x: 0, y: 0 } }
      return { card, artwork, origin: { x: bleedX, y: bleedY } }
    }
  }

  // Nothing to go on but the shape: the whole artwork is the card.
  return { card, artwork: card, origin: { x: 0, y: 0 } }
}
