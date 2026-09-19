import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-accent text-ink-on-accent hover:bg-accent-hover',
        secondary:
          'border-transparent bg-surface-alt text-ink hover:bg-hover',
        destructive:
          'border-transparent bg-danger text-danger-on hover:bg-danger-hover',
        outline: 'border-line text-ink',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
