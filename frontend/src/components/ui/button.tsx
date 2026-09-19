import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

// Colours come from the theme variables rather than a fixed palette, so a
// button matches the panel it sits in under either theme. Heights come from
// the shared control scale, so a button beside a field lines up with it.
const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-control font-medium leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-accent text-ink-on-accent hover:bg-accent-hover',
        destructive: 'bg-danger text-danger-on hover:bg-danger-hover',
        outline: 'border border-line bg-surface text-ink hover:bg-hover',
        secondary: 'bg-surface-alt text-ink border border-line-subtle hover:bg-hover',
        ghost: 'text-ink-muted hover:bg-hover hover:text-ink',
        link: 'text-accent underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-control px-3.5 text-sm',
        sm: 'h-control-sm px-2.5 text-xs',
        lg: 'h-control-lg px-6 text-sm',
        icon: 'h-control w-control p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
