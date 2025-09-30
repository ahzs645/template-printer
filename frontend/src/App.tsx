import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'

import './App.css'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'
import { TemplateSidebar } from './components/TemplateSidebar'
import { PreviewWorkspace } from './components/PreviewWorkspace'
import { ExportPage } from './components/ExportPage'
import { UsersTab } from './components/UsersTab'
import type { ExportOptions } from './components/ExportPage'
import { useFontManager } from './hooks/useFontManager'
import { useTemplateLibrary } from './hooks/useTemplateLibrary'
import { deleteTemplateFromLibrary, uploadTemplateToLibrary } from './lib/api'
import { exportSingleCard, exportWithPrintLayout } from './lib/exporter'
import type { CardData, FieldDefinition, ImageValue, TemplateMeta } from './lib/types'
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

type ActiveTab = 'design' | 'users' | 'export'

const PREVIEW_BASE_WIDTH = 420

function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('design')
  const [template, setTemplate] = useState<TemplateMeta | null>(null)
  const [fields, setFields] = useState<FieldDefinition[]>([])
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [cardData, setCardData] = useState<CardData>(() => ({}))
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const previousObjectUrl = useRef<string | null>(null)
  const fontInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

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
        setStatusMessage(`${baseMessage} Saved "${savedTemplate.name}" to your template library.`)
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
      setStatusMessage(
        autoFields.length
          ? `Loaded template “${templateSummary.name}” with ${autoFields.length} editable placeholder${autoFields.length === 1 ? '' : 's'}.`
          : `Loaded template “${templateSummary.name}”. No placeholders detected - add fields manually to continue.`,
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
      // TODO: Implement PNG and SVG export formats
      if (options.format === 'pdf') {
        if (options.printLayoutId) {
          const printLayout = printTemplates.find(t => t.id === options.printLayoutId)
          if (!printLayout) {
            throw new Error('Selected print layout not found')
          }
          await exportWithPrintLayout(template, fields, cardData, printLayout.svgPath, options.resolution)
          setStatusMessage(`Exported PDF with print layout "${printLayout.name}".`)
        } else {
          await exportSingleCard(template, fields, cardData, options.resolution)
          setStatusMessage(`Exported single card PDF.`)
        }
      } else {
        throw new Error(`${options.format.toUpperCase()} export is not yet implemented`)
      }
    } catch (error) {
      console.error(error)
      setErrorMessage(error instanceof Error ? error.message : `Failed to export ${options.format.toUpperCase()}`)
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

  const handleTemplateDelete = async (templateSummary: TemplateSummary) => {
    if (!confirm(`Are you sure you want to delete "${templateSummary.name}"?`)) {
      return
    }

    try {
      setErrorMessage(null)
      await deleteTemplateFromLibrary(templateSummary.id)

      // If the deleted template was selected, clear the current template
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

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>ID Card Maker</h1>
          <p className="subtitle">Import Illustrator SVG templates, define editable fields, and preview cards.</p>
        </div>
        <div className="template-meta">
          {template ? (
            <Fragment>
              <span className="meta-item">Template: {template.name}</span>
              <span className="meta-item">
                Size: {template.width} × {template.height} {template.unit}
              </span>
              {template.viewBox ? (
                <span className="meta-item">
                  ViewBox: {template.viewBox.width.toFixed(0)} × {template.viewBox.height.toFixed(0)}
                </span>
              ) : null}
              {template.fonts.length ? (
                <span className="meta-item">Fonts: {template.fonts.join(', ')}</span>
              ) : null}
            </Fragment>
          ) : (
            <span className="meta-item muted">No template loaded</span>
          )}
        </div>
      </header>

      <nav className="app-tabs">
        <button
          className={`tab ${activeTab === 'design' ? 'active' : ''}`}
          onClick={() => setActiveTab('design')}
        >
          Design
        </button>
        <button
          className={`tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Users
        </button>
        <button
          className={`tab ${activeTab === 'export' ? 'active' : ''}`}
          onClick={() => setActiveTab('export')}
        >
          Export
        </button>
      </nav>

      <main className="app-main">
        {activeTab === 'design' ? (
          <Fragment>
            <TemplateSidebar
              selectedTemplateId={selectedTemplateId}
              designTemplates={designTemplates}
              designTemplatesLoading={designTemplatesLoading}
              designTemplatesError={designTemplatesError}
              onRefreshDesignTemplates={reloadDesignTemplates}
              onTemplateSelect={handleTemplateSelect}
              onTemplateUpload={handleTemplateUpload}
              onTemplateDelete={handleTemplateDelete}
              statusMessage={statusMessage}
              errorMessage={errorMessage}
              fontList={fontList}
              missingFonts={missingFonts}
              onFontUploadClick={handleFontUploadClick}
              onFontFileSelect={handleFontFileSelect}
              registerFontInput={registerFontInput}
              fields={fields}
              selectedFieldId={selectedFieldId}
              onFieldSelect={handleFieldSelect}
              onAddField={handleAddField}
            />

            <PreviewWorkspace
              template={template}
              renderedSvg={renderedSvg}
              fields={fields}
              cardData={cardData}
              selectedField={selectedField}
              onCardDataChange={handleCardDataChange}
              onImageUpload={handleImageUpload}
              onImageAdjust={handleImageAdjust}
              onFieldChange={handleFieldChange}
              onDuplicateField={handleDuplicateField}
              onDeleteField={handleDeleteField}
              fontOptions={fontOptions}
              missingFonts={missingFonts}
              onExportPdf={handleExport}
              isExporting={isExporting}
              previewWidth={previewWidth}
              previewHeight={previewHeight}
            />
          </Fragment>
        ) : activeTab === 'users' ? (
          <UsersTab />
        ) : (
          <ExportPage
            template={template}
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
          />
        )}
      </main>
    </div>
  )
}

export default App
