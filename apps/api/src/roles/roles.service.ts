import { Injectable, NotFoundException } from '@nestjs/common';
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

  async list(): Promise<RoleRecord[]> {
    const roles = await this.prisma.role.findMany({
      include: {
        permissions: {
          include: { permission: true },
        },
      },
      orderBy: { code: 'asc' },
    });

    return roles.map((role) => this.toRoleRecord(role));
  }

  async getById(id: string): Promise<RoleRecord> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return this.toRoleRecord(role);
  }

  async create(data: CreateRoleDto): Promise<RoleRecord> {
    const role = await this.prisma.role.create({
      data: {
        code: data.code,
        name: data.name,
        status: 'Active',
      },
    });

    return this.getById(role.id);
  }

  async update(id: string, data: UpdateRoleDto): Promise<RoleRecord> {
    const updateData: { name?: string; status?: string } = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.status !== undefined) updateData.status = data.status;

    await this.prisma.role.update({
      where: { id },
      data: updateData,
    });

    return this.getById(id);
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

  async assignPermission(roleId: string, permissionId: string): Promise<RoleRecord> {
    await this.getById(roleId);

    await this.prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId } },
      create: { roleId, permissionId },
      update: {},
    });

    return this.getById(roleId);
  }

  async removePermission(roleId: string, permissionId: string): Promise<RoleRecord> {
    await this.getById(roleId);

    await this.prisma.rolePermission.deleteMany({
      where: { roleId, permissionId },
    });

    return this.getById(roleId);
  }

  private toRoleRecord(role: RoleWithPermissions): RoleRecord {
    return {
      id: role.id,
      code: role.code,
      name: role.name,
      status: role.status,
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
