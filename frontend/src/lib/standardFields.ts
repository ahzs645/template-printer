/**
 * The standardized field naming convention shared by the field mapping UI and
 * the auto-mapper.
 *
 * Pattern: {fieldType}_{format}_{capitalization}
 *
 * See docs/svg-layer-naming.md for the designer-facing documentation.
 */

import { normalizeSymbology, type BarcodeSymbology } from './barcode'

/** Value used to mark a layer as free-form static text rather than user data. */
export const CUSTOM_STATIC_VALUE = '__custom__'

/** Fields that read a single value straight off the user record. */
const SIMPLE_FIELD_TYPES = [
  'firstName',
  'lastName',
  'middleName',
  'middleInitial',
  'studentId',
  'department',
  'position',
  'grade',
  'email',
  'phoneNumber',
  'address',
  'emergencyContact',
  'issueDate',
  'expiryDate',
  'birthDate',
]

/** Fields backed by an <image> element rather than text. */
const IMAGE_FIELD_TYPES = ['photo', 'signature', 'logo']

/** Tokens that may appear between `fullName` and an optional capitalization suffix. */
const NAME_FORMAT_TOKENS = [
  'First',
  'Last',
  'Middle',
  'MiddleName',
  'MiddleInitial',
  'Comma',
  'LineBreak',
  'NewLine',
  'Break',
]

/** Tokens that may appear as the final segment of a field name. */
const CAPITALIZATION_TOKENS = ['AllCaps', 'UPPER', 'TitleCase', 'Title', 'LowerCase', 'LOWER']

/** Format tokens that only add punctuation or layout, not an actual name part. */
const NON_NAME_TOKENS = new Set(['comma', 'linebreak', 'newline', 'break'])

/**
 * The curated list offered in the field mapping dropdown.
 *
 * This is a shortlist of the combinations worth putting in front of a user, not
 * the limit of what the system understands — `normalizeStandardFieldName` will
 * accept any well-formed name built from the tokens above.
 */
export const STANDARD_FIELDS = [
  // Individual name fields
  'firstName',
  'firstName_AllCaps',
  'firstName_TitleCase',
  'lastName',
  'lastName_AllCaps',
  'lastName_TitleCase',
  'middleName',
  'middleName_AllCaps',
  'middleName_TitleCase',
  'middleInitial',
  'middleInitial_AllCaps',

  // Composite name fields (First-Last order, one line)
  'fullName_First_Last',
  'fullName_First_Last_AllCaps',
  'fullName_First_MiddleInitial_Last',
  'fullName_First_MiddleInitial_Last_AllCaps',
  'fullName_First_Middle_Last',
  'fullName_First_Middle_Last_AllCaps',

  // Composite name fields stacked over two lines
  'fullName_First_LineBreak_Last',
  'fullName_First_LineBreak_Last_AllCaps',
  'fullName_First_LineBreak_Last_TitleCase',
  'fullName_First_MiddleInitial_LineBreak_Last',
  'fullName_First_MiddleInitial_LineBreak_Last_AllCaps',
  'fullName_Last_LineBreak_First',
  'fullName_Last_LineBreak_First_AllCaps',
  'fullName_Last_Comma_LineBreak_First',
  'fullName_Last_Comma_LineBreak_First_AllCaps',

  // Composite name fields (Last-First with comma)
  'fullName_Last_Comma_First',
  'fullName_Last_Comma_First_AllCaps',
  'fullName_Last_Comma_First_MiddleInitial',
  'fullName_Last_Comma_First_MiddleInitial_AllCaps',
  'fullName_Last_Comma_First_Middle',
  'fullName_Last_Comma_First_Middle_AllCaps',

  // Other fields
  'studentId',
  'department',
  'position',
  'grade',
  'email',
  'phoneNumber',
  'address',
  'emergencyContact',
  'issueDate',
  'expiryDate',
  'birthDate',

  // Image fields
  'photo',
  'signature',
  'logo',
]

function buildCanonicalIndex(values: string[]): Map<string, string> {
  return new Map(values.map((value) => [value.toLowerCase(), value]))
}

const STANDARD_FIELD_INDEX = buildCanonicalIndex(STANDARD_FIELDS)
const SIMPLE_FIELD_INDEX = buildCanonicalIndex(SIMPLE_FIELD_TYPES)
const IMAGE_FIELD_INDEX = buildCanonicalIndex(IMAGE_FIELD_TYPES)
const NAME_TOKEN_INDEX = buildCanonicalIndex(NAME_FORMAT_TOKENS)
const CAPITALIZATION_INDEX = buildCanonicalIndex(CAPITALIZATION_TOKENS)

/**
 * Resolve an SVG layer id to its canonical standard field name.
 *
 * Matching is case-insensitive, and any well-formed combination of the
 * documented tokens is accepted — a layer named
 * `fullName_First_LineBreak_Last_TitleCase` maps even though the dropdown only
 * lists a subset of the possible combinations.
 *
 * Returns null when the id is not a standard field name.
 */
export function normalizeStandardFieldName(layerId: string): string | null {
  const trimmed = layerId.trim()
  if (!trimmed) return null

  const listed = STANDARD_FIELD_INDEX.get(trimmed.toLowerCase())
  if (listed) return listed

  const parts = trimmed.split('_').filter(Boolean)
  if (parts.length === 0) return null

  const head = parts[0].toLowerCase()
  const rest = parts.slice(1)

  // Trailing capitalization suffix is optional.
  let capitalization: string | undefined
  if (rest.length > 0) {
    const candidate = CAPITALIZATION_INDEX.get(rest[rest.length - 1].toLowerCase())
    if (candidate) {
      capitalization = candidate
      rest.pop()
    }
  }

  const imageField = IMAGE_FIELD_INDEX.get(head)
  if (imageField) {
    // Image fields take no format or capitalization tokens.
    return rest.length === 0 && !capitalization ? imageField : null
  }

  const simpleField = SIMPLE_FIELD_INDEX.get(head)
  if (simpleField) {
    if (rest.length > 0) return null
    return capitalization ? `${simpleField}_${capitalization}` : simpleField
  }

  if (head !== 'fullname') return null

  const formatTokens: string[] = []
  for (const part of rest) {
    const token = NAME_TOKEN_INDEX.get(part.toLowerCase())
    if (!token) return null
    formatTokens.push(token)
  }

  // A composite name has to reference at least one actual name part.
  if (!formatTokens.some((token) => !NON_NAME_TOKENS.has(token.toLowerCase()))) return null

  const segments = ['fullName', ...formatTokens]
  if (capitalization) segments.push(capitalization)
  return segments.join('_')
}

/** What each kind of field holds, in words a person filling in a card would use. */
const FIELD_TYPE_LABELS: Record<string, string> = {
  fullName: 'Full name',
  firstName: 'First name',
  lastName: 'Last name',
  middleName: 'Middle name',
  middleInitial: 'Middle initial',
  studentId: 'ID number',
  department: 'Department',
  position: 'Position',
  grade: 'Grade',
  email: 'Email',
  phoneNumber: 'Phone number',
  address: 'Address',
  emergencyContact: 'Emergency contact',
  issueDate: 'Issue date',
  expiryDate: 'Expiry date',
  birthDate: 'Birth date',
  photo: 'Photo',
  signature: 'Signature',
  logo: 'Logo',
}

/**
 * A plain name for the field a layer id names, such as "Full name" for
 * `fullName_First_LineBreak_Last`. A field's own label is usually the sample
 * text in the artwork, which says nothing about what to type in.
 *
 * Returns null when the id is not a standard field name.
 */
export function describeStandardField(layerId: string): string | null {
  const resolved = normalizeStandardFieldName(layerId)
  if (!resolved) return null
  return FIELD_TYPE_LABELS[resolved.split('_')[0]] ?? null
}

/** True when the layer id names one of the image fields. */
export function isImageFieldName(layerId: string): boolean {
  const resolved = normalizeStandardFieldName(layerId)
  return resolved !== null && IMAGE_FIELD_INDEX.has(resolved.toLowerCase())
}

/** True when the layer id resolves to a standard field name. */
export function isStandardFieldName(layerId: string): boolean {
  return normalizeStandardFieldName(layerId) !== null
}

/**
 * A layer that should be replaced with a generated barcode.
 *
 * Named `barcode_<symbology>` or `barcode_<symbology>_<fieldName>`:
 *
 *   barcode_codabar             -> pick the source field in Map Fields
 *   barcode_codabar_studentId   -> encodes the user's student id
 *   barcode_code128_studentId   -> same value, Code 128
 */
export type BarcodeLayer = {
  symbology: BarcodeSymbology
  /** The standard field whose value is encoded, when the layer id names one. */
  standardFieldName: string | null
}

export function parseBarcodeLayerId(layerId: string): BarcodeLayer | null {
  const parts = layerId.trim().split('_').filter(Boolean)
  if (parts.length < 2) return null
  if (parts[0].toLowerCase() !== 'barcode') return null

  const symbology = normalizeSymbology(parts[1])
  if (!symbology) return null

  const remainder = parts.slice(2)
  if (remainder.length === 0) return { symbology, standardFieldName: null }

  const standardFieldName = normalizeStandardFieldName(remainder.join('_'))
  // An unrecognised tail is still a barcode layer; it just has no source field.
  return { symbology, standardFieldName }
}
