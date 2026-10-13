import { useEffect, useState } from 'react';
import { Info, Pause, Play } from 'lucide-react';
import { ButtonV2, DangerConfirmButton, DrawerV2, InputV2, SelectV2, SkeletonV2, StatusChip, TextareaV2 } from '../../components/v2';
import {
  OTHER_REASON, cairoToday, changeJobStatus, errorMessage, jobActions, jobErrorFromError, jobReasons, jobStatusHistory, jobTitle,
  type JobAction, type JobDetail, type JobStatusHistoryItem,
} from '../api/jobs';
import { bannerError, fieldError, serverFormErrors } from '../forms/serverErrors';
import { STATUS_LABEL, STATUS_TONE, formatDay } from '../pages/OpenJobsV2';

const EFFECT: Record<JobAction, string> = {
  hold: 'Hold pauses new applications. Files stay in their stages. Scheduled interviews, sent offers, and joining commitments stay on My Work. Nothing reopens the job automatically.',
  reopen: 'Reopen returns the job to Open (or Partially filled if seats are already filled).',
  close: 'Close job is final: a closed job cannot be reopened. Click it, then confirm.',
};
const ACTION_LABEL: Record<JobAction, string> = { hold: 'Put on hold', reopen: 'Reopen job', close: 'Close job' };

type Errs = { reason?: string; note?: string; holdUntil?: string; form?: string };

/**
 * E12 (B3 @2e2fc7d). Choose the change: Put on hold / Reopen (primary) or Close job (secondary danger, click then confirm).
 * Hold and close reasons come only from master data ('hold-reasons' / 'close-reasons', active values); "Other" needs a note.
 * Hold takes an optional "Hold until" (a future Cairo day). Reopen takes a free-text reason.
 */
export function JobStatusDrawer({ job, initial, onClose, onDone }: { job: JobDetail; initial?: JobAction; onClose: () => void; onDone: () => void }) {
  const allowed = jobActions(job.status);
  const [action, setAction] = useState<JobAction | null>(initial && allowed.includes(initial) ? initial : allowed[0] ?? null);
  const [lists, setLists] = useState<Partial<Record<'hold' | 'close', string[] | 'error'>>>({});
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [holdUntil, setHoldUntil] = useState('');
  const [err, setErr] = useState<Errs>({});
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<JobStatusHistoryItem[] | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => { void jobStatusHistory(job.id).then(setHistory).catch(() => setHistory([])); }, [job.id]);
  useEffect(() => {
    for (const a of ['hold', 'close'] as const) {
      if (allowed.includes(a)) void jobReasons(a).then((r) => setLists((l) => ({ ...l, [a]: r }))).catch(() => setLists((l) => ({ ...l, [a]: 'error' })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.status, reload]);

  const listAction = action === 'hold' || action === 'close' ? action : null;
  const list = listAction ? lists[listAction] : undefined;
  const isOther = reason.toLowerCase() === OTHER_REASON.toLowerCase();
  const tomorrow = (() => { const d = new Date(`${cairoToday()}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); })();

  const pick = (a: JobAction) => { setAction(a); setReason(''); setNote(''); setErr({}); if (a !== 'hold') setHoldUntil(''); };
  const submit = async () => {
    if (!action) return;
    const next: Errs = {};
    if (action === 'reopen') { if (note.trim().length < 3) next.note = 'Write why you are reopening (at least 3 characters).'; }
    else {
      if (!reason) next.reason = 'Pick a reason from the list.';
      if (isOther && note.trim().length < 3) next.note = '"Other" needs a short note.';
      if (action === 'hold' && holdUntil && holdUntil <= cairoToday()) next.holdUntil = 'Pick a day after today (Cairo).';
    }
    setErr(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await changeJobStatus(job.id, action, action === 'reopen' ? { reason: note } : { reason, note, ...(action === 'hold' && holdUntil ? { holdUntil } : {}) });
      onDone();
    } catch (e) {
      const d = jobErrorFromError(e);
      if (d?.code === 'REASON_NOT_IN_LIST') { setErr({ reason: d.message }); setReason(''); setReload((n) => n + 1); }
      else if (d?.code === 'REASON_REQUIRED') setErr(action === 'reopen' || isOther ? { note: d.message } : { reason: d.message });
      else if (d?.code === 'HOLD_UNTIL_NOT_FUTURE') setErr({ holdUntil: 'Pick a day after today (Cairo).' });
      else {
        // #23: a 400's field/fields go on the matching inputs (reason, note, holdUntil); the rest stays in the banner.
        const f = serverFormErrors(e);
        const inline = { reason: fieldError(f, 'reason'), note: fieldError(f, 'note'), holdUntil: fieldError(f, 'holdUntil') };
        const banner = Object.keys(f.byField).length ? bannerError(f, ['reason', 'note', 'holdUntil']) : errorMessage(e, 'Could not change the job status.');
        // Reopen sends its free text as `reason`, typed in the note box.
        setErr({ ...inline, ...(action === 'reopen' && inline.reason ? { reason: undefined, note: inline.reason } : {}), ...(banner ? { form: banner } : {}) });
      }
    } finally { setBusy(false); }
  };
  const primary = action === 'hold' || action === 'reopen' ? action : null;

  return (
    <DrawerV2 open onClose={onClose} kicker={`Job status · ${jobTitle(job)}`} title={allowed.includes('reopen') ? 'Reopen or close this job' : 'Hold or close this job'}
      confirmClose={() => !note.trim() || window.confirm('Discard this change?')}
      primaryAction={primary ? <ButtonV2 icon={primary === 'hold' ? <Pause /> : <Play />} loading={busy} onClick={() => void submit()}>{ACTION_LABEL[primary]}</ButtonV2> : undefined}
      secondaryAction={<>
        <ButtonV2 kind="secondary" onClick={onClose}>Cancel</ButtonV2>
        {action === 'close' ? <DangerConfirmButton confirmLabel="Confirm close — final" loading={busy} onConfirm={() => void submit()}>Close job</DangerConfirmButton> : null}
      </>}>
      <div className="rf2-drawer-form rf2-jstatus">
        <div className="rf2-row-between"><span className="rf2-field__label">Current status</span><StatusChip tone={STATUS_TONE[job.status]} label={STATUS_LABEL[job.status]} /></div>
        {job.status === 'On Hold' && job.holdUntil ? <p className="rf2-jtable__sub">On hold until {formatDay(`${job.holdUntil}T12:00:00Z`)}.</p> : null}
        {allowed.length === 0 ? <p className="rf2-inline-note"><Info aria-hidden="true" /> A closed job is final and cannot be reopened. A cancelled requisition cannot be activated again.</p> : (
          <>
            <fieldset className="rf2-choices">
              <legend className="rf2-field__label">Change</legend>
              {allowed.map((a) => (
                <label key={a} className="rf2-choice"><input type="radio" name="job-action" value={a} checked={action === a} onChange={() => pick(a)} /><span><strong>{ACTION_LABEL[a]}</strong></span></label>
              ))}
            </fieldset>
            {listAction ? (
              list === 'error' || (Array.isArray(list) && list.length === 0)
                ? <p className="rf2-form-error" role="alert">No {listAction} reasons are set up. Ask an administrator to add them in Master data ({listAction === 'hold' ? 'Hold reasons' : 'Close reasons'}).</p>
                : <SelectV2 label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} error={err.reason} disabled={!list}>
                    <option value="">{list ? 'Choose a reason' : 'Loading…'}</option>
                    {(list ?? []).map((p) => <option key={p} value={p}>{p}</option>)}
                  </SelectV2>
            ) : null}
            {action === 'hold' ? (
              <InputV2 label="Hold until (optional)" type="date" min={tomorrow} value={holdUntil} onChange={(e) => setHoldUntil(e.target.value)} error={err.holdUntil}
                hint="A future day. It is a reminder only: the job does not reopen by itself." />
            ) : null}
            <TextareaV2 label={action === 'reopen' ? 'Reason' : isOther ? 'Note' : 'Note (optional)'} required={action === 'reopen' || isOther} rows={3} value={note}
              onChange={(e) => setNote(e.target.value)} error={err.note}
              hint={action === 'reopen' ? 'Saved in the job history.' : isOther ? 'Required for "Other". Saved as "Other: your note".' : 'Saved with the reason in the job history.'} />
            {action ? <p className={action === 'close' ? 'rf2-jtable__sub' : 'rf2-inline-note'}>{action === 'close' ? null : <Info aria-hidden="true" />} {EFFECT[action]}</p> : null}
          </>
        )}
        {err.form ? <p className="rf2-form-error" role="alert">{err.form}</p> : null}
        <section aria-labelledby="job-hist-h" className="rf2-history">
          <h3 id="job-hist-h" className="rf2-field__label">Job history</h3>
          {history === null ? <SkeletonV2 lines={2} label="Loading history…" /> : history.length === 0 ? <p className="rf2-jtable__sub">No status changes yet.</p> : (
            <ol className="rf2-history__list">
              {[...history].reverse().map((h) => (
                <li key={h.id}><time dateTime={h.createdAt}>{formatDay(h.createdAt)}</time> <span>{h.fromStatus ? `${h.fromStatus} → ` : ''}{h.toStatus}</span>
                  {h.reason ? <span className="rf2-jtable__sub"> · {h.reason}</span> : null}
                  {h.holdUntil ? <span className="rf2-jtable__sub"> · until {formatDay(`${h.holdUntil.slice(0, 10)}T12:00:00Z`)}</span> : null}</li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </DrawerV2>
  );
}
