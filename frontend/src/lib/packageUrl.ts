/**
 * Opening a card design straight from a link.
 *
 *   https://example.com/template-printer/?url=https%3A%2F%2F…%2Fcard.zip
 *
 * The app fetches that package and opens it, so a design can be handed out as a
 * plain link that works on a phone and on a desktop, whether or not the person
 * has used the app before.
 */

export const PACKAGE_URL_PARAM = 'url'

/** Refuse anything larger, so a bad link cannot exhaust the device. */
export const MAX_PACKAGE_BYTES = 25 * 1024 * 1024

/** Give up rather than hang on a host that never answers. */
export const FETCH_TIMEOUT_MS = 30_000

/**
 * Read the package URL a link is asking for.
 *
 * Only http and https are accepted: a javascript: or data: URL here would be a
 * way to smuggle content past the checks the fetch path applies.
 */
export function readPackageUrl(search: string): string | null {
  let params: URLSearchParams
  try {
    params = new URLSearchParams(search)
  } catch {
    return null
  }

  const value = params.get(PACKAGE_URL_PARAM)?.trim()
  if (!value) return null

  let parsed: URL
  try {
    parsed = new URL(value, typeof window === 'undefined' ? undefined : window.location.href)
  } catch {
    return null
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
  return parsed.toString()
}

/** A readable name for where a package came from. */
export function describePackageSource(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

export type FetchedPackage = {
  blob: Blob
  /** SHA-256 of the bytes, used to recognise a package already opened. */
  hash: string
  url: string
}

async function hashBytes(buffer: ArrayBuffer): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    // Without a digest we simply cannot recognise a repeat; size is not an id.
    return ''
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Fetch a package, with a timeout and a size limit.
 *
 * Errors say what actually went wrong — a link that fails because the host
 * blocks cross-origin requests needs a different fix from one that 404s.
 */
export async function fetchPackage(url: string, signal?: AbortSignal): Promise<FetchedPackage> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  signal?.addEventListener('abort', () => controller.abort(), { once: true })

  let response: Response
  try {
    response = await fetch(url, { signal: controller.signal, redirect: 'follow' })
  } catch (error) {
    clearTimeout(timeout)
    if (controller.signal.aborted) {
      throw new Error(`Timed out fetching the package from ${describePackageSource(url)}.`)
    }
    // fetch gives no detail on a CORS refusal, but it is the usual cause.
    throw new Error(
      `Could not reach ${describePackageSource(url)}. If the package is on another site, that site has to allow cross-origin requests.`,
      { cause: error },
    )
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    throw new Error(`The package could not be downloaded (${response.status} ${response.statusText}).`)
  }

  const declaredLength = Number(response.headers.get('content-length') ?? '')
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PACKAGE_BYTES) {
    throw new Error(`That package is larger than the ${Math.round(MAX_PACKAGE_BYTES / 1024 / 1024)} MB limit.`)
  }

  const buffer = await response.arrayBuffer()
  if (buffer.byteLength > MAX_PACKAGE_BYTES) {
    throw new Error(`That package is larger than the ${Math.round(MAX_PACKAGE_BYTES / 1024 / 1024)} MB limit.`)
  }

  return {
    blob: new Blob([buffer], { type: 'application/zip' }),
    hash: await hashBytes(buffer),
    url,
  }
}

const IMPORT_RECORD_KEY = 'template-printer.opened-packages'

export type OpenedPackageRecord = {
  hash: string
  frontTemplateId: string
  backTemplateId?: string | null
  designId?: string | null
  name: string
  openedAt: string
}

/**
 * Packages this browser has already opened.
 *
 * Someone who follows the same link twice should land back on the design they
 * already have, not accumulate a second copy of it.
 */
function readRecords(): Record<string, OpenedPackageRecord> {
  try {
    const raw = localStorage.getItem(IMPORT_RECORD_KEY)
    return raw ? (JSON.parse(raw) as Record<string, OpenedPackageRecord>) : {}
  } catch {
    // Private browsing, blocked storage, or corrupt JSON: treat as none seen.
    return {}
  }
}

export function recallOpenedPackage(hash: string): OpenedPackageRecord | null {
  if (!hash) return null
  return readRecords()[hash] ?? null
}

export function rememberOpenedPackage(record: OpenedPackageRecord): void {
  if (!record.hash) return
  try {
    const records = readRecords()
    records[record.hash] = record
    localStorage.setItem(IMPORT_RECORD_KEY, JSON.stringify(records))
  } catch {
    // Not being able to remember only costs a duplicate next time.
  }
}

export function forgetOpenedPackage(hash: string): void {
  if (!hash) return
  try {
    const records = readRecords()
    delete records[hash]
    localStorage.setItem(IMPORT_RECORD_KEY, JSON.stringify(records))
  } catch {
    // Nothing to do.
  }
}

/**
 * Take the parameter out of the address bar once it has been dealt with, so a
 * refresh does not fetch it all over again.
 */
export function clearPackageUrlFromLocation(): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.delete(PACKAGE_URL_PARAM)
  window.history.replaceState(null, '', url.toString())
}
