import type { ColorComparison } from '../../../hooks/calibration/useImageAnalysis'

interface AnalysisDisplayProps {
  isAnalyzing: boolean
  colorComparisons: ColorComparison[]
  onCreateProfile?: (
    adjustments: Array<{ color: string, adjustment: { r: number, g: number, b: number } }>,
    profileName: string,
    deviceName: string
  ) => void
}

// Calculate color difference as Delta E (simplified)
function calculateColorAccuracy(comparison: ColorComparison): { deltaE: number, quality: 'excellent' | 'good' | 'fair' | 'poor' } {
  const { r, g, b } = comparison.difference
  const deltaE = Math.sqrt(r * r + g * g + b * b)

  if (deltaE < 10) return { deltaE, quality: 'excellent' }
  if (deltaE < 25) return { deltaE, quality: 'good' }
  if (deltaE < 50) return { deltaE, quality: 'fair' }
  return { deltaE, quality: 'poor' }
}

function getQualityColor(quality: string): string {
  switch (quality) {
    case 'excellent': return 'text-green-600 bg-green-50 border-green-200'
    case 'good': return 'text-blue-600 bg-blue-50 border-blue-200'
    case 'fair': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    case 'poor': return 'text-red-600 bg-red-50 border-red-200'
    default: return 'text-gray-600 bg-gray-50 border-gray-200'
  }
}

export function AnalysisDisplay({
  isAnalyzing,
  colorComparisons,
  onCreateProfile
}: AnalysisDisplayProps) {
  if (isAnalyzing) {
    return (
      <div className="text-center space-y-2">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground">Analyzing colors...</p>
      </div>
    )
  }

  if (colorComparisons.length === 0) {
    return (
      <div className="text-center text-muted-foreground">
        No analysis results yet. Upload an image to begin color analysis.
      </div>
    )
  }

  const overallAccuracy = colorComparisons.reduce((acc, comp) => {
    const { quality } = calculateColorAccuracy(comp)
    return acc + (quality === 'excellent' ? 4 : quality === 'good' ? 3 : quality === 'fair' ? 2 : 1)
  }, 0) / colorComparisons.length

  const overallQuality = overallAccuracy >= 3.5 ? 'excellent' :
    overallAccuracy >= 2.5 ? 'good' :
      overallAccuracy >= 1.5 ? 'fair' : 'poor'

  return (
    <div className="space-y-4">
      {/* Overall Quality Summary */}
      <div className={`p-3 rounded-lg border ${getQualityColor(overallQuality)}`}>
        <div className="flex items-center justify-between">
          <span className="font-medium">Overall Color Accuracy: {overallQuality.toUpperCase()}</span>
          <span className="text-sm">
            {colorComparisons.filter(comp => calculateColorAccuracy(comp).quality === 'excellent').length} excellent, {' '}
            {colorComparisons.filter(comp => calculateColorAccuracy(comp).quality === 'good').length} good, {' '}
            {colorComparisons.filter(comp => calculateColorAccuracy(comp).quality === 'fair').length} fair, {' '}
            {colorComparisons.filter(comp => calculateColorAccuracy(comp).quality === 'poor').length} poor
          </span>
        </div>
      </div>

      {/* Individual Color Comparisons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {colorComparisons.map((comparison, index) => {
          const { deltaE, quality } = calculateColorAccuracy(comparison)

          return (
            <div key={index} className="space-y-2 p-3 border rounded-lg bg-white">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Color #{index}</span>
                <span className={`px-2 py-1 text-xs rounded-full border ${getQualityColor(quality)}`}>
                  {quality.toUpperCase()}
                </span>
              </div>

              <div className="flex h-12 rounded border">
                <div className="flex-1 space-y-1">
                  <div
                    className="h-full rounded-l border-r"
                    style={{ backgroundColor: comparison.original }}
                    title={`Original: ${comparison.original}`}
                  />
                  <div className="text-xs text-center text-muted-foreground">Original</div>
                </div>
                <div className="flex-1 space-y-1">
                  <div
                    className="h-full rounded-r"
                    style={{ backgroundColor: comparison.scanned }}
                    title={`Scanned: ${comparison.scanned}`}
                  />
                  <div className="text-xs text-center text-muted-foreground">Scanned</div>
                </div>
              </div>

              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span>Original:</span>
                  <span className="font-mono">{comparison.original}</span>
                </div>
                <div className="flex justify-between">
                  <span>Scanned:</span>
                  <span className="font-mono">{comparison.scanned}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delta E:</span>
                  <span className="font-mono">{deltaE.toFixed(1)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>RGB Diff:</span>
                  <span className="font-mono">
                    ({comparison.difference.r > 0 ? '+' : ''}{comparison.difference.r}, {' '}
                    {comparison.difference.g > 0 ? '+' : ''}{comparison.difference.g}, {' '}
                    {comparison.difference.b > 0 ? '+' : ''}{comparison.difference.b})
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {onCreateProfile && colorComparisons.length > 0 && (
        <div className="pt-4 border-t">
          <button
            onClick={() => {
              const adjustments = colorComparisons.map((comp) => ({
                color: comp.original,
                adjustment: comp.difference
              }))
              onCreateProfile(adjustments, 'Scanned Profile', 'Unknown Device')
            }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Create Color Profile from Analysis
          </button>
        </div>
      )}
    </div>
  )
}
