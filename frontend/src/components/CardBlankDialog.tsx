import { useMemo, useState } from 'react'
import { Download, FilePlus } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Button } from './ui/button'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Switch } from './ui/switch'
import {
  DEFAULT_MAGNETIC_STRIPE,
  ID1_HEIGHT_MM,
  ID1_WIDTH_MM,
  MAGNETIC_TRACKS_MM,
  PUNCH_POSITIONS,
  PUNCH_POSITION_LABELS,
  STRIPE_SAFE_PUNCHES,
  cardBlankFileName,
  createCardBlankSvg,
  punchConflictsWithStripe,
  type CardBlankOptions,
  type PunchPosition,
  type PunchShape,
} from '../lib/cardBlanks'
import { BARCODE_SYMBOLOGIES, BARCODE_SYMBOLOGY_LABELS, type BarcodeSymbology } from '../lib/barcode'

export type CardBlankDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Load the generated blank straight into the editor. */
  onOpenInEditor: (fileName: string, svg: string) => void
}

const NO_BARCODE = 'none'

/**
 * Generate a correctly sized, correctly named card blank to start a design
 * from, rather than drawing an 85.6 x 54 mm rectangle by hand and guessing
 * where the magnetic stripe goes.
 */
export function CardBlankDialog({ open, onOpenChange, onOpenInEditor }: CardBlankDialogProps) {
  const [side, setSide] = useState<'front' | 'back'>('front')
  const [magneticStripe, setMagneticStripe] = useState(false)
  const [showMagneticTracks, setShowMagneticTracks] = useState(true)
  const [signaturePanel, setSignaturePanel] = useState(false)
  const [punch, setPunch] = useState<PunchPosition>('top-center')
  const [punchShape, setPunchShape] = useState<PunchShape>('slot')
  const [barcode, setBarcode] = useState<BarcodeSymbology | typeof NO_BARCODE>(NO_BARCODE)
  const [guides, setGuides] = useState(true)

  const options: CardBlankOptions = useMemo(
    () => ({
      side,
      magneticStripe: side === 'back' && magneticStripe,
      showMagneticTracks,
      signaturePanel: side === 'back' && signaturePanel,
      punch,
      punchShape,
      barcode: barcode === NO_BARCODE ? null : barcode,
      guides,
    }),
    [side, magneticStripe, showMagneticTracks, signaturePanel, punch, punchShape, barcode, guides],
  )

  const svg = useMemo(() => createCardBlankSvg(options), [options])
  const fileName = cardBlankFileName(options)

  const punchHitsStripe =
    Boolean(options.magneticStripe) && punchConflictsWithStripe({ punch, punchShape })

  const handleDownload = () => {
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const row = (label: string, control: React.ReactNode, helper?: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      <Label>{label}</Label>
      {control}
      {helper && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{helper}</p>}
    </div>
  )

  const toggle = (label: string, value: boolean, onToggle: (next: boolean) => void, helper?: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
        <Switch checked={value} onCheckedChange={onToggle} />
        {label}
      </label>
      {helper && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, paddingLeft: '2.75rem' }}>{helper}</p>}
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ maxWidth: '760px' }}>
        <DialogHeader>
          <DialogTitle>New blank template</DialogTitle>
          <DialogDescription>
            An ID-1 card ({ID1_WIDTH_MM} × {ID1_HEIGHT_MM} mm) with the layers already named, drawn in
            millimetres so the numbers in the file are real measurements.
          </DialogDescription>
        </DialogHeader>

        <div className="dialog-split">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {row(
              'Side',
              <Select value={side} onValueChange={(value) => setSide(value as 'front' | 'back')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="front">Front</SelectItem>
                  <SelectItem value="back">Back</SelectItem>
                </SelectContent>
              </Select>,
            )}

            {row(
              'Punch',
              <Select value={punch} onValueChange={(value) => setPunch(value as PunchPosition)}>
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
              </Select>,
            )}

            {punch !== 'none' &&
              row(
                'Punch shape',
                <Select value={punchShape} onValueChange={(value) => setPunchShape(value as PunchShape)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slot">Lanyard slot (12 × 3 mm)</SelectItem>
                    <SelectItem value="round">Round hole (⌀5 mm)</SelectItem>
                  </SelectContent>
                </Select>,
              )}

            {row(
              'Barcode placeholder',
              <Select value={barcode} onValueChange={(value) => setBarcode(value as BarcodeSymbology)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_BARCODE}>None</SelectItem>
                  {BARCODE_SYMBOLOGIES.map((symbology) => (
                    <SelectItem key={symbology} value={symbology}>
                      {BARCODE_SYMBOLOGY_LABELS[symbology]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>,
              barcode === NO_BARCODE ? undefined : `Added as a layer named barcode_${barcode}_studentId.`,
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {side === 'back' &&
              toggle(
                'Magnetic stripe',
                magneticStripe,
                setMagneticStripe,
                `${DEFAULT_MAGNETIC_STRIPE.heightMm} mm tape, ${DEFAULT_MAGNETIC_STRIPE.topMm} mm from the top edge — covers all three ISO/IEC 7811-2 tracks (${MAGNETIC_TRACKS_MM[0].top}–${MAGNETIC_TRACKS_MM[2].bottom} mm).`,
              )}

            {side === 'back' &&
              magneticStripe &&
              toggle('Track guides', showMagneticTracks, setShowMagneticTracks, 'Marks tracks 1–3 inside the stripe.')}

            {side === 'back' && toggle('Signature panel', signaturePanel, setSignaturePanel)}

            {toggle('Bleed and safe-area guides', guides, setGuides, '1 mm bleed, 3 mm safe area.')}

            <div
              style={{
                marginTop: '0.5rem',
                border: '1px solid var(--border-default)',
                borderRadius: '0.5rem',
                padding: '0.75rem',
                background: 'var(--bg-surface-alt)',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <div
                style={{ width: '100%', maxWidth: 300 }}
                // The blank is generated here, so there is nothing untrusted in it.
                dangerouslySetInnerHTML={{ __html: svg.replace(/<\?xml[^>]*\?>/, '') }}
              />
            </div>

            {punchHitsStripe && (
              <p style={{ fontSize: '0.75rem', color: 'var(--warning)', margin: 0 }}>
                This punch cuts through the magnetic stripe, which destroys the encoding under the
                hole. Cards with a stripe are normally punched on an end or along the bottom:{' '}
                {STRIPE_SAFE_PUNCHES.map((position) => PUNCH_POSITION_LABELS[position]).join(', ')}.
              </p>
            )}

            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
              Stripe and punch positions follow the ISO specs, but card printers vary — check them
              against yours before a production run.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleDownload}>
            <Download size={16} style={{ marginRight: 6 }} />
            Download {fileName}
          </Button>
          <Button
            type="button"
            onClick={() => {
              onOpenInEditor(fileName, svg)
              onOpenChange(false)
            }}
          >
            <FilePlus size={16} style={{ marginRight: 6 }} />
            Open in editor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
