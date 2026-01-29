import type {
  CardData,
  CardDataValue,
  FieldDefinition,
  FieldType,
  ImageValue,
  TemplateExtractionResult,
  TemplateMeta,
} from './types'

const PLACEHOLDER_PATTERN = /\{\{(field|image|barcode|date):([a-zA-Z0-9_-]+)\}\}/
const SVG_NS = 'http://www.w3.org/2000/svg'

export function readNumeric(value: string | null | undefined): number | undefined {
  if (!value) return undefined
  const sanitized = value.trim()
  if (!sanitized) return undefined
  const numeric = parseFloat(sanitized)
  return Number.isFinite(numeric) ? numeric : undefined
}

export function parseUnit(value: string | null | undefined): { numeric?: number; unit?: 'mm' | 'px' } {
  if (!value) return {}
  const match = value.match(/([0-9.]+)\s*(mm|px)?/i)
  if (!match) return {}
  const numeric = parseFloat(match[1])
  const unit = (match[2]?.toLowerCase() as 'mm' | 'px') ?? undefined
  return { numeric: Number.isFinite(numeric) ? numeric : undefined, unit }
}

function detectFieldType(rawType: string): FieldType {
  switch (rawType) {
    case 'image':
      return 'image'
    case 'barcode':
      return 'barcode'
    case 'date':
      return 'date'
    default:
      return 'text'
  }
}

export function toPercent(value: number | undefined, total: number | undefined, fallback: number): number {
  if (!value || !total) return fallback
  if (total === 0) return fallback
  return clamp((value / total) * 100, 0, 100)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function ensureNodeId(node: Element, prefix: string, index: number): string {
  const existing = node.getAttribute('id')?.trim()
  if (existing) return existing
  const generated = `${prefix}-${index}`
  node.setAttribute('id', generated)
  return generated
}

function parseTranslate(value: string | null | undefined): { x?: number; y?: number } {
  if (!value) return {}
  const match = value.match(/translate\(([^)]+)\)/i)
  if (!match) return {}
  const parts = match[1]
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map(parseFloat)
  if (parts.length === 0) return {}
  return { x: Number.isFinite(parts[0]) ? parts[0] : undefined, y: Number.isFinite(parts[1]) ? parts[1] : undefined }
}

function parseFontFamily(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  const entries = value
    .split(',')
    .map((part) => part.replace(/['";]/g, '').trim())
    .filter(Boolean)
  return entries[0]
}

function getFontFamily(node: Element): string | undefined {
  const direct = parseFontFamily(node.getAttribute('font-family'))
  if (direct) return direct
  const styleAttr = node.getAttribute('style')
  if (!styleAttr) return undefined
  const styleMatch = styleAttr.match(/font-family\s*:\s*([^;]+)/i)
  return styleMatch ? parseFontFamily(styleMatch[1]) : undefined
}

function getFontWeight(node: Element): number | undefined {
  const attr = node.getAttribute('font-weight')
  const weight = attr ? Number.parseInt(attr, 10) : undefined
  if (Number.isFinite(weight)) return weight
  const styleAttr = node.getAttribute('style')
  if (!styleAttr) return undefined
  const styleMatch = styleAttr.match(/font-weight\s*:\s*([^;]+)/i)
  if (!styleMatch) return undefined
  const parsed = Number.parseInt(styleMatch[1], 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function getFillColor(node: Element): string | undefined {
  const attr = node.getAttribute('fill')
  if (attr && attr.toLowerCase() !== 'none') return attr
  const styleAttr = node.getAttribute('style')
  if (!styleAttr) return undefined
  const styleMatch = styleAttr.match(/fill\s*:\s*([^;]+)/i)
  const color = styleMatch ? styleMatch[1].trim() : undefined
  return color && color.toLowerCase() !== 'none' ? color : undefined
}

function getTextPosition(node: Element): { x?: number; y?: number } {
  const translate = parseTranslate(node.getAttribute('transform'))
  const xAttr = readNumeric(node.getAttribute('x'))
  const yAttr = readNumeric(node.getAttribute('y'))

  let x = translate.x ?? 0
  let y = translate.y ?? 0

  if (xAttr !== undefined) x += xAttr
  if (yAttr !== undefined) y += yAttr

  const tspan = node.querySelector('tspan')
  if (tspan) {
    const tspanX = readNumeric(tspan.getAttribute('x'))
    const tspanY = readNumeric(tspan.getAttribute('y'))
    if (tspanX !== undefined) x = (translate.x ?? 0) + tspanX
    if (tspanY !== undefined) y = (translate.y ?? 0) + tspanY
  }

  return { x, y }
}

function sanitizeIdentifier(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function slugify(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || 'text'
}

function asImageValue(value: CardDataValue | undefined): ImageValue | undefined {
  if (!value || typeof value !== 'object') return undefined
  if (!('src' in value)) return undefined
  return value as ImageValue
}

function extractTextFields(svg: Document, dimensions: { width?: number; height?: number }): FieldDefinition[] {
  const textNodes = Array.from(svg.querySelectorAll('text'))
  const fields: FieldDefinition[] = []
  let index = 1

  for (const node of textNodes) {
    if (node.closest('defs')) continue
    const content = node.textContent?.replace(/\s+/g, ' ').trim()
    if (!content) continue

    const { x, y } = getTextPosition(node)
    const fontFamily = getFontFamily(node)
    const fontSize = readNumeric(node.getAttribute('font-size')) ?? 16
    const fontWeight = getFontWeight(node)
    const color = getFillColor(node) ?? '#000000'
    const anchor = node.getAttribute('text-anchor')?.toLowerCase()
    const align: FieldDefinition['align'] = anchor === 'middle' ? 'center' : anchor === 'end' ? 'right' : 'left'

    const sourceId = ensureNodeId(node, 'text-field', index)
    const idBaseFromSource = sanitizeIdentifier(sourceId)
    const idBase = idBaseFromSource || slugify(content)
    const id = `${idBase || 'text'}_${index}`

    fields.push({
      id,
      label: content,
      type: 'text',
      x: toPercent(x, dimensions.width, 10 + index * 5),
      y: toPercent(y, dimensions.height, 10 + index * 5),
      fontSize,
      color,
      align,
      auto: true,
      fontFamily,
      fontWeight,
      sourceId,
    })

    index += 1
  }

  return dedupeFields(fields)
}

function extractImagePlaceholders(svg: Document, dimensions: { width?: number; height?: number }): FieldDefinition[] {
  const groups = Array.from(svg.querySelectorAll('g[id]'))
  const fields: FieldDefinition[] = []
  let index = 1

  for (const group of groups) {
    const id = group.getAttribute('id')
    if (!id) continue
    if (PLACEHOLDER_PATTERN.test(id)) continue
    if (!/photo|image/i.test(id)) continue

    const rect = group.querySelector('rect')
    const x = readNumeric(rect?.getAttribute('x'))
    const y = readNumeric(rect?.getAttribute('y'))
    const width = readNumeric(rect?.getAttribute('width'))
    const height = readNumeric(rect?.getAttribute('height'))
    if (width === undefined || height === undefined) continue

    const sourceId = ensureNodeId(group, 'image-field', index)

    fields.push({
      id: slugify(id) || `image_${index}`,
      label: toLabel(id),
      type: 'image',
      x: toPercent(x, dimensions.width, 10 + index * 5),
      y: toPercent(y, dimensions.height, 10 + index * 5),
      width: toPercent(width, dimensions.width, 20),
      height: toPercent(height, dimensions.height, 20),
      auto: true,
      sourceId,
    })

    index += 1
  }

  return dedupeFields(fields)
}

export function extractFontFamilies(svg: Document): string[] {
  const fonts = new Set<string>()

  // Extract from font-family attributes and inline styles on elements
  const candidateNodes = svg.querySelectorAll('[font-family], text')
  candidateNodes.forEach((node) => {
    if (node instanceof SVGElement && node.closest('defs')) return
    const family = getFontFamily(node as Element)
    if (family) fonts.add(family)
  })

  // Extract from <style> blocks (CSS rules)
  const styleElements = svg.querySelectorAll('style')
  styleElements.forEach((styleEl) => {
    const cssText = styleEl.textContent || ''
    // Match font-family declarations in CSS
    const fontFamilyRegex = /font-family\s*:\s*([^;}\n]+)/gi
    let match: RegExpExecArray | null
    while ((match = fontFamilyRegex.exec(cssText)) !== null) {
      const parsed = parseFontFamily(match[1])
      if (parsed) fonts.add(parsed)
    }
  })

  return Array.from(fonts)
}

export function buildFontFamilyStack(fontFamily?: string): string {
  if (!fontFamily) {
    return 'Inter, "Segoe UI", sans-serif'
  }
  const sanitized = fontFamily.replace(/['"]/g, '').trim()
  if (!sanitized) {
    return 'Inter, "Segoe UI", sans-serif'
  }
  const needsQuotes = /\s/.test(sanitized)
  const primary = needsQuotes ? `"${sanitized}"` : sanitized
  return `${primary}, "Inter", "Segoe UI", sans-serif`
}

export function buildCanvasFontString(fontFamily: string | undefined, fontWeight: number | undefined, fontSize: number): string {
  const weight = typeof fontWeight === 'number' && Number.isFinite(fontWeight) ? fontWeight : 400
  const stack = buildFontFamilyStack(fontFamily)
  return `${weight} ${fontSize}px ${stack}`
}

function extractPlaceholders(svg: Document, dimensions: { width?: number; height?: number }): FieldDefinition[] {
  const nodes = Array.from(svg.querySelectorAll('[id]'))
  const fields: FieldDefinition[] = []
  let fallbackOffset = 10
  let index = 0

  for (const node of nodes) {
    const rawId = node.getAttribute('id')
    if (!rawId) continue
    const match = rawId.match(PLACEHOLDER_PATTERN)
    if (!match) continue

    const [, type, name] = match
    const fieldType = detectFieldType(type)

    const x = readNumeric(node.getAttribute('x'))
    const y = readNumeric(node.getAttribute('y'))
    const width = readNumeric(node.getAttribute('width'))
    const height = readNumeric(node.getAttribute('height'))

    const xPercent = toPercent(x, dimensions.width, fallbackOffset)
    const yPercent = toPercent(y, dimensions.height, fallbackOffset)
    const widthPercent = width !== undefined ? toPercent(width, dimensions.width, 20) : undefined
    const heightPercent = height !== undefined ? toPercent(height, dimensions.height, 10) : undefined
    const fontFamily = getFontFamily(node)
    const fontWeight = getFontWeight(node)
    const color = getFillColor(node) ?? '#000000'
    const anchor = node.getAttribute('text-anchor')?.toLowerCase()
    const align: FieldDefinition['align'] = anchor === 'middle' ? 'center' : anchor === 'end' ? 'right' : 'left'
    const sourceId = ensureNodeId(node, 'placeholder-field', index)

    fields.push({
      id: name,
      label: toLabel(name),
      type: fieldType,
      x: xPercent,
      y: yPercent,
      width: widthPercent,
      height: heightPercent,
      fontSize: readNumeric(node.getAttribute('font-size')) ?? 16,
      color,
      align,
      auto: true,
      fontFamily,
      fontWeight,
      sourceId,
    })

    fallbackOffset += 8
    index += 1
  }

  return dedupeFields(fields)
}

function dedupeFields(fields: FieldDefinition[]): FieldDefinition[] {
  const seen = new Map<string, number>()
  return fields.map((field) => {
    const key = field.sourceId ?? field.id
    const existing = seen.get(key)
    if (existing === undefined) {
      seen.set(key, 1)
      return field
    }
    const newCount = existing + 1
    seen.set(key, newCount)
    return {
      ...field,
      id: `${field.id}-${newCount}`,
      label: `${field.label} (${newCount})`,
      auto: field.auto,
      sourceId: field.sourceId,
    }
  })
}

function toLabel(value: string): string {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export async function parseTemplate(file: File): Promise<TemplateExtractionResult> {
  const rawSvg = await file.text()
  return parseTemplateString(rawSvg, file.name)
}

export async function parseTemplateString(rawSvg: string, fileName = 'template.svg'): Promise<TemplateExtractionResult> {
  const parser = new DOMParser()
  const doc = parser.parseFromString(rawSvg, 'image/svg+xml')
  const svgNode = doc.querySelector('svg')
  if (!svgNode) {
    throw new Error('Uploaded file does not contain a valid <svg> root element.')
  }

  const widthInfo = parseUnit(svgNode.getAttribute('width'))
  const heightInfo = parseUnit(svgNode.getAttribute('height'))
  const viewBoxAttr = svgNode.getAttribute('viewBox')

  let width = widthInfo.numeric
  let height = heightInfo.numeric
  let unit: 'mm' | 'px' = widthInfo.unit ?? heightInfo.unit ?? 'px'

  if ((!width || !height) && viewBoxAttr) {
    const [, , viewWidth, viewHeight] = viewBoxAttr.split(/\s+/).map(parseFloat)
    if (Number.isFinite(viewWidth) && !width) width = viewWidth
    if (Number.isFinite(viewHeight) && !height) height = viewHeight
    unit = 'px'
  }

  if (!width || !height) {
    width = 86
    height = 54
    unit = 'mm'
  }

  const viewBoxNumbers = viewBoxAttr?.split(/\s+/).map(parseFloat)
  const viewBox =
    viewBoxNumbers && viewBoxNumbers.length === 4
      ? {
          x: viewBoxNumbers[0],
          y: viewBoxNumbers[1],
          width: viewBoxNumbers[2],
          height: viewBoxNumbers[3],
        }
      : undefined

  const fonts = extractFontFamilies(doc)
  const placeholderFields = extractPlaceholders(doc, { width, height })
  const textFields = placeholderFields.length > 0 ? [] : extractTextFields(doc, { width, height })
  const imageFields = placeholderFields.length > 0 ? [] : extractImagePlaceholders(doc, { width, height })
  const serializer = new XMLSerializer()
  const normalizedSvg = serializer.serializeToString(svgNode)
  const objectUrl = URL.createObjectURL(new Blob([normalizedSvg], { type: 'image/svg+xml' }))
  const metadata: TemplateMeta = {
    name: fileName,
    width,
    height,
    unit,
    rawSvg: normalizedSvg,
    objectUrl,
    viewBox,
    fonts,
  }

  const autoFields = placeholderFields.length > 0 ? placeholderFields : [...textFields, ...imageFields]

  return { metadata, autoFields }
}

export function renderSvgWithData(template: TemplateMeta, fields: FieldDefinition[], cardData: CardData): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(template.rawSvg, 'image/svg+xml')
  const svgRoot = doc.documentElement

  for (const field of fields) {
    if (!field.sourceId) continue
    const target = doc.getElementById(field.sourceId)
    if (!target) continue

    if (field.type === 'image') {
      const value = cardData[field.id]
      applySvgImageField(doc, target, asImageValue(value))
      continue
    }

    if (field.type !== 'text') continue
    const value = cardData[field.id]
    const textValue = typeof value === 'string' ? value : undefined
    applySvgTextField(doc, target, field, textValue)
  }

  return new XMLSerializer().serializeToString(svgRoot)
}

function applySvgTextField(
  doc: Document,
  element: Element,
  field: FieldDefinition,
  rawValue: string | undefined,
) {
  const value = rawValue && rawValue.trim().length > 0 ? rawValue : field.label ?? ''
  const lines = value.split(/\r?\n/)

  while (element.firstChild) {
    element.removeChild(element.firstChild)
  }

  if (lines.length <= 1) {
    element.textContent = lines[0] ?? ''
  } else {
    const baseX = element.getAttribute('x')
    const baseY = element.getAttribute('y')
    const lineHeight = (field.fontSize ?? 16) * 1.2

    lines.forEach((line, index) => {
      const tspan = doc.createElementNS(SVG_NS, 'tspan')
      if (index === 0) {
        if (baseX) tspan.setAttribute('x', baseX)
        if (baseY) tspan.setAttribute('y', baseY)
      } else {
        if (baseX) tspan.setAttribute('x', baseX)
        tspan.setAttribute('dy', `${lineHeight}`)
      }
      tspan.textContent = line || ' '
      element.appendChild(tspan)
    })
  }

  if (field.fontFamily !== undefined) {
    setOrRemoveAttribute(element, 'font-family', field.fontFamily)
  }
  setOrRemoveAttribute(element, 'font-size', field.fontSize ? String(field.fontSize) : undefined)
  setOrRemoveAttribute(element, 'font-weight', field.fontWeight ? String(field.fontWeight) : undefined)
  if (field.color !== undefined) {
    setOrRemoveAttribute(element, 'fill', field.color)
  }

  const anchor = field.align === 'center' ? 'middle' : field.align === 'right' ? 'end' : 'start'
  if (anchor === 'start') {
    element.removeAttribute('text-anchor')
  } else {
    element.setAttribute('text-anchor', anchor)
  }

  if (value.trim().length === 0) {
    element.setAttribute('aria-hidden', 'true')
  } else {
    element.removeAttribute('aria-hidden')
  }
}

function setOrRemoveAttribute(element: Element, attribute: string, value: string | undefined) {
  if (value === undefined || value === null || value.trim() === '') {
    element.removeAttribute(attribute)
  } else {
    element.setAttribute(attribute, value)
  }
}

export function getDefaultField(id: string): FieldDefinition {
  return {
    id,
    label: toLabel(id),
    type: 'text',
    x: 10,
    y: 10,
    width: 20,
    height: 6,
    fontSize: 16,
    color: '#000000',
    align: 'left',
    auto: false,
    fontFamily: 'Inter',
    fontWeight: 400,
    sourceId: undefined,
  }
}

export function nextFieldId(existing: FieldDefinition[]): string {
  const base = 'field'
  let index = existing.length + 1
  let candidate = `${base}_${index}`
  while (existing.some((field) => field.id === candidate)) {
    index += 1
    candidate = `${base}_${index}`
  }
  return candidate
}

export async function loadImageElement(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Unable to load image'))
    image.src = source
  })
}

export async function loadSvgAsImage(svgMarkup: string): Promise<HTMLImageElement> {
  const blob = new Blob([svgMarkup], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  try {
    const image = await loadImageElement(url)
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

function applySvgImageField(
  doc: Document,
  element: Element,
  value: ImageValue | undefined,
) {
  Array.from(element.querySelectorAll('image[data-idcard-generated="true"]')).forEach((node) => node.remove())

  const imageValue = asImageValue(value)
  if (!imageValue) {
    return
  }

  const { src, scale = 1, offsetX = 0, offsetY = 0 } = imageValue

  const rect = element.querySelector('rect')
  const x = readNumeric(rect?.getAttribute('x')) ?? 0
  const y = readNumeric(rect?.getAttribute('y')) ?? 0
  const width = readNumeric(rect?.getAttribute('width')) ?? 0
  const height = readNumeric(rect?.getAttribute('height')) ?? 0

  if (width <= 0 || height <= 0) {
    return
  }

  if (rect) {
    rect.setAttribute('fill', 'none')
  }

  const scaleFactor = Math.max(0.1, scale)
  const drawWidth = width * scaleFactor
  const drawHeight = height * scaleFactor
  const offsetXPx = offsetX * width
  const offsetYPx = offsetY * height
  const drawX = x + offsetXPx - (drawWidth - width) / 2
  const drawY = y + offsetYPx - (drawHeight - height) / 2

  const image = doc.createElementNS(SVG_NS, 'image')
  image.setAttribute('x', String(drawX))
  image.setAttribute('y', String(drawY))
  image.setAttribute('width', String(drawWidth))
  image.setAttribute('height', String(drawHeight))
  image.setAttribute('preserveAspectRatio', 'xMidYMid slice')
  image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', src)
  image.setAttribute('href', src)
  image.setAttribute('data-idcard-generated', 'true')

  element.appendChild(image)
}
