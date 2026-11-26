import { describe, expect, it, vi } from 'vitest';

vi.mock('@recruitflow/database', () => ({
  PrismaClient: class MockPrismaClient {
    async $disconnect(): Promise<void> {}
  },
}));

import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import type { PrismaService } from '../../database/prisma.service';
import type { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import type { RateLimiterService } from '../rate-limiter.service';
import type { EmailOutboxService } from '../../email/email-outbox.service';
import type { UserProfile } from '@recruitflow/contracts';
import type { Request, Response } from 'express';

const SECRET = 'test-access-secret-with-at-least-32-chars';

function sampleProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'user-1',
    email: 'recruiter@sgh.com',
    displayName: 'Sarah Ahmed',
    organizationId: 'org-1',
    organizationName: 'Saudi German Health',
    roles: [{ id: 'role-1', code: 'RECRUITER', name: 'Recruiter' }],
    permissions: ['APPLICATION_VIEW'],
    lastLoginAt: null,
    mustChangePassword: false,
    ...overrides,
  };
}

function createServiceHarness(opts: {
  verifyResult?: { sub?: string; tokenVersion?: number } | Error;
  userRow?: { id: string; status: string; tokenVersion: number } | null;
}) {
  const verifyAsync = vi.fn(async () => {
    if (opts.verifyResult instanceof Error) throw opts.verifyResult;
    return opts.verifyResult ?? {};
  });
  const findUnique = vi.fn(async () => opts.userRow ?? null);
  const prisma = { user: { findUnique } } as unknown as PrismaService;
  const jwtService = { verifyAsync } as unknown as JwtService;
  const configService = { get: vi.fn(() => SECRET) } as unknown as ConfigService;

  const service = new AuthService(
    prisma,
    jwtService,
    configService,
    {} as RateLimiterService,
    {} as EmailOutboxService,
  );
  const getUserProfileSpy = vi.spyOn(service, 'getUserProfile').mockResolvedValue(sampleProfile());

  return { service, verifyAsync, findUnique, getUserProfileSpy };
}

describe('AuthService.resolveAccessTokenSession', () => {
  it('returns null when no token is provided', async () => {
    const { service, verifyAsync } = createServiceHarness({});
    await expect(service.resolveAccessTokenSession(undefined)).resolves.toBeNull();
    expect(verifyAsync).not.toHaveBeenCalled();
  });

  it('returns null when JWT verification fails or token is expired', async () => {
    const { service, findUnique } = createServiceHarness({
      verifyResult: new Error('jwt expired'),
    });
    await expect(service.resolveAccessTokenSession('expired.token')).resolves.toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('returns null when user is inactive or tokenVersion mismatches', async () => {
    const inactive = createServiceHarness({
      verifyResult: { sub: 'user-1', tokenVersion: 2 },
      userRow: { id: 'user-1', status: 'Inactive', tokenVersion: 2 },
    });
    await expect(inactive.service.resolveAccessTokenSession('token')).resolves.toBeNull();

    const staleVersion = createServiceHarness({
      verifyResult: { sub: 'user-1', tokenVersion: 1 },
      userRow: { id: 'user-1', status: 'Active', tokenVersion: 2 },
    });
    await expect(staleVersion.service.resolveAccessTokenSession('token')).resolves.toBeNull();
  });

  it('returns the UserProfile for an active user with matching tokenVersion', async () => {
    const { service, getUserProfileSpy } = createServiceHarness({
      verifyResult: { sub: 'user-1', tokenVersion: 2 },
      userRow: { id: 'user-1', status: 'Active', tokenVersion: 2 },
    });
    const profile = await service.resolveAccessTokenSession('valid.jwt');
    expect(profile).toMatchObject({ id: 'user-1', email: 'recruiter@sgh.com' });
    expect(getUserProfileSpy).toHaveBeenCalledWith('user-1');
  });
});

describe('AuthController.getSession & rf_has_session cookie', () => {
  it('returns unauthenticated without canRefresh when no cookies are present', async () => {
    const resolveAccessTokenSession = vi.fn().mockResolvedValue(null);
    const controller = new AuthController({ resolveAccessTokenSession } as unknown as AuthService);

    const result = await controller.getSession({
      headers: {},
      cookies: {},
    } as unknown as Request);

    expect(result).toEqual({ authenticated: false, user: null, canRefresh: false });
  });

  it('reports canRefresh=true when rf_has_session cookie is present without access_token', async () => {
    const resolveAccessTokenSession = vi.fn().mockResolvedValue(null);
    const controller = new AuthController({ resolveAccessTokenSession } as unknown as AuthService);

    const result = await controller.getSession({
      headers: {},
      cookies: { rf_has_session: '1' },
    } as unknown as Request);

    expect(result).toEqual({ authenticated: false, user: null, canRefresh: true });
  });

  it('returns authenticated=true and user when access_token resolves', async () => {
    const user = sampleProfile();
    const resolveAccessTokenSession = vi.fn().mockResolvedValue(user);
    const controller = new AuthController({ resolveAccessTokenSession } as unknown as AuthService);

    const result = await controller.getSession({
      headers: {},
      cookies: { access_token: 'valid.jwt' },
    } as unknown as Request);

    expect(resolveAccessTokenSession).toHaveBeenCalledWith('valid.jwt');
    expect(result).toEqual({ authenticated: true, user, canRefresh: true });
  });

  it('sets rf_has_session on login/refresh and clears it on logout', async () => {
    const profile = sampleProfile();
    const authService = {
      login: vi.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r', user: profile }),
      rotateRefreshToken: vi.fn().mockResolvedValue(2),
      generateAccessToken: vi.fn().mockResolvedValue('a2'),
      generateRefreshToken: vi.fn().mockResolvedValue('r2'),
      logout: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuthService;

    const controller = new AuthController(authService);
    const cookie = vi.fn();
    const response = { cookie } as unknown as Response;

    await controller.login(
      { email: 'recruiter@sgh.com', password: 'Password123!' },
      response,
      { ip: '127.0.0.1' } as unknown as Request,
    );
    expect(cookie).toHaveBeenCalledWith(
      'rf_has_session',
      '1',
      expect.objectContaining({ httpOnly: true, path: '/api/v1/auth' }),
    );

    cookie.mockClear();
    await controller.refresh(
      { userId: 'user-1', organizationId: 'org-1', tokenVersion: 1, roleCodes: [] },
      response,
    );
    expect(cookie).toHaveBeenCalledWith(
      'rf_has_session',
      '1',
      expect.objectContaining({ httpOnly: true, path: '/api/v1/auth' }),
    );

    cookie.mockClear();
    await controller.logout(
      { userId: 'user-1', organizationId: 'org-1', tokenVersion: 2, roleCodes: [] },
      response,
    );
    expect(cookie).toHaveBeenCalledWith(
      'rf_has_session',
      '',
      expect.objectContaining({ httpOnly: true, path: '/api/v1/auth', maxAge: 0 }),
    );
  });
});
