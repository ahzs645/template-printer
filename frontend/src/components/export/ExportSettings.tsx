import type { ChangeEvent } from 'react'
import { FileDown, RefreshCw, Upload } from 'lucide-react'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
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
  onOptionsChange: (options: Partial<ExportOptions>) => void
  onPrintLayoutUpload: (event: ChangeEvent<HTMLInputElement>) => void
  onRefreshPrintTemplates: () => void
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
  onOptionsChange,
  onPrintLayoutUpload,
  onRefreshPrintTemplates,
  onExport,
}: ExportSettingsProps) {
  const selectedPrintLayout = printTemplates.find((t) => t.id === options.printLayoutId)

  return (
    <Card>
      <CardHeader>
        <CardTitle style={{ fontSize: '1rem' }}>Export Settings</CardTitle>
        <CardDescription>Configure export format and quality</CardDescription>
      </CardHeader>
      <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Format Selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Label htmlFor="export-format">Format</Label>
          <Select
            value={options.format}
            onValueChange={(value) => onOptionsChange({ format: value as ExportFormat })}
          >
            <SelectTrigger id="export-format">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="png">PNG</SelectItem>
              <SelectItem value="svg">SVG</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Resolution for PNG */}
        {options.format === 'png' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={options.maintainVectors}
                onChange={(e) => onOptionsChange({ maintainVectors: e.target.checked })}
                style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
              />
              <span style={{ fontWeight: 500 }}>Maintain Vector Graphics</span>
            </label>
            <p style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '-0.25rem' }}>
              Keep text and shapes as vectors for scalability
            </p>
          </div>
        )}

        {/* Print Layout Selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Label htmlFor="print-layout">Print Layout</Label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <label>
                <input
                  type="file"
                  accept=".svg"
                  onChange={onPrintLayoutUpload}
                  style={{ display: 'none' }}
                />
                <Button variant="outline" size="sm" asChild>
                  <span style={{ cursor: 'pointer' }}>
                    <Upload style={{ width: '0.875rem', height: '0.875rem', marginRight: '0.5rem' }} />
                    Upload
                  </span>
                </Button>
              </label>
              <Button
                variant="outline"
                size="sm"
                onClick={onRefreshPrintTemplates}
                disabled={printTemplatesLoading}
              >
                <RefreshCw style={{ width: '0.875rem', height: '0.875rem' }} />
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
            <p style={{ fontSize: '0.75rem', color: '#dc2626' }}>{printTemplatesError}</p>
          )}
          {printTemplatesLoading && (
            <p style={{ fontSize: '0.75rem', color: '#71717a' }}>Loading layouts...</p>
          )}
        </div>

        {/* Export Button */}
        <Button
          onClick={onExport}
          disabled={
            !template ||
            isExporting ||
            (mode === 'database' && options.selectedUserIds.length === 0)
          }
          style={{ marginTop: '0.5rem' }}
        >
          <FileDown style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
          {isExporting
            ? 'Exporting…'
            : mode === 'database'
            ? `Export ${options.selectedUserIds.length} ${options.selectedUserIds.length === 1 ? 'Card' : 'Cards'}`
            : `Export ${options.format.toUpperCase()}`}
        </Button>
        {mode === 'database' && options.selectedUserIds.length === 0 && (
          <p style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '-0.5rem' }}>
            Select at least one user to export
          </p>
        )}
      </CardContent>
    </Card>
  )
}
