import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  interactive?: boolean;
}

export function Card({ children, className = '', interactive = false, ...props }: CardProps) {
  return (
    <div
      {...props}
      className={[
        'rounded-[11px] border border-rf-border bg-rf-surface p-4 shadow-[var(--shadow-xs)]',
        'transition-[border-color,box-shadow,background-color,transform] duration-150 ease-[var(--ease-standard)]',
        interactive ? 'hover:border-rf-border-strong hover:bg-rf-surface-elevated hover:shadow-[var(--shadow-sm)]' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
}
