import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  FileText,
  LayoutList,
  MapPin,
  MoreVertical,
  Plus,
  Search,
  SlidersHorizontal,
  Star,
  UserCheck,
  Users,
  Video,
} from 'lucide-react';
import type { Application, Interview, PaginatedResult } from '@recruitflow/contracts';
import { getApi } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { FastScorecardModal } from '../components/interview/FastScorecardModal';
import {
  InterviewScheduleDrawerV2,
  type InterviewScheduleCandidateOption,
  type InterviewScheduleInitialValues,
} from '../v2/drawers/InterviewScheduleDrawerV2';
import '../v2/pages/interviews-v2.css';

interface PanelMemberBadge {
  initials: string;
  name: string;
  role: string;
  tone: 'green' | 'indigo' | 'purple' | 'blue' | 'more';
}

interface DeskInterviewRow {
  id: string;
  candidateId: string;
  time: string;
  durationLabel: string;
  dayLabel: 'Today' | 'Tomorrow' | 'This week';
  weekDayId: 'mon' | 'tue' | 'wed' | 'thu' | 'fri';
  hourSlot: number;
  fullDateLabel: string;
  timeRangeLabel: string;
  candidateName: string;
  candidateRole: string;
  avatarInitials: string;
  avatarTone: 'blue' | 'sky' | 'indigo' | 'green' | 'rose' | 'cyan';
  jobTitle: string;
  site: string;
  format: 'Video call' | 'On-site';
  formatShort: string;
  platformDetail: string;
  meetingUrl?: string;
  panelBadges: PanelMemberBadge[];
  panelSummary: string;
  statusLabel: 'Interview today' | 'Awaiting feedback' | 'Scheduled' | 'Completed';
  statusTone: 'today' | 'awaiting' | 'scheduled' | 'completed';
  actionLabel: 'Open' | 'View details';
}

const DEFAULT_DESK_INTERVIEWS: DeskInterviewRow[] = [
  {
    id: 'int-v2-1',
    candidateId: 'cnd-me-1',
    time: '10:00 AM',
    durationLabel: '45m',
    dayLabel: 'Today',
    weekDayId: 'wed',
    hourSlot: 10,
    fullDateLabel: 'Today, 29 Oct 2026',
    timeRangeLabel: '10:00 AM – 10:45 AM (45 mins)',
    candidateName: 'Mariam Essam',
    candidateRole: 'Medical Coder',
    avatarInitials: 'ME',
    avatarTone: 'blue',
    jobTitle: 'Medical Coder',
    site: 'SGH Dubai Hospital',
    format: 'Video call',
    formatShort: 'Video · Teams',
    platformDetail: 'Video call (Microsoft Teams)',
    meetingUrl: 'https://teams.microsoft.com/l/meetup-join/sgh-interview-1',
    panelBadges: [
      { initials: 'SA', name: 'Sarah Ahmed', role: 'Recruiter', tone: 'green' },
      { initials: 'NA', name: 'Nour Ali', role: 'Hiring Manager', tone: 'indigo' },
      { initials: '+1', name: 'Dr. Hany Adel', role: 'HIM Lead', tone: 'more' },
    ],
    panelSummary: 'Sarah Ahmed (Recruiter), Nour Ali (Hiring Manager), Dr. Hany Adel (HIM Lead)',
    statusLabel: 'Interview today',
    statusTone: 'today',
    actionLabel: 'Open',
  },
  {
    id: 'int-v2-2',
    candidateId: 'cnd-kf-2',
    time: '11:30 AM',
    durationLabel: '45m',
    dayLabel: 'Today',
    weekDayId: 'wed',
    hourSlot: 11,
    fullDateLabel: 'Today, 29 Oct 2026',
    timeRangeLabel: '11:30 AM – 12:15 PM (45 mins)',
    candidateName: 'Kareem Fathy',
    candidateRole: 'IT Support Specialist',
    avatarInitials: 'KF',
    avatarTone: 'sky',
    jobTitle: 'IT Support Specialist',
    site: 'SGH Ajman Hospital',
    format: 'On-site',
    formatShort: 'On-site · Room 204',
    platformDetail: 'On-site (SGH Ajman · Building B, Room 204)',
    panelBadges: [
      { initials: 'SA', name: 'Sarah Ahmed', role: 'Recruiter', tone: 'green' },
      { initials: 'MW', name: 'Mai Wahba', role: 'IT Lead', tone: 'purple' },
    ],
    panelSummary: 'Sarah Ahmed (Recruiter), Mai Wahba (IT Operations Lead)',
    statusLabel: 'Interview today',
    statusTone: 'today',
    actionLabel: 'Open',
  },
  {
    id: 'int-v2-3',
    candidateId: 'cnd-oh-3',
    time: '2:00 PM',
    durationLabel: '60m',
    dayLabel: 'Today',
    weekDayId: 'wed',
    hourSlot: 14,
    fullDateLabel: 'Today, 29 Oct 2026',
    timeRangeLabel: '2:00 PM – 3:00 PM (1 hour)',
    candidateName: 'Omar Hassan',
    candidateRole: 'Radiology Technician',
    avatarInitials: 'OH',
    avatarTone: 'indigo',
    jobTitle: 'Radiology Technician',
    site: 'SGH Dubai Hospital',
    format: 'Video call',
    formatShort: 'Video · Teams',
    platformDetail: 'Video call (Microsoft Teams)',
    meetingUrl: 'https://teams.microsoft.com/l/meetup-join/sgh-interview-3',
    panelBadges: [
      { initials: 'SA', name: 'Sarah Ahmed', role: 'Recruiter', tone: 'green' },
      { initials: 'NA', name: 'Nour Ali', role: 'Hiring Manager', tone: 'indigo' },
      { initials: '+1', name: 'Mariam Essam', role: 'Radiology Lead', tone: 'more' },
    ],
    panelSummary: 'Sarah Ahmed (Recruiter), Nour Ali (Hiring Manager), Mariam Essam (Radiology Lead)',
    statusLabel: 'Awaiting feedback',
    statusTone: 'awaiting',
    actionLabel: 'View details',
  },
  {
    id: 'int-v2-4',
    candidateId: 'cnd-sa-4',
    time: '3:30 PM',
    durationLabel: '45m',
    dayLabel: 'Today',
    weekDayId: 'wed',
    hourSlot: 15,
    fullDateLabel: 'Today, 29 Oct 2026',
    timeRangeLabel: '3:30 PM – 4:15 PM (45 mins)',
    candidateName: 'Sara Ahmed',
    candidateRole: 'Registered Nurse',
    avatarInitials: 'SA',
    avatarTone: 'green',
    jobTitle: 'Registered Nurse',
    site: 'SGH Dubai Hospital',
    format: 'On-site',
    formatShort: 'On-site · Wing B',
    platformDetail: 'On-site (SGH Dubai · Nursing Wing, Room 112)',
    panelBadges: [
      { initials: 'NA', name: 'Nour Ali', role: 'Hiring Manager', tone: 'indigo' },
      { initials: 'ME', name: 'Mariam Essam', role: 'Clinical Educator', tone: 'blue' },
    ],
    panelSummary: 'Nour Ali (Hiring Manager), Mariam Essam (Clinical Educator)',
    statusLabel: 'Scheduled',
    statusTone: 'scheduled',
    actionLabel: 'Open',
  },
  {
    id: 'int-v2-5',
    candidateId: 'cnd-hs-5',
    time: '10:00 AM',
    durationLabel: '60m',
    dayLabel: 'Tomorrow',
    weekDayId: 'thu',
    hourSlot: 10,
    fullDateLabel: 'Tomorrow, 30 Oct 2026',
    timeRangeLabel: '10:00 AM – 11:00 AM (1 hour)',
    candidateName: 'Heba Salah',
    candidateRole: 'Registered Nurse (ICU)',
    avatarInitials: 'HS',
    avatarTone: 'rose',
    jobTitle: 'Registered Nurse (ICU)',
    site: 'SGH Dubai Hospital',
    format: 'Video call',
    formatShort: 'Video · Teams',
    platformDetail: 'Video call (Microsoft Teams)',
    meetingUrl: 'https://teams.microsoft.com/l/meetup-join/sgh-interview-5',
    panelBadges: [
      { initials: 'SA', name: 'Sarah Ahmed', role: 'Recruiter', tone: 'green' },
      { initials: 'ME', name: 'Mariam Essam', role: 'ICU Head Nurse', tone: 'blue' },
    ],
    panelSummary: 'Sarah Ahmed (Recruiter), Mariam Essam (ICU Head Nurse)',
    statusLabel: 'Scheduled',
    statusTone: 'scheduled',
    actionLabel: 'Open',
  },
  {
    id: 'int-v2-6',
    candidateId: 'cnd-ym-6',
    time: '1:00 PM',
    durationLabel: '45m',
    dayLabel: 'Tomorrow',
    weekDayId: 'thu',
    hourSlot: 13,
    fullDateLabel: 'Tomorrow, 30 Oct 2026',
    timeRangeLabel: '1:00 PM – 1:45 PM (45 mins)',
    candidateName: 'Yousef Magdy',
    candidateRole: 'Radiology Technician',
    avatarInitials: 'YM',
    avatarTone: 'cyan',
    jobTitle: 'Radiology Technician',
    site: 'SGH Ajman Hospital',
    format: 'On-site',
    formatShort: 'On-site · Diagnostics',
    platformDetail: 'On-site (SGH Ajman · Diagnostics Center)',
    panelBadges: [
      { initials: 'SA', name: 'Sarah Ahmed', role: 'Recruiter', tone: 'green' },
      { initials: 'NA', name: 'Nour Ali', role: 'Hiring Manager', tone: 'indigo' },
    ],
    panelSummary: 'Sarah Ahmed (Recruiter), Nour Ali (Hiring Manager)',
    statusLabel: 'Completed',
    statusTone: 'completed',
    actionLabel: 'View details',
  },
];

const WEEK_DAYS = [
  {
    id: 'mon',
    day: 'Mon',
    date: '26 Oct',
    count: 2,
    unit: 'interviews',
    slots: [
      { time: '10:30', name: 'Laila M.', rowId: 'int-v2-1' },
      { time: '14:00', name: 'Tarek S.', rowId: 'int-v2-2' },
    ],
  },
  {
    id: 'tue',
    day: 'Tue',
    date: '27 Oct',
    count: 3,
    unit: 'interviews',
    slots: [
      { time: '09:30', name: 'Nadia K.', rowId: 'int-v2-1' },
      { time: '11:30', name: 'Rami A.', rowId: 'int-v2-2' },
      { time: '15:00', name: 'Salma H.', rowId: 'int-v2-4' },
    ],
  },
  {
    id: 'wed',
    day: 'Wed',
    date: '28 Oct',
    count: 4,
    unit: 'interviews',
    slots: [
      { time: '10:00', name: 'Mariam E.', rowId: 'int-v2-1' },
      { time: '11:30', name: 'Kareem F.', rowId: 'int-v2-2' },
      { time: '14:00', name: 'Omar H.', rowId: 'int-v2-3' },
    ],
  },
  {
    id: 'thu',
    day: 'Thu',
    date: '29 Oct',
    count: 2,
    unit: 'interviews',
    slots: [
      { time: '10:00', name: 'Heba S.', rowId: 'int-v2-5' },
      { time: '13:00', name: 'Yousef M.', rowId: 'int-v2-6' },
    ],
  },
  {
    id: 'fri',
    day: 'Fri',
    date: '30 Oct',
    count: 1,
    unit: 'interview',
    slots: [{ time: '11:00', name: 'Dina R.', rowId: 'int-v2-4' }],
  },
];

const CALENDAR_HOURS = [
  { hour: 9, label: '09:00 AM' },
  { hour: 10, label: '10:00 AM' },
  { hour: 11, label: '11:00 AM' },
  { hour: 12, label: '12:00 PM' },
  { hour: 13, label: '01:00 PM' },
  { hour: 14, label: '02:00 PM' },
  { hour: 15, label: '03:00 PM' },
];

function SparkBars({
  tone,
  heights,
  strongIndex,
}: {
  tone: 'blue' | 'green' | 'amber' | 'purple';
  heights: number[];
  strongIndex: number;
}) {
  return (
    <span className="rf2-intv__sparkbars" data-tone={tone} aria-hidden="true">
      {heights.map((h, i) => (
        <span
          key={i}
          className="rf2-intv__sparkbar"
          data-strong={i === strongIndex || i === strongIndex - 1 ? 'true' : undefined}
          style={{ height: `${h}px` }}
        />
      ))}
    </span>
  );
}

export function InterviewsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [apiInterviews, setApiInterviews] = useState<Interview[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedId, setSelectedId] = useState<string>('int-v2-3');
  const [activeWeekDay, setActiveWeekDay] = useState<string>('wed');
  const [viewMode, setViewMode] = useState<'desk' | 'calendar'>('desk');
  const [statusTab, setStatusTab] = useState<'ALL' | 'today' | 'awaiting' | 'completed'>('ALL');
  const [checkedRows, setCheckedRows] = useState<Record<string, boolean>>({});
  const [prepItems, setPrepItems] = useState([
    { id: 'resume', label: 'Resume & clinical credentials reviewed', done: true },
    { id: 'scorecard', label: 'Competency scorecard template ready', done: true },
    { id: 'hm', label: 'Hiring manager & panel confirmed', done: true },
    { id: 'feedback', label: 'Final evaluation form prepared', done: false },
  ]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'Today' | 'Tomorrow'>('ALL');
  const [formatFilter, setFormatFilter] = useState<'ALL' | 'Video call' | 'On-site'>('ALL');
  const [siteFilter, setSiteFilter] = useState<string>('ALL');

  // Drawer & Modals
  const [drawerOpen, setDrawerOpen] = useState(() => searchParams.get('create') === '1');
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [scorecardInterview, setScorecardInterview] = useState<Interview | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = useCallback(async () => {
    try {
      const [intRes, appRes] = await Promise.all([
        getApi<Interview[] | { data?: Interview[] }>('/interviews').catch((): Interview[] => []),
        getApi<PaginatedResult<Application>>('/applications?page=1&pageSize=50').catch(() => ({ data: [] })),
      ]);
      const intList = Array.isArray(intRes) ? intRes : intRes?.data || [];
      setApiInterviews(intList);

      const appList = appRes?.data || [];
      setApplications(appList);
    } catch {
      // Fallback to default clinical schedule
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const allRows: DeskInterviewRow[] = useMemo(() => {
    const tones: DeskInterviewRow['avatarTone'][] = ['blue', 'sky', 'indigo', 'green', 'rose', 'cyan'];
    const existingNames = new Set(DEFAULT_DESK_INTERVIEWS.map((d) => d.candidateName.toLowerCase()));
    const daytimeApi = apiInterviews.filter((iv) => {
      if (!iv.scheduledStart) return false;
      const h = new Date(iv.scheduledStart).getHours();
      return h >= 8 && h <= 17 && !existingNames.has((iv.candidateName || '').toLowerCase());
    });
    const apiMapped: DeskInterviewRow[] = daytimeApi.map((iv, idx) => {
      const name = iv.candidateName || 'Candidate';
      const initials =
        name
          .split(' ')
          .filter(Boolean)
          .map((p) => p[0])
          .join('')
          .slice(0, 2)
          .toUpperCase() || 'CN';
      const dt = iv.scheduledStart ? new Date(iv.scheduledStart) : new Date();
      const timeStr = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      const isVideo = Boolean(iv.locationUrl && iv.locationUrl.startsWith('http'));
      return {
        id: iv.id,
        candidateId: iv.applicationId || `cnd-${idx}`,
        time: timeStr,
        durationLabel: '45m',
        dayLabel: 'Today',
        weekDayId: 'wed',
        hourSlot: dt.getHours() || 11,
        fullDateLabel: dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
        timeRangeLabel: `${timeStr} (45 mins)`,
        candidateName: name,
        candidateRole: iv.positionTitle || 'Clinical Specialist',
        avatarInitials: initials,
        avatarTone: tones[idx % tones.length],
        jobTitle: iv.positionTitle || 'Clinical Specialist',
        site: 'SGH Dubai Hospital',
        format: isVideo ? 'Video call' : 'On-site',
        formatShort: isVideo ? 'Video · Teams' : 'On-site',
        platformDetail: isVideo ? 'Video call (Microsoft Teams)' : iv.roomName || 'On-site (SGH Dubai Hospital)',
        meetingUrl: iv.locationUrl || undefined,
        panelBadges: [
          { initials: 'SA', name: user?.displayName || 'Sarah Ahmed', role: 'Recruiter', tone: 'green' },
          { initials: 'NA', name: 'Nour Ali', role: 'Hiring Manager', tone: 'indigo' },
        ],
        panelSummary: `${user?.displayName || 'Sarah Ahmed'} (Recruiter), Nour Ali (Hiring Manager)`,
        statusLabel: iv.status === 'Completed' ? 'Completed' : 'Scheduled',
        statusTone: iv.status === 'Completed' ? 'completed' : 'scheduled',
        actionLabel: 'Open',
      };
    });

    return [...DEFAULT_DESK_INTERVIEWS, ...apiMapped];
  }, [apiInterviews, user?.displayName]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allRows.filter((r) => {
      if (statusTab === 'today' && r.dayLabel !== 'Today') return false;
      if (statusTab === 'awaiting' && r.statusTone !== 'awaiting') return false;
      if (statusTab === 'completed' && r.statusTone !== 'completed') return false;
      if (dateFilter !== 'ALL' && r.dayLabel !== dateFilter) return false;
      if (formatFilter !== 'ALL' && r.format !== formatFilter) return false;
      if (siteFilter !== 'ALL' && !r.site.toLowerCase().includes(siteFilter.toLowerCase()) && !r.panelSummary.toLowerCase().includes(siteFilter.toLowerCase())) {
        return false;
      }
      if (q && !`${r.candidateName} ${r.candidateRole} ${r.jobTitle} ${r.site}`.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [allRows, dateFilter, formatFilter, searchQuery, siteFilter, statusTab]);

  const selectedInterview = useMemo(() => {
    return allRows.find((r) => r.id === selectedId) ?? filteredRows[0] ?? DEFAULT_DESK_INTERVIEWS[2];
  }, [allRows, filteredRows, selectedId]);

  const completedPrepCount = prepItems.filter((p) => p.done).length;
  const prepPercent = Math.round((completedPrepCount / prepItems.length) * 100);

  const hasActiveFilters =
    statusTab !== 'ALL' ||
    dateFilter !== 'ALL' ||
    formatFilter !== 'ALL' ||
    siteFilter !== 'ALL' ||
    searchQuery.trim().length > 0;

  const resetFilters = () => {
    setStatusTab('ALL');
    setDateFilter('ALL');
    setFormatFilter('ALL');
    setSiteFilter('ALL');
    setSearchQuery('');
  };

  const openScorecardForRow = (row: DeskInterviewRow) => {
    const matchingApi = apiInterviews.find((iv) => iv.id === row.id);
    if (matchingApi) {
      setScorecardInterview(matchingApi);
      return;
    }
    setScorecardInterview({
      id: row.id,
      organizationId: 'org-sgh',
      applicationId: row.candidateId,
      interviewType: 'Technical',
      status: 'Scheduled',
      scheduledStart: new Date().toISOString(),
      scheduledEnd: new Date(Date.now() + 45 * 60000).toISOString(),
      timezone: 'Asia/Dubai',
      candidateName: row.candidateName,
      positionTitle: row.jobTitle,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Interview);
  };

  const openCreateDrawer = () => {
    setDrawerMode('create');
    setDrawerOpen(true);
  };

  const openEditDrawer = () => {
    setDrawerMode('edit');
    setDrawerOpen(true);
  };

  const candidateOptions: InterviewScheduleCandidateOption[] = useMemo(() => {
    if (applications.length > 0) {
      return applications.map((app) => ({
        applicationId: app.id,
        candidateName: app.candidate
          ? `${app.candidate.firstName} ${app.candidate.lastName}`
          : app.applicationCode || 'Candidate',
        positionTitle: app.positionTitle || app.vacancyCode || 'Clinical Specialist',
        screenNoteSaved: app.stage !== 'Applied',
      }));
    }
    return allRows.map((r) => ({
      applicationId: r.candidateId,
      candidateName: r.candidateName,
      positionTitle: r.jobTitle,
      screenNoteSaved: r.statusTone !== 'today' || r.candidateName !== 'Kareem Fathy',
    }));
  }, [allRows, applications]);

  const drawerInitialValues: InterviewScheduleInitialValues = useMemo(() => {
    if (drawerMode === 'edit') {
      return {
        interviewId: selectedInterview.id,
        applicationId: selectedInterview.candidateId,
        candidateName: selectedInterview.candidateName,
        positionTitle: selectedInterview.jobTitle,
        interviewType: 'Technical',
        date: '2026-10-29',
        time: `${String(selectedInterview.hourSlot).padStart(2, '0')}:00`,
        duration: selectedInterview.durationLabel.replace('m', '') || '60',
        roomUrl:
          selectedInterview.meetingUrl ||
          'https://teams.microsoft.com/l/meetup-join/sgh-interview',
        interviewers: selectedInterview.panelBadges
          .filter((b) => b.tone !== 'more')
          .map((b, i) => ({
            id: `u-panel-${i}`,
            name: b.name,
            detail: b.role,
          })),
        screenNoteSaved: true,
      };
    }
    return {
      applicationId: selectedInterview.candidateId,
      candidateName: selectedInterview.candidateName,
      positionTitle: selectedInterview.jobTitle,
      interviewType: 'Technical',
      date: '',
      time: '10:00',
      duration: '60',
      roomUrl: '',
      interviewers: [],
      screenNoteSaved: false,
    };
  }, [drawerMode, selectedInterview]);

  const counts = useMemo(() => {
    return {
      all: allRows.length,
      today: allRows.filter((r) => r.dayLabel === 'Today').length,
      awaiting: allRows.filter((r) => r.statusTone === 'awaiting').length,
      completed: allRows.filter((r) => r.statusTone === 'completed').length,
    };
  }, [allRows]);

  return (
    <div className="rf2-intv">
      {/* ── Page Header ── */}
      <header className="rf2-intv__hero">
        <div className="rf2-intv__hero-copy">
          <div className="rf2-intv__hero-title-row">
            <h2 className="rf2-intv__hero-title">Interviews</h2>
            <span className="rf2-intv__hero-badge">
              <span className="rf2-intv__hero-badge-dot" aria-hidden="true" />
              4 today · 3 awaiting feedback
            </span>
          </div>
          <p className="rf2-intv__hero-sub">
            Manage upcoming interviews, panel assignments, candidate scorecards, and weekly schedules.
          </p>
        </div>

        <div className="rf2-intv__hero-actions">
          <div className="rf2-intv__view-switch" role="group" aria-label="View mode">
            <button
              type="button"
              className="rf2-intv__view-btn"
              data-active={viewMode === 'desk' ? 'true' : undefined}
              onClick={() => setViewMode('desk')}
            >
              <LayoutList aria-hidden="true" />
              <span>Desk &amp; List</span>
            </button>
            <button
              type="button"
              className="rf2-intv__view-btn"
              data-active={viewMode === 'calendar' ? 'true' : undefined}
              onClick={() => setViewMode('calendar')}
            >
              <Calendar aria-hidden="true" />
              <span>Week Calendar</span>
            </button>
          </div>

          <Link to="/interviews/calendar" className="rf2-intv__cal-btn">
            <Calendar aria-hidden="true" />
            <span>Full calendar</span>
          </Link>

          <button
            type="button"
            className="rf2-intv__sched-btn"
            onClick={openCreateDrawer}
          >
            <Plus aria-hidden="true" />
            <span>Schedule interview</span>
          </button>
        </div>
      </header>

      {/* ── 4 Interactive KPI Filter Cards ── */}
      <section className="rf2-intv__kpis" aria-label="Interviews summary">
        <div
          className="rf2-intv__kpi"
          data-tone="blue"
          data-active={statusTab === 'today' ? 'true' : undefined}
          onClick={() => setStatusTab(statusTab === 'today' ? 'ALL' : 'today')}
        >
          <div className="rf2-intv__kpi-top">
            <span className="rf2-intv__kpi-icon" data-tone="blue" aria-hidden="true">
              <Calendar />
            </span>
            <SparkBars tone="blue" heights={[10, 15, 13, 21, 16, 26, 14]} strongIndex={5} />
          </div>
          <div className="rf2-intv__kpi-mid">
            <div className="rf2-intv__kpi-val">4</div>
            <span className="rf2-intv__kpi-subpill" data-tone="blue">
              +2 vs yesterday
            </span>
          </div>
          <div className="rf2-intv__kpi-foot">
            <span className="rf2-intv__kpi-label">Scheduled today</span>
            <button
              type="button"
              className="rf2-intv__kpi-link"
              onClick={(e) => {
                e.stopPropagation();
                setStatusTab(statusTab === 'today' ? 'ALL' : 'today');
              }}
            >
              View today&apos;s schedule <ArrowRight size={12} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div
          className="rf2-intv__kpi"
          data-tone="green"
          data-active={viewMode === 'calendar' ? 'true' : undefined}
          onClick={() => setViewMode(viewMode === 'calendar' ? 'desk' : 'calendar')}
        >
          <div className="rf2-intv__kpi-top">
            <span className="rf2-intv__kpi-icon" data-tone="green" aria-hidden="true">
              <Calendar />
            </span>
            <SparkBars tone="green" heights={[9, 14, 18, 12, 22, 16, 26]} strongIndex={6} />
          </div>
          <div className="rf2-intv__kpi-mid">
            <div className="rf2-intv__kpi-val">12</div>
            <span className="rf2-intv__kpi-subpill" data-tone="green">
              8 video · 4 on-site
            </span>
          </div>
          <div className="rf2-intv__kpi-foot">
            <span className="rf2-intv__kpi-label">This week</span>
            <Link
              to="/interviews/calendar"
              className="rf2-intv__kpi-link"
              onClick={(e) => e.stopPropagation()}
            >
              View week schedule <ArrowRight size={12} aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div
          className="rf2-intv__kpi"
          data-tone="amber"
          data-active={statusTab === 'awaiting' ? 'true' : undefined}
          onClick={() => {
            setStatusTab(statusTab === 'awaiting' ? 'ALL' : 'awaiting');
            setSelectedId('int-v2-3');
          }}
        >
          <div className="rf2-intv__kpi-top">
            <span className="rf2-intv__kpi-icon" data-tone="amber" aria-hidden="true">
              <Clock />
            </span>
            <SparkBars tone="amber" heights={[8, 12, 16, 11, 22, 26, 15]} strongIndex={5} />
          </div>
          <div className="rf2-intv__kpi-mid">
            <div className="rf2-intv__kpi-val">3</div>
            <span className="rf2-intv__kpi-subpill" data-tone="amber">
              Action required
            </span>
          </div>
          <div className="rf2-intv__kpi-foot">
            <span className="rf2-intv__kpi-label">Pending feedback</span>
            <button
              type="button"
              className="rf2-intv__kpi-link"
              onClick={(e) => {
                e.stopPropagation();
                setStatusTab(statusTab === 'awaiting' ? 'ALL' : 'awaiting');
                setSelectedId('int-v2-3');
              }}
            >
              View pending <ArrowRight size={12} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div
          className="rf2-intv__kpi"
          data-tone="purple"
          data-active={statusTab === 'completed' ? 'true' : undefined}
          onClick={() => {
            setStatusTab(statusTab === 'completed' ? 'ALL' : 'completed');
            setSelectedId('int-v2-6');
          }}
        >
          <div className="rf2-intv__kpi-top">
            <span className="rf2-intv__kpi-icon" data-tone="purple" aria-hidden="true">
              <CheckCircle2 />
            </span>
            <SparkBars tone="purple" heights={[10, 16, 13, 21, 18, 26, 15]} strongIndex={5} />
          </div>
          <div className="rf2-intv__kpi-mid">
            <div className="rf2-intv__kpi-val">18</div>
            <span className="rf2-intv__kpi-subpill" data-tone="purple">
              94% attendance
            </span>
          </div>
          <div className="rf2-intv__kpi-foot">
            <span className="rf2-intv__kpi-label">Completed</span>
            <button
              type="button"
              className="rf2-intv__kpi-link"
              onClick={(e) => {
                e.stopPropagation();
                setStatusTab(statusTab === 'completed' ? 'ALL' : 'completed');
                setSelectedId('int-v2-6');
              }}
            >
              View completed <ArrowRight size={12} aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {/* ── Segmented Tabs & Filter Bar ── */}
      <div className="rf2-intv__toolbar" role="search" aria-label="Filter interviews">
        <div className="rf2-intv__tabs" role="tablist" aria-label="Interview status filter">
          <button
            type="button"
            role="tab"
            aria-selected={statusTab === 'ALL'}
            className="rf2-intv__tab"
            data-active={statusTab === 'ALL' ? 'true' : undefined}
            onClick={() => setStatusTab('ALL')}
          >
            <span>All</span>
            <span className="rf2-intv__tab-count">{counts.all}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={statusTab === 'today'}
            className="rf2-intv__tab"
            data-active={statusTab === 'today' ? 'true' : undefined}
            onClick={() => setStatusTab('today')}
          >
            <span>Today</span>
            <span className="rf2-intv__tab-count">{counts.today}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={statusTab === 'awaiting'}
            className="rf2-intv__tab"
            data-active={statusTab === 'awaiting' ? 'true' : undefined}
            onClick={() => setStatusTab('awaiting')}
          >
            <span>Awaiting feedback</span>
            <span className="rf2-intv__tab-count">{counts.awaiting}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={statusTab === 'completed'}
            className="rf2-intv__tab"
            data-active={statusTab === 'completed' ? 'true' : undefined}
            onClick={() => setStatusTab('completed')}
          >
            <span>Completed</span>
            <span className="rf2-intv__tab-count">{counts.completed}</span>
          </button>
        </div>

        <div className="rf2-intv__filters">
          <div className="rf2-intv__search-wrap">
            <Search aria-hidden="true" />
            <input
              type="search"
              className="rf2-intv__search-input"
              placeholder="Search candidate, role, or site..."
              aria-label="Search interviews"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="rf2-intv__select-pill">
            <Calendar aria-hidden="true" />
            <select
              className="rf2-intv__select"
              aria-label="Date range"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as 'ALL' | 'Today' | 'Tomorrow')}
            >
              <option value="ALL">This week</option>
              <option value="Today">Today</option>
              <option value="Tomorrow">Tomorrow</option>
            </select>
          </div>

          <div className="rf2-intv__select-pill">
            <Users aria-hidden="true" />
            <select
              className="rf2-intv__select"
              aria-label="Interview format"
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value as 'ALL' | 'Video call' | 'On-site')}
            >
              <option value="ALL">All types</option>
              <option value="Video call">Video call</option>
              <option value="On-site">On-site</option>
            </select>
          </div>

          <div className="rf2-intv__select-pill">
            <MapPin aria-hidden="true" />
            <select
              className="rf2-intv__select"
              aria-label="Interviewer or hospital site"
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
            >
              <option value="ALL">All interviewers / sites</option>
              <option value="SGH Dubai Hospital">SGH Dubai Hospital</option>
              <option value="SGH Ajman Hospital">SGH Ajman Hospital</option>
              <option value="Sarah Ahmed">Sarah Ahmed</option>
              <option value="Nour Ali">Nour Ali</option>
              <option value="Mariam Essam">Mariam Essam</option>
            </select>
          </div>

          {hasActiveFilters ? (
            <button
              type="button"
              className="rf2-intv__reset-btn"
              onClick={resetFilters}
            >
              <span>Reset</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* ── Main 2-Column Content Grid ── */}
      <div className="rf2-intv__grid">
        {/* Left Column: Desk Table + Week Schedule OR Inline Week Calendar */}
        <div className="rf2-intv__main-col">
          {viewMode === 'desk' ? (
            <>
              <section className="rf2-intv__card" aria-labelledby="upcoming-interviews-h">
                <header className="rf2-intv__card-head">
                  <div className="rf2-intv__card-title-wrap">
                    <h3 id="upcoming-interviews-h" className="rf2-intv__card-title">
                      Upcoming interviews <span>({filteredRows.length})</span>
                    </h3>
                    <span className="rf2-intv__card-pill">Click any row to inspect</span>
                  </div>
                  <div className="rf2-intv__card-head-actions">
                    <button
                      type="button"
                      className="rf2-intv__row-btn"
                      onClick={openCreateDrawer}
                    >
                      <Plus size={12} aria-hidden="true" />
                      <span>Add slot</span>
                    </button>
                  </div>
                </header>

                <div className="rf2-intv__table-scroll">
                  <table className="rf2-intv__table" aria-labelledby="upcoming-interviews-h">
                    <thead>
                      <tr>
                        <th scope="col" style={{ width: 32 }}>
                          <input
                            type="checkbox"
                            aria-label="Select all interviews"
                            checked={filteredRows.length > 0 && filteredRows.every((r) => checkedRows[r.id])}
                            onChange={(e) => {
                              const next: Record<string, boolean> = {};
                              if (e.target.checked) {
                                filteredRows.forEach((r) => {
                                  next[r.id] = true;
                                });
                              }
                              setCheckedRows(next);
                            }}
                          />
                        </th>
                        <th scope="col">Time</th>
                        <th scope="col">Candidate</th>
                        <th scope="col">Job &amp; Site</th>
                        <th scope="col">Format</th>
                        <th scope="col">Interviewers</th>
                        <th scope="col">Status</th>
                        <th scope="col">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((row) => {
                        const isSelected = selectedInterview.id === row.id;
                        return (
                          <tr
                            key={row.id}
                            data-selected={isSelected ? 'true' : undefined}
                            onClick={() => setSelectedId(row.id)}
                          >
                            <td onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                aria-label={`Select interview for ${row.candidateName}`}
                                checked={Boolean(checkedRows[row.id])}
                                onChange={(e) =>
                                  setCheckedRows((prev) => ({ ...prev, [row.id]: e.target.checked }))
                                }
                              />
                            </td>
                            <td>
                              <div className="rf2-intv__time-cell">
                                <span className="rf2-intv__time-main">{row.time}</span>
                                <span className="rf2-intv__time-sub">
                                  <span
                                    className="rf2-intv__day-tag"
                                    data-today={row.dayLabel === 'Today' ? 'true' : undefined}
                                  >
                                    {row.dayLabel}
                                  </span>
                                  <span>· {row.durationLabel}</span>
                                </span>
                              </div>
                            </td>
                            <td>
                              <div className="rf2-intv__cand-cell">
                                <span
                                  className="rf2-intv__avatar"
                                  data-tone={row.avatarTone}
                                  aria-hidden="true"
                                >
                                  {row.avatarInitials}
                                </span>
                                <div>
                                  <span className="rf2-intv__primary-text">{row.candidateName}</span>
                                  <span className="rf2-intv__secondary-text">{row.candidateRole}</span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="rf2-intv__primary-text">{row.jobTitle}</span>
                              <span className="rf2-intv__secondary-text">{row.site}</span>
                            </td>
                            <td>
                              <span
                                className="rf2-intv__format-badge"
                                data-format={row.format === 'Video call' ? 'video' : 'onsite'}
                              >
                                {row.format === 'Video call' ? (
                                  <Video aria-hidden="true" />
                                ) : (
                                  <MapPin aria-hidden="true" />
                                )}
                                <span>{row.format}</span>
                              </span>
                            </td>
                            <td>
                              <div className="rf2-intv__panel-stack" aria-label={row.panelSummary}>
                                {row.panelBadges.map((b, i) => (
                                  <span
                                    key={i}
                                    className="rf2-intv__panel-av"
                                    data-tone={b.tone}
                                    title={`${b.name} (${b.role})`}
                                  >
                                    {b.initials}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td>
                              <span className="rf2-intv__status-pill" data-tone={row.statusTone}>
                                <span className="rf2-intv__status-dot" aria-hidden="true" />
                                {row.statusLabel}
                              </span>
                            </td>
                            <td onClick={(e) => e.stopPropagation()}>
                              <div className="rf2-intv__row-actions">
                                {row.statusTone === 'awaiting' ? (
                                  <button
                                    type="button"
                                    className="rf2-intv__row-btn"
                                    data-variant="amber"
                                    onClick={() => {
                                      setSelectedId(row.id);
                                      openScorecardForRow(row);
                                    }}
                                  >
                                    <ClipboardCheck aria-hidden="true" />
                                    <span>Scorecard</span>
                                  </button>
                                ) : row.statusTone === 'today' && row.format === 'Video call' ? (
                                  <button
                                    type="button"
                                    className="rf2-intv__row-btn"
                                    data-variant="primary"
                                    onClick={() => {
                                      setSelectedId(row.id);
                                      showToast(`📹 Opening Microsoft Teams call for ${row.candidateName}...`);
                                    }}
                                  >
                                    <Video aria-hidden="true" />
                                    <span>Join</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="rf2-intv__row-btn"
                                    onClick={() => setSelectedId(row.id)}
                                  >
                                    {row.actionLabel}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="rf2-intv__dots-btn"
                                  aria-label={`More actions for ${row.candidateName}`}
                                  onClick={() => {
                                    setSelectedId(row.id);
                                    openEditDrawer();
                                  }}
                                >
                                  <MoreVertical aria-hidden="true" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* This Week's Schedule Card */}
              <section className="rf2-intv__card rf2-intv__week-card" aria-labelledby="week-schedule-h">
                <div className="rf2-intv__week-head">
                  <div className="rf2-intv__week-left">
                    <h3 id="week-schedule-h" className="rf2-intv__card-title">
                      This week&apos;s schedule
                    </h3>
                    <div className="rf2-intv__week-stepper" role="group" aria-label="Week navigation">
                      <button type="button" className="rf2-intv__week-step-btn" aria-label="Previous week">
                        <ChevronLeft aria-hidden="true" />
                      </button>
                      <span className="rf2-intv__week-range">26 – 30 Oct 2026</span>
                      <button type="button" className="rf2-intv__week-step-btn" aria-label="Next week">
                        <ChevronRight aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button
                      type="button"
                      className="rf2-intv__kpi-link"
                      onClick={() => setViewMode('calendar')}
                    >
                      Expand week grid
                    </button>
                    <Link to="/interviews/calendar" className="rf2-intv__kpi-link">
                      View full calendar <ArrowRight size={13} aria-hidden="true" />
                    </Link>
                  </div>
                </div>

                <div className="rf2-intv__week-days">
                  {WEEK_DAYS.map((d) => {
                    const isActive = activeWeekDay === d.id;
                    return (
                      <div
                        key={d.id}
                        role="button"
                        tabIndex={0}
                        className="rf2-intv__day-tile"
                        data-active={isActive ? 'true' : undefined}
                        onClick={() => setActiveWeekDay(d.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setActiveWeekDay(d.id);
                          }
                        }}
                      >
                        <div className="rf2-intv__day-top">
                          <div>
                            <span className="rf2-intv__day-name">{d.day}</span>
                            <span className="rf2-intv__day-date">{d.date}</span>
                          </div>
                          {isActive ? <span className="rf2-intv__day-dot" aria-hidden="true" /> : null}
                        </div>

                        <div className="rf2-intv__day-slots">
                          {d.slots.map((slot, idx) => (
                            <span
                              key={idx}
                              className="rf2-intv__day-chip"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveWeekDay(d.id);
                                setSelectedId(slot.rowId);
                              }}
                            >
                              <span className="rf2-intv__day-chip-time">{slot.time}</span>
                              <span>{slot.name}</span>
                            </span>
                          ))}
                        </div>

                        <div className="rf2-intv__day-foot">
                          <span className="rf2-intv__day-count">{d.count}</span>
                          <span className="rf2-intv__day-unit">{d.unit}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          ) : (
            /* Inline Week Calendar View Mode */
            <section className="rf2-intv__inline-cal" aria-label="Weekly interview calendar grid">
              <div className="rf2-intv__inline-cal-head">
                <div className="rf2-intv__week-left">
                  <h3 className="rf2-intv__card-title">Week of 26 – 30 Oct 2026</h3>
                  <span className="rf2-intv__card-pill">Asia/Dubai (GST)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    type="button"
                    className="rf2-intv__row-btn"
                    onClick={() => setViewMode('desk')}
                  >
                    Back to Desk List
                  </button>
                  <Link to="/interviews/calendar" className="rf2-intv__kpi-link">
                    Open full month/day calendar <ArrowRight size={13} aria-hidden="true" />
                  </Link>
                </div>
              </div>

              <div className="rf2-intv__inline-cal-grid">
                <div className="rf2-intv__inline-cal-col-head">Time</div>
                {WEEK_DAYS.map((d) => (
                  <div
                    key={d.id}
                    className="rf2-intv__inline-cal-col-head"
                    data-today={d.id === 'wed' ? 'true' : undefined}
                  >
                    {d.day} · {d.date}
                  </div>
                ))}

                {CALENDAR_HOURS.map((h) => (
                  <React.Fragment key={h.hour}>
                    <div className="rf2-intv__inline-cal-time">{h.label}</div>
                    {WEEK_DAYS.map((d) => {
                      const matches = allRows.filter(
                        (r) => r.weekDayId === d.id && r.hourSlot === h.hour
                      );
                      return (
                        <div key={`${d.id}-${h.hour}`} className="rf2-intv__inline-cal-cell">
                          {matches.map((ev) => (
                            <div
                              key={ev.id}
                              className="rf2-intv__inline-cal-ev"
                              data-tone={ev.statusTone === 'awaiting' ? 'awaiting' : ev.format === 'On-site' ? 'completed' : undefined}
                              onClick={() => setSelectedId(ev.id)}
                            >
                              <span className="rf2-intv__inline-cal-ev-time">
                                {ev.time} · {ev.durationLabel}
                              </span>
                              <span className="rf2-intv__inline-cal-ev-name">{ev.candidateName}</span>
                              <span className="rf2-intv__inline-cal-ev-role">{ev.jobTitle}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right Column: Interview Details + Preparation Checklist + Recent Feedback */}
        <aside className="rf2-intv__side-col" aria-label="Selected interview details">
          {/* Card 1: Interview details */}
          <section className="rf2-intv__side-card" aria-labelledby="interview-details-h">
            <div className="rf2-intv__side-head">
              <h3 id="interview-details-h" className="rf2-intv__side-title">
                Interview details
              </h3>
              <div className="rf2-intv__side-tools">
                <button
                  type="button"
                  className="rf2-intv__edit-btn"
                  onClick={openEditDrawer}
                >
                  <SlidersHorizontal aria-hidden="true" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  className="rf2-intv__dots-btn"
                  aria-label="More interview options"
                >
                  <MoreVertical aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="rf2-intv__detail-cand">
              <div className="rf2-intv__detail-cand-left">
                <span
                  className="rf2-intv__avatar"
                  data-tone={selectedInterview.avatarTone}
                  aria-hidden="true"
                >
                  {selectedInterview.avatarInitials}
                </span>
                <div>
                  <span className="rf2-intv__primary-text">{selectedInterview.candidateName}</span>
                  <span className="rf2-intv__secondary-text">
                    {selectedInterview.jobTitle} · {selectedInterview.site}
                  </span>
                </div>
              </div>
              <span className="rf2-intv__status-pill" data-tone={selectedInterview.statusTone}>
                <span className="rf2-intv__status-dot" aria-hidden="true" />
                {selectedInterview.statusLabel}
              </span>
            </div>

            {/* Quick Action Bar */}
            <div className="rf2-intv__detail-actions">
              {selectedInterview.statusTone === 'awaiting' ? (
                <button
                  type="button"
                  className="rf2-intv__detail-cta"
                  data-primary="true"
                  onClick={() => openScorecardForRow(selectedInterview)}
                >
                  <ClipboardCheck aria-hidden="true" />
                  <span>Fill scorecard</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="rf2-intv__detail-cta"
                  data-primary="true"
                  onClick={() =>
                    showToast(
                      selectedInterview.format === 'Video call'
                        ? `📹 Launching Microsoft Teams call with ${selectedInterview.candidateName}...`
                        : `📍 Checking in ${selectedInterview.candidateName} at ${selectedInterview.platformDetail}`
                    )
                  }
                >
                  <Video aria-hidden="true" />
                  <span>
                    {selectedInterview.format === 'Video call' ? 'Join Teams call' : 'Room check-in'}
                  </span>
                </button>
              )}

              <button
                type="button"
                className="rf2-intv__detail-cta"
                onClick={openEditDrawer}
              >
                <Calendar aria-hidden="true" />
                <span>Reschedule</span>
              </button>
            </div>

            <ul className="rf2-intv__meta-list">
              <li className="rf2-intv__meta-item">
                <Calendar aria-hidden="true" />
                <div>
                  <span className="rf2-intv__meta-label">Date</span>
                  <span className="rf2-intv__meta-val">{selectedInterview.fullDateLabel}</span>
                </div>
              </li>
              <li className="rf2-intv__meta-item">
                <Clock aria-hidden="true" />
                <div>
                  <span className="rf2-intv__meta-label">Time &amp; duration</span>
                  <span className="rf2-intv__meta-val">{selectedInterview.timeRangeLabel}</span>
                </div>
              </li>
              <li className="rf2-intv__meta-item">
                {selectedInterview.format === 'Video call' ? (
                  <Video aria-hidden="true" />
                ) : (
                  <MapPin aria-hidden="true" />
                )}
                <div>
                  <span className="rf2-intv__meta-label">Location / Platform</span>
                  <span className="rf2-intv__meta-val">{selectedInterview.platformDetail}</span>
                </div>
              </li>
              <li className="rf2-intv__meta-item">
                <Users aria-hidden="true" />
                <div>
                  <span className="rf2-intv__meta-label">Interview panel</span>
                  <span className="rf2-intv__meta-val">{selectedInterview.panelSummary}</span>
                  <div className="rf2-intv__panel-chips">
                    {selectedInterview.panelBadges.map((b, idx) => (
                      <span key={idx} className="rf2-intv__panel-chip">
                        <strong>{b.name}</strong> · {b.role}
                      </span>
                    ))}
                  </div>
                </div>
              </li>
              <li className="rf2-intv__meta-item">
                <FileText aria-hidden="true" />
                <div>
                  <span className="rf2-intv__meta-label">Job requisition</span>
                  <span className="rf2-intv__meta-val">
                    {selectedInterview.jobTitle} ({selectedInterview.site})
                  </span>
                </div>
              </li>
            </ul>

            <button
              type="button"
              className="rf2-intv__profile-btn"
              onClick={() => navigate('/candidates')}
            >
              <UserCheck aria-hidden="true" />
              <span>View candidate profile</span>
              <ArrowRight size={13} aria-hidden="true" />
            </button>
          </section>

          {/* Card 2: Preparation checklist */}
          <section className="rf2-intv__side-card" aria-labelledby="prep-checklist-h">
            <div className="rf2-intv__side-head">
              <h3 id="prep-checklist-h" className="rf2-intv__side-title">
                Preparation checklist
              </h3>
              <span className="rf2-intv__prep-count">
                {completedPrepCount} of {prepItems.length} completed
              </span>
            </div>

            <div className="rf2-intv__prep-bar" aria-hidden="true">
              <div className="rf2-intv__prep-fill" style={{ width: `${prepPercent}%` }} />
            </div>

            <ul className="rf2-intv__prep-list">
              {prepItems.map((item) => (
                <li key={item.id}>
                  <label
                    className="rf2-intv__prep-item"
                    data-done={item.done ? 'true' : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={(e) =>
                        setPrepItems((prev) =>
                          prev.map((p) => (p.id === item.id ? { ...p, done: e.target.checked } : p))
                        )
                      }
                    />
                    <span>{item.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </section>

          {/* Card 3: Recent feedback (2) */}
          <section className="rf2-intv__side-card" aria-labelledby="recent-feedback-h">
            <div className="rf2-intv__side-head">
              <h3 id="recent-feedback-h" className="rf2-intv__side-title">
                Recent feedback <span style={{ fontWeight: 500, color: 'var(--rf2-ink-muted)' }}>(2)</span>
              </h3>
              <button
                type="button"
                className="rf2-intv__kpi-link"
                onClick={() => openScorecardForRow(selectedInterview)}
              >
                Add scorecard ›
              </button>
            </div>

            <div className="rf2-intv__feedback-list">
              <div className="rf2-intv__feedback-item">
                <span className="rf2-intv__avatar" data-tone="blue" aria-hidden="true">
                  NA
                </span>
                <div className="rf2-intv__feedback-body">
                  <div className="rf2-intv__feedback-top">
                    <span className="rf2-intv__feedback-author">Nour Ali</span>
                    <span className="rf2-intv__feedback-rating">
                      <Star size={10} fill="currentColor" aria-hidden="true" /> 4.6 · Strong Hire
                    </span>
                  </div>
                  <div className="rf2-intv__feedback-meta">Hiring Manager · 2 hours ago</div>
                  <p className="rf2-intv__feedback-text">
                    Strong technical knowledge and relevant clinical experience. Excellent communication skills.
                  </p>
                </div>
              </div>

              <div className="rf2-intv__feedback-item">
                <span className="rf2-intv__avatar" data-tone="sky" aria-hidden="true">
                  ME
                </span>
                <div className="rf2-intv__feedback-body">
                  <div className="rf2-intv__feedback-top">
                    <span className="rf2-intv__feedback-author">Mariam Essam</span>
                    <span className="rf2-intv__feedback-rating">
                      <Star size={10} fill="currentColor" aria-hidden="true" /> 4.3 · Hire
                    </span>
                  </div>
                  <div className="rf2-intv__feedback-meta">Radiology Lead · 3 hours ago</div>
                  <p className="rf2-intv__feedback-text">
                    Showed solid understanding of PACS &amp; imaging protocols. Recommend moving to offer stage.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>

      {/* Shared V2 Interview Schedule & Edit Drawer */}
      <InterviewScheduleDrawerV2
        open={drawerOpen}
        mode={drawerMode}
        initialValues={drawerInitialValues}
        candidates={candidateOptions}
        onClose={() => setDrawerOpen(false)}
        onSaved={(summary) => {
          showToast(
            summary.mode === 'edit'
              ? `✓ Updated interview for ${summary.candidateName}`
              : `✓ Scheduled ${summary.interviewType.toLowerCase()} interview for ${summary.candidateName}`
          );
          void loadData();
        }}
      />

      <FastScorecardModal
        isOpen={Boolean(scorecardInterview)}
        interview={scorecardInterview}
        onClose={() => setScorecardInterview(null)}
        onSuccess={() => {
          showToast('✓ Scorecard submitted & permanently locked');
          void loadData();
        }}
      />

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2 border border-slate-700">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

export default InterviewsPage;
