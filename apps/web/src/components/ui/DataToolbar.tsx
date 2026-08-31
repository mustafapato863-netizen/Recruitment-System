import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface DataToolbarProps extends HTMLAttributes<HTMLDivElement> {
  search?: ReactNode;
  filters?: ReactNode;
  actions?: ReactNode;
  activeFilters?: ReactNode;
  children?: ReactNode;
}

/** Layout-only table/list toolbar. It deliberately owns no filter or query state. */
export function DataToolbar({
  search,
  filters,
  actions,
  activeFilters,
  children,
  className,
  ...props
}: DataToolbarProps) {
  return (
    <div {...props} className={cn('rf-data-toolbar', className)}>
      <div className="rf-data-toolbar__main">
        {search && <div className="rf-data-toolbar__search">{search}</div>}
        {filters && <div className="rf-data-toolbar__filters">{filters}</div>}
        {children}
        {actions && <div className="rf-data-toolbar__actions">{actions}</div>}
      </div>
      {activeFilters && <div className="rf-data-toolbar__active-filters">{activeFilters}</div>}
    </div>
  );
}
