import { useId, useMemo } from 'react'
import type { CSSProperties } from 'react'

import { scopeSvgMarkup, toSvgScopePrefix } from '../lib/svgTemplate'

export type InlineSvgProps = {
  /** SVG source to inject. */
  markup: string
  /**
   * Short label distinguishing this SVG from others on the page ("front",
   * "back", "slot3"). Combined with a per-instance id to build the scope.
   */
  name: string
  className?: string
  style?: CSSProperties
}

/**
 * Inject an SVG into the page with its ids and CSS classes scoped to this
 * instance.
 *
 * An inline <style> block is document-global, and vector editors reuse the same
 * generic class names (`cls-1`, `cls-2`, …) in every file they export. Two
 * inlined SVGs therefore overwrite each other's styling, and duplicate ids break
 * `url(#…)` references. Anywhere more than one SVG can share a document, inject
 * it through this component rather than `dangerouslySetInnerHTML`.
 */
export function InlineSvg({ markup, name, className, style }: InlineSvgProps) {
  const instanceId = useId()
  const scoped = useMemo(
    () => scopeSvgMarkup(markup, toSvgScopePrefix(`${name}${instanceId}`)),
    [markup, name, instanceId],
  )

  return <div className={className} style={style} dangerouslySetInnerHTML={{ __html: scoped }} />
}
