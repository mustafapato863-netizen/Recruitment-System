import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getApi } from '../api/client';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { Alert } from '../components/ui/Alert';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { DataToolbar } from '../components/ui/DataToolbar';
import { FilterChip } from '../components/ui/FilterChips';
import { Input } from '../components/ui/Input';
import { MetricCard } from '../components/ui/MetricCard';
import { StatusBadge } from '../components/StatusBadge';
import { ResponsiveDataView, type ResponsiveDataColumn } from '../components/ui/ResponsiveDataView';
import { TableSkeleton } from '../components/ui/Skeleton';
import { Icon } from '../components/Icon';
import './PageEnhancementsV2.css';

type HiringCaseRow = {
  id: string;
  candidateName: string;
  positionTitle: string;
  branchName: string;
  plannedJoiningDate: string | null;
  status: string;
  ownerUserId: string | null;
};

const STATUSES = [
  '',
  'Pending Compliance',
  'Pending Final Approval',
  'Awaiting Joining',
  'Joined',
  'Postponed',
  'No-show',
  'Withdrawn',
] as const;

const hiringCaseColumns: ResponsiveDataColumn<HiringCaseRow>[] = [
  {
    key: 'case',
    header: 'Case ID',
    priority: 'secondary',
    render: (item) => <Badge variant="neutral">{item.id.slice(0, 8).toUpperCase()}</Badge>,
  },
  {
    key: 'candidate',
    header: 'Candidate',
    priority: 'primary',
    render: (item) => (
      <div className="flex items-center gap-2.5">
        <Avatar initials={item.candidateName ? item.candidateName.slice(0, 2).toUpperCase() : 'CP'} size="sm" />
        <span className="min-w-0 truncate font-bold text-rf-ink">{item.candidateName}</span>
      </div>
    ),
  },
  {
    key: 'position',
    header: 'Position',
    priority: 'secondary',
    render: (item) => <span className="font-medium text-rf-ink">{item.positionTitle}</span>,
  },
  {
    key: 'branch',
    header: 'Branch',
    priority: 'tertiary',
    render: (item) => <span className="font-medium text-rf-ink-muted">{item.branchName}</span>,
  },
  {
    key: 'joining',
    header: 'Planned joining',
    priority: 'secondary',
    render: (item) => <span className="font-medium text-rf-ink-muted">{item.plannedJoiningDate ? new Date(item.plannedJoiningDate).toLocaleDateString() : 'Pending'}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    priority: 'secondary',
    render: (item) => <StatusBadge status={item.status} />,
  },
];

export function HireManagementPage() {
  const [cases, setCases] = useState<HiringCaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const loadCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getApi<HiringCaseRow[]>('/hiring');
      setCases(data);
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Failed to load hiring cases.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  const filteredCases = cases.filter((c) => {
    if (statusFilter && c.status !== statusFilter) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      return (
        c.id.toLowerCase().includes(s) ||
        c.candidateName.toLowerCase().includes(s) ||
        c.positionTitle.toLowerCase().includes(s) ||
        c.branchName.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const pendingComplianceCount = cases.filter((c) => c.status === 'Pending Compliance').length;
  const pendingApprovalCount = cases.filter((c) => c.status === 'Pending Final Approval').length;
  const awaitingJoiningCount = cases.filter((c) => c.status === 'Awaiting Joining').length;

  return (
    <PageFrame
      eyebrow="Joining &amp; Compliance"
      title="Hire Management"
      description="Control pre-hire readiness after offer acceptance through documents, licenses, final approvals and joining execution."
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={() => void loadCases()}>
            <Icon name="refresh-cw" size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <Link to="/hires/approvals/inbox">
              Final approvals ({pendingApprovalCount})
            </Link>
          </Button>
          <Button variant="primary" size="sm" asChild>
            <Link to="/joinings">
              Joining management
            </Link>
          </Button>
        </>
      }
    >
      {error && (
        <Alert tone="danger" title="Unable to load hiring cases">
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Active Pre-Hire Cases" value={cases.length} detail="Across all pre-hire cases" tone="action" icon={<Icon name="briefcase" size={14} />} />
        <MetricCard label="Compliance Checks" value={pendingComplianceCount} detail="Pending readiness verification" tone="warning" icon={<Icon name="document" size={14} />} />
        <MetricCard label="Final Approval" value={pendingApprovalCount} detail="Awaiting executive authorization" tone="info" icon={<Icon name="check-circle" size={14} />} />
        <MetricCard label="Awaiting Joining" value={awaitingJoiningCount} detail="Cleared for commencement" tone="success" icon={<Icon name="clock" size={14} />} />
      </div>

      <section className="rf-table-shell overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
        <DataToolbar
          search={(
            <Input
              aria-label="Search hiring cases"
              placeholder="Search by candidate, position or branch..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
          filters={(
            <div className="flex flex-wrap gap-1.5" aria-label="Filter hiring cases by status">
              {STATUSES.map((status) => (
                <FilterChip key={status || 'all'} label={status || 'All statuses'} isActive={statusFilter === status} onClick={() => setStatusFilter(status)} />
              ))}
            </div>
          )}
          activeFilters={statusFilter ? <FilterChip label={`Status: ${statusFilter}`} onRemove={() => setStatusFilter('')} /> : undefined}
        />

        {loading ? (
          <TableSkeleton columns={7} rows={6} />
        ) : filteredCases.length === 0 ? (
          <PageState
            kind="empty"
            title="No matching hiring cases"
            description="Adjust your search filters or wait for candidates to accept offers."
          />
        ) : (
          <ResponsiveDataView
            rows={filteredCases}
            columns={hiringCaseColumns}
            rowKey={(item) => item.id}
            label="Hiring cases"
            className="px-4 pb-4 sm:px-5 sm:pb-5"
            renderActions={(item) => (
              <Button variant="secondary" size="sm" asChild>
                <Link to={`/hires/${item.id}`}>Open case</Link>
              </Button>
            )}
          />
        )}
      </section>
    </PageFrame>
  );
}
