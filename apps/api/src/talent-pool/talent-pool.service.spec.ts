import { describe, expect, it, vi } from 'vitest';
import { TalentPoolService } from './talent-pool.service';

describe('TalentPoolService', () => {
  it('a removed member is absent from candidateCount and the membership row remains', async () => {
    const membership = { id: 'link', removedAt: null as Date | null };
    const updatedAt = new Date('2026-10-01T00:00:00.000Z');
    const prisma = {
      talentPool: {
        findFirst: vi.fn().mockResolvedValue({ id: 'pool' }),
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockImplementation(async () => [{
          id: 'pool',
          name: 'ICU nurses',
          description: null,
          tags: ['nursing'],
          status: 'Active',
          updatedAt,
          _count: { candidates: membership.removedAt ? 0 : 2 },
        }]),
      },
      talentPoolCandidate: {
        findFirst: vi.fn().mockImplementation(async () => (membership.removedAt ? null : membership)),
        update: vi.fn().mockImplementation(async ({ data }: { data: { removedAt: Date } }) => {
          membership.removedAt = data.removedAt;
          return membership;
        }),
        delete: vi.fn(),
        deleteMany: vi.fn(),
      },
    };
    const service = new TalentPoolService(prisma as never);

    await service.removeCandidate('org', 'pool', 'cand');

    expect(membership.removedAt).toBeInstanceOf(Date);
    expect(prisma.talentPoolCandidate.update).toHaveBeenCalledWith({
      where: { id: 'link' },
      data: { removedAt: membership.removedAt },
    });
    expect(prisma.talentPoolCandidate.delete).not.toHaveBeenCalled();
    expect(prisma.talentPoolCandidate.deleteMany).not.toHaveBeenCalled();

    const listed = await service.getPools('org');

    expect(prisma.talentPool.findMany).toHaveBeenCalledWith(expect.objectContaining({
      include: {
        _count: {
          select: { candidates: { where: { removedAt: null } } },
        },
      },
    }));
    expect(prisma.talentPoolCandidate.delete).not.toHaveBeenCalled();
    expect(listed.data[0]?.candidateCount).toBe(0);
  });
});
