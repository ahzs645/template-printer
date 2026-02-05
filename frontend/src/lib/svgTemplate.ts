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

/**
 * Parse CSS rules from SVG <style> blocks and build a map of class -> font-size
 */
function parseCssFontSizes(svg: Document): Map<string, number> {
  const fontSizeMap = new Map<string, number>()
  const styleElements = svg.querySelectorAll('style')

  for (const styleEl of styleElements) {
    const cssText = styleEl.textContent || ''
    // Match CSS rules like: .cls-5 { font-size: 10.6px; } or .cls-3, .cls-4, .cls-5 { font-size: 10.6px; }
    const rulePattern = /([^{]+)\{([^}]+)\}/g
    let match
    while ((match = rulePattern.exec(cssText)) !== null) {
      const selectors = match[1]
      const declarations = match[2]

      // Check if this rule has a font-size declaration
      const fontSizeMatch = declarations.match(/font-size\s*:\s*([0-9.]+)(?:px)?/i)
      if (!fontSizeMatch) continue

      const fontSize = parseFloat(fontSizeMatch[1])
      if (!Number.isFinite(fontSize)) continue

      // Extract class names from selectors (e.g., ".cls-5" -> "cls-5")
      const classPattern = /\.([a-zA-Z0-9_-]+)/g
      let classMatch
      while ((classMatch = classPattern.exec(selectors)) !== null) {
        fontSizeMap.set(classMatch[1], fontSize)
      }
    }
  }

  return fontSizeMap
}

/**
 * Get font size for an element, checking attributes, style attribute, and CSS classes
 */
function getFontSize(node: Element, cssFontSizes: Map<string, number>): number | undefined {
  // 1. Check direct font-size attribute
  const attrSize = readNumeric(node.getAttribute('font-size'))
  if (attrSize !== undefined) return attrSize

  // 2. Check style attribute
  const styleAttr = node.getAttribute('style')
  if (styleAttr) {
    const styleMatch = styleAttr.match(/font-size\s*:\s*([0-9.]+)(?:px)?/i)
    if (styleMatch) {
      const size = parseFloat(styleMatch[1])
      if (Number.isFinite(size)) return size
    }
  }

  // 3. Check CSS classes (also check child tspans which may have the class)
  const classAttr = node.getAttribute('class')
  if (classAttr) {
    const classes = classAttr.split(/\s+/)
    for (const cls of classes) {
      const size = cssFontSizes.get(cls)
      if (size !== undefined) return size
    }
  }

  // 4. Check first tspan's class for font-size
  const tspan = node.querySelector('tspan')
  if (tspan) {
    const tspanClass = tspan.getAttribute('class')
    if (tspanClass) {
      const classes = tspanClass.split(/\s+/)
      for (const cls of classes) {
        const size = cssFontSizes.get(cls)
        if (size !== undefined) return size
      }
    }
  }

  return undefined
}

/**
 * Group tspan children of a text element by their effective y position
 * to detect multi-line text layouts.
 */
function groupTspansByLine(textElement: Element): string[] {
  const tspans = Array.from(textElement.querySelectorAll('tspan'))
  if (tspans.length === 0) {
    const content = textElement.textContent?.trim()
    return content ? [content] : []
  }

  const lineGroups = new Map<number, string[]>()
  let currentY = 0

  for (const tspan of tspans) {
    const yAttr = readNumeric(tspan.getAttribute('y'))
    const dyAttr = readNumeric(tspan.getAttribute('dy'))

    if (yAttr !== undefined) {
      currentY = yAttr
    } else if (dyAttr !== undefined) {
      currentY += dyAttr
    }

    const roundedY = Math.round(currentY * 100) / 100
    const existing = lineGroups.get(roundedY) || []
    existing.push(tspan.textContent || '')
    lineGroups.set(roundedY, existing)
  }

  return Array.from(lineGroups.entries())
    .sort(([a], [b]) => a - b)
    .map(([, texts]) => texts.join('').trim())
    .filter((line) => line.length > 0)
}

/**
 * Measure the widest line of text using an offscreen canvas.
 * Returns width in the same units as fontSize (SVG user units).
 */
function measureWidestLine(
  lines: string[],
  fontFamily: string | undefined,
  fontSize: number,
  fontWeight: number | undefined,
): number | undefined {
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    ctx.font = buildCanvasFontString(fontFamily, fontWeight, fontSize)

    let maxWidth = 0
    for (const line of lines) {
      const width = ctx.measureText(line).width
      if (width > maxWidth) maxWidth = width
    }

    return maxWidth > 0 ? maxWidth : undefined
  } catch {
    return undefined
  }
}

/**
 * Word-wrap text to fit within maxWidth using canvas text measurement.
 */
function wrapTextToLines(
  text: string,
  maxWidth: number,
  fontFamily: string | undefined,
  fontWeight: number | undefined,
  fontSize: number,
): string[] {
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return text.split(/\r?\n/)

    ctx.font = buildCanvasFontString(fontFamily, fontWeight, fontSize)

    const paragraphs = text.split(/\r?\n/)
    const result: string[] = []

    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) {
        result.push('')
        continue
      }

      const words = paragraph.split(/\s+/)
      let currentLine = ''

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word
        if (ctx.measureText(testLine).width <= maxWidth || !currentLine) {
          currentLine = testLine
        } else {
          result.push(currentLine)
          currentLine = word
        }
      }

      if (currentLine) result.push(currentLine)
    }

    return result.length > 0 ? result : ['']
  } catch {
    return text.split(/\r?\n/)
  }
}

function extractTextFields(svg: Document, dimensions: { width?: number; height?: number }): FieldDefinition[] {
  const textNodes = Array.from(svg.querySelectorAll('text'))
  const fields: FieldDefinition[] = []
  const cssFontSizes = parseCssFontSizes(svg)
  let index = 1

  for (const node of textNodes) {
    if (node.closest('defs')) continue
    const content = node.textContent?.replace(/\s+/g, ' ').trim()
    if (!content) continue

    const { x, y } = getTextPosition(node)
    const fontFamily = getFontFamily(node)
    const fontSize = getFontSize(node, cssFontSizes) ?? 16
    const fontWeight = getFontWeight(node)
    const color = getFillColor(node) ?? '#000000'
    const anchor = node.getAttribute('text-anchor')?.toLowerCase()
    const align: FieldDefinition['align'] = anchor === 'middle' ? 'center' : anchor === 'end' ? 'right' : 'left'

    // Detect multi-line tspan layout and compute wrap width
    const lineTexts = groupTspansByLine(node)
    const isMultiLine = lineTexts.length > 1
    let wrapWidth: number | undefined
    if (isMultiLine) {
      wrapWidth = measureWidestLine(lineTexts, fontFamily, fontSize, fontWeight)
    }

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
      wrapWidth,
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
  const cssFontSizes = parseCssFontSizes(svg)
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
      fontSize: getFontSize(node, cssFontSizes) ?? 16,
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

  // Bake CSS font-sizes into inline attributes for all text elements and tspans
  // This ensures font styling is preserved even when tspan structure changes
  bakeCssFontSizes(doc)

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

/**
 * Bake CSS font-sizes into inline font-size attributes for all text elements and tspans.
 * This preserves font styling when tspan structure is modified during text replacement.
 */
function bakeCssFontSizes(doc: Document): void {
  const cssFontSizes = parseCssFontSizes(doc)

  // Process all text elements
  const textElements = doc.querySelectorAll('text')
  for (const textEl of textElements) {
    // Skip if already has inline font-size
    if (!textEl.hasAttribute('font-size')) {
      const fontSize = getCssFontSizeForElement(textEl, cssFontSizes)
      if (fontSize !== undefined) {
        textEl.setAttribute('font-size', String(fontSize))
      }
    }

    // Process all tspans within this text element
    const tspans = textEl.querySelectorAll('tspan')
    for (const tspan of tspans) {
      // Skip if already has inline font-size
      if (!tspan.hasAttribute('font-size')) {
        const fontSize = getCssFontSizeForElement(tspan, cssFontSizes)
        if (fontSize !== undefined) {
          tspan.setAttribute('font-size', String(fontSize))
        }
      }
    }
  }
}

/**
 * Get font-size from CSS classes for an element (doesn't check parent/children)
 */
function getCssFontSizeForElement(element: Element, cssFontSizes: Map<string, number>): number | undefined {
  const classAttr = element.getAttribute('class')
  if (!classAttr) return undefined

  const classes = classAttr.split(/\s+/)
  for (const cls of classes) {
    const size = cssFontSizes.get(cls)
    if (size !== undefined) return size
  }
  return undefined
}

function applySvgTextField(
  doc: Document,
  element: Element,
  field: FieldDefinition,
  rawValue: string | undefined,
) {
  // If no custom value provided, preserve the original element structure
  // This keeps tspans with their baked inline font-sizes intact
  if (!rawValue || rawValue.trim().length === 0) {
    return
  }

  const value = rawValue.trim()

  // Capture the original font-size from CSS before removing children
  // This preserves styling from <style> blocks that would be lost when tspans are removed
  const cssFontSizes = parseCssFontSizes(doc)
  const originalFontSize = getFontSize(element, cssFontSizes)

  // Capture baseline position from the first tspan before clearing children.
  // Many SVGs use transform="translate(...)" on the <text> element with tspans
  // at x="0" y="0", so we fall back to the first tspan's coordinates.
  const firstTspan = element.querySelector('tspan')
  const baseX = element.getAttribute('x') ?? firstTspan?.getAttribute('x') ?? '0'
  const baseY = element.getAttribute('y') ?? firstTspan?.getAttribute('y') ?? '0'

  while (element.firstChild) {
    element.removeChild(element.firstChild)
  }

  // Use the original CSS font-size if available, otherwise fall back to field.fontSize
  const effectiveFontSize = originalFontSize ?? field.fontSize ?? 16

  // Determine lines: use word wrapping if a wrapWidth was detected, otherwise split on newlines
  let lines: string[]
  if (field.wrapWidth && field.wrapWidth > 0) {
    lines = wrapTextToLines(value, field.wrapWidth, field.fontFamily, field.fontWeight, effectiveFontSize)
  } else {
    lines = value.split(/\r?\n/)
  }

  if (lines.length <= 1) {
    element.textContent = lines[0] ?? ''
  } else {
    const lineHeight = effectiveFontSize * 1.2

    lines.forEach((line, index) => {
      const tspan = doc.createElementNS(SVG_NS, 'tspan')
      if (index === 0) {
        tspan.setAttribute('x', baseX)
        tspan.setAttribute('y', baseY)
      } else {
        tspan.setAttribute('x', baseX)
        tspan.setAttribute('dy', `${lineHeight}`)
      }
      tspan.textContent = line || ' '
      element.appendChild(tspan)
    })
  }

  if (field.fontFamily !== undefined) {
    setOrRemoveAttribute(element, 'font-family', field.fontFamily)
  }
  // Always set font-size as inline attribute to preserve it after CSS classes are removed
  element.setAttribute('font-size', String(effectiveFontSize))
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
