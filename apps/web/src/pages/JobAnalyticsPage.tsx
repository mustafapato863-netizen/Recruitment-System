import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import './PageEnhancementsV2.css';

export function JobAnalyticsPage() {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState('31 Aug – 6 Sep 2026');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleExportCsv = () => {
    const csvContent = 'Metric,Value,Period\nTotal Applications,48,31 Aug - 6 Sep 2026\nShortlisted,24,31 Aug - 6 Sep 2026\nInterviews,12,31 Aug - 6 Sep 2026\nOffers,3,31 Aug - 6 Sep 2026\nHires,1,31 Aug - 6 Sep 2026';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `job-analytics-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('✓ Job analytics metrics exported to CSV!');
  };

  return (
    <div className="flex w-full flex-col p-4 sm:p-6 lg:p-7 max-w-[1720px] mx-auto space-y-6">
      {/* ── Breadcrumb & Page Header matching 15-job-analytics.png ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-slate-400">
            <span>Application Analysis</span>
            <span className="mx-2">/</span>
            <span className="text-slate-900 dark:text-white font-bold">Job Analytics</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Senior Frontend Engineer
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Open
            </span>
          </div>

          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
            <span>Engineering</span>
            <span>&bull;</span>
            <span>Cairo, Egypt</span>
            <span>&bull;</span>
            <span>Full-time</span>
            <span>&bull;</span>
            <span>Opened 28 Aug 2026</span>
            <span>&bull;</span>
            <span>Recruiter: Sarah Ahmed</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate('/reports')}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition shadow-xs cursor-pointer"
          >
            <Icon name="arrow-left" size={13} />
            <span>Back to reports</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition shadow-xs cursor-pointer"
          >
            <Icon name="download" size={13} className="text-slate-400" />
            <span>Export</span>
          </button>

          <button
            type="button"
            onClick={() => showToast('Analytics options: Refresh metrics, Schedule automated weekly report')}
            className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 hover:text-slate-900 shadow-xs cursor-pointer"
            title="More options"
          >
            <Icon name="more-horizontal" size={15} />
          </button>

          <button
            type="button"
            onClick={() => setDateRange((prev) => prev.includes('31 Aug') ? 'This Month' : prev === 'This Month' ? 'Last 90 Days' : '31 Aug – 6 Sep 2026')}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 shadow-xs cursor-pointer"
          >
            <Icon name="calendar" size={13} className="text-slate-400" />
            <div>
              <span className="block font-bold leading-none">{dateRange}</span>
              <span className="block text-[10px] text-slate-400 mt-0.5">vs 24 Aug – 30 Aug 2026</span>
            </div>
            <Icon name="chevron-down" size={12} className="text-slate-400" />
          </button>
        </div>
      </div>

      {/* ── 6 KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Card 1: Applications */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Icon name="file-text" size={15} />
            </div>
            <span className="text-[11px] font-semibold text-slate-400">Applications</span>
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900 dark:text-white block">48</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] font-bold text-emerald-600">+18% vs 7d</span>
              <svg className="w-10 h-3 text-blue-500 stroke-current fill-none" viewBox="0 0 50 15">
                <path d="M0 12 Q 20 5, 50 2" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Card 2: Qualified */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Icon name="users" size={15} />
            </div>
            <span className="text-[11px] font-semibold text-slate-400">Qualified</span>
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900 dark:text-white block">26</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] font-bold text-emerald-600">+12% vs 7d</span>
              <svg className="w-10 h-3 text-emerald-500 stroke-current fill-none" viewBox="0 0 50 15">
                <path d="M0 10 Q 25 3, 50 2" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Card 3: Interviews */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Icon name="calendar" size={15} />
            </div>
            <span className="text-[11px] font-semibold text-slate-400">Interviews</span>
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900 dark:text-white block">15</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] font-bold text-emerald-600">+25% vs 7d</span>
              <svg className="w-10 h-3 text-purple-500 stroke-current fill-none" viewBox="0 0 50 15">
                <path d="M0 13 Q 25 6, 50 2" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Card 4: Offers */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <Icon name="offer" size={15} />
            </div>
            <span className="text-[11px] font-semibold text-slate-400">Offers</span>
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900 dark:text-white block">3</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] font-bold text-emerald-600">+50% vs 7d</span>
              <svg className="w-10 h-3 text-orange-500 stroke-current fill-none" viewBox="0 0 50 15">
                <path d="M0 12 Q 25 8, 50 1" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Card 5: Hires */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Icon name="user-check" size={15} />
            </div>
            <span className="text-[11px] font-semibold text-slate-400">Hires</span>
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900 dark:text-white block">1</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] font-bold text-emerald-600">+100% vs 7d</span>
              <svg className="w-10 h-3 text-emerald-500 stroke-current fill-none" viewBox="0 0 50 15">
                <path d="M0 14 Q 25 6, 50 2" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Card 6: Time to Hire */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Icon name="clock" size={15} />
            </div>
            <span className="text-[11px] font-semibold text-slate-400">Time to Hire</span>
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-slate-900 dark:text-white">28</span>
              <span className="text-[10px] text-slate-400">days</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] font-bold text-emerald-600">-3 days vs 7d</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 2: Applications by Stage (Funnel), Stage Aging, Source ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Funnel (4 cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between space-y-4">
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
            Applications by Stage
          </h2>

          <div className="space-y-2 text-xs py-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">New</span>
              <span className="font-black text-slate-900 dark:text-white">48 (100%)</span>
            </div>
            <div className="w-full bg-blue-500 h-2.5 rounded-full" />

            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-500 font-medium">Screening</span>
              <span className="font-black text-slate-900 dark:text-white">26 (54%)</span>
            </div>
            <div className="w-[75%] bg-emerald-500 h-2.5 rounded-full" />

            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-500 font-medium">Technical Interview</span>
              <span className="font-black text-slate-900 dark:text-white">15 (31%)</span>
            </div>
            <div className="w-[50%] bg-purple-500 h-2.5 rounded-full" />

            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-500 font-medium">Hiring Manager</span>
              <span className="font-black text-slate-900 dark:text-white">8 (17%)</span>
            </div>
            <div className="w-[30%] bg-orange-500 h-2.5 rounded-full" />

            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-500 font-medium">Offer</span>
              <span className="font-black text-slate-900 dark:text-white">3 (6%)</span>
            </div>
            <div className="w-[15%] bg-rose-500 h-2.5 rounded-full" />

            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-500 font-medium">Hired</span>
              <span className="font-black text-slate-900 dark:text-white">1 (2%)</span>
            </div>
            <div className="w-[8%] bg-teal-500 h-2.5 rounded-full" />
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 text-xs">
            <span className="text-slate-500">Overall conversion rate</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700">2.1%</span>
          </div>
        </div>

        {/* Stage Aging (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Stage Aging
              </h2>
              <span className="text-[10px] text-slate-400">ⓘ</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> 0-3d</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> 4-7d</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> 8-14d</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> 15+d</span>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="font-semibold text-slate-600">New</span>
                <span className="text-slate-400">18 &bull; 14 &bull; 9 &bull; 7</span>
              </div>
              <div className="w-full h-3 rounded-full overflow-hidden flex">
                <div className="bg-emerald-500 h-full" style={{ width: '40%' }} />
                <div className="bg-amber-400 h-full" style={{ width: '30%' }} />
                <div className="bg-orange-500 h-full" style={{ width: '20%' }} />
                <div className="bg-rose-500 h-full" style={{ width: '10%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="font-semibold text-slate-600">Screening</span>
                <span className="text-slate-400">10 &bull; 8 &bull; 5 &bull; 3</span>
              </div>
              <div className="w-full h-3 rounded-full overflow-hidden flex">
                <div className="bg-emerald-500 h-full" style={{ width: '45%' }} />
                <div className="bg-amber-400 h-full" style={{ width: '30%' }} />
                <div className="bg-orange-500 h-full" style={{ width: '15%' }} />
                <div className="bg-rose-500 h-full" style={{ width: '10%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="font-semibold text-slate-600">Technical Interview</span>
                <span className="text-slate-400">6 &bull; 4 &bull; 3 &bull; 2</span>
              </div>
              <div className="w-full h-3 rounded-full overflow-hidden flex">
                <div className="bg-emerald-500 h-full" style={{ width: '40%' }} />
                <div className="bg-amber-400 h-full" style={{ width: '30%' }} />
                <div className="bg-orange-500 h-full" style={{ width: '20%' }} />
                <div className="bg-rose-500 h-full" style={{ width: '10%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="font-semibold text-slate-600">Hiring Manager</span>
                <span className="text-slate-400">3 &bull; 2 &bull; 2 &bull; 1</span>
              </div>
              <div className="w-full h-3 rounded-full overflow-hidden flex">
                <div className="bg-emerald-500 h-full" style={{ width: '40%' }} />
                <div className="bg-amber-400 h-full" style={{ width: '25%' }} />
                <div className="bg-orange-500 h-full" style={{ width: '25%' }} />
                <div className="bg-rose-500 h-full" style={{ width: '10%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="font-semibold text-slate-600">Offer</span>
                <span className="text-slate-400">1 &bull; 1 &bull; 1 &bull; 0</span>
              </div>
              <div className="w-full h-3 rounded-full overflow-hidden flex">
                <div className="bg-emerald-500 h-full" style={{ width: '33%' }} />
                <div className="bg-amber-400 h-full" style={{ width: '33%' }} />
                <div className="bg-orange-500 h-full" style={{ width: '34%' }} />
              </div>
            </div>
          </div>

          <div className="flex justify-between text-[10.5px] font-medium text-slate-400 pt-2 border-t border-slate-100">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Applications by Source (3 cols) */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between space-y-3">
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
            Applications by Source
          </h2>

          <div className="flex flex-col items-center justify-center py-1">
            <div className="relative w-28 h-28 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="14" fill="transparent" stroke="#3b82f6" strokeWidth="4.5" strokeDasharray="38 62" strokeDashoffset="0" />
                <circle cx="18" cy="18" r="14" fill="transparent" stroke="#10b981" strokeWidth="4.5" strokeDasharray="25 75" strokeDashoffset="-38" />
                <circle cx="18" cy="18" r="14" fill="transparent" stroke="#a855f7" strokeWidth="4.5" strokeDasharray="19 81" strokeDashoffset="-63" />
                <circle cx="18" cy="18" r="14" fill="transparent" stroke="#f97316" strokeWidth="4.5" strokeDasharray="13 87" strokeDashoffset="-82" />
                <circle cx="18" cy="18" r="14" fill="transparent" stroke="#64748b" strokeWidth="4.5" strokeDasharray="6 94" strokeDashoffset="-95" />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-xl font-black text-slate-900 dark:text-white leading-none">48</span>
                <span className="text-[9.5px] text-slate-400 font-semibold mt-0.5">Total</span>
              </div>
            </div>

            <div className="space-y-1 text-xs w-full mt-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-600 text-[11px]"><span className="w-2 h-2 rounded-full bg-blue-500" /> Careers Site</span>
                <span className="font-bold text-slate-900 text-[11px]">18 (38%)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-600 text-[11px]"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Referral</span>
                <span className="font-bold text-slate-900 text-[11px]">12 (25%)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-600 text-[11px]"><span className="w-2 h-2 rounded-full bg-purple-500" /> LinkedIn</span>
                <span className="font-bold text-slate-900 text-[11px]">9 (19%)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-600 text-[11px]"><span className="w-2 h-2 rounded-full bg-orange-500" /> Job Boards</span>
                <span className="font-bold text-slate-900 text-[11px]">6 (13%)</span>
              </div>
            </div>
          </div>

          <div className="text-right text-[11px] text-blue-600 font-bold border-t border-slate-100 pt-2">
            Top source: Careers Site (38%)
          </div>
        </div>
      </div>

      {/* ── Row 3: Conversion Rates, Turnaround Time, Bottlenecks ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Conversion Rates (4 cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Conversion Rates
            </h2>
            <span className="text-[10px] text-slate-400">ⓘ</span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div>
              <div className="flex justify-between mb-1 font-semibold">
                <span className="text-slate-600">New &rarr; Screening</span>
                <span className="font-bold text-slate-900">54% &bull; 26 / 48</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full rounded-full" style={{ width: '54%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1 font-semibold">
                <span className="text-slate-600">Screening &rarr; Tech Interview</span>
                <span className="font-bold text-slate-900">58% &bull; 15 / 26</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full rounded-full" style={{ width: '58%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1 font-semibold">
                <span className="text-slate-600">Tech Interview &rarr; HM</span>
                <span className="font-bold text-slate-900">53% &bull; 8 / 15</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full rounded-full" style={{ width: '53%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1 font-semibold">
                <span className="text-slate-600">HM &rarr; Offer</span>
                <span className="font-bold text-slate-900">38% &bull; 3 / 8</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full rounded-full" style={{ width: '38%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1 font-semibold">
                <span className="text-slate-600">Offer &rarr; Hired</span>
                <span className="font-bold text-slate-900">33% &bull; 1 / 3</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full rounded-full" style={{ width: '33%' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Turnaround Time (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Interviewer Turnaround Time
            </h2>
            <span className="text-[10px] text-slate-400 font-bold">Days &bull; 2.6d avg</span>
          </div>

          <div className="relative h-40 w-full flex items-end justify-between px-2 pt-4">
            <svg className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 350 110">
              <path
                d="M 10 30 L 65 45 L 120 50 L 175 75 L 230 65 L 285 70 L 340 55"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {[
                { x: 10, y: 30, val: '3.2' },
                { x: 65, y: 45, val: '2.8' },
                { x: 120, y: 50, val: '2.6' },
                { x: 175, y: 75, val: '2.1' },
                { x: 230, y: 65, val: '2.4' },
                { x: 285, y: 70, val: '2.3' },
                { x: 340, y: 55, val: '2.6' },
              ].map((pt, idx) => (
                <g key={idx}>
                  <circle cx={pt.x} cy={pt.y} r="3.5" fill="#3b82f6" stroke="#fff" strokeWidth="2" />
                  <text x={pt.x} y={pt.y - 7} textAnchor="middle" fill="#94a3b8" fontSize="9.5" fontWeight="bold">
                    {pt.val}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          <div className="flex justify-between text-[10px] text-slate-400 border-t border-slate-100 pt-2">
            <span>31 Aug</span>
            <span>1 Sep</span>
            <span>2 Sep</span>
            <span>3 Sep</span>
            <span>4 Sep</span>
            <span>5 Sep</span>
            <span>6 Sep</span>
          </div>
        </div>

        {/* Bottlenecks (3 cols) */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-3">
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white border-b border-slate-100 pb-2">
            Top Bottlenecks
          </h2>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 block">Screening</span>
                <span className="text-[10px] text-slate-400">11 items stuck</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700">42% &gt; 7d</span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 block">Technical Interview</span>
                <span className="text-[10px] text-slate-400">6 items stuck</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700">40%</span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 block">Hiring Manager</span>
                <span className="text-[10px] text-slate-400">3 items stuck</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">38%</span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 block">Offer</span>
                <span className="text-[10px] text-slate-400">1 item stuck</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">33%</span>
            </div>
          </div>

          <div className="text-right pt-1 border-t border-slate-100">
            <button
              type="button"
              onClick={() => showToast('Bottleneck breakdown: Technical Interview (4 candidates stuck), Offer Stage (1 candidate stuck)')}
              className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
            >
              View all bottlenecks
            </button>
          </div>
        </div>
      </div>

      {/* ── Row 4: Applicants Needing Action (7) ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-3">
        <h2 className="text-sm font-extrabold text-slate-900 dark:text-white border-b border-slate-100 pb-2">
          Applicants Needing Action (7)
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[11px] font-semibold text-slate-400 border-b border-slate-100 pb-2">
                <th className="pb-2">Applicant</th>
                <th className="pb-2">Stage</th>
                <th className="pb-2">Waiting on</th>
                <th className="pb-2">For</th>
                <th className="pb-2">Waiting since</th>
                <th className="pb-2">SLA</th>
                <th className="pb-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-2.5">
                  <span className="font-bold text-slate-900 block">Ahmed Mostafa</span>
                  <span className="text-[10px] text-slate-400">Frontend Developer</span>
                </td>
                <td className="py-2.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700">
                    Technical Interview
                  </span>
                </td>
                <td className="py-2.5">
                  <span className="font-semibold text-slate-700">Interview feedback</span>
                  <span className="block text-[10px] text-slate-400">Ali Hassan</span>
                </td>
                <td className="py-2.5 text-slate-500">5 days</td>
                <td className="py-2.5 text-slate-500">1 Sep 2026</td>
                <td className="py-2.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700">
                    Overdue
                  </span>
                </td>
                <td className="py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => showToast('✓ Interview feedback reminder sent to Ali Hassan!')}
                    className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Send reminder
                  </button>
                </td>
              </tr>

              <tr>
                <td className="py-2.5">
                  <span className="font-bold text-slate-900 block">Heba Mohamed</span>
                  <span className="text-[10px] text-slate-400">Frontend Developer</span>
                </td>
                <td className="py-2.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                    Screening
                  </span>
                </td>
                <td className="py-2.5">
                  <span className="font-semibold text-slate-700">Screening review</span>
                  <span className="block text-[10px] text-slate-400">Sarah Ahmed</span>
                </td>
                <td className="py-2.5 text-slate-500">4 days</td>
                <td className="py-2.5 text-slate-500">2 Sep 2026</td>
                <td className="py-2.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">
                    At risk
                  </span>
                </td>
                <td className="py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => navigate('/applications')}
                    className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Review
                  </button>
                </td>
              </tr>

              <tr>
                <td className="py-2.5">
                  <span className="font-bold text-slate-900 block">Yousef Ali</span>
                  <span className="text-[10px] text-slate-400">Frontend Developer</span>
                </td>
                <td className="py-2.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700">
                    Hiring Manager
                  </span>
                </td>
                <td className="py-2.5">
                  <span className="font-semibold text-slate-700">HM feedback</span>
                  <span className="block text-[10px] text-slate-400">Lina Hassan</span>
                </td>
                <td className="py-2.5 text-slate-500">3 days</td>
                <td className="py-2.5 text-slate-500">3 Sep 2026</td>
                <td className="py-2.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">
                    At risk
                  </span>
                </td>
                <td className="py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => showToast('✓ Hiring manager feedback reminder sent to Lina Hassan!')}
                    className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Send reminder
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="text-center pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => navigate('/applications')}
            className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
          >
            View all (7)
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2 border border-slate-700 animate-fade-in">
          <Icon name="check-circle" size={14} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

export default JobAnalyticsPage;
