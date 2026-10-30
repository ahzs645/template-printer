import { createContext, useCallback, useContext, type MutableRefObject } from 'react'

/**
 * Where the printer lives on the page.
 *
 * The standalone app owns the whole document; an embedded printer is one
 * element in someone else's page. Components ask this instead of reaching for
 * `window` and `document.body`, so the same code behaves in both.
 */
export type PrinterScope = {
  /** The printer's root element (`.template-printer`). */
  root: HTMLElement | null
  /** A themed element in document.body that dialogs and dropdowns render into. */
  portal: HTMLElement | null
  /** True for the standalone app, which may treat the whole page as its own. */
  ownsDocument: boolean
  /** The root's width in CSS pixels, measured before the app first renders. */
  width: number
  /** Whether the last pointer press on the page landed inside the printer. */
  pointerInside: MutableRefObject<boolean>
}

const fallbackPointer = { current: true }

const PrinterScopeContext = createContext<PrinterScope>({
  root: null,
  portal: null,
  ownsDocument: true,
  width: typeof window === 'undefined' ? 1024 : window.innerWidth,
  pointerInside: fallbackPointer,
})

export const PrinterScopeProvider = PrinterScopeContext.Provider

export function usePrinterScope(): PrinterScope {
  return useContext(PrinterScopeContext)
}

/** The element portalled layers (dialogs, dropdown lists) render into. */
export function usePortalContainer(): HTMLElement | undefined {
  const { portal } = usePrinterScope()
  if (portal) return portal
  return typeof document === 'undefined' ? undefined : document.body
}

/** The layout breakpoint the stylesheet uses for its stacked, phone layout. */
export const STACKED_LAYOUT_MAX_WIDTH = 768

/**
 * Decide whether a keyboard (or clipboard) event is meant for the printer.
 *
 * True when it starts inside the printer or one of its portalled layers. An
 * event aimed at the page itself (nothing focused, as after clicking a canvas)
 * counts when the printer owns the page, or when the last click was inside it;
 * otherwise a host's own page keeps its keys, Backspace included. The
 * standalone app owns the page, so there every event counts.
 */
export function useIsEventInScope(): (event: Event) => boolean {
  const { root, portal, ownsDocument, pointerInside } = usePrinterScope()
  return useCallback(
    (event: Event) => {
      // The standalone app keeps every shortcut it always had.
      if (ownsDocument) return true
      const target = event.target
      if (!(target instanceof Node)) return pointerInside.current
      if (root?.contains(target) || portal?.contains(target)) return true
      const isPage =
        target === document || target === document.body || target === document.documentElement
      return isPage && pointerInside.current
    },
    [root, portal, ownsDocument, pointerInside],
  )
}
