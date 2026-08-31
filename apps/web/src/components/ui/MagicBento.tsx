import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { gsap } from 'gsap';
import './MagicBento.css';

const DEFAULT_PARTICLE_COUNT = 12;
const DEFAULT_SPOTLIGHT_RADIUS = 300;
const DEFAULT_GLOW_COLOR = '23, 105, 232';
const MOBILE_BREAKPOINT = 768;

export interface MagicBentoItem {
  id?: string;
  label: string;
  title: string;
  description: string;
  value?: ReactNode;
  valueSuffix?: string;
  badge?: string;
  color?: string;
  accent?: string;
}

export interface MagicBentoProps {
  items?: MagicBentoItem[];
  textAutoHide?: boolean;
  enableStars?: boolean;
  enableSpotlight?: boolean;
  enableBorderGlow?: boolean;
  disableAnimations?: boolean;
  spotlightRadius?: number;
  particleCount?: number;
  enableTilt?: boolean;
  glowColor?: string;
  clickEffect?: boolean;
  enableMagnetism?: boolean;
  className?: string;
}

type MagicBentoStyle = CSSProperties & {
  '--magic-bento-card-color'?: string;
  '--magic-bento-accent'?: string;
  '--magic-bento-glow-color'?: string;
};

const defaultItems: MagicBentoItem[] = [
  { label: 'Insights', title: 'Analytics', description: 'Track operational performance', accent: 'var(--color-action)' },
  { label: 'Overview', title: 'Dashboard', description: 'Keep the workspace in view', accent: 'var(--color-info)' },
  { label: 'Teamwork', title: 'Collaboration', description: 'Keep hiring teams aligned', accent: 'var(--color-purple)' },
  { label: 'Efficiency', title: 'Automation', description: 'Streamline repeatable work', accent: 'var(--color-success)' },
  { label: 'Connectivity', title: 'Integration', description: 'Connect the tools you use', accent: 'var(--color-cyan)' },
  { label: 'Protection', title: 'Security', description: 'Keep access and activity clear', accent: 'var(--color-warning)' },
];

const createParticleElement = (x: number, y: number, color: string) => {
  const element = document.createElement('span');
  element.className = 'magic-bento-particle';
  element.setAttribute('aria-hidden', 'true');
  element.style.left = `${x}px`;
  element.style.top = `${y}px`;
  element.style.setProperty('--magic-bento-particle-color', color);
  element.style.setProperty('--magic-bento-particle-shadow', `color-mix(in srgb, ${color} 55%, transparent)`);
  return element;
};

const normalizeGlowColor = (color: string) => {
  if (!color.includes(',')) return color;
  return `rgb(${color.split(',').map((part) => part.trim()).join(' ')})`; // design-token-exception: caller-provided effect channels are normalized to a CSS color.
};

const calculateSpotlightValues = (radius: number) => ({
  proximity: radius * 0.5,
  fadeDistance: radius * 0.75,
});

const updateCardGlowProperties = (
  card: HTMLElement,
  mouseX: number,
  mouseY: number,
  glow: number,
  radius: number,
) => {
  const rect = card.getBoundingClientRect();
  const relativeX = rect.width === 0 ? 50 : ((mouseX - rect.left) / rect.width) * 100;
  const relativeY = rect.height === 0 ? 50 : ((mouseY - rect.top) / rect.height) * 100;

  card.style.setProperty('--glow-x', `${relativeX}%`);
  card.style.setProperty('--glow-y', `${relativeY}%`);
  card.style.setProperty('--glow-intensity', glow.toString());
  card.style.setProperty('--glow-radius', `${radius}px`);
};

interface ParticleCardProps {
  children: ReactNode;
  className: string;
  style: MagicBentoStyle;
  disableAnimations: boolean;
  enableStars: boolean;
  particleCount: number;
  glowColor: string;
  enableTilt: boolean;
  clickEffect: boolean;
  enableMagnetism: boolean;
}

function ParticleCard({
  children,
  className,
  style,
  disableAnimations,
  enableStars,
  particleCount,
  glowColor,
  enableTilt,
  clickEffect,
  enableMagnetism,
}: ParticleCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<HTMLSpanElement[]>([]);
  const particleTemplatesRef = useRef<HTMLSpanElement[]>([]);
  const timeoutsRef = useRef<number[]>([]);
  const isHoveredRef = useRef(false);
  const particlesInitializedRef = useRef(false);
  const magnetismAnimationRef = useRef<gsap.core.Tween | null>(null);

  const initializeParticles = useCallback(() => {
    if (particlesInitializedRef.current || !cardRef.current) return;

    const { width, height } = cardRef.current.getBoundingClientRect();
    particleTemplatesRef.current = Array.from({ length: particleCount }, () =>
      createParticleElement(Math.random() * width, Math.random() * height, glowColor),
    );
    particlesInitializedRef.current = true;
  }, [glowColor, particleCount]);

  const clearAllParticles = useCallback(() => {
    timeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutsRef.current = [];
    magnetismAnimationRef.current?.kill();

    const activeParticles = particlesRef.current;
    particlesRef.current = [];
    activeParticles.forEach((particle) => {
      gsap.killTweensOf(particle);
      gsap.to(particle, {
        scale: 0,
        opacity: 0,
        duration: 0.18,
        ease: 'back.in(1.7)',
        onComplete: () => particle.remove(),
      });
    });
  }, []);

  const animateParticles = useCallback(() => {
    if (!enableStars || !cardRef.current || !isHoveredRef.current) return;
    if (!particlesInitializedRef.current) initializeParticles();

    particleTemplatesRef.current.forEach((template, index) => {
      const timeoutId = window.setTimeout(() => {
        if (!isHoveredRef.current || !cardRef.current) return;

        const particle = template.cloneNode(true) as HTMLSpanElement;
        cardRef.current.appendChild(particle);
        particlesRef.current.push(particle);

        gsap.fromTo(
          particle,
          { scale: 0, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.28, ease: 'back.out(1.7)' },
        );
        gsap.to(particle, {
          x: (Math.random() - 0.5) * 96,
          y: (Math.random() - 0.5) * 96,
          rotation: Math.random() * 360,
          duration: 2 + Math.random() * 2,
          ease: 'none',
          repeat: -1,
          yoyo: true,
        });
        gsap.to(particle, {
          opacity: 0.3,
          duration: 1.5,
          ease: 'power2.inOut',
          repeat: -1,
          yoyo: true,
        });
      }, index * 90);

      timeoutsRef.current.push(timeoutId);
    });
  }, [enableStars, initializeParticles]);

  useEffect(() => {
    if (disableAnimations || !cardRef.current) return undefined;

    const element = cardRef.current;
    const handleMouseEnter = () => {
      isHoveredRef.current = true;
      animateParticles();
    };

    const handleMouseLeave = () => {
      isHoveredRef.current = false;
      clearAllParticles();

      if (enableTilt) {
        gsap.to(element, { rotateX: 0, rotateY: 0, duration: 0.24, ease: 'power2.out' });
      }
      if (enableMagnetism) {
        gsap.to(element, { x: 0, y: 0, duration: 0.24, ease: 'power2.out' });
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!enableTilt && !enableMagnetism) return;

      const rect = element.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      if (enableTilt && centerX > 0 && centerY > 0) {
        gsap.to(element, {
          rotateX: ((y - centerY) / centerY) * -6,
          rotateY: ((x - centerX) / centerX) * 6,
          duration: 0.1,
          ease: 'power2.out',
          transformPerspective: 1000,
          overwrite: 'auto',
        });
      }

      if (enableMagnetism) {
        magnetismAnimationRef.current = gsap.to(element, {
          x: (x - centerX) * 0.035,
          y: (y - centerY) * 0.035,
          duration: 0.24,
          ease: 'power2.out',
          overwrite: 'auto',
        });
      }
    };

    const handleClick = (event: MouseEvent) => {
      if (!clickEffect) return;

      const rect = element.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const maxDistance = Math.max(
        Math.hypot(x, y),
        Math.hypot(x - rect.width, y),
        Math.hypot(x, y - rect.height),
        Math.hypot(x - rect.width, y - rect.height),
      );
      const ripple = document.createElement('span');
      ripple.className = 'magic-bento-ripple';
      ripple.setAttribute('aria-hidden', 'true');
      ripple.style.width = `${maxDistance * 2}px`;
      ripple.style.height = `${maxDistance * 2}px`;
      ripple.style.left = `${x - maxDistance}px`;
      ripple.style.top = `${y - maxDistance}px`;
      ripple.style.setProperty('--magic-bento-ripple-color', normalizeGlowColor(glowColor));
      element.appendChild(ripple);

      gsap.fromTo(
        ripple,
        { scale: 0, opacity: 1 },
        { scale: 1, opacity: 0, duration: 0.64, ease: 'power2.out', onComplete: () => ripple.remove() },
      );
    };

    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);
    element.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('click', handleClick);

    return () => {
      isHoveredRef.current = false;
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
      element.removeEventListener('mousemove', handleMouseMove);
      element.removeEventListener('click', handleClick);
      clearAllParticles();
      gsap.killTweensOf(element);
      element.querySelectorAll('.magic-bento-ripple').forEach((ripple) => ripple.remove());
    };
  }, [animateParticles, clearAllParticles, clickEffect, disableAnimations, enableMagnetism, enableTilt, glowColor]);

  return (
    <div ref={cardRef} className={`${className} magic-bento-card`} style={style}>
      {children}
    </div>
  );
}

interface GlobalSpotlightProps {
  gridRef: RefObject<HTMLDivElement | null>;
  disableAnimations: boolean;
  enabled: boolean;
  spotlightRadius: number;
  glowColor: string;
}

function GlobalSpotlight({
  gridRef,
  disableAnimations,
  enabled,
  spotlightRadius,
  glowColor,
}: GlobalSpotlightProps) {
  const spotlightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (disableAnimations || !enabled || !gridRef.current) return undefined;

    const spotlight = document.createElement('div');
    spotlight.className = 'magic-bento-global-spotlight';
    spotlight.style.setProperty('--magic-bento-glow-color', normalizeGlowColor(glowColor));
    document.body.appendChild(spotlight);
    spotlightRef.current = spotlight;

    const handleMouseMove = (event: MouseEvent) => {
      const grid = gridRef.current;
      if (!grid || !spotlightRef.current) return;

      const rect = grid.getBoundingClientRect();
      const isInside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      const cards = Array.from(grid.querySelectorAll<HTMLElement>('.magic-bento-card'));

      if (!isInside) {
        gsap.to(spotlightRef.current, { opacity: 0, duration: 0.24, ease: 'power2.out' });
        cards.forEach((card) => card.style.setProperty('--glow-intensity', '0'));
        return;
      }

      const { proximity, fadeDistance } = calculateSpotlightValues(spotlightRadius);
      let minDistance = Number.POSITIVE_INFINITY;

      cards.forEach((card) => {
        const cardRect = card.getBoundingClientRect();
        const centerX = cardRect.left + cardRect.width / 2;
        const centerY = cardRect.top + cardRect.height / 2;
        const distance = Math.max(
          0,
          Math.hypot(event.clientX - centerX, event.clientY - centerY) - Math.max(cardRect.width, cardRect.height) / 2,
        );
        minDistance = Math.min(minDistance, distance);

        const glow = distance <= proximity
          ? 1
          : distance <= fadeDistance
            ? (fadeDistance - distance) / (fadeDistance - proximity)
            : 0;
        updateCardGlowProperties(card, event.clientX, event.clientY, glow, spotlightRadius);
      });

      gsap.to(spotlightRef.current, {
        left: event.clientX,
        top: event.clientY,
        duration: 0.1,
        ease: 'power2.out',
        overwrite: 'auto',
      });
      gsap.to(spotlightRef.current, {
        opacity: minDistance <= proximity
          ? 0.7
          : minDistance <= fadeDistance
            ? ((fadeDistance - minDistance) / (fadeDistance - proximity)) * 0.7
            : 0,
        duration: 0.18,
        ease: 'power2.out',
        overwrite: 'auto',
      });
    };

    document.addEventListener('mousemove', handleMouseMove, { passive: true });

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      gsap.killTweensOf(spotlight);
      spotlight.remove();
      spotlightRef.current = null;
    };
  }, [disableAnimations, enabled, glowColor, gridRef, spotlightRadius]);

  return null;
}

function useAnimationDisabled() {
  const [isDisabled, setIsDisabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    const reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return window.innerWidth <= MOBILE_BREAKPOINT || reducedMotion;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mediaQuery = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
    const update = () => setIsDisabled(window.innerWidth <= MOBILE_BREAKPOINT || Boolean(mediaQuery?.matches));

    update();
    window.addEventListener('resize', update);
    mediaQuery?.addEventListener?.('change', update);

    return () => {
      window.removeEventListener('resize', update);
      mediaQuery?.removeEventListener?.('change', update);
    };
  }, []);

  return isDisabled;
}

export default function MagicBento({
  items = defaultItems,
  textAutoHide = true,
  enableStars = true,
  enableSpotlight = true,
  enableBorderGlow = true,
  disableAnimations = false,
  spotlightRadius = DEFAULT_SPOTLIGHT_RADIUS,
  particleCount = DEFAULT_PARTICLE_COUNT,
  enableTilt = false,
  glowColor = DEFAULT_GLOW_COLOR,
  clickEffect = true,
  enableMagnetism = true,
  className = '',
}: MagicBentoProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const automaticAnimationDisabled = useAnimationDisabled();
  const shouldDisableAnimations = disableAnimations || automaticAnimationDisabled;
  const resolvedItems = items;

  return (
    <div className={`magic-bento-section magic-bento-grid ${className}`.trim()} ref={gridRef}>
      {enableSpotlight && (
        <GlobalSpotlight
          gridRef={gridRef}
          disableAnimations={shouldDisableAnimations}
          enabled={enableSpotlight}
          spotlightRadius={spotlightRadius}
          glowColor={glowColor}
        />
      )}

      {resolvedItems.map((item, index) => {
        const style: MagicBentoStyle = {
          '--magic-bento-card-color': item.color ?? 'var(--color-surface-elevated)',
          '--magic-bento-accent': item.accent ?? 'var(--color-action)',
          '--magic-bento-glow-color': normalizeGlowColor(glowColor),
        };
        const cardClassName = [
          'magic-bento-card--surface',
          textAutoHide ? 'magic-bento-card--text-autohide' : '',
          enableBorderGlow ? 'magic-bento-card--border-glow' : '',
        ].filter(Boolean).join(' ');

        return (
          <ParticleCard
            key={item.id ?? `${item.label}-${item.title}-${index}`}
            className={cardClassName}
            style={style}
            disableAnimations={shouldDisableAnimations}
            enableStars={enableStars}
            particleCount={particleCount}
            glowColor={glowColor}
            enableTilt={enableTilt}
            clickEffect={clickEffect}
            enableMagnetism={enableMagnetism}
          >
            <div className="magic-bento-card__header">
              <span className="magic-bento-card__label">{item.label}</span>
              {item.badge && <span className="magic-bento-card__badge">{item.badge}</span>}
            </div>
            <div className="magic-bento-card__content">
              {item.value !== undefined && (
                <div className="magic-bento-card__value-group">
                  <span className="magic-bento-card__value">{item.value}</span>
                  {item.valueSuffix && <span className="magic-bento-card__value-suffix">{item.valueSuffix}</span>}
                </div>
              )}
              <h3 className="magic-bento-card__title">{item.title}</h3>
              <p className="magic-bento-card__description">{item.description}</p>
            </div>
          </ParticleCard>
        );
      })}
    </div>
  );
}
