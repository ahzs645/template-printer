import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import type { FieldDefinition } from '../../lib/types'

type QuickModeFieldsProps = {
  fields: FieldDefinition[]
  cardData: Record<string, string>
  onCardDataChange: (fieldId: string, value: string) => void
}

export function QuickModeFields({ fields, cardData, onCardDataChange }: QuickModeFieldsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle style={{ fontSize: '1rem' }}>Card Data</CardTitle>
        <CardDescription>Enter information for the card</CardDescription>
      </CardHeader>
      <CardContent>
        {fields.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: '#71717a' }}>No fields defined in template</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {fields.filter(f => f.type === 'text').map((field) => (
              <div key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <Label htmlFor={`field-${field.id}`} style={{ fontSize: '0.875rem' }}>
                  {field.label || field.id}
                </Label>
                <Input
                  id={`field-${field.id}`}
                  value={cardData[field.id] || ''}
                  onChange={(e) => onCardDataChange(field.id, e.target.value)}
                  placeholder={`Enter ${field.label || field.id}`}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
