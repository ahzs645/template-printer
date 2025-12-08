import { generateArucoMarker, generateArucoSVG } from './aruco'
import { getSwatchPosition, type CardLayout } from './layoutCalculator'

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
  const scale = 10 // Scale factor for SVG (mm to SVG units)
  const svgWidth = cardLayout.cardWidth * scale
  const svgHeight = cardLayout.cardHeight * scale

  // Generate ArUco markers
  const arucoMarkers = useArucoMarkers
    ? cardLayout.markerPositions.map(pos => {
      const marker = generateArucoMarker(pos.id, pos.size * scale)
      const markerSVG = generateArucoSVG(marker)
      return `<g transform="translate(${pos.x * scale}, ${pos.y * scale})">${markerSVG}</g>`
    }).join('')
    : ''

  // Generate color swatches
  const swatches = colorChart.map((color, index) => {
    const pos = getSwatchPosition(cardLayout, index)
    if (!pos) return '' // Skip colors that don't fit
    return `<rect
      x="${pos.x * scale}"
      y="${pos.y * scale}"
      width="${pos.width * scale}"
      height="${pos.height * scale}"
      fill="${color || '#E5E7EB'}"
    />`
  }).filter(swatch => swatch !== '').join('')

  const svgContent = `
    <svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white"/>
      ${swatches}
      ${arucoMarkers}
    </svg>
  `

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

    // Add swatches
    colorChart.forEach((color, index) => {
      const pos = getSwatchPosition(cardLayout, index)
      if (!pos) return // Skip colors that don't fit

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

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { r, g, b }
}
