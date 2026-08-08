import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
}

export function IconButton({ label, children, className = '', ...props }: IconButtonProps) {
  return (
    <button {...props} aria-label={label} className={['ui-icon-button', className].filter(Boolean).join(' ')} type={props.type ?? 'button'}>
      {children}
    </button>
  );
}
