import * as React from 'react';
import { Inbox, ShieldAlert } from 'lucide-react';

interface StateProps {
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  headingLevel?: 2 | 3;
}

/** Empty state: nothing to show yet, with an optional next action. */
export function EmptyStateV2({ title, body, action, icon, headingLevel = 2 }: StateProps) {
  const H = `h${headingLevel}` as 'h2' | 'h3';
  return (
    <section className="rf2-state rf2-state--empty" aria-label={title}>
      <span className="rf2-state__icon" aria-hidden="true">{icon ?? <Inbox />}</span>
      <H className="rf2-state__title">{title}</H>
      {body ? <p className="rf2-state__body">{body}</p> : null}
      {action ? <div className="rf2-state__action">{action}</div> : null}
    </section>
  );
}

/**
 * Forbidden state for a 403 from the API (another owner's file). Pages a seat
 * cannot use are absent from navigation; this is only for direct links.
 */
export function ForbiddenStateV2({ title = 'You do not have access to this', body, action, headingLevel = 2 }: Partial<StateProps>) {
  const H = `h${headingLevel}` as 'h2' | 'h3';
  return (
    <section className="rf2-state rf2-state--forbidden" role="alert" aria-label={title}>
      <span className="rf2-state__icon" aria-hidden="true"><ShieldAlert /></span>
      <H className="rf2-state__title">{title}</H>
      <p className="rf2-state__body">{body ?? 'This file belongs to another owner. Ask your manager if it should be reassigned to you.'}</p>
      {action ? <div className="rf2-state__action">{action}</div> : null}
    </section>
  );
}

/** Skeleton: preserves layout while loading; announced via aria-busy + label. */
export function SkeletonV2({ lines = 3, label = 'Loading…' }: { lines?: number; label?: string }) {
  return (
    <div className="rf2-skeleton" role="status" aria-busy="true" aria-label={label}>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="rf2-skeleton__line" style={{ width: `${100 - i * 15}%` }} />
      ))}
    </div>
  );
}
