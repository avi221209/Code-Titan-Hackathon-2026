import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-xs font-medium transition-colors duration-150 motion-reduce:transition-none',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-border bg-secondary text-secondary-foreground',
        outline: 'border-border bg-card text-foreground',
        critical:
          'border-severity-critical-border bg-severity-critical-bg text-severity-critical-fg',
        high: 'border-severity-high-border bg-severity-high-bg text-severity-high-fg',
        medium:
          'border-severity-medium-border bg-severity-medium-bg text-severity-medium-fg',
        low: 'border-severity-low-border bg-severity-low-bg text-severity-low-fg',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
