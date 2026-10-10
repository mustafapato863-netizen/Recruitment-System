import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Clock, Download, Info, RotateCw, ShieldAlert } from 'lucide-react';
import { ButtonV2, DrawerV2, EmptyStateV2, SelectV2, SkeletonV2, StatusChip, TextareaV2, initials } from '../../components/v2';
import { cairoMonth, monthLabel, tooFew, type ResultTile, type TileKey } from '../api/myResult';
import { rowTooFew } from '../api/teamResult';
import { fetchUsers, seatOf } from './usersApi';
import {
  OVERRIDE_LABEL, OVERRIDE_MIN_REASON, downloadCsv, fetchOffersWaiting, fetchOrgJobs, fetchStageCounts, fetchTeamReport, overrideError, overridesFor, postOverride, toCsv,
  type OrgJob, type OverrideAction, type StageCount, type TeamReportRow, type WaitingOfferRow,
} from './opsApi';
import '../pages/jobs.css';
import '../pages/team.css';
import './admin.css';

const shift = (m: string, n: number) => { const d = new Date(`${m}-15T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); };
const day = (d: string | null) => (d ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Cairo' }).format(new Date(d.length === 10 ? `${d}T12:00:00Z` : d)) : '—');
const ago = (iso: string | null) => { if (!iso) return null; const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); return d <= 0 ? 'today' : d === 1 ? '1 day' : `${d} days`; };
const tone = (s: string | null) => (s === 'On Hold' ? 'warning' : s === 'Open' || s === 'Partially Filled' ? 'success' : 'neutral') as 'warning' | 'success' | 'neutral';
const COLS: Array<{ key: TileKey; label: string }> = [{ key: 'seats', label: 'Seats' }, { key: 'overdueFollowUps', label: 'Overdue follow-ups' }, { key: 'screensReachedInterview', label: 'Screen → interview' }, { key: 'offersAccepted', label: 'Offers accepted' }];
const tileText = (k: TileKey, t: ResultTile) => (k === 'overdueFollowUps' ? String(t.value) : `${t.value} of ${t.of}`);

interface Data { jobs: OrgJob[]; offers: WaitingOfferRow[] | null; stages: StageCount[] | null; team: TeamReportRow[] | null }

/** A08 Reports (Admin seat): open jobs (+ admin override), stage counts, offers waiting, hiring report by team. Not a daily desk. */
export function AdminReportsV2() {
  const [params, setParams] = useSearchParams();
  const month = /^\d{4}-\d{2}$/.test(params.get('month') ?? '') ? params.get('month')! : cairoMonth();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [site, setSite] = useState('all');
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    let live = true; setData(null); setError(null);
    (async () => {
      const [jobs, offers, stages, users] = await Promise.all([fetchOrgJobs(), fetchOffersWaiting().catch(() => null), fetchStageCounts(month), fetchUsers().catch(() => [])]);
      const managers = users.filter((u) => seatOf(u) === 'manager' && u.status === 'Active' && users.some((r) => r.managerId === u.id)).sort((a, b) => a.displayName.localeCompare(b.displayName))
        .map((u) => ({ id: u.id, name: u.displayName, team: u.jobTitle ?? null }));
      const team = await fetchTeamReport(month, managers);
      return { jobs, offers, stages, team };
    })().then((d) => live && setData(d)).catch((e: { message?: string }) => live && setError(e?.message || 'Something went wrong.'));
    return () => { live = false; };
  }, [month, attempt]);
  const go = (patch: Record<string, string | null>) => { const n = new URLSearchParams(params); for (const [k, v] of Object.entries(patch)) (v ? n.set(k, v) : n.delete(k)); setParams(n); };
  const sites = useMemo(() => [...new Set((data?.jobs ?? []).map((j) => j.site).filter(Boolean) as string[])].sort(), [data]);
  const jobs = (data?.jobs ?? []).filter((j) => site === 'all' || j.site === site).sort((a, b) => a.title.localeCompare(b.title));
  const overriding = data?.jobs.find((j) => j.id === params.get('override')) ?? null;
  const max = Math.max(1, ...(data?.stages ?? []).map((s) => s.count));
  const exportCsv = () => {
    if (!data) return;
    const parts = [
      toCsv(['Job', 'Site', 'Owner', 'Seats filled', 'Seats', 'Due', 'Active files', 'Status'], jobs.map((j) => [j.title, j.site, j.owner, j.seats.filled, j.seats.target, j.dueDate, j.active, j.status])),
      toCsv(['Team', 'Manager', 'People', ...COLS.map((c) => c.label), 'Too few to judge'], (data.team ?? []).map((t) => [t.team, t.managerName, t.people, ...COLS.map((c) => tileText(c.key, t.tiles[c.key])), rowTooFew(t.tiles) ? 'yes' : 'no'])),
    ];
    downloadCsv(`recruitflow-report-${month}.csv`, parts.join('\r\n\r\n'));
  };
  return (
    <div className="rf2-jobs rf2-admin">
      <div className="rf2-row-between">
        <div><h1 className="rf2-jobs__title">Reports</h1><p className="rf2-jobs__sub">Open jobs, files by stage, offers waiting and the hiring report by team. Not a daily desk.</p></div>
        <ButtonV2 icon={<Download />} onClick={exportCsv} disabled={!data}>Export CSV</ButtonV2>
      </div>
      <div className="rf2-admin__filterset">
        <div className="rf2-segmented" role="group" aria-label="Period">
          <ButtonV2 kind="secondary" size="sm" icon={<ChevronLeft />} onClick={() => go({ month: shift(month, -1) })} aria-label="Previous month" />
          <span className="rf2-tres__month" aria-live="polite">{monthLabel(month)}</span>
          <ButtonV2 kind="secondary" size="sm" icon={<ChevronRight />} onClick={() => go({ month: shift(month, 1) })} disabled={month >= cairoMonth()} aria-label="Next month" />
        </div>
        <SelectV2 label="Site filter" fieldClassName="rf2-sr-label" value={site} onChange={(e) => setSite(e.target.value)}>
          <option value="all">Site: All</option>{sites.map((s) => <option key={s} value={s}>Site: {s}</option>)}
        </SelectV2>
      </div>
      {note ? <p className="rf2-inline-note" data-tone="success" role="status">{note}</p> : null}
      {!data && !error ? <SkeletonV2 lines={8} label="Loading reports…" /> : null}
      {error ? <div role="alert"><EmptyStateV2 title="Could not load reports" body={error} action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Try again</ButtonV2>} /></div> : null}
      {data ? (
        <>
          <section className="rf2-panel rf2-admin__card" aria-labelledby="oj-h">
            <div className="rf2-row-between rf2-admin__head"><h2 id="oj-h" className="rf2-jtable__name">Open jobs</h2><span className="rf2-jtable__sub">{jobs.length} {jobs.length === 1 ? 'job' : 'jobs'} · today</span></div>
            <table className="rf2-jtable" aria-label="Open jobs">
              <thead><tr><th scope="col">Job</th><th scope="col">Owner</th><th scope="col">Seats</th><th scope="col">Due</th><th scope="col" className="rf2-num">Active files</th><th scope="col">Status</th><th scope="col"><span className="rf2-sr-only">Override</span></th></tr></thead>
              <tbody>{jobs.map((j) => (
                <tr key={j.id}>
                  <th scope="row"><span className="rf2-jtable__name">{j.title}</span><span className="rf2-jtable__sub">{j.site ?? '—'}</span></th>
                  <td>{j.owner ?? '—'}</td><td>{j.seats.filled} of {j.seats.target}</td><td>{day(j.dueDate)}</td><td className="rf2-num">{j.active ?? '—'}</td>
                  <td>{j.status ? <StatusChip tone={tone(j.status)} label={j.status} /> : '—'}</td>
                  <td>{overridesFor(j.status).length ? <ButtonV2 kind="tertiary" size="sm" icon={<ShieldAlert />} onClick={() => go({ override: j.id })} aria-label={`Override ${j.title}`}>Override</ButtonV2> : null}</td>
                </tr>
              ))}{jobs.length === 0 ? <tr><td colSpan={7}>No open jobs.</td></tr> : null}</tbody>
            </table>
          </section>
          <div className="rf2-admin__two">
            <section className="rf2-panel rf2-admin__card" aria-labelledby="st-h">
              <div className="rf2-row-between rf2-admin__head"><h2 id="st-h" className="rf2-jtable__name">Files by stage</h2><span className="rf2-jtable__sub">{monthLabel(month)}</span></div>
              {data.stages?.length ? (
                <ul className="rf2-admin__bars" aria-label="Files by stage">{data.stages.map((s) => (
                  <li key={s.name}><span>{s.name === 'Pre-Hire' ? 'Pre-hire' : s.name}</span><span className="rf2-admin__bar" aria-hidden="true"><span style={{ width: `${(s.count / max) * 100}%` }} /></span><span className="rf2-num">{s.count}</span></li>
                ))}</ul>
              ) : <p className="rf2-jtable__sub rf2-admin__pad">No stage counts for this month.</p>}
              <p className="rf2-jtable__sub rf2-admin__pad"><Info aria-hidden="true" className="rf2-admin__i" /> Time in stage (median days) needs a backend field; counts shown until then.</p>
            </section>
            <section className="rf2-panel rf2-admin__card" aria-labelledby="ow-h">
              <div className="rf2-row-between rf2-admin__head"><h2 id="ow-h" className="rf2-jtable__name">Offers waiting</h2><span className="rf2-jtable__sub">{data.offers ? `${data.offers.length} ${data.offers.length === 1 ? 'offer' : 'offers'}` : ''}</span></div>
              {data.offers === null ? <p className="rf2-jtable__sub rf2-admin__pad">Offers are not available on this server.</p> : data.offers.length === 0 ? <p className="rf2-jtable__sub rf2-admin__pad">Nothing waiting on a Manager.</p> : (
                <ul className="rf2-admin__offers">{data.offers.map((o) => (
                  <li key={o.id}><span className="rf2-avatar rf2-team__avatar" aria-hidden="true">{initials(o.candidate)}</span>
                    <span><span className="rf2-jtable__name">{o.candidate} · {o.job}</span><span className="rf2-jtable__sub">Offer v{o.version}{o.submittedAt ? ` · submitted ${day(o.submittedAt)}` : ''}</span></span>
                    {ago(o.submittedAt) ? <StatusChip tone="neutral" icon={<Clock />} label={`Waiting on the Manager · ${ago(o.submittedAt)}`} /> : null}</li>
                ))}</ul>
              )}
            </section>
          </div>
          <section className="rf2-panel rf2-admin__card" aria-labelledby="tr-h">
            <div className="rf2-row-between rf2-admin__head"><h2 id="tr-h" className="rf2-jtable__name">Hiring report by team</h2><span className="rf2-jtable__sub">Same four measures as My result</span></div>
            {data.team === null ? <p className="rf2-jtable__sub rf2-admin__pad">Monthly results (/results/org) are not on this server yet.</p> : data.team.length === 0 ? <p className="rf2-jtable__sub rf2-admin__pad">No manager has direct reports yet. Set reporting lines in Users → Reporting tree.</p> : (
              <table className="rf2-jtable rf2-tres__table" aria-label="Hiring report by team">
                <thead><tr><th scope="col">Team</th><th scope="col">Sample (n files)</th>{COLS.map((c) => <th key={c.key} scope="col">{c.label}</th>)}</tr></thead>
                <tbody>{data.team.map((t) => (
                  <tr key={t.managerId}>
                    <th scope="row"><span className="rf2-jtable__name">{t.team ?? t.managerName}</span><span className="rf2-jtable__sub">{t.managerName}’s {t.people} direct {t.people === 1 ? 'report' : 'reports'}</span></th>
                    <td>{Math.max(...COLS.filter((c) => c.key !== 'seats').map((c) => t.tiles[c.key].sampleSize))}{rowTooFew(t.tiles) ? <><br /><StatusChip tone="neutral" icon={<Clock />} label="Too few to judge" /></> : null}</td>
                    {COLS.map((c) => <td key={c.key} data-too-few={tooFew(c.key, t.tiles[c.key]) || undefined}>{tileText(c.key, t.tiles[c.key])}</td>)}
                  </tr>
                ))}</tbody>
              </table>
            )}
            <p className="rf2-jtable__sub rf2-admin__pad">No previous period — no comparison is shown. No call, message or CV-view counts.</p>
          </section>
        </>
      ) : null}
      {overriding ? <OverrideDrawer job={overriding} onClose={() => go({ override: null })} onDone={(m) => { setNote(m); go({ override: null }); setAttempt((n) => n + 1); }} /> : null}
    </div>
  );
}

/** A5 Admin override (B9 POST /admin/overrides): hold / reopen / close a job with a reason (≥ 10 chars); audited as ADMIN_OVERRIDE. */
export function OverrideDrawer({ job, onClose, onDone }: { job: OrgJob; onClose: () => void; onDone: (m: string) => void }) {
  const actions = overridesFor(job.status);
  const [action, setAction] = useState<OverrideAction | ''>(actions.length === 1 ? actions[0] : '');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<{ field?: 'reason' | 'action'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!action) return setErr({ field: 'action', text: 'Pick what to do.' });
    if (reason.trim().length < OVERRIDE_MIN_REASON) return setErr({ field: 'reason', text: `An override needs a reason (at least ${OVERRIDE_MIN_REASON} characters).` });
    setBusy(true); setErr(null);
    try { const r = await postOverride(action, job.id, reason.trim()); onDone(`${job.title}: ${r?.from ?? job.status} → ${r?.to ?? OVERRIDE_LABEL[action]}. Logged in Audit as an admin override.`); }
    catch (e) { setErr(overrideError(e)); } finally { setBusy(false); }
  };
  return (
    <DrawerV2 open onClose={onClose} kicker="Admin override" title={job.title} subtitle={`${job.site ?? ''}${job.owner ? ` · owner ${job.owner}` : ''} · ${job.status}`}
      confirmClose={() => !reason.trim() || window.confirm('Discard this override?')}
      primaryAction={<ButtonV2 icon={<ShieldAlert />} loading={busy} onClick={() => void submit()}>Apply override</ButtonV2>}
      secondaryAction={<ButtonV2 kind="secondary" onClick={onClose}>Cancel</ButtonV2>}>
      <fieldset className="rf2-choices">
        <legend className="rf2-field__label">What to do</legend>
        {actions.map((a) => (
          <label key={a} className="rf2-choice"><input type="radio" name="override" value={a} checked={action === a} onChange={() => { setAction(a); setErr(null); }} /> {OVERRIDE_LABEL[a]}</label>
        ))}
        {err?.field === 'action' ? <p className="rf2-form-error" role="alert">{err.text}</p> : null}
      </fieldset>
      <TextareaV2 label="Reason" required rows={3} value={reason} onChange={(e) => { setReason(e.target.value); setErr(null); }} error={err?.field === 'reason' ? err.text : undefined} hint={`At least ${OVERRIDE_MIN_REASON} characters. Kept on the audit log with who did it and the before/after status.`} />
      {err && !err.field ? <p className="rf2-form-error" role="alert">{err.text}</p> : null}
      <p className="rf2-inline-note" data-tone="warning"><Info aria-hidden="true" /> Use this only when the owner can’t act. Files are reassigned by their Manager from Team work, not here.</p>
    </DrawerV2>
  );
}
