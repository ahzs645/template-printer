import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, Copy, ScanLine, Upload } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { describeScan, scanBarcodeFromImage, type ScannedBarcode } from '../lib/barcodeScanner'
import { BARCODE_SYMBOLOGY_LABELS } from '../lib/barcode'

export type BarcodeScanDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Name of the field the result can be applied to, when one is selected. */
  targetFieldLabel?: string | null
  onApply?: (scan: ScannedBarcode) => void
}

/**
 * Read a barcode out of a photo or scan of an existing card, to find out what
 * symbology it uses and what it encodes.
 */
export function BarcodeScanDialog({
  open,
  onOpenChange,
  targetFieldLabel,
  onApply,
}: BarcodeScanDialogProps) {
  const [scan, setScan] = useState<ScannedBarcode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (open) return
    setScan(null)
    setError(null)
    setScanning(false)
  }, [open])

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  useEffect(() => {
    if (!copied) return
    const timeout = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timeout)
  }, [copied])

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setScan(null)
    setScanning(true)

    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return URL.createObjectURL(file)
    })

    try {
      setScan(await scanBarcodeFromImage(file))
    } catch (cause) {
      console.error(cause)
      setError(cause instanceof Error ? cause.message : 'Could not read a barcode from that image.')
    } finally {
      setScanning(false)
    }
  }

  // Pasting a screenshot is usually faster than saving it to a file first.
  useEffect(() => {
    if (!open) return
    const onPaste = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.files ?? [])[0]
      if (file?.type.startsWith('image/')) void handleFile(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ maxWidth: '620px' }}>
        <DialogHeader>
          <DialogTitle>Read a barcode from an image</DialogTitle>
          <DialogDescription>
            Upload or paste a photo of an existing card to find out which symbology it uses and what
            it encodes. Nothing leaves the browser.
          </DialogDescription>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
              <Upload size={16} style={{ marginRight: 6 }} />
              Choose image
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                void handleFile(file)
              }}
            />
            <span style={{ alignSelf: 'center', fontSize: '0.8125rem', color: '#6b7280' }}>
              or paste one with ⌘/Ctrl+V
            </span>
          </div>

          {previewUrl && (
            <div
              style={{
                border: '1px solid #e4e4e7',
                borderRadius: '0.5rem',
                padding: '0.5rem',
                background: '#fafafa',
                textAlign: 'center',
              }}
            >
              <img src={previewUrl} alt="" style={{ maxWidth: '100%', maxHeight: 220 }} />
            </div>
          )}

          {scanning && <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Reading…</p>}

          {error && (
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'flex-start',
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '0.5rem',
                padding: '0.75rem',
              }}
            >
              <AlertTriangle size={16} style={{ color: '#b45309', flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: '0.875rem', color: '#92400e', margin: 0 }}>{error}</p>
            </div>
          )}

          {scan && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <Label>Symbology</Label>
                <p style={{ margin: 0, fontSize: '0.9375rem' }}>
                  {describeScan(scan)}
                  {scan.symbology ? (
                    <span style={{ color: '#6b7280' }}>
                      {' '}
                      — generated here as {BARCODE_SYMBOLOGY_LABELS[scan.symbology]}
                    </span>
                  ) : (
                    <span style={{ color: '#b45309' }}> — this app cannot generate this format yet</span>
                  )}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <Label htmlFor="scan-value">Value</Label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Input id="scan-value" readOnly value={scan.text} onFocus={(e) => e.currentTarget.select()} />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      await navigator.clipboard.writeText(scan.text)
                      setCopied(true)
                    }}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </Button>
                </div>
                {scan.codabarStartStop && (
                  <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>
                    The "{scan.codabarStartStop.start}" and "{scan.codabarStartStop.stop}" at the ends
                    are Codabar's start and stop characters. They are part of the encoding and are
                    not usually printed under the bars.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {onApply && (
            <Button
              type="button"
              disabled={!scan || !scan.symbology}
              onClick={() => {
                if (scan) onApply(scan)
                onOpenChange(false)
              }}
            >
              <ScanLine size={16} style={{ marginRight: 6 }} />
              {targetFieldLabel ? `Apply to "${targetFieldLabel}"` : 'Apply to selected field'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
