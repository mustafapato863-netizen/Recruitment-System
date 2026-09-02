import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { VacancyRequest } from '@recruitflow/contracts';
import { getApi } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import { Icon } from '../components/Icon';

interface EmployeeTask {
  id: string;
  title: string;
  status: string;
  dueDate?: string;
  priority?: string;
}

export function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<VacancyRequest[]>([]);
  const [tasks, setTasks] = useState<EmployeeTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const greetingName = user?.displayName?.trim().split(/\s+/)[0] ?? 'there';

  useEffect(() => {
    async function loadEmployeeData() {
      setIsLoading(true);
      try {
        const [requestsRes, tasksRes] = await Promise.allSettled([
          getApi<VacancyRequest[]>('/vacancy-requests'),
          getApi<EmployeeTask[]>('/tasks'),
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
      } catch (err) {
        console.error('Unable to load employee requests', err);
      } finally {
        setIsLoading(false);
      }
    }

    void loadEmployeeData();
  }, [user?.id]);

  const pendingRequestsCount = requests.filter((r) => r.status === 'Pending Approval' || r.status === 'Draft').length;
  const approvedRequestsCount = requests.filter((r) => r.status === 'Approved').length;

  return (
    <div className="w-full max-w-[1720px] mx-auto p-4 sm:p-6 lg:p-7 space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-lg border border-gray-200 shadow-xs">
        <div>
          <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full inline-block mb-1.5">
            Employee Workspace
          </span>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">
            Welcome back, {greetingName} 👋
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Request team headcount, track approval workflows, and view assigned recruitment tasks.
          </p>
        </div>

        <div>
          <button
            type="button"
            onClick={() => navigate('/vacancy-requests/create')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
          >
            <Icon name="plus" size={14} /> New Vacancy Request
          </button>
        </div>
      </div>

      {/* ── Summary KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
            <Icon name="clock" size={18} />
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-500 block uppercase">Pending Requests</span>
            <span className="text-2xl font-bold text-gray-900 tnum">{isLoading ? '—' : pendingRequestsCount}</span>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
            <Icon name="check-circle" size={18} />
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-500 block uppercase">Approved Requests</span>
            <span className="text-2xl font-bold text-gray-900 tnum">{isLoading ? '—' : approvedRequestsCount}</span>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
            <Icon name="list" size={18} />
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-500 block uppercase">Active Tasks</span>
            <span className="text-2xl font-bold text-gray-900 tnum">{isLoading ? '—' : tasks.length}</span>
          </div>
        </div>
      </div>

      {/* ── Main 2-Column Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: My Headcount & Vacancy Requests (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-lg border border-gray-200 p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
            <div>
              <h2 className="text-sm font-bold text-gray-900">My Headcount &amp; Vacancy Requests</h2>
              <p className="text-xs text-gray-500">Track requisition progress and management approvals</p>
            </div>
            <button
              onClick={() => navigate('/vacancy-requests')}
              className="text-xs text-blue-600 font-semibold hover:underline"
            >
              View all
            </button>
          </div>

          {requests.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-500">
              <Icon name="file-text" size={24} className="mx-auto text-gray-400 mb-2" />
              No vacancy requests submitted yet.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {requests.slice(0, 5).map((req) => (
                <div key={req.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-blue-600">{req.requestCode}</span>
                      <StatusBadge status={req.status} />
                    </div>
                    <p className="font-bold text-gray-900 mt-1">
                      {req.positionId ?? 'Position Requisition'}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Requested Headcount: <strong>{req.requestedHeadcount}</strong>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate(`/vacancy-requests/${req.id}`)}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-bold text-gray-700"
                  >
                    View Details
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Tasks & Referrals (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Tasks */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">My Tasks</h2>
              <button
                onClick={() => navigate('/tasks')}
                className="text-xs text-blue-600 font-semibold hover:underline"
              >
                View all
              </button>
            </div>

            {tasks.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-500">
                <Icon name="check-circle" size={18} className="mx-auto text-emerald-500 mb-1" />
                No pending tasks. You are all caught up!
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                {tasks.slice(0, 4).map((t) => (
                  <div key={t.id} className="p-2.5 rounded bg-gray-50 border border-gray-100">
                    <h4 className="font-bold text-gray-900">{t.title}</h4>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Due {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'soon'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Referrals Banner */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-2">
              <Icon name="users" size={16} />
            </div>
            <h3 className="text-xs font-bold text-gray-900">Know great talent?</h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Refer colleagues to join Saudi German Health and track their application progress directly.
            </p>
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
              <span className="text-gray-400">Referral Program</span>
              <button onClick={() => navigate('/notifications')} className="font-bold text-blue-600 hover:underline">
                Learn more &gt;
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
