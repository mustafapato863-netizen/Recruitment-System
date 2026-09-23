import { useId, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { DataTable, dataTableClasses } from './DataTable';
import { OverflowMenu } from './OverflowMenu';

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

export interface ResponsiveRowAction {
  id: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

interface ResponsiveDataViewProps<T> {
  rows: T[];
  columns: ResponsiveDataColumn<T>[];
  rowKey: (row: T) => string;
  label: string;
  onRowClick?: (row: T) => void;
  renderActions?: (row: T) => ReactNode;
  /** Card and table overflow menu. Existing `renderActions` stay inline. */
  rowActions?: (row: T) => ResponsiveRowAction[];
  emptyState?: ReactNode;
  className?: string;
  selectedRowKeys?: Iterable<string>;
  /** When set, cards and the table gain a selection checkbox. */
  onSelectedRowKeysChange?: (keys: string[]) => void;
  /** Stick the desktop header inside the table's scroll container. */
  stickyHeader?: boolean;
}

function priorityClass(priority: ResponsiveColumnPriority = 'secondary') {
  if (priority === 'tertiary') return 'hidden lg:table-cell';
  return '';
}

function RowActionsMenu({ actions }: { actions: ResponsiveRowAction[] }) {
  if (actions.length === 0) return null;
  return (
    <OverflowMenu label="Actions">
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          role="menuitem"
          className="rounded-md px-2.5 py-1.5 text-left text-xs font-semibold text-rf-ink hover:bg-rf-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rf-action/30 disabled:opacity-45"
          disabled={action.disabled}
          onClick={action.onSelect}
        >
          {action.label}
        </button>
      ))}
    </OverflowMenu>
  );
}

function SelectionControl({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <label className="rf-row-select" htmlFor={id} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        aria-label={label}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

export function ResponsiveDataView<T>({
  rows,
  columns,
  rowKey,
  label,
  onRowClick,
  renderActions,
  rowActions,
  emptyState,
  className,
  selectedRowKeys,
  onSelectedRowKeysChange,
  stickyHeader = false,
}: ResponsiveDataViewProps<T>) {
  const selectedKeys = new Set(selectedRowKeys ?? []);
  const selectable = Boolean(onSelectedRowKeysChange);
  if (rows.length === 0 && emptyState) return <>{emptyState}</>;

  const rowKeys = rows.map((row) => rowKey(row));
  const allSelected = selectable && rowKeys.length > 0 && rowKeys.every((key) => selectedKeys.has(key));

  const setSelected = (key: string, selected: boolean) => {
    if (!onSelectedRowKeysChange) return;
    const next = new Set(selectedKeys);
    if (selected) next.add(key);
    else next.delete(key);
    onSelectedRowKeysChange([...next]);
  };

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
          const actions = rowActions?.(row) ?? [];
          const cardClickable = Boolean(onRowClick && !renderActions && actions.length === 0 && !selectable);
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
              {selectable && (
                <SelectionControl
                  checked={selectedKeys.has(key)}
                  label={`Select row ${key}`}
                  onChange={(checked) => setSelected(key, checked)}
                />
              )}
              <dl className="m-0 grid gap-2.5">
                {columns
                  .filter((column) => column.priority !== 'tertiary')
                  .map((column) => (
                    <div key={column.key} className={cn('grid gap-0.5', column.priority !== 'primary' && 'grid-cols-[minmax(0,0.45fr)_minmax(0,1fr)] items-start gap-3')}>
                      <dt className="text-[9.5px] font-extrabold uppercase tracking-[0.08em] text-rf-ink-muted">
                        {column.mobileLabel ?? column.header}
                      </dt>
                      <dd className={cn('m-0 min-w-0 text-xs text-rf-ink', column.priority === 'primary' && 'text-sm font-extrabold')}>
                        {column.render(row)}
                      </dd>
                    </div>
                  ))}
              </dl>
              {(renderActions || actions.length > 0) && (
                <div className="flex flex-wrap items-center gap-2 border-t border-rf-border-subtle pt-3" onClick={(event) => event.stopPropagation()}>
                  {renderActions?.(row)}
                  <RowActionsMenu actions={actions} />
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
            {selectable && (
              <th className={cn(dataTableClasses.th, stickyHeader && 'rf-responsive-data__sticky')} scope="col">
                <SelectionControl
                  checked={allSelected}
                  label={`Select all ${label}`}
                  onChange={(checked) => onSelectedRowKeysChange?.(checked ? rowKeys : [])}
                />
              </th>
            )}
            {columns.map((column) => (
              <th key={column.key} className={cn(dataTableClasses.th, priorityClass(column.priority), column.headerClassName, stickyHeader && 'rf-responsive-data__sticky')} scope="col">
                {column.header}
              </th>
            ))}
            {(renderActions || rowActions) && <th className={cn(dataTableClasses.th, stickyHeader && 'rf-responsive-data__sticky')} scope="col"><span className="sr-only">Actions</span></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row);
            const actions = rowActions?.(row) ?? [];
            return (
              <tr
                key={key}
                data-selected={selectedKeys.has(key) || undefined}
                className={cn(dataTableClasses.row, onRowClick && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rf-action/40 focus-within:bg-rf-action-soft/35')}
                onClick={() => onRowClick?.(row)}
                onKeyDown={(event) => activateRow(event, row)}
                tabIndex={onRowClick ? 0 : undefined}
              >
                {selectable && (
                  <td className={dataTableClasses.td}>
                    <SelectionControl
                      checked={selectedKeys.has(key)}
                      label={`Select row ${key}`}
                      onChange={(checked) => setSelected(key, checked)}
                    />
                  </td>
                )}
                {columns.map((column) => (
                  <td key={column.key} className={cn(dataTableClasses.td, priorityClass(column.priority), column.cellClassName)}>
                    {column.render(row)}
                  </td>
                ))}
                {(renderActions || rowActions) && (
                  <td className={cn(dataTableClasses.td, 'whitespace-nowrap')} onClick={(event) => event.stopPropagation()}>
                    <div className="flex justify-end gap-2">
                      {renderActions?.(row)}
                      <RowActionsMenu actions={actions} />
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </DataTable>
    </div>
  );
}
