import { useEffect, useState } from 'react'

import type { CardDesign, FieldDefinition, TemplateMeta } from '../lib/types'
import type { TemplateSummary } from '../lib/templates'
import { loadTemplateSvgContent } from '../lib/templates'
import { parseTemplateString, renderSvgWithData } from '../lib/svgTemplate'
import { generateAutoMappings } from '../lib/autoMapping'
import { renderCanvasDesignSide } from '../lib/canvasDesign'
import { useStorage } from '../lib/storage'
import type { StorageProvider } from '../lib/storage'

/**
 * The back of the card design that is open in the Export tab, ready to print.
 *
 * The back is a second piece of artwork with its own placeholders, so it needs
 * its own fields and mappings — the front's would not match its layers.
 */
export type ExportBackSide = {
  /** The saved template the back came from, or null for a canvas design. */
  templateId: string | null
  meta: TemplateMeta
  fields: FieldDefinition[]
  fieldMappings: Record<string, string>
  customValues: Record<string, string>
  /** The back rendered with no data, for the layout preview. */
  svg: string
}

async function loadMappings(
  storage: StorageProvider,
  templateId: string | null,
  fields: FieldDefinition[],
): Promise<{ fieldMappings: Record<string, string>; customValues: Record<string, string> }> {
  const fieldMappings: Record<string, string> = {}
  const customValues: Record<string, string> = {}

  if (templateId) {
    try {
      const saved = await storage.getFieldMappings(templateId)
      saved.forEach((mapping) => {
        fieldMappings[mapping.svgLayerId] = mapping.standardFieldName
        if (mapping.customValue) {
          customValues[mapping.svgLayerId] = mapping.customValue
        }
      })
    } catch (error) {
      console.error('Failed to load field mappings for the back of the card:', error)
    }
  }

  if (Object.keys(fieldMappings).length === 0) {
    generateAutoMappings(fields).forEach((mapping) => {
      fieldMappings[mapping.svgLayerId] = mapping.standardFieldName
      if (mapping.customValue) {
        customValues[mapping.svgLayerId] = mapping.customValue
      }
    })
  }

  return { fieldMappings, customValues }
}

/**
 * Resolve the back of a card design so a print slot can be set to it. Handles
 * both kinds of design: one built from a pair of templates, and one drawn in
 * the card designer.
 */
export function useExportBackSide(
  design: CardDesign | null,
  designTemplates: TemplateSummary[],
): { backSide: ExportBackSide | null; loading: boolean; error: string | null } {
  const storage = useStorage()
  const [backSide, setBackSide] = useState<ExportBackSide | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const backTemplateId = design?.backTemplateId ?? null
  const backCanvasData = design?.backCanvasData ?? null
  const isCanvas = design?.designerMode === 'canvas'

  useEffect(() => {
    let cancelled = false

    if (!design || (isCanvas ? !backCanvasData : !backTemplateId)) {
      setBackSide(null)
      setLoading(false)
      setError(null)
      return () => { cancelled = true }
    }

    setLoading(true)
    setError(null)

    const resolve = async (): Promise<ExportBackSide> => {
      if (isCanvas) {
        const rendered = await renderCanvasDesignSide(design, 'back')
        const { fieldMappings, customValues } = await loadMappings(storage, null, rendered.fields)
        return {
          templateId: null,
          meta: rendered.meta,
          fields: rendered.fields,
          fieldMappings,
          customValues,
          svg: rendered.svg,
        }
      }

      const summary = designTemplates.find((t) => t.id === backTemplateId)
      if (!summary) {
        throw new Error('The back template of this card design is missing from the library.')
      }

      const svgText = await loadTemplateSvgContent(summary)
      const { metadata, autoFields } = await parseTemplateString(svgText, summary.name)
      const { fieldMappings, customValues } = await loadMappings(storage, summary.id, autoFields)

      let svg = metadata.rawSvg
      try {
        svg = renderSvgWithData(metadata, autoFields, {})
      } catch (renderError) {
        console.error('Failed to render the back of the card:', renderError)
      }

      return {
        templateId: summary.id,
        meta: metadata,
        fields: autoFields,
        fieldMappings,
        customValues,
        svg,
      }
    }

    resolve()
      .then((resolved) => {
        if (cancelled) return
        setBackSide(resolved)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Failed to prepare the back of the card for export:', err)
        setBackSide(null)
        setError(err instanceof Error ? err.message : 'Failed to load the back of the card.')
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [design, isCanvas, backTemplateId, backCanvasData, designTemplates, storage])

  return { backSide, loading, error }
}
