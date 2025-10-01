import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Button } from './ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { extractFieldsFromSVG } from '../lib/fieldParser'
import { Badge } from './ui/badge'
import { Check, X } from 'lucide-react'

export interface FieldMapping {
  svgLayerId: string
  standardFieldName: string
}

interface FieldMappingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  svgContent: string
  templateId: string | null
  onSave: (mappings: FieldMapping[]) => Promise<void>
}

const STANDARD_FIELDS = [
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

  // Composite name fields (First-Last Order)
  'fullName_First_Last',
  'fullName_First_Last_AllCaps',
  'fullName_First_MiddleInitial_Last',
  'fullName_First_MiddleInitial_Last_AllCaps',
  'fullName_First_Middle_Last',
  'fullName_First_Middle_Last_AllCaps',

  // Composite name fields (Last-First with Comma)
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

export function FieldMappingDialog({
  open,
  onOpenChange,
  svgContent,
  templateId,
  onSave,
}: FieldMappingDialogProps) {
  const [detectedFields, setDetectedFields] = useState<string[]>([])
  const [mappings, setMappings] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && svgContent) {
      const fields = extractFieldsFromSVG(svgContent)
      setDetectedFields(fields)

      // Auto-map fields that match standard field names
      const autoMappings: Record<string, string> = {}
      fields.forEach(field => {
        if (STANDARD_FIELDS.includes(field)) {
          autoMappings[field] = field
        }
      })
      setMappings(autoMappings)
    }
  }, [open, svgContent])

  const handleMappingChange = (svgLayerId: string, standardFieldName: string) => {
    setMappings(prev => ({
      ...prev,
      [svgLayerId]: standardFieldName,
    }))
  }

  const handleRemoveMapping = (svgLayerId: string) => {
    setMappings(prev => {
      const next = { ...prev }
      delete next[svgLayerId]
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const mappingsArray: FieldMapping[] = Object.entries(mappings).map(
        ([svgLayerId, standardFieldName]) => ({
          svgLayerId,
          standardFieldName,
        })
      )
      await onSave(mappingsArray)
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to save field mappings:', error)
      alert('Failed to save field mappings')
    } finally {
      setSaving(false)
    }
  }

  const mappedCount = Object.keys(mappings).length
  const unmappedFields = detectedFields.filter(field => !mappings[field])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ maxWidth: '600px', maxHeight: '80vh', overflow: 'auto' }}>
        <DialogHeader>
          <DialogTitle>Field Mapping</DialogTitle>
          <DialogDescription>
            Map SVG layer IDs to standardized field names for automatic data population
          </DialogDescription>
        </DialogHeader>

        <div style={{ paddingTop: '1rem', paddingBottom: '1rem' }}>
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Badge variant={mappedCount > 0 ? 'default' : 'secondary'}>
              {mappedCount} mapped
            </Badge>
            <Badge variant={unmappedFields.length > 0 ? 'secondary' : 'outline'}>
              {unmappedFields.length} unmapped
            </Badge>
          </div>

          {detectedFields.length === 0 ? (
            <div style={{
              padding: '2rem',
              textAlign: 'center',
              color: '#71717a',
              border: '1px dashed #d4d4d8',
              borderRadius: '0.5rem'
            }}>
              No fields detected in this template
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {detectedFields.map(field => (
                <div
                  key={field}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: '0.75rem',
                    alignItems: 'center',
                    padding: '0.75rem',
                    border: '1px solid #e4e4e7',
                    borderRadius: '0.375rem',
                    backgroundColor: mappings[field] ? '#f0fdf4' : '#fff',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      {mappings[field] ? (
                        <Check style={{ width: '1rem', height: '1rem', color: '#16a34a' }} />
                      ) : (
                        <X style={{ width: '1rem', height: '1rem', color: '#71717a' }} />
                      )}
                      <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>{field}</span>
                    </div>
                    <Select
                      value={mappings[field] || ''}
                      onValueChange={(value) => {
                        if (value === '__none__') {
                          handleRemoveMapping(field)
                        } else {
                          handleMappingChange(field, value)
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select standard field..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">
                          <em style={{ color: '#71717a' }}>No mapping</em>
                        </SelectItem>
                        {STANDARD_FIELDS.map(standardField => (
                          <SelectItem key={standardField} value={standardField}>
                            {standardField}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || detectedFields.length === 0}>
            {saving ? 'Saving...' : 'Save Mappings'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
