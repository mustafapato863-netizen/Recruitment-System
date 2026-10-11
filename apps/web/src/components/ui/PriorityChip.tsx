import type { HTMLAttributes } from 'react';

export type PriorityLevel = 'high' | 'medium' | 'low';

interface PriorityChipProps extends HTMLAttributes<HTMLSpanElement> {
  level: PriorityLevel;
  label?: string;
}

const priorityClasses: Record<PriorityLevel, string> = {
  high: 'border-rf-danger/15 bg-rf-danger-soft text-rf-danger',
  medium: 'border-rf-warning/20 bg-rf-warning-soft text-rf-warning',
  low: 'border-rf-border-subtle bg-rf-surface-subtle text-rf-ink-muted',
};

export function PriorityChip({ level, label, className = '', ...props }: PriorityChipProps) {
  const displayLabel = label || `${level.charAt(0).toUpperCase() + level.slice(1)} priority`;
  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[9.5px] font-extrabold uppercase tracking-[0.07em]',
        priorityClasses[level],
        className,
      ].filter(Boolean).join(' ')}
      {...props}
    >
      {displayLabel}
    </span>
  );
}
