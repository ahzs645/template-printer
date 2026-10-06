import { useRef, useState } from 'react'
import { Check, Pencil, Plus, Star, Trash2, Upload, X } from 'lucide-react'

import { Button } from './ui/button'
import { Input } from './ui/input'
import type { CardDesign } from '../lib/types'
import type { TemplateSummary } from '../lib/templates'
import { getDesignVariants, VARIANT_FIELDS, type CardDesignVariant } from '../lib/designVariants'
import { cn } from '../lib/utils'

type VariantsPanelProps = {
  design: CardDesign
  activeVariantId: string | null
  templates: TemplateSummary[]
  busy?: boolean
  onSelect: (variant: CardDesignVariant) => void
  onAddFromFiles: (files: File[]) => void
  onAddFromLibrary: (templateId: string) => void
  onRename: (variant: CardDesignVariant, name: string) => void
  onRemove: (variant: CardDesignVariant) => void
  onMakeDefault: (variant: CardDesignVariant) => void
  onVariantFieldChange: (field: string | null) => void
  onMatchChange: (variant: CardDesignVariant, values: string) => void
}

const FIELD_LABELS: Record<string, string> = {
  position: 'Position',
  department: 'Department',
  grade: 'Grade',
}

/**
 * The looks a card design comes in. Each variant is its own front artwork;
 * fields, mappings, the back and the data typed in are shared, so switching
 * between them is a change of artwork and nothing else.
 */
export function VariantsPanel({
  design,
  activeVariantId,
  templates,
  busy = false,
  onSelect,
  onAddFromFiles,
  onAddFromLibrary,
  onRename,
  onRemove,
  onMakeDefault,
  onVariantFieldChange,
  onMatchChange,
}: VariantsPanelProps) {
  const variants = getDesignVariants(design)
  const fileInput = useRef<HTMLInputElement>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [picking, setPicking] = useState(false)

  const usedTemplateIds = new Set(variants.map((variant) => variant.frontTemplateId))
  if (design.backTemplateId) usedTemplateIds.add(design.backTemplateId)
  const candidates = templates.filter((template) => !usedTemplateIds.has(template.id))
  const perPerson = Boolean(design.variantField)

  return (
    <div className="flex flex-col gap-2">
      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
        {variants.length > 1
          ? 'Each variant is a different front. Fields, mappings and the back are shared.'
          : 'Add another front for this card — a different watermark, a version with a punch — and it shares these fields and this back.'}
      </p>

      <div className="flex flex-col gap-1" role="listbox" aria-label="Variants">
        {variants.map((variant, index) => {
          const active = variant.id === activeVariantId
          const templateName = templates.find((template) => template.id === variant.frontTemplateId)?.name
          return (
            <div
              key={variant.id}
              className={cn('rounded-md border px-2 py-1.5', active ? 'border-accent bg-hover' : 'border-line')}
            >
              {editingId === variant.id ? (
                <form
                  className="flex items-center gap-1"
                  onSubmit={(event) => {
                    event.preventDefault()
                    const name = draft.trim()
                    if (name) onRename(variant, name)
                    setEditingId(null)
                  }}
                >
                  <Input value={draft} onChange={(event) => setDraft(event.target.value)} autoFocus className="h-7 text-xs" aria-label="Variant name" />
                  <Button type="submit" size="icon" variant="ghost" className="h-7 w-7" title="Save name">
                    <Check size={14} />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7" title="Cancel" onClick={() => setEditingId(null)}>
                    <X size={14} />
                  </Button>
                </form>
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    className="flex-1 text-left text-sm"
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit' }}
                    onClick={() => onSelect(variant)}
                    disabled={busy}
                    title={templateName ? `Front: ${templateName}` : undefined}
                  >
                    <span style={{ fontWeight: active ? 600 : 400 }}>{variant.name}</span>
                    {index === 0 && variants.length > 1 && (
                      <span style={{ fontSize: 10, marginLeft: 6, color: 'var(--text-muted)' }}>default</span>
                    )}
                  </button>
                  {index > 0 && (
                    <Button type="button" size="icon" variant="ghost" className="h-6 w-6" title="Make this the default" onClick={() => onMakeDefault(variant)} disabled={busy}>
                      <Star size={13} />
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    title="Rename"
                    onClick={() => {
                      setEditingId(variant.id)
                      setDraft(variant.name)
                    }}
                    disabled={busy}
                  >
                    <Pencil size={13} />
                  </Button>
                  {variants.length > 1 && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      title="Remove from this design (the template stays in the library)"
                      onClick={() => onRemove(variant)}
                      disabled={busy}
                    >
                      <Trash2 size={13} />
                    </Button>
                  )}
                </div>
              )}
              {perPerson && (
                <Input
                  key={`${variant.id}-${(variant.match ?? []).join('|')}`}
                  className="mt-1 h-7 text-xs"
                  defaultValue={(variant.match ?? []).join(', ')}
                  placeholder={`${FIELD_LABELS[design.variantField!] ?? design.variantField} values, e.g. Staff, Faculty`}
                  aria-label={`Values that select ${variant.name}`}
                  onBlur={(event) => onMatchChange(variant, event.target.value)}
                  disabled={busy}
                />
              )}
            </div>
          )
        })}
      </div>

      <div className="flex gap-1">
        <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => fileInput.current?.click()} disabled={busy}>
          <Upload size={14} /> Add SVG…
        </Button>
        <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => setPicking((open) => !open)} disabled={busy || candidates.length === 0}>
          <Plus size={14} /> From library
        </Button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept=".svg,image/svg+xml"
        multiple
        style={{ display: 'none' }}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          event.target.value = ''
          if (files.length) onAddFromFiles(files)
        }}
      />
      {picking && candidates.length > 0 && (
        <select
          className="h-8 rounded-control border border-line bg-surface px-2 text-sm text-ink"
          defaultValue=""
          onChange={(event) => {
            if (event.target.value) onAddFromLibrary(event.target.value)
            setPicking(false)
          }}
          aria-label="Template to add as a variant"
        >
          <option value="" disabled>
            Choose a template…
          </option>
          {candidates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      )}

      {variants.length > 1 && (
        <label className="flex flex-col gap-1" style={{ fontSize: 12 }}>
          <span>Variant for each person</span>
          <select
            className="h-8 rounded-control border border-line bg-surface px-2 text-sm text-ink"
            value={design.variantField ?? ''}
            onChange={(event) => onVariantFieldChange(event.target.value || null)}
            disabled={busy}
          >
            <option value="">Same for everyone (the one open)</option>
            {VARIANT_FIELDS.map((field) => (
              <option key={field} value={field}>
                Chosen by {FIELD_LABELS[field].toLowerCase()}
              </option>
            ))}
          </select>
          {perPerson && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              A batch export prints each person with the variant listing their {FIELD_LABELS[design.variantField!]?.toLowerCase() ?? design.variantField};
              anyone else gets the variant that is open.
            </span>
          )}
        </label>
      )}
    </div>
  )
}
