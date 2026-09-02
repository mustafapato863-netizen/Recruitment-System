import type { ReactNode } from 'react';
import { Icon, type IconName } from '../Icon';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  tone?: ToastTone;
  title: string;
  message?: string;
  icon?: ReactNode;
}

const toneIcon: Record<ToastTone, IconName> = {
  success: 'check-circle',
  error: 'alert-triangle',
  info: 'document',
  warning: 'alert-triangle',
};

export function Toast({ tone = 'info', title, message, icon }: ToastProps) {
  return (
    <div className={`toast toast-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span aria-hidden="true">{icon || <Icon name={toneIcon[tone]} size={16} />}</span>
      <div>
        <b>{title}</b>
        {message && <span>{message}</span>}
      </div>
    </div>
  );
}

interface AlertBannerProps {
  children: ReactNode;
  tone?: ToastTone;
}

export function AlertBanner({ children, tone = 'warning' }: AlertBannerProps) {
  return (
    <div className={`alert-banner alert-banner-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span aria-hidden="true"><Icon name={toneIcon[tone]} size={15} /></span>
      <span>{children}</span>
    </div>
  );
}
