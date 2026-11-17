import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Info, TriangleAlert } from 'lucide-react';
import { ButtonV2, DrawerV2, initials, SelectV2, TextareaV2 } from '../../components/v2';
import { fetchReassignReasons, reassignError, reassignFiles, type ReassignBody, type ReportWork } from '../api/teamWork';

type Mode = 'file' | 'job' | 'all';
type Errs = Partial<Record<'what' | 'to' | 'reason' | 'form', string>>;

/** M06 Reassign: moves FILES only (one file, that report's files on one job, or all their open files) to a new primary recruiter, with a reason (B7). Jobs keep their owner. `jobOnly` is the Team Work redistribution: one job's open files, with no one-file or bulk control. */
export function ReassignDrawer({ from, reports, fileId, vacancyId, managerName, jobOnly = false, onClose, onDone }: {
  from: ReportWork; reports: ReportWork[]; fileId?: string | null; vacancyId?: string | null; managerName: string; jobOnly?: boolean; onClose: () => void; onDone: (message: string) => void;
}) {
  const jobs = useMemo(() => {
    const m = new Map<string, { id: string; label: string; n: number }>();
    for (const f of from.files) { const j = m.get(f.vacancyId) ?? { id: f.vacancyId, label: [f.job, f.site].filter(Boolean).join(' · '), n: 0 }; j.n++; m.set(f.vacancyId, j); }
    return [...m.values()];
  }, [from.files]);
  const [mode, setMode] = useState<Mode>(jobOnly || (!fileId && jobs.length === 1) ? 'job' : 'file');
  const [file, setFile] = useState(fileId ?? from.files[0]?.id ?? '');
  const [job, setJob] = useState(vacancyId ? (jobs.some((item) => item.id === vacancyId) ? vacancyId : '') : jobs[0]?.id ?? '');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [reasons, setReasons] = useState<string[] | null>(null);
  const [picked, setPicked] = useState('');
  useEffect(() => { let live = true; void fetchReassignReasons().then((r) => live && setReasons(r)); return () => { live = false; }; }, []);
  const isOther = !!reasons && /^other$/i.test(picked);
  /** #21 ReassignFilesDto: the list value goes in `reason`; for "Other" the free text goes in `note` (server stores "Other: note"). */
  const finalReason = reasons ? picked : reason.trim();
  const note = isOther ? reason.trim() : '';
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Errs>({});
  const [reviewing, setReviewing] = useState(false);
  const targets = reports.filter((r) => r.person.id !== from.person.id);
  const toPerson = targets.find((t) => t.person.id === to) ?? null;
  const toName = toPerson?.person.name;
  const ids = mode === 'file' ? (file ? [file] : []) : mode === 'job' ? from.files.filter((f) => f.vacancyId === job).map((f) => f.id) : from.files.map((f) => f.id);
  const what = mode === 'file' ? from.files.find((f) => f.id === file) : null;
  const title = jobOnly ? 'Redistribute applications' : mode === 'file' ? `Reassign ${what?.candidate ?? 'a file'}` : mode === 'job' ? `Reassign files on ${jobs.find((j) => j.id === job)?.label.split(' · ')[0] ?? 'a job'}` : `Reassign ${from.person.name}’s files`;

  const problems = (): Errs => {
    const e: Errs = {};
    if (!ids.length) e.what = 'Nothing to move.';
    if (!to) e.to = 'Pick the new primary recruiter.';
    if (reasons && !picked) e.reason = 'Pick a reason.';
    else if (isOther ? note.length < 3 : finalReason.length < 3) e.reason = isOther ? 'Say why (at least 3 characters).' : 'A reason is required (at least 3 characters).';
    return e;
  };
  const affected = ids.length ? from.files.filter((f) => ids.includes(f.id)) : [];
  const openReview = () => {
    const e = problems();
    setErrs(e);
    if (Object.keys(e).length) return;
    setReviewing(true);
  };
  const submit = async () => {
    const e = problems();
    setErrs(e); if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const why = { toUserId: to, reason: finalReason, ...(note ? { note } : {}) };
      const body: ReassignBody = mode === 'all' ? { fromUserId: from.person.id, ...why } : { applicationIds: ids, ...why };
      const r = await reassignFiles(body);
      if (!Array.isArray(r?.moved) || !Array.isArray(r?.unchanged)) throw new Error('Could not confirm this reassignment. Reload team work before trying again.');
      const n = r.moved.length;
      const left = r.unchanged.length;
      onDone(`${n} ${n === 1 ? 'file' : 'files'} moved from ${from.person.name} to ${toName ?? 'the new owner'}.${left ? ` ${left} already belonged to them.` : ''}`);
    } catch (x) { const r = reassignError(x); setErrs(r.field ? { [r.field]: r.text } : { form: r.text }); } finally { setBusy(false); }
  };

  return (
    <DrawerV2 open onClose={onClose} kicker="Reassign · primary recruiter" title={title}
      primaryAction={<ButtonV2 icon={<ArrowLeftRight />} loading={busy} disabled={busy || !from.files.length} onClick={() => jobOnly && !reviewing ? openReview() : void submit()}>{jobOnly ? reviewing ? 'Confirm redistribution' : 'Review redistribution' : 'Reassign'}</ButtonV2>}
      secondaryAction={<ButtonV2 kind="secondary" disabled={busy} onClick={jobOnly && reviewing ? () => setReviewing(false) : onClose}>{jobOnly && reviewing ? 'Back' : 'Cancel'}</ButtonV2>}
      confirmClose={() => (!reason.trim() && !picked) || window.confirm('Discard this reassignment?')}>
      <div className="rf2-drawer-form rf2-reassign">
        {errs.form ? <p className="rf2-form-error" role="alert">{errs.form}</p> : null}
        {reviewing ? (
          <div data-testid="reassign-review-preview" className="rf2-reassign__review">
            <p className="rf2-jtable__name">Before / After</p>
            <p className="rf2-jtable__sub">Affected files</p>
            <p>{affected.length} {affected.length === 1 ? 'file' : 'files'}</p>
            <ul aria-label="Affected files">
              {affected.map((f) => <li key={f.id}>{f.candidate} — {f.job}</li>)}
            </ul>
            <p className="rf2-jtable__sub">Primary recruiter</p>
            <p>{from.person.name} → {toName ?? 'the new primary recruiter'}</p>
            <p className="rf2-jtable__sub">Reason: {isOther ? `Other — ${note}` : finalReason}</p>
            <p className="rf2-inline-note" data-tone="warning"><TriangleAlert aria-hidden="true" /> Job/requisition owner will not change.</p>
            <p className="rf2-inline-note"><Info aria-hidden="true" /> {jobOnly ? `These applications will appear in ${toName ?? 'the new recruiter'}’s workload.` : 'Moving files updates primary recruiter access for the selected applications.'}</p>
            {jobOnly ? null : <div className="rf2-team__decide-actions">
              <ButtonV2 kind="secondary" onClick={() => setReviewing(false)}>Back from review</ButtonV2>
              <ButtonV2 icon={<ArrowLeftRight />} loading={busy} disabled={busy} onClick={() => void submit()}>Confirm reassignment</ButtonV2>
            </div>}
          </div>
        ) : null}
        {reviewing ? null : (
          <>
            {jobOnly ? (
              <p className="rf2-jtable__sub">Move {from.person.name}’s active applications on one job to another recruiter.</p>
            ) : (
            <div className="rf2-field">
              <p className="rf2-field__label" id="ra-what">What to reassign</p>
              <div className="rf2-segmented" role="group" aria-labelledby="ra-what">
                <ButtonV2 kind="secondary" size="sm" selected={mode === 'file'} onClick={() => { setMode('file'); setErrs({}); }}>One file</ButtonV2>
                <ButtonV2 kind="secondary" size="sm" selected={mode === 'job'} onClick={() => { setMode('job'); setErrs({}); }}>All files on a job</ButtonV2>
                <ButtonV2 kind="secondary" size="sm" selected={mode === 'all'} onClick={() => { setMode('all'); setErrs({}); }}>All their files</ButtonV2>
              </div>
            </div>
            )}
            {!from.files.length ? <p className="rf2-inline-note"><Info aria-hidden="true" /> {from.person.name} has no open files to move.</p> : null}
            {mode === 'file' && from.files.length ? (
              <SelectV2 label="File" required value={file} onChange={(e) => { setFile(e.target.value); setErrs({}); }} error={errs.what}>
                {from.files.map((f) => <option key={f.id} value={f.id}>{f.candidate} — {f.job} · {f.stage}</option>)}
              </SelectV2>
            ) : null}
            {mode === 'job' && jobs.length ? (
              <SelectV2 label="Job" required value={job} onChange={(e) => { setJob(e.target.value); setErrs({}); }} error={errs.what}>
                <option value="" disabled>Choose a job</option>
                {jobs.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}
              </SelectV2>
            ) : null}
            {mode === 'all' && errs.what ? <p className="rf2-form-error" role="alert">{errs.what}</p> : null}
            <div className="rf2-reassign__owner">
              <span className="rf2-jtable__sub">Current owner</span>
              <span className="rf2-avatar" aria-hidden="true">{initials(from.person.name)}</span>
              <span className="rf2-jtable__name">{from.person.name}</span>
            </div>
            <SelectV2 label="New primary recruiter" required value={to} onChange={(e) => { setTo(e.target.value); setErrs({}); }} error={errs.to} hint="Only people in your reporting line can be picked.">
              <option value="">Choose a person</option>
              {targets.map((t) => <option key={t.person.id} value={t.person.id}>{t.person.name}{t.person.detail ? ` — ${t.person.detail}` : ''} · {t.open} open</option>)}
            </SelectV2>
            {jobOnly && toPerson ? <p className="rf2-jtable__sub">{toPerson.person.name}: {toPerson.open} active {toPerson.open === 1 ? 'application' : 'applications'} · {toPerson.overdue} overdue</p> : null}
            {reasons ? (
              <SelectV2 label="Reason" required value={picked} onChange={(e) => { setPicked(e.target.value); setErrs({}); }} error={!isOther ? errs.reason : undefined} hint="From the Reassign reasons list in Master data.">
                <option value="">Choose a reason</option>
                {reasons.map((x) => <option key={x} value={x}>{x}</option>)}
              </SelectV2>
            ) : null}
            {!reasons || isOther ? (
              <TextareaV2 label={reasons ? 'Say why' : 'Reason'} required rows={2} value={reason} onChange={(e) => { setReason(e.target.value); setErrs({}); }} error={!reasons || isOther ? errs.reason : undefined} placeholder={`Balance load — ${from.person.name.split(' ')[0]} is focused elsewhere`} />
            ) : null}
            {ids.length && !jobOnly ? (
              <p className="rf2-inline-note" role="note"><Info aria-hidden="true" /> {ids.length} open {ids.length === 1 ? 'file moves' : 'files move'} to {toName ?? 'the new owner'}’s Open jobs and My Work. Each file’s history records “Owner changed from {from.person.name} to {toName ?? '…'} by {managerName}”. Only files move: the job and its owner stay as they are. Closed files never move; it is all or nothing.</p>
            ) : null}
            {jobOnly ? <p className="rf2-jtable__sub">{ids.length} applications selected. You can review every application before confirming.</p> : <ButtonV2 kind="tertiary" onClick={openReview}>Review reassignment</ButtonV2>}
          </>
        )}
      </div>
    </DrawerV2>
  );
}
