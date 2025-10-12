import { useState } from 'react'
import { Upload, RefreshCw, Trash2, Pencil, Check, X } from 'lucide-react'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'
import { Input } from './ui/input'
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
  onRename?: (template: TemplateSummary, nextName: string) => Promise<void> | void
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
  onRename,
}: TemplateSelectorProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)
  const [renaming, setRenaming] = useState(false)

  const startRename = (template: TemplateSummary) => {
    setEditingId(template.id)
    setDraftName(template.name)
    setRenameError(null)
  }

  const cancelRename = () => {
    setEditingId(null)
    setDraftName('')
    setRenameError(null)
    setRenaming(false)
  }

  const submitRename = async (template: TemplateSummary) => {
    if (!onRename) return
    const trimmed = draftName.trim()
    if (!trimmed) {
      setRenameError('Name cannot be empty.')
      return
    }

    if (trimmed === template.name.trim()) {
      cancelRename()
      return
    }

    setRenaming(true)
    try {
      await onRename(template, trimmed)
      setEditingId(null)
      setDraftName('')
      setRenameError(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to rename template'
      setRenameError(message)
    } finally {
      setRenaming(false)
    }
  }

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
              const isEditing = editingId === template.id
              return (
                <div
                  key={template.id}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem'
                  }}
                >
                  {isEditing ? (
                    <div
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        border: '1px solid #e4e4e7',
                        backgroundColor: '#fff',
                        borderRadius: '0.375rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                      }}
                    >
                      <div>
                        <Input
                          value={draftName}
                          autoFocus
                          disabled={renaming}
                          onChange={(event) => {
                            setDraftName(event.target.value)
                            if (renameError) {
                              setRenameError(null)
                            }
                          }}
                          placeholder="Template name"
                        />
                      </div>
                      {renameError && (
                        <p style={{ fontSize: '0.75rem', color: '#dc2626' }}>{renameError}</p>
                      )}
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Button
                          size="sm"
                          onClick={() => submitRename(template)}
                          disabled={renaming}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          <Check style={{ width: '0.875rem', height: '0.875rem' }} />
                          {renaming ? 'Saving…' : 'Save'}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={cancelRename}
                          disabled={renaming}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          <X style={{ width: '0.875rem', height: '0.875rem' }} />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
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
                  )}

                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    {onRename && !isEditing && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          startRename(template)
                        }}
                        disabled={isLoading}
                        title="Rename template"
                        style={{ flexShrink: 0, padding: '0.5rem' }}
                      >
                        <Pencil style={{ width: '0.875rem', height: '0.875rem' }} />
                      </Button>
                    )}

                    {onDelete && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDelete(template)
                        }}
                        disabled={isLoading || renaming}
                        title="Delete template"
                        style={{ flexShrink: 0, padding: '0.5rem' }}
                      >
                        <Trash2 style={{ width: '0.875rem', height: '0.875rem', color: '#dc2626' }} />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
