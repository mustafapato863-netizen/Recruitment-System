import React from 'react';
import type { ApplicationStage } from '@recruitflow/contracts';
import { Icon, type IconName } from '../Icon';

export type NextActionKind = 'assign' | 'advance' | 'schedule' | 'offer' | 'hire' | 'view';

export interface NextActionPlan {
  kind: NextActionKind;
  label: string;
  hint: string;
  icon: IconName;
}

export function getNextActionPlan(stage?: ApplicationStage, unassigned?: boolean): NextActionPlan {
  if (unassigned && stage !== 'Rejected' && stage !== 'Withdrawn' && stage !== 'Joined') {
    return {
      kind: 'assign',
      label: 'Assign to me',
      hint: 'Take ownership before moving this candidate.',
      icon: 'user-check',
    };
  }

  switch (stage) {
    case 'Applied':
      return { kind: 'advance', label: 'Move to screening', hint: 'Review the CV, then start screening.', icon: 'arrow-right' };
    case 'Screening':
      return { kind: 'schedule', label: 'Schedule interview', hint: 'Screening is in progress. Book the next conversation.', icon: 'calendar' };
    case 'Interview':
      return { kind: 'advance', label: 'Move to offer', hint: 'Complete scorecards, then advance if the panel agrees.', icon: 'arrow-right' };
    case 'Offer':
      return { kind: 'offer', label: 'Create offer', hint: 'Candidate is ready for a formal offer.', icon: 'briefcase' };
    case 'Pre-Hire':
      return { kind: 'hire', label: 'Complete pre-hire', hint: 'Finish checks, then mark joined.', icon: 'arrow-right' };
    case 'Joined':
      return { kind: 'view', label: 'View profile', hint: 'This candidate has joined.', icon: 'user' };
    case 'Rejected':
    case 'Withdrawn':
      return { kind: 'view', label: 'View profile', hint: 'No further pipeline action.', icon: 'user' };
    default:
      return { kind: 'advance', label: 'Move stage', hint: 'Choose the next pipeline step.', icon: 'arrow-right' };
  }
}

interface NextActionGuidanceBannerProps {
  stage?: ApplicationStage;
  candidateName: string;
  unassigned?: boolean;
  assigning?: boolean;
  onAssign?: () => void;
  onAdvanceStage: () => void;
  onScheduleInterview: () => void;
  onCreateOffer: () => void;
  onReject?: () => void;
  onViewCandidate360: () => void;
}

export const NextActionGuidanceBanner: React.FC<NextActionGuidanceBannerProps> = ({
  stage = 'Applied',
  candidateName,
  unassigned = false,
  assigning = false,
  onAssign,
  onAdvanceStage,
  onScheduleInterview,
  onCreateOffer,
  onReject,
  onViewCandidate360,
}) => {
  const plan = getNextActionPlan(stage, unassigned && Boolean(onAssign));
  const handlers: Record<NextActionKind, () => void> = {
    assign: () => onAssign?.(),
    advance: onAdvanceStage,
    schedule: onScheduleInterview,
    offer: onCreateOffer,
    hire: onAdvanceStage,
    view: onViewCandidate360,
  };

  const showReject = Boolean(onReject) && stage !== 'Rejected' && stage !== 'Withdrawn' && stage !== 'Joined';

  return (
    <div
      data-tour="next-action-banner"
      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-slate-500">Next for {candidateName}</p>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{plan.hint}</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {showReject && (
          <button
            type="button"
            onClick={onReject}
            className="inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30"
          >
            Reject
          </button>
        )}
        <button
          type="button"
          onClick={handlers[plan.kind]}
          disabled={plan.kind === 'assign' && assigning}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          <Icon name={plan.icon} size={13} />
          {plan.kind === 'assign' && assigning ? 'Assigning…' : plan.label}
        </button>
      </div>
    </div>
  );
};
