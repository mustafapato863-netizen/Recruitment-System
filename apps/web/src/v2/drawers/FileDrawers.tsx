import type React from 'react';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { CircleCheck, Clock, Info, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { ButtonV2 } from '../../components/v2/Button';
import { DrawerV2 } from '../../components/v2/Drawer';
import { InputV2, SelectV2, TextareaV2 } from '../../components/v2/Field';
import { StatusChip } from '../../components/v2/StatusChip';
import { UserPicker, interviewersAdapter, type UserOption } from '../../components/v2/UserPicker';
import {
  RECOMMENDATIONS, addNote, candidateName, checkCompliance, createHiringCase, createOfferDraft, createOfferRevision,
  gateState, logScreening, moveStage, rejectionReasons, reviseScorecard, scheduleInterview, setOfferStatus, submitScorecard,
  type ApplicationFile, type FileStage, type InterviewItem, type OfferTerms, type Recommendation, type ScorecardItem,
} from '../api/applicationFile';
import { GATE_COPY, SYSTEM_REJECTION_REASONS, WITHDRAWN_BY_CANDIDATE_REASON, gateFromError } from '../api/gates';

export type DrawerKey = 'screen' | 'schedule' | 'scorecard' | 'offer' | 'waiting' | 'send' | 'answer' | 'prehire' | 'reject';
export const DRAWER_KEYS: DrawerKey[] = ['screen', 'schedule', 'scorecard', 'offer', 'waiting', 'send', 'answer', 'prehire', 'reject'];

export interface DrawerProps { file: ApplicationFile; onClose: () => void; onDone: () => void; params?: URLSearchParams }

const TZ = 'Africa/Cairo';

/** Error copy: GATE_* / room / scorecard codes become clear inline messages; 403 is explicit. */
export function errorText(error: unknown): string {
  const d = gateFromError(error);
  if (d?.gate) return `${GATE_COPY[d.gate].message}${d.missing?.length ? ` Missing: ${d.missing.join(', ')}.` : ''} ${GATE_COPY[d.gate].fix}`;
  if (d) return d.message;
  const e = error as { statusCode?: number; message?: string } | null;
  if (e?.statusCode === 403) return 'You can\'t change this file: it belongs to another owner.';
  return e?.message || 'Something went wrong. Try again.';
}

function useSubmit(onDone: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); onDone(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  return { busy, error, run, setError };
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
  const s = useSubmit(onDone);
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
        <TextareaV2 label="Screen note" required value={notes} onChange={(e) => setNotes(e.target.value)} error={fieldErr}
          hint="What you checked and what you found, with evidence. Required to move to Interview." rows={6} />
        <InputV2 label="Notice period (days)" type="number" min={0} max={3650} inputMode="numeric" value={notice} onChange={(e) => setNotice(e.target.value)} />
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
  const s = useSubmit(onDone);
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
          <InputV2 label="Date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} error={errs.date} />
          <InputV2 label="Start (Cairo)" type="time" required value={time} onChange={(e) => setTime(e.target.value)} error={errs.time} />
          <SelectV2 label="Length" value={duration} onChange={(e) => setDuration(e.target.value)}>
            {['30', '45', '60', '90'].map((m) => <option key={m} value={m}>{m} min</option>)}
          </SelectV2>
        </div>
        <InputV2 label="Room URL" required type="url" placeholder="https://" value={room} onChange={(e) => setRoom(e.target.value)} error={errs.room}
          hint="The meeting room link. It must be on an approved meeting host." />
        <UserPicker label="Interviewers" required multiple adapter={adapter} value={people} onChange={setPeople} error={errs.people} />
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
  const submitted = mine && (mine.status ?? (mine.isLocked ? 'Submitted' : 'Draft')) === 'Submitted';
  const [form, setForm] = useState({ overallRating: mine?.overallRating ?? 0, recommendation: (mine?.recommendation ?? 'Hire') as Recommendation, strengths: mine?.strengths ?? '', concerns: mine?.concerns ?? '', notes: mine?.notes ?? '', reason: '' });
  const [revising, setRevising] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const s = useSubmit(onDone);
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
            <fieldset className="rf2-rating" aria-describedby={errs.rating ? 'sc-rating-err' : undefined}>
              <legend className="rf2-field__label">Overall rating<span className="rf2-field__req" aria-hidden="true">*</span></legend>
              <div className="rf2-rating__options">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n} className="rf2-rating__option"><input type="radio" name="rating" value={n} checked={form.overallRating === n} onChange={() => setForm({ ...form, overallRating: n })} /> <span>{n}</span></label>
                ))}
              </div>
              {errs.rating ? <p id="sc-rating-err" className="rf2-field__msg rf2-field__msg--error" role="alert">{errs.rating}</p> : null}
            </fieldset>
            <SelectV2 label="Recommendation" value={form.recommendation} onChange={(e) => setForm({ ...form, recommendation: e.target.value as Recommendation })}>
              {RECOMMENDATIONS.map((r) => <option key={r}>{r}</option>)}
            </SelectV2>
            <TextareaV2 label="Strengths" rows={2} value={form.strengths} onChange={(e) => setForm({ ...form, strengths: e.target.value })} />
            <TextareaV2 label="Concerns" rows={2} value={form.concerns} onChange={(e) => setForm({ ...form, concerns: e.target.value })} />
            <TextareaV2 label="Evidence" required rows={5} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} error={errs.notes} />
            {revising ? <TextareaV2 label="Reason for revising" required rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} error={errs.reason} hint="The first version stays in the history." /> : null}
          </>
        ) : null}
        <FormError text={s.error} />
      </div>
    </DrawerV2>
  );
}
function ScorecardSummary({ card, own }: { card: ScorecardItem; own?: boolean }) {
  const st = card.status ?? (card.isLocked ? 'Submitted' : 'Draft');
  return (
    <section className="rf2-scard" aria-label={`Scorecard by ${own ? 'you' : card.interviewerName ?? 'interviewer'}`}>
      <header><strong>{own ? 'Your scorecard' : card.interviewerName ?? 'Interviewer'}</strong> <StatusChip tone={st === 'Submitted' ? 'success' : 'neutral'} label={st === 'Submitted' ? `Submitted${card.revision && card.revision > 1 ? ` · rev ${card.revision}` : ''}` : 'Draft'} /></header>
      <p>{card.overallRating} of 5 · {card.recommendation}</p>
      {card.notes ? <p className="rf2-scard__notes">{card.notes}</p> : null}
    </section>
  );
}

/* ── E17 Offer draft (NO pay) ───────────────────────────────────────────── */
function TermsFields({ terms, set, errs }: { terms: OfferTerms; set: (t: OfferTerms) => void; errs: Record<string, string> }) {
  return (
    <>
      <div className="rf2-drawer-form__row">
        <SelectV2 label="Contract" value={terms.contractType ?? ''} onChange={(e) => set({ ...terms, contractType: e.target.value || undefined })} placeholder="Choose">
          {['Full-time · 2 years', 'Full-time · 1 year', 'Full-time · open-ended', 'Part-time'].map((c) => <option key={c}>{c}</option>)}
        </SelectV2>
        <SelectV2 label="Probation" value={terms.probationPeriod ?? ''} onChange={(e) => set({ ...terms, probationPeriod: e.target.value || undefined })} placeholder="Choose">
          {['3 months', '6 months', 'None'].map((c) => <option key={c}>{c}</option>)}
        </SelectV2>
      </div>
      <div className="rf2-drawer-form__row">
        <InputV2 label="Start date" type="date" required value={terms.proposedJoiningDate ?? ''} onChange={(e) => set({ ...terms, proposedJoiningDate: e.target.value || undefined })} error={errs.start} />
        <InputV2 label="Offer valid until" type="date" value={terms.offerExpiry ?? ''} onChange={(e) => set({ ...terms, offerExpiry: e.target.value || undefined })} />
      </div>
      <InputV2 label="Work location" value={terms.workLocation ?? ''} onChange={(e) => set({ ...terms, workLocation: e.target.value || undefined })} />
    </>
  );
}
const PayNote = () => <p className="rf2-drawer-form__note rf2-drawer-form__note--info" data-testid="pay-note"><ShieldCheck aria-hidden="true" /> <span>Pay is not shown to you. The approving manager sets and approves pay at the offer decision.</span></p>;

export function OfferDraftDrawer({ file, onClose, onDone }: DrawerProps) {
  const app = file.workspace.application;
  const [terms, setTerms] = useState<OfferTerms>({ workLocation: app.vacancyLocation ?? app.vacancyBranchName ?? undefined });
  const [note, setNote] = useState('');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const s = useSubmit(onDone);
  const gate = gateState(file);
  const needsMove = app.stage === 'Interview';
  const submit = () => {
    const next: Record<string, string> = {};
    if (!terms.proposedJoiningDate) next.start = 'Pick the start date.';
    setErrs(next);
    if (Object.keys(next).length) return;
    void s.run(async () => {
      if (needsMove) await advanceTo(app, 'Offer');
      await createOfferDraft(app.id, terms);
      if (note.trim()) await addNote(app.id, `Note to approver: ${note.trim()}`);
    });
  };
  return (
    <DrawerV2 open onClose={onClose} kicker="Offer · Draft v1" title={`Draft offer — ${candidateName(app)}`}
      primaryAction={<ButtonV2 onClick={submit} loading={s.busy} disabled={needsMove && !gate.scorecard}>Submit for approval</ButtonV2>}
      secondaryAction={<ButtonV2 kind="secondary" onClick={onClose}>Cancel</ButtonV2>}>
      <div className="rf2-drawer-form">
        {needsMove ? <ul className="rf2-gates" aria-label="Gate to Offer"><Gate ok={gate.scorecard} label="A scorecard is submitted" hint="submit or chase the scorecard first" /></ul> : null}
        <InputV2 label="Job" readOnly value={[app.positionTitle, app.vacancyBranchName].filter(Boolean).join(' · ')} />
        <TermsFields terms={terms} set={setTerms} errs={errs} />
        <TextareaV2 label="Note to approver" rows={3} value={note} onChange={(e) => setNote(e.target.value)} hint="Saved as a note on the file." />
        <PayNote />
        <FormError text={s.error} />
      </div>
    </DrawerV2>
  );
}

/* ── E18 Waiting on approval ────────────────────────────────────────────── */
export function WaitingDrawer({ file, onClose }: DrawerProps) {
  const app = file.workspace.application;
  const offer = file.offer;
  const v = offer?.currentVersion ?? offer?.versions?.[0];
  return (
    <DrawerV2 open onClose={onClose} kicker={`Offer · v${v?.versionNumber ?? 1}`} title={`Waiting on approval — ${candidateName(app)}`}
      primaryAction={<ButtonV2 onClick={onClose}>Back to the file</ButtonV2>}>
      <div className="rf2-drawer-form">
        <p><StatusChip tone="warning" label={offer?.status === 'Approved' ? 'Approved' : 'Waiting on approver'} /> {offer?.offerCode}</p>
        <ul className="rf2-approvals" aria-label="Approvals">
          {(v?.approvals ?? []).map((a) => <li key={a.id}>{a.approverName ?? 'Offer approver'} · {a.status}{a.comment ? ` · “${a.comment}”` : ''}</li>)}
          {!v?.approvals?.length ? <li>Offer approver · Pending</li> : null}
        </ul>
        <dl className="rf2-terms">
          <dt>Start date</dt><dd>{v?.proposedJoiningDate?.slice(0, 10) ?? '—'}</dd>
          <dt>Contract</dt><dd>{v?.contractType ?? '—'}</dd>
          <dt>Probation</dt><dd>{v?.probationPeriod ?? '—'}</dd>
        </dl>
        <Note>Nothing to do until the manager decides. You'll see it on My Work when it's approved.</Note>
        <PayNote />
      </div>
    </DrawerV2>
  );
}

/* ── E19 Send offer ─────────────────────────────────────────────────────── */
export function SendOfferDrawer({ file, onClose, onDone }: DrawerProps) {
  const app = file.workspace.application;
  const offer = file.offer;
  const s = useSubmit(onDone);
  const approved = offer?.status === 'Approved';
  return (
    <DrawerV2 open onClose={onClose} kicker={`Offer · ${offer?.offerCode ?? ''}`} title={`Send offer — ${candidateName(app)}`}
      primaryAction={<ButtonV2 onClick={() => offer && s.run(() => setOfferStatus(offer.id, 'Sent'))} loading={s.busy} disabled={!approved}>Mark as sent</ButtonV2>}
      secondaryAction={<ButtonV2 kind="secondary" onClick={onClose}>Cancel</ButtonV2>}>
      <div className="rf2-drawer-form">
        <ul className="rf2-gates" aria-label="Before sending"><Gate ok={approved} label="The manager approved this version" hint="waiting on approval" /></ul>
        <Note>Send the approved offer letter to the candidate, then mark it as sent here. Choosing a channel and template from RecruitFlow is not available yet.</Note>
        <PayNote />
        <FormError text={s.error} />
      </div>
    </DrawerV2>
  );
}

/* ── E20 Record answer ──────────────────────────────────────────────────── */
export function AnswerDrawer({ file, onClose, onDone }: DrawerProps) {
  const app = file.workspace.application;
  const offer = file.offer;
  const v = offer?.currentVersion ?? offer?.versions?.[0];
  const [answer, setAnswer] = useState<'Accepted' | 'Declined' | 'Withdrawn' | ''>('');
  const [why, setWhy] = useState('');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const s = useSubmit(onDone);
  const submit = () => {
    const next: Record<string, string> = {};
    if (!answer) next.answer = 'Choose the candidate\'s answer.';
    if ((answer === 'Declined' || answer === 'Withdrawn') && !why.trim()) next.why = 'Say what the candidate told you.';
    setErrs(next);
    if (Object.keys(next).length || !offer) return;
    void s.run(async () => {
      if (answer === 'Accepted') { await setOfferStatus(offer.id, 'Accepted'); return; }
      if (answer === 'Declined') {
        // v2: Declined = a new offer version; the file stays in Offer. (Not PATCH status=Declined: #11 rejects the file.)
        await createOfferRevision(offer.id, { contractType: v?.contractType ?? undefined, probationPeriod: v?.probationPeriod ?? undefined, proposedJoiningDate: v?.proposedJoiningDate?.slice(0, 10) ?? undefined, workLocation: v?.workLocation ?? undefined, workingSchedule: v?.workingSchedule ?? undefined });
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
    { v: 'Declined', label: 'Declined — wants changes', help: 'Makes a new offer version for the manager. The file stays in Offer.' },
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
          <TextareaV2 label={answer === 'Declined' ? 'What they asked for' : 'Why they withdrew'} required rows={3} value={why} onChange={(e) => setWhy(e.target.value)} error={errs.why} />
        ) : null}
        <PayNote />
        <FormError text={s.error} />
      </div>
    </DrawerV2>
  );
}

/* ── E21 Pre-hire checklist ─────────────────────────────────────────────── */
export function PreHireDrawer({ file, onClose, onDone }: DrawerProps) {
  const app = file.workspace.application;
  const gate = gateState(file);
  const s = useSubmit(onDone);
  const allDone = gate.joining.every((j) => j.done);
  const inOffer = app.stage === 'Offer';
  return (
    <DrawerV2 open onClose={onClose} kicker="Pre-hire" title={`Pre-hire checklist — ${candidateName(app)}`}
      primaryAction={inOffer
        ? <ButtonV2 onClick={() => s.run(async () => { await advanceTo(app, 'Pre-Hire'); if (!file.hiring && file.offer) await createHiringCase(file.offer.id); })} loading={s.busy} disabled={!gate.offerAccepted}>Move to Pre-hire</ButtonV2>
        : <ButtonV2 onClick={() => s.run(() => moveStage(app, 'Joined'))} loading={s.busy} disabled={!allDone || app.stage !== 'Pre-Hire'}>Move to Joined</ButtonV2>}
      secondaryAction={<ButtonV2 kind="secondary" onClick={onClose}>Close</ButtonV2>}>
      <div className="rf2-drawer-form">
        {inOffer ? <ul className="rf2-gates" aria-label="Gate to Pre-hire"><Gate ok={gate.offerAccepted} label="The candidate accepted the offer" hint="record the answer first" /></ul> : null}
        <ul className="rf2-checklist" aria-label="Joining checks">
          {gate.joining.map((j) => (
            <li key={j.key} className="rf2-checklist__item" data-done={j.done}>
              <span>{j.done ? <CircleCheck aria-hidden="true" /> : <Clock aria-hidden="true" />} {j.label}</span>
              {j.done ? <StatusChip tone="success" label="Checked" />
                : j.reqId && file.hiring ? <ButtonV2 kind="secondary" size="sm" disabled={s.busy} onClick={() => s.run(() => checkCompliance(file.hiring!.id, j.reqId!))} aria-label={`Mark ${j.label} checked`}>Mark checked</ButtonV2>
                : <span className="rf2-checklist__missing">{file.hiring ? 'Not on this hiring case' : 'Starts at Pre-hire'}</span>}
            </li>
          ))}
        </ul>
        <Note>All three checked = the file can move to Joined.</Note>
        <FormError text={s.error} />
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
  const [err, setErr] = useState<string | undefined>();
  const s = useSubmit(onDone);
  useEffect(() => {
    rejectionReasons().then((list) => setReasons(Array.from(new Set([...list, ...SYSTEM_REJECTION_REASONS])))).catch(() => undefined);
  }, []);
  const submit = () => {
    if (!reason) { setErr('Pick a reason. Rejected needs a reason from the list.'); return; }
    setErr(undefined);
    void s.run(async () => {
      await moveStage(app, 'Rejected', reason);
      if (note.trim()) await addNote(app.id, `Rejected (${reason}): ${note.trim()}`);
    });
  };
  return (
    <DrawerV2 open onClose={onClose} kicker="Reject" title={`Reject — ${candidateName(app)}`} subtitle={`${app.positionTitle ?? ''} · ${app.stage}`}
      primaryAction={<ButtonV2 kind="danger" onClick={submit} loading={s.busy}>Reject</ButtonV2>}
      secondaryAction={<ButtonV2 kind="secondary" onClick={onClose}>Cancel</ButtonV2>}>
      <div className="rf2-drawer-form">
        <SelectV2 label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Choose a reason" error={err}>
          {reasons.map((r) => <option key={r}>{r}</option>)}
        </SelectV2>
        <TextareaV2 label="Note (optional)" rows={3} value={note} onChange={(e) => setNote(e.target.value)} hint="Saved as a note on the file." />
        <Note>The file closes. Its history stays.</Note>
        <FormError text={s.error} />
      </div>
    </DrawerV2>
  );
}

export const DRAWERS: Record<DrawerKey, (p: DrawerProps) => React.ReactElement> = {
  screen: ScreenDrawer, schedule: ScheduleDrawer, scorecard: ScorecardDrawer, offer: OfferDraftDrawer, waiting: WaitingDrawer,
  send: SendOfferDrawer, answer: AnswerDrawer, prehire: PreHireDrawer, reject: RejectDrawer,
};
