import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { PublicJob } from '@recruitflow/contracts';
import { getApi } from '../api/client';
import { Icon } from '../components/Icon';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PageState } from '../components/ui/PageState';
import { PublicSiteLayout } from './PublicSiteLayout';

export function PublicJobDetailPage() {
  const { organizationCode = '', vacancyCode = '' } = useParams<{ organizationCode: string; vacancyCode: string }>();
  const [job, setJob] = useState<PublicJob | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  const loadJob = useCallback(async () => {
    setStatus('loading');
    try {
      setJob(await getApi<PublicJob>(`/public/organizations/${encodeURIComponent(organizationCode)}/jobs/${encodeURIComponent(vacancyCode)}`));
      setStatus('ready');
    } catch (reason) {
      setStatus('error');
      setError(reason instanceof Error ? reason.message : 'This role could not be loaded.');
    }
  }, [organizationCode, vacancyCode]);

  useEffect(() => { void loadJob(); }, [loadJob]);

  return (
    <PublicSiteLayout organizationCode={organizationCode} organizationName={job?.organizationName}>
      <main className="mx-auto w-full max-w-[960px] px-4 py-8 sm:px-6 sm:py-12">
        {status === 'loading' && <PageState kind="loading" title="Loading role" description="Fetching the position details." />}
        {status === 'error' && <PageState kind="not-found" title="Role unavailable" description={error} actionLabel="Browse open roles" actionHref={`/careers/${encodeURIComponent(organizationCode)}/jobs`} />}
        {status === 'ready' && job && (
          <>
            <Link to={`/careers/${encodeURIComponent(organizationCode)}/jobs`} className="mb-6 inline-flex min-h-9 items-center gap-1.5 text-xs font-bold text-rf-action no-underline hover:text-rf-action-strong"><Icon name="arrow-left" size={14} /> All open roles</Link>
            <section className="rounded-3xl border border-rf-border bg-rf-surface p-6 shadow-[var(--shadow-sm)] sm:p-9">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="m-0 text-[10px] font-extrabold uppercase tracking-[0.14em] text-rf-action">{job.vacancyCode}</p>
                  <h1 className="mt-2 font-rf-heading text-3xl font-extrabold tracking-[-0.04em] text-rf-ink sm:text-4xl">{job.positionTitle}</h1>
                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-rf-ink-muted">
                    <span className="inline-flex items-center gap-1.5"><Icon name="building" size={14} />{job.branchName}</span>
                    {job.location && <span className="inline-flex items-center gap-1.5"><Icon name="globe" size={14} />{job.location}</span>}
                    {job.employmentType && <span>{job.employmentType}</span>}
                  </div>
                </div>
                <Button variant="primary" size="lg" className="shrink-0 rounded-xl" asChild><Link to={`/careers/${encodeURIComponent(organizationCode)}/jobs/${encodeURIComponent(vacancyCode)}/apply`}>Apply for this role <Icon name="arrow-right" size={15} /></Link></Button>
              </div>
            </section>

            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
              <Card className="p-6 sm:p-7">
                <h2 className="m-0 font-rf-heading text-base font-extrabold text-rf-ink">About the role</h2>
                <p className="mt-4 whitespace-pre-line text-sm font-medium leading-7 text-rf-ink-muted">{job.description || 'The hiring team has not added a role description yet. Submit your profile and we will review your experience against this opening.'}</p>
                {job.responsibilities && (
                  <div className="mt-7 border-t border-rf-border-subtle pt-5">
                    <h3 className="m-0 text-xs font-extrabold uppercase tracking-[0.1em] text-rf-ink-muted">Key responsibilities</h3>
                    <p className="mt-3 whitespace-pre-line text-sm font-medium leading-7 text-rf-ink-muted">{job.responsibilities}</p>
                  </div>
                )}
                {job.qualifications && (
                  <div className="mt-7 border-t border-rf-border-subtle pt-5">
                    <h3 className="m-0 text-xs font-extrabold uppercase tracking-[0.1em] text-rf-ink-muted">Required qualifications</h3>
                    <p className="mt-3 whitespace-pre-line text-sm font-medium leading-7 text-rf-ink-muted">{job.qualifications}</p>
                  </div>
                )}
                {job.benefits && (
                  <div className="mt-7 border-t border-rf-border-subtle pt-5">
                    <h3 className="m-0 text-xs font-extrabold uppercase tracking-[0.1em] text-rf-ink-muted">Benefits & highlights</h3>
                    <p className="mt-3 whitespace-pre-line text-sm font-medium leading-7 text-rf-ink-muted">{job.benefits}</p>
                  </div>
                )}
                {job.requiredSkills.length > 0 && (
                  <div className="mt-7 border-t border-rf-border-subtle pt-5">
                    <h3 className="m-0 text-xs font-extrabold uppercase tracking-[0.1em] text-rf-ink-muted">Skills we are looking for</h3>
                    <div className="mt-3 flex flex-wrap gap-2">{job.requiredSkills.map((skill) => <Badge key={skill} variant="info">{skill}</Badge>)}</div>
                  </div>
                )}
              </Card>
              <aside className="grid content-start gap-3">
                <Card className="p-5">
                  <h2 className="m-0 text-xs font-extrabold uppercase tracking-[0.1em] text-rf-ink-muted">Role snapshot</h2>
                  <dl className="mt-4 grid gap-3 text-xs">
                    <div><dt className="font-semibold text-rf-ink-muted">Organization</dt><dd className="m-0 mt-0.5 font-bold text-rf-ink">{job.organizationName}</dd></div>
                    {job.minExperienceYears !== null && <div><dt className="font-semibold text-rf-ink-muted">Experience</dt><dd className="m-0 mt-0.5 font-bold text-rf-ink">{job.minExperienceYears}+ years</dd></div>}
                    {job.targetStartDate && <div><dt className="font-semibold text-rf-ink-muted">Target start</dt><dd className="m-0 mt-0.5 font-bold text-rf-ink">{new Date(`${job.targetStartDate}T00:00:00`).toLocaleDateString()}</dd></div>}
                  </dl>
                </Card>
                <Alert tone="info" title="A fair, direct application">Your profile goes straight to the hiring organization. You can apply once per opening.</Alert>
              </aside>
            </div>
          </>
        )}
      </main>
    </PublicSiteLayout>
  );
}
