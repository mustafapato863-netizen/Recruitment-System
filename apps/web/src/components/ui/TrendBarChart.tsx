import { useState, type CSSProperties, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../Icon';

export interface TrendDataPoint {
  label: string;
  value: number;
}

export interface TrendBarChartProps {
  title?: string;
  subtitle?: string;
  dateRangeText?: string;
  badgeLabel?: string;
  tooltipLabel?: string;
  data?: TrendDataPoint[];
  goal?: number;
  target?: number;
  className?: string;
  style?: CSSProperties;
  range?: '6M' | 'YTD' | '1Y';
  onRangeChange?: (range: '6M' | 'YTD' | '1Y') => void;
}

export function TrendBarChart({
  title = 'Hiring trend',
  dateRangeText,
  data,
  tooltipLabel = 'hires',
  goal,
  target,
  className = '',
  style = {},
  range,
  onRangeChange,
}: TrendBarChartProps) {
  const effectiveGoal = target ?? goal;
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [internalRange, setInternalRange] = useState<'6M' | 'YTD' | '1Y'>('6M');
  const activeRange = range ?? internalRange;

  const handleRangeChange = (newRange: '6M' | 'YTD' | '1Y') => {
    setInternalRange(newRange);
    onRangeChange?.(newRange);
  };

  const chartData = useMemo(() => {
    const rawData = data ?? [];
    if (rawData.length === 0) return [];
    if (activeRange === '6M') return rawData.slice(-6);
    if (activeRange === '1Y') return rawData.slice(-12);
    return rawData;
  }, [data, activeRange]);

  const total = chartData.reduce((sum, item) => sum + item.value, 0);
  const average = chartData.length > 0 ? (total / chartData.length).toFixed(1) : '0.0';
  const goalProgress =
    effectiveGoal !== undefined && effectiveGoal > 0 && chartData.length > 0
      ? Math.min(100, Math.round((Number(average) / effectiveGoal) * 100))
      : 0;
  const yTicks = [10, 8, 6, 4, 2, 0];

  // Calculate 3-period moving average for the spline
  const maData = chartData.map((_item, i, arr) => {
    const start = Math.max(0, i - 2);
    const slice = arr.slice(start, i + 1);
    return slice.reduce((sum, d) => sum + d.value, 0) / slice.length;
  });

  const points = maData.map((val, i) => ({
    x: (i + 0.5) * (100 / Math.max(1, chartData.length)),
    y: Math.max(8, Math.min(92, 100 - (val / 10) * 100)),
  }));

  const controlPoint = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    const tension = 0.35;
    return {
      cp1x: p1.x + (p2.x - p1.x) * tension,
      cp1y: p1.y,
      cp2x: p2.x - (p2.x - p1.x) * tension,
      cp2y: p2.y,
    };
  };

  let splinePath = '';
  if (points.length > 0) {
    splinePath += `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1];
      const p2 = points[i];
      const cp = controlPoint(p1, p2);
      splinePath += ` C ${cp.cp1x} ${cp.cp1y}, ${cp.cp2x} ${cp.cp2y}, ${p2.x} ${p2.y}`;
    }
  }

  return (
    <div
      className={`rounded-2xl border border-rf-border-subtle bg-rf-surface p-5 shadow-xs flex flex-col justify-between h-full ${className}`}
      style={style}
    >
      {/* 1. Header with Title, Date Range and Range Segmented Control */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-rf-border-subtle mb-4">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h2 className="text-[15px] font-black tracking-tight text-rf-ink m-0">{title}</h2>
          {dateRangeText && (
            <span className="text-xs font-medium text-rf-ink-muted">{dateRangeText}</span>
          )}
        </div>

        <div className="flex items-center bg-rf-surface-subtle p-0.5 rounded-lg border border-rf-border-subtle shadow-2xs">
          {(['6M', 'YTD', '1Y'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => handleRangeChange(r)}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                activeRange === r
                  ? 'bg-rf-surface text-rf-ink shadow-2xs border border-rf-border-subtle'
                  : 'text-rf-ink-muted hover:text-rf-ink border-0 bg-transparent'
              }`}
              aria-pressed={activeRange === r}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Scorecard 3-Column Stats Row matching Image 2 */}
      <div className="grid grid-cols-3 gap-3 pt-1 pb-3.5 border-b border-rf-border-subtle">
        {/* TOTAL HIRES */}
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rf-ink-muted mb-0.5">
            Total hires
          </span>
          <span className="text-[16px] font-rf-heading font-black text-rf-ink leading-tight">
            {total}
          </span>
          <span className="text-[11px] font-bold text-rf-success mt-0.5">
            {chartData.length > 0 ? 'Selected range' : 'No persisted activity'}
          </span>
        </div>

        {/* AVG / MONTH */}
        <div className="flex flex-col pl-3 border-l border-rf-border-subtle">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rf-ink-muted mb-0.5">
            Avg / month
          </span>
          <span className="text-[16px] font-rf-heading font-black text-rf-ink leading-tight">
            {average}
          </span>
          <span className="text-[11px] font-medium text-rf-ink-muted mt-0.5">
            {chartData.length > 0 ? 'Current range' : 'No activity'}
          </span>
        </div>

        {/* GOAL LINE */}
        <div className="flex flex-col pl-3 border-l border-rf-border-subtle">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rf-ink-muted mb-0.5">
            Goal line
          </span>
          <span className="text-[16px] font-rf-heading font-black text-rf-ink leading-tight">
            {effectiveGoal ?? '—'}
          </span>
          <span className="text-[11px] font-bold text-rf-warning mt-0.5">
            {effectiveGoal && chartData.length > 0 ? `${goalProgress}% to goal` : 'No target configured'}
          </span>
        </div>
      </div>

      {/* 3. Legend Row */}
      <div className="flex items-center gap-5 pt-3 pb-1 text-xs font-medium text-rf-ink-muted">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rf-action inline-block shadow-2xs" />
          <span className="text-rf-ink">Hires</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-0.5 bg-rf-ink-muted inline-block rounded-full" />
          <span>3M moving average</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 border-t-2 border-dashed border-rf-warning inline-block" />
          <span>Goal</span>
        </div>
      </div>

      {/* 4. Chart Area with Y-Axis, Dashed Goal Line, Gradient Bars & Moving Average Spline */}
      <div className="relative flex h-52 w-full pt-2">
        {/* Y-Axis Scale */}
        <div className="flex flex-col justify-between text-[11px] font-medium text-rf-ink-muted pr-3 py-1 select-none shrink-0 w-6 text-right">
          {yTicks.map((tick, idx) => (
            <span key={idx} className="leading-none">
              {tick}
            </span>
          ))}
        </div>

        {/* Chart Area */}
        <div className="relative flex-1 h-full border-b border-rf-border-subtle">
          {/* Dotted horizontal grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            {yTicks.map((_tick, idx) => (
              <div key={idx} className="w-full border-b border-dashed border-rf-border-subtle" />
            ))}
          </div>

          {/* Goal Line (Dashed Orange Line at Y=6 out of 10) */}
          {effectiveGoal && (
            <div
              className="absolute left-0 right-0 border-b-2 border-dashed border-rf-warning z-10 pointer-events-none"
              style={{ bottom: `${(effectiveGoal / 10) * 100}%` }}
            />
          )}

          {/* SVG moving average line */}
          <div className="absolute inset-0 z-10 pointer-events-none">
            <svg
              className="w-full h-full overflow-visible"
              preserveAspectRatio="none"
              viewBox="0 0 100 100"
            >
              <path
                d={splinePath}
                fill="none"
                stroke="currentColor"
                className="text-rf-ink-muted"
                strokeWidth="2.5"
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* Gradient Vertical Bars matching Image 2 */}
          <div className="absolute inset-0 flex items-end justify-between px-3 gap-3 z-20">
            {chartData.map((item, idx) => {
              const height = (item.value / 10) * 100;
              const isHovered = hoveredIdx === idx;
              return (
                <div
                  key={idx}
                  className="group relative flex w-full flex-col items-center justify-end h-full cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  {/* Bar */}
                  <div
                    className="w-full max-w-[42px] rounded-t-lg bg-gradient-to-t from-rf-action to-rf-info transition-all duration-200 shadow-xs group-hover:brightness-115"
                    style={{
                      height: `${Math.max(height, 4)}%`,
                    }}
                  />

                  {/* Tooltip */}
                  {isHovered && (
                    <div className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-rf-ink px-2.5 py-1 text-xs font-bold text-rf-surface shadow-lg z-30 pointer-events-none">
                      {item.value} {tooltipLabel}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* X-Axis Month Labels */}
      <div className="flex w-full items-center justify-between pl-6 pr-3 pt-2 text-xs font-bold text-rf-ink-muted">
        {chartData.map((item, idx) => (
          <div key={idx} className="flex-1 text-center truncate">
            {item.label}
          </div>
        ))}
      </div>

      {/* 5. Footer Link */}
      <div className="flex justify-end items-center pt-3 mt-2 border-t border-rf-border-subtle">
        <Link
          to="/reports"
          className="text-xs font-bold text-rf-action hover:underline inline-flex items-center gap-1"
        >
          <span>View full report</span>
          <Icon name="chevron-right" size={13} />
        </Link>
      </div>
    </div>
  );
}

export default TrendBarChart;
