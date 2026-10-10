import { useEffect, useState } from 'react';
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
import { entityHref, getMyWork, type MyWorkResult, type MyWorkTarget, type WorkItem, type WorkItemType } from '../api/myWork';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; result: MyWorkResult }
  | { kind: 'error'; message: string }
  | { kind: 'forbidden' };

type Bucket = 'overdue' | 'dueToday' | 'waitingOnOthers';
const BUCKETS: Array<{ key: Bucket; title: string; empty: string }> = [
  { key: 'overdue', title: 'Overdue', empty: 'Nothing overdue.' },
  { key: 'dueToday', title: 'Today', empty: 'Nothing due today.' },
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

function dueText(item: WorkItem, bucket: Bucket, f: ReturnType<typeof makeFormat>): string | null {
  if (!item.dueAt) return null;
  if (bucket === 'dueToday') return f.dateOnly(item.dueAt) ? 'Today' : `Today, ${f.time(item.dueAt)}`;
  if (bucket === 'overdue') return `Due ${f.dayMonth(item.dueAt)}`;
  return f.dateOnly(item.dueAt) ? `Due ${f.dayMonth(item.dueAt)}` : `Ended ${f.dayMonth(item.dueAt)}`;
}

function ItemAction({ item, bucket, primary }: { item: WorkItem; bucket: Bucket; primary: boolean }) {
  const href = entityHref(item.entity);
  if (!href) return null; // no v1 page for this entity type: show no button rather than a dead link
  // One primary per page (VI): the first Today item; other actions are secondary/tertiary.
  const kind = primary ? 'primary' : bucket === 'waitingOnOthers' ? 'tertiary' : 'secondary';
  return (
    <Link className={`rf2-btn rf2-btn--${kind} rf2-btn--md`} to={href} aria-label={`${item.nextAction.label}: ${item.title}`}>
      <span>{item.nextAction.label}</span>
    </Link>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export function MyWorkV2({ load = getMyWork }: { load?: typeof getMyWork } = {}) {
  const { user } = useAuth();
  const [params] = useSearchParams();
  // #9 has no day= parameter: the Tomorrow view (E05) is not available yet.
  const askedTomorrow = params.get('day') === 'tomorrow';
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setState({ kind: 'loading' });
    load()
      .then((result) => { if (alive) setState({ kind: 'ready', result }); })
      .catch((error: unknown) => {
        if (!alive) return;
        if (error instanceof ApiError && error.statusCode === 403) setState({ kind: 'forbidden' });
        else setState({ kind: 'error', message: error instanceof Error && error.message ? error.message : 'Could not load your work.' });
      });
    return () => { alive = false; };
  }, [load, attempt]);

  const data = state.kind === 'ready' ? state.result.data : null;
  const f = makeFormat(data?.timezone || 'Africa/Cairo');
  const total = data ? data.counts.overdue + data.counts.today + data.counts.waitingOnOthers : 0;
  const noWork = Boolean(data && data.overdue.length + data.dueToday.length + data.waitingOnOthers.length === 0);
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
        {data?.today ? <p className="rf2-mywork__today">Today · {f.full(data.today)}</p> : null}
      </div>

      {askedTomorrow ? (
        <p className="rf2-mywork__note" role="note" data-testid="tomorrow-unavailable">
          <Info aria-hidden="true" /> The Tomorrow view isn't available yet. Showing today.
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
              {BUCKETS.map(({ key, title, empty }) => (
                <TaskSection key={key} title={title} count={data[key].length} tone={key === 'overdue' ? 'danger' : 'default'} emptyText={empty}>
                  {data[key].map((item, index) => {
                    const due = dueText(item, key, f);
                    return (
                      <TaskRow key={`${item.type}-${item.id}`}
                        icon={key === 'overdue' ? <TriangleAlert /> : TYPE_ICON[item.type] ?? <Clock />}
                        iconTone={key === 'overdue' ? 'warning' : key === 'waitingOnOthers' ? 'neutral' : 'info'}
                        title={item.title}
                        meta={item.reason}
                        chip={item.waitingOn ? <StatusChip tone="neutral" label={WAITING_LABEL[item.waitingOn] ?? 'Waiting'} /> : <StatusChip tone={key === 'overdue' ? 'warning' : 'info'} label={TYPE_LABEL[item.type] ?? item.type} />}
                        due={due ? <span data-testid="due">{due}</span> : undefined}
                        dueTone={key === 'overdue' ? 'danger' : 'default'}
                        action={<ItemAction item={item} bucket={key} primary={key === 'dueToday' && index === 0} />}
                      />
                    );
                  })}
                </TaskSection>
              ))}
              <dl className="rf2-mywork__counts" aria-label="Counts">
                {([['Total open', total, 'Tasks assigned to you'], ['Overdue', data.counts.overdue, null], ['Due today', data.counts.today, null], ['Waiting on others', data.counts.waitingOnOthers, null]] as const).map(([label, value, hint]) => (
                  <div key={label} className="rf2-mywork__count" data-key={label}>
                    <dt>{label}</dt>
                    <dd data-count-value="">{value}</dd>
                    {hint ? <dd className="rf2-mywork__count-hint">{hint}</dd> : null}
                  </div>
                ))}
              </dl>
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
        <p className="rf2-jobstrip__meta">{target.vacancyCode}</p>
      </div>
      <div className="rf2-jobstrip__seats">
        <span className="rf2-jobstrip__seats-label">{target.label} filled</span>
        <span className="rf2-jobstrip__bar" role="progressbar" aria-label={`Seats filled for ${target.title}`} aria-valuemin={0} aria-valuemax={target.target} aria-valuenow={target.filled}>
          <span style={{ width: `${pct}%` }} />
        </span>
      </div>
      <div className="rf2-jobstrip__due">
        <span className="rf2-jobstrip__due-label">Due</span>
        <span className="rf2-jobstrip__due-value">{target.dueDate ? format.full(target.dueDate) : 'No due date'}</span>
      </div>
    </section>
  );
}
