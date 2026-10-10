import { useMemo, useState } from 'react';
import { Briefcase, CircleCheck, Clock, Info, Play, Save, Send, Target } from 'lucide-react';
import { ButtonV2, DangerConfirmButton, DrawerV2, InputV2, SelectV2, StatusChip, TextareaV2 } from '../../components/v2';
import {
  activateRequisition, canActivateDraft, cancelRequisition, createRequisition, deptOf, draftActivateRefused, dueOf, formatDue, isEditable, reqError, STATUS_LABEL, STATUS_TONE,
  submitRequisition, TARGET_UPDATE_LIVE, titleOf, updateRequisition, updateTarget, type Grade, type Person, type ReqContext, type ReqFields, type Requisition,
} from '../api/requisitions';

type Errs = Partial<Record<'positionId' | 'branchId' | 'seats' | 'dueDate' | 'assignee' | 'grade' | 'reason' | 'form', string>>;
const cairoToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export interface ReqDrawerProps {
  req: Requisition | null;
  ctx: ReqContext | null;
  people: Person[] | null;
  grades: Grade[] | null;
  canActivate: boolean;
  /** The signed-in Manager (own-draft activation). */
  meId?: string;
  onClose: () => void;
  onDone: (message: string) => void;
}

function PersonSelect({ people, value, onChange, error, disabled, label = 'Primary recruiter', hint }: { people: Person[] | null; value: string; onChange: (v: string) => void; error?: string; disabled?: boolean; label?: string; hint?: string }) {
  if (!people) return <SelectV2 label={label} disabled hint="Your reports list is not available to you, so the owner cannot be picked here." value=""><option value="">Not available</option></SelectV2>;
  return (
    <SelectV2 label={label} value={value} onChange={(e) => onChange(e.target.value)} error={error} disabled={disabled} hint={hint}>
      <option value="">Choose a person</option>
      {people.map((p) => <option key={p.id} value={p.id}>{p.name}{p.detail ? ` — ${p.detail}` : ''}</option>)}
    </SelectV2>
  );
}

/** M03 Requisition: create / edit a draft, submit, activate, cancel. One primary per state. */
export function RequisitionDrawer({ req, ctx, people, grades, canActivate, meId, onClose, onDone }: ReqDrawerProps) {
  const editable = !req || isEditable(req.status);
  const [f, setF] = useState({
    positionId: req?.positionId ?? '', branchId: req?.branchId ?? '', seats: String(req?.requestedHeadcount ?? 1),
    dueDate: req ? dueOf(req) ?? '' : '', departmentId: req?.departmentId ?? '', gradeId: req?.gradeId ?? '', assignee: req?.assignedEmployeeId ?? '', notes: req?.justification ?? '',
  });
  const initial = useMemo(() => JSON.stringify(f), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [busy, setBusy] = useState<null | 'save' | 'submit' | 'activate' | 'cancel'>(null);
  const [errs, setErrs] = useState<Errs>({});
  const [reason, setReason] = useState('');
  const set = (k: keyof typeof f) => (v: string) => { setF((x) => ({ ...x, [k]: v })); setErrs((e) => ({ ...e, [k === 'seats' ? 'seats' : k === 'assignee' ? 'assignee' : k === 'gradeId' ? 'grade' : k]: undefined, form: undefined })); };
  const title = req ? titleOf(req, ctx) : ctx?.positions.find((p) => p.id === f.positionId)?.title ?? 'New requisition';
  const departments = ctx?.departments;
  const seats = Number(f.seats);

  const fields = (): ReqFields | null => {
    const e: Errs = {};
    if (!f.positionId) e.positionId = 'Pick a title.';
    if (!f.branchId) e.branchId = 'Pick a site.';
    if (!Number.isInteger(seats) || seats < 1) e.seats = 'At least 1 seat.';
    if (!f.dueDate) e.dueDate = 'Required — a requisition needs a due date.';
    else if (f.dueDate < cairoToday()) e.dueDate = 'Pick today or a later day.';
    setErrs(e);
    if (Object.keys(e).length) return null;
    return { ...(departments ? { departmentId: f.departmentId || null } : {}), positionId: f.positionId, branchId: f.branchId, requestedHeadcount: seats, dueDate: f.dueDate, gradeId: f.gradeId || null, assignedEmployeeId: f.assignee || null, justification: f.notes.trim() || null };
  };
  const fail = (e: unknown) => { const r = reqError(e); setErrs(r.field ? { [r.field]: r.text } : { form: r.text }); };
  const save = async (then?: 'submit') => {
    const body = fields(); if (!body) return;
    setBusy(then ?? 'save');
    try {
      const saved = req ? await updateRequisition(req.id, body) : await createRequisition(body);
      if (then === 'submit') { await submitRequisition(saved?.id ?? req!.id); onDone(`${title} sent for approval. Activate it once it is approved.`); }
      else onDone(`${title} saved as a draft.`);
    } catch (e) { fail(e); } finally { setBusy(null); }
  };
  const activate = async () => {
    if (draftActivate) {
      const body = fields(); if (!body) return;
      if (!f.assignee) { setErrs({ assignee: 'Pick the primary recruiter who will own the job.' }); return; }
      setBusy('activate');
      let id = req?.id;
      try {
        const saved = req ? await updateRequisition(req.id, body) : await createRequisition(body);
        id = saved?.id ?? id;
        await activateRequisition(id!, f.assignee);
        const who = people?.find((p) => p.id === f.assignee)?.name ?? 'the owner';
        onDone(`Job active — ${title} is now in ${who}’s Open jobs.`);
      } catch (e) {
        if (draftActivateRefused(e)) setErrs({ form: `Activating a draft directly is not live yet${id ? ' — your changes are saved' : ''}. Submit it for approval for now, then activate once it is approved.` });
        else fail(e);
      } finally { setBusy(null); }
      return;
    }
    if (!req) return;
    if (!f.assignee) { setErrs({ assignee: 'Pick the primary recruiter who will own the job.' }); return; }
    setBusy('activate');
    try {
      await activateRequisition(req.id, f.assignee);
      const who = people?.find((p) => p.id === f.assignee)?.name ?? 'the owner';
      onDone(`Job active — ${title} is now in ${who}’s Open jobs.`);
    } catch (e) { fail(e); } finally { setBusy(null); }
  };
  const cancel = async () => {
    if (!req) return;
    if (reason.trim().length < 3) { setErrs({ reason: 'A reason is required (at least 3 characters).' }); return; }
    setBusy('cancel');
    try {
      const r = await cancelRequisition(req.id, reason.trim());
      onDone(`${req.requestCode} cancelled.${r?.closedJob ? ` Its job was closed${r.rejectedApplications ? ` and ${r.rejectedApplications} open file${r.rejectedApplications === 1 ? '' : 's'} rejected` : ''}.` : ''}`);
    } catch (e) { fail(e); } finally { setBusy(null); }
  };

  const status = req?.status ?? 'Draft';
  const approved = status === 'Approved';
  const ro = !editable;
  const canCancel = !!req && status !== 'Cancelled' && status !== 'Rejected';
  // CoS: a Manager's own Draft activates directly once it has a due date (Backend adding it; refusal handled above).
  const draftActivate = canActivateDraft(req, meId, f.dueDate || null);
  const ownDraft = status === 'Draft' && (!req || req.requesterId === meId);
  const primary = ownDraft && f.dueDate
    ? <ButtonV2 icon={<Play />} loading={busy === 'activate'} disabled={!!busy} onClick={() => void activate()}>Activate job</ButtonV2>
    : editable
    ? <ButtonV2 icon={<Send />} loading={busy === 'submit'} disabled={!!busy || !f.dueDate} onClick={() => void save('submit')}>Submit for approval</ButtonV2>
    : approved && canActivate
      ? <ButtonV2 icon={<Play />} loading={busy === 'activate'} disabled={!!busy} onClick={() => void activate()}>Activate job</ButtonV2>
      : <ButtonV2 onClick={onClose}>Close</ButtonV2>;
  const secondary = editable
    ? <ButtonV2 kind="secondary" icon={<Save />} loading={busy === 'save'} disabled={!!busy || !f.dueDate} onClick={() => void save()} aria-describedby={!f.dueDate ? 'req-due-why' : undefined}>Save draft</ButtonV2>
    : approved ? <ButtonV2 kind="secondary" onClick={onClose}>Close</ButtonV2> : null;

  return (
    <DrawerV2 open onClose={onClose} kicker={`Requisition${req ? ` · ${req.requestCode}` : ''} · ${STATUS_LABEL[status]}`} title={title}
      primaryAction={primary} secondaryAction={secondary}
      confirmClose={() => !editable || JSON.stringify(f) === initial || window.confirm('Discard the changes to this requisition?')}>
      <div className="rf2-drawer-form rf2-req">
        {errs.form ? <p className="rf2-form-error" role="alert">{errs.form}</p> : null}
        {ctx ? (
          <SelectV2 label="Title" required value={f.positionId} onChange={(e) => set('positionId')(e.target.value)} error={errs.positionId} disabled={ro} hint="From the Titles list in Master data.">
            <option value="">Choose a title</option>
            {ctx.positions.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </SelectV2>
        ) : <p className="rf2-inline-note"><Info aria-hidden="true" /> Titles and sites are not available to you (needs requisition create access). {req ? 'Showing the saved values.' : ''}</p>}
        <div className="rf2-req__row">
          {ctx ? (
            <SelectV2 label="Site" required value={f.branchId} onChange={(e) => set('branchId')(e.target.value)} error={errs.branchId} disabled={ro}>
              <option value="">Choose a site</option>
              {ctx.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </SelectV2>
          ) : null}
          {departments ? (
            <SelectV2 label="Department" value={f.departmentId} onChange={(e) => set('departmentId')(e.target.value)} disabled={ro}>
              <option value="">No department</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </SelectV2>
          ) : req && deptOf(req, ctx) ? <p className="rf2-jtable__sub">Department: {deptOf(req, ctx)}</p> : null}
          <SelectV2 label="Grade" value={f.gradeId} onChange={(e) => set('gradeId')(e.target.value)} disabled={ro || !grades} error={errs.grade} hint={grades ? undefined : 'Grades list not available.'}>
            <option value="">No grade</option>
            {(grades ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </SelectV2>
        </div>
        <div className="rf2-req__row">
          <InputV2 label="Seats" required type="number" min={1} value={f.seats} onChange={(e) => set('seats')(e.target.value)} error={errs.seats} disabled={ro} />
          <InputV2 label="Due date" required type="date" min={cairoToday()} value={f.dueDate} onChange={(e) => set('dueDate')(e.target.value)} error={errs.dueDate} disabled={ro}
            hint={!f.dueDate && !ro ? 'Required — Save draft stays disabled while it is empty.' : undefined} id="req-due" />
        </div>
        <span id="req-due-why" className="rf2-sr-only">Save is disabled until a due date is set.</span>
        <PersonSelect people={people} value={f.assignee} onChange={set('assignee')} error={errs.assignee} disabled={!(editable || approved)}
          hint={approved ? 'Activate job makes this person the owner.' : undefined} />
        <TextareaV2 label="Notes" rows={3} value={f.notes} onChange={(e) => set('notes')(e.target.value)} disabled={ro} />
        <section className="rf2-req__status" aria-labelledby="req-status-h">
          <div className="rf2-row-between"><h3 id="req-status-h" className="rf2-field__label">Status</h3><StatusChip tone={STATUS_TONE[status]} label={STATUS_LABEL[status]} /></div>
          <p className="rf2-jtable__sub">{
            ownDraft ? (f.dueDate ? 'Activate job creates the job, assigns the owner and shows it in their Open jobs — one step. Or submit it for approval first.' : 'Add a due date to activate it directly, or submit it for approval.')
            : editable ? 'Submit sends it for approval. Once approved, Activate job creates the job, assigns the owner and shows it in their Open jobs — one step, no pending state.'
            : status === 'Pending Approval' ? 'Waiting on approval. Activate job is available once it is approved.'
            : approved ? (canActivate ? 'Approved. Activate job creates the job and assigns the owner in one step.' : 'Approved. Activating needs job management access.')
            : status === 'Converted to Vacancy' ? `Job active${req?.activatedAt ? ` since ${formatDue(req.activatedAt)}` : ''}.`
            : status === 'Cancelled' ? `Cancelled${req?.cancelReason ? `: ${req.cancelReason}` : ''}. Nothing is deleted.`
            : 'Rejected by the approver.'
          }</p>
          {ownDraft && f.dueDate ? <ButtonV2 kind="secondary" size="sm" icon={<Send />} loading={busy === 'submit'} disabled={!!busy} onClick={() => void save('submit')}>Submit for approval</ButtonV2> : null}
          {canCancel ? (
            <div className="rf2-req__cancel">
              <TextareaV2 label="Reason to cancel" rows={2} value={reason} onChange={(e) => { setReason(e.target.value); setErrs((x) => ({ ...x, reason: undefined })); }} error={errs.reason}
                hint={status === 'Converted to Vacancy' ? 'Cancelling closes the live job and rejects its open files ("Requisition cancelled").' : 'Status becomes Cancelled. Nothing is deleted.'} />
              <DangerConfirmButton size="sm" confirmLabel="Confirm cancel — final" loading={busy === 'cancel'} disabled={!!busy} onConfirm={() => void cancel()}>Cancel requisition</DangerConfirmButton>
            </div>
          ) : null}
        </section>
      </div>
    </DrawerV2>
  );
}

/** M04 Add target: seats + due date + owner on the requisition; previews the chip the owner sees on My Work. */
export function TargetDrawer({ req, people, canActivate, targetUpdate = TARGET_UPDATE_LIVE, onClose, onDone }: Omit<ReqDrawerProps, 'ctx' | 'grades'> & { req: Requisition; targetUpdate?: boolean }) {
  const live = req.status === 'Converted to Vacancy';
  /** Live job + the target-update endpoint (hidden until Backend ships it). */
  const liveEdit = live && targetUpdate;
  const editable = isEditable(req.status) || liveEdit;
  const [why, setWhy] = useState('');
  const approved = req.status === 'Approved';
  const [seats, setSeats] = useState(String(req.requestedHeadcount));
  const [due, setDue] = useState(dueOf(req) ?? '');
  const [assignee, setAssignee] = useState(req.assignedEmployeeId ?? '');
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Errs>({});
  const title = titleOf(req, null);
  const who = people?.find((p) => p.id === assignee)?.name;
  const n = Number(seats);
  const filled = req.targetChip?.filled ?? 0;

  const save = async () => {
    const e: Errs = {};
    if (!Number.isInteger(n) || n < 1) e.seats = 'At least 1 seat.';
    if (!due) e.dueDate = 'Required — a target needs a due date.';
    if (!assignee && !liveEdit) e.assignee = 'Pick who the target is for.';
    if (liveEdit && why.trim().length < 3) e.reason = 'Say why the target changes (at least 3 characters).';
    setErrs(e); if (Object.keys(e).length) return;
    setBusy(true);
    try {
      if (liveEdit) {
        await updateTarget(req.id, { requestedHeadcount: n, dueDate: due, reason: why.trim() });
        onDone(`Target updated — ${who ?? 'the owner'}’s My Work now shows “${filled} of ${n} · due ${formatDue(due).replace(/ \d{4}$/, '')}”.`);
      } else if (editable) {
        await updateRequisition(req.id, { requestedHeadcount: n, dueDate: due, assignedEmployeeId: assignee });
        onDone(`Target saved — it appears on ${who ?? 'the owner'}’s My Work as “${filled} of ${n} · due ${formatDue(due).replace(/ \d{4}$/, '')}” once the job is active.`);
      } else {
        await activateRequisition(req.id, assignee);
        onDone(`Job active — target appears on ${who ?? 'the owner'}’s My Work as “${filled} of ${n} · due ${formatDue(due).replace(/ \d{4}$/, '')}”.`);
      }
    } catch (x) { const r = reqError(x); setErrs(r.field === 'dueDate' || r.field === 'assignee' || r.field === 'reason' ? { [r.field]: r.text } : { form: r.text }); } finally { setBusy(false); }
  };

  const locked = !editable && !approved;
  return (
    <DrawerV2 open onClose={onClose} kicker={`Target · ${req.requestCode}`} title={`${req.targetChip && dueOf(req) ? 'Edit' : 'Add'} target — ${title}`}
      primaryAction={locked ? <ButtonV2 onClick={onClose}>Close</ButtonV2>
        : approved ? (canActivate ? <ButtonV2 icon={<Play />} loading={busy} disabled={!due} onClick={() => void save()}>Save target and activate</ButtonV2> : <ButtonV2 onClick={onClose}>Close</ButtonV2>)
        : <ButtonV2 icon={<Target />} loading={busy} disabled={!due} onClick={() => void save()}>Save target</ButtonV2>}
      secondaryAction={locked ? null : <ButtonV2 kind="secondary" onClick={onClose}>Cancel</ButtonV2>}>
      <div className="rf2-drawer-form rf2-req">
        {errs.form ? <p className="rf2-form-error" role="alert">{errs.form}</p> : null}
        <InputV2 label="Seats" required type="number" min={1} value={seats} onChange={(e) => { setSeats(e.target.value); setErrs({}); }} error={errs.seats} disabled={!editable} />
        <InputV2 label="Due date" required type="date" value={due} onChange={(e) => { setDue(e.target.value); setErrs({}); }} error={errs.dueDate} disabled={!editable}
          hint={!due && editable ? 'Required — a target needs a due date. Save target stays disabled while it is empty.' : undefined} />
        <PersonSelect label="Assign to" people={people} value={assignee} onChange={(v) => { setAssignee(v); setErrs({}); }} error={errs.assignee} disabled={locked || liveEdit} />
        {liveEdit ? <TextareaV2 label="Reason for the change" required rows={2} value={why} onChange={(e) => { setWhy(e.target.value); setErrs({}); }} error={errs.reason} hint="Kept on the job’s history." /> : null}
        {locked ? <p className="rf2-inline-note"><Info aria-hidden="true" /> {req.status === 'Converted to Vacancy' ? 'The job is active. Its seats and due date can no longer be changed here (no API for a live target yet).' : req.status === 'Pending Approval' ? 'Waiting on approval: the target is locked until it comes back.' : 'This requisition is closed.'}</p> : null}
        {approved ? <p className="rf2-inline-note"><Info aria-hidden="true" /> Approved: seats and due date are locked. Pick the owner and activate.</p> : null}
        <section className="rf2-req__preview" aria-label={`Preview — ${who ?? 'owner'}’s My Work`}>
          <p className="rf2-req__preview-k">Preview — {who ? `${who}’s` : 'the owner’s'} My Work</p>
          <div className="rf2-req__chip">
            <Briefcase aria-hidden="true" />
            <div><p className="rf2-jtable__name">{title}</p><p className="rf2-jtable__sub">{who ? `Owner: ${who}` : 'No owner yet'}</p></div>
            <p className="rf2-req__chip-n" data-tone={due ? 'success' : undefined}>{filled} of {Number.isInteger(n) && n > 0 ? n : '—'}{due ? ` · due ${formatDue(due).replace(/ \d{4}$/, '')}` : ''}</p>
          </div>
        </section>
        {req.status === 'Converted to Vacancy' ? <p className="rf2-inline-note" data-tone="success"><CircleCheck aria-hidden="true" /> Live chip: {req.targetChip?.label ?? `${filled} of ${req.requestedHeadcount}`}{dueOf(req) ? ` · due ${formatDue(dueOf(req))}` : ''}.</p> : null}
        {req.status === 'Pending Approval' ? <p className="rf2-jtable__sub"><Clock aria-hidden="true" /> Pending approval.</p> : null}
      </div>
    </DrawerV2>
  );
}
