import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
  tone?: 'neutral' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, children, className, tone = 'neutral', size = 'md', ...props }, ref) => (
    <button
      {...props}
      ref={ref}
      aria-label={label}
      className={cn('rf-icon-button', `rf-icon-button--${tone}`, `rf-icon-button--${size}`, className)}
      type={props.type ?? 'button'}
    >
      {children}
    </button>
  ),
);

IconButton.displayName = 'IconButton';
