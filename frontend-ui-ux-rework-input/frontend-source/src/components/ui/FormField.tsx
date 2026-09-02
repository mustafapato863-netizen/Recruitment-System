import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Icon } from '../Icon';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}

type DirectControlProps = {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
};

function isDirectFormControl(children: ReactNode): children is ReactElement<DirectControlProps> {
  if (!isValidElement<DirectControlProps>(children)) return false;
  if (typeof children.type === 'string') return ['input', 'select', 'textarea'].includes(children.type);
  const displayName = (children.type as { displayName?: string }).displayName;
  return displayName === 'Input' || displayName === 'Select' || displayName === 'Textarea';
}

export function FormField({ id, label, required = false, hint, error, children }: FormFieldProps) {
  const messageId = `${id}-message`;
  const control = isDirectFormControl(children)
    ? (() => {
        const child = children as ReactElement<DirectControlProps>;
        const describedBy = [child.props['aria-describedby'], error || hint ? messageId : undefined]
          .filter(Boolean)
          .join(' ') || undefined;

        return cloneElement(child, {
          id: child.props.id ?? id,
          'aria-describedby': describedBy,
          'aria-invalid': error ? true : child.props['aria-invalid'],
        });
      })()
    : children;

  return (
    <div className="grid gap-1.5">
      <label className="text-[10.5px] font-semibold text-rf-ink" htmlFor={id}>
        {label}
        {required && <span className="ml-0.5 text-rf-danger" aria-hidden="true">*</span>}
      </label>
      {control}
      {(error || hint) && (
        <p
          className={cn(
            'm-0 flex items-start gap-1.5 text-[9.5px] font-medium leading-relaxed text-rf-ink-muted',
            error && 'font-semibold text-rf-danger',
          )}
          id={messageId}
          role={error ? 'alert' : undefined}
        >
          {error && <Icon name="alert-triangle" size={12} className="mt-0.5 shrink-0" aria-hidden="true" />}
          <span>{error ?? hint}</span>
        </p>
      )}
    </div>
  );
}
