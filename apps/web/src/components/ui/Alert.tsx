import type { ReactNode } from 'react';
import { Icon, type IconName } from '../Icon';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

interface AlertProps {
  tone?: AlertTone;
  title?: string;
  children: ReactNode;
  role?: 'alert' | 'status' | 'note';
  className?: string;
}

const toneIcons: Record<AlertTone, IconName> = {
  info: 'document',
  success: 'check-circle',
  warning: 'alert-triangle',
  danger: 'alert-triangle',
};

export function Alert({ tone = 'info', title, children, role, className = '' }: AlertProps) {
  return (
    <div className={['ui-alert', `ui-alert--${tone}`, className].filter(Boolean).join(' ')} role={role ?? (tone === 'danger' ? 'alert' : 'status')}>
      <span className="ui-alert__icon" aria-hidden="true"><Icon name={toneIcons[tone]} size={16} /></span>
      <div className="ui-alert__content">
        {title && <strong>{title}</strong>}
        <span>{children}</span>
      </div>
    </div>
  );
}
