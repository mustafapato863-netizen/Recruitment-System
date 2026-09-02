import { useEffect, useRef } from 'react';

export type AtmosphereVariant = 'auth' | 'dashboard' | 'workspace';

interface AtmosphericBackgroundProps {
  className?: string;
  variant?: AtmosphereVariant;
}

/**
 * A restrained, CSS-only ambient canvas. Motion is decorative, pauses while
 * the document is hidden, and is disabled by the user's reduced-motion setting.
 */
export function AtmosphericBackground({
  className = '',
  variant = 'workspace',
}: AtmosphericBackgroundProps) {
  const backgroundRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateVisibility = () => {
      if (backgroundRef.current) {
        backgroundRef.current.dataset.paused = String(document.visibilityState !== 'visible');
      }
    };

    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  return (
    <div
      ref={backgroundRef}
      className={['rf-atmosphere pointer-events-none fixed inset-0 select-none', className].filter(Boolean).join(' ')}
      data-variant={variant}
      aria-hidden="true"
    />
  );
}
