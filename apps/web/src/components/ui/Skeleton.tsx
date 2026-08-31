import type { CSSProperties, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  height?: number | string;
  width?: number | string;
}

/** Low-level decorative placeholder. Compose it into layout-matched loaders. */
export function Skeleton({ height = 16, width = '100%', className, style, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      {...props}
      className={cn('rf-skeleton', className)}
      style={{ height, width, ...style } as CSSProperties}
    />
  );
}

interface SkeletonCollectionProps {
  count?: number;
  className?: string;
}

export function MetricCardSkeleton({ count = 4, className }: SkeletonCollectionProps) {
  return (
    <div className={cn('rf-skeleton-metrics', className)} role="status" aria-label="Loading metrics" aria-busy="true">
      <span className="sr-only">Loading metrics…</span>
      {Array.from({ length: count }, (_, index) => (
        <div className="rf-skeleton-metric" key={index} aria-hidden="true">
          <div className="flex items-start justify-between gap-3">
            <Skeleton height={11} width="56%" />
            <Skeleton className="rounded-[10px]" height={32} width={32} />
          </div>
          <div className="mt-6 grid gap-2">
            <Skeleton height={24} width="42%" />
            <Skeleton height={10} width="68%" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface TableSkeletonProps extends SkeletonCollectionProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 5, columns = 5, className }: TableSkeletonProps) {
  return (
    <div
      className={cn('rf-skeleton-table', className)}
      role="status"
      aria-label="Loading table records"
      aria-busy="true"
      style={{ '--rf-skeleton-columns': columns } as CSSProperties}
    >
      <span className="sr-only">Loading table records…</span>
      <div className="rf-skeleton-table__head" aria-hidden="true">
        {Array.from({ length: columns }, (_, index) => <Skeleton key={index} height={10} width={index === 0 ? '72%' : '56%'} />)}
      </div>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div className="rf-skeleton-table__row" key={rowIndex} aria-hidden="true">
          {Array.from({ length: columns }, (_, columnIndex) => (
            <Skeleton key={columnIndex} height={columnIndex === 0 ? 22 : 12} width={columnIndex === 0 ? '78%' : '62%'} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Reusable record-list placeholder for task, notification, and activity feeds. */
export function ListSkeleton({ count = 4, className }: SkeletonCollectionProps) {
  return (
    <div className={cn('rf-skeleton-list', className)} role="status" aria-label="Loading list records" aria-busy="true">
      <span className="sr-only">Loading list records…</span>
      {Array.from({ length: count }, (_, index) => (
        <div className="rf-skeleton-list__item" key={index} aria-hidden="true">
          <div className="rf-skeleton-list__content">
            <Skeleton className="rounded-full" height={10} width={10} />
            <div className="grid flex-1 gap-2">
              <Skeleton height={13} width={index % 2 === 0 ? '42%' : '58%'} />
              <Skeleton height={10} width={index % 2 === 0 ? '74%' : '62%'} />
              <Skeleton height={10} width="34%" />
            </div>
          </div>
          <Skeleton className="rounded-[10px]" height={32} width={68} />
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton({ className }: Pick<SkeletonCollectionProps, 'className'>) {
  return (
    <div className={cn('rf-skeleton-detail', className)} role="status" aria-label="Loading record detail" aria-busy="true">
      <span className="sr-only">Loading record detail…</span>
      <div className="rf-skeleton-detail__hero" aria-hidden="true">
        <Skeleton className="rounded-2xl" height={56} width={56} />
        <div className="grid flex-1 gap-2">
          <Skeleton height={20} width="34%" />
          <Skeleton height={11} width="56%" />
        </div>
      </div>
      <div className="rf-skeleton-detail__body" aria-hidden="true">
        <div className="grid gap-3"><Skeleton height={14} width="44%" /><Skeleton height={12} width="92%" /><Skeleton height={12} width="84%" /></div>
        <div className="grid gap-3"><Skeleton height={14} width="36%" /><Skeleton height={12} width="88%" /><Skeleton height={12} width="74%" /></div>
      </div>
    </div>
  );
}

export function PipelineSkeleton({ stages = 5, cardsPerStage = 3, className }: { stages?: number; cardsPerStage?: number; className?: string }) {
  return (
    <div
      className={cn('rf-skeleton-pipeline', className)}
      role="status"
      aria-label="Loading recruitment pipeline"
      aria-busy="true"
      style={{ '--rf-skeleton-stages': stages } as CSSProperties}
    >
      <span className="sr-only">Loading recruitment pipeline…</span>
      {Array.from({ length: stages }, (_, stageIndex) => (
        <div className="rf-skeleton-pipeline__stage" key={stageIndex} aria-hidden="true">
          <div className="flex items-center justify-between gap-2"><Skeleton height={12} width="56%" /><Skeleton className="rounded-full" height={18} width={24} /></div>
          {Array.from({ length: cardsPerStage }, (_, cardIndex) => (
            <div className="rf-skeleton-pipeline__card" key={cardIndex}>
              <Skeleton height={12} width="70%" />
              <Skeleton height={10} width="48%" />
              <Skeleton height={10} width="60%" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
