import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Spinner } from '../Spinner';

export const buttonVariants = cva(
  'relative inline-flex items-center justify-center gap-2 rounded-lg border font-rf font-semibold leading-none no-underline transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-[var(--ease-standard)] select-none whitespace-nowrap active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-neon-cyan)] focus-visible:ring-offset-2 focus-visible:ring-offset-rf-surface disabled:pointer-events-none disabled:opacity-60',
  {
    variants: {
      variant: {
        default: 'border-rf-action bg-rf-action text-rf-on-action hover:border-rf-action-strong hover:bg-rf-action-strong',
        primary: 'border-rf-action bg-rf-action text-rf-on-action hover:border-rf-action-strong hover:bg-rf-action-strong',
        secondary: 'border-rf-border bg-rf-surface text-rf-ink hover:border-rf-border-strong hover:bg-rf-surface-hover',
        tertiary: 'border-transparent bg-rf-surface-subtle text-rf-ink hover:bg-rf-surface-muted',
        outline: 'border-rf-border bg-transparent text-rf-ink hover:border-rf-border-strong hover:bg-rf-surface-hover',
        success: 'border-rf-success bg-rf-success text-rf-on-status hover:brightness-95',
        danger: 'border-rf-danger bg-rf-danger text-rf-on-status hover:brightness-95',
        destructive: 'border-rf-danger bg-rf-danger text-rf-on-status hover:brightness-95',
        warning: 'border-rf-warning bg-rf-warning text-rf-on-status hover:brightness-95',
        ghost: 'border-transparent bg-transparent text-rf-ink-muted hover:bg-rf-surface-hover hover:text-rf-ink',
        quiet: 'border-transparent bg-transparent text-rf-ink-muted hover:bg-rf-surface-subtle hover:text-rf-ink',
        link: 'border-transparent bg-transparent px-0 text-rf-action underline-offset-4 hover:text-rf-action-strong hover:underline',
      },
      size: {
        default: 'h-9 min-h-9 px-3.5 text-[11.5px]',
        sm: 'h-8 min-h-8 px-2.5 text-[11px] max-md:h-10 max-md:min-h-10',
        md: 'h-9 min-h-9 px-3.5 text-[11.5px]',
        lg: 'h-10 min-h-10 px-4 text-xs',
        icon: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'default',
    },
  },
);

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>['variant']>;
export type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>['size']>;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  loadingLabel?: string;
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'secondary',
      size = 'default',
      loading = false,
      loadingLabel = 'Loading',
      asChild = false,
      disabled,
      'aria-label': ariaLabel,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        ref={ref}
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        aria-label={loading ? loadingLabel : ariaLabel}
        {...props}
      >
        {loading ? (
          <>
            <Spinner size={13} aria-label={loadingLabel} />
            <span>{loadingLabel}</span>
          </>
        ) : children}
      </Comp>
    );
  },
);
Button.displayName = 'Button';
