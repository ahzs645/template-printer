import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { ApiStorageProvider } from './ApiStorageProvider'
import { IndexedDBStorageProvider } from './IndexedDBStorageProvider'
import type { StorageProvider, StorageMode } from './types'

// Get storage mode from environment variable (build-time)
const STORAGE_MODE: StorageMode = (import.meta.env.VITE_STORAGE_MODE as StorageMode) || 'server'

const StorageContext = createContext<StorageProvider | null>(null)

// Singleton instances to prevent multiple DB connections
let apiProviderInstance: ApiStorageProvider | null = null
let indexedDBProviderInstance: IndexedDBStorageProvider | null = null

function getStorageProvider(): StorageProvider {
  if (STORAGE_MODE === 'local') {
    if (!indexedDBProviderInstance) {
      indexedDBProviderInstance = new IndexedDBStorageProvider()
    }
    return indexedDBProviderInstance
  }

  if (!apiProviderInstance) {
    apiProviderInstance = new ApiStorageProvider()
  }
  return apiProviderInstance
}

interface StorageProviderRootProps {
  children: ReactNode
}

/**
 * Root provider component that wraps the application and provides storage access
 */
export function StorageProviderRoot({ children }: StorageProviderRootProps) {
  const provider = useMemo(() => getStorageProvider(), [])

  return (
    <StorageContext.Provider value={provider}>
      {children}
    </StorageContext.Provider>
  )
}

/**
 * Hook to access the storage provider
 * @throws Error if used outside of StorageProviderRoot
 */
export function useStorage(): StorageProvider {
  const ctx = useContext(StorageContext)
  if (!ctx) {
    throw new Error('useStorage must be used within StorageProviderRoot')
  }
  return ctx
}

/**
 * Get the current storage mode
 */
export function getStorageMode(): StorageMode {
  return STORAGE_MODE
}

/**
 * Check if running in local (client-only) mode
 */
export function isLocalMode(): boolean {
  return STORAGE_MODE === 'local'
}

/**
 * Check if running in server mode
 */
export function isServerMode(): boolean {
  return STORAGE_MODE === 'server'
}

/**
 * Get the storage provider instance directly (for use outside of React components)
 */
export function getStorageInstance(): StorageProvider {
  return getStorageProvider()
}
