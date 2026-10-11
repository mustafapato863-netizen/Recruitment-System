import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface DetailSummaryItem {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
}

interface DetailSummaryProps {
  items: DetailSummaryItem[];
  title?: ReactNode;
  description?: ReactNode;
  columns?: 1 | 2 | 3;
  className?: string;
}

/** Structured fact-list pattern for identity, ownership, and workflow facts. */
export function DetailSummary({ items, title, description, columns = 2, className }: DetailSummaryProps) {
  const titleId = useId();
  const content = (
    <ul className={cn('rf-detail-summary__list', `rf-detail-summary__list--${columns}`)}>
      {items.map((item, index) => (
        <li className="rf-detail-summary__item" key={index}>
          {item.icon && <span className="rf-detail-summary__icon" aria-hidden="true">{item.icon}</span>}
          <div className="min-w-0">
            <span className="rf-detail-summary__label">{item.label}</span>
            <span className="rf-detail-summary__value">{item.value}</span>
            {item.hint && <span className="rf-detail-summary__hint">{item.hint}</span>}
          </div>
        </li>
      ))}
    </ul>
  );

  if (!title && !description) return <div className={cn('rf-detail-summary', className)}>{content}</div>;

  return (
    <section className={cn('rf-detail-summary', className)} aria-labelledby={title ? titleId : undefined}>
      <div className="rf-detail-summary__header">
        {title && <h2 id={titleId}>{title}</h2>}
        {description && <p>{description}</p>}
      </div>
      {content}
    </section>
  );
}
