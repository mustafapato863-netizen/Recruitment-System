import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
import { RolesService } from '../roles/roles.service';
import { UserPermissionsService } from '../common/user-permissions.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { CreateUserDto, UpdateUserDto } from './users.dto';
import * as bcrypt from 'bcryptjs';
import type { UserRecord } from '@recruitflow/contracts';
import type { Prisma } from '@recruitflow/database';
import { reportIds } from './reporting-scope';

type UserWithRoles = Prisma.UserGetPayload<{
  include: { userRoles: { include: { role: true } } };
}>;

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private readonly rolesService: RolesService,
    private readonly userPermissions: UserPermissionsService,
  ) {}

  async list(organizationId: string, directory = false): Promise<UserRecord[]> {
    const users = await this.prisma.user.findMany({
      where: directory ? { organizationId } : { organizationId, status: 'Active' },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((user) => this.toUserRecord(user));
  }

  async getById(organizationId: string, id: string): Promise<UserRecord> {
    const user = await this.prisma.user.findFirst({
      where: { id, organizationId },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toUserRecord(user);
  }

  async create(organizationId: string, data: CreateUserDto): Promise<UserRecord> {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);
    const requestedRoles = Array.from(new Set((data.roles || []).map((role) => role.trim().toUpperCase()).filter(Boolean)));
    const roles = requestedRoles.length > 0
      ? await this.prisma.role.findMany({
          where: {
            code: { in: requestedRoles },
            status: 'Active',
            OR: [{ organizationId: null }, { organizationId }],
          },
          select: { id: true, code: true },
        })
      : [];
    if (roles.length !== requestedRoles.length) {
      throw new BadRequestException('One or more selected roles are unavailable for this organization.');
    }

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        emailNormalized: data.email.toLowerCase(),
        displayName: data.displayName,
        jobTitle: data.jobTitle?.trim() || null,
        passwordHash,
        organizationId,
        status: 'Active',
      },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });

    if (requestedRoles.length > 0) {
      await this.prisma.userRole.createMany({
        data: roles.map((role) => ({ userId: user.id, roleId: role.id })),
        skipDuplicates: true,
      });
    }

    return this.getById(organizationId, user.id);
  }

  async update(organizationId: string, id: string, data: UpdateUserDto): Promise<UserRecord> {
    const updateData: { displayName?: string; jobTitle?: string | null; status?: string; managerId?: string | null } = {};
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.jobTitle !== undefined) updateData.jobTitle = data.jobTitle?.trim() || null;
    if (data.status !== undefined) {
      if (data.status !== 'Active') await this.assertNoOpenOwnership(organizationId, id);
      updateData.status = data.status;
    }
    if (data.managerId !== undefined) {
      updateData.managerId = await this.resolveManagerId(organizationId, id, data.managerId);
    }

    const result = await this.prisma.user.updateMany({
      where: { id, organizationId },
      data: updateData,
    });

    if (result.count !== 1) {
      throw new NotFoundException('User not found');
    }

    return this.getById(organizationId, id);
  }

  /**
   * B2: a user who still owns open work cannot be deactivated; reassign first
   * (reassignment itself is B7). 409 with counts.
   * Open jobs count when the user is the job owner (Vacancy.primaryRecruiterId,
   * B1) or still holds an active PRIMARY assignment.
   */
  async assertNoOpenOwnership(organizationId: string, userId: string): Promise<void> {
    const counts = await countOpenOwnership(this.prisma, organizationId, userId);
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    if (total > 0) {
      throw new ConflictException({
        code: 'USER_OWNS_OPEN_WORK',
        message: 'This user still owns open work. Reassign it before deactivating the user.',
        counts,
      });
    }
  }

  async assignRole(organizationId: string, userId: string, roleId: string): Promise<UserRecord> {
    await this.getById(organizationId, userId);
    await this.rolesService.assertAssignable(organizationId, roleId);

    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      create: { userId, roleId },
      update: {},
    });

    return this.getById(organizationId, userId);
  }

  async removeRole(organizationId: string, userId: string, roleId: string): Promise<UserRecord> {
    await this.getById(organizationId, userId);

    await this.prisma.userRole.deleteMany({
      where: { userId, roleId },
    });

    return this.getById(organizationId, userId);
  }

  /**
   * People the caller may assign work to: active users who report to them,
   * including reports of their reports. The caller is not in the list.
   */
  async listAssignable(organizationId: string, userId: string): Promise<UserRecord[]> {
    const users = await this.prisma.user.findMany({
      where: { organizationId, status: 'Active' },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
      orderBy: { displayName: 'asc' },
    });
    const allowed = reportIds(users, userId);

    return users.filter((user) => allowed.has(user.id)).map((user) => this.toUserRecord(user));
  }

  /**
   * Validate a reports-to link: the manager must be an active user in the
   * same organization, must not be the user themselves, and must not create
   * a reporting cycle. Returns the normalized managerId (null clears it).
   */
  private async resolveManagerId(organizationId: string, userId: string, managerId: string | null): Promise<string | null> {
    if (managerId === null) return null;
    if (managerId === userId) {
      throw new BadRequestException('A user cannot report to themselves.');
    }
    const manager = await this.prisma.user.findFirst({
      where: { id: managerId, organizationId, status: 'Active' },
      select: { id: true, managerId: true },
    });
    if (!manager) {
      throw new BadRequestException('The selected manager is not an active user in this organization.');
    }
    // Walk up the chain to reject cycles (bounded for safety).
    let cursor: string | null = manager.managerId;
    for (let depth = 0; depth < 50 && cursor; depth += 1) {
      if (cursor === userId) {
        throw new BadRequestException('This reporting link would create a circular reporting chain.');
      }
      const next = await this.prisma.user.findFirst({
        where: { id: cursor, organizationId },
        select: { managerId: true },
      });
      cursor = next?.managerId ?? null;
    }
    return managerId;
  }

  private toUserRecord(user: UserWithRoles): UserRecord {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      jobTitle: user.jobTitle,
      status: user.status,
      organizationId: user.organizationId,
      managerId: user.managerId ?? null,
      roles: (user.userRoles || []).map((ur) => ({
        id: ur.role.id,
        code: ur.role.code,
        name: ur.role.name,
      })),
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}

/** Open-work statuses used by the B2 owner block (strings, as stored). */
export const OPEN_JOB_STATUSES = ['Pending Activation', 'Open', 'On Hold', 'Partially Filled'];
export const OPEN_REQUISITION_STATUSES = ['Draft', 'Pending Approval', 'Changes Requested', 'Approved'];
export const CLOSED_APPLICATION_STAGES = ['Joined', 'Rejected', 'Withdrawn'];

export async function countOpenOwnership(
  prisma: Pick<PrismaService, 'application' | 'vacancy' | 'vacancyRequest'>,
  organizationId: string,
  userId: string,
): Promise<{ openApplicationsPrimary: number; openApplicationsTaskOwner: number; openJobsPrimary: number; openRequisitions: number }> {
  const openApplication = { organizationId, stage: { notIn: CLOSED_APPLICATION_STAGES } };
  const [openApplicationsPrimary, openApplicationsTaskOwner, openJobsPrimary, openRequisitions] = await Promise.all([
    prisma.application.count({ where: { ...openApplication, primaryRecruiterId: userId } }),
    prisma.application.count({ where: { ...openApplication, taskOwnerId: userId } }),
    // Distinct open jobs the user owns (B1 column) or is still PRIMARY on.
    prisma.vacancy.count({
      where: {
        organizationId,
        status: { in: OPEN_JOB_STATUSES },
        OR: [
          { primaryRecruiterId: userId },
          { assignments: { some: { userId, isActive: true, assignmentKind: 'PRIMARY' } } },
        ],
      },
    }),
    prisma.vacancyRequest.count({ where: { organizationId, requesterId: userId, status: { in: OPEN_REQUISITION_STATUSES } } }),
  ]);
  return { openApplicationsPrimary, openApplicationsTaskOwner, openJobsPrimary, openRequisitions };
}
