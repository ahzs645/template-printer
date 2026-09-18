import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Copy, Eye, Pencil } from 'lucide-react'

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
import {
  SHARE_URL_MAX_LENGTH,
  createShareLinks,
  type ShareLinkSet,
  type SharedTemplatePayload,
} from '../lib/shareLink'

export type ShareTemplateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  payload: SharedTemplatePayload | null
}

function formatSize(characters: number): string {
  if (characters < 1024) return `${characters} characters`
  return `${(characters / 1024).toFixed(1)} KB`
}

export function ShareTemplateDialog({ open, onOpenChange, payload }: ShareTemplateDialogProps) {
  const [links, setLinks] = useState<ShareLinkSet | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [building, setBuilding] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !payload) {
      setLinks(null)
      setError(null)
      return
    }

    let cancelled = false
    setBuilding(true)
    setError(null)

    createShareLinks(payload, window.location.href)
      .then((result) => {
        if (cancelled) return
        setLinks(result)
        if (result.isTooLong) {
          setError(
            `This template compresses to ${formatSize(result.length)}, past the ${formatSize(
              SHARE_URL_MAX_LENGTH,
            )} a link can carry. Export the template as a file instead.`,
          )
        }
      })
      .catch((cause) => {
        if (cancelled) return
        console.error(cause)
        setError(cause instanceof Error ? cause.message : 'Could not build a share link.')
      })
      .finally(() => {
        if (!cancelled) setBuilding(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, payload])

  useEffect(() => {
    if (!copied) return
    const timeout = setTimeout(() => setCopied(null), 1500)
    return () => clearTimeout(timeout)
  }, [copied])

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(key)
    } catch (cause) {
      console.error('Failed to copy share link', cause)
      setError('Could not copy to the clipboard. Select the link and copy it manually.')
    }
  }

  const renderLink = (key: 'view' | 'edit', label: string, helper: string, icon: React.ReactNode) => {
    if (!links) return null
    const value = links[key]
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <Label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          {icon}
          {label}
        </Label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Input readOnly value={value} onFocus={(event) => event.currentTarget.select()} />
          <Button
            type="button"
            variant="outline"
            onClick={() => handleCopy(key, value)}
            disabled={links.isTooLong}
          >
            {copied === key ? <Check size={16} /> : <Copy size={16} />}
          </Button>
        </div>
        <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: 0 }}>{helper}</p>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ maxWidth: '640px' }}>
        <DialogHeader>
          <DialogTitle>Share template</DialogTitle>
          <DialogDescription>
            The template is compressed into the link itself, so it works without an account or an
            upload. Nothing is sent to a server.
          </DialogDescription>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {building && <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Compressing template…</p>}

          {error && (
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'flex-start',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '0.5rem',
                padding: '0.75rem',
              }}
            >
              <AlertTriangle size={16} style={{ color: '#b91c1c', flexShrink: 0, marginTop: '0.125rem' }} />
              <p style={{ fontSize: '0.875rem', color: '#b91c1c', margin: 0 }}>{error}</p>
            </div>
          )}

          {links && !links.isTooLong && (
            <>
              {renderLink(
                'view',
                'View only',
                'Opens the template read-only. The recipient can preview and export cards, but not change the layout.',
                <Eye size={14} />,
              )}
              {renderLink(
                'edit',
                'Editable',
                'Opens the template ready to edit, and lets the recipient save it into their own library.',
                <Pencil size={14} />,
              )}
            </>
          )}

          {links && (
            <div
              style={{
                background: '#f4f4f5',
                borderRadius: '0.5rem',
                padding: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.375rem',
              }}
            >
              <p style={{ fontSize: '0.75rem', color: '#52525b', margin: 0 }}>
                Link size: {formatSize(links.length)}
                {links.isLong && !links.isTooLong
                  ? ' — long enough that some chat and mail clients may break it. Send it as a file if it arrives truncated.'
                  : ''}
              </p>
              <p style={{ fontSize: '0.75rem', color: '#52525b', margin: 0 }}>
                Fonts and photos are not included — the recipient supplies those from their own
                library.
              </p>
              <p style={{ fontSize: '0.75rem', color: '#52525b', margin: 0 }}>
                View-only is a convenience, not a lock: anyone with either link can read the
                template out of it.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
