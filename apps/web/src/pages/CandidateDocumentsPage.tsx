import { useState, useEffect, type FormEvent } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { Calendar, ChevronDown, Eye, FileText, Info, Tag, UploadCloud, Users, X } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useV2Shell } from '../components/v2/shell/AppShellV2';
import { routeActor } from '../v2/destinations';
import { allowedReturn, withReturnTo } from '../v2/returnTarget';
import { resolveSeat } from '../v2/seat';
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
  const [params] = useSearchParams();
  const { user } = useAuth();
  const canEdit = Boolean(user?.permissions.includes('CANDIDATE_EDIT') || user?.roles.some((role) => role.code === 'ADMINISTRATOR'));
  const seat = useV2Shell()?.seat ?? resolveSeat(user);
  const back = allowedReturn(params.get('returnTo'), routeActor(seat, user));
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [documents, setDocuments] = useState<CandidateDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documentsError, setDocumentsError] = useState<string | null>(null);

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [documentType, setDocumentType] = useState('CV');
  const [fileCategory, setFileCategory] = useState('Candidate document');
  const [fileName, setFileName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileSize, setFileSize] = useState(0);
  const [mimeType, setMimeType] = useState('application/pdf');
  const [documentDate, setDocumentDate] = useState('29 Oct 2026');
  const [extractionText, setExtractionText] = useState('');
  const [visibility, setVisibility] = useState<'team' | 'private'>('team');
  const [tags, setTags] = useState<string[]>(['Resume', 'CV', 'Original']);
  const [tagInput, setTagInput] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [enrichmentNotice, setEnrichmentNotice] = useState<{ tone: 'info' | 'warning'; message: string } | null>(null);

  const openUploadModal = () => {
    if (candidate && !fileName && !selectedFile) {
      const safeFirst = (candidate.firstName || 'Candidate').replace(/\s+/g, '_');
      const safeLast = (candidate.lastName || 'Resume').replace(/\s+/g, '_');
      setFileName(`${safeFirst}_${safeLast}_Resume_2026.pdf`);
      setFileSize(262144);
      setMimeType('application/pdf');
    }
    setIsUploadModalOpen(true);
  };

  const applySelectedFile = (file: File | null) => {
    setSelectedFile(file);
    if (file) {
      setFileName(file.name);
      setFileSize(file.size);
      setMimeType(file.type || 'application/pdf');
    }
  };

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
    if (!canEdit || !id || !candidate || (!fileName && !selectedFile)) return;
    setSubmitting(true);
    setUploadError(null);

    try {
      const combinedNotes = [extractionText.trim(), additionalNotes.trim()].filter(Boolean).join('\n\n');
      if (selectedFile) {
        const body = new FormData();
        body.append('candidateId', id);
        body.append('documentType', documentType);
        if (combinedNotes) body.append('extractionText', combinedNotes);
        body.append('file', selectedFile);
        const uploadedDoc = await postFormDataApi<CandidateDocument>('/documents/upload', body);

        if (documentType === 'CV' && uploadedDoc?.id) {
          try {
            const fillResult = await postApi<{ filled?: string[]; conflicts?: Array<{ field: string }> }>(
              `/candidates/${encodeURIComponent(id)}/fill-from-cv`,
              { documentId: uploadedDoc.id },
            );
            const filledCount = fillResult?.filled?.length ?? 0;
            const conflictCount = fillResult?.conflicts?.length ?? 0;
            if (filledCount > 0 || conflictCount > 0) {
              setEnrichmentNotice({
                tone: 'info',
                message: `CV stored.${filledCount ? ` Filled ${filledCount} empty profile field(s).` : ''}${conflictCount ? ` Preserved ${conflictCount} existing profile value(s) without overwriting.` : ''}`,
              });
            }
          } catch (fillErr: unknown) {
            setEnrichmentNotice({
              tone: 'warning',
              message: `CV stored on record, but automatic profile enrichment did not complete: ${(fillErr as Error).message || 'Fill from CV failed.'}`,
            });
          }
        }
      } else {
        await postApi('/documents', {
          candidateId: id,
          documentType,
          fileName: fileName.trim(),
          fileSize: fileSize || 262144,
          mimeType: mimeType || 'application/pdf',
          extractionText: combinedNotes || undefined,
        });
      }
      setIsUploadModalOpen(false);
      setFileName('');
      setSelectedFile(null);
      setFileSize(0);
      setMimeType('application/pdf');
      setExtractionText('');
      setAdditionalNotes('');
      await loadData();
    } catch (err: unknown) {
      setUploadError((err as Error).message || 'Failed to save document record.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PageFrame eyebrow="Candidates / Documents" title="Document Records">
        <PageState kind="loading" title="Loading document records" description="Fetching candidate document metadata." />
      </PageFrame>
    );
  }

  if (error || !candidate) {
    return (
      <PageFrame eyebrow="Candidates / Documents" title="Document Records">
        <Alert tone="danger" title="Candidate not found">
          {error || 'The requested candidate profile does not exist.'}
          <Button variant="secondary" size="sm" asChild className="mt-2">
            <Link to={back ?? '/candidates'}>
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
  const candidateInitials = `${candidate.firstName?.[0] ?? ''}${candidate.lastName?.[0] ?? ''}`.toUpperCase() || 'CA';

  return (
    <PageFrame
      topNav={
        <div className="rf-page-back-nav">
          {back ? (
            <Link to={back} className="rf-page-back-link">
              <Icon name="arrow-left" size={13} />
              Back to candidates
            </Link>
          ) : null}
          {back ? <span className="rf-page-back-sep" aria-hidden="true">/</span> : null}
          <Link to={withReturnTo(`/candidates/${encodeURIComponent(candidate.id)}`, back)} className="rf-page-back-link">
            <Icon name="arrow-left" size={13} />
            Back to profile
          </Link>
        </div>
      }
      title={`Document Vault — ${candidate.firstName} ${candidate.lastName}`}
      description={[candidate.candidateCode, candidate.currentTitle].filter(Boolean).join(' · ') || undefined}
      actions={
        canEdit ? (
          <Button variant="primary" size="sm" onClick={openUploadModal}>
            <Icon name="plus" size={14} /> Add document record
          </Button>
        ) : undefined
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
      {enrichmentNotice && (
        <Alert
          tone={enrichmentNotice.tone}
          title={enrichmentNotice.tone === 'warning' ? 'Profile enrichment incomplete' : 'Profile enrichment complete'}
        >
          {enrichmentNotice.message}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <MetricCard label="Total Documents" value={documentsError ? '—' : documents.length} detail={documentsError ? 'Document records unavailable' : `${cvCount} CVs on record`} tone="action" />
        <MetricCard label="Verified Files" value={documentsError ? '—' : verifiedCount} detail="Passed virus & format scan" tone="success" />
        <MetricCard label="Pending Review" value={documentsError ? '—' : pendingCount} detail="Awaiting verification" tone="warning" />
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
          <tbody className="divide-y divide-rf-border-subtle">
            {documentsError ? (
              <tr>
                <td colSpan={5} className="px-6 py-8">
                  <PageState
                    kind="error"
                    title="Documents unavailable"
                    description={documentsError}
                    actionLabel="Retry"
                    onAction={() => void loadData()}
                  />
                </td>
              </tr>
            ) : documents.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8">
                  <PageState
                    kind="empty"
                    title="No document records"
                    description="No document records have been attached to this candidate yet."
                    actionLabel={canEdit ? 'Add first document' : undefined}
                    onAction={canEdit ? openUploadModal : undefined}
                  />
                </td>
              </tr>
            ) : (
              documents.map((doc) => (
                <tr key={doc.id} className={dataTableClasses.row}>
                  <td className={dataTableClasses.td}>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                        <Icon name="file-text" size={16} />
                      </span>
                      <div>
                        <p className="text-sm font-bold text-slate-900 m-0 leading-tight">{doc.fileName}</p>
                        {doc.extractionText && (
                          <p className="text-[11px] text-slate-500 mt-1 line-clamp-1 max-w-md">{doc.extractionText}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className={dataTableClasses.td}>
                    <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-700 uppercase">
                      {doc.documentType}
                    </span>
                  </td>
                  <td className={dataTableClasses.td}>
                    <StatusBadge status={doc.scanStatus || 'Pending'} />
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
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Add Document Record"
        subtitle="Upload and store a candidate document with metadata for compliance and easy retrieval."
        leadingIcon={<FileText size={18} />}
        maxWidthClass="max-w-[820px]"
      >
        <form onSubmit={(e) => void handleUpload(e)} className="rf-doc-modal">
          {uploadError && (
            <div className="mb-4">
              <Alert tone="danger" title="Record error">
                {uploadError}
              </Alert>
            </div>
          )}

          <div className="rf-doc-modal__grid">
            {/* Left column: Upload zone, selected file preview, metadata fields, OCR text */}
            <div className="rf-doc-modal__main">
              <label
                htmlFor="doc-file"
                className="rf-doc-dropzone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0] ?? null;
                  if (file) applySelectedFile(file);
                }}
              >
                <input
                  id="doc-file"
                  type="file"
                  aria-label="CV file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    applySelectedFile(file);
                  }}
                />
                <UploadCloud size={30} className="rf-doc-dropzone__icon" aria-hidden="true" />
                <span className="rf-doc-dropzone__title">Drag and drop a file here</span>
                <span className="rf-doc-dropzone__sub">
                  or <span className="rf-doc-dropzone__browse">click to browse</span>
                </span>
                <span className="rf-doc-dropzone__hint">Supports PDF, DOC, DOCX (max 10 MB)</span>
              </label>

              {fileName ? (
                <div className="rf-doc-file-pill">
                  <div className="rf-doc-file-pill__badge" aria-hidden="true">
                    <FileText size={16} />
                  </div>
                  <div className="rf-doc-file-pill__meta">
                    <span className="rf-doc-file-pill__name">{fileName}</span>
                    <span className="rf-doc-file-pill__sub">
                      {fileSize ? `${Math.max(1, Math.round(fileSize / 1024))} KB` : '256 KB'} ·{' '}
                      {(mimeType || 'application/pdf').includes('word') ? 'DOCX' : 'PDF'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="rf-doc-file-pill__remove"
                    aria-label="Remove selected file"
                    onClick={() => {
                      setSelectedFile(null);
                      setFileName('');
                      setFileSize(0);
                    }}
                  >
                    <X size={15} />
                  </button>
                </div>
              ) : null}

              <div className="rf-doc-form-grid">
                <FormField id="doc-type" label="Document Type" required>
                  <Select id="doc-type" value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
                    <option value="CV">CV / Resume</option>
                    <option value="ID">National ID / Passport</option>
                    <option value="CERTIFICATE">Educational Certificate</option>
                    <option value="LICENSE">Professional License (DHA/MOH)</option>
                    <option value="OFFER_LETTER">Signed Offer Letter</option>
                  </Select>
                </FormField>

                <FormField id="doc-category" label="File Category">
                  <Select id="doc-category" value={fileCategory} onChange={(e) => setFileCategory(e.target.value)}>
                    <option value="Candidate document">Candidate document</option>
                    <option value="Compliance & licensing">Compliance &amp; licensing</option>
                    <option value="Identity verification">Identity verification</option>
                    <option value="Academic credential">Academic credential</option>
                  </Select>
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
                    type="text"
                    inputMode="numeric"
                    value={fileSize ? fileSize.toLocaleString('en-US') : ''}
                    onChange={(e) => {
                      const numeric = Number(e.target.value.replace(/[^0-9]/g, ''));
                      setFileSize(Number.isFinite(numeric) ? numeric : 0);
                    }}
                  />
                </FormField>

                <FormField id="doc-mime" label="File MIME Type" required>
                  <Select id="doc-mime" required value={mimeType} onChange={(e) => setMimeType(e.target.value)}>
                    <option value="application/pdf">application/pdf</option>
                    <option value="application/msword">application/msword</option>
                    <option value="application/vnd.openxmlformats-officedocument.wordprocessingml.document">
                      application/vnd.openxmlformats-officedocument.wordprocessingml.document
                    </option>
                    <option value="image/jpeg">image/jpeg</option>
                    <option value="image/png">image/png</option>
                  </Select>
                </FormField>

                <FormField id="doc-date" label="Document Date">
                  <div className="rf-doc-date-box">
                    <Calendar size={14} className="rf-doc-date-box__icon" aria-hidden="true" />
                    <input
                      id="doc-date"
                      type="text"
                      value={documentDate}
                      onChange={(e) => setDocumentDate(e.target.value)}
                      className="rf-doc-date-box__input"
                    />
                    {documentDate ? (
                      <button
                        type="button"
                        className="rf-doc-date-box__clear"
                        aria-label="Clear document date"
                        onClick={() => setDocumentDate('')}
                      >
                        <X size={13} />
                      </button>
                    ) : null}
                  </div>
                </FormField>
              </div>

              <div className="rf-doc-extract">
                <FormField id="doc-extract" label="Extracted text or notes">
                  <Textarea
                    id="doc-extract"
                    rows={3}
                    maxLength={2000}
                    placeholder="Paste relevant extracted text or credentials..."
                    value={extractionText}
                    onChange={(e) => setExtractionText(e.target.value)}
                  />
                </FormField>
                <div className="rf-doc-extract__foot">
                  <span className="rf-doc-extract__hint">
                    <Info size={12} aria-hidden="true" /> Optional plain text extracted from OCR or parsing.
                  </span>
                  <span className="rf-doc-extract__count">{extractionText.length.toLocaleString()} / 2,000</span>
                </div>
              </div>
            </div>

            {/* Right column: Candidate context, Visibility, Tags, Additional information */}
            <aside className="rf-doc-modal__side" aria-label="Document context and visibility">
              <div className="rf-doc-side-card">
                <div className="rf-doc-side-card__head">
                  <Users size={14} aria-hidden="true" />
                  <span>Candidate</span>
                </div>
                <div className="rf-doc-candidate-box">
                  <span className="rf-doc-candidate-box__avatar" aria-hidden="true">
                    {candidateInitials}
                  </span>
                  <div className="rf-doc-candidate-box__info">
                    <span className="rf-doc-candidate-box__name">
                      {candidate.firstName} {candidate.lastName}
                    </span>
                    <span className="rf-doc-candidate-box__sub">
                      {candidate.currentTitle || 'Registered Nurse'} · {candidate.location || 'SGH Dubai Hospital'}
                    </span>
                  </div>
                  <ChevronDown size={14} className="rf-doc-candidate-box__chev" aria-hidden="true" />
                </div>
              </div>

              <div className="rf-doc-side-card">
                <div className="rf-doc-side-card__head">
                  <Eye size={14} aria-hidden="true" />
                  <span>Visibility</span>
                </div>
                <div className="rf-doc-vis-list" role="radiogroup" aria-label="Document visibility">
                  <label className="rf-doc-vis-item">
                    <input
                      type="radio"
                      name="doc-visibility"
                      checked={visibility === 'team'}
                      onChange={() => setVisibility('team')}
                    />
                    <div>
                      <span className="rf-doc-vis-item__title">Visible to team</span>
                      <span className="rf-doc-vis-item__desc">
                        All team members with access to this candidate can view this document.
                      </span>
                    </div>
                  </label>
                  <label className="rf-doc-vis-item">
                    <input
                      type="radio"
                      name="doc-visibility"
                      checked={visibility === 'private'}
                      onChange={() => setVisibility('private')}
                    />
                    <div>
                      <span className="rf-doc-vis-item__title">Private (only me)</span>
                      <span className="rf-doc-vis-item__desc">Only you can view this document.</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="rf-doc-side-card">
                <div className="rf-doc-side-card__head">
                  <Tag size={14} aria-hidden="true" />
                  <span>Tags (optional)</span>
                </div>
                <input
                  type="text"
                  className="rf-doc-tag-input"
                  placeholder="Add tags..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      const next = tagInput.trim().replace(/,$/, '');
                      if (next && !tags.includes(next)) {
                        setTags([...tags, next]);
                      }
                      setTagInput('');
                    }
                  }}
                />
                {tags.length > 0 ? (
                  <div className="rf-doc-tag-list">
                    {tags.map((t) => (
                      <span key={t} className="rf-doc-tag-pill">
                        {t}
                        <button
                          type="button"
                          aria-label={`Remove tag ${t}`}
                          onClick={() => setTags(tags.filter((x) => x !== t))}
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="rf-doc-side-card">
                <div className="rf-doc-side-card__head">
                  <FileText size={14} aria-hidden="true" />
                  <span>Additional information</span>
                </div>
                <Textarea
                  rows={3}
                  placeholder="Add any additional notes about this document..."
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                />
              </div>
            </aside>
          </div>

          <div className="rf-doc-modal__footer">
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
