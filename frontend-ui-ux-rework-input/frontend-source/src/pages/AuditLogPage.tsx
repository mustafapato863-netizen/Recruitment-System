import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AuditLogEntry, PaginatedResult } from '@recruitflow/contracts';
import { fetchApi } from '../api/client';
import { Icon } from '../components/Icon';
import { StatusBadge } from '../components/StatusBadge';
import { Alert } from '../components/ui/Alert';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { DataToolbar } from '../components/ui/DataToolbar';
import { FilterChip } from '../components/ui/FilterChips';
import { Input } from '../components/ui/Input';
import { MetricCard } from '../components/ui/MetricCard';
import { Pagination } from '../components/ui/Pagination';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { ResponsiveDataView, type ResponsiveDataColumn } from '../components/ui/ResponsiveDataView';
import { Select } from '../components/ui/Select';
import { TableSkeleton } from '../components/ui/Skeleton';
import './PageEnhancementsV2.css';

const auditColumns: ResponsiveDataColumn<AuditLogEntry>[] = [
  {
    key: 'timestamp',
    header: 'Timestamp',
    priority: 'secondary',
    render: (log) => <time className="font-medium text-rf-ink-muted" dateTime={log.createdAt}>{new Date(log.createdAt).toLocaleString()}</time>,
  },
  {
    key: 'actor',
    header: 'Actor',
    priority: 'primary',
    render: (log) => {
      const actor = log.actorDisplayName || log.actorUserId || 'System Actor';
      return (
        <div className="flex items-center gap-2.5">
          <Avatar initials={actor.slice(0, 2).toUpperCase()} size="sm" />
          <span className="min-w-0 truncate font-bold text-rf-ink">{actor}</span>
        </div>
      );
    },
  },
  {
    key: 'action',
    header: 'Action',
    priority: 'secondary',
    render: (log) => <Badge variant="neutral" className="font-mono">{log.action}</Badge>,
  },
  {
    key: 'entity',
    header: 'Entity target',
    priority: 'secondary',
    render: (log) => (
      <span className="font-medium text-rf-ink-muted">
        {log.entityType} <span className="font-mono text-rf-ink-muted">({log.entityId?.slice(0, 8)}...)</span>
      </span>
    ),
  },
  {
    key: 'result',
    header: 'Result',
    priority: 'secondary',
    render: (log) => <StatusBadge status={log.result?.toUpperCase() === 'SUCCESS' ? 'Approved' : 'Rejected'} />,
  },
];

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [date, setDate] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetchApi<PaginatedResult<AuditLogEntry>>(`/audit-logs?page=${page}&pageSize=${pageSize}`);
      setLogs(response.data || []);
      setTotalEvents(response.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => { void load(); }, [load]);

  const filteredLogs = useMemo(() => logs.filter((log) => {
    const haystack = `${log.actorDisplayName || ''} ${log.actorUserId || ''} ${log.entityType} ${log.entityId}`.toLowerCase();
    const matchesSearch = !search || haystack.includes(search.toLowerCase());
    const matchesAction = !action || log.action === action;
    const matchesDate = !date || log.createdAt.slice(0, 10) === date;
    return matchesSearch && matchesAction && matchesDate;
  }), [action, date, logs, search]);

  const exportCsv = () => {
    const rows = [
      ['Timestamp', 'Actor', 'Action', 'Entity', 'Result'],
      ...filteredLogs.map((log) => [
        log.createdAt,
        log.actorDisplayName || log.actorUserId || 'System',
        log.action,
        `${log.entityType}:${log.entityId}`,
        log.result,
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'recruitflow-audit-log.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const blockedCount = logs.filter((log) => log.result?.toUpperCase() === 'FAILURE').length;
  const sensitiveCount = logs.filter((log) => /PII|SALARY|DOCUMENT|AUTH/i.test(log.action)).length;
  const totalPages = Math.max(1, Math.ceil(totalEvents / pageSize));
  const hasFilters = Boolean(search || action || date);
  const clearFilters = () => {
    setSearch('');
    setAction('');
    setDate('');
    setPage(1);
  };

  return (
    <PageFrame
      eyebrow="Insights & Trust"
      title="Audit Log & Security Trace"
      description="Immutable trace of critical organization actions, sensitive data access and security event history."
      actions={(
        <>
          <Button variant="ghost" size="sm" onClick={() => void load()}>
            <Icon name="refresh-cw" size={13} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </Button>
          <Button variant="secondary" size="sm" disabled={filteredLogs.length === 0} onClick={exportCsv}>
            <Icon name="download" size={13} />
            Export CSV
          </Button>
        </>
      )}
    >
      {error && <Alert tone="danger" title="Unable to load audit logs">{error}</Alert>}

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Organization Events" value={totalEvents} detail="Total recorded events" tone="action" icon={<Icon name="list" size={14} />} />
        <MetricCard label="Sensitive Access" value={sensitiveCount} detail="Confidential entity reads" tone="warning" icon={<Icon name="lock" size={14} />} />
        <MetricCard label="Blocked Actions" value={blockedCount} detail="Security/policy violations" tone="danger" icon={<Icon name="alert-triangle" size={14} />} />
        <MetricCard label="Retention Policy" value="90 Days" detail="Immutable audit ledger" tone="success" icon={<Icon name="check-circle" size={14} />} />
      </div>

      <section className="rf-table-shell rf-long-content overflow-hidden rounded-2xl border border-rf-border-subtle bg-white shadow-xs">
        <DataToolbar
          search={(
            <Input
              aria-label="Search audit logs"
              placeholder="Search actor, action or entity ID..."
              value={search}
              onChange={(event) => { setPage(1); setSearch(event.target.value); }}
            />
          )}
          filters={(
            <>
              <Input className="min-w-[10rem] flex-1 sm:w-44 sm:flex-none" aria-label="Filter by date" type="date" value={date} onChange={(event) => { setPage(1); setDate(event.target.value); }} />
              <Select className="min-w-[10rem] flex-1 sm:w-52 sm:flex-none" aria-label="Filter by action" value={action} onChange={(event) => { setPage(1); setAction(event.target.value); }}>
                <option value="">All actions</option>
                {[...new Set(logs.map((log) => log.action))].map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
            </>
          )}
          activeFilters={hasFilters ? (
            <>
              {search && <FilterChip label={`Search: ${search}`} onRemove={() => { setSearch(''); setPage(1); }} />}
              {date && <FilterChip label={`Date: ${date}`} onRemove={() => { setDate(''); setPage(1); }} />}
              {action && <FilterChip label={`Action: ${action}`} onRemove={() => { setAction(''); setPage(1); }} />}
              <Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button>
            </>
          ) : undefined}
        />

        {isLoading ? (
          <TableSkeleton columns={5} rows={7} />
        ) : filteredLogs.length === 0 ? (
          <PageState kind="empty" title="No audit events found" description="Adjust your search filters." />
        ) : (
          <ResponsiveDataView
            rows={filteredLogs}
            columns={auditColumns}
            rowKey={(log) => log.id}
            label="Audit logs"
            className="px-4 pb-4 sm:px-5 sm:pb-5"
          />
        )}

        {!isLoading && !error && totalPages > 1 && (
          <Pagination
            ariaLabel="Audit log pages"
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            summary={`${totalEvents} organization events`}
          />
        )}
      </section>
    </PageFrame>
  );
}
