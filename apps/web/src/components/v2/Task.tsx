import * as React from 'react';
import { cn } from '@/lib/utils';
import './task.css';

/** v2 TaskSection: a titled card with a count and a list of TaskRows. */
export function TaskSection({ title, count, tone = 'default', children, emptyText }: {
  title: string; count: number; tone?: 'default' | 'danger'; children?: React.ReactNode; emptyText?: string;
}) {
  const id = React.useId();
  const rows = React.Children.toArray(children);
  return (
    <section className="rf2-task-section" aria-labelledby={id} data-tone={tone}>
      <header className="rf2-task-section__head">
        <h3 id={id} className="rf2-task-section__title">{title}</h3>
        <span className="rf2-task-section__count" aria-label={`${count} ${count === 1 ? 'task' : 'tasks'}`}>{count}</span>
      </header>
      {rows.length > 0 ? (
        <ul className="rf2-task-section__list">{rows.map((row, i) => <li key={i}>{row}</li>)}</ul>
      ) : (
        <p className="rf2-task-section__empty">{emptyText ?? 'Nothing here.'}</p>
      )}
    </section>
  );
}

export interface TaskRowProps {
  icon: React.ReactNode;
  iconTone?: 'warning' | 'info' | 'neutral' | 'danger';
  title: React.ReactNode;
  meta: React.ReactNode;
  chip?: React.ReactNode;
  /** SLA / due indicator. Omit when the reminder worker is stale. */
  due?: React.ReactNode;
  dueTone?: 'danger' | 'default';
  action?: React.ReactNode;
  className?: string;
}

/** v2 TaskRow: icon, title + one meta line, chip, due/SLA, and ONE action (Roadmap §7). */
export function TaskRow({ icon, iconTone = 'info', title, meta, chip, due, dueTone = 'default', action, className }: TaskRowProps) {
  return (
    <div className={cn('rf2-task-row', className)}>
      <span className="rf2-task-row__icon" data-tone={iconTone} aria-hidden="true">{icon}</span>
      <div className="rf2-task-row__main">
        <p className="rf2-task-row__title">{title}</p>
        <p className="rf2-task-row__meta">{meta}</p>
      </div>
      <div className="rf2-task-row__chip">{chip}</div>
      <div className="rf2-task-row__due" data-tone={dueTone}>{due}</div>
      <div className="rf2-task-row__action">{action}</div>
    </div>
  );
}
