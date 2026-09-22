import type { PipelineStageItem } from '@recruitflow/contracts';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getApi, postApi, patchApi } from '../api/client';
import { Icon, type IconName } from '../components/Icon';
import { Modal } from '../components/Modal';
import { UserResponsibilityModal } from '../components/UserResponsibilityModal';
import type {
  UserResponsibilitiesResponse,
  UserResponsibilityConfig,
} from '../types/accessControl';
import './PageEnhancementsV2.css';

interface StageSetting {
  id: string;
  order: number;
  name: string;
  subtext: string;
  icon: string;
  iconTone: string;
  category: string;
  categoryTone: string;
  requiredAction: string;
  slaDays: string;
  enabled: boolean;
}

interface PipelineTemplateSummary {
  id: string;
  name: string;
  isDefault: boolean;
  status: string;
  stageCount: number;
}

interface UserSummary {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  roles?: { id: string; name: string; code: string }[];
  status?: string;
}

interface RoleSummary {
  id: string;
  name: string;
  code: string;
  description?: string;
  isSystem?: boolean;
}

const DEFAULT_STAGES: StageSetting[] = [
  {
    id: 's1',
    order: 1,
    name: 'New',
    subtext: 'Application received & verified',
    icon: 'mail',
    iconTone: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40 dark:text-purple-300',
    category: 'Intake',
    categoryTone: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
    requiredAction: 'Initial resume screening',
    slaDays: '1 day',
    enabled: true,
  },
  {
    id: 's2',
    order: 2,
    name: 'Screening',
    subtext: 'Phone screen & clinical credentials',
    icon: 'calendar',
    iconTone: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300',
    category: 'Evaluation',
    categoryTone: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300',
    requiredAction: 'SCFHS / DHA license verification',
    slaDays: '2 days',
    enabled: true,
  },
  {
    id: 's3',
    order: 3,
    name: 'Technical Interview',
    subtext: 'Technical & clinical peer assessment',
    icon: 'calendar',
    iconTone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300',
    category: 'Interview',
    categoryTone: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
    requiredAction: 'Clinical panel scorecard',
    slaDays: '3 days',
    enabled: true,
  },
  {
    id: 's4',
    order: 4,
    name: 'Hiring Manager Interview',
    subtext: 'Department Head & leadership round',
    icon: 'users',
    iconTone: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300',
    category: 'Interview',
    categoryTone: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300',
    requiredAction: 'HOD approval & recommendation',
    slaDays: '3 days',
    enabled: true,
  },
  {
    id: 's5',
    order: 5,
    name: 'Offer',
    subtext: 'Compensation package generation & signing',
    icon: 'offer',
    iconTone: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40 dark:text-purple-300',
    category: 'Offer',
    categoryTone: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300',
    requiredAction: 'Offer approval',
    slaDays: '2 days',
    enabled: true,
  },
  {
    id: 's6',
    order: 6,
    name: 'Hired',
    subtext: 'Candidate accepted & onboarding initiated',
    icon: 'check-circle',
    iconTone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300',
    category: 'Closure',
    categoryTone: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
    requiredAction: 'Joining date confirmed & HR file created',
    slaDays: '—',
    enabled: true,
  },
];

const RESPONSIBILITY_DEFINITIONS: Record<
  string,
  { label: string; desc: string; icon: string; category: string; color: string; badgeTone: string }
> = {
  REQUISITIONS: {
    label: 'Jobs',
    desc: 'Create and approve open jobs.',
    icon: 'file-text',
    category: 'Intake',
    color: 'border-blue-500 bg-blue-50/70 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
    badgeTone: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800',
  },
  SOURCING: {
    label: 'Sourcing',
    desc: 'Add CVs and people to the pool.',
    icon: 'users',
    category: 'Intake',
    color: 'border-cyan-500 bg-cyan-50/70 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300',
    badgeTone: 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200/80 dark:border-cyan-800',
  },
  PRE_SCREENING: {
    label: 'Screening',
    desc: 'First review and phone screen.',
    icon: 'clipboard',
    category: 'Assessment',
    color: 'border-emerald-500 bg-emerald-50/70 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    badgeTone: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800',
  },
  INTERVIEWS: {
    label: 'Interviews',
    desc: 'Schedule interviews and submit scorecards.',
    icon: 'calendar',
    category: 'Assessment',
    color: 'border-purple-500 bg-purple-50/70 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',
    badgeTone: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800',
  },
  COMPENSATION: {
    label: 'Pay',
    desc: 'Set salary and allowances.',
    icon: 'offer',
    category: 'Offers',
    color: 'border-amber-500 bg-amber-50/70 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    badgeTone: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800',
  },
  OFFER_SIGNOFF: {
    label: 'Offer approval',
    desc: 'Approve and send the offer.',
    icon: 'check-circle',
    category: 'Offers',
    color: 'border-rose-500 bg-rose-50/70 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
    badgeTone: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800',
  },
  CREDENTIALING: {
    label: 'Licenses',
    desc: 'Check licenses and source documents.',
    icon: 'shield',
    category: 'Checks',
    color: 'border-indigo-500 bg-indigo-50/70 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
    badgeTone: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800',
  },
  ONBOARDING: {
    label: 'Joining',
    desc: 'Medical checks, visa, and first day.',
    icon: 'users',
    category: 'Checks',
    color: 'border-teal-500 bg-teal-50/70 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300',
    badgeTone: 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200/80 dark:border-teal-800',
  },
};

export function SettingsPage() {
  const [activeSubTab, setActiveSubTab] = useState('Pipeline');
  const [templates, setTemplates] = useState<PipelineTemplateSummary[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [stages, setStages] = useState<StageSetting[]>(DEFAULT_STAGES);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [isSavedToast, setIsSavedToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('Saved.');
  const [isAddStageModalOpen, setIsAddStageModalOpen] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [newStageCategory, setNewStageCategory] = useState('Interview');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // User Responsibilities state
  const [userRespData, setUserRespData] = useState<UserResponsibilitiesResponse | null>(null);
  const [selectedUserForModal, setSelectedUserForModal] = useState<UserResponsibilityConfig | null>(null);
  const [isResponsibilityModalOpen, setIsResponsibilityModalOpen] = useState(false);
  const [respSearchQuery, setRespSearchQuery] = useState('');
  const [respRoleFilter, setRespRoleFilter] = useState('');
  const [respBranchFilter, setRespBranchFilter] = useState('');
  const [respDeptFilter, setRespDeptFilter] = useState('');
  const [respWorkflowFilter, setRespWorkflowFilter] = useState('');
  const [isLoadingResp, setIsLoadingResp] = useState(false);

  // Pipeline behavior toggles
  const [allowReordering, setAllowReordering] = useState(true);
  const [allowSkipping, setAllowSkipping] = useState(false);
  const [requireAction, setRequireAction] = useState(true);
  const [autoArchive, setAutoArchive] = useState(true);

  // Load live pipeline templates from backend
  const loadTemplates = useCallback(async () => {
    try {
      const data = await getApi<PipelineTemplateSummary[]>('/pipeline-templates');
      if (Array.isArray(data) && data.length > 0) {
        setTemplates(data);
        const defaultTpl = data.find((t) => t.isDefault) || data[0];
        setSelectedTemplateId(defaultTpl.id);

        // Fetch stages of the selected template
        const detail = await getApi<{ stages: PipelineStageItem[] }>(`/pipeline-templates/${defaultTpl.id}`);
        if (detail?.stages && Array.isArray(detail.stages) && detail.stages.length > 0) {
          const mapped = detail.stages.map((st, idx: number) => ({
            id: st.id,
            order: st.sortOrder ?? idx + 1,
            name: st.name,
            subtext: `${st.stageType || 'Standard'} stage`,
            icon: st.stageType === 'Offer' ? 'offer' : st.stageType === 'Hired' ? 'check-circle' : 'calendar',
            iconTone: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300',
            category: st.stageType || 'Interview',
            categoryTone: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300',
            requiredAction: st.exitGate || 'Progress to next pipeline milestone',
            slaDays: st.slaDays ? `${st.slaDays} days` : '2 days',
            enabled: st.status !== 'Archived',
          }));
          setStages(mapped);
        }
      }
    } catch {
      // Fallback gracefully to default stages
    }
  }, []);

  // Load live users, roles, and user responsibilities from database
  const loadUsersAndRoles = useCallback(async () => {
    setIsLoadingResp(true);
    try {
      const [userData, roleData, respData] = await Promise.all([
        getApi<UserSummary[]>('/users').catch(() => []),
        getApi<RoleSummary[]>('/roles').catch(() => []),
        getApi<UserResponsibilitiesResponse>('/access-control/user-responsibilities').catch(() => null),
      ]);
      if (Array.isArray(userData)) setUsers(userData);
      if (Array.isArray(roleData)) setRoles(roleData);
      if (respData) setUserRespData(respData);
    } catch {
      // Ignore network errors
    } finally {
      setIsLoadingResp(false);
    }
  }, []);

  const handleSaveResponsibility = (updated: UserResponsibilityConfig) => {
    setUserRespData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        users: prev.users.map((u) => (u.userId === updated.userId ? updated : u)),
      };
    });
    setUsers((prev) =>
      prev.map((u) =>
        u.id === updated.userId
          ? {
              ...u,
              roles: updated.roles.map((r) => ({ id: r.id, name: r.name, code: r.code })),
            }
          : u
      )
    );
    showToast(`Saved responsibilities and access scope for ${updated.displayName}`);
  };

  const filteredRespUsers = useMemo(() => {
    if (!userRespData?.users) return [];
    return userRespData.users.filter((u) => {
      const q = respSearchQuery.toLowerCase().trim();
      if (q) {
        const matchesName = (u.displayName || '').toLowerCase().includes(q);
        const matchesEmail = (u.email || '').toLowerCase().includes(q);
        const matchesRole = u.roles?.some((r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q));
        const matchesBranch = u.branches?.some((b) => b.toLowerCase().includes(q));
        const matchesDept = u.departments?.some((d) => d.toLowerCase().includes(q));
        const matchesResp = u.workflowResponsibilities?.some((r) => r.toLowerCase().includes(q));
        if (!matchesName && !matchesEmail && !matchesRole && !matchesBranch && !matchesDept && !matchesResp) {
          return false;
        }
      }
      if (respRoleFilter && !u.roles?.some((r) => r.code === respRoleFilter)) {
        return false;
      }
      if (respBranchFilter) {
        const isAll = !u.branches || u.branches.length === 0 || u.branches.includes('ALL');
        if (!isAll && !u.branches.includes(respBranchFilter)) {
          return false;
        }
      }
      if (respDeptFilter) {
        const isAll = !u.departments || u.departments.length === 0 || u.departments.includes('All Departments') || u.departments.includes('ALL');
        if (!isAll && !u.departments.includes(respDeptFilter)) {
          return false;
        }
      }
      if (respWorkflowFilter && !u.workflowResponsibilities?.includes(respWorkflowFilter)) {
        return false;
      }
      return true;
    });
  }, [userRespData, respSearchQuery, respRoleFilter, respBranchFilter, respDeptFilter, respWorkflowFilter]);

  useEffect(() => {
    void loadTemplates();
    void loadUsersAndRoles();
  }, [loadTemplates, loadUsersAndRoles]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setIsSavedToast(true);
    setTimeout(() => setIsSavedToast(false), 3000);
  };

  const toggleStage = async (id: string) => {
    const stageToToggle = stages.find((s) => s.id === id);
    if (!stageToToggle) return;

    const nextState = !stageToToggle.enabled;
    setStages((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: nextState } : s))
    );

    if (selectedTemplateId && !id.startsWith('s')) {
      try {
        await patchApi(`/pipeline-templates/${selectedTemplateId}/stages/${id}`, {
          status: nextState ? 'Active' : 'Archived',
        });
        showToast(`Stage "${stageToToggle.name}" ${nextState ? 'enabled' : 'disabled'} in database.`);
      } catch {
        // Optimistic UI fallback
      }
    }
  };

  const handleAddStage = async () => {
    if (!newStageName.trim()) return;
    setIsSubmitting(true);
    try {
      if (selectedTemplateId) {
        const res = await postApi<PipelineStageItem>(`/pipeline-templates/${selectedTemplateId}/stages`, {
          name: newStageName.trim(),
          stageType: newStageCategory === 'Interview' ? 'Interview' : 'Screening',
          sortOrder: stages.length + 1,
        });
        setStages((prev) => [
          ...prev,
          {
            id: res?.id || `stage-${Date.now()}`,
            order: stages.length + 1,
            name: newStageName.trim(),
            subtext: `${newStageCategory} stage`,
            icon: 'calendar',
            iconTone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300',
            category: newStageCategory,
            categoryTone: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
            requiredAction: 'Evaluation required',
            slaDays: '3 days',
            enabled: true,
          },
        ]);
        showToast(`Pipeline stage "${newStageName}" created in database.`);
      }
      setIsAddStageModalOpen(false);
      setNewStageName('');
    } catch {
      // Fallback
      setStages((prev) => [
        ...prev,
        {
          id: `stage-${Date.now()}`,
          order: stages.length + 1,
          name: newStageName.trim(),
          subtext: `${newStageCategory} stage`,
          icon: 'calendar',
          iconTone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300',
          category: newStageCategory,
          categoryTone: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
          requiredAction: 'Evaluation required',
          slaDays: '3 days',
          enabled: true,
        },
      ]);
      setIsAddStageModalOpen(false);
      setNewStageName('');
      showToast(`Pipeline stage "${newStageName}" added.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex w-full flex-col p-4 sm:p-6 lg:p-7 max-w-[1720px] mx-auto space-y-6">
      {/* ── Top Action Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="rf-page-title">Settings</h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Pipeline stages and who can do what. Other setup lives on its own page.
          </p>
        </div>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Other setup pages">
        {[
          { label: 'Master data', to: '/master-data' },
          { label: 'SLA targets', to: '/settings/targets' },
          { label: 'Pipeline', to: '/pipeline-settings' },
          { label: 'Users and roles', to: '/users' },
          { label: 'Integrations', to: '/integrations' },
          { label: 'Audit log', to: '/audit-log' },
        ].map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-400 hover:text-blue-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {isSavedToast && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-bold animate-fade-in flex items-center gap-2">
          <Icon name="check-circle" size={14} className="text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Settings Sub-Navigation Bar ── */}
      <div className="flex items-center gap-6 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold overflow-x-auto pb-1">
        {[
          { label: 'Pipeline' },
          { label: 'People' },
          { label: 'Permissions' },
        ].map((tab) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => setActiveSubTab(tab.label)}
            className={`flex items-center gap-1.5 pb-2.5 transition whitespace-nowrap cursor-pointer ${
              activeSubTab === tab.label
                ? 'text-blue-600 font-extrabold border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── TAB 1: Pipeline Stages & Workflow ── */}
      {activeSubTab === 'Pipeline' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Pipeline Stages
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {templates.length > 0
                      ? `Template: ${templates.find((t) => t.id === selectedTemplateId)?.name || 'Default'}`
                      : 'Stages load from the saved pipeline. Until then, this is the default list.'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddStageModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 shadow-2xs cursor-pointer"
                  >
                    <Icon name="plus" size={13} />
                    <span>Add Stage</span>
                  </button>

                  <Link
                    to="/pipeline-settings"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-300 hover:bg-blue-100 transition shadow-2xs"
                  >
                    <Icon name="settings" size={13} />
                    <span>Edit pipeline</span>
                  </Link>
                </div>
              </div>

              {/* Stages List */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {stages.map((stage) => (
                  <div key={stage.id} className="flex items-center justify-between py-3.5 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 px-2 rounded-xl transition">
                    <div className="flex items-center gap-3.5">
                      <span className="text-xs font-bold text-slate-400 w-4 text-center">{stage.order}</span>
                      <span className={`p-2 rounded-xl ${stage.iconTone}`}>
                        <Icon name={stage.icon as IconName} size={15} />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-extrabold ${stage.enabled ? 'text-slate-900 dark:text-white' : 'text-slate-400 line-through'}`}>
                            {stage.name}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stage.categoryTone}`}>
                            {stage.category}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          {stage.requiredAction} · SLA: <strong className="text-slate-600 dark:text-slate-300">{stage.slaDays}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => void toggleStage(stage.id)}
                        className={`w-9 h-5 rounded-full transition relative cursor-pointer ${
                          stage.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                        title={stage.enabled ? 'Disable stage' : 'Enable stage'}
                      >
                        <span
                          className={`w-4 h-4 rounded-full bg-white transition absolute top-0.5 ${
                            stage.enabled ? 'right-0.5' : 'left-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Pipeline Behavior Rules Sidebar */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
                Pipeline Automation Rules
              </h2>

              <div className="space-y-4 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="block font-bold text-slate-900 dark:text-white">Allow Stage Reordering</span>
                    <span className="block text-[11px] text-slate-400">Recruiters can drag stages in pipeline templates.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAllowReordering(!allowReordering)}
                    className={`w-9 h-5 rounded-full transition relative shrink-0 cursor-pointer ${
                      allowReordering ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full bg-white transition absolute top-0.5 ${allowReordering ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="block font-bold text-slate-900 dark:text-white">Allow Skipping Stages</span>
                    <span className="block text-[11px] text-slate-400">Let a recruiter move someone past a stage.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAllowSkipping(!allowSkipping)}
                    className={`w-9 h-5 rounded-full transition relative shrink-0 cursor-pointer ${
                      allowSkipping ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full bg-white transition absolute top-0.5 ${allowSkipping ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="block font-bold text-slate-900 dark:text-white">Mandatory Action on Transition</span>
                    <span className="block text-[11px] text-slate-400">Requires scorecards or notes before advancing candidate.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRequireAction(!requireAction)}
                    className={`w-9 h-5 rounded-full transition relative shrink-0 cursor-pointer ${
                      requireAction ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full bg-white transition absolute top-0.5 ${requireAction ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="block font-bold text-slate-900 dark:text-white">Auto-archive Hired & Rejected</span>
                    <span className="block text-[11px] text-slate-400">Keep active pipeline boards uncluttered and responsive.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoArchive(!autoArchive)}
                    className={`w-9 h-5 rounded-full transition relative shrink-0 cursor-pointer ${
                      autoArchive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full bg-white transition absolute top-0.5 ${autoArchive ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 6: User Control & Selected Responsibilities ── */}
      {activeSubTab === 'People' && (
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">People</h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Branches, departments, and what each person can do.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void loadUsersAndRoles()}
                disabled={isLoadingResp}
                className="inline-flex min-h-8 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer"
              >
                {isLoadingResp ? 'Refreshing' : 'Refresh'}
              </button>
              <Link
                to="/users"
                className="inline-flex min-h-8 items-center rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Users and roles
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-baseline gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-900">
              <span className="text-slate-500">People</span>
              <span className="font-semibold text-slate-900 dark:text-white">{userRespData?.users.length ?? users.length}</span>
            </span>
            <span className="inline-flex items-baseline gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-900">
              <span className="text-slate-500">Branches</span>
              <span className="font-semibold text-slate-900 dark:text-white">{userRespData?.branches.length ?? 0}</span>
            </span>
            <span className="inline-flex items-baseline gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-900">
              <span className="text-slate-500">Departments</span>
              <span className="font-semibold text-slate-900 dark:text-white">{userRespData?.departments.length ?? 0}</span>
            </span>
          </div>

          {/* Search & Filter Controls Toolbar */}
          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              {/* Search */}
              <div className="lg:col-span-2 relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                  <Icon name="search" size={14} />
                </div>
                <input
                  type="text"
                  value={respSearchQuery}
                  onChange={(e) => setRespSearchQuery(e.target.value)}
                  placeholder="Search user name, email, department, or responsibility..."
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {respSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setRespSearchQuery('')}
                    className="absolute inset-y-0 right-2.5 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    <Icon name="close" size={12} />
                  </button>
                )}
              </div>

              {/* Role filter */}
              <div>
                <select
                  value={respRoleFilter}
                  onChange={(e) => setRespRoleFilter(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Roles ({roles.length})</option>
                  {roles.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Department filter */}
              <div>
                <select
                  value={respDeptFilter}
                  onChange={(e) => setRespDeptFilter(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Departments</option>
                  {userRespData?.departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* Workflow Responsibility filter */}
              <div>
                <select
                  value={respWorkflowFilter}
                  onChange={(e) => setRespWorkflowFilter(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All work</option>
                  {Object.entries(RESPONSIBILITY_DEFINITIONS).map(([key, item]) => (
                    <option key={key} value={key}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Filter status row */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/70 text-xs">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <span className="font-semibold">
                  Showing {filteredRespUsers.length} of {userRespData?.users.length || users.length} people
                </span>
                {(respSearchQuery || respRoleFilter || respDeptFilter || respWorkflowFilter || respBranchFilter) && (
                  <button
                    type="button"
                    onClick={() => {
                      setRespSearchQuery('');
                      setRespRoleFilter('');
                      setRespBranchFilter('');
                      setRespDeptFilter('');
                      setRespWorkflowFilter('');
                    }}
                    className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-bold ml-2 underline cursor-pointer"
                  >
                    Reset all filters
                  </button>
                )}
              </div>

              <div className="text-[11px] text-slate-500">Use Edit access on a person to change branches and work.</div>
            </div>
          </div>

          {/* User Responsibilities Cards Grid */}
          {filteredRespUsers.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-12 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
                <Icon name="users" size={20} />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">No people found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Nothing matches these filters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredRespUsers.map((user) => {
                const initials = user.displayName
                  ? user.displayName.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
                  : user.email.slice(0, 2).toUpperCase();

                const isAllBranches = !user.branches || user.branches.length === 0 || user.branches.includes('ALL');
                const isAllDepts = !user.departments || user.departments.length === 0 || user.departments.includes('All Departments') || user.departments.includes('ALL');
                const userWorkflows = user.workflowResponsibilities || [];

                return (
                  <div
                    key={user.userId}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs hover:border-blue-500/40 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-4">
                      {/* Top User Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200 shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                              {user.displayName || user.email}
                            </h3>
                            <p className="text-xs text-slate-400 truncate mt-0.5">
                              {user.email}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase shrink-0 ${
                            user.status === 'Active'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {user.status || 'Active'}
                        </span>
                      </div>

                      {/* Roles Badges */}
                      <div className="flex flex-wrap gap-1.5">
                        {user.roles && user.roles.length > 0 ? (
                          user.roles.map((r) => (
                            <span
                              key={r.code}
                              className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[11px] border border-slate-200/60 dark:border-slate-700/60"
                            >
                              {r.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No role assigned</span>
                        )}
                      </div>

                      {/* Facility & Department Allocation */}
                      <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                        {/* Branches */}
                        <div>
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                            <Icon name="grid-squares" size={12} className="text-blue-500" />
                            <span>Branches</span>
                          </div>
                          {isAllBranches ? (
                            <span className="text-xs text-slate-600 dark:text-slate-300">All branches</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {user.branches.slice(0, 3).map((b) => (
                                <span
                                  key={b}
                                  className="px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 truncate max-w-[200px]"
                                >
                                  {b}
                                </span>
                              ))}
                              {user.branches.length > 3 && (
                                <span className="px-1.5 py-0.5 rounded-md text-[10.5px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">
                                  +{user.branches.length - 3} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Departments */}
                        <div>
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                            <Icon name="clipboard" size={12} className="text-purple-500" />
                            <span>Departments</span>
                          </div>
                          {isAllDepts ? (
                            <span className="text-xs text-slate-600 dark:text-slate-300">All departments</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {user.departments.slice(0, 3).map((d) => (
                                <span
                                  key={d}
                                  className="px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 truncate max-w-[200px]"
                                >
                                  {d}
                                </span>
                              ))}
                              {user.departments.length > 3 && (
                                <span className="px-1.5 py-0.5 rounded-md text-[10.5px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">
                                  +{user.departments.length - 3} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Selected Workflow Responsibilities */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2">
                          <span className="flex items-center gap-1.5">
                            <Icon name="pipeline" size={12} className="text-amber-500" />
                            <span>Work</span>
                          </span>
                          <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {userWorkflows.length} / {Object.keys(RESPONSIBILITY_DEFINITIONS).length}
                          </span>
                        </div>

                        {userWorkflows.length === 0 ? (
                          <p className="text-xs text-slate-400 italic py-1">
                            None assigned.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {userWorkflows.map((respKey) => {
                              const info = RESPONSIBILITY_DEFINITIONS[respKey];
                              if (!info) return null;
                              return (
                                <span
                                  key={respKey}
                                  title={info.desc}
                                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10.5px] font-bold ${info.badgeTone}`}
                                >
                                  <Icon name={info.icon as IconName} size={11} />
                                  <span>{info.label}</span>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* RLS Scoping & Safeguards */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-500 dark:text-slate-400">Data Visibility Scope:</span>
                          <span className="font-extrabold font-mono text-[10.5px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {user.customScope || 'Default (Role Scoped)'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 text-[10.5px]">
                          <div className={`p-1.5 rounded-lg flex items-center gap-1 font-semibold ${user.canViewPii ?? true ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'}`}>
                            <Icon name={user.canViewPii ?? true ? 'check-circle' : 'shield'} size={11} />
                            <span>{user.canViewPii ?? true ? 'PII Visible' : 'PII Masked'}</span>
                          </div>

                          <div className={`p-1.5 rounded-lg flex items-center gap-1 font-semibold ${user.canViewSalary ?? false ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                            <Icon name={user.canViewSalary ?? false ? 'check-circle' : 'lock'} size={11} />
                            <span>{user.canViewSalary ?? false ? 'Salary Visible' : 'Salary Hidden'}</span>
                          </div>

                          <div className={`p-1.5 rounded-lg flex items-center gap-1 font-semibold ${user.canDownloadDocs ?? true ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                            <Icon name="file-text" size={11} />
                            <span>{user.canDownloadDocs ?? true ? 'Downloads OK' : 'No Downloads'}</span>
                          </div>

                          <div className={`p-1.5 rounded-lg flex items-center gap-1 font-semibold ${user.canApprove ?? false ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                            <Icon name="check-circle" size={11} />
                            <span>{user.canApprove ?? false ? 'Offer Sign-Off' : 'No Sign-Off'}</span>
                          </div>
                        </div>

                        {user.notes && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                            "{user.notes}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Configure Button */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedUserForModal(user);
                          setIsResponsibilityModalOpen(true);
                        }}
                        className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-extrabold flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
                      >
                        <Icon name="settings" size={13} />
                        <span>Edit access</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Workflow Responsibilities Reference Matrix */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Responsibilities
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                What each label means when you edit a person.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {Object.entries(RESPONSIBILITY_DEFINITIONS).map(([key, item]) => (
                <div
                  key={key}
                  className="p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 space-y-1.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-blue-600 shadow-xs border border-slate-200/50 dark:border-slate-700">
                      <Icon name={item.icon as IconName} size={13} />
                    </span>
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white leading-tight">
                      {item.label}
                    </span>
                  </div>
                  <span className="inline-block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {item.category}
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 7: Permissions & Access Governance ── */}
      {activeSubTab === 'Permissions' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Roles</h2>
              <p className="text-xs text-slate-500 mt-0.5">Edit permissions on Users and roles.</p>
            </div>

            <Link
              to="/audit-log"
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition"
            >
              <Icon name="audit" size={14} />
              <span>Audit log</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map((r) => (
              <div key={r.id} className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-900 dark:text-white">{r.name}</span>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-700 font-bold text-slate-700 dark:text-slate-300">{r.code}</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {r.description || 'No description.'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Stage Modal */}
      <Modal
        isOpen={isAddStageModalOpen}
        onClose={() => setIsAddStageModalOpen(false)}
        title="Add stage"
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300">Stage Name</label>
            <input
              type="text"
              value={newStageName}
              onChange={(e) => setNewStageName(e.target.value)}
              placeholder="e.g. Committee Review"
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300">Category</label>
            <select
              value={newStageCategory}
              onChange={(e) => setNewStageCategory(e.target.value)}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            >
              <option value="Intake">Intake / Screening</option>
              <option value="Interview">Interview Panel</option>
              <option value="Evaluation">Clinical Assessment</option>
              <option value="Offer">Offer Extension</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddStageModalOpen(false)}
              className="px-3.5 py-2 text-slate-500 hover:text-slate-700 cursor-pointer font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting || !newStageName.trim()}
              onClick={() => void handleAddStage()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold cursor-pointer transition disabled:opacity-50"
            >
              {isSubmitting ? 'Saving to DB...' : 'Add Stage to Pipeline'}
            </button>
          </div>
        </div>
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
        onSaveSuccess={handleSaveResponsibility}
      />
    </div>
  );
}

export default SettingsPage;
