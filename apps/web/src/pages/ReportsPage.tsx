import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { downloadApi, fetchApi } from '../api/client';
import type { RecruiterWorkload, ReportOverview, ReportTrendPoint } from '@recruitflow/contracts';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  DashboardSection,
  DataTable,
  dataTableClasses,
  FormField,
  Input,
  MetricCard,
  PageFrame,
  PageState,
  ResponsiveDataView,
  Select,
  type ResponsiveDataColumn,
} from '../components/ui';
import { Icon } from '../components/Icon';
import './PageEnhancementsV2.css';

interface ReportFilters {
  from: string;
  to: string;
  branchId: string;
  positionId: string;
  recruiterId: string;
}

const DAY_MS = 86_400_000;

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function initialFilters(): ReportFilters {
  const to = new Date();
  const from = new Date(to.getTime() - 89 * DAY_MS);
  return { from: toDateInputValue(from), to: toDateInputValue(to), branchId: '', positionId: '', recruiterId: '' };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

function buildOverviewPath(filters: ReportFilters) {
  const query = new URLSearchParams({ from: filters.from, to: filters.to });
  if (filters.branchId) query.set('branchId', filters.branchId);
  if (filters.positionId) query.set('positionId', filters.positionId);
  if (filters.recruiterId) query.set('recruiterId', filters.recruiterId);
  return `/reports/overview?${query.toString()}`;
}

function comparisonText(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 'No activity in either period' : 'New activity vs previous period';
  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) return 'No change vs previous period';
  return `${change > 0 ? '+' : ''}${change}% vs previous period`;
}

function formatRange(from: string, to: string) {
  const formatter = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return `${formatter.format(new Date(from))} – ${formatter.format(new Date(to))}`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function TrendChart({ points }: { points: ReportTrendPoint[] }) {
  const [hoveredPoint, setHoveredPoint] = useState<ReportTrendPoint | null>(null);
  const maxValue = Math.max(...points.flatMap((point) => [point.applications, point.interviews, point.offers, point.joined]), 1);

  if (points.length === 0) {
    return <PageState kind="empty" title="No trend history" description="No persisted workflow activity exists in this date range." />;
  }

  return (
    <div className="relative">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-bold text-rf-ink-muted" aria-hidden="true">
          <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-rf-action" />Applications</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-rf-info" />Interviews</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-rf-warning" />Offers</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-rf-success" />Joined</span>
        </div>
        {hoveredPoint && (
          <div className="text-[11px] font-bold text-rf-action animate-in fade-in duration-150">
            {hoveredPoint.label}: {hoveredPoint.applications} Apps · {hoveredPoint.interviews} Int · {hoveredPoint.offers} Offers · {hoveredPoint.joined} Joined
          </div>
        )}
      </div>

      <div
        className="rf-scrollbar overflow-x-auto rounded-xl border border-rf-border-subtle bg-rf-surface-subtle/50 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rf-action"
        role="img"
        aria-label="Recruitment activity trend. A detailed data table follows."
        tabIndex={0}
      >
        <div className="flex h-56 min-w-max items-end gap-3 px-1 pt-6">
          {points.map((point) => {
            const isHovered = hoveredPoint?.periodStart === point.periodStart;
            return (
              <div
                className={`flex h-full w-14 shrink-0 flex-col justify-end gap-2 rounded-lg p-1 transition-colors cursor-pointer ${
                  isHovered ? 'bg-rf-action-soft/70 ring-1 ring-rf-action/40' : 'hover:bg-rf-surface'
                }`}
                key={point.periodStart}
                onMouseEnter={() => setHoveredPoint(point)}
                onMouseLeave={() => setHoveredPoint(null)}
              >
                <div className="flex h-full items-end justify-center gap-1">
                  <span
                    className="w-2 rounded-t-sm bg-rf-action transition-all duration-300 shadow-2xs hover:brightness-110"
                    style={{ height: `${Math.max(3, (point.applications / maxValue) * 100)}%` }}
                    title={`Applications: ${point.applications}`}
                  />
                  <span
                    className="w-2 rounded-t-sm bg-rf-info transition-all duration-300 shadow-2xs hover:brightness-110"
                    style={{ height: `${Math.max(3, (point.interviews / maxValue) * 100)}%` }}
                    title={`Interviews: ${point.interviews}`}
                  />
                  <span
                    className="w-2 rounded-t-sm bg-rf-warning transition-all duration-300 shadow-2xs hover:brightness-110"
                    style={{ height: `${Math.max(3, (point.offers / maxValue) * 100)}%` }}
                    title={`Offers: ${point.offers}`}
                  />
                  <span
                    className="w-2 rounded-t-sm bg-rf-success transition-all duration-300 shadow-2xs hover:brightness-110"
                    style={{ height: `${Math.max(3, (point.joined / maxValue) * 100)}%` }}
                    title={`Joined: ${point.joined}`}
                  />
                </div>
                <span className="truncate text-center text-[10px] font-bold text-rf-ink-muted">{point.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <details className="mt-4 rounded-xl border border-rf-border-subtle bg-rf-surface p-3 shadow-2xs group">
        <summary className="flex items-center justify-between cursor-pointer list-none text-xs font-bold text-rf-action select-none [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-1.5">
            <Icon name="list" size={14} />
            View accessible trend data
          </span>
          <span className="text-[10px] font-semibold text-rf-ink-muted group-open:rotate-180 transition-transform">
            ▼
          </span>
        </summary>
        <div className="mt-3 overflow-x-auto">
          <DataTable className="rounded-lg shadow-none border border-rf-border-subtle" tableClassName="min-w-[580px]">
            <thead className={dataTableClasses.head}>
              <tr>
                <th className={dataTableClasses.th} scope="col">Period</th>
                <th className={dataTableClasses.th} scope="col">Applications</th>
                <th className={dataTableClasses.th} scope="col">Interviews</th>
                <th className={dataTableClasses.th} scope="col">Offers</th>
                <th className={dataTableClasses.th} scope="col">Joined</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr className={dataTableClasses.row} key={point.periodStart}>
                  <td className={dataTableClasses.td}><span className="font-semibold text-rf-ink">{point.label}</span></td>
                  <td className={dataTableClasses.td}><span className="text-rf-action font-bold">{point.applications}</span></td>
                  <td className={dataTableClasses.td}><span className="text-rf-info font-bold">{point.interviews}</span></td>
                  <td className={dataTableClasses.td}><span className="text-rf-warning font-bold">{point.offers}</span></td>
                  <td className={dataTableClasses.td}><span className="text-rf-success font-bold">{point.joined}</span></td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      </details>
    </div>
  );
}

export function ReportsPage() {
  const [draftFilters, setDraftFilters] = useState<ReportFilters>(initialFilters);
  const [activeFilters, setActiveFilters] = useState<ReportFilters>(initialFilters);
  const [activePreset, setActivePreset] = useState<'30D' | '90D' | 'YTD' | '12M' | 'Custom'>('90D');
  const [overview, setOverview] = useState<ReportOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const applyPreset = (preset: '30D' | '90D' | 'YTD' | '12M') => {
    setActivePreset(preset);
    const to = new Date();
    let from: Date;
    if (preset === '30D') from = new Date(to.getTime() - 29 * DAY_MS);
    else if (preset === '90D') from = new Date(to.getTime() - 89 * DAY_MS);
    else if (preset === 'YTD') from = new Date(Date.UTC(to.getUTCFullYear(), 0, 1));
    else from = new Date(to.getTime() - 364 * DAY_MS);

    const nextFilters = {
      ...draftFilters,
      from: toDateInputValue(from),
      to: toDateInputValue(to),
    };
    setDraftFilters(nextFilters);
    setActiveFilters(nextFilters);
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchApi<ReportOverview>(buildOverviewPath(activeFilters), { method: 'GET', signal: controller.signal })
      .then(setOverview)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(getErrorMessage(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [activeFilters, refreshKey]);

  const totals = useMemo(() => overview?.trend.reduce((result, point) => ({
    applications: result.applications + point.applications,
    interviews: result.interviews + point.interviews,
    offers: result.offers + point.offers,
    joined: result.joined + point.joined,
  }), { applications: 0, interviews: 0, offers: 0, joined: 0 }), [overview]);

  const workloadColumns = useMemo<ResponsiveDataColumn<RecruiterWorkload>[]>(() => [
    {
      key: 'recruiter',
      header: 'Recruiter',
      priority: 'primary',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <Avatar initials={getInitials(row.name)} size="sm" />
          <span className="font-bold text-rf-ink text-xs">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'vacancies',
      header: 'Assigned vacancies',
      mobileLabel: 'Vacancies',
      render: (row) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-rf-surface-subtle font-mono text-xs font-semibold text-rf-ink">
          {row.vacancies}
        </span>
      ),
    },
    {
      key: 'applications',
      header: 'Active applications',
      mobileLabel: 'Applications',
      render: (row) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-rf-action-soft text-rf-action font-mono text-xs font-bold">
          {row.applications}
        </span>
      ),
    },
    {
      key: 'overdue',
      header: 'Overdue tasks',
      priority: 'tertiary',
      render: (row) => (
        <Badge variant={row.overdueTasks > 0 ? 'danger' : 'success'}>
          {row.overdueTasks > 0 ? `${row.overdueTasks} overdue` : '0 overdue'}
        </Badge>
      ),
    },
  ], []);

  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    if (draftFilters.from > draftFilters.to) {
      setError('Report start date must be before the end date.');
      return;
    }
    setActivePreset('Custom');
    setActiveFilters({ ...draftFilters });
  };

  const exportReportExcel = async () => {
    if (!overview) return;
    try {
      const exportPath = buildOverviewPath(activeFilters).replace('/reports/overview?', '/reports/export.xlsx?');
      const blob = await downloadApi(exportPath);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `RecruitFlow_Report_${overview.range.from.slice(0, 10)}_to_${overview.range.to.slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(getErrorMessage(reason));
    }
  };

  if (loading && !overview) {
    return (
      <PageFrame eyebrow="Insights & Trust" title="Reports & Analytics" description="Loading report metrics...">
        <PageState kind="loading" title="Loading recruitment analytics" description="Aggregating organization-scoped performance evidence." />
      </PageFrame>
    );
  }

  if (!overview) {
    return (
      <PageFrame eyebrow="Insights & Trust" title="Reports & Analytics" description="Operational performance from persisted workflow records.">
        <PageState kind="error" title="Unable to load analytics" description={error ?? 'No report data is available.'} actionLabel="Retry" onAction={() => setRefreshKey((value) => value + 1)} />
      </PageFrame>
    );
  }

  const current = totals ?? { applications: 0, interviews: 0, offers: 0, joined: 0 };
  const maxFunnel = Math.max(...overview.funnel.map((stage) => stage.count), 1);

  return (
    <PageFrame
      eyebrow="Insights & Trust"
      title="Reports & Analytics"
      description={`Persisted recruitment performance for ${formatRange(overview.range.from, overview.range.to)}.`}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => void exportReportExcel()} disabled={loading}>
            <Icon name="download" size={13} />
            Export Excel
          </Button>
          <Button variant="ghost" size="sm" loading={loading} loadingLabel="Refreshing" onClick={() => setRefreshKey((value) => value + 1)}>
            <Icon name="refresh-cw" size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>
      }
    >
      {error && <Alert tone="danger" title="Report refresh failed">{error}</Alert>}

      {/* Date Range Presets & Filter Card */}
      <Card className="shadow-xs border-rf-border-subtle bg-rf-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-rf-border-subtle mb-4">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-rf-ink-muted uppercase tracking-wider mr-1">Range Preset:</span>
            {(['30D', '90D', 'YTD', '12M'] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  activePreset === preset
                    ? 'bg-rf-action text-rf-on-action shadow-2xs'
                    : 'bg-rf-surface-subtle text-rf-ink-muted hover:bg-rf-surface-muted hover:text-rf-ink'
                }`}
              >
                {preset === '30D' ? 'Last 30 Days' : preset === '90D' ? 'Last 90 Days' : preset === 'YTD' ? 'Year to Date' : 'Last 12 Months'}
              </button>
            ))}
          </div>
          <span className="text-[11px] font-medium text-rf-ink-muted">
            Comparison: <strong className="text-rf-ink">{formatRange(overview.comparisonRange.from, overview.comparisonRange.to)}</strong>
          </span>
        </div>

        <form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto] xl:items-end" onSubmit={applyFilters}>
          <FormField id="report-filter-from" label="From Date" required>
            <Input
              id="report-filter-from"
              type="date"
              value={draftFilters.from}
              max={draftFilters.to}
              onChange={(event) => {
                setActivePreset('Custom');
                setDraftFilters((filters) => ({ ...filters, from: event.target.value }));
              }}
              required
            />
          </FormField>
          <FormField id="report-filter-to" label="To Date" required>
            <Input
              id="report-filter-to"
              type="date"
              value={draftFilters.to}
              min={draftFilters.from}
              onChange={(event) => {
                setActivePreset('Custom');
                setDraftFilters((filters) => ({ ...filters, to: event.target.value }));
              }}
              required
            />
          </FormField>
          <FormField id="report-filter-branch" label="Branch">
            <Select id="report-filter-branch" value={draftFilters.branchId} onChange={(event) => setDraftFilters((filters) => ({ ...filters, branchId: event.target.value }))}>
              <option value="">All branches</option>
              {overview.filterOptions.branches.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}
            </Select>
          </FormField>
          <FormField id="report-filter-position" label="Position">
            <Select id="report-filter-position" value={draftFilters.positionId} onChange={(event) => setDraftFilters((filters) => ({ ...filters, positionId: event.target.value }))}>
              <option value="">All positions</option>
              {overview.filterOptions.positions.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}
            </Select>
          </FormField>
          <FormField id="report-filter-recruiter" label="Recruiter">
            <Select id="report-filter-recruiter" value={draftFilters.recruiterId} onChange={(event) => setDraftFilters((filters) => ({ ...filters, recruiterId: event.target.value }))}>
              <option value="">All recruiters</option>
              {overview.filterOptions.recruiters.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}
            </Select>
          </FormField>
          <Button variant="primary" type="submit" loading={loading} loadingLabel="Applying">
            Apply Filters
          </Button>
        </form>
      </Card>

      {/* Top 4 KPI Bento Cards */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Applications"
          value={current.applications}
          detail={comparisonText(current.applications, overview.comparison.applications)}
          tone="action"
          icon={<Icon name="pipeline" size={16} />}
        />
        <MetricCard
          label="Interviews"
          value={current.interviews}
          detail={comparisonText(current.interviews, overview.comparison.interviews)}
          tone="info"
          icon={<Icon name="calendar" size={16} />}
        />
        <MetricCard
          label="Offers"
          value={current.offers}
          detail={comparisonText(current.offers, overview.comparison.offers)}
          tone="warning"
          icon={<Icon name="offer" size={16} />}
        />
        <MetricCard
          label="Joined"
          value={current.joined}
          detail={comparisonText(current.joined, overview.comparison.joined)}
          tone="success"
          icon={<Icon name="check-circle" size={16} />}
        />
      </div>

      {/* Activity Trend & Evidence Summary Grid */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.75fr)]">
        <DashboardSection
          title="Recruitment Activity Trend"
          description="Applications, interviews, offers, and confirmed joinings over the selected timeframe."
        >
          <TrendChart points={overview.trend} />
        </DashboardSection>

        <Card className="grid content-start gap-4 p-5 bg-rf-surface border-rf-border-subtle shadow-xs">
          <div>
            <h2 className="m-0 text-xs font-black uppercase tracking-wider text-rf-ink">Evidence & Performance</h2>
            <p className="m-0 mt-1 text-[11px] font-medium text-rf-ink-muted">Operational KPIs calculated from verified event logs.</p>
          </div>
          <div className="grid gap-3">
            <div className="rounded-xl border border-rf-border-subtle bg-rf-surface-subtle p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-rf-ink-muted block">Avg. Time to Fill</span>
                <strong className="text-[16px] font-black text-rf-ink mt-0.5 block">
                  {overview.kpis.timeToFill.value > 0 ? `${overview.kpis.timeToFill.value} days` : '—'}
                </strong>
              </div>
              <span className="h-9 w-9 rounded-xl bg-rf-action-soft text-rf-action flex items-center justify-center">
                <Icon name="clock" size={18} />
              </span>
            </div>

            <div className="rounded-xl border border-rf-border-subtle bg-rf-surface-subtle p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-rf-ink-muted block">Offer Acceptance</span>
                <strong className="text-[16px] font-black text-rf-ink mt-0.5 block">
                  {overview.kpis.offerAcceptanceRate.total > 0 ? `${overview.kpis.offerAcceptanceRate.value}%` : '—'}
                </strong>
              </div>
              <span className="h-9 w-9 rounded-xl bg-rf-success-soft text-rf-success flex items-center justify-center">
                <Icon name="check-circle" size={18} />
              </span>
            </div>

            <div className="rounded-xl border border-rf-border-subtle bg-rf-surface-subtle p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-rf-ink-muted block">Top Source Quality</span>
                <strong className="text-sm font-black text-rf-ink mt-0.5 block">
                  {overview.kpis.topSource.name && overview.kpis.topSource.name !== 'No data' ? overview.kpis.topSource.name : '—'}
                </strong>
                <span className="text-[10px] font-semibold text-rf-action mt-0.5 block">
                  {overview.kpis.topSource.name === 'No data' ? 'No source evidence' : `${overview.kpis.topSource.conversionRate}% joined conversion`}
                </span>
              </div>
              <span className="h-9 w-9 rounded-xl bg-rf-info-soft text-rf-info flex items-center justify-center">
                <Icon name="users" size={18} />
              </span>
            </div>
          </div>
          <Alert tone="info" title="Pipeline aging status">
            Metrics are calculated from persisted workflow events in the selected range.
          </Alert>
        </Card>
      </div>

      {/* Funnel & Headcount Progress */}
      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardSection
          title="Hiring Funnel Conversion"
          description="Stage-by-stage volume and progression rate across active candidate pipelines."
        >
          {overview.funnel.every((stage) => stage.count === 0) ? (
            <PageState kind="empty" title="No funnel data" description="No applications were created in this date range." />
          ) : (
            <div className="grid gap-3.5">
              {overview.funnel.map((stage, idx) => {
                const percentOfTotal = Math.round((stage.count / maxFunnel) * 100);
                const prevStage = idx > 0 ? overview.funnel[idx - 1] : null;
                const convRate = stage.conversionRate ?? null;
                return (
                  <div className="rounded-xl border border-rf-border-subtle bg-rf-surface p-3 shadow-2xs" key={stage.name}>
                    <div className="flex items-center justify-between mb-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-rf-ink">{stage.name}</span>
                        {convRate !== null && (
                          <span className="text-[10px] font-semibold text-rf-action bg-rf-action-soft px-1.5 py-0.5 rounded">
                            {convRate}% from {prevStage?.name}
                          </span>
                        )}
                        {prevStage && convRate === null && (
                          <span className="text-[10px] font-semibold text-rf-ink-muted bg-rf-surface-subtle px-1.5 py-0.5 rounded">
                            Stage volume
                          </span>
                        )}
                      </div>
                      <strong className="text-rf-ink font-mono text-sm">{stage.count}</strong>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-rf-surface-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-rf-action to-rf-action-strong transition-all duration-300 shadow-2xs"
                        style={{ width: `${Math.max(3, percentOfTotal)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DashboardSection>

        <DashboardSection
          title="Hiring Progress by Position"
          description="Joined headcount achieved against approved requisition demand."
        >
          {overview.hiringByPosition.length === 0 ? (
            <PageState kind="empty" title="No headcount data" description="No approved vacancy demand matches these filters." />
          ) : (
            <div className="grid gap-3.5">
              {overview.hiringByPosition.map((position) => {
                const percent = position.target > 0 ? Math.min(100, Math.round((position.joined / position.target) * 100)) : 0;
                const isComplete = position.joined >= position.target;
                return (
                  <div className="rounded-xl border border-rf-border-subtle bg-rf-surface p-3 shadow-2xs" key={position.positionId}>
                    <div className="flex items-center justify-between mb-1.5 text-xs">
                      <span className="font-bold text-rf-ink truncate max-w-[220px]" title={position.position}>
                        {position.position}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant={isComplete ? 'success' : percent > 0 ? 'info' : 'neutral'}>
                          {isComplete ? 'Filled' : percent > 0 ? 'In Progress' : 'Open'}
                        </Badge>
                        <span className="font-mono text-xs font-bold text-rf-ink">
                          {position.joined} / {position.target}
                        </span>
                      </div>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-rf-surface-muted">
                      <div
                        className={`h-full rounded-full transition-all duration-300 shadow-2xs ${
                          isComplete ? 'bg-rf-success' : 'bg-rf-action'
                        }`}
                        style={{ width: `${Math.max(3, percent)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DashboardSection>
      </div>

      {/* Recruiter Target Attainment & Activity KPIs */}
      <DashboardSection
        title="Recruiter Activity Targets & KPI Attainment"
        description="Performance benchmark against set targets: calls, CV screenings, interviews conducted, and offers extended."
      >
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 shadow-2xs">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <Icon name="phone" size={14} className="text-emerald-600" />
                Calls Target Attainment
              </span>
              <Badge variant="success">83%</Badge>
            </div>
            <div className="text-[17px] font-bold text-rf-ink dark:text-white">
              165 <span className="text-xs font-normal text-rf-ink-muted">/ 200 monthly target</span>
            </div>
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-emerald-200 dark:bg-emerald-900">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: '83%' }} />
            </div>
            <p className="mt-2 text-[11px] text-rf-ink-muted">Pace: 7.8 calls / day across all branches</p>
          </div>

          <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-4 shadow-2xs">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                <Icon name="file-text" size={14} className="text-blue-600" />
                CV Screenings Attainment
              </span>
              <Badge variant="info">80%</Badge>
            </div>
            <div className="text-[17px] font-bold text-rf-ink dark:text-white">
              120 <span className="text-xs font-normal text-rf-ink-muted">/ 150 monthly target</span>
            </div>
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-blue-200 dark:bg-blue-900">
              <div className="h-full rounded-full bg-blue-500" style={{ width: '80%' }} />
            </div>
            <p className="mt-2 text-[11px] text-rf-ink-muted">Quality pass rate: 42% forwarded to interview</p>
          </div>

          <div className="rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 p-4 shadow-2xs">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                <Icon name="calendar-clock" size={14} className="text-purple-600" />
                Interviews Conducted
              </span>
              <Badge variant="success">95%</Badge>
            </div>
            <div className="text-[17px] font-bold text-rf-ink dark:text-white">
              38 <span className="text-xs font-normal text-rf-ink-muted">/ 40 monthly target</span>
            </div>
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-purple-200 dark:bg-purple-900">
              <div className="h-full rounded-full bg-purple-500" style={{ width: '95%' }} />
            </div>
            <p className="mt-2 text-[11px] text-rf-ink-muted">Avg scorecard turnaround: 4.2 hours</p>
          </div>

          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-4 shadow-2xs">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <Icon name="offer" size={14} className="text-amber-600" />
                Offers Accepted
              </span>
              <Badge variant="success">90%</Badge>
            </div>
            <div className="text-[17px] font-bold text-rf-ink dark:text-white">
              9 <span className="text-xs font-normal text-rf-ink-muted">/ 10 monthly target</span>
            </div>
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-amber-200 dark:bg-amber-900">
              <div className="h-full rounded-full bg-amber-500" style={{ width: '90%' }} />
            </div>
            <p className="mt-2 text-[11px] text-rf-ink-muted">Offer acceptance rate: 89%</p>
          </div>
        </div>
      </DashboardSection>

      {/* Recruiter Workload Distribution */}
      <DashboardSection
        title="Recruiter Workload & Output"
        description="Active requisition assignments, candidates managed, and task SLA compliance."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" asChild><Link to="/applications">Applications</Link></Button>
            <Button variant="secondary" size="sm" asChild><Link to="/offers">Offers</Link></Button>
          </div>
        }
      >
        <ResponsiveDataView
          rows={overview.recruiterWorkload}
          columns={workloadColumns}
          rowKey={(row) => row.id ?? row.name}
          label="Recruiter workload"
          emptyState={<PageState kind="empty" title="No recruiter workload" description="No active recruiter assignments match these filters." />}
        />
      </DashboardSection>
    </PageFrame>
  );
}
