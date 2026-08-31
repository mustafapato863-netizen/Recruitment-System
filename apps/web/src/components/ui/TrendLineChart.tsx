import { useState, useId, type CSSProperties } from 'react';
import { Badge } from './Badge';

export interface DataPoint {
  label: string;
  value: number;
  secondaryValue?: number;
}

export interface TrendLineChartProps {
  title?: string;
  subtitle?: string;
  data: DataPoint[];
  color?: string;
  height?: number;
  badgeLabel?: string;
  badgeVariant?: 'success' | 'info' | 'warning' | 'danger' | 'neutral';
  unit?: string;
  className?: string;
  style?: CSSProperties;
}

export function TrendLineChart({
  title,
  subtitle,
  data,
  color = 'var(--color-action)',
  height = 200,
  badgeLabel,
  badgeVariant = 'success',
  unit = '',
  className = '',
  style = {},
}: TrendLineChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const gradientId = useId();

  if (!data || data.length < 2) return null;

  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const valRange = maxVal - minVal || 1;

  // Viewbox coordinates
  const svgWidth = 700;
  const svgHeight = height;
  const paddingX = 40;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = svgWidth - paddingX * 2;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const getCoord = (index: number, val: number) => {
    const x = paddingX + (index / (data.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - ((val - minVal) / valRange) * chartHeight;
    return { x, y };
  };

  const coords = data.map((d, i) => getCoord(i, d.value));

  // Build smooth bezier curve path
  const buildSmoothPath = (points: Array<{ x: number; y: number }>) => {
    if (points.length < 2) return '';
    let d = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX = (p0.x + p1.x) / 2;
      d += ` C ${cpX},${p0.y} ${cpX},${p1.y} ${p1.x},${p1.y}`;
    }
    return d;
  };

  const linePath = buildSmoothPath(coords);
  const areaPath = `${linePath} L ${coords[coords.length - 1].x},${paddingTop + chartHeight} L ${coords[0].x},${paddingTop + chartHeight} Z`;

  // Calculate stats
  const currentValue = data[data.length - 1]?.value;
  const prevValue = data[data.length - 2]?.value;
  const deltaPercent = prevValue ? (((currentValue - prevValue) / prevValue) * 100).toFixed(1) : '0';
  const isUp = parseFloat(deltaPercent) >= 0;

  const activePoint = hoverIndex !== null ? coords[hoverIndex] : null;
  const activeData = hoverIndex !== null ? data[hoverIndex] : null;

  return (
    <div className={`rounded-xl border border-rf-border-subtle bg-rf-surface p-5 shadow-[var(--shadow-card)] ${className}`} style={style}>
      {(title || subtitle || badgeLabel) && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div>
            {title && <h3 className="text-sm font-extrabold text-rf-ink m-0 tracking-tight">{title}</h3>}
            {subtitle && <p className="text-xs text-rf-ink-muted m-0 mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            {badgeLabel && <Badge variant={badgeVariant}>{badgeLabel}</Badge>}
            <span className={`text-[11px] font-bold ${isUp ? 'text-rf-success' : 'text-rf-danger'}`}>
              {isUp ? '↑' : '↓'} {Math.abs(parseFloat(deltaPercent))}% vs last period
            </span>
          </div>
        </div>
      )}

      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto overflow-visible select-none"
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.32} />
              <stop offset="100%" stopColor={color} stopOpacity={0.0} />
            </linearGradient>
          </defs>

          {/* Horizontal Grid lines */}
          {[0, 0.33, 0.66, 1].map((pct, i) => {
            const y = paddingTop + chartHeight * pct;
            const labelVal = Math.round(maxVal - pct * valRange);
            return (
              <g key={i} className="text-rf-ink-muted">
                <line
                  x1={paddingX}
                  y1={y}
                  x2={svgWidth - paddingX}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity={0.08}
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingX - 8}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="10"
                  fill="currentColor"
                  opacity={0.6}
                >
                  {labelVal}{unit}
                </text>
              </g>
            );
          })}

          {/* Area Fill */}
          <path d={areaPath} fill={`url(#${gradientId})`} />

          {/* Line Stroke */}
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* X Axis Labels & Interactive columns */}
          {coords.map((pt, i) => (
            <g key={i}>
              <text
                x={pt.x}
                y={svgHeight - 8}
                textAnchor="middle"
                fontSize="11"
                fontWeight={hoverIndex === i ? 'bold' : 'normal'}
                fill={hoverIndex === i ? 'var(--color-ink)' : 'var(--color-ink-muted)'}
              >
                {data[i].label}
              </text>
              {/* Invisible touch/hover column */}
              <rect
                x={pt.x - chartWidth / (data.length * 2)}
                y={0}
                width={chartWidth / data.length}
                height={svgHeight}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoverIndex(i)}
              />
            </g>
          ))}

          {/* Active Data Point & Crosshair line */}
          {activePoint && (
            <g className="pointer-events-none">
              <line
                x1={activePoint.x}
                y1={paddingTop}
                x2={activePoint.x}
                y2={paddingTop + chartHeight}
                stroke={color}
                strokeWidth={1.5}
                strokeDasharray="3 3"
                opacity={0.6}
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r={6}
                fill="var(--color-surface)"
                stroke={color}
                strokeWidth={3}
              />
            </g>
          )}
        </svg>

        {/* Floating Tooltip */}
        {activePoint && activeData && (
          <div
            className="absolute pointer-events-none bg-rf-ink text-rf-canvas text-xs px-2.5 py-1.5 rounded-lg shadow-lg -translate-x-1/2 -translate-y-full mb-2 z-10 transition-all font-semibold whitespace-nowrap"
            style={{
              left: `${(activePoint.x / svgWidth) * 100}%`,
              top: `${(activePoint.y / svgHeight) * 100}%`,
            }}
          >
            <div className="text-[10px] text-rf-ink-muted opacity-80">{activeData.label}</div>
            <div className="font-extrabold text-sm">{activeData.value}{unit}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TrendLineChart;
