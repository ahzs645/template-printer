import { useState, useEffect, useMemo, type ChangeEvent } from 'react'
import { FileDown, Upload, RefreshCw, Users, User } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Tabs, TabsList, TabsTrigger } from './ui/tabs'
import { Badge } from './ui/badge'
import { ScrollArea } from './ui/scroll-area'
import { Input } from './ui/input'
import type { TemplateSummary } from '../lib/templates'
import type { FieldDefinition, CardData } from '../lib/types'
import type { UserData } from '../lib/fieldParser'
import { parseField } from '../lib/fieldParser'
import { getFieldMappings } from '../lib/api'
import { renderSvgWithData } from '../lib/svgTemplate'

export type ExportFormat = 'pdf' | 'png' | 'svg'
export type ExportMode = 'quick' | 'database'

export type ExportOptions = {
  format: ExportFormat
  resolution: number // DPI for raster formats
  maintainVectors: boolean // for PDF
  printLayoutId: string | null
  mode: ExportMode
  selectedUserIds: string[]
}

export type ExportPageProps = {
  template: TemplateSummary | null
  templateMeta: any // TemplateMeta from App.tsx
  selectedTemplateId: string | null
  fields: FieldDefinition[]
  cardData: Record<string, string>
  printTemplates: TemplateSummary[]
  printTemplatesLoading: boolean
  printTemplatesError: string | null
  onRefreshPrintTemplates: () => void
  onPrintLayoutUpload: (event: ChangeEvent<HTMLInputElement>) => void
  onExport: (options: ExportOptions) => void
  isExporting: boolean
  renderedSvg: string | null
  users: UserData[]
  usersLoading: boolean
  designTemplates: TemplateSummary[]
  designTemplatesLoading: boolean
  onTemplateSelect: (template: TemplateSummary) => void
  onCardDataChange: (fieldId: string, value: string) => void
}

export function ExportPage({
  template,
  templateMeta,
  selectedTemplateId,
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
  users,
  usersLoading,
  designTemplates,
  designTemplatesLoading,
  onTemplateSelect,
  onCardDataChange,
}: ExportPageProps) {
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'pdf',
    resolution: 300,
    maintainVectors: true,
    printLayoutId: null,
    mode: 'quick',
    selectedUserIds: [],
  })
  const [printLayoutSvg, setPrintLayoutSvg] = useState<string | null>(null)
  const [compositePreview, setCompositePreview] = useState<string | null>(null)

  const handleExport = () => {
    onExport(exportOptions)
  }

  const toggleUserSelection = (userId: string) => {
    setExportOptions((prev) => {
      const isSelected = prev.selectedUserIds.includes(userId)
      return {
        ...prev,
        selectedUserIds: isSelected
          ? prev.selectedUserIds.filter((id) => id !== userId)
          : [...prev.selectedUserIds, userId],
      }
    })
  }

  const selectAllUsers = () => {
    setExportOptions((prev) => ({
      ...prev,
      selectedUserIds: users.map((u) => u.id!),
    }))
  }

  const deselectAllUsers = () => {
    setExportOptions((prev) => ({
      ...prev,
      selectedUserIds: [],
    }))
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
    // Use actualPreviewSvg if available, otherwise use renderedSvg
    const svgToUse = actualPreviewSvg || renderedSvg

    if (!printLayoutSvg || !svgToUse) {
      setCompositePreview(null)
      return
    }

    try {
      const parser = new DOMParser()
      const layoutDoc = parser.parseFromString(printLayoutSvg, 'image/svg+xml')
      const cardDoc = parser.parseFromString(svgToUse, 'image/svg+xml')

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

  // Generate preview SVG for database mode (first selected user)
  const databaseModePreviewSvg = useMemo(() => {
    if (exportOptions.mode !== 'database' || !templateMeta || !selectedTemplateId) {
      return null
    }

    if (exportOptions.selectedUserIds.length === 0) {
      return null
    }

    // Get the first selected user for preview
    const firstUserId = exportOptions.selectedUserIds[0]
    const firstUser = users.find(u => u.id === firstUserId)

    if (!firstUser) {
      return null
    }

    // Generate card data from user data using field mappings
    // We'll need to fetch field mappings synchronously or use a state
    // For now, let's just return null and implement this properly
    return null
  }, [exportOptions.mode, exportOptions.selectedUserIds, templateMeta, selectedTemplateId, users])

  // Fetch field mappings when template or mode changes
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({})

  useEffect(() => {
    if (exportOptions.mode === 'database' && selectedTemplateId) {
      getFieldMappings(selectedTemplateId)
        .then(mappings => {
          const mappingsMap: Record<string, string> = {}
          mappings.forEach(m => {
            mappingsMap[m.svgLayerId] = m.standardFieldName
          })
          setFieldMappings(mappingsMap)
        })
        .catch(err => {
          console.error('Failed to load field mappings:', err)
        })
    }
  }, [selectedTemplateId, exportOptions.mode])

  // Generate actual preview for database mode
  const actualPreviewSvg = useMemo(() => {
    if (exportOptions.mode === 'quick') {
      return renderedSvg // Use the quick mode preview
    }

    // Database mode preview
    if (!templateMeta || exportOptions.selectedUserIds.length === 0) {
      return renderedSvg // Fallback to quick mode preview
    }

    const firstUserId = exportOptions.selectedUserIds[0]
    const firstUser = users.find(u => u.id === firstUserId)

    if (!firstUser || Object.keys(fieldMappings).length === 0) {
      return renderedSvg // Fallback if no user or mappings
    }

    try {
      // Generate card data from user data using field mappings
      const previewCardData: CardData = {}
      Object.entries(fieldMappings).forEach(([fieldId, standardFieldName]) => {
        if (standardFieldName) {
          previewCardData[fieldId] = parseField(standardFieldName, firstUser)
        }
      })

      // Render SVG with the preview data
      return renderSvgWithData(templateMeta, fields, previewCardData)
    } catch (error) {
      console.error('Failed to generate database mode preview:', error)
      return renderedSvg // Fallback on error
    }
  }, [exportOptions.mode, exportOptions.selectedUserIds, templateMeta, users, fieldMappings, fields, renderedSvg])

  return (
    <div style={{ display: 'flex', gap: '1rem', height: '100%', minHeight: 0 }}>
      {/* Left Sidebar - Export Options */}
      <div style={{ width: '350px', display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'auto' }}>
        {/* Card Design Template Selector */}
        <Card>
          <CardHeader>
            <CardTitle style={{ fontSize: '1rem' }}>Card Design Template</CardTitle>
            <CardDescription>Select a card design to export</CardDescription>
          </CardHeader>
          <CardContent>
            {designTemplatesLoading ? (
              <p style={{ fontSize: '0.875rem', color: '#71717a' }}>Loading templates...</p>
            ) : designTemplates.length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: '#71717a' }}>
                No templates available. Upload one in the Design tab.
              </p>
            ) : (
              <Select
                value={template?.id || 'none'}
                onValueChange={(value) => {
                  if (value !== 'none') {
                    const selectedTemplate = designTemplates.find(t => t.id === value)
                    if (selectedTemplate) {
                      onTemplateSelect(selectedTemplate)
                    }
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a design template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled>Select a template</SelectItem>
                  {designTemplates.map((tmpl) => (
                    <SelectItem key={tmpl.id} value={tmpl.id}>
                      {tmpl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        {/* Mode Toggle */}
        <Card>
          <CardHeader>
            <CardTitle style={{ fontSize: '1rem' }}>Export Mode</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={exportOptions.mode} onValueChange={(value) => setExportOptions({ ...exportOptions, mode: value as ExportMode })}>
              <TabsList style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <TabsTrigger value="quick" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <User style={{ width: '1rem', height: '1rem' }} />
                  Quick Mode
                </TabsTrigger>
                <TabsTrigger value="database" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users style={{ width: '1rem', height: '1rem' }} />
                  Database Mode
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <p style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '0.75rem' }}>
              {exportOptions.mode === 'quick'
                ? 'Export with manually entered data'
                : 'Export for multiple users from database'}
            </p>
          </CardContent>
        </Card>

        {/* Quick Mode - Manual Input Fields */}
        {exportOptions.mode === 'quick' && template && (
          <Card>
            <CardHeader>
              <CardTitle style={{ fontSize: '1rem' }}>Card Data</CardTitle>
              <CardDescription>Enter information for the card</CardDescription>
            </CardHeader>
            <CardContent>
              {fields.length === 0 ? (
                <p style={{ fontSize: '0.875rem', color: '#71717a' }}>No fields defined in template</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {fields.filter(f => f.type === 'text').map((field) => (
                    <div key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                      <Label htmlFor={`field-${field.id}`} style={{ fontSize: '0.875rem' }}>
                        {field.label || field.id}
                      </Label>
                      <Input
                        id={`field-${field.id}`}
                        value={cardData[field.id] || ''}
                        onChange={(e) => onCardDataChange(field.id, e.target.value)}
                        placeholder={`Enter ${field.label || field.id}`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* User Selection (Database Mode Only) */}
        {exportOptions.mode === 'database' && (
          <Card>
            <CardHeader>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <CardTitle style={{ fontSize: '1rem' }}>Select Users</CardTitle>
                <Badge>{exportOptions.selectedUserIds.length} selected</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <p style={{ fontSize: '0.875rem', color: '#71717a' }}>Loading users...</p>
              ) : users.length === 0 ? (
                <p style={{ fontSize: '0.875rem', color: '#71717a' }}>
                  No users in database. Add users in the Users tab.
                </p>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <Button size="sm" variant="outline" onClick={selectAllUsers}>
                      Select All
                    </Button>
                    <Button size="sm" variant="outline" onClick={deselectAllUsers}>
                      Deselect All
                    </Button>
                  </div>
                  <ScrollArea style={{ height: '200px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {users.map((user) => (
                        <label
                          key={user.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem',
                            border: '1px solid #e4e4e7',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            backgroundColor: exportOptions.selectedUserIds.includes(user.id!)
                              ? '#f0fdf4'
                              : '#fff',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={exportOptions.selectedUserIds.includes(user.id!)}
                            onChange={() => toggleUserSelection(user.id!)}
                            style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                              {user.firstName} {user.lastName}
                            </div>
                            {user.studentId && (
                              <div style={{ fontSize: '0.75rem', color: '#71717a' }}>
                                {user.studentId}
                              </div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </ScrollArea>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Export Options Card */}
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
              disabled={
                !template ||
                isExporting ||
                (exportOptions.mode === 'database' && exportOptions.selectedUserIds.length === 0)
              }
              style={{ marginTop: '0.5rem' }}
            >
              <FileDown style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
              {isExporting
                ? 'Exporting…'
                : exportOptions.mode === 'database'
                ? `Export ${exportOptions.selectedUserIds.length} ${exportOptions.selectedUserIds.length === 1 ? 'Card' : 'Cards'}`
                : `Export ${exportOptions.format.toUpperCase()}`}
            </Button>
            {exportOptions.mode === 'database' && exportOptions.selectedUserIds.length === 0 && (
              <p style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '-0.5rem' }}>
                Select at least one user to export
              </p>
            )}
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
                        dangerouslySetInnerHTML={{ __html: renderedSvg }}
                      />
                    </div>
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
