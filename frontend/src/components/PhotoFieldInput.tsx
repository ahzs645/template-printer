import { useRef, type CSSProperties } from 'react'
import { ImagePlus, Undo2 } from 'lucide-react'

import type { CardDataValue } from '../lib/types'
import { isImageValue } from '../lib/utils'

type PhotoFieldInputProps = {
  label: string
  value: CardDataValue | undefined
  onPick: (file: File) => void
  /** Drop this photo and go back to the one it replaced. Shown only when given. */
  onRevert?: () => void
  /** A line under the button saying where the photo comes from. */
  note?: string
  labelClassName?: string
  labelStyle?: CSSProperties
}

/**
 * An image field typed in by hand: a thumbnail of the photo the card will print
 * with, and a button to upload one. Image fields cannot be typed into, so this
 * stands in for the text box the other fields get.
 */
export function PhotoFieldInput({ label, value, onPick, onRevert, note, labelClassName = 'form-label', labelStyle }: PhotoFieldInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const image = isImageValue(value) ? value : null

  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      <span className={labelClassName} style={labelStyle}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 36,
            height: 45,
            flexShrink: 0,
            borderRadius: 4,
            border: '1px solid var(--border-default)',
            background: 'var(--bg-surface-alt)',
            overflow: 'hidden',
          }}
        >
          {image && <img src={image.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: 11, padding: '4px 8px', gap: 4 }}
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus size={12} />
              {image ? 'Replace photo' : 'Upload photo'}
            </button>
            {onRevert && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 10, padding: '2px 6px' }}
                onClick={onRevert}
                title="Print with the photo from the Design tab instead"
              >
                <Undo2 size={11} style={{ marginRight: 3 }} />
                Design tab photo
              </button>
            )}
          </div>
          {note && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{note}</span>}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        aria-label={`Upload ${label}`}
        style={{ display: 'none' }}
        onChange={(event) => {
          const file = event.target.files?.[0]
          // Cleared so picking the same file again still counts as a change.
          event.target.value = ''
          if (file) onPick(file)
        }}
      />
    </div>
  )
}
