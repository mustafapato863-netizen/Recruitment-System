import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getApi, postApi } from '../api/client';
import { Icon } from '../components/Icon';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { ResponsiveDataView, type ResponsiveDataColumn } from '../components/ui/ResponsiveDataView';
import { SectionHeader } from '../components/ui/SectionHeader';
import { TableSkeleton } from '../components/ui/Skeleton';
import './PageEnhancementsV2.css';

type OfferApprovalRow = {
  id: string;
  offerCode: string;
  candidateName: string;
  positionTitle: string;
  branchName?: string | null;
  monthlyPackage: number;
  versionNumber: number;
};

const offerApprovalColumns: ResponsiveDataColumn<OfferApprovalRow>[] = [
  {
    key: 'offer',
    header: 'Offer code',
    priority: 'secondary',
    render: (row) => <Badge variant="neutral">{row.offerCode}</Badge>,
  },
  {
    key: 'candidate',
    header: 'Candidate',
    priority: 'primary',
    render: (row) => <span className="font-bold text-rf-ink">{row.candidateName}</span>,
  },
  {
    key: 'position',
    header: 'Position / branch',
    priority: 'secondary',
    render: (row) => (
      <div className="grid gap-0.5">
        <span className="font-medium text-rf-ink">{row.positionTitle}</span>
        <span className="font-medium text-rf-ink-muted">{row.branchName || 'Branch not reported'}</span>
      </div>
    ),
  },
  {
    key: 'package',
    header: 'Monthly package',
    priority: 'secondary',
    render: (row) => (
      <div className="grid gap-0.5">
        <span className="font-bold text-rf-ink">SAR {row.monthlyPackage.toLocaleString()}</span>
        <span className="font-medium text-rf-ink-muted">Monthly gross</span>
      </div>
    ),
  },
  {
    key: 'version',
    header: 'Version',
    priority: 'tertiary',
    render: (row) => <Badge variant="info">v{row.versionNumber}</Badge>,
  },
];

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

export function OfferApprovalInboxPage() {
  const [approvals, setApprovals] = useState<OfferApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    void fetchApprovals();
  }, []);

  async function fetchApprovals() {
    try {
      setLoading(true);
      setError(null);
      const data = await getApi<OfferApprovalRow[]>('/offers/approvals/inbox');
      setApprovals(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleDecision(approvalId: string, decision: 'Approve' | 'Reject') {
    setBusyId(approvalId);
    try {
      await postApi(`/offers/approvals/${approvalId}/decide`, { decision, comment: '' });
      await fetchApprovals();
    } catch (err: unknown) {
      setError(`Failed to submit decision: ${getErrorMessage(err)}`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <PageFrame
      eyebrow="Hiring Operations"
      title="Offer Approval Inbox"
      description="Review compensation packages, salary bands, and immutable offer versions requiring your role authorization."
      actions={
        <Button variant="ghost" size="sm" onClick={() => void fetchApprovals()}>
          <Icon name="refresh-cw" size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      }
    >
      {error && <Alert tone="danger" title="Unable to load approvals">{error}</Alert>}

      <section className="rf-table-shell rf-long-content overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
        <SectionHeader
          title="Pending offer approvals"
          description="Review package details and authorize offer distribution."
          density="compact"
          className="border-b border-rf-border-subtle p-4 sm:p-5"
          actions={<Badge variant={approvals.length > 0 ? 'warning' : 'neutral'}>{approvals.length} pending</Badge>}
        />

        {loading ? (
          <TableSkeleton columns={6} rows={5} />
        ) : approvals.length === 0 ? (
          <PageState kind="empty" title="Your offer inbox is clear" description="No offers are currently awaiting your approval." />
        ) : (
          <ResponsiveDataView
            rows={approvals}
            columns={offerApprovalColumns}
            rowKey={(approval) => approval.id}
            label="Pending offer approvals"
            className="px-4 pb-4 sm:px-5 sm:pb-5"
            renderActions={(approval) => (
              <>
                <Button variant="secondary" size="sm" asChild>
                  <Link to={`/offers/${approval.id}`}>Review</Link>
                </Button>
                <Button variant="danger" size="sm" disabled={busyId === approval.id} onClick={() => void handleDecision(approval.id, 'Reject')}>
                  Reject
                </Button>
                <Button variant="primary" size="sm" loading={busyId === approval.id} loadingLabel="Approving" onClick={() => void handleDecision(approval.id, 'Approve')}>
                  Approve
                </Button>
              </>
            )}
          />
        )}
      </section>
    </PageFrame>
  );
}
