import type React from 'react';
import { isScorecardSubmitted } from '../../utils/scorecardStatus';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CircleCheck, Clock, Copy, ExternalLink, Info, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { ButtonV2 } from '../../components/v2/Button';
import { DrawerV2 } from '../../components/v2/Drawer';
import { InputV2, SelectV2, TextareaV2 } from '../../components/v2/Field';
import { StatusChip } from '../../components/v2/StatusChip';
import { UserPicker, interviewersAdapter, type UserOption } from '../../components/v2/UserPicker';
import {
  RECOMMENDATIONS, addNote, candidateName, createHiringCase, createOfferDraft, createOfferRevision,
  gateState, logScreening, moveStage, offerTemplates, rejectionReasons, reviseScorecard, scheduleInterview, sendOffer, setJoiningCheck, setOfferStatus, submitOffer, submitScorecard,
  type ApplicationFile, type FileStage, type InterviewItem, type OfferTemplate, type OfferTerms, type Recommendation, type ScorecardItem, type SendChannel, type SendOfferResult,
  needsReasonNote, OTHER_NOTE_MIN,
} from '../api/applicationFile';
import { bannerError, fieldError, serverFormErrors, NO_SERVER_ERRORS, type ServerFormErrors } from '../forms/serverErrors';
import { GATE_COPY, JOINING_CHECK_TYPES, SYSTEM_REJECTION_REASONS, WITHDRAWN_BY_CANDIDATE_REASON, domainError } from '../api/gates';

export type DrawerKey = 'screen' | 'schedule' | 'scorecard' | 'offer' | 'waiting' | 'send' | 'answer' | 'prehire' | 'reject';
export const DRAWER_KEYS: DrawerKey[] = ['screen', 'schedule', 'scorecard', 'offer', 'waiting', 'send', 'answer', 'prehire', 'reject'];

export interface DrawerProps { file: ApplicationFile; onClose: () => void; onDone: () => void; params?: URLSearchParams }

const TZ = 'Africa/Cairo';

const CHECK_LABEL: Record<string, string> = Object.fromEntries(JOINING_CHECK_TYPES.map((c) => [c.type, c.label]));
/** Error copy by code (no message matching): GATE_* → gate copy + missing[]; other domain codes → the server's message; 403 is explicit. */
export function errorText(error: unknown): string {
  const d = domainError(error);
  if (d?.code === 'FILE_CLOSED') return d.message || 'This file is closed. Joined, Rejected and Withdrawn files do not move.';
  if (d?.code === 'JOB_NOT_OWNED') return 'Only the job owner or their manager can do this.';
  if (d?.gate) return `${GATE_COPY[d.gate].message}${d.missing?.length ? ` Missing: ${d.missing.map((m) => CHECK_LABEL[m] ?? m).join(', ')}.` : ''} ${GATE_COPY[d.gate].fix}`;
  if (d?.message) return d.message;
  const e = error as { statusCode?: number; message?: string } | null;
  if (e?.statusCode === 403) return 'You can\'t change this file: it belongs to another owner.';
  return e?.message || 'Something went wrong. Try again.';
}

/**
 * #23 (B2-15/B2-7): a 400's `field`/`fields` go inline on the inputs named in `shown` (API paths);
 * the banner keeps whatever no input shows, so nothing is dropped.
 */
function useSubmit(onDone: () => void, shown: readonly string[] = []) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [server, setServer] = useState<ServerFormErrors>(NO_SERVER_ERRORS);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null); setServer(NO_SERVER_ERRORS);
    try { await fn(); onDone(); } catch (e) {
      const f = serverFormErrors(e);
      const inline = Object.keys(f.byField).length > 0;
      setServer(f);
      setError(inline ? bannerError(f, shown) : errorText(e));
    } finally { setBusy(false); }
  };
  const at = (...names: string[]) => fieldError(server, ...names);
  return { busy, error, run, setError, server, at };
}

function FormError({ text }: { text: string | null }) {
  return text ? <p className="rf2-drawer-form__error" role="alert" data-testid="drawer-error">{text}</p> : null;
}
function Note({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warning' }) {
  return <p className={`rf2-drawer-form__note rf2-drawer-form__note--${tone}`}><Info aria-hidden="true" /> <span>{children}</span></p>;
}
function Gate({ ok, label, hint }: { ok: boolean; label: string; hint?: string }) {
  return (
    <li className="rf2-gate" data-ok={ok}>
      {ok ? <CircleCheck aria-hidden="true" /> : <Clock aria-hidden="true" />}
      <span>{label}{hint && !ok ? <span className="rf2-gate__hint"> — {hint}</span> : null}</span>
      <span className="rf2-visually-hidden">{ok ? '(done)' : '(not done)'}</span>
    </li>
  );
}

/** Moves forward one stage at a time (Applied→Screening→Interview), refreshing the version in between. */
async function advanceTo(app: ApplicationFile['workspace']['application'], target: FileStage) {
  const order: FileStage[] = ['Applied', 'Screening', 'Interview', 'Offer', 'Pre-Hire', 'Joined'];
  let cur = { id: app.id, stage: app.stage, version: app.version };
  while (order.indexOf(cur.stage) < order.indexOf(target)) {
    const next = order[order.indexOf(cur.stage) + 1];
    const res = await moveStage(cur, next);
    cur = { id: app.id, stage: next, version: typeof res?.version === 'number' ? res.version : cur.version + 1 };
  }
}

/* ── E14 Screen ─────────────────────────────────────────────────────────── */
export function ScreenDrawer({ file, onClose, onDone }: DrawerProps) {
  const app = file.workspace.application;
  const [outcome, setOutcome] = useState<'Passed' | 'Failed' | 'On Hold'>('Passed');
  const [notes, setNotes] = useState('');
  const [notice, setNotice] = useState('');
  const [move, setMove] = useState(true);
  const [fieldErr, setFieldErr] = useState<string | undefined>();
  const s = useSubmit(onDone, ['notes', 'noticePeriodDays', 'outcome']);
  const canMove = ['Applied', 'Screening'].includes(app.stage);
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!notes.trim()) { setFieldErr('Write the screen note. Interview needs a saved screen note.'); return; }
    setFieldErr(undefined);
    void s.run(async () => {
      await logScreening({ applicationId: app.id, outcome, notes: notes.trim(), ...(notice ? { noticePeriodDays: Number(notice) } : {}) });
      if (move && canMove && outcome === 'Passed') await advanceTo(app, 'Interview');
    });
  };
  return (
    <DrawerV2 open onClose={onClose} kicker="Screen" title={`Log screen — ${candidateName(app)}`} subtitle={`${app.positionTitle ?? ''} · ${app.stage}`}
      confirmClose={() => !notes.trim() || window.confirm('Discard the screen note?')}
      primaryAction={<ButtonV2 onClick={() => submit()} loading={s.busy}>{move && canMove && outcome === 'Passed' ? 'Save and move to Interview' : 'Save screen'}</ButtonV2>}
      secondaryAction={<ButtonV2 kind="secondary" onClick={onClose}>Cancel</ButtonV2>}>
      <form className="rf2-drawer-form" onSubmit={submit} noValidate>
        <SelectV2 label="Outcome" value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)}>
          <option value="Passed">Pass</option><option value="On Hold">On hold</option><option value="Failed">Fail</option>
        </SelectV2>
        <TextareaV2 label="Screen note" required value={notes} onChange={(e) => setNotes(e.target.value)} error={fieldErr ?? s.at('notes')}
          hint="What you checked and what you found, with evidence. Required to move to Interview." rows={6} />
        <InputV2 label="Notice period (days)" type="number" min={0} max={3650} inputMode="numeric" value={notice} onChange={(e) => setNotice(e.target.value)} error={s.at('noticePeriodDays')} />
        {canMove && outcome === 'Passed' ? (
          <label className="rf2-check"><input type="checkbox" checked={move} onChange={(e) => setMove(e.target.checked)} /> Move to Interview after saving</label>
        ) : null}
        <Note>Pay is not recorded here.</Note>
        <FormError text={s.error} />
      </form>
    </DrawerV2>
  );
}

/* ── E15 Schedule interview (room URL only) ─────────────────────────────── */
function cairoIso(date: string, time: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
  const asCairo = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(guess - (asCairo - guess)).toISOString();
}
export { cairoIso };

export function ScheduleDrawer({ file, onClose, onDone }: DrawerProps) {
  const app = file.workspace.application;
  const [type, setType] = useState('Technical');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [duration, setDuration] = useState('60');
  const [room, setRoom] = useState('');
  const [people, setPeople] = useState<UserOption[]>([]);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const adapter = useMemo(() => interviewersAdapter(), []);
  const s = useSubmit(onDone, ['scheduledStart', 'scheduledEnd', 'locationUrl', 'attendeeUserIds', 'interviewType', 'title']);
  const gate = gateState(file);
  const needsMove = ['Applied', 'Screening'].includes(app.stage);
  const submit = () => {
    const next: Record<string, string> = {};
    if (!date) next.date = 'Pick a date.';
    if (!/^\d{2}:\d{2}$/.test(time)) next.time = 'Pick a start time.';
    try { if (new URL(room).protocol !== 'https:') next.room = 'The room link must start with https://'; } catch { next.room = 'Paste the meeting room URL (https://…).'; }
    if (!people.length) next.people = 'Add at least one interviewer.';
    setErrs(next);
    if (Object.keys(next).length) return;
    const start = cairoIso(date, time);
    const end = new Date(new Date(start).getTime() + Number(duration) * 60_000).toISOString();
    void s.run(async () => {
      if (needsMove) await advanceTo(app, 'Interview');
      await scheduleInterview({ applicationId: app.id, title: `${type} interview: ${candidateName(app)}`, interviewType: type, scheduledStart: start, scheduledEnd: end, timezone: TZ, locationUrl: room.trim(), attendeeUserIds: people.map((p) => p.id) });
    });
  };
  return (
    <DrawerV2 open onClose={onClose} kicker="Interview" title={`Schedule interview — ${candidateName(app)}`} subtitle={app.positionTitle}
      primaryAction={<ButtonV2 onClick={submit} loading={s.busy} disabled={needsMove && !gate.screenNote}>Schedule interview</ButtonV2>}
      secondaryAction={<ButtonV2 kind="secondary" onClick={onClose}>Cancel</ButtonV2>}>
      <div className="rf2-drawer-form">
        {needsMove ? (
          <ul className="rf2-gates" aria-label="Gate to Interview">
            <Gate ok={gate.screenNote} label="Screen note saved" hint="log the screen first" />
          </ul>
        ) : null}
        <SelectV2 label="Interview type" value={type} onChange={(e) => setType(e.target.value)}>
          {['Screening', 'Technical', 'Behavioral', 'Managerial'].map((t) => <option key={t}>{t}</option>)}
        </SelectV2>
        <div className="rf2-drawer-form__row">
          <InputV2 label="Date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} error={errs.date ?? s.at('scheduledStart')} />
          <InputV2 label="Start (Cairo)" type="time" required value={time} onChange={(e) => setTime(e.target.value)} error={errs.time ?? s.at('scheduledEnd')} />
          <SelectV2 label="Length" value={duration} onChange={(e) => setDuration(e.target.value)}>
            {['30', '45', '60', '90'].map((m) => <option key={m} value={m}>{m} min</option>)}
          </SelectV2>
        </div>
        <InputV2 label="Room URL" required type="url" placeholder="https://" value={room} onChange={(e) => setRoom(e.target.value)} error={errs.room ?? s.at('locationUrl')}
          hint="The meeting room link. It must be on an approved meeting host." />
        <UserPicker label="Interviewers" required multiple adapter={adapter} value={people} onChange={setPeople} error={errs.people ?? s.at('attendeeUserIds')} />
        <FormError text={s.error} />
      </div>
    </DrawerV2>
  );
}

/* ── E16 Scorecard ──────────────────────────────────────────────────────── */
export function ScorecardDrawer({ file, onClose, onDone, params }: DrawerProps) {
  const app = file.workspace.application;
  const { user } = useAuth();
  const interviews = file.interviews.filter((i) => i.status !== 'Cancelled');
  const [interviewId, setInterviewId] = useState(params?.get('interview') ?? interviews[interviews.length - 1]?.id ?? '');
  const iv: InterviewItem | undefined = interviews.find((i) => i.id === interviewId);
  const cards = file.scorecards[interviewId] ?? [];
  const mine = cards.filter((c) => c.interviewerId === user?.id).sort((a, b) => (b.revision ?? 1) - (a.revision ?? 1))[0];
  const submitted = isScorecardSubmitted(mine);
  const [form, setForm] = useState({ overallRating: mine?.overallRating ?? 0, recommendation: (mine?.recommendation ?? 'Hire') as Recommendation, strengths: mine?.strengths ?? '', concerns: mine?.concerns ?? '', notes: mine?.notes ?? '', reason: '' });
  const [revising, setRevising] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const s = useSubmit(onDone, ['overallRating', 'recommendation', 'strengths', 'concerns', 'notes', 'reason']);
  const ended = iv ? new Date(iv.scheduledEnd).getTime() <= Date.now() : false;
  const editable = !submitted || revising;

  const send = (status: 'Draft' | 'Submitted') => {
    const next: Record<string, string> = {};
    if (status === 'Submitted' && (form.overallRating < 1 || form.overallRating > 5)) next.rating = 'Choose a rating from 1 to 5.';
    if (!form.notes.trim()) next.notes = 'Write the evidence behind your rating.';
    if (revising && form.reason.trim().length < 3) next.reason = 'Say why you are revising (at least 3 characters).';
    setErrs(next);
    if (Object.keys(next).length) return;
    const body = { overallRating: form.overallRating || 1, recommendation: form.recommendation, notes: form.notes.trim(), ...(form.strengths.trim() ? { strengths: form.strengths.trim() } : {}), ...(form.concerns.trim() ? { concerns: form.concerns.trim() } : {}) };
    void s.run(() => (revising ? reviseScorecard(interviewId, { ...body, reason: form.reason.trim() }) : submitScorecard(interviewId, { ...body, status })));
  };
  return (
    <DrawerV2 open onClose={onClose} kicker="Scorecard" title={`Scorecard — ${candidateName(app)}`} subtitle={iv ? `${iv.title} · ${new Date(iv.scheduledStart).toLocaleDateString('en-GB', { timeZone: TZ, day: 'numeric', month: 'short' })}` : 'No interview yet'}
      primaryAction={editable && iv ? <ButtonV2 onClick={() => send('Submitted')} loading={s.busy} disabled={!ended && !revising}>{revising ? 'Submit revision' : 'Submit scorecard'}</ButtonV2>
        : submitted ? <ButtonV2 kind="secondary" onClick={() => setRevising(true)}>Revise with a reason</ButtonV2> : undefined}
      secondaryAction={editable && iv && !revising ? <ButtonV2 kind="secondary" onClick={() => send('Draft')} disabled={s.busy}>Save draft</ButtonV2> : <ButtonV2 kind="tertiary" onClick={onClose}>Close</ButtonV2>}>
      <div className="rf2-drawer-form">
        {interviews.length > 1 ? (
          <SelectV2 label="Interview" value={interviewId} onChange={(e) => setInterviewId(e.target.value)}>
            {interviews.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
          </SelectV2>
        ) : null}
        {!iv ? <Note tone="warning">There is no interview on this file yet. Schedule one first.</Note> : null}
        {iv && !ended && !submitted ? <Note>The interview has not ended. You can save a draft now and submit after it ends.</Note> : null}
        <ul className="rf2-gates" aria-label="Gate to Offer"><Gate ok={gateState(file).scorecard} label="A scorecard is submitted" hint="Offer is blocked until then" /></ul>
        {cards.filter((c) => c !== mine).map((c) => <ScorecardSummary key={c.id} card={c} />)}
        {submitted && !revising ? <ScorecardSummary card={mine} own /> : null}
        {editable && iv ? (
          <>
            <fieldset className="rf2-rating" aria-describedby={errs.rating ?? s.at('overallRating') ? 'sc-rating-err' : undefined}>
              <legend className="rf2-field__label">Overall rating<span className="rf2-field__req" aria-hidden="true">*</span></legend>
              <div className="rf2-rating__options">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n} className="rf2-rating__option"><input type="radio" name="rating" value={n} checked={form.overallRating === n} onChange={() => setForm({ ...form, overallRating: n })} /> <span>{n}</span></label>
                ))}
              </div>
              {errs.rating ?? s.at('overallRating') ? <p id="sc-rating-err" className="rf2-field__msg rf2-field__msg--error" role="alert">{errs.rating ?? s.at('overallRating')}</p> : null}
            </fieldset>
            <SelectV2 label="Recommendation" value={form.recommendation} onChange={(e) => setForm({ ...form, recommendation: e.target.value as Recommendation })} error={s.at('recommendation')}>
              {RECOMMENDATIONS.map((r) => <option key={r}>{r}</option>)}
            </SelectV2>
            <TextareaV2 label="Strengths" rows={2} value={form.strengths} onChange={(e) => setForm({ ...form, strengths: e.target.value })} error={s.at('strengths')} />
            <TextareaV2 label="Concerns" rows={2} value={form.concerns} onChange={(e) => setForm({ ...form, concerns: e.target.value })} error={s.at('concerns')} />
            <TextareaV2 label="Evidence" required rows={5} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} error={errs.notes ?? s.at('notes')} />
            {revising ? <TextareaV2 label="Reason for revising" required rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} error={errs.reason ?? s.at('reason')} hint="The first version stays in the history." /> : null}
          </>
        ) : null}
        <FormError text={s.error} />
      </div>
    </DrawerV2>
  );
}
function ScorecardSummary({ card, own }: { card: ScorecardItem; own?: boolean }) {
  const st = isScorecardSubmitted(card) ? 'Submitted' : 'Draft';
  return (
    <section className="rf2-scard" aria-label={`Scorecard by ${own ? 'you' : card.interviewerName ?? 'interviewer'}`}>
      <header><strong>{own ? 'Your scorecard' : card.interviewerName ?? 'Interviewer'}</strong> <StatusChip tone={st === 'Submitted' ? 'success' : 'neutral'} label={st === 'Submitted' ? `Submitted${card.revision && card.revision > 1 ? ` · rev ${card.revision}` : ''}` : 'Draft'} /></header>
      <p>{card.overallRating} of 5 · {card.recommendation}</p>
      {card.notes ? <p className="rf2-scard__notes">{card.notes}</p> : null}
    </section>
  );
}

/* ── E17 Offer draft (NO pay) ───────────────────────────────────────────── */
function TermsFields({ terms, set, errs, at = () => undefined }: { terms: OfferTerms; set: (t: OfferTerms) => void; errs: Record<string, string>; at?: (...names: string[]) => string | undefined }) {
  return (
    <>
      <div className="rf2-drawer-form__row">
        <SelectV2 label="Contract" value={terms.contractType ?? ''} onChange={(e) => set({ ...terms, contractType: e.target.value || undefined })} placeholder="Choose" error={at('contractType')}>
          {['Full-time · 2 years', 'Full-time · 1 year', 'Full-time · open-ended', 'Part-time'].map((c) => <option key={c}>{c}</option>)}
        </SelectV2>
        <SelectV2 label="Probation" value={terms.probationPeriod ?? ''} onChange={(e) => set({ ...terms, probationPeriod: e.target.value || undefined })} placeholder="Choose" error={at('probationPeriod')}>
          {['3 months', '6 months', 'None'].map((c) => <option key={c}>{c}</option>)}
        </SelectV2>
      </div>
      <div className="rf2-drawer-form__row">
        <InputV2 label="Start date" type="date" required value={terms.proposedJoiningDate ?? ''} onChange={(e) => set({ ...terms, proposedJoiningDate: e.target.value || undefined })} error={errs.start ?? at('proposedJoiningDate')} />
        <InputV2 label="Offer valid until" type="date" value={terms.offerExpiry ?? ''} onChange={(e) => set({ ...terms, offerExpiry: e.target.value || undefined })} error={at('offerExpiry')} />
      </div>
      <InputV2 label="Work location" value={terms.workLocation ?? ''} onChange={(e) => set({ ...terms, workLocation: e.target.value || undefined })} error={at('workLocation')} />
    </>
  );
}
const PayNote = () => <p className="rf2-drawer-form__note rf2-drawer-form__note--info" data-testid="pay-note"><ShieldCheck aria-hidden="true" /> <span>Pay is not shown to you. The approving manager sets and approves pay at the offer decision.</span></p>;

/** Current version of an offer (B5 offers carry status per version). */
const currentVersion = (o: ApplicationFile['offer']) => o?.currentVersion ?? o?.versions?.[0] ?? null;
/** The Manager sent the version back (B7: Reject → version Changes Requested, offer Draft, file stays in Offer). */
export const sentBack = (o: ApplicationFile['offer']) => o?.status === 'Draft' && currentVersion(o)?.status === 'Changes Requested';

/** E17: create a Draft (no pay; CreateOfferDto has no grade/approver-note field) then POST /offers/:id/submit. From Expired or sent back: a new version, then submit. */
export function OfferDraftDrawer({ file, onClose, onDone }: DrawerProps) {
  const app = file.workspace.application;
  const prior = file.offer && (file.offer.status === 'Expired' || sentBack(file.offer)) ? file.offer : null;
  const pv = currentVersion(prior);
  const [terms, setTerms] = useState<OfferTerms>(pv ? {
    contractType: pv.contractType ?? undefined, probationPeriod: pv.probationPeriod ?? undefined, proposedJoiningDate: pv.proposedJoiningDate?.slice(0, 10) ?? undefined,
    offerExpiry: undefined, workLocation: pv.workLocation ?? undefined,
  } : { workLocation: app.vacancyLocation ?? app.vacancyBranchName ?? undefined });
  const [note, setNote] = useState('');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const s = useSubmit(onDone, ['contractType', 'probationPeriod', 'proposedJoiningDate', 'offerExpiry', 'workLocation']);
  const gate = gateState(file);
  const needsMove = app.stage === 'Interview';
  const nextVersion = prior ? (pv?.versionNumber ?? 1) + 1 : 1;
  const back = prior && sentBack(prior) ? pv?.approvals?.find((x) => x.status === 'Rejected') : undefined;
  const submit = () => {
    const next: Record<string, string> = {};
    if (!terms.proposedJoiningDate) next.start = 'Pick the start date.';
    setErrs(next);
    if (Object.keys(next).length) return;
    void s.run(async () => {
      if (needsMove) await advanceTo(app, 'Offer');
      let offerId: string;
      if (prior) { await createOfferRevision(prior.id, terms); offerId = prior.id; }
      else offerId = await createOfferDraft(app.id, terms);
      if (note.trim()) await addNote(app.id, `Note to approver: ${note.trim()}`);
      await submitOffer(offerId);
    });
  };
  return (
    <DrawerV2 open onClose={onClose} kicker={`Offer · Draft v${nextVersion}`} title={`${prior ? (sentBack(prior) ? 'Revise and resubmit' : 'New offer version') : 'Draft offer'} — ${candidateName(app)}`}
      primaryAction={<ButtonV2 onClick={submit} loading={s.busy} disabled={needsMove && !gate.scorecard}>Submit for approval</ButtonV2>}
      secondaryAction={<ButtonV2 kind="secondary" onClick={onClose}>Cancel</ButtonV2>}>
      <div className="rf2-drawer-form">
        {needsMove ? <ul className="rf2-gates" aria-label="Gate to Offer"><Gate ok={gate.scorecard} label="A scorecard is submitted" hint="submit or chase the scorecard first" /></ul> : null}
        {prior && sentBack(prior) ? <Note tone="warning">The manager sent v{pv?.versionNumber} back{back?.comment ? `: “${back.comment}”` : ''}. Change the terms and submit v{nextVersion}.</Note> : null}
        <InputV2 label="Job" readOnly value={[app.positionTitle, app.vacancyBranchName].filter(Boolean).join(' · ')} />
        <TermsFields terms={terms} set={setTerms} errs={errs} at={s.at} />
        <TextareaV2 label="Note to approver" rows={3} value={note} onChange={(e) => setNote(e.target.value)} hint="Saved as a note on the file (the offer has no approver-note field yet)." />
        <Note>Saved as a Draft, then sent to the approving manager.</Note>
        <PayNote />
        <FormError text={s.error} />
      </div>
    </DrawerV2>
  );
}

/* ── E18 Waiting on approval ────────────────────────────────────────────── */
export function WaitingDrawer({ file, onClose, onDone }: DrawerProps) {
  const app = file.workspace.application;
  const offer = file.offer;
  const v = currentVersion(offer);
  const s = useSubmit(onDone);
  const back = sentBack(offer);
  const unsentDraft = offer?.status === 'Draft' && !back;
  const chip = back ? { tone: 'danger' as const, label: 'Sent back by the manager' } : unsentDraft ? { tone: 'neutral' as const, label: 'Draft — not submitted' }
    : offer?.status === 'Approved' ? { tone: 'success' as const, label: 'Approved' } : { tone: 'warning' as const, label: 'Waiting on approver' };
  return (
    <DrawerV2 open onClose={onClose} kicker={`Offer · v${v?.versionNumber ?? 1}`} title={`${back ? 'Sent back' : unsentDraft ? 'Draft offer' : 'Waiting on approval'} — ${candidateName(app)}`}
      primaryAction={back ? <Link className="rf2-btn rf2-btn--primary rf2-btn--md" to="?drawer=offer">Revise and resubmit</Link>
        : unsentDraft && offer ? <ButtonV2 onClick={() => s.run(() => submitOffer(offer.id))} loading={s.busy}>Submit for approval</ButtonV2>
        : <ButtonV2 onClick={onClose}>Back to the file</ButtonV2>}
      secondaryAction={back || unsentDraft ? <ButtonV2 kind="secondary" onClick={onClose}>Close</ButtonV2> : undefined}>
      <div className="rf2-drawer-form">
        <p><StatusChip tone={chip.tone} label={chip.label} /> {offer?.offerCode}</p>
        <ul className="rf2-approvals" aria-label="Approvals">
          {(v?.approvals ?? []).map((a) => <li key={a.id}>{a.approverName ?? 'Offer approver'} · {a.status}{a.comment ? ` · “${a.comment}”` : ''}</li>)}
          {!v?.approvals?.length && !unsentDraft ? <li>Offer approver · Pending</li> : null}
        </ul>
        <dl className="rf2-terms">
          <dt>Start date</dt><dd>{v?.proposedJoiningDate?.slice(0, 10) ?? '—'}</dd>
          <dt>Contract</dt><dd>{v?.contractType ?? '—'}</dd>
          <dt>Probation</dt><dd>{v?.probationPeriod ?? '—'}</dd>
        </dl>
        {back ? <Note tone="warning">The manager rejected v{v?.versionNumber}. The offer is back in Draft and the file stays in Offer. Change the terms and submit again.</Note>
          : unsentDraft ? <Note>This draft has not gone to the manager yet.</Note>
          : <Note>Nothing to do until the manager decides. You'll see it on My Work when it's approved.</Note>}
        <PayNote />
        <FormError text={s.error} />
      </div>
    </DrawerV2>
  );
}

/* ── E19 Send offer ─────────────────────────────────────────────────────── */
/** E19: POST /offers/:id/send {channel, templateId}. Email → outbox; WhatsApp → filled text + wa.me link, sent by hand (already recorded as Sent; there is no "mark as sent" endpoint). */
export function SendOfferDrawer({ file, onClose, onDone }: DrawerProps) {
  const app = file.workspace.application;
  const offer = file.offer;
  const approved = offer?.status === 'Approved';
  const [channel, setChannel] = useState<SendChannel>('email');
  const [templates, setTemplates] = useState<OfferTemplate[] | null>(null);
  const [templateId, setTemplateId] = useState('');
  const [result, setResult] = useState<SendOfferResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setTemplates(null); setTemplateId('');
    offerTemplates(channel).then((t) => { if (alive) { setTemplates(t); setTemplateId(t[0]?.id ?? ''); } }).catch(() => alive && setTemplates([]));
    return () => { alive = false; };
  }, [channel]);
  const send = async () => {
    if (!offer) return;
    if (!templateId) { setError('Pick a template.'); return; }
    setBusy(true); setError(null);
    try { setResult(await sendOffer(offer.id, { channel, templateId })); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  const copy = async () => { if (result?.message) { try { await navigator.clipboard.writeText(result.message); setCopied(true); } catch { setCopied(false); } } };
  if (result) {
    return (
      <DrawerV2 open onClose={onDone} kicker={`Offer · ${offer?.offerCode ?? ''}`} title={`Offer sent — ${candidateName(app)}`}
        primaryAction={<ButtonV2 onClick={onDone}>Done</ButtonV2>}>
        <div className="rf2-drawer-form">
          {result.channel === 'email' ? (
            <>
              <p><StatusChip tone={result.queued ? 'info' : 'neutral'} label={result.queued ? 'Queued' : 'Recorded'} /> Email</p>
              <Note>{result.queued ? 'The offer email is queued in the outbox and goes to the candidate’s email address.' : 'Recorded as sent by email. No outbox is configured, so nothing was queued.'}</Note>
            </>
          ) : (
            <>
              <p><StatusChip tone="success" label="Recorded as sent" /> WhatsApp</p>
              <TextareaV2 label="Message to send" readOnly rows={7} value={result.message ?? ''} />
              <div className="rf2-drawer-form__actions">
                <ButtonV2 kind="secondary" icon={<Copy />} onClick={() => void copy()}>{copied ? 'Copied' : 'Copy text'}</ButtonV2>
                {result.waLink ? <a className="rf2-btn rf2-btn--secondary rf2-btn--md" href={result.waLink} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" /> Open WhatsApp</a> : null}
              </div>
              <Note>RecruitFlow recorded the offer as Sent by WhatsApp now (channel, template, you, time). Send the message from WhatsApp yourself; there is no separate "mark as sent" step.</Note>
            </>
          )}
        </div>
      </DrawerV2>
    );
  }
  return (
    <DrawerV2 open onClose={onClose} kicker={`Offer · ${offer?.offerCode ?? ''}`} title={`Send offer — ${candidateName(app)}`}
      primaryAction={<ButtonV2 onClick={() => void send()} loading={busy} disabled={!approved || !templateId}>Send offer</ButtonV2>}
      secondaryAction={<ButtonV2 kind="secondary" onClick={onClose}>Cancel</ButtonV2>}>
      <div className="rf2-drawer-form">
        <ul className="rf2-gates" aria-label="Before sending"><Gate ok={approved} label="The manager approved this version" hint="waiting on approval" /></ul>
        <fieldset className="rf2-choices">
          <legend className="rf2-field__label">Channel</legend>
          {([['email', 'Email', 'Goes out from RecruitFlow through the email outbox.'], ['whatsapp', 'WhatsApp', 'You get the filled message and a WhatsApp link, and send it yourself.']] as const).map(([v, l, h]) => (
            <label key={v} className="rf2-choice"><input type="radio" name="channel" value={v} checked={channel === v} onChange={() => setChannel(v)} /><span><strong>{l}</strong><span className="rf2-choice__help">{h}</span></span></label>
          ))}
        </fieldset>
        <SelectV2 label="Template" required value={templateId} onChange={(e) => setTemplateId(e.target.value)} disabled={!templates?.length}>
          {templates === null ? <option value="">Loading…</option> : templates.length === 0 ? <option value="">No active {channel === 'email' ? 'email' : 'WhatsApp'} template</option>
            : templates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.isDefault ? ' (default)' : ''}</option>)}
        </SelectV2>
        <PayNote />
        <FormError text={error} />
      </div>
    </DrawerV2>
  );
}

/* ── E20 Record answer ──────────────────────────────────────────────────── */
export function AnswerDrawer({ file, onClose, onDone }: DrawerProps) {
  const app = file.workspace.application;
  const offer = file.offer;
  const v = offer?.currentVersion ?? offer?.versions?.[0];
  const [answer, setAnswer] = useState<'Accepted' | 'Declined' | 'Expired' | 'Withdrawn' | ''>('');
  const [why, setWhy] = useState('');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const s = useSubmit(onDone, ['status', 'reason', 'note']);
  const submit = () => {
    const next: Record<string, string> = {};
    if (!answer) next.answer = 'Choose the candidate\'s answer.';
    if ((answer === 'Declined' || answer === 'Withdrawn') && !why.trim()) next.why = 'Say what the candidate told you.';
    setErrs(next);
    if (Object.keys(next).length || !offer) return;
    void s.run(async () => {
      if (answer === 'Accepted' || answer === 'Expired') { await setOfferStatus(offer.id, answer); return; }
      if (answer === 'Declined') {
        // #11 + Figma E20: the version is Declined and the API closes the file as Rejected — "Declined offer".
        await setOfferStatus(offer.id, 'Declined');
        await addNote(app.id, `Candidate declined offer v${v?.versionNumber ?? 1}: ${why.trim()}`);
        return;
      }
      // Withdrawn exits the file with a reason.
      await setOfferStatus(offer.id, 'Withdrawn');
      await moveStage(app, 'Rejected', WITHDRAWN_BY_CANDIDATE_REASON);
      await addNote(app.id, `Candidate withdrew: ${why.trim()}`);
    });
  };
  const choices = [
    { v: 'Accepted', label: 'Accepted', help: 'The file can move to Pre-hire.' },
    { v: 'Declined', label: 'Declined', help: 'The file closes as Rejected — "Declined offer".' },
    { v: 'Expired', label: 'No answer — expired', help: 'The file stays in Offer. You can draft a new version for the manager.' },
    { v: 'Withdrawn', label: 'Withdrawn', help: 'The candidate is out. The file closes as Rejected — "Withdrawn by candidate".' },
  ] as const;
  return (
    <DrawerV2 open onClose={onClose} kicker={`Offer · v${v?.versionNumber ?? 1} · Sent`} title={`Record answer — ${candidateName(app)}`}
      primaryAction={<ButtonV2 onClick={submit} loading={s.busy} disabled={offer?.status !== 'Sent'}>Record answer</ButtonV2>}
      secondaryAction={<ButtonV2 kind="secondary" onClick={onClose}>Cancel</ButtonV2>}>
      <div className="rf2-drawer-form">
        {offer?.status !== 'Sent' ? <Note tone="warning">Only a sent offer can be answered.</Note> : null}
        <fieldset className="rf2-choices" aria-describedby={errs.answer ? 'ans-err' : undefined}>
          <legend className="rf2-field__label">Candidate's answer<span className="rf2-field__req" aria-hidden="true">*</span></legend>
          {choices.map((c) => (
            <label key={c.v} className="rf2-choice"><input type="radio" name="answer" value={c.v} checked={answer === c.v} onChange={() => setAnswer(c.v)} />
              <span><strong>{c.label}</strong><span className="rf2-choice__help">{c.help}</span></span></label>
          ))}
          {errs.answer ? <p id="ans-err" className="rf2-field__msg rf2-field__msg--error" role="alert">{errs.answer}</p> : null}
        </fieldset>
        {answer === 'Declined' || answer === 'Withdrawn' ? (
          <TextareaV2 label={answer === 'Declined' ? 'Why they declined' : 'Why they withdrew'} required rows={3} value={why} onChange={(e) => setWhy(e.target.value)} error={errs.why ?? s.at('reason', 'note')} />
        ) : null}
        <PayNote />
        <FormError text={s.error} />
      </div>
    </DrawerV2>
  );
}

/* ── E21 Pre-hire checklist ─────────────────────────────────────────────── */
/** E21: gate 4 reads only the typed joining checks (GET/PUT /applications/:id/joining-checks/:type). */
export function PreHireDrawer({ file, onDone }: DrawerProps) {
  const app = file.workspace.application;
  const gate = gateState(file);
  const s = useSubmit(onDone);
  const [checks, setChecks] = useState(file.joiningChecks);
  const [busyType, setBusyType] = useState<string | null>(null);
  const [checkErr, setCheckErr] = useState<string | null>(null);
  const done = (t: string) => Boolean(checks.find((c) => c.type === t)?.verified);
  const allDone = JOINING_CHECK_TYPES.every((c) => done(c.type));
  const inOffer = app.stage === 'Offer';
  const toggle = async (type: (typeof JOINING_CHECK_TYPES)[number]['type'], verified: boolean) => {
    setBusyType(type); setCheckErr(null);
    try { setChecks(await setJoiningCheck(app.id, type, verified)); } catch (e) { setCheckErr(errorText(e)); } finally { setBusyType(null); }
  };
  return (
    <DrawerV2 open onClose={onDone} kicker="Pre-hire" title={`Pre-hire checklist — ${candidateName(app)}`}
      primaryAction={inOffer
        ? <ButtonV2 onClick={() => s.run(async () => { await advanceTo(app, 'Pre-Hire'); if (!file.hiring && file.offer) await createHiringCase(file.offer.id); })} loading={s.busy} disabled={!gate.offerAccepted}>Move to Pre-hire</ButtonV2>
        : <ButtonV2 onClick={() => s.run(() => moveStage(app, 'Joined'))} loading={s.busy} disabled={!allDone || app.stage !== 'Pre-Hire'}>Move to Joined</ButtonV2>}
      secondaryAction={<ButtonV2 kind="secondary" onClick={onDone}>Close</ButtonV2>}>
      <div className="rf2-drawer-form">
        {inOffer ? <ul className="rf2-gates" aria-label="Gate to Pre-hire"><Gate ok={gate.offerAccepted} label="The candidate accepted the offer" hint="record the answer first" /></ul> : null}
        <ul className="rf2-checklist" aria-label="Joining checks">
          {JOINING_CHECK_TYPES.map((c) => {
            const row = checks.find((x) => x.type === c.type);
            const ok = Boolean(row?.verified);
            return (
              <li key={c.type} className="rf2-checklist__item" data-done={ok}>
                <span>{ok ? <CircleCheck aria-hidden="true" /> : <Clock aria-hidden="true" />} {c.label}
                  {ok && row?.verifiedBy ? <span className="rf2-checklist__by"> · verified by {row.verifiedBy.name}{row.verifiedAt ? `, ${new Date(row.verifiedAt).toLocaleDateString('en-GB', { timeZone: TZ, day: 'numeric', month: 'short' })}` : ''}</span> : null}</span>
                {ok
                  ? <ButtonV2 kind="tertiary" size="sm" loading={busyType === c.type} onClick={() => void toggle(c.type, false)} aria-label={`Undo ${c.label} verified`}>Undo</ButtonV2>
                  : <ButtonV2 kind="secondary" size="sm" loading={busyType === c.type} onClick={() => void toggle(c.type, true)} aria-label={`Mark ${c.label} verified`}>Mark verified</ButtonV2>}
              </li>
            );
          })}
        </ul>
        <Note>All three verified = the file can move to Joined.</Note>
        <FormError text={checkErr ?? s.error} />
      </div>
    </DrawerV2>
  );
}

/* ── E22 Reject with a reason ───────────────────────────────────────────── */
export function RejectDrawer({ file, onClose, onDone }: DrawerProps) {
  const app = file.workspace.application;
  const [reasons, setReasons] = useState<string[]>(SYSTEM_REJECTION_REASONS);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [errs, setErrs] = useState<{ reason?: string; note?: string }>({});
  const s = useSubmit(onDone, ['reason', 'note']);
  useEffect(() => {
    rejectionReasons().then((list) => setReasons(Array.from(new Set([...list, ...SYSTEM_REJECTION_REASONS])))).catch(() => undefined);
  }, []);
  const other = needsReasonNote(reason);
  const submit = () => {
    const next: { reason?: string; note?: string } = {};
    if (!reason) next.reason = 'Pick a reason. Rejected needs a reason from the list.';
    // #21: "Other" needs a short note (400 REASON_REQUIRED, field "note"); it is stored as "Other: <note>".
    if (other && note.trim().length < OTHER_NOTE_MIN) next.note = 'Say why in a short note (at least 3 characters). "Other" needs it.';
    setErrs(next);
    if (next.reason || next.note) return;
    void s.run(async () => {
      if (other) { await moveStage(app, 'Rejected', reason, note); return; }
      await moveStage(app, 'Rejected', reason);
      if (note.trim()) await addNote(app.id, `Rejected (${reason}): ${note.trim()}`);
    });
  };
  const noteErr = errs.note ?? s.at('note') ?? (s.server.code === 'REASON_REQUIRED' ? s.server.message ?? undefined : undefined);
  return (
    <DrawerV2 open onClose={onClose} kicker="Reject" title={`Reject — ${candidateName(app)}`} subtitle={`${app.positionTitle ?? ''} · ${app.stage}`}
      primaryAction={<ButtonV2 kind="danger" onClick={submit} loading={s.busy}>Reject</ButtonV2>}
      secondaryAction={<ButtonV2 kind="secondary" onClick={onClose}>Cancel</ButtonV2>}>
      <div className="rf2-drawer-form">
        <SelectV2 label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Choose a reason" error={errs.reason ?? s.at('reason')}>
          {reasons.map((r) => <option key={r}>{r}</option>)}
        </SelectV2>
        <TextareaV2 label={other ? 'Note' : 'Note (optional)'} required={other} rows={3} value={note} onChange={(e) => setNote(e.target.value)} error={noteErr}
          hint={other ? 'Required for "Other". Saved with the reason as "Other: <note>".' : 'Saved as a note on the file.'} />
        <Note>The file closes. Its history stays.</Note>
        <FormError text={s.server.code === 'REASON_REQUIRED' && noteErr ? null : s.error} />
      </div>
    </DrawerV2>
  );
}

export const DRAWERS: Record<DrawerKey, (p: DrawerProps) => React.ReactElement> = {
  screen: ScreenDrawer, schedule: ScheduleDrawer, scorecard: ScorecardDrawer, offer: OfferDraftDrawer, waiting: WaitingDrawer,
  send: SendOfferDrawer, answer: AnswerDrawer, prehire: PreHireDrawer, reject: RejectDrawer,
};
