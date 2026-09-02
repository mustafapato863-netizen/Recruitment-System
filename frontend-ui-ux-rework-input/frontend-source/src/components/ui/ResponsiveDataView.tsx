import type { KeyboardEvent, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { DataTable, dataTableClasses } from './DataTable';

export type ResponsiveColumnPriority = 'primary' | 'secondary' | 'tertiary';

export interface ResponsiveDataColumn<T> {
  key: string;
  header: string;
  mobileLabel?: string;
  priority?: ResponsiveColumnPriority;
  render: (row: T) => ReactNode;
  headerClassName?: string;
  cellClassName?: string;
}

interface ResponsiveDataViewProps<T> {
  rows: T[];
  columns: ResponsiveDataColumn<T>[];
  rowKey: (row: T) => string;
  label: string;
  onRowClick?: (row: T) => void;
  renderActions?: (row: T) => ReactNode;
  emptyState?: ReactNode;
  className?: string;
  selectedRowKeys?: Iterable<string>;
}

function priorityClass(priority: ResponsiveColumnPriority = 'secondary') {
  if (priority === 'tertiary') return 'hidden lg:table-cell';
  return '';
}

export function ResponsiveDataView<T>({
  rows,
  columns,
  rowKey,
  label,
  onRowClick,
  renderActions,
  emptyState,
  className,
  selectedRowKeys,
}: ResponsiveDataViewProps<T>) {
  const selectedKeys = new Set(selectedRowKeys ?? []);
  if (rows.length === 0 && emptyState) return <>{emptyState}</>;

  const activateRow = (event: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if (!onRowClick || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    onRowClick(row);
  };

  return (
    <div className={className}>
      <div className="rf-responsive-data__cards" role="list" aria-label={label}>
        {rows.map((row) => {
          const key = rowKey(row);
          const cardClickable = Boolean(onRowClick && !renderActions);
          return (
            <div key={key} role="listitem">
              <article
                className={cn(
                  'grid gap-3 rounded-[10px] border border-rf-border bg-rf-surface p-3.5 shadow-[var(--shadow-2xs)]',
                  cardClickable && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rf-action/35',
                  selectedKeys.has(key) && 'border-rf-action/35 bg-rf-action-soft/45 shadow-[inset_2px_0_0_var(--color-action)]',
                )}
                role={cardClickable ? 'button' : undefined}
                tabIndex={cardClickable ? 0 : undefined}
                onClick={cardClickable ? () => onRowClick?.(row) : undefined}
                onKeyDown={cardClickable ? (event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  onRowClick?.(row);
                } : undefined}
              >
              <dl className="m-0 grid gap-2.5">
                {columns
                  .filter((column) => column.priority !== 'tertiary')
                  .map((column) => (
                    <div key={column.key} className={cn('grid gap-0.5', column.priority !== 'primary' && 'grid-cols-[minmax(88px,0.45fr)_1fr] items-start gap-3')}>
                      <dt className="text-[9.5px] font-extrabold uppercase tracking-[0.08em] text-rf-ink-muted">
                        {column.mobileLabel ?? column.header}
                      </dt>
                      <dd className={cn('m-0 min-w-0 text-xs text-rf-ink', column.priority === 'primary' && 'text-sm font-extrabold')}>
                        {column.render(row)}
                      </dd>
                    </div>
                  ))}
              </dl>
              {renderActions && (
                <div className="flex flex-wrap items-center gap-2 border-t border-rf-border-subtle pt-3" onClick={(event) => event.stopPropagation()}>
                  {renderActions(row)}
                </div>
              )}
              </article>
            </div>
          );
        })}
      </div>

      <DataTable className="rf-responsive-data__table" tableClassName="min-w-[680px] lg:min-w-full" role="region" aria-label={label} tabIndex={0}>
        <thead className={dataTableClasses.head}>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={cn(dataTableClasses.th, priorityClass(column.priority), column.headerClassName)} scope="col">
                {column.header}
              </th>
            ))}
            {renderActions && <th className={dataTableClasses.th} scope="col"><span className="sr-only">Actions</span></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              data-selected={selectedKeys.has(rowKey(row)) || undefined}
              className={cn(dataTableClasses.row, onRowClick && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rf-action/40 focus-within:bg-rf-action-soft/35')}
              onClick={() => onRowClick?.(row)}
              onKeyDown={(event) => activateRow(event, row)}
              tabIndex={onRowClick ? 0 : undefined}
            >
              {columns.map((column) => (
                <td key={column.key} className={cn(dataTableClasses.td, priorityClass(column.priority), column.cellClassName)}>
                  {column.render(row)}
                </td>
              ))}
              {renderActions && (
                <td className={cn(dataTableClasses.td, 'whitespace-nowrap')} onClick={(event) => event.stopPropagation()}>
                  <div className="flex justify-end gap-2">{renderActions(row)}</div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}
