import { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type { ReportOverview, RecruitmentKpiItem } from '@recruitflow/contracts';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { getApi, downloadApi } from '../api/client';
import './PageEnhancementsV2.css';

type SourceDatum = { name: string; value: number; pct: string; color: string };
type OfferDatum = { name: string; value: number; pct: string; color: string };
type FunnelDatum = { stage: string; count: number; pct: string; color: string; width: string };
type PositionHiringDatum = { name: string; target: number; joined: number; fillRate: number; color: string };

function formatChip(label: string, value: string | number, detail?: string) {
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
      <span>{label}</span>
      <span className="font-semibold text-slate-900 dark:text-white">{value}</span>
      {detail ? <span className="text-slate-500">{detail}</span> : null}
    </span>
  );
}

function formatPeriodChange(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? 'No activity in either period' : 'New activity vs previous period';
  const change = Math.round(((current - previous) / previous) * 100);
  return `${change > 0 ? '+' : ''}${change}% vs previous period`;
}

// ── Department Breakdown Data ──
export function ReportsPage() {
  const [reportViewMode, setReportViewMode] = useState<'overview' | 'kpis'>('overview');
  const [dateRangePreset, setDateRangePreset] = useState<'7d' | '30d' | 'quarter' | 'ytd'>('7d');
  const [timeGranularity, setTimeGranularity] = useState<'Daily' | 'Weekly' | 'Monthly'>('Daily');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [reportOverview, setReportOverview] = useState<ReportOverview | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const getRangeDates = (preset: '7d' | '30d' | 'quarter' | 'ytd') => {
    const now = new Date();
    const to = now.toISOString();
    let fromDate: Date;
    switch (preset) {
      case '7d':
        fromDate = new Date(now.getTime() - 7 * 86_400_000);
        break;
      case '30d':
        fromDate = new Date(now.getTime() - 30 * 86_400_000);
        break;
      case 'quarter':
        fromDate = new Date(now.getTime() - 90 * 86_400_000);
        break;
      case 'ytd':
        fromDate = new Date(now.getFullYear(), 0, 1);
        break;
    }
    return { from: fromDate.toISOString(), to };
  };

  useEffect(() => {
    let isMounted = true;
    const loadReport = async () => {
      setIsLoadingReport(true);
      try {
        const { from, to } = getRangeDates(dateRangePreset);
        const data = await getApi<ReportOverview>(
          `/reports/overview?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        );
        if (isMounted && data) {
          setReportOverview(data);
        }
      } catch (err) {
        console.warn('Could not load live reports overview', err);
      } finally {
        if (isMounted) {
          setIsLoadingReport(false);
        }
      }
    };
    void loadReport();
    return () => {
      isMounted = false;
    };
  }, [dateRangePreset]);

  const dateLabel = useMemo(() => {
    if (reportOverview?.range?.from && reportOverview?.range?.to) {
      const fromD = new Date(reportOverview.range.from).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
      });
      const toD = new Date(reportOverview.range.to).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      return `${fromD} – ${toD}`;
    }
    const range = getRangeDates(dateRangePreset);
    return `${new Date(range.from).toLocaleDateString('en-GB')} – ${new Date(range.to).toLocaleDateString('en-GB')}`;
  }, [dateRangePreset, reportOverview]);

  // Period metrics are derived only from the selected range and actual comparison data.
  const kpis = useMemo(() => {
    if (reportOverview) {
      const appCount = reportOverview.trend.reduce((sum, point) => sum + (point.applications || 0), 0);
      const intCount = reportOverview.trend.reduce((sum, point) => sum + (point.interviews || 0), 0);
      const offCount = reportOverview.trend.reduce((sum, point) => sum + (point.offers || 0), 0);
      const hireCount = reportOverview.kpis.totalJoined.count;
      const ttf = reportOverview.kpis.timeToFill.value;
      const hasTimeToFill = reportOverview.kpis.timeToFill.sampleCount === undefined
        ? ttf > 0
        : reportOverview.kpis.timeToFill.sampleCount > 0;

      return {
        applications: appCount,
        appTrend: formatPeriodChange(appCount, reportOverview.comparison.applications),
        interviews: intCount,
        intTrend: formatPeriodChange(intCount, reportOverview.comparison.interviews),
        offers: offCount,
        offTrend: formatPeriodChange(offCount, reportOverview.comparison.offers),
        hires: hireCount,
        hireTrend: hireCount > 0 ? `${hireCount} joined in period` : 'No hires in period',
        timeToFill: ttf,
        hasTimeToFill,
        timeTrend:
          (reportOverview.kpis?.timeToOffer?.value ?? 0) > 0
            ? `${reportOverview.kpis.timeToOffer.value}d average from application to offer`
            : 'No offer timing data',
      };
    }
    return {
      applications: 0,
      appTrend: 'No data',
      interviews: 0,
      intTrend: 'No data',
      offers: 0,
      offTrend: 'No data',
      hires: 0,
      hireTrend: 'No data',
      timeToFill: 0,
      hasTimeToFill: false,
      timeTrend: 'No data',
    };
  }, [reportOverview, dateRangePreset]);

  // Dynamic Time Series for Applications Over Time
  const applicationsOverTime = useMemo(() => {
    if (reportOverview && reportOverview.trend.length > 0) {
      const grouped = new Map<string, { date: string; applications: number }>();
      for (const point of reportOverview.trend) {
        const start = new Date(point.periodStart);
        let key = point.periodStart;
        let label = point.label;
        if (timeGranularity === 'Weekly') {
          const weekStart = new Date(start);
          weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
          key = weekStart.toISOString().slice(0, 10);
          label = weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
        } else if (timeGranularity === 'Monthly') {
          key = `${start.getUTCFullYear()}-${start.getUTCMonth()}`;
          label = start.toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' });
        }
        const bucket = grouped.get(key) ?? { date: label, applications: 0 };
        bucket.applications += point.applications;
        grouped.set(key, bucket);
      }
      return [...grouped.values()];
    }
    return [];
  }, [reportOverview, timeGranularity]);

  // Applications by Source Data
  const sourcesData = useMemo<SourceDatum[]>(() => {
    const sourceRows = reportOverview?.sourceBreakdown ?? [];
    const colors = ['#3b82f6', '#10b981', '#f97316', '#a855f7', '#06b6d4', '#ec4899', '#eab308', '#6366f1'];
    const total = sourceRows.reduce((sum, source) => sum + source.total, 0);
    return sourceRows.map((source, index) => ({
      name: source.name,
      value: source.total,
      pct: total > 0 ? `${Math.round((source.total / total) * 100)}%` : '—',
      color: colors[index % colors.length],
    }));
  }, [reportOverview]);

  // Offer Acceptance Rate Data
  const offerAcceptanceData = useMemo<OfferDatum[]>(() => {
    if (reportOverview?.kpis?.offerAcceptanceRate) {
      const accepted = reportOverview.kpis.offerAcceptanceRate.accepted || 0;
      const total = reportOverview.kpis.offerAcceptanceRate.total || 0;
      const declined = Math.max(0, total - accepted);
      const rate = reportOverview.kpis.offerAcceptanceRate.value || 0;
      if (total > 0) {
        return [
          { name: 'Accepted', value: accepted, pct: `${rate}%`, color: '#10b981' },
          {
            name: 'Not accepted',
            value: declined,
            pct: `${Math.round((declined / total) * 100)}%`,
            color: '#ef4444',
          },
        ];
      }
    }
    return [];
  }, [reportOverview]);

  // Funnel Conversion Stages
  const funnelStagesData = useMemo<FunnelDatum[]>(() => {
    if (reportOverview && reportOverview.funnel.length > 0) {
      const colors = ['#3b82f6', '#10b981', '#f97316', '#a855f7', '#6366f1', '#06b6d4'];
      return reportOverview.funnel.map((f, i) => ({
        stage: f.name,
        count: f.count,
        pct: `${f.percent}%`,
        color: colors[i % colors.length],
        width: `${Math.max(12, f.percent)}%`,
      }));
    }
    return [];
  }, [reportOverview, kpis]);

  // Approved headcount and joined hires by position, from vacancy and hiring data.
  const positionHiringData = useMemo<PositionHiringDatum[]>(() => {
    if (reportOverview && reportOverview.hiringByPosition.length > 0) {
      const colors = ['#3b82f6', '#10b981', '#f97316', '#a855f7', '#06b6d4', '#ec4899', '#eab308', '#6366f1'];
      return reportOverview.hiringByPosition.map((pos, idx) => ({
        name: pos.position,
        target: pos.target,
        joined: pos.joined,
        fillRate: pos.target > 0 ? Math.min(100, Math.round((pos.joined / pos.target) * 100)) : 0,
        color: colors[idx % colors.length],
      }));
    }
    return [];
  }, [reportOverview]);

  // Only KPIs that the backend can calculate from recorded data are shown.
  const activeRecruitmentKpis = useMemo<RecruitmentKpiItem[]>(() => {
    return reportOverview?.recruitmentKpis ?? [];
  }, [reportOverview]);

  const recruiterActivityRows = useMemo(
    () => [...(reportOverview?.recruiterWorkload ?? [])].sort((left, right) => (right.activity?.total ?? 0) - (left.activity?.total ?? 0)),
    [reportOverview],
  );
  const recruiterActivityTotals = useMemo(
    () => recruiterActivityRows.reduce(
      (totals, recruiter) => ({
        actions: totals.actions + (recruiter.activity?.total ?? 0),
        applications: totals.applications + (recruiter.activity?.applications ?? 0),
        screening: totals.screening + (recruiter.activity?.screening ?? 0),
        interviews: totals.interviews + (recruiter.activity?.interviews ?? 0),
        offers: totals.offers + (recruiter.activity?.offers ?? 0),
        hiring: totals.hiring + (recruiter.activity?.hiring ?? 0),
      }),
      { actions: 0, applications: 0, screening: 0, interviews: 0, offers: 0, hiring: 0 },
    ),
    [recruiterActivityRows],
  );

  const handleExportKpisCSV = () => {
    const headers = ['Position', 'KPI Name', 'Definition', 'Current Value', 'Target', 'Achievement Rate', 'Status', 'Notes'];
    const rows = activeRecruitmentKpis.map((k) => [
      `"${k.position}"`,
      `"${k.name}"`,
      `"${k.definition.replace(/"/g, '""')}"`,
      `"${k.formattedValue}"`,
      `"${k.formattedTarget}"`,
      `"${k.achievementRate}%"`,
      `"${k.status}"`,
      `"${(k.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [
      ['Saudi German Health - Recruitment KPIs Scorecard'],
      ['Reporting Range', dateLabel],
      ['Generated At', new Date().toLocaleString()],
      [],
      headers,
      ...rows,
    ]
      .map((row) => (Array.isArray(row) ? row.join(',') : row))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Recruitment_KPIs_Scorecard_${dateRangePreset}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setIsExportModalOpen(false);
    showToast('KPI spreadsheet downloaded.');
  };

  // ── Active Export Handlers ──
  const handleExportCSV = () => {
    const csvContent = [
      ['Saudi German Health - Recruitment Performance Report'],
      ['Reporting Range', dateLabel],
      ['Generated At', new Date().toLocaleString()],
      [],
      ['Metric', 'Value', 'Comparison Trend'],
      ['Total Applications', kpis.applications, kpis.appTrend],
      ['Interviews Conducted', kpis.interviews, kpis.intTrend],
      ['Offers Extended', kpis.offers, kpis.offTrend],
      ['Hires Finalized', kpis.hires, kpis.hireTrend],
      ['Avg Time to Fill (Days)', kpis.hasTimeToFill ? kpis.timeToFill : 'No data', kpis.timeTrend],
      [],
      ['Recruiter Activity', 'Successful actions in selected period'],
      ['Recruiter', 'Applications', 'Screening', 'Interviews', 'Offers', 'Hiring', 'Open Positions', 'Overdue Tasks'],
      ...recruiterActivityRows.map((recruiter) => [
        recruiter.name,
        recruiter.activity?.applications ?? 0,
        recruiter.activity?.screening ?? 0,
        recruiter.activity?.interviews ?? 0,
        recruiter.activity?.offers ?? 0,
        recruiter.activity?.hiring ?? 0,
        recruiter.vacancies,
        recruiter.overdueTasks,
      ]),
      [],
      ['Source Breakdown', 'Volume', 'Percentage'],
      ...sourcesData.map((s) => [s.name, s.value, s.pct]),
      [],
      ['Hiring Progress by Position', 'Approved Headcount', 'Joined Hires', 'Fill Rate'],
      ...positionHiringData.map((position) => [position.name, position.target, position.joined, `${position.fillRate}%`]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `SGH_Recruitment_Report_${dateRangePreset}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setIsExportModalOpen(false);
    showToast('Report downloaded.');
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const { from, to } = getRangeDates(dateRangePreset);
      const blob = await downloadApi(
        `/reports/export.xlsx?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SGH_Recruitment_Report_${dateRangePreset}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setIsExportModalOpen(false);
      showToast('Excel report downloaded.');
    } catch (err) {
      console.warn('Backend excel export failed, falling back to CSV', err);
      handleExportCSV();
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = () => {
    setIsExportModalOpen(false);
    showToast('Opening print preview.');
    setTimeout(() => {
      window.print();
    }, 400);
  };

  return (
    <div className="flex w-full flex-col p-4 sm:p-6 lg:p-7 max-w-[1720px] mx-auto space-y-6">
      {/* ── Header Bar & Date Range Picker matching 07-recruitment-reports-dark.png ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="rf-page-title">Reports</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Hiring numbers for the selected period.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Export Report button */}
          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs cursor-pointer"
          >
            <Icon name="download" size={13} className="text-slate-600 dark:text-slate-400" />
            <span>Export report</span>
          </button>

          {/* Date Picker Button */}
          <button
            type="button"
            onClick={() => setIsDateModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs cursor-pointer"
          >
            <Icon name={isLoadingReport ? 'refresh-cw' : 'calendar'} size={14} className={`text-slate-600 dark:text-slate-400 ${isLoadingReport ? 'animate-spin' : ''}`} />
            <span>{isLoadingReport ? 'Syncing...' : dateLabel}</span>
            <Icon name="chevron-down" size={12} className="text-slate-600 dark:text-slate-400" />
          </button>
        </div>
      </div>

      {/* ── View Switcher: Executive Overview vs Recruitment KPIs Scorecard ── */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setReportViewMode('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            reportViewMode === 'overview'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <Icon name="report" size={14} />
          <span>Overview</span>
        </button>

        <button
          type="button"
          onClick={() => setReportViewMode('kpis')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            reportViewMode === 'kpis'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <Icon name="award" size={14} />
          <span>KPIs</span>
        </button>
      </div>

      {reportViewMode === 'overview' ? (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {formatChip('Applications', kpis.applications, kpis.appTrend)}
            {formatChip('Interviews', kpis.interviews, kpis.intTrend)}
            {formatChip('Offers', kpis.offers, kpis.offTrend)}
            {formatChip('Hires', kpis.hires, kpis.hireTrend)}
            {formatChip('Time to fill', kpis.hasTimeToFill ? `${kpis.timeToFill} days` : '—', kpis.timeTrend)}
          </div>

          <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-1 border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">Recruiter Activity & Workload</h2>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Successful recorded actions during {dateLabel}; open positions and overdue tasks show current workload.
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {recruiterActivityRows.length} recruiters · {recruiterActivityTotals.actions} recorded actions
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3">Recruiter</th>
                    <th className="px-3 py-3 text-right">App actions</th>
                    <th className="px-3 py-3 text-right">Screening</th>
                    <th className="px-3 py-3 text-right">Interviews</th>
                    <th className="px-3 py-3 text-right">Offers</th>
                    <th className="px-3 py-3 text-right">Hiring</th>
                    <th className="px-3 py-3 text-right">Open positions</th>
                    <th className="px-5 py-3 text-right">Overdue tasks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recruiterActivityRows.length > 0 ? recruiterActivityRows.map((recruiter) => (
                    <tr key={recruiter.id ?? recruiter.name} className="text-slate-700 dark:text-slate-300">
                      <td className="px-5 py-3 font-bold text-slate-900 dark:text-white">{recruiter.name}</td>
                      <td className="px-3 py-3 text-right">{recruiter.activity?.applications ?? 0}</td>
                      <td className="px-3 py-3 text-right">{recruiter.activity?.screening ?? 0}</td>
                      <td className="px-3 py-3 text-right">{recruiter.activity?.interviews ?? 0}</td>
                      <td className="px-3 py-3 text-right">{recruiter.activity?.offers ?? 0}</td>
                      <td className="px-3 py-3 text-right">{recruiter.activity?.hiring ?? 0}</td>
                      <td className="px-3 py-3 text-right">{recruiter.vacancies}</td>
                      <td className="px-5 py-3 text-right">{recruiter.overdueTasks}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={8} className="px-5 py-8 text-center text-slate-500 dark:text-slate-400">
                        {isLoadingReport ? 'Loading recruiter activity…' : 'No recruiter activity is available for this period.'}
                      </td>
                    </tr>
                  )}
                </tbody>
                {recruiterActivityRows.length > 0 && (
                  <tfoot className="border-t border-slate-200 bg-slate-50/80 font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200">
                    <tr>
                      <td className="px-5 py-3">Team activity</td>
                      <td className="px-3 py-3 text-right">{recruiterActivityTotals.applications}</td>
                      <td className="px-3 py-3 text-right">{recruiterActivityTotals.screening}</td>
                      <td className="px-3 py-3 text-right">{recruiterActivityTotals.interviews}</td>
                      <td className="px-3 py-3 text-right">{recruiterActivityTotals.offers}</td>
                      <td className="px-3 py-3 text-right">{recruiterActivityTotals.hiring}</td>
                      <td colSpan={2} className="px-5 py-3 text-right">{recruiterActivityTotals.actions} successful actions</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </section>
      {/* ── Row 2: 3 Analytics Visual Charts with Recharts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Chart 1: Applications Over Time (Recharts AreaChart) (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-[8px] shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Applications Over Time
            </h2>
            <select aria-label="Recruitment trend interval"
              value={timeGranularity}
              onChange={(e) => setTimeGranularity(e.target.value as typeof timeGranularity)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <option value="Daily">Daily</option>
              <option value="Weekly">Weekly</option>
              <option value="Monthly">Monthly</option>
            </select>
          </div>

          {/* Recharts Area Chart */}
          <div className="h-48 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={applicationsOverTime} margin={{ top: 12, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaAppGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '10px',
                    borderColor: '#334155',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 'bold',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="applications"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#areaAppGradient)"
                  name="Applications"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-1 bg-blue-500 rounded" /> Applications
            </span>
          </div>
        </div>

        {/* Chart 2: Applications by Source (Recharts Donut) (4 cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-[8px] shadow-xs flex flex-col justify-between space-y-4">
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
            Applications by Source
          </h2>

          <div className="flex flex-col sm:flex-row items-center gap-4 py-2">
            {/* Donut Chart */}
            <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '8px',
                      borderColor: '#334155',
                      color: '#fff',
                      fontSize: '11px',
                    }}
                  />
                  <Pie
                    data={sourcesData}
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={62}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {sourcesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Centered Total */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-lg font-black text-slate-900 dark:text-white">{kpis.applications}</span>
                <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Total</span>
              </div>
            </div>

            {/* Legend with percentages */}
            <div className="space-y-1.5 flex-1 min-w-0 text-xs">
              {sourcesData.map((item) => (
                <div key={item.name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-600 dark:text-slate-300 truncate text-[11.5px] font-medium">
                      {item.name}
                    </span>
                  </div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-[11.5px] shrink-0">
                    {item.value} <span className="text-slate-600 dark:text-slate-400 font-normal">({item.pct})</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-[11px] text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2">
            Highest conversion channel: <span className="font-bold text-emerald-700">{reportOverview?.kpis?.topSource?.name || 'No source data'} ({reportOverview?.kpis?.topSource?.conversionRate ?? 0}% to offer)</span>
          </div>
        </div>

        {/* Chart 3: Funnel Conversion Pipeline (3 cols) */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-[8px] shadow-xs flex flex-col justify-between space-y-4">
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
            Funnel Conversion
          </h2>

          <div className="space-y-2 py-1">
            {funnelStagesData.map((f) => (
              <div key={f.stage} className="space-y-1 group">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">{f.stage}</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {f.count} <span className="text-slate-600 dark:text-slate-400 font-normal">({f.pct})</span>
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 group-hover:brightness-110"
                    style={{ width: f.width, backgroundColor: f.color }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="text-[11px] text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2">
            Overall application-to-hire conversion: <span className="font-bold text-slate-900 dark:text-white">{kpis.applications > 0 ? ((kpis.hires / kpis.applications) * 100).toFixed(1) : '0'}%</span>
          </div>
        </div>
      </div>

      {/* ── Row 3: 3 Secondary Visual Charts matching reference ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Metric 1: Hiring progress by position (4 cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-[8px] shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Hiring Progress by Position
            </h2>
            <button
              type="button"
              onClick={() => setIsDeptModalOpen(true)}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              View all
            </button>
          </div>

          <div className="space-y-3 py-1">
            {positionHiringData.slice(0, 5).map((position) => (
              <div key={position.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{position.name}</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {position.joined}/{position.target} <span className="text-slate-600 dark:text-slate-400 font-normal">({position.fillRate}% filled)</span>
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${position.fillRate}%`, backgroundColor: position.color }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="text-[11px] text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2 flex items-center justify-between">
            <span>{Math.min(5, positionHiringData.length)} positions displayed</span>
            <span className="font-bold text-blue-600 dark:text-blue-400">{positionHiringData.length} total positions</span>
          </div>
        </div>

        {/* Metric 2: Average time to fill from completed hiring records (4 cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-[8px] shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Average Time to Fill
            </h2>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Completed hires with both vacancy and joining dates</p>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center py-3">
            <div className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
              {kpis.hasTimeToFill ? kpis.timeToFill : '—'}
              {kpis.hasTimeToFill && <span className="ml-1 text-base font-bold text-slate-500">days</span>}
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              {kpis.hasTimeToFill ? 'Average calendar days to fill' : 'No completed hires with dates in this period'}
            </p>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2">
            <span>SLA Target: &le; 30 days</span>
            <span className={`font-bold ${kpis.hasTimeToFill && kpis.timeToFill <= 30 ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
              {kpis.hasTimeToFill ? (kpis.timeToFill <= 30 ? 'On target' : 'Above target') : 'Not available'}
            </span>
          </div>
        </div>

        {/* Metric 3: Offer Acceptance Rate (Recharts Donut) (4 cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-[8px] shadow-xs flex flex-col justify-between space-y-4">
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
            Offer Acceptance Rate
          </h2>

          <div className="flex flex-col sm:flex-row items-center gap-4 py-2">
            {/* Donut Chart */}
            <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '8px',
                      borderColor: '#334155',
                      color: '#fff',
                      fontSize: '11px',
                    }}
                  />
                  <Pie
                    data={offerAcceptanceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={62}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {offerAcceptanceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Centered Total */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-lg font-black text-slate-900 dark:text-white">{offerAcceptanceData[0]?.pct || 'No data'}</span>
                <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Accepted</span>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-2 flex-1 min-w-0 text-xs">
              {offerAcceptanceData.map((item) => (
                <div key={item.name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-600 dark:text-slate-300 truncate text-[11.5px] font-medium">
                      {item.name}
                    </span>
                  </div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-[11.5px] shrink-0">
                    {item.value} <span className="text-slate-600 dark:text-slate-400 font-normal">({item.pct})</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2">
            <span>vs comparison period</span>
            <span className="font-bold text-emerald-700 dark:text-emerald-400">{reportOverview?.kpis?.offerAcceptanceRate ? `${reportOverview.kpis.offerAcceptanceRate.value}% acceptance` : 'No data'}</span>
          </div>
        </div>
      </div>

      {/* ── Row 4: Key Insights matching 07-recruitment-reports-dark.png ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-[8px] shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
            <Icon name="report" size={14} />
          </div>
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
            Key Insights
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Insight 1 */}
          <div className="p-[8px] rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Icon name="arrow-up" size={15} />
            </div>
            <div>
              <span className="block font-bold text-slate-900 dark:text-white text-xs">
                {kpis.applications} total applications tracked ({kpis.appTrend}).
              </span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Top source: {reportOverview?.kpis?.topSource?.name || 'No source data'} ({reportOverview?.kpis?.topSource?.conversionRate ?? 0}% conversion).
              </span>
            </div>
          </div>

          {/* Insight 2 */}
          <div className="p-[8px] rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
              <Icon name="clock" size={15} />
            </div>
            <div>
              <span className="block font-bold text-slate-900 dark:text-white text-xs">
                Average time to fill is {kpis.hasTimeToFill ? `${kpis.timeToFill} days` : 'unavailable'}.
              </span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {kpis.timeTrend}.
              </span>
            </div>
          </div>

          {/* Insight 3 */}
          <div className="p-[8px] rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Icon name="offer" size={15} />
            </div>
            <div>
              <span className="block font-bold text-slate-900 dark:text-white text-xs">
                Offer acceptance rate is {offerAcceptanceData[0]?.pct || 'unavailable'}.
              </span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {kpis.offers} offers extended with {kpis.hires} hires finalized.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : (
    <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Key indicators</h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{dateLabel}. Targets and current results are in the table.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportKpisCSV}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
              >
                <Icon name="download" size={13} />
                Download CSV
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={isExporting}
                className="inline-flex min-h-8 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer"
              >
                Excel
              </button>
              <button
                type="button"
                onClick={handleExportPDF}
                className="inline-flex min-h-8 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer"
              >
                Print
              </button>
            </div>
          </div>
          {/* ── Detailed Scorecard Table matching exact user fields (No Weights) ── */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-[8px] shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  KPI details
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Definition, target, and current result for each indicator.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold">
                    <th className="p-3.5">Position</th>
                    <th className="p-3.5">KPI Name</th>
                    <th className="p-3.5 min-w-[280px]">Definition</th>
                    <th className="p-3.5 text-center">Current Value</th>
                    <th className="p-3.5 text-center">Target</th>
                    <th className="p-3.5 min-w-[140px]">Achievement</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 min-w-[200px]">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activeRecruitmentKpis.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                        {isLoadingReport ? 'Loading measured indicators…' : 'No KPI can be calculated from recorded data in this period.'}
                      </td>
                    </tr>
                  ) : activeRecruitmentKpis.map((item) => {
                    const isExceeded = item.status === 'Exceeded';
                    const isOnTarget = item.status === 'On Target';
                    const statusClass = isExceeded
                      ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                      : isOnTarget
                      ? 'bg-blue-50 text-blue-900 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                      : 'bg-amber-50 text-amber-950 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                        <td className="p-3.5 font-bold text-slate-700 dark:text-slate-300">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-extrabold uppercase text-slate-600 dark:text-slate-400">
                            {item.position}
                          </span>
                        </td>
                        <td className="p-3.5 font-extrabold text-slate-900 dark:text-white">
                          {item.name}
                        </td>
                        <td className="p-3.5 text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
                          {item.definition}
                        </td>
                        <td className="p-3.5 text-center font-black text-slate-900 dark:text-white text-sm">
                          {item.formattedValue}
                        </td>
                        <td className="p-3.5 text-center font-semibold text-slate-600 dark:text-slate-400">
                          {item.formattedTarget}
                        </td>
                        <td className="p-3.5">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                              <span>{item.achievementRate}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isExceeded ? 'bg-emerald-500' : isOnTarget ? 'bg-blue-600' : 'bg-amber-500'
                                }`}
                                style={{ width: `${Math.min(100, item.achievementRate)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black inline-block ${statusClass}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-500 dark:text-slate-400 text-[11px]">
                          {item.notes || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Active Export Modal ── */}
      <Modal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title="Export report"
        maxWidthClass="max-w-lg"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-500 dark:text-slate-400">
            Download this period as Excel, CSV, or a print view.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExporting}
              className="p-3.5 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 font-bold flex flex-col items-center gap-2 cursor-pointer transition shadow-2xs group"
            >
              <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 flex items-center justify-center group-hover:scale-110 transition">
                <Icon name="file-text" size={20} />
              </div>
              <span className="text-slate-900 dark:text-white text-[11px]">Excel (.xlsx)</span>
              <span className="text-[10px] text-slate-600 dark:text-slate-400 font-normal">Spreadsheet</span>
            </button>

            <button
              type="button"
              onClick={handleExportKpisCSV}
              className="p-3.5 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 font-bold flex flex-col items-center gap-2 cursor-pointer transition shadow-2xs group"
            >
              <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition">
                <Icon name="award" size={20} />
              </div>
              <span className="text-slate-900 dark:text-white text-[11px]">KPI CSV</span>
              <span className="text-[10px] text-slate-600 dark:text-slate-400 font-normal">{activeRecruitmentKpis.length} measured indicators</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="p-3.5 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-blue-50/50 dark:hover:bg-blue-950/30 font-bold flex flex-col items-center gap-2 cursor-pointer transition shadow-2xs group"
            >
              <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center group-hover:scale-110 transition">
                <Icon name="download" size={20} />
              </div>
              <span className="text-slate-900 dark:text-white text-[11px]">Overview CSV</span>
              <span className="text-[10px] text-slate-600 dark:text-slate-400 font-normal">Summary</span>
            </button>

            <button
              type="button"
              onClick={handleExportPDF}
              className="p-3.5 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-purple-50/50 dark:hover:bg-purple-950/30 font-bold flex flex-col items-center gap-2 cursor-pointer transition shadow-2xs group"
            >
              <div className="w-9 h-9 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center group-hover:scale-110 transition">
                <Icon name="file-text" size={20} />
              </div>
              <span className="text-slate-900 dark:text-white text-[11px]">PDF / Print</span>
              <span className="text-[10px] text-slate-600 dark:text-slate-400 font-normal">Print</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Active Date Preset Modal ── */}
      <Modal
        isOpen={isDateModalOpen}
        onClose={() => setIsDateModalOpen(false)}
        title="Period"
        maxWidthClass="max-w-sm"
      >
        <div className="space-y-2 text-xs">
          {[
            { id: '7d', label: 'Last 7 days', sub: 'Rolling 7 days' },
            { id: '30d', label: 'Last 30 days', sub: 'Rolling 30 days' },
            { id: 'quarter', label: 'Quarter to date', sub: 'Current quarter' },
            { id: 'ytd', label: 'Year to date', sub: 'Current year' },
          ].map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                setDateRangePreset(preset.id as typeof dateRangePreset);
                setIsDateModalOpen(false);
                showToast(`Reporting period updated to ${preset.label}`);
              }}
              className={`w-full text-left p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                dateRangePreset === preset.id
                  ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold'
                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium'
              }`}
            >
              <div>
                <span className="block text-xs font-bold">{preset.label}</span>
                <span className="block text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">{preset.sub}</span>
              </div>
              {dateRangePreset === preset.id && <Icon name="check" size={14} className="text-blue-600" />}
            </button>
          ))}
        </div>
      </Modal>

      {/* ── Active Department Breakdown Detail Modal ── */}
      <Modal
        isOpen={isDeptModalOpen}
        onClose={() => setIsDeptModalOpen(false)}
        title="Hiring Progress by Position"
        maxWidthClass="max-w-2xl"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-500 dark:text-slate-400">
            Approved headcount and confirmed joined hires by position.
          </p>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold">
                  <th className="p-3">Position</th>
                  <th className="p-3">Approved headcount</th>
                  <th className="p-3">Joined hires</th>
                  <th className="p-3">Fill rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {positionHiringData.map((position) => (
                  <tr key={position.name} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-3 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: position.color }} />
                      <span>{position.name}</span>
                    </td>
                    <td className="p-3 font-extrabold text-slate-800 dark:text-slate-200">{position.target}</td>
                    <td className="p-3 font-semibold text-blue-600 dark:text-blue-400">{position.joined}</td>
                    <td className="p-3 font-semibold text-slate-700 dark:text-slate-300">{position.fillRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsDeptModalOpen(false)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold cursor-pointer transition shadow-xs"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2 border border-slate-700 animate-fade-in">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

export default ReportsPage;
