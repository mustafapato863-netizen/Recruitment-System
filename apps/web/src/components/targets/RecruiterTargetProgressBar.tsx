import { useState, useEffect } from 'react';
import { Icon } from '../Icon';
import { Button } from '../ui/Button';

export interface RecruiterTargetData {
  period: 'Daily' | 'Monthly';
  calls: { actual: number; target: number };
  screenings: { actual: number; target: number };
  interviews: { actual: number; target: number };
  offers: { actual: number; target: number };
  branchName?: string;
  positionLevel?: string;
}

const DEFAULT_TARGETS: Record<'Daily' | 'Monthly', RecruiterTargetData> = {
  Daily: {
    period: 'Daily',
    calls: { actual: 8, target: 12 },
    screenings: { actual: 14, target: 15 },
    interviews: { actual: 3, target: 3 },
    offers: { actual: 1, target: 1 },
    branchName: 'All Branches',
  },
  Monthly: {
    period: 'Monthly',
    calls: { actual: 165, target: 200 },
    screenings: { actual: 120, target: 150 },
    interviews: { actual: 38, target: 40 },
    offers: { actual: 9, target: 10 },
    branchName: 'All Branches',
  },
};

interface RecruiterTargetProgressBarProps {
  onConfigureClick?: () => void;
  canConfigure?: boolean;
  className?: string;
}

export function RecruiterTargetProgressBar({
  onConfigureClick,
  canConfigure = false,
  className = '',
}: RecruiterTargetProgressBarProps) {
  const [period, setPeriod] = useState<'Daily' | 'Monthly'>('Daily');
  const [targets, setTargets] = useState<RecruiterTargetData>(() => {
    const saved = localStorage.getItem(`recruitflow_targets_${period}`);
    return saved ? JSON.parse(saved) : DEFAULT_TARGETS[period];
  });

  useEffect(() => {
    const saved = localStorage.getItem(`recruitflow_targets_${period}`);
    setTargets(saved ? JSON.parse(saved) : DEFAULT_TARGETS[period]);
  }, [period]);

  const metrics = [
    {
      id: 'calls',
      label: 'Calls Logged',
      icon: 'phone' as const,
      data: targets.calls,
      color: 'bg-emerald-500',
      textColor: 'text-rf-success-strong',
      badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
    },
    {
      id: 'screenings',
      label: 'CVs Screened',
      icon: 'file-text' as const,
      data: targets.screenings,
      color: 'bg-blue-500',
      textColor: 'text-rf-info-strong',
      badgeBg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800',
    },
    {
      id: 'interviews',
      label: 'Interviews Done',
      icon: 'calendar-clock' as const,
      data: targets.interviews,
      color: 'bg-purple-500',
      textColor: 'text-rf-purple',
      badgeBg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800',
    },
    {
      id: 'offers',
      label: 'Offers Extended',
      icon: 'offer' as const,
      data: targets.offers,
      color: 'bg-amber-500',
      textColor: 'text-amber-700 dark:text-amber-400',
      badgeBg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
    },
  ];

  const totalAttainment = Math.round(
    metrics.reduce((acc, m) => acc + (m.data.target > 0 ? (m.data.actual / m.data.target) * 100 : 100), 0) /
      metrics.length,
  );

  return (
    <div
      className={`rounded-2xl border border-rf-border bg-white dark:bg-rf-surface p-4 shadow-xs transition-all ${className}`}
      role="region"
      aria-label="Recruiter Activity Targets"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rf-border/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rf-primary/10 text-rf-primary font-bold">
            <Icon name="check-circle" size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="bg-rf-surface text-sm font-bold text-rf-ink dark:text-white">Activity & KPI Targets</h3>
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-rf-primary/10 text-rf-primary border border-rf-primary/20">
                {totalAttainment}% Overall Pace
              </span>
            </div>
            <p className="bg-rf-surface text-xs text-rf-ink-muted">
              {period} productivity benchmarks across assigned positions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Period Toggle */}
          <div className="flex items-center rounded-lg border border-rf-border bg-rf-surface-subtle p-0.5 text-xs font-medium">
            <button
              type="button"
              className={`rounded-md px-2.5 py-1 transition-all ${
                period === 'Daily'
                  ? 'bg-white dark:bg-rf-surface font-bold text-rf-primary shadow-xs'
                  : 'bg-rf-surface-subtle text-rf-ink-muted hover:text-rf-ink'
              }`}
              onClick={() => setPeriod('Daily')}
            >
              Daily
            </button>
            <button
              type="button"
              className={`rounded-md px-2.5 py-1 transition-all ${
                period === 'Monthly'
                  ? 'bg-white dark:bg-rf-surface font-bold text-rf-primary shadow-xs'
                  : 'bg-rf-surface-subtle text-rf-ink-muted hover:text-rf-ink'
              }`}
              onClick={() => setPeriod('Monthly')}
            >
              Monthly
            </button>
          </div>

          {canConfigure && onConfigureClick && (
            <Button variant="ghost" size="sm" onClick={onConfigureClick} title="Configure Targets">
              <Icon name="settings" size={14} />
              <span className="hidden sm:inline">Set Targets</span>
            </Button>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3 pt-3 sm:grid-cols-4">
        {metrics.map((metric) => {
          const pct = metric.data.target > 0 ? Math.min(100, Math.round((metric.data.actual / metric.data.target) * 100)) : 100;
          const isComplete = metric.data.actual >= metric.data.target;

          return (
            <div
              key={metric.id}
              className={`rounded-xl border p-3 transition-all ${metric.badgeBg}`}
            >
              <div className="flex items-center justify-between gap-1 text-xs">
                <span className="font-semibold text-rf-ink-muted flex items-center gap-1.5">
                  <Icon name={metric.icon} size={13} className={metric.textColor} />
                  {metric.label}
                </span>
                {isComplete && (
                  <span className="text-[10px] font-bold text-rf-success-strong">
                    🎯 Goal Met
                  </span>
                )}
              </div>

              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-xl font-bold tracking-tight text-rf-ink dark:text-white">
                  {metric.data.actual}{' '}
                  <span className="text-xs font-normal text-rf-ink-muted">/ {metric.data.target}</span>
                </span>
                <span className={`text-xs font-bold ${metric.textColor}`}>{pct}%</span>
              </div>

              {/* Progress Bar */}
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${metric.color}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
