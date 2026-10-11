import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type SectionHeadingLevel = 'h2' | 'h3' | 'h4';
export type SectionHeaderDensity = 'default' | 'compact';

interface SectionHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  as?: SectionHeadingLevel;
  headingId?: string;
  density?: SectionHeaderDensity;
  className?: string;
}

/** A compact, reusable heading for panels, tables, and form groups. */
export function SectionHeader({
  title,
  description,
  eyebrow,
  actions,
  as: Heading = 'h2',
  headingId,
  density = 'default',
  className,
}: SectionHeaderProps) {
  return (
    <header className={cn('rf-section-header', `rf-section-header--${density}`, className)}>
      <div className="rf-section-header__copy">
        {eyebrow && <span className="rf-section-header__eyebrow">{eyebrow}</span>}
        <Heading className="rf-section-header__title" id={headingId}>{title}</Heading>
        {description && <p className="rf-section-header__description">{description}</p>}
      </div>
      {actions && <div className="rf-section-header__actions">{actions}</div>}
    </header>
  );
}
