/** Portable, versioned editor state. SVG remains a derived print representation. */
export const EDITOR_DOCUMENT_VERSION = 1
export const MAX_EDITOR_BYTES = 25 * 1024 * 1024
export type ReferenceImage = {
  src: string
  opacity: number
  visible: boolean
  x: number
  y: number
  width: number
  height: number
  angle: number
}
export type EditorMetadata = { version: 1; reference?: ReferenceImage }
export type EditorDocument = Record<string, unknown> & {
  objects: Record<string, unknown>[]
  cardEditor?: EditorMetadata
}
export type PackagedEditor = {
  version: 1
  widthMm: number
  heightMm: number
  front: string
  back?: string
}

/** Only embedded raster data is portable. SVG artwork is imported as vector objects. */
export function isEmbeddedRaster(source: string): boolean {
  return /^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(source)
}

export function readEditorDocument(json: string): EditorDocument {
  if (new TextEncoder().encode(json).length > MAX_EDITOR_BYTES) throw new Error('The editable design exceeds 25 MB.')
  let parsed: unknown
  try { parsed = JSON.parse(json) } catch { throw new Error('The editable design is not valid JSON.') }
  if (!parsed || typeof parsed !== 'object' || !('objects' in parsed) || !Array.isArray(parsed.objects)) {
    throw new Error('The editable design must contain an objects array.')
  }
  let nodes = 0
  const walk = (value: unknown, depth: number): void => {
    if (++nodes > 60000 || depth > 48) throw new Error('The editable design is too complex to open safely.')
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('The editable design contains an invalid number.')
    if (!value || typeof value !== 'object') return
    for (const [key, child] of Object.entries(value)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') throw new Error('The editable design contains an unsafe property.')
      if ((key === 'src' || key === 'sampleSrc') && typeof child === 'string' && child && !isEmbeddedRaster(child)) {
        throw new Error('Embed image assets before opening an editable package; external image URLs are not loaded.')
      }
      walk(child, depth + 1)
    }
  }
  walk(parsed, 0)
  const result = parsed as EditorDocument
  if (result.cardEditor && result.cardEditor.version !== EDITOR_DOCUMENT_VERSION) {
    throw new Error('This editable design uses an unsupported document version.')
  }
  const reference = result.cardEditor?.reference
  if (reference) {
    if (!isEmbeddedRaster(reference.src) || ![reference.x, reference.y, reference.width, reference.height, reference.angle, reference.opacity].every(Number.isFinite) || reference.width <= 0 || reference.height <= 0) {
      throw new Error('The reference image has invalid geometry or image data.')
    }
  }
  return result
}

/** References are local authoring aids and are not included in shareable packages by default. */
export function portableEditorJson(json: string, includeReference = false): string {
  const document = readEditorDocument(json)
  delete document.overlayImage
  if (!includeReference && document.cardEditor) delete document.cardEditor.reference
  return JSON.stringify(document)
}
