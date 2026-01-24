import { useRef, useEffect, useCallback } from 'react'
import type { FabricObject } from 'fabric'
import { useFabricCanvas } from './hooks/useFabricCanvas'
import type { CardSide } from './types'

// Pixels per mm at 96 DPI
const PX_PER_MM = 96 / 25.4

type DesignerCanvasProps = {
  cardWidth: number  // mm
  cardHeight: number // mm
  side: CardSide
  canvasData?: string | null
  onSelectionChange?: (objects: FabricObject[]) => void
  onCanvasChange?: (json: string) => void
  showGrid?: boolean
  gridSize?: number // mm
  canvasRef?: React.MutableRefObject<ReturnType<typeof useFabricCanvas> | null>
}

export function DesignerCanvas({
  cardWidth,
  cardHeight,
  side,
  canvasData,
  onSelectionChange,
  onCanvasChange,
  showGrid = true,
  gridSize = 5,
  canvasRef: externalCanvasRef,
}: DesignerCanvasProps) {
  const canvasElementRef = useRef<HTMLCanvasElement>(null)
  const hasLoadedRef = useRef(false)

  const handleCanvasChange = useCallback(() => {
    // Will be called by the hook when canvas changes
  }, [])

  const fabricCanvas = useFabricCanvas(canvasElementRef, {
    cardWidth,
    cardHeight,
    onSelectionChange,
    onCanvasChange: handleCanvasChange,
  })

  const { canvas, loadFromJSON, toJSON } = fabricCanvas

  // Expose canvas methods to parent via ref
  useEffect(() => {
    if (externalCanvasRef) {
      externalCanvasRef.current = fabricCanvas
    }
  }, [fabricCanvas, externalCanvasRef])

  // Load canvas data when provided
  useEffect(() => {
    if (!canvas || hasLoadedRef.current) return

    if (canvasData) {
      loadFromJSON(canvasData).then(() => {
        hasLoadedRef.current = true
      })
    } else {
      hasLoadedRef.current = true
    }
  }, [canvas, canvasData, loadFromJSON])

  // Notify parent of canvas changes
  useEffect(() => {
    if (!canvas || !hasLoadedRef.current) return

    const handleChange = () => {
      const json = toJSON()
      onCanvasChange?.(json)
    }

    canvas.on('object:modified', handleChange)
    canvas.on('object:added', handleChange)
    canvas.on('object:removed', handleChange)

    return () => {
      canvas.off('object:modified', handleChange)
      canvas.off('object:added', handleChange)
      canvas.off('object:removed', handleChange)
    }
  }, [canvas, toJSON, onCanvasChange])

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!canvas) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Delete selected objects
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        fabricCanvas.deleteSelected()
      }

      // Copy (Ctrl/Cmd + C) - TODO: implement clipboard
      // Paste (Ctrl/Cmd + V) - TODO: implement clipboard

      // Undo (Ctrl/Cmd + Z) - TODO: implement history
      // Redo (Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z) - TODO: implement history
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canvas, fabricCanvas])

  // Calculate container dimensions for centering
  const containerWidth = cardWidth * PX_PER_MM
  const containerHeight = cardHeight * PX_PER_MM

  // Generate grid pattern for SVG background
  const gridSizePx = gridSize * PX_PER_MM

  return (
    <div
      className="designer-canvas-container"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        padding: 24,
        backgroundColor: 'var(--bg-surface-alt, #f5f5f5)',
        overflow: 'auto',
      }}
    >
      <div
        className="designer-canvas-wrapper"
        style={{
          position: 'relative',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        {/* Grid overlay */}
        {showGrid && (
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: containerWidth,
              height: containerHeight,
              pointerEvents: 'none',
              zIndex: 1,
            }}
          >
            <defs>
              <pattern
                id={`grid-${side}`}
                width={gridSizePx}
                height={gridSizePx}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={`M ${gridSizePx} 0 L 0 0 0 ${gridSizePx}`}
                  fill="none"
                  stroke="rgba(0,0,0,0.1)"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill={`url(#grid-${side})`} />
          </svg>
        )}

        {/* Canvas element */}
        <canvas
          ref={canvasElementRef}
          style={{
            display: 'block',
          }}
        />

        {/* Card side indicator */}
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            fontSize: 10,
            color: 'rgba(0,0,0,0.3)',
            textTransform: 'uppercase',
            fontWeight: 600,
            letterSpacing: '0.5px',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        >
          {side} side
        </div>
      </div>
    </div>
  )
}
