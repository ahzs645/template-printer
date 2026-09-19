import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Button } from './ui/button'
import { InlineSvg } from './InlineSvg'
import { countIssues, runTestCards, type TestCardResult } from '../lib/testCards'
import type { FieldDefinition, TemplateMeta } from '../lib/types'

export type TestCardsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: TemplateMeta | null
  fields: FieldDefinition[]
  fieldMappings: Record<string, string>
  customValues?: Record<string, string>
}

type Filter = 'all' | 'problems'

/**
 * Run the template against the records that break cards, and show the results
 * as a contact sheet with the problems called out.
 */
export function TestCardsDialog({
  open,
  onOpenChange,
  template,
  fields,
  fieldMappings,
  customValues = {},
}: TestCardsDialogProps) {
  const [filter, setFilter] = useState<Filter>('all')

  const results = useMemo<TestCardResult[]>(() => {
    if (!open || !template) return []
    return runTestCards(template, fields, fieldMappings, customValues)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, template, fields, fieldMappings, customValues])

  const totals = useMemo(() => countIssues(results), [results])
  const shown = filter === 'problems' ? results.filter((result) => result.issues.length > 0) : results

  const aspect = template ? (template.viewBox?.height ?? template.height) / (template.viewBox?.width ?? template.width) : 0.63
  const cardWidth = 230

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ maxWidth: '1100px', width: '95vw', maxHeight: '88vh', overflow: 'auto' }}>
        <DialogHeader>
          <DialogTitle>Test cards</DialogTitle>
          <DialogDescription>
            The template rendered against the records that break ID cards — short and long names,
            missing middle names, accents, apostrophes, values a barcode cannot encode. Anything that
            overflows, gets shrunk, or fails to encode is called out under the card.
          </DialogDescription>
        </DialogHeader>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: totals.errors ? 'var(--danger)' : 'var(--success)' }}>
              {totals.errors ? <XCircle size={15} /> : <CheckCircle2 size={15} />}
              {totals.errors} error{totals.errors === 1 ? '' : 's'}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: totals.warnings ? 'var(--warning)' : 'var(--text-muted)' }}>
              <AlertTriangle size={15} />
              {totals.warnings} warning{totals.warnings === 1 ? '' : 's'}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>across {results.length} cards</span>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
            <Button type="button" size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>
              All
            </Button>
            <Button
              type="button"
              size="sm"
              variant={filter === 'problems' ? 'default' : 'outline'}
              onClick={() => setFilter('problems')}
            >
              Problems only
            </Button>
          </div>
        </div>

        {shown.length === 0 && (
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', padding: '2rem 0', textAlign: 'center' }}>
            {results.length === 0
              ? 'Open a template with mapped fields to run the test cards.'
              : 'Nothing to flag — every test case rendered cleanly.'}
          </p>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(${cardWidth}px, 1fr))`,
            gap: '1.25rem',
            paddingTop: '0.5rem',
          }}
        >
          {shown.map((result) => {
            const hasError = result.issues.some((issue) => issue.severity === 'error')
            const hasWarning = result.issues.some((issue) => issue.severity === 'warning')
            const border = hasError ? 'var(--danger)' : hasWarning ? 'var(--warning)' : 'var(--border-default)'

            return (
              <div
                key={result.testCase.id}
                style={{
                  border: `1px solid ${border}`,
                  borderRadius: '0.5rem',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ background: 'var(--bg-surface-alt)', padding: '0.5rem 0.625rem', borderBottom: `1px solid ${border}` }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{result.testCase.title}</div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', lineHeight: 1.35, marginTop: 2 }}>
                    {result.testCase.rationale}
                  </div>
                </div>

                <div style={{ background: 'var(--card-stock)', padding: '0.5rem' }}>
                  {result.svg ? (
                    <InlineSvg
                      markup={result.svg}
                      name={`test-${result.testCase.id}`}
                      style={{ width: '100%', height: cardWidth * aspect, overflow: 'hidden' }}
                    />
                  ) : (
                    <div style={{ height: cardWidth * aspect, display: 'grid', placeItems: 'center', color: 'var(--danger)', fontSize: '0.75rem' }}>
                      Failed to render
                    </div>
                  )}
                </div>

                <div style={{ padding: '0.5rem 0.625rem', borderTop: '1px solid var(--bg-surface-alt)', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {result.issues.length === 0 ? (
                    <span style={{ fontSize: '0.75rem', color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle2 size={13} />
                      Clean
                    </span>
                  ) : (
                    result.issues.map((issue, index) => (
                      <div
                        key={`${issue.fieldId}-${index}`}
                        style={{
                          fontSize: '0.6875rem',
                          lineHeight: 1.4,
                          color: issue.severity === 'error' ? 'var(--danger)' : 'var(--warning)',
                          display: 'flex',
                          gap: 4,
                        }}
                      >
                        {issue.severity === 'error' ? (
                          <XCircle size={12} style={{ flexShrink: 0, marginTop: 2 }} />
                        ) : (
                          <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 2 }} />
                        )}
                        <span>
                          <strong>{issue.fieldLabel}:</strong> {issue.message}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
