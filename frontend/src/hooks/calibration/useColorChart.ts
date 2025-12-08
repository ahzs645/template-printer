import { useState } from 'react'

const DEFAULT_SWATCHES = [
  // Basic Colors
  "#FF0000", // Red
  "#00FF00", // Green
  "#0000FF", // Blue
  "#00FFFF", // Cyan
  "#FF00FF", // Magenta
  "#FFFF00", // Yellow
  "#FFA500", // Orange
  "#BFFF00", // Lime
  "#008080", // Teal
  "#800080", // Purple

  // Skin Tones
  "#FBE8D3", // Light
  "#F3C6A5",
  "#E0AC69",
  "#C68642",
  "#8D5524",
  "#5A3825", // Dark

  // Pastels
  "#FFB3BA", // Pink
  "#FFDFBA", // Peach
  "#FFFFBA", // Lemon
  "#BAFFC9", // Mint
  "#BAE1FF", // Sky blue
  "#E0BBE4", // Lavender
  "#D5F4E6", // Light aqua
  "#F6E2B3", // Light sand

  // Earthy Colors
  "#8B4513", // Saddle brown
  "#A0522D", // Sienna
  "#CD853F", // Peru
  "#D2B48C", // Tan
  "#556B2F", // Dark olive
  "#6B8E23", // Olive drab

  // Neutrals & Grays
  "#FFFFFF", // White
  "#E0E0E0",
  "#C0C0C0",
  "#A0A0A0",
  "#808080", // Middle gray
  "#606060",
  "#404040",
  "#303030",
  "#202020",
  "#000000", // Black

  // Red Ramp
  "#1A0000",
  "#330000",
  "#4D0000",
  "#660000",
  "#800000",
  "#990000",
  "#B30000",
  "#CC0000",
  "#E60000",
  "#FF0000",

  // Green Ramp
  "#001A00",
  "#003300",
  "#004D00",
  "#006600",
  "#008000",
  "#009900",
  "#00B300",
  "#00CC00",
  "#00E600",
  "#00FF00",

  // Blue Ramp
  "#00001A",
  "#000033",
  "#00004D",
  "#000066",
  "#000080",
  "#000099",
  "#0000B3",
  "#0000CC",
  "#0000E6",
  "#0000FF",
]

export function useColorChart(useArucoMarkers: boolean = false) {
  const [selectedColor, setSelectedColor] = useState("#4285f4")
  const [colorChart, setColorChart] = useState<string[]>(DEFAULT_SWATCHES)
  const [hoveredSwatch, setHoveredSwatch] = useState<number | null>(null)

  const handleAddToChart = () => {
    const maxColors = useArucoMarkers ? 73 : 77 // 77 total - 4 corners when markers enabled
    if (colorChart.length >= maxColors) return
    setColorChart(prev => [...prev, selectedColor])
  }

  const handleRemoveSwatch = (index: number) => {
    setColorChart(prev => prev.filter((_, i) => i !== index))
  }

  const handleReplaceSwatch = (index: number) => {
    setColorChart(prev => {
      const newChart = [...prev]
      newChart[index] = selectedColor
      return newChart
    })
  }

  const getRGBValues = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgb(${r}, ${g}, ${b})`
  }

  return {
    selectedColor,
    setSelectedColor,
    colorChart,
    setColorChart,
    hoveredSwatch,
    setHoveredSwatch,
    handleAddToChart,
    handleRemoveSwatch,
    handleReplaceSwatch,
    getRGBValues
  }
}
