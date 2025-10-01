import { FileDown, Copy, Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { CardDataPanel } from './CardDataPanel'
import { FieldEditorPanel } from './FieldEditorPanel'
import { PreviewField } from './PreviewField'
import type { CardData, CardDataValue, FieldDefinition, ImageValue, TemplateMeta } from '../lib/types'
import type { ExportOptions } from './ExportPage'

export type PreviewWorkspaceProps = {
  template: TemplateMeta | null
  renderedSvg: string | null
  fields: FieldDefinition[]
  cardData: CardData
  selectedField: FieldDefinition | null
  onCardDataChange: (fieldId: string, value: string) => void
  onImageUpload: (fieldId: string, file: File) => void
  onImageAdjust: (fieldId: string, patch: Partial<ImageValue>) => void
  onFieldChange: <K extends keyof FieldDefinition>(fieldId: string, key: K, value: FieldDefinition[K]) => void
  onDuplicateField: (fieldId: string) => void
  onDeleteField: (fieldId: string) => void
  fontOptions: string[]
  missingFonts: string[]
  onExportPdf: (options: ExportOptions) => void
  isExporting: boolean
  previewWidth: number
  previewHeight: number
}

export function PreviewWorkspace({
  template,
  renderedSvg,
  fields,
  cardData,
  selectedField,
  onCardDataChange,
  onImageUpload,
  onImageAdjust,
  onFieldChange,
  onDuplicateField,
  onDeleteField,
  fontOptions,
  missingFonts,
  onExportPdf,
  isExporting,
  previewWidth,
  previewHeight,
}: PreviewWorkspaceProps) {
  return (
    <section style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0, minHeight: 0, height: '100%' }}>
      {/* Header with Quick Export */}
      <Card>
        <CardHeader>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div>
              <CardTitle style={{ fontSize: '1rem' }}>Live Preview</CardTitle>
              <CardDescription>
                Fields are positioned relative to the template. Adjust values to fine-tune placement.
              </CardDescription>
            </div>
            <Button
              onClick={() => onExportPdf({ format: 'pdf', resolution: 300, maintainVectors: true, printLayoutId: null, mode: 'quick', selectedUserIds: [] })}
              disabled={!template || isExporting}
              size="sm"
            >
              <FileDown style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
              {isExporting ? 'Exporting…' : 'Quick Export PDF'}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Main Preview Layout */}
      <div style={{ display: 'flex', gap: '1rem', flex: 1, minHeight: 0 }}>
        {/* Preview Canvas */}
        <Card style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <CardContent style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '1.5rem', overflow: 'auto' }}>
            <div style={{
              width: previewWidth,
              height: previewHeight,
              position: 'relative',
              border: '1px solid #e4e4e7',
              borderRadius: '0.375rem',
              backgroundColor: '#fff',
              boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
              flexShrink: 0
            }}>
              {template && renderedSvg ? (
                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                  <div style={{ position: 'absolute', inset: 0 }} dangerouslySetInnerHTML={{ __html: renderedSvg }} />
                  {fields.map((field) => (
                    <PreviewField
                      key={`preview-${field.id}`}
                      field={field}
                      value={cardData[field.id] as CardDataValue}
                      width={previewWidth}
                      height={previewHeight}
                    />
                  ))}
                </div>
              ) : (
                <div style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#71717a',
                  fontSize: '0.875rem'
                }}>
                  <p>Upload an SVG template to see the live preview.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right Sidebar - Card Data & Field Settings */}
        <div style={{ width: '280px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 0 }}>
          {/* Card Data */}
          <Card>
            <CardHeader>
              <CardTitle style={{ fontSize: '1rem' }}>Card Data</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDataPanel
                fields={fields}
                cardData={cardData}
                onTextChange={onCardDataChange}
                onImageUpload={onImageUpload}
                onImageAdjust={onImageAdjust}
              />
            </CardContent>
          </Card>

          {/* Field Settings */}
          <Card style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <CardHeader>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <CardTitle style={{ fontSize: '1rem' }}>Field Settings</CardTitle>
                {selectedField && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDuplicateField(selectedField.id)}
                      title="Duplicate field"
                    >
                      <Copy style={{ width: '0.875rem', height: '0.875rem' }} />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDeleteField(selectedField.id)}
                      title="Delete field"
                    >
                      <Trash2 style={{ width: '0.875rem', height: '0.875rem', color: '#dc2626' }} />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              {selectedField ? (
                <FieldEditorPanel
                  field={selectedField}
                  onChange={onFieldChange}
                  fontOptions={fontOptions}
                  missingFonts={missingFonts}
                />
              ) : (
                <p style={{ fontSize: '0.875rem', color: '#71717a' }}>
                  Select a field to edit its properties.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}
