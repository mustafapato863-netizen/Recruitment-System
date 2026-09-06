import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuickGuide } from './QuickGuideContext';
import { Icon } from '../components/Icon';
import { SghHeartSvg } from '../design-system/brand/sgh-heart-svg';

export const QuickGuideModal: React.FC = () => {
  const {
    isOpen,
    currentGuide,
    activeTab,
    hasSeenCurrentPage,
    autoOpenEnabled,
    closeGuide,
    setActiveTab,
    markCurrentPageSeen,
    toggleAutoOpen,
    resetAllGuides,
    startGameTour,
    isQuestCompleted,
  } = useQuickGuide();

  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        markCurrentPageSeen();
        closeGuide();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeGuide, markCurrentPageSeen]);

  // Prevent background scrolling when open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDismiss = () => {
    markCurrentPageSeen();
    closeGuide();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/60 backdrop-blur-xs animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-guide-title"
    >
      <div
        ref={modalRef}
        className="relative flex flex-col w-full max-w-2xl max-h-[92vh] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200/80 dark:border-slate-800 bg-gradient-to-r from-slate-50 via-white to-blue-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/60">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-emerald-600 p-0.5 shadow-sm shrink-0 flex items-center justify-center text-white">
                <SghHeartSvg size={24} glow={false} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
                    Saudi German Health ATS • Quick Learn
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {currentGuide.category}
                  </span>
                  {!hasSeenCurrentPage && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 animate-pulse">
                      First-Time Guide
                    </span>
                  )}
                </div>
                <h2
                  id="quick-guide-title"
                  className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight mt-1"
                >
                  {currentGuide.title}
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                  {currentGuide.oneLiner}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={startGameTour}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black text-xs shadow-md shadow-emerald-500/20 transition cursor-pointer active:scale-95"
                title="Launch autofocus spotlight game tour"
              >
                <span>🎮 Play Quest</span>
                <span className="px-1.5 py-0.5 rounded bg-black/15 text-[10px] font-mono font-bold">
                  +{currentGuide.totalQuestXp || currentGuide.steps.length * 50} XP
                </span>
              </button>

              <button
                type="button"
                onClick={handleDismiss}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                aria-label="Close Quick Guide"
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 mt-5 border-b border-slate-200 dark:border-slate-800 -mb-5 sm:-mb-6 overflow-x-auto rf-scrollbar pb-1">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
              }`}
            >
              <Icon name="info" size={13} />
              <span>Overview</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('steps')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'steps'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
              }`}
            >
              <Icon name="pipeline" size={13} />
              <span>3-Step Workflow</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('rules')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'rules'
                  ? 'border-amber-600 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
              }`}
            >
              <Icon name="alert-triangle" size={13} />
              <span>Golden Rules</span>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
            </button>

            {currentGuide.keyTerms && currentGuide.keyTerms.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('terms')}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'terms'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
                }`}
              >
                <Icon name="document" size={13} />
                <span>Glossary</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 p-5 sm:p-6 overflow-y-auto rf-scrollbar space-y-4 text-xs">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4 animate-fade-in">
              {/* Game Quest Spotlight Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 border border-cyan-500/40 shadow-lg text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-xl shrink-0">
                    🎮
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400">
                        Interactive Game Tour
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Autofocus Spotlight
                      </span>
                      {isQuestCompleted && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Quest Completed 🏆
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-white mt-0.5">
                      {currentGuide.questRoleTitle || `${currentGuide.title} Quest`}
                    </h4>
                    <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                      Guided walkthrough with live autofocus spotlights, retro game audio chimes, and instant XP rewards!
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={startGameTour}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-black text-xs transition shadow-md shadow-cyan-500/20 cursor-pointer shrink-0 flex items-center justify-center gap-1.5"
                >
                  <span>Start Quest</span>
                  <span className="px-1.5 py-0.5 rounded bg-black/15 font-mono text-[10px]">
                    +{currentGuide.totalQuestXp || currentGuide.steps.length * 50} XP
                  </span>
                </button>
              </div>

              <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-xs uppercase tracking-wider">
                  <Icon name="award" size={14} className="text-blue-600" />
                  <span>Why This Page Exists</span>
                </h3>
                <p className="mt-1.5 text-slate-600 dark:text-slate-300 leading-relaxed">
                  {currentGuide.purpose}
                </p>
              </div>

              {currentGuide.proTips && currentGuide.proTips.length > 0 && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                    <Icon name="sparkles" size={14} className="text-emerald-500" />
                    <span>Recruiter Pro-Tips</span>
                  </h4>
                  <ul className="mt-2 space-y-2 text-slate-600 dark:text-slate-300">
                    {currentGuide.proTips.map((tip, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-emerald-500 font-bold">&bull;</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Quick Jump to Steps */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveTab('steps')}
                  className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  <span>See How to Use This Page (3 Steps)</span>
                  <Icon name="arrow-right" size={12} />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: 3-STEP WORKFLOW */}
          {activeTab === 'steps' && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🎯</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Want an interactive on-screen walkthrough?
                  </span>
                </div>
                <button
                  type="button"
                  onClick={startGameTour}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black text-xs transition shadow-xs cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <span>🎮 Autofocus Tour</span>
                </button>
              </div>
              {currentGuide.steps.map((step) => (
                <div
                  key={step.number}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500/40 transition shadow-2xs flex items-start gap-3.5"
                >
                  <div className="w-6 h-6 rounded-lg bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                    {step.number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                      {step.title}
                    </h4>
                    <p className="mt-1 text-slate-600 dark:text-slate-300 leading-relaxed text-[11.5px]">
                      {step.description}
                    </p>
                    {step.actionHint && (
                      <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[10.5px] font-semibold text-slate-700 dark:text-slate-300">
                        <Icon name="check-circle" size={11} className="text-emerald-500" />
                        <span>Action: {step.actionHint}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: GOLDEN RULES (THE HARD PARTS) */}
          {activeTab === 'rules' && (
            <div className="space-y-4 animate-fade-in">
              <div
                className={`p-4 sm:p-5 rounded-2xl border ${
                  currentGuide.hardPartCaution.severity === 'critical'
                    ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900/60'
                    : 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900/60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      currentGuide.hardPartCaution.severity === 'critical'
                        ? 'bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-200'
                        : 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-200'
                    }`}
                  >
                    <Icon name="alert-triangle" size={15} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-400">
                      Junior Recruiter Caution Note
                    </span>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">
                      {currentGuide.hardPartCaution.title}
                    </h4>
                  </div>
                </div>

                <p className="mt-3 text-slate-700 dark:text-slate-300 leading-relaxed font-medium text-xs">
                  {currentGuide.hardPartCaution.description}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs">
                <strong className="block text-slate-900 dark:text-white mb-1 font-bold">
                  Why this rule matters at Saudi German Health:
                </strong>
                Healthcare hiring involves regulatory authorities (Saudi Commission for Health Specialties, Ministry of Health, DataFlow), complex labor laws, and patient safety. Following these guidelines ensures smooth credentialing and protects hospital accreditation.
              </div>
            </div>
          )}

          {/* TAB 4: KEY TERMS GLOSSARY */}
          {activeTab === 'terms' && currentGuide.keyTerms && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fade-in">
              {currentGuide.keyTerms.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-1"
                >
                  <span className="font-mono text-xs font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md">
                    {item.term}
                  </span>
                  <p className="text-slate-600 dark:text-slate-300 text-[11.5px] leading-relaxed pt-1">
                    {item.definition}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoOpenEnabled}
                onChange={(e) => toggleAutoOpen(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span>Auto-show on new pages</span>
            </label>

            <button
              type="button"
              onClick={resetAllGuides}
              className="text-[10px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline cursor-pointer"
              title="Reset all guide flags so you can learn every page again"
            >
              Reset all
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={startGameTour}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black text-xs shadow-md shadow-emerald-500/20 transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>🎮 Start Game Tour</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/15 font-mono font-bold">
                +{currentGuide.totalQuestXp || currentGuide.steps.length * 50} XP
              </span>
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>{hasSeenCurrentPage ? 'Close' : 'Got It'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
