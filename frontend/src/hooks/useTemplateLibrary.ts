import { useCallback, useEffect, useState } from 'react'

import type { TemplateSummary, TemplateType } from '../lib/templates'
import { useStorage } from '../lib/storage'

export function useTemplateLibrary(type?: TemplateType) {
  const storage = useStorage()
  const [templates, setTemplates] = useState<TemplateSummary[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await storage.listTemplates(type)
      setTemplates(data)
      setError(null)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Unable to load templates')
    } finally {
      setIsLoading(false)
    }
  }, [storage, type])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  return {
    templates,
    isLoading,
    error,
    reload: fetchTemplates,
  }
}
