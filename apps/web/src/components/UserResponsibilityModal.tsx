import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Switch } from './ui/Switch';
import { Icon } from './Icon';
import { putApi } from '../api/client';
import type {
  UserResponsibilityConfig,
  ResponsibilityItem,
  BranchOption,
  RoleOption,
  ScopeOption,
} from '../types/accessControl';

interface UserResponsibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserResponsibilityConfig | null;
  availableBranches: BranchOption[];
  availableDepartments: string[];
  availableResponsibilities: ResponsibilityItem[];
  availableRoles: RoleOption[];
  availableScopes: ScopeOption[];
  onSaveSuccess: (updated: UserResponsibilityConfig) => void;
}

export function UserResponsibilityModal({
  isOpen,
  onClose,
  user,
  availableBranches,
  availableDepartments,
  availableResponsibilities,
  availableRoles,
  availableScopes,
  onSaveSuccess,
}: UserResponsibilityModalProps) {
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [allBranches, setAllBranches] = useState(true);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [allDepartments, setAllDepartments] = useState(true);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedResponsibilities, setSelectedResponsibilities] = useState<string[]>([]);
  const [customScope, setCustomScope] = useState<string>('');
  const [canViewPii, setCanViewPii] = useState(true);
  const [canViewSalary, setCanViewSalary] = useState(false);
  const [canDownloadDocs, setCanDownloadDocs] = useState(true);
  const [canApprove, setCanApprove] = useState(false);
  const [notes, setNotes] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'scope' | 'workflow' | 'rls'>('scope');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (user) {
      setSelectedRoles(user.roles?.map((r) => r.code) || []);

      const branches = user.branches || [];
      const isAllB = branches.length === 0 || branches.includes('ALL');
      setAllBranches(isAllB);
      setSelectedBranches(isAllB ? [] : branches);

      const depts = user.departments || [];
      const isAllD = depts.length === 0 || depts.includes('All Departments') || depts.includes('ALL');
      setAllDepartments(isAllD);
      setSelectedDepartments(isAllD ? [] : depts);

      setSelectedResponsibilities(user.workflowResponsibilities || []);
      setCustomScope(user.customScope || '');
      setCanViewPii(user.canViewPii ?? true);
      setCanViewSalary(user.canViewSalary ?? false);
      setCanDownloadDocs(user.canDownloadDocs ?? true);
      setCanApprove(user.canApprove ?? false);
      setNotes(user.notes || '');
      setErrorMsg('');
      setActiveSubTab('scope');
    }
  }, [user]);

  if (!user) return null;

  const toggleRole = (code: string) => {
    setSelectedRoles((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const toggleBranch = (branchName: string) => {
    setSelectedBranches((prev) =>
      prev.includes(branchName) ? prev.filter((b) => b !== branchName) : [...prev, branchName]
    );
  };

  const toggleDepartment = (deptName: string) => {
    setSelectedDepartments((prev) =>
      prev.includes(deptName) ? prev.filter((d) => d !== deptName) : [...prev, deptName]
    );
  };

  const toggleResponsibility = (id: string) => {
    setSelectedResponsibilities((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMsg('');
    try {
      const payload = {
        roles: selectedRoles,
        branches: allBranches ? ['ALL'] : selectedBranches,
        departments: allDepartments ? ['All Departments'] : selectedDepartments,
        workflowResponsibilities: selectedResponsibilities,
        customScope: customScope || undefined,
        canViewPii,
        canViewSalary,
        canDownloadDocs,
        canApprove,
        notes,
      };

      const updated = await putApi<UserResponsibilityConfig>(
        `/access-control/user-responsibilities/${user.userId}`,
        payload
      );

      onSaveSuccess(updated);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save responsibilities');
    } finally {
      setIsSaving(false);
    }
  };

  const initials = (user.displayName || user.email).slice(0, 2).toUpperCase();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`User Control Panel: ${user.displayName || user.email}`}
      maxWidthClass="max-w-4xl"
    >
      <div className="space-y-5">
        {/* User Summary Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full bg-blue-600 text-white font-black text-sm flex items-center justify-center shadow-xs">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                  {user.displayName}
                </span>
                <Badge variant={user.status === 'Active' ? 'success' : 'neutral'}>
                  {user.status}
                </Badge>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">{user.email}</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 items-center">
            {selectedRoles.map((rCode) => {
              const r = availableRoles.find((x) => x.code === rCode);
              return (
                <span
                  key={rCode}
                  className="px-2.5 py-1 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 font-mono text-[11px] font-bold"
                >
                  {r?.name || rCode}
                </span>
              );
            })}
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-xl text-xs font-bold flex items-center gap-2">
            <Icon name="alert-triangle" size={14} className="text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Navigation Tabs inside modal */}
        <div className="flex items-center gap-4 border-b border-slate-200 dark:border-slate-800 text-xs font-bold pb-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('scope')}
            className={`pb-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'scope'
                ? 'text-blue-600 border-b-2 border-blue-600 font-extrabold'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Icon name="grid-squares" size={14} />
            <span>Facility & Department Allocation</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('workflow')}
            className={`pb-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'workflow'
                ? 'text-blue-600 border-b-2 border-blue-600 font-extrabold'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Icon name="check-circle" size={14} />
            <span>Workflow Responsibilities ({selectedResponsibilities.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('rls')}
            className={`pb-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'rls'
                ? 'text-blue-600 border-b-2 border-blue-600 font-extrabold'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Icon name="shield" size={14} />
            <span>Data Scoping & Field Privacy (RLS)</span>
          </button>
        </div>

        {/* ── TAB 1: Facility & Department Allocation ── */}
        {activeSubTab === 'scope' && (
          <div className="space-y-6 text-xs">
            {/* Roles Section */}
            <div>
              <label className="font-extrabold block text-slate-800 dark:text-slate-200 mb-2">
                Assigned Security Roles:
              </label>
              <div className="flex flex-wrap gap-2">
                {availableRoles.map((role) => {
                  const isChecked = selectedRoles.includes(role.code);
                  return (
                    <button
                      key={role.code}
                      type="button"
                      onClick={() => toggleRole(role.code)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        isChecked
                          ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-400'
                      }`}
                    >
                      <Icon name={isChecked ? 'check-circle' : 'plus'} size={13} />
                      <span>{role.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hospital Branches Section */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 block">
                    Hospital Facility / Branch Responsibilities:
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Confine or expand this user's operational authority across hospital entities.
                  </span>
                </div>
                <label className="flex items-center gap-2 font-bold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allBranches}
                    onChange={(e) => setAllBranches(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>All Facilities (Global)</span>
                </label>
              </div>

              {!allBranches && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-52 overflow-y-auto p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                  {availableBranches.map((b) => {
                    const isChecked = selectedBranches.includes(b.name) || selectedBranches.includes(b.id);
                    return (
                      <label
                        key={b.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-semibold cursor-pointer transition ${
                          isChecked
                            ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-400 text-blue-800 dark:text-blue-200 font-bold'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleBranch(b.name)}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="truncate">{b.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Clinical Departments Section */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 block">
                    Clinical & Operational Departments:
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Assign specific clinical disciplines or units this personnel represents.
                  </span>
                </div>
                <label className="flex items-center gap-2 font-bold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allDepartments}
                    onChange={(e) => setAllDepartments(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>All Departments</span>
                </label>
              </div>

              {!allDepartments && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-52 overflow-y-auto p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                  {availableDepartments.map((dept) => {
                    const isChecked = selectedDepartments.includes(dept);
                    return (
                      <label
                        key={dept}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-semibold cursor-pointer transition ${
                          isChecked
                            ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-400 text-blue-800 dark:text-blue-200 font-bold'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleDepartment(dept)}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="truncate">{dept}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 2: Delegated Workflow Responsibilities ── */}
        {activeSubTab === 'workflow' && (
          <div className="space-y-4 text-xs">
            <p className="text-slate-500 dark:text-slate-400">
              Select the active operational responsibilities delegated to this user across the recruitment lifecycle:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {availableResponsibilities.map((resp) => {
                const isSelected = selectedResponsibilities.includes(resp.id);
                return (
                  <div
                    key={resp.id}
                    onClick={() => toggleResponsibility(resp.id)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer select-none flex items-start gap-3 ${
                      isSelected
                        ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-400 shadow-xs'
                        : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 mt-0.5 rounded-md flex items-center justify-center transition shrink-0 ${
                        isSelected ? 'bg-blue-600 text-white' : 'border border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {isSelected && <Icon name="check-circle" size={13} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white text-xs">
                          {resp.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold">
                          {resp.category}
                        </span>
                      </div>
                      <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        {resp.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── TAB 3: Data Scoping & Field Privacy (RLS) ── */}
        {activeSubTab === 'rls' && (
          <div className="space-y-5 text-xs">
            <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold mb-1">
                <Icon name="shield" size={14} className="text-amber-600" />
                <span>Per-User Row-Level Security Override</span>
              </div>
              <p className="text-amber-800 dark:text-amber-300 text-[11.5px]">
                By default, this user inherits the data isolation scope of their security role. You can override scoping
                and sensitive field masking rules for this specific personnel account below.
              </p>
            </div>

            {/* Custom Scope Dropdown */}
            <div>
              <label className="font-extrabold block text-slate-800 dark:text-slate-200 mb-1.5">
                Requisitions & Candidate Row Visibility Scope:
              </label>
              <select
                value={customScope}
                onChange={(e) => setCustomScope(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold"
              >
                <option value="">(Inherit default scope from Role)</option>
                {availableScopes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Privacy Toggles */}
            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="font-extrabold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                Sensitive Data Protection & Authority
              </div>

              <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">Candidate Direct Contact PII</div>
                  <div className="text-[11.5px] text-slate-400">
                    When disabled, candidate phone and email are automatically masked with ***.
                  </div>
                </div>
                <Switch checked={canViewPii} onCheckedChange={setCanViewPii} />
              </div>

              <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">Salary & Compensation Figures</div>
                  <div className="text-[11.5px] text-slate-400">
                    Permission to view candidate expected salary and financial offer packages.
                  </div>
                </div>
                <Switch checked={canViewSalary} onCheckedChange={setCanViewSalary} />
              </div>

              <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">Document & Resume Downloads</div>
                  <div className="text-[11.5px] text-slate-400">
                    Permission to download candidate resumes, diplomas, and medical licenses.
                  </div>
                </div>
                <Switch checked={canDownloadDocs} onCheckedChange={setCanDownloadDocs} />
              </div>

              <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">Approval Gate Authority</div>
                  <div className="text-[11.5px] text-slate-400">
                    Can approve vacancy requests, offer letters, and hiring cases.
                  </div>
                </div>
                <Switch checked={canApprove} onCheckedChange={setCanApprove} />
              </div>
            </div>

            {/* Admin Notes */}
            <div className="pt-2">
              <label className="font-extrabold block text-slate-800 dark:text-slate-200 mb-1">
                Administrative Notes & Justification:
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Lead Consultant responsible for Cardiology intake in Central Region..."
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button variant="quiet" type="button" onClick={onClose}>
            Cancel
          </Button>

          <Button
            variant="primary"
            loading={isSaving}
            loadingLabel="Saving..."
            onClick={() => void handleSave()}
          >
            <Icon name="check-circle" size={14} />
            Save Responsibilities & Scope
          </Button>
        </div>
      </div>
    </Modal>
  );
}
