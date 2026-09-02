import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getApi, patchApi, postApi } from '../api/client';
import type { HiringCase, ComplianceStatus } from '@recruitflow/contracts';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { ResponsiveDataView } from '../components/ui/ResponsiveDataView';
import { ActivityTimeline } from '../components/ui/ActivityTimeline';
import { ProgressBar } from '../components/ui/ProgressBar';
import { StatusBadge } from '../components/StatusBadge';
import { Icon, type IconName } from '../components/Icon';
import { ConfirmDialog } from '../components/ConfirmDialog';
import './PageEnhancementsV2.css';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
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

export function HiringCasePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [hiringCase, setHiringCase] = useState<HiringCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState>(initialConfirmState);

  const loadCase = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setHiringCase(await getApi<HiringCase>(`/hiring/${id}`));
    } catch (reason: unknown) {
      setError(getErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCase();
  }, [id]);

  const submitForApproval = async () => {
    if (!id) return;
    setBusyAction('submit');
    setError(null);
    setActionMessage(null);
    try {
      await postApi(`/hiring/${id}/submit`);
      setActionMessage('Hiring case submitted for final approval.');
      await loadCase();
    } catch (reason: unknown) {
      setError(getErrorMessage(reason));
    } finally {
      setBusyAction(null);
    }
  };

  const handleUpdateCompliance = async (reqId: string, status: ComplianceStatus) => {
    if (!id) return;
    setBusyAction(reqId);
    setError(null);
    setActionMessage(null);
    try {
      await patchApi(`/hiring/${id}/compliance/${reqId}`, { status });
      setActionMessage(`Requirement marked as ${status}.`);
      await loadCase();
    } catch (reason: unknown) {
      setError(getErrorMessage(reason));
    } finally {
      setBusyAction(null);
    }
  };

  const triggerFinalApproval = (decision: 'Approve' | 'Reject') => {
    if (!id || !hiringCase) return;
    const isApprove = decision === 'Approve';
    setConfirmDialog({
      isOpen: true,
      title: isApprove ? `Grant Final Hiring Approval — ${hiringCase.candidateName ?? '—'}` : `Reject Hiring Case — ${hiringCase.candidateName ?? '—'}`,
      description: isApprove
        ? `Authorizing final hire for ${hiringCase.candidateName ?? '—'} for ${hiringCase.positionTitle ?? '—'}. This will move the case to Awaiting Joining status.`
        : `Rejecting this hiring case will halt candidate onboarding.`,
      confirmLabel: isApprove ? 'Grant Approval' : 'Reject Case',
      tone: isApprove ? 'success' : 'danger',
      icon: isApprove ? 'check-circle' : 'alert-triangle',
      withComment: true,
      commentPlaceholder: isApprove ? 'Optional executive approval notes...' : 'Reason for rejection...',
      action: async (comment?: string) => {
        setBusyAction(decision);
        setError(null);
        setActionMessage(null);
        try {
          await postApi(`/hiring/${id}/final-approval`, { decision, comment });
          setActionMessage(`Final approval ${decision.toLowerCase()}d successfully.`);
          await loadCase();
        } catch (reason: unknown) {
          setError(getErrorMessage(reason));
        } finally {
          setBusyAction(null);
          setConfirmDialog(initialConfirmState);
        }
      },
    });
  };

  const triggerConfirmJoining = () => {
    if (!id || !hiringCase) return;
    setConfirmDialog({
      isOpen: true,
      title: `Confirm Candidate Joining — ${hiringCase.candidateName ?? '—'}`,
      description: `Confirm that ${hiringCase.candidateName ?? '—'} has reported for work. This will automatically update the vacancy filled headcount.`,
      confirmLabel: 'Confirm Joining',
      tone: 'success',
      icon: 'check-circle',
      action: async () => {
        setBusyAction('joining');
        setError(null);
        setActionMessage(null);
        try {
          await postApi(`/hiring/${id}/joining`, {
            status: 'Joined',
            actualJoiningDate: new Date().toISOString(),
          });
          setActionMessage('Candidate confirmed as Joined. Vacancy headcount has been atomically incremented.');
          await loadCase();
        } catch (reason: unknown) {
          setError(getErrorMessage(reason));
        } finally {
          setBusyAction(null);
          setConfirmDialog(initialConfirmState);
        }
      },
    });
  };

  if (loading) {
    return (
      <PageFrame eyebrow="Hiring Cases" title="Hiring Case Details" description="Loading case...">
        <PageState kind="loading" title="Loading hiring case" description="Fetching pre-hire readiness checklist." />
      </PageFrame>
    );
  }

  if (error || !hiringCase) {
    const isForbidden = error?.toLowerCase().includes('denied') || error?.toLowerCase().includes('permission') || error?.includes('403');
    return (
      <PageFrame eyebrow="Hiring Cases" title="Hiring Case Details" description="Pre-hire readiness gate.">
        {isForbidden ? (
          <PageState
            kind="forbidden"
            title="Access Restricted"
            description="You do not have the required permissions to view this hiring case."
            actionLabel="Back to Hiring Cases"
            onAction={() => navigate('/hires')}
          />
        ) : (
          <PageState
            kind="empty"
            title="Hiring Case Not Found"
            description="The requested hiring case record does not exist or has been removed."
            actionLabel="Back to Hiring Cases"
            onAction={() => navigate('/hires')}
          />
        )}
      </PageFrame>
    );
  }

  const requirements = hiringCase.complianceRequirements ?? [];
  const requiredCount = requirements.filter((item) => item.isRequired).length;
  const verifiedCount = requirements.filter((item) => item.isRequired && ['Verified', 'Not Required'].includes(item.status)).length;
  const isReady = requiredCount > 0 ? requiredCount === verifiedCount : true;

  const compliancePercentage = requirements.length === 0 ? 100 : Math.round((requirements.filter(r => ['Verified', 'Not Required'].includes(r.status)).length / requirements.length) * 100);
  const complianceTone = compliancePercentage >= 80 ? 'success' : compliancePercentage >= 50 ? 'warning' : 'danger';

  const approvalTimelineItems: Array<{ id: string; title: string; timestamp: string; actor?: string; tone: 'action' | 'success' | 'warning' | 'danger' | 'neutral'; description?: string }> = hiringCase.approvals && hiringCase.approvals.length > 0
    ? hiringCase.approvals.map((app) => ({
        id: app.id,
        title: `${app.roleCode} — ${app.status}`,
        timestamp: app.decidedAt ? new Date(app.decidedAt).toLocaleString() : 'Pending',
        actor: app.approverName || 'Approver',
        tone: (app.status === 'Approved' ? 'success' : app.status === 'Rejected' ? 'danger' : 'warning') as 'success' | 'danger' | 'warning',
        description: app.comment || undefined,
      }))
    : [{
        id: 'created',
        title: 'Hiring Case Created',
        timestamp: new Date(hiringCase.createdAt).toLocaleString(),
        tone: 'success',
      }];

  return (
    <PageFrame
      eyebrow={`Hiring Cases / ${hiringCase.id.slice(0, 8).toUpperCase()}`}
      title={`${hiringCase.candidateName ?? '—'} · Pre-Hire Gate`}
      description={`${hiringCase.positionTitle ?? '—'} · ${hiringCase.branchName ?? '—'} · Status: ${hiringCase.status}`}
      actions={
        <>
          <StatusBadge status={hiringCase.status} />
          <Button variant="ghost" size="sm" asChild>
            <Link to="/hires">
              <Icon name="arrow-left" size={13} />
              Back to cases
            </Link>
          </Button>
          {hiringCase.status === 'Pending Compliance' && (
            <Button
              variant="primary"
              size="sm"
              loading={busyAction === 'submit'}
              loadingLabel="Submitting"
              disabled={!isReady}
              onClick={() => void submitForApproval()}
            >
              <Icon name="check-circle" size={14} />
              Submit for final approval
            </Button>
          )}
          {hiringCase.status === 'Pending Final Approval' && (
            <>
              <Button
                variant="danger"
                size="sm"
                loading={busyAction === 'Reject'}
                loadingLabel="Rejecting"
                onClick={() => triggerFinalApproval('Reject')}
              >
                Reject Hire
              </Button>
              <Button
                variant="success"
                size="sm"
                loading={busyAction === 'Approve'}
                loadingLabel="Approving"
                onClick={() => triggerFinalApproval('Approve')}
              >
                <Icon name="check-circle" size={14} />
                Grant Final Approval
              </Button>
            </>
          )}
          {hiringCase.status === 'Awaiting Joining' && (
            <Button
              variant="success"
              size="sm"
              loading={busyAction === 'joining'}
              loadingLabel="Confirming"
              onClick={triggerConfirmJoining}
            >
              <Icon name="check-circle" size={14} />
              Confirm Candidate Joined
            </Button>
          )}
        </>
      }
    >
      {actionMessage && (
        <Alert tone="success" title="Success">
          {actionMessage}
        </Alert>
      )}

      {!isReady && hiringCase.status === 'Pending Compliance' && (
        <Alert tone="warning" title="Readiness checklist pending">
          All mandatory compliance items and background checks must be verified before final approval submission.
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Compliance Progress Bar */}
          <section className="rf-panel rounded-2xl border border-rf-border-subtle/90 bg-white p-5 shadow-xs">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xs font-bold text-rf-ink m-0">Pre-Hire Compliance Progress</h3>
              <span className="text-xs font-bold text-rf-ink">{compliancePercentage}%</span>
            </div>
            <ProgressBar value={compliancePercentage} max={100} tone={complianceTone} />
          </section>

          {/* Compliance Checklist */}
          <section className="rf-table-shell overflow-hidden rounded-2xl border border-rf-border-subtle/90 bg-white shadow-xs">
            <div className="p-4 border-b border-rf-border-subtle bg-rf-surface-subtle/50">
              <h3 className="text-xs font-bold text-rf-ink m-0">Pre-Hire Compliance Checklist</h3>
              <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">Verification of critical prerequisites before joining.</p>
            </div>
            {requirements.length === 0 ? (
              <PageState kind="empty" title="No requirements" description="No compliance items defined." />
            ) : (
              <ResponsiveDataView
                rows={requirements}
                label="Requirements"
                rowKey={(r) => r.id}
                columns={[
                  { key: 'name', header: 'Requirement', render: (row) => <div className="font-medium text-rf-ink">{row.name}</div> },
                  { key: 'type', header: 'Type', render: (row) => <span className="font-mono text-[10.5px] font-bold text-rf-ink bg-rf-surface-subtle px-2 py-0.5 rounded-md">{row.type}</span> },
                  { key: 'tier', header: 'Requirement Tier', render: (row) => <span className={['px-2 py-0.5 rounded-full text-[10.5px] font-bold border', row.isRequired ? 'bg-rf-action-soft text-rf-action border-rf-action/20' : 'bg-rf-surface-subtle text-rf-ink-muted border-rf-border-subtle'].join(' ')}>{row.isRequired ? 'Mandatory' : 'Optional'}</span> },
                  { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                  { key: 'action', header: 'Action', render: (row) => (
                    hiringCase.status === 'Pending Compliance' && row.status !== 'Verified' ? (
                      <div className="flex gap-1.5 justify-end">
                        <Button variant="secondary" size="sm" loading={busyAction === row.id} onClick={() => void handleUpdateCompliance(row.id, 'Verified')}>Verify</Button>
                        <Button variant="ghost" size="sm" onClick={() => void handleUpdateCompliance(row.id, 'Not Required')}>Exempt</Button>
                      </div>
                    ) : null
                  )},
                ]}
              />
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          <section className="rf-panel rf-detail-hero rounded-2xl border border-rf-border-subtle/90 bg-white p-5 shadow-xs">
            <div className="pb-3 border-b border-rf-border-subtle mb-4">
              <h3 className="text-xs font-bold text-rf-ink m-0">Approval Gate History</h3>
              <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">Recorded sign-offs.</p>
            </div>
            <div className="flex flex-col gap-3">
              <ActivityTimeline items={approvalTimelineItems} />
            </div>
          </section>

          <section className="rf-panel rounded-2xl border border-rf-border-subtle/90 bg-white p-5 shadow-xs">
            <div className="pb-3 border-b border-rf-border-subtle mb-4">
              <h3 className="text-xs font-bold text-rf-ink m-0">Case Metadata</h3>
              <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">Audit trail context.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 text-xs">
              <div>
                <span className="text-[11px] text-rf-ink-muted font-medium block mb-0.5">Assigned Owner</span>
                <strong className="text-rf-ink font-bold">{hiringCase.ownerUserId ?? '—'}</strong>
              </div>
              <div>
                <span className="text-[11px] text-rf-ink-muted font-medium block mb-0.5">Initiation Date</span>
                <strong className="text-rf-ink font-bold">{new Date(hiringCase.createdAt).toLocaleDateString()}</strong>
              </div>
            </div>
          </section>
        </aside>
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
        commentPlaceholder={confirmDialog.commentPlaceholder}
        isLoading={busyAction !== null}
      />
    </PageFrame>
  );
}
