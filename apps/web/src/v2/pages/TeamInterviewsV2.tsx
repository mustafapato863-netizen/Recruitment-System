import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, CircleAlert, CircleCheck, Download, Info, RotateCw, Users } from 'lucide-react';
import { ButtonV2, EmptyStateV2, ForbiddenStateV2, SkeletonV2, StatusChip } from '../../components/v2';
import { getApi } from '../../api/client';
import { downloadErrorMessage, downloadIcs, listMyInterviews, type MyInterview } from '../../api/myInterviews';
import { useCachedResource } from '../api/useCachedResource';
import { getInitials } from '../userIdentity';
import './jobs.css';
import './team.css';

type Bucket = 'upcoming' | 'feedback' | 'completed';
type Scope = 'mine' | 'team';
type View = 'list' | 'calendar';

interface Row {
  id: string;
  candidate: string;
  job: string;
  start: string;
  end: string;
  timezone: string | null;
  status: string;
  scorecard: MyInterview['scorecardStatus'] | null;
  applicationId: string | null;
  mine: boolean;
}

const CAIRO = 'Africa/Cairo';
const clock = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone: CAIRO, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
const statusTone = (status: string): 'danger' | 'success' | 'info' => (status === 'Cancelled' || status === 'No-show' ? 'danger' : status === 'Completed' ? 'success' : 'info');
const dayKey = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: CAIRO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
const dayLabel = (key: string) => new Intl.DateTimeFormat('en-GB', { timeZone: CAIRO, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${key}T12:00:00Z`));
const dayFullLabel = (key: string) => new Intl.DateTimeFormat('en-GB', { timeZone: CAIRO, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${key}T12:00:00Z`));
const monthLabel = (d: Date) => new Intl.DateTimeFormat('en-GB', { timeZone: CAIRO, month: 'long', year: 'numeric' }).format(d);
const weekRangeLabel = (days: Date[]) => {
  if (!days.length) return '';
  const first = days[0];
  const last = days[days.length - 1];
  const startFmt = new Intl.DateTimeFormat('en-GB', { timeZone: CAIRO, day: 'numeric', month: 'short' }).format(first);
  const endFmt = new Intl.DateTimeFormat('en-GB', { timeZone: CAIRO, day: 'numeric', month: 'short', year: 'numeric' }).format(last);
  return `${startFmt} – ${endFmt}`;
};

interface MonthCell {
  date: Date;
  key: string;
  dayNumber: number;
  isOtherMonth: boolean;
}

function buildMonthCells(viewDate: Date): MonthCell[] {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstDayOfWeek = firstDay.getDay(); // 0 is Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: MonthCell[] = [];

  // Previous month trailing days
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const date = new Date(year, month - 1, d, 12);
    cells.push({
      date,
      key: dayKey(date.toISOString()),
      dayNumber: d,
      isOtherMonth: true,
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d, 12);
    cells.push({
      date,
      key: dayKey(date.toISOString()),
      dayNumber: d,
      isOtherMonth: false,
    });
  }

  // Next month leading days to complete 7-day grid
  const remainder = cells.length % 7;
  const trailingNeeded = remainder === 0 ? 0 : 7 - remainder;
  for (let d = 1; d <= trailingNeeded; d++) {
    const date = new Date(year, month + 1, d, 12);
    cells.push({
      date,
      key: dayKey(date.toISOString()),
      dayNumber: d,
      isOtherMonth: true,
    });
  }

  return cells;
}

function buildWeekDays(viewDate: Date): Date[] {
  const date = new Date(viewDate);
  date.setHours(12, 0, 0, 0);
  const day = date.getDay(); // 0 is Sunday
  const sunday = new Date(date);
  sunday.setDate(sunday.getDate() - day);

  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

function bucketOf(row: Row, now: number): Bucket {
  const end = new Date(row.end).getTime();
  const future = Number.isFinite(end) && end >= now && (row.status === 'Scheduled' || row.status === 'Rescheduled');
  if (future) return 'upcoming';
  if (row.status === 'Scheduled' || row.status === 'Rescheduled') return 'feedback';
  if (row.mine && row.scorecard !== 'submitted' && row.status !== 'Cancelled' && row.status !== 'No-show') return 'feedback';
  return 'completed';
}

const eventTone = (row: Row, now: number): 'blue' | 'green' | 'amber' | 'red' => {
  if (row.status === 'Cancelled' || row.status === 'No-show') return 'red';
  if (row.status === 'Completed') return 'green';
  if (bucketOf(row, now) === 'feedback') return 'amber';
  return 'blue';
};

function fromMine(item: MyInterview): Row {
  return {
    id: item.id, candidate: item.candidateName, job: item.positionTitle ?? item.title, start: item.scheduledStart, end: item.scheduledEnd,
    timezone: item.timezone, status: item.status, scorecard: item.scorecardStatus, applicationId: null, mine: true,
  };
}

function fromTeam(raw: Record<string, unknown>, mineIds: Set<string>): Row | null {
  const id = typeof raw.id === 'string' ? raw.id : '';
  if (!id) return null;
  const start = typeof raw.scheduledStart === 'string' ? raw.scheduledStart : '';
  const end = typeof raw.scheduledEnd === 'string' ? raw.scheduledEnd : start;
  if (!start) return null;
  return {
    id,
    candidate: typeof raw.candidateName === 'string' && raw.candidateName.trim() ? raw.candidateName : 'Candidate',
    job: typeof raw.positionTitle === 'string' && raw.positionTitle.trim() ? raw.positionTitle : (typeof raw.title === 'string' ? raw.title : 'Interview'),
    start, end,
    timezone: typeof raw.timezone === 'string' ? raw.timezone : null,
    status: typeof raw.status === 'string' ? raw.status : 'Scheduled',
    scorecard: null,
    applicationId: typeof raw.applicationId === 'string' ? raw.applicationId : null,
    mine: mineIds.has(id),
  };
}

function InterviewLinks({ row }: { row: Row }) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const exportCalendar = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      // Reuse the V1 server-authorized ICS download: no new candidate data or permissions.
      await downloadIcs(row.id);
    } catch (error) {
      setDownloadError(downloadErrorMessage(error, 'calendar file'));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      {row.mine ? <Link className="rf2-btn rf2-btn--secondary rf2-btn--sm" to={`/my-interviews?interview=${encodeURIComponent(row.id)}&scorecard=1`}>Open my scorecard</Link> : null}
      {row.applicationId ? <Link className="rf2-btn rf2-btn--secondary rf2-btn--sm" to={`/applications/${encodeURIComponent(row.applicationId)}`}>Open file</Link> : null}
      <ButtonV2 kind="secondary" size="sm" icon={<Download aria-hidden="true" />} disabled={downloading} onClick={() => void exportCalendar()}>
        {downloading ? 'Downloading…' : 'Download calendar'}
      </ButtonV2>
      {downloadError ? <span role="alert">{downloadError}</span> : null}
    </>
  );
}

const list = (value: unknown): Record<string, unknown>[] => {
  const rows = Array.isArray(value) ? value : (value && typeof value === 'object' && Array.isArray((value as { data?: unknown }).data) ? (value as { data: unknown[] }).data : []);
  return rows.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object');
};

/** Manager Interviews: list by default, calendar as a view of the same records. Time is shown in Africa/Cairo. */
export function TeamInterviewsV2() {
  const [params, setParams] = useSearchParams();
  const scope: Scope = params.get('scope') === 'team' ? 'team' : 'mine';
  const bucket: Bucket = params.get('bucket') === 'feedback' || params.get('bucket') === 'completed' ? params.get('bucket') as Bucket : 'upcoming';
  const view: View = params.get('view') === 'calendar' ? 'calendar' : 'list';
  const [attempt, setAttempt] = useState(0);

  type TeamInterviewsData = {
    mine: Row[];
    team: Row[];
    teamIssue: { kind: 'forbidden' | 'unavailable' | 'error' | 'mine-unavailable'; message: string } | null;
  };

  const res = useCachedResource<TeamInterviewsData>({
    key: 'team-interviews',
    attempt,
    fetcher: async () => {
      const teamPromise = getApi<unknown>('/interviews').then(
        (raw) => ({ ok: true as const, raw }),
        (error: unknown) => ({ ok: false as const, error }),
      );
      const [upcoming, past, teamResult] = await Promise.all([
        listMyInterviews('upcoming'),
        listMyInterviews('past'),
        teamPromise,
      ]);
      if (!upcoming.available && !past.available) {
        return { mine: [], team: [], teamIssue: { kind: 'mine-unavailable', message: 'Your interview list is not available from this server yet.' } };
      }
      const mine = [...(upcoming.available ? upcoming.items : []), ...(past.available ? past.items : [])].map(fromMine);
      const mineIds = new Set(mine.map((row) => row.id));
      if (teamResult.ok) {
        const team = list(teamResult.raw).map((row) => fromTeam(row, mineIds)).filter((row): row is Row => !!row);
        return { mine, team, teamIssue: null };
      }
      const status = (teamResult.error as { statusCode?: number })?.statusCode;
      const message = (teamResult.error as { message?: string })?.message || 'Could not load team interviews.';
      const teamIssue: TeamInterviewsData['teamIssue'] = status === 403
        ? { kind: 'forbidden', message: 'You cannot open the team interview list.' }
        : status === 404 || status === 405 || status === 501
          ? { kind: 'unavailable', message: 'The team interview list is not available from this server yet.' }
          : { kind: 'error', message };
      return { mine, team: [], teamIssue };
    },
  });

  const state: { kind: 'loading' } | ({ kind: 'ready' } & TeamInterviewsData) | { kind: 'error'; message: string } =
    res.kind === 'loading'
      ? { kind: 'loading' }
      : res.kind === 'error'
        ? { kind: 'error', message: (res.error as { message?: string })?.message || 'Could not load interviews.' }
        : { kind: 'ready', ...res.data };

  const set = (patch: Record<string, string | null>) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(patch)) { if (value) next.set(key, value); else next.delete(key); }
      return next;
    });
  };
  const now = Date.now();
  const source = state.kind === 'ready' ? (scope === 'mine' ? state.mine : state.team) : [];
  const upcomingCount = source.filter((row) => bucketOf(row, now) === 'upcoming').length;
  const feedbackCount = source.filter((row) => bucketOf(row, now) === 'feedback').length;
  const completedCount = source.filter((row) => bucketOf(row, now) === 'completed').length;
  const totalCount = source.length;
  const [calMode, setCalMode] = useState<'month' | 'week'>('month');
  const [userCalDate, setUserCalDate] = useState<Date | null>(null);
  const [userSelectedDate, setUserSelectedDate] = useState<string | null>(null);
  const [calFilter, setCalFilter] = useState<'all' | Bucket>('all');

  const rows = source.filter((row) => bucketOf(row, now) === bucket).sort((a, b) => a.start.localeCompare(b.start));

  const calendarEvents = calFilter === 'all'
    ? source
    : source.filter((row) => bucketOf(row, now) === calFilter);

  const activeCalDate = userCalDate ?? (
    source.length > 0
      ? new Date((source.find((r) => bucketOf(r, now) === 'upcoming') ?? source[0]).start)
      : new Date()
  );

  const hasSessionOnSelected = Boolean(userSelectedDate && source.some((r) => dayKey(r.start) === userSelectedDate));
  const effectiveSelectedDate = (userSelectedDate && hasSessionOnSelected)
    ? userSelectedDate
    : (source.length > 0 ? dayKey(source[0].start) : dayKey(new Date().toISOString()));

  const todayKey = dayKey(new Date().toISOString());
  const monthCells = buildMonthCells(activeCalDate);
  const weekDays = buildWeekDays(activeCalDate);
  const selectedDayEvents = calendarEvents.filter((r) => dayKey(r.start) === effectiveSelectedDate);

  const nextAvailableSession = source.find((r) => dayKey(r.start) > effectiveSelectedDate) ?? source.find((r) => dayKey(r.start) !== effectiveSelectedDate);
  const nextAvailableDate = nextAvailableSession ? dayKey(nextAvailableSession.start) : null;

  const showSchedule = state.kind === 'ready' && state.teamIssue?.kind !== 'mine-unavailable' && !(scope === 'team' && state.teamIssue);
  const timing: ReadonlyArray<readonly [Bucket, string, number]> = [
    ['upcoming', 'Upcoming', upcomingCount],
    ['feedback', 'Needs feedback', feedbackCount],
    ['completed', 'Completed', completedCount],
  ];

  return (
    <div className="rf2-jobs rf2-team rf2-intv-mgr">
      <header className="rf2-team__bar">
        <div>
          <h1 className="rf2-team__title">Interviews</h1>
          <p className="rf2-team__intro">Coordinate interview schedules, track evaluation scorecards, and review candidate sessions. Times are shown in Africa/Cairo.</p>
        </div>
        <div className="rf2-team__actions" role="group" aria-label="Interview scope">
          <ButtonV2 kind={scope === 'mine' ? 'primary' : 'secondary'} size="sm" aria-pressed={scope === 'mine'} onClick={() => set({ scope: null })}>My interviews</ButtonV2>
          <ButtonV2 kind={scope === 'team' ? 'primary' : 'secondary'} size="sm" aria-pressed={scope === 'team'} onClick={() => set({ scope: 'team' })}>Team interviews</ButtonV2>
        </div>
      </header>
      <ul className="rf2-team__summary-cards" aria-label="Interview summary">
        <li>
          <span className="rf2-team__sum-icon" data-tone="info" aria-hidden="true"><CalendarDays /></span>
          <span className="rf2-team__sum-copy">
            <span className="rf2-team__sum-value">{upcomingCount}</span>
            <span className="rf2-team__sum-label">Upcoming</span>
          </span>
        </li>
        <li>
          <span className="rf2-team__sum-icon" data-tone={feedbackCount > 0 ? 'danger' : 'neutral'} aria-hidden="true"><CircleAlert /></span>
          <span className="rf2-team__sum-copy">
            <span className="rf2-team__sum-value" data-tone={feedbackCount > 0 ? 'danger' : undefined}>{feedbackCount}</span>
            <span className="rf2-team__sum-label">Needs feedback</span>
          </span>
        </li>
        <li>
          <span className="rf2-team__sum-icon" data-tone="success" aria-hidden="true"><CircleCheck /></span>
          <span className="rf2-team__sum-copy">
            <span className="rf2-team__sum-value">{completedCount}</span>
            <span className="rf2-team__sum-label">Completed</span>
          </span>
        </li>
        <li>
          <span className="rf2-team__sum-icon" data-tone="info" aria-hidden="true"><Users /></span>
          <span className="rf2-team__sum-copy">
            <span className="rf2-team__sum-value">{totalCount}</span>
            <span className="rf2-team__sum-label">Total in scope</span>
          </span>
        </li>
      </ul>
      <div className="rf2-team__toolbar">
        <div className="rf2-tabs" role="tablist" aria-label="Interview timing">
          {timing.map(([key, label, count]) => (
            <button key={key} type="button" className="rf2-tab" role="tab" aria-selected={bucket === key} onClick={() => set({ bucket: key === 'upcoming' ? null : key })}>
              {label}
              <span className="rf2-tab__count" aria-hidden="true">{count}</span>
            </button>
          ))}
        </div>
        <div className="rf2-team__actions" role="group" aria-label="Interview view">
          <ButtonV2 kind={view === 'list' ? 'primary' : 'secondary'} size="sm" aria-pressed={view === 'list'} onClick={() => set({ view: null })}>List</ButtonV2>
          <ButtonV2 kind={view === 'calendar' ? 'primary' : 'secondary'} size="sm" aria-pressed={view === 'calendar'} onClick={() => set({ view: 'calendar' })}>Calendar</ButtonV2>
        </div>
      </div>
      <section className="rf2-panel rf2-intv-mgr__panel">
        {state.kind === 'loading' ? <SkeletonV2 lines={5} label="Loading interviews…" /> : null}
        {state.kind === 'error' ? <div role="alert"><EmptyStateV2 title="Could not load interviews" body={state.message} action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Try again</ButtonV2>} /></div> : null}
        {state.kind === 'ready' && state.teamIssue?.kind === 'mine-unavailable' ? <EmptyStateV2 title="Interviews are not available yet" body={state.teamIssue.message} /> : null}
        {state.kind === 'ready' && scope === 'team' && state.teamIssue?.kind === 'forbidden' ? <ForbiddenStateV2 body={state.teamIssue.message} /> : null}
        {state.kind === 'ready' && scope === 'team' && state.teamIssue?.kind === 'unavailable' ? <EmptyStateV2 title="Team interviews are not available yet" body="The team list did not load. This is not zero interviews." /> : null}
        {state.kind === 'ready' && scope === 'team' && state.teamIssue?.kind === 'error' ? <div role="alert"><EmptyStateV2 title="Could not load team interviews" body={state.teamIssue.message} action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Try again</ButtonV2>} /></div> : null}
        {showSchedule ? (
          view === 'calendar' ? (
            <div className="rf2-cal-ms" aria-label="Interview calendar">
              <div className="rf2-cal-ms__toolbar">
                <div className="rf2-cal-ms__nav-group">
                  <button
                    type="button"
                    className="rf2-cal-ms__btn-today"
                    onClick={() => {
                      const t = new Date();
                      setUserCalDate(t);
                      setUserSelectedDate(dayKey(t.toISOString()));
                    }}
                  >
                    Today
                  </button>
                  <div className="rf2-cal-ms__nav-arrows">
                    <button
                      type="button"
                      className="rf2-cal-ms__btn-nav"
                      aria-label={calMode === 'month' ? 'Previous month' : 'Previous week'}
                      onClick={() => {
                        const next = new Date(activeCalDate);
                        if (calMode === 'month') next.setMonth(next.getMonth() - 1);
                        else next.setDate(next.getDate() - 7);
                        setUserCalDate(next);
                      }}
                    >
                      <ChevronLeft aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="rf2-cal-ms__btn-nav"
                      aria-label={calMode === 'month' ? 'Next month' : 'Next week'}
                      onClick={() => {
                        const next = new Date(activeCalDate);
                        if (calMode === 'month') next.setMonth(next.getMonth() + 1);
                        else next.setDate(next.getDate() + 7);
                        setUserCalDate(next);
                      }}
                    >
                      <ChevronRight aria-hidden="true" />
                    </button>
                  </div>
                  <h2 className="rf2-cal-ms__title">
                    {calMode === 'month' ? monthLabel(activeCalDate) : weekRangeLabel(weekDays)}
                  </h2>
                </div>

                <div className="rf2-cal-ms__filters" role="group" aria-label="Filter calendar events">
                  <button
                    type="button"
                    className={`rf2-cal-ms__filter-pill ${calFilter === 'all' ? 'is-active' : ''}`}
                    onClick={() => setCalFilter('all')}
                  >
                    All <span className="rf2-cal-ms__filter-count">{totalCount}</span>
                  </button>
                  <button
                    type="button"
                    className={`rf2-cal-ms__filter-pill ${calFilter === 'upcoming' ? 'is-active' : ''}`}
                    onClick={() => setCalFilter('upcoming')}
                  >
                    Upcoming <span className="rf2-cal-ms__filter-count">{upcomingCount}</span>
                  </button>
                  <button
                    type="button"
                    className={`rf2-cal-ms__filter-pill ${calFilter === 'feedback' ? 'is-active' : ''}`}
                    onClick={() => setCalFilter('feedback')}
                  >
                    Needs feedback <span className="rf2-cal-ms__filter-count">{feedbackCount}</span>
                  </button>
                  <button
                    type="button"
                    className={`rf2-cal-ms__filter-pill ${calFilter === 'completed' ? 'is-active' : ''}`}
                    onClick={() => setCalFilter('completed')}
                  >
                    Completed <span className="rf2-cal-ms__filter-count">{completedCount}</span>
                  </button>
                </div>

                <div className="rf2-cal-ms__view-toggles" role="group" aria-label="Calendar view mode">
                  <button
                    type="button"
                    className={`rf2-cal-ms__view-btn ${calMode === 'month' ? 'is-active' : ''}`}
                    onClick={() => setCalMode('month')}
                  >
                    Month
                  </button>
                  <button
                    type="button"
                    className={`rf2-cal-ms__view-btn ${calMode === 'week' ? 'is-active' : ''}`}
                    onClick={() => setCalMode('week')}
                  >
                    Week
                  </button>
                </div>
              </div>

              <div className="rf2-cal-ms__body">
                <div className="rf2-cal-ms__main">
                  {calMode === 'month' ? (
                    <div className="rf2-cal-ms__month-grid" role="grid" aria-label="Month view">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                        <div key={day} className="rf2-cal-ms__day-header" role="columnheader">
                          {day}
                        </div>
                      ))}
                      {monthCells.map((cell) => {
                        const isToday = cell.key === todayKey;
                        const isSelected = cell.key === effectiveSelectedDate;
                        const dayEvents = calendarEvents.filter((r) => dayKey(r.start) === cell.key);

                        return (
                          <div
                            key={cell.key}
                            role="gridcell"
                            tabIndex={0}
                            aria-label={`${cell.dayNumber} ${monthLabel(cell.date)}, ${dayEvents.length} events`}
                            aria-selected={isSelected}
                            className={`rf2-cal-ms__day-cell ${cell.isOtherMonth ? 'is-other-month' : ''} ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}`}
                            onClick={() => {
                              setUserSelectedDate(cell.key);
                              if (cell.isOtherMonth) setUserCalDate(cell.date);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setUserSelectedDate(cell.key);
                                if (cell.isOtherMonth) setUserCalDate(cell.date);
                              }
                            }}
                          >
                            <div className="rf2-cal-ms__cell-top">
                              <span className={`rf2-cal-ms__day-num ${isToday ? 'is-today-badge' : ''}`}>
                                {cell.dayNumber}
                              </span>
                              {dayEvents.length > 0 ? (
                                <span className="rf2-cal-ms__day-count-badge">
                                  {dayEvents.length}
                                </span>
                              ) : null}
                            </div>
                            <div className="rf2-cal-ms__day-events">
                              {dayEvents.slice(0, 3).map((event) => (
                                <div
                                  key={event.id}
                                  className={`rf2-cal-ms__chip rf2-cal-ms__chip--${eventTone(event, now)}`}
                                  title={`${clock(event.start)} - ${event.candidate} (${event.job})`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setUserSelectedDate(cell.key);
                                  }}
                                >
                                  <span className="rf2-cal-ms__chip-time">{clock(event.start).split(' ').pop()}</span>
                                  <span className="rf2-cal-ms__chip-title">{event.job}</span>
                                </div>
                              ))}
                              {dayEvents.length > 3 ? (
                                <div className="rf2-cal-ms__more">
                                  +{dayEvents.length - 3} more
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rf2-cal-ms__week-view" role="grid" aria-label="Week view">
                      <div className="rf2-cal-ms__week-grid">
                        <div className="rf2-cal-ms__week-header-cell" />
                        {weekDays.map((d) => {
                          const key = dayKey(d.toISOString());
                          const isToday = key === todayKey;
                          const isSelected = key === effectiveSelectedDate;
                          const dayNum = d.getDate();
                          const dayName = new Intl.DateTimeFormat('en-GB', { timeZone: CAIRO, weekday: 'short' }).format(d);
                          return (
                            <div
                              key={key}
                              className={`rf2-cal-ms__week-header-cell ${isSelected ? 'is-selected' : ''}`}
                              onClick={() => setUserSelectedDate(key)}
                            >
                              <div className="rf2-cal-ms__week-header-day">{dayName}</div>
                              <div className={`rf2-cal-ms__week-header-num ${isToday ? 'is-today-badge' : ''}`}>{dayNum}</div>
                            </div>
                          );
                        })}

                        {Array.from({ length: 12 }, (_, i) => i + 8).map((hour) => {
                          const hourDisplay = `${hour % 12 === 0 ? 12 : hour % 12}:00 ${hour >= 12 ? 'PM' : 'AM'}`;
                          return (
                            <div key={`row-${hour}`} style={{ display: 'contents' }}>
                              <div className="rf2-cal-ms__week-time-label">{hourDisplay}</div>
                              {weekDays.map((d) => {
                                const key = dayKey(d.toISOString());
                                const slotEvents = calendarEvents.filter((r) => {
                                  if (dayKey(r.start) !== key) return false;
                                  const h = new Date(r.start).getHours();
                                  return h === hour;
                                });
                                return (
                                  <div
                                    key={`${key}-${hour}`}
                                    className="rf2-cal-ms__week-slot"
                                    onClick={() => setUserSelectedDate(key)}
                                  >
                                    {slotEvents.map((event) => (
                                      <div
                                        key={event.id}
                                        className={`rf2-cal-ms__chip rf2-cal-ms__chip--${eventTone(event, now)}`}
                                        title={`${clock(event.start)} - ${event.candidate} (${event.job})`}
                                      >
                                        <span className="rf2-cal-ms__chip-time">{clock(event.start).split(' ').pop()}</span>
                                        <span className="rf2-cal-ms__chip-title">{event.job}</span>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <aside className="rf2-cal-ms__agenda" aria-label="Selected day sessions">
                  <div className="rf2-cal-ms__agenda-head">
                    <div>
                      <h3 className="rf2-cal-ms__agenda-title">{dayFullLabel(effectiveSelectedDate)}</h3>
                      <span className="rf2-cal-ms__agenda-subtitle">
                        {selectedDayEvents.length} {selectedDayEvents.length === 1 ? 'interview session' : 'interview sessions'}
                      </span>
                    </div>
                    {nextAvailableDate && nextAvailableDate !== effectiveSelectedDate ? (
                      <button
                        type="button"
                        className="rf2-cal-ms__btn-jump"
                        onClick={() => {
                          setUserSelectedDate(nextAvailableDate);
                          setUserCalDate(new Date(`${nextAvailableDate}T12:00:00Z`));
                        }}
                      >
                        <span>Next session</span>
                        <ChevronRight size={14} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>

                  {selectedDayEvents.length === 0 ? (
                    <div className="rf2-cal-ms__agenda-empty">
                      <p>No interviews scheduled on this day.</p>
                      {calendarEvents.length > 0 ? (
                        <button
                          type="button"
                          className="rf2-btn rf2-btn--secondary rf2-btn--sm"
                          onClick={() => {
                            const nextDate = dayKey(calendarEvents[0].start);
                            setUserSelectedDate(nextDate);
                            setUserCalDate(new Date(calendarEvents[0].start));
                          }}
                        >
                          Go to nearest interview ({dayLabel(dayKey(calendarEvents[0].start))})
                        </button>
                      ) : (
                        <p className="rf2-cal-ms__agenda-hint">
                          {calFilter !== 'all' && totalCount > 0
                            ? `Filter "${calFilter}" has no sessions. Click "All" to view all ${totalCount} sessions.`
                            : scope === 'mine'
                              ? 'Switch to Team interviews to see your team members’ sessions.'
                              : 'No interview sessions found in this view.'}
                        </p>
                      )}
                    </div>
                  ) : (
                    <ul className="rf2-cal-ms__agenda-list">
                      {selectedDayEvents.map((row) => (
                        <li key={row.id} className="rf2-cal-ms__agenda-card">
                          <div className="rf2-cal-ms__card-top">
                            <span className="rf2-intv-mgr__time"><CalendarDays aria-hidden="true" /> {clock(row.start)}</span>
                            <StatusChip tone={statusTone(row.status)} label={row.status} />
                          </div>
                          <div className="rf2-cal-ms__card-candidate">
                            <span className="rf2-avatar rf2-team__avatar" aria-hidden="true">{getInitials(row.candidate)}</span>
                            <div>
                              <h4 className="rf2-cal-ms__candidate-name">{row.candidate}</h4>
                              <p className="rf2-cal-ms__candidate-job">{row.job}</p>
                            </div>
                          </div>
                          <div className="rf2-cal-ms__card-tz">
                            <span className="rf2-intv-mgr__tz">{row.timezone ?? 'Time zone not recorded'}</span>
                          </div>
                          <div className="rf2-cal-ms__card-actions">
                            <InterviewLinks row={row} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </aside>
              </div>
            </div>
          ) : rows.length === 0 ? (
            <EmptyStateV2
              title="No interviews in this view"
              body="This filter has no saved interviews. That is an empty list, not a failed request."
              action={scope === 'mine' ? <ButtonV2 kind="secondary" size="sm" onClick={() => set({ scope: 'team' })}>View Team interviews</ButtonV2> : undefined}
            />
          ) : (
            <div className="rf2-jscroll">
              <table className="rf2-jtable" aria-label="Interviews">
                <thead><tr><th scope="col">When (Africa/Cairo)</th><th scope="col">Candidate</th><th scope="col">Job</th><th scope="col">Status</th><th scope="col">Time zone</th><th scope="col">Action</th></tr></thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td><span className="rf2-intv-mgr__when"><CalendarDays aria-hidden="true" /> {clock(row.start)}</span></td>
                      <td><div className="rf2-intv-mgr__cand"><span className="rf2-avatar rf2-team__avatar" aria-hidden="true">{getInitials(row.candidate)}</span><span className="rf2-jtable__name">{row.candidate}</span></div></td>
                      <td><span className="rf2-intv-mgr__job">{row.job}</span></td>
                      <td><StatusChip tone={statusTone(row.status)} label={row.status} /></td>
                      <td><span className="rf2-intv-mgr__tz">{row.timezone ?? 'Not recorded'}</span></td>
                      <td><div className="rf2-reqs__acts"><InterviewLinks row={row} /></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}
      </section>
      <p className="rf2-team__banner" role="note">
        <Info aria-hidden="true" />
        <span>Schedule, reschedule, cancel, and no-show are recorded on the application file. A draft scorecard does not satisfy the evaluation. You can submit only your own assigned scorecard.</span>
      </p>
    </div>
  );
}
