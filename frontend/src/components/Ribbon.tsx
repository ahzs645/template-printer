import type { ReactNode, MouseEventHandler } from 'react'
import { cn } from '../lib/utils'

type RibbonProps = {
  children: ReactNode
  className?: string
}

export function Ribbon({ children, className }: RibbonProps) {
  return (
    <div className={cn('ribbon', className)}>
      {children}
    </div>
  )
}

type RibbonGroupProps = {
  title: string
  children: ReactNode
}

export function RibbonGroup({ title, children }: RibbonGroupProps) {
  return (
    <div className="ribbon-group">
      <div className="ribbon-group__content">
        {children}
      </div>
      <div className="ribbon-group__title">{title}</div>
    </div>
  )
}

type RibbonButtonProps = {
  icon: ReactNode
  label: string
  onClick?: MouseEventHandler<HTMLButtonElement>
  disabled?: boolean
  active?: boolean
  size?: 'small' | 'large'
  as?: 'button' | 'label'
  htmlFor?: string
}

export function RibbonButton({
  icon,
  label,
  onClick,
  disabled = false,
  active = false,
  size = 'small',
  as = 'button',
}: RibbonButtonProps) {
  const className = cn(
    'ribbon-button',
    `ribbon-button--${size}`,
    active && 'ribbon-button--active',
    disabled && 'ribbon-button--disabled'
  )

  if (as === 'label') {
    return (
      <label className={className}>
        <span className="ribbon-button__icon">{icon}</span>
        <span className="ribbon-button__label">{label}</span>
      </label>
    )
  }

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="ribbon-button__icon">{icon}</span>
      <span className="ribbon-button__label">{label}</span>
    </button>
  )
}

type RibbonDividerProps = {
  className?: string
}

export function RibbonDivider({ className }: RibbonDividerProps) {
  return <div className={cn('ribbon-divider', className)} />
}
