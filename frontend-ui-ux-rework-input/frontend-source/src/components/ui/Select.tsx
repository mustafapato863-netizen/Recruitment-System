import * as React from 'react';
import { cn } from '@/lib/utils';

const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<'select'>>(({ className, ...props }, ref) => (
  <select
    data-slot="select"
    className={cn(
      'h-9 w-full rounded-[7px] border border-rf-border bg-rf-field px-3 text-sm font-semibold text-rf-ink outline-none shadow-[var(--shadow-2xs)] transition-[border-color,box-shadow,background-color] duration-150 hover:border-rf-border-strong focus:border-rf-action focus:ring-2 focus:ring-rf-action/12 disabled:cursor-not-allowed disabled:bg-rf-field-disabled disabled:text-rf-ink-muted disabled:opacity-70 max-md:h-11',
      className,
    )}
    ref={ref}
    {...props}
  />
));

Select.displayName = 'Select';

export { Select };
