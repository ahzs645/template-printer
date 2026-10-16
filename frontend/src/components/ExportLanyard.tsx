import { useEffect, useMemo, useState } from 'react'
import { Keyboard, Users } from 'lucide-react'

import { LanyardDialog } from './LanyardDialog'
import { PhotoFieldInput } from './PhotoFieldInput'
import { SlotPersonPicker } from './PersonPicker'
import type { ExportBackSide } from '../hooks/useExportBackSide'
import type { CardSide } from '../hooks/useExportPreview'
import type { CardData, CardDesign, FieldDefinition, TemplateMeta } from '../lib/types'
import type { UserData } from '../lib/fieldParser'
import type { PunchPosition, PunchShape } from '../lib/cardBlanks'
import { inferCardGeometry } from '../lib/cardGeometry'
import { getDesignVariants, hasVariants, variantForUser } from '../lib/designVariants'
import { describeStandardField } from '../lib/standardFields'
import { orientLike } from '../lib/slotPlacement'

/** Typed in by hand, or one person's record. */
type Source = { kind: 'typed' } | { kind: 'person'; userId: string }

export type ExportLanyardProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  templateMeta: TemplateMeta | null
  /** The card with the data typed in on the page. */
  renderedSvg: string | null
  backSide: ExportBackSide | null
  fields: FieldDefinition[]
  cardData: CardData
  onCardDataChange: (fieldId: string, value: string) => void
  /** Upload a photo into the card's own data, the same one the Design tab sets. */
  onCardImageUpload: (fieldId: string, file: File) => void
  users: UserData[]
  /** Who to show first: the first person picked for a batch, when there is one. */
  initialUserId?: string | null
  renderCardForUser: (userId: string | null | undefined, side?: CardSide) => string | null
  resolveFront?: ((user: UserData) => TemplateMeta | null) | null
  design: CardDesign | null
  /** The template the page is exporting, to name its variant. */
  templateId: string | null
  cardKey: string | null
}

function fieldLabel(field: FieldDefinition): string {
  return describeStandardField(field.sourceId || field.id) ?? field.label ?? field.id
}

/**
 * The lanyard view from the print screen: the card exactly as it will print,
 * with what is on it changeable in the same dialog — type the text, or pick a
 * person from the database, whose record also picks the variant (Student,
 * Staff …) on a design that chooses variants per person.
 */
export function ExportLanyard({
  open,
  onOpenChange,
  templateMeta,
  renderedSvg,
  backSide,
  fields,
  cardData,
  onCardDataChange,
  onCardImageUpload,
  users,
  initialUserId,
  renderCardForUser,
  resolveFront,
  design,
  templateId,
  cardKey,
}: ExportLanyardProps) {
  const [source, setSource] = useState<Source>({ kind: 'typed' })

  // Each time the dialog opens it starts from what the page is showing.
  // Each time the dialog opens it starts from what the page is showing; while
  // it is open, the choice made in it stands.
  useEffect(() => {
    if (!open) return
    const first = initialUserId && users.some((user) => user.id === initialUserId) ? initialUserId : null
    setSource(first ? { kind: 'person', userId: first } : { kind: 'typed' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const person = source.kind === 'person' ? users.find((user) => user.id === source.userId) ?? null : null
  // A person on a per-person variant design wears their own variant's front.
  const frontMeta = (person && resolveFront?.(person)) || templateMeta

  const [punch, setPunch] = useState<PunchPosition>('none')
  const [punchShape, setPunchShape] = useState<PunchShape>('slot')
  const templatePunch = frontMeta?.punch
  useEffect(() => {
    setPunch(templatePunch?.position ?? 'none')
    setPunchShape(templatePunch?.shape ?? 'slot')
  }, [templatePunch])

  const geometry = useMemo(() => inferCardGeometry(frontMeta), [frontMeta])

  const sides = useMemo(() => {
    const front = person ? renderCardForUser(person.id, 'front') : renderedSvg
    // Without a back of its own, renderCardForUser would hand back the front.
    const back = backSide ? (person ? renderCardForUser(person.id, 'back') : backSide.svg) : null
    const box = front ? /viewBox="([^"]+)"/.exec(front)?.[1].trim().split(/[\s,]+/).map(Number) : null
    if (!front || !back || !box || box.length !== 4) return { front, back }
    return { front, back: orientLike(back, { width: box[2], height: box[3] }) }
  }, [person, renderCardForUser, renderedSvg, backSide])

  const variantName = useMemo(() => {
    if (!design || !hasVariants(design)) return null
    if (person && design.variantField) return variantForUser(design, person, null)?.name ?? null
    return getDesignVariants(design).find((variant) => variant.frontTemplateId === templateId)?.name ?? null
  }, [design, person, templateId])


  const dataPanel = (
    <>
      <div className="lanyard-segmented lanyard-segmented--two" role="radiogroup" aria-label="What is on the card">
        <button
          type="button"
          role="radio"
          aria-checked={source.kind === 'typed'}
          className="lanyard-segmented__option lanyard-segmented__option--row"
          onClick={() => setSource({ kind: 'typed' })}
        >
          <Keyboard size={14} aria-hidden="true" />
          Type it
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={source.kind === 'person'}
          className="lanyard-segmented__option lanyard-segmented__option--row"
          disabled={users.length === 0}
          title={users.length === 0 ? 'No one is in the database yet — add people in the Users tab' : undefined}
          onClick={() => {
            const userId = initialUserId ?? users[0]?.id
            if (userId) setSource({ kind: 'person', userId })
          }}
        >
          <Users size={14} aria-hidden="true" />
          A person
        </button>
      </div>

      {source.kind === 'typed' ? (
        fields.length > 0 ? (
          <div className="lanyard-fields">
            {fields.map((field) => field.type === 'image' ? (
              <PhotoFieldInput
                key={field.id}
                label={fieldLabel(field)}
                labelClassName="lanyard-field__label"
                labelStyle={{ display: 'block', marginBottom: '0.375rem' }}
                value={cardData[field.id]}
                onPick={(file) => onCardImageUpload(field.id, file)}
              />
            ) : (
              <label key={field.id} className="lanyard-field">
                <span className="lanyard-field__label">{fieldLabel(field)}</span>
                <input
                  type="text"
                  className="form-input"
                  value={typeof cardData[field.id] === 'string' ? (cardData[field.id] as string) : ''}
                  placeholder={field.label || `Enter ${fieldLabel(field)}`}
                  onChange={(event) => onCardDataChange(field.id, event.target.value)}
                />
              </label>
            ))}
            <p className="lanyard-note">The same details the card prints with in a quick export.</p>
          </div>
        ) : (
          <p className="lanyard-note">This card has no fields to fill in.</p>
        )
      ) : (
        <SlotPersonPicker
          users={users}
          selectedUserId={source.userId}
          onSelect={(userId) => setSource({ kind: 'person', userId })}
        />
      )}

      {variantName && (
        <p className="lanyard-note">
          Variant: <strong>{variantName}</strong>
          {person && design?.variantField ? `, from their ${design.variantField}.` : '.'}
        </p>
      )}
    </>
  )

  return (
    <LanyardDialog
      open={open}
      onOpenChange={onOpenChange}
      frontSvg={sides.front}
      backSvg={sides.back}
      widthMm={geometry.card.width}
      heightMm={geometry.card.height}
      artworkWidthMm={geometry.artwork.width}
      artworkHeightMm={geometry.artwork.height}
      cardOriginXMm={geometry.origin.x}
      cardOriginYMm={geometry.origin.y}
      punch={punch}
      punchShape={punchShape}
      onPunchChange={setPunch}
      onPunchShapeChange={setPunchShape}
      cardKey={cardKey}
      dataPanel={dataPanel}
    />
  )
}
