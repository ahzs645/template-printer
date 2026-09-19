import * as React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/utils'
import { X } from 'lucide-react'

// Elements a user can reach with Tab. The size check drops anything that is
// not rendered, which matters here because several dialogs carry a hidden
// file input that must stay out of the tab order.
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true'
  )
}

// Radix renders an open Select into its own body-level portal. While one is
// up it owns the keyboard, so Escape must dismiss the list rather than the
// dialog underneath it.
function hasOpenPopperLayer(): boolean {
  return document.querySelector('[data-radix-popper-content-wrapper]') !== null
}

// Only the dialog opened last reacts to Escape, so stacked dialogs close one
// at a time instead of all at once.
const openLayers: object[] = []

interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

type DialogContextValue = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  titleId: string
  descriptionId: string
  hasTitle: boolean
  hasDescription: boolean
  setHasTitle: (present: boolean) => void
  setHasDescription: (present: boolean) => void
}

const noop = () => {}

const DialogContext = React.createContext<DialogContextValue>({
  titleId: '',
  descriptionId: '',
  hasTitle: false,
  hasDescription: false,
  setHasTitle: noop,
  setHasDescription: noop,
})

const Dialog: React.FC<DialogProps> = ({ open, onOpenChange, children }) => {
  const baseId = React.useId()
  const [hasTitle, setHasTitle] = React.useState(false)
  const [hasDescription, setHasDescription] = React.useState(false)

  const value = React.useMemo<DialogContextValue>(
    () => ({
      open,
      onOpenChange,
      titleId: `${baseId}-title`,
      descriptionId: `${baseId}-description`,
      hasTitle,
      hasDescription,
      setHasTitle,
      setHasDescription,
    }),
    [open, onOpenChange, baseId, hasTitle, hasDescription]
  )

  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>
}

const DialogTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ children, onClick, ...props }, ref) => {
  const { onOpenChange } = React.useContext(DialogContext)

  return (
    <button
      ref={ref}
      onClick={(e) => {
        onClick?.(e)
        onOpenChange?.(true)
      }}
      {...props}
    >
      {children}
    </button>
  )
})
DialogTrigger.displayName = 'DialogTrigger'

// Renders into document.body so an ancestor that clips or transforms its
// children cannot cut the dialog off or shift where `fixed` anchors it.
const DialogPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { open } = React.useContext(DialogContext)

  if (!open || typeof document === 'undefined') return null

  return createPortal(children, document.body)
}

const DialogOverlay = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { onOpenChange } = React.useContext(DialogContext)

  return (
    <div
      ref={ref}
      className={cn(
        'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm',
        className
      )}
      onClick={() => onOpenChange?.(false)}
      {...props}
    />
  )
})
DialogOverlay.displayName = 'DialogOverlay'

const DialogPanel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { onOpenChange, titleId, descriptionId, hasTitle, hasDescription } =
    React.useContext(DialogContext)
  const panelRef = React.useRef<HTMLDivElement>(null)

  React.useImperativeHandle(ref, () => panelRef.current as HTMLDivElement)

  // Registered before focus moves in, so the element captured here is the one
  // the user was on when the dialog opened.
  React.useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    return () => {
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus({ preventScroll: true })
      }
    }
  }, [])

  // Focus the panel itself rather than the first control: it lets a screen
  // reader announce the dialog, and it keeps a phone keyboard from opening
  // over a dialog the user only meant to read.
  React.useEffect(() => {
    panelRef.current?.focus({ preventScroll: true })
  }, [])

  React.useEffect(() => {
    const layer = {}
    openLayers.push(layer)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (openLayers[openLayers.length - 1] !== layer) return

      if (event.key === 'Escape') {
        if (event.defaultPrevented || hasOpenPopperLayer()) return
        event.preventDefault()
        onOpenChange?.(false)
        return
      }

      if (event.key !== 'Tab') return

      const panel = panelRef.current
      // Focus sitting outside the panel means a portalled layer is driving
      // the keyboard; it cycles its own options, so leave it be.
      if (!panel || !panel.contains(document.activeElement)) return

      const focusable = getFocusable(panel)
      if (focusable.length === 0) {
        event.preventDefault()
        panel.focus({ preventScroll: true })
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus({ preventScroll: true })
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus({ preventScroll: true })
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      const index = openLayers.indexOf(layer)
      if (index >= 0) openLayers.splice(index, 1)
    }
  }, [onOpenChange])

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={hasTitle ? titleId : undefined}
      aria-describedby={hasDescription ? descriptionId : undefined}
      tabIndex={-1}
      className={cn(
        'fixed left-[50%] top-[50%] z-50 grid max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto overscroll-contain rounded-control border border-line bg-surface p-4 text-ink shadow-[var(--shadow-overlay)] focus:outline-none sm:w-full sm:p-6',
        className
      )}
      onClick={(e) => e.stopPropagation()}
      {...props}
    >
      {children}
      <button
        type="button"
        onClick={() => onOpenChange?.(false)}
        className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-control text-ink-muted opacity-70 transition-opacity hover:bg-hover hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface disabled:pointer-events-none"
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </button>
    </div>
  )
})
DialogPanel.displayName = 'DialogPanel'

const DialogContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>((props, ref) => (
  // The panel is a separate component so its effects run on open and clean up
  // on close, rather than for the whole life of the parent screen.
  <DialogPortal>
    <DialogOverlay />
    <DialogPanel ref={ref} {...props} />
  </DialogPortal>
))
DialogContent.displayName = 'DialogContent'

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col space-y-1.5 text-center sm:text-left',
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = 'DialogHeader'

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = 'DialogFooter'

const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, id, ...props }, ref) => {
  const { titleId, setHasTitle } = React.useContext(DialogContext)

  React.useEffect(() => {
    setHasTitle(true)
    return () => setHasTitle(false)
  }, [setHasTitle])

  return (
    <h2
      ref={ref}
      id={id ?? titleId}
      className={cn(
        'pr-8 text-lg font-semibold leading-none tracking-tight text-ink',
        className
      )}
      {...props}
    />
  )
})
DialogTitle.displayName = 'DialogTitle'

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, id, ...props }, ref) => {
  const { descriptionId, setHasDescription } = React.useContext(DialogContext)

  React.useEffect(() => {
    setHasDescription(true)
    return () => setHasDescription(false)
  }, [setHasDescription])

  return (
    <p
      ref={ref}
      id={id ?? descriptionId}
      className={cn('text-sm text-ink-muted', className)}
      {...props}
    />
  )
})
DialogDescription.displayName = 'DialogDescription'

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
