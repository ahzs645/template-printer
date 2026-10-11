import { useEffect, useRef, useState } from 'react'
import { FlipHorizontal2, Hand, RotateCcw, ZoomIn } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Slider } from './ui/slider'
import { Switch } from './ui/switch'
import {
  ID1_HEIGHT_MM,
  ID1_WIDTH_MM,
  PUNCH_POSITIONS,
  PUNCH_POSITION_LABELS,
  punchConflictsWithStripe,
  type PunchPosition,
  type PunchShape,
} from '../lib/cardBlanks'
import { naturalOrientation, type LanyardHandle, type LanyardOrientation } from '../lib/lanyardScene'
import {
  LANYARD_ATTACHMENTS,
  LANYARD_ATTACHMENT_LABELS,
  resolveAttachment,
  type LanyardAttachment,
} from '../lib/lanyardHardware'

export type LanyardDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  frontSvg: string | null
  backSvg?: string | null
  widthMm?: number
  heightMm?: number
  /** Whole artwork size, when it is larger than the card because of bleed. */
  artworkWidthMm?: number
  artworkHeightMm?: number
  cardOriginXMm?: number
  cardOriginYMm?: number
  /** Whether the back carries a magnetic stripe, so a bad punch can be called out. */
  hasMagneticStripe?: boolean
  punch: PunchPosition
  punchShape: PunchShape
  onPunchChange: (punch: PunchPosition) => void
  onPunchShapeChange: (shape: PunchShape) => void
  /** Identifies the card, so how it hangs is remembered for it. */
  cardKey?: string | null
}

type StrapSettings = {
  strapColor: string
  strapText: string
  strapWidth: number
  gravity: number
  damping: number
  attachment: LanyardAttachment
}

const DEFAULT_STRAP: StrapSettings = {
  strapColor: '#155329',
  strapText: '',
  strapWidth: 0.42,
  gravity: 40,
  damping: 2.6,
  attachment: 'auto',
}

const STRAP_SWATCHES = ['#155329', '#111827', '#1d4ed8', '#b91c1c', '#7c3aed', '#f59e0b', '#e5e7eb']

const STRAP_STORAGE_KEY = 'template-printer:lanyard'
const ORIENTATION_STORAGE_KEY = 'template-printer:lanyard-orientation'

// Remembered per browser, as a convenience: storage can be missing or
// blocked, in which case the defaults simply apply.
function readStored<T>(key: string): Partial<T> | null {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as Partial<T>) : null
  } catch {
    return null
  }
}

function writeStored(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Nothing to do: the setting just will not be remembered.
  }
}

function storedOrientation(cardKey: string | null | undefined): LanyardOrientation {
  if (!cardKey) return 'auto'
  const value = readStored<Record<string, LanyardOrientation>>(ORIENTATION_STORAGE_KEY)?.[cardKey]
  return value === 'portrait' || value === 'landscape' ? value : 'auto'
}

/**
 * Hang the card on a lanyard and see how it sits.
 *
 * Moving the punch actually changes where the card hangs from, so an end punch
 * tips it sideways the way it would in a real holder — which is the point of
 * simulating it rather than drawing a hole on the artwork.
 */
export function LanyardDialog({
  open,
  onOpenChange,
  frontSvg,
  backSvg,
  widthMm = ID1_WIDTH_MM,
  heightMm = ID1_HEIGHT_MM,
  artworkWidthMm,
  artworkHeightMm,
  cardOriginXMm = 0,
  cardOriginYMm = 0,
  hasMagneticStripe = false,
  punch,
  punchShape,
  onPunchChange,
  onPunchShapeChange,
  cardKey,
}: LanyardDialogProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const handleRef = useRef<LanyardHandle | null>(null)

  const [strap, setStrap] = useState<StrapSettings>(() => ({ ...DEFAULT_STRAP, ...readStored<StrapSettings>(STRAP_STORAGE_KEY) }))
  const [orientation, setOrientation] = useState<LanyardOrientation>(() => storedOrientation(cardKey))
  const [closeUp, setCloseUp] = useState(false)
  const [showingBack, setShowingBack] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const changeStrap = (patch: Partial<StrapSettings>) =>
    setStrap((current) => {
      const next = { ...current, ...patch }
      writeStored(STRAP_STORAGE_KEY, next)
      return next
    })

  // Each card remembers how it is meant to hang.
  useEffect(() => {
    setOrientation(storedOrientation(cardKey))
  }, [cardKey])

  const changeOrientation = (value: LanyardOrientation) => {
    setOrientation(value)
    if (!cardKey) return
    const stored = readStored<Record<string, LanyardOrientation>>(ORIENTATION_STORAGE_KEY) ?? {}
    if (value === 'auto') delete stored[cardKey]
    else stored[cardKey] = value
    writeStored(ORIENTATION_STORAGE_KEY, stored)
  }

  const natural = naturalOrientation(widthMm, heightMm)
  const hangsAs = orientation === 'auto' ? natural : orientation

  // Build the scene once the dialog is actually open and sized.
  useEffect(() => {
    if (!open || !frontSvg) return
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    let cancelled = false
    setLoading(true)
    setError(null)
    setShowingBack(false)

    import('../lib/lanyardScene')
      .then(({ createLanyardScene }) =>
        createLanyardScene(canvas, container, {
          frontSvg,
          backSvg,
          widthMm,
          heightMm,
          artworkWidthMm: artworkWidthMm ?? widthMm,
          artworkHeightMm: artworkHeightMm ?? heightMm,
          cardOriginXMm,
          cardOriginYMm,
          orientation,
          punch,
          punchShape,
          closeUp,
          ...strap,
        }),
      )
      .then((handle) => {
        if (cancelled) {
          handle.dispose()
          return
        }
        handleRef.current = handle
      })
      .catch((cause) => {
        console.error(cause)
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not start the preview.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      handleRef.current?.dispose()
      handleRef.current = null
    }
    // Rebuilding on every control change would be wasteful; update() handles those.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, frontSvg, backSvg, widthMm, heightMm, artworkWidthMm, artworkHeightMm, cardOriginXMm, cardOriginYMm])

  useEffect(() => {
    handleRef.current?.update({ punch, punchShape })
  }, [punch, punchShape])

  useEffect(() => {
    handleRef.current?.update({ orientation })
  }, [orientation])

  useEffect(() => {
    handleRef.current?.update({
      strapColor: strap.strapColor,
      strapText: strap.strapText,
      gravity: strap.gravity,
      strapWidth: strap.strapWidth,
      damping: strap.damping,
    })
  }, [strap.strapColor, strap.strapText, strap.gravity, strap.strapWidth, strap.damping])

  useEffect(() => {
    handleRef.current?.update({ attachment: strap.attachment })
  }, [strap.attachment])

  useEffect(() => {
    handleRef.current?.update({ closeUp })
  }, [closeUp])

  const shownAttachment = resolveAttachment(strap.attachment, punch !== 'none', punchShape)
  const punchHitsStripe = hasMagneticStripe && punchConflictsWithStripe({ punch, punchShape })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="lanyard-dialog">
        <DialogHeader>
          <DialogTitle>On a lanyard</DialogTitle>
          <DialogDescription>
            The card hangs from its punch, so moving the punch tips it the way a real holder would.
          </DialogDescription>
        </DialogHeader>

        <div className="lanyard-layout">
          <div ref={containerRef} className="lanyard-stage">
            <canvas ref={canvasRef} className="lanyard-stage__canvas" />
            {loading && <p className="lanyard-stage__message">Building the card…</p>}
            {error && <p className="lanyard-stage__message lanyard-stage__message--error">{error}</p>}
            {!frontSvg && <p className="lanyard-stage__message">Open a template to hang it on a lanyard.</p>}

            {frontSvg && !error && (
              <>
                <p className="lanyard-stage__hint">
                  <Hand size={14} aria-hidden="true" />
                  Drag the card to swing it — throw it to spin it
                </p>
                <div className="lanyard-stage__actions">
                  <button
                    type="button"
                    className="lanyard-stage__button"
                    onClick={() => {
                      handleRef.current?.flip()
                      setShowingBack((value) => !value)
                    }}
                  >
                    <FlipHorizontal2 size={15} aria-hidden="true" />
                    {showingBack ? 'Show front' : 'Show back'}
                  </button>
                  <button
                    type="button"
                    className="lanyard-stage__button"
                    aria-pressed={closeUp}
                    onClick={() => setCloseUp((value) => !value)}
                  >
                    <ZoomIn size={15} aria-hidden="true" />
                    Close-up
                  </button>
                  <button type="button" className="lanyard-stage__button" onClick={() => handleRef.current?.drop()}>
                    <RotateCcw size={15} aria-hidden="true" />
                    Drop again
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="lanyard-controls">
            <section className="lanyard-controls__section">
              <h3 className="lanyard-controls__heading">Card</h3>

              <div className="lanyard-field">
                <Label id="lanyard-orientation-label">Hangs as</Label>
                <div className="lanyard-segmented" role="radiogroup" aria-labelledby="lanyard-orientation-label">
                  {(['auto', 'portrait', 'landscape'] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={orientation === value}
                      className="lanyard-segmented__option"
                      onClick={() => changeOrientation(value)}
                    >
                      <span
                        aria-hidden="true"
                        className={`lanyard-segmented__glyph lanyard-segmented__glyph--${value === 'auto' ? natural : value}`}
                      />
                      {value === 'auto' ? 'As drawn' : value === 'portrait' ? 'Vertical' : 'Horizontal'}
                    </button>
                  ))}
                </div>
                <p className="lanyard-note">
                  {orientation === 'auto'
                    ? `The artwork is ${natural === 'portrait' ? 'taller than it is wide' : 'wider than it is tall'}, so it hangs ${natural === 'portrait' ? 'vertically' : 'horizontally'}.`
                    : hangsAs === natural
                      ? `Hangs ${hangsAs === 'portrait' ? 'vertically' : 'horizontally'}, as drawn.`
                      : `Artwork turned a quarter to hang ${hangsAs === 'portrait' ? 'vertically' : 'horizontally'}. The punch is placed on the card as it hangs.`}
                </p>
              </div>

              <div className="lanyard-field">
                <Label>Punch position</Label>
                <Select value={punch} onValueChange={(value) => onPunchChange(value as PunchPosition)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PUNCH_POSITIONS.map((position) => (
                      <SelectItem key={position} value={position}>
                        {PUNCH_POSITION_LABELS[position]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {punch === 'none' && <p className="lanyard-note">With no punch the card hangs from a clip on its top edge.</p>}
              </div>

              <div className="lanyard-field">
                <Label>Punch shape</Label>
                <Select value={punchShape} onValueChange={(value) => onPunchShapeChange(value as PunchShape)} disabled={punch === 'none'}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slot">Lanyard slot (12 × 3 mm)</SelectItem>
                    <SelectItem value="round">Round hole (⌀5 mm)</SelectItem>
                  </SelectContent>
                </Select>
                {punchHitsStripe && (
                  <p className="lanyard-note lanyard-note--warning">This punch cuts through the magnetic stripe on the back.</p>
                )}
              </div>
            </section>

            <section className="lanyard-controls__section">
              <h3 className="lanyard-controls__heading">Hardware</h3>
              <div className="lanyard-field">
                <Label>Attachment</Label>
                <Select value={strap.attachment} onValueChange={(value) => changeStrap({ attachment: value as LanyardAttachment })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANYARD_ATTACHMENTS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {LANYARD_ATTACHMENT_LABELS[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {shownAttachment !== strap.attachment && (
                  <p className="lanyard-note">
                    Showing a {LANYARD_ATTACHMENT_LABELS[shownAttachment].toLowerCase()}
                    {strap.attachment === 'auto' ? ', the usual one for this punch.' : ', since that does not fit this punch.'}
                  </p>
                )}
              </div>
              <label className="lanyard-switch">
                <Switch checked={closeUp} onCheckedChange={setCloseUp} />
                Close-up on the punch
              </label>
            </section>

            <section className="lanyard-controls__section">
              <h3 className="lanyard-controls__heading">Strap</h3>
              <div className="lanyard-field">
                <Label htmlFor="strap-text">Printed text</Label>
                <Input
                  id="strap-text"
                  value={strap.strapText}
                  placeholder="e.g. UNBC ///"
                  onChange={(event) => changeStrap({ strapText: event.target.value })}
                />
              </div>
              <div className="lanyard-field">
                <Label htmlFor="strap-color">Colour</Label>
                <div className="lanyard-swatches">
                  {STRAP_SWATCHES.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className="lanyard-swatches__swatch"
                      style={{ background: color }}
                      aria-label={`Strap colour ${color}`}
                      aria-pressed={strap.strapColor.toLowerCase() === color}
                      onClick={() => changeStrap({ strapColor: color })}
                    />
                  ))}
                  <input
                    id="strap-color"
                    type="color"
                    value={strap.strapColor}
                    onChange={(event) => changeStrap({ strapColor: event.target.value })}
                    className="lanyard-swatches__custom"
                    aria-label="Custom strap colour"
                  />
                </div>
              </div>
              <div className="lanyard-field">
                <Label>Width</Label>
                <Slider value={[strap.strapWidth]} min={0.2} max={0.7} step={0.02} onValueChange={([value]) => changeStrap({ strapWidth: value })} />
              </div>
            </section>

            <section className="lanyard-controls__section">
              <h3 className="lanyard-controls__heading">Motion</h3>
              <div className="lanyard-field">
                <Label>Gravity</Label>
                <Slider value={[strap.gravity]} min={10} max={80} step={1} onValueChange={([value]) => changeStrap({ gravity: value })} />
              </div>
              <div className="lanyard-field">
                <Label>Settles</Label>
                <Slider value={[strap.damping]} min={0.6} max={8} step={0.1} onValueChange={([value]) => changeStrap({ damping: value })} />
                <p className="lanyard-note">Left swings for longer; right comes to rest quickly.</p>
              </div>
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
