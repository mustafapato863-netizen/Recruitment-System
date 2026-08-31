import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { RoleRecord, UserRecord } from '@recruitflow/contracts';
import { fetchApi } from '../api/client';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { Alert } from '../components/ui/Alert';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { DataToolbar } from '../components/ui/DataToolbar';
import { FilterChip } from '../components/ui/FilterChips';
import { FormField } from '../components/ui/FormField';
import { Input } from '../components/ui/Input';
import { MetricCard } from '../components/ui/MetricCard';
import { ResponsiveDataView, type ResponsiveDataColumn } from '../components/ui/ResponsiveDataView';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Select } from '../components/ui/Select';
import { TableSkeleton } from '../components/ui/Skeleton';
import { Icon } from '../components/Icon';
import './PageEnhancementsV2.css';

const emptyUserForm = { email: '', displayName: '', password: '', roles: [] as string[] };
const emptyRoleForm = { code: '', name: '' };
const USER_STATUS_FILTERS = ['', 'Active', 'Suspended'] as const;

const userColumns: ResponsiveDataColumn<UserRecord>[] = [
  {
    key: 'user',
    header: 'User',
    priority: 'primary',
    render: (user) => (
      <div className="flex items-center gap-2.5">
        <Avatar initials={user.displayName.slice(0, 2).toUpperCase() || 'US'} size="sm" />
        <span className="min-w-0 truncate font-bold text-rf-ink">{user.displayName}</span>
      </div>
    ),
  },
  {
    key: 'email',
    header: 'Email',
    priority: 'secondary',
    render: (user) => <span className="font-medium text-rf-ink-muted">{user.email}</span>,
  },
  {
    key: 'roles',
    header: 'Assigned roles',
    priority: 'secondary',
    render: (user) => (
      <div className="flex flex-wrap gap-1.5">
        {user.roles.length > 0 ? user.roles.map((role) => (
          <Badge key={role.code} variant="neutral" className="font-mono">{role.name}</Badge>
        )) : <span className="font-medium text-rf-ink-muted">No roles assigned</span>}
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    priority: 'secondary',
    render: (user) => <StatusBadge status={user.status} />,
  },
];

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

  useEffect(() => {
    void load();
  }, []);

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

  const activeUserCount = users.filter((u) => u.status === 'Active').length;

  return (
    <PageFrame
      eyebrow="Administration"
      title="Users & Roles"
      description="Manage enterprise users, assign RBAC security roles, and enforce least-privilege workflow access."
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={() => void load()}>
            <Icon name="refresh-cw" size={13} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </Button>
          <Button variant="secondary" size="sm" onClick={() => { setFormError(''); setIsRoleOpen(true); }}>
            <Icon name="plus" size={13} />
            Create role
          </Button>
          <Button variant="primary" size="sm" onClick={() => { setFormError(''); setIsInviteOpen(true); }}>
            <Icon name="plus" size={14} />
            Create user
          </Button>
        </>
      }
    >
      {error && (
        <Alert
          tone="danger"
          title="Unable to load users"
          action={
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              <Icon name="refresh-cw" size={13} />
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total Users" value={users.length} detail="Authorized accounts" tone="action" icon={<Icon name="users" size={14} />} />
        <MetricCard label="Active Users" value={activeUserCount} detail="Enabled logins" tone="success" icon={<Icon name="check-circle" size={14} />} />
        <MetricCard label="Configured Roles" value={roles.length} detail="RBAC permission sets" tone="info" icon={<Icon name="grid-squares" size={14} />} />
        <MetricCard label="Access Policy" value="Role-Based" detail="Strict permission guards" tone="neutral" icon={<Icon name="lock" size={14} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 rf-table-shell overflow-hidden rounded-2xl border border-rf-border-subtle bg-white shadow-xs">
          <DataToolbar
            search={(
              <Input
                aria-label="Search users"
                placeholder="Search user name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            )}
            filters={(
              <>
                <div className="min-w-[10rem] flex-1 sm:flex-none">
                  <Select aria-label="Filter by role" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                    <option value="">All roles</option>
                    {roles.map((role) => <option key={role.id} value={role.code}>{role.name}</option>)}
                  </Select>
                </div>
                <div className="flex flex-wrap gap-1.5" aria-label="Filter users by status">
                  {USER_STATUS_FILTERS.map((status) => (
                    <FilterChip key={status || 'all'} label={status || 'All statuses'} isActive={statusFilter === status} onClick={() => setStatusFilter(status)} />
                  ))}
                </div>
              </>
            )}
            activeFilters={roleFilter || statusFilter ? (
              <>
                {roleFilter && <FilterChip label={`Role: ${roles.find((role) => role.code === roleFilter)?.name ?? roleFilter}`} onRemove={() => setRoleFilter('')} />}
                {statusFilter && <FilterChip label={`Status: ${statusFilter}`} onRemove={() => setStatusFilter('')} />}
              </>
            ) : undefined}
          />

          {isLoading ? (
            <TableSkeleton columns={4} rows={6} />
          ) : filteredUsers.length === 0 ? (
            <PageState kind="empty" title="No users found" description="Adjust your filters or create a user." />
          ) : (
            <ResponsiveDataView
              rows={filteredUsers}
              columns={userColumns}
              rowKey={(user) => user.id}
              label="Users"
              className="px-4 pb-4 sm:px-5 sm:pb-5"
            />
          )}
        </section>

        <aside className="rf-panel overflow-hidden rounded-2xl border border-rf-border-subtle bg-white shadow-xs">
          <SectionHeader
            title={`System roles (${roles.length})`}
            description="Role definitions and access tiers."
            density="compact"
            className="border-b border-rf-border-subtle p-5"
            actions={(
              <Button variant="secondary" size="sm" onClick={() => { setFormError(''); setIsRoleOpen(true); }}>
                <Icon name="plus" size={13} />
                Role
              </Button>
            )}
          />
          {roles.length === 0 ? (
            <PageState kind="empty" title="No roles configured" description="Create a role to define access." />
          ) : (
            <div className="flex flex-col gap-2.5 p-4">
              {roles.map((role) => (
                <div key={role.code} className="flex items-center justify-between gap-3 rounded-xl border border-rf-border-subtle bg-rf-surface-subtle p-3 transition-colors hover:bg-rf-surface-hover">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-bold text-rf-ink">{role.name}</div>
                    <div className="mt-0.5 truncate font-mono text-[10.5px] font-semibold text-rf-ink-muted">{role.code}</div>
                  </div>
                  <Badge variant={role.status === 'Active' ? 'success' : 'neutral'}>{role.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      {/* Create User Modal */}
      <Modal isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} title="Create System User">
        <form onSubmit={(e) => void submitUser(e)}>
          {formError && (
            <div className="mb-4">
              <Alert tone="danger" title="Error">
                {formError}
              </Alert>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField id="u-name" label="Full Name" required>
              <Input
                id="u-name"
                required
                placeholder="e.g. Ahmed Mahmoud"
                value={userForm.displayName}
                onChange={(e) => setUserForm({ ...userForm, displayName: e.target.value })}
              />
            </FormField>
            <FormField id="u-email" label="Email Address" required>
              <Input
                id="u-email"
                required
                type="email"
                placeholder="name@company.com"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
              />
            </FormField>
            <div className="sm:col-span-2">
              <FormField id="u-pass" label="Temporary Password" required>
                <Input
                  id="u-pass"
                  required
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                />
              </FormField>
            </div>
            <div className="sm:col-span-2">
              <FormField id="u-role" label="Assign Role">
                <Select
                  id="u-role"
                  value={userForm.roles[0] || ''}
                  onChange={(e) => setUserForm({ ...userForm, roles: e.target.value ? [e.target.value] : [] })}
                >
                  <option value="">No role</option>
                  {roles.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
                </Select>
              </FormField>
            </div>
          </div>
          <div className="flex gap-2 mt-6 justify-end">
            <Button variant="quiet" type="button" onClick={() => setIsInviteOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={isSubmitting} loadingLabel="Creating" type="submit">
              Create account
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Role Modal */}
      <Modal isOpen={isRoleOpen} onClose={() => setIsRoleOpen(false)} title="Define System Role">
        <form onSubmit={(e) => void submitRole(e)}>
          {formError && (
            <div className="mb-4">
              <Alert tone="danger" title="Error">
                {formError}
              </Alert>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField id="r-code" label="Role Code" required hint="Uppercase identifier like RECRUITER or HR_MANAGER">
              <Input
                id="r-code"
                required
                placeholder="e.g. AUDITOR"
                value={roleForm.code}
                onChange={(e) => setRoleForm({ ...roleForm, code: e.target.value })}
              />
            </FormField>
            <FormField id="r-name" label="Role Name" required>
              <Input
                id="r-name"
                required
                placeholder="e.g. Compliance Auditor"
                value={roleForm.name}
                onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
              />
            </FormField>
          </div>
          <div className="flex gap-2 mt-6 justify-end">
            <Button variant="quiet" type="button" onClick={() => setIsRoleOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={isSubmitting} loadingLabel="Saving" type="submit">
              Save role
            </Button>
          </div>
        </form>
      </Modal>
    </PageFrame>
  );
}
