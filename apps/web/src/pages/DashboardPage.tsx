import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type {
  Vacancy,
  ReportOverview,
  FunnelStage,
} from '@recruitflow/contracts';
import { getApi } from '../api/client';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { FunnelChart } from '../components/ui/FunnelChart';
import { MetricCard } from '../components/ui/MetricCard';
import { SpotlightCard } from '../components/ui/SpotlightCard';
import { TrendBarChart, type TrendDataPoint } from '../components/ui/TrendBarChart';
import { Icon } from '../components/Icon';
import { useAuth } from '../auth/AuthContext';
import { RecruiterTargetProgressBar } from '../components/targets/RecruiterTargetProgressBar';
import { RecruiterTargetSettingsModal } from '../components/targets/RecruiterTargetSettingsModal';
import './PageEnhancementsV2.css';

type DashboardDataSurface = 'vacancies' | 'funnel' | 'overview' | 'trend';

const dashboardSurfaceLabels: Record<DashboardDataSurface, string> = {
  vacancies: 'vacancies',
  funnel: 'pipeline funnel',
  overview: 'dashboard overview',
  trend: 'hiring trend',
};

const DAY_MS = 86_400_000;

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getDashboardRanges() {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const trendStart = new Date(now.getTime() - 180 * DAY_MS);
  return {
    month: { from: toDateOnly(monthStart), to: toDateOnly(now) },
    trend: { from: toDateOnly(trendStart), to: toDateOnly(now) },
  };
}

function buildOverviewPath(range: { from: string; to: string }) {
  const query = new URLSearchParams({ from: range.from, to: range.to });
  return `/reports/overview?${query.toString()}`;
}

function formatDashboardRange(range: { from: string; to: string }) {
  const formatter = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return `${formatter.format(new Date(range.from))} – ${formatter.format(new Date(range.to))}`;
}

function isWithinLastSevenDays(periodStart: string) {
  const today = new Date();
  const weekStart = new Date(today.getTime() - 6 * DAY_MS);
  return periodStart.slice(0, 10) >= toDateOnly(weekStart) && periodStart.slice(0, 10) <= toDateOnly(today);
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [overview, setOverview] = useState<ReportOverview | null>(null);
  const [trendOverview, setTrendOverview] = useState<ReportOverview | null>(null);
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [failedSurfaces, setFailedSurfaces] = useState<DashboardDataSurface[]>([]);
  const [unauthorizedSurfaces, setUnauthorizedSurfaces] = useState<DashboardDataSurface[]>([]);
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);
  const canViewVacancies = user?.permissions.includes('VACANCY_VIEW') ?? false;
  const canViewReports = user?.permissions.includes('APPLICATION_VIEW') ?? false;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [vacanciesRes, funnelRes, overviewRes, trendRes] = await Promise.allSettled([
        canViewVacancies ? getApi<Vacancy[]>('/vacancies') : Promise.resolve(null),
        canViewReports ? getApi<FunnelStage[]>('/reports/funnel') : Promise.resolve(null),
        canViewReports ? getApi<ReportOverview>(buildOverviewPath(getDashboardRanges().month)) : Promise.resolve(null),
        canViewReports ? getApi<ReportOverview>(buildOverviewPath(getDashboardRanges().trend)) : Promise.resolve(null),
      ]);

      const failures: DashboardDataSurface[] = [];
      const unauthorized: DashboardDataSurface[] = [];

      if (!canViewVacancies) unauthorized.push('vacancies');
      if (!canViewReports) {
        unauthorized.push('funnel');
        unauthorized.push('overview');
        unauthorized.push('trend');
      }

      if (vacanciesRes.status === 'fulfilled' && vacanciesRes.value) setVacancies(vacanciesRes.value);
      else if (canViewVacancies) {
        setVacancies([]);
        failures.push('vacancies');
      }
      if (funnelRes.status === 'fulfilled' && funnelRes.value) setFunnel(funnelRes.value);
      else if (canViewReports) {
        setFunnel([]);
        failures.push('funnel');
      }
      if (overviewRes.status === 'fulfilled' && overviewRes.value) setOverview(overviewRes.value);
      else if (canViewReports) {
        setOverview(null);
        failures.push('overview');
      }
      if (trendRes.status === 'fulfilled' && trendRes.value) setTrendOverview(trendRes.value);
      else if (canViewReports) {
        setTrendOverview(null);
        failures.push('trend');
      }

      setFailedSurfaces(failures);
      setUnauthorizedSurfaces(unauthorized);
      if (failures.length > 0) {
        setError(`Unavailable dashboard sections: ${failures.map((surface) => dashboardSurfaceLabels[surface]).join(', ')}.`);
      }
    } catch {
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [canViewReports, canViewVacancies]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openVacancies = vacancies.filter((vacancy) => vacancy.status === 'Open').length;
  const isUnavailable = (surface: DashboardDataSurface) => failedSurfaces.includes(surface);
  const isUnauthorized = (surface: DashboardDataSurface) => unauthorizedSurfaces.includes(surface);
  const isNoData = (surface: DashboardDataSurface) => isUnavailable(surface) || isUnauthorized(surface);

  const dashboardFunnel = overview?.funnel ?? funnel;
  const dashboardRange = overview?.range ?? getDashboardRanges().month;
  const greetingName = user?.displayName?.trim().split(/\s+/)[0] ?? '';

  const monthTotals = useMemo(
    () =>
      overview?.trend.reduce(
        (result, point) => ({
          applications: result.applications + point.applications,
          interviews: result.interviews + point.interviews,
          offers: result.offers + point.offers,
          joined: result.joined + point.joined,
        }),
        { applications: 0, interviews: 0, offers: 0, joined: 0 }
      ) ?? null,
    [overview]
  );

  const interviewsThisWeek = useMemo(
    () =>
      overview?.trend
        .filter((point) => isWithinLastSevenDays(point.periodStart))
        .reduce((total, point) => total + point.interviews, 0) ?? null,
    [overview]
  );

  const activeCandidates = useMemo(
    () =>
      dashboardFunnel
        .filter((stage) => stage.name !== 'Joined')
        .reduce((total, stage) => total + stage.count, 0),
    [dashboardFunnel]
  );

  const offersInProgress = dashboardFunnel.find((stage) => stage.name === 'Offer')?.count ?? 0;

  const agingVacanciesCount = useMemo(() => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return vacancies.filter((v) => v.status === 'Open' && new Date(v.createdAt).getTime() < thirtyDaysAgo).length;
  }, [vacancies]);

  // Only show attention items that can be derived from the current API response.
  const attentionItems = useMemo(() => {
    const items = [];
    if (!isNoData('overview')) {
      items.push({
        title: `${interviewsThisWeek ?? 0} interviews this week`,
        subtitle: 'Review the interview schedule',
        to: '/interviews',
        icon: 'calendar' as const,
        bgClass: 'bg-rf-info-soft text-rf-info',
      });
    }
    if (!isNoData('funnel')) {
      items.push({
        title: `${offersInProgress} offers in pipeline`,
        subtitle: 'Review offer progress',
        to: '/offers',
        icon: 'document' as const,
        bgClass: 'bg-rf-warning-soft text-rf-warning',
      });
    }
    if (!isNoData('overview') && !isNoData('funnel')) {
      items.push({
        title: `${activeCandidates} active candidates`,
        subtitle: 'Review candidate movement',
        to: '/candidates',
        icon: 'users' as const,
        bgClass: 'bg-rf-action-soft text-rf-action',
      });
    }
    if (!isNoData('vacancies')) {
      items.push({
        title: `${agingVacanciesCount} vacancies aging over 30 days`,
        subtitle: agingVacanciesCount > 0 ? 'Review open vacancies' : 'No aging vacancies detected',
        to: '/vacancies',
        icon: 'briefcase' as const,
        bgClass: agingVacanciesCount > 0 ? 'bg-rf-danger-soft text-rf-danger' : 'bg-rf-success-soft text-rf-success',
      });
    }
    return items;
  }, [activeCandidates, agingVacanciesCount, failedSurfaces, unauthorizedSurfaces, interviewsThisWeek, offersInProgress]);

  // Openings progress matching Image 2
  const displayOpenings = useMemo(() => {
    if (vacancies.length > 0) {
      return vacancies.slice(0, 3).map((v) => ({
        id: v.id,
        title: v.vacancyCode,
        code: v.vacancyCode,
        joined: v.joinedHeadcount ?? 0,
        target: Math.max(1, v.approvedHeadcount ?? 1),
      }));
    }
    return [];
  }, [vacancies]);

  const trendBars = useMemo<TrendDataPoint[]>(() => {
    const points = trendOverview?.trend.slice(-6) ?? [];
    return points.map((point) => ({ label: point.label, value: point.joined }));
  }, [trendOverview]);

  const displayFunnel = dashboardFunnel.map((item) => ({ name: item.name, count: item.count }));
  const hasFunnelData = displayFunnel.some((stage) => stage.count > 0);

  return (
    <>
      <div className="page flex w-full flex-col px-4 py-5 sm:px-6 lg:px-[26px] lg:py-7 mx-auto min-h-screen">
        {/* Hero Header */}
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h1 className="text-[19px] font-rf-heading font-black tracking-tight text-rf-ink m-0">
              {greetingName ? `Good morning, ${greetingName}` : 'Recruitment command center'} 👋
            </h1>
            <p className="text-sm font-medium text-rf-ink-muted m-0 mt-1">
              Here's what's happening in your recruitment workspace.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-rf-surface border border-rf-border-subtle px-3 py-1.5 rounded-lg text-xs font-bold text-rf-ink shadow-2xs">
              {formatDashboardRange(dashboardRange)}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void loadData()}
              disabled={isLoading}
              className="bg-rf-surface"
            >
              <Icon name="refresh-cw" size={13} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/vacancy-requests/create')}
              disabled={isLoading}
            >
              <Icon name="plus" size={14} />
              Create vacancy request
            </Button>
          </div>
        </header>

        {error && (
          <Alert tone="danger" title="Workspace data is unavailable" className="mb-6">
            {error}
          </Alert>
        )}

        {/* Recruiter Activity Targets Progress Bar */}
        <RecruiterTargetProgressBar
          className="mb-6"
          canConfigure={user?.permissions.includes('VACANCY_MANAGE') || user?.permissions.includes('USERS_MANAGE')}
          onConfigureClick={() => setIsTargetModalOpen(true)}
        />

        {/* Top 5 KPI Bento Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
          <MetricCard
            label="Open Vacancies"
            value={isNoData('vacancies') ? '—' : openVacancies}
            detail={isUnauthorized('vacancies') ? 'Requires VACANCY_VIEW' : isUnavailable('vacancies') ? 'Unavailable' : `${vacancies.length} total positions`}
            urgencyText={agingVacanciesCount > 0 ? `${agingVacanciesCount} AGING > 30D` : undefined}
            tone="action"
            icon={<Icon name="briefcase" size={18} />}
            infoTooltip="Count of vacancies with status 'Open' from real-time database query."
          />
          <MetricCard
            label="Active Candidates"
            value={isNoData('overview') && isNoData('funnel') ? '—' : activeCandidates.toLocaleString()}
            detail={isUnauthorized('overview') ? 'Requires APPLICATION_VIEW' : isUnavailable('overview') ? 'Pipeline unavailable' : `${monthTotals?.applications ?? 0} new this period`}
            tone="info"
            icon={<Icon name="users" size={18} />}
            infoTooltip="Total active candidates currently in the pipeline funnel across all open positions."
          />
          <MetricCard
            label="Interviews This Week"
            value={isNoData('overview') ? '—' : interviewsThisWeek ?? 0}
            detail={isUnauthorized('overview') ? 'Requires APPLICATION_VIEW' : isUnavailable('overview') ? 'Unavailable' : `${monthTotals?.interviews ?? 0} this period`}
            tone="neutral"
            icon={<Icon name="calendar" size={18} />}
            infoTooltip="Count of interviews scheduled or completed within the last 7 rolling days."
          />
          <MetricCard
            label="Offers In Progress"
            value={isNoData('funnel') ? '—' : offersInProgress}
            detail={isUnauthorized('funnel') ? 'Requires APPLICATION_VIEW' : isUnavailable('funnel') ? 'Unavailable' : `${monthTotals?.offers ?? 0} this period`}
            tone="warning"
            icon={<Icon name="document" size={18} />}
            infoTooltip="Candidates currently in the 'Offer' stage of the pipeline funnel."
          />
          <MetricCard
            label="Hires This Month"
            value={isNoData('overview') ? '—' : monthTotals?.joined ?? 0}
            detail={isUnauthorized('overview') ? 'Requires APPLICATION_VIEW' : isUnavailable('overview') ? 'Unavailable' : `${monthTotals?.joined ?? 0} joined this period`}
            tone="success"
            icon={<Icon name="check-circle" size={18} />}
            infoTooltip={`Total applications moved to 'Joined' stage during ${dashboardRange.from} to ${dashboardRange.to}.`}
          />
        </div>

        {/* Main 3-Column Grid matching Reference Image 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-6 items-stretch">
          {/* Column 1: Recruitment Funnel Card (~42% width = 5 cols) */}
          <div className="lg:col-span-5 flex flex-col min-w-0">
            {hasFunnelData && !isUnauthorized('funnel') ? (
              <FunnelChart
                title="Recruitment funnel"
                dateRangeText={overview ? formatDashboardRange(overview.range) : 'Unavailable'}
                stages={displayFunnel}
              />
            ) : (
              <div className="flex h-full min-h-[320px] flex-col justify-between rounded-2xl border border-rf-border-subtle bg-rf-surface p-5 shadow-xs relative group overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-rf-border-subtle pb-4">
                  <div>
                    <h2 className="m-0 text-[13px] font-black tracking-tight text-rf-ink">Recruitment funnel</h2>
                    <span className="text-xs font-medium text-rf-ink-muted">{overview ? formatDashboardRange(overview.range) : 'Unavailable'}</span>
                  </div>
                </div>
                {isUnauthorized('funnel') ? (
                  <div className="flex flex-col items-center justify-center flex-1 text-center py-8">
                    <div className="w-12 h-12 bg-rf-surface-subtle rounded-full flex items-center justify-center mb-4 ring-4 ring-rf-surface">
                      <Icon name="lock" size={24} className="text-rf-ink-muted" />
                    </div>
                    <p className="text-sm font-medium text-rf-ink m-0">Restricted Access</p>
                    <p className="text-xs text-rf-ink-muted mt-1">Requires APPLICATION_VIEW permission</p>
                  </div>
                ) : (
                  <>
                    <p className="m-0 text-sm font-medium text-rf-ink-muted">No persisted application activity exists for this range.</p>
                    <Link to="/applications" className="text-xs font-bold text-rf-action hover:underline">View applications</Link>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Column 2: Hiring Trend Card (~33% width = 4 cols) */}
          <div className="lg:col-span-4 flex flex-col min-w-0">
            {trendBars.length > 0 && !isUnauthorized('trend') ? (
              <TrendBarChart
                title="Hiring trend"
                dateRangeText="Last 6 months"
                data={trendBars}
                tooltipLabel="hires"
              />
            ) : (
              <div className="flex h-full min-h-[320px] flex-col justify-between rounded-2xl border border-rf-border-subtle bg-rf-surface p-5 shadow-xs">
                <div className="flex items-center justify-between gap-3 border-b border-rf-border-subtle pb-4">
                  <div>
                    <h2 className="m-0 text-[13px] font-black tracking-tight text-rf-ink">Hiring trend</h2>
                    <span className="text-xs font-medium text-rf-ink-muted">Last 6 months</span>
                  </div>
                </div>
                {isUnauthorized('trend') ? (
                  <div className="flex flex-col items-center justify-center flex-1 text-center py-8">
                    <div className="w-12 h-12 bg-rf-surface-subtle rounded-full flex items-center justify-center mb-4 ring-4 ring-rf-surface">
                      <Icon name="lock" size={24} className="text-rf-ink-muted" />
                    </div>
                    <p className="text-sm font-medium text-rf-ink m-0">Restricted Access</p>
                    <p className="text-xs text-rf-ink-muted mt-1">Requires APPLICATION_VIEW permission</p>
                  </div>
                ) : (
                  <>
                    <p className="m-0 text-sm font-medium text-rf-ink-muted">Not enough historical data to generate a trend.</p>
                    <Link to="/reports/overview" className="text-xs font-bold text-rf-action hover:underline">Open report overview</Link>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Column 3: Stacked Needs Attention + Top Openings (~25% width = 3 cols) */}
          <div className="lg:col-span-3 flex flex-col gap-5 min-w-0 justify-between">
            {/* Needs Attention Card */}
            <div className="rounded-2xl border border-rf-border-subtle bg-rf-surface p-5 shadow-xs flex flex-col justify-between flex-1">
              <div className="flex items-center justify-between pb-3 border-b border-rf-border-subtle mb-3">
                <h2 className="text-sm font-bold text-rf-ink m-0">Needs attention</h2>
                <Link to="/tasks" className="text-xs font-bold text-rf-action hover:underline">
                  View all
                </Link>
              </div>

              <ul className="flex flex-col gap-2.5">
                {attentionItems.length === 0 && (
                  <li className="rounded-xl border border-dashed border-rf-border-subtle p-3 text-xs font-medium text-rf-ink-muted text-center">
                    {(isUnauthorized('overview') && isUnauthorized('funnel') && isUnauthorized('vacancies')) 
                      ? 'Requires additional permissions to view attention items.' 
                      : 'No attention items are available for the current data set.'}
                  </li>
                )}
                {attentionItems.map((item) => (
                  <li
                    key={item.to + item.title}
                    className="flex items-center gap-3 p-2.5 rounded-xl border border-rf-border-subtle bg-rf-surface-subtle/40 hover:bg-rf-surface-subtle hover:border-rf-border transition-all"
                  >
                    <div
                      className={`w-7 h-7 rounded-lg ${item.bgClass} flex items-center justify-center shrink-0 shadow-2xs`}
                    >
                      <Icon name={item.icon} size={14} />
                    </div>
                    <Link to={item.to} className="flex-1 min-w-0 no-underline">
                      <div className="text-xs font-bold text-rf-ink truncate">{item.title}</div>
                      <div className="text-[10.5px] text-rf-ink-muted truncate">{item.subtitle}</div>
                    </Link>
                    <Icon name="chevron-right" size={13} className="text-rf-ink-muted shrink-0" />
                  </li>
                ))}
              </ul>
            </div>

            {/* Top openings by headcount progress Card */}
            <div className="rounded-2xl border border-rf-border-subtle bg-rf-surface p-5 shadow-xs flex flex-col justify-between flex-1">
              <div className="flex items-center justify-between pb-3 border-b border-rf-border-subtle mb-3">
                <h2 className="text-sm font-bold text-rf-ink m-0">Top openings by headcount progress</h2>
                <Link to="/vacancies" className="text-xs font-bold text-rf-action hover:underline">
                  View all
                </Link>
              </div>

              <ul className="flex flex-col gap-3">
                {displayOpenings.length === 0 && (
                  <li className="rounded-xl border border-dashed border-rf-border-subtle p-3 text-xs font-medium text-rf-ink-muted text-center">
                    {isUnauthorized('vacancies') ? 'Requires VACANCY_VIEW permission.' : 'No vacancy data is available for this workspace.'}
                  </li>
                )}
                {displayOpenings.map((v) => {
                  const pct = Math.min(100, Math.round((v.joined / v.target) * 100));
                  return (
                    <li key={v.id} className="flex flex-col gap-1">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs font-bold text-rf-ink truncate">{v.title}</span>
                        <span className="text-[11px] font-bold text-rf-ink tabular-nums">
                          {v.joined}/{v.target}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] text-rf-ink-muted shrink-0">{v.code}</span>
                        <div className="flex-1 h-1.5 bg-rf-surface-subtle rounded-full overflow-hidden border border-rf-border-subtle">
                          <div
                            className="h-full bg-blue-600 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom 4 Horizontal Spotlight KPI Cards matching Reference Image 2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Time to hire */}
          <SpotlightCard
            tone="brand"
            className="shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-hover)] transition-all duration-200"
          >
            <div className="p-4 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-2xs">
                <Icon name="clock" size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-rf-ink-muted">
                  Time to hire
                </div>
                <div className="text-[17px] font-rf-heading font-black text-rf-ink leading-tight mt-0.5">
                  {overview && overview.kpis.timeToFill.value > 0 ? `${overview.kpis.timeToFill.value} days` : '—'}
                </div>
                <div className="text-xs font-medium text-rf-ink-muted mt-0.5">
                  {overview ? 'Verified joining records' : 'Unavailable'}
                </div>
              </div>
            </div>
          </SpotlightCard>

          {/* Card 2: Offer acceptance rate */}
          <SpotlightCard
            tone="success"
            className="shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-hover)] transition-all duration-200"
          >
            <div className="p-4 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-2xs">
                <Icon name="check" size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-rf-ink-muted">
                  Offer acceptance rate
                </div>
                <div className="text-[17px] font-rf-heading font-black text-rf-ink leading-tight mt-0.5">
                  {overview && overview.kpis.offerAcceptanceRate.total > 0 ? `${overview.kpis.offerAcceptanceRate.value}%` : '—'}
                </div>
                <div className="text-xs font-medium text-rf-ink-muted mt-0.5">
                  {overview ? `${overview.kpis.offerAcceptanceRate.accepted}/${overview.kpis.offerAcceptanceRate.total} accepted` : 'Unavailable'}
                </div>
              </div>
            </div>
          </SpotlightCard>

          {/* Card 3: Interview to offer rate */}
          <SpotlightCard
            tone="info"
            className="shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-hover)] transition-all duration-200"
          >
            <div className="p-4 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400 flex items-center justify-center shrink-0 shadow-2xs">
                <Icon name="users" size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-rf-ink-muted">
                  Interview to offer rate
                </div>
                <div className="text-[17px] font-rf-heading font-black text-rf-ink leading-tight mt-0.5">
                  {monthTotals && monthTotals.interviews > 0 ? `${Math.round((monthTotals.offers / monthTotals.interviews) * 100)}%` : '—'}
                </div>
                <div className="text-xs font-medium text-rf-ink-muted mt-0.5">
                  {monthTotals ? `${monthTotals.offers} offers / ${monthTotals.interviews} interviews` : 'Unavailable'}
                </div>
              </div>
            </div>
          </SpotlightCard>

          {/* Card 4: Source of hires */}
          <SpotlightCard
            tone="warning"
            className="shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-hover)] transition-all duration-200"
          >
            <div className="p-4 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-2xs">
                <Icon name="star" size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-rf-ink-muted">
                  Source of hires
                </div>
                <div className="text-[17px] font-rf-heading font-black text-rf-ink leading-tight mt-0.5 truncate">
                  {overview?.kpis.topSource.name && overview.kpis.topSource.name !== 'No data' ? overview.kpis.topSource.name : '—'}
                </div>
                <div className="text-xs font-medium text-rf-ink-muted mt-0.5">
                  {overview?.kpis.topSource.name && overview.kpis.topSource.name !== 'No data' ? `${overview.kpis.topSource.conversionRate}% joined conversion` : 'No source evidence'}
                </div>
              </div>
            </div>
          </SpotlightCard>
        </div>
      </div>

      {/* Target Settings Modal */}
      <RecruiterTargetSettingsModal
        isOpen={isTargetModalOpen}
        onClose={() => setIsTargetModalOpen(false)}
      />
    </>
  );
}
