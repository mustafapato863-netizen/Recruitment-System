import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import type { ImportJobSummary, ImportRowDecision, ImportRowItem } from '@recruitflow/contracts';
import { getApi, postApi } from '../api/client';
import { Icon } from '../components/Icon';

type ImportRowsResponse = {
  rows: ImportRowItem[];
  total: number;
  page: number;
  pageSize: number;
};

const PAGE_SIZE = 50;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

export function ImportPreviewPage() {
  const location = useLocation();
  const { jobId: routeJobId } = useParams<{ jobId: string }>();
  const jobId = routeJobId ?? new URLSearchParams(location.search).get('jobId');
  const [summary, setSummary] = useState<ImportJobSummary | null>(null);
  const [rows, setRows] = useState<ImportRowItem[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterResult, setFilterResult] = useState('All');
  const [loading, setLoading] = useState(Boolean(jobId));
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadJob = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      const resultQuery = filterResult === 'All' ? '' : `&result=${encodeURIComponent(filterResult)}`;
      const [job, rowResponse] = await Promise.all([
        getApi<ImportJobSummary>(`/candidates/import/${jobId}`),
        getApi<ImportRowsResponse>(`/candidates/import/${jobId}/rows?page=${page}&pageSize=${PAGE_SIZE}${resultQuery}`),
      ]);
      setSummary(job);
      setRows(rowResponse.rows);
      setTotalRows(rowResponse.total);
    } catch (reason: unknown) {
      setError(getErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [filterResult, jobId, page]);

  useEffect(() => {
    void loadJob();
  }, [loadJob]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    const candidate = `${row.firstName ?? ''} ${row.lastName ?? ''}`.toLowerCase();
    const email = row.email?.toLowerCase() ?? '';
    return candidate.includes(searchTerm.toLowerCase()) || email.includes(searchTerm.toLowerCase());
  }), [rows, searchTerm]);

  const handleDecision = async (rowId: string, decision: ImportRowDecision) => {
    if (!jobId) return;
    setWorking(true);
    setError(null);
    try {
      await postApi(`/candidates/import/${jobId}/rows/${rowId}/decision`, { decision });
      setActionMessage('Duplicate decision saved.');
      await loadJob();
    } catch (reason: unknown) {
      setError(getErrorMessage(reason));
    } finally {
      setWorking(false);
    }
  };

  const handleConfirm = async () => {
    if (!jobId) return;
    setWorking(true);
    setError(null);
    try {
      await postApi(`/candidates/import/${jobId}/confirm`);
      setActionMessage('Import confirmed. Candidate records are now up to date.');
      await loadJob();
    } catch (reason: unknown) {
      setError(getErrorMessage(reason));
    } finally {
      setWorking(false);
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
      <div className="page-container animated-page">
        <div className="page-header"><div><h1 className="page-title">Candidate Import Review</h1><p className="page-subtitle">No import batch was selected.</p></div></div>
        <div className="card intake-empty">
          <Icon name="document" size={28} />
          <strong>Start from Candidate and CV Intake</strong>
          <span>Select a CSV file to create a controlled import batch first.</span>
          <Link className="button button-primary" to="/cv-intake">Go to CV Intake</Link>
        </div>
      </div>
    );
  }

  if (loading && !summary) {
    return <div className="page-container"><div className="card intake-empty">Loading import results...</div></div>;
  }

  if (!summary) {
    return <div className="page-container"><div className="alert error">Failed to load import results: {error}</div></div>;
  }

  const unresolvedDuplicates = summary.unresolvedDuplicateRows ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const isConfirmed = summary.status === 'Confirmed';

  return (
    <div className="page-container animated-page">
      <div className="page-header">
        <div>
          <Link className="page-back-link" to="/cv-intake">Back to CV Intake</Link>
          <h1 className="page-title">Candidate Import Review</h1>
          <p className="page-subtitle">{summary.fileName} · {summary.status}</p>
        </div>
        <div className="page-actions">
          <button className="button button-secondary" onClick={() => void downloadErrorReport()} type="button"><Icon name="download" size={16} /> Download Error Report</button>
          <button className="button button-primary" disabled={working || unresolvedDuplicates > 0 || summary.status !== 'Review'} onClick={() => void handleConfirm()} type="button">
            {isConfirmed ? 'Import Confirmed' : working ? 'Working...' : 'Confirm Batch'}
          </button>
        </div>
      </div>

      <ol aria-label="Import progress" className="intake-lifecycle intake-lifecycle-compact">
        {[
          ['1', 'Uploaded', true],
          ['2', 'Validated', true],
          ['3', 'Duplicates resolved', unresolvedDuplicates === 0],
          ['4', 'Confirmed', isConfirmed],
        ].map(([number, title, complete]) => (
          <li className={complete ? 'complete' : ''} key={String(title)}>
            <span>{complete ? <Icon name="check" size={15} /> : number}</span><div><strong>{title}</strong></div>
          </li>
        ))}
      </ol>

      {error && <div className="alert error" role="alert">{error}</div>}
      {actionMessage && <div className="alert success" role="status">{actionMessage}</div>}
      {unresolvedDuplicates > 0 && <div className="alert warning"><Icon name="alert-triangle" size={18} /> Resolve {unresolvedDuplicates} duplicate {unresolvedDuplicates === 1 ? 'row' : 'rows'} before confirming the import.</div>}

      <div className="metrics-grid">
        {[
          ['Total Rows', summary.totalRows],
          ['Valid', summary.validRows],
          ['Invalid', summary.invalidRows],
          ['Duplicates', summary.duplicateRows],
          ['New Candidates', summary.newRows],
          ['Updates', summary.updateRows],
        ].map(([label, value]) => <div className="metric-card" key={label}><div className="metric-label">{label}</div><div className="metric-value">{value}</div></div>)}
      </div>

      <div className="card">
        <div className="toolbar">
          <input aria-label="Search current import page" onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search this page by name or email..." type="search" value={searchTerm} />
          <select aria-label="Filter import results" onChange={(event) => { setFilterResult(event.target.value); setPage(1); }} value={filterResult}>
            <option value="All">All Results</option><option value="Valid">Valid Only</option><option value="Invalid">Invalid Only</option><option value="Duplicate">Duplicates Only</option>
          </select>
        </div>
        <div className="table-responsive">
          <table className="request-table">
            <thead><tr><th>Row</th><th>Candidate</th><th>Email</th><th>Phone</th><th>Result</th><th>Details</th><th>Decision</th></tr></thead>
            <tbody>
              {filteredRows.length === 0 ? <tr><td colSpan={7} className="table-empty-cell">No rows match the current filters.</td></tr> : filteredRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.rowNumber}</td>
                  <td>{`${row.firstName ?? ''} ${row.lastName ?? ''}`.trim() || 'Not provided'}</td>
                  <td>{row.email ?? 'Not provided'}</td>
                  <td>{row.phone ?? 'Not provided'}</td>
                  <td><span className="badge badge-neutral">{row.result}</span></td>
                  <td>{row.details ?? 'No issues'}</td>
                  <td>{row.result === 'Duplicate' ? (
                    <select aria-label={`Decision for row ${row.rowNumber}`} disabled={working || isConfirmed} onChange={(event) => void handleDecision(row.id, event.target.value as ImportRowDecision)} value={row.decision ?? ''}>
                      <option value="">Choose</option><option value="Update">Update existing</option><option value="Skip">Skip row</option><option value="KeepBoth">Keep both</option>
                    </select>
                  ) : 'Not required'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="intake-pagination">
          <span>Page {page} of {totalPages} · {totalRows} rows</span>
          <div>
            <button className="button button-secondary button-small" disabled={page === 1 || loading} onClick={() => setPage((current) => current - 1)} type="button">Previous</button>
            <button className="button button-secondary button-small" disabled={page === totalPages || loading} onClick={() => setPage((current) => current + 1)} type="button">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
