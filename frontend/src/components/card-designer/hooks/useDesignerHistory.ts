import { useState, useCallback, useEffect, useRef } from 'react'
import type { Canvas } from 'fabric'

const MAX_HISTORY_SIZE = 50

type UseDesignerHistoryOptions = {
  canvas: Canvas | null
  onStateChange?: () => void
}

export function useDesignerHistory({ canvas, onStateChange }: UseDesignerHistoryOptions) {
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const isRestoringRef = useRef(false)
  const lastSavedStateRef = useRef<string | null>(null)

  // Save the current state to history
  const saveState = useCallback(() => {
    if (!canvas || isRestoringRef.current) return

    const currentState = JSON.stringify((canvas as unknown as { toJSON: (props: string[]) => object }).toJSON(['id', 'data']))

    // Don't save if state hasn't changed
    if (currentState === lastSavedStateRef.current) return

    lastSavedStateRef.current = currentState

    setHistory((prev) => {
      // Remove any future states if we're in the middle of history
      const newHistory = prev.slice(0, historyIndex + 1)

      // Add current state
      newHistory.push(currentState)

      // Limit history size
      if (newHistory.length > MAX_HISTORY_SIZE) {
        newHistory.shift()
      }

      return newHistory
    })

    setHistoryIndex((prev) => {
      const newIndex = Math.min(prev + 1, MAX_HISTORY_SIZE - 1)
      return newIndex
    })
  }, [canvas, historyIndex])

  // Restore a state from history
  const restoreState = useCallback(async (state: string) => {
    if (!canvas) return

    isRestoringRef.current = true

    try {
      const parsed = JSON.parse(state)
      await canvas.loadFromJSON(parsed)
      canvas.renderAll()
      lastSavedStateRef.current = state
      onStateChange?.()
    } catch (err) {
      console.error('Failed to restore canvas state:', err)
    } finally {
      isRestoringRef.current = false
    }
  }, [canvas, onStateChange])

  // Undo - go back one state
  const undo = useCallback(() => {
    if (historyIndex <= 0 || !history[historyIndex - 1]) return

    const prevIndex = historyIndex - 1
    setHistoryIndex(prevIndex)
    restoreState(history[prevIndex])
  }, [historyIndex, history, restoreState])

  // Redo - go forward one state
  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1 || !history[historyIndex + 1]) return

    const nextIndex = historyIndex + 1
    setHistoryIndex(nextIndex)
    restoreState(history[nextIndex])
  }, [historyIndex, history, restoreState])

  // Check if undo/redo is available
  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  // Clear history (e.g., when switching sides)
  const clearHistory = useCallback(() => {
    setHistory([])
    setHistoryIndex(-1)
    lastSavedStateRef.current = null
  }, [])

  // Initialize with current canvas state
  useEffect(() => {
    if (canvas && history.length === 0) {
      // Save initial state
      const initialState = JSON.stringify((canvas as unknown as { toJSON: (props: string[]) => object }).toJSON(['id', 'data']))
      setHistory([initialState])
      setHistoryIndex(0)
      lastSavedStateRef.current = initialState
    }
  }, [canvas, history.length])

  // Listen for canvas modifications and save state
  useEffect(() => {
    if (!canvas) return

    const handleModification = () => {
      // Debounce to avoid saving too frequently
      setTimeout(() => {
        saveState()
      }, 100)
    }

    canvas.on('object:modified', handleModification)
    canvas.on('object:added', handleModification)
    canvas.on('object:removed', handleModification)

    return () => {
      canvas.off('object:modified', handleModification)
      canvas.off('object:added', handleModification)
      canvas.off('object:removed', handleModification)
    }
  }, [canvas, saveState])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey

      // Undo: Ctrl/Cmd + Z
      if (ctrlOrCmd && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }

      // Redo: Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z
      if (ctrlOrCmd && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  return {
    undo,
    redo,
    canUndo,
    canRedo,
    saveState,
    clearHistory,
    historyLength: history.length,
    currentIndex: historyIndex,
  }
}
