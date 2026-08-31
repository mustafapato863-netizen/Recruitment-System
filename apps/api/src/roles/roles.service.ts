import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { CreateRoleDto, UpdateRoleDto } from './roles.dto';
import type { RoleRecord, PermissionRecord } from '@recruitflow/contracts';
import type { Prisma } from '@recruitflow/database';

type RoleWithPermissions = Prisma.RoleGetPayload<{
  include: { permissions: { include: { permission: true } } };
}>;

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Tenants see shared system roles plus their own custom roles. Custom roles
   * belonging to other organizations are never exposed.
   */
  async list(organizationId: string): Promise<RoleRecord[]> {
    const roles = await this.prisma.role.findMany({
      where: {
        OR: [{ organizationId: null }, { organizationId }],
      },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
      orderBy: { code: 'asc' },
    });

    return roles.map((role) => this.toRoleRecord(role));
  }

  async getById(organizationId: string, id: string): Promise<RoleRecord> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });

    if (!role || !this.isVisibleToOrganization(role, organizationId)) {
      throw new NotFoundException('Role not found');
    }

    return this.toRoleRecord(role);
  }

  async create(organizationId: string, data: CreateRoleDto): Promise<RoleRecord> {
    const existing = await this.prisma.role.findUnique({ where: { code: data.code }, select: { id: true } });
    if (existing) {
      throw new BadRequestException('A role with this code already exists.');
    }

    // Custom roles are always created inside the caller's organization.
    const role = await this.prisma.role.create({
      data: {
        code: data.code,
        name: data.name,
        status: 'Active',
        organizationId,
      },
    });

    return this.getById(organizationId, role.id);
  }

  async update(organizationId: string, id: string, data: UpdateRoleDto): Promise<RoleRecord> {
    const role = await this.getMutableRole(organizationId, id);

    const updateData: { name?: string; status?: string } = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.status !== undefined) updateData.status = data.status;

    if (Object.keys(updateData).length > 0) {
      await this.prisma.role.update({
        where: { id: role.id },
        data: updateData,
      });
    }

    return this.getById(organizationId, id);
  }

  async listPermissions(): Promise<PermissionRecord[]> {
    const perms = await this.prisma.permission.findMany({
      orderBy: { code: 'asc' },
    });

    return perms.map((p) => ({
      id: p.id,
      code: p.code,
      description: p.description,
    }));
  }

  async assignPermission(organizationId: string, roleId: string, permissionId: string): Promise<RoleRecord> {
    await this.getMutableRole(organizationId, roleId);

    await this.prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId } },
      create: { roleId, permissionId },
      update: {},
    });

    return this.getById(organizationId, roleId);
  }

  async removePermission(organizationId: string, roleId: string, permissionId: string): Promise<RoleRecord> {
    await this.getMutableRole(organizationId, roleId);

    await this.prisma.rolePermission.deleteMany({
      where: { roleId, permissionId },
    });

    return this.getById(organizationId, roleId);
  }

  /** Validates that a role may be attached to a user of the given organization. */
  async assertAssignable(organizationId: string, roleId: string): Promise<void> {
    const role = await this.prisma.role.findUnique({ where: { id: roleId }, select: { organizationId: true, status: true } });
    if (!role || role.status !== 'Active' || !this.isVisibleToOrganization({ organizationId: role.organizationId } as RoleWithPermissions, organizationId)) {
      throw new NotFoundException('Role not found');
    }
  }

  private isVisibleToOrganization(role: Pick<RoleWithPermissions, 'organizationId'>, organizationId: string): boolean {
    return role.organizationId === null || role.organizationId === organizationId;
  }

  /**
   * Mutations are only allowed on tenant-local custom roles. Shared system
   * roles are part of the platform catalog and cannot be altered through the
   * tenant API.
   */
  private async getMutableRole(organizationId: string, roleId: string): Promise<RoleWithPermissions> {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: { permissions: { include: { permission: true } } },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }
    if (role.organizationId === null) {
      throw new ForbiddenException('System roles are managed by the platform and cannot be modified.');
    }
    if (role.organizationId !== organizationId) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }

  private toRoleRecord(role: RoleWithPermissions): RoleRecord {
    return {
      id: role.id,
      code: role.code,
      name: role.name,
      status: role.status,
      scope: role.organizationId === null ? 'system' : 'organization',
      permissions: (role.permissions || []).map((rp) => ({
        id: rp.permission.id,
        code: rp.permission.code,
        description: rp.permission.description,
      })),
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
    };
  }
}
