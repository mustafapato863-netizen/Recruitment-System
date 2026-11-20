import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Briefcase,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Code,
  Eye,
  FileText,
  LayoutGrid,
  List,
  Lock,
  MapPin,
  Megaphone,
  RotateCw,
  Search,
  Stethoscope,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { ButtonV2, EmptyStateV2, ForbiddenStateV2, InputV2, SelectV2, SkeletonV2, StatusChip, type StatusTone } from '../../components/v2';
import { fetchOpenJobs, type JobStatus, type MyJobRow, type OpenJobs, type OtherJobRow } from '../api/jobs';
import { JdReviewDrawer } from '../drawers/JdReviewDrawer';
import { getInitials } from '../userIdentity';
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
type Layout = 'cards' | 'list';

function isFilter(value: string | null): value is Filter {
  return value === 'open' || value === 'hold' || value === 'done' || value === 'all';
}

/** Pipeline link. A non-default desk filter is carried as returnTo; the default desk stays a bare path. */
function pipelineHref(id: string, returnTo: string | null): string {
  const path = `/vacancies/${encodeURIComponent(id)}`;
  if (!returnTo) return path;
  return `${path}?${new URLSearchParams({ returnTo }).toString()}`;
}

function jobsQuery(q: string, filter: Filter, site: string, view: Layout): URLSearchParams {
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q);
  if (filter !== 'open') params.set('status', filter);
  if (site) params.set('site', site);
  if (view === 'list') params.set('view', 'list');
  return params;
}

export function formatDay(d: string | null): string {
  if (!d) return '—';
  const dt = new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T12:00:00Z` : d);
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Cairo' }).format(dt);
}

type JobTone = 'blue' | 'amber' | 'green' | 'rose' | 'slate';

function getJobDisplayMeta(title: string, index: number): { tone: JobTone; Icon: LucideIcon } {
  const Icon = jobMark(title, null);
  const tones: JobTone[] = ['blue', 'amber', 'green', 'rose', 'slate'];
  return { tone: tones[index % tones.length], Icon };
}

/** E08 Open jobs (Employee seat). */
export function OpenJobsV2() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'ready'; data: OpenJobs } | { kind: 'error'; message: string } | { kind: 'forbidden' }>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [jdJob, setJdJob] = useState<{ id: string; title: string } | null>(null);
  const [dept, setDept] = useState('');
  const q = searchParams.get('q') ?? '';
  const statusParam = searchParams.get('status');
  const filter: Filter = isFilter(statusParam) ? statusParam : 'open';
  const site = searchParams.get('site') ?? '';
  const view: Layout = searchParams.get('view') === 'list' ? 'list' : 'cards';
  const writeQuery = (patch: { q?: string; filter?: Filter; site?: string; view?: Layout }) => {
    setSearchParams(jobsQuery(patch.q ?? q, patch.filter ?? filter, patch.site ?? site, patch.view ?? view), { replace: true });
  };

  useEffect(() => {
    let live = true;
    setState({ kind: 'loading' });
    fetchOpenJobs()
      .then((data) => { if (live) setState({ kind: 'ready', data }); })
      .catch((e: { statusCode?: number; message?: string }) => { if (live) setState(e?.statusCode === 403 ? { kind: 'forbidden' } : { kind: 'error', message: e?.message || 'Something went wrong.' }); });
    return () => { live = false; };
  }, [user?.id, attempt]);

  const activeFilterReturn = useMemo(() => {
    if (q.trim() === '' && filter === 'open' && site === '' && view === 'cards') return null;
    const params = jobsQuery(q.trim(), filter, site, view);
    const query = params.toString();
    return query ? `/vacancies?${query}` : '/vacancies';
  }, [q, filter, site, view]);
  const sites = useMemo(() => (state.kind === 'ready' ? [...new Set(state.data.mine.map((j) => j.site).filter(Boolean) as string[])].sort() : []), [state]);
  const rows = useMemo(() => {
    if (state.kind !== 'ready') return [];
    const t = q.trim().toLowerCase();
    return state.data.mine.filter((j) => FILTERS[filter].match(j.status) && (!site || j.site === site) && (!dept || j.department === dept) && (!t || `${j.title} ${j.code} ${j.department ?? ''}`.toLowerCase().includes(t)));
  }, [state, q, filter, site, dept]);

  const totalOpenJobs = state.kind === 'ready' ? state.data.mine.filter(job => FILTERS.open.match(job.status)).length : 0;
  const pipelineTotals = useMemo(() => {
    if (state.kind !== 'ready') return { applicants: 0, interviews: 0, offers: 0 };
    return state.data.mine.filter(job => FILTERS.open.match(job.status)).reduce((acc, job) => {
      const counts = job.pipelineCounts ?? {};
      const applicants = job.active;
      return {
        applicants: acc.applicants + applicants,
        interviews: acc.interviews + (counts.Interview ?? 0),
        offers: acc.offers + (counts.Offer ?? 0),
      };
    }, { applicants: 0, interviews: 0, offers: 0 });
  }, [state]);

  return (
    <div className="rf2-jobs rf2-open">
      {state.kind === 'loading' ? <SkeletonV2 lines={6} label="Loading your jobs…" /> : null}
      {state.kind === 'forbidden' ? <ForbiddenStateV2 body="Your role does not include jobs." /> : null}
      {state.kind === 'error' ? (
        <div role="alert"><EmptyStateV2 title="Could not load your jobs" body={state.message} action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Try again</ButtonV2>} /></div>
      ) : null}
      {state.kind === 'ready' ? (
        <>
          <div className="rf2-open__hero">
            <div className="rf2-open__hero-copy">
              <p className="rf2-open__hero-title" aria-hidden="true">Open jobs</p>
              <p className="rf2-open__hero-sub">Totals cover your open jobs. Other recruiters' jobs are shown separately.</p>
            </div>
          </div>

          <div className="rf2-open__kpis" aria-label="Jobs overview">
            <div className="rf2-open__kpi" data-tone="action">
              <span className="rf2-open__kpi-icon" data-tone="blue" aria-hidden="true"><Briefcase /></span>
              <div className="rf2-open__kpi-body">
                <span className="rf2-open__kpi-label">My open jobs</span>
                <span className="rf2-open__kpi-value">{totalOpenJobs}</span>
              </div>
            </div>

            <div className="rf2-open__kpi" data-tone="success">
              <span className="rf2-open__kpi-icon" data-tone="green" aria-hidden="true"><Users /></span>
              <div className="rf2-open__kpi-body">
                <span className="rf2-open__kpi-label">Active applications</span>
                <span className="rf2-open__kpi-value">{pipelineTotals.applicants}</span>
              </div>
            </div>

            <div className="rf2-open__kpi" data-tone="warning">
              <span className="rf2-open__kpi-icon" data-tone="amber" aria-hidden="true"><FileText /></span>
              <div className="rf2-open__kpi-body">
                <span className="rf2-open__kpi-label">In interview</span>
                <span className="rf2-open__kpi-value">{pipelineTotals.interviews}</span>
              </div>
            </div>

            <div className="rf2-open__kpi" data-tone="danger">
              <span className="rf2-open__kpi-icon" data-tone="rose" aria-hidden="true"><Clock /></span>
              <div className="rf2-open__kpi-body">
                <span className="rf2-open__kpi-label">In offer</span>
                <span className="rf2-open__kpi-value">{pipelineTotals.offers}</span>
              </div>
            </div>
          </div>

          <div className="rf2-jobs__filters" role="search">
            <div className="rf2-jobs__fields">
              <InputV2 label="Search my jobs" fieldClassName="rf2-jobs__search rf2-sr-label" placeholder="Search my jobs..." leadingIcon={<Search />} value={q} onChange={(e) => writeQuery({ q: e.target.value })} />
              <SelectV2 label="Status" fieldClassName="rf2-jobs__select rf2-sr-label" value={filter} onChange={(e) => writeQuery({ filter: e.target.value as Filter })}>
                {(Object.keys(FILTERS) as Filter[]).map((k) => <option key={k} value={k}>{FILTERS[k].label}</option>)}
              </SelectV2>
              <SelectV2 label="Site" fieldClassName="rf2-jobs__select rf2-sr-label" value={site} onChange={(e) => writeQuery({ site: e.target.value })}>
                <option value="">All sites</option>
                {sites.map((s) => <option key={s} value={s}>{s}</option>)}
              </SelectV2>
              <SelectV2 label="Department" fieldClassName="rf2-jobs__select rf2-sr-label" value={dept} onChange={(e) => setDept(e.target.value)}>
                <option value="">All departments</option>
                {[...new Set(state.data.mine.flatMap(job => job.department ? [job.department] : []))].sort().map(department => <option key={department}>{department}</option>)}
              </SelectV2>
              <span
                className="rf2-open__reset-link"
                aria-hidden="true"
                onClick={() => {
                  setDept('');
                  writeQuery({ q: '', filter: 'open', site: '' });
                }}
              >
                <RotateCw aria-hidden="true" /> Reset filters
              </span>
            </div>
            <div className="rf2-jobs__tools">
              <div className="rf2-view" role="group" aria-label="Layout">
                <button type="button" className="rf2-view__opt" aria-pressed={view === 'cards'} onClick={() => writeQuery({ view: 'cards' })}><LayoutGrid aria-hidden="true" /> Cards</button>
                <button type="button" className="rf2-view__opt" aria-pressed={view === 'list'} onClick={() => writeQuery({ view: 'list' })}><List aria-hidden="true" /> List</button>
              </div>
            </div>
          </div>

          <section className={view === 'list' && rows.length > 0 ? 'rf2-panel' : undefined} aria-labelledby="my-jobs-h">
            <h2 id="my-jobs-h" className="rf2-sr-only">My jobs</h2>
            {rows.length === 0 ? (
              <div className="rf2-open__empty-banner">
                <EmptyStateV2
                  headingLevel={3}
                  title={state.data.mine.length ? 'No jobs match these filters' : 'No jobs assigned to you yet'}
                  body={state.data.mine.length ? 'Change the status or site filter.' : 'When your manager activates a requisition with you as owner, it shows here.'}
                />
                <span className="rf2-open__empty-dismiss" aria-hidden="true"><X /></span>
              </div>
            ) : view === 'cards' ? <JobCards rows={rows} returnTo={activeFilterReturn} onCalibrateJd={setJdJob} /> : <div className="rf2-jscroll"><JobsTable rows={rows} returnTo={activeFilterReturn} onCalibrateJd={setJdJob} /></div>}
          </section>

          {state.data.othersError ? (
            <section role="region" aria-label="Other jobs">
              <div role="alert">
                <EmptyStateV2 title="Could not load team jobs" body={state.data.othersError} action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Try again</ButtonV2>} />
              </div>
            </section>
          ) : state.data.others.length ? (
            view === 'cards' ? (
              <section aria-label="Other jobs">
                <header className="rf2-panel__head"><h2 className="rf2-panel__title">Other recruiters' jobs</h2><p className="rf2-panel__note">Visible to you; not included in your job totals.</p></header>
                <OtherCards rows={state.data.others} returnTo={activeFilterReturn} />
              </section>
            ) : (
              <section className="rf2-panel rf2-open__team-panel" aria-labelledby="other-jobs-h">
                <header className="rf2-panel__head">
                  <h2 id="other-jobs-h" className="rf2-panel__title">Other recruiters' jobs in your team</h2>
                  <p className="rf2-panel__note">Title, site and seats only. Other teams are not shown.</p>
                </header>
                <div className="rf2-jscroll"><OtherTable rows={state.data.others} returnTo={activeFilterReturn} /></div>
                <div className="rf2-open__pagination" aria-hidden="true">
                  <div className="rf2-open__page-left">
                    <span>Showing {state.data.others.length} jobs</span>
                    <span className="rf2-open__page-size">10 per page ▾</span>
                  </div>
                  <div className="rf2-open__page-right">
                    <span className="rf2-open__page-nav"><ChevronLeft /></span>
                    <span className="rf2-open__page-num" data-active="true">1</span>
                    <span className="rf2-open__page-nav"><ChevronRight /></span>
                  </div>
                </div>
                <p className="rf2-panel__foot">Files on these jobs are visible only to their owner and the owner's manager.</p>
              </section>
            )
          ) : null}
        </>
      ) : null}
      {jdJob ? (
        <JdReviewDrawer
          isOpen={true}
          onClose={() => setJdJob(null)}
          vacancyId={jdJob.id}
          title={jdJob.title}
          onLocked={() => {
            setJdJob(null);
            setAttempt((n) => n + 1);
          }}
        />
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

function jobMark(title: string, department: string | null): LucideIcon {
  const text = `${title} ${department ?? ''}`;
  if (/developer|engineer|software|\bit\b|data|cyber/i.test(text)) return Code;
  if (/nurs|medic|clinical|pharm|doctor|therap/i.test(text)) return Stethoscope;
  if (/media|market|brand|content|relation/i.test(text)) return Megaphone;
  return Briefcase;
}

function JobCards({ rows, returnTo, onCalibrateJd }: { rows: MyJobRow[]; returnTo: string | null; onCalibrateJd?: (job: { id: string; title: string }) => void }) {
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
                  {j.ownerName ? <p className="rf2-jcard__owner"><span className="rf2-jcard__av" aria-hidden="true">{getInitials(j.ownerName)}</span><span>{j.ownerName}</span></p> : <p className="rf2-jcard__owner">No owner</p>}
                </div>
              </div>
              {j.attention ? <p className="rf2-jtable__sub">{j.attention}</p> : null}
              <StageBits counts={j.pipelineCounts} />
              <div className="rf2-jcard__foot">
                <p className="rf2-jcard__seats">
                  <span>Headcount filled</span>
                  <span className="rf2-num" data-tone={j.seats.filled > 0 ? 'success' : undefined}>{j.seats.filled} / {j.seats.target}</span>
                  {filled > 0 ? <span className="rf2-jcard__bar" aria-hidden="true"><span style={{ width: `${filled}%` }} /></span> : null}
                </p>
                <div className="rf2-jcard__act">
                  {onCalibrateJd ? (
                    <ButtonV2
                      kind="secondary"
                      size="md"
                      icon={<FileText />}
                      onClick={() => onCalibrateJd({ id: j.id, title: j.title })}
                      aria-label={`Calibrate JD and ATS criteria: ${j.title}`}
                    >
                      JD & ATS
                    </ButtonV2>
                  ) : null}
                  <Link className="rf2-btn rf2-btn--primary rf2-btn--md" to={pipelineHref(j.id, returnTo)} aria-label={`Open pipeline: ${j.title}`}>
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

function OtherCards({ rows, returnTo }: { rows: OtherJobRow[]; returnTo: string | null }) {
  const navigate = useNavigate();
  return (
    <ul className="rf2-jcards rf2-jcards--team">
      {rows.map((o, idx) => {
        const meta = getJobDisplayMeta(o.title, idx);
        const Icon = meta.Icon;
        const isOpen = Boolean(o.full);
        return (
          <li key={o.id}>
            <article
              className="rf2-jcard rf2-jcard--team-v2"
              aria-labelledby={`other-${o.id}-title`}
              data-access={isOpen ? 'open' : 'readonly'}
              data-redacted={isOpen ? undefined : 'true'}
            >
              <header className="rf2-jcard__v2-head">
                <span className="rf2-jcard__v2-icon" data-tone={isOpen ? meta.tone : 'slate'} aria-hidden="true">
                  {isOpen ? <Icon /> : <Lock />}
                </span>
                <div className="rf2-jcard__v2-title-wrap">
                  <div className="rf2-jcard__v2-title-row">
                    <h3
                      id={`other-${o.id}-title`}
                      className={isOpen ? 'rf2-jcard__v2-title rf2-jcard__v2-title--open' : 'rf2-jcard__v2-title'}
                      onClick={isOpen ? () => navigate(pipelineHref(o.id, returnTo)) : undefined}
                    >
                      {o.title}
                    </h3>
                    {isOpen ? (
                      o.status ? <StatusChip tone={STATUS_TONE[o.status]} label={STATUS_LABEL[o.status]} /> : <StatusChip tone="neutral" label="Status unavailable" />
                    ) : (
                      <span className="rf2-open__ro-badge">
                        <Lock aria-hidden="true" /> Read-only
                      </span>
                    )}
                  </div>
                  {isOpen ? (
                    <p className="rf2-jcard__v2-owner" data-access="open">
                      Owner: {o.ownerName || 'No owner'} · <span className="rf2-open__access-hint">Pipeline access</span>
                    </p>
                  ) : (
                    <p className="rf2-jcard__v2-owner" data-access="readonly">
                      Owned by another recruiter
                    </p>
                  )}
                </div>
              </header>

              <div className="rf2-jcard__v2-info">
                <p className="rf2-jcard__v2-line">
                  <MapPin aria-hidden="true" />
                  <span>{o.site ?? 'Site not set'}</span>
                </p>
                <p className="rf2-jcard__v2-line" aria-hidden="true">
                  <Building2 aria-hidden="true" />
                  <span>{o.department ?? '—'}</span>
                </p>
              </div>

              <div className="rf2-jcard__v2-stats">
                <div className="rf2-jcard__v2-stat">
                  <Users aria-hidden="true" />
                  <div>
                    <span className="rf2-jcard__v2-stat-val rf2-num">
                      {isOpen ? `${o.seats.filled} / ${o.seats.target}` : `${o.seats.target}`}
                    </span>
                    <span className="rf2-jcard__v2-stat-lbl">{isOpen ? 'Seats filled' : 'Approved seats'}</span>
                  </div>
                </div>
                <div className="rf2-jcard__v2-stat" aria-hidden="true">
                  {isOpen ? <Users aria-hidden="true" /> : <Lock aria-hidden="true" />}
                  <div>
                    <span className="rf2-jcard__v2-stat-val rf2-num">{isOpen ? o.active ?? '—' : '—'}</span>
                    <span className="rf2-jcard__v2-stat-lbl">{isOpen ? 'Applicants' : 'Owner only'}</span>
                  </div>
                </div>
              </div>

              <div className="rf2-jcard__v2-foot">
                {isOpen ? (
                  <>
                    <span className="rf2-jcard__v2-date" aria-hidden="true">
                      <Calendar aria-hidden="true" /> Due {formatDay(o.dueDate ?? null)}
                    </span>
                    <Link
                      className="rf2-open__pipe-pill rf2-open__pipe-pill--primary"
                      to={pipelineHref(o.id, returnTo)}
                      aria-label={`Open pipeline: ${o.title}`}
                    >
                      Open pipeline <ArrowRight aria-hidden="true" />
                    </Link>
                  </>
                ) : (
                  <>
                    <span className="rf2-jcard__v2-date rf2-jcard__v2-date--ro" aria-hidden="true">
                      <Eye aria-hidden="true" /> Summary view only
                    </span>
                    <span className="rf2-open__ro-foot-pill" aria-hidden="true" title="Only the assigned owner or manager can open this pipeline">
                      <Lock aria-hidden="true" /> Locked
                    </span>
                  </>
                )}
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}

function OtherTable({ rows, returnTo }: { rows: OtherJobRow[]; returnTo: string | null }) {
  const navigate = useNavigate();
  return (
    <table className="rf2-jtable rf2-jtable--plain rf2-open__team-table" aria-labelledby="other-jobs-h">
      <thead>
        <tr>
          <th scope="col">Job</th>
          <th scope="col">Access</th>
          <th scope="col">Site</th>
          <th scope="col">Department</th>
          <th scope="col">Seats</th>
          <th scope="col">Applicants</th>
          <th scope="col">Due</th>
          <th scope="col" className="rf2-open__th-act">Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((o, idx) => {
          const meta = getJobDisplayMeta(o.title, idx);
          const Icon = meta.Icon;
          const isOpen = Boolean(o.full);
          return (
            <tr
              key={o.id}
              data-access={isOpen ? 'open' : 'readonly'}
              data-redacted={isOpen ? undefined : 'true'}
            >
              <td>
                <div className="rf2-jtable__job">
                  <span className="rf2-open__row-icon" data-tone={isOpen ? meta.tone : 'slate'} aria-hidden="true">
                    {isOpen ? <Icon /> : <Lock />}
                  </span>
                  <div className="rf2-jtable__id">
                    {isOpen ? (
                      <Link className="rf2-link rf2-jtable__name rf2-open__job-link" to={pipelineHref(o.id, returnTo)}>
                        {o.title}
                      </Link>
                    ) : (
                      <span className="rf2-jtable__name rf2-open__job-ro-title">{o.title}</span>
                    )}
                    {isOpen ? (
                      <p className="rf2-jtable__sub">Owner: {o.ownerName || 'No owner'}</p>
                    ) : (
                      <p className="rf2-jtable__sub rf2-open__sub-ro">Owned by another recruiter</p>
                    )}
                  </div>
                </div>
              </td>
              <td>
                {isOpen ? (
                  o.status ? <StatusChip tone={STATUS_TONE[o.status]} label={STATUS_LABEL[o.status]} /> : <StatusChip tone="neutral" label="Status unavailable" />
                ) : (
                  <span className="rf2-open__ro-badge">
                    <Lock aria-hidden="true" /> Read-only
                  </span>
                )}
              </td>
              <td>{o.site ?? '—'}</td>
              <td className="rf2-open__td-muted" aria-hidden="true">{o.department ?? '—'}</td>
              <td className="rf2-num rf2-open__td-strong">
                {isOpen ? `${o.seats.filled} of ${o.seats.target}` : `${o.seats.target} seats`}
              </td>
              <td className="rf2-num rf2-open__td-muted" aria-hidden="true">
                {isOpen ? (o.active == null ? '—' : `${o.active} active`) : 'Hidden'}
              </td>
              <td className="rf2-open__td-muted" aria-hidden="true">{isOpen ? formatDay(o.dueDate ?? null) : '—'}</td>
              <td className="rf2-open__td-actions" aria-hidden="true">
                {isOpen ? (
                  <span
                    className="rf2-open__action-open"
                    onClick={() => navigate(pipelineHref(o.id, returnTo))}
                  >
                    Open pipeline <ArrowRight />
                  </span>
                ) : (
                  <span className="rf2-open__action-ro" title="Files are visible only to the job owner">
                    <Lock /> Owner only
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function JobsTable({ rows, returnTo, onCalibrateJd }: { rows: MyJobRow[]; returnTo: string | null; onCalibrateJd?: (job: { id: string; title: string }) => void }) {
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
                <p className="rf2-jtable__sub">{[j.department, `Owner: ${j.ownerName || 'No owner'}`].filter(Boolean).join(' · ')}</p>
                {j.attention ? <p className="rf2-jtable__sub">{j.attention}</p> : null}
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
              {onCalibrateJd ? (
                <ButtonV2
                  kind="secondary"
                  size="md"
                  icon={<FileText />}
                  onClick={() => onCalibrateJd({ id: j.id, title: j.title })}
                  aria-label={`Calibrate JD and ATS criteria: ${j.title}`}
                >
                  JD & ATS
                </ButtonV2>
              ) : null}
              <Link className={`rf2-btn rf2-btn--${i === 0 ? 'primary' : 'secondary'} rf2-btn--md`} to={pipelineHref(j.id, returnTo)} aria-label={`Open pipeline: ${j.title}`}>
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
