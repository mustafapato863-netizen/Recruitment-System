import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from '../Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost' | 'quiet';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingLabel?: string;
  children: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  loadingLabel = 'Loading',
  children,
  className = '',
  disabled,
  'aria-label': ariaLabel,
  ...props
}: ButtonProps) {
  const classes = ['ui-button', `ui-button--${variant}`, `ui-button--${size}`, loading ? 'is-loading' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      {...props}
      aria-busy={loading || undefined}
      aria-label={loading ? loadingLabel : ariaLabel}
      className={classes}
      disabled={disabled || loading}
    >
      <span aria-hidden={loading}>{children}</span>
      {loading && <Spinner size={18} aria-label={loadingLabel} />}
    </button>
  );
}
