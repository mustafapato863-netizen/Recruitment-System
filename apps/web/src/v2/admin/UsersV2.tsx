import { bannerError, fieldError, serverFormErrors } from '../forms/serverErrors';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, CircleCheck, Info, Network, RotateCw, Search, ShieldCheck, UserMinus, UserPlus, UserCheck, TriangleAlert } from 'lucide-react';
import { ButtonV2, DangerConfirmButton, DrawerV2, EmptyStateV2, initials, InputV2, SelectV2, SkeletonV2, StatusChip, TextareaV2 } from '../../components/v2';
import { SEAT_LABEL, SEATS, type Seat } from '../seat';
import { domainError } from '../api/gates';
import { fetchReassignReasons, reassignError } from '../api/teamWork';
import { fetchRoles, type AdminRole } from './rolesApi';
import {
  buildTree, fetchUsers, flatten, inviteUser, isActive, isDescendant, ownedWork, seatOf, setManager, setStatus, statusTone, subLine,
  type AdminUser, type OwnedWork,
  overrideReassign,
} from './usersApi';
import '../pages/jobs.css';
import './admin.css';

const Avatar = ({ name }: { name: string }) => <span className="rf2-avatar rf2-team__avatar" aria-hidden="true">{initials(name)}</span>;

/** A02 Users (Admin seat). Three seats; deactivate, never delete. */
export function UsersV2() {
  const [params, setParams] = useSearchParams();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [q, setQ] = useState('');
  const [seat, setSeat] = useState<'all' | Seat>('all');
  useEffect(() => {
    let live = true; setUsers(null); setError(null);
    fetchUsers().then((u) => live && setUsers(u)).catch((e: { message?: string }) => live && setError(e?.message || 'Something went wrong.'));
    return () => { live = false; };
  }, [attempt]);
  const go = (patch: Record<string, string | null>) => { const n = new URLSearchParams(params); for (const [k, v] of Object.entries(patch)) (v ? n.set(k, v) : n.delete(k)); setParams(n); };
  const byId = useMemo(() => new Map((users ?? []).map((u) => [u.id, u])), [users]);
  const rows = useMemo(() => (users ?? []).filter((u) => (seat === 'all' || seatOf(u) === seat) && (!q.trim() || `${u.displayName} ${u.email}`.toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a, b) => Number(b.status !== 'Inactive') - Number(a.status !== 'Inactive') || a.displayName.localeCompare(b.displayName)), [users, q, seat]);
  const open = users?.find((u) => u.id === params.get('user')) ?? null;
  const drawer = params.get('drawer');
  const [note, setNote] = useState<string | null>(null);
  const done = (m: string) => { setNote(m); go({ user: null, drawer: null, focus: null }); setAttempt((n) => n + 1); };

  return (
    <div className="rf2-jobs rf2-admin">
      <div className="rf2-row-between">
        <div>
          <h1 className="rf2-jobs__title">Users</h1>
          <p className="rf2-jobs__sub">Three roles only: Employee, Manager, Admin. Users are deactivated, never deleted.</p>
        </div>
        <ButtonV2 icon={<UserPlus />} onClick={() => go({ drawer: 'invite' })}>Invite user</ButtonV2>
      </div>
      {note ? <p className="rf2-inline-note" data-tone="success" role="status"><CircleCheck aria-hidden="true" /> {note}</p> : null}
      <div className="rf2-row-between rf2-admin__filters">
        <div className="rf2-admin__filterset">
          <InputV2 label="Search users" fieldClassName="rf2-jobs__search rf2-sr-label" placeholder="Search users" leadingIcon={<Search />} value={q} onChange={(e) => setQ(e.target.value)} />
          <SelectV2 label="Role filter" fieldClassName="rf2-sr-label" value={seat} onChange={(e) => setSeat(e.target.value as 'all' | Seat)}>
            <option value="all">Role: All</option>
            {SEATS.map((s) => <option key={s} value={s}>Role: {SEAT_LABEL[s]}</option>)}
          </SelectV2>
        </div>
        <ButtonV2 kind="secondary" icon={<Network />} onClick={() => go({ drawer: 'tree' })} disabled={!users}>Reporting tree</ButtonV2>
      </div>
      {!users && !error ? <SkeletonV2 lines={6} label="Loading users…" /> : null}
      {error ? <div role="alert"><EmptyStateV2 title="Could not load users" body={error} action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Try again</ButtonV2>} /></div> : null}
      {users ? (
        <div className="rf2-panel rf2-admin__card">
          <table className="rf2-jtable" aria-label="Users">
            <thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Role</th><th scope="col">Reports to</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} data-inactive={!isActive(u) || undefined}>
                  <th scope="row">
                    <button type="button" className="rf2-admin__person" onClick={() => go({ user: u.id })} aria-label={`Open ${u.displayName}`}>
                      <Avatar name={u.displayName} />
                      <span><span className="rf2-jtable__name">{u.displayName}</span><span className="rf2-jtable__sub">{subLine(u)}</span></span>
                    </button>
                  </th>
                  <td>{u.email}</td>
                  <td className="rf2-admin__seat">{SEAT_LABEL[seatOf(u)]}</td>
                  <td>{u.managerId ? byId.get(u.managerId)?.displayName ?? '—' : '—'}</td>
                  <td><StatusChip tone={statusTone(u.status)} label={u.status} /></td>
                </tr>
              ))}
              {rows.length === 0 ? <tr><td colSpan={5}>No users match.</td></tr> : null}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="rf2-inline-note"><ShieldCheck aria-hidden="true" /> Interviewer is not a role. Any user picked as an interviewer can read that candidate’s CV and submit the scorecard, nothing else.</p>
      {open && users ? <UserDrawer user={open} users={users} onClose={() => go({ user: null })} onDone={done} /> : null}
      {drawer === 'tree' && users ? <TreeDrawer users={users} focus={params.get('focus')} onClose={() => go({ drawer: null, focus: null })} onDone={done} /> : null}
      {drawer === 'invite' ? <InviteDrawer onClose={() => go({ drawer: null })} onDone={done} /> : null}
    </div>
  );
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export function workSummary(w: OwnedWork): string[] {
  return [
    w.openApplicationsPrimary ? `${plural(w.openApplicationsPrimary, 'open file')} as primary recruiter` : '',
    w.openApplicationsTaskOwner ? `${plural(w.openApplicationsTaskOwner, 'open file')} as task owner` : '',
    w.openJobsPrimary ? `${plural(w.openJobsPrimary, 'open job')} as owner` : '',
    w.openRequisitions ? plural(w.openRequisitions, 'open requisition') : '',
  ].filter(Boolean);
}

/** User detail: deactivate (PATCH status) / reactivate; 409 USER_OWNS_OPEN_WORK → counts + reassign offer. */
function UserDrawer({ user, users, onClose, onDone }: { user: AdminUser; users: AdminUser[]; onClose: () => void; onDone: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [owned, setOwned] = useState<OwnedWork | null>(null);
  const [moved, setMoved] = useState<string | null>(null);
  const manager = users.find((u) => u.id === user.managerId) ?? null;
  const change = async (to: 'Active' | 'Inactive') => {
    setBusy(true); setErr(null);
    try {
      await setStatus(user.id, to);
      onDone(to === 'Inactive' ? `${user.displayName} deactivated. History stays.` : `${user.displayName} is active again.`);
    } catch (e) {
      const w = ownedWork(e);
      if (w) setOwned(w); else setErr((e as { message?: string })?.message || 'Could not save.');
    } finally { setBusy(false); }
  };
  const active = isActive(user);
  return (
    <DrawerV2 open onClose={onClose} kicker="User" title={user.displayName} subtitle={user.email}
      primaryAction={active
        ? <DangerConfirmButton icon={<UserMinus />} confirmLabel="Confirm deactivate" loading={busy} disabled={busy || !!owned} onConfirm={() => void change('Inactive')}>Deactivate</DangerConfirmButton>
        : <ButtonV2 icon={<UserCheck />} loading={busy} onClick={() => void change('Active')}>Reactivate</ButtonV2>}
      secondaryAction={<ButtonV2 kind="secondary" onClick={onClose}>Close</ButtonV2>}>
      <dl className="rf2-decide__facts">
        <dt>Role</dt><dd>{SEAT_LABEL[seatOf(user)]}{user.roles.length ? ` · ${user.roles.map((r) => r.name).join(', ')}` : ''}</dd>
        <dt>Reports to</dt><dd>{manager?.displayName ?? '—'}</dd>
        <dt>Status</dt><dd><StatusChip tone={statusTone(user.status)} label={user.status} /></dd>
        <dt>Last sign-in</dt><dd>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('en-GB', { timeZone: 'Africa/Cairo', dateStyle: 'medium', timeStyle: 'short' }) : 'Never'}</dd>
      </dl>
      {err ? <p className="rf2-form-error" role="alert">{err}</p> : null}
      {owned ? <OwnedWorkPanel user={user} users={users} manager={manager} owned={owned} onMoved={(m) => { setOwned(null); setMoved(m); }} /> : null}
      {moved ? <p className="rf2-inline-note" data-tone="success" role="status"><CircleCheck aria-hidden="true" /> {moved}</p> : null}
      <p className="rf2-inline-note"><Info aria-hidden="true" /> Deactivating keeps every file, note and audit entry. Nothing is deleted.</p>
    </DrawerV2>
  );
}

function OwnedWorkPanel({ user, users, manager, owned, onMoved }: { user: AdminUser; users: AdminUser[]; manager: AdminUser | null; owned: OwnedWork; onMoved: (m: string) => void }) {
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  // #21: the reason comes from master data 'reassign-reasons' ("Other" + note), same as the manager's Reassign.
  const [reasons, setReasons] = useState<string[] | null>(null);
  useEffect(() => { let live = true; void fetchReassignReasons().then((r) => live && setReasons(r)); return () => { live = false; }; }, []);
  const isOther = !!reasons && /^other$/i.test(reason);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; adminBlocked?: boolean } | null>(null);
  const [fieldErr, setFieldErr] = useState<{ to?: string; reason?: string; note?: string }>({});
  const files = owned.openApplicationsPrimary + owned.openApplicationsTaskOwner;
  const peers = users.filter((u) => u.id !== user.id && isActive(u) && seatOf(u) !== 'admin').sort((a, b) => a.displayName.localeCompare(b.displayName));
  const clear = () => { setMsg(null); setFieldErr({}); };
  const move = async () => {
    if (!to) return setMsg({ text: 'Pick who takes the files.' });
    if (reasons && !reason) return setFieldErr({ reason: 'Pick a reason.' });
    if (!reasons && reason.trim().length < 3) return setFieldErr({ reason: 'A reason is required (at least 3 characters); it is kept in the audit log.' });
    if (isOther && note.trim().length < 3) return setFieldErr({ note: '"Other" needs a short note (at least 3 characters).' });
    setBusy(true); clear();
    try {
      await overrideReassign(user.id, to, reason.trim(), isOther ? note : undefined);
      onMoved(`Files moved to ${users.find((u) => u.id === to)?.displayName ?? 'the new owner'} (admin override, in Audit). Deactivate again.`);
    } catch (e) {
      const d = domainError(e);
      const x = e as { statusCode?: number; message?: string };
      if (d?.code === 'OVERRIDE_NOT_ALLOWED') {
        setMsg({ adminBlocked: true, text: `${x.message || 'This override is not available yet.'} ${manager ? `Meanwhile ${manager.displayName} (their manager) can move them from Team work → Reassign.` : ''}`.trim() });
      } else if (d?.code === 'REASON_REQUIRED' || fieldError(serverFormErrors(e), 'note')) {
        setFieldErr({ note: fieldError(serverFormErrors(e), 'note') ?? '"Other" needs a short note (at least 3 characters).' });
      } else if (x.statusCode === 403 && !d?.code?.startsWith('REASSIGN_')) {
        setMsg({ text: 'Only an administrator can use an override.' });
      } else {
        // #23 400 field/fields and the B7 reassign codes share the manager Reassign mapping.
        const r = reassignError(e);
        if (r.field === 'to' || r.field === 'reason') setFieldErr({ [r.field]: r.text });
        else setMsg({ text: r.text });
      }
    } finally { setBusy(false); }
  };
  return (
    <section className="rf2-admin__owned" role="alert" aria-label="Open work blocks deactivation">
      <p className="rf2-jtable__name"><TriangleAlert aria-hidden="true" /> {user.displayName} still owns open work</p>
      {owned.countsUnknown ? <p className="rf2-jtable__sub">The server did not say how much (no counts). Moving all their open files is still possible.</p> : <ul>{workSummary(owned).map((l) => <li key={l}>{l}</li>)}</ul>}
      <p className="rf2-jtable__sub">Move it first, then deactivate. Jobs and requisitions are changed on the job or requisition itself.</p>
      {files > 0 || owned.countsUnknown ? (
        <>
          <SelectV2 label="Move their open files to" value={to} onChange={(e) => { setTo(e.target.value); clear(); }} error={fieldErr.to}>
            <option value="">Choose a person</option>
            {peers.map((p) => <option key={p.id} value={p.id}>{p.displayName} · {SEAT_LABEL[seatOf(p)]}</option>)}
          </SelectV2>
          {reasons ? (
            <SelectV2 label="Reason (admin override, kept in Audit)" required value={reason} onChange={(e) => { setReason(e.target.value); clear(); }} error={fieldErr.reason} hint="From the Reassign reasons list in Master data.">
              <option value="">Choose a reason</option>
              {reasons.map((r) => <option key={r} value={r}>{r}</option>)}
            </SelectV2>
          ) : (
            <TextareaV2 label="Reason (admin override, kept in Audit)" required rows={2} value={reason} onChange={(e) => { setReason(e.target.value); clear(); }} placeholder={`${user.displayName.split(' ')[0]} is leaving`} error={fieldErr.reason} />
          )}
          {isOther ? <TextareaV2 label="Say why" required rows={2} value={note} onChange={(e) => { setNote(e.target.value); clear(); }} error={fieldErr.note} /> : null}
          {msg ? <p className={msg.adminBlocked ? 'rf2-inline-note' : 'rf2-form-error'}>{msg.adminBlocked ? <Info aria-hidden="true" /> : null}{msg.text}</p> : null}
          <ButtonV2 kind="secondary" icon={<ArrowRight />} loading={busy} onClick={() => void move()}>{owned.countsUnknown ? 'Reassign all open files' : `Reassign ${plural(files, 'file')}`}</ButtonV2>
          <p className="rf2-jtable__sub">Uses the admin override (file.reassign). Jobs keep their owner.</p>
        </>
      ) : null}
    </section>
  );
}

/** A03 Reporting tree: who reports to whom; edit one line (PATCH /users/:id {managerId}). */
function TreeDrawer({ users, focus, onClose, onDone }: { users: AdminUser[]; focus: string | null; onClose: () => void; onDone: (m: string) => void }) {
  const activeUsers = users.filter((u) => u.status !== 'Inactive');
  const nodes = flatten(buildTree(activeUsers));
  const [sel, setSel] = useState<string | null>(focus);
  const picked = activeUsers.find((u) => u.id === sel) ?? null;
  const [mgr, setMgr] = useState<string>(picked?.managerId ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mgrErr, setMgrErr] = useState<string | undefined>();
  useEffect(() => { setMgr(picked?.managerId ?? ''); setErr(null); setMgrErr(undefined); }, [picked?.id, picked?.managerId]);
  const options = picked ? activeUsers.filter((u) => u.id !== picked.id && seatOf(u) !== 'employee' && !isDescendant(activeUsers, picked.id, u.id)).sort((a, b) => a.displayName.localeCompare(b.displayName)) : [];
  const directs = (id: string) => activeUsers.filter((u) => u.managerId === id).length;
  const save = async () => {
    if (!picked) return;
    setBusy(true); setErr(null); setMgrErr(undefined);
    try { await setManager(picked.id, mgr || null); onDone(`${picked.displayName} now reports to ${activeUsers.find((u) => u.id === mgr)?.displayName ?? 'nobody'}.`); }
    catch (e) {
      const f = serverFormErrors(e);
      const onMgr = fieldError(f, 'managerId');
      if (onMgr) { setMgrErr(onMgr); setErr(bannerError(f, ['managerId'])); }
      else setErr(f.message || 'Could not save.');
    } finally { setBusy(false); }
  };
  return (
    <DrawerV2 open onClose={onClose} kicker="Reporting tree" title="Who reports to whom"
      primaryAction={<ButtonV2 icon={<CircleCheck />} loading={busy} disabled={!picked || busy || (mgr || null) === (picked?.managerId ?? null)} onClick={() => void save()}>Save reporting line</ButtonV2>}
      secondaryAction={<ButtonV2 kind="secondary" onClick={onClose}>Cancel</ButtonV2>}>
      <ul className="rf2-admin__tree" aria-label="Reporting tree">
        {nodes.map((n) => (
          <li key={n.user.id} style={{ paddingInlineStart: `${n.depth * 24}px` }}>
            <button type="button" className="rf2-admin__node" aria-pressed={sel === n.user.id} onClick={() => setSel(n.user.id)}>
              {n.depth ? <ArrowRight aria-hidden="true" className="rf2-admin__arrow" /> : null}
              <Avatar name={n.user.displayName} />
              <span><span className="rf2-jtable__name">{n.user.displayName}</span>
                <span className="rf2-jtable__sub">{[subLine(n.user), n.user.status !== 'Active' ? n.user.status.toLowerCase() : '', directs(n.user.id) ? plural(directs(n.user.id), 'direct report') : ''].filter(Boolean).join(' · ')}</span></span>
            </button>
          </li>
        ))}
      </ul>
      {picked ? (
        <div className="rf2-admin__edit">
          <p className="rf2-jtable__name">Edit reporting line — {picked.displayName}</p>
          <SelectV2 label={`${picked.displayName} reports to`} value={mgr} onChange={(e) => { setMgr(e.target.value); setMgrErr(undefined); }} error={mgrErr}>
            <option value="">Nobody (top of the tree)</option>
            {options.map((u) => <option key={u.id} value={u.id}>{u.displayName} · {SEAT_LABEL[seatOf(u)]}</option>)}
          </SelectV2>
          {err ? <p className="rf2-form-error" role="alert">{err}</p> : null}
        </div>
      ) : <p className="rf2-jtable__sub">Pick a person to change who they report to.</p>}
      <p className="rf2-inline-note"><Info aria-hidden="true" /> Managers see Team work and Team result for their direct reports only. Changing a line moves those views, not the files; file owners stay the same.</p>
    </DrawerV2>
  );
}

function InviteDrawer({ onClose, onDone }: { onClose: () => void; onDone: (m: string) => void }) {
  const [roles, setRoles] = useState<AdminRole[] | null>(null);
  const [f, setF] = useState({ displayName: '', email: '', roleId: '' });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { void fetchRoles().then((r) => setRoles(r.filter((x) => x.status === 'Active'))).catch(() => setRoles([])); }, []);
  const submit = async () => {
    const e: Record<string, string> = {};
    if (!f.displayName.trim()) e.displayName = 'Enter a name.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) e.email = 'Enter a valid email.';
    setErrs(e); if (Object.keys(e).length) return;
    setBusy(true);
    try { await inviteUser({ displayName: f.displayName.trim(), email: f.email.trim(), ...(f.roleId ? { roleIds: [f.roleId] } : {}) }); onDone(`Invitation sent to ${f.email.trim()}.`); }
    catch (x) {
      const sf = serverFormErrors(x);
      if (Object.keys(sf.byField).length) {
        const inline = { displayName: fieldError(sf, 'displayName'), email: fieldError(sf, 'email'), role: fieldError(sf, 'roleIds') };
        const banner = bannerError(sf, ['displayName', 'email', 'roleIds']);
        setErrs(Object.fromEntries(Object.entries({ ...inline, ...(banner ? { form: banner } : {}) }).filter(([, v]) => v)) as Record<string, string>);
      } else setErrs({ form: (x as { message?: string })?.message || 'Could not invite.' });
    } finally { setBusy(false); }
  };
  return (
    <DrawerV2 open onClose={onClose} kicker="Users" title="Invite user"
      primaryAction={<ButtonV2 icon={<UserPlus />} loading={busy} onClick={() => void submit()}>Send invitation</ButtonV2>}
      secondaryAction={<ButtonV2 kind="secondary" onClick={onClose}>Cancel</ButtonV2>}>
      <InputV2 label="Name" required value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} error={errs.displayName} />
      <InputV2 label="Email" required type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} error={errs.email} />
      <SelectV2 label="Role" value={f.roleId} onChange={(e) => setF({ ...f, roleId: e.target.value })} disabled={!roles} error={errs.role}>
        <option value="">Choose later</option>
        {(roles ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </SelectV2>
      {errs.form ? <p className="rf2-form-error" role="alert">{errs.form}</p> : null}
    </DrawerV2>
  );
}
