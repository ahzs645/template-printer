import { useState, useEffect, type ChangeEvent } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import type { TemplateSummary } from '../lib/templates'
import type { FieldDefinition, CardData } from '../lib/types'
import type { UserData } from '../lib/fieldParser'
import { useExportPreview } from '../hooks/useExportPreview'
import { TemplateSelector } from './export/TemplateSelector'
import { ExportModeToggle } from './export/ExportModeToggle'
import { QuickModeFields } from './export/QuickModeFields'
import { UserSelector } from './export/UserSelector'
import { ExportSettings } from './export/ExportSettings'
import { ExportPreview } from './export/ExportPreview'

export type ExportFormat = 'pdf' | 'png' | 'svg'
export type ExportMode = 'quick' | 'database'

export type ExportOptions = {
  format: ExportFormat
  resolution: number
  maintainVectors: boolean
  printLayoutId: string | null
  mode: ExportMode
  selectedUserIds: string[]
  slotUserIds: string[]
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
    slotUserIds: [],
  })
  const [printLayoutSvg, setPrintLayoutSvg] = useState<string | null>(null)
  const [compositePreview, setCompositePreview] = useState<string | null>(null)
  const [layoutPreviewSvg, setLayoutPreviewSvg] = useState<string | null>(null)
  const [showLayoutInspector, setShowLayoutInspector] = useState(false)
  const [layoutSlotCount, setLayoutSlotCount] = useState(0)

  // Use custom hook for preview generation
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

  // Layout-only preview: highlight detected card slots (Card 1 / Card 2)
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

      // Helper to prefix IDs inside a cloned card SVG to avoid collisions
      const prefixSvgIds = (root: Element, prefix: string) => {
        const idMap = new Map<string, string>()

        // First pass: collect and rename IDs
        root.querySelectorAll('[id]').forEach((el) => {
          const oldId = el.getAttribute('id')
          if (!oldId) return
          const newId = `${prefix}${oldId}`
          idMap.set(oldId, newId)
          el.setAttribute('id', newId)
        })

        if (idMap.size === 0) return

        // Second pass: update references to IDs (url(#id), href="#id", xlink:href="#id", style="...url(#id)...")
        const updateAttrValue = (value: string | null) => {
          if (!value) return value

          // Replace url(#id) patterns
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

            // href / xlink:href that reference an ID
            if ((name === 'href' || name === 'xlink:href') && value.startsWith('#')) {
              const id = value.slice(1)
              const mapped = idMap.get(id)
              if (mapped) {
                el.setAttribute(name, `#${mapped}`)
              }
              return
            }

            // style or other attributes containing url(#id)
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

        // Determine which card SVG to use for this slot
        let cardMarkup: string | null = previewSvg
        if (exportOptions.mode === 'database') {
          const slotUserIds = exportOptions.slotUserIds
          let userIdForSlot: string | null = null

          if (slotUserIds && slotUserIds[index]) {
            userIdForSlot = slotUserIds[index]
          } else if (exportOptions.selectedUserIds.length > 0) {
            // Fallback: use selected users in order
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

        // Create a group with proper transform matrix: scale first, then translate
        // Using matrix(a, b, c, d, e, f) where a,d = scale, e,f = translate
        const cardGroup = layoutDoc.createElementNS('http://www.w3.org/2000/svg', 'g')
        cardGroup.setAttribute('transform', `matrix(${scale}, 0, 0, ${scale}, ${offsetX}, ${offsetY})`)

        // Clone the entire card SVG so we can safely prefix IDs,
        // then move its children into the layout's group
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

      return {
        ...prev,
        selectedUserIds,
        slotUserIds,
      }
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
    setExportOptions((prev) => ({
      ...prev,
      selectedUserIds: [],
      slotUserIds: [],
    }))
  }

  const updateExportOptions = (updates: Partial<ExportOptions>) => {
    setExportOptions((prev) => ({ ...prev, ...updates }))
  }

  return (
    <div style={{ display: 'flex', gap: '1rem', height: '100%', minHeight: 0 }}>
      {/* Left Sidebar - Export Options */}
      <div style={{ width: '350px', display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'auto' }}>
        <TemplateSelector
          template={template}
          templates={designTemplates}
          loading={designTemplatesLoading}
          onSelect={onTemplateSelect}
        />

        <ExportModeToggle
          mode={exportOptions.mode}
          onModeChange={(mode) => updateExportOptions({ mode })}
        />

        {exportOptions.mode === 'quick' && template && (
          <QuickModeFields
            fields={fields}
            cardData={cardData}
            onCardDataChange={onCardDataChange}
          />
        )}

        {exportOptions.mode === 'database' && (
          <UserSelector
            users={users}
            selectedUserIds={exportOptions.selectedUserIds}
            loading={usersLoading}
            mode={exportOptions.mode}
            layoutSlotCount={layoutSlotCount}
            hasPrintLayout={!!exportOptions.printLayoutId}
            slotUserIds={exportOptions.slotUserIds}
            onSlotUserChange={(slotIndex, userId) => {
              setExportOptions((prev) => {
                const next = [...prev.slotUserIds]
                next[slotIndex] = userId ?? ''
                const derivedSelected = Array.from(new Set(next.filter((id) => id))) as string[]
                return {
                  ...prev,
                  slotUserIds: next,
                  selectedUserIds: derivedSelected,
                }
              })
            }}
            onToggleUser={toggleUserSelection}
            onSelectAll={selectAllUsers}
            onDeselectAll={deselectAllUsers}
          />
        )}

        <ExportSettings
          options={exportOptions}
          mode={exportOptions.mode}
          template={template}
          printTemplates={printTemplates}
          printTemplatesLoading={printTemplatesLoading}
          printTemplatesError={printTemplatesError}
          isExporting={isExporting}
          showLayoutInspector={showLayoutInspector}
          onOptionsChange={updateExportOptions}
          onPrintLayoutUpload={onPrintLayoutUpload}
          onRefreshPrintTemplates={onRefreshPrintTemplates}
          onSetLayoutInspectorOpen={setShowLayoutInspector}
          onExport={handleExport}
        />

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
                        {typeof cardData[field.id] === 'string' ? (cardData[field.id] as string) : (typeof cardData[field.id] === 'object' ? '[Image]' : <em style={{ fontStyle: 'italic' }}>empty</em>)}
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
      <ExportPreview
        template={template}
        templateMeta={templateMeta}
        previewSvg={previewSvg}
        compositeSvg={selectedPrintLayout && compositePreview ? compositePreview : null}
        layoutSvg={selectedPrintLayout && layoutPreviewSvg ? layoutPreviewSvg : null}
        showLayoutInspector={showLayoutInspector}
        onSetLayoutInspectorOpen={setShowLayoutInspector}
        printLayoutName={selectedPrintLayout?.name}
      />
    </div>
  )
}
