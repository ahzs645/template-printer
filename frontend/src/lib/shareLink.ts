/**
 * Share a template as a self-contained link.
 *
 * The whole template — the SVG, its field definitions and its field mappings —
 * is compressed into a URL-safe string and carried in the location hash, so a
 * link works against a purely static deployment with no server and no upload.
 *
 * Two links are produced for every template:
 *
 * - **view** opens the template read-only, for someone who just needs to look
 *   at it or export a card from it.
 * - **edit** opens it ready to be changed and saved into the recipient's own
 *   template library.
 *
 * The mode is a UI affordance, not an access control: a view link carries the
 * same payload as an edit link, and anyone holding either one can decode it.
 * Do not put anything confidential in a shared template.
 */

import { sanitizeSvgMarkup } from './svgSanitizer'
import type { FieldDefinition } from './types'
import type { FieldMapping } from './api'

/** lzma gives roughly 2-5x better compression than the alternatives on SVG. */
const CODEC = 'lzma'

const SHARE_PATH = '/share/'

export type ShareMode = 'view' | 'edit'

export const SHARE_MODES: ShareMode[] = ['view', 'edit']

/**
 * Links longer than this are accepted but flagged: some chat clients, mail
 * gateways and server access logs truncate around 8k.
 */
export const SHARE_URL_WARN_LENGTH = 8000

/**
 * Links longer than this are refused. Browsers themselves handle far more, but
 * past ~32k a link stops being something you can paste anywhere useful.
 */
export const SHARE_URL_MAX_LENGTH = 32000

/** Payload format version, so older links can be recognised rather than crash. */
export const SHARE_PAYLOAD_VERSION = 1

export type SharedTemplatePayload = {
  /** Payload format version. */
  v: number
  /** Template name, used when the recipient saves it to their library. */
  name: string
  /** The raw SVG source. */
  svg: string
  /** Field definitions, including any manual edits to position or styling. */
  fields?: FieldDefinition[]
  /** SVG layer id -> standard field name. */
  mappings?: FieldMapping[]
  /** Sample text values, keyed by field id. Images are deliberately excluded. */
  sampleData?: Record<string, string>
}

export type ShareTarget = {
  mode: ShareMode
  payload: string
}

type Codec = {
  compress<T>(value: T): Promise<string>
  decompress<T>(compressed: string): Promise<T>
}

let codecPromise: Promise<Codec> | null = null

/**
 * Load the compressor on first use. It pulls in an LZMA implementation that is
 * a sizeable chunk of the bundle, and most sessions never share a template.
 */
function getCodec(): Promise<Codec> {
  if (!codecPromise) {
    codecPromise = import('json-url').then((module) => module.default(CODEC))
  }
  return codecPromise
}

/**
 * Compress a template into the URL-safe payload string.
 */
export async function encodeSharedTemplate(payload: SharedTemplatePayload): Promise<string> {
  const codec = await getCodec()
  return codec.compress(payload)
}

/**
 * Expand a payload string back into a template.
 *
 * Throws when the string is not a valid payload, or was produced by a newer
 * version of the format.
 */
export async function decodeSharedTemplate(payload: string): Promise<SharedTemplatePayload> {
  let decoded: SharedTemplatePayload
  try {
    const codec = await getCodec()
    decoded = await codec.decompress<SharedTemplatePayload>(payload)
  } catch {
    throw new Error('This share link is not readable. It may have been truncated when it was copied.')
  }

  if (!decoded || typeof decoded !== 'object' || typeof decoded.svg !== 'string') {
    throw new Error('This share link does not contain a template.')
  }

  if (typeof decoded.v === 'number' && decoded.v > SHARE_PAYLOAD_VERSION) {
    throw new Error('This share link was created by a newer version of Template Printer.')
  }

  // Anyone can hand out a link, so the artwork in it is untrusted.
  return { ...decoded, svg: sanitizeSvgMarkup(decoded.svg) }
}

/**
 * Strip any existing share fragment off a URL so share links never nest.
 */
function getShareBaseUrl(href: string): string {
  const url = new URL(href)
  url.hash = ''
  return url.toString()
}

/**
 * Build the full shareable URL for a payload.
 */
export function buildShareUrl(payload: string, mode: ShareMode, href: string): string {
  return `${getShareBaseUrl(href)}#${SHARE_PATH}${mode}/${payload}`
}

/**
 * Read a share target out of a location hash, or null when there isn't one.
 */
export function readShareTarget(hash: string): ShareTarget | null {
  const withoutHash = hash.startsWith('#') ? hash.slice(1) : hash
  if (!withoutHash.startsWith(SHARE_PATH)) return null

  const rest = withoutHash.slice(SHARE_PATH.length)
  const separator = rest.indexOf('/')
  if (separator <= 0) return null

  const mode = rest.slice(0, separator)
  const payload = rest.slice(separator + 1)
  if (!payload) return null
  if (mode !== 'view' && mode !== 'edit') return null

  return { mode, payload }
}

/**
 * Remove the share fragment from the address bar without reloading, so a
 * refresh after the template has been imported doesn't re-import it.
 */
export function clearShareTarget(): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.hash = ''
  window.history.replaceState(null, '', url.toString())
}

export type ShareLinkSet = {
  payload: string
  view: string
  edit: string
  /** Length of the longer of the two links. */
  length: number
  /** True once the link is long enough that some clients will mangle it. */
  isLong: boolean
  /** True when the link is too long to be worth sharing at all. */
  isTooLong: boolean
}

/**
 * Compress a template and build both links for it.
 */
export async function createShareLinks(
  payload: SharedTemplatePayload,
  href: string,
): Promise<ShareLinkSet> {
  const compressed = await encodeSharedTemplate(payload)
  const view = buildShareUrl(compressed, 'view', href)
  const edit = buildShareUrl(compressed, 'edit', href)
  const length = Math.max(view.length, edit.length)

  return {
    payload: compressed,
    view,
    edit,
    length,
    isLong: length > SHARE_URL_WARN_LENGTH,
    isTooLong: length > SHARE_URL_MAX_LENGTH,
  }
}

/**
 * Build the payload for the template currently open in the editor.
 *
 * Image values are dropped: a shared photo would be a base64 blob that dwarfs
 * the template itself, and the recipient's own user records supply it anyway.
 */
export function buildSharedTemplatePayload(options: {
  name: string
  svg: string
  fields: FieldDefinition[]
  mappings: FieldMapping[]
  cardData?: Record<string, unknown>
}): SharedTemplatePayload {
  const sampleData: Record<string, string> = {}
  for (const [key, value] of Object.entries(options.cardData ?? {})) {
    if (typeof value === 'string' && value.trim().length > 0) {
      sampleData[key] = value
    }
  }

  return {
    v: SHARE_PAYLOAD_VERSION,
    name: options.name,
    svg: options.svg,
    fields: options.fields,
    mappings: options.mappings,
    sampleData: Object.keys(sampleData).length > 0 ? sampleData : undefined,
  }
}
