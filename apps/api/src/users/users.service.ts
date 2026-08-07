import { Injectable, NotFoundException } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { CreateUserDto, UpdateUserDto } from './users.dto';
import * as bcrypt from 'bcryptjs';
import type { UserRecord } from '@recruitflow/contracts';
import type { Prisma } from '@recruitflow/database';

type UserWithRoles = Prisma.UserGetPayload<{
  include: { userRoles: { include: { role: true } } };
}>;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async list(organizationId: string): Promise<UserRecord[]> {
    const users = await this.prisma.user.findMany({
      where: { organizationId },
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

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        emailNormalized: data.email.toLowerCase(),
        displayName: data.displayName,
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

    return this.toUserRecord(user);
  }

  async update(organizationId: string, id: string, data: UpdateUserDto): Promise<UserRecord> {
    const updateData: { displayName?: string; status?: string } = {};
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.status !== undefined) updateData.status = data.status;

    const result = await this.prisma.user.updateMany({
      where: { id, organizationId },
      data: updateData,
    });

    if (result.count !== 1) {
      throw new NotFoundException('User not found');
    }

    return this.getById(organizationId, id);
  }

  async assignRole(organizationId: string, userId: string, roleId: string): Promise<UserRecord> {
    await this.getById(organizationId, userId);

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

  private toUserRecord(user: UserWithRoles): UserRecord {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      status: user.status,
      organizationId: user.organizationId,
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
