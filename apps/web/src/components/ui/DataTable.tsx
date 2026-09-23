import type { HTMLAttributes, ReactNode } from 'react';

export const dataTableClasses = {
  table: 'min-w-[920px] w-full border-collapse text-left lg:min-w-full',
  head: 'bg-rf-surface-subtle dark:bg-slate-800/60 border-b border-rf-border dark:border-slate-800',
  th: 'px-2.5 py-2 text-left text-[9px] font-bold uppercase tracking-[0.055em] text-rf-ink-muted dark:text-slate-400 whitespace-nowrap',
  td: 'border-b border-rf-border-subtle dark:border-slate-800/70 px-2.5 py-2 text-left align-middle text-[11px] text-rf-ink dark:text-slate-200',
  row: 'transition-colors hover:bg-rf-surface-hover dark:hover:bg-slate-800/40 last:[&>td]:border-b-0 data-[selected=true]:bg-rf-action-soft/65 data-[selected=true]:shadow-[inset_2px_0_0_var(--color-action)]',
  primary: 'font-semibold text-rf-ink dark:text-white',
  secondary: 'mt-0.5 text-[9.5px] text-rf-ink-muted dark:text-slate-400 font-medium',
};

interface DataTableProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  tableClassName?: string;
  dense?: boolean;
}

export function DataTable({ children, className = '', tableClassName = '', dense = false, ...props }: DataTableProps) {
  const { 'aria-label': ariaLabel, ...rest } = props;
  return (
    <div
      {...rest}
      aria-label={ariaLabel}
      className={[
        'rf-scrollbar overflow-x-auto rounded-[9px] border border-rf-border dark:border-slate-800 bg-rf-surface dark:bg-slate-900 shadow-[var(--shadow-2xs)]',
        dense ? '[&_th]:py-1 [&_th]:px-2 [&_td]:py-1 [&_td]:px-2' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      <table
        className={[dataTableClasses.table, tableClassName].filter(Boolean).join(' ')}
        aria-label={typeof ariaLabel === 'string' ? ariaLabel : undefined}
      >
        {typeof ariaLabel === 'string' ? <caption className="sr-only">{ariaLabel}</caption> : null}
        {children}
      </table>
    </div>
  );
}
