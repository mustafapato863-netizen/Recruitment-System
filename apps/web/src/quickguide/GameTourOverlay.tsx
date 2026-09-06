import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useQuickGuide } from './QuickGuideContext';
import { Icon } from '../components/Icon';

interface RectState {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Clean autofocus spotlight tour — famous-apps style (Notion / Slack / Userpilot).
 * No game, no XP, no sounds, no victory splash.
 * Keeps the legacy `GameTourOverlay` export name for backward compat.
 */
export function GameTourOverlay() {
  const {
    isTourActive,
    isGameTourActive,
    currentGuide,
    tourStepIndex,
    gameStepIndex,
    totalTourSteps,
    totalGameSteps,
    nextTourStep,
    nextGameStep,
    prevTourStep,
    prevGameStep,
    endTour,
    endGameTour,
  } = useQuickGuide();

  // Support both new + legacy context values
  const isActive = isTourActive || isGameTourActive;
  const stepIndex = typeof tourStepIndex === 'number' ? tourStepIndex : gameStepIndex;
  const totalSteps = totalTourSteps || totalGameSteps || currentGuide.steps.length;
  const goNext = nextTourStep ?? nextGameStep;
  const goPrev = prevTourStep ?? prevGameStep;
  const close = endTour ?? endGameTour;

  const [targetRect, setTargetRect] = useState<RectState | null>(null);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const cardRef = useRef<HTMLDivElement>(null);
  const nextBtnRef = useRef<HTMLButtonElement>(null);

  const currentStep = currentGuide.steps[stepIndex];

  // Update target element positioning (autofocus: scroll into view + measure)
  const updateTargetPosition = useCallback(() => {
    if (!isActive || !currentStep) {
      setTargetRect(null);
      return;
    }

    let el: HTMLElement | null = null;
    if (currentStep.targetSelector) {
      try {
        el = document.querySelector(currentStep.targetSelector);
      } catch {
        el = null;
      }
    }

    // Fallback search by data attribute or common landmarks
    if (!el && currentStep.number === 1) {
      el =
        (document.querySelector('[data-tour="candidate-card"]') as HTMLElement | null) ||
        (document.querySelector('[data-tour="action-items"]') as HTMLElement | null) ||
        (document.querySelector('[data-tour="vacancies-toolbar"]') as HTMLElement | null) ||
        (document.querySelector('[data-tour="compliance-checklist"]') as HTMLElement | null) ||
        (document.querySelector('.rf-page-hero') as HTMLElement | null) ||
        (document.querySelector('h1') as HTMLElement | null);
    }

    if (el) {
      if (typeof el.scrollIntoView === 'function') {
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        } catch {
          // ignore scroll errors (jsdom / old browsers)
        }
      }
      const rect = el.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    } else {
      setTargetRect(null);
    }
  }, [isActive, currentStep]);

  useEffect(() => {
    if (!isActive) return;

    updateTargetPosition();
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
      updateTargetPosition();
    };

    const handleScroll = () => {
      if (currentStep?.targetSelector) {
        try {
          const el = document.querySelector(currentStep.targetSelector);
          if (el) {
            const rect = el.getBoundingClientRect();
            setTargetRect({
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            });
          }
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, { passive: true });

    const timer = setTimeout(updateTargetPosition, 350);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(timer);
    };
  }, [isActive, stepIndex, updateTargetPosition, currentStep]);

  // Autofocus the primary action for keyboard users on step change
  useEffect(() => {
    if (!isActive) return;
    const t = setTimeout(() => {
      nextBtnRef.current?.focus({ preventScroll: true });
    }, 60);
    return () => clearTimeout(t);
  }, [isActive, stepIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        // Avoid hijacking Enter inside form fields inside the spotlight target
        const t = e.target as HTMLElement | null;
        if (e.key === 'Enter' && t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) {
          return;
        }
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, goNext, goPrev, close]);

  if (!isActive || !currentStep) return null;

  const isLast = stepIndex === totalSteps - 1;

  // Calculate card position relative to spotlight target
  const getCardStyle = (): React.CSSProperties => {
    if (!targetRect) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10001,
        maxWidth: '360px',
        width: 'calc(100vw - 32px)',
      };
    }

    const cardWidth = Math.min(360, windowSize.width - 32);
    const padding = 16;
    const spaceBelow = windowSize.height - (targetRect.top + targetRect.height);
    const spaceAbove = targetRect.top;

    let top: number;
    if (spaceBelow >= 240 || spaceBelow >= spaceAbove) {
      top = Math.min(windowSize.height - 260, targetRect.top + targetRect.height + padding);
    } else {
      top = Math.max(padding, targetRect.top - 250 - padding);
    }

    let left = targetRect.left + targetRect.width / 2 - cardWidth / 2;
    left = Math.max(padding, Math.min(windowSize.width - cardWidth - padding, left));

    return {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${cardWidth}px`,
      zIndex: 10001,
    };
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] font-sans" aria-label="Page tour">
      {/* ── Dim backdrop with clean spotlight cutout ── */}
      {targetRect ? (
        <div
          className="fixed pointer-events-none transition-all duration-200 ease-out"
          style={{
            top: `${Math.max(0, targetRect.top - 8)}px`,
            left: `${Math.max(0, targetRect.left - 8)}px`,
            width: `${targetRect.width + 16}px`,
            height: `${targetRect.height + 16}px`,
            borderRadius: '12px',
            boxShadow:
              '0 0 0 9999px rgba(15, 23, 42, 0.55), 0 0 0 2px #ffffff, 0 0 0 5px rgba(37, 99, 235, 0.45), 0 12px 32px rgba(0, 0, 0, 0.25)',
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-slate-950/55" />
      )}

      {/* ── Clean tooltip card (famous-apps style) ── */}
      <div
        ref={cardRef}
        style={getCardStyle()}
        role="dialog"
        aria-modal="true"
        aria-label={`Step ${stepIndex + 1} of ${totalSteps}: ${currentStep.title}`}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl shadow-2xl p-4 space-y-3 outline-none"
        tabIndex={-1}
      >
        {/* Header: step counter + close */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Step {stepIndex + 1} of {totalSteps}
          </span>
          <button
            type="button"
            onClick={close}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="End tour (Esc)"
            aria-label="End tour"
          >
            <Icon name="close" size={14} />
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === stepIndex
                  ? 'w-5 bg-blue-600'
                  : i < stepIndex
                    ? 'w-1.5 bg-blue-300'
                    : 'w-1.5 bg-slate-200 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Body */}
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white m-0 leading-snug">
            {currentStep.title}
          </h3>
          <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed m-0">
            {currentStep.description}
          </p>
          {currentStep.actionHint && (
            <div className="flex items-start gap-2 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700 px-2.5 py-2 text-[12px] text-slate-600 dark:text-slate-300">
              <Icon name="info" size={13} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <span className="leading-snug">{currentStep.actionHint}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={goPrev}
            disabled={stepIndex === 0}
            className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
          >
            Back
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={close}
              className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
            >
              Skip tour
            </button>
            <button
              ref={nextBtnRef}
              type="button"
              onClick={goNext}
              className="px-4 py-1.5 rounded-lg text-[13px] font-semibold bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm cursor-pointer"
            >
              {isLast ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Preferred clean-tour name — same component, famous-apps style. */
export const GuidedTourOverlay = GameTourOverlay;
