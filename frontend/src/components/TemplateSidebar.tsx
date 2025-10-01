import { useRef, useState, useEffect, type ChangeEvent } from 'react'
import { Upload, Plus, AlertCircle, CheckCircle2, Settings, Link } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { ScrollArea } from './ui/scroll-area'
import { TemplateSelector } from './TemplateSelector'
import type { FieldDefinition } from '../lib/types'
import type { FontEntry } from '../hooks/useFontManager'
import type { TemplateSummary } from '../lib/templates'
import { getFieldMappings } from '../lib/api'
import { isAutoMappable } from '../lib/autoMapping'

export type TemplateSidebarProps = {
  selectedTemplateId: string | null
  designTemplates: TemplateSummary[]
  designTemplatesLoading: boolean
  designTemplatesError: string | null
  onRefreshDesignTemplates: () => void
  onTemplateSelect: (template: TemplateSummary) => void
  onTemplateUpload: (event: ChangeEvent<HTMLInputElement>) => void
  onTemplateDelete: (template: TemplateSummary) => void
  statusMessage: string | null
  errorMessage: string | null
  fontList: FontEntry[]
  missingFonts: string[]
  onFontUploadClick: (fontName: string) => void
  onFontFileSelect: (fontName: string, event: ChangeEvent<HTMLInputElement>) => void
  registerFontInput: (fontName: string, element: HTMLInputElement | null) => void
  fields: FieldDefinition[]
  selectedFieldId: string | null
  onFieldSelect: (fieldId: string) => void
  onAddField: () => void
  templateSvg: string | null
  onOpenFieldMapping: () => void
  fieldMappingsVersion: number
}

export function TemplateSidebar({
  selectedTemplateId,
  designTemplates,
  designTemplatesLoading,
  designTemplatesError,
  onRefreshDesignTemplates,
  onTemplateSelect,
  onTemplateUpload,
  onTemplateDelete,
  statusMessage,
  errorMessage,
  fontList,
  missingFonts,
  onFontUploadClick,
  onFontFileSelect,
  registerFontInput,
  fields,
  selectedFieldId,
  onFieldSelect,
  onAddField,
  templateSvg,
  onOpenFieldMapping,
  fieldMappingsVersion,
}: TemplateSidebarProps) {
  const templateUploadInputRef = useRef<HTMLInputElement | null>(null)
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({})

  // Fetch field mappings when template is selected, fields change, or mappings are saved
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

  const handleTemplateUploadClick = () => {
    templateUploadInputRef.current?.click()
  }

  // Check if a field is mapped (either saved or would be auto-mapped)
  const isFieldMapped = (field: FieldDefinition): boolean => {
    // Check if already saved in database
    const sourceIdMapped = fieldMappings[field.sourceId || '']
    const idMapped = fieldMappings[field.id]

    if (sourceIdMapped || idMapped) {
      return true
    }

    // Check if it would be auto-mapped (even if not saved yet)
    return isAutoMappable(field)
  }

  return (
    <aside style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Card Design Templates */}
      <Card>
        <CardHeader>
          <CardTitle style={{ fontSize: '1rem' }}>Card Design Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <TemplateSelector
            title=""
            templates={designTemplates}
            selectedId={selectedTemplateId}
            isLoading={designTemplatesLoading}
            error={designTemplatesError}
            onSelect={onTemplateSelect}
            onRetry={onRefreshDesignTemplates}
            onUploadClick={handleTemplateUploadClick}
            onDelete={onTemplateDelete}
          />
          <input
            ref={templateUploadInputRef}
            type="file"
            accept="image/svg+xml"
            onChange={onTemplateUpload}
            style={{ display: 'none' }}
          />

          {statusMessage && (
            <div style={{
              marginTop: '0.75rem',
              padding: '0.75rem',
              backgroundColor: '#f0fdf4',
              border: '1px solid #86efac',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              color: '#166534',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <CheckCircle2 style={{ width: '1rem', height: '1rem', flexShrink: 0 }} />
              {statusMessage}
            </div>
          )}

          {errorMessage && (
            <div style={{
              marginTop: '0.75rem',
              padding: '0.75rem',
              backgroundColor: '#fef2f2',
              border: '1px solid #fca5a5',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <AlertCircle style={{ width: '1rem', height: '1rem', flexShrink: 0 }} />
              {errorMessage}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fonts */}
      <Card>
        <CardHeader>
          <CardTitle style={{ fontSize: '1rem' }}>Fonts</CardTitle>
          <CardDescription>
            {fontList.length === 0
              ? 'Load a template to detect fonts'
              : missingFonts.length > 0
              ? `${missingFonts.length} font${missingFonts.length > 1 ? 's' : ''} missing`
              : 'All fonts loaded'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fontList.length === 0 ? (
            <p style={{ fontSize: '0.875rem', color: '#71717a' }}>
              Fonts from the template appear here once an SVG is imported.
            </p>
          ) : (
            <ScrollArea style={{ maxHeight: '200px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {fontList.map((font) => (
                  <div
                    key={font.name}
                    style={{
                      padding: '0.75rem',
                      border: '1px solid #e4e4e7',
                      borderRadius: '0.375rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {font.name}
                      </span>
                      <Badge variant={font.status === 'loaded' ? 'secondary' : 'destructive'} style={{ fontSize: '0.625rem' }}>
                        {font.status === 'loaded' ? 'Loaded' : 'Missing'}
                      </Badge>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: '#71717a' }}>
                      <span>{font.source === 'template' ? 'Template font' : 'Custom font'}</span>
                      {font.fileName && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{font.fileName}</span>}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onFontUploadClick(font.name)}
                      style={{ width: '100%' }}
                    >
                      <Upload style={{ width: '0.875rem', height: '0.875rem', marginRight: '0.5rem' }} />
                      {font.status === 'loaded' ? 'Replace' : 'Upload'}
                    </Button>

                    <input
                      ref={(element) => registerFontInput(font.name, element)}
                      type="file"
                      accept=".ttf,.otf,.woff,.woff2"
                      onChange={(event) => onFontFileSelect(font.name, event)}
                      style={{ display: 'none' }}
                    />
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Fields */}
      <Card>
        <CardHeader>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <CardTitle style={{ fontSize: '1rem' }}>Fields</CardTitle>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {selectedTemplateId && templateSvg && (
                <Button variant="outline" size="sm" onClick={onOpenFieldMapping}>
                  <Settings style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
                  Map Fields
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={onAddField}>
                <Plus style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
                Add Field
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {fields.length === 0 ? (
            <p style={{ fontSize: '0.875rem', color: '#71717a' }}>
              Upload a template or add a new field to get started.
            </p>
          ) : (
            <ScrollArea style={{ maxHeight: '300px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {fields.map((field) => (
                  <button
                    key={field.id}
                    type="button"
                    onClick={() => onFieldSelect(field.id)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      textAlign: 'left',
                      border: '1px solid',
                      borderColor: field.id === selectedFieldId ? '#18181b' : '#e4e4e7',
                      backgroundColor: field.id === selectedFieldId ? '#fafafa' : '#fff',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem'
                    }}
                    onMouseEnter={(e) => {
                      if (field.id !== selectedFieldId) {
                        e.currentTarget.style.backgroundColor = '#f9f9f9'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (field.id !== selectedFieldId) {
                        e.currentTarget.style.backgroundColor = '#fff'
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{field.label}</span>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        {isFieldMapped(field) && (
                          <Badge variant="default" style={{ fontSize: '0.625rem', backgroundColor: '#10b981', borderColor: '#10b981' }}>
                            <Link style={{ width: '0.75rem', height: '0.75rem', marginRight: '0.25rem' }} />
                            mapped
                          </Badge>
                        )}
                        {field.auto && (
                          <Badge variant="secondary" style={{ fontSize: '0.625rem' }}>
                            auto
                          </Badge>
                        )}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#71717a' }}>{field.type}</span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </aside>
  )
}
