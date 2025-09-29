import { useState } from 'react'
import type { ReactNode } from 'react'

import '../App.css'

type CollapsibleSectionProps = {
  title: string
  children: ReactNode
  actions?: ReactNode
  defaultOpen?: boolean
  description?: ReactNode
}

export function CollapsibleSection({ title, children, actions, defaultOpen = true, description }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="collapsible">
      <button className="collapsible__header" type="button" onClick={() => setIsOpen((value) => !value)}>
        <span className="collapsible__chevron" aria-hidden>{isOpen ? '▾' : '▸'}</span>
        <span className="collapsible__title">{title}</span>
      </button>
      {description ? <p className="collapsible__description">{description}</p> : null}
      {actions ? <div className="collapsible__actions">{actions}</div> : null}
      <div className={`collapsible__content${isOpen ? ' is-open' : ''}`} aria-hidden={!isOpen}>
        {children}
      </div>
    </div>
  )
}
