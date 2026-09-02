import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
}

/** Native, form-compatible checkbox with a 44px touch-friendly label target. */
export const CheckboxField = forwardRef<HTMLInputElement, CheckboxFieldProps>(function CheckboxField(
  { id, label, description, error, className, disabled, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = description || error ? `${inputId}-message` : undefined;

  return (
    <label
      className={cn('rf-checkbox-field', disabled && 'is-disabled', className)}
      htmlFor={inputId}
    >
      <input
        {...props}
        ref={ref}
        id={inputId}
        type="checkbox"
        disabled={disabled}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={messageId ?? props['aria-describedby']}
      />
      <span className="rf-checkbox-field__indicator" aria-hidden="true" />
      <span className="rf-checkbox-field__copy">
        <span className="rf-checkbox-field__label">{label}</span>
        {(description || error) && (
          <span className={cn('rf-checkbox-field__description', error && 'is-error')} id={messageId} role={error ? 'alert' : undefined}>
            {error ?? description}
          </span>
        )}
      </span>
    </label>
  );
});
