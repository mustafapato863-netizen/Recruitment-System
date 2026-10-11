import { useEffect, useMemo, useState, useCallback } from 'react';
import type { NavigationItemRecord, PermissionRecord, RoleRecord } from '@recruitflow/contracts';
import { deleteApi, fetchApi, patchApi, postApi, putApi } from '../../api/client';
import { Modal } from '../Modal';
import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { FormField } from '../ui/FormField';
import { Input } from '../ui/Input';
import { SectionHeader } from '../ui/SectionHeader';
import { Select } from '../ui/Select';
import { Switch } from '../ui/Switch';
import { Icon, type IconName } from '../Icon';

interface AccessPolicyManagerProps {
  roles: RoleRecord[];
  onRolesChanged?: () => Promise<void> | void;
}

const emptyPermissionForm = { code: '', name: '', description: '' };

function normalizeList<T>(value: T[] | { data?: T[] }): T[] {
  return Array.isArray(value) ? value : value.data || [];
}

export function AccessPolicyManager({ roles, onRolesChanged }: AccessPolicyManagerProps) {
  const [permissions, setPermissions] = useState<PermissionRecord[]>([]);
  const [navigation, setNavigation] = useState<NavigationItemRecord[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [roleName, setRoleName] = useState('');
  const [navScope, setNavScope] = useState<'role' | 'global'>('role');
  const [navSearch, setNavSearch] = useState('');
  const [isNavLoading, setIsNavLoading] = useState(false);
  const [isPermissionOpen, setIsPermissionOpen] = useState(false);
  const [permissionForm, setPermissionForm] = useState(emptyPermissionForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selectedRole = roles.find((role) => role.id === selectedRoleId) || roles[0];
  const isSystemRole = selectedRole?.scope === 'system' || selectedRole?.code === 'ADMINISTRATOR';
  const selectedPermissionIds = useMemo(
    () => new Set((selectedRole?.permissions || []).map((permission) => permission.id)),
    [selectedRole],
  );

  const loadPermissions = async () => {
    try {
      const permissionResponse = await fetchApi<PermissionRecord[] | { data?: PermissionRecord[] }>('/roles/permissions');
      setPermissions(normalizeList(permissionResponse));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load permissions.');
    }
  };

  const loadNavigation = useCallback(async (roleCode?: string) => {
    setIsNavLoading(true);
    try {
      const url = roleCode && roleCode !== 'GLOBAL'
        ? `/access-control/navigation?roleCode=${encodeURIComponent(roleCode)}`
        : '/access-control/navigation';
      const navigationResponse = await fetchApi<NavigationItemRecord[] | { data?: NavigationItemRecord[] }>(url);
      setNavigation(normalizeList(navigationResponse));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load navigation settings.');
    } finally {
      setIsNavLoading(false);
    }
  }, []);

  const loadAll = async () => {
    setIsLoading(true);
    setError('');
    try {
      await loadPermissions();
      const targetRoleCode = navScope === 'role' && selectedRole?.code ? selectedRole.code : 'GLOBAL';
      await loadNavigation(targetRoleCode);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    setRoleName(selectedRole?.name || '');
    if (navScope === 'role' && selectedRole?.code) {
      void loadNavigation(selectedRole.code);
    }
  }, [selectedRole?.id, selectedRole?.code, navScope, loadNavigation]);

  const updateNavigationItem = (key: string, changes: Partial<NavigationItemRecord>) => {
    setNavigation((items) => items.map((item) => (item.key === key ? { ...item, ...changes } : item)));
  };

  const handleShowAllPages = () => {
    setNavigation((prev) => prev.map((item) => ({ ...item, visible: true })));
  };

  const handleHideNonCorePages = () => {
    const coreKeys = new Set(['dashboard', 'vacancy-requests', 'applications']);
    setNavigation((prev) =>
      prev.map((item) => ({
        ...item,
        visible: coreKeys.has(item.key),
      }))
    );
  };

  const handleResetToBaseline = async () => {
    if (navScope === 'role') {
      try {
        setIsNavLoading(true);
        const baseline = await fetchApi<NavigationItemRecord[]>('/access-control/navigation');
        if (Array.isArray(baseline)) {
          setNavigation(baseline);
          setNotice(`Navigation reset to organization default baseline for ${selectedRole?.name || 'this role'}. Click "Save sidebar" to apply.`);
        }
      } catch {
        setError('Failed to fetch baseline settings.');
      } finally {
        setIsNavLoading(false);
      }
    }
  };

  const saveNavigation = async () => {
    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      if (navScope === 'role' && selectedRole) {
        await putApi(`/access-control/navigation/roles/${selectedRole.code}`, {
          items: navigation.map(({ key, visible }) => ({ key, visible })),
        });
        setNotice(
          `Sidebar visibility for role "${selectedRole.name}" (${selectedRole.code}) was saved successfully. Other roles and Administrator remain unaffected.`
        );
        await loadNavigation(selectedRole.code);
      } else {
        await putApi('/access-control/navigation', {
          items: navigation.map(({ key, route, label, visible, sortOrder }) => ({ key, route, label, visible, sortOrder })),
        });
        setNotice('Global organization baseline sidebar visibility was saved.');
        await loadNavigation('GLOBAL');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save navigation settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const saveRoleName = async () => {
    if (!selectedRole || isSystemRole || !roleName.trim()) return;
    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      await patchApi(`/roles/${selectedRole.id}`, { name: roleName.trim() });
      setNotice('Role name updated.');
      await onRolesChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update role name.');
    } finally {
      setIsSaving(false);
    }
  };

  const togglePermission = async (permission: PermissionRecord, checked: boolean) => {
    if (!selectedRole || isSystemRole) return;
    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      if (checked) {
        await postApi(`/roles/${selectedRole.id}/permissions/${permission.id}`);
      } else {
        await deleteApi(`/roles/${selectedRole.id}/permissions/${permission.id}`);
      }
      setNotice(`${permission.name} ${checked ? 'granted to' : 'removed from'} ${selectedRole.name}.`);
      await onRolesChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update role permissions.');
    } finally {
      setIsSaving(false);
    }
  };

  const createPermission = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      await postApi('/roles/permissions', {
        code: permissionForm.code.trim(),
        name: permissionForm.name.trim(),
        description: permissionForm.description.trim() || undefined,
      });
      setPermissionForm(emptyPermissionForm);
      setIsPermissionOpen(false);
      setNotice('Custom permission created. It is now available for assignment to organization roles.');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create permission.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteCustomPermission = async (permission: PermissionRecord) => {
    if (permission.scope !== 'organization') return;
    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      await deleteApi(`/roles/permissions/${permission.id}`);
      setNotice(`${permission.name} was deleted.`);
      await loadAll();
      await onRolesChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete permission.');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredNavigation = useMemo(() => {
    if (!navSearch.trim()) return navigation;
    const q = navSearch.toLowerCase().trim();
    return navigation.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.key.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q) ||
        item.route.toLowerCase().includes(q)
    );
  }, [navigation, navSearch]);

  if (isLoading) {
    return <div className="rounded-2xl border border-rf-border-subtle bg-rf-surface p-6 text-sm text-rf-ink-muted">Loading access policy settings…</div>;
  }

  return (
    <div className="space-y-6">
      {error && <Alert tone="danger" title="Access policy update failed">{error}</Alert>}
      {notice && <Alert tone="success" title="Access policy updated">{notice}</Alert>}

      {/* SECTION 1: ROLE PERMISSIONS */}
      <section className="rf-panel overflow-hidden rounded-2xl border border-rf-border-subtle bg-rf-surface shadow-xs">
        <SectionHeader
          title="Role permissions"
          description="Select a role below to configure its natural API permissions and display name. Administrator permissions stay complete and immutable."
          className="border-b border-rf-border-subtle p-5"
          actions={(
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => { setPermissionForm(emptyPermissionForm); setIsPermissionOpen(true); }}>
                <Icon name="plus" size={13} /> Create permission
              </Button>
              <Button variant="primary" size="sm" onClick={() => void onRolesChanged?.()}>
                <Icon name="refresh-cw" size={13} /> Refresh roles
              </Button>
            </div>
          )}
        />

        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(240px,300px)_1fr]">
          <div className="space-y-4">
            <FormField id="access-role" label="Role to configure" hint="System roles are read-only; custom organization roles can be edited.">
              <Select id="access-role" value={selectedRole?.id || ''} onChange={(event) => setSelectedRoleId(event.target.value)}>
                {roles.map((role) => <option key={role.id} value={role.id}>{role.name} ({role.code})</option>)}
              </Select>
            </FormField>
            {selectedRole && (
              <div className="rounded-xl border border-rf-border-subtle bg-rf-surface-subtle p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-rf-ink">{selectedRole.name}</span>
                  <Badge variant={isSystemRole ? 'info' : 'neutral'}>{isSystemRole ? 'System' : 'Custom'}</Badge>
                </div>
                <p className="mt-1 font-mono text-[11px] text-rf-ink-muted">{selectedRole.code}</p>
                {!isSystemRole && (
                  <div className="mt-4 space-y-2">
                    <FormField id="role-display-name" label="Display name">
                      <Input id="role-display-name" value={roleName} onChange={(event) => setRoleName(event.target.value)} />
                    </FormField>
                    <Button size="sm" variant="secondary" loading={isSaving} onClick={() => void saveRoleName()}>Save name</Button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="min-w-0">
            {isSystemRole && (
              <Alert tone="info" title="Administrator access is complete">
                The administrator always retains all natural permissions. Create a custom organization role when you need a restricted access profile.
              </Alert>
            )}
            <div className="mt-4 divide-y divide-rf-border-subtle rounded-xl border border-rf-border-subtle max-h-[460px] overflow-y-auto">
              {permissions.map((permission) => {
                const checked = isSystemRole || selectedPermissionIds.has(permission.id);
                return (
                  <div key={permission.id} className="flex items-center justify-between gap-3 p-3.5 hover:bg-rf-surface-subtle/50 transition">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-sm text-rf-ink">{permission.name}</span>
                        <Badge variant={permission.scope === 'organization' ? 'neutral' : 'info'}>{permission.scope === 'organization' ? 'Custom' : 'System'}</Badge>
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] text-rf-ink-muted">{permission.code}</div>
                      {permission.description && <p className="mt-1 text-xs text-rf-ink-muted">{permission.description}</p>}
                    </div>
                    <Switch
                      aria-label={`${checked ? 'Remove' : 'Grant'} ${permission.name}`}
                      checked={checked}
                      disabled={!selectedRole || isSystemRole || isSaving}
                      onCheckedChange={(next) => void togglePermission(permission, next)}
                    />
                    {permission.scope === 'organization' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${permission.name}`}
                        disabled={isSaving}
                        onClick={() => void deleteCustomPermission(permission)}
                      >
                        <Icon name="trash" size={14} />
                      </Button>
                    )}
                  </div>
                );
              })}
              {permissions.length === 0 && <p className="p-5 text-sm text-rf-ink-muted">No permissions are available.</p>}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: SIDEBAR NAVIGATION & VISIBILITY (ROLE-SCOPED) */}
      <section className="rf-panel overflow-hidden rounded-2xl border border-rf-border-subtle bg-rf-surface shadow-xs">
        <SectionHeader
          title="Sidebar navigation & page visibility"
          description={
            navScope === 'role'
              ? `Customize sidebar menu pages visible to users with the "${selectedRole?.name}" role. Changes only affect this role and do not affect Administrator or other roles.`
              : 'Customize the default organization-wide sidebar template. Custom role settings take precedence.'
          }
          className="border-b border-rf-border-subtle p-5"
          actions={(
            <Button
              variant="primary"
              size="sm"
              loading={isSaving}
              disabled={isSaving || isNavLoading || (navScope === 'role' && isSystemRole)}
              onClick={() => void saveNavigation()}
            >
              <Icon name="check-circle" size={14} />
              Save sidebar {navScope === 'role' ? `for ${selectedRole?.name}` : 'baseline'}
            </Button>
          )}
        />

        {/* Scope Selector & Batch Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-rf-surface-subtle border-b border-rf-border-subtle">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-rf-ink-muted uppercase tracking-wider">Configure Scope:</span>
            <div className="inline-flex rounded-lg border border-rf-border-subtle bg-rf-surface p-0.5 shadow-2xs">
              <button
                type="button"
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  navScope === 'role'
                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                    : 'text-rf-ink-muted hover:text-rf-ink hover:bg-rf-surface-subtle'
                }`}
                onClick={() => setNavScope('role')}
              >
                Role: {selectedRole?.name || 'Selected Role'}
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  navScope === 'global'
                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                    : 'text-rf-ink-muted hover:text-rf-ink hover:bg-rf-surface-subtle'
                }`}
                onClick={() => setNavScope('global')}
              >
                Organization Default Baseline
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={isSaving || isNavLoading || (navScope === 'role' && isSystemRole)}
              onClick={handleShowAllPages}
              title="Make all pages visible for this configuration"
            >
              Show All
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={isSaving || isNavLoading || (navScope === 'role' && isSystemRole)}
              onClick={handleHideNonCorePages}
              title="Keep only Command Center and core items visible"
            >
              Hide Non-Core
            </Button>
            {navScope === 'role' && !isSystemRole && (
              <Button
                variant="secondary"
                size="sm"
                disabled={isSaving || isNavLoading}
                onClick={() => void handleResetToBaseline()}
                title="Reset this role's toggles to match organization baseline"
              >
                <Icon name="refresh-cw" size={12} />
                Reset to Baseline
              </Button>
            )}
          </div>
        </div>

        {/* Scope Context Alert Banner */}
        {navScope === 'role' ? (
          <div className="px-5 py-3 bg-blue-50/70 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/50 flex flex-wrap items-center justify-between gap-2 text-xs text-blue-900 dark:text-blue-200">
            <div className="flex items-center gap-2 min-w-0">
              <Icon name="shield-check" size={15} className="text-blue-600 dark:text-blue-400 shrink-0" />
              <span>
                Configuring sidebar visibility for role <strong>{selectedRole?.name}</strong> (<code className="font-mono text-[11px] font-bold">{selectedRole?.code}</code>). Hiding or showing pages here <strong>only affects users assigned to this role</strong>.
              </span>
            </div>
            <Badge variant="info">Role-Scoped</Badge>
          </div>
        ) : (
          <div className="px-5 py-3 bg-slate-50 dark:bg-slate-900/40 border-b border-rf-border-subtle flex flex-wrap items-center justify-between gap-2 text-xs text-rf-ink-muted">
            <div className="flex items-center gap-2 min-w-0">
              <Icon name="globe" size={15} className="text-slate-500 shrink-0" />
              <span>
                Configuring organization default baseline. Roles without explicit custom visibility overrides inherit these settings.
              </span>
            </div>
            <Badge variant="neutral">Organization Baseline</Badge>
          </div>
        )}

        {isSystemRole && navScope === 'role' && (
          <div className="px-5 py-3 bg-amber-50/70 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900/50 flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200">
            <Icon name="info" size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>Administrator Access Guarantee</strong>: The Administrator role retains full visibility across all system pages by default.
            </span>
          </div>
        )}

        {/* Search & Counter Filter */}
        <div className="p-4 border-b border-rf-border-subtle flex items-center justify-between gap-4">
          <div className="max-w-md w-full">
            <Input
              aria-label="Filter navigation items"
              placeholder="Search pages (e.g. CV Bank, Candidates, Reports, Offers)..."
              value={navSearch}
              onChange={(e) => setNavSearch(e.target.value)}
            />
          </div>
          <span className="text-xs text-rf-ink-muted font-medium whitespace-nowrap">
            Showing {filteredNavigation.length} of {navigation.length} pages
          </span>
        </div>

        {/* Navigation Items List */}
        {isNavLoading ? (
          <div className="p-8 text-center text-sm text-rf-ink-muted">
            <Icon name="refresh-cw" size={18} className="animate-spin inline-block mr-2" />
            Loading navigation settings…
          </div>
        ) : filteredNavigation.length === 0 ? (
          <div className="p-8 text-center text-sm text-rf-ink-muted">
            No pages match &ldquo;{navSearch}&rdquo;.
          </div>
        ) : (
          <div className="divide-y divide-rf-border-subtle max-h-[560px] overflow-y-auto">
            {filteredNavigation.map((item) => (
              <div
                key={item.key}
                className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(190px,280px)_auto] sm:items-center hover:bg-rf-surface-subtle/40 transition"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded-md bg-rf-surface-subtle text-rf-ink border border-rf-border-subtle">
                      <Icon name={item.icon as IconName} size={15} />
                    </span>
                    <span className="font-semibold text-sm text-rf-ink">{item.label}</span>
                    <Badge variant="neutral" className="text-[10px]">{item.group}</Badge>
                    {item.key === 'cv-bank' && (
                      <Badge variant="success" className="text-[10px]">CV Bank</Badge>
                    )}
                    {item.key === 'candidates' && (
                      <Badge variant="info" className="text-[10px]">Candidate DB</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-rf-ink-muted font-mono">{item.route}</p>
                </div>

                <Input
                  aria-label={`Label for ${item.key}`}
                  value={item.label}
                  disabled={navScope === 'role'}
                  title={navScope === 'role' ? 'Custom labels are configured in the Organization Baseline' : undefined}
                  onChange={(event) => updateNavigationItem(item.key, { label: event.target.value })}
                />

                <div className="flex items-center gap-2">
                  <Switch
                    label={item.visible ? 'Visible' : 'Hidden'}
                    checked={item.visible}
                    disabled={isSaving || (navScope === 'role' && isSystemRole)}
                    onCheckedChange={(visible) => updateNavigationItem(item.key, { visible })}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Modal isOpen={isPermissionOpen} onClose={() => setIsPermissionOpen(false)} title="Create organization permission" maxWidthClass="max-w-lg">
        <form className="space-y-4" onSubmit={(event) => void createPermission(event)}>
          <FormField id="permission-code" label="Code" required hint="Use a stable uppercase code, for example CV_EXPORT.">
            <Input id="permission-code" required value={permissionForm.code} onChange={(event) => setPermissionForm((form) => ({ ...form, code: event.target.value }))} />
          </FormField>
          <FormField id="permission-name" label="Name" required>
            <Input id="permission-name" required value={permissionForm.name} onChange={(event) => setPermissionForm((form) => ({ ...form, name: event.target.value }))} />
          </FormField>
          <FormField id="permission-description" label="Description">
            <Input id="permission-description" value={permissionForm.description} onChange={(event) => setPermissionForm((form) => ({ ...form, description: event.target.value }))} />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsPermissionOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" loading={isSaving}>Create permission</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
