import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RecruiterTargetRecord } from '@recruitflow/contracts';
import { getApi, postApi, patchApi } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { isTeamLeaderOrAdmin } from '../auth/workspacePersona';
import { Icon } from './Icon';
import { Modal } from './Modal';
import { Button } from './ui/Button';
import { Select } from './ui/Select';

interface RecruiterOption {
  id: string;
  name: string;
  role: string;
}

interface Props {
  recruiterOptions: RecruiterOption[];
  showToast: (msg: string) => void;
  canManage?: boolean;
}

const TARGET_FIELDS = [
  { key: 'calls', label: 'Calls', icon: '📞', color: 'blue' },
  { key: 'screenings', label: 'Screenings', icon: '📋', color: 'indigo' },
  { key: 'interviews', label: 'Interviews', icon: '🎤', color: 'purple' },
  { key: 'offers', label: 'Offers', icon: '📄', color: 'emerald' },
  { key: 'hires', label: 'Hires', icon: '✅', color: 'teal' },
  { key: 'cvSourced', label: 'CVs Sourced', icon: '🔍', color: 'amber' },
] as const;

type TargetFieldKey = (typeof TARGET_FIELDS)[number]['key'];

interface TargetFormState {
  calls: number;
  screenings: number;
  interviews: number;
  offers: number;
  hires: number;
  cvSourced: number;
  notes: string;
}

const EMPTY_FORM: TargetFormState = {
  calls: 0,
  screenings: 0,
  interviews: 0,
  offers: 0,
  hires: 0,
  cvSourced: 0,
  notes: '',
};

export function RecruiterTargetsSection({ recruiterOptions, showToast, canManage }: Props) {
  const { user } = useAuth();
  const [targets, setTargets] = useState<RecruiterTargetRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly'>('daily');
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const effectiveCanManage = useMemo(() => {
    if (canManage !== undefined) return canManage;
    const isAdministrator = Boolean(
      user?.roles?.some((role) => role.code?.toUpperCase() === 'ADMIN' || role.code?.toUpperCase() === 'ADMINISTRATOR')
    );
    return isAdministrator || (isTeamLeaderOrAdmin(user) && Boolean(
      user?.permissions?.includes('VACANCY_MANAGE') || user?.permissions?.includes('VACANCY_ASSIGN')
    ));
  }, [canManage, user]);

  // Modal form state
  const [selectedRecruiterId, setSelectedRecruiterId] = useState('');
  const [modalPeriod, setModalPeriod] = useState<'daily' | 'monthly'>('daily');
  const [modalMonth, setModalMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [form, setForm] = useState<TargetFormState>({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadTargets = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getApi<RecruiterTargetRecord[]>(`/recruiter-targets?period=${activeTab}`);
      setTargets(Array.isArray(data) ? data : []);
    } catch {
      // silently degrade
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    void loadTargets();
  }, [loadTargets]);

  const openCreateModal = () => {
    if (!effectiveCanManage) {
      showToast('You do not have permission to set targets.');
      return;
    }
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setSelectedRecruiterId(recruiterOptions[0]?.id ?? '');
    setModalPeriod(activeTab);
    setModalMonth(new Date().toISOString().slice(0, 7));
    setIsModalOpen(true);
  };

  const openEditModal = (target: RecruiterTargetRecord) => {
    if (!effectiveCanManage) {
      showToast('You do not have permission to edit targets.');
      return;
    }
    setEditingId(target.id);
    setSelectedRecruiterId(target.recruiterId);
    setModalPeriod(target.period);
    setModalMonth(target.month ?? new Date().toISOString().slice(0, 7));
    setForm({
      calls: target.calls,
      screenings: target.screenings,
      interviews: target.interviews,
      offers: target.offers,
      hires: target.hires,
      cvSourced: target.cvSourced,
      notes: target.notes ?? '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!effectiveCanManage) {
      showToast('You do not have permission to set targets.');
      return;
    }
    setIsSaving(true);
    try {
      if (editingId) {
        await patchApi(`/recruiter-targets/${editingId}`, {
          ...form,
        });
        showToast('✓ Target updated successfully');
      } else {
        await postApi('/recruiter-targets', {
          recruiterId: selectedRecruiterId,
          period: modalPeriod,
          month: modalPeriod === 'monthly' ? modalMonth : undefined,
          ...form,
        });
        showToast('✓ Target saved successfully');
      }
      setIsModalOpen(false);
      void loadTargets();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to save target');
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (key: TargetFieldKey, value: number) => {
    setForm((prev) => ({ ...prev, [key]: Math.max(0, value) }));
  };

  // Group targets by recruiter for display
  const grouped = targets.reduce<Record<string, RecruiterTargetRecord>>((acc, t) => {
    acc[t.recruiterId] = t;
    return acc;
  }, {});

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-lg">
            🎯
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                Recruiter Activity Targets
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                {targets.length} Active
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Set daily &amp; monthly activity targets for each recruiter in your team.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Period Toggle */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
            <button
              type="button"
              onClick={() => setActiveTab('daily')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'daily'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>☀️</span>
              <span>Daily</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('monthly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'monthly'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>📅</span>
              <span>Monthly</span>
            </button>
          </div>

          {effectiveCanManage && (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Icon name="plus" size={13} />
              <span>Set Target</span>
            </button>
          )}
        </div>
      </div>

      {/* Target Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : targets.length === 0 ? (
        <div className="text-center py-10">
          <div className="text-3xl mb-2">🎯</div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            No {activeTab} targets set yet
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {effectiveCanManage
              ? 'Click "Set Target" to assign activity goals to your recruiters.'
              : 'No activity targets currently configured.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="text-left py-2.5 px-3 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                  Recruiter
                </th>
                {TARGET_FIELDS.map((f) => (
                  <th key={f.key} className="text-center py-2.5 px-2 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                    <span className="mr-1">{f.icon}</span>{f.label}
                  </th>
                ))}
                {effectiveCanManage && (
                  <th className="text-center py-2.5 px-2 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {Object.values(grouped).map((target) => {
                const initials = target.recruiterName
                  .split(' ')
                  .filter(Boolean)
                  .map((n) => n[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase();
                return (
                  <tr
                    key={target.id}
                    className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition"
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                          {initials}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white text-xs">{target.recruiterName}</div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500">
                            Set by {target.setByName}
                          </div>
                        </div>
                      </div>
                    </td>
                    {TARGET_FIELDS.map((f) => {
                      const value = target[f.key as keyof typeof target] as number;
                      return (
                        <td key={f.key} className="text-center py-3 px-2">
                          <span className={`inline-flex items-center justify-center min-w-[32px] px-2 py-1 rounded-lg font-extrabold text-xs ${
                            value > 0
                              ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                          }`}>
                            {value}
                          </span>
                        </td>
                      );
                    })}
                    {effectiveCanManage && (
                      <td className="text-center py-3 px-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(target)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition cursor-pointer"
                        >
                          <Icon name="edit" size={11} />
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Set / Edit Target Modal */}
      <Modal
        isOpen={isModalOpen && effectiveCanManage}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit Recruiter Target' : 'Set Recruiter Activity Target'}
      >
        <div className="space-y-5">
          {/* Recruiter Selection */}
          {!editingId && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Recruiter
              </label>
              <Select
                aria-label="Recruiter"
                value={selectedRecruiterId}
                onChange={(e) => setSelectedRecruiterId(e.target.value)}
              >
                {recruiterOptions.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </Select>
            </div>
          )}

          {/* Period Toggle */}
          {!editingId && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Target Period
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalPeriod('daily')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                    modalPeriod === 'daily'
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  ☀️ Daily Defaults
                </button>
                <button
                  type="button"
                  onClick={() => setModalPeriod('monthly')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                    modalPeriod === 'monthly'
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  📅 Monthly Target
                </button>
              </div>
            </div>
          )}

          {/* Month Picker (monthly only) */}
          {modalPeriod === 'monthly' && !editingId && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Target Month
              </label>
              <input
                type="month"
                aria-label="Target Month"
                value={modalMonth}
                onChange={(e) => setModalMonth(e.target.value)}
                className="h-9 w-full rounded-[7px] border border-rf-border bg-rf-field px-3 text-sm font-semibold text-rf-ink outline-none shadow-[var(--shadow-2xs)] transition-[border-color,box-shadow,background-color] duration-150 hover:border-rf-border-strong focus:border-rf-action focus:ring-2 focus:ring-rf-action/12"
              />
            </div>
          )}

          {/* Target Fields Grid */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Activity Targets
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {TARGET_FIELDS.map((f) => (
                <div
                  key={f.key}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30"
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-sm">{f.icon}</span>
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{f.label}</span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={form[f.key]}
                    onChange={(e) => updateField(f.key, parseInt(e.target.value) || 0)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-white text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Notes (optional)
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              rows={2}
              placeholder="e.g. Focus on nursing positions this month..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="secondary" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : editingId ? 'Update Target' : 'Save Target'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
