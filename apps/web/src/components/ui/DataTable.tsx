import type { HTMLAttributes, ReactNode } from 'react';

export const dataTableClasses = {
  table: 'min-w-[920px] w-full border-collapse text-left lg:min-w-full',
  head: 'bg-rf-surface-subtle border-b border-rf-border',
  th: 'px-3 py-2.5 text-left text-[9.5px] font-bold uppercase tracking-[0.055em] text-rf-ink-muted whitespace-nowrap',
  td: 'border-b border-rf-border-subtle px-3 py-2.5 text-left align-middle text-[11.5px] text-rf-ink',
  row: 'transition-colors hover:bg-rf-surface-hover last:[&>td]:border-b-0 data-[selected=true]:bg-rf-action-soft/65 data-[selected=true]:shadow-[inset_2px_0_0_var(--color-action)]',
  primary: 'font-semibold text-rf-ink',
  secondary: 'mt-0.5 text-[10px] text-rf-ink-muted font-medium',
};

interface DataTableProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  tableClassName?: string;
}

export function DataTable({ children, className = '', tableClassName = '', ...props }: DataTableProps) {
  return (
    <div
      {...props}
      className={[
        'rf-scrollbar overflow-x-auto rounded-[10px] border border-rf-border bg-rf-surface shadow-[var(--shadow-2xs)]',
        className,
      ].filter(Boolean).join(' ')}
    >
      <table className={[dataTableClasses.table, tableClassName].filter(Boolean).join(' ')}>{children}</table>
    </div>
  );
}
