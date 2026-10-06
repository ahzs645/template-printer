import { useEffect, useMemo, useState } from 'react'

import type { CardDesign, TemplateMeta } from '../lib/types'
import type { TemplateSummary } from '../lib/templates'
import type { UserData } from '../lib/fieldParser'
import { loadTemplateSvgContent } from '../lib/templates'
import { parseTemplateString } from '../lib/svgTemplate'
import { getDesignVariants, hasVariants, variantForUser } from '../lib/designVariants'

/**
 * The front artwork each person's card is drawn with, for a design whose
 * variants are chosen per record. Null when the design does not choose per
 * person, so callers draw everyone with the open template as before.
 *
 * Every variant's artwork is loaded up front: the Export preview draws many
 * people at once and cannot wait on storage for each one.
 */
export function useVariantArtwork(
  design: CardDesign | null,
  openTemplateId: string | null,
  openTemplate: TemplateMeta | null,
  templates: TemplateSummary[],
): ((user: UserData) => TemplateMeta | null) | null {
  const [artwork, setArtwork] = useState<Map<string, TemplateMeta> | null>(null)
  const perPerson = Boolean(design?.variantField && hasVariants(design))
  const variants = design ? getDesignVariants(design) : []
  const variantKey = variants.map((variant) => `${variant.id}:${variant.frontTemplateId}`).join('|')

  useEffect(() => {
    let cancelled = false
    if (!perPerson || !design) {
      setArtwork(null)
      return () => { cancelled = true }
    }
    const load = async () => {
      const loaded = new Map<string, TemplateMeta>()
      for (const variant of getDesignVariants(design)) {
        if (!variant.frontTemplateId || variant.frontTemplateId === openTemplateId) continue
        const summary = templates.find((candidate) => candidate.id === variant.frontTemplateId)
        if (!summary) continue
        try {
          const { metadata } = await parseTemplateString(await loadTemplateSvgContent(summary), summary.name)
          loaded.set(variant.id, metadata)
        } catch (error) {
          console.error(`Could not load the "${variant.name}" variant`, error)
        }
      }
      if (!cancelled) setArtwork(loaded)
    }
    void load()
    return () => { cancelled = true }
    // variantKey stands in for the design's variant list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perPerson, variantKey, openTemplateId, templates])

  return useMemo(() => {
    if (!perPerson || !design || !artwork) return null
    return (user: UserData) => {
      const variant = variantForUser(design, user, null)
      if (!variant) return null
      if (variant.frontTemplateId === openTemplateId) return openTemplate
      return artwork.get(variant.id) ?? null
    }
  }, [perPerson, design, artwork, openTemplateId, openTemplate])
}
