import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type {
  CreatePermissionDto,
  CreateRoleDto,
  UpdatePermissionDto,
  UpdateRoleDto,
} from './roles.dto';
import type { RoleRecord, PermissionRecord } from '@recruitflow/contracts';
import { Prisma } from '@recruitflow/database';
import type { Prisma as PrismaTypes } from '@recruitflow/database';

type RoleWithPermissions = PrismaTypes.RoleGetPayload<{
  include: { permissions: { include: { permission: true } } };
}>;

type RoleCatalogConfig = {
  visibleRoleCodes?: string[];
  roleNameOverrides?: Record<string, string>;
};

const ROLE_SEQUENCE_KEY = 'ROLE';
const ROLE_CODE_PREFIX = 'ROLE_';
const MAX_ROLE_CODE_RETRIES = 3;

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Tenants see shared system roles plus their own custom roles. Custom roles
   * belonging to other organizations are never exposed.
   */
  async list(organizationId: string): Promise<RoleRecord[]> {
    const [roles, catalog] = await Promise.all([
      this.prisma.role.findMany({
      where: {
        OR: [{ organizationId: null }, { organizationId }],
      },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
      orderBy: { code: 'asc' },
      }),
      this.getRoleCatalogConfig(organizationId),
    ]);

    const visibleCodes = catalog.visibleRoleCodes;
    const visibleRoles = Array.isArray(visibleCodes)
      ? roles.filter((role) => visibleCodes.includes(role.code) || role.code === 'ADMINISTRATOR')
      : roles;

    return visibleRoles.map((role) => this.toRoleRecord(role, catalog.roleNameOverrides));
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

    const catalog = await this.getRoleCatalogConfig(organizationId);
    return this.toRoleRecord(role, catalog.roleNameOverrides);
  }

  async create(organizationId: string, data: CreateRoleDto): Promise<RoleRecord> {
    const name = data.name.trim();
    if (!name) throw new BadRequestException('Role name cannot be empty.');

    const role = await this.createWithGeneratedCode(organizationId, name);

    await this.addRoleToCatalog(organizationId, role.code);
    return this.getById(organizationId, role.id);
  }

  async update(organizationId: string, id: string, data: UpdateRoleDto): Promise<RoleRecord> {
    const role = await this.getMutableRole(organizationId, id);

    const updateData: { name?: string; status?: string } = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.status !== undefined) updateData.status = data.status;

    if (Object.keys(updateData).length > 0) {
      await this.prisma.role.update({
        where: { id: role.id },
        data: updateData,
      });
    }

    return this.getById(organizationId, id);
  }

  async listPermissions(organizationId: string): Promise<PermissionRecord[]> {
    const perms = await this.prisma.permission.findMany({
      where: {
        OR: [{ organizationId: null }, { organizationId }],
      },
      orderBy: { code: 'asc' },
    });

    return perms.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name?.trim() || p.code,
      description: p.description,
      scope: p.organizationId === null ? 'system' : 'organization',
    }));
  }

  async createPermission(organizationId: string, data: CreatePermissionDto): Promise<PermissionRecord> {
    const code = data.code.trim().toUpperCase();
    const existing = await this.prisma.permission.findUnique({ where: { code }, select: { id: true } });
    if (existing) {
      throw new BadRequestException('A permission with this code already exists.');
    }

    const permission = await this.prisma.permission.create({
      data: {
        code,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        organizationId,
      },
    });

    return {
      id: permission.id,
      code: permission.code,
      name: permission.name?.trim() || permission.code,
      description: permission.description,
      scope: 'organization',
    };
  }

  async updatePermission(
    organizationId: string,
    permissionId: string,
    data: UpdatePermissionDto,
  ): Promise<PermissionRecord> {
    const permission = await this.getMutablePermission(organizationId, permissionId);
    const updateData: { name?: string; description?: string | null } = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.description !== undefined) updateData.description = data.description.trim() || null;
    const updated = Object.keys(updateData).length > 0
      ? await this.prisma.permission.update({ where: { id: permission.id }, data: updateData })
      : permission;
    return {
      id: updated.id,
      code: updated.code,
      name: updated.name?.trim() || updated.code,
      description: updated.description,
      scope: 'organization',
    };
  }

  async deletePermission(organizationId: string, permissionId: string): Promise<void> {
    const permission = await this.getMutablePermission(organizationId, permissionId);
    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { permissionId: permission.id } }),
      this.prisma.permission.delete({ where: { id: permission.id } }),
    ]);
  }

  async assignPermission(organizationId: string, roleId: string, permissionId: string): Promise<RoleRecord> {
    await this.getMutableRole(organizationId, roleId);
    await this.getAssignablePermission(organizationId, permissionId);

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

  async delete(organizationId: string, roleId: string): Promise<void> {
    const role = await this.getMutableRole(organizationId, roleId);
    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { roleId: role.id } }),
      this.prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
      this.prisma.role.delete({ where: { id: role.id } }),
    ]);
    await this.removeRoleFromCatalog(organizationId, role.code);
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

  private toRoleRecord(role: RoleWithPermissions, roleNameOverrides?: Record<string, string>): RoleRecord {
    return {
      id: role.id,
      code: role.code,
      name: roleNameOverrides?.[role.code]?.trim() || role.name,
      status: role.status,
      scope: role.organizationId === null ? 'system' : 'organization',
      permissions: (role.permissions || []).map((rp) => ({
        id: rp.permission.id,
        code: rp.permission.code,
        name: rp.permission.name?.trim() || rp.permission.code,
        description: rp.permission.description,
        scope: rp.permission.organizationId === null ? 'system' : 'organization',
      })),
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
    };
  }

  private async getRoleCatalogConfig(organizationId: string): Promise<RoleCatalogConfig> {
    const integration = await this.prisma.integration.findFirst({
      where: { organizationId, name: 'ACCESS_CONTROL_CATALOG' },
      select: { configJson: true },
    });
    const config = integration?.configJson as RoleCatalogConfig | null | undefined;
    const visibleRoleCodes = Array.isArray(config?.visibleRoleCodes) ? config.visibleRoleCodes : undefined;
    return {
      ...(visibleRoleCodes ? { visibleRoleCodes } : {}),
      roleNameOverrides: config?.roleNameOverrides || {},
    };
  }

  private async updateRoleCatalog(organizationId: string, config: RoleCatalogConfig): Promise<void> {
    const existing = await this.prisma.integration.findFirst({
      where: { organizationId, name: 'ACCESS_CONTROL_CATALOG' },
      select: { id: true },
    });
    const data = {
      provider: 'INTERNAL_ACCESS_CONTROL',
      category: 'SECURITY',
      status: 'Active',
      configJson: config as unknown as PrismaTypes.InputJsonValue,
      lastSyncAt: new Date(),
    };
    if (existing) {
      await this.prisma.integration.update({ where: { id: existing.id }, data });
    } else {
      await this.prisma.integration.create({
        data: { organizationId, name: 'ACCESS_CONTROL_CATALOG', ...data },
      });
    }
  }

  private async addRoleToCatalog(organizationId: string, roleCode: string): Promise<void> {
    const config = await this.getRoleCatalogConfig(organizationId);
    const visible = config.visibleRoleCodes;
    if (visible && !visible.includes(roleCode)) {
      await this.updateRoleCatalog(organizationId, {
        ...config,
        visibleRoleCodes: [...visible, roleCode],
      });
    }
  }

  private async removeRoleFromCatalog(organizationId: string, roleCode: string): Promise<void> {
    const config = await this.getRoleCatalogConfig(organizationId);
    if (!config.visibleRoleCodes) return;
    await this.updateRoleCatalog(organizationId, {
      ...config,
      visibleRoleCodes: config.visibleRoleCodes.filter((code) => code !== roleCode),
    });
  }

  /**
   * Allocate a stable, globally unique role code and create the tenant role in
   * one serializable transaction. The sequence is initialized from legacy
   * numeric role codes so existing data is never reused.
   */
  private async createWithGeneratedCode(organizationId: string, name: string): Promise<RoleWithPermissions> {
    for (let attempt = 0; attempt < MAX_ROLE_CODE_RETRIES; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const sequence = await this.nextRoleSequence(tx);
          let sequenceValue = sequence.lastIssued;

          while (true) {
            const code = formatRoleCode(sequenceValue);
            const existing = await tx.role.findUnique({ where: { code }, select: { id: true } });
            if (!existing) {
              return tx.role.create({
                data: {
                  code,
                  name,
                  status: 'Active',
                  organizationId,
                },
                include: { permissions: { include: { permission: true } } },
              });
            }

            const next = await tx.codeSequence.update({
              where: { key: ROLE_SEQUENCE_KEY },
              data: { lastIssued: { increment: 1 } },
            });
            sequenceValue = next.lastIssued;
          }
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (!isRetryableRoleCreationConflict(error) || attempt === MAX_ROLE_CODE_RETRIES - 1) {
          throw error;
        }
      }
    }

    throw new BadRequestException('Unable to allocate a unique role code. Please try again.');
  }

  private async nextRoleSequence(tx: PrismaTypes.TransactionClient): Promise<{ lastIssued: number }> {
    const current = await tx.codeSequence.findUnique({ where: { key: ROLE_SEQUENCE_KEY } });
    if (current) {
      return tx.codeSequence.update({
        where: { key: ROLE_SEQUENCE_KEY },
        data: { lastIssued: { increment: 1 } },
      });
    }

    const highestExisting = await tx.role.findMany({
      where: { code: { startsWith: ROLE_CODE_PREFIX } },
      select: { code: true },
    });
    const highestNumber = highestExisting.reduce((max, role) => Math.max(max, parseRoleSequence(role.code)), 0);
    return tx.codeSequence.create({
      data: { key: ROLE_SEQUENCE_KEY, lastIssued: highestNumber + 1 },
    });
  }

  private async getAssignablePermission(organizationId: string, permissionId: string) {
    const permission = await this.prisma.permission.findFirst({
      where: { id: permissionId, OR: [{ organizationId: null }, { organizationId }] },
    });
    if (!permission) throw new NotFoundException('Permission not found');
    return permission;
  }

  private async getMutablePermission(organizationId: string, permissionId: string) {
    const permission = await this.prisma.permission.findFirst({ where: { id: permissionId, organizationId } });
    if (!permission) {
      const shared = await this.prisma.permission.findUnique({ where: { id: permissionId }, select: { organizationId: true } });
      if (shared && shared.organizationId === null) {
        throw new ForbiddenException('System permissions are managed by the platform and cannot be modified.');
      }
      throw new NotFoundException('Permission not found');
    }
    return permission;
  }
}

function formatRoleCode(sequence: number): string {
  return `${ROLE_CODE_PREFIX}${String(sequence).padStart(3, '0')}`;
}

function parseRoleSequence(code: string): number {
  const match = code.match(/^ROLE_(\d+)$/i);
  if (!match) return 0;
  const value = Number.parseInt(match[1] ?? '', 10);
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}

function isRetryableRoleCreationConflict(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error.code === 'P2002' || error.code === 'P2034');
}
