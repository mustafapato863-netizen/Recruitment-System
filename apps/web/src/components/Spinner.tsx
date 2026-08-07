import type { SVGProps } from 'react';

export interface SpinnerProps extends SVGProps<SVGSVGElement> {
  size?: number;
  color?: string;
}

export function Spinner({ size = 24, color = 'var(--primary)', className = '', ...props }: SpinnerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`spinner-icon ${className}`}
      style={{ color, animation: 'spin 0.8s linear infinite' }}
      {...props}
    >
      <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}

export function PageLoadingFallback() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: '16px',
        color: 'var(--muted)',
      }}
    >
      <Spinner size={36} />
      <span style={{ fontSize: '13px', fontWeight: 500 }}>Loading workspace...</span>
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
