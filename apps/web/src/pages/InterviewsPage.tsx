import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApi, postApi } from '../api/client';
import type { Interview, Application, PaginatedResult } from '@recruitflow/contracts';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import './PageEnhancementsV2.css';

interface InterviewGroup {
  dayTitle: string;
  daySubtitle: string;
  countLabel: string;
  items: {
    id: string;
    time: string;
    duration: string;
    candidateName: string;
    candidateRole: string;
    candidateAvatar: string;
    jobTitle: string;
    department: string;
    typeTag: string;
    typeTone: 'purple' | 'blue' | 'green';
    panel: string;
    mode: string;
    modeIcon: 'video' | 'phone' | 'map-pin';
    interviewerName: string;
    interviewerAvatar: string;
    statusBadge: string;
    statusTone: 'green' | 'amber' | 'blue';
  }[];
}

const DEFAULT_INTERVIEW_GROUPS: InterviewGroup[] = [
  {
    dayTitle: 'Today',
    daySubtitle: 'Wednesday, 2 Sep 2026',
    countLabel: '3 interviews',
    items: [
      {
        id: 'int-1',
        time: '10:00 AM',
        duration: '45m',
        candidateName: 'Mona Khaled',
        candidateRole: 'Product Designer',
        candidateAvatar: 'MK',
        jobTitle: 'Product Designer',
        department: 'Design',
        typeTag: 'Technical Interview',
        typeTone: 'purple',
        panel: 'Panel (2)',
        mode: 'Teams',
        modeIcon: 'video',
        interviewerName: 'Ali Hassan',
        interviewerAvatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=80&auto=format&fit=crop&q=80',
        statusBadge: 'Feedback Done',
        statusTone: 'green',
      },
      {
        id: 'int-2',
        time: '12:30 PM',
        duration: '60m',
        candidateName: 'Khaled Mostafa',
        candidateRole: 'Backend Engineer',
        candidateAvatar: 'KM',
        jobTitle: 'Backend Engineer',
        department: 'Engineering',
        typeTag: 'Panel Interview',
        typeTone: 'blue',
        panel: 'Panel (3)',
        mode: 'Teams',
        modeIcon: 'video',
        interviewerName: 'Sarah Ahmed',
        interviewerAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&auto=format&fit=crop&q=80',
        statusBadge: 'Feedback Pending',
        statusTone: 'amber',
      },
      {
        id: 'int-3',
        time: '3:00 PM',
        duration: '30m',
        candidateName: 'Nourhan Sami',
        candidateRole: 'ICU Nurse',
        candidateAvatar: 'NS',
        jobTitle: 'Registered Nurse - ICU',
        department: 'Clinical Operations',
        typeTag: 'HR Interview',
        typeTone: 'green',
        panel: 'Sara Mohamed',
        mode: 'Phone',
        modeIcon: 'phone',
        interviewerName: 'Sara Mohamed',
        interviewerAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&auto=format&fit=crop&q=80',
        statusBadge: 'Feedback Pending',
        statusTone: 'amber',
      },
    ],
  },
  {
    dayTitle: 'Tomorrow',
    daySubtitle: 'Thursday, 3 Sep 2026',
    countLabel: '2 interviews',
    items: [
      {
        id: 'int-4',
        time: '10:00 AM',
        duration: '45m',
        candidateName: 'Yousef Ahmed',
        candidateRole: 'DevOps Engineer',
        candidateAvatar: 'YA',
        jobTitle: 'DevOps Engineer',
        department: 'Engineering',
        typeTag: 'Technical Interview',
        typeTone: 'purple',
        panel: 'Panel (2)',
        mode: 'Teams',
        modeIcon: 'video',
        interviewerName: 'Sara Mohamed',
        interviewerAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80',
        statusBadge: 'Scheduled',
        statusTone: 'blue',
      },
      {
        id: 'int-5',
        time: '2:00 PM',
        duration: '60m',
        candidateName: 'Islam Fathy',
        candidateRole: 'Data Analyst',
        candidateAvatar: 'IF',
        jobTitle: 'Data Analyst',
        department: 'Strategy & Analytics',
        typeTag: 'Panel Interview',
        typeTone: 'blue',
        panel: 'Panel (3)',
        mode: 'On-site Cairo HQ',
        modeIcon: 'map-pin',
        interviewerName: 'Omar Farouk',
        interviewerAvatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=80&auto=format&fit=crop&q=80',
        statusBadge: 'Scheduled',
        statusTone: 'blue',
      },
    ],
  },
  {
    dayTitle: 'Friday',
    daySubtitle: '4 Sep 2026',
    countLabel: '2 interviews',
    items: [
      {
        id: 'int-6',
        time: '11:00 AM',
        duration: '30m',
        candidateName: 'Lina Hassan',
        candidateRole: 'HR Business Partner',
        candidateAvatar: 'LH',
        jobTitle: 'HR Business Partner',
        department: 'People & Culture',
        typeTag: 'HR Interview',
        typeTone: 'green',
        panel: 'Lina Hassan HR',
        mode: 'Teams',
        modeIcon: 'video',
        interviewerName: 'Lina Hassan',
        interviewerAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=80&auto=format&fit=crop&q=80',
        statusBadge: 'Scheduled',
        statusTone: 'blue',
      },
      {
        id: 'int-7',
        time: '4:00 PM',
        duration: '45m',
        candidateName: 'Omar Ashraf',
        candidateRole: 'Frontend Engineer',
        candidateAvatar: 'OA',
        jobTitle: 'Frontend Engineer',
        department: 'Engineering',
        typeTag: 'Technical Interview',
        typeTone: 'purple',
        panel: 'Panel (2)',
        mode: 'Teams',
        modeIcon: 'video',
        interviewerName: 'Ahmed Mostafa',
        interviewerAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&auto=format&fit=crop&q=80',
        statusBadge: 'Scheduled',
        statusTone: 'blue',
      },
    ],
  },
  {
    dayTitle: 'Saturday',
    daySubtitle: '5 Sep 2026',
    countLabel: '1 interview',
    items: [
      {
        id: 'int-8',
        time: '12:00 PM',
        duration: '45m',
        candidateName: 'Noha Farouk',
        candidateRole: 'Medical Coder',
        candidateAvatar: 'NF',
        jobTitle: 'Medical Coder',
        department: 'Clinical Operations',
        typeTag: 'Panel Interview',
        typeTone: 'blue',
        panel: 'Panel (2)',
        mode: 'Phone',
        modeIcon: 'phone',
        interviewerName: 'Mona Saleh',
        interviewerAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=80&auto=format&fit=crop&q=80',
        statusBadge: 'Scheduled',
        statusTone: 'blue',
      },
    ],
  },
];

export function InterviewsPage() {
  const navigate = useNavigate();
  const [apiInterviews, setApiInterviews] = useState<Interview[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('list');
  const [dateRange] = useState('31 Aug - 6 Sep 2026');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Scheduling Form State
  const [selectedAppId, setSelectedAppId] = useState('');
  const [interviewTitle, setInterviewTitle] = useState('Clinical Assessment Round');
  const [interviewType, setInterviewType] = useState<'Screening' | 'Technical' | 'Behavioral' | 'Managerial' | 'Executive'>('Technical');
  const [scheduledDateTime, setScheduledDateTime] = useState('2026-09-04T10:00');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [intRes, appRes] = await Promise.all([
        getApi<any>('/interviews').catch(() => []),
        getApi<PaginatedResult<Application>>('/applications?page=1&pageSize=50').catch(() => ({ data: [] })),
      ]);
      const intList = Array.isArray(intRes) ? intRes : intRes?.data || [];
      setApiInterviews(intList);

      const appList = appRes?.data || [];
      setApplications(appList);
      if (appList.length > 0 && !selectedAppId) {
        setSelectedAppId(appList[0].id);
      }
    } catch {
      // Ignore network errors
    }
  }, [selectedAppId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const interviewGroups: InterviewGroup[] = useMemo(() => {
    if (apiInterviews.length === 0) return DEFAULT_INTERVIEW_GROUPS;

    const dynamicItems = apiInterviews.map((int: any) => {
      const name = int.application?.candidate
        ? `${int.application.candidate.firstName} ${int.application.candidate.lastName}`
        : 'Candidate';
      const initials = name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 'CD';
      return {
        id: int.id,
        time: int.scheduledStart ? new Date(int.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '10:00 AM',
        duration: '45m',
        candidateName: name,
        candidateRole: int.application?.positionTitle || 'Clinical Specialist',
        candidateAvatar: initials,
        jobTitle: int.application?.positionTitle || 'Clinical Specialist',
        department: 'Medical Operations',
        typeTag: `${int.interviewType || 'Clinical'} Assessment`,
        typeTone: 'purple' as const,
        panel: 'Clinical Panel',
        mode: 'Teams',
        modeIcon: 'video' as const,
        interviewerName: 'Sarah Ahmed',
        interviewerAvatar: 'SA',
        statusBadge: int.status || 'Scheduled',
        statusTone: 'blue' as const,
      };
    });

    return [
      {
        dayTitle: 'Database Scheduled',
        daySubtitle: 'Live synced from recruitment database',
        countLabel: `${dynamicItems.length} interviews`,
        items: dynamicItems,
      },
      ...DEFAULT_INTERVIEW_GROUPS,
    ];
  }, [apiInterviews]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppId) {
      showToast('Please select a target application');
      return;
    }

    setIsSubmitting(true);
    try {
      const startDate = new Date(scheduledDateTime);
      const endDate = new Date(startDate.getTime() + 45 * 60000);

      await postApi('/interviews', {
        applicationId: selectedAppId,
        title: interviewTitle.trim() || 'Interview Round',
        interviewType,
        scheduledStart: startDate.toISOString(),
        scheduledEnd: endDate.toISOString(),
        timezone: 'Asia/Riyadh',
        locationUrl: 'https://teams.microsoft.com/l/meetup-join/sgh-interview',
      });

      showToast(`✓ Interview "${interviewTitle}" scheduled successfully in database!`);
      setIsScheduleModalOpen(false);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to schedule interview';
      showToast(`Notice: ${msg}`);
      setIsScheduleModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadgeClass = (tone: 'green' | 'amber' | 'blue') => {
    switch (tone) {
      case 'green':
        return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
      case 'amber':
        return 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
      case 'blue':
      default:
        return 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
    }
  };

  const getTypeTagClass = (tone: 'purple' | 'blue' | 'green') => {
    switch (tone) {
      case 'purple':
        return 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800';
      case 'blue':
        return 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
      case 'green':
      default:
        return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
    }
  };

  return (
    <div className="flex w-full flex-col p-4 sm:p-6 lg:p-7 max-w-[1720px] mx-auto space-y-6">
      {/* ── Page Header & Top Controls matching 09-interviews.png ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Interviews
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Manage and conduct interviews with candidates.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition shadow-xs cursor-pointer"
          >
            <Icon name="download" size={13} className="text-slate-400" />
            <span>Export</span>
          </button>

          <button
            type="button"
            onClick={() => setIsScheduleModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Icon name="plus" size={14} />
            <span>Schedule Interview</span>
          </button>
        </div>
      </div>

      {/* ── Filter Row ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Date range filter */}
        <div className="relative">
          <button
            type="button"
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 shadow-xs cursor-pointer"
          >
            <Icon name="calendar" size={13} className="text-slate-400" />
            <span>{dateRange}</span>
            <Icon name="chevron-down" size={12} className="text-slate-400" />
          </button>
        </div>

        {/* All interview types */}
        <div className="relative">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 pr-8 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer shadow-xs"
          >
            <option value="ALL">All Interview Types</option>
            <option value="Technical">Technical Interview</option>
            <option value="Panel">Panel Interview</option>
            <option value="HR">HR Interview</option>
          </select>
          <Icon name="chevron-down" size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {/* All interviewers */}
        <div className="relative">
          <select className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 pr-8 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer shadow-xs">
            <option value="ALL">All Interviewers</option>
            <option value="Sarah Ahmed">Sarah Ahmed</option>
            <option value="Ahmed Mostafa">Ahmed Mostafa</option>
            <option value="Sara Mohamed">Sara Mohamed</option>
          </select>
          <Icon name="chevron-down" size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {/* All statuses */}
        <div className="relative">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 pr-8 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer shadow-xs"
          >
            <option value="ALL">All Statuses</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Feedback Done">Feedback Done</option>
            <option value="Feedback Pending">Feedback Pending</option>
          </select>
          <Icon name="chevron-down" size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {/* More filters */}
        <button
          type="button"
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 shadow-xs cursor-pointer"
        >
          <Icon name="filter" size={13} className="text-slate-400" />
          <span>More filters</span>
        </button>
      </div>

      {/* ── Tabs & Sort Bar ── */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-6 text-xs font-semibold">
          <button
            type="button"
            onClick={() => navigate('/interviews/calendar')}
            className={`flex items-center gap-1.5 pb-2 transition cursor-pointer ${
              viewMode === 'calendar' ? 'text-blue-600 font-extrabold border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Icon name="calendar" size={14} />
            <span>Calendar</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 pb-2 transition cursor-pointer ${
              viewMode === 'list' ? 'text-blue-600 font-extrabold border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Icon name="menu" size={14} />
            <span>List</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium">Sort by:</span>
          <select className="bg-transparent border-none text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer focus:outline-none">
            <option value="Date">Date</option>
            <option value="Status">Status</option>
            <option value="Candidate">Candidate</option>
          </select>
        </div>
      </div>

      {/* ── Main Layout: Interview List (~72%) & Right Sidebar (~28%) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interview Day Groups (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {interviewGroups.map((group) => (
            <div key={group.dayTitle} className="space-y-3">
              {/* Day Section Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                    {group.dayTitle} <span className="font-normal text-slate-400">&bull; {group.daySubtitle}</span>
                  </h2>
                </div>
                <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                  {group.countLabel}
                </span>
              </div>

              {/* Interview Item Cards */}
              <div className="space-y-2.5">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => navigate(`/interviews/${item.id}`)}
                    className="p-3.5 sm:p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-blue-300 hover:shadow-md transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    {/* Time & Duration */}
                    <div className="w-16 sm:w-20 shrink-0">
                      <span className="block text-xs font-extrabold text-slate-900 dark:text-white leading-tight">
                        {item.time}
                      </span>
                      <span className="block text-[11px] text-slate-400 font-medium">
                        {item.duration}
                      </span>
                    </div>

                    {/* Candidate Avatar & Details */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 sm:flex-initial sm:w-44">
                      <div className="w-8 h-8 rounded-full bg-teal-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                        {item.candidateAvatar}
                      </div>
                      <div className="min-w-0">
                        <span className="block text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition truncate">
                          {item.candidateName}
                        </span>
                        <span className="block text-[10.5px] text-slate-400 truncate">
                          {item.candidateRole}
                        </span>
                      </div>
                    </div>

                    {/* Job Position & Department */}
                    <div className="min-w-0 flex-1 hidden xl:block">
                      <span className="block font-bold text-slate-800 dark:text-slate-200 truncate">
                        {item.jobTitle}
                      </span>
                      <span className="block text-[10.5px] text-slate-400 truncate">
                        {item.department}
                      </span>
                    </div>

                    {/* Type Tag & Mode */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold ${getTypeTagClass(item.typeTone)}`}>
                        {item.typeTag}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium hidden 2xl:inline">
                        {item.panel}
                      </span>
                    </div>

                    {/* Mode (Teams/Phone) */}
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium shrink-0 hidden md:flex">
                      <Icon name={item.modeIcon === 'phone' ? 'phone' : item.modeIcon === 'map-pin' ? 'map-pin' : 'video'} size={13} className="text-slate-400" />
                      <span>{item.mode}</span>
                    </div>

                    {/* Interviewer Host Avatar & Status Badge */}
                    <div className="flex items-center gap-2.5 shrink-0 ml-auto sm:ml-0">
                      <img
                        src={item.interviewerAvatar}
                        alt={item.interviewerName}
                        className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0 hidden sm:block"
                      />
                      <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold whitespace-nowrap shrink-0 ${getStatusBadgeClass(item.statusTone)}`}>
                        {item.statusBadge}
                      </span>
                      <Icon name="more-vertical" size={13} className="text-slate-300 group-hover:text-slate-600 shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Footer Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-400">
            <span>Showing 1 to 8 of 8 interviews</span>
            <button
              type="button"
              className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
            >
              Load more ▾
            </button>
          </div>
        </div>

        {/* Right Sidebar: Quick Stats & Actions (~28% / 4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Feedback Pending Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Feedback Pending
              </h2>
              <button type="button" className="text-xs font-bold text-blue-600 hover:underline">
                View all
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition">
                <div>
                  <span className="block font-bold text-slate-900 dark:text-white">Khaled Mostafa</span>
                  <span className="block text-[10.5px] text-slate-400">Panel Interview &bull; Backend Engineer</span>
                </div>
                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 font-bold text-xs flex items-center justify-center">3</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition">
                <div>
                  <span className="block font-bold text-slate-900 dark:text-white">Nourhan Sami</span>
                  <span className="block text-[10.5px] text-slate-400">HR Interview &bull; ICU Nurse</span>
                </div>
                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 font-bold text-xs flex items-center justify-center">1</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition">
                <div>
                  <span className="block font-bold text-slate-900 dark:text-white">Yousef Ahmed</span>
                  <span className="block text-[10.5px] text-slate-400">Technical Interview &bull; DevOps</span>
                </div>
                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 font-bold text-xs flex items-center justify-center">2</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition">
                <div>
                  <span className="block font-bold text-slate-900 dark:text-white">Lina Hassan</span>
                  <span className="block text-[10.5px] text-slate-400">HR Interview &bull; HR Partner</span>
                </div>
                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 font-bold text-xs flex items-center justify-center">1</span>
              </div>
            </div>
          </div>

          {/* Today's Interviews Summary Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Today&apos;s Interviews
              </h2>
              <button type="button" className="text-xs font-bold text-blue-600 hover:underline">
                View full day
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1">
                <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <Icon name="calendar" size={14} className="text-blue-500" /> Total Interviews
                </span>
                <span className="font-bold text-slate-900 dark:text-white">3</span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <Icon name="check-circle" size={14} className="text-emerald-500" /> Completed
                </span>
                <span className="font-bold text-slate-900 dark:text-white">1</span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <Icon name="clock" size={14} className="text-amber-500" /> Pending Feedback
                </span>
                <span className="font-bold text-slate-900 dark:text-white">2</span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <Icon name="users" size={14} className="text-purple-500" /> Interview Panels
                </span>
                <span className="font-bold text-slate-900 dark:text-white">2</span>
              </div>
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-2.5">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white mb-2">
              Quick Actions
            </h2>

            {[
              { label: 'Schedule Interview', sub: 'Plan a new interview', icon: 'calendar', tone: 'text-emerald-500' },
              { label: 'Interview Templates', sub: 'Manage templates', icon: 'file-text', tone: 'text-blue-500' },
              { label: 'Interview Types', sub: 'Manage interview types', icon: 'chat', tone: 'text-amber-500' },
              { label: 'Interview Feedback', sub: 'View and provide feedback', icon: 'award', tone: 'text-purple-500' },
              { label: 'Interview Guidelines', sub: 'Best practices & guidelines', icon: 'help', tone: 'text-blue-500' },
            ].map((action) => (
              <div
                key={action.label}
                onClick={() => setIsScheduleModalOpen(true)}
                className="p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5">
                  <Icon name={action.icon as any} size={15} className={action.tone} />
                  <div>
                    <span className="block text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition">
                      {action.label}
                    </span>
                    <span className="block text-[10px] text-slate-400">
                      {action.sub}
                    </span>
                  </div>
                </div>
                <Icon name="chevron-right" size={13} className="text-slate-300 group-hover:translate-x-0.5 transition" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Schedule Interview Modal */}
      <Modal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        title="Schedule New Interview"
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleScheduleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300">Target Application / Candidate</label>
            <select
              value={selectedAppId}
              onChange={(e) => setSelectedAppId(e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            >
              {applications.length > 0 ? (
                applications.map((app) => {
                  const name = app.candidate ? `${app.candidate.firstName} ${app.candidate.lastName}` : (app.applicationCode || 'Application');
                  return (
                    <option key={app.id} value={app.id}>
                      {name} — {app.positionTitle || app.vacancyCode || 'Role'}
                    </option>
                  );
                })
              ) : (
                <option value="">No applications found</option>
              )}
            </select>
          </div>

          <div>
            <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300">Interview Title</label>
            <input
              type="text"
              value={interviewTitle}
              onChange={(e) => setInterviewTitle(e.target.value)}
              placeholder="e.g. Clinical Assessment Panel"
              className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300">Interview Type</label>
            <select
              value={interviewType}
              onChange={(e) => setInterviewType(e.target.value as any)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            >
              <option value="Screening">Screening Round</option>
              <option value="Technical">Technical &amp; Clinical Peer Assessment</option>
              <option value="Behavioral">Behavioral / Leadership</option>
              <option value="Managerial">HOD / Managerial Round</option>
              <option value="Executive">Executive Hospital Board</option>
            </select>
          </div>

          <div>
            <label className="font-bold block mb-1 text-slate-700 dark:text-slate-300">Scheduled Date &amp; Time</label>
            <input
              type="datetime-local"
              value={scheduledDateTime}
              onChange={(e) => setScheduledDateTime(e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsScheduleModalOpen(false)}
              className="px-3 py-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedAppId}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold cursor-pointer transition disabled:opacity-50"
            >
              {isSubmitting ? 'Saving to DB...' : 'Schedule & Send Invite'}
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

export default InterviewsPage;
