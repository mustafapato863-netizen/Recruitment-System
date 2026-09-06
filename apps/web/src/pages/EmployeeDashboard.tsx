import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { VacancyRequest, TaskRecord } from '@recruitflow/contracts';
import { getApi } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/StatusBadge';
import { Icon } from '../components/Icon';
import { Alert } from '../components/ui/Alert';
import { QuickGuideTrigger } from '../quickguide';

export function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<VacancyRequest[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const greetingName = user?.displayName?.trim().split(/\s+/)[0] ?? 'there';

  useEffect(() => {
    async function loadEmployeeData() {
      setIsLoading(true);
      setError('');
      try {
        const [requestsRes, tasksRes] = await Promise.allSettled([
          getApi<VacancyRequest[]>('/vacancy-requests'),
          getApi<TaskRecord[]>('/tasks'),
        ]);

        if (requestsRes.status === 'fulfilled' && requestsRes.value) {
          const myRequests = requestsRes.value.filter(
            (r) => !r.requesterId || r.requesterId === user?.id || requestsRes.value.length <= 5
          );
          setRequests(myRequests);
        }
        if (tasksRes.status === 'fulfilled' && tasksRes.value) {
          setTasks(tasksRes.value.filter((t) => t.status !== 'Completed'));
        }
      } catch {
        setError('Unable to load your requests. Please refresh.');
      } finally {
        setIsLoading(false);
      }
    }

    void loadEmployeeData();
  }, [user?.id]);

  const pendingRequestsCount = requests.filter((r) => r.status === 'Pending Approval' || r.status === 'Draft').length;
  const approvedRequestsCount = requests.filter((r) => r.status === 'Approved').length;

  return (
    <div className="page flex w-full flex-col px-4 py-5 sm:px-6 lg:px-[26px] lg:py-7 mx-auto min-h-screen">
      {/* Hero Welcome Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7 bg-gradient-to-r from-blue-600/10 via-indigo-500/5 to-transparent p-6 rounded-2xl border border-rf-border-subtle bg-rf-surface">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-[11px] font-bold text-blue-700 dark:text-blue-300 mb-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            Employee Workspace
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-rf-heading font-black tracking-tight text-rf-ink m-0">
              Welcome back, {greetingName} 👋
            </h1>
            <QuickGuideTrigger />
          </div>
          <p className="text-sm font-medium text-rf-ink-muted m-0 mt-1">
            Request new team headcount, track approval workflows, and view assigned recruitment tasks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="md"
            className="shadow-sm font-bold"
            onClick={() => navigate('/vacancy-requests/create')}
          >
            <Icon name="plus" size={16} />
            New Vacancy Request
          </Button>
        </div>
      </header>

      {error && (
        <Alert tone="danger" title="Service Notice" className="mb-6">
          {error}
        </Alert>
      )}

      {/* Summary KPI Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-7">
        <div className="flex items-center gap-4 p-4 rounded-xl border border-rf-border-subtle bg-rf-surface shadow-2xs">
          <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Icon name="clock" size={20} />
          </div>
          <div>
            <div className="text-xs font-bold text-rf-ink-muted uppercase tracking-wider">Pending Requests</div>
            <div className="text-2xl font-black text-rf-ink">{isLoading ? '—' : pendingRequestsCount}</div>
          </div>
        </div>

        <div className="flex items-center gap-4 p-4 rounded-xl border border-rf-border-subtle bg-rf-surface shadow-2xs">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Icon name="check-circle" size={20} />
          </div>
          <div>
            <div className="text-xs font-bold text-rf-ink-muted uppercase tracking-wider">Approved Requests</div>
            <div className="text-2xl font-black text-rf-ink">{isLoading ? '—' : approvedRequestsCount}</div>
          </div>
        </div>

        <div className="flex items-center gap-4 p-4 rounded-xl border border-rf-border-subtle bg-rf-surface shadow-2xs">
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Icon name="tasks" size={20} />
          </div>
          <div>
            <div className="text-xs font-bold text-rf-ink-muted uppercase tracking-wider">Active Tasks</div>
            <div className="text-2xl font-black text-rf-ink">{isLoading ? '—' : tasks.length}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: My Vacancy Requests (8 Cols) */}
        <section className="lg:col-span-8 flex flex-col rounded-2xl border border-rf-border-subtle bg-rf-surface p-5 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-rf-border-subtle mb-4">
            <div>
              <h2 className="text-base font-black text-rf-ink m-0">My Headcount &amp; Vacancy Requests</h2>
              <p className="text-xs text-rf-ink-muted m-0 mt-0.5">Track requisition progress and management approvals</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => navigate('/vacancy-requests')}>
              View all
            </Button>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-sm font-medium text-rf-ink-muted flex flex-col items-center justify-center gap-2">
              <Icon name="refresh-cw" size={20} className="animate-spin text-rf-action" />
              Loading requests...
            </div>
          ) : requests.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-rf-surface-subtle flex items-center justify-center mb-3">
                <Icon name="file-text" size={26} className="text-rf-ink-muted" />
              </div>
              <p className="text-sm font-bold text-rf-ink m-0">No vacancy requests submitted yet</p>
              <p className="text-xs text-rf-ink-muted mt-1 max-w-sm">
                Need to hire for your team? Submit a requisition to start the hiring and approval process.
              </p>
              <Button
                variant="primary"
                size="sm"
                className="mt-4"
                onClick={() => navigate('/vacancy-requests/create')}
              >
                <Icon name="plus" size={14} />
                Create First Request
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {requests.slice(0, 5).map((req) => (
                <div
                  key={req.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-rf-border-subtle hover:border-rf-border bg-rf-surface-subtle/30 hover:bg-rf-surface-subtle/70 transition gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-rf-action">{req.requestCode}</span>
                      <StatusBadge status={req.status} />
                    </div>
                    <div className="text-sm font-bold text-rf-ink mt-1 truncate">
                      {(req as any).position?.title ?? req.positionId ?? 'Position Requisition'}
                    </div>
                    <div className="text-xs text-rf-ink-muted mt-0.5 flex items-center gap-3">
                      <span>Headcount: <strong>{req.requestedHeadcount}</strong></span>
                      {req.targetStartDate && (
                        <span>Target: <strong>{new Date(req.targetStartDate).toLocaleDateString()}</strong></span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(`/vacancy-requests/${req.id}`)}
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right Column: Pending Tasks & Quick Actions (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Assigned Tasks Card */}
          <section className="flex flex-col rounded-2xl border border-rf-border-subtle bg-rf-surface p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-rf-border-subtle mb-3">
              <h2 className="text-sm font-bold text-rf-ink m-0">My Tasks</h2>
              <Link to="/tasks" className="text-xs font-bold text-rf-action hover:underline">
                View all
              </Link>
            </div>

            {tasks.length === 0 ? (
              <div className="py-6 text-center text-xs text-rf-ink-muted">
                <Icon name="check" size={20} className="mx-auto text-emerald-500 mb-1" />
                No pending tasks right now. You are all caught up!
              </div>
            ) : (
              <ul className="flex flex-col gap-2 m-0 p-0 list-none">
                {tasks.slice(0, 4).map((task) => (
                  <li
                    key={task.id}
                    className="p-3 rounded-xl border border-rf-border-subtle bg-rf-surface-subtle/40 flex items-start gap-2.5"
                  >
                    <Icon name="alert-circle" size={15} className="text-amber-500 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-rf-ink truncate">{task.title}</div>
                      <div className="text-[11px] text-rf-ink-muted mt-0.5">
                        Due {task.dueAt ? new Date(task.dueAt).toLocaleDateString() : 'soon'}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Quick Help / Employee Referral Card */}
          <section className="flex flex-col rounded-2xl border border-rf-border-subtle bg-gradient-to-br from-rf-surface to-rf-surface-subtle p-5 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 flex items-center justify-center mb-3">
              <Icon name="users" size={16} />
            </div>
            <h3 className="text-sm font-bold text-rf-ink m-0">Know great talent?</h3>
            <p className="text-xs text-rf-ink-muted mt-1.5 leading-relaxed">
              Refer colleagues or friends to join Saudi German Health and track their application progress directly.
            </p>
            <div className="mt-4 pt-3 border-t border-rf-border-subtle flex justify-between items-center text-xs">
              <span className="text-rf-ink-muted font-medium">Internal Referral Policy</span>
              <Link to="/notifications" className="font-bold text-rf-action hover:underline">
                Learn more
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
