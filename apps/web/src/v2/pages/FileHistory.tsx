import { useEffect, useState } from 'react';
import { Download, Eye, FileText, MessageCircle, RotateCw } from 'lucide-react';
import { ApiError, downloadFileApi, getApi, postApi } from '../../api/client';
import { ButtonV2 } from '../../components/v2/Button';
import { InputV2, SelectV2 } from '../../components/v2/Field';
import { StatusChip } from '../../components/v2/StatusChip';
import { downloadDocument, loadMessageSection, requestWhatsAppLink, type FileDocument, type FileMessages, type FileWhatsAppTemplate, type SectionState } from '../api/applicationFile';
import { canRetrySection, classifyReadError, isSectionKnown, sectionProblem } from '../api/sectionState';

type HistDoc = FileDocument & {
  hasFile?: boolean;
  scanStatus?: string | null;
  fileSize?: number | null;
  version?: number;
  downloads?: Array<{ at: string }>;
};
type HistRequest = {
  id: string;
  documentType: string;
  at: string;
  status?: 'Requested' | 'Received' | 'Verified';
  matchedDocumentId?: string | null;
  matchedDocumentName?: string | null;
  associationKind?: 'uploaded_after_request' | 'matched_existing' | 'verified_check' | 'none';
  deliveryMode?: string;
};
type PortalLinkState = {
  status: 'active' | 'none' | 'revoked';
  expiresAt?: string | null;
  portalPath?: string | null;
};
type HistoryPayload = { documents: HistDoc[]; requests: HistRequest[]; portalLink?: PortalLinkState };
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
function associationLabel(row: HistRequest): string | null {
  if (row.associationKind === 'uploaded_after_request') {
    return `Uploaded after request${row.matchedDocumentName ? ` (${row.matchedDocumentName})` : ''}`;
  }
  if (row.associationKind === 'matched_existing') {
    return `Matched to existing document${row.matchedDocumentName ? ` (${row.matchedDocumentName})` : ''}`;
  }
  if (row.associationKind === 'verified_check') {
    return 'Matched via verified check';
  }
  return null;
}

type HistoryRead =
  | { status: 'loading' }
  | { status: 'ready'; docs: HistDoc[]; requests: HistRequest[]; portalLink?: PortalLinkState }
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
  const [portalBusy, setPortalBusy] = useState<'issue' | 'revoke' | null>(null);
  const [issuedPortalLink, setIssuedPortalLink] = useState<{ portalPath: string; expiresAt: string } | null>(null);
  const [portalCopied, setPortalCopied] = useState(false);
  const [err, setErr] = useState<string | undefined>();
  const [preview, setPreview] = useState<{ name: string; url: string } | null>(null);
  const [reload, setReload] = useState(0);
  const hasSection = section !== undefined;
  const parentKnown = section ? isSectionKnown(section) : fallbackKnown;
  const parentUnavailable = section?.status === 'unavailable';
  const parentLoading = section?.status === 'loading';
  const parentError = section ? section.status === 'error' : !fallbackKnown;

  useEffect(() => {
    setIssuedPortalLink(null);
    setPortalCopied(false);
  }, [applicationId]);

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
        setRead({ status: 'ready', docs: payload.documents, requests: payload.requests, portalLink: payload.portalLink });
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
  const portalLink = read.status === 'ready' ? read.portalLink : undefined;
  const portalActive = Boolean(issuedPortalLink || portalLink?.status === 'active');
  const portalExpiresAt = issuedPortalLink?.expiresAt ?? portalLink?.expiresAt ?? null;
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
  const managePortalLink = async (action: 'issue' | 'revoke') => {
    if (requestUnavailable || requestDisabled || portalBusy) return;
    setPortalBusy(action);
    setPortalCopied(false);
    setErr(undefined);
    try {
      const res = await postApi<{ status: 'active' | 'revoked'; portalPath?: string | null; expiresAt?: string | null }>(
        `/applications/${encodeURIComponent(applicationId)}/document-portal-link`,
        { action },
      );
      if (action === 'issue' && res.portalPath && res.expiresAt) {
        setIssuedPortalLink({ portalPath: res.portalPath, expiresAt: res.expiresAt });
      } else {
        setIssuedPortalLink(null);
      }
      setReload((n) => n + 1);
    } catch (e) {
      setErr(problem(e, action === 'issue' ? 'Could not issue upload link.' : 'Could not revoke upload link.'));
    } finally {
      setPortalBusy(null);
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
          {requests.map((row) => {
            const assoc = associationLabel(row);
            const delivery = row.deliveryMode === 'portal_link_active' ? 'Upload link active' : 'Internal request';
            return (
              <li key={row.id}>
                <FileText aria-hidden="true" />
                <div className="rf2-docs__body">
                  <p>{row.documentType} requested · {day(row.at)}</p>
                  <p className="rf2-file__muted">{[delivery, assoc].filter(Boolean).join(' · ')}</p>
                </div>
                {row.status ? <StatusChip tone={row.status === 'Verified' ? 'success' : row.status === 'Received' ? 'info' : 'warning'} label={row.status} /> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      <p className="rf2-file__muted">Metadata-only rows stay in history without a downloadable file. Document requests are tracked on this file (Requested → Received → Verified); issue an upload link to let the candidate upload requested files.</p>
      {!requestUnavailable ? (
        <>
          <form className="rf2-file__request" onSubmit={(e) => { e.preventDefault(); void ask(); }}>
            <InputV2 label="Document type" value={type} disabled={requestDisabled} onChange={(e) => setType(e.target.value)} error={err} />
            <ButtonV2 kind="secondary" size="sm" type="submit" loading={busy} disabled={requestDisabled}>Request this document</ButtonV2>
          </form>
          <div className="rf2-file__request" aria-label="Candidate upload link">
            <span className="rf2-file__muted">
              {portalActive
                ? `Upload link active${portalExpiresAt ? ` until ${day(portalExpiresAt)}` : ''}.${issuedPortalLink ? ` ${issuedPortalLink.portalPath}` : ''}`
                : portalLink?.status === 'revoked'
                  ? 'Upload link revoked — requests stay internal until a new link is issued.'
                  : 'No candidate upload link active — requests stay internal on this file.'}
            </span>
            {issuedPortalLink?.portalPath ? (
              <ButtonV2
                kind="secondary"
                size="sm"
                type="button"
                disabled={requestDisabled}
                onClick={() => {
                  const full = typeof window !== 'undefined' ? `${window.location.origin}${issuedPortalLink.portalPath}` : issuedPortalLink.portalPath;
                  void navigator.clipboard?.writeText(full);
                  setPortalCopied(true);
                }}
              >
                {portalCopied ? 'Copied upload link' : 'Copy upload link'}
              </ButtonV2>
            ) : null}
            <ButtonV2
              kind="secondary"
              size="sm"
              type="button"
              loading={portalBusy === 'issue'}
              disabled={requestDisabled || Boolean(portalBusy)}
              onClick={() => void managePortalLink('issue')}
            >
              {portalActive ? 'Reissue upload link' : 'Issue upload link'}
            </ButtonV2>
            {portalActive ? (
              <ButtonV2
                kind="secondary"
                size="sm"
                type="button"
                loading={portalBusy === 'revoke'}
                disabled={requestDisabled || Boolean(portalBusy)}
                onClick={() => void managePortalLink('revoke')}
              >
                Revoke upload link
              </ButtonV2>
            ) : null}
          </div>
        </>
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

export interface WhatsAppSendContext {
  phone?: string | null;
  candidateName?: string;
  positionTitle?: string;
  organizationName?: string;
  stageName?: string;
  interviewType?: string;
  interviewDate?: string;
  interviewTime?: string;
  interviewerName?: string;
  roomLink?: string;
  recruiterName?: string;
}

function fillWhatsApp(body: string, ctx: WhatsAppSendContext): string {
  const vars: Record<string, string> = {
    candidateName: ctx.candidateName ?? '',
    positionTitle: ctx.positionTitle ?? '',
    organizationName: ctx.organizationName ?? '',
    stageName: ctx.stageName ?? '',
    interviewType: ctx.interviewType ?? '',
    interviewDate: ctx.interviewDate ?? '',
    interviewTime: ctx.interviewTime ?? '',
    interviewerName: ctx.interviewerName ?? '',
    roomLink: ctx.roomLink ?? '',
    recruiterName: ctx.recruiterName ?? '',
  };
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (token, key: string) => {
    const value = vars[key];
    return typeof value === 'string' && value.trim() ? value : token;
  });
}

function pickWaTemplate(list: FileWhatsAppTemplate[], ctx: WhatsAppSendContext): FileWhatsAppTemplate | undefined {
  const stage = (ctx.stageName ?? '').trim().toLowerCase();
  const interview = (ctx.interviewType ?? '').trim();
  const wanted = stage === 'rejected' || stage === 'withdrawn'
    ? 'rejection'
    : stage === 'offer' || stage === 'pre-hire' || stage === 'joined'
      ? 'offer_next_step'
      : stage === 'interview' || stage === 'screening'
        ? 'interview_invite'
        : 'ack';
  if (wanted === 'interview_invite' && interview && interview !== 'Any') {
    const typed = list.find((t) => t.category === 'interview_invite' && t.interviewType === interview);
    if (typed) return typed;
  }
  return list.find((t) => t.category === wanted) ?? list.find((t) => t.isDefault) ?? list[0];
}

const WHATSAPP_MESSAGE_TYPES = [
  ['ack', 'Application acknowledgement'],
  ['interview_invite', 'Interview invitation'],
  ['offer_next_step', 'Offer / next steps'],
  ['rejection', 'Rejection'],
  ['misc', 'Other'],
] as const;

/** Candidate files use saved active templates; only admins author their contents. */
function WhatsAppMessage({
  applicationId,
  templates,
  context,
  whatsappReady,
}: {
  applicationId: string;
  templates?: FileWhatsAppTemplate[];
  context: WhatsAppSendContext;
  whatsappReady?: boolean;
}) {
  const [messageType, setMessageType] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [waBusy, setWaBusy] = useState(false);
  const [waError, setWaError] = useState<string | null>(null);
  const typeTemplates = templates?.filter((template) => template.category === messageType) ?? [];
  const pool = typeTemplates.length ? typeTemplates : templates ?? [];
  const active = pool.find((template) => template.id === templateId) ?? pickWaTemplate(pool, context);
  if (!active) {
    return <p className="rf2-file__muted" role="status">{templates
      ? 'No active WhatsApp templates. Ask an admin to add a template.'
      : 'WhatsApp templates are unavailable. Ask an admin to check template setup.'}</p>;
  }

  const types = [...new Set(templates?.map((template) => template.category))];
  const choices = templates?.filter((template) => template.category === active.category);
  const message = fillWhatsApp(active.bodyTemplate, context);
  const candidateName = context.candidateName?.trim() || 'Candidate';
  const phone = context.phone?.trim() ?? '';
  const digits = phone.replace(/[\s().-]/g, '').replace(/^(?:\+|00)/, '');
  const phoneReady = /^[1-9]\d{7,14}$/.test(digits);
  const serverPhoneReady = !phoneReady && Boolean(whatsappReady);
  const missing = [...new Set(Array.from(message.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g), (match) => match[1]))];
  const problem = !phoneReady && !serverPhoneReady
    ? 'Add a valid mobile number with country code in the candidate profile.'
    : missing.length
      ? 'Complete the missing details or ask an admin to update this template: ' + missing.map((key) => key.replace(/([A-Z])/g, ' $1').toLowerCase()).join(', ') + '.'
      : !message.trim() ? 'This template is empty. Choose another template or contact an admin.' : null;

  const openAuthorizedWhatsApp = async () => {
    if (waBusy) return;
    setWaBusy(true);
    setWaError(null);
    try {
      const res = await requestWhatsAppLink(applicationId, { templateId: active.id });
      window.open(res.waLink, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setWaError(e instanceof ApiError || e instanceof Error ? e.message : 'Could not open WhatsApp for this candidate.');
    } finally {
      setWaBusy(false);
    }
  };

  return (
    <div className="rf2-wa-message">
      <div className="rf2-wa-message__head">
        <SelectV2 label="Message type" value={active.category} onChange={(event) => { setMessageType(event.target.value); setTemplateId(''); setWaError(null); }}>
          {types.map((type) => <option key={type} value={type}>{WHATSAPP_MESSAGE_TYPES.find(([id]) => id === type)?.[1] ?? type}</option>)}
        </SelectV2>
        <SelectV2 label="WhatsApp template" value={active.id} onChange={(event) => { setMessageType(active.category); setTemplateId(event.target.value); setWaError(null); }}>
          {choices?.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
        </SelectV2>
      </div>
      <div className="rf2-wa-message__chat">
        <div className="rf2-wa-message__chat-head">
          <span className="rf2-wa-message__avatar" aria-hidden="true">{candidateName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span>
          <p className="rf2-wa-message__recipient"><strong>{candidateName}</strong><span dir="ltr">{phone || (serverPhoneReady ? 'Mobile on file (masked)' : 'No mobile number')}</span></p>
          <span className="rf2-wa-message__chat-label"><MessageCircle aria-hidden="true" /> Preview</span>
        </div>
        <div className="rf2-wa-message__chat-body">
          <div className="rf2-wa-message__preview" role="region" aria-label="WhatsApp message preview" aria-live="polite">
            <p dir="auto">{message}</p>
          </div>
        </div>
      </div>
      {problem ? <p className="rf2-file__muted" role="status">{problem}</p> : null}
      {waError ? <p className="rf2-form-error" role="alert">{waError}</p> : null}
      <div className="rf2-wa-message__footer">
        <p className="rf2-file__muted">Prepared by admin. Review and edit in WhatsApp before sending.</p>
        {problem ? <ButtonV2 kind="secondary" size="sm" disabled>Open in WhatsApp</ButtonV2> : phoneReady ? (
          <a className="rf2-btn rf2-btn--secondary rf2-btn--sm rf2-wa-open-btn" href={'https://wa.me/' + digits + '?text=' + encodeURIComponent(message)} target="_blank" rel="noopener noreferrer">Open in WhatsApp</a>
        ) : (
          <ButtonV2 kind="secondary" size="sm" loading={waBusy} onClick={() => void openAuthorizedWhatsApp()}>Open in WhatsApp</ButtonV2>
        )}
      </div>
    </div>
  );
}

/** Templates and queued, sent, and failed attempts. Retry of a failed send adds a row and leaves the failed attempt. */
export function MessagesCard({ applicationId, followUpDate, omitAttempts = false, showDeliveryDestination = false, read, onReload, whatsappContext }: { applicationId: string; followUpDate: string | null; omitAttempts?: boolean; showDeliveryDestination?: boolean; read?: SectionState<MessagePayload>; onReload?: () => void; whatsappContext?: WhatsAppSendContext }) {
  const [localRead, setLocalRead] = useState<SectionState<MessagePayload>>({ status: 'loading' });
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
  const readProblem = sectionProblem('Messages', section);
  const attemptsEmpty = payload ? payload.attempts.length === 0 : false;
  const attemptBlock = payload && !omitAttempts ? (
    <>
      {attemptsEmpty ? <p className="rf2-file__muted">No attempts yet.</p> : null}
      {payload.attempts.length > 0 ? (
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
  ) : null;
  return (
    <section className="rf2-card" aria-labelledby="msgs-h">
      <h3 id="msgs-h" className="rf2-card__title">Messages</h3>
      <p className="rf2-file__muted">Follow-up on this file: {follow ? day(follow) : 'not set'}. Sending does not change it.</p>
      {showDeliveryDestination && payload?.destination ? <p className="rf2-file__muted">Recipient {payload.destination}. The candidate is not emailed.</p> : null}
      {section.status === 'loading' ? <p className="rf2-file__muted">Loading message history.</p> : null}
      {readProblem && section.status !== 'loading' ? (
        <div className="rf2-file__section" role="alert" data-tone={readProblem.tone === 'unavailable' ? 'unavailable' : readProblem.tone === 'transient' ? 'warning' : 'danger'}>
          <p>{readProblem.message}</p>
          {section.status === 'error' ? <ButtonV2 kind="secondary" size="sm" icon={<RotateCw />} onClick={reloadRead}>Retry messages</ButtonV2> : null}
        </div>
      ) : null}
      {payload && whatsappContext ? (
        <WhatsAppMessage
          key={applicationId}
          applicationId={applicationId}
          templates={payload.whatsappTemplates}
          context={whatsappContext}
          whatsappReady={payload.whatsappReady}
        />
      ) : null}
      {payload ? attemptBlock : null}
      {err ? <p className="rf2-form-error" role="alert">{err}</p> : null}
    </section>
  );
}
