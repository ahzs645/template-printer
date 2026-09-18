/**
 * Test cards.
 *
 * Runs a template against the records that actually break ID cards — very short
 * names, very long ones, missing middle names, accents, apostrophes, values a
 * barcode cannot encode — and reports what went wrong, so the problems turn up
 * before a print run rather than after one.
 */

import type { CardData, FieldDefinition, TemplateMeta } from './types'
import type { UserData } from './fieldParser'
import { parseField } from './fieldParser'
import { buildCanvasFontString, renderSvgWithData } from './svgTemplate'
import { validateBarcodeText } from './barcode'
import { CUSTOM_STATIC_VALUE } from './standardFields'

export type TestCase = {
  id: string
  /** What this case is probing. */
  title: string
  /** Why it is worth probing. */
  rationale: string
  user: UserData
}

const BASE: UserData = {
  firstName: 'Sample',
  lastName: 'Person',
  studentId: '230137282',
  department: 'Computer Science',
  position: 'Student',
  email: 'sample.person@example.edu',
  issueDate: '2024-09-01',
  expiryDate: '2028-08-31',
}

/**
 * The standard matrix. Each case isolates one thing that goes wrong on real
 * cards, so a failure points at a cause.
 */
export const TEST_CASES: TestCase[] = [
  {
    id: 'typical',
    title: 'Typical record',
    rationale: 'The baseline everything else is compared against.',
    user: { ...BASE, firstName: 'Hyunseo', lastName: 'Kim' },
  },
  {
    id: 'short-name',
    title: 'Very short name',
    rationale:
      'A stacked name layout collapses onto one line when the text is short enough to fit, unless the break is explicit.',
    user: { ...BASE, firstName: 'Jo', lastName: 'Ng', position: 'Designer' },
  },
  {
    id: 'long-name',
    title: 'Very long name',
    rationale: 'The usual cause of text running off the edge of a card.',
    user: {
      ...BASE,
      firstName: 'Maximilian',
      lastName: 'Vandersteenhoven',
      position: 'Head of Communications and Community Engagement',
    },
  },
  {
    id: 'long-single-word',
    title: 'Long unbreakable surname',
    rationale: 'Word wrapping cannot break a single word, so only shrinking can save it.',
    user: { ...BASE, firstName: 'Ana', lastName: 'Papadopoulopoulos' },
  },
  {
    id: 'no-middle-name',
    title: 'No middle name',
    rationale:
      'Any _MiddleInitial_ format has to drop the missing part cleanly rather than leave a double space or a dangling comma.',
    user: { ...BASE, firstName: 'Priya', lastName: 'Rao', middleName: null },
  },
  {
    id: 'middle-name',
    title: 'With a middle name',
    rationale: 'The other half of the pair above.',
    user: { ...BASE, firstName: 'Priya', lastName: 'Rao', middleName: 'Anjali' },
  },
  {
    id: 'accents',
    title: 'Accents and non-Latin characters',
    rationale: 'Catches a font that has no glyph for the character, which prints as a blank or a box.',
    user: { ...BASE, firstName: 'José', lastName: 'Müller-Ødegård', position: 'Chercheur associé' },
  },
  {
    id: 'apostrophe',
    title: 'Apostrophes and hyphens',
    rationale: 'Title case has to capitalise after both, and the glyphs must not be mangled.',
    user: { ...BASE, firstName: "Jean-Luc", lastName: "O'Brien" },
  },
  {
    id: 'all-caps-source',
    title: 'Data stored in capitals',
    rationale: 'Records imported from a mainframe are often upper case; a _TitleCase_ layer has to fix that.',
    user: { ...BASE, firstName: 'MARGARET', lastName: 'OKONKWO', position: 'LIBRARIAN' },
  },
  {
    id: 'missing-optional',
    title: 'Empty optional fields',
    rationale: 'A card should not print a stray label or a placeholder where a value is missing.',
    user: {
      firstName: 'Sam',
      lastName: 'Lee',
      studentId: '',
      department: null,
      position: null,
      email: null,
    },
  },
  {
    id: 'long-id',
    title: 'Long identifier',
    rationale: 'A longer number widens a barcode, which is where it starts running past the card edge.',
    user: { ...BASE, firstName: 'Wei', lastName: 'Zhang', studentId: '20020146822740239901' },
  },
  {
    id: 'non-numeric-id',
    title: 'Identifier with letters',
    rationale: 'Codabar and EAN cannot encode letters; this should fail loudly, not silently.',
    user: { ...BASE, firstName: 'Ana', lastName: 'Silva', studentId: 'STU-2024-XY' },
  },
]

export type CardIssueSeverity = 'error' | 'warning'

export type CardIssue = {
  severity: CardIssueSeverity
  fieldId: string
  fieldLabel: string
  message: string
}

export type TestCardResult = {
  testCase: TestCase
  svg: string
  cardData: CardData
  issues: CardIssue[]
}

function measureText(text: string, field: FieldDefinition, fontSize: number): number | undefined {
  try {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) return undefined
    context.font = buildCanvasFontString(field.fontFamily, field.fontWeight, fontSize)
    return context.measureText(text).width
  } catch {
    return undefined
  }
}

function readTranslate(value: string | null): { x: number; y: number } {
  if (!value) return { x: 0, y: 0 }
  const match = /translate\(\s*([-\d.]+)[\s,]+([-\d.]+)/.exec(value)
  if (!match) return { x: 0, y: 0 }
  return { x: Number(match[1]) || 0, y: Number(match[2]) || 0 }
}

/**
 * Look over a rendered card and report what a reviewer would notice.
 */
export function analyseRenderedCard(
  svg: string,
  fields: FieldDefinition[],
  cardData: CardData,
  dimensions: { width: number; height: number },
): CardIssue[] {
  const issues: CardIssue[] = []
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')

  for (const field of fields) {
    if (!field.sourceId) continue
    const element = doc.getElementById(field.sourceId)
    const label = field.label || field.id
    const value = cardData[field.id]
    const text = typeof value === 'string' ? value : ''

    if (field.type === 'barcode') {
      const effective = text.trim() || field.defaultValue?.trim() || field.label?.trim() || ''
      if (!effective) {
        issues.push({ severity: 'error', fieldId: field.id, fieldLabel: label, message: 'Barcode has no value.' })
        continue
      }
      const validation = validateBarcodeText(field.barcodeSymbology ?? 'code128', effective)
      if (!validation.valid) {
        issues.push({
          severity: 'error',
          fieldId: field.id,
          fieldLabel: label,
          message: validation.error ?? 'Barcode value cannot be encoded.',
        })
        continue
      }
      if (element && element.tagName.toLowerCase() !== 'g') {
        issues.push({
          severity: 'error',
          fieldId: field.id,
          fieldLabel: label,
          message: 'Barcode did not generate; the placeholder text is still on the card.',
        })
        continue
      }
      // A generated barcode that runs past the trim is unscannable.
      const bbox = element?.getAttribute('transform')
      if (bbox) {
        const { x } = readTranslate(bbox)
        if (x > dimensions.width) {
          issues.push({
            severity: 'warning',
            fieldId: field.id,
            fieldLabel: label,
            message: 'Barcode starts outside the card.',
          })
        }
      }
      continue
    }

    if (field.type !== 'text') continue

    if (!element) continue

    // Only a field that is mapped to data can be "missing" a value. An unmapped
    // layer is static artwork and is supposed to keep its own text.
    const isMapped = Object.prototype.hasOwnProperty.call(cardData, field.id)
    if (isMapped && !text.trim()) {
      // The placeholder survives, which on a real card reads as someone else's data.
      issues.push({
        severity: 'warning',
        fieldId: field.id,
        fieldLabel: label,
        message: 'Mapped, but this record has no value — the template placeholder is still showing.',
      })
      continue
    }
    if (!isMapped) continue

    const renderedFontSize = Number(element.getAttribute('font-size')) || field.fontSize || 16
    const originalFontSize = field.fontSize ?? renderedFontSize
    if (renderedFontSize < originalFontSize - 0.01) {
      const percent = Math.round((1 - renderedFontSize / originalFontSize) * 100)
      issues.push({
        severity: 'warning',
        fieldId: field.id,
        fieldLabel: label,
        message: `Text was shrunk ${percent}% to fit (${originalFontSize} → ${Math.round(renderedFontSize * 10) / 10}).`,
      })
    }

    const { x: originX } = readTranslate(element.getAttribute('transform'))
    const baseX = Number(element.getAttribute('x')) || 0
    const tspans = Array.from(element.querySelectorAll('tspan'))
    const lines = tspans.length > 0 ? tspans.map((node) => node.textContent ?? '') : [element.textContent ?? '']

    for (const line of lines) {
      if (!line.trim()) continue
      const width = measureText(line, field, renderedFontSize)
      if (width === undefined) continue

      const right = originX + baseX + width
      if (right > dimensions.width) {
        issues.push({
          severity: 'error',
          fieldId: field.id,
          fieldLabel: label,
          message: `"${line}" runs ${Math.round(right - dimensions.width)} units past the edge of the card.`,
        })
        break
      }

      // Staying inside the card is not enough: text that overruns the box the
      // artwork gave it lands on top of whatever is next to it. wrapWidth is
      // that box, measured from the template's own placeholder.
      if (field.wrapWidth && width > field.wrapWidth + 0.5) {
        issues.push({
          severity: 'error',
          fieldId: field.id,
          fieldLabel: label,
          message:
            `"${line}" is ${Math.round(width - field.wrapWidth)} units wider than the space the ` +
            'artwork allows, even after shrinking. Shorten it, widen the layer, or accept the overlap.',
        })
        break
      }
    }
  }

  return issues
}

/**
 * Render a template against every test case and review the results.
 */
export function runTestCards(
  template: TemplateMeta,
  fields: FieldDefinition[],
  fieldMappings: Record<string, string>,
  customValues: Record<string, string> = {},
  cases: TestCase[] = TEST_CASES,
): TestCardResult[] {
  const dimensions = {
    width: template.viewBox?.width ?? template.width,
    height: template.viewBox?.height ?? template.height,
  }

  return cases.map((testCase) => {
    const cardData: CardData = {}
    for (const field of fields) {
      const layerId = field.sourceId || field.id
      const standardFieldName = fieldMappings[layerId] ?? fieldMappings[field.id]
      if (!standardFieldName) continue

      // A custom static layer with no value set keeps the text the artwork
      // already carries, which is what the auto-mapper seeds it with.
      const customValue =
        standardFieldName === CUSTOM_STATIC_VALUE
          ? customValues[layerId] ?? customValues[field.id] ?? field.label
          : customValues[layerId]

      cardData[field.id] = parseField(standardFieldName, testCase.user, customValue)
    }

    let svg = ''
    const issues: CardIssue[] = []
    try {
      svg = renderSvgWithData(template, fields, cardData)
      issues.push(...analyseRenderedCard(svg, fields, cardData, dimensions))
    } catch (error) {
      issues.push({
        severity: 'error',
        fieldId: '',
        fieldLabel: 'Template',
        message: error instanceof Error ? error.message : 'Rendering failed.',
      })
    }

    return { testCase, svg, cardData, issues }
  })
}

export function countIssues(results: TestCardResult[]): { errors: number; warnings: number } {
  let errors = 0
  let warnings = 0
  for (const result of results) {
    for (const issue of result.issues) {
      if (issue.severity === 'error') errors += 1
      else warnings += 1
    }
  }
  return { errors, warnings }
}
