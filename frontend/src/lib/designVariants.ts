/**
 * Variants of a card design.
 *
 * A design often comes in several looks that are otherwise the same card: a
 * watermark in grey or in colour, a version with a lanyard slot and one
 * without, a Student and a Staff edition. Each look is a variant. Variants
 * share everything that is not artwork:
 *
 * - the back of the card (unless a variant brings its own),
 * - what each layer means (field mappings are kept the same on every variant),
 * - the data typed in while designing, since the layers have the same names.
 *
 * Only the front artwork differs. A design without variants behaves exactly as
 * before: it has one implicit variant, made from its own front and back.
 *
 * Which variant a card prints with is either the one chosen for the whole run,
 * or — when the design says so — read from each person's record: a variant can
 * list the values (of position, department, grade …) it is used for.
 */

import type { UserData } from './fieldParser'
import type { CardDesign } from './types'

export type CardDesignVariant = {
  id: string
  name: string
  frontTemplateId: string | null
  /** A back of its own; when absent the design's back is used. */
  backTemplateId?: string | null
  /** Record values (of the design's `variantField`) that select this variant. */
  match?: string[]
}

/** The record fields a variant can be chosen by. */
export const VARIANT_FIELDS = ['position', 'department', 'grade'] as const

export const DEFAULT_VARIANT_ID = 'default'

export function newVariantId(): string {
  return `variant-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

/** Every variant of a design, the default first. Never empty for a design with a front. */
export function getDesignVariants(design: CardDesign | null | undefined): CardDesignVariant[] {
  if (!design) return []
  if (design.variants && design.variants.length > 0) return design.variants
  return [{ id: DEFAULT_VARIANT_ID, name: 'Default', frontTemplateId: design.frontTemplateId }]
}

export function hasVariants(design: CardDesign | null | undefined): boolean {
  return Boolean(design?.variants && design.variants.length > 1)
}

/** The variant whose front (or own back) is this template. */
export function findVariantByTemplate(
  design: CardDesign | null | undefined,
  templateId: string | null | undefined,
): CardDesignVariant | null {
  if (!design || !templateId) return null
  return (
    getDesignVariants(design).find(
      (variant) => variant.frontTemplateId === templateId || variant.backTemplateId === templateId,
    ) ?? null
  )
}

/** The design a template belongs to, as any variant's front or back, or the shared back. */
export function findDesignForTemplate(designs: CardDesign[], templateId: string): CardDesign | null {
  return (
    designs.find(
      (design) =>
        design.frontTemplateId === templateId ||
        design.backTemplateId === templateId ||
        Boolean(findVariantByTemplate(design, templateId)),
    ) ?? null
  )
}

/** The two sides a variant prints with. */
export function variantSides(
  design: CardDesign,
  variant: CardDesignVariant | null | undefined,
): { frontTemplateId: string | null; backTemplateId: string | null } {
  const chosen = variant ?? getDesignVariants(design)[0]
  return {
    frontTemplateId: chosen?.frontTemplateId ?? design.frontTemplateId,
    backTemplateId: chosen?.backTemplateId ?? design.backTemplateId,
  }
}

/**
 * The patch that stores a new variant list. The first variant is the default,
 * and the design's own front follows it, so anything that only knows about
 * `frontTemplateId` (older code, other storage, an older app opening the
 * library) still sees a sensible card.
 */
export function variantsPatch(
  variants: CardDesignVariant[],
): { variants: CardDesignVariant[]; frontTemplateId: string | null } {
  return { variants, frontTemplateId: variants[0]?.frontTemplateId ?? null }
}

/** Variants with one added. A design with no variants yet first gains its implicit one. */
export function addVariant(design: CardDesign, variant: Omit<CardDesignVariant, 'id'> & { id?: string }): CardDesignVariant[] {
  const existing = design.variants && design.variants.length > 0
    ? design.variants
    : [{ id: newVariantId(), name: 'Default', frontTemplateId: design.frontTemplateId }]
  return [...existing, { ...variant, id: variant.id ?? newVariantId() }]
}

export function renameVariant(design: CardDesign, id: string, name: string): CardDesignVariant[] {
  return getDesignVariants(design).map((variant) => (variant.id === id ? { ...variant, name } : variant))
}

export function setVariantMatch(design: CardDesign, id: string, match: string[]): CardDesignVariant[] {
  return getDesignVariants(design).map((variant) => (variant.id === id ? { ...variant, match } : variant))
}

/** Variants without one. The last variant cannot be removed. */
export function removeVariant(design: CardDesign, id: string): CardDesignVariant[] {
  const variants = getDesignVariants(design)
  if (variants.length <= 1) return variants
  return variants.filter((variant) => variant.id !== id)
}

/** Variants with this one moved first, making it the default. */
export function makeDefaultVariant(design: CardDesign, id: string): CardDesignVariant[] {
  const variants = getDesignVariants(design)
  const chosen = variants.find((variant) => variant.id === id)
  if (!chosen) return variants
  return [chosen, ...variants.filter((variant) => variant.id !== id)]
}

/** Parse "Staff, Faculty" into the values a variant matches. */
export function parseMatchList(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((part) => part.trim())
    .filter(Boolean)
}

/**
 * The variant a person's card prints with: the first variant listing their
 * value for the design's variant field, or `fallback` when none does (or the
 * design does not choose per person).
 */
export function variantForUser(
  design: CardDesign,
  user: UserData,
  fallback: CardDesignVariant | null,
): CardDesignVariant | null {
  const field = design.variantField
  if (!field) return fallback
  const raw = (user as unknown as Record<string, unknown>)[field]
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (!value) return fallback
  return (
    getDesignVariants(design).find((variant) =>
      (variant.match ?? []).some((candidate) => candidate.trim().toLowerCase() === value),
    ) ?? fallback
  )
}
