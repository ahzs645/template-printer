import { useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import { STACKED_LAYOUT_MAX_WIDTH, usePrinterScope } from '../../contexts/PrinterScope'

type DockablePanelProps = {
  title: string
  children: ReactNode
  side: 'left' | 'right'
  defaultOpen?: boolean
  /**
   * Start open on a phone as well. For a panel that holds what the tab is for,
   * such as the list of people, rather than settings for the card above it.
   */
  openWhenStacked?: boolean
  width?: number
  className?: string
}

export function DockablePanel({
  title,
  children,
  side,
  defaultOpen = true,
  openWhenStacked = false,
  width = 280,
  className,
}: DockablePanelProps) {
  // On a phone-width printer the panels sit under the card, so starting them
  // collapsed keeps the card on screen. The printer's own width decides, not
  // the window's: an embedded printer can be narrow on a wide screen.
  const { width: printerWidth } = usePrinterScope()
  const [isOpen, setIsOpen] = useState(
    () => defaultOpen && (openWhenStacked || printerWidth > STACKED_LAYOUT_MAX_WIDTH),
  )

  const ChevronIcon = side === 'left'
    ? (isOpen ? ChevronLeft : ChevronRight)
    : (isOpen ? ChevronRight : ChevronLeft)

  return (
    <div
      className={cn(
        'dockable-panel',
        `dockable-panel--${side}`,
        isOpen ? 'dockable-panel--open' : 'dockable-panel--closed',
        className
      )}
      style={{ width: isOpen ? width : 32 }}
    >
      <button
        type="button"
        className={cn(
          'dockable-panel__toggle',
          isOpen && 'dockable-panel__toggle--header'
        )}
        onClick={() => setIsOpen(!isOpen)}
        title={isOpen ? `Collapse ${title}` : `Expand ${title}`}
      >
        <ChevronIcon size={16} />
        <span className="dockable-panel__toggle-label">{title}</span>
      </button>

      {isOpen && (
        <div className="dockable-panel__content">
          {children}
        </div>
      )}
    </div>
  )
}

type PanelSectionProps = {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  actions?: ReactNode
}

export function PanelSection({
  title,
  children,
  defaultOpen = true,
  actions,
}: PanelSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className={cn('panel-section', isOpen && 'panel-section--open')}>
      <button
        type="button"
        className="panel-section__header"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="panel-section__chevron">{isOpen ? '▾' : '▸'}</span>
        <span className="panel-section__title">{title}</span>
      </button>
      {actions && <div className="panel-section__actions">{actions}</div>}
      {isOpen && (
        <div className="panel-section__content">
          {children}
        </div>
      )}
    </div>
  )
}
