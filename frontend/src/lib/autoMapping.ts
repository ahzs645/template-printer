import type { FieldDefinition } from './types'
import type { FieldMapping } from '../components/FieldMappingDialog'
import { CUSTOM_STATIC_VALUE, normalizeStandardFieldName, parseBarcodeLayerId } from './standardFields'

/**
 * Resolve an SVG layer id to a standard field name, including the common
 * variations designers reach for that are not themselves standard names.
 */
function resolveStandardFieldName(layerId: string): string | null {
  const standard = normalizeStandardFieldName(layerId)
  if (standard) return standard

  // barcode_<symbology>_<fieldName> encodes that field's value.
  const barcode = parseBarcodeLayerId(layerId)
  if (barcode?.standardFieldName) return barcode.standardFieldName

  const normalizedId = layerId.toLowerCase()

  if (normalizedId === 'profilephoto' || normalizedId === 'profile' || normalizedId === 'userphoto') {
    return 'photo'
  }
  if (normalizedId === 'studentid' || normalizedId === 'student_id' || normalizedId === 'id') {
    return 'studentId'
  }
  if (normalizedId === 'fullname' || normalizedId === 'name') {
    return 'fullName_Last_Comma_First_MiddleInitial_AllCaps'
  }

  return null
}

/**
 * Generate auto-mappings for fields based on their sourceId
 * Returns array of FieldMapping objects
 */
export function generateAutoMappings(fields: FieldDefinition[]): FieldMapping[] {
  const mappings: FieldMapping[] = []

  fields.forEach(field => {
    const fieldId = field.sourceId || field.id
    const standardFieldName = resolveStandardFieldName(fieldId)

    if (standardFieldName) {
      mappings.push({ svgLayerId: fieldId, standardFieldName })
      return
    }

    // Layers starting with "custom" become static text seeded with the
    // placeholder text already in the artwork.
    if (fieldId.toLowerCase().startsWith('custom')) {
      mappings.push({
        svgLayerId: fieldId,
        standardFieldName: CUSTOM_STATIC_VALUE,
        customValue: field.label || '',
      })
    }
  })

  return mappings
}

/**
 * Check if a field would be auto-mapped
 */
export function isAutoMappable(field: FieldDefinition): boolean {
  const sourceId = field.sourceId || field.id
  return resolveStandardFieldName(sourceId) !== null || sourceId.toLowerCase().startsWith('custom')
}
