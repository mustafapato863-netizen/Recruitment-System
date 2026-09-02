import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SwitchProps extends Omit<React.ComponentProps<'input'>, 'type' | 'onChange'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: string;
  description?: string;
}

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked = false, onCheckedChange, label, description, disabled, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    return (
      <label
        htmlFor={inputId}
        className={cn(
          'inline-flex items-center gap-3 select-none cursor-pointer',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
      >
        <div className="relative inline-flex items-center">
          <input
            type="checkbox"
            id={inputId}
            role="switch"
            aria-checked={checked}
            checked={checked}
            disabled={disabled}
            onChange={(e) => onCheckedChange?.(e.target.checked)}
            ref={ref}
            className="sr-only peer"
            {...props}
          />
          <div
            className={cn(
              'w-10 h-6 bg-rf-border-strong rounded-full transition-colors duration-200',
              'peer-checked:bg-[var(--primary)]',
              'peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--primary)] peer-focus-visible:ring-offset-2'
            )}
          />
          <div
            className={cn(
              'absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 shadow-xs',
              'peer-checked:translate-x-4'
            )}
          />
        </div>
        {(label || description) && (
          <div className="flex flex-col">
            {label && <span className="text-sm font-semibold text-rf-ink">{label}</span>}
            {description && <span className="text-xs text-rf-ink-muted">{description}</span>}
          </div>
        )}
      </label>
    );
  }
);

Switch.displayName = 'Switch';
