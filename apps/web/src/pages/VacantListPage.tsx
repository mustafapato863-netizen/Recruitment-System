import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Vacancy, VacancyStatus } from '@recruitflow/contracts';
import { getApi } from '../api/client';
import {
  Alert,
  Button,
  Input,
  MetricCard,
  PageFrame,
  PageState,
  ResponsiveDataView,
  Select,
  StatusBadge,
} from '../components/ui';
import { Icon } from '../components/Icon';
import { useAuth } from '../auth/AuthContext';
import { RecruiterTargetProgressBar } from '../components/targets/RecruiterTargetProgressBar';
import { RecruiterTargetSettingsModal } from '../components/targets/RecruiterTargetSettingsModal';
import './PageEnhancementsV2.css';

export function VacantListPage() {
  const { user } = useAuth();
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | VacancyStatus>('');
  const [filterScope, setFilterScope] = useState<'ALL' | 'MINE'>('ALL');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);

  const canManageVacancies = user?.permissions.includes('VACANCY_MANAGE') || user?.permissions.includes('USERS_MANAGE');

  const load = async () => {
    setIsLoading(true);
    setError('');
    try {
      setVacancies(await getApi<Vacancy[]>('/vacancies'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load vacancies');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => vacancies.filter((vacancy) => {
    const searchable = `${vacancy.vacancyCode} ${vacancy.positionId} ${vacancy.branchId}`.toLowerCase();
    const matchesSearch = !search || searchable.includes(search.toLowerCase());
    const matchesStatus = !status || vacancy.status === status;
    const isAssignedToMe = Boolean(vacancy.assignments?.some((a) => a.userId === user?.id && a.isActive));
    const matchesScope = filterScope === 'ALL' || isAssignedToMe;
    return matchesSearch && matchesStatus && matchesScope;
  }), [vacancies, search, status, filterScope, user?.id]);

  const openVacancies = vacancies.filter((vacancy) => vacancy.status === 'Open').length;
  const totalRequired = vacancies.reduce((total, vacancy) => total + vacancy.approvedHeadcount, 0);
  const unfilledPositions = vacancies.reduce(
    (total, vacancy) => total + Math.max(0, vacancy.approvedHeadcount - vacancy.joinedHeadcount),
    0,
  );
  const stalledVacancies = vacancies.filter(
    (vacancy) => vacancy.status === 'On Hold' || vacancy.status === 'Pending Activation',
  ).length;

  return (
    <PageFrame
      eyebrow="Recruitment Hub"
      title="Openings & Job Cards"
      description="Direct Odoo-style hiring hub: track positions, candidate pipelines, recruiter assignments, and live targets."
      actions={
        <div className="flex items-center gap-2">
          {canManageVacancies && (
            <Button variant="secondary" size="sm" onClick={() => setIsTargetModalOpen(true)}>
              <Icon name="settings" size={13} />
              Set Recruiter Targets
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => void load()}>
            <Icon name="refresh-cw" size={13} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </Button>
          <Button variant="primary" size="sm" asChild>
            <Link to="/vacancy-requests/create">
              <Icon name="plus" size={14} />
              Create Vacancy
            </Link>
          </Button>
        </div>
      }
    >
      {error && (
        <Alert
          tone="danger"
          title="Vacancies could not be loaded"
          action={
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              <Icon name="refresh-cw" size={13} />
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {/* Recruiter Activity & KPI Targets Component */}
      <RecruiterTargetProgressBar
        canConfigure={canManageVacancies}
        onConfigureClick={() => setIsTargetModalOpen(true)}
      />

      {/* Quick Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="Open Vacancies" value={openVacancies} detail="Active demand" tone="action" icon={<Icon name="briefcase" size={14} />} />
        <MetricCard label="Total Required HC" value={totalRequired} detail="Approved slots" tone="info" icon={<Icon name="users" size={14} />} />
        <MetricCard label="Unfilled Positions" value={unfilledPositions} detail="Remaining slots" tone="danger" icon={<Icon name="alert-triangle" size={14} />} />
        <MetricCard label="On Hold / Pending" value={stalledVacancies} detail="Paused demand" tone="warning" icon={<Icon name="offer" size={14} />} />
        <MetricCard label="Joined / Hired" value={vacancies.reduce((acc, v) => acc + v.joinedHeadcount, 0)} detail="Onboarded talent" tone="success" icon={<Icon name="check-circle" size={14} />} />
      </div>

      {/* Toolbar & Filters */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rf-border bg-white dark:bg-rf-surface p-3 shadow-xs">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <Input
              className="min-w-64 flex-1 bg-white"
              aria-label="Search vacancies"
              placeholder="Search by vacancy code, position, or branch..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            {/* Scope Filter: All vs My Assigned */}
            <div className="flex items-center rounded-lg border border-rf-border bg-rf-surface-subtle p-0.5 text-xs font-medium">
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 transition-all ${
                  filterScope === 'ALL'
                    ? 'bg-white dark:bg-rf-surface font-bold text-rf-primary shadow-xs'
                    : 'text-rf-ink-muted hover:text-rf-ink'
                }`}
                onClick={() => setFilterScope('ALL')}
              >
                All Vacancies ({vacancies.length})
              </button>
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 transition-all ${
                  filterScope === 'MINE'
                    ? 'bg-white dark:bg-rf-surface font-bold text-rf-primary shadow-xs'
                    : 'text-rf-ink-muted hover:text-rf-ink'
                }`}
                onClick={() => setFilterScope('MINE')}
              >
                Assigned to Me
              </button>
            </div>

            <Select
              className="w-44 bg-white"
              aria-label="Filter by status"
              value={status}
              onChange={(event) => setStatus(event.target.value as '' | VacancyStatus)}
            >
              <option value="">All Statuses</option>
              {['Pending Activation', 'Open', 'On Hold', 'Partially Filled', 'Filled', 'Cancelled'].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </Select>
          </div>

          {/* View Mode Toggle: Cards vs Table */}
          <div className="flex items-center rounded-lg border border-rf-border bg-rf-surface-subtle p-0.5">
            <button
              type="button"
              className={`p-1.5 rounded-md transition-all ${viewMode === 'cards' ? 'bg-white dark:bg-rf-surface text-rf-primary shadow-xs' : 'text-rf-ink-muted'}`}
              onClick={() => setViewMode('cards')}
              title="Kanban Cards Grid"
              aria-label="Cards view"
            >
              <Icon name="folder-kanban" size={16} />
            </button>
            <button
              type="button"
              className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white dark:bg-rf-surface text-rf-primary shadow-xs' : 'text-rf-ink-muted'}`}
              onClick={() => setViewMode('table')}
              title="Table View"
              aria-label="Table view"
            >
              <Icon name="list" size={16} />
            </button>
          </div>
        </div>

        {/* Content View */}
        {isLoading ? (
          <PageState kind="loading" title="Loading job vacancies" description="Fetching active demand and pipelines." />
        ) : filtered.length === 0 ? (
          <PageState kind="empty" title="No matching job vacancies" description="Adjust your search filters or create a new vacancy." />
        ) : viewMode === 'cards' ? (
          /* Odoo-Inspired Job Cards Grid */
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((vacancy) => {
              const fillPct = Math.min(100, Math.round((vacancy.joinedHeadcount / Math.max(1, vacancy.approvedHeadcount)) * 100));
              const isAssigned = vacancy.assignments?.some((a) => a.isActive);
              return (
                <article
                  key={vacancy.id}
                  className="group relative flex flex-col justify-between rounded-2xl border border-rf-border bg-white dark:bg-rf-surface p-5 shadow-xs hover:shadow-md hover:border-rf-primary/40 transition-all"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold font-mono tracking-wider text-rf-ink-muted uppercase">
                            {vacancy.vacancyCode}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rf-success-strong bg-rf-success-soft px-1.5 py-0.2 rounded border border-rf-success-border">
                            <i className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Careers Portal
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-rf-ink dark:text-white mt-0.5 group-hover:text-rf-primary transition-colors">
                          {vacancy.position?.title || vacancy.title || vacancy.positionId}
                        </h3>
                        <p className="text-xs text-rf-ink-muted flex items-center gap-1 mt-0.5">
                          <Icon name="building" size={12} />
                          {vacancy.branch?.name || vacancy.location || vacancy.branchId}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <StatusBadge status={vacancy.status} />
                        <button type="button" className="text-rf-ink-muted hover:text-rf-ink" title="Job Actions" aria-label="Job Actions">
                          <Icon name="more" size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Headcount Progress */}
                    <div className="space-y-1.5 rounded-xl bg-rf-surface-subtle/70 p-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-rf-ink-muted">Headcount Fulfilled:</span>
                        <span className="font-bold text-rf-ink dark:text-white">
                          {vacancy.joinedHeadcount} / {vacancy.approvedHeadcount} ({fillPct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                          style={{ width: `${fillPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Recruiter Badge */}
                    <div className="flex items-center justify-between text-xs text-rf-ink-muted pt-1">
                      <span className="flex items-center gap-1.5">
                        <Icon name="user-cog" size={13} className="text-rf-primary" />
                        Recruiter: <b className="text-rf-ink dark:text-white">{isAssigned ? 'Sarah Ahmed' : 'Unassigned'}</b>
                      </span>
                      <span className="text-[11px] text-rf-ink-muted flex items-center gap-1">
                        <Icon name="calendar-clock" size={12} className="text-purple-600" />
                        Interviews: <b>3 Active</b>
                      </span>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="mt-4 flex items-center gap-2 border-t border-rf-border/60 pt-3">
                    <Button variant="primary" size="sm" className="flex-1 text-xs" asChild>
                      <Link to={`/applications?vacancyId=${vacancy.id}`}>
                        <Icon name="pipeline" size={13} />
                        Job Pipeline
                        <Icon name="chevron-right" size={12} />
                      </Link>
                    </Button>
                    <Button variant="secondary" size="sm" className="text-xs" asChild>
                      <Link to={`/vacancies/${vacancy.id}`}>Details</Link>
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <section className="rf-table-shell rf-long-content overflow-hidden rounded-2xl border border-rf-border bg-white shadow-xs">
            <ResponsiveDataView<Vacancy>
              rows={filtered}
              label="Vacancies"
              columns={[
                {
                  key: 'vacancyCode',
                  header: 'Vacancy Code',
                  priority: 'primary',
                  render: (vacancy) => (
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-rf-action-soft text-rf-action flex items-center justify-center shrink-0">
                        <Icon name="building" size={14} />
                      </div>
                      <div>
                        <div className="text-rf-ink font-bold">{vacancy.vacancyCode}</div>
                        <div className="text-rf-ink-muted text-xs">Created {new Date(vacancy.createdAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'position',
                  header: 'Position / Branch',
                  priority: 'secondary',
                  render: (vacancy) => (
                    <>
                      <div className="text-rf-ink font-medium">{vacancy.position?.title || vacancy.title || vacancy.positionId}</div>
                      <div className="text-rf-ink-muted text-xs">{vacancy.branch?.name || vacancy.location || vacancy.branchId}</div>
                    </>
                  ),
                },
                {
                  key: 'joinedHc',
                  header: 'Headcount',
                  priority: 'tertiary',
                  render: (vacancy) => (
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-rf-ink">
                        {vacancy.joinedHeadcount} / {vacancy.approvedHeadcount}
                      </span>
                    </div>
                  ),
                },
                { key: 'status', header: 'Status', priority: 'secondary', render: (vacancy) => <StatusBadge status={vacancy.status} /> },
                {
                  key: 'actions',
                  header: 'Actions',
                  priority: 'primary',
                  render: (vacancy) => (
                    <div className="flex items-center gap-1.5">
                      <Button variant="primary" size="sm" asChild>
                        <Link to={`/applications?vacancyId=${vacancy.id}`}>Pipeline</Link>
                      </Button>
                      <Button variant="secondary" size="sm" asChild>
                        <Link to={`/vacancies/${vacancy.id}`}>View</Link>
                      </Button>
                    </div>
                  ),
                },
              ]}
              rowKey={(v) => v.id}
            />
          </section>
        )}
      </section>

      {/* Target Settings Modal */}
      <RecruiterTargetSettingsModal
        isOpen={isTargetModalOpen}
        onClose={() => setIsTargetModalOpen(false)}
        onSaved={() => {
          // Re-render
          setIsTargetModalOpen(false);
        }}
      />
    </PageFrame>
  );
}
