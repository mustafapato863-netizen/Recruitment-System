import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-sm border px-2 py-[3px] text-[9.5px] font-bold leading-none tracking-[0.005em] whitespace-nowrap',
  {
    variants: {
      variant: {
        danger: 'border-rf-danger-border bg-rf-danger-soft text-rf-danger-strong',
        success: 'border-rf-success-border bg-rf-success-soft text-rf-success-strong',
        warning: 'border-rf-warning-border bg-rf-warning-soft text-rf-warning-strong',
        info: 'border-rf-info-border bg-rf-info-soft text-rf-info-strong',
        purple: 'border-rf-purple-border bg-rf-purple-soft text-rf-purple',
        cyan: 'border-rf-cyan-border bg-rf-cyan-soft text-rf-cyan',
        neutral: 'border-rf-border bg-rf-surface-subtle text-rf-ink-muted',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export interface BadgeProps extends React.ComponentProps<'span'>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant = 'neutral', ...props }: BadgeProps) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
