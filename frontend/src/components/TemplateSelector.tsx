import { useState } from 'react'
import { Upload, RefreshCw, Trash2, Pencil, Check, X } from 'lucide-react'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'
import { Input } from './ui/input'
import type { TemplateSummary } from '../lib/templates'
import { cn } from '../lib/utils'

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
    <div className="flex flex-col gap-3">
      {/* Header with actions */}
      {title && <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</h2>}

      <div className="flex gap-2">
        {onUploadClick && (
          <Button variant="outline" size="sm" onClick={onUploadClick} disabled={isLoading} className="flex-1">
            <Upload className="mr-2 h-3.5 w-3.5" />
            Upload
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onRetry} disabled={isLoading} className="flex-1">
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          {isLoading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {/* Loading state */}
      {isLoading && templates.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading templates…</p>
      ) : null}

      {/* Error state */}
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      {/* Empty state */}
      {!isLoading && !error && templates.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No templates available yet. Upload one to get started.</p>
      ) : null}

      {/* Template list */}
      {templates.length > 0 && (
        <ScrollArea className="max-h-[200px]">
          <div className="flex flex-col gap-2">
            {templates.map((template) => {
              const isSelected = template.id === selectedId
              const isEditing = editingId === template.id
              return (
                <div
                  key={template.id}
                  className="relative flex items-start gap-2"
                >
                  {isEditing ? (
                    <div
                      className="flex flex-1 flex-col gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900/60"
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
                        <p className="text-xs text-red-600 dark:text-red-400">{renameError}</p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => submitRename(template)}
                          disabled={renaming}
                          className="flex items-center gap-1"
                        >
                          <Check className="h-3.5 w-3.5" />
                          {renaming ? 'Saving…' : 'Save'}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={cancelRename}
                          disabled={renaming}
                          className="flex items-center gap-1"
                        >
                          <X className="h-3.5 w-3.5" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelect(template)}
                      disabled={isLoading}
                      className={cn(
                        'flex flex-1 flex-col gap-1 rounded-md border p-3 text-left text-zinc-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:text-zinc-100 dark:focus-visible:ring-zinc-300 dark:focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed',
                        isSelected
                          ? 'border-zinc-900 bg-zinc-100 dark:border-zinc-500 dark:bg-zinc-800'
                          : 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/50 dark:hover:bg-zinc-800/70'
                      )}
                    >
                      <span className="text-sm font-medium">{template.name}</span>
                      {template.description && (
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">{template.description}</span>
                      )}
                    </button>
                  )}

                  <div className="flex gap-1">
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
                        className="shrink-0 px-2"
                      >
                        <Pencil className="h-3.5 w-3.5" />
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
                        className="shrink-0 px-2"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
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
