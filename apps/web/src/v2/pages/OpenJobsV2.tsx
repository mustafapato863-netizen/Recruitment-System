import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Eye, RotateCw, Search } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { ButtonV2, EmptyStateV2, ForbiddenStateV2, InputV2, SelectV2, SkeletonV2, StatusChip, type StatusTone } from '../../components/v2';
import { fetchOpenJobs, type JobStatus, type OpenJobs } from '../api/jobs';
import './jobs.css';

export const STATUS_TONE: Record<JobStatus, StatusTone> = { Open: 'success', 'Partially Filled': 'success', 'On Hold': 'warning', Filled: 'info', Closed: 'neutral' };
export const STATUS_LABEL: Record<JobStatus, string> = { Open: 'Open', 'Partially Filled': 'Open', 'On Hold': 'On hold', Filled: 'Filled', Closed: 'Closed' };

type Filter = 'open' | 'hold' | 'done' | 'all';
const FILTERS: Record<Filter, { label: string; match: (s: JobStatus) => boolean }> = {
  open: { label: 'Open · Assigned to me', match: (s) => s === 'Open' || s === 'Partially Filled' },
  hold: { label: 'On hold · Assigned to me', match: (s) => s === 'On Hold' },
  done: { label: 'Filled or closed · Assigned to me', match: (s) => s === 'Filled' || s === 'Closed' },
  all: { label: 'All · Assigned to me', match: () => true },
};

export function formatDay(d: string | null): string {
  if (!d) return '—';
  const dt = new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T12:00:00Z` : d);
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Cairo' }).format(dt);
}

/** E08 Open jobs (Employee seat). */
export function OpenJobsV2() {
  const { user } = useAuth();
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'ready'; data: OpenJobs } | { kind: 'error'; message: string } | { kind: 'forbidden' }>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('open');
  const [site, setSite] = useState('');

  useEffect(() => {
    let live = true;
    setState({ kind: 'loading' });
    fetchOpenJobs()
      .then((data) => { if (live) setState({ kind: 'ready', data }); })
      .catch((e: { statusCode?: number; message?: string }) => { if (live) setState(e?.statusCode === 403 ? { kind: 'forbidden' } : { kind: 'error', message: e?.message || 'Something went wrong.' }); });
    return () => { live = false; };
  }, [user?.id, attempt]);

  const sites = useMemo(() => (state.kind === 'ready' ? [...new Set(state.data.mine.map((j) => j.site).filter(Boolean) as string[])].sort() : []), [state]);
  const rows = useMemo(() => {
    if (state.kind !== 'ready') return [];
    const t = q.trim().toLowerCase();
    return state.data.mine.filter((j) => FILTERS[filter].match(j.status) && (!site || j.site === site) && (!t || `${j.title} ${j.code} ${j.department ?? ''}`.toLowerCase().includes(t)));
  }, [state, q, filter, site]);
  const hidden = filter === 'open' ? 'On hold and Closed hidden' : null;

  return (
    <div className="rf2-jobs">
      <p className="rf2-jobs__lead">Jobs you own as primary recruiter. A job is the container; each candidate has one application file per job.</p>
      {state.kind === 'loading' ? <SkeletonV2 lines={6} label="Loading your jobs…" /> : null}
      {state.kind === 'forbidden' ? <ForbiddenStateV2 body="Your role does not include jobs." /> : null}
      {state.kind === 'error' ? (
        <div role="alert"><EmptyStateV2 title="Could not load your jobs" body={state.message} action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Try again</ButtonV2>} /></div>
      ) : null}
      {state.kind === 'ready' ? (
        <>
          <div className="rf2-jobs__filters" role="search">
            <InputV2 label="Search my jobs" fieldClassName="rf2-jobs__search rf2-sr-label" placeholder="Search my jobs" leadingIcon={<Search />} value={q} onChange={(e) => setQ(e.target.value)} />
            <SelectV2 label="Status" fieldClassName="rf2-sr-label" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
              {(Object.keys(FILTERS) as Filter[]).map((k) => <option key={k} value={k}>{FILTERS[k].label}</option>)}
            </SelectV2>
            <SelectV2 label="Site" fieldClassName="rf2-sr-label" value={site} onChange={(e) => setSite(e.target.value)}>
              <option value="">All sites</option>
              {sites.map((s) => <option key={s} value={s}>{s}</option>)}
            </SelectV2>
            <p className="rf2-jobs__count" aria-live="polite">{rows.length} {rows.length === 1 ? 'job' : 'jobs'}{hidden ? ` · ${hidden}` : ''}</p>
          </div>
          <section className="rf2-panel" aria-labelledby="my-jobs-h">
            <h2 id="my-jobs-h" className="rf2-sr-only">My jobs</h2>
            {rows.length === 0 ? (
              <EmptyStateV2 headingLevel={3} title={state.data.mine.length ? 'No jobs match these filters' : 'No jobs assigned to you yet'} body={state.data.mine.length ? 'Change the status or site filter.' : 'When your manager activates a requisition with you as owner, it shows here.'} />
            ) : (
              <table className="rf2-jtable">
                <thead><tr><th scope="col">Job</th><th scope="col">Site</th><th scope="col">Seats</th><th scope="col">Due</th><th scope="col">Pipeline</th><th scope="col">Status</th><th scope="col"><span className="rf2-sr-only">Action</span></th></tr></thead>
                <tbody>
                  {rows.map((j, i) => (
                    <tr key={j.id}>
                      <td><p className="rf2-jtable__name">{j.title}</p><p className="rf2-jtable__sub">{[j.department, j.ownerName ? `Owner: ${j.ownerName}` : null].filter(Boolean).join(' · ')}</p></td>
                      <td>{j.site ?? '—'}</td>
                      <td className="rf2-num" data-tone={j.seats.filled > 0 ? 'success' : undefined}>{j.seats.filled} of {j.seats.target}</td>
                      <td className="rf2-num">{formatDay(j.dueDate)}{j.status === 'On Hold' && j.holdUntil ? <p className="rf2-jtable__sub">Hold until {formatDay(`${j.holdUntil}T12:00:00Z`)}</p> : null}</td>
                      <td><span title={stageTitle(j.pipelineCounts)}>{j.active} active</span><span className="rf2-sr-only">: {stageTitle(j.pipelineCounts)}</span></td>
                      <td><StatusChip tone={STATUS_TONE[j.status]} label={STATUS_LABEL[j.status]} /></td>
                      <td className="rf2-jtable__act">
                        <Link className={`rf2-btn rf2-btn--${i === 0 ? 'primary' : 'secondary'} rf2-btn--md`} to={`/vacancies/${encodeURIComponent(j.id)}`} aria-label={`Open pipeline: ${j.title}`}>
                          <ArrowRight aria-hidden="true" /> Open pipeline
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          {state.data.others.length ? (
            <section className="rf2-panel" aria-labelledby="other-jobs-h">
              <div className="rf2-panel__head">
                <h2 id="other-jobs-h" className="rf2-panel__title">Other recruiters’ jobs in your team</h2>
                <p className="rf2-jtable__sub">{state.data.others.some((o) => o.full) ? 'Jobs owned by your reports open in full; others show title, site and seats only.' : 'Title, site and seats only. Other teams are not shown.'}</p>
              </div>
              <table className="rf2-jtable rf2-jtable--plain">
                <thead><tr><th scope="col">Job</th><th scope="col">Site</th><th scope="col">Seats</th></tr></thead>
                <tbody>
                  {state.data.others.map((o) => (
                    <tr key={o.id} data-redacted={o.full ? undefined : 'true'}>
                      <td>{o.full
                        ? <><Link className="rf2-link" to={`/vacancies/${encodeURIComponent(o.id)}`}>{o.title}</Link>{o.ownerName ? <span className="rf2-jtable__sub"> · {o.ownerName}</span> : null}</>
                        : <><span className="rf2-jtable__ro"><Eye aria-hidden="true" /> {o.title}</span><span className="rf2-sr-only"> (read-only, owned by another recruiter)</span></>}</td>
                      <td>{o.site ?? '—'}</td>
                      <td className="rf2-num">{o.seats.target}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="rf2-panel__foot">Files on these jobs are visible only to their owner and the owner’s manager.</p>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

const LABELS: Record<string, string> = { Applied: 'Applied', Screening: 'Screening', Interview: 'Interview', Offer: 'Offer', 'Pre-Hire': 'Pre-hire' };
export function stageTitle(c: Record<string, number>): string {
  return Object.keys(LABELS).map((s) => `${LABELS[s]} ${c[s] ?? 0}`).join(', ');
}
