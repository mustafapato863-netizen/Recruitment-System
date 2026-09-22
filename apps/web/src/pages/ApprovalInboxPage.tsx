import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { OfferApprovalInboxItem, VacancyCoreContext, VacancyRequest } from '@recruitflow/contracts';
import { fetchApi, getApi, postApi } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { DataToolbar } from '../components/ui/DataToolbar';
import { Input } from '../components/ui/Input';
import { Icon, type IconName } from '../components/Icon';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useFeedback } from '../hooks/useFeedback';
import { usePermissions } from '../hooks/usePermissions';
import { getErrorMessage } from '../api/errors';
import './PageEnhancementsV2.css';

interface FinalHiringInboxItem {
  id: string;
  candidateName: string;
  positionTitle: string;
  branchName: string;
  status: string;
  updatedAt?: string;
}

interface ConfirmState {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone: 'primary' | 'success' | 'danger' | 'warning';
  icon?: IconName;
  withComment?: boolean;
  commentPlaceholder?: string;
  action: (comment?: string) => Promise<void>;
}

const initialConfirmState: ConfirmState = {
  isOpen: false,
  title: '',
  description: '',
  confirmLabel: 'Confirm',
  tone: 'primary',
  action: async () => {},
};

function currentApproval(request: VacancyRequest) {
  return [...request.approvals].reverse().find(
    (approval) => approval.revision === request.approvalRevision && approval.status === 'Pending',
  );
}

function formatApprovalRole(roleCode?: string, fallback = 'Pending review') {
  if (!roleCode) return fallback;
  return roleCode
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/^Hr\b/, 'HR');
}

function formatApprovalDate(value?: string) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

type TabType = 'vacancy-requests' | 'offers' | 'final-hires';

export function ApprovalInboxPage() {
  const { success: toastSuccess, error: toastError } = useFeedback();
  const { hasPermission } = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as TabType | null;

  const canApproveVacancies = hasPermission('VACANCY_REQUEST_APPROVE');
  const canApproveOffers = hasPermission('APPROVE_OFFERS');
  const canApproveFinalHires = hasPermission('FINAL_HIRING_APPROVAL');

  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (tabParam && ['vacancy-requests', 'offers', 'final-hires'].includes(tabParam)) {
      return tabParam;
    }
    return 'vacancy-requests';
  });
  const [requests, setRequests] = useState<VacancyRequest[]>([]);
  const [vacancyContext, setVacancyContext] = useState<VacancyCoreContext | null>(null);
  const [offerApprovals, setOfferApprovals] = useState<OfferApprovalInboxItem[]>([]);
  const [finalHires, setFinalHires] = useState<FinalHiringInboxItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState>(initialConfirmState);

  const handleTabChange = useCallback((key: TabType) => {
    setActiveTab(key);
    setSearchQuery('');
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', key);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    const currentIsAllowed = (activeTab === 'vacancy-requests' && canApproveVacancies)
      || (activeTab === 'offers' && canApproveOffers)
      || (activeTab === 'final-hires' && canApproveFinalHires);
    if (currentIsAllowed) return;
    if (canApproveVacancies) setActiveTab('vacancy-requests');
    else if (canApproveOffers) setActiveTab('offers');
    else if (canApproveFinalHires) setActiveTab('final-hires');
  }, [activeTab, canApproveFinalHires, canApproveOffers, canApproveVacancies]);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [vrRes, offRes, hireRes] = await Promise.all([
        canApproveVacancies ? getApi<VacancyRequest[]>('/vacancy-requests/inbox') : Promise.resolve(null),
        canApproveOffers ? getApi<OfferApprovalInboxItem[]>('/offers/approvals/inbox') : Promise.resolve(null),
        canApproveFinalHires ? getApi<FinalHiringInboxItem[]>('/hiring/final-approvals') : Promise.resolve(null),
      ]);
      const vrList = vrRes ?? [];
      const offList = offRes ?? [];
      const hireList = hireRes ?? [];
      setRequests(vrList);
      setOfferApprovals(offList);
      setFinalHires(hireList);

      // Auto-switch to tab with pending items if initial tab has 0
      const currentUrlTab = new URLSearchParams(window.location.search).get('tab');
      if (!currentUrlTab) {
        if (canApproveVacancies && vrList.length > 0) {
          setActiveTab('vacancy-requests');
        } else if (canApproveOffers && offList.length > 0) {
          setActiveTab('offers');
        } else if (canApproveFinalHires && hireList.length > 0) {
          setActiveTab('final-hires');
        }
      }
    } catch (err) {
      const message = getErrorMessage(err, 'Unable to load the approval inbox');
      setError(message);
      toastError(err, 'Unable to load approval inbox');
    } finally {
      setIsLoading(false);
    }
  }, [canApproveFinalHires, canApproveOffers, canApproveVacancies, toastError]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!canApproveVacancies) return;
    void fetchApi<VacancyCoreContext>('/vacancy-requests/context')
      .then(setVacancyContext)
      .catch(() => undefined);
  }, [canApproveVacancies]);

  const getPositionLabel = useCallback((request: VacancyRequest) => (
    vacancyContext?.positions?.find((position) => position.id === request.positionId)?.title
    ?? (vacancyContext?.position?.id === request.positionId ? vacancyContext.position.title : request.positionId)
    ?? 'Requisition'
  ), [vacancyContext]);

  const getBranchLabel = useCallback((request: VacancyRequest) => (
    vacancyContext?.branches?.find((branch) => branch.id === request.branchId)?.name
    ?? (vacancyContext?.branch?.id === request.branchId ? vacancyContext.branch.name : request.branchId)
    ?? 'Location not set'
  ), [vacancyContext]);

  const totalPending = requests.length + offerApprovals.length + finalHires.length;

  const filteredRequests = useMemo(() => {
    if (!searchQuery.trim()) return requests;
    const q = searchQuery.toLowerCase();
    return requests.filter(
      (r) =>
        r.requestCode?.toLowerCase().includes(q) ||
        getPositionLabel(r).toLowerCase().includes(q) ||
        getBranchLabel(r).toLowerCase().includes(q),
    );
  }, [getBranchLabel, getPositionLabel, requests, searchQuery]);

  const filteredOffers = useMemo(() => {
    if (!searchQuery.trim()) return offerApprovals;
    const q = searchQuery.toLowerCase();
    return offerApprovals.filter(
      (o) =>
        o.offerCode?.toLowerCase().includes(q) ||
        o.candidateName?.toLowerCase().includes(q) ||
        o.positionTitle?.toLowerCase().includes(q) ||
        o.roleCode?.toLowerCase().includes(q),
    );
  }, [offerApprovals, searchQuery]);

  const filteredHires = useMemo(() => {
    if (!searchQuery.trim()) return finalHires;
    const q = searchQuery.toLowerCase();
    return finalHires.filter(
      (h) =>
        h.candidateName?.toLowerCase().includes(q) ||
        h.positionTitle?.toLowerCase().includes(q) ||
        h.branchName?.toLowerCase().includes(q),
    );
  }, [finalHires, searchQuery]);

  const triggerApproveVacancy = (request: VacancyRequest) => {
    setConfirmDialog({
      isOpen: true,
      title: `Approve Vacancy Request ${request.requestCode}`,
      description: `Authorizing requisition for ${request.requestedHeadcount} position(s) at ${getBranchLabel(request)}. Requisition will advance to the next approval tier or active status.`,
      confirmLabel: 'Approve Request',
      tone: 'success',
      icon: 'check-circle',
      withComment: true,
      commentPlaceholder: 'Optional approval notes or budget authorization reference...',
      action: async (comment?: string) => {
        setBusyId(request.id);
        setError('');
        setFeedback('');
        try {
          await postApi(`/vacancy-requests/${request.id}/approve`, { comment });
          setFeedback(`Vacancy request ${request.requestCode} approved successfully.`);
          toastSuccess('Request approved', `Vacancy request ${request.requestCode} advanced successfully.`);
          await loadAll();
        } catch (err) {
          const message = getErrorMessage(err, 'Unable to approve this request');
          setError(message);
          toastError(err, 'Unable to approve request');
        } finally {
          setBusyId(null);
          setConfirmDialog(initialConfirmState);
        }
      },
    });
  };

  const triggerDecideOffer = (oa: OfferApprovalInboxItem, decision: 'Approved' | 'Rejected') => {
    const isApproval = decision === 'Approved';
    setConfirmDialog({
      isOpen: true,
      title: isApproval ? `Approve Offer Package ${oa.offerCode}` : `Reject Offer Package ${oa.offerCode}`,
      description: isApproval
        ? `Granting compensation signoff for Version ${oa.versionNumber}. The package will advance to candidate delivery upon final signoff.`
        : `Rejecting this compensation package. The talent team will receive your rejection feedback to draft a revision.`,
      confirmLabel: isApproval ? 'Approve Offer' : 'Reject Offer',
      tone: isApproval ? 'success' : 'danger',
      icon: isApproval ? 'check-circle' : 'alert-triangle',
      withComment: true,
      commentPlaceholder: isApproval ? 'Optional approval context...' : 'Reason for package rejection (required for revision)...',
      action: async (comment?: string) => {
        setBusyId(oa.id);
        setError('');
        setFeedback('');
        try {
          await postApi(`/offers/approvals/${oa.id}/decide`, {
            decision,
            comment: comment || (isApproval ? 'Approved in workflow inbox' : 'Rejected in workflow inbox'),
          });
          setFeedback(`Offer package decision recorded as ${decision}.`);
          toastSuccess('Offer decision recorded', `Package marked as ${decision}.`);
          await loadAll();
        } catch (err) {
          const message = getErrorMessage(err, `Unable to record ${decision.toLowerCase()} decision`);
          setError(message);
          toastError(err, 'Unable to record offer decision');
        } finally {
          setBusyId(null);
          setConfirmDialog(initialConfirmState);
        }
      },
    });
  };

  const triggerFinalApproval = (hc: FinalHiringInboxItem) => {
    setConfirmDialog({
      isOpen: true,
      title: `Executive Final Hiring Signoff — ${hc.candidateName}`,
      description: `Grant final hiring authorization for ${hc.candidateName} for the position ${hc.positionTitle} at ${hc.branchName}. This authorizes candidate onboarding and locks the hiring case.`,
      confirmLabel: 'Grant Approve',
      tone: 'success',
      icon: 'check-circle',
      withComment: true,
      commentPlaceholder: 'Executive signoff comments or board authorization note...',
      action: async (comment?: string) => {
        setBusyId(hc.id);
        setError('');
        setFeedback('');
        try {
          await postApi(`/hiring/${hc.id}/final-approval`, {
            decision: 'Approved',
            comment: comment?.trim() || undefined,
          });
          setFeedback(`Final executive approval granted for ${hc.candidateName}.`);
          toastSuccess('Final approval granted', `${hc.candidateName} is authorized for onboarding.`);
          await loadAll();
        } catch (err) {
          const message = getErrorMessage(err, 'Unable to grant final approval');
          setError(message);
          toastError(err, 'Unable to grant final approval');
        } finally {
          setBusyId(null);
          setConfirmDialog(initialConfirmState);
        }
      },
    });
  };

  return (
    <PageFrame
      className="approval-inbox-page rf-approval-inbox-page"
      title="Approvals"
      description="Items waiting on your decision."
      actions={
        <Button variant="ghost" size="sm" onClick={() => void loadAll()}>
          <Icon name="refresh-cw" size={13} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      }
    >
      {error && (
        <Alert
          tone="danger"
          title="Unable to load approval inbox"
          action={
            <Button variant="secondary" size="sm" onClick={() => void loadAll()}>
              <Icon name="refresh-cw" size={13} />
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {feedback && (
        <Alert tone="success" title="Success">
          {feedback}
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {canApproveVacancies && (
          <button type="button" onClick={() => handleTabChange('vacancy-requests')} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${activeTab === 'vacancy-requests' ? 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300' : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'}`}>
            Vacancies
            <span className="text-slate-900 dark:text-white">{requests.length}</span>
          </button>
        )}
        {canApproveOffers && (
          <button type="button" onClick={() => handleTabChange('offers')} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${activeTab === 'offers' ? 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300' : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'}`}>
            Offers
            <span className="text-slate-900 dark:text-white">{offerApprovals.length}</span>
          </button>
        )}
        {canApproveFinalHires && (
          <button type="button" onClick={() => handleTabChange('final-hires')} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${activeTab === 'final-hires' ? 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300' : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'}`}>
            Hires
            <span className="text-slate-900 dark:text-white">{finalHires.length}</span>
          </button>
        )}
        <span className="text-xs text-slate-500">{totalPending} pending</span>
      </div>

      <DataToolbar
        className="rf-approval-toolbar"
        search={
          <Input
            placeholder="Search code, role, or candidate"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        }
      />

      {/* 1. Vacancy Requests Queue */}
      {canApproveVacancies && activeTab === 'vacancy-requests' && (
        <section className="rf-approval-queue flex flex-col gap-4">
          {isLoading ? (
            <PageState kind="loading" title="Loading requests" description="Checking your assigned vacancy approvals." />
          ) : filteredRequests.length === 0 ? (
            <PageState
              kind="empty"
              title={searchQuery ? 'No matching vacancy requests' : 'No pending vacancy requests'}
              description={searchQuery ? 'Try adjusting your search terms.' : 'Your vacancy request approval inbox is clear.'}
            />
          ) : (
            <div className="rf-approval-list grid grid-cols-1 gap-4" role="list" aria-label="Pending vacancy approval requests">
              {filteredRequests.map((request) => {
                const approval = currentApproval(request);
                const isCritical = request.criticality === 'High' || request.criticality === 'Urgent';
                return (
                  <div
                    key={request.id}
                    className="rf-approval-card rf-approval-card--vacancy relative overflow-hidden rounded-2xl border border-rf-border-subtle bg-rf-surface p-5 shadow-xs transition-all duration-200 hover:border-rf-action/40 hover:shadow-md group"
                  >
                    {/* Left Accent Gradient Strip */}
                    <div className="rf-approval-card__accent absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-rf-action to-blue-600 rounded-l-2xl" />

                    <div className="rf-approval-card__inner flex flex-col gap-4 pl-1">
                      {/* Top Header Row */}
                      <div className="rf-approval-card__header flex flex-wrap items-start justify-between gap-3">
                        <div className="rf-approval-card__identity flex items-center gap-3">
                          <div className="rf-approval-card__icon grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-rf-action/20 bg-rf-action-soft text-rf-action shadow-2xs">
                            <Icon name="vacancy" size={18} />
                          </div>
                          <div className="rf-approval-card__copy">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold text-rf-ink">{request.requestCode}</span>
                              <StatusBadge status={request.status} />
                              {request.criticality && (
                                <Badge variant={isCritical ? 'danger' : 'neutral'}>
                                  {request.criticality} Priority
                                </Badge>
                              )}
                            </div>
                            <h3 className="text-sm font-bold text-rf-ink m-0 mt-1">{getPositionLabel(request)}</h3>
                          </div>
                        </div>

                        {/* Step Pill */}
                        <div className="rf-approval-card__step inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rf-surface-subtle border border-rf-border-subtle text-[11.5px] font-bold text-rf-ink shadow-2xs">
                          <span className="rf-approval-card__step-dot h-2 w-2 rounded-full bg-rf-action " />
                          <span>Step {approval?.step || 1} · {formatApprovalRole(approval?.roleCode)}</span>
                        </div>
                      </div>

                      {/* Metadata Fact Grid */}
                      <div className="rf-approval-card__facts grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-rf-surface-subtle border border-rf-border-subtle text-xs">
                        <div className="flex flex-col">
                          <span className="text-[10.5px] font-semibold text-rf-ink-muted">Branch / Location</span>
                          <span className="font-bold text-rf-ink truncate mt-0.5">{getBranchLabel(request)}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10.5px] font-semibold text-rf-ink-muted">Requested Headcount</span>
                          <span className="font-bold text-rf-ink mt-0.5">{request.requestedHeadcount} {request.requestedHeadcount === 1 ? 'seat' : 'seats'}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10.5px] font-semibold text-rf-ink-muted">Employment Terms</span>
                          <span className="font-bold text-rf-ink truncate mt-0.5">{request.employmentType || 'Full-time'}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10.5px] font-semibold text-rf-ink-muted">Submitted Date</span>
                          <span className="font-bold text-rf-ink truncate mt-0.5">{formatApprovalDate(request.createdAt)}</span>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="rf-approval-card__footer flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-rf-border-subtle">
                        <div className="flex items-center gap-2 text-xs text-rf-ink-muted">
                          <Icon name="clock" size={13} className="text-rf-action" />
                          <span>Awaiting authorization from <strong className="text-rf-ink">{formatApprovalRole(approval?.roleCode, 'your role')}</strong></span>
                        </div>

                        <div className="rf-approval-card__decision flex items-center gap-2 shrink-0">
                          <Button variant="secondary" size="sm" asChild>
                            <Link to={`/vacancy-requests/${request.id}`}>
                              <Icon name="eye" size={13} />
                              Review
                            </Link>
                          </Button>
                          <Button
                            variant="success"
                            size="sm"
                            loading={busyId === request.id}
                            disabled={busyId !== null && busyId !== request.id}
                            loadingLabel="Approving"
                            onClick={() => triggerApproveVacancy(request)}
                          >
                            <Icon name="check-circle" size={13} />
                            Approve
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* 2. Offers Queue */}
      {canApproveOffers && activeTab === 'offers' && (
        <section className="rf-approval-queue flex flex-col gap-4">
          {isLoading ? (
            <PageState kind="loading" title="Loading offer approvals" description="Fetching pending offer packages." />
          ) : filteredOffers.length === 0 ? (
            <PageState
              kind="empty"
              title={searchQuery ? 'No matching offer approvals' : 'No pending offer approvals'}
              description={searchQuery ? 'Try adjusting your search terms.' : 'All offer packages have been actioned.'}
            />
          ) : (
            <div className="rf-approval-list grid grid-cols-1 gap-4" role="list" aria-label="Pending offer approval packages">
              {filteredOffers.map((oa, index) => (
                <div
                  key={oa.id ? `${oa.id}-${oa.step ?? index}` : index}
                  className="rf-approval-card rf-approval-card--offer relative overflow-hidden rounded-2xl border border-rf-border-subtle bg-rf-surface p-5 shadow-xs transition-all duration-200 hover:border-emerald-500/40 hover:shadow-md group"
                >
                  {/* Left Accent Gradient Strip */}
                  <div className="rf-approval-card__accent absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-emerald-500 to-teal-600 rounded-l-2xl" />

                  <div className="rf-approval-card__inner flex flex-col gap-4 pl-1">
                    {/* Top Header Row */}
                    <div className="rf-approval-card__header flex flex-wrap items-start justify-between gap-3">
                      <div className="rf-approval-card__identity flex items-center gap-3">
                        <div className="rf-approval-card__icon grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-500/20 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 shadow-2xs">
                          <Icon name="offer" size={18} />
                        </div>
                        <div className="rf-approval-card__copy">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-rf-ink">
                              {oa.offerCode || 'Offer Code'}
                            </span>
                            <StatusBadge status={oa.status} />
                            <Badge variant="info">
                              Version {oa.versionNumber}
                            </Badge>
                          </div>
                          <h3 className="text-sm font-bold text-rf-ink m-0 mt-1">
                            {oa.candidateName || 'Offer'}
                          </h3>
                        </div>
                      </div>

                      {/* Step Pill */}
                      <div className="rf-approval-card__step inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rf-surface-subtle border border-rf-border-subtle text-[11.5px] font-bold text-rf-ink shadow-2xs">
                        <span className="rf-approval-card__step-dot h-2 w-2 rounded-full bg-emerald-500 " />
                        <span>Step {oa.step} · {formatApprovalRole(oa.roleCode, 'Signoff')}</span>
                      </div>
                    </div>

                    {/* Metadata Fact Grid */}
                    <div className="rf-approval-card__facts grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-rf-surface-subtle border border-rf-border-subtle text-xs">
                      <div className="flex flex-col">
                        <span className="text-[10.5px] font-semibold text-rf-ink-muted">Signoff Role</span>
                        <span className="font-bold text-rf-ink truncate mt-0.5">{formatApprovalRole(oa.roleCode)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10.5px] font-semibold text-rf-ink-muted">Package Version</span>
                        <span className="font-bold text-rf-ink mt-0.5">Rev {oa.versionNumber}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10.5px] font-semibold text-rf-ink-muted">Workflow Status</span>
                        <span className="font-bold text-rf-ink truncate mt-0.5">{oa.status}</span>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="rf-approval-card__footer flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-rf-border-subtle">
                      <div className="flex items-center gap-2 text-xs text-rf-ink-muted">
                        <Icon name="clock" size={13} className="text-emerald-600" />
                        <span>Awaiting compensation approval from <strong className="text-rf-ink">{oa.roleCode}</strong></span>
                      </div>

                      <div className="rf-approval-card__decision flex items-center gap-2 shrink-0">
                        {oa.offerId && (
                          <Button variant="secondary" size="sm" asChild>
                            <Link to={`/offers/${oa.offerId}`}>
                              <Icon name="eye" size={13} />
                              Review
                            </Link>
                          </Button>
                        )}
                        <Button
                          variant="danger"
                          size="sm"
                          loading={busyId === oa.id}
                          disabled={busyId !== null && busyId !== oa.id}
                          onClick={() => triggerDecideOffer(oa, 'Rejected')}
                        >
                          Reject
                        </Button>
                        <Button
                          variant="success"
                          size="sm"
                          loading={busyId === oa.id}
                          disabled={busyId !== null && busyId !== oa.id}
                          loadingLabel="Approving"
                          onClick={() => triggerDecideOffer(oa, 'Approved')}
                        >
                          <Icon name="check-circle" size={13} />
                          Approve
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 3. Final Hires Queue */}
      {canApproveFinalHires && activeTab === 'final-hires' && (
        <section className="rf-approval-queue flex flex-col gap-4">
          {isLoading ? (
            <PageState kind="loading" title="Loading hiring cases" description="Fetching cases ready for final approval." />
          ) : filteredHires.length === 0 ? (
            <PageState
              kind="empty"
              title={searchQuery ? 'No matching hiring cases' : 'No cases pending final approval'}
              description={searchQuery ? 'Try adjusting your search terms.' : 'No hiring cases currently require executive signoff.'}
            />
          ) : (
            <div className="rf-approval-list grid grid-cols-1 gap-4" role="list" aria-label="Pending final hiring approval cases">
              {filteredHires.map((hc, index) => (
                <div
                  key={hc.id ? `${hc.id}-${index}` : index}
                  className="rf-approval-card rf-approval-card--hire relative overflow-hidden rounded-2xl border border-rf-border-subtle bg-rf-surface p-5 shadow-xs transition-all duration-200 hover:border-amber-500/40 hover:shadow-md group"
                >
                  {/* Left Accent Gradient Strip */}
                  <div className="rf-approval-card__accent absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-amber-500 to-yellow-600 rounded-l-2xl" />

                  <div className="rf-approval-card__inner flex flex-col gap-4 pl-1">
                    {/* Top Header Row */}
                    <div className="rf-approval-card__header flex flex-wrap items-start justify-between gap-3">
                      <div className="rf-approval-card__identity flex items-center gap-3">
                        <div className="rf-approval-card__icon grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-500/20 bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400 shadow-2xs">
                          <Icon name="hire" size={18} />
                        </div>
                        <div className="rf-approval-card__copy">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-rf-ink">{hc.candidateName}</span>
                            <StatusBadge status={hc.status} />
                            
                          </div>
                          <h3 className="text-xs font-semibold text-rf-ink-muted m-0 mt-0.5">
                            {hc.positionTitle} · {hc.branchName}
                          </h3>
                        </div>
                      </div>

                      {/* Step Pill */}
                      <div className="rf-approval-card__step inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rf-surface-subtle border border-rf-border-subtle text-[11.5px] font-bold text-rf-ink shadow-2xs">
                        <span className="rf-approval-card__step-dot h-2 w-2 rounded-full bg-amber-500 " />
                        <span>Final hire</span>
                      </div>
                    </div>

                    {/* Metadata Fact Grid */}
                    <div className="rf-approval-card__facts grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-rf-surface-subtle border border-rf-border-subtle text-xs">
                      <div className="flex flex-col">
                        <span className="text-[10.5px] font-semibold text-rf-ink-muted">Candidate</span>
                        <span className="font-bold text-rf-ink truncate mt-0.5">{hc.candidateName}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10.5px] font-semibold text-rf-ink-muted">Target Position</span>
                        <span className="font-bold text-rf-ink truncate mt-0.5">{hc.positionTitle}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10.5px] font-semibold text-rf-ink-muted">Location / Facility</span>
                        <span className="font-bold text-rf-ink truncate mt-0.5">{hc.branchName}</span>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="rf-approval-card__footer flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-rf-border-subtle">
                      <div className="flex items-center gap-2 text-xs text-rf-ink-muted">
                        <Icon name="check-circle" size={13} className="text-amber-600" />
                        <span>Pre-hire checks passed · Ready for executive clearance</span>
                      </div>

                      <div className="rf-approval-card__decision flex items-center gap-2 shrink-0">
                        <Button variant="secondary" size="sm" asChild>
                          <Link to={`/hires/${hc.id}`}>
                            <Icon name="eye" size={13} />
                            Review
                          </Link>
                        </Button>
                        <Button
                          variant="success"
                          size="sm"
                          loading={busyId === hc.id}
                          disabled={busyId !== null && busyId !== hc.id}
                          loadingLabel="Authorizing"
                          onClick={() => triggerFinalApproval(hc)}
                        >
                          <Icon name="check-circle" size={13} />
                          Approve
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Confirmation Action Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(initialConfirmState)}
        onConfirm={confirmDialog.action}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel}
        tone={confirmDialog.tone}
        icon={confirmDialog.icon}
        withComment={confirmDialog.withComment}
        commentPlaceholder={confirmDialog.commentPlaceholder}
        isLoading={busyId !== null}
      />
    </PageFrame>
  );
}
