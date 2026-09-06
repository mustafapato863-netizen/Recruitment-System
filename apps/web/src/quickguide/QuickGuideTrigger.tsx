import React from 'react';
import { useQuickGuide } from './QuickGuideContext';
import { Icon } from '../components/Icon';

interface QuickGuideTriggerProps {
  className?: string;
  variant?: 'pill' | 'button' | 'minimal';
}

export const QuickGuideTrigger: React.FC<QuickGuideTriggerProps> = ({
  className = '',
  variant = 'pill',
}) => {
  const { openGuide, hasSeenCurrentPage, currentGuide } = useQuickGuide();

  if (variant === 'minimal') {
    return (
      <button
        type="button"
        onClick={openGuide}
        className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition cursor-pointer ${className}`}
        title={`Page guide: ${currentGuide?.title || 'This Page'}`}
        aria-label="Open page guide"
      >
        <Icon name="info" size={14} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openGuide}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition shadow-2xs cursor-pointer select-none ${
        !hasSeenCurrentPage
          ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
          : 'bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300 dark:hover:text-white border border-slate-200 dark:border-slate-800'
      } ${className}`}
      title={`Open guide for ${currentGuide?.title || 'this page'}`}
      aria-label="Open page guide"
    >
      <Icon name="info" size={12} className="text-blue-600 dark:text-blue-400" />
      <span>Page guide</span>
      {!hasSeenCurrentPage && (
        <span className="inline-flex items-center gap-1 text-[9.5px] font-bold uppercase text-blue-600 dark:text-blue-400">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          <span>New</span>
        </span>
      )}
    </button>
  );
};
