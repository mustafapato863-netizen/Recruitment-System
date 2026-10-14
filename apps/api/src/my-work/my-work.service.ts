import { Inject, Injectable } from '@nestjs/common';
import type { TeamWorkResponse, AuthUser } from '@recruitflow/contracts';
// Runtime service imports must remain value imports for Nest DI metadata reflection.
import { PrismaService } from '../database/prisma.service';
import type { MyWorkDay } from '@recruitflow/contracts';
import { joiningTypeForRequirement, resolveSnapshot } from '../hiring/joining-policy';
import { buildMyWork, UPCOMING_WINDOW_DAYS, type MyWorkJoiningDecisionFacts, type MyWorkJoiningInput, type MyWorkResponse } from './my-work.buckets';

/** E1: the reminder worker's heartbeat (service_heartbeats, written after each sweep). */
export const DUE_REMINDER_HEARTBEAT_SERVICE = 'due-reminders';
const DEFAULT_SWEEP_INTERVAL_MS = 5 * 60_000;

export function reminderWorkerHealthy(beat: { observedAt: Date; metadata: unknown } | null, now: Date): boolean {
  if (!beat) return false;
  const meta = (beat.metadata ?? {}) as { intervalMs?: unknown };
  const interval = typeof meta.intervalMs === 'number' && meta.intervalMs > 0 ? meta.intervalMs : DEFAULT_SWEEP_INTERVAL_MS;
  const age = now.getTime() - beat.observedAt.getTime();
  return age >= 0 && age <= 2 * interval;
}

const CLOSED_STAGES = ['Joined', 'Rejected', 'Withdrawn'];
/** Accepted, not yet a hire. Joined stays off this list so it cannot be counted again. */
const OPEN_JOINING = ['Pending Compliance', 'Pending Final Approval', 'Awaiting Joining', 'Postponed'];

type JoiningCaseRow = {
  id: string;
  status: string;
  organizationId: string;
  plannedJoiningDate: Date | null;
  applicationId: string;
  requirementSnapshot: unknown;
  approvalFingerprint: string | null;
  application: {
    stage: string;
    candidate: { id: string; firstName: string; lastName: string };
    vacancy: {
      status: string;
      vacancyCode: string;
      approvedHeadcount: number;
      joinedHeadcount: number;
      position: { title: string; metadata: unknown } | null;
    };
    joiningChecks: Array<{ type: string; verified: boolean; expiryDate: Date | null; documentId: string | null }>;
  };
  offer: { versions: Array<{ id: string; status: string; versionNumber: number }> } | null;
  complianceRequirements: Array<{ type: string; name: string; status: string; isRequired: boolean }>;
  approvals: Array<{ status: string; invalidatedAt: Date | null; roleCode: string; decisionFingerprint: string | null }>;
};

/** Null when the accepted-offer id, seat counts, or approval fingerprint were not in this query. */
function joiningDecisionFacts(row: JoiningCaseRow): MyWorkJoiningDecisionFacts | null {
  const versions = row.offer?.versions;
  const vacancy = row.application.vacancy;
  if (!Array.isArray(versions)) return null;
  if (typeof row.organizationId !== 'string' || row.organizationId.length === 0) return null;
  if (!Number.isFinite(vacancy.approvedHeadcount) || !Number.isFinite(vacancy.joinedHeadcount)) return null;
  const accepted = [...versions].sort((a, b) => b.versionNumber - a.versionNumber)[0] ?? null;
  return {
    organizationId: row.organizationId,
    snapshot: resolveSnapshot(row.requirementSnapshot, vacancy.position?.metadata),
    acceptedOfferVersionId: accepted?.id ?? null,
    hiringCaseStatus: row.status,
    approvalFingerprint: row.approvalFingerprint ?? null,
    approvals: row.approvals.map((approval) => ({
      status: approval.status,
      invalidatedAt: approval.invalidatedAt,
      roleCode: approval.roleCode,
      decisionFingerprint: approval.decisionFingerprint,
    })),
    checks: row.application.joiningChecks.map((check) => ({
      type: check.type,
      verified: check.verified === true,
      expiryDate: check.expiryDate,
      documentId: check.documentId,
    })),
    joinedHeadcount: vacancy.joinedHeadcount,
    approvedHeadcount: vacancy.approvedHeadcount,
  };
}

/** Display facts only. Does not record joining or change headcount. */
function joiningSoonFact(row: JoiningCaseRow): MyWorkJoiningInput {
  const snapshot = resolveSnapshot(row.requirementSnapshot, row.application.vacancy.position?.metadata);
  const required = snapshot.checks;
  const verified = new Map<string, boolean>();
  for (const check of row.application.joiningChecks) verified.set(check.type, check.verified === true);
  for (const req of row.complianceRequirements) {
    if (!req.isRequired) continue;
    const type = joiningTypeForRequirement(req);
    if (!type || verified.has(type)) continue;
    verified.set(type, req.status === 'Verified' || req.status === 'Not Required');
  }
  const checksComplete = required.filter((type) => verified.get(type) === true).length;
  const currentApproval = row.approvals.some((approval) =>
    approval.status === 'Approved' && !approval.invalidatedAt && (approval.roleCode || 'FINAL_HIRING_APPROVER') === 'FINAL_HIRING_APPROVER');
  const postponed = row.status === 'Postponed';
  const approvalPending = !postponed && !currentApproval && (
    row.status === 'Pending Final Approval'
    || row.status === 'Awaiting Joining'
    || checksComplete >= required.length
  );
  const name = `${row.application.candidate.firstName} ${row.application.candidate.lastName}`.trim();
  return {
    id: row.id,
    applicationId: row.applicationId,
    candidateName: name || 'Candidate',
    jobTitle: row.application.vacancy.position?.title ?? row.application.vacancy.vacancyCode,
    intendedDate: row.plannedJoiningDate,
    checksComplete,
    checksRequired: required.length,
    licenceRequired: required.includes('SCFHS_LICENCE'),
    licenceVerified: verified.get('SCFHS_LICENCE') === true,
    approvalPending,
    postponed,
    held: row.application.vacancy.status === 'On Hold',
    decisionFacts: joiningDecisionFacts(row),
  };
}
/** New sourcing and job targets. A held job is not a target. */
const WORKING_JOB = ['Open', 'Partially Filled'];
/** Interviews, offers, scorecards, and joining stay with the owner while the job is held. */
const COMMITMENT_JOB = ['Open', 'Partially Filled', 'On Hold'];

/**
 * B4: GET /me/work for the signed-in user.
 *
 * Ownership (B1 is not on this base): a job is owned via an active PRIMARY
 * VacancyAssignment; a file via Application.primaryRecruiterId / taskOwnerId,
 * or by owning its job. A requisition via requesterId.
 * TODO(B1): NOT switched here on purpose (B1/#4 is not on this base). Switch to Vacancy.primaryRecruiterId and file-access.ts
 * applicationOwnershipWhere once #4 merges; add manager "team work" there.
 */
@Injectable()
export class MyWorkService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * M2-M4: GET /team/work — the My Work buckets of each ACTIVE direct report of the caller (users.managerId),
   * merged, every item tagged with owner{id,name}. Scoped server-side to direct reports only (no admin bypass).
   * Items keep the report's own actions/reasons (they are the report's work).
   */
  async getTeamWork(user: AuthUser, now: Date = new Date(), day: MyWorkDay = 'today'): Promise<TeamWorkResponse> {
    const reports = await this.prisma.user.findMany({
      where: { organizationId: user.organizationId, managerId: user.userId, status: 'Active' },
      select: { id: true, displayName: true },
      orderBy: { displayName: 'asc' },
    });
    const per = await Promise.all(reports.map(async (r) => ({ r, w: await this.getMyWork({ ...user, userId: r.id, roleCodes: [] }, now, day) })));
    const tag = <T>(items: T[], r: { id: string; displayName: string }) => items.map((i) => ({ ...i, owner: { id: r.id, name: r.displayName } }));
    const pick = (k: 'overdue' | 'dueToday' | 'waitingOnOthers') => per.flatMap(({ r, w }) => tag(w[k], r));
    const overdue = pick('overdue'); const dueToday = pick('dueToday'); const waitingOnOthers = pick('waitingOnOthers');
    const first = per[0]?.w;
    const empty = overdue.length + dueToday.length + waitingOnOthers.length === 0;
    return {
      timezone: first?.timezone ?? 'Africa/Cairo', day, date: first?.date ?? '', generatedAt: now.toISOString(),
      people: reports.map((r) => ({ id: r.id, name: r.displayName })),
      counts: { overdue: overdue.length, today: dueToday.length, waitingOnOthers: waitingOnOthers.length },
      overdue, dueToday, waitingOnOthers,
      targets: per.flatMap(({ r, w }) => tag(w.targets, r)),
      empty, emptyMessage: empty ? (reports.length ? 'Your team has nothing due.' : 'You have no direct reports.') : null,
    };
  }

  async getMyWork(user: AuthUser, now: Date = new Date(), day: MyWorkDay = 'today'): Promise<MyWorkResponse> {
    const org = user.organizationId;
    const me = user.userId;
    const ownedJobWhere = { organizationId: org, assignments: { some: { userId: me, isActive: true, assignmentKind: 'PRIMARY' } } };
    const fileOn = (statuses: readonly string[]) => ({
      organizationId: org,
      stage: { notIn: CLOSED_STAGES },
      vacancy: { status: { in: [...statuses] } },
      OR: [{ primaryRecruiterId: me }, { taskOwnerId: me }, { vacancy: ownedJobWhere }],
    });
    const commitmentFileWhere = fileOn(COMMITMENT_JOB);

    const appSelect = { id: true, stage: true, candidate: { select: { id: true, firstName: true, lastName: true } } } as const;
    const [jobs, requisitions, tasks, interviews, offers, joiningCases, beat] = await Promise.all([
      this.prisma.vacancy.findMany({
        where: { ...ownedJobWhere, status: { in: WORKING_JOB } },
        select: {
          id: true, vacancyCode: true, status: true, joinedHeadcount: true, approvedHeadcount: true,
          position: { select: { title: true } },
          department: true,
          vacancyRequest: { select: { requestedHeadcount: true, targetFillDate: true } },
          branch: { select: { name: true } },
          assignments: { where: { isActive: true, assignmentKind: 'PRIMARY' }, select: { user: { select: { id: true, displayName: true } } }, take: 1 },
        },
      }),
      this.prisma.vacancyRequest.findMany({
        where: {
          organizationId: org,
          OR: [
            { requesterId: me, status: { in: ['Draft', 'Changes Requested', 'Pending Approval', 'Approved'] } },
            // Approved, not yet activated: also the requester's manager's work (next action Activate).
            { requester: { managerId: me }, status: 'Approved' },
            // M1: a report's Draft is also the manager's work (they may activate it once it has a due date + assignee).
            { requester: { managerId: me }, status: 'Draft' },
          ],
        },
        select: {
          id: true, requestCode: true, status: true, targetFillDate: true, requesterId: true, position: { select: { title: true } },
          requester: { select: { managerId: true } },
          assignedEmployee: { select: { status: true, userRoles: { where: { role: { code: 'ADMINISTRATOR' } }, select: { roleId: true } } } },
        },
      }),
      this.prisma.task.findMany({
        where: { organizationId: org, assigneeUserId: me, status: { in: ['Open', 'In Progress'] }, dueAt: { not: null } },
        select: { id: true, title: true, dueAt: true, entityType: true, entityId: true },
        take: 200,
      }),
      // Interviews on my files, or where I am an attendee.
      this.prisma.interview.findMany({
        where: {
          organizationId: org,
          status: { notIn: ['Cancelled'] },
          // 14 days back keeps overdue scorecards. The forward bound is the upcoming panel's 30-day window.
          scheduledStart: { gte: new Date(now.getTime() - 14 * 86_400_000), lte: new Date(now.getTime() + UPCOMING_WINDOW_DAYS * 86_400_000) },
          OR: [{ application: commitmentFileWhere }, { attendees: { some: { userId: me } } }],
        },
        select: {
          id: true, title: true, status: true, scheduledStart: true, scheduledEnd: true, applicationId: true, locationUrl: true, roomName: true, legacyInterviewerName: true,
          application: { select: { ...appSelect, primaryRecruiterId: true, taskOwnerId: true, vacancy: { select: { status: true, position: { select: { title: true } }, assignments: { where: { userId: me, isActive: true, assignmentKind: 'PRIMARY' }, select: { id: true } } } } } },
          attendees: { select: { userId: true, role: true, user: { select: { displayName: true } } } },
          scorecards: { select: { interviewerId: true, status: true } },
        },
        take: 200,
      }),
      this.prisma.offer.findMany({
        where: { organizationId: org, status: { in: ['Pending Approval', 'Sent'] }, application: commitmentFileWhere },
        select: {
          id: true, offerCode: true, status: true, applicationId: true, updatedAt: true, application: { select: appSelect },
          // C6: who the offer is waiting on (pending approvals of the latest version).
          versions: { orderBy: { versionNumber: 'desc' }, take: 1, select: { approvals: { where: { status: 'Pending' }, orderBy: { createdAt: 'asc' }, select: { approverUserId: true, roleCode: true, approver: { select: { displayName: true } } } } } },
        },
        take: 200,
      }),
      this.prisma.hiringCase.findMany({
        where: {
          organizationId: org,
          status: { in: OPEN_JOINING },
          OR: [
            { ownerUserId: me },
            { ownerUserId: null, application: { primaryRecruiterId: me } },
            { ownerUserId: null, application: { primaryRecruiterId: null, vacancy: ownedJobWhere } },
          ],
        },
        select: {
          id: true, status: true, organizationId: true, plannedJoiningDate: true, applicationId: true, requirementSnapshot: true, approvalFingerprint: true,
          offer: { select: { versions: { where: { status: 'Accepted' }, orderBy: { versionNumber: 'desc' }, take: 1, select: { id: true, status: true, versionNumber: true } } } },
          application: {
            select: {
              stage: true,
              candidate: { select: { id: true, firstName: true, lastName: true } },
              vacancy: { select: { status: true, vacancyCode: true, approvedHeadcount: true, joinedHeadcount: true, position: { select: { title: true, metadata: true } } } },
              joiningChecks: { select: { type: true, verified: true, expiryDate: true, documentId: true } },
            },
          },
          complianceRequirements: { select: { type: true, name: true, status: true, isRequired: true } },
          approvals: { select: { status: true, invalidatedAt: true, roleCode: true, decisionFingerprint: true } },
        },
        orderBy: { plannedJoiningDate: 'asc' },
        take: 100,
      }),
      this.prisma.serviceHeartbeat.findUnique({ where: { service: DUE_REMINDER_HEARTBEAT_SERVICE }, select: { observedAt: true, metadata: true } }),
    ]);
    const appInfo = (a: { id: string; stage: string; candidate: { id: string; firstName: string; lastName: string } | null }) => ({
      applicationId: a.id, stage: a.stage,
      candidate: { id: a.candidate?.id ?? '', name: a.candidate ? `${a.candidate.firstName} ${a.candidate.lastName}`.trim() : '' },
    });
    // Attendees are users; pre-B5 rows that matched no user keep a legacy free-text name.
    const interviewersOf = (i: (typeof interviews)[number]) => {
      const users = i.attendees.map((a) => ({ id: a.userId as string | null, name: a.user?.displayName ?? '' }));
      return users.length ? users : i.legacyInterviewerName?.trim() ? [{ id: null, name: i.legacyInterviewerName.trim() }] : [];
    };

    const ownsFile = (i: (typeof interviews)[number]) =>
      COMMITMENT_JOB.includes(i.application.vacancy.status) &&
      (i.application.primaryRecruiterId === me || i.application.taskOwnerId === me || i.application.vacancy.assignments.length > 0);
    const submitted = (i: (typeof interviews)[number], userId: string) => i.scorecards.some((s) => s.interviewerId === userId && s.status === 'Submitted'); // B5: a Draft is still pending

    // M1: same rules as POST /vacancy-requests/:id/activate, so the button matches the API.
    const activateBlocked = (r: (typeof requisitions)[number]): string | undefined => {
      if (r.status === 'Changes Requested') return 'Changes requested: resubmit and get it approved before activating';
      if (r.status === 'Pending Approval') return 'Waiting for approval';
      if (r.status !== 'Draft' && r.status !== 'Approved') return 'Not activatable';
      if (r.status === 'Draft' && r.requesterId !== me && r.requester?.managerId !== me) return 'Only the requester or their manager can activate';
      if (!r.targetFillDate) return 'Set a due date first';
      if (!r.assignedEmployee) return r.status === 'Draft' ? 'Assign an employee first' : undefined; // Approved: assignee may be picked at activation
      if (r.assignedEmployee.status !== 'Active' || r.assignedEmployee.userRoles.length) return 'The assigned employee is not eligible (inactive or administrator)';
      return undefined;
    };
    return buildMyWork({
      jobs: jobs.map((j) => ({
        id: j.id, code: j.vacancyCode, title: j.position?.title ?? j.vacancyCode, status: j.status, joined: j.joinedHeadcount,
        target: j.vacancyRequest?.requestedHeadcount ?? j.approvedHeadcount,
        dueDate: j.vacancyRequest?.targetFillDate ? j.vacancyRequest.targetFillDate.toISOString().slice(0, 10) : null,
        department: j.department ?? null,
        site: j.branch?.name ?? null,
        owner: j.assignments[0]?.user ? { id: j.assignments[0].user.id, name: j.assignments[0].user.displayName } : null,
      })),
      requisitions: requisitions.map((r) => ({
        id: r.id, code: r.requestCode, title: r.position?.title ?? r.requestCode, status: r.status,
        dueDate: r.targetFillDate ? r.targetFillDate.toISOString().slice(0, 10) : null,
        activateBlocked: activateBlocked(r),
      })),
      tasks,
      interviews: interviews
        .filter((i) => ownsFile(i) || i.attendees.some((a) => a.userId === me))
        .map((i) => ({
          id: i.id, title: i.title, status: i.status, start: i.scheduledStart, end: i.scheduledEnd, applicationId: i.applicationId,
          roomUrl: i.locationUrl, roomName: i.roomName,
          interviewers: interviewersOf(i), app: appInfo(i.application), iAmInterviewer: i.attendees.some((a) => a.userId === me),
          ownsFile: ownsFile(i),
          jobTitle: i.application.vacancy.position?.title ?? null,
          jobHeld: i.application.vacancy.status === 'On Hold',
        })),
      myMissingScorecards: interviews
        .filter((i) => i.attendees.some((a) => a.userId === me) && !submitted(i, me))
        .map((i) => ({ interviewId: i.id, title: i.title, end: i.scheduledEnd, app: appInfo(i.application) })),
      othersMissingScorecards: interviews.filter(ownsFile).map((i) => ({
        interviewId: i.id, title: i.title, end: i.scheduledEnd,
        missing: i.attendees.filter((a) => a.userId !== me && !submitted(i, a.userId)).length, app: appInfo(i.application),
      })),
      offers: offers.map((o) => ({
        id: o.id, code: o.offerCode, status: o.status, applicationId: o.applicationId, updatedAt: o.updatedAt, app: appInfo(o.application),
        approvers: (o.versions[0]?.approvals ?? []).map((a) => ({ id: a.approverUserId, name: a.approver?.displayName ?? a.roleCode })),
      })),
      joining: joiningCases
        .filter((row) => row.status === 'Awaiting Joining' && row.application.vacancy.status === 'On Hold')
        .map((row) => {
          const name = `${row.application.candidate.firstName} ${row.application.candidate.lastName}`.trim();
          const jobTitle = row.application.vacancy.position?.title ?? row.application.vacancy.vacancyCode;
          return {
            id: row.id,
            applicationId: row.applicationId,
            title: `${name || 'Candidate'} — awaiting joining (${jobTitle})`,
            app: appInfo({ id: row.applicationId, stage: row.application.stage, candidate: row.application.candidate }),
          };
        }),
      joiningSoon: joiningCases.map((row) => joiningSoonFact(row)),
      reminderWorkerHealthy: reminderWorkerHealthy(beat, now),
    }, now, day);
  }
}
