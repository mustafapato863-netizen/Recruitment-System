import { cn } from '@/lib/utils';
import { Icon } from '../Icon';

export interface SLAIndicatorProps {
  status: 'on_track' | 'at_risk' | 'breached' | 'completed';
  daysRemaining?: number;
  label?: string;
  className?: string;
}

export function SLAIndicator({ status, daysRemaining, label, className }: SLAIndicatorProps) {
  const config = {
    on_track: {
      bg: 'bg-rf-success-soft',
      text: 'text-rf-success-strong',
      border: 'border-rf-success/30',
      icon: 'check-circle' as const,
      defaultLabel: 'On Track',
    },
    at_risk: {
      bg: 'bg-rf-warning-soft',
      text: 'text-rf-warning-strong',
      border: 'border-rf-warning/30',
      icon: 'clock' as const,
      defaultLabel: 'At Risk',
    },
    breached: {
      bg: 'bg-rf-danger-soft',
      text: 'text-rf-danger-strong',
      border: 'border-rf-danger/30',
      icon: 'alert-triangle' as const,
      defaultLabel: 'SLA Breached',
    },
    completed: {
      bg: 'bg-rf-info-soft',
      text: 'text-rf-info-strong',
      border: 'border-rf-info/30',
      icon: 'check' as const,
      defaultLabel: 'Completed',
    },
  };

  const current = config[status] || config.on_track;
  const displayLabel = label || current.defaultLabel;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border',
        current.bg,
        current.text,
        current.border,
        className
      )}
    >
      <Icon name={current.icon} size={12} className="shrink-0" />
      <span>{displayLabel}</span>
      {typeof daysRemaining === 'number' && (
        <span className="opacity-80 font-normal">({daysRemaining}d)</span>
      )}
    </span>
  );
}
