import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TaskRecord, Vacancy } from '@recruitflow/contracts';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { PageState } from '../components/ui/PageState';
import { getApi, postApi } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { QuickGuideTrigger } from '../quickguide';
import './PageEnhancementsV2.css';

interface TaskQueueItem {
  id: string;
  priority: 'High' | 'Medium' | 'Low';
  taskTitle: string;
  taskType: string;
  candidateName: string;
  candidateAppId: string;
  positionTitle: string;
  department: string;
  location: string;
  ownerName: string;
  ownerAvatar: string;
  dueTime: string;
  dueLeft: string;
  slaState: 'On track' | 'At risk' | 'Overdue';
  nextActionLabel: string;
  nextActionRoute: string;
  status: string;
}

interface RecruiterOption {
  id: string;
  name: string;
  role: string;
}

function getInitials(name: string): string {
  if (!name || name === 'Unassigned') return '—';
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

function formatDueTime(dueAt: string | null): { dueTime: string; dueLeft: string } {
  if (!dueAt) return { dueTime: 'No deadline', dueLeft: '—' };
  const d = new Date(dueAt);
  if (isNaN(d.getTime())) return { dueTime: '—', dueLeft: '—' };

  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now.getTime() + 86400000);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();

  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dueTime = isToday
    ? `Today, ${timeStr}`
    : isTomorrow
    ? `Tomorrow, ${timeStr}`
    : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;

  if (diffMs < 0) {
    const overdueHours = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60));
    const overdueDays = Math.floor(overdueHours / 24);
    const dueLeft = overdueDays > 0 ? `${overdueDays}d overdue` : `${overdueHours}h overdue`;
    return { dueTime, dueLeft };
  }

  const hoursLeft = Math.floor(diffMs / (1000 * 60 * 60));
  const daysLeft = Math.floor(hoursLeft / 24);
  const dueLeft = daysLeft > 0 ? `${daysLeft} days left` : `${hoursLeft}h left`;
  return { dueTime, dueLeft };
}

export function TasksPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tasksList, setTasksList] = useState<TaskQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilterTab, setActiveFilterTab] = useState('All Tasks');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOwnerFilter, setSelectedOwnerFilter] = useState('ALL');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('ALL');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState('ALL');
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState('ALL');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Vacancy & Recruiter options loaded from API
  const [apiVacancies, setApiVacancies] = useState<Vacancy[]>([]);
  const [apiRecruiters, setApiRecruiters] = useState<RecruiterOption[]>([]);
  const [selectedVacancyId, setSelectedVacancyId] = useState<string>('');
  const [selectedRecruiterId, setSelectedRecruiterId] = useState<string>('');
  const [targetType, setTargetType] = useState<'Hires' | 'Screenings' | 'Interviews'>('Hires');
  const [targetQuota, setTargetQuota] = useState<number>(3);
  const [targetDeadline, setTargetDeadline] = useState<string>('7 Days (Standard SLA)');
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('High');
  const [instructions, setInstructions] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const userRoleCodes = useMemo(() => {
    return (user?.roles || []).map((r) => ((r.code || r.name || '').toUpperCase()));
  }, [user]);

  const isManagerOrAdmin = useMemo(() => {
    const managerRoles = ['ADMIN', 'SYSADMIN', 'ADMINISTRATOR', 'HIRING_MANAGER', 'TALENT_MANAGER', 'HR_MANAGER'];
    return (
      userRoleCodes.some((code) => managerRoles.includes(code)) ||
      Boolean(user?.permissions?.includes('VACANCY_MANAGE'))
    );
  }, [userRoleCodes, user?.permissions]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const mapTaskRecord = useCallback((task: TaskRecord, currentUserName: string): TaskQueueItem => {
    const { dueTime, dueLeft } = formatDueTime(task.dueAt);

    let priorityMapped: 'High' | 'Medium' | 'Low' = 'Medium';
    if (task.priority === 'High' || task.priority === 'Critical') {
      priorityMapped = 'High';
    } else if (task.priority === 'Low') {
      priorityMapped = 'Low';
    }

    let slaState: 'On track' | 'At risk' | 'Overdue' = 'On track';
    if (task.isOverdue || (task.dueAt && new Date(task.dueAt) < new Date() && task.status !== 'Completed')) {
      slaState = 'Overdue';
    } else if (task.dueAt && (new Date(task.dueAt).getTime() - Date.now() < 24 * 3600 * 1000) && task.status !== 'Completed') {
      slaState = 'At risk';
    }

    // Parse descriptive metadata if packed in description string (e.g. "Position: ... | Candidate: ...")
    const desc = task.description || '';
    const posMatch = desc.match(/Position:\s*([^|,\n]+)/);
    const candMatch = desc.match(/Candidate:\s*([^|,\n]+)/);
    const deptMatch = desc.match(/Department:\s*([^|,\n]+)/);
    const locMatch = desc.match(/Location:\s*([^|,\n]+)/);

    const positionTitle = posMatch ? posMatch[1].trim() : 'No position';
    const candidateName = candMatch
      ? candMatch[1].trim()
      : task.entityType === 'Application'
      ? 'Unknown candidate'
      : '—';
    const department = deptMatch ? deptMatch[1].trim() : '—';
    const location = locMatch ? locMatch[1].trim() : '—';

    let candidateAppId = '—';
    if (task.entityType === 'Application' && task.entityId) {
      candidateAppId = `APP-${task.entityId.slice(0, 8)}`;
    } else if (task.entityType === 'Vacancy' && task.entityId) {
      candidateAppId = `REQ-${task.entityId.slice(0, 8)}`;
    } else if (task.entityId) {
      candidateAppId = task.entityId.slice(0, 8);
    }

    const ownerName = currentUserName || 'Unassigned';
    const ownerAvatar = getInitials(ownerName);

    let nextActionRoute = '/tasks';
    let nextActionLabel = 'View details';
    if (task.entityType === 'Application' && task.entityId) {
      nextActionRoute = `/applications/${task.entityId}`;
      nextActionLabel = task.type === 'Screening' ? 'Review CV' : 'View application';
    } else if (task.entityType === 'Interview' && task.entityId) {
      nextActionRoute = `/interviews/${task.entityId}`;
      nextActionLabel = 'Open interview';
    } else if (task.entityType === 'Offer' && task.entityId) {
      nextActionRoute = `/offers/${task.entityId}`;
      nextActionLabel = 'Review offer';
    } else if (task.entityType === 'Vacancy' && task.entityId) {
      nextActionRoute = `/vacancies/${task.entityId}`;
      nextActionLabel = 'Review pipeline';
    }

    return {
      id: task.id,
      priority: priorityMapped,
      taskTitle: task.title,
      taskType: task.type || 'General',
      candidateName,
      candidateAppId,
      positionTitle,
      department,
      location,
      ownerName,
      ownerAvatar,
      dueTime,
      dueLeft,
      slaState,
      nextActionLabel,
      nextActionRoute,
      status: task.status,
    };
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [tasksRes, vacRes, recRes] = await Promise.allSettled([
        getApi<{ data?: TaskRecord[] } | TaskRecord[]>('/tasks?pageSize=100'),
        getApi<Vacancy[]>('/vacancies'),
        getApi<{ id: string; displayName?: string; name?: string; roleCode?: string }[]>('/users/interviewers'),
      ]);

      const currentUserName = user?.displayName || 'You';

      if (tasksRes.status === 'fulfilled' && tasksRes.value) {
        const raw = Array.isArray(tasksRes.value)
          ? tasksRes.value
          : tasksRes.value.data || [];
        setTasksList(raw.map((t) => mapTaskRecord(t, currentUserName)));
      } else {
        setTasksList([]);
      }

      if (vacRes.status === 'fulfilled' && Array.isArray(vacRes.value)) {
        setApiVacancies(vacRes.value);
        if (vacRes.value.length > 0 && !selectedVacancyId) {
          setSelectedVacancyId(vacRes.value[0].id);
        }
      }

      if (recRes.status === 'fulfilled' && Array.isArray(recRes.value)) {
        const mapped = recRes.value.map((r) => ({
          id: r.id,
          name: r.displayName || r.name || 'Recruiter',
          role: r.roleCode || 'Recruiter',
        }));
        setApiRecruiters(mapped);
        if (mapped.length > 0 && !selectedRecruiterId) {
          setSelectedRecruiterId(mapped[0].id);
        }
      } else if (user) {
        setApiRecruiters([{ id: user.id, name: user.displayName || 'Current User', role: 'Recruiter' }]);
        if (!selectedRecruiterId) setSelectedRecruiterId(user.id);
      }
    } catch {
      setTasksList([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, mapTaskRecord, selectedVacancyId, selectedRecruiterId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleAssignTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isManagerOrAdmin) {
      showToast('Recruiters are not authorized to assign or reassign tasks.');
      return;
    }
    const vacancy = apiVacancies.find((v) => v.id === selectedVacancyId);
    const recruiter = apiRecruiters.find((r) => r.id === selectedRecruiterId) || apiRecruiters[0];

    const vacancyTitle = vacancy?.title || vacancy?.position?.title || 'Open Vacancy';
    const vacancyDept = (vacancy as unknown as { department?: string } | null | undefined)?.department || vacancy?.branch?.name || 'Operations';
    const vacancyLoc = vacancy?.location || vacancy?.branch?.name || '—';

    setIsSubmitting(true);
    const taskTitle = `${targetType === 'Hires' ? 'Hire Target' : 'Screening Target'}: ${targetQuota} ${targetType} for ${vacancyTitle}`;

    try {
      await postApi('/tasks', {
        title: taskTitle,
        type: targetType === 'Hires' ? 'Hiring' : 'Screening',
        priority: priority === 'High' ? 'High' : 'Normal',
        description: `Position: ${vacancyTitle} | Department: ${vacancyDept} | Location: ${vacancyLoc} | Quota: ${targetQuota} ${targetType} | Due: ${targetDeadline} | Notes: ${instructions || 'Target assigned by recruitment manager'}`,
        assigneeUserId: recruiter?.id || user?.id,
        entityType: 'Vacancy',
        entityId: vacancy?.id || null,
      }).catch(() => {});

      showToast(
        `✓ Assigned "${vacancyTitle}" target to ${recruiter?.name || 'recruiter'} (${targetQuota} ${targetType})!`
      );
      setIsAssignModalOpen(false);
      setInstructions('');
      await loadData();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Metrics derived dynamically
  const metrics = useMemo(() => {
    const all = tasksList.length;
    const overdue = tasksList.filter((t) => t.slaState === 'Overdue').length;
    const dueToday = tasksList.filter((t) => t.dueTime.includes('Today')).length;
    const upcoming = tasksList.filter((t) => t.slaState === 'On track' && t.status !== 'Completed').length;
    const completed = tasksList.filter((t) => t.status === 'Completed').length;
    return { all, overdue, dueToday, upcoming, completed };
  }, [tasksList]);

  // Dynamic filter options
  const filterOptions = useMemo(() => {
    const types = Array.from(new Set(tasksList.map((t) => t.taskType).filter(Boolean)));
    const owners = Array.from(new Set(tasksList.map((t) => t.ownerName).filter((o) => o && o !== 'Unassigned')));
    const departments = Array.from(new Set(tasksList.map((t) => t.department).filter((d) => d && d !== '—')));
    return { types, owners, departments };
  }, [tasksList]);

  const filteredTasks = useMemo(() => {
    return tasksList.filter((task) => {
      if (activeFilterTab.startsWith('Overdue') && task.slaState !== 'Overdue') return false;
      if (activeFilterTab.startsWith('Due Today') && !task.dueTime.includes('Today')) return false;
      if (activeFilterTab.startsWith('Interviews') && !task.taskType.toLowerCase().includes('interview')) return false;
      if (activeFilterTab.startsWith('Offers') && !task.taskType.toLowerCase().includes('offer')) return false;
      if (activeFilterTab.startsWith('Screening') && !task.taskType.toLowerCase().includes('screen')) return false;

      if (selectedOwnerFilter !== 'ALL' && task.ownerName !== selectedOwnerFilter) return false;
      if (selectedTypeFilter !== 'ALL' && task.taskType !== selectedTypeFilter) return false;
      if (selectedPriorityFilter !== 'ALL' && task.priority !== selectedPriorityFilter) return false;
      if (selectedDepartmentFilter !== 'ALL' && task.department !== selectedDepartmentFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          task.taskTitle.toLowerCase().includes(q) ||
          task.candidateName.toLowerCase().includes(q) ||
          task.positionTitle.toLowerCase().includes(q) ||
          task.department.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [
    tasksList,
    activeFilterTab,
    searchQuery,
    selectedOwnerFilter,
    selectedTypeFilter,
    selectedPriorityFilter,
    selectedDepartmentFilter,
  ]);

  const paginatedTasks = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTasks.slice(start, start + pageSize);
  }, [filteredTasks, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / pageSize));

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedTasks.length && paginatedTasks.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedTasks.map((t) => t.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const getPriorityBadge = (p: TaskQueueItem['priority']) => {
    switch (p) {
      case 'High':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900';
      case 'Medium':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900';
      case 'Low':
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900';
    }
  };

  const getSlaBadge = (s: TaskQueueItem['slaState']) => {
    switch (s) {
      case 'Overdue':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900';
      case 'At risk':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900';
      case 'On track':
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900';
    }
  };

  const dynamicTabs = [
    { label: 'All Tasks', count: metrics.all },
    { label: 'Overdue', count: metrics.overdue },
    { label: 'Due Today', count: metrics.dueToday },
    { label: 'Interviews', count: tasksList.filter((t) => t.taskType.toLowerCase().includes('interview')).length },
    { label: 'Offers', count: tasksList.filter((t) => t.taskType.toLowerCase().includes('offer')).length },
  ];

  return (
    <div className="flex w-full flex-col p-4 sm:p-6 lg:p-7 max-w-[1720px] mx-auto space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              My Work &mdash; Full Task Queue
            </h1>
            <QuickGuideTrigger />
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            All your recruitment tasks in one place. Stay on top of every action that moves hiring forward.
          </p>
        </div>

        {isManagerOrAdmin && (
          <button
            type="button"
            onClick={() => setIsAssignModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer self-start sm:self-auto"
          >
            <Icon name="plus" size={14} />
            <span>Assign Task</span>
          </button>
        )}
      </div>

      {/* ── 5 Metric Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: All Tasks */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-2">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
            <Icon name="check-circle" size={18} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block">All Tasks</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white block mt-0.5">
              {metrics.all}
            </span>
            <span className="text-xs font-bold text-slate-500 block mt-1">Active queue</span>
          </div>
        </div>

        {/* Card 2: Overdue */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-2">
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center">
            <Icon name="alert-triangle" size={18} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block">Overdue</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white block mt-0.5">
              {metrics.overdue}
            </span>
            <span className="text-xs font-bold text-rose-600 block mt-1">
              {metrics.overdue > 0 ? 'Requires attention' : 'Zero overdue'}
            </span>
          </div>
        </div>

        {/* Card 3: Due Today */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-2">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
            <Icon name="calendar" size={18} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block">Due Today</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white block mt-0.5">
              {metrics.dueToday}
            </span>
            <span className="text-xs font-bold text-amber-600 block mt-1">Scheduled today</span>
          </div>
        </div>

        {/* Card 4: Upcoming */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
            <Icon name="clock" size={18} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block">Upcoming</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white block mt-0.5">
              {metrics.upcoming}
            </span>
            <span className="text-xs font-bold text-emerald-600 block mt-1">Within SLA</span>
          </div>
        </div>

        {/* Card 5: Completed */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-2">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center">
            <Icon name="check" size={18} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block">Completed</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white block mt-0.5">
              {metrics.completed}
            </span>
            <span className="text-xs font-bold text-purple-600 block mt-1">Closed items</span>
          </div>
        </div>
      </div>

      {/* ── Filter Tabs & Search ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto text-xs font-semibold pb-1">
          {dynamicTabs.map((tab) => {
            const isActive = activeFilterTab.startsWith(tab.label);
            return (
              <button
                key={tab.label}
                type="button"
                onClick={() => {
                  setActiveFilterTab(tab.label);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-full whitespace-nowrap transition cursor-pointer ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-800'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64 shrink-0">
          <Icon name="search" size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search tasks..."
            className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
          />
        </div>
      </div>

      {/* ── Filter Selectors Row ── */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <div className="relative">
          <select
            value={selectedOwnerFilter}
            onChange={(e) => {
              setSelectedOwnerFilter(e.target.value);
              setPage(1);
            }}
            className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 pr-7 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer shadow-xs"
          >
            <option value="ALL">All Owners</option>
            {filterOptions.owners.map((owner) => (
              <option key={owner} value={owner}>{owner}</option>
            ))}
          </select>
          <Icon name="chevron-down" size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={selectedTypeFilter}
            onChange={(e) => {
              setSelectedTypeFilter(e.target.value);
              setPage(1);
            }}
            className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 pr-7 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer shadow-xs"
          >
            <option value="ALL">All Task Types</option>
            {filterOptions.types.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <Icon name="chevron-down" size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={selectedPriorityFilter}
            onChange={(e) => {
              setSelectedPriorityFilter(e.target.value);
              setPage(1);
            }}
            className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 pr-7 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer shadow-xs"
          >
            <option value="ALL">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <Icon name="chevron-down" size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {filterOptions.departments.length > 0 && (
          <div className="relative">
            <select
              value={selectedDepartmentFilter}
              onChange={(e) => {
                setSelectedDepartmentFilter(e.target.value);
                setPage(1);
              }}
              className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 pr-7 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer shadow-xs"
            >
              <option value="ALL">All Departments</option>
              {filterOptions.departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
            <Icon name="chevron-down" size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsMoreFiltersOpen((prev) => !prev)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-xs font-semibold transition shadow-xs cursor-pointer ${
            isMoreFiltersOpen
              ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50'
          }`}
        >
          <Icon name="filter" size={12} className="text-slate-400" />
          <span>{isMoreFiltersOpen ? 'Hide Filters' : 'More Filters'}</span>
        </button>
      </div>

      {/* Expandable filters */}
      {isMoreFiltersOpen && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-xs">
          <span className="font-bold text-slate-500">Quick Filter:</span>
          {dynamicTabs.map((tab) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => {
                setActiveFilterTab(tab.label);
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                activeFilterTab.startsWith(tab.label)
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setActiveFilterTab('All Tasks');
              setSearchQuery('');
              setSelectedOwnerFilter('ALL');
              setSelectedTypeFilter('ALL');
              setSelectedPriorityFilter('ALL');
              setSelectedDepartmentFilter('ALL');
              setPage(1);
            }}
            className="ml-auto text-xs font-bold text-slate-500 hover:text-rose-600 cursor-pointer"
          >
            Reset
          </button>
        </div>
      )}

      {/* ── Table or Empty State ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-8">
            <PageState kind="loading" title="Loading tasks..." description="Fetching your recruitment task queue." />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-8">
            <PageState
              kind="empty"
              title={searchQuery || activeFilterTab !== 'All Tasks' ? 'No matching tasks found' : 'No tasks assigned'}
              description={
                searchQuery || activeFilterTab !== 'All Tasks'
                  ? 'Try adjusting your search terms or active filters.'
                  : 'Your recruitment task queue is currently empty.'
              }
              actionLabel={searchQuery || activeFilterTab !== 'All Tasks' ? 'Reset filters' : 'Assign task'}
              onAction={
                searchQuery || activeFilterTab !== 'All Tasks'
                  ? () => {
                      setActiveFilterTab('All Tasks');
                      setSearchQuery('');
                      setSelectedOwnerFilter('ALL');
                      setSelectedTypeFilter('ALL');
                      setSelectedPriorityFilter('ALL');
                      setSelectedDepartmentFilter('ALL');
                    }
                  : () => setIsAssignModalOpen(true)
              }
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-400 bg-slate-50/50 dark:bg-slate-800/30 text-left">
                    <th className="p-3.5 pl-4 w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === paginatedTasks.length && paginatedTasks.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-300 text-blue-600 cursor-pointer"
                      />
                    </th>
                    <th className="py-3.5 px-3">Priority</th>
                    <th className="py-3.5 px-3">Task</th>
                    <th className="py-3.5 px-3">Related Candidate</th>
                    <th className="py-3.5 px-3">Related Position</th>
                    <th className="py-3.5 px-3">Owner</th>
                    <th className="py-3.5 px-3">Due</th>
                    <th className="py-3.5 px-3">SLA State</th>
                    <th className="py-3.5 px-3">Next Action</th>
                    <th className="py-3.5 pr-4 text-right">
                      <Icon name="settings" size={13} className="text-slate-400 inline" />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedTasks.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => navigate(t.nextActionRoute)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition cursor-pointer group"
                    >
                      {/* Checkbox */}
                      <td className="p-3.5 pl-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(t.id)}
                          onChange={() => toggleSelectOne(t.id)}
                          className="rounded border-slate-300 text-blue-600 cursor-pointer"
                        />
                      </td>

                      {/* Priority */}
                      <td className="py-3.5 px-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border ${getPriorityBadge(t.priority)}`}>
                          {t.priority}
                        </span>
                      </td>

                      {/* Task */}
                      <td className="py-3.5 px-3">
                        <div>
                          <span className="block font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition">
                            {t.taskTitle}
                          </span>
                          <span className="block text-[10.5px] text-slate-400">{t.taskType}</span>
                        </div>
                      </td>

                      {/* Candidate */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                            {getInitials(t.candidateName)}
                          </div>
                          <div>
                            <span className="block font-bold text-slate-900 dark:text-white leading-tight">
                              {t.candidateName}
                            </span>
                            <span className="block text-[10px] text-slate-400 font-mono">
                              {t.candidateAppId}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Position */}
                      <td className="py-3.5 px-3">
                        <div>
                          <span className="block font-bold text-slate-800 dark:text-slate-200">
                            {t.positionTitle}
                          </span>
                          <span className="block text-[10.5px] text-slate-400">
                            {t.department !== '—' && t.location !== '—'
                              ? `${t.department} • ${t.location}`
                              : t.department !== '—'
                              ? t.department
                              : t.location}
                          </span>
                        </div>
                      </td>

                      {/* Owner */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-teal-600 text-white text-[8px] font-extrabold flex items-center justify-center shrink-0">
                            {t.ownerAvatar}
                          </div>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {t.ownerName}
                          </span>
                        </div>
                      </td>

                      {/* Due */}
                      <td className="py-3.5 px-3">
                        <div>
                          <span className="block font-bold text-slate-900 dark:text-white">
                            {t.dueTime}
                          </span>
                          <span className="block text-[10.5px] font-semibold text-amber-600 dark:text-amber-400">
                            {t.dueLeft}
                          </span>
                        </div>
                      </td>

                      {/* SLA State */}
                      <td className="py-3.5 px-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border ${getSlaBadge(t.slaState)}`}>
                          {t.slaState}
                        </span>
                      </td>

                      {/* Next Action */}
                      <td className="py-3.5 px-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(t.nextActionRoute);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold hover:bg-blue-50 transition shadow-2xs cursor-pointer"
                        >
                          <span>{t.nextActionLabel}</span>
                          <Icon name="chevron-right" size={11} />
                        </button>
                      </td>

                      {/* Row Menu */}
                      <td className="py-3.5 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => navigate(t.nextActionRoute)}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-blue-600 transition cursor-pointer"
                          title="Open task route"
                        >
                          <Icon name="more-horizontal" size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table Footer with Pagination */}
            <div className="p-3.5 px-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400">
              <span>
                Showing {Math.min((page - 1) * pageSize + 1, filteredTasks.length)} to{' '}
                {Math.min(page * pageSize, filteredTasks.length)} of {filteredTasks.length} tasks
              </span>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                  >
                    &lt;
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setPage(num)}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold transition cursor-pointer ${
                        page === num
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                  >
                    &gt;
                  </button>
                </div>

                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <option value={10}>10 per page</option>
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                </select>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Assign Open Vacancy & Target Modal */}
      <Modal
        isOpen={isAssignModalOpen && isManagerOrAdmin}
        onClose={() => setIsAssignModalOpen(false)}
        title="Assign Open Vacancy & Target to Recruiter"
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleAssignTask} className="space-y-4 text-xs">
          <p className="text-slate-500 dark:text-slate-400">
            Select an active vacancy position, assign to a recruiter, and establish recruitment targets with SLAs.
          </p>

          {apiVacancies.length === 0 ? (
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-center text-slate-500">
              No active vacancies found. Create a vacancy first before assigning targets.
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
                  onChange={(e) => setSelectedVacancyId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-semibold cursor-pointer"
                >
                  {apiVacancies.map((vac) => {
                    const title = vac.title || vac.position?.title || 'Untitled Vacancy';
                    const dept = (vac as unknown as { department?: string })?.department || vac.branch?.name || 'Operations';
                    const loc = vac.location || vac.branch?.name || '—';
                    return (
                      <option key={vac.id} value={vac.id}>
                        {title} — {dept} ({loc})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Recruiter Selector */}
              <div>
                <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300">
                  Assign To Recruiter
                </label>
                <select
                  value={selectedRecruiterId}
                  onChange={(e) => setSelectedRecruiterId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-semibold cursor-pointer"
                >
                  {apiRecruiters.map((rec) => (
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
                    SLA Velocity
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
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as 'High' | 'Medium' | 'Low')}
                      className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white cursor-pointer"
                    >
                      <option value="High">High (Critical Priority)</option>
                      <option value="Medium">Medium (Normal SLA)</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300 text-[11px]">Calculated Pacing</label>
                    <div className="p-2 bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      {targetQuota} {targetType.toLowerCase()} / {targetDeadline.split('(')[0]}
                    </div>
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div>
                <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300">
                  Manager Instructions &amp; Candidate Sourcing Criteria
                </label>
                <textarea
                  rows={2}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="e.g. Expedite review of applicants with GCC experience. Ensure salary aligns with clinical operations budget."
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsAssignModalOpen(false)}
              className="px-3 py-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || apiVacancies.length === 0}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Assigning...' : 'Assign Vacancy & Target'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2 border border-slate-700 animate-fade-in">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

export default TasksPage;
