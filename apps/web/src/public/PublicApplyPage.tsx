import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import type { PublicApplicationResponse, PublicJob } from '@recruitflow/contracts';
import { getApi, postApi, postFormDataApi } from '../api/client';
import { Icon } from '../components/Icon';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FormField } from '../components/ui/FormField';
import { Input } from '../components/ui/Input';
import { PageState } from '../components/ui/PageState';
import { PublicSiteLayout } from './PublicSiteLayout';

interface ApplicationForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  currentTitle: string;
  currentCompany: string;
  location: string;
  skills: string;
  source: string;
  consentAccepted: boolean;
}

const initialForm: ApplicationForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  currentTitle: '',
  currentCompany: '',
  location: '',
  skills: '',
  source: 'career-site',
  consentAccepted: false,
};

export function PublicApplyPage() {
  const { organizationCode = '', vacancyCode = '' } = useParams<{ organizationCode: string; vacancyCode: string }>();
  const [searchParams] = useSearchParams();
  const [job, setJob] = useState<PublicJob | null>(null);
  const [form, setForm] = useState<ApplicationForm>(() => ({ ...initialForm, source: searchParams.get('source') || 'career-site' }));
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'submitting' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [confirmation, setConfirmation] = useState<PublicApplicationResponse | null>(null);

  const loadJob = useCallback(async () => {
    try {
      setJob(await getApi<PublicJob>(`/public/organizations/${encodeURIComponent(organizationCode)}/jobs/${encodeURIComponent(vacancyCode)}`));
      setStatus('ready');
    } catch (reason) {
      setStatus('error');
      setError(reason instanceof Error ? reason.message : 'This role is no longer accepting applications.');
    }
  }, [organizationCode, vacancyCode]);

  useEffect(() => { void loadJob(); }, [loadJob]);

  const update = <K extends keyof ApplicationForm>(key: K, value: ApplicationForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldError('');
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.consentAccepted) {
      setFieldError('Please accept the privacy and application consent before submitting.');
      return;
    }
    const email = form.email.trim();
    const phoneDigits = form.phone.replace(/\D/g, '');
    if (!email && phoneDigits.length < 7) {
      setFieldError('Provide a valid email address or phone number so the hiring team can contact you.');
      return;
    }
    setStatus('submitting');
    setError('');
    try {
      let response: PublicApplicationResponse;
      if (cvFile) {
        const formData = new FormData();
        formData.append('firstName', form.firstName);
        formData.append('lastName', form.lastName);
        if (email) formData.append('email', email);
        if (form.phone) formData.append('phone', form.phone);
        if (form.currentTitle) formData.append('currentTitle', form.currentTitle);
        if (form.currentCompany) formData.append('currentCompany', form.currentCompany);
        if (form.location) formData.append('location', form.location);
        if (form.skills) formData.append('skills', form.skills);
        if (form.source) formData.append('source', form.source);
        formData.append('consentAccepted', String(form.consentAccepted));
        formData.append('cv', cvFile);
        response = await postFormDataApi<PublicApplicationResponse>(`/public/organizations/${encodeURIComponent(organizationCode)}/jobs/${encodeURIComponent(vacancyCode)}/apply`, formData);
      } else {
        response = await postApi<PublicApplicationResponse>(`/public/organizations/${encodeURIComponent(organizationCode)}/jobs/${encodeURIComponent(vacancyCode)}/apply`, {
          ...form,
          email: email || null,
          skills: form.skills.split(',').map((skill) => skill.trim()).filter(Boolean),
        });
      }
      setConfirmation(response);
      setStatus('success');
    } catch (reason) {
      setStatus('ready');
      setError(reason instanceof Error ? reason.message : 'Your application could not be submitted.');
    }
  };

  return (
    <PublicSiteLayout organizationCode={organizationCode} organizationName={job?.organizationName}>
      <main className="mx-auto w-full max-w-[960px] px-4 py-8 sm:px-6 sm:py-12">
        {status === 'loading' && <PageState kind="loading" title="Preparing application" description="Loading the role details." />}
        {status === 'error' && <PageState kind="not-found" title="Application unavailable" description={error} actionLabel="Browse open roles" actionHref={`/careers/${encodeURIComponent(organizationCode)}/jobs`} />}
        {status === 'success' && confirmation && job && (
          <Card className="mx-auto max-w-[620px] p-7 text-center sm:p-10">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rf-success-soft text-rf-success-strong" aria-hidden="true"><Icon name="check-circle" size={26} /></span>
            <h1 className="mt-5 font-rf-heading text-2xl font-extrabold tracking-tight text-rf-ink">Application received</h1>
            <p className="mt-3 text-sm font-medium leading-6 text-rf-ink-muted">Thanks for applying for <strong className="text-rf-ink">{job.positionTitle}</strong>. The hiring team will review your profile.</p>
            <p className="mt-5 rounded-xl bg-rf-surface-subtle px-4 py-3 text-xs font-bold text-rf-ink">Reference: {confirmation.applicationCode}</p>
            <Button className="mt-6 rounded-xl" variant="secondary" asChild><Link to={`/careers/${encodeURIComponent(organizationCode)}/jobs`}>Browse more roles</Link></Button>
          </Card>
        )}
        {status !== 'loading' && status !== 'error' && status !== 'success' && job && (
          <>
            <Link to={`/careers/${encodeURIComponent(organizationCode)}/jobs/${encodeURIComponent(vacancyCode)}`} className="mb-6 inline-flex min-h-9 items-center gap-1.5 text-xs font-bold text-rf-action no-underline hover:text-rf-action-strong"><Icon name="arrow-left" size={14} /> Back to role</Link>
            <div className="mb-6">
              <p className="m-0 text-[10px] font-extrabold uppercase tracking-[0.14em] text-rf-action">Apply now</p>
              <h1 className="mt-2 font-rf-heading text-3xl font-extrabold tracking-[-0.04em] text-rf-ink">{job.positionTitle}</h1>
              <p className="mt-2 text-sm font-medium text-rf-ink-muted">{job.organizationName} · {job.branchName}</p>
            </div>
            <Card className="p-5 sm:p-7">
              <form onSubmit={(event) => void submit(event)} noValidate className="grid gap-6">
                {error && <Alert tone="danger" title="Application not submitted">{error}</Alert>}
                <section>
                  <h2 className="m-0 font-rf-heading text-base font-extrabold text-rf-ink">Your details</h2>
                  <p className="mt-1 text-xs font-medium text-rf-ink-muted">Share the essentials so the hiring team can contact you.</p>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <FormField id="public-first-name" label="First name" required><Input value={form.firstName} onChange={(event) => update('firstName', event.target.value)} autoComplete="given-name" /></FormField>
                    <FormField id="public-last-name" label="Last name" required><Input value={form.lastName} onChange={(event) => update('lastName', event.target.value)} autoComplete="family-name" /></FormField>
                    <FormField id="public-email" label="Email address" hint="Provide an email or phone number"><Input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} autoComplete="email" /></FormField>
                    <FormField id="public-phone" label="Phone number" hint="Provide an email or phone number"><Input type="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} autoComplete="tel" /></FormField>
                    <FormField id="public-title" label="Current title"><Input value={form.currentTitle} onChange={(event) => update('currentTitle', event.target.value)} autoComplete="organization-title" /></FormField>
                    <FormField id="public-company" label="Current company"><Input value={form.currentCompany} onChange={(event) => update('currentCompany', event.target.value)} autoComplete="organization" /></FormField>
                    <FormField id="public-location" label="Location"><Input value={form.location} onChange={(event) => update('location', event.target.value)} autoComplete="address-level2" /></FormField>
                    <FormField id="public-skills" label="Key skills" hint="Separate skills with commas"><Input value={form.skills} onChange={(event) => update('skills', event.target.value)} placeholder="e.g. stakeholder management, Excel" /></FormField>
                  </div>
                </section>
                <section className="border-t border-rf-border-subtle pt-5">
                  <h2 className="m-0 font-rf-heading text-base font-extrabold text-rf-ink">Resume / Curriculum Vitae</h2>
                  <p className="mt-1 text-xs font-medium text-rf-ink-muted">Attach your CV in PDF, DOC, or DOCX format (maximum 10 MB).</p>
                  <div className="mt-4 max-w-[480px]">
                    <FormField id="public-cv" label="Attach CV / Resume" hint="Supported: .pdf, .doc, .docx (max 10MB)">
                      <input
                        id="public-cv"
                        type="file"
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          setCvFile(file);
                          setFieldError('');
                        }}
                        className="block w-full text-xs text-rf-ink file:mr-4 file:rounded-xl file:border-0 file:bg-rf-action-soft file:px-4 file:py-2.5 file:text-xs file:font-bold file:text-rf-action hover:file:bg-rf-action-soft/80 cursor-pointer"
                        aria-describedby="public-cv-hint"
                      />
                    </FormField>
                    {cvFile && (
                      <div className="mt-2 flex items-center justify-between rounded-xl border border-rf-border-subtle bg-rf-surface-subtle px-3 py-2 text-xs">
                        <span className="truncate font-semibold text-rf-ink">{cvFile.name} ({(cvFile.size / 1024).toFixed(0)} KB)</span>
                        <button
                          type="button"
                          onClick={() => setCvFile(null)}
                          className="text-xs font-bold text-rf-danger hover:underline ml-2"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </section>
                <section className="border-t border-rf-border-subtle pt-5">
                  <h2 className="m-0 font-rf-heading text-base font-extrabold text-rf-ink">Application source</h2>
                  <div className="mt-4 max-w-[420px]"><FormField id="public-source" label="How did you hear about this role?" hint="Used only for hiring source analytics."><Input value={form.source} onChange={(event) => update('source', event.target.value)} placeholder="career-site" /></FormField></div>
                </section>
                <section className="border-t border-rf-border-subtle pt-5">
                  <label className="flex items-start gap-3 text-xs font-medium leading-5 text-rf-ink-muted">
                    <input type="checkbox" checked={form.consentAccepted} onChange={(event) => update('consentAccepted', event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-rf-action" aria-describedby="public-consent-message" />
                    <span id="public-consent-message">I agree that {job.organizationName} may use the information above to assess my application for this role and contact me about the recruitment process. <span className="font-bold text-rf-danger" aria-hidden="true">*</span></span>
                  </label>
                  {fieldError && <p className="mt-2 text-xs font-bold text-rf-danger" role="alert">{fieldError}</p>}
                </section>
                <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
                  <Button variant="ghost" type="button" asChild><Link to={`/careers/${encodeURIComponent(organizationCode)}/jobs/${encodeURIComponent(vacancyCode)}`}>Cancel</Link></Button>
                  <Button variant="primary" type="submit" loading={status === 'submitting'} loadingLabel="Submitting application" className="rounded-xl">Submit application <Icon name="send" size={14} /></Button>
                </div>
              </form>
            </Card>
          </>
        )}
      </main>
    </PublicSiteLayout>
  );
}
