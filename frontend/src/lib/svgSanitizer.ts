/**
 * Cleaning SVG that came from somewhere we do not control.
 *
 * A template can arrive from a share link or from a `?url=` package, and it is
 * injected into the page rather than sandboxed in an <img>. SVG is a document
 * format: it can carry <script>, event handlers, javascript: links and nested
 * iframes, all of which would run with the app's own origin.
 *
 * Everything the import pipeline depends on survives — <style> blocks and their
 * rules, tspans, classes, ids, clip paths and <image> placeholders.
 */

import createDOMPurify from 'dompurify'

type Purifier = ReturnType<typeof createDOMPurify>

let purifier: Purifier | null = null

function getPurifier(): Purifier | null {
  if (purifier) return purifier
  if (typeof window === 'undefined') return null
  purifier = createDOMPurify(window)
  return purifier
}

/**
 * Whether the sanitiser can run here.
 *
 * DOMPurify needs a real DOM. Where it cannot run it returns its input
 * unchanged, which would silently hand untrusted markup straight through — so
 * callers must check this rather than trusting the return value.
 */
export function isSanitizerAvailable(): boolean {
  const instance = getPurifier()
  return Boolean(instance?.isSupported)
}

const SANITIZE_OPTIONS = {
  USE_PROFILES: { svg: true, svgFilters: true },
} as const

/**
 * Strip anything executable out of SVG markup.
 *
 * Throws when the sanitiser is unavailable: refusing to open a template is the
 * right failure, since the alternative is injecting unchecked markup.
 */
export function sanitizeSvgMarkup(markup: string): string {
  const instance = getPurifier()
  if (!instance?.isSupported) {
    throw new Error('This browser cannot check the template for unsafe content, so it was not opened.')
  }
  return instance.sanitize(markup, SANITIZE_OPTIONS)
}

/**
 * Sanitise, and report whether anything was taken out.
 *
 * The comparison is deliberately coarse — the sanitiser also normalises markup —
 * so it is only used to tell someone their file was altered, never as a check.
 */
export function sanitizeSvgWithReport(markup: string): { svg: string; changed: boolean } {
  const svg = sanitizeSvgMarkup(markup)
  const hadExecutableContent = /<script|\son\w+\s*=|javascript:|<foreignObject|<iframe/i.test(markup)
  return { svg, changed: hadExecutableContent }
}
