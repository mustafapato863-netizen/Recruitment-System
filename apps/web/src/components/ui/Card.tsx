import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  interactive?: boolean;
}

export function Card({ children, className = '', interactive = false, ...props }: CardProps) {
  return <div {...props} className={['ui-card', interactive ? 'is-interactive' : '', className].filter(Boolean).join(' ')}>{children}</div>;
}
