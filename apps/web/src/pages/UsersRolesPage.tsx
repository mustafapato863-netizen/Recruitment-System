import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { RoleRecord, UserRecord } from '@recruitflow/contracts';
import { fetchApi } from '../api/client';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import '../styles/admin.css';

const emptyUserForm = { email: '', displayName: '', password: '' };
const emptyRoleForm = { code: '', name: '' };

export function UsersRolesPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isRoleOpen, setIsRoleOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [roleForm, setRoleForm] = useState(emptyRoleForm);

  const load = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [usersRes, rolesRes] = await Promise.all([
        fetchApi<UserRecord[] | { data?: UserRecord[] }>('/users'),
        fetchApi<RoleRecord[] | { data?: RoleRecord[] }>('/roles'),
      ]);
      setUsers(Array.isArray(usersRes) ? usersRes : usersRes.data || []);
      setRoles(Array.isArray(rolesRes) ? rolesRes : rolesRes.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users and roles');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filteredUsers = useMemo(() => users.filter((user) => {
    const searchable = `${user.displayName} ${user.email}`.toLowerCase();
    const matchesSearch = !search || searchable.includes(search.toLowerCase());
    const matchesRole = !roleFilter || user.roles.some((role) => role.code === roleFilter);
    const matchesStatus = !statusFilter || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  }), [roleFilter, search, statusFilter, users]);

  const submitUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    setIsSubmitting(true);
    try {
      await fetchApi('/users', { method: 'POST', body: JSON.stringify(userForm) });
      setUserForm(emptyUserForm);
      setIsInviteOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitRole = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    setIsSubmitting(true);
    try {
      await fetchApi('/roles', { method: 'POST', body: JSON.stringify({ ...roleForm, code: roleForm.code.toUpperCase() }) });
      setRoleForm(emptyRoleForm);
      setIsRoleOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to create role');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <section className="page-heading">
        <div>
          <span className="eyebrow">Administration</span>
          <h1>Users &amp; Roles</h1>
          <p>Manage system access and assign permissions.</p>
        </div>
        <div className="inline-actions">
          <button className="quiet-button" type="button" onClick={() => { setFormError(''); setIsRoleOpen(true); }}>Create Role</button>
          <button className="primary-button" type="button" onClick={() => { setFormError(''); setIsInviteOpen(true); }}>Create User</button>
        </div>
      </section>

      {error && <div className="alert error-alert" role="alert"><span>{error}</span><button type="button" onClick={() => void load()}>Retry</button></div>}

      <div className="page-layout">
        <div className="content-area">
          <div className="toolbar">
            <div className="filter">
              <input aria-label="Search users" type="search" placeholder="Search users..." value={search} onChange={(event) => setSearch(event.target.value)} />
              <select aria-label="Filter by role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                <option value="">All Roles</option>
                {roles.map((role) => <option key={role.id} value={role.code}>{role.name}</option>)}
              </select>
              <select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          {isLoading ? <div className="alert loading-alert" role="status">Loading users...</div> : (
            <div className="table-scroll" role="region" aria-label="Users table" tabIndex={0}>
              <table className="data-table">
                <thead><tr><th>Name</th><th>Email</th><th>Roles</th><th>Status</th><th>Last Login</th></tr></thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td><strong>{user.displayName}</strong></td>
                      <td>{user.email}</td>
                      <td><div className="chip-catalog compact">{user.roles.map((role) => <span key={role.id} className="chip">{role.name}</span>)}</div></td>
                      <td><StatusBadge status={user.status} /></td>
                      <td>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}</td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && <tr><td colSpan={5} className="table-empty">No users match the current filters.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="sidebar-panel">
          <h3>System Roles</h3>
          <div className="chip-catalog">{roles.map((role) => <span key={role.id} className="chip">{role.name}</span>)}</div>
          <h3 className="sidebar-panel-section-title">Sensitive Permissions</h3>
          <div className="nav-list nav-list-disabled" aria-label="Permission areas">
            <span>Manage Users</span>
            <span>Manage Master Data</span>
            <span>Approve Vacancies</span>
          </div>
        </aside>
      </div>

      <Modal isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} title="Create User">
        <form onSubmit={submitUser}>
          {formError && <div className="alert error-alert" role="alert">{formError}</div>}
          <div className="form-grid">
            <label className="full-field">Email <input required type="email" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} /></label>
            <label className="full-field">Display name <input required type="text" value={userForm.displayName} onChange={(event) => setUserForm({ ...userForm, displayName: event.target.value })} /></label>
            <label className="full-field">Temporary password <input required minLength={8} type="password" value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} /></label>
          </div>
          <div className="form-actions"><button className="quiet-button" type="button" onClick={() => setIsInviteOpen(false)}>Cancel</button><button className="primary-button" disabled={isSubmitting} type="submit">{isSubmitting ? 'Creating...' : 'Create User'}</button></div>
        </form>
      </Modal>

      <Modal isOpen={isRoleOpen} onClose={() => setIsRoleOpen(false)} title="Create Role">
        <form onSubmit={submitRole}>
          {formError && <div className="alert error-alert" role="alert">{formError}</div>}
          <div className="form-grid">
            <label className="full-field">Code <input required pattern="[A-Za-z0-9_-]+" type="text" value={roleForm.code} onChange={(event) => setRoleForm({ ...roleForm, code: event.target.value })} /></label>
            <label className="full-field">Name <input required type="text" value={roleForm.name} onChange={(event) => setRoleForm({ ...roleForm, name: event.target.value })} /></label>
          </div>
          <div className="form-actions"><button className="quiet-button" type="button" onClick={() => setIsRoleOpen(false)}>Cancel</button><button className="primary-button" disabled={isSubmitting} type="submit">{isSubmitting ? 'Creating...' : 'Create Role'}</button></div>
        </form>
      </Modal>
    </div>
  );
}
