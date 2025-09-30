import { useCallback, useEffect, useState } from 'react'

import type { TemplateSummary, TemplateType } from '../lib/templates'

export function useTemplateLibrary(type?: TemplateType) {
  const [templates, setTemplates] = useState<TemplateSummary[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true)
    try {
      const url = type ? `/api/templates?type=${type}` : '/api/templates'
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to load templates (${response.status})`)
      }
      const data: TemplateSummary[] = await response.json()
      setTemplates(data)
      setError(null)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Unable to load templates')
    } finally {
      setIsLoading(false)
    }
  }, [type])

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
