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

export function ApplicantStageWorkspace({
  application,
  workspace,
  selectedStage,
  onStageChange,
  onAdvanceStage,
  onReject,
  onAddNote,
  onViewResume,
  onActivity,
  onScheduleInterview,
  interviews,
  onRefresh,
  screeningLogs,
  screeningOutcome,
  setScreeningOutcome,
  screeningNotes,
  setScreeningNotes,
  noticePeriodDays,
  setNoticePeriodDays,
  expectedSalary,
  setExpectedSalary,
  currentSalary,
  setCurrentSalary,
  salaryCurrency,
  setSalaryCurrency,
  canEdit,
  canMoveStage,
  canViewInterviews,
  canViewSalary,
  canApproveOffers,
  canApproveHiring,
  isScreeningDirty,
  onSaveScreening,
  isSavingScreening,
  screeningError,
}: ApplicantStageWorkspaceProps) {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [hiringCase, setHiringCase] = useState<HiringCase | null>(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [scorecardInterview, setScorecardInterview] = useState<Interview | null>(null);
  const [offerDraft, setOfferDraft] = useState<OfferDraft>(() => emptyOfferDraft(application.vacancyLocation || application.vacancyBranchName || ''));
  const offerDraftSourceRef = useRef<string | null>(null);

  const stageItems: ApplicationWorkspaceStage[] = workspace?.stages?.length
    ? workspace.stages
    : [{
      id: `application-stage-${application.id}`,
      name: application.stage,
      stageType: application.stage,
      sortOrder: 0,
      required: false,
      isCurrent: true,
      isCompleted: false,
      isNext: false,
      isAvailable: true,
      requirements: [],
    }];
  const effectiveStage = stageItems.some((item) => item.name === selectedStage && item.isAvailable)
    ? selectedStage
    : application.stage;
  const currentItem = stageItems.find((item) => item.name === effectiveStage);
  const nextStage = workspace?.nextStage ?? application.allowedTransitions[0] ?? null;
  const latestScreening = screeningLogs[0] ?? null;
  const candidateId = application.candidateId;
  const inheritedLocation = application.vacancyLocation || application.vacancyBranchName || 'Inherited from job position';

  const loadStageRecords = async () => {
    setRecordLoading(true);
    setRecordError(null);
    try {
      const [offerResult, hiringResult] = await Promise.allSettled([
        getApi<Offer[]>(`/offers?candidateId=${encodeURIComponent(candidateId)}`),
        getApi<HiringCase[]>('/hiring'),
      ]);
      let offerLoadError: unknown = null;
      let hiringLoadError: unknown = null;

      if (offerResult.status === 'fulfilled') {
        const matchingOffers = Array.isArray(offerResult.value)
          ? offerResult.value.filter((item) => item.applicationId === application.id)
          : [];
        const summaryOffer = matchingOffers[0] ?? null;
        let detailedOffer: Offer | null = null;
        if (summaryOffer?.id) {
          try {
            detailedOffer = await getApi<Offer>(`/offers/${summaryOffer.id}`);
          } catch (error: unknown) {
            // Keep the list record available when the detailed endpoint is restricted.
            offerLoadError = error;
          }
        }
        const loadedOffer = detailedOffer ?? summaryOffer;
        setOffer(loadedOffer);
        const version = loadedOffer?.currentVersion;
        const draftSource = loadedOffer?.id && version?.id ? `${loadedOffer.id}:${version.id}` : null;
        // Keep a recruiter's in-progress offer edits when they move between
        // workspace stages. Refresh the form only when the server exposes a
        // new offer version (for example, after a saved revision).
        if (version && draftSource && draftSource !== offerDraftSourceRef.current) {
          offerDraftSourceRef.current = draftSource;
          setOfferDraft((current) => ({
            ...current,
            contractType: version?.contractType ?? current.contractType,
            probationPeriod: version?.probationPeriod ?? current.probationPeriod,
            offerExpiry: toDateInput(version?.offerExpiry),
            proposedJoiningDate: toDateInput(version?.proposedJoiningDate),
            workLocation: version?.workLocation ?? inheritedLocation,
            workingSchedule: version?.workingSchedule ?? current.workingSchedule,
            amount: version?.components?.find((item) => item.type === 'Salary')?.amount == null
              ? ''
              : String(version.components.find((item) => item.type === 'Salary')?.amount),
            currency: version?.components?.find((item) => item.type === 'Salary')?.currency ?? current.currency,
          }));
        }
      } else {
        offerLoadError = offerResult.reason;
        setOffer(null);
      }

      if (hiringResult.status === 'fulfilled') {
        const matchingCase = Array.isArray(hiringResult.value)
          ? hiringResult.value.find((item) => item.applicationId === application.id) ?? null
          : null;
        setHiringCase(matchingCase);
      } else {
        hiringLoadError = hiringResult.reason;
        setHiringCase(null);
      }

      if (offerLoadError && hiringLoadError) {
        setRecordError('Offer and pre-hire details are not available for this role.');
      } else if (offerLoadError || hiringLoadError) {
        setRecordError('Some stage details are restricted for your role.');
      }
    } catch (error: unknown) {
      setRecordError(errorMessage(error));
    } finally {
      setRecordLoading(false);
    }
  };

  useEffect(() => {
    if (effectiveStage === 'Offer' || effectiveStage === 'Pre-Hire' || effectiveStage === 'Joined') {
      void loadStageRecords();
    }
  }, [application.id, effectiveStage]);

  const handleStageSelect = (stage: ApplicationWorkspaceStage) => {
    if (!stage.isAvailable || stage.name === effectiveStage) return;
    onStageChange(stage.name);
  };

  const handleSaveOffer = async (event: FormEvent) => {
    event.preventDefault();
    if (!canMoveStage || busyAction) return;
    const amount = Number(offerDraft.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setActionError('Enter a positive salary amount before saving the offer.');
      return;
    }
    setBusyAction('offer-save');
    setActionError(null);
    setActionNotice(null);
    const salary: OfferComponentItem = {
      type: 'Salary',
      name: 'Base Salary',
      amount,
      currency: offerDraft.currency.trim().toUpperCase() || 'AED',
      frequency: 'Monthly',
      isTaxable: true,
    };
    try {
      if (offer?.id) {
        await postApi(`/offers/${offer.id}/revisions`, {
          ...offerDraft,
          offerExpiry: offerDraft.offerExpiry ? new Date(offerDraft.offerExpiry).toISOString() : undefined,
          proposedJoiningDate: offerDraft.proposedJoiningDate ? new Date(offerDraft.proposedJoiningDate).toISOString() : undefined,
          components: [salary],
        });
      } else {
        await postApi('/offers', {
          applicationId: application.id,
          ...offerDraft,
          offerExpiry: offerDraft.offerExpiry ? new Date(offerDraft.offerExpiry).toISOString() : undefined,
          proposedJoiningDate: offerDraft.proposedJoiningDate ? new Date(offerDraft.proposedJoiningDate).toISOString() : undefined,
          components: [salary],
        });
      }
      setActionNotice('Offer details saved and submitted to the server.');
      await loadStageRecords();
      await onRefresh();
    } catch (error: unknown) {
      setActionError(errorMessage(error));
    } finally {
      setBusyAction(null);
    }
  };

  const handleOfferDecision = async (decision: 'Approve' | 'Reject') => {
    if (!offer || busyAction) return;
    const pendingApproval = offer.currentVersion?.approvals?.find((item) => item.status === 'Pending');
    setBusyAction(`offer-${decision}`);
    setActionError(null);
    setActionNotice(null);
    try {
      if (pendingApproval) {
        await postApi(`/offers/approvals/${pendingApproval.id}/decide`, {
          decision,
          comment: decision === 'Approve' ? 'Approved from Applicant Profile workspace.' : 'Rejected from Applicant Profile workspace.',
        });
      } else if (decision === 'Reject') {
        await patchApi(`/offers/${offer.id}/status`, { status: 'Withdrawn' });
      }
      setActionNotice(`Offer ${decision === 'Approve' ? 'approval' : 'decision'} saved.`);
      await loadStageRecords();
      await onRefresh();
    } catch (error: unknown) {
      setActionError(errorMessage(error));
    } finally {
      setBusyAction(null);
    }
  };

  const handleOfferStatus = async (status: 'Sent' | 'Accepted' | 'Declined') => {
    if (!offer || busyAction) return;
    setBusyAction(`offer-status-${status}`);
    setActionError(null);
    setActionNotice(null);
    try {
      await patchApi(`/offers/${offer.id}/status`, { status });
      setActionNotice(`Offer status updated to ${status}.`);
      await loadStageRecords();
      await onRefresh();
    } catch (error: unknown) {
      setActionError(errorMessage(error));
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreateHiringCase = async () => {
    if (!offer || offer.status !== 'Accepted' || busyAction || !canEdit) return;
    setBusyAction('hiring-create');
    setActionError(null);
    setActionNotice(null);
    try {
      await postApi('/hiring', { offerId: offer.id });
      setActionNotice('Pre-Hire file created.');
      await loadStageRecords();
      await onRefresh();
    } catch (error: unknown) {
      setActionError(errorMessage(error));
    } finally {
      setBusyAction(null);
    }
  };

  const handleComplianceChange = async (id: string, status: ComplianceStatus) => {
    if (!hiringCase || busyAction || !canEdit) return;
    setBusyAction(`compliance-${id}`);
    setActionError(null);
    try {
      await patchApi(`/hiring/${hiringCase.id}/compliance/${id}`, { status });
      setActionNotice('Requirement status saved.');
      await loadStageRecords();
      await onRefresh();
    } catch (error: unknown) {
      setActionError(errorMessage(error));
    } finally {
      setBusyAction(null);
    }
  };

  const handleHiringAction = async (action: 'submit' | 'approve' | 'join') => {
    if (!hiringCase || busyAction) return;
    setBusyAction(`hiring-${action}`);
    setActionError(null);
    setActionNotice(null);
    try {
      if (action === 'submit') {
        await postApi(`/hiring/${hiringCase.id}/submit`);
        setActionNotice('Pre-Hire file submitted for final approval.');
      } else if (action === 'approve') {
        await postApi(`/hiring/${hiringCase.id}/final-approval`, {
          decision: 'Approve',
          comment: 'Approved from Applicant Profile workspace.',
        });
        setActionNotice('Final approval saved.');
      } else {
        await postApi(`/hiring/${hiringCase.id}/joining`, {
          status: 'Joined',
          actualJoiningDate: new Date().toISOString(),
        });
        setActionNotice('Joining details saved.');
      }
      await loadStageRecords();
      await onRefresh();
    } catch (error: unknown) {
      setActionError(errorMessage(error));
    } finally {
      setBusyAction(null);
    }
  };

  const requiredCompliance = useMemo(
    () => hiringCase?.complianceRequirements?.filter((item) => item.isRequired) ?? [],
    [hiringCase],
  );
  const completeCompliance = requiredCompliance.filter((item) => item.status === 'Verified' || item.status === 'Not Required').length;
  const canSubmitHiring = Boolean(hiringCase && requiredCompliance.length === completeCompliance);
  const showSensitiveOffer = canViewSalary;
  const saveOfferFromActionRail = () => {
    const amount = Number(offerDraft.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setActionError('Enter a positive salary amount before saving the offer.');
      return;
    }
    void handleSaveOffer({ preventDefault: () => undefined } as FormEvent);
  };

  return (
    <section className="space-y-4" aria-label="Unified applicant stage workspace">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0 space-y-4">
          <section aria-label="Applicant pipeline stages" className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">Pipeline workspace</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Current stage: <strong className="text-slate-900 dark:text-white">{application.stage}</strong></p>
              </div>
              {nextStage && <Badge variant="info">Next: {nextStage}</Badge>}
            </div>
            <div className="overflow-x-auto pb-1" role="tablist" aria-label="Applicant stages">
              <div className="flex min-w-max items-center gap-2">
                {stageItems.map((stage, index) => {
                  const isSelected = stage.name === effectiveStage;
                  return (
                    <div key={stage.id} className="flex items-center gap-2">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={isSelected}
                        aria-current={stage.isCurrent ? 'step' : undefined}
                        aria-disabled={!stage.isAvailable}
                        disabled={!stage.isAvailable}
                        onClick={() => handleStageSelect(stage)}
                        className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-300'
                            : stage.isCompleted
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'
                              : stage.isAvailable
                                ? 'border-slate-200 text-slate-600 hover:border-blue-300 dark:border-slate-700 dark:text-slate-300'
                                : 'cursor-not-allowed border-slate-100 text-slate-300 dark:border-slate-800 dark:text-slate-600'
                        }`}
                      >
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-current/10 text-[10px]">{stage.isCompleted ? '✓' : index + 1}</span>
                        <span>{stage.name}</span>
                        {stage.isNext && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">Next</span>}
                      </button>
                      {index < stageItems.length - 1 && <span aria-hidden="true" className="text-slate-300">→</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {actionError && <Alert tone="danger" title="Workspace action failed" role="alert">{actionError}</Alert>}
          {actionNotice && <Alert tone="success" title="Saved" role="status">{actionNotice}</Alert>}
          {workspace && <RequirementList
            requirements={workspace.nextStageRequirements}
            onAction={(tab) => {
              onStageChange(tab);
            }}
          />}

          <section
            role="tabpanel"
            aria-label={`${effectiveStage} stage workspace`}
            className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/70 via-white to-emerald-50/40 p-4 shadow-xs dark:border-blue-950 dark:from-blue-950/30 dark:via-slate-900 dark:to-emerald-950/20 sm:p-5"
          >
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/70 pb-3 dark:border-slate-800">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">Stage workspace</p>
                <h2 className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">{effectiveStage}</h2>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Review and save this stage while keeping the applicant profile open.</p>
              </div>
              {currentItem?.required && <Badge variant="warning">Required stage</Badge>}
            </div>

            {effectiveStage === 'Applied' && (
              <div className="grid gap-4 text-xs md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/80">
                  <h3 className="font-bold text-slate-900 dark:text-white">Application details</h3>
                  <dl className="mt-3 space-y-2">
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Source</dt><dd className="font-semibold text-slate-900 dark:text-white">{application.source || application.candidate?.source || 'Not provided'}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Applied</dt><dd className="font-semibold text-slate-900 dark:text-white">{formatDate(application.appliedAt)}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Position</dt><dd className="text-right font-semibold text-slate-900 dark:text-white">{application.positionTitle || 'Not provided'}</dd></div>
                  </dl>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/80">
                  <h3 className="font-bold text-slate-900 dark:text-white">Initial match</h3>
                  <p className="mt-2 text-slate-600 dark:text-slate-300">Review the uploaded CV details and initial fit signals without leaving this applicant workspace.</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">{application.candidate?.skills?.length ? application.candidate.skills.map((skill) => <span key={skill} className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">{skill}</span>) : <span className="text-slate-400">No skills recorded</span>}</div>
                  <Button type="button" size="sm" variant="secondary" className="mt-3" onClick={onViewResume}><Icon name="file-text" size={13} />View CV details</Button>
                </div>
              </div>
            )}

            {effectiveStage === 'Screening' && (
              <div className="space-y-4">
                {screeningError && (
                  <Alert tone="danger" role="alert">
                    {screeningError}
                  </Alert>
                )}
                <div className="grid gap-3 text-xs sm:grid-cols-2">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Screening result
                    <Select aria-label="Workspace screening result" value={screeningOutcome} onChange={(event) => setScreeningOutcome(event.target.value as ScreeningOutcome)} disabled={!canEdit || isSavingScreening} className="mt-1">
                      <option value="On Hold">On Hold</option><option value="Passed">Passed</option><option value="Failed">Failed</option>
                    </Select>
                  </label>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Notice period (days) <span className="text-rose-500">*</span>
                    <Input aria-label="Workspace notice period" type="number" min="0" max="3650" required value={noticePeriodDays} onChange={(event) => setNoticePeriodDays(event.target.value)} disabled={!canEdit || isSavingScreening} className="mt-1" />
                  </label>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Expected salary {showSensitiveOffer && <span className="text-rose-500">*</span>}
                    <Input aria-label="Workspace expected salary" type="number" min="0" step="0.01" required={showSensitiveOffer} value={showSensitiveOffer ? expectedSalary : ''} placeholder={showSensitiveOffer ? undefined : 'Restricted'} onChange={(event) => setExpectedSalary(event.target.value)} disabled={!canEdit || !showSensitiveOffer || isSavingScreening} className="mt-1" />
                  </label>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Current salary {showSensitiveOffer && <span className="text-rose-500">*</span>}
                    <Input aria-label="Workspace current salary" type="number" min="0" step="0.01" required={showSensitiveOffer} value={showSensitiveOffer ? currentSalary : ''} placeholder={showSensitiveOffer ? undefined : 'Restricted'} onChange={(event) => setCurrentSalary(event.target.value)} disabled={!canEdit || !showSensitiveOffer || isSavingScreening} className="mt-1" />
                  </label>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Currency {showSensitiveOffer && <span className="text-rose-500">*</span>}
                    {showSensitiveOffer ? (
                      <Select
                        aria-label="Workspace salary currency"
                        value={salaryCurrency === 'EGP' || salaryCurrency === 'EGY' ? 'EGP' : 'AED'}
                        onChange={(event) => setSalaryCurrency(event.target.value)}
                        disabled={!canEdit || isSavingScreening}
                        className="mt-1"
                      >
                        <option value="AED">AED (UAE Dirham)</option>
                        <option value="EGP">EGP (Egyptian Pound)</option>
                      </Select>
                    ) : (
                      <Input aria-label="Workspace salary currency" value="" placeholder="Restricted" disabled className="mt-1" />
                    )}
                  </label>
                </div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Employee notes
                  <textarea aria-label="Workspace screening notes" rows={4} maxLength={5000} value={screeningNotes} onChange={(event) => setScreeningNotes(event.target.value)} disabled={!canEdit || isSavingScreening} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="Notice period, compensation context, and screening notes..." />
                </label>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500">{latestScreening ? `Last saved ${formatDate(latestScreening.screenedAt)}` : 'No screening record saved yet'}</span>
                  {canEdit && <Button type="button" variant="primary" size="sm" loading={isSavingScreening} disabled={isSavingScreening || !isScreeningDirty} onClick={() => void onSaveScreening()}><Icon name="check" size={13} />Save Screening</Button>}
                </div>
              </div>
            )}

            {effectiveStage === 'Interview' && canViewInterviews && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-slate-600 dark:text-slate-300">Schedule interviews, track confirmation, and capture panel evaluations here.</p><Button type="button" size="sm" variant="primary" onClick={onScheduleInterview} disabled={!canMoveStage}><Icon name="calendar" size={13} />Schedule interview</Button></div>
                {interviews.length === 0 ? <PageState kind="empty" title="No interviews recorded" description="Schedule the first interview for this applicant." actionLabel={canMoveStage ? 'Schedule interview' : undefined} onAction={canMoveStage ? onScheduleInterview : undefined} /> : interviews.map((item) => {
                  const pendingScorecard = !item.scorecards?.some((scorecard) => scorecard.isLocked);
                  return (
                    <div key={item.id} className="rounded-xl border border-slate-200 bg-white/80 p-4 text-xs dark:border-slate-800 dark:bg-slate-900/80">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div><h3 className="font-bold text-slate-900 dark:text-white">{item.title}</h3><p className="mt-1 text-slate-500">{formatDate(item.scheduledStart)} · {item.interviewerName || item.attendees?.map((attendee) => attendee.userName).filter(Boolean).join(', ') || 'Interviewer not assigned'}</p>{item.locationUrl && <a className="mt-1 inline-block text-blue-600 underline" href={item.locationUrl} target="_blank" rel="noreferrer">Meeting link</a>}</div>
                        <div className="flex items-center gap-2"><Badge variant={item.status === 'Completed' ? 'success' : item.status === 'Cancelled' ? 'danger' : 'info'}>{item.status}</Badge>{pendingScorecard && canViewInterviews && <Button type="button" variant="secondary" size="sm" onClick={() => setScorecardInterview(item)}>Add evaluation</Button>}</div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800"><span className="text-slate-500">Confirmation: {item.attendees?.map((attendee) => `${attendee.userName || 'Interviewer'} · ${attendee.response}`).join(', ') || 'Manual interviewer'}</span>{canMoveStage && item.status !== 'Cancelled' && <Select aria-label={`Update status for ${item.title}`} value={item.status} onChange={async (event) => { const status = event.target.value as Interview['status']; setBusyAction(`interview-${item.id}`); try { await patchApi(`/interviews/${item.id}`, { status }); setActionNotice('Interview status saved.'); await onRefresh(); } catch (error: unknown) { setActionError(errorMessage(error)); } finally { setBusyAction(null); } }} disabled={busyAction === `interview-${item.id}`} className="w-auto"><option value="Scheduled">Scheduled</option><option value="Completed">Completed</option><option value="Rescheduled">Rescheduled</option><option value="Cancelled">Cancelled</option></Select>}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {effectiveStage === 'Interview' && !canViewInterviews && (
              <Alert tone="warning" title="Interview access restricted" role="status">
                Your role does not include permission to view interview details or evaluations.
              </Alert>
            )}

            {effectiveStage === 'Offer' && (
              <div className="space-y-4">
                {recordLoading && <p role="status" className="text-xs text-slate-500">Loading offer details…</p>}
                {recordError && <Alert tone="warning" role="alert">{recordError}</Alert>}
                {offer ? (
                  <div className="space-y-4 rounded-xl border border-slate-200 bg-white/80 p-4 text-xs dark:border-slate-800 dark:bg-slate-900/80">
                    <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-bold text-slate-900 dark:text-white">{offer.offerCode}</h3><p className="mt-1 text-slate-500">{offer.currentVersion?.contractType || 'Contract terms pending'} · {offer.currentVersion?.workLocation || inheritedLocation}</p></div><Badge variant={offer.status === 'Accepted' ? 'success' : offer.status === 'Declined' || offer.status === 'Withdrawn' ? 'danger' : 'info'}>{offer.status}</Badge></div>
                    {showSensitiveOffer && <div className="grid gap-3 sm:grid-cols-3"><div><span className="block text-slate-500">Monthly package</span><strong>{offer.currentVersion?.monthlyPackage?.toLocaleString() ?? '—'} {offer.currentVersion?.components?.[0]?.currency || 'SAR'}</strong></div><div><span className="block text-slate-500">Proposed joining</span><strong>{formatDate(offer.currentVersion?.proposedJoiningDate)}</strong></div><div><span className="block text-slate-500">Approval</span><strong>{offer.currentVersion?.approvalStatus || 'Pending'}</strong></div></div>}
                    <div className="border-t border-slate-100 pt-3 dark:border-slate-800"><span className="text-slate-500">Approvals</span><div className="mt-2 flex flex-wrap gap-2">{offer.currentVersion?.approvals?.length ? offer.currentVersion.approvals.map((approval) => <Badge key={approval.id} variant={approval.status === 'Approved' ? 'success' : approval.status === 'Rejected' ? 'danger' : 'warning'}>{approval.roleCode}: {approval.status}</Badge>) : <span className="text-slate-400">No approval record</span>}</div></div>
                    <div className="flex flex-wrap gap-2">{canApproveOffers && offer.currentVersion?.approvals?.some((item) => item.status === 'Pending') && <><Button type="button" size="sm" variant="primary" loading={busyAction === 'offer-Approve'} onClick={() => void handleOfferDecision('Approve')}>Approve offer</Button><Button type="button" size="sm" variant="danger" loading={busyAction === 'offer-Reject'} onClick={() => void handleOfferDecision('Reject')}>Reject offer</Button></>}{canMoveStage && offer.status === 'Approved' && <Button type="button" size="sm" variant="secondary" loading={busyAction === 'offer-status-Sent'} onClick={() => void handleOfferStatus('Sent')}>Mark sent</Button>}{canMoveStage && offer.status === 'Sent' && <Button type="button" size="sm" variant="primary" loading={busyAction === 'offer-status-Accepted'} onClick={() => void handleOfferStatus('Accepted')}>Mark accepted</Button>}</div>
                  </div>
                ) : (
                  <form onSubmit={(event) => void handleSaveOffer(event)} className="space-y-4 rounded-xl border border-slate-200 bg-white/80 p-4 text-xs dark:border-slate-800 dark:bg-slate-900/80">
                    <div><h3 className="font-bold text-slate-900 dark:text-white">Create offer details</h3><p className="mt-1 text-slate-500">The job location is inherited automatically from the requisition.</p></div>
                    <div className="grid gap-3 sm:grid-cols-2"><label className="font-semibold">Contract type<Input value={offerDraft.contractType} onChange={(event) => setOfferDraft({ ...offerDraft, contractType: event.target.value })} disabled={!canMoveStage || Boolean(busyAction)} className="mt-1" /></label><label className="font-semibold">Probation period<Input value={offerDraft.probationPeriod} onChange={(event) => setOfferDraft({ ...offerDraft, probationPeriod: event.target.value })} disabled={!canMoveStage || Boolean(busyAction)} className="mt-1" /></label><label className="font-semibold">Monthly salary{showSensitiveOffer ? <Input required type="number" min="0.01" step="0.01" value={offerDraft.amount} onChange={(event) => setOfferDraft({ ...offerDraft, amount: event.target.value })} disabled={!canMoveStage || Boolean(busyAction)} className="mt-1" /> : <span className="mt-1 block rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-500">Restricted</span>}</label><label className="font-semibold">Currency<Select aria-label="Offer currency" value={offerDraft.currency === 'EGP' || offerDraft.currency === 'EGY' ? 'EGP' : 'AED'} onChange={(event) => setOfferDraft({ ...offerDraft, currency: event.target.value })} disabled={!canMoveStage || Boolean(busyAction) || !showSensitiveOffer} className="mt-1"><option value="AED">AED (UAE Dirham)</option><option value="EGP">EGP (Egyptian Pound)</option></Select></label><label className="font-semibold">Proposed joining date<Input type="date" value={offerDraft.proposedJoiningDate} onChange={(event) => setOfferDraft({ ...offerDraft, proposedJoiningDate: event.target.value })} disabled={!canMoveStage || Boolean(busyAction)} className="mt-1" /></label><label className="font-semibold">Work location<Input value={offerDraft.workLocation || inheritedLocation} readOnly className="mt-1 bg-slate-50 dark:bg-slate-800" /></label></div>
                    <Button type="submit" size="sm" variant="primary" loading={busyAction === 'offer-save'} disabled={!canMoveStage || !showSensitiveOffer || Boolean(busyAction)}>Save offer</Button>
                  </form>
                )}
              </div>
            )}

            {(effectiveStage === 'Pre-Hire' || effectiveStage === 'Joined') && (
              <div className="space-y-4">
                {recordLoading && <p role="status" className="text-xs text-slate-500">Loading pre-hire file…</p>}
                {recordError && <Alert tone="warning" role="alert">{recordError}</Alert>}
                {!hiringCase ? (
                  <div className="rounded-xl border border-slate-200 bg-white/80 p-4 text-xs dark:border-slate-800 dark:bg-slate-900/80"><h3 className="font-bold text-slate-900 dark:text-white">Pre-Hire file</h3><p className="mt-1 text-slate-500">An accepted offer is required before the compliance file can be created.</p>{offer?.status === 'Accepted' && canEdit && <Button type="button" size="sm" variant="primary" className="mt-3" loading={busyAction === 'hiring-create'} onClick={() => void handleCreateHiringCase()}>Create Pre-Hire file</Button>}</div>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-slate-200 bg-white/80 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/80"><span className="block text-slate-500">File status</span><strong className="mt-1 block text-slate-900 dark:text-white">{hiringCase.status}</strong></div><div className="rounded-xl border border-slate-200 bg-white/80 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/80"><span className="block text-slate-500">Requirements</span><strong className="mt-1 block text-slate-900 dark:text-white">{completeCompliance}/{requiredCompliance.length} complete</strong></div><div className="rounded-xl border border-slate-200 bg-white/80 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/80"><span className="block text-slate-500">Joining date</span><strong className="mt-1 block text-slate-900 dark:text-white">{formatDate(hiringCase.actualJoiningDate || hiringCase.plannedJoiningDate)}</strong></div></div>
                    <div className="space-y-2 rounded-xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/80"><div className="flex items-center justify-between gap-2"><h3 className="font-bold text-slate-900 dark:text-white">Requirements, licenses, and documents</h3><span className="text-[11px] text-slate-500">Required items block advance</span></div>{hiringCase.complianceRequirements?.length ? hiringCase.complianceRequirements.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 p-2.5 text-xs dark:border-slate-800"><div><span className="font-semibold text-slate-900 dark:text-white">{item.name}</span><span className="ml-2 text-[10px] text-slate-500">{item.type}{item.isRequired ? ' · Required' : ' · Optional'}</span></div><Select aria-label={`Status for ${item.name}`} value={item.status} onChange={(event) => void handleComplianceChange(item.id, event.target.value as ComplianceStatus)} disabled={!canEdit || Boolean(busyAction)} className="w-auto"><option value="Pending">Pending</option><option value="Submitted">Submitted</option><option value="Verified">Verified</option><option value="Rejected">Rejected</option><option value="Not Required">Not Required</option></Select></div>) : <p className="text-xs text-slate-500">No requirements configured for this file.</p>}</div>
                    <div className="flex flex-wrap gap-2">{canEdit && hiringCase.status === 'Pending Compliance' && <Button type="button" size="sm" variant="secondary" loading={busyAction === 'hiring-submit'} disabled={!canSubmitHiring} onClick={() => void handleHiringAction('submit')}>Submit for final approval</Button>}{canApproveHiring && hiringCase.status === 'Pending Final Approval' && <Button type="button" size="sm" variant="primary" loading={busyAction === 'hiring-approve'} onClick={() => void handleHiringAction('approve')}>Approve hiring file</Button>}{canApproveHiring && hiringCase.status === 'Awaiting Joining' && <Button type="button" size="sm" variant="primary" loading={busyAction === 'hiring-join'} onClick={() => void handleHiringAction('join')}>Confirm joined</Button>}</div>
                    {effectiveStage === 'Joined' && <Alert tone="success" title="Joining record">{hiringCase.status === 'Joined' ? `Candidate joined on ${formatDate(hiringCase.actualJoiningDate)}.` : 'The application is in Joined. Refresh the joining record if the file status is still updating.'}</Alert>}
                  </>
                )}
              </div>
            )}

            {!STANDARD_STAGE_NAMES.has(effectiveStage) && (
              <div className="space-y-4 text-xs">
                <div className="rounded-xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/80">
                  <h3 className="font-bold text-slate-900 dark:text-white">{effectiveStage} stage</h3>
                  <p className="mt-1 text-slate-500 dark:text-slate-400">
                    This stage is configured in the organization pipeline. Complete its requirements here, then use Advance Stage when the stage owner is ready.
                  </p>
                </div>
                {currentItem?.requirements?.length ? (
                  <RequirementList requirements={currentItem.requirements} onAction={onStageChange} />
                ) : (
                  <p className="rounded-xl border border-slate-200 bg-white/80 p-4 text-slate-500 dark:border-slate-800 dark:bg-slate-900/80">No requirements configured for this stage.</p>
                )}
              </div>
            )}
          </section>
        </div>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-3 shadow-xs xl:sticky xl:top-4 dark:border-slate-800 dark:bg-slate-900" aria-label="Applicant actions">
          <p className="mb-2 px-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">Actions</p>
          <div className="grid gap-2">
            <Button type="button" variant="primary" size="sm" disabled={effectiveStage === 'Screening' ? !canEdit || !isScreeningDirty || isSavingScreening : Boolean(busyAction)} loading={effectiveStage === 'Screening' && isSavingScreening} onClick={() => effectiveStage === 'Screening' ? void onSaveScreening() : effectiveStage === 'Offer' ? saveOfferFromActionRail() : effectiveStage === 'Pre-Hire' || effectiveStage === 'Joined' ? void onRefresh() : setActionNotice('Applied details are already saved from the application record.')}>Save</Button>
            <Button type="button" variant="secondary" size="sm" disabled={!canMoveStage || !nextStage || workspace?.canAdvance === false || Boolean(busyAction)} onClick={onAdvanceStage}>Advance Stage</Button>
            <Button type="button" variant="danger" size="sm" disabled={!canMoveStage || Boolean(busyAction)} onClick={onReject}>Reject</Button>
            <Button type="button" variant="ghost" size="sm" disabled={!canEdit} onClick={onAddNote}><Icon name="file-text" size={13} />Add Note</Button>
            <div className="grid grid-cols-3 gap-1.5 border-t border-slate-100 pt-2 dark:border-slate-800"><Button type="button" variant="ghost" size="sm" disabled={!canEdit} onClick={() => onActivity('Call')} title="Log call"><Icon name="phone" size={13} />Call</Button><Button type="button" variant="ghost" size="sm" disabled={!canEdit} onClick={() => onActivity('Email')} title="Log email"><Icon name="mail" size={13} />Email</Button><Button type="button" variant="ghost" size="sm" disabled={!canEdit} onClick={() => onActivity('Offer Follow-up')} title="Plan follow-up"><Icon name="clock" size={13} />Follow-up</Button></div>
          </div>
          {!canMoveStage && <p className="mt-3 text-[10px] leading-relaxed text-slate-500">Stage movement and stage records are restricted for your role.</p>}
        </aside>
      </div>

      <FastScorecardModal isOpen={Boolean(scorecardInterview)} interview={scorecardInterview} onClose={() => setScorecardInterview(null)} onSuccess={async () => { setScorecardInterview(null); await onRefresh(); }} />
    </section>
  );
}
