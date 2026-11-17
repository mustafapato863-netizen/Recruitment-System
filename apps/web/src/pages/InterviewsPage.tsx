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
  UserCheck,
  Users,
  Video,
} from 'lucide-react';
import type { Application, Interview, PaginatedResult } from '@recruitflow/contracts';
import { getApi } from '../api/client';
import { downloadIcs, sendScorecardReminder } from '../api/myInterviews';
import { FastScorecardModal } from '../components/interview/FastScorecardModal';
import { SelectV2 } from '../components/v2';
import {
  InterviewScheduleDrawerV2,
  type InterviewScheduleCandidateOption,
  type InterviewScheduleInitialValues,
} from '../v2/drawers/InterviewScheduleDrawerV2';
import '../v2/pages/interviews-v2.css';

interface RawAttendee {
  userId?: string;
  userName?: string;
  displayName?: string;
  role?: string;
}

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
  rawStartIso: string | null;
  rawEndIso: string | null;
  interviewType: string;
  rawAttendees: RawAttendee[];
}

const WEEK_DAY_IDS = ['mon', 'tue', 'wed', 'thu', 'fri'] as const;
const PANEL_TONES: PanelMemberBadge['tone'][] = ['green', 'indigo', 'purple', 'blue'];
const AVATAR_TONES: DeskInterviewRow['avatarTone'][] = ['blue', 'sky', 'indigo', 'green', 'rose', 'cyan'];

function calendarDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function weekDayIdFromDate(date: Date): DeskInterviewRow['weekDayId'] {
  const ids: DeskInterviewRow['weekDayId'][] = ['mon', 'mon', 'tue', 'wed', 'thu', 'fri', 'fri'];
  return ids[date.getDay()] ?? 'mon';
}

function startOfMonday(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  const day = next.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + delta);
  return next;
}

function formatLocalDateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatLocalTimeInput(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function initialsOf(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return letters || 'IN';
}

const CALENDAR_HOURS = [
  { hour: 9, label: '09:00 AM' },
  { hour: 10, label: '10:00 AM' },
  { hour: 11, label: '11:00 AM' },
  { hour: 12, label: '12:00 PM' },
  { hour: 13, label: '01:00 PM' },
  { hour: 14, label: '02:00 PM' },
  { hour: 15, label: '03:00 PM' },
];

function displayHourSlot(hour: number): number {
  const start = CALENDAR_HOURS[0]?.hour ?? hour;
  const end = CALENDAR_HOURS[CALENDAR_HOURS.length - 1]?.hour ?? hour;
  return Math.min(end, Math.max(start, hour));
}

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
  const [searchParams] = useSearchParams();
  const [apiInterviews, setApiInterviews] = useState<Interview[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>('');
  const [activeWeekDay, setActiveWeekDay] = useState<string>(() => weekDayIdFromDate(new Date()));
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
    setLoading(true);
    setLoadError(null);
    try {
      const [intRes, appRes] = await Promise.all([
        getApi<Interview[] | { data?: Interview[] }>('/interviews'),
        getApi<PaginatedResult<Application>>('/applications?page=1&pageSize=50').catch(() => ({ data: [] as Application[] })),
      ]);
      const intList = Array.isArray(intRes) ? intRes : intRes?.data || [];
      setApiInterviews(intList);
      setApplications(appRes?.data || []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load interviews.');
      setApiInterviews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const allRows: DeskInterviewRow[] = useMemo(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const todayKey = calendarDayKey(today);
    const tomorrowKey = calendarDayKey(tomorrow);

    return apiInterviews.map((iv, idx) => {
      const name = iv.candidateName || 'Candidate';
      const startDt = iv.scheduledStart ? new Date(iv.scheduledStart) : new Date();
      const endDt = iv.scheduledEnd ? new Date(iv.scheduledEnd) : new Date(startDt.getTime() + 45 * 60000);
      const durationMins = Math.max(15, Math.round((endDt.getTime() - startDt.getTime()) / 60000));
      const startKey = calendarDayKey(startDt);
      const dayLabel: DeskInterviewRow['dayLabel'] = startKey === todayKey ? 'Today' : startKey === tomorrowKey ? 'Tomorrow' : 'This week';
      const timeStr = startDt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      const endStr = endDt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      const isVideo = Boolean(iv.locationUrl && /^https?:/i.test(iv.locationUrl));
      const site = (iv as { branchName?: string }).branchName || iv.roomName || 'Main Campus';
      const rawAttendees: RawAttendee[] = Array.isArray(iv.attendees)
        ? iv.attendees.map((att) => ({
            userId: att.userId,
            userName: att.userName,
            displayName: (att as { displayName?: string }).displayName,
            role: att.role,
          }))
        : [];
      const panelPeople = Array.isArray(iv.attendees) && iv.attendees.length > 0
        ? rawAttendees.map((att) => ({
            name: att.userName || att.displayName || 'Interviewer',
            role: att.role || 'Interviewer',
          }))
        : [];
      const scorecardStatus = (iv as { scorecardStatus?: string }).scorecardStatus;
      let statusTone: DeskInterviewRow['statusTone'] = 'scheduled';
      let statusLabel: DeskInterviewRow['statusLabel'] = 'Scheduled';
      if (iv.status === 'Completed') {
        statusTone = 'completed';
        statusLabel = 'Completed';
      } else if (scorecardStatus === 'missing' || endDt.getTime() < Date.now()) {
        statusTone = 'awaiting';
        statusLabel = 'Awaiting feedback';
      } else if (dayLabel === 'Today') {
        statusTone = 'today';
        statusLabel = 'Interview today';
      }
      const dated = startDt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      return {
        id: iv.id,
        candidateId: iv.applicationId || `cnd-${idx}`,
        time: timeStr,
        durationLabel: `${durationMins}m`,
        dayLabel,
        weekDayId: weekDayIdFromDate(startDt),
        hourSlot: startDt.getHours(),
        fullDateLabel: dayLabel === 'This week'
          ? startDt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
          : `${dayLabel}, ${dated}`,
        timeRangeLabel: `${timeStr} – ${endStr} (${durationMins} mins)`,
        candidateName: name,
        candidateRole: iv.positionTitle || 'Clinical Specialist',
        avatarInitials: initialsOf(name),
        avatarTone: AVATAR_TONES[idx % AVATAR_TONES.length] ?? 'blue',
        jobTitle: iv.positionTitle || 'Clinical Specialist',
        site,
        format: isVideo ? 'Video call' : 'On-site',
        formatShort: isVideo ? 'Video' : 'On-site',
        platformDetail: isVideo
          ? (iv.locationUrl ? `Video call (${iv.locationUrl})` : 'Video call')
          : (iv.roomName ? `On-site (${iv.roomName})` : `On-site (${site})`),
        meetingUrl: iv.locationUrl || undefined,
        panelBadges: panelPeople.map((person, personIndex) => ({
          initials: initialsOf(person.name),
          name: person.name,
          role: person.role,
          tone: PANEL_TONES[personIndex % PANEL_TONES.length] ?? 'blue',
        })),
        panelSummary: panelPeople.length > 0
          ? panelPeople.map((person) => `${person.name} (${person.role})`).join(', ')
          : 'No panel assigned',
        statusLabel,
        statusTone,
        actionLabel: statusTone === 'completed' || statusTone === 'awaiting' ? 'View details' : 'Open',
        rawStartIso: iv.scheduledStart || null,
        rawEndIso: iv.scheduledEnd || null,
        interviewType: iv.interviewType || 'Technical',
        rawAttendees,
      };
    });
  }, [apiInterviews]);

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

  const calendarRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allRows.filter((r) => {
      if (statusTab === 'today' && r.dayLabel !== 'Today') return false;
      if (statusTab === 'awaiting' && r.statusTone !== 'awaiting') return false;
      if (statusTab === 'completed' && r.statusTone !== 'completed') return false;
      if (formatFilter !== 'ALL' && r.format !== formatFilter) return false;
      if (
        siteFilter !== 'ALL' &&
        !r.site.toLowerCase().includes(siteFilter.toLowerCase()) &&
        !r.panelSummary.toLowerCase().includes(siteFilter.toLowerCase())
      ) {
        return false;
      }
      if (q && !`${r.candidateName} ${r.candidateRole} ${r.jobTitle} ${r.site}`.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [allRows, formatFilter, searchQuery, siteFilter, statusTab]);

  const selectedInterview = useMemo(() => {
    return allRows.find((r) => r.id === selectedId) ?? filteredRows[0] ?? allRows[0] ?? null;
  }, [allRows, filteredRows, selectedId]);

  const weekColumns = useMemo(() => {
    const monday = startOfMonday(new Date());
    const todayKey = calendarDayKey(new Date());
    return WEEK_DAY_IDS.map((id, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      const slots = allRows.filter((row) => row.weekDayId === id);
      return {
        id,
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dateLabel: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        isToday: calendarDayKey(date) === todayKey,
        count: slots.length,
        unit: slots.length === 1 ? 'interview' : 'interviews',
        slots,
      };
    });
  }, [allRows]);
  const weekRangeLabel = weekColumns.length > 0
    ? `${weekColumns[0]?.dateLabel ?? ''} – ${weekColumns[weekColumns.length - 1]?.dateLabel ?? ''}`
    : '';
  const todayColumnLabel = `Today · ${new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}`;

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
    if (!matchingApi) {
      showToast('Unable to open scorecard: interview record not found.');
      return;
    }
    setScorecardInterview(matchingApi);
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
      screenNoteSaved: true,
    }));
  }, [allRows, applications]);

  const drawerInitialValues: InterviewScheduleInitialValues = useMemo(() => {
    if (drawerMode === 'edit' && selectedInterview) {
      const start = selectedInterview.rawStartIso ? new Date(selectedInterview.rawStartIso) : null;
      const validStart = start && !Number.isNaN(start.getTime()) ? start : null;
      const end = selectedInterview.rawEndIso ? new Date(selectedInterview.rawEndIso) : null;
      const durationMins = validStart && end && !Number.isNaN(end.getTime())
        ? Math.max(15, Math.round((end.getTime() - validStart.getTime()) / 60000))
        : Number.parseInt(selectedInterview.durationLabel, 10) || 45;
      return {
        interviewId: selectedInterview.id,
        applicationId: selectedInterview.candidateId,
        candidateName: selectedInterview.candidateName,
        positionTitle: selectedInterview.jobTitle,
        interviewType: selectedInterview.interviewType,
        date: validStart ? formatLocalDateInput(validStart) : '',
        time: validStart ? formatLocalTimeInput(validStart) : '',
        duration: String(durationMins),
        roomUrl: selectedInterview.meetingUrl || '',
        interviewers: selectedInterview.rawAttendees
          .map((attendee) => ({
            id: attendee.userId ?? '',
            name: attendee.userName || attendee.displayName || 'Interviewer',
            detail: attendee.role || 'Interviewer',
          }))
          .filter((person) => Boolean(person.id)),
        screenNoteSaved: true,
      };
    }
    return {
      applicationId: selectedInterview?.candidateId ?? '',
      candidateName: selectedInterview?.candidateName ?? '',
      positionTitle: selectedInterview?.jobTitle ?? '',
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
      video: allRows.filter((r) => r.format === 'Video call').length,
      onSite: allRows.filter((r) => r.format === 'On-site').length,
    };
  }, [allRows]);

  const siteOptions = useMemo(() => {
    const values = new Set<string>();
    for (const row of allRows) {
      if (row.site) values.add(row.site);
      for (const badge of row.panelBadges) {
        if (badge.name) values.add(badge.name);
      }
    }
    return [...values].sort((a, b) => a.localeCompare(b));
  }, [allRows]);

  const focusStatus = (tone: 'awaiting' | 'completed') => {
    const row = allRows.find((item) => item.statusTone === tone);
    if (row) setSelectedId(row.id);
  };

  return (
    <div className="rf2-intv">
      {/* ── Page Header ── */}
      <header className="rf2-intv__hero">
        <div className="rf2-intv__hero-copy">
          <div className="rf2-intv__hero-title-row">
            <h2 className="rf2-intv__hero-title">Interviews</h2>
            <span className="rf2-intv__hero-badge">
              <span className="rf2-intv__hero-badge-dot" aria-hidden="true" />
              {counts.today} today · {counts.awaiting} awaiting feedback
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

      {loadError ? (
        <div className="rf2-intv__load-error" role="alert">
          <span>{loadError}</span>
          <button type="button" onClick={() => void loadData()}>Retry</button>
        </div>
      ) : null}
      {loading ? <p role="status">Loading interviews…</p> : null}

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
            <div className="rf2-intv__kpi-val">{counts.today}</div>
            <span className="rf2-intv__kpi-subpill" data-tone="blue">
              On today&apos;s list
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
            <div className="rf2-intv__kpi-val">{counts.all}</div>
            <span className="rf2-intv__kpi-subpill" data-tone="green">
              {counts.video} video · {counts.onSite} on-site
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
            const next = statusTab === 'awaiting' ? 'ALL' : 'awaiting';
            setStatusTab(next);
            if (next === 'awaiting') focusStatus('awaiting');
          }}
        >
          <div className="rf2-intv__kpi-top">
            <span className="rf2-intv__kpi-icon" data-tone="amber" aria-hidden="true">
              <Clock />
            </span>
            <SparkBars tone="amber" heights={[8, 12, 16, 11, 22, 26, 15]} strongIndex={5} />
          </div>
          <div className="rf2-intv__kpi-mid">
            <div className="rf2-intv__kpi-val">{counts.awaiting}</div>
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
                const next = statusTab === 'awaiting' ? 'ALL' : 'awaiting';
                setStatusTab(next);
                if (next === 'awaiting') focusStatus('awaiting');
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
            const next = statusTab === 'completed' ? 'ALL' : 'completed';
            setStatusTab(next);
            if (next === 'completed') focusStatus('completed');
          }}
        >
          <div className="rf2-intv__kpi-top">
            <span className="rf2-intv__kpi-icon" data-tone="purple" aria-hidden="true">
              <CheckCircle2 />
            </span>
            <SparkBars tone="purple" heights={[10, 16, 13, 21, 18, 26, 15]} strongIndex={5} />
          </div>
          <div className="rf2-intv__kpi-mid">
            <div className="rf2-intv__kpi-val">{counts.completed}</div>
            <span className="rf2-intv__kpi-subpill" data-tone="purple">
              Recorded interviews
            </span>
          </div>
          <div className="rf2-intv__kpi-foot">
            <span className="rf2-intv__kpi-label">Completed</span>
            <button
              type="button"
              className="rf2-intv__kpi-link"
              onClick={(e) => {
                e.stopPropagation();
                const next = statusTab === 'completed' ? 'ALL' : 'completed';
                setStatusTab(next);
                if (next === 'completed') focusStatus('completed');
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
            <SelectV2
              label="Date range"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as 'ALL' | 'Today' | 'Tomorrow')}
            >
              <option value="ALL">This week</option>
              <option value="Today">Today</option>
              <option value="Tomorrow">Tomorrow</option>
            </SelectV2>
          </div>

          <div className="rf2-intv__select-pill">
            <Users aria-hidden="true" />
            <SelectV2
              label="Interview format"
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value as 'ALL' | 'Video call' | 'On-site')}
            >
              <option value="ALL">All types</option>
              <option value="Video call">Video call</option>
              <option value="On-site">On-site</option>
            </SelectV2>
          </div>

          <div className="rf2-intv__select-pill">
            <MapPin aria-hidden="true" />
            <SelectV2
              label="Interviewer or hospital site"
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
            >
              <option value="ALL">All interviewers / sites</option>
              {siteOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </SelectV2>
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
                        const isSelected = selectedInterview?.id === row.id;
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
                      {filteredRows.length === 0 ? (
                        <tr>
                          <td colSpan={8}>
                            {loading ? 'Loading interviews…' : 'No interviews scheduled.'}
                          </td>
                        </tr>
                      ) : null}
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
                      <span className="rf2-intv__week-range">{weekRangeLabel}</span>
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
                  {weekColumns.map((d) => {
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
                            <span className="rf2-intv__day-date">{d.dateLabel}</span>
                          </div>
                          {isActive ? <span className="rf2-intv__day-dot" aria-hidden="true" /> : null}
                        </div>

                        <div className="rf2-intv__day-slots">
                          {d.slots.length > 0 ? d.slots.map((slot) => (
                            <span
                              key={slot.id}
                              className="rf2-intv__day-chip"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveWeekDay(d.id);
                                setSelectedId(slot.id);
                              }}
                            >
                              <span className="rf2-intv__day-chip-time">{slot.time}</span>
                              <span>{slot.candidateName}</span>
                            </span>
                          )) : (
                            <span className="rf2-intv__day-chip">No interviews</span>
                          )}
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
                  <h3 className="rf2-intv__card-title">
                    Week of {weekRangeLabel} <span>({calendarRows.length})</span>
                  </h3>
                  <div className="rf2-intv__week-stepper" role="group" aria-label="Week navigation">
                    <button type="button" className="rf2-intv__week-step-btn" aria-label="Previous week">
                      <ChevronLeft aria-hidden="true" />
                    </button>
                    <span className="rf2-intv__week-range">{todayColumnLabel}</span>
                    <button type="button" className="rf2-intv__week-step-btn" aria-label="Next week">
                      <ChevronRight aria-hidden="true" />
                    </button>
                  </div>
                  <span className="rf2-intv__card-pill">Asia/Dubai (GST)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="rf2-intv__row-btn"
                    onClick={() => setViewMode('desk')}
                  >
                    <LayoutList size={12} aria-hidden="true" />
                    <span>Back to Desk List</span>
                  </button>
                  <button
                    type="button"
                    className="rf2-intv__row-btn"
                    data-variant="primary"
                    onClick={openCreateDrawer}
                  >
                    <Plus size={12} aria-hidden="true" />
                    <span>Add slot</span>
                  </button>
                  <Link to="/interviews/calendar" className="rf2-intv__kpi-link">
                    Open full month/day calendar <ArrowRight size={13} aria-hidden="true" />
                  </Link>
                </div>
              </div>

              <div className="rf2-intv__inline-cal-subbar">
                <div className="rf2-intv__inline-cal-legend" aria-label="Calendar color legend">
                  <span className="rf2-intv__inline-cal-legend-item">
                    <span className="rf2-intv__inline-cal-legend-dot" data-tone="video" aria-hidden="true" />
                    Video call (Teams)
                  </span>
                  <span className="rf2-intv__inline-cal-legend-item">
                    <span className="rf2-intv__inline-cal-legend-dot" data-tone="onsite" aria-hidden="true" />
                    On-site hospital
                  </span>
                  <span className="rf2-intv__inline-cal-legend-item">
                    <span className="rf2-intv__inline-cal-legend-dot" data-tone="awaiting" aria-hidden="true" />
                    Awaiting scorecard
                  </span>
                  <span className="rf2-intv__inline-cal-legend-item">
                    <span className="rf2-intv__inline-cal-legend-dot" data-tone="completed" aria-hidden="true" />
                    Completed
                  </span>
                </div>
                <span className="rf2-intv__inline-cal-hint">
                  Click any interview card to inspect · Hover an empty slot to schedule
                </span>
              </div>

              <div className="rf2-intv__inline-cal-scroll">
                <div className="rf2-intv__inline-cal-grid">
                  <div className="rf2-intv__inline-cal-col-head">Time</div>
                  {weekColumns.map((d) => {
                    const dayCount = calendarRows.filter((r) => r.weekDayId === d.id).length;
                    const isToday = d.isToday;
                    return (
                      <div
                        key={d.id}
                        className="rf2-intv__inline-cal-col-head"
                        data-today={isToday ? 'true' : undefined}
                      >
                        <div className="rf2-intv__inline-cal-day-top">
                          <span className="rf2-intv__inline-cal-day-name">
                            {d.day} {isToday ? '· Today' : ''}
                          </span>
                          <span className="rf2-intv__inline-cal-day-badge">
                            {dayCount} {dayCount === 1 ? 'slot' : 'slots'}
                          </span>
                        </div>
                        <span className="rf2-intv__inline-cal-day-date">{d.dateLabel}</span>
                      </div>
                    );
                  })}

                  {CALENDAR_HOURS.map((h) => (
                    <React.Fragment key={h.hour}>
                      <div className="rf2-intv__inline-cal-time">{h.label}</div>
                      {weekColumns.map((d) => {
                        const matches = calendarRows.filter(
                          (r) => r.weekDayId === d.id && displayHourSlot(r.hourSlot) === h.hour
                        );
                        const isToday = d.isToday;
                        return (
                          <div
                            key={`${d.id}-${h.hour}`}
                            className="rf2-intv__inline-cal-cell"
                            data-today={isToday ? 'true' : undefined}
                          >
                            {matches.length > 0 ? (
                              matches.map((ev) => {
                                const isSelected = selectedInterview?.id === ev.id;
                                const cardTone =
                                  ev.statusTone === 'awaiting'
                                    ? 'awaiting'
                                    : ev.statusTone === 'completed'
                                      ? 'completed'
                                      : ev.format === 'On-site'
                                        ? 'onsite'
                                        : 'today';
                                return (
                                  <div
                                    key={ev.id}
                                    role="button"
                                    tabIndex={0}
                                    className="rf2-intv__inline-cal-ev"
                                    data-tone={cardTone}
                                    data-selected={isSelected ? 'true' : undefined}
                                    onClick={() => setSelectedId(ev.id)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setSelectedId(ev.id);
                                      }
                                    }}
                                  >
                                    <div className="rf2-intv__inline-cal-ev-top">
                                      <span className="rf2-intv__inline-cal-ev-time">
                                        {ev.time} · {ev.durationLabel}
                                      </span>
                                      {ev.format === 'Video call' ? (
                                        <Video className="rf2-intv__inline-cal-ev-icon" aria-hidden="true" />
                                      ) : (
                                        <MapPin className="rf2-intv__inline-cal-ev-icon" aria-hidden="true" />
                                      )}
                                    </div>
                                    <div className="rf2-intv__inline-cal-ev-cand">
                                      <span className="rf2-intv__inline-cal-ev-av" aria-hidden="true">
                                        {ev.avatarInitials}
                                      </span>
                                      <span className="rf2-intv__inline-cal-ev-name">
                                        {ev.candidateName}
                                      </span>
                                    </div>
                                    <span className="rf2-intv__inline-cal-ev-role">{ev.jobTitle}</span>
                                    <div className="rf2-intv__inline-cal-ev-foot">
                                      <span className="rf2-intv__inline-cal-ev-site">
                                        {ev.site.replace('SGH ', '')}
                                      </span>
                                      <div className="rf2-intv__panel-stack" aria-hidden="true">
                                        {ev.panelBadges.slice(0, 2).map((b, i) => (
                                          <span
                                            key={i}
                                            className="rf2-intv__panel-av"
                                            data-tone={b.tone}
                                            style={{ width: 18, height: 18, fontSize: 8 }}
                                          >
                                            {b.initials}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <button
                                type="button"
                                className="rf2-intv__inline-cal-empty-btn"
                                onClick={openCreateDrawer}
                                aria-label={`Schedule interview on ${d.day} ${d.dateLabel} at ${h.label}`}
                              >
                                <Plus size={10} aria-hidden="true" />
                                <span>Add</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <div className="rf2-intv__inline-cal-foot">
                <div className="rf2-intv__inline-cal-stats">
                  <span className="rf2-intv__inline-cal-stat">
                    <strong>{calendarRows.length} interviews</strong> scheduled across 5 days
                  </span>
                  <span>·</span>
                  <span className="rf2-intv__inline-cal-stat">
                    <strong>{calendarRows.filter((r) => r.format === 'Video call').length} video</strong> &amp;{' '}
                    <strong>{calendarRows.filter((r) => r.format === 'On-site').length} on-site</strong>
                  </span>
                  <span>·</span>
                  <span className="rf2-intv__inline-cal-stat">
                    <strong>{calendarRows.filter((r) => r.statusTone === 'awaiting').length} awaiting</strong> scorecard feedback
                  </span>
                </div>
                <button
                  type="button"
                  className="rf2-intv__kpi-link"
                  onClick={() => {
                    setStatusTab('awaiting');
                    focusStatus('awaiting');
                  }}
                >
                  Filter pending feedback <ArrowRight size={12} aria-hidden="true" />
                </button>
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
              {selectedInterview ? (
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
                  aria-label="Download calendar (.ics)"
                  title="Download calendar (.ics)"
                  onClick={() => {
                    downloadIcs(selectedInterview.id)
                      .then((fn) => showToast(`✓ Downloaded ${fn}`))
                      .catch((err) => showToast(err instanceof Error && err.message ? `Failed to download calendar: ${err.message}` : 'Failed to download calendar (.ics).'));
                  }}
                >
                  <MoreVertical aria-hidden="true" />
                </button>
              </div>
              ) : null}
            </div>

            {selectedInterview ? (
            <>
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

            {/* Quick Action Bar — state-aware primary & secondary actions */}
            <div className="rf2-intv__detail-actions">
              {selectedInterview.statusTone === 'awaiting' ? (
                <>
                  <button
                    type="button"
                    className="rf2-intv__detail-cta"
                    data-primary="true"
                    onClick={() => openScorecardForRow(selectedInterview)}
                  >
                    <ClipboardCheck aria-hidden="true" />
                    <span>Fill scorecard</span>
                  </button>
                  <button
                    type="button"
                    className="rf2-intv__detail-cta"
                    onClick={() => {
                      sendScorecardReminder(selectedInterview.id)
                        .then(() =>
                          showToast(`✓ Sent scorecard reminder to pending panel for ${selectedInterview.candidateName}`),
                        )
                        .catch((err) =>
                          showToast(err instanceof Error && err.message ? `Failed to send reminder: ${err.message}` : 'Failed to send scorecard reminder.'),
                        );
                    }}
                  >
                    <Clock aria-hidden="true" />
                    <span>Send reminder</span>
                  </button>
                </>
              ) : selectedInterview.statusTone === 'completed' ? (
                <>
                  <button
                    type="button"
                    className="rf2-intv__detail-cta"
                    data-primary="true"
                    onClick={() => openScorecardForRow(selectedInterview)}
                  >
                    <ClipboardCheck aria-hidden="true" />
                    <span>View scorecard</span>
                  </button>
                  <button
                    type="button"
                    className="rf2-intv__detail-cta"
                    onClick={() => navigate(`/candidates?search=${encodeURIComponent(selectedInterview.candidateName)}`)}
                  >
                    <FileText aria-hidden="true" />
                    <span>Open file</span>
                  </button>
                </>
              ) : (
                <>
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
                  <button
                    type="button"
                    className="rf2-intv__detail-cta"
                    onClick={openEditDrawer}
                  >
                    <Calendar aria-hidden="true" />
                    <span>Reschedule</span>
                  </button>
                </>
              )}
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
            </>
            ) : (
              <p>Select an interview or schedule a new one to view details.</p>
            )}
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

          {selectedInterview ? (
          <section className="rf2-intv__side-card" aria-labelledby="recent-feedback-h">
            <div className="rf2-intv__side-head">
              <h3 id="recent-feedback-h" className="rf2-intv__side-title">
                Recent feedback
              </h3>
              <button
                type="button"
                className="rf2-intv__kpi-link"
                onClick={() => openScorecardForRow(selectedInterview)}
              >
                {selectedInterview.statusTone === 'completed' ? 'View scorecard ›' : 'Add scorecard ›'}
              </button>
            </div>
            <p>No scorecard feedback is recorded for this interview yet.</p>
          </section>
          ) : null}
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
