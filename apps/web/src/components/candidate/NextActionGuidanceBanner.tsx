import React from 'react';
import type { ApplicationStage } from '@recruitflow/contracts';
import { Icon } from '../Icon';

interface NextActionGuidanceBannerProps {
  stage?: ApplicationStage;
  candidateName: string;
  onAdvanceStage: () => void;
  onScheduleInterview: () => void;
  onCreateOffer: () => void;
  onViewCandidate360: () => void;
}

export const NextActionGuidanceBanner: React.FC<NextActionGuidanceBannerProps> = ({
  stage = 'Applied',
  candidateName,
  onAdvanceStage,
  onScheduleInterview,
  onCreateOffer,
  onViewCandidate360,
}) => {
  const getStageGuidance = () => {
    switch (stage) {
      case 'Applied':
        return {
          badge: 'New Application',
          badgeColor: 'bg-sky-50 text-[#0084ce] border-sky-200/80 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
          title: 'Preliminary CV & Identity Verification',
          description: `Verify ${candidateName}'s medical credentials, experience, and competencies. Move to Screening once initial criteria pass.`,
          actionLabel: 'Advance to Screening',
          actionIcon: 'arrow-right' as const,
          actionHandler: onAdvanceStage,
        };
      case 'Screening':
        return {
          badge: 'Screening in Progress',
          badgeColor: 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
          title: 'Schedule Round 1 Screening Interview',
          description: `Conduct initial culture/qualifications fit check. Coordinate an interview or advance to next evaluation.`,
          actionLabel: 'Schedule Interview',
          actionIcon: 'calendar' as const,
          actionHandler: onScheduleInterview,
        };
      case 'Interview':
        return {
          badge: 'Interview Stage',
          badgeColor: 'bg-purple-50 text-purple-700 border-purple-200/80 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
          title: 'Panel Evaluation & Scorecard Completion',
          description: `Interviews are scheduled or in progress. Record panel scorecards and advance to offer once positive consensus is reached.`,
          actionLabel: 'Advance Stage',
          actionIcon: 'arrow-right' as const,
          actionHandler: onAdvanceStage,
        };
      case 'Offer':
        return {
          badge: 'Offer Preparation',
          badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
          title: 'Draft & Send Formal Employment Offer',
          description: `Candidate has cleared all evaluation rounds. Structure basic salary, housing, and transportation allowances.`,
          actionLabel: 'Draft Employment Offer',
          actionIcon: 'briefcase' as const,
          actionHandler: onCreateOffer,
        };
      case 'Pre-Hire':
        return {
          badge: 'Pre-Hire Credentialing',
          badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200/80 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
          title: 'Pre-Employment Background & Health Clearances',
          description: `Offer signed and accepted. Verifying professional references, medical fitness, and SCFHS licensing.`,
          actionLabel: 'Move to Joined',
          actionIcon: 'arrow-right' as const,
          actionHandler: onAdvanceStage,
        };
      case 'Joined':
        return {
          badge: 'Joined Organization',
          badgeColor: 'bg-teal-50 text-teal-700 border-teal-200/80 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800',
          title: 'Employee Active at Saudi German Health',
          description: `Candidate has successfully joined hospital operations. All recruitment milestones completed.`,
          actionLabel: 'View Candidate 360',
          actionIcon: 'user' as const,
          actionHandler: onViewCandidate360,
        };
      case 'Rejected':
        return {
          badge: 'Application Rejected',
          badgeColor: 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
          title: 'Disqualified from Current Opening',
          description: `Structured rejection recorded. Profile remains searchable in the Saudi German Health talent repository for future openings.`,
          actionLabel: 'View Candidate 360',
          actionIcon: 'user' as const,
          actionHandler: onViewCandidate360,
        };
      case 'Withdrawn':
        return {
          badge: 'Application Withdrawn',
          badgeColor: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
          title: 'Candidate Withdrew from Pipeline',
          description: `Candidate withdrew their application. Candidate master identity preserved for future re-engagement.`,
          actionLabel: 'View Candidate 360',
          actionIcon: 'user' as const,
          actionHandler: onViewCandidate360,
        };
      default:
        return {
          badge: 'Pipeline Active',
          badgeColor: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
          title: 'Next Pipeline Step',
          description: `Review candidate progression through active requisition stages.`,
          actionLabel: 'Move Stage',
          actionIcon: 'arrow-right' as const,
          actionHandler: onAdvanceStage,
        };
    }
  };

  const guidance = getStageGuidance();

  return (
    <div
      data-tour="next-action-banner"
      className="relative overflow-hidden bg-gradient-to-br from-sky-50/95 via-white to-emerald-50/90 dark:from-slate-900/95 dark:via-[#0c182a]/95 dark:to-slate-900/95 rounded-2xl p-5 shadow-xs border border-sky-200/80 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-[#0084ce] before:via-[#00a3e0] before:to-[#00a859]"
    >
      <div className="space-y-1.5 max-w-2xl">
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-black tracking-wide uppercase border ${guidance.badgeColor}`}>
            {guidance.badge}
          </span>
          <span className="text-slate-400 dark:text-slate-400 text-xs font-semibold">&bull; Intelligent Next Action</span>
        </div>
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
          {guidance.title}
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          {guidance.description}
        </p>
      </div>

      <div className="flex items-center gap-2.5 shrink-0 self-start md:self-auto">
        <button
          type="button"
          onClick={guidance.actionHandler}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#0084ce] via-[#00a3e0] to-[#00a859] hover:brightness-105 text-white rounded-xl text-xs font-black transition shadow-md shadow-sky-500/25 cursor-pointer active:scale-98"
        >
          <span>{guidance.actionLabel}</span>
          <Icon name={guidance.actionIcon} size={13} />
        </button>
        <button
          type="button"
          onClick={onViewCandidate360}
          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer active:scale-98"
          title="Open Complete 360 Profile"
        >
          <Icon name="user" size={13} />
          <span>Candidate 360°</span>
        </button>
      </div>
    </div>
  );
};
