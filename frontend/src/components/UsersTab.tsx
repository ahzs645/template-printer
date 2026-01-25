import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Pencil, Trash2, Download, Upload, ImageIcon, RefreshCw, Users, FolderOpen } from 'lucide-react'

import { useUsers } from '../hooks/useUsers'
import { useCardDesigns } from '../hooks/useCardDesigns'
import type { UserData } from '../lib/fieldParser'
import type { CardDesign } from '../lib/types'
import type { TemplateSummary } from '../lib/templates'
import { loadTemplateSvgContent } from '../lib/templates'
import { parseField } from '../lib/fieldParser'
import { parseTemplateString, renderSvgWithData } from '../lib/svgTemplate'
import { useStorage } from '../lib/storage'
import type { CardData, FieldDefinition, TemplateMeta } from '../lib/types'
import { cn } from '../lib/utils'

import { DockablePanel, PanelSection } from './ui/dockable-panel'
import { Button } from './ui/button'
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

  const storage = useStorage()

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
        const svgText = await loadTemplateSvgContent(summary)
        const { metadata, autoFields } = await parseTemplateString(svgText, summary.name)
        templateCacheRef.current.set(templateId, { meta: metadata, fields: autoFields })
      }
      return templateCacheRef.current.get(templateId)!
    },
    [],
  )

  const loadMappings = useCallback(async (templateId: string) => {
    if (!mappingCacheRef.current.has(templateId)) {
      const response = await storage.getFieldMappings(templateId)
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
  }, [storage])

  useEffect(() => {
    setPreview(createInitialPreviewState())
    let cancelled = false

    if (!selectedUser || cardDesignsLoading) {
      return () => { cancelled = true }
    }

    if (!selectedDesign) {
      return () => { cancelled = true }
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
          [side]: { svg: null, loading: false, error: 'No template assigned.' },
        }))
        return
      }

      if (!summary) {
        setPreview((prev) => ({
          ...prev,
          [side]: { svg: null, loading: false, error: 'Template unavailable.' },
        }))
        return
      }

      setPreview((prev) => ({
        ...prev,
        [side]: { ...prev[side], loading: true, error: null },
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
          [side]: { svg, loading: false, error: null },
        }))
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'Failed to render.'
        setPreview((prev) => ({
          ...prev,
          [side]: { svg: null, loading: false, error: message },
        }))
      }
    }

    loadSide('front', selectedDesign.frontTemplateId, frontTemplateSummary)
    loadSide('back', selectedDesign.backTemplateId, backTemplateSummary)

    return () => { cancelled = true }
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
    setFormData({ ...user, cardDesignId: user.cardDesignId ?? null })
    setFormError(null)
    setDialogOpen(true)
    if (user.id) setSelectedUserId(user.id)
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
    if (!confirm('Delete this user?')) return
    try {
      await deleteUser(id)
      if (selectedUserId === id) setSelectedUserId(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const handleImportCSV = () => csvImportInputRef.current?.click()

  const handleCSVFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const uploadData = new FormData()
      uploadData.append('file', file)
      const response = await fetch('/api/users/import-csv', { method: 'POST', body: uploadData })
      if (!response.ok) throw new Error('Failed to import CSV')
      const result = await response.json()
      if (result.errors?.length > 0) {
        alert(`Imported ${result.created} users with ${result.errors.length} errors`)
      } else {
        alert(`Imported ${result.created} users`)
      }
      await refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to import CSV')
    }
  }

  const handleExportCSV = async () => {
    try {
      const response = await fetch('/api/users/export-csv')
      if (!response.ok) throw new Error('Failed to export CSV')
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
      const response = await fetch(`/api/users/${userId}/upload-photo`, { method: 'POST', body: uploadData })
      if (!response.ok) throw new Error('Failed to upload photo')
      await refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to upload photo')
    } finally {
      setUploadingPhotoFor(null)
    }
  }

  const handlePhotoInputChange = (userId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) handlePhotoUpload(userId, file)
  }

  const handleUserDesignChange = async (designId: string | null) => {
    if (!selectedUser?.id) return
    const normalized = designId ?? null
    if ((selectedUser.cardDesignId ?? null) === normalized) return
    setAssigningDesign(true)
    try {
      await updateUser(selectedUser.id, { cardDesignId: normalized })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update')
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
      setDesignForm({ name: '', description: '', frontTemplateId: '', backTemplateId: '' })
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
      description: designForm.description.trim() || null,
      frontTemplateId: designForm.frontTemplateId || null,
      backTemplateId: designForm.backTemplateId || null,
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
      setDesignFormError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setDesignSaving(false)
    }
  }

  const handleDesignDelete = async () => {
    if (!designEditing) return
    if (!confirm('Delete this card design?')) return
    setDesignFormError(null)
    try {
      await deleteDesign(designEditing.id)
      setDesignDialogOpen(false)
      setDesignEditing(null)
      await refresh()
    } catch (err) {
      setDesignFormError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const renderPreviewPane = (side: 'front' | 'back') => {
    const pane = preview[side]
    if (pane.loading) {
      return <p className="empty-state__text">Rendering...</p>
    }
    if (pane.error) {
      return <p style={{ color: 'var(--danger)', fontSize: 12 }}>{pane.error}</p>
    }
    if (pane.svg) {
      return (
        <div
          className="canvas-preview"
          style={{ maxWidth: 380, width: '100%' }}
          dangerouslySetInnerHTML={{ __html: pane.svg }}
        />
      )
    }
    return <p className="empty-state__text">No preview available</p>
  }

  if (loading) {
    return (
      <div className="app-content" style={{ height: '100%' }}>
        <div className="app-workspace">
          <div className="empty-state">
            <p className="empty-state__text">Loading users...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="app-content" style={{ height: '100%' }}>
        <div className="app-workspace">
          <div className="empty-state">
            <p style={{ color: 'var(--danger)', marginBottom: 12 }}>Error: {error}</p>
            <button className="btn btn-secondary" onClick={refresh}>Retry</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="app-content" style={{ height: '100%' }}>
        {/* Left Panel - User List */}
        <DockablePanel title="Users" side="left" width={340}>
          <PanelSection
            title={`All Users (${users.length})`}
            actions={
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={handleImportCSV} title="Import CSV">
                  <Upload size={14} />
                </button>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={handleExportCSV} title="Export CSV" disabled={users.length === 0}>
                  <Download size={14} />
                </button>
                <button className="btn btn-primary btn-sm btn-icon" onClick={handleOpenCreate} title="Add User">
                  <Plus size={14} />
                </button>
              </div>
            }
          >
            {users.length === 0 ? (
              <div className="empty-state">
                <Users size={32} className="empty-state__icon" />
                <p className="empty-state__text">No users yet</p>
                <button className="btn btn-primary btn-sm" onClick={handleOpenCreate}>
                  <Plus size={14} style={{ marginRight: 4 }} />
                  Add User
                </button>
              </div>
            ) : (
              <div className="field-list" style={{ maxHeight: 'calc(100vh - 280px)', overflow: 'auto' }}>
                {users.map((user) => {
                  const isSelected = selectedUserId === user.id
                  const designName = user.cardDesignId
                    ? designs.find((d) => d.id === user.cardDesignId)?.name
                    : null
                  return (
                    <div
                      key={user.id}
                      role="button"
                      tabIndex={0}
                      className={cn('field-item', isSelected && 'field-item--selected')}
                      onClick={() => user.id && setSelectedUserId(user.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { user.id && setSelectedUserId(user.id) } }}
                      style={{ alignItems: 'flex-start', textAlign: 'left', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%' }}>
                        {user.photoPath ? (
                          <img
                            src={user.photoPath}
                            alt=""
                            style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              background: 'var(--bg-hover)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 11,
                              color: 'var(--text-muted)',
                              flexShrink: 0,
                            }}
                          >
                            {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="field-item__name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="field-item__type">
                            {user.position || user.department || user.studentId || 'No details'}
                          </div>
                          {designName && (
                            <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 2 }}>
                              {designName}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                          <button
                            className="btn btn-ghost btn-sm btn-icon"
                            onClick={(e) => { e.stopPropagation(); handleOpenEdit(user) }}
                            title="Edit"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm btn-icon"
                            onClick={(e) => { e.stopPropagation(); user.id && handleDelete(user.id) }}
                            title="Delete"
                            style={{ color: 'var(--danger)' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </PanelSection>
        </DockablePanel>

        {/* Main Canvas - Card Preview */}
        <div className="app-workspace">
          <div className="canvas-container">
            {!selectedUser ? (
              <div className="empty-state">
                <Users size={48} className="empty-state__icon" />
                <p className="empty-state__text">Select a user to preview their card</p>
              </div>
            ) : !selectedDesign ? (
              <div className="empty-state">
                <FolderOpen size={48} className="empty-state__icon" />
                <p className="empty-state__text">Assign a card design to see preview</p>
              </div>
            ) : previewSide === 'both' ? (
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Front</div>
                  {renderPreviewPane('front')}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Back</div>
                  {renderPreviewPane('back')}
                </div>
              </div>
            ) : (
              renderPreviewPane(previewSide)
            )}
          </div>
        </div>

        {/* Right Panel - User Details & Card Design */}
        <DockablePanel title="Details" side="right" width={280}>
          {selectedUser ? (
            <>
              <PanelSection title="User Info">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  {selectedUser.photoPath ? (
                    <img
                      src={selectedUser.photoPath}
                      alt=""
                      style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        background: 'var(--bg-hover)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 16,
                        color: 'var(--text-muted)',
                      }}
                    >
                      {selectedUser.firstName?.charAt(0)}{selectedUser.lastName?.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {selectedUser.firstName} {selectedUser.lastName}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {selectedUser.position || selectedUser.department || 'No title'}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {selectedUser.studentId && (
                    <div><span style={{ color: 'var(--text-muted)' }}>ID:</span> {selectedUser.studentId}</div>
                  )}
                  {selectedUser.email && (
                    <div><span style={{ color: 'var(--text-muted)' }}>Email:</span> {selectedUser.email}</div>
                  )}
                  {selectedUser.department && (
                    <div><span style={{ color: 'var(--text-muted)' }}>Dept:</span> {selectedUser.department}</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                    <ImageIcon size={14} style={{ marginRight: 4 }} />
                    Photo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => selectedUser.id && handlePhotoInputChange(selectedUser.id, e)}
                      style={{ display: 'none' }}
                      disabled={uploadingPhotoFor === selectedUser.id}
                    />
                  </label>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleOpenEdit(selectedUser)}>
                    <Pencil size={14} style={{ marginRight: 4 }} />
                    Edit
                  </button>
                </div>
              </PanelSection>

              <PanelSection title="Card Design">
                <div className="form-group" style={{ marginBottom: 8 }}>
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
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => openDesignDialog(null)}>
                    <Plus size={14} style={{ marginRight: 4 }} />
                    New
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={!selectedDesign}
                    onClick={() => selectedDesign && openDesignDialog(selectedDesign)}
                  >
                    <Pencil size={14} style={{ marginRight: 4 }} />
                    Edit
                  </button>
                </div>
              </PanelSection>

              {selectedDesign && (
                <PanelSection title="Preview Side">
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className={cn('btn btn-sm', previewSide === 'front' ? 'btn-primary' : 'btn-secondary')}
                      onClick={() => setPreviewSide('front')}
                      disabled={!selectedDesign.frontTemplateId}
                    >
                      Front
                    </button>
                    <button
                      className={cn('btn btn-sm', previewSide === 'back' ? 'btn-primary' : 'btn-secondary')}
                      onClick={() => setPreviewSide('back')}
                      disabled={!selectedDesign.backTemplateId}
                    >
                      Back
                    </button>
                    <button
                      className={cn('btn btn-sm', previewSide === 'both' ? 'btn-primary' : 'btn-secondary')}
                      onClick={() => setPreviewSide('both')}
                      disabled={!(selectedDesign.frontTemplateId && selectedDesign.backTemplateId)}
                    >
                      Both
                    </button>
                  </div>
                </PanelSection>
              )}
            </>
          ) : (
            <PanelSection title="User Info">
              <p className="empty-state__text">Select a user</p>
            </PanelSection>
          )}

          <PanelSection title={`Templates (${designTemplates.length})`} defaultOpen={false}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={onRefreshDesignTemplates}
                disabled={designTemplatesLoading}
              >
                <RefreshCw size={14} style={{ marginRight: 4 }} />
                Refresh
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={refreshCardDesigns}
                disabled={cardDesignsLoading}
              >
                Designs
              </button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {designTemplatesLoading ? 'Loading...' : `${designTemplates.length} templates, ${designs.length} designs`}
            </p>
            {designTemplatesError && (
              <p style={{ fontSize: 11, color: 'var(--danger)' }}>{designTemplatesError}</p>
            )}
          </PanelSection>
        </DockablePanel>
      </div>

      {/* Hidden CSV input */}
      <input
        ref={csvImportInputRef}
        type="file"
        accept=".csv"
        onChange={handleCSVFileSelect}
        style={{ display: 'none' }}
      />

      {/* User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingUser ? 'Edit User' : 'Add User'}</DialogTitle>
              <DialogDescription>
                {editingUser ? 'Update user information' : 'Add a new user to the database'}
              </DialogDescription>
            </DialogHeader>

            <div style={{ display: 'grid', gap: '0.75rem', padding: '1rem 0' }}>
              {formError && (
                <div className="status-message status-message--error">{formError}</div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">First Name *</label>
                  <Input
                    value={formData.firstName || ''}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Last Name *</label>
                  <Input
                    value={formData.lastName || ''}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Middle Name</label>
                <Input
                  value={formData.middleName || ''}
                  onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Student ID</label>
                  <Input
                    value={formData.studentId || ''}
                    onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Email</label>
                  <Input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Department</label>
                  <Input
                    value={formData.department || ''}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Position</label>
                  <Input
                    value={formData.position || ''}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Card Design</label>
                <Select
                  value={formData.cardDesignId ?? 'none'}
                  onValueChange={(value) => setFormData({ ...formData, cardDesignId: value === 'none' ? null : value })}
                  disabled={cardDesignsLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No card design" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No card design</SelectItem>
                    {designs.map((design) => (
                      <SelectItem key={design.id} value={design.id}>{design.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit">{editingUser ? 'Save' : 'Add User'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Design Dialog */}
      <Dialog open={designDialogOpen} onOpenChange={setDesignDialogOpen}>
        <DialogContent>
          <form onSubmit={handleDesignSave}>
            <DialogHeader>
              <DialogTitle>{designEditing ? 'Edit Card Design' : 'New Card Design'}</DialogTitle>
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
                  value={designForm.name}
                  onChange={(e) => setDesignForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Description</label>
                <Textarea
                  value={designForm.description}
                  onChange={(e) => setDesignForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={2}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Front Template</label>
                  <Select
                    value={designForm.frontTemplateId || 'none'}
                    onValueChange={(value) => setDesignForm((prev) => ({ ...prev, frontTemplateId: value === 'none' ? '' : value }))}
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
                    value={designForm.backTemplateId || 'none'}
                    onValueChange={(value) => setDesignForm((prev) => ({ ...prev, backTemplateId: value === 'none' ? '' : value }))}
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
              {designEditing ? (
                <Button type="button" variant="destructive" onClick={handleDesignDelete} disabled={designSaving}>
                  Delete
                </Button>
              ) : (
                <span />
              )}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button type="button" variant="outline" onClick={() => setDesignDialogOpen(false)} disabled={designSaving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={designSaving}>
                  {designSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
