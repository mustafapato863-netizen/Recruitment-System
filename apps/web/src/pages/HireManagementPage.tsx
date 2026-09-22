import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getApi } from '../api/client';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { Alert } from '../components/ui/Alert';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { DataToolbar } from '../components/ui/DataToolbar';
import { FilterChip } from '../components/ui/FilterChips';
import { Input } from '../components/ui/Input';
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

function hireNextAction(status: string) {
  switch (status) {
    case 'Pending Compliance':
      return { label: 'Complete checks', to: (id: string) => `/hires/${id}` };
    case 'Pending Final Approval':
      return { label: 'Open approval', to: (id: string) => `/hires/${id}` };
    case 'Awaiting Joining':
      return { label: 'Confirm joining', to: (id: string) => `/hires/${id}#checklist` };
    case 'Joined':
      return { label: 'View case', to: (id: string) => `/hires/${id}` };
    default:
      return { label: 'Open case', to: (id: string) => `/hires/${id}` };
  }
}

const hiringCaseColumns: ResponsiveDataColumn<HiringCaseRow>[] = [
  {
    key: 'candidate',
    header: 'Candidate',
    priority: 'primary',
    render: (item) => (
      <div className="flex items-center gap-2.5">
        <Avatar initials={item.candidateName ? item.candidateName.slice(0, 2).toUpperCase() : 'CP'} size="sm" />
        <span className="min-w-0 truncate font-semibold text-rf-ink">{item.candidateName}</span>
      </div>
    ),
  },
  {
    key: 'position',
    header: 'Position',
    priority: 'secondary',
    render: (item) => (
      <div>
        <span className="block font-medium text-rf-ink">{item.positionTitle}</span>
        <span className="block text-[11px] text-rf-ink-muted">{item.branchName}</span>
      </div>
    ),
  },
  {
    key: 'joining',
    header: 'Joining',
    priority: 'secondary',
    render: (item) => (
      <span className="font-medium text-rf-ink-muted">
        {item.plannedJoiningDate ? new Date(item.plannedJoiningDate).toLocaleDateString('en-GB') : 'Not set'}
      </span>
    ),
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
      title="Hires"
      description="Checks, approvals, and joining after offer acceptance."
      actions={
        <Button variant="ghost" size="sm" onClick={() => void loadCases()}>
          <Icon name="refresh-cw" size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      }
    >
      {error && (
        <Alert tone="danger" title="Unable to load hiring cases">
          {error}
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setStatusFilter('')} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${statusFilter === '' ? 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300' : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'}`}>
          All
          <span className="text-slate-900 dark:text-white">{cases.length}</span>
        </button>
        <button type="button" onClick={() => setStatusFilter('Pending Compliance')} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${statusFilter === 'Pending Compliance' ? 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300' : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'}`}>
          Checks
          <span className="text-slate-900 dark:text-white">{pendingComplianceCount}</span>
        </button>
        <button type="button" onClick={() => setStatusFilter('Pending Final Approval')} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${statusFilter === 'Pending Final Approval' ? 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300' : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'}`}>
          Approvals
          <span className="text-slate-900 dark:text-white">{pendingApprovalCount}</span>
        </button>
        <button type="button" onClick={() => setStatusFilter('Awaiting Joining')} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${statusFilter === 'Awaiting Joining' ? 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300' : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'}`}>
          Joining
          <span className="text-slate-900 dark:text-white">{awaitingJoiningCount}</span>
        </button>
      </div>

      <section className="rf-table-shell overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
        <DataToolbar
          search={(
            <Input
              aria-label="Search hiring cases"
              placeholder="Search candidate or role"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
          filters={(
            <div className="flex flex-wrap gap-1.5" aria-label="Filter hiring cases by status">
              {STATUSES.map((status) => (
                <FilterChip key={status || 'all'} label={status || 'All'} isActive={statusFilter === status} onClick={() => setStatusFilter(status)} />
              ))}
            </div>
          )}
          activeFilters={statusFilter ? <FilterChip label={statusFilter} onRemove={() => setStatusFilter('')} /> : undefined}
        />

        {loading ? (
          <TableSkeleton columns={5} rows={6} />
        ) : filteredCases.length === 0 ? (
          <PageState
            kind="empty"
            title="No hiring cases"
            description="Cases appear here after a candidate accepts an offer."
          />
        ) : (
          <ResponsiveDataView
            rows={filteredCases}
            columns={hiringCaseColumns}
            rowKey={(item) => item.id}
            label="Hiring cases"
            className="px-4 pb-4 sm:px-5 sm:pb-5"
            renderActions={(item) => {
              const action = hireNextAction(item.status);
              return (
                <Button variant="primary" size="sm" asChild>
                  <Link to={action.to(item.id)}>{action.label}</Link>
                </Button>
              );
            }}
          />
        )}
      </section>
    </PageFrame>
  );
}
