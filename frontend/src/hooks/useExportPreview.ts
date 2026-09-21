import { useState, useEffect, useMemo, useCallback } from 'react'
import type { CardData, FieldDefinition } from '../lib/types'
import type { UserData } from '../lib/fieldParser'
import { parseField } from '../lib/fieldParser'
import { renderSvgWithData } from '../lib/svgTemplate'
import { generateAutoMappings } from '../lib/autoMapping'
import { useStorage } from '../lib/storage'
import type { ExportMode } from '../components/ExportPage'
import type { ExportBackSide } from './useExportBackSide'

export type CardSide = 'front' | 'back'

type UseExportPreviewParams = {
  mode: ExportMode
  templateMeta: any
  selectedTemplateId: string | null
  selectedUserIds: string[]
  users: UserData[]
  fields: FieldDefinition[]
  renderedSvg: string | null
  /** The other side of the card design, for slots set to print the back. */
  backSide?: ExportBackSide | null
}

export function useExportPreview({
  mode,
  templateMeta,
  selectedTemplateId,
  selectedUserIds,
  users,
  fields,
  renderedSvg,
  backSide = null,
}: UseExportPreviewParams) {
  const storage = useStorage()
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({})
  const [customValues, setCustomValues] = useState<Record<string, string>>({})

  // Fetch field mappings when template or mode changes
  useEffect(() => {
    if (!selectedTemplateId) {
      setFieldMappings({})
      setCustomValues({})
      return
    }

    storage.getFieldMappings(selectedTemplateId)
      .then(mappings => {
        const mappingsMap: Record<string, string> = {}
        const customValuesMap: Record<string, string> = {}
        mappings.forEach(m => {
          mappingsMap[m.svgLayerId] = m.standardFieldName
          if (m.customValue) {
            customValuesMap[m.svgLayerId] = m.customValue
          }
        })

        if (Object.keys(mappingsMap).length === 0) {
          const autoMappings = generateAutoMappings(fields)
          autoMappings.forEach((mapping) => {
            mappingsMap[mapping.svgLayerId] = mapping.standardFieldName
            if (mapping.customValue) {
              customValuesMap[mapping.svgLayerId] = mapping.customValue
            }
          })
        }

        setFieldMappings(mappingsMap)
        setCustomValues(customValuesMap)
      })
      .catch(err => {
        console.error('Failed to load field mappings:', err)
        const fallbackMappings = generateAutoMappings(fields)
        const mappingsMap: Record<string, string> = {}
        const customValuesMap: Record<string, string> = {}
        fallbackMappings.forEach((mapping) => {
          mappingsMap[mapping.svgLayerId] = mapping.standardFieldName
          if (mapping.customValue) {
            customValuesMap[mapping.svgLayerId] = mapping.customValue
          }
        })
        setFieldMappings(mappingsMap)
        setCustomValues(customValuesMap)
      })
  }, [selectedTemplateId, storage, fields])

  const renderCardForUser = useCallback(
    (userId: string | null | undefined, side: CardSide = 'front'): string | null => {
      // The back is its own artwork with its own placeholders, so it renders
      // from the back's fields and mappings rather than the front's.
      const useBack = side === 'back' && Boolean(backSide)
      const sideMeta = useBack ? backSide!.meta : templateMeta
      const sideFields = useBack ? backSide!.fields : fields
      const sideMappings = useBack ? backSide!.fieldMappings : fieldMappings
      const sideCustomValues = useBack ? backSide!.customValues : customValues
      const sideFallback = useBack ? backSide!.svg : renderedSvg

      if (!sideMeta || !userId) {
        return sideFallback
      }

      const user = users.find(u => u.id === userId)
      if (!user || Object.keys(sideMappings).length === 0) {
        return sideFallback
      }

      try {
        const cardData: CardData = {}

        sideFields.forEach(field => {
          const layerId = field.sourceId || field.id
          const standardFieldName = sideMappings[layerId]
          if (standardFieldName) {
            const customValue = sideCustomValues[layerId]
            cardData[field.id] = parseField(standardFieldName, user, customValue)
          }
        })

        return renderSvgWithData(sideMeta, sideFields, cardData)
      } catch (error) {
        console.error('Failed to render card for user:', error)
        return sideFallback
      }
    },
    [templateMeta, users, fieldMappings, customValues, fields, renderedSvg, backSide],
  )

  /**
   * Render one side of the card with data typed in by hand, for a slot whose
   * values differ from the card's own. Falls back to the side's plain preview
   * when rendering is not possible.
   */
  const renderCardWithData = useCallback(
    (cardData: CardData, side: CardSide = 'front'): string | null => {
      const useBack = side === 'back' && Boolean(backSide)
      const sideMeta = useBack ? backSide!.meta : templateMeta
      const sideFields = useBack ? backSide!.fields : fields
      const sideFallback = useBack ? backSide!.svg : renderedSvg

      if (!sideMeta) {
        return sideFallback
      }

      try {
        return renderSvgWithData(sideMeta, sideFields, cardData)
      } catch (error) {
        console.error('Failed to render card with slot data:', error)
        return sideFallback
      }
    },
    [templateMeta, fields, renderedSvg, backSide],
  )

  // Generate preview SVG
  const previewSvg = useMemo(() => {
    if (mode === 'quick') {
      return renderedSvg
    }

    // Database mode preview
    if (!templateMeta || selectedUserIds.length === 0) {
      return renderedSvg
    }

    const firstUserId = selectedUserIds[0]
    return renderCardForUser(firstUserId)
  }, [mode, selectedUserIds, renderCardForUser])

  return { previewSvg, renderCardForUser, renderCardWithData }
}
