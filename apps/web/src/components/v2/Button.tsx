import * as React from 'react';
import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ButtonV2Kind = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'danger-outline';
export type ButtonV2Size = 'sm' | 'md' | 'lg';

export interface ButtonV2Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  kind?: ButtonV2Kind;
  /** sm 32px, md 36px (default, Figma), lg 44px. Coarse pointers always get 44px. */
  size?: ButtonV2Size;
  icon?: React.ReactNode;
  iconPosition?: 'start' | 'end';
  /** Keeps layout, sets aria-busy, disables, announces loadingLabel. */
  loading?: boolean;
  loadingLabel?: string;
  /** Selected state for toggle buttons (aria-pressed). */
  selected?: boolean;
  block?: boolean;
}

/**
 * v2 Button. States: default, hover, focus-visible, pressed (:active),
 * selected (aria-pressed), disabled, loading. One Primary per page or drawer.
 */
export const ButtonV2 = React.forwardRef<HTMLButtonElement, ButtonV2Props>(function ButtonV2(
  { kind = 'primary', size = 'md', icon, iconPosition = 'start', loading = false, loadingLabel = 'Working…', selected, block, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  const iconNode = loading ? <LoaderCircle className="rf2-spin" aria-hidden="true" /> : icon;
  return (
    <button
      ref={ref}
      type={type}
      data-kind={kind}
      className={cn('rf2-btn', `rf2-btn--${kind}`, `rf2-btn--${size}`, block && 'rf2-btn--block', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-pressed={selected === undefined ? undefined : selected}
      {...rest}
    >
      {iconPosition === 'start' && iconNode ? <span aria-hidden="true" style={{ display: 'contents' }}>{iconNode}</span> : null}
      <span>{children}</span>
      {iconPosition === 'end' && iconNode ? <span aria-hidden="true" style={{ display: 'contents' }}>{iconNode}</span> : null}
      {loading ? <span className="rf2-sr-only" role="status">{loadingLabel}</span> : null}
    </button>
  );
});

export interface DangerConfirmButtonProps extends Omit<ButtonV2Props, 'kind' | 'onClick'> {
  /** Label shown on the filled danger button after the first click. */
  confirmLabel: string;
  onConfirm: () => void;
}

/**
 * Destructive decision per LIVE_SYSTEM_HARDENING: outlined danger until confirmed,
 * then a filled danger action. Escape or blur disarms.
 */
export function DangerConfirmButton({ confirmLabel, onConfirm, children, onBlur, onKeyDown, ...rest }: DangerConfirmButtonProps) {
  const [armed, setArmed] = React.useState(false);
  return (
    <ButtonV2
      {...rest}
      kind={armed ? 'danger' : 'danger-outline'}
      aria-live="polite"
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
      onBlur={(e) => { setArmed(false); onBlur?.(e); }}
      onKeyDown={(e) => { if (e.key === 'Escape') setArmed(false); onKeyDown?.(e); }}
    >
      {armed ? confirmLabel : children}
    </ButtonV2>
  );
}
