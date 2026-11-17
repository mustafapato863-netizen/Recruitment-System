import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { ApiError } from '../api/client';
import { scorecardState } from '../utils/scorecardStatus';
import {
  RECOMMENDATIONS,
  downloadCv,
  downloadErrorMessage,
  downloadIcs,
  getMyScorecards,
  listMyInterviews,
  respond,
  reviseScorecard,
  submitScorecard,
  type ListResult,
  type MyInterview,
  type MyScorecard,
  type SubmitScorecardBody,
} from '../api/myInterviews';

type Load =
  | { kind: 'loading' }
  | {
      kind: 'ready';
      result: ListResult;
      pending: MyInterview[];
      done: MyInterview[];
      pastError: string | null;
    }
  | { kind: 'error'; message: string; forbidden: boolean };

const when = (iso?: string | null, tz?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: tz || undefined,
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
};

/** B2V-1: an ended, not-cancelled/no-show interview still needs my scorecard while it is missing or a draft. */
export const needsMyScorecard = (i: MyInterview) =>
  i.status !== 'Cancelled' && i.status !== 'No-show' && i.scorecardStatus !== 'submitted';

export const isTerminalInterview = (i: MyInterview) =>
  i.status === 'Completed' || i.status === 'Cancelled' || i.status === 'No-show';

export const isFutureInterview = (i: MyInterview) =>
  i.status !== 'Completed' &&
  Boolean(i.scheduledStart && new Date(i.scheduledStart).getTime() > Date.now());

const RSVP_LABEL: Record<
  string,
  { label: string; variant: 'success' | 'danger' | 'warning' | 'neutral' }
> = {
  Confirmed: { label: 'Accepted', variant: 'success' },
  Accepted: { label: 'Accepted', variant: 'success' },
  Declined: { label: 'Declined', variant: 'danger' },
  'Reschedule Requested': { label: 'Reschedule requested', variant: 'warning' },
  Pending: { label: 'Not answered', variant: 'neutral' },
};

/** QA BUG-4: the interviewer's own interviews. State-aware RSVP, CV, draft/final/revised scorecard, .ics. */
export function MyInterviewsPage({
  load = listMyInterviews,
}: { load?: typeof listMyInterviews } = {}) {
  const [state, setState] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [scorecardFor, setScorecardFor] = useState<MyInterview | null>(null);
  // B2F-3: My Work's "Open interview" / "Submit scorecard" deep-link here (?interview=<id>[&scorecard=1]).
  const [params] = useSearchParams();
  const focusId = params.get('interview');
  const openScorecard = params.get('scorecard') === '1';
  const deepLinkKey = focusId ? `${focusId}:${openScorecard ? '1' : '0'}` : null;
  const handledDeepLinkRef = useRef<string | null>(null);

  useEffect(() => {
    if (!deepLinkKey || !focusId || state.kind !== 'ready' || !state.result.available) return;
    if (handledDeepLinkRef.current === deepLinkKey) return;
    const hit = [...state.pending, ...state.done, ...state.result.items].find(
      (i) => i.id === focusId,
    );
    if (!hit) return;
    handledDeepLinkRef.current = deepLinkKey;
    if (openScorecard && hit.status !== 'Cancelled' && hit.status !== 'No-show') {
      setScorecardFor(hit);
    } else {
      setScorecardFor(null);
      document.getElementById(`my-interview-${hit.id}`)?.scrollIntoView?.({ block: 'center' });
    }
  }, [deepLinkKey, focusId, openScorecard, state]);

  useEffect(() => {
    let alive = true;
    setState({ kind: 'loading' });
    // B2V-1: ended interviews whose scorecard is still missing or a draft come from scope=past.
    // Surface a clear partial-load warning + retry if scope=past fails while upcoming succeeds.
    Promise.all([
      load('upcoming'),
      load('past').then(
        (past) => ({ past, pastError: null as string | null }),
        (err: unknown) => ({
          past: { available: false } as ListResult,
          pastError:
            err instanceof Error ? err.message : 'Could not load ended interviews.',
        }),
      ),
    ])
      .then(([result, { past, pastError }]) => {
        if (!alive) return;
        const ended = past.available
          ? past.items.filter(
              (i) => !(result.available && result.items.some((u) => u.id === i.id)),
            )
          : [];
        setState({
          kind: 'ready',
          result,
          pending: ended.filter(needsMyScorecard),
          done: ended.filter(
            (i) =>
              i.status !== 'Cancelled' &&
              i.status !== 'No-show' &&
              i.scorecardStatus === 'submitted',
          ),
          pastError,
        });
      })
      .catch((e: unknown) =>
        alive &&
        setState({
          kind: 'error',
          message: e instanceof Error ? e.message : 'Could not load your interviews.',
          forbidden: e instanceof ApiError && e.statusCode === 403,
        }),
      );
    return () => {
      alive = false;
    };
  }, [load, attempt]);

  const patch = useCallback((id: string, change: Partial<MyInterview>) => {
    setState((s) => {
      if (s.kind !== 'ready' || !s.result.available) return s;
      const updatedUpcoming = s.result.items.map((i) =>
        i.id === id ? { ...i, ...change } : i,
      );
      const endedMap = new Map<string, MyInterview>();
      for (const item of [...s.pending, ...s.done]) {
        endedMap.set(item.id, item.id === id ? { ...item, ...change } : item);
      }
      const ended = Array.from(endedMap.values());
      return {
        kind: 'ready',
        result: { available: true, items: updatedUpcoming },
        pending: ended.filter(needsMyScorecard),
        done: ended.filter(
          (i) =>
            i.status !== 'Cancelled' &&
            i.status !== 'No-show' &&
            i.scorecardStatus === 'submitted',
        ),
        pastError: s.pastError,
      };
    });
    setScorecardFor((cur) => (cur && cur.id === id ? { ...cur, ...change } : cur));
  }, []);

  return (
    <PageFrame eyebrow="Interviewer" title="My interviews">
      {state.kind === 'loading' ? (
        <PageState kind="loading" title="Loading your interviews" />
      ) : null}
      {state.kind === 'error' ? (
        state.forbidden ? (
          <PageState
            kind="forbidden"
            title="You do not have access to interviews"
            description={state.message}
          />
        ) : (
          <PageState
            kind="error"
            title="Could not load your interviews"
            description={state.message}
            actionLabel="Try again"
            onAction={() => setAttempt((n) => n + 1)}
          />
        )
      ) : null}
      {state.kind === 'ready' && !state.result.available ? (
        <PageState
          kind="unavailable"
          title="Not available yet"
          description="The list of your interviews is coming soon. Links in your interview invitations still work."
        />
      ) : null}
      {state.kind === 'ready' && state.result.available && state.pastError ? (
        <div
          role="alert"
          className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"
        >
          <span>
            Ended interviews needing your scorecard could not be loaded ({state.pastError}).
          </span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Retry ended interviews
          </Button>
        </div>
      ) : null}
      {state.kind === 'ready' && state.result.available && state.pending.length > 0 ? (
        <section aria-labelledby="mi-due-h" className="space-y-2">
          <h2 id="mi-due-h" className="text-sm font-semibold">
            Scorecard due — ended interviews
          </h2>
          <ul className="space-y-3" aria-label="Ended interviews needing my scorecard">
            {state.pending.map((item) => (
              <InterviewCard
                key={item.id}
                item={item}
                focused={item.id === focusId}
                onPatch={patch}
                onScorecard={() => setScorecardFor(item)}
              />
            ))}
          </ul>
        </section>
      ) : null}
      {state.kind === 'ready' &&
      state.result.available &&
      state.result.items.length === 0 &&
      state.pending.length === 0 &&
      state.done.length === 0 ? (
        <PageState
          kind="empty"
          title="No upcoming interviews"
          description="Interviews you are invited to will appear here."
        />
      ) : null}
      {state.kind === 'ready' && state.result.available && state.result.items.length > 0 ? (
        <ul className="space-y-3" aria-label="My interviews">
          {state.result.items.map((item) => (
            <InterviewCard
              key={item.id}
              item={item}
              focused={item.id === focusId}
              onPatch={patch}
              onScorecard={() => setScorecardFor(item)}
            />
          ))}
        </ul>
      ) : null}
      {state.kind === 'ready' && state.result.available && state.done.length > 0 ? (
        <section aria-labelledby="mi-done-h" className="space-y-2">
          <h2 id="mi-done-h" className="text-sm font-semibold">
            Submitted scorecards — ended interviews
          </h2>
          <ul className="space-y-3" aria-label="Ended interviews with my submitted scorecard">
            {state.done.map((item) => (
              <InterviewCard
                key={item.id}
                item={item}
                focused={item.id === focusId}
                onPatch={patch}
                onScorecard={() => setScorecardFor(item)}
              />
            ))}
          </ul>
        </section>
      ) : null}
      {scorecardFor ? (
        <ScorecardModal
          interview={scorecardFor}
          onClose={() => setScorecardFor(null)}
          onDraftSaved={() => patch(scorecardFor.id, { scorecardStatus: 'draft' })}
          onSubmitted={() => patch(scorecardFor.id, { scorecardStatus: 'submitted' })}
        />
      ) : null}
    </PageFrame>
  );
}

function InterviewCard({
  item,
  focused = false,
  onPatch,
  onScorecard,
}: {
  item: MyInterview;
  focused?: boolean;
  onPatch: (id: string, c: Partial<MyInterview>) => void;
  onScorecard: () => void;
}) {
  const [busy, setBusy] = useState<
    null | 'cv' | 'ics' | 'Confirmed' | 'Declined' | 'Reschedule Requested'
  >(null);
  const [notice, setNotice] = useState<{ tone: 'error' | 'ok'; text: string } | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleReason, setRescheduleReason] = useState('');
  const rsvp = RSVP_LABEL[item.myResponse] ?? RSVP_LABEL.Pending;
  const cancelled = item.status === 'Cancelled';
  const terminal = isTerminalInterview(item);
  const isFuture = isFutureInterview(item);

  const run = async (
    kind: 'cv' | 'ics' | 'Confirmed' | 'Declined' | 'Reschedule Requested',
    note?: string,
  ) => {
    setBusy(kind);
    setNotice(null);
    try {
      if (kind === 'cv') {
        setNotice({ tone: 'ok', text: `Downloaded ${await downloadCv(item.id)}` });
      } else if (kind === 'ics') {
        setNotice({ tone: 'ok', text: `Downloaded ${await downloadIcs(item.id)}` });
      } else {
        await respond(item.id, kind, note);
        onPatch(item.id, { myResponse: kind });
        if (kind === 'Reschedule Requested') {
          setRescheduleOpen(false);
          setRescheduleReason('');
          setNotice({ tone: 'ok', text: 'Reschedule requested. The recruiter has been notified.' });
        } else {
          setNotice({
            tone: 'ok',
            text:
              kind === 'Confirmed'
                ? 'You accepted this interview.'
                : 'You declined this interview.',
          });
        }
      }
    } catch (e) {
      setNotice({
        tone: 'error',
        text:
          kind === 'cv'
            ? downloadErrorMessage(e, 'CV')
            : kind === 'ics'
              ? downloadErrorMessage(e, 'calendar file')
              : e instanceof Error
                ? e.message
                : 'Could not save your answer.',
      });
    } finally {
      setBusy(null);
    }
  };

  const submitRescheduleRequest = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = rescheduleReason.trim();
    if (!trimmed) {
      setNotice({
        tone: 'error',
        text: 'Please include a reason when requesting a reschedule.',
      });
      return;
    }
    void run('Reschedule Requested', trimmed);
  };

  const scorecardBadgeLabel =
    item.scorecardStatus === 'submitted'
      ? 'Scorecard submitted'
      : item.scorecardStatus === 'draft'
        ? 'Draft saved'
        : isFuture
          ? 'Prepare draft'
          : 'Scorecard due';

  const scorecardBadgeVariant =
    item.scorecardStatus === 'submitted'
      ? 'success'
      : item.scorecardStatus === 'draft' || isFuture
        ? 'neutral'
        : 'warning';

  const scorecardButtonLabel =
    item.scorecardStatus === 'submitted'
      ? 'View my scorecard'
      : item.scorecardStatus === 'draft'
        ? 'Continue scorecard'
        : isFuture
          ? 'Prepare scorecard'
          : 'Fill scorecard';

  return (
    <li
      id={`my-interview-${item.id}`}
      className={`rounded-2xl border bg-rf-surface p-4 ${
        focused ? 'border-rf-action ring-2 ring-rf-action/30' : 'border-rf-border'
      }`}
      aria-current={focused ? 'true' : undefined}
      aria-labelledby={`iv-${item.id}`}
      data-testid="my-interview"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`iv-${item.id}`} className="text-sm font-bold text-rf-ink">
            {item.candidateName}
            {item.positionTitle ? (
              <span className="font-semibold text-rf-ink-muted"> · {item.positionTitle}</span>
            ) : null}
          </h2>
          <p className="mt-0.5 text-xs text-rf-ink-muted">
            {item.title} · {when(item.scheduledStart, item.timezone)}–
            {when(item.scheduledEnd, item.timezone).split(', ').pop()}
            {item.timezone ? ` (${item.timezone})` : ''}
          </p>
          {item.locationUrl ? (
            <p className="mt-1 text-xs">
              <a
                className="text-rf-action underline-offset-2 hover:underline"
                href={item.locationUrl}
                target="_blank"
                rel="noreferrer"
              >
                Room link
              </a>
              {item.roomName ? (
                <span className="text-rf-ink-muted" data-testid="room-name">
                  {' '}
                  · {item.roomName}
                </span>
              ) : null}
            </p>
          ) : item.roomName ? (
            <p className="mt-1 text-xs text-rf-ink-muted" data-testid="room-name">
              {item.roomName}
            </p>
          ) : (
            <p className="mt-1 text-xs text-rf-ink-muted">No room link yet</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {cancelled ? <Badge variant="danger">Cancelled</Badge> : null}
          {item.status === 'Completed' ? <Badge variant="neutral">Completed</Badge> : null}
          {item.status === 'No-show' ? <Badge variant="warning">No-show</Badge> : null}
          <Badge variant={rsvp.variant}>{rsvp.label}</Badge>
          <Badge variant={scorecardBadgeVariant}>{scorecardBadgeLabel}</Badge>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void run('cv')}
          disabled={busy !== null}
          aria-label={`Download CV for ${item.candidateName}`}
        >
          <Icon name="download" size={13} /> {busy === 'cv' ? 'Downloading…' : 'Download CV'}
        </Button>
        <Button
          size="sm"
          variant={item.scorecardStatus === 'submitted' ? 'secondary' : 'primary'}
          onClick={onScorecard}
          disabled={cancelled || item.status === 'No-show'}
        >
          {scorecardButtonLabel}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void run('Confirmed')}
          disabled={
            busy !== null ||
            terminal ||
            item.myResponse === 'Confirmed' ||
            item.myResponse === 'Accepted'
          }
        >
          Accept
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void run('Declined')}
          disabled={busy !== null || terminal || item.myResponse === 'Declined'}
        >
          Decline
        </Button>
        {!terminal ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setNotice(null);
              setRescheduleOpen((v) => !v);
            }}
            disabled={busy !== null}
          >
            Request reschedule
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void run('ics')}
          disabled={busy !== null}
        >
          <Icon name="calendar" size={13} /> Add to calendar (.ics)
        </Button>
      </div>
      {rescheduleOpen && !terminal ? (
        <form
          onSubmit={submitRescheduleRequest}
          className="mt-3 space-y-2 rounded-xl border border-rf-border bg-rf-surface p-3 text-xs"
        >
          <label className="block">
            <span className="mb-1 block font-semibold text-rf-ink">
              Reason for reschedule request <span aria-hidden="true">*</span>
            </span>
            <input
              type="text"
              className="w-full rounded-lg border border-rf-border bg-rf-surface px-2.5 py-1.5 text-xs"
              placeholder="Explain the conflict or preferred time window…"
              value={rescheduleReason}
              onChange={(e) => setRescheduleReason(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="primary"
              type="submit"
              disabled={busy === 'Reschedule Requested'}
            >
              {busy === 'Reschedule Requested' ? 'Sending…' : 'Send reschedule request'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              type="button"
              onClick={() => {
                setRescheduleOpen(false);
                setRescheduleReason('');
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
      {notice ? (
        <p
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={`mt-2 text-xs ${
            notice.tone === 'error' ? 'text-rf-danger' : 'text-rf-success'
          }`}
        >
          {notice.text}
        </p>
      ) : null}
    </li>
  );
}

/** A saved, unsubmitted scorecard stays editable (no 'locked' state). */
function isDraft(card: MyScorecard, interview: MyInterview): boolean {
  // R3-1: B5 status when present, else the legacy isLocked flag. Only a card carrying neither falls back
  // to the interview's scorecardStatus (R3-2: the card's own state wins over that list-time snapshot).
  if (card.status || typeof card.isLocked === 'boolean') return scorecardState(card) === 'draft';
  return interview.scorecardStatus !== 'submitted';
}

function ScorecardModal({
  interview,
  onClose,
  onDraftSaved,
  onSubmitted,
}: {
  interview: MyInterview;
  onClose: () => void;
  onDraftSaved: () => void;
  onSubmitted: () => void;
}) {
  const [mine, setMine] = useState<MyScorecard | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<SubmitScorecardBody>({
    overallRating: 0,
    recommendation: 'Hire',
    notes: '',
    strengths: '',
    concerns: '',
  });
  const [revising, setRevising] = useState(false);
  const [revisionReason, setRevisionReason] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isFuture = isFutureInterview(interview);

  useEffect(() => {
    getMyScorecards(interview.id)
      .then((list) => {
        const last = Array.isArray(list) && list.length ? list[list.length - 1] : null;
        setMine(last);
        if (last && isDraft(last, interview)) {
          setForm({
            overallRating: last.overallRating ?? 0,
            recommendation: last.recommendation ?? 'Hire',
            notes: last.notes ?? '',
            strengths: last.strengths ?? '',
            concerns: last.concerns ?? '',
          });
        }
      })
      .catch((e: unknown) =>
        setLoadError(e instanceof Error ? e.message : 'Could not load your scorecard.'),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interview.id]);

  const editing =
    revising || mine === null || (mine !== undefined && isDraft(mine, interview));

  const validateFields = (requireRevisionReason = false) => {
    const next: Record<string, string> = {};
    if (form.overallRating < 1 || form.overallRating > 5) {
      next.overallRating = 'Choose a rating from 1 to 5.';
    }
    if (!form.notes.trim()) {
      next.notes = 'Write what the candidate showed, with examples.';
    }
    if (requireRevisionReason && revisionReason.trim().length < 3) {
      next.reason = 'Enter a reason for revising this scorecard (at least 3 characters).';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSaveDraft = async () => {
    if (!validateFields(false)) return;
    setSaving(true);
    setSubmitError(null);
    setStatusMessage(null);
    try {
      const body: SubmitScorecardBody = {
        overallRating: form.overallRating,
        recommendation: form.recommendation,
        notes: form.notes.trim(),
        status: 'Draft',
      };
      if (form.strengths?.trim()) body.strengths = form.strengths.trim();
      if (form.concerns?.trim()) body.concerns = form.concerns.trim();
      const saved = await submitScorecard(interview.id, body);
      setMine(
        saved && typeof saved === 'object' && 'id' in saved
          ? { ...saved, status: 'Draft', isLocked: false }
          : {
              ...body,
              id: 'draft',
              interviewId: interview.id,
              interviewerId: '',
              status: 'Draft',
              isLocked: false,
              submittedAt: new Date().toISOString(),
            },
      );
      setIsDirty(false);
      setConfirmDiscard(false);
      setStatusMessage('Draft saved. Continue editing and submit when ready.');
      onDraftSaved();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not save the draft.');
    } finally {
      setSaving(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (isFuture && !revising) {
      setSubmitError(
        'A scorecard cannot be submitted for a future interview before it starts. Save a draft now and submit after the interview begins.',
      );
      return;
    }
    if (!validateFields(revising)) return;
    setSaving(true);
    setSubmitError(null);
    setStatusMessage(null);
    try {
      if (revising) {
        const revBody = {
          overallRating: form.overallRating,
          recommendation: form.recommendation,
          notes: form.notes.trim(),
          reason: revisionReason.trim(),
          ...(form.strengths?.trim() ? { strengths: form.strengths.trim() } : {}),
          ...(form.concerns?.trim() ? { concerns: form.concerns.trim() } : {}),
        };
        const saved = await reviseScorecard(interview.id, revBody);
        setMine(
          saved && typeof saved === 'object' && 'id' in saved
            ? { ...saved, status: 'Submitted', isLocked: true, revisionReason: revBody.reason }
            : {
                ...revBody,
                id: 'rev',
                interviewId: interview.id,
                interviewerId: '',
                status: 'Submitted',
                isLocked: true,
                revisionReason: revBody.reason,
                submittedAt: new Date().toISOString(),
              },
        );
        setRevising(false);
        setRevisionReason('');
        setIsDirty(false);
        onSubmitted();
      } else {
        const body: SubmitScorecardBody = {
          overallRating: form.overallRating,
          recommendation: form.recommendation,
          notes: form.notes.trim(),
        };
        if (form.strengths?.trim()) body.strengths = form.strengths.trim();
        if (form.concerns?.trim()) body.concerns = form.concerns.trim();
        const saved = await submitScorecard(interview.id, body);
        // R3-2: a successful submit is final — show the submitted view now, even if #4 echoes no status/isLocked.
        setMine(
          saved && typeof saved === 'object' && 'id' in saved
            ? { ...saved, status: 'Submitted', isLocked: true }
            : {
                ...body,
                id: 'new',
                interviewId: interview.id,
                interviewerId: '',
                status: 'Submitted',
                submittedAt: new Date().toISOString(),
              },
        );
        setIsDirty(false);
        onSubmitted();
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not submit the scorecard.');
    } finally {
      setSaving(false);
    }
  };

  const requestClose = () => {
    if (editing && isDirty && !confirmDiscard) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  };

  const startRevision = () => {
    if (!mine) return;
    setForm({
      overallRating: mine.overallRating ?? 0,
      recommendation: mine.recommendation ?? 'Hire',
      notes: mine.notes ?? '',
      strengths: mine.strengths ?? '',
      concerns: mine.concerns ?? '',
    });
    setRevisionReason('');
    setErrors({});
    setSubmitError(null);
    setRevising(true);
  };

  return (
    <Modal
      isOpen
      onClose={requestClose}
      title={`Scorecard — ${interview.candidateName}`}
      footer={
        mine === undefined && !loadError ? (
          <Button variant="secondary" onClick={requestClose}>
            Cancel
          </Button>
        ) : editing ? (
          <>
            <Button
              variant="secondary"
              onClick={() => {
                if (revising && !isDirty) {
                  setRevising(false);
                  return;
                }
                requestClose();
              }}
            >
              Cancel
            </Button>
            {!revising ? (
              <Button
                variant="secondary"
                type="button"
                onClick={() => void handleSaveDraft()}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save draft'}
              </Button>
            ) : null}
            <Button
              variant="primary"
              type="submit"
              form="my-scorecard-form"
              disabled={saving || (isFuture && !revising)}
              aria-describedby={isFuture && !revising ? 'sc-future-rule' : undefined}
            >
              {saving
                ? 'Submitting…'
                : revising
                  ? 'Submit revision'
                  : 'Submit scorecard'}
            </Button>
          </>
        ) : (
          <>
            {interview.status !== 'Cancelled' && interview.status !== 'No-show' ? (
              <Button variant="secondary" onClick={startRevision}>
                Revise scorecard
              </Button>
            ) : null}
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </>
        )
      }
    >
      {loadError ? (
        <p role="alert" className="text-sm text-rf-danger">
          {loadError}
        </p>
      ) : null}
      {mine === undefined && !loadError ? (
        <p role="status" className="text-sm text-rf-ink-muted">
          Loading your scorecard…
        </p>
      ) : null}
      {confirmDiscard ? (
        <div
          role="alert"
          className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"
        >
          <span>You have unsaved scorecard edits. Discard changes or keep editing?</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setConfirmDiscard(false)}>
              Keep editing
            </Button>
            <Button size="sm" variant="primary" onClick={onClose}>
              Discard changes
            </Button>
          </div>
        </div>
      ) : null}
      {mine && !editing ? (
        <dl
          className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-2 text-sm"
          data-testid="my-scorecard"
        >
          <dt className="text-rf-ink-muted">Rating</dt>
          <dd>{mine.overallRating} of 5</dd>
          <dt className="text-rf-ink-muted">Recommendation</dt>
          <dd>{mine.recommendation}</dd>
          {mine.strengths ? (
            <>
              <dt className="text-rf-ink-muted">Strengths</dt>
              <dd>{mine.strengths}</dd>
            </>
          ) : null}
          {mine.concerns ? (
            <>
              <dt className="text-rf-ink-muted">Concerns</dt>
              <dd>{mine.concerns}</dd>
            </>
          ) : null}
          <dt className="text-rf-ink-muted">Evidence</dt>
          <dd className="whitespace-pre-wrap">{mine.notes}</dd>
          {mine.revisionReason ? (
            <>
              <dt className="text-rf-ink-muted">Revision reason</dt>
              <dd>{mine.revisionReason}</dd>
            </>
          ) : null}
          <dt className="text-rf-ink-muted">Submitted</dt>
          <dd>{when(mine.submittedAt)}</dd>
        </dl>
      ) : null}
      {(mine && editing && !revising) || statusMessage ? (
        <p
          role="status"
          className="mb-2 text-xs text-rf-ink-muted"
          data-testid="draft-note"
        >
          {statusMessage ?? 'Draft saved. Continue editing and submit when ready.'}
        </p>
      ) : null}
      {isFuture && editing && !revising ? (
        <p
          id="sc-future-rule"
          role="note"
          className="mb-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900"
        >
          Final submission unlocks once the interview starts. You can save a draft now and submit
          after the interview begins.
        </p>
      ) : null}
      {editing ? (
        <form
          id="my-scorecard-form"
          onSubmit={submit}
          noValidate
          className="space-y-3 text-sm"
        >
          <fieldset aria-describedby={errors.overallRating ? 'sc-rating-err' : undefined}>
            <legend className="mb-1 font-semibold text-rf-ink">
              Overall rating <span aria-hidden="true">*</span>
            </legend>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className="inline-flex items-center gap-1">
                  <input
                    type="radio"
                    name="overallRating"
                    value={n}
                    checked={form.overallRating === n}
                    onChange={() => {
                      setIsDirty(true);
                      setForm({ ...form, overallRating: n });
                    }}
                  />{' '}
                  {n}
                </label>
              ))}
            </div>
            {errors.overallRating ? (
              <p id="sc-rating-err" role="alert" className="mt-1 text-xs text-rf-danger">
                {errors.overallRating}
              </p>
            ) : null}
          </fieldset>
          <label className="block">
            <span className="mb-1 block font-semibold text-rf-ink">Recommendation</span>
            <select
              className="w-full rounded-lg border border-rf-border bg-rf-surface px-2 py-1.5"
              value={form.recommendation}
              onChange={(e) => {
                setIsDirty(true);
                setForm({
                  ...form,
                  recommendation: e.target.value as SubmitScorecardBody['recommendation'],
                });
              }}
            >
              {RECOMMENDATIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block font-semibold text-rf-ink">Strengths</span>
            <textarea
              className="w-full rounded-lg border border-rf-border bg-rf-surface px-2 py-1.5"
              rows={2}
              value={form.strengths}
              onChange={(e) => {
                setIsDirty(true);
                setForm({ ...form, strengths: e.target.value });
              }}
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-semibold text-rf-ink">Concerns</span>
            <textarea
              className="w-full rounded-lg border border-rf-border bg-rf-surface px-2 py-1.5"
              rows={2}
              value={form.concerns}
              onChange={(e) => {
                setIsDirty(true);
                setForm({ ...form, concerns: e.target.value });
              }}
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-semibold text-rf-ink">
              Written evidence <span aria-hidden="true">*</span>
            </span>
            <textarea
              aria-required="true"
              aria-invalid={errors.notes ? true : undefined}
              aria-describedby={errors.notes ? 'sc-notes-err' : undefined}
              className="w-full rounded-lg border border-rf-border bg-rf-surface px-2 py-1.5"
              rows={4}
              value={form.notes}
              onChange={(e) => {
                setIsDirty(true);
                setForm({ ...form, notes: e.target.value });
              }}
            />
            {errors.notes ? (
              <span
                id="sc-notes-err"
                role="alert"
                className="mt-1 block text-xs text-rf-danger"
              >
                {errors.notes}
              </span>
            ) : null}
          </label>
          {revising ? (
            <label className="block">
              <span className="mb-1 block font-semibold text-rf-ink">
                Reason for revision <span aria-hidden="true">*</span>
              </span>
              <input
                type="text"
                aria-required="true"
                aria-invalid={errors.reason ? true : undefined}
                aria-describedby={errors.reason ? 'sc-reason-err' : undefined}
                className="w-full rounded-lg border border-rf-border bg-rf-surface px-2 py-1.5"
                placeholder="Explain what changed since your initial submission…"
                value={revisionReason}
                onChange={(e) => {
                  setIsDirty(true);
                  setRevisionReason(e.target.value);
                }}
              />
              {errors.reason ? (
                <span
                  id="sc-reason-err"
                  role="alert"
                  className="mt-1 block text-xs text-rf-danger"
                >
                  {errors.reason}
                </span>
              ) : null}
            </label>
          ) : null}
          {submitError ? (
            <p role="alert" className="text-xs text-rf-danger">
              {submitError}
            </p>
          ) : null}
        </form>
      ) : null}
    </Modal>
  );
}
