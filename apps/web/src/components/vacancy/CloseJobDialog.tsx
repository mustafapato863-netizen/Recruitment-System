import { useEffect, useState, type FormEvent } from 'react';
import { deleteApi, getApi } from '../../api/client';
import { Modal } from '../Modal';
import { Button } from '../ui/Button';

/**
 * #23 603d44d (B2R-2/3): DELETE /vacancies/:id closes the job and takes DeleteVacancyDto {reason, note?}:
 * a close-reasons list value, plus a note for "Other". Always sent (owners and admins; required for admins).
 * Codes: 403 JOB_NOT_OWNED, 409 JOB_HAS_OPEN_APPLICATIONS {counts}, 400 REASON_REQUIRED / REASON_NOT_IN_LIST.
 */
export function closeJobError(e: unknown): { field?: 'reason' | 'note'; text: string } {
  const x = e as { code?: string; field?: string; message?: string; counts?: { openApplications?: number }; details?: { code?: string; field?: string; counts?: { openApplications?: number } } } | null;
  const code = x?.code ?? x?.details?.code;
  const field = x?.field ?? x?.details?.field;
  if (code === 'JOB_NOT_OWNED') return { text: 'Only the job owner or their manager can close this job.' };
  if (code === 'JOB_HAS_OPEN_APPLICATIONS') {
    const n = x?.counts?.openApplications ?? x?.details?.counts?.openApplications;
    return { text: typeof n === 'number' ? `This job still has ${n} open file${n === 1 ? '' : 's'}. Close or move them first.` : x?.message || 'This job still has open files.' };
  }
  if (code === 'REASON_REQUIRED') return { field: field === 'reason' ? 'reason' : 'note', text: x?.message || 'A reason is required.' };
  if (code === 'REASON_NOT_IN_LIST') return { field: 'reason', text: 'Pick a reason from the Close reasons list.' };
  return { text: x?.message || 'Could not close the job.' };
}

export function CloseJobDialog({ isOpen, jobId, onClose, onClosed }: { isOpen: boolean; jobId: string; onClose: () => void; onClosed: () => void }) {
  const [reasons, setReasons] = useState<string[] | null>(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<{ field?: 'reason' | 'note'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!isOpen) return;
    let live = true;
    getApi<Array<{ name?: string; status?: string }> | { data: Array<{ name?: string; status?: string }> }>('/master-data/catalog/close-reasons')
      .then((r) => { const rows = Array.isArray(r) ? r : r?.data ?? []; if (live) setReasons(rows.filter((x) => x.name && (x.status ?? 'Active') === 'Active').map((x) => x.name!)); })
      .catch(() => live && setReasons([]));
    return () => { live = false; };
  }, [isOpen]);
  const isOther = /^other$/i.test(reason);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return setErr({ field: 'reason', text: 'Pick a close reason.' });
    if (isOther && note.trim().length < 3) return setErr({ field: 'note', text: '"Other" needs a short note (at least 3 characters).' });
    setBusy(true); setErr(null);
    try { await deleteApi(`/vacancies/${encodeURIComponent(jobId)}`, { reason: reason.trim(), ...(isOther ? { note: note.trim() } : {}) }); onClosed(); }
    catch (x) { setErr(closeJobError(x)); } finally { setBusy(false); }
  };
  return (
    <Modal isOpen={isOpen} onClose={() => !busy && onClose()} title="Close this job?" maxWidthClass="max-w-md">
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
        <p className="text-xs text-rf-ink-muted m-0">The job closes and leaves the open lists. Jobs with open files cannot be closed.</p>
        <label className="text-xs font-bold text-rf-ink">Close reason
          {reasons && reasons.length ? (
            <select className="mt-1 w-full rounded-lg border px-2 py-1.5" value={reason} onChange={(e) => { setReason(e.target.value); setErr(null); }} aria-invalid={err?.field === 'reason' || undefined}>
              <option value="">Choose a reason</option>
              {reasons.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          ) : (
            <input className="mt-1 w-full rounded-lg border px-2 py-1.5" value={reason} onChange={(e) => { setReason(e.target.value); setErr(null); }} aria-invalid={err?.field === 'reason' || undefined} />
          )}
        </label>
        {err?.field === 'reason' ? <p className="text-xs text-rf-danger m-0" role="alert">{err.text}</p> : null}
        {isOther ? (
          <label className="text-xs font-bold text-rf-ink">Say why
            <textarea className="mt-1 w-full rounded-lg border px-2 py-1.5" rows={2} value={note} onChange={(e) => { setNote(e.target.value); setErr(null); }} aria-invalid={err?.field === 'note' || undefined} />
          </label>
        ) : null}
        {err?.field === 'note' ? <p className="text-xs text-rf-danger m-0" role="alert">{err.text}</p> : null}
        {err && !err.field ? <p className="text-xs text-rf-danger m-0" role="alert">{err.text}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="danger" loading={busy}>Close job</Button>
        </div>
      </form>
    </Modal>
  );
}
