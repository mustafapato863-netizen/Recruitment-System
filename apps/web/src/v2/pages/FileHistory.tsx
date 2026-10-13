import { useEffect, useState } from 'react';
import { Download, Eye, FileText } from 'lucide-react';
import { ApiError, downloadFileApi, getApi, postApi } from '../../api/client';
import { ButtonV2 } from '../../components/v2/Button';
import { InputV2, SelectV2 } from '../../components/v2/Field';
import { StatusChip } from '../../components/v2/StatusChip';
import { downloadDocument, type FileDocument } from '../api/applicationFile';

type HistDoc = FileDocument & {
  hasFile?: boolean;
  scanStatus?: string | null;
  fileSize?: number | null;
  version?: number;
  downloads?: Array<{ at: string }>;
};
type HistRequest = { id: string; documentType: string; at: string };
type HistoryPayload = { documents: HistDoc[]; requests: HistRequest[] };
type Attempt = {
  id: string;
  templateId: string;
  templateName: string;
  state: 'Queued' | 'Sent' | 'Failed';
  reason: string | null;
  at: string;
  retryOf: string | null;
};
type MessagePayload = {
  followUpDate: string | null;
  destination: string;
  templates: Array<{ id: string; name: string }>;
  attempts: Attempt[];
};

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

/** Versions, stored files, downloads and requests. A 404 keeps the file's existing document list. */
export function DocumentHistory({ applicationId, fallback, onToast }: { applicationId: string; fallback: FileDocument[]; onToast: (message: string) => void }) {
  const [docs, setDocs] = useState<HistDoc[] | null>(null);
  const [requests, setRequests] = useState<HistRequest[] | null>(null);
  const [type, setType] = useState('Contract');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | undefined>();
  const [preview, setPreview] = useState<{ name: string; url: string } | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    getApi<HistoryPayload>(`/applications/${encodeURIComponent(applicationId)}/document-history`)
      .then((payload) => {
        if (!live || !payload || !Array.isArray(payload.documents)) return;
        setDocs(payload.documents);
        setRequests(Array.isArray(payload.requests) ? payload.requests : []);
      })
      .catch(() => undefined);
    return () => { live = false; };
  }, [applicationId, reload]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  const shown: HistDoc[] = docs ?? fallback;
  const ask = async () => {
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
      {shown.length === 0 ? <p className="rf2-file__muted">No documents yet.</p> : (
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
      <form className="rf2-file__request" onSubmit={(e) => { e.preventDefault(); void ask(); }}>
        <InputV2 label="Document type" value={type} onChange={(e) => setType(e.target.value)} error={err} />
        <ButtonV2 kind="secondary" size="sm" type="submit" loading={busy}>Request this document</ButtonV2>
      </form>
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

/** Templates and queued, sent, and failed attempts. Retry adds a row and leaves the failed attempt. */
export function MessagesCard({ applicationId, followUpDate }: { applicationId: string; followUpDate: string | null }) {
  const [payload, setPayload] = useState<MessagePayload | null>(null);
  const [missing, setMissing] = useState(false);
  const [templateId, setTemplateId] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    getApi<MessagePayload>(`/applications/${encodeURIComponent(applicationId)}/messages`)
      .then((row) => { if (live && row && Array.isArray(row.attempts)) setPayload(row); })
      .catch(() => { if (live) setMissing(true); });
    return () => { live = false; };
  }, [applicationId, reload]);

  const send = async () => {
    if (!templateId) return;
    setBusy('send');
    setErr(null);
    try {
      await postApi(`/applications/${encodeURIComponent(applicationId)}/messages`, { templateId });
      setReload((n) => n + 1);
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
      setReload((n) => n + 1);
    } catch (e) {
      setErr(problem(e, 'Could not retry.'));
    } finally {
      setBusy(null);
    }
  };

  const follow = payload?.followUpDate ?? followUpDate;
  return (
    <section className="rf2-card" aria-labelledby="msgs-h">
      <h3 id="msgs-h" className="rf2-card__title">Messages</h3>
      <p className="rf2-file__muted">Follow-up on this file: {follow ? day(follow) : 'not set'}. Sending does not change it.</p>
      {missing ? <p className="rf2-file__muted">Message history is not available on this file.</p> : null}
      {!payload && !missing ? <p className="rf2-file__muted">Loading message history.</p> : null}
      {payload ? (
        <>
          <p className="rf2-file__muted">Recipient {payload.destination}. The candidate is not emailed.</p>
          <form className="rf2-file__request" onSubmit={(e) => { e.preventDefault(); void send(); }}>
            <SelectV2 label="Template" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">Choose a template</option>
              {payload.templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </SelectV2>
            <ButtonV2 kind="secondary" size="sm" type="submit" loading={busy === 'send'} disabled={!templateId}>Send to local test</ButtonV2>
          </form>
          {payload.attempts.length === 0 ? <p className="rf2-file__muted">No attempts yet.</p> : (
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
          )}
        </>
      ) : null}
      {err ? <p className="rf2-form-error" role="alert">{err}</p> : null}
    </section>
  );
}
