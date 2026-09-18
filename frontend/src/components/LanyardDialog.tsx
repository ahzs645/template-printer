import { useEffect, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Slider } from './ui/slider'
import {
  ID1_HEIGHT_MM,
  ID1_WIDTH_MM,
  PUNCH_POSITIONS,
  PUNCH_POSITION_LABELS,
  punchConflictsWithStripe,
  type PunchPosition,
  type PunchShape,
} from '../lib/cardBlanks'
import type { LanyardHandle } from '../lib/lanyardScene'

export type LanyardDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  frontSvg: string | null
  backSvg?: string | null
  widthMm?: number
  heightMm?: number
  /** Whether the back carries a magnetic stripe, so a bad punch can be called out. */
  hasMagneticStripe?: boolean
  punch: PunchPosition
  punchShape: PunchShape
  onPunchChange: (punch: PunchPosition) => void
  onPunchShapeChange: (shape: PunchShape) => void
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
  hasMagneticStripe = false,
  punch,
  punchShape,
  onPunchChange,
  onPunchShapeChange,
}: LanyardDialogProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const handleRef = useRef<LanyardHandle | null>(null)

  const [strapColor, setStrapColor] = useState('#155329')
  const [strapText, setStrapText] = useState('')
  const [gravity, setGravity] = useState(32)
  const [strapWidth, setStrapWidth] = useState(0.24)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Build the scene once the dialog is actually open and sized.
  useEffect(() => {
    if (!open || !frontSvg) return
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    let cancelled = false
    setLoading(true)
    setError(null)

    import('../lib/lanyardScene')
      .then(({ createLanyardScene }) =>
        createLanyardScene(canvas, container, {
          frontSvg,
          backSvg,
          widthMm,
          heightMm,
          punch,
          punchShape,
          strapColor,
          strapText,
          gravity,
          strapWidth,
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
  }, [open, frontSvg, backSvg, widthMm, heightMm])

  useEffect(() => {
    handleRef.current?.update({ punch, punchShape })
  }, [punch, punchShape])

  useEffect(() => {
    handleRef.current?.update({ strapColor, strapText, gravity, strapWidth })
  }, [strapColor, strapText, gravity, strapWidth])

  const punchHitsStripe = hasMagneticStripe && punchConflictsWithStripe({ punch, punchShape })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ maxWidth: '980px', width: '95vw' }}>
        <DialogHeader>
          <DialogTitle>On a lanyard</DialogTitle>
          <DialogDescription>
            The card hangs from its punch, so moving the punch tips it the way a real holder would.
            Drag the card to swing it.
          </DialogDescription>
        </DialogHeader>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(220px, 1fr)', gap: '1.25rem' }}>
          <div
            ref={containerRef}
            style={{
              position: 'relative',
              height: 460,
              borderRadius: '0.75rem',
              background: 'linear-gradient(180deg, #f4f4f5 0%, #e4e4e7 100%)',
              overflow: 'hidden',
            }}
          >
            <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none' }} />
            {loading && (
              <p style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: '0.875rem', color: '#6b7280' }}>
                Building the card…
              </p>
            )}
            {error && (
              <p style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: '0.875rem', color: '#b91c1c', padding: '2rem', textAlign: 'center' }}>
                {error}
              </p>
            )}
            {!frontSvg && (
              <p style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: '0.875rem', color: '#6b7280' }}>
                Open a template to hang it on a lanyard.
              </p>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
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
              {punch === 'none' && (
                <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>
                  With no punch the card hangs from a clip on its top edge.
                </p>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <Label>Punch shape</Label>
              <Select
                value={punchShape}
                onValueChange={(value) => onPunchShapeChange(value as PunchShape)}
                disabled={punch === 'none'}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slot">Lanyard slot (12 × 3 mm)</SelectItem>
                  <SelectItem value="round">Round hole (⌀5 mm)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {punchHitsStripe && (
              <p style={{ fontSize: '0.75rem', color: '#b45309', margin: 0 }}>
                This punch cuts through the magnetic stripe on the back.
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <Label htmlFor="strap-text">Strap text</Label>
              <Input
                id="strap-text"
                value={strapText}
                placeholder="e.g. UNBC ///"
                onChange={(event) => setStrapText(event.target.value)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <Label htmlFor="strap-color">Strap colour</Label>
              <input
                id="strap-color"
                type="color"
                value={strapColor}
                onChange={(event) => setStrapColor(event.target.value)}
                style={{ width: '100%', height: 34, border: '1px solid #e4e4e7', borderRadius: '0.375rem', background: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <Label>Strap width</Label>
              <Slider
                value={[strapWidth]}
                min={0.1}
                max={0.5}
                step={0.02}
                onValueChange={([value]) => setStrapWidth(value)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <Label>Swing</Label>
              <Slider value={[gravity]} min={8} max={64} step={1} onValueChange={([value]) => setGravity(value)} />
            </div>

            <Button type="button" variant="outline" onClick={() => handleRef.current?.drop()}>
              <RotateCcw size={15} style={{ marginRight: 6 }} />
              Drop it again
            </Button>
          </div>
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
