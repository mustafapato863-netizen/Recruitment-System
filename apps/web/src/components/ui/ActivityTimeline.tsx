import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Avatar } from './Avatar';

export type ActivityTone = 'action' | 'success' | 'warning' | 'danger' | 'neutral';

export interface ActivityTimelineItem {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  timestamp: ReactNode;
  actor?: ReactNode;
  actorInitials?: string;
  icon?: ReactNode;
  tone?: ActivityTone;
  meta?: ReactNode;
}

interface ActivityTimelineProps {
  items: ActivityTimelineItem[];
  label?: string;
  emptyState?: ReactNode;
  className?: string;
}

/** Operational audit timeline with semantic order and optional actor context. */
export function ActivityTimeline({ items, label = 'Activity timeline', emptyState, className }: ActivityTimelineProps) {
  if (items.length === 0 && emptyState) return <>{emptyState}</>;

  return (
    <ol className={cn('rf-activity-timeline', className)} aria-label={label}>
      {items.map((item) => (
        <li className="rf-activity-timeline__item" key={item.id}>
          <span className={cn('rf-activity-timeline__marker', `rf-activity-timeline__marker--${item.tone ?? 'neutral'}`)} aria-hidden="true">
            {item.icon}
          </span>
          <article className="rf-activity-timeline__content">
            <div className="rf-activity-timeline__topline">
              <strong>{item.title}</strong>
              <time dateTime={String(item.timestamp)}>{item.timestamp}</time>
            </div>
            {item.description && <p>{item.description}</p>}
            {(item.actor || item.meta) && (
              <div className="rf-activity-timeline__meta">
                {item.actorInitials && <Avatar initials={item.actorInitials} size="sm" aria-hidden="true" />}
                {item.actor && <span>{item.actor}</span>}
                {item.meta && <span>{item.meta}</span>}
              </div>
            )}
          </article>
        </li>
      ))}
    </ol>
  );
}
