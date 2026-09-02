import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getApi } from '../api/client';
import type { Offer } from '@recruitflow/contracts';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { DataToolbar } from '../components/ui/DataToolbar';
import { FilterChip } from '../components/ui/FilterChips';
import { Input } from '../components/ui/Input';
import { MetricCard } from '../components/ui/MetricCard';
import { ResponsiveDataView, type ResponsiveDataColumn } from '../components/ui/ResponsiveDataView';
import { TableSkeleton } from '../components/ui/Skeleton';
import { StatusBadge } from '../components/StatusBadge';
import { Icon } from '../components/Icon';
import './PageEnhancementsV2.css';

const STATUSES = ['', 'Draft', 'Pending Approval', 'Approved', 'Sent', 'Accepted', 'Declined'] as const;

const offerColumns: ResponsiveDataColumn<Offer>[] = [
  {
    key: 'offer',
    header: 'Offer',
    priority: 'primary',
    render: (offer) => (
      <div className="flex items-center gap-2.5">
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-rf-action/15 bg-rf-action-soft text-rf-action"><Icon name="offer" size={14} /></div>
        <div className="min-w-0">
          <div className="truncate font-bold text-rf-ink">{offer.offerCode}</div>
          <div className="truncate text-[11px] font-medium text-rf-ink-muted">
            Revision {offer.currentVersion?.versionNumber ?? '—'}
          </div>
        </div>
      </div>
    ),
  },
  {
    key: 'candidate',
    header: 'Candidate',
    priority: 'secondary',
    render: (offer) => <span className="font-medium text-rf-ink">{(offer as { candidateName?: string }).candidateName || 'Candidate'}</span>,
  },
  {
    key: 'position',
    header: 'Position',
    priority: 'secondary',
    render: (offer) => <span className="font-medium text-rf-ink">{(offer as { positionTitle?: string }).positionTitle || 'Position'}</span>,
  },
  {
    key: 'version',
    header: 'Version',
    priority: 'tertiary',
    render: (offer) => (
      <Badge variant="neutral">
        {offer.currentVersion?.versionNumber != null ? `v${offer.currentVersion.versionNumber}` : '—'}
      </Badge>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    priority: 'secondary',
    render: (offer) => <StatusBadge status={offer.status} />,
  },
  {
    key: 'created',
    header: 'Created',
    priority: 'tertiary',
    render: (offer) => <span className="font-medium text-rf-ink-muted">{new Date(offer.createdAt).toLocaleDateString()}</span>,
  },
];

export function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const loadOffers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const data = await getApi<Offer[]>(`/offers?${params.toString()}`);
      setOffers(data);
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Failed to load offers.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadOffers();
  }, [loadOffers]);

  const filteredOffers = offers.filter((o) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      o.offerCode.toLowerCase().includes(s) ||
      (o as { candidateName?: string }).candidateName?.toLowerCase().includes(s) ||
      (o as { positionTitle?: string }).positionTitle?.toLowerCase().includes(s)
    );
  });

  const draftCount = offers.filter((o) => o.status === 'Draft').length;
  const pendingCount = offers.filter((o) => o.status === 'Pending Approval').length;
  const sentCount = offers.filter((o) => o.status === 'Sent').length;
  const acceptedCount = offers.filter((o) => o.status === 'Accepted').length;

  return (
    <PageFrame
      eyebrow="Hiring Operations"
      title="Offer Management"
      description="Track offer packages, compensation versions, approval workflows, and candidate acceptances."
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={() => void loadOffers()}>
            <Icon name="refresh-cw" size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>
          <Button variant="primary" size="sm" asChild>
            <Link to="/offers/create">
              <Icon name="plus" size={14} />
              Create offer
            </Link>
          </Button>
        </>
      }
    >
      {error && (
        <Alert tone="danger" title="Unable to load offers">
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Draft Offers" value={draftCount} detail="Under preparation" tone="action" icon={<Icon name="document" size={14} />} />
        <MetricCard label="Pending Approval" value={pendingCount} detail="Awaiting decision" tone="warning" icon={<Icon name="clock" size={14} />} />
        <MetricCard label="Sent to Candidate" value={sentCount} detail="Awaiting response" tone="info" icon={<Icon name="send" size={14} />} />
        <MetricCard label="Accepted" value={acceptedCount} detail="Proceeding to pre-hire" tone="success" icon={<Icon name="check-circle" size={14} />} />
      </div>

      <section className="rf-table-shell overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
        <DataToolbar
          search={(
            <Input
              aria-label="Search offers"
              placeholder="Search by offer code, candidate or position..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
          filters={(
            <div className="flex flex-wrap gap-1.5" aria-label="Filter offers by status">
              {STATUSES.map((status) => (
                <FilterChip key={status || 'all'} label={status || 'All statuses'} isActive={statusFilter === status} onClick={() => setStatusFilter(status)} />
              ))}
            </div>
          )}
          activeFilters={statusFilter ? <FilterChip label={`Status: ${statusFilter}`} onRemove={() => setStatusFilter('')} /> : undefined}
        />

        {loading ? (
          <TableSkeleton columns={7} rows={6} />
        ) : filteredOffers.length === 0 ? (
          <PageState
            kind="empty"
            title="No matching offers"
            description="Adjust your search filters or create a new offer package."
          />
        ) : (
          <ResponsiveDataView
            rows={filteredOffers}
            columns={offerColumns}
            rowKey={(offer) => offer.id}
            label="Offer packages"
            className="px-4 pb-4 sm:px-5 sm:pb-5"
            renderActions={(offer) => (
              <Button variant="secondary" size="sm" asChild>
                <Link to={`/offers/${offer.id}`}>View offer</Link>
              </Button>
            )}
          />
        )}
      </section>
    </PageFrame>
  );
}
