interface ColorGridProps {
  colorChart: string[]
}

export function ColorGrid({ colorChart }: ColorGridProps) {
  return (
    <div>
      <h3 className="text-xl font-medium mb-4">Expected Colors</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {colorChart.map((color, index) => (
          <div key={index} className="space-y-1">
            <div
              className="aspect-square rounded border-2 border-border flex items-center justify-center text-xs font-bold text-white mix-blend-difference"
              style={{ backgroundColor: color }}
            >
              #{index}
            </div>
            <div className="text-xs text-center text-muted-foreground">
              {color}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
