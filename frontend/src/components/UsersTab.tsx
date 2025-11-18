import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Pencil, Trash2, Download, Upload, ImageIcon } from 'lucide-react'

import { useUsers } from '../hooks/useUsers'
import { useCardDesigns } from '../hooks/useCardDesigns'
import type { UserData } from '../lib/fieldParser'
import type { CardDesign } from '../lib/types'
import type { TemplateSummary } from '../lib/templates'
import { parseField } from '../lib/fieldParser'
import { parseTemplateString, renderSvgWithData } from '../lib/svgTemplate'
import { getFieldMappings } from '../lib/api'
import type { CardData, FieldDefinition, TemplateMeta } from '../lib/types'

import { Button } from './ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'

type UsersTabProps = {
  designTemplates: TemplateSummary[]
  designTemplatesLoading: boolean
  designTemplatesError: string | null
  onRefreshDesignTemplates: () => void
}

type PreviewPane = {
  svg: string | null
  loading: boolean
  error: string | null
}

type PreviewState = Record<'front' | 'back', PreviewPane>

const createInitialPreviewState = (): PreviewState => ({
  front: { svg: null, loading: false, error: null },
  back: { svg: null, loading: false, error: null },
})

type DesignFormState = {
  name: string
  description: string
  frontTemplateId: string
  backTemplateId: string
}

export function UsersTab({
  designTemplates,
  designTemplatesLoading,
  designTemplatesError,
  onRefreshDesignTemplates,
}: UsersTabProps) {
  const {
    users,
    loading,
    error,
    createUser,
    updateUser,
    deleteUser,
    refresh,
  } = useUsers()
  const {
    designs,
    loading: cardDesignsLoading,
    error: cardDesignsError,
    createDesign,
    updateDesign,
    deleteDesign,
    refresh: refreshCardDesigns,
  } = useCardDesigns()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserData | null>(null)
  const [formData, setFormData] = useState<Partial<UserData>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const csvImportInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadingPhotoFor, setUploadingPhotoFor] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [assigningDesign, setAssigningDesign] = useState(false)

  const [preview, setPreview] = useState<PreviewState>(() => createInitialPreviewState())
  const [previewSide, setPreviewSide] = useState<'front' | 'back' | 'both'>('front')
  const [previewLayout, setPreviewLayout] = useState<'side-by-side' | 'stacked'>('side-by-side')

  const templateCacheRef = useRef<Map<string, { meta: TemplateMeta; fields: FieldDefinition[] }>>(new Map())
  const mappingCacheRef = useRef<Map<string, { mappings: Record<string, string>; customValues: Record<string, string> }>>(new Map())

  const [designDialogOpen, setDesignDialogOpen] = useState(false)
  const [designEditing, setDesignEditing] = useState<CardDesign | null>(null)
  const [designForm, setDesignForm] = useState<DesignFormState>({
    name: '',
    description: '',
    frontTemplateId: '',
    backTemplateId: '',
  })
  const [designFormError, setDesignFormError] = useState<string | null>(null)
  const [designSaving, setDesignSaving] = useState(false)

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [users, selectedUserId],
  )

  const selectedDesign = useMemo(
    () => (selectedUser?.cardDesignId ? designs.find((design) => design.id === selectedUser.cardDesignId) ?? null : null),
    [designs, selectedUser],
  )

  const templateLookup = useMemo(() => {
    const map = new Map<string, TemplateSummary>()
    designTemplates.forEach((template) => map.set(template.id, template))
    designs.forEach((design) => {
      if (design.frontTemplate) {
        map.set(design.frontTemplate.id, design.frontTemplate)
      }
      if (design.backTemplate) {
        map.set(design.backTemplate.id, design.backTemplate)
      }
    })
    return map
  }, [designTemplates, designs])

  const resolveTemplateSummary = useCallback(
    (templateId: string | null | undefined): TemplateSummary | null => {
      if (!templateId) return null
      return templateLookup.get(templateId) ?? null
    },
    [templateLookup],
  )

  const frontTemplateSummary = resolveTemplateSummary(selectedDesign?.frontTemplateId)
  const backTemplateSummary = resolveTemplateSummary(selectedDesign?.backTemplateId)

  useEffect(() => {
    if (users.length === 0) {
      setSelectedUserId(null)
      return
    }
    if (!selectedUserId || !users.some((user) => user.id === selectedUserId)) {
      const firstWithId = users.find((user) => user.id)
      if (firstWithId?.id) {
        setSelectedUserId(firstWithId.id)
      }
    }
  }, [users, selectedUserId])

  useEffect(() => {
    if (!selectedDesign) {
      setPreviewSide('front')
      return
    }
    if (selectedDesign.frontTemplateId) {
      setPreviewSide('front')
    } else if (selectedDesign.backTemplateId) {
      setPreviewSide('back')
    } else {
      setPreviewSide('front')
    }
  }, [selectedDesign?.id, selectedDesign?.frontTemplateId, selectedDesign?.backTemplateId])

  const loadTemplate = useCallback(
    async (templateId: string, summary: TemplateSummary) => {
      if (!templateCacheRef.current.has(templateId)) {
        const response = await fetch(summary.svgPath)
        if (!response.ok) {
          throw new Error('Unable to load template SVG.')
        }
        const svgText = await response.text()
        const { metadata, autoFields } = await parseTemplateString(svgText, summary.name)
        templateCacheRef.current.set(templateId, { meta: metadata, fields: autoFields })
      }
      return templateCacheRef.current.get(templateId)!
    },
    [],
  )

  const loadMappings = useCallback(async (templateId: string) => {
    if (!mappingCacheRef.current.has(templateId)) {
      const response = await getFieldMappings(templateId)
      const map: Record<string, string> = {}
      const customValues: Record<string, string> = {}
      response.forEach((mapping) => {
        map[mapping.svgLayerId] = mapping.standardFieldName
        if (mapping.customValue) {
          customValues[mapping.svgLayerId] = mapping.customValue
        }
      })
      mappingCacheRef.current.set(templateId, { mappings: map, customValues })
    }
    return mappingCacheRef.current.get(templateId)!
  }, [])

  useEffect(() => {
    setPreview(createInitialPreviewState())
    let cancelled = false

    if (!selectedUser || cardDesignsLoading) {
      return () => {
        cancelled = true
      }
    }

    if (!selectedDesign) {
      return () => {
        cancelled = true
      }
    }

    const loadSide = async (
      side: 'front' | 'back',
      templateId: string | null | undefined,
      summary: TemplateSummary | null,
    ) => {
      if (cancelled) return

      if (!templateId) {
        setPreview((prev) => ({
          ...prev,
          [side]: {
            svg: null,
            loading: false,
            error: 'No template assigned for this side yet.',
          },
        }))
        return
      }

      if (!summary) {
        setPreview((prev) => ({
          ...prev,
          [side]: {
            svg: null,
            loading: false,
            error: 'Template metadata unavailable. Refresh templates to continue.',
          },
        }))
        return
      }

      setPreview((prev) => ({
        ...prev,
        [side]: {
          ...prev[side],
          loading: true,
          error: null,
        },
      }))

      try {
        const { meta, fields } = await loadTemplate(templateId, summary)
        const { mappings, customValues } = await loadMappings(templateId)

        let svg: string
        if (Object.keys(mappings).length === 0) {
          svg = meta.rawSvg
        } else {
          const cardData: CardData = {}

          fields.forEach((field) => {
            const layerId = field.sourceId || field.id
            const standardFieldName = mappings[layerId]
            if (standardFieldName) {
              const customValue = customValues[layerId]
              cardData[field.id] = parseField(standardFieldName, selectedUser, customValue)
            }
          })

          svg = renderSvgWithData(meta, fields, cardData)
        }
        if (cancelled) return

        setPreview((prev) => ({
          ...prev,
          [side]: {
            svg,
            loading: false,
            error: null,
          },
        }))
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'Failed to render preview.'
        setPreview((prev) => ({
          ...prev,
          [side]: {
            svg: null,
            loading: false,
            error: message,
          },
        }))
      }
    }

    loadSide('front', selectedDesign.frontTemplateId, frontTemplateSummary)
    loadSide('back', selectedDesign.backTemplateId, backTemplateSummary)

    return () => {
      cancelled = true
    }
  }, [
    selectedUser,
    selectedDesign,
    cardDesignsLoading,
    frontTemplateSummary,
    backTemplateSummary,
    loadTemplate,
    loadMappings,
  ])

  const handleOpenCreate = () => {
    setEditingUser(null)
    setFormData({})
    setFormError(null)
    setDialogOpen(true)
  }

  const handleOpenEdit = (user: UserData) => {
    setEditingUser(user)
    setFormData({
      ...user,
      cardDesignId: user.cardDesignId ?? null,
    })
    setFormError(null)
    setDialogOpen(true)
    if (user.id) {
      setSelectedUserId(user.id)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)

    try {
      if (editingUser && editingUser.id) {
        await updateUser(editingUser.id, formData)
      } else {
        if (!formData.firstName || !formData.lastName) {
          setFormError('First name and last name are required')
          return
        }
        await createUser(formData as Omit<UserData, 'id'>)
      }
      setDialogOpen(false)
      setFormData({})
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return

    try {
      await deleteUser(id)
      if (selectedUserId === id) {
        setSelectedUserId(null)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user')
    }
  }

  const handleImportCSV = () => {
    csvImportInputRef.current?.click()
  }

  const handleCSVFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const uploadData = new FormData()
      uploadData.append('file', file)

      const response = await fetch('/api/users/import-csv', {
        method: 'POST',
        body: uploadData,
      })

      if (!response.ok) {
        throw new Error('Failed to import CSV')
      }

      const result = await response.json()

      if (result.errors && result.errors.length > 0) {
        alert(
          `Imported ${result.created} users with ${result.errors.length} errors:\n${result.errors.slice(0, 5).join('\n')}`,
        )
      } else {
        alert(`Successfully imported ${result.created} users`)
      }

      await refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to import CSV')
    }
  }

  const handleExportCSV = async () => {
    try {
      const response = await fetch('/api/users/export-csv')

      if (!response.ok) {
        throw new Error('Failed to export CSV')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'users.csv'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to export CSV')
    }
  }

  const handlePhotoUpload = async (userId: string, file: File) => {
    setUploadingPhotoFor(userId)
    try {
      const uploadData = new FormData()
      uploadData.append('photo', file)

      const response = await fetch(`/api/users/${userId}/upload-photo`, {
        method: 'POST',
        body: uploadData,
      })

      if (!response.ok) {
        throw new Error('Failed to upload photo')
      }

      await refresh()
      alert('Photo uploaded successfully')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to upload photo')
    } finally {
      setUploadingPhotoFor(null)
    }
  }

  const handlePhotoInputChange = (userId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    handlePhotoUpload(userId, file)
  }

  const handleUserDesignChange = async (designId: string | null) => {
    if (!selectedUser?.id) return
    const normalized = designId ?? null
    if ((selectedUser.cardDesignId ?? null) === normalized) return
    setAssigningDesign(true)
    try {
      await updateUser(selectedUser.id, { cardDesignId: normalized })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update card design')
    } finally {
      setAssigningDesign(false)
    }
  }

  const openDesignDialog = (design: CardDesign | null) => {
    if (design) {
      setDesignForm({
        name: design.name,
        description: design.description ?? '',
        frontTemplateId: design.frontTemplateId ?? '',
        backTemplateId: design.backTemplateId ?? '',
      })
    } else {
      setDesignForm({
        name: '',
        description: '',
        frontTemplateId: '',
        backTemplateId: '',
      })
    }
    setDesignFormError(null)
    setDesignEditing(design)
    setDesignDialogOpen(true)
  }

  const handleDesignSave = async (event: React.FormEvent) => {
    event.preventDefault()
    setDesignFormError(null)

    const trimmedName = designForm.name.trim()
    if (!trimmedName) {
      setDesignFormError('Design name is required.')
      return
    }

    const payload = {
      name: trimmedName,
      description: designForm.description.trim() ? designForm.description.trim() : null,
      frontTemplateId: designForm.frontTemplateId ? designForm.frontTemplateId : null,
      backTemplateId: designForm.backTemplateId ? designForm.backTemplateId : null,
    }

    setDesignSaving(true)
    try {
      if (designEditing) {
        await updateDesign(designEditing.id, payload)
      } else {
        await createDesign(payload)
      }
      setDesignDialogOpen(false)
      setDesignEditing(null)
      refreshCardDesigns()
    } catch (err) {
      setDesignFormError(err instanceof Error ? err.message : 'Failed to save card design')
    } finally {
      setDesignSaving(false)
    }
  }

  const handleDesignDelete = async () => {
    if (!designEditing) return
    if (!confirm('Delete this card design? Users assigned to it will lose their assignment.')) {
      return
    }
    setDesignFormError(null)
    try {
      await deleteDesign(designEditing.id)
      setDesignDialogOpen(false)
      setDesignEditing(null)
      await refresh()
    } catch (err) {
      setDesignFormError(err instanceof Error ? err.message : 'Failed to delete card design')
    }
  }

  function renderPreviewPane(side: 'front' | 'back', showLabel: boolean) {
    const pane = preview[side]
    const templateSummary = side === 'front' ? frontTemplateSummary : backTemplateSummary
    const label = side === 'front' ? 'Front' : 'Back'
    const templateName = templateSummary?.name ?? `No ${label.toLowerCase()} template`

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
        {showLabel && (
          <div style={{ fontSize: '0.8rem', color: '#52525b', textAlign: 'center' }}>
            {label}: {templateName}
          </div>
        )}
        <div
          style={{
            flex: 1,
            width: '100%',
            border: '1px dashed #d4d4d8',
            borderRadius: '0.75rem',
            padding: '1rem',
            backgroundColor: '#fafafa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {pane.loading ? (
            <p style={{ color: '#71717a', fontSize: '0.9rem' }}>Rendering preview…</p>
          ) : pane.error ? (
            <p style={{ color: '#dc2626', fontSize: '0.85rem', textAlign: 'center', maxWidth: '280px' }}>
              {pane.error}
            </p>
          ) : pane.svg ? (
            <div
              style={{
                width: '100%',
                maxWidth: '420px',
                borderRadius: '0.5rem',
                overflow: 'hidden',
                backgroundColor: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              }}
              dangerouslySetInnerHTML={{ __html: pane.svg }}
            />
          ) : (
            <p style={{ color: '#71717a', fontSize: '0.9rem', textAlign: 'center' }}>
              {templateSummary ? 'Preview not available yet.' : `No ${label.toLowerCase()} template assigned.`}
            </p>
          )}
        </div>
      </div>
    )
  }

  const renderPreviewPanels = () => {
    const sides: Array<'front' | 'back'> =
      previewSide === 'both'
        ? ['front', 'back']
        : previewSide === 'front'
          ? ['front']
          : ['back']
    const isMulti = sides.length > 1

    if (isMulti) {
      if (previewLayout === 'stacked') {
        return (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              alignItems: 'center',
              justifyContent: 'flex-start',
            }}
          >
            {sides.map((side) => (
              <div key={side} style={{ width: '100%', maxWidth: '420px' }}>
                {renderPreviewPane(side, true)}
              </div>
            ))}
          </div>
        )
      }

      return (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'row',
            gap: '1rem',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            justifyContent: 'center',
          }}
        >
          {sides.map((side) => (
            <div
              key={side}
              style={{
                flex: '1 1 320px',
                minWidth: '260px',
                maxWidth: '360px',
              }}
            >
              {renderPreviewPane(side, true)}
            </div>
          ))}
        </div>
      )
    }

    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ width: '100%', maxWidth: '420px' }}>{renderPreviewPane(sides[0], false)}</div>
      </div>
    )
  }

  const frontTemplateName = frontTemplateSummary?.name ?? 'No front template'
  const backTemplateName = backTemplateSummary?.name ?? 'No back template'

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#71717a' }}>
        Loading users...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: '#dc2626', marginBottom: '1rem' }}>Error: {error}</p>
        <Button onClick={refresh} variant="outline">
          Retry
        </Button>
      </div>
    )
  }


  return (
    <>
      <div
        style={{
          display: 'flex',
          gap: '1.5rem',
          padding: '1.5rem',
          height: 'calc(100vh - 200px)',
          minHeight: 0,
        }}
      >
        <div
          style={{
            flex: '0 0 58%',
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            borderRadius: '0.75rem',
            border: '1px solid #e4e4e7',
            backgroundColor: '#fff',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid #e4e4e7',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                User Database
              </h2>
              <p style={{ fontSize: '0.9rem', color: '#71717a' }}>
                Maintain user records and assign card designs.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Button onClick={handleImportCSV} variant="outline" size="sm">
                <Upload style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
                Import CSV
              </Button>
              <Button
                onClick={handleExportCSV}
                variant="outline"
                size="sm"
                disabled={users.length === 0}
              >
                <Download style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
                Export CSV
              </Button>
              <Button onClick={handleOpenCreate} size="sm">
                <Plus style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
                Add User
              </Button>
            </div>
          </div>

          {users.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '3rem',
                textAlign: 'center',
                color: '#71717a',
              }}
            >
              <p style={{ marginBottom: '1rem' }}>No users yet</p>
              <Button onClick={handleOpenCreate}>
                <Plus style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
                Add Your First User
              </Button>
            </div>
          ) : (
            <div style={{ flex: 1, overflow: 'auto' }}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead style={{ width: '60px' }}>Photo</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Card Design</TableHead>
                    <TableHead style={{ width: '150px', textAlign: 'right' }}>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const isSelected = selectedUserId === user.id
                    const designName =
                      user.cardDesignId && designs.length > 0
                        ? designs.find((d) => d.id === user.cardDesignId)?.name ?? '—'
                        : '—'
                    return (
                      <TableRow
                        key={user.id}
                        onClick={() => user.id && setSelectedUserId(user.id)}
                        style={{
                          backgroundColor: isSelected ? '#f4f4f5' : '#fff',
                          cursor: 'pointer',
                        }}
                      >
                        <TableCell>
                          {user.photoPath ? (
                            <img
                              src={user.photoPath}
                              alt={`${user.firstName} ${user.lastName}`}
                              style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                backgroundColor: '#e4e4e7',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#71717a',
                                fontSize: '0.75rem',
                              }}
                            >
                              {user.firstName?.charAt(0)}
                              {user.lastName?.charAt(0)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell style={{ fontWeight: 500 }}>
                          {user.firstName} {user.middleName && `${user.middleName} `}
                          {user.lastName}
                        </TableCell>
                        <TableCell>{user.studentId || '—'}</TableCell>
                        <TableCell>{user.email || '—'}</TableCell>
                        <TableCell>{user.department || '—'}</TableCell>
                        <TableCell>{user.position || '—'}</TableCell>
                        <TableCell>{designName}</TableCell>
                        <TableCell>
                          <div
                            style={{
                              display: 'flex',
                              gap: '0.35rem',
                              justifyContent: 'flex-end',
                            }}
                          >
                            <input
                              type="file"
                              accept="image/*"
                              id={`photo-upload-${user.id}`}
                              onChange={(e) => user.id && handlePhotoInputChange(user.id, e)}
                              style={{ display: 'none' }}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(event) => {
                                event.stopPropagation()
                                document.getElementById(`photo-upload-${user.id}`)?.click()
                              }}
                              disabled={uploadingPhotoFor === user.id}
                              title="Upload photo"
                            >
                              <ImageIcon style={{ width: '1rem', height: '1rem' }} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(event) => {
                                event.stopPropagation()
                                handleOpenEdit(user)
                              }}
                              title="Edit user"
                            >
                              <Pencil style={{ width: '1rem', height: '1rem' }} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(event) => {
                                event.stopPropagation()
                                if (user.id) handleDelete(user.id)
                              }}
                              title="Delete user"
                            >
                              <Trash2 style={{ width: '1rem', height: '1rem', color: '#dc2626' }} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <Card style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <CardHeader>
              <CardTitle style={{ fontSize: '1.1rem' }}>
                {selectedUser
                  ? `${selectedUser.firstName} ${selectedUser.lastName}`
                  : 'Preview'}
              </CardTitle>
              <CardDescription>
                Assign a card design to preview front and back layouts with this user's data.
              </CardDescription>
            </CardHeader>
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
              {selectedUser ? (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ flex: '1 1 220px' }}>
                        <label
                          htmlFor="user-card-design"
                          style={{ fontSize: '0.8rem', fontWeight: 500, display: 'block', marginBottom: '0.35rem' }}
                        >
                          Card design
                        </label>
                        <Select
                          value={selectedUser.cardDesignId ?? 'none'}
                          onValueChange={(value) => handleUserDesignChange(value === 'none' ? null : value)}
                          disabled={assigningDesign || cardDesignsLoading}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select design" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No card design</SelectItem>
                            {designs.map((design) => (
                              <SelectItem key={design.id} value={design.id}>
                                {design.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {cardDesignsError && (
                          <p style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.35rem' }}>
                            {cardDesignsError}
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDesignDialog(null)}
                        >
                          <Plus style={{ width: '0.9rem', height: '0.9rem', marginRight: '0.35rem' }} />
                          New Design
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!selectedDesign}
                          onClick={() => selectedDesign && openDesignDialog(selectedDesign)}
                        >
                          <Pencil style={{ width: '0.9rem', height: '0.9rem', marginRight: '0.35rem' }} />
                          Edit Design
                        </Button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <Button
                        variant={previewSide === 'front' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPreviewSide('front')}
                        disabled={!selectedDesign?.frontTemplateId}
                      >
                        Front
                      </Button>
                      <Button
                        variant={previewSide === 'back' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPreviewSide('back')}
                        disabled={!selectedDesign?.backTemplateId}
                      >
                        Back
                      </Button>
                      <Button
                        variant={previewSide === 'both' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPreviewSide('both')}
                        disabled={!(selectedDesign?.frontTemplateId && selectedDesign?.backTemplateId)}
                      >
                        Both
                      </Button>
                      {previewSide === 'both' && (
                        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.75rem', color: '#71717a' }}>Layout:</span>
                          <Button
                            variant={previewLayout === 'side-by-side' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setPreviewLayout('side-by-side')}
                          >
                            Side by side
                          </Button>
                          <Button
                            variant={previewLayout === 'stacked' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setPreviewLayout('stacked')}
                          >
                            Stacked
                          </Button>
                        </div>
                      )}
                      {selectedDesign && (
                        <span style={{ fontSize: '0.75rem', color: '#71717a' }}>
                          {previewSide === 'front'
                            ? frontTemplateName
                            : previewSide === 'back'
                              ? backTemplateName
                              : `Front: ${frontTemplateName} • Back: ${backTemplateName}`}
                        </span>
                      )}
                    </div>
                  </div>

                  {selectedDesign ? (
                    renderPreviewPanels()
                  ) : (
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px dashed #d4d4d8',
                        borderRadius: '0.75rem',
                        padding: '1rem',
                        backgroundColor: '#fafafa',
                      }}
                    >
                      <p style={{ color: '#71717a', fontSize: '0.9rem', textAlign: 'center' }}>
                        Assign a card design to view a preview.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#71717a',
                  }}
                >
                  Select a user to preview their card design.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle style={{ fontSize: '1rem' }}>Design Library</CardTitle>
              <CardDescription>
                Templates available for card designs. Refresh if you do not see a recent upload.
              </CardDescription>
            </CardHeader>
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRefreshDesignTemplates}
                  disabled={designTemplatesLoading}
                >
                  Refresh Templates
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshCardDesigns}
                  disabled={cardDesignsLoading}
                >
                  Refresh Designs
                </Button>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#52525b' }}>
                {designTemplatesLoading
                  ? 'Loading templates…'
                  : `${designTemplates.length} template${designTemplates.length === 1 ? '' : 's'} available.`}
              </p>
              {designTemplatesError && (
                <p style={{ color: '#dc2626', fontSize: '0.75rem' }}>{designTemplatesError}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <input
        ref={csvImportInputRef}
        type="file"
        accept=".csv"
        onChange={handleCSVFileSelect}
        style={{ display: 'none' }}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
              <DialogDescription>
                {editingUser
                  ? 'Update user information'
                  : 'Enter user information to add to the database'}
              </DialogDescription>
            </DialogHeader>

            <div style={{ display: 'grid', gap: '1rem', paddingTop: '1rem', paddingBottom: '1rem' }}>
              {formError && (
                <div
                  style={{
                    padding: '0.75rem',
                    backgroundColor: '#fef2f2',
                    color: '#dc2626',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                  }}
                >
                  {formError}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  <label htmlFor="firstName" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                    First Name *
                  </label>
                  <Input
                    id="firstName"
                    value={formData.firstName || ''}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                  />
                </div>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  <label htmlFor="lastName" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                    Last Name *
                  </label>
                  <Input
                    id="lastName"
                    value={formData.lastName || ''}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <label htmlFor="middleName" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                  Middle Name
                </label>
                <Input
                  id="middleName"
                  value={formData.middleName || ''}
                  onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <label htmlFor="studentId" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                  Student ID
                </label>
                <Input
                  id="studentId"
                  value={formData.studentId || ''}
                  onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <label htmlFor="email" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  <label htmlFor="department" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                    Department
                  </label>
                  <Input
                    id="department"
                    value={formData.department || ''}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  />
                </div>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  <label htmlFor="position" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                    Position
                  </label>
                  <Input
                    id="position"
                    value={formData.position || ''}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <label htmlFor="cardDesignId" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                  Card Design
                </label>
                <Select
                  value={formData.cardDesignId ?? 'none'}
                  onValueChange={(value) =>
                    setFormData({ ...formData, cardDesignId: value === 'none' ? null : value })
                  }
                  disabled={cardDesignsLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No card design" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No card design</SelectItem>
                    {designs.map((design) => (
                      <SelectItem key={design.id} value={design.id}>
                        {design.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editingUser ? 'Save Changes' : 'Add User'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={designDialogOpen} onOpenChange={setDesignDialogOpen}>
        <DialogContent>
          <form onSubmit={handleDesignSave}>
            <DialogHeader>
              <DialogTitle>{designEditing ? 'Edit Card Design' : 'New Card Design'}</DialogTitle>
              <DialogDescription>
                Link front and back templates to a named design for re-use across users.
              </DialogDescription>
            </DialogHeader>

            <div style={{ display: 'grid', gap: '1rem', paddingTop: '1rem', paddingBottom: '1rem' }}>
              {designFormError && (
                <div
                  style={{
                    padding: '0.75rem',
                    backgroundColor: '#fef2f2',
                    color: '#dc2626',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                  }}
                >
                  {designFormError}
                </div>
              )}

              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <label htmlFor="design-name" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                  Design Name *
                </label>
                <Input
                  id="design-name"
                  value={designForm.name}
                  onChange={(e) => setDesignForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <label htmlFor="design-description" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                  Description
                </label>
                <Textarea
                  id="design-description"
                  value={designForm.description}
                  onChange={(e) =>
                    setDesignForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  rows={3}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Front Template</label>
                  <Select
                    value={designForm.frontTemplateId || 'none'}
                    onValueChange={(value) =>
                      setDesignForm((prev) => ({
                        ...prev,
                        frontTemplateId: value === 'none' ? '' : value,
                      }))
                    }
                    disabled={designTemplatesLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No front</SelectItem>
                      {designTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Back Template</label>
                  <Select
                    value={designForm.backTemplateId || 'none'}
                    onValueChange={(value) =>
                      setDesignForm((prev) => ({
                        ...prev,
                        backTemplateId: value === 'none' ? '' : value,
                      }))
                    }
                    disabled={designTemplatesLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No back</SelectItem>
                      {designTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {designTemplatesError && (
                <p style={{ color: '#dc2626', fontSize: '0.75rem' }}>{designTemplatesError}</p>
              )}
            </div>

            <DialogFooter style={{ justifyContent: 'space-between' }}>
              {designEditing ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDesignDelete}
                  disabled={designSaving}
                >
                  Delete
                </Button>
              ) : (
                <span />
              )}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDesignDialogOpen(false)}
                  disabled={designSaving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={designSaving}>
                  {designSaving ? 'Saving…' : 'Save Design'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
