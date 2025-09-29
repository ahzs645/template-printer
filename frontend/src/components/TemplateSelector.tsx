import { useEffect, useState } from 'react'

import '../App.css'

export type TemplateSummary = {
  id: string
  name: string
  description?: string
  svgPath: string
  thumbnailPath?: string | null
}

type TemplateSelectorProps = {
  selectedId: string | null
  onSelect: (template: TemplateSummary) => void
}

export function TemplateSelector({ selectedId, onSelect }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<TemplateSummary[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const response = await fetch('/api/templates')
        if (!response.ok) {
          throw new Error(`Failed to load templates (${response.status})`)
        }
        const data: TemplateSummary[] = await response.json()
        setTemplates(data)
      } catch (err) {
        console.error(err)
        setError(err instanceof Error ? err.message : 'Unable to load templates')
      }
    })()
  }, [])

  if (error) {
    return (
      <div className="template-selector">
        <h2>Templates</h2>
        <p className="error-message">{error}</p>
      </div>
    )
  }

  if (templates.length === 0) {
    return (
      <div className="template-selector">
        <h2>Templates</h2>
        <p className="muted">No templates available yet. Upload one to get started.</p>
      </div>
    )
  }

  return (
    <div className="template-selector">
      <h2>Templates</h2>
      <div className="template-grid">
        {templates.map((template) => {
          const isSelected = template.id === selectedId
          return (
            <button
              key={template.id}
              type="button"
              className={`template-card${isSelected ? ' is-selected' : ''}`}
              onClick={() => onSelect(template)}
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
          )
        })}
      </div>
    </div>
  )
}
