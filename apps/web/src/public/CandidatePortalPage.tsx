import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getApi, postApi, postFormDataApi, ApiError } from '../api/client';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FormField } from '../components/ui/FormField';
import { Input } from '../components/ui/Input';
import { PageState } from '../components/ui/PageState';
import { PublicSiteLayout } from './PublicSiteLayout';
import { parsePortalToken } from './portal-link';

interface PortalDocument {
  id: string;
  documentType: string;
  fileName: string;
  scanStatus: string;
  awaitingVerification: boolean;
}

interface PortalView {
  applicationCode: string;
  stage: string;
  positionTitle: string;
  vacancyCode: string;
  vacancyStatus: string;
  organizationCode: string;
  organizationName: string;
  candidateFirstName: string;
  requests: Array<{ id: string; documentType: string; at: string }>;
  documents: PortalDocument[];
}

interface UploadResult {
  fileName: string;
  scanStatus: string;
  awaitingVerification: boolean;
  joiningCheckCompleted: boolean;
  licenceCheckCompleted: boolean;
}

function verificationLabel(status: string): string {
  if (status === 'AwaitingVerification') return 'Awaiting verification';
  return status;
}

export function CandidatePortalPage() {
  const navigate = useNavigate();
  const { token: tokenParam = '' } = useParams<{ token?: string }>();
  const [searchParams] = useSearchParams();
  const token = tokenParam || searchParams.get('token') || '';
  const [linkDraft, setLinkDraft] = useState('');
  const [linkError, setLinkError] = useState('');
  const [view, setView] = useState<PortalView | null>(null);
  const [status, setStatus] = useState<'entry' | 'loading' | 'ready' | 'unusable'>('entry');
  const [error, setError] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactResult, setContactResult] = useState('');
  const [contactError, setContactError] = useState('');

  const load = useCallback(async (quiet = false) => {
    if (!token) {
      setStatus('entry');
      setView(null);
      return;
    }
    if (!quiet) setStatus('loading');
    setError('');
    try {
      const next = await getApi<PortalView>(`/public/portal/${encodeURIComponent(token)}`);
      setView(next);
      setDocumentType((current) => current || next.requests[0]?.documentType || '');
      setStatus('ready');
    } catch (reason) {
      setView(null);
      setStatus('unusable');
      setError(reason instanceof ApiError || reason instanceof Error ? reason.message : 'This link is no longer available.');
    }
  }, [token]);

  useEffect(() => { void load(false); }, [load]);

  const openLink = (event: FormEvent) => {
    event.preventDefault();
    const parsed = parsePortalToken(linkDraft);
    if (!parsed) {
      setLinkError('A reference number does not open an application. Paste the link from your receipt.');
      return;
    }
    navigate(`/portal/applications/${encodeURIComponent(parsed)}`);
  };

  const upload = async (event: FormEvent) => {
    event.preventDefault();
    if (!file || !documentType) {
      setUploadError('Choose the requested document and a file.');
      return;
    }
    setUploading(true);
    setUploadError('');
    try {
      const body = new FormData();
      body.append('documentType', documentType);
      body.append('file', file);
      const result = await postFormDataApi<UploadResult>(`/public/portal/${encodeURIComponent(token)}/documents`, body);
      setUploadResult(result);
      setFile(null);
      await load(true);
    } catch (reason) {
      setUploadError(reason instanceof Error ? reason.message : 'The file could not be uploaded.');
    } finally {
      setUploading(false);
    }
  };

  const sendContact = async (event: FormEvent) => {
    event.preventDefault();
    setContactError('');
    setContactResult('');
    try {
      const result = await postApi<{ message: string }>('/public/portal/contact', {
        name: contactName,
        message: contactMessage,
      });
      setContactResult(result.message);
      setContactName('');
      setContactMessage('');
    } catch (reason) {
      setContactError(reason instanceof Error ? reason.message : 'The note could not be sent.');
    }
  };

  const organizationCode = view?.organizationCode ?? '';

  return (
    <PublicSiteLayout organizationCode={organizationCode || undefined} organizationName={view?.organizationName}>
      <main className="mx-auto w-full max-w-[760px] px-4 py-8 sm:px-6 sm:py-12">
        {status === 'loading' && <PageState kind="loading" title="Opening your application" description="Checking this link." />}
        {status === 'entry' && (
          <Card className="p-5 sm:p-7">
            <p className="m-0 text-[10px] font-extrabold uppercase tracking-[0.14em] text-rf-action">Your applications</p>
            <h1 className="mt-2 font-rf-heading text-3xl font-extrabold tracking-[-0.04em] text-rf-ink">Open your application</h1>
            <p className="mt-2 text-sm font-medium leading-6 text-rf-ink-muted">Paste the link from the receipt on your application screen. This page lists only that application.</p>
            <form onSubmit={openLink} className="mt-6 grid gap-4" noValidate>
              {linkError && <Alert tone="danger" title="Link needed">{linkError}</Alert>}
              <FormField id="portal-link" label="Receipt link" required>
                <Input value={linkDraft} onChange={(event) => { setLinkDraft(event.target.value); setLinkError(''); }} autoComplete="off" />
              </FormField>
              <div className="flex justify-end">
                <Button type="submit" variant="primary" className="rounded-xl">Open application</Button>
              </div>
            </form>
          </Card>
        )}
        {status === 'unusable' && (
          <Card className="p-5 sm:p-7">
            <h1 className="font-rf-heading text-2xl font-extrabold tracking-tight text-rf-ink">This link is no longer available</h1>
            <p className="mt-3 text-sm font-medium leading-6 text-rf-ink-muted" role="alert">{error}</p>
            <form onSubmit={(event) => void sendContact(event)} className="mt-6 grid gap-4" noValidate>
              <h2 className="m-0 font-rf-heading text-base font-extrabold text-rf-ink">Contact the hiring team</h2>
              <p className="m-0 text-xs font-medium text-rf-ink-muted">This note does not open an application.</p>
              {contactError && <Alert tone="danger" title="Note not sent">{contactError}</Alert>}
              {contactResult && <Alert tone="success" title="Note received">{contactResult}</Alert>}
              <FormField id="portal-contact-name" label="Your name" required>
                <Input value={contactName} onChange={(event) => setContactName(event.target.value)} autoComplete="name" />
              </FormField>
              <FormField id="portal-contact-message" label="Message" required>
                <textarea id="portal-contact-message" value={contactMessage} onChange={(event) => setContactMessage(event.target.value)} required minLength={2} maxLength={500} className="min-h-28 w-full rounded-xl border border-rf-border bg-rf-surface px-3 py-2 text-sm text-rf-ink" />
              </FormField>
              <div className="flex justify-end">
                <Button type="submit" variant="primary" className="rounded-xl">Send note</Button>
              </div>
            </form>
          </Card>
        )}
        {status === 'ready' && view && (
          <>
            <p className="m-0 text-[10px] font-extrabold uppercase tracking-[0.14em] text-rf-action">Your application</p>
            <h1 className="mt-2 font-rf-heading text-3xl font-extrabold tracking-[-0.04em] text-rf-ink">{view.positionTitle}</h1>
            <p className="mt-2 text-sm font-medium text-rf-ink-muted">Hello {view.candidateFirstName}. This page shows this application only.</p>
            <Card className="mt-6 p-5 sm:p-7">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div className="min-w-0"><dt className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-rf-ink-muted">Reference</dt><dd className="mt-1 text-sm font-bold text-rf-ink">{view.applicationCode}</dd></div>
                <div><dt className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-rf-ink-muted">Stage</dt><dd className="mt-1 text-sm font-bold text-rf-ink">{view.stage}</dd></div>
                <div><dt className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-rf-ink-muted">Job</dt><dd className="mt-1 text-sm font-bold text-rf-ink">{view.vacancyCode}</dd></div>
                <div><dt className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-rf-ink-muted">Job status</dt><dd className="mt-1 text-sm font-bold text-rf-ink">{view.vacancyStatus}</dd></div>
              </dl>
            </Card>
            <Card className="mt-4 p-5 sm:p-7">
              <h2 className="m-0 font-rf-heading text-base font-extrabold text-rf-ink">Requested documents</h2>
              {view.requests.length === 0 ? (
                <p className="mt-3 text-sm font-medium text-rf-ink-muted">No document has been requested yet.</p>
              ) : (
                <ul className="mt-3 grid gap-2">
                  {view.requests.map((request) => (
                    <li key={request.id} className="rounded-xl bg-rf-surface-subtle px-3 py-2 text-sm font-semibold text-rf-ink">{request.documentType}</li>
                  ))}
                </ul>
              )}
              {view.documents.length > 0 && (
                <ul className="mt-4 grid gap-2" aria-label="Your files">
                  {view.documents.map((doc) => (
                    <li key={doc.id} className="flex min-w-0 flex-col gap-1 rounded-xl border border-rf-border-subtle px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="min-w-0 truncate text-sm font-semibold text-rf-ink">{doc.fileName}</span>
                      <span className="text-xs font-bold text-rf-ink-muted">{verificationLabel(doc.scanStatus)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {view.requests.length > 0 && (
                <form onSubmit={(event) => void upload(event)} className="mt-5 grid gap-4" noValidate>
                  {uploadError && <Alert tone="danger" title="Upload not accepted">{uploadError}</Alert>}
                  {uploadResult?.awaitingVerification && (
                    <Alert tone="success" title="Awaiting verification">
                      {uploadResult.fileName} is awaiting verification. It does not complete a joining check or a licence check.
                    </Alert>
                  )}
                  <FormField id="portal-document-type" label="Requested document">
                    <select id="portal-document-type" value={documentType} onChange={(event) => setDocumentType(event.target.value)} className="h-10 w-full rounded-xl border border-rf-border bg-rf-surface px-3 text-sm text-rf-ink">
                      {view.requests.map((request) => <option key={request.id} value={request.documentType}>{request.documentType}</option>)}
                    </select>
                  </FormField>
                  <FormField id="portal-file" label="File" hint="PDF, DOC, or DOCX. Maximum 2 MB. ZIP archives are not accepted.">
                    <input id="portal-file" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="block w-full text-xs text-rf-ink file:mr-3 file:rounded-xl file:border-0 file:bg-rf-action-soft file:px-3 file:py-2 file:text-xs file:font-bold file:text-rf-action" />
                  </FormField>
                  <div className="flex justify-end">
                    <Button type="submit" variant="primary" className="rounded-xl" loading={uploading} loadingLabel="Uploading">Upload</Button>
                  </div>
                </form>
              )}
            </Card>
            <p className="mt-4 text-xs font-medium text-rf-ink-muted"><Link className="font-bold text-rf-action no-underline" to="/my-applications">Use a different receipt link</Link></p>
          </>
        )}
      </main>
    </PublicSiteLayout>
  );
}
