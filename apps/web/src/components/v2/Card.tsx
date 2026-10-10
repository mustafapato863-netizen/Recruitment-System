import * as React from 'react';
import { cn } from '@/lib/utils';

type Tone = 'success' | 'warning' | 'danger';

interface CardBase {
  title?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  selected?: boolean;
  tone?: Tone;
  className?: string;
  children?: React.ReactNode;
}

export type CardV2Props =
  | (CardBase & { as?: 'section' } & Omit<React.HTMLAttributes<HTMLElement>, 'title'>)
  | (CardBase & { as: 'button' } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'title'>);

/**
 * v2 Card: flat, 1px divider border, radius 8, no shadow. Static cards are
 * <section>. Interactive cards are <button> and get hover, focus-visible,
 * pressed, selected (aria-pressed) and disabled states.
 */
export function CardV2(props: CardV2Props) {
  const { title, icon, actions, selected, tone, className, children, as = 'section', ...rest } = props as CardBase & { as?: 'section' | 'button' } & Record<string, unknown>;
  const head = title || actions ? (
    <div className="rf2-card__head">
      {icon ? <span aria-hidden="true" style={{ display: 'contents' }}>{icon}</span> : null}
      {title ? (as === 'button' ? <span className="rf2-card__title">{title}</span> : <h3 className="rf2-card__title">{title}</h3>) : null}
      {actions}
    </div>
  ) : null;
  const cls = cn('rf2-card', className);
  if (as === 'button') {
    return (
      <button type="button" className={cls} aria-pressed={selected === undefined ? undefined : selected} data-tone={tone} {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
        {head}
        {children}
      </button>
    );
  }
  return (
    <section className={cls} data-selected={selected || undefined} data-tone={tone} {...(rest as React.HTMLAttributes<HTMLElement>)}>
      {head}
      {children}
    </section>
  );
}
