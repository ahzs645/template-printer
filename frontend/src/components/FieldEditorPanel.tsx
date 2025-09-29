import type { FieldDefinition, FieldType } from '../lib/types'

export type FieldEditorPanelProps = {
  field: FieldDefinition
  onChange: <K extends keyof FieldDefinition>(fieldId: string, key: K, value: FieldDefinition[K]) => void
  fontOptions: string[]
  missingFonts: string[]
}

export function FieldEditorPanel({ field, onChange, fontOptions, missingFonts }: FieldEditorPanelProps) {
  return (
    <div className="form-grid">
      <label>
        <span>Field ID</span>
        <input type="text" value={field.id} onChange={(event) => onChange(field.id, 'id', event.target.value)} />
      </label>
      <label>
        <span>Label</span>
        <input type="text" value={field.label} onChange={(event) => onChange(field.id, 'label', event.target.value)} />
      </label>
      <label>
        <span>Type</span>
        <select value={field.type} onChange={(event) => onChange(field.id, 'type', event.target.value as FieldType)}>
          <option value="text">Text</option>
          <option value="image">Image</option>
          <option value="date">Date</option>
          <option value="barcode">Barcode</option>
        </select>
      </label>
      <label>
        <span>X (% of width)</span>
        <input type="number" min={0} max={100} step={0.5} value={field.x} onChange={(event) => onChange(field.id, 'x', Number(event.target.value))} />
      </label>
      <label>
        <span>Y (% of height)</span>
        <input type="number" min={0} max={100} step={0.5} value={field.y} onChange={(event) => onChange(field.id, 'y', Number(event.target.value))} />
      </label>

      {(field.type === 'image' || field.width !== undefined) && (
        <label>
          <span>Width (% of width)</span>
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={field.width ?? ''}
            onChange={(event) => onChange(field.id, 'width', event.target.value ? Number(event.target.value) : undefined)}
          />
        </label>
      )}

      {(field.type === 'image' || field.height !== undefined) && (
        <label>
          <span>Height (% of height)</span>
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={field.height ?? ''}
            onChange={(event) => onChange(field.id, 'height', event.target.value ? Number(event.target.value) : undefined)}
          />
        </label>
      )}

      {field.type === 'text' ? (
        <>
          <label>
            <span>Font</span>
            <select
              value={field.fontFamily ?? ''}
              onChange={(event) =>
                onChange(field.id, 'fontFamily', event.target.value ? event.target.value : undefined)
              }
            >
              <option value="">Default</option>
              {fontOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                  {missingFonts.includes(name) ? ' (missing)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Font Size</span>
            <input
              type="number"
              min={6}
              max={96}
              step={1}
              value={field.fontSize ?? 16}
              onChange={(event) => onChange(field.id, 'fontSize', Number(event.target.value))}
            />
          </label>
          <label>
            <span>Font Weight</span>
            <input
              type="number"
              min={100}
              max={900}
              step={50}
              value={field.fontWeight ?? ''}
              onChange={(event) => onChange(field.id, 'fontWeight', event.target.value ? Number(event.target.value) : undefined)}
            />
          </label>
          <label>
            <span>Color</span>
            <input type="color" value={field.color ?? '#000000'} onChange={(event) => onChange(field.id, 'color', event.target.value)} />
          </label>
          <label>
            <span>Alignment</span>
            <select value={field.align ?? 'left'} onChange={(event) => onChange(field.id, 'align', event.target.value as FieldDefinition['align'])}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </label>
        </>
      ) : null}

    </div>
  )
}
