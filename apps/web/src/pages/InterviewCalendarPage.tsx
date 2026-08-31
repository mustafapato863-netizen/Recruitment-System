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
import { InterviewWorkspaceNav } from '../components/ui/InterviewWorkspaceNav';
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

export function InterviewCalendarPage() {
  const { user } = useAuth();
  const canSchedule = Boolean(user?.permissions.includes('APPLICATION_MOVE_STAGE'));
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [anchorDate, setAnchorDate] = useState(() => startOfWeek(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

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

  const eventsFor = (day: Date, hour: number) =>
    interviews.filter((interview) => {
      const start = new Date(interview.scheduledStart);
      return sameDay(start, day) && start.getHours() === hour;
    });

  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

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
        <div className="rf-outlook-calendar__toolbar">
          <button
            type="button"
            className="rf-outlook-calendar__today-btn"
            onClick={() => setAnchorDate(startOfWeek(new Date()))}
          >
            <Icon name="calendar" size={13} />
            <span>Today</span>
          </button>

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

                        {/* Event Cards */}
                        {dayEvents.map((event) => {
                          const attendeeText =
                            event.attendees?.[0]?.userName ||
                            event.candidateName ||
                            'Interviewer';
                          const platformText =
                            event.locationUrl || 'Microsoft Teams Meeting';

                          return (
                            <Link
                              key={event.id}
                              to={`/interviews/${event.id}`}
                              className="rf-outlook-event-card"
                              title={`${event.title} (${event.status})`}
                            >
                              <div className="rf-outlook-event-card__header">
                                <div className="rf-outlook-event-card__title-wrap">
                                  <Icon name="chat" size={11} className="text-rf-action shrink-0" />
                                  <span className="rf-outlook-event-card__title">
                                    {event.title || 'Performance Team Meeting'}
                                  </span>
                                </div>
                                <Icon
                                  name="refresh-cw"
                                  size={10}
                                  className="text-rf-ink-muted/70 shrink-0"
                                />
                              </div>
                              <div className="rf-outlook-event-card__subtitle">{platformText}</div>
                              <div className="rf-outlook-event-card__attendee">{attendeeText}</div>
                            </Link>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageFrame>
  );
}
