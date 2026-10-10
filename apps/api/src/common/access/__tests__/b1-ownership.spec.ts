import { createRequire } from 'node:module';
import path from 'node:path';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { assertEligibleOwner } from '../file-access';
import { TenantScopedGuard } from '../../guards/tenant-scoped.guard';
import { ALLOW_INTERVIEW_ATTENDEE } from '../../decorators/tenant-resource.decorator';
import { redactVacancy } from '../../../vacancy-core/vacancy-core.service';

const ORG = '10000000-0000-4000-8000-000000000001';
const APP = '30000000-0000-4000-8000-000000000003';
const INTERVIEW = '40000000-0000-4000-8000-000000000004';
const USER = '50000000-0000-4000-8000-000000000005';

const userRecord = (codes: string[], perms: string[] = [], status = 'Active') => ({
  status,
  userRoles: codes.map((code) => ({ role: { code, permissions: perms.map((p) => ({ permission: { code: p } })) } })),
});

function makeGuard(opts: { resource: string; allowAttendee?: boolean; owns: boolean; attendee?: boolean; roles?: string[]; perms?: string[] }) {
  const prisma = {
    [opts.resource]: { findUnique: vi.fn().mockResolvedValue({ organizationId: ORG, applicationId: APP }) },
    application: { findUnique: vi.fn().mockResolvedValue({ organizationId: ORG }), findFirst: vi.fn().mockResolvedValue(opts.owns ? { id: APP } : null) },
    user: { findFirst: vi.fn().mockResolvedValue(userRecord(opts.roles ?? ['RECRUITER'], opts.perms ?? ['VACANCY_VIEW'])) },
    interviewAttendee: { findUnique: vi.fn().mockResolvedValue(opts.attendee ? { id: 'a' } : null) },
  };
  const reflector = {
    get: vi.fn((key: string) => key === ALLOW_INTERVIEW_ATTENDEE ? Boolean(opts.allowAttendee) : { resource: opts.resource, param: 'id' }),
  } as unknown as Reflector;
  const guard = new TenantScopedGuard(reflector, prisma as never);
  const id = opts.resource === 'interview' ? INTERVIEW : APP;
  const ctx = {
    switchToHttp: () => ({ getRequest: () => ({ tenantId: ORG, user: { userId: USER, organizationId: ORG }, params: { id } }) }),
    getHandler: () => function route() {},
  } as unknown as ExecutionContext;
  return () => guard.canActivate(ctx);
}

describe('B1 file ownership guard', () => {
  it("returns 403 FILE_NOT_OWNED for another owner's application", async () => {
    await expect(makeGuard({ resource: 'application', owns: false })()).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('lets the owner through', async () => {
    await expect(makeGuard({ resource: 'application', owns: true })()).resolves.toBe(true);
  });
  it('lets oversight (VACANCY_MANAGE) and administrators through', async () => {
    await expect(makeGuard({ resource: 'application', owns: false, perms: ['VACANCY_MANAGE'] })()).resolves.toBe(true);
    await expect(makeGuard({ resource: 'application', owns: false, roles: ['ADMINISTRATOR'], perms: [] })()).resolves.toBe(true);
  });
  it('lets an attendee through only on routes marked @AllowInterviewAttendee', async () => {
    await expect(makeGuard({ resource: 'interview', owns: false, attendee: true, allowAttendee: true })()).resolves.toBe(true);
    await expect(makeGuard({ resource: 'interview', owns: false, attendee: true, allowAttendee: false })()).rejects.toBeInstanceOf(ForbiddenException);
    await expect(makeGuard({ resource: 'interview', owns: false, attendee: false, allowAttendee: true })()).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('B1 owner eligibility', () => {
  const prismaFor = (record: unknown) => ({ user: { findFirst: vi.fn().mockResolvedValue(record) } }) as never;
  it('rejects administrators', async () => {
    await expect(assertEligibleOwner(prismaFor(userRecord(['ADMINISTRATOR'])), ORG, USER)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects inactive users', async () => {
    await expect(assertEligibleOwner(prismaFor(userRecord(['RECRUITER'], [], 'Inactive')), ORG, USER)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects unknown users and accepts an active recruiter', async () => {
    await expect(assertEligibleOwner(prismaFor(null), ORG, USER)).rejects.toBeInstanceOf(BadRequestException);
    await expect(assertEligibleOwner(prismaFor(userRecord(['RECRUITER'])), ORG, USER)).resolves.toBeUndefined();
  });
});

describe('B1 job redaction shape', () => {
  it('keeps only id, title, site and seats', () => {
    const redacted = redactVacancy({
      id: 'v1', title: 'Registered Nurse', branch: { id: 'b1', name: 'SGH Dubai' },
      approvedHeadcount: 3, joinedHeadcount: 1,
      ...({ vacancyCode: 'VAC-1', jobSummary: 'secret', assignments: [{}], status: 'Open' } as object),
    } as never);
    expect(redacted).toEqual({ id: 'v1', redacted: true, title: 'Registered Nurse', site: { id: 'b1', name: 'SGH Dubai' }, seats: { filled: 1, target: 3 } });
  });
});

describe('B1 backfill classification', () => {
  const requireCjs = createRequire(import.meta.url);
  const { classify } = requireCjs(path.resolve(__dirname, '../../../../../../scripts/b1-backfill-report.cjs')) as {
    classify: (v: unknown) => { outcome: string; reason: string };
  };
  const u = (id: string, status = 'Active', codes = ['RECRUITER']) => ({ id, displayName: id, email: id, status, organizationId: ORG, userRoles: codes.map((code) => ({ role: { code } })) });
  const v = (primaryRecruiterId: string | null, assignments: unknown[]) => ({ organizationId: ORG, primaryRecruiterId, assignments });
  const a = (user: unknown, kind = 'PRIMARY', isActive = true) => ({ user, assignmentKind: kind, isActive });
  it.each([
    [v('r', [a(u('r'))]), 'BACKFILLED'],
    [v(null, []), 'NO_PRIMARY_ASSIGNMENT'],
    [v(null, [a(u('r'), 'PRIMARY', false), a(u('s'), 'SUPPORT')]), 'NO_PRIMARY_ASSIGNMENT'],
    [v(null, [a(u('adm', 'Active', ['ADMINISTRATOR']))]), 'PRIMARY_IS_ADMIN'],
    [v(null, [a(u('x', 'Inactive'))]), 'PRIMARY_INACTIVE'],
    [v(null, [a(u('r')), a(u('s'))]), 'MULTIPLE_PRIMARY_ASSIGNMENTS'],
    // QA BUG-3: an admin from another org is reported as other-organization first.
    [v(null, [a({ ...u('adm2', 'Inactive', ['ADMINISTRATOR']), organizationId: 'other-org' })]), 'PRIMARY_OTHER_ORGANIZATION'],
    [v(null, [a({ ...u('o'), organizationId: 'other-org' })]), 'PRIMARY_OTHER_ORGANIZATION'],
  ])('classifies %#', (vacancy, expected) => {
    const result = classify(vacancy);
    expect(result.outcome === 'BACKFILLED' ? 'BACKFILLED' : result.reason).toBe(expected);
  });
});
