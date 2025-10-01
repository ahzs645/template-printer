/**
 * Field Parser - Handles standardized field naming convention
 *
 * Pattern: {fieldType}_{format}_{capitalization}
 *
 * Examples:
 * - fullName_Last_Comma_First_MiddleInitial_AllCaps → "WOLVES, TIMBER J."
 * - fullName_First_MiddleInitial_Last_TitleCase → "Timber J. Wolves"
 * - firstName_AllCaps → "TIMBER"
 * - studentId → "12345"
 * - photo → ImageValue with user's photo
 */

export interface ImageValue {
  src: string
  offsetX?: number
  offsetY?: number
  scale?: number
}

export interface UserData {
  id?: string
  firstName: string
  lastName: string
  middleName?: string | null
  studentId?: string | null
  department?: string | null
  position?: string | null
  grade?: string | null
  email?: string | null
  phoneNumber?: string | null
  address?: string | null
  emergencyContact?: string | null
  photoPath?: string | null
  signaturePath?: string | null
  issueDate?: string | null
  expiryDate?: string | null
  birthDate?: string | null
  metadata?: string | null
}

/**
 * Apply capitalization transformation to text
 */
function applyCapitalization(text: string, capitalization?: string): string {
  if (!capitalization) return text

  switch (capitalization.toLowerCase()) {
    case 'allcaps':
    case 'upper':
      return text.toUpperCase()

    case 'titlecase':
    case 'title':
      return text
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')

    case 'lowercase':
    case 'lower':
      return text.toLowerCase()

    default:
      return text
  }
}

/**
 * Parse a field name and return the value from user data
 *
 * @param fieldName - The standardized field name (e.g., "fullName_Last_Comma_First_MiddleInitial_AllCaps")
 * @param userData - The user data object
 * @returns The formatted field value (string or ImageValue for image fields)
 */
export function parseField(fieldName: string, userData: UserData): string | ImageValue {
  const parts = fieldName.split('_')
  const fieldType = parts[0]

  // Handle image fields (photo, signature, logo, ProfilePhoto)
  if (isImageField(fieldType)) {
    return getImageField(fieldType, userData)
  }

  // Extract capitalization if present (always the last part if it's a capitalization keyword)
  const lastPart = parts[parts.length - 1]
  const capitalizationKeywords = ['allcaps', 'upper', 'titlecase', 'title', 'lowercase', 'lower']
  const capitalization = capitalizationKeywords.includes(lastPart.toLowerCase()) ? lastPart : undefined

  // Get format parts (everything between fieldType and capitalization)
  const formatParts = capitalization
    ? parts.slice(1, -1)
    : parts.slice(1)

  // Simple fields (no formatting)
  if (formatParts.length === 0) {
    const value = getSimpleField(fieldType, userData)
    return capitalization ? applyCapitalization(value, capitalization) : value
  }

  // Complex fields (name formatting)
  if (fieldType === 'fullName') {
    return formatFullName(formatParts, userData, capitalization)
  }

  // Default: try to get as simple field
  const value = getSimpleField(fieldType, userData)
  return capitalization ? applyCapitalization(value, capitalization) : value
}

/**
 * Check if a field type is an image field
 */
function isImageField(fieldType: string): boolean {
  const imageFields = ['photo', 'signature', 'logo', 'profilephoto']
  return imageFields.includes(fieldType.toLowerCase())
}

/**
 * Get image field value from user data
 */
function getImageField(fieldType: string, userData: UserData): ImageValue | string {
  const normalizedType = fieldType.toLowerCase()

  let imagePath: string | null | undefined = null

  switch (normalizedType) {
    case 'photo':
    case 'profilephoto':
      imagePath = userData.photoPath
      break
    case 'signature':
      imagePath = userData.signaturePath
      break
    case 'logo':
      // Logo is not stored per user, would need to be added to UserData interface if needed
      imagePath = null
      break
    default:
      imagePath = null
  }

  if (!imagePath) {
    return '' // Return empty string if no image
  }

  // Return ImageValue object
  return {
    src: imagePath,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  }
}

/**
 * Get a simple field value from user data
 */
function getSimpleField(fieldType: string, userData: UserData): string {
  switch (fieldType) {
    case 'firstName':
      return userData.firstName || ''
    case 'lastName':
      return userData.lastName || ''
    case 'middleName':
      return userData.middleName || ''
    case 'studentId':
      return userData.studentId || ''
    case 'department':
      return userData.department || ''
    case 'position':
      return userData.position || ''
    case 'grade':
      return userData.grade || ''
    case 'email':
      return userData.email || ''
    case 'phoneNumber':
      return userData.phoneNumber || ''
    case 'address':
      return userData.address || ''
    case 'emergencyContact':
      return userData.emergencyContact || ''
    case 'issueDate':
      return userData.issueDate || ''
    case 'expiryDate':
      return userData.expiryDate || ''
    case 'birthDate':
      return userData.birthDate || ''
    default:
      return ''
  }
}

/**
 * Format a full name according to the specified format
 *
 * Supported formats:
 * - Last_Comma_First → "Wolves, Timber"
 * - Last_Comma_First_MiddleInitial → "Wolves, Timber J."
 * - First_Last → "Timber Wolves"
 * - First_MiddleInitial_Last → "Timber J. Wolves"
 * - First_MiddleName_Last → "Timber John Wolves"
 */
function formatFullName(formatParts: string[], userData: UserData, capitalization?: string): string {
  const firstName = userData.firstName || ''
  const lastName = userData.lastName || ''
  const middleName = userData.middleName || ''
  const middleInitial = middleName ? middleName.charAt(0) + '.' : ''

  let result = ''
  let i = 0

  while (i < formatParts.length) {
    const part = formatParts[i].toLowerCase()

    switch (part) {
      case 'first':
        result += firstName
        break

      case 'last':
        result += lastName
        break

      case 'middlename':
        result += middleName
        break

      case 'middleinitial':
        result += middleInitial
        break

      case 'comma':
        result += ','
        break

      default:
        // Unknown part, skip
        break
    }

    // Add space after each part except:
    // - Last part
    // - Before a comma
    // - After a comma (space is added by comma logic)
    if (i < formatParts.length - 1) {
      const nextPart = formatParts[i + 1].toLowerCase()
      if (part !== 'comma' && nextPart !== 'comma') {
        result += ' '
      } else if (part === 'comma') {
        result += ' '
      }
    }

    i++
  }

  return capitalization ? applyCapitalization(result.trim(), capitalization) : result.trim()
}

/**
 * Extract all field references from an SVG string
 * Returns an array of unique field names found in the SVG
 */
export function extractFieldsFromSVG(svgContent: string): string[] {
  const fields = new Set<string>()

  // Match id attributes that could be field names
  const idMatches = svgContent.matchAll(/id="([^"]+)"/g)

  for (const match of idMatches) {
    const id = match[1]
    // Check if it looks like a field name (contains underscore or is a known simple field)
    if (id.includes('_') || isKnownSimpleField(id)) {
      fields.add(id)
    }
  }

  return Array.from(fields)
}

/**
 * Check if a field name is a known simple field
 */
function isKnownSimpleField(fieldName: string): boolean {
  const knownFields = [
    'firstName', 'lastName', 'middleName', 'fullName',
    'studentId', 'department', 'position', 'grade',
    'email', 'phoneNumber', 'address', 'emergencyContact',
    'issueDate', 'expiryDate', 'birthDate',
    'photo', 'signature', 'logo', 'profilephoto', 'ProfilePhoto'
  ]
  return knownFields.includes(fieldName)
}

/**
 * Get suggested field mappings for unrecognized fields
 * This helps with auto-detection during CSV import
 */
export function suggestFieldMapping(csvHeader: string): string | null {
  const normalized = csvHeader.toLowerCase().trim()

  const mappings: Record<string, string> = {
    'first name': 'firstName',
    'firstname': 'firstName',
    'given name': 'firstName',
    'last name': 'lastName',
    'lastname': 'lastName',
    'surname': 'lastName',
    'family name': 'lastName',
    'middle name': 'middleName',
    'middlename': 'middleName',
    'student id': 'studentId',
    'studentid': 'studentId',
    'id': 'studentId',
    'dept': 'department',
    'department': 'department',
    'position': 'position',
    'title': 'position',
    'role': 'position',
    'grade': 'grade',
    'class': 'grade',
    'email': 'email',
    'e-mail': 'email',
    'phone': 'phoneNumber',
    'phone number': 'phoneNumber',
    'telephone': 'phoneNumber',
    'address': 'address',
    'emergency contact': 'emergencyContact',
    'emergency': 'emergencyContact',
    'photo': 'photoPath',
    'photo path': 'photoPath',
    'signature': 'signaturePath',
    'signature path': 'signaturePath',
    'issue date': 'issueDate',
    'issued': 'issueDate',
    'expiry date': 'expiryDate',
    'expiry': 'expiryDate',
    'expires': 'expiryDate',
    'birth date': 'birthDate',
    'birthday': 'birthDate',
    'dob': 'birthDate',
  }

  return mappings[normalized] || null
}
