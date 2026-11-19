import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  BriefcaseBusiness, Calendar, CalendarClock, Check, ChevronRight, CircleCheck,
  ClipboardCheck, ClipboardList, Clock, FileSignature, Info, ListChecks,
  MapPin, RotateCw, Sparkles, TriangleAlert, Video,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { ApiError } from '../../api/client';
import { ButtonV2 } from '../../components/v2/Button';
import { StatusChip } from '../../components/v2/StatusChip';
import { EmptyStateV2, ForbiddenStateV2, SkeletonV2 } from '../../components/v2/PageStates';
import { TabsV2, type TabV2Item } from '../../components/v2/Tabs';
import { TaskRow } from '../../components/v2/Task';
import '../../components/v2/v2-primitives.css';
import { WorkflowShortcutsV2 } from './WorkflowShortcutsV2';
import './my-work.css';
import { MyWorkTargets } from './MyWorkTargets';
import { MyWorkActivity } from './MyWorkActivity';
import { canUseMyInterviews } from '../../auth/interviewer';
import { usePageReturn } from '../returnTarget';
import {
  completeTask, fileActionHref, getMyWork, joiningCaseHref, rescheduleTask, taskRecordHref, upcomingInterviewHref, waitingBlockerPhrase, waitingOfferTitle,
  type HrefContext, type JoiningSoon, type MyWorkAction, type MyWorkDay, type MyWorkResponse, type MyWorkResult,
  type UpcomingInterview, type WorkItem, type WorkItemType,
} from '../api/myWork';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; result: MyWorkResult }
  | { kind: 'error'; message: string }
  | { kind: 'forbidden' };

type Bucket = 'overdue' | 'dueToday' | 'waitingOnOthers';
type WorkTab = 'actions' | 'interviews' | 'joining';
type WorkFilter = 'overdue' | 'today' | 'waiting';

const TYPE_LABEL: Record<WorkItemType, string> = { job: 'Job', requisition: 'Requisition', task: 'Task', interview: 'Interview', scorecard: 'Scorecard', offer: 'Offer' };
const TYPE_ICON: Record<WorkItemType, ReactNode> = {
  job: <BriefcaseBusiness />, requisition: <ClipboardList />, task: <ListChecks />, interview: <CalendarClock />, scorecard: <ClipboardCheck />, offer: <FileSignature />,
};
const WAITING_LABEL = { approver: 'Waiting on approval', interviewer: 'Waiting on interviewer', candidate: 'Waiting on candidate' } as const;
const READINESS_LABEL = {
  approval_pending: 'Approval pending',
  licence_pending: 'Licence pending',
  checks_pending: 'Checks pending',
  ready: 'Ready to record',
  postponed: 'Postponed',
  blocked: 'Blocked',
  review: 'Review readiness',
} as const;

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

type Format = ReturnType<typeof makeFormat>;

function workTab(value: string | null): WorkTab {
  if (value === 'interviews' || value === 'joining') return value;
  return 'actions';
}

function workFilter(value: string | null): WorkFilter | null {
  if (value === 'overdue' || value === 'today' || value === 'waiting') return value;
  return null;
}

function panelId(tab: WorkTab): string {
  if (tab === 'interviews') return 'my-work-interviews';
  if (tab === 'joining') return 'my-work-joining';
  return 'my-work-actions';
}

function welcomeLine(displayName: string | null | undefined): string {
  const first = displayName?.trim().split(/\s+/)[0];
  return first ? `Welcome back, ${first}.` : 'Welcome back.';
}

function dueText(item: WorkItem, bucket: Bucket, day: MyWorkDay, f: Format): string | null {
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

function taskFailureMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'Could not update this task.';
}

/** Task rows complete and reschedule in place. A linked record stays a separate navigation link. */
function TaskItemActions({
  item, primary, ctx, busy, error, editing, draftDue, onComplete, onToggleReschedule, onDraftDue, onSaveDue, onCancelReschedule,
}: {
  item: WorkItem;
  primary: boolean;
  ctx: HrefContext;
  busy: boolean;
  error: string | null;
  editing: boolean;
  draftDue: string;
  onComplete: () => void;
  onToggleReschedule: () => void;
  onDraftDue: (value: string) => void;
  onSaveDue: () => void;
  onCancelReschedule: () => void;
}) {
  const recordHref = taskRecordHref(item, ctx);
  const completeKind = primary ? 'primary' : 'secondary';
  const extraKind = primary ? 'tertiary' : 'secondary';
  return (
    <>
      <span className="rf2-mywork__actions">
        <button type="button" className={`rf2-btn rf2-btn--${completeKind} rf2-btn--md`} aria-label={`Complete task: ${item.title}`} disabled={busy} onClick={onComplete}>
          <span>Complete task</span>
        </button>
        {recordHref ? (
          <Link className={`rf2-btn rf2-btn--${extraKind} rf2-btn--md`} to={recordHref} aria-label={`Open record: ${item.title}`}>
            <span>Open record</span>
          </Link>
        ) : null}
        {editing ? (
          <span className="rf2-mywork__reschedule">
            <input type="datetime-local" aria-label={`Due date for ${item.title}`} value={draftDue} disabled={busy} onChange={(event) => onDraftDue(event.target.value)} />
            <ButtonV2 kind="secondary" size="sm" disabled={busy} onClick={onSaveDue}>Save due date</ButtonV2>
            <ButtonV2 kind="tertiary" size="sm" disabled={busy} onClick={onCancelReschedule}>Cancel</ButtonV2>
          </span>
        ) : (
          <button type="button" className={`rf2-btn rf2-btn--${extraKind} rf2-btn--md`} aria-label={`Reschedule: ${item.title}`} disabled={busy} onClick={onToggleReschedule}>
            <span>Reschedule</span>
          </button>
        )}
      </span>
      {error ? <p role="alert" className="rf2-mywork__task-error">{error}</p> : null}
    </>
  );
}

/** #9 actions[]: the bucket's next action is filled. Other destinations on that row are text. A refused destination stays disabled. */
function ItemActions({ item, bucket, primary, ctx }: { item: WorkItem; bucket: Bucket; primary: boolean; ctx: HrefContext }) {
  const actions = item.actions.length ? item.actions : [{ key: item.nextAction.code, label: item.nextAction.label, disabled: false }];
  let usedPrimary = false;
  return (
    <span className="rf2-mywork__actions">
      {actions.map((action) => {
        if (action.disabled) return <DisabledAction key={action.key} action={action} />;
        const href = fileActionHref(item, action, ctx);
        if (!href) return null;
        const filled = primary && !usedPrimary && action.key === item.nextAction.code;
        const kind = filled ? 'primary' : primary || bucket === 'waitingOnOthers' ? 'tertiary' : 'secondary';
        if (filled) usedPrimary = true;
        return (
          <Link key={action.key} className={`rf2-btn rf2-btn--${kind} rf2-btn--md`} to={href} aria-label={`${action.label}: ${item.title}`}>
            <span>{action.label}</span>
          </Link>
        );
      })}
    </span>
  );
}

/** Offer rows name the waitingOn blocker. A sent offer is not an approval. Scorecards keep their own reason. */
function itemReason(item: WorkItem): string {
  if (item.type === 'offer' && item.waitingOn) return waitingBlockerPhrase(item);
  if (item.waitingOn && item.waitingOn !== 'approver' && /approval/i.test(item.reason)) return waitingBlockerPhrase(item);
  return item.reason;
}

function ItemMeta({ item }: { item: WorkItem }) {
  const join = (bits: ReactNode[]) => bits.map((b, i) => <span key={i}>{i > 0 ? ' · ' : ''}{b}</span>);
  const first: ReactNode[] = [];
  if (item.candidate?.name) first.push(<span data-testid="candidate">{item.candidate.name}{item.stage ? ` · ${item.stage}` : ''}</span>);
  first.push(<span>{itemReason(item)}</span>);
  const second: ReactNode[] = [];
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

function rowTitle(item: WorkItem, bucket: Bucket): string {
  if (bucket === 'waitingOnOthers' && item.type === 'offer') return waitingOfferTitle(item);
  return item.title;
}

function filterEmpty(filter: WorkFilter, day: MyWorkDay): string {
  if (filter === 'overdue') return 'Nothing overdue.';
  if (filter === 'waiting') return 'Nothing waiting on others.';
  if (day === 'tomorrow') return 'Nothing booked for tomorrow.';
  return 'Nothing due today.';
}

function bucketLabel(bucket: Bucket, dayLabel: string): string {
  if (bucket === 'overdue') return 'Overdue';
  if (bucket === 'dueToday') return dayLabel;
  return 'Waiting on others';
}

function NextActions({ data, day, filter, onFilter, f, ctx, onReload }: {
  data: MyWorkResponse;
  day: MyWorkDay;
  filter: WorkFilter | null;
  onFilter: (next: WorkFilter | null) => void;
  f: Format;
  ctx: HrefContext;
  onReload: () => void;
}) {
  const busyRef = useRef<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [taskErrors, setTaskErrors] = useState<Record<string, string>>({});
  const [editor, setEditor] = useState<{ id: string; due: string } | null>(null);

  const runTask = (id: string, work: () => Promise<unknown>) => {
    if (busyRef.current === id) return;
    busyRef.current = id;
    setBusyTaskId(id);
    setTaskErrors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    void work()
      .then(() => {
        setEditor((current) => (current?.id === id ? null : current));
        onReload();
      })
      .catch((error: unknown) => {
        setTaskErrors((prev) => ({ ...prev, [id]: taskFailureMessage(error) }));
      })
      .finally(() => {
        if (busyRef.current === id) busyRef.current = null;
        setBusyTaskId((current) => (current === id ? null : current));
      });
  };
  const dayLabel = day === 'tomorrow' ? 'Tomorrow' : 'Today';
  const filters: Array<{ key: WorkFilter; label: string; count: number }> = [
    { key: 'overdue', label: 'Overdue', count: data.counts.overdue },
    { key: 'today', label: dayLabel, count: data.counts.today },
    { key: 'waiting', label: 'Waiting', count: data.counts.waitingOnOthers },
  ];
  const ordered: Array<{ item: WorkItem; bucket: Bucket; primary: boolean }> = [
    ...data.overdue.map((item, index) => ({ item, bucket: 'overdue' as const, primary: index === 0 })),
    ...data.dueToday.map((item, index) => ({ item, bucket: 'dueToday' as const, primary: index === 0 })),
    ...data.waitingOnOthers.map((item, index) => ({ item, bucket: 'waitingOnOthers' as const, primary: index === 0 })),
  ];
  const visible = ordered.filter((row) => {
    if (filter === 'overdue') return row.bucket === 'overdue';
    if (filter === 'today') return row.bucket === 'dueToday';
    if (filter === 'waiting') return row.bucket === 'waitingOnOthers';
    return true;
  });

  return (
    <div className="rf2-mywork__card rf2-mywork__tasks-card">
      <div className="rf2-mywork__card-head">
        <div className="rf2-mywork__card-title-wrap">
          <span className="rf2-mywork__card-icon" data-tone="blue" aria-hidden="true"><ListChecks /></span>
          <span className="rf2-mywork__card-title">My tasks &amp; action queue</span>
        </div>
        <span className="rf2-mywork__card-badge">{ordered.length} active</span>
      </div>
      <div className="rf2-mywork__filters" role="group" aria-label="Counts">
        {filters.map((entry) => (
          <button
            key={entry.key}
            type="button"
            className="rf2-mywork__filter"
            data-filter={entry.key}
            aria-pressed={filter === entry.key}
            aria-label={`${entry.count} ${entry.label}`}
            onClick={() => onFilter(filter === entry.key ? null : entry.key)}
          >
            <span className="rf2-mywork__filter-value" data-count-value="">{entry.count}</span>
            <span className="rf2-mywork__filter-label">{entry.label}</span>
          </button>
        ))}
        <div className="rf2-mywork__list-head">
          <ButtonV2 kind="secondary" size="md" selected={filter === null} onClick={() => { if (filter) onFilter(null); }}>All tasks</ButtonV2>
        </div>
      </div>
      <div className="rf2-mywork__surface">
        {visible.length === 0 && filter ? <p className="rf2-mywork__filter-empty">{filterEmpty(filter, day)}</p> : null}
        {visible.length > 0 ? (
          <ul className="rf2-mywork__list" aria-label="Next actions">
            {(['overdue', 'dueToday', 'waitingOnOthers'] as const).map((bucket) => {
              const rows = visible.filter((row) => row.bucket === bucket);
              if (!rows.length) return null;
              const BucketIcon = bucket === 'overdue' ? TriangleAlert : bucket === 'dueToday' ? CalendarClock : Clock;
              return <li key={bucket} className="rf2-mywork__bucket" data-bucket-group={bucket}>
                <section aria-label={`${bucketLabel(bucket, dayLabel)} actions`}>
                  {!filter ? <header className="rf2-mywork__bucket-head"><h3 className="rf2-mywork__bucket-label" data-testid="bucket-label"><BucketIcon aria-hidden="true" />{bucketLabel(bucket, dayLabel)}</h3><span className="rf2-mywork__bucket-count" aria-label={`${rows.length} actions`}>{rows.length}</span></header> : null}
                  <ul className="rf2-mywork__bucket-rows">
                    {rows.map(({ item, primary }) => {
                      const due = dueText(item, bucket, day, f);
                      const sla = data.reminderWorkerHealthy ? slaChip(item, bucket, day) : null;
                      const waitingLabel = item.waitingOn ? WAITING_LABEL[item.waitingOn] : null;
                      const waitingChip = bucket === 'waitingOnOthers' || waitingLabel
                        ? <StatusChip tone="neutral" label={waitingLabel ?? 'Waiting'} />
                        : null;
                      const typeChip = <StatusChip tone={bucket === 'overdue' ? 'warning' : 'info'} label={TYPE_LABEL[item.type] ?? item.type} />;
                      return (
                        <li key={`${bucket}-${item.type}-${item.id}`} data-testid="work-row" data-bucket={bucket} data-priority-group={bucket} data-work-type={item.type}>
                          <TaskRow
                            icon={TYPE_ICON[item.type] ?? <Clock />}
                            iconTone={bucket === 'overdue' ? 'danger' : bucket === 'waitingOnOthers' ? 'warning' : 'info'}
                            title={rowTitle(item, bucket)}
                            meta={<ItemMeta item={item} />}
                            chip={<span className="rf2-mywork__chips">{waitingChip ?? typeChip}{sla ? <span data-testid="sla">{sla}</span> : null}</span>}
                            due={due ? <span data-testid="due">{due}</span> : undefined}
                            dueTone={bucket === 'overdue' ? 'danger' : 'default'}
                            action={item.type === 'task' && item.nextAction.code === 'complete-task' ? (
                              <TaskItemActions
                                item={item}
                                primary={primary}
                                ctx={ctx}
                                busy={busyTaskId === item.id}
                                error={taskErrors[item.id] ?? null}
                                editing={editor?.id === item.id}
                                draftDue={editor?.id === item.id ? editor.due : ''}
                                onComplete={() => runTask(item.id, () => completeTask(item.id))}
                                onToggleReschedule={() => setEditor((current) => (current?.id === item.id ? null : { id: item.id, due: '' }))}
                                onDraftDue={(value) => setEditor({ id: item.id, due: value })}
                                onSaveDue={() => {
                                  const due = editor?.id === item.id ? editor.due : '';
                                  const parsed = new Date(due);
                                  if (!due || Number.isNaN(parsed.getTime())) {
                                    setTaskErrors((prev) => ({ ...prev, [item.id]: 'Choose a future follow-up date and time' }));
                                    return;
                                  }
                                  runTask(item.id, () => rescheduleTask(item.id, parsed.toISOString()));
                                }}
                                onCancelReschedule={() => setEditor((current) => (current?.id === item.id ? null : current))}
                              />
                            ) : (
                              <ItemActions item={item} bucket={bucket} primary={primary} ctx={ctx} />
                            )}
                          />
                        </li>
                      );
                    })}
                  </ul>
                </section>
              </li>;
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function WorkspaceSidebar({ rows, f, ctx, onViewAll, onReload, refreshKey, timezone }: { rows: UpcomingInterview[] | undefined; f: Format; ctx: HrefContext; onViewAll: () => void; onReload: () => void; refreshKey: number; timezone: string }) {
  const visible = rows ? [...rows].sort((a, b) => a.startAt.localeCompare(b.startAt)).slice(0, 4) : [];
  return (
    <aside className="rf2-mywork__side-col" aria-label="Workspace widgets">
      <section className="rf2-mywork__card" aria-labelledby="mywork-upcoming">
        <div className="rf2-mywork__card-head">
          <div className="rf2-mywork__card-title-wrap"><span className="rf2-mywork__card-icon" data-tone="blue" aria-hidden="true"><CalendarClock /></span><h2 id="mywork-upcoming" className="rf2-mywork__card-title">Upcoming interviews</h2></div>
          <ButtonV2 kind="tertiary" size="sm" onClick={onViewAll}>View all interviews</ButtonV2>
        </div>
        {rows === undefined ? <div role="status"><p>Upcoming interviews are unavailable in this response.</p><ButtonV2 kind="secondary" size="sm" onClick={onReload}>Retry interviews</ButtonV2></div> : !visible.length ? <p className="rf2-mywork__note">No upcoming interviews assigned to you.</p> : (
          <ul className="rf2-mywork__mini-intv-list">
            {visible.map((row) => {
              const href = upcomingInterviewHref(row, ctx);
              const [date, month] = f.dayMonth(row.startAt).split(' ');
              const content = <>
                <span className="rf2-mywork__mini-date" aria-hidden="true"><span className="rf2-mywork__mini-date-day">{date}</span><span className="rf2-mywork__mini-date-mon">{month}</span></span>
                <span className="rf2-mywork__mini-main"><strong className="rf2-mywork__mini-name">{row.candidateName || row.title}</strong><span className="rf2-mywork__mini-role">{row.jobTitle || row.title}</span>{row.status === 'scorecard_overdue' ? <span className="rf2-mywork__mini-role">Feedback overdue</span> : null}</span>
                <span className="rf2-mywork__mini-meta"><span className="rf2-mywork__mini-meta-item"><Clock aria-hidden="true" />{f.time(row.startAt)}</span><span className="rf2-mywork__mini-meta-item">{row.room.url ? <Video aria-hidden="true" /> : <MapPin aria-hidden="true" />}{row.room.name || (row.room.url ? 'Online' : 'Location not set')}</span></span>
                {href ? <ChevronRight aria-hidden="true" className="rf2-mywork__mini-arrow" /> : null}
              </>;
              return <li key={row.id}>{href ? <Link className="rf2-mywork__mini-intv" to={href} aria-label={`${row.action.label}: ${row.title}`}>{content}</Link> : <div className="rf2-mywork__mini-intv" data-disabled="true">{content}<span className="rf2-mywork__mini-reason">{row.action.reason || (row.access === 'file' && !ctx.canOpenFile ? FILE_VIEW_REASON : 'This interview cannot be opened.')}</span></div>}</li>;
            })}
          </ul>
        )}
      </section>
      <MyWorkActivity employeeId={ctx.meId ?? undefined} canView={ctx.canOpenFile === true} refreshKey={refreshKey} returnTo={ctx.returnTo ?? null} timezone={timezone} />
    </aside>
  );
}

function scheduleWhen(row: UpcomingInterview, f: Format): string {
  const end = row.endAt ? `–${f.time(row.endAt)}` : '';
  return `${f.dayMonth(row.startAt)} · ${f.time(row.startAt)}${end}`;
}

function ScheduleMeta({ row, f }: { row: UpcomingInterview; f: Format }) {
  const people = row.interviewers.map((person) => person.name).filter(Boolean);
  const bits: ReactNode[] = [];
  if (row.access === 'evaluation') bits.push(<span>Assigned to you</span>);
  bits.push(<span>{scheduleWhen(row, f)}</span>);
  if (people.length) bits.push(<span>With {people.join(', ')}</span>);
  if (row.access === 'evaluation') bits.push(<span>CV and evaluation only</span>);
  else if (row.room.url) bits.push(<a href={row.room.url} target="_blank" rel="noreferrer">{row.room.name ?? 'Room link'}</a>);
  else bits.push(<span>{row.room.name ?? 'No room yet'}</span>);
  if (row.held) bits.push(<span>On hold</span>);
  return <>{bits.map((bit, index) => <span key={index}>{index > 0 ? ' · ' : ''}{bit}</span>)}</>;
}

function scheduleChip(row: UpcomingInterview) {
  if (row.status === 'scorecard_overdue') return <StatusChip tone="warning" label="Scorecard overdue" />;
  if (row.status === 'assigned') return <StatusChip tone="info" label="Assigned" />;
  return <StatusChip tone="info" label="Scheduled" />;
}

const FILE_VIEW_REASON = 'Opening the recruiting file needs application view.';

function ScheduleAction({ row, ctx }: { row: UpcomingInterview; ctx: HrefContext }) {
  if (row.action.disabled) return <DisabledAction action={row.action} />;
  if (row.access === 'file' && ctx.canOpenFile !== true) {
    return <DisabledAction action={{ ...row.action, disabled: true, reason: FILE_VIEW_REASON }} />;
  }
  const href = upcomingInterviewHref(row, ctx);
  if (!href) return null;
  return (
    <Link className="rf2-btn rf2-btn--secondary rf2-btn--md" to={href} aria-label={`${row.action.label}: ${row.title}`}>
      <span>{row.action.label}</span>
    </Link>
  );
}

function InterviewGroup({ title, rows, f, ctx }: { title: string; rows: UpcomingInterview[]; f: Format; ctx: HrefContext }) {
  const id = useId();
  if (!rows.length) return null;
  return (
    <section className="rf2-mywork__group" aria-labelledby={id}>
      <h3 id={id} className="rf2-mywork__list-title">{title}</h3>
      <ul className="rf2-mywork__list">
        {rows.map((row) => (
          <li key={row.id} data-testid="interview-row" data-access={row.access}>
            <TaskRow
              icon={<CalendarClock />}
              iconTone={row.access === 'evaluation' ? 'neutral' : 'info'}
              title={row.title}
              meta={<span className="rf2-mywork__meta-line"><ScheduleMeta row={row} f={f} /></span>}
              chip={scheduleChip(row)}
              action={<ScheduleAction row={row} ctx={ctx} />}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function InterviewPanel({ rows, f, ctx }: { rows: UpcomingInterview[] | undefined; f: Format; ctx: HrefContext }) {
  if (rows === undefined) return <p className="rf2-mywork__note" role="status">Upcoming interviews are unavailable in this response.</p>;
  if (rows.length === 0) {
    return (
      <EmptyStateV2
        icon={<CalendarClock />}
        title="No upcoming interviews assigned to you."
        body="Interviews on your jobs, and interviews assigned to you, show here with one way to open the file."
      />
    );
  }
  const fileRows = rows.filter((row) => row.access === 'file');
  const assigned = rows.filter((row) => row.access === 'evaluation');
  return (
    <div className="rf2-mywork__surface">
      <InterviewGroup title="Interview schedule" rows={fileRows} f={f} ctx={ctx} />
      <InterviewGroup title="Your assigned interviews" rows={assigned} f={f} ctx={ctx} />
    </div>
  );
}

function joiningMeta(row: JoiningSoon, f: Format): string {
  const start = row.intendedDate ? `Starts ${f.dayMonth(row.intendedDate)}` : 'Date not set';
  const held = row.held ? ' · On hold' : '';
  return `${start} · ${row.checksComplete} of ${row.checksRequired} checks complete · ${row.detail}${held}`;
}

function joiningTone(row: JoiningSoon): 'warning' | 'info' | 'neutral' {
  if (row.readiness === 'ready') return 'info';
  if (row.readiness === 'postponed') return 'neutral';
  return 'warning';
}

function JoiningPanel({ rows, canOpenFile, f, returnTo }: { rows: JoiningSoon[] | undefined; canOpenFile: boolean; f: Format; returnTo: string | null }) {
  if (rows === undefined) return <p className="rf2-mywork__note" role="status">Joining cases are unavailable in this response.</p>;
  return (
    <section className="rf2-mywork__group" aria-label="Joining soon">
      {rows.length === 0 ? (
        <EmptyStateV2
          icon={<CircleCheck />}
          title="No joining dates on your accepted cases."
          body="A start date appears here after an offer is accepted, with the checks still open."
        />
      ) : (
        <div className="rf2-mywork__surface">
          <ul className="rf2-mywork__list">
                    {rows.map((row) => {
                      const dest = joiningCaseHref(row, canOpenFile, returnTo);
                      return (
                        <li key={row.id} data-testid="joining-row" data-readiness={row.readiness}>
                          <TaskRow
                            icon={<CircleCheck />}
                            iconTone="info"
                            title={`${row.candidateName} · ${row.jobTitle}`}
                            meta={<span className="rf2-mywork__meta-line">{joiningMeta(row, f)}</span>}
                            chip={<StatusChip tone={joiningTone(row)} label={READINESS_LABEL[row.readiness]} />}
                            action={(
                              <Link className="rf2-btn rf2-btn--secondary rf2-btn--md" to={dest.href} aria-label={`${dest.label}: ${row.candidateName}`}>
                                <span>{dest.label}</span>
                              </Link>
                            )}
                          />
                        </li>
                      );
                    })}
          </ul>
        </div>
      )}
      <p className="rf2-mywork__footnote" data-testid="joining-footnote">Counts update after joining is confirmed. A scheduled start is not a completed hire.</p>
    </section>
  );
}

export function MyWorkV2({ load = getMyWork }: { load?: typeof getMyWork } = {}) {
  const { user } = useAuth();
  useEffect(() => {
    document.documentElement.setAttribute('data-my-work-surface', '');
    return () => document.documentElement.removeAttribute('data-my-work-surface');
  }, []);

  const pageReturn = usePageReturn();
  const hrefCtx: HrefContext = { meId: user?.id, canOpenFile: (user?.permissions ?? []).includes('APPLICATION_VIEW'), interviewer: canUseMyInterviews(user), returnTo: pageReturn };
  const [params, setParams] = useSearchParams();
  const day: MyWorkDay = params.get('day') === 'tomorrow' ? 'tomorrow' : 'today';
  const tab = workTab(params.get('tab'));
  const filter = workFilter(params.get('filter'));
  const updateParams = (mutate: (next: URLSearchParams) => void) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      mutate(next);
      return next;
    }, { replace: false });
  };
  const setDay = (next: MyWorkDay) => updateParams((p) => {
    if (next === 'tomorrow') p.set('day', 'tomorrow');
    else p.delete('day');
  });
  const setTab = (next: string) => updateParams((p) => {
    if (next === 'interviews' || next === 'joining') p.set('tab', next);
    else p.delete('tab');
  });
  const setFilter = (next: WorkFilter | null) => updateParams((p) => {
    if (next) p.set('filter', next);
    else p.delete('filter');
  });
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

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void load(day)
        .then((result) => setState({ kind: 'ready', result }))
        .catch(() => undefined);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load, day]);

  const data = state.kind === 'ready' ? state.result.data : null;
  const f = makeFormat(data?.timezone || 'Africa/Cairo');
  const noWork = Boolean(data && (data.empty || data.overdue.length + data.dueToday.length + data.waitingOnOthers.length === 0));
  const tabs: TabV2Item[] = [
    { key: 'actions', label: 'Next actions', icon: <ListChecks />, controls: tab === 'actions' ? panelId('actions') : undefined },
    { key: 'interviews', label: 'Upcoming interviews', icon: <CalendarClock />, controls: tab === 'interviews' ? panelId('interviews') : undefined },
    { key: 'joining', label: 'Joining soon', icon: <CircleCheck />, controls: tab === 'joining' ? panelId('joining') : undefined },
  ];


  return (
    <div className="rf2-mywork">
      <div className="rf2-mywork__hero">
        <div className="rf2-mywork__hero-copy">
          <p className="rf2-mywork__welcome"><Sparkles aria-hidden="true" />{welcomeLine(user?.displayName)}</p>
          <p className="rf2-mywork__subtitle">Your targets, next actions, and interviews in one place.</p>
        </div>
        {data ? (
          <div className="rf2-mywork__day">
            <div className="rf2-mywork__head-actions">
              {!noWork && tab === 'actions' ? <Link className="rf2-btn rf2-btn--secondary rf2-btn--sm" to="/vacancies"><span>View open jobs</span></Link> : null}
              <div className="rf2-mywork__quiet-day" role="group" aria-label="Day">
                <ButtonV2 kind="secondary" size="sm" selected={day === 'today'} aria-label="Show today" onClick={() => setDay('today')}>Today</ButtonV2>
                <ButtonV2 kind="secondary" size="sm" selected={day === 'tomorrow'} aria-label="Show tomorrow" onClick={() => setDay('tomorrow')}>Tomorrow</ButtonV2>
              </div>
            </div>
            <div className="rf2-mywork__day-badges">
              {data.date ? (
                <div className="rf2-mywork__date-pill">
                  <Calendar aria-hidden="true" />
                  <p className="rf2-mywork__today">{day === 'tomorrow' ? 'Tomorrow' : 'Today'} · {f.full(data.date)}</p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
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
          <MyWorkTargets today={data.today} employeeId={user?.id} period={params.get('targetPeriod') === 'weekly' ? 'weekly' : 'monthly'} onPeriod={(period) => updateParams((next) => { if (period === 'weekly') next.set('targetPeriod', period); else next.delete('targetPeriod'); })} returnTo={pageReturn} canOpenFile={Boolean(hrefCtx.canOpenFile)} refreshKey={attempt} />

          <div className="rf2-mywork__toolbar">
            <TabsV2 items={tabs} activeKey={tab} onChange={setTab} ariaLabel="My Work sections" />
          </div>

          <div role="tabpanel" id={panelId(tab)} aria-labelledby={`rf2-tab-${tab}`} className="rf2-mywork__panel">
            {tab === 'actions' ? (
              <div className="rf2-mywork__workspace">
                <div className="rf2-mywork__main-col">
                  {noWork ? <EmptyStateV2 icon={<Check />} title={(data.emptyMessage ?? 'No open work assigned to you.').replace(/\.$/, '')} body="Your next actions appear here when a file on your jobs needs you." action={<Link className="rf2-btn rf2-btn--secondary rf2-btn--md" to="/vacancies">View open jobs</Link>} /> : <NextActions data={data} day={day} filter={filter} onFilter={setFilter} f={f} ctx={hrefCtx} onReload={() => setAttempt((value) => value + 1)} />}
                </div>
                <WorkspaceSidebar rows={data.upcomingInterviews} f={f} ctx={hrefCtx} onViewAll={() => setTab('interviews')} onReload={() => setAttempt((value) => value + 1)} refreshKey={attempt} timezone={data.timezone || 'Africa/Cairo'} />
              </div>
            ) : null}
            {tab === 'interviews' ? <InterviewPanel rows={data.upcomingInterviews} f={f} ctx={hrefCtx} /> : null}
            {tab === 'joining' ? <JoiningPanel rows={data.joiningSoon} canOpenFile={Boolean(hrefCtx.canOpenFile)} f={f} returnTo={pageReturn} /> : null}
          </div>
          <WorkflowShortcutsV2 seat="employee" />
        </>
      ) : null}
    </div>
  );
}
