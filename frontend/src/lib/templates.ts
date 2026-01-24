import { getStorageInstance, isLocalMode } from './storage'

export type TemplateType = 'design' | 'print'

export type TemplateSummary = {
  id: string
  name: string
  description?: string | null
  svgPath: string
  thumbnailPath?: string | null
  templateType?: TemplateType
  createdAt?: string | null
}

/**
 * Load SVG content for a template
 * Handles both server mode (fetch from URL) and local mode (fetch from IndexedDB)
 */
export async function loadTemplateSvgContent(template: TemplateSummary): Promise<string> {
  // In local mode, svgPath will be 'indexeddb://{id}'
  if (isLocalMode() || template.svgPath.startsWith('indexeddb://')) {
    const storage = getStorageInstance()
    return storage.getTemplateSvgContent(template.id)
  }

  // Server mode - fetch from URL
  const response = await fetch(template.svgPath)
  if (!response.ok) {
    throw new Error(`Failed to load template SVG: ${response.status}`)
  }
  return response.text()
}
