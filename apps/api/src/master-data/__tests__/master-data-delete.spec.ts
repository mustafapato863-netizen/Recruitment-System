import { describe, expect, it, vi } from 'vitest';
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

    await expect(service.deleteCatalogValue('org-1', 'interview-types', 'skill-1')).resolves.toEqual({ deleted: true });
    expect(prisma.masterDataValue.findFirst).toHaveBeenCalledWith({
      where: { id: 'skill-1', organizationId: 'org-1', category: 'interview-types' },
      select: { id: true, name: true, code: true },
    });
    expect(prisma.masterDataValue.delete).toHaveBeenCalledWith({ where: { id: 'skill-1' } });
  });

  it('B6: never deletes a skill, used or not; it is deactivated instead', async () => {
    const prisma = createPrisma({
      masterDataValue: {
        findFirst: vi.fn().mockResolvedValue({ id: 'skill-1' }),
        update: vi.fn().mockResolvedValue({}),
        delete: vi.fn(),
      },
      vacancy: { findMany: vi.fn().mockResolvedValue([{ requiredSkills: ['ICU'] }]), count: vi.fn() },
    });
    const service = new MasterDataService(prisma as never);

    await expect(service.deleteCatalogValue('org-1', 'skills', 'skill-1')).resolves.toEqual({ id: 'skill-1', deactivated: true, status: 'Inactive' });
    expect(prisma.masterDataValue.update).toHaveBeenCalledWith({ where: { id: 'skill-1' }, data: { status: 'Inactive', version: { increment: 1 } } });
    expect(prisma.masterDataValue.delete).not.toHaveBeenCalled();
  });
});
