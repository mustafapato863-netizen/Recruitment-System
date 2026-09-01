import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Vacancy, Application, ReportOverview } from '@recruitflow/contracts';
import { getApi } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/Icon';
import { Alert } from '../components/ui/Alert';
import { StatusBadge } from '../components/StatusBadge';
import { RecruiterTargetProgressBar } from '../components/targets/RecruiterTargetProgressBar';
import { RecruiterTargetSettingsModal } from '../components/targets/RecruiterTargetSettingsModal';
import './PageEnhancementsV2.css';

export function ManagerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [overview, setOverview] = useState<ReportOverview | null>(null);
  const [search, setSearch] = useState('');
  const [filterDepartment, setFilterDepartment] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);

  const canManageVacancies = user?.permissions.includes('VACANCY_MANAGE') || user?.permissions.includes('USERS_MANAGE');
  const greetingName = user?.displayName?.trim().split(/\s+/)[0] ?? 'there';

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [vacanciesRes, applicationsRes, overviewRes] = await Promise.allSettled([
        getApi<Vacancy[]>('/vacancies'),
        getApi<{ data: Application[] }>('/applications?pageSize=100'),
        getApi<ReportOverview>('/reports/overview?from=' + new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10) + '&to=' + new Date().toISOString().slice(0, 10)),
      ]);

      if (vacanciesRes.status === 'fulfilled' && vacanciesRes.value) {
        setVacancies(vacanciesRes.value);
      }
      if (applicationsRes.status === 'fulfilled' && applicationsRes.value?.data) {
        setApplications(applicationsRes.value.data);
      }
      if (overviewRes.status === 'fulfilled' && overviewRes.value) {
        setOverview(overviewRes.value);
      }
    } catch {
      setError('Failed to load recruitment dashboard data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Aggregate applications per vacancy
  const appsByVacancy = useMemo(() => {
    const map: Record<string, { total: number; new: number; interview: number; offer: number }> = {};
    for (const app of applications) {
      if (!map[app.vacancyId]) {
        map[app.vacancyId] = { total: 0, new: 0, interview: 0, offer: 0 };
      }
      map[app.vacancyId].total += 1;
      if (app.stage === 'New' || app.stage === 'Applied') map[app.vacancyId].new += 1;
      if (app.stage === 'Interview') map[app.vacancyId].interview += 1;
      if (app.stage === 'Offer') map[app.vacancyId].offer += 1;
    }
    return map;
  }, [applications]);

  // Department extraction
  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const v of vacancies) {
      const dept = v.position?.title?.split(' ')?.[0] || v.branchId || 'General';
      set.add(dept);
    }
    return Array.from(set);
  }, [vacancies]);

  const filteredVacancies = useMemo(() => {
    return vacancies.filter((v) => {
      const matchSearch =
        !search ||
        v.vacancyCode.toLowerCase().includes(search.toLowerCase()) ||
        (v.position?.title && v.position.title.toLowerCase().includes(search.toLowerCase())) ||
        v.location?.toLowerCase().includes(search.toLowerCase());

      const matchDept = filterDepartment === 'ALL' || (v.position?.title && v.position.title.includes(filterDepartment));

      return matchSearch && matchDept;
    });
  }, [vacancies, search, filterDepartment]);

  const openVacanciesCount = vacancies.filter((v) => v.status === 'Open').length;
  const activeCandidatesCount = applications.filter((a) => a.stage !== 'Joined' && a.stage !== 'Rejected').length;
  const offersCount = applications.filter((a) => a.stage === 'Offer').length;
  const newApplicationsCount = applications.filter((a) => a.stage === 'New' || a.stage === 'Applied').length;

  return (
    <div className="page flex w-full flex-col px-4 py-5 sm:px-6 lg:px-[26px] lg:py-7 mx-auto min-h-screen">
      {/* Top Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-[11px] font-bold text-blue-700 dark:text-blue-300 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Odoo-Style Hiring Command Center
          </div>
          <h1 className="text-xl sm:text-2xl font-rf-heading font-black tracking-tight text-rf-ink m-0">
            Recruitment Hub &bull; {greetingName}
          </h1>
          <p className="text-xs sm:text-sm font-medium text-rf-ink-muted m-0 mt-0.5">
            Select a job position to open its live candidate pipeline, drag applicants between stages, or track approvals.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void loadData()}
            disabled={isLoading}
            className="bg-rf-surface shadow-2xs"
          >
            <Icon name="refresh-cw" size={13} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </Button>

          {canManageVacancies && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsTargetModalOpen(true)}
              className="bg-rf-surface shadow-2xs"
            >
              <Icon name="settings" size={13} />
              Set Targets
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/vacancies')}
            className="shadow-sm font-bold"
          >
            <Icon name="plus" size={14} />
            New Opening
          </Button>
        </div>
      </header>

      {error && (
        <Alert tone="danger" title="Notice" className="mb-6">
          {error}
        </Alert>
      )}

      {/* Recruiter Activity Targets Progress Bar */}
      <RecruiterTargetProgressBar
        className="mb-6"
        canConfigure={canManageVacancies}
        onConfigureClick={() => setIsTargetModalOpen(true)}
      />

      {/* Quick Metrics Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-6">
        <div className="flex items-center gap-3.5 p-3.5 rounded-xl border border-rf-border-subtle bg-rf-surface shadow-2xs">
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Icon name="briefcase" size={18} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-rf-ink-muted uppercase tracking-wider">Open Openings</div>
            <div className="text-xl font-black text-rf-ink">{isLoading ? '—' : openVacanciesCount}</div>
          </div>
        </div>

        <div className="flex items-center gap-3.5 p-3.5 rounded-xl border border-rf-border-subtle bg-rf-surface shadow-2xs">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Icon name="users" size={18} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-rf-ink-muted uppercase tracking-wider">Active Candidates</div>
            <div className="text-xl font-black text-rf-ink">{isLoading ? '—' : activeCandidatesCount}</div>
          </div>
        </div>

        <div className="flex items-center gap-3.5 p-3.5 rounded-xl border border-rf-border-subtle bg-rf-surface shadow-2xs">
          <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Icon name="mail" size={18} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-rf-ink-muted uppercase tracking-wider">New Inflow</div>
            <div className="text-xl font-black text-rf-ink">{isLoading ? '—' : newApplicationsCount}</div>
          </div>
        </div>

        <div className="flex items-center gap-3.5 p-3.5 rounded-xl border border-rf-border-subtle bg-rf-surface shadow-2xs">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Icon name="file-check" size={18} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-rf-ink-muted uppercase tracking-wider">Offers Stage</div>
            <div className="text-xl font-black text-rf-ink">{isLoading ? '—' : offersCount}</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-rf-ink-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by job title, code, or hospital branch..."
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-rf-border-subtle bg-rf-surface text-xs font-medium text-rf-ink placeholder:text-rf-ink-muted focus:outline-none focus:border-rf-action"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setFilterDepartment('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              filterDepartment === 'ALL'
                ? 'bg-rf-ink text-white dark:bg-white dark:text-rf-ink shadow-xs'
                : 'bg-rf-surface border border-rf-border-subtle text-rf-ink-muted hover:text-rf-ink'
            }`}
          >
            All Positions ({vacancies.length})
          </button>
          {departments.slice(0, 4).map((dept) => (
            <button
              key={dept}
              type="button"
              onClick={() => setFilterDepartment(dept)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                filterDepartment === dept
                  ? 'bg-rf-ink text-white dark:bg-white dark:text-rf-ink shadow-xs'
                  : 'bg-rf-surface border border-rf-border-subtle text-rf-ink-muted hover:text-rf-ink'
              }`}
            >
              {dept}
            </button>
          ))}
        </div>
      </div>

      {/* Main Odoo-Style Jobs Kanban Grid */}
      {isLoading ? (
        <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
          <Icon name="refresh-cw" size={24} className="animate-spin text-rf-action" />
          <p className="text-sm font-medium text-rf-ink-muted">Loading job positions and live pipelines...</p>
        </div>
      ) : filteredVacancies.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-rf-border-subtle rounded-2xl bg-rf-surface/50 p-8">
          <div className="w-12 h-12 rounded-full bg-rf-surface-subtle flex items-center justify-center mx-auto mb-3">
            <Icon name="briefcase" size={24} className="text-rf-ink-muted" />
          </div>
          <h3 className="text-base font-bold text-rf-ink m-0">No job openings found</h3>
          <p className="text-xs text-rf-ink-muted mt-1 max-w-sm mx-auto">
            {search ? 'Try adjusting your search criteria.' : 'Create your first job opening to start receiving and screening applications.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mb-8">
          {filteredVacancies.map((vacancy) => {
            const stats = appsByVacancy[vacancy.id] || { total: 0, new: 0, interview: 0, offer: 0 };
            const hiredCount = vacancy.joinedHeadcount ?? 0;
            const targetCount = Math.max(1, vacancy.approvedHeadcount ?? 1);
            const fillPercentage = Math.min(100, Math.round((hiredCount / targetCount) * 100));

            return (
              <div
                key={vacancy.id}
                className="flex flex-col justify-between rounded-2xl border border-rf-border-subtle bg-rf-surface p-5 shadow-xs hover:shadow-md hover:border-rf-border transition-all duration-200 group"
              >
                <div>
                  {/* Card Top: Code, Status & Department */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="font-mono text-xs font-bold text-rf-action px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900">
                      {vacancy.vacancyCode}
                    </span>
                    <StatusBadge status={vacancy.status} />
                  </div>

                  {/* Job Title */}
                  <h3 className="text-base font-extrabold text-rf-ink leading-snug group-hover:text-rf-action transition-colors m-0">
                    {vacancy.position?.title ?? vacancy.vacancyCode}
                  </h3>

                  <div className="flex items-center gap-2 text-xs text-rf-ink-muted mt-1.5">
                    <Icon name="map-pin" size={13} className="shrink-0" />
                    <span className="truncate">{vacancy.location || vacancy.branchId || 'Head Office'}</span>
                  </div>

                  {/* Headcount Progress Bar */}
                  <div className="mt-4 pt-3 border-t border-rf-border-subtle">
                    <div className="flex justify-between items-baseline text-xs mb-1.5">
                      <span className="font-medium text-rf-ink-muted">Recruitment Progress</span>
                      <span className="font-bold text-rf-ink tabular-nums">
                        {hiredCount} / {targetCount} Hired ({fillPercentage}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-rf-surface-subtle rounded-full overflow-hidden border border-rf-border-subtle">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-500"
                        style={{ width: `${fillPercentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Stage Metrics Pills */}
                  <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                    <div className="p-2 rounded-lg bg-rf-surface-subtle/60 border border-rf-border-subtle">
                      <div className="text-[10px] uppercase font-bold text-rf-ink-muted">New</div>
                      <div className="text-sm font-black text-rf-ink mt-0.5">{stats.new}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-rf-surface-subtle/60 border border-rf-border-subtle">
                      <div className="text-[10px] uppercase font-bold text-rf-ink-muted">Interview</div>
                      <div className="text-sm font-black text-indigo-600 dark:text-indigo-400 mt-0.5">{stats.interview}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-rf-surface-subtle/60 border border-rf-border-subtle">
                      <div className="text-[10px] uppercase font-bold text-rf-ink-muted">Offers</div>
                      <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{stats.offer}</div>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-5 pt-3 border-t border-rf-border-subtle flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-rf-ink flex items-center gap-1.5">
                    <Icon name="users" size={14} className="text-rf-action" />
                    <span>{stats.total} Total Applicants</span>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    className="font-bold text-xs shadow-2xs"
                    onClick={() => navigate(`/applications?vacancyId=${vacancy.id}`)}
                  >
                    Open Pipeline
                    <Icon name="arrow-right" size={13} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Target Settings Modal */}
      <RecruiterTargetSettingsModal
        isOpen={isTargetModalOpen}
        onClose={() => setIsTargetModalOpen(false)}
      />
    </div>
  );
}
