import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import type { FieldDefinition, FieldType } from '../lib/types'
import {
  BARCODE_SYMBOLOGIES,
  BARCODE_SYMBOLOGY_LABELS,
  validateBarcodeText,
  type BarcodeSymbology,
} from '../lib/barcode'

export type FieldEditorPanelProps = {
  field: FieldDefinition
  onChange: <K extends keyof FieldDefinition>(fieldId: string, key: K, value: FieldDefinition[K]) => void
  fontOptions: string[]
  missingFonts: string[]
}

export function FieldEditorPanel({ field, onChange, fontOptions, missingFonts }: FieldEditorPanelProps) {
  // Say straight away when a default value cannot be encoded, rather than
  // letting it fail silently at export.
  let barcodeProblem: string | null = null
  if (field.type === 'barcode' && field.defaultValue?.trim()) {
    const result = validateBarcodeText(field.barcodeSymbology ?? 'code128', field.defaultValue)
    if (!result.valid) barcodeProblem = result.error ?? null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Label htmlFor="field-id">Field ID</Label>
          <Input
            id="field-id"
            type="text"
            value={field.id}
            onChange={(event) => onChange(field.id, 'id', event.target.value)}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Label htmlFor="field-label">Label</Label>
          <Input
            id="field-label"
            type="text"
            value={field.label}
            onChange={(event) => onChange(field.id, 'label', event.target.value)}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Label htmlFor="field-type">Type</Label>
          <Select value={field.type} onValueChange={(value) => onChange(field.id, 'type', value as FieldType)}>
            <SelectTrigger id="field-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="image">Image</SelectItem>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="barcode">Barcode</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {field.type === 'barcode' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Label htmlFor="field-barcode-type">Barcode type</Label>
            <Select
              value={field.barcodeSymbology ?? 'code128'}
              onValueChange={(value) => onChange(field.id, 'barcodeSymbology', value as BarcodeSymbology)}
            >
              <SelectTrigger id="field-barcode-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BARCODE_SYMBOLOGIES.map((symbology) => (
                  <SelectItem key={symbology} value={symbology}>
                    {BARCODE_SYMBOLOGY_LABELS[symbology]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {(field.type === 'text' || field.type === 'barcode' || field.type === 'date') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Label htmlFor="field-default">Default value</Label>
            <Input
              id="field-default"
              type="text"
              value={field.defaultValue ?? ''}
              placeholder={field.type === 'barcode' ? 'Used when the record has no value' : 'Optional'}
              onChange={(event) =>
                onChange(field.id, 'defaultValue', event.target.value ? event.target.value : undefined)
              }
            />
            {barcodeProblem && (
              <p style={{ fontSize: '0.75rem', color: 'var(--danger)', margin: 0 }}>{barcodeProblem}</p>
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Label htmlFor="field-x">X (% of width)</Label>
          <Input
            id="field-x"
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={field.x}
            onChange={(event) => onChange(field.id, 'x', Number(event.target.value))}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Label htmlFor="field-y">Y (% of height)</Label>
          <Input
            id="field-y"
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={field.y}
            onChange={(event) => onChange(field.id, 'y', Number(event.target.value))}
          />
        </div>

        {(field.type === 'image' || field.type === 'barcode' || field.width !== undefined) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Label htmlFor="field-width">Width (% of width)</Label>
            <Input
              id="field-width"
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={field.width ?? ''}
              onChange={(event) => onChange(field.id, 'width', event.target.value ? Number(event.target.value) : undefined)}
            />
          </div>
        )}

        {(field.type === 'image' || field.type === 'barcode' || field.height !== undefined) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Label htmlFor="field-height">Height (% of height)</Label>
            <Input
              id="field-height"
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={field.height ?? ''}
              onChange={(event) => onChange(field.id, 'height', event.target.value ? Number(event.target.value) : undefined)}
            />
          </div>
        )}

        {field.type === 'text' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Label htmlFor="field-font">Font</Label>
              <Select
                value={field.fontFamily ?? '__default__'}
                onValueChange={(value) => onChange(field.id, 'fontFamily', value === '__default__' ? undefined : value)}
              >
                <SelectTrigger id="field-font">
                  <SelectValue placeholder="Default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">Default</SelectItem>
                  {fontOptions.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                      {missingFonts.includes(name) ? ' (missing)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Label htmlFor="field-font-size">Font Size</Label>
              <Input
                id="field-font-size"
                type="number"
                min={6}
                max={96}
                step={1}
                value={field.fontSize ?? 16}
                onChange={(event) => onChange(field.id, 'fontSize', Number(event.target.value))}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Label htmlFor="field-font-weight">Font Weight</Label>
              <Input
                id="field-font-weight"
                type="number"
                min={100}
                max={900}
                step={50}
                value={field.fontWeight ?? ''}
                onChange={(event) => onChange(field.id, 'fontWeight', event.target.value ? Number(event.target.value) : undefined)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Label htmlFor="field-color">Color</Label>
              <Input
                id="field-color"
                type="color"
                value={field.color ?? '#000000'}
                onChange={(event) => onChange(field.id, 'color', event.target.value)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Label htmlFor="field-align">Alignment</Label>
              <Select
                value={field.align ?? 'left'}
                onValueChange={(value) => onChange(field.id, 'align', value as FieldDefinition['align'])}
              >
                <SelectTrigger id="field-align">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>
  )
}
