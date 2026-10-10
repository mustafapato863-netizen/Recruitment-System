import type React from 'react';
import { isScorecardSubmitted } from '../../utils/scorecardStatus';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarDays, Check, CircleCheck, Clock, FileText, Minus, RotateCw, Send, Star, XCircle } from 'lucide-react';
import { ApiError } from '../../api/client';
import { ButtonV2 } from '../../components/v2/Button';
import { StatusChip } from '../../components/v2/StatusChip';
import { EmptyStateV2, ForbiddenStateV2, SkeletonV2 } from '../../components/v2/PageStates';
import { InputV2, TextareaV2 } from '../../components/v2/Field';
import '../../components/v2/v2-primitives.css';
import './application-file.css';
import { FILE_STAGES, addNote, candidateName, gateState, loadApplicationFile, setFollowUp, type ApplicationFile } from '../api/applicationFile';
import { DRAWERS, DRAWER_KEYS, errorText, sentBack, type DrawerKey } from '../drawers/FileDrawers';

type Load = { kind: 'loading' } | { kind: 'ready'; file: ApplicationFile } | { kind: 'forbidden'; message: string } | { kind: 'missing' } | { kind: 'error'; message: string };

const STAGE_LABEL: Record<string, string> = { 'Pre-Hire': 'Pre-hire' };
const label = (s: string) => STAGE_LABEL[s] ?? s;
const fmt = (iso: string, withTime = false) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', day: 'numeric', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}) }).format(d);
};

/** The one primary action per stage (v2 §7/§8) and the drawer it opens. */
export function primaryFor(file: ApplicationFile): { key: DrawerKey; label: string; icon: React.ReactElement } | null {
  const { stage } = file.workspace.application;
  const g = gateState(file);
  switch (stage) {
    case 'Applied':
    case 'Screening':
      return g.screenNote ? { key: 'schedule', label: 'Schedule interview', icon: <CalendarDays /> } : { key: 'screen', label: 'Log screen', icon: <Check /> };
    case 'Interview':
      if (!file.interviews.some((i) => i.status !== 'Cancelled')) return { key: 'schedule', label: 'Schedule interview', icon: <CalendarDays /> };
      return g.scorecard ? { key: 'offer', label: 'Draft offer', icon: <Send /> } : { key: 'scorecard', label: 'Open scorecard', icon: <Star /> };
    case 'Offer': {
      const st = file.offer?.status;
      if (!file.offer) return { key: 'offer', label: 'Draft offer', icon: <Send /> };
      if (sentBack(file.offer)) return { key: 'offer', label: 'Revise and resubmit', icon: <Send /> };
      if (st === 'Draft') return { key: 'waiting', label: 'Submit for approval', icon: <Send /> };
      if (st === 'Pending Approval') return { key: 'waiting', label: 'View approval', icon: <Clock /> };
      if (st === 'Approved') return { key: 'send', label: 'Send offer', icon: <Send /> };
      if (st === 'Sent') return { key: 'answer', label: 'Record answer', icon: <Check /> };
      if (st === 'Accepted') return { key: 'prehire', label: 'Move to Pre-hire', icon: <ArrowRight /> };
      if (st === 'Expired') return { key: 'offer', label: 'New offer version', icon: <Send /> };
      return { key: 'offer', label: 'Draft offer', icon: <Send /> };
    }
    case 'Pre-Hire':
      return { key: 'prehire', label: 'Pre-hire checklist', icon: <CircleCheck /> };
    default:
      return null;
  }
}

function gateRows(file: ApplicationFile): Array<{ to: string; label: string; ok: boolean }> {
  const g = gateState(file);
  const stage = file.workspace.application.stage;
  if (stage === 'Applied' || stage === 'Screening') return [{ to: 'Interview', label: 'Screen note saved', ok: g.screenNote }];
  if (stage === 'Interview') return [{ to: 'Offer', label: 'Scorecard submitted', ok: g.scorecard }];
  if (stage === 'Offer') return [{ to: 'Pre-hire', label: 'Offer accepted', ok: g.offerAccepted }];
  if (stage === 'Pre-Hire') return g.joining.map((j) => ({ to: 'Joined', label: `${j.label} checked`, ok: j.done }));
  return [];
}

export function ApplicationFileV2({ load = loadApplicationFile }: { load?: typeof loadApplicationFile } = {}) {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const drawer = params.get('drawer') as DrawerKey | null;

  useEffect(() => {
    let alive = true;
    load(id)
      .then((file) => alive && setState({ kind: 'ready', file }))
      .catch((e: unknown) => {
        if (!alive) return;
        if (e instanceof ApiError && e.statusCode === 403) setState({ kind: 'forbidden', message: e.message });
        else if (e instanceof ApiError && e.statusCode === 404) setState({ kind: 'missing' });
        else setState({ kind: 'error', message: e instanceof Error ? e.message : 'Could not load this file.' });
      });
    return () => { alive = false; };
  }, [id, load, attempt]);

  const openDrawer = useCallback((key: DrawerKey, extra?: Record<string, string>) => setParams((p) => {
    const n = new URLSearchParams(p); n.set('drawer', key);
    for (const [k, v] of Object.entries(extra ?? {})) n.set(k, v);
    return n;
  }), [setParams]);
  const closeDrawer = useCallback(() => setParams((p) => { const n = new URLSearchParams(p); n.delete('drawer'); n.delete('interview'); return n; }), [setParams]);
  const done = useCallback(() => { closeDrawer(); setAttempt((n) => n + 1); }, [closeDrawer]);

  if (state.kind === 'loading') return <div className="rf2-file"><SkeletonV2 lines={8} label="Loading the application file…" /></div>;
  if (state.kind === 'forbidden') return <div className="rf2-file"><ForbiddenStateV2 title="This file belongs to another owner" body="Ask the owner or your manager if you need it." action={<Link className="rf2-btn rf2-btn--secondary rf2-btn--md" to="/my-work">Back to My Work</Link>} /></div>;
  if (state.kind === 'missing') return <div className="rf2-file"><EmptyStateV2 title="File not found" body="It may have been moved or closed." /></div>;
  if (state.kind === 'error') return <div className="rf2-file" role="alert"><EmptyStateV2 title="Could not load this file" body={state.message} action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Try again</ButtonV2>} /></div>;

  const { file } = state;
  const app = file.workspace.application;
  const name = candidateName(app);
  const primary = primaryFor(file);
  const closed = app.stage === 'Rejected' || app.stage === 'Withdrawn' || app.stage === 'Joined';
  const curIdx = FILE_STAGES.indexOf(app.stage as (typeof FILE_STAGES)[number]);
  const Drawer = drawer && DRAWER_KEYS.includes(drawer) ? DRAWERS[drawer] : null;
  const initials = name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="rf2-file">
      <Link className="rf2-file__back" to={`/vacancies/${encodeURIComponent(app.vacancyId)}`}><ArrowLeft aria-hidden="true" /> {app.positionTitle ?? 'Job'} pipeline</Link>
      <section className="rf2-file__header" aria-labelledby="file-name">
        <div className="rf2-file__who">
          <span className="rf2-file__avatar" aria-hidden="true">{initials}</span>
          <div>
            <h2 id="file-name" className="rf2-file__name">{name} <StatusChip tone={app.stage === 'Rejected' ? 'danger' : app.stage === 'Joined' ? 'success' : 'info'} label={label(app.stage)} /></h2>
            <p className="rf2-file__meta">{[app.positionTitle, app.vacancyBranchName ?? app.vacancyLocation, app.primaryRecruiterName ? `Owner: ${app.primaryRecruiterName}` : null, app.source ? `Source: ${app.source}` : null].filter(Boolean).join(' · ')}</p>
          </div>
          <div className="rf2-file__actions">
            {!closed ? <ButtonV2 kind="danger-outline" icon={<XCircle />} onClick={() => openDrawer('reject')}>Reject</ButtonV2> : null}
            {primary && !closed ? <ButtonV2 icon={primary.icon} onClick={() => openDrawer(primary.key)}>{primary.label}</ButtonV2> : null}
          </div>
        </div>
        <ol className="rf2-stepper" aria-label="Stages">
          {FILE_STAGES.map((s, i) => {
            const st = app.stage === 'Rejected' ? (i <= curIdx ? 'done' : 'todo') : i < curIdx ? 'done' : i === curIdx ? 'current' : 'todo';
            return (
              <li key={s} className="rf2-stepper__step" data-state={st} aria-current={st === 'current' ? 'step' : undefined}>
                {st === 'done' ? <Check aria-hidden="true" /> : st === 'current' ? <ArrowRight aria-hidden="true" /> : <Minus aria-hidden="true" />}
                <span>{label(s)}</span><span className="rf2-visually-hidden">{st === 'done' ? ' (done)' : st === 'current' ? ' (current)' : ''}</span>
              </li>
            );
          })}
        </ol>
        {app.stage === 'Rejected' ? <p className="rf2-file__closed" role="note">Closed as Rejected{app.rejectionReason ? ` — ${app.rejectionReason}` : ''}.</p> : null}
        <div className="rf2-file__strip">
          <FollowUp id={app.id} value={app.followUpDate ?? null} closed={closed} onSaved={() => setAttempt((n) => n + 1)} />
          {gateRows(file).length ? (
            <ul className="rf2-gates rf2-gates--inline" aria-label={`Gate to ${gateRows(file)[0].to}`}>
              <li className="rf2-gates__title">To move to {gateRows(file)[0].to}:</li>
              {gateRows(file).map((g) => (
                <li key={g.label} className="rf2-gate" data-ok={g.ok}>{g.ok ? <CircleCheck aria-hidden="true" /> : <Clock aria-hidden="true" />}<span>{g.label}</span><span className="rf2-visually-hidden">{g.ok ? '(done)' : '(not done)'}</span></li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      <div className="rf2-file__grid">
        <div className="rf2-file__col">
          <Timeline file={file} onScorecard={(iid) => openDrawer('scorecard', { interview: iid })} />
          <Notes file={file} onAdded={() => setAttempt((n) => n + 1)} />
        </div>
        <aside className="rf2-file__col rf2-file__side">
          <section className="rf2-card" aria-labelledby="details-h">
            <h3 id="details-h" className="rf2-card__title">Details</h3>
            <dl className="rf2-terms">
              <dt>Email</dt><dd>{app.candidate?.email ?? '—'}</dd>
              <dt>Phone</dt><dd>{app.candidate?.phone ?? '—'}</dd>
              <dt>Notice period</dt><dd>{file.screening.find((s) => s.noticePeriodDays != null)?.noticePeriodDays != null ? `${file.screening.find((s) => s.noticePeriodDays != null)!.noticePeriodDays} days` : '—'}</dd>
              <dt>Source</dt><dd>{app.source ?? '—'}</dd>
              <dt>File</dt><dd>{app.applicationCode}</dd>
            </dl>
          </section>
          <section className="rf2-card" aria-labelledby="docs-h">
            <h3 id="docs-h" className="rf2-card__title">Documents</h3>
            {file.documents.length === 0 ? <p className="rf2-file__muted">No documents yet.</p> : (
              <ul className="rf2-docs">
                {file.documents.map((d) => (
                  <li key={d.id}><FileText aria-hidden="true" /><div><p>{d.name}</p><p className="rf2-timeline__sub">{[d.type, fmt(d.uploadedAt), d.uploadedBy ? `by ${d.uploadedBy.name}` : null].filter(Boolean).join(' · ')}</p></div></li>
                ))}
              </ul>
            )}
          </section>
          {file.offer ? (
            <section className="rf2-card" aria-labelledby="offer-h">
              <h3 id="offer-h" className="rf2-card__title">Offer</h3>
              <p>{file.offer.offerCode} · v{(file.offer.currentVersion ?? file.offer.versions?.[0])?.versionNumber ?? 1} · <StatusChip tone={file.offer.status === 'Accepted' ? 'success' : 'neutral'} label={file.offer.status} /></p>
              <p className="rf2-file__muted">Pay is set by the approving manager and not shown here.</p>
            </section>
          ) : null}
        </aside>
      </div>

      {Drawer ? <Drawer file={file} onClose={closeDrawer} onDone={done} params={params} /> : null}
    </div>
  );
}

/** Follow-up date (B5 PATCH /applications/:id/follow-up; owner only → 403 FOLLOW_UP_NOT_OWNER). */
function FollowUp({ id, value, closed, onSaved }: { id: string; value: string | null; closed: boolean; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(value ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | undefined>();
  const save = async (v: string | null) => {
    setBusy(true); setErr(undefined);
    try { await setFollowUp(id, v); setEditing(false); onSaved(); } catch (e) { setErr(errorText(e)); } finally { setBusy(false); }
  };
  if (!editing) {
    return (
      <p className="rf2-file__follow"><CalendarDays aria-hidden="true" /> <strong>Follow-up date</strong> <span>{value ? fmt(`${value}T12:00:00Z`) : 'Not set'}</span>
        {!closed ? <button type="button" className="rf2-link" onClick={() => { setDate(value ?? ''); setEditing(true); }}>{value ? 'Change' : 'Set'}</button> : null}</p>
    );
  }
  return (
    <div className="rf2-follow">
      <InputV2 label="Follow-up date" type="date" value={date} onChange={(e) => setDate(e.target.value)} error={err} />
      <ButtonV2 kind="secondary" size="sm" loading={busy} disabled={!date} onClick={() => void save(date)}>Save</ButtonV2>
      {value ? <ButtonV2 kind="tertiary" size="sm" disabled={busy} onClick={() => void save(null)}>Clear</ButtonV2> : null}
      <ButtonV2 kind="tertiary" size="sm" disabled={busy} onClick={() => setEditing(false)}>Cancel</ButtonV2>
    </div>
  );
}

function Timeline({ file, onScorecard }: { file: ApplicationFile; onScorecard: (interviewId: string) => void }) {
  const rows: Array<{ at: string; title: string; sub?: string; action?: React.ReactElement }> = [];
  for (const h of file.history) rows.push({ at: h.createdAt, title: h.fromStage ? `Moved ${label(h.fromStage)} → ${label(h.toStage)}` : `Applied (${label(h.toStage)})`, sub: [h.changedByName && `by ${h.changedByName}`, h.reason].filter(Boolean).join(' · ') });
  for (const s of file.screening) rows.push({ at: s.screenedAt, title: `Screening logged${s.screenerName ? ` by ${s.screenerName}` : ''} — ${s.outcome}`, sub: s.notes ?? undefined });
  for (const i of file.interviews) {
    const cards = file.scorecards[i.id] ?? [];
    const submitted = cards.filter(isScorecardSubmitted).length;
    rows.push({
      at: i.scheduledStart,
      title: `${i.title} — ${fmt(i.scheduledStart, true)}${i.status !== 'Scheduled' ? ` (${i.status})` : ''}`,
      sub: [i.locationUrl ? 'Room link' : i.roomName, i.interviewerName, `${submitted} scorecard${submitted === 1 ? '' : 's'} submitted`].filter(Boolean).join(' · '),
      action: i.status !== 'Cancelled' ? <button type="button" className="rf2-link" onClick={() => onScorecard(i.id)}>Scorecards</button> : undefined,
    });
  }
  for (const v of file.offer?.versions ?? []) rows.push({ at: v.createdAt, title: `Offer v${v.versionNumber} — ${v.status === 'Changes Requested' ? 'sent back by the manager (offer back in Draft)' : v.status ?? v.approvalStatus}`, sub: v.proposedJoiningDate ? `Start ${fmt(v.proposedJoiningDate)}` : undefined });
  rows.sort((a, b) => b.at.localeCompare(a.at));
  return (
    <section className="rf2-card" aria-labelledby="timeline-h">
      <h3 id="timeline-h" className="rf2-card__title">Timeline</h3>
      {rows.length === 0 ? <p className="rf2-file__muted">Nothing yet.</p> : (
        <ol className="rf2-timeline">
          {rows.map((r, i) => (
            <li key={i} className="rf2-timeline__row">
              <time dateTime={r.at}>{fmt(r.at)}</time>
              <div><p className="rf2-timeline__title">{r.title}</p>{r.sub ? <p className="rf2-timeline__sub">{r.sub}</p> : null}</div>
              {r.action ?? null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Notes({ file, onAdded }: { file: ApplicationFile; onAdded: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | undefined>();
  const id = file.workspace.application.id;
  const save = async () => {
    if (!text.trim()) { setErr('Write the note first.'); return; }
    setBusy(true); setErr(undefined);
    try { await addNote(id, text.trim()); setText(''); onAdded(); } catch (e) { setErr(errorText(e)); } finally { setBusy(false); }
  };
  return (
    <section className="rf2-card" aria-labelledby="notes-h">
      <h3 id="notes-h" className="rf2-card__title">Notes</h3>
      <ul className="rf2-notes">
        {file.notes.map((n) => <li key={n.id} className="rf2-notes__item"><p>{n.content}</p><p className="rf2-timeline__sub">{n.authorName ?? 'System'} · {fmt(n.createdAt)}</p></li>)}
      </ul>
      <TextareaV2 label="Add a note" rows={3} value={text} onChange={(e) => setText(e.target.value)} error={err} hint="Write with evidence. Notes can't be deleted." />
      <div className="rf2-notes__actions"><ButtonV2 kind="secondary" onClick={save} loading={busy}>Save note</ButtonV2></div>
    </section>
  );
}
