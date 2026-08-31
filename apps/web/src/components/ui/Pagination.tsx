import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  summary?: ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

function getVisiblePages(current: number, total: number): Array<number | 'ellipsis-start' | 'ellipsis-end'> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const pages: Array<number | 'ellipsis-start' | 'ellipsis-end'> = [1];
  if (current > 4) pages.push('ellipsis-start');
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (current < total - 3) pages.push('ellipsis-end');
  pages.push(total);
  return pages;
}

/** Compact enterprise pager with stable first/last anchors and a visible current page. */
export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  summary,
  disabled = false,
  ariaLabel = 'Pagination',
  className,
}: PaginationProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, currentPage), safeTotalPages);
  const pages = getVisiblePages(safePage, safeTotalPages);

  return (
    <nav className={cn('rf-pagination', className)} aria-label={ariaLabel}>
      <span className="rf-pagination__summary" aria-live="polite">
        {summary ?? `Page ${safePage} of ${safeTotalPages}`}
      </span>
      <div className="rf-pagination__controls">
        <Button variant="secondary" size="sm" type="button" disabled={disabled || safePage <= 1} onClick={() => onPageChange(safePage - 1)}>
          Previous
        </Button>
        <div className="flex items-center gap-1" aria-label={`Page ${safePage} of ${safeTotalPages}`}>
          {pages.map((page) => typeof page === 'number' ? (
            <Button
              key={page}
              variant={page === safePage ? 'primary' : 'ghost'}
              size="sm"
              className="rf-pagination__page min-w-8 px-2 tabular-nums"
              type="button"
              disabled={disabled}
              aria-current={page === safePage ? 'page' : undefined}
              aria-label={`Go to page ${page}`}
              onClick={() => onPageChange(page)}
            >
              {page}
            </Button>
          ) : <span key={page} className="px-1 text-[10px] text-rf-ink-muted" aria-hidden="true">…</span>)}
        </div>
        <Button variant="secondary" size="sm" type="button" disabled={disabled || safePage >= safeTotalPages} onClick={() => onPageChange(safePage + 1)}>
          Next
        </Button>
      </div>
    </nav>
  );
}
