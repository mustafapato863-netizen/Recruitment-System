import { useState, useEffect } from 'react';
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
import { ProgressBar } from '../components/ui/ProgressBar';
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
  checklistProgress?: number;
  completedItems?: number;
  totalItems?: number;
};

const JOINING_STATUSES = ['', 'Awaiting Joining', 'Joined', 'Postponed', 'No-show'] as const;

function joiningNextAction(status: string) {
  switch (status) {
    case 'Awaiting Joining':
      return { label: 'Confirm joining', to: (id: string) => `/hires/${id}#checklist` };
    case 'Postponed':
      return { label: 'Update date', to: (id: string) => `/hires/${id}#checklist` };
    case 'No-show':
      return { label: 'Open case', to: (id: string) => `/hires/${id}` };
    case 'Joined':
      return { label: 'View case', to: (id: string) => `/hires/${id}` };
    default:
      return { label: 'Open checklist', to: (id: string) => `/hires/${id}#checklist` };
  }
}

const joiningColumns: ResponsiveDataColumn<JoiningRow>[] = [
  {
    key: 'candidate',
    header: 'Candidate',
    priority: 'primary',
    render: (item) => (
      <Link
        to={`/hires/${item.id}#checklist`}
        className="flex items-center gap-2.5 rounded-sm hover:underline focus:outline-none focus:ring-1 focus:ring-rf-action/40"
      >
        <Avatar initials={item.candidateName ? item.candidateName.slice(0, 2).toUpperCase() : 'CP'} size="sm" />
        <span className="min-w-0 truncate font-semibold text-rf-ink">{item.candidateName}</span>
      </Link>
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
    key: 'planned-date',
    header: 'Start date',
    priority: 'secondary',
    render: (item) => (
      <span className="font-medium text-rf-ink-muted">
        {item.plannedJoiningDate ? new Date(item.plannedJoiningDate).toLocaleDateString('en-GB') : 'Not set'}
      </span>
    ),
  },
  {
    key: 'checklist',
    header: 'Checklist',
    priority: 'secondary',
    render: (item) => {
      if (!item.totalItems || item.totalItems === 0) {
        return <span className="text-[11px] text-slate-500">Not started</span>;
      }
      return (
        <div className="w-28">
          <ProgressBar
            value={item.checklistProgress ?? 0}
            label={`${item.completedItems ?? 0}/${item.totalItems}`}
          />
        </div>
      );
    },
  },
  {
    key: 'status',
    header: 'Status',
    priority: 'secondary',
    render: (item) => <StatusBadge status={item.status} />,
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
      .then((data) => {
        const enriched = data.map((item) => {
          const rawItem = item as JoiningRow & {
            complianceRequirements?: Array<{ status?: string }>;
          };
          const runtimeItems = rawItem.complianceRequirements;
          const runtimeCompleted = Array.isArray(runtimeItems)
            ? runtimeItems.filter((req) => req && (req.status === 'Verified' || req.status === 'Not Required')).length
            : undefined;
          const runtimeTotal = Array.isArray(runtimeItems) ? runtimeItems.length : undefined;

          const completed = item.completedItems ?? runtimeCompleted ?? 0;
          const total = item.totalItems ?? runtimeTotal ?? 0;
          const checklistProgress = total > 0 ? Math.round((completed / total) * 100) : 0;

          return {
            ...item,
            checklistProgress,
            completedItems: completed,
            totalItems: total,
          };
        });
        setItems(enriched);
      })
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
  const exceptionCount = Math.max(0, items.length - awaitingCount - joinedCount);

  return (
    <PageFrame
      title="Joining"
      description="Confirm start dates and close headcount."
      actions={
        <Button variant="ghost" size="sm" onClick={loadData}>
          <Icon name="refresh-cw" size={13} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </Button>
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

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setFilter('')} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${filter === '' ? 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300' : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'}`}>
          All
          <span className="text-slate-900 dark:text-white">{items.length}</span>
        </button>
        <button type="button" onClick={() => setFilter('Awaiting Joining')} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${filter === 'Awaiting Joining' ? 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300' : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'}`}>
          Awaiting
          <span className="text-slate-900 dark:text-white">{awaitingCount}</span>
        </button>
        <button type="button" onClick={() => setFilter('Joined')} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${filter === 'Joined' ? 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300' : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'}`}>
          Joined
          <span className="text-slate-900 dark:text-white">{joinedCount}</span>
        </button>
        <button type="button" onClick={() => setFilter('Postponed')} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${filter === 'Postponed' ? 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300' : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'}`}>
          Exceptions
          <span className="text-slate-900 dark:text-white">{exceptionCount}</span>
        </button>
      </div>

      <section className="rf-table-shell overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
        <DataToolbar
          search={(
            <Input
              aria-label="Search joining cases"
              placeholder="Search candidate or role"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
          filters={(
            <div className="flex flex-wrap gap-1.5" aria-label="Filter joining cases by status">
              {JOINING_STATUSES.map((status) => (
                <FilterChip key={status || 'all'} label={status || 'All'} isActive={filter === status} onClick={() => setFilter(status)} />
              ))}
            </div>
          )}
          activeFilters={filter ? <FilterChip label={filter} onRemove={() => setFilter('')} /> : undefined}
        />

        {isLoading ? (
          <TableSkeleton columns={6} rows={6} />
        ) : filtered.length === 0 ? (
          <PageState kind="empty" title="No joining records" description="Adjust the search or status filter." />
        ) : (
          <ResponsiveDataView
            rows={filtered}
            columns={joiningColumns}
            rowKey={(item) => item.id}
            label="Joining cases"
            className="px-4 pb-4 sm:px-5 sm:pb-5"
            renderActions={(item) => {
              const action = joiningNextAction(item.status);
              return (
                <Button variant={item.status === 'Joined' ? 'secondary' : 'primary'} size="sm" asChild>
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
