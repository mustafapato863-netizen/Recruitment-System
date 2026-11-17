import { useCallback, useEffect, useRef, useState } from 'react';
import type { CandidateActivityKind, CandidateActivitySummary } from '@recruitflow/contracts';
import { getApi, patchApi, postApi } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../ui/Button';

const kinds: CandidateActivityKind[] = ['Call', 'Note', 'Email', 'Meeting', 'Document Verification', 'Offer Follow-up'];
const dateLabel = (value: string | null) => value ? new Date(value).toLocaleString() : 'None recorded';

/** datetime-local is the browser's wall time. Persist UTC so Africa/Cairo display stays stable. */
function localInputToUtcIso(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error('Enter a valid date and time');
  return parsed.toISOString();
}

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function newIdempotencyKey(): string {
  const uuid = globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
  if (uuid) return uuid();
  return `activity-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

interface CandidateActivityPanelProps {
  candidateId: string;
  refreshKey?: number;
  initialKind?: CandidateActivityKind;
  initialScheduled?: boolean;
  contextLabel?: string;
}

export function CandidateActivityPanel({ candidateId, refreshKey = 0, initialKind, initialScheduled, contextLabel = 'Person activity — shared across all applications for this candidate' }: CandidateActivityPanelProps) {
  const { user } = useAuth();
  const canView = Boolean(user?.permissions.includes('CANDIDATE_VIEW'));
  const canEdit = Boolean(user?.permissions.includes('CANDIDATE_EDIT'));
  const [data, setData] = useState<CandidateActivitySummary | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<CandidateActivityKind>(initialKind ?? 'Call');
  const [summary, setSummary] = useState('');
  const [scheduled, setScheduled] = useState(initialScheduled ?? false);
  const [dueAt, setDueAt] = useState('');
  const [followUpDueAt, setFollowUpDueAt] = useState('');
  const [followUpSummary, setFollowUpSummary] = useState('');
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleDueAt, setRescheduleDueAt] = useState('');
  const requestVersion = useRef(0);
  const idempotencyRef = useRef<{ draft: string; key: string } | null>(null);
  const timeZone = browserTimeZone();
  useEffect(() => {
    if (initialKind) setKind(initialKind);
    if (initialScheduled !== undefined) setScheduled(initialScheduled);
  }, [initialKind, initialScheduled]);
  const load = useCallback(async () => {
    if (!canView) return;
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    try {
      const result = await getApi<CandidateActivitySummary>(`/candidates/${candidateId}/activities?page=${page}`);
      if (version === requestVersion.current) setData(result);
    } catch (err) {
      if (version === requestVersion.current) { setData(null); setError(err instanceof Error ? err.message : 'Unable to load activities'); }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [candidateId, page, canView]);
  useEffect(() => {
    void load();
    return () => { requestVersion.current += 1; };
  }, [load, refreshKey]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = summary.trim();
    if (busy || !trimmed) return;
    setBusy(true); setError(null); setNotice(null);
    const nextFollowUp = !scheduled ? followUpDueAt.trim() : '';
    const nextNote = followUpSummary.trim();
    const draft = [kind, trimmed, scheduled ? dueAt : '', nextFollowUp, nextNote].join('\u001f');
    const idempotencyKeyFor = () => {
      if (idempotencyRef.current?.draft === draft) return idempotencyRef.current.key;
      const key = newIdempotencyKey();
      idempotencyRef.current = { draft, key };
      return key;
    };
    try {
      const payload = scheduled
        ? { kind, summary: trimmed, dueAt: localInputToUtcIso(dueAt) }
        : nextFollowUp
          ? {
            kind,
            summary: trimmed,
            followUpDueAt: localInputToUtcIso(nextFollowUp),
            ...(nextNote ? { followUpSummary: nextNote } : {}),
            idempotencyKey: idempotencyKeyFor(),
          }
          : { kind, summary: trimmed };
      await postApi(`/candidates/${candidateId}/activities`, payload);
      setSummary(''); setDueAt(''); setFollowUpDueAt(''); setFollowUpSummary('');
      idempotencyRef.current = null;
      setNotice(scheduled ? 'Follow-up saved. Mark it done after completing the work.' : nextFollowUp ? 'Activity and follow-up saved.' : 'Activity saved.');
      if (page === 1) await load(); else setPage(1);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save activity'); }
    finally { setBusy(false); }
  };
  const complete = async (id: string) => {
    if (busy) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      await postApi(`/candidates/${candidateId}/activities/${id.replace('task:', '')}/complete`, {});
      setNotice('Follow-up completed.');
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to complete follow-up'); }
    finally { setBusy(false); }
  };
  const reschedule = async (id: string) => {
    if (busy || !rescheduleDueAt) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      await patchApi(`/candidates/${candidateId}/activities/${id.replace('task:', '')}/reschedule`, { dueAt: localInputToUtcIso(rescheduleDueAt) });
      setRescheduleId(null); setRescheduleDueAt(''); setNotice('Follow-up rescheduled.');
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to reschedule follow-up'); }
    finally { setBusy(false); }
  };

  if (!canView) return <p className="text-xs text-rf-ink-muted">Candidate activity access is not enabled for your role.</p>;

  return (
    <section aria-label="Candidate activity" className="rf-cand-activity-panel rounded-xl border border-rf-border bg-rf-surface p-4 space-y-3.5 text-rf-ink">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold tracking-tight">Activity &amp; follow-up</h2>
        <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading || busy}>Refresh</Button>
      </div>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      {notice && <p role="status" className="text-sm text-rf-ink">{notice}</p>}
      {loading && <p role="status" className="text-xs text-rf-ink-muted">Loading activities…</p>}
      {data && !loading && <>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {([['Completed', data.completed], ['By me', data.completedByMe], ['Follow-ups', data.pending], ['Overdue', data.overdue]] as const).map(([label, value]) => (
            <span key={label} className="flex items-center justify-between gap-1.5 rounded-lg border border-rf-border bg-rf-surface-subtle px-2.5 py-1.5">
              <span className="text-rf-ink-muted font-medium">{label}</span>
              <span className="font-bold tabular-nums">{value}</span>
            </span>
          ))}
        </div>
        {(data.lastActivityAt || data.nextFollowUpAt) ? <div className="text-xs space-y-1 text-rf-ink-muted"><p>Last completed activity: {dateLabel(data.lastActivityAt)}</p><p>Next follow-up: {dateLabel(data.nextFollowUpAt)}</p></div> : null}
        <div className="flex flex-wrap gap-2 text-xs" aria-label="Completed activity breakdown">{Object.entries(data.byKind).map(([label, value]) => <span className="rounded-lg border border-rf-border px-2 py-1" key={label}>{label}: {value}</span>)}</div>
        {data.byRecruiter.length > 0 && <details className="text-xs"><summary className="cursor-pointer font-semibold">Completed by recruiter</summary><ul className="mt-2 space-y-1">{data.byRecruiter.map((row) => <li key={row.userId}>{row.name}: {row.completed}</li>)}</ul></details>}
      </>}
      {data && !loading && <>
        <h3 className="text-xs font-bold uppercase tracking-wider text-rf-ink-muted">Latest activity ({data.totalEntries})</h3>
        {data.entries.length === 0 ? <p className="text-sm text-rf-ink-muted">No activities recorded yet.</p> : <ol className="rf-cand-timeline space-y-2">{data.entries.map((entry) => <li key={entry.id} className="rf-cand-timeline__item rounded-lg border border-rf-border-subtle bg-rf-surface-subtle/50 p-2.5 text-xs space-y-1">
          <div className="flex flex-wrap justify-between gap-2"><strong>{entry.kind} · {entry.status}</strong><time className="text-rf-ink-muted" dateTime={entry.at}>{dateLabel(entry.at)}</time></div>
          <p className="break-words whitespace-pre-wrap font-medium">{entry.title}</p>
          {entry.detail ? <p className="break-words whitespace-pre-wrap text-rf-ink-muted">{entry.detail}</p> : null}
          <p className="text-rf-ink-muted text-[11px]">{entry.status === 'Completed' ? `Completed by ${entry.actorName}` : entry.actorName}{entry.dueAt ? ` · Due ${dateLabel(entry.dueAt)}` : ''}</p>
          {canEdit && entry.canComplete && <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => void complete(entry.id)} disabled={busy}>Mark done</Button>
            {rescheduleId === entry.id ? <>
              <input aria-label="New follow-up date and time" type="datetime-local" value={rescheduleDueAt} onChange={(event) => setRescheduleDueAt(event.target.value)} disabled={busy} className="rounded-lg border border-rf-border bg-rf-surface px-2 py-1 text-xs" />
              <Button size="sm" onClick={() => void reschedule(entry.id)} disabled={busy || !rescheduleDueAt}>Save date</Button>
              <Button size="sm" variant="ghost" onClick={() => { setRescheduleId(null); setRescheduleDueAt(''); }} disabled={busy}>Cancel</Button>
            </> : <Button size="sm" variant="ghost" onClick={() => setRescheduleId(entry.id)} disabled={busy}>Reschedule</Button>}
          </div>}
        </li>)}</ol>}
        {data.totalEntries > data.pageSize && <div className="flex gap-3 items-center text-xs"><Button variant="secondary" size="sm" disabled={page === 1 || busy} onClick={() => setPage(page - 1)}>Previous activities</Button><span>Page {page} of {Math.ceil(data.totalEntries / data.pageSize)}</span><Button variant="secondary" size="sm" disabled={page * data.pageSize >= data.totalEntries || busy} onClick={() => setPage(page + 1)}>Next activities</Button></div>}
      </>}
      {canEdit && <form onSubmit={save} className="space-y-2.5 border-t border-rf-border-subtle pt-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs min-w-0 font-medium">Activity type<select className="block w-full rounded-lg border border-rf-border bg-rf-surface px-2.5 py-1.5 mt-1 text-xs" value={kind} onChange={(event) => setKind(event.target.value as CandidateActivityKind)} disabled={busy}>{kinds.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className="text-xs min-w-0 font-medium">When<select className="block w-full rounded-lg border border-rf-border bg-rf-surface px-2.5 py-1.5 mt-1 text-xs" value={scheduled ? 'planned' : 'done'} onChange={(event) => setScheduled(event.target.value === 'planned')} disabled={busy}><option value="done">Already done</option><option value="planned">Plan a follow-up</option></select></label>
        </div>
        <label className="block text-xs font-medium">{kind === 'Call' ? 'Call outcome / summary' : 'Activity summary'}<textarea required maxLength={255} rows={2} className="mt-1 block w-full rounded-lg border border-rf-border bg-rf-surface p-2 text-xs" placeholder="What happened, and what is the next step?" value={summary} onChange={(event) => setSummary(event.target.value)} disabled={busy} /></label>
        {scheduled && <label className="block text-xs font-medium">Follow-up date and time (your local time)<input required type="datetime-local" className="mt-1 block w-full rounded-lg border border-rf-border bg-rf-surface px-2.5 py-1.5 text-xs" value={dueAt} onChange={(event) => setDueAt(event.target.value)} disabled={busy} /></label>}
        {!scheduled && <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="block text-xs font-medium">Next follow-up date & time (after completed call)<input type="datetime-local" className="mt-1 block w-full rounded-lg border border-rf-border bg-rf-surface px-2 py-1.5 text-xs" value={followUpDueAt} onChange={(event) => setFollowUpDueAt(event.target.value)} disabled={busy} /></label>
          <label className="block text-xs font-medium">Next follow-up note<input type="text" maxLength={2000} className="mt-1 block w-full rounded-lg border border-rf-border bg-rf-surface px-2 py-1.5 text-xs" placeholder="Optional note" value={followUpSummary} onChange={(event) => setFollowUpSummary(event.target.value)} disabled={busy} /></label>
        </div>}
        {kind === 'Email' && <p className="text-xs text-rf-ink-muted">This records an email you already sent. It does not send email.</p>}
        <Button type="submit" variant="primary" size="sm" disabled={busy || !summary.trim()}>{busy ? 'Saving…' : scheduled ? 'Schedule follow-up' : 'Log completed activity'}</Button>
      </form>}
      <footer className="pt-2.5 border-t border-rf-border-subtle space-y-1 text-[11px] leading-relaxed text-rf-ink-muted">
        <p>{contextLabel}</p>
        <p>Calls, notes, interviews, and follow-ups for this person. Scheduled follow-up stays open and is not counted as completed contact.</p>
        <p>Timezone: local browser time ({timeZone}), saved as UTC ISO-8601. Application file dates display in Africa/Cairo.</p>
      </footer>
    </section>
  );
}
