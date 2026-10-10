/**
 * B1 ownership and scope (Roadmap v2 §5, §10 step 1).
 *
 * One place that decides who may open a file (application and its workflow
 * records) and who sees a job in full. Pure Prisma predicates so the
 * TenantScopedGuard, AccessControlService and services can all share it
 * without extra Nest providers.
 *
 * - Oversight = ADMINISTRATOR only (B2-8): admins keep scope-based visibility.
 *   VACANCY_MANAGE no longer grants every team's files, jobs or pay.
 * - Everyone else (Managers included) sees a file only when they own it, work it,
 *   own its job, requested its job, or the owner is in their reporting tree
 *   (direct reports, and their reports, up to MANAGER_TREE_DEPTH levels).
 * - Interviewers on a specific interview get only that candidate's CV and
 *   their own scorecard, plus RSVP and the .ics file (@AllowInterviewAttendee).
 * - Offer / final-hire approvers read only the files they are currently
 *   approving (@AllowFileApprover read routes; applicationApprovalWhere).
 */
import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@recruitflow/database';
import type { PrismaService } from '../../database/prisma.service';

export const ADMIN_ROLE_CODE = 'ADMINISTRATOR';
/** B2-8: no permission grants oversight any more (was VACANCY_MANAGE); only the Administrator role does. */
export const OVERSIGHT_PERMISSIONS: string[] = [];
/** How deep a manager's reporting tree reaches (direct reports = 1). */
export const MANAGER_TREE_DEPTH = 4;

/** Users whose manager chain (up to MANAGER_TREE_DEPTH hops) reaches `managerId`. */
export function inReportingTreeOf(managerId: string): Prisma.UserWhereInput {
  const levels: Prisma.UserWhereInput[] = [];
  let cond: Prisma.UserWhereInput = { managerId };
  for (let i = 0; i < MANAGER_TREE_DEPTH; i += 1) { levels.push(cond); cond = { manager: cond }; }
  return { OR: levels };
}

export interface AccessProfile {
  userId: string;
  organizationId: string;
  isAdmin: boolean;
  isOversight: boolean;
  /** Active role codes and permission codes (from the database, not the token). */
  roleCodes: string[];
  permissions: string[];
}

type PrismaLike = Pick<PrismaService, 'user'>;

export async function loadAccessProfile(
  prisma: PrismaLike,
  user: { userId: string; organizationId: string; roleCodes?: string[] },
): Promise<AccessProfile> {
  const record = await prisma.user.findFirst({
    where: { id: user.userId, organizationId: user.organizationId },
    select: {
      userRoles: {
        where: { role: { status: 'Active' } },
        select: { role: { select: { code: true, permissions: { select: { permission: { select: { code: true } } } } } } },
      },
    },
  });
  const roles = record?.userRoles ?? [];
  const isAdmin = roles.some((ur) => ur.role.code === ADMIN_ROLE_CODE);
  const permissions = new Set(roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.code)));
  return {
    userId: user.userId,
    organizationId: user.organizationId,
    isAdmin,
    isOversight: isAdmin || OVERSIGHT_PERMISSIONS.some((code) => permissions.has(code)),
    roleCodes: roles.map((ur) => ur.role.code),
    permissions: [...permissions],
  };
}

/** Jobs a non-oversight user sees in full. */
export function vacancyFullAccessWhere(userId: string): Prisma.VacancyWhereInput {
  return {
    OR: [
      { primaryRecruiterId: userId },
      { assignments: { some: { userId, isActive: true } } },
      { vacancyRequest: { requesterId: userId } },
      { primaryRecruiter: inReportingTreeOf(userId) },
    ],
  };
}

/** Files (applications) a non-oversight user may open. */
export function applicationOwnershipWhere(userId: string): Prisma.ApplicationWhereInput {
  return {
    OR: [
      { primaryRecruiterId: userId },
      { taskOwnerId: userId },
      { primaryRecruiter: inReportingTreeOf(userId) },
      { taskOwner: inReportingTreeOf(userId) },
      { vacancy: vacancyFullAccessWhere(userId) },
    ],
  };
}

/** Resources whose access is decided by the owning application (the "file"). */
export const FILE_RESOURCES = [
  'application',
  'interview',
  'offer',
  'offerVersion',
  'hiringCase',
  'complianceRequirement',
  'screeningLog',
] as const;
export type FileResource = (typeof FILE_RESOURCES)[number];

export function isFileResource(resource: string): resource is FileResource {
  return (FILE_RESOURCES as readonly string[]).includes(resource);
}

/** Resolve the application id behind a file resource (null when not found). */
export async function resolveFileApplicationId(
  prisma: PrismaService,
  resource: FileResource,
  id: string,
): Promise<string | null> {
  switch (resource) {
    case 'application':
      return id;
    case 'interview':
      return (await prisma.interview.findUnique({ where: { id }, select: { applicationId: true } }))?.applicationId ?? null;
    case 'offer':
      return (await prisma.offer.findUnique({ where: { id }, select: { applicationId: true } }))?.applicationId ?? null;
    case 'offerVersion':
      return (await prisma.offerVersion.findUnique({ where: { id }, select: { offer: { select: { applicationId: true } } } }))?.offer.applicationId ?? null;
    case 'hiringCase':
      return (await prisma.hiringCase.findUnique({ where: { id }, select: { applicationId: true } }))?.applicationId ?? null;
    case 'complianceRequirement':
      return (await prisma.complianceRequirement.findUnique({ where: { id }, select: { hiringCase: { select: { applicationId: true } } } }))?.hiringCase.applicationId ?? null;
    case 'screeningLog':
      return (await prisma.screeningLog.findUnique({ where: { id }, select: { applicationId: true } }))?.applicationId ?? null;
  }
}

/** True when a non-oversight user owns or works the file. */
export async function canAccessApplication(
  prisma: PrismaService,
  profile: AccessProfile,
  applicationId: string,
): Promise<boolean> {
  if (profile.isOversight) return true;
  const found = await prisma.application.findFirst({
    where: { id: applicationId, organizationId: profile.organizationId, ...applicationOwnershipWhere(profile.userId) },
    select: { id: true },
  });
  return Boolean(found);
}

/**
 * B1 follow-up (Mustafa #2): approvers read ONLY the files they are currently
 * approving. Mirrors the approval inbox / decision logic:
 * - APPROVE_OFFERS: a Pending OfferApproval on any version of an offer on the
 *   file, assigned to the user or to one of the user's role codes.
 * - FINAL_HIRING_APPROVAL: the file's hiring case is "Pending Final Approval"
 *   with a Pending HiringCaseApproval assigned to the user or to one of the
 *   user's role codes.
 * Returns null when the user holds neither approval permission.
 */
export const APPROVER_PERMISSIONS = ['APPROVE_OFFERS', 'FINAL_HIRING_APPROVAL'] as const;

export function applicationApprovalWhere(
  profile: Pick<AccessProfile, 'userId' | 'roleCodes' | 'permissions'>,
): Prisma.ApplicationWhereInput | null {
  const assignedToMe = { OR: [{ approverUserId: profile.userId }, { roleCode: { in: profile.roleCodes } }] };
  const clauses: Prisma.ApplicationWhereInput[] = [];
  if (profile.permissions.includes('APPROVE_OFFERS')) {
    clauses.push({ offers: { some: { versions: { some: { approvals: { some: { status: 'Pending', ...assignedToMe } } } } } } });
  }
  if (profile.permissions.includes('FINAL_HIRING_APPROVAL')) {
    clauses.push({
      hiringCase: {
        is: { status: 'Pending Final Approval', approvals: { some: { status: 'Pending', ...assignedToMe } } },
      },
    });
  }
  return clauses.length ? { OR: clauses } : null;
}

/** True when the user is the assigned/pending approver on an offer or hiring approval for this file. */
export async function canReadAsApprover(
  prisma: PrismaService,
  profile: AccessProfile,
  applicationId: string,
): Promise<boolean> {
  const approval = applicationApprovalWhere(profile);
  if (!approval) return false;
  const found = await prisma.application.findFirst({
    where: { id: applicationId, organizationId: profile.organizationId, ...approval },
    select: { id: true },
  });
  return Boolean(found);
}

/** True when the user is currently approving any file of this candidate (CV / documents review). */
export async function canReadCandidateAsApprover(
  prisma: PrismaService,
  profile: AccessProfile,
  candidateId: string,
): Promise<boolean> {
  const approval = applicationApprovalWhere(profile);
  if (!approval) return false;
  const found = await prisma.application.findFirst({
    where: { candidateId, organizationId: profile.organizationId, ...approval },
    select: { id: true },
  });
  return Boolean(found);
}

export async function isInterviewAttendee(prisma: PrismaService, interviewId: string, userId: string): Promise<boolean> {
  const attendee = await prisma.interviewAttendee.findUnique({
    where: { interviewId_userId: { interviewId, userId } },
    select: { id: true },
  });
  return Boolean(attendee);
}

/** Owner candidates must be Active and must not hold ADMINISTRATOR (v2 §2, B1 rule). */
export async function assertEligibleOwner(
  prisma: PrismaLike,
  organizationId: string,
  userId: string,
): Promise<void> {
  const owner = await prisma.user.findFirst({
    where: { id: userId, organizationId },
    select: { status: true, userRoles: { select: { role: { select: { code: true } } } } },
  });
  if (!owner) throw ownerNotEligible('Owner must be a user in this organization.');
  if (owner.status !== 'Active') throw ownerNotEligible('An inactive user cannot own a job or file.');
  if (owner.userRoles.some((ur) => ur.role.code === ADMIN_ROLE_CODE)) {
    throw ownerNotEligible('An administrator cannot own a job or file.');
  }
}

export function ownerNotEligible(message: string): BadRequestException {
  return new BadRequestException({ code: 'OWNER_NOT_ELIGIBLE', message });
}
