import { useId, useMemo } from 'react'
import type { CSSProperties } from 'react'

import { renderCardSvg, type CardFace, type CardPackage, type CardPerson } from '../lib/cardPrint'
import { scopeSvgElement, toSvgScopePrefix } from '../lib/svgTemplate'

export type CardPreviewProps = {
  card: CardPackage
  face?: CardFace
  /** The values to show; the package's own sample when left out. */
  person?: CardPerson
  /** Read out in place of the picture. Defaults to the card's name and face. */
  label?: string
  className?: string
  style?: CSSProperties
}

/**
 * One face of a card, filled, drawn inline so it uses the fonts the package
 * registered. It has no look of its own: the artwork fills the element's width
 * at its own proportions, and the host styles the box (`className`, `style`).
 * Ids and classes inside the artwork are scoped to this element, so a front and
 * a back can share a page.
 */
export function CardPreview({ card, face = 'front', person, label, className, style }: CardPreviewProps) {
  const instance = useId()
  const markup = useMemo(() => {
    let svg: string
    try {
      svg = renderCardSvg(card, face, person ?? card.sample)
    } catch (error) {
      console.error(`Could not draw the ${face} of "${card.name}"`, error)
      return ''
    }
    if (!svg) return ''
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
    const root = doc.documentElement
    scopeSvgElement(root, toSvgScopePrefix(`${face}${instance}`))
    root.setAttribute('width', '100%')
    root.removeAttribute('height')
    root.setAttribute('style', 'display:block;width:100%;height:auto')
    root.setAttribute('aria-hidden', 'true')
    return new XMLSerializer().serializeToString(root)
  }, [card, face, person, instance])

  return (
    <div
      role="img"
      aria-label={label ?? `${card.name}, ${face}`}
      className={['tp-card-preview', className].filter(Boolean).join(' ')}
      style={style}
      data-face={face}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  )
}
