/**
 * Sizing the card preview in the editor.
 *
 * The preview is sized by its width; everything else (its height, the other
 * side's box, the field overlays) follows from that. The default is to fit the
 * whole card, both sides of it, in the space the canvas has, and zoom scales
 * from there.
 */

/**
 * The other side's box as multiples of this side's width. It is drawn at the
 * same scale: the same width when both sides run the same way, or the same
 * long edge when one is portrait and the other landscape (a landscape back on
 * a portrait badge).
 */
export function otherSideScale(ratio: number, otherAspect: number): { width: number; height: number } {
  const thisLandscape = ratio <= 1
  const otherLandscape = otherAspect >= 1
  if (thisLandscape === otherLandscape) return { width: 1, height: 1 / otherAspect }
  const longEdge = Math.max(1, ratio)
  return otherLandscape
    ? { width: longEdge, height: longEdge / otherAspect }
    : { width: longEdge * otherAspect, height: longEdge }
}

export type PreviewFitInput = {
  /** The space the canvas gives the preview, in pixels. */
  availableWidth: number
  availableHeight: number
  /** This side's height over its width. */
  ratio: number
  /** The other side's width over its height, when it is shown beside this one. */
  otherAspect: number | null
  /** Space between the two sides. */
  gap: number
  /** Height taken by what sits above and below a side: its label and buttons. */
  chrome: number
  /** No wider than this by default, however much room there is. */
  maxWidth: number
  minWidth: number
}

export type PreviewFit = {
  width: number
  /** The other side goes under this one rather than beside it. */
  stacked: boolean
}

/**
 * The widest preview at which the card fits the canvas without scrolling:
 * the two sides beside each other, or one above the other when that leaves
 * them bigger (a narrow window, or two wide cards).
 */
export function fitPreviewWidth(input: PreviewFitInput): PreviewFit {
  const { availableWidth, availableHeight, ratio, otherAspect, gap, chrome, maxWidth, minWidth } = input
  const clampWidth = (width: number) => Math.max(minWidth, Math.min(maxWidth, width))

  if (!otherAspect) {
    const width = Math.min(availableWidth, (availableHeight - chrome) / ratio)
    return { width: clampWidth(width), stacked: false }
  }

  const other = otherSideScale(ratio, otherAspect)
  const besideWidth = Math.min(
    (availableWidth - gap) / (1 + other.width),
    (availableHeight - chrome) / Math.max(ratio, other.height),
  )
  const stackedWidth = Math.min(
    availableWidth / Math.max(1, other.width),
    (availableHeight - 2 * chrome - gap) / (ratio + other.height),
  )
  const stacked = stackedWidth > besideWidth
  return { width: clampWidth(stacked ? stackedWidth : besideWidth), stacked }
}

/** Zoom levels the buttons step through, as multiples of the fitted size. */
export const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.9, 1, 1.25, 1.5, 2, 3, 4]

/** The next zoom step in or out from the current zoom, which may sit between steps. */
export function stepZoom(zoom: number, direction: 1 | -1): number {
  if (direction > 0) return ZOOM_STEPS.find((step) => step > zoom + 1e-6) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1]
  return [...ZOOM_STEPS].reverse().find((step) => step < zoom - 1e-6) ?? ZOOM_STEPS[0]
}
