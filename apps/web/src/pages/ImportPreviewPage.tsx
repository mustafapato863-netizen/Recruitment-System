import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import type { ImportJobSummary, ImportRowDecision, ImportRowItem } from '@recruitflow/contracts';
import { getApi, postApi } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { DataTable, dataTableClasses } from '../components/ui/DataTable';
import { Input } from '../components/ui/Input';
import { MetricCard } from '../components/ui/MetricCard';
import { Pagination } from '../components/ui/Pagination';
import { PipelineStepper } from '../components/PipelineStepper';
import { Icon } from '../components/Icon';
import './PageEnhancementsV2.css';

type ImportRowsResponse = {
  rows: ImportRowItem[];
  total: number;
  page: number;
  pageSize: number;
};

const PAGE_SIZE = 50;
const IMPORT_STEPS = ['Upload File', 'Validate & Resolve', 'Confirm & Import'];

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
        ...invalidRows.map((r) => `${r.rowNumber},"${r.firstName || ''}","${r.lastName || ''}","${r.email || ''}","${r.phone || ''}","${r.details || ''}"`),
      ].join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `import-errors-${jobId}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (reason: unknown) {
      setError(getErrorMessage(reason));
    }
  };

  if (!jobId) {
    return (
      <PageFrame eyebrow="CV & Candidate Intake" title="Import Review" description="Select an import batch to review candidates.">
        <PageState kind="empty" title="No import batch selected" description="Go to the CV Intake page to upload or select a batch.">
          <Button variant="primary" size="sm" asChild>
            <Link to="/cv-intake">
              <Icon name="cv" size={14} />
              Go to CV Intake
            </Link>
          </Button>
        </PageState>
      </PageFrame>
    );
  }

  if (loading && !summary) {
    return (
      <PageFrame eyebrow="CV & Candidate Intake" title="Import Review" description="Loading batch...">
        <PageState kind="loading" title="Loading import data" description="Fetching validated candidate rows." />
      </PageFrame>
    );
  }

  const unhandledDuplicates = summary?.duplicateRows ? summary.duplicateRows : 0;
  const isConfirmed = summary?.status === 'Confirmed' || summary?.status === 'Completed';

  return (
    <PageFrame
      eyebrow="CV & Candidate Intake"
      title={`Import Candidates · ${summary?.fileName || 'Batch'}`}
      description="Validate rows, normalize identifiers, resolve duplicates and import only confirmed records."
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={() => void downloadErrorReport()}>
            <Icon name="download" size={13} />
            Download error report
          </Button>
          {isConfirmed ? (
            <Button variant="primary" size="sm" asChild>
              <Link to="/candidates">
                <Icon name="users" size={14} />
                View Candidates
              </Link>
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              disabled={working || unhandledDuplicates > 0}
              loading={working}
              loadingLabel="Confirming"
              onClick={() => void handleConfirm()}
            >
              <Icon name="check-circle" size={14} />
              Confirm {summary?.validRows ?? 0} records
            </Button>
          )}
        </>
      }
    >
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
        <PipelineStepper steps={IMPORT_STEPS} currentStep={isConfirmed ? 2 : 1} />
      </div>

      {error && !isConfirmed && (
        <Alert
          tone="danger"
          title="Review attention"
          action={
            <Button variant="secondary" size="sm" onClick={() => void loadJob()}>
              <Icon name="refresh-cw" size={13} />
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {isConfirmed && (
        <Alert tone="success" title="Import Completed Successfully">
          Candidate records from <strong>{summary?.fileName}</strong> have been parsed and synced to your organization's talent database.
        </Alert>
      )}

      {actionMessage && !isConfirmed && (
        <Alert tone="success" title="Success">
          {actionMessage}
        </Alert>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <MetricCard label="Total Rows" value={summary?.totalRows || 0} detail={summary?.fileName || 'Batch.csv'} tone="action" icon={<Icon name="folder" size={14} />} />
        <MetricCard label="Valid Rows" value={summary?.validRows || 0} detail="Ready for import" tone="success" icon={<Icon name="check-circle" size={14} />} />
        <MetricCard label="Invalid Rows" value={summary?.invalidRows || 0} detail="Errors identified" tone="danger" icon={<Icon name="alert-triangle" size={14} />} />
        <MetricCard label="Duplicates" value={summary?.duplicateRows || 0} detail="Need review" tone="warning" icon={<Icon name="copy" size={14} />} />
        <MetricCard label="Batch Status" value={summary?.status || 'Validating'} detail="Current pipeline state" tone="info" icon={<Icon name="clock" size={14} />} />
        <MetricCard label="Confirmed" value={isConfirmed ? 'Yes' : 'Pending'} detail="Database sync" tone={isConfirmed ? 'success' : 'neutral'} icon={<Icon name="refresh-cw" size={14} />} />
      </div>

      {unhandledDuplicates > 0 && !isConfirmed && (
        <Alert tone="warning" title={`${unhandledDuplicates} duplicate record(s) require a decision`}>
          Confirm Import will update existing candidates or link applications once each duplicate is reviewed.
        </Alert>
      )}

      <section className="rf-table-shell rf-long-content overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="w-full sm:w-72">
            <Input
              aria-label="Search records"
              placeholder="Search name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {['All', 'Valid', 'Invalid', 'Duplicate'].map((filter) => (
              <button
                key={filter}
                type="button"
                className={[
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer',
                  filterResult === filter
                    ? 'bg-blue-600 border-blue-600 text-white shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100',
                ].join(' ')}
                onClick={() => {
                  setFilterResult(filter);
                  setPage(1);
                }}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <DataTable role="region" aria-label="Import candidate rows table" tabIndex={0} className="rounded-none border-0 shadow-none">
          <thead className={dataTableClasses.head}>
            <tr>
              <th className={dataTableClasses.th}>Row</th>
              <th className={dataTableClasses.th}>Candidate</th>
              <th className={dataTableClasses.th}>Email</th>
              <th className={dataTableClasses.th}>Phone</th>
              <th className={dataTableClasses.th}>Result</th>
              <th className={dataTableClasses.th}>Details</th>
              <th className={dataTableClasses.th}>Decision</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <PageState kind="empty" title="No matching candidate rows" description="Adjust your search or filter criteria." />
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr className={dataTableClasses.row} key={row.id}>
                  <td className={dataTableClasses.td}>
                    <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                      #{row.rowNumber}
                    </span>
                  </td>
                  <td className={dataTableClasses.td}>
                    <div className={dataTableClasses.primary}>{`${row.firstName ?? ''} ${row.lastName ?? ''}`.trim() || 'Missing Name'}</div>
                    {(row.currentTitle || row.experienceYears || row.currentCompany) && (
                      <div className="text-[11px] text-rf-ink-muted font-medium mt-0.5 flex items-center gap-1.5 flex-wrap">
                        {row.currentTitle && <span className="font-semibold text-rf-action">{row.currentTitle}</span>}
                        {row.currentCompany && <span>· {row.currentCompany}</span>}
                        {row.experienceYears !== null && row.experienceYears !== undefined && (
                          <span className="text-rf-ink-muted">({row.experienceYears}y exp)</span>
                        )}
                      </div>
                    )}
                    {row.skills && row.skills.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {row.skills.slice(0, 3).map((s) => (
                          <span key={s} className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-rf-surface-subtle text-rf-ink">
                            {s}
                          </span>
                        ))}
                        {row.skills.length > 3 && (
                          <span className="text-[10px] text-rf-ink-muted font-medium">+{row.skills.length - 3}</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className={dataTableClasses.td}>
                    <span className="text-slate-600 font-medium text-xs">{row.email || 'Missing Email'}</span>
                  </td>
                  <td className={dataTableClasses.td}>
                    <span className="text-slate-600 font-medium text-xs">{row.phone || 'Not provided'}</span>
                  </td>
                  <td className={dataTableClasses.td}>
                    <StatusBadge status={row.result} />
                  </td>
                  <td className={dataTableClasses.td}>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {row.details || (row.result === 'Duplicate' ? 'Matched existing candidate' : 'New profile')}
                    </span>
                  </td>
                  <td className={dataTableClasses.td}>
                    {row.result === 'Duplicate' && !isConfirmed ? (
                      <div className="flex gap-1.5">
                        <Button
                          variant={row.decision === 'Update' ? 'primary' : 'secondary'}
                          size="sm"
                          disabled={working}
                          onClick={() => void handleDecision(row.id, 'Update')}
                        >
                          Update
                        </Button>
                        <Button
                          variant={row.decision === 'Skip' ? 'danger' : 'ghost'}
                          size="sm"
                          disabled={working}
                          onClick={() => void handleDecision(row.id, 'Skip')}
                        >
                          Skip
                        </Button>
                      </div>
                    ) : (
                      <span className="font-mono text-[11px] font-bold text-slate-500">
                        {row.decision || 'Automatic'}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </DataTable>

        {totalRows > PAGE_SIZE && (
          <Pagination
            ariaLabel="Import preview pages"
            currentPage={page}
            totalPages={Math.ceil(totalRows / PAGE_SIZE)}
            onPageChange={setPage}
            disabled={loading}
            summary={`${totalRows} total rows`}
          />
        )}
      </section>
    </PageFrame>
  );
}
