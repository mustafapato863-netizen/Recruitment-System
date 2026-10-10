import { useMemo, useState } from 'react';
import { ArrowLeftRight, Info } from 'lucide-react';
import { ButtonV2, DrawerV2, initials, SelectV2, TextareaV2 } from '../../components/v2';
import { reassignError, reassignFiles, type ReassignBody, type ReportWork } from '../api/teamWork';

type Mode = 'file' | 'job' | 'all';
type Errs = Partial<Record<'what' | 'to' | 'reason' | 'form', string>>;

/** M06 Reassign: one file, a whole job (that report's open files on it) or all their open files → a new primary recruiter, with a reason (B7). */
export function ReassignDrawer({ from, reports, fileId, managerName, onClose, onDone }: {
  from: ReportWork; reports: ReportWork[]; fileId?: string | null; managerName: string; onClose: () => void; onDone: (message: string) => void;
}) {
  const jobs = useMemo(() => {
    const m = new Map<string, { id: string; label: string; n: number }>();
    for (const f of from.files) { const j = m.get(f.vacancyId) ?? { id: f.vacancyId, label: [f.job, f.site].filter(Boolean).join(' · '), n: 0 }; j.n++; m.set(f.vacancyId, j); }
    return [...m.values()];
  }, [from.files]);
  const [mode, setMode] = useState<Mode>(fileId ? 'file' : jobs.length === 1 ? 'job' : 'file');
  const [file, setFile] = useState(fileId ?? from.files[0]?.id ?? '');
  const [job, setJob] = useState(jobs[0]?.id ?? '');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Errs>({});
  const targets = reports.filter((r) => r.person.id !== from.person.id);
  const toName = targets.find((t) => t.person.id === to)?.person.name;
  const ids = mode === 'file' ? (file ? [file] : []) : mode === 'job' ? from.files.filter((f) => f.vacancyId === job).map((f) => f.id) : from.files.map((f) => f.id);
  const what = mode === 'file' ? from.files.find((f) => f.id === file) : null;
  const title = mode === 'file' ? `Reassign ${what?.candidate ?? 'a file'}` : mode === 'job' ? `Reassign ${jobs.find((j) => j.id === job)?.label.split(' · ')[0] ?? 'a job'}` : `Reassign ${from.person.name}’s files`;

  const submit = async () => {
    const e: Errs = {};
    if (!ids.length) e.what = 'Nothing to move.';
    if (!to) e.to = 'Pick the new primary recruiter.';
    if (reason.trim().length < 3) e.reason = 'A reason is required (at least 3 characters).';
    setErrs(e); if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const body: ReassignBody = mode === 'all' ? { fromUserId: from.person.id, toUserId: to, reason: reason.trim() } : { applicationIds: ids, toUserId: to, reason: reason.trim() };
      const r = await reassignFiles(body);
      const n = r?.moved?.length ?? ids.length;
      const left = r?.unchanged?.length ?? 0;
      onDone(`${n} ${n === 1 ? 'file' : 'files'} moved from ${from.person.name} to ${toName ?? 'the new owner'}.${left ? ` ${left} already belonged to them.` : ''}`);
    } catch (x) { const r = reassignError(x); setErrs(r.field ? { [r.field]: r.text } : { form: r.text }); } finally { setBusy(false); }
  };

  return (
    <DrawerV2 open onClose={onClose} kicker="Reassign · primary recruiter" title={title}
      primaryAction={<ButtonV2 icon={<ArrowLeftRight />} loading={busy} disabled={busy || !from.files.length} onClick={() => void submit()}>Reassign</ButtonV2>}
      secondaryAction={<ButtonV2 kind="secondary" onClick={onClose}>Cancel</ButtonV2>}
      confirmClose={() => !reason.trim() || window.confirm('Discard this reassignment?')}>
      <div className="rf2-drawer-form rf2-reassign">
        {errs.form ? <p className="rf2-form-error" role="alert">{errs.form}</p> : null}
        <div className="rf2-field">
          <p className="rf2-field__label" id="ra-what">What to reassign</p>
          <div className="rf2-segmented" role="group" aria-labelledby="ra-what">
            <ButtonV2 kind="secondary" size="sm" selected={mode === 'file'} onClick={() => { setMode('file'); setErrs({}); }}>One file</ButtonV2>
            <ButtonV2 kind="secondary" size="sm" selected={mode === 'job'} onClick={() => { setMode('job'); setErrs({}); }}>Whole job</ButtonV2>
            <ButtonV2 kind="secondary" size="sm" selected={mode === 'all'} onClick={() => { setMode('all'); setErrs({}); }}>All their files</ButtonV2>
          </div>
        </div>
        {!from.files.length ? <p className="rf2-inline-note"><Info aria-hidden="true" /> {from.person.name} has no open files to move.</p> : null}
        {mode === 'file' && from.files.length ? (
          <SelectV2 label="File" required value={file} onChange={(e) => { setFile(e.target.value); setErrs({}); }} error={errs.what}>
            {from.files.map((f) => <option key={f.id} value={f.id}>{f.candidate} — {f.job} · {f.stage}</option>)}
          </SelectV2>
        ) : null}
        {mode === 'job' && jobs.length ? (
          <SelectV2 label="Job" required value={job} onChange={(e) => { setJob(e.target.value); setErrs({}); }} error={errs.what}>
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}
          </SelectV2>
        ) : null}
        {mode === 'all' && errs.what ? <p className="rf2-form-error" role="alert">{errs.what}</p> : null}
        <div className="rf2-reassign__owner">
          <span className="rf2-jtable__sub">Current owner</span>
          <span className="rf2-avatar" aria-hidden="true">{initials(from.person.name)}</span>
          <span className="rf2-jtable__name">{from.person.name}</span>
        </div>
        <SelectV2 label="New primary recruiter" required value={to} onChange={(e) => { setTo(e.target.value); setErrs({}); }} error={errs.to} hint="Only your direct reports can be picked.">
          <option value="">Choose a person</option>
          {targets.map((t) => <option key={t.person.id} value={t.person.id}>{t.person.name}{t.person.detail ? ` — ${t.person.detail}` : ''} · {t.open} open</option>)}
        </SelectV2>
        <TextareaV2 label="Reason" required rows={2} value={reason} onChange={(e) => { setReason(e.target.value); setErrs({}); }} error={errs.reason} placeholder={`Balance load — ${from.person.name.split(' ')[0]} is focused elsewhere`} />
        {ids.length ? (
          <p className="rf2-inline-note" role="note"><Info aria-hidden="true" /> {ids.length} open {ids.length === 1 ? 'file moves' : 'files move'} to {toName ?? 'the new owner'}’s Open jobs and My Work. Each file’s history records “Owner changed from {from.person.name} to {toName ?? '…'} by {managerName}”. {mode === 'job' ? 'The job’s own owner is not changed (files only).' : ''} Closed files never move; it is all or nothing.</p>
        ) : null}
      </div>
    </DrawerV2>
  );
}
