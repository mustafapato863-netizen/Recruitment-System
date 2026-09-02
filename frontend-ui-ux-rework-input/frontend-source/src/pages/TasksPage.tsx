import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PaginatedResult, TaskRecord } from '@recruitflow/contracts';
import { getApi, patchApi } from '../api/client';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Icon, type IconName } from '../components/Icon';
import { Spinner } from '../components/Spinner';
import { StatusBadge } from '../components/StatusBadge';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { DataToolbar } from '../components/ui/DataToolbar';
import { FilterChip } from '../components/ui/FilterChips';
import { Input } from '../components/ui/Input';
import { MetricCard } from '../components/ui/MetricCard';
import { Pagination } from '../components/ui/Pagination';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { PriorityChip, type PriorityLevel } from '../components/ui/PriorityChip';
import { Select } from '../components/ui/Select';
import { ListSkeleton } from '../components/ui/Skeleton';
import './PageEnhancementsV2.css';

const STATUSES = ['Open', 'In Progress', 'Completed', 'Dismissed'] as const;
const PRIORITIES = ['Low', 'Normal', 'High', 'Critical'] as const;

const TASK_SHORTCUTS: Array<{
  label: string;
  description: string;
  to: string;
  icon: IconName;
  tone: 'action' | 'info' | 'warning';
}> = [
  {
    label: 'Candidate directory',
    description: 'Review profiles, applications, and recent activity.',
    to: '/candidates',
    icon: 'users',
    tone: 'action',
  },
  {
    label: 'Approval inbox',
    description: 'See vacancy, offer, and hiring decisions waiting for you.',
    to: '/approval-inbox',
    icon: 'inbox',
    tone: 'warning',
  },
  {
    label: 'Interview calendar',
    description: 'Check upcoming interviews and feedback readiness.',
    to: '/interviews/calendar',
    icon: 'calendar',
    tone: 'info',
  },
];

function toPriorityLevel(priority?: string): PriorityLevel {
  const p = priority?.toLowerCase();
  if (p === 'high' || p === 'critical') return 'high';
  if (p === 'low') return 'low';
  return 'medium';
}

export function TasksPage() {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [confirmTaskId, setConfirmTaskId] = useState<string | null>(null);

  const pageSize = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (filterStatus) params.set('status', filterStatus);
      if (filterPriority) params.set('priority', filterPriority);
      if (overdueOnly) params.set('overdueOnly', 'true');
      if (search.trim()) params.set('search', search.trim());
      const result = await getApi<PaginatedResult<TaskRecord>>(`/tasks?${params}`);
      setTasks(result.data);
      setTotal(result.total);
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Failed to load tasks.');
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterPriority, overdueOnly, search]);

  useEffect(() => { void load(); }, [load]);

  const handleStatusChange = async (id: string, status: string) => {
    setUpdatingId(id);
    try {
      const updated = await patchApi<TaskRecord>(`/tasks/${id}/status`, { status });
      setTasks((previous) => previous.map((task) => task.id === id ? updated : task));
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Failed to update task status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const overdueCount = tasks.filter((task) => task.isOverdue).length;
  const totalPages = Math.ceil(total / pageSize);
  const hasFilters = Boolean(filterStatus || filterPriority || overdueOnly || search);
  const clearFilters = () => {
    setFilterStatus('');
    setFilterPriority('');
    setOverdueOnly(false);
    setSearch('');
    setPage(1);
  };

  return (
    <PageFrame
      className="rf-tasks-page"
      eyebrow="My Work"
      title="Task Inbox & Actions"
      description={loading ? 'Loading your assigned work...' : `${total} active task${total !== 1 ? 's' : ''}${overdueCount > 0 ? ` - ${overdueCount} overdue` : ''}`}
      actions={
        <Button variant="ghost" size="sm" onClick={() => void load()}>
          <Icon name="refresh-cw" size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      }
    >
      <div className="rf-tasks-summary grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <MetricCard label="All tasks" value={total} detail="Assigned to your queue" tone="action" icon={<Icon name="check-circle" size={14} />} />
        <MetricCard label="Visible now" value={tasks.length} detail={`Page ${page} of ${Math.max(totalPages, 1)}`} tone="info" icon={<Icon name="list" size={14} />} />
        <MetricCard label="Overdue" value={overdueCount} detail="Needs urgent action" tone={overdueCount > 0 ? 'warning' : 'success'} icon={<Icon name="alert-triangle" size={14} />} />
      </div>

      <section className="rf-task-workspace rf-table-shell rf-long-content overflow-hidden rounded-2xl border border-rf-border-subtle bg-rf-surface shadow-xs">
        <DataToolbar
          aria-label="Task filters"
          search={(
            <Input
              aria-label="Search tasks"
              placeholder="Search tasks by title or keyword..."
              type="search"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            />
          )}
          filters={(
            <>
              <Select className="min-w-[10rem] flex-1 sm:w-44 sm:flex-none" value={filterStatus} onChange={(event) => { setFilterStatus(event.target.value); setPage(1); }} aria-label="Filter by status">
                <option value="">All statuses</option>
                {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </Select>
              <Select className="min-w-[10rem] flex-1 sm:w-44 sm:flex-none" value={filterPriority} onChange={(event) => { setFilterPriority(event.target.value); setPage(1); }} aria-label="Filter by priority">
                <option value="">All priorities</option>
                {PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
              </Select>
              <FilterChip label="Overdue only" isActive={overdueOnly} onClick={() => { setOverdueOnly((value) => !value); setPage(1); }} />
            </>
          )}
          activeFilters={hasFilters ? (
            <>
              {search && <FilterChip label={`Search: ${search}`} onRemove={() => { setSearch(''); setPage(1); }} />}
              {filterStatus && <FilterChip label={`Status: ${filterStatus}`} onRemove={() => { setFilterStatus(''); setPage(1); }} />}
              {filterPriority && <FilterChip label={`Priority: ${filterPriority}`} onRemove={() => { setFilterPriority(''); setPage(1); }} />}
              {overdueOnly && <FilterChip label="Overdue only" onRemove={() => { setOverdueOnly(false); setPage(1); }} />}
              <Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button>
            </>
          ) : undefined}
        />

        {error && (
          <div className="p-4">
            <Alert
              tone="danger"
              title="Tasks could not be loaded"
              action={(
                <Button variant="secondary" size="sm" onClick={() => void load()}>
                  <Icon name="refresh-cw" size={13} />
                  Retry
                </Button>
              )}
            >
              {error}
            </Alert>
          </div>
        )}

        {loading ? (
          <ListSkeleton count={5} />
        ) : tasks.length === 0 ? (
          hasFilters ? (
            <PageState
              kind="empty"
              title="No matching tasks"
              description="Try clearing a filter or changing your search."
              actionLabel="Clear filters"
              onAction={clearFilters}
            />
          ) : (
            <>
              <section className="rf-task-empty" aria-labelledby="rf-task-empty-title" aria-live="polite">
                <div className="rf-task-empty__main">
                  <div className="rf-task-empty__icon" aria-hidden="true">
                    <Icon name="check-circle" size={24} />
                  </div>
                  <div>
                    <div className="rf-task-empty__eyebrow">Queue status · Clear</div>
                    <h2 id="rf-task-empty-title">You’re all caught up</h2>
                    <p>No tasks are currently assigned to you. Your next action will appear here when the workflow needs your attention.</p>
                  </div>
                </div>
                <div className="rf-task-empty__note">
                  <Icon name="info" size={15} aria-hidden="true" />
                  <span>Tasks can be generated from vacancies, interviews, offers, documents, licenses, and approvals.</span>
                </div>
              </section>

              <section className="rf-task-shortcuts" aria-labelledby="rf-task-shortcuts-title">
                <div className="rf-task-shortcuts__header">
                  <div>
                    <div className="rf-task-shortcuts__eyebrow">Keep work moving</div>
                    <h2 id="rf-task-shortcuts-title">Open a recruiting workspace</h2>
                  </div>
                  <span className="rf-task-shortcuts__caption">Jump into the areas that create your next actions.</span>
                </div>
                <div className="rf-task-shortcuts__grid">
                  {TASK_SHORTCUTS.map((shortcut) => (
                    <Link key={shortcut.to} className="rf-task-shortcut" data-tone={shortcut.tone} to={shortcut.to}>
                      <span className="rf-task-shortcut__icon" aria-hidden="true"><Icon name={shortcut.icon} size={17} /></span>
                      <span className="rf-task-shortcut__copy">
                        <strong>{shortcut.label}</strong>
                        <span>{shortcut.description}</span>
                      </span>
                      <Icon name="chevron-right" size={15} className="rf-task-shortcut__arrow" />
                    </Link>
                  ))}
                </div>
              </section>
            </>
          )
        ) : (
          <div className="grid gap-3 p-4">
            {tasks.map((task) => (
              <article key={task.id} className={`rf-task-item${task.isOverdue ? ' is-overdue' : ''}`}>
                <div className="rf-task-item__body">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="rf-task-item__title">{task.title}</h2>
                    {task.isOverdue && <Badge variant="danger">Overdue</Badge>}
                  </div>
                  {task.description && <p className="rf-task-item__description">{task.description}</p>}
                  <div className="rf-task-item__meta">
                    {task.priority && <PriorityChip level={toPriorityLevel(task.priority)} label={task.priority} />}
                    <StatusBadge status={task.status} />
                    <Badge variant="neutral">{task.type}</Badge>
                    {task.dueAt && (
                      <time className={`rf-task-item__due${task.isOverdue ? ' is-overdue' : ''}`} dateTime={task.dueAt}>
                        Due {new Date(task.dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </time>
                    )}
                  </div>
                </div>

                {task.status !== 'Completed' && task.status !== 'Dismissed' && (
                  <div className="flex shrink-0 flex-wrap items-center gap-2" aria-label={`Actions for ${task.title}`}>
                    {updatingId === task.id ? (
                      <Spinner size={18} aria-label="Updating task" />
                    ) : (
                      <>
                        {task.status === 'Open' && (
                          <Button variant="secondary" size="sm" onClick={() => void handleStatusChange(task.id, 'In Progress')}>
                            Start
                          </Button>
                        )}
                        <Button variant="primary" size="sm" onClick={() => void handleStatusChange(task.id, 'Completed')}>
                          <Icon name="check-circle" size={13} />
                          Complete
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmTaskId(task.id)}>
                          Dismiss
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <Pagination
            ariaLabel="Task pages"
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            disabled={loading}
            summary={`${total} tasks`}
          />
        )}
      </section>

      <ConfirmDialog
        isOpen={Boolean(confirmTaskId)}
        onClose={() => setConfirmTaskId(null)}
        onConfirm={async () => {
          if (confirmTaskId) {
            await handleStatusChange(confirmTaskId, 'Dismissed');
            setConfirmTaskId(null);
          }
        }}
        title="Dismiss task"
        description="Are you sure you want to dismiss this task? It will be removed from your active work queue."
        confirmLabel="Dismiss task"
        tone="danger"
      />
    </PageFrame>
  );
}
