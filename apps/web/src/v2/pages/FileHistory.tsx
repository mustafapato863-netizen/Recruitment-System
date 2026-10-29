import { useEffect, useState } from 'react';
import { Download, Eye, FileText, RotateCw } from 'lucide-react';
import { ApiError, downloadFileApi, getApi, postApi } from '../../api/client';
import { ButtonV2 } from '../../components/v2/Button';
import { InputV2, SelectV2 } from '../../components/v2/Field';
import { StatusChip } from '../../components/v2/StatusChip';
import { downloadDocument, loadMessageSection, type FileDocument, type FileMessages, type SectionState } from '../api/applicationFile';
import { canRetrySection, classifyReadError, isSectionKnown, sectionProblem } from '../api/sectionState';

type HistDoc = FileDocument & {
  hasFile?: boolean;
  scanStatus?: string | null;
  fileSize?: number | null;
  version?: number;
  downloads?: Array<{ at: string }>;
};
type HistRequest = { id: string; documentType: string; at: string };
type HistoryPayload = { documents: HistDoc[]; requests: HistRequest[] };
type MessagePayload = FileMessages;

const dayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', day: 'numeric', month: 'short', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

function day(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  return Number.isNaN(d.getTime()) ? '' : dayFmt.format(d);
}
function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : timeFmt.format(d);
}
function line(doc: FileDocument): string {
  return [doc.type, day(doc.uploadedAt), doc.uploadedBy ? `by ${doc.uploadedBy.name}` : null].filter(Boolean).join(' · ');
}
function problem(e: unknown, fallback: string): string {
  return e instanceof ApiError || e instanceof Error ? e.message : fallback;
}

type HistoryRead =
  | { status: 'loading' }
  | { status: 'ready'; docs: HistDoc[]; requests: HistRequest[] }
  | { status: 'not-found' }
  | { status: 'unavailable' }
  | { status: 'error'; failure: 'domain' | 'transient'; message: string };

/** Versions, stored files, downloads and requests. Fallback rows stay visible if document-history fails. */
export function DocumentHistory({
  applicationId,
  fallback,
  fallbackKnown = true,
  section,
  onRetrySection,
  hideUnavailableAlert = false,
  onToast,
}: {
  applicationId: string;
  fallback: FileDocument[];
  fallbackKnown?: boolean;
  section?: SectionState<FileDocument[]>;
  onRetrySection?: () => void;
  hideUnavailableAlert?: boolean;
  onToast: (message: string) => void;
}) {
  const [read, setRead] = useState<HistoryRead>({ status: 'loading' });
  const [type, setType] = useState('Contract');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | undefined>();
  const [preview, setPreview] = useState<{ name: string; url: string } | null>(null);
  const [reload, setReload] = useState(0);
  const hasSection = section !== undefined;
  const parentKnown = section ? isSectionKnown(section) : fallbackKnown;
  const parentUnavailable = section?.status === 'unavailable';
  const parentLoading = section?.status === 'loading';
  const parentError = section ? section.status === 'error' : !fallbackKnown;

  useEffect(() => {
    if (parentLoading) {
      setRead({ status: 'loading' });
      return undefined;
    }
    if (parentUnavailable) {
      setRead({ status: 'unavailable' });
      return undefined;
    }
    if (hasSection && parentError) {
      setRead({ status: 'loading' });
      return undefined;
    }
    let live = true;
    const requested = applicationId;
    setRead({ status: 'loading' });
    getApi<HistoryPayload>(`/applications/${encodeURIComponent(requested)}/document-history`)
      .then((payload) => {
        if (!live) return;
        if (
          !payload
          || !Array.isArray(payload.documents)
          || !Array.isArray(payload.requests)
          || !payload.documents.every((d) => d && typeof d === 'object' && !Array.isArray(d) && typeof d.id === 'string' && d.id.trim().length > 0 && typeof d.type === 'string' && d.type.trim().length > 0 && typeof d.name === 'string' && d.name.trim().length > 0 && typeof d.uploadedAt === 'string' && d.uploadedAt.trim().length > 0 && (d.downloads === undefined || (Array.isArray(d.downloads) && d.downloads.every((dl) => dl && typeof dl === 'object' && typeof dl.at === 'string' && dl.at.trim().length > 0))))
          || !payload.requests.every((r) => r && typeof r === 'object' && !Array.isArray(r) && typeof r.id === 'string' && r.id.trim().length > 0 && typeof r.documentType === 'string' && r.documentType.trim().length > 0 && typeof r.at === 'string' && r.at.trim().length > 0)
        ) {
          setRead({ status: 'error', failure: 'domain', message: 'Document history could not be read.' });
          return;
        }
        setRead({ status: 'ready', docs: payload.documents, requests: payload.requests });
      })
      .catch((error: unknown) => {
        if (!live) return;
        const failed = classifyReadError(error);
        if (failed.status === 'unavailable') setRead({ status: 'unavailable' });
        else if (failed.failure === 'not-found') setRead({ status: 'not-found' });
        else setRead({ status: 'error', failure: failed.failure === 'transient' ? 'transient' : 'domain', message: failed.message });
      });
    return () => { live = false; };
  }, [applicationId, hasSection, parentError, parentLoading, parentUnavailable, reload]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  const shown: HistDoc[] = read.status === 'ready' ? read.docs : parentKnown ? fallback : [];
  const requests = read.status === 'ready' ? read.requests : null;
  const parentProblem = section && !parentKnown && section.status !== 'loading' ? sectionProblem('Documents', section) : null;
  const historyProblem = parentProblem
    ? (hideUnavailableAlert && parentProblem.tone === 'unavailable' ? null : parentProblem)
    : read.status === 'unavailable'
      ? { tone: 'unavailable' as const, message: 'Document history is not available for this role.' }
      : read.status === 'error'
        ? { tone: read.failure === 'transient' ? ('transient' as const) : ('danger' as const), message: read.failure === 'transient' ? 'Document history could not be loaded. Try again.' : read.message }
        : read.status === 'not-found'
          ? { tone: 'danger' as const, message: 'Document history could not be found for this file.' }
          : null;
  const canRetry = parentProblem
    ? Boolean(section && canRetrySection(section) && onRetrySection)
    : read.status === 'error' || read.status === 'not-found';
  const handleRetry = () => {
    if (parentProblem && onRetrySection) {
      onRetrySection();
      return;
    }
    if (!parentKnown && onRetrySection) onRetrySection();
    setReload((n) => n + 1);
  };
  const showLoading = parentLoading || (parentKnown && read.status === 'loading');
  const sayEmpty = shown.length === 0 && parentKnown && read.status === 'ready';
  const requestUnavailable = parentUnavailable || read.status === 'unavailable';
  const requestDisabled = !parentKnown || read.status !== 'ready';
  const ask = async () => {
    if (requestUnavailable || requestDisabled || busy) return;
    const name = type.trim();
    if (name.length < 2 || name.length > 60) {
      setErr('Name the document in 2 to 60 characters.');
      return;
    }
    setBusy(true);
    setErr(undefined);
    try {
      await postApi(`/applications/${encodeURIComponent(applicationId)}/document-requests`, { documentType: name });
      setReload((n) => n + 1);
    } catch (e) {
      setErr(problem(e, 'Could not record the request.'));
    } finally {
      setBusy(false);
    }
  };
  const openPreview = async (doc: HistDoc) => {
    try {
      const { blob, filename } = await downloadFileApi(`/documents/${encodeURIComponent(doc.id)}/download`, doc.name);
      const url = URL.createObjectURL(blob);
      setPreview({ name: filename || doc.name, url });
    } catch (e) {
      onToast(problem(e, 'Could not preview this document.'));
    }
  };

  return (
    <>
      {showLoading ? <p className="rf2-file__muted">Loading document history.</p> : null}
      {historyProblem ? (
        <div className="rf2-file__section" role="alert" data-tone={historyProblem.tone === 'unavailable' ? 'unavailable' : historyProblem.tone === 'transient' ? 'warning' : 'danger'}>
          <p>{historyProblem.message}</p>
          {canRetry ? <ButtonV2 kind="secondary" size="sm" icon={<RotateCw />} onClick={handleRetry}>Retry documents</ButtonV2> : null}
        </div>
      ) : null}
      {sayEmpty ? <p className="rf2-file__muted">No documents yet.</p> : shown.length === 0 ? null : (
        <ul className="rf2-docs">
          {shown.map((doc) => {
            const stored = typeof doc.hasFile === 'boolean' ? doc.hasFile : null;
            return (
              <li key={doc.id}>
                <FileText aria-hidden="true" />
                <div className="rf2-docs__body">
                  <p>{doc.name}</p>
                  <p className="rf2-timeline__sub">{line(doc)}</p>
                  {stored === null ? null : (
                    <p className="rf2-file__muted">
                      {[stored ? 'File stored' : 'No file stored', typeof doc.version === 'number' ? `Version ${doc.version}` : null, doc.scanStatus || null, typeof doc.fileSize === 'number' ? `${doc.fileSize} bytes` : null, doc.downloads?.length ? `Downloaded ${doc.downloads.length}` : null].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                {stored ? (
                  <div className="rf2-docs__actions">
                    <ButtonV2 kind="secondary" size="sm" icon={<Eye />} onClick={() => void openPreview(doc)}>Preview</ButtonV2>
                    <ButtonV2 kind="secondary" size="sm" icon={<Download />} onClick={() => void downloadDocument(doc).catch((e: unknown) => onToast(problem(e, 'Could not download this document.')))}>Download</ButtonV2>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {requests && requests.length > 0 ? (
        <ul className="rf2-docs" aria-label="Document requests">
          {requests.map((row) => <li key={row.id}><FileText aria-hidden="true" /><p>{row.documentType} requested · {day(row.at)}</p></li>)}
        </ul>
      ) : null}
      <p className="rf2-file__muted">Rows without a stored file stay in history. This screen does not create bytes for them.</p>
      {!requestUnavailable ? (
        <form className="rf2-file__request" onSubmit={(e) => { e.preventDefault(); void ask(); }}>
          <InputV2 label="Document type" value={type} disabled={requestDisabled} onChange={(e) => setType(e.target.value)} error={err} />
          <ButtonV2 kind="secondary" size="sm" type="submit" loading={busy} disabled={requestDisabled}>Request this document</ButtonV2>
        </form>
      ) : null}
      {preview ? (
        <div className="rf2-preview" onClick={() => setPreview(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="doc-preview-h" className="rf2-preview__sheet" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') setPreview(null); }}>
            <h4 id="doc-preview-h" className="rf2-card__title">Preview {preview.name}</h4>
            <iframe className="rf2-preview__frame" title={`Preview ${preview.name}`} src={preview.url} />
            <ButtonV2 kind="secondary" onClick={() => setPreview(null)}>Close preview</ButtonV2>
          </div>
        </div>
      ) : null}
    </>
  );
}

const TONE = { Queued: 'warning', Sent: 'success', Failed: 'danger' } as const;

/** Templates and queued, sent, and failed attempts. Retry of a failed send adds a row and leaves the failed attempt. */
export function MessagesCard({ applicationId, followUpDate, omitAttempts = false, read, onReload }: { applicationId: string; followUpDate: string | null; omitAttempts?: boolean; read?: SectionState<MessagePayload>; onReload?: () => void }) {
  const [localRead, setLocalRead] = useState<SectionState<MessagePayload>>({ status: 'loading' });
  const [templateId, setTemplateId] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const section = read ?? localRead;
  const payload = section.status === 'ready' ? section.data : null;

  useEffect(() => {
    if (read) return undefined;
    let live = true;
    const requested = applicationId;
    setLocalRead({ status: 'loading' });
    void loadMessageSection(requested).then((next) => { if (live) setLocalRead(next); });
    return () => { live = false; };
  }, [applicationId, read, reload]);

  const reloadRead = () => { if (onReload) onReload(); else setReload((n) => n + 1); };

  const send = async () => {
    if (!templateId) return;
    setBusy('send');
    setErr(null);
    try {
      await postApi(`/applications/${encodeURIComponent(applicationId)}/messages`, { templateId });
      reloadRead();
    } catch (e) {
      setErr(problem(e, 'Could not send.'));
    } finally {
      setBusy(null);
    }
  };
  const retry = async (attemptId: string) => {
    setBusy(attemptId);
    setErr(null);
    try {
      await postApi(`/applications/${encodeURIComponent(applicationId)}/messages/${encodeURIComponent(attemptId)}/retry`, {});
      reloadRead();
    } catch (e) {
      setErr(problem(e, 'Could not retry.'));
    } finally {
      setBusy(null);
    }
  };

  const follow = payload?.followUpDate ?? followUpDate;
  const chosen = payload?.templates.find((template) => template.id === templateId);
  const readProblem = sectionProblem('Messages', section);
  const attemptsEmpty = payload ? payload.attempts.length === 0 : false;
  return (
    <section className="rf2-card" aria-labelledby="msgs-h">
      <h3 id="msgs-h" className="rf2-card__title">Messages</h3>
      <p className="rf2-file__muted">Follow-up on this file: {follow ? day(follow) : 'not set'}. Sending does not change it.</p>
      {section.status === 'loading' ? <p className="rf2-file__muted">Loading message history.</p> : null}
      {readProblem && section.status !== 'loading' ? (
        <div className="rf2-file__section" role="alert" data-tone={readProblem.tone === 'unavailable' ? 'unavailable' : readProblem.tone === 'transient' ? 'warning' : 'danger'}>
          <p>{readProblem.message}</p>
          {section.status === 'error' ? <ButtonV2 kind="secondary" size="sm" icon={<RotateCw />} onClick={reloadRead}>Retry messages</ButtonV2> : null}
        </div>
      ) : null}
      {payload ? (
        <>
          <p className="rf2-file__muted">Recipient {payload.destination}. The candidate is not emailed.</p>
          <form className="rf2-file__request" onSubmit={(e) => { e.preventDefault(); void send(); }}>
            <SelectV2 label="Template" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">Choose a template</option>
              {payload.templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </SelectV2>
            {chosen ? (
              <div aria-label="Filled message">
                <p>{chosen.subject ?? ''}</p>
                <p>{chosen.body ?? ''}</p>
              </div>
            ) : null}
            <ButtonV2 kind="secondary" size="sm" type="submit" loading={busy === 'send'} disabled={!templateId}>Send to local test</ButtonV2>
          </form>
          {!omitAttempts && attemptsEmpty ? <p className="rf2-file__muted">No attempts yet.</p> : null}
          {!omitAttempts && payload.attempts.length > 0 ? (
            <ul className="rf2-msg-list" aria-label="Message attempts">
              {payload.attempts.map((row) => (
                <li key={row.id}>
                  <StatusChip tone={TONE[row.state]} label={row.state} />
                  <span>{row.templateName} · {when(row.at)}{row.retryOf ? ' · retry, earlier attempt kept' : ''}</span>
                  {row.reason ? <span className="rf2-file__muted">{row.reason}</span> : null}
                  {row.state === 'Failed' ? <ButtonV2 kind="secondary" size="sm" loading={busy === row.id} aria-label={`Retry ${row.templateName}`} onClick={() => void retry(row.id)}>Retry</ButtonV2> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
      {err ? <p className="rf2-form-error" role="alert">{err}</p> : null}
    </section>
  );
}
