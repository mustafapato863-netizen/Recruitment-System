import { OTHER_REASON, resolveListReason, type ReasonCategory } from '../master-data/reason-lists';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import type { Prisma } from '@recruitflow/database';

/**
 * B3 (v2 §3, §4, §10 step 2): job lifecycle.
 *
 * Final job statuses: Open, On Hold, Partially Filled, Filled, Closed.
 * "Cancelled" lives only on the requisition. "Pending Activation" is gone:
 * an approved requisition that is not yet activated has no live job.
 */
export const JOB_STATUSES = ['Open', 'On Hold', 'Partially Filled', 'Filled', 'Closed'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** Server-side transition table. Closed is terminal. */
export const JOB_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  Open: ['On Hold', 'Partially Filled', 'Filled', 'Closed'],
  'On Hold': ['Open', 'Partially Filled', 'Filled', 'Closed'],
  'Partially Filled': ['On Hold', 'Filled', 'Closed'],
  Filled: ['Closed'],
  Closed: [],
};

/** Jobs that still exist on the board (a requisition cancel closes these). */
export const LIVE_JOB_STATUSES: readonly string[] = ['Open', 'On Hold', 'Partially Filled', 'Filled'];
/** Jobs that accept new applications. A held job takes none (v2 §3 Hold). */
export const ACCEPTING_JOB_STATUSES: readonly string[] = ['Open', 'Partially Filled'];
/** Application stages that are already closed; every other stage is a live file. */
export const CLOSED_APPLICATION_STAGES: readonly string[] = ['Joined', 'Rejected', 'Withdrawn'];

export const REQUISITION_CANCELLED_REASON = 'Requisition cancelled';

export function isJobStatus(value: string): value is JobStatus {
  return (JOB_STATUSES as readonly string[]).includes(value);
}

export function canTransitionJob(from: string, to: string): boolean {
  return isJobStatus(from) && isJobStatus(to) && JOB_TRANSITIONS[from].includes(to);
}

export function assertJobTransition(from: string, to: string): void {
  if (!canTransitionJob(from, to)) {
    throw new ConflictException({
      code: 'ILLEGAL_JOB_TRANSITION',
      message: `A job cannot move from ${from} to ${to}.`,
      from,
      to,
      allowed: isJobStatus(from) ? JOB_TRANSITIONS[from] : [],
    });
  }
}

/** The seat-derived working status of a job that is not held or closed. */
export function seatStatus(joined: number, approved: number): JobStatus {
  if (approved > 0 && joined >= approved) return 'Filled';
  if (joined > 0) return 'Partially Filled';
  return 'Open';
}

export function requireReason(reason: string | null | undefined, action: string): string {
  const trimmed = reason?.trim() ?? '';
  if (trimmed.length < 3) {
    throw new BadRequestException({ code: 'REASON_REQUIRED', message: `A reason is required to ${action}.` });
  }
  return trimmed;
}

export function assertJobAcceptsApplications(vacancy: { status: string; vacancyCode?: string }): void {
  if (!ACCEPTING_JOB_STATUSES.includes(vacancy.status)) {
    throw new ConflictException({
      code: 'JOB_NOT_ACCEPTING_APPLICATIONS',
      message: `Job ${vacancy.vacancyCode ?? ''} is ${vacancy.status} and accepts no new applications.`.replace('  ', ' '),
      status: vacancy.status,
    });
  }
}

type Tx = Prisma.TransactionClient;

/** Writes a validated job status change plus its history row. No-op when unchanged. */
export async function writeJobStatus(
  tx: Tx,
  vacancy: { id: string; status: string },
  to: JobStatus,
  reason: string | null,
  actorUserId: string | null,
  extra: Prisma.VacancyUpdateInput = {},
  holdUntil: Date | null = null,
): Promise<boolean> {
  if (vacancy.status === to) {
    if (Object.keys(extra).length) await tx.vacancy.update({ where: { id: vacancy.id }, data: extra });
    return false;
  }
  assertJobTransition(vacancy.status, to);
  await tx.vacancy.update({ where: { id: vacancy.id }, data: { ...extra, status: to } });
  await tx.vacancyStatusHistory.create({
    data: { vacancyId: vacancy.id, fromStatus: vacancy.status, toStatus: to, reason, changedById: actorUserId, holdUntil },
  });
  return true;
}

/**
 * Joined fills one seat (v2 §4). Moves the job to Partially Filled / Filled.
 * A held job stays On Hold until its last seat fills.
 */
export async function recordJoin(
  tx: Tx,
  vacancy: { id: string; status: string; joinedHeadcount: number; approvedHeadcount: number },
  actorUserId: string | null,
): Promise<void> {
  const joined = vacancy.joinedHeadcount + 1;
  const next = seatStatus(joined, vacancy.approvedHeadcount);
  const target: JobStatus = vacancy.status === 'On Hold' && next !== 'Filled' ? 'On Hold' : next;
  await writeJobStatus(tx, vacancy, target, 'Seat filled (Joined)', actorUserId, { joinedHeadcount: { increment: 1 } });
}

/** Owner = active PRIMARY assignee; manager = that owner's line manager or the requisition's requester. */
export async function assertJobOwnerOrManager(
  tx: Tx,
  organizationId: string,
  vacancyId: string,
  actorUserId: string,
): Promise<void> {
  const vacancy = await tx.vacancy.findFirst({
    where: { id: vacancyId, organizationId },
    select: {
      vacancyRequest: { select: { requesterId: true, assignedEmployeeId: true } },
      assignments: {
        where: { isActive: true, assignmentKind: 'PRIMARY' },
        select: { userId: true, user: { select: { managerId: true } } },
      },
    },
  });
  if (!vacancy) return;
  // B3: an administrator never holds, reopens or closes a job, even when they
  // are also the requester. An audited Admin override with a reason is A5.
  const actorIsAdmin = await tx.userRole.count({ where: { userId: actorUserId, role: { code: 'ADMINISTRATOR' } } });
  if (actorIsAdmin > 0) {
    throw new ForbiddenException({ code: 'ADMIN_CANNOT_CHANGE_JOB_STATUS', message: 'An administrator cannot hold, reopen or close a job.' });
  }
  const owners = vacancy.assignments.map((a) => a.userId);
  const managers = vacancy.assignments.map((a) => a.user.managerId).filter((id): id is string => Boolean(id));
  if (owners.length === 0 && vacancy.vacancyRequest.assignedEmployeeId) owners.push(vacancy.vacancyRequest.assignedEmployeeId);
  // NEW-3: the owner or the owner's manager only. Being the requester, or holding VACANCY_MANAGE, is not enough.
  const allowed = new Set([...owners, ...managers]);
  if (!allowed.has(actorUserId)) {
    throw new ForbiddenException({ code: 'JOB_NOT_OWNED', message: 'Only the job owner or their manager can hold, reopen, close or delete this job.' });
  }
}

/** The assigned employee must be an active, non-administrator user in the organization. */
export async function assertEligibleAssignee(tx: Tx, organizationId: string, userId: string): Promise<void> {
  const user = await tx.user.findFirst({
    where: { id: userId, organizationId },
    select: { status: true, userRoles: { select: { role: { select: { code: true } } } } },
  });
  if (!user) throw new BadRequestException({ code: 'ASSIGNEE_NOT_ELIGIBLE', message: 'The assigned employee must be a user in this organization.' });
  if (user.status !== 'Active') throw new BadRequestException({ code: 'ASSIGNEE_NOT_ELIGIBLE', message: 'The assigned employee must be an active user.' });
  if (user.userRoles.some((ur) => ur.role.code === 'ADMINISTRATOR')) {
    throw new BadRequestException({ code: 'ASSIGNEE_NOT_ELIGIBLE', message: 'An administrator cannot be the assigned employee.' });
  }
}

/** Grade must be an active master-data value in category 'grades'. */
export async function assertGrade(tx: Tx, organizationId: string, gradeId: string): Promise<void> {
  const grade = await tx.masterDataValue.findFirst({ where: { id: gradeId, organizationId, category: 'grades', status: 'Active' }, select: { id: true } });
  if (!grade) throw new BadRequestException({ code: 'GRADE_NOT_FOUND', message: 'Grade must be an active value from master data (Grades).' });
}

/** M1: department must be an active master-data value in category 'departments'. */
export async function assertDepartment(tx: Tx, organizationId: string, departmentId: string): Promise<void> {
  const d = await tx.masterDataValue.findFirst({ where: { id: departmentId, organizationId, category: 'departments', status: 'Active' }, select: { id: true } });
  if (!d) throw new BadRequestException({ code: 'DEPARTMENT_NOT_FOUND', message: 'Department must be an active value from master data (Departments).' });
}

/** B3: categories of job status reasons. C3: all reason lists share one base (master-data/reason-lists). */
export const JOB_REASON_CATEGORIES = ['hold-reasons', 'close-reasons'] as const;
export { OTHER_REASON };

/** Kept for callers: same as resolveListReason (any reason list, incl. reassign-reasons). */
export async function resolveJobStatusReason(
  db: Pick<Prisma.TransactionClient, 'masterDataValue'>,
  organizationId: string,
  category: ReasonCategory,
  reason: string,
  note?: string | null,
): Promise<string> {
  return resolveListReason(db, organizationId, category, reason, note);
}

/** B3: optional holdUntil (YYYY-MM-DD) must be a future Cairo day. Data only: nothing auto-reopens. */
export function parseHoldUntil(raw: string | null | undefined, now: Date = new Date()): Date | null {
  if (raw === undefined || raw === null || raw === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(`${raw}T00:00:00Z`))) {
    throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'holdUntil must be YYYY-MM-DD.' });
  }
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  if (raw <= today) throw new BadRequestException({ code: 'HOLD_UNTIL_NOT_FUTURE', message: 'holdUntil must be a future date.' });
  return new Date(`${raw}T00:00:00Z`);
}
