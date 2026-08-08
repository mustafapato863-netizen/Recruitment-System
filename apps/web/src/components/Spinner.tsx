import type { CSSProperties, HTMLAttributes } from 'react';

export interface SpinnerProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'color'> {
  size?: number;
  color?: string;
  secondaryColor?: string;
}

export function Spinner({
  size = 24,
  color = 'var(--primary, #1D4ED8)',
  secondaryColor = 'var(--cyan, #22D3EE)',
  className = '',
  style,
  role = 'status',
  'aria-label': ariaLabel = 'Loading',
  ...props
}: SpinnerProps) {
  const stroke = Math.max(2, Math.round(size / 16));
  const spinnerStyle = {
    '--spinner-size': `${size}px`,
    '--spinner-stroke': `${stroke}px`,
    '--spinner-color-1': color,
    '--spinner-color-2': secondaryColor,
    ...style,
  } as CSSProperties;

  return (
    <span
      className={`spinner-icon ${className}`}
      role={role}
      aria-label={ariaLabel}
      style={spinnerStyle}
      {...props}
    >
      <span aria-hidden="true" />
    </span>
  );
}

export function PageLoadingFallback() {
  return (
    <div className="page-loading-overlay">
      <div
        className="card-neon-purple"
        style={{
          padding: '24px 32px',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          background: 'var(--surface)',
        }}
      >
        <Spinner size={40} aria-label="Loading workspace" />
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>Loading workspace...</span>
      </div>
    </div>
  );
}

export function SkeletonLoader({ height = 20, width = '100%', borderRadius = 6 }: { height?: number | string; width?: number | string; borderRadius?: number }) {
  return (
    <div
      className="skeleton-loader"
      style={{
        height,
        width,
        borderRadius,
        backgroundColor: 'var(--border)',
        opacity: 0.6,
        animation: 'pulseGlow 1.5s ease-in-out infinite',
      }}
    />
  );
}
