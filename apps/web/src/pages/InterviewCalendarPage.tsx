import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Interview } from '@recruitflow/contracts';
import { getApi } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { PageFrame } from '../components/ui/PageFrame';
import { PageState } from '../components/ui/PageState';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { InterviewWorkspaceNav } from '../components/ui/InterviewWorkspaceNav';
import { FastScorecardModal } from '../components/interview/FastScorecardModal';
import './PageEnhancementsV2.css';

const CALENDAR_START_HOUR = 8;
const CALENDAR_END_HOUR = 19;
// Saudi/Middle-East week starts Sunday (0)
const WEEK_START_DAY = 0;

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_ABBREVS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function startOfWeek(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const diff = (date.getDay() - WEEK_START_DAY + 7) % 7;
  date.setDate(date.getDate() - diff);
  return date;
}

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

function addMonths(base: Date, n: number): Date {
  const d = new Date(base);
  d.setMonth(d.getMonth() + n);
  return d;
}

function toDateInputValue(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function sameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatCalendarRange(days: Date[]) {
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) return '';
  const year = first.getFullYear();
  const firstMonth = first.toLocaleDateString('en-US', { month: 'long' });
  const lastMonth = last.toLocaleDateString('en-US', { month: 'long' });
  if (firstMonth === lastMonth && year === last.getFullYear()) {
    return `${year}, ${firstMonth} ${first.getDate()}–${last.getDate()}`;
  }
  return `${year}, ${firstMonth} ${first.getDate()} – ${lastMonth} ${last.getDate()}`;
}

function formatHourLabel(hour: number) {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour} ${period}`;
}

function getEventTheme(event: Interview) {
  const text = `${event.interviewType || ''} ${event.title || ''}`.toLowerCase();
  if (text.includes('tech') || text.includes('clin') || text.includes('code') || text.includes('skill')) {
    return {
      colorClass: 'rf-outlook-event-card--blue',
      badgeTone: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      borderAccent: 'border-l-blue-600',
    };
  }
  if (text.includes('panel') || text.includes('culture') || text.includes('final') || text.includes('exec') || text.includes('board')) {
    return {
      colorClass: 'rf-outlook-event-card--purple',
      badgeTone: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800',
      borderAccent: 'border-l-purple-600',
    };
  }
  if (text.includes('screen') || text.includes('hr') || text.includes('initial') || text.includes('phone')) {
    return {
      colorClass: 'rf-outlook-event-card--emerald',
      badgeTone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      borderAccent: 'border-l-emerald-600',
    };
  }
  return {
    colorClass: 'rf-outlook-event-card--amber',
    badgeTone: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    borderAccent: 'border-l-amber-600',
  };
}

function parsePlatform(locationUrl?: string | null): {
  label: string;
  icon: 'video' | 'map-pin' | 'link';
  isOnline: boolean;
} {
  if (!locationUrl) return { label: 'In-Person', icon: 'map-pin', isOnline: false };
  const lower = locationUrl.toLowerCase();
  if (lower.includes('teams.microsoft.com') || lower.includes('teams')) {
    return { label: 'Teams', icon: 'video', isOnline: true };
  }
  if (lower.includes('meet.google.com') || lower.includes('meet')) {
    return { label: 'Google Meet', icon: 'video', isOnline: true };
  }
  if (lower.includes('zoom.us')) {
    return { label: 'Zoom', icon: 'video', isOnline: true };
  }
  if (lower.startsWith('http')) {
    return { label: 'Online Meeting', icon: 'link', isOnline: true };
  }
  return {
    label: locationUrl.length > 16 ? `${locationUrl.slice(0, 15)}…` : locationUrl,
    icon: 'map-pin',
    isOnline: false,
  };
}

function cleanDisplayName(name?: string | null): string {
  if (!name) return 'Interviewer';
  if (name.includes('1788') || name.includes('OrgA')) {
    const m = name.match(/User\s+Org[A-Z]/i) || name.match(/Dr\.\s+[A-Za-z]+/i);
    if (m) return m[0];
  }
  if (name.length > 22) return `${name.slice(0, 20)}…`;
  return name;
}

function formatSlotTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return '';
  }
}

function formatDateFull(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

function formatDuration(startStr: string, endStr?: string): string {
  try {
    const start = new Date(startStr);
    const end = endStr ? new Date(endStr) : new Date(start.getTime() + 45 * 60000);
    const mins = Math.round((end.getTime() - start.getTime()) / 60000);
    return `${mins} min`;
  } catch {
    return '45 min';
  }
}

// ─── Mini Month Picker ────────────────────────────────────────────────────────

interface MiniMonthPickerProps {
  selected: Date;
  onPickDate: (d: Date) => void;
  onClose: () => void;
}

function MiniMonthPicker({ selected, onPickDate, onClose }: MiniMonthPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(selected);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Close on outside click or Escape
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Build calendar grid cells
  const calDays = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = (firstOfMonth.getDay() - WEEK_START_DAY + 7) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewMonth]);

  const selectedWeekStart = startOfWeek(selected);

  return (
    <div
      ref={ref}
      className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-4 w-72 select-none"
      role="dialog"
      aria-label="Jump to date"
    >
      {/* Month nav header */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setViewMonth(m => addMonths(m, -1))}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
          aria-label="Previous month"
        >
          <Icon name="chevron-left" size={14} />
        </button>
        <span className="text-sm font-extrabold text-slate-900 dark:text-white">
          {MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </span>
        <button
          type="button"
          onClick={() => setViewMonth(m => addMonths(m, 1))}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
          aria-label="Next month"
        >
          <Icon name="chevron-right" size={14} />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {Array.from({ length: 7 }, (_, i) => {
          const dayIdx = (WEEK_START_DAY + i) % 7;
          return (
            <div key={i} className="text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 py-1">
              {DAY_ABBREVS[dayIdx]}
            </div>
          );
        })}
      </div>

      {/* Calendar day grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {calDays.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} />;
          const isToday = sameDay(day, today);
          const isInSelectedWeek = sameDay(startOfWeek(day), selectedWeekStart);
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => { onPickDate(day); onClose(); }}
              className={`relative h-8 w-full rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isInSelectedWeek
                  ? 'bg-blue-600 text-white shadow-sm'
                  : isToday
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              aria-label={day.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
              aria-pressed={isInSelectedWeek}
            >
              {day.getDate()}
              {isToday && !isInSelectedWeek && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Footer: Go to today + date input */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 gap-2">
        <button
          type="button"
          onClick={() => { onPickDate(today); onClose(); }}
          className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
        >
          Go to Today
        </button>
        <input
          type="date"
          defaultValue={toDateInputValue(selected)}
          onChange={(e) => {
            if (!e.target.value) return;
            const [yyyy, mm, dd] = e.target.value.split('-').map(Number);
            if (yyyy && mm && dd) { onPickDate(new Date(yyyy, mm - 1, dd)); onClose(); }
          }}
          className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-slate-700 dark:text-slate-200 cursor-pointer focus:ring-2 focus:ring-blue-500 focus:outline-none"
          aria-label="Jump to specific date"
        />
      </div>
    </div>
  );
}

type ViewMode = 'week' | 'day';

export function InterviewCalendarPage() {

  const { user } = useAuth();
  const canSchedule = Boolean(user?.permissions.includes('APPLICATION_MOVE_STAGE'));

  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [anchorDate, setAnchorDate] = useState<Date>(() => startOfWeek(new Date()));
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());

  const [scope, setScope] = useState<'all' | 'mine'>('all');
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const [selectedEvent, setSelectedEvent] = useState<Interview | null>(null);
  const [scorecardInterview, setScorecardInterview] = useState<Interview | null>(null);
  const [dayModalEvents, setDayModalEvents] = useState<{ day: Date; hour: number; events: Interview[] } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isDownloadingIcs, setIsDownloadingIcs] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setInterviews(await getApi<Interview[]>('/interviews'));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load the interview calendar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Derived counts & filtered list ──
  const myCount = useMemo(() => {
    if (!user?.id) return 0;
    return interviews.filter((i) =>
      (Array.isArray(i.attendees) && i.attendees.some((a) => a.userId === user.id)) ||
      i.candidateName === user.displayName
    ).length;
  }, [interviews, user]);

  const filteredInterviews = useMemo(() => {
    if (scope === 'mine' && user?.id) {
      return interviews.filter((i) =>
        (Array.isArray(i.attendees) && i.attendees.some((a) => a.userId === user.id)) ||
        i.candidateName === user.displayName
      );
    }
    return interviews;
  }, [interviews, scope, user]);

  const slots = useMemo<number[]>(() =>
    Array.from({ length: CALENDAR_END_HOUR - CALENDAR_START_HOUR + 1 }, (_, i) => CALENDAR_START_HOUR + i),
  []);

  // ── Keyboard navigation (← prev, → next, T = today) ──
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (isPickerOpen || selectedEvent || dayModalEvents || scorecardInterview) return;
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); goBack(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); goForward(); }
      else if (e.key === 't' || e.key === 'T') goToday();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  // ── Derived: visible days ──
  const days = useMemo<Date[]>(() => {
    if (viewMode === 'day') return [new Date(anchorDate)];
    return Array.from({ length: 7 }, (_, i) => addDays(anchorDate, i));
  }, [anchorDate, viewMode]);

  // ── Stable event lookup map: key = "Y-M-D:H" ──
  const eventMap = useMemo(() => {
    const map = new Map<string, Interview[]>();
    for (const iv of filteredInterviews) {
      const s = new Date(iv.scheduledStart);
      const key = `${s.getFullYear()}-${s.getMonth()}-${s.getDate()}:${s.getHours()}`;
      const bucket = map.get(key) ?? [];
      bucket.push(iv);
      map.set(key, bucket);
    }
    return map;
  }, [filteredInterviews]);

  const eventsFor = useCallback((day: Date, hour: number): Interview[] => {
    const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}:${hour}`;
    return eventMap.get(key) ?? [];
  }, [eventMap]);

  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  // ── Navigation callbacks ──
  const goBack = useCallback(() =>
    setAnchorDate(prev => viewMode === 'day' ? addDays(prev, -1) : addDays(prev, -7)),
  [viewMode]);
  const goForward = useCallback(() =>
    setAnchorDate(prev => viewMode === 'day' ? addDays(prev, 1) : addDays(prev, 7)),
  [viewMode]);
  const goToday = useCallback(() => {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    setAnchorDate(viewMode === 'day' ? t : startOfWeek(t));
  }, [viewMode]);
  const handlePickDate = useCallback((picked: Date) => {
    const d = new Date(picked); d.setHours(0, 0, 0, 0);
    setAnchorDate(viewMode === 'day' ? d : startOfWeek(d));
  }, [viewMode]);

  const isViewingCurrentPeriod = viewMode === 'day'
    ? sameDay(anchorDate, now)
    : days.some(d => sameDay(d, now));

  const rangeLabel = viewMode === 'day'
    ? anchorDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : formatCalendarRange(days);

  const handleDownloadIcs = async (interviewId: string, interviewTitle: string) => {
    try {
      setIsDownloadingIcs(true);
      const res = await fetch(`/api/v1/interviews/${interviewId}/ics`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Failed to export calendar file');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(interviewTitle || 'interview').replace(/[^a-zA-Z0-9_-]/g, '_')}.ics`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setToastMessage('Calendar invite (.ics) downloaded successfully.');
      setTimeout(() => setToastMessage(null), 3500);
    } catch {
      setToastMessage('Unable to download .ics invite.');
      setTimeout(() => setToastMessage(null), 3500);
    } finally {
      setIsDownloadingIcs(false);
    }
  };

  return (
    <PageFrame
      eyebrow="Recruitment Operations"
      title="Interview Calendar"
      description={`${viewMode === 'week' ? 'Week' : 'Day'} view · ${rangeLabel} · local timezone.`}
    >
      {error && (
        <Alert
          tone="danger"
          title="Interview calendar unavailable"
          action={
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              <Icon name="refresh-cw" size={13} />
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      <InterviewWorkspaceNav canSchedule={canSchedule} />

      <div className="rf-outlook-calendar">
        {/* ── Toolbar ── */}
        <div className="rf-outlook-calendar__toolbar flex flex-wrap items-center justify-between gap-3">

          {/* Left group: Today + View Mode + Scope */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`rf-outlook-calendar__today-btn${isViewingCurrentPeriod ? ' ring-2 ring-blue-500/30' : ''}`}
              onClick={goToday}
              title="Go to current period (T)"
            >
              <Icon name="calendar" size={13} />
              <span>Today</span>
            </button>

            {/* Day / Week toggle */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs">
              {(['week', 'day'] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    if (mode === 'week' && viewMode === 'day') {
                      setAnchorDate(startOfWeek(anchorDate));
                    } else if (mode === 'day' && viewMode === 'week') {
                      const todayInWeek = days.find(d => sameDay(d, now)) ?? days[0]!;
                      const next = new Date(todayInWeek); next.setHours(0, 0, 0, 0);
                      setAnchorDate(next);
                    }
                    setViewMode(mode);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer capitalize ${
                    viewMode === mode
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* All / Mine scope toggle */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  scope === 'all'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                All ({interviews.length})
              </button>
              <button
                type="button"
                onClick={() => setScope('mine')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                  scope === 'mine'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Icon name="user" size={11} />
                <span>Mine ({myCount})</span>
              </button>
            </div>
          </div>

          {/* Center: Prev / Next */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              className="rf-outlook-calendar__nav-btn"
              aria-label={`Previous ${viewMode}`}
              onClick={goBack}
              title={`Previous ${viewMode} (← key)`}
            >
              <Icon name="chevron-left" size={15} />
            </button>
            <button
              type="button"
              className="rf-outlook-calendar__nav-btn"
              aria-label={`Next ${viewMode}`}
              onClick={goForward}
              title={`Next ${viewMode} (→ key)`}
            >
              <Icon name="chevron-right" size={15} />
            </button>
          </div>

          {/* Right: Date range title → opens mini month picker */}
          <div className="relative">
            <button
              type="button"
              className="rf-outlook-calendar__title inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1.5 rounded-xl transition"
              onClick={() => setIsPickerOpen(o => !o)}
              aria-expanded={isPickerOpen}
              aria-haspopup="dialog"
              title="Click to jump to a specific date"
            >
              <Icon name="calendar" size={13} className="text-rf-ink-muted" />
              <span>{rangeLabel}</span>
              <Icon
                name="chevron-down"
                size={13}
                className={`text-rf-ink-muted transition-transform duration-200 ${isPickerOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isPickerOpen && (
              <MiniMonthPicker
                selected={anchorDate}
                onPickDate={handlePickDate}
                onClose={() => setIsPickerOpen(false)}
              />
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-8">
            <PageState
              kind="loading"
              title="Loading interview calendar"
              description="Fetching scheduled interviews and participant schedules."
            />
          </div>
        ) : (
          <div
            className="rf-outlook-calendar__scroll rf-scrollbar"
            role="region"
            aria-label="Interview calendar grid"
            tabIndex={0}
          >
            <div
              className="rf-outlook-calendar__grid"
              role="grid"
              aria-label={`Interview calendar ${viewMode} view`}
              style={viewMode === 'day' ? { gridTemplateColumns: '64px 1fr' } : undefined}
            >
              {/* Header Row: Corner + 7 Days */}
              <div className="rf-outlook-calendar__header-row" role="row">
                <div className="rf-outlook-calendar__corner" role="columnheader" />
                {days.map((day) => {
                  const isToday = sameDay(day, now);
                  return (
                    <div
                      key={day.toISOString()}
                      className={`rf-outlook-calendar__day-header ${isToday ? 'is-today' : ''}`}
                      role="columnheader"
                    >
                      <span className="rf-outlook-calendar__day-number">{day.getDate()}</span>
                      <span className="rf-outlook-calendar__day-name">
                        {day.toLocaleDateString('en-US', { weekday: 'short' })}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Time Slots Grid */}
              {slots.map((hour) => (
                <div key={hour} className="contents" role="row">
                  {/* Time Rowheader */}
                  <div className="rf-outlook-calendar__time-label" role="rowheader">
                    <span>{formatHourLabel(hour)}</span>
                  </div>

                  {/* 7 Days Cells for this Hour */}
                  {days.map((day) => {
                    const isToday = sameDay(day, now);
                    const dayEvents = eventsFor(day, hour);
                    const isCurrentSlot = isToday && currentHour === hour;

                    return (
                      <div
                        key={`${day.toISOString()}-${hour}`}
                        className={`rf-outlook-calendar__cell ${isToday ? 'is-today' : ''}`}
                        role="gridcell"
                      >
                        {/* Half-hour dashed line */}
                        <div className="rf-outlook-calendar__half-hour-line" />

                        {/* Current time indicator */}
                        {isCurrentSlot && (
                          <div
                            className="rf-outlook-calendar__now-indicator"
                            style={{ top: `${(currentMinute / 60) * 100}%` }}
                          >
                            <div className="rf-outlook-calendar__now-dot" />
                            <div className="rf-outlook-calendar__now-line" />
                          </div>
                        )}

                        {/* Event Cards in Side-by-Side Flex Row (Zero downward overflow) */}
                        {dayEvents.length > 0 && (
                          <div className="rf-outlook-calendar__events-container">
                            {dayEvents.slice(0, 2).map((event) => {
                              const theme = getEventTheme(event);
                              const platform = parsePlatform(event.locationUrl);
                              const candidateDisplay = cleanDisplayName(
                                event.candidateName || event.title || 'Candidate'
                              );
                              const attendeeText = cleanDisplayName(
                                event.attendees?.[0]?.userName || 'Interviewer'
                              );
                              const timeStr = formatSlotTime(event.scheduledStart);
                              const roundType = (event.interviewType || 'INTERVIEW').toUpperCase();

                              return (
                                <button
                                  key={event.id}
                                  type="button"
                                  onClick={() => setSelectedEvent(event)}
                                  className={`rf-outlook-event-card ${theme.colorClass}`}
                                  title={`${event.title || 'Interview'} • Click to preview details`}
                                >
                                  <div className="rf-outlook-event-card__header">
                                    <span className="rf-outlook-event-card__type-tag" title={roundType}>
                                      {roundType}
                                    </span>
                                    <span className="rf-outlook-event-card__time-pill">{timeStr}</span>
                                  </div>

                                  <div className="rf-outlook-event-card__title" title={candidateDisplay}>
                                    {candidateDisplay}
                                  </div>

                                  <div className="rf-outlook-event-card__candidate" title={attendeeText}>
                                    <Icon name="user" size={10} className="shrink-0 opacity-70" />
                                    <span className="truncate">{attendeeText}</span>
                                  </div>

                                  <div className="rf-outlook-event-card__footer">
                                    <span className="rf-outlook-event-card__platform-badge">
                                      <Icon name={platform.icon} size={9} className="shrink-0" />
                                      <span>{platform.label}</span>
                                    </span>
                                  </div>
                                </button>
                              );
                            })}

                            {dayEvents.length > 2 && (
                              <button
                                type="button"
                                className="rf-outlook-calendar__more-badge"
                                onClick={() => setDayModalEvents({ day, hour, events: dayEvents })}
                                title={`View all ${dayEvents.length} interviews at ${formatHourLabel(hour)}`}
                              >
                                +{dayEvents.length - 2}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Keyboard shortcuts hint bar */}
        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-4 text-[10.5px] text-slate-400 dark:text-slate-600 select-none">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[9px] text-slate-500 border border-slate-200 dark:border-slate-700">←</kbd>
            <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[9px] text-slate-500 border border-slate-200 dark:border-slate-700">→</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[9px] text-slate-500 border border-slate-200 dark:border-slate-700">T</kbd>
            Today
          </span>
          <span className="ml-auto">
            {filteredInterviews.length} interview{filteredInterviews.length !== 1 ? 's' : ''} in view
          </span>
        </div>
      </div>

      {/* Quick-View Event Modal */}
      {selectedEvent && (
        <Modal
          isOpen={Boolean(selectedEvent)}
          onClose={() => setSelectedEvent(null)}
          title="Interview Dossier & Meeting"
          maxWidthClass="max-w-xl"
        >
          <div className="space-y-4 text-xs">
            {(() => {
              const theme = getEventTheme(selectedEvent);
              const platform = parsePlatform(selectedEvent.locationUrl);
              const duration = formatDuration(selectedEvent.scheduledStart, selectedEvent.scheduledEnd);
              const candidateName = selectedEvent.candidateName || 'Candidate';
              const positionTitle = selectedEvent.positionTitle || 'Position Not Specified';

              return (
                <>
                  {/* Top Banner with Type, Status & Code */}
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded-md font-extrabold text-[10px] tracking-wider uppercase border ${theme.badgeTone}`}>
                          {selectedEvent.interviewType || 'INTERVIEW'}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[10px]">
                          {selectedEvent.status}
                        </span>
                      </div>
                      <h3 className="font-extrabold text-slate-900 dark:text-white text-base leading-tight">
                        {candidateName}
                      </h3>
                      <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 flex items-center gap-1.5">
                        <Icon name="vacancy" size={12} className="text-slate-400" />
                        <span>{positionTitle}</span>
                        {selectedEvent.interviewCode && (
                          <>
                            <span>&bull;</span>
                            <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400">
                              {selectedEvent.interviewCode}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Time & Scheduling Card */}
                  <div className="p-3 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/60 space-y-2">
                    <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                      <div className="flex items-center gap-2">
                        <Icon name="calendar" size={14} className="text-blue-500" />
                        <span className="font-bold">{formatDateFull(selectedEvent.scheduledStart)}</span>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-500">{duration}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 pl-5 text-[11px]">
                      <Icon name="clock" size={12} className="text-slate-400" />
                      <span>
                        {formatSlotTime(selectedEvent.scheduledStart)} – {formatSlotTime(selectedEvent.scheduledEnd)} (Device Time)
                      </span>
                    </div>
                  </div>

                  {/* Meeting Link / Location */}
                  <div className="p-3 bg-blue-50/50 dark:bg-blue-950/30 rounded-xl border border-blue-200/60 dark:border-blue-800/50 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                        <Icon name={platform.icon} size={15} />
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-slate-900 dark:text-white block text-xs truncate">
                          {platform.label}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 text-[11px] truncate block">
                          {selectedEvent.locationUrl || 'On-site interview at hospital facility'}
                        </span>
                      </div>
                    </div>

                    {platform.isOnline && selectedEvent.locationUrl && (
                      <a
                        href={selectedEvent.locationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shrink-0 flex items-center gap-1.5 shadow-sm transition"
                      >
                        <span>Join Meeting</span>
                        <Icon name="external-link" size={12} />
                      </a>
                    )}
                  </div>

                  {/* Panelists / Attendees */}
                  <div>
                    <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Interview Panel &amp; Participants
                    </span>
                    <div className="space-y-1.5">
                      {Array.isArray(selectedEvent.attendees) && selectedEvent.attendees.length > 0 ? (
                        selectedEvent.attendees.map((attendee, idx) => (
                          <div
                            key={idx}
                            className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-700 dark:text-slate-300">
                                {attendee.userName?.[0]?.toUpperCase() || 'P'}
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 dark:text-white block">
                                  {attendee.userName || 'Panel Member'}
                                </span>
                                <span className="text-slate-400 text-[10px] block">
                                  {attendee.role || 'Evaluator'} &bull; Status: {attendee.response || 'Invited'}
                                </span>
                              </div>
                            </div>
                            <span className="text-[10px] font-semibold text-slate-500">
                              {attendee.role || 'Evaluator'}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-slate-400 text-xs italic p-2 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                          Assigned to recruitment panel
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Modal Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const id = selectedEvent.id;
                          const title = selectedEvent.title || 'interview';
                          void handleDownloadIcs(id, title);
                        }}
                        disabled={isDownloadingIcs}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition"
                        title="Download RFC 5545 .ics calendar event"
                      >
                        <Icon name="download" size={12} />
                        <span>{isDownloadingIcs ? 'Downloading...' : 'Export .ics'}</span>
                      </button>

                      {selectedEvent.applicationId && (
                        <Link
                          to={`/applications/${selectedEvent.applicationId}`}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs flex items-center gap-1.5 transition"
                        >
                          <Icon name="user" size={12} />
                          <span>Candidate Dossier</span>
                        </Link>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const ev = selectedEvent;
                          setSelectedEvent(null);
                          setScorecardInterview(ev);
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition"
                      >
                        <Icon name="check-circle" size={12} />
                        <span>Submit Scorecard</span>
                      </button>

                      <Link
                        to={`/interviews/${selectedEvent.id}`}
                        className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition"
                      >
                        <span>Workspace</span>
                        <Icon name="arrow-right" size={12} />
                      </Link>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </Modal>
      )}

      {/* All Events in Hour Slot Modal */}
      {dayModalEvents && (
        <Modal
          isOpen={Boolean(dayModalEvents)}
          onClose={() => setDayModalEvents(null)}
          title={`Interviews at ${formatHourLabel(dayModalEvents.hour)} • ${dayModalEvents.day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`}
          maxWidthClass="max-w-xl"
        >
          <div className="space-y-2.5 text-xs">
            <p className="text-slate-500 dark:text-slate-400">
              {dayModalEvents.events.length} interviews scheduled during this time slot.
            </p>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {dayModalEvents.events.map((event) => {
                const theme = getEventTheme(event);
                const platform = parsePlatform(event.locationUrl);
                const timeStr = `${formatSlotTime(event.scheduledStart)} – ${formatSlotTime(event.scheduledEnd)}`;
                const candidateName = event.candidateName || event.title;

                return (
                  <div
                    key={event.id}
                    className={`p-3 rounded-xl border bg-slate-50/70 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3 ${theme.borderAccent}`}
                    style={{ borderLeftWidth: '3.5px' }}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded font-extrabold text-[10px] tracking-wider uppercase border ${theme.badgeTone}`}>
                          {event.interviewType || 'INTERVIEW'}
                        </span>
                        <span className="text-slate-500 font-bold text-[11px]">{timeStr}</span>
                      </div>
                      <h4 className="font-extrabold text-slate-900 dark:text-white text-xs truncate">
                        {candidateName}
                      </h4>
                      <div className="flex items-center gap-2 text-slate-500 text-[11px] mt-0.5">
                        <span>{event.positionTitle || 'Position'}</span>
                        <span>&bull;</span>
                        <span className="inline-flex items-center gap-1">
                          <Icon name={platform.icon} size={10} />
                          {platform.label}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setDayModalEvents(null);
                          setSelectedEvent(event);
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs transition cursor-pointer"
                      >
                        Quick View
                      </button>
                      {platform.isOnline && event.locationUrl && (
                        <a
                          href={event.locationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
                          title="Join Video Meeting"
                        >
                          <Icon name="video" size={13} />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Modal>
      )}

      {/* Fast Scorecard Modal */}
      <FastScorecardModal
        isOpen={Boolean(scorecardInterview)}
        onClose={() => setScorecardInterview(null)}
        interview={scorecardInterview}
        onSuccess={() => {
          setToastMessage('Scorecard submitted and permanently locked!');
          setTimeout(() => setToastMessage(null), 3500);
          void load();
        }}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2">
          <Icon name="check-circle" size={14} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </PageFrame>
  );
}
