import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(({ className, type = 'text', ...props }, ref) => (
  <input
    type={type}
    data-slot="input"
    className={cn(
      'flex h-9 w-full rounded-lg border border-rf-border bg-rf-field px-3 py-2 text-xs font-medium text-rf-ink outline-none placeholder:text-rf-ink-muted/65 transition-[border-color,background-color] duration-150 hover:border-rf-border-strong focus:border-rf-action focus:bg-rf-surface focus:ring-2 focus:ring-[var(--color-neon-cyan)] focus:ring-offset-1 focus:ring-offset-rf-surface disabled:cursor-not-allowed disabled:bg-rf-field-disabled disabled:text-rf-ink-muted disabled:opacity-65 read-only:bg-rf-surface-subtle read-only:text-rf-ink-muted max-md:h-10',
      className,
    )}
    ref={ref}
    {...props}
  />
));

Input.displayName = 'Input';

export { Input };
