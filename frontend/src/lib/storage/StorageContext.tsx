import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { ApiStorageProvider } from './ApiStorageProvider'
import { ConvexStorageProvider } from './ConvexStorageProvider'
import { IndexedDBStorageProvider } from './IndexedDBStorageProvider'
import type { StorageProvider, StorageMode } from './types'

/**
 * The storage mode the standalone app was built for (VITE_STORAGE_MODE).
 *
 * Only the standalone entry reads this: an embedding host names its mode on
 * the TemplatePrinter component, so nothing about it depends on how the host
 * was built.
 */
export function storageModeFromEnv(): StorageMode {
  return (import.meta.env.VITE_STORAGE_MODE as StorageMode | undefined) || 'server'
}

/** The Convex deployment the standalone app was built against, if any. */
export function convexUrlFromEnv(): string | undefined {
  return (import.meta.env.VITE_CONVEX_URL as string | undefined) || undefined
}

type StorageContextValue = {
  provider: StorageProvider
  mode: StorageMode
  convexUrl?: string
}

const StorageContext = createContext<StorageContextValue | null>(null)

// Singleton instances to prevent multiple DB connections
let apiProviderInstance: ApiStorageProvider | null = null
let indexedDBProviderInstance: IndexedDBStorageProvider | null = null
const convexProviderInstances = new Map<string, ConvexStorageProvider>()

// The provider the mounted printer is using, for the few modules that read
// storage outside React (lib/templates.ts). A page runs one printer at a time.
let active: StorageContextValue | null = null

function isConvex(mode: StorageMode): boolean {
  return mode === 'convex-local' || mode === 'convex-cloud'
}

function createStorageProvider(mode: StorageMode, convexUrl?: string): StorageProvider {
  if (mode === 'local') {
    if (!indexedDBProviderInstance) {
      indexedDBProviderInstance = new IndexedDBStorageProvider()
    }
    return indexedDBProviderInstance
  }

  if (isConvex(mode)) {
    const key = convexUrl ?? ''
    let instance = convexProviderInstances.get(key)
    if (!instance) {
      instance = new ConvexStorageProvider(convexUrl)
      convexProviderInstances.set(key, instance)
    }
    return instance
  }

  if (!apiProviderInstance) {
    apiProviderInstance = new ApiStorageProvider()
  }
  return apiProviderInstance
}

interface StorageProviderRootProps {
  children: ReactNode
  /** Which backing store to use. */
  mode: StorageMode
  /** The Convex deployment, for the Convex modes. */
  convexUrl?: string
}

/**
 * Root provider component that wraps the application and provides storage access
 */
export function StorageProviderRoot({ children, mode, convexUrl }: StorageProviderRootProps) {
  const value = useMemo<StorageContextValue>(() => {
    const next = { provider: createStorageProvider(mode, convexUrl), mode, convexUrl }
    // Set while rendering, so modules outside React see it before any child
    // effect can ask for a template.
    active = next
    return next
  }, [mode, convexUrl])

  return (
    <StorageContext.Provider value={value}>
      {children}
    </StorageContext.Provider>
  )
}

function useStorageContext(): StorageContextValue {
  const ctx = useContext(StorageContext)
  if (!ctx) {
    throw new Error('useStorage must be used within StorageProviderRoot')
  }
  return ctx
}

/**
 * Hook to access the storage provider
 * @throws Error if used outside of StorageProviderRoot
 */
export function useStorage(): StorageProvider {
  return useStorageContext().provider
}

/** The storage mode and Convex deployment of the printer this is rendered in. */
export function useStorageMode(): { mode: StorageMode; convexUrl?: string } {
  const { mode, convexUrl } = useStorageContext()
  return { mode, convexUrl }
}

/**
 * Get the current storage mode
 */
export function getStorageMode(): StorageMode {
  return active?.mode ?? storageModeFromEnv()
}

/**
 * Check if running in local (client-only) mode
 */
export function isLocalMode(): boolean {
  return getStorageMode() === 'local'
}

/**
 * Check if running against Convex storage
 */
export function isConvexMode(): boolean {
  return isConvex(getStorageMode())
}

/**
 * Check if running in server mode
 */
export function isServerMode(): boolean {
  return getStorageMode() === 'server'
}

/**
 * Get the storage provider instance directly (for use outside of React components)
 */
export function getStorageInstance(): StorageProvider {
  if (active) return active.provider
  return createStorageProvider(storageModeFromEnv(), convexUrlFromEnv())
}
