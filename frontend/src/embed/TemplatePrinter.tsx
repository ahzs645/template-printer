import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import App, { type ActiveTab } from '../App'
import { ThemeProvider, useTheme, type Theme } from '../contexts/ThemeContext'
import { PrinterScopeProvider, type PrinterScope } from '../contexts/PrinterScope'
import { StorageProviderRoot, type StorageMode } from '../lib/storage'
import type { PackageBytes } from '../lib/packageUrl'
import { cn } from '../lib/utils'

/** The printer's top-level screens, as its icon rail lists them. */
export type TemplatePrinterTab = ActiveTab

/**
 * Where the printer keeps its library.
 *
 * - `local`: IndexedDB in this browser (Dexie). Needs nothing else.
 * - `api`: the Express backend in backend/, at `/api/*` on the page's origin.
 * - `convex`: a Convex deployment; pass `convexUrl`.
 *
 * The standalone app's build names (`server`, `convex-local`, `convex-cloud`)
 * are accepted too.
 */
export type TemplatePrinterStorage = 'local' | 'api' | 'convex' | StorageMode

export type TemplatePrinterProps = {
  /** A template package (.zip) to open. A new object opens again; the same one does not. */
  initialPackage?: PackageBytes
  /** Who sent the package, for messages such as `Opened "Staff card" from Brandkit.` */
  packageLabel?: string
  /** A template package to open by URL: http(s), relative to the page, or a blob: URL. */
  packageUrl?: string
  /** Where the library is kept. Default `local`. */
  storage?: TemplatePrinterStorage
  /** The Convex deployment URL, for `storage="convex"`. */
  convexUrl?: string
  /**
   * Let the printer use the address bar and the page: read `?url=` and
   * `#share/` links on load and clear them afterwards, use the page address
   * for share links, put the theme class on <html> and treat key presses
   * anywhere on the page as its own. Only for a page that is all printer.
   * Default false.
   */
  syncUrl?: boolean
  /** The address share links open (a standalone Template Printer). Without it an embedded printer offers no share links. */
  shareUrl?: string
  /** Called with every package the user downloads (Share → Download package, and the designer's package). */
  onExportPackage?: (bytes: Uint8Array, filename: string) => void
  /** The screen to start on. Default `users`. Opening a package switches to `design`. */
  initialTab?: TemplatePrinterTab
  /** Called when the user (or an opened package) changes screen. */
  onTabChange?: (tab: TemplatePrinterTab) => void
  /** Light or dark. Without it the printer remembers the user's choice, starting from the OS setting. */
  theme?: Theme
  /** Classes for the root element, beside `template-printer`. */
  className?: string
  style?: CSSProperties
}

const STORAGE_MODES: Record<TemplatePrinterStorage, StorageMode> = {
  local: 'local',
  api: 'server',
  server: 'server',
  convex: 'convex-cloud',
  'convex-cloud': 'convex-cloud',
  'convex-local': 'convex-local',
}

/**
 * Template Printer, rendered inline.
 *
 * Fills the box its parent gives it (give the parent a height). Import its
 * styles once, beside it: `frontend/src/embed/template-printer.css`.
 */
export function TemplatePrinter({
  storage = 'local',
  convexUrl,
  syncUrl = false,
  theme,
  ...rest
}: TemplatePrinterProps) {
  const mode = STORAGE_MODES[storage] ?? 'local'
  return (
    <StorageProviderRoot mode={mode} convexUrl={convexUrl}>
      <ThemeProvider
        theme={theme}
        // The standalone app keeps the key it always used; an embedded printer
        // must not share a generic "theme" key with its host.
        storageKey={syncUrl ? 'theme' : 'template-printer.theme'}
        applyToDocument={syncUrl}
      >
        <PrinterRoot syncUrl={syncUrl} {...rest} />
      </ThemeProvider>
    </StorageProviderRoot>
  )
}

type PrinterRootProps = Omit<TemplatePrinterProps, 'storage' | 'convexUrl' | 'theme'> & { syncUrl: boolean }

function PrinterRoot({ syncUrl, shareUrl, className, style, ...appProps }: PrinterRootProps) {
  const { theme } = useTheme()
  const rootRef = useRef<HTMLDivElement>(null)
  const pointerInside = useRef(false)
  const [mounted, setMounted] = useState<{ root: HTMLElement; portal: HTMLElement; width: number } | null>(null)

  // Before the app's first render: measure the box (panels start collapsed in
  // a narrow one) and make the layer dialogs and dropdown lists open into.
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const portal = document.createElement('div')
    portal.className = 'template-printer-portal'
    document.body.appendChild(portal)

    const measured = root.getBoundingClientRect().width
    setMounted({ root, portal, width: measured > 0 ? measured : window.innerWidth })

    // Keys pressed with nothing focused belong to the printer only when the
    // last click was in it.
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      pointerInside.current = target instanceof Node && (root.contains(target) || portal.contains(target))
    }
    document.addEventListener('pointerdown', onPointerDown, true)

    // Layout rules that once took a share of the window take a share of the
    // printer instead (see styles/app.css). A custom property, so a resize
    // restyles without re-rendering the app.
    const setHeight = () => root.style.setProperty('--template-printer-height', `${root.clientHeight}px`)
    setHeight()
    const observer = new ResizeObserver(setHeight)
    observer.observe(root)

    return () => {
      observer.disconnect()
      document.removeEventListener('pointerdown', onPointerDown, true)
      portal.remove()
      setMounted(null)
    }
  }, [])

  const portal = mounted?.portal
  useLayoutEffect(() => {
    if (portal) portal.className = cn('template-printer-portal', theme)
  }, [portal, theme])

  const scope = useMemo<PrinterScope | null>(
    () =>
      mounted && {
        root: mounted.root,
        portal: mounted.portal,
        ownsDocument: syncUrl,
        width: mounted.width,
        pointerInside,
      },
    [mounted, syncUrl],
  )

  return (
    <div ref={rootRef} className={cn('template-printer', theme, className)} style={style}>
      {scope && (
        <PrinterScopeProvider value={scope}>
          <App syncUrl={syncUrl} shareBaseUrl={shareUrl ?? null} {...appProps} />
        </PrinterScopeProvider>
      )}
    </div>
  )
}
