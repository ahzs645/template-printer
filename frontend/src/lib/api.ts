import type { CardDesign, TemplateMeta } from './types'
import type { TemplateSummary, TemplateType } from './templates'

export async function uploadTemplateToLibrary(
  file: File,
  metadata: TemplateMeta,
  templateType: TemplateType = 'design',
): Promise<TemplateSummary> {
  const fallbackName = file.name.replace(/\.svg$/i, '').trim() || 'Uploaded Template'
  const name = metadata.name?.trim() || fallbackName
  const formData = new FormData()
  formData.append('file', file)
  formData.append('name', name)
  formData.append('templateType', templateType)

  const response = await fetch('/api/templates', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const message = await safeReadErrorMessage(response)
    throw new Error(message ?? `Failed to save template (${response.status})`)
  }

  return (await response.json()) as TemplateSummary
}

export async function deleteTemplateFromLibrary(id: string): Promise<void> {
  const response = await fetch(`/api/templates/${id}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const message = await safeReadErrorMessage(response)
    throw new Error(message ?? `Failed to delete template (${response.status})`)
  }
}

async function safeReadErrorMessage(response: Response): Promise<string | null> {
  try {
    const data = await response.json()
    if (data && typeof data === 'object' && 'error' in data) {
      const { error } = data as { error?: string }
      return typeof error === 'string' ? error : null
    }
  } catch {
    return null
  }
  return null
}

// Field Mapping API
export interface FieldMapping {
  svgLayerId: string
  standardFieldName: string
  customValue?: string
}

export async function getFieldMappings(templateId: string): Promise<FieldMapping[]> {
  const response = await fetch(`/api/templates/${templateId}/field-mappings`)

  if (!response.ok) {
    const message = await safeReadErrorMessage(response)
    throw new Error(message ?? `Failed to get field mappings (${response.status})`)
  }

  return await response.json()
}

export async function saveFieldMappings(
  templateId: string,
  mappings: FieldMapping[]
): Promise<FieldMapping[]> {
  const response = await fetch(`/api/templates/${templateId}/field-mappings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ mappings }),
  })

  if (!response.ok) {
    const message = await safeReadErrorMessage(response)
    throw new Error(message ?? `Failed to save field mappings (${response.status})`)
  }

  return await response.json()
}

// Card Design API
export interface CardDesignPayload {
  name: string
  description?: string | null
  frontTemplateId?: string | null
  backTemplateId?: string | null
}

export async function listCardDesigns(): Promise<CardDesign[]> {
  const response = await fetch('/api/card-designs')

  if (!response.ok) {
    const message = await safeReadErrorMessage(response)
    throw new Error(message ?? `Failed to list card designs (${response.status})`)
  }

  return await response.json()
}

export async function createCardDesign(payload: CardDesignPayload): Promise<CardDesign> {
  const response = await fetch('/api/card-designs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const message = await safeReadErrorMessage(response)
    throw new Error(message ?? `Failed to create card design (${response.status})`)
  }

  return await response.json()
}

export async function updateCardDesign(id: string, payload: Partial<CardDesignPayload>): Promise<CardDesign> {
  const response = await fetch(`/api/card-designs/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const message = await safeReadErrorMessage(response)
    throw new Error(message ?? `Failed to update card design (${response.status})`)
  }

  return await response.json()
}

export async function deleteCardDesign(id: string): Promise<void> {
  const response = await fetch(`/api/card-designs/${id}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const message = await safeReadErrorMessage(response)
    throw new Error(message ?? `Failed to delete card design (${response.status})`)
  }
}

// Font API
export interface FontData {
  id: string
  fontName: string
  fileName: string
  fontData: string // base64
  mimeType: string
  createdAt: string
}

export async function listFonts(): Promise<FontData[]> {
  const response = await fetch('/api/fonts')

  if (!response.ok) {
    const message = await safeReadErrorMessage(response)
    throw new Error(message ?? `Failed to list fonts (${response.status})`)
  }

  return await response.json()
}

export async function uploadFont(fontName: string, file: File): Promise<FontData> {
  const formData = new FormData()
  formData.append('font', file)
  formData.append('fontName', fontName)

  const response = await fetch('/api/fonts', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const message = await safeReadErrorMessage(response)
    throw new Error(message ?? `Failed to upload font (${response.status})`)
  }

  return await response.json()
}

export async function deleteFont(fontName: string): Promise<void> {
  const response = await fetch(`/api/fonts/${encodeURIComponent(fontName)}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const message = await safeReadErrorMessage(response)
    throw new Error(message ?? `Failed to delete font (${response.status})`)
  }
}
