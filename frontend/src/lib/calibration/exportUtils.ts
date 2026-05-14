import { generateArucoMarker, generateArucoSVG } from './aruco'
import type { TemplateMeta } from '../types'
import { getSwatchPosition, getSwatchSlotCount, type CardLayout } from './layoutCalculator'

export interface TestPrintConfig {
  version: string
  name: string
  created: string
  settings: {
    useArucoMarkers: boolean
    margin: number
  }
  colorChart: string[]
  metadata: {
    cardDimensions: {
      width: number
      height: number
    }
    layout: CardLayout
  }
}

export interface ColorProfile {
  id: string
  name: string
  device: string
  createdAt?: string
  created?: string
  updatedAt?: string
  adjustments: Record<string, { r: number; g: number; b: number }>
}

const SVG_SCALE = 10
const EMPTY_SWATCH_COLOR = '#E5E7EB'
const PROFILE_SWATCH_KEY_SEPARATOR = '@swatch-'

export function normalizeProfileAdjustmentColor(color: string): string | null {
  const trimmed = color.trim()
  const hex = trimmed.match(/^#?([0-9a-f]{6})$/i)
  if (!hex) return null
  return `#${hex[1].toUpperCase()}`
}

export function createProfileAdjustmentKey(color: string, swatchIndex: number): string {
  const normalizedColor = normalizeProfileAdjustmentColor(color) ?? color.trim()
  return `${normalizedColor}${PROFILE_SWATCH_KEY_SEPARATOR}${swatchIndex + 1}`
}

export function getProfileAdjustmentBaseColor(key: string): string {
  const baseColor = key.split(PROFILE_SWATCH_KEY_SEPARATOR)[0]
  return normalizeProfileAdjustmentColor(baseColor) ?? baseColor
}

export function exportTestPrint(
  useArucoMarkers: boolean,
  margin: number,
  colorChart: string[],
  cardLayout: CardLayout
): void {
  const config: TestPrintConfig = {
    version: "1.3",
    name: `Test Print ${new Date().toLocaleDateString()}`,
    created: new Date().toISOString(),
    settings: {
      useArucoMarkers,
      margin
    },
    colorChart,
    metadata: {
      cardDimensions: {
        width: 85.6,
        height: 54
      },
      layout: cardLayout
    }
  }

  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `test-print-config-${Date.now()}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function importTestPrint(
  file: File,
  onSuccess: (config: TestPrintConfig) => void,
  onError: (error: string) => void
): void {
  const reader = new FileReader()
  reader.onload = (event) => {
    try {
      const config: TestPrintConfig = JSON.parse(event.target?.result as string)
      onSuccess(config)
    } catch (error) {
      console.error('Error importing config:', error)
      onError('Invalid configuration file. Please check the file format.')
    }
  }
  reader.readAsText(file)
}

export function exportProfiles(profiles: ColorProfile[]): void {
  const data = {
    version: "1.0",
    exported: new Date().toISOString(),
    profiles
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `color-profiles-${Date.now()}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function importProfiles(
  file: File,
  onSuccess: (profiles: ColorProfile[]) => void,
  onError: (error: string) => void
): void {
  const reader = new FileReader()
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target?.result as string)

      if (data.version !== "1.0") {
        onError("Unsupported profile format. Please use a newer version of this tool.")
        return
      }

      const importedProfiles: ColorProfile[] = data.profiles
      onSuccess(importedProfiles)
    } catch (error) {
      console.error('Error importing profiles:', error)
      onError('Invalid profile file. Please check the file format.')
    }
  }
  reader.readAsText(file)
}

export function generateSVG(
  cardLayout: CardLayout,
  colorChart: string[],
  useArucoMarkers: boolean
): void {
  const svgContent = buildColorChartSvgMarkup(cardLayout, colorChart, useArucoMarkers)

  const blob = new Blob([svgContent], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'color-swatch-chart.svg'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export async function renderColorChartToPngDataUrl(
  cardLayout: CardLayout,
  colorChart: string[],
  useArucoMarkers: boolean,
  scale: number = SVG_SCALE
): Promise<string> {
  const svgContent = buildColorChartSvgMarkup(cardLayout, colorChart, useArucoMarkers, scale)
  const svgBlob = new Blob([svgContent], { type: 'image/svg+xml' })
  const svgUrl = URL.createObjectURL(svgBlob)

  try {
    const img = new Image()
    const imageLoaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Unable to render calibration chart export.'))
    })

    img.src = svgUrl
    await imageLoaded

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(cardLayout.cardWidth * scale)
    canvas.height = Math.round(cardLayout.cardHeight * scale)

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Unable to create canvas for calibration chart export.')
    }

    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}

export async function generatePNG(
  cardLayout: CardLayout,
  colorChart: string[],
  useArucoMarkers: boolean
): Promise<void> {
  try {
    const pngDataUrl = await renderColorChartToPngDataUrl(cardLayout, colorChart, useArucoMarkers)
    const link = document.createElement('a')
    link.href = pngDataUrl
    link.download = 'color-swatch-chart.png'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (error) {
    console.error('Error generating PNG:', error)
    alert('Error generating PNG. Please try again.')
  }
}

export async function generatePDF(
  cardLayout: CardLayout,
  colorChart: string[],
  useArucoMarkers: boolean
): Promise<void> {
  try {
    const { default: jsPDF } = await import('jspdf')

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [cardLayout.cardWidth, cardLayout.cardHeight] // CR80 card size
    })

    // Add white background
    pdf.setFillColor(255, 255, 255)
    pdf.rect(0, 0, cardLayout.cardWidth, cardLayout.cardHeight, 'F')

    // Add swatches, preserving empty slots so the export matches the preview.
    Array.from({ length: getSwatchSlotCount(cardLayout) }, (_, index) => {
      const pos = getSwatchPosition(cardLayout, index)
      if (!pos) return // Skip colors that don't fit
      const color = colorChart[index]

      if (color) {
        const rgb = hexToRgb(color)
        pdf.setFillColor(rgb.r, rgb.g, rgb.b)
      } else {
        pdf.setFillColor(229, 231, 235) // #E5E7EB
      }

      pdf.rect(pos.x, pos.y, pos.width, pos.height, 'F')
    })

    // Add ArUco markers
    if (useArucoMarkers) {
      cardLayout.markerPositions.forEach(pos => {
        const marker = generateArucoMarker(pos.id, 100) // Generate at high resolution
        const cellSize = pos.size / marker.matrix.length

        marker.matrix.forEach((row, i) => {
          row.forEach((cell, j) => {
            const x = pos.x + (j * cellSize)
            const y = pos.y + (i * cellSize)

            pdf.setFillColor(cell === 1 ? 255 : 0, cell === 1 ? 255 : 0, cell === 1 ? 255 : 0)
            pdf.rect(x, y, cellSize, cellSize, 'F')
          })
        })
      })
    }

    pdf.save('color-swatch-chart.pdf')
  } catch (error) {
    console.error('Error generating PDF:', error)
    alert('Error generating PDF. Please try again.')
  }
}

export function buildColorChartSvgMarkup(
  cardLayout: CardLayout,
  colorChart: string[],
  useArucoMarkers: boolean,
  scale: number = SVG_SCALE
): string {
  const svgWidth = cardLayout.cardWidth * scale
  const svgHeight = cardLayout.cardHeight * scale

  const arucoMarkers = useArucoMarkers
    ? cardLayout.markerPositions.map((pos) => {
      const marker = generateArucoMarker(pos.id, pos.size * scale)
      const markerSVG = generateArucoSVG(marker)
      return `<g transform="translate(${pos.x * scale}, ${pos.y * scale})">${markerSVG}</g>`
    }).join('')
    : ''

  const swatches = Array.from({ length: getSwatchSlotCount(cardLayout) }, (_, index) => {
    const pos = getSwatchPosition(cardLayout, index)
    if (!pos) return ''
    const color = colorChart[index] || EMPTY_SWATCH_COLOR
    return `<rect x="${pos.x * scale}" y="${pos.y * scale}" width="${pos.width * scale}" height="${pos.height * scale}" fill="${color}" />`
  }).filter(Boolean).join('')

  return `
    <svg
      width="${svgWidth}"
      height="${svgHeight}"
      viewBox="0 0 ${svgWidth} ${svgHeight}"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="100%" height="100%" fill="white"/>
      ${swatches}
      ${arucoMarkers}
    </svg>
  `
}

export function createColorChartTemplate(
  cardLayout: CardLayout,
  colorChart: string[],
  useArucoMarkers: boolean
): TemplateMeta {
  return {
    name: 'color-swatch-chart.svg',
    width: cardLayout.cardWidth,
    height: cardLayout.cardHeight,
    unit: 'mm',
    viewBox: {
      x: 0,
      y: 0,
      width: cardLayout.cardWidth * SVG_SCALE,
      height: cardLayout.cardHeight * SVG_SCALE,
    },
    rawSvg: buildColorChartSvgMarkup(cardLayout, colorChart, useArucoMarkers),
    objectUrl: '',
    fonts: [],
  }
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { r, g, b }
}
