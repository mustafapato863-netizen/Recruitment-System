import type { ReactNode } from 'react';

interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export function FormField({ id, label, required = false, hint, error, children }: FormFieldProps) {
  const messageId = `${id}-message`;

  return (
    <div className={['ui-form-field', error ? 'has-error' : ''].filter(Boolean).join(' ')}>
      <label htmlFor={id}>
        {label}
        {required && <span className="ui-form-field__required" aria-hidden="true"> *</span>}
      </label>
      {children}
      {(error || hint) && (
        <p className={error ? 'ui-form-field__message is-error' : 'ui-form-field__message'} id={messageId} role={error ? 'alert' : undefined}>
          {error && <span className="ui-form-field__error-icon" aria-hidden="true">!</span>}
          <span>{error ?? hint}</span>
        </p>
      )}
    </div>
  );
}
