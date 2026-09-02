import { useState, type CSSProperties } from 'react';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  title?: string;
  subtitle?: string;
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string | number;
  unit?: string;
  className?: string;
  style?: CSSProperties;
}

export function DonutChart({
  title,
  subtitle,
  segments,
  size = 180,
  strokeWidth = 24,
  centerLabel = 'Total',
  centerValue,
  unit = '',
  className = '',
  style = {},
}: DonutChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const total = segments.reduce((acc, cur) => acc + cur.value, 0) || 1;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativeAngle = 0;

  const displayValue = hoveredIdx !== null
    ? `${segments[hoveredIdx].value}${unit}`
    : centerValue !== undefined
      ? centerValue
      : total;

  const displayLabel = hoveredIdx !== null
    ? segments[hoveredIdx].label
    : centerLabel;

  return (
    <div className={`rounded-xl border border-rf-border-subtle bg-rf-surface p-5 shadow-[var(--shadow-card)] ${className}`} style={style}>
      {(title || subtitle) && (
        <div className="mb-4">
          {title && <h3 className="text-sm font-extrabold text-rf-ink m-0 tracking-tight">{title}</h3>}
          {subtitle && <p className="text-xs text-rf-ink-muted m-0 mt-0.5">{subtitle}</p>}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-4 justify-between">
        {/* SVG Donut */}
        <div className="relative shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
            {/* Background ring */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="var(--color-surface-subtle)"
              strokeWidth={strokeWidth}
            />

            {/* Colored Segment arcs */}
            {segments.map((seg, idx) => {
              const fraction = seg.value / total;
              const dashLength = fraction * circumference;
              const offset = -cumulativeAngle;
              cumulativeAngle += dashLength;
              const isHovered = hoveredIdx === idx;

              return (
                <circle
                  key={idx}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke={seg.color}
                  strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={`${dashLength} ${circumference}`}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                  className="transition-all duration-200 cursor-pointer origin-center"
                  style={{
                    opacity: hoveredIdx !== null && !isHovered ? 0.4 : 1,
                  }}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              );
            })}
          </svg>

          {/* Center Metric Label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rf-ink-muted truncate max-w-full">
              {displayLabel}
            </span>
            <span className="text-[18px] font-black text-rf-ink font-rf-heading leading-tight mt-0.5">
              {displayValue}
            </span>
          </div>
        </div>

        {/* Legend List */}
        <div className="flex-1 w-full flex flex-col gap-2.5">
          {segments.map((seg, idx) => {
            const percentage = ((seg.value / total) * 100).toFixed(1);
            const isHovered = hoveredIdx === idx;

            return (
              <div
                key={idx}
                className={`flex items-center justify-between p-2 rounded-lg transition-colors cursor-pointer ${
                  isHovered ? 'bg-rf-surface-subtle font-bold' : 'hover:bg-rf-surface-subtle/50'
                }`}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="text-xs text-rf-ink truncate font-medium">{seg.label}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold text-rf-ink">{seg.value}{unit}</span>
                  <span className="text-[11px] font-medium text-rf-ink-muted w-10 text-right">{percentage}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default DonutChart;
