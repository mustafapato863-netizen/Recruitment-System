import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { isPasswordChangeAllowedRequest, JwtAuthGuard } from './jwt-auth.guard';

// Passport authentication is stubbed out: the real JwtStrategy needs a
// database and keys. The guard under test only adds the tenant context and
// the forced-password-change check on top of it.
vi.mock('@nestjs/passport', () => ({
  AuthGuard: () => class MockAuthGuard {
    async canActivate(): Promise<boolean> {
      return true;
    }
  },
}));

function context(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => function handler() {},
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function guard(isPublic: boolean) {
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(isPublic),
  } as unknown as Reflector;
  return new JwtAuthGuard(reflector);
}

function requestWithFlag(method: string, path: string) {
  return {
    method,
    path,
    user: { userId: 'user-1', organizationId: 'org-1', tokenVersion: 1, roleCodes: [], mustChangePassword: true },
  };
}

describe('isPasswordChangeAllowedRequest', () => {
  it.each([
    ['GET', '/api/v1/auth/me', true],
    ['POST', '/api/v1/auth/logout', true],
    ['POST', '/api/v1/auth/refresh', true],
    ['GET', '/api/v1/me/profile', true],
    ['POST', '/api/v1/me/password', true],
    // Unprefixed paths work too.
    ['POST', '/me/password', true],
    ['GET', '/me/profile', true],
    // Everything else is blocked while the flag is set.
    ['GET', '/api/v1/users', false],
    ['GET', '/api/v1/me/preferences', false],
    ['PATCH', '/api/v1/me/profile', false],
    ['POST', '/api/v1/users', false],
    ['GET', '/api/v1/auth/me/', true],
  ])('%s %s -> %s', (method, path, expected) => {
    expect(isPasswordChangeAllowedRequest(method, path)).toBe(expected);
  });
});

describe('JwtAuthGuard forced password change', () => {
  it('lets a user without the flag through and attaches the tenant context', async () => {
    const request: Record<string, unknown> = {
      method: 'GET',
      path: '/api/v1/users',
      user: { userId: 'user-1', organizationId: 'org-1', tokenVersion: 1, roleCodes: [] },
    };
    await expect(guard(false).canActivate(context(request))).resolves.toBe(true);
    expect(request['tenantId']).toBe('org-1');
  });

  it('blocks a non-allow-listed route with 403 PASSWORD_CHANGE_REQUIRED', async () => {
    const error = await guard(false)
      .canActivate(context(requestWithFlag('GET', '/api/v1/users')))
      .catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getStatus()).toBe(403);
    expect((error as ForbiddenException).getResponse()).toMatchObject({ code: 'PASSWORD_CHANGE_REQUIRED' });
  });

  it('allows the change-password endpoint itself', async () => {
    await expect(
      guard(false).canActivate(context(requestWithFlag('POST', '/api/v1/me/password'))),
    ).resolves.toBe(true);
  });

  it('allows the profile read, logout, and auth/me while the flag is set', async () => {
    for (const [method, path] of [
      ['GET', '/api/v1/me/profile'],
      ['GET', '/api/v1/auth/me'],
      ['POST', '/api/v1/auth/logout'],
    ] as const) {
      await expect(guard(false).canActivate(context(requestWithFlag(method, path)))).resolves.toBe(true);
    }
  });

  it('blocks profile edits while the flag is set', async () => {
    const error = await guard(false)
      .canActivate(context(requestWithFlag('PATCH', '/api/v1/me/profile')))
      .catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toMatchObject({ code: 'PASSWORD_CHANGE_REQUIRED' });
  });

  it('lets public routes through without checking the flag', async () => {
    await expect(
      guard(true).canActivate(context(requestWithFlag('POST', '/api/v1/auth/login'))),
    ).resolves.toBe(true);
  });
});
