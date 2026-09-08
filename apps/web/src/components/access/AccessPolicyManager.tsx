import { useEffect, useMemo, useState } from 'react';
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

  const load = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [permissionResponse, navigationResponse] = await Promise.all([
        fetchApi<PermissionRecord[] | { data?: PermissionRecord[] }>('/roles/permissions'),
        fetchApi<NavigationItemRecord[] | { data?: NavigationItemRecord[] }>('/access-control/navigation'),
      ]);
      setPermissions(normalizeList(permissionResponse));
      setNavigation(normalizeList(navigationResponse));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load permissions and navigation settings.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    setRoleName(selectedRole?.name || '');
  }, [selectedRole?.id, selectedRole?.name]);

  const updateNavigationItem = (key: string, changes: Partial<NavigationItemRecord>) => {
    setNavigation((items) => items.map((item) => (item.key === key ? { ...item, ...changes } : item)));
  };

  const saveNavigation = async () => {
    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      await putApi('/access-control/navigation', {
        items: navigation.map(({ key, route, label, visible, sortOrder }) => ({ key, route, label, visible, sortOrder })),
      });
      setNotice('Sidebar labels and visibility were saved. Hiding a page does not change its direct access permission.');
      await load();
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
      await load();
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
      await load();
      await onRolesChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete permission.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="rounded-2xl border border-rf-border-subtle bg-rf-surface p-6 text-sm text-rf-ink-muted">Loading access policy settings…</div>;
  }

  return (
    <div className="space-y-5">
      {error && <Alert tone="danger" title="Access policy update failed">{error}</Alert>}
      {notice && <Alert tone="success" title="Access policy updated">{notice}</Alert>}

      <section className="rf-panel overflow-hidden rounded-2xl border border-rf-border-subtle bg-rf-surface shadow-xs">
        <SectionHeader
          title="Role permissions"
          description="Create named roles, then grant the natural API permissions they need. Administrator permissions stay complete and immutable."
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

        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(220px,280px)_1fr]">
          <div className="space-y-4">
            <FormField id="access-role" label="Role to configure" hint="System roles are read-only; organization roles can be edited.">
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
            <div className="mt-4 divide-y divide-rf-border-subtle rounded-xl border border-rf-border-subtle">
              {permissions.map((permission) => {
                const checked = isSystemRole || selectedPermissionIds.has(permission.id);
                return (
                  <div key={permission.id} className="flex items-center justify-between gap-3 p-3.5">
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

      <section className="rf-panel overflow-hidden rounded-2xl border border-rf-border-subtle bg-rf-surface shadow-xs">
        <SectionHeader
          title="Sidebar visibility"
          description="Choose labels and visibility per organization. This only controls the menu; normal route and API permissions still protect direct access."
          className="border-b border-rf-border-subtle p-5"
          actions={<Button variant="primary" size="sm" loading={isSaving} onClick={() => void saveNavigation()}><Icon name="check-circle" size={14} /> Save sidebar</Button>}
        />
        <div className="divide-y divide-rf-border-subtle">
          {navigation.map((item) => (
            <div key={item.key} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(190px,280px)_auto] sm:items-center">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Icon name={item.icon as IconName} size={15} />
                  <span className="font-semibold text-sm text-rf-ink">{item.label}</span>
                </div>
                <p className="mt-0.5 text-xs text-rf-ink-muted">{item.group} · {item.route}</p>
              </div>
              <Input
                aria-label={`Label for ${item.key}`}
                value={item.label}
                onChange={(event) => updateNavigationItem(item.key, { label: event.target.value })}
              />
              <Switch
                label={item.visible ? 'Visible' : 'Hidden'}
                checked={item.visible}
                onCheckedChange={(visible) => updateNavigationItem(item.key, { visible })}
              />
            </div>
          ))}
        </div>
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
