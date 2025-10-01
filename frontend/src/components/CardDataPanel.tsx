import type { ChangeEvent } from 'react'
import { Upload } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Slider } from './ui/slider'
import { ScrollArea } from './ui/scroll-area'
import type { CardData, FieldDefinition, ImageValue } from '../lib/types'
import { isImageValue } from '../lib/utils'

export type CardDataPanelProps = {
  fields: FieldDefinition[]
  cardData: CardData
  onTextChange: (fieldId: string, value: string) => void
  onImageUpload: (fieldId: string, file: File) => void
  onImageAdjust: (fieldId: string, patch: Partial<ImageValue>) => void
}

export function CardDataPanel({ fields, cardData, onTextChange, onImageUpload, onImageAdjust }: CardDataPanelProps) {
  if (fields.length === 0) {
    return <p style={{ fontSize: '0.875rem', color: '#71717a' }}>No editable fields detected yet.</p>
  }

  return (
    <ScrollArea style={{ maxHeight: '400px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {fields.map((field) => {
          const fieldValue = cardData[field.id]
          const imageValue = isImageValue(fieldValue) ? fieldValue : undefined
          const textValue = typeof fieldValue === 'string' ? fieldValue : ''
          const inputId = `card-data-${field.id}`

          if (field.type === 'image') {
            return (
              <div key={`value-${field.id}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <Label htmlFor={inputId}>{field.label}</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = 'image/*'
                    input.onchange = (e) => handleImageChange(e as any, field.id, onImageUpload)
                    input.click()
                  }}
                  style={{ width: '100%' }}
                >
                  <Upload style={{ width: '0.875rem', height: '0.875rem', marginRight: '0.5rem' }} />
                  {imageValue ? 'Replace Image' : 'Upload Image'}
                </Button>
                {imageValue && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem', padding: '0.75rem', backgroundColor: '#f9f9f9', borderRadius: '0.375rem' }}>
                    <div>
                      <Label style={{ fontSize: '0.75rem', marginBottom: '0.25rem', display: 'block' }}>Scale: {imageValue.scale.toFixed(2)}</Label>
                      <Slider
                        value={[imageValue.scale]}
                        min={0.5}
                        max={2}
                        step={0.01}
                        onValueChange={([value]) => onImageAdjust(field.id, { scale: value })}
                      />
                    </div>
                    <div>
                      <Label style={{ fontSize: '0.75rem', marginBottom: '0.25rem', display: 'block' }}>Offset X: {imageValue.offsetX.toFixed(2)}</Label>
                      <Slider
                        value={[imageValue.offsetX]}
                        min={-0.5}
                        max={0.5}
                        step={0.01}
                        onValueChange={([value]) => onImageAdjust(field.id, { offsetX: value })}
                      />
                    </div>
                    <div>
                      <Label style={{ fontSize: '0.75rem', marginBottom: '0.25rem', display: 'block' }}>Offset Y: {imageValue.offsetY.toFixed(2)}</Label>
                      <Slider
                        value={[imageValue.offsetY]}
                        min={-0.5}
                        max={0.5}
                        step={0.01}
                        onValueChange={([value]) => onImageAdjust(field.id, { offsetY: value })}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          }

          if (field.type === 'barcode') {
            return (
              <div key={`value-${field.id}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <Label htmlFor={inputId}>{field.label}</Label>
                <Input
                  id={inputId}
                  type="text"
                  value={textValue}
                  onChange={(event) => onTextChange(field.id, event.target.value)}
                  placeholder="Barcode value"
                />
              </div>
            )
          }

          if (field.type === 'date') {
            return (
              <div key={`value-${field.id}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <Label htmlFor={inputId}>{field.label}</Label>
                <Input
                  id={inputId}
                  type="date"
                  value={textValue}
                  onChange={(event) => onTextChange(field.id, event.target.value)}
                />
              </div>
            )
          }

          return (
            <div key={`value-${field.id}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Label htmlFor={inputId}>{field.label}</Label>
              <Input
                id={inputId}
                type="text"
                value={textValue}
                onChange={(event) => onTextChange(field.id, event.target.value)}
              />
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}

function handleImageChange(event: ChangeEvent<HTMLInputElement>, fieldId: string, onImageUpload: (fieldId: string, file: File) => void) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  onImageUpload(fieldId, file)
}
