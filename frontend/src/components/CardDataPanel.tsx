import type { ChangeEvent } from 'react'

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
    return <p className="muted">No editable fields detected yet.</p>
  }

  return (
    <div className="form-grid">
      {fields.map((field) => {
        const fieldValue = cardData[field.id]
        const imageValue = isImageValue(fieldValue) ? fieldValue : undefined
        const textValue = typeof fieldValue === 'string' ? fieldValue : ''
        const inputId = `card-data-${field.id}`

        if (field.type === 'image') {
          return (
            <div key={`value-${field.id}`} className="form-field">
              <span>{field.label}</span>
              <div className="image-input-group">
                <label className="file-button">
                  <input className="file-button__input" type="file" accept="image/*" onChange={(event) => handleImageChange(event, field.id, onImageUpload)} />
                  <span className="file-button__label">{imageValue ? 'Replace Image' : 'Upload Image'}</span>
                </label>
                {imageValue ? (
                  <div className="image-adjust">
                    <label>
                      <span>Scale</span>
                      <input type="range" min={0.5} max={2} step={0.01} value={imageValue.scale} onChange={(event) => onImageAdjust(field.id, { scale: Number(event.target.value) })} />
                    </label>
                    <label>
                      <span>Offset X</span>
                      <input type="range" min={-0.5} max={0.5} step={0.01} value={imageValue.offsetX} onChange={(event) => onImageAdjust(field.id, { offsetX: Number(event.target.value) })} />
                    </label>
                    <label>
                      <span>Offset Y</span>
                      <input type="range" min={-0.5} max={0.5} step={0.01} value={imageValue.offsetY} onChange={(event) => onImageAdjust(field.id, { offsetY: Number(event.target.value) })} />
                    </label>
                  </div>
                ) : null}
              </div>
            </div>
          )
        }

        if (field.type === 'barcode') {
          return (
            <label key={`value-${field.id}`} htmlFor={inputId}>
              <span>{field.label}</span>
              <input id={inputId} type="text" value={textValue} onChange={(event) => onTextChange(field.id, event.target.value)} placeholder="Barcode value" />
            </label>
          )
        }

        if (field.type === 'date') {
          return (
            <label key={`value-${field.id}`} htmlFor={inputId}>
              <span>{field.label}</span>
              <input id={inputId} type="date" value={textValue} onChange={(event) => onTextChange(field.id, event.target.value)} />
            </label>
          )
        }

        return (
          <label key={`value-${field.id}`} htmlFor={inputId}>
            <span>{field.label}</span>
            <input id={inputId} type="text" value={textValue} onChange={(event) => onTextChange(field.id, event.target.value)} />
          </label>
        )
      })}
    </div>
  )
}

function handleImageChange(event: ChangeEvent<HTMLInputElement>, fieldId: string, onImageUpload: (fieldId: string, file: File) => void) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  onImageUpload(fieldId, file)
}
