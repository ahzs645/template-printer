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
          // Transform all 4 corners of the cell using actual card coordinates
          // The bilinear transform maps card coords → image coords
          const corners = [
            transform.transformPoint(gridPos.x, gridPos.y),                                   // top-left
            transform.transformPoint(gridPos.x + gridPos.width, gridPos.y),                   // top-right
            transform.transformPoint(gridPos.x, gridPos.y + gridPos.height),                  // bottom-left
            transform.transformPoint(gridPos.x + gridPos.width, gridPos.y + gridPos.height)   // bottom-right
          ]

          // Convert from canvas coordinates to display coordinates
          const canvasWidth = analysisResult.canvasDimensions.width
          const canvasHeight = analysisResult.canvasDimensions.height
          const scaleX = imageDimensions.width / canvasWidth
          const scaleY = imageDimensions.height / canvasHeight

          // Debug: log for corner cells
          if (gridIndex === 0 || gridIndex === 10 || gridIndex === 66 || gridIndex === 76) {
            console.log(`Grid ${gridIndex}: card(${gridPos.x.toFixed(1)},${gridPos.y.toFixed(1)}) -> canvas(${corners[0].x.toFixed(1)},${corners[0].y.toFixed(1)}) -> display(${(corners[0].x * scaleX).toFixed(1)},${(corners[0].y * scaleY).toFixed(1)}) scale=${scaleX.toFixed(3)}`);
          }

          // Find bounding box of transformed corners
          const minX = Math.min(...corners.map(c => c.x)) * scaleX
          const maxX = Math.max(...corners.map(c => c.x)) * scaleX
          const minY = Math.min(...corners.map(c => c.y)) * scaleY
          const maxY = Math.max(...corners.map(c => c.y)) * scaleY

          left = minX
          top = minY
          width = maxX - minX
          height = maxY - minY
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

      {/* Debug: show actual detected marker centers as dots */}
      {analysisResult?.detectedMarkers && analysisResult.canvasDimensions && analysisResult.detectedMarkers.map((marker, idx) => {
        const center = marker.corners.reduce(
          (acc, c) => ({ x: acc.x + c.x / 4, y: acc.y + c.y / 4 }),
          { x: 0, y: 0 }
        );
        const scaleX = imageDimensions.width / analysisResult.canvasDimensions!.width;
        const scaleY = imageDimensions.height / analysisResult.canvasDimensions!.height;
        return (
          <div
            key={`marker-center-${idx}`}
            className="absolute w-3 h-3 bg-yellow-400 rounded-full border-2 border-black"
            style={{
              left: `${center.x * scaleX - 6}px`,
              top: `${center.y * scaleY - 6}px`,
            }}
            title={`M${marker.id}: (${center.x.toFixed(0)}, ${center.y.toFixed(0)})`}
          />
        );
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
