import * as React from 'react';
import { cn } from '@/lib/utils';

export interface DateInputProps extends Omit<React.ComponentProps<'input'>, 'type'> {
  label?: string;
  error?: string;
}

export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    return (
      <div className="flex flex-col gap-1 w-full">
        {label && (
          <label htmlFor={inputId} className="text-xs font-semibold text-rf-ink">
            {label}
          </label>
        )}
        <input
          type="date"
          id={inputId}
          ref={ref}
          className={cn(
            'flex h-9 w-full rounded-lg border border-rf-border bg-rf-field px-3 py-2 text-sm font-medium text-rf-ink outline-none transition-[border-color,background-color] duration-150 hover:border-rf-border-strong focus:border-rf-action focus:bg-rf-surface focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-1 disabled:cursor-not-allowed disabled:bg-rf-field-disabled disabled:opacity-65',
            error && 'border-rf-danger focus:border-rf-danger',
            className
          )}
          {...props}
        />
        {error && <span className="text-xs text-rf-danger-strong font-medium">{error}</span>}
      </div>
    );
  }
);

DateInput.displayName = 'DateInput';
