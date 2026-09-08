import { useCallback, useEffect, useRef, useState } from 'react';
import type { CandidateActivityKind, CandidateActivitySummary } from '@recruitflow/contracts';
import { getApi, patchApi, postApi } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../ui/Button';

const kinds: CandidateActivityKind[] = ['Call', 'Note', 'Email', 'Meeting', 'Document Verification', 'Offer Follow-up'];
const dateLabel = (value: string | null) => value ? new Date(value).toLocaleString() : 'None recorded';

interface CandidateActivityPanelProps {
  candidateId: string;
  refreshKey?: number;
  initialKind?: CandidateActivityKind;
  initialScheduled?: boolean;
}

export function CandidateActivityPanel({ candidateId, refreshKey = 0, initialKind, initialScheduled }: CandidateActivityPanelProps) {
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
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleDueAt, setRescheduleDueAt] = useState('');
  const requestVersion = useRef(0);
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
    if (busy || !summary.trim()) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      await postApi(`/candidates/${candidateId}/activities`, { kind, summary: summary.trim(), ...(scheduled ? { dueAt: new Date(dueAt).toISOString() } : {}) });
      setSummary(''); setDueAt('');
      setNotice(scheduled ? 'Follow-up saved. Mark it done after completing the work.' : 'Activity saved.');
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
      await patchApi(`/candidates/${candidateId}/activities/${id.replace('task:', '')}/reschedule`, { dueAt: new Date(rescheduleDueAt).toISOString() });
      setRescheduleId(null); setRescheduleDueAt(''); setNotice('Follow-up rescheduled.');
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to reschedule follow-up'); }
    finally { setBusy(false); }
  };

  if (!canView) return <p className="text-xs text-rf-ink-muted">Candidate activity access is not enabled for your role.</p>;

  return (
    <section aria-label="Candidate activity" className="rounded-xl border border-rf-border bg-rf-surface p-4 space-y-4 text-rf-ink">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold">Candidate activity</h2>
        <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading || busy}>Refresh activities</Button>
      </div>
      <p className="text-xs text-rf-ink-muted">Recorded work across this candidate’s accessible applications. Calls, notes and screenings count once per saved record. Scheduled interviews and stage changes are timeline events, not completed work. Shared candidate activities are visible to the team; other tasks remain private to their assignee.</p>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      {notice && <p role="status" className="text-sm text-rf-ink">{notice}</p>}
      {loading && <p role="status" className="text-xs text-rf-ink-muted">Loading activities…</p>}
      {data && !loading && <>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {([['Completed', data.completed], ['By me', data.completedByMe], ['Follow-ups open', data.pending], ['Overdue', data.overdue]] as const).map(([label, value]) => <div key={label} className="rounded-lg bg-rf-surface-subtle p-3"><dt className="text-xs text-rf-ink-muted">{label}</dt><dd className="text-xl font-bold">{value}</dd></div>)}
        </dl>
        <div className="text-xs space-y-1"><p>Last completed activity: {dateLabel(data.lastActivityAt)}</p><p>Next follow-up: {dateLabel(data.nextFollowUpAt)}</p></div>
        <div className="flex flex-wrap gap-2 text-xs" aria-label="Completed activity breakdown">{Object.entries(data.byKind).map(([label, value]) => <span className="rounded-lg border border-rf-border px-2 py-1" key={label}>{label}: {value}</span>)}</div>
        {data.byRecruiter.length > 0 && <details className="text-xs"><summary className="cursor-pointer font-semibold">Completed by recruiter</summary><ul className="mt-2 space-y-1">{data.byRecruiter.map((row) => <li key={row.userId}>{row.name}: {row.completed}</li>)}</ul></details>}
      </>}
      {canEdit && <form onSubmit={save} className="space-y-3 border-t border-rf-border pt-3">
        <div className="flex flex-wrap gap-2">
          <label className="text-xs flex-1 min-w-32">Activity type<select className="block w-full rounded-lg border border-rf-border bg-rf-surface p-2 mt-1" value={kind} onChange={(event) => setKind(event.target.value as CandidateActivityKind)} disabled={busy}>{kinds.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className="text-xs flex-1 min-w-32">When<select className="block w-full rounded-lg border border-rf-border bg-rf-surface p-2 mt-1" value={scheduled ? 'planned' : 'done'} onChange={(event) => setScheduled(event.target.value === 'planned')} disabled={busy}><option value="done">Already done</option><option value="planned">Plan a follow-up</option></select></label>
        </div>
        <label className="block text-xs">{kind === 'Call' ? 'Call outcome / summary' : 'Activity summary'}<textarea required maxLength={255} rows={2} className="mt-1 block w-full rounded-lg border border-rf-border bg-rf-surface p-2" placeholder="What happened, and what is the next step?" value={summary} onChange={(event) => setSummary(event.target.value)} disabled={busy} /></label>
        {scheduled && <label className="block text-xs">Follow-up date and time (your local time)<input required type="datetime-local" className="mt-1 block w-full rounded-lg border border-rf-border bg-rf-surface p-2" value={dueAt} onChange={(event) => setDueAt(event.target.value)} disabled={busy} /></label>}
        {kind === 'Email' && <p className="text-xs text-rf-ink-muted">This records an email you already sent. It does not send email.</p>}
        <Button type="submit" size="sm" disabled={busy || !summary.trim()}>{busy ? 'Saving…' : scheduled ? 'Save follow-up' : 'Log completed activity'}</Button>
      </form>}
      {data && !loading && <>
        <h3 className="text-xs font-bold">Timeline ({data.totalEntries})</h3>
        {data.entries.length === 0 ? <p className="text-sm text-rf-ink-muted">No activities recorded yet.</p> : <ol className="space-y-2">{data.entries.map((entry) => <li key={entry.id} className="rounded-lg border border-rf-border p-3 text-xs space-y-1">
          <div className="flex flex-wrap justify-between gap-2"><strong>{entry.kind} · {entry.status}</strong><time dateTime={entry.at}>{dateLabel(entry.at)}</time></div>
          <p className="break-words whitespace-pre-wrap">{entry.title}</p><p className="text-rf-ink-muted">{entry.actorName}{entry.dueAt ? ` · Due ${dateLabel(entry.dueAt)}` : ''}</p>
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
    </section>
  );
}
