import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getApi, postApi } from '../api/client';
import { Icon } from '../components/Icon';
import { StatusBadge } from '../components/StatusBadge';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { ResponsiveDataView, type ResponsiveDataColumn } from '../components/ui/ResponsiveDataView';
import { SectionHeader } from '../components/ui/SectionHeader';
import { TableSkeleton } from '../components/ui/Skeleton';
import './PageEnhancementsV2.css';

type FinalApprovalRow = {
  id: string;
  candidateName: string;
  positionTitle: string;
  branchName: string;
  status: string;
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

export function FinalApprovalInboxPage() {
  const [items, setItems] = useState<FinalApprovalRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadApprovals = () => {
    setIsLoading(true);
    setError(null);
    getApi<FinalApprovalRow[]>('/hiring/final-approvals')
      .then(setItems)
      .catch((reason: unknown) => setError(getErrorMessage(reason)))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadApprovals();
  }, []);

  const decide = async (caseId: string, decision: 'Approve' | 'Reject') => {
    setBusyId(caseId);
    try {
      await postApi(`/hiring/${caseId}/final-approval`, { decision, comment: 'Decision recorded from final approval inbox.' });
      setItems((current) => current.filter((item) => item.id !== caseId));
    } catch (reason: unknown) {
      setError(getErrorMessage(reason));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PageFrame
      eyebrow="Joining &amp; Compliance"
      title="Final Hiring Approval Inbox"
      description="Final governance gate before a candidate can transition to Awaiting Joining status."
      actions={
        <Button variant="ghost" size="sm" onClick={loadApprovals}>
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
            <Button variant="secondary" size="sm" onClick={loadApprovals}>
              <Icon name="refresh-cw" size={13} />
              Retry
            </Button>
          )}
        >
          {error}
        </Alert>
      )}

      <section className="rf-table-shell rf-long-content overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
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
                <Button variant="danger" size="sm" disabled={busyId === row.id} onClick={() => void decide(row.id, 'Reject')}>
                  Reject
                </Button>
                <Button variant="primary" size="sm" loading={busyId === row.id} loadingLabel="Approving" onClick={() => void decide(row.id, 'Approve')}>
                  Authorize hire
                </Button>
              </>
            )}
          />
        )}
      </section>
    </PageFrame>
  );
}
