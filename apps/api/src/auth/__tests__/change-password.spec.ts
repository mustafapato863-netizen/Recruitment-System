import { describe, expect, it, vi, beforeAll } from 'vitest';

// See users-password.spec.ts: stub the ungenerated Prisma client entry so
// the import in prisma.service.ts resolves. The service under test receives
// a mocked PrismaService; this stub is never instantiated.
vi.mock('@recruitflow/database', () => ({
  PrismaClient: class MockPrismaClient {
    async $disconnect(): Promise<void> {}
  },
}));

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../auth.service';
import type { PrismaService } from '../../database/prisma.service';
import type { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import type { RateLimiterService } from '../rate-limiter.service';
import type { EmailOutboxService } from '../../email/email-outbox.service';
import type { UserProfile } from '@recruitflow/contracts';

const ORG = 'org-1';
const USER_ID = 'user-1';
const CURRENT_PASSWORD = 'OldPass1!';
const STRONG_NEW = 'N3w!StrongPass';

let currentHash = '';

beforeAll(async () => {
  currentHash = await bcrypt.hash(CURRENT_PASSWORD, 10);
});

function profile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: USER_ID,
    email: 'a@sgh.com',
    displayName: 'User One',
    organizationId: ORG,
    organizationName: 'Org',
    roles: [],
    permissions: [],
    lastLoginAt: null,
    mustChangePassword: false,
    ...overrides,
  };
}

function createService(foundUser: Record<string, unknown> | null) {
  const findFirst = vi.fn(async () => foundUser);
  const updateMany = vi.fn(async () => ({ count: 1 }));
  const prisma = {
    user: { findFirst, updateMany },
  } as unknown as PrismaService;
  const service = new AuthService(
    prisma,
    {} as JwtService,
    {} as ConfigService,
    {} as RateLimiterService,
    {} as EmailOutboxService,
  );
  vi.spyOn(service, 'getUserProfile').mockResolvedValue(profile());
  return { service, findFirst, updateMany };
}

function foundRow(overrides: Record<string, unknown> = {}) {
  return {
    id: USER_ID,
    email: 'a@sgh.com',
    passwordHash: currentHash,
    tokenVersion: 3,
    ...overrides,
  };
}

describe('AuthService.changeOwnPassword', () => {
  it('changes to a strong password, clears the flag, bumps tokenVersion, and returns the refreshed profile', async () => {
    const { service, updateMany } = createService(foundRow());
    const result = await service.changeOwnPassword(USER_ID, ORG, {
      currentPassword: CURRENT_PASSWORD,
      newPassword: STRONG_NEW,
    });

    expect(result.user.mustChangePassword).toBe(false);
    expect(result.tokenVersion).toBe(4);
    expect(updateMany).toHaveBeenCalledOnce();
    const data = updateMany.mock.calls[0][0].data as Record<string, unknown>;
    expect(data['tokenVersion']).toEqual({ increment: 1 });
    expect(data['mustChangePassword']).toBe(false);
    expect(data['passwordChangedAt']).toBeInstanceOf(Date);
    expect(typeof data['passwordHash']).toBe('string');
    expect(data['passwordHash']).not.toBe(currentHash);
  });

  it('rejects a weak new password with WEAK_PASSWORD and updates nothing', async () => {
    const { service, updateMany } = createService(foundRow());
    const error = await service
      .changeOwnPassword(USER_ID, ORG, { currentPassword: CURRENT_PASSWORD, newPassword: 'weakpass1' })
      .catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toMatchObject({ code: 'WEAK_PASSWORD' });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('rejects reusing the current password with WEAK_PASSWORD', async () => {
    const { service, updateMany } = createService(foundRow());
    const error = await service
      .changeOwnPassword(USER_ID, ORG, { currentPassword: CURRENT_PASSWORD, newPassword: CURRENT_PASSWORD })
      .catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toMatchObject({ code: 'WEAK_PASSWORD' });
    expect((error as BadRequestException).getResponse()).toMatchObject({
      message: expect.stringContaining('different'),
    });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('rejects a wrong current password', async () => {
    const { service, updateMany } = createService(foundRow());
    const error = await service
      .changeOwnPassword(USER_ID, ORG, { currentPassword: 'WrongPass1!', newPassword: STRONG_NEW })
      .catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toMatchObject({
      message: 'Current password is incorrect',
    });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('rejects an unknown user', async () => {
    const { service, updateMany } = createService(null);
    await expect(
      service.changeOwnPassword(USER_ID, ORG, { currentPassword: CURRENT_PASSWORD, newPassword: STRONG_NEW }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(updateMany).not.toHaveBeenCalled();
  });
});
