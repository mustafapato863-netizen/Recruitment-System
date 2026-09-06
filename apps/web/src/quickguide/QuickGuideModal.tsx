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
    startTour,
    startGameTour,
  } = useQuickGuide();

  const beginTour = startTour ?? startGameTour;

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

  const isCritical = currentGuide.hardPartCaution.severity === 'critical';

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-guide-title"
    >
      <div
        ref={modalRef}
        className="relative flex flex-col w-full max-w-2xl max-h-[92vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/70 rounded-2xl shadow-[0_24px_80px_-12px_rgba(15,23,42,0.4)] ring-1 ring-slate-950/5 dark:ring-white/10 overflow-hidden animate-scale-in"
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-b from-blue-50/70 via-white to-white dark:from-slate-800/70 dark:via-slate-900 dark:to-slate-900">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-emerald-600 shadow-md shadow-blue-600/25 ring-1 ring-white/20 shrink-0 flex items-center justify-center text-white">
                <SghHeartSvg size={24} glow={false} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">
                    Saudi German Health ATS • Page Guide
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                    {currentGuide.category}
                  </span>
                  {!hasSeenCurrentPage && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25 animate-pulse">
                      First-Time Guide
                    </span>
                  )}
                </div>
                <h2
                  id="quick-guide-title"
                  className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1.5 text-balance"
                >
                  {currentGuide.title}
                </h2>
                <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {currentGuide.oneLiner}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={beginTour}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-600/25 transition cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
                title="Start guided spotlight tour"
              >
                <Icon name="pipeline" size={13} />
                <span>Take a tour</span>
              </button>

              <button
                type="button"
                onClick={handleDismiss}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-label="Close Quick Guide"
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 mt-5 border-b border-slate-200 dark:border-slate-800 -mb-5 sm:-mb-6 overflow-x-auto rf-scrollbar" role="tablist" aria-label="Guide sections">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 -mb-px transition cursor-pointer whitespace-nowrap rounded-t-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                activeTab === 'overview'
                  ? 'border-blue-600 text-blue-700 bg-blue-50/70 dark:text-blue-300 dark:bg-blue-500/10 dark:border-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60'
              }`}
            >
              <Icon name="info" size={13} />
              <span>Overview</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'steps'}
              onClick={() => setActiveTab('steps')}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 -mb-px transition cursor-pointer whitespace-nowrap rounded-t-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                activeTab === 'steps'
                  ? 'border-blue-600 text-blue-700 bg-blue-50/70 dark:text-blue-300 dark:bg-blue-500/10 dark:border-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60'
              }`}
            >
              <Icon name="pipeline" size={13} />
              <span>3-Step Workflow</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'rules'}
              onClick={() => setActiveTab('rules')}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 -mb-px transition cursor-pointer whitespace-nowrap rounded-t-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                activeTab === 'rules'
                  ? 'border-amber-500 text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60'
              }`}
            >
              <Icon name="alert-triangle" size={13} />
              <span>Golden Rules</span>
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inline-flex w-full h-full rounded-full bg-amber-500 opacity-60 animate-ping" />
                <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-amber-500" />
              </span>
            </button>

            {currentGuide.keyTerms && currentGuide.keyTerms.length > 0 && (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'terms'}
                onClick={() => setActiveTab('terms')}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 -mb-px transition cursor-pointer whitespace-nowrap rounded-t-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  activeTab === 'terms'
                    ? 'border-blue-600 text-blue-700 bg-blue-50/70 dark:text-blue-300 dark:bg-blue-500/10 dark:border-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60'
                }`}
              >
                <Icon name="document" size={13} />
                <span>Glossary</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 p-5 sm:p-6 overflow-y-auto rf-scrollbar space-y-4 text-xs bg-white dark:bg-slate-900">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4 animate-fade-in">
              {/* Guided spotlight tour banner — high-contrast brand gradient */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 dark:from-blue-600 dark:via-blue-700 dark:to-indigo-700 border border-white/10 shadow-lg shadow-blue-900/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0 text-white backdrop-blur-sm">
                    <Icon name="pipeline" size={17} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-100">
                      Guided tour
                    </span>
                    <h4 className="text-sm font-bold text-white mt-1">
                      Walk through this page step by step
                    </h4>
                    <p className="text-xs text-blue-100/90 mt-1 leading-relaxed">
                      We highlight each section in place, with short explanations. Use Next / Back or arrow keys.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={beginTour}
                  className="px-4 py-2.5 rounded-xl bg-white hover:bg-blue-50 active:bg-blue-100 text-blue-700 font-bold text-xs transition shadow-md cursor-pointer shrink-0 flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-700"
                >
                  <span>Start tour</span>
                  <Icon name="arrow-right" size={13} />
                </button>
              </div>

              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 dark:bg-blue-500/[0.08] dark:border-blue-500/20">
                <h3 className="font-bold text-blue-950 flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] dark:text-blue-100">
                  <Icon name="award" size={14} className="text-blue-600 dark:text-blue-400" />
                  <span>Why this page exists</span>
                </h3>
                <p className="mt-2 text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  {currentGuide.purpose}
                </p>
              </div>

              {currentGuide.proTips && currentGuide.proTips.length > 0 && (
                <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100 dark:bg-emerald-500/[0.07] dark:border-emerald-500/20">
                  <h4 className="font-bold text-emerald-950 flex items-center gap-1.5 text-xs dark:text-emerald-100">
                    <Icon name="sparkles" size={14} className="text-emerald-600 dark:text-emerald-400" />
                    <span>Recruiter Pro-Tips</span>
                  </h4>
                  <ul className="mt-2.5 space-y-2 text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    {currentGuide.proTips.map((tip, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold mt-px">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Quick Jump to Steps */}
              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveTab('steps')}
                  className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline underline-offset-4 cursor-pointer rounded-md px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <span>See how to use this page (3 steps)</span>
                  <Icon name="arrow-right" size={12} />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: 3-STEP WORKFLOW */}
          {activeTab === 'steps' && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 dark:bg-slate-800/60 dark:border-slate-700">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-600/15 flex items-center justify-center shrink-0">
                    <Icon name="info" size={14} className="text-blue-600 dark:text-blue-400" />
                  </span>
                  <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                    Prefer a guided walkthrough on the page itself?
                  </span>
                </div>
                <button
                  type="button"
                  onClick={beginTour}
                  className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-xs transition shadow-sm shadow-blue-600/25 cursor-pointer flex items-center gap-1.5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
                >
                  <span>Start guided tour</span>
                </button>
              </div>
              {currentGuide.steps.map((step) => (
                <div
                  key={step.number}
                  className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-md hover:shadow-blue-600/5 dark:border-slate-700/70 dark:bg-slate-800/40 dark:hover:border-blue-500/40 transition flex items-start gap-3.5"
                >
                  <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm shadow-blue-600/30">
                    {step.number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-900 text-[13px] dark:text-white">
                      {step.title}
                    </h4>
                    <p className="mt-1 text-slate-600 leading-relaxed text-[12.5px] dark:text-slate-300">
                      {step.description}
                    </p>
                    {step.actionHint && (
                      <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-[11px] font-medium text-slate-700 dark:bg-slate-700/50 dark:border-slate-600/50 dark:text-slate-200">
                        <Icon name="check-circle" size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
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
                className={`p-4 sm:p-5 rounded-2xl border shadow-sm ${
                  isCritical
                    ? 'bg-rose-50/80 border-rose-200 dark:bg-rose-500/[0.08] dark:border-rose-500/25'
                    : 'bg-amber-50/80 border-amber-200 dark:bg-amber-500/[0.08] dark:border-amber-500/25'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                      isCritical
                        ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-600/25'
                        : 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/25'
                    }`}
                  >
                    <Icon name="alert-triangle" size={16} />
                  </div>
                  <div>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-[0.14em] ${
                        isCritical ? 'text-rose-700 dark:text-rose-300' : 'text-amber-700 dark:text-amber-300'
                      }`}
                    >
                      Junior recruiter caution
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                      {currentGuide.hardPartCaution.title}
                    </h4>
                  </div>
                </div>

                <p className="mt-3 text-slate-700 dark:text-slate-300 leading-relaxed font-medium text-[13px]">
                  {currentGuide.hardPartCaution.description}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[13px] leading-relaxed dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-300">
                <strong className="block text-slate-900 mb-1.5 font-bold text-xs dark:text-white">
                  Why this rule matters at Saudi German Health
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
                  className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-200 hover:shadow-sm transition dark:border-slate-700/70 dark:bg-slate-800/40 dark:hover:border-blue-500/30 space-y-2"
                >
                  <span className="inline-block font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-1 rounded-md dark:text-blue-300 dark:bg-blue-500/10 dark:border-blue-500/20">
                    {item.term}
                  </span>
                  <p className="text-slate-600 text-[12.5px] leading-relaxed dark:text-slate-300">
                    {item.definition}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:px-6 sm:py-4 border-t border-slate-200 bg-slate-50/90 backdrop-blur dark:border-slate-800 dark:bg-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none dark:text-slate-400">
              <input
                type="checkbox"
                checked={autoOpenEnabled}
                onChange={(e) => toggleAutoOpen(e.target.checked)}
                className="h-3.5 w-3.5 rounded accent-blue-600 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
              <span>Auto-show on new pages</span>
            </label>

            <button
              type="button"
              onClick={resetAllGuides}
              className="text-[11px] font-medium text-slate-400 hover:text-slate-700 underline underline-offset-2 cursor-pointer dark:hover:text-slate-200 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              title="Reset all guide flags so you can learn every page again"
            >
              Reset all
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={beginTour}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-600/25 transition cursor-pointer flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
            >
              <Icon name="pipeline" size={13} />
              <span>Start guided tour</span>
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-slate-200/70 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-semibold text-xs transition cursor-pointer flex items-center justify-center dark:bg-slate-700 dark:hover:bg-slate-600 dark:active:bg-slate-500 dark:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              <span>{hasSeenCurrentPage ? 'Close' : 'Got it'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
