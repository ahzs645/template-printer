import { useState, useEffect, useMemo, useCallback } from 'react'
import type { CardData, FieldDefinition } from '../lib/types'
import type { UserData } from '../lib/fieldParser'
import { parseField } from '../lib/fieldParser'
import { renderSvgWithData } from '../lib/svgTemplate'
import { getFieldMappings } from '../lib/api'
import type { ExportMode } from '../components/ExportPage'

type UseExportPreviewParams = {
  mode: ExportMode
  templateMeta: any
  selectedTemplateId: string | null
  selectedUserIds: string[]
  users: UserData[]
  fields: FieldDefinition[]
  renderedSvg: string | null
}

export function useExportPreview({
  mode,
  templateMeta,
  selectedTemplateId,
  selectedUserIds,
  users,
  fields,
  renderedSvg,
}: UseExportPreviewParams) {
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({})
  const [customValues, setCustomValues] = useState<Record<string, string>>({})

  // Fetch field mappings when template or mode changes
  useEffect(() => {
    if (mode === 'database' && selectedTemplateId) {
      getFieldMappings(selectedTemplateId)
        .then(mappings => {
          const mappingsMap: Record<string, string> = {}
          const customValuesMap: Record<string, string> = {}
          mappings.forEach(m => {
            mappingsMap[m.svgLayerId] = m.standardFieldName
            if (m.customValue) {
              customValuesMap[m.svgLayerId] = m.customValue
            }
          })
          setFieldMappings(mappingsMap)
          setCustomValues(customValuesMap)
        })
        .catch(err => {
          console.error('Failed to load field mappings:', err)
        })
    }
  }, [selectedTemplateId, mode])

  const renderCardForUser = useCallback(
    (userId: string | null | undefined): string | null => {
      if (mode === 'quick') {
        return renderedSvg
      }

      if (!templateMeta || !userId) {
        return renderedSvg
      }

      const user = users.find(u => u.id === userId)
      if (!user || Object.keys(fieldMappings).length === 0) {
        return renderedSvg
      }

      try {
        const cardData: CardData = {}

        fields.forEach(field => {
          const layerId = field.sourceId || field.id
          const standardFieldName = fieldMappings[layerId]
          if (standardFieldName) {
            const customValue = customValues[layerId]
            cardData[field.id] = parseField(standardFieldName, user, customValue)
          }
        })

        return renderSvgWithData(templateMeta, fields, cardData)
      } catch (error) {
        console.error('Failed to render card for user:', error)
        return renderedSvg
      }
    },
    [mode, templateMeta, users, fieldMappings, customValues, fields, renderedSvg],
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

  return { previewSvg, renderCardForUser }
}
