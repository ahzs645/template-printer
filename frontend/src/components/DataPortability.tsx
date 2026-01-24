import { useState, useRef } from 'react'
import { Download, Upload, AlertCircle, CheckCircle } from 'lucide-react'
import { useStorage, getStorageMode } from '../lib/storage'
import type { ExportData } from '../lib/storage'

interface DataPortabilityProps {
  className?: string
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

      const confirmMessage = storageMode === 'local'
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
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700">
          {storageMode === 'local' ? 'Local Storage' : 'Server Storage'}
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
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
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

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Export creates a backup file containing all templates, users, card designs, fonts, and color profiles.
        {storageMode === 'local' && ' Import will completely replace all existing data.'}
        {storageMode === 'server' && ' Import will add data to the existing database.'}
      </p>
    </div>
  )
}
