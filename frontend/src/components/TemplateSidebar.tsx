import { useRef, type ChangeEvent } from 'react'

import { CollapsibleSection } from './CollapsibleSection'
import { TemplateSelector } from './TemplateSelector'
import type { FieldDefinition } from '../lib/types'
import type { FontEntry } from '../hooks/useFontManager'
import type { TemplateSummary } from '../lib/templates'

export type TemplateSidebarProps = {
  selectedTemplateId: string | null
  designTemplates: TemplateSummary[]
  designTemplatesLoading: boolean
  designTemplatesError: string | null
  onRefreshDesignTemplates: () => void
  onTemplateSelect: (template: TemplateSummary) => void
  onTemplateUpload: (event: ChangeEvent<HTMLInputElement>) => void
  onTemplateDelete: (template: TemplateSummary) => void
  statusMessage: string | null
  errorMessage: string | null
  fontList: FontEntry[]
  missingFonts: string[]
  onFontUploadClick: (fontName: string) => void
  onFontFileSelect: (fontName: string, event: ChangeEvent<HTMLInputElement>) => void
  registerFontInput: (fontName: string, element: HTMLInputElement | null) => void
  fields: FieldDefinition[]
  selectedFieldId: string | null
  onFieldSelect: (fieldId: string) => void
  onAddField: () => void
}

export function TemplateSidebar({
  selectedTemplateId,
  designTemplates,
  designTemplatesLoading,
  designTemplatesError,
  onRefreshDesignTemplates,
  onTemplateSelect,
  onTemplateUpload,
  onTemplateDelete,
  statusMessage,
  errorMessage,
  fontList,
  missingFonts,
  onFontUploadClick,
  onFontFileSelect,
  registerFontInput,
  fields,
  selectedFieldId,
  onFieldSelect,
  onAddField,
}: TemplateSidebarProps) {
  const templateUploadInputRef = useRef<HTMLInputElement | null>(null)

  const handleTemplateUploadClick = () => {
    templateUploadInputRef.current?.click()
  }

  return (
    <section className="controls">
      <div className="section-block">
        <TemplateSelector
          title="Card Design Templates"
          templates={designTemplates}
          selectedId={selectedTemplateId}
          isLoading={designTemplatesLoading}
          error={designTemplatesError}
          onSelect={onTemplateSelect}
          onRetry={onRefreshDesignTemplates}
          onUploadClick={handleTemplateUploadClick}
          onDelete={onTemplateDelete}
        />
        <input
          ref={templateUploadInputRef}
          className="template-upload-input"
          type="file"
          accept="image/svg+xml"
          onChange={onTemplateUpload}
        />
        {statusMessage ? <p className="status-message">{statusMessage}</p> : null}
        {errorMessage ? <p className="error-message">{errorMessage}</p> : null}
      </div>

      <div className="section-block">
        <CollapsibleSection
          title="Fonts"
          defaultOpen={fontList.length > 0}
          description={renderFontSectionDescription(fontList.length, missingFonts)}
        >
          {fontList.length === 0 ? (
            <p className="muted">Fonts from the template appear here once an SVG is imported.</p>
          ) : (
            <div className="font-list">
              {fontList.map((font) => (
                <div className="font-list__item" key={font.name}>
                  <div className="font-list__info">
                    <span className="font-name">{font.name}</span>
                    <span className={`font-badge font-badge--${font.status}`}>
                      {font.status === 'loaded' ? 'Loaded' : 'Missing'}
                    </span>
                    <span className="font-source">
                      {font.source === 'template' ? 'Template font' : 'Custom font'}
                    </span>
                    {font.fileName ? <span className="font-file">{font.fileName}</span> : null}
                  </div>
                  <div className="font-actions">
                    <button className="secondary" type="button" onClick={() => onFontUploadClick(font.name)}>
                      {font.status === 'loaded' ? 'Replace' : 'Upload'}
                    </button>
                    <input
                      ref={(element) => registerFontInput(font.name, element)}
                      className="font-upload-input"
                      type="file"
                      accept=".ttf,.otf,.woff,.woff2"
                      onChange={(event) => onFontFileSelect(font.name, event)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>
      </div>

      <div className="section-block">
        <CollapsibleSection
          title="Fields"
          actions={
            <button className="secondary" onClick={onAddField} type="button">
              + Add Field
            </button>
          }
        >
          {fields.length === 0 ? (
            <p className="muted">Upload a template or add a new field to get started.</p>
          ) : (
            <div className="field-list">
              {fields.map((field) => (
                <button
                  key={field.id}
                  type="button"
                  className={`field-list__item${field.id === selectedFieldId ? ' is-selected' : ''}`}
                  onClick={() => onFieldSelect(field.id)}
                >
                  <span className="field-title">{field.label}</span>
                  <span className="field-type">{field.type}</span>
                  {field.auto ? <span className="field-tag">auto</span> : null}
                </button>
              ))}
            </div>
          )}
        </CollapsibleSection>
      </div>
    </section>
  )
}

function renderFontSectionDescription(fontCount: number, missingFonts: string[]) {
  if (fontCount === 0) {
    return <span className="font-status muted">Load a template to detect fonts</span>
  }

  if (missingFonts.length > 0) {
    return <span className="font-status font-status--missing">Missing: {missingFonts.join(', ')}</span>
  }

  return <span className="font-status font-status--ready">All fonts loaded</span>
}
