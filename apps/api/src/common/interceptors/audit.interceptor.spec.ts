import { describe, expect, it, vi } from 'vitest';
import { of, throwError, lastValueFrom } from 'rxjs';
import type { Reflector } from '@nestjs/core';
import { AuditInterceptor, auditBodyReason, auditEntityFor } from './audit.interceptor';

// B2F-7: hold/close audit rows carry the job id and the reason.
describe('AuditInterceptor entity + reason (B2F-7)', () => {
  const meta = { resource: 'vacancy', param: 'id' };
  it('maps @TenantResource to entityType/entityId and the body reason (Other + note)', () => {
    expect(auditEntityFor(meta, { params: { id: 'job-1' } })).toEqual({ entityType: 'Vacancy', entityId: 'job-1' });
    expect(auditEntityFor(undefined, { params: { id: 'x' } })).toEqual({ entityType: 'system', entityId: 'none' });
    expect(auditBodyReason({ reason: 'Filled internally' })).toBe('Filled internally');
    expect(auditBodyReason({ reason: 'Other', note: 'Budget cut' })).toBe('Other: Budget cut');
    expect(auditBodyReason({})).toBeNull();
  });

  it('writes Vacancy/<id> with the reason on success, and Vacancy/<id> on a denied attempt', async () => {
    const create = vi.fn().mockReturnValue({ catch: () => undefined });
    const reflector = { get: vi.fn((key: string) => (key === 'TENANT_RESOURCE' ? meta : 'VACANCY_CLOSE')) } as unknown as Reflector;
    const icpt = new AuditInterceptor(reflector, { auditLog: { create } } as never);
    const ctx = { getHandler: () => undefined, switchToHttp: () => ({ getRequest: () => ({ user: { userId: 'u', organizationId: 'o' }, params: { id: 'job-1' }, body: { reason: 'Filled internally' } }) }) } as never;
    await lastValueFrom(icpt.intercept(ctx, { handle: () => of({}) }));
    expect(create.mock.calls[0][0].data).toMatchObject({ action: 'VACANCY_CLOSE', entityType: 'Vacancy', entityId: 'job-1', result: 'SUCCESS', reason: 'Filled internally' });
    await lastValueFrom(icpt.intercept(ctx, { handle: () => throwError(() => new Error('nope')) })).catch(() => undefined);
    expect(create.mock.calls[1][0].data).toMatchObject({ entityType: 'Vacancy', entityId: 'job-1', result: 'FAILURE' });
  });
});
