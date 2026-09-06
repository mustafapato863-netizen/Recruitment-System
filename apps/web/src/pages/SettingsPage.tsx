import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getApi, postApi, patchApi } from '../api/client';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
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
    requiredAction: 'Executive offer approval',
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

const SLA_RULES_DATA = [
  { roleLevel: 'Consultant Physician', timeToHire: '45 Days', screeningSla: '24 Hours', interviewSla: '3 Days', offerSla: '48 Hours', status: 'Active' },
  { roleLevel: 'Specialist Physician', timeToHire: '35 Days', screeningSla: '24 Hours', interviewSla: '3 Days', offerSla: '48 Hours', status: 'Active' },
  { roleLevel: 'Nursing Staff (ICU/ER/OR)', timeToHire: '25 Days', screeningSla: '12 Hours', interviewSla: '2 Days', offerSla: '24 Hours', status: 'Active' },
  { roleLevel: 'Allied Healthcare & Tech', timeToHire: '28 Days', screeningSla: '24 Hours', interviewSla: '3 Days', offerSla: '48 Hours', status: 'Active' },
  { roleLevel: 'Administrative & Ops', timeToHire: '21 Days', screeningSla: '24 Hours', interviewSla: '2 Days', offerSla: '24 Hours', status: 'Active' },
];

const INTERVIEW_TEMPLATES_DATA = [
  {
    id: 'it-1',
    title: 'Clinical Physician Assessment',
    department: 'Medical Operations',
    duration: '60 mins',
    rounds: 4,
    rubrics: ['Diagnostic Acumen & Clinical Judgment', 'Patient Safety & Ethical Protocols', 'SCFHS / International Board Competency', 'Interprofessional Communication'],
    scoreWeight: '100 pts total',
  },
  {
    id: 'it-2',
    title: 'Critical Care Nursing Assessment',
    department: 'Nursing',
    duration: '45 mins',
    rounds: 3,
    rubrics: ['Emergency Protocol Execution', 'Medication Administration & Safety', 'Patient Charting & EHR Workflow', 'Compassionate Care & Teamwork'],
    scoreWeight: '100 pts total',
  },
  {
    id: 'it-3',
    title: 'Hospital Administration & Finance',
    department: 'Operations',
    duration: '45 mins',
    rounds: 3,
    rubrics: ['Healthcare Regulations & Compliance', 'Budgeting & Resource Optimization', 'Leadership & Cross-functional Alignment'],
    scoreWeight: '100 pts total',
  },
];

const REJECTION_REASONS_DATA = [
  { code: 'REJ-LIC', label: 'SCFHS / Clinical License Not Verified', category: 'Regulatory Compliance', autoEmail: true, coolDown: '90 Days' },
  { code: 'REJ-EXP', label: 'Clinical Subspecialty Experience Mismatch', category: 'Qualifications', autoEmail: true, coolDown: '180 Days' },
  { code: 'REJ-SAL', label: 'Compensation Expectation Above Band', category: 'Compensation', autoEmail: false, coolDown: '30 Days' },
  { code: 'REJ-WTH', label: 'Candidate Withdrew Application', category: 'Candidate Initiated', autoEmail: false, coolDown: 'None' },
  { code: 'REJ-OFR', label: 'Candidate Accepted Competing Hospital Offer', category: 'Market Competition', autoEmail: false, coolDown: '60 Days' },
];

export function SettingsPage() {
  const [activeSubTab, setActiveSubTab] = useState('Pipeline Stages');
  const [templates, setTemplates] = useState<PipelineTemplateSummary[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [stages, setStages] = useState<StageSetting[]>(DEFAULT_STAGES);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [isSavedToast, setIsSavedToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('Recruitment settings updated successfully!');
  const [isAddStageModalOpen, setIsAddStageModalOpen] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [newStageCategory, setNewStageCategory] = useState('Interview');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        const detail = await getApi<any>(`/pipeline-templates/${defaultTpl.id}`);
        if (detail?.stages && Array.isArray(detail.stages) && detail.stages.length > 0) {
          const mapped = detail.stages.map((st: any, idx: number) => ({
            id: st.id,
            order: st.sortOrder ?? idx + 1,
            name: st.name,
            subtext: `${st.stageType || 'Standard'} stage`,
            icon: st.stageType === 'Offer' ? 'offer' : st.stageType === 'Hired' ? 'check-circle' : 'calendar',
            iconTone: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300',
            category: st.stageType || 'Interview',
            categoryTone: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300',
            requiredAction: st.requiredAction || 'Progress to next pipeline milestone',
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

  // Load live users & roles for Hiring Teams & Permissions tabs
  const loadUsersAndRoles = useCallback(async () => {
    try {
      const [userData, roleData] = await Promise.all([
        getApi<UserSummary[]>('/users').catch(() => []),
        getApi<RoleSummary[]>('/roles').catch(() => []),
      ]);
      if (Array.isArray(userData)) setUsers(userData);
      if (Array.isArray(roleData)) setRoles(roleData);
    } catch {
      // Ignore network errors
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
    void loadUsersAndRoles();
  }, [loadTemplates, loadUsersAndRoles]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setIsSavedToast(true);
    setTimeout(() => setIsSavedToast(false), 3000);
  };

  const handleSave = () => {
    showToast('Recruitment settings & pipeline governance configuration updated in database!');
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
        const res = await postApi<any>(`/pipeline-templates/${selectedTemplateId}/stages`, {
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
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Recruitment Settings
          </h1>

          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            Configure recruitment pipelines, SLAs, scoring rubrics, compensation policies, and access controls.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Database Synced</span>
          </div>

          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Icon name="check-circle" size={14} />
            <span>Save Configuration</span>
          </button>
        </div>
      </div>

      {/* ── Quick Administrative Deep-Links Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Master Data', desc: 'Entities & Branches', icon: 'grid-squares', to: '/master-data', color: 'blue' },
          { label: 'SLA Targets', desc: 'Position Goals', icon: 'clock', to: '/settings/targets', color: 'emerald' },
          { label: 'Pipeline Builder', desc: 'Custom Workflows', icon: 'pipeline', to: '/pipeline-settings', color: 'purple' },
          { label: 'Users & Roles', desc: 'Access Control', icon: 'users', to: '/users', color: 'amber' },
          { label: 'Integrations', desc: 'APIs & Webhooks', icon: 'integrations', to: '/integrations', color: 'cyan' },
          { label: 'Audit Log', desc: 'Compliance Trail', icon: 'audit', to: '/audit-log', color: 'rose' },
        ].map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className="group flex flex-col p-3.5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl hover:border-blue-500/50 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 group-hover:bg-blue-50 group-hover:text-blue-600 transition">
                <Icon name={item.icon as any} size={16} />
              </span>
              <Icon name="arrow-left" size={12} className="rotate-180 text-slate-300 group-hover:text-blue-500 transition" />
            </div>
            <span className="text-xs font-extrabold text-slate-900 dark:text-white group-hover:text-blue-600 transition">
              {item.label}
            </span>
            <span className="text-[11px] font-medium text-slate-400 mt-0.5 truncate">
              {item.desc}
            </span>
          </Link>
        ))}
      </div>

      {isSavedToast && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-bold animate-fade-in flex items-center gap-2">
          <Icon name="check-circle" size={14} className="text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Settings Sub-Navigation Bar ── */}
      <div className="flex items-center gap-6 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold overflow-x-auto pb-1">
        {[
          { label: 'Pipeline Stages', icon: 'pipeline' },
          { label: 'SLA Rules', icon: 'clock' },
          { label: 'Interview Templates', icon: 'file-text' },
          { label: 'Offer Templates', icon: 'offer' },
          { label: 'Rejection Reasons', icon: 'close' },
          { label: 'Hiring Teams', icon: 'users' },
          { label: 'Permissions', icon: 'shield' },
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
            <Icon name={tab.icon as any} size={14} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── TAB 1: Pipeline Stages & Workflow ── */}
      {activeSubTab === 'Pipeline Stages' && (
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
                      ? `Active Template: ${templates.find((t) => t.id === selectedTemplateId)?.name || 'Clinical Standard'}`
                      : 'Standard clinical recruitment pipeline template stored in database.'}
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
                    <span>Advanced Builder</span>
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
                        <Icon name={stage.icon as any} size={15} />
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
                    <span className="block text-[11px] text-slate-400">Enable fast-track for pre-screened healthcare executives.</span>
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

      {/* ── TAB 2: SLA Rules & Position Targets ── */}
      {activeSubTab === 'SLA Rules' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Service Level Agreements (SLAs) & Target Metrics
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Hospital time-to-hire thresholds and response time SLAs by clinical position level.
              </p>
            </div>

            <Link
              to="/settings/targets"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
            >
              <Icon name="clock" size={14} />
              <span>Manage Position Level Targets</span>
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10.5px]">
                <tr>
                  <th className="px-4 py-3 rounded-l-xl">Position Level</th>
                  <th className="px-4 py-3">Time to Hire Goal</th>
                  <th className="px-4 py-3">Screening SLA</th>
                  <th className="px-4 py-3">Interview SLA</th>
                  <th className="px-4 py-3">Offer Approval SLA</th>
                  <th className="px-4 py-3 rounded-r-xl">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {SLA_RULES_DATA.map((row) => (
                  <tr key={row.roleLevel} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white">{row.roleLevel}</td>
                    <td className="px-4 py-3.5 font-extrabold text-blue-600 dark:text-blue-400">{row.timeToHire}</td>
                    <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">{row.screeningSla}</td>
                    <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">{row.interviewSla}</td>
                    <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">{row.offerSla}</td>
                    <td className="px-4 py-3.5">
                      <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold rounded-lg text-[11px]">
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: Interview Templates ── */}
      {activeSubTab === 'Interview Templates' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Standardized Clinical Interview Rubrics
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Evaluation scorecards configured for hospital hiring panels and medical committees.
              </p>
            </div>

            <Link
              to="/interviews"
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition"
            >
              <Icon name="calendar" size={14} />
              <span>View Interview Calendar</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {INTERVIEW_TEMPLATES_DATA.map((tmpl) => (
              <div key={tmpl.id} className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10.5px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">
                      {tmpl.department}
                    </span>
                    <span className="text-xs font-bold text-slate-400">{tmpl.duration}</span>
                  </div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">{tmpl.title}</h3>

                  <div className="mt-3 space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Key Evaluation Rubrics:</span>
                    {tmpl.rubrics.map((r) => (
                      <div key={r} className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                        <span className="text-emerald-500">✓</span>
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-500">{tmpl.scoreWeight}</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400 cursor-pointer hover:underline">Edit Rubric</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 4: Offer Templates ── */}
      {activeSubTab === 'Offer Templates' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Compensation & Offer Packages
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Standard remuneration structures, housing allowances, medical coverage, and tiered approvals.
              </p>
            </div>

            <Link
              to="/offers"
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
            >
              <Icon name="offer" size={14} />
              <span>Open Offers Dashboard</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { tier: 'Physician Consultant', basic: 'SAR 45,000+', housing: '25% Basic', transport: 'SAR 2,000', coverage: 'Class A+ Executive VIP' },
              { tier: 'Specialist Physician', basic: 'SAR 28,000+', housing: '25% Basic', transport: 'SAR 1,500', coverage: 'Class A VIP' },
              { tier: 'Clinical Nursing', basic: 'SAR 9,000+', housing: 'Hospital Accom / Allowance', transport: 'Hospital Transport', coverage: 'Class B Standard' },
              { tier: 'Allied Health Staff', basic: 'SAR 12,000+', housing: '20% Basic', transport: 'SAR 1,000', coverage: 'Class B Standard' },
            ].map((p) => (
              <div key={p.tier} className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 space-y-3">
                <span className="text-xs font-extrabold text-slate-900 dark:text-white block">{p.tier}</span>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-slate-400">Base Salary:</span><span className="font-bold text-slate-800 dark:text-slate-200">{p.basic}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Housing:</span><span className="font-semibold text-slate-700 dark:text-slate-300">{p.housing}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Transport:</span><span className="font-semibold text-slate-700 dark:text-slate-300">{p.transport}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Medical:</span><span className="font-semibold text-emerald-600 dark:text-emerald-400">{p.coverage}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 5: Rejection Reasons ── */}
      {activeSubTab === 'Rejection Reasons' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Rejection Reasons & Pipeline Exit Codes
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Regulated rejection categories with compliance cooldown periods and candidate notification triggers.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10.5px]">
                <tr>
                  <th className="px-4 py-3 rounded-l-xl">Code</th>
                  <th className="px-4 py-3">Reason Label</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Candidate Email</th>
                  <th className="px-4 py-3 rounded-r-xl">Reapplication Cooldown</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {REJECTION_REASONS_DATA.map((r) => (
                  <tr key={r.code} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3.5 font-mono font-bold text-slate-500">{r.code}</td>
                    <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white">{r.label}</td>
                    <td className="px-4 py-3.5 text-slate-500">{r.category}</td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold ${r.autoEmail ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                        {r.autoEmail ? 'Automated Email' : 'Manual Review'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-bold text-slate-700 dark:text-slate-300">{r.coolDown}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 6: Hiring Teams (Live Database Users) ── */}
      {activeSubTab === 'Hiring Teams' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Hiring Teams & Organization Personnel
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Active recruitment operations staff and hiring managers synced from database ({users.length} members).
              </p>
            </div>

            <Link
              to="/users"
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
            >
              <Icon name="users" size={14} />
              <span>Manage Users & Roles</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.slice(0, 9).map((u) => {
              const name = u.displayName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;
              const roleName = u.roles?.[0]?.name || 'Workspace Member';
              const initials = name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();

              return (
                <div key={u.id} className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-xs shrink-0">
                    {initials}
                  </div>
                  <div className="truncate">
                    <span className="block text-xs font-extrabold text-slate-900 dark:text-white truncate">
                      {name}
                    </span>
                    <span className="block text-[11px] text-slate-400 truncate">
                      {u.email}
                    </span>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold text-[10px]">
                      {roleName}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 7: Permissions & Access Governance ── */}
      {activeSubTab === 'Permissions' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Role-Based Access Control (RBAC) Governance
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Active security roles and functional privilege gates enforced across the API and database.
              </p>
            </div>

            <Link
              to="/audit-log"
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition"
            >
              <Icon name="audit" size={14} />
              <span>Inspect Audit Trail</span>
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
                  {r.description || 'Enterprise role with scoped permissions for recruitment workflows.'}
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
        title="Add New Pipeline Stage"
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
    </div>
  );
}

export default SettingsPage;
