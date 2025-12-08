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
} from 'lucide-react'

import './App.css'
import { IconNav } from './components/IconNav'
import { Ribbon, RibbonGroup, RibbonButton, RibbonDivider } from './components/Ribbon'
import { DockablePanel, PanelSection } from './components/ui/dockable-panel'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui/dialog'
import { Badge } from './components/ui/badge'
import { TemplateSelector } from './components/TemplateSelector'
import { PreviewField } from './components/PreviewField'
import { CardDataPanel } from './components/CardDataPanel'
import { FieldEditorPanel } from './components/FieldEditorPanel'
import { ExportPage } from './components/ExportPage'
import { UsersTab } from './components/UsersTab'
import { CalibrationTab, type CalibrationMode } from './components/calibration'
import { useColorProfiles } from './hooks/calibration'
import { FieldNamingTab } from './components/FieldNamingTab'
import type { ExportOptions } from './components/ExportPage'
import { useFontManager } from './hooks/useFontManager'
import { useTemplateLibrary } from './hooks/useTemplateLibrary'
import { useUsers } from './hooks/useUsers'
import { deleteTemplateFromLibrary, uploadTemplateToLibrary, saveFieldMappings, getFieldMappings, renameTemplateInLibrary } from './lib/api'
import { FieldMappingDialog, type FieldMapping } from './components/FieldMappingDialog'
import { exportSingleCard, exportWithPrintLayout, exportBatchCards, exportBatchCardsWithPrintLayout } from './lib/exporter'
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

type ActiveTab = 'design' | 'users' | 'export' | 'calibration'

const PREVIEW_BASE_WIDTH = 420

function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('users')
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

  const { users, loading: usersLoading } = useUsers()

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
      getFieldMappings(selectedTemplateId)
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
  }, [selectedTemplateId, fields, fieldMappingsVersion])

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
        const savedTemplate = await uploadTemplateToLibrary(file, metadata, 'design')
        setSelectedTemplateId(savedTemplate.id)
        await reloadDesignTemplates()

        const autoMappings = generateAutoMappings(nextFields)
        if (autoMappings.length > 0) {
          await saveFieldMappings(savedTemplate.id, autoMappings)
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
      await uploadTemplateToLibrary(file, metadata, 'print')
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
      const response = await fetch(templateSummary.svgPath)
      if (!response.ok) {
        throw new Error(`Failed to load template: ${response.status}`)
      }
      const svgText = await response.text()
      const { metadata, autoFields } = await parseTemplateString(svgText, templateSummary.name)
      resetPreviousObjectUrl(metadata.objectUrl)
      setTemplate(metadata)
      registerTemplateFonts(metadata.fonts)
      const nextFields = autoFields.length > 0 ? autoFields : []
      setFields(nextFields)
      setCardData(() => ({}))
      setSelectedFieldId(autoFields[0]?.id ?? null)
      setSelectedTemplateId(templateSummary.id)

      const existingMappings = await getFieldMappings(templateSummary.id)
      if (existingMappings.length === 0 && nextFields.length > 0) {
        const autoMappings = generateAutoMappings(nextFields)
        if (autoMappings.length > 0) {
          await saveFieldMappings(templateSummary.id, autoMappings)
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

        const mappings = await getFieldMappings(selectedTemplateId)
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
          if (options.printLayoutId) {
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
          if (options.printLayoutId) {
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
      const updated = await renameTemplateInLibrary(templateSummary.id, { name: trimmed })
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
      await deleteTemplateFromLibrary(templateSummary.id)

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
      await saveFieldMappings(selectedTemplateId, mappings)
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

  // Render Design Tab ribbon
  const renderDesignRibbon = () => (
    <Ribbon>
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
          onClick={() => handleExport({ format: 'pdf', resolution: 300, maintainVectors: true, printLayoutId: null, mode: 'quick', selectedUserIds: [], slotUserIds: [] })}
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
      <IconNav activeTab={activeTab} onTabChange={(tab) => setActiveTab(tab as ActiveTab)} />

      {/* Main Content Area */}
      <div className="app-main">
        {/* Ribbon Toolbar */}
        {activeTab === 'design' && renderDesignRibbon()}
        {activeTab === 'users' && renderUsersRibbon()}
        {activeTab === 'export' && renderExportRibbon()}
        {activeTab === 'calibration' && renderCalibrationRibbon()}

        {/* Content */}
        <div className="app-content">
          {activeTab === 'design' && (
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
    </div>
  )
}

export default App
