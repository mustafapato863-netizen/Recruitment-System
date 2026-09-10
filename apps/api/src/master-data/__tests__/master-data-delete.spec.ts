import { describe, expect, it, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { MasterDataService } from '../master-data.service';

function createPrisma(overrides: Record<string, unknown> = {}) {
  return {
    masterDataValue: {
      findFirst: vi.fn().mockResolvedValue({ id: 'skill-1', name: 'ICU', code: 'ICU-1' }),
      delete: vi.fn().mockResolvedValue({}),
    },
    vacancy: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    candidate: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    application: { count: vi.fn().mockResolvedValue(0) },
    interview: { count: vi.fn().mockResolvedValue(0) },
    position: { findMany: vi.fn().mockResolvedValue([]) },
    ...overrides,
  };
}

describe('MasterDataService catalog deletion', () => {
  it('deletes an unused catalog value for the current organization', async () => {
    const prisma = createPrisma();
    const service = new MasterDataService(prisma as never);

    await expect(service.deleteCatalogValue('org-1', 'skills', 'skill-1')).resolves.toEqual({ deleted: true });
    expect(prisma.masterDataValue.findFirst).toHaveBeenCalledWith({
      where: { id: 'skill-1', organizationId: 'org-1', category: 'skills' },
      select: { id: true, name: true, code: true },
    });
    expect(prisma.masterDataValue.delete).toHaveBeenCalledWith({ where: { id: 'skill-1' } });
  });

  it('blocks deleting a skill that is used by a vacancy or candidate', async () => {
    const prisma = createPrisma({
      vacancy: {
        findMany: vi.fn().mockResolvedValue([{ requiredSkills: ['ICU'] }]),
        count: vi.fn(),
      },
    });
    const service = new MasterDataService(prisma as never);

    const error = await service.deleteCatalogValue('org-1', 'skills', 'skill-1').catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).message).toContain('referenced by 1 vacancies');
    expect(prisma.masterDataValue.delete).not.toHaveBeenCalled();
  });
});
