import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CandidateDocument, CvBankBackupStatus, PaginatedResult } from '@recruitflow/contracts';
import { downloadApi, getApi } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { DataToolbar } from '../components/ui/DataToolbar';
import { Input } from '../components/ui/Input';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { ResponsiveDataView, type ResponsiveDataColumn } from '../components/ui/ResponsiveDataView';
import { SectionHeader } from '../components/ui/SectionHeader';
import { TableSkeleton } from '../components/ui/Skeleton';
import { MetricCard } from '../components/ui/MetricCard';
import './PageEnhancementsV2.css';

export function CVBankPage() {
  const { user } = useAuth();
  const canDownload = Boolean(user?.permissions.includes('DOWNLOAD_DOCUMENTS'));
  const [result, setResult] = useState<PaginatedResult<CandidateDocument> | null>(null);
  const [backupStatus, setBackupStatus] = useState<CvBankBackupStatus | null>(null);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (appliedSearch) query.set('search', appliedSearch);
      const [cvBank, backup] = await Promise.all([
        getApi<PaginatedResult<CandidateDocument>>(`/documents/cv-bank?${query.toString()}`),
        getApi<CvBankBackupStatus>('/documents/cv-bank/backup-status'),
      ]);
      setResult(cvBank);
      setBackupStatus(backup);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load the CV Bank.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [page, appliedSearch]);

  const downloadManifest = async () => {
    try {
      const blob = await downloadApi('/documents/cv-bank/manifest.xlsx');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'recruitflow-cv-bank-manifest.xlsx';
      link.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to export the CV Bank manifest.');
    }
  };

  const downloadFile = async (record: CandidateDocument) => {
    if (record.scanStatus !== 'Clean' || !record.hasFile || record.consentStatus === 'Withdrawn' || record.consentStatus === 'Expired' || (record.retentionExpiresAt && new Date(record.retentionExpiresAt) <= new Date())) {
      setError('This CV is not available for download because it is not clean, stored, or within its consent and retention rules.');
      return;
    }
    try {
      const blob = await downloadApi(`/documents/${record.id}/download`);
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = record.fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to download the CV file.');
    }
  };

  const columns: ResponsiveDataColumn<CandidateDocument>[] = [
    {
      key: 'candidate',
      header: 'Candidate',
      priority: 'primary',
      render: (document) => (
        <Link className="font-bold text-rf-action hover:underline" to={`/candidates/${document.candidateId}`}>
          {document.candidateName || document.candidateId}
        </Link>
      ),
    },
    { key: 'file', header: 'CV file', priority: 'secondary', render: (document) => <span className="font-medium text-rf-ink">{document.fileName}</span> },
    { key: 'status', header: 'Scan status', priority: 'secondary', render: (document) => <span className={document.scanStatus === 'Clean' ? 'font-semibold text-rf-success' : 'font-semibold text-rf-warning'}>{document.scanStatus}</span> },
    { key: 'stored', header: 'Stored file', priority: 'secondary', render: (document) => <span className={document.hasFile ? 'text-rf-success font-semibold' : 'text-rf-warning font-semibold'}>{document.hasFile ? 'Available' : 'Metadata only'}</span> },
    { key: 'date', header: 'Added', priority: 'tertiary', render: (document) => <span className="text-rf-ink-muted">{new Date(document.createdAt).toLocaleDateString()}</span> },
  ];

  const documents = result?.data ?? [];

  return (
    <PageFrame
      eyebrow="Talent / CV Bank"
      title="CV Bank"
      description="Secure organization-scoped CV records with controlled downloads and an Excel metadata backup manifest."
      actions={(
        <>
          {canDownload && (
            <Button variant="secondary" size="sm" onClick={() => void downloadManifest()}>
              <Icon name="download" size={13} /> Export Excel backup manifest
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
            <Icon name="refresh-cw" size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </Button>
        </>
      )}
    >
      {error && <Alert tone="danger" title="CV Bank unavailable" action={<Button variant="secondary" size="sm" onClick={() => void load()}>Retry</Button>}>{error}</Alert>}
      <div className="grid gap-3.5 sm:grid-cols-3">
        <MetricCard label="CV records" value={result?.total ?? '—'} detail="Organization-scoped CV metadata" tone="action" icon={<Icon name="file-text" size={15} />} />
        <MetricCard label="Stored files" value={backupStatus?.storedFiles ?? '—'} detail={backupStatus?.missingFiles ? `${backupStatus.missingFiles} file(s) missing` : 'Available for controlled download'} tone={backupStatus?.missingFiles ? 'warning' : 'success'} icon={<Icon name="download" size={15} />} />
        <MetricCard label="Backup format" value="Excel" detail={backupStatus?.manifestOnly ? 'Metadata manifest only; binary backup is not configured' : 'Access-controlled backup'} tone="info" icon={<Icon name="database" size={15} />} />
      </div>
      {backupStatus?.manifestOnly && <Alert tone="info" title="CV backup is metadata-only">The Excel workbook records CV metadata, scan status, retention, and file presence. Binary CV files remain in private storage and are not included in the workbook.</Alert>}
      {backupStatus && (backupStatus.pendingFiles > 0 || backupStatus.rejectedFiles > 0 || backupStatus.metadataOnlyFiles > 0) && <Alert tone="warning" title="CV records need attention">{backupStatus.pendingFiles} pending, {backupStatus.rejectedFiles} rejected, and {backupStatus.metadataOnlyFiles} metadata-only record(s). Only clean stored files can be downloaded.</Alert>}
      <section className="rf-table-shell overflow-hidden rounded-2xl border border-rf-border-subtle bg-rf-surface shadow-xs">
        <SectionHeader title="Candidate CV records" description="Use the candidate profile to upload a new CV file; download access is permission-protected." density="compact" className="border-b border-rf-border-subtle p-4" />
        <DataToolbar search={<Input aria-label="Search CV Bank" placeholder="Search candidate or file name..." value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { setPage(1); setAppliedSearch(search.trim()); } }} />} />
        {loading ? <TableSkeleton columns={5} rows={6} /> : documents.length === 0 ? <PageState kind="empty" title="No CV records found" description={appliedSearch ? 'Try a different candidate or file search.' : 'Upload a CV from a candidate profile to build the bank.'} /> : (
          <ResponsiveDataView
            rows={documents}
            columns={columns}
            rowKey={(document) => document.id}
            label="CV Bank records"
            className="px-4 pb-4 sm:px-5 sm:pb-5"
            renderActions={(document) => document.hasFile && document.scanStatus === 'Clean' && document.consentStatus !== 'Withdrawn' && document.consentStatus !== 'Expired' ? (canDownload ? <Button variant="secondary" size="sm" onClick={() => void downloadFile(document)}><Icon name="download" size={13} /> Download</Button> : <span className="text-xs text-rf-ink-muted">Download requires permission</span>) : <span className="text-xs text-rf-ink-muted">Download unavailable</span>}
          />
        )}
      </section>
    </PageFrame>
  );
}
