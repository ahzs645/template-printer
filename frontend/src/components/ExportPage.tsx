import { useState, useEffect, type ChangeEvent } from 'react'
import { FileDown, Upload, RefreshCw, Users, FileText, Zap, Database, FolderOpen, Palette, Printer, Info, CreditCard } from 'lucide-react'
import { DockablePanel, PanelSection } from './ui/dockable-panel'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from './ui/select'
import { Switch } from './ui/switch'
import type { TemplateSummary } from '../lib/templates'
import type { FieldDefinition, CardData, PrintLayout } from '../lib/types'
import type { UserData } from '../lib/fieldParser'
import type { ColorProfile } from '../lib/calibration/exportUtils'
import { useExportPreview } from '../hooks/useExportPreview'
import { usePrintLayouts } from '../hooks/usePrintLayouts'
import { cn } from '../lib/utils'
import type { SlotAssignment } from '../lib/exporter'

export type ExportFormat = 'pdf' | 'png' | 'svg'
export type ExportMode = 'quick' | 'database'

export type { SlotAssignment }

export type ExportOptions = {
  format: ExportFormat
  resolution: number
  maintainVectors: boolean
  printLayoutId: string | null
  jsonPrintLayoutId: string | null
  mode: ExportMode
  selectedUserIds: string[]
  slotUserIds: string[]
  slotAssignments: SlotAssignment[]  // Per-slot configuration
  colorProfileId: string | null
}

export type ExportPageProps = {
  template: TemplateSummary | null
  templateMeta: any
  selectedTemplateId: string | null
  fields: FieldDefinition[]
  cardData: CardData
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
  colorProfiles: ColorProfile[]
  colorProfilesLoading: boolean
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
  colorProfiles,
  colorProfilesLoading,
}: ExportPageProps) {
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'pdf',
    resolution: 300,
    maintainVectors: true,
    printLayoutId: null,
    jsonPrintLayoutId: null,
    mode: 'quick',
    selectedUserIds: [],
    slotUserIds: [],
    slotAssignments: [],
    colorProfileId: null,
  })
  const [showInstructions, setShowInstructions] = useState(false)

  // Load JSON print layouts from storage
  const { printLayouts: jsonPrintLayouts, isLoading: jsonLayoutsLoading } = usePrintLayouts()

  const selectedJsonLayout = jsonPrintLayouts.find(
    (l) => l.id === exportOptions.jsonPrintLayoutId
  )

  // Initialize slot assignments when layout changes
  useEffect(() => {
    if (selectedJsonLayout) {
      const slotCount = selectedJsonLayout.cardsPerPage
      const newAssignments: SlotAssignment[] = Array.from({ length: slotCount }, () => ({
        source: 'custom',
        side: 'front',
      }))
      setExportOptions((prev) => ({ ...prev, slotAssignments: newAssignments }))
    } else {
      setExportOptions((prev) => ({ ...prev, slotAssignments: [] }))
    }
  }, [selectedJsonLayout?.id])
  const [printLayoutSvg, setPrintLayoutSvg] = useState<string | null>(null)
  const [compositePreview, setCompositePreview] = useState<string | null>(null)
  const [layoutPreviewSvg, setLayoutPreviewSvg] = useState<string | null>(null)
  const [showLayoutInspector, setShowLayoutInspector] = useState(false)
  const [layoutSlotCount, setLayoutSlotCount] = useState(0)

  const { previewSvg, renderCardForUser } = useExportPreview({
    mode: exportOptions.mode,
    templateMeta,
    selectedTemplateId,
    selectedUserIds: exportOptions.selectedUserIds,
    users,
    fields,
    renderedSvg,
  })

  const selectedPrintLayout = printTemplates.find(
    (t) => t.id === exportOptions.printLayoutId
  )

  // Load print layout SVG when selected
  useEffect(() => {
    if (!selectedPrintLayout) {
      setPrintLayoutSvg(null)
      setLayoutPreviewSvg(null)
      setCompositePreview(null)
      setShowLayoutInspector(false)
      setLayoutSlotCount(0)
      setExportOptions((prev) => ({ ...prev, slotUserIds: [] }))
      return
    }

    fetch(selectedPrintLayout.svgPath)
      .then((res) => res.text())
      .then((svg) => setPrintLayoutSvg(svg))
      .catch((err) => {
        console.error('Failed to load print layout:', err)
        setPrintLayoutSvg(null)
        setLayoutPreviewSvg(null)
        setCompositePreview(null)
        setShowLayoutInspector(false)
        setLayoutSlotCount(0)
      })
  }, [selectedPrintLayout])

  // Layout-only preview: highlight detected card slots
  useEffect(() => {
    if (!printLayoutSvg) {
      setLayoutPreviewSvg(null)
      setLayoutSlotCount(0)
      return
    }

    try {
      const parser = new DOMParser()
      const layoutDoc = parser.parseFromString(printLayoutSvg, 'image/svg+xml')
      const layoutSvg = layoutDoc.documentElement

      const placeholderGroups = ['Topcard', 'Bottomcard']
      let slotIndex = 0

      placeholderGroups.forEach((groupId, index) => {
        const group = layoutDoc.getElementById(groupId)
        if (!group) return

        const rects = Array.from(group.querySelectorAll('rect'))
        const targetRect = rects[rects.length - 1]
        if (!targetRect) return

        const slotX = parseFloat(targetRect.getAttribute('x') || '0')
        const slotY = parseFloat(targetRect.getAttribute('y') || '0')
        const slotWidth = parseFloat(targetRect.getAttribute('width') || '0')
        const slotHeight = parseFloat(targetRect.getAttribute('height') || '0')

        const overlayRect = layoutDoc.createElementNS('http://www.w3.org/2000/svg', 'rect')
        overlayRect.setAttribute('x', String(slotX))
        overlayRect.setAttribute('y', String(slotY))
        overlayRect.setAttribute('width', String(slotWidth))
        overlayRect.setAttribute('height', String(slotHeight))
        overlayRect.setAttribute('fill', '#3b82f6')
        overlayRect.setAttribute('fill-opacity', '0.06')
        overlayRect.setAttribute('stroke', '#3b82f6')
        overlayRect.setAttribute('stroke-dasharray', '3 2')
        overlayRect.setAttribute('stroke-width', '0.7')

        const label = layoutDoc.createElementNS('http://www.w3.org/2000/svg', 'text')
        label.textContent = `Card ${index + 1}`
        label.setAttribute('x', String(slotX + slotWidth / 2))
        label.setAttribute('y', String(slotY + slotHeight / 2))
        label.setAttribute('text-anchor', 'middle')
        label.setAttribute('dominant-baseline', 'middle')
        label.setAttribute('font-size', '10')
        label.setAttribute('fill', '#111827')
        label.setAttribute('opacity', '0.9')

        group.parentNode?.appendChild(overlayRect)
        group.parentNode?.appendChild(label)
        slotIndex += 1
      })

      const serializer = new XMLSerializer()
      const layoutPreview = serializer.serializeToString(layoutSvg)
      setLayoutPreviewSvg(layoutPreview)
      setLayoutSlotCount(slotIndex)
    } catch (error) {
      console.error('Failed to create layout preview:', error)
      setLayoutPreviewSvg(printLayoutSvg)
      setLayoutSlotCount(0)
    }
  }, [printLayoutSvg])

  // Create composite preview with cards in print layout slots
  useEffect(() => {
    if (!printLayoutSvg) {
      setCompositePreview(null)
      return
    }

    try {
      const parser = new DOMParser()
      const layoutDoc = parser.parseFromString(printLayoutSvg, 'image/svg+xml')
      const layoutSvg = layoutDoc.documentElement
      const placeholderGroups = ['Topcard', 'Bottomcard']

      const prefixSvgIds = (root: Element, prefix: string) => {
        const idMap = new Map<string, string>()
        root.querySelectorAll('[id]').forEach((el) => {
          const oldId = el.getAttribute('id')
          if (!oldId) return
          const newId = `${prefix}${oldId}`
          idMap.set(oldId, newId)
          el.setAttribute('id', newId)
        })

        if (idMap.size === 0) return

        const updateAttrValue = (value: string | null) => {
          if (!value) return value
          let updated = value.replace(/url\(#([^)]+)\)/g, (_, id: string) => {
            const mapped = idMap.get(id)
            return `url(#${mapped ?? id})`
          })
          return updated
        }

        root.querySelectorAll('*').forEach((el) => {
          Array.from(el.attributes).forEach((attr) => {
            const name = attr.name
            let value = attr.value
            if ((name === 'href' || name === 'xlink:href') && value.startsWith('#')) {
              const id = value.slice(1)
              const mapped = idMap.get(id)
              if (mapped) {
                el.setAttribute(name, `#${mapped}`)
              }
              return
            }
            if (value.includes('url(#')) {
              value = updateAttrValue(value) as string
              el.setAttribute(name, value)
            }
          })
        })
      }

      placeholderGroups.forEach((groupId, index) => {
        const group = layoutDoc.getElementById(groupId)
        if (!group) return

        const rects = Array.from(group.querySelectorAll('rect'))
        const targetRect = rects[rects.length - 1]
        if (!targetRect) return

        const slotX = parseFloat(targetRect.getAttribute('x') || '0')
        const slotY = parseFloat(targetRect.getAttribute('y') || '0')
        const slotWidth = parseFloat(targetRect.getAttribute('width') || '0')
        const slotHeight = parseFloat(targetRect.getAttribute('height') || '0')

        let cardMarkup: string | null = previewSvg
        if (exportOptions.mode === 'database') {
          const slotUserIds = exportOptions.slotUserIds
          let userIdForSlot: string | null = null

          if (slotUserIds && slotUserIds[index]) {
            userIdForSlot = slotUserIds[index]
          } else if (exportOptions.selectedUserIds.length > 0) {
            userIdForSlot = exportOptions.selectedUserIds[index] ?? exportOptions.selectedUserIds[0]
          }

          if (userIdForSlot) {
            const renderedForUser = renderCardForUser(userIdForSlot)
            if (renderedForUser) {
              cardMarkup = renderedForUser
            }
          }
        }

        if (!cardMarkup) return

        const cardDoc = parser.parseFromString(cardMarkup, 'image/svg+xml')
        const cardSvg = cardDoc.documentElement

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

        const scale = Math.min(slotWidth / cardNaturalWidth, slotHeight / cardNaturalHeight)
        const scaledWidth = cardNaturalWidth * scale
        const scaledHeight = cardNaturalHeight * scale

        const offsetX = slotX + (slotWidth - scaledWidth) / 2
        const offsetY = slotY + (slotHeight - scaledHeight) / 2

        const cardGroup = layoutDoc.createElementNS('http://www.w3.org/2000/svg', 'g')
        cardGroup.setAttribute('transform', `matrix(${scale}, 0, 0, ${scale}, ${offsetX}, ${offsetY})`)

        const cardClone = cardSvg.cloneNode(true) as Element
        const prefix = `slot${index + 1}-`
        prefixSvgIds(cardClone, prefix)

        Array.from(cardClone.children).forEach((child) => {
          const clonedChild = child.cloneNode(true)
          cardGroup.appendChild(clonedChild)
        })

        group.parentNode?.replaceChild(cardGroup, group)
      })

      const serializer = new XMLSerializer()
      const compositeSvg = serializer.serializeToString(layoutSvg)
      setCompositePreview(compositeSvg)
    } catch (error) {
      console.error('Failed to create composite preview:', error)
      setCompositePreview(printLayoutSvg)
    }
  }, [
    printLayoutSvg,
    previewSvg,
    exportOptions.mode,
    exportOptions.selectedUserIds,
    exportOptions.slotUserIds,
    renderCardForUser,
  ])

  const handleExport = () => {
    onExport(exportOptions)
  }

  const toggleUserSelection = (userId: string) => {
    setExportOptions((prev) => {
      const isSelected = prev.selectedUserIds.includes(userId)
      const selectedUserIds = isSelected
        ? prev.selectedUserIds.filter((id) => id !== userId)
        : [...prev.selectedUserIds, userId]

      const slotUserIds = prev.slotUserIds.filter(
        (id) => !id || selectedUserIds.includes(id),
      )

      return { ...prev, selectedUserIds, slotUserIds }
    })
  }

  const selectAllUsers = () => {
    setExportOptions((prev) => ({
      ...prev,
      selectedUserIds: users.map((u) => u.id!),
      slotUserIds: prev.slotUserIds.filter((id) => !id || users.some((u) => u.id === id)),
    }))
  }

  const deselectAllUsers = () => {
    setExportOptions((prev) => ({ ...prev, selectedUserIds: [], slotUserIds: [] }))
  }

  const updateExportOptions = (updates: Partial<ExportOptions>) => {
    setExportOptions((prev) => ({ ...prev, ...updates }))
  }

  const updateSlotAssignment = (slotIndex: number, updates: Partial<SlotAssignment>) => {
    setExportOptions((prev) => {
      const newAssignments = [...prev.slotAssignments]
      if (newAssignments[slotIndex]) {
        newAssignments[slotIndex] = { ...newAssignments[slotIndex], ...updates }
      }
      return { ...prev, slotAssignments: newAssignments }
    })
  }

  // Check if the selected template has a back side available
  const hasBackTemplate = templateMeta?.backTemplateId || false

  return (
    <div className="app-content" style={{ height: '100%' }}>
      {/* Left Panel - Export Options */}
      <DockablePanel title="Export Options" side="left" width={300}>
        {/* Template Selection */}
        <PanelSection title="Card Design">
          {designTemplatesLoading ? (
            <p className="empty-state__text">Loading templates...</p>
          ) : designTemplates.length === 0 ? (
            <p className="empty-state__text">No templates. Upload one in Design tab.</p>
          ) : (
            <div className="field-list">
              {designTemplates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={cn('field-item', template?.id === t.id && 'field-item--selected')}
                  onClick={() => onTemplateSelect(t)}
                >
                  <div className="field-item__name">{t.name}</div>
                </button>
              ))}
            </div>
          )}
        </PanelSection>

        {/* Export Mode */}
        <PanelSection title="Export Mode">
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className={cn('btn', exportOptions.mode === 'quick' ? 'btn-primary' : 'btn-secondary')}
              onClick={() => updateExportOptions({ mode: 'quick' })}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Zap size={14} />
              Quick
            </button>
            <button
              type="button"
              className={cn('btn', exportOptions.mode === 'database' ? 'btn-primary' : 'btn-secondary')}
              onClick={() => updateExportOptions({ mode: 'database' })}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Database size={14} />
              Batch
            </button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
            {exportOptions.mode === 'quick'
              ? 'Export single card with manual data entry'
              : 'Export multiple cards from user database'}
          </p>
        </PanelSection>

        {/* Card Data Entry - shows when needed for custom data */}
        {((exportOptions.slotAssignments.length === 0 && exportOptions.mode === 'quick') ||
          exportOptions.slotAssignments.some(s => s.source === 'custom')) && template && fields.length > 0 && (
          <PanelSection title="Custom Card Data" defaultOpen={true}>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
              {exportOptions.slotAssignments.length > 0
                ? 'Data for slots set to "Custom Fields"'
                : 'Enter data for the card'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {fields.map((field) => (
                <div key={field.id} className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{field.label || field.id}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={(cardData[field.id] as string) || ''}
                    onChange={(e) => onCardDataChange(field.id, e.target.value)}
                    placeholder={`Enter ${field.label || field.id}`}
                  />
                </div>
              ))}
            </div>
          </PanelSection>
        )}

        {/* Database Mode - User Selection */}
        {exportOptions.mode === 'database' && (
          <PanelSection title={`Users (${exportOptions.selectedUserIds.length}/${users.length})`}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={selectAllUsers}>
                Select All
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={deselectAllUsers}>
                Clear
              </button>
            </div>
            {usersLoading ? (
              <p className="empty-state__text">Loading users...</p>
            ) : users.length === 0 ? (
              <p className="empty-state__text">No users in database</p>
            ) : (
              <div className="field-list" style={{ maxHeight: 200, overflow: 'auto' }}>
                {users.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    className={cn('field-item', exportOptions.selectedUserIds.includes(user.id!) && 'field-item--selected')}
                    onClick={() => toggleUserSelection(user.id!)}
                  >
                    <div className="field-item__name">{`${user.firstName} ${user.lastName}` || user.id}</div>
                    {user.position && <div className="field-item__type">{user.position}</div>}
                  </button>
                ))}
              </div>
            )}
          </PanelSection>
        )}

        {/* Print Layout Selection */}
        <PanelSection title="Print Layout" defaultOpen={true}>
          <Select
            value={exportOptions.jsonPrintLayoutId || exportOptions.printLayoutId || 'none'}
            onValueChange={(value) => {
              if (value === 'none') {
                updateExportOptions({ jsonPrintLayoutId: null, printLayoutId: null })
              } else if (value.startsWith('layout-')) {
                // JSON layout
                updateExportOptions({ jsonPrintLayoutId: value, printLayoutId: null })
              } else {
                // SVG layout
                updateExportOptions({ printLayoutId: value, jsonPrintLayoutId: null })
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a print layout" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None (Single Card)</SelectItem>
              {jsonPrintLayouts.length > 0 && (
                <>
                  <SelectGroup>
                    <SelectLabel>Printer Tray Layouts</SelectLabel>
                    {jsonPrintLayouts.filter(l => l.name.includes('Canon') || l.name.includes('Epson')).map((layout) => (
                      <SelectItem key={layout.id} value={layout.id}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Printer size={12} />
                          {layout.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Teslin / Card Stock</SelectLabel>
                    {jsonPrintLayouts.filter(l => l.name.includes('Teslin')).map((layout) => (
                      <SelectItem key={layout.id} value={layout.id}>
                        {layout.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Thermal Printers</SelectLabel>
                    {jsonPrintLayouts.filter(l => l.name.includes('Thermal')).map((layout) => (
                      <SelectItem key={layout.id} value={layout.id}>
                        {layout.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </>
              )}
              {printTemplates.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Custom SVG Layouts</SelectLabel>
                  {printTemplates.map((layout) => (
                    <SelectItem key={layout.id} value={layout.id}>
                      {layout.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>

          {/* Layout Info */}
          {selectedJsonLayout && (
            <div style={{ marginTop: 12, padding: 10, background: 'var(--bg-surface-alt)', borderRadius: 'var(--radius)', fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: 'var(--text-muted)' }}>Cards per page:</span>
                <span style={{ fontWeight: 500 }}>{selectedJsonLayout.cardsPerPage}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: 'var(--text-muted)' }}>Paper size:</span>
                <span style={{ fontWeight: 500 }}>{selectedJsonLayout.paperSize || 'Custom'}</span>
              </div>
              {selectedJsonLayout.instructions && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}
                  onClick={() => setShowInstructions(true)}
                >
                  <Info size={14} style={{ marginRight: 6 }} />
                  Printing Instructions
                </button>
              )}
            </div>
          )}


          {/* Upload Custom SVG Layout */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', flex: 1, justifyContent: 'center' }}>
              <Upload size={14} style={{ marginRight: 4 }} />
              Upload SVG
              <input
                type="file"
                accept=".svg"
                onChange={onPrintLayoutUpload}
                style={{ display: 'none' }}
              />
            </label>
            <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={onRefreshPrintTemplates}>
              <RefreshCw size={14} />
            </button>
          </div>
        </PanelSection>
      </DockablePanel>

      {/* Main Canvas - Preview */}
      <div className="app-workspace">
        <div className="canvas-container">
          {!template && !templateMeta ? (
            <div className="empty-state">
              <FolderOpen size={48} className="empty-state__icon" />
              <p className="empty-state__text">Select a card design to preview export</p>
            </div>
          ) : compositePreview && selectedPrintLayout ? (
            <div
              className="export-preview-svg"
              style={{ maxWidth: 600, width: '100%' }}
              dangerouslySetInnerHTML={{ __html: compositePreview }}
            />
          ) : previewSvg ? (
            <div
              className="canvas-preview"
              style={{ maxWidth: 420, width: '100%' }}
              dangerouslySetInnerHTML={{ __html: previewSvg }}
            />
          ) : (
            <div className="empty-state">
              <FileText size={48} className="empty-state__icon" />
              <p className="empty-state__text">No preview available</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Export Settings */}
      <DockablePanel title="Settings" side="right" width={240}>
        {/* Color Profile */}
        <PanelSection title="Color Profile">
          <Select
            value={exportOptions.colorProfileId || 'none'}
            onValueChange={(value) => updateExportOptions({ colorProfileId: value === 'none' ? null : value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="No color correction" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  None (No correction)
                </span>
              </SelectItem>
              {colorProfiles.map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Palette size={12} />
                    {profile.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {exportOptions.colorProfileId && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              Colors will be adjusted for{' '}
              {colorProfiles.find(p => p.id === exportOptions.colorProfileId)?.device || 'printer'}
            </p>
          )}
          {colorProfiles.length === 0 && !colorProfilesLoading && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              Create profiles in the Calibration tab
            </p>
          )}
        </PanelSection>

        <PanelSection title="Format">
          <Select
            value={exportOptions.format}
            onValueChange={(value) => updateExportOptions({ format: value as ExportFormat })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pdf">PDF Document</SelectItem>
              <SelectItem value="png">PNG Image</SelectItem>
              <SelectItem value="svg">SVG Vector</SelectItem>
            </SelectContent>
          </Select>
        </PanelSection>

        {/* Resolution for PNG or non-vector PDF */}
        {(exportOptions.format === 'png' || (exportOptions.format === 'pdf' && !exportOptions.maintainVectors)) && (
          <PanelSection title="Resolution">
            <Select
              value={exportOptions.resolution.toString()}
              onValueChange={(value) => updateExportOptions({ resolution: parseInt(value) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="72">72 DPI (Screen)</SelectItem>
                <SelectItem value="150">150 DPI (Draft)</SelectItem>
                <SelectItem value="300">300 DPI (Print)</SelectItem>
                <SelectItem value="600">600 DPI (High)</SelectItem>
              </SelectContent>
            </Select>
          </PanelSection>
        )}

        {/* Vector Toggle for PDF */}
        {exportOptions.format === 'pdf' && (
          <PanelSection title="Options">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>Vectors</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Scalable text/shapes</div>
              </div>
              <Switch
                checked={exportOptions.maintainVectors}
                onCheckedChange={(checked) => updateExportOptions({ maintainVectors: checked })}
              />
            </div>
          </PanelSection>
        )}

        {/* Export Button */}
        <PanelSection title="Export">
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={handleExport}
            disabled={
              !template ||
              isExporting ||
              (exportOptions.mode === 'database' && exportOptions.selectedUserIds.length === 0)
            }
          >
            {isExporting ? (
              <>
                <RefreshCw size={16} className="animate-spin" style={{ marginRight: 6 }} />
                Exporting...
              </>
            ) : (
              <>
                <FileDown size={16} style={{ marginRight: 6 }} />
                {exportOptions.mode === 'database'
                  ? `Export ${exportOptions.selectedUserIds.length} Card${exportOptions.selectedUserIds.length !== 1 ? 's' : ''}`
                  : `Export ${exportOptions.format.toUpperCase()}`}
              </>
            )}
          </button>
          {exportOptions.mode === 'database' && exportOptions.selectedUserIds.length === 0 && (
            <p style={{ fontSize: 11, color: 'var(--danger)', textAlign: 'center', marginTop: 8 }}>
              Select at least one user
            </p>
          )}
        </PanelSection>
      </DockablePanel>

      {/* Layout Details Modal */}
      {layoutPreviewSvg && (
        <Dialog open={showLayoutInspector} onOpenChange={setShowLayoutInspector}>
          <DialogContent style={{ maxWidth: 720 }}>
            <DialogHeader>
              <DialogTitle>Print Layout Preview</DialogTitle>
              {selectedPrintLayout?.name && (
                <DialogDescription>{selectedPrintLayout.name}</DialogDescription>
              )}
            </DialogHeader>
            <div style={{ marginTop: 8, padding: 12, background: 'var(--bg-surface-alt)', borderRadius: 'var(--radius)' }}>
              <div
                className="export-preview-svg"
                style={{ width: '100%' }}
                dangerouslySetInnerHTML={{ __html: layoutPreviewSvg }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Printing Instructions Dialog */}
      {selectedJsonLayout?.instructions && (
        <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
          <DialogContent style={{ maxWidth: 600 }}>
            <DialogHeader>
              <DialogTitle>Printing Instructions</DialogTitle>
              <DialogDescription>{selectedJsonLayout.name}</DialogDescription>
            </DialogHeader>
            <div style={{ marginTop: 12 }}>
              {selectedJsonLayout.paperSize && (
                <div style={{ marginBottom: 12, padding: 10, background: 'var(--bg-surface-alt)', borderRadius: 'var(--radius)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Paper Size:</span>
                    <span style={{ fontWeight: 500 }}>{selectedJsonLayout.paperSize}</span>
                  </div>
                  {selectedJsonLayout.printMedia && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 4 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Media Type:</span>
                      <span style={{ fontWeight: 500 }}>{selectedJsonLayout.printMedia}</span>
                    </div>
                  )}
                </div>
              )}
              <div
                className="prose prose-sm"
                style={{ fontSize: 13, lineHeight: 1.6 }}
                dangerouslySetInnerHTML={{ __html: selectedJsonLayout.instructions }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
