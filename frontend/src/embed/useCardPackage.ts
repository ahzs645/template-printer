import { useEffect, useState } from 'react'

import { openCardPackage, type CardPackage } from '../lib/cardPrint'
import type { PackageBytes } from '../lib/packageUrl'

type Loaded = { source: PackageBytes | null; card: CardPackage | null; error: Error | null }

/**
 * A template package opened for filling and printing (see `openCardPackage`).
 * Opened again whenever a different object is passed. While a new one opens,
 * the previous card stays, so a preview does not blink.
 */
export function useCardPackage(bytes: PackageBytes | null | undefined): {
  card: CardPackage | null
  error: Error | null
  loading: boolean
} {
  const [loaded, setLoaded] = useState<Loaded>({ source: null, card: null, error: null })

  useEffect(() => {
    if (!bytes) return
    let live = true
    openCardPackage(bytes).then(
      (card) => { if (live) setLoaded({ source: bytes, card, error: null }) },
      (error) => { if (live) setLoaded((previous) => ({ source: bytes, card: previous.card, error: error instanceof Error ? error : new Error(String(error)) })) },
    )
    return () => { live = false }
  }, [bytes])

  if (!bytes) return { card: null, error: null, loading: false }
  return { card: loaded.card, error: loaded.source === bytes ? loaded.error : null, loading: loaded.source !== bytes }
}
