import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog'
import type { TemplateSummary } from '../../lib/templates'

type ExportPreviewProps = {
  template: TemplateSummary | null
  templateMeta: any
  previewSvg: string | null
  compositeSvg: string | null
  layoutSvg: string | null
  showLayoutInspector: boolean
  onSetLayoutInspectorOpen: (open: boolean) => void
  printLayoutName?: string
}

export function ExportPreview({
  template,
  templateMeta,
  previewSvg,
  compositeSvg,
  layoutSvg,
  showLayoutInspector,
  onSetLayoutInspectorOpen,
  printLayoutName,
}: ExportPreviewProps) {
  if (!template && !templateMeta) {
    return (
      <Card className="flex flex-1 flex-col border-zinc-200 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg">Export Preview</CardTitle>
          <CardDescription>Preview how your export will look</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 items-center justify-center p-6">
          <div className="text-center text-zinc-500">
            <p>Select a card design to preview export</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      {/* Summary / header card */}
      <Card className="border-zinc-200 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg">Export Preview</CardTitle>
          <CardDescription>
            {compositeSvg && printLayoutName
              ? 'Preview of how your card fills the selected print layout.'
              : 'Preview of a single exported card.'}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Main visual preview: composite print layout or single card */}
      {compositeSvg && printLayoutName ? (
        <Card className="border-zinc-200 dark:border-zinc-800 self-start w-full max-w-[640px]">
          <CardContent className="flex items-center justify-center p-4">
            <div
              className="export-preview-svg w-full"
              dangerouslySetInnerHTML={{ __html: compositeSvg }}
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="border-zinc-200 dark:border-zinc-800 self-start w-full max-w-[520px]">
          <CardContent className="flex items-center justify-center p-4">
            {previewSvg && (
              <div
                className="export-preview-svg w-full max-w-[700px]"
                dangerouslySetInnerHTML={{ __html: previewSvg }}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Layout details inspector in a modal */}
      {layoutSvg && (
        <Dialog open={showLayoutInspector} onOpenChange={onSetLayoutInspectorOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Print layout preview</DialogTitle>
              {printLayoutName && (
                <DialogDescription>{printLayoutName}</DialogDescription>
              )}
            </DialogHeader>
            <div className="mt-2 rounded-md bg-zinc-100 p-3">
              <div
                className="export-preview-svg w-full"
                dangerouslySetInnerHTML={{ __html: layoutSvg }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
