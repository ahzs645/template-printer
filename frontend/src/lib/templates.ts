import { getStorageInstance, isConvexMode, isLocalMode } from './storage'

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
 * Handles server mode (fetch from URL), Dexie local mode, and Convex storage mode.
 */
export async function loadTemplateSvgContent(template: TemplateSummary): Promise<string> {
  // In local/Convex storage mode, svgPath is a virtual storage pointer.
  if (isLocalMode() || isConvexMode() || template.svgPath.startsWith('indexeddb://') || template.svgPath.startsWith('convex://')) {
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
