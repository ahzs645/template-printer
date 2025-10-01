import { useState, useEffect, useMemo } from 'react'
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

  // Fetch field mappings when template or mode changes
  useEffect(() => {
    if (mode === 'database' && selectedTemplateId) {
      getFieldMappings(selectedTemplateId)
        .then(mappings => {
          const mappingsMap: Record<string, string> = {}
          mappings.forEach(m => {
            mappingsMap[m.svgLayerId] = m.standardFieldName
          })
          setFieldMappings(mappingsMap)
        })
        .catch(err => {
          console.error('Failed to load field mappings:', err)
        })
    }
  }, [selectedTemplateId, mode])

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
    const firstUser = users.find(u => u.id === firstUserId)

    if (!firstUser || Object.keys(fieldMappings).length === 0) {
      return renderedSvg
    }

    try {
      const previewCardData: CardData = {}

      fields.forEach(field => {
        const standardFieldName = fieldMappings[field.sourceId || ''] || fieldMappings[field.id]
        if (standardFieldName) {
          previewCardData[field.id] = parseField(standardFieldName, firstUser)
        }
      })

      return renderSvgWithData(templateMeta, fields, previewCardData)
    } catch (error) {
      console.error('Failed to generate database mode preview:', error)
      return renderedSvg
    }
  }, [mode, selectedUserIds, templateMeta, users, fieldMappings, fields, renderedSvg])

  return { previewSvg }
}
