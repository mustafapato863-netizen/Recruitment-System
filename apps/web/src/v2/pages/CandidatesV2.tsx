import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { History, Info, RotateCw, Scale, Search, Users } from 'lucide-react';
import { ApiError, postApi } from '../../api/client';
import { ButtonV2, EmptyStateV2, ForbiddenStateV2, InputV2, SelectV2, SkeletonV2, StatusChip } from '../../components/v2';
import { findExistingFile, isApplicationExists } from '../api/applicationExists';
import { existingPerson } from '../api/cvImport';
import { ACCEPTING_JOB_STATUSES, fetchOpenJobs } from '../api/jobs';
import { addToJob, fetchActiveApplications, fetchBank, OPEN_APPLICATION_STAGES, type ActiveRow, type BankRow } from '../api/matching';
import { buildCandidatesHref, buildCompareHref, parseCompareIds, withReturnTo } from '../returnTarget';
import { formatDay } from './OpenJobsV2';
import './jobs.css';
import './candidates.css';

const STAGE_LABEL: Record<string, string> = { Applied: 'Applied', Screening: 'Screening', Interview: 'Interview', Offer: 'Offer', 'Pre-Hire': 'Pre-hire' };
const QUERY_KEYS = ['tab', 'search', 'job', 'source', 'stage'] as const;
type QueryKey = (typeof QUERY_KEYS)[number];
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
type Failure = { kind: 'forbidden' } | { kind: 'error'; message: string };
type ActiveState = { kind: 'loading' } | { kind: 'ready'; rows: ActiveRow[]; truncated: boolean; loaded: number; total: number | null } | Failure;
type BankState = { kind: 'loading' } | { kind: 'ready'; rows: BankRow[] } | Failure;

function loadError(e: { statusCode?: number; message?: string }): Failure {
  return e?.statusCode === 403 ? { kind: 'forbidden' } : { kind: 'error', message: e?.message || 'Something went wrong.' };
}

function orderedQuery(current: URLSearchParams, patch: Partial<Record<QueryKey, string | null>> = {}) {
  const ordered = new URLSearchParams();
  for (const key of QUERY_KEYS) {
    const value = Object.prototype.hasOwnProperty.call(patch, key) ? patch[key] : current.get(key);
    if (value) ordered.set(key, value);
  }
  return ordered;
}

function applicationHref(applicationId: string, returnTo: string) {
  return withReturnTo(`/applications/${encodeURIComponent(applicationId)}`, returnTo);
}

function listCount(count: number, selected: number, truncated: boolean) {
  const people = truncated ? `${count} people shown` : `${count} people`;
  return selected > 0 ? `${people} · ${selected} selected` : people;
}

function knownStage(value: string) {
  return (OPEN_APPLICATION_STAGES as readonly string[]).includes(value) ? value : '';
}

/** E23 Candidates: active applications (one row per file) and the bank. No contact details or pay. */
export function CandidatesV2() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'bank' ? 'bank' : 'active';
  const q = params.get('search') ?? '';
  const job = params.get('job') ?? '';
  const source = params.get('source') ?? '';
  const stage = knownStage(params.get('stage') ?? '');
  const rawIds = params.get('ids') ?? '';
  const urlIds = useMemo(() => parseCompareIds(rawIds), [rawIds]);
  const seededIdsRef = useRef<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [active, setActive] = useState<ActiveState>({ kind: 'loading' });
  const [bank, setBank] = useState<BankState>({ kind: 'loading' });

  const updateQuery = (patch: Partial<Record<QueryKey, string | null>>) => {
    setParams((prev) => orderedQuery(prev, patch));
  };
  const setTab = (next: 'active' | 'bank') => {
    updateQuery({ tab: next === 'bank' ? 'bank' : null });
    setPicked([]);
  };

  useEffect(() => {
    if (tab !== 'active') return;
    let live = true;
    fetchActiveApplications()
      .then((result) => { if (live) setActive({ kind: 'ready', rows: result.rows, truncated: result.truncated, loaded: result.loaded, total: result.total }); })
      .catch((e) => { if (live) setActive(loadError(e)); });
    return () => { live = false; };
  }, [tab, attempt]);
  useEffect(() => {
    if (tab !== 'bank') return;
    let live = true;
    const t = window.setTimeout(() => { fetchBank(q).then((rows) => { if (live) setBank({ kind: 'ready', rows }); }).catch((e) => { if (live) setBank(loadError(e)); }); }, 250);
    return () => { live = false; window.clearTimeout(t); };
  }, [tab, q, attempt]);

  const activeRows = useMemo(() => {
    if (active.kind !== 'ready') return [];
    const needle = q.trim().toLowerCase();
    return active.rows.filter((row) => {
      if (job && row.vacancyId !== job) return false;
      if (source && row.source !== source) return false;
      if (stage && row.stage !== stage) return false;
      if (!needle) return true;
      return `${row.name} ${row.title ?? ''} ${row.job}`.toLowerCase().includes(needle);
    });
  }, [active, q, job, source, stage]);
  useEffect(() => {
    if (tab !== 'active' || active.kind !== 'ready') return;
    const visible = new Set(activeRows.map((row) => row.applicationId));
    if (seededIdsRef.current !== rawIds) {
      seededIdsRef.current = rawIds;
      if (urlIds.length > 0) {
        const idSet = new Set(urlIds);
        const restored = activeRows
          .filter((row) => idSet.has(row.candidateId) || idSet.has(row.applicationId))
          .slice(0, 4)
          .map((row) => row.applicationId);
        setPicked(restored);
        return;
      }
    }
    setPicked((prev) => {
      const next = prev.filter((id) => visible.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [tab, active, activeRows, rawIds, urlIds]);

  const jobs = active.kind === 'ready' ? [...new Map(active.rows.map((row) => [row.vacancyId, row.job])).entries()] : [];
  const sources = active.kind === 'ready' ? [...new Set(active.rows.map((row) => row.source).filter((value): value is string => Boolean(value)))] : [];
  const pickedRows = activeRows.filter((row) => picked.includes(row.applicationId));
  const returnTo = buildCandidatesHref({
    tab,
    search: q,
    job,
    source,
    stage,
    ids: tab === 'active' && pickedRows.length > 0 ? pickedRows.map((row) => row.candidateId) : null,
  });
  const sameJob = pickedRows.length > 0 && pickedRows.every((row) => row.vacancyId === pickedRows[0].vacancyId);
  const canCompare = pickedRows.length >= 2 && pickedRows.length <= 4 && sameJob;
  const compareHref = canCompare
    ? buildCompareHref({
      job: pickedRows[0].vacancyId,
      ids: pickedRows.map((row) => row.candidateId),
      search: q,
      source,
      stage,
    })
    : null;
  const why = pickedRows.length < 2 ? 'Select 2 to 4 people on the same job.' : !sameJob ? 'Compare works within one job; select people on the same job.' : pickedRows.length > 4 ? 'Compare up to 4.' : '';
  const toggle = (id: string) => setPicked((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  const cur = tab === 'active' ? active : bank;
  const truncated = active.kind === 'ready' && active.truncated;
  const shown = tab === 'active' ? activeRows.length : bank.kind === 'ready' ? bank.rows.length : 0;

  return (
    <div className="rf2-jobs rf2-cand">
      <div className="rf2-row-between">
        <div>
          <h1 className="rf2-jobs__title">Candidates</h1>
        </div>
        {tab === 'active' ? (compareHref
          ? <Link className="rf2-btn rf2-btn--primary rf2-btn--md" to={compareHref}><Scale aria-hidden="true" /> Compare {pickedRows.length} on skills</Link>
          : <><ButtonV2 icon={<Scale />} disabled aria-describedby="cmp-why">Compare on skills</ButtonV2><span id="cmp-why" className="rf2-sr-only">{why}</span></>) : null}
      </div>
      <nav className="rf2-cand__actions" aria-label="Candidate records">
        <ButtonV2 kind="secondary" icon={<Users />} onClick={() => setTab('bank')}>Candidate bank</ButtonV2>
        <Link className="rf2-btn rf2-btn--secondary rf2-btn--md" to="/import#import-history"><History aria-hidden="true" /> Import history</Link>
      </nav>
      <div className="rf2-jobs__filters">
        <div className="rf2-seg" role="tablist" aria-label="Candidates view">
          <button type="button" role="tab" aria-selected={tab === 'active'} className="rf2-seg__opt" onClick={() => setTab('active')}>Active applications</button>
          <button type="button" role="tab" aria-selected={tab === 'bank'} className="rf2-seg__opt" onClick={() => setTab('bank')}>Bank</button>
        </div>
        <InputV2 label="Search people" fieldClassName="rf2-jobs__search rf2-sr-label" placeholder="Search name, title, or job" leadingIcon={<Search />} value={q} onChange={(e) => updateQuery({ search: e.target.value || null })} />
        {tab === 'active' ? (
          <>
            <SelectV2 label="Job" fieldClassName="rf2-sr-label" value={job} onChange={(e) => updateQuery({ job: e.target.value || null })}><option value="">Job: All my jobs</option>{jobs.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</SelectV2>
            <SelectV2 label="Source" fieldClassName="rf2-sr-label" value={source} onChange={(e) => updateQuery({ source: e.target.value || null })}><option value="">Source: All</option>{sources.map((item) => <option key={item} value={item}>{item}</option>)}</SelectV2>
            <SelectV2 label="Stage" fieldClassName="rf2-sr-label" value={stage} onChange={(e) => updateQuery({ stage: e.target.value || null })}><option value="">All stages</option>{OPEN_APPLICATION_STAGES.map((item) => <option key={item} value={item}>{STAGE_LABEL[item] ?? item}</option>)}</SelectV2>
          </>
        ) : null}
        <p className="rf2-jobs__count" aria-live="polite">{cur.kind === 'ready' ? listCount(shown, tab === 'active' ? pickedRows.length : 0, tab === 'active' && truncated) : ''}</p>
      </div>
      {cur.kind === 'loading' ? <SkeletonV2 lines={6} label="Loading people…" /> : null}
      {cur.kind === 'forbidden' ? <ForbiddenStateV2 body="Your role does not include candidates." /> : null}
      {cur.kind === 'error' ? <div role="alert"><EmptyStateV2 title="Could not load people" body={cur.message} action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Try again</ButtonV2>} /></div> : null}
      {tab === 'active' && active.kind === 'ready' ? (
        <section className="rf2-panel" aria-label="Active applications">
          {truncated ? <p className="rf2-cand__bound" role="status">{`This list is incomplete. Loaded ${active.loaded} of ${active.total ?? active.loaded} applications; stage, job, source, and search apply only to that window.`}</p> : null}
          {activeRows.length === 0 ? <EmptyStateV2 headingLevel={3} title={active.rows.length === 0 && !truncated ? 'No active applications' : 'No people match these filters'} body={active.rows.length === 0 && !truncated ? 'People you add to your jobs show here.' : 'Try another stage, job, source, or search.'} /> : (
              <table className="rf2-jtable">
                <thead><tr><th scope="col" className="rf2-row-check"><span className="rf2-sr-only">Select</span></th><th scope="col">Candidate / job</th><th scope="col">Stage</th><th scope="col">Source</th><th scope="col">Owner</th><th scope="col">Next action</th><th scope="col"><span className="rf2-sr-only">Open</span></th></tr></thead>
                <tbody>{activeRows.map((row) => {
                  const href = applicationHref(row.applicationId, returnTo);
                  const years = [row.experienceYears != null ? `${row.experienceYears} yrs` : null, row.title].filter(Boolean).join(' · ');
                  return (
                    <tr key={row.applicationId} data-selected={picked.includes(row.applicationId) || undefined}>
                      <td><input type="checkbox" aria-label={`Select ${row.name} (${row.job})`} checked={picked.includes(row.applicationId)} onChange={() => toggle(row.applicationId)} /></td>
                      <td className="rf2-cand__who"><div className="rf2-kcard__top"><span className="rf2-kcard__avatar" aria-hidden="true">{initials(row.name)}</span><div><Link className="rf2-kcard__name" to={href}>{row.name}</Link>{years ? <p className="rf2-jtable__sub">{years}</p> : null}<p className="rf2-jtable__sub">{row.job}</p></div></div></td>
                      <td><StatusChip tone="info" label={STAGE_LABEL[row.stage] ?? row.stage} /></td>
                      <td className="rf2-cand__quiet"><span className="rf2-cand__label">Source</span>{row.source ?? '—'}</td>
                      <td className="rf2-cand__quiet"><span className="rf2-cand__label">Owner</span>{row.owner ?? '—'}</td>
                      <td className="rf2-cand__next">{row.nextAt ? <StatusChip tone={row.nextAt < new Date().toISOString() ? 'warning' : 'neutral'} label={`Follow-up due ${formatDay(row.nextAt)}`} /> : row.next ?? '—'}</td>
                      <td className="rf2-jtable__act"><Link className="rf2-btn rf2-btn--secondary rf2-btn--sm" to={href} aria-label={`Open ${row.name}`}>Open</Link></td>
                    </tr>
                  );
                })}</tbody>
              </table>
          )}
        </section>
      ) : null}
      {tab === 'bank' && bank.kind === 'ready' ? <BankPanel rows={bank.rows} returnTo={returnTo} onAdded={() => setAttempt((n) => n + 1)} /> : null}
      <p className="rf2-inline-note"><Info aria-hidden="true" /> Rejecting someone closes one application only. The person stays in the bank and can be suggested for other jobs.</p>
    </div>
  );
}

type JobChoice = { id: string; label: string };

/** One person in the bank, then one application on an open job. A repeat keeps the same person and the same file. */
function BankPanel({ rows, returnTo, onAdded }: { rows: BankRow[]; returnTo: string; onAdded: () => void }) {
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [chosen, setChosen] = useState('');
  const [jobId, setJobId] = useState('');
  const [jobs, setJobs] = useState<JobChoice[] | null>(null);
  const [jobNote, setJobNote] = useState<{ text: string; href?: string } | null>(null);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    let live = true;
    fetchOpenJobs()
      .then((open) => {
        if (!live) return;
        setJobs(open.mine.filter((item) => ACCEPTING_JOB_STATUSES.includes(item.status)).map((item) => ({ id: item.id, label: `${item.code} · ${item.title}` })));
      })
      .catch(() => { if (live) setJobs([]); });
    return () => { live = false; };
  }, []);

  const addPerson = async () => {
    const firstName = first.trim();
    const lastName = last.trim();
    const mail = email.trim();
    if (!firstName || !lastName || !mail) {
      setNotice('First name, last name, and email are required. Phone is left blank.');
      return;
    }
    setAdding(true);
    try {
      const created = await postApi<{ id: string; candidateCode?: string }>('/candidates', { firstName, lastName, email: mail, source: 'Bank' });
      setNotice(`Added one person${created.candidateCode ? ` (${created.candidateCode})` : ''}. The same email stays this one person.`);
      onAdded();
    } catch (e) {
      const hit = await existingPerson(e, { email: mail });
      if (hit) {
        setNotice(`Already one person in the bank${hit.candidateCode ? ` (${hit.candidateCode})` : ''}. No second person was created.`);
        onAdded();
        return;
      }
      setNotice(e instanceof ApiError || e instanceof Error ? e.message : 'Could not add this person.');
    } finally {
      setAdding(false);
    }
  };

  const addJob = async () => {
    if (!chosen || !jobId) return;
    setLinking(true);
    setJobNote(null);
    try {
      const created = await addToJob(jobId, chosen);
      setJobNote({ text: 'Added to this job. A second application was not created.', href: applicationHref(created.id, returnTo) });
    } catch (e) {
      if (isApplicationExists(e)) {
        const fileId = await findExistingFile(jobId, chosen);
        setJobNote(fileId
          ? { text: 'This person already has an application on this job.', href: applicationHref(fileId, returnTo) }
          : { text: 'This person already has an application on this job. A second one was not created.' });
        return;
      }
      setJobNote({ text: e instanceof ApiError || e instanceof Error ? e.message : 'Could not add this person to the job.' });
    } finally {
      setLinking(false);
    }
  };

  return (
    <section className="rf2-panel" aria-label="Bank">
      <nav className="rf2-bank-links" aria-label="Bank tools">
        <Link to="/import">Review a workbook</Link>
        <Link to="/cv-bank">CV bank</Link>
        <Link to="/sourcing-match">Search and match</Link>
        <Link to="/talent-pools">Talent pools</Link>
      </nav>
      <p className="rf2-inline-note"><Info aria-hidden="true" /> PDF and Word CVs are added from a job. Workbooks are reviewed on the import page, and each duplicate needs a decision. A ZIP of CVs is not an intake format.</p>
      <form className="rf2-bank-add" onSubmit={(e) => { e.preventDefault(); void addPerson(); }}>
        <InputV2 label="First name" value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="off" />
        <InputV2 label="Last name" value={last} onChange={(e) => setLast(e.target.value)} autoComplete="off" />
        <InputV2 label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" hint="Same email keeps one person." />
        <ButtonV2 kind="secondary" type="submit" loading={adding}>Add to the bank</ButtonV2>
      </form>
      {notice ? <p role="status">{notice}</p> : null}
      <form className="rf2-bank-add" onSubmit={(e) => { e.preventDefault(); void addJob(); }}>
        <SelectV2 label="Open job" value={jobId} onChange={(e) => setJobId(e.target.value)} disabled={!jobs || jobs.length === 0}>
          <option value="">{jobs && jobs.length === 0 ? 'No open job loaded' : 'Choose an open job'}</option>
          {(jobs ?? []).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </SelectV2>
        <ButtonV2 kind="secondary" type="submit" loading={linking} disabled={!chosen || !jobId}>Add the chosen person to this job</ButtonV2>
      </form>
      {jobNote ? <p role="status">{jobNote.text}{jobNote.href ? <> <Link to={jobNote.href}>Open the application</Link></> : null}</p> : null}
      {rows.length === 0 ? <EmptyStateV2 headingLevel={3} title="No one found" body="Try another name or title." /> : (
        <table className="rf2-jtable">
          <thead><tr><th scope="col"><span className="rf2-sr-only">Choose</span></th><th scope="col">Name</th><th scope="col">Current title</th><th scope="col">Location</th><th scope="col">Experience</th></tr></thead>
          <tbody>{rows.map((row) => (
            <tr key={row.candidateId}>
              <td><input type="radio" name="bank-person" value={row.candidateId} aria-label={`Choose ${row.name} for a job`} checked={chosen === row.candidateId} onChange={() => setChosen(row.candidateId)} /></td>
              <td><p className="rf2-jtable__name">{row.name}</p><p className="rf2-jtable__sub">{row.code}</p></td>
              <td><span className="rf2-cand__label">Title</span>{row.title ?? '—'}</td>
              <td><span className="rf2-cand__label">Location</span>{row.location ?? '—'}</td>
              <td className="rf2-num"><span className="rf2-cand__label">Experience</span>{row.experienceYears != null ? `${row.experienceYears} yrs` : '—'}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </section>
  );
}
