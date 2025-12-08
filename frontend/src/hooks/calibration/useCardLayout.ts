import { useState, useEffect } from 'react'
import { calculateCardLayout, type CardLayout } from '../../lib/calibration/layoutCalculator'

export function useCardLayout() {
  const [useArucoMarkers, setUseArucoMarkers] = useState(true)
  const [margin, setMargin] = useState(5) // mm margin from card edge
  const [cardLayout, setCardLayout] = useState<CardLayout>(() => calculateCardLayout(true, 5))

  useEffect(() => {
    // Update layout when marker settings change
    const newLayout = calculateCardLayout(useArucoMarkers, margin)
    setCardLayout(newLayout)
  }, [useArucoMarkers, margin])

  return {
    useArucoMarkers,
    setUseArucoMarkers,
    margin,
    setMargin,
    cardLayout
  }
}
