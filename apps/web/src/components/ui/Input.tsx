import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(({ className, type = 'text', ...props }, ref) => (
  <input
    type={type}
    data-slot="input"
    className={cn(
      'flex h-9 w-full rounded-[7px] border border-rf-border bg-rf-field px-3 py-2 text-sm font-medium text-rf-ink outline-none placeholder:text-rf-ink-muted/65 shadow-[var(--shadow-2xs)] transition-[border-color,box-shadow,background-color] duration-150 hover:border-rf-border-strong focus:border-rf-action focus:bg-rf-surface focus:ring-2 focus:ring-rf-action/12 disabled:cursor-not-allowed disabled:bg-rf-field-disabled disabled:text-rf-ink-muted disabled:opacity-70 read-only:bg-rf-surface-subtle read-only:text-rf-ink-muted max-md:h-11',
      className,
    )}
    ref={ref}
    {...props}
  />
));

Input.displayName = 'Input';

export { Input };
