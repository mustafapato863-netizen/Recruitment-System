import { useState, useEffect } from 'react';
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
import { ResponsiveDataView, type ResponsiveDataColumn } from '../components/ui/ResponsiveDataView';
import { TableSkeleton } from '../components/ui/Skeleton';
import { StatusBadge } from '../components/StatusBadge';
import { Icon } from '../components/Icon';
import './PageEnhancementsV2.css';

type JoiningRow = {
  id: string;
  candidateName: string;
  positionTitle: string;
  branchName: string;
  plannedJoiningDate: string | null;
  status: string;
  ownerUserId: string | null;
};

const JOINING_STATUSES = ['', 'Awaiting Joining', 'Joined', 'Postponed', 'No-show'] as const;

const joiningColumns: ResponsiveDataColumn<JoiningRow>[] = [
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
    key: 'planned-date',
    header: 'Planned date',
    priority: 'secondary',
    render: (item) => <span className="font-medium text-rf-ink-muted">{item.plannedJoiningDate ? new Date(item.plannedJoiningDate).toLocaleDateString() : 'Not reported'}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    priority: 'secondary',
    render: (item) => <StatusBadge status={item.status} />,
  },
  {
    key: 'owner',
    header: 'Owner',
    priority: 'tertiary',
    render: (item) => <span className="font-medium text-rf-ink-muted">{item.ownerUserId || 'Owner not reported'}</span>,
  },
];

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

export function JoiningManagementPage() {
  const [items, setItems] = useState<JoiningRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');

  const loadData = () => {
    setIsLoading(true);
    setError(null);
    getApi<JoiningRow[]>('/hiring')
      .then(setItems)
      .catch((reason: unknown) => setError(getErrorMessage(reason)))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = items.filter((item) => {
    const s = `${item.candidateName} ${item.positionTitle} ${item.branchName}`.toLowerCase();
    return (!search || s.includes(search.toLowerCase())) && (!filter || item.status === filter);
  });

  const awaitingCount = items.filter((item) => item.status === 'Awaiting Joining').length;
  const joinedCount = items.filter((item) => item.status === 'Joined').length;

  return (
    <PageFrame
      eyebrow="Joining & Compliance"
      title="Joining Management & Onboarding"
      description="Confirm candidate physical/remote attendance, postpone starting dates, record no-shows, and close vacancy headcount."
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={loadData}>
            <Icon name="refresh-cw" size={13} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </Button>
          <Button variant="primary" size="sm" asChild>
            <Link to="/hires">
              <Icon name="check-circle" size={14} />
              Pre-hire cases
            </Link>
          </Button>
        </>
      }
    >
      {error && (
        <Alert
          tone="danger"
          title="Unable to load joining records"
          action={
            <Button variant="secondary" size="sm" onClick={loadData}>
              <Icon name="refresh-cw" size={13} />
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Awaiting Joining" value={awaitingCount} detail="Awaiting first day" tone="action" icon={<Icon name="clock" size={14} />} />
        <MetricCard label="Total Pre-Hires" value={items.length} detail="Across all branches" tone="info" icon={<Icon name="users" size={14} />} />
        <MetricCard label="Joined & Onboarded" value={joinedCount} detail="Headcount closed" tone="success" icon={<Icon name="check-circle" size={14} />} />
        <MetricCard label="Other Exceptions" value={Math.max(0, items.length - awaitingCount - joinedCount)} detail="Postponed / No-show" tone="warning" icon={<Icon name="alert-triangle" size={14} />} />
      </div>

      <section className="rf-table-shell overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
        <DataToolbar
          search={(
            <Input
              aria-label="Search joining cases"
              placeholder="Search candidate, role or branch..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
          filters={(
            <div className="flex flex-wrap gap-1.5" aria-label="Filter joining cases by status">
              {JOINING_STATUSES.map((status) => (
                <FilterChip key={status || 'all'} label={status || 'All statuses'} isActive={filter === status} onClick={() => setFilter(status)} />
              ))}
            </div>
          )}
          activeFilters={filter ? <FilterChip label={`Status: ${filter}`} onRemove={() => setFilter('')} /> : undefined}
        />

        {isLoading ? (
          <TableSkeleton columns={8} rows={6} />
        ) : filtered.length === 0 ? (
          <PageState kind="empty" title="No matching joining records" description="Adjust your search or status filter." />
        ) : (
          <ResponsiveDataView
            rows={filtered}
            columns={joiningColumns}
            rowKey={(item) => item.id}
            label="Joining cases"
            className="px-4 pb-4 sm:px-5 sm:pb-5"
            renderActions={(item) => (
              <Button variant="secondary" size="sm" asChild>
                <Link to={`/hires/${item.id}`}>Manage</Link>
              </Button>
            )}
          />
        )}
      </section>
    </PageFrame>
  );
}
