import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BriefcaseBusiness, Check, Clock, DoorOpen, Eye, FileText, Info, MapPin, RotateCw, TriangleAlert, UserRound } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { ApiError } from '../../api/client';
import { ButtonV2 } from '../../components/v2/Button';
import { StatusChip } from '../../components/v2/StatusChip';
import { EmptyStateV2, ForbiddenStateV2, SkeletonV2 } from '../../components/v2/PageStates';
import { TaskRow, TaskSection } from '../../components/v2/Task';
import '../../components/v2/v2-primitives.css';
import './my-work.css';
import { getMyWork, type MyWorkResult, type MyWorkTask, type WorkDay, type WorkSection } from '../api/myWork';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; result: MyWorkResult }
  | { kind: 'error'; message: string }
  | { kind: 'forbidden' };

const SECTION_TITLE: Record<WorkSection, string> = { overdue: 'Overdue', today: 'Today', waiting: 'Waiting on others' };

export function parseDay(value: string | null): WorkDay {
  return value === 'tomorrow' ? 'tomorrow' : 'today';
}

const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions) => {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('en-GB', opts).format(d);
};
const dayMonth = (iso: string) => fmtDate(iso, { day: 'numeric', month: 'short' });
const fullDate = (iso: string) => fmtDate(iso, { day: 'numeric', month: 'short', year: 'numeric' });
const time = (iso: string) => fmtDate(iso, { hour: '2-digit', minute: '2-digit', hour12: false });

/** The SLA/due text; null hides it (worker stale or no follow-up date). */
function dueLabel(task: MyWorkTask, healthy: boolean): { text: string; tone: 'danger' | 'default' } | null {
  if (!healthy || !task.sla || !task.followUpAt) return null;
  if (task.sla === 'overdue') return { text: `Due ${dayMonth(task.followUpAt)}`, tone: 'danger' };
  if (task.sla === 'due_today') return { text: task.followUpAt.length > 10 ? `Today, ${time(task.followUpAt)}` : 'Today', tone: 'default' };
  return { text: `Due ${dayMonth(task.followUpAt)}`, tone: 'default' };
}

function taskChip(task: MyWorkTask) {
  if (task.waitingOn) return <StatusChip tone="neutral" label={`Waiting on ${task.waitingOn.name}`} />;
  if (task.blocker) return <StatusChip tone="warning" label={task.blocker} />;
  return <StatusChip tone="info" label={task.stage} />;
}

/** All next actions open the v1 application file until E2 adds the v2 file + drawers. */
function TaskAction({ task }: { task: MyWorkTask }) {
  if (!task.nextAction.enabled) return <span className="rf2-mywork__no-action">No action for you</span>;
  const kind = task.section === 'today' ? 'primary' : task.section === 'overdue' ? 'secondary' : 'tertiary';
  const icon = task.nextAction.kind === 'view_file' ? <Eye /> : task.section === 'today' ? <Check /> : <FileText />;
  return (
    <Link className={`rf2-btn rf2-btn--${kind} rf2-btn--md`} to={`/applications/${encodeURIComponent(task.applicationId)}`}
      aria-label={`${task.nextAction.label}: ${task.candidate.name}`}>
      <span aria-hidden="true" style={{ display: 'contents' }}>{icon}</span>
      <span>{task.nextAction.label}</span>
    </Link>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export function MyWorkV2({ load = getMyWork }: { load?: typeof getMyWork } = {}) {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const day = parseDay(params.get('day'));
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setState({ kind: 'loading' });
    load(day)
      .then((result) => { if (alive) setState({ kind: 'ready', result }); })
      .catch((error: unknown) => {
        if (!alive) return;
        if (error instanceof ApiError && error.statusCode === 403) setState({ kind: 'forbidden' });
        else setState({ kind: 'error', message: error instanceof Error && error.message ? error.message : 'Could not load your work.' });
      });
    return () => { alive = false; };
  }, [day, load, attempt]);

  const setDay = useCallback((next: WorkDay) => {
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      if (next === 'today') p.delete('day'); else p.set('day', next);
      return p;
    });
  }, [setParams]);

  const firstName = (user?.displayName ?? '').split(' ')[0];
  const data = state.kind === 'ready' ? state.result.data : null;
  const openCount = data ? data.counts.total : 0;
  const isEmptyToday = Boolean(data && day === 'today' && data.sections.overdue.length + data.sections.today.length + data.sections.waiting.length === 0);

  const heading = day === 'tomorrow' && data ? `Tomorrow · ${fmtDate(data.date, { weekday: 'short' })} ${fullDate(data.date)}` : day === 'tomorrow' ? 'Tomorrow' : 'My Work';
  const subtitle = useMemo(() => {
    if (!data) return null;
    if (day === 'tomorrow') {
      const n = data.scheduled.length;
      return `${n} ${n === 1 ? 'interview' : 'interviews'}${data.job ? ` on ${data.job.title}` : ''}.`;
    }
    if (isEmptyToday) return 'Open files on your jobs that need you appear here.';
    return `${greeting()}${firstName ? `, ${firstName}` : ''}. ${openCount} open ${openCount === 1 ? 'task' : 'tasks'}${data.job ? ` on your job ${data.job.title}` : ''}.`;
  }, [data, day, isEmptyToday, firstName, openCount]);

  return (
    <div className="rf2-mywork">
      <div className="rf2-mywork__top">
        <div>
          <h2 className="rf2-mywork__title">{heading}</h2>
          {subtitle ? <p className="rf2-mywork__subtitle">{subtitle}</p> : null}
        </div>
        <div className="rf2-daytoggle" role="group" aria-label="Show work for">
          {(['today', 'tomorrow'] as const).map((d) => (
            <button key={d} type="button" className="rf2-daytoggle__btn" aria-pressed={day === d} onClick={() => setDay(d)}>
              {d === 'today' ? 'Today' : 'Tomorrow'}
            </button>
          ))}
        </div>
      </div>

      {state.kind === 'ready' && state.result.source === 'fixture' ? (
        <p className="rf2-mywork__note" role="note" data-testid="sample-data-note">
          <Info aria-hidden="true" /> Sample data: the My Work API (B4) is not available yet. Shown in development only.
        </p>
      ) : null}

      {state.kind === 'loading' ? <SkeletonV2 lines={6} label="Loading your work…" /> : null}
      {state.kind === 'forbidden' ? <ForbiddenStateV2 title="You do not have access to My Work" body="Ask your manager or an administrator if you think this is wrong." /> : null}
      {state.kind === 'error' ? (
        <div role="alert">
          <EmptyStateV2 title="Could not load your work" body={state.message}
            action={<ButtonV2 kind="secondary" icon={<RotateCw />} onClick={() => setAttempt((n) => n + 1)}>Try again</ButtonV2>} />
        </div>
      ) : null}

      {data ? (
        <>
          {data.job ? <JobStrip job={data.job} /> : null}
          {!data.reminderWorkerHealthy ? (
            <p className="rf2-mywork__note" role="note" data-testid="worker-stale-note">
              <Info aria-hidden="true" /> Reminders are paused, so due-date status is hidden. Tasks are still listed.
            </p>
          ) : null}

          {day === 'today' && isEmptyToday ? (
            <EmptyStateV2
              icon={<Check />}
              title="No open work assigned to you"
              body="New tasks appear here when a file on your jobs needs you: a screening to log, a scorecard to chase, an offer to send."
              action={<Link className="rf2-btn rf2-btn--secondary rf2-btn--md" to="/vacancies"><span aria-hidden="true" style={{ display: 'contents' }}><BriefcaseBusiness /></span><span>View open jobs</span></Link>}
            />
          ) : null}

          {day === 'today' && !isEmptyToday ? (
            <>
              {(['overdue', 'today', 'waiting'] as const).map((section) => (
                <TaskSection key={section} title={SECTION_TITLE[section]} count={data.sections[section].length}
                  tone={section === 'overdue' ? 'danger' : 'default'} emptyText={`Nothing ${section === 'waiting' ? 'waiting on others' : section}.`}>
                  {data.sections[section].map((task) => {
                    const due = dueLabel(task, data.reminderWorkerHealthy);
                    return (
                      <TaskRow key={task.id}
                        icon={section === 'overdue' ? <TriangleAlert /> : <Clock />}
                        iconTone={section === 'overdue' ? 'warning' : section === 'waiting' ? 'neutral' : 'info'}
                        title={<>{task.title} — {task.candidate.name}</>}
                        meta={`${task.job.title} · ${task.context}`}
                        chip={taskChip(task)}
                        due={due ? <span data-testid="sla">{due.text}</span> : task.waitingOn ? null : undefined}
                        dueTone={due?.tone}
                        action={<TaskAction task={task} />}
                      />
                    );
                  })}
                </TaskSection>
              ))}
              <dl className="rf2-mywork__counts" aria-label="Counts">
                {([['Total open', data.counts.total, 'Tasks assigned to you'], ['Overdue', data.counts.overdue, null], ['Due today', data.counts.today, null], ['Waiting on others', data.counts.waiting, null]] as const).map(([label, value, hint]) => (
                  <div key={label} className="rf2-mywork__count" data-key={label}>
                    <dt>{label}</dt>
                    <dd data-count-value="">{value}</dd>
                    {hint ? <dd className="rf2-mywork__count-hint">{hint}</dd> : null}
                  </div>
                ))}
              </dl>
            </>
          ) : null}

          {day === 'tomorrow' ? (
            data.scheduled.length === 0 ? (
              <EmptyStateV2 icon={<Check />} title="Nothing booked for tomorrow" body="Interviews you schedule on your files appear here the day before." />
            ) : (
              <ul className="rf2-mywork__scheduled" aria-label="Tomorrow's interviews">
                {data.scheduled.map((item) => (
                  <li key={item.id} className="rf2-scheduled">
                    <div className="rf2-scheduled__when">
                      <span className="rf2-scheduled__day">{fmtDate(item.startsAt, { weekday: 'short' })} {dayMonth(item.startsAt)}</span>
                      <span className="rf2-scheduled__time">{time(item.startsAt)}</span>
                      {item.endsAt ? <span className="rf2-scheduled__to">to {time(item.endsAt)}</span> : null}
                    </div>
                    <div className="rf2-scheduled__body">
                      <h3 className="rf2-scheduled__title">{item.title} — {item.candidate.name} <StatusChip tone="info" label="Interview" /></h3>
                      <p className="rf2-scheduled__meta">{item.job.title} · {item.context}</p>
                      <dl className="rf2-scheduled__facts">
                        <div><dt><MapPin aria-hidden="true" /> Room</dt><dd>{item.room?.name ?? 'Not set'}</dd></div>
                        <div><dt><UserRound aria-hidden="true" /> Interviewer</dt><dd>{item.interviewer?.name ?? 'Not set'}</dd></div>
                        {item.room?.url ? (
                          <div><dt><DoorOpen aria-hidden="true" /> Room link</dt><dd><a href={item.room.url} target="_blank" rel="noreferrer">{item.room.url.replace(/^https?:\/\//, '')}</a></dd></div>
                        ) : null}
                      </dl>
                    </div>
                    <div className="rf2-scheduled__action">
                      <Link className="rf2-btn rf2-btn--secondary rf2-btn--md" to={`/applications/${encodeURIComponent(item.applicationId)}`} aria-label={`Open file: ${item.candidate.name}`}>
                        <span aria-hidden="true" style={{ display: 'contents' }}><FileText /></span><span>Open file</span>
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : null}
          {day === 'tomorrow' ? (
            <p className="rf2-mywork__note" role="note"><Info aria-hidden="true" /> This view belongs to My Work. Switch back with the Today | Tomorrow toggle.</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function JobStrip({ job }: { job: NonNullable<MyWorkResult['data']['job']> }) {
  const pct = job.seats.target > 0 ? Math.min(100, Math.round((job.seats.filled / job.seats.target) * 100)) : 0;
  const meta = [job.department, job.site?.name, job.ownerName ? `Owner: ${job.ownerName}` : null].filter(Boolean).join(' · ');
  return (
    <section className="rf2-jobstrip" aria-label={`Job: ${job.title}`}>
      <span className="rf2-jobstrip__icon" aria-hidden="true"><BriefcaseBusiness /></span>
      <div className="rf2-jobstrip__main">
        <h3 className="rf2-jobstrip__title">{job.title}</h3>
        {meta ? <p className="rf2-jobstrip__meta">{meta}</p> : null}
      </div>
      <div className="rf2-jobstrip__seats">
        <span className="rf2-jobstrip__seats-label">{job.seats.filled} of {job.seats.target} filled</span>
        <span className="rf2-jobstrip__bar" role="progressbar" aria-label="Seats filled" aria-valuemin={0} aria-valuemax={job.seats.target} aria-valuenow={job.seats.filled}>
          <span style={{ width: `${pct}%` }} />
        </span>
      </div>
      <div className="rf2-jobstrip__due">
        <span className="rf2-jobstrip__due-label">Due</span>
        <span className="rf2-jobstrip__due-value">{job.dueDate ? fullDate(job.dueDate) : 'No due date'}</span>
      </div>
    </section>
  );
}
