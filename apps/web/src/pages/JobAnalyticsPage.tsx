import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';

export function JobAnalyticsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState('Last 30 Days');

  const funnelData = [
    { stage: '1. Applications Received', count: 134, percent: '100%', drop: '-' },
    { stage: '2. Screening Passed', count: 48, percent: '35.8%', drop: '-64.2%' },
    { stage: '3. Technical Interview', count: 18, percent: '13.4%', drop: '-62.5%' },
    { stage: '4. Hiring Manager Panel', count: 8, percent: '5.9%', drop: '-55.5%' },
    { stage: '5. Offer Extended', count: 3, percent: '2.2%', drop: '-62.5%' },
    { stage: '6. Offer Accepted', count: 1, percent: '0.75%', drop: '-66.7%' },
  ];

  const sourceData = [
    { source: 'SGH Careers Portal', applicants: 58, qualified: 24, hires: 2, share: '43%' },
    { source: 'LinkedIn Sponsored', applicants: 45, qualified: 16, hires: 1, share: '34%' },
    { source: 'Employee Referrals', applicants: 22, qualified: 12, hires: 1, share: '16%' },
    { source: 'Direct Inbound / Other', applicants: 9, qualified: 2, hires: 0, share: '7%' },
  ];

  return (
    <div className="w-full max-w-[1720px] mx-auto p-4 sm:p-6 lg:p-7 space-y-6">
      {/* ── Top Back Button ── */}
      <div>
        <button
          type="button"
          onClick={() => navigate(id ? `/vacancies/${id}` : '/vacancies')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-rf-action hover:underline transition cursor-pointer"
        >
          &larr; Back to Job Overview
        </button>
      </div>

      {/* ── Page Header (Panel 15) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-rf-border-subtle">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-rf-ink tracking-tight">
            Job Analytics — Senior Frontend Engineer
          </h1>
          <p className="text-xs text-rf-ink-muted mt-1 font-medium">
            Performance metrics, funnel conversion, and sourcing channel ROI for this specific role.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-rf-success-soft text-rf-success-strong border border-rf-success/30">
            • Position Open
          </span>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="h-9 px-3 text-xs bg-rf-surface border border-rf-border-subtle rounded-xl text-rf-ink font-semibold focus:outline-none focus:border-rf-action cursor-pointer shadow-2xs"
          >
            <option>Last 30 Days</option>
            <option>Last 60 Days</option>
            <option>All Time</option>
          </select>
        </div>
      </div>

      {/* ── 4 Top KPI Cards (Panel 15) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-rf-surface rounded-2xl border border-rf-border-subtle p-5 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-rf-ink-muted block">Total Job Views</span>
            <span className="text-2xl font-extrabold text-rf-ink block tabular-nums">1,420</span>
            <span className="text-[11px] font-bold text-rf-action block">78% via LinkedIn & Careers</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rf-action-soft text-rf-action flex items-center justify-center">
            <Icon name="eye" size={20} />
          </div>
        </div>

        <div className="bg-rf-surface rounded-2xl border border-rf-border-subtle p-5 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-rf-ink-muted block">Application Rate</span>
            <span className="text-2xl font-extrabold text-rf-ink block tabular-nums">9.4%</span>
            <span className="text-[11px] font-bold text-rf-success-strong block">134 total applications</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rf-success-soft text-rf-success-strong flex items-center justify-center">
            <Icon name="file-text" size={20} />
          </div>
        </div>

        <div className="bg-rf-surface rounded-2xl border border-rf-border-subtle p-5 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-rf-ink-muted block">Days Open</span>
            <span className="text-2xl font-extrabold text-rf-ink block tabular-nums">18 Days</span>
            <span className="text-[11px] font-bold text-rf-success-strong block">Target SLA: 30 days</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rf-warning-soft text-rf-warning-strong flex items-center justify-center">
            <Icon name="clock" size={20} />
          </div>
        </div>

        <div className="bg-rf-surface rounded-2xl border border-rf-border-subtle p-5 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-rf-ink-muted block">Cost per Hire</span>
            <span className="text-2xl font-extrabold text-rf-ink block tabular-nums">EGP 4,200</span>
            <span className="text-[11px] font-bold text-rf-success-strong block">-15% vs dept average</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rf-action-soft text-rf-action flex items-center justify-center">
            <Icon name="offer" size={20} />
          </div>
        </div>
      </div>

      {/* ── 2-Column Split: Funnel Progression + Source Breakdown (Panel 15) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Funnel Conversion (7 cols) */}
        <div className="lg:col-span-7 bg-rf-surface rounded-2xl border border-rf-border-subtle p-5 shadow-2xs space-y-4">
          <h2 className="text-base font-extrabold text-rf-ink tracking-tight border-b border-rf-border-subtle pb-3">
            Hiring Funnel Progression & Conversion
          </h2>

          <div className="space-y-3 pt-1">
            {funnelData.map((f, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-rf-surface-subtle border border-rf-border-subtle space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-rf-ink">{f.stage}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-extrabold text-rf-ink">{f.count} candidates</span>
                    <span className="font-bold text-rf-action">{f.percent}</span>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="h-2 w-full bg-rf-border-subtle rounded-full overflow-hidden">
                  <div
                    className="h-full bg-rf-action rounded-full"
                    style={{ width: f.percent }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Sourcing Channels (5 cols) */}
        <div className="lg:col-span-5 bg-rf-surface rounded-2xl border border-rf-border-subtle p-5 shadow-2xs space-y-4">
          <h2 className="text-base font-extrabold text-rf-ink tracking-tight border-b border-rf-border-subtle pb-3">
            Sourcing Channel Performance
          </h2>

          <div className="space-y-3">
            {sourceData.map((s, idx) => (
              <div key={idx} className="p-3.5 rounded-xl bg-rf-surface-subtle border border-rf-border-subtle space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-rf-ink">{s.source}</span>
                  <span className="font-bold text-rf-action">{s.share} of total</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-rf-ink-muted">
                  <span>{s.applicants} applicants</span>
                  <span>{s.qualified} qualified</span>
                  <span className="font-bold text-rf-success-strong">{s.hires} hired</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default JobAnalyticsPage;
