import type { CSSProperties, HTMLAttributes, PointerEvent, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type SpotlightTone = 'brand' | 'info' | 'success' | 'warning' | 'neutral';

interface SpotlightCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  tone?: SpotlightTone;
  enableSpotlight?: boolean;
}

type SpotlightStyle = CSSProperties & {
  '--rf-spotlight-x'?: string;
  '--rf-spotlight-y'?: string;
};

/**
 * A restrained, source-owned adaptation of the cursor-spotlight card pattern
 * popularized in the 21st.dev registry. It intentionally avoids tilt, glow,
 * and decorative motion so it remains suitable for dense enterprise screens.
 */
export function SpotlightCard({
  children,
  tone = 'brand',
  enableSpotlight = true,
  className,
  onPointerMove,
  onPointerLeave,
  onPointerEnter,
  ...props
}: SpotlightCardProps) {
  const updateSpotlight = (event: PointerEvent<HTMLDivElement>) => {
    onPointerMove?.(event);
    if (!enableSpotlight || event.pointerType === 'touch') return;
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--rf-spotlight-x', `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty('--rf-spotlight-y', `${event.clientY - rect.top}px`);
  };

  return (
    <div
      {...props}
      className={cn('rf-spotlight-card', `rf-spotlight-card--${tone}`, !enableSpotlight && 'rf-spotlight-card--static', className)}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        if (enableSpotlight && event.pointerType !== 'touch') event.currentTarget.dataset.spotlightActive = 'true';
      }}
      onPointerMove={updateSpotlight}
      onPointerLeave={(event) => {
        onPointerLeave?.(event);
        delete event.currentTarget.dataset.spotlightActive;
      }}
      style={props.style as SpotlightStyle | undefined}
    >
      <div className="rf-spotlight-card__content">{children}</div>
    </div>
  );
}
