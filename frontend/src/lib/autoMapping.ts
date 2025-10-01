import type { FieldDefinition } from './types'
import type { FieldMapping } from '../components/FieldMappingDialog'

const STANDARD_FIELDS = [
  // Individual name fields
  'firstName', 'firstName_AllCaps', 'firstName_TitleCase',
  'lastName', 'lastName_AllCaps', 'lastName_TitleCase',
  'middleName', 'middleName_AllCaps', 'middleName_TitleCase',
  'middleInitial', 'middleInitial_AllCaps',

  // Composite name fields (First-Last Order)
  'fullName_First_Last', 'fullName_First_Last_AllCaps',
  'fullName_First_MiddleInitial_Last', 'fullName_First_MiddleInitial_Last_AllCaps',
  'fullName_First_Middle_Last', 'fullName_First_Middle_Last_AllCaps',

  // Composite name fields (Last-First with Comma)
  'fullName_Last_Comma_First', 'fullName_Last_Comma_First_AllCaps',
  'fullName_Last_Comma_First_MiddleInitial', 'fullName_Last_Comma_First_MiddleInitial_AllCaps',
  'fullName_Last_Comma_First_Middle', 'fullName_Last_Comma_First_Middle_AllCaps',

  // Other fields
  'studentId', 'department', 'position', 'grade', 'email', 'phoneNumber',
  'address', 'emergencyContact', 'issueDate', 'expiryDate', 'birthDate',

  // Image fields
  'photo', 'signature', 'logo',
]

const CUSTOM_STATIC_VALUE = '__custom__'

/**
 * Generate auto-mappings for fields based on their sourceId
 * Returns array of FieldMapping objects
 */
export function generateAutoMappings(fields: FieldDefinition[]): FieldMapping[] {
  const mappings: FieldMapping[] = []

  fields.forEach(field => {
    const fieldId = field.sourceId || field.id
    const normalizedId = fieldId.toLowerCase()
    let mapping: FieldMapping | null = null

    // Exact match
    if (STANDARD_FIELDS.includes(fieldId)) {
      mapping = { svgLayerId: fieldId, standardFieldName: fieldId }
    }
    // Case-insensitive match
    else {
      const matchingField = STANDARD_FIELDS.find(sf => sf.toLowerCase() === normalizedId)
      if (matchingField) {
        mapping = { svgLayerId: fieldId, standardFieldName: matchingField }
      }
      // Special mappings for common variations
      else if (normalizedId === 'profilephoto' || normalizedId === 'profile' || normalizedId === 'userphoto') {
        mapping = { svgLayerId: fieldId, standardFieldName: 'photo' }
      }
      else if (normalizedId === 'studentid' || normalizedId === 'student_id' || normalizedId === 'id') {
        mapping = { svgLayerId: fieldId, standardFieldName: 'studentId' }
      }
      else if (normalizedId === 'fullname' || normalizedId === 'name') {
        mapping = { svgLayerId: fieldId, standardFieldName: 'fullName_Last_Comma_First_MiddleInitial_AllCaps' }
      }
      // If field starts with "custom", auto-map to Custom Static Text with existing label
      else if (normalizedId.startsWith('custom')) {
        mapping = {
          svgLayerId: fieldId,
          standardFieldName: CUSTOM_STATIC_VALUE,
          customValue: field.label || ''
        }
      }
    }

    if (mapping) {
      mappings.push(mapping)
    }
  })

  return mappings
}

/**
 * Check if a field would be auto-mapped
 */
export function isAutoMappable(field: FieldDefinition): boolean {
  const sourceId = field.sourceId || field.id
  const normalizedId = sourceId.toLowerCase()

  // Exact match with standard field
  if (STANDARD_FIELDS.includes(sourceId)) {
    return true
  }
  // Case-insensitive match
  if (STANDARD_FIELDS.some(sf => sf.toLowerCase() === normalizedId)) {
    return true
  }
  // Special variations
  if (normalizedId === 'profilephoto' || normalizedId === 'profile' || normalizedId === 'userphoto') {
    return true
  }
  if (normalizedId === 'studentid' || normalizedId === 'student_id' || normalizedId === 'id') {
    return true
  }
  if (normalizedId === 'fullname' || normalizedId === 'name') {
    return true
  }
  // Custom fields (starts with "custom")
  if (normalizedId.startsWith('custom')) {
    return true
  }

  return false
}
