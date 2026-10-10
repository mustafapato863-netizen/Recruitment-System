import { useEffect, useState } from 'react';
import { Info, Pause, Play, XCircle } from 'lucide-react';
import { ButtonV2, DrawerV2, SelectV2, SkeletonV2, StatusChip, TextareaV2 } from '../../components/v2';
import { changeJobStatus, errorMessage, jobActions, jobErrorFromError, jobStatusHistory, jobTitle, type JobAction, type JobDetail, type JobStatusHistoryItem } from '../api/jobs';
import { STATUS_LABEL, STATUS_TONE, formatDay } from '../pages/OpenJobsV2';

const PRESETS: Record<JobAction, string[]> = {
  hold: ['Hiring manager unavailable — interviews paused', 'Budget review', 'Role being redefined'],
  reopen: ['Hiring manager back', 'Budget confirmed', 'Role confirmed'],
  close: ['Position no longer needed', 'Filled internally', 'Budget withdrawn'],
};
const LABEL: Record<JobAction, string> = { hold: 'Put on hold', reopen: 'Reopen job', close: 'Close job' };
const EFFECT: Record<JobAction, string> = {
  hold: 'Hold lives on the job: files stay in their stages. A held job takes no new application and is off My Work.',
  reopen: 'Reopen returns the job to Open (or Partially filled if seats are already filled).',
  close: 'Closing is final: a closed job cannot be reopened. Files stay as they are; reject open files with a reason from each file.',
};

/** E12 Hold / Reopen / Close (B3). Reason required (≥ 3 characters, JobStatusReasonDto). Shows the job's status history. */
export function JobStatusDrawer({ job, onClose, onDone }: { job: JobDetail; onClose: () => void; onDone: () => void }) {
  const allowed = jobActions(job.status);
  const [action, setAction] = useState<JobAction | undefined>(allowed[0]);
  const [preset, setPreset] = useState('');
  const [note, setNote] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const [err, setErr] = useState<{ field?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<JobStatusHistoryItem[] | null>(null);
  useEffect(() => { void jobStatusHistory(job.id).then(setHistory).catch(() => setHistory([])); }, [job.id]);

  const reason = [preset, note.trim()].filter(Boolean).join(' — ');
  const submit = async () => {
    if (!action) return;
    if (reason.trim().length < 3) { setErr({ field: 'A reason is required (at least 3 characters).' }); return; }
    if (action === 'close' && !confirmClose) { setErr({ form: 'Confirm that closing is final.' }); return; }
    setErr({}); setBusy(true);
    try { await changeJobStatus(job.id, action, reason); onDone(); }
    catch (e) {
      const d = jobErrorFromError(e);
      setErr(d?.code === 'REASON_REQUIRED' ? { field: d.message } : { form: errorMessage(e, 'Could not change the job status.') });
    } finally { setBusy(false); }
  };

  return (
    <DrawerV2 open onClose={onClose} kicker={`Job status · ${jobTitle(job)}`} title={job.status === 'On Hold' ? 'Reopen this job' : 'Hold or close this job'}
      confirmClose={() => !note.trim() || window.confirm('Discard this change?')}
      primaryAction={action ? <ButtonV2 kind={action === 'close' ? 'danger' : 'primary'} icon={action === 'hold' ? <Pause /> : action === 'reopen' ? <Play /> : <XCircle />} loading={busy} onClick={() => void submit()}>{LABEL[action]}</ButtonV2> : undefined}
      secondaryAction={<ButtonV2 kind="secondary" onClick={onClose}>Cancel</ButtonV2>}>
      <div className="rf2-drawer-form">
        <div className="rf2-row-between"><span className="rf2-field__label">Current status</span><StatusChip tone={STATUS_TONE[job.status]} label={STATUS_LABEL[job.status]} /></div>
        {allowed.length === 0 ? <p className="rf2-inline-note"><Info aria-hidden="true" /> A closed job is final and cannot be reopened. A cancelled requisition cannot be activated again.</p> : (
          <>
            <div className="rf2-seg" role="radiogroup" aria-label="Action">
              {allowed.map((a) => (
                <button key={a} type="button" role="radio" aria-checked={action === a} className="rf2-seg__opt" onClick={() => { setAction(a); setPreset(''); }}>{LABEL[a]}</button>
              ))}
            </div>
            {action ? (
              <>
                <SelectV2 label="Reason" required value={preset} onChange={(e) => setPreset(e.target.value)}>
                  <option value="">Choose a reason (or write one below)</option>
                  {PRESETS[action].map((p) => <option key={p} value={p}>{p}</option>)}
                </SelectV2>
                <TextareaV2 label="Note for the job history" rows={3} value={note} onChange={(e) => setNote(e.target.value)} error={err.field}
                  hint="Saved with the status change. Required if you don't pick a reason." />
                <p className="rf2-inline-note"><Info aria-hidden="true" /> {EFFECT[action]}</p>
                {action === 'close' ? (
                  <label className="rf2-check"><input type="checkbox" checked={confirmClose} onChange={(e) => setConfirmClose(e.target.checked)} /> I understand closing is final.</label>
                ) : null}
              </>
            ) : null}
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
