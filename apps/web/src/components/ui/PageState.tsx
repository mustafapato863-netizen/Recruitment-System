import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from './Alert';
import { Button } from './Button';
import { Card } from './Card';
import { Spinner } from '../Spinner';
import { Icon, type IconName } from '../Icon';

interface PageStateProps {
  kind: 'loading' | 'empty' | 'error' | 'forbidden' | 'unauthorized' | 'not-found' | 'unavailable' | 'retry' | 'stale' | 'partial-success';
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  children?: ReactNode;
}

export function PageState({
  kind,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  children,
}: PageStateProps) {
  if (kind === 'loading') {
    return (
      <Card className="flex min-h-36 flex-col items-center justify-center gap-2 px-5 py-8 text-center" aria-live="polite">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-rf-info/15 bg-rf-info-soft shadow-[var(--shadow-xs)]">
          <Spinner size={22} aria-label={title} />
        </div>
        <strong className="mt-1 text-xs font-bold tracking-tight text-rf-ink">{title}</strong>
        {description && <span className="max-w-[460px] text-[11px] font-medium leading-relaxed text-rf-ink-muted">{description}</span>}
      </Card>
    );
  }

  if (kind === 'empty') {
    return (
      <Card className="flex min-h-36 flex-col items-center justify-center gap-2 px-5 py-8 text-center">
        <PageStateIcon name="inbox" tone="info" />
        <strong className="mt-1 text-xs font-bold text-rf-ink">{title}</strong>
        {description && <span className="max-w-[460px] text-[11px] font-medium leading-relaxed text-rf-ink-muted">{description}</span>}
        {children}
        {actionLabel && (
          actionHref ? (
            <Button className="mt-2" variant="secondary" size="sm" asChild>
              <Link to={actionHref}>{actionLabel}</Link>
            </Button>
          ) : onAction ? (
            <Button className="mt-2" variant="secondary" size="sm" onClick={onAction}>{actionLabel}</Button>
          ) : null
        )}
      </Card>
    );
  }

  if (kind === 'unauthorized') {
    return (
      <Card className="flex min-h-48 flex-col items-center justify-center gap-2.5 px-6 py-10 text-center">
        <PageStateIcon name="lock" tone="info" />
        <strong className="mt-1 text-sm font-bold text-rf-ink">{title}</strong>
        <span className="max-w-[440px] text-xs font-medium leading-relaxed text-rf-ink-muted">
          {description || 'Your active session has expired or requires authentication. Please sign in to resume your workflow.'}
        </span>
        {children}
        <div className="flex items-center gap-2 mt-3">
          <Button variant="primary" size="sm" asChild>
            <Link to={actionHref || '/login'}>{actionLabel || 'Sign in again'}</Link>
          </Button>
          {(onSecondaryAction || onAction) && (
            <Button variant="ghost" size="sm" onClick={onSecondaryAction || onAction}>
              {secondaryActionLabel || 'Reload page'}
            </Button>
          )}
        </div>
      </Card>
    );
  }

  if (kind === 'forbidden') {
    return (
      <Card className="flex min-h-48 flex-col items-center justify-center gap-2.5 border-rf-warning/25 px-6 py-10 text-center">
        <PageStateIcon name="lock" tone="warning" />
        <strong className="mt-1 text-sm font-bold text-rf-ink">{title}</strong>
        <span className="max-w-[440px] text-xs font-medium leading-relaxed text-rf-ink-muted">
          {description || 'You do not have the required permissions to access this surface. Please contact your organization administrator.'}
        </span>
        {children}
        <div className="flex items-center gap-2 mt-3">
          {actionHref ? (
            <Button variant="secondary" size="sm" asChild>
              <Link to={actionHref}>{actionLabel || 'Go to dashboard'}</Link>
            </Button>
          ) : onAction ? (
            <Button variant="secondary" size="sm" onClick={onAction}>{actionLabel || 'Go back'}</Button>
          ) : null}
        </div>
      </Card>
    );
  }

  if (kind === 'not-found') {
    return (
      <Card className="flex min-h-40 flex-col items-center justify-center gap-2 px-5 py-8 text-center">
        <PageStateIcon name="search" tone="neutral" />
        <strong className="mt-1 text-sm font-bold text-rf-ink">{title}</strong>
        <span className="max-w-[420px] text-xs font-medium leading-relaxed text-rf-ink-muted">
          {description || 'The requested record or resource does not exist or has been moved.'}
        </span>
        {children}
        {actionLabel && (
          actionHref ? (
            <Button className="mt-2" variant="secondary" size="sm" asChild>
              <Link to={actionHref}>{actionLabel}</Link>
            </Button>
          ) : onAction ? (
            <Button className="mt-2" variant="secondary" size="sm" onClick={onAction}>{actionLabel}</Button>
          ) : null
        )}
      </Card>
    );
  }

  if (kind === 'unavailable' || kind === 'stale') {
    return (
      <Card className="flex min-h-36 flex-col items-center justify-center gap-2 px-5 py-8 text-center">
        <PageStateIcon name={kind === 'stale' ? 'clock' : 'info'} tone="warning" />
        <strong className="mt-1 text-sm font-bold text-rf-ink">{title}</strong>
        <span className="max-w-[440px] text-xs font-medium leading-relaxed text-rf-ink-muted">
          {description || (kind === 'stale' ? 'This view may be out of date. Refresh before making a decision.' : 'This workspace section is temporarily unavailable.')}
        </span>
        {children}
        {(onAction || actionHref) && (
          actionHref ? (
            <Button className="mt-2" variant="secondary" size="sm" asChild><Link to={actionHref}>{actionLabel || 'Refresh'}</Link></Button>
          ) : (
            <Button className="mt-2" variant="secondary" size="sm" onClick={onAction}>{actionLabel || 'Refresh'}</Button>
          )
        )}
      </Card>
    );
  }

  if (kind === 'partial-success') {
    return (
      <Alert tone="warning" title={title} action={onAction && actionLabel ? <Button variant="secondary" size="sm" onClick={onAction}>{actionLabel}</Button> : undefined}>
        <span>{description || 'Some records were loaded successfully, but part of this view needs attention.'}</span>
        {children}
      </Alert>
    );
  }

  // Kind === 'error'
  return (
    <Alert
      tone="danger"
      title={title}
      action={
        onAction && actionLabel ? (
          <Button variant="secondary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : undefined
      }
    >
      <span>{description}</span>
      {children}
    </Alert>
  );
}

function PageStateIcon({ name, tone }: { name: IconName; tone: 'info' | 'neutral' | 'warning' | 'danger' }) {
  const toneClasses = {
    info: 'border border-rf-info/15 bg-rf-info-soft text-rf-info',
    neutral: 'border border-rf-border-subtle bg-rf-surface-subtle text-rf-ink-muted',
    warning: 'border border-rf-warning/20 bg-rf-warning-soft text-rf-warning',
    danger: 'border border-rf-danger/15 bg-rf-danger-soft text-rf-danger',
  } as const;

  return (
    <span className={['grid h-11 w-11 place-items-center rounded-2xl shadow-2xs', toneClasses[tone]].join(' ')} aria-hidden="true">
      <Icon name={name} size={18} />
    </span>
  );
}
