import { Upload, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Header with actions */}
      {title && <h2 style={{ fontSize: '0.875rem', fontWeight: 500 }}>{title}</h2>}

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {onUploadClick && (
          <Button variant="outline" size="sm" onClick={onUploadClick} disabled={isLoading} style={{ flex: 1 }}>
            <Upload style={{ width: '0.875rem', height: '0.875rem', marginRight: '0.5rem' }} />
            Upload
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onRetry} disabled={isLoading} style={{ flex: 1 }}>
          <RefreshCw style={{ width: '0.875rem', height: '0.875rem', marginRight: '0.5rem' }} />
          {isLoading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {/* Loading state */}
      {isLoading && templates.length === 0 ? (
        <p style={{ fontSize: '0.875rem', color: '#71717a' }}>Loading templates…</p>
      ) : null}

      {/* Error state */}
      {error ? (
        <p style={{ fontSize: '0.875rem', color: '#dc2626' }}>{error}</p>
      ) : null}

      {/* Empty state */}
      {!isLoading && !error && templates.length === 0 ? (
        <p style={{ fontSize: '0.875rem', color: '#71717a' }}>No templates available yet. Upload one to get started.</p>
      ) : null}

      {/* Template list */}
      {templates.length > 0 && (
        <ScrollArea style={{ maxHeight: '200px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {templates.map((template) => {
              const isSelected = template.id === selectedId
              return (
                <div
                  key={template.id}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(template)}
                    disabled={isLoading}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      textAlign: 'left',
                      border: '1px solid',
                      borderColor: isSelected ? '#18181b' : '#e4e4e7',
                      backgroundColor: isSelected ? '#fafafa' : '#fff',
                      borderRadius: '0.375rem',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected && !isLoading) {
                        e.currentTarget.style.backgroundColor = '#f9f9f9'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = '#fff'
                      }
                    }}
                  >
                    <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{template.name}</span>
                    {template.description && (
                      <span style={{ fontSize: '0.75rem', color: '#71717a' }}>{template.description}</span>
                    )}
                  </button>

                  {onDelete && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(template)
                      }}
                      disabled={isLoading}
                      title="Delete template"
                      style={{ flexShrink: 0, padding: '0.5rem' }}
                    >
                      <Trash2 style={{ width: '0.875rem', height: '0.875rem', color: '#dc2626' }} />
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
