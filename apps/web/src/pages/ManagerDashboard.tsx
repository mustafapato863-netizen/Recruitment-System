import { useCallback, useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Vacancy, Application, ReportOverview, Interview } from '@recruitflow/contracts';
import { getApi, postApi } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { PageState } from '../components/ui/PageState';
import { QuickGuideTrigger } from '../quickguide';

export interface OpenVacancyOption {
  id: string;
  title: string;
  department: string;
  location: string;
  currentRecruiter: string;
  currentRecruiterId: string;
  targetHires: number;
  openApplications: number;
}

export const DEFAULT_OPEN_VACANCIES: OpenVacancyOption[] = [];

export const RECRUITER_OPTIONS: { id: string; name: string; role: string }[] = [];

function getInitials(name?: string): string {
  if (!name || name === 'Unassigned') return '—';
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

export function ManagerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [, setVacancies] = useState<Vacancy[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [overview, setOverview] = useState<ReportOverview | null>(null);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [recruiterOptions, setRecruiterOptions] = useState<{ id: string; name: string; role: string }[]>([]);
  const [, setIsLoading] = useState(true);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [activityType, setActivityType] = useState('Call');
  const [activityDueDate, setActivityDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [activitySummary, setActivitySummary] = useState('');
  const [isSchedulingActivity, setIsSchedulingActivity] = useState(false);

  // Target Velocity Period Toggle
  const [targetPeriod, setTargetPeriod] = useState<'daily' | 'monthly'>('daily');

  // Manager Vacancy & Target Assignment State
  const [openVacanciesList, setOpenVacanciesList] = useState<OpenVacancyOption[]>([]);
  const [isAssignTaskModalOpen, setIsAssignTaskModalOpen] = useState(false);
  const [selectedVacancyId, setSelectedVacancyId] = useState<string>('');
  const [selectedRecruiterId, setSelectedRecruiterId] = useState<string>('');
  const [assignmentKind, setAssignmentKind] = useState<'PRIMARY' | 'SUPPORT'>('PRIMARY');
  const [targetType, setTargetType] = useState<'Hires' | 'Screenings' | 'Interviews'>('Hires');
  const [targetQuota, setTargetQuota] = useState<number>(3);
  const [targetDeadline, setTargetDeadline] = useState<string>('7 Days (Standard SLA)');
  const [taskPriority, setTaskPriority] = useState<'High' | 'Medium' | 'Low'>('High');
  const [taskInstructions, setTaskInstructions] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const isManagerOrAdmin = useMemo(() => {
    return Boolean(user?.permissions?.includes('VACANCY_MANAGE'));
  }, [user?.permissions]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const openAssignModalForVacancy = (vacId?: string) => {
    if (!isManagerOrAdmin) {
      showToast('Recruiters are not authorized to assign or reassign tasks.');
      return;
    }
    if (vacId) {
      setSelectedVacancyId(vacId);
      const found = openVacanciesList.find((v) => v.id === vacId);
      if (found && found.currentRecruiterId) {
        setSelectedRecruiterId(found.currentRecruiterId);
      }
    }
    setIsAssignTaskModalOpen(true);
  };

  const handleAssignTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isManagerOrAdmin) {
      showToast('Recruiters are not authorized to assign or reassign tasks.');
      return;
    }
    const vacancy = openVacanciesList.find((v) => v.id === selectedVacancyId) || openVacanciesList[0];
    const recruiter = recruiterOptions.find((r) => r.id === selectedRecruiterId) || recruiterOptions[0];

    if (!vacancy || !recruiter) return;

    setIsAssigning(true);
    try {
      const generatedTitle = `${targetType === 'Hires' ? 'Hire Target' : 'Screening Target'}: ${targetQuota} ${targetType} for ${vacancy.title}`;

      await postApi(`/vacancies/${vacancy.id}/assignments`, {
        userId: recruiter.id,
        roleCode: 'RECRUITER',
        assignmentKind,
      });

      await postApi('/tasks', {
        title: generatedTitle,
        type: targetType === 'Hires' ? 'Hiring' : 'Screening',
        priority: taskPriority === 'High' ? 'High' : 'Normal',
        description: `Vacancy: ${vacancy.title} (${vacancy.department} • ${vacancy.location}) | Target: ${targetQuota} ${targetType} by ${targetDeadline} | Notes: ${taskInstructions || 'Meet standard clinical staffing SLA'}`,
        assigneeUserId: recruiter.id,
        entityType: 'Vacancy',
        entityId: vacancy.id,
      });

      // Update current recruiter in local state for the vacancy
      setOpenVacanciesList((prev) =>
        prev.map((item) =>
          item.id === vacancy.id
            ? { ...item, currentRecruiter: recruiter.name, currentRecruiterId: recruiter.id }
            : item
        )
      );

      const isReassign = vacancy.currentRecruiter !== 'Unassigned' && vacancy.currentRecruiter !== recruiter.name;
      showToast(
        isReassign
          ? `✓ Reassigned "${vacancy.title}" to ${recruiter.name} (Target: ${targetQuota} ${targetType})!`
          : `✓ Assigned "${vacancy.title}" to ${recruiter.name} (Target: ${targetQuota} ${targetType})!`
      );
      setIsAssignTaskModalOpen(false);
      setTaskInstructions('');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to assign target task');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleScheduleActivitySubmit = async () => {
    if (!activitySummary.trim() || !user?.id) return;
    setIsSchedulingActivity(true);
    try {
      const dueIso = new Date(activityDueDate).toISOString();
      await postApi('/tasks', {
        assigneeUserId: user.id,
        type: activityType,
        title: activitySummary.trim(),
        priority: 'Normal',
        dueAt: dueIso,
      });
      showToast(`✓ Scheduled ${activityType}: "${activitySummary.trim()}"`);
      setIsActivityModalOpen(false);
      setActivitySummary('');
      void loadData();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to schedule activity');
    } finally {
      setIsSchedulingActivity(false);
    }
  };

  const greetingName = user?.displayName?.trim().split(/\s+/)[0] || 'there';

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [vacanciesRes, applicationsRes, overviewRes, interviewsRes, recruitersRes] = await Promise.allSettled([
        getApi<Vacancy[]>('/vacancies'),
        getApi<{ data: Application[] }>('/applications?pageSize=100'),
        getApi<ReportOverview>(
          '/reports/overview?from=' +
            new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10) +
            '&to=' +
            new Date().toISOString().slice(0, 10),
        ),
        getApi<Interview[]>('/interviews'),
        getApi<{ id: string; displayName?: string; name?: string; roleCode?: string }[]>('/users/interviewers'),
      ]);

      let loadedVacancies: Vacancy[] = [];
      let loadedApplications: Application[] = [];

      if (vacanciesRes.status === 'fulfilled' && Array.isArray(vacanciesRes.value)) {
        loadedVacancies = vacanciesRes.value;
        setVacancies(loadedVacancies);
      }
      if (applicationsRes.status === 'fulfilled' && applicationsRes.value?.data) {
        loadedApplications = applicationsRes.value.data;
        setApplications(loadedApplications);
      }
      if (overviewRes.status === 'fulfilled' && overviewRes.value) {
        setOverview(overviewRes.value);
      }
      if (interviewsRes.status === 'fulfilled' && Array.isArray(interviewsRes.value)) {
        setInterviews(interviewsRes.value);
      }

      if (recruitersRes.status === 'fulfilled' && Array.isArray(recruitersRes.value)) {
        const mappedRecs = recruitersRes.value.map((r) => ({
          id: r.id,
          name: r.displayName || r.name || 'Recruiter',
          role: r.roleCode || 'Recruiter',
        }));
        setRecruiterOptions(mappedRecs);
        if (mappedRecs.length > 0 && !selectedRecruiterId) {
          setSelectedRecruiterId(mappedRecs[0].id);
        }
      } else if (user) {
        const fallback = [{ id: user.id, name: user.displayName || 'Current User', role: 'Recruiter' }];
        setRecruiterOptions(fallback);
        if (!selectedRecruiterId) setSelectedRecruiterId(user.id);
      }

      const mappedVacancies: OpenVacancyOption[] = loadedVacancies.filter((v) => v.status === 'Open').map((v) => {
        const title = v.title || v.position?.title || 'No position';
        const department = (v as unknown as { department?: string }).department || v.branch?.name || 'Operations';
        const location = v.location || v.branch?.name || '—';
        const recruiter = (v.assignments?.[0] as unknown as { user?: { displayName?: string } } | undefined)?.user?.displayName || 'Unassigned';
        const recruiterId = v.assignments?.[0]?.userId || '';
        const targetHires = Math.max(1, (v.approvedHeadcount || 1) - (v.joinedHeadcount || 0));
        const openApps = loadedApplications.filter((a) => a.vacancyId === v.id).length;
        return {
          id: v.id,
          title,
          department,
          location,
          currentRecruiter: recruiter,
          currentRecruiterId: recruiterId,
          targetHires,
          openApplications: openApps,
        };
      });

      setOpenVacanciesList(mappedVacancies);
      if (mappedVacancies.length > 0 && !selectedVacancyId) {
        setSelectedVacancyId(mappedVacancies[0].id);
      }
    } catch {
      // Keep dashboard resilient
    } finally {
      setIsLoading(false);
    }
  }, [user, selectedRecruiterId, selectedVacancyId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Derived counts from real fetched datasets
  const interviewCount = interviews.length;
  const applicationsReviewCount = applications.filter((a) => a.stage === 'Applied' || a.stage === 'Screening').length;
  const offersCount = applications.filter((a) => a.stage === 'Offer').length;
  const tasksDueCount = applications.filter((a) => a.stage === 'Applied').length;

  const pendingPriorities = useMemo(() => {
    return applications
      .filter((a) => ['Applied', 'Screening', 'Interview', 'Offer'].includes(a.stage))
      .slice(0, 5);
  }, [applications]);

  const upcomingInterviews = useMemo(() => {
    return interviews.slice(0, 4);
  }, [interviews]);

  const recentActivities = useMemo(() => {
    return [...applications]
      .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
      .slice(0, 5);
  }, [applications]);

  // Dynamic calculations for the velocity widget
  const screenedCount = useMemo(() => {
    return applications.filter((a) => a.stage !== 'Applied').length;
  }, [applications]);

  const completedInterviewsCount = useMemo(() => {
    return interviews.filter((i) => i.status === 'Completed').length;
  }, [interviews]);

  const extendedOffersCount = useMemo(() => {
    return applications.filter((a) => ['Offer', 'Pre-Hire', 'Joined'].includes(a.stage)).length;
  }, [applications]);

  const joinedCount = useMemo(() => {
    return applications.filter((a) => a.stage === 'Joined').length;
  }, [applications]);

  return (
    <div className="flex w-full flex-col p-4 sm:p-6 lg:p-7 max-w-[1720px] mx-auto space-y-6">
      {/* ── Page Header: Greeting & Quick Buttons ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Good morning, {greetingName}
            </h1>
            <QuickGuideTrigger />
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Here&apos;s what needs your attention today.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/users')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs cursor-pointer"
          >
            <span>My Team</span>
            <Icon name="users" size={14} className="text-slate-500" />
          </button>

          {isManagerOrAdmin && (
            <button
              type="button"
              onClick={() => openAssignModalForVacancy()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Icon name="check-circle" size={14} />
              <span>Assign Vacancy &amp; Target</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsActivityModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0088cc] hover:bg-[#0077b5] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Icon name="plus" size={14} />
            <span>Schedule Activity</span>
          </button>
        </div>
      </div>

      {/* ── Top 4 KPI Metric Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: Interviews */}
        <div
          onClick={() => navigate('/interviews')}
          className="card-glow rounded-2xl p-4 sm:p-5 cursor-pointer flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Icon name="calendar" size={22} />
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">Total Interviews</span>
              <span className="block text-2xl font-black text-slate-900 dark:text-white mt-0.5">{interviewCount}</span>
              <span className="block text-xs font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                {completedInterviewsCount} completed
              </span>
            </div>
          </div>
          <Icon name="chevron-right" size={18} className="text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition" />
        </div>

        {/* Card 2: Applications to Review */}
        <div
          onClick={() => navigate('/applications')}
          className="card-glow rounded-2xl p-4 sm:p-5 cursor-pointer flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Icon name="users" size={22} />
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">Applications to Review</span>
              <span className="block text-2xl font-black text-slate-900 dark:text-white mt-0.5">{applicationsReviewCount}</span>
              <span className="block text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                {applications.length} total active
              </span>
            </div>
          </div>
          <Icon name="chevron-right" size={18} className="text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition" />
        </div>

        {/* Card 3: Offers to Approve */}
        <div
          onClick={() => navigate('/offers')}
          className="card-glow rounded-2xl p-4 sm:p-5 cursor-pointer flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Icon name="offer" size={22} />
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">Offers Pending</span>
              <span className="block text-2xl font-black text-slate-900 dark:text-white mt-0.5">{offersCount}</span>
              <span className="block text-xs font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                {offersCount > 0 ? 'Pending sign-off' : 'None pending'}
              </span>
            </div>
          </div>
          <Icon name="chevron-right" size={18} className="text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition" />
        </div>

        {/* Card 4: Tasks Due */}
        <div
          onClick={() => navigate('/tasks')}
          className="card-glow rounded-2xl p-4 sm:p-5 cursor-pointer flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Icon name="file-text" size={22} />
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">New Submissions</span>
              <span className="block text-2xl font-black text-slate-900 dark:text-white mt-0.5">{tasksDueCount}</span>
              <span className="block text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                Require intake triage
              </span>
            </div>
          </div>
          <Icon name="chevron-right" size={18} className="text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition" />
        </div>
      </div>

      {/* ── Recruiter Target Velocity & Attainment Widget ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-lg">
              🎯
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Recruiter Performance &amp; Target Velocity
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  {targetPeriod === 'daily' ? 'Pipeline Active' : 'Monthly Summary'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Hospital benchmark pacing and recruiter throughput vs clinical staffing SLAs.
              </p>
            </div>
          </div>

          {/* Controls: Toggle Switch & Set Target Button */}
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <button
                type="button"
                onClick={() => setTargetPeriod('daily')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  targetPeriod === 'daily'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>☀️</span>
                <span>Active Targets</span>
              </button>
              <button
                type="button"
                onClick={() => setTargetPeriod('monthly')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  targetPeriod === 'monthly'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>📅</span>
                <span>Monthly Overview</span>
              </button>
            </div>

            {isManagerOrAdmin && (
              <button
                type="button"
                onClick={() => openAssignModalForVacancy()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Icon name="plus" size={13} />
                <span>Set Vacancy Target</span>
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Metric Grid based on targetPeriod */}
        {targetPeriod === 'daily' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
            {/* Metric 1: Screened */}
            <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 h-[105px] flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-500 dark:text-slate-400">Candidates Screened</span>
                <span className="font-extrabold text-slate-900 dark:text-white">
                  {screenedCount} / {Math.max(screenedCount, 1)}
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round((screenedCount / Math.max(screenedCount, 1)) * 100))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">
                  {screenedCount > 0 ? 'Active screening pace' : 'Awaiting candidates'}
                </span>
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {applications.length} in pipeline
                </span>
              </div>
            </div>

            {/* Metric 2: Interviews */}
            <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 h-[105px] flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-500 dark:text-slate-400">Interviews Conducted</span>
                <span className="font-extrabold text-slate-900 dark:text-white">
                  {completedInterviewsCount} / {Math.max(interviewCount, 1)}
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round((completedInterviewsCount / Math.max(interviewCount, 1)) * 100))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">
                  {interviewCount > 0 ? `${interviewCount} scheduled` : 'No interviews'}
                </span>
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  {interviewCount - completedInterviewsCount} pending
                </span>
              </div>
            </div>

            {/* Metric 3: Offers */}
            <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 h-[105px] flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-500 dark:text-slate-400">Offers Prepared</span>
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                  {extendedOffersCount} extended
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: extendedOffersCount > 0 ? '100%' : '0%' }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Offer Stage</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {joinedCount} accepted / joined
                </span>
              </div>
            </div>

            {/* Metric 4: Time to Fill */}
            <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 h-[105px] flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-500 dark:text-slate-400">Time-to-Fill Pace</span>
                <span className="font-extrabold text-slate-900 dark:text-white">
                  {overview?.kpis?.timeToFill ? `${overview.kpis.timeToFill.value}d` : '—'}
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div className="bg-teal-500 h-full rounded-full transition-all duration-500" style={{ width: overview?.kpis?.timeToFill?.value ? `${Math.min(100, Math.round((overview.kpis.timeToFill.value / 30) * 100))}%` : '0%' }} />
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Target: &lt; 30d</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{overview?.kpis?.timeToFill?.value ? (overview.kpis.timeToFill.value <= 30 ? 'On Track' : 'At Risk') : 'No data'}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
            {/* Monthly Metric 1 */}
            <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 h-[105px] flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-500 dark:text-slate-400">Total Joined Headcount</span>
                <span className="font-extrabold text-slate-900 dark:text-white">{joinedCount}</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full rounded-full transition-all duration-500" style={{ width: joinedCount > 0 ? '100%' : '0%' }} />
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Joined hires</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">{joinedCount} confirmed</span>
              </div>
            </div>

            {/* Monthly Metric 2 */}
            <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 h-[105px] flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-500 dark:text-slate-400">Total Applicants</span>
                <span className="font-extrabold text-slate-900 dark:text-white">{applications.length}</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div className="bg-indigo-600 h-full rounded-full transition-all duration-500" style={{ width: applications.length > 0 ? '100%' : '0%' }} />
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Funnel size</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{screenedCount} screened</span>
              </div>
            </div>

            {/* Monthly Metric 3 */}
            <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 h-[105px] flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-500 dark:text-slate-400">Offer Acceptance Rate</span>
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                  {overview?.kpis?.offerAcceptanceRate ? `${overview.kpis.offerAcceptanceRate.value.toFixed(1)}%` : '—'}
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: overview?.kpis?.offerAcceptanceRate ? `${Math.min(100, overview.kpis.offerAcceptanceRate.value)}%` : '0%' }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Threshold: &gt;= 80%</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Active Benchmark</span>
              </div>
            </div>

            {/* Monthly Metric 4 */}
            <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 h-[105px] flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-500 dark:text-slate-400">Avg Time-to-Offer</span>
                <span className="font-extrabold text-purple-600 dark:text-purple-400">
                  {overview?.kpis?.timeToOffer ? `${overview.kpis.timeToOffer.value}d` : '—'}
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div className="bg-purple-600 h-full rounded-full transition-all duration-500" style={{ width: '75%' }} />
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Target SLA</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Standard Pacing</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Middle Row: 2 Big Columns (My Priorities & Open Jobs) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: My Priorities (6 cols) */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs min-h-[460px] flex flex-col space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
              My Priorities
            </h2>
            <Link to="/tasks" className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">
              View all
            </Link>
          </div>

          {pendingPriorities.length === 0 ? (
            <PageState
              kind="empty"
              title="No pending priorities"
              description="All candidate reviews and stage actions are up to date."
            />
          ) : (
            <div className="space-y-3">
              {pendingPriorities.map((app) => {
                const candidateName = app.candidate ? `${app.candidate.firstName} ${app.candidate.lastName}`.trim() : ((app as unknown as { candidateName?: string }).candidateName || 'Unknown candidate');
                const posTitle = app.positionTitle || 'No position';
                const stageLabel =
                  app.stage === 'Applied'
                    ? 'Review Application'
                    : app.stage === 'Screening'
                    ? 'Screening Review'
                    : app.stage === 'Interview'
                    ? 'Interview Pending'
                    : 'Offer Review';
                return (
                  <div
                    key={app.id}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shrink-0 font-bold text-xs">
                        {getInitials(candidateName)}
                      </div>
                      <div className="min-w-0">
                        <span className="block text-xs font-bold text-slate-900 dark:text-white truncate">
                          {stageLabel} &mdash; {posTitle}
                        </span>
                        <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          {candidateName} &bull; Stage: {app.stage}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
                        {app.stage}
                      </span>
                      <button
                        type="button"
                        onClick={() => navigate(`/applications/${app.id}`)}
                        className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                      >
                        Action
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Open Jobs (You Own) (6 cols) */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs min-h-[460px] flex flex-col space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
              Open Jobs
            </h2>
            <Link to="/vacancies" className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">
              View all jobs
            </Link>
          </div>

          {openVacanciesList.length === 0 ? (
            <PageState
              kind="empty"
              title="No open jobs"
              description="No active job positions found in your organization."
              actionLabel="Create Vacancy"
              onAction={() => navigate('/vacancy-requests/create')}
            />
          ) : (
            <div className="space-y-3">
              {openVacanciesList.slice(0, 5).map((job) => (
                <div
                  key={job.id}
                  onClick={() => navigate(`/vacancies/${job.id}`)}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition gap-3 cursor-pointer group border border-slate-100 dark:border-slate-800/60"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 transition">
                        {job.title}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold border ${
                          job.currentRecruiter === 'Unassigned'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {job.currentRecruiter === 'Unassigned' ? '⚠️ Unassigned' : `👤 ${job.currentRecruiter}`}
                      </span>
                    </div>
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {job.department} &bull; {job.openApplications} applications &bull; Target: {job.targetHires} hires
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isManagerOrAdmin && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openAssignModalForVacancy(job.id);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold text-[11px] flex items-center gap-1 transition cursor-pointer shadow-2xs"
                        title={`Assign or reassign ${job.title} and set targets`}
                      >
                        <span>🎯</span>
                        <span>{job.currentRecruiter === 'Unassigned' ? 'Assign & Target' : 'Reassign'}</span>
                      </button>
                    )}
                    <Icon name="chevron-right" size={16} className="text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Row: 3 Columns (Upcoming Interviews, Recent Activity, Quick Actions) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Upcoming Interviews */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs min-h-[380px] flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                Upcoming Interviews
              </h2>
              <Link to="/interviews" className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">
                View calendar
              </Link>
            </div>

            {upcomingInterviews.length === 0 ? (
              <PageState
                kind="empty"
                title="No upcoming interviews"
                description="No interviews currently scheduled."
              />
            ) : (
              <div className="space-y-3">
                {upcomingInterviews.map((intItem) => {
                  const candidateName = intItem.candidateName || 'Unknown candidate';
                  const posTitle = intItem.positionTitle || 'No position';
                  const startTime = intItem.scheduledStart
                    ? new Date(intItem.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'Scheduled';
                  return (
                    <div
                      key={intItem.id}
                      onClick={() => navigate(`/interviews/${intItem.id}`)}
                      className="flex items-center justify-between gap-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 p-2 rounded-xl transition"
                    >
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 w-16 shrink-0">
                        {startTime}
                      </span>
                      <div className="w-7 h-7 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold flex items-center justify-center shrink-0">
                        {getInitials(candidateName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block text-xs font-bold text-slate-900 dark:text-white truncate">
                          {candidateName}
                        </span>
                        <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {posTitle}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
                          {intItem.locationUrl ? 'Online' : intItem.interviewType || 'Interview'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
            <Link to="/interviews" className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">
              See full schedule
            </Link>
          </div>
        </div>

        {/* Column 2: Recent Activity */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs min-h-[380px] flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
              Recent Activity
            </h2>
            <Link to="/audit-log" className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">
              View all
            </Link>
          </div>

          {recentActivities.length === 0 ? (
            <PageState
              kind="empty"
              title="No recent activity"
              description="Application status changes and notes will appear here."
            />
          ) : (
            <div className="space-y-3">
              {recentActivities.map((app) => {
                const candidateName = app.candidate ? `${app.candidate.firstName} ${app.candidate.lastName}`.trim() : ((app as unknown as { candidateName?: string }).candidateName || 'Unknown candidate');
                const posTitle = app.positionTitle || 'No position';
                const updatedTime = app.updatedAt
                  ? new Date(app.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })
                  : 'Recent';
                return (
                  <div
                    key={app.id}
                    onClick={() => navigate(`/applications/${app.id}`)}
                    className="flex items-start gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 p-2 rounded-xl transition"
                  >
                    <div className="w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon name="users" size={13} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-slate-900 dark:text-white">
                        {candidateName} <span className="font-normal text-slate-500 dark:text-slate-400">in {app.stage}</span>
                      </span>
                      <span className="block text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                        {posTitle}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">{updatedTime}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Column 3: Quick Actions */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs min-h-[380px] flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
              Quick Actions
            </h2>
          </div>

          <div className="space-y-2.5">
            {/* Quick Action 1 */}
            <div
              onClick={() => navigate('/applications')}
              className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition gap-3 cursor-pointer group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shrink-0">
                  <Icon name="users" size={16} />
                </div>
                <div className="min-w-0">
                  <span className="block text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition truncate">
                    Review Applications
                  </span>
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {applicationsReviewCount} waiting for review
                  </span>
                </div>
              </div>
              <Icon name="chevron-right" size={16} className="text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition" />
            </div>

            {/* Quick Action 2 */}
            <div
              onClick={() => navigate('/interviews')}
              className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition gap-3 cursor-pointer group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
                  <Icon name="calendar" size={16} />
                </div>
                <div className="min-w-0">
                  <span className="block text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 transition truncate">
                    Schedule Interview
                  </span>
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    Plan interviews and panels
                  </span>
                </div>
              </div>
              <Icon name="chevron-right" size={16} className="text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition" />
            </div>

            {/* Quick Action 3 */}
            <div
              onClick={() => navigate('/vacancy-requests/create')}
              className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition gap-3 cursor-pointer group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center shrink-0">
                  <Icon name="briefcase" size={16} />
                </div>
                <div className="min-w-0">
                  <span className="block text-xs font-bold text-slate-900 dark:text-white group-hover:text-purple-600 transition truncate">
                    Create Job Position
                  </span>
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    Post a new job
                  </span>
                </div>
              </div>
              <Icon name="chevron-right" size={16} className="text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition" />
            </div>

            {/* Quick Action 4 */}
            <div
              onClick={() => navigate('/offers/create')}
              className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition gap-3 cursor-pointer group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0">
                  <Icon name="offer" size={16} />
                </div>
                <div className="min-w-0">
                  <span className="block text-xs font-bold text-slate-900 dark:text-white group-hover:text-amber-600 transition truncate">
                    Generate Offer
                  </span>
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    Create offer letter
                  </span>
                </div>
              </div>
              <Icon name="chevron-right" size={16} className="text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition" />
            </div>

            {/* Quick Action 5 */}
            <div
              onClick={() => navigate('/reports')}
              className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition gap-3 cursor-pointer group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shrink-0">
                  <Icon name="report" size={16} />
                </div>
                <div className="min-w-0">
                  <span className="block text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition truncate">
                    View Reports
                  </span>
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    Track hiring performance
                  </span>
                </div>
              </div>
              <Icon name="chevron-right" size={16} className="text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer System Reference ── */}
      <div className="pt-4 text-center sm:text-right">
        <span className="text-[11px] font-medium text-slate-400 dark:text-slate-600">
          SGH Design System &bull; Clinical Recruitment Management
        </span>
      </div>

      {/* ── Schedule Activity Modal ── */}
      <Modal
        isOpen={isActivityModalOpen}
        onClose={() => setIsActivityModalOpen(false)}
        title="Schedule Activity"
        maxWidthClass="max-w-md"
      >
        <div className="space-y-3.5">
          <div>
            <label className="text-xs font-bold text-slate-900 dark:text-white block mb-1">Activity Type</label>
            <Select value={activityType} onChange={(e) => setActivityType(e.target.value)}>
              <option value="Call">📞 Phone Call</option>
              <option value="Meeting">📅 Interview / Panel Meeting</option>
              <option value="Review">📄 Application Review</option>
              <option value="Offer">💼 Offer Follow-up</option>
            </Select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-900 dark:text-white block mb-1">Due Date</label>
            <Input
              type="date"
              value={activityDueDate}
              onChange={(e) => setActivityDueDate(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-900 dark:text-white block mb-1">Summary / Objective</label>
            <Input
              placeholder="e.g., Follow up on technical assessment scores"
              value={activitySummary}
              onChange={(e) => setActivitySummary(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <Button variant="ghost" size="sm" onClick={() => setIsActivityModalOpen(false)} disabled={isSchedulingActivity}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleScheduleActivitySubmit()}
              disabled={!activitySummary.trim() || isSchedulingActivity}
            >
              {isSchedulingActivity ? 'Scheduling...' : 'Schedule'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Assign Open Vacancy & Target Modal */}
      <Modal
        isOpen={isAssignTaskModalOpen && isManagerOrAdmin}
        onClose={() => setIsAssignTaskModalOpen(false)}
        title="Assign Open Vacancy & Target to Recruiter"
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleAssignTaskSubmit} className="space-y-4 text-xs">
          <p className="text-slate-500 dark:text-slate-400">
            Select an open vacancy position, delegate to a recruiter, and establish hiring &amp; screening targets with SLAs.
          </p>

          {openVacanciesList.length === 0 ? (
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-center text-slate-500">
              No active vacancies found. Create a vacancy first.
            </div>
          ) : (
            <>
              {/* Vacancy Selector */}
              <div>
                <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300">
                  Select Open Vacancy Position
                </label>
                <select
                  value={selectedVacancyId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedVacancyId(id);
                    const vac = openVacanciesList.find((v) => v.id === id);
                    if (vac && vac.currentRecruiterId) {
                      setSelectedRecruiterId(vac.currentRecruiterId);
                    }
                  }}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-semibold cursor-pointer"
                >
                  {openVacanciesList.map((vac) => (
                    <option key={vac.id} value={vac.id}>
                      {vac.title} — {vac.department} ({vac.location}) [Current: {vac.currentRecruiter}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Vacancy Details Card */}
              {(() => {
                const currentVac = openVacanciesList.find((v) => v.id === selectedVacancyId) || openVacanciesList[0];
                const selectedRecruiter = recruiterOptions.find((r) => r.id === selectedRecruiterId) || recruiterOptions[0];
                const isReassignment =
                  currentVac &&
                  selectedRecruiter &&
                  currentVac.currentRecruiter !== 'Unassigned' &&
                  currentVac.currentRecruiter !== selectedRecruiter.name;

                if (!currentVac) return null;

                return (
                  <div className="space-y-3.5">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-500 uppercase tracking-wider">Position Status</span>
                        <span className="px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          OPEN REQUISITION
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Department &amp; Location:</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {currentVac.department} &bull; {currentVac.location}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Active Candidates in Funnel:</span>
                        <span className="font-bold text-blue-600 dark:text-blue-400">
                          {currentVac.openApplications} candidates
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                        <span className="text-slate-500">Current Assigned Recruiter:</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {currentVac.currentRecruiter === 'Unassigned' ? (
                            <span className="text-amber-600 font-semibold">⚠️ Unassigned</span>
                          ) : (
                            `👤 ${currentVac.currentRecruiter}`
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Reassignment Status Notice */}
                    {isReassignment && selectedRecruiter ? (
                      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
                        <span className="text-base">🔄</span>
                        <div>
                          <span className="font-bold block">Reassigning Position</span>
                          <span className="text-[11px] block mt-0.5">
                            Responsibility for <b>{currentVac.title}</b> will transfer from{' '}
                            <b>{currentVac.currentRecruiter}</b> to <b>{selectedRecruiter.name}</b>.
                          </span>
                        </div>
                      </div>
                    ) : null}

                    {/* Recruiter Selector */}
                    {recruiterOptions.length > 0 && (
                      <div>
                        <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300">
                          {isReassignment ? 'Reassign To Recruiter' : 'Assign To Recruiter'}
                        </label>
                        <select
                          value={selectedRecruiterId}
                          onChange={(e) => setSelectedRecruiterId(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-semibold cursor-pointer"
                        >
                          {recruiterOptions.map((rec) => (
                            <option key={rec.id} value={rec.id}>
                              {rec.name} — {rec.role}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {recruiterOptions.length > 0 && (
                      <div>
                        <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300">Assignment responsibility</label>
                        <select value={assignmentKind} onChange={(e) => setAssignmentKind(e.target.value as 'PRIMARY' | 'SUPPORT')} className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-semibold cursor-pointer">
                          <option value="PRIMARY">Primary recruiter</option>
                          <option value="SUPPORT">Supporting recruiter</option>
                        </select>
                      </div>
                    )}

                    {/* Target Configuration Section */}
                    <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-blue-900 dark:text-blue-300 text-xs flex items-center gap-1.5">
                          <span>🎯</span> Recruiter Target &amp; SLA Quota
                        </span>
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                          Velocity Benchmark
                        </span>
                      </div>

                      {/* Target Type Selector */}
                      <div>
                        <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300 text-[11px]">
                          Target Objective Type
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {(['Hires', 'Screenings', 'Interviews'] as const).map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setTargetType(t)}
                              className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition cursor-pointer border ${
                                targetType === t
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {t === 'Hires' ? '🎯 Hires Target' : t === 'Screenings' ? '📄 CV Screenings' : '📅 Interviews'}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300 text-[11px]">
                            Target Quota (Quantity)
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={50}
                            value={targetQuota}
                            onChange={(e) => setTargetQuota(parseInt(e.target.value, 10) || 1)}
                            className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold"
                          />
                        </div>

                        <div>
                          <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300 text-[11px]">
                            Target SLA Timeline
                          </label>
                          <select
                            value={targetDeadline}
                            onChange={(e) => setTargetDeadline(e.target.value)}
                            className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-semibold cursor-pointer"
                          >
                            <option value="3 Days (Urgent SLA)">3 Days (Urgent SLA)</option>
                            <option value="7 Days (Standard SLA)">7 Days (Standard SLA)</option>
                            <option value="14 Days (2 Weeks)">14 Days (2 Weeks)</option>
                            <option value="30 Days (End of Month)">30 Days (End of Month)</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300 text-[11px]">Priority</label>
                          <select
                            value={taskPriority}
                            onChange={(e) => setTaskPriority(e.target.value as 'High' | 'Medium' | 'Low')}
                            className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white cursor-pointer"
                          >
                            <option value="High">High (Critical Priority)</option>
                            <option value="Medium">Medium (Normal SLA)</option>
                            <option value="Low">Low</option>
                          </select>
                        </div>

                        <div>
                          <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300 text-[11px]">Pacing Output</label>
                          <div className="p-2 bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            {targetQuota} {targetType.toLowerCase()} / {targetDeadline.split('(')[0]}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Instructions */}
                    <div>
                      <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300">
                        Manager Sourcing Instructions &amp; Clinical Criteria
                      </label>
                      <textarea
                        rows={2}
                        value={taskInstructions}
                        onChange={(e) => setTaskInstructions(e.target.value)}
                        placeholder="e.g. Prioritize candidates with active license and relevant clinical experience."
                        className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                );
              })()}
            </>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsAssignTaskModalOpen(false)}
              className="px-3 py-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isAssigning || openVacanciesList.length === 0}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isAssigning ? 'Assigning...' : 'Assign Vacancy & Target'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Toast Feedback */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2 border border-slate-700 animate-fade-in">
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}

export default ManagerDashboard;
