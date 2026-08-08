import { useState, useEffect, useCallback } from 'react';
import { getApi, patchApi } from '../api/client';
import { Spinner } from '../components/Spinner';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { MetricCard } from '../components/ui/MetricCard';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { StatusBadge } from '../components/StatusBadge';
import type { TaskRecord, PaginatedResult } from '@recruitflow/contracts';

const STATUSES = ['Open', 'In Progress', 'Completed', 'Dismissed'] as const;
const PRIORITIES = ['Low', 'Normal', 'High', 'Critical'] as const;

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
      setTasks((prev) => prev.map((task) => task.id === id ? updated : task));
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
      title="My Tasks"
      description={loading ? 'Loading your assigned work...' : `${total} task${total !== 1 ? 's' : ''}${overdueCount > 0 ? ` - ${overdueCount} overdue` : ''}`}
      actions={<Button variant="ghost" size="sm" onClick={() => void load()}>Refresh</Button>}
    >
      <div className="ui-metric-grid ui-metric-grid--compact">
        <MetricCard label="All tasks" value={total} detail="Assigned to you" tone="action" icon="✓" />
        <MetricCard label="Visible now" value={tasks.length} detail={`Page ${page} of ${Math.max(totalPages, 1)}`} tone="info" icon="≡" />
        <MetricCard label="Overdue" value={overdueCount} detail="Needs attention" tone={overdueCount > 0 ? 'warning' : 'success'} icon="!" />
      </div>

      <div className="ui-filter-bar" aria-label="Task filters">
        <input
          type="search"
          placeholder="Search tasks..."
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(1); }}
          aria-label="Search tasks"
        />
        <select value={filterStatus} onChange={(event) => { setFilterStatus(event.target.value); setPage(1); }} aria-label="Filter by status">
          <option value="">All statuses</option>
          {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
        <select value={filterPriority} onChange={(event) => { setFilterPriority(event.target.value); setPage(1); }} aria-label="Filter by priority">
          <option value="">All priorities</option>
          {PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
        </select>
        <label className="ui-filter-bar__check">
          <input type="checkbox" checked={overdueOnly} onChange={(event) => { setOverdueOnly(event.target.checked); setPage(1); }} />
          Overdue only
        </label>
        {hasFilters && <Button variant="quiet" size="sm" onClick={clearFilters}>Clear filters</Button>}
      </div>

      {error && <Alert className="ui-page-alert" tone="danger" title="Tasks could not be loaded">
        {error}<Button className="ui-page-state__action" variant="danger" size="sm" onClick={() => void load()}>Retry</Button>
      </Alert>}

      {loading && <PageState kind="loading" title="Loading tasks" description="Refreshing your current workload." />}

      {!loading && !error && tasks.length === 0 && <PageState
        kind="empty"
        title={hasFilters ? 'No matching tasks' : 'You are all caught up'}
        description={hasFilters ? 'Try clearing a filter or changing your search.' : 'No tasks are currently assigned to you.'}
        actionLabel={hasFilters ? 'Clear filters' : undefined}
        onAction={hasFilters ? clearFilters : undefined}
      />}

      {!loading && tasks.length > 0 && (
        <div className="ui-task-list">
          {tasks.map((task) => (
            <article key={task.id} className={['ui-task-card', task.isOverdue ? 'is-overdue' : '', task.priority === 'Critical' ? 'is-critical' : ''].filter(Boolean).join(' ')}>
              <div className="ui-task-card__body">
                <div className="ui-task-card__title">
                  <span>{task.title}</span>
                  {task.isOverdue && <span className="ui-task-card__overdue">OVERDUE</span>}
                </div>
                {task.description && <p className="ui-task-card__description">{task.description}</p>}
                <div className="ui-task-card__meta">
                  <StatusBadge status={task.priority} />
                  <StatusBadge status={task.status} />
                  <span>{task.type}</span>
                  {task.dueAt && <span className={task.isOverdue ? 'ui-task-card__due is-overdue' : 'ui-task-card__due'}>
                    Due {new Date(task.dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>}
                </div>
              </div>

              {task.status !== 'Completed' && task.status !== 'Dismissed' && (
                <div className="ui-task-card__actions">
                  {updatingId === task.id ? <Spinner size={18} aria-label="Updating task" /> : <>
                    {task.status === 'Open' && <Button variant="secondary" size="sm" onClick={() => void handleStatusChange(task.id, 'In Progress')}>Start</Button>}
                    <Button variant="primary" size="sm" onClick={() => void handleStatusChange(task.id, 'Completed')}>Complete</Button>
                    <Button variant="quiet" size="sm" onClick={() => void handleStatusChange(task.id, 'Dismissed')}>Dismiss</Button>
                  </>}
                </div>
              )}
              {(task.status === 'Completed' || task.status === 'Dismissed') && <span className="ui-task-card__completed">
                {task.completedAt ? new Date(task.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
              </span>}
            </article>
          ))}
        </div>
      )}

      {totalPages > 1 && <div className="ui-pagination">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button>
        <span>Page {page} of {totalPages}</span>
        <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Next</Button>
      </div>}
    </PageFrame>
  );
}

