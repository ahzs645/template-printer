import type { CardDataValue, FieldDefinition, ImageValue } from '../lib/types'
import { buildFontFamilyStack, clamp } from '../lib/svgTemplate'
import { isImageValue } from '../lib/utils'

export type PreviewFieldProps = {
  field: FieldDefinition
  value?: CardDataValue
  width: number
  height: number
}

export function PreviewField({ field, value, width, height }: PreviewFieldProps) {
  if ((field.type === 'text' || field.type === 'image') && field.sourceId) {
    return null
  }

  const left = clamp((field.x / 100) * width, 0, width)
  const top = clamp((field.y / 100) * height, 0, height)
  const fieldWidth = field.width ? (field.width / 100) * width : undefined
  const fieldHeight = field.height ? (field.height / 100) * height : undefined

  if (field.type === 'image') {
    const imageValue = isImageValue(value) ? (value as ImageValue) : undefined
    return (
      <div
        className="preview-field preview-field--image"
        style={{
          left,
          top,
          width: fieldWidth ?? width * 0.2,
          height: fieldHeight ?? height * 0.3,
        }}
      >
        {imageValue ? (
          <img
            src={imageValue.src}
            alt={field.label}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `translate(${imageValue.offsetX * 100}%, ${imageValue.offsetY * 100}%) scale(${imageValue.scale})`,
              transformOrigin: '50% 50%',
            }}
          />
        ) : (
          <span className="muted">Image</span>
        )}
      </div>
    )
  }

  return (
    <div
      className="preview-field preview-field--text"
      style={{
        left,
        top,
        maxWidth: fieldWidth ?? width * 0.6,
        fontSize: `${field.fontSize ?? 16}px`,
        color: field.color ?? '#000',
        textAlign: field.align ?? 'left',
        minHeight: fieldHeight,
        whiteSpace: 'pre-wrap',
        fontFamily: buildFontFamilyStack(field.fontFamily),
        fontWeight: field.fontWeight ?? 400,
      }}
    >
      {typeof value === 'string' && value.trim().length > 0 ? value : field.label}
    </div>
  )
}
