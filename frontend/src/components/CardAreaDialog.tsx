import { useEffect, useMemo, useState } from 'react'
import { Download, Ruler } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Button } from './ui/button'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Switch } from './ui/switch'
import {
  CARD_FORMATS,
  applyCardArea,
  describeCandidate,
  type AppliedCardArea,
  type Box,
  type CardFormat,
  type TrimCandidate,
} from '../lib/cardTrim'
import type { TemplateMeta } from '../lib/types'

export type CardAreaDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: TemplateMeta | null
  onApply: (applied: AppliedCardArea, formatId: string, keepBleed: boolean) => void
}

const WHOLE_CANVAS = '__canvas__'
const PX_PER_MM = 3.779527559055

function round(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Choose which rectangle in the artwork is the card.
 *
 * Nothing is inferred: the detected trim lines are listed as options next to
 * "the whole canvas", which is what the app assumes until told otherwise.
 */
export function CardAreaDialog({ open, onOpenChange, template, onApply }: CardAreaDialogProps) {
  const canvas: Box | null = useMemo(() => {
    if (!template) return null
    return template.viewBox ?? { x: 0, y: 0, width: template.width, height: template.height }
  }, [template])

  const candidates: TrimCandidate[] = useMemo(() => template?.trimCandidates ?? [], [template])
  const [selectedId, setSelectedId] = useState<string>(WHOLE_CANVAS)
  const [formatId, setFormatId] = useState<string>(CARD_FORMATS[0].id)
  const [keepBleed, setKeepBleed] = useState(true)
  const [removeTrimLine, setRemoveTrimLine] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    const best = candidates[0]
    setSelectedId(best?.id ?? WHOLE_CANVAS)
    if (best?.bestFormat) setFormatId(best.bestFormat.id)
    setKeepBleed(Boolean(best))
  }, [open, candidates])

  const selected = candidates.find((candidate) => candidate.id === selectedId) ?? null
  const format = CARD_FORMATS.find((entry) => entry.id === formatId) ?? CARD_FORMATS[0]

  const applied = useMemo<AppliedCardArea | null>(() => {
    if (!template || !canvas || !selected) return null
    try {
      return applyCardArea(template.rawSvg, canvas, {
        box: selected.box,
        format,
        keepBleed,
        removeTrimLine: removeTrimLine && selected.outlineOnly,
      })
    } catch (cause) {
      console.error(cause)
      return null
    }
  }, [template, canvas, selected, format, keepBleed, removeTrimLine])

  // What the app is using right now, for comparison.
  const current = template
    ? {
        widthMm: template.unit === 'mm' ? template.width : template.width / PX_PER_MM,
        heightMm: template.unit === 'mm' ? template.height : template.height / PX_PER_MM,
      }
    : null

  const handleDownload = () => {
    if (!applied || !template) return
    const blob = new Blob([applied.svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = template.name.replace(/\.svg$/i, '') + (keepBleed ? '-sized.svg' : '-trimmed.svg')
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ maxWidth: '680px' }}>
        <DialogHeader>
          <DialogTitle>Card area</DialogTitle>
          <DialogDescription>
            Which rectangle in this artwork is the card. Until one is chosen the whole canvas is
            treated as the card, and its physical size is guessed from the units in the file.
          </DialogDescription>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {candidates.length === 0 && (
            <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
              No trim line was found in this template, so the whole canvas is the card. If the
              artwork does have one, draw it as a rectangle inset evenly from the edge and re-import.
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Label>The card is</Label>
            <label
              style={{
                display: 'flex',
                gap: '0.625rem',
                alignItems: 'flex-start',
                border: `1px solid ${selectedId === WHOLE_CANVAS ? '#18181b' : '#e4e4e7'}`,
                borderRadius: '0.5rem',
                padding: '0.625rem 0.75rem',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="card-area"
                checked={selectedId === WHOLE_CANVAS}
                onChange={() => setSelectedId(WHOLE_CANVAS)}
                style={{ marginTop: 3 }}
              />
              <span>
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>The whole canvas</span>
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280' }}>
                  {canvas ? `${round(canvas.width)} × ${round(canvas.height)} units` : ''} — what the app
                  does today, with no trim line taken into account.
                </span>
              </span>
            </label>

            {candidates.map((candidate) => (
              <label
                key={candidate.id}
                style={{
                  display: 'flex',
                  gap: '0.625rem',
                  alignItems: 'flex-start',
                  border: `1px solid ${selectedId === candidate.id ? '#18181b' : '#e4e4e7'}`,
                  borderRadius: '0.5rem',
                  padding: '0.625rem 0.75rem',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="card-area"
                  checked={selectedId === candidate.id}
                  onChange={() => setSelectedId(candidate.id)}
                  style={{ marginTop: 3 }}
                />
                <span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                    The trim line ({round(candidate.box.width)} × {round(candidate.box.height)} units)
                  </span>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280' }}>
                    {canvas ? describeCandidate(candidate, canvas) : ''}
                  </span>
                </span>
              </label>
            ))}
          </div>

          {selected && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <Label>Printed size</Label>
                <Select value={formatId} onValueChange={setFormatId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARD_FORMATS.map((entry: CardFormat) => (
                      <SelectItem key={entry.id} value={entry.id}>
                        {entry.label} — {entry.widthMm} × {entry.heightMm} mm
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {format.note && (
                  <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>{format.note}</p>
                )}
              </div>

              {selected.outlineOnly && (
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', fontSize: '0.875rem' }}>
                  <Switch checked={removeTrimLine} onCheckedChange={setRemoveTrimLine} />
                  <span>
                    Remove the trim line from the card
                    <span style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280' }}>
                      It is drawn as a stroke with no fill, so it prints as a border on the finished
                      card. Once it has been used to set the scale there is nothing else it does.
                    </span>
                  </span>
                </label>
              )}

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', fontSize: '0.875rem' }}>
                <Switch checked={keepBleed} onCheckedChange={setKeepBleed} />
                <span>
                  Keep the bleed
                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280' }}>
                    On, the artwork is untouched and only its printed size is corrected, so the trim
                    line lands at exactly {format.widthMm} × {format.heightMm} mm with the margin still
                    there to cut through. Off, the artwork is cropped to the trim line and the bleed is
                    discarded.
                  </span>
                </span>
              </label>
            </>
          )}

          <div
            style={{
              background: '#f4f4f5',
              borderRadius: '0.5rem',
              padding: '0.75rem',
              fontSize: '0.8125rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.375rem',
            }}
          >
            {current && (
              <div style={{ color: '#6b7280' }}>
                Now printing at <strong>{round(current.widthMm)} × {round(current.heightMm)} mm</strong>
              </div>
            )}
            {applied ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Ruler size={14} />
                  Would print at{' '}
                  <strong>
                    {applied.widthMm} × {applied.heightMm} mm
                  </strong>
                  {keepBleed && (
                    <span style={{ color: '#6b7280' }}>
                      (card {format.widthMm} × {format.heightMm} mm plus bleed)
                    </span>
                  )}
                </div>
                {applied.bleedMm && (
                  <div style={{ color: '#6b7280' }}>
                    Bleed: {applied.bleedMm.top} mm top, {applied.bleedMm.right} mm right,{' '}
                    {applied.bleedMm.bottom} mm bottom, {applied.bleedMm.left} mm left.
                  </div>
                )}
              </>
            ) : (
              <div style={{ color: '#6b7280' }}>Pick a rectangle to see the printed size.</div>
            )}
            {applied?.trimLineRemoved && (
              <div style={{ color: '#6b7280' }}>The trim line is taken out, so it will not print.</div>
            )}
            <div style={{ color: '#6b7280' }}>
              This applies to the template open in the editor. Download the adjusted SVG to keep it.
            </div>
          </div>

          {error && <p style={{ fontSize: '0.8125rem', color: '#b91c1c', margin: 0 }}>{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="outline" onClick={handleDownload} disabled={!applied}>
            <Download size={16} style={{ marginRight: 6 }} />
            Download adjusted SVG
          </Button>
          <Button
            type="button"
            disabled={!applied}
            onClick={() => {
              if (!applied) return
              try {
                onApply(applied, format.id, keepBleed)
                onOpenChange(false)
              } catch (cause) {
                console.error(cause)
                setError(cause instanceof Error ? cause.message : 'Could not apply the card area.')
              }
            }}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
