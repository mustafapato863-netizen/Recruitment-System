import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { NavigationItemRecord, PermissionRecord, RoleRecord, UserRecord } from '@recruitflow/contracts';
import { fetchApi } from '../api/client';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { Alert } from '../components/ui/Alert';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { CheckboxField } from '../components/ui/CheckboxField';
import { DataToolbar } from '../components/ui/DataToolbar';
import { FilterChip } from '../components/ui/FilterChips';
import { FormField } from '../components/ui/FormField';
import { Input } from '../components/ui/Input';
import { MetricCard } from '../components/ui/MetricCard';
import { ResponsiveDataView, type ResponsiveDataColumn } from '../components/ui/ResponsiveDataView';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Select } from '../components/ui/Select';
import { Switch } from '../components/ui/Switch';
import { Tabs } from '../components/ui/Tabs';
import { TableSkeleton } from '../components/ui/Skeleton';
import { Icon } from '../components/Icon';
import { UserResponsibilityModal } from '../components/UserResponsibilityModal';
import { AccessPolicyManager } from '../components/access/AccessPolicyManager';
import type {
  UserResponsibilitiesResponse,
  UserResponsibilityConfig,
} from '../types/accessControl';
import './PageEnhancementsV2.css';

export type DataVisibilityScope = 'ALL' | 'ASSIGNED_ONLY' | 'BRANCH' | 'DEPARTMENT';

export interface RoleRlsPolicy {
  dataScope: DataVisibilityScope;
  canViewPii: boolean;
  canViewSalary: boolean;
  canDownloadDocs: boolean;
  canApprove: boolean;
}

export interface RlsScopeOption {
  id: DataVisibilityScope;
  name: string;
  description: string;
}

export interface RlsGovernanceResponse {
  organizationId: string;
  roles: Record<string, RoleRlsPolicy>;
  userOverrides: Record<string, Partial<RoleRlsPolicy>>;
  availableScopes: RlsScopeOption[];
  availableRoles: Array<{ code: string; name: string }>;
}

const emptyUserForm = { email: '', displayName: '', password: '', roles: [] as string[] };
const emptyRoleForm = { name: '', permissionIds: [] as string[], pageKeys: [] as string[] };
const USER_STATUS_FILTERS = ['', 'Active', 'Suspended'] as const;

function responseList<T>(response: T[] | { data?: T[] }): T[] {
  return Array.isArray(response) ? response : response.data || [];
}


export function UsersRolesPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'access' | 'rls'>('users');
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
  const [rolePermissions, setRolePermissions] = useState<PermissionRecord[]>([]);
  const [roleNavigation, setRoleNavigation] = useState<NavigationItemRecord[]>([]);
  const [isRoleAccessLoading, setIsRoleAccessLoading] = useState(false);
  const [permissionSearch, setPermissionSearch] = useState('');
  const [pageSearch, setPageSearch] = useState('');

  // RLS Governance State
  const [, setRlsScopes] = useState<RlsScopeOption[]>([]);
  const [rlsPolicies, setRlsPolicies] = useState<Record<string, RoleRlsPolicy>>({});
  const [isRlsSaving, setIsRlsSaving] = useState(false);
  const [hasRlsChanges, setHasRlsChanges] = useState(false);
  const [rlsNotification, setRlsNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [rlsSearch, setRlsSearch] = useState('');
  const [simulationModal, setSimulationModal] = useState<{
    isOpen: boolean;
    roleCode: string;
    data: { policy?: RoleRlsPolicy; sampleWhereClause?: unknown; error?: string } | null;
    isLoading: boolean;
  }>({
    isOpen: false,
    roleCode: '',
    data: null,
    isLoading: false,
  });

  // User Responsibilities State
  const [userRespData, setUserRespData] = useState<UserResponsibilitiesResponse | null>(null);
  const [selectedUserForModal, setSelectedUserForModal] = useState<UserResponsibilityConfig | null>(null);
  const [isResponsibilityModalOpen, setIsResponsibilityModalOpen] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [usersRes, rolesRes, rlsRes, userRespRes] = await Promise.all([
        fetchApi<UserRecord[] | { data?: UserRecord[] }>('/users'),
        fetchApi<RoleRecord[] | { data?: RoleRecord[] }>('/roles'),
        fetchApi<RlsGovernanceResponse>('/access-control/rls-policies').catch(() => null),
        fetchApi<UserResponsibilitiesResponse>('/access-control/user-responsibilities').catch(() => null),
      ]);
      setUsers(responseList(usersRes));
      setRoles(responseList(rolesRes));

      if (rlsRes) {
        setRlsScopes(rlsRes.availableScopes || []);
        setRlsPolicies(rlsRes.roles || {});
      }
      if (userRespRes) {
        setUserRespData(userRespRes);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users and roles');
    } finally {
      setIsLoading(false);
    }
  };

  const openRoleModal = async () => {
    setFormError('');
    setPermissionSearch('');
    setPageSearch('');
    setRoleForm({ ...emptyRoleForm, pageKeys: roleNavigation.filter((item) => item.visible).map((item) => item.key) });
    setIsRoleOpen(true);
    setIsRoleAccessLoading(true);
    try {
      const [permissionResponse, navigationResponse] = await Promise.all([
        fetchApi<PermissionRecord[] | { data?: PermissionRecord[] }>('/roles/permissions'),
        fetchApi<NavigationItemRecord[]>('/access-control/navigation'),
      ]);
      const permissions = responseList(permissionResponse);
      const navigation = Array.isArray(navigationResponse) ? navigationResponse : [];
      setRolePermissions(permissions);
      setRoleNavigation(navigation);
      setRoleForm((current) => ({
        ...current,
        permissionIds: [],
        pageKeys: navigation.filter((item) => item.visible).map((item) => item.key),
      }));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to load permissions and page visibility options.');
    } finally {
      setIsRoleAccessLoading(false);
    }
  };

  const dynamicUserColumns: ResponsiveDataColumn<UserRecord>[] = useMemo(() => [
    {
      key: 'user',
      header: 'User',
      priority: 'primary',
      render: (user) => (
        <div className="flex items-center gap-2.5">
          <Avatar initials={user.displayName.slice(0, 2).toUpperCase() || 'US'} size="sm" />
          <div className="min-w-0">
            <span className="min-w-0 truncate font-bold text-rf-ink block">{user.displayName}</span>
            <span className="text-[11px] text-rf-ink-muted truncate block">{user.email}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'roles',
      header: 'Assigned roles',
      priority: 'secondary',
      render: (user) => (
        <div className="flex flex-wrap gap-1.5">
          {user.roles.length > 0 ? (
            user.roles.map((role) => (
              <Badge key={role.code} variant="neutral" className="font-mono">
                {role.name}
              </Badge>
            ))
          ) : (
            <span className="font-medium text-rf-ink-muted">No roles</span>
          )}
        </div>
      ),
    },
    {
      key: 'responsibilities',
      header: 'Workflow Responsibilities',
      priority: 'secondary',
      render: (user) => {
        const config = userRespData?.users.find((u) => u.userId === user.id);
        const count = config?.workflowResponsibilities?.length || 0;
        return (
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                count > 0
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {count > 0 ? `${count} Selected` : 'Default'}
            </span>
            {config?.branches && config.branches.length > 0 && !config.branches.includes('ALL') ? (
              <span className="text-[10.5px] text-slate-500 font-medium">
                ({config.branches.length} facilities)
              </span>
            ) : (
              <span className="text-[10.5px] text-slate-500 font-medium">(All facilities)</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      priority: 'secondary',
      render: (user) => <StatusBadge status={user.status} />,
    },
    {
      key: 'actions',
      header: 'Responsibilities & Scope',
      priority: 'primary',
      render: (user) => {
        const config = userRespData?.users.find((u) => u.userId === user.id) || {
          userId: user.id,
          displayName: user.displayName,
          email: user.email,
          status: user.status,
          roles: user.roles,
          branches: [],
          departments: [],
          workflowResponsibilities: [],
          canViewPii: true,
          canViewSalary: false,
          canDownloadDocs: true,
          canApprove: false,
        };
        return (
          <Button
            size="sm"
            variant="secondary"
            className="flex items-center gap-1.5"
            onClick={() => {
              setSelectedUserForModal(config);
              setIsResponsibilityModalOpen(true);
            }}
          >
            <Icon name="settings" size={13} />
            <span>Configure</span>
          </Button>
        );
      },
    },
  ], [userRespData]);

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

  const filteredRolePermissions = useMemo(() => {
    const query = permissionSearch.trim().toLowerCase();
    if (!query) return rolePermissions;
    return rolePermissions.filter((permission) => `${permission.name} ${permission.code} ${permission.description ?? ''}`.toLowerCase().includes(query));
  }, [permissionSearch, rolePermissions]);

  const filteredRoleNavigation = useMemo(() => {
    const query = pageSearch.trim().toLowerCase();
    if (!query) return roleNavigation;
    return roleNavigation.filter((item) => `${item.label} ${item.group} ${item.route}`.toLowerCase().includes(query));
  }, [pageSearch, roleNavigation]);

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
    if (isRoleAccessLoading) return;
    setFormError('');
    setIsSubmitting(true);
    let createdRole: RoleRecord | null = null;
    try {
      createdRole = await fetchApi<RoleRecord>('/roles', { method: 'POST', body: JSON.stringify({ name: roleForm.name }) });
      await Promise.all(roleForm.permissionIds.map((permissionId) => fetchApi(`/roles/${createdRole?.id}/permissions/${permissionId}`, { method: 'POST' })));
      await fetchApi(`/access-control/navigation/roles/${encodeURIComponent(createdRole.code)}`, {
        method: 'PUT',
        body: JSON.stringify({
          items: roleNavigation.map((item) => ({ key: item.key, visible: roleForm.pageKeys.includes(item.key) })),
        }),
      });
      setRoleForm(emptyRoleForm);
      setIsRoleOpen(false);
      await load();
    } catch (err) {
      if (createdRole) {
        await fetchApi(`/roles/${createdRole.id}`, { method: 'DELETE' }).catch(() => undefined);
      }
      setFormError(err instanceof Error ? err.message : 'Unable to create role');
    } finally {
      setIsSubmitting(false);
    }
  };

  // RLS update handlers
  const updateRolePolicy = (roleCode: string, field: keyof RoleRlsPolicy, value: RoleRlsPolicy[keyof RoleRlsPolicy]) => {
    setRlsPolicies((prev) => {
      const current = prev[roleCode] || {
        dataScope: 'ALL',
        canViewPii: false,
        canViewSalary: false,
        canDownloadDocs: false,
        canApprove: false,
      };
      return {
        ...prev,
        [roleCode]: {
          ...current,
          [field]: value,
        },
      };
    });
    setHasRlsChanges(true);
    setRlsNotification(null);
  };

  const saveRlsPolicies = async () => {
    setIsRlsSaving(true);
    setRlsNotification(null);
    try {
      await fetchApi('/access-control/rls-policies', {
        method: 'PUT',
        body: JSON.stringify({ roles: rlsPolicies }),
      });
      setHasRlsChanges(false);
      setRlsNotification({
        type: 'success',
        message: 'Row-Level Security (RLS) policies successfully saved and applied to all enterprise users.',
      });
    } catch (err) {
      setRlsNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to save RLS policies.',
      });
    } finally {
      setIsRlsSaving(false);
    }
  };

  const inspectSimulation = async (roleCode: string) => {
    setSimulationModal({
      isOpen: true,
      roleCode,
      data: null,
      isLoading: true,
    });
    try {
      const res = await fetchApi<{ policy?: RoleRlsPolicy; sampleWhereClause?: unknown; error?: string }>(`/access-control/audit-simulation/${roleCode}`);
      setSimulationModal((prev) => ({ ...prev, data: res, isLoading: false }));
    } catch (err) {
      setSimulationModal((prev) => ({
        ...prev,
        data: { error: err instanceof Error ? err.message : 'Failed to load audit simulation' },
        isLoading: false,
      }));
    }
  };

  const applyStrictSghDefaults = () => {
    const next: Record<string, RoleRlsPolicy> = { ...rlsPolicies };
    for (const code of Object.keys(next)) {
      if (code === 'ADMINISTRATOR') {
        next[code] = { dataScope: 'ALL', canViewPii: true, canViewSalary: true, canDownloadDocs: true, canApprove: true };
      } else if (code.includes('MANAGER') || code.includes('HEAD')) {
        next[code] = { dataScope: 'DEPARTMENT', canViewPii: false, canViewSalary: false, canDownloadDocs: false, canApprove: true };
      } else if (code.includes('INTERVIEWER')) {
        next[code] = { dataScope: 'ASSIGNED_ONLY', canViewPii: false, canViewSalary: false, canDownloadDocs: false, canApprove: false };
      } else if (code.includes('RECRUITER')) {
        next[code] = { dataScope: 'ALL', canViewPii: true, canViewSalary: false, canDownloadDocs: true, canApprove: false };
      } else {
        next[code] = { dataScope: 'ALL', canViewPii: false, canViewSalary: false, canDownloadDocs: false, canApprove: false };
      }
    }
    setRlsPolicies(next);
    setHasRlsChanges(true);
    setRlsNotification({
      type: 'success',
      message: 'Applied SGH Clinical & Operational standard least-privilege RLS template. Review and click Save to apply.',
    });
  };

  const activeUserCount = users.filter((u) => u.status === 'Active').length;
  const configuredRlsRolesCount = Object.keys(rlsPolicies).length;

  const filteredRlsRoles = useMemo(() => {
    const list = roles.length > 0 ? roles : Object.keys(rlsPolicies).map((c) => ({ id: c, code: c, name: c, status: 'Active' as const }));
    if (!rlsSearch.trim()) return list;
    const term = rlsSearch.toLowerCase();
    return list.filter((r) => r.name.toLowerCase().includes(term) || r.code.toLowerCase().includes(term));
  }, [roles, rlsPolicies, rlsSearch]);

  return (
    <PageFrame
      eyebrow="Security & Governance"
      title="Access Control & RLS Governance"
      description="Manage enterprise users, configure RBAC roles, and control Row-Level Security (RLS) data scoping per role."
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={() => void load()}>
            <Icon name="refresh-cw" size={13} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </Button>
          {activeTab === 'rls' ? (
            <Button
              variant="primary"
              size="sm"
              loading={isRlsSaving}
              loadingLabel="Saving RLS Policy..."
              onClick={() => void saveRlsPolicies()}
            >
              <Icon name="check-circle" size={14} />
              Save RLS Matrix
            </Button>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={() => void openRoleModal()}>
                <Icon name="plus" size={13} />
                Create role
              </Button>
              <Button variant="primary" size="sm" onClick={() => { setFormError(''); setIsInviteOpen(true); }}>
                <Icon name="plus" size={14} />
                Create user
              </Button>
            </>
          )}
        </>
      }
    >
      {error && (
        <Alert
          tone="danger"
          title="Unable to load access control data"
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

      {rlsNotification && (
        <Alert
          tone={rlsNotification.type === 'success' ? 'success' : 'danger'}
          title={rlsNotification.type === 'success' ? 'RLS Governance Updated' : 'Error'}
        >
          {rlsNotification.message}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Authorized Users" value={users.length} detail="Enterprise accounts" tone="action" icon={<Icon name="users" size={14} />} />
        <MetricCard label="Active Logins" value={activeUserCount} detail="Enabled sessions" tone="success" icon={<Icon name="check-circle" size={14} />} />
        <MetricCard label="Configured Roles" value={roles.length} detail="RBAC permission sets" tone="info" icon={<Icon name="grid-squares" size={14} />} />
        <MetricCard label="RLS Governance" value={configuredRlsRolesCount ? `${configuredRlsRolesCount} Roles` : 'Active'} detail="Dynamic row-scoping" tone="action" icon={<Icon name="shield" size={14} />} />
      </div>

      {/* Primary Navigation Tabs */}
      <div className="border-b border-rf-border-subtle pt-2">
        <Tabs
          ariaLabel="Access Control Sections"
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as typeof activeTab)}
          items={[
            {
              key: 'users',
              label: (
                <span className="flex items-center gap-2">
                  <Icon name="users" size={14} />
                  Team Users
                  <Badge variant="neutral" className="ml-1">{users.length}</Badge>
                </span>
              ),
            },
            {
              key: 'roles',
              label: (
                <span className="flex items-center gap-2">
                  <Icon name="grid-squares" size={14} />
                  System Roles
                  <Badge variant="neutral" className="ml-1">{roles.length}</Badge>
                </span>
              ),
            },
            {
              key: 'access',
              label: (
                <span className="flex items-center gap-2 font-bold text-rf-action">
                  <Icon name="lock" size={14} />
                  Permissions &amp; Sidebar
                  <Badge variant="success" className="ml-1">Admin Controlled</Badge>
                </span>
              ),
            },
            {
              key: 'rls',
              label: (
                <span className="flex items-center gap-2 font-bold text-rf-action">
                  <Icon name="lock" size={14} />
                  RLS & Data Visibility Governance
                  {hasRlsChanges && (
                    <span className="inline-block h-2 w-2 rounded-full bg-amber-500" title="Unsaved changes" />
                  )}
                  <Badge variant="success" className="ml-1">Admin Controlled</Badge>
                </span>
              ),
            },
          ]}
        />
      </div>

      {/* TAB 1: USERS */}
      {activeTab === 'users' && (
        <section className="rf-table-shell overflow-hidden rounded-2xl border border-rf-border-subtle bg-white shadow-xs">
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
              columns={dynamicUserColumns}
              rowKey={(user) => user.id}
              label="Users"
              className="px-4 pb-4 sm:px-5 sm:pb-5"
            />
          )}
        </section>
      )}

      {/* TAB 2: ROLES */}
      {activeTab === 'roles' && (
        <section className="rf-panel overflow-hidden rounded-2xl border border-rf-border-subtle bg-white shadow-xs">
          <SectionHeader
            title={`Configured System Roles (${roles.length})`}
            description="Role definitions and base permissions. Row-level data visibility can be governed in the RLS Governance tab."
            density="default"
            className="border-b border-rf-border-subtle p-5"
            actions={(
              <Button variant="secondary" size="sm" onClick={() => void openRoleModal()}>
                <Icon name="plus" size={13} />
                Create Role
              </Button>
            )}
          />
          {roles.length === 0 ? (
            <PageState kind="empty" title="No roles configured" description="Create a role to define access." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
              {roles.map((role) => (
                <div key={role.code} className="flex flex-col justify-between rounded-xl border border-rf-border-subtle bg-rf-surface-subtle p-4 transition-all hover:border-rf-border-strong hover:shadow-xs">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm text-rf-ink">{role.name}</span>
                      <Badge variant={role.status === 'Active' ? 'success' : 'neutral'}>{role.status}</Badge>
                    </div>
                    <div className="mt-1 font-mono text-xs font-semibold text-rf-ink-muted">{role.code}</div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-rf-border-subtle flex items-center justify-between text-xs text-rf-ink-muted">
                    <span>RLS Scope: <strong className="text-rf-ink">{rlsPolicies[role.code]?.dataScope || 'ALL'}</strong></span>
                    <button
                      type="button"
                      className="text-rf-action hover:underline font-semibold"
                      onClick={() => {
                        setActiveTab('rls');
                        setRlsSearch(role.name);
                      }}
                    >
                      Configure RLS →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 3: PERMISSIONS & SIDEBAR */}
      {activeTab === 'access' && (
        <AccessPolicyManager roles={roles} onRolesChanged={load} />
      )}

      {/* TAB 4: RLS & DATA VISIBILITY GOVERNANCE */}
      {activeTab === 'rls' && (
        <div className="space-y-6">
          {/* RLS Overview Banner */}
          <div className="rounded-2xl border border-rf-border-subtle bg-gradient-to-r from-blue-50/50 via-indigo-50/30 to-purple-50/50 p-5 sm:p-6 dark:from-slate-900 dark:via-indigo-950/40 dark:to-slate-900">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2 text-rf-action text-xs font-bold uppercase tracking-wider">
                  <Icon name="shield" size={14} />
                  Row-Level Security (RLS) & Privacy Governance
                </div>
                <h3 className="text-lg font-bold text-rf-ink mt-1">Flexible Role-Based Visibility Control</h3>
                <p className="text-sm text-rf-ink-muted mt-1 leading-relaxed">
                  As Administrator, you decide exactly <strong>who should see what</strong>. Customize requisition visibility
                  scope (All Organization, Assigned Only, Branch Scoped, Department Scoped) and enforce granular data masking for
                  candidate direct contact info (PII), salary figures, and resume file downloads.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <Button variant="secondary" size="sm" onClick={applyStrictSghDefaults}>
                  <Icon name="sliders" size={13} />
                  Apply Standard Template
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  loading={isRlsSaving}
                  loadingLabel="Saving Changes..."
                  onClick={() => void saveRlsPolicies()}
                  disabled={!hasRlsChanges && !isRlsSaving}
                >
                  <Icon name="check-circle" size={14} />
                  Save RLS Matrix
                </Button>
              </div>
            </div>

            {hasRlsChanges && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-900 dark:text-amber-200 font-medium">
                <div className="flex items-center gap-2">
                  <Icon name="alert-triangle" size={14} className="text-amber-600" />
                  <span>You have unsaved changes to role visibility and masking rules.</span>
                </div>
                <Button variant="primary" size="sm" onClick={() => void saveRlsPolicies()} loading={isRlsSaving}>
                  Save & Apply
                </Button>
              </div>
            )}
          </div>

          {/* Search Toolbar */}
          <div className="flex items-center justify-between gap-4">
            <div className="max-w-md w-full">
              <Input
                aria-label="Search role policies"
                placeholder="Filter roles by name or code..."
                value={rlsSearch}
                onChange={(e) => setRlsSearch(e.target.value)}
              />
            </div>
            <span className="text-xs text-rf-ink-muted">
              Showing <strong>{filteredRlsRoles.length}</strong> configured security roles
            </span>
          </div>

          {/* RLS Policy Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filteredRlsRoles.map((role) => {
              const policy = rlsPolicies[role.code] || {
                dataScope: 'ALL' as DataVisibilityScope,
                canViewPii: false,
                canViewSalary: false,
                canDownloadDocs: false,
                canApprove: false,
              };

              const isAdminRole = role.code === 'ADMINISTRATOR';

              return (
                <div
                  key={role.code}
                  className="flex flex-col justify-between rounded-2xl border border-rf-border-subtle bg-white dark:bg-slate-900 shadow-xs hover:border-rf-border-strong transition-all p-5"
                >
                  <div>
                    {/* Role Header */}
                    <div className="flex items-start justify-between gap-3 border-b border-rf-border-subtle pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-rf-ink">{role.name}</h4>
                          {isAdminRole && (
                            <Badge variant="info" className="font-semibold text-[11px]">Unrestricted Admin</Badge>
                          )}
                        </div>
                        <div className="mt-0.5 font-mono text-xs text-rf-ink-muted">{role.code}</div>
                      </div>

                      <Badge
                        variant={
                          policy.dataScope === 'ALL'
                            ? 'success'
                            : policy.dataScope === 'ASSIGNED_ONLY'
                            ? 'warning'
                            : policy.dataScope === 'BRANCH'
                            ? 'info'
                            : 'neutral'
                        }
                        className="font-bold tracking-tight"
                      >
                        {policy.dataScope === 'ALL' && 'All Organization'}
                        {policy.dataScope === 'ASSIGNED_ONLY' && 'Assigned Requisitions Only'}
                        {policy.dataScope === 'BRANCH' && 'Branch / Facility Scoped'}
                        {policy.dataScope === 'DEPARTMENT' && 'Department Scoped'}
                      </Badge>
                    </div>

                    {/* Scope Selector */}
                    <div className="mt-4">
                      <label className="block text-xs font-bold text-rf-ink mb-1.5">
                        Requisitions & Candidate Scope:
                      </label>
                      <Select
                        aria-label={`Scope for ${role.name}`}
                        disabled={isAdminRole}
                        value={policy.dataScope}
                        onChange={(e) => updateRolePolicy(role.code, 'dataScope', e.target.value as DataVisibilityScope)}
                      >
                        <option value="ALL">All Organization — Full cross-facility visibility</option>
                        <option value="ASSIGNED_ONLY">Assigned Only — Scoped strictly to assigned requisitions</option>
                        <option value="BRANCH">Branch Scoped — Scoped to user's assigned hospital branch</option>
                        <option value="DEPARTMENT">Department Scoped — Scoped to user's clinical department</option>
                      </Select>
                      <p className="mt-1 text-[11.5px] text-rf-ink-muted">
                        {policy.dataScope === 'ALL' && 'Users in this role can search and access all requisitions and applicants across all hospitals.'}
                        {policy.dataScope === 'ASSIGNED_ONLY' && 'Users will strictly see applicants and jobs where they are the primary recruiter, task owner, or review team member.'}
                        {policy.dataScope === 'BRANCH' && 'Users are confined to vacancies and applications belonging to their designated hospital facility.'}
                        {policy.dataScope === 'DEPARTMENT' && 'Users only see jobs and applications within their specialized clinical or operational department.'}
                      </p>
                    </div>

                    {/* Sensitive Field Toggles */}
                    <div className="mt-5 space-y-3.5 pt-3 border-t border-rf-border-subtle">
                      <div className="text-xs font-bold text-rf-ink uppercase tracking-wider">
                        Field Visibility & Decision Authority
                      </div>

                      <div className="flex items-center justify-between gap-4 py-1">
                        <div>
                          <div className="text-xs font-bold text-rf-ink">Candidate Direct Contact PII</div>
                          <div className="text-[11.5px] text-rf-ink-muted">
                            Candidate phone & email visibility. When disabled, contact details are masked with ***.
                          </div>
                        </div>
                        <Switch
                          id={`pii-${role.code}`}
                          disabled={isAdminRole}
                          checked={isAdminRole ? true : policy.canViewPii}
                          onCheckedChange={(checked) => updateRolePolicy(role.code, 'canViewPii', checked)}
                        />
                      </div>

                      <div className="flex items-center justify-between gap-4 py-1">
                        <div>
                          <div className="text-xs font-bold text-rf-ink">Compensation & Salary Figures</div>
                          <div className="text-[11.5px] text-rf-ink-muted">
                            Expected/current salary and proposed offer monetary packages.
                          </div>
                        </div>
                        <Switch
                          id={`salary-${role.code}`}
                          disabled={isAdminRole}
                          checked={isAdminRole ? true : policy.canViewSalary}
                          onCheckedChange={(checked) => updateRolePolicy(role.code, 'canViewSalary', checked)}
                        />
                      </div>

                      <div className="flex items-center justify-between gap-4 py-1">
                        <div>
                          <div className="text-xs font-bold text-rf-ink">Resume & Document Downloads</div>
                          <div className="text-[11.5px] text-rf-ink-muted">
                            Permission to download candidate resumes, medical licenses, and certifications.
                          </div>
                        </div>
                        <Switch
                          id={`docs-${role.code}`}
                          disabled={isAdminRole}
                          checked={isAdminRole ? true : policy.canDownloadDocs}
                          onCheckedChange={(checked) => updateRolePolicy(role.code, 'canDownloadDocs', checked)}
                        />
                      </div>

                      <div className="flex items-center justify-between gap-4 py-1">
                        <div>
                          <div className="text-xs font-bold text-rf-ink">Approval Gate Authority</div>
                          <div className="text-[11.5px] text-rf-ink-muted">
                            Can approve requisitions, offer letters, and clinical hiring cases.
                          </div>
                        </div>
                        <Switch
                          id={`approve-${role.code}`}
                          disabled={isAdminRole}
                          checked={isAdminRole ? true : policy.canApprove}
                          onCheckedChange={(checked) => updateRolePolicy(role.code, 'canApprove', checked)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="mt-5 pt-3 border-t border-rf-border-subtle flex items-center justify-between text-xs">
                    <span className="text-rf-ink-muted">
                      {policy.canViewPii ? 'Contact PII Visible' : 'Contact PII Masked (***)'}
                    </span>
                    <Button
                      variant="quiet"
                      size="sm"
                      onClick={() => void inspectSimulation(role.code)}
                    >
                      <Icon name="search" size={12} />
                      Simulate Query Filter
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* RLS Query Simulation Modal */}
      <Modal
        isOpen={simulationModal.isOpen}
        onClose={() => setSimulationModal((prev) => ({ ...prev, isOpen: false }))}
        title={`RLS Query Simulation: ${simulationModal.roleCode}`}
      >
        <div className="space-y-4 text-xs">
          <p className="text-rf-ink-muted">
            The system applies Row-Level Security at both database Prisma ORM queries and payload serialization gates.
          </p>

          {simulationModal.isLoading ? (
            <div className="p-6 text-center text-rf-ink-muted animate-pulse">Loading simulation rules...</div>
          ) : simulationModal.data ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-rf-border-subtle bg-rf-surface-subtle p-3.5">
                <div className="font-bold text-rf-ink mb-1">Effective Policy:</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>Scope: <strong>{simulationModal.data.policy?.dataScope}</strong></div>
                  <div>PII Masked: <strong>{simulationModal.data.policy?.canViewPii ? 'No' : 'Yes (***)'}</strong></div>
                  <div>Salary Access: <strong>{simulationModal.data.policy?.canViewSalary ? 'Granted' : 'Hidden'}</strong></div>
                  <div>Document Download: <strong>{simulationModal.data.policy?.canDownloadDocs ? 'Granted' : 'Restricted'}</strong></div>
                </div>
              </div>

              <div className="rounded-xl border border-rf-border-subtle bg-slate-900 p-3.5 font-mono text-[11px] text-emerald-400 overflow-x-auto">
                <div className="text-slate-400 mb-1">// Prisma Where Clause Generated:</div>
                <pre>{JSON.stringify(simulationModal.data.sampleWhereClause, null, 2)}</pre>
              </div>
            </div>
          ) : null}

          <div className="flex justify-end pt-2">
            <Button variant="secondary" size="sm" onClick={() => setSimulationModal((prev) => ({ ...prev, isOpen: false }))}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

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
                  {roles.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
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
      <Modal
        isOpen={isRoleOpen}
        onClose={() => setIsRoleOpen(false)}
        title="Create role and access"
        maxWidthClass="max-w-6xl"
        footer={(
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[10.5px] leading-relaxed text-rf-ink-muted">{roleForm.permissionIds.length} permissions · {roleForm.pageKeys.length} sidebar pages selected</p>
            <div className="flex justify-end gap-2">
              <Button variant="quiet" type="button" onClick={() => setIsRoleOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={isSubmitting || isRoleAccessLoading}
                loadingLabel="Saving"
                disabled={isRoleAccessLoading}
                type="submit"
                form="role-create-form"
              >
                Create role
              </Button>
            </div>
          </div>
        )}
      >
        <form id="role-create-form" className="min-w-0" onSubmit={(e) => void submitRole(e)}>
          {formError && (
            <div className="mb-4">
              <Alert tone="danger" title="Error">
                {formError}
              </Alert>
            </div>
          )}
          <section className="rounded-2xl border border-rf-border-subtle bg-rf-surface-subtle/45 p-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-rf-action">Step 1 · Role identity</p>
                <h3 className="mt-1 text-base font-bold text-rf-ink">Name this access profile</h3>
                <p className="mt-1 text-xs text-rf-ink-muted">Choose a clear name; the system assigns the integration code for you.</p>
              </div>
              <Badge variant="info" className="self-start">Organization role</Badge>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="rounded-xl border border-rf-border-subtle bg-rf-surface px-4 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-rf-ink">Role code</span>
                  <Badge variant="info">Auto-generated</Badge>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-rf-ink-muted">
                  A unique <span className="font-mono font-semibold text-rf-ink">ROLE_###</span> code is assigned when you save.
                </p>
              </div>
              <FormField id="r-name" label="Role Name" required hint="Shown in user and role selectors">
                <Input
                  id="r-name"
                  required
                  placeholder="e.g. Compliance Auditor"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                />
              </FormField>
            </div>
          </section>

          <div className="mt-5 grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2">
            <section className="min-w-0 overflow-hidden rounded-2xl border border-rf-border-subtle bg-rf-surface-subtle/45 p-5">
              <div className="flex flex-col gap-3 border-b border-rf-border-subtle pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-rf-ink">Step 2 · Permissions</h3>
                    <Badge variant="info">{roleForm.permissionIds.length} selected</Badge>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-rf-ink-muted">Choose the actions this role can perform. These permissions control real route and API access.</p>
                </div>
                <button
                  type="button"
                  className="shrink-0 text-left text-xs font-semibold text-rf-accent hover:underline sm:text-right"
                  onClick={() => setRoleForm((current) => ({
                    ...current,
                    permissionIds: current.permissionIds.length === rolePermissions.length ? [] : rolePermissions.map((permission) => permission.id),
                  }))}
                  disabled={isRoleAccessLoading || rolePermissions.length === 0}
                >
                  {roleForm.permissionIds.length === rolePermissions.length && rolePermissions.length > 0 ? 'Clear all' : 'Select all'}
                </button>
              </div>
              <div className="mt-4">
                <Input
                  aria-label="Search permissions"
                  placeholder="Search permissions or codes…"
                  value={permissionSearch}
                  onChange={(event) => setPermissionSearch(event.target.value)}
                />
              </div>
              {isRoleAccessLoading ? (
                <p className="py-8 text-center text-xs text-rf-ink-muted">Loading permissions…</p>
              ) : rolePermissions.length === 0 ? (
                <p className="py-8 text-center text-xs text-rf-ink-muted">No permissions are available.</p>
              ) : filteredRolePermissions.length === 0 ? (
                <p className="py-8 text-center text-xs text-rf-ink-muted">No permissions match your search.</p>
              ) : (
                <div className="mt-3 grid max-h-[26rem] min-w-0 grid-cols-1 gap-1 overflow-x-hidden overflow-y-auto pr-1 sm:grid-cols-2">
                  {filteredRolePermissions.map((permission) => (
                    <CheckboxField
                      key={permission.id}
                      className="min-w-0"
                      checked={roleForm.permissionIds.includes(permission.id)}
                      label={<span className="block truncate text-[11.5px]">{permission.name}</span>}
                      description={<span className="block break-all font-mono text-[10px]">{permission.code}</span>}
                      onChange={(event) => setRoleForm((current) => ({
                        ...current,
                        permissionIds: event.target.checked
                          ? [...current.permissionIds, permission.id]
                          : current.permissionIds.filter((id) => id !== permission.id),
                      }))}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="min-w-0 overflow-hidden rounded-2xl border border-rf-border-subtle bg-rf-surface-subtle/45 p-5">
              <div className="flex flex-col gap-3 border-b border-rf-border-subtle pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-rf-ink">Step 3 · Sidebar pages</h3>
                    <Badge variant="success">{roleForm.pageKeys.length} selected</Badge>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-rf-ink-muted">Choose pages shown in the sidebar. Visibility is separate from permissions and never grants access by itself.</p>
                </div>
                <button
                  type="button"
                  className="shrink-0 text-left text-xs font-semibold text-rf-accent hover:underline sm:text-right"
                  onClick={() => setRoleForm((current) => ({
                    ...current,
                    pageKeys: current.pageKeys.length === roleNavigation.length ? [] : roleNavigation.map((item) => item.key),
                  }))}
                  disabled={isRoleAccessLoading || roleNavigation.length === 0}
                >
                  {roleForm.pageKeys.length === roleNavigation.length && roleNavigation.length > 0 ? 'Clear all' : 'Select all'}
                </button>
              </div>
              <div className="mt-4">
                <Input
                  aria-label="Search sidebar pages"
                  placeholder="Search pages, groups, or routes…"
                  value={pageSearch}
                  onChange={(event) => setPageSearch(event.target.value)}
                />
              </div>
              {isRoleAccessLoading ? (
                <p className="py-8 text-center text-xs text-rf-ink-muted">Loading pages…</p>
              ) : roleNavigation.length === 0 ? (
                <p className="py-8 text-center text-xs text-rf-ink-muted">No pages are available.</p>
              ) : filteredRoleNavigation.length === 0 ? (
                <p className="py-8 text-center text-xs text-rf-ink-muted">No pages match your search.</p>
              ) : (
                <div className="mt-3 grid max-h-[26rem] min-w-0 grid-cols-1 gap-1 overflow-x-hidden overflow-y-auto pr-1 sm:grid-cols-2">
                  {filteredRoleNavigation.map((item) => (
                    <CheckboxField
                      key={item.key}
                      className="min-w-0"
                      checked={roleForm.pageKeys.includes(item.key)}
                      label={<span className="block truncate text-[11.5px]">{item.label}</span>}
                      description={<span className="block truncate text-[10px]">{item.group} · {item.route}</span>}
                      onChange={(event) => setRoleForm((current) => ({
                        ...current,
                        pageKeys: event.target.checked
                          ? [...current.pageKeys, item.key]
                          : current.pageKeys.filter((key) => key !== item.key),
                      }))}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>

        </form>
      </Modal>

      {/* User Responsibility & Scope Modal */}
      <UserResponsibilityModal
        isOpen={isResponsibilityModalOpen}
        onClose={() => setIsResponsibilityModalOpen(false)}
        user={selectedUserForModal}
        availableBranches={userRespData?.branches || []}
        availableDepartments={userRespData?.departments || []}
        availableResponsibilities={userRespData?.availableResponsibilities || []}
        availableRoles={userRespData?.availableRoles || []}
        availableScopes={userRespData?.availableScopes || []}
        onSaveSuccess={(updated) => {
          setUserRespData((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              users: prev.users.map((u) => (u.userId === updated.userId ? updated : u)),
            };
          });
          setRlsNotification({
            type: 'success',
            message: `Updated responsibilities and security scope for ${updated.displayName}`,
          });
        }}
      />
    </PageFrame>
  );
}
