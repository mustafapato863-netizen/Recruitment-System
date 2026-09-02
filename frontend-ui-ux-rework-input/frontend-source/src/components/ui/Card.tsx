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
        'rounded-lg border border-rf-border bg-rf-surface p-4',
        'transition-[border-color,background-color,transform] duration-150 ease-[var(--ease-standard)]',
        interactive ? 'hover:border-rf-border-strong hover:bg-rf-surface-hover active:scale-[0.99] cursor-pointer' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
}
