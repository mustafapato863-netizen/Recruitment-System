import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../Icon';
import { QuickGuideTrigger } from '../../quickguide';

interface PageFrameProps {
  eyebrow?: string;
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  showBack?: boolean;
  backTo?: string;
}

export function PageFrame({ eyebrow, title, description, actions, children, className = '', showBack = false, backTo }: PageFrameProps) {
  return (
    <div className={['page rf-page relative z-[1] mx-auto flex w-full max-w-[1720px] flex-col gap-4 px-4 py-5 sm:px-6 lg:px-7 lg:py-6', className].filter(Boolean).join(' ')}>
      <header className="rf-page-header flex flex-col items-stretch justify-between gap-3 border-b border-rf-border-subtle pb-4 md:flex-row md:items-start md:gap-6">
        <div className="min-w-0">
          {showBack && backTo && (
            <Link
              to={backTo}
              className="mb-3 inline-flex min-h-9 items-center gap-1.5 rounded-md text-xs font-semibold text-rf-action no-underline transition-colors hover:text-rf-action-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rf-action/30"
            >
              <Icon name="arrow-left" size={14} />
              Back
            </Link>
          )}
          {eyebrow && <div className="rf-page-eyebrow mb-1.5 text-xs font-bold uppercase tracking-[0.08em] text-rf-ink-muted">{eyebrow}</div>}
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="m-0 font-rf-heading text-[20px] font-bold leading-[1.16] tracking-[-0.03em] text-rf-ink sm:text-[22px]">{title}</h1>
            <QuickGuideTrigger />
          </div>
          {description && <p className="m-0 mt-1.5 max-w-[860px] text-xs font-medium leading-5 text-rf-ink-muted">{description}</p>}
        </div>
        {actions && <div className="rf-page-actions flex w-full flex-wrap items-center gap-2 md:w-auto md:shrink-0 md:justify-end">{actions}</div>}
      </header>
      {children}
    </div>
  );
}
