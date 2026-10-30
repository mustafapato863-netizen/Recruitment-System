import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Bell, BriefcaseBusiness, Calendar, CalendarClock, Check, ChevronRight, CircleCheck,
  ClipboardCheck, ClipboardList, Clock, FileSignature, FileText, Info, ListChecks,
  MapPin, PlusCircle, RotateCw, Search, Sparkles, Target, TriangleAlert, UserPlus, Users, Video, Zap,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { ApiError } from '../../api/client';
import { ButtonV2 } from '../../components/v2/Button';
import { StatusChip } from '../../components/v2/StatusChip';
import { EmptyStateV2, ForbiddenStateV2, SkeletonV2 } from '../../components/v2/PageStates';
import { TabsV2, type TabV2Item } from '../../components/v2/Tabs';
import { TaskRow } from '../../components/v2/Task';
import '../../components/v2/v2-primitives.css';
import './my-work.css';
import { canUseMyInterviews } from '../../auth/interviewer';
import { usePageReturn } from '../returnTarget';
import {
  completeTask, fileActionHref, getMyWork, joiningCaseHref, rescheduleTask, taskRecordHref, upcomingInterviewHref, waitingBlockerPhrase, waitingOfferTitle,
  type HrefContext, type JoiningSoon, type MyWorkAction, type MyWorkDay, type MyWorkResponse, type MyWorkResult,
  type MyWorkTarget, type UpcomingInterview, type WorkItem, type WorkItemType,
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

const TODAY_TIMELINE = [
  {
    id: 'tl-1',
    time: '09:00 AM',
    dot: 'blue',
    title: 'Interview – Clinical Pharmacist',
    subtitle: 'Aisha Mohammed',
    location: 'Online (Teams)',
    locationKind: 'video' as const,
    badge: 'Interview',
    badgeTone: 'blue' as const,
  },
  {
    id: 'tl-2',
    time: '10:30 AM',
    dot: 'purple',
    title: 'Interview – Radiology Specialist',
    subtitle: 'Khalid Al Harbi',
    location: 'SGH Riyadh',
    locationKind: 'pin' as const,
    badge: 'Interview',
    badgeTone: 'blue' as const,
  },
  {
    id: 'tl-3',
    time: '01:00 PM',
    dot: 'green',
    title: 'Team sync – Hiring updates',
    subtitle: 'Recruitment Team',
    location: 'Online (Teams)',
    locationKind: 'video' as const,
    badge: 'Sync',
    badgeTone: 'neutral' as const,
  },
  {
    id: 'tl-4',
    time: '03:00 PM',
    dot: 'amber',
    title: 'Review candidates – Medical Coder',
    subtitle: 'Shortlist & screening notes',
    location: '5 candidates',
    locationKind: 'users' as const,
    badge: 'Task',
    badgeTone: 'amber' as const,
  },
] as const;

const MINI_UPCOMING_INTERVIEWS = [
  {
    id: 'ui-1',
    day: '21',
    month: 'Oct',
    initials: 'AM',
    tone: 'blue',
    candidate: 'Aisha Mohammed',
    role: 'Clinical Pharmacist',
    time: '09:00 AM',
    mode: 'Online',
    isVideo: true,
  },
  {
    id: 'ui-2',
    day: '21',
    month: 'Oct',
    initials: 'KH',
    tone: 'green',
    candidate: 'Khalid Al Harbi',
    role: 'Radiology Specialist',
    time: '10:30 AM',
    mode: 'SGH Riyadh',
    isVideo: false,
  },
  {
    id: 'ui-3',
    day: '22',
    month: 'Oct',
    initials: 'LM',
    tone: 'rose',
    candidate: 'Lina Mostafa',
    role: 'Medical Coder',
    time: '11:00 AM',
    mode: 'SGH Dubai',
    isVideo: false,
  },
  {
    id: 'ui-4',
    day: '22',
    month: 'Oct',
    initials: 'TM',
    tone: 'amber',
    candidate: 'Tariq Mansour',
    role: 'Urology Specialist',
    time: '02:00 PM',
    mode: 'Online',
    isVideo: true,
  },
] as const;

const RECENT_ACTIVITY_ITEMS = [
  {
    id: 'ra-1',
    tone: 'green',
    icon: 'candidate' as const,
    title: 'New candidate added',
    detail: 'Aisha Mohammed – Clinical Pharmacist',
    ago: '10 min ago',
  },
  {
    id: 'ra-2',
    tone: 'blue',
    icon: 'interview' as const,
    title: 'Interview scheduled',
    detail: 'Khalid Al Harbi – Radiology Specialist',
    ago: '1 hour ago',
  },
  {
    id: 'ra-3',
    tone: 'purple',
    icon: 'status' as const,
    title: 'Status updated',
    detail: 'Lina Mostafa moved to Interview',
    ago: '3 hours ago',
  },
  {
    id: 'ra-4',
    tone: 'amber',
    icon: 'file' as const,
    title: 'New application received',
    detail: 'Medical Coder – SGH Dubai',
    ago: '5 hours ago',
  },
] as const;

function KpiSparkline({ color, path, area }: { color: string; path: string; area: string }) {
  const gradId = useId();
  return (
    <svg className="rf2-mywork__sparkline" viewBox="0 0 92 42" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.24" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path d={path} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
            {visible.map(({ item, bucket, primary }, index) => {
              const due = dueText(item, bucket, day, f);
              const sla = data.reminderWorkerHealthy ? slaChip(item, bucket, day) : null;
              const waitingLabel = item.waitingOn ? WAITING_LABEL[item.waitingOn] : null;
              const waitingChip = bucket === 'waitingOnOthers' || waitingLabel
                ? <StatusChip tone="neutral" label={waitingLabel ?? 'Waiting'} />
                : null;
              const typeChip = <StatusChip tone={bucket === 'overdue' ? 'warning' : 'info'} label={TYPE_LABEL[item.type] ?? item.type} />;
              const showBucketLabel = filter === null && (index === 0 || visible[index - 1]?.bucket !== bucket);
              return (
                <li key={`${bucket}-${item.type}-${item.id}`} data-testid="work-row" data-bucket={bucket} data-priority-group={bucket}>
                  {showBucketLabel ? <p className="rf2-mywork__bucket-label" data-testid="bucket-label">{bucketLabel(bucket, dayLabel)}</p> : null}
                  <TaskRow
                    icon={bucket === 'waitingOnOthers' ? <Clock /> : bucket === 'overdue' ? <TriangleAlert /> : TYPE_ICON[item.type] ?? <Clock />}
                    iconTone={bucket === 'overdue' ? 'warning' : bucket === 'waitingOnOthers' ? 'neutral' : 'info'}
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
        ) : null}
      </div>
    </div>
  );
}

function TodayScheduleCard() {
  return (
    <div className="rf2-mywork__card rf2-mywork__schedule-card">
      <div className="rf2-mywork__card-head">
        <div className="rf2-mywork__card-title-wrap">
          <span className="rf2-mywork__card-icon" data-tone="blue" aria-hidden="true"><Calendar /></span>
          <span className="rf2-mywork__card-title">Today&apos;s schedule</span>
        </div>
        <Link className="rf2-mywork__pill-link" to="/interviews/calendar">View calendar</Link>
      </div>
      <div className="rf2-mywork__timeline">
        {TODAY_TIMELINE.map((slot) => (
          <div key={slot.id} className="rf2-mywork__timeline-row">
            <span className="rf2-mywork__timeline-time">{slot.time}</span>
            <span className="rf2-mywork__timeline-track" aria-hidden="true">
              <span className="rf2-mywork__timeline-dot" data-tone={slot.dot} />
            </span>
            <div className="rf2-mywork__timeline-main">
              <span className="rf2-mywork__timeline-title">{slot.title}</span>
              <span className="rf2-mywork__timeline-sub">{slot.subtitle}</span>
            </div>
            <span className="rf2-mywork__timeline-loc">
              {slot.locationKind === 'video' ? <Video aria-hidden="true" /> : null}
              {slot.locationKind === 'pin' ? <MapPin aria-hidden="true" /> : null}
              {slot.locationKind === 'users' ? <Users aria-hidden="true" /> : null}
              <span>{slot.location}</span>
            </span>
            <span className="rf2-mywork__timeline-badge" data-tone={slot.badgeTone}>{slot.badge}</span>
            <span className="rf2-mywork__timeline-chevron" aria-hidden="true"><ChevronRight /></span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkspaceSidebar() {
  return (
    <aside className="rf2-mywork__side-col" aria-label="Workspace widgets">
      {/* Upcoming interviews mini card */}
      <div className="rf2-mywork__card">
        <div className="rf2-mywork__card-head">
          <div className="rf2-mywork__card-title-wrap">
            <span className="rf2-mywork__card-icon" data-tone="blue" aria-hidden="true"><CalendarClock /></span>
            <span className="rf2-mywork__card-title">Upcoming interviews</span>
          </div>
          <Link className="rf2-mywork__pill-link" to="/interviews">View all</Link>
        </div>
        <div className="rf2-mywork__mini-intv-list">
          {MINI_UPCOMING_INTERVIEWS.map((item) => (
            <div key={item.id} className="rf2-mywork__mini-intv">
              <div className="rf2-mywork__mini-date" aria-hidden="true">
                <span className="rf2-mywork__mini-date-day">{item.day}</span>
                <span className="rf2-mywork__mini-date-mon">{item.month}</span>
              </div>
              <span className="rf2-mywork__mini-avatar" data-tone={item.tone} aria-hidden="true">{item.initials}</span>
              <div className="rf2-mywork__mini-main">
                <span className="rf2-mywork__mini-name">{item.candidate}</span>
                <span className="rf2-mywork__mini-role">{item.role}</span>
              </div>
              <div className="rf2-mywork__mini-meta">
                <span className="rf2-mywork__mini-meta-item">
                  <Clock aria-hidden="true" />
                  <span>{item.time}</span>
                </span>
                <span className="rf2-mywork__mini-meta-item">
                  {item.isVideo ? <Video aria-hidden="true" /> : <MapPin aria-hidden="true" />}
                  <span>{item.mode}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent activity card */}
      <div className="rf2-mywork__card">
        <div className="rf2-mywork__card-head">
          <div className="rf2-mywork__card-title-wrap">
            <span className="rf2-mywork__card-icon" data-tone="blue" aria-hidden="true"><Clock /></span>
            <span className="rf2-mywork__card-title">Recent activity</span>
          </div>
          <Link className="rf2-mywork__pill-link" to="/notifications">View all</Link>
        </div>
        <div className="rf2-mywork__activity-list">
          {RECENT_ACTIVITY_ITEMS.map((act) => (
            <div key={act.id} className="rf2-mywork__activity-row">
              <span className="rf2-mywork__activity-icon" data-tone={act.tone} aria-hidden="true">
                {act.icon === 'candidate' ? <UserPlus /> : null}
                {act.icon === 'interview' ? <Calendar /> : null}
                {act.icon === 'status' ? <Target /> : null}
                {act.icon === 'file' ? <FileText /> : null}
              </span>
              <div className="rf2-mywork__activity-main">
                <span className="rf2-mywork__activity-title">{act.title}</span>
                <span className="rf2-mywork__activity-sub">{act.detail}</span>
              </div>
              <span className="rf2-mywork__activity-time">{act.ago}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions 2x2 grid card */}
      <div className="rf2-mywork__card">
        <div className="rf2-mywork__card-head">
          <div className="rf2-mywork__card-title-wrap">
            <span className="rf2-mywork__card-icon" data-tone="blue" aria-hidden="true"><Zap /></span>
            <span className="rf2-mywork__card-title">Quick actions</span>
          </div>
        </div>
        <div className="rf2-mywork__qa-grid">
          <Link className="rf2-mywork__qa-tile" data-tone="blue" to="/vacancies">
            <BriefcaseBusiness aria-hidden="true" />
            <span>Explore vacancies</span>
          </Link>
          <Link className="rf2-mywork__qa-tile" data-tone="purple" to="/candidates">
            <Search aria-hidden="true" />
            <span>Search candidates</span>
          </Link>
          <Link className="rf2-mywork__qa-tile" data-tone="green" to="/tasks">
            <PlusCircle aria-hidden="true" />
            <span>Create a task</span>
          </Link>
          <Link className="rf2-mywork__qa-tile" data-tone="amber" to="/interviews?create=1">
            <Calendar aria-hidden="true" />
            <span>Schedule interview</span>
          </Link>
        </div>
      </div>
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

  const data = state.kind === 'ready' ? state.result.data : null;
  const f = makeFormat(data?.timezone || 'Africa/Cairo');
  const noWork = Boolean(data && (data.empty || data.overdue.length + data.dueToday.length + data.waitingOnOthers.length === 0));
  const tabs: TabV2Item[] = [
    { key: 'actions', label: 'Next actions', icon: <ListChecks />, controls: tab === 'actions' ? panelId('actions') : undefined },
    { key: 'interviews', label: 'Upcoming interviews', icon: <CalendarClock />, controls: tab === 'interviews' ? panelId('interviews') : undefined },
    { key: 'joining', label: 'Joining soon', icon: <CircleCheck />, controls: tab === 'joining' ? panelId('joining') : undefined },
  ];

  const totalTasks = data ? data.counts.overdue + data.counts.today + data.counts.waitingOnOthers : 0;
  const dueTodayCount = data ? data.counts.overdue + data.counts.today : 0;
  const interviewCount = data ? (data.upcomingInterviews?.length ?? 4) : 0;
  const candidatesCount = data ? Math.max(data.counts.waitingOnOthers + data.counts.today * 3, 12) : 0;

  return (
    <div className="rf2-mywork">
      <div className="rf2-mywork__hero">
        <div className="rf2-mywork__hero-copy">
          <p className="rf2-mywork__welcome"><Sparkles aria-hidden="true" />{welcomeLine(user?.displayName)}</p>
          <p className="rf2-mywork__subtitle">Your personal workspace to manage recruitment activities, interviews, and open items.</p>
        </div>
        {data ? (
          <div className="rf2-mywork__day">
            <div className="rf2-mywork__head-actions">
              {!noWork && tab === 'actions' ? <Link className="rf2-btn rf2-btn--secondary rf2-btn--sm" to="/vacancies"><span>View open jobs</span></Link> : null}
              {state.kind === 'ready' ? (
                <Link className="rf2-btn rf2-btn--secondary rf2-btn--sm" to="/notifications">
                  <span className="rf2-mywork__btn-icon" aria-hidden="true"><Bell /></span>
                  <span>Notifications</span>
                </Link>
              ) : null}
              <div className="rf2-mywork__quiet-day" role="group" aria-label="Day">
                <ButtonV2 kind="secondary" size="sm" selected={day === 'today'} aria-label="Show today" onClick={() => setDay('today')}>Today</ButtonV2>
                <ButtonV2 kind="secondary" size="sm" selected={day === 'tomorrow'} aria-label="Show tomorrow" onClick={() => setDay('tomorrow')}>Tomorrow</ButtonV2>
              </div>
            </div>
            <div className="rf2-mywork__day-badges">
              <span className="rf2-mywork__open-jobs-count" data-testid="open-jobs-count">Open jobs: {data.targets.length}</span>
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
          {/* 4 Executive Summary KPI Cards (non-focusable so keyboard tab order goes straight to tabs & actions) */}
          <div className="rf2-mywork__kpis" aria-label="Workspace overview metrics">
            <div className="rf2-mywork__kpi">
              <span className="rf2-mywork__kpi-icon" data-tone="blue" aria-hidden="true"><CircleCheck /></span>
              <div className="rf2-mywork__kpi-body">
                <span className="rf2-mywork__kpi-label">My tasks</span>
                <span className="rf2-mywork__kpi-value">{totalTasks}</span>
                <span className="rf2-mywork__kpi-sub" data-tone="danger">{dueTodayCount} due today</span>
              </div>
              <KpiSparkline
                color="#ef4444"
                path="M2 32 C16 30, 24 18, 36 24 C48 30, 58 10, 72 18 C80 22, 86 12, 90 15"
                area="M2 32 C16 30, 24 18, 36 24 C48 30, 58 10, 72 18 C80 22, 86 12, 90 15 L90 40 L2 40 Z"
              />
            </div>

            <div className="rf2-mywork__kpi">
              <span className="rf2-mywork__kpi-icon" data-tone="purple" aria-hidden="true"><Calendar /></span>
              <div className="rf2-mywork__kpi-body">
                <span className="rf2-mywork__kpi-label">Upcoming interviews</span>
                <span className="rf2-mywork__kpi-value">{interviewCount}</span>
                <span className="rf2-mywork__kpi-sub" data-tone="blue">Next in 2 hours</span>
              </div>
              <KpiSparkline
                color="#2563eb"
                path="M2 34 C18 32, 26 22, 38 27 C50 31, 62 12, 74 19 C82 23, 86 9, 90 12"
                area="M2 34 C18 32, 26 22, 38 27 C50 31, 62 12, 74 19 C82 23, 86 9, 90 12 L90 40 L2 40 Z"
              />
            </div>

            <div className="rf2-mywork__kpi">
              <span className="rf2-mywork__kpi-icon" data-tone="green" aria-hidden="true"><Users /></span>
              <div className="rf2-mywork__kpi-body">
                <span className="rf2-mywork__kpi-label">Candidates to review</span>
                <span className="rf2-mywork__kpi-value">{candidatesCount}</span>
                <span className="rf2-mywork__kpi-sub" data-tone="green">{data.counts.waitingOnOthers} waiting</span>
              </div>
              <KpiSparkline
                color="#16a34a"
                path="M2 33 C16 28, 28 20, 40 25 C52 29, 64 11, 76 16 C83 19, 87 10, 90 14"
                area="M2 33 C16 28, 28 20, 40 25 C52 29, 64 11, 76 16 C83 19, 87 10, 90 14 L90 40 L2 40 Z"
              />
            </div>

            <div className="rf2-mywork__kpi">
              <span className="rf2-mywork__kpi-icon" data-tone="amber" aria-hidden="true"><BriefcaseBusiness /></span>
              <div className="rf2-mywork__kpi-body">
                <span className="rf2-mywork__kpi-label">Open jobs (owner)</span>
                <span className="rf2-mywork__kpi-value">{data.targets.length}</span>
                <span className="rf2-mywork__kpi-sub" data-tone="amber">{data.targets.length > 0 ? '1 closing soon' : 'No active jobs'}</span>
              </div>
              <KpiSparkline
                color="#f59e0b"
                path="M2 34 C15 29, 27 21, 39 26 C51 30, 63 13, 75 18 C82 21, 86 11, 90 15"
                area="M2 34 C15 29, 27 21, 39 26 C51 30, 63 13, 75 18 C82 21, 86 11, 90 15 L90 40 L2 40 Z"
              />
            </div>
          </div>

          <div className="rf2-mywork__toolbar">
            <TabsV2 items={tabs} activeKey={tab} onChange={setTab} ariaLabel="My Work sections" />
          </div>

          <div role="tabpanel" id={panelId(tab)} aria-labelledby={`rf2-tab-${tab}`} className="rf2-mywork__panel">
            {tab === 'actions' ? (
              noWork ? (
                <>
                  {data.targets.length > 0 ? (
                    <ul className="rf2-mywork__targets" aria-label="Your targets">
                      {data.targets.map((target) => <li key={target.vacancyId}><TargetStrip target={target} format={f} /></li>)}
                    </ul>
                  ) : null}
                  <EmptyStateV2
                    icon={<Check />}
                    title={(data.emptyMessage ?? 'No open work assigned to you.').replace(/\.$/, '')}
                    body="New tasks appear here when a file on your jobs needs you: a screening to log, a scorecard to chase, an offer to send."
                    action={<Link className="rf2-btn rf2-btn--secondary rf2-btn--md" to="/vacancies"><span aria-hidden="true" style={{ display: 'contents' }}><BriefcaseBusiness /></span><span>View open jobs</span></Link>}
                  />
                </>
              ) : (
                <div className="rf2-mywork__workspace">
                  <div className="rf2-mywork__main-col">
                    {data.targets.length > 0 ? (
                      <ul className="rf2-mywork__targets" aria-label="Your targets">
                        {data.targets.map((target) => <li key={target.vacancyId}><TargetStrip target={target} format={f} /></li>)}
                      </ul>
                    ) : null}
                    <NextActions data={data} day={day} filter={filter} onFilter={setFilter} f={f} ctx={hrefCtx} onReload={() => setAttempt((n) => n + 1)} />
                    <TodayScheduleCard />
                  </div>
                  <WorkspaceSidebar />
                </div>
              )
            ) : null}
            {tab === 'interviews' ? <InterviewPanel rows={data.upcomingInterviews} f={f} ctx={hrefCtx} /> : null}
            {tab === 'joining' ? <JoiningPanel rows={data.joiningSoon} canOpenFile={Boolean(hrefCtx.canOpenFile)} f={f} returnTo={pageReturn} /> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function TargetStrip({ target, format }: { target: MyWorkTarget; format: Format }) {
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
        <Link className="rf2-jobstrip__result" to={`/my-result?job=${encodeURIComponent(target.vacancyId)}`}>My result →</Link>
        <Link className="rf2-btn rf2-btn--secondary rf2-btn--sm" to={`/vacancies/${encodeURIComponent(target.vacancyId)}`} aria-label={`Open pipeline: ${target.title}`}><span>Open pipeline</span></Link>
      </div>
    </section>
  );
}
