import type { ColorProfile } from './exportUtils'

/**
 * Apply color corrections from a calibration profile to an SVG string.
 * This adjusts colors to compensate for printer color drift.
 */
export function applyColorCorrection(svgString: string, profile: ColorProfile): string {
  if (!profile.adjustments || Object.keys(profile.adjustments).length === 0) {
    return svgString
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')
  const svg = doc.documentElement

  // Color attributes to check
  const colorAttrs = ['fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color']

  // Process all elements
  const allElements = svg.querySelectorAll('*')
  allElements.forEach((el) => {
    colorAttrs.forEach((attr) => {
      const value = el.getAttribute(attr)
      if (value && value !== 'none' && value !== 'transparent') {
        const correctedColor = correctColor(value, profile.adjustments)
        if (correctedColor !== value) {
          el.setAttribute(attr, correctedColor)
        }
      }
    })

    // Check inline styles
    const style = el.getAttribute('style')
    if (style) {
      let newStyle = style
      colorAttrs.forEach((attr) => {
        const regex = new RegExp(`${attr}\\s*:\\s*([^;]+)`, 'gi')
        newStyle = newStyle.replace(regex, (match, colorValue) => {
          const corrected = correctColor(colorValue.trim(), profile.adjustments)
          return `${attr}: ${corrected}`
        })
      })
      if (newStyle !== style) {
        el.setAttribute('style', newStyle)
      }
    }
  })

  const serializer = new XMLSerializer()
  return serializer.serializeToString(svg)
}

/**
 * Correct a single color value using the profile adjustments.
 * The profile stores the DIFFERENCE between expected and printed colors,
 * so we need to REVERSE the adjustment to compensate.
 */
function correctColor(
  colorValue: string,
  adjustments: Record<string, { r: number; g: number; b: number }>
): string {
  // Normalize the color to hex format
  const hex = normalizeToHex(colorValue)
  if (!hex) return colorValue

  // Check if we have an exact match in the profile
  const normalizedHex = hex.toUpperCase()
  const adjustment = adjustments[normalizedHex] || adjustments[hex.toLowerCase()]

  if (adjustment) {
    // Apply INVERSE adjustment to compensate for printer drift
    // If printed red is +10 off, we need to send -10 to get the right result
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)

    const correctedR = Math.max(0, Math.min(255, r - adjustment.r))
    const correctedG = Math.max(0, Math.min(255, g - adjustment.g))
    const correctedB = Math.max(0, Math.min(255, b - adjustment.b))

    return `#${correctedR.toString(16).padStart(2, '0')}${correctedG.toString(16).padStart(2, '0')}${correctedB.toString(16).padStart(2, '0')}`
  }

  // If no exact match, find the closest color in the profile and interpolate
  const closestMatch = findClosestColor(hex, adjustments)
  if (closestMatch) {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)

    const correctedR = Math.max(0, Math.min(255, r - closestMatch.adjustment.r))
    const correctedG = Math.max(0, Math.min(255, g - closestMatch.adjustment.g))
    const correctedB = Math.max(0, Math.min(255, b - closestMatch.adjustment.b))

    return `#${correctedR.toString(16).padStart(2, '0')}${correctedG.toString(16).padStart(2, '0')}${correctedB.toString(16).padStart(2, '0')}`
  }

  return colorValue
}

/**
 * Convert various color formats to hex
 */
function normalizeToHex(color: string): string | null {
  const trimmed = color.trim().toLowerCase()

  // Already hex
  if (trimmed.match(/^#[0-9a-f]{6}$/i)) {
    return trimmed
  }

  // Short hex (#rgb -> #rrggbb)
  if (trimmed.match(/^#[0-9a-f]{3}$/i)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`
  }

  // rgb(r, g, b)
  const rgbMatch = trimmed.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/)
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1])
    const g = parseInt(rgbMatch[2])
    const b = parseInt(rgbMatch[3])
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }

  // Named colors (basic ones)
  const namedColors: Record<string, string> = {
    black: '#000000',
    white: '#ffffff',
    red: '#ff0000',
    green: '#008000',
    blue: '#0000ff',
    yellow: '#ffff00',
    cyan: '#00ffff',
    magenta: '#ff00ff',
    gray: '#808080',
    grey: '#808080',
  }

  if (namedColors[trimmed]) {
    return namedColors[trimmed]
  }

  return null
}

/**
 * Find the closest color in the adjustments map using Euclidean distance
 */
function findClosestColor(
  targetHex: string,
  adjustments: Record<string, { r: number; g: number; b: number }>
): { color: string; adjustment: { r: number; g: number; b: number }; distance: number } | null {
  const targetR = parseInt(targetHex.slice(1, 3), 16)
  const targetG = parseInt(targetHex.slice(3, 5), 16)
  const targetB = parseInt(targetHex.slice(5, 7), 16)

  let closest: { color: string; adjustment: { r: number; g: number; b: number }; distance: number } | null = null
  const maxDistance = 50 // Only match if reasonably close

  for (const [color, adjustment] of Object.entries(adjustments)) {
    const normalized = normalizeToHex(color)
    if (!normalized) continue

    const r = parseInt(normalized.slice(1, 3), 16)
    const g = parseInt(normalized.slice(3, 5), 16)
    const b = parseInt(normalized.slice(5, 7), 16)

    const distance = Math.sqrt(
      Math.pow(targetR - r, 2) +
      Math.pow(targetG - g, 2) +
      Math.pow(targetB - b, 2)
    )

    if (distance < maxDistance && (!closest || distance < closest.distance)) {
      closest = { color, adjustment, distance }
    }
  }

  return closest
}
