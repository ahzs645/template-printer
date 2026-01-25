import { useState, useRef } from 'react'
import { Download, Upload, AlertCircle, CheckCircle2, Loader2, Database, HardDrive } from 'lucide-react'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

import { Button } from './ui/button'
import { useStorage, getStorageMode } from '../lib/storage'
import type { ExportData } from '../lib/storage'

type SettingsTabProps = {
  onDataImported?: () => void
}

export function SettingsTab({ onDataImported }: SettingsTabProps) {
  const storage = useStorage()
  const storageMode = getStorageMode()
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

      // Generate the ZIP file as uint8array first, then create blob with correct type
      const zipData = await zip.generateAsync({
        type: 'uint8array',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      })

      // Create blob with explicit ZIP mime type
      const blob = new Blob([zipData], { type: 'application/zip' })

      // Create filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const filename = `template-printer-backup-${timestamp}.zip`

      // Use file-saver for reliable cross-browser download
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
    <div className="app-workspace" style={{ overflow: 'auto' }}>
      <div style={{
        maxWidth: 800,
        margin: '0 auto',
        padding: 32,
      }}>
        <h1 style={{
          fontSize: 24,
          fontWeight: 600,
          marginBottom: 8,
          color: 'var(--text-primary)'
        }}>
          Settings
        </h1>
        <p style={{
          fontSize: 14,
          color: 'var(--text-muted)',
          marginBottom: 32,
        }}>
          Manage your workspace data and preferences
        </p>

        {/* Storage Mode Info */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{
            fontSize: 16,
            fontWeight: 600,
            marginBottom: 16,
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            {storageMode === 'local' ? <HardDrive size={18} /> : <Database size={18} />}
            Storage Mode
          </h2>

          <div style={{
            padding: 16,
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 8,
            border: '1px solid var(--border-color)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: storageMode === 'local' ? 'var(--warning)' : 'var(--success)',
              }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>
                  {storageMode === 'local' ? 'Local Storage (IndexedDB)' : 'Server Storage (API)'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {storageMode === 'local'
                    ? 'Data is stored in your browser. Export regularly to avoid data loss.'
                    : 'Data is stored on the server and persists across sessions.'}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Data Management Section */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{
            fontSize: 16,
            fontWeight: 600,
            marginBottom: 16,
            color: 'var(--text-primary)'
          }}>
            Data Management
          </h2>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}>
            {/* Export Card */}
            <div style={{
              padding: 20,
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 8,
              border: '1px solid var(--border-color)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>Export Workspace</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    Download all your templates, users, card designs, fonts, and settings as a ZIP file.
                    Use this to backup your work or transfer to another device.
                  </div>
                </div>
                <Button
                  onClick={handleExport}
                  disabled={exporting || importing}
                  style={{ minWidth: 120 }}
                >
                  {exporting ? (
                    <Loader2 size={16} style={{ marginRight: 8 }} className="animate-spin" />
                  ) : (
                    <Download size={16} style={{ marginRight: 8 }} />
                  )}
                  {exporting ? 'Exporting...' : 'Export'}
                </Button>
              </div>
            </div>

            {/* Import Card */}
            <div style={{
              padding: 20,
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 8,
              border: '1px solid var(--border-color)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>Import Workspace</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    Restore from a previously exported ZIP backup. This will replace all existing data
                    with the contents of the backup file.
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={handleImportClick}
                  disabled={exporting || importing}
                  style={{ minWidth: 120 }}
                >
                  {importing ? (
                    <Loader2 size={16} style={{ marginRight: 8 }} className="animate-spin" />
                  ) : (
                    <Upload size={16} style={{ marginRight: 8 }} />
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
                gap: 12,
                padding: 16,
                borderRadius: 8,
                fontSize: 14,
                backgroundColor: status.type === 'success'
                  ? 'rgba(16, 185, 129, 0.1)'
                  : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${status.type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
                color: status.type === 'success' ? 'var(--success)' : 'var(--danger)',
              }}>
                {status.type === 'success' ? (
                  <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                ) : (
                  <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                )}
                <span>{status.message}</span>
              </div>
            )}
          </div>
        </section>

        {/* What's Included Section */}
        <section>
          <h2 style={{
            fontSize: 16,
            fontWeight: 600,
            marginBottom: 16,
            color: 'var(--text-primary)'
          }}>
            What's Included in Export
          </h2>

          <div style={{
            padding: 20,
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 8,
            border: '1px solid var(--border-color)',
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 16,
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Templates</div>
                <ul style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 16, margin: 0 }}>
                  <li>All SVG templates</li>
                  <li>Template content/markup</li>
                  <li>Field mappings</li>
                </ul>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Users & Data</div>
                <ul style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 16, margin: 0 }}>
                  <li>User database</li>
                  <li>All user fields</li>
                  <li>Photo references</li>
                </ul>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Designs</div>
                <ul style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 16, margin: 0 }}>
                  <li>Card designs</li>
                  <li>Canvas-based designs</li>
                  <li>Template assignments</li>
                </ul>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Assets</div>
                <ul style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 16, margin: 0 }}>
                  <li>Uploaded fonts</li>
                  <li>Color profiles</li>
                  <li>Print layouts</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
