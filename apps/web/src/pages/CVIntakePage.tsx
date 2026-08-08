import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ImportJobSummary, PaginatedResult } from '@recruitflow/contracts';
import { getApi, postApi } from '../api/client';
import { Icon } from '../components/Icon';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';

type CandidateImportRow = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
};

type ParsedImport = {
  fileName: string;
  rows: CandidateImportRow[];
};

const REQUIRED_HEADERS = ['firstname', 'lastname', 'email'] as const;

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'An unexpected error occurred.';
}

function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const next = line[index + 1];
    if (character === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      values.push(value.trim());
      value = '';
    } else {
      value += character;
    }
  }

  values.push(value.trim());
  return values;
}

function parseCandidateCsv(fileName: string, text: string): ParsedImport {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('The CSV must include a header row and at least one candidate.');
  }

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const missing = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length > 0) {
    throw new Error('Required columns: First Name, Last Name, and Email. Phone is optional.');
  }

  const indexes = {
    firstName: headers.indexOf('firstname'),
    lastName: headers.indexOf('lastname'),
    email: headers.indexOf('email'),
    phone: headers.indexOf('phone'),
  };
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return {
      firstName: values[indexes.firstName]?.trim() || undefined,
      lastName: values[indexes.lastName]?.trim() || undefined,
      email: values[indexes.email]?.trim() || undefined,
      phone: indexes.phone >= 0 ? values[indexes.phone]?.trim() || undefined : undefined,
    };
  });

  if (rows.length > 5000) {
    throw new Error('A single batch can contain up to 5,000 candidates.');
  }

  return { fileName, rows };
}

function downloadTemplate() {
  const csv = 'First Name,Last Name,Email,Phone\nSara,Ahmed,sara.ahmed@example.com,+201000000000\n';
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'candidate-import-template.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

export function CVIntakePage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [jobs, setJobs] = useState<ImportJobSummary[]>([]);
  const [parsedImport, setParsedImport] = useState<ParsedImport | null>(null);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadJobs = async () => {
    setLoadingJobs(true);
    setError(null);
    try {
      const response = await getApi<PaginatedResult<ImportJobSummary>>('/candidates/import/jobs?page=1&pageSize=50');
      setJobs(response.data);
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    } finally {
      setLoadingJobs(false);
    }
  };

  useEffect(() => {
    void loadJobs();
  }, []);

  const previewRows = useMemo(() => parsedImport?.rows.slice(0, 5) ?? [], [parsedImport]);

  const handleFile = async (file?: File) => {
    if (!file) return;
    setError(null);
    setParsedImport(null);
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Choose a CSV file. PDF and DOCX intake is not enabled yet.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('The CSV file must be 5 MB or smaller.');
      return;
    }

    try {
      setParsedImport(parseCandidateCsv(file.name, await file.text()));
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    }
  };

  const startImport = async () => {
    if (!parsedImport) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await postApi<{ jobId: string }>('/candidates/import/upload', parsedImport);
      void navigate(`/cv-intake/${response.jobId}`);
    } catch (reason: unknown) {
      setError(errorMessage(reason));
      setSubmitting(false);
    }
  };

  return (
    <PageFrame className="animated-page" title="Candidate and CV Intake" description="Bring candidates into one controlled flow, review data quality, then confirm them into the talent database." actions={<Button variant="secondary" size="sm" onClick={downloadTemplate}><Icon name="download" size={16} /> Download CSV template</Button>}>

      <ol aria-label="Candidate intake lifecycle" className="intake-lifecycle">
        {[
          ['1', 'Upload', 'Select a structured CSV batch'],
          ['2', 'Validate', 'Check required data and duplicates'],
          ['3', 'Resolve', 'Decide how duplicates are handled'],
          ['4', 'Confirm', 'Create or update candidate records'],
        ].map(([number, title, description]) => (
          <li key={title}>
            <span>{number}</span>
            <div><strong>{title}</strong><small>{description}</small></div>
          </li>
        ))}
      </ol>

      {error && <Alert tone="danger" title="The intake needs your attention">{error}</Alert>}

      <div className="intake-capability-grid">
        <section className="card intake-upload-card">
          <div className="intake-card-heading">
            <span className="intake-icon"><Icon name="upload" size={22} /></span>
            <div>
              <h2>Structured candidate import</h2>
              <p>Available now for CSV files with first name, last name, email, and optional phone.</p>
            </div>
            <span className="intake-availability available">Available</span>
          </div>

          <input
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(event) => void handleFile(event.target.files?.[0])}
            ref={inputRef}
            type="file"
          />
          <button className="intake-dropzone" onClick={() => inputRef.current?.click()} type="button">
            <Icon name="upload" size={26} />
            <strong>{parsedImport ? parsedImport.fileName : 'Choose a CSV file'}</strong>
            <span>{parsedImport ? `${parsedImport.rows.length.toLocaleString()} rows ready for preview` : 'Maximum 5 MB and 5,000 candidate rows per batch'}</span>
          </button>

          {parsedImport && (
            <div className="intake-preview">
              <div className="intake-preview-header">
                <div><strong>File preview</strong><small>Showing the first {previewRows.length} rows</small></div>
                <Button variant="primary" loading={submitting} loadingLabel="Creating import batch" onClick={() => void startImport()} type="button">Validate batch</Button>
              </div>
              <div className="table-responsive">
                <table className="request-table">
                  <thead><tr><th>Candidate</th><th>Email</th><th>Phone</th></tr></thead>
                  <tbody>
                    {previewRows.map((row, index) => (
                      <tr key={`${row.email ?? 'row'}-${index}`}>
                        <td>{`${row.firstName ?? ''} ${row.lastName ?? ''}`.trim() || 'Missing name'}</td>
                        <td>{row.email ?? 'Missing email'}</td>
                        <td>{row.phone ?? 'Not provided'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <aside className="card intake-upload-card intake-coming-soon">
          <div className="intake-card-heading">
            <span className="intake-icon"><Icon name="document" size={22} /></span>
            <div>
              <h2>Individual CV files</h2>
              <p>PDF and DOCX intake needs private file storage, malware scanning, and a controlled parser.</p>
            </div>
            <span className="intake-availability planned">Integration required</span>
          </div>
          <div className="intake-safety-note">
            <Icon name="alert-triangle" size={18} />
            <p>This option is intentionally disabled until the secure document pipeline is configured. The system will not pretend that a CV was stored or parsed.</p>
          </div>
        </aside>
      </div>

      <section className="card intake-history">
        <div className="intake-section-header">
          <div><h2>Import batches</h2><p>Continue reviews and see the result of previous candidate imports.</p></div>
          <Button aria-label="Refresh import batches" variant="ghost" size="sm" disabled={loadingJobs} onClick={() => void loadJobs()} title="Refresh"><Icon name="refresh-cw" size={16} /> Refresh</Button>
        </div>

        {loadingJobs ? (
          <PageState kind="loading" title="Loading import batches" description="Checking previous candidate imports." />
        ) : jobs.length === 0 ? (
          <div className="intake-empty"><Icon name="document" size={26} /><strong>No import batches yet</strong><span>Select a CSV file above to create the first controlled intake batch.</span></div>
        ) : (
          <div className="table-responsive">
            <table className="request-table">
              <thead><tr><th>File</th><th>Status</th><th>Total</th><th>Valid</th><th>Issues</th><th>Created</th><th><span className="sr-only">Action</span></th></tr></thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td><strong>{job.fileName}</strong></td>
                    <td><span className={`intake-status ${job.status.toLowerCase()}`}>{job.status}</span></td>
                    <td>{job.totalRows}</td>
                    <td>{job.validRows}</td>
                    <td>{job.invalidRows + job.duplicateRows}</td>
                    <td>{new Date(job.createdAt).toLocaleDateString()}</td>
                    <td><Button variant="secondary" size="sm" onClick={() => void navigate(`/cv-intake/${job.id}`)}>Open review</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PageFrame>
  );
}
