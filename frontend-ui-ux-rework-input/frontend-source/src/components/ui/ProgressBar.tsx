import { cn } from '@/lib/utils';

export type ProgressTone = 'action' | 'success' | 'warning' | 'danger' | 'neutral';

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  description?: string;
  tone?: ProgressTone;
  showValue?: boolean;
  className?: string;
}

/** Accessible progress indicator for readiness, completion, and SLA context. */
export function ProgressBar({
  value,
  max = 100,
  label,
  description,
  tone = 'action',
  showValue = true,
  className,
}: ProgressBarProps) {
  const safeMax = max > 0 ? max : 100;
  const safeValue = Math.min(Math.max(0, value), safeMax);
  const percentage = Math.round((safeValue / safeMax) * 100);
  const progressLabel = label ?? 'Progress';

  return (
    <div className={cn('rf-progress', className)}>
      {(label || description || showValue) && (
        <div className="rf-progress__meta">
          <div>
            {label && <strong>{label}</strong>}
            {description && <span>{description}</span>}
          </div>
          {showValue && <output aria-label={`${progressLabel}: ${percentage}%`}>{percentage}%</output>}
        </div>
      )}
      <div
        className="rf-progress__track"
        role="progressbar"
        aria-label={progressLabel}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={safeValue}
      >
        <span className={cn('rf-progress__value', `rf-progress__value--${tone}`)} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
