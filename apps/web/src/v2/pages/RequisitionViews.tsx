import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Copy } from 'lucide-react';
import { ButtonV2, InputV2, SelectV2, StatusChip, TabsV2, TextareaV2 } from '../../components/v2';
import {
  deptOf, dueOf, formatDue, isEditable, ownerIdOf, ownerOf, reqError, siteOf, STATUS_LABEL, STATUS_TONE, titleOf, updateRequisition,
  type Person, type ReqContext, type ReqFields, type ReqStatus, type Requisition,
} from '../api/requisitions';

const FIELDS = ['Title', 'Site', 'Seats', 'Due date', 'Primary recruiter', 'Notes'] as const;
const STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Pre-hire', 'Joined'] as const;
const OWNERSHIP_WARNING = 'Editing primary recruiter on a requisition changes job ownership only. Open candidate application files remain with their current primary recruiter until reassigned in Team work (M04).';
type DetailTab = 'overview' | 'progress' | 'ownership' | 'activity';
type EditForm = { positionId: string; branchId: string; seats: string; dueDate: string; assignee: string; notes: string };
type EditErrs = Partial<Record<'positionId' | 'branchId' | 'seats' | 'dueDate' | 'assignee' | 'notes' | 'form', string>>;

const cairoToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const isTab = (key: string): key is DetailTab => key === 'overview' || key === 'progress' || key === 'ownership' || key === 'activity';

export function formatStamp(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDue(value);
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(date);
}

function statusText(status: ReqStatus): string {
  return status === 'Converted to Vacancy' ? 'Job active' : STATUS_LABEL[status];
}

function draftFrom(req: Requisition): EditForm {
  return {
    positionId: req.positionId,
    branchId: req.branchId,
    seats: String(req.requestedHeadcount ?? 1),
    dueDate: dueOf(req) ?? '',
    assignee: req.assignedEmployeeId ?? req.primaryRecruiter?.id ?? '',
    notes: req.justification ?? '',
  };
}

function lockCopy(status: ReqStatus): string {
  if (status === 'Converted to Vacancy') {
    return 'This requisition is a live job. Title, site, seats, due date, primary recruiter, and notes are locked. Change seats and the due date from the hiring target. Reassign open application files in Team work.';
  }
  return `This requisition is ${STATUS_LABEL[status].toLowerCase()}. Title, site, seats, due date, primary recruiter, and notes are locked.`;
}

function requesterOf(req: Requisition, people: Person[] | null, me: { id: string; name: string } | null): string {
  if (req.requesterName?.trim()) return req.requesterName.trim();
  if (me && req.requesterId === me.id && me.name.trim()) return me.name.trim();
  return people?.find((person) => person.id === req.requesterId)?.name ?? '—';
}

export interface RequisitionViewProps {
  current: Requisition;
  ctx: ReqContext | null;
  people: Person[] | null;
  go: (req: string | null, drawer?: string) => void;
}

/** M07 — safe edits for a draft or a requisition returned for changes. */
export function EditRequisitionView({ current, ctx, people, go, onDone }: RequisitionViewProps & { onDone: (message: string) => void }) {
  const editable = isEditable(current.status);
  const [saved] = useState(() => draftFrom(current));
  const [f, setF] = useState(() => draftFrom(current));
  const [errs, setErrs] = useState<EditErrs>({});
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(f) !== JSON.stringify(saved);
  const title = titleOf(current, ctx);
  const set = (key: keyof EditForm) => (value: string) => {
    setF((form) => ({ ...form, [key]: value }));
    const errKey = key === 'assignee' ? 'assignee' : key === 'seats' ? 'seats' : key === 'dueDate' ? 'dueDate' : key === 'notes' ? 'notes' : key;
    setErrs((prev) => ({ ...prev, [errKey]: undefined, form: undefined }));
  };

  const nameFor = (id: string) => {
    if (!id) return '—';
    if (id === (current.primaryRecruiter?.id ?? '') && current.primaryRecruiter?.name) return current.primaryRecruiter.name;
    if (id === (current.assignedEmployeeId ?? '') && current.assignedEmployeeName) return current.assignedEmployeeName;
    if (id === ownerIdOf(current)) return ownerOf(current, people);
    return people?.find((person) => person.id === id)?.name ?? 'Assigned';
  };
  const titleFor = (id: string) => {
    if (!id) return '—';
    if (id === current.positionId) return title;
    return ctx?.positions.find((position) => position.id === id)?.title ?? 'Selected title';
  };
  const siteFor = (id: string) => {
    if (!id) return '—';
    if (id === current.branchId) return siteOf(current, ctx);
    return ctx?.branches.find((branch) => branch.id === id)?.name ?? 'Selected site';
  };

  const changes: string[] = [];
  if (f.positionId !== saved.positionId) changes.push(`Title: ${titleFor(saved.positionId)} → ${titleFor(f.positionId)}`);
  if (f.branchId !== saved.branchId) changes.push(`Site: ${siteFor(saved.branchId)} → ${siteFor(f.branchId)}`);
  if (f.seats !== saved.seats) changes.push(`Seats: ${saved.seats} → ${f.seats}`);
  if ((f.dueDate || null) !== (saved.dueDate || null)) changes.push(`Due date: ${formatDue(saved.dueDate || null)} → ${formatDue(f.dueDate || null)}`);
  if (f.assignee !== saved.assignee) changes.push(`Primary recruiter: ${nameFor(saved.assignee)} → ${nameFor(f.assignee)}`);
  if (f.notes.trim() !== saved.notes.trim()) changes.push('Notes: updated');

  const positions = ctx?.positions ?? [];
  const branches = ctx?.branches ?? [];
  const positionOptions = !current.positionId || positions.some((position) => position.id === current.positionId)
    ? positions
    : [{ id: current.positionId, title }, ...positions];
  const branchOptions = !current.branchId || branches.some((branch) => branch.id === current.branchId)
    ? branches
    : [{ id: current.branchId, name: siteOf(current, ctx) }, ...branches];
  const savedAssignee = current.assignedEmployeeId ?? current.primaryRecruiter?.id ?? '';
  const roster = !people ? null : savedAssignee && !people.some((person) => person.id === savedAssignee)
    ? [{ id: savedAssignee, name: nameFor(savedAssignee) } satisfies Person, ...people]
    : people;

  const save = async () => {
    if (!editable || busy) return;
    const seats = Number(f.seats);
    const next: EditErrs = {};
    if (!f.positionId) next.positionId = 'Pick a title.';
    if (!f.branchId) next.branchId = 'Pick a site.';
    if (!Number.isInteger(seats) || seats < 1) next.seats = 'At least 1 seat.';
    if (!f.dueDate) next.dueDate = 'Required — a requisition needs a due date.';
    else if (f.dueDate < cairoToday()) next.dueDate = 'Pick today or a later day.';
    setErrs(next);
    if (Object.keys(next).length) return;
    const body: Partial<ReqFields> = {
      positionId: f.positionId,
      branchId: f.branchId,
      requestedHeadcount: seats,
      dueDate: f.dueDate,
      assignedEmployeeId: f.assignee || null,
      justification: f.notes.trim() || null,
    };
    setBusy(true);
    try {
      await updateRequisition(current.id, body);
      onDone(`${titleFor(f.positionId)} changes saved.`);
    } catch (error) {
      const parsed = reqError(error);
      const next: EditErrs = {};
      const inline = parsed.inline ?? {};
      if (inline.positionId) next.positionId = inline.positionId;
      if (inline.branchId) next.branchId = inline.branchId;
      if (inline.seats) next.seats = inline.seats;
      if (inline.dueDate) next.dueDate = inline.dueDate;
      if (inline.assignee) next.assignee = inline.assignee;
      if (inline.notes) next.notes = inline.notes;
      if (parsed.field === 'seats' || parsed.field === 'dueDate' || parsed.field === 'assignee') next[parsed.field] = parsed.text;
      else if (parsed.text) next.form = parsed.text;
      setErrs(next);
    } finally {
      setBusy(false);
    }
  };

  const restore = () => {
    if (!dirty) return;
    if (!window.confirm('Restore the last saved values for this requisition?')) return;
    setF({ ...saved });
    setErrs({});
  };

  return (
    <section className="rf2-req__view" aria-label={`Edit requisition ${current.requestCode}`}>
      <p className="rf2-crumbs">
        <button type="button" className="rf2-link" onClick={() => go(null)}>Requisitions</button>
        {' / '}
        <button type="button" className="rf2-link" onClick={() => go(current.id, 'detail')}>{current.requestCode}</button>
        {' / '}
        <span aria-current="page">Edit</span>
      </p>
      <div className="rf2-req__actions">
        <ButtonV2 kind="secondary" icon={<ArrowLeft />} onClick={() => go(current.id, 'detail')}>Back to requisition</ButtonV2>
        <ButtonV2 kind="tertiary" onClick={() => go(null)}>Cancel</ButtonV2>
      </div>
      <div className="rf2-req__who">
        <h2>Edit {title}</h2>
        <StatusChip tone={STATUS_TONE[current.status]} label={statusText(current.status)} />
        <p className="rf2-jtable__sub">Last saved {formatDue(current.updatedAt)}</p>
      </div>
      <div className="rf2-req__split">
        <div className="rf2-req__panel">
          <h3>Requisition</h3>
          {errs.form ? <p className="rf2-form-error" role="alert">{errs.form}</p> : null}
          {editable ? (
            <>
              {ctx ? (
                <SelectV2 label="Title" required value={f.positionId} onChange={(event) => set('positionId')(event.target.value)} error={errs.positionId}>
                  <option value="">Choose a title</option>
                  {positionOptions.map((position) => <option key={position.id} value={position.id}>{position.title}</option>)}
                </SelectV2>
              ) : <p className="rf2-inline-note">Titles and sites are not available to you. The saved title stays {title}.</p>}
              {ctx ? (
                <SelectV2 label="Site" required value={f.branchId} onChange={(event) => set('branchId')(event.target.value)} error={errs.branchId}>
                  <option value="">Choose a site</option>
                  {branchOptions.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </SelectV2>
              ) : null}
              <div className="rf2-req__row">
                <InputV2 label="Seats" required type="number" min={1} value={f.seats} onChange={(event) => set('seats')(event.target.value)} error={errs.seats} />
                <InputV2 label="Due date" required type="date" min={cairoToday()} value={f.dueDate} onChange={(event) => set('dueDate')(event.target.value)} error={errs.dueDate} />
              </div>
              {roster ? (
                <SelectV2 label="Primary recruiter" value={f.assignee} onChange={(event) => set('assignee')(event.target.value)} error={errs.assignee}>
                  <option value="">Choose a person</option>
                  {roster.map((person) => <option key={person.id} value={person.id}>{person.name}{person.detail ? ` — ${person.detail}` : ''}</option>)}
                </SelectV2>
              ) : (
                <div>
                  <p className="rf2-field__label">Primary recruiter</p>
                  <p>{ownerOf(current, people)}</p>
                  <p className="rf2-jtable__sub">Your reports list is not available to you, so the owner cannot be picked here.</p>
                </div>
              )}
              <TextareaV2 label="Notes" rows={4} value={f.notes} onChange={(event) => set('notes')(event.target.value)} error={errs.notes} />
            </>
          ) : (
            <>
              <p className="rf2-inline-note" role="status">{lockCopy(current.status)}</p>
              <dl className="rf2-req__facts">
                <div><dt>Title</dt><dd>{title}</dd></div>
                <div><dt>Site</dt><dd>{siteOf(current, ctx)}</dd></div>
                <div><dt>Seats</dt><dd>{current.requestedHeadcount}</dd></div>
                <div><dt>Due date</dt><dd>{formatDue(dueOf(current))}</dd></div>
                <div><dt>Primary recruiter</dt><dd>{ownerOf(current, people)}</dd></div>
                <div><dt>Notes</dt><dd>{current.justification?.trim() || '—'}</dd></div>
              </dl>
            </>
          )}
        </div>
        <section className="rf2-req__panel" aria-label="Change impact">
          <h3>Change impact</h3>
          <div>
            <h4 className="rf2-field__label">Editable</h4>
            {editable ? (
              <ul>{FIELDS.map((name) => <li key={name}>{name}</li>)}</ul>
            ) : <p>No fields are editable while the status is {statusText(current.status)}.</p>}
          </div>
          <div>
            <h4 className="rf2-field__label">Locked</h4>
            <ul>
              {(editable ? ['Requisition ID', 'Status'] : [...FIELDS, 'Requisition ID', 'Status']).map((name) => <li key={name}>{name}</li>)}
            </ul>
          </div>
          <div aria-live="polite">
            <h4 className="rf2-field__label">Changes summary</h4>
            {changes.length === 0 ? <p>No unsaved changes.</p> : <ul>{changes.map((line) => <li key={line}>{line}</li>)}</ul>}
          </div>
          <p>{OWNERSHIP_WARNING}</p>
        </section>
      </div>
      <div className="rf2-req__foot">
        <ButtonV2 kind="secondary" onClick={() => go(null)}>Cancel</ButtonV2>
        <ButtonV2 kind="tertiary" disabled={!editable || !dirty || busy} onClick={restore}>Reset to last saved</ButtonV2>
        <ButtonV2 loading={busy} disabled={!editable || !dirty || busy} onClick={() => void save()}>Save changes</ButtonV2>
      </div>
    </section>
  );
}

/** M08 — progress, ownership, and the audit for one requisition. */
export function RequisitionDetailView({ current, ctx, people, me = null, go }: RequisitionViewProps & { me?: { id: string; name: string } | null }) {
  const [dtab, setDtab] = useState<DetailTab>('overview');
  const [copyNote, setCopyNote] = useState<string | null>(null);
  const title = titleOf(current, ctx);
  const due = dueOf(current);
  const filled = current.targetChip?.filled ?? 0;
  const total = current.requestedHeadcount;
  const targetLabel = due ? (current.targetChip?.label ?? `0 of ${total}`) : 'Not set';
  const canClose = current.status !== 'Cancelled' && current.status !== 'Rejected';
  const fillLabel = `${filled} of ${total} filled`;
  const meterMax = Math.max(total, 1);
  const meterNow = Math.min(Math.max(filled, 0), meterMax);
  const fillWidth = total > 0 ? Math.min(100, Math.round((filled / total) * 100)) : 0;
  const milestone = !due
    ? 'Next milestone: set a hiring target.'
    : filled >= total && total > 0
      ? `Next milestone: the ${total} requested seats are filled.`
      : `Next milestone: fill ${total} seats by ${formatDue(due)}.`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyNote('Link copied.');
    } catch {
      setCopyNote('Could not copy the link.');
    }
  };

  const events: Array<{ key: string; label: string; at: string | null; detail?: string }> = [
    { key: 'created', label: 'Created', at: current.createdAt },
    { key: 'updated', label: 'Updated', at: current.updatedAt },
    { key: 'activated', label: 'Activated', at: current.activatedAt ?? null },
  ];
  if (current.status === 'Cancelled' || current.cancelledAt) {
    events.push({ key: 'cancelled', label: 'Cancelled', at: current.cancelledAt ?? null, detail: current.cancelReason?.trim() || undefined });
  }
  const ordered = [...events].sort((a, b) => {
    if (a.at === b.at) return 0;
    if (!a.at) return 1;
    if (!b.at) return -1;
    return a.at.localeCompare(b.at);
  });

  return (
    <section className="rf2-req__view" aria-label={`Requisition ${current.requestCode}`}>
      <p className="rf2-crumbs">
        <button type="button" className="rf2-link" onClick={() => go(null)}>Requisitions</button>
        {' / '}
        <span aria-current="page">{current.requestCode}</span>
      </p>
      <ButtonV2 kind="secondary" icon={<ArrowLeft />} onClick={() => go(null)}>Back to requisitions</ButtonV2>
      <div className="rf2-req__hero">
        <div className="rf2-req__who">
          <h2>{title}</h2>
          <StatusChip tone={STATUS_TONE[current.status]} label={statusText(current.status)} />
          <dl className="rf2-req__facts">
            <div><dt>ID</dt><dd>{current.requestCode}</dd></div>
            <div><dt>Site</dt><dd>{siteOf(current, ctx)}</dd></div>
            <div><dt>Requested seats</dt><dd>{total} requested seats</dd></div>
            <div><dt>Fill progress</dt><dd>{fillLabel}</dd></div>
            <div><dt>Due</dt><dd>{formatDue(due)}</dd></div>
            <div><dt>Primary recruiter</dt><dd>{ownerOf(current, people)}</dd></div>
            <div><dt>Target</dt><dd>{targetLabel}</dd></div>
            {/* Meeting notes 2026-11-25 (items 1–2): approvers see the opening kind, hiring type, reason and preference. */}
            <div><dt>Opening type</dt><dd>{current.openingType ?? 'New position'}</dd></div>
            {current.openingType === 'Replacement' && current.replacedEmployee ? <div><dt>Replaces</dt><dd>{current.replacedEmployee.name}</dd></div> : null}
            <div><dt>Employment type</dt><dd>{current.employmentType ?? '—'}</dd></div>
            <div><dt>Opening reason</dt><dd>{current.reason ?? '—'}</dd></div>
            <div><dt>Nationality preference</dt><dd>{(current.nationalityPreference ?? []).length ? current.nationalityPreference!.join(', ') : 'None — soft preference only'}</dd></div>
          </dl>
        </div>
        <div className="rf2-req__actions">
          {current.status === 'Pending Approval' ? <Link className="rf2-btn rf2-btn--secondary rf2-btn--md" to={`/my-work?tab=waiting&approval=${encodeURIComponent(current.id)}`}>Review approval</Link> : null}
          <ButtonV2 kind="secondary" onClick={() => go(current.id, 'edit')}>Edit requisition</ButtonV2>
          <ButtonV2 kind="secondary" onClick={() => go(current.id, 'target')}>{due ? 'Edit target' : 'Add target'}</ButtonV2>
          <ButtonV2 kind="tertiary" icon={<Copy />} onClick={() => void copyLink()}>Copy link</ButtonV2>
          {canClose ? <ButtonV2 kind="danger-outline" onClick={() => go(current.id)}>Close / cancel requisition</ButtonV2> : null}
        </div>
      </div>
      {copyNote ? <p className="rf2-jtable__sub" role="status">{copyNote}</p> : null}
      <TabsV2
        ariaLabel="Requisition details"
        activeKey={dtab}
        onChange={(key) => { if (isTab(key)) setDtab(key); }}
        items={[
          { key: 'overview', label: 'Overview', controls: 'req-detail-panel' },
          { key: 'progress', label: 'Hiring progress', controls: 'req-detail-panel' },
          { key: 'ownership', label: 'Team & ownership', controls: 'req-detail-panel' },
          { key: 'activity', label: 'Activity & approvals', controls: 'req-detail-panel' },
        ]}
      />
      <div role="tabpanel" id="req-detail-panel" aria-labelledby={`rf2-tab-${dtab}`}>
        {dtab === 'overview' ? (
          <div className="rf2-req__split">
            <section className="rf2-req__panel" aria-labelledby="req-details-h">
              <h3 id="req-details-h">Details</h3>
              <dl className="rf2-req__facts">
                <div><dt>Title</dt><dd>{title}</dd></div>
                <div><dt>ID</dt><dd>{current.requestCode}</dd></div>
                <div><dt>Site</dt><dd>{siteOf(current, ctx)}</dd></div>
                {deptOf(current, ctx) ? <div><dt>Department</dt><dd>{deptOf(current, ctx)}</dd></div> : null}
                <div><dt>Seats</dt><dd>{total} requested seats</dd></div>
                <div><dt>Due</dt><dd>{formatDue(due)}</dd></div>
                <div><dt>Status</dt><dd>{statusText(current.status)}</dd></div>
                <div><dt>Primary recruiter</dt><dd>{ownerOf(current, people)}</dd></div>
                <div><dt>Notes</dt><dd>{current.justification?.trim() || '—'}</dd></div>
              </dl>
            </section>
            <section className="rf2-req__panel" aria-labelledby="req-target-h">
              <h3 id="req-target-h">Target</h3>
              <p>Current target: {due ? `${filled} of ${total} by ${formatDue(due)}` : 'Not set'}</p>
              <p id="req-fill-label">{fillLabel}</p>
              <div className="rf2-req__meter" role="meter" aria-valuemin={0} aria-valuemax={meterMax} aria-valuenow={meterNow} aria-labelledby="req-fill-label">
                <span aria-hidden="true" style={{ width: `${fillWidth}%` }} />
              </div>
              <p>{milestone}</p>
              <ButtonV2 kind="secondary" onClick={() => go(current.id, 'target')}>{due ? 'Edit target' : 'Add target'}</ButtonV2>
            </section>
          </div>
        ) : null}
        {dtab === 'progress' ? (
          <div className="rf2-req__panel">
            <h3>Hiring progress</h3>
            <p>{fillLabel}</p>
            <ul className="rf2-req__stages" aria-label="Stage counts">
              {STAGES.map((stage) => (
                <li key={stage}>
                  <span className="rf2-req__stage-n">0</span>
                  <span>{stage}</span>
                </li>
              ))}
            </ul>
            <p>No stage breakdown is loaded. These counts are 0. Percentages are not estimated.</p>
          </div>
        ) : null}
        {dtab === 'ownership' ? (
          <div className="rf2-req__panel">
            <h3>Team & ownership</h3>
            <dl className="rf2-req__facts">
              <div><dt>Requisition / Job owner</dt><dd>{ownerOf(current, people)}</dd></div>
              <div><dt>Requester</dt><dd>{requesterOf(current, people, me)}</dd></div>
            </dl>
            <p>The requisition and job owner is who Open jobs and the hiring target follow. Each open candidate application file keeps its own primary recruiter. Changing the owner here updates the job. Move an open file from Team work when its primary recruiter should change.</p>
            <p><Link className="rf2-link" to="/my-work">Team work</Link></p>
          </div>
        ) : null}
        {dtab === 'activity' ? (
          <div className="rf2-req__panel">
            <h3>Activity & approvals</h3>
            <ol className="rf2-req__audit" aria-label="Activity and approvals">
              {ordered.map((event) => (
                <li key={event.key}>
                  <span>{event.label}</span>
                  <span>
                    {event.at ? <time dateTime={event.at}>{formatStamp(event.at)}</time> : event.key === 'activated' ? 'Not activated' : '—'}
                    {event.detail ? ` · ${event.detail}` : ''}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </section>
  );
}
