import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Briefcase, Code, Eye, LayoutGrid, List, MapPin, Megaphone, RotateCw, Search, Stethoscope, Users, type LucideIcon } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { ButtonV2, EmptyStateV2, ForbiddenStateV2, InputV2, SelectV2, SkeletonV2, StatusChip, type StatusTone } from '../../components/v2';
import { fetchOpenJobs, type JobStatus, type MyJobRow, type OpenJobs, type OtherJobRow } from '../api/jobs';
import './jobs.css';

export const STATUS_TONE: Record<JobStatus, StatusTone> = { Open: 'success', 'Partially Filled': 'success', 'On Hold': 'warning', Filled: 'info', Closed: 'neutral' };
export const STATUS_LABEL: Record<JobStatus, string> = { Open: 'Open', 'Partially Filled': 'Open', 'On Hold': 'On hold', Filled: 'Filled', Closed: 'Closed' };

type Filter = 'open' | 'hold' | 'done' | 'all';
const FILTERS: Record<Filter, { label: string; match: (s: JobStatus) => boolean }> = {
  open: { label: 'Open', match: (s) => s === 'Open' || s === 'Partially Filled' },
  hold: { label: 'On hold', match: (s) => s === 'On Hold' },
  done: { label: 'Filled or closed', match: (s) => s === 'Filled' || s === 'Closed' },
  all: { label: 'All', match: () => true },
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
  const [view, setView] = useState<'cards' | 'list'>('list');

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

  return (
    <div className="rf2-jobs rf2-open">
      {state.kind === 'loading' ? <SkeletonV2 lines={6} label="Loading your jobs…" /> : null}
      {state.kind === 'forbidden' ? <ForbiddenStateV2 body="Your role does not include jobs." /> : null}
      {state.kind === 'error' ? (
        <div role="alert"><EmptyStateV2 title="Could not load your jobs" body={state.message} action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Try again</ButtonV2>} /></div>
      ) : null}
      {state.kind === 'ready' ? (
        <>
          <div className="rf2-jobs__filters" role="search">
            <div className="rf2-jobs__fields">
              <InputV2 label="Search my jobs" fieldClassName="rf2-jobs__search rf2-sr-label" placeholder="Search my jobs" leadingIcon={<Search />} value={q} onChange={(e) => setQ(e.target.value)} />
              <SelectV2 label="Status" fieldClassName="rf2-jobs__select rf2-sr-label" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
                {(Object.keys(FILTERS) as Filter[]).map((k) => <option key={k} value={k}>{FILTERS[k].label}</option>)}
              </SelectV2>
              <SelectV2 label="Site" fieldClassName="rf2-jobs__select rf2-sr-label" value={site} onChange={(e) => setSite(e.target.value)}>
                <option value="">All sites</option>
                {sites.map((s) => <option key={s} value={s}>{s}</option>)}
              </SelectV2>
            </div>
            <div className="rf2-jobs__tools">
              <div className="rf2-view" role="group" aria-label="Layout">
                <button type="button" className="rf2-view__opt" aria-pressed={view === 'cards'} onClick={() => setView('cards')}><LayoutGrid aria-hidden="true" /> Cards</button>
                <button type="button" className="rf2-view__opt" aria-pressed={view === 'list'} onClick={() => setView('list')}><List aria-hidden="true" /> List</button>
              </div>
            </div>
          </div>
          <section className={view === 'list' && rows.length > 0 ? 'rf2-panel' : undefined} aria-labelledby="my-jobs-h">
            <h2 id="my-jobs-h" className="rf2-sr-only">My jobs</h2>
            {rows.length === 0 ? (
              <EmptyStateV2 headingLevel={3} title={state.data.mine.length ? 'No jobs match these filters' : 'No jobs assigned to you yet'} body={state.data.mine.length ? 'Change the status or site filter.' : 'When your manager activates a requisition with you as owner, it shows here.'} />
            ) : view === 'cards' ? <JobCards rows={rows} /> : <div className="rf2-jscroll"><JobsTable rows={rows} /></div>}
          </section>
          {state.data.others.length ? (
            view === 'cards' ? (
              <section aria-label="Other jobs">
                <OtherCards rows={state.data.others} />
              </section>
            ) : (
              <section className="rf2-panel" aria-labelledby="other-jobs-h">
                <header className="rf2-panel__head">
                  <h2 id="other-jobs-h" className="rf2-panel__title">Other recruiters' jobs in your team</h2>
                  <p className="rf2-panel__note">Title, site and seats only. Other teams are not shown.</p>
                </header>
                <div className="rf2-jscroll"><OtherTable rows={state.data.others} /></div>
                <p className="rf2-panel__foot">Files on these jobs are visible only to their owner and the owner's manager.</p>
              </section>
            )
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

/** Non-zero stages only, so the list can show the split without a row of zeros. */
export function stageLine(c: Record<string, number>): string {
  return Object.keys(LABELS).filter((s) => (c[s] ?? 0) > 0).map((s) => `${LABELS[s]} ${c[s]}`).join(' · ');
}

function StageBits({ counts }: { counts: Record<string, number> }) {
  const parts = Object.keys(LABELS).filter((s) => (counts[s] ?? 0) > 0);
  if (!parts.length) return null;
  return (
    <p className="rf2-jcard__stages" aria-hidden="true">
      {parts.map((s) => <span key={s}>{LABELS[s]} {counts[s]}</span>)}
    </p>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '')).toUpperCase();
}

function jobMark(title: string, department: string | null): LucideIcon {
  const text = `${title} ${department ?? ''}`;
  if (/developer|engineer|software|\bit\b|data|cyber/i.test(text)) return Code;
  if (/nurs|medic|clinical|pharm|doctor|therap/i.test(text)) return Stethoscope;
  if (/media|market|brand|content|relation/i.test(text)) return Megaphone;
  return Briefcase;
}

function JobCards({ rows }: { rows: MyJobRow[] }) {
  return (
    <ul className="rf2-jcards" aria-labelledby="my-jobs-h">
      {rows.map((j) => {
        const Mark = jobMark(j.title, j.department);
        const filled = j.seats.target > 0 ? Math.min(100, Math.round((j.seats.filled / j.seats.target) * 100)) : 0;
        return (
          <li key={j.id}>
            <article className="rf2-jcard" data-tone={STATUS_TONE[j.status]} aria-labelledby={`job-${j.id}-title`}>
              <header className="rf2-jcard__top">
                <span className="rf2-jcard__mark" aria-hidden="true"><Mark /></span>
                <p className="rf2-jcard__code">{[j.code, j.department].filter(Boolean).join(' · ')}</p>
                <StatusChip tone={STATUS_TONE[j.status]} label={STATUS_LABEL[j.status]} />
              </header>
              <h3 id={`job-${j.id}-title`} className="rf2-jcard__title">{j.title}</h3>
              <p className="rf2-jcard__meta">
                <span><MapPin aria-hidden="true" /> {j.site ?? 'Site not set'}</span>
                {j.dueDate ? <span>Due {formatDay(j.dueDate)}</span> : null}
              </p>
              {j.status === 'On Hold' && j.holdUntil ? <p className="rf2-jcard__hold">Hold until {formatDay(`${j.holdUntil}T12:00:00Z`)}</p> : null}
              <div className="rf2-jcard__metrics">
                <div className="rf2-jcard__metric">
                  <p className="rf2-jcard__k"><Users aria-hidden="true" /> Applicants</p>
                  <p className="rf2-jcard__v" title={stageTitle(j.pipelineCounts)}>{j.active} <span className="rf2-jcard__unit">active</span><span className="rf2-sr-only">: {stageTitle(j.pipelineCounts)}</span></p>
                </div>
                <div className="rf2-jcard__metric">
                  <p className="rf2-jcard__k">Owner</p>
                  {j.ownerName ? <p className="rf2-jcard__owner"><span className="rf2-jcard__av" aria-hidden="true">{initials(j.ownerName)}</span><span>{j.ownerName}</span></p> : <p className="rf2-jcard__owner">No owner</p>}
                </div>
              </div>
              <StageBits counts={j.pipelineCounts} />
              <div className="rf2-jcard__foot">
                <p className="rf2-jcard__seats">
                  <span>Headcount filled</span>
                  <span className="rf2-num" data-tone={j.seats.filled > 0 ? 'success' : undefined}>{j.seats.filled} / {j.seats.target}</span>
                  {filled > 0 ? <span className="rf2-jcard__bar" aria-hidden="true"><span style={{ width: `${filled}%` }} /></span> : null}
                </p>
                <div className="rf2-jcard__act">
                  <Link className="rf2-btn rf2-btn--primary rf2-btn--md" to={`/vacancies/${encodeURIComponent(j.id)}`} aria-label={`Open pipeline: ${j.title}`}>
                    Open pipeline <ArrowRight aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}

function OtherCards({ rows }: { rows: OtherJobRow[] }) {
  return (
    <ul className="rf2-jcards rf2-jcards--team">
      {rows.map((o) => {
        const Mark = jobMark(o.title, null);
        return (
          <li key={o.id}>
            <article className="rf2-jcard" aria-labelledby={`other-${o.id}-title`} data-access={o.full ? 'open' : 'readonly'} data-redacted={o.full ? undefined : 'true'}>
              <header className="rf2-jcard__top">
                <span className="rf2-jcard__mark" data-access={o.full ? 'open' : 'readonly'} aria-hidden="true"><Mark /></span>
                <h3 id={`other-${o.id}-title`} className="rf2-jcard__title">{o.title}</h3>
                {o.full ? null : <StatusChip tone="neutral" label="Read-only" />}
              </header>
              <p className="rf2-jcard__meta">
                <span><MapPin aria-hidden="true" /> {o.site ?? 'Site not set'}</span>
                {o.full && o.ownerName ? <span>{o.ownerName}</span> : null}
                {o.full ? null : <span className="rf2-sr-only">Owned by another recruiter</span>}
              </p>
              <div className="rf2-jcard__foot">
                <p className="rf2-jcard__seats">
                  <span>Seats</span>
                  <span className="rf2-num">{o.full ? `${o.seats.filled} / ${o.seats.target}` : o.seats.target}</span>
                </p>
                {o.full ? (
                  <div className="rf2-jcard__act">
                    <Link className="rf2-btn rf2-btn--secondary rf2-btn--md" to={`/vacancies/${encodeURIComponent(o.id)}`} aria-label={`Open pipeline: ${o.title}`}>
                      Open pipeline <ArrowRight aria-hidden="true" />
                    </Link>
                  </div>
                ) : null}
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}

function OtherTable({ rows }: { rows: OtherJobRow[] }) {
  return (
    <table className="rf2-jtable rf2-jtable--plain" aria-labelledby="other-jobs-h">
      <thead><tr><th scope="col">Job</th><th scope="col">Site</th><th scope="col">Seats</th></tr></thead>
      <tbody>
        {rows.map((o) => (
          <tr key={o.id} data-access={o.full ? 'open' : 'readonly'} data-redacted={o.full ? undefined : 'true'}>
            <td>
              <div className="rf2-jtable__job">
                <span className="rf2-jtable__eye" aria-hidden="true"><Eye /></span>
                <div className="rf2-jtable__id">
                  {o.full
                    ? <Link className="rf2-link rf2-jtable__name" to={`/vacancies/${encodeURIComponent(o.id)}`}>{o.title}</Link>
                    : <span className="rf2-jtable__name">{o.title}</span>}
                  {o.full ? null : <span className="rf2-sr-only">Read-only, owned by another recruiter</span>}
                </div>
              </div>
            </td>
            <td>{o.site ?? '—'}</td>
            <td className="rf2-num">{o.full ? `${o.seats.filled} of ${o.seats.target}` : o.seats.target}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function JobsTable({ rows }: { rows: MyJobRow[] }) {
  return (
    <table className="rf2-jtable rf2-jtable--mine" aria-labelledby="my-jobs-h">
      <thead><tr><th scope="col">Job</th><th scope="col">Site</th><th scope="col">Seats</th><th scope="col">Due</th><th scope="col">Pipeline</th><th scope="col">Status</th><th scope="col"><span className="rf2-sr-only">Action</span></th></tr></thead>
      <tbody>
        {rows.map((j, i) => {
          const stages = stageLine(j.pipelineCounts);
          return (
          <tr key={j.id}>
            <td>
              <div className="rf2-jtable__id">
                <p className="rf2-jtable__name">{j.title}</p>
                <p className="rf2-jtable__sub">{[j.department, j.ownerName ? `Owner: ${j.ownerName}` : null].filter(Boolean).join(' · ')}</p>
              </div>
            </td>
            <td data-label="Site">{j.site ?? '—'}</td>
            <td className="rf2-num rf2-jtable__seats" data-label="Seats">{j.seats.filled > 0 ? <span data-tone="success">{j.seats.filled}</span> : j.seats.filled} of {j.seats.target}</td>
            <td className="rf2-num" data-label="Due">{formatDay(j.dueDate)}{j.status === 'On Hold' && j.holdUntil ? <p className="rf2-jtable__sub">Hold until {formatDay(`${j.holdUntil}T12:00:00Z`)}</p> : null}</td>
            <td className="rf2-jtable__pipe" data-label="Pipeline">
              <p className="rf2-jtable__active" title={stageTitle(j.pipelineCounts)}>{j.active} active</p>
              {stages ? <p className="rf2-jtable__sub" aria-hidden="true">{stages}</p> : null}
              <span className="rf2-sr-only">: {stageTitle(j.pipelineCounts)}</span>
            </td>
            <td data-label="Status"><StatusChip tone={STATUS_TONE[j.status]} label={STATUS_LABEL[j.status]} /></td>
            <td className="rf2-jtable__act">
              <Link className={`rf2-btn rf2-btn--${i === 0 ? 'primary' : 'secondary'} rf2-btn--md`} to={`/vacancies/${encodeURIComponent(j.id)}`} aria-label={`Open pipeline: ${j.title}`}>
                <ArrowRight aria-hidden="true" /> Open pipeline
              </Link>
            </td>
          </tr>
          );
        })}
      </tbody>
    </table>
  );
}
