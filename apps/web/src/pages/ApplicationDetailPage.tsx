import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getApi, patchApi } from '../api/client';
import type { Application, ApplicationStatusHistoryItem, ScreeningLog } from '@recruitflow/contracts';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import './PageEnhancementsV2.css';

export function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [application, setApplication] = useState<Application | null>(null);
  const [, setHistory] = useState<ApplicationStatusHistoryItem[]>([]);
  const [, setScreeningLogs] = useState<ScreeningLog[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'resume' | 'interviews' | 'activity' | 'tasks'>('overview');

  // Modals
  const [isMoveStageModalOpen, setIsMoveStageModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isAddNoteModalOpen, setIsAddNoteModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isViewResumeModalOpen, setIsViewResumeModalOpen] = useState(false);
  const [isAddTagModalOpen, setIsAddTagModalOpen] = useState(false);
  const [tags, setTags] = useState(['React', 'TypeScript', 'Frontend', '3+ Years', 'English']);
  const [newTagInput, setNewTagInput] = useState('');

  // Move stage selection
  const [selectedNextStage, setSelectedNextStage] = useState('First Interview');

  useEffect(() => {
    if (!id) return;
    Promise.allSettled([
      getApi<Application>(`/applications/${id}`),
      getApi<ApplicationStatusHistoryItem[]>(`/applications/${id}/history`),
      getApi<ScreeningLog[]>(`/screening/application/${id}`),
    ]).then(([appRes, histRes, scrRes]) => {
      if (appRes.status === 'fulfilled' && appRes.value) {
        setApplication(appRes.value);
      }
      if (histRes.status === 'fulfilled' && histRes.value) {
        setHistory(histRes.value);
      }
      if (scrRes.status === 'fulfilled' && scrRes.value) {
        setScreeningLogs(scrRes.value);
      }
    });
  }, [id]);

  const candidateName = application?.candidate
    ? `${application.candidate.firstName} ${application.candidate.lastName}`
    : 'Ali Hassan';
  const roleName = application?.positionTitle || 'Frontend Developer';
  const candidateEmail = application?.candidate?.email || 'ali.hassan@email.com';
  const candidatePhone = application?.candidate?.phone || '+20 101 234 5678';
  const candidateLocation = 'Cairo, Egypt';
  const appIdDisplay = application?.id ? (application.id.length > 10 ? 'APP-02481' : application.id) : 'APP-02481';

  const handleAddTag = () => {
    if (newTagInput.trim() && !tags.includes(newTagInput.trim())) {
      setTags([...tags, newTagInput.trim()]);
      setNewTagInput('');
      setIsAddTagModalOpen(false);
    }
  };

  const handleStageMove = async () => {
    if (id) {
      try {
        await patchApi(`/applications/${id}/stage`, { stage: selectedNextStage });
      } catch {}
    }
    setIsMoveStageModalOpen(false);
  };

  return (
    <div className="flex w-full flex-col p-4 sm:p-6 lg:p-7 max-w-[1720px] mx-auto space-y-6">
      {/* ── Breadcrumb & Top Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-slate-400">
            <span
              onClick={() => navigate('/applications')}
              className="hover:text-blue-600 cursor-pointer"
            >
              Applications
            </span>
            <span className="mx-2">&bull;</span>
            <span className="text-slate-700 dark:text-slate-200">{appIdDisplay}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
            Applicant Profile
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate('/applications')}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs cursor-pointer"
          >
            <Icon name="arrow-left" size={13} />
            <span>Back to applications</span>
          </button>

          <button
            type="button"
            className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 transition shadow-xs cursor-pointer"
          >
            <Icon name="more-horizontal" size={16} />
          </button>
        </div>
      </div>

      {/* ── Horizontal Navigation Tabs (Overview, Resume, Interviews, Activity, Tasks) ── */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex items-center gap-6 overflow-x-auto rf-scrollbar text-xs font-semibold">
        {(['overview', 'resume', 'interviews', 'activity', 'tasks'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              if (tab === 'interviews') navigate('/interviews');
              else setActiveTab(tab);
            }}
            className={`pb-3.5 border-b-2 transition capitalize cursor-pointer shrink-0 ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Main Two-Column Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ════════ Left Sidebar (~28% width / 4 cols) ════════ */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-5">
            {/* Candidate Photo & Basic Info */}
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center text-xl font-bold text-slate-700 dark:text-slate-200 mb-3 shadow-xs">
                {candidateName.split(' ').map((n) => n[0]).join('')}
              </div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                {candidateName}
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {roleName}
              </p>

              {/* Star Rating & Fit Badge */}
              <div className="flex items-center gap-1.5 mt-2">
                <div className="flex text-amber-400 text-xs">
                  <span>★</span>
                  <span>★</span>
                  <span>★</span>
                  <span>★</span>
                  <span className="text-slate-200 dark:text-slate-700">★</span>
                </div>
                <span className="text-xs font-black text-slate-700 dark:text-slate-200 ml-1">4.2</span>
              </div>
              <span className="inline-block text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                Strong fit
              </span>
            </div>

            {/* Contact & Meta Rows */}
            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                <Icon name="mail" size={14} className="text-slate-400 shrink-0" />
                <span className="truncate">{candidateEmail}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                <Icon name="phone" size={14} className="text-slate-400 shrink-0" />
                <span>{candidatePhone}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                <Icon name="map-pin" size={14} className="text-slate-400 shrink-0" />
                <span>{candidateLocation}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                <Icon name="briefcase" size={14} className="text-slate-400 shrink-0" />
                <span>3 years experience</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                <Icon name="calendar" size={14} className="text-slate-400 shrink-0" />
                <div>
                  <span className="block text-[10px] text-slate-400">Applied on</span>
                  <span className="font-semibold">28 Aug 2026</span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                <Icon name="briefcase" size={14} className="text-slate-400 shrink-0" />
                <div>
                  <span className="block text-[10px] text-slate-400">Current company</span>
                  <span className="font-semibold">Tech Solutions</span>
                </div>
              </div>
            </div>

            {/* Fit Summary */}
            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">Fit summary</h3>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-slate-500">Skills match</span>
                  <span className="text-slate-900 dark:text-white font-bold">85%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full rounded-full" style={{ width: '85%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-slate-500">Experience match</span>
                  <span className="text-slate-900 dark:text-white font-bold">80%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: '80%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-slate-500">Culture fit</span>
                  <span className="text-slate-900 dark:text-white font-bold">75%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full" style={{ width: '75%' }} />
                </div>
              </div>
            </div>

            {/* View Resume Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsViewResumeModalOpen(true)}
                className="w-full py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Icon name="file-text" size={14} className="text-slate-400" />
                <span>View r&eacute;sum&eacute;</span>
              </button>
            </div>
          </div>
        </div>

        {/* ════════ Right Main Column (~72% width / 8 cols) ════════ */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          {/* ── Top KPI Summary Strip (5 metric cells) ── */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800">
              {/* Cell 1: Current stage */}
              <div className="space-y-1">
                <span className="block text-[11px] font-semibold text-slate-400 uppercase">Current stage</span>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  First Interview
                </span>
                <span className="block text-[11px] text-slate-400 mt-0.5">Since 28 Aug 2026</span>
              </div>

              {/* Cell 2: Next action */}
              <div className="space-y-1 md:pl-4 pt-3 md:pt-0">
                <span className="block text-[11px] font-semibold text-slate-400 uppercase">Next action</span>
                <span className="block text-xs font-bold text-slate-900 dark:text-white">Technical interview</span>
                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                  <Icon name="calendar" size={12} className="text-slate-400" />
                  <span>Today, 2:00 PM</span>
                </div>
              </div>

              {/* Cell 3: Owner */}
              <div className="space-y-1 md:pl-4 pt-3 md:pt-0">
                <span className="block text-[11px] font-semibold text-slate-400 uppercase">Owner</span>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-teal-600 text-white text-[9px] font-extrabold flex items-center justify-center shrink-0">
                    SA
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-900 dark:text-white leading-tight">Sarah Ahmed</span>
                    <span className="block text-[10px] text-slate-400">Senior Recruiter</span>
                  </div>
                </div>
              </div>

              {/* Cell 4: SLA */}
              <div className="space-y-1 md:pl-4 pt-3 md:pt-0">
                <span className="block text-[11px] font-semibold text-slate-400 uppercase">SLA</span>
                <span className="block text-xs font-bold text-amber-600 dark:text-amber-400">6h left</span>
                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                  <Icon name="clock" size={12} />
                  <span>Due today, 8:00 PM</span>
                </div>
              </div>

              {/* Cell 5: Last activity */}
              <div className="space-y-1 md:pl-4 pt-3 md:pt-0">
                <span className="block text-[11px] font-semibold text-slate-400 uppercase">Last activity</span>
                <span className="block text-xs font-bold text-slate-900 dark:text-white">Interview invitation sent</span>
                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                  <Icon name="check-circle" size={12} className="text-emerald-500" />
                  <span>Today, 9:12 AM</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Middle Row: Timeline (Left ~60%) & Quick Actions / About (Right ~40%) ── */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left: Timeline Card (7 cols) */}
            <div className="md:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Timeline
                </h2>
                <button type="button" className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                  View full timeline
                </button>
              </div>

              {/* Stepper Timeline List */}
              <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                {/* Event 1 */}
                <div className="relative">
                  <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center text-[10px]">
                    <Icon name="calendar" size={11} />
                  </div>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="block text-xs font-bold text-slate-900 dark:text-white">Interview invitation sent</span>
                      <span className="block text-[11px] text-slate-400">by Sarah Ahmed</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-slate-400">Today, 9:12 AM</span>
                      <Icon name="check-circle" size={12} className="text-emerald-500" />
                    </div>
                  </div>
                </div>

                {/* Event 2 */}
                <div className="relative">
                  <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center text-[10px]">
                    <Icon name="users" size={11} />
                  </div>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="block text-xs font-bold text-slate-900 dark:text-white">Moved to First Interview</span>
                      <span className="block text-[11px] text-slate-400">by Sarah Ahmed</span>
                    </div>
                    <span className="text-[11px] text-slate-400">Today, 9:11 AM</span>
                  </div>
                </div>

                {/* Event 3 */}
                <div className="relative">
                  <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center text-[10px]">
                    <Icon name="file-text" size={11} />
                  </div>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="block text-xs font-bold text-slate-900 dark:text-white">Resume reviewed</span>
                      <span className="block text-[11px] text-slate-400">by Sarah Ahmed</span>
                    </div>
                    <span className="text-[11px] text-slate-400">Yesterday, 4:35 PM</span>
                  </div>
                </div>

                {/* Event 4 */}
                <div className="relative">
                  <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center text-[10px]">
                    <Icon name="plus" size={11} />
                  </div>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="block text-xs font-bold text-slate-900 dark:text-white">Application received</span>
                      <span className="block text-[11px] text-slate-400">via LinkedIn</span>
                    </div>
                    <span className="text-[11px] text-slate-400">28 Aug 2026, 10:23 AM</span>
                  </div>
                </div>

                {/* Event 5 */}
                <div className="relative">
                  <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 flex items-center justify-center text-[10px]">
                    <Icon name="user" size={11} />
                  </div>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="block text-xs font-bold text-slate-900 dark:text-white">Profile created</span>
                      <span className="block text-[11px] text-slate-400">by System</span>
                    </div>
                    <span className="text-[11px] text-slate-400">28 Aug 2026, 10:22 AM</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Quick Actions & About this application (5 cols) */}
            <div className="md:col-span-5 space-y-6">
              {/* Quick Actions Card */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-3">
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">
                  Quick actions
                </h2>

                <div
                  onClick={() => navigate(`/applications/${id || 'APP-02481'}/transition`)}
                  className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shrink-0">
                      <Icon name="arrow-right" size={15} />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition">
                        Move stage
                      </span>
                      <span className="block text-[10px] text-slate-400">
                        Advance or change stage
                      </span>
                    </div>
                  </div>
                  <Icon name="chevron-right" size={14} className="text-slate-300 group-hover:translate-x-0.5 transition" />
                </div>

                <div
                  onClick={() => setIsScheduleModalOpen(true)}
                  className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
                      <Icon name="calendar" size={15} />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 transition">
                        Schedule interview
                      </span>
                      <span className="block text-[10px] text-slate-400">
                        Plan interview with team
                      </span>
                    </div>
                  </div>
                  <Icon name="chevron-right" size={14} className="text-slate-300 group-hover:translate-x-0.5 transition" />
                </div>

                <div
                  onClick={() => setIsAddNoteModalOpen(true)}
                  className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0">
                      <Icon name="file-text" size={15} />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-slate-900 dark:text-white group-hover:text-amber-600 transition">
                        Add note
                      </span>
                      <span className="block text-[10px] text-slate-400">
                        Add internal note
                      </span>
                    </div>
                  </div>
                  <Icon name="chevron-right" size={14} className="text-slate-300 group-hover:translate-x-0.5 transition" />
                </div>

                <div
                  onClick={() => setIsRejectModalOpen(true)}
                  className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-red-50/50 dark:hover:bg-red-950/20 transition cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 flex items-center justify-center shrink-0">
                      <Icon name="slash" size={15} />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-slate-900 dark:text-white group-hover:text-red-600 transition">
                        Reject applicant
                      </span>
                      <span className="block text-[10px] text-slate-400">
                        Move to rejected
                      </span>
                    </div>
                  </div>
                  <Icon name="chevron-right" size={14} className="text-slate-300 group-hover:translate-x-0.5 transition" />
                </div>
              </div>

              {/* About this application Card */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-3">
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">
                  About this application
                </h2>

                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-slate-100/60 dark:border-slate-800/60">
                    <span className="text-slate-400">Application ID</span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono">{appIdDisplay}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-100/60 dark:border-slate-800/60">
                    <span className="text-slate-400">Source</span>
                    <span className="font-bold text-slate-900 dark:text-white">LinkedIn</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-100/60 dark:border-slate-800/60">
                    <span className="text-slate-400">Position</span>
                    <span className="font-bold text-slate-900 dark:text-white">Senior Frontend Engineer</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-100/60 dark:border-slate-800/60">
                    <span className="text-slate-400">Department</span>
                    <span className="font-bold text-slate-900 dark:text-white">Engineering</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-400">Location</span>
                    <span className="font-bold text-slate-900 dark:text-white">Cairo, Egypt</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Bottom Row: Notes (Left ~60%) & Tags (Right ~40%) ── */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Notes Card (7 cols) */}
            <div className="md:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Notes
                </h2>
                <button
                  type="button"
                  onClick={() => setIsAddNoteModalOpen(true)}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  View all notes
                </button>
              </div>

              <div className="p-3.5 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-teal-600 text-white text-[10px] font-extrabold flex items-center justify-center shrink-0">
                    SA
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Sarah Ahmed</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Strong technical background in React and TypeScript. Good communication skills and cultural fit.
                </p>
                <span className="block text-[10px] text-slate-400">
                  Today, 9:15 AM
                </span>
              </div>
            </div>

            {/* Tags Card (5 cols) */}
            <div className="md:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                Tags
              </h2>

              <div className="flex flex-wrap items-center gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                  >
                    {tag}
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => setIsAddTagModalOpen(true)}
                  className="px-2.5 py-1 rounded-full text-xs font-semibold text-slate-500 border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 hover:text-blue-600 transition cursor-pointer"
                >
                  + Add tag
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modals for Quick Actions ── */}
      {/* 1. Move Stage Modal */}
      <Modal
        isOpen={isMoveStageModalOpen}
        onClose={() => setIsMoveStageModalOpen(false)}
        title="Move Candidate Stage"
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="font-bold block mb-1">Select Next Stage</label>
            <Select
              value={selectedNextStage}
              onChange={(e) => setSelectedNextStage(e.target.value)}
            >
              <option value="Screening">Screening</option>
              <option value="First Interview">First Interview</option>
              <option value="Technical Interview">Technical Interview</option>
              <option value="Hiring Manager Interview">Hiring Manager Interview</option>
              <option value="Offer">Offer</option>
              <option value="Hired">Hired</option>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsMoveStageModalOpen(false)}
              className="px-3 py-1.5 text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleStageMove()}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-xl font-bold cursor-pointer"
            >
              Confirm Move
            </button>
          </div>
        </div>
      </Modal>

      {/* 2. Schedule Interview Modal */}
      <Modal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        title="Schedule Interview"
        maxWidthClass="max-w-md"
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="font-bold block mb-1">Interview Type</label>
            <Select defaultValue="Technical Interview">
              <option value="Phone Screen">Phone Screen</option>
              <option value="Technical Interview">Technical Interview</option>
              <option value="HM Interview">HM Interview</option>
            </Select>
          </div>
          <div>
            <label className="font-bold block mb-1">Date &amp; Time</label>
            <Input type="datetime-local" defaultValue="2026-09-03T14:00" />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsScheduleModalOpen(false)}
              className="px-3 py-1.5 text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setIsScheduleModalOpen(false)}
              className="px-4 py-1.5 bg-emerald-600 text-white rounded-xl font-bold cursor-pointer"
            >
              Send Invitation
            </button>
          </div>
        </div>
      </Modal>

      {/* 3. Add Note Modal */}
      <Modal
        isOpen={isAddNoteModalOpen}
        onClose={() => setIsAddNoteModalOpen(false)}
        title="Add Internal Note"
        maxWidthClass="max-w-md"
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="font-bold block mb-1">Note Content</label>
            <textarea
              rows={4}
              placeholder="Type candidate observations..."
              className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsAddNoteModalOpen(false)}
              className="px-3 py-1.5 text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setIsAddNoteModalOpen(false)}
              className="px-4 py-1.5 bg-amber-600 text-white rounded-xl font-bold cursor-pointer"
            >
              Save Note
            </button>
          </div>
        </div>
      </Modal>

      {/* 4. Reject Modal */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title="Reject Applicant"
        maxWidthClass="max-w-md"
      >
        <div className="space-y-3 text-xs">
          <p className="text-slate-500">
            Are you sure you want to reject this applicant? This will transition their status to Rejected.
          </p>
          <div>
            <label className="font-bold block mb-1">Reason for Rejection</label>
            <Select defaultValue="Skills mismatch">
              <option value="Skills mismatch">Skills mismatch</option>
              <option value="Salary expectations">Salary expectations</option>
              <option value="Not responsive">Not responsive</option>
              <option value="Position filled">Position filled</option>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsRejectModalOpen(false)}
              className="px-3 py-1.5 text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setIsRejectModalOpen(false)}
              className="px-4 py-1.5 bg-red-600 text-white rounded-xl font-bold cursor-pointer"
            >
              Confirm Rejection
            </button>
          </div>
        </div>
      </Modal>

      {/* 5. View Resume Modal */}
      <Modal
        isOpen={isViewResumeModalOpen}
        onClose={() => setIsViewResumeModalOpen(false)}
        title="Ali Hassan - R&eacute;sum&eacute;"
        maxWidthClass="max-w-2xl"
      >
        <div className="space-y-4 text-xs p-2">
          <div className="border-b pb-3">
            <h3 className="text-sm font-bold">Ali Hassan</h3>
            <p className="text-slate-500">Frontend Developer &bull; Cairo, Egypt &bull; ali.hassan@email.com</p>
          </div>
          <div>
            <h4 className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] mb-1">Summary</h4>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              Passionate Frontend Developer with 3+ years of experience building modern responsive web apps using React, TypeScript, Next.js, and TailwindCSS.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] mb-1">Experience</h4>
            <div className="space-y-2">
              <div>
                <span className="font-bold block">Frontend Engineer &bull; Tech Solutions</span>
                <span className="text-[11px] text-slate-400 block">2023 - Present</span>
                <p className="text-slate-600 dark:text-slate-300 mt-0.5">Developed healthcare patient management portals using React and TypeScript.</p>
              </div>
            </div>
          </div>
          <div className="flex justify-end pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsViewResumeModalOpen(false)}
              className="px-4 py-1.5 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* 6. Add Tag Modal */}
      <Modal
        isOpen={isAddTagModalOpen}
        onClose={() => setIsAddTagModalOpen(false)}
        title="Add Tag"
        maxWidthClass="max-w-sm"
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="font-bold block mb-1">Tag Name</label>
            <Input
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              placeholder="e.g. Docker, Redux"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsAddTagModalOpen(false)}
              className="px-3 py-1.5 text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddTag}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-xl font-bold cursor-pointer"
            >
              Add Tag
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default ApplicationDetailPage;
