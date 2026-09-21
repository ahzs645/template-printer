import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  Upload,
  Plus,
  FileDown,
  Settings,
  Copy,
  Trash2,
  HelpCircle,
  Link,
  FolderOpen,
  Palette,
  ScanLine,
  Settings2,
  Download,
  Pencil,
  CreditCard,
  PenTool,
  Share2,
  Eye,
  AlertTriangle,
  Circle,
  ClipboardCheck,
  IdCard as Badge2,
  Ruler,
} from 'lucide-react'

import './App.css'
import { IconNav } from './components/IconNav'
import { Ribbon, RibbonGroup, RibbonButton, RibbonDivider } from './components/Ribbon'
import { DockablePanel, PanelSection } from './components/ui/dockable-panel'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './components/ui/dialog'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Textarea } from './components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/ui/select'
import { Badge } from './components/ui/badge'
import { TemplateSelector } from './components/TemplateSelector'
import { PreviewField } from './components/PreviewField'
import { CardDataPanel } from './components/CardDataPanel'
import { FieldEditorPanel } from './components/FieldEditorPanel'
import { ExportPage } from './components/ExportPage'
import { UsersTab } from './components/UsersTab'
import { SettingsTab } from './components/SettingsTab'
import { CalibrationTab, type CalibrationMode } from './components/calibration'
import { CardDesignerTab, generateSvgFromCanvasData } from './components/card-designer'
import { useColorProfiles } from './hooks/calibration'
import { FieldNamingTab } from './components/FieldNamingTab'
import type { ExportOptions } from './components/ExportPage'
import { useFontManager } from './hooks/useFontManager'
import { useTemplateLibrary } from './hooks/useTemplateLibrary'
import { useUsers } from './hooks/useUsers'
import { useCardDesigns } from './hooks/useCardDesigns'
import { useExportBackSide } from './hooks/useExportBackSide'
import { useStorage } from './lib/storage'
import { loadTemplateSvgContent } from './lib/templates'
import { FieldMappingDialog, type FieldMapping } from './components/FieldMappingDialog'
import { ShareTemplateDialog } from './components/ShareTemplateDialog'
import { InlineSvg } from './components/InlineSvg'
import { CardBlankDialog } from './components/CardBlankDialog'
import { BarcodeScanDialog } from './components/BarcodeScanDialog'
import { TestCardsDialog } from './components/TestCardsDialog'
import { LanyardDialog } from './components/LanyardDialog'
import { CardAreaDialog } from './components/CardAreaDialog'
import { trimRectInMm, type AppliedCardArea } from './lib/cardTrim'
import {
  createTemplatePackage,
  isTemplatePackage,
  packageFileName,
  readTemplatePackage,
} from './lib/templatePackage'
import {
  clearPackageUrlFromLocation,
  describePackageSource,
  fetchPackage,
  forgetOpenedPackage,
  readPackageUrl,
  recallOpenedPackage,
  rememberOpenedPackage,
} from './lib/packageUrl'
import type { ScannedBarcode } from './lib/barcodeScanner'
import { CardGuideOverlay } from './components/CardGuideOverlay'
import { ID1_HEIGHT_MM, ID1_WIDTH_MM, PUNCH_POSITIONS, PUNCH_POSITION_LABELS, type PunchPosition, type PunchShape } from './lib/cardBlanks'
import {
  buildSharedTemplatePayload,
  clearShareTarget,
  decodeSharedTemplate,
  readShareTarget,
  type SharedTemplatePayload,
} from './lib/shareLink'
import { exportSingleCard, exportWithPrintLayout, exportBatchCards, exportBatchCardsWithPrintLayout, exportWithJsonLayout, exportBatchCardsWithJsonLayout, exportWithSlotAssignments, setOutlineFontBuffers, clearOutlineFontBuffers } from './lib/exporter'
import type { SlotBackSide } from './lib/exporter'
import { usePrintLayouts } from './hooks/usePrintLayouts'
import { generateAutoMappings } from './lib/autoMapping'
import { isAutoMappable } from './lib/autoMapping'
import type { CardData, CardDataValue, FieldDefinition, ImageValue, TemplateMeta } from './lib/types'
import { renderCanvasDesignSide, type CanvasDesignRenderResult } from './lib/canvasDesign'
import {
  getDefaultField,
  nextFieldId,
  parseTemplate,
  parseTemplateString,
  renderSvgWithData,
} from './lib/svgTemplate'
import type { TemplateSummary } from './lib/templates'
import { setImageFieldValue, updateImageFieldValue, renameFieldInCardData } from './lib/cardData'
import { labelFromId } from './lib/fields'
import { assignCardSides, suggestDesignName, type CardSide } from './lib/cardSides'
import { cn } from './lib/utils'

/**
 * A link is opened once per page load, not once per mount.
 *
 * StrictMode mounts the app twice, and these both write to the library, so a
 * per-instance guard would let the second mount import everything again.
 */
let linkPackageHandled = false
let shareLinkHandled = false

type ActiveTab = 'design' | 'users' | 'export' | 'calibration' | 'settings'
type DesignMode = 'import' | 'designer' | 'designs'

const PREVIEW_BASE_WIDTH = 420
const PREVIEW_MIN_WIDTH = 220
// Breathing room between the card and the edges of its container.
const PREVIEW_GUTTER = 16

function App() {
  const storage = useStorage()
  const [activeTab, setActiveTab] = useState<ActiveTab>('users')
  const [designMode, setDesignMode] = useState<DesignMode>('import')
  const [calibrationMode, setCalibrationMode] = useState<CalibrationMode>('swatch')
  const { profiles: colorProfiles, loading: colorProfilesLoading } = useColorProfiles()
  const [template, setTemplate] = useState<TemplateMeta | null>(null)
  const [fields, setFields] = useState<FieldDefinition[]>([])
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [cardData, setCardData] = useState<CardData>(() => ({}))
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [fieldMappingDialogOpen, setFieldMappingDialogOpen] = useState(false)
  const [layerNamingDialogOpen, setLayerNamingDialogOpen] = useState(false)
  const [fieldMappingsVersion, setFieldMappingsVersion] = useState(0)
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({})
  const [fieldCustomValues, setFieldCustomValues] = useState<Record<string, string>>({})
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [sharePayload, setSharePayload] = useState<SharedTemplatePayload | null>(null)
  // Set when the open template arrived through a view-only share link.
  const [isSharedReadOnly, setIsSharedReadOnly] = useState(false)
  const [templateWarnings, setTemplateWarnings] = useState<string[]>([])
  // The card design the open template belongs to, so both sides can be shown
  // and switched between while editing.
  const [linkedDesignId, setLinkedDesignId] = useState<string | null>(null)
  const [activeSide, setActiveSide] = useState<CardSide>('front')
  const [otherSidePreview, setOtherSidePreview] = useState<{ name: string; svg: string } | null>(null)
  const [blankDialogOpen, setBlankDialogOpen] = useState(false)
  const [scanDialogOpen, setScanDialogOpen] = useState(false)
  const [testCardsOpen, setTestCardsOpen] = useState(false)
  const [lanyardOpen, setLanyardOpen] = useState(false)
  const [cardAreaOpen, setCardAreaOpen] = useState(false)
  // Non-destructive card guides drawn over the preview.
  const [showMagStripeGuide, setShowMagStripeGuide] = useState(false)
  const [showSafeAreaGuide, setShowSafeAreaGuide] = useState(false)
  const [punchGuide, setPunchGuide] = useState<PunchPosition>('none')
  const [punchShapeGuide, setPunchShapeGuide] = useState<PunchShape>('slot')
  const [linkLoading, setLinkLoading] = useState<string | null>(null)
  // The result of a ?url= load, reported outside the side panels so it is
  // readable when those are collapsed (which is the default on a phone).
  const [linkResult, setLinkResult] = useState<{ ok: boolean; text: string } | null>(null)
  const previousObjectUrl = useRef<string | null>(null)
  const fontInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const templateUploadInputRef = useRef<HTMLInputElement | null>(null)

  const {
    templates: designTemplates,
    isLoading: designTemplatesLoading,
    error: designTemplatesError,
    reload: reloadDesignTemplates,
  } = useTemplateLibrary('design')

  const {
    templates: printTemplates,
    isLoading: printTemplatesLoading,
    error: printTemplatesError,
    reload: reloadPrintTemplates,
  } = useTemplateLibrary('print')

  // JSON print layouts (Brainstorm-style layouts)
  const { printLayouts: jsonPrintLayouts, getPrintLayoutById } = usePrintLayouts()

  const { users, loading: usersLoading } = useUsers()
  const {
    designs: cardDesigns,
    loading: cardDesignsLoading,
    createDesign: createCardDesign,
    updateDesign: updateCardDesign,
    deleteDesign: deleteCardDesign,
    refresh: refreshCardDesigns,
  } = useCardDesigns()
  const [selectedCardDesignId, setSelectedCardDesignId] = useState<string | null>(null)
  const [selectedExportCardDesignId, setSelectedExportCardDesignId] = useState<string | null>(null)
  const [exportCanvasDesign, setExportCanvasDesign] = useState<CanvasDesignRenderResult | null>(null)
  const [designDialogOpen, setDesignDialogOpen] = useState(false)
  const [editingDesign, setEditingDesign] = useState<typeof cardDesigns[0] | null>(null)
  const [editingCanvasDesignId, setEditingCanvasDesignId] = useState<string | null>(null)
  const [designFormData, setDesignFormData] = useState({
    name: '',
    description: '',
    frontTemplateId: '',
    backTemplateId: '',
  })
  const [designFormError, setDesignFormError] = useState<string | null>(null)
  const [designFormSaving, setDesignFormSaving] = useState(false)
  const [designPreview, setDesignPreview] = useState<{
    front: { svg: string | null; loading: boolean; error: string | null }
    back: { svg: string | null; loading: boolean; error: string | null }
  }>({
    front: { svg: null, loading: false, error: null },
    back: { svg: null, loading: false, error: null },
  })

  const resetPreviousObjectUrl = (nextUrl: string | null | undefined) => {
    if (previousObjectUrl.current && previousObjectUrl.current !== nextUrl) {
      URL.revokeObjectURL(previousObjectUrl.current)
    }
    previousObjectUrl.current = nextUrl ?? null
  }
  const { fontList, missingFonts, availableFontOptions, registerTemplateFonts, loadFontFile } = useFontManager()

  const fontOptions = useMemo(() => {
    const names = new Set<string>(availableFontOptions)
    fields.forEach((field) => {
      if (field.fontFamily) {
        names.add(field.fontFamily)
      }
    })
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [availableFontOptions, fields])

  useEffect(() => {
    return () => {
      if (previousObjectUrl.current) {
        URL.revokeObjectURL(previousObjectUrl.current)
      }
    }
  }, [])

  // Fetch field mappings when template is selected
  useEffect(() => {
    if (selectedTemplateId && fields.length > 0) {
      storage.getFieldMappings(selectedTemplateId)
        .then(mappings => {
          const mappingsMap: Record<string, string> = {}
          const customMap: Record<string, string> = {}
          mappings.forEach(m => {
            mappingsMap[m.svgLayerId] = m.standardFieldName
            if (m.customValue !== undefined) customMap[m.svgLayerId] = m.customValue
          })
          setFieldMappings(mappingsMap)
          setFieldCustomValues(customMap)
        })
        .catch(() => {
          setFieldMappings({})
          setFieldCustomValues({})
        })
    } else {
      setFieldMappings({})
      setFieldCustomValues({})
    }
  }, [selectedTemplateId, fields, fieldMappingsVersion, storage])

  // Load design preview when a card design is selected
  useEffect(() => {
    setDesignPreview({
      front: { svg: null, loading: false, error: null },
      back: { svg: null, loading: false, error: null },
    })

    if (!selectedCardDesignId || cardDesignsLoading) return

    const selectedDesign = cardDesigns.find(d => d.id === selectedCardDesignId)
    if (!selectedDesign) return

    let cancelled = false

    // Handle canvas-based designs (from Card Designer)
    if (selectedDesign.designerMode === 'canvas') {
      const loadCanvasSide = async (
        side: 'front' | 'back',
        canvasData: string | null | undefined
      ) => {
        if (cancelled) return

        if (!canvasData) {
          setDesignPreview(prev => ({
            ...prev,
            [side]: { svg: null, loading: false, error: 'No design data' },
          }))
          return
        }

        setDesignPreview(prev => ({
          ...prev,
          [side]: { ...prev[side], loading: true, error: null },
        }))

        try {
          const cardWidth = selectedDesign.cardWidth ?? 86
          const cardHeight = selectedDesign.cardHeight ?? 54
          const svgText = await generateSvgFromCanvasData(canvasData, cardWidth, cardHeight)
          if (cancelled) return

          setDesignPreview(prev => ({
            ...prev,
            [side]: { svg: svgText, loading: false, error: null },
          }))
        } catch (err) {
          if (cancelled) return
          setDesignPreview(prev => ({
            ...prev,
            [side]: { svg: null, loading: false, error: err instanceof Error ? err.message : 'Failed to render' },
          }))
        }
      }

      loadCanvasSide('front', selectedDesign.frontCanvasData)
      loadCanvasSide('back', selectedDesign.backCanvasData)
    } else {
      // Handle template-based designs
      const loadTemplateSide = async (side: 'front' | 'back', templateId: string | null | undefined) => {
        if (cancelled) return

        if (!templateId) {
          setDesignPreview(prev => ({
            ...prev,
            [side]: { svg: null, loading: false, error: 'No template assigned' },
          }))
          return
        }

        const templateSummary = designTemplates.find(t => t.id === templateId)
        if (!templateSummary) {
          setDesignPreview(prev => ({
            ...prev,
            [side]: { svg: null, loading: false, error: 'Template not found' },
          }))
          return
        }

        setDesignPreview(prev => ({
          ...prev,
          [side]: { ...prev[side], loading: true, error: null },
        }))

        try {
          const svgText = await loadTemplateSvgContent(templateSummary)
          if (cancelled) return

          setDesignPreview(prev => ({
            ...prev,
            [side]: { svg: svgText, loading: false, error: null },
          }))
        } catch (err) {
          if (cancelled) return
          setDesignPreview(prev => ({
            ...prev,
            [side]: { svg: null, loading: false, error: err instanceof Error ? err.message : 'Failed to load' },
          }))
        }
      }

      loadTemplateSide('front', selectedDesign.frontTemplateId)
      loadTemplateSide('back', selectedDesign.backTemplateId)
    }

    return () => { cancelled = true }
  }, [selectedCardDesignId, cardDesigns, cardDesignsLoading, designTemplates])

  useEffect(() => {
    let cancelled = false

    if (!selectedExportCardDesignId) {
      setExportCanvasDesign(null)
      return () => { cancelled = true }
    }

    const selectedDesign = cardDesigns.find((design) => design.id === selectedExportCardDesignId)
    if (!selectedDesign || selectedDesign.designerMode !== 'canvas') {
      // A template-based design prints through its own saved templates, which
      // are loaded as the active template when the design is picked.
      setExportCanvasDesign(null)
      return () => { cancelled = true }
    }

    setExportCanvasDesign(null)
    renderCanvasDesignSide(selectedDesign, 'front')
      .then((result) => {
        if (!cancelled) {
          setExportCanvasDesign(result)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Failed to prepare canvas design for export:', error)
          setErrorMessage(error instanceof Error ? error.message : 'Failed to prepare canvas design for export.')
        }
      })

    return () => { cancelled = true }
  }, [selectedExportCardDesignId, cardDesigns])

  const selectedField = useMemo(
    () => fields.find((field) => field.id === selectedFieldId) ?? null,
    [fields, selectedFieldId],
  )

  // Width of the canvas area, watched so the preview fits whatever space the
  // current layout gives it (a phone gives it far less than a desktop).
  const [canvasNode, setCanvasNode] = useState<HTMLDivElement | null>(null)
  const [canvasWidth, setCanvasWidth] = useState(PREVIEW_BASE_WIDTH + PREVIEW_GUTTER)

  useEffect(() => {
    if (!canvasNode || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0
      if (width > 0) setCanvasWidth(width)
    })
    observer.observe(canvasNode)
    return () => observer.disconnect()
  }, [canvasNode])

  const previewRatio = template ? template.height / template.width : 54 / 86
  // The field overlays are positioned from previewWidth, so the preview has to
  // be measured rather than clamped in CSS: on a phone 420px would run off the
  // right edge, and a CSS-only clamp would leave the overlays behind.
  const previewWidth = Math.max(
    PREVIEW_MIN_WIDTH,
    Math.min(PREVIEW_BASE_WIDTH, canvasWidth - PREVIEW_GUTTER),
  )
  const previewHeight = previewWidth * previewRatio

  const renderedSvg = useMemo(() => {
    if (!template) return null
    try {
      return renderSvgWithData(template, fields, cardData)
    } catch (error) {
      console.error('Failed to render SVG preview', error)
      return template.rawSvg
    }
  }, [template, fields, cardData])

  /** The card design picked on the Export tab, if one was. */
  const exportCardDesign = useMemo(
    () => (selectedExportCardDesignId
      ? cardDesigns.find((design) => design.id === selectedExportCardDesignId) ?? null
      : null),
    [selectedExportCardDesignId, cardDesigns],
  )
  const exportDesignIsCanvas = exportCardDesign?.designerMode === 'canvas'

  /**
   * The design the Export tab is printing: the one picked there, or the one the
   * open template is the front of, so the back is offered either way.
   */
  const exportDesign = useMemo(() => {
    if (exportCardDesign) return exportCardDesign
    if (!selectedTemplateId) return null
    return cardDesigns.find((design) => design.frontTemplateId === selectedTemplateId) ?? null
  }, [exportCardDesign, selectedTemplateId, cardDesigns])

  const { backSide: exportBackSide } = useExportBackSide(exportDesign, designTemplates)

  const activeExportTemplate = exportCanvasDesign?.meta ?? template
  const activeExportFields = exportCanvasDesign?.fields ?? fields
  const activeExportCardData = exportCanvasDesign ? {} : cardData
  const activeExportRenderedSvg = exportCanvasDesign?.svg ?? renderedSvg

  // Check if a field is mapped
  const isFieldMapped = (field: FieldDefinition): boolean => {
    const sourceIdMapped = fieldMappings[field.sourceId || '']
    const idMapped = fieldMappings[field.id]
    if (sourceIdMapped || idMapped) return true
    return isAutoMappable(field)
  }

  /**
   * Import a single SVG into the editor and save it to the library.
   * Returns the saved template so a caller can link a pair together.
   */
  const importTemplateFile = async (file: File, { activate }: { activate: boolean }) => {
    const { metadata, autoFields } = await parseTemplate(file)
    const nextFields = autoFields.length > 0 ? autoFields : []

    if (activate) {
      resetPreviousObjectUrl(metadata.objectUrl)
      setTemplate(metadata)
      registerTemplateFonts(metadata.fonts)
      setFields(nextFields)
      setCardData(() => ({}))
      setSelectedFieldId(autoFields[0]?.id ?? null)
      setSelectedExportCardDesignId(null)
      setTemplateWarnings(metadata.warnings ?? [])
    }

    const savedTemplate = await storage.createTemplate(file, metadata, 'design')
    const autoMappings = generateAutoMappings(nextFields)
    if (autoMappings.length > 0) {
      await storage.saveFieldMappings(savedTemplate.id, autoMappings)
    }

    return { savedTemplate, metadata, fields: nextFields, autoMappings }
  }

  /**
   * Import a front and a back together and link them into a card design, so a
   * pair of exports from Illustrator becomes a usable card in one step.
   */
  const handleTemplatePairUpload = async (files: File[]) => {
    const parsed = await Promise.all(
      files.map(async (file) => {
        const { autoFields } = await parseTemplate(file)
        return { file, fileName: file.name, fields: autoFields }
      }),
    )

    const { front, back } = assignCardSides([parsed[0], parsed[1]])

    const frontResult = await importTemplateFile(front.file, { activate: true })
    const backResult = await importTemplateFile(back.file, { activate: false })
    await reloadDesignTemplates()

    setSelectedTemplateId(frontResult.savedTemplate.id)
    setActiveSide('front')

    const design = await createCardDesign({
      name: suggestDesignName(front.fileName, back.fileName),
      description: null,
      frontTemplateId: frontResult.savedTemplate.id,
      backTemplateId: backResult.savedTemplate.id,
    })
    setLinkedDesignId(design.id)
    setOtherSidePreview({ name: backResult.savedTemplate.name, svg: backResult.metadata.rawSvg })
    refreshCardDesigns()

    setFieldMappingsVersion((v) => v + 1)
    setStatusMessage(
      `Imported "${front.fileName}" as the front and "${back.fileName}" as the back, ` +
        `linked as the card design "${design.name}".`,
    )
  }

  const handleTemplateUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (selected.length === 0) return
    setErrorMessage(null)

    const packaged = selected.find(isTemplatePackage)
    if (packaged) {
      try {
        await handleOpenPackage(packaged)
      } catch (error) {
        console.error(error)
        setErrorMessage(error instanceof Error ? error.message : 'Failed to open the package')
      }
      return
    }

    if (selected.length >= 2) {
      try {
        await handleTemplatePairUpload(selected.slice(0, 2))
      } catch (error) {
        console.error(error)
        setErrorMessage(error instanceof Error ? error.message : 'Failed to import the template pair')
      }
      return
    }

    const file = selected[0]

    try {
      const { metadata, autoFields } = await parseTemplate(file)
      resetPreviousObjectUrl(metadata.objectUrl)
      setTemplate(metadata)
      registerTemplateFonts(metadata.fonts)

      const nextFields = autoFields.length > 0 ? autoFields : []
      setFields(nextFields)
      setCardData(() => ({}))
      setSelectedFieldId(autoFields[0]?.id ?? null)
      setSelectedTemplateId(null)
      setSelectedExportCardDesignId(null)

      const baseMessage = autoFields.length
        ? `Imported ${autoFields.length} editable placeholder${autoFields.length === 1 ? '' : 's'}.`
        : 'Template imported. No placeholders detected - add fields manually to continue.'
      setStatusMessage(baseMessage)
      setTemplateWarnings(metadata.warnings ?? [])
      setLinkedDesignId(null)
      setOtherSidePreview(null)
      setActiveSide('front')

      try {
        const savedTemplate = await storage.createTemplate(file, metadata, 'design')
        setSelectedTemplateId(savedTemplate.id)
        await reloadDesignTemplates()

        const autoMappings = generateAutoMappings(nextFields)
        if (autoMappings.length > 0) {
          await storage.saveFieldMappings(savedTemplate.id, autoMappings)
          setFieldMappingsVersion(v => v + 1)
          setStatusMessage(`${baseMessage} Saved "${savedTemplate.name}" with ${autoMappings.length} auto-mapped field${autoMappings.length === 1 ? '' : 's'}.`)
        } else {
          setStatusMessage(`${baseMessage} Saved "${savedTemplate.name}" to your template library.`)
        }
      } catch (uploadError) {
        console.error(uploadError)
        setSelectedTemplateId(null)
        setErrorMessage(uploadError instanceof Error ? uploadError.message : 'Failed to save template to library.')
        setStatusMessage(`${baseMessage} Saving to library failed.`)
      }
    } catch (error) {
      console.error(error)
      setErrorMessage(error instanceof Error ? error.message : 'Failed to import template')
    }
  }

  const handlePrintLayoutUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setErrorMessage(null)

    try {
      const { metadata } = await parseTemplate(file)
      await storage.createTemplate(file, metadata, 'print')
      await reloadPrintTemplates()
      setStatusMessage(`Print layout "${metadata.name}" uploaded successfully.`)
    } catch (error) {
      console.error(error)
      setErrorMessage(error instanceof Error ? error.message : 'Failed to upload print layout')
    }
  }

  const handleTemplateSelect = async (
    templateSummary: TemplateSummary,
    { keepExportDesign = false }: { keepExportDesign?: boolean } = {},
  ) => {
    try {
      setErrorMessage(null)
      const svgText = await loadTemplateSvgContent(templateSummary)
      const { metadata, autoFields } = await parseTemplateString(svgText, templateSummary.name)
      resetPreviousObjectUrl(metadata.objectUrl)
      setTemplate(metadata)
      registerTemplateFonts(metadata.fonts)
      const nextFields = autoFields.length > 0 ? autoFields : []
      setFields(nextFields)
      setCardData(() => ({}))
      setSelectedFieldId(autoFields[0]?.id ?? null)
      setSelectedTemplateId(templateSummary.id)
      if (!keepExportDesign) {
        setSelectedExportCardDesignId(null)
      }

      setTemplateWarnings(metadata.warnings ?? [])
      await syncLinkedDesign(templateSummary.id)

      const existingMappings = await storage.getFieldMappings(templateSummary.id)
      if (existingMappings.length === 0 && nextFields.length > 0) {
        const autoMappings = generateAutoMappings(nextFields)
        if (autoMappings.length > 0) {
          await storage.saveFieldMappings(templateSummary.id, autoMappings)
          setFieldMappingsVersion(v => v + 1)
          setStatusMessage(
            `Loaded template "${templateSummary.name}" with ${autoFields.length} placeholder${autoFields.length === 1 ? '' : 's'}. Auto-mapped ${autoMappings.length} field${autoMappings.length === 1 ? '' : 's'}.`
          )
          return
        }
      }

      setStatusMessage(
        autoFields.length
          ? `Loaded template "${templateSummary.name}" with ${autoFields.length} editable placeholder${autoFields.length === 1 ? '' : 's'}.`
          : `Loaded template "${templateSummary.name}". No placeholders detected - add fields manually to continue.`,
      )
    } catch (error) {
      console.error(error)
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load template')
    }
  }

  /**
   * Pick a card design to print. A design drawn in the card designer renders
   * from its canvas; one built from a pair of templates prints through its
   * front template, which is the path the rest of the export already takes.
   */
  const handleExportCardDesignSelect = async (designId: string | null) => {
    if (!designId) {
      setSelectedExportCardDesignId(null)
      return
    }

    const design = cardDesigns.find((candidate) => candidate.id === designId)
    if (!design) return

    if (design.designerMode === 'canvas') {
      setSelectedExportCardDesignId(designId)
      setSelectedTemplateId(null)
      setTemplate(null)
      setFields([])
      setCardData({})
      return
    }

    const frontSummary = design.frontTemplateId
      ? designTemplates.find((summary) => summary.id === design.frontTemplateId) ?? null
      : null

    if (!frontSummary) {
      setErrorMessage(
        `"${design.name}" has no front artwork. Open it in the Design tab and assign a front template.`,
      )
      return
    }

    setSelectedExportCardDesignId(designId)
    await handleTemplateSelect(frontSummary, { keepExportDesign: true })
  }

  /**
   * Note which card design (if any) the open template belongs to, and load the
   * other side so both can be shown together.
   */
  const syncLinkedDesign = async (templateId: string | null) => {
    if (!templateId) {
      setLinkedDesignId(null)
      setOtherSidePreview(null)
      return
    }

    const design = cardDesigns.find(
      (candidate) => candidate.frontTemplateId === templateId || candidate.backTemplateId === templateId,
    )
    if (!design) {
      setLinkedDesignId(null)
      setOtherSidePreview(null)
      return
    }

    setLinkedDesignId(design.id)
    const side: CardSide = design.frontTemplateId === templateId ? 'front' : 'back'
    setActiveSide(side)

    const otherId = side === 'front' ? design.backTemplateId : design.frontTemplateId
    if (!otherId) {
      setOtherSidePreview(null)
      return
    }

    const otherSummary = designTemplates.find((candidate) => candidate.id === otherId)
    if (!otherSummary) {
      setOtherSidePreview(null)
      return
    }

    try {
      const svg = await loadTemplateSvgContent(otherSummary)
      setOtherSidePreview({ name: otherSummary.name, svg })
    } catch (error) {
      console.error('Failed to load the other side of the card', error)
      setOtherSidePreview(null)
    }
  }

  const linkedDesign = linkedDesignId ? cardDesigns.find((design) => design.id === linkedDesignId) ?? null : null

  /**
   * The card's physical size, for guides that are specified in millimetres.
   *
   * Once a card area is set this is the trim line, not the artwork around it —
   * a magnetic stripe sits a fixed distance from the card's edge, not from the
   * edge of the bleed. Templates measured in pixels fall back to ID-1.
   */
  const cardSizeMm = useMemo(() => {
    if (template?.cardArea) {
      return { width: template.cardArea.trimWidthMm, height: template.cardArea.trimHeightMm }
    }
    if (template?.unit === 'mm' && template.width && template.height) {
      return { width: template.width, height: template.height }
    }
    return { width: ID1_WIDTH_MM, height: ID1_HEIGHT_MM }
  }, [template])

  /**
   * Where the card sits inside the artwork, in millimetres. The preview shows
   * the whole artwork, so guides drawn over it have to be offset by the bleed.
   */
  const cardOriginMm = useMemo(() => {
    if (!template?.cardArea) return { x: 0, y: 0 }
    const artwork = template.viewBox ?? { x: 0, y: 0, width: template.width, height: template.height }
    const rect = trimRectInMm(template.cardArea.trimBox, artwork, template.width, template.height)
    return { x: rect.x, y: rect.y }
  }, [template])

  /** The artwork's full physical size, bleed included. */
  const artworkSizeMm = useMemo(() => {
    if (template?.unit === 'mm' && template.width && template.height) {
      return { width: template.width, height: template.height }
    }
    return cardSizeMm
  }, [template, cardSizeMm])

  /**
   * Bring the other side of the linked card design into the editor.
   */
  const handleSwitchSide = async (side: CardSide) => {
    if (!linkedDesign || side === activeSide) return
    const targetId = side === 'front' ? linkedDesign.frontTemplateId : linkedDesign.backTemplateId
    if (!targetId) return
    const summary = designTemplates.find((candidate) => candidate.id === targetId)
    if (!summary) {
      setErrorMessage(`The ${side} template is no longer in your library.`)
      return
    }
    await handleTemplateSelect(summary)
  }

  /**
   * Open the Card Design dialog with the template currently in the editor
   * already chosen, so linking a back to it is one step.
   */
  const handleLinkSides = () => {
    if (linkedDesign) {
      setEditingDesign(linkedDesign)
      setDesignFormData({
        name: linkedDesign.name,
        description: linkedDesign.description ?? '',
        frontTemplateId: linkedDesign.frontTemplateId ?? '',
        backTemplateId: linkedDesign.backTemplateId ?? '',
      })
    } else {
      const current = selectedTemplateId ? designTemplates.find((t) => t.id === selectedTemplateId) : null
      setEditingDesign(null)
      setDesignFormData({
        name: current?.name.replace(/\.svg$/i, '') ?? '',
        description: '',
        frontTemplateId: selectedTemplateId ?? '',
        backTemplateId: '',
      })
    }
    setDesignDialogOpen(true)
  }

  /**
   * Load a generated blank into the editor and save it to the library, so it
   * behaves exactly like an imported template.
   */
  const handleOpenBlank = async (fileName: string, svg: string) => {
    setErrorMessage(null)
    try {
      const file = new File([svg], fileName, { type: 'image/svg+xml' })
      const { savedTemplate, fields: blankFields } = await importTemplateFile(file, { activate: true })
      await reloadDesignTemplates()
      setSelectedTemplateId(savedTemplate.id)
      setLinkedDesignId(null)
      setOtherSidePreview(null)
      setFieldMappingsVersion((v) => v + 1)
      setStatusMessage(
        `Created "${fileName}" with ${blankFields.length} placeholder${blankFields.length === 1 ? '' : 's'}.`,
      )
    } catch (error) {
      console.error(error)
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create the blank template')
    }
  }

  /**
   * Set a field up from a barcode read out of an image: the symbology it uses
   * and the value it carries become the field's type and its default.
   */
  const handleApplyScan = (scan: ScannedBarcode) => {
    if (!selectedField || !scan.symbology) return
    handleFieldChange(selectedField.id, 'type', 'barcode')
    handleFieldChange(selectedField.id, 'barcodeSymbology', scan.symbology)
    handleFieldChange(selectedField.id, 'defaultValue', scan.text)
    setStatusMessage(`Read a ${scan.formatName.replace(/_/g, ' ')} barcode and applied it to "${selectedField.label}".`)
  }

  /**
   * Adopt a chosen card area: re-read the template at its corrected size so the
   * preview, the guides and the export all agree on how big the card is.
   */
  const handleApplyCardArea = async (applied: AppliedCardArea, formatId: string, keepBleed: boolean) => {
    if (!template) return
    setErrorMessage(null)
    try {
      const { metadata, autoFields } = await parseTemplateString(applied.svg, template.name)
      resetPreviousObjectUrl(metadata.objectUrl)
      setTemplate({
        ...metadata,
        cardArea: {
          formatId,
          keepBleed,
          bleedMm: applied.bleedMm,
          trimBox: applied.trimBox,
          trimWidthMm: applied.trimWidthMm,
          trimHeightMm: applied.trimHeightMm,
        },
      })
      registerTemplateFonts(metadata.fonts)
      // Cropping moves every coordinate, so the fields have to be re-read.
      const nextFields = keepBleed && fields.length > 0 ? fields : autoFields
      setFields(nextFields)
      setSelectedFieldId((current) => (nextFields.some((f) => f.id === current) ? current : nextFields[0]?.id ?? null))
      setStatusMessage(
        `Card area set: printing at ${applied.widthMm} × ${applied.heightMm} mm.` +
          (applied.bleedMm ? ` Bleed kept at ${applied.bleedMm.top} mm.` : ' Bleed cropped away.') +
          (applied.trimLineRemoved ? ' Trim line removed.' : ''),
      )
    } catch (error) {
      console.error(error)
      setErrorMessage(error instanceof Error ? error.message : 'Could not apply the card area.')
    }
  }

  /**
   * Build a package: the design, what its layers mean, and the fonts it asks
   * for, so it opens somewhere else without the fonts being loaded again.
   */
  const handleDownloadPackage = async () => {
    if (!template?.rawSvg) return

    const mappingsFor = (mappings: Record<string, string>, customs: Record<string, string>): FieldMapping[] =>
      Object.entries(mappings).map(([svgLayerId, standardFieldName]) => ({
        svgLayerId,
        standardFieldName,
        ...(customs[svgLayerId] !== undefined ? { customValue: customs[svgLayerId] } : {}),
      }))

    const availableFonts = await storage.listFonts()

    // A linked pair is packaged whole, so the other side comes along with it.
    let back: { template: TemplateMeta; fields: FieldDefinition[]; mappings: FieldMapping[] } | null = null
    const otherId = linkedDesign
      ? activeSide === 'front'
        ? linkedDesign.backTemplateId
        : linkedDesign.frontTemplateId
      : null
    if (otherId) {
      const summary = designTemplates.find((candidate) => candidate.id === otherId)
      if (summary) {
        try {
          const svgText = await loadTemplateSvgContent(summary)
          const parsed = await parseTemplateString(svgText, summary.name)
          const otherMappings = await storage.getFieldMappings(summary.id)
          back = { template: parsed.metadata, fields: parsed.autoFields, mappings: otherMappings }
        } catch (error) {
          console.error('Could not add the other side to the package', error)
        }
      }
    }

    const sampleData: Record<string, string> = {}
    for (const [key, value] of Object.entries(cardData)) {
      if (typeof value === 'string' && value.trim()) sampleData[key] = value
    }

    const front = { template, fields, mappings: mappingsFor(fieldMappings, fieldCustomValues) }
    const { blob, manifest } = await createTemplatePackage({
      name: linkedDesign?.name ?? template.name,
      front: activeSide === 'back' && back ? back : front,
      back: activeSide === 'back' && back ? front : back,
      availableFonts,
      sampleData,
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = packageFileName(manifest.name)
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)

    const missing = manifest.missingFonts?.length
      ? ` ${manifest.missingFonts.length} font${manifest.missingFonts.length === 1 ? '' : 's'} could not be included: ${manifest.missingFonts.join(', ')}.`
      : ''
    setStatusMessage(
      `Packaged "${manifest.name}" with ${manifest.fonts.length} font${manifest.fonts.length === 1 ? '' : 's'}.${missing}`,
    )
  }

  /**
   * Open a package: both sides, their mappings, and the fonts, registered under
   * the names the artwork asks for.
   */
  const handleOpenPackage = async (file: File) => {
    const loaded = await readTemplatePackage(file)

    for (const font of loaded.fonts) {
      try {
        await loadFontFile(font.name, font.file)
      } catch (error) {
        console.error(`Could not load the packaged font "${font.name}"`, error)
      }
    }

    const importSide = async (side: typeof loaded.front, activate: boolean) => {
      const svgFile = new File([side.svg], side.name || 'template.svg', { type: 'image/svg+xml' })
      const { savedTemplate, metadata } = await importTemplateFile(svgFile, { activate })
      if (side.mappings.length > 0) {
        await storage.saveFieldMappings(savedTemplate.id, side.mappings)
      }
      if (activate) {
        // Fields and the card area were settled when the package was made.
        if (side.fields.length > 0) setFields(side.fields)
        if (side.cardArea) setTemplate({ ...metadata, cardArea: side.cardArea })
      }
      return savedTemplate
    }

    const frontTemplate = await importSide(loaded.front, true)
    const backTemplate = loaded.back ? await importSide(loaded.back, false) : null
    await reloadDesignTemplates()
    setSelectedTemplateId(frontTemplate.id)
    setActiveSide('front')

    let designId: string | null = null
    if (backTemplate) {
      const design = await createCardDesign({
        name: loaded.manifest.name,
        description: null,
        frontTemplateId: frontTemplate.id,
        backTemplateId: backTemplate.id,
      })
      designId = design.id
      setLinkedDesignId(design.id)
      setOtherSidePreview({ name: backTemplate.name, svg: loaded.back!.svg })
      refreshCardDesigns()
    } else {
      setLinkedDesignId(null)
      setOtherSidePreview(null)
    }

    setCardData(() => ({ ...(loaded.manifest.sampleData ?? {}) }))
    setFieldMappingsVersion((v) => v + 1)
    setStatusMessage(
      `Opened "${loaded.manifest.name}" with ${loaded.fonts.length} font${loaded.fonts.length === 1 ? '' : 's'}` +
        `${loaded.back ? ' and both sides' : ''}.`,
    )

    return {
      name: loaded.manifest.name,
      frontTemplateId: frontTemplate.id,
      backTemplateId: backTemplate?.id ?? null,
      designId,
    }
  }

  /**
   * Open the design a ?url= link points at.
   *
   * Someone following the link may never have used the app, or may have been
   * here before and already have it — so a package already opened in this
   * browser is reopened rather than imported a second time.
   */
  const handlePackageUrl = async (url: string) => {
    const source = describePackageSource(url)
    setLinkLoading(source)
    setErrorMessage(null)
    // Show the design the link is opening, rather than whatever tab the app
    // happens to start on.
    setActiveTab('design')
    setDesignMode('import')

    try {
      const fetched = await fetchPackage(url)
      const seen = recallOpenedPackage(fetched.hash)

      if (seen) {
        // Ask storage rather than the template list in state: this runs on
        // mount, before that list has loaded.
        const existing = await storage.getTemplate(seen.frontTemplateId).catch(() => null)
        if (existing) {
          await reloadDesignTemplates()
          await handleTemplateSelect(existing)
          const message = `Reopened "${seen.name}" — you already have this design.`
          setStatusMessage(message)
          setLinkResult({ ok: true, text: message })
          return
        }
        // It was opened before but has since been deleted, so import it again.
        forgetOpenedPackage(fetched.hash)
      }

      const file = new File([fetched.blob], 'card-design.zip', { type: 'application/zip' })
      const result = await handleOpenPackage(file)

      if (result && fetched.hash) {
        rememberOpenedPackage({
          hash: fetched.hash,
          frontTemplateId: result.frontTemplateId,
          backTemplateId: result.backTemplateId,
          designId: result.designId,
          name: result.name,
          openedAt: new Date().toISOString(),
        })
      }
      const message = `Opened "${result?.name ?? 'the design'}" from ${source}.`
      setStatusMessage(message)
      setLinkResult({ ok: true, text: message })
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : 'Could not open the design from that link.'
      setErrorMessage(message)
      setLinkResult({ ok: false, text: message })
    } finally {
      setLinkLoading(null)
      // Drop the parameter either way, so a refresh does not fetch it again.
      clearPackageUrlFromLocation()
    }
  }

  const handleOpenShare = () => {
    if (!template?.rawSvg) return
    const mappings: FieldMapping[] = Object.entries(fieldMappings).map(([svgLayerId, standardFieldName]) => ({
      svgLayerId,
      standardFieldName,
    }))
    setSharePayload(
      buildSharedTemplatePayload({
        name: template.name,
        svg: template.rawSvg,
        fields,
        mappings,
        cardData,
      }),
    )
    setShareDialogOpen(true)
  }

  /**
   * Take a template that arrived read-only and make it the user's own, so it
   * can be edited and saved to their library.
   */
  const handleCopySharedTemplate = () => {
    setIsSharedReadOnly(false)
    setStatusMessage('Shared template unlocked for editing. Use Open to save it into your library.')
  }

  // Open the design a ?url= link points at. Runs once per page load.
  useEffect(() => {
    if (linkPackageHandled) return
    const url = readPackageUrl(window.location.search)
    if (!url) return
    linkPackageHandled = true
    void handlePackageUrl(url)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Import a template carried in the location hash. Runs once per page load.
  useEffect(() => {
    if (shareLinkHandled) return
    const target = readShareTarget(window.location.hash)
    if (!target) return
    shareLinkHandled = true

    let cancelled = false

    const importShared = async () => {
      try {
        const shared = await decodeSharedTemplate(target.payload)
        const { metadata, autoFields } = await parseTemplateString(shared.svg, shared.name || 'shared-template.svg')
        if (cancelled) return

        resetPreviousObjectUrl(metadata.objectUrl)
        setTemplate(metadata)
        registerTemplateFonts(metadata.fonts)

        const nextFields = shared.fields?.length ? shared.fields : autoFields
        setFields(nextFields)
        setCardData(() => ({ ...(shared.sampleData ?? {}) }))
        setSelectedFieldId(nextFields[0]?.id ?? null)
        setSelectedTemplateId(null)
        setSelectedExportCardDesignId(null)

        const mappings = shared.mappings?.length ? shared.mappings : generateAutoMappings(nextFields)
        const mappingsMap: Record<string, string> = {}
        mappings.forEach((mapping) => {
          mappingsMap[mapping.svgLayerId] = mapping.standardFieldName
        })
        setFieldMappings(mappingsMap)

        setTemplateWarnings(metadata.warnings ?? [])
        setLinkedDesignId(null)
        setOtherSidePreview(null)
        setIsSharedReadOnly(target.mode === 'view')
        setActiveTab('design')
        setDesignMode('import')
        setStatusMessage(
          target.mode === 'view'
            ? `Opened shared template "${metadata.name}" in view-only mode.`
            : `Opened shared template "${metadata.name}". Use Open to save it to your library.`,
        )
      } catch (error) {
        console.error(error)
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : 'Could not open the shared template.')
        }
      } finally {
        // Drop the fragment either way, so a refresh doesn't replay a bad link.
        clearShareTarget()
      }
    }

    void importShared()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFieldSelect = (fieldId: string) => {
    setSelectedFieldId(fieldId)
  }

  const handleFieldChange = <K extends keyof FieldDefinition>(fieldId: string, key: K, value: FieldDefinition[K]) => {
    if (key === 'id' && typeof value === 'string') {
      const nextId = value.trim() || fieldId
      setFields((current) =>
        current.map((field) => (field.id === fieldId ? { ...field, id: nextId } : field)),
      )
      renameFieldInCardData(fieldId, nextId, setCardData)
      setSelectedFieldId(nextId)
      return
    }

    setFields((current) => current.map((field) => (field.id === fieldId ? { ...field, [key]: value } : field)))
  }

  const handleCardDataChange = (fieldId: string, value: string) => {
    setCardData((current) => ({ ...current, [fieldId]: value }))
  }

  const handleImageUpload = (fieldId: string, file: File) => {
    setImageFieldValue(file, fieldId, setCardData)
  }

  const handleImageAdjust = (fieldId: string, patch: Partial<ImageValue>) => {
    updateImageFieldValue(fieldId, patch, setCardData)
  }

  const handleAddField = () => {
    setFields((current) => {
      const newId = nextFieldId(current)
      const nextField = getDefaultField(newId)
      setSelectedFieldId(newId)
      return [...current, nextField]
    })
  }

  const handleDeleteField = (fieldId: string) => {
    setFields((current) => current.filter((field) => field.id !== fieldId))
    setCardData((current) => {
      const next = { ...current }
      delete next[fieldId]
      return next
    })
    if (selectedFieldId === fieldId) {
      setSelectedFieldId(null)
    }
  }

  const handleDuplicateField = (fieldId: string) => {
    setFields((current) => {
      const target = current.find((field) => field.id === fieldId)
      if (!target) return current
      const newId = nextFieldId(current)
      const duplicate: FieldDefinition = {
        ...target,
        id: newId,
        label: labelFromId(newId),
        auto: false,
        sourceId: undefined,
      }
      setSelectedFieldId(newId)
      return [...current, duplicate]
    })
  }

  const handleFontUploadClick = (fontName: string) => {
    const input = fontInputRefs.current[fontName]
    input?.click()
  }

  const handleFontFileSelect = async (fontName: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setErrorMessage(null)
    try {
      await loadFontFile(fontName, file)
      setStatusMessage(`Loaded font "${fontName}"`)
    } catch (error) {
      console.error(error)
      setErrorMessage(error instanceof Error ? `Failed to load font: ${error.message}` : 'Failed to load font file')
    }
  }

  const handleExport = async (options: ExportOptions) => {
    const exportTemplate = activeExportTemplate
    const exportFields = activeExportFields
    const exportCardData = activeExportCardData
    const exportTemplateId = exportCanvasDesign ? null : selectedTemplateId
    const exportBackSideForSlots: SlotBackSide | null = exportBackSide
      ? {
          template: exportBackSide.meta,
          fields: exportBackSide.fields,
          fieldMappings: exportBackSide.fieldMappings,
          customValues: exportBackSide.customValues,
        }
      : null

    if (!exportTemplate) {
      setErrorMessage('Select a template or canvas design before exporting.')
      return
    }

    if (exportFields.length === 0 && !exportCanvasDesign) {
      setErrorMessage('Define at least one field before exporting.')
      return
    }

    setIsExporting(true)
    setErrorMessage(null)

    const selectedColorProfile = options.colorProfileId
      ? colorProfiles.find((profile) => profile.id === options.colorProfileId) ?? null
      : null

    if (options.colorProfileId && !selectedColorProfile) {
      setIsExporting(false)
      setErrorMessage('Selected color profile could not be loaded.')
      return
    }

    // Load font data for text-to-outlines conversion in vector PDF exports
    if (options.format === 'pdf' && options.maintainVectors) {
      try {
        const savedFonts = await storage.listFonts()
        const fontBuffers = new Map<string, ArrayBuffer>()
        for (const font of savedFonts) {
          const binaryString = atob(font.fontData)
          const buffer = new ArrayBuffer(binaryString.length)
          const view = new Uint8Array(buffer)
          for (let i = 0; i < binaryString.length; i++) {
            view[i] = binaryString.charCodeAt(i)
          }
          fontBuffers.set(font.fontName, buffer)
        }
        setOutlineFontBuffers(fontBuffers)
      } catch (err) {
        console.warn('Failed to load fonts for outline conversion:', err)
      }
    }

    try {
      if (options.mode === 'database') {
        if (options.selectedUserIds.length === 0) {
          throw new Error('Select at least one user to export')
        }

        if (!exportTemplateId) {
          throw new Error('Template-based database export requires a saved template. Canvas design database export is not available yet.')
        }

        const mappings = await storage.getFieldMappings(exportTemplateId)
        const fieldMappingsMap: Record<string, string> = {}
        const customValuesMap: Record<string, string> = {}
        mappings.forEach((m) => {
          fieldMappingsMap[m.svgLayerId] = m.standardFieldName
          if (m.customValue) {
            customValuesMap[m.svgLayerId] = m.customValue
          }
        })

        if (Object.keys(fieldMappingsMap).length === 0) {
          throw new Error('No field mappings defined. Use "Map Fields" button in Design tab.')
        }

        const selectedUsers = users.filter((u) => options.selectedUserIds.includes(u.id!))

        const slotUserIds = options.slotUserIds
        const orderedUsers: typeof users = options.printLayoutId && slotUserIds && slotUserIds.length > 0
          ? slotUserIds
              .map((id) => users.find((u) => u.id === id))
              .filter((u): u is typeof users[number] => !!u)
          : selectedUsers

        if (options.format === 'pdf') {
          // Check for JSON print layout first
          if (options.jsonPrintLayoutId) {
            const jsonLayout = getPrintLayoutById(options.jsonPrintLayoutId)
            if (!jsonLayout) {
              throw new Error('Selected print layout not found')
            }

            // If we have slot assignments, use per-slot export
            if (options.slotAssignments && options.slotAssignments.length > 0) {
              // Build maps for templates referenced in slot assignments
              const allTemplates = new Map<string, TemplateMeta>()
              const allFieldMappings = new Map<string, Record<string, string>>()

              // Add the current template
              if (exportTemplate && exportTemplateId) {
                allTemplates.set(exportTemplateId, exportTemplate)
                allFieldMappings.set(exportTemplateId, fieldMappingsMap)
              }

              // Load any other templates referenced in slots
              const uniqueTemplateIds = new Set(
                options.slotAssignments
                  .map(s => s.templateId)
                  .filter((id): id is string => !!id && id !== exportTemplateId)
              )

              for (const templateId of uniqueTemplateIds) {
                const templateSummary = designTemplates.find(t => t.id === templateId)
                if (templateSummary) {
                  try {
                    const svgText = await loadTemplateSvgContent(templateSummary)
                    const { metadata } = await parseTemplateString(svgText, templateSummary.name)
                    allTemplates.set(templateId, metadata)

                    // Load field mappings for this template
                    const templateMappings = await storage.getFieldMappings(templateId)
                    const mappingsMap: Record<string, string> = {}
                    templateMappings.forEach((m) => {
                      mappingsMap[m.svgLayerId] = m.standardFieldName
                    })
                    allFieldMappings.set(templateId, mappingsMap)
                  } catch (err) {
                    console.warn(`Failed to load template ${templateId}:`, err)
                  }
                }
              }

              await exportWithSlotAssignments(
                exportTemplate,  // default front template
                exportBackSideForSlots,
                exportFields,
                exportCardData,  // custom card data for slots set to 'custom'
                users,
                fieldMappingsMap,
                jsonLayout,
                options.slotAssignments,
                options.resolution,
                customValuesMap,
                allTemplates,
                allFieldMappings,
                options.maintainVectors,
                selectedColorProfile,
              )
              const printed = options.slotAssignments.filter((slot) => slot.source !== 'empty').length
              setStatusMessage(`Exported ${printed} card${printed === 1 ? '' : 's'} to PDF with "${jsonLayout.name}" layout.`)
            } else {
              // Fallback to old batch behavior (fill pages with selected users)
              await exportBatchCardsWithJsonLayout(
                exportTemplate,
                exportFields,
                orderedUsers,
                fieldMappingsMap,
                jsonLayout,
                options.resolution,
                customValuesMap,
                options.maintainVectors,
                selectedColorProfile,
              )
              setStatusMessage(`Exported ${orderedUsers.length} cards to PDF with "${jsonLayout.name}" layout.`)
            }
          } else if (options.printLayoutId) {
            const printLayout = printTemplates.find((t) => t.id === options.printLayoutId)
            if (!printLayout) {
              throw new Error('Selected print layout not found')
            }
            await exportBatchCardsWithPrintLayout(
              exportTemplate,
              exportFields,
              orderedUsers,
              fieldMappingsMap,
              printLayout.svgPath,
              options.resolution,
              customValuesMap,
              options.maintainVectors,
              selectedColorProfile,
            )
            setStatusMessage(`Exported ${orderedUsers.length} cards to PDF with print layout "${printLayout.name}".`)
          } else {
            await exportBatchCards(
              exportTemplate,
              exportFields,
              selectedUsers,
              fieldMappingsMap,
              options.resolution,
              customValuesMap,
              options.maintainVectors,
              selectedColorProfile,
            )
            setStatusMessage(`Exported ${selectedUsers.length} cards to PDF.`)
          }
        } else {
          throw new Error(`${options.format.toUpperCase()} export is not yet implemented for batch mode`)
        }
      }
      else {
        if (options.format === 'pdf') {
          // Check for JSON print layout first
          if (options.jsonPrintLayoutId) {
            const jsonLayout = getPrintLayoutById(options.jsonPrintLayoutId)
            if (!jsonLayout) {
              throw new Error('Selected print layout not found')
            }

            // If we have slot assignments, use the new per-slot export
            if (options.slotAssignments && options.slotAssignments.length > 0) {
              // Get field mappings for the default template
              const fieldMappingsMap: Record<string, string> = {}
              const customValuesMap: Record<string, string> = {}

              if (exportTemplateId) {
                const mappings = await storage.getFieldMappings(exportTemplateId)
                mappings.forEach((m) => {
                  fieldMappingsMap[m.svgLayerId] = m.standardFieldName
                  if (m.customValue) {
                    customValuesMap[m.svgLayerId] = m.customValue
                  }
                })
              }

              // Build maps for templates referenced in slot assignments
              const allTemplates = new Map<string, TemplateMeta>()
              const allFieldMappings = new Map<string, Record<string, string>>()

              // Add the current template
              if (exportTemplate && exportTemplateId) {
                allTemplates.set(exportTemplateId, exportTemplate)
                allFieldMappings.set(exportTemplateId, fieldMappingsMap)
              }

              // Load any other templates referenced in slots
              const uniqueTemplateIds = new Set(
                options.slotAssignments
                  .map(s => s.templateId)
                  .filter((id): id is string => !!id && id !== exportTemplateId)
              )

              for (const templateId of uniqueTemplateIds) {
                const templateSummary = designTemplates.find(t => t.id === templateId)
                if (templateSummary) {
                  try {
                    const svgText = await loadTemplateSvgContent(templateSummary)
                    const { metadata, autoFields } = await parseTemplateString(svgText, templateSummary.name)
                    allTemplates.set(templateId, metadata)

                    // Load field mappings for this template
                    const templateMappings = await storage.getFieldMappings(templateId)
                    const mappingsMap: Record<string, string> = {}
                    templateMappings.forEach((m) => {
                      mappingsMap[m.svgLayerId] = m.standardFieldName
                    })
                    allFieldMappings.set(templateId, mappingsMap)
                  } catch (err) {
                    console.warn(`Failed to load template ${templateId}:`, err)
                  }
                }
              }

              await exportWithSlotAssignments(
                exportTemplate,  // default front template
                exportBackSideForSlots,
                exportFields,
                exportCardData,
                users,
                fieldMappingsMap,
                jsonLayout,
                options.slotAssignments,
                options.resolution,
                customValuesMap,
                allTemplates,
                allFieldMappings,
                options.maintainVectors,
                selectedColorProfile,
              )
              const printed = options.slotAssignments.filter((slot) => slot.source !== 'empty').length
              setStatusMessage(`Exported ${printed} card${printed === 1 ? '' : 's'} to PDF with "${jsonLayout.name}" layout.`)
            } else {
              // Fallback to filling all slots with the same card
              await exportWithJsonLayout(
                exportTemplate,
                exportFields,
                exportCardData,
                jsonLayout,
                options.resolution,
                options.maintainVectors,
                selectedColorProfile,
              )
              setStatusMessage(`Exported PDF with "${jsonLayout.name}" layout.`)
            }
          } else if (options.printLayoutId) {
            const printLayout = printTemplates.find((t) => t.id === options.printLayoutId)
            if (!printLayout) {
              throw new Error('Selected print layout not found')
            }
            await exportWithPrintLayout(
              exportTemplate,
              exportFields,
              exportCardData,
              printLayout.svgPath,
              options.resolution,
              options.maintainVectors,
              selectedColorProfile,
            )
            setStatusMessage(`Exported PDF with print layout "${printLayout.name}".`)
          } else {
            await exportSingleCard(
              exportTemplate,
              exportFields,
              exportCardData,
              options.resolution,
              options.maintainVectors,
              selectedColorProfile,
            )
            setStatusMessage(`Exported single card PDF.`)
          }
        } else {
          throw new Error(`${options.format.toUpperCase()} export is not yet implemented`)
        }
      }
    } catch (error) {
      console.error(error)
      setErrorMessage(
        error instanceof Error ? error.message : `Failed to export ${options.format.toUpperCase()}`
      )
    } finally {
      clearOutlineFontBuffers()
      setIsExporting(false)
    }
  }

  const registerFontInput = (fontName: string, element: HTMLInputElement | null) => {
    if (element) {
      fontInputRefs.current[fontName] = element
    } else {
      delete fontInputRefs.current[fontName]
    }
  }

  const handleTemplateRename = async (templateSummary: TemplateSummary, nextName: string) => {
    const trimmed = nextName.trim()
    if (!trimmed) {
      throw new Error('Template name cannot be empty.')
    }

    try {
      setErrorMessage(null)
      const updated = await storage.updateTemplate(templateSummary.id, { name: trimmed })
      await reloadDesignTemplates()
      setStatusMessage(`Renamed template to "${updated.name}".`)
      if (selectedTemplateId === templateSummary.id) {
        setTemplate(current => (current ? { ...current, name: updated.name } : current))
      }
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : 'Failed to rename template'
      setErrorMessage(message)
      throw new Error(message)
    }
  }

  const handleTemplateDelete = async (templateSummary: TemplateSummary) => {
    if (!confirm(`Are you sure you want to delete "${templateSummary.name}"?`)) {
      return
    }

    try {
      setErrorMessage(null)
      await storage.deleteTemplate(templateSummary.id)

      if (selectedTemplateId === templateSummary.id) {
        setTemplate(null)
        setFields([])
        setCardData({})
        setSelectedFieldId(null)
        setSelectedTemplateId(null)
      }

      await reloadDesignTemplates()
      await reloadPrintTemplates()
      setStatusMessage(`Deleted template "${templateSummary.name}".`)
    } catch (error) {
      console.error(error)
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete template')
    }
  }

  const handleOpenFieldMapping = () => {
    setFieldMappingDialogOpen(true)
  }

  const handleSaveFieldMappings = async (mappings: FieldMapping[]) => {
    if (!selectedTemplateId) {
      throw new Error('No template selected')
    }

    try {
      await storage.saveFieldMappings(selectedTemplateId, mappings)
      setStatusMessage(`Saved ${mappings.length} field mapping${mappings.length !== 1 ? 's' : ''}.`)
      setFieldMappingsVersion(v => v + 1)
      setTimeout(() => {
        setStatusMessage(null)
      }, 3000)
    } catch (error) {
      console.error(error)
      throw error
    }
  }

  const handleTemplateUploadClick = () => {
    templateUploadInputRef.current?.click()
  }

  // Render Design Tab mode tabs
  const renderDesignModeTabs = () => (
    <div className="design-mode-tabs">
      <button
        className={cn('design-mode-tab', designMode === 'import' && 'design-mode-tab--active')}
        onClick={() => setDesignMode('import')}
      >
        Import SVG
      </button>
      <button
        className={cn('design-mode-tab', designMode === 'designer' && 'design-mode-tab--active')}
        onClick={() => setDesignMode('designer')}
      >
        Card Designer
      </button>
      <button
        className={cn('design-mode-tab', designMode === 'designs' && 'design-mode-tab--active')}
        onClick={() => setDesignMode('designs')}
      >
        Card Designs
      </button>
    </div>
  )

  // Render Design Tab ribbon
  const renderDesignRibbon = () => (
    <Ribbon>
      {designMode === 'import' && (
        <>
          <RibbonGroup title="Template">
            <RibbonButton
              icon={<FolderOpen size={18} />}
              label="Open"
              onClick={handleTemplateUploadClick}
            />
            <input
              ref={templateUploadInputRef}
              type="file"
              accept="image/svg+xml,.zip"
              multiple
              onChange={handleTemplateUpload}
              style={{ display: 'none' }}
            />
            <RibbonButton
              icon={<Plus size={18} />}
              label="New Blank"
              onClick={() => setBlankDialogOpen(true)}
            />
            <RibbonButton
              icon={<CreditCard size={18} />}
              label={linkedDesign ? 'Edit Pair' : 'Link Front/Back'}
              onClick={handleLinkSides}
              disabled={!selectedTemplateId || isSharedReadOnly}
            />
            <RibbonButton
              icon={<Share2 size={18} />}
              label="Share"
              onClick={handleOpenShare}
              disabled={!template?.rawSvg}
            />
          </RibbonGroup>

          <RibbonGroup title="Field">
            <RibbonButton
              icon={<Plus size={18} />}
              label="Add"
              onClick={handleAddField}
              disabled={isSharedReadOnly}
            />
            <RibbonButton
              icon={<Copy size={18} />}
              label="Duplicate"
              onClick={() => selectedField && handleDuplicateField(selectedField.id)}
              disabled={!selectedField || isSharedReadOnly}
            />
            <RibbonButton
              icon={<Trash2 size={18} />}
              label="Delete"
              onClick={() => selectedField && handleDeleteField(selectedField.id)}
              disabled={!selectedField || isSharedReadOnly}
            />
            <RibbonDivider />
            <RibbonButton
              icon={<ScanLine size={18} />}
              label="Read Barcode"
              onClick={() => setScanDialogOpen(true)}
            />
            <RibbonButton
              icon={<Settings size={18} />}
              label="Map Fields"
              onClick={handleOpenFieldMapping}
              disabled={!selectedTemplateId || !template?.rawSvg || isSharedReadOnly}
            />
          </RibbonGroup>

          <RibbonGroup title="Check">
            <RibbonButton
              icon={<ClipboardCheck size={18} />}
              label="Test Cards"
              onClick={() => setTestCardsOpen(true)}
              disabled={!template}
            />
            <RibbonButton
              icon={<Badge2 size={18} />}
              label="Lanyard"
              onClick={() => setLanyardOpen(true)}
              disabled={!renderedSvg}
            />
          </RibbonGroup>

          <RibbonGroup title="Guides">
            <RibbonButton
              icon={<CreditCard size={18} />}
              label="Mag Stripe"
              onClick={() => setShowMagStripeGuide((value) => !value)}
              active={showMagStripeGuide}
              disabled={!template}
            />
            <RibbonButton
              icon={<ScanLine size={18} />}
              label={punchGuide === 'none' ? 'Punch' : PUNCH_POSITION_LABELS[punchGuide]}
              onClick={() =>
                setPunchGuide((current) => {
                  const order = PUNCH_POSITIONS
                  return order[(order.indexOf(current) + 1) % order.length]
                })
              }
              active={punchGuide !== 'none'}
              disabled={!template}
            />
            <RibbonButton
              icon={<Circle size={18} />}
              label={punchShapeGuide === 'slot' ? 'Slot' : 'Round'}
              onClick={() => setPunchShapeGuide((shape) => (shape === 'slot' ? 'round' : 'slot'))}
              disabled={!template || punchGuide === 'none'}
            />
            <RibbonButton
              icon={<Settings2 size={18} />}
              label="Safe Area"
              onClick={() => setShowSafeAreaGuide((value) => !value)}
              active={showSafeAreaGuide}
              disabled={!template}
            />
            <RibbonButton
              icon={<Ruler size={18} />}
              label="Card Area"
              onClick={() => setCardAreaOpen(true)}
              active={Boolean(template?.cardArea)}
              disabled={!template}
            />
          </RibbonGroup>

          <RibbonGroup title="Export">
            <RibbonButton
              icon={<FileDown size={18} />}
              label="Quick PDF"
              onClick={() => handleExport({ format: 'pdf', resolution: 300, maintainVectors: true, printLayoutId: null, jsonPrintLayoutId: null, mode: 'quick', selectedUserIds: [], slotUserIds: [], slotAssignments: [], colorProfileId: null })}
              disabled={!template || isExporting}
              size="large"
            />
          </RibbonGroup>

          <div style={{ flex: 1 }} />

          <RibbonButton
            icon={<HelpCircle size={16} />}
            label="Layer Help"
            onClick={() => setLayerNamingDialogOpen(true)}
          />
        </>
      )}

      {designMode === 'designs' && (
        <>
          <RibbonGroup title="Design">
            <RibbonButton
              icon={<Plus size={18} />}
              label="New"
              onClick={() => {
                setEditingDesign(null)
                setDesignFormData({ name: '', description: '', frontTemplateId: '', backTemplateId: '' })
                setDesignDialogOpen(true)
              }}
            />
            <RibbonButton
              icon={<Pencil size={18} />}
              label="Edit"
              onClick={() => {
                if (selectedCardDesignId) {
                  const design = cardDesigns.find(d => d.id === selectedCardDesignId)
                  if (design) {
                    setEditingDesign(design)
                    setDesignFormData({
                      name: design.name,
                      description: design.description ?? '',
                      frontTemplateId: design.frontTemplateId ?? '',
                      backTemplateId: design.backTemplateId ?? '',
                    })
                    setDesignDialogOpen(true)
                  }
                }
              }}
              disabled={!selectedCardDesignId}
            />
            <RibbonButton
              icon={<Trash2 size={18} />}
              label="Delete"
              onClick={async () => {
                if (selectedCardDesignId && confirm('Delete this card design?')) {
                  await deleteCardDesign(selectedCardDesignId)
                  setSelectedCardDesignId(null)
                }
              }}
              disabled={!selectedCardDesignId}
            />
          </RibbonGroup>
        </>
      )}
    </Ribbon>
  )

  // Render Export Tab ribbon
  const renderExportRibbon = () => (
    <Ribbon>
      <RibbonGroup title="Template">
        <RibbonButton
          icon={<FolderOpen size={18} />}
          label="Select"
          onClick={() => setActiveTab('design')}
        />
      </RibbonGroup>

      <RibbonGroup title="Mode">
        <RibbonButton
          icon={<FileDown size={18} />}
          label="Quick"
          active={false}
        />
        <RibbonButton
          icon={<Upload size={18} />}
          label="Batch"
          active={false}
        />
      </RibbonGroup>

      <RibbonGroup title="Export">
        <RibbonButton
          icon={<FileDown size={18} />}
          label="Export PDF"
          disabled={!activeExportTemplate || isExporting}
          size="large"
        />
      </RibbonGroup>
    </Ribbon>
  )

  // Render Calibration Tab ribbon
  const renderCalibrationRibbon = () => (
    <Ribbon>
      <RibbonGroup title="Mode">
        <RibbonButton
          icon={<Palette size={18} />}
          label="Swatch"
          onClick={() => setCalibrationMode('swatch')}
          active={calibrationMode === 'swatch'}
        />
        <RibbonButton
          icon={<ScanLine size={18} />}
          label="Compare"
          onClick={() => setCalibrationMode('compare')}
          active={calibrationMode === 'compare'}
        />
        <RibbonButton
          icon={<Settings2 size={18} />}
          label="Profiles"
          onClick={() => setCalibrationMode('profiles')}
          active={calibrationMode === 'profiles'}
        />
      </RibbonGroup>

      <RibbonDivider />

      <RibbonGroup title="Actions">
        {calibrationMode === 'swatch' && (
          <>
            <RibbonButton
              icon={<Download size={18} />}
              label="PDF"
              size="large"
            />
            <RibbonButton
              icon={<FileDown size={18} />}
              label="SVG"
            />
          </>
        )}
        {calibrationMode === 'compare' && (
          <RibbonButton
            icon={<Upload size={18} />}
            label="Upload"
            size="large"
          />
        )}
        {calibrationMode === 'profiles' && (
          <>
            <RibbonButton
              icon={<Upload size={18} />}
              label="Import"
            />
            <RibbonButton
              icon={<Download size={18} />}
              label="Export"
            />
          </>
        )}
      </RibbonGroup>
    </Ribbon>
  )

  return (
    <div className="app-layout">
      {/* Icon Navigation */}
      <IconNav
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as ActiveTab)}
      />

      {/* Main Content Area */}
      <div className="app-main">
        {/* How a ?url= load went. It sits above the tabs rather than in a side
            panel, which starts collapsed on a phone and would go unread. */}
        {linkResult && (
          <div
            className="link-result-banner"
            role={linkResult.ok ? 'status' : 'alert'}
            style={{
              background: linkResult.ok ? 'var(--success-soft)' : 'var(--danger-soft)',
              borderBottom: `1px solid ${linkResult.ok ? 'var(--success)' : 'var(--danger)'}`,
              color: linkResult.ok ? 'var(--success)' : 'var(--danger)',
            }}
          >
            <span className="link-result-banner__text">{linkResult.text}</span>
            <button
              type="button"
              className="link-result-banner__close"
              onClick={() => setLinkResult(null)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        {/* Design Mode Tabs */}
        {activeTab === 'design' && renderDesignModeTabs()}

        {/* Ribbon Toolbar */}
        {activeTab === 'design' && designMode !== 'designer' && renderDesignRibbon()}
        {activeTab === 'export' && renderExportRibbon()}
        {activeTab === 'calibration' && renderCalibrationRibbon()}

        {/* Content */}
        <div className="app-content">
          {activeTab === 'design' && designMode === 'designer' && (() => {
            const editingDesignData = editingCanvasDesignId
              ? cardDesigns.find(d => d.id === editingCanvasDesignId)
              : null
            return (
              <CardDesignerTab
                key={editingCanvasDesignId ?? 'new'}
                designId={editingCanvasDesignId ?? undefined}
                initialName={editingDesignData?.name}
                initialFrontData={editingDesignData?.frontCanvasData}
                initialBackData={editingDesignData?.backCanvasData}
                initialCardWidth={editingDesignData?.cardWidth}
                initialCardHeight={editingDesignData?.cardHeight}
                onSave={async (data) => {
                  try {
                    setErrorMessage(null)
                    if (editingCanvasDesignId) {
                      // Update existing design
                      const design = await updateCardDesign(editingCanvasDesignId, {
                        name: data.name,
                        designerMode: 'canvas',
                        frontCanvasData: data.frontCanvasData,
                        backCanvasData: data.backCanvasData,
                        cardWidth: data.cardWidth,
                        cardHeight: data.cardHeight,
                      })
                      setStatusMessage(`Updated design "${design.name}"`)
                    } else {
                      // Create new design
                      const design = await storage.createCardDesign({
                        name: data.name,
                        designerMode: 'canvas',
                        frontCanvasData: data.frontCanvasData,
                        backCanvasData: data.backCanvasData,
                        cardWidth: data.cardWidth,
                        cardHeight: data.cardHeight,
                      })
                      setStatusMessage(`Saved design "${design.name}"`)
                    }
                    // Refresh the card designs list
                    refreshCardDesigns()
                    setEditingCanvasDesignId(null)
                    setDesignMode('designs')
                  } catch (error) {
                    console.error('Failed to save design:', error)
                    setErrorMessage(error instanceof Error ? error.message : 'Failed to save design')
                  }
                }}
                onCancel={() => {
                  setEditingCanvasDesignId(null)
                  setDesignMode('import')
                }}
              />
            )
          })()}

          {activeTab === 'design' && designMode === 'import' && (
            <>
              {/* Left Panel - Templates & Fields */}
              <DockablePanel title="Templates" side="left" width={280}>
                <PanelSection title="Card Templates">
                  <TemplateSelector
                    title=""
                    templates={designTemplates}
                    selectedId={selectedTemplateId}
                    isLoading={designTemplatesLoading}
                    error={designTemplatesError}
                    onSelect={handleTemplateSelect}
                    onRetry={reloadDesignTemplates}
                    onUploadClick={handleTemplateUploadClick}
                    onDelete={handleTemplateDelete}
                    onRename={handleTemplateRename}
                  />
                </PanelSection>

                <PanelSection title={`Fonts (${fontList.length})`} defaultOpen={missingFonts.length > 0}>
                  {fontList.length === 0 ? (
                    <p className="empty-state__text">Load a template to detect fonts</p>
                  ) : (
                    <div>
                      {fontList.map((font) => (
                        <div key={font.name} className="font-item">
                          <div className="font-item__info">
                            <div className="font-item__name">{font.name}</div>
                          </div>
                          <span className={cn('font-item__status', font.status === 'loaded' ? 'font-item__status--loaded' : 'font-item__status--missing')}>
                            {font.status === 'loaded' ? 'OK' : 'Missing'}
                          </span>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm btn-icon"
                            style={{ marginLeft: 4 }}
                            onClick={() => handleFontUploadClick(font.name)}
                            title={font.status === 'loaded' ? 'Replace font' : 'Upload font'}
                          >
                            <Upload size={14} />
                          </button>
                          <input
                            ref={(element) => registerFontInput(font.name, element)}
                            type="file"
                            accept=".ttf,.otf,.woff,.woff2"
                            onChange={(event) => handleFontFileSelect(font.name, event)}
                            style={{ display: 'none' }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </PanelSection>

                <PanelSection title={`Fields (${fields.length})`}>
                  {fields.length === 0 ? (
                    <p className="empty-state__text">Upload a template or add a new field</p>
                  ) : (
                    <div className="field-list">
                      {fields.map((field) => (
                        <button
                          key={field.id}
                          type="button"
                          className={cn('field-item', field.id === selectedFieldId && 'field-item--selected')}
                          onClick={() => handleFieldSelect(field.id)}
                        >
                          <div>
                            <div className="field-item__name">{field.label}</div>
                            <div className="field-item__type">{field.type}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {isFieldMapped(field) && (
                              <Badge variant="default" style={{ fontSize: '0.625rem', backgroundColor: 'var(--success)', color: 'var(--success-on)' }}>
                                <Link size={10} style={{ marginRight: 2 }} />
                                mapped
                              </Badge>
                            )}
                            {field.auto && (
                              <Badge variant="secondary" style={{ fontSize: '0.625rem' }}>
                                auto
                              </Badge>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </PanelSection>

                {/* Shared read-only notice */}
                {isSharedReadOnly && (
                  <div
                    className="status-message"
                    style={{
                      margin: '8px 0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      background: 'var(--bg-surface-alt)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Eye size={14} />
                      Shared template, opened read-only.
                    </span>
                    <Button type="button" size="sm" variant="outline" onClick={handleCopySharedTemplate}>
                      Make a copy to edit
                    </Button>
                  </div>
                )}

                {template?.trimCandidates?.length && !template.cardArea ? (
                  <div
                    className="status-message"
                    style={{
                      margin: '8px 0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      background: 'var(--bg-surface-alt, var(--bg-surface-alt))',
                      color: 'var(--text-muted, var(--text-secondary))',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      <Ruler size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                      <span>
                        This artwork has a trim line inside the canvas. Until you say which rectangle
                        is the card, the whole canvas is used and the printed size is guessed from the
                        file's units.
                      </span>
                    </span>
                    <Button type="button" size="sm" variant="outline" onClick={() => setCardAreaOpen(true)}>
                      Set card area…
                    </Button>
                  </div>
                ) : null}

                {templateWarnings.map((warning) => (
                  <div
                    key={warning}
                    className="status-message status-message--warning"
                    style={{ margin: '8px 0', display: 'flex', gap: 6, alignItems: 'flex-start' }}
                  >
                    <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>{warning}</span>
                  </div>
                ))}

                {/* Status Messages */}
                {statusMessage && (
                  <div className="status-message status-message--success" style={{ margin: '8px 0' }}>
                    {statusMessage}
                  </div>
                )}
                {errorMessage && (
                  <div className="status-message status-message--error" style={{ margin: '8px 0' }}>
                    {errorMessage}
                  </div>
                )}
              </DockablePanel>

              {/* Main Canvas */}
              <div className="app-workspace">
                <div className="canvas-container" ref={setCanvasNode}>
                  {template && renderedSvg ? (
                    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        {linkedDesign && (
                          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                            {activeSide} · editing
                          </span>
                        )}
                        <div
                          className="canvas-preview"
                          style={{ width: previewWidth, height: previewHeight }}
                        >
                          <div style={{ position: 'absolute', inset: 0 }} dangerouslySetInnerHTML={{ __html: renderedSvg }} />
                          {fields.map((field) => (
                            <PreviewField
                              key={`preview-${field.id}`}
                              field={field}
                              value={cardData[field.id] as CardDataValue}
                              width={previewWidth}
                              height={previewHeight}
                            />
                          ))}
                          <CardGuideOverlay
                            artworkWidthMm={artworkSizeMm.width}
                            artworkHeightMm={artworkSizeMm.height}
                            cardWidthMm={cardSizeMm.width}
                            cardHeightMm={cardSizeMm.height}
                            cardOriginXMm={cardOriginMm.x}
                            cardOriginYMm={cardOriginMm.y}
                            previewWidth={previewWidth}
                            previewHeight={previewHeight}
                            magneticStripe={showMagStripeGuide}
                            punch={punchGuide}
                            punchShape={punchShapeGuide}
                            safeArea={showSafeAreaGuide}
                          />
                        </div>
                      </div>

                      {linkedDesign && otherSidePreview && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                            {activeSide === 'front' ? 'back' : 'front'}
                          </span>
                          <button
                            type="button"
                            title={`Edit the ${activeSide === 'front' ? 'back' : 'front'} of this card`}
                            onClick={() => handleSwitchSide(activeSide === 'front' ? 'back' : 'front')}
                            style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', opacity: 0.6 }}
                          >
                            <InlineSvg
                              className="canvas-preview"
                              style={{ width: previewWidth, height: previewHeight }}
                              markup={otherSidePreview.svg}
                              name="editor-other-side"
                            />
                          </button>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Click to edit this side</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <FolderOpen size={48} className="empty-state__icon" />
                      <p className="empty-state__text">
                        Upload an SVG template to see the live preview
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Panel - Card Data & Field Settings */}
              <DockablePanel title="Properties" side="right" width={260}>
                <PanelSection title="Card Data">
                  <CardDataPanel
                    fields={fields}
                    cardData={cardData}
                    onTextChange={handleCardDataChange}
                    onImageUpload={handleImageUpload}
                    onImageAdjust={handleImageAdjust}
                  />
                </PanelSection>

                <PanelSection title="Field Settings">
                  {selectedField ? (
                    <FieldEditorPanel
                      field={selectedField}
                      onChange={handleFieldChange}
                      fontOptions={fontOptions}
                      missingFonts={missingFonts}
                    />
                  ) : (
                    <p className="empty-state__text">Select a field to edit its properties</p>
                  )}
                </PanelSection>
              </DockablePanel>
            </>
          )}

          {activeTab === 'design' && designMode === 'designs' && (
            <>
              {/* Left Panel - Card Designs List */}
              <DockablePanel title="Card Designs" side="left" width={280}>
                <PanelSection title={`All Designs (${cardDesigns.length})`}>
                  {cardDesignsLoading ? (
                    <p className="empty-state__text">Loading designs...</p>
                  ) : cardDesigns.length === 0 ? (
                    <div className="empty-state">
                      <CreditCard size={32} className="empty-state__icon" />
                      <p className="empty-state__text">No card designs yet</p>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          setEditingDesign(null)
                          setDesignFormData({ name: '', description: '', frontTemplateId: '', backTemplateId: '' })
                          setDesignDialogOpen(true)
                        }}
                      >
                        <Plus size={14} style={{ marginRight: 4 }} />
                        Create Design
                      </button>
                    </div>
                  ) : (
                    <div className="field-list">
                      {cardDesigns.map((design) => (
                        <button
                          key={design.id}
                          type="button"
                          className={cn('field-item', design.id === selectedCardDesignId && 'field-item--selected')}
                          onClick={() => setSelectedCardDesignId(design.id)}
                        >
                          <div>
                            <div className="field-item__name">{design.name}</div>
                            <div className="field-item__type">
                              {design.designerMode === 'canvas'
                                ? 'Canvas design'
                                : design.frontTemplateId && design.backTemplateId
                                ? 'Front & Back'
                                : design.frontTemplateId
                                ? 'Front only'
                                : design.backTemplateId
                                ? 'Back only'
                                : 'No templates'}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </PanelSection>
              </DockablePanel>

              {/* Main Canvas - Design Preview */}
              <div className="app-workspace">
                <div className="canvas-container">
                  {!selectedCardDesignId ? (
                    <div className="empty-state">
                      <CreditCard size={48} className="empty-state__icon" />
                      <p className="empty-state__text">Select a card design to preview</p>
                    </div>
                  ) : (() => {
                    const selectedDesign = cardDesigns.find(d => d.id === selectedCardDesignId)
                    const isVertical = selectedDesign?.cardHeight && selectedDesign?.cardWidth
                      ? selectedDesign.cardHeight > selectedDesign.cardWidth
                      : false
                    return (
                    <div style={{
                      display: 'flex',
                      flexDirection: isVertical ? 'row' : 'column',
                      gap: isVertical ? 32 : 48,
                      flexWrap: 'wrap',
                      justifyContent: 'center',
                      alignItems: 'center',
                      padding: 24,
                      // Track the container instead of the cards' natural
                      // width, so a narrow screen scales them down.
                      width: '100%',
                      maxWidth: '100%',
                      boxSizing: 'border-box',
                    }}>
                      {/* Front Side */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, minWidth: 0, maxWidth: '100%' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                          Front
                        </div>
                        {(() => {
                          const preview = designPreview.front
                          if (preview.loading) {
                            return (
                              <div style={{ width: 450, maxWidth: '100%', height: 283, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border-default)' }}>
                                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading...</p>
                              </div>
                            )
                          }
                          if (preview.error) {
                            return (
                              <div style={{ width: 450, maxWidth: '100%', height: 283, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface)', borderRadius: 8, border: '1px dashed var(--border-default)' }}>
                                <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: 24 }}>{preview.error}</p>
                              </div>
                            )
                          }
                          if (preview.svg) {
                            return (
                              <InlineSvg
                                className="canvas-preview"
                                style={{ width: 450, maxWidth: '100%' }}
                                markup={preview.svg}
                                name="design-front"
                              />
                            )
                          }
                          return (
                            <div style={{ width: 450, maxWidth: '100%', height: 283, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface)', borderRadius: 8, border: '1px dashed var(--border-default)' }}>
                              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No template</p>
                            </div>
                          )
                        })()}
                      </div>

                      {/* Back Side */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, minWidth: 0, maxWidth: '100%' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                          Back
                        </div>
                        {(() => {
                          const preview = designPreview.back
                          if (preview.loading) {
                            return (
                              <div style={{ width: 450, maxWidth: '100%', height: 283, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border-default)' }}>
                                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading...</p>
                              </div>
                            )
                          }
                          if (preview.error) {
                            return (
                              <div style={{ width: 450, maxWidth: '100%', height: 283, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface)', borderRadius: 8, border: '1px dashed var(--border-default)' }}>
                                <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: 24 }}>{preview.error}</p>
                              </div>
                            )
                          }
                          if (preview.svg) {
                            return (
                              <InlineSvg
                                className="canvas-preview"
                                style={{ width: 450, maxWidth: '100%' }}
                                markup={preview.svg}
                                name="design-back"
                              />
                            )
                          }
                          return (
                            <div style={{ width: 450, maxWidth: '100%', height: 283, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface)', borderRadius: 8, border: '1px dashed var(--border-default)' }}>
                              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No template</p>
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                    )
                  })()}
                </div>
              </div>

              {/* Right Panel - Design Details */}
              <DockablePanel title="Details" side="right" width={260}>
                {selectedCardDesignId ? (
                  <>
                    <PanelSection title="Design Info">
                      {(() => {
                        const design = cardDesigns.find(d => d.id === selectedCardDesignId)
                        if (!design) return null
                        return (
                          <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Name:</span>{' '}
                              <strong>{design.name}</strong>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Type:</span>{' '}
                              {design.designerMode === 'canvas' ? (
                                <Badge variant="secondary" style={{ fontSize: 10 }}>Canvas Design</Badge>
                              ) : (
                                <Badge variant="outline" style={{ fontSize: 10 }}>Template Design</Badge>
                              )}
                            </div>
                            {design.description && (
                              <div>
                                <span style={{ color: 'var(--text-muted)' }}>Description:</span>{' '}
                                {design.description}
                              </div>
                            )}
                            {design.designerMode !== 'canvas' && (
                              <>
                                <div>
                                  <span style={{ color: 'var(--text-muted)' }}>Front Template:</span>{' '}
                                  {design.frontTemplateId
                                    ? designTemplates.find(t => t.id === design.frontTemplateId)?.name || 'Unknown'
                                    : 'None'}
                                </div>
                                <div>
                                  <span style={{ color: 'var(--text-muted)' }}>Back Template:</span>{' '}
                                  {design.backTemplateId
                                    ? designTemplates.find(t => t.id === design.backTemplateId)?.name || 'Unknown'
                                    : 'None'}
                                </div>
                              </>
                            )}
                            {design.designerMode === 'canvas' && design.cardWidth && design.cardHeight && (
                              <div>
                                <span style={{ color: 'var(--text-muted)' }}>Card Size:</span>{' '}
                                {design.cardWidth} × {design.cardHeight} mm
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </PanelSection>
                    <PanelSection title="Actions">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {(() => {
                          const design = cardDesigns.find(d => d.id === selectedCardDesignId)
                          const isCanvasDesign = design?.designerMode === 'canvas'
                          return (
                            <>
                              {isCanvasDesign && (
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => {
                                    setEditingCanvasDesignId(selectedCardDesignId)
                                    setDesignMode('designer')
                                  }}
                                >
                                  <PenTool size={14} style={{ marginRight: 4 }} />
                                  Edit in Designer
                                </button>
                              )}
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => {
                                    if (design) {
                                      setEditingDesign(design)
                                      setDesignFormData({
                                        name: design.name,
                                        description: design.description ?? '',
                                        frontTemplateId: design.frontTemplateId ?? '',
                                        backTemplateId: design.backTemplateId ?? '',
                                      })
                                      setDesignDialogOpen(true)
                                    }
                                  }}
                                >
                                  <Pencil size={14} style={{ marginRight: 4 }} />
                                  Edit Info
                                </button>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  style={{ color: 'var(--danger)' }}
                                  onClick={async () => {
                                    if (confirm('Delete this card design?')) {
                                      await deleteCardDesign(selectedCardDesignId)
                                      setSelectedCardDesignId(null)
                                    }
                                  }}
                                >
                                  <Trash2 size={14} style={{ marginRight: 4 }} />
                                  Delete
                                </button>
                              </div>
                            </>
                          )
                        })()}
                      </div>
                    </PanelSection>
                  </>
                ) : (
                  <PanelSection title="Design Info">
                    <p className="empty-state__text">Select a design to view details</p>
                  </PanelSection>
                )}
              </DockablePanel>
            </>
          )}

          {activeTab === 'users' && (
            <UsersTab
                designTemplates={designTemplates}
                designTemplatesLoading={designTemplatesLoading}
                designTemplatesError={designTemplatesError}
                onRefreshDesignTemplates={reloadDesignTemplates}
              />
          )}

          {activeTab === 'export' && (
            <ExportPage
                template={exportDesignIsCanvas ? null : selectedTemplateId ? designTemplates.find(t => t.id === selectedTemplateId) || null : null}
                templateMeta={activeExportTemplate}
                selectedTemplateId={exportDesignIsCanvas ? null : selectedTemplateId}
                fields={activeExportFields}
                cardData={activeExportCardData}
                printTemplates={printTemplates}
                printTemplatesLoading={printTemplatesLoading}
                printTemplatesError={printTemplatesError}
                onRefreshPrintTemplates={reloadPrintTemplates}
                onPrintLayoutUpload={handlePrintLayoutUpload}
                onExport={handleExport}
                isExporting={isExporting}
                renderedSvg={activeExportRenderedSvg}
                users={users}
                usersLoading={usersLoading}
                designTemplates={designTemplates}
                designTemplatesLoading={designTemplatesLoading}
                cardDesigns={cardDesigns}
                selectedCardDesignId={selectedExportCardDesignId}
                backSide={exportBackSide}
                onCardDesignSelect={handleExportCardDesignSelect}
                onTemplateSelect={(templateSummary) => {
                  setSelectedExportCardDesignId(null)
                  handleTemplateSelect(templateSummary)
                }}
                onCardDataChange={handleCardDataChange}
                colorProfiles={colorProfiles}
                colorProfilesLoading={colorProfilesLoading}
              />
          )}

          {activeTab === 'calibration' && (
            <CalibrationTab
              mode={calibrationMode}
              onModeChange={setCalibrationMode}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsTab
              onDataImported={() => {
                // Refresh all data after import
                reloadDesignTemplates()
                reloadPrintTemplates()
                refreshCardDesigns()
                // Reset current template selection since data may have changed
                setTemplate(null)
                setFields([])
                setCardData({})
                setSelectedFieldId(null)
                setSelectedTemplateId(null)
                setSelectedCardDesignId(null)
                setStatusMessage('Data imported successfully.')
              }}
            />
          )}
        </div>
      </div>

      {/* Field Mapping Dialog */}
      <FieldMappingDialog
        open={fieldMappingDialogOpen}
        onOpenChange={setFieldMappingDialogOpen}
        svgContent={template?.rawSvg ?? ''}
        fields={fields}
        templateId={selectedTemplateId}
        onSave={handleSaveFieldMappings}
      />

      {/* Loading a design from a ?url= link. Shown over everything, because on a
          phone the sidebar this would otherwise report into is off screen. */}
      {linkLoading && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(9, 9, 11, 0.55)',
            padding: '1.5rem',
          }}
        >
          <div
            style={{
              background: 'var(--bg-surface)',
              borderRadius: '0.75rem',
              padding: '1.25rem 1.5rem',
              maxWidth: 360,
              textAlign: 'center',
              boxShadow: '0 20px 45px rgba(0,0,0,0.3)',
            }}
          >
            <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>Opening card design…</p>
            <p style={{ margin: '0.375rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Downloading from {linkLoading}, with its fonts.
            </p>
          </div>
        </div>
      )}

      {/* Card Area Dialog */}
      <CardAreaDialog
        open={cardAreaOpen}
        onOpenChange={setCardAreaOpen}
        template={template}
        onApply={handleApplyCardArea}
      />

      {/* Lanyard Dialog */}
      <LanyardDialog
        open={lanyardOpen}
        onOpenChange={setLanyardOpen}
        frontSvg={activeSide === 'back' ? otherSidePreview?.svg ?? renderedSvg : renderedSvg}
        backSvg={activeSide === 'back' ? renderedSvg : otherSidePreview?.svg ?? null}
        widthMm={cardSizeMm.width}
        heightMm={cardSizeMm.height}
        artworkWidthMm={artworkSizeMm.width}
        artworkHeightMm={artworkSizeMm.height}
        cardOriginXMm={cardOriginMm.x}
        cardOriginYMm={cardOriginMm.y}
        hasMagneticStripe={showMagStripeGuide}
        punch={punchGuide}
        punchShape={punchShapeGuide}
        onPunchChange={setPunchGuide}
        onPunchShapeChange={setPunchShapeGuide}
      />

      {/* Test Cards Dialog */}
      <TestCardsDialog
        open={testCardsOpen}
        onOpenChange={setTestCardsOpen}
        template={template}
        fields={fields}
        fieldMappings={fieldMappings}
        customValues={fieldCustomValues}
      />

      {/* Barcode Scan Dialog */}
      <BarcodeScanDialog
        open={scanDialogOpen}
        onOpenChange={setScanDialogOpen}
        targetFieldLabel={selectedField && !isSharedReadOnly ? selectedField.label : null}
        onApply={selectedField && !isSharedReadOnly ? handleApplyScan : undefined}
      />

      {/* New Blank Template Dialog */}
      <CardBlankDialog open={blankDialogOpen} onOpenChange={setBlankDialogOpen} onOpenInEditor={handleOpenBlank} />

      {/* Share Template Dialog */}
      <ShareTemplateDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        payload={sharePayload}
        onDownloadPackage={handleDownloadPackage}
      />

      {/* Layer Naming Helper Dialog */}
      <Dialog open={layerNamingDialogOpen} onOpenChange={setLayerNamingDialogOpen}>
        <DialogContent
          style={{
            maxWidth: '960px',
            width: '95vw',
            maxHeight: '85vh',
            overflow: 'auto',
          }}
        >
          <DialogHeader>
            <DialogTitle>SVG Layer Naming Helper</DialogTitle>
            <DialogDescription>
              Build layer IDs that follow the convention described in docs/svg-layer-naming.md.
            </DialogDescription>
          </DialogHeader>
          <div style={{ paddingTop: '0.5rem' }}>
            <FieldNamingTab />
          </div>
        </DialogContent>
      </Dialog>

      {/* Card Design Dialog */}
      <Dialog
        open={designDialogOpen}
        onOpenChange={(open) => {
          setDesignDialogOpen(open)
          if (!open) {
            setEditingDesign(null)
            setDesignFormData({ name: '', description: '', frontTemplateId: '', backTemplateId: '' })
            setDesignFormError(null)
          } else if (editingDesign) {
            setDesignFormData({
              name: editingDesign.name,
              description: editingDesign.description ?? '',
              frontTemplateId: editingDesign.frontTemplateId ?? '',
              backTemplateId: editingDesign.backTemplateId ?? '',
            })
          }
        }}
      >
        <DialogContent>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setDesignFormError(null)
              const trimmedName = designFormData.name.trim()
              if (!trimmedName) {
                setDesignFormError('Design name is required.')
                return
              }
              const payload = {
                name: trimmedName,
                description: designFormData.description.trim() || null,
                frontTemplateId: designFormData.frontTemplateId || null,
                backTemplateId: designFormData.backTemplateId || null,
              }
              setDesignFormSaving(true)
              try {
                if (editingDesign) {
                  await updateCardDesign(editingDesign.id, payload)
                } else {
                  await createCardDesign(payload)
                }
                setDesignDialogOpen(false)
                setEditingDesign(null)
                setDesignFormData({ name: '', description: '', frontTemplateId: '', backTemplateId: '' })
                await refreshCardDesigns()
                if (selectedTemplateId) await syncLinkedDesign(selectedTemplateId)
              } catch (err) {
                setDesignFormError(err instanceof Error ? err.message : 'Failed to save')
              } finally {
                setDesignFormSaving(false)
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>{editingDesign ? 'Edit Card Design' : 'New Card Design'}</DialogTitle>
              <DialogDescription>
                Link front and back templates to create a reusable card design.
              </DialogDescription>
            </DialogHeader>

            <div style={{ display: 'grid', gap: '0.75rem', padding: '1rem 0' }}>
              {designFormError && (
                <div className="status-message status-message--error">{designFormError}</div>
              )}

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Design Name *</label>
                <Input
                  value={designFormData.name}
                  onChange={(e) => setDesignFormData((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Description</label>
                <Textarea
                  value={designFormData.description}
                  onChange={(e) => setDesignFormData((prev) => ({ ...prev, description: e.target.value }))}
                  rows={2}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Front Template</label>
                  <Select
                    value={designFormData.frontTemplateId || 'none'}
                    onValueChange={(value) => setDesignFormData((prev) => ({ ...prev, frontTemplateId: value === 'none' ? '' : value }))}
                    disabled={designTemplatesLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No front</SelectItem>
                      {designTemplates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Back Template</label>
                  <Select
                    value={designFormData.backTemplateId || 'none'}
                    onValueChange={(value) => setDesignFormData((prev) => ({ ...prev, backTemplateId: value === 'none' ? '' : value }))}
                    disabled={designTemplatesLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No back</SelectItem>
                      {designTemplates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter style={{ justifyContent: 'space-between' }}>
              {editingDesign ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={async () => {
                    if (confirm('Delete this card design?')) {
                      await deleteCardDesign(editingDesign.id)
                      setDesignDialogOpen(false)
                      setEditingDesign(null)
                      if (selectedCardDesignId === editingDesign.id) {
                        setSelectedCardDesignId(null)
                      }
                    }
                  }}
                  disabled={designFormSaving}
                >
                  Delete
                </Button>
              ) : (
                <span />
              )}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button type="button" variant="outline" onClick={() => setDesignDialogOpen(false)} disabled={designFormSaving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={designFormSaving}>
                  {designFormSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default App
