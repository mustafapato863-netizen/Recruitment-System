import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { HiringCase } from '@recruitflow/contracts';
import { getApi } from '../api/client';
import { Icon } from '../components/Icon';
import { StatusBadge } from '../components/StatusBadge';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { DataToolbar } from '../components/ui/DataToolbar';
import { FilterChip } from '../components/ui/FilterChips';
import { Input } from '../components/ui/Input';
import { MetricCard } from '../components/ui/MetricCard';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { ResponsiveDataView, type ResponsiveDataColumn } from '../components/ui/ResponsiveDataView';
import { TableSkeleton } from '../components/ui/Skeleton';
import './PageEnhancementsV2.css';

type LicenseRow = {
  id: string;
  caseId: string;
  candidate: string;
  type: string;
  number: string;
  expiry: string;
  status: string;
  owner: string;
};

const LICENSE_STATUSES = ['', 'Verified', 'Pending', 'Not Required'] as const;

const licenseColumns: ResponsiveDataColumn<LicenseRow>[] = [
  {
    key: 'license',
    header: 'License ID',
    priority: 'secondary',
    render: (license) => <Badge variant="neutral">{license.id}</Badge>,
  },
  {
    key: 'candidate',
    header: 'Candidate',
    priority: 'primary',
    render: (license) => <span className="font-bold text-rf-ink">{license.candidate}</span>,
  },
  {
    key: 'type',
    header: 'Authority / type',
    priority: 'secondary',
    render: (license) => <span className="font-medium text-rf-ink">{license.type}</span>,
  },
  {
    key: 'number',
    header: 'License number',
    priority: 'tertiary',
    render: (license) => <Badge variant="neutral" className="font-mono">{license.number}</Badge>,
  },
  {
    key: 'expiry',
    header: 'Expiry date',
    priority: 'secondary',
    render: (license) => <span className="font-medium text-rf-ink-muted">{license.expiry}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    priority: 'secondary',
    render: (license) => <StatusBadge status={license.status} />,
  },
  {
    key: 'owner',
    header: 'Verifier / owner',
    priority: 'tertiary',
    render: (license) => <span className="font-medium text-rf-ink-muted">{license.owner}</span>,
  },
];

export function LicenseManagementPage() {
  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const cases = await getApi<HiringCase[]>('/hiring');
      const rows: LicenseRow[] = [];
      cases.forEach((hiringCase) => {
        (hiringCase.complianceRequirements || []).forEach((requirement) => {
          rows.push({
            id: requirement.id.slice(0, 8).toUpperCase(),
            caseId: hiringCase.id,
            candidate: hiringCase.candidateName || 'Not reported',
            type: requirement.name,
            number: `REQ-${requirement.id.slice(0, 6).toUpperCase()}`,
            expiry: requirement.expiryDate ? new Date(requirement.expiryDate).toLocaleDateString() : 'Not reported',
            status: requirement.status,
            owner: hiringCase.ownerUserId || 'Owner not reported',
          });
        });
      });
      setLicenses(rows);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load license requirements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filtered = licenses.filter((license) => {
    const searchable = `${license.candidate} ${license.number} ${license.type}`.toLowerCase();
    return (!search || searchable.includes(search.toLowerCase())) && (!filter || license.status === filter);
  });

  return (
    <PageFrame
      eyebrow="Joining & Compliance"
      title="License Management & Verification"
      description="Track healthcare and professional license requirements, verification authority, validity and expiry risks."
      actions={
        <Button variant="ghost" size="sm" onClick={() => void loadData()}>
          <Icon name="refresh-cw" size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      }
    >
      {error && (
        <Alert
          tone="danger"
          title="License requirements unavailable"
          action={(
            <Button variant="secondary" size="sm" onClick={() => void loadData()}>
              <Icon name="refresh-cw" size={13} />
              Retry
            </Button>
          )}
        >
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total Requirements" value={licenses.length} detail="Across pre-hire cases" tone="action" icon={<Icon name="list" size={14} />} />
        <MetricCard label="Verified Licenses" value={licenses.filter((license) => license.status === 'Verified').length} detail="Cleared requirements" tone="success" icon={<Icon name="check-circle" size={14} />} />
        <MetricCard label="Pending Review" value={licenses.filter((license) => license.status === 'Pending').length} detail="Under verification" tone="warning" icon={<Icon name="alert-triangle" size={14} />} />
        <MetricCard label="Exempted" value={licenses.filter((license) => license.status === 'Not Required').length} detail="Role-exempt" tone="neutral" icon={<Icon name="lock" size={14} />} />
      </div>

      <section className="rf-table-shell overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
        <DataToolbar
          search={(
            <Input
              aria-label="Search licenses"
              placeholder="Search candidate, license number, or authority..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          )}
          filters={(
            <div className="flex flex-wrap gap-1.5" aria-label="Filter licenses by status">
              {LICENSE_STATUSES.map((status) => (
                <FilterChip key={status || 'all'} label={status || 'All statuses'} isActive={filter === status} onClick={() => setFilter(status)} />
              ))}
            </div>
          )}
          activeFilters={filter ? <FilterChip label={`Status: ${filter}`} onRemove={() => setFilter('')} /> : undefined}
        />

        {loading ? (
          <TableSkeleton columns={8} rows={6} />
        ) : filtered.length === 0 ? (
          <PageState kind="empty" title="No matching license records" description="Adjust your search or status filter." />
        ) : (
          <ResponsiveDataView
            rows={filtered}
            columns={licenseColumns}
            rowKey={(license) => license.id}
            label="License requirements"
            className="px-4 pb-4 sm:px-5 sm:pb-5"
            renderActions={(license) => (
              <Button variant="secondary" size="sm" asChild>
                <Link to={`/hires/${license.caseId}`}>Review case</Link>
              </Button>
            )}
          />
        )}
      </section>
    </PageFrame>
  );
}
