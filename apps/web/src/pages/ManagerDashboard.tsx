import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Vacancy, Application, ReportOverview } from '@recruitflow/contracts';
import { getApi, postApi } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';

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

export const DEFAULT_OPEN_VACANCIES: OpenVacancyOption[] = [
  {
    id: 'vac-1',
    title: 'Senior Frontend Engineer',
    department: 'Engineering',
    location: 'Cairo, Egypt',
    currentRecruiter: 'Sarah Ahmed',
    currentRecruiterId: '231c4106-9094-478d-8c20-0ff0bc9ee592',
    targetHires: 2,
    openApplications: 48,
  },
  {
    id: 'vac-2',
    title: 'Registered Nurse – ICU',
    department: 'Clinical Operations',
    location: 'Jeddah, KSA',
    currentRecruiter: 'Mona Saleh',
    currentRecruiterId: 'rec-mona-saleh',
    targetHires: 5,
    openApplications: 43,
  },
  {
    id: 'vac-3',
    title: 'Product Manager',
    department: 'Digital Health',
    location: 'Riyadh, KSA',
    currentRecruiter: 'Omar Farouk',
    currentRecruiterId: 'rec-omar-farouk',
    targetHires: 1,
    openApplications: 23,
  },
  {
    id: 'vac-4',
    title: 'Cardiology Consultant',
    department: 'Specialized Care',
    location: 'Riyadh, KSA',
    currentRecruiter: 'Unassigned',
    currentRecruiterId: '',
    targetHires: 1,
    openApplications: 12,
  },
  {
    id: 'vac-5',
    title: 'Pediatric Intensive Care Specialist',
    department: 'Pediatrics',
    location: 'Dammam, KSA',
    currentRecruiter: 'Unassigned',
    currentRecruiterId: '',
    targetHires: 2,
    openApplications: 16,
  },
  {
    id: 'vac-6',
    title: 'Backend Engineer',
    department: 'Engineering',
    location: 'Cairo, Egypt',
    currentRecruiter: 'Sarah Ahmed',
    currentRecruiterId: '231c4106-9094-478d-8c20-0ff0bc9ee592',
    targetHires: 3,
    openApplications: 36,
  },
  {
    id: 'vac-7',
    title: 'Product Designer',
    department: 'Design',
    location: 'Riyadh, KSA',
    currentRecruiter: 'Omar Farouk',
    currentRecruiterId: 'rec-omar-farouk',
    targetHires: 1,
    openApplications: 29,
  },
];

export const RECRUITER_OPTIONS = [
  { id: '231c4106-9094-478d-8c20-0ff0bc9ee592', name: 'Sarah Ahmed', role: 'Senior Clinical Recruiter' },
  { id: 'rec-ahmed-mostafa', name: 'Ahmed Mostafa', role: 'Recruitment Lead' },
  { id: 'rec-mona-saleh', name: 'Mona Saleh', role: 'Senior Healthcare Recruiter' },
  { id: 'rec-omar-farouk', name: 'Omar Farouk', role: 'Technical & Informatics Recruiter' },
  { id: 'rec-fatima-harbi', name: 'Fatima Al-Harbi', role: 'Talent Sourcing Specialist' },
];

export function ManagerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [, setOverview] = useState<ReportOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [activityType, setActivityType] = useState('Call');
  const [activityDueDate, setActivityDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [activitySummary, setActivitySummary] = useState('');

  // Target Velocity Period Toggle
  const [targetPeriod, setTargetPeriod] = useState<'daily' | 'monthly'>('daily');

  // Manager Vacancy & Target Assignment State
  const [openVacanciesList, setOpenVacanciesList] = useState<OpenVacancyOption[]>(DEFAULT_OPEN_VACANCIES);
  const [isAssignTaskModalOpen, setIsAssignTaskModalOpen] = useState(false);
  const [selectedVacancyId, setSelectedVacancyId] = useState<string>('vac-1');
  const [selectedRecruiterId, setSelectedRecruiterId] = useState<string>('231c4106-9094-478d-8c20-0ff0bc9ee592');
  const [targetType, setTargetType] = useState<'Hires' | 'Screenings' | 'Interviews'>('Hires');
  const [targetQuota, setTargetQuota] = useState<number>(3);
  const [targetDeadline, setTargetDeadline] = useState<string>('7 Days (Standard SLA)');
  const [taskPriority, setTaskPriority] = useState<'High' | 'Medium' | 'Low'>('High');
  const [taskInstructions, setTaskInstructions] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const openAssignModalForVacancy = (vacId?: string) => {
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
    const vacancy = openVacanciesList.find((v) => v.id === selectedVacancyId) || openVacanciesList[0];
    const recruiter = RECRUITER_OPTIONS.find((r) => r.id === selectedRecruiterId) || RECRUITER_OPTIONS[0];

    setIsAssigning(true);
    try {
      const generatedTitle = `${targetType === 'Hires' ? 'Hire Target' : 'Screening Target'}: ${targetQuota} ${targetType} for ${vacancy.title}`;
      
      await postApi('/tasks', {
        title: generatedTitle,
        type: targetType === 'Hires' ? 'Hiring' : 'Screening',
        priority: taskPriority === 'High' ? 'High' : 'Normal',
        description: `Vacancy: ${vacancy.title} (${vacancy.department} • ${vacancy.location}) | Target: ${targetQuota} ${targetType} by ${targetDeadline} | Notes: ${taskInstructions || 'Meet standard clinical staffing SLA'}`,
        assigneeUserId: recruiter.id,
      }).catch(() => {});

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
    } finally {
      setIsAssigning(false);
    }
  };

  const greetingName = user?.displayName?.trim().split(/\s+/)[0] || 'Sarah';
  void vacancies;
  void isLoading;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [vacanciesRes, applicationsRes, overviewRes] = await Promise.allSettled([
        getApi<Vacancy[]>('/vacancies'),
        getApi<{ data: Application[] }>('/applications?pageSize=100'),
        getApi<ReportOverview>(
          '/reports/overview?from=' +
            new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10) +
            '&to=' +
            new Date().toISOString().slice(0, 10),
        ),
      ]);

      if (vacanciesRes.status === 'fulfilled' && vacanciesRes.value) {
        setVacancies(vacanciesRes.value);
      }
      if (applicationsRes.status === 'fulfilled' && applicationsRes.value?.data) {
        setApplications(applicationsRes.value.data);
      }
      if (overviewRes.status === 'fulfilled' && overviewRes.value) {
        setOverview(overviewRes.value);
      }
    } catch {
      // Keep dashboard resilient
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Derived counts or design defaults
  const interviewCount = 8;
  const applicationsReviewCount = applications.length > 0 ? applications.length : 23;
  const offersCount = 3;
  const tasksDueCount = 7;

  return (
    <div className="flex w-full flex-col p-4 sm:p-6 lg:p-7 max-w-[1720px] mx-auto space-y-6">
      {/* ── Page Header: Greeting & Quick Buttons ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Good morning, {greetingName}
          </h1>
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

          <button
            type="button"
            onClick={() => openAssignModalForVacancy()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Icon name="check-circle" size={14} />
            <span>Assign Vacancy &amp; Target</span>
          </button>

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
        {/* Card 1: Interviews Today */}
        <div
          onClick={() => navigate('/interviews')}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs hover:shadow-md transition cursor-pointer flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Icon name="calendar" size={22} />
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">Interviews Today</span>
              <span className="block text-2xl font-black text-slate-900 dark:text-white mt-0.5">{interviewCount}</span>
              <span className="block text-xs font-bold text-blue-600 dark:text-blue-400 mt-0.5">2 completed</span>
            </div>
          </div>
          <Icon name="chevron-right" size={18} className="text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition" />
        </div>

        {/* Card 2: Applications to Review */}
        <div
          onClick={() => navigate('/applications')}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs hover:shadow-md transition cursor-pointer flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Icon name="users" size={22} />
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">Applications to Review</span>
              <span className="block text-2xl font-black text-slate-900 dark:text-white mt-0.5">{applicationsReviewCount}</span>
              <span className="block text-xs font-bold text-rose-600 dark:text-rose-400 mt-0.5">5 overdue</span>
            </div>
          </div>
          <Icon name="chevron-right" size={18} className="text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition" />
        </div>

        {/* Card 3: Offers to Approve */}
        <div
          onClick={() => navigate('/offers')}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs hover:shadow-md transition cursor-pointer flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Icon name="offer" size={22} />
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">Offers to Approve</span>
              <span className="block text-2xl font-black text-slate-900 dark:text-white mt-0.5">{offersCount}</span>
              <span className="block text-xs font-bold text-amber-600 dark:text-amber-400 mt-0.5">1 waiting on HR</span>
            </div>
          </div>
          <Icon name="chevron-right" size={18} className="text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition" />
        </div>

        {/* Card 4: Tasks Due */}
        <div
          onClick={() => navigate('/tasks')}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs hover:shadow-md transition cursor-pointer flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Icon name="file-text" size={22} />
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">Tasks Due</span>
              <span className="block text-2xl font-black text-slate-900 dark:text-white mt-0.5">{tasksDueCount}</span>
              <span className="block text-xs font-bold text-rose-600 dark:text-rose-400 mt-0.5">2 overdue</span>
            </div>
          </div>
          <Icon name="chevron-right" size={18} className="text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition" />
        </div>
      </div>

      {/* ── Recruiter Target Velocity & Attainment Widget (Daily vs Monthly Switch) ── */}
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
                  {targetPeriod === 'daily' ? 'Live Today' : 'MTD August 2026'}
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
                <span>Daily Target</span>
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
                <span>Monthly Target</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => openAssignModalForVacancy()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Icon name="plus" size={13} />
              <span>Set Vacancy Target</span>
            </button>
          </div>
        </div>

        {/* Dynamic Metric Grid based on targetPeriod */}
        {targetPeriod === 'daily' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
            {/* Metric 1 */}
            <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-500 dark:text-slate-400">CVs Screened Today</span>
                <span className="font-extrabold text-slate-900 dark:text-white">8 / 10</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full rounded-full transition-all duration-500" style={{ width: '80%' }} />
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">80% Achieved</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">2 remaining</span>
              </div>
            </div>

            {/* Metric 2 */}
            <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-500 dark:text-slate-400">Interviews Held</span>
                <span className="font-extrabold text-slate-900 dark:text-white">4 / 5</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div className="bg-indigo-600 h-full rounded-full transition-all duration-500" style={{ width: '80%' }} />
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">80% Achieved</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">1 remaining today</span>
              </div>
            </div>

            {/* Metric 3 */}
            <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-500 dark:text-slate-400">Offers Extended</span>
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400">2 / 2 🎯</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: '100%' }} />
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">100% Target Met</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Goal Complete</span>
              </div>
            </div>

            {/* Metric 4 */}
            <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-500 dark:text-slate-400">SLA Response Speed</span>
                <span className="font-extrabold text-slate-900 dark:text-white">3.8h</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div className="bg-teal-500 h-full rounded-full transition-all duration-500" style={{ width: '92%' }} />
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">SLA Goal: &lt; 6.0h</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">92% Compliance</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
            {/* Monthly Metric 1 */}
            <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-500 dark:text-slate-400">Monthly Clinical Hires</span>
                <span className="font-extrabold text-slate-900 dark:text-white">14 / 18</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full rounded-full transition-all duration-500" style={{ width: '78%' }} />
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">78% of Monthly Plan</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">4 hires needed</span>
              </div>
            </div>

            {/* Monthly Metric 2 */}
            <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-500 dark:text-slate-400">Total Sourced &amp; Screened</span>
                <span className="font-extrabold text-slate-900 dark:text-white">142 / 160</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div className="bg-indigo-600 h-full rounded-full transition-all duration-500" style={{ width: '89%' }} />
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">89% Pipeline Velocity</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Ahead of Target</span>
              </div>
            </div>

            {/* Monthly Metric 3 */}
            <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-500 dark:text-slate-400">Offer Acceptance Rate</span>
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400">88.5%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: '88.5%' }} />
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Threshold: &gt;= 85%</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">+3.5% Above Goal</span>
              </div>
            </div>

            {/* Monthly Metric 4 */}
            <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-500 dark:text-slate-400">Avg Time-to-Hire</span>
                <span className="font-extrabold text-purple-600 dark:text-purple-400">19 Days</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div className="bg-purple-600 h-full rounded-full transition-all duration-500" style={{ width: '79%' }} />
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">SLA Max: 24 Days</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">5 days faster</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Middle Row: 2 Big Columns (My Priorities & Open Jobs) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: My Priorities (7 cols) */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
              My Priorities
            </h2>
            <Link to="/tasks" className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">
              View all
            </Link>
          </div>

          <div className="space-y-3">
            {/* Priority 1 */}
            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 flex items-center justify-center shrink-0 font-bold text-sm">
                  !
                </div>
                <div className="min-w-0">
                  <span className="block text-xs font-bold text-slate-900 dark:text-white truncate">
                    Review applications - Product Designer
                  </span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    John Smith &bull; Applied 2 days ago
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                  Overdue
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/applications')}
                  className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition cursor-pointer"
                >
                  Review
                </button>
              </div>
            </div>

            {/* Priority 2 */}
            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shrink-0">
                  <Icon name="calendar" size={14} />
                </div>
                <div className="min-w-0">
                  <span className="block text-xs font-bold text-slate-900 dark:text-white truncate">
                    Technical interview - Senior Frontend Engineer
                  </span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    Ali Hassan &bull; Today, 10:00 AM
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
                  Today
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/interviews')}
                  className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition cursor-pointer"
                >
                  Join
                </button>
              </div>
            </div>

            {/* Priority 3 */}
            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0">
                  <Icon name="offer" size={14} />
                </div>
                <div className="min-w-0">
                  <span className="block text-xs font-bold text-slate-900 dark:text-white truncate">
                    Offer approval - Backend Engineer
                  </span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    Taylor Lee &bull; Approval pending
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900">
                  Due today
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/offers')}
                  className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition cursor-pointer"
                >
                  Approve
                </button>
              </div>
            </div>

            {/* Priority 4 */}
            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
                  <Icon name="mail" size={14} />
                </div>
                <div className="min-w-0">
                  <span className="block text-xs font-bold text-slate-900 dark:text-white truncate">
                    Follow up - Marketing Specialist
                  </span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    Applicant waiting for update &bull; 5 days in stage
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  Due in 2 days
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/applications')}
                  className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition cursor-pointer"
                >
                  Message
                </button>
              </div>
            </div>

            {/* Priority 5 */}
            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shrink-0">
                  <Icon name="check" size={14} />
                </div>
                <div className="min-w-0">
                  <span className="block text-xs font-bold text-slate-900 dark:text-white truncate">
                    Collect panel feedback - ICU Nurse
                  </span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    2 of 3 scorecards received
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
                  SLA 4h
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/interviews')}
                  className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition cursor-pointer"
                >
                  Open
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Open Jobs (You Own) (6 cols) */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
              Open Jobs (You Own)
            </h2>
            <Link to="/vacancies" className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">
              View all jobs
            </Link>
          </div>

          <div className="space-y-3">
            {openVacanciesList.slice(0, 5).map((job) => (
              <div
                key={job.id}
                onClick={() => navigate('/vacancies')}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition gap-3 cursor-pointer group border border-slate-100 dark:border-slate-800/60"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 transition">
                      {job.title}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold border ${
                      job.currentRecruiter === 'Unassigned'
                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}>
                      {job.currentRecruiter === 'Unassigned' ? '⚠️ Unassigned' : `👤 ${job.currentRecruiter}`}
                    </span>
                  </div>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    {job.department} &bull; {job.openApplications} applications &bull; Target: {job.targetHires} hires
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
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
                  <Icon name="chevron-right" size={16} className="text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom Row: 3 Columns (Upcoming Interviews, Recent Activity, Quick Actions) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Upcoming Interviews */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                Upcoming Interviews
              </h2>
              <Link to="/interviews" className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">
                View calendar
              </Link>
            </div>

            <div className="space-y-3">
              {/* Interview 1 */}
              <div className="flex items-center justify-between gap-2.5">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 w-16 shrink-0">10:00 AM</span>
                <div className="w-7 h-7 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold flex items-center justify-center shrink-0">
                  AH
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-slate-900 dark:text-white truncate">Ali Hassan</span>
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">Senior Frontend Engineer &bull; First Interview</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
                    Teams
                  </span>
                  <div className="w-5 h-5 rounded-full bg-teal-600 text-white text-[9px] font-bold flex items-center justify-center" title="You">
                    SA
                  </div>
                </div>
              </div>

              {/* Interview 2 */}
              <div className="flex items-center justify-between gap-2.5">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 w-16 shrink-0">12:30 PM</span>
                <div className="w-7 h-7 rounded-full bg-teal-600 text-white text-[10px] font-extrabold flex items-center justify-center shrink-0">
                  MK
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-slate-900 dark:text-white truncate">Mona Khaled</span>
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">Product Designer &bull; Qualification</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-900">
                    Phone
                  </span>
                  <div className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[9px] font-bold flex items-center justify-center" title="Omar Farouk">
                    OF
                  </div>
                </div>
              </div>

              {/* Interview 3 */}
              <div className="flex items-center justify-between gap-2.5">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 w-16 shrink-0">3:00 PM</span>
                <div className="w-7 h-7 rounded-full bg-green-600 text-white text-[10px] font-extrabold flex items-center justify-center shrink-0">
                  KM
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-slate-900 dark:text-white truncate">Khaled Mostafa</span>
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">Backend Engineer &bull; Second Interview</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900">
                    On-site
                  </span>
                  <div className="w-5 h-5 rounded-full bg-teal-600 text-white text-[9px] font-bold flex items-center justify-center" title="Lina Hassan">
                    LH
                  </div>
                </div>
              </div>

              {/* Interview 4 */}
              <div className="flex items-center justify-between gap-2.5">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 w-16 shrink-0">4:30 PM</span>
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-[10px] font-extrabold flex items-center justify-center shrink-0">
                  NS
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-slate-900 dark:text-white truncate">Nourhan Sami</span>
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">ICU Nurse &bull; First Interview</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
                    Teams
                  </span>
                  <div className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[9px] font-bold flex items-center justify-center" title="Sara Mohamed">
                    SM
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
            <Link to="/interviews" className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">
              See full schedule
            </Link>
          </div>
        </div>

        {/* Column 2: Recent Activity */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
              Recent Activity
            </h2>
            <Link to="/audit-log" className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">
              View all
            </Link>
          </div>

          <div className="space-y-3">
            {/* Activity 1 */}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                <Icon name="users" size={13} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-slate-900 dark:text-white">
                  Ali Hassan <span className="font-normal text-slate-500 dark:text-slate-400">moved to First Interview</span>
                </span>
                <span className="block text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Senior Frontend Engineer</span>
              </div>
              <span className="text-[10px] text-slate-400 shrink-0">Today, 9:12 AM</span>
            </div>

            {/* Activity 2 */}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                <Icon name="calendar" size={13} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-slate-900 dark:text-white">
                  Interview scheduled with Mona Khaled
                </span>
                <span className="block text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Product Designer &bull; Today, 12:30 PM</span>
              </div>
              <span className="text-[10px] text-slate-400 shrink-0">Today, 9:01 AM</span>
            </div>

            {/* Activity 3 */}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                <Icon name="chat" size={13} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-slate-900 dark:text-white">
                  Interview feedback submitted
                </span>
                <span className="block text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Khaled Mostafa &bull; Backend Engineer</span>
              </div>
              <span className="text-[10px] text-slate-400 shrink-0">Today, 8:45 AM</span>
            </div>

            {/* Activity 4 */}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                <Icon name="check" size={13} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-slate-900 dark:text-white">
                  Offer approved by HR
                </span>
                <span className="block text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Ahmed Tarek &bull; Marketing Specialist</span>
              </div>
              <span className="text-[10px] text-slate-400 shrink-0">Yesterday, 4:35 PM</span>
            </div>

            {/* Activity 5 */}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center shrink-0 mt-0.5">
                <Icon name="plus" size={13} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-slate-900 dark:text-white">
                  New application received
                </span>
                <span className="block text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Sarah Ahmed &bull; Data Analyst</span>
              </div>
              <span className="text-[10px] text-slate-400 shrink-0">Yesterday, 2:10 PM</span>
            </div>
          </div>
        </div>

        {/* Column 3: Quick Actions */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
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
                    23 waiting for review
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
          SGH Design System &bull; Odoo recruitment workflow reference only
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
            <Button variant="ghost" size="sm" onClick={() => setIsActivityModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setIsActivityModalOpen(false);
                setActivitySummary('');
              }}
              disabled={!activitySummary.trim()}
            >
              Schedule
            </Button>
          </div>
        </div>
      </Modal>

      {/* Assign Open Vacancy & Target Modal */}
      <Modal
        isOpen={isAssignTaskModalOpen}
        onClose={() => setIsAssignTaskModalOpen(false)}
        title="Assign Open Vacancy & Target to Recruiter"
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleAssignTaskSubmit} className="space-y-4 text-xs">
          <p className="text-slate-500 dark:text-slate-400">
            Select an open vacancy position, delegate or reassign to a recruiter, and establish clear hiring &amp; screening targets with SLAs.
          </p>

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

          {/* Vacancy Details Card & Reassignment Logic */}
          {(() => {
            const currentVac = openVacanciesList.find((v) => v.id === selectedVacancyId) || openVacanciesList[0];
            const selectedRecruiter = RECRUITER_OPTIONS.find((r) => r.id === selectedRecruiterId) || RECRUITER_OPTIONS[0];
            const isReassignment = currentVac.currentRecruiter !== 'Unassigned' && currentVac.currentRecruiter !== selectedRecruiter.name;

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
                    <span className="font-semibold text-slate-900 dark:text-white">{currentVac.department} &bull; {currentVac.location}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Active Candidates in Funnel:</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">{currentVac.openApplications} candidates</span>
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
                {isReassignment ? (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
                    <span className="text-base">🔄</span>
                    <div>
                      <span className="font-bold block">Reassigning Position</span>
                      <span className="text-[11px] block mt-0.5">
                        Responsibility for <b>{currentVac.title}</b> will transfer from <b>{currentVac.currentRecruiter}</b> to <b>{selectedRecruiter.name}</b>.
                      </span>
                    </div>
                  </div>
                ) : currentVac.currentRecruiter === 'Unassigned' ? (
                  <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-xs flex items-start gap-2">
                    <span className="text-base">✨</span>
                    <div>
                      <span className="font-bold block">Initial Position Assignment</span>
                      <span className="text-[11px] block mt-0.5">
                        Assigning <b>{currentVac.title}</b> to <b>{selectedRecruiter.name}</b> with active SLA tracking.
                      </span>
                    </div>
                  </div>
                ) : null}

                {/* Recruiter Selector */}
                <div>
                  <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300">
                    {isReassignment ? 'Reassign To Recruiter' : 'Assign To Recruiter'}
                  </label>
                  <select
                    value={selectedRecruiterId}
                    onChange={(e) => setSelectedRecruiterId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-semibold cursor-pointer"
                  >
                    {RECRUITER_OPTIONS.map((rec) => (
                      <option key={rec.id} value={rec.id}>
                        {rec.name} — {rec.role}
                      </option>
                    ))}
                  </select>
                </div>

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
                        onChange={(e) => setTargetQuota(parseInt(e.target.value) || 1)}
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
                        onChange={(e) => setTaskPriority(e.target.value as any)}
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
                    placeholder="e.g. Prioritize candidates with active SCFHS license and ICU experience. Target offer extension within 14 days."
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            );
          })()}

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
              disabled={isAssigning}
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
