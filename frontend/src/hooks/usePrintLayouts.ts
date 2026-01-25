import { useCallback, useEffect, useState } from 'react'
import type { PrintLayout } from '../lib/types'
import { useStorage } from '../lib/storage/StorageContext'

export function usePrintLayouts() {
  const storage = useStorage()
  const [printLayouts, setPrintLayouts] = useState<PrintLayout[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPrintLayouts = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const layouts = await storage.listPrintLayouts()
      setPrintLayouts(layouts)
    } catch (err) {
      console.error('Failed to load print layouts:', err)
      setError(err instanceof Error ? err.message : 'Failed to load print layouts')
    } finally {
      setIsLoading(false)
    }
  }, [storage])

  useEffect(() => {
    loadPrintLayouts()
  }, [loadPrintLayouts])

  const getPrintLayoutById = useCallback(
    (id: string): PrintLayout | undefined => {
      return printLayouts.find(layout => layout.id === id)
    },
    [printLayouts]
  )

  return {
    printLayouts,
    isLoading,
    error,
    refresh: loadPrintLayouts,
    getPrintLayoutById,
  }
}
