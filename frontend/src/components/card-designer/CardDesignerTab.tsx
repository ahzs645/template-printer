import { useState, useCallback, useRef, useEffect } from 'react'
import type { FabricObject } from 'fabric'
import { Save, X, FlipHorizontal } from 'lucide-react'

import { DockablePanel, PanelSection } from '../ui/dockable-panel'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

import { DesignerCanvas } from './DesignerCanvas'
import { DesignerToolbar } from './DesignerToolbar'
import { PropertiesPanel } from './PropertiesPanel'
import type { CardSide, DesignerObjectData } from './types'
import type { useFabricCanvas } from './hooks/useFabricCanvas'

type CardDesignerTabProps = {
  designId?: string
  initialName?: string
  initialFrontData?: string | null
  initialBackData?: string | null
  initialCardWidth?: number
  initialCardHeight?: number
  onSave: (data: {
    name: string
    frontCanvasData: string
    backCanvasData: string
    cardWidth: number
    cardHeight: number
  }) => void
  onCancel: () => void
}

export function CardDesignerTab({
  designId,
  initialName = 'Untitled Design',
  initialFrontData,
  initialBackData,
  initialCardWidth = 86,
  initialCardHeight = 54,
  onSave,
  onCancel,
}: CardDesignerTabProps) {
  // Design metadata
  const [designName, setDesignName] = useState(initialName)
  const [cardWidth, setCardWidth] = useState(initialCardWidth)
  const [cardHeight, setCardHeight] = useState(initialCardHeight)

  // Active card side
  const [activeSide, setActiveSide] = useState<CardSide>('front')

  // Canvas data for each side
  const [frontCanvasData, setFrontCanvasData] = useState<string | null>(initialFrontData ?? null)
  const [backCanvasData, setBackCanvasData] = useState<string | null>(initialBackData ?? null)

  // Selection state
  const [selectedObjects, setSelectedObjects] = useState<FabricObject[]>([])

  // View settings
  const [showGrid, setShowGrid] = useState(true)

  // Canvas refs
  const frontCanvasRef = useRef<ReturnType<typeof useFabricCanvas> | null>(null)
  const backCanvasRef = useRef<ReturnType<typeof useFabricCanvas> | null>(null)

  // Get current canvas based on active side
  const currentCanvas = activeSide === 'front' ? frontCanvasRef.current : backCanvasRef.current

  // Handle selection change
  const handleSelectionChange = useCallback((objects: FabricObject[]) => {
    setSelectedObjects(objects)
  }, [])

  // Handle canvas data change
  const handleFrontCanvasChange = useCallback((json: string) => {
    setFrontCanvasData(json)
  }, [])

  const handleBackCanvasChange = useCallback((json: string) => {
    setBackCanvasData(json)
  }, [])

  // Toolbar actions
  const handleAddText = useCallback(() => {
    currentCanvas?.addText('Text')
  }, [currentCanvas])

  const handleAddDynamicText = useCallback(() => {
    const fieldId = `field_${Date.now()}`
    currentCanvas?.addDynamicText(fieldId, `{{${fieldId}}}`)
  }, [currentCanvas])

  const handleAddImagePlaceholder = useCallback(() => {
    const fieldId = `photo_${Date.now()}`
    currentCanvas?.addImagePlaceholder(fieldId)
  }, [currentCanvas])

  const handleAddRectangle = useCallback(() => {
    currentCanvas?.addRectangle()
  }, [currentCanvas])

  const handleAddCircle = useCallback(() => {
    currentCanvas?.addCircle()
  }, [currentCanvas])

  const handleAddLine = useCallback(() => {
    currentCanvas?.addLine()
  }, [currentCanvas])

  const handleDelete = useCallback(() => {
    currentCanvas?.deleteSelected()
  }, [currentCanvas])

  const handleBringToFront = useCallback(() => {
    currentCanvas?.bringToFront()
  }, [currentCanvas])

  const handleSendToBack = useCallback(() => {
    currentCanvas?.sendToBack()
  }, [currentCanvas])

  const handleToggleGrid = useCallback(() => {
    setShowGrid((prev) => !prev)
  }, [])

  const handleCardSizeChange = useCallback((width: number, height: number) => {
    setCardWidth(width)
    setCardHeight(height)
  }, [])

  // Property changes
  const handlePropertyChange = useCallback((property: string, value: unknown) => {
    if (!currentCanvas?.canvas) return

    const activeObject = currentCanvas.canvas.getActiveObject()
    if (!activeObject) return

    activeObject.set(property as keyof FabricObject, value)
    currentCanvas.canvas.renderAll()
  }, [currentCanvas])

  // Save handler
  const handleSave = useCallback(() => {
    // Get latest canvas data
    const finalFrontData = frontCanvasRef.current?.toJSON() ?? frontCanvasData ?? '{}'
    const finalBackData = backCanvasRef.current?.toJSON() ?? backCanvasData ?? '{}'

    onSave({
      name: designName,
      frontCanvasData: finalFrontData,
      backCanvasData: finalBackData,
      cardWidth,
      cardHeight,
    })
  }, [designName, frontCanvasData, backCanvasData, cardWidth, cardHeight, onSave])

  // Switch side handler
  const handleSwitchSide = useCallback((side: CardSide) => {
    // Save current side's data before switching
    if (activeSide === 'front' && frontCanvasRef.current) {
      setFrontCanvasData(frontCanvasRef.current.toJSON())
    } else if (activeSide === 'back' && backCanvasRef.current) {
      setBackCanvasData(backCanvasRef.current.toJSON())
    }

    setActiveSide(side)
    setSelectedObjects([])
  }, [activeSide])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '8px 16px',
          backgroundColor: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Label style={{ fontSize: 12 }}>Design Name:</Label>
          <Input
            value={designName}
            onChange={(e) => setDesignName(e.target.value)}
            style={{ width: 200, height: 32 }}
            placeholder="Enter design name"
          />
        </div>

        <div style={{ flex: 1 }} />

        {/* Side Toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px',
            backgroundColor: 'var(--bg-surface-alt)',
            borderRadius: 6,
          }}
        >
          <button
            onClick={() => handleSwitchSide('front')}
            style={{
              padding: '6px 16px',
              fontSize: 13,
              fontWeight: 500,
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              backgroundColor: activeSide === 'front' ? 'var(--bg-surface)' : 'transparent',
              color: activeSide === 'front' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: activeSide === 'front' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            Front
          </button>
          <button
            onClick={() => handleSwitchSide('back')}
            style={{
              padding: '6px 16px',
              fontSize: 13,
              fontWeight: 500,
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              backgroundColor: activeSide === 'back' ? 'var(--bg-surface)' : 'transparent',
              color: activeSide === 'back' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: activeSide === 'back' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            Back
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="outline" size="sm" onClick={onCancel}>
            <X size={14} style={{ marginRight: 4 }} />
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave}>
            <Save size={14} style={{ marginRight: 4 }} />
            Save Design
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <DesignerToolbar
        onAddText={handleAddText}
        onAddDynamicText={handleAddDynamicText}
        onAddImagePlaceholder={handleAddImagePlaceholder}
        onAddRectangle={handleAddRectangle}
        onAddCircle={handleAddCircle}
        onAddLine={handleAddLine}
        onDelete={handleDelete}
        onBringToFront={handleBringToFront}
        onSendToBack={handleSendToBack}
        showGrid={showGrid}
        onToggleGrid={handleToggleGrid}
        cardWidth={cardWidth}
        cardHeight={cardHeight}
        onCardSizeChange={handleCardSizeChange}
        hasSelection={selectedObjects.length > 0}
      />

      {/* Main Content */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Elements Panel - Left */}
        <DockablePanel title="Elements" side="left" width={220}>
          <PanelSection title="Objects">
            {currentCanvas?.getObjects && currentCanvas.getObjects().length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {currentCanvas.getObjects().map((obj, index) => {
                  const data = obj.get('data') as DesignerObjectData | undefined
                  const name = data?.elementType ?? obj.type ?? 'Object'
                  const isSelected = selectedObjects.includes(obj)

                  return (
                    <button
                      key={obj.get('id') ?? index}
                      onClick={() => {
                        if (currentCanvas.canvas) {
                          currentCanvas.canvas.setActiveObject(obj)
                          currentCanvas.canvas.renderAll()
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 8px',
                        border: 'none',
                        borderRadius: 4,
                        backgroundColor: isSelected ? 'var(--accent)' : 'transparent',
                        color: isSelected ? '#fff' : 'var(--text-primary)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: 12,
                      }}
                    >
                      <span style={{ textTransform: 'capitalize' }}>{name}</span>
                      {data?.fieldId && (
                        <span style={{ opacity: 0.7, fontSize: 10 }}>({data.fieldId})</span>
                      )}
                    </button>
                  )
                })}
              </div>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>
                No elements yet. Use the toolbar to add elements.
              </p>
            )}
          </PanelSection>
        </DockablePanel>

        {/* Canvas Area - Center */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Show active side canvas */}
          <div style={{ display: activeSide === 'front' ? 'flex' : 'none', flex: 1 }}>
            <DesignerCanvas
              cardWidth={cardWidth}
              cardHeight={cardHeight}
              side="front"
              canvasData={frontCanvasData}
              onSelectionChange={handleSelectionChange}
              onCanvasChange={handleFrontCanvasChange}
              showGrid={showGrid}
              canvasRef={frontCanvasRef}
            />
          </div>
          <div style={{ display: activeSide === 'back' ? 'flex' : 'none', flex: 1 }}>
            <DesignerCanvas
              cardWidth={cardWidth}
              cardHeight={cardHeight}
              side="back"
              canvasData={backCanvasData}
              onSelectionChange={handleSelectionChange}
              onCanvasChange={handleBackCanvasChange}
              showGrid={showGrid}
              canvasRef={backCanvasRef}
            />
          </div>
        </div>

        {/* Properties Panel - Right */}
        <DockablePanel title="Properties" side="right" width={260}>
          <PropertiesPanel
            selectedObject={selectedObjects[0] ?? null}
            onPropertyChange={handlePropertyChange}
          />
        </DockablePanel>
      </div>
    </div>
  )
}
