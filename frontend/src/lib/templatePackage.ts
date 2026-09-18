/**
 * A card design packaged as a single file.
 *
 * A share link carries the artwork and its field mappings, but not the fonts —
 * they would dwarf the link. A package is the heavier alternative: a zip with
 * the design, what the fields mean, and the font files it needs, so opening it
 * on another machine does not mean hunting down the fonts again.
 *
 *   manifest.json     what the package holds, and what each layer means
 *   front.svg         the artwork
 *   back.svg          the other side, when there is one
 *   fonts/…           the font files the artwork asks for
 */

import JSZip from 'jszip'

import type { FieldDefinition, TemplateMeta } from './types'
import type { FieldMapping, FontData } from './api'

export const PACKAGE_FORMAT = 'template-printer-package'
export const PACKAGE_VERSION = 1

export type PackagedSide = {
  /** Path to the artwork inside the zip. */
  file: string
  /** Template name, used when the package is opened. */
  name: string
  fields: FieldDefinition[]
  mappings: FieldMapping[]
  /** Preserved so the card keeps its printed size and trim line. */
  cardArea?: TemplateMeta['cardArea']
}

export type PackagedFont = {
  /** The family the artwork asks for, which is how it is registered on import. */
  name: string
  file: string
  fileName: string
  mimeType: string
}

export type TemplatePackageManifest = {
  format: typeof PACKAGE_FORMAT
  version: number
  createdAt: string
  /** Name for the card design created when the package is opened. */
  name: string
  sides: { front: PackagedSide; back?: PackagedSide }
  fonts: PackagedFont[]
  /** Sample values, so the package previews as it did when it was made. */
  sampleData?: Record<string, string>
  /** Fonts the artwork asks for that were not available to package. */
  missingFonts?: string[]
}

export type PackageSideInput = {
  template: TemplateMeta
  fields: FieldDefinition[]
  mappings: FieldMapping[]
}

export type CreatePackageInput = {
  name: string
  front: PackageSideInput
  back?: PackageSideInput | null
  /** Every font held in storage; only the ones the artwork uses are packaged. */
  availableFonts: FontData[]
  sampleData?: Record<string, string>
}

function sanitiseFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'font'
}

function extensionFor(font: FontData): string {
  const fromName = /\.([a-z0-9]+)$/i.exec(font.fileName)?.[1]
  if (fromName) return fromName.toLowerCase()
  if (/woff2/i.test(font.mimeType)) return 'woff2'
  if (/woff/i.test(font.mimeType)) return 'woff'
  if (/otf|opentype/i.test(font.mimeType)) return 'otf'
  return 'ttf'
}

const FONT_MIME_TYPES: Record<string, string> = {
  otf: 'font/otf',
  ttf: 'font/ttf',
  woff: 'font/woff',
  woff2: 'font/woff2',
}

/**
 * Browsers guess the type of a font file from its extension and often get it
 * wrong — .otf commonly comes back as an OpenDocument type. Trust the
 * extension, which is what actually identifies the format.
 */
function fontMimeType(extension: string, reported: string): string {
  const known = FONT_MIME_TYPES[extension]
  if (known) return known
  return reported && reported.startsWith('font/') ? reported : 'font/ttf'
}

/** Decode the base64 a font is stored as. */
function decodeBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function sideManifest(file: string, input: PackageSideInput): PackagedSide {
  return {
    file,
    name: input.template.name,
    fields: input.fields,
    mappings: input.mappings,
    cardArea: input.template.cardArea,
  }
}

/**
 * Build a package from the design currently open.
 *
 * Only fonts the artwork actually asks for are included, and any it asks for
 * that are not loaded are recorded so the package can say what is missing
 * rather than silently dropping them.
 */
export async function createTemplatePackage(input: CreatePackageInput): Promise<{
  blob: Blob
  manifest: TemplatePackageManifest
}> {
  const zip = new JSZip()

  zip.file('front.svg', input.front.template.rawSvg)
  if (input.back) zip.file('back.svg', input.back.template.rawSvg)

  const required = new Set<string>([
    ...input.front.template.fonts,
    ...(input.back?.template.fonts ?? []),
  ])
  for (const side of [input.front, input.back]) {
    for (const field of side?.fields ?? []) {
      // A barcode layer is replaced by drawn bars, so whatever font its
      // placeholder used is never rendered and does not need packaging.
      if (field.type === 'barcode') continue
      if (field.fontFamily) required.add(field.fontFamily)
    }
  }

  const byName = new Map(input.availableFonts.map((font) => [font.fontName, font]))
  const fonts: PackagedFont[] = []
  const missingFonts: string[] = []
  const usedPaths = new Set<string>()

  for (const name of required) {
    const font = byName.get(name)
    if (!font) {
      missingFonts.push(name)
      continue
    }

    const extension = extensionFor(font)
    let path = `fonts/${sanitiseFileName(name)}.${extension}`
    let suffix = 2
    while (usedPaths.has(path)) {
      path = `fonts/${sanitiseFileName(name)}-${suffix}.${extension}`
      suffix += 1
    }
    usedPaths.add(path)

    zip.file(path, decodeBase64(font.fontData))
    fonts.push({
      name,
      file: path,
      fileName: font.fileName,
      mimeType: fontMimeType(extension, font.mimeType),
    })
  }

  const manifest: TemplatePackageManifest = {
    format: PACKAGE_FORMAT,
    version: PACKAGE_VERSION,
    createdAt: new Date().toISOString(),
    name: input.name,
    sides: {
      front: sideManifest('front.svg', input.front),
      ...(input.back ? { back: sideManifest('back.svg', input.back) } : {}),
    },
    fonts,
    sampleData: input.sampleData && Object.keys(input.sampleData).length > 0 ? input.sampleData : undefined,
    missingFonts: missingFonts.length > 0 ? missingFonts : undefined,
  }

  zip.file('manifest.json', JSON.stringify(manifest, null, 2))

  return {
    blob: await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }),
    manifest,
  }
}

export type LoadedPackageSide = PackagedSide & { svg: string }

export type LoadedPackage = {
  manifest: TemplatePackageManifest
  front: LoadedPackageSide
  back?: LoadedPackageSide
  /** Font files, ready to register under the name the artwork asks for. */
  fonts: Array<{ name: string; file: File }>
}

/** Whether a file looks like a package rather than a bare SVG. */
export function isTemplatePackage(file: File): boolean {
  return /\.zip$/i.test(file.name) || file.type === 'application/zip' || file.type === 'application/x-zip-compressed'
}

/**
 * Read a package back.
 *
 * Throws with something readable when the file is not one, rather than failing
 * somewhere further in.
 */
export async function readTemplatePackage(file: Blob): Promise<LoadedPackage> {
  let zip: JSZip
  try {
    // Hand JSZip the bytes rather than the Blob: what counts as a Blob differs
    // between the browser and Node, and the bytes do not.
    zip = await JSZip.loadAsync(await file.arrayBuffer())
  } catch {
    throw new Error('That file is not a template package.')
  }

  const manifestFile = zip.file('manifest.json')
  if (!manifestFile) {
    throw new Error('That zip has no manifest.json, so it is not a template package.')
  }

  let manifest: TemplatePackageManifest
  try {
    manifest = JSON.parse(await manifestFile.async('string'))
  } catch {
    throw new Error("The package's manifest could not be read.")
  }

  if (manifest.format !== PACKAGE_FORMAT) {
    throw new Error('That zip is not a template package.')
  }
  if (typeof manifest.version === 'number' && manifest.version > PACKAGE_VERSION) {
    throw new Error('This package was made by a newer version of Template Printer.')
  }
  if (!manifest.sides?.front?.file) {
    throw new Error('The package does not contain a front design.')
  }

  const readSide = async (side: PackagedSide | undefined): Promise<LoadedPackageSide | undefined> => {
    if (!side) return undefined
    const entry = zip.file(side.file)
    if (!entry) throw new Error(`The package is missing ${side.file}.`)
    return { ...side, svg: await entry.async('string') }
  }

  const front = await readSide(manifest.sides.front)
  if (!front) throw new Error('The package does not contain a front design.')

  const fonts: LoadedPackage['fonts'] = []
  for (const font of manifest.fonts ?? []) {
    const entry = zip.file(font.file)
    if (!entry) continue
    const blob = await entry.async('blob')
    fonts.push({
      name: font.name,
      file: new File([blob], font.fileName || font.file.split('/').pop() || font.name, {
        type: font.mimeType || 'font/ttf',
      }),
    })
  }

  return { manifest, front, back: await readSide(manifest.sides.back), fonts }
}

/** A file name for a package. */
export function packageFileName(name: string): string {
  return `${sanitiseFileName(name.replace(/\.svg$/i, '')) || 'card-design'}.zip`
}
