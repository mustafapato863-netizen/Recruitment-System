import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { VacancyCoreContext, VacancyRequest } from '@recruitflow/contracts';
import { fetchApi, getApi, postApi } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { MetricCard } from '../components/ui/MetricCard';
import { DataToolbar } from '../components/ui/DataToolbar';
import { Input } from '../components/ui/Input';
import { Icon, type IconName } from '../components/Icon';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Tabs } from '../components/ui/Tabs';
import { useAuth } from '../auth/AuthContext';
import './PageEnhancementsV2.css';

interface OfferApprovalInboxItem {
  id: string;
  roleCode: string;
  status: string;
  step: number;
  offerVersion?: {
    id: string;
    offerId: string;
    versionNumber: number;
    offer?: {
      offerCode: string;
      candidateName?: string;
      positionTitle?: string;
      annualBaseSalary?: number;
      currency?: string;
    };
  };
}

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
  const { user } = useAuth();
  const canApproveVacancies = Boolean(user?.permissions.includes('VACANCY_REQUEST_APPROVE'));
  const canApproveOffers = Boolean(user?.permissions.includes('APPROVE_OFFERS'));
  const canApproveFinalHires = Boolean(user?.permissions.includes('FINAL_HIRING_APPROVAL'));

  const [activeTab, setActiveTab] = useState<TabType>('vacancy-requests');
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
      setRequests(vrRes ?? []);
      setOfferApprovals(offRes ?? []);
      setFinalHires(hireRes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the approval inbox');
    } finally {
      setIsLoading(false);
    }
  }, [canApproveFinalHires, canApproveOffers, canApproveVacancies]);

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
        o.offerVersion?.offer?.offerCode?.toLowerCase().includes(q) ||
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
          await loadAll();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Unable to approve this request');
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
      title: isApproval ? `Approve Offer Package ${oa.offerVersion?.offer?.offerCode || ''}` : `Reject Offer Package ${oa.offerVersion?.offer?.offerCode || ''}`,
      description: isApproval
        ? `Granting compensation signoff for Version ${oa.offerVersion?.versionNumber || 1}. The package will advance to candidate delivery upon final signoff.`
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
          await loadAll();
        } catch (err) {
          setError(err instanceof Error ? err.message : `Unable to record ${decision.toLowerCase()} decision`);
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
      confirmLabel: 'Grant Final Signoff',
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
          await loadAll();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Unable to grant final approval');
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
      eyebrow="Workflow Operations"
      title="Universal Approval Inbox"
      description="Review the pending approval queues authorized for your active profile."
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

      <section className="rf-approval-overview" aria-labelledby="rf-approval-overview-title">
        <div className="rf-approval-overview__header">
          <div>
            <div className="rf-approval-overview__eyebrow">Decision control</div>
            <h2 id="rf-approval-overview-title">What needs your authority</h2>
            <p>Prioritize the work waiting on your approval, then open the full record only when context is needed.</p>
          </div>
          <div className={['rf-approval-overview__signal', totalPending === 0 ? 'is-clear' : ''].filter(Boolean).join(' ')}>
            <span className="rf-approval-overview__signal-dot" aria-hidden="true" />
            <span>{totalPending === 0 ? 'Queue is clear' : `${totalPending} pending ${totalPending === 1 ? 'decision' : 'decisions'}`}</span>
          </div>
        </div>

        <div className="rf-approval-metrics">
        <MetricCard
          label="Total Pending Action"
          value={totalPending}
          detail="Queued authorizations"
          tone="action"
          icon={<Icon name="inbox" size={15} />}
        />
        <MetricCard
          label="Vacancy Requests"
          value={requests.length}
          detail="Requisition signoffs"
          tone="info"
          icon={<Icon name="vacancy" size={15} />}
        />
        <MetricCard
          label="Offer Signoffs"
          value={offerApprovals.length}
          detail="Compensation packages"
          tone="success"
          icon={<Icon name="offer" size={15} />}
        />
        <MetricCard
          label="Executive Clearances"
          value={finalHires.length}
          detail="Final hiring gates"
          tone="warning"
          icon={<Icon name="hire" size={15} />}
        />
        </div>
      </section>

      <section className="rf-approval-workspace" aria-labelledby="rf-approval-workspace-title">
        <header className="rf-approval-workspace__header">
          <div>
            <div className="rf-approval-workspace__eyebrow">Your decision queue</div>
            <h2 id="rf-approval-workspace-title">Pending approvals</h2>
            <p>Review requests in the order they require your attention.</p>
          </div>
          <span className="rf-approval-workspace__count">{totalPending} pending</span>
        </header>

      <Tabs
        className="rf-approval-tabs"
        ariaLabel="Inbox Tabs"
        activeKey={activeTab}
        onChange={(key) => {
          setActiveTab(key as TabType);
          setSearchQuery('');
        }}
        items={[
          ...(canApproveVacancies ? [{ key: 'vacancy-requests', label: `Vacancy Requests (${requests.length})` }] : []),
          ...(canApproveOffers ? [{ key: 'offers', label: `Offer Approvals (${offerApprovals.length})` }] : []),
          ...(canApproveFinalHires ? [{ key: 'final-hires', label: `Final Hires (${finalHires.length})` }] : []),
        ]}
      />

      <DataToolbar
        className="rf-approval-toolbar"
        search={
          <Input
            placeholder="Search this queue by code, role, candidate, or branch..."
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
            <div className="rf-approval-list grid grid-cols-1 gap-4">
              {filteredRequests.map((request) => {
                const approval = currentApproval(request);
                const isCritical = request.criticality === 'High' || request.criticality === 'Urgent';
                return (
                  <div
                    key={request.id}
                    className="rf-approval-card rf-approval-card--vacancy relative overflow-hidden rounded-2xl border border-rf-border-subtle bg-rf-surface p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-rf-action/40 hover:shadow-md group"
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
                          <span className="rf-approval-card__step-dot h-2 w-2 rounded-full bg-rf-action animate-pulse" />
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
                              Review Details
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
                            Approve Requisition
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
            <div className="rf-approval-list grid grid-cols-1 gap-4">
              {filteredOffers.map((oa) => (
                <div
                  key={oa.id}
                  className="rf-approval-card rf-approval-card--offer relative overflow-hidden rounded-2xl border border-rf-border-subtle bg-rf-surface p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-md group"
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
                              {oa.offerVersion?.offer?.offerCode || 'Offer Code'}
                            </span>
                            <StatusBadge status={oa.status} />
                            <Badge variant="info">
                              Version {oa.offerVersion?.versionNumber ?? 1}
                            </Badge>
                          </div>
                          <h3 className="text-sm font-bold text-rf-ink m-0 mt-1">
                            {oa.offerVersion?.offer?.candidateName ? `Offer Package for ${oa.offerVersion.offer.candidateName}` : 'Compensation Signoff'}
                          </h3>
                        </div>
                      </div>

                      {/* Step Pill */}
                      <div className="rf-approval-card__step inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rf-surface-subtle border border-rf-border-subtle text-[11.5px] font-bold text-rf-ink shadow-2xs">
                        <span className="rf-approval-card__step-dot h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
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
                        <span className="font-bold text-rf-ink mt-0.5">Rev {oa.offerVersion?.versionNumber || 1}</span>
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
                        {oa.offerVersion?.offerId && (
                          <Button variant="secondary" size="sm" asChild>
                            <Link to={`/offers/${oa.offerVersion.offerId}`}>
                              <Icon name="eye" size={13} />
                              Review Offer
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
                          Approve Package
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
            <div className="rf-approval-list grid grid-cols-1 gap-4">
              {filteredHires.map((hc) => (
                <div
                  key={hc.id}
                  className="rf-approval-card rf-approval-card--hire relative overflow-hidden rounded-2xl border border-rf-border-subtle bg-rf-surface p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-500/40 hover:shadow-md group"
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
                            <Badge variant="success">Compliance Verified</Badge>
                          </div>
                          <h3 className="text-xs font-semibold text-rf-ink-muted m-0 mt-0.5">
                            {hc.positionTitle} · {hc.branchName}
                          </h3>
                        </div>
                      </div>

                      {/* Step Pill */}
                      <div className="rf-approval-card__step inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rf-surface-subtle border border-rf-border-subtle text-[11.5px] font-bold text-rf-ink shadow-2xs">
                        <span className="rf-approval-card__step-dot h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                        <span>Executive Hiring Gate</span>
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
                            View Full Case
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
                          Final Signoff
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

      </section>

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
