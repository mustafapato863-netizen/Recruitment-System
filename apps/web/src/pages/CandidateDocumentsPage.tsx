import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Archive, Download, FilePlus2, FileText, RefreshCw, UploadCloud } from 'lucide-react';
import type { Candidate, CandidateDocument } from '@recruitflow/contracts';
import { downloadApi, getApi, postApi, postFormDataApi } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useV2Shell } from '../components/v2/shell/AppShellV2';
import { ButtonV2, CardV2, EmptyStateV2, ErrorStateV2, ForbiddenStateV2, SkeletonV2, StatusChip, type StatusTone } from '../components/v2';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Modal } from '../components/Modal';
import { useSetBreadcrumbTitle } from '../context/BreadcrumbContext';
import { routeActor } from '../v2/destinations';
import { allowedReturn, withReturnTo } from '../v2/returnTarget';
import { resolveSeat } from '../v2/seat';
import { saveBlob } from '../utils/download';
import '../v2/pages/candidate-documents.css';

type Load<T> = { kind: 'loading' } | { kind: 'ready'; data: T } | { kind: 'error'; message: string; forbidden: boolean };
type Notice = { tone: 'success' | 'warning'; message: string };
const MAX_BYTES = 10 * 1024 * 1024;
const VALID_FILE = /\.(pdf|doc|docx)$/i;

function failure(error: unknown, fallback: string): Load<never> {
  const e = error as { statusCode?: number; message?: string };
  return { kind: 'error', forbidden: e?.statusCode === 403, message: e?.message || fallback };
}
function formatSize(size: number | null | undefined) {
  return typeof size === 'number' && size > 0 ? Math.max(1, Math.round(size / 1024)).toLocaleString() + ' KB' : 'Not reported';
}
function formatDate(date: string | null | undefined) {
  if (!date) return 'Not recorded';
  const parsed = new Date(date);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleDateString() : 'Not recorded';
}
function tone(status: string): StatusTone {
  if (status === 'Clean') return 'success';
  if (status === 'Pending') return 'warning';
  if (['Quarantined', 'Failed', 'Rejected', 'Infected'].includes(status)) return 'danger';
  return 'neutral';
}
function canDownload(doc: CandidateDocument) {
  return doc.hasFile === true && doc.scanStatus === 'Clean'
    && doc.consentStatus !== 'Withdrawn' && doc.consentStatus !== 'Expired'
    && !(doc.retentionExpiresAt && new Date(doc.retentionExpiresAt) <= new Date());
}

/**
 * Native V2 candidate document vault. Only real uploaded binaries are created.
 * Never advertise metadata-only documents, privacy settings or tags that the API
 * cannot persist; document IDs, scan status and retention come from the server.
 */
export function CandidateDocumentsPage() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const seat = useV2Shell()?.seat ?? resolveSeat(user);
  const back = allowedReturn(params.get('returnTo'), routeActor(seat, user));
  const isAdmin = Boolean(user?.roles.some((role) => role.code === 'ADMINISTRATOR'));
  const canEdit = isAdmin || Boolean(user?.permissions.includes('CANDIDATE_EDIT'));
  const [candidate, setCandidate] = useState<Load<Candidate>>({ kind: 'loading' });
  const [documents, setDocuments] = useState<Load<CandidateDocument[]>>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState('CV');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<CandidateDocument | null>(null);
  const [archiving, setArchiving] = useState(false);

  useSetBreadcrumbTitle(candidate.kind === 'ready'
    ? [candidate.data.firstName, candidate.data.lastName].filter(Boolean).join(' ')
    : 'Documents');

  useEffect(() => {
    let current = true;
    setCandidate({ kind: 'loading' });
    setDocuments({ kind: 'loading' });
    if (!id) {
      setCandidate({ kind: 'error', message: 'Candidate ID is missing.', forbidden: false });
      return () => { current = false; };
    }
    void (async () => {
      try {
        const person = await getApi<Candidate>('/candidates/' + encodeURIComponent(id));
        if (!current) return;
        setCandidate({ kind: 'ready', data: person });
      } catch (error: unknown) {
        if (!current) return;
        setCandidate(failure(error, 'Could not load candidate.'));
        return;
      }
      try {
        const items = await getApi<CandidateDocument[]>('/documents/candidate/' + encodeURIComponent(id));
        if (!Array.isArray(items)) throw new Error('The document service returned an invalid list.');
        if (current) setDocuments({ kind: 'ready', data: items });
      } catch (error: unknown) {
        if (current) setDocuments(failure(error, 'Documents are unavailable.'));
      }
    })();
    return () => { current = false; };
  }, [id, attempt]);

  const refresh = () => setAttempt((n) => n + 1);
  const closeUpload = () => { if (!saving) { setShowUpload(false); setUploadError(''); } };

  const upload = async (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit || !id || candidate.kind !== 'ready' || saving) return;
    if (!selectedFile) { setUploadError('Choose a real document file before uploading.'); return; }
    if (!VALID_FILE.test(selectedFile.name) || !selectedFile.size || selectedFile.size > MAX_BYTES) {
      setUploadError('Upload a non-empty PDF, DOC or DOCX file up to 10 MB.');
      return;
    }
    setSaving(true);
    setUploadError('');
    setNotice(null);
    try {
      const body = new FormData();
      body.append('candidateId', id);
      body.append('documentType', documentType);
      body.append('file', selectedFile);
      if (notes.trim()) body.append('extractionText', notes.trim());
      const uploaded = await postFormDataApi<CandidateDocument>('/documents/upload', body);
      if (!uploaded?.id) throw new Error('The document upload was not confirmed by the server.');
      let warning: string | null = null;
      if (documentType === 'CV') {
        try {
          await postApi('/candidates/' + encodeURIComponent(id) + '/fill-from-cv', { documentId: uploaded.id });
        } catch (error: unknown) {
          warning = 'The CV was stored, but automatic profile enrichment failed: '
            + (error instanceof Error ? error.message : 'Service unavailable.');
        }
      }
      setNotice({ tone: warning ? 'warning' : 'success', message: warning ?? 'Document uploaded. Scan and verification status will update when available.' });
      setSelectedFile(null);
      setNotes('');
      setDocumentType('CV');
      setShowUpload(false);
      refresh();
    } catch (error: unknown) {
      setUploadError(error instanceof Error ? error.message : 'Could not upload the document.');
    } finally {
      setSaving(false);
    }
  };

  const download = async (doc: CandidateDocument) => {
    if (!canDownload(doc) || downloading) return;
    setDownloading(doc.id);
    setActionError('');
    try {
      const blob = await downloadApi('/documents/' + encodeURIComponent(doc.id) + '/download');
      if (!(blob instanceof Blob) || blob.size === 0) throw new Error('The downloaded file was empty.');
      saveBlob(blob, doc.fileName);
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : 'Could not download the document.');
    } finally {
      setDownloading(null);
    }
  };

  const archive = async (reason?: string) => {
    if (!canEdit || !archiveTarget || archiving) return;
    const note = reason?.trim();
    if (!note) { setActionError('An archive reason is required.'); return; }
    setArchiving(true);
    setActionError('');
    try {
      await postApi('/documents/' + encodeURIComponent(archiveTarget.id) + '/archive', { reason: note });
      setArchiveTarget(null);
      setNotice({ tone: 'success', message: 'Document archived. The operation is audited and the file remains recoverable.' });
      refresh();
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : 'Could not archive the document.');
    } finally {
      setArchiving(false);
    }
  };

  const profileHref = id ? withReturnTo('/candidates/' + encodeURIComponent(id), back) : '/candidates';
  const backHref = back ?? '/candidates';
  const loaded = documents.kind === 'ready' ? documents.data : [];
  const scanned = loaded.filter((doc) => doc.scanStatus === 'Clean' && doc.hasFile === true).length;
  const pending = loaded.filter((doc) => doc.scanStatus === 'Pending').length;

  return (
    <main className="rf2-docs">
      <nav aria-label="Candidate breadcrumbs" className="rf2-docs__crumbs">
        <Link to={backHref}>Back to candidates</Link><span aria-hidden="true">/</span>
        <Link to={profileHref}>Back to profile</Link><span aria-hidden="true">/</span>
        <span>Documents</span>
      </nav>
      {candidate.kind === 'loading' ? <SkeletonV2 label="Loading candidate documents" lines={4} /> : null}
      {candidate.kind === 'error' ? (
        candidate.forbidden
          ? <ForbiddenStateV2 title="Candidate access restricted" body={candidate.message} />
          : <ErrorStateV2 title="Candidate unavailable" body={candidate.message} action={<ButtonV2 kind="secondary" icon={<RefreshCw />} onClick={refresh}>Retry</ButtonV2>} />
      ) : null}
      {candidate.kind === 'ready' ? (
        <>
          <header className="rf2-docs__head">
            <div>
              <p className="rf2-docs__eyebrow">Candidate profile / Document vault</p>
              <h1>Document Vault — {candidate.data.firstName} {candidate.data.lastName}</h1>
              <p className="rf2-docs__sub">{[candidate.data.candidateCode, candidate.data.currentTitle].filter(Boolean).join(' · ') || 'Uploaded candidate documents and verification status'}</p>
            </div>
            <div className="rf2-docs__tools">
              <ButtonV2 kind="secondary" icon={<RefreshCw />} onClick={refresh}>Refresh</ButtonV2>
              {canEdit ? <ButtonV2 icon={<FilePlus2 />} onClick={() => setShowUpload(true)}>Add document record</ButtonV2> : null}
            </div>
          </header>
          {notice ? <p className="rf2-docs__notice" data-tone={notice.tone} role="status">{notice.message}</p> : null}
          {actionError ? <p className="rf2-docs__notice" data-tone="danger" role="alert">{actionError}</p> : null}
          <div className="rf2-docs__summary" aria-label="Document counts">
            <article><CardV2><span>Total Documents</span><strong>{documents.kind === 'ready' ? loaded.length : '—'}</strong></CardV2></article>
            <article><CardV2><span>Verified Files</span><strong>{documents.kind === 'ready' ? scanned : '—'}</strong></CardV2></article>
            <article><CardV2><span>Pending Review</span><strong>{documents.kind === 'ready' ? pending : '—'}</strong></CardV2></article>
          </div>
          <CardV2 title="Candidate documents">
            {documents.kind === 'loading' ? <SkeletonV2 lines={5} label="Loading document records" /> : null}
            {documents.kind === 'error' ? (
              documents.forbidden
                ? <ForbiddenStateV2 title="Documents access restricted" body={documents.message} />
                : <ErrorStateV2 title="Document list unavailable" body={documents.message} action={<ButtonV2 kind="secondary" onClick={refresh}>Retry</ButtonV2>} />
            ) : null}
            {documents.kind === 'ready' && loaded.length === 0 ? (
              <EmptyStateV2 title="No document records" body="Upload a real document file to attach it to this candidate."
                action={canEdit ? <ButtonV2 onClick={() => setShowUpload(true)}>Add first document</ButtonV2> : undefined} />
            ) : null}
            {documents.kind === 'ready' && loaded.length > 0 ? (
              <div className="rf2-docs__scroll" role="region" aria-label="Candidate document list" tabIndex={0}>
                <table className="rf2-docs__table">
                  <thead><tr><th scope="col">Document</th><th scope="col">Type</th><th scope="col">Scan status</th><th scope="col">Size</th><th scope="col">Uploaded</th><th scope="col">Actions</th></tr></thead>
                  <tbody>
                    {loaded.map((doc) => (
                      <tr key={doc.id}>
                        <td><span className="rf2-docs__filename"><FileText aria-hidden="true" />{doc.fileName}</span></td>
                        <td>{doc.documentType || 'Other'}</td>
                        <td><StatusChip tone={tone(doc.scanStatus ?? '')} label={doc.scanStatus || 'Unknown'} /></td>
                        <td>{formatSize(doc.fileSize)}</td>
                        <td>{formatDate(doc.createdAt)}</td>
                        <td><div className="rf2-docs__row-actions">
                          <ButtonV2 kind="secondary" size="sm" icon={<Download />} disabled={!canDownload(doc) || downloading !== null}
                            title={canDownload(doc) ? 'Download verified document' : 'Not available until stored, scan-clean and permitted by consent/retention'}
                            aria-label={'Download ' + doc.fileName} onClick={() => void download(doc)}
                            loading={downloading === doc.id}>Download</ButtonV2>
                          {canEdit ? <ButtonV2 kind="danger-outline" size="sm" icon={<Archive />}
                            aria-label={'Archive ' + doc.fileName} onClick={() => setArchiveTarget(doc)}>Archive</ButtonV2> : null}
                        </div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </CardV2>
        </>
      ) : null}

      <Modal isOpen={showUpload && canEdit && candidate.kind === 'ready'} onClose={closeUpload}
        title="Add Document Record" maxWidthClass="max-w-lg">
        <form onSubmit={(e) => void upload(e)} className="rf2-docs__form">
          <p>Upload an actual file. Its size, scan status and filename are determined by the stored document, not manually entered values.</p>
          {uploadError ? <p className="rf2-docs__notice" data-tone="danger" role="alert">{uploadError}</p> : null}
          <label htmlFor="rf2-document-file">Document file <span aria-hidden="true">*</span></label>
          <input id="rf2-document-file" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            aria-required="true" onChange={(event) => { setSelectedFile(event.target.files?.[0] ?? null); setUploadError(''); }} />
          <small>PDF, DOC or DOCX · Maximum 10 MB</small>
          {selectedFile ? <p className="rf2-docs__selected"><UploadCloud aria-hidden="true" /> {selectedFile.name} ({formatSize(selectedFile.size)})</p> : null}
          <label htmlFor="rf2-document-type">Document type</label>
          <select id="rf2-document-type" value={documentType} onChange={(event) => setDocumentType(event.target.value)}>
            <option value="CV">CV / Resume</option>
            <option value="ID">National ID / Passport</option>
            <option value="CERTIFICATE">Educational certificate</option>
            <option value="LICENSE">Professional license</option>
            <option value="OFFER_LETTER">Signed offer letter</option>
          </select>
          <label htmlFor="rf2-document-notes">Text or notes stored with the document (optional)</label>
          <textarea id="rf2-document-notes" rows={3} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} />
          <div className="rf2-docs__form-actions">
            <ButtonV2 kind="secondary" onClick={closeUpload} disabled={saving}>Cancel</ButtonV2>
            <ButtonV2 type="submit" loading={saving} disabled={!selectedFile}>Upload document</ButtonV2>
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        isOpen={Boolean(archiveTarget)}
        onClose={() => { if (!archiving) setArchiveTarget(null); }}
        title="Archive document"
        description={archiveTarget ? 'Archive ' + archiveTarget.fileName + '? The change is audited and reversible. This does not permanently delete the file.' : ''}
        confirmLabel="Archive document" tone="warning" withComment commentRequired
        commentLabel="Reason for archiving" commentPlaceholder="Why is this file being archived?"
        isLoading={archiving} onConfirm={(reason) => archive(reason)}
      />
    </main>
  );
}
