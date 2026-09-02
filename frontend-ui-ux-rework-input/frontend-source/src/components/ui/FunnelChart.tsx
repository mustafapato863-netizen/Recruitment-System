import { type CSSProperties, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../Icon';

export interface FunnelStageData {
  name: string;
  count: number;
  icon?: IconName;
  description?: string;
}

export interface FunnelChartProps {
  title?: string;
  subtitle?: string;
  dateRangeText?: string;
  badgeLabel?: string;
  stages?: FunnelStageData[];
  bottleneckStage?: string;
  industryBenchmark?: string;
  className?: string;
  style?: CSSProperties;
}

const STAGE_CONFIG: Record<
  string,
  {
    gradient: string;
    iconBg: string;
    iconColor: string;
    icon: IconName;
    metricLabel?: string;
  }
> = {
  Applied: {
    gradient: 'from-rf-action to-rf-action-strong',
    iconBg: 'bg-rf-action-soft',
    iconColor: 'text-rf-action',
    icon: 'send',
    metricLabel: 'of funnel',
  },
  Screening: {
    gradient: 'from-rf-info to-rf-action',
    iconBg: 'bg-rf-info-soft',
    iconColor: 'text-rf-info',
    icon: 'users',
    metricLabel: 'convert',
  },
  Interview: {
    gradient: 'from-rf-purple to-rf-info',
    iconBg: 'bg-rf-purple-soft',
    iconColor: 'text-rf-purple',
    icon: 'calendar',
    metricLabel: 'convert',
  },
  Offer: {
    gradient: 'from-rf-danger to-rf-danger-strong',
    iconBg: 'bg-rf-danger-soft',
    iconColor: 'text-rf-danger',
    icon: 'document',
    metricLabel: 'convert',
  },
  'Pre-hire': {
    gradient: 'from-rf-warning to-rf-orange',
    iconBg: 'bg-rf-warning-soft',
    iconColor: 'text-rf-warning',
    icon: 'user-check',
    metricLabel: 'accepted',
  },
  'Pre-Hire': {
    gradient: 'from-rf-warning to-rf-orange',
    iconBg: 'bg-rf-warning-soft',
    iconColor: 'text-rf-warning',
    icon: 'user-check',
    metricLabel: 'accepted',
  },
  Joined: {
    gradient: 'from-rf-success to-rf-success-strong',
    iconBg: 'bg-rf-success-soft',
    iconColor: 'text-rf-success',
    icon: 'check-circle',
    metricLabel: 'start rate',
  },
};

export function FunnelChart({
  title = 'Recruitment funnel',
  dateRangeText,
  stages,
  bottleneckStage,
  industryBenchmark = '—',
  className = '',
  style = {},
}: FunnelChartProps) {
  const activeStages = useMemo(() => stages ?? [], [stages]);

  const maxCount = Math.max(...activeStages.map((s) => s.count), 1);
  const firstCount = activeStages[0]?.count || 0;
  const lastCount = activeStages[activeStages.length - 1]?.count || 0;
  const overallPercentage = firstCount > 0 ? ((lastCount / firstCount) * 100).toFixed(1) : '—';

  const detectedBottleneck = useMemo(() => {
    if (bottleneckStage) return bottleneckStage;
    let minRate = 100;
    let bottleneck = 'Offer';
    for (let i = 1; i < activeStages.length; i++) {
      const prev = activeStages[i - 1].count;
      const curr = activeStages[i].count;
      if (prev > 0) {
        const rate = (curr / prev) * 100;
        if (rate < minRate) {
          minRate = rate;
          bottleneck = activeStages[i].name;
        }
      }
    }
    return bottleneck;
  }, [activeStages, bottleneckStage]);

  if (activeStages.length === 0) {
    return (
      <div className={`rounded-2xl border border-rf-border-subtle bg-rf-surface p-5 shadow-xs ${className}`} style={style}>
        <div className="flex items-center justify-between gap-3 border-b border-rf-border-subtle pb-4">
          <div>
            <h2 className="m-0 text-[15px] font-black tracking-tight text-rf-ink">{title}</h2>
            {dateRangeText && <span className="text-xs font-medium text-rf-ink-muted">{dateRangeText}</span>}
          </div>
        </div>
        <div className="grid min-h-56 place-items-center py-8 text-center">
          <div>
            <p className="m-0 text-sm font-semibold text-rf-ink">No funnel data</p>
            <p className="m-0 mt-1 text-xs font-medium text-rf-ink-muted">No persisted application activity exists for this range.</p>
          </div>
        </div>
        <div className="flex justify-end border-t border-rf-border-subtle pt-3">
          <Link to="/applications" className="inline-flex items-center gap-1 text-xs font-bold text-rf-action hover:underline">
            View full pipeline <Icon name="chevron-right" size={13} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-rf-border-subtle bg-rf-surface p-5 shadow-xs flex flex-col justify-between h-full ${className}`}
      style={style}
    >
      {/* 1. Header with title, date range, and Bottleneck Badge */}
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-rf-border-subtle mb-4">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h2 className="text-[15px] font-black tracking-tight text-rf-ink m-0">{title}</h2>
          {dateRangeText && (
            <span className="text-xs font-medium text-rf-ink-muted">{dateRangeText}</span>
          )}
        </div>

        {detectedBottleneck && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold text-rf-warning bg-rf-warning-soft border border-rf-warning/30 shadow-2xs">
            <Icon name="alert-triangle" size={13} className="text-rf-warning" />
            <span>Bottleneck at {detectedBottleneck}</span>
          </div>
        )}
      </div>

      {/* 2. Stages List */}
      <div className="flex flex-col gap-2.5">
        {activeStages.map((stage, idx) => {
          const isFirst = idx === 0;
          const prevStage = isFirst ? null : activeStages[idx - 1];
          const cfg = STAGE_CONFIG[stage.name] || {
            gradient: 'from-rf-action to-rf-action-strong',
            iconBg: 'bg-rf-action-soft',
            iconColor: 'text-rf-action',
            icon: 'circle' as IconName,
            metricLabel: 'convert',
          };

          const widthPercent = Math.max(
            Math.round((stage.count / maxCount) * 100),
            stage.count > 0 ? 10 : 4
          );

          const convRate =
            prevStage && prevStage.count > 0
              ? Math.round((stage.count / prevStage.count) * 100)
              : stage.count > 0
                ? 100
                : 0;

          const dropOff = prevStage ? Math.max(0, prevStage.count - stage.count) : 0;
          const isBottleneck = stage.name.toLowerCase() === detectedBottleneck.toLowerCase();

          return (
            <div
              key={idx}
              className={`flex items-center w-full gap-3 px-3 py-2 rounded-xl transition-all relative ${
                isBottleneck
                  ? 'bg-rf-danger-soft/60 border border-rf-danger/30 shadow-2xs pl-3.5 before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:bg-rf-danger before:rounded-r'
                  : 'hover:bg-rf-surface-subtle/70'
              }`}
            >
              {/* Icon and Name */}
              <div className="flex items-center gap-2.5 w-[110px] shrink-0">
                <div
                  className={`w-7 h-7 rounded-full ${cfg.iconBg} ${cfg.iconColor} flex items-center justify-center shadow-2xs shrink-0`}
                >
                  <Icon name={cfg.icon} size={14} />
                </div>
                <span className="text-xs font-bold text-rf-ink truncate">{stage.name}</span>
              </div>

              {/* Big Bold Count */}
              <div className="w-10 shrink-0 text-sm font-black text-rf-ink tabular-nums">
                {stage.count.toLocaleString()}
              </div>

              {/* Thick Gradient Progress Bar */}
              <div className="flex-1 h-6 flex items-center">
                <div
                  className={`h-full bg-gradient-to-r ${cfg.gradient} rounded-lg transition-all duration-500 ease-out shadow-xs`}
                  style={{ width: `${widthPercent}%` }}
                />
              </div>

              {/* Right Stats Column */}
              <div className="w-24 shrink-0 text-right flex flex-col justify-center leading-tight">
                {isFirst ? (
                  <>
                    <span className="text-xs font-bold text-rf-ink">100% of funnel</span>
                    <span className="text-[10.5px] font-medium text-rf-ink-muted">{stage.count} new</span>
                  </>
                ) : (
                  <>
                    <span className="text-xs font-bold text-rf-ink">
                      {convRate}% {cfg.metricLabel ?? 'convert'}
                    </span>
                    {dropOff > 0 && (
                      <span className="text-[10.5px] font-bold text-rf-danger">
                        -{dropOff} drop-off
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Footer with 3 distinct widgets/cards matching Image 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 mt-4 border-t border-rf-border-subtle items-center">
        {/* Widget 1: Overall conversion */}
        <div className="rounded-xl border border-rf-border-subtle bg-rf-surface-subtle p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rf-ink-muted">
              Overall conversion
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xs font-bold text-rf-ink">Applied → Hired</span>
            <span className="text-base font-black text-rf-ink">{overallPercentage}%</span>
          </div>
        </div>

        {/* Widget 2: Industry benchmark */}
        <div className="rounded-xl border border-rf-border-subtle bg-rf-surface-subtle p-3 flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rf-ink-muted">
            Industry benchmark
          </span>
          <div className="mt-1">
            <span className="text-base font-black text-rf-ink">{industryBenchmark}</span>
          </div>
        </div>

        {/* Widget 3: View full pipeline Button */}
        <Link
          to="/applications"
          className="rounded-xl border border-rf-border-subtle bg-rf-surface hover:bg-rf-surface-subtle p-3 shadow-2xs flex items-center justify-center gap-2 text-xs font-bold text-rf-ink no-underline transition-all hover:border-rf-border h-full"
        >
          <span>View full pipeline</span>
          <Icon name="chevron-right" size={13} />
        </Link>
      </div>
    </div>
  );
}

export default FunnelChart;
