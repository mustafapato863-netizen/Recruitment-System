import type React from 'react';
import { isScorecardSubmitted } from '../../utils/scorecardStatus';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, CircleCheck, ClipboardCheck, Clock, Copy, ExternalLink, FileSignature, Info, MessageSquare, ShieldCheck, TriangleAlert, Users } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { ButtonV2 } from '../../components/v2/Button';
import { DrawerV2 } from '../../components/v2/Drawer';
import { InputV2, SelectV2, TextareaV2 } from '../../components/v2/Field';
import { StatusChip } from '../../components/v2/StatusChip';
import { UserPicker, interviewersAdapter, type UserOption } from '../../components/v2/UserPicker';
import { StageFormSection } from './StageFormSection';
import { sendScorecardReminder } from '../../api/myInterviews';
import {
  RECOMMENDATIONS, addNote, candidateName, createHiringCase, createOfferDraft, createOfferRevision,
  gateState, isoDate, loadScreeningDraft, logScreening, moveStage, offerTemplates, recordActualJoining, rejectionReasons, reviseScorecard, saveScreeningDraft, scheduleInterview, sendOffer, setJoiningCheck, setOfferStatus, submitHiringCase, submitOffer, submitScorecard, updateInterview,
  type ApplicationFile, type FileStage, type InterviewItem, type OfferTemplate, type OfferTerms, type Recommendation, type ScorecardItem, type ScreeningDraftLoad, type SendChannel, type SendOfferResult,
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
  const e = error as { statusCode?: number; status?: number; message?: string } | null;
  if (e?.statusCode === 403 || e?.status === 403) {
    if (e?.message && !/^(access denied|forbidden)\.?$/i.test(e.message.trim()) && !/belongs to another owner/i.test(e.message)) {
      return e.message;
    }
    return 'You can\'t change this file: it belongs to another owner.';
  }
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
function Gate({ ok, unknown = false, label, hint }: { ok: boolean; unknown?: boolean; label: string; hint?: string }) {
  return (
    <li className="rf2-gate" data-ok={unknown ? 'unknown' : ok ? 'true' : 'false'}>
      {ok && !unknown ? <CircleCheck aria-hidden="true" /> : <Clock aria-hidden="true" />}
      <span>{label}{unknown ? <span className="rf2-gate__hint"> — could not be checked</span> : hint && !ok ? <span className="rf2-gate__hint"> — {hint}</span> : null}</span>
      <span className="rf2-visually-hidden">{unknown ? '(unknown)' : ok ? '(done)' : '(not done)'}</span>
    </li>
  );
}

type StageCursor = { id: string; stage: FileStage; version: number };

/** Moves forward one stage at a time (Applied→Screening→Interview), refreshing the version in between and updating the caller's cursor ref. */
async function advanceTo(cursorRef: { current: StageCursor }, target: FileStage) {
  const order: FileStage[] = ['Applied', 'Screening', 'Interview', 'Offer', 'Pre-Hire', 'Joined'];
  while (order.indexOf(cursorRef.current.stage) < order.indexOf(target)) {
    const next = order[order.indexOf(cursorRef.current.stage) + 1];
    const res = await moveStage(cursorRef.current, next);
    cursorRef.current = {
      id: cursorRef.current.id,
      stage: next,
      version: typeof res?.version === 'number' ? res.version : cursorRef.current.version + 1,
    };
  }
}

/* ── E14 Screen ─────────────────────────────────────────────────────────── */
const SCREEN_METHODS = ['Phone', 'Video', 'In person'] as const;
const SCREEN_NEXT_STEPS = ['Move to interview', 'Keep in screening', 'Do not proceed'] as const;
type DraftField = 'outcome' | 'notes' | 'notice' | 'method' | 'evidenceSource' | 'nextStep';

export function ScreenDrawer({ file, onClose, onDone }: DrawerProps) {
  const app = file.workspace.application;
  const [outcome, setOutcome] = useState<'Passed' | 'Failed' | 'On Hold'>('Passed');
  const [notes, setNotes] = useState('');
  const [notice, setNotice] = useState('');
  const [method, setMethod] = useState<string>('Phone');
  const [evidenceSource, setEvidenceSource] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [reasons, setReasons] = useState<string[]>(SYSTEM_REJECTION_REASONS);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectNote, setRejectNote] = useState('');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [draftRead, setDraftRead] = useState<ScreeningDraftLoad | { status: 'loading' }>({ status: 'loading' });
  const [draftAttempt, setDraftAttempt] = useState(0);
  const [partialNotice, setPartialNotice] = useState<string | null>(null);
  const dirty = useRef<Set<DraftField>>(new Set());
  const currentAppId = useRef(app.id);
  currentAppId.current = app.id;
  const cursorRef = useRef<StageCursor>({ id: app.id, stage: app.stage as FileStage, version: app.version });
  const loggedKeyRef = useRef<string | null>(null);
  const s = useSubmit(onDone, ['notes', 'noticePeriodDays', 'outcome', 'method', 'evidenceSource', 'nextStep', 'reason', 'note']);
  const canMove = ['Applied', 'Screening'].includes(cursorRef.current.stage);

  const gate = gateState(file);
  const screeningState = file.sections?.screening;
  const screeningUnknown = gate.unknown.screening;
  const draftKnown = draftRead.status === 'ready' || draftRead.status === 'empty';

  const draftFailed = !screeningUnknown && (draftRead.status === 'error' || draftRead.status === 'unavailable');
  const draftBlocked = screeningUnknown || !draftKnown;

  useEffect(() => {
    rejectionReasons().then((list) => setReasons(Array.from(new Set([...list, ...SYSTEM_REJECTION_REASONS])))).catch(() => undefined);
  }, []);

  useEffect(() => {
    dirty.current.clear();
    cursorRef.current = { id: app.id, stage: app.stage as FileStage, version: app.version };
    loggedKeyRef.current = null;
    setPartialNotice(null);
    setOutcome('Passed');
    setNotes('');
    setNotice('');
    setMethod('Phone');
    setEvidenceSource('');
    setNextStep('');
    setRejectReason('');
    setRejectNote('');
    setDraftSaved(false);
  }, [app.id, app.stage, app.version]);

  useEffect(() => {
    let cancelled = false;
    const applicationId = app.id;
    if (screeningState?.status === 'unavailable') {
      setDraftRead({ status: 'unavailable' });
      return undefined;
    }
    setDraftRead({ status: 'loading' });
    void loadScreeningDraft(applicationId).then((result) => {
      if (cancelled) return;
      setDraftRead(result);
      if (result.status !== 'ready') return;
      const draft = result.draft;
      const edited = dirty.current;
      if (!edited.has('outcome')) setOutcome(draft.outcome);
      if (!edited.has('notes')) setNotes(draft.notes ?? '');
      if (!edited.has('notice')) setNotice(draft.noticePeriodDays == null ? '' : String(draft.noticePeriodDays));
      if (!edited.has('method')) setMethod(draft.method?.trim() ? draft.method.trim() : 'Phone');
      if (!edited.has('evidenceSource')) setEvidenceSource(draft.evidenceSource ?? '');
      if (!edited.has('nextStep')) setNextStep(draft.nextStep ?? '');
    });
    return () => { cancelled = true; };
  }, [app.id, draftAttempt, screeningState?.status]);

  const willMoveToInterview = canMove && outcome === 'Passed' && (nextStep === '' || nextStep === 'Move to interview');
  const willReject = canMove && nextStep === 'Do not proceed';
  const otherReject = needsReasonNote(rejectReason);

  const saveDraft = () => {
    if (draftBlocked || draftBusy || s.busy) return;
    const applicationId = app.id;
    setDraftBusy(true);
    setDraftSaved(false);
    s.setError(null);
    void (async () => {
      try {
        await saveScreeningDraft(applicationId, {
          outcome,
          notes: notes.trim() || null,
          noticePeriodDays: notice.trim() === '' ? null : Number(notice),
          method: method.trim() || null,
          evidenceSource: evidenceSource.trim() || null,
          nextStep: nextStep.trim() || null,
          moveToInterview: outcome === 'Passed' && (nextStep === '' || nextStep === 'Move to interview'),
        });
        if (currentAppId.current === applicationId) setDraftSaved(true);
      } catch (e) {
        if (currentAppId.current === applicationId) s.setError(errorText(e));
      } finally {
        if (currentAppId.current === applicationId) setDraftBusy(false);
      }
    })();
  };
  const touch = (field: DraftField) => { dirty.current.add(field); };
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (draftBlocked || draftBusy || s.busy) return;
    const next: Record<string, string> = {};
    if (!method.trim()) next.method = 'Choose how you screened.';
    if (!evidenceSource.trim()) next.evidenceSource = 'Write the evidence source.';
    if (!nextStep.trim()) next.nextStep = 'Choose the next step.';
    else if (nextStep === 'Move to interview' && outcome !== 'Passed') next.nextStep = 'Only a Passed screen can move to Interview.';
    if (!notes.trim()) next.notes = 'Write the screen note. Interview needs a saved screen note.';
    if (nextStep === 'Do not proceed' && canMove) {
      if (!rejectReason) next.rejectReason = 'Pick a reason. Rejected needs a reason from the list.';
      if (otherReject && rejectNote.trim().length < OTHER_NOTE_MIN) next.rejectNote = 'Say why in a short note (at least 3 characters). "Other" needs it.';
    }
    setErrs(next);
    if (Object.keys(next).length) return;
    const screenKey = JSON.stringify({
      outcome,
      notes: notes.trim(),
      method: method.trim(),
      evidenceSource: evidenceSource.trim(),
      nextStep: nextStep.trim(),
      notice: notice.trim(),
    });
    const alreadyInFile = file.screening.some((row) =>
      row.outcome === outcome
      && (row.notes ?? '').trim() === notes.trim()
      && (row.method ?? '').trim() === method.trim()
      && (row.evidenceSource ?? '').trim() === evidenceSource.trim()
      && (row.nextStep ?? '').trim() === nextStep.trim()
    );
    void s.run(async () => {
      if (loggedKeyRef.current !== screenKey && !alreadyInFile) {
        await logScreening({
          applicationId: app.id,
          outcome,
          notes: notes.trim(),
          method: method.trim(),
          evidenceSource: evidenceSource.trim(),
          nextStep: nextStep.trim(),
          ...(notice ? { noticePeriodDays: Number(notice) } : {}),
        });
        loggedKeyRef.current = screenKey;
      } else {
        loggedKeyRef.current = screenKey;
      }
      if (nextStep === 'Move to interview' && canMove && outcome === 'Passed') {
        try {
          await advanceTo(cursorRef, 'Interview');
        } catch (err) {
          setPartialNotice('Screening note saved, but moving to Interview did not finish. Retry to complete the stage move without logging a duplicate screen.');
          throw err;
        }
      } else if (nextStep === 'Do not proceed' && canMove) {
        try {
          await moveStage(cursorRef.current, 'Rejected', rejectReason, otherReject ? rejectNote.trim() : undefined);
          cursorRef.current = { ...cursorRef.current, stage: 'Rejected', version: cursorRef.current.version + 1 };
        } catch (err) {
          setPartialNotice('Screening note saved, but closing the file as Rejected did not finish. Retry to complete the rejection without logging a duplicate screen.');
          throw err;
        }
      }
    });
  };
  const primaryLabel = willReject ? 'Save and reject' : willMoveToInterview ? 'Save and move to Interview' : 'Save screen';
  return (
    <DrawerV2 open onClose={onClose} kicker="Screen" title={`Log screen — ${candidateName(app)}`} subtitle={`${app.positionTitle ?? ''} · ${cursorRef.current.stage}`}
      confirmClose={() => !notes.trim() || window.confirm('Discard the screen note?')}
      primaryAction={<ButtonV2 kind={willReject ? 'danger' : 'primary'} onClick={() => submit()} loading={s.busy} disabled={draftBusy || draftBlocked}>{primaryLabel}</ButtonV2>}
      secondaryAction={<ButtonV2 kind="secondary" onClick={onClose}>Cancel</ButtonV2>}>
      <form className="rf2-drawer-form rf2-stage-form" onSubmit={submit} noValidate>
        {screeningUnknown ? (
          screeningState?.status === 'loading' ? <Note>Loading screening. Saving stays off until this read finishes.</Note>
          : screeningState?.status === 'unavailable' ? <Note tone="warning">Screening is not available for this role. Saving is turned off so a failed read is not replaced.</Note>
          : <Note tone="warning">Screening could not be checked. Saving is turned off so a failed read is not replaced.</Note>
        ) : null}
        {!screeningUnknown && draftRead.status === 'loading' ? <Note>Loading screening draft. Saving stays off until this read finishes.</Note> : null}
        {!screeningUnknown && draftRead.status === 'unavailable' ? <Note tone="warning">The screening draft is not available for this role. Saving is turned off so a failed read is not replaced.</Note> : null}
        {!screeningUnknown && draftRead.status === 'error' ? (
          <Note tone="warning">
            {draftRead.failure === 'not-found' ? 'The screening draft could not be found for this file.' : draftRead.failure === 'transient' ? 'The screening draft could not be loaded. Try again.' : draftRead.message}
            {' '}Saving stays off until this read succeeds.
          </Note>
        ) : null}
        {draftFailed ? <ButtonV2 kind="secondary" onClick={() => { setDraftRead({ status: 'loading' }); setDraftAttempt((n) => n + 1); }}>Retry screening draft</ButtonV2> : null}
        {partialNotice ? <Note tone="warning">{partialNotice}</Note> : null}
        <StageFormSection title="Screening outcome" icon={ClipboardCheck}>
          <SelectV2 label="Outcome" value={outcome} onChange={(e) => { touch('outcome'); setOutcome(e.target.value as typeof outcome); }} error={s.at('outcome')}>
            <option value="Passed">Pass</option><option value="On Hold">On hold</option><option value="Failed">Fail</option>
          </SelectV2>
          <SelectV2 label="Method" required value={method} onChange={(e) => { touch('method'); setMethod(e.target.value); }} error={errs.method ?? s.at('method')}>
            {SCREEN_METHODS.map((item) => <option key={item} value={item}>{item}</option>)}
          </SelectV2>
          <InputV2 label="Evidence source" required placeholder="Screening call" maxLength={500} value={evidenceSource} onChange={(e) => { touch('evidenceSource'); setEvidenceSource(e.target.value); }} error={errs.evidenceSource ?? s.at('evidenceSource')} />
          <SelectV2 label="Next step" required placeholder="Choose next step" value={nextStep} onChange={(e) => { touch('nextStep'); setNextStep(e.target.value); }} error={errs.nextStep ?? s.at('nextStep')}>
            {SCREEN_NEXT_STEPS.map((item) => <option key={item} value={item}>{item}</option>)}
          </SelectV2>
          {willReject ? (
            <>
              <SelectV2 label="Rejection reason" required value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Choose a reason" error={errs.rejectReason ?? s.at('reason')}>
                {reasons.map((r) => <option key={r} value={r}>{r}</option>)}
              </SelectV2>
              {otherReject ? (
                <TextareaV2 label="Rejection note" required rows={2} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} error={errs.rejectNote ?? s.at('note')}
                  hint='Required for "Other". Saved with the reason as "Other: <note>".' />
              ) : null}
            </>
          ) : null}
        </StageFormSection>
        <StageFormSection title="Evidence & availability" icon={MessageSquare} tone="success">
          <TextareaV2 label="Screen note" required value={notes} onChange={(e) => { touch('notes'); setNotes(e.target.value); }} error={errs.notes ?? s.at('notes')}
            hint="What you checked and what you found, with evidence. Required to move to Interview." rows={6} />
          <InputV2 label="Notice period (days)" type="number" min={0} max={3650} inputMode="numeric" value={notice} onChange={(e) => { touch('notice'); setNotice(e.target.value); }} error={s.at('noticePeriodDays')} />
        </StageFormSection>
        <ButtonV2 kind="secondary" onClick={saveDraft} loading={draftBusy} disabled={s.busy || draftBlocked}>Save draft</ButtonV2>
        {draftSaved ? <Note>Draft saved. It stays private to you on this application.</Note> : null}
        <Note>
          Need to record expected salary and compare against the vacancy range?{' '}
          <Link className="rf2-link" to={`/applications/${encodeURIComponent(app.id)}/screening`}>Open full screening page</Link>.
        </Note>
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

export function ScheduleDrawer({ file, onClose, onDone, params }: DrawerProps) {
  const app = file.workspace.application;
  const openInterview = file.interviews.find((i) => i.id === params?.get('interview') && (i.status === 'Scheduled' || i.status === 'Rescheduled'));
  const preHireContext = !openInterview && (params?.get('context') === 'prehire' || app.stage === 'Pre-Hire');
  const [type, setType] = useState(preHireContext ? 'Assessment' : 'Technical');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [duration, setDuration] = useState('60');
  const [room, setRoom] = useState(openInterview?.locationUrl ?? '');
  const [reason, setReason] = useState('');
  const [people, setPeople] = useState<UserOption[]>([]);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [partialNotice, setPartialNotice] = useState<string | null>(null);
  const cursorRef = useRef<StageCursor>({ id: app.id, stage: app.stage as FileStage, version: app.version });
  const adapter = useMemo(() => interviewersAdapter(), []);
  const interviewerIds = [...new Set(people.map((person) => person.id))];
  const s = useSubmit(onDone, ['scheduledStart', 'scheduledEnd', 'locationUrl', 'attendeeUserIds', 'interviewType', 'title', 'rescheduleReason']);
  const gate = gateState(file);
  const needsMove = ['Applied', 'Screening'].includes(cursorRef.current.stage);
  const submit = () => {
    const next: Record<string, string> = {};
    if (!date) next.date = 'Pick a date.';
    if (!/^\d{2}:\d{2}$/.test(time)) next.time = 'Pick a start time.';
    if (room.trim()) {
      try { if (new URL(room.trim()).protocol !== 'https:') next.room = 'The room link must start with https://'; } catch { next.room = 'Paste a valid meeting room URL (https://…).'; }
    }
    if (openInterview) {
      if (reason.trim().length < 3) next.reason = 'Say why this time changed.';
    } else {
      if (!interviewerIds.length) next.people = 'Add at least one interviewer.';
    }
    setErrs(next);
    if (Object.keys(next).length) return;
    if (!openInterview && ((needsMove && (gate.unknown.screening || !gate.screenNote)) || gate.unknown.interviews)) return;
    const start = cairoIso(date, time);
    const end = new Date(new Date(start).getTime() + Number(duration) * 60_000).toISOString();
    void s.run(async () => {
      if (openInterview) {
        await updateInterview(openInterview.id, { scheduledStart: start, scheduledEnd: end, rescheduleReason: reason.trim(), ...(room.trim() ? { locationUrl: room.trim() } : {}) });
        return;
      }
      if (['Applied', 'Screening'].includes(cursorRef.current.stage)) {
        await advanceTo(cursorRef, 'Interview');
      }
      try {
        await scheduleInterview({
          applicationId: app.id,
          title: `${type} interview: ${candidateName(app)}`,
          interviewType: type,
          ...(preHireContext || type === 'Assessment' ? { stageContext: 'Pre-Hire' as const } : {}),
          scheduledStart: start,
          scheduledEnd: end,
          timezone: TZ,
          ...(room.trim() ? { locationUrl: room.trim() } : {}),
          attendeeUserIds: interviewerIds,
        });
      } catch (err) {
        if (cursorRef.current.stage !== app.stage) {
          setPartialNotice(`File moved to ${cursorRef.current.stage}, but scheduling the interview did not finish. Fix any error and retry to schedule without moving the stage again.`);
        }
        throw err;
      }
    });
  };
  const markNoShow = () => {
    if (!openInterview) return;
    void s.run(() => updateInterview(openInterview.id, { status: 'No-show' }));
  };
  const cancelInterview = () => {
    if (!openInterview) return;
    void s.run(() => updateInterview(openInterview.id, {
      status: 'Cancelled',
      ...(reason.trim() ? { cancellationReason: reason.trim() } : {}),
    } as Parameters<typeof updateInterview>[1]));
  };
  return (
    <DrawerV2 open onClose={onClose} kicker={preHireContext ? 'Pre-hire assessment' : 'Interview'} title={`${openInterview ? 'Reschedule interview' : preHireContext ? 'Schedule assessment interview' : 'Schedule interview'} — ${candidateName(app)}`} subtitle={app.positionTitle}
      primaryAction={<ButtonV2 onClick={submit} loading={s.busy} disabled={!openInterview && ((needsMove && (gate.unknown.screening || !gate.screenNote)) || gate.unknown.interviews)}>{openInterview ? 'Reschedule' : 'Schedule interview'}</ButtonV2>}
      secondaryAction={<ButtonV2 kind="secondary" onClick={onClose}>Cancel</ButtonV2>}>
      <div className="rf2-drawer-form rf2-stage-form">
        {partialNotice ? <Note tone="warning">{partialNotice}</Note> : null}
        {needsMove ? (
          <ul className="rf2-gates" aria-label="Gate to Interview">
            <Gate ok={gate.screenNote} unknown={gate.unknown.screening} label="Screen note saved" hint="log the screen first" />
          </ul>
        ) : null}
        <StageFormSection title="Time & location" icon={CalendarClock}>
          {openInterview ? null : (
            <SelectV2 label="Interview type" value={type} onChange={(e) => setType(e.target.value)}>
              {['Screening', 'Technical', 'Behavioral', 'Managerial', 'Assessment'].map((t) => <option key={t}>{t}</option>)}
            </SelectV2>
          )}
          <div className="rf2-drawer-form__row">
            <InputV2 label="Date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} error={errs.date ?? s.at('scheduledStart')} />
            <InputV2 label="Start (Cairo)" type="time" required value={time} onChange={(e) => setTime(e.target.value)} error={errs.time ?? s.at('scheduledEnd')} />
            <SelectV2 label="Length" value={duration} onChange={(e) => setDuration(e.target.value)}>
              {['30', '45', '60', '90'].map((m) => <option key={m} value={m}>{m} min</option>)}
            </SelectV2>
          </div>
          <InputV2 label="Room URL (optional)" type="url" placeholder="https:// (optional)" value={room} onChange={(e) => setRoom(e.target.value)} error={errs.room ?? s.at('locationUrl')}
            hint="Optional meeting link. When provided, it must be on an approved meeting host." />
        </StageFormSection>
        {openInterview ? (
          <StageFormSection title="Schedule changes" icon={Clock} tone="warning">
              <TextareaV2 label="Why this time changed" required rows={2} value={reason} onChange={(e) => setReason(e.target.value)} error={errs.reason ?? s.at('rescheduleReason')} />
              <ButtonV2 kind="tertiary" onClick={markNoShow} loading={s.busy}>Mark no-show</ButtonV2>
              <ButtonV2 kind="tertiary" onClick={cancelInterview} loading={s.busy}>Cancel interview</ButtonV2>
          </StageFormSection>
        ) : (
          <StageFormSection title="Interview panel" icon={Users} tone="success">
              <UserPicker label="Interviewers" required={interviewerIds.length === 0} multiple adapter={adapter} value={people} onChange={setPeople} error={errs.people ?? s.at('attendeeUserIds')} />
          </StageFormSection>
        )}
        <FormError text={s.error} />
      </div>
    </DrawerV2>
  );
}

/* ── E16 Scorecard ──────────────────────────────────────────────────────── */
export function ScorecardDrawer({ file, onClose, onDone, params }: DrawerProps) {
  const app = file.workspace.application;
  const { user } = useAuth();
  const gate = gateState(file);
  const interviews = file.interviews.filter((i) => i.status !== 'Cancelled' && i.status !== 'No-show');
  const scoreUnknown = gate.unknown.interviews || gate.unknown.scorecards;
  const [interviewId, setInterviewId] = useState(params?.get('interview') ?? interviews[interviews.length - 1]?.id ?? '');
  const iv: InterviewItem | undefined = interviews.find((i) => i.id === interviewId);
  const cards = file.scorecards[interviewId] ?? [];
  const mine = cards.filter((c) => c.interviewerId === user?.id).sort((a, b) => (b.revision ?? 1) - (a.revision ?? 1))[0];
  const submitted = isScorecardSubmitted(mine);
  const panelIds = panelInterviewerIds(iv);
  const isPanelMember = Boolean(mine) || panelIds.includes(user?.id ?? '');
  const submittedByUser = new Set(cards.filter(isScorecardSubmitted).map((c) => c.interviewerId));
  const pendingPanel = (iv?.attendees ?? []).filter((a) => a.userId && !submittedByUser.has(a.userId));
  const [form, setForm] = useState({ overallRating: mine?.overallRating ?? 0, recommendation: (mine?.recommendation ?? 'Hire') as Recommendation, strengths: mine?.strengths ?? '', concerns: mine?.concerns ?? '', notes: mine?.notes ?? '', reason: '' });
  const [revising, setRevising] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderNote, setReminderNote] = useState<string | null>(null);
  const s = useSubmit(onDone, ['overallRating', 'recommendation', 'strengths', 'concerns', 'notes', 'reason']);
  const started = iv ? iv.status === 'Completed' || new Date(iv.scheduledStart).getTime() <= Date.now() : false;
  const editable = isPanelMember && (!submitted || revising);

  const send = (status: 'Draft' | 'Submitted') => {
    const next: Record<string, string> = {};
    if (status === 'Submitted' && (form.overallRating < 1 || form.overallRating > 5)) next.rating = 'Choose a rating from 1 to 5.';
    if (!form.notes.trim()) next.notes = 'Write the evidence behind your rating.';
    if (revising && form.reason.trim().length < 3) next.reason = 'Say why you are revising (at least 3 characters).';
    setErrs(next);
    if (Object.keys(next).length || scoreUnknown || !isPanelMember) return;
    const body = { overallRating: form.overallRating || 1, recommendation: form.recommendation, notes: form.notes.trim(), ...(form.strengths.trim() ? { strengths: form.strengths.trim() } : {}), ...(form.concerns.trim() ? { concerns: form.concerns.trim() } : {}) };
    void s.run(() => (revising ? reviseScorecard(interviewId, { ...body, reason: form.reason.trim() }) : submitScorecard(interviewId, { ...body, status })));
  };

  const remind = async () => {
    if (!interviewId || reminderBusy || scoreUnknown) return;
    setReminderBusy(true);
    setReminderNote(null);
    s.setError(null);
    try {
      await sendScorecardReminder(interviewId);
      setReminderNote('Scorecard reminder sent to pending interviewers.');
    } catch (e) {
      s.setError(errorText(e));
    } finally {
      setReminderBusy(false);
    }
  };

  return (
    <DrawerV2 open onClose={onClose} kicker="Scorecard" title={`Scorecard — ${candidateName(app)}`} subtitle={iv ? `${iv.title} · ${new Date(iv.scheduledStart).toLocaleDateString('en-GB', { timeZone: TZ, day: 'numeric', month: 'short' })}` : 'No interview yet'}
      primaryAction={scoreUnknown ? <ButtonV2 disabled>Scorecard unavailable</ButtonV2> : editable && iv ? <ButtonV2 onClick={() => send('Submitted')} loading={s.busy} disabled={!started && !revising}>{revising ? 'Submit revision' : 'Submit scorecard'}</ButtonV2>
        : !isPanelMember && iv && pendingPanel.length > 0 ? <ButtonV2 onClick={() => void remind()} loading={reminderBusy}>Remind pending interviewers</ButtonV2>
        : submitted && isPanelMember ? <ButtonV2 kind="secondary" onClick={() => setRevising(true)}>Revise with a reason</ButtonV2> : undefined}
      secondaryAction={scoreUnknown ? <ButtonV2 kind="tertiary" onClick={onClose}>Close</ButtonV2> : editable && iv && !revising ? <ButtonV2 kind="secondary" onClick={() => send('Draft')} disabled={s.busy}>Save draft</ButtonV2> : <ButtonV2 kind="tertiary" onClick={onClose}>Close</ButtonV2>}>
      <div className="rf2-drawer-form rf2-stage-form">
        {interviews.length > 1 ? (
          <SelectV2 label="Interview" value={interviewId} onChange={(e) => setInterviewId(e.target.value)}>
            {interviews.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
          </SelectV2>
        ) : null}
        {scoreUnknown ? <Note tone="warning">Interviews or scorecards could not be checked. Submitting is turned off so a failed read is not treated as a missing scorecard.</Note> : null}
        {!scoreUnknown && !iv ? <Note tone="warning">There is no interview on this file yet. Schedule one first.</Note> : null}
        {!scoreUnknown && iv && isPanelMember && !started && !submitted ? <Note>The interview has not started yet. You can save a draft now and submit once it starts.</Note> : null}
        {!scoreUnknown && iv && !isPanelMember ? (
          <>
            <Note>Only assigned interviewers on this panel can submit a scorecard. Only assigned interviewers on this panel can submit or revise a scorecard. As the file owner, you can review submitted scorecards and remind pending interviewers.</Note>
            <ul className="rf2-approvals" aria-label="Panel progress">
              {(iv.attendees ?? []).map((att, idx) => {
                const name = att.displayName ?? att.name ?? 'Interviewer';
                const done = Boolean(att.userId && submittedByUser.has(att.userId));
                return (
                  <li key={att.userId ?? idx}>
                    {name} · {done ? 'Scorecard submitted' : 'Pending scorecard'}
                  </li>
                );
              })}
            </ul>
            {reminderNote ? <p role="status" className="rf2-drawer-form__note rf2-drawer-form__note--info">{reminderNote}</p> : null}
          </>
        ) : null}
        <ul className="rf2-gates" aria-label="Gate to Offer"><Gate ok={gate.scorecard} unknown={gate.unknown.scorecards || gate.unknown.interviews} label="A scorecard is submitted" hint="Offer is blocked until then" /></ul>
        {iv ? (
          <p className="rf2-file__muted">
            <Link className="rf2-link" to={`/interviews/${encodeURIComponent(iv.id)}/scorecard`}>Open full SGH evaluation form</Link>
          </p>
        ) : null}
        {cards.filter((c) => c !== mine).map((c) => <ScorecardSummary key={c.id} card={c} />)}
        {submitted && !revising ? <ScorecardSummary card={mine} own /> : null}
        {editable && iv ? (
          <>
            <StageFormSection title="Rating & recommendation" icon={ClipboardCheck} tone="warning">
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
            </StageFormSection>
            <StageFormSection title="Interview evidence" icon={MessageSquare}>
              <TextareaV2 label="Strengths" rows={2} value={form.strengths} onChange={(e) => setForm({ ...form, strengths: e.target.value })} error={s.at('strengths')} />
              <TextareaV2 label="Concerns" rows={2} value={form.concerns} onChange={(e) => setForm({ ...form, concerns: e.target.value })} error={s.at('concerns')} />
              <TextareaV2 label="Evidence" required rows={5} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} error={errs.notes ?? s.at('notes')} />
              {revising ? <TextareaV2 label="Reason for revising" required rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} error={errs.reason ?? s.at('reason')} hint="The first version stays in the history." /> : null}
            </StageFormSection>
          </>
        ) : null}
        <FormError text={s.error} />
      </div>
    </DrawerV2>
  );
}
function panelInterviewerIds(interview: InterviewItem | undefined): string[] {
  if (!interview) return [];
  const listed = interview as InterviewItem & { interviewerIds?: string[] };
  const fromAttendees = (interview.attendees ?? []).flatMap((attendee) => (attendee.userId ? [attendee.userId] : []));
  const fromIds = (listed.interviewerIds ?? []).filter((id) => Boolean(id));
  return [...new Set([...fromAttendees, ...fromIds])];
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

function drawerSearch(params: URLSearchParams | undefined, drawer: DrawerKey): string {
  const next = new URLSearchParams(params);
  next.set('drawer', drawer);
  next.delete('interview');
  return `?${next.toString()}`;
}

function existingOfferAction(status: string, params?: URLSearchParams): { to: string; label: string } {
  if (status === 'Approved') return { to: drawerSearch(params, 'send'), label: 'Send offer' };
  if (status === 'Sent') return { to: drawerSearch(params, 'answer'), label: 'Record candidate answer' };
  if (status === 'Withdrawn') return { to: drawerSearch(params, 'answer'), label: 'Finish withdrawal' };
  if (status === 'Accepted') return { to: drawerSearch(params, 'prehire'), label: 'Move to Pre-hire' };
  return { to: drawerSearch(params, 'waiting'), label: 'View approval' };
}

function existingOfferChip(status: string): { tone: 'success' | 'warning' | 'info' | 'neutral'; label: string } {
  if (status === 'Pending Approval') return { tone: 'warning', label: 'Pending approval' };
  if (status === 'Approved') return { tone: 'success', label: 'Approved — ready to send' };
  if (status === 'Sent') return { tone: 'info', label: 'Sent — waiting on candidate' };
  if (status === 'Withdrawn') return { tone: 'warning', label: 'Withdrawn — finish closing file' };
  if (status === 'Accepted') return { tone: 'success', label: 'Accepted' };
  return { tone: 'neutral', label: 'Draft' };
}

/** An offer that already exists. Opening ?drawer=offer must not start a second v1 or invent a scorecard gate. */
function ExistingOfferView({ file, offer, onClose, params }: { file: ApplicationFile; offer: NonNullable<ApplicationFile['offer']>; onClose: () => void; params?: URLSearchParams }) {
  const app = file.workspace.application;
  const version = currentVersion(offer);
  const chip = existingOfferChip(offer.status);
  const action = existingOfferAction(offer.status, params);
  return (
    <DrawerV2 open onClose={onClose} kicker={`Offer · v${version?.versionNumber ?? 1}`} title={`Draft offer — ${candidateName(app)}`}
      primaryAction={<Link className="rf2-btn rf2-btn--primary rf2-btn--md" to={action.to}>{action.label}</Link>}
      secondaryAction={<ButtonV2 kind="secondary" onClick={onClose}>Close</ButtonV2>}>
      <div className="rf2-drawer-form">
        <p><StatusChip tone={chip.tone} label={chip.label} /> {offer.offerCode}</p>
        <ul className="rf2-approvals" aria-label="Approvals">
          {(version?.approvals ?? []).map((approval) => <li key={approval.id}>{approval.approverName ?? 'Offer approver'} · {approval.status}{approval.comment ? ` · “${approval.comment}”` : ''}</li>)}
          {!version?.approvals?.length ? <li>Offer approver · Pending</li> : null}
        </ul>
        <dl className="rf2-terms">
          <dt>Start date</dt><dd>{version?.proposedJoiningDate?.slice(0, 10) ?? '—'}</dd>
          <dt>Contract</dt><dd>{version?.contractType ?? '—'}</dd>
          <dt>Probation</dt><dd>{version?.probationPeriod ?? '—'}</dd>
          <dt>Work location</dt><dd>{version?.workLocation ?? '—'}</dd>
        </dl>
        <PayNote />
      </div>
    </DrawerV2>
  );
}

/** E17: create a Draft (no pay; CreateOfferDto has no grade/approver-note field) then POST /offers/:id/submit. From Expired or sent back: a new version, then submit. */
export function OfferDraftDrawer({ file, onClose, onDone, params }: DrawerProps) {
  const activeOffer = file.offer && !sentBack(file.offer) && file.offer.status !== 'Expired' ? file.offer : null;
  if (activeOffer) return <ExistingOfferView file={file} offer={activeOffer} onClose={onClose} params={params} />;
  return <OfferDraftForm file={file} onClose={onClose} onDone={onDone} params={params} />;
}

function OfferDraftForm({ file, onClose, onDone }: DrawerProps) {
  const app = file.workspace.application;
  const prior = file.offer && (file.offer.status === 'Expired' || sentBack(file.offer)) ? file.offer : null;
  const pv = currentVersion(prior);
  const [terms, setTerms] = useState<OfferTerms>(pv ? {
    contractType: pv.contractType ?? undefined, probationPeriod: pv.probationPeriod ?? undefined, proposedJoiningDate: pv.proposedJoiningDate?.slice(0, 10) ?? undefined,
    offerExpiry: undefined, workLocation: pv.workLocation ?? undefined,
  } : { workLocation: app.vacancyLocation ?? app.vacancyBranchName ?? undefined });
  const [note, setNote] = useState('');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [partialNotice, setPartialNotice] = useState<string | null>(null);
  const cursorRef = useRef<StageCursor>({ id: app.id, stage: app.stage as FileStage, version: app.version });
  const savedOfferRef = useRef<{ key: string; offerId: string } | null>(null);
  const savedNoteRef = useRef<string | null>(null);
  const s = useSubmit(onDone, ['contractType', 'probationPeriod', 'proposedJoiningDate', 'offerExpiry', 'workLocation']);
  const gate = gateState(file);
  const needsMove = cursorRef.current.stage === 'Interview';
  const nextVersion = prior ? (pv?.versionNumber ?? 1) + 1 : 1;
  const back = prior && sentBack(prior) ? pv?.approvals?.find((x) => x.status === 'Rejected') : undefined;
  const submit = () => {
    const next: Record<string, string> = {};
    if (!terms.proposedJoiningDate) next.start = 'Pick the start date.';
    setErrs(next);
    if (Object.keys(next).length || gate.unknown.offer || (needsMove && (gate.unknown.scorecards || !gate.scorecard))) return;
    const termsKey = JSON.stringify({ priorId: prior?.id ?? null, terms });
    const noteKey = note.trim();
    void s.run(async () => {
      if (cursorRef.current.stage === 'Interview') await advanceTo(cursorRef, 'Offer');
      if (savedOfferRef.current?.key !== termsKey) {
        let offerId: string;
        if (prior) {
          await createOfferRevision(prior.id, terms);
          offerId = prior.id;
        } else {
          offerId = await createOfferDraft(app.id, terms);
        }
        savedOfferRef.current = { key: termsKey, offerId };
      }
      const offerId = savedOfferRef.current.offerId;
      if (noteKey && savedNoteRef.current !== noteKey) {
        try {
          await addNote(app.id, `Note to approver: ${noteKey}`);
          savedNoteRef.current = noteKey;
        } catch (err) {
          setPartialNotice('Offer draft saved, but saving the approver note did not finish. Retry to complete submission without creating a duplicate offer version.');
          throw err;
        }
      }
      try {
        await submitOffer(offerId);
      } catch (err) {
        setPartialNotice('Offer draft saved, but submitting for approval did not finish. Retry to submit the saved draft without creating a duplicate offer version.');
        throw err;
      }
    });
  };
  return (
    <DrawerV2 open onClose={onClose} kicker={`Offer · Draft v${nextVersion}`} title={`${prior ? (sentBack(prior) ? 'Revise and resubmit' : 'New offer version') : 'Draft offer'} — ${candidateName(app)}`}
      primaryAction={<ButtonV2 onClick={submit} loading={s.busy} disabled={gate.unknown.offer || (needsMove && (gate.unknown.scorecards || !gate.scorecard))}>Submit for approval</ButtonV2>}
      secondaryAction={<ButtonV2 kind="secondary" onClick={onClose}>Cancel</ButtonV2>}>
      <div className="rf2-drawer-form rf2-stage-form">
        {partialNotice ? <Note tone="warning">{partialNotice}</Note> : null}
        {gate.unknown.offer ? <Note tone="warning">The offer could not be checked. A new draft stays unavailable so this failure is not treated as a missing offer.</Note> : null}
        {needsMove ? <ul className="rf2-gates" aria-label="Gate to Offer"><Gate ok={gate.scorecard} unknown={gate.unknown.scorecards} label="A scorecard is submitted" hint="submit or chase the scorecard first" /></ul> : null}
        {prior && sentBack(prior) ? <Note tone="warning">The manager sent v{pv?.versionNumber} back{back?.comment ? `: “${back.comment}”` : ''}. Change the terms and submit v{nextVersion}.</Note> : null}
        <StageFormSection title="Offer terms" icon={FileSignature}>
          <InputV2 label="Job" readOnly value={[app.positionTitle, app.vacancyBranchName].filter(Boolean).join(' · ')} />
          <TermsFields terms={terms} set={setTerms} errs={errs} at={s.at} />
        </StageFormSection>
        <StageFormSection title="Approval note" icon={MessageSquare} tone="success">
          <TextareaV2 label="Note to approver" rows={3} value={note} onChange={(e) => setNote(e.target.value)} hint="Saved as a note on the application file." />
        </StageFormSection>
        <Note>Saved as a Draft, then sent to the approving manager.</Note>
        <PayNote />
        <FormError text={s.error} />
      </div>
    </DrawerV2>
  );
}

/* ── E18 Waiting on approval ────────────────────────────────────────────── */
export function WaitingDrawer({ file, onClose, onDone, params }: DrawerProps) {
  const app = file.workspace.application;
  const offer = file.offer;
  const v = currentVersion(offer);
  const s = useSubmit(onDone);
  const back = sentBack(offer);
  const unsentDraft = offer?.status === 'Draft' && !back;
  const sent = offer?.status === 'Sent';
  const chip = back ? { tone: 'danger' as const, label: 'Sent back by the manager' } : unsentDraft ? { tone: 'neutral' as const, label: 'Draft — not submitted' }
    : sent ? { tone: 'info' as const, label: 'Sent — waiting on candidate' }
    : offer?.status === 'Approved' ? { tone: 'success' as const, label: 'Approved' } : { tone: 'warning' as const, label: 'Waiting on approver' };
  return (
    <DrawerV2 open onClose={onClose} kicker={`Offer · v${v?.versionNumber ?? 1}`} title={`${back ? 'Sent back' : unsentDraft ? 'Draft offer' : 'Waiting on approval'} — ${candidateName(app)}`}
      primaryAction={back ? <Link className="rf2-btn rf2-btn--primary rf2-btn--md" to={drawerSearch(params, 'offer')}>Revise and resubmit</Link>
        : unsentDraft && offer ? <ButtonV2 onClick={() => s.run(() => submitOffer(offer.id))} loading={s.busy}>Submit for approval</ButtonV2>
        : sent ? <Link className="rf2-btn rf2-btn--primary rf2-btn--md" to={drawerSearch(params, 'answer')}>Record candidate answer</Link>
        : <ButtonV2 onClick={onClose}>Back to the file</ButtonV2>}
      secondaryAction={back || unsentDraft || sent ? <ButtonV2 kind="secondary" onClick={onClose}>Close</ButtonV2> : undefined}>
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
          : sent ? <Note>The offer is with the candidate. Record their answer when it arrives.</Note>
          : <Note>Nothing to do until the manager decides. You'll see it on My Work when it's approved.</Note>}
        <PayNote />
        <FormError text={s.error} />
      </div>
    </DrawerV2>
  );
}

/* ── E19 Send offer ─────────────────────────────────────────────────────── */
/** E19: POST /offers/:id/send {channel, templateId}. Email → outbox; WhatsApp → prepare first, send manually, then confirm Sent. */
export function SendOfferDrawer({ file, onClose, onDone }: DrawerProps) {
  const app = file.workspace.application;
  const offer = file.offer;
  const approved = offer?.status === 'Approved';
  const savedJoiningDate = (currentVersion(offer)?.proposedJoiningDate ?? '').slice(0, 10);
  const channel: SendChannel = 'whatsapp';
  const [templates, setTemplates] = useState<OfferTemplate[] | null>(null);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [templateReload, setTemplateReload] = useState(0);
  const [templateId, setTemplateId] = useState('');
  const [expectedJoiningDate, setExpectedJoiningDate] = useState(savedJoiningDate);
  const [result, setResult] = useState<SendOfferResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setExpectedJoiningDate((currentVersion(offer)?.proposedJoiningDate ?? '').slice(0, 10));
  }, [offer]);
  useEffect(() => {
    let alive = true;
    setTemplates(null);
    setTemplatesError(null);
    setTemplateId('');
    offerTemplates(channel)
      .then((t) => {
        if (alive) {
          setTemplates(t);
          setTemplateId(t[0]?.id ?? '');
        }
      })
      .catch((e: unknown) => {
        if (alive) {
          const status = (e as { statusCode?: number; status?: number } | null)?.statusCode ?? (e as { status?: number } | null)?.status;
          setTemplatesError(
            status === 403
              ? 'Offer templates are not available for this role.'
              : errorText(e) || 'Offer templates could not be loaded. Try again.',
          );
        }
      });
    return () => { alive = false; };
  }, [channel, templateReload]);
  const send = async (prepareOnly = false) => {
    if (!offer) return;
    if (!templateId) { setError('Pick a template.'); return; }
    if (!expectedJoiningDate.trim()) { setError('Pick the expected joining date before sending the offer.'); return; }
    setBusy(true); setError(null);
    try {
      const dateChanged = expectedJoiningDate.trim() !== savedJoiningDate;
      const res = await sendOffer(offer.id, {
        channel,
        templateId,
        ...(prepareOnly ? { prepareOnly: true } : {}),
        ...(dateChanged ? { proposedJoiningDate: isoDate(expectedJoiningDate.trim()) } : {}),
      });
      setResult(prepareOnly ? { ...res, prepared: true, status: 'Approved' } : { ...res, prepared: false });
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  const copy = async () => { if (result?.message) { try { await navigator.clipboard.writeText(result.message); setCopied(true); } catch { setCopied(false); } } };
  if (result) {
    const isPreparedOnly = result.prepared === true || result.status === 'Approved';
    return (
      <DrawerV2 open onClose={isPreparedOnly ? onClose : onDone} kicker={`Offer · ${offer?.offerCode ?? ''}`} title={`${isPreparedOnly ? 'WhatsApp offer prepared' : 'Offer sent'} — ${candidateName(app)}`}
        primaryAction={isPreparedOnly ? <ButtonV2 onClick={() => void send(false)} loading={busy}>Confirm sent on WhatsApp</ButtonV2> : <ButtonV2 onClick={onDone}>Done</ButtonV2>}
        secondaryAction={isPreparedOnly ? <ButtonV2 kind="secondary" onClick={onClose}>Cancel</ButtonV2> : result.channel === 'email' ? <ButtonV2 kind="secondary" onClick={() => setResult(null)}>Send or retry again</ButtonV2> : undefined}>
        <div className="rf2-drawer-form">
          {result.channel === 'email' ? (
            <>
              <p><StatusChip tone={result.queued ? 'info' : 'warning'} label={result.queued ? 'Queued in outbox — delivery pending' : 'Recorded only — not queued'} /> Email</p>
              <Note tone={result.queued ? 'info' : 'warning'}>{result.queued ? 'The offer email is queued in the outbox (delivery pending). Queuing does not confirm external mailbox delivery; check outbox status or retry if delivery fails.' : 'Recorded as Sent on the file only. No email outbox is configured, so no external email was queued or delivered.'}</Note>
            </>
          ) : isPreparedOnly ? (
            <>
              <p><StatusChip tone="warning" label="Prepared — not yet sent" /> WhatsApp</p>
              <TextareaV2 label="Message to send" readOnly rows={7} value={result.message ?? ''} />
              <div className="rf2-drawer-form__actions">
                <ButtonV2 kind="secondary" icon={<Copy />} onClick={() => void copy()}>{copied ? 'Copied' : 'Copy text'}</ButtonV2>
                {result.waLink ? <a className="rf2-btn rf2-btn--secondary rf2-btn--md" href={result.waLink} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" /> Open WhatsApp</a> : null}
              </div>
              <Note>This WhatsApp message is prepared and has not yet been recorded as Sent. Copy or open WhatsApp to send it, then click Confirm sent on WhatsApp.</Note>
            </>
          ) : (
            <>
              <p><StatusChip tone="success" label="Recorded as sent" /> WhatsApp</p>
              <TextareaV2 label="Message to send" readOnly rows={7} value={result.message ?? ''} />
              <div className="rf2-drawer-form__actions">
                <ButtonV2 kind="secondary" icon={<Copy />} onClick={() => void copy()}>{copied ? 'Copied' : 'Copy text'}</ButtonV2>
                {result.waLink ? <a className="rf2-btn rf2-btn--secondary rf2-btn--md" href={result.waLink} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" /> Open WhatsApp</a> : null}
              </div>
              <Note>RecruitFlow recorded the offer as Sent by WhatsApp after your confirmation.</Note>
            </>
          )}
          <FormError text={error} />
        </div>
      </DrawerV2>
    );
  }
  return (
    <DrawerV2 open onClose={onClose} kicker={`Offer · ${offer?.offerCode ?? ''}`} title={`Send offer — ${candidateName(app)}`}
      primaryAction={<ButtonV2 onClick={() => void send(true)} loading={busy} disabled={!approved || !templateId || Boolean(templatesError)}>Prepare WhatsApp offer</ButtonV2>}
      secondaryAction={<ButtonV2 kind="secondary" onClick={onClose}>Cancel</ButtonV2>}>
      <div className="rf2-drawer-form">
        <ul className="rf2-gates" aria-label="Before sending"><Gate ok={approved} label="The manager approved this version" hint="waiting on approval" /></ul>
        <SelectV2 label="Template" required value={templateId} onChange={(e) => setTemplateId(e.target.value)} disabled={Boolean(templatesError) || !templates?.length}>
          {templatesError ? <option value="">Templates unavailable</option> : templates === null ? <option value="">Loading…</option> : templates.length === 0 ? <option value="">No active WhatsApp template</option>
            : templates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.isDefault ? ' (default)' : ''}</option>)}
        </SelectV2>
        <InputV2
          label="Expected joining date"
          type="date"
          required
          value={expectedJoiningDate}
          onChange={(e) => setExpectedJoiningDate(e.target.value)}
          hint="Required before sending the contract. Used for expected joiners forecast."
        />
        {templatesError ? (
          <div className="rf2-drawer-form__error" role="alert" data-testid="templates-error">
            <span>{templatesError}</span>{' '}
            <ButtonV2 kind="secondary" size="sm" onClick={() => setTemplateReload((n) => n + 1)}>Retry templates</ButtonV2>
          </div>
        ) : null}
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
  const partialWithdrawn = offer?.status === 'Withdrawn' && app.stage !== 'Rejected';
  const [answer, setAnswer] = useState<'Accepted' | 'Declined' | 'Expired' | 'Withdrawn' | ''>(partialWithdrawn ? 'Withdrawn' : '');
  const [why, setWhy] = useState('');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [partialNotice, setPartialNotice] = useState<string | null>(
    partialWithdrawn ? 'Offer status is already recorded as Withdrawn. Submit to finish closing this file as Rejected.' : null,
  );
  const cursorRef = useRef<StageCursor>({ id: app.id, stage: app.stage as FileStage, version: app.version });
  const statusSavedRef = useRef<string | null>(partialWithdrawn ? 'Withdrawn' : null);
  const stageMovedRef = useRef<boolean>(false);
  const s = useSubmit(onDone, ['status', 'reason', 'note']);
  const submit = () => {
    const next: Record<string, string> = {};
    if (!answer) next.answer = 'Choose the candidate\'s answer.';
    if ((answer === 'Declined' || answer === 'Withdrawn') && !why.trim() && !partialWithdrawn) next.why = 'Say what the candidate told you.';
    setErrs(next);
    if (Object.keys(next).length || !offer) return;
    void s.run(async () => {
      if (answer === 'Accepted' || answer === 'Expired') { await setOfferStatus(offer.id, answer); return; }
      if (answer === 'Declined') {
        // #11 + Figma E20 + R06: PATCH /offers/:id/status { status: 'Declined', reason } atomically updates the offer,
        // closes the file as Rejected ("Declined offer"), and records the decline note inside one backend transaction.
        if (statusSavedRef.current !== 'Declined') {
          await setOfferStatus(offer.id, 'Declined', why.trim());
          statusSavedRef.current = 'Declined';
        }
        return;
      }
      // Withdrawn records the offer status + note in the offer status transaction, then closes the file with a reason.
      if (statusSavedRef.current !== 'Withdrawn') {
        await setOfferStatus(offer.id, 'Withdrawn', why.trim());
        statusSavedRef.current = 'Withdrawn';
      }
      if (!stageMovedRef.current && cursorRef.current.stage !== 'Rejected') {
        try {
          await moveStage(cursorRef.current, 'Rejected', WITHDRAWN_BY_CANDIDATE_REASON);
          stageMovedRef.current = true;
          cursorRef.current = { ...cursorRef.current, stage: 'Rejected', version: cursorRef.current.version + 1 };
        } catch (err) {
          setPartialNotice('Offer status recorded as Withdrawn, but closing the file as Rejected did not finish. Retry to complete closing the file.');
          throw err;
        }
      }
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
      primaryAction={<ButtonV2 onClick={submit} loading={s.busy} disabled={offer?.status !== 'Sent' && !statusSavedRef.current}>Record answer</ButtonV2>}
      secondaryAction={<ButtonV2 kind="secondary" onClick={onClose}>Cancel</ButtonV2>}>
      <div className="rf2-drawer-form rf2-stage-form">
        {partialNotice ? <Note tone="warning">{partialNotice}</Note> : null}
        {offer?.status !== 'Sent' && !statusSavedRef.current ? <Note tone="warning">Only a sent offer can be answered.</Note> : null}
        <StageFormSection title="Candidate response" icon={MessageSquare} tone="success">
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
        </StageFormSection>
        <PayNote />
        <FormError text={s.error} />
      </div>
    </DrawerV2>
  );
}

/* ── E21 Pre-hire checklist ─────────────────────────────────────────────── */
/** E21: the checklist is the job's required checks. Final approval and actual joining are separate. */
export function PreHireDrawer({ file, onDone }: DrawerProps) {
  const { user } = useAuth();
  const app = file.workspace.application;
  const gate = gateState(file);
  const s = useSubmit(onDone);
  const [checks, setChecks] = useState(file.joiningChecks);
  const [expiry, setExpiry] = useState<Record<string, string>>({});
  const [docPick, setDocPick] = useState<Record<string, string>>({});
  const [actualJoiningDate, setActualJoiningDate] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: TZ }));
  const [busyType, setBusyType] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [checkErr, setCheckErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [partialNotice, setPartialNotice] = useState<string | null>(null);
  const cursorRef = useRef<StageCursor>({ id: app.id, stage: app.stage as FileStage, version: app.version });
  const caseIdRef = useRef<string | null>(file.hiring?.id ?? null);
  const checksKnown = !gate.unknown.joining;
  const offerKnown = !gate.unknown.offer;
  const hiringKnown = !gate.unknown.hiring;
  const allDone = checksKnown && checks.length > 0 && checks.every((c) => c.verified);
  const inOffer = cursorRef.current.stage === 'Offer';
  const status = file.hiring?.status ?? '';
  const canRecord = Boolean(user?.permissions?.includes('RECORD_ACTUAL_JOINING'));
  const waitingApproval = status === 'Pending Final Approval';
  const awaiting = status === 'Awaiting Joining';
  const joined = cursorRef.current.stage === 'Joined' || status === 'Joined';
  const toggle = async (type: (typeof checks)[number]['type'], verified: boolean, expiryDate?: string, documentId?: string) => {
    setBusyType(type); setCheckErr(null);
    try {
      setChecks(await setJoiningCheck(app.id, type, {
        verified,
        ...(expiryDate ? { expiryDate: isoDate(expiryDate) } : {}),
        ...(verified && documentId ? { documentId } : {}),
      }));
    } catch (e) { setCheckErr(errorText(e)); } finally { setBusyType(null); }
  };
  const record = async () => {
    const hiringId = caseIdRef.current ?? file.hiring?.id;
    if (!hiringId) return;
    if (!actualJoiningDate) {
      setCheckErr('Pick the actual joining date.');
      return;
    }
    setRecording(true); setCheckErr(null); setNotice(null);
    try {
      const result = await recordActualJoining(hiringId, isoDate(actualJoiningDate) ?? `${actualJoiningDate}T00:00:00.000Z`);
      if (result.alreadyJoined) {
        setNotice('This hire was already recorded. The completed-hire count did not change.');
        return;
      }
      onDone();
    } catch (e) { setCheckErr(errorText(e)); } finally { setRecording(false); }
  };
  const primary = inOffer
    ? <ButtonV2 onClick={() => {
        if (!offerKnown || !gate.offerAccepted) return;
        void s.run(async () => {
          if (cursorRef.current.stage === 'Offer') await advanceTo(cursorRef, 'Pre-Hire');
          if (!caseIdRef.current && file.offer) {
            try {
              const created = await createHiringCase(file.offer.id);
              if (created?.id) caseIdRef.current = created.id;
            } catch (err) {
              setPartialNotice('File moved to Pre-hire, but opening the hiring case did not finish. Retry to open the hiring case without moving the stage again.');
              throw err;
            }
          }
        });
      }} loading={s.busy} disabled={!offerKnown || !gate.offerAccepted}>Move to Pre-hire</ButtonV2>
    : waitingApproval
      ? <ButtonV2 disabled>Waiting for final approval</ButtonV2>
      : awaiting && canRecord
        ? <ButtonV2 onClick={() => { if (!hiringKnown || !checksKnown) return; void record(); }} loading={recording} disabled={!allDone || !hiringKnown}>Record actual joining</ButtonV2>
        : awaiting
          ? <ButtonV2 disabled>Waiting for the responsible recruiter</ButtonV2>
          : joined
            ? <ButtonV2 disabled>Joined</ButtonV2>
            : <ButtonV2 onClick={() => { if (!checksKnown || !hiringKnown || !offerKnown) return; void s.run(async () => {
                if (!caseIdRef.current) {
                  if (!file.offer) throw new Error('An accepted offer is required before final approval.');
                  caseIdRef.current = (await createHiringCase(file.offer.id)).id;
                }
                try {
                  await submitHiringCase(caseIdRef.current);
                } catch (err) {
                  setPartialNotice('Hiring case is open, but submitting for final approval did not finish. Retry to submit without creating a duplicate hiring case.');
                  throw err;
                }
              }); }} loading={s.busy} disabled={!allDone || cursorRef.current.stage !== 'Pre-Hire' || !hiringKnown || !offerKnown}>Submit for final approval</ButtonV2>;
  return (
    <DrawerV2 open onClose={onDone} kicker="Pre-hire" title={`Pre-hire checklist — ${candidateName(app)}`}
      primaryAction={primary}
      secondaryAction={<ButtonV2 kind="secondary" onClick={onDone}>Close</ButtonV2>}>
      <div className="rf2-drawer-form rf2-stage-form">
        {partialNotice ? <Note tone="warning">{partialNotice}</Note> : null}
        {inOffer ? <ul className="rf2-gates" aria-label="Gate to Pre-hire"><Gate ok={gate.offerAccepted} unknown={gate.unknown.offer} label="The candidate accepted the offer" hint="record the answer first" /></ul> : null}
        {!checksKnown ? <Note tone="warning">Joining checks could not be checked. Verification and final approval stay off so a failed read is not treated as a job with no checks.</Note> : null}
        {!hiringKnown ? <Note tone="warning">Hiring could not be checked. A new hiring case is not opened from this view.</Note> : null}
        {waitingApproval ? <Note>Submitted for final hiring approval. Waiting on the final hiring approver before the responsible recruiter can record actual joining.</Note> : null}
        {awaiting ? <Note>{canRecord ? 'Final hiring approval is complete. Record actual joining once the candidate starts.' : 'Final hiring approval is complete. Waiting on the responsible recruiter to record actual joining.'}</Note> : null}
        {awaiting && canRecord ? (
          <StageFormSection title="Actual joining" icon={CalendarClock} tone="success"><InputV2 label="Actual joining date" type="date" required value={actualJoiningDate} onChange={(e) => setActualJoiningDate(e.target.value)} /></StageFormSection>
        ) : null}
        <StageFormSection title="Pre-hire assessment interview" icon={CalendarClock}>
          {(() => {
            const assessments = file.interviews.filter(
              (i) => (i.stageContext === 'Pre-Hire' || i.interviewType === 'Assessment') && i.status !== 'Cancelled' && i.status !== 'No-show',
            );
            if (assessments.length === 0) {
              return (
                <p className="rf2-file__muted">
                  No pre-hire assessment interview scheduled.{' '}
                  <Link className="rf2-link" to={drawerSearch(undefined, 'schedule') + '&context=prehire'}>Schedule assessment interview</Link>
                </p>
              );
            }
            return (
              <ul className="rf2-approvals" aria-label="Pre-hire assessment interviews">
                {assessments.map((iv) => {
                  const cards = (file.scorecards[iv.id] ?? []).filter(isScorecardSubmitted);
                  const expected = iv.attendees?.length ?? 0;
                  const done = expected > 0 ? cards.length >= expected : cards.length > 0;
                  return (
                    <li key={iv.id}>
                      <strong>{iv.title}</strong> · {done ? 'Evaluation complete' : `${cards.length}/${expected || 1} scorecards submitted`}{' '}
                      <Link className="rf2-link" to={`/interviews/${encodeURIComponent(iv.id)}/scorecard`}>Open SGH form</Link>
                    </li>
                  );
                })}
              </ul>
            );
          })()}
        </StageFormSection>
        <StageFormSection title="Joining checks" icon={ShieldCheck}>
          <ul className="rf2-checklist" aria-label="Joining checks">
            {checks.map((row) => {
              const ok = Boolean(row.verified);
              const needsExpiry = row.type === 'SCFHS_LICENCE' && !ok;
              const linkedDoc = row.documentId ? file.documents.find((d) => d.id === row.documentId) : undefined;
              return (
                <li key={row.type} className="rf2-checklist__item" data-done={ok}>
                  <span>{ok ? <CircleCheck aria-hidden="true" /> : <Clock aria-hidden="true" />} {row.label}
                    {ok && row.verifiedBy ? <span className="rf2-checklist__by"> · verified by {row.verifiedBy.name}{row.verifiedAt ? `, ${new Date(row.verifiedAt).toLocaleDateString('en-GB', { timeZone: TZ, day: 'numeric', month: 'short' })}` : ''}</span> : null}
                    {ok && row.expiryDate ? <span className="rf2-checklist__by"> · expires {new Date(row.expiryDate).toLocaleDateString('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' })}</span> : null}
                    {ok && row.documentId ? <span className="rf2-checklist__by"> · evidence: {linkedDoc ? linkedDoc.name : row.documentId}</span> : null}</span>
                  {!ok && file.documents.length > 0 ? (
                    <SelectV2 label={`Evidence document (${row.label})`} value={docPick[row.type] ?? ''} onChange={(e) => setDocPick((prev) => ({ ...prev, [row.type]: e.target.value }))}>
                      <option value="">None selected</option>
                      {file.documents.map((doc) => <option key={doc.id} value={doc.id}>{doc.name} ({doc.type})</option>)}
                    </SelectV2>
                  ) : null}
                  {needsExpiry ? <InputV2 label={`${row.label} expiry`} type="date" value={expiry[row.type] ?? ''} onChange={(e) => setExpiry((prev) => ({ ...prev, [row.type]: e.target.value }))} /> : null}
                  {ok
                    ? <ButtonV2 kind="tertiary" size="sm" loading={busyType === row.type} onClick={() => void toggle(row.type, false)} aria-label={`Undo ${row.label} verified`}>Undo</ButtonV2>
                    : <ButtonV2 kind="secondary" size="sm" loading={busyType === row.type} disabled={needsExpiry && !expiry[row.type]} onClick={() => void toggle(row.type, true, expiry[row.type], docPick[row.type])} aria-label={`Mark ${row.label} verified`}>Mark verified</ButtonV2>}
                </li>
              );
            })}
          </ul>
        </StageFormSection>
        {checksKnown && checks.length === 0 ? <Note tone="warning">This job has no required checks on the file yet.</Note> : null}
        <Note>Verified checks are recorded on the file. They are not joining. The responsible recruiter records joining once, after final approval.</Note>
        {notice ? <p className="rf2-drawer-form__note" role="status">{notice}</p> : null}
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
  const [partialNotice, setPartialNotice] = useState<string | null>(null);
  const cursorRef = useRef<StageCursor>({ id: app.id, stage: app.stage as FileStage, version: app.version });
  const rejectedRef = useRef<boolean>(false);
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
      if (other) { await moveStage(cursorRef.current, 'Rejected', reason, note); return; }
      if (!rejectedRef.current) {
        await moveStage(cursorRef.current, 'Rejected', reason);
        rejectedRef.current = true;
      }
      if (note.trim()) {
        try {
          await addNote(app.id, `Rejected (${reason}): ${note.trim()}`);
        } catch (err) {
          setPartialNotice('File closed as Rejected, but saving the rejection note did not finish. Retry to save the note without rejecting again.');
          throw err;
        }
      }
    });
  };
  const noteErr = errs.note ?? s.at('note') ?? (s.server.code === 'REASON_REQUIRED' ? s.server.message ?? undefined : undefined);
  return (
    <DrawerV2 open onClose={onClose} kicker="Reject" title={`Reject — ${candidateName(app)}`} subtitle={`${app.positionTitle ?? ''} · ${app.stage}`}
      primaryAction={<ButtonV2 kind="danger" onClick={submit} loading={s.busy}>Reject</ButtonV2>}
      secondaryAction={<ButtonV2 kind="secondary" onClick={onClose}>Cancel</ButtonV2>}>
      <div className="rf2-drawer-form rf2-stage-form">
        {partialNotice ? <Note tone="warning">{partialNotice}</Note> : null}
        <StageFormSection title="Rejection details" icon={TriangleAlert} tone="danger">
          <SelectV2 label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Choose a reason" error={errs.reason ?? s.at('reason')}>
            {reasons.map((r) => <option key={r} value={r}>{r}</option>)}
          </SelectV2>
          <TextareaV2 label={other ? 'Note' : 'Note (optional)'} required={other} rows={3} value={note} onChange={(e) => setNote(e.target.value)} error={noteErr}
            hint={other ? 'Required for "Other". Saved with the reason as "Other: <note>".' : 'Saved as a note on the file.'} />
        </StageFormSection>
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
