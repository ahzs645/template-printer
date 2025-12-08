import { Slider } from "../ui/slider"
import { generateArucoMarker } from "../../lib/calibration/aruco"
import { getGridPosition, type CardLayout } from "../../lib/calibration/layoutCalculator"

interface CardPreviewProps {
  cardLayout: CardLayout
  colorChart: string[]
  useArucoMarkers: boolean
  margin: number
  onMarginChange: (value: number) => void
  onArucoToggle: (value: boolean) => void
}

export function CardPreview({
  cardLayout,
  colorChart,
  useArucoMarkers,
  margin,
  onMarginChange,
  onArucoToggle
}: CardPreviewProps) {
  return (
    <div className="w-[300px]">
      <h3 className="text-xl font-medium mb-4">CR80 Card Preview</h3>
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Card Margin</label>
            <span className="text-sm font-mono">{margin}mm</span>
          </div>
          <Slider
            value={[margin]}
            onValueChange={([value]) => onMarginChange(value)}
            min={2}
            max={10}
            step={0.5}
          />
          <p className="text-xs text-muted-foreground">
            Distance from card edge to grid
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="use-aruco"
              checked={useArucoMarkers}
              onChange={(e) => onArucoToggle(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="use-aruco" className="text-sm font-medium">
              Add ArUco orientation markers
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            Markers replace corner color swatches for better positioning
          </p>
        </div>

        <div
          className="aspect-[85.6/54] border-2 border-border rounded-lg overflow-hidden bg-white relative"
        >
          {/* Render entire grid */}
          {Array.from({ length: 77 }).map((_, gridIndex) => {
            const isMarkerPosition = useArucoMarkers && cardLayout.excludedIndices.includes(gridIndex)
            const gridPos = getGridPosition(cardLayout, gridIndex)

            if (isMarkerPosition) {
              // Render ArUco marker
              const markerData = cardLayout.markerPositions.find(m => m.gridIndex === gridIndex)
              if (!markerData) return null

              return (
                <div
                  key={`marker-${gridIndex}`}
                  className="absolute border border-gray-800 bg-white"
                  style={{
                    left: `${(gridPos.x / cardLayout.cardWidth) * 100}%`,
                    top: `${(gridPos.y / cardLayout.cardHeight) * 100}%`,
                    width: `${(gridPos.width / cardLayout.cardWidth) * 100}%`,
                    height: `${(gridPos.height / cardLayout.cardHeight) * 100}%`,
                  }}
                >
                  <div className="w-full h-full grid grid-cols-6 grid-rows-6 border border-black">
                    {Array.from({ length: 36 }).map((_, cellIdx) => {
                      const row = Math.floor(cellIdx / 6)
                      const col = cellIdx % 6
                      const marker = generateArucoMarker(markerData.id)
                      const isBlack = marker.matrix[row] && marker.matrix[row][col] === 0
                      return (
                        <div
                          key={cellIdx}
                          className={`${isBlack ? 'bg-black' : 'bg-white'}`}
                        />
                      )
                    })}
                  </div>
                </div>
              )
            } else {
              // Render color swatch
              // Calculate swatch index
              let swatchIndex = 0
              for (let i = 0; i < gridIndex; i++) {
                if (!cardLayout.excludedIndices.includes(i)) {
                  swatchIndex++
                }
              }

              const color = colorChart[swatchIndex]

              // Only render if we have a color for this position
              if (swatchIndex >= colorChart.length) {
                return (
                  <div
                    key={`empty-${gridIndex}`}
                    className="absolute"
                    style={{
                      left: `${(gridPos.x / cardLayout.cardWidth) * 100}%`,
                      top: `${(gridPos.y / cardLayout.cardHeight) * 100}%`,
                      width: `${(gridPos.width / cardLayout.cardWidth) * 100}%`,
                      height: `${(gridPos.height / cardLayout.cardHeight) * 100}%`,
                      backgroundColor: '#E5E7EB'
                    }}
                  />
                )
              }

              return (
                <div
                  key={`swatch-${gridIndex}`}
                  className="absolute"
                  style={{
                    left: `${(gridPos.x / cardLayout.cardWidth) * 100}%`,
                    top: `${(gridPos.y / cardLayout.cardHeight) * 100}%`,
                    width: `${(gridPos.width / cardLayout.cardWidth) * 100}%`,
                    height: `${(gridPos.height / cardLayout.cardHeight) * 100}%`,
                    backgroundColor: color || '#E5E7EB'
                  }}
                />
              )
            }
          })}
        </div>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>CR80 Card Size: 85.60 mm x 54.00 mm (3.375 in x 2.125 in)</p>
          <p>Square Size: {cardLayout.swatchGrid.swatchWidth.toFixed(1)} mm x {cardLayout.swatchGrid.swatchHeight.toFixed(1)} mm</p>
          <p>Grid: 11 x 7 ({useArucoMarkers ? '73 colors + 4 markers' : '77 colors'})</p>
        </div>
      </div>
    </div>
  )
}
