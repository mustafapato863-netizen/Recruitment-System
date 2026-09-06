import { useCallback, useEffect, useMemo, useState } from 'react';
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
const CALENDAR_END_HOUR = 19; // 8 AM to 7 PM

function startOfWeek(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay(); // 0 = Sunday
  date.setDate(date.getDate() - day);
  return date;
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

export function InterviewCalendarPage() {
  const { user } = useAuth();
  const canSchedule = Boolean(user?.permissions.includes('APPLICATION_MOVE_STAGE'));

  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [anchorDate, setAnchorDate] = useState(() => startOfWeek(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  // Scope: All vs My Interviews
  const [scope, setScope] = useState<'all' | 'mine'>('all');

  // Interactive Modals & Actions
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

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(anchorDate);
      day.setDate(anchorDate.getDate() + index);
      return day;
    });
  }, [anchorDate]);

  const slots = useMemo(() => {
    return Array.from(
      { length: CALENDAR_END_HOUR - CALENDAR_START_HOUR + 1 },
      (_, index) => CALENDAR_START_HOUR + index,
    );
  }, []);

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

  const eventsFor = (day: Date, hour: number) =>
    filteredInterviews.filter((interview) => {
      const start = new Date(interview.scheduledStart);
      return sameDay(start, day) && start.getHours() === hour;
    });

  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

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
      description={`Week view for scheduled interviews · ${formatCalendarRange(days)} · local timezone display.`}
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
        {/* Calendar Toolbar */}
        <div className="rf-outlook-calendar__toolbar flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rf-outlook-calendar__today-btn"
              onClick={() => setAnchorDate(startOfWeek(new Date()))}
            >
              <Icon name="calendar" size={13} />
              <span>Today</span>
            </button>

            {/* My Interviews scope toggle */}
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
                <span>My Interviews ({myCount})</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              className="rf-outlook-calendar__nav-btn"
              aria-label="Previous week"
              onClick={() => {
                const prev = new Date(anchorDate);
                prev.setDate(prev.getDate() - 7);
                setAnchorDate(prev);
              }}
            >
              <Icon name="chevron-left" size={15} />
            </button>
            <button
              type="button"
              className="rf-outlook-calendar__nav-btn"
              aria-label="Next week"
              onClick={() => {
                const next = new Date(anchorDate);
                next.setDate(next.getDate() + 7);
                setAnchorDate(next);
              }}
            >
              <Icon name="chevron-right" size={15} />
            </button>
          </div>

          <div
            className="rf-outlook-calendar__title"
            onClick={() => setAnchorDate(startOfWeek(new Date()))}
            title="Jump to current week"
          >
            <span>{formatCalendarRange(days)}</span>
            <Icon name="chevron-down" size={14} className="text-rf-ink-muted" />
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
            <div className="rf-outlook-calendar__grid" role="grid" aria-label="Interview calendar week view">
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
