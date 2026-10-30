/**
 * Template Printer as a component, for hosts that render it inline.
 *
 *   import { TemplatePrinter } from './vendor/template-printer/frontend/src/embed'
 *   import './vendor/template-printer/frontend/src/embed/template-printer.css'
 *
 * See docs/embedding.md.
 */
export { TemplatePrinter } from './TemplatePrinter'
export type { TemplatePrinterProps, TemplatePrinterStorage, TemplatePrinterTab } from './TemplatePrinter'
export type { PackageBytes } from '../lib/packageUrl'
export type { Theme as TemplatePrinterTheme } from '../contexts/ThemeContext'
