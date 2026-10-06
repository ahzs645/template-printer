/**
 * Placing one rendered card into a slot of a print-layout preview.
 *
 * The card's viewBox is honoured: copying its children across as they are
 * keeps the card's own coordinates, so artwork whose viewBox does not start at
 * 0,0 (anything cut from a larger artboard) would land somewhere off the page.
 * Whatever lies outside the card is clipped.
 *
 * What is fitted to the slot is the card itself — its trim box when the file
 * declares one — not the bleed around it, matching how the exporter sizes it.
 * A card that fits the slot better turned (a portrait badge in a landscape
 * tray) is turned, as the exporter does.
 */

import { readDeclaredCardArea, type Box } from './cardTrim'
import { scopeSvgElement } from './svgTemplate'

const SVG_NS = 'http://www.w3.org/2000/svg'

function viewBoxOf(svg: Element): Box {
  const parts = svg.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number)
  if (parts && parts.length === 4 && parts.every(Number.isFinite) && parts[2] > 0 && parts[3] > 0) {
    return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] }
  }
  const width = parseFloat(svg.getAttribute('width') ?? '') || 100
  const height = parseFloat(svg.getAttribute('height') ?? '') || 100
  return { x: 0, y: 0, width, height }
}

/** The part of a card's artwork that is the card, in its own units. */
export function cardBoxOf(svg: Element): Box {
  const canvas = viewBoxOf(svg)
  return readDeclaredCardArea(svg, canvas, { width: 0, height: 0, unit: 'px' })?.trimBox ?? canvas
}

/** Whether a card fits a slot noticeably better turned a quarter turn. */
export function fitsBetterRotated(cardWidth: number, cardHeight: number, slotWidth: number, slotHeight: number): boolean {
  const normal = Math.min(slotWidth / cardWidth, slotHeight / cardHeight)
  const rotated = Math.min(slotWidth / cardHeight, slotHeight / cardWidth)
  return rotated > normal * 1.05
}

export function placeCardInSlot(
  doc: Document,
  cardSvg: Element,
  slot: { x: number; y: number; width: number; height: number },
  idPrefix: string,
  { allowRotate = true }: { allowRotate?: boolean } = {},
): Element {
  const box = cardBoxOf(cardSvg)
  const rotate = allowRotate && fitsBetterRotated(box.width, box.height, slot.width, slot.height)
  const footprintWidth = rotate ? box.height : box.width
  const footprintHeight = rotate ? box.width : box.height
  const scale = Math.min(slot.width / footprintWidth, slot.height / footprintHeight)
  const height = box.height * scale
  const offsetX = slot.x + (slot.width - footprintWidth * scale) / 2
  const offsetY = slot.y + (slot.height - footprintHeight * scale) / 2

  const clone = cardSvg.cloneNode(true) as Element
  scopeSvgElement(clone, idPrefix)

  // The card's own coordinates, shifted so the card box starts at 0,0 and
  // clipped to it. (A nested <svg> would do this too, but the app's
  // stylesheets size every <svg> inside a preview, nested ones included.)
  const clipId = `${idPrefix}card-clip`
  const clip = doc.createElementNS(SVG_NS, 'clipPath')
  clip.setAttribute('id', clipId)
  clip.setAttribute('clipPathUnits', 'userSpaceOnUse')
  const clipRect = doc.createElementNS(SVG_NS, 'rect')
  for (const [name, value] of Object.entries({ x: box.x, y: box.y, width: box.width, height: box.height })) {
    clipRect.setAttribute(name, String(value))
  }
  clip.appendChild(clipRect)
  const defs = doc.createElementNS(SVG_NS, 'defs')
  defs.appendChild(clip)

  const card = doc.createElementNS(SVG_NS, 'g')
  card.setAttribute('transform', `translate(${-box.x} ${-box.y})`)
  card.setAttribute('clip-path', `url(#${clipId})`)
  card.appendChild(defs)
  for (const child of Array.from(clone.childNodes)) card.appendChild(child.cloneNode(true))

  const group = doc.createElementNS(SVG_NS, 'g')
  group.setAttribute(
    'transform',
    (rotate ? `translate(${offsetX + height} ${offsetY}) rotate(90)` : `translate(${offsetX} ${offsetY})`) +
      ` scale(${scale})`,
  )
  group.appendChild(card)
  return group
}

/**
 * A side's artwork turned a quarter turn when it is the other way round to
 * `target` — a landscape back on a portrait card is printed across the card,
 * so anything showing both sides on one card shape has to turn it to match.
 * Returned unchanged when the orientations already agree.
 */
export function orientLike(svgMarkup: string, target: { width: number; height: number }): string {
  const doc = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml')
  const root = doc.documentElement
  if (!root || root.querySelector('parsererror')) return svgMarkup
  const box = viewBoxOf(root)
  if (box.width >= box.height === target.width >= target.height) return svgMarkup

  const turned = doc.createElementNS(SVG_NS, 'svg')
  for (const attribute of Array.from(root.attributes)) {
    if (!['viewBox', 'width', 'height'].includes(attribute.name)) turned.setAttribute(attribute.name, attribute.value)
  }
  turned.setAttribute('viewBox', `0 0 ${box.height} ${box.width}`)
  const width = root.getAttribute('width')
  const height = root.getAttribute('height')
  if (width && height) {
    turned.setAttribute('width', height)
    turned.setAttribute('height', width)
  }
  const group = doc.createElementNS(SVG_NS, 'g')
  group.setAttribute('transform', `translate(${box.height} 0) rotate(90) translate(${-box.x} ${-box.y})`)
  for (const child of Array.from(root.childNodes)) group.appendChild(child.cloneNode(true))
  turned.appendChild(group)
  return new XMLSerializer().serializeToString(turned)
}
