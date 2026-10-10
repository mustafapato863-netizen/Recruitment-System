import * as React from 'react';
import { CircleCheck, CircleX, Clock, Info, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const defaultIcons: Record<StatusTone, React.ComponentType<{ 'aria-hidden'?: boolean | 'true' }>> = {
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleX,
  info: Info,
  neutral: Clock,
};

export interface StatusChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone: StatusTone;
  /** Visible text is required: status is never colour alone. */
  label: string;
  icon?: React.ReactNode;
}

/** v2 StatusChip: icon + text + tint. Non-interactive (no hover/focus states). */
export function StatusChip({ tone, label, icon, className, ...rest }: StatusChipProps) {
  const DefaultIcon = defaultIcons[tone];
  return (
    <span className={cn('rf2-chip', `rf2-chip--${tone}`, className)} data-tone={tone} {...rest}>
      {icon ?? <DefaultIcon aria-hidden="true" />}
      <span>{label}</span>
    </span>
  );
}
