import type { CardLayout } from "../../lib/calibration/layoutCalculator"

interface ColorSwatchChartProps {
  colorChart: string[]
  useArucoMarkers: boolean
  cardLayout: CardLayout
  hoveredSwatch: number | null
  onSwatchHover: (index: number | null) => void
  onReplaceSwatch: (index: number) => void
  onRemoveSwatch: (index: number) => void
}

export function ColorSwatchChart({
  colorChart,
  useArucoMarkers,
  cardLayout,
  hoveredSwatch,
  onSwatchHover,
  onReplaceSwatch,
  onRemoveSwatch
}: ColorSwatchChartProps) {
  return (
    <div className="flex-1">
      <h3 className="text-xl font-medium mb-4">Color Swatch Chart ({useArucoMarkers ? '73' : '77'} colors)</h3>
      <div className="grid grid-cols-11 gap-1 p-4 bg-muted/20 rounded-lg">
        {Array.from({ length: 77 }).map((_, gridIndex) => {
          const isMarkerPosition = useArucoMarkers && cardLayout.excludedIndices.includes(gridIndex)

          if (isMarkerPosition) {
            // Show marker placeholder
            return (
              <div
                key={gridIndex}
                className="aspect-square border-2 border-gray-800 bg-gray-200 rounded-sm flex items-center justify-center"
              >
                <span className="text-xs font-bold text-gray-600">M{cardLayout.markerPositions.find(m => m.gridIndex === gridIndex)?.id}</span>
              </div>
            )
          }

          // Calculate swatch index (excluding markers)
          let swatchIndex = 0
          for (let i = 0; i < gridIndex; i++) {
            if (!cardLayout.excludedIndices.includes(i)) {
              swatchIndex++
            }
          }

          const color = colorChart[swatchIndex]

          return (
            <div
              key={gridIndex}
              className="aspect-square border border-border relative group rounded-sm overflow-hidden"
              style={{ backgroundColor: color || '#E5E7EB' }}
              onMouseEnter={() => onSwatchHover(swatchIndex)}
              onMouseLeave={() => onSwatchHover(null)}
            >
              {hoveredSwatch === swatchIndex && color && (
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-1 p-1">
                  <button
                    className="h-6 px-2 text-xs bg-secondary text-secondary-foreground rounded hover:bg-secondary/80"
                    onClick={() => onReplaceSwatch(swatchIndex)}
                  >
                    Replace
                  </button>
                  <button
                    className="h-6 px-2 text-xs bg-destructive text-destructive-foreground rounded hover:bg-destructive/80"
                    onClick={() => onRemoveSwatch(swatchIndex)}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
