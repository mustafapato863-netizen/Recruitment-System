import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it, vi } from 'vitest';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { CandidatesController } from '../../candidates/candidates.controller';
import { AnonymizeCandidateDto } from '../../candidates/candidates.dto';
import { CandidatesService } from '../../candidates/candidates.service';
import { RolesService } from '../../roles/roles.service';
import { TalentPoolService } from '../../talent-pool/talent-pool.service';
import { UsersService } from '../../users/users.service';

const SRC = path.resolve(__dirname, '../..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === '__tests__' ? [] : sourceFiles(full);
    return full.endsWith('.ts') && !full.endsWith('.spec.ts') ? [full] : [];
  });
}

describe('B2: no hard deletes anywhere (v2 §3)', () => {
  // Only access-grant links and auth throttling rows may still be removed.
  // Grants are configuration (audited via @AuditAction), not business records.
  const ALLOWED = new Set(['authRateLimit', 'userRole', 'rolePermission']);

  it('no service calls prisma.<model>.delete/deleteMany on business records', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(/\.(\w+)\.(delete|deleteMany)\(/g)) {
        if (!ALLOWED.has(match[1]!)) offenders.push(`${path.relative(SRC, file)}: ${match[1]}.${match[2]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('talent pool removal soft-unlinks (removedAt) instead of deleting', async () => {
    const prisma = {
      talentPool: { findFirst: vi.fn().mockResolvedValue({ id: 'pool' }) },
      talentPoolCandidate: { findFirst: vi.fn().mockResolvedValue({ id: 'link' }), update: vi.fn().mockResolvedValue({}), delete: vi.fn() },
    };
    const service = new TalentPoolService(prisma as never);
    await expect(service.removeCandidate('org', 'pool', 'cand')).resolves.toMatchObject({ deactivated: true });
    expect(prisma.talentPoolCandidate.update).toHaveBeenCalledWith({ where: { id: 'link' }, data: { removedAt: expect.any(Date) } });
    expect(prisma.talentPoolCandidate.delete).not.toHaveBeenCalled();
    expect(prisma.talentPoolCandidate.findFirst).toHaveBeenCalledWith({ where: { talentPoolId: 'pool', candidateId: 'cand', removedAt: null } });
  });

  it('role and permission DELETE deactivate', async () => {
    const service = new RolesService({
      role: { update: vi.fn().mockResolvedValue({}), delete: vi.fn() },
      permission: { update: vi.fn().mockResolvedValue({}), delete: vi.fn() },
    } as never);
    const prisma = (service as unknown as { prisma: { role: { update: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> }; permission: { update: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> } } }).prisma;
    vi.spyOn(service as never, 'getMutableRole').mockResolvedValue({ id: 'r1', code: 'CUSTOM' } as never);
    vi.spyOn(service as never, 'getMutablePermission').mockResolvedValue({ id: 'p1' } as never);
    vi.spyOn(service as never, 'removeRoleFromCatalog').mockResolvedValue(undefined as never);
    await service.deactivate('org', 'r1');
    await service.deletePermission('org', 'p1');
    expect(prisma.role.update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { status: 'Inactive' } });
    expect(prisma.permission.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { status: 'Inactive' } });
    expect(prisma.role.delete).not.toHaveBeenCalled();
    expect(prisma.permission.delete).not.toHaveBeenCalled();
  });

  it('CANDIDATE_ANONYMIZE cannot be granted to a non-administrator role', async () => {
    const service = new RolesService({ rolePermission: { upsert: vi.fn() } } as never);
    vi.spyOn(service as never, 'getMutableRole').mockResolvedValue({ id: 'r1', code: 'RECRUITER' } as never);
    vi.spyOn(service as never, 'getAssignablePermission').mockResolvedValue({ id: 'p1', code: 'CANDIDATE_ANONYMIZE' } as never);
    await expect(service.assignPermission('org', 'r1', 'p1')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('B2: owner block on user deactivation', () => {
  function usersService(counts: number[]) {
    const [p, t, j, r] = counts;
    const prisma = {
      application: { count: vi.fn().mockResolvedValueOnce(p).mockResolvedValueOnce(t) },
      vacancyAssignment: { count: vi.fn().mockResolvedValue(j) },
      vacancyRequest: { count: vi.fn().mockResolvedValue(r) },
      user: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    const service = new UsersService(prisma as never, {} as never, {} as never);
    vi.spyOn(service, 'getById').mockResolvedValue({} as never);
    return { service, prisma };
  }

  it('returns 409 with counts while the user owns open work', async () => {
    const { service, prisma } = usersService([2, 1, 1, 3]);
    const error = await service.update('org', 'u1', { status: 'Inactive' } as never).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toEqual({
      code: 'USER_OWNS_OPEN_WORK',
      message: expect.any(String),
      counts: { openApplicationsPrimary: 2, openApplicationsTaskOwner: 1, openJobsPrimary: 1, openRequisitions: 3 },
    });
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('deactivates once nothing is owned, and never checks on reactivation', async () => {
    const { service, prisma } = usersService([0, 0, 0, 0]);
    await service.update('org', 'u1', { status: 'Inactive' } as never);
    expect(prisma.user.updateMany).toHaveBeenCalled();
    const second = usersService([5, 5, 5, 5]);
    await second.service.update('org', 'u1', { status: 'Active' } as never);
    expect(second.prisma.application.count).not.toHaveBeenCalled();
  });
});

describe('B2: anonymize contract', () => {
  it('requires CANDIDATE_ANONYMIZE on the route and a reason of at least 10 characters', async () => {
    const handler = Object.getOwnPropertyDescriptor(CandidatesController.prototype, 'anonymizeCandidate')!.value as object;
    expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual(['CANDIDATE_ANONYMIZE']);
    expect(await validate(plainToInstance(AnonymizeCandidateDto, {}))).not.toHaveLength(0);
    expect(await validate(plainToInstance(AnonymizeCandidateDto, { reason: 'short' }))).not.toHaveLength(0);
    expect(await validate(plainToInstance(AnonymizeCandidateDto, { reason: 'GDPR erasure request #123' }))).toHaveLength(0);
  });

  it('403 for anyone who is not an active Administrator, even with the permission', async () => {
    const service = new CandidatesService({ user: { findFirst: vi.fn().mockResolvedValue(null) } } as never);
    await expect(service.assertAdministrator('org', 'u1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('is idempotent: a second call returns already_anonymized and writes nothing', async () => {
    const at = new Date('2026-10-10T00:00:00Z');
    const prisma = { candidate: { findFirst: vi.fn().mockResolvedValue({ id: 'c1', anonymizedAt: at }) }, $transaction: vi.fn() };
    const service = new CandidatesService(prisma as never);
    await expect(service.anonymizeCandidate('org', 'c1', 'erasure request', { userId: 'a' } as never)).resolves.toEqual({ id: 'c1', status: 'already_anonymized', anonymizedAt: at.toISOString() });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
