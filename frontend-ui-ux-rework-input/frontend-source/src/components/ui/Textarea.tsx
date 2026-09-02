import * as React from 'react';
import { cn } from '@/lib/utils';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(({ className, rows = 3, ...props }, ref) => (
  <textarea
    data-slot="textarea"
    className={cn(
      'flex w-full resize-y rounded-[7px] border border-rf-border bg-rf-field px-3 py-2.5 text-sm font-medium leading-relaxed text-rf-ink outline-none placeholder:text-rf-ink-muted/65 shadow-[var(--shadow-2xs)] transition-[border-color,box-shadow,background-color] duration-150 hover:border-rf-border-strong focus:border-rf-action focus:bg-rf-surface focus:ring-2 focus:ring-rf-action/12 disabled:cursor-not-allowed disabled:bg-rf-field-disabled disabled:text-rf-ink-muted disabled:opacity-70 read-only:bg-rf-surface-subtle read-only:text-rf-ink-muted',
      className,
    )}
    ref={ref}
    rows={rows}
    {...props}
  />
));

Textarea.displayName = 'Textarea';

export { Textarea };
