import type { ReactNode } from 'react';

export interface DashboardSectionProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}

export function DashboardSection({
  title,
  description,
  action,
  children,
  className = '',
  ariaLabel,
}: DashboardSectionProps) {
  return (
    <section
      className={[
        'rounded-2xl border border-rf-border-subtle bg-rf-surface p-5 shadow-xs flex flex-col justify-between transition-all duration-200 hover:border-rf-border',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={ariaLabel ?? title}
    >
      <header className="flex items-center justify-between pb-3 border-b border-rf-border-subtle mb-4">
        <div className="min-w-0">
          <h2 className="text-xs font-bold text-rf-ink m-0 uppercase tracking-wider">{title}</h2>
          {description && <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className="flex-1 flex flex-col">{children}</div>
    </section>
  );
}

export default DashboardSection;
