import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { postApi } from '../api/client';
import { DEFAULT_OPEN_VACANCIES, RECRUITER_OPTIONS } from './ManagerDashboard';
import './PageEnhancementsV2.css';

interface TaskQueueItem {
  id: string;
  priority: 'High' | 'Medium' | 'Low';
  taskTitle: string;
  taskType: string;
  candidateName: string;
  candidateAppId: string;
  candidateAvatar: string;
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
}

const DEFAULT_TASKS: TaskQueueItem[] = [
  {
    id: 'task-1',
    priority: 'High',
    taskTitle: 'Technical interview',
    taskType: 'Interview',
    candidateName: 'Ali Hassan',
    candidateAppId: 'APP-02481',
    candidateAvatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&auto=format&fit=crop&q=80',
    positionTitle: 'Senior Frontend Engineer',
    department: 'Engineering',
    location: 'Cairo, Egypt',
    ownerName: 'Sarah Ahmed',
    ownerAvatar: 'SA',
    dueTime: 'Today, 2:00 PM',
    dueLeft: '2h 15m left',
    slaState: 'On track',
    nextActionLabel: 'Start interview',
    nextActionRoute: '/interviews/int-1',
  },
  {
    id: 'task-2',
    priority: 'High',
    taskTitle: 'Review CV',
    taskType: 'Screening',
    candidateName: 'Mona Saleh',
    candidateAppId: 'APP-02517',
    candidateAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80',
    positionTitle: 'Registered Nurse – ICU',
    department: 'Clinical Operations',
    location: 'Jeddah',
    ownerName: 'Mona Saleh',
    ownerAvatar: 'MS',
    dueTime: 'Today, 10:30 AM',
    dueLeft: '10m left',
    slaState: 'At risk',
    nextActionLabel: 'Review now',
    nextActionRoute: '/applications/APP-02481',
  },
  {
    id: 'task-3',
    priority: 'Medium',
    taskTitle: 'Offer approval',
    taskType: 'Offer',
    candidateName: 'Ahmed Samy',
    candidateAppId: 'APP-02455',
    candidateAvatar: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=100&auto=format&fit=crop&q=80',
    positionTitle: 'Product Manager',
    department: 'Digital Health',
    location: 'Riyadh',
    ownerName: 'Sarah Ahmed',
    ownerAvatar: 'SA',
    dueTime: 'Today, 4:30 PM',
    dueLeft: '6h left',
    slaState: 'On track',
    nextActionLabel: 'Approve offer',
    nextActionRoute: '/offers/OFF-2026-1157',
  },
  {
    id: 'task-4',
    priority: 'Medium',
    taskTitle: 'Phone screen',
    taskType: 'Screening',
    candidateName: 'Nourhan Sami',
    candidateAppId: 'APP-02533',
    candidateAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
    positionTitle: 'Backend Engineer',
    department: 'Engineering',
    location: 'Cairo, Egypt',
    ownerName: 'Nourhan Sami',
    ownerAvatar: 'NS',
    dueTime: 'Tomorrow, 9:00 AM',
    dueLeft: '21h left',
    slaState: 'On track',
    nextActionLabel: 'Schedule call',
    nextActionRoute: '/interviews',
  },
  {
    id: 'task-5',
    priority: 'Low',
    taskTitle: 'Follow up',
    taskType: 'Follow-up',
    candidateName: 'Yousef Ahmed',
    candidateAppId: 'APP-02466',
    candidateAvatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&auto=format&fit=crop&q=80',
    positionTitle: 'UX Designer',
    department: 'Digital Health',
    location: 'Cairo, Egypt',
    ownerName: 'Yousef Ahmed',
    ownerAvatar: 'YA',
    dueTime: 'Tomorrow, 11:30 AM',
    dueLeft: '23h left',
    slaState: 'On track',
    nextActionLabel: 'Send message',
    nextActionRoute: '/applications/APP-02481',
  },
  {
    id: 'task-6',
    priority: 'High',
    taskTitle: 'Interview feedback',
    taskType: 'Interview',
    candidateName: 'Khaled Mostafa',
    candidateAppId: 'APP-02501',
    candidateAvatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=100&auto=format&fit=crop&q=80',
    positionTitle: 'Data Analyst',
    department: 'Strategy & Analytics',
    location: 'Cairo',
    ownerName: 'Sara Mohamed',
    ownerAvatar: 'SM',
    dueTime: 'Tomorrow, 2:00 PM',
    dueLeft: '1 day left',
    slaState: 'At risk',
    nextActionLabel: 'Add feedback',
    nextActionRoute: '/interviews/int-1',
  },
  {
    id: 'task-7',
    priority: 'Medium',
    taskTitle: 'Compensation review',
    taskType: 'Offer',
    candidateName: 'Omar Ashraf',
    candidateAppId: 'APP-02412',
    candidateAvatar: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=100&auto=format&fit=crop&q=80',
    positionTitle: 'Senior Frontend Engineer',
    department: 'Engineering',
    location: 'Cairo, Egypt',
    ownerName: 'Omar Ashraf',
    ownerAvatar: 'OA',
    dueTime: '2 Sep, 10:00 AM',
    dueLeft: '2 days left',
    slaState: 'On track',
    nextActionLabel: 'Review offer',
    nextActionRoute: '/offers/OFF-2026-1157',
  },
  {
    id: 'task-8',
    priority: 'Low',
    taskTitle: 'Reference check',
    taskType: 'Verification',
    candidateName: 'Heba Mohamed',
    candidateAppId: 'APP-02544',
    candidateAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80',
    positionTitle: 'Radiology Technologist',
    department: 'Clinical Operations',
    location: 'Dammam',
    ownerName: 'Heba Mohamed',
    ownerAvatar: 'HM',
    dueTime: '2 Sep, 3:00 PM',
    dueLeft: '2 days left',
    slaState: 'On track',
    nextActionLabel: 'Check references',
    nextActionRoute: '/applications/APP-02481',
  },
  {
    id: 'task-9',
    priority: 'Low',
    taskTitle: 'Send offer letter',
    taskType: 'Offer',
    candidateName: 'Islam Fathy',
    candidateAppId: 'APP-02480',
    candidateAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80',
    positionTitle: 'DevOps Engineer',
    department: 'Engineering',
    location: 'Jeddah',
    ownerName: 'Sarah Ahmed',
    ownerAvatar: 'SA',
    dueTime: '3 Sep, 11:00 AM',
    dueLeft: '3 days left',
    slaState: 'On track',
    nextActionLabel: 'Send offer',
    nextActionRoute: '/offers/OFF-2026-1157',
  },
  {
    id: 'task-10',
    priority: 'Medium',
    taskTitle: 'Panel interview',
    taskType: 'Interview',
    candidateName: 'Lina Hassan',
    candidateAppId: 'APP-02520',
    candidateAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    positionTitle: 'HR Business Partner',
    department: 'People & Culture',
    location: 'Riyadh',
    ownerName: 'Lina Hassan',
    ownerAvatar: 'LH',
    dueTime: '3 Sep, 2:00 PM',
    dueLeft: '3 days left',
    slaState: 'On track',
    nextActionLabel: 'Prepare panel',
    nextActionRoute: '/interviews/int-1',
  },
];

export function TasksPage() {
  const navigate = useNavigate();
  const [tasksList, setTasksList] = useState<TaskQueueItem[]>(DEFAULT_TASKS);
  const [activeFilterTab, setActiveFilterTab] = useState('All Tasks');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);

  // Vacancy & Target Assignment State
  const [selectedVacancyId, setSelectedVacancyId] = useState<string>('vac-1');
  const [selectedRecruiterId, setSelectedRecruiterId] = useState<string>('231c4106-9094-478d-8c20-0ff0bc9ee592');
  const [targetType, setTargetType] = useState<'Hires' | 'Screenings' | 'Interviews'>('Hires');
  const [targetQuota, setTargetQuota] = useState<number>(3);
  const [targetDeadline, setTargetDeadline] = useState<string>('7 Days (Standard SLA)');
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('High');
  const [instructions, setInstructions] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleAssignTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const vacancy = DEFAULT_OPEN_VACANCIES.find((v) => v.id === selectedVacancyId) || DEFAULT_OPEN_VACANCIES[0];
    const recruiter = RECRUITER_OPTIONS.find((r) => r.id === selectedRecruiterId) || RECRUITER_OPTIONS[0];

    setIsSubmitting(true);
    const taskTitle = `${targetType === 'Hires' ? 'Hire Target' : 'Screening Target'}: ${targetQuota} ${targetType} for ${vacancy.title}`;
    const newTask: TaskQueueItem = {
      id: `task-${Date.now()}`,
      priority,
      taskTitle,
      taskType: targetType === 'Hires' ? 'Hiring' : 'Screening',
      candidateName: `${vacancy.title} Pipeline`,
      candidateAppId: `REQ-${vacancy.id.toUpperCase()}`,
      candidateAvatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&auto=format&fit=crop&q=80',
      positionTitle: vacancy.title,
      department: vacancy.department,
      location: vacancy.location,
      ownerName: recruiter.name,
      ownerAvatar: recruiter.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase(),
      dueTime: targetDeadline,
      dueLeft: targetDeadline.split('(')[0].trim(),
      slaState: priority === 'High' ? 'At risk' : 'On track',
      nextActionLabel: 'Review pipeline',
      nextActionRoute: '/vacancies',
    };

    try {
      await postApi('/tasks', {
        title: newTask.taskTitle,
        type: newTask.taskType,
        priority: newTask.priority === 'High' ? 'High' : 'Normal',
        description: `Position: ${vacancy.title} (${vacancy.department}) | Quota: ${targetQuota} ${targetType} | Due: ${targetDeadline} | Notes: ${instructions || 'Target assigned by recruitment manager'}`,
        assigneeUserId: recruiter.id,
      }).catch(() => {});

      setTasksList((prev) => [newTask, ...prev]);
      const isReassign = vacancy.currentRecruiter !== 'Unassigned' && vacancy.currentRecruiter !== recruiter.name;
      showToast(
        isReassign
          ? `✓ Reassigned "${vacancy.title}" to ${recruiter.name} (Target: ${targetQuota} ${targetType})!`
          : `✓ Assigned "${vacancy.title}" to ${recruiter.name} (Target: ${targetQuota} ${targetType})!`
      );
      setIsAssignModalOpen(false);
      setInstructions('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTasks = useMemo(() => {
    return tasksList.filter((task) => {
      if (activeFilterTab === 'Overdue (9)' && task.slaState !== 'Overdue') return false;
      if (activeFilterTab === 'Due Today (12)' && !task.dueTime.includes('Today')) return false;
      if (activeFilterTab === 'Interviews (14)' && task.taskType !== 'Interview') return false;
      if (activeFilterTab === 'Offers (7)' && task.taskType !== 'Offer') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          task.taskTitle.toLowerCase().includes(q) ||
          task.candidateName.toLowerCase().includes(q) ||
          task.positionTitle.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [tasksList, activeFilterTab, searchQuery]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredTasks.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTasks.map((t) => t.id));
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
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Medium':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Low':
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  const getSlaBadge = (s: TaskQueueItem['slaState']) => {
    switch (s) {
      case 'Overdue':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'At risk':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'On track':
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  return (
    <div className="flex w-full flex-col p-4 sm:p-6 lg:p-7 max-w-[1720px] mx-auto space-y-6">
      {/* ── Page Header matching 14-my-work-full-task-queue.png ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            My Work &mdash; Full Task Queue
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            All your recruitment tasks in one place. Stay on top of every action that moves hiring forward.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAssignModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <Icon name="plus" size={14} />
          <span>Assign Task</span>
        </button>
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
            <span className="text-2xl font-black text-slate-900 dark:text-white block mt-0.5">48</span>
            <span className="text-xs font-bold text-blue-600 block mt-1">+6 vs yesterday</span>
          </div>
        </div>

        {/* Card 2: Overdue */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-2">
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center">
            <Icon name="alert-triangle" size={18} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block">Overdue</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white block mt-0.5">9</span>
            <span className="text-xs font-bold text-rose-600 block mt-1">+3 vs yesterday</span>
          </div>
        </div>

        {/* Card 3: Due Today */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-2">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
            <Icon name="calendar" size={18} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block">Due Today</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white block mt-0.5">12</span>
            <span className="text-xs font-bold text-amber-600 block mt-1">+2 vs yesterday</span>
          </div>
        </div>

        {/* Card 4: Upcoming */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
            <Icon name="clock" size={18} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block">Upcoming</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white block mt-0.5">27</span>
            <span className="text-xs font-bold text-emerald-600 block mt-1">+1 vs yesterday</span>
          </div>
        </div>

        {/* Card 5: Completed Today */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-2">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center">
            <Icon name="check" size={18} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block">Completed Today</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white block mt-0.5">6</span>
            <span className="text-xs font-bold text-purple-600 block mt-1">+4 vs yesterday</span>
          </div>
        </div>
      </div>

      {/* ── Filter Tabs & Search ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto text-xs font-semibold pb-1">
          {['All Tasks', 'Overdue (9)', 'Due Today (12)', 'Interviews (14)', 'Follow-ups (18)', 'Offers (7)', 'Approvals (6)'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveFilterTab(tab)}
              className={`px-3 py-1.5 rounded-full whitespace-nowrap transition cursor-pointer ${
                activeFilterTab === tab
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-800'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64 shrink-0">
          <Icon name="search" size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks..."
            className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
          />
        </div>
      </div>

      {/* ── Filter Selectors Row ── */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <div className="relative">
          <select className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 pr-7 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer shadow-xs">
            <option value="ALL">All Owners</option>
            <option value="Sarah Ahmed">Sarah Ahmed</option>
            <option value="Mona Saleh">Mona Saleh</option>
          </select>
          <Icon name="chevron-down" size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 pr-7 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer shadow-xs">
            <option value="ALL">All Task Types</option>
            <option value="Interview">Interview</option>
            <option value="Screening">Screening</option>
            <option value="Offer">Offer</option>
          </select>
          <Icon name="chevron-down" size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 pr-7 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer shadow-xs">
            <option value="ALL">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <Icon name="chevron-down" size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 pr-7 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer shadow-xs">
            <option value="ALL">All Departments</option>
            <option value="Engineering">Engineering</option>
            <option value="Clinical">Clinical Operations</option>
            <option value="Digital">Digital Health</option>
          </select>
          <Icon name="chevron-down" size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

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
          {['All Tasks', 'Overdue (9)', 'Due Today (12)', 'Interviews (14)', 'Offers (6)'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveFilterTab(tab)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                activeFilterTab === tab
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              {tab}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setActiveFilterTab('All Tasks');
              setSearchQuery('');
            }}
            className="ml-auto text-xs font-bold text-slate-500 hover:text-rose-600 cursor-pointer"
          >
            Reset
          </button>
        </div>
      )}

      {/* ── Table matching 14-my-work-full-task-queue.png ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-400 bg-slate-50/50 dark:bg-slate-800/30 text-left">
                <th className="p-3.5 pl-4 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filteredTasks.length && filteredTasks.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-blue-600 cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-3">Priority ↕</th>
                <th className="py-3.5 px-3">Task</th>
                <th className="py-3.5 px-3">Related Candidate</th>
                <th className="py-3.5 px-3">Related Position</th>
                <th className="py-3.5 px-3">Owner</th>
                <th className="py-3.5 px-3">Due ↕</th>
                <th className="py-3.5 px-3">SLA State</th>
                <th className="py-3.5 px-3">Next Action</th>
                <th className="py-3.5 pr-4 text-right">
                  <Icon name="settings" size={13} className="text-slate-400 inline" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredTasks.map((t) => (
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
                      <img
                        src={t.candidateAvatar}
                        alt={t.candidateName}
                        className="w-7 h-7 rounded-full object-cover border shrink-0"
                      />
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
                        {t.department} &bull; {t.location}
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
                      <span className="block text-[10.5px] font-semibold text-amber-600">
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
          <span>Showing {(page - 1) * 10 + 1} to {Math.min(page * 10, 48)} of 48 tasks</span>

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
              {[1, 2, 3, 4, 5].map((num) => (
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
                onClick={() => setPage((p) => Math.min(5, p + 1))}
                disabled={page === 5}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                &gt;
              </button>
            </div>

            <select className="border rounded-lg px-2 py-1 text-xs">
              <option value="10">10 per page</option>
              <option value="25">25 per page</option>
            </select>
          </div>
        </div>
      </div>
      {/* Assign Open Vacancy & Target Modal */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Assign Open Vacancy & Target to Recruiter"
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleAssignTask} className="space-y-4 text-xs">
          <p className="text-slate-500 dark:text-slate-400">
            Select an active vacancy position, assign or reassign to a recruiter, and establish clinical recruitment targets with SLAs.
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
                const vac = DEFAULT_OPEN_VACANCIES.find((v) => v.id === id);
                if (vac && vac.currentRecruiterId) {
                  setSelectedRecruiterId(vac.currentRecruiterId);
                }
              }}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-semibold cursor-pointer"
            >
              {DEFAULT_OPEN_VACANCIES.map((vac) => (
                <option key={vac.id} value={vac.id}>
                  {vac.title} — {vac.department} ({vac.location}) [Current: {vac.currentRecruiter}]
                </option>
              ))}
            </select>
          </div>

          {/* Vacancy Details Card & Reassignment Logic */}
          {(() => {
            const currentVac = DEFAULT_OPEN_VACANCIES.find((v) => v.id === selectedVacancyId) || DEFAULT_OPEN_VACANCIES[0];
            const selectedRecruiter = RECRUITER_OPTIONS.find((r) => r.id === selectedRecruiterId) || RECRUITER_OPTIONS[0];
            const isReassignment = currentVac.currentRecruiter !== 'Unassigned' && currentVac.currentRecruiter !== selectedRecruiter.name;

            return (
              <div className="space-y-3.5">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-500 uppercase tracking-wider">Position Status</span>
                    <span className="px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                      ACTIVE REQUISITION
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Department &amp; Location:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{currentVac.department} &bull; {currentVac.location}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Active Pipeline Candidates:</span>
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
                        Transferring <b>{currentVac.title}</b> from <b>{currentVac.currentRecruiter}</b> to <b>{selectedRecruiter.name}</b>.
                      </span>
                    </div>
                  </div>
                ) : currentVac.currentRecruiter === 'Unassigned' ? (
                  <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-xs flex items-start gap-2">
                    <span className="text-base">✨</span>
                    <div>
                      <span className="font-bold block">Initial Position Assignment</span>
                      <span className="text-[11px] block mt-0.5">
                        Assigning <b>{currentVac.title}</b> to <b>{selectedRecruiter.name}</b>.
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
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as any)}
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
              </div>
            );
          })()}

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
              disabled={isSubmitting}
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
