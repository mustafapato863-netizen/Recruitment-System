import type { ReactNode } from 'react';
import { Sparkline } from './Sparkline';
import { BorderGlow } from './BorderGlow';

export type MetricTone = 'action' | 'info' | 'success' | 'warning' | 'danger' | 'neutral';
export type UrgencyTone = 'danger' | 'success' | 'warning' | 'info';

export interface MetricCardProps {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  tone?: MetricTone;
  featured?: boolean;
  sparkline?: number[];
  sparklineColor?: string;
  trend?: { value: string | number; isPositive?: boolean };
  urgencyText?: string;
  urgencyTone?: UrgencyTone;
  infoTooltip?: ReactNode;
}

const toneClasses: Record<MetricTone, string> = {
  action: 'bg-rf-action-soft text-rf-action ring-rf-action/10',
  info: 'bg-rf-info-soft text-rf-info ring-rf-info/10',
  success: 'bg-rf-success-soft text-rf-success ring-rf-success/10',
  warning: 'bg-rf-warning-soft text-rf-warning ring-rf-warning/10',
  danger: 'bg-rf-danger-soft text-rf-danger ring-rf-danger/10',
  neutral: 'bg-rf-surface-subtle text-rf-ink-muted ring-rf-border/30',
};

const toneSparkColors: Record<MetricTone, string> = {
  action: 'var(--color-action)', info: 'var(--color-info)', success: 'var(--color-success)',
  warning: 'var(--color-warning)', danger: 'var(--color-danger)', neutral: 'var(--color-ink-muted)',
};

const toneGlowColors: Record<MetricTone, string[]> = {
  action: ['var(--color-action)', 'var(--color-action-focus)', 'var(--color-info)'],
  info: ['var(--color-info)', 'var(--color-action)', 'var(--color-info-focus)'],
  success: ['var(--color-success)', 'var(--color-success-strong)', 'var(--color-success-soft)'],
  warning: ['var(--color-warning)', 'var(--color-warning-strong)', 'var(--color-warning-soft)'],
  danger: ['var(--color-danger)', 'var(--color-danger-strong)', 'var(--color-danger-soft)'],
  neutral: ['var(--color-ink-muted)', 'var(--color-border)', 'var(--color-surface-hover)'],
};

const urgencyStyles: Record<UrgencyTone, { text: string; bg: string; dot: string }> = {
  danger: {
    text: 'text-rf-danger',
    bg: 'bg-rf-danger-soft border-rf-danger/20',
    dot: 'bg-rf-danger',
  },
  success: {
    text: 'text-rf-success',
    bg: 'bg-rf-success-soft border-rf-success/20',
    dot: 'bg-rf-success',
  },
  warning: {
    text: 'text-rf-warning',
    bg: 'bg-rf-warning-soft border-rf-warning/20',
    dot: 'bg-rf-warning',
  },
  info: {
    text: 'text-rf-action',
    bg: 'bg-rf-action-soft border-rf-action/20',
    dot: 'bg-rf-action',
  },
};

function resolveUrgencyTone(text: string, explicitTone?: UrgencyTone): UrgencyTone {
  if (explicitTone) return explicitTone;
  const lower = text.toLowerCase();
  if (lower.includes('aging') || lower.includes('overdue') || lower.includes('critical') || lower.includes('drop')) {
    return 'danger';
  }
  if (lower.includes('pending') || lower.includes('action') || lower.includes('review') || lower.includes('below')) {
    return 'warning';
  }
  if (lower.includes('↑') || lower.includes('+') || lower.includes('goal') || lower.includes('growth') || lower.includes('new') || lower.includes('month') || lower.includes('target')) {
    return 'success';
  }
  return 'info';
}

export function MetricCard({
  label,
  value,
  detail,
  icon,
  action,
  tone = 'neutral',
  featured = false,
  sparkline,
  sparklineColor,
  trend,
  urgencyText,
  urgencyTone,
  infoTooltip,
}: MetricCardProps) {
  const trendClasses = trend?.isPositive === true
    ? 'text-rf-success-strong'
    : trend?.isPositive === false
      ? 'text-rf-danger-strong'
      : 'text-rf-ink-muted';

  const resolvedTone = urgencyText ? resolveUrgencyTone(urgencyText, urgencyTone) : 'info';
  const uStyle = urgencyStyles[resolvedTone];

  return (
    <BorderGlow
      borderRadius={10}
      edgeSensitivity={30}
      glowColor="217 91 60"
      colors={toneGlowColors[tone]}
      glowRadius={36}
      backgroundColor="var(--color-surface)"
      className="h-full shadow-[var(--shadow-2xs)] transition-shadow duration-150 hover:shadow-[var(--shadow-xs)] relative group flex flex-col"
    >
      <article className={[
        'flex min-h-[116px] flex-1 flex-col justify-between p-5 relative z-10 w-full',
        featured ? 'bg-rf-action-soft/5' : '',
      ].filter(Boolean).join(' ')}>
        {action && (
          <div className="absolute inset-0 z-20 pointer-events-none">
            <div className="absolute top-0 right-0 p-5 pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity flex justify-end text-[11px] font-medium text-rf-action hover:underline">
              {action}
            </div>
          </div>
        )}

        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1.5 min-w-0 flex-1">
            {urgencyText && (
              <span className={`text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${uStyle.bg} ${uStyle.text} w-fit shadow-2xs`}>
                <span className={`w-1.5 h-1.5 rounded-full ${uStyle.dot} animate-pulse shrink-0`} />
                <span>{urgencyText}</span>
              </span>
            )}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-bold uppercase tracking-wider text-rf-ink-muted truncate" title={typeof infoTooltip === 'string' ? infoTooltip : undefined}>{label}</span>
              {infoTooltip && (
                <div className="group/tooltip relative flex items-center">
                  <svg className="w-3.5 h-3.5 text-rf-ink-muted opacity-60 hover:opacity-100 cursor-help transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/tooltip:block w-48 p-2 bg-rf-ink text-rf-surface text-[11px] leading-tight font-medium rounded shadow-xl z-50 text-center pointer-events-none before:content-[''] before:absolute before:top-full before:left-1/2 before:-translate-x-1/2 before:border-4 before:border-transparent before:border-t-rf-ink">
                    {infoTooltip}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 transition-opacity group-hover:opacity-30">
            {icon && <div className={['grid h-8 w-8 place-items-center rounded-lg ring-1 shadow-2xs', toneClasses[tone]].join(' ')} aria-hidden="true">{icon}</div>}
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-end justify-between gap-2">
            <strong className="block font-rf-heading text-[22px] font-black leading-none tracking-[-0.03em] text-rf-ink tabular-nums">{value}</strong>
            {sparkline && sparkline.length > 1 && <div className="shrink-0 -mb-1"><Sparkline data={sparkline} color={sparklineColor ?? toneSparkColors[tone]} width={82} height={24} /></div>}
          </div>
          {(detail || trend) && <div className="mt-2 flex min-w-0 items-center justify-between gap-2">
            {detail && <span className="min-w-0 truncate text-[11px] font-medium text-rf-ink-muted">{detail}</span>}
            {trend && <span className={['shrink-0 text-[11px] font-bold', trendClasses].join(' ')}>{trend.isPositive === true ? '↑ ' : trend.isPositive === false ? '↓ ' : ''}{trend.value}</span>}
          </div>}
        </div>
      </article>
    </BorderGlow>
  );
}

export default MetricCard;
