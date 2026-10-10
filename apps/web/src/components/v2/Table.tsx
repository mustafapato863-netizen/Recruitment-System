import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TableV2Props extends React.TableHTMLAttributes<HTMLTableElement> {
  label: string;
  columns: Array<{ key: string; header: React.ReactNode; numeric?: boolean }>;
}

/** v2 Table shell: semantic <table> with column headers. */
export function TableV2({ label, columns, className, children, ...rest }: TableV2Props) {
  return (
    <div className="rf2-table-wrap">
      <table className={cn('rf2-table', className)} aria-label={label} {...rest}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" style={c.numeric ? { textAlign: 'right' } : undefined}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export interface TableRowV2Props extends React.HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean;
  disabled?: boolean;
  /** Makes the row interactive: focusable, Enter/Space activate. */
  onActivate?: () => void;
}

/** v2 Table row. States: default, hover, focus-visible, pressed, selected, disabled (interactive rows). */
export function TableRowV2({ selected, disabled, onActivate, className, onKeyDown, onClick, ...rest }: TableRowV2Props) {
  const interactive = Boolean(onActivate) && !disabled;
  return (
    <tr
      className={cn('rf2-row', onActivate && 'rf2-row--interactive', className)}
      aria-selected={selected === undefined ? undefined : selected}
      aria-disabled={disabled || undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={(e) => { if (interactive) onActivate?.(); onClick?.(e); }}
      onKeyDown={(e) => {
        if (interactive && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onActivate?.(); }
        onKeyDown?.(e);
      }}
      {...rest}
    />
  );
}

export function TableCellV2({ primary, numeric, className, ...rest }: React.TdHTMLAttributes<HTMLTableCellElement> & { primary?: boolean; numeric?: boolean }) {
  return <td className={cn(primary && 'rf2-row__primary', className)} data-numeric={numeric || undefined} {...rest} />;
}
