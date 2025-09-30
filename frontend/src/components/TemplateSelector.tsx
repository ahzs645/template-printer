import '../App.css'

import type { TemplateSummary } from '../lib/templates'

type TemplateSelectorProps = {
  title?: string
  templates: TemplateSummary[]
  selectedId: string | null
  isLoading: boolean
  error: string | null
  onSelect: (template: TemplateSummary) => void
  onRetry: () => void
  onUploadClick?: () => void
  onDelete?: (template: TemplateSummary) => void
}

export function TemplateSelector({
  title = 'Templates',
  templates,
  selectedId,
  isLoading,
  error,
  onSelect,
  onRetry,
  onUploadClick,
  onDelete,
}: TemplateSelectorProps) {
  return (
    <div className="template-selector">
      <div className="template-selector__header">
        <h2>{title}</h2>
        <div className="template-selector__actions">
          {onUploadClick && (
            <button className="secondary" type="button" onClick={onUploadClick} disabled={isLoading}>
              Upload Template
            </button>
          )}
          <button className="secondary" type="button" onClick={onRetry} disabled={isLoading}>
            {isLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {isLoading && templates.length === 0 ? <p className="muted">Loading templates…</p> : null}

      {error ? <p className="error-message">{error}</p> : null}

      {!isLoading && !error && templates.length === 0 ? (
        <p className="muted">No templates available yet. Upload one to get started.</p>
      ) : null}

      <div className="template-grid">
        {templates.map((template) => {
          const isSelected = template.id === selectedId
          return (
            <div key={template.id} className="template-card-container">
              <button
                type="button"
                className={`template-card${isSelected ? ' is-selected' : ''}`}
                onClick={() => onSelect(template)}
                disabled={isLoading}
              >
                <div className="template-card__body">
                  <div className="template-card__meta">
                    <span className="template-card__name">{template.name}</span>
                    {template.description ? (
                      <span className="template-card__description">{template.description}</span>
                    ) : null}
                  </div>
                </div>
              </button>
              {onDelete ? (
                <button
                  type="button"
                  className="template-card__delete"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(template)
                  }}
                  disabled={isLoading}
                  title="Delete template"
                >
                  ×
                </button>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
