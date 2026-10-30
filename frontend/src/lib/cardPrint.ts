/**
 * A card package, filled and printed without the app around it.
 *
 * The app opens a package into storage (templates, mappings, a card design)
 * and prints from there. A host that only wants to fill a brand's card and
 * print it needs none of that: it needs the artwork, what each layer reads from
 * a person, and the fonts. This module holds those, in memory, and prints them
 * with the exporter's own renderer, layouts and slot maths.
 *
 * People are plain records keyed like the app's users (firstName, lastName,
 * position, photoPath…), so a package's mappings mean the same thing here as
 * they do in the app. Layers with no mapping are filled by their field id.
 */

import { PDFDocument } from 'pdf-lib'

import type { FieldMapping } from './api'
import {
  calculateCardPositions,
  cardNeedsRotation,
  getSlotScale,
  getTemplateSizeInPoints,
  renderCardToCanvas,
} from './exporter'
import { parseField, type UserData } from './fieldParser'
import type { PackageBytes } from './packageUrl'
import { CUSTOM_STATIC_VALUE, normalizeStandardFieldName } from './standardFields'
import { parseTemplateString, renderSvgWithData } from './svgTemplate'
import { readTemplatePackage, type LoadedPackageSide } from './templatePackage'
import type { CardData, FieldDefinition, PrintLayout, TemplateMeta } from './types'

export type CardFace = 'front' | 'back'

/** One person's values, keyed by `CardInput.key`. Images are data or http(s) URLs. */
export type CardPerson = Record<string, string>

/** Something a person fills in: a value one or more of the card's layers read. */
export type CardInput = {
  key: string
  label: string
  kind: 'text' | 'image'
  faces: CardFace[]
}

/** One side of the card: its artwork, the layers it fills, and what they read. */
export type CardSideArtwork = {
  name: string
  template: TemplateMeta
  fields: FieldDefinition[]
  mappings: FieldMapping[]
}

/** Another look of the card, picked per person by `CardPackage.variantField`. */
export type CardVariantArtwork = {
  id: string
  name: string
  match: string[]
  front: CardSideArtwork
  back?: CardSideArtwork
}

export type CardPackage = {
  name: string
  front: CardSideArtwork
  back?: CardSideArtwork
  variants?: CardVariantArtwork[]
  variantField?: string
  /** What a person fills in, in a sensible order (names first). */
  inputs: CardInput[]
  /** The person the package was made with, read back from its sample values. */
  sample: CardPerson
  /** Font families the package registered with `document.fonts`. */
  fonts: string[]
  /** Fonts the artwork asks for that the package could not include. */
  missingFonts: string[]
  /**
   * The package's fonts as @font-face rules with the files inline. Artwork
   * drawn as an image (every export) cannot see the page's fonts, so it
   * carries these.
   */
  fontCss: string
}

/** Labels for the person fields a mapping can read, in the order a form asks for them. */
const PERSON_FIELDS: Record<string, string> = {
  firstName: 'First name',
  middleName: 'Middle name',
  lastName: 'Last name',
  position: 'Position',
  department: 'Department',
  grade: 'Grade',
  studentId: 'ID number',
  libraryNumber: 'Library number',
  email: 'Email',
  phoneNumber: 'Phone',
  address: 'Address',
  emergencyContact: 'Emergency contact',
  birthDate: 'Date of birth',
  issueDate: 'Issued',
  expiryDate: 'Expires',
  photoPath: 'Photo',
  signaturePath: 'Signature',
}
const IMAGE_KEYS = new Set(['photoPath', 'signaturePath'])
const NAME_PUNCTUATION = new Set(['comma', 'linebreak', 'newline', 'break'])
const SVG_NS = 'http://www.w3.org/2000/svg'
const POINTS_PER_INCH = 72

/** What a layer reads: its mapping, or the standard field its own name spells. */
function mappingFor(side: CardSideArtwork, field: FieldDefinition): FieldMapping | null {
  const layerId = field.sourceId || field.id
  const mapped = side.mappings.find((mapping) => mapping.svgLayerId === layerId)
  if (mapped) return mapped
  // A layer named by the convention (docs/svg-layer-naming.md) means what it says.
  const named = normalizeStandardFieldName(layerId)
  return named ? { svgLayerId: layerId, standardFieldName: named } : null
}

/** The person fields a standard field name reads. */
function personKeys(standardFieldName: string): string[] {
  const [type, ...format] = (normalizeStandardFieldName(standardFieldName) ?? standardFieldName).split('_')
  const lower = type.toLowerCase()
  if (lower === 'photo' || lower === 'profilephoto') return ['photoPath']
  if (lower === 'signature') return ['signaturePath']
  if (lower === 'middleinitial') return ['middleName']
  if (lower === 'fullname') {
    const keys = new Set<string>()
    for (const token of format.map((part) => part.toLowerCase())) {
      if (token.startsWith('first')) keys.add('firstName')
      else if (token.startsWith('last')) keys.add('lastName')
      else if (token.startsWith('middle')) keys.add('middleName')
    }
    return [...keys]
  }
  return type in PERSON_FIELDS ? [type] : []
}

/**
 * A full name as a template printed it ("Hyunseo Kim"), split back into the
 * parts its mapping joins. Each part takes one word; the first name takes any
 * left over, so "Mary Ann Smith" is Mary Ann, Smith.
 */
function splitName(value: string, standardFieldName: string): CardPerson {
  const order = (normalizeStandardFieldName(standardFieldName) ?? standardFieldName)
    .split('_')
    .slice(1)
    .map((token) => token.toLowerCase())
    .filter((token) => !NAME_PUNCTUATION.has(token) && !['allcaps', 'upper', 'titlecase', 'title', 'lowercase', 'lower'].includes(token))
    .map((token) => (token.startsWith('first') ? 'firstName' : token.startsWith('last') ? 'lastName' : 'middleName'))
  const words = value.replace(/,/g, ' ').split(/\s+/).filter(Boolean)
  const extra = Math.max(0, words.length - order.length)
  const greedy = order.includes('firstName') ? 'firstName' : order[order.length - 1]
  const person: CardPerson = {}
  for (const key of order) {
    const take = key === greedy ? 1 + extra : 1
    const part = words.splice(0, take).join(' ')
    if (part && !person[key]) person[key] = part
  }
  return person
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }
  return btoa(binary)
}

/** Faces this module added, so opening a package again replaces them rather than piling up. */
const registeredFaces = new Map<string, FontFace>()

async function registerFont(name: string, file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const family = name.replace(/["\\]/g, '')
  try {
    const face = new FontFace(family, bytes.slice().buffer)
    await face.load()
    const previous = registeredFaces.get(family)
    if (previous) document.fonts.delete(previous)
    document.fonts.add(face)
    registeredFaces.set(family, face)
  } catch (error) {
    console.error(`Could not load the packaged font "${name}"`, error)
  }
  return `@font-face{font-family:"${family}";src:url(data:${file.type || 'font/ttf'};base64,${toBase64(bytes)})}`
}

async function loadSide(side: LoadedPackageSide, fallbackMappings: FieldMapping[] = []): Promise<CardSideArtwork> {
  const { metadata, autoFields } = await parseTemplateString(side.svg, side.name || side.file)
  URL.revokeObjectURL(metadata.objectUrl)
  const mappings = side.mappings?.length ? side.mappings : fallbackMappings
  return {
    name: side.name || side.file,
    // The card area was settled when the package was made.
    template: side.cardArea ? { ...metadata, cardArea: side.cardArea } : metadata,
    // So were the fields; a side packaged without any is printed as drawn,
    // unless it says what its layers read.
    fields: side.fields?.length ? side.fields : mappings.length ? autoFields : [],
    mappings,
  }
}

function collectInputs(card: Omit<CardPackage, 'inputs' | 'sample'>): CardInput[] {
  const inputs = new Map<string, CardInput>()
  const add = (key: string, label: string, kind: CardInput['kind'], face: CardFace) => {
    const input = inputs.get(key) ?? { key, label, kind, faces: [] }
    if (!input.faces.includes(face)) input.faces.push(face)
    inputs.set(key, input)
  }
  for (const [face, side] of sidesOf(card)) {
    for (const field of side.fields) {
      const mapping = mappingFor(side, field)
      if (!mapping) {
        add(field.id, field.label || field.id, field.type === 'image' ? 'image' : 'text', face)
        continue
      }
      if (mapping.standardFieldName === CUSTOM_STATIC_VALUE) continue
      for (const key of personKeys(mapping.standardFieldName)) add(key, PERSON_FIELDS[key], IMAGE_KEYS.has(key) ? 'image' : 'text', face)
    }
  }
  if (card.variantField && card.variants && !inputs.has(card.variantField)) {
    inputs.set(card.variantField, { key: card.variantField, label: PERSON_FIELDS[card.variantField] ?? card.variantField, kind: 'text', faces: ['front'] })
  }
  const order = Object.keys(PERSON_FIELDS)
  const rank = (key: string) => (order.includes(key) ? order.indexOf(key) : order.length)
  return [...inputs.values()].sort((a, b) => rank(a.key) - rank(b.key))
}

function readSample(card: Omit<CardPackage, 'sample'>, sampleData: Record<string, string>): CardPerson {
  const person: CardPerson = {}
  for (const [, side] of sidesOf(card)) {
    for (const field of side.fields) {
      const value = sampleData[field.id]
      if (typeof value !== 'string' || !value.trim()) continue
      const mapping = mappingFor(side, field)
      if (!mapping) {
        person[field.id] ??= value
        continue
      }
      if (mapping.standardFieldName === CUSTOM_STATIC_VALUE) continue
      const keys = personKeys(mapping.standardFieldName)
      if (/^fullname/i.test(mapping.standardFieldName)) {
        for (const [key, part] of Object.entries(splitName(value, mapping.standardFieldName))) person[key] ??= part
      } else if (keys[0] && !(keys[0] === 'middleName' && /^middleinitial/i.test(mapping.standardFieldName))) {
        person[keys[0]] ??= value
      }
    }
  }
  return person
}

/** Every side of the card, variants' included, with the face each one prints on. */
function sidesOf(card: Pick<CardPackage, 'front' | 'back' | 'variants'>): Array<[CardFace, CardSideArtwork]> {
  const sides: Array<[CardFace, CardSideArtwork]> = [['front', card.front]]
  if (card.back) sides.push(['back', card.back])
  for (const variant of card.variants ?? []) {
    if (variant.front !== card.front) sides.push(['front', variant.front])
    if (variant.back && variant.back !== card.back) sides.push(['back', variant.back])
  }
  return sides
}

/**
 * Open a template package: read its sides, register its fonts with the page,
 * and work out what a person fills in.
 */
export async function openCardPackage(bytes: PackageBytes): Promise<CardPackage> {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes instanceof Uint8Array ? bytes.slice() : bytes])
  const loaded = await readTemplatePackage(blob)
  const fontCss: string[] = []
  for (const font of loaded.fonts) fontCss.push(await registerFont(font.name, font.file))

  const front = await loadSide(loaded.front)
  const back = loaded.back ? await loadSide(loaded.back) : undefined
  let variants: CardVariantArtwork[] | undefined
  if (loaded.variants) {
    variants = []
    for (const [index, variant] of loaded.variants.entries()) {
      // A variant packaged without mappings of its own takes the default's: variants mean the same thing.
      const variantFront = index === 0 && variant.front.file === loaded.front.file ? front : await loadSide(variant.front, front.mappings)
      const variantBack = variant.back ? (variant.back.file === loaded.back?.file ? back : await loadSide(variant.back, back?.mappings)) : undefined
      variants.push({ id: variant.id, name: variant.name, match: variant.match ?? [], front: variantFront, ...(variantBack ? { back: variantBack } : {}) })
    }
  }
  const card = {
    name: loaded.manifest.name,
    front,
    ...(back ? { back } : {}),
    ...(variants ? { variants, variantField: loaded.manifest.variantField } : {}),
    fonts: loaded.fonts.map((font) => font.name),
    missingFonts: loaded.manifest.missingFonts ?? [],
    fontCss: fontCss.join('\n'),
  }
  const withInputs = { ...card, inputs: collectInputs(card) }
  return { ...withInputs, sample: readSample(withInputs, loaded.manifest.sampleData ?? {}) }
}

/** The artwork a person's card prints on one face: their variant's, or the card's own. */
export function cardSideFor(card: CardPackage, face: CardFace, person: CardPerson = {}): CardSideArtwork | undefined {
  const value = card.variantField ? person[card.variantField]?.trim().toLowerCase() : ''
  const variant = value ? card.variants?.find((entry) => entry.match.some((candidate) => candidate.trim().toLowerCase() === value)) : undefined
  if (face === 'front') return variant?.front ?? card.front
  return variant?.back ?? card.back
}

/** The values one side's layers draw for a person. */
export function cardDataFor(side: CardSideArtwork, person: CardPerson): CardData {
  const data: CardData = {}
  for (const field of side.fields) {
    const mapping = mappingFor(side, field)
    if (mapping) {
      // Layers reading a field no person has (a logo) keep their artwork.
      if (mapping.standardFieldName !== CUSTOM_STATIC_VALUE && personKeys(mapping.standardFieldName).length === 0) continue
      data[field.id] = parseField(mapping.standardFieldName, person as unknown as UserData, mapping.customValue)
      continue
    }
    const value = person[field.id] ?? ''
    data[field.id] = field.type === 'image' ? (value ? { src: value } : '') : value
  }
  return data
}

/**
 * One face of a person's card as SVG markup. Previews leave out guides and
 * keep layers nobody filled as drawn; `production` draws it as it prints.
 */
export function renderCardSvg(card: CardPackage, face: CardFace, person: CardPerson, { production = false } = {}): string {
  const side = cardSideFor(card, face, person)
  if (!side) return ''
  return renderSvgWithData(side.template, side.fields, cardDataFor(side, person), production ? { mode: 'production' } : { mode: 'preview', guides: false })
}

const fontedTemplates = new WeakMap<TemplateMeta, TemplateMeta>()

/** The artwork with the package's fonts inside it, for drawing as an image. */
function withFonts(template: TemplateMeta, css: string): TemplateMeta {
  if (!css) return template
  const cached = fontedTemplates.get(template)
  if (cached) return cached
  const doc = new DOMParser().parseFromString(template.rawSvg, 'image/svg+xml')
  const style = doc.createElementNS(SVG_NS, 'style')
  style.textContent = css
  doc.documentElement.insertBefore(style, doc.documentElement.firstChild)
  const fonted = { ...template, rawSvg: new XMLSerializer().serializeToString(doc.documentElement) }
  fontedTemplates.set(template, fonted)
  return fonted
}

async function drawSide(card: CardPackage, side: CardSideArtwork, person: CardPerson, dpi: number): Promise<HTMLCanvasElement> {
  return renderCardToCanvas(withFonts(side.template, card.fontCss), side.fields, cardDataFor(side, person), dpi, null)
}

/** Turn a canvas a quarter turn, clockwise or (for a mirrored back) anticlockwise. */
function quarterTurn(source: HTMLCanvasElement, clockwise: boolean): HTMLCanvasElement {
  const turned = document.createElement('canvas')
  turned.width = source.height
  turned.height = source.width
  const context = turned.getContext('2d')
  if (!context) return source
  if (clockwise) context.translate(source.height, 0)
  else context.translate(0, source.width)
  context.rotate((clockwise ? 1 : -1) * Math.PI / 2)
  context.drawImage(source, 0, 0)
  return turned
}

function canvasPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The card could not be drawn.'))), 'image/png'))
}

export type CardPrintOptions = {
  /** Where cards go on the page. Without one, each card is a page of its own size. */
  layout?: PrintLayout | null
  /** Print the backs too: each page of fronts is followed by a page of backs. */
  faces?: 'front' | 'both'
  /**
   * Mirror each page of backs left to right, so a sheet printed on both sides
   * (flipped on its long edge) puts each back behind its front. Leave off for
   * card trays, which are fed again the same way round.
   */
  mirrorBacks?: boolean
  /** Raster resolution of the cards on the page. */
  dpi?: number
}

/**
 * A print-ready PDF of one card per person, in the layout's slots (or one per
 * page), with backs on the following pages when asked.
 */
export async function exportCardsPdf(card: CardPackage, people: CardPerson[], options: CardPrintOptions = {}): Promise<Uint8Array> {
  if (people.length === 0) throw new Error('Add at least one person to print.')
  const { layout = null, mirrorBacks = false, dpi = 300 } = options
  const faces: CardFace[] = options.faces === 'both' && card.back ? ['front', 'back'] : ['front']
  const pdf = await PDFDocument.create()
  pdf.setTitle(card.name)
  pdf.setCreator('Template Printer')

  if (!layout) {
    for (const person of people) {
      for (const face of faces) {
        const side = cardSideFor(card, face, person)
        if (!side) continue
        const { widthPoints, heightPoints } = getTemplateSizeInPoints(side.template)
        const image = await pdf.embedPng(await (await canvasPng(await drawSide(card, side, person, dpi))).arrayBuffer())
        pdf.addPage([widthPoints, heightPoints]).drawImage(image, { x: 0, y: 0, width: widthPoints, height: heightPoints })
      }
    }
    return pdf.save()
  }

  const pageWidth = parseFloat(layout.pageWidth) * POINTS_PER_INCH
  const pageHeight = parseFloat(layout.pageHeight) * POINTS_PER_INCH
  const pages = new Map<number, ReturnType<typeof calculateCardPositions>>()
  for (const position of calculateCardPositions(layout, people.length)) {
    pages.set(position.page, [...(pages.get(position.page) ?? []), position])
  }
  for (const slots of pages.values()) {
    for (const face of faces) {
      const page = pdf.addPage([pageWidth, pageHeight])
      const mirror = face === 'back' && mirrorBacks
      for (const slot of slots) {
        const person = people[slot.cardIndex]
        const side = cardSideFor(card, face, person)
        if (!side) continue
        const natural = getTemplateSizeInPoints(side.template)
        const rotate = cardNeedsRotation(natural.widthPoints, natural.heightPoints, slot.width, slot.height)
        const [width, height] = rotate ? [natural.heightPoints, natural.widthPoints] : [natural.widthPoints, natural.heightPoints]
        const scale = getSlotScale(side.template, width, height, slot)
        // Drawn at the resolution it lands on the page at, not the artwork's own size.
        let canvas = await drawSide(card, side, person, dpi * Math.min(4, Math.max(1, scale)))
        // A back flipped over the long edge turns the other way, so its top meets the front's.
        if (rotate) canvas = quarterTurn(canvas, !mirror)
        const image = await pdf.embedPng(await (await canvasPng(canvas)).arrayBuffer())
        const drawWidth = width * scale
        const drawHeight = height * scale
        const x = mirror ? pageWidth - slot.x - slot.width : slot.x
        page.drawImage(image, {
          x: x + (slot.width - drawWidth) / 2,
          y: pageHeight - slot.y - slot.height + (slot.height - drawHeight) / 2,
          width: drawWidth,
          height: drawHeight,
        })
      }
    }
  }
  return pdf.save()
}

/** One face of a person's card as a PNG, at the card's printed size. */
export async function exportCardPng(card: CardPackage, face: CardFace, person: CardPerson, { dpi = 300 } = {}): Promise<Blob> {
  const side = cardSideFor(card, face, person)
  if (!side) throw new Error(`This card has no ${face}.`)
  return canvasPng(await drawSide(card, side, person, dpi))
}

/** What kind of print a layout is, for grouping them: one card, a sheet of cards, or a card tray. */
export function printLayoutKind(layout: PrintLayout): 'card' | 'sheet' | 'tray' {
  if (layout.cardsPerPage === 1 && Math.abs(parseFloat(layout.pageWidth) - parseFloat(layout.cardWidth)) < 0.05) return 'card'
  return /tray|disc|cd\b/i.test(`${layout.name} ${layout.paperSize ?? ''} ${layout.printMedia ?? ''}`) ? 'tray' : 'sheet'
}

/** Rows of a CSV or tab-separated paste (a spreadsheet copies as tabs), quotes honoured. */
function readRows(text: string): string[][] {
  const delimiter = text.includes('\t') ? '\t' : ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index += 1 }
      else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"' && cell.trim() === '') { quoted = true; cell = '' }
    else if (char === delimiter) { row.push(cell.trim()); cell = '' }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1
      row.push(cell.trim()); cell = ''
      if (row.some(Boolean)) rows.push(row)
      row = []
    } else cell += char
  }
  row.push(cell.trim())
  if (row.some(Boolean)) rows.push(row)
  return rows
}

/**
 * People from a pasted list: one per line, columns in the order of the card's
 * text inputs, or in any order under a header row naming them ("First name",
 * "position"…). A "Name" or "Full name" column fills first and last name.
 */
export function parsePeople(text: string, inputs: CardInput[]): CardPerson[] {
  const rows = readRows(text)
  if (rows.length === 0) return []
  const simplify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
  const names = new Map<string, string>()
  for (const input of inputs) {
    names.set(simplify(input.key), input.key)
    names.set(simplify(input.label), input.key)
  }
  const hasNameParts = inputs.some((input) => input.key === 'firstName') && inputs.some((input) => input.key === 'lastName')
  if (hasNameParts) for (const alias of ['name', 'fullname']) names.set(alias, '#fullName')
  const header = rows[0].map((cell) => names.get(simplify(cell)) ?? null)
  const columns = header.some(Boolean) ? header : inputs.filter((input) => input.kind === 'text').map((input) => input.key)
  return rows.slice(header.some(Boolean) ? 1 : 0).map((row) => {
    const person: CardPerson = {}
    columns.forEach((key, index) => {
      const value = row[index]
      if (!key || !value) return
      if (key === '#fullName') Object.assign(person, splitName(value, 'fullName_First_Last'))
      else person[key] = value
    })
    return person
  })
}
