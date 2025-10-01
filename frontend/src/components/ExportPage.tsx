import { useState, useEffect, type ChangeEvent } from 'react'
import { FileDown, Upload, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import type { TemplateSummary } from '../lib/templates'
import type { TemplateField } from '../lib/types'

export type ExportFormat = 'pdf' | 'png' | 'svg'

export type ExportOptions = {
  format: ExportFormat
  resolution: number // DPI for raster formats
  maintainVectors: boolean // for PDF
  printLayoutId: string | null
}

export type ExportPageProps = {
  template: TemplateSummary | null
  fields: TemplateField[]
  cardData: Record<string, string>
  printTemplates: TemplateSummary[]
  printTemplatesLoading: boolean
  printTemplatesError: string | null
  onRefreshPrintTemplates: () => void
  onPrintLayoutUpload: (event: ChangeEvent<HTMLInputElement>) => void
  onExport: (options: ExportOptions) => void
  isExporting: boolean
  renderedSvg: string | null
}

export function ExportPage({
  template,
  fields,
  cardData,
  printTemplates,
  printTemplatesLoading,
  printTemplatesError,
  onRefreshPrintTemplates,
  onPrintLayoutUpload,
  onExport,
  isExporting,
  renderedSvg,
}: ExportPageProps) {
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'pdf',
    resolution: 300,
    maintainVectors: true,
    printLayoutId: null,
  })
  const [printLayoutSvg, setPrintLayoutSvg] = useState<string | null>(null)
  const [compositePreview, setCompositePreview] = useState<string | null>(null)

  const handleExport = () => {
    onExport(exportOptions)
  }

  const selectedPrintLayout = printTemplates.find(
    (t) => t.id === exportOptions.printLayoutId
  )

  // Load print layout SVG when selected
  useEffect(() => {
    if (!selectedPrintLayout) {
      setPrintLayoutSvg(null)
      return
    }

    fetch(selectedPrintLayout.svgPath)
      .then((res) => res.text())
      .then((svg) => setPrintLayoutSvg(svg))
      .catch((err) => {
        console.error('Failed to load print layout:', err)
        setPrintLayoutSvg(null)
      })
  }, [selectedPrintLayout])

  // Create composite preview with cards in print layout slots
  useEffect(() => {
    if (!printLayoutSvg || !renderedSvg) {
      setCompositePreview(null)
      return
    }

    try {
      const parser = new DOMParser()
      const layoutDoc = parser.parseFromString(printLayoutSvg, 'image/svg+xml')
      const cardDoc = parser.parseFromString(renderedSvg, 'image/svg+xml')

      const layoutSvg = layoutDoc.documentElement
      const cardSvg = cardDoc.documentElement

      // Find placeholder groups (Topcard, Bottomcard)
      const placeholderGroups = ['Topcard', 'Bottomcard']

      // Get card dimensions from viewBox or width/height
      const cardViewBox = cardSvg.getAttribute('viewBox')
      let cardNaturalWidth = 100
      let cardNaturalHeight = 100

      if (cardViewBox) {
        const [, , vbW, vbH] = cardViewBox.split(/\s+/).map(parseFloat)
        cardNaturalWidth = vbW
        cardNaturalHeight = vbH
      } else {
        const cardWidth = cardSvg.getAttribute('width')
        const cardHeight = cardSvg.getAttribute('height')
        if (cardWidth) cardNaturalWidth = parseFloat(cardWidth)
        if (cardHeight) cardNaturalHeight = parseFloat(cardHeight)
      }

      placeholderGroups.forEach((groupId) => {
        const group = layoutDoc.getElementById(groupId)
        if (!group) return

        // Get the bounding rect from the last rect in the group
        const rects = Array.from(group.querySelectorAll('rect'))
        const targetRect = rects[rects.length - 1]
        if (!targetRect) return

        const slotX = parseFloat(targetRect.getAttribute('x') || '0')
        const slotY = parseFloat(targetRect.getAttribute('y') || '0')
        const slotWidth = parseFloat(targetRect.getAttribute('width') || '0')
        const slotHeight = parseFloat(targetRect.getAttribute('height') || '0')

        // Calculate scale to fit card in slot while maintaining aspect ratio
        const scale = Math.min(slotWidth / cardNaturalWidth, slotHeight / cardNaturalHeight)
        const scaledWidth = cardNaturalWidth * scale
        const scaledHeight = cardNaturalHeight * scale

        // Center the card in the slot
        const offsetX = slotX + (slotWidth - scaledWidth) / 2
        const offsetY = slotY + (slotHeight - scaledHeight) / 2

        // Create a group for the card with proper positioning and scaling
        const cardGroup = layoutDoc.createElementNS('http://www.w3.org/2000/svg', 'g')
        cardGroup.setAttribute('transform', `translate(${offsetX}, ${offsetY}) scale(${scale})`)

        // Clone all children from the card SVG into the new group
        Array.from(cardSvg.children).forEach((child) => {
          const clonedChild = child.cloneNode(true)
          cardGroup.appendChild(clonedChild)
        })

        // Replace the placeholder group with the card
        group.parentNode?.replaceChild(cardGroup, group)
      })

      const serializer = new XMLSerializer()
      const compositeSvg = serializer.serializeToString(layoutSvg)
      setCompositePreview(compositeSvg)
    } catch (error) {
      console.error('Failed to create composite preview:', error)
      setCompositePreview(printLayoutSvg)
    }
  }, [printLayoutSvg, renderedSvg])

  return (
    <div style={{ display: 'flex', gap: '1rem', height: '100%', minHeight: 0 }}>
      {/* Left Sidebar - Export Options */}
      <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'auto' }}>
        {/* Export Options Card */}
        <Card>
          <CardHeader>
            <CardTitle style={{ fontSize: '1rem' }}>Export Options</CardTitle>
            <CardDescription>Configure export format and quality settings</CardDescription>
          </CardHeader>
          <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Format Selection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Label htmlFor="export-format">Format</Label>
              <Select
                value={exportOptions.format}
                onValueChange={(value) =>
                  setExportOptions({
                    ...exportOptions,
                    format: value as ExportFormat,
                  })
                }
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
            {exportOptions.format === 'png' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <Label htmlFor="export-resolution">Resolution (DPI)</Label>
                <Select
                  value={exportOptions.resolution.toString()}
                  onValueChange={(value) =>
                    setExportOptions({
                      ...exportOptions,
                      resolution: parseInt(value),
                    })
                  }
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
            {exportOptions.format === 'pdf' && !exportOptions.maintainVectors && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <Label htmlFor="pdf-resolution">Resolution (DPI)</Label>
                <Select
                  value={exportOptions.resolution.toString()}
                  onValueChange={(value) =>
                    setExportOptions({
                      ...exportOptions,
                      resolution: parseInt(value),
                    })
                  }
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
            {exportOptions.format === 'pdf' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={exportOptions.maintainVectors}
                    onChange={(e) =>
                      setExportOptions({
                        ...exportOptions,
                        maintainVectors: e.target.checked,
                      })
                    }
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
                value={exportOptions.printLayoutId || 'none'}
                onValueChange={(value) =>
                  setExportOptions({
                    ...exportOptions,
                    printLayoutId: value === 'none' ? null : value,
                  })
                }
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
              onClick={handleExport}
              disabled={!template || isExporting}
              style={{ marginTop: '0.5rem' }}
            >
              <FileDown style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
              {isExporting ? 'Exporting…' : `Export ${exportOptions.format.toUpperCase()}`}
            </Button>
          </CardContent>
        </Card>

        {/* Card Data Preview */}
        {template && (
          <Card>
            <CardHeader>
              <CardTitle style={{ fontSize: '1rem' }}>Card Data Preview</CardTitle>
            </CardHeader>
            <CardContent>
              {fields.length === 0 ? (
                <p style={{ fontSize: '0.875rem', color: '#71717a' }}>No fields defined</p>
              ) : (
                <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', listStyle: 'none', padding: 0, margin: 0 }}>
                  {fields.map((field) => (
                    <li key={field.id} style={{ fontSize: '0.875rem', display: 'flex', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 500, color: '#3f3f46' }}>{field.id}:</span>
                      <span style={{ color: '#71717a' }}>
                        {cardData[field.id] || <em style={{ fontStyle: 'italic' }}>empty</em>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right Side - Export Preview */}
      <Card style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <CardHeader>
          <CardTitle style={{ fontSize: '1rem' }}>Export Preview</CardTitle>
          <CardDescription>Preview how your export will look</CardDescription>
        </CardHeader>
        <CardContent style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          {!template ? (
            <div style={{ textAlign: 'center', color: '#71717a' }}>
              <p>Select a card design from the Design tab to preview export</p>
            </div>
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              {selectedPrintLayout && compositePreview ? (
                <>
                  <p style={{ fontSize: '0.875rem', color: '#3f3f46' }}>
                    Print Layout: <strong>{selectedPrintLayout.name}</strong>
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
                    dangerouslySetInnerHTML={{ __html: compositePreview }}
                  />
                  <p style={{ fontSize: '0.75rem', color: '#71717a' }}>
                    Your card design replicated across the print layout
                  </p>
                </>
              ) : (
                <>
                  <p style={{ fontSize: '0.875rem', color: '#3f3f46' }}>Single Card Export</p>
                  {renderedSvg && (
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
                      dangerouslySetInnerHTML={{ __html: renderedSvg }}
                    />
                  )}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
