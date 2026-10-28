import { useCallback, useEffect, useState, type FormEvent } from 'react';
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
  RECOMMENDATIONS, downloadCv, downloadErrorMessage, downloadIcs, getMyScorecards, listMyInterviews, respond, submitScorecard,
  type ListResult, type MyInterview, type MyScorecard, type SubmitScorecardBody,
} from '../api/myInterviews';

type Load = { kind: 'loading' } | { kind: 'ready'; result: ListResult; pending: MyInterview[]; done: MyInterview[] } | { kind: 'error'; message: string; forbidden: boolean };

const when = (iso: string, tz?: string | null) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz || undefined }).format(d);
  } catch {
    return d.toLocaleString();
  }
};

/** B2V-1: an ended, not-cancelled interview still needs my scorecard while it is missing or a draft. */
export const needsMyScorecard = (i: MyInterview) => i.status !== 'Cancelled' && i.scorecardStatus !== 'submitted';

const RSVP_LABEL: Record<string, { label: string; variant: 'success' | 'danger' | 'warning' | 'neutral' }> = {
  Confirmed: { label: 'Accepted', variant: 'success' },
  Accepted: { label: 'Accepted', variant: 'success' },
  Declined: { label: 'Declined', variant: 'danger' },
  'Reschedule Requested': { label: 'Reschedule requested', variant: 'warning' },
  Pending: { label: 'Not answered', variant: 'neutral' },
};

/** QA BUG-4: the interviewer's own interviews. Only: CV, my scorecard, RSVP, .ics. */
export function MyInterviewsPage({ load = listMyInterviews }: { load?: typeof listMyInterviews } = {}) {
  const [state, setState] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [scorecardFor, setScorecardFor] = useState<MyInterview | null>(null);
  // B2F-3: My Work's "Open interview" / "Submit scorecard" deep-link here (?interview=<id>[&scorecard=1]).
  const [params] = useSearchParams();
  const focusId = params.get('interview');
  const openScorecard = params.get('scorecard') === '1';
  const [deepLinked, setDeepLinked] = useState(false);
  useEffect(() => {
    if (deepLinked || !focusId || state.kind !== 'ready' || !state.result.available) return;
    const hit = [...state.pending, ...state.done, ...state.result.items].find((i) => i.id === focusId);
    if (!hit) return;
    setDeepLinked(true);
    if (openScorecard && hit.status !== 'Cancelled') setScorecardFor(hit);
    else document.getElementById(`my-interview-${hit.id}`)?.scrollIntoView?.({ block: 'center' });
  }, [deepLinked, focusId, openScorecard, state]);

  useEffect(() => {
    let alive = true;
    setState({ kind: 'loading' });
    // B2V-1: ended interviews whose scorecard is still missing or a draft come from scope=past (the API's only filter);
    // the client keeps those. If the past list fails, upcoming still shows.
    Promise.all([load('upcoming'), load('past').catch(() => ({ available: false }) as ListResult)])
      .then(([result, past]) => {
        if (!alive) return;
        const ended = past.available ? past.items.filter((i) => !(result.available && result.items.some((u) => u.id === i.id))) : [];
        // PR33-2: ended interviews with my submitted card stay findable (read-only) instead of disappearing.
        setState({ kind: 'ready', result, pending: ended.filter(needsMyScorecard), done: ended.filter((i) => i.status !== 'Cancelled' && i.scorecardStatus === 'submitted') });
      })
      .catch((e: unknown) => alive && setState({ kind: 'error', message: e instanceof Error ? e.message : 'Could not load your interviews.', forbidden: e instanceof ApiError && e.statusCode === 403 }));
    return () => { alive = false; };
  }, [load, attempt]);

  const patch = useCallback((id: string, change: Partial<MyInterview>) => {
    setState((s) => (s.kind === 'ready' && s.result.available
      ? { kind: 'ready', result: { available: true, items: s.result.items.map((i) => (i.id === id ? { ...i, ...change } : i)) }, pending: s.pending.map((i) => (i.id === id ? { ...i, ...change } : i)), done: s.done.map((i) => (i.id === id ? { ...i, ...change } : i)) }
      : s));
  }, []);

  return (
    <PageFrame eyebrow="Interviewer" title="My interviews">
      {state.kind === 'loading' ? <PageState kind="loading" title="Loading your interviews" /> : null}
      {state.kind === 'error' ? (
        state.forbidden
          ? <PageState kind="forbidden" title="You do not have access to interviews" description={state.message} />
          : <PageState kind="error" title="Could not load your interviews" description={state.message} actionLabel="Try again" onAction={() => setAttempt((n) => n + 1)} />
      ) : null}
      {state.kind === 'ready' && !state.result.available ? (
        <PageState kind="unavailable" title="Not available yet" description="The list of your interviews is coming soon. Links in your interview invitations still work." />
      ) : null}
      {state.kind === 'ready' && state.result.available && state.pending.length > 0 ? (
        <section aria-labelledby="mi-due-h" className="space-y-2">
          <h2 id="mi-due-h" className="text-sm font-semibold">Scorecard due — ended interviews</h2>
          <ul className="space-y-3" aria-label="Ended interviews needing my scorecard">
            {state.pending.map((item) => (
              <InterviewCard key={item.id} item={item} focused={item.id === focusId} onPatch={patch} onScorecard={() => setScorecardFor(item)} />
            ))}
          </ul>
        </section>
      ) : null}
      {state.kind === 'ready' && state.result.available && state.result.items.length === 0 && state.pending.length === 0 && state.done.length === 0 ? (
        <PageState kind="empty" title="No upcoming interviews" description="Interviews you are invited to will appear here." />
      ) : null}
      {state.kind === 'ready' && state.result.available && state.result.items.length > 0 ? (
        <ul className="space-y-3" aria-label="My interviews">
          {state.result.items.map((item) => (
            <InterviewCard key={item.id} item={item} focused={item.id === focusId} onPatch={patch} onScorecard={() => setScorecardFor(item)} />
          ))}
        </ul>
      ) : null}
      {state.kind === 'ready' && state.result.available && state.done.length > 0 ? (
        <section aria-labelledby="mi-done-h" className="space-y-2">
          <h2 id="mi-done-h" className="text-sm font-semibold">Submitted scorecards — ended interviews</h2>
          <ul className="space-y-3" aria-label="Ended interviews with my submitted scorecard">
            {state.done.map((item) => (
              <InterviewCard key={item.id} item={item} focused={item.id === focusId} onPatch={patch} onScorecard={() => setScorecardFor(item)} />
            ))}
          </ul>
        </section>
      ) : null}
      {scorecardFor ? (
        <ScorecardModal interview={scorecardFor} onClose={() => setScorecardFor(null)}
          onSubmitted={() => patch(scorecardFor.id, { scorecardStatus: 'submitted' })} />
      ) : null}
    </PageFrame>
  );
}

function InterviewCard({ item, focused = false, onPatch, onScorecard }: { item: MyInterview; focused?: boolean; onPatch: (id: string, c: Partial<MyInterview>) => void; onScorecard: () => void }) {
  const [busy, setBusy] = useState<null | 'cv' | 'ics' | 'Confirmed' | 'Declined'>(null);
  const [notice, setNotice] = useState<{ tone: 'error' | 'ok'; text: string } | null>(null);
  const rsvp = RSVP_LABEL[item.myResponse] ?? RSVP_LABEL.Pending;
  const cancelled = item.status === 'Cancelled';

  const run = async (kind: 'cv' | 'ics' | 'Confirmed' | 'Declined') => {
    setBusy(kind); setNotice(null);
    try {
      if (kind === 'cv') setNotice({ tone: 'ok', text: `Downloaded ${await downloadCv(item.id)}` });
      else if (kind === 'ics') setNotice({ tone: 'ok', text: `Downloaded ${await downloadIcs(item.id)}` });
      else { await respond(item.id, kind); onPatch(item.id, { myResponse: kind }); setNotice({ tone: 'ok', text: kind === 'Confirmed' ? 'You accepted this interview.' : 'You declined this interview.' }); }
    } catch (e) {
      setNotice({ tone: 'error', text: kind === 'cv' ? downloadErrorMessage(e, 'CV') : kind === 'ics' ? downloadErrorMessage(e, 'calendar file') : e instanceof Error ? e.message : 'Could not save your answer.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <li id={`my-interview-${item.id}`} className={`rounded-2xl border bg-rf-surface p-4 ${focused ? "border-rf-action ring-2 ring-rf-action/30" : "border-rf-border"}`} aria-current={focused ? "true" : undefined} aria-labelledby={`iv-${item.id}`} data-testid="my-interview">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`iv-${item.id}`} className="text-sm font-bold text-rf-ink">{item.candidateName}{item.positionTitle ? <span className="font-semibold text-rf-ink-muted"> · {item.positionTitle}</span> : null}</h2>
          <p className="mt-0.5 text-xs text-rf-ink-muted">{item.title} · {when(item.scheduledStart, item.timezone)}–{when(item.scheduledEnd, item.timezone).split(', ').pop()}</p>
          {item.locationUrl ? (
            <p className="mt-1 text-xs"><a className="text-rf-action underline-offset-2 hover:underline" href={item.locationUrl} target="_blank" rel="noreferrer">Room link</a>{item.roomName ? <span className="text-rf-ink-muted" data-testid="room-name"> · {item.roomName}</span> : null}</p>
          ) : item.roomName ? <p className="mt-1 text-xs text-rf-ink-muted" data-testid="room-name">{item.roomName}</p> : <p className="mt-1 text-xs text-rf-ink-muted">No room link yet</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {cancelled ? <Badge variant="danger">Cancelled</Badge> : null}
          <Badge variant={rsvp.variant}>{rsvp.label}</Badge>
          <Badge variant={item.scorecardStatus === 'submitted' ? 'success' : item.scorecardStatus === 'draft' ? 'neutral' : 'warning'}>{item.scorecardStatus === 'submitted' ? 'Scorecard submitted' : item.scorecardStatus === 'draft' ? 'Draft saved' : 'Scorecard due'}</Badge>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => run('cv')} disabled={busy !== null} aria-label={`Download CV for ${item.candidateName}`}><Icon name="download" size={13} /> {busy === 'cv' ? 'Downloading…' : 'Download CV'}</Button>
        <Button size="sm" variant={item.scorecardStatus === 'submitted' ? 'secondary' : 'primary'} onClick={onScorecard} disabled={cancelled}>{item.scorecardStatus === 'submitted' ? 'View my scorecard' : item.scorecardStatus === 'draft' ? 'Continue scorecard' : 'Fill scorecard'}</Button>
        <Button size="sm" variant="secondary" onClick={() => run('Confirmed')} disabled={busy !== null || cancelled || item.myResponse === 'Confirmed' || item.myResponse === 'Accepted'}>Accept</Button>
        <Button size="sm" variant="secondary" onClick={() => run('Declined')} disabled={busy !== null || cancelled || item.myResponse === 'Declined'}>Decline</Button>
        <Button size="sm" variant="ghost" onClick={() => run('ics')} disabled={busy !== null}><Icon name="calendar" size={13} /> Add to calendar (.ics)</Button>
      </div>
      {notice ? <p role={notice.tone === 'error' ? 'alert' : 'status'} className={`mt-2 text-xs ${notice.tone === 'error' ? 'text-rf-danger' : 'text-rf-success'}`}>{notice.text}</p> : null}
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

function ScorecardModal({ interview, onClose, onSubmitted }: { interview: MyInterview; onClose: () => void; onSubmitted: () => void }) {
  const [mine, setMine] = useState<MyScorecard | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<SubmitScorecardBody>({ overallRating: 0, recommendation: 'Hire', notes: '', strengths: '', concerns: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    getMyScorecards(interview.id)
      .then((list) => {
        const last = Array.isArray(list) && list.length ? list[list.length - 1] : null;
        setMine(last);
        if (last && isDraft(last, interview)) setForm({ overallRating: last.overallRating ?? 0, recommendation: last.recommendation ?? 'Hire', notes: last.notes ?? '', strengths: last.strengths ?? '', concerns: last.concerns ?? '' });
      })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : 'Could not load your scorecard.'));
  }, [interview.id]);

  const editing = mine === null || (mine !== undefined && isDraft(mine, interview));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (form.overallRating < 1 || form.overallRating > 5) next.overallRating = 'Choose a rating from 1 to 5.';
    if (!form.notes.trim()) next.notes = 'Write what the candidate showed, with examples.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true); setSubmitError(null);
    try {
      const body: SubmitScorecardBody = { overallRating: form.overallRating, recommendation: form.recommendation, notes: form.notes.trim() };
      if (form.strengths?.trim()) body.strengths = form.strengths.trim();
      if (form.concerns?.trim()) body.concerns = form.concerns.trim();
      const saved = await submitScorecard(interview.id, body);
      // R3-2: a successful submit is final — show the submitted view now, even if #4 echoes no status/isLocked.
      setMine(saved && typeof saved === 'object' && 'id' in saved ? { ...saved, status: 'Submitted', isLocked: true } : { ...body, id: 'new', interviewId: interview.id, interviewerId: '', status: 'Submitted', submittedAt: new Date().toISOString() });
      onSubmitted();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not submit the scorecard.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Scorecard — ${interview.candidateName}`}
      footer={editing ? (
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="my-scorecard-form" disabled={saving}>{saving ? 'Submitting…' : 'Submit scorecard'}</Button>
        </>
      ) : <Button variant="secondary" onClick={onClose}>Close</Button>}>
      {loadError ? <p role="alert" className="text-sm text-rf-danger">{loadError}</p> : null}
      {mine === undefined && !loadError ? <p role="status" className="text-sm text-rf-ink-muted">Loading your scorecard…</p> : null}
      {mine && !editing ? (
        <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-2 text-sm" data-testid="my-scorecard">
          <dt className="text-rf-ink-muted">Rating</dt><dd>{mine.overallRating} of 5</dd>
          <dt className="text-rf-ink-muted">Recommendation</dt><dd>{mine.recommendation}</dd>
          {mine.strengths ? (<><dt className="text-rf-ink-muted">Strengths</dt><dd>{mine.strengths}</dd></>) : null}
          {mine.concerns ? (<><dt className="text-rf-ink-muted">Concerns</dt><dd>{mine.concerns}</dd></>) : null}
          <dt className="text-rf-ink-muted">Evidence</dt><dd className="whitespace-pre-wrap">{mine.notes}</dd>
          <dt className="text-rf-ink-muted">Submitted</dt><dd>{when(mine.submittedAt)}</dd>
        </dl>
      ) : null}
      {mine && editing ? <p role="status" className="mb-2 text-xs text-rf-ink-muted" data-testid="draft-note">Draft saved. Continue editing and submit when ready.</p> : null}
      {editing ? (
        <form id="my-scorecard-form" onSubmit={submit} noValidate className="space-y-3 text-sm">
          <fieldset aria-describedby={errors.overallRating ? 'sc-rating-err' : undefined}>
            <legend className="mb-1 font-semibold text-rf-ink">Overall rating <span aria-hidden="true">*</span></legend>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className="inline-flex items-center gap-1">
                  <input type="radio" name="overallRating" value={n} checked={form.overallRating === n} onChange={() => setForm({ ...form, overallRating: n })} /> {n}
                </label>
              ))}
            </div>
            {errors.overallRating ? <p id="sc-rating-err" role="alert" className="mt-1 text-xs text-rf-danger">{errors.overallRating}</p> : null}
          </fieldset>
          <label className="block"><span className="mb-1 block font-semibold text-rf-ink">Recommendation</span>
            <select className="w-full rounded-lg border border-rf-border bg-rf-surface px-2 py-1.5" value={form.recommendation} onChange={(e) => setForm({ ...form, recommendation: e.target.value as SubmitScorecardBody['recommendation'] })}>
              {RECOMMENDATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="block"><span className="mb-1 block font-semibold text-rf-ink">Strengths</span>
            <textarea className="w-full rounded-lg border border-rf-border bg-rf-surface px-2 py-1.5" rows={2} value={form.strengths} onChange={(e) => setForm({ ...form, strengths: e.target.value })} />
          </label>
          <label className="block"><span className="mb-1 block font-semibold text-rf-ink">Concerns</span>
            <textarea className="w-full rounded-lg border border-rf-border bg-rf-surface px-2 py-1.5" rows={2} value={form.concerns} onChange={(e) => setForm({ ...form, concerns: e.target.value })} />
          </label>
          <label className="block"><span className="mb-1 block font-semibold text-rf-ink">Written evidence <span aria-hidden="true">*</span></span>
            <textarea aria-required="true" aria-invalid={errors.notes ? true : undefined} aria-describedby={errors.notes ? 'sc-notes-err' : undefined} className="w-full rounded-lg border border-rf-border bg-rf-surface px-2 py-1.5" rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            {errors.notes ? <span id="sc-notes-err" role="alert" className="mt-1 block text-xs text-rf-danger">{errors.notes}</span> : null}
          </label>
          {submitError ? <p role="alert" className="text-xs text-rf-danger">{submitError}</p> : null}
        </form>
      ) : null}
    </Modal>
  );
}
