import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, CircleAlert, CircleCheck, Download, Info, RotateCw, Users } from 'lucide-react';
import { ButtonV2, EmptyStateV2, ForbiddenStateV2, SkeletonV2, StatusChip } from '../../components/v2';
import { getApi } from '../../api/client';
import { downloadErrorMessage, downloadIcs, listMyInterviews, type MyInterview } from '../../api/myInterviews';
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

function bucketOf(row: Row, now: number): Bucket {
  const end = new Date(row.end).getTime();
  const future = Number.isFinite(end) && end >= now && (row.status === 'Scheduled' || row.status === 'Rescheduled');
  if (future) return 'upcoming';
  if (row.mine && row.scorecard !== 'submitted' && row.status !== 'Cancelled' && row.status !== 'No-show') return 'feedback';
  return 'completed';
}

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
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'ready'; mine: Row[]; team: Row[]; teamIssue: { kind: 'forbidden' | 'unavailable' | 'error' | 'mine-unavailable'; message: string } | null } | { kind: 'error'; message: string }>({ kind: 'loading' });

  useEffect(() => {
    let live = true;
    setState({ kind: 'loading' });
    void (async () => {
      try {
        const [upcoming, past] = await Promise.all([listMyInterviews('upcoming'), listMyInterviews('past')]);
        if (!upcoming.available && !past.available) {
          if (live) setState({ kind: 'ready', mine: [], team: [], teamIssue: { kind: 'mine-unavailable', message: 'Your interview list is not available from this server yet.' } });
          return;
        }
        const mine = [...(upcoming.available ? upcoming.items : []), ...(past.available ? past.items : [])].map(fromMine);
        const mineIds = new Set(mine.map((row) => row.id));
        let team: Row[] = [];
        let teamIssue: { kind: 'forbidden' | 'unavailable' | 'error'; message: string } | null = null;
        try {
          team = list(await getApi<unknown>('/interviews')).map((row) => fromTeam(row, mineIds)).filter((row): row is Row => !!row);
        } catch (error) {
          const status = (error as { statusCode?: number })?.statusCode;
          const message = (error as { message?: string })?.message || 'Could not load team interviews.';
          teamIssue = status === 403
            ? { kind: 'forbidden', message: 'You cannot open the team interview list.' }
            : status === 404 || status === 405 || status === 501
              ? { kind: 'unavailable', message: 'The team interview list is not available from this server yet.' }
              : { kind: 'error', message };
        }
        if (live) setState({ kind: 'ready', mine, team, teamIssue });
      } catch (error) {
        if (live) setState({ kind: 'error', message: (error as { message?: string })?.message || 'Could not load interviews.' });
      }
    })();
    return () => { live = false; };
  }, [attempt]);

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) { if (value) next.set(key, value); else next.delete(key); }
    setParams(next);
  };
  const now = Date.now();
  const source = state.kind === 'ready' ? (scope === 'mine' ? state.mine : state.team) : [];
  const upcomingCount = source.filter((row) => bucketOf(row, now) === 'upcoming').length;
  const feedbackCount = source.filter((row) => bucketOf(row, now) === 'feedback').length;
  const completedCount = source.filter((row) => bucketOf(row, now) === 'completed').length;
  const totalCount = source.length;
  const rows = source.filter((row) => bucketOf(row, now) === bucket).sort((a, b) => a.start.localeCompare(b.start));
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = dayKey(row.start);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

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
          rows.length === 0 ? <EmptyStateV2 title="No interviews in this view" body="This filter has no saved interviews. That is an empty list, not a failed request." /> : view === 'list' ? (
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
          ) : (
            <div className="rf2-intv-mgr__calendar" aria-label="Interview calendar">
              {[...groups.entries()].map(([key, items]) => (
                <section key={key} className="rf2-intv-mgr__day" aria-label={dayLabel(key)}>
                  <div className="rf2-intv-mgr__day-head">
                    <h2 className="rf2-team__h">{dayLabel(key)}</h2>
                    <span className="rf2-chip rf2-chip--info">{items.length} {items.length === 1 ? 'session' : 'sessions'}</span>
                  </div>
                  <ul className="rf2-intv-mgr__day-list">
                    {items.map((row) => (
                      <li key={row.id} className="rf2-intv-mgr__session">
                        <span className="rf2-intv-mgr__time">{clock(row.start)}</span>
                        <span className="rf2-intv-mgr__cand"><span className="rf2-avatar rf2-team__avatar" aria-hidden="true">{getInitials(row.candidate)}</span><span>{row.candidate}</span></span>
                        <span className="rf2-intv-mgr__job">{row.job}</span>
                        <StatusChip tone={statusTone(row.status)} label={row.status} />
                        <span className="rf2-intv-mgr__tz">{row.timezone ?? 'Time zone not recorded'}</span>
                        <div className="rf2-reqs__acts"><InterviewLinks row={row} /></div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
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
