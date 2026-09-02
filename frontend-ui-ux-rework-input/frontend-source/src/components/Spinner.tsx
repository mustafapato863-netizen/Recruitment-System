import type { HTMLAttributes } from 'react';
import { SghAnimatedLogo } from '../design-system/brand/sgh-animated-logo';

export interface SpinnerProps extends HTMLAttributes<SVGSVGElement> {
  size?: number;
  color?: string;
}

export function Spinner({
  size = 20,
  className = '',
  role = 'status',
  'aria-label': ariaLabel = 'Loading...',
  ...props
}: SpinnerProps) {
  return (
    <svg
      className={['animate-spin text-rf-action shrink-0', className].filter(Boolean).join(' ')}
      fill="none"
      height={size}
      role={role}
      aria-label={ariaLabel}
      viewBox="0 0 24 24"
      width={size}
      {...props}
    >
      <circle
        className="opacity-20"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-90"
        d="M4 12a8 8 0 018-8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="3"
      />
    </svg>
  );
}

export function PageLoadingFallback({ message = 'Loading workspace...' }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 p-4 backdrop-blur-[2px]">
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-rf-border-subtle bg-rf-surface/95 px-8 py-7 shadow-[var(--shadow-float)] animate-in zoom-in-95 duration-300">
        <SghAnimatedLogo size={48} showText={false} />
        <span className="text-[13px] font-bold tracking-tight text-rf-ink mt-2">{message}</span>
      </div>
    </div>
  );
}

export function InlinePageLoadingFallback({ message = 'Loading page...' }: { message?: string }) {
  return (
    <div className="flex min-h-[55vh] w-full items-center justify-center px-4 py-12" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-rf-border-subtle bg-rf-surface/90 px-8 py-7 shadow-[var(--shadow-card)] backdrop-blur-sm animate-in fade-in duration-300">
        <SghAnimatedLogo size={42} showText={false} />
        <div className="text-center mt-1">
          <strong className="block text-[13px] font-bold tracking-tight text-rf-ink">{message}</strong>
          <span className="mt-1 block text-[11px] font-medium text-rf-ink-muted uppercase tracking-wider">Preparing your workspace</span>
        </div>
      </div>
    </div>
  );
}

export function SkeletonLoader({
  height = 20,
  width = '100%',
  className = '',
}: {
  height?: number | string;
  width?: number | string;
  className?: string;
}) {
  return (
    <div
      className={['rf-skeleton rounded-lg bg-rf-surface-muted/70', className].filter(Boolean).join(' ')}
      style={{ height, width }}
      aria-hidden="true"
    />
  );
}
