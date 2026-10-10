import * as React from 'react';
import { ChevronDown, CircleCheck, CircleX, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

export type FieldTone = 'default' | 'error' | 'warning' | 'success';

interface FieldShellProps {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  warning?: string;
  success?: string;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  children: (a11y: { 'aria-invalid'?: true; 'aria-describedby'?: string; 'aria-required'?: true }) => React.ReactNode;
}

function FieldShell({ id, label, required, hint, error, warning, success, disabled, readOnly, className, children }: FieldShellProps) {
  const tone: FieldTone = error ? 'error' : warning ? 'warning' : success ? 'success' : 'default';
  const message = error ?? warning ?? success ?? hint;
  const msgId = message ? `${id}-msg` : undefined;
  const MsgIcon = tone === 'error' ? CircleX : tone === 'warning' ? TriangleAlert : tone === 'success' ? CircleCheck : null;
  return (
    <div className={cn('rf2-field', className)} data-state={tone} data-disabled={disabled || undefined} data-readonly={readOnly || undefined}>
      <label className="rf2-field__label" htmlFor={id}>
        {label}
        {required ? <span className="rf2-field__req" aria-hidden="true">*</span> : null}
      </label>
      {children({ 'aria-invalid': error ? true : undefined, 'aria-describedby': msgId, 'aria-required': required ? true : undefined })}
      {message ? (
        <p id={msgId} className={cn('rf2-field__msg', tone !== 'default' && `rf2-field__msg--${tone}`)} role={tone === 'error' ? 'alert' : undefined}>
          {MsgIcon ? <MsgIcon aria-hidden="true" /> : null}
          <span>{message}</span>
        </p>
      ) : null}
    </div>
  );
}

type Common = { label: string; hint?: string; error?: string; warning?: string; success?: string; fieldClassName?: string };

export interface InputV2Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>, Common {
  leadingIcon?: React.ReactNode;
}

/** v2 Input. States: default/empty (placeholder), hover, focus-visible, disabled, read-only, error, warning, success. */
export const InputV2 = React.forwardRef<HTMLInputElement, InputV2Props>(function InputV2(
  { id, label, hint, error, warning, success, fieldClassName, leadingIcon, required, disabled, readOnly, className, ...rest },
  ref,
) {
  const autoId = React.useId();
  const inputId = id ?? `rf2-in-${autoId}`;
  return (
    <FieldShell id={inputId} label={label} required={required} hint={hint} error={error} warning={warning} success={success} disabled={disabled} readOnly={readOnly} className={fieldClassName}>
      {(a11y) => (
        <div className="rf2-field__box">
          {leadingIcon ? <span aria-hidden="true" style={{ display: 'contents' }}>{leadingIcon}</span> : null}
          <input ref={ref} id={inputId} className={cn('rf2-field__control', className)} required={required} disabled={disabled} readOnly={readOnly} {...a11y} {...rest} />
        </div>
      )}
    </FieldShell>
  );
});

export interface SelectV2Props extends React.SelectHTMLAttributes<HTMLSelectElement>, Common {
  placeholder?: string;
}

/**
 * v2 Select: native <select> (the repo has no Radix Select dependency and no
 * new deps are allowed). Same states as Input.
 */
export const SelectV2 = React.forwardRef<HTMLSelectElement, SelectV2Props>(function SelectV2(
  { id, label, hint, error, warning, success, fieldClassName, placeholder, required, disabled, className, children, ...rest },
  ref,
) {
  const autoId = React.useId();
  const selectId = id ?? `rf2-sel-${autoId}`;
  return (
    <FieldShell id={selectId} label={label} required={required} hint={hint} error={error} warning={warning} success={success} disabled={disabled} className={fieldClassName}>
      {(a11y) => (
        <div className="rf2-field__box">
          <select ref={ref} id={selectId} className={cn('rf2-field__control', className)} required={required} disabled={disabled} {...a11y} {...rest}>
            {placeholder !== undefined ? <option value="" disabled>{placeholder}</option> : null}
            {children}
          </select>
          <ChevronDown className="rf2-field__chevron" aria-hidden="true" />
        </div>
      )}
    </FieldShell>
  );
});

export interface TextareaV2Props extends React.TextareaHTMLAttributes<HTMLTextAreaElement>, Common {}

/** v2 Textarea (E2 drawers): same field shell and states as Input. */
export const TextareaV2 = React.forwardRef<HTMLTextAreaElement, TextareaV2Props>(function TextareaV2(
  { id, label, hint, error, warning, success, fieldClassName, required, disabled, readOnly, className, rows = 4, ...rest },
  ref,
) {
  const autoId = React.useId();
  const areaId = id ?? `rf2-ta-${autoId}`;
  return (
    <FieldShell id={areaId} label={label} required={required} hint={hint} error={error} warning={warning} success={success} disabled={disabled} readOnly={readOnly} className={fieldClassName}>
      {(a11y) => (
        <div className="rf2-field__box rf2-field__box--area">
          <textarea ref={ref} id={areaId} rows={rows} className={cn('rf2-field__control rf2-field__control--area', className)} required={required} disabled={disabled} readOnly={readOnly} {...a11y} {...rest} />
        </div>
      )}
    </FieldShell>
  );
});
