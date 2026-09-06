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
          badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
          title: 'Preliminary CV & Identity Verification',
          description: `Verify ${candidateName}'s medical credentials, experience, and competencies. Move to Screening once initial criteria pass.`,
          actionLabel: 'Advance to Screening',
          actionIcon: 'arrow-right' as const,
          actionHandler: onAdvanceStage,
        };
      case 'Screening':
        return {
          badge: 'Screening in Progress',
          badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
          title: 'Schedule Round 1 Screening Interview',
          description: `Conduct initial culture/qualifications fit check. Coordinate an interview or advance to next evaluation.`,
          actionLabel: 'Schedule Interview',
          actionIcon: 'calendar' as const,
          actionHandler: onScheduleInterview,
        };
      case 'Interview':
        return {
          badge: 'Interview Stage',
          badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
          title: 'Panel Evaluation & Scorecard Completion',
          description: `Interviews are scheduled or in progress. Record panel scorecards and advance to offer once positive consensus is reached.`,
          actionLabel: 'Advance Stage',
          actionIcon: 'arrow-right' as const,
          actionHandler: onAdvanceStage,
        };
      case 'Offer':
        return {
          badge: 'Offer Preparation',
          badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
          title: 'Draft & Send Formal Employment Offer',
          description: `Candidate has cleared all evaluation rounds. Structure basic salary, housing, and transportation allowances.`,
          actionLabel: 'Draft Employment Offer',
          actionIcon: 'briefcase' as const,
          actionHandler: onCreateOffer,
        };
      case 'Pre-Hire':
        return {
          badge: 'Pre-Hire Credentialing',
          badgeColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
          title: 'Pre-Employment Background & Health Clearances',
          description: `Offer signed and accepted. Verifying professional references, medical fitness, and SCFHS licensing.`,
          actionLabel: 'Move to Joined',
          actionIcon: 'arrow-right' as const,
          actionHandler: onAdvanceStage,
        };
      case 'Joined':
        return {
          badge: 'Joined Organization',
          badgeColor: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300',
          title: 'Employee Active at Saudi German Health',
          description: `Candidate has successfully joined hospital operations. All recruitment milestones completed.`,
          actionLabel: 'View Candidate 360',
          actionIcon: 'user' as const,
          actionHandler: onViewCandidate360,
        };
      case 'Rejected':
        return {
          badge: 'Application Rejected',
          badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
          title: 'Disqualified from Current Opening',
          description: `Structured rejection recorded. Profile remains searchable in the Saudi German Health talent repository for future openings.`,
          actionLabel: 'View Candidate 360',
          actionIcon: 'user' as const,
          actionHandler: onViewCandidate360,
        };
      case 'Withdrawn':
        return {
          badge: 'Application Withdrawn',
          badgeColor: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
          title: 'Candidate Withdrew from Pipeline',
          description: `Candidate withdrew their application. Candidate master identity preserved for future re-engagement.`,
          actionLabel: 'View Candidate 360',
          actionIcon: 'user' as const,
          actionHandler: onViewCandidate360,
        };
      default:
        return {
          badge: 'Pipeline Active',
          badgeColor: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
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
      className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white rounded-2xl p-5 shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in"
    >
      <div className="space-y-1.5 max-w-2xl">
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-black tracking-wide uppercase ${guidance.badgeColor}`}>
            {guidance.badge}
          </span>
          <span className="text-slate-300 text-xs font-semibold">&bull; Intelligent Next Action</span>
        </div>
        <h3 className="text-base font-extrabold !text-white text-white tracking-tight">
          {guidance.title}
        </h3>
        <p className="text-xs text-slate-200 leading-relaxed">
          {guidance.description}
        </p>
      </div>

      <div className="flex items-center gap-2.5 shrink-0 self-start md:self-auto">
        <button
          type="button"
          onClick={guidance.actionHandler}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-400 text-white rounded-xl text-xs font-black transition shadow-sm cursor-pointer"
        >
          <span>{guidance.actionLabel}</span>
          <Icon name={guidance.actionIcon} size={13} />
        </button>
        <button
          type="button"
          onClick={onViewCandidate360}
          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/15 rounded-xl text-xs font-bold transition cursor-pointer"
          title="Open Complete 360 Profile"
        >
          <Icon name="user" size={13} />
          <span>Candidate 360°</span>
        </button>
      </div>
    </div>
  );
};
