import { useState, useRef } from 'react'
import { Download, Upload, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Button } from './ui/button'
import { useStorage } from '../lib/storage'
import type { ExportData } from '../lib/storage'

type SettingsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDataImported?: () => void
}

export function SettingsDialog({ open, onOpenChange, onDataImported }: SettingsDialogProps) {
  const storage = useStorage()
  const importInputRef = useRef<HTMLInputElement>(null)

  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const handleExport = async () => {
    setExporting(true)
    setStatus(null)

    try {
      // Get all data from storage
      const exportData = await storage.exportAllData()

      // Create ZIP file
      const zip = new JSZip()

      // Add the main data JSON
      zip.file('data.json', JSON.stringify(exportData, null, 2))

      // Add metadata
      const metadata = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        templateCount: exportData.templates.length,
        userCount: exportData.users.length,
        cardDesignCount: exportData.cardDesigns.length,
        fontCount: exportData.fonts.length,
        colorProfileCount: exportData.colorProfiles.length,
      }
      zip.file('metadata.json', JSON.stringify(metadata, null, 2))

      // Generate the ZIP file
      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      })

      // Create filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const filename = `template-printer-backup-${timestamp}.zip`

      // Trigger download
      saveAs(blob, filename)

      setStatus({
        type: 'success',
        message: `Exported ${exportData.templates.length} templates, ${exportData.users.length} users, ${exportData.cardDesigns.length} designs, ${exportData.fonts.length} fonts`
      })
    } catch (error) {
      console.error('Export failed:', error)
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to export data'
      })
    } finally {
      setExporting(false)
    }
  }

  const handleImportClick = () => {
    importInputRef.current?.click()
  }

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = '' // Reset input

    if (!file) return

    // Validate file type
    if (!file.name.endsWith('.zip')) {
      setStatus({
        type: 'error',
        message: 'Please select a ZIP file'
      })
      return
    }

    setImporting(true)
    setStatus(null)

    try {
      // Read and parse ZIP file
      const zip = await JSZip.loadAsync(file)

      // Check for data.json
      const dataFile = zip.file('data.json')
      if (!dataFile) {
        throw new Error('Invalid backup file: data.json not found')
      }

      // Parse the export data
      const dataJson = await dataFile.async('string')
      const exportData: ExportData = JSON.parse(dataJson)

      // Validate the data structure
      if (!exportData.version || !exportData.templates || !exportData.users) {
        throw new Error('Invalid backup file: missing required data')
      }

      // Confirm import (will overwrite existing data)
      const confirmMessage = `This will replace all existing data with:\n\n` +
        `• ${exportData.templates.length} templates\n` +
        `• ${exportData.users.length} users\n` +
        `• ${exportData.cardDesigns.length} card designs\n` +
        `• ${exportData.fonts.length} fonts\n` +
        `• ${exportData.colorProfiles.length} color profiles\n\n` +
        `Continue?`

      if (!confirm(confirmMessage)) {
        setStatus(null)
        setImporting(false)
        return
      }

      // Import the data
      await storage.importAllData(exportData)

      setStatus({
        type: 'success',
        message: `Imported ${exportData.templates.length} templates, ${exportData.users.length} users, ${exportData.cardDesigns.length} designs, ${exportData.fonts.length} fonts`
      })

      // Notify parent to refresh data
      onDataImported?.()

    } catch (error) {
      console.error('Import failed:', error)
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to import data'
      })
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ maxWidth: 480 }}>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage your workspace data and preferences
          </DialogDescription>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingTop: 8 }}>
          {/* Data Management Section */}
          <div>
            <h3 style={{
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 12,
              color: 'var(--text-primary)'
            }}>
              Data Management
            </h3>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              padding: 16,
              backgroundColor: 'var(--bg-surface-alt)',
              borderRadius: 8,
            }}>
              {/* Export */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>Export Workspace</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Download all templates, users, designs, and fonts as a ZIP file
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={handleExport}
                  disabled={exporting || importing}
                >
                  {exporting ? (
                    <Loader2 size={14} style={{ marginRight: 6 }} className="animate-spin" />
                  ) : (
                    <Download size={14} style={{ marginRight: 6 }} />
                  )}
                  {exporting ? 'Exporting...' : 'Export'}
                </Button>
              </div>

              <div style={{
                height: 1,
                backgroundColor: 'var(--border-color)',
                margin: '4px 0'
              }} />

              {/* Import */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>Import Workspace</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Restore from a previously exported ZIP backup
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleImportClick}
                  disabled={exporting || importing}
                >
                  {importing ? (
                    <Loader2 size={14} style={{ marginRight: 6 }} className="animate-spin" />
                  ) : (
                    <Upload size={14} style={{ marginRight: 6 }} />
                  )}
                  {importing ? 'Importing...' : 'Import'}
                </Button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".zip"
                  onChange={handleImportFile}
                  style={{ display: 'none' }}
                />
              </div>
            </div>

            {/* Status Message */}
            {status && (
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                marginTop: 12,
                padding: 12,
                borderRadius: 6,
                fontSize: 13,
                backgroundColor: status.type === 'success'
                  ? 'var(--success-bg, rgba(34, 197, 94, 0.1))'
                  : 'var(--error-bg, rgba(239, 68, 68, 0.1))',
                color: status.type === 'success'
                  ? 'var(--success, #22c55e)'
                  : 'var(--danger, #ef4444)',
              }}>
                {status.type === 'success' ? (
                  <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                ) : (
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                )}
                <span>{status.message}</span>
              </div>
            )}
          </div>

          {/* Info Section */}
          <div style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            padding: 12,
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 6,
            border: '1px solid var(--border-color)'
          }}>
            <strong>What's included in the export:</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
              <li>All SVG templates and their content</li>
              <li>Field mappings for each template</li>
              <li>User database with all fields</li>
              <li>Card designs (template-based and canvas-based)</li>
              <li>Uploaded fonts</li>
              <li>Color calibration profiles</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
