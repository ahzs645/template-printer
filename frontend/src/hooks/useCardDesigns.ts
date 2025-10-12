import { useCallback, useEffect, useState } from 'react'

import type { CardDesign } from '../lib/types'
import {
  listCardDesigns as listCardDesignsApi,
  createCardDesign as createCardDesignApi,
  updateCardDesign as updateCardDesignApi,
  deleteCardDesign as deleteCardDesignApi,
  type CardDesignPayload,
} from '../lib/api'

function sortDesigns(designs: CardDesign[]): CardDesign[] {
  return [...designs].sort((a, b) => a.name.localeCompare(b.name))
}

export function useCardDesigns() {
  const [designs, setDesigns] = useState<CardDesign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDesigns = useCallback(async () => {
    setLoading(true)
    try {
      const items = await listCardDesignsApi()
      setDesigns(sortDesigns(items))
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load card designs'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDesigns()
  }, [fetchDesigns])

  const createDesign = useCallback(async (payload: CardDesignPayload) => {
    const created = await createCardDesignApi(payload)
    setDesigns((prev) => sortDesigns([...prev, created]))
    return created
  }, [])

  const updateDesign = useCallback(async (id: string, payload: Partial<CardDesignPayload>) => {
    const updated = await updateCardDesignApi(id, payload)
    setDesigns((prev) => sortDesigns(prev.map((design) => (design.id === id ? updated : design))))
    return updated
  }, [])

  const deleteDesign = useCallback(async (id: string) => {
    await deleteCardDesignApi(id)
    setDesigns((prev) => prev.filter((design) => design.id !== id))
  }, [])

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
