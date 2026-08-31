import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import type { PublicJob, PublicJobsResponse } from '@recruitflow/contracts';
import { getApi } from '../api/client';
import { Icon } from '../components/Icon';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { PageState } from '../components/ui/PageState';
import { PublicSiteLayout } from './PublicSiteLayout';

export function PublicJobsPage() {
  const { organizationCode = '' } = useParams<{ organizationCode: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [result, setResult] = useState<PublicJobsResponse | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  const loadJobs = useCallback(async () => {
    if (!organizationCode) return;
    setStatus('loading');
    setError('');
    try {
      const params = new URLSearchParams();
      const term = search.trim();
      if (term) params.set('search', term);
      const query = params.toString();
      setResult(await getApi<PublicJobsResponse>(`/public/organizations/${encodeURIComponent(organizationCode)}/jobs${query ? `?${query}` : ''}`));
      setStatus('ready');
    } catch (reason) {
      setStatus('error');
      setError(reason instanceof Error ? reason.message : 'The jobs page could not be loaded.');
    }
  }, [organizationCode, search]);

  useEffect(() => { void loadJobs(); }, [loadJobs]);

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = new URLSearchParams(searchParams);
    if (search.trim()) next.set('search', search.trim());
    else next.delete('search');
    setSearchParams(next);
  };

  return (
    <PublicSiteLayout organizationCode={organizationCode} organizationName={result?.organization.name}>
      <main className="mx-auto w-full max-w-[1120px] px-4 py-10 sm:px-6 sm:py-14">
        <section className="mb-9 max-w-[760px]">
          <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-rf-action">Join the team</p>
          <h1 className="m-0 font-rf-heading text-3xl font-extrabold tracking-[-0.04em] text-rf-ink sm:text-5xl">Find work that matters.</h1>
          <p className="mt-4 max-w-[620px] text-sm font-medium leading-7 text-rf-ink-muted sm:text-base">
            Explore current opportunities at {result?.organization.name || 'our organization'} and apply directly to the role that fits your experience.
          </p>
        </section>

        <form onSubmit={submitSearch} className="mb-7 flex flex-col gap-2.5 sm:flex-row" role="search">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search open roles</span>
            <Icon name="search" size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-rf-ink-muted" aria-hidden="true" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by role, skill, or location" className="h-11 rounded-xl bg-rf-surface pl-10" />
          </label>
          <Button type="submit" variant="primary" size="lg" className="h-11 rounded-xl">Search roles</Button>
        </form>

        {status === 'loading' && <PageState kind="loading" title="Loading open roles" description="Checking the latest opportunities." />}
        {status === 'error' && <PageState kind="error" title="Jobs could not be loaded" description={error} actionLabel="Retry" onAction={() => void loadJobs()} />}
        {status === 'ready' && result && (
          result.data.length === 0 ? (
            <PageState kind="empty" title="No open roles found" description={search ? 'Try a different search term or clear the filter.' : 'There are no published opportunities at the moment.'} />
          ) : (
            <section aria-labelledby="open-roles-heading">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id="open-roles-heading" className="m-0 font-rf-heading text-lg font-extrabold tracking-tight text-rf-ink">Open roles</h2>
                <span className="text-[11px] font-bold text-rf-ink-muted">{result.total} {result.total === 1 ? 'opportunity' : 'opportunities'}</span>
              </div>
              <div className="grid gap-3.5 md:grid-cols-2">
                {result.data.map((job) => <PublicJobCard key={job.vacancyCode} job={job} />)}
              </div>
            </section>
          )
        )}
      </main>
    </PublicSiteLayout>
  );
}

function PublicJobCard({ job }: { job: PublicJob }) {
  return (
    <Card interactive className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="m-0 text-[10px] font-extrabold uppercase tracking-[0.12em] text-rf-action">{job.vacancyCode}</p>
          <h3 className="mt-1.5 font-rf-heading text-lg font-extrabold tracking-tight text-rf-ink">{job.positionTitle}</h3>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rf-action-soft text-rf-action" aria-hidden="true"><Icon name="briefcase" size={16} /></span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-semibold text-rf-ink-muted">
        <span className="inline-flex items-center gap-1.5"><Icon name="building" size={13} />{job.branchName}</span>
        {job.location && <span className="inline-flex items-center gap-1.5"><Icon name="globe" size={13} />{job.location}</span>}
        {job.employmentType && <span>{job.employmentType}</span>}
      </div>
      {job.description && <p className="m-0 line-clamp-3 text-xs font-medium leading-6 text-rf-ink-muted">{job.description}</p>}
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-rf-border-subtle pt-3">
        <span className="text-[10px] font-semibold text-rf-ink-muted">Published {new Date(job.publishedAt).toLocaleDateString()}</span>
        <Button variant="secondary" size="sm" asChild><Link to={job.detailPath}>View role <Icon name="arrow-right" size={13} /></Link></Button>
      </div>
    </Card>
  );
}
