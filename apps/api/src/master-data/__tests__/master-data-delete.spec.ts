import { describe, expect, it, vi } from 'vitest';
import { MasterDataService } from '../master-data.service';

// B2 (v2 §3): DELETE never removes master data; it archives.
function createPrisma() {
  return {
    masterDataValue: {
      findFirst: vi.fn().mockResolvedValue({ id: 'skill-1', name: 'ICU', code: 'ICU-1' }),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn(),
    },
    branch: {
      findFirst: vi.fn().mockResolvedValue({ id: 'branch-1', status: 'Active' }),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn(),
    },
    position: {
      findFirst: vi.fn().mockResolvedValue({ id: 'pos-1', status: 'Archived' }),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn(),
    },
  };
}

describe('MasterDataService DELETE archives (B2)', () => {
  it('archives a catalog value instead of deleting it', async () => {
    const prisma = createPrisma();
    const service = new MasterDataService(prisma as never);
    await expect(service.deleteCatalogValue('org-1', 'skills', 'skill-1')).resolves.toEqual({ id: 'skill-1', deactivated: true, status: 'Archived' });
    expect(prisma.masterDataValue.update).toHaveBeenCalledWith({ where: { id: 'skill-1' }, data: { status: 'Archived' } });
    expect(prisma.masterDataValue.delete).not.toHaveBeenCalled();
  });

  it('archives a branch (even one in use) and never deletes it', async () => {
    const prisma = createPrisma();
    const service = new MasterDataService(prisma as never);
    await expect(service.deleteBranch('org-1', 'branch-1')).resolves.toMatchObject({ deactivated: true, status: 'Archived' });
    expect(prisma.branch.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'branch-1' }, data: expect.objectContaining({ status: 'Archived' }) }));
    expect(prisma.branch.delete).not.toHaveBeenCalled();
  });

  it('is idempotent for an already archived position', async () => {
    const prisma = createPrisma();
    const service = new MasterDataService(prisma as never);
    await expect(service.deletePosition('org-1', 'pos-1')).resolves.toMatchObject({ deactivated: true });
    expect(prisma.position.update).not.toHaveBeenCalled();
    expect(prisma.position.delete).not.toHaveBeenCalled();
  });
});
