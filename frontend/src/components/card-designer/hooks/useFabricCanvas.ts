import { useEffect, useRef, useState, useCallback } from 'react'
import { Canvas, FabricObject, Textbox, Rect, Circle, Line, Group, FabricText, FabricImage } from 'fabric'
import type { DesignerObjectData, CardSide } from '../types'
import {
  DEFAULT_TEXT_PROPS,
  DEFAULT_SHAPE_PROPS,
  DEFAULT_IMAGE_PLACEHOLDER_PROPS,
} from '../types'
import { generateBarcodePreview, type BarcodeType } from '../utils/barcodeGenerator'

// Pixels per mm at 96 DPI (standard screen)
const PX_PER_MM = 96 / 25.4

type UseFabricCanvasOptions = {
  cardWidth: number  // mm
  cardHeight: number // mm
  onSelectionChange?: (objects: FabricObject[]) => void
  onCanvasChange?: () => void
  snapToGrid?: boolean
  gridSize?: number  // mm
}

export function useFabricCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  options: UseFabricCanvasOptions
) {
  const { cardWidth, cardHeight, onSelectionChange, onCanvasChange, snapToGrid = false, gridSize = 5 } = options
  const [canvas, setCanvas] = useState<Canvas | null>(null)
  const [selectedObjects, setSelectedObjects] = useState<FabricObject[]>([])
  const isInitializedRef = useRef(false)
  const alignmentLinesRef = useRef<Line[]>([])
  const snapEnabledRef = useRef(snapToGrid)
  const gridSizeRef = useRef(gridSize)

  // Update refs when options change
  useEffect(() => {
    snapEnabledRef.current = snapToGrid
    gridSizeRef.current = gridSize
  }, [snapToGrid, gridSize])

  // Convert mm to canvas pixels
  const mmToPx = useCallback((mm: number) => mm * PX_PER_MM, [])
  const pxToMm = useCallback((px: number) => px / PX_PER_MM, [])

  // Store initial dimensions in refs so initialization doesn't depend on them
  const initialWidthRef = useRef(cardWidth)
  const initialHeightRef = useRef(cardHeight)

  // Initialize canvas (only once)
  useEffect(() => {
    if (!canvasRef.current || isInitializedRef.current) return

    const fabricCanvas = new Canvas(canvasRef.current, {
      width: mmToPx(initialWidthRef.current),
      height: mmToPx(initialHeightRef.current),
      backgroundColor: '#ffffff',
      selection: true,
      preserveObjectStacking: true,
      controlsAboveOverlay: true,
    })

    // Selection event handlers
    const handleSelection = () => {
      const activeObjects = fabricCanvas.getActiveObjects()
      setSelectedObjects(activeObjects)
      onSelectionChange?.(activeObjects)
    }

    const handleSelectionCleared = () => {
      setSelectedObjects([])
      onSelectionChange?.([])
    }

    const handleObjectModified = () => {
      onCanvasChange?.()
    }

    // Snap to grid during object movement
    const handleObjectMoving = (e: { target: FabricObject }) => {
      if (!snapEnabledRef.current || !e.target) return

      const obj = e.target
      const gridPx = mmToPx(gridSizeRef.current)

      // Get object bounds
      const objLeft = obj.left ?? 0
      const objTop = obj.top ?? 0

      // Snap to grid
      const snappedLeft = Math.round(objLeft / gridPx) * gridPx
      const snappedTop = Math.round(objTop / gridPx) * gridPx

      obj.set({
        left: snappedLeft,
        top: snappedTop,
      })

      // Show alignment lines for center guides
      clearAlignmentLines(fabricCanvas)
      const canvasWidth = fabricCanvas.width ?? 0
      const canvasHeight = fabricCanvas.height ?? 0
      const objWidth = (obj.width ?? 0) * (obj.scaleX ?? 1)
      const objHeight = (obj.height ?? 0) * (obj.scaleY ?? 1)
      const objCenterX = snappedLeft + objWidth / 2
      const objCenterY = snappedTop + objHeight / 2
      const canvasCenterX = canvasWidth / 2
      const canvasCenterY = canvasHeight / 2

      // Show vertical center line when near center
      if (Math.abs(objCenterX - canvasCenterX) < gridPx) {
        const centerLine = new Line([canvasCenterX, 0, canvasCenterX, canvasHeight], {
          stroke: '#ff6b6b',
          strokeWidth: 1,
          selectable: false,
          evented: false,
          strokeDashArray: [5, 5],
        })
        centerLine.set('data', { isAlignmentLine: true })
        alignmentLinesRef.current.push(centerLine)
        fabricCanvas.add(centerLine)
      }

      // Show horizontal center line when near center
      if (Math.abs(objCenterY - canvasCenterY) < gridPx) {
        const centerLine = new Line([0, canvasCenterY, canvasWidth, canvasCenterY], {
          stroke: '#ff6b6b',
          strokeWidth: 1,
          selectable: false,
          evented: false,
          strokeDashArray: [5, 5],
        })
        centerLine.set('data', { isAlignmentLine: true })
        alignmentLinesRef.current.push(centerLine)
        fabricCanvas.add(centerLine)
      }
    }

    const handleObjectModifiedWithCleanup = () => {
      clearAlignmentLines(fabricCanvas)
      onCanvasChange?.()
    }

    // Helper to clear alignment lines
    const clearAlignmentLines = (canvas: Canvas) => {
      alignmentLinesRef.current.forEach((line) => {
        canvas.remove(line)
      })
      alignmentLinesRef.current = []
    }

    fabricCanvas.on('selection:created', handleSelection)
    fabricCanvas.on('selection:updated', handleSelection)
    fabricCanvas.on('selection:cleared', handleSelectionCleared)
    fabricCanvas.on('object:modified', handleObjectModifiedWithCleanup)
    fabricCanvas.on('object:added', handleObjectModified)
    fabricCanvas.on('object:removed', handleObjectModified)
    fabricCanvas.on('object:moving', handleObjectMoving)

    setCanvas(fabricCanvas)
    isInitializedRef.current = true

    return () => {
      fabricCanvas.off('selection:created', handleSelection)
      fabricCanvas.off('selection:updated', handleSelection)
      fabricCanvas.off('selection:cleared', handleSelectionCleared)
      fabricCanvas.off('object:modified', handleObjectModifiedWithCleanup)
      fabricCanvas.off('object:added', handleObjectModified)
      fabricCanvas.off('object:removed', handleObjectModified)
      fabricCanvas.off('object:moving', handleObjectMoving)
      clearAlignmentLines(fabricCanvas)
      fabricCanvas.dispose()
      isInitializedRef.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef, mmToPx, onSelectionChange, onCanvasChange])

  // Update canvas size when dimensions change
  useEffect(() => {
    // Check if canvas exists and is still valid (not disposed)
    if (!canvas || !canvas.lowerCanvasEl) return

    try {
      canvas.setDimensions({
        width: mmToPx(cardWidth),
        height: mmToPx(cardHeight),
      })
      canvas.renderAll()
    } catch (e) {
      // Canvas may have been disposed, ignore the error
      console.warn('Canvas dimension update skipped:', e)
    }
  }, [canvas, cardWidth, cardHeight, mmToPx])

  // Generate unique ID for objects
  const generateId = useCallback(() => {
    return `obj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }, [])

  // Add static text
  const addText = useCallback((text: string = 'Text', options?: Partial<Textbox>) => {
    if (!canvas) return null

    const textbox = new Textbox(text, {
      left: mmToPx(10),
      top: mmToPx(10),
      width: mmToPx(40),
      fontFamily: DEFAULT_TEXT_PROPS.fontFamily,
      fontSize: DEFAULT_TEXT_PROPS.fontSize,
      fill: DEFAULT_TEXT_PROPS.fill,
      ...options,
    })

    const data: DesignerObjectData = { elementType: 'text' }
    textbox.set('data', data)
    textbox.set('id', generateId())

    canvas.add(textbox)
    canvas.setActiveObject(textbox)
    canvas.renderAll()
    return textbox
  }, [canvas, mmToPx, generateId])

  // Add dynamic text (placeholder)
  const addDynamicText = useCallback((fieldId: string, defaultText: string = '{{field}}') => {
    if (!canvas) return null

    const textbox = new Textbox(defaultText, {
      left: mmToPx(10),
      top: mmToPx(10),
      width: mmToPx(40),
      fontFamily: DEFAULT_TEXT_PROPS.fontFamily,
      fontSize: DEFAULT_TEXT_PROPS.fontSize,
      fill: DEFAULT_TEXT_PROPS.fill,
    })

    const data: DesignerObjectData = {
      elementType: 'dynamic-text',
      isDynamic: true,
      fieldId,
      dynamicConfig: {
        fieldId,
        defaultText,
      },
    }
    textbox.set('data', data)
    textbox.set('id', generateId())

    canvas.add(textbox)
    canvas.setActiveObject(textbox)
    canvas.renderAll()
    return textbox
  }, [canvas, mmToPx, generateId])

  // Add rectangle
  const addRectangle = useCallback((options?: Partial<Rect>) => {
    if (!canvas) return null

    const rect = new Rect({
      left: mmToPx(10),
      top: mmToPx(10),
      width: mmToPx(30),
      height: mmToPx(20),
      fill: DEFAULT_SHAPE_PROPS.fill,
      stroke: DEFAULT_SHAPE_PROPS.stroke,
      strokeWidth: DEFAULT_SHAPE_PROPS.strokeWidth,
      rx: 0,
      ry: 0,
      ...options,
    })

    const data: DesignerObjectData = { elementType: 'rectangle' }
    rect.set('data', data)
    rect.set('id', generateId())

    canvas.add(rect)
    canvas.setActiveObject(rect)
    canvas.renderAll()
    return rect
  }, [canvas, mmToPx, generateId])

  // Add circle
  const addCircle = useCallback((options?: Partial<Circle>) => {
    if (!canvas) return null

    const circle = new Circle({
      left: mmToPx(10),
      top: mmToPx(10),
      radius: mmToPx(15),
      fill: DEFAULT_SHAPE_PROPS.fill,
      stroke: DEFAULT_SHAPE_PROPS.stroke,
      strokeWidth: DEFAULT_SHAPE_PROPS.strokeWidth,
      ...options,
    })

    const data: DesignerObjectData = { elementType: 'circle' }
    circle.set('data', data)
    circle.set('id', generateId())

    canvas.add(circle)
    canvas.setActiveObject(circle)
    canvas.renderAll()
    return circle
  }, [canvas, mmToPx, generateId])

  // Add line
  const addLine = useCallback((options?: Partial<Line>) => {
    if (!canvas) return null

    const line = new Line([0, 0, mmToPx(40), 0], {
      left: mmToPx(10),
      top: mmToPx(25),
      stroke: '#000000',
      strokeWidth: 2,
      ...options,
    })

    const data: DesignerObjectData = { elementType: 'line' }
    line.set('data', data)
    line.set('id', generateId())

    canvas.add(line)
    canvas.setActiveObject(line)
    canvas.renderAll()
    return line
  }, [canvas, mmToPx, generateId])

  // Add image placeholder (rectangle with dashed border)
  const addImagePlaceholder = useCallback((fieldId: string, options?: Partial<Rect>) => {
    if (!canvas) return null

    const placeholder = new Rect({
      left: mmToPx(10),
      top: mmToPx(10),
      width: mmToPx(25),
      height: mmToPx(30),
      fill: DEFAULT_IMAGE_PLACEHOLDER_PROPS.fill,
      stroke: DEFAULT_IMAGE_PLACEHOLDER_PROPS.stroke,
      strokeWidth: DEFAULT_IMAGE_PLACEHOLDER_PROPS.strokeWidth,
      strokeDashArray: DEFAULT_IMAGE_PLACEHOLDER_PROPS.strokeDashArray,
      rx: 2,
      ry: 2,
      ...options,
    })

    const data: DesignerObjectData = {
      elementType: 'image-placeholder',
      fieldId,
      imagePlaceholderConfig: {
        fieldId,
        fitMode: 'cover',
      },
    }
    placeholder.set('data', data)
    placeholder.set('id', generateId())

    canvas.add(placeholder)
    canvas.setActiveObject(placeholder)
    canvas.renderAll()
    return placeholder
  }, [canvas, mmToPx, generateId])

  // Add barcode element
  const addBarcode = useCallback(async (
    fieldId: string,
    barcodeType: BarcodeType = 'code128'
  ) => {
    if (!canvas) return null

    const width = mmToPx(35)
    const height = barcodeType === 'qrcode' ? mmToPx(20) : mmToPx(15)

    try {
      // Generate a preview barcode image
      const dataUrl = await generateBarcodePreview(barcodeType, width, height)

      // Create image from data URL
      const imgElement = new Image()
      imgElement.src = dataUrl

      await new Promise((resolve, reject) => {
        imgElement.onload = resolve
        imgElement.onerror = reject
      })

      const fabricImage = new FabricImage(imgElement, {
        left: mmToPx(10),
        top: mmToPx(10),
      })

      const data: DesignerObjectData = {
        elementType: 'barcode',
        fieldId,
        barcodeConfig: {
          fieldId,
          barcodeType,
        },
      }
      fabricImage.set('data', data)
      fabricImage.set('id', generateId())

      canvas.add(fabricImage)
      canvas.setActiveObject(fabricImage)
      canvas.renderAll()
      return fabricImage
    } catch (error) {
      console.error('Failed to add barcode:', error)

      // Fallback: add a placeholder rectangle
      const placeholder = new Rect({
        left: mmToPx(10),
        top: mmToPx(10),
        width,
        height,
        fill: '#f5f5f5',
        stroke: '#999999',
        strokeWidth: 1,
        strokeDashArray: [3, 3],
      })

      const data: DesignerObjectData = {
        elementType: 'barcode',
        fieldId,
        barcodeConfig: {
          fieldId,
          barcodeType,
        },
      }
      placeholder.set('data', data)
      placeholder.set('id', generateId())

      canvas.add(placeholder)
      canvas.setActiveObject(placeholder)
      canvas.renderAll()
      return placeholder
    }
  }, [canvas, mmToPx, generateId])

  // Delete selected objects
  const deleteSelected = useCallback(() => {
    if (!canvas) return

    const activeObjects = canvas.getActiveObjects()
    activeObjects.forEach((obj) => {
      canvas.remove(obj)
    })
    canvas.discardActiveObject()
    canvas.renderAll()
  }, [canvas])

  // Bring to front
  const bringToFront = useCallback(() => {
    if (!canvas) return
    const activeObject = canvas.getActiveObject()
    if (activeObject) {
      canvas.bringObjectToFront(activeObject)
      canvas.renderAll()
    }
  }, [canvas])

  // Send to back
  const sendToBack = useCallback(() => {
    if (!canvas) return
    const activeObject = canvas.getActiveObject()
    if (activeObject) {
      canvas.sendObjectToBack(activeObject)
      canvas.renderAll()
    }
  }, [canvas])

  // Serialize canvas to JSON
  const toJSON = useCallback((): string => {
    if (!canvas) return '{}'
    return JSON.stringify((canvas as unknown as { toJSON: (props: string[]) => object }).toJSON(['id', 'data']))
  }, [canvas])

  // Load canvas from JSON
  const loadFromJSON = useCallback(async (json: string): Promise<void> => {
    if (!canvas) return

    try {
      const parsed = JSON.parse(json)
      await canvas.loadFromJSON(parsed)
      canvas.renderAll()
    } catch (err) {
      console.error('Failed to load canvas from JSON:', err)
    }
  }, [canvas])

  // Export to SVG
  const toSVG = useCallback((): string => {
    if (!canvas) return ''
    return canvas.toSVG({
      width: `${cardWidth}mm`,
      height: `${cardHeight}mm`,
      viewBox: {
        x: 0,
        y: 0,
        width: mmToPx(cardWidth),
        height: mmToPx(cardHeight),
      },
    })
  }, [canvas, cardWidth, cardHeight, mmToPx])

  // Clear canvas
  const clear = useCallback(() => {
    if (!canvas) return
    canvas.clear()
    canvas.backgroundColor = '#ffffff'
    canvas.renderAll()
  }, [canvas])

  // Get all objects
  const getObjects = useCallback((): FabricObject[] => {
    if (!canvas) return []
    return canvas.getObjects()
  }, [canvas])

  // Update object property
  const updateObjectProperty = useCallback((
    objectId: string,
    property: string,
    value: unknown
  ) => {
    if (!canvas) return

    const obj = canvas.getObjects().find((o) => o.get('id') === objectId)
    if (obj) {
      obj.set(property as keyof FabricObject, value)
      canvas.renderAll()
      onCanvasChange?.()
    }
  }, [canvas, onCanvasChange])

  // Deselect all
  const deselectAll = useCallback(() => {
    if (!canvas) return
    canvas.discardActiveObject()
    canvas.renderAll()
  }, [canvas])

  return {
    canvas,
    selectedObjects,
    // Dimensions
    mmToPx,
    pxToMm,
    // Add elements
    addText,
    addDynamicText,
    addRectangle,
    addCircle,
    addLine,
    addImagePlaceholder,
    addBarcode,
    // Object operations
    deleteSelected,
    bringToFront,
    sendToBack,
    deselectAll,
    updateObjectProperty,
    // Canvas operations
    getObjects,
    clear,
    // Serialization
    toJSON,
    loadFromJSON,
    toSVG,
  }
}
