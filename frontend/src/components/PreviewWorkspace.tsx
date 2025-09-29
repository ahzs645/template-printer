import { CardDataPanel } from './CardDataPanel'
import { FieldEditorPanel } from './FieldEditorPanel'
import { PreviewField } from './PreviewField'
import type { CardData, CardDataValue, FieldDefinition, ImageValue, TemplateMeta } from '../lib/types'

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
  onExportPdf: () => void
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
    <section className="preview">
      <div className="preview-header">
        <div>
          <h2>Live Preview</h2>
          <p className="muted">Fields are positioned relative to the template. Adjust values to fine-tune placement.</p>
        </div>
        <button className="primary" type="button" onClick={onExportPdf} disabled={!template || isExporting}>
          {isExporting ? 'Exporting…' : 'Export PDF'}
        </button>
      </div>

      <div className="preview-layout">
        <div className="preview-viewport">
          <div className="preview-canvas" style={{ width: previewWidth, height: previewHeight }}>
            {template && renderedSvg ? (
              <div className="preview-stack">
                <div className="preview-svg" dangerouslySetInnerHTML={{ __html: renderedSvg }} />
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
              <div className="preview-placeholder">
                <p>Upload an SVG template to see the live preview.</p>
              </div>
            )}
          </div>
        </div>

        <div className="preview-sidebar">
          <div className="section-block">
            <h3>Card Data</h3>
            <CardDataPanel
              fields={fields}
              cardData={cardData}
              onTextChange={onCardDataChange}
              onImageUpload={onImageUpload}
              onImageAdjust={onImageAdjust}
            />
          </div>
          <div className="section-block">
            <div className="field-header">
              <h3>Field Settings</h3>
              {selectedField ? (
                <div className="field-actions">
                  <button className="secondary" type="button" onClick={() => onDuplicateField(selectedField.id)}>
                    Duplicate
                  </button>
                  <button className="danger" type="button" onClick={() => onDeleteField(selectedField.id)}>
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
            {selectedField ? (
              <FieldEditorPanel
                field={selectedField}
                onChange={onFieldChange}
                fontOptions={fontOptions}
                missingFonts={missingFonts}
              />
            ) : (
              <p className="muted">Select a field to edit its properties.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
