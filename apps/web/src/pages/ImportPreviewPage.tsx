import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getApi, postApi } from '../api/client';
import { Icon } from '../components/Icon';
import type { ImportJobSummary, ImportRowDecision, ImportRowItem } from '@recruitflow/contracts';

type ImportRowsResponse = {
  rows: ImportRowItem[];
  total: number;
  page: number;
  pageSize: number;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

export function ImportPreviewPage() {
  const location = useLocation();
  const jobId = new URLSearchParams(location.search).get('jobId');
  const [summary, setSummary] = useState<ImportJobSummary | null>(null);
  const [rows, setRows] = useState<ImportRowItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterResult, setFilterResult] = useState('All');
  const [loading, setLoading] = useState(Boolean(jobId));
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadJob = async () => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      const [job, rowResponse] = await Promise.all([
        getApi<ImportJobSummary>(`/candidates/import/${jobId}`),
        getApi<ImportRowsResponse>(`/candidates/import/${jobId}/rows?pageSize=100`),
      ]);
      setSummary(job);
      setRows(rowResponse.rows);
    } catch (reason: unknown) {
      setError(getErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadJob();
  }, [jobId]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    const candidate = `${row.firstName ?? ''} ${row.lastName ?? ''}`.toLowerCase();
    const email = row.email?.toLowerCase() ?? '';
    const matchesSearch = candidate.includes(searchTerm.toLowerCase()) || email.includes(searchTerm.toLowerCase());
    const matchesFilter = filterResult === 'All' || row.result === filterResult;
    return matchesSearch && matchesFilter;
  }), [filterResult, rows, searchTerm]);

  const handleDecision = async (rowId: string, decision: ImportRowDecision) => {
    if (!jobId) return;
    try {
      await postApi(`/candidates/import/${jobId}/rows/${rowId}/decision`, { decision });
      setActionMessage('Decision saved.');
      await loadJob();
    } catch (reason: unknown) {
      setError(getErrorMessage(reason));
    }
  };

  const handleConfirm = async () => {
    if (!jobId) return;
    try {
      await postApi(`/candidates/import/${jobId}/confirm`);
      setActionMessage('Import confirmed successfully.');
      await loadJob();
    } catch (reason: unknown) {
      setError(getErrorMessage(reason));
    }
  };

  const downloadErrorReport = async () => {
    if (!jobId) return;
    try {
      const invalidRows = await getApi<ImportRowItem[]>(`/candidates/import/${jobId}/error-report`);
      const csv = [
        'Row,First name,Last name,Email,Phone,Details',
        ...invalidRows.map((row) => [
          row.rowNumber,
          row.firstName ?? '',
          row.lastName ?? '',
          row.email ?? '',
          row.phone ?? '',
          row.details ?? '',
        ].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')),
      ].join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${summary?.fileName ?? 'import-errors'}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (reason: unknown) {
      setError(getErrorMessage(reason));
    }
  };

  if (!jobId) {
    return (
      <div className="page-container">
        <div className="page-header"><div><h1 className="page-title">Import Candidates · Review Results</h1><p className="page-subtitle">No import job selected.</p></div></div>
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <Icon name="document" size={28} color="var(--muted)" />
          <h2>Start with an import job</h2>
          <p style={{ color: 'var(--muted)' }}>Upload a candidate file first, then open this page with its job ID to review real validation results.</p>
        </div>
      </div>
    );
  }

  if (loading) return <div className="page-container"><div className="card" style={{ padding: '2rem' }}>Loading import results...</div></div>;
  if (error) return <div className="page-container"><div className="alert error">Failed to load import results: {error}</div></div>;

  const hasUnresolvedDuplicates = rows.some((row) => row.result === 'Duplicate' && !row.decision);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Import Candidates · Review Results</h1>
          <p className="page-subtitle">{summary?.fileName} · job {jobId}</p>
        </div>
        <div className="page-actions">
          <button className="button button-secondary" onClick={downloadErrorReport}><Icon name="download" size={16} /> Download Error Report</button>
          <button className="button button-primary" onClick={handleConfirm} disabled={hasUnresolvedDuplicates || summary?.status !== 'Review'}>
            Confirm {summary?.validRows ?? 0} Records
          </button>
        </div>
      </div>

      {actionMessage && <div className="alert success">{actionMessage}</div>}
      {hasUnresolvedDuplicates && <div className="alert warning"><Icon name="alert-triangle" size={18} /> Resolve duplicate rows before confirming the import.</div>}

      <div className="metrics-grid">
        {[
          ['Total Rows', summary?.totalRows ?? 0],
          ['Valid', summary?.validRows ?? 0],
          ['Invalid', summary?.invalidRows ?? 0],
          ['Duplicates', summary?.duplicateRows ?? 0],
          ['New Candidates', summary?.newRows ?? 0],
          ['Updates', summary?.updateRows ?? 0],
        ].map(([label, value]) => <div className="metric-card" key={label}><div className="metric-label">{label}</div><div className="metric-value">{value}</div></div>)}
      </div>

      <div className="card">
        <div className="toolbar">
          <input type="search" placeholder="Search candidate name or email..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
          <select value={filterResult} onChange={(event) => setFilterResult(event.target.value)}>
            <option value="All">All Results</option><option value="Valid">Valid Only</option><option value="Invalid">Invalid Only</option><option value="Duplicate">Duplicates Only</option>
          </select>
        </div>
        <div className="table-responsive">
          <table className="request-table"><thead><tr><th>Row</th><th>Candidate</th><th>Email</th><th>Phone</th><th>Result</th><th>Details</th><th>Decision</th></tr></thead>
            <tbody>{filteredRows.length === 0 ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>No rows match the current filters.</td></tr> : filteredRows.map((row) => (
              <tr key={row.id}><td>{row.rowNumber}</td><td>{`${row.firstName ?? ''} ${row.lastName ?? ''}`.trim() || '—'}</td><td>{row.email ?? '—'}</td><td>{row.phone ?? '—'}</td><td><span className="badge badge-neutral">{row.result}</span></td><td>{row.details ?? '—'}</td><td>{row.result === 'Duplicate' ? <select value={row.decision ?? ''} onChange={(event) => void handleDecision(row.id, event.target.value as ImportRowDecision)}><option value="">Choose</option><option value="Update">Update</option><option value="Skip">Skip</option><option value="KeepBoth">Keep both</option></select> : '—'}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
