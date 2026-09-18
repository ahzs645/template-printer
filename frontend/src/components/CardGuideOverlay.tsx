import type { CSSProperties } from 'react'

import {
  DEFAULT_MAGNETIC_STRIPE,
  DEFAULT_SAFE_MARGIN_MM,
  MAGNETIC_TRACKS_MM,
  getPunchRect,
  punchConflictsWithStripe,
  type PunchPosition,
  type PunchShape,
} from '../lib/cardBlanks'

export type CardGuideOverlayProps = {
  /** Card size in millimetres. */
  widthMm: number
  heightMm: number
  /** Rendered size of the preview in pixels. */
  previewWidth: number
  previewHeight: number
  magneticStripe?: boolean
  magneticStripeTopMm?: number
  magneticStripeHeightMm?: number
  showTracks?: boolean
  punch?: PunchPosition
  punchShape?: PunchShape
  safeArea?: boolean
}

/**
 * Non-destructive guides drawn over a card preview: the ISO magnetic stripe,
 * its three tracks, the punch, and the safe area.
 *
 * These are overlays, not artwork. Nothing here is exported — the point is to
 * see where the stripe and the punch land on a design without anyone having to
 * draw them and guess the measurements.
 */
export function CardGuideOverlay({
  widthMm,
  heightMm,
  previewWidth,
  previewHeight,
  magneticStripe = false,
  magneticStripeTopMm = DEFAULT_MAGNETIC_STRIPE.topMm,
  magneticStripeHeightMm = DEFAULT_MAGNETIC_STRIPE.heightMm,
  showTracks = true,
  punch = 'none',
  punchShape = 'slot',
  safeArea = false,
}: CardGuideOverlayProps) {
  if (!widthMm || !heightMm || !previewWidth || !previewHeight) return null

  const scaleX = previewWidth / widthMm
  const scaleY = previewHeight / heightMm

  const box = (x: number, y: number, w: number, h: number): CSSProperties => ({
    position: 'absolute',
    left: x * scaleX,
    top: y * scaleY,
    width: w * scaleX,
    height: h * scaleY,
  })

  const punchRect = getPunchRect({ punch, punchShape, widthMm, heightMm })
  const punchHitsStripe =
    magneticStripe &&
    punchConflictsWithStripe({
      punch,
      punchShape,
      widthMm,
      heightMm,
      magneticStripeTopMm,
      magneticStripeHeightMm,
    })

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden="true">
      {magneticStripe && (
        <div
          style={{
            ...box(0, magneticStripeTopMm, widthMm, magneticStripeHeightMm),
            background: 'rgba(24, 24, 27, 0.82)',
            borderTop: '1px solid rgba(255,255,255,0.35)',
            borderBottom: '1px solid rgba(255,255,255,0.35)',
          }}
          title={`Magnetic stripe — ${magneticStripeHeightMm} mm, ${magneticStripeTopMm} mm from the top edge`}
        />
      )}

      {magneticStripe &&
        showTracks &&
        MAGNETIC_TRACKS_MM.map((track) => (
          <div
            key={track.track}
            style={{
              ...box(0, track.top, widthMm, track.bottom - track.top),
              border: '1px dashed rgba(0, 208, 255, 0.9)',
              boxSizing: 'border-box',
            }}
            title={`Track ${track.track} — ${track.top}–${track.bottom} mm (ISO/IEC 7811-2)`}
          />
        ))}

      {punchRect && (
        <div
          style={{
            ...box(punchRect.x, punchRect.y, punchRect.width, punchRect.height),
            border: `1.5px dashed ${punchHitsStripe ? '#ffcc00' : '#ff2d55'}`,
            borderRadius:
              punchShape === 'round'
                ? '50%'
                : Math.min(punchRect.width * scaleX, punchRect.height * scaleY) / 2,
            boxSizing: 'border-box',
            background: punchHitsStripe ? 'rgba(255, 204, 0, 0.25)' : 'rgba(255, 45, 85, 0.12)',
          }}
          title={
            punchHitsStripe
              ? 'This punch cuts through the magnetic stripe and would destroy the encoding under it'
              : `${punchShape === 'round' ? 'Round punch' : 'Lanyard slot'} — ${punchRect.width} x ${punchRect.height} mm`
          }
        />
      )}

      {safeArea && (
        <div
          style={{
            ...box(
              DEFAULT_SAFE_MARGIN_MM,
              DEFAULT_SAFE_MARGIN_MM,
              widthMm - DEFAULT_SAFE_MARGIN_MM * 2,
              heightMm - DEFAULT_SAFE_MARGIN_MM * 2,
            ),
            border: '1px dashed rgba(52, 199, 89, 0.9)',
            boxSizing: 'border-box',
          }}
          title={`Safe area — keep artwork that must not be trimmed inside ${DEFAULT_SAFE_MARGIN_MM} mm`}
        />
      )}
    </div>
  )
}
