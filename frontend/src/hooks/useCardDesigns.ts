import { useCallback, useEffect, useState } from 'react'

import type { CardDesign } from '../lib/types'
import type { CardDesignPayload } from '../lib/api'
import { useStorage } from '../lib/storage'

function sortDesigns(designs: CardDesign[]): CardDesign[] {
  return [...designs].sort((a, b) => a.name.localeCompare(b.name))
}

export function useCardDesigns() {
  const storage = useStorage()
  const [designs, setDesigns] = useState<CardDesign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDesigns = useCallback(async () => {
    setLoading(true)
    try {
      const items = await storage.listCardDesigns()
      setDesigns(sortDesigns(items))
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load card designs'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [storage])

  useEffect(() => {
    fetchDesigns()
  }, [fetchDesigns])

  const createDesign = useCallback(async (payload: CardDesignPayload) => {
    const created = await storage.createCardDesign(payload)
    setDesigns((prev) => sortDesigns([...prev, created]))
    return created
  }, [storage])

  const updateDesign = useCallback(async (id: string, payload: Partial<CardDesignPayload>) => {
    const updated = await storage.updateCardDesign(id, payload)
    setDesigns((prev) => sortDesigns(prev.map((design) => (design.id === id ? updated : design))))
    return updated
  }, [storage])

  const deleteDesign = useCallback(async (id: string) => {
    await storage.deleteCardDesign(id)
    setDesigns((prev) => prev.filter((design) => design.id !== id))
  }, [storage])

  return {
    designs,
    loading,
    error,
    refresh: fetchDesigns,
    createDesign,
    updateDesign,
    deleteDesign,
  }
}
