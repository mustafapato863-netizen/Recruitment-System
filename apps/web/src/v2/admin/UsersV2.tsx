import { bannerError, fieldError, serverFormErrors } from '../forms/serverErrors';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight, CircleCheck, Info, Network, RotateCw, Search, ShieldCheck, UserMinus, UserPlus, UserCheck, Users, TriangleAlert } from 'lucide-react';
import { ButtonV2, DangerConfirmButton, DrawerV2, EmptyStateV2, InputV2, SelectV2, SkeletonV2, StatusChip, TextareaV2 } from '../../components/v2';
import { SEAT_LABEL, SEATS, type Seat } from '../seat';
import { domainError } from '../api/gates';
import { override403Text } from './overrideErrors';
import { fetchReassignReasons, reassignError } from '../api/teamWork';
import { fetchOptions, type CatalogValue } from './configApi';
import { fetchRoles, roleSeat, type AdminRole } from './rolesApi';
import { getInitials } from '../userIdentity';
import {
  fetchUsers, inviteUser, isActive, isDescendant, ownedWork, seatOf, setStatus, statusTone, updateUser,
  type AdminUser, type OwnedWork,
  overrideReassign,
} from './usersApi';
import { AdminWorkspaceHeader } from './AdminWorkspaceHeader';
import { ReportingTreeV2 } from './ReportingTreeV2';
import { useCachedResource } from '../api/useCachedResource';
import '../pages/jobs.css';
import './admin.css';

const Avatar = ({ name }: { name: string }) => <span className="rf2-avatar rf2-team__avatar" aria-hidden="true">{getInitials(name)}</span>;
/** Branch wins when it is non-empty; otherwise catalog lookup by branchId; otherwise the site; otherwise an em dash. */
function siteOf(u: Pick<AdminUser, 'branchId' | 'branchName' | 'branch' | 'site'>, branchesById?: ReadonlyMap<string, string>): string {
  if (u.branchName) return u.branchName;
  if (u.branch?.name) return u.branch.name;
  if (u.branchId && branchesById?.has(u.branchId)) return branchesById.get(u.branchId)!;
  if (u.site) return u.site;
  return '—';
}
const USER_PAGE_SIZE = 10;

/** A02 Users (Admin seat). Three seats; deactivate, never delete. */
export function UsersV2() {
  const [params, setParams] = useSearchParams();
  const [attempt, setAttempt] = useState(0);
  const [q, setQ] = useState('');
  const [seat, setSeat] = useState<'all' | Seat>('all');
  const [branchId, setBranchId] = useState('');
  const [status, setStatusFilter] = useState('');
  const [branchAttempt, setBranchAttempt] = useState(0);
  const [page, setPage] = useState(1);

  const usersRes = useCachedResource<AdminUser[]>({
    key: 'admin:users',
    attempt,
    fetcher: fetchUsers,
  });
  const branchesRes = useCachedResource<CatalogValue[]>({
    key: 'admin:branches',
    attempt: branchAttempt,
    fetcher: () => fetchOptions('branches'),
  });
  const users = usersRes.kind === 'ready' ? usersRes.data : null;
  const error = usersRes.kind === 'error' ? ((usersRes.error as { message?: string })?.message || 'Something went wrong.') : null;
  const branches = branchesRes.kind === 'ready' ? branchesRes.data : null;
  const branchError = branchesRes.kind === 'error' ? ((branchesRes.error as { message?: string })?.message || 'Could not load branches.') : null;
  const go = (patch: Record<string, string | null>) => {
    setParams((prev) => {
      const n = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) (v ? n.set(k, v) : n.delete(k));
      return n;
    });
  };
  const byId = useMemo(() => new Map((users ?? []).map((u) => [u.id, u])), [users]);
  const branchesById = useMemo(() => new Map((branches ?? []).map((b) => [b.id, b.name])), [branches]);
  const filteredRows = useMemo(() => (users ?? []).filter((u) =>
    (seat === 'all' || seatOf(u) === seat)
    && (!branchId || u.branchId === branchId || (!u.branchId && branchesById.get(branchId) === siteOf(u, branchesById)))
    && (!status || u.status === status)
    && (!q.trim() || `${u.displayName} ${u.email}`.toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a, b) => Number(b.status !== 'Inactive') - Number(a.status !== 'Inactive') || a.displayName.localeCompare(b.displayName)), [users, q, seat, branchId, branchesById, status]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / USER_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rows = filteredRows.slice((currentPage - 1) * USER_PAGE_SIZE, currentPage * USER_PAGE_SIZE);
  const firstShown = filteredRows.length ? (currentPage - 1) * USER_PAGE_SIZE + 1 : 0;
  const lastShown = Math.min(currentPage * USER_PAGE_SIZE, filteredRows.length);
  const open = users?.find((u) => u.id === params.get('user')) ?? null;
  const drawer = params.get('drawer');
  const view = params.get('view') ?? 'directory';
  const [note, setNote] = useState<string | null>(null);
  const done = (m: string) => { setNote(m); go({ user: null, drawer: null, focus: null }); setAttempt((n) => n + 1); };
  const changeFilter = (change: () => void) => { change(); setPage(1); };
  const activeCount = useMemo(() => (users ?? []).filter(isActive).length, [users]);
  const managerCount = useMemo(() => (users ?? []).filter((u) => isActive(u) && seatOf(u) !== 'employee').length, [users]);
  const assignedLinesCount = useMemo(
    () => (users ?? []).filter((u) => isActive(u) && Boolean(u.managerId && byId.has(u.managerId))).length,
    [users, byId],
  );
  const unassignedUsers = useMemo(
    () => (users ?? []).filter((u) => isActive(u) && seatOf(u) === 'employee' && (!u.managerId || !byId.has(u.managerId))),
    [users, byId],
  );

  const viewSwitcher = (
    <div className="rf2-segmented rf2-users-view-switcher" role="tablist" aria-label="Users workspace view" style={{ alignSelf: 'flex-start' }}>
      <button
        type="button"
        role="tab"
        aria-selected={view !== 'tree'}
        className="rf2-segmented__btn"
        onClick={() => go({ view: null })}
      >
        <Users size={14} aria-hidden="true" />
        <span>User Directory</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === 'tree'}
        className="rf2-segmented__btn"
        onClick={() => go({ view: 'tree' })}
      >
        <Network size={14} aria-hidden="true" />
        <span>Visual Org Chart &amp; Reporting Tree</span>
      </button>
    </div>
  );

  if (view === 'tree') {
    return (
      <div className="rf2-jobs rf2-admin">
        <AdminWorkspaceHeader
          group="Users & Access"
          title="Users & Reporting Hierarchy"
          subtitle="Interactive organizational hierarchy, reporting lines, and manager oversight structure."
        />
        {viewSwitcher}
        <ReportingTreeV2 hideHeader />
      </div>
    );
  }

  return (
    <div className="rf2-jobs rf2-admin">
      <AdminWorkspaceHeader
        group="Users & Access"
        title="Users"
        subtitle="Manage directory access, reporting lines and account status."
      />
      {viewSwitcher}
      {note ? <p className="rf2-inline-note" data-tone="success" role="status"><CircleCheck aria-hidden="true" /> {note}</p> : null}
      {users ? (
        <ul className="rf2-admin-kpis" aria-label="Directory summary">
          <li className="rf2-admin-kpi">
            <span className="rf2-admin-kpi__icon" aria-hidden="true"><Users /></span>
            <span className="rf2-admin-kpi__copy">
              <span className="rf2-admin-kpi__value">{activeCount}</span>
              <span className="rf2-admin-kpi__label">Active users</span>
              <span className="rf2-admin-kpi__sub">{users.length} total in directory</span>
            </span>
          </li>
          <li className="rf2-admin-kpi">
            <span className="rf2-admin-kpi__icon" data-tone="success" aria-hidden="true"><ShieldCheck /></span>
            <span className="rf2-admin-kpi__copy">
              <span className="rf2-admin-kpi__value">{managerCount}</span>
              <span className="rf2-admin-kpi__label">Managers &amp; admins</span>
              <span className="rf2-admin-kpi__sub">Eligible reporting leads</span>
            </span>
          </li>
          <li className="rf2-admin-kpi rf2-admin-kpi--action">
            <button
              type="button"
              className="rf2-admin-kpi__btn"
              onClick={() => go({ view: 'tree' })}
            >
              <span className="rf2-admin-kpi__icon" aria-hidden="true"><Network /></span>
              <span className="rf2-admin-kpi__copy">
                <span className="rf2-admin-kpi__value">{assignedLinesCount}</span>
                <span className="rf2-admin-kpi__label">Reporting lines</span>
                <span className="rf2-admin-kpi__sub">
                  <span>Open visual org chart</span>
                  <ChevronRight size={14} aria-hidden="true" />
                </span>
              </span>
            </button>
          </li>
          {unassignedUsers.length > 0 ? (
            <li className="rf2-admin-kpi rf2-admin-kpi--action">
              <button
                type="button"
                className="rf2-admin-kpi__btn"
                onClick={() => go({ view: 'tree' })}
              >
                <span className="rf2-admin-kpi__icon" data-tone="warning" aria-hidden="true"><TriangleAlert /></span>
                <span className="rf2-admin-kpi__copy">
                  <span className="rf2-admin-kpi__value" data-tone="warning">{unassignedUsers.length}</span>
                  <span className="rf2-admin-kpi__label">Needs manager</span>
                  <span className="rf2-admin-kpi__sub">
                    <span>Open visual org chart</span>
                    <ChevronRight size={14} aria-hidden="true" />
                  </span>
                </span>
              </button>
            </li>
          ) : (
            <li className="rf2-admin-kpi">
              <span className="rf2-admin-kpi__icon" data-tone="success" aria-hidden="true"><CircleCheck /></span>
              <span className="rf2-admin-kpi__copy">
                <span className="rf2-admin-kpi__value">0</span>
                <span className="rf2-admin-kpi__label">Unassigned</span>
                <span className="rf2-admin-kpi__sub">All employees mapped</span>
              </span>
            </li>
          )}
        </ul>
      ) : null}
      <div className="rf2-admin-filterbar rf2-admin-toolbar rf2-admin-users__toolbar">
        <div className="rf2-admin__filterset">
          <InputV2 label="Search users" fieldClassName="rf2-jobs__search rf2-sr-label" placeholder="Search users" leadingIcon={<Search />} value={q} onChange={(e) => changeFilter(() => setQ(e.target.value))} />
          <SelectV2 label="Role filter" fieldClassName="rf2-sr-label" value={seat} onChange={(e) => changeFilter(() => setSeat(e.target.value as 'all' | Seat))}>
            <option value="all">Role: All</option>
            {SEATS.map((s) => <option key={s} value={s}>Role: {SEAT_LABEL[s]}</option>)}
          </SelectV2>
          <SelectV2 label="Branch filter" fieldClassName="rf2-sr-label" value={branchId} disabled={!branches} onChange={(e) => changeFilter(() => setBranchId(e.target.value))}>
            <option value="">Branch: All</option>
            {(branches ?? []).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </SelectV2>
          <SelectV2 label="Status filter" fieldClassName="rf2-sr-label" value={status} onChange={(e) => changeFilter(() => setStatusFilter(e.target.value))}>
            <option value="">Status: All</option>
            <option value="Active">Status: Active</option>
            <option value="Invited">Status: Invited</option>
            <option value="Pending">Status: Pending</option>
            <option value="Inactive">Status: Inactive</option>
          </SelectV2>
        </div>
        <div className="rf2-admin-toolbar__end">
          <ButtonV2 icon={<UserPlus />} onClick={() => go({ drawer: 'invite' })}>Invite user</ButtonV2>
        </div>
      </div>
      {branchError ? <p className="rf2-form-error rf2-admin-users__option-error" role="alert">{branchError} <ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setBranchAttempt((n) => n + 1)}>Retry branches</ButtonV2></p> : null}
      {!users && !error ? <SkeletonV2 lines={6} label="Loading users…" /> : null}
      {error ? <div role="alert"><EmptyStateV2 title="Could not load users" body={error} action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Try again</ButtonV2>} /></div> : null}
      {users ? (
        <div className="rf2-panel rf2-admin__card">
          <table className="rf2-jtable" aria-label="Users">
            <thead><tr><th scope="col">User</th><th scope="col">Role</th><th scope="col">Reports to</th><th scope="col">Branch</th><th scope="col">Status</th><th scope="col"><span className="rf2-sr-label">Actions</span></th></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} data-inactive={!isActive(u) || undefined}>
                  <th scope="row">
                    <button type="button" className="rf2-admin__person" onClick={() => go({ user: u.id })} aria-label={`Open ${u.displayName}`}>
                      <Avatar name={u.displayName} />
                      <span><span className="rf2-jtable__name">{u.displayName}</span><span className="rf2-jtable__sub">{u.email}</span></span>
                    </button>
                  </th>
                  <td className="rf2-admin__seat">{SEAT_LABEL[seatOf(u)]}</td>
                  <td>{u.managerId && byId.has(u.managerId) ? byId.get(u.managerId)?.displayName : isActive(u) && seatOf(u) === 'employee' ? <button type="button" className="rf2-admin-users__orphan rf2-admin-users__orphan-btn" onClick={() => go({ view: 'tree' })} aria-label={`Assign manager for ${u.displayName}`}><TriangleAlert aria-hidden="true" /> Unassigned manager</button> : '—'}</td>
                  <td>{siteOf(u, branchesById)}</td>
                  <td><StatusChip tone={statusTone(u.status)} label={u.status} /></td>
                  <td><ButtonV2 kind="secondary" size="sm" aria-label={`Edit ${u.displayName}`} onClick={() => go({ user: u.id, drawer: 'edit' })}>Edit</ButtonV2></td>
                </tr>
              ))}
              {rows.length === 0 ? <tr><td colSpan={6}>No users match these filters.</td></tr> : null}
            </tbody>
          </table>
          <div className="rf2-admin-users__pagination" aria-label="User pagination">
            <p aria-live="polite">Showing {firstShown}–{lastShown} of {filteredRows.length} users</p>
            <div>
              <ButtonV2 kind="secondary" size="sm" icon={<ChevronLeft />} onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1}>Previous</ButtonV2>
              <ButtonV2 kind="secondary" size="sm" icon={<ChevronRight />} onClick={() => setPage(currentPage + 1)} disabled={currentPage >= pageCount}>Next</ButtonV2>
            </div>
          </div>
        </div>
      ) : null}
      <p className="rf2-inline-note"><ShieldCheck aria-hidden="true" /> Interviewer is not a role. Any user picked as an interviewer can read that candidate’s CV and submit the scorecard, nothing else.</p>
      {open && users && drawer === 'edit' ? <UserEditDrawer user={open} users={users} branches={branches} branchError={branchError} onRetryBranches={() => setBranchAttempt((n) => n + 1)} onClose={() => go({ user: null, drawer: null })} onDone={done} /> : null}
      {open && users && drawer !== 'edit' ? <UserDrawer user={open} users={users} onClose={() => go({ user: null })} onDone={done} /> : null}
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

type UserEditValues = { roleId: string; managerId: string; branchId: string; status: string };
const capabilityRoleCodes = new Set(['INTERVIEWER', 'LICENSE_SPECIALIST']);

function UserEditDrawer({
  user, users, branches, branchError, onRetryBranches, onClose, onDone,
}: {
  user: AdminUser;
  users: AdminUser[];
  branches: CatalogValue[] | null;
  branchError: string | null;
  onRetryBranches: () => void;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [roles, setRoles] = useState<AdminRole[] | null>(null);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [rolesAttempt, setRolesAttempt] = useState(0);
  const [form, setForm] = useState<UserEditValues>({
    roleId: user.roles[0]?.id ?? '',
    managerId: user.managerId ?? '',
    branchId: user.branchId ?? '',
    status: user.status,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fieldErrs, setFieldErrs] = useState<Record<string, string>>({});
  const [owned, setOwned] = useState<OwnedWork | null>(null);
  const [moved, setMoved] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setRoles(null);
    setRolesError(null);
    fetchRoles().then((items) => live && setRoles(items)).catch((e: { message?: string }) => live && setRolesError(e?.message || 'Could not load roles.'));
    return () => { live = false; };
  }, [rolesAttempt]);

  const roleOptions = useMemo(() => {
    if (!roles) return [];
    const activeMapped = roles.filter((role) => role.status === 'Active' && roleSeat(role));
    const existing = user.roles
      .filter((userRole) => !activeMapped.some((role) => role.id === userRole.id))
      .map((userRole) => roles.find((role) => role.id === userRole.id) ?? { ...userRole, status: 'Current', permissions: [] });
    const combined = [...activeMapped, ...existing];
    return combined.map((role) => ({ role, seat: roleSeat(role) }));
  }, [roles, user.roles]);
  const originalRoleIds = user.roles.map((role) => role.id);
  const originalRoleId = roleOptions.find(({ role }) => originalRoleIds.includes(role.id))?.role.id ?? '';
  useEffect(() => {
    if (roles) setForm((current) => ({ ...current, roleId: originalRoleId }));
  }, [roles, originalRoleId]);

  const roleReady = roles !== null && roleOptions.length > 0;
  const branchReady = branches !== null && !branchError;
  const initialBranchId = user.branchId ?? '';
  const initialManagerId = user.managerId ?? '';
  const dirty = form.roleId !== originalRoleId || form.managerId !== initialManagerId || form.branchId !== initialBranchId || form.status !== user.status;
  const manager = users.find((candidate) => candidate.id === user.managerId) ?? null;
  const managers = users
    .filter((candidate) => candidate.id !== user.id && isActive(candidate) && seatOf(candidate) !== 'employee' && !isDescendant(users, user.id, candidate.id))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  const currentManagerUnavailable = !!form.managerId && !managers.some((candidate) => candidate.id === form.managerId);
  const branchOptions = branches ?? [];
  const currentBranch = user.branchId && !branchOptions.some((branch) => branch.id === user.branchId)
    ? [{ id: user.branchId, name: user.branchName || user.site || 'Current branch', status: 'Active' }]
    : [];
  const setValue = (key: keyof UserEditValues) => (value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErr(null);
    setFieldErrs({});
  };
  const allowClose = () => !dirty || window.confirm('Discard your unsaved user changes?');
  const requestClose = () => { if (allowClose()) onClose(); };
  const save = async () => {
    if (!roleReady) return;
    setBusy(true);
    setErr(null);
    setFieldErrs({});
    setOwned(null);
    setMoved(null);
    try {
      const roleIds = form.roleId === originalRoleId
        ? originalRoleIds
        : [...new Set([...user.roles.filter((role) => capabilityRoleCodes.has(role.code.toUpperCase())).map((role) => role.id), ...(form.roleId ? [form.roleId] : [])])];
      await updateUser(user.id, {
        managerId: form.managerId || null,
        branchId: form.branchId || null,
        ...(form.status !== user.status ? { status: form.status as 'Active' | 'Inactive' } : {}),
        roleIds,
      });
      onDone(`${user.displayName} updated.`);
    } catch (e) {
      const work = ownedWork(e);
      if (work) {
        setOwned(work);
        return;
      }
      const fields = serverFormErrors(e);
      const mapped = {
        managerId: fieldError(fields, 'managerId'),
        branchId: fieldError(fields, 'branchId'),
        roleId: fieldError(fields, 'roleIds') ?? fieldError(fields, 'roleId'),
        status: fieldError(fields, 'status'),
      };
      setFieldErrs(Object.fromEntries(Object.entries(mapped).filter(([, message]) => message)) as Record<string, string>);
      setErr(bannerError(fields, ['managerId', 'branchId', 'roleIds', 'roleId', 'status']) || fields.message || (e as { message?: string })?.message || 'Could not save user changes.');
    } finally { setBusy(false); }
  };

  const loadStatus = rolesError ? 'error' : roles ? 'ready' : 'loading';
  return (
    <DrawerV2
      open
      onClose={onClose}
      confirmClose={allowClose}
      kicker="Edit user"
      title={`Edit ${user.displayName}`}
      subtitle={user.email}
      status={loadStatus}
      errorMessage={rolesError ?? undefined}
      onRetry={() => setRolesAttempt((current) => current + 1)}
      primaryAction={<ButtonV2 icon={<CircleCheck />} loading={busy} disabled={!dirty || !roleReady || !branchReady || busy || !form.roleId} onClick={() => void save()}>Save changes</ButtonV2>}
      secondaryAction={<ButtonV2 kind="secondary" onClick={requestClose} disabled={busy}>Cancel</ButtonV2>}
    >
      <SelectV2 label="Role and seat" required value={form.roleId} onChange={(event) => setValue('roleId')(event.target.value)} error={fieldErrs.roleId} disabled={!roleReady || busy}>
        <option value="">Choose a role</option>
        {roleOptions.map(({ role, seat }) => <option key={role.id} value={role.id}>{seat ? `${SEAT_LABEL[seat]} · ` : ''}{role.name}{role.status !== 'Active' ? ' (current)' : ''}</option>)}
      </SelectV2>
      <SelectV2 label="Reports to" value={form.managerId} onChange={(event) => setValue('managerId')(event.target.value)} error={fieldErrs.managerId} disabled={busy}>
        <option value="">Nobody</option>
        {currentManagerUnavailable ? <option value={form.managerId}>{manager?.displayName ?? 'Current manager unavailable'}</option> : null}
        {managers.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.displayName} · {SEAT_LABEL[seatOf(candidate)]}</option>)}
      </SelectV2>
      <SelectV2 label="Branch" value={form.branchId} onChange={(event) => setValue('branchId')(event.target.value)} error={fieldErrs.branchId} disabled={!branchReady || busy}>
        <option value="">No branch</option>
        {[...currentBranch, ...branchOptions].map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
      </SelectV2>
      {!branches && !branchError ? <p className="rf2-jtable__sub" role="status">Loading branch choices…</p> : null}
      {branchError ? <p className="rf2-form-error" role="alert">{branchError} <ButtonV2 kind="secondary" size="sm" icon={<RotateCw />} onClick={onRetryBranches}>Retry branches</ButtonV2></p> : null}
      {branches && branches.length === 0 ? <p className="rf2-jtable__sub">No active branches are available. The branch can be left unassigned.</p> : null}
      <SelectV2 label="Status" value={form.status} onChange={(event) => setValue('status')(event.target.value)} error={fieldErrs.status} disabled={busy}>
        {!['Active', 'Inactive'].includes(form.status) ? <option value={form.status}>{form.status} (current)</option> : null}
        <option value="Active">Active</option>
        <option value="Inactive">Deactivated</option>
      </SelectV2>
      {err ? <p className="rf2-form-error" role="alert">{err}</p> : null}
      {owned ? <OwnedWorkPanel user={user} users={users} manager={manager} owned={owned} onMoved={(message) => { setOwned(null); setMoved(message.replace('Deactivate again.', 'Save changes again.')); }} /> : null}
      {moved ? <p className="rf2-inline-note" data-tone="success" role="status"><CircleCheck aria-hidden="true" /> {moved}</p> : null}
      <p className="rf2-inline-note"><Info aria-hidden="true" /> Deactivation preserves the user’s history. If they own open work, reassign it before saving the status change.</p>
    </DrawerV2>
  );
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
        setMsg({ text: override403Text(e) });
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
