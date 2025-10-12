import { useEffect, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { ScrollArea } from './ui/scroll-area'

type CapitalizationVariantId = 'default' | 'AllCaps' | 'TitleCase' | 'LowerCase'

type CapitalizationOption = {
  id: CapitalizationVariantId
  label: string
  suffix: string
  helper: string
}

type FormatOption = {
  id: string
  label: string
  suffix: string
  sample: string
  helper?: string
}

type FieldDescriptor = {
  id: string
  baseId: string
  label: string
  description?: string
  formats: FormatOption[]
  capitalization?: CapitalizationVariantId[]
  defaultFormatId?: string
  defaultCapitalizationId?: CapitalizationVariantId
}

type FieldCategory = {
  id: string
  label: string
  description?: string
  fields: FieldDescriptor[]
}

type SavedLayerName = {
  layerId: string
  fieldLabel: string
  formatLabel?: string
  capitalizationLabel?: string
  exampleOutput: string
}

const CAPITALIZATION_VARIANTS: CapitalizationOption[] = [
  {
    id: 'default',
    label: 'Database value',
    suffix: '',
    helper: 'Keeps the exact casing provided in the data source.',
  },
  {
    id: 'AllCaps',
    label: 'ALL CAPS',
    suffix: 'AllCaps',
    helper: 'Transforms the value to uppercase (suffix `_AllCaps`).',
  },
  {
    id: 'TitleCase',
    label: 'Title Case',
    suffix: 'TitleCase',
    helper: 'Capitalizes the first letter of each word (suffix `_TitleCase`).',
  },
  {
    id: 'LowerCase',
    label: 'lowercase',
    suffix: 'LowerCase',
    helper: 'Converts the value to lowercase (suffix `_LowerCase`).',
  },
]

const NAME_CAPITALIZATION: CapitalizationVariantId[] = ['default', 'AllCaps', 'TitleCase']
const FULLNAME_CAPITALIZATION: CapitalizationVariantId[] = ['default', 'AllCaps']
const TEXT_CAPITALIZATION: CapitalizationVariantId[] = ['default', 'AllCaps', 'TitleCase', 'LowerCase']

const singleFormat = (sample: string, helper?: string): FormatOption[] => [
  {
    id: 'base',
    label: 'Base value',
    suffix: '',
    sample,
    helper,
  },
]

const INDIVIDUAL_NAME_FIELDS_SOURCE: Array<{
  id: string
  label: string
  sample: string
  description: string
  capitalization?: CapitalizationVariantId[]
}> = [
  {
    id: 'firstName',
    label: 'First Name',
    sample: 'John',
    description: 'Only the given name, e.g. "John".',
  },
  {
    id: 'lastName',
    label: 'Last Name',
    sample: 'Smith',
    description: 'Family name only, e.g. "Smith".',
  },
  {
    id: 'middleName',
    label: 'Middle Name',
    sample: 'Allen',
    description: 'Full middle name if available.',
  },
  {
    id: 'middleInitial',
    label: 'Middle Initial',
    sample: 'A.',
    description: 'Single letter with period, when you only need an initial.',
    capitalization: ['default', 'AllCaps'],
  },
]

const TEXT_FIELDS_SOURCE: Array<{
  id: string
  label: string
  sample: string
  description: string
  capitalization?: CapitalizationVariantId[]
}> = [
  {
    id: 'studentId',
    label: 'Student or Employee ID',
    sample: '123456',
    description: 'Unique identifier for the user.',
  },
  {
    id: 'department',
    label: 'Department',
    sample: 'Engineering',
    description: 'Department or organizational unit.',
  },
  {
    id: 'position',
    label: 'Position / Job Title',
    sample: 'Lab Supervisor',
    description: 'Job title or role.',
  },
  {
    id: 'grade',
    label: 'Grade Level',
    sample: '10',
    description: 'Grade level or class name.',
  },
  {
    id: 'email',
    label: 'Email Address',
    sample: 'john.smith@example.com',
    description: 'Email contact for the user.',
    capitalization: ['default', 'AllCaps', 'LowerCase'],
  },
  {
    id: 'phoneNumber',
    label: 'Phone Number',
    sample: '(555) 123-4567',
    description: 'Primary contact number.',
    capitalization: ['default', 'AllCaps'],
  },
  {
    id: 'address',
    label: 'Address',
    sample: '123 Main St, Suite 200',
    description: 'Mailing or street address.',
  },
  {
    id: 'emergencyContact',
    label: 'Emergency Contact',
    sample: 'Jane Smith (555) 987-6543',
    description: 'Emergency contact name and number.',
  },
  {
    id: 'issueDate',
    label: 'Issue Date',
    sample: '2024-03-01',
    description: 'Date the card was issued.',
  },
  {
    id: 'expiryDate',
    label: 'Expiry Date',
    sample: '2025-03-01',
    description: 'Date the card expires.',
  },
  {
    id: 'birthDate',
    label: 'Birth Date',
    sample: '2001-11-18',
    description: 'User birth date.',
  },
]

const IMAGE_FIELDS_SOURCE: Array<{
  id: string
  label: string
  sample: string
  description: string
}> = [
  {
    id: 'photo',
    label: 'Photo',
    sample: 'User photo',
    description: 'Primary profile photo placeholder.',
  },
  {
    id: 'signature',
    label: 'Signature',
    sample: 'Signature image',
    description: 'Signature image placeholder.',
  },
  {
    id: 'logo',
    label: 'Organization Logo',
    sample: 'Logo image',
    description: 'Organization or school logo placeholder.',
  },
]

const individualNameFields: FieldDescriptor[] = INDIVIDUAL_NAME_FIELDS_SOURCE.map((entry) => ({
  id: entry.id,
  baseId: entry.id,
  label: entry.label,
  description: entry.description,
  formats: singleFormat(entry.sample),
  capitalization: entry.capitalization ?? NAME_CAPITALIZATION,
}))

const textFields: FieldDescriptor[] = TEXT_FIELDS_SOURCE.map((entry) => ({
  id: entry.id,
  baseId: entry.id,
  label: entry.label,
  description: entry.description,
  formats: singleFormat(entry.sample),
  capitalization: entry.capitalization ?? TEXT_CAPITALIZATION,
}))

const imageFields: FieldDescriptor[] = IMAGE_FIELDS_SOURCE.map((entry) => ({
  id: entry.id,
  baseId: entry.id,
  label: entry.label,
  description: entry.description,
  formats: singleFormat(entry.sample),
}))

const compositeFirstLastField: FieldDescriptor = {
  id: 'fullNameFirstLast',
  baseId: 'fullName',
  label: 'Full Name (First Last)',
  description: 'Flexible formats for first-name first layouts.',
  formats: [
    { id: 'first-last', label: 'First Last', suffix: 'First_Last', sample: 'John Smith' },
    { id: 'first-middleinitial-last', label: 'First M. Last', suffix: 'First_MiddleInitial_Last', sample: 'John A. Smith' },
    { id: 'first-middle-last', label: 'First Middle Last', suffix: 'First_Middle_Last', sample: 'John Allen Smith' },
  ],
  capitalization: FULLNAME_CAPITALIZATION,
  defaultFormatId: 'first-last',
}

const compositeLastFirstField: FieldDescriptor = {
  id: 'fullNameLastFirst',
  baseId: 'fullName',
  label: 'Full Name (Last, First)',
  description: 'Last name first with optional middle parts.',
  formats: [
    { id: 'last-comma-first', label: 'Last, First', suffix: 'Last_Comma_First', sample: 'Smith, John' },
    { id: 'last-comma-first-middleinitial', label: 'Last, First M.', suffix: 'Last_Comma_First_MiddleInitial', sample: 'Smith, John A.' },
    { id: 'last-comma-first-middle', label: 'Last, First Middle', suffix: 'Last_Comma_First_Middle', sample: 'Smith, John Allen' },
  ],
  capitalization: FULLNAME_CAPITALIZATION,
  defaultFormatId: 'last-comma-first',
}

const FIELD_CATEGORIES: FieldCategory[] = [
  {
    id: 'individual-name',
    label: 'Individual Name Fields',
    description: 'Reference single name parts pulled directly from user records.',
    fields: individualNameFields,
  },
  {
    id: 'composite-first-last',
    label: 'Composite Names – First, Middle, Last',
    description: 'Combine multiple name parts in first → last order.',
    fields: [compositeFirstLastField],
  },
  {
    id: 'composite-last-first',
    label: 'Composite Names – Last, First',
    description: 'Last name first with a comma (common for ID badges).',
    fields: [compositeLastFirstField],
  },
  {
    id: 'text-fields',
    label: 'Other Text Fields',
    description: 'Standard non-image fields such as IDs, departments, and contact details.',
    fields: textFields,
  },
  {
    id: 'image-fields',
    label: 'Image Fields',
    description: 'Use for image placeholders such as photos, signatures, or logos.',
    fields: imageFields,
  },
]

const capitalizationOptionById = new Map<CapitalizationVariantId, CapitalizationOption>(
  CAPITALIZATION_VARIANTS.map((option) => [option.id, option]),
)

function applyCapitalization(sample: string, variantId: CapitalizationVariantId): string {
  switch (variantId) {
    case 'AllCaps':
      return sample.toUpperCase()
    case 'TitleCase':
      return sample
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
    case 'LowerCase':
      return sample.toLowerCase()
    default:
      return sample
  }
}

export function FieldNamingTab() {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(() => FIELD_CATEGORIES[0]?.id ?? '')
  const [selectedFieldId, setSelectedFieldId] = useState<string>(() => FIELD_CATEGORIES[0]?.fields[0]?.id ?? '')
  const [selectedFormatId, setSelectedFormatId] = useState<string>(() => FIELD_CATEGORIES[0]?.fields[0]?.formats[0]?.id ?? '')
  const [selectedCapitalizationId, setSelectedCapitalizationId] = useState<CapitalizationVariantId>(() => {
    const field = FIELD_CATEGORIES[0]?.fields[0]
    if (!field?.capitalization?.length) return 'default'
    return field.defaultCapitalizationId ?? field.capitalization[0]
  })
  const [savedNames, setSavedNames] = useState<SavedLayerName[]>([])
  const [copyFeedbackId, setCopyFeedbackId] = useState<string | null>(null)
  const [mainCopyFeedback, setMainCopyFeedback] = useState(false)

  const selectedCategory = useMemo(() => FIELD_CATEGORIES.find((category) => category.id === selectedCategoryId) ?? null, [selectedCategoryId])
  const selectedField = useMemo(() => selectedCategory?.fields.find((field) => field.id === selectedFieldId) ?? null, [selectedCategory, selectedFieldId])
  const selectedFormat = useMemo(() => selectedField?.formats.find((format) => format.id === selectedFormatId) ?? null, [selectedField, selectedFormatId])
  const allowedCapitalization = selectedField?.capitalization ?? []
  const selectedCapitalizationOption = allowedCapitalization.length
    ? capitalizationOptionById.get(selectedCapitalizationId)
    : null

  useEffect(() => {
    if (!selectedCategory) return
    const firstField = selectedCategory.fields[0]
    if (firstField && !selectedCategory.fields.some((field) => field.id === selectedFieldId)) {
      setSelectedFieldId(firstField.id)
      setSelectedFormatId(firstField.defaultFormatId ?? firstField.formats[0].id)
      setSelectedCapitalizationId(firstField.defaultCapitalizationId ?? (firstField.capitalization?.[0] ?? 'default'))
    }
  }, [selectedCategory, selectedFieldId])

  useEffect(() => {
    if (!selectedField) return
    setSelectedFormatId((current) => {
      const hasCurrent = selectedField.formats.some((format) => format.id === current)
      if (hasCurrent) return current
      return selectedField.defaultFormatId ?? selectedField.formats[0].id
    })
    setSelectedCapitalizationId((current) => {
      if (!selectedField.capitalization?.length) return 'default'
      const hasCurrent = selectedField.capitalization.includes(current)
      if (hasCurrent) return current
      return selectedField.defaultCapitalizationId ?? selectedField.capitalization[0]
    })
  }, [selectedField])

  const layerId = useMemo(() => {
    if (!selectedField || !selectedFormat) return ''
    const segments = [selectedField.baseId]
    if (selectedFormat.suffix) segments.push(selectedFormat.suffix)
    if (selectedCapitalizationOption?.suffix) segments.push(selectedCapitalizationOption.suffix)
    return segments.join('_')
  }, [selectedField, selectedFormat, selectedCapitalizationOption])

  const exampleOutput = useMemo(() => {
    if (!selectedFormat) return ''
    if (!selectedCapitalizationOption) return selectedFormat.sample
    return applyCapitalization(selectedFormat.sample, selectedCapitalizationOption.id)
  }, [selectedFormat, selectedCapitalizationOption])

  useEffect(() => {
    if (!mainCopyFeedback) return
    const timeout = setTimeout(() => setMainCopyFeedback(false), 1500)
    return () => clearTimeout(timeout)
  }, [mainCopyFeedback])

  useEffect(() => {
    if (!copyFeedbackId) return
    const timeout = setTimeout(() => setCopyFeedbackId(null), 1500)
    return () => clearTimeout(timeout)
  }, [copyFeedbackId])

  const handleCopyLayerId = async (value: string, fromSaved?: boolean) => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      if (fromSaved) {
        setCopyFeedbackId(value)
      } else {
        setMainCopyFeedback(true)
      }
    } catch (error) {
      console.error('Failed to copy layer name', error)
    }
  }

  const handleAddSaved = () => {
    if (!layerId || !selectedField) return
    setSavedNames((current) => {
      if (current.some((entry) => entry.layerId === layerId)) {
        return current
      }
      return [
        ...current,
        {
          layerId,
          fieldLabel: selectedField.label,
          formatLabel: selectedFormat?.label,
          capitalizationLabel: selectedCapitalizationOption?.label,
          exampleOutput,
        },
      ]
    })
  }

  const handleRemoveSaved = (value: string) => {
    setSavedNames((current) => current.filter((entry) => entry.layerId !== value))
  }

  const handleCopySavedBundle = async () => {
    if (!savedNames.length) return
    try {
      const text = savedNames.map((entry) => entry.layerId).join('\n')
      await navigator.clipboard.writeText(text)
      setCopyFeedbackId('__bundle__')
    } catch (error) {
      console.error('Failed to copy layer names', error)
    }
  }

  return (
    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <Card style={{ flex: '1 1 360px', minWidth: '320px' }}>
        <CardHeader>
          <CardTitle>SVG Layer Naming Helper</CardTitle>
          <CardDescription>
            Build layer IDs that follow the convention described in <code>docs/svg-layer-naming.md</code>.
          </CardDescription>
        </CardHeader>
        <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#27272a' }}>
              Field Category
            </label>
            <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {FIELD_CATEGORIES.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedCategory?.description && (
              <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                {selectedCategory.description}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#27272a' }}>
              Field
            </label>
            <Select value={selectedFieldId} onValueChange={setSelectedFieldId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a field" />
              </SelectTrigger>
              <SelectContent>
                {selectedCategory?.fields.map((field) => (
                  <SelectItem key={field.id} value={field.id}>
                    {field.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedField?.description && (
              <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                {selectedField.description}
              </p>
            )}
          </div>

          {selectedField && selectedField.formats.length > 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#27272a' }}>
                Format
              </label>
              <Select value={selectedFormatId} onValueChange={setSelectedFormatId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  {selectedField.formats.map((format) => (
                    <SelectItem key={format.id} value={format.id}>
                      {format.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedFormat?.helper && (
                <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  {selectedFormat.helper}
                </p>
              )}
            </div>
          )}

          {selectedField && selectedField.capitalization?.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#27272a' }}>
                Capitalization
              </label>
              <Select value={selectedCapitalizationId} onValueChange={(value) => setSelectedCapitalizationId(value as CapitalizationVariantId)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select capitalization" />
                </SelectTrigger>
                <SelectContent>
                  {selectedField.capitalization.map((variantId) => {
                    const option = capitalizationOptionById.get(variantId)
                    if (!option) return null
                    return (
                      <SelectItem key={variantId} value={variantId}>
                        {option.label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              {selectedCapitalizationOption?.helper && (
                <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  {selectedCapitalizationOption.helper}
                </p>
              )}
            </div>
          ) : null}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#27272a' }}>
              Generated Layer ID
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <Input value={layerId} readOnly />
              <Button type="button" variant="outline" onClick={() => handleCopyLayerId(layerId)}>
                {mainCopyFeedback ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            {exampleOutput && (
              <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                Example output: {exampleOutput}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button type="button" onClick={handleAddSaved} disabled={!layerId}>
              Add to list
            </Button>
            <Button type="button" variant="secondary" onClick={() => handleCopyLayerId(`${layerId}:${exampleOutput}`)} disabled={!layerId || !exampleOutput}>
              Copy id + example
            </Button>
          </div>

          <div style={{ background: '#f4f4f5', padding: '0.75rem', borderRadius: '0.5rem' }}>
            <p style={{ fontSize: '0.75rem', color: '#52525b' }}>
              Tip: For custom static text, name your layer starting with <code>custom</code> (e.g. <code>customSchoolMotto</code>).
            </p>
          </div>
        </CardContent>
      </Card>

      <Card style={{ flex: '1 1 280px', minWidth: '260px' }}>
        <CardHeader>
          <CardTitle>Saved Layer Names</CardTitle>
          <CardDescription>Collect the field names you plan to use and copy them in one go.</CardDescription>
        </CardHeader>
        <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button type="button" variant="outline" onClick={handleCopySavedBundle} disabled={!savedNames.length}>
              {copyFeedbackId === '__bundle__' ? 'Copied!' : 'Copy list'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setSavedNames([])} disabled={!savedNames.length}>
              Clear list
            </Button>
          </div>
          <ScrollArea style={{ maxHeight: '320px' }}>
            {savedNames.length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                Saved layer names will appear here.
              </p>
            ) : (
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: 0, margin: 0, listStyle: 'none' }}>
                {savedNames.map((entry) => (
                  <li key={entry.layerId} style={{ border: '1px solid #e4e4e7', borderRadius: '0.5rem', padding: '0.75rem', background: '#ffffff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#18181b', wordBreak: 'break-all' }}>
                          {entry.layerId}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#71717a' }}>
                          {entry.fieldLabel}
                          {entry.formatLabel ? ` • ${entry.formatLabel}` : ''}
                          {entry.capitalizationLabel ? ` • ${entry.capitalizationLabel}` : ''}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#52525b', marginTop: '0.25rem' }}>
                          Example: {entry.exampleOutput}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <Button type="button" variant="outline" size="sm" onClick={() => handleCopyLayerId(entry.layerId, true)}>
                          {copyFeedbackId === entry.layerId ? 'Copied!' : 'Copy'}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveSaved(entry.layerId)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}

