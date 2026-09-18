/**
 * Working out which part of a template is the card.
 *
 * Artwork exported for card printing is usually drawn on a canvas larger than
 * the card, with a trim line marking where it gets cut and the surrounding
 * margin acting as bleed. Taking the canvas for the card makes everything print
 * oversized: on the reference ID card the canvas is 3.5 x 2.25 in and the trim
 * line is 3.375 x 2.125 in, so the card would come out 3.7% too big.
 *
 * Nothing here is applied automatically. Candidates are detected and offered;
 * the choice of what the card is, and at what size, stays explicit.
 */

const SVG_NS = 'http://www.w3.org/2000/svg'

export type CardFormat = {
  id: string
  label: string
  widthMm: number
  heightMm: number
  note?: string
}

/** The card sizes worth matching against, largest use first. */
export const CARD_FORMATS: CardFormat[] = [
  {
    id: 'id-1',
    label: 'ID-1 / CR80',
    widthMm: 85.725,
    heightMm: 53.975,
    note: 'The bank-card size. 3.375 × 2.125 in.',
  },
  { id: 'cr79', label: 'CR79', widthMm: 83.98, heightMm: 51.05, note: 'Adhesive-backed, slightly smaller than CR80.' },
  { id: 'id-2', label: 'ID-2', widthMm: 105, heightMm: 74, note: 'A7. Used for some visas and IDs.' },
  { id: 'id-3', label: 'ID-3', widthMm: 125, heightMm: 88, note: 'B7. Passport-page size.' },
  { id: 'cr100', label: 'CR100', widthMm: 98.5, heightMm: 67, note: 'Oversized badge.' },
]

export type Box = { x: number; y: number; width: number; height: number }

export type TrimCandidate = {
  id: string
  box: Box
  /** How far the box sits inside the canvas on each side, in user units. */
  inset: { top: number; right: number; bottom: number; left: number }
  /** True when the inset is the same all round, which is what bleed looks like. */
  evenInset: boolean
  /** The rectangle carried a stroke, which is how a trim line is usually drawn. */
  stroked: boolean
  /** Closest standard card format by aspect ratio. */
  bestFormat: CardFormat | null
  /** How far the aspect is from that format, as a percentage. */
  aspectErrorPercent: number
}

function aspectOf(box: Box): number {
  return box.height > 0 ? box.width / box.height : 0
}

function closestFormat(box: Box): { format: CardFormat | null; errorPercent: number } {
  const aspect = aspectOf(box)
  if (!aspect) return { format: null, errorPercent: Number.POSITIVE_INFINITY }

  let best: CardFormat | null = null
  let bestError = Number.POSITIVE_INFINITY
  for (const format of CARD_FORMATS) {
    const target = format.widthMm / format.heightMm
    const error = Math.abs(aspect - target) / target
    if (error < bestError) {
      bestError = error
      best = format
    }
  }
  return { format: best, errorPercent: bestError * 100 }
}

function readNumber(value: string | null): number | undefined {
  if (value === null) return undefined
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function hasStroke(element: Element, strokedClasses: Set<string>): boolean {
  const attr = element.getAttribute('stroke')
  if (attr && attr.toLowerCase() !== 'none') return true
  const style = element.getAttribute('style')
  if (style && /stroke\s*:\s*(?!none)[^;]+/i.test(style)) return true
  const classAttr = element.getAttribute('class')
  if (!classAttr) return false
  return classAttr.split(/\s+/).some((name) => strokedClasses.has(name))
}

/** Class names whose CSS rule sets a stroke. */
function collectStrokedClasses(doc: Document): Set<string> {
  const stroked = new Set<string>()
  for (const styleEl of Array.from(doc.querySelectorAll('style'))) {
    const css = styleEl.textContent || ''
    const rulePattern = /([^{}]+)\{([^}]*)\}/g
    let match
    while ((match = rulePattern.exec(css)) !== null) {
      if (!/stroke\s*:\s*(?!none)[^;]+/i.test(match[2])) continue
      const classPattern = /\.(-?[_a-zA-Z][\w-]*)/g
      let classMatch
      while ((classMatch = classPattern.exec(match[1])) !== null) stroked.add(classMatch[1])
    }
  }
  return stroked
}

/** Ignore rectangles too small to be the card, or ones that fill the canvas. */
const MIN_AREA_FRACTION = 0.5
const MAX_AREA_FRACTION = 0.995
/** An inset counts as even when the four sides agree to within this many units. */
const EVEN_INSET_TOLERANCE = 0.5

/**
 * Find rectangles in the artwork that could be the card's trim line.
 *
 * Ranked by how card-shaped they are, whether they are stroked, and whether
 * they sit evenly inside the canvas.
 */
export function detectTrimCandidates(doc: Document, canvas: Box): TrimCandidate[] {
  if (!canvas.width || !canvas.height) return []

  const strokedClasses = collectStrokedClasses(doc)
  const canvasArea = canvas.width * canvas.height
  const seen = new Set<string>()
  const candidates: TrimCandidate[] = []

  for (const element of Array.from(doc.querySelectorAll('rect'))) {
    if (element.closest('defs')) continue
    // A transform would move the rectangle somewhere its attributes do not say.
    if (element.getAttribute('transform')) continue

    const width = readNumber(element.getAttribute('width'))
    const height = readNumber(element.getAttribute('height'))
    if (!width || !height) continue

    const x = readNumber(element.getAttribute('x')) ?? 0
    const y = readNumber(element.getAttribute('y')) ?? 0

    const area = width * height
    if (area < canvasArea * MIN_AREA_FRACTION) continue
    if (area > canvasArea * MAX_AREA_FRACTION) continue

    const key = `${x}:${y}:${width}:${height}`
    if (seen.has(key)) continue
    seen.add(key)

    const inset = {
      left: x - canvas.x,
      top: y - canvas.y,
      right: canvas.x + canvas.width - (x + width),
      bottom: canvas.y + canvas.height - (y + height),
    }
    if (inset.left < -0.01 || inset.top < -0.01 || inset.right < -0.01 || inset.bottom < -0.01) continue

    const insets = [inset.left, inset.top, inset.right, inset.bottom]
    const evenInset = Math.max(...insets) - Math.min(...insets) <= EVEN_INSET_TOLERANCE

    const { format, errorPercent } = closestFormat({ x, y, width, height })

    candidates.push({
      id: key,
      box: { x, y, width, height },
      inset,
      evenInset,
      stroked: hasStroke(element, strokedClasses),
      bestFormat: format,
      aspectErrorPercent: errorPercent,
    })
  }

  return candidates.sort((a, b) => score(b) - score(a))
}

function score(candidate: TrimCandidate): number {
  let value = 0
  // A close aspect match is the strongest signal.
  if (candidate.aspectErrorPercent < 0.5) value += 100
  else if (candidate.aspectErrorPercent < 2) value += 40
  else if (candidate.aspectErrorPercent < 5) value += 10
  if (candidate.stroked) value += 30
  if (candidate.evenInset) value += 20
  return value
}

/**
 * Whether a candidate is worth putting in front of someone unprompted.
 *
 * Deliberately strict: a wrong suggestion about the card's size is worse than
 * no suggestion, because it changes what gets printed.
 */
export function isWorthSuggesting(candidate: TrimCandidate, canvas: Box): boolean {
  if (candidate.aspectErrorPercent > 1) return false
  if (!candidate.stroked && !candidate.evenInset) return false
  // The canvas itself must be a worse match, or there is nothing to fix.
  const canvasMatch = closestFormat(canvas)
  return canvasMatch.errorPercent > candidate.aspectErrorPercent * 2
}

export type CardArea = {
  /** The card's rectangle within the artwork. */
  box: Box
  /** The physical size that rectangle represents. */
  format: CardFormat
  /** Keep the artwork outside the box as bleed, rather than cropping to the box. */
  keepBleed: boolean
}

export type Bleed = { top: number; right: number; bottom: number; left: number }

export type AppliedCardArea = {
  svg: string
  /** Physical size of the resulting artwork, in millimetres. */
  widthMm: number
  heightMm: number
  /** Bleed outside the trim line, in millimetres, when it was kept. */
  bleedMm?: Bleed
  /**
   * The card itself within the resulting artwork, in that artwork's own units.
   * Everything measured from the card's edge — the magnetic stripe, the punch,
   * where a print layout expects the trim to land — works off this, not off the
   * artwork's bounds.
   */
  trimBox: Box
  /** Physical size of that rectangle. */
  trimWidthMm: number
  trimHeightMm: number
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000
}

/**
 * Restate a template in terms of its card area.
 *
 * With `keepBleed` the artwork is left alone and only its physical size is
 * corrected, so the trim line lands at exactly the card's dimensions and the
 * margin is still there to be cut through. Without it, the viewBox is moved
 * onto the trim line and the bleed is cropped away.
 */
export function applyCardArea(rawSvg: string, canvas: Box, area: CardArea): AppliedCardArea {
  const doc = new DOMParser().parseFromString(rawSvg, 'image/svg+xml')
  const root = doc.documentElement
  if (!root || root.querySelector('parsererror')) {
    throw new Error('Could not read the template while setting its card area.')
  }

  const unitsPerMmX = area.box.width / area.format.widthMm
  const unitsPerMmY = area.box.height / area.format.heightMm

  let widthMm: number
  let heightMm: number
  let bleedMm: AppliedCardArea['bleedMm']

  if (area.keepBleed) {
    // Only the declared physical size changes; every coordinate stays put.
    widthMm = canvas.width / unitsPerMmX
    heightMm = canvas.height / unitsPerMmY
    root.setAttribute('viewBox', `${round(canvas.x)} ${round(canvas.y)} ${round(canvas.width)} ${round(canvas.height)}`)
    bleedMm = {
      left: round((area.box.x - canvas.x) / unitsPerMmX),
      right: round((canvas.x + canvas.width - (area.box.x + area.box.width)) / unitsPerMmX),
      top: round((area.box.y - canvas.y) / unitsPerMmY),
      bottom: round((canvas.y + canvas.height - (area.box.y + area.box.height)) / unitsPerMmY),
    }
  } else {
    widthMm = area.format.widthMm
    heightMm = area.format.heightMm
    root.setAttribute('viewBox', `${round(area.box.x)} ${round(area.box.y)} ${round(area.box.width)} ${round(area.box.height)}`)
  }

  root.setAttribute('width', `${round(widthMm)}mm`)
  root.setAttribute('height', `${round(heightMm)}mm`)
  root.setAttributeNS(null, 'data-card-format', area.format.id)

  // Cropping moves the origin onto the trim line, so the card then starts at 0,0.
  const trimBox: Box = area.keepBleed
    ? { ...area.box }
    : { x: 0, y: 0, width: area.box.width, height: area.box.height }

  return {
    svg: new XMLSerializer().serializeToString(root),
    widthMm: round(widthMm),
    heightMm: round(heightMm),
    bleedMm,
    trimBox,
    trimWidthMm: area.format.widthMm,
    trimHeightMm: area.format.heightMm,
  }
}

/**
 * The card's rectangle expressed in millimetres within the artwork.
 *
 * The preview shows the whole artwork, bleed included, so anything drawn over it
 * has to be offset by however much bleed sits above and to the left.
 */
export function trimRectInMm(
  trimBox: Box,
  artwork: Box,
  artworkWidthMm: number,
  artworkHeightMm: number,
): { x: number; y: number; width: number; height: number } {
  const scaleX = artwork.width > 0 ? artworkWidthMm / artwork.width : 0
  const scaleY = artwork.height > 0 ? artworkHeightMm / artwork.height : 0
  return {
    x: (trimBox.x - artwork.x) * scaleX,
    y: (trimBox.y - artwork.y) * scaleY,
    width: trimBox.width * scaleX,
    height: trimBox.height * scaleY,
  }
}

/** A sentence describing what a candidate is. */
export function describeCandidate(candidate: TrimCandidate, canvas: Box): string {
  const format = candidate.bestFormat
  const inset = candidate.evenInset
    ? `${round(candidate.inset.top)} units inside the edge all round`
    : 'inset from the edge'
  const match = format
    ? `${format.label} (${format.widthMm} × ${format.heightMm} mm)`
    : 'no standard card size'
  const canvasIsBigger = candidate.box.width < canvas.width || candidate.box.height < canvas.height
  const bleed = canvasIsBigger ? ', and the rest is bleed' : ''
  return `A ${candidate.stroked ? 'stroked ' : ''}rectangle ${round(candidate.box.width)} × ${round(
    candidate.box.height,
  )} sits ${inset}. Its shape matches ${match}${bleed}.`
}

export { round as roundTrimValue }
