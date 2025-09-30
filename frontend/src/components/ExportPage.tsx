import { useState, useEffect, type ChangeEvent } from 'react'
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
    <div className="export-page">
      <aside className="export-sidebar">
        <div className="section-block">
          <div className="section-header">
            <h2>Export Options</h2>
          </div>

          <div className="export-options">
            <div className="option-group">
              <label htmlFor="export-format">Format</label>
              <select
                id="export-format"
                value={exportOptions.format}
                onChange={(e) =>
                  setExportOptions({
                    ...exportOptions,
                    format: e.target.value as ExportFormat,
                  })
                }
              >
                <option value="pdf">PDF</option>
                <option value="png">PNG</option>
                <option value="svg">SVG</option>
              </select>
            </div>

            {exportOptions.format === 'png' && (
              <div className="option-group">
                <label htmlFor="export-resolution">Resolution (DPI)</label>
                <select
                  id="export-resolution"
                  value={exportOptions.resolution}
                  onChange={(e) =>
                    setExportOptions({
                      ...exportOptions,
                      resolution: parseInt(e.target.value),
                    })
                  }
                >
                  <option value="72">72 DPI (Screen)</option>
                  <option value="150">150 DPI (Draft)</option>
                  <option value="300">300 DPI (Print Quality)</option>
                  <option value="600">600 DPI (High Quality)</option>
                </select>
              </div>
            )}

            {exportOptions.format === 'pdf' && !exportOptions.maintainVectors && (
              <div className="option-group">
                <label htmlFor="export-resolution">Resolution (DPI)</label>
                <select
                  id="export-resolution"
                  value={exportOptions.resolution}
                  onChange={(e) =>
                    setExportOptions({
                      ...exportOptions,
                      resolution: parseInt(e.target.value),
                    })
                  }
                >
                  <option value="72">72 DPI (Screen)</option>
                  <option value="150">150 DPI (Draft)</option>
                  <option value="300">300 DPI (Print Quality)</option>
                  <option value="600">600 DPI (High Quality)</option>
                </select>
              </div>
            )}

            {exportOptions.format === 'pdf' && (
              <div className="option-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={exportOptions.maintainVectors}
                    onChange={(e) =>
                      setExportOptions({
                        ...exportOptions,
                        maintainVectors: e.target.checked,
                      })
                    }
                  />
                  <span>Maintain Vector Graphics</span>
                </label>
                <p className="option-hint">
                  Keep text and shapes as vectors for scalability
                </p>
              </div>
            )}

            <div className="option-group">
              <div className="option-header">
                <label htmlFor="print-layout">Print Layout</label>
                <div className="option-actions">
                  <label className="file-button-small">
                    Upload
                    <input
                      type="file"
                      accept=".svg"
                      onChange={onPrintLayoutUpload}
                      className="file-button__input"
                    />
                  </label>
                  <button
                    type="button"
                    className="secondary-small"
                    onClick={onRefreshPrintTemplates}
                    disabled={printTemplatesLoading}
                  >
                    ↻
                  </button>
                </div>
              </div>
              <select
                id="print-layout"
                value={exportOptions.printLayoutId || ''}
                onChange={(e) =>
                  setExportOptions({
                    ...exportOptions,
                    printLayoutId: e.target.value || null,
                  })
                }
                disabled={!template}
              >
                <option value="">None (Single Card)</option>
                {printTemplates.map((layout) => (
                  <option key={layout.id} value={layout.id}>
                    {layout.name}
                  </option>
                ))}
              </select>
              {printTemplatesError && (
                <p className="error-message">{printTemplatesError}</p>
              )}
              {printTemplatesLoading && <p className="loading-message">Loading layouts...</p>}
            </div>

            <button
              className="primary export-button"
              onClick={handleExport}
              disabled={!template || isExporting}
            >
              {isExporting ? 'Exporting…' : `Export ${exportOptions.format.toUpperCase()}`}
            </button>
          </div>
        </div>

        {template && (
          <div className="section-block">
            <h3>Card Data Preview</h3>
            <div className="card-data-preview">
              {fields.length === 0 ? (
                <p className="muted-text">No fields defined</p>
              ) : (
                <ul className="field-list">
                  {fields.map((field) => (
                    <li key={field.id}>
                      <span className="field-name">{field.id}:</span>
                      <span className="field-value">
                        {cardData[field.id] || <em>empty</em>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </aside>

      <div className="export-preview">
        <div className="section-block preview-container">
          <h2>Export Preview</h2>
          {!template ? (
            <div className="empty-state">
              <p>Select a card design from the Design tab to preview export</p>
            </div>
          ) : (
            <div className="preview-content">
              {selectedPrintLayout && compositePreview ? (
                <div className="print-layout-preview">
                  <p className="preview-label">
                    Print Layout: <strong>{selectedPrintLayout.name}</strong>
                  </p>
                  <div className="svg-preview print-layout-svg" dangerouslySetInnerHTML={{ __html: compositePreview }} />
                  <p className="preview-hint">
                    Your card design replicated across the print layout
                  </p>
                </div>
              ) : (
                <div className="single-card-preview">
                  <p className="preview-label">Single Card Export</p>
                  {renderedSvg && (
                    <div
                      className="svg-preview"
                      dangerouslySetInnerHTML={{ __html: renderedSvg }}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
