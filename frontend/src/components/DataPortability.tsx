import { useState, useRef } from 'react'
import { Download, Upload, AlertCircle, CheckCircle } from 'lucide-react'
import { useStorage, getStorageMode } from '../lib/storage'
import type { ExportData, StorageMode } from '../lib/storage'

interface DataPortabilityProps {
  className?: string
}

function getStorageModeLabel(storageMode: StorageMode): string {
  switch (storageMode) {
    case 'local':
      return 'Local Storage'
    case 'convex-local':
      return 'Convex Local'
    case 'convex-cloud':
      return 'Convex Cloud'
    case 'server':
    default:
      return 'Server Storage'
  }
}

export function DataPortability({ className = '' }: DataPortabilityProps) {
  const storage = useStorage()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const storageMode = getStorageMode()

  const handleExport = async () => {
    setIsExporting(true)
    setMessage(null)

    try {
      const data = await storage.exportAllData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = url
      link.download = `template-printer-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      URL.revokeObjectURL(url)
      setMessage({ type: 'success', text: 'Data exported successfully!' })
    } catch (error) {
      console.error('Export failed:', error)
      setMessage({ type: 'error', text: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}` })
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    setMessage(null)

    try {
      const text = await file.text()
      const data = JSON.parse(text) as ExportData

      // Validate the data structure
      if (!data.version || !data.templates || !data.users) {
        throw new Error('Invalid backup file format')
      }

      const replacesExistingData = storageMode === 'local' || storageMode.startsWith('convex-')
      const confirmMessage = replacesExistingData
        ? 'This will replace ALL existing data. Are you sure you want to continue?'
        : 'This will import data and may create duplicates. Are you sure you want to continue?'

      if (!window.confirm(confirmMessage)) {
        setIsImporting(false)
        return
      }

      await storage.importAllData(data)

      setMessage({ type: 'success', text: 'Data imported successfully! Refreshing...' })

      // Refresh the page to load new data
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (error) {
      console.error('Import failed:', error)
      setMessage({ type: 'error', text: `Import failed: ${error instanceof Error ? error.message : 'Invalid file'}` })
    } finally {
      setIsImporting(false)
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-2 text-sm text-ink-muted">
        <span className="rounded px-2 py-0.5 text-xs font-medium bg-surface-alt text-ink">
          {getStorageModeLabel(storageMode)}
        </span>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleExport}
          disabled={isExporting || isImporting}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Download className="w-4 h-4" />
          {isExporting ? 'Exporting...' : 'Export All Data'}
        </button>

        <button
          onClick={handleImportClick}
          disabled={isExporting || isImporting}
          className="flex h-control items-center gap-2 rounded-control bg-surface-alt px-4 text-sm font-medium text-ink transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Upload className="w-4 h-4" />
          {isImporting ? 'Importing...' : 'Import Data'}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-success-soft text-success'
              : 'bg-danger-soft text-danger'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <p className="text-xs text-ink-muted">
        Export creates a backup file containing all templates, users, card designs, fonts, and color profiles.
        {(storageMode === 'local' || storageMode.startsWith('convex-')) && ' Import will completely replace all existing data.'}
        {storageMode === 'server' && ' Import will add data to the existing database.'}
      </p>
    </div>
  )
}
