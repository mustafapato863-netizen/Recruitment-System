import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import type { VacancyCoreContext, VacancyRequest } from '@recruitflow/contracts';
import { fetchApi } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { Icon, type IconName } from '../components/Icon';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ActivityTimeline } from '../components/ui/ActivityTimeline';
import { BorderGlow } from '../components/ui/BorderGlow';
import './PageEnhancementsV2.css';

interface ConfirmState {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone: 'primary' | 'success' | 'danger' | 'warning';
  icon?: IconName;
  withComment?: boolean;
  commentPlaceholder?: string;
  commentRequired?: boolean;
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

export function VacancyRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [request, setRequest] = useState<VacancyRequest | null>(null);
  const [context, setContext] = useState<VacancyCoreContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState>(initialConfirmState);

  const load = async () => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    try {
      const [reqData, ctxData] = await Promise.allSettled([
        fetchApi<VacancyRequest>(`/vacancy-requests/${id}`),
        fetchApi<VacancyCoreContext>('/vacancy-requests/context'),
      ]);

      if (reqData.status === 'fulfilled') {
        setRequest(reqData.value);
      } else {
        throw reqData.reason;
      }

      if (ctxData.status === 'fulfilled') {
        setContext(ctxData.value);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load this vacancy request');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  const positionTitle = useMemo(() => {
    if (!request) return 'Position';
    return (
      context?.positions?.find((p) => p.id === request.positionId)?.title ??
      (context?.position?.id === request.positionId ? context.position.title : request.positionId)
    );
  }, [request, context]);

  const branchName = useMemo(() => {
    if (!request) return 'Main Branch';
    return (
      context?.branches?.find((b) => b.id === request.branchId)?.name ??
      (context?.branch?.id === request.branchId ? context.branch.name : request.branchId)
    );
  }, [request, context]);

  const runAction = async (action: 'approve' | 'request-changes' | 'reject' | 'cancel', commentText?: string) => {
    if (!request || !id) return;
    setBusyAction(action);
    setError('');
    setFeedback('');
    try {
      await fetchApi(`/vacancy-requests/${id}/${action}`, {
        method: 'POST',
        body: action === 'cancel' ? undefined : JSON.stringify({ comment: commentText || undefined }),
      });
      setFeedback(`Requisition ${action.replace('-', ' ')} executed successfully.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update this request');
    } finally {
      setBusyAction(null);
      setConfirmDialog(initialConfirmState);
    }
  };

  const triggerApprove = () => {
    if (!request) return;
    setConfirmDialog({
      isOpen: true,
      title: `Approve Requisition ${request.requestCode}`,
      description: `Authorizing headcount allocation of ${request.requestedHeadcount} position(s). This will advance the requisition to the next approval step or mark it ready for active vacancy creation.`,
      confirmLabel: 'Approve Requisition',
      tone: 'success',
      icon: 'check-circle',
      withComment: true,
      commentPlaceholder: 'Optional approval notes, budget code or comments...',
      action: async (comment) => runAction('approve', comment),
    });
  };

  const triggerReject = () => {
    if (!request) return;
    setConfirmDialog({
      isOpen: true,
      title: `Reject Requisition ${request.requestCode}`,
      description: `Are you sure you want to reject this request? The hiring manager will be notified with the reason provided.`,
      confirmLabel: 'Reject Requisition',
      tone: 'danger',
      icon: 'alert-triangle',
      withComment: true,
      commentRequired: true,
      commentPlaceholder: 'Provide mandatory justification for requisition rejection...',
      action: async (comment) => runAction('reject', comment),
    });
  };

  const triggerRequestChanges = () => {
    if (!request) return;
    setConfirmDialog({
      isOpen: true,
      title: `Request Changes on ${request.requestCode}`,
      description: `Return this requisition to the hiring requester for adjustments before final sign-off.`,
      confirmLabel: 'Request Modifications',
      tone: 'warning',
      icon: 'alert-triangle',
      withComment: true,
      commentRequired: true,
      commentPlaceholder: 'Describe the required changes or budget adjustments needed...',
      action: async (comment) => runAction('request-changes', comment),
    });
  };

  const triggerCancel = () => {
    if (!request) return;
    setConfirmDialog({
      isOpen: true,
      title: `Cancel Requisition ${request.requestCode}`,
      description: `Cancelling will withdraw this requisition from the active review queue. This cannot be undone.`,
      confirmLabel: 'Cancel Requisition',
      tone: 'danger',
      icon: 'close',
      action: async () => runAction('cancel'),
    });
  };

  const submitForApproval = async () => {
    if (!id) return;
    setBusyAction('submit');
    setError('');
    setFeedback('');
    try {
      await fetchApi(`/vacancy-requests/${id}/submit`, { method: 'POST', body: JSON.stringify({}) });
      setFeedback('Requisition submitted for approval successfully.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit requisition');
    } finally {
      setBusyAction(null);
    }
  };

  const convertToVacancy = async () => {
    if (!id) return;
    setBusyAction('convert');
    setError('');
    setFeedback('');
    try {
      const res = await fetchApi<{ vacancy: { id: string; vacancyCode: string } }>(`/vacancy-requests/${id}/convert`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setFeedback(`Requisition converted to active vacancy ${res.vacancy?.vacancyCode ?? ''}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to convert request to vacancy');
    } finally {
      setBusyAction(null);
    }
  };

  if (isLoading) {
    return (
      <PageFrame eyebrow="Vacancy Requests" title="Requisition Details" description="Review workforce request demand and approval timeline.">
        <PageState kind="loading" title="Loading requisition details" description="Fetching specifications and approval gates." />
      </PageFrame>
    );
  }

  if (error && !request) {
    return (
      <PageFrame eyebrow="Vacancy Requests" title="Requisition Details" description="Review workforce request demand and approval timeline.">
        <PageState
          kind="error"
          title="Unable to load requisition"
          description={error}
          actionLabel="Retry"
          onAction={() => void load()}
        />
      </PageFrame>
    );
  }

  if (!request) return null;

  const canSubmit = request.status === 'Draft' || request.status === 'Changes Requested';
  const canDecide = request.status === 'Pending Approval';
  const canCancel = request.status === 'Draft' || request.status === 'Pending Approval' || request.status === 'Changes Requested';
  const canConvert = request.status === 'Approved';

  return (
    <PageFrame
      eyebrow={`VACANCY REQUESTS / ${request.requestCode}`}
      title={`Requisition ${request.requestCode}`}
      description={`Created on ${new Date(request.createdAt).toLocaleDateString()} · Last modified ${new Date(request.updatedAt).toLocaleDateString()}`}
      actions={
        <div className="flex items-center gap-2.5 flex-wrap">
          <StatusBadge status={request.status} />
          <Button variant="ghost" size="sm" onClick={() => navigate('/vacancy-requests')}>
            <Icon name="arrow-left" size={13} />
            Back to Requests
          </Button>
          {canCancel && (
            <Button
              variant="danger"
              size="sm"
              loading={busyAction === 'cancel'}
              loadingLabel="Cancelling"
              onClick={triggerCancel}
            >
              Cancel Request
            </Button>
          )}
          {canSubmit && (
            <Button
              variant="primary"
              size="sm"
              loading={busyAction === 'submit'}
              loadingLabel="Submitting"
              onClick={() => void submitForApproval()}
            >
              <Icon name="send" size={13} />
              Submit for Approval
            </Button>
          )}
          {canConvert && (
            <Button
              variant="success"
              size="sm"
              loading={busyAction === 'convert'}
              loadingLabel="Converting"
              onClick={() => void convertToVacancy()}
            >
              <Icon name="check-circle" size={14} />
              Convert to Active Vacancy
            </Button>
          )}
        </div>
      }
    >
      {error && (
        <Alert tone="danger" title="Action Failed" className="mb-4">
          {error}
        </Alert>
      )}

      {feedback && (
        <Alert tone="success" title="Success" className="mb-4">
          {feedback}
        </Alert>
      )}

      {/* Enhanced Hero Requisition Banner */}
      <div className="rounded-2xl border border-rf-border-subtle bg-rf-surface p-5 sm:p-6 shadow-xs mb-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rf-action-soft text-rf-action flex items-center justify-center shrink-0 shadow-2xs border border-rf-action/15">
              <Icon name="file-text" size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-md text-xs font-black text-rf-action bg-rf-action-soft border border-rf-action/20">
                  {request.requestCode}
                </span>
                <h1 className="text-xl sm:text-2xl font-rf-heading font-black text-rf-ink m-0 tracking-tight">
                  {positionTitle}
                </h1>
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs font-medium text-rf-ink-muted flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-rf-ink">
                  <Icon name="building" size={13} className="text-rf-ink-muted" />
                  {branchName}
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="folder" size={13} className="text-rf-ink-muted" />
                  {request.reason || 'New Position Demand'}
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="clock" size={13} className="text-rf-ink-muted" />
                  Created {new Date(request.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rf-ink-muted">Workflow State</span>
              <div className="mt-1">
                <StatusBadge status={request.status} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Premium 21st.dev Style Metric Cards (Enhanced user section) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Card 1: Headcount */}
        <BorderGlow
          borderRadius={16}
          colors={['var(--color-action)', 'var(--color-action-focus)', 'var(--color-info)']}
          className="h-full shadow-2xs hover:shadow-xs transition-all"
        >
          <div className="p-5 flex flex-col justify-between h-full bg-rf-surface rounded-2xl">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rf-ink-muted">
                Headcount
              </span>
              <div className="w-9 h-9 rounded-xl bg-rf-action-soft text-rf-action flex items-center justify-center shadow-2xs">
                <Icon name="users" size={17} />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-rf-heading font-black text-rf-ink tabular-nums leading-tight block">
                {request.requestedHeadcount} {request.requestedHeadcount === 1 ? 'Position' : 'Positions'}
              </span>
              <span className="text-[11px] font-medium text-rf-ink-muted mt-1 inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rf-action inline-block" />
                Approved allocation target
              </span>
            </div>
          </div>
        </BorderGlow>

        {/* Card 2: Employment Type */}
        <BorderGlow
          borderRadius={16}
          colors={['var(--color-info)', 'var(--color-action)', 'var(--color-info-focus)']}
          className="h-full shadow-2xs hover:shadow-xs transition-all"
        >
          <div className="p-5 flex flex-col justify-between h-full bg-rf-surface rounded-2xl">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rf-ink-muted">
                Employment
              </span>
              <div className="w-9 h-9 rounded-xl bg-rf-info-soft text-rf-info flex items-center justify-center shadow-2xs">
                <Icon name="briefcase" size={17} />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-rf-heading font-black text-rf-ink leading-tight block">
                {request.employmentType || 'Full-time'}
              </span>
              <span className="text-[11px] font-medium text-rf-ink-muted mt-1 inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rf-info inline-block" />
                Standard corporate terms
              </span>
            </div>
          </div>
        </BorderGlow>

        {/* Card 3: Priority */}
        <BorderGlow
          borderRadius={16}
          colors={['var(--color-warning)', 'var(--color-warning-strong)', 'var(--color-warning-soft)']}
          className="h-full shadow-2xs hover:shadow-xs transition-all"
        >
          <div className="p-5 flex flex-col justify-between h-full bg-rf-surface rounded-2xl">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rf-ink-muted">
                Priority
              </span>
              <div className="w-9 h-9 rounded-xl bg-rf-warning-soft text-rf-warning flex items-center justify-center shadow-2xs">
                <Icon name="alert-triangle" size={17} />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-rf-heading font-black text-rf-ink leading-tight block">
                {request.criticality || 'Normal'}
              </span>
              <span className="text-[11px] font-medium text-rf-warning mt-1 inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rf-warning inline-block" />
                {request.criticality === 'Critical' ? 'Immediate SLA priority' : 'Standard 30d SLA'}
              </span>
            </div>
          </div>
        </BorderGlow>

        {/* Card 4: Target Start Date */}
        <BorderGlow
          borderRadius={16}
          colors={['var(--color-success)', 'var(--color-success-strong)', 'var(--color-success-soft)']}
          className="h-full shadow-2xs hover:shadow-xs transition-all"
        >
          <div className="p-5 flex flex-col justify-between h-full bg-rf-surface rounded-2xl">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rf-ink-muted">
                Target Start
              </span>
              <div className="w-9 h-9 rounded-xl bg-rf-success-soft text-rf-success flex items-center justify-center shadow-2xs">
                <Icon name="calendar" size={17} />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-rf-heading font-black text-rf-ink leading-tight block truncate">
                {request.targetStartDate ? new Date(request.targetStartDate).toLocaleDateString() : 'Flexible'}
              </span>
              <span className="text-[11px] font-medium text-rf-success mt-1 inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rf-success inline-block" />
                Expected onboarding
              </span>
            </div>
          </div>
        </BorderGlow>
      </div>

      {/* Main Content Layout: Specifications vs Workflow Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Specifications (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <section className="rounded-2xl border border-rf-border-subtle bg-rf-surface p-5 sm:p-6 shadow-xs">
            <div className="pb-3 border-b border-rf-border-subtle mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-rf-ink m-0">Requisition Specifications</h3>
                <p className="text-xs text-rf-ink-muted font-medium m-0 mt-0.5">
                  Detailed workforce demand specifications and business context.
                </p>
              </div>
              <span className="text-[11px] font-black text-rf-action bg-rf-action-soft px-3 py-1 rounded-full border border-rf-action/20">
                {request.budgetStatus || 'Budgeted'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl border border-rf-border-subtle bg-rf-surface-subtle/30">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rf-ink-muted block">Position Title</span>
                <span className="text-sm font-bold text-rf-ink mt-1 block">{positionTitle}</span>
              </div>

              <div className="p-3.5 rounded-xl border border-rf-border-subtle bg-rf-surface-subtle/30">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rf-ink-muted block">Branch / Location</span>
                <span className="text-sm font-bold text-rf-ink mt-1 block">{branchName}</span>
              </div>

              <div className="p-3.5 rounded-xl border border-rf-border-subtle bg-rf-surface-subtle/30">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rf-ink-muted block">Requisition Reason</span>
                <span className="text-sm font-bold text-rf-ink mt-1 block">{request.reason || 'New Position'}</span>
              </div>

              <div className="p-3.5 rounded-xl border border-rf-border-subtle bg-rf-surface-subtle/30">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rf-ink-muted block">Budget Allocation</span>
                <span className="text-sm font-bold text-rf-ink mt-1 block">{request.budgetStatus || 'Budgeted'}</span>
              </div>

              <div className="sm:col-span-2 pt-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rf-ink-muted block mb-1.5">
                  Business Justification & Impact
                </span>
                <div className="text-xs text-rf-ink font-medium leading-relaxed bg-rf-surface-subtle/70 p-4 rounded-xl border border-rf-border-subtle relative">
                  {request.justification ? (
                    <p className="m-0 whitespace-pre-wrap">{request.justification}</p>
                  ) : (
                    <span className="text-rf-ink-muted italic">No detailed justification provided.</span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Quick Action Navigation Bar */}
          <div className="rounded-2xl border border-rf-border-subtle bg-rf-surface p-5 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rf-action-soft text-rf-action flex items-center justify-center shadow-2xs">
                <Icon name="inbox" size={18} />
              </div>
              <div>
                <strong className="text-xs font-bold text-rf-ink block">Looking for approval queues?</strong>
                <span className="text-[11px] text-rf-ink-muted">View all pending requisitions and batch decisions.</span>
              </div>
            </div>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/approval-inbox">Go to Approval Inbox</Link>
            </Button>
          </div>
        </div>

        {/* Right Column: Approval Timeline & Action Gate (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Approval Sign-off Gate Card */}
          <section className="rounded-2xl border border-rf-border-subtle bg-rf-surface p-5 shadow-xs">
            <div className="pb-3 border-b border-rf-border-subtle mb-4">
              <h3 className="text-sm font-bold text-rf-ink m-0">Approval Workflow</h3>
              <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">Sequential stakeholder evaluation logs.</p>
            </div>

            {request.approvals.length === 0 ? (
              <div className="p-5 text-center rounded-xl bg-rf-surface-subtle border border-rf-border-subtle text-xs text-rf-ink-muted font-medium">
                Approval steps will be activated upon submission.
              </div>
            ) : (
              <ActivityTimeline
                items={request.approvals.map((approval) => ({
                  id: approval.id,
                  title: `${approval.roleCode} — ${approval.status}`,
                  timestamp: approval.decidedAt ? new Date(approval.decidedAt).toLocaleString() : 'Pending decision',
                  tone:
                    approval.status === 'Approved'
                      ? 'success'
                      : approval.status === 'Rejected'
                        ? 'danger'
                        : approval.status === 'Changes Requested'
                          ? 'warning'
                          : 'action',
                  description: approval.comment ? `Step ${approval.step} · "${approval.comment}"` : `Approval Gate ${approval.step}`,
                }))}
              />
            )}
          </section>

          {/* Decision Gate Actions when Pending Decision */}
          {canDecide && (
            <section className="rounded-2xl border border-rf-border-subtle bg-rf-surface p-5 shadow-xs">
              <div className="pb-3 border-b border-rf-border-subtle mb-4">
                <h3 className="text-sm font-bold text-rf-ink m-0">Requisition Decision Gate</h3>
                <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">Authorize, request revisions or reject this requisition.</p>
              </div>
              <div className="flex flex-col gap-2.5">
                <Button
                  variant="success"
                  size="sm"
                  className="w-full justify-center shadow-xs"
                  loading={busyAction === 'approve'}
                  loadingLabel="Approving..."
                  onClick={triggerApprove}
                >
                  <Icon name="check-circle" size={14} />
                  Approve Requisition
                </Button>
                <Button
                  variant="warning"
                  size="sm"
                  className="w-full justify-center shadow-xs"
                  loading={busyAction === 'request-changes'}
                  loadingLabel="Requesting modifications..."
                  onClick={triggerRequestChanges}
                >
                  <Icon name="edit" size={14} />
                  Request Modifications
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  className="w-full justify-center shadow-xs"
                  loading={busyAction === 'reject'}
                  loadingLabel="Rejecting..."
                  onClick={triggerReject}
                >
                  <Icon name="close" size={14} />
                  Reject Requisition
                </Button>
              </div>
            </section>
          )}
        </div>
      </div>

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
        commentRequired={confirmDialog.commentRequired}
        commentPlaceholder={confirmDialog.commentPlaceholder}
        isLoading={busyAction !== null}
      />
    </PageFrame>
  );
}

export default VacancyRequestDetailPage;
