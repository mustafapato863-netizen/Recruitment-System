import type { ReactNode } from 'react';

interface PageFrameProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function PageFrame({ eyebrow, title, description, actions, children, className = '' }: PageFrameProps) {
  return (
    <div className={['ui-page', 'page-container', className].filter(Boolean).join(' ')}>
      <header className="ui-page__header page-header">
        <div className="ui-page__intro">
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h1 className="page-title">{title}</h1>
          {description && <p className="page-subtitle">{description}</p>}
        </div>
        {actions && <div className="ui-page__actions page-actions">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

