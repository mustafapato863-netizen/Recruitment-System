import type { ReactNode } from 'react';
import { Icon, type IconName } from '../Icon';
import { cn } from '@/lib/utils';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

interface AlertProps {
  tone?: AlertTone;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  role?: 'alert' | 'status' | 'note';
  className?: string;
}

const toneIcons: Record<AlertTone, IconName> = {
  info: 'document',
  success: 'check-circle',
  warning: 'alert-triangle',
  danger: 'alert-triangle',
};

const toneClasses: Record<AlertTone, string> = {
  info: 'border-rf-info/15 bg-rf-info-soft/75 text-rf-info-strong',
  success: 'border-rf-success/15 bg-rf-success-soft/75 text-rf-success-strong',
  warning: 'border-rf-warning/20 bg-rf-warning-soft/80 text-rf-warning-strong',
  danger: 'border-rf-danger/15 bg-rf-danger-soft/80 text-rf-danger-strong',
};

export function Alert({ tone = 'info', title, children, action, role, className = '' }: AlertProps) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 rounded-2xl border px-4 py-3.5 text-[11.5px] leading-relaxed shadow-[var(--shadow-2xs)]',
        toneClasses[tone],
        className,
      )}
      role={role ?? (tone === 'danger' ? 'alert' : 'status')}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-rf-surface/65 ring-1 ring-current/10" aria-hidden="true">
          <Icon name={toneIcons[tone]} size={14} />
        </span>
        <div className="grid min-w-0 gap-0.5">
          {title && <strong className="text-[12px] font-extrabold">{title}</strong>}
          <span className="font-medium text-current">{children}</span>
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}
