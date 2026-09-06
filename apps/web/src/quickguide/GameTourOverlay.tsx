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

export function GameTourOverlay() {
  const {
    isGameTourActive,
    currentGuide,
    gameStepIndex,
    totalGameSteps,
    soundEnabled,
    isQuestCompleted,
    totalEarnedXp,
    nextGameStep,
    prevGameStep,
    endGameTour,
    toggleSound,
  } = useQuickGuide();

  const [targetRect, setTargetRect] = useState<RectState | null>(null);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const cardRef = useRef<HTMLDivElement>(null);

  const currentStep = currentGuide.steps[gameStepIndex];

  // Update target element positioning
  const updateTargetPosition = useCallback(() => {
    if (!isGameTourActive || !currentStep) {
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
      el = document.querySelector('[data-tour="candidate-card"]') ||
           document.querySelector('[data-tour="action-items"]') ||
           document.querySelector('[data-tour="vacancies-toolbar"]') ||
           document.querySelector('[data-tour="compliance-checklist"]') ||
           document.querySelector('.rf-page-hero') ||
           document.querySelector('h1');
    }

    if (el) {
      // Smoothly scroll target into view if supported by environment
      if (typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
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
  }, [isGameTourActive, currentStep]);

  useEffect(() => {
    if (!isGameTourActive) return;

    updateTargetPosition();
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
      updateTargetPosition();
    };

    const handleScroll = () => {
      // Re-measure without re-scrolling
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

    // Re-check after 350ms to allow layout animations to settle
    const timer = setTimeout(updateTargetPosition, 350);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(timer);
    };
  }, [isGameTourActive, gameStepIndex, updateTargetPosition, currentStep]);

  // Keyboard navigation for game steps
  useEffect(() => {
    if (!isGameTourActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        endGameTour();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        nextGameStep();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevGameStep();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGameTourActive, nextGameStep, prevGameStep, endGameTour]);

  if (!isGameTourActive) return null;

  // Calculate card position relative to spotlight target
  const getCardStyle = (): React.CSSProperties => {
    if (!targetRect) {
      // Center HUD if no element found
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10001,
        maxWidth: '480px',
        width: '90vw',
      };
    }

    const cardWidth = Math.min(480, windowSize.width - 32);
    const padding = 16;
    const spaceBelow = windowSize.height - (targetRect.top + targetRect.height);
    const spaceAbove = targetRect.top;

    let top = 0;
    // Prefer placing below target if space is sufficient
    if (spaceBelow >= 260 || spaceBelow >= spaceAbove) {
      top = Math.min(windowSize.height - 300, targetRect.top + targetRect.height + padding);
    } else {
      top = Math.max(padding, targetRect.top - 280 - padding);
    }

    // Center horizontally relative to target, bounded by viewport
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

  const progressPercent = Math.round(((gameStepIndex + 1) / totalGameSteps) * 100);

  return createPortal(
    <div className="fixed inset-0 z-[10000] select-none font-sans" aria-label="Interactive Game Tour">
      {/* ── Dark Backdrop with Spotlight Cutout ── */}
      {targetRect ? (
        <div
          className="fixed pointer-events-none transition-all duration-300 ease-out"
          style={{
            top: `${Math.max(0, targetRect.top - 8)}px`,
            left: `${Math.max(0, targetRect.left - 8)}px`,
            width: `${targetRect.width + 16}px`,
            height: `${targetRect.height + 16}px`,
            borderRadius: '16px',
            boxShadow: '0 0 0 9999px rgba(11, 19, 43, 0.82), 0 0 25px 4px rgba(0, 163, 224, 0.65)',
            border: '2px solid #00a3e0',
          }}
        >
          {/* Pulsing Game Spotlight Target Ring */}
          <div className="absolute -inset-1.5 rounded-2xl border-2 border-emerald-400/60 animate-pulse pointer-events-none" />
          
          {/* Gamer Target Pin Tag */}
          <div className="absolute -top-7 left-3 bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-black text-[10px] tracking-wider uppercase px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1">
            <span>🎯 MISSION TARGET</span>
          </div>
        </div>
      ) : (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm transition-opacity" />
      )}

      {/* ── Victory Modal Screen ── */}
      {isQuestCompleted ? (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-[10002] bg-slate-950/90 backdrop-blur-md animate-fade-in">
          <div className="relative max-w-md w-full bg-slate-900 border-2 border-emerald-400 rounded-3xl p-6 sm:p-8 text-center text-white shadow-[0_0_50px_rgba(0,168,89,0.35)] space-y-5">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-tr from-emerald-500 to-cyan-400 p-0.5 flex items-center justify-center shadow-lg">
              <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center text-4xl">
                🏆
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 inline-block">
                Level Up! Recruiter Certified
              </span>
              <h2 className="text-2xl font-black tracking-tight text-white m-0">
                Quest Completed!
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                You have mastered the workflow and compliance rules for <strong className="text-cyan-300">{currentGuide.title}</strong>.
              </p>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-around text-center">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total XP Earned</span>
                <span className="text-lg font-black text-amber-400">+{totalEarnedXp} XP 🌟</span>
              </div>
              <div className="h-8 w-px bg-slate-800" />
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Recruiter Rank</span>
                <span className="text-lg font-black text-cyan-400">Specialist 🎖️</span>
              </div>
            </div>

            <button
              type="button"
              onClick={endGameTour}
              className="w-full py-3 px-5 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black text-sm rounded-xl transition shadow-lg cursor-pointer transform active:scale-95"
            >
              Enter Workspace &amp; Recruit! 🚀
            </button>
          </div>
        </div>
      ) : (
        /* ── Floating Gamer Quest HUD Card ── */
        <div
          ref={cardRef}
          style={getCardStyle()}
          className="bg-slate-900/95 dark:bg-slate-900/95 border border-cyan-500/40 text-white rounded-2xl shadow-2xl p-4 sm:p-5 backdrop-blur-xl animate-fade-in space-y-4"
        >
          {/* Card Gamer Header */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs">
                {currentStep?.badgeIcon || '🎮'}
              </span>
              <div>
                <span className="block text-[10px] font-black uppercase tracking-widest text-cyan-400">
                  Quest Step {gameStepIndex + 1} of {totalGameSteps}
                </span>
                <span className="block text-xs font-bold text-white leading-none">
                  {currentGuide.title}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {currentStep?.xpReward ? `+${currentStep.xpReward} XP` : '+25 XP'} 🌟
              </span>
              <button
                type="button"
                onClick={toggleSound}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                title={soundEnabled ? 'Mute Game Chimes' : 'Enable Game Chimes'}
                aria-label={soundEnabled ? 'Mute Game Chimes' : 'Enable Game Chimes'}
              >
                <Icon name={soundEnabled ? 'bell' : 'eye-off'} size={14} />
              </button>
              <button
                type="button"
                onClick={endGameTour}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                title="Exit Game Tour (Esc)"
                aria-label="Exit Game Tour"
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          </div>

          {/* Quest Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
              <span>Recruiter Level 1</span>
              <span>{progressPercent}% Complete</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Quest Mission Objective */}
          <div className="space-y-2">
            <h3 className="text-sm font-black text-white m-0 flex items-center gap-1.5">
              <span className="text-cyan-400">⚔️ Mission:</span>
              <span>{currentStep?.questTitle || currentStep?.title}</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed m-0">
              {currentStep?.description}
            </p>

            {currentStep?.actionHint && (
              <div className="p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-500/30 flex items-start gap-2 text-cyan-200 text-xs">
                <Icon name="check-circle" size={14} className="text-cyan-400 shrink-0 mt-0.5" />
                <span className="leading-snug">{currentStep.actionHint}</span>
              </div>
            )}
          </div>

          {/* Hard Part Warning if on first step or critical */}
          {gameStepIndex === 0 && currentGuide.hardPartCaution && (
            <div className="p-2.5 rounded-xl bg-rose-950/30 border border-rose-500/30 flex items-start gap-2 text-rose-200 text-[11px]">
              <Icon name="alert-triangle" size={14} className="text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-snug">
                <strong className="text-rose-300 block mb-0.5">{currentGuide.hardPartCaution.title}</strong>
                <span>{currentGuide.hardPartCaution.description}</span>
              </div>
            </div>
          )}

          {/* Bottom Game Controls */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={prevGameStep}
              disabled={gameStepIndex === 0}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer flex items-center gap-1"
            >
              <Icon name="arrow-left" size={12} />
              <span>Previous</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={endGameTour}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
              >
                Skip Quest
              </button>

              <button
                type="button"
                onClick={nextGameStep}
                className="px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 transition shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <span>{gameStepIndex === totalGameSteps - 1 ? 'Complete Quest! 🏆' : 'Next Step →'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
