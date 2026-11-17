import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Download, RotateCw, X } from 'lucide-react';
import type {
  ReportFunnelRecord,
  ReportOverview,
  ReportReachedFunnel,
  ReportSourcePerformance,
  ReportSummaryCardMetric,
  ReportSummaryCards,
  ReportTopJobItem,
  ReportTrendPoint,
} from '@recruitflow/contracts';
import { getApi } from '../../api/client';
import {
  ButtonV2,
  EmptyStateV2,
  ForbiddenStateV2,
  SkeletonV2,
  StatusChip,
  type StatusTone,
} from '../../components/v2';
import { cairoMonth, monthLabel } from '../api/myResult';
import { withReturnTo } from '../returnTarget';
import './jobs.css';
import './reports-v2.css';

export type PeriodPreset = '30d' | '7d' | '90d' | 'month';
export type MetricDrillKey = 'newCandidates' | 'interviewsScheduled' | 'offersSent' | 'hires';

const SOURCE_PALETTE = [
  '#0ea5e9', // SGH Blue
  '#10b981', // SGH Emerald
  '#f59e0b', // Warm Amber
  '#bfa07a', // Warm Taupe
  '#5ea89c', // Muted Teal
  '#6366f1', // Indigo
];

const STAGE_TONE: Record<string, StatusTone> = {
  Applied: 'neutral',
  Screening: 'info',
  Interview: 'info',
  Offer: 'warning',
  'Pre-Hire': 'success',
  Joined: 'success',
  Hired: 'success',
  Rejected: 'danger',
  Withdrawn: 'neutral',
};

function isValidMonth(value: string | null): value is string {
  return Boolean(value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value));
}

function formatFullDate(isoOrDate: string): string {
  try {
    const d = new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return isoOrDate;
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(d);
  } catch {
    return isoOrDate;
  }
}

function formatShortTick(isoOrDate: string, fallback: string): string {
  try {
    const d = new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return fallback;
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(d);
  } catch {
    return fallback;
  }
}

function csvCell(value: string | number | null | undefined): string {
  const raw = value == null ? '' : String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return /[",\n\r]/.test(safe) || safe !== raw ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function triggerCsvDownload(filename: string, rows: Array<Array<string | number | null | undefined>>) {
  const content = rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function fallbackReachedFunnel(overview: ReportOverview): ReportReachedFunnel {
  if (overview.reachedFunnel) return overview.reachedFunnel;
  const stages = (overview.funnel ?? []).map((f) => ({
    stage: f.name,
    label: f.name,
    reachedCount: f.count,
    pctOfCohort: f.percent,
  }));
  const cohortTotal = stages.find((s) => s.stage === 'Applied')?.reachedCount ?? 0;
  const reachedInterview = stages.find((s) => s.stage === 'Interview')?.reachedCount ?? 0;
  const joined = overview.kpis?.totalJoined?.count ?? stages.find((s) => s.stage === 'Joined')?.reachedCount ?? 0;
  return {
    cohortTotal,
    reachedInterview,
    joined,
    tooFewToJudge: cohortTotal > 0 && cohortTotal < 5,
    stages,
    outcomes: [
      { outcome: 'REJECTED', label: 'Rejected', count: 0, pctOfCohort: 0 },
      { outcome: 'WITHDRAWN', label: 'Withdrawn', count: 0, pctOfCohort: 0 },
    ],
    records: [],
  };
}

function fallbackSourcePerformance(overview: ReportOverview): ReportSourcePerformance {
  if (overview.sourcePerformance) return overview.sourcePerformance;
  const sources = (overview.sourceBreakdown ?? []).map((s) => ({
    source: s.name,
    applicants: s.total,
    reachedInterview: 0,
    joined: s.joined,
    interviewRatePct: s.total > 0 ? 0 : null,
    hireRatePct: s.total > 0 ? s.conversionRate : null,
    tooFewToJudge: s.total < 5,
  }));
  const totalApplicants = sources.reduce((sum, s) => sum + s.applicants, 0);
  const totalJoined = sources.reduce((sum, s) => sum + s.joined, 0);
  return {
    totalApplicants,
    totalReachedInterview: 0,
    totalJoined,
    sources,
    records: [],
  };
}

function resolveSummaryCards(overview: ReportOverview, funnel: ReportReachedFunnel): ReportSummaryCards {
  if (overview.summaryCards) return overview.summaryCards;
  const trendTotals = (overview.trend ?? []).reduce(
    (acc, pt) => ({
      apps: acc.apps + pt.applications,
      interviews: acc.interviews + pt.interviews,
      offers: acc.offers + pt.offers,
      joined: acc.joined + pt.joined,
    }),
    { apps: 0, interviews: 0, offers: 0, joined: 0 },
  );

  const newCandidatesCount =
    funnel.cohortTotal ||
    overview.sourcePerformance?.totalApplicants ||
    trendTotals.apps;

  const interviewsFromFunnel =
    funnel.stages.find((s) => s.stage === 'Interview')?.reachedCount ?? funnel.reachedInterview;
  const interviewsCount =
    trendTotals.interviews ||
    overview.kpis?.interviewNoShowRate?.total ||
    interviewsFromFunnel;

  const offersFromFunnel = funnel.stages.find((s) => s.stage === 'Offer')?.reachedCount ?? 0;
  const offersCount =
    trendTotals.offers ||
    overview.kpis?.offerAcceptanceRate?.total ||
    offersFromFunnel;

  const hiresCount =
    overview.kpis?.totalJoined?.count ||
    funnel.joined ||
    trendTotals.joined;

  return {
    newCandidates: { count: newCandidatesCount, previousCount: null, changePct: null },
    interviewsScheduled: { count: interviewsCount, previousCount: null, changePct: null },
    offersSent: { count: offersCount, previousCount: null, changePct: null },
    hires: { count: hiresCount, previousCount: null, changePct: null },
  };
}

function resolveTopJobs(overview: ReportOverview, funnel: ReportReachedFunnel): ReportTopJobItem[] {
  if (overview.topJobs && overview.topJobs.length > 0) {
    return overview.topJobs;
  }
  const byTitle = new Map<string, ReportTopJobItem>();
  for (const rec of funnel.records) {
    const title = rec.jobTitle?.trim() || 'Job';
    const existing = byTitle.get(title) ?? {
      vacancyId: rec.vacancyId,
      jobTitle: title,
      vacancyCode: null,
      applicationsCount: 0,
      joinedCount: 0,
    };
    existing.applicationsCount += 1;
    if (rec.outcome === 'JOINED' || rec.currentStage === 'Joined') {
      existing.joinedCount += 1;
    }
    byTitle.set(title, existing);
  }
  if (byTitle.size > 0) {
    return [...byTitle.values()].sort(
      (a, b) => b.applicationsCount - a.applicationsCount || a.jobTitle.localeCompare(b.jobTitle),
    );
  }
  return [];
}

function resolveTrendPoints(overview: ReportOverview, funnel: ReportReachedFunnel): ReportTrendPoint[] {
  if (overview.trend && overview.trend.length > 0) {
    return overview.trend;
  }
  const fromMs = overview.range?.from ? new Date(overview.range.from).getTime() : Date.now() - 29 * 86_400_000;
  const toMs = overview.range?.to ? new Date(overview.range.to).getTime() : Date.now();
  const validRange = !Number.isNaN(fromMs) && !Number.isNaN(toMs) && toMs > fromMs;
  const startMs = validRange ? fromMs : Date.now() - 29 * 86_400_000;
  const endMs = validRange ? toMs : Date.now();
  const days = Math.max(1, Math.min(31, Math.ceil((endMs - startMs) / 86_400_000)));
  const bucketMs = Math.max(86_400_000, Math.floor((endMs - startMs) / days));

  const points: ReportTrendPoint[] = [];
  for (let i = 0; i < days; i += 1) {
    const bStart = startMs + i * bucketMs;
    const bEnd = i === days - 1 ? endMs + 1 : bStart + bucketMs;
    const d = new Date(bStart);
    const appsInBucket = funnel.records.filter((r) => {
      const t = new Date(r.appliedAt).getTime();
      return t >= bStart && t < bEnd;
    }).length;
    points.push({
      periodStart: d.toISOString(),
      label: formatShortTick(d.toISOString(), `${i + 1}`),
      applications: appsInBucket,
      interviews: 0,
      offers: 0,
      joined: 0,
    });
  }
  return points;
}

function computeYAxisTicks(maxVal: number): { scaleMax: number; ticks: number[] } {
  if (maxVal <= 0) {
    return { scaleMax: 40, ticks: [40, 30, 20, 10, 0] };
  }
  if (maxVal <= 4) {
    return { scaleMax: 4, ticks: [4, 3, 2, 1, 0] };
  }
  if (maxVal <= 10) {
    return { scaleMax: 10, ticks: [10, 8, 5, 2, 0] };
  }
  const step = Math.ceil(maxVal / 4 / 5) * 5;
  const scaleMax = step * 4;
  return {
    scaleMax,
    ticks: [scaleMax, step * 3, step * 2, step, 0],
  };
}

export function RecruiterReportsV2() {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const currentMonth = useMemo(() => cairoMonth(), []);

  const hasExplicitMonth = isValidMonth(params.get('month'));
  const rawPeriod = params.get('period');
  const periodMode: PeriodPreset = useMemo(() => {
    if (rawPeriod === '7d' || rawPeriod === '30d' || rawPeriod === '90d' || rawPeriod === 'month') {
      return rawPeriod;
    }
    if (hasExplicitMonth) return 'month';
    return '30d';
  }, [rawPeriod, hasExplicitMonth]);

  const month = hasExplicitMonth ? (params.get('month') as string) : currentMonth;
  const jobFilter = params.get('job')?.trim() || '';
  const stageFilter = params.get('stage')?.trim() || '';
  const sourceFilter = params.get('source')?.trim() || '';
  const drillJob = params.get('drillJob')?.trim() || '';
  const dateFilter = params.get('date')?.trim() || '';
  const metricFilter = (params.get('metric')?.trim() || '') as MetricDrillKey | '';

  const [attempt, setAttempt] = useState(0);
  const [hoveredTrendIdx, setHoveredTrendIdx] = useState<number | null>(null);

  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'ready'; data: ReportOverview }
    | { kind: 'forbidden' }
    | { kind: 'error'; message: string }
  >({ kind: 'loading' });

  const updateParams = (
    patch: Partial<
      Record<'period' | 'month' | 'job' | 'stage' | 'source' | 'drillJob' | 'date' | 'metric', string | null>
    >,
  ) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next);
  };

  useEffect(() => {
    let live = true;
    setState({ kind: 'loading' });
    const q = new URLSearchParams();
    if (periodMode === 'month') {
      q.set('month', month);
    } else {
      const toDate = new Date();
      const days = periodMode === '7d' ? 6 : periodMode === '90d' ? 89 : 29;
      const fromDate = new Date(toDate.getTime() - days * 86_400_000);
      q.set('from', fromDate.toISOString().slice(0, 10));
      q.set('to', toDate.toISOString().slice(0, 10));
    }
    if (jobFilter) q.set('vacancyId', jobFilter);

    getApi<ReportOverview>(`/reports/overview?${q.toString()}`)
      .then((data) => {
        if (live) setState({ kind: 'ready', data });
      })
      .catch((e: { statusCode?: number; message?: string }) => {
        if (!live) return;
        if (e?.statusCode === 403) {
          setState({ kind: 'forbidden' });
        } else {
          setState({ kind: 'error', message: e?.message || 'Could not load reports.' });
        }
      });
    return () => {
      live = false;
    };
  }, [periodMode, month, jobFilter, attempt]);

  const jobOptions = useMemo(() => {
    if (state.kind !== 'ready') return [];
    return state.data.filterOptions?.vacancies ?? [];
  }, [state]);

  const selectedJobLabel = useMemo(() => {
    if (!jobFilter) return 'All jobs';
    return jobOptions.find((j) => j.id === jobFilter)?.label ?? 'Selected job';
  }, [jobFilter, jobOptions]);

  const periodDisplayLabel = useMemo(() => {
    if (periodMode === '7d') return 'Last 7 days';
    if (periodMode === '30d') return 'Last 30 days';
    if (periodMode === '90d') return 'Last 90 days';
    return monthLabel(month);
  }, [periodMode, month]);

  const returnHref = `${location.pathname}${location.search}`;

  const clearDrilldown = () => {
    updateParams({
      stage: null,
      source: null,
      drillJob: null,
      date: null,
      metric: null,
    });
  };

  return (
    <div className="rf2-rep-page">
      {/* Header row matching reference */}
      <header className="rf2-rep-header">
        <div className="rf2-rep-header__titles">
          <h1 className="rf2-rep-header__title">Reports</h1>
          <p className="rf2-rep-header__sub">Get insights into your recruitment activity.</p>
        </div>

        <div className="rf2-rep-header__filters" role="group" aria-label="Report filters">
          <label className="rf2-rep-filter">
            <span className="rf2-sr-only">Period</span>
            <select
              aria-label="Period"
              className="rf2-rep-select"
              value={periodMode}
              onChange={(e) => {
                const val = e.target.value as PeriodPreset;
                if (val === 'month') {
                  updateParams({ period: 'month', month });
                } else {
                  updateParams({ period: val === '30d' ? null : val, month: null });
                }
              }}
            >
              <option value="30d">Last 30 days</option>
              <option value="7d">Last 7 days</option>
              <option value="90d">Last 90 days</option>
              <option value="month">{monthLabel(month)}</option>
            </select>
          </label>

          <label className="rf2-rep-filter">
            <span className="rf2-sr-only">Job</span>
            <select
              aria-label="Job"
              className="rf2-rep-select"
              value={jobFilter || 'all'}
              onChange={(e) => updateParams({ job: e.target.value === 'all' ? null : e.target.value })}
            >
              <option value="all">All jobs</option>
              {jobOptions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {state.kind === 'loading' ? <SkeletonV2 lines={6} label="Loading reports…" /> : null}
      {state.kind === 'forbidden' ? <ForbiddenStateV2 body="Your role does not include reports." /> : null}
      {state.kind === 'error' ? (
        <div role="alert">
          <EmptyStateV2
            title="Could not load reports"
            body={state.message}
            action={
              <ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>
                Try again
              </ButtonV2>
            }
          />
        </div>
      ) : null}

      {state.kind === 'ready' ? (
        <DashboardContent
          overview={state.data}
          periodLabel={periodDisplayLabel}
          selectedJobLabel={selectedJobLabel}
          stageFilter={stageFilter}
          sourceFilter={sourceFilter}
          drillJob={drillJob}
          dateFilter={dateFilter}
          metricFilter={metricFilter}
          hoveredTrendIdx={hoveredTrendIdx}
          setHoveredTrendIdx={setHoveredTrendIdx}
          onSelectMetric={(m) =>
            updateParams({
              metric: metricFilter === m ? null : m,
              stage: null,
              source: null,
              drillJob: null,
              date: null,
            })
          }
          onSelectStage={(s) =>
            updateParams({
              stage: stageFilter === s ? null : s,
              source: null,
              drillJob: null,
              date: null,
              metric: null,
            })
          }
          onSelectSource={(src) =>
            updateParams({
              source: sourceFilter === src ? null : src,
              stage: null,
              drillJob: null,
              date: null,
              metric: null,
            })
          }
          onSelectTopJob={(jobTitle) =>
            updateParams({
              drillJob: drillJob === jobTitle ? null : jobTitle,
              stage: null,
              source: null,
              date: null,
              metric: null,
            })
          }
          onSelectDate={(isoDate) =>
            updateParams({
              date: dateFilter === isoDate ? null : isoDate,
              stage: null,
              source: null,
              drillJob: null,
              metric: null,
            })
          }
          onClearDrilldown={clearDrilldown}
          returnHref={returnHref}
        />
      ) : null}
    </div>
  );
}

function SummaryMetricDelta({ metric }: { metric: ReportSummaryCardMetric }) {
  if (metric.changePct === null || metric.changePct === undefined) {
    return (
      <span className="rf2-rep-kpi__delta rf2-rep-kpi__delta--none">
        No prior baseline
      </span>
    );
  }
  if (metric.changePct > 0) {
    return (
      <span className="rf2-rep-kpi__delta rf2-rep-kpi__delta--up">
        ↑ {metric.changePct}%
      </span>
    );
  }
  if (metric.changePct < 0) {
    return (
      <span className="rf2-rep-kpi__delta rf2-rep-kpi__delta--down">
        ↓ {Math.abs(metric.changePct)}%
      </span>
    );
  }
  return (
    <span className="rf2-rep-kpi__delta rf2-rep-kpi__delta--flat">
      0%
    </span>
  );
}

function DashboardContent({
  overview,
  periodLabel,
  selectedJobLabel,
  stageFilter,
  sourceFilter,
  drillJob,
  dateFilter,
  metricFilter,
  hoveredTrendIdx,
  setHoveredTrendIdx,
  onSelectMetric,
  onSelectStage,
  onSelectSource,
  onSelectTopJob,
  onSelectDate,
  onClearDrilldown,
  returnHref,
}: {
  overview: ReportOverview;
  periodLabel: string;
  selectedJobLabel: string;
  stageFilter: string;
  sourceFilter: string;
  drillJob: string;
  dateFilter: string;
  metricFilter: MetricDrillKey | '';
  hoveredTrendIdx: number | null;
  setHoveredTrendIdx: (idx: number | null) => void;
  onSelectMetric: (m: MetricDrillKey) => void;
  onSelectStage: (stage: string) => void;
  onSelectSource: (source: string) => void;
  onSelectTopJob: (jobTitle: string) => void;
  onSelectDate: (isoDate: string) => void;
  onClearDrilldown: () => void;
  returnHref: string;
}) {
  const funnel = useMemo(() => fallbackReachedFunnel(overview), [overview]);
  const sourcePerf = useMemo(() => fallbackSourcePerformance(overview), [overview]);
  const summaryCards = useMemo(() => resolveSummaryCards(overview, funnel), [overview, funnel]);
  const topJobs = useMemo(() => resolveTopJobs(overview, funnel), [overview, funnel]);
  const trendPoints = useMemo(() => resolveTrendPoints(overview, funnel), [overview, funnel]);

  // 1. Trend calculations
  const maxTrendApps = useMemo(
    () => Math.max(0, ...trendPoints.map((p) => p.applications)),
    [trendPoints],
  );
  const { scaleMax, ticks: yTicks } = useMemo(() => computeYAxisTicks(maxTrendApps), [maxTrendApps]);

  const xTickIndices = useMemo(() => {
    const n = trendPoints.length;
    if (n === 0) return [];
    if (n <= 5) return trendPoints.map((_, i) => i);
    const step = (n - 1) / 4;
    return Array.from(new Set([0, Math.round(step), Math.round(step * 2), Math.round(step * 3), n - 1]));
  }, [trendPoints]);

  const activeTrendIdx = useMemo(() => {
    if (hoveredTrendIdx !== null && trendPoints[hoveredTrendIdx]) return hoveredTrendIdx;
    if (dateFilter) {
      const idx = trendPoints.findIndex((p) => p.periodStart.slice(0, 10) === dateFilter);
      if (idx >= 0) return idx;
    }
    return null;
  }, [hoveredTrendIdx, dateFilter, trendPoints]);

  // 2. Source calculations (reconciled with total)
  const sourceItems = useMemo(() => {
    const total = sourcePerf.totalApplicants;
    return sourcePerf.sources.map((s, idx) => ({
      source: s.source,
      count: s.applicants,
      pct: total > 0 ? Math.round((s.applicants / total) * 100) : 0,
      color: SOURCE_PALETTE[idx % SOURCE_PALETTE.length]!,
      tooFewToJudge: s.tooFewToJudge,
    }));
  }, [sourcePerf]);

  const doughnutSegments = useMemo(() => {
    const radius = 56;
    const circumference = 2 * Math.PI * radius;
    const total = sourcePerf.totalApplicants;
    if (total <= 0 || sourceItems.length === 0) return { circumference, segments: [] };

    let accumulatedFraction = 0;
    const segments = sourceItems
      .filter((item) => item.count > 0)
      .map((item) => {
        const fraction = item.count / total;
        const dashLength = Math.max(2, fraction * circumference);
        const dashOffset = -accumulatedFraction * circumference;
        accumulatedFraction += fraction;
        return {
          ...item,
          dashArray: `${dashLength} ${circumference}`,
          dashOffset,
        };
      });
    return { circumference, segments };
  }, [sourcePerf.totalApplicants, sourceItems]);

  // 3. Top jobs calculations
  const visibleTopJobs = useMemo(() => topJobs.slice(0, 5), [topJobs]);
  const maxTopJobApps = useMemo(
    () => Math.max(1, ...visibleTopJobs.map((j) => j.applicationsCount)),
    [visibleTopJobs],
  );

  // 4. Stage conversion calculations (Applied, Screening, Interview, Offer, Hired)
  const conversionStages = useMemo(() => {
    const cohortTotal = funnel.cohortTotal;
    const stageLookup = new Map(funnel.stages.map((s) => [s.stage, s.reachedCount]));
    const hiredCount = stageLookup.get('Joined') ?? stageLookup.get('Hired') ?? funnel.joined ?? 0;

    const definitions = [
      { key: 'Applied', label: 'Applied', count: stageLookup.get('Applied') ?? cohortTotal },
      { key: 'Screening', label: 'Screening', count: stageLookup.get('Screening') ?? 0 },
      { key: 'Interview', label: 'Interview', count: stageLookup.get('Interview') ?? funnel.reachedInterview },
      { key: 'Offer', label: 'Offer', count: stageLookup.get('Offer') ?? 0 },
      { key: 'Hired', label: 'Hired', count: hiredCount },
    ];

    return definitions.map((d) => {
      const pct = cohortTotal > 0 ? Math.min(100, Math.round((d.count / cohortTotal) * 100)) : 0;
      const widthPct = d.count === 0 ? 0 : pct;
      return {
        ...d,
        pct,
        widthPct,
      };
    });
  }, [funnel]);

  // 5. On-page detail drilldown records
  const hasActiveDrilldown = Boolean(
    stageFilter || sourceFilter || drillJob || dateFilter || metricFilter,
  );

  const sourceByAppId = useMemo(
    () => new Map(sourcePerf.records.map((r) => [r.applicationId, r.source])),
    [sourcePerf.records],
  );

  const drilldownInfo = useMemo(() => {
    if (!hasActiveDrilldown) return null;

    let title = 'Matching applications';
    let records: ReportFunnelRecord[] = funnel.records;

    if (stageFilter) {
      const targetStage = stageFilter === 'Hired' ? 'Joined' : stageFilter;
      title = `Stage conversion: ${stageFilter}`;
      if (targetStage === 'REJECTED' || targetStage === 'WITHDRAWN') {
        records = funnel.records.filter((r) => r.outcome === targetStage);
      } else {
        records = funnel.records.filter(
          (r) =>
            r.reachedStages.includes(targetStage) ||
            (targetStage === 'Joined' && r.outcome === 'JOINED'),
        );
      }
    } else if (sourceFilter) {
      title = `Applications by source: ${sourceFilter}`;
      const matchingIds = new Set(
        sourcePerf.records.filter((r) => r.source === sourceFilter).map((r) => r.applicationId),
      );
      records = funnel.records.filter((r) => matchingIds.has(r.applicationId));
    } else if (drillJob) {
      title = `Top job: ${drillJob}`;
      records = funnel.records.filter((r) => r.jobTitle === drillJob || r.vacancyId === drillJob);
    } else if (dateFilter) {
      title = `Applications on ${formatFullDate(dateFilter)}`;
      records = funnel.records.filter((r) => r.appliedAt.slice(0, 10) === dateFilter);
    } else if (metricFilter) {
      if (metricFilter === 'newCandidates') {
        title = 'New candidates in period';
        records = funnel.records;
      } else if (metricFilter === 'interviewsScheduled') {
        title = 'Candidates reaching interview';
        records = funnel.records.filter((r) => r.reachedStages.includes('Interview'));
      } else if (metricFilter === 'offersSent') {
        title = 'Candidates reaching offer';
        records = funnel.records.filter((r) => r.reachedStages.includes('Offer'));
      } else if (metricFilter === 'hires') {
        title = 'Hires in period';
        records = funnel.records.filter(
          (r) => r.reachedStages.includes('Joined') || r.outcome === 'JOINED',
        );
      }
    }

    return { title, records };
  }, [hasActiveDrilldown, stageFilter, sourceFilter, drillJob, dateFilter, metricFilter, funnel.records, sourcePerf.records]);

  const handleExportDrilldownCsv = () => {
    if (!drilldownInfo) return;
    triggerCsvDownload('reports-details.csv', [
      ['Selection', drilldownInfo.title],
      ['Period', periodLabel],
      ['Job filter', selectedJobLabel],
      [],
      ['Candidate', 'Job', 'Source', 'Current stage', 'Reached stages', 'Owner', 'Status / Blocker'],
      ...drilldownInfo.records.map((r) => [
        r.candidateName,
        r.jobTitle,
        sourceByAppId.get(r.applicationId) ?? '—',
        r.currentStage === 'Joined' ? 'Hired' : r.currentStage,
        r.reachedStages.map((s) => (s === 'Joined' ? 'Hired' : s)).join(' -> '),
        r.ownerName,
        r.blockerSummary ?? '',
      ]),
    ]);
  };

  return (
    <>
      {/* 4 Summary Cards */}
      <section className="rf2-rep-kpis" aria-label="Recruitment summary">
        <button
          type="button"
          className="rf2-rep-kpi"
          aria-pressed={metricFilter === 'newCandidates'}
          onClick={() => onSelectMetric('newCandidates')}
        >
          <span className="rf2-rep-kpi__lbl">New candidates</span>
          <span className="rf2-rep-kpi__val" data-testid="kpi-new-candidates">
            {summaryCards.newCandidates.count}
          </span>
          <SummaryMetricDelta metric={summaryCards.newCandidates} />
        </button>

        <button
          type="button"
          className="rf2-rep-kpi"
          aria-pressed={metricFilter === 'interviewsScheduled'}
          onClick={() => onSelectMetric('interviewsScheduled')}
        >
          <span className="rf2-rep-kpi__lbl">Interviews scheduled</span>
          <span className="rf2-rep-kpi__val" data-testid="kpi-interviews-scheduled">
            {summaryCards.interviewsScheduled.count}
          </span>
          <SummaryMetricDelta metric={summaryCards.interviewsScheduled} />
        </button>

        <button
          type="button"
          className="rf2-rep-kpi"
          aria-pressed={metricFilter === 'offersSent'}
          onClick={() => onSelectMetric('offersSent')}
        >
          <span className="rf2-rep-kpi__lbl">Offers sent</span>
          <span className="rf2-rep-kpi__val" data-testid="kpi-offers-sent">
            {summaryCards.offersSent.count}
          </span>
          <SummaryMetricDelta metric={summaryCards.offersSent} />
        </button>

        <button
          type="button"
          className="rf2-rep-kpi"
          aria-pressed={metricFilter === 'hires'}
          onClick={() => onSelectMetric('hires')}
        >
          <span className="rf2-rep-kpi__lbl">Hires</span>
          <span className="rf2-rep-kpi__val" data-testid="kpi-hires">
            {summaryCards.hires.count}
          </span>
          <SummaryMetricDelta metric={summaryCards.hires} />
        </button>
      </section>

      {/* Balanced 2x2 Grid */}
      <div className="rf2-rep-grid">
        {/* 1. Applications trend */}
        <section className="rf2-rep-panel" aria-labelledby="rep-trend-heading">
          <div className="rf2-rep-panel__head">
            <h2 id="rep-trend-heading" className="rf2-rep-panel__title">
              Applications trend
            </h2>
          </div>

          <div className="rf2-rep-trend" onMouseLeave={() => setHoveredTrendIdx(null)}>
            <div className="rf2-rep-trend__y" aria-hidden="true">
              {yTicks.map((tick) => (
                <span key={tick} className="rf2-rep-trend__ytick">
                  {tick}
                </span>
              ))}
            </div>

            <div className="rf2-rep-trend__plot">
              {/* Grid lines */}
              <div className="rf2-rep-trend__grid" aria-hidden="true">
                {yTicks.map((tick) => (
                  <div key={tick} className="rf2-rep-trend__gridline" />
                ))}
              </div>

              {/* Tooltip */}
              {activeTrendIdx !== null && trendPoints[activeTrendIdx] ? (
                <div
                  className="rf2-rep-trend__tooltip"
                  role="status"
                  data-testid="trend-tooltip"
                  style={{
                    left: `${Math.min(
                      84,
                      Math.max(16, ((activeTrendIdx + 0.5) / Math.max(1, trendPoints.length)) * 100),
                    )}%`,
                  }}
                >
                  <p className="rf2-rep-trend__tooltip-date">
                    {formatFullDate(trendPoints[activeTrendIdx]!.periodStart)}
                  </p>
                  <p className="rf2-rep-trend__tooltip-val">
                    {trendPoints[activeTrendIdx]!.applications}{' '}
                    {trendPoints[activeTrendIdx]!.applications === 1 ? 'application' : 'applications'}
                  </p>
                </div>
              ) : null}

              {/* Bars */}
              <div className="rf2-rep-trend__bars" role="group" aria-label="Daily application counts">
                {trendPoints.map((pt, idx) => {
                  const isoDate = pt.periodStart.slice(0, 10);
                  const heightPct =
                    pt.applications === 0
                      ? 0
                      : Math.min(100, Math.max(6, Math.round((pt.applications / scaleMax) * 100)));
                  const isSelected = dateFilter === isoDate;
                  const isHovered = activeTrendIdx === idx;
                  return (
                    <button
                      key={pt.periodStart}
                      type="button"
                      className="rf2-rep-trend__bar-btn"
                      data-active={isSelected || isHovered || undefined}
                      aria-pressed={isSelected}
                      aria-label={`${formatFullDate(pt.periodStart)}: ${pt.applications} ${
                        pt.applications === 1 ? 'application' : 'applications'
                      }`}
                      onMouseEnter={() => setHoveredTrendIdx(idx)}
                      onFocus={() => setHoveredTrendIdx(idx)}
                      onBlur={() => setHoveredTrendIdx(null)}
                      onClick={() => onSelectDate(isoDate)}
                    >
                      <span
                        className="rf2-rep-trend__bar"
                        data-testid={`trend-bar-${idx}`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </button>
                  );
                })}
              </div>

              {/* X-axis labels */}
              <div className="rf2-rep-trend__x" aria-hidden="true">
                {xTickIndices.map((idx) => {
                  const pt = trendPoints[idx];
                  if (!pt) return null;
                  return (
                    <span key={pt.periodStart} className="rf2-rep-trend__xtick">
                      {formatShortTick(pt.periodStart, pt.label)}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* 2. Applications by source */}
        <section className="rf2-rep-panel" aria-labelledby="rep-source-heading">
          <div className="rf2-rep-panel__head">
            <h2 id="rep-source-heading" className="rf2-rep-panel__title">
              Applications by source
            </h2>
          </div>

          <div className="rf2-rep-source">
            <div className="rf2-rep-donut" aria-hidden="true">
              <svg className="rf2-rep-donut__svg" viewBox="0 0 160 160">
                <circle
                  cx="80"
                  cy="80"
                  r="56"
                  fill="none"
                  stroke="var(--rf2-donut-track, #e2e8f0)"
                  strokeWidth="22"
                />
                {doughnutSegments.segments.map((seg) => (
                  <circle
                    key={seg.source}
                    cx="80"
                    cy="80"
                    r="56"
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={sourceFilter === seg.source ? '25' : '22'}
                    strokeDasharray={seg.dashArray}
                    strokeDashoffset={seg.dashOffset}
                    transform="rotate(-90 80 80)"
                    className="rf2-rep-donut__seg"
                  />
                ))}
              </svg>
              <div className="rf2-rep-donut__center">
                <span className="rf2-rep-donut__total" data-testid="source-donut-total">
                  {sourcePerf.totalApplicants}
                </span>
                <span className="rf2-rep-donut__lbl">Applications</span>
              </div>
            </div>

            {sourceItems.length === 0 ? (
              <p className="rf2-rep-empty-inline">No source data recorded in this period.</p>
            ) : (
              <ul className="rf2-rep-source__legend" aria-label="Source breakdown">
                {sourceItems.map((item) => {
                  const active = sourceFilter === item.source;
                  return (
                    <li key={item.source}>
                      <button
                        type="button"
                        className="rf2-rep-source__row"
                        aria-pressed={active}
                        aria-label={`${item.source}: ${item.count} (${item.pct}%)`}
                        onClick={() => onSelectSource(item.source)}
                      >
                        <span className="rf2-rep-source__name-wrap">
                          <span
                            className="rf2-rep-source__dot"
                            style={{ backgroundColor: item.color }}
                            aria-hidden="true"
                          />
                          <span className="rf2-rep-source__name">{item.source}</span>
                        </span>
                        <span className="rf2-rep-source__val" data-testid={`source-val-${item.source}`}>
                          {item.count} ({item.pct}%)
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* 3. Top jobs by applications */}
        <section className="rf2-rep-panel" aria-labelledby="rep-topjobs-heading">
          <div className="rf2-rep-panel__head">
            <h2 id="rep-topjobs-heading" className="rf2-rep-panel__title">
              Top jobs by applications
            </h2>
          </div>

          {visibleTopJobs.length === 0 ? (
            <p className="rf2-rep-empty-inline">No job applications received in this period.</p>
          ) : (
            <ul className="rf2-rep-hbars" aria-label="Top jobs by applications">
              {visibleTopJobs.map((job) => {
                const widthPct =
                  job.applicationsCount === 0
                    ? 0
                    : Math.min(100, Math.round((job.applicationsCount / maxTopJobApps) * 100));
                const active = drillJob === job.jobTitle;
                return (
                  <li key={job.vacancyId || job.jobTitle}>
                    <button
                      type="button"
                      className="rf2-rep-hbar-btn"
                      aria-pressed={active}
                      aria-label={`${job.jobTitle}: ${job.applicationsCount} applications`}
                      onClick={() => onSelectTopJob(job.jobTitle)}
                    >
                      <span className="rf2-rep-hbar-lbl">{job.jobTitle}</span>
                      <span className="rf2-rep-hbar-track" aria-hidden="true">
                        <span
                          className="rf2-rep-hbar-fill"
                          data-testid={`topjob-bar-${job.jobTitle}`}
                          style={{ width: `${widthPct}%` }}
                        />
                      </span>
                      <span className="rf2-rep-hbar-val rf2-rep-hbar-val--count">
                        {job.applicationsCount}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* 4. Stage conversion */}
        <section className="rf2-rep-panel" aria-labelledby="rep-conversion-heading">
          <div className="rf2-rep-panel__head">
            <h2 id="rep-conversion-heading" className="rf2-rep-panel__title">
              Stage conversion
            </h2>
            {funnel.tooFewToJudge ? (
              <span className="rf2-rep-sample-badge" data-testid="conversion-small-sample">
                Too few to judge (n={funnel.cohortTotal})
              </span>
            ) : null}
          </div>

          <ul className="rf2-rep-hbars" aria-label="Stage conversion">
            {conversionStages.map((st) => {
              const active = stageFilter === st.key;
              return (
                <li key={st.key}>
                  <button
                    type="button"
                    className="rf2-rep-hbar-btn rf2-rep-hbar-btn--conv"
                    aria-pressed={active}
                    aria-label={`${st.label}: ${st.pct}% (${st.count})`}
                    onClick={() => onSelectStage(st.key)}
                  >
                    <span className="rf2-rep-hbar-lbl">{st.label}</span>
                    <span className="rf2-rep-hbar-track" aria-hidden="true">
                      <span
                        className="rf2-rep-hbar-fill"
                        data-testid={`funnel-bar-${st.key}`}
                        style={{ width: `${st.widthPct}%` }}
                      />
                    </span>
                    <span className="rf2-rep-hbar-val" data-testid={`funnel-val-${st.key}`}>
                      {st.pct}% ({st.count})
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {/* On-demand details section within the same page */}
      {drilldownInfo ? (
        <section className="rf2-rep-details" aria-label="Selected report details">
          <div className="rf2-rep-details__head">
            <div>
              <h2 className="rf2-rep-details__title">{drilldownInfo.title}</h2>
              <p className="rf2-rep-details__sub">
                {drilldownInfo.records.length}{' '}
                {drilldownInfo.records.length === 1 ? 'application' : 'applications'} · {periodLabel} ·{' '}
                {selectedJobLabel}
                {drilldownInfo.records.length > 0 && drilldownInfo.records.length < 5
                  ? ` · Too few to judge (n=${drilldownInfo.records.length})`
                  : ''}
              </p>
            </div>
            <div className="rf2-rep-details__actions">
              {drilldownInfo.records.length > 0 ? (
                <ButtonV2
                  kind="secondary"
                  size="sm"
                  icon={<Download />}
                  onClick={handleExportDrilldownCsv}
                >
                  Export CSV
                </ButtonV2>
              ) : null}
              <ButtonV2
                kind="secondary"
                size="sm"
                icon={<X />}
                onClick={onClearDrilldown}
                aria-label="Close details"
              >
                Close details
              </ButtonV2>
            </div>
          </div>

          {drilldownInfo.records.length === 0 ? (
            <EmptyStateV2
              headingLevel={3}
              title="No matching applications"
              body="No candidate applications matched this selection in the active period and job scope."
            />
          ) : (
            <div className="rf2-rep-details__table-wrap">
              <table className="rf2-jtable" aria-label="Matching applications">
                <thead>
                  <tr>
                    <th scope="col">Candidate</th>
                    <th scope="col">Job</th>
                    <th scope="col">Source</th>
                    <th scope="col">Current stage</th>
                    <th scope="col">Reached</th>
                    <th scope="col">Owner / Status</th>
                    <th scope="col">
                      <span className="rf2-sr-only">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {drilldownInfo.records.map((rec) => {
                    const fileHref = withReturnTo(
                      `/applications/${encodeURIComponent(rec.applicationId)}`,
                      returnHref,
                    );
                    const displayStage = rec.currentStage === 'Joined' ? 'Hired' : rec.currentStage;
                    return (
                      <tr key={rec.applicationId}>
                        <td>
                          <Link className="rf2-kcard__name" to={fileHref}>
                            {rec.candidateName}
                          </Link>
                        </td>
                        <td>{rec.jobTitle}</td>
                        <td>{sourceByAppId.get(rec.applicationId) ?? '—'}</td>
                        <td>
                          <StatusChip
                            tone={STAGE_TONE[displayStage] ?? 'info'}
                            label={displayStage}
                          />
                        </td>
                        <td className="rf2-jtable__sub">
                          {rec.reachedStages.map((s) => (s === 'Joined' ? 'Hired' : s)).join(' → ')}
                        </td>
                        <td className="rf2-jtable__sub">{rec.blockerSummary ?? rec.ownerName}</td>
                        <td className="rf2-jtable__act">
                          <Link className="rf2-btn rf2-btn--secondary rf2-btn--sm" to={fileHref}>
                            Open file
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </>
  );
}
