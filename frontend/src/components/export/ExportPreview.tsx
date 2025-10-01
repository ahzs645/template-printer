import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import type { TemplateSummary } from '../../lib/templates'

type ExportPreviewProps = {
  template: TemplateSummary | null
  templateMeta: any
  previewSvg: string | null
  compositeSvg: string | null
  printLayoutName?: string
}

export function ExportPreview({
  template,
  templateMeta,
  previewSvg,
  compositeSvg,
  printLayoutName,
}: ExportPreviewProps) {
  if (!template && !templateMeta) {
    return (
      <Card style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <CardHeader>
          <CardTitle style={{ fontSize: '1rem' }}>Export Preview</CardTitle>
          <CardDescription>Preview how your export will look</CardDescription>
        </CardHeader>
        <CardContent style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{ textAlign: 'center', color: '#71717a' }}>
            <p>Select a card design to preview export</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <CardHeader>
        <CardTitle style={{ fontSize: '1rem' }}>Export Preview</CardTitle>
        <CardDescription>Preview how your export will look</CardDescription>
      </CardHeader>
      <CardContent style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          {compositeSvg && printLayoutName ? (
            <>
              <p style={{ fontSize: '0.875rem', color: '#3f3f46' }}>
                Print Layout: <strong>{printLayoutName}</strong>
              </p>
              <div
                style={{
                  flex: 1,
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #e4e4e7',
                  borderRadius: '0.375rem',
                  backgroundColor: '#fff',
                  overflow: 'auto',
                }}
                dangerouslySetInnerHTML={{ __html: compositeSvg }}
              />
              <p style={{ fontSize: '0.75rem', color: '#71717a' }}>
                Your card design replicated across the print layout
              </p>
            </>
          ) : (
            <>
              <p style={{ fontSize: '0.875rem', color: '#3f3f46' }}>Single Card Export</p>
              {previewSvg && (
                <div
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #e4e4e7',
                    borderRadius: '0.375rem',
                    backgroundColor: '#fff',
                    overflow: 'auto',
                    padding: '1rem',
                  }}
                >
                  <div
                    className="export-preview-svg"
                    style={{
                      maxWidth: '500px',
                      width: '100%',
                    }}
                    dangerouslySetInnerHTML={{ __html: previewSvg }}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
