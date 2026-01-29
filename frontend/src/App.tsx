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
import { useStorage } from './lib/storage'
import { loadTemplateSvgContent } from './lib/templates'
import { FieldMappingDialog, type FieldMapping } from './components/FieldMappingDialog'
import { exportSingleCard, exportWithPrintLayout, exportBatchCards, exportBatchCardsWithPrintLayout, exportWithJsonLayout, exportBatchCardsWithJsonLayout, exportWithSlotAssignments } from './lib/exporter'
import { usePrintLayouts } from './hooks/usePrintLayouts'
import { generateAutoMappings } from './lib/autoMapping'
import { isAutoMappable } from './lib/autoMapping'
import type { CardData, CardDataValue, FieldDefinition, ImageValue, TemplateMeta } from './lib/types'
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
import { cn } from './lib/utils'

type ActiveTab = 'design' | 'users' | 'export' | 'calibration' | 'settings'
type DesignMode = 'import' | 'designer' | 'designs'

const PREVIEW_BASE_WIDTH = 420

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
          mappings.forEach(m => {
            mappingsMap[m.svgLayerId] = m.standardFieldName
          })
          setFieldMappings(mappingsMap)
        })
        .catch(() => {
          setFieldMappings({})
        })
    } else {
      setFieldMappings({})
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

  const selectedField = useMemo(
    () => fields.find((field) => field.id === selectedFieldId) ?? null,
    [fields, selectedFieldId],
  )

  const previewRatio = template ? template.height / template.width : 54 / 86
  const previewWidth = PREVIEW_BASE_WIDTH
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

  // Check if a field is mapped
  const isFieldMapped = (field: FieldDefinition): boolean => {
    const sourceIdMapped = fieldMappings[field.sourceId || '']
    const idMapped = fieldMappings[field.id]
    if (sourceIdMapped || idMapped) return true
    return isAutoMappable(field)
  }

  const handleTemplateUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setErrorMessage(null)

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

      const baseMessage = autoFields.length
        ? `Imported ${autoFields.length} editable placeholder${autoFields.length === 1 ? '' : 's'}.`
        : 'Template imported. No placeholders detected - add fields manually to continue.'
      setStatusMessage(baseMessage)

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

  const handleTemplateSelect = async (templateSummary: TemplateSummary) => {
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
    if (!template) {
      setErrorMessage('Upload a template before exporting.')
      return
    }

    if (fields.length === 0) {
      setErrorMessage('Define at least one field before exporting.')
      return
    }

    setIsExporting(true)
    setErrorMessage(null)

    try {
      if (options.mode === 'database') {
        if (options.selectedUserIds.length === 0) {
          throw new Error('Select at least one user to export')
        }

        if (!selectedTemplateId) {
          throw new Error('Template must be saved to use database mode')
        }

        const mappings = await storage.getFieldMappings(selectedTemplateId)
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
              if (template && selectedTemplateId) {
                allTemplates.set(selectedTemplateId, template)
                allFieldMappings.set(selectedTemplateId, fieldMappingsMap)
              }

              // Load any other templates referenced in slots
              const uniqueTemplateIds = new Set(
                options.slotAssignments
                  .map(s => s.templateId)
                  .filter((id): id is string => !!id && id !== selectedTemplateId)
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
                template,  // default front template
                null,      // back template (TODO: add back template support)
                fields,
                cardData,  // custom card data for slots set to 'custom'
                users,
                fieldMappingsMap,
                jsonLayout,
                options.slotAssignments,
                options.resolution,
                customValuesMap,
                allTemplates,
                allFieldMappings
              )
              setStatusMessage(`Exported ${options.slotAssignments.length} cards to PDF with "${jsonLayout.name}" layout.`)
            } else {
              // Fallback to old batch behavior (fill pages with selected users)
              await exportBatchCardsWithJsonLayout(
                template,
                fields,
                orderedUsers,
                fieldMappingsMap,
                jsonLayout,
                options.resolution,
                customValuesMap
              )
              setStatusMessage(`Exported ${orderedUsers.length} cards to PDF with "${jsonLayout.name}" layout.`)
            }
          } else if (options.printLayoutId) {
            const printLayout = printTemplates.find((t) => t.id === options.printLayoutId)
            if (!printLayout) {
              throw new Error('Selected print layout not found')
            }
            await exportBatchCardsWithPrintLayout(
              template,
              fields,
              orderedUsers,
              fieldMappingsMap,
              printLayout.svgPath,
              options.resolution,
              customValuesMap
            )
            setStatusMessage(`Exported ${orderedUsers.length} cards to PDF with print layout "${printLayout.name}".`)
          } else {
            await exportBatchCards(template, fields, selectedUsers, fieldMappingsMap, options.resolution, customValuesMap)
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
              let fieldMappingsMap: Record<string, string> = {}
              let customValuesMap: Record<string, string> = {}

              if (selectedTemplateId) {
                const mappings = await storage.getFieldMappings(selectedTemplateId)
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
              if (template && selectedTemplateId) {
                allTemplates.set(selectedTemplateId, template)
                allFieldMappings.set(selectedTemplateId, fieldMappingsMap)
              }

              // Load any other templates referenced in slots
              const uniqueTemplateIds = new Set(
                options.slotAssignments
                  .map(s => s.templateId)
                  .filter((id): id is string => !!id && id !== selectedTemplateId)
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
                template,  // default front template
                null,      // back template (TODO: add back template support)
                fields,
                cardData,
                users,
                fieldMappingsMap,
                jsonLayout,
                options.slotAssignments,
                options.resolution,
                customValuesMap,
                allTemplates,
                allFieldMappings
              )
              setStatusMessage(`Exported ${options.slotAssignments.length} cards to PDF with "${jsonLayout.name}" layout.`)
            } else {
              // Fallback to filling all slots with the same card
              await exportWithJsonLayout(
                template,
                fields,
                cardData,
                jsonLayout,
                options.resolution
              )
              setStatusMessage(`Exported PDF with "${jsonLayout.name}" layout.`)
            }
          } else if (options.printLayoutId) {
            const printLayout = printTemplates.find((t) => t.id === options.printLayoutId)
            if (!printLayout) {
              throw new Error('Selected print layout not found')
            }
            await exportWithPrintLayout(
              template,
              fields,
              cardData,
              printLayout.svgPath,
              options.resolution
            )
            setStatusMessage(`Exported PDF with print layout "${printLayout.name}".`)
          } else {
            await exportSingleCard(template, fields, cardData, options.resolution)
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
              accept="image/svg+xml"
              onChange={handleTemplateUpload}
              style={{ display: 'none' }}
            />
          </RibbonGroup>

          <RibbonGroup title="Field">
            <RibbonButton
              icon={<Plus size={18} />}
              label="Add"
              onClick={handleAddField}
            />
            <RibbonButton
              icon={<Copy size={18} />}
              label="Duplicate"
              onClick={() => selectedField && handleDuplicateField(selectedField.id)}
              disabled={!selectedField}
            />
            <RibbonButton
              icon={<Trash2 size={18} />}
              label="Delete"
              onClick={() => selectedField && handleDeleteField(selectedField.id)}
              disabled={!selectedField}
            />
            <RibbonDivider />
            <RibbonButton
              icon={<Settings size={18} />}
              label="Map Fields"
              onClick={handleOpenFieldMapping}
              disabled={!selectedTemplateId || !template?.rawSvg}
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

  // Render Users Tab ribbon
  const renderUsersRibbon = () => (
    <Ribbon>
      <RibbonGroup title="Users">
        <RibbonButton
          icon={<Plus size={18} />}
          label="Add User"
          disabled
        />
        <RibbonButton
          icon={<Upload size={18} />}
          label="Import CSV"
          disabled
        />
      </RibbonGroup>
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
          disabled={!template || isExporting}
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
        {/* Design Mode Tabs */}
        {activeTab === 'design' && renderDesignModeTabs()}

        {/* Ribbon Toolbar */}
        {activeTab === 'design' && designMode !== 'designer' && renderDesignRibbon()}
        {activeTab === 'users' && renderUsersRibbon()}
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
                              <Badge variant="default" style={{ fontSize: '0.625rem', backgroundColor: 'var(--success)' }}>
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
                <div className="canvas-container">
                  {template && renderedSvg ? (
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
                              {design.frontTemplateId && design.backTemplateId
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
                      padding: 24
                    }}>
                      {/* Front Side */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                          Front
                        </div>
                        {(() => {
                          const preview = designPreview.front
                          if (preview.loading) {
                            return (
                              <div style={{ width: 450, height: 283, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border-default)' }}>
                                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading...</p>
                              </div>
                            )
                          }
                          if (preview.error) {
                            return (
                              <div style={{ width: 450, height: 283, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface)', borderRadius: 8, border: '1px dashed var(--border-default)' }}>
                                <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: 24 }}>{preview.error}</p>
                              </div>
                            )
                          }
                          if (preview.svg) {
                            return (
                              <div
                                className="canvas-preview"
                                style={{ width: 450 }}
                                dangerouslySetInnerHTML={{ __html: preview.svg }}
                              />
                            )
                          }
                          return (
                            <div style={{ width: 450, height: 283, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface)', borderRadius: 8, border: '1px dashed var(--border-default)' }}>
                              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No template</p>
                            </div>
                          )
                        })()}
                      </div>

                      {/* Back Side */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                          Back
                        </div>
                        {(() => {
                          const preview = designPreview.back
                          if (preview.loading) {
                            return (
                              <div style={{ width: 450, height: 283, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border-default)' }}>
                                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading...</p>
                              </div>
                            )
                          }
                          if (preview.error) {
                            return (
                              <div style={{ width: 450, height: 283, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface)', borderRadius: 8, border: '1px dashed var(--border-default)' }}>
                                <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: 24 }}>{preview.error}</p>
                              </div>
                            )
                          }
                          if (preview.svg) {
                            return (
                              <div
                                className="canvas-preview"
                                style={{ width: 450 }}
                                dangerouslySetInnerHTML={{ __html: preview.svg }}
                              />
                            )
                          }
                          return (
                            <div style={{ width: 450, height: 283, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface)', borderRadius: 8, border: '1px dashed var(--border-default)' }}>
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
                template={selectedTemplateId ? designTemplates.find(t => t.id === selectedTemplateId) || null : null}
                templateMeta={template}
                selectedTemplateId={selectedTemplateId}
                fields={fields}
                cardData={cardData}
                printTemplates={printTemplates}
                printTemplatesLoading={printTemplatesLoading}
                printTemplatesError={printTemplatesError}
                onRefreshPrintTemplates={reloadPrintTemplates}
                onPrintLayoutUpload={handlePrintLayoutUpload}
                onExport={handleExport}
                isExporting={isExporting}
                renderedSvg={renderedSvg}
                users={users}
                usersLoading={usersLoading}
                designTemplates={designTemplates}
                designTemplatesLoading={designTemplatesLoading}
                onTemplateSelect={handleTemplateSelect}
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
                refreshCardDesigns()
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
