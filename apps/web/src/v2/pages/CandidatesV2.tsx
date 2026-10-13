import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Info, RotateCw, Scale, Search } from 'lucide-react';
import { ApiError, postApi } from '../../api/client';
import { ButtonV2, EmptyStateV2, ForbiddenStateV2, InputV2, SelectV2, SkeletonV2, StatusChip } from '../../components/v2';
import { findExistingFile, isApplicationExists } from '../api/applicationExists';
import { existingPerson } from '../api/cvImport';
import { ACCEPTING_JOB_STATUSES, fetchOpenJobs } from '../api/jobs';
import { addToJob, fetchActiveApplications, fetchBank, type ActiveRow, type BankRow } from '../api/matching';
import { formatDay } from './OpenJobsV2';
import './jobs.css';

const STAGE_LABEL: Record<string, string> = { Applied: 'Applied', Screening: 'Screening', Interview: 'Interview', Offer: 'Offer', 'Pre-Hire': 'Pre-hire' };
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
type Load<T> = { kind: 'loading' } | { kind: 'ready'; rows: T[] } | { kind: 'error'; message: string } | { kind: 'forbidden' };

/** E23 Candidates: Active applications (my files) | Bank. Name, title, years only — no contact details or pay. */
export function CandidatesV2() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'bank' ? 'bank' : 'active';
  const [q, setQ] = useState('');
  const [job, setJob] = useState('');
  const [source, setSource] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [active, setActive] = useState<Load<ActiveRow>>({ kind: 'loading' });
  const [bank, setBank] = useState<Load<BankRow>>({ kind: 'loading' });
  const onErr = (e: { statusCode?: number; message?: string }) => (e?.statusCode === 403 ? { kind: 'forbidden' as const } : { kind: 'error' as const, message: e?.message || 'Something went wrong.' });

  useEffect(() => {
    if (tab !== 'active') return;
    let live = true;
    fetchActiveApplications().then((rows) => live && setActive({ kind: 'ready', rows })).catch((e) => live && setActive(onErr(e)));
    return () => { live = false; };
  }, [tab, attempt]);
  useEffect(() => {
    if (tab !== 'bank') return;
    let live = true;
    const t = window.setTimeout(() => { fetchBank(q).then((rows) => live && setBank({ kind: 'ready', rows })).catch((e) => live && setBank(onErr(e))); }, 250);
    return () => { live = false; window.clearTimeout(t); };
  }, [tab, q, attempt]);

  const activeRows = useMemo(() => {
    if (active.kind !== 'ready') return [];
    const t = q.trim().toLowerCase();
    return active.rows.filter((r) => (!job || r.vacancyId === job) && (!source || r.source === source) && (!t || `${r.name} ${r.title ?? ''} ${r.job}`.toLowerCase().includes(t)));
  }, [active, q, job, source]);
  const jobs = active.kind === 'ready' ? [...new Map(active.rows.map((r) => [r.vacancyId, r.job])).entries()] : [];
  const sources = active.kind === 'ready' ? [...new Set(active.rows.map((r) => r.source).filter(Boolean) as string[])] : [];
  const pickedRows = active.kind === 'ready' ? active.rows.filter((r) => picked.includes(r.applicationId)) : [];
  const sameJob = pickedRows.length > 0 && pickedRows.every((r) => r.vacancyId === pickedRows[0].vacancyId);
  const canCompare = pickedRows.length >= 2 && pickedRows.length <= 4 && sameJob;
  const why = pickedRows.length < 2 ? 'Select 2 to 4 people on the same job.' : !sameJob ? 'Compare works within one job; select people on the same job.' : pickedRows.length > 4 ? 'Compare up to 4.' : '';
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const setTab = (t: string) => { const n = new URLSearchParams(params); if (t === 'bank') n.set('tab', 'bank'); else n.delete('tab'); setParams(n); setPicked([]); };
  const cur = tab === 'active' ? active : bank;

  return (
    <div className="rf2-jobs">
      <div className="rf2-row-between">
        <div><h1 className="rf2-jobs__title">Candidates</h1><p className="rf2-jobs__sub">People on your jobs, plus the bank. A person can have applications on several jobs; nothing is ever deleted.</p></div>
        {tab === 'active' ? (canCompare
          ? <Link className="rf2-btn rf2-btn--primary rf2-btn--md" to={`/candidates/compare?job=${encodeURIComponent(pickedRows[0].vacancyId)}&ids=${pickedRows.map((r) => encodeURIComponent(r.candidateId)).join(',')}`}><Scale aria-hidden="true" /> Compare {pickedRows.length} on skills</Link>
          : <><ButtonV2 icon={<Scale />} disabled aria-describedby="cmp-why">Compare on skills</ButtonV2><span id="cmp-why" className="rf2-sr-only">{why}</span></>) : null}
      </div>
      <div className="rf2-jobs__filters">
        <div className="rf2-seg" role="tablist" aria-label="Candidates view">
          <button type="button" role="tab" aria-selected={tab === 'active'} className="rf2-seg__opt" onClick={() => setTab('active')}>Active applications</button>
          <button type="button" role="tab" aria-selected={tab === 'bank'} className="rf2-seg__opt" onClick={() => setTab('bank')}>Bank</button>
        </div>
        <InputV2 label="Search people" fieldClassName="rf2-jobs__search rf2-sr-label" placeholder="Search people" leadingIcon={<Search />} value={q} onChange={(e) => setQ(e.target.value)} />
        {tab === 'active' ? (
          <>
            <SelectV2 label="Job" fieldClassName="rf2-sr-label" value={job} onChange={(e) => setJob(e.target.value)}><option value="">Job: All my jobs</option>{jobs.map(([id, t]) => <option key={id} value={id}>{t}</option>)}</SelectV2>
            <SelectV2 label="Source" fieldClassName="rf2-sr-label" value={source} onChange={(e) => setSource(e.target.value)}><option value="">Source: All</option>{sources.map((s) => <option key={s} value={s}>{s}</option>)}</SelectV2>
          </>
        ) : null}
        <p className="rf2-jobs__count" aria-live="polite">{cur.kind === 'ready' ? `${tab === 'active' ? activeRows.length : cur.rows.length} people${tab === 'active' && picked.length ? ` · ${picked.length} selected` : ''}` : ''}</p>
      </div>
      {cur.kind === 'loading' ? <SkeletonV2 lines={6} label="Loading people…" /> : null}
      {cur.kind === 'forbidden' ? <ForbiddenStateV2 body="Your role does not include candidates." /> : null}
      {cur.kind === 'error' ? <div role="alert"><EmptyStateV2 title="Could not load people" body={cur.message} action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Try again</ButtonV2>} /></div> : null}
      {tab === 'active' && active.kind === 'ready' ? (
        <section className="rf2-panel" aria-label="Active applications">
          {activeRows.length === 0 ? <EmptyStateV2 headingLevel={3} title="No active applications" body="People you add to your jobs show here." /> : (
            <table className="rf2-jtable">
              <thead><tr><th scope="col" className="rf2-row-check"><span className="rf2-sr-only">Select</span></th><th scope="col">Name</th><th scope="col">Job</th><th scope="col">Stage</th><th scope="col">Source</th><th scope="col">Owner</th><th scope="col">Next / status</th></tr></thead>
              <tbody>{activeRows.map((r) => (
                <tr key={r.applicationId} data-selected={picked.includes(r.applicationId) || undefined}>
                  <td><input type="checkbox" aria-label={`Select ${r.name} (${r.job})`} checked={picked.includes(r.applicationId)} onChange={() => toggle(r.applicationId)} /></td>
                  <td><div className="rf2-kcard__top"><span className="rf2-kcard__avatar" aria-hidden="true">{initials(r.name)}</span><div><Link className="rf2-kcard__name" to={`/applications/${encodeURIComponent(r.applicationId)}`}>{r.name}</Link><p className="rf2-jtable__sub">{[r.experienceYears != null ? `${r.experienceYears} yrs` : null, r.title].filter(Boolean).join(' · ')}</p></div></div></td>
                  <td>{r.job}</td>
                  <td><StatusChip tone="info" label={STAGE_LABEL[r.stage] ?? r.stage} /></td>
                  <td>{r.source ?? '—'}</td>
                  <td>{r.owner ?? '—'}</td>
                  <td>{r.nextAt ? <StatusChip tone={r.nextAt < new Date().toISOString() ? 'warning' : 'neutral'} label={`Follow-up due ${formatDay(r.nextAt)}`} /> : r.next ?? '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </section>
      ) : null}
      {tab === 'bank' && bank.kind === 'ready' ? <BankPanel rows={bank.rows} onAdded={() => setAttempt((n) => n + 1)} /> : null}
      <p className="rf2-inline-note"><Info aria-hidden="true" /> Rejecting someone closes one application only. The person stays in the bank and can be suggested for other jobs.</p>
    </div>
  );
}

type JobChoice = { id: string; label: string };

/** One person in the bank, then one application on an open job. A repeat keeps the same person and the same file. */
function BankPanel({ rows, onAdded }: { rows: BankRow[]; onAdded: () => void }) {
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
        setJobs(open.mine.filter((job) => ACCEPTING_JOB_STATUSES.includes(job.status)).map((job) => ({ id: job.id, label: `${job.code} · ${job.title}` })));
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
      setJobNote({ text: 'Added to this job. A second application was not created.', href: `/applications/${encodeURIComponent(created.id)}` });
    } catch (e) {
      if (isApplicationExists(e)) {
        const fileId = await findExistingFile(jobId, chosen);
        setJobNote(fileId
          ? { text: 'This person already has an application on this job.', href: `/applications/${encodeURIComponent(fileId)}` }
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
          {(jobs ?? []).map((job) => <option key={job.id} value={job.id}>{job.label}</option>)}
        </SelectV2>
        <ButtonV2 kind="secondary" type="submit" loading={linking} disabled={!chosen || !jobId}>Add the chosen person to this job</ButtonV2>
      </form>
      {jobNote ? <p role="status">{jobNote.text}{jobNote.href ? <> <Link to={jobNote.href}>Open the application</Link></> : null}</p> : null}
      {rows.length === 0 ? <EmptyStateV2 headingLevel={3} title="No one found" body="Try another name or title." /> : (
        <table className="rf2-jtable">
          <thead><tr><th scope="col"><span className="rf2-sr-only">Choose</span></th><th scope="col">Name</th><th scope="col">Current title</th><th scope="col">Location</th><th scope="col">Experience</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.candidateId}>
              <td><input type="radio" name="bank-person" value={r.candidateId} aria-label={`Choose ${r.name} for a job`} checked={chosen === r.candidateId} onChange={() => setChosen(r.candidateId)} /></td>
              <td><p className="rf2-jtable__name">{r.name}</p><p className="rf2-jtable__sub">{r.code}</p></td>
              <td>{r.title ?? '—'}</td><td>{r.location ?? '—'}</td><td className="rf2-num">{r.experienceYears != null ? `${r.experienceYears} yrs` : '—'}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </section>
  );
}
