import {
  buildTargetChip,
  type MyWorkAction,
  type MyWorkDay,
  type MyWorkEntityType,
  type MyWorkItem,
  type MyWorkItemType,
  type MyWorkJoiningSoon,
  type MyWorkResponse,
  type MyWorkUpcomingInterview,
  type MyWorkWaitingOn,
} from '@recruitflow/contracts';
import { decideJoining, type JoiningCheckFact, type JoiningFacts, type RequirementSnapshot } from '../hiring/joining-policy';

/**
 * B4 (v2 §7 My Work): pure bucketing so it can be tested with a frozen clock.
 *
 * Defaults chosen where v2 is silent (see PR, open questions):
 * - Day boundaries are Africa/Cairo calendar days.
 * - Overdue: something the user must do whose due time is before the start of today (Cairo):
 *   open tasks, owned live jobs and owned (not yet activated) requisitions past their due date,
 *   and the user's own scorecards for interviews that ended before today.
 * - Today: the same kinds of items due today, interviews on the user's files or with the user
 *   as attendee scheduled today, the user's scorecards for interviews that ended today, and
 *   Draft requisitions without a due date (v2 §8: the task stays open until the date is set).
 * - Waiting on others: the user's requisitions in Pending Approval (approver), interviews on
 *   the user's files that ended with scorecards missing from other attendees (interviewer),
 *   offers on the user's files Pending Approval (approver) or Sent (candidate).
 * - Approved (not yet activated) requisitions are the requester's AND the requester's
 *   manager's work: Today, or Overdue past the due date, with next action Activate.
 * - Held jobs are not targets, and their plan due dates are not work items.
 *   Interviews, offers, missing scorecards, and awaiting-joining cases on a held
 *   job stay with the owner. Filled and Closed jobs stay off My Work.
 */
export const MY_WORK_TIMEZONE = 'Africa/Cairo';
/** Upcoming panel includes Cairo start dates from today through this many days. Overdue evaluations are not cut off by it. */
export const UPCOMING_WINDOW_DAYS = 30;

export type WorkItemType = MyWorkItemType;
export type WaitingOn = MyWorkWaitingOn;
export type WorkItem = MyWorkItem;
export type { MyWorkResponse };

type Person = { id: string; name: string };
type AppInfo = { applicationId: string; candidate: Person; stage: string };

/**
 * Seat counts, accepted-offer id, check expiry, and approval fingerprints.
 * Null when that query could not load them. Never includes salary.
 */
export interface MyWorkJoiningDecisionFacts {
  organizationId: string;
  snapshot: RequirementSnapshot;
  acceptedOfferVersionId: string | null;
  hiringCaseStatus: string | null;
  approvalFingerprint: string | null;
  approvals: JoiningFacts['approvals'];
  checks: JoiningCheckFact[];
  joinedHeadcount: number;
  approvedHeadcount: number;
}

/** Facts for one caller-owned accepted case. The builder never treats these as hires. */
export interface MyWorkJoiningInput {
  id: string;
  applicationId: string;
  candidateName: string;
  jobTitle: string;
  intendedDate: Date | null;
  checksComplete: number;
  checksRequired: number;
  licenceRequired: boolean;
  licenceVerified: boolean;
  approvalPending: boolean;
  postponed: boolean;
  held: boolean;
  /** Required so a missing query cannot fall through to ready. */
  decisionFacts: MyWorkJoiningDecisionFacts | null;
}

export interface MyWorkInput {
  me?: string;
  jobs: Array<{ id: string; code: string; title: string; status: string; joined: number; target: number; dueDate: string | null; department?: string | null; site?: string | null; owner?: Person | null }>;
  /** activateBlocked: why Activate is unavailable for this caller (undefined = activatable). */
  requisitions: Array<{ id: string; code: string; title: string; status: string; dueDate: string | null; activateBlocked?: string | undefined }>;
  tasks: Array<{ id: string; title: string; dueAt: Date | null; entityType: string | null; entityId: string | null }>;
  interviews: Array<{ id: string; title: string; start: Date; end: Date; applicationId: string; status?: string | null; roomUrl?: string | null; roomName?: string | null; interviewers?: Array<{ id: string | null; name: string }>; app?: AppInfo; iAmInterviewer?: boolean; ownsFile?: boolean; jobTitle?: string | null; jobHeld?: boolean }>;
  myMissingScorecards: Array<{ interviewId: string; title: string; end: Date; app?: AppInfo }>;
  othersMissingScorecards: Array<{ interviewId: string; title: string; end: Date; missing: number; app?: AppInfo }>;
  offers: Array<{ id: string; code: string; status: string; applicationId: string; updatedAt: Date; app?: AppInfo; approvers?: Array<{ id: string | null; name: string }> }>;
  /** Awaiting joining on a held job. Shown today, linked to the application. */
  joining?: Array<{ id: string; applicationId: string; title: string; app?: AppInfo }>;
  /** Accepted cases the caller owns. Not hires, and not added to target filled counts. */
  joiningSoon?: MyWorkJoiningInput[];
  reminderWorkerHealthy?: boolean;
}

const ENTITY_MAP: Record<string, MyWorkEntityType> = {
  application: 'application', interview: 'interview', offer: 'offer', requisition: 'requisition', vacancyrequest: 'requisition',
  job: 'job', vacancy: 'job', task: 'task',
};
/** E1: free-form entity types (tasks) collapse to the fixed enum; unknown -> task. */
export function toEntityType(raw: string | null | undefined): MyWorkEntityType {
  return ENTITY_MAP[(raw ?? '').replace(/[^a-z]/gi, '').toLowerCase()] ?? 'task';
}

const act = (key: string, label: string, reason?: string): MyWorkAction => (reason ? { key, label, disabled: true, reason } : { key, label, disabled: false });
const appFields = (app?: AppInfo) => (app ? { applicationId: app.applicationId, candidate: app.candidate, stage: app.stage } : {});

/** Cairo date + n days, for a YYYY-MM-DD string. */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function cairoDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: MY_WORK_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Cairo date of an instant, or of a date-only value. */
function dayOf(value: Date | string): string {
  return typeof value === 'string' ? value.slice(0, 10) : cairoDate(value);
}

const iso = (value: Date | string | null): string | null => (value == null ? null : typeof value === 'string' ? value : value.toISOString());

function upcomingFrom(input: MyWorkInput, now: Date): MyWorkUpcomingInterview[] {
  const today = cairoDate(now);
  const horizon = addDays(today, UPCOMING_WINDOW_DAYS);
  const mine = new Set(input.myMissingScorecards.map((row) => row.interviewId));
  const others = new Map(input.othersMissingScorecards.map((row) => [row.interviewId, row.missing]));
  const rows: MyWorkUpcomingInterview[] = [];
  for (const interview of input.interviews) {
    const interviewStatus = interview.status ?? null;
    // A no-show is not a scheduled commitment. Cancelled interviews stay out of this panel.
    if (interviewStatus === 'No-show' || interviewStatus === 'Cancelled') continue;
    const ended = interview.end <= now;
    const myMissing = ended && mine.has(interview.id);
    const othersMissing = ended && (others.get(interview.id) ?? 0) > 0;
    const evaluationPending = myMissing || othersMissing;
    const startDay = dayOf(interview.start);
    const openStatus = interviewStatus == null || interviewStatus === 'Scheduled' || interviewStatus === 'Rescheduled';
    // Ended earlier today, or already completed, is not "scheduled" unless a scorecard is still missing.
    const stillScheduled = !ended && openStatus && startDay >= today && startDay <= horizon;
    if (!evaluationPending && !stillScheduled) continue;
    const owns = interview.ownsFile === true;
    const assigned = interview.iAmInterviewer === true && !owns;
    // No relationship flag: do not invent a file or evaluation link.
    if (!owns && !assigned) continue;
    const people = (interview.interviewers ?? []).map((person) => ({ id: person.id, name: person.name }));
    const candidateName = interview.app?.candidate.name || null;
    const jobTitle = interview.jobTitle ?? null;
    const scorecardOverdue = evaluationPending;
    const access: MyWorkUpcomingInterview['access'] = owns ? 'file' : 'evaluation';
    let status: MyWorkUpcomingInterview['status'] = 'scheduled';
    if (scorecardOverdue) status = 'scorecard_overdue';
    else if (access === 'evaluation') status = 'assigned';
    let action: MyWorkAction;
    if (access === 'evaluation') action = act(myMissing ? 'submit-scorecard' : 'open-interview', 'Open evaluation');
    else if (myMissing) action = act('submit-scorecard', 'Submit scorecard');
    else if (othersMissing) action = act('open-interview', 'View scorecard');
    else action = act('open-interview', 'Manage interview');
    const row: MyWorkUpcomingInterview = {
      id: interview.id,
      title: candidateName && jobTitle ? `${candidateName} · ${jobTitle}` : interview.title,
      candidateName,
      jobTitle,
      startAt: interview.start.toISOString(),
      endAt: interview.end.toISOString(),
      room: { name: interview.roomName ?? null, url: interview.roomUrl ?? null },
      interviewers: people,
      access,
      held: interview.jobHeld === true,
      status,
      action,
    };
    if (owns) row.applicationId = interview.applicationId;
    rows.push(row);
  }
  rows.sort((a, b) => a.startAt.localeCompare(b.startAt) || a.title.localeCompare(b.title));
  return rows;
}

function factsAreComplete(facts: MyWorkJoiningDecisionFacts | null): facts is MyWorkJoiningDecisionFacts {
  if (!facts) return false;
  if (typeof facts.organizationId !== 'string' || facts.organizationId.length === 0) return false;
  const profile = facts.snapshot?.profile;
  if (profile !== 'technical' && profile !== 'clinical' && profile !== 'legacy') return false;
  if (!Array.isArray(facts.snapshot.checks) || facts.snapshot.checks.length === 0) return false;
  if (!Number.isFinite(facts.joinedHeadcount) || !Number.isFinite(facts.approvedHeadcount)) return false;
  if (!Array.isArray(facts.checks) || !Array.isArray(facts.approvals)) return false;
  if (facts.acceptedOfferVersionId != null && typeof facts.acceptedOfferVersionId !== 'string') return false;
  if (facts.approvalFingerprint != null && typeof facts.approvalFingerprint !== 'string') return false;
  if (facts.hiringCaseStatus != null && typeof facts.hiringCaseStatus !== 'string') return false;
  return true;
}

/** Ready only when decideJoining allows the intended date, or the builder clock when that date is unset. */
function readinessFromPolicy(row: MyWorkJoiningInput, now: Date): { readiness: MyWorkJoiningSoon['readiness']; detail: string } {
  if (!factsAreComplete(row.decisionFacts)) return { readiness: 'review', detail: 'Review readiness' };
  const facts = row.decisionFacts;
  const decision = decideJoining({
    organizationId: facts.organizationId,
    actor: null,
    enforceActor: false,
    enforceRecord: false,
    actualJoiningDate: row.intendedDate ?? now,
    caseOwnerId: null,
    primaryRecruiterId: null,
    vacancyPrimaryRecruiterId: null,
    snapshot: facts.snapshot,
    acceptedOfferVersionId: facts.acceptedOfferVersionId,
    hiringCaseStatus: facts.hiringCaseStatus,
    approvalFingerprint: facts.approvalFingerprint,
    approvals: facts.approvals,
    checks: facts.checks,
    joinedHeadcount: facts.joinedHeadcount,
    approvedHeadcount: facts.approvedHeadcount,
  });
  if (decision.ok) return { readiness: 'ready', detail: 'Ready to record joining' };
  return { readiness: 'blocked', detail: decision.message };
}

function joiningSoonFrom(input: MyWorkInput, now: Date): MyWorkJoiningSoon[] {
  const rows = (input.joiningSoon ?? []).map((row): MyWorkJoiningSoon => {
    const checksOpen = row.checksComplete < row.checksRequired;
    let readiness: MyWorkJoiningSoon['readiness'];
    let detail: string;
    if (row.postponed) {
      readiness = 'postponed';
      detail = 'Start postponed';
    } else if (row.licenceRequired && !row.licenceVerified) {
      readiness = 'licence_pending';
      detail = 'Licence review assigned';
    } else if (checksOpen) {
      readiness = 'checks_pending';
      detail = 'Checks still open';
    } else if (row.approvalPending) {
      readiness = 'approval_pending';
      detail = 'Final approval pending';
    } else {
      const judged = readinessFromPolicy(row, now);
      readiness = judged.readiness;
      detail = judged.detail;
    }
    return {
      id: row.id,
      applicationId: row.applicationId,
      candidateName: row.candidateName,
      jobTitle: row.jobTitle,
      intendedDate: row.intendedDate ? cairoDate(row.intendedDate) : null,
      checksComplete: row.checksComplete,
      checksRequired: row.checksRequired,
      readiness,
      detail,
      joined: false,
      held: row.held,
    };
  });
  rows.sort((a, b) => (a.intendedDate ?? '9999').localeCompare(b.intendedDate ?? '9999') || a.candidateName.localeCompare(b.candidateName));
  return rows;
}

export function buildMyWork(input: MyWorkInput, now: Date, day: MyWorkDay = 'today'): MyWorkResponse {
  const today = cairoDate(now);
  const focus = day === 'tomorrow' ? addDays(today, 1) : today;
  const overdue: WorkItem[] = [];
  const dueToday: WorkItem[] = [];
  const waiting: WorkItem[] = [];
  const place = (item: WorkItem, due: Date | string | null) => {
    if (due == null) return;
    const d = dayOf(due);
    if (d < today) overdue.push(item);
    else if (d === focus) dueToday.push(item);
  };

  for (const job of input.jobs) {
    if (!['Open', 'Partially Filled'].includes(job.status)) continue;
    place({
      id: job.id, type: 'job', title: `${job.title} (${job.code})`, dueAt: job.dueDate,
      reason: `${job.joined} of ${job.target} seats filled`, nextAction: { code: 'review-applicants', label: 'Review applicants' },
      entity: { type: 'job', id: job.id },
      actions: [act('review-applicants', 'Review applicants'), act('hold-job', 'Put on hold')],
    }, job.dueDate);
  }

  for (const req of input.requisitions) {
    const base = { id: req.id, type: 'requisition' as const, title: `${req.title} (${req.code})`, dueAt: req.dueDate, entity: { type: 'requisition' as const, id: req.id } };
    if (req.status === 'Pending Approval') {
      waiting.push({ ...base, reason: 'Waiting for approval', nextAction: { code: 'view-requisition', label: 'View requisition' }, waitingOn: 'approver',
        actions: [act('view-requisition', 'View requisition'), act('activate-requisition', 'Activate', 'Waiting for approval')] });
      continue;
    }
    if (!['Draft', 'Changes Requested', 'Approved'].includes(req.status)) continue;
    // M1: Approved, or a Draft that is activatable (due date + eligible assignee + requester/manager), is activated directly.
    const canActivate = (req.status === 'Approved' || req.status === 'Draft') && !req.activateBlocked;
    const action = canActivate
      ? { code: 'activate-requisition', label: 'Activate' }
      : { code: 'submit-requisition', label: 'Submit for approval' };
    const activateAct = canActivate
      ? act('activate-requisition', 'Activate')
      : act('activate-requisition', 'Activate', req.status === 'Changes Requested'
        ? 'Changes requested: resubmit and get it approved before activating'
        : req.activateBlocked ?? 'Not activatable');
    if (!req.dueDate) {
      if (req.status === 'Draft' && day === 'today') {
        dueToday.push({ ...base, reason: 'Set a due date', nextAction: { code: 'set-due-date', label: 'Set due date' },
          actions: [act('set-due-date', 'Set due date'), act('activate-requisition', 'Activate', 'Set a due date first'), act('submit-requisition', 'Submit for approval', 'Set a due date first'), act('cancel-requisition', 'Cancel')] });
      }
      continue;
    }
    place({ ...base, reason: `Requisition ${req.status}`, nextAction: action,
      actions: [activateAct, ...(req.status === 'Approved' ? [] : [act('submit-requisition', 'Submit for approval')]), act('cancel-requisition', 'Cancel')] }, req.dueDate);
  }

  for (const task of input.tasks) {
    const type = toEntityType(task.entityType);
    place({
      id: task.id, type: 'task', title: task.title, dueAt: iso(task.dueAt), reason: 'Task',
      nextAction: { code: 'complete-task', label: 'Complete task' },
      entity: task.entityId && type !== 'task' ? { type, id: task.entityId } : { type: 'task', id: task.id },
      actions: [act('complete-task', 'Complete task')],
    }, task.dueAt);
  }

  for (const interview of input.interviews) {
    if (dayOf(interview.start) !== focus) continue;
    // Explicitly neither file owner nor attendee. Older rows omit the flags and stay.
    if (interview.ownsFile === false && interview.iAmInterviewer !== true) continue;
    const people = (interview.interviewers ?? []).map((p) => ({ id: p.id, name: p.name }));
    const ended = interview.end <= now;
    dueToday.push({
      id: interview.id, type: 'interview', title: interview.title, dueAt: iso(interview.start),
      reason: day === 'tomorrow' ? 'Interview tomorrow' : 'Interview today',
      nextAction: { code: 'open-interview', label: 'Open interview' }, entity: { type: 'interview', id: interview.id },
      startAt: interview.start.toISOString(), endAt: interview.end.toISOString(),
      room: { name: interview.roomName ?? null, url: interview.roomUrl ?? null },
      interviewer: people[0] ?? null, interviewers: people,
      applicationId: interview.applicationId, ...appFields(interview.app),
      actions: [
        act('open-interview', 'Open interview'),
        act('submit-scorecard', 'Submit scorecard', interview.iAmInterviewer === false ? 'You are not an interviewer on this interview' : ended ? undefined : 'Interview has not ended'),
      ],
    });
  }

  for (const sc of input.myMissingScorecards) {
    if (sc.end > now) continue;
    place({
      id: sc.interviewId, type: 'scorecard', title: sc.title, dueAt: iso(sc.end), reason: 'Your scorecard is missing',
      nextAction: { code: 'submit-scorecard', label: 'Submit scorecard' }, entity: { type: 'interview', id: sc.interviewId },
      ...appFields(sc.app), actions: [act('submit-scorecard', 'Submit scorecard')],
    }, sc.end);
  }

  for (const sc of input.othersMissingScorecards) {
    if (sc.end > now || sc.missing <= 0) continue;
    waiting.push({
      id: sc.interviewId, type: 'scorecard', title: sc.title, dueAt: iso(sc.end), reason: `${sc.missing} scorecard(s) missing`,
      nextAction: { code: 'open-interview', label: 'Open interview' }, entity: { type: 'interview', id: sc.interviewId }, waitingOn: 'interviewer',
      ...appFields(sc.app),
      actions: [act('open-interview', 'Open interview'), act('move-to-offer', 'Move to Offer', 'Gate not met: scorecard not submitted')],
    });
  }

  for (const offer of input.offers) {
    const waitingOn: WaitingOn | null = offer.status === 'Pending Approval' ? 'approver' : offer.status === 'Sent' ? 'candidate' : null;
    if (!waitingOn) continue;
    const approvers = waitingOn === 'approver' ? offer.approvers ?? [] : [];
    waiting.push({
      id: offer.id, type: 'offer', title: `Offer ${offer.code}`, dueAt: null,
      reason: waitingOn === 'approver' ? (approvers.length ? `Offer waiting for approval from ${approvers.map((a) => a.name).join(', ')}` : 'Offer waiting for approval') : 'Offer waiting for the candidate',
      ...(waitingOn === 'approver' ? { approver: approvers[0] ?? null, approvers } : {}),
      nextAction: { code: 'open-offer', label: 'Open offer' }, entity: { type: 'offer', id: offer.id }, waitingOn,
      applicationId: offer.applicationId, ...appFields(offer.app),
      actions: [
        act('open-offer', 'Open offer'),
        waitingOn === 'approver' ? act('send-offer', 'Send offer', 'Waiting for approval') : act('record-response', 'Record response'),
      ],
    });
  }

  if (day === 'today') {
    for (const row of input.joining ?? []) {
      dueToday.push({
        id: row.applicationId, type: 'task', title: row.title, dueAt: today, reason: 'Awaiting joining',
        nextAction: { code: 'record-joining', label: 'Record joining' },
        entity: { type: 'application', id: row.applicationId },
        applicationId: row.applicationId, ...appFields(row.app),
        actions: [act('record-joining', 'Record joining')],
      });
    }
  }

  const byDue = (a: WorkItem, b: WorkItem) => (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999') || a.title.localeCompare(b.title);
  overdue.sort(byDue); dueToday.sort(byDue); waiting.sort(byDue);

  const targets = input.jobs
    .filter((job) => ['Open', 'Partially Filled'].includes(job.status))
    .map((job) => ({
      ...buildTargetChip({ title: job.title, filled: job.joined, target: job.target, dueDate: job.dueDate }),
      vacancyId: job.id, vacancyCode: job.code,
      department: job.department ?? null, site: job.site ?? null, owner: job.owner ?? null,
    }));

  // E1: targets are context, not work. No items -> empty, even with targets.
  const empty = overdue.length + dueToday.length + waiting.length === 0;
  return {
    timezone: MY_WORK_TIMEZONE,
    today,
    day,
    date: focus,
    generatedAt: now.toISOString(),
    counts: { overdue: overdue.length, today: dueToday.length, waitingOnOthers: waiting.length },
    overdue,
    dueToday,
    waitingOnOthers: waiting,
    targets,
    upcomingInterviews: upcomingFrom(input, now),
    joiningSoon: joiningSoonFrom(input, now),
    empty,
    emptyMessage: empty ? 'No open work assigned to you.' : null,
    reminderWorkerHealthy: input.reminderWorkerHealthy ?? false,
  };
}
