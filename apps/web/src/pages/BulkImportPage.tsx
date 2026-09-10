import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import type {
  BulkImportDataset,
  BulkImportInspectResult,
  BulkImportRowItem,
  ImportJobSummary,
} from '@recruitflow/contracts';
import { ApiError, downloadApi, getApi, postApi, postFormDataApi } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { DataTable, dataTableClasses } from '../components/ui/DataTable';
import { MetricCard } from '../components/ui/MetricCard';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { Pagination } from '../components/ui/Pagination';
import { Select } from '../components/ui/Select';
import { StatusBadge } from '../components/StatusBadge';
import { Icon } from '../components/Icon';
import { saveBlob } from '../utils/download';
import './PageEnhancementsV2.css';

const PAGE_SIZE = 50;
const MASTER_DATASETS: BulkImportDataset[] = ['branches', 'positions', 'departments', 'skills', 'candidate-sources', 'interview-types'];

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'The import operation could not be completed.';
}

function datasetLabel(dataset: BulkImportDataset): string {
  switch (dataset) {
    case 'candidates': return 'Candidate database';
    case 'vacancy-requests': return 'Vacancy requests';
    case 'branches': return 'Branches';
    case 'positions': return 'Positions';
    case 'departments': return 'Departments';
    case 'skills': return 'Skills';
    case 'candidate-sources': return 'Candidate sources';
    case 'interview-types': return 'Interview types';
  }
}

function endpoint(dataset: BulkImportDataset): string {
  return dataset === 'candidates' ? 'candidates' : dataset === 'vacancy-requests' ? 'vacancy-requests' : `master-data/${dataset}`;
}

function safeValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function BulkImportLandingPage() {
  const { user } = useAuth();
  const [dataset, setDataset] = useState<BulkImportDataset>(user?.permissions.includes('CANDIDATE_CREATE') ? 'candidates' : user?.permissions.includes('VACANCY_REQUEST_CREATE') ? 'vacancy-requests' : 'branches');
  const [file, setFile] = useState<File | null>(null);
  const [inspect, setInspect] = useState<BulkImportInspectResult | null>(null);
  const [sheetName, setSheetName] = useState('');
  const [jobs, setJobs] = useState<ImportJobSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const canCandidates = Boolean(user?.permissions.includes('CANDIDATE_CREATE'));
  const canVacancies = Boolean(user?.permissions.includes('VACANCY_REQUEST_CREATE'));
  const canMasterData = Boolean(user?.permissions.includes('MASTER_DATA_MANAGE'));

  const loadJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      let result: { data: ImportJobSummary[] };
      try {
        result = await getApi<{ data: ImportJobSummary[] }>(`/imports/${endpoint(dataset)}/jobs?page=1&pageSize=8`);
      } catch (reason) {
        // Older local API processes may still expose only the original candidate import route.
        // Keep history readable while the current API build is being restarted; uploads still
        // use the strict new endpoint and will surface an actionable error if it is unavailable.
        if (dataset !== 'candidates' || !(reason instanceof ApiError) || reason.statusCode !== 404) throw reason;
        result = await getApi<{ data: ImportJobSummary[] }>('/candidates/import/jobs?page=1&pageSize=8');
      }
      setJobs(result.data);
    } catch (reason) {
      setError(messageFrom(reason));
    } finally {
      setLoadingJobs(false);
    }
  }, [dataset]);

  useEffect(() => { void loadJobs(); }, [loadJobs]);

  const inspectFile = async (nextFile: File) => {
    setFile(nextFile);
    setInspect(null);
    setSheetName('');
    setError(null);
    setMessage(null);
    const body = new FormData();
    body.append('file', nextFile);
    setLoading(true);
    try {
      const result = await postFormDataApi<BulkImportInspectResult>(`/imports/${endpoint(dataset)}/inspect`, body);
      setInspect(result);
      setSheetName(result.sheets[0]?.name ?? '');
    } catch (reason) {
      setError(messageFrom(reason));
    } finally {
      setLoading(false);
    }
  };

  const upload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    const body = new FormData();
    body.append('file', file);
    try {
      const result = await postFormDataApi<{ jobId: string }>(
        `/imports/${endpoint(dataset)}/upload${sheetName ? `?sheetName=${encodeURIComponent(sheetName)}` : ''}`,
        body,
      );
      setMessage('Workbook validated and staged. Review the rows before importing them.');
      // The import landing route and review route intentionally share the /import prefix.
      // A hard navigation guarantees the review screen is loaded even when an older
      // React Router runtime keeps the parent route mounted after a mutation.
      window.location.assign(`/import/${dataset}/${result.jobId}`);
    } catch (reason) {
      setError(messageFrom(reason));
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const blob = await downloadApi(`/imports/${endpoint(dataset)}/template`);
      saveBlob(blob, `recruitflow-${dataset}-template.xlsx`);
    } catch (reason) {
      setError(messageFrom(reason));
    }
  };

  return (
    <PageFrame
      eyebrow="Data Operations"
      title="Bulk Import Center"
      description="Load candidates, vacancy requests, and controlled master data from Excel, validate them, resolve issues, then confirm changes with an audit trail."
      actions={
        <Button variant="ghost" size="sm" onClick={() => void downloadTemplate()}>
          <Icon name="download" size={14} />
          Download template
        </Button>
      }
    >
      {error && <Alert tone="danger" title="Import attention">{error}</Alert>}
      {message && <Alert tone="success" title="Import staged">{message}</Alert>}
      {dataset === 'positions' && <Alert tone="info" title="VL Rowdata supported">Choose the <strong>Rowdata</strong> worksheet. Position titles are matched without case or whitespace differences, and Department Name is created once when needed.</Alert>}

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <MetricCard label="Selected dataset" value={datasetLabel(dataset)} detail="Use a matching template" tone="action" icon={<Icon name="database" size={14} />} />
        <MetricCard label="File status" value={file ? (inspect ? 'Inspected' : 'Selected') : 'Not selected'} detail="Values only; formulas are rejected" tone={inspect ? 'success' : 'neutral'} icon={<Icon name="file-text" size={14} />} />
        <MetricCard label="Recent batches" value={jobs.length} detail="Your latest import jobs" tone="info" icon={<Icon name="history" size={14} />} />
      </div>

      <section className="rf-panel rounded-2xl border border-rf-border-subtle bg-rf-surface p-5 shadow-xs sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="m-0 text-base font-extrabold text-rf-ink">Choose what you are importing</h2>
            <p className="mt-1 text-xs font-medium text-rf-ink-muted">Master-data rows use automatic codes when omitted; existing records are never changed without an explicit update decision.</p>
          </div>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Import dataset">
            {canCandidates && (
              <Button variant={dataset === 'candidates' ? 'primary' : 'secondary'} size="sm" onClick={() => { setDataset('candidates'); setFile(null); setInspect(null); }} role="tab" aria-selected={dataset === 'candidates'}>
                <Icon name="users" size={14} /> Candidates
              </Button>
            )}
            {canVacancies && (
              <Button variant={dataset === 'vacancy-requests' ? 'primary' : 'secondary'} size="sm" onClick={() => { setDataset('vacancy-requests'); setFile(null); setInspect(null); }} role="tab" aria-selected={dataset === 'vacancy-requests'}>
                <Icon name="briefcase" size={14} /> Vacancy requests
              </Button>
            )}
            {canMasterData && (
              <>
                {(['branches', 'positions'] as const).map((masterDataset) => (
                  <Button key={masterDataset} variant={dataset === masterDataset ? 'primary' : 'secondary'} size="sm" onClick={() => { setDataset(masterDataset); setFile(null); setInspect(null); setError(null); }} role="tab" aria-selected={dataset === masterDataset}>
                    <Icon name={masterDataset === 'branches' ? 'building' : 'briefcase'} size={14} /> {datasetLabel(masterDataset)}
                  </Button>
                ))}
              </>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <label className="rf-upload-dropzone flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-rf-action/35 bg-rf-action-soft/20 p-6 text-center">
            <input
              className="sr-only"
              type="file"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              onChange={(event) => {
                const selected = event.target.files?.[0];
                event.currentTarget.value = '';
                if (selected) void inspectFile(selected);
              }}
            />
            <Icon name={loading ? 'refresh-cw' : 'upload'} size={28} className={loading ? 'animate-spin text-rf-action' : 'text-rf-action'} />
            <strong className="mt-3 text-sm font-extrabold text-rf-ink">{file ? file.name : 'Choose an Excel workbook or CSV'}</strong>
            <span className="mt-1 max-w-md text-xs font-medium text-rf-ink-muted">Up to 25 MB and 25,000 rows. Use the matching template; formulas are rejected for safety.</span>
          </label>

          <div className="grid content-start gap-3 rounded-2xl border border-rf-border-subtle bg-rf-surface-subtle p-4">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-rf-ink-muted">Validation flow</span>
              <ol className="mt-2 grid gap-2 text-xs font-semibold text-rf-ink">
                <li><Badge variant="neutral">1</Badge> Upload and inspect worksheet</li>
                <li><Badge variant="neutral">2</Badge> Resolve missing fields and duplicates</li>
                <li><Badge variant="neutral">3</Badge> Confirm the staged records</li>
              </ol>
            </div>
            {inspect && inspect.sheets.length > 1 && (
              <Select aria-label="Select worksheet" value={sheetName} onChange={(event) => setSheetName(event.target.value)}>
                {inspect.sheets.map((sheet) => <option key={sheet.name} value={sheet.name}>{sheet.name} · {sheet.rowCount} rows</option>)}
              </Select>
            )}
            {inspect?.warnings.map((warning) => <Alert key={warning} tone="warning" title="Workbook note">{warning}</Alert>)}
            <Button variant="primary" size="sm" disabled={!file || !inspect || loading} loading={loading} loadingLabel="Staging" onClick={() => void upload()}>
              <Icon name="check-circle" size={14} /> Stage for review
            </Button>
          </div>
        </div>
      </section>

      <section className="rf-table-shell overflow-hidden rounded-2xl border border-rf-border bg-rf-surface shadow-xs">
        <div className="flex items-center justify-between border-b border-rf-border-subtle p-4">
          <div>
            <h2 className="m-0 text-sm font-extrabold text-rf-ink">Recent {datasetLabel(dataset).toLowerCase()} batches</h2>
            <p className="mt-0.5 text-xs font-medium text-rf-ink-muted">Open a batch to review rows and confirm it.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void loadJobs()} disabled={loadingJobs}><Icon name="refresh-cw" size={13} /> Refresh</Button>
        </div>
        {loadingJobs ? <PageState kind="loading" title="Loading import history" description="Fetching recent batches." /> : jobs.length === 0 ? <PageState kind="empty" title="No import batches yet" description="Upload your first candidate database or vacancy workbook above." /> : (
          <DataTable role="region" aria-label="Import history" tabIndex={0}>
            <thead className={dataTableClasses.head}><tr><th className={dataTableClasses.th}>Workbook</th><th className={dataTableClasses.th}>Rows</th><th className={dataTableClasses.th}>Issues</th><th className={dataTableClasses.th}>Status</th><th className={dataTableClasses.th}>Action</th></tr></thead>
            <tbody>{jobs.map((job) => <tr className={dataTableClasses.row} key={job.id}>
              <td className={dataTableClasses.td}><strong className={dataTableClasses.primary}>{job.fileName}</strong><span className={dataTableClasses.secondary}>{job.sheetName || 'Default worksheet'} · {new Date(job.createdAt).toLocaleString()}</span></td>
              <td className={dataTableClasses.td}><span className="font-bold text-rf-ink">{job.totalRows}</span></td>
              <td className={dataTableClasses.td}><Badge variant={job.invalidRows + job.duplicateRows > 0 ? 'warning' : 'success'}>{job.invalidRows + job.duplicateRows}</Badge></td>
              <td className={dataTableClasses.td}><StatusBadge status={job.status} /></td>
              <td className={dataTableClasses.td}><Button variant="secondary" size="sm" asChild><Link to={`/import/${dataset}/${job.id}`}>Review</Link></Button></td>
            </tr>)}</tbody>
          </DataTable>
        )}
      </section>
    </PageFrame>
  );
}

function BulkImportReviewPage({ dataset, jobId }: { dataset: BulkImportDataset; jobId: string }) {
  const navigate = useNavigate();
  const isMasterData = MASTER_DATASETS.includes(dataset);
  const [summary, setSummary] = useState<ImportJobSummary | null>(null);
  const [rows, setRows] = useState<BulkImportRowItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [job, result] = await Promise.all([
        getApi<ImportJobSummary>(`/imports/${endpoint(dataset)}/jobs/${jobId}`),
        getApi<{ rows: BulkImportRowItem[]; total: number }>(`/imports/${endpoint(dataset)}/jobs/${jobId}/rows?page=${page}&pageSize=${PAGE_SIZE}`),
      ]);
      setSummary(job);
      setRows(result.rows);
      setTotal(result.total);
      setError(null);
    } catch (reason) {
      setError(messageFrom(reason));
    } finally {
      setLoading(false);
    }
  }, [dataset, jobId, page]);

  useEffect(() => { void load(); }, [load]);

  const unresolved = summary?.unresolvedDuplicateRows ?? summary?.duplicateRows ?? 0;
  const confirmed = summary?.status === 'Confirmed' || summary?.status === 'Completed';

  const confirm = async () => {
    setWorking(true);
    setError(null);
    try {
      await postApi(`/imports/${endpoint(dataset)}/jobs/${jobId}/confirm`);
      setMessage(dataset === 'vacancy-requests' ? 'Draft vacancy requests created. They must continue through approval before becoming vacancies.' : dataset === 'candidates' ? 'Candidate records imported successfully.' : 'Master-data records imported and audited successfully.');
      await load();
    } catch (reason) {
      setError(messageFrom(reason));
    } finally {
      setWorking(false);
    }
  };

  const decide = async (rowId: string, decision: 'Import' | 'Skip' | 'Update') => {
    setWorking(true);
    try {
      await postApi(`/imports/${endpoint(dataset)}/jobs/${jobId}/rows/${rowId}/decision/${decision}`);
      await load();
    } catch (reason) {
      setError(messageFrom(reason));
    } finally {
      setWorking(false);
    }
  };

  const downloadErrors = async () => {
    try {
      const workbook = await downloadApi(`/imports/${endpoint(dataset)}/jobs/${jobId}/error-report`);
      saveBlob(workbook, `recruitflow-${dataset}-import-errors-${jobId}.xlsx`);
    } catch (reason) {
      setError(messageFrom(reason));
    }
  };

  const visibleColumns = useMemo(() => {
    if (dataset === 'candidates') return ['firstName', 'lastName', 'email', 'currentTitle', 'location'];
    if (dataset === 'vacancy-requests') return ['externalVacancyCode', 'positionCode', 'positionTitle', 'branchCode', 'requestedHeadcount'];
    if (dataset === 'branches') return ['code', 'name', 'country', 'city', 'status'];
    if (dataset === 'departments') return ['code', 'name', 'branchCode', 'branchName', 'status'];
    if (dataset === 'skills') return ['code', 'name', 'category', 'description', 'status'];
    if (dataset === 'candidate-sources') return ['code', 'name', 'type', 'status'];
    if (dataset === 'interview-types') return ['code', 'name', 'defaultDuration', 'status'];
    return ['code', 'title', 'departmentName', 'level', 'entity', 'type', 'description', 'status'];
  }, [dataset]);

  if (loading && !summary) return <PageFrame eyebrow="Data Operations" title="Import Review" description="Loading staged rows..."><PageState kind="loading" title="Loading import batch" description="Fetching validation results." /></PageFrame>;
  if (error && !summary) return <PageFrame eyebrow="Data Operations" title="Import Review" description="The batch could not be loaded."><Alert tone="danger" title="Import unavailable">{error}</Alert></PageFrame>;

  return (
    <PageFrame
      eyebrow={`Data Operations / ${datasetLabel(dataset)}`}
      title={`Review ${summary?.fileName ?? 'import batch'}`}
      description={dataset === 'vacancy-requests'
        ? 'Review rows before creating draft vacancy requests. Approval is still required before a vacancy becomes active.'
        : dataset === 'candidates'
          ? 'Review and confirm the candidate database rows before they become authoritative records.'
          : 'Review master-data rows, resolve duplicates, and confirm controlled records with automatic code generation.'}
      actions={<>
        <Button variant="ghost" size="sm" onClick={() => void downloadErrors()}><Icon name="download" size={13} /> Error report</Button>
        <Button variant="secondary" size="sm" onClick={() => void navigate(isMasterData ? '/master-data' : '/import')}>{isMasterData ? 'Back to Master Data' : 'New import'}</Button>
        <Button variant="primary" size="sm" disabled={working || confirmed || unresolved > 0 || summary?.status !== 'Review'} loading={working} loadingLabel="Confirming" onClick={() => void confirm()}><Icon name="check-circle" size={13} /> Confirm import</Button>
      </>}
    >
      {error && <Alert tone="danger" title="Import attention">{error}</Alert>}
      {message && <Alert tone="success" title="Import completed">{message}</Alert>}
      {dataset === 'vacancy-requests' && <Alert tone="info" title="Approval-safe import">Rows become draft vacancy requests. Submit and approve them through Vacancy Requests before conversion to an opening.</Alert>}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <MetricCard label="Total rows" value={summary?.totalRows ?? 0} tone="action" />
        <MetricCard label="Valid" value={summary?.validRows ?? 0} tone="success" />
        <MetricCard label="Invalid" value={summary?.invalidRows ?? 0} tone="danger" />
        <MetricCard label="Duplicates" value={summary?.duplicateRows ?? 0} tone="warning" />
      </div>
      {unresolved > 0 && <Alert tone="warning" title={`${unresolved} duplicate row(s) need a decision`}>Resolve each duplicate before confirming the import.</Alert>}
      <section className="rf-table-shell overflow-hidden rounded-2xl border border-rf-border bg-rf-surface shadow-xs">
        <DataTable role="region" aria-label="Bulk import rows" tabIndex={0}>
          <thead className={dataTableClasses.head}><tr><th className={dataTableClasses.th}>Row</th>{visibleColumns.map((column) => <th className={dataTableClasses.th} key={column}>{column}</th>)}<th className={dataTableClasses.th}>Result</th><th className={dataTableClasses.th}>Details</th><th className={dataTableClasses.th}>Decision</th></tr></thead>
          <tbody>{rows.map((row) => <tr className={dataTableClasses.row} key={row.id}>
            <td className={dataTableClasses.td}><span className="font-mono text-xs text-rf-ink-muted">{row.rowNumber}</span></td>
            {visibleColumns.map((column) => <td className={dataTableClasses.td} key={column}><span className="text-xs font-semibold text-rf-ink">{safeValue(row.data[column])}</span></td>)}
            <td className={dataTableClasses.td}><StatusBadge status={row.result} /></td>
            <td className={dataTableClasses.td}><span className="text-xs text-rf-ink-muted">{row.details || 'Ready for review'}</span></td>
            <td className={dataTableClasses.td}>{row.result === 'Duplicate' && !confirmed ? <div className="flex flex-wrap gap-1.5">
              {(() => {
                const canUpdate = !isMasterData || Boolean(row.data.masterExistingId);
                if (!canUpdate) return null;
                const decision: 'Import' | 'Update' = isMasterData || dataset === 'candidates' ? 'Update' : 'Import';
                return <Button variant="primary" size="sm" disabled={working} onClick={() => void decide(row.id, decision)}>{decision}</Button>;
              })()}
              <Button variant="ghost" size="sm" disabled={working} onClick={() => void decide(row.id, 'Skip')}>Skip</Button>
            </div> : <span className="text-xs font-semibold text-rf-ink-muted">{row.decision || 'Automatic'}</span>}</td>
          </tr>)}</tbody>
        </DataTable>
        {rows.length === 0 && <PageState kind="empty" title="No rows to display" description="This import batch has no staged rows." />}
        {total > PAGE_SIZE && <Pagination ariaLabel="Import row pages" currentPage={page} totalPages={Math.ceil(total / PAGE_SIZE)} onPageChange={setPage} disabled={loading} summary={`${total} total rows`} />}
      </section>
    </PageFrame>
  );
}

export function BulkImportPage() {
  const { dataset: routeDataset, jobId } = useParams<{ dataset?: string; jobId?: string }>();
  const location = useLocation();
  const legacyJobId = new URLSearchParams(location.search).get('jobId');
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const routeDatasetValue = routeDataset ?? pathSegments[1];
  const supportedDatasets: BulkImportDataset[] = ['candidates', 'vacancy-requests', ...MASTER_DATASETS];
  const resolvedDataset = supportedDatasets.includes(routeDatasetValue as BulkImportDataset) ? routeDatasetValue : undefined;
  const resolvedJobId = jobId ?? (pathSegments[0] === 'import' && pathSegments.length >= 3 ? pathSegments[2] : undefined);
  const dataset: BulkImportDataset = (resolvedDataset as BulkImportDataset | undefined) ?? 'candidates';
  if (resolvedJobId) return <BulkImportReviewPage dataset={dataset} jobId={resolvedJobId} />;
  if (legacyJobId) return <BulkImportReviewPage dataset="candidates" jobId={legacyJobId} />;
  return <BulkImportLandingPage />;
}
