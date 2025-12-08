import type { CardLayout } from '../../../lib/calibration/layoutCalculator'
import type { AnalysisResult } from '../../../lib/calibration/colorAnalysis'
import { getGridPosition } from '../../../lib/calibration/layoutCalculator'

interface GridOverlayProps {
  cardLayout: CardLayout
  colorChart: string[]
  analysisResult: AnalysisResult | null
  imageDimensions: {
    width: number
    height: number
    left: number
    top: number
  }
}

export function GridOverlay({
  cardLayout,
  colorChart,
  analysisResult,
  imageDimensions
}: GridOverlayProps) {

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${imageDimensions.left}px`,
        top: `${imageDimensions.top}px`,
        width: `${imageDimensions.width}px`,
        height: `${imageDimensions.height}px`,
      }}
    >
      {/* Grid visualization for color sampling */}
      {Array.from({ length: 77 }).map((_, gridIndex) => {
        const isMarkerPosition = cardLayout.excludedIndices.includes(gridIndex)
        const gridPos = getGridPosition(cardLayout, gridIndex)

        let left, top, width, height

        // Use transform if available, otherwise fallback to basic positioning
        const transform = analysisResult?.transform
        if (transform && transform.transformPoint && analysisResult?.canvasDimensions) {
          // Use the perspective transform - sample position in card coordinates
          const sampleX = gridPos.x + gridPos.width / 2
          const sampleY = gridPos.y + gridPos.height / 2
          const transformed = transform.transformPoint(sampleX, sampleY)

          // Convert from canvas coordinates to display coordinates
          const canvasWidth = analysisResult.canvasDimensions.width
          const canvasHeight = analysisResult.canvasDimensions.height
          const scaleX = imageDimensions.width / canvasWidth
          const scaleY = imageDimensions.height / canvasHeight

          // Position overlay square centered on the sampling point
          const displayX = transformed.x * scaleX
          const displayY = transformed.y * scaleY
          const displayWidth = gridPos.width * transform.scale * scaleX
          const displayHeight = gridPos.height * transform.scale * scaleY

          left = displayX - displayWidth / 2
          top = displayY - displayHeight / 2
          width = displayWidth
          height = displayHeight
        } else {
          // Fallback positioning using simple scaling
          const cardAspect = cardLayout.cardWidth / cardLayout.cardHeight
          const canvasAspect = imageDimensions.width / imageDimensions.height

          let scaleX: number, scaleY: number, offsetX = 0, offsetY = 0

          if (canvasAspect > cardAspect) {
            // Canvas is wider than card aspect - scale by height and center horizontally
            scaleY = imageDimensions.height / cardLayout.cardHeight
            scaleX = scaleY
            offsetX = (imageDimensions.width - (cardLayout.cardWidth * scaleX)) / 2
          } else {
            // Canvas is taller than card aspect - scale by width and center vertically
            scaleX = imageDimensions.width / cardLayout.cardWidth
            scaleY = scaleX
            offsetY = (imageDimensions.height - (cardLayout.cardHeight * scaleY)) / 2
          }

          left = offsetX + gridPos.x * scaleX
          top = offsetY + gridPos.y * scaleY
          width = gridPos.width * scaleX
          height = gridPos.height * scaleY
        }

        if (isMarkerPosition) {
          // Show ArUco marker positions as blue squares
          const markerPosition = cardLayout.markerPositions.find(m => m.gridIndex === gridIndex)
          const isDetected = analysisResult?.detectedMarkers?.some(m => m.id === markerPosition?.id)

          return (
            <div
              key={`marker-${gridIndex}`}
              className={`absolute border-2 flex items-center justify-center text-xs font-bold ${isDetected
                  ? 'border-blue-600 bg-blue-500/80 text-white'
                  : 'border-gray-400 bg-gray-400/30 text-gray-600'
                }`}
              style={{
                left: `${left}px`,
                top: `${top}px`,
                width: `${width}px`,
                height: `${height}px`,
              }}
            >
              {isDetected ? '✓' : 'M'}{markerPosition?.id}
            </div>
          )
        }

        // Calculate swatch index for color sampling positions
        let swatchIndex = 0
        for (let i = 0; i < gridIndex; i++) {
          if (!cardLayout.excludedIndices.includes(i)) {
            swatchIndex++
          }
        }

        if (swatchIndex >= colorChart.length) return null

        return (
          <div
            key={`sample-${gridIndex}-${swatchIndex}`}
            className="absolute border border-red-400 bg-red-400/20 flex items-center justify-center text-xs text-white font-bold shadow-sm"
            style={{
              left: `${left}px`,
              top: `${top}px`,
              width: `${width}px`,
              height: `${height}px`,
            }}
          >
            {swatchIndex}
          </div>
        )
      })}

      {/* Show accuracy indicator */}
      {analysisResult?.detectedMarkers && analysisResult.detectedMarkers.length > 0 && (
        <div className="absolute bottom-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
          ArUco Detected: {analysisResult.detectedMarkers.length} markers
        </div>
      )}
    </div>
  )
}
