/**
 * B1 ownership and scope (Roadmap v2 §5, §10 step 1).
 *
 * One place that decides who may open a file (application and its workflow
 * records) and who sees a job in full. Pure Prisma predicates so the
 * TenantScopedGuard, AccessControlService and services can all share it
 * without extra Nest providers.
 *
 * - Oversight users (ADMINISTRATOR or VACANCY_MANAGE holders) keep their
 *   existing scope-based visibility; B0b will narrow this once seats exist.
 * - Everyone else sees a file only when they own it, work it, own its job,
 *   requested its job, or manage (directly) its owner.
 * - Interviewers on a specific interview get only that candidate's CV and
 *   their own scorecard (see INTERVIEWER_ATTENDEE_ACCESS routes).
 */
import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@recruitflow/database';
import type { PrismaService } from '../../database/prisma.service';

export const ADMIN_ROLE_CODE = 'ADMINISTRATOR';
/** Permissions that grant oversight (full, scope-based) access to files and jobs. */
export const OVERSIGHT_PERMISSIONS = ['VACANCY_MANAGE'];

export interface AccessProfile {
  userId: string;
  organizationId: string;
  isAdmin: boolean;
  isOversight: boolean;
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
  };
}

/** Jobs a non-oversight user sees in full. */
export function vacancyFullAccessWhere(userId: string): Prisma.VacancyWhereInput {
  return {
    OR: [
      { primaryRecruiterId: userId },
      { assignments: { some: { userId, isActive: true } } },
      { vacancyRequest: { requesterId: userId } },
      { primaryRecruiter: { managerId: userId } },
    ],
  };
}

/** Files (applications) a non-oversight user may open. */
export function applicationOwnershipWhere(userId: string): Prisma.ApplicationWhereInput {
  return {
    OR: [
      { primaryRecruiterId: userId },
      { taskOwnerId: userId },
      { primaryRecruiter: { managerId: userId } },
      { taskOwner: { managerId: userId } },
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
