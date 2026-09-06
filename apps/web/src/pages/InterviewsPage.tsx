import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getApi, postApi } from '../api/client';
import type { Interview, Application, PaginatedResult, VacancyDetailView } from '@recruitflow/contracts';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { PageState } from '../components/ui/PageState';
import { TableSkeleton } from '../components/ui/Skeleton';
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

export function InterviewsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const vacancyId = searchParams.get('vacancyId');
  const [currentVacancy, setCurrentVacancy] = useState<VacancyDetailView | null>(null);

  const [apiInterviews, setApiInterviews] = useState<Interview[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('list');
  const [dateRange, setDateRange] = useState('All Dates');
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedInterviewer, setSelectedInterviewer] = useState('ALL');
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Scheduling Form State
  const [selectedAppId, setSelectedAppId] = useState('');
  const [interviewTitle, setInterviewTitle] = useState('');
  const [interviewType, setInterviewType] = useState<'Screening' | 'Technical' | 'Behavioral' | 'Managerial' | 'Executive'>('Technical');
  const [scheduledDateTime, setScheduledDateTime] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      if (vacancyId) {
        const [intRes, appRes, vacRes] = await Promise.allSettled([
          getApi<any>('/interviews'),
          getApi<PaginatedResult<Application>>(`/applications?vacancyId=${vacancyId}&page=1&pageSize=100`),
          getApi<VacancyDetailView>(`/vacancies/${vacancyId}`),
        ]);

        const appList = appRes.status === 'fulfilled' && appRes.value?.data ? appRes.value.data : [];
        setApplications(appList);
        if (appList.length > 0 && !selectedAppId) {
          setSelectedAppId(appList[0].id);
        }

        if (vacRes.status === 'fulfilled' && vacRes.value) {
          setCurrentVacancy(vacRes.value);
        }

        const appIds = new Set(appList.map((a) => a.id));
        const allInts = intRes.status === 'fulfilled' ? (Array.isArray(intRes.value) ? intRes.value : (intRes.value as any)?.data || []) : [];
        const filteredInts = allInts.filter((int: any) => appIds.has(int.applicationId));
        setApiInterviews(filteredInts);
      } else {
        setCurrentVacancy(null);
        const [intRes, appRes] = await Promise.all([
          getApi<any>('/interviews').catch(() => []),
          getApi<PaginatedResult<Application>>('/applications?page=1&pageSize=50').catch(() => ({ data: [] })),
        ]);
        const intList = Array.isArray(intRes) ? intRes : (intRes as any)?.data || [];
        setApiInterviews(intList);

        const appList = appRes?.data || [];
        setApplications(appList);
        if (appList.length > 0 && !selectedAppId) {
          setSelectedAppId(appList[0].id);
        }
      }
    } catch {
      // Ignore network errors
    } finally {
      setIsLoading(false);
    }
  }, [selectedAppId, vacancyId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const interviewerOptions = useMemo(() => {
    const names = new Set<string>();
    apiInterviews.forEach((int: any) => {
      if (Array.isArray(int.attendees)) {
        int.attendees.forEach((att: any) => {
          if (att.userName && att.userName.trim()) {
            names.add(att.userName.trim());
          }
        });
      }
      if (Array.isArray(int.scorecards)) {
        int.scorecards.forEach((sc: any) => {
          if (sc.interviewerName && sc.interviewerName.trim()) {
            names.add(sc.interviewerName.trim());
          }
        });
      }
    });
    return Array.from(names).sort();
  }, [apiInterviews]);

  const interviewGroups: InterviewGroup[] = useMemo(() => {
    if (apiInterviews.length === 0) return [];

    const filtered = apiInterviews.filter((int: any) => {
      if (selectedType !== 'ALL') {
        const typeMatch = (int.interviewType || '').toLowerCase() === selectedType.toLowerCase();
        if (!typeMatch) return false;
      }
      if (selectedStatus !== 'ALL') {
        const hasScorecards = Array.isArray(int.scorecards) && int.scorecards.length > 0;
        const isPast = int.scheduledStart && new Date(int.scheduledStart) < new Date();
        let badge = int.status || 'Scheduled';
        if (int.status === 'Completed' || hasScorecards) badge = 'Feedback Done';
        else if (isPast) badge = 'Feedback Pending';

        if (badge !== selectedStatus && int.status !== selectedStatus) return false;
      }
      if (selectedInterviewer !== 'ALL') {
        const attendeeMatch = Array.isArray(int.attendees) && int.attendees.some((a: any) => a.userName === selectedInterviewer);
        const scorecardMatch = Array.isArray(int.scorecards) && int.scorecards.some((s: any) => s.interviewerName === selectedInterviewer);
        if (!attendeeMatch && !scorecardMatch) return false;
      }
      return true;
    });

    if (filtered.length === 0) return [];

    // Group items by calendar date
    const groupsMap = new Map<string, { dayTitle: string; daySubtitle: string; items: any[] }>();
    const now = new Date();
    const todayKey = now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKey = tomorrow.toDateString();

    filtered.forEach((int: any) => {
      const startDate = int.scheduledStart ? new Date(int.scheduledStart) : null;
      const dateKey = startDate ? startDate.toDateString() : 'Unscheduled';

      let dayTitle = 'Scheduled';
      let daySubtitle = 'Upcoming';
      if (startDate) {
        if (dateKey === todayKey) {
          dayTitle = 'Today';
          daySubtitle = startDate.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
        } else if (dateKey === tomorrowKey) {
          dayTitle = 'Tomorrow';
          daySubtitle = startDate.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
        } else {
          dayTitle = startDate.toLocaleDateString(undefined, { weekday: 'long' });
          daySubtitle = startDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
        }
      }

      if (!groupsMap.has(dateKey)) {
        groupsMap.set(dateKey, { dayTitle, daySubtitle, items: [] });
      }

      const name = int.candidateName || (int.application?.candidate
        ? `${int.application.candidate.firstName} ${int.application.candidate.lastName}`
        : 'Unknown candidate');
      const initials = name.split(' ').filter(Boolean).map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'UC';

      const durationMins = int.scheduledStart && int.scheduledEnd
        ? Math.round((new Date(int.scheduledEnd).getTime() - new Date(int.scheduledStart).getTime()) / 60000)
        : null;

      const primaryAttendee = (Array.isArray(int.attendees) && int.attendees.find((a: any) => a.userName)?.userName) ||
        (Array.isArray(int.scorecards) && int.scorecards[0]?.interviewerName) ||
        'Unassigned';
      const interviewerAvatar = primaryAttendee === 'Unassigned'
        ? '—'
        : primaryAttendee.split(' ').filter(Boolean).map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'IN';

      let mode = 'Remote';
      let modeIcon: 'video' | 'phone' | 'map-pin' = 'video';
      if (int.locationUrl) {
        const lowerLoc = int.locationUrl.toLowerCase();
        if (lowerLoc.includes('teams')) {
          mode = 'Teams';
          modeIcon = 'video';
        } else if (lowerLoc.includes('zoom')) {
          mode = 'Zoom';
          modeIcon = 'video';
        } else if (lowerLoc.includes('meet')) {
          mode = 'Google Meet';
          modeIcon = 'video';
        } else if (lowerLoc.includes('tel') || lowerLoc.includes('phone')) {
          mode = 'Phone';
          modeIcon = 'phone';
        } else if (int.locationUrl.startsWith('http')) {
          mode = 'Video Call';
          modeIcon = 'video';
        } else {
          mode = int.locationUrl;
          modeIcon = 'map-pin';
        }
      } else if (int.timezone) {
        mode = `Remote (${int.timezone})`;
      }

      const hasScorecards = Array.isArray(int.scorecards) && int.scorecards.length > 0;
      const isPast = int.scheduledStart && new Date(int.scheduledStart) < new Date();
      let statusBadge = int.status || 'Scheduled';
      let statusTone: 'green' | 'amber' | 'blue' = 'blue';

      if (int.status === 'Completed' || hasScorecards) {
        statusBadge = 'Feedback Done';
        statusTone = 'green';
      } else if (isPast) {
        statusBadge = 'Feedback Pending';
        statusTone = 'amber';
      }

      const panelCount = Array.isArray(int.attendees) ? int.attendees.length : 0;
      const panelLabel = panelCount > 1 ? `Panel (${panelCount})` : primaryAttendee;

      groupsMap.get(dateKey)!.items.push({
        id: int.id,
        time: int.scheduledStart ? new Date(int.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
        duration: durationMins && durationMins > 0 ? `${durationMins}m` : '—',
        candidateName: name,
        candidateRole: int.positionTitle || 'No position',
        candidateAvatar: initials,
        jobTitle: int.positionTitle || 'No position',
        department: int.department || '—',
        typeTag: `${int.interviewType || 'General'} Interview`,
        typeTone: int.interviewType === 'Technical' ? 'purple' : int.interviewType === 'Behavioral' || int.interviewType === 'HR' ? 'green' : 'blue',
        panel: panelLabel,
        mode,
        modeIcon,
        interviewerName: primaryAttendee,
        interviewerAvatar,
        statusBadge,
        statusTone,
      });
    });

    return Array.from(groupsMap.values()).map((grp) => ({
      dayTitle: grp.dayTitle,
      daySubtitle: grp.daySubtitle,
      countLabel: `${grp.items.length} interview${grp.items.length !== 1 ? 's' : ''}`,
      items: grp.items,
    }));
  }, [apiInterviews, selectedType, selectedStatus, selectedInterviewer]);

  const totalFilteredCount = useMemo(() => {
    return interviewGroups.reduce((acc, grp) => acc + grp.items.length, 0);
  }, [interviewGroups]);

  const pendingFeedbackInterviews = useMemo(() => {
    return apiInterviews.filter((int: any) => {
      const isPast = int.scheduledStart && new Date(int.scheduledStart) < new Date();
      const hasScorecards = Array.isArray(int.scorecards) && int.scorecards.length > 0;
      return (int.status === 'Scheduled' && isPast) || (!hasScorecards && int.status !== 'Cancelled');
    });
  }, [apiInterviews]);

  const totalInterviews = apiInterviews.length;
  const completedCount = useMemo(() => {
    return apiInterviews.filter((i: any) => i.status === 'Completed' || (Array.isArray(i.scorecards) && i.scorecards.length > 0)).length;
  }, [apiInterviews]);
  const panelsCount = useMemo(() => {
    return apiInterviews.filter((i: any) => Array.isArray(i.attendees) && i.attendees.length > 1).length;
  }, [apiInterviews]);

  const handleExportCsv = () => {
    if (interviewGroups.length === 0) {
      showToast('No interviews to export.');
      return;
    }
    const headers = ['Candidate', 'Position', 'Type', 'Time', 'Interviewer', 'Status'];
    const rows: string[][] = [];
    interviewGroups.forEach((s) => {
      s.items.forEach((inv) => {
        rows.push([
          `"${inv.candidateName}"`,
          `"${inv.jobTitle}"`,
          `"${inv.typeTag}"`,
          `"${s.dayTitle} ${inv.time}"`,
          `"${inv.interviewerName}"`,
          `"${inv.statusBadge}"`,
        ]);
      });
    });
    const blob = new Blob([[headers.join(','), ...rows.map((r) => r.join(','))].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `interviews-schedule-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('✓ Interview schedule exported to CSV!');
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

      const resolvedTitle = interviewTitle.trim() || `${interviewType} Interview Round`;
      await postApi('/interviews', {
        applicationId: selectedAppId,
        title: resolvedTitle,
        interviewType,
        scheduledStart: startDate.toISOString(),
        scheduledEnd: endDate.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      });

      showToast(`✓ Interview "${resolvedTitle}" scheduled successfully!`);
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
            onClick={handleExportCsv}
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

      {/* Position Context Banner (E7.2) */}
      {currentVacancy && (
        <div className="bg-gradient-to-r from-blue-50 via-indigo-50/40 to-slate-50 dark:from-blue-950/40 dark:via-indigo-950/20 dark:to-slate-900 rounded-2xl border border-blue-200/80 dark:border-blue-900/60 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-600 text-white shadow-2xs">
                <Icon name="lock" size={10} />
                Position Interviews
              </span>
              <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                {currentVacancy.vacancyCode}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                {currentVacancy.status}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {currentVacancy.position?.title || currentVacancy.title || 'Job Position'}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              {(currentVacancy as unknown as { department?: string })?.department || currentVacancy.branch?.name || 'Department'} &bull;{' '}
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {apiInterviews.length} interview{apiInterviews.length === 1 ? '' : 's'} scheduled
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate(`/vacancies/${currentVacancy.id}`)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition shadow-xs cursor-pointer"
            >
              <Icon name="arrow-left" size={13} />
              <span>Back to Overview</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/interviews')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
              title="View all interviews across all vacancies"
            >
              <span>View All Interviews</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Filter Row ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Date range filter */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setDateRange((prev) => prev === 'All Dates' ? 'Today' : prev === 'Today' ? 'Upcoming' : 'All Dates')}
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
            <option value="Screening">Screening Round</option>
            <option value="Technical">Technical Interview</option>
            <option value="Behavioral">Behavioral / Leadership</option>
            <option value="Managerial">Managerial Round</option>
            <option value="Executive">Executive Board</option>
          </select>
          <Icon name="chevron-down" size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {/* All interviewers */}
        <div className="relative">
          <select
            value={selectedInterviewer}
            onChange={(e) => setSelectedInterviewer(e.target.value)}
            className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 pr-8 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer shadow-xs"
          >
            <option value="ALL">All Interviewers</option>
            {interviewerOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
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
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <Icon name="chevron-down" size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {/* More filters */}
        <button
          type="button"
          onClick={() => setIsMoreFiltersOpen((prev) => !prev)}
          className={`inline-flex items-center gap-2 px-3.5 py-2 border rounded-xl text-xs font-semibold transition shadow-xs cursor-pointer ${
            isMoreFiltersOpen
              ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50'
          }`}
        >
          <Icon name="filter" size={13} className="text-slate-400" />
          <span>{isMoreFiltersOpen ? 'Hide filters' : 'More filters'}</span>
        </button>
      </div>

      {/* Expandable filters */}
      {isMoreFiltersOpen && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-xs">
          <span className="font-bold text-slate-500">Quick Filters:</span>
          <button
            type="button"
            onClick={() => setSelectedStatus('Feedback Pending')}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-amber-700 dark:text-amber-400 cursor-pointer"
          >
            Feedback Pending
          </button>
          <button
            type="button"
            onClick={() => setSelectedType('Technical')}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-blue-600 dark:text-blue-400 cursor-pointer"
          >
            Technical Rounds
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedType('ALL');
              setSelectedStatus('ALL');
              setSelectedInterviewer('ALL');
              setDateRange('All Dates');
            }}
            className="ml-auto text-xs font-bold text-slate-500 hover:text-rose-600 cursor-pointer"
          >
            Reset All
          </button>
        </div>
      )}

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
          {isLoading ? (
            <TableSkeleton columns={5} rows={4} />
          ) : interviewGroups.length === 0 ? (
            <PageState
              kind="empty"
              title="No interviews scheduled"
              description={
                apiInterviews.length === 0
                  ? "There are no scheduled interviews yet."
                  : "No interviews match your selected filters."
              }
              actionLabel={apiInterviews.length === 0 ? "Schedule Interview" : "Reset Filters"}
              onAction={() => {
                if (apiInterviews.length === 0) {
                  setIsScheduleModalOpen(true);
                } else {
                  setSelectedType('ALL');
                  setSelectedStatus('ALL');
                  setSelectedInterviewer('ALL');
                }
              }}
            />
          ) : (
            <>
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
                          {item.interviewerAvatar && item.interviewerAvatar.startsWith('http') ? (
                            <img
                              src={item.interviewerAvatar}
                              alt={item.interviewerName}
                              className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0 hidden sm:block"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[10px] flex items-center justify-center border border-slate-200 dark:border-slate-700 shrink-0 hidden sm:flex">
                              {item.interviewerAvatar}
                            </div>
                          )}
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
                <span>Showing {totalFilteredCount} of {apiInterviews.length} interviews</span>
              </div>
            </>
          )}
        </div>

        {/* Right Sidebar: Quick Stats & Actions (~28% / 4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Feedback Pending Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Feedback Pending
              </h2>
              {pendingFeedbackInterviews.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedStatus('Feedback Pending')}
                  className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  View all
                </button>
              )}
            </div>

            <div className="space-y-2.5 text-xs">
              {pendingFeedbackInterviews.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">No pending feedback.</p>
              ) : (
                pendingFeedbackInterviews.slice(0, 4).map((int: any) => {
                  const name = int.candidateName || (int.application?.candidate ? `${int.application.candidate.firstName} ${int.application.candidate.lastName}` : 'Unknown candidate');
                  const role = int.positionTitle || 'No position';
                  const pendingCount = Math.max(1, (int.attendees?.length || 1) - (int.scorecards?.length || 0));
                  return (
                    <div
                      key={int.id}
                      onClick={() => navigate(`/interviews/${int.id}`)}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition cursor-pointer"
                    >
                      <div>
                        <span className="block font-bold text-slate-900 dark:text-white">{name}</span>
                        <span className="block text-[10.5px] text-slate-400">{int.interviewType || 'Interview'} &bull; {role}</span>
                      </div>
                      <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 font-bold text-xs flex items-center justify-center">
                        {pendingCount}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Today's Interviews Summary Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Interview Summary
              </h2>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1">
                <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <Icon name="calendar" size={14} className="text-blue-500" /> Total Interviews
                </span>
                <span className="font-bold text-slate-900 dark:text-white">{totalInterviews}</span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <Icon name="check-circle" size={14} className="text-emerald-500" /> Completed / Evaluated
                </span>
                <span className="font-bold text-slate-900 dark:text-white">{completedCount}</span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <Icon name="clock" size={14} className="text-amber-500" /> Pending Feedback
                </span>
                <span className="font-bold text-slate-900 dark:text-white">{pendingFeedbackInterviews.length}</span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <Icon name="users" size={14} className="text-purple-500" /> Interview Panels
                </span>
                <span className="font-bold text-slate-900 dark:text-white">{panelsCount}</span>
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
              { label: 'Interview Templates', sub: 'Manage templates', icon: 'document', tone: 'text-blue-500' },
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
