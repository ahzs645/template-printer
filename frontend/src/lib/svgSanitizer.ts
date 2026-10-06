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
  // <use> is how Illustrator places a symbol or an image it embeds once and
  // draws several times — watermarks, logos. DOMPurify drops it outright
  // because it can pull in another document. It is kept here only when it
  // points inside the same file; anything else loses its reference.
  purifier.addHook('uponSanitizeAttribute', (node, data) => {
    if (node.nodeName.toLowerCase() !== 'use') return
    if (data.attrName !== 'href' && data.attrName !== 'xlink:href') return
    if (!data.attrValue.trim().startsWith('#')) data.keepAttr = false
  })
  purifier.addHook('afterSanitizeAttributes', (node) => {
    if (node.nodeName.toLowerCase() !== 'use') return
    const element = node as Element
    if (!element.getAttribute('href') && !element.getAttribute('xlink:href')) element.remove()
  })
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
  // Internal references only; see the hooks in getPurifier().
  ADD_TAGS: ['use'],
}

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
