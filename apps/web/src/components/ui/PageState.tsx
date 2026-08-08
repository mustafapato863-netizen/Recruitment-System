import type { ReactNode } from 'react';
import { Alert, type AlertTone } from './Alert';
import { Button } from './Button';
import { Card } from './Card';
import { Spinner } from '../Spinner';

interface PageStateProps {
  kind: 'loading' | 'empty' | 'error';
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
}

export function PageState({ kind, title, description, actionLabel, onAction, children }: PageStateProps) {
  if (kind === 'loading') {
    return (
      <Card className="ui-page-state" aria-live="polite">
        <Spinner size={28} aria-label={title} />
        <strong>{title}</strong>
        {description && <span>{description}</span>}
      </Card>
    );
  }

  if (kind === 'empty') {
    return (
      <Card className="ui-page-state ui-page-state--empty">
        <span className="ui-page-state__symbol" aria-hidden="true">○</span>
        <strong>{title}</strong>
        {description && <span>{description}</span>}
        {children}
        {actionLabel && onAction && <Button variant="secondary" size="sm" onClick={onAction}>{actionLabel}</Button>}
      </Card>
    );
  }

  const tone: AlertTone = 'danger';
  return (
    <Alert tone={tone} title={title}>
      <span>{description}</span>
      {actionLabel && onAction && <Button className="ui-page-state__action" variant="danger" size="sm" onClick={onAction}>{actionLabel}</Button>}
    </Alert>
  );
}

