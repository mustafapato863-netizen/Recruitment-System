import type { ReactNode } from 'react';

export type MetricTone = 'action' | 'info' | 'success' | 'warning' | 'danger' | 'neutral';

interface MetricCardProps {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  tone?: MetricTone;
  featured?: boolean;
}

export function MetricCard({ label, value, detail, icon, tone = 'neutral', featured = false }: MetricCardProps) {
  return (
    <article className={['ui-metric-card', `ui-metric-card--${tone}`, featured ? 'is-featured' : ''].filter(Boolean).join(' ')}>
      <div className="ui-metric-card__top">
        <span className="ui-metric-card__label">{label}</span>
        {icon && <span className="ui-metric-card__icon" aria-hidden="true">{icon}</span>}
      </div>
      <strong className="ui-metric-card__value">{value}</strong>
      {detail && <span className="ui-metric-card__detail">{detail}</span>}
    </article>
  );
}

