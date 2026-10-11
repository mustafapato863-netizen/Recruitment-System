import { useId, useState, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import { Drawer } from './Drawer';
import { useMediaQuery } from './useMediaQuery';

interface DataToolbarProps extends HTMLAttributes<HTMLDivElement> {
  search?: ReactNode;
  filters?: ReactNode;
  actions?: ReactNode;
  activeFilters?: ReactNode;
  /** Number of applied filters. Shown on the Filters button below the `md` breakpoint. */
  activeFilterCount?: number;
  children?: ReactNode;
}

/** Layout-only table/list toolbar. It deliberately owns no filter or query state. */
export function DataToolbar({
  search,
  filters,
  actions,
  activeFilters,
  activeFilterCount,
  children,
  className,
  ...props
}: DataToolbarProps) {
  const filtersId = useId();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const compact = useMediaQuery('(max-width: 767px)');
  const collapseFilters = compact && Boolean(filters);
  const filterLabel = typeof activeFilterCount === 'number'
    ? `Filters, ${activeFilterCount} active`
    : 'Filters';

  return (
    <div {...props} className={cn('rf-data-toolbar', className)}>
      <div className="rf-data-toolbar__main">
        {search && <div className="rf-data-toolbar__search">{search}</div>}
        {filters && !collapseFilters && <div className="rf-data-toolbar__filters">{filters}</div>}
        {collapseFilters && (
          <div className="rf-data-toolbar__filters">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              aria-expanded={filtersOpen}
              aria-controls={filtersId}
              aria-haspopup="dialog"
              aria-label={filterLabel}
              onClick={() => setFiltersOpen(true)}
            >
              Filters
              {typeof activeFilterCount === 'number' && activeFilterCount > 0 && (
                <span className="rf-filter-count">{activeFilterCount}</span>
              )}
            </Button>
          </div>
        )}
        {children}
        {actions && <div className="rf-data-toolbar__actions">{actions}</div>}
      </div>
      {activeFilters && <div className="rf-data-toolbar__active-filters">{activeFilters}</div>}
      {collapseFilters && (
        <Drawer
          isOpen={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          title="Filters"
          placement="bottom"
        >
          <div id={filtersId}>{filters}</div>
        </Drawer>
      )}
    </div>
  );
}
