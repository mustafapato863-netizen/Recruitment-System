import { useState, useEffect, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { DataTable, dataTableClasses } from '../components/ui/DataTable';
import { FormField } from '../components/ui/FormField';
import { Input } from '../components/ui/Input';
import { MetricCard } from '../components/ui/MetricCard';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { getApi, postApi, postFormDataApi } from '../api/client';
import type { Candidate, CandidateDocument } from '@recruitflow/contracts';
import { Icon } from '../components/Icon';
import './PageEnhancementsV2.css';

export function CandidateDocumentsPage() {
  const { id } = useParams<{ id: string }>();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [documents, setDocuments] = useState<CandidateDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documentsError, setDocumentsError] = useState<string | null>(null);

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [documentType, setDocumentType] = useState('CV');
  const [fileName, setFileName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileSize, setFileSize] = useState(0);
  const [mimeType, setMimeType] = useState('');
  const [extractionText, setExtractionText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setDocumentsError(null);
    try {
      const c = await getApi<Candidate>(`/candidates/${id}`);
      setCandidate(c);
      try {
        setDocuments(await getApi<CandidateDocument[]>(`/documents/candidate/${id}`));
      } catch (err: unknown) {
        setDocuments([]);
        setDocumentsError((err as Error).message || 'Candidate documents are currently unavailable.');
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load candidate documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [id]);

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!id || (!fileName && !selectedFile)) return;
    setSubmitting(true);
    setUploadError(null);

    try {
      if (selectedFile) {
        const body = new FormData();
        body.append('candidateId', id);
        body.append('documentType', documentType);
        if (extractionText.trim()) body.append('extractionText', extractionText.trim());
        body.append('file', selectedFile);
        await postFormDataApi('/documents/upload', body);
      } else {
        await postApi('/documents', {
          candidateId: id,
          documentType,
          fileName: fileName.trim(),
          fileSize,
          mimeType: mimeType || 'application/pdf',
          extractionText: extractionText.trim() || undefined,
        });
      }
      setIsUploadModalOpen(false);
      setFileName('');
      setSelectedFile(null);
      setFileSize(0);
      setMimeType('');
      setExtractionText('');
      await loadData();
    } catch (err: unknown) {
      setUploadError((err as Error).message || 'Failed to save document record.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PageFrame eyebrow="Candidates / Documents" title="Document Records" description="Loading document records...">
        <PageState kind="loading" title="Loading document records" description="Fetching candidate document metadata." />
      </PageFrame>
    );
  }

  if (error || !candidate) {
    return (
      <PageFrame eyebrow="Candidates / Documents" title="Document Records" description="Candidate document metadata and extracted text.">
        <Alert tone="danger" title="Candidate not found">
          {error || 'The requested candidate profile does not exist.'}
          <Button variant="secondary" size="sm" asChild className="mt-2">
            <Link to="/candidates">
              <Icon name="arrow-left" size={13} />
              Back to candidates
            </Link>
          </Button>
        </Alert>
      </PageFrame>
    );
  }

  const cvCount = documents.filter((d) => d.documentType === 'CV').length;
  const verifiedCount = documents.filter((d) => ['passed', 'verified'].includes((d.scanStatus ?? '').toLowerCase())).length;
  const pendingCount = documents.filter((d) => (d.scanStatus ?? '').toLowerCase() === 'pending').length;

  return (
    <PageFrame
      eyebrow={`Candidates / ${candidate.firstName} ${candidate.lastName} / Vault`}
      title={`Document Vault — ${candidate.firstName} ${candidate.lastName}`}
      description="Candidate document compliance metadata, certifications and extracted text records."
      actions={
        <>
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/candidates/${candidate.id}`}>
              <Icon name="arrow-left" size={13} />
              Back to profile
            </Link>
          </Button>
          <Button variant="primary" size="sm" onClick={() => setIsUploadModalOpen(true)}>
            <Icon name="plus" size={14} />
            Add document record
          </Button>
        </>
      }
    >
      {documentsError && (
        <Alert
          tone="danger"
          title="Document list unavailable"
          action={
            <Button variant="secondary" size="sm" onClick={() => void loadData()}>
              <Icon name="refresh-cw" size={13} />
              Retry
            </Button>
          }
        >
          {documentsError}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <MetricCard label="Total Documents" value={documents.length} detail={`${cvCount} CVs on record`} tone="action" />
        <MetricCard label="Verified Files" value={verifiedCount} detail="Passed virus & format scan" tone="success" />
        <MetricCard label="Pending Review" value={pendingCount} detail="Awaiting verification" tone="warning" />
      </div>

      <section className="rf-table-shell rf-long-content overflow-hidden rounded-2xl border border-rf-border bg-rf-surface shadow-xs">
        <div className="p-4 border-b border-rf-border-subtle bg-rf-surface-subtle flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-rf-ink m-0">Candidate Document Records</h3>
            <p className="text-[11px] text-rf-ink-muted font-medium m-0 mt-0.5">Verification status and document metadata.</p>
          </div>
        </div>

        <DataTable role="region" aria-label="Candidate documents table" tabIndex={0} className="rounded-none border-0 shadow-none">
          <thead className={dataTableClasses.head}>
            <tr>
              <th className={dataTableClasses.th}>Document Name</th>
              <th className={dataTableClasses.th}>Type</th>
              <th className={dataTableClasses.th}>Scan Status</th>
              <th className={dataTableClasses.th}>Size</th>
              <th className={dataTableClasses.th}>Uploaded</th>
            </tr>
          </thead>
          <tbody>
            {documentsError ? (
              <tr>
                <td colSpan={5}>
                  <PageState kind="error" title="Documents could not be loaded" description="Retry to check the candidate document records again." actionLabel="Retry" onAction={() => void loadData()} />
                </td>
              </tr>
            ) : documents.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <PageState
                    kind="empty"
                    title="No document records"
                    description="Add metadata for a CV, educational certificate, or ID document."
                  />
                </td>
              </tr>
            ) : (
              documents.map((doc) => (
                <tr className={dataTableClasses.row} key={doc.id}>
                  <td className={dataTableClasses.td}>
                    <div className={dataTableClasses.primary}>{doc.fileName}</div>
                    <div className={dataTableClasses.secondary}>{doc.documentType}</div>
                  </td>
                  <td className={dataTableClasses.td}>
                    <span className="font-mono text-[10.5px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                      {doc.documentType}
                    </span>
                  </td>
                  <td className={dataTableClasses.td}>
                    <StatusBadge status={doc.scanStatus || 'Not reported'} />
                  </td>
                  <td className={dataTableClasses.td}>
                    <span className="text-slate-600 font-medium text-xs">
                      {doc.fileSize ? `${Math.round(doc.fileSize / 1024)} KB` : 'Not reported'}
                    </span>
                  </td>
                  <td className={dataTableClasses.td}>
                    <span className="text-slate-600 font-medium text-xs">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </DataTable>
      </section>

      {/* Document metadata modal */}
      <Modal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} title="Add Document Record">
        <form onSubmit={(e) => void handleUpload(e)}>
          {uploadError && (
            <div className="mb-4">
              <Alert tone="danger" title="Record error">
                {uploadError}
              </Alert>
            </div>
          )}
          <div className="mb-4">
            <Alert tone="info" title="Secure CV storage">
              Select a PDF, DOC, or DOCX file to store it in the organization-scoped CV Bank, or save a metadata-only record when the source file is held elsewhere.
            </Alert>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField id="doc-type" label="Document Type" required>
              <Select
                id="doc-type"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
              >
                <option value="CV">CV / Resume</option>
                <option value="ID">National ID / Passport</option>
                <option value="CERTIFICATE">Educational Certificate</option>
                <option value="LICENSE">Professional License (DHA/MOH)</option>
                <option value="OFFER_LETTER">Signed Offer Letter</option>
              </Select>
            </FormField>
            <FormField id="doc-file" label="CV file" hint="Optional for legacy metadata records. PDF, DOC, or DOCX up to 10 MB.">
              <input
                id="doc-file"
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="block w-full rounded-lg border border-rf-border bg-rf-surface px-3 py-2 text-xs text-rf-ink"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setSelectedFile(file);
                  if (file) {
                    setFileName(file.name);
                    setFileSize(file.size);
                    setMimeType(file.type || 'application/pdf');
                  }
                }}
              />
            </FormField>
            <FormField id="doc-name" label="File Name" required>
              <Input
                id="doc-name"
                required
                placeholder="e.g. Candidate_Passport.pdf"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
              />
            </FormField>
            <FormField id="doc-size" label="File Size (bytes)" required>
              <Input
                id="doc-size"
                required
                min={1}
                type="number"
                value={fileSize || ''}
                onChange={(e) => setFileSize(Number(e.target.value))}
              />
            </FormField>
            <FormField id="doc-mime" label="File MIME Type" required>
              <Select
                id="doc-mime"
                required
                value={mimeType}
                onChange={(e) => setMimeType(e.target.value)}
              >
                <option value="">Select a file type</option>
                <option value="application/pdf">PDF Document</option>
                <option value="application/msword">Word Document (.doc)</option>
                <option value="application/vnd.openxmlformats-officedocument.wordprocessingml.document">Word Document (.docx)</option>
                <option value="image/jpeg">JPEG Image</option>
                <option value="image/png">PNG Image</option>
              </Select>
            </FormField>
            <div className="sm:col-span-2">
              <FormField id="doc-extract" label="Extracted text or notes" hint="Optional plain text extracted from OCR or parsing.">
                <Textarea
                  id="doc-extract"
                  rows={3}
                  placeholder="Paste relevant extracted text or credentials..."
                  value={extractionText}
                  onChange={(e) => setExtractionText(e.target.value)}
                />
              </FormField>
            </div>
          </div>
          <div className="flex gap-2 mt-6 justify-end">
            <Button variant="ghost" type="button" onClick={() => setIsUploadModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={submitting} loadingLabel="Saving" type="submit">
              Save record
            </Button>
          </div>
        </form>
      </Modal>
    </PageFrame>
  );
}
