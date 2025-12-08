import { useState, useRef } from 'react'
import { analyzeColorChart, type AnalysisResult } from '../../lib/calibration/colorAnalysis'
import type { CardLayout } from '../../lib/calibration/layoutCalculator'
import { getGridPosition } from '../../lib/calibration/layoutCalculator'

export interface ColorComparison {
  original: string
  scanned: string
  difference: {
    r: number
    g: number
    b: number
  }
}

function calculateColorDifference(color1: string, color2: string) {
  const rgb1 = hexToRgb(color1)
  const rgb2 = hexToRgb(color2)
  return {
    r: rgb2.r - rgb1.r,
    g: rgb2.g - rgb1.g,
    b: rgb2.b - rgb1.b
  }
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { r, g, b }
}

export function useImageAnalysis() {
  const [scannedImage, setScannedImage] = useState<string | null>(null)
  const [colorComparisons, setColorComparisons] = useState<ColorComparison[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const handleImageUpload = (file: File, colorChart: string[], cardLayout: CardLayout) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      setScannedImage(event.target?.result as string)
      analyzeImage(event.target?.result as string, colorChart, cardLayout)
    }
    reader.readAsDataURL(file)
  }

  const analyzeImage = async (imageData: string, colorChart: string[], cardLayout: CardLayout) => {
    setIsAnalyzing(true)

    try {
      // Add a timeout to prevent getting stuck
      const timeoutId = setTimeout(() => {
        console.error('Analysis timed out after 15 seconds')
        const emptyComparisons = colorChart.map((original) => ({
          original,
          scanned: '#E5E7EB',
          difference: { r: 0, g: 0, b: 0 }
        }))
        setColorComparisons(emptyComparisons)
        setIsAnalyzing(false)
      }, 15000) // 15 second timeout

      const img = new window.Image()
      img.crossOrigin = 'anonymous' // Handle CORS issues

      img.onload = async () => {
        try {
          clearTimeout(timeoutId) // Clear timeout if image loads successfully
          const canvas = canvasRef.current
          if (!canvas) {
            console.error('Canvas not available')
            setIsAnalyzing(false)
            return
          }

          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          if (!ctx) {
            console.error('Canvas context not available')
            setIsAnalyzing(false)
            return
          }

          canvas.width = img.width
          canvas.height = img.height
          ctx.drawImage(img, 0, 0)

          console.log('Starting layout-aware grid analysis with ArUco detection...')
          console.log('Canvas dimensions:', canvas.width, 'x', canvas.height)
          console.log('Excluded ArUco positions:', cardLayout.excludedIndices)

          // Use the analyzeColorChart function which includes ArUco detection
          const result = await analyzeColorChart(
            canvas,
            colorChart,
            { width: cardLayout.cardWidth, height: cardLayout.cardHeight },
            { cols: cardLayout.swatchGrid.cols, rows: cardLayout.swatchGrid.rows }
          )

          console.log('Analysis result:', result)
          setAnalysisResult(result)

          // If we have detected markers, use them for color extraction
          if (result.detectedMarkers && result.detectedMarkers.length >= 2) {
            console.log(`Using ArUco markers for precise color extraction (found ${result.detectedMarkers.length} markers)`)
            // The analyzeColorChart function already extracted colors with perspective correction
            const comparisons = colorChart.map((original, index) => {
              const sample = result.samples[index]
              const scanned = sample ? sample.color : '#E5E7EB'
              return {
                original,
                scanned,
                difference: calculateColorDifference(original, scanned)
              }
            })
            setColorComparisons(comparisons)
          } else {
            console.log('No ArUco markers detected, falling back to grid-based extraction')
            // Fallback to the original grid-based method
            const scannedColors: string[] = []

            // Process all 77 grid positions using getGridPosition for accurate positioning
            for (let gridIndex = 0; gridIndex < 77; gridIndex++) {
              const isMarkerPosition = cardLayout.excludedIndices.includes(gridIndex)

              if (isMarkerPosition) {
                console.log(`Skipping ArUco marker at grid position ${gridIndex}`)
                continue
              }

              // Calculate swatch index using EXACT same logic as CardPreview
              let swatchIndex = 0
              for (let i = 0; i < gridIndex; i++) {
                if (!cardLayout.excludedIndices.includes(i)) {
                  swatchIndex++
                }
              }

              // Only process if we have a color for this swatch
              if (swatchIndex >= colorChart.length) {
                console.log(`No color available for swatch ${swatchIndex} at grid ${gridIndex}`)
                continue
              }

              // Use getGridPosition to get the EXACT same positioning as overlay
              const gridPos = getGridPosition(cardLayout, gridIndex)

              // Convert from card dimensions (mm) to canvas pixels
              // The image aspect ratio should match the card aspect ratio (85.6/54)
              const cardAspect = cardLayout.cardWidth / cardLayout.cardHeight
              const canvasAspect = canvas.width / canvas.height

              let scaleX: number, scaleY: number, offsetX = 0, offsetY = 0

              if (canvasAspect > cardAspect) {
                // Canvas is wider than card aspect - scale by height and center horizontally
                scaleY = canvas.height / cardLayout.cardHeight
                scaleX = scaleY
                offsetX = (canvas.width - (cardLayout.cardWidth * scaleX)) / 2
              } else {
                // Canvas is taller than card aspect - scale by width and center vertically
                scaleX = canvas.width / cardLayout.cardWidth
                scaleY = scaleX
                offsetY = (canvas.height - (cardLayout.cardHeight * scaleY)) / 2
              }

              // Calculate center of the swatch in canvas coordinates
              const x = Math.round(offsetX + (gridPos.x + gridPos.width / 2) * scaleX)
              const y = Math.round(offsetY + (gridPos.y + gridPos.height / 2) * scaleY)

              console.log(`Grid ${gridIndex} -> Swatch ${swatchIndex}: gridPos(${gridPos.x.toFixed(1)},${gridPos.y.toFixed(1)}) -> canvas(${x},${y})`)

              if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
                // Sample a 5x5 area for better color accuracy but clamp to canvas bounds
                const sampleSize = 2 // 5x5 area
                const startX = Math.max(0, Math.min(canvas.width - 5, x - sampleSize))
                const startY = Math.max(0, Math.min(canvas.height - 5, y - sampleSize))
                const sampleWidth = Math.min(5, canvas.width - startX)
                const sampleHeight = Math.min(5, canvas.height - startY)

                const imgData = ctx.getImageData(startX, startY, sampleWidth, sampleHeight)
                const pixels = imgData.data
                let r = 0, g = 0, b = 0, count = 0

                for (let i = 0; i < pixels.length; i += 4) {
                  r += pixels[i]
                  g += pixels[i + 1]
                  b += pixels[i + 2]
                  count++
                }

                if (count > 0) {
                  r = Math.round(r / count)
                  g = Math.round(g / count)
                  b = Math.round(b / count)

                  const color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
                  scannedColors[swatchIndex] = color
                  const row = Math.floor(gridIndex / cardLayout.swatchGrid.cols)
                  const col = gridIndex % cardLayout.swatchGrid.cols
                  console.log(`Swatch ${swatchIndex} at grid ${gridIndex} (${col},${row}) pos(${x},${y}): RGB(${r},${g},${b}) = ${color}`)
                } else {
                  scannedColors[swatchIndex] = '#E5E7EB'
                  console.log(`No pixels sampled for swatch ${swatchIndex} at grid ${gridIndex}`)
                }
              } else {
                scannedColors[swatchIndex] = '#E5E7EB'
                console.log(`Position (${x},${y}) out of bounds for swatch ${swatchIndex} at grid ${gridIndex}`)
              }
            }

            console.log('Extracted colors:', scannedColors.filter(c => c).length, 'out of', colorChart.length)

            // Create comparisons - scannedColors array is now properly indexed
            const comparisons = colorChart.map((original, index) => {
              const scanned = scannedColors[index] || '#E5E7EB'
              console.log(`Comparison ${index}: ${original} vs ${scanned}`)
              return {
                original,
                scanned,
                difference: calculateColorDifference(original, scanned)
              }
            })

            console.log('Setting comparisons:', comparisons.length)
            setColorComparisons(comparisons)
          }

          setIsAnalyzing(false)
        } catch (error) {
          console.error('Error during image analysis:', error)
          setIsAnalyzing(false)
        }
      }

      img.onerror = (error) => {
        console.error('Error loading image:', error)
        clearTimeout(timeoutId)
        setIsAnalyzing(false)
      }

      img.src = imageData
    } catch (error) {
      console.error('Error starting image analysis:', error)
      setIsAnalyzing(false)
    }
  }

  const clearImage = () => {
    setScannedImage(null)
    setColorComparisons([])
    setAnalysisResult(null)
    setIsAnalyzing(false)
  }

  return {
    scannedImage,
    colorComparisons,
    isAnalyzing,
    analysisResult,
    canvasRef,
    handleImageUpload,
    clearImage
  }
}
