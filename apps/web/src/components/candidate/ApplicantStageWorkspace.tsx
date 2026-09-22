import { getPermissionLabel } from '@recruitflow/contracts';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type {
  Application,
  ApplicationWorkspaceResponse,
  ApplicationWorkspaceStage,
  ComplianceStatus,
  HiringCase,
  Interview,
  Offer,
  OfferComponentItem,
  ScreeningLog,
  ScreeningOutcome,
} from '@recruitflow/contracts';
import { getApi, patchApi, postApi } from '../../api/client';
import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { PageState } from '../ui/PageState';
import { Icon } from '../Icon';
import { FastScorecardModal } from '../interview/FastScorecardModal';
import { SkillTagsOverflow } from './SkillTagsOverflow';
import { inferPriorityFromTitle } from './skillTags';

export type ApplicantWorkspaceStage = 'Applied' | 'Screening' | 'Interview' | 'Offer' | 'Pre-Hire' | 'Joined';

interface ApplicantStageWorkspaceProps {
  application: Application;
  workspace: ApplicationWorkspaceResponse | null;
  selectedStage: string;
  onStageChange: (stage: string) => void;
  onAdvanceStage: () => void;
  onReject: () => void;
  onAddNote: () => void;
  onViewResume: () => void;
  onActivity: (kind: 'Call' | 'Email' | 'Offer Follow-up') => void;
  onScheduleInterview: () => void;
  interviews: Interview[];
  onRefresh: () => Promise<void>;
  screeningLogs: ScreeningLog[];
  screeningOutcome: ScreeningOutcome;
  setScreeningOutcome: (value: ScreeningOutcome) => void;
  screeningNotes: string;
  setScreeningNotes: (value: string) => void;
  noticePeriodDays: string;
  setNoticePeriodDays: (value: string) => void;
  expectedSalary: string;
  setExpectedSalary: (value: string) => void;
  currentSalary: string;
  setCurrentSalary: (value: string) => void;
  salaryCurrency: string;
  setSalaryCurrency: (value: string) => void;
  canEdit: boolean;
  canMoveStage: boolean;
  canViewInterviews: boolean;
  canViewSalary: boolean;
  canApproveOffers: boolean;
  canApproveHiring: boolean;
  isScreeningDirty: boolean;
  onSaveScreening: () => Promise<void>;
  isSavingScreening: boolean;
  screeningError?: string | null;
}

const STANDARD_STAGE_NAMES = new Set(['Applied', 'Screening', 'Interview', 'Offer', 'Pre-Hire', 'Joined']);

type OfferDraft = {
  contractType: string;
  probationPeriod: string;
  offerExpiry: string;
  proposedJoiningDate: string;
  workLocation: string;
  workingSchedule: string;
  amount: string;
  currency: string;
};

const emptyOfferDraft = (location: string): OfferDraft => ({
  contractType: 'Permanent',
  probationPeriod: '6 Months',
  offerExpiry: '',
  proposedJoiningDate: '',
  workLocation: location,
  workingSchedule: 'Full-time (Standard)',
  amount: '',
  currency: 'AED',
});

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to complete this workspace action.';
}

function toDateInput(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function formatDate(value?: string | null): string {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB');
}

function RequirementList({
  requirements,
  onAction,
}: {
  requirements: ApplicationWorkspaceResponse['nextStageRequirements'];
  onAction: (tab: string) => void;
}) {
  if (requirements.length === 0) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs dark:border-amber-900 dark:bg-amber-950/30" role="status">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="text-amber-900 dark:text-amber-200">Requirements for the next stage</strong>
        <span className="text-[11px] text-amber-700 dark:text-amber-300">
          {requirements.some((item) => item.blocking) ? 'Complete required items before advancing' : `${requirements.filter((item) => item.complete).length}/${requirements.length} complete`}
        </span>
      </div>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {requirements.map((requirement) => (
          <li
            key={requirement.id}
            className={`flex items-start justify-between gap-2 rounded-lg border px-2.5 py-2 ${
              requirement.complete
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'
                : requirement.blocking
                  ? 'border-amber-200 bg-white text-amber-900 dark:border-amber-900 dark:bg-slate-900 dark:text-amber-200'
                  : 'border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
            }`}
          >
            <span>
              <span aria-hidden="true" className="mr-1.5 font-bold">{requirement.complete ? '✓' : '○'}</span>
              {requirement.label}
              {!requirement.complete && requirement.reason && (
                <span className="mt-0.5 block text-[10px] opacity-80">{requirement.reason}</span>
              )}
            </span>
            {!requirement.complete && requirement.actionTab && (
              <button
                type="button"
                className="shrink-0 font-bold underline underline-offset-2"
                onClick={() => onAction(requirement.actionTab ?? 'Applied')}
              >
                {requirement.actionLabel ?? 'Open'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
