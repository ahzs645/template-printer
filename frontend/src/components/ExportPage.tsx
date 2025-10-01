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
  })
  const [printLayoutSvg, setPrintLayoutSvg] = useState<string | null>(null)
  const [compositePreview, setCompositePreview] = useState<string | null>(null)

  // Use custom hook for preview generation
  const { previewSvg } = useExportPreview({
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
    if (!printLayoutSvg || !previewSvg) {
      setCompositePreview(null)
      return
    }

    try {
      const parser = new DOMParser()
      const layoutDoc = parser.parseFromString(printLayoutSvg, 'image/svg+xml')
      const cardDoc = parser.parseFromString(previewSvg, 'image/svg+xml')

      const layoutSvg = layoutDoc.documentElement
      const cardSvg = cardDoc.documentElement

      const placeholderGroups = ['Topcard', 'Bottomcard']

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

        const rects = Array.from(group.querySelectorAll('rect'))
        const targetRect = rects[rects.length - 1]
        if (!targetRect) return

        const slotX = parseFloat(targetRect.getAttribute('x') || '0')
        const slotY = parseFloat(targetRect.getAttribute('y') || '0')
        const slotWidth = parseFloat(targetRect.getAttribute('width') || '0')
        const slotHeight = parseFloat(targetRect.getAttribute('height') || '0')

        const scale = Math.min(slotWidth / cardNaturalWidth, slotHeight / cardNaturalHeight)
        const scaledWidth = cardNaturalWidth * scale
        const scaledHeight = cardNaturalHeight * scale

        const offsetX = slotX + (slotWidth - scaledWidth) / 2
        const offsetY = slotY + (slotHeight - scaledHeight) / 2

        const cardGroup = layoutDoc.createElementNS('http://www.w3.org/2000/svg', 'g')
        cardGroup.setAttribute('transform', `translate(${offsetX}, ${offsetY}) scale(${scale})`)

        Array.from(cardSvg.children).forEach((child) => {
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
  }, [printLayoutSvg, previewSvg])

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
          onOptionsChange={updateExportOptions}
          onPrintLayoutUpload={onPrintLayoutUpload}
          onRefreshPrintTemplates={onRefreshPrintTemplates}
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
        printLayoutName={selectedPrintLayout?.name}
      />
    </div>
  )
}
