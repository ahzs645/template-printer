import type { ChangeEvent } from 'react'
import { FileDown, RefreshCw, Upload, Check, Settings } from 'lucide-react'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Switch } from '../ui/switch'
import type { ExportFormat, ExportMode, ExportOptions } from '../ExportPage'
import type { TemplateSummary } from '../../lib/templates'

type ExportSettingsProps = {
  options: ExportOptions
  mode: ExportMode
  template: TemplateSummary | null
  printTemplates: TemplateSummary[]
  printTemplatesLoading: boolean
  printTemplatesError: string | null
  isExporting: boolean
  showLayoutInspector: boolean
  onOptionsChange: (options: Partial<ExportOptions>) => void
  onPrintLayoutUpload: (event: ChangeEvent<HTMLInputElement>) => void
  onRefreshPrintTemplates: () => void
  onSetLayoutInspectorOpen: (open: boolean) => void
  onExport: () => void
}

export function ExportSettings({
  options,
  mode,
  template,
  printTemplates,
  printTemplatesLoading,
  printTemplatesError,
  isExporting,
   showLayoutInspector,
  onOptionsChange,
  onPrintLayoutUpload,
  onRefreshPrintTemplates,
  onSetLayoutInspectorOpen,
  onExport,
}: ExportSettingsProps) {
  return (
    <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Export Settings</CardTitle>
        <CardDescription>Configure export format and quality</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Format Selection */}
        <div className="space-y-2">
          <Label htmlFor="export-format">Format</Label>
          <Select
            value={options.format}
            onValueChange={(value) => onOptionsChange({ format: value as ExportFormat })}
          >
            <SelectTrigger id="export-format" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pdf">PDF Document</SelectItem>
              <SelectItem value="png">PNG Image</SelectItem>
              <SelectItem value="svg">SVG Vector</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Resolution for PNG */}
        {options.format === 'png' && (
          <div className="space-y-2">
            <Label htmlFor="export-resolution">Resolution (DPI)</Label>
            <Select
              value={options.resolution.toString()}
              onValueChange={(value) => onOptionsChange({ resolution: parseInt(value) })}
            >
              <SelectTrigger id="export-resolution">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="72">72 DPI (Screen)</SelectItem>
                <SelectItem value="150">150 DPI (Draft)</SelectItem>
                <SelectItem value="300">300 DPI (Print Quality)</SelectItem>
                <SelectItem value="600">600 DPI (High Quality)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Resolution for PDF (when vectors disabled) */}
        {options.format === 'pdf' && !options.maintainVectors && (
          <div className="space-y-2">
            <Label htmlFor="pdf-resolution">Resolution (DPI)</Label>
            <Select
              value={options.resolution.toString()}
              onValueChange={(value) => onOptionsChange({ resolution: parseInt(value) })}
            >
              <SelectTrigger id="pdf-resolution">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="72">72 DPI (Screen)</SelectItem>
                <SelectItem value="150">150 DPI (Draft)</SelectItem>
                <SelectItem value="300">300 DPI (Print Quality)</SelectItem>
                <SelectItem value="600">600 DPI (High Quality)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Vector Graphics Toggle for PDF */}
        {options.format === 'pdf' && (
          <div className="flex items-center justify-between space-x-2 border p-3 rounded-md border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
            <div className="space-y-0.5">
              <Label htmlFor="maintain-vectors" className="text-base">Maintain Vectors</Label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Keep text and shapes as vectors for infinite scalability
              </p>
            </div>
            <Switch
              id="maintain-vectors"
              checked={options.maintainVectors}
              onCheckedChange={(checked) => onOptionsChange({ maintainVectors: checked })}
            />
          </div>
        )}

        {/* Print Layout Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="print-layout">Print Layout</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => onSetLayoutInspectorOpen(!showLayoutInspector)}
                disabled={!options.printLayoutId}
                title={showLayoutInspector ? 'Hide layout details' : 'Show layout details'}
              >
                <Settings className="h-3 w-3" />
              </Button>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".svg"
                  onChange={onPrintLayoutUpload}
                  className="hidden"
                />
                <div className="inline-flex h-8 items-center justify-center rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium shadow-sm hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 disabled:pointer-events-none disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-800 dark:focus-visible:ring-zinc-300">
                  <Upload className="mr-2 h-3 w-3" />
                  Upload
                </div>
              </label>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={onRefreshPrintTemplates}
                disabled={printTemplatesLoading}
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <Select
            value={options.printLayoutId || 'none'}
            onValueChange={(value) => onOptionsChange({ printLayoutId: value === 'none' ? null : value })}
            disabled={!template}
          >
            <SelectTrigger id="print-layout">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None (Single Card)</SelectItem>
              {printTemplates.map((layout) => (
                <SelectItem key={layout.id} value={layout.id}>
                  {layout.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {printTemplatesError && (
            <p className="text-xs text-red-500">{printTemplatesError}</p>
          )}
          {printTemplatesLoading && (
            <p className="text-xs text-zinc-500">Loading layouts...</p>
          )}
        </div>

        {/* Export Button */}
        <Button
          className="w-full"
          size="lg"
          onClick={onExport}
          disabled={
            !template ||
            isExporting ||
            (mode === 'database' && options.selectedUserIds.length === 0)
          }
        >
          {isExporting ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <FileDown className="mr-2 h-4 w-4" />
              {mode === 'database'
                ? `Export ${options.selectedUserIds.length} ${options.selectedUserIds.length === 1 ? 'Card' : 'Cards'}`
                : `Export ${options.format.toUpperCase()}`}
            </>
          )}
        </Button>

        {mode === 'database' && options.selectedUserIds.length === 0 && (
          <p className="text-xs text-center text-red-500">
            Select at least one user to export
          </p>
        )}
      </CardContent>
    </Card>
  )
}
