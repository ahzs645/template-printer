import type { TemplateMeta } from './types'
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
