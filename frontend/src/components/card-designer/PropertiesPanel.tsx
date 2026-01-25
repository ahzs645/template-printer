import { useEffect, useState } from 'react'
import type { FabricObject, Textbox, Rect, Circle, Line } from 'fabric'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { Slider } from '../ui/slider'
import { Switch } from '../ui/switch'
import type { DesignerObjectData } from './types'

// Pixels per mm at 96 DPI
const PX_PER_MM = 96 / 25.4

type PropertiesPanelProps = {
  selectedObject: FabricObject | null
  onPropertyChange: (property: string, value: unknown) => void
  onDataChange?: (data: Partial<DesignerObjectData>) => void
}

// Common fonts available
const FONT_FAMILIES = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  'Verdana',
  'Roboto',
  'Open Sans',
  'Montserrat',
  'Lato',
  'Poppins',
]

const FONT_WEIGHTS = [
  { label: 'Normal', value: 'normal' },
  { label: 'Bold', value: 'bold' },
]

const TEXT_ALIGNS = [
  { label: 'Left', value: 'left' },
  { label: 'Center', value: 'center' },
  { label: 'Right', value: 'right' },
]

export function PropertiesPanel({
  selectedObject,
  onPropertyChange,
  onDataChange,
}: PropertiesPanelProps) {
  // Local state for property values (to avoid too many renders)
  const [localProps, setLocalProps] = useState<Record<string, unknown>>({})

  // Sync local state with selected object
  useEffect(() => {
    if (!selectedObject) {
      setLocalProps({})
      return
    }

    const props: Record<string, unknown> = {
      left: Math.round((selectedObject.left ?? 0) / PX_PER_MM * 10) / 10,
      top: Math.round((selectedObject.top ?? 0) / PX_PER_MM * 10) / 10,
      width: Math.round((selectedObject.width ?? 0) * (selectedObject.scaleX ?? 1) / PX_PER_MM * 10) / 10,
      height: Math.round((selectedObject.height ?? 0) * (selectedObject.scaleY ?? 1) / PX_PER_MM * 10) / 10,
      angle: Math.round(selectedObject.angle ?? 0),
      opacity: Math.round((selectedObject.opacity ?? 1) * 100),
    }

    // Text-specific properties
    if (selectedObject.type === 'textbox' || selectedObject.type === 'text') {
      const textObj = selectedObject as Textbox
      props.text = textObj.text ?? ''
      props.fontFamily = textObj.fontFamily ?? 'Arial'
      props.fontSize = textObj.fontSize ?? 24
      props.fontWeight = textObj.fontWeight ?? 'normal'
      props.fill = textObj.fill ?? '#000000'
      props.textAlign = textObj.textAlign ?? 'left'
    }

    // Shape-specific properties
    if (selectedObject.type === 'rect' || selectedObject.type === 'circle') {
      props.fill = (selectedObject as Rect).fill ?? '#3b82f6'
      props.stroke = (selectedObject as Rect).stroke ?? ''
      props.strokeWidth = (selectedObject as Rect).strokeWidth ?? 0
    }

    if (selectedObject.type === 'rect') {
      props.rx = (selectedObject as Rect).rx ?? 0
    }

    // Line-specific
    if (selectedObject.type === 'line') {
      props.stroke = (selectedObject as Line).stroke ?? '#000000'
      props.strokeWidth = (selectedObject as Line).strokeWidth ?? 2
    }

    // Custom data
    const data = selectedObject.get('data') as DesignerObjectData | undefined
    if (data) {
      props.elementType = data.elementType
      props.isDynamic = data.isDynamic ?? false
      props.fieldId = data.fieldId ?? ''
    }

    setLocalProps(props)
  }, [selectedObject])

  const handleChange = (property: string, value: unknown, convertToPixels = false) => {
    setLocalProps((prev) => ({ ...prev, [property]: value }))

    let finalValue = value
    if (convertToPixels && typeof value === 'number') {
      finalValue = value * PX_PER_MM
    }

    onPropertyChange(property, finalValue)
  }

  const handleDataChange = (updates: Partial<DesignerObjectData>) => {
    if (!selectedObject) return

    const currentData = (selectedObject.get('data') as DesignerObjectData) ?? {}
    const newData = { ...currentData, ...updates }
    onPropertyChange('data', newData)
    onDataChange?.(updates)
  }

  if (!selectedObject) {
    return (
      <div style={{ padding: 16 }}>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
          Select an element to edit its properties
        </p>
      </div>
    )
  }

  const elementType = (localProps.elementType as string) ?? selectedObject.type
  const isText = selectedObject.type === 'textbox' || selectedObject.type === 'text'
  const isShape = selectedObject.type === 'rect' || selectedObject.type === 'circle'
  const isLine = selectedObject.type === 'line'
  const isDynamic = localProps.isDynamic as boolean

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 12 }}>
      {/* Element Type Badge */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 8px',
          backgroundColor: 'var(--bg-surface-alt)',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 500,
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          alignSelf: 'flex-start',
        }}
      >
        {elementType}
        {isDynamic && (
          <span style={{ color: 'var(--accent)' }}>(Dynamic)</span>
        )}
      </div>

      {/* Position & Size */}
      <div>
        <h4 style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          Position & Size
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <Label style={{ fontSize: 11 }}>X (mm)</Label>
            <Input
              type="number"
              value={localProps.left as number ?? 0}
              onChange={(e) => handleChange('left', parseFloat(e.target.value) || 0, true)}
              style={{ height: 32 }}
            />
          </div>
          <div>
            <Label style={{ fontSize: 11 }}>Y (mm)</Label>
            <Input
              type="number"
              value={localProps.top as number ?? 0}
              onChange={(e) => handleChange('top', parseFloat(e.target.value) || 0, true)}
              style={{ height: 32 }}
            />
          </div>
          <div>
            <Label style={{ fontSize: 11 }}>Width (mm)</Label>
            <Input
              type="number"
              value={localProps.width as number ?? 0}
              onChange={(e) => {
                const newWidth = parseFloat(e.target.value) || 1
                const currentWidth = (selectedObject.width ?? 1) * (selectedObject.scaleX ?? 1) / PX_PER_MM
                const scale = newWidth / currentWidth * (selectedObject.scaleX ?? 1)
                handleChange('scaleX', scale)
              }}
              style={{ height: 32 }}
            />
          </div>
          <div>
            <Label style={{ fontSize: 11 }}>Height (mm)</Label>
            <Input
              type="number"
              value={localProps.height as number ?? 0}
              onChange={(e) => {
                const newHeight = parseFloat(e.target.value) || 1
                const currentHeight = (selectedObject.height ?? 1) * (selectedObject.scaleY ?? 1) / PX_PER_MM
                const scale = newHeight / currentHeight * (selectedObject.scaleY ?? 1)
                handleChange('scaleY', scale)
              }}
              style={{ height: 32 }}
            />
          </div>
        </div>
      </div>

      {/* Rotation & Opacity */}
      <div>
        <h4 style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          Transform
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <Label style={{ fontSize: 11 }}>Rotation</Label>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{String(localProps.angle ?? 0)}°</span>
            </div>
            <Slider
              value={[localProps.angle as number ?? 0]}
              min={0}
              max={360}
              step={1}
              onValueChange={([value]) => handleChange('angle', value)}
            />
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <Label style={{ fontSize: 11 }}>Opacity</Label>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{String(localProps.opacity ?? 100)}%</span>
            </div>
            <Slider
              value={[localProps.opacity as number ?? 100]}
              min={0}
              max={100}
              step={1}
              onValueChange={([value]) => handleChange('opacity', value / 100)}
            />
          </div>
        </div>
      </div>

      {/* Text Properties */}
      {isText && (
        <div>
          <h4 style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Text
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <Label style={{ fontSize: 11 }}>Content</Label>
              <Input
                value={localProps.text as string ?? ''}
                onChange={(e) => handleChange('text', e.target.value)}
                style={{ height: 32 }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <Label style={{ fontSize: 11 }}>Font</Label>
                <Select
                  value={localProps.fontFamily as string ?? 'Arial'}
                  onValueChange={(value) => handleChange('fontFamily', value)}
                >
                  <SelectTrigger style={{ height: 32 }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_FAMILIES.map((font) => (
                      <SelectItem key={font} value={font}>
                        <span style={{ fontFamily: font }}>{font}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label style={{ fontSize: 11 }}>Size</Label>
                <Input
                  type="number"
                  value={localProps.fontSize as number ?? 24}
                  onChange={(e) => handleChange('fontSize', parseInt(e.target.value) || 24)}
                  min={8}
                  max={200}
                  style={{ height: 32 }}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <Label style={{ fontSize: 11 }}>Weight</Label>
                <Select
                  value={localProps.fontWeight as string ?? 'normal'}
                  onValueChange={(value) => handleChange('fontWeight', value)}
                >
                  <SelectTrigger style={{ height: 32 }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_WEIGHTS.map((w) => (
                      <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label style={{ fontSize: 11 }}>Align</Label>
                <Select
                  value={localProps.textAlign as string ?? 'left'}
                  onValueChange={(value) => handleChange('textAlign', value)}
                >
                  <SelectTrigger style={{ height: 32 }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEXT_ALIGNS.map((a) => (
                      <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label style={{ fontSize: 11 }}>Color</Label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="color"
                  value={localProps.fill as string ?? '#000000'}
                  onChange={(e) => handleChange('fill', e.target.value)}
                  style={{ width: 32, height: 32, border: 'none', padding: 0, cursor: 'pointer' }}
                />
                <Input
                  value={localProps.fill as string ?? '#000000'}
                  onChange={(e) => handleChange('fill', e.target.value)}
                  style={{ height: 32, flex: 1 }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shape Properties */}
      {isShape && (
        <div>
          <h4 style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Fill & Stroke
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <Label style={{ fontSize: 11 }}>Fill Color</Label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="color"
                  value={localProps.fill as string ?? '#3b82f6'}
                  onChange={(e) => handleChange('fill', e.target.value)}
                  style={{ width: 32, height: 32, border: 'none', padding: 0, cursor: 'pointer' }}
                />
                <Input
                  value={localProps.fill as string ?? '#3b82f6'}
                  onChange={(e) => handleChange('fill', e.target.value)}
                  style={{ height: 32, flex: 1 }}
                />
              </div>
            </div>
            <div>
              <Label style={{ fontSize: 11 }}>Stroke Color</Label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="color"
                  value={localProps.stroke as string ?? '#000000'}
                  onChange={(e) => handleChange('stroke', e.target.value)}
                  style={{ width: 32, height: 32, border: 'none', padding: 0, cursor: 'pointer' }}
                />
                <Input
                  value={localProps.stroke as string ?? ''}
                  onChange={(e) => handleChange('stroke', e.target.value)}
                  placeholder="None"
                  style={{ height: 32, flex: 1 }}
                />
              </div>
            </div>
            <div>
              <Label style={{ fontSize: 11 }}>Stroke Width</Label>
              <Input
                type="number"
                value={localProps.strokeWidth as number ?? 0}
                onChange={(e) => handleChange('strokeWidth', parseInt(e.target.value) || 0)}
                min={0}
                max={20}
                style={{ height: 32 }}
              />
            </div>
            {selectedObject.type === 'rect' && (
              <div>
                <Label style={{ fontSize: 11 }}>Corner Radius</Label>
                <Input
                  type="number"
                  value={localProps.rx as number ?? 0}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0
                    handleChange('rx', value)
                    handleChange('ry', value)
                  }}
                  min={0}
                  max={50}
                  style={{ height: 32 }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Line Properties */}
      {isLine && (
        <div>
          <h4 style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Stroke
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <Label style={{ fontSize: 11 }}>Color</Label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="color"
                  value={localProps.stroke as string ?? '#000000'}
                  onChange={(e) => handleChange('stroke', e.target.value)}
                  style={{ width: 32, height: 32, border: 'none', padding: 0, cursor: 'pointer' }}
                />
                <Input
                  value={localProps.stroke as string ?? '#000000'}
                  onChange={(e) => handleChange('stroke', e.target.value)}
                  style={{ height: 32, flex: 1 }}
                />
              </div>
            </div>
            <div>
              <Label style={{ fontSize: 11 }}>Width</Label>
              <Input
                type="number"
                value={localProps.strokeWidth as number ?? 2}
                onChange={(e) => handleChange('strokeWidth', parseInt(e.target.value) || 1)}
                min={1}
                max={20}
                style={{ height: 32 }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Field Settings */}
      {(elementType === 'dynamic-text' || elementType === 'image-placeholder') && (
        <div>
          <h4 style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Data Binding
          </h4>
          <div>
            <Label style={{ fontSize: 11 }}>Field ID</Label>
            <Input
              value={localProps.fieldId as string ?? ''}
              onChange={(e) => handleDataChange({ fieldId: e.target.value })}
              placeholder="e.g., firstName, photo"
              style={{ height: 32 }}
            />
            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
              This field will be replaced with user data when printing
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
