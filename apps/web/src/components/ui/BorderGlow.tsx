import { type ReactNode, type CSSProperties } from 'react';
import './BorderGlow.css';

export interface BorderGlowProps {
  children?: ReactNode;
  className?: string;
  edgeSensitivity?: number;
  glowColor?: string;
  backgroundColor?: string;
  borderRadius?: number;
  glowRadius?: number;
  glowIntensity?: number;
  coneSpread?: number;
  animated?: boolean;
  colors?: string[];
  fillOpacity?: number;
  style?: CSSProperties;
}

export function BorderGlow({
  children,
  className = '',
  backgroundColor,
  borderRadius = 28,
  style = {},
}: BorderGlowProps) {
  const resolvedBg = backgroundColor ?? 'var(--color-surface)';

  return (
    <div
      className={`border-glow-card ${className}`.trim()}
      style={
        {
          '--card-bg': resolvedBg,
          '--border-radius': `${borderRadius}px`,
          ...style,
        } as CSSProperties
      }
    >
      <div className="border-glow-inner">{children}</div>
    </div>
  );
}

export default BorderGlow;
