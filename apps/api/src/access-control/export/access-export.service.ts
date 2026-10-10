import { Injectable } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../../database/prisma.service';
import { AccessControlService } from '../access-control.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import {
  buildAccessExport,
  type AccessExport,
  type ExportOwnershipCounts,
  type ExportRoleInput,
  type ExportUserInput,
} from './access-export.builder';

// Same open-work definitions as B2's owner block (users.service countOpenOwnership): one rule, not two.
import { CLOSED_APPLICATION_STAGES, OPEN_JOB_STATUSES, OPEN_REQUISITION_STATUSES } from '../../users/users.service';
export { CLOSED_APPLICATION_STAGES, OPEN_JOB_STATUSES, OPEN_REQUISITION_STATUSES };

type CountRow = { key: string | null; count: number };

@Injectable()
export class AccessExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
  ) {}

  /** Export roles, users and grants for one organization (admin only; see controller). */
  async exportForOrganization(organizationId: string): Promise<AccessExport> {
    const [roles, users] = await Promise.all([
      this.prisma.role.findMany({
        where: { OR: [{ organizationId: null }, { organizationId }] },
        select: {
          id: true,
          code: true,
          name: true,
          status: true,
          organizationId: true,
          permissions: { select: { permission: { select: { code: true } } } },
        },
        orderBy: { code: 'asc' },
      }),
      // Explicit field selection: never passwordHash, tokenVersion or auth tokens.
      this.prisma.user.findMany({
        where: { organizationId },
        select: {
          id: true,
          organizationId: true,
          displayName: true,
          email: true,
          status: true,
          jobTitle: true,
          managerId: true,
          userRoles: { select: { role: { select: { code: true } } } },
        },
        orderBy: { displayName: 'asc' },
      }),
    ]);

    const ownership = await this.ownershipCounts(organizationId);

    const userInputs: ExportUserInput[] = [];
    for (const user of users) {
      const roleCodes = user.userRoles.map((userRole) => userRole.role.code);
      const { scopes, responsibility } = await this.accessControl.resolveDataScopesForUser(organizationId, user.id, roleCodes);
      userInputs.push({
        id: user.id,
        organizationId: user.organizationId,
        displayName: user.displayName,
        email: user.email,
        status: user.status,
        jobTitle: user.jobTitle,
        managerId: user.managerId,
        roleCodes,
        dataScopes: scopes,
        branches: responsibility?.branches ?? [],
        departments: responsibility?.departments ?? [],
        ownership: ownership(user.id),
      });
    }

    const roleInputs: ExportRoleInput[] = roles.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      status: role.status,
      organizationId: role.organizationId,
      permissionCodes: role.permissions.map((link) => link.permission.code),
    }));

    return buildAccessExport({ roles: roleInputs, users: userInputs, source: 'api' });
  }

  private async ownershipCounts(organizationId: string): Promise<(userId: string) => ExportOwnershipCounts> {
    const [openJobs, requisitions, primaryApps, taskApps] = await Promise.all([
      // B1: the job owner is Vacancy.primaryRecruiterId; an active PRIMARY assignment still counts (as in B2's owner block).
      // Inactive (revoked) assignments and closed jobs never count.
      this.prisma.vacancy.findMany({
        where: { organizationId, status: { in: OPEN_JOB_STATUSES } },
        select: { primaryRecruiterId: true, assignments: { where: { isActive: true }, select: { userId: true, assignmentKind: true } } },
      }),
      this.prisma.vacancyRequest.groupBy({
        by: ['requesterId'],
        where: { organizationId, status: { in: OPEN_REQUISITION_STATUSES } },
        _count: { _all: true },
      }),
      this.prisma.application.groupBy({
        by: ['primaryRecruiterId'],
        where: { organizationId, stage: { notIn: CLOSED_APPLICATION_STAGES }, primaryRecruiterId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.application.groupBy({
        by: ['taskOwnerId'],
        where: { organizationId, stage: { notIn: CLOSED_APPLICATION_STAGES }, taskOwnerId: { not: null } },
        _count: { _all: true },
      }),
    ]);

    const toMap = (rows: CountRow[]) => new Map(rows.map((row) => [row.key, row.count]));
    const primaryJobs = new Map<string, number>();
    const supportJobs = new Map<string, number>();
    const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
    for (const job of openJobs) {
      const owners = new Set<string>(job.primaryRecruiterId ? [job.primaryRecruiterId] : []);
      for (const a of job.assignments) if (a.assignmentKind === 'PRIMARY') owners.add(a.userId);
      owners.forEach((id) => bump(primaryJobs, id)); // distinct jobs per owner
      for (const id of new Set(job.assignments.filter((a) => a.assignmentKind !== 'PRIMARY' && !owners.has(a.userId)).map((a) => a.userId))) bump(supportJobs, id);
    }
    const reqs = toMap(requisitions.map((r) => ({ key: r.requesterId, count: r._count._all })));
    const primary = toMap(primaryApps.map((r) => ({ key: r.primaryRecruiterId, count: r._count._all })));
    const task = toMap(taskApps.map((r) => ({ key: r.taskOwnerId, count: r._count._all })));

    return (userId: string) => ({
      openJobsPrimary: primaryJobs.get(userId) ?? 0,
      openJobsSupport: supportJobs.get(userId) ?? 0,
      openRequisitions: reqs.get(userId) ?? 0,
      openApplicationsPrimary: primary.get(userId) ?? 0,
      openApplicationsTaskOwner: task.get(userId) ?? 0,
    });
  }
}
