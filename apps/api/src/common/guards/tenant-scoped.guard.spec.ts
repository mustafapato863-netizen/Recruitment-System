import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { TenantScopedGuard } from './tenant-scoped.guard';

const TENANT = '10000000-0000-4000-8000-000000000001';
const OTHER = '20000000-0000-4000-8000-000000000002';
const CANDIDATE = '30000000-0000-4000-8000-000000000003';

function context(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => function tenantHandler() {},
  } as unknown as ExecutionContext;
}

function guardFor(
  meta: { resource: string; param: string } | undefined,
  prisma: object,
) {
  const reflector = {
    get: vi.fn().mockReturnValue(meta),
  } as unknown as Reflector;
  return new TenantScopedGuard(reflector, prisma as never);
}

describe('TenantScopedGuard UUID validation', () => {
  it('rejects a malformed candidate id before reading the database', async () => {
    const findUnique = vi.fn();
    const guard = guardFor(
      { resource: 'candidate', param: 'id' },
      { candidate: { findUnique } },
    );

    const error = await guard.canActivate(context({
      tenantId: TENANT,
      params: { id: 'not-a-uuid' },
    })).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getStatus()).toBe(400);
    expect((error as BadRequestException).getResponse()).toMatchObject({
      code: 'VALIDATION_ERROR',
      fields: { id: ['A valid identifier is required.'] },
    });
    expect(JSON.stringify((error as BadRequestException).getResponse())).not.toMatch(/prisma|sql|select |candidates/i);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('rejects a nested malformed id even when the parent id is well formed', async () => {
    const findUnique = vi.fn();
    const guard = guardFor(
      { resource: 'candidateImportJob', param: 'jobId' },
      { candidateImportJob: { findUnique } },
    );

    const error = await guard.canActivate(context({
      tenantId: TENANT,
      params: {
        jobId: CANDIDATE,
        rowId: 'not-a-uuid',
      },
    })).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toMatchObject({
      fields: { rowId: ['A valid identifier is required.'] },
    });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('does not echo SQL-shaped identifiers', async () => {
    const findUnique = vi.fn();
    const guard = guardFor(
      { resource: 'application', param: 'id' },
      { application: { findUnique } },
    );
    const malicious = "'; DROP TABLE applications;--";

    const error = await guard.canActivate(context({
      tenantId: TENANT,
      params: { id: malicious },
    })).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(BadRequestException);
    expect(JSON.stringify((error as BadRequestException).getResponse())).not.toContain(malicious);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('returns 404 for a valid UUID outside the tenant without leaking the row', async () => {
    const findUnique = vi.fn().mockResolvedValue({ organizationId: OTHER });
    const guard = guardFor(
      { resource: 'vacancyRequest', param: 'id' },
      { vacancyRequest: { findUnique } },
    );

    const error = await guard.canActivate(context({
      tenantId: TENANT,
      params: { id: CANDIDATE },
    })).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(NotFoundException);
    expect(findUnique).toHaveBeenCalledWith({ where: { id: CANDIDATE } });
  });

  it('allows a UUID that belongs to the caller tenant', async () => {
    const findUnique = vi.fn().mockResolvedValue({ organizationId: TENANT });
    const guard = guardFor(
      { resource: 'candidate', param: 'id' },
      { candidate: { findUnique } },
    );

    await expect(guard.canActivate(context({
      tenantId: TENANT,
      params: { id: CANDIDATE },
    }))).resolves.toBe(true);
  });

  it('rejects a missing tenant before any lookup', async () => {
    const findUnique = vi.fn();
    const guard = guardFor(
      { resource: 'candidate', param: 'id' },
      { candidate: { findUnique } },
    );

    const error = await guard.canActivate(context({
      params: { id: CANDIDATE },
    })).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ForbiddenException);
    expect(findUnique).not.toHaveBeenCalled();
  });
});
