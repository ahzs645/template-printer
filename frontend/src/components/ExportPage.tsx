import { useState, useEffect, useMemo, useImperativeHandle, type ChangeEvent, type Ref } from 'react'
import { FileDown, Upload, RefreshCw, Users, FileText, Zap, Database, FolderOpen, Palette, Printer, Info, CreditCard, Ban, Undo2, Keyboard, Search } from 'lucide-react'
import { DockablePanel, PanelSection } from './ui/dockable-panel'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from './ui/select'
import { Switch } from './ui/switch'
import type { TemplateSummary } from '../lib/templates'
import type { FieldDefinition, CardData, PrintLayout, CardDesign } from '../lib/types'
import type { UserData } from '../lib/fieldParser'
import type { ColorProfile } from '../lib/calibration/exportUtils'
import { useExportPreview } from '../hooks/useExportPreview'
import type { ExportBackSide } from '../hooks/useExportBackSide'
import { usePrintLayouts } from '../hooks/usePrintLayouts'
import { cn } from '../lib/utils'
import { resolveSlotCardData, type SlotAssignment } from '../lib/exporter'
import { scopeSvgElement } from '../lib/svgTemplate'
import { InlineSvg } from './InlineSvg'
import { describeStandardField } from '../lib/standardFields'

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

/** What the ribbon above the page can do with it. */
export type ExportPageHandle = {
  /** Export with the options set on the page, as its own Export button does. */
  exportNow: () => void
}

/** Whether the page can export right now, and what its Export button says. */
export type ExportStatus = {
  disabled: boolean
  label: string
}

export type ExportPageProps = {
  ref?: Ref<ExportPageHandle>
  /** Quick or batch, held by the app so the ribbon and the page agree. */
  mode: ExportMode
  onModeChange: (mode: ExportMode) => void
  /** Told whenever the Export button's state changes, so the ribbon can mirror it. */
  onExportStatusChange?: (status: ExportStatus) => void
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
  cardDesigns: CardDesign[]
  selectedCardDesignId: string | null
  /** The back of the active card design, when it has one. */
  backSide: ExportBackSide | null
  onCardDesignSelect: (designId: string | null) => void
  onTemplateSelect: (template: TemplateSummary) => void
  onCardDataChange: (fieldId: string, value: string) => void
  colorProfiles: ColorProfile[]
  colorProfilesLoading: boolean
}

const POINTS_PER_INCH = 72

function parseNumeric(value: string | null | undefined, fallback: number): number {
  const parsed = value ? parseFloat(value) : NaN
  return Number.isFinite(parsed) ? parsed : fallback
}

function getSvgNaturalSize(svgElement: Element): { width: number; height: number } {
  const viewBox = svgElement.getAttribute('viewBox')
  if (viewBox) {
    const parts = viewBox.split(/\s+/).map(Number)
    if (parts.length === 4) {
      const width = parts[2]
      const height = parts[3]
      if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
        return { width, height }
      }
    }
  }

  const width = parseNumeric(svgElement.getAttribute('width'), 100)
  const height = parseNumeric(svgElement.getAttribute('height'), 100)
  return {
    width: width > 0 ? width : 100,
    height: height > 0 ? height : 100,
  }
}

/**
 * The tray's name without its card count: the closed control has one line to
 * say which tray this is, and the count is on the line right below it.
 */
function trayName(name: string): string {
  return name.replace(/\s*[-\u2013]\s*\d+\s+cards?$/i, '')
}

function shouldRotateCard(cardWidth: number, cardHeight: number, slotWidth: number, slotHeight: number): boolean {
  const normalScale = Math.min(slotWidth / cardWidth, slotHeight / cardHeight)
  const rotatedScale = Math.min(slotWidth / cardHeight, slotHeight / cardWidth)
  return rotatedScale > normalScale * 1.05
}

/** The print layout last used, so a repeat visit does not start from "None". */
const LAST_LAYOUT_KEY = 'template-printer.export-layout'

/** Stored in place of a layout id when "None (Single Card)" was picked on purpose. */
const NO_LAYOUT = 'none'

/** The tray id every storage backend seeds its layouts with. */
const DEFAULT_TRAY_ID = 'layout-canon-g'

/**
 * The tray a first visit starts on, so the slots are there to fill in as soon
 * as a design is opened — most cards here are printed on a PVC card tray.
 */
function defaultTrayLayout(layouts: PrintLayout[]): PrintLayout | null {
  return (
    layouts.find((layout) => layout.id === DEFAULT_TRAY_ID) ??
    layouts.find((layout) => /canon|epson/i.test(layout.name) && layout.cardsPerPage > 1) ??
    null
  )
}

function readLastLayoutId(): string | null {
  try {
    return localStorage.getItem(LAST_LAYOUT_KEY)
  } catch {
    return null
  }
}

function rememberLastLayoutId(id: string | null): void {
  try {
    localStorage.setItem(LAST_LAYOUT_KEY, id ?? NO_LAYOUT)
  } catch {
    // Private browsing or blocked storage: the choice just is not remembered.
  }
}

/** A slot's edits count as its own only once one of its fields has been changed. */
function slotHasOwnData(assignment: SlotAssignment): boolean {
  return Boolean(assignment.customData && Object.keys(assignment.customData).length > 0)
}

function countPrintedSlots(assignments: SlotAssignment[]): number {
  return assignments.filter((assignment) => assignment.source !== 'empty').length
}

type SlotFieldInputsProps = {
  fields: FieldDefinition[]
  values: CardData
  hasOwnData: boolean
  /** Whether an earlier card is also being printed, to say whose values these start from. */
  followsAnotherCard: boolean
  onChange: (fieldId: string, value: string) => void
  onReset: () => void
}

/** What to call a field in a form: what it holds, rather than the artwork's sample text. */
function slotFieldLabel(field: FieldDefinition): string {
  return describeStandardField(field.sourceId || field.id) ?? field.label ?? field.id
}

/**
 * The fields of one slot, so each card on the page can name a different
 * person. Image fields are left to the card's own data: a photo is picked in
 * the Design tab, not typed in.
 */
function SlotFieldInputs({ fields, values, hasOwnData, followsAnotherCard, onChange, onReset }: SlotFieldInputsProps) {
  const textFields = fields.filter((field) => field.type !== 'image')
  if (textFields.length === 0) {
    return (
      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
        This side has no text fields to fill in.
      </div>
    )
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {hasOwnData
            ? 'Typed in for this card'
            : followsAnotherCard
              ? 'Starts as the card\'s own data — type to change'
              : 'The card\'s own data — type to change'}
        </span>
        {hasOwnData && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 10, padding: '2px 6px' }}
            onClick={onReset}
            title="Go back to the values entered for the card"
          >
            <Undo2 size={11} style={{ marginRight: 3 }} />
            Reset
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {textFields.map((field) => {
          const value = values[field.id]
          const label = slotFieldLabel(field)
          return (
            <div key={field.id} className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 11 }}>{label}</label>
              <input
                type="text"
                className="form-input"
                style={{ fontSize: 12 }}
                value={typeof value === 'string' ? value : ''}
                onChange={(event) => onChange(field.id, event.target.value)}
                placeholder={field.label || `Enter ${label}`}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Show a search box above the list once there are more people than fit at a glance. */
const PERSON_SEARCH_THRESHOLD = 8

function personName(user: UserData): string {
  return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.id || 'Unnamed'
}

type SlotPersonPickerProps = {
  users: UserData[]
  selectedUserId: string
  onSelect: (userId: string) => void
}

/** Pick the person a slot prints from the database, with a search for long lists. */
function SlotPersonPicker({ users, selectedUserId, onSelect }: SlotPersonPickerProps) {
  const [query, setQuery] = useState('')
  const selectedUser = users.find((user) => user.id === selectedUserId) ?? null

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return users
    return users.filter((user) =>
      [personName(user), user.position, user.department, user.studentId, user.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    )
  }, [users, query])

  // The chosen person stays in the list while searching, or the control
  // would show nothing selected.
  const options = selectedUser && !matches.includes(selectedUser) ? [selectedUser, ...matches] : matches

  return (
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {users.length > PERSON_SEARCH_THRESHOLD && (
        <div style={{ position: 'relative' }}>
          <Search
            size={12}
            style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
          />
          <input
            type="search"
            className="form-input"
            style={{ fontSize: 12, paddingLeft: 26 }}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people"
            aria-label="Search people"
          />
        </div>
      )}
      <Select value={selectedUserId} onValueChange={onSelect}>
        <SelectTrigger style={{ fontSize: 12 }} aria-label="Person">
          <SelectValue placeholder="Choose a person" />
        </SelectTrigger>
        <SelectContent>
          {options.length === 0 ? (
            <div style={{ padding: '6px 8px', fontSize: 12, color: 'var(--text-muted)' }}>No one matches "{query}"</div>
          ) : (
            options.map((user) => (
              <SelectItem key={user.id} value={user.id!}>
                <span className="select-option">
                  <Users size={12} />
                  <span className="select-option__label">{personName(user)}</span>
                </span>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      {selectedUser && (selectedUser.position || selectedUser.department) && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {[selectedUser.position, selectedUser.department].filter(Boolean).join(' · ')}
        </div>
      )}
    </div>
  )
}

type SlotFill = 'type' | 'database' | 'blank'

function slotFill(assignment: SlotAssignment): SlotFill {
  if (assignment.source === 'empty') return 'blank'
  if (assignment.source === 'custom') return 'type'
  return 'database'
}


export function ExportPage({
  ref,
  mode,
  onModeChange,
  onExportStatusChange,
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
  cardDesigns,
  selectedCardDesignId,
  backSide,
  onCardDesignSelect,
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
  /**
   * How many of the layout's slots to print. A tray that holds two cards is
   * often loaded with one, so the rest of the slots are left blank rather than
   * printing the same card twice.
   */
  const [cardsToPrint, setCardsToPrint] = useState(0)

  // Load JSON print layouts from storage
  const { printLayouts: jsonPrintLayouts, isLoading: jsonLayoutsLoading } = usePrintLayouts()

  // Pick up the layout used last time, once the layouts have loaded, or a card
  // tray on a first visit. Someone who prints from the same tray every visit
  // should not have to choose it again, and a design opened from a link lands
  // straight on a page with its slots ready to fill in. Only an explicit
  // "None" is kept as none.
  const [restoredLayout, setRestoredLayout] = useState(false)
  useEffect(() => {
    if (restoredLayout || jsonLayoutsLoading) return
    setRestoredLayout(true)
    const lastId = readLastLayoutId()
    if (lastId === NO_LAYOUT) return
    const layout =
      jsonPrintLayouts.find((candidate) => candidate.id === lastId) ?? defaultTrayLayout(jsonPrintLayouts)
    if (!layout) return
    setExportOptions((prev) =>
      prev.jsonPrintLayoutId || prev.printLayoutId ? prev : { ...prev, jsonPrintLayoutId: layout.id, printLayoutId: null },
    )
  }, [restoredLayout, jsonLayoutsLoading, jsonPrintLayouts])

  const selectedJsonLayout = jsonPrintLayouts.find(
    (l) => l.id === exportOptions.jsonPrintLayoutId
  )

  // Initialize slot assignments when layout changes. A new layout starts on one
  // card, so a tray loaded with a single blank does not print the same person
  // twice; asking for more brings the next slots in, each with its own person.
  useEffect(() => {
    if (selectedJsonLayout) {
      const slotCount = selectedJsonLayout.cardsPerPage
      const newAssignments: SlotAssignment[] = Array.from({ length: slotCount }, (_, index) => ({
        source: index === 0 ? 'custom' : 'empty',
        side: 'front',
        templateId: null,
      }))
      setExportOptions((prev) => ({ ...prev, slotAssignments: newAssignments }))
      setCardsToPrint(Math.min(1, slotCount))
    } else {
      setExportOptions((prev) => ({ ...prev, slotAssignments: [] }))
      setCardsToPrint(0)
    }
  }, [selectedJsonLayout?.id])
  const [printLayoutSvg, setPrintLayoutSvg] = useState<string | null>(null)
  const [compositePreview, setCompositePreview] = useState<string | null>(null)
  const [layoutPreviewSvg, setLayoutPreviewSvg] = useState<string | null>(null)
  const [showLayoutInspector, setShowLayoutInspector] = useState(false)
  const [layoutSlotCount, setLayoutSlotCount] = useState(0)

  const { previewSvg, renderCardForUser, renderCardWithData } = useExportPreview({
    mode,
    templateMeta,
    selectedTemplateId,
    selectedUserIds: exportOptions.selectedUserIds,
    users,
    fields,
    renderedSvg,
    backSide,
  })

  const selectedPrintLayout = printTemplates.find(
    (t) => t.id === exportOptions.printLayoutId
  )

  const selectedLayoutName = selectedJsonLayout?.name ?? selectedPrintLayout?.name ?? null

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
        if (mode === 'database') {
          const slotAssignment = exportOptions.slotAssignments[index]
          if (slotAssignment?.source === 'empty') {
            return
          }

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
        scopeSvgElement(cardClone, prefix)

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
    mode,
    exportOptions.selectedUserIds,
    exportOptions.slotUserIds,
    renderCardForUser,
  ])

  const jsonCompositePreview = useMemo(() => {
    if (!selectedJsonLayout || !previewSvg) {
      return null
    }

    try {
      const parser = new DOMParser()
      const serializer = new XMLSerializer()
      const svgNs = 'http://www.w3.org/2000/svg'

      const pageWidth = parseNumeric(selectedJsonLayout.pageWidth, 0) * POINTS_PER_INCH
      const pageHeight = parseNumeric(selectedJsonLayout.pageHeight, 0) * POINTS_PER_INCH
      const cardWidth = parseNumeric(selectedJsonLayout.cardWidth, 0) * POINTS_PER_INCH
      const cardHeight = parseNumeric(selectedJsonLayout.cardHeight, 0) * POINTS_PER_INCH
      const pageMarginTop = parseNumeric(selectedJsonLayout.pageMarginTop, 0) * POINTS_PER_INCH
      const pageMarginLeft = parseNumeric(selectedJsonLayout.pageMarginLeft, 0) * POINTS_PER_INCH
      const cardSpacingX = parseNumeric(selectedJsonLayout.cardMarginRight, 0) * POINTS_PER_INCH
      const cardSpacingY = parseNumeric(selectedJsonLayout.cardMarginBottom, 0) * POINTS_PER_INCH

      if (pageWidth <= 0 || pageHeight <= 0 || cardWidth <= 0 || cardHeight <= 0) {
        return previewSvg
      }

      const slotCount = Math.max(
        1,
        exportOptions.slotAssignments.length > 0
          ? exportOptions.slotAssignments.length
          : selectedJsonLayout.cardsPerPage,
      )

      const layoutDoc = document.implementation.createDocument(svgNs, 'svg', null)
      const layoutSvg = layoutDoc.documentElement
      layoutSvg.setAttribute('xmlns', svgNs)
      layoutSvg.setAttribute('width', `${pageWidth}`)
      layoutSvg.setAttribute('height', `${pageHeight}`)
      layoutSvg.setAttribute('viewBox', `0 0 ${pageWidth} ${pageHeight}`)

      const pageBackground = layoutDoc.createElementNS(svgNs, 'rect')
      pageBackground.setAttribute('x', '0')
      pageBackground.setAttribute('y', '0')
      pageBackground.setAttribute('width', `${pageWidth}`)
      pageBackground.setAttribute('height', `${pageHeight}`)
      pageBackground.setAttribute('fill', '#ffffff')
      pageBackground.setAttribute('stroke', '#d4d4d8')
      pageBackground.setAttribute('stroke-width', '1')
      layoutSvg.appendChild(pageBackground)

      const slotsOverlay = layoutDoc.createElementNS(svgNs, 'g')
      slotsOverlay.setAttribute('fill', 'none')
      slotsOverlay.setAttribute('stroke', '#94a3b8')
      slotsOverlay.setAttribute('stroke-width', '0.75')
      slotsOverlay.setAttribute('stroke-dasharray', '3 2')

      for (let index = 0; index < slotCount; index += 1) {
        const slotAssignment = exportOptions.slotAssignments[index]
        const col = index % selectedJsonLayout.cardsPerRow
        const row = Math.floor(index / selectedJsonLayout.cardsPerRow)
        const slotX = pageMarginLeft + col * (cardWidth + cardSpacingX)
        const slotY = pageMarginTop + row * (cardHeight + cardSpacingY)

        const slotOutline = layoutDoc.createElementNS(svgNs, 'rect')
        slotOutline.setAttribute('x', `${slotX}`)
        slotOutline.setAttribute('y', `${slotY}`)
        slotOutline.setAttribute('width', `${cardWidth}`)
        slotOutline.setAttribute('height', `${cardHeight}`)
        slotsOverlay.appendChild(slotOutline)

        if (slotAssignment?.source === 'empty') {
          continue
        }

        const slotSide = slotAssignment?.side === 'back' && backSide ? 'back' : 'front'
        let cardMarkup: string | null = slotSide === 'back' ? backSide!.svg : previewSvg

        if (slotAssignment?.source && slotAssignment.source !== 'custom') {
          const renderedForUser = renderCardForUser(slotAssignment.source, slotSide)
          if (renderedForUser) {
            cardMarkup = renderedForUser
          }
        } else if (slotAssignment && !slotAssignment.templateId && slotHasOwnData(slotAssignment)) {
          // This slot has its own values, so it shows its own person
          const renderedWithData = renderCardWithData(resolveSlotCardData(slotAssignment, cardData), slotSide)
          if (renderedWithData) {
            cardMarkup = renderedWithData
          }
        } else if (mode === 'database') {
          const userIdForSlot = exportOptions.selectedUserIds[index] ?? exportOptions.selectedUserIds[0]
          if (userIdForSlot) {
            const renderedForUser = renderCardForUser(userIdForSlot, slotSide)
            if (renderedForUser) {
              cardMarkup = renderedForUser
            }
          }
        }

        if (!cardMarkup) continue

        const cardDoc = parser.parseFromString(cardMarkup, 'image/svg+xml')
        const cardSvg = cardDoc.documentElement
        if (cardSvg.tagName.toLowerCase() !== 'svg') continue

        const { width: cardNaturalWidth, height: cardNaturalHeight } = getSvgNaturalSize(cardSvg)
        const rotateCard = shouldRotateCard(cardNaturalWidth, cardNaturalHeight, cardWidth, cardHeight)
        const fitWidth = rotateCard ? cardNaturalHeight : cardNaturalWidth
        const fitHeight = rotateCard ? cardNaturalWidth : cardNaturalHeight
        const scale = Math.min(cardWidth / fitWidth, cardHeight / fitHeight)

        const scaledWidth = fitWidth * scale
        const scaledHeight = fitHeight * scale
        const offsetX = slotX + (cardWidth - scaledWidth) / 2
        const offsetY = slotY + (cardHeight - scaledHeight) / 2

        const cardGroup = layoutDoc.createElementNS(svgNs, 'g')
        if (rotateCard) {
          cardGroup.setAttribute(
            'transform',
            `matrix(0, ${scale}, ${-scale}, 0, ${offsetX + cardNaturalHeight * scale}, ${offsetY})`,
          )
        } else {
          cardGroup.setAttribute('transform', `matrix(${scale}, 0, 0, ${scale}, ${offsetX}, ${offsetY})`)
        }

        const cardClone = cardSvg.cloneNode(true) as Element
        scopeSvgElement(cardClone, `json-slot${index + 1}-`)

        Array.from(cardClone.children).forEach((child) => {
          const clonedChild = child.cloneNode(true)
          cardGroup.appendChild(clonedChild)
        })

        layoutSvg.appendChild(cardGroup)
      }

      layoutSvg.appendChild(slotsOverlay)
      return serializer.serializeToString(layoutSvg)
    } catch (error) {
      console.error('Failed to create JSON layout preview:', error)
      return previewSvg
    }
  }, [
    selectedJsonLayout,
    previewSvg,
    backSide,
    cardData,
    exportOptions.slotAssignments,
    mode,
    exportOptions.selectedUserIds,
    renderCardForUser,
    renderCardWithData,
  ])

  /**
   * The single-card preview's box. Artwork that only carries a viewBox has no
   * size of its own, and in the centred frame it would otherwise collapse to
   * nothing, so the box takes the card's proportions at a readable size.
   */
  const singlePreviewStyle = useMemo(() => {
    let width = 86
    let height = 54
    if (previewSvg) {
      try {
        const svg = new DOMParser().parseFromString(previewSvg, 'image/svg+xml').documentElement
        if (svg.tagName.toLowerCase() === 'svg') {
          ;({ width, height } = getSvgNaturalSize(svg))
        }
      } catch {
        // Keep the card-shaped default.
      }
    }
    const longSide = 480
    const boxWidth = width >= height ? longSide : (longSide * width) / height
    return { width: `min(100%, ${Math.round(boxWidth)}px)`, aspectRatio: `${width} / ${height}` }
  }, [previewSvg])

  const layoutCompositePreview = selectedJsonLayout
    ? jsonCompositePreview
    : selectedPrintLayout
      ? compositePreview
      : null

  const handleExport = () => {
    onExport({ ...exportOptions, mode })
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

  /** Change one field of one slot, leaving the card's own data untouched. */
  const updateSlotField = (slotIndex: number, fieldId: string, value: string) => {
    setExportOptions((prev) => {
      const newAssignments = [...prev.slotAssignments]
      const current = newAssignments[slotIndex]
      if (!current) return prev
      newAssignments[slotIndex] = {
        ...current,
        customData: { ...(current.customData ?? {}), [fieldId]: value },
      }
      return { ...prev, slotAssignments: newAssignments }
    })
  }

  /**
   * Print only the first `count` slots. The ones after it go blank; the ones
   * kept that had been blanked this way come back as a card again.
   */
  const changeCardsToPrint = (count: number) => {
    setCardsToPrint(count)
    setExportOptions((prev) => ({
      ...prev,
      slotAssignments: prev.slotAssignments.map((assignment, index) => {
        if (index >= count) {
          return assignment.source === 'empty' ? assignment : { ...assignment, source: 'empty' }
        }
        return assignment.source === 'empty' ? { ...assignment, source: 'custom', side: 'front' } : assignment
      }),
    }))
  }

  /** Apply a change to every slot being printed, leaving the hidden ones blank. */
  const updateVisibleSlots = (change: (assignment: SlotAssignment, index: number) => SlotAssignment) => {
    setExportOptions((prev) => ({
      ...prev,
      slotAssignments: prev.slotAssignments.map((assignment, index) =>
        index < cardsToPrint ? change(assignment, index) : assignment,
      ),
    }))
  }

  /**
   * The person a slot switched to "Database" starts on: someone not already on
   * another card, so two cards set this way are two different people.
   */
  const nextPersonFor = (slotIndex: number): string => {
    const taken = new Set(
      exportOptions.slotAssignments
        .filter((assignment, index) => index !== slotIndex && slotFill(assignment) === 'database')
        .map((assignment) => assignment.source),
    )
    return (users.find((user) => user.id && !taken.has(user.id)) ?? users[0])?.id ?? 'custom'
  }

  const slotCount = exportOptions.slotAssignments.length
  const visibleSlots = exportOptions.slotAssignments.slice(0, cardsToPrint)
  const printedSlotCount = countPrintedSlots(exportOptions.slotAssignments)

  const exportDisabled =
    !templateMeta ||
    isExporting ||
    (mode === 'database' && exportOptions.selectedUserIds.length === 0) ||
    (slotCount > 0 && printedSlotCount === 0)
  const exportLabel =
    slotCount > 0
      ? `Export ${printedSlotCount} Card${printedSlotCount !== 1 ? 's' : ''}`
      : mode === 'database'
        ? `Export ${exportOptions.selectedUserIds.length} Card${exportOptions.selectedUserIds.length !== 1 ? 's' : ''}`
        : `Export ${exportOptions.format.toUpperCase()}`

  // The ribbon's Export button does what this page's does. On a phone it is
  // the one in view: the page's own sits in a folded panel below the card.
  useImperativeHandle(ref, () => ({
    exportNow: () => {
      if (!exportDisabled) handleExport()
    },
  }))

  useEffect(() => {
    onExportStatusChange?.({ disabled: exportDisabled, label: exportLabel })
  }, [exportDisabled, exportLabel, onExportStatusChange])

  // Whether the card design being printed actually has a back to print
  const hasBackSide = Boolean(backSide)
  const selectedCardDesign = selectedCardDesignId
    ? cardDesigns.find((design) => design.id === selectedCardDesignId) ?? null
    : null

  /**
   * Designs a slot can print instead of the chosen one. The chosen design's own
   * front and back are not "other" designs — the side buttons cover those.
   */
  const ownTemplateIds = new Set(
    [template?.id, backSide?.templateId, selectedCardDesign?.frontTemplateId, selectedCardDesign?.backTemplateId].filter(Boolean),
  )
  const otherDesigns = designTemplates.filter((t) => !ownTemplateIds.has(t.id))

  return (
    <div className="app-content" style={{ height: '100%' }}>
      {/* Left Panel - Export Options */}
      <DockablePanel title="Export Options" side="left" width={300}>
        {/* Template Selection */}
        <PanelSection title="Card Design">
          {designTemplatesLoading ? (
            <p className="empty-state__text">Loading templates...</p>
          ) : designTemplates.length === 0 && cardDesigns.length === 0 ? (
            <p className="empty-state__text">No templates or canvas designs. Create one in Design tab.</p>
          ) : (
            <div className="field-list">
              {cardDesigns.map((design) => (
                <button
                  key={design.id}
                  type="button"
                  className={cn('field-item', selectedCardDesignId === design.id && 'field-item--selected')}
                  onClick={() => onCardDesignSelect(design.id)}
                >
                  <div className="field-item__name">{design.name}</div>
                  <div className="field-item__type">
                    {design.designerMode === 'canvas' ? 'Canvas design' : 'Card design'}
                  </div>
                </button>
              ))}
              {designTemplates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={cn('field-item', !selectedCardDesignId && template?.id === t.id && 'field-item--selected')}
                  onClick={() => onTemplateSelect(t)}
                >
                  <div className="field-item__name">{t.name}</div>
                  <div className="field-item__type">Template</div>
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
              className={cn('btn', mode === 'quick' ? 'btn-primary' : 'btn-secondary')}
              onClick={() => onModeChange('quick')}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Zap size={14} />
              Quick
            </button>
            <button
              type="button"
              className={cn('btn', mode === 'database' ? 'btn-primary' : 'btn-secondary')}
              onClick={() => onModeChange('database')}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Database size={14} />
              Batch
            </button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
            {mode === 'quick'
              ? 'Export single card with manual data entry'
              : 'Export multiple cards from user database'}
          </p>
        </PanelSection>

        {/* Card Data Entry - shows when needed for custom data */}
        {slotCount === 0 && mode === 'quick' && template && fields.length > 0 && (
          <PanelSection title="Custom Card Data" defaultOpen={true}>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
              Enter data for the card
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {fields.map((field) => (
                <div key={field.id} className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{slotFieldLabel(field)}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={(cardData[field.id] as string) || ''}
                    onChange={(e) => onCardDataChange(field.id, e.target.value)}
                    placeholder={field.label || `Enter ${slotFieldLabel(field)}`}
                  />
                </div>
              ))}
            </div>
          </PanelSection>
        )}

        {/* Database Mode - User Selection */}
        {mode === 'database' && (
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
                    <div className="field-item__name">{`${user.firstName} ${user.lastName}`.trim() || user.id}</div>
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
                rememberLastLayoutId(null)
              } else if (value.startsWith('layout-')) {
                // JSON layout
                updateExportOptions({ jsonPrintLayoutId: value, printLayoutId: null })
                rememberLastLayoutId(value)
              } else {
                // SVG layout: not remembered, since only tray layouts are restored
                updateExportOptions({ printLayoutId: value, jsonPrintLayoutId: null })
              }
            }}
          >
            <SelectTrigger title={selectedLayoutName ?? undefined}>
              {selectedLayoutName ? (
                <SelectValue>
                  <span className="select-option">
                    <Printer size={12} />
                    <span className="select-option__label">{trayName(selectedLayoutName)}</span>
                  </span>
                </SelectValue>
              ) : (
                <SelectValue placeholder="Select a print layout" />
              )}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None (Single Card)</SelectItem>
              {jsonPrintLayouts.length > 0 && (
                <>
                  <SelectGroup>
                    <SelectLabel>Printer Tray Layouts</SelectLabel>
                    {jsonPrintLayouts.filter(l => l.name.includes('Canon') || l.name.includes('Epson')).map((layout) => (
                      <SelectItem key={layout.id} value={layout.id}>
                        <span className="select-option">
                          <Printer size={12} />
                          <span className="select-option__label">{layout.name}</span>
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

        {/* Card Slots - separate section for configuring each slot on the print layout */}
        {selectedJsonLayout && slotCount > 0 && (
          <PanelSection title={`Cards (${printedSlotCount} of ${slotCount})`} defaultOpen={true}>
            {slotCount > 1 && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  How many cards are you printing?
                </label>
                {slotCount <= 4 ? (
                  <div style={{ display: 'flex', gap: 4 }} role="group" aria-label="Cards to print">
                    {Array.from({ length: slotCount }, (_, i) => i + 1).map((count) => (
                      <button
                        key={count}
                        type="button"
                        className={cn('btn btn-sm', cardsToPrint === count ? 'btn-primary' : 'btn-secondary')}
                        style={{ flex: 1, fontSize: 11, padding: '4px 8px', justifyContent: 'center' }}
                        onClick={() => changeCardsToPrint(count)}
                        aria-pressed={cardsToPrint === count}
                      >
                        {count} card{count === 1 ? '' : 's'}
                      </button>
                    ))}
                  </div>
                ) : (
                  <Select
                    value={String(cardsToPrint)}
                    onValueChange={(value) => changeCardsToPrint(parseInt(value, 10))}
                  >
                    <SelectTrigger style={{ fontSize: 12 }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: slotCount }, (_, i) => i + 1).map((count) => (
                        <SelectItem key={count} value={String(count)}>
                          {count} of {slotCount}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                  {cardsToPrint === 1
                    ? 'Only the first slot prints; the rest of the tray stays blank.'
                    : cardsToPrint < slotCount
                      ? `The first ${cardsToPrint} slots print; the rest stay blank.`
                      : 'Every slot on the tray prints, each set up on its own below.'}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {visibleSlots.map((assignment, index) => {
                const fill = slotFill(assignment)
                return (
                  <div
                    key={index}
                    style={{
                      padding: 10,
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <CreditCard size={14} style={{ color: 'var(--text-muted)' }} />
                      <span style={{ fontSize: 12, fontWeight: 600 }}>
                        {visibleSlots.length > 1 ? `Card ${index + 1}` : 'Card'}
                      </span>
                      {hasBackSide && (
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }} role="group" aria-label={`Side for card ${index + 1}`}>
                          {(['front', 'back'] as const).map((side) => (
                            <button
                              key={side}
                              type="button"
                              className={cn('btn btn-sm', assignment.side === side ? 'btn-primary' : 'btn-secondary')}
                              style={{ fontSize: 10, padding: '2px 8px' }}
                              onClick={() => updateSlotAssignment(index, { side })}
                              aria-pressed={assignment.side === side}
                            >
                              {side === 'front' ? 'Front' : 'Back'}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Where this card's details come from */}
                    <div style={{ display: 'flex', gap: 4 }} role="group" aria-label={`Fill card ${index + 1}`}>
                      <button
                        type="button"
                        className={cn('btn btn-sm', fill === 'type' ? 'btn-primary' : 'btn-secondary')}
                        style={{ flex: 1, fontSize: 11, padding: '4px 6px', justifyContent: 'center', gap: 4 }}
                        onClick={() => updateSlotAssignment(index, { source: 'custom' })}
                        aria-pressed={fill === 'type'}
                      >
                        <Keyboard size={12} />
                        Type in
                      </button>
                      <button
                        type="button"
                        className={cn('btn btn-sm', fill === 'database' ? 'btn-primary' : 'btn-secondary')}
                        style={{ flex: 1, fontSize: 11, padding: '4px 6px', justifyContent: 'center', gap: 4 }}
                        onClick={() => {
                          if (fill !== 'database') updateSlotAssignment(index, { source: nextPersonFor(index) })
                        }}
                        disabled={users.length === 0}
                        title={users.length === 0 ? 'No one is in the database yet — add people in the Users tab' : undefined}
                        aria-pressed={fill === 'database'}
                      >
                        <Database size={12} />
                        Database
                      </button>
                      <button
                        type="button"
                        className={cn('btn btn-sm', fill === 'blank' ? 'btn-primary' : 'btn-secondary')}
                        style={{ fontSize: 11, padding: '4px 6px', justifyContent: 'center' }}
                        onClick={() => updateSlotAssignment(index, { source: 'empty' })}
                        title="Leave this slot on the tray blank"
                        aria-pressed={fill === 'blank'}
                      >
                        <Ban size={12} />
                      </button>
                    </div>

                    {fill === 'blank' && (
                      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                        This slot is left blank.
                      </div>
                    )}

                    {fill === 'database' && (
                      <SlotPersonPicker
                        users={users}
                        selectedUserId={assignment.source}
                        onSelect={(userId) => updateSlotAssignment(index, { source: userId })}
                      />
                    )}

                    {/* This slot's own fields, when it is typed in by hand */}
                    {fill === 'type' && !assignment.templateId && (
                      <SlotFieldInputs
                        fields={assignment.side === 'back' && backSide ? backSide.fields : fields}
                        values={resolveSlotCardData(assignment, cardData)}
                        hasOwnData={slotHasOwnData(assignment)}
                        followsAnotherCard={index > 0}
                        onChange={(fieldId, value) => updateSlotField(index, fieldId, value)}
                        onReset={() => updateSlotAssignment(index, { customData: undefined })}
                      />
                    )}
                    {fill === 'type' && assignment.templateId && (
                      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                        Prints with the data entered in the Design tab.
                      </div>
                    )}

                    {users.length === 0 && index === 0 && fill === 'type' && (
                      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                        To pick people instead of typing, add them in the Users tab.
                      </div>
                    )}

                    {/* A different design for this slot, when there is one to pick */}
                    {fill !== 'blank' && otherDesigns.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                          Design
                        </label>
                        <Select
                          value={assignment.templateId || 'default'}
                          onValueChange={(value) => updateSlotAssignment(index, {
                            templateId: value === 'default' ? null : value
                          })}
                        >
                          <SelectTrigger style={{ fontSize: 12 }}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">
                              <span className="select-option">
                                <CreditCard size={12} />
                                <span className="select-option__label">
                                  {selectedCardDesign?.name || template?.name || 'Selected Design'}
                                </span>
                              </span>
                            </SelectItem>
                            {otherDesigns.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                <span className="select-option">
                                  <span className="select-option__label">{t.name}</span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Quick fill options */}
            {visibleSlots.length > 1 && hasBackSide && (
              <div style={{ marginTop: 10, display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ flex: 1, fontSize: 10 }}
                  onClick={() => updateVisibleSlots((a) => ({ ...a, side: 'front' as const }))}
                >
                  All Fronts
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ flex: 1, fontSize: 10 }}
                  onClick={() =>
                    updateVisibleSlots((a, i) => ({
                      ...a,
                      source: a.source === 'empty' ? 'custom' : a.source,
                      side: (i % 2 === 0 ? 'front' : 'back') as 'front' | 'back',
                    }))
                  }
                >
                  Front/Back Pairs
                </button>
              </div>
            )}
          </PanelSection>
        )}
      </DockablePanel>

      {/* Main Canvas - Preview */}
      <div className="app-workspace">
        <div className="canvas-container">
          {!template && !templateMeta ? (
            <div className="empty-state">
              <FolderOpen size={48} className="empty-state__icon" />
              <p className="empty-state__text">Select a card design to preview export</p>
            </div>
          ) : layoutCompositePreview ? (
            <div className="canvas-preview-frame">
              <InlineSvg
                className="export-preview-svg"
                style={{ width: '100%', height: '100%' }}
                markup={layoutCompositePreview}
                name="export-composite"
              />
            </div>
          ) : previewSvg ? (
            <div className="canvas-preview-frame">
              <InlineSvg
                className="canvas-preview canvas-preview--sized"
                style={singlePreviewStyle}
                markup={previewSvg}
                name="export-card"
              />
            </div>
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
                <span className="select-option">
                  <span className="select-option__label">None (No correction)</span>
                </span>
              </SelectItem>
              {colorProfiles.map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  <span className="select-option">
                    <Palette size={12} />
                    <span className="select-option__label">{profile.name}</span>
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
            disabled={exportDisabled}
          >
            {isExporting ? (
              <>
                <RefreshCw size={16} className="animate-spin" style={{ marginRight: 6 }} />
                Exporting...
              </>
            ) : (
              <>
                <FileDown size={16} style={{ marginRight: 6 }} />
                {exportLabel}
              </>
            )}
          </button>
          {mode === 'database' && exportOptions.selectedUserIds.length === 0 && (
            <p style={{ fontSize: 11, color: 'var(--danger)', textAlign: 'center', marginTop: 8 }}>
              Select at least one user
            </p>
          )}
          {slotCount > 0 && printedSlotCount === 0 && (
            <p style={{ fontSize: 11, color: 'var(--danger)', textAlign: 'center', marginTop: 8 }}>
              Every slot is empty
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
              <InlineSvg
                className="export-preview-svg"
                style={{ width: '100%' }}
                markup={layoutPreviewSvg}
                name="export-layout"
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
