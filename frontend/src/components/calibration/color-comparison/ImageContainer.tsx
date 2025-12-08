import { useRef } from 'react'
import { GridOverlay } from './GridOverlay'
import { useImageOverlay } from './useImageOverlay'
import type { CardLayout } from '../../../lib/calibration/layoutCalculator'
import type { AnalysisResult } from '../../../lib/calibration/colorAnalysis'

interface ImageContainerProps {
  scannedImage: string
  showOverlay: boolean
  cardLayout: CardLayout
  colorChart: string[]
  analysisResult: AnalysisResult | null
}

export function ImageContainer({
  scannedImage,
  showOverlay,
  cardLayout,
  colorChart,
  analysisResult
}: ImageContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const { imageDimensions } = useImageOverlay(containerRef, imageRef)

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="relative w-full h-[300px] bg-gray-100 rounded-lg border-2 border-border overflow-hidden"
      >
        <img
          ref={imageRef}
          src={scannedImage}
          alt="Scanned color chart"
          className="w-full h-full object-contain"
        />
        {showOverlay && imageDimensions && (
          <GridOverlay
            cardLayout={cardLayout}
            colorChart={colorChart}
            analysisResult={analysisResult}
            imageDimensions={imageDimensions}
          />
        )}
      </div>

      {/* Debug info panel outside the image */}
      {analysisResult && (
        <div className="bg-black/10 text-gray-700 text-xs p-3 rounded-lg border">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="font-semibold mb-1">Detection Status</div>
              <div>Mode: ArUco Detection</div>
              <div>Markers Found: {analysisResult.detectedMarkers?.length || 0}</div>
              <div>Canvas: {analysisResult.canvasDimensions?.width}x{analysisResult.canvasDimensions?.height}</div>
            </div>
            <div>
              <div className="font-semibold mb-1">Legend</div>
              <div className="flex items-center gap-1 mb-1">
                <div className="w-3 h-3 bg-blue-500"></div>
                <span>Detected ArUco markers</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-red-400/50 border border-red-400"></div>
                <span>Color sampling positions</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
