import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getApi, postApi } from '../api/client';
import { getErrorMessage } from '../api/errors';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Icon, type IconName } from '../components/Icon';
import { StatusBadge } from '../components/StatusBadge';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { ResponsiveDataView, type ResponsiveDataColumn } from '../components/ui/ResponsiveDataView';
import { SectionHeader } from '../components/ui/SectionHeader';
import { TableSkeleton } from '../components/ui/Skeleton';
import { useFeedback } from '../hooks/useFeedback';
import './PageEnhancementsV2.css';

type FinalApprovalRow = {
  id: string;
  candidateName: string;
  positionTitle: string;
  branchName: string;
  status: string;
};

type ConfirmState = {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone: 'success' | 'danger';
  icon: IconName;
  withComment: boolean;
  commentPlaceholder: string;
  commentRequired?: boolean;
  action: (comment?: string) => Promise<void>;
};

const initialConfirmState: ConfirmState = {
  isOpen: false,
  title: '',
  description: '',
  confirmLabel: 'Confirm',
  tone: 'success',
  icon: 'check-circle',
  withComment: false,
  commentPlaceholder: '',
  action: async () => undefined,
};

const finalApprovalColumns: ResponsiveDataColumn<FinalApprovalRow>[] = [
  {
    key: 'case',
    header: 'Case ID',
    priority: 'secondary',
    render: (row) => <Badge variant="neutral">{row.id.slice(0, 8).toUpperCase()}</Badge>,
  },
  {
    key: 'candidate',
    header: 'Candidate',
    priority: 'primary',
    render: (row) => <span className="font-bold text-rf-ink">{row.candidateName}</span>,
  },
  {
    key: 'position',
    header: 'Position',
    priority: 'secondary',
    render: (row) => <span className="font-medium text-rf-ink">{row.positionTitle}</span>,
  },
  {
    key: 'branch',
    header: 'Branch',
    priority: 'tertiary',
    render: (row) => <span className="font-medium text-rf-ink-muted">{row.branchName}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    priority: 'secondary',
    render: (row) => <StatusBadge status={row.status} />,
  },
];

export function FinalApprovalInboxPage() {
  const { success: toastSuccess, error: toastError } = useFeedback();
  const [items, setItems] = useState<FinalApprovalRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState>(initialConfirmState);

  const loadApprovals = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getApi<FinalApprovalRow[]>('/hiring/final-approvals');
      setItems(data);
    } catch (reason: unknown) {
      const message = getErrorMessage(reason, 'Unable to load final approvals');
      setError(message);
      toastError(reason, 'Unable to load final approvals');
    } finally {
      setIsLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    void loadApprovals();
  }, [loadApprovals]);

  const requestDecision = (row: FinalApprovalRow, decision: 'Approve' | 'Reject') => {
    const isApproval = decision === 'Approve';
    setConfirmDialog({
      isOpen: true,
      title: isApproval
        ? `Final hiring signoff — ${row.candidateName}`
        : `Reject final hiring — ${row.candidateName}`,
      description: isApproval
        ? `Authorize ${row.candidateName} for ${row.positionTitle} at ${row.branchName}. This unlocks onboarding and locks the hiring case.`
        : `Reject final hiring for ${row.candidateName} (${row.positionTitle}). The case stays available for follow-up.`,
      confirmLabel: isApproval ? 'Authorize hire' : 'Reject hire',
      tone: isApproval ? 'success' : 'danger',
      icon: isApproval ? 'check-circle' : 'alert-triangle',
      withComment: true,
      commentPlaceholder: isApproval
        ? 'Optional executive signoff notes...'
        : 'Reason for rejection (recommended)...',
      action: async (comment?: string) => {
        setBusyId(row.id);
        setError(null);
        try {
          await postApi(`/hiring/${row.id}/final-approval`, {
            decision,
            comment: comment?.trim() || 'Decision recorded from final approval inbox.',
          });
          toastSuccess(
            isApproval ? 'Final approval granted' : 'Final hiring rejected',
            isApproval
              ? `${row.candidateName} is authorized for onboarding.`
              : `${row.candidateName} was not authorized.`,
          );
          await loadApprovals();
        } catch (reason: unknown) {
          const message = getErrorMessage(reason, 'Unable to record final decision');
          setError(message);
          toastError(reason, 'Unable to record final decision');
        } finally {
          setBusyId(null);
          setConfirmDialog(initialConfirmState);
        }
      },
    });
  };

  return (
    <PageFrame
      eyebrow="Joining &amp; Compliance"
      title="Final Hiring Approval Inbox"
      description="Final governance gate before a candidate can transition to Awaiting Joining status."
      actions={
        <Button variant="ghost" size="sm" onClick={() => void loadApprovals()}>
          <Icon name="refresh-cw" size={13} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      }
    >
      {error && (
        <Alert
          tone="danger"
          title="Inbox error"
          action={(
            <Button variant="secondary" size="sm" onClick={() => void loadApprovals()}>
              <Icon name="refresh-cw" size={13} />
              Retry
            </Button>
          )}
        >
          {error}
        </Alert>
      )}

      <section className="rf-table-shell rf-long-content overflow-hidden rounded-2xl border border-rf-border/90 bg-white shadow-xs">
        <SectionHeader
          title="Pending final approvals"
          description="Verify compliance checklist clearance before authorizing employment commencement."
          density="compact"
          className="border-b border-rf-border-subtle p-4 sm:p-5"
          actions={<Badge variant={items.length > 0 ? 'warning' : 'neutral'}>{items.length} pending</Badge>}
        />

        {isLoading ? (
          <TableSkeleton columns={6} rows={5} />
        ) : items.length === 0 ? (
          <PageState kind="empty" title="Final approval inbox is clear" description="No candidates are currently awaiting final hiring authorization." />
        ) : (
          <ResponsiveDataView
            rows={items}
            columns={finalApprovalColumns}
            rowKey={(row) => row.id}
            label="Pending final approvals"
            className="px-4 pb-4 sm:px-5 sm:pb-5"
            renderActions={(row) => (
              <>
                <Button variant="secondary" size="sm" asChild>
                  <Link to={`/hires/${row.id}`}>Review case</Link>
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={busyId === row.id}
                  onClick={() => requestDecision(row, 'Reject')}
                >
                  Reject
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  loading={busyId === row.id}
                  loadingLabel="Approving"
                  onClick={() => requestDecision(row, 'Approve')}
                >
                  Authorize hire
                </Button>
              </>
            )}
          />
        )}
      </section>

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
