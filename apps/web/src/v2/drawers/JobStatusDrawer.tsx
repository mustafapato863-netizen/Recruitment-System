import { useEffect, useState } from 'react';
import { Info, Pause, Play } from 'lucide-react';
import { ButtonV2, DangerConfirmButton, DrawerV2, SelectV2, SkeletonV2, StatusChip, TextareaV2 } from '../../components/v2';
import { changeJobStatus, errorMessage, jobActions, jobErrorFromError, jobReasonPresets, jobStatusHistory, jobTitle, type JobAction, type JobDetail, type JobStatusHistoryItem } from '../api/jobs';
import { STATUS_LABEL, STATUS_TONE, formatDay } from '../pages/OpenJobsV2';

const EFFECT: Record<'hold' | 'reopen', string> = {
  hold: 'Hold lives on the job: files stay in their stages. A held job takes no new application and is off My Work.',
  reopen: 'Reopen returns the job to Open (or Partially filled if seats are already filled).',
};

/**
 * E12 (B3). ONE primary: Put on hold (from Open/Partially filled) or Reopen (from On hold).
 * Close is a secondary danger-outline action (F2 DangerConfirmButton: click, then confirm). Reason required (≥ 3 chars).
 */
export function JobStatusDrawer({ job, onClose, onDone }: { job: JobDetail; onClose: () => void; onDone: () => void }) {
  const allowed = jobActions(job.status);
  const primary = (allowed.find((a) => a !== 'close') ?? null) as 'hold' | 'reopen' | null;
  const canClose = allowed.includes('close');
  const [preset, setPreset] = useState('');
  const [presets, setPresets] = useState<string[]>([]);
  const [closePresets, setClosePresets] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [err, setErr] = useState<{ field?: string; form?: string }>({});
  const [busy, setBusy] = useState<JobAction | null>(null);
  const [history, setHistory] = useState<JobStatusHistoryItem[] | null>(null);
  useEffect(() => { void jobStatusHistory(job.id).then(setHistory).catch(() => setHistory([])); }, [job.id]);
  useEffect(() => {
    if (primary) void jobReasonPresets(primary).then((r) => setPresets(r.reasons));
    if (canClose) void jobReasonPresets('close').then((r) => setClosePresets(r.reasons));
  }, [primary, canClose]);

  const reason = [preset, note.trim()].filter(Boolean).join(' — ');
  const submit = async (action: JobAction) => {
    if (reason.trim().length < 3) { setErr({ field: 'A reason is required (at least 3 characters).' }); return; }
    setErr({}); setBusy(action);
    try { await changeJobStatus(job.id, action, reason); onDone(); }
    catch (e) {
      const d = jobErrorFromError(e);
      setErr(d?.code === 'REASON_REQUIRED' ? { field: d.message } : { form: errorMessage(e, 'Could not change the job status.') });
    } finally { setBusy(null); }
  };
  const label = primary === 'reopen' ? 'Reopen job' : 'Put on hold';

  return (
    <DrawerV2 open onClose={onClose} kicker={`Job status · ${jobTitle(job)}`} title={primary === 'reopen' ? 'Reopen this job' : 'Hold or close this job'}
      confirmClose={() => !note.trim() || window.confirm('Discard this change?')}
      primaryAction={primary ? <ButtonV2 icon={primary === 'hold' ? <Pause /> : <Play />} loading={busy === primary} onClick={() => void submit(primary)}>{label}</ButtonV2> : undefined}
      secondaryAction={<>
        <ButtonV2 kind="secondary" onClick={onClose}>Cancel</ButtonV2>
        {canClose ? <DangerConfirmButton confirmLabel="Confirm close — final" loading={busy === 'close'} onConfirm={() => void submit('close')}>Close job</DangerConfirmButton> : null}
      </>}>
      <div className="rf2-drawer-form">
        <div className="rf2-row-between"><span className="rf2-field__label">Current status</span><StatusChip tone={STATUS_TONE[job.status]} label={STATUS_LABEL[job.status]} /></div>
        {allowed.length === 0 ? <p className="rf2-inline-note"><Info aria-hidden="true" /> A closed job is final and cannot be reopened. A cancelled requisition cannot be activated again.</p> : (
          <>
            <SelectV2 label="Reason" required value={preset} onChange={(e) => setPreset(e.target.value)}>
              <option value="">Choose a reason (or write one below)</option>
              {primary ? <optgroup label={label}>{presets.map((p) => <option key={p} value={p}>{p}</option>)}</optgroup> : null}
              {canClose ? <optgroup label="Close job">{closePresets.map((p) => <option key={`c-${p}`} value={p}>{p}</option>)}</optgroup> : null}
            </SelectV2>
            <TextareaV2 label="Note for the job history" rows={3} value={note} onChange={(e) => setNote(e.target.value)} error={err.field}
              hint="Saved with the status change. Required if you don't pick a reason." />
            {primary ? <p className="rf2-inline-note"><Info aria-hidden="true" /> {EFFECT[primary]}</p> : null}
            {canClose ? <p className="rf2-jtable__sub">Close job is final: a closed job cannot be reopened. Click it, then confirm.</p> : null}
          </>
        )}
        {err.form ? <p className="rf2-form-error" role="alert">{err.form}</p> : null}
        <section aria-labelledby="job-hist-h" className="rf2-history">
          <h3 id="job-hist-h" className="rf2-field__label">Job history</h3>
          {history === null ? <SkeletonV2 lines={2} label="Loading history…" /> : history.length === 0 ? <p className="rf2-jtable__sub">No status changes yet.</p> : (
            <ol className="rf2-history__list">
              {[...history].reverse().map((h) => (
                <li key={h.id}><time dateTime={h.createdAt}>{formatDay(h.createdAt)}</time> <span>{h.fromStatus ? `${h.fromStatus} → ` : ''}{h.toStatus}</span>{h.reason ? <span className="rf2-jtable__sub"> · {h.reason}</span> : null}</li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </DrawerV2>
  );
}
