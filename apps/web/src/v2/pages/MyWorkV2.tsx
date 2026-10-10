import { useEffect, useId, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BriefcaseBusiness, CalendarClock, Check, ClipboardCheck, ClipboardList, Clock, FileSignature, Info, ListChecks, RotateCw, TriangleAlert } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { ApiError } from '../../api/client';
import { ButtonV2 } from '../../components/v2/Button';
import { StatusChip } from '../../components/v2/StatusChip';
import { EmptyStateV2, ForbiddenStateV2, SkeletonV2 } from '../../components/v2/PageStates';
import { TaskRow, TaskSection } from '../../components/v2/Task';
import '../../components/v2/v2-primitives.css';
import './my-work.css';
import { actionHref, getMyWork, waitingOnName, type MyWorkAction, type MyWorkDay, type MyWorkResult, type MyWorkTarget, type WorkItem, type WorkItemType } from '../api/myWork';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; result: MyWorkResult }
  | { kind: 'error'; message: string }
  | { kind: 'forbidden' };

type Bucket = 'overdue' | 'dueToday' | 'waitingOnOthers';
const BUCKETS: Array<{ key: Bucket; title: string; empty: string }> = [
  { key: 'overdue', title: 'Overdue', empty: 'Nothing overdue.' },
  { key: 'dueToday', title: 'Today', empty: 'Nothing due today.' }, // title replaced for tomorrow
  { key: 'waitingOnOthers', title: 'Waiting on others', empty: 'Nothing waiting on others.' },
];
const TYPE_LABEL: Record<WorkItemType, string> = { job: 'Job', requisition: 'Requisition', task: 'Task', interview: 'Interview', scorecard: 'Scorecard', offer: 'Offer' };
const TYPE_ICON: Record<WorkItemType, React.ReactNode> = {
  job: <BriefcaseBusiness />, requisition: <ClipboardList />, task: <ListChecks />, interview: <CalendarClock />, scorecard: <ClipboardCheck />, offer: <FileSignature />,
};
const WAITING_LABEL = { approver: 'Waiting on approver', interviewer: 'Waiting on interviewer', candidate: 'Waiting on candidate' } as const;

/** Formats in the server's timezone (#9: Africa/Cairo). Date-only values are calendar dates, never shifted. */
function makeFormat(timeZone: string) {
  const dateOnly = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  const fmt = (v: string, opts: Intl.DateTimeFormatOptions) => {
    const d = new Date(dateOnly(v) ? `${v}T12:00:00Z` : v);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: dateOnly(v) ? 'UTC' : timeZone }).format(d);
  };
  return {
    dateOnly,
    dayMonth: (v: string) => fmt(v, { day: 'numeric', month: 'short' }),
    full: (v: string) => fmt(v, { day: 'numeric', month: 'short', year: 'numeric' }),
    time: (v: string) => fmt(v, { hour: '2-digit', minute: '2-digit', hour12: false }),
  };
}

function dueText(item: WorkItem, bucket: Bucket, day: MyWorkDay, f: ReturnType<typeof makeFormat>): string | null {
  if (item.startAt) return `${day === 'tomorrow' && bucket === 'dueToday' ? 'Tomorrow' : f.dayMonth(item.startAt)}, ${f.time(item.startAt)}${item.endAt ? `–${f.time(item.endAt)}` : ''}`;
  if (!item.dueAt) return null;
  if (bucket === 'dueToday') {
    const label = day === 'tomorrow' ? 'Tomorrow' : 'Today';
    return f.dateOnly(item.dueAt) ? label : `${label}, ${f.time(item.dueAt)}`;
  }
  if (bucket === 'overdue') return `Due ${f.dayMonth(item.dueAt)}`;
  return f.dateOnly(item.dueAt) ? `Due ${f.dayMonth(item.dueAt)}` : `Ended ${f.dayMonth(item.dueAt)}`;
}

/** SLA fact per row. Rendered only when #9's reminderWorkerHealthy is true. */
function slaChip(item: WorkItem, bucket: Bucket, day: MyWorkDay) {
  if (!item.dueAt && !item.startAt) return null;
  if (bucket === 'overdue') return <StatusChip tone="danger" label="Overdue" />;
  if (bucket === 'dueToday') return <StatusChip tone={day === 'today' ? 'warning' : 'info'} label={day === 'today' ? 'Due today' : 'Due tomorrow'} />;
  return null;
}

function DisabledAction({ action }: { action: MyWorkAction }) {
  const id = useId();
  return (
    <span className="rf2-mywork__action-disabled">
      <button type="button" className="rf2-btn rf2-btn--tertiary rf2-btn--md" disabled aria-describedby={action.reason ? id : undefined} title={action.reason}>
        <span>{action.label}</span>
      </button>
      {action.reason ? <span id={id} className="rf2-visually-hidden">{action.reason}</span> : null}
    </span>
  );
}

/** #9 actions[]: enabled → link to the page; disabled → disabled button with the reason as tooltip + aria-describedby. */
function ItemActions({ item, bucket, primary }: { item: WorkItem; bucket: Bucket; primary: boolean }) {
  const actions = item.actions.length ? item.actions : [{ key: item.nextAction.code, label: item.nextAction.label, disabled: false }];
  let usedPrimary = false;
  return (
    <span className="rf2-mywork__actions">
      {actions.map((action) => {
        if (action.disabled) return <DisabledAction key={action.key} action={action} />;
        const href = actionHref(item, action);
        if (!href) return null; // no page for this entity: no dead link
        // One primary per page (VI): the first enabled action of the first Today item.
        const kind = primary && !usedPrimary ? 'primary' : bucket === 'waitingOnOthers' ? 'tertiary' : 'secondary';
        if (kind === 'primary') usedPrimary = true;
        return (
          <Link key={action.key} className={`rf2-btn rf2-btn--${kind} rf2-btn--md`} to={href} aria-label={`${action.label}: ${item.title}`}>
            <span>{action.label}</span>
          </Link>
        );
      })}
    </span>
  );
}

function ItemMeta({ item }: { item: WorkItem }) {
  const join = (bits: React.ReactNode[]) => bits.map((b, i) => <span key={i}>{i > 0 ? ' · ' : ''}{b}</span>);
  const first: React.ReactNode[] = [];
  if (item.candidate) first.push(<span data-testid="candidate">{item.candidate.name}{item.stage ? ` · ${item.stage}` : ''}</span>);
  first.push(<span>{item.reason}</span>);
  const second: React.ReactNode[] = [];
  if (item.startAt) {
    const people = item.interviewers?.length ? item.interviewers : item.interviewer ? [item.interviewer] : [];
    second.push(item.room?.url
      ? <a href={item.room.url} target="_blank" rel="noreferrer">{item.room.name ?? 'Room link'}</a>
      : <span>{item.room?.name ?? 'No room yet'}</span>);
    if (people.length) second.push(<span data-testid="interviewers">With {people.map((p) => p.name).join(', ')}</span>);
  }
  return (
    <>
      <span className="rf2-mywork__meta-line">{join(first)}</span>
      {second.length ? <span className="rf2-mywork__meta-line">{join(second)}</span> : null}
    </>
  );
}

const HINT_NOUN: Record<WorkItemType, string> = { job: 'job', requisition: 'requisition', task: 'task', interview: 'interview', scorecard: 'scorecard', offer: 'offer' };
/** E02 tile detail: the first item, "Ahmed Embaby — scorecard" / "Lina Hassan — with Karim Hassan". */
function countHint(items: WorkItem[], bucket: Bucket): string | null {
  const first = items[0];
  if (!first) return null;
  const who = first.candidate?.name ?? first.title;
  if (bucket === 'waitingOnOthers') {
    const on = waitingOnName(first);
    return on ? `${who} — with ${on}` : `${who} — ${HINT_NOUN[first.type] ?? first.type}`;
  }
  return `${who} — ${HINT_NOUN[first.type] ?? first.type}`;
}

/** E02: a waiting offer reads "Lina Hassan — offer waiting on Karim Hassan" (never a role code). */
function rowTitle(item: WorkItem, bucket: Bucket): string {
  if (bucket !== 'waitingOnOthers' || item.type !== 'offer' || !item.candidate) return item.title;
  const on = waitingOnName(item);
  return `${item.candidate.name} — offer waiting ${on ? `on ${on}` : 'for approval'}`;
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export function MyWorkV2({ load = getMyWork }: { load?: typeof getMyWork } = {}) {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const day: MyWorkDay = params.get('day') === 'tomorrow' ? 'tomorrow' : 'today';
  const setDay = (next: MyWorkDay) => setParams((prev) => {
    const p = new URLSearchParams(prev);
    if (next === 'tomorrow') p.set('day', 'tomorrow'); else p.delete('day');
    return p;
  }, { replace: false });
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
  }, [load, attempt, day]);

  const data = state.kind === 'ready' ? state.result.data : null;
  const f = makeFormat(data?.timezone || 'Africa/Cairo');
  const total = data ? data.counts.overdue + data.counts.today + data.counts.waitingOnOthers : 0;
  const noWork = Boolean(data && (data.empty || data.overdue.length + data.dueToday.length + data.waitingOnOthers.length === 0));
  const firstName = (user?.displayName ?? '').split(' ')[0];

  let subtitle: string | null = null;
  if (data) {
    if (noWork) subtitle = 'Open files on your jobs that need you appear here.';
    else {
      const on = data.targets.length === 1 ? ` on your job ${data.targets[0].title}` : data.targets.length > 1 ? ` across ${data.targets.length} jobs` : '';
      subtitle = `${greeting()}${firstName ? `, ${firstName}` : ''}. ${total} open ${total === 1 ? 'task' : 'tasks'}${on}.`;
    }
  }

  return (
    <div className="rf2-mywork">
      <div className="rf2-mywork__top">
        <div>
          <h2 className="rf2-mywork__title">My Work</h2>
          {subtitle ? <p className="rf2-mywork__subtitle">{subtitle}</p> : null}
        </div>
        <div className="rf2-mywork__day">
          <div className="rf2-mywork__head-actions">
            {data && !noWork ? <Link className="rf2-btn rf2-btn--secondary rf2-btn--sm" to="/vacancies"><span>View open jobs</span></Link> : null}
          <div className="rf2-segmented" role="group" aria-label="Day">
            <ButtonV2 kind="secondary" size="sm" selected={day === 'today'} onClick={() => setDay('today')}>Today</ButtonV2>
            <ButtonV2 kind="secondary" size="sm" selected={day === 'tomorrow'} onClick={() => setDay('tomorrow')}>Tomorrow</ButtonV2>
          </div>
          </div>
          {data?.date ? <p className="rf2-mywork__today">{day === 'tomorrow' ? 'Tomorrow' : 'Today'} · {f.full(data.date)}</p> : null}
        </div>
      </div>

      {data && !data.reminderWorkerHealthy && !noWork ? (
        <p className="rf2-mywork__note" role="note" data-testid="sla-hidden">
          <Info aria-hidden="true" /> Reminders are paused right now, so SLA flags are hidden. Due dates below are still correct.
        </p>
      ) : null}
      {state.kind === 'ready' && state.result.source === 'fixture' ? (
        <p className="rf2-mywork__note" role="note" data-testid="sample-data-note">
          <Info aria-hidden="true" /> Sample data: the My Work API is not reachable. Shown in development only.
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
          {data.targets.length > 0 ? (
            <ul className="rf2-mywork__targets" aria-label="Your targets">
              {data.targets.map((t) => <li key={t.vacancyId}><TargetStrip target={t} format={f} /></li>)}
            </ul>
          ) : null}

          {noWork ? (
            <EmptyStateV2
              icon={<Check />}
              title={(data.emptyMessage ?? 'No open work assigned to you.').replace(/\.$/, '')}
              body="New tasks appear here when a file on your jobs needs you: a screening to log, a scorecard to chase, an offer to send."
              action={<Link className="rf2-btn rf2-btn--secondary rf2-btn--md" to="/vacancies"><span aria-hidden="true" style={{ display: 'contents' }}><BriefcaseBusiness /></span><span>View open jobs</span></Link>}
            />
          ) : (
            <>
              <dl className="rf2-mywork__counts" aria-label="Counts">
                {([['Total open', total, 'Tasks assigned to you'], ['Overdue', data.counts.overdue, countHint(data.overdue, 'overdue')], [day === 'tomorrow' ? 'Due tomorrow' : 'Due today', data.counts.today, countHint(data.dueToday, 'dueToday')], ['Waiting on others', data.counts.waitingOnOthers, countHint(data.waitingOnOthers, 'waitingOnOthers')]] as const).map(([label, value, hint]) => (
                  <div key={label} className="rf2-mywork__count" data-key={label}>
                    <dt>{label}</dt>
                    <dd data-count-value="">{value}</dd>
                    {hint ? <dd className="rf2-mywork__count-hint">{hint}</dd> : null}
                  </div>
                ))}
              </dl>
              {BUCKETS.map(({ key, title: t0, empty: e0 }) => {
                const title = key === 'dueToday' && day === 'tomorrow' ? 'Tomorrow' : t0;
                const empty = key === 'dueToday' && day === 'tomorrow' ? 'Nothing booked for tomorrow.' : e0;
                return (
                <TaskSection key={key} title={title} count={data[key].length} tone={key === 'overdue' ? 'danger' : 'default'} emptyText={empty}>
                  {data[key].map((item, index) => {
                    const due = dueText(item, key, day, f);
                    const sla = data.reminderWorkerHealthy ? slaChip(item, key, day) : null;
                    return (
                      <TaskRow key={`${item.type}-${item.id}`}
                        icon={key === 'overdue' ? <TriangleAlert /> : TYPE_ICON[item.type] ?? <Clock />}
                        iconTone={key === 'overdue' ? 'warning' : key === 'waitingOnOthers' ? 'neutral' : 'info'}
                        title={rowTitle(item, key)}
                        meta={<ItemMeta item={item} />}
                        chip={<span className="rf2-mywork__chips">{item.waitingOn ? <StatusChip tone="neutral" label={item.waitingOn === 'approver' ? 'Waiting on approval' : WAITING_LABEL[item.waitingOn] ?? 'Waiting'} /> : <StatusChip tone={key === 'overdue' ? 'warning' : 'info'} label={TYPE_LABEL[item.type] ?? item.type} />}{sla ? <span data-testid="sla">{sla}</span> : null}</span>}
                        due={key === 'waitingOnOthers' ? <span data-testid="due">No action for you</span> : due ? <span data-testid="due">{due}</span> : undefined}
                        dueTone={key === 'overdue' ? 'danger' : 'default'}
                        action={key === 'waitingOnOthers'
                          ? <span className="rf2-mywork__readonly">Read-only</span>
                          : <ItemActions item={item} bucket={key} primary={key === 'dueToday' && index === 0} />}
                      />
                    );
                  })}
                </TaskSection>
                );
              })}
            </>
          )}
        </>
      ) : null}
    </div>
  );
}

function TargetStrip({ target, format }: { target: MyWorkTarget; format: ReturnType<typeof makeFormat> }) {
  const pct = target.target > 0 ? Math.min(100, Math.round((target.filled / target.target) * 100)) : 0;
  return (
    <section className="rf2-jobstrip" aria-label={`Job: ${target.title}`}>
      <span className="rf2-jobstrip__icon" aria-hidden="true"><BriefcaseBusiness /></span>
      <div className="rf2-jobstrip__main">
        <h3 className="rf2-jobstrip__title"><Link to={`/vacancies/${encodeURIComponent(target.vacancyId)}`}>{target.title}</Link></h3>
        <p className="rf2-jobstrip__meta">{[target.vacancyCode, target.department, target.site, target.owner ? `Owner: ${target.owner.name}` : null].filter(Boolean).join(' · ')}</p>
      </div>
      <div className="rf2-jobstrip__seats">
        <span className="rf2-jobstrip__seats-kicker">Hire target</span>
        <span className="rf2-jobstrip__seats-label">{target.filled} of {target.target} joined</span>
        <span className="rf2-jobstrip__bar" role="progressbar" aria-label={`Seats filled for ${target.title}`} aria-valuemin={0} aria-valuemax={target.target} aria-valuenow={target.filled}>
          <span style={{ width: `${pct}%` }} />
        </span>
      </div>
      <div className="rf2-jobstrip__due">
        <span className="rf2-jobstrip__due-label">Due</span>
        <span className="rf2-jobstrip__due-value">{target.dueDate ? format.full(target.dueDate) : 'No due date'}</span>
      </div>
      <div className="rf2-jobstrip__links">
        <Link className="rf2-btn rf2-btn--secondary rf2-btn--sm" to={`/vacancies/${encodeURIComponent(target.vacancyId)}`} aria-label={`Open pipeline: ${target.title}`}><span>Open pipeline</span></Link>
      </div>
    </section>
  );
}
