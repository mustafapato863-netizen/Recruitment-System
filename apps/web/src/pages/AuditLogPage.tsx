import { useEffect, useMemo, useState } from 'react';
import type { AuditLogEntry, PaginatedResult } from '@recruitflow/contracts';
import { fetchApi } from '../api/client';
import { Icon } from '../components/Icon';
import '../styles/admin.css';

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [date, setDate] = useState('');

  const load = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetchApi<PaginatedResult<AuditLogEntry>>('/audit-logs');
      setLogs(response.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filteredLogs = useMemo(() => logs.filter((log) => {
    const haystack = `${log.actorDisplayName || ''} ${log.actorUserId || ''} ${log.entityType} ${log.entityId}`.toLowerCase();
    const matchesSearch = !search || haystack.includes(search.toLowerCase());
    const matchesAction = !action || log.action === action;
    const matchesDate = !date || log.createdAt.startsWith(date);
    return matchesSearch && matchesAction && matchesDate;
  }), [action, date, logs, search]);

  const exportCsv = () => {
    const rows = [['Timestamp', 'Actor', 'Action', 'Entity', 'Result'], ...filteredLogs.map((log) => [log.createdAt, log.actorDisplayName || log.actorUserId || 'System', log.action, `${log.entityType}:${log.entityId}`, log.result])];
    const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'recruitflow-audit-log.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const blockedCount = logs.filter((log) => log.result.toUpperCase() === 'FAILURE').length;
  const sensitiveCount = logs.filter((log) => /PII|SALARY|DOCUMENT|AUTH/i.test(log.action)).length;

  return (
    <div>
      <section className="page-heading"><div><span className="eyebrow">Administration</span><h1>Audit Log</h1><p>Organization-scoped activity and security events.</p></div><button className="quiet-button" disabled={filteredLogs.length === 0} type="button" onClick={exportCsv}>Export CSV</button></section>
      {error && <div className="alert error-alert" role="alert"><span>{error}</span><button type="button" onClick={() => void load()}>Retry</button></div>}
      <section className="metric-grid" style={{ marginBottom: '24px' }}><article className="metric-card"><div className="metric-icon blue"><Icon name="audit" size={16} /></div><span>Loaded Events</span><strong>{logs.length}</strong></article><article className="metric-card"><div className="metric-icon orange"><Icon name="settings" size={16} /></div><span>Sensitive Events</span><strong>{sensitiveCount}</strong></article><article className="metric-card"><div className="metric-icon purple"><Icon name="bell" size={16} /></div><span>Failed Actions</span><strong>{blockedCount}</strong></article><article className="metric-card"><div className="metric-icon green"><Icon name="audit" size={16} /></div><span>Retention</span><strong>Configured</strong><small>Policy-managed</small></article></section>
      <div className="content-area"><div className="toolbar"><div className="filter"><input aria-label="Filter by date" type="date" value={date} onChange={(event) => setDate(event.target.value)} /><select aria-label="Filter by action" value={action} onChange={(event) => setAction(event.target.value)}><option value="">All actions</option>{[...new Set(logs.map((log) => log.action))].map((item) => <option key={item} value={item}>{item}</option>)}</select><input aria-label="Search audit logs" type="search" placeholder="Search actor or entity..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><button className="quiet-button" type="button" onClick={() => void load()}>Refresh</button></div>{isLoading ? <div className="alert loading-alert" role="status">Loading audit logs...</div> : <div className="table-scroll" role="region" aria-label="Audit log table" tabIndex={0}><table className="data-table"><thead><tr><th>Timestamp</th><th>Actor</th><th>Action</th><th>Entity</th><th>Result</th></tr></thead><tbody>{filteredLogs.map((log) => <tr key={log.id}><td>{new Date(log.createdAt).toLocaleString()}</td><td>{log.actorDisplayName || log.actorUserId || 'System'}</td><td><strong>{log.action}</strong></td><td>{log.entityType} ({log.entityId.substring(0, 8)}...)</td><td><span className={`chip ${log.result.toUpperCase() === 'SUCCESS' ? 'status-approved' : 'status-rejected'}`}>{log.result}</span></td></tr>)}{filteredLogs.length === 0 && <tr><td className="table-empty" colSpan={5}>No audit logs match the current filters.</td></tr>}</tbody></table></div>}</div>
    </div>
  );
}
