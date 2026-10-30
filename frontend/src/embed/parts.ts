/**
 * Template Printer in parts, for hosts that want a card filled and printed in
 * their own interface rather than the whole app:
 *
 *   import { useCardPackage, CardPreview, exportCardsPdf, PRINT_LAYOUTS } from './vendor/template-printer/frontend/src/embed/parts'
 *
 * Nothing here needs `template-printer.css`, Tailwind or storage: the parts are
 * headless, and `CardPreview` is a bare box the host styles. See
 * docs/embedding.md.
 */
export { CardPreview } from './CardPreview'
export type { CardPreviewProps } from './CardPreview'
export { useCardPackage } from './useCardPackage'
export {
  cardDataFor,
  cardSideFor,
  exportCardPng,
  exportCardsPdf,
  openCardPackage,
  parsePeople,
  printLayoutKind,
  renderCardSvg,
} from '../lib/cardPrint'
export type {
  CardFace,
  CardInput,
  CardPackage,
  CardPerson,
  CardPrintOptions,
  CardSideArtwork,
  CardVariantArtwork,
} from '../lib/cardPrint'
export { BUILTIN_PRINT_LAYOUTS as PRINT_LAYOUTS } from '../lib/printLayouts'
export type { PrintLayout } from '../lib/types'
export type { PackageBytes } from '../lib/packageUrl'
