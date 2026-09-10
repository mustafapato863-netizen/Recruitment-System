import { describe, expect, it, vi } from 'vitest';
import { catalogKey, normalizeCatalogText, uniqueCatalogNames } from '../catalog-normalization';
import { MasterDataService } from '../master-data.service';

describe('catalog normalization', () => {
  it('removes invisible spreadsheet whitespace without changing words', () => {
    expect(normalizeCatalogText('  Digital\u00a0  Marketing\u202fManager  ')).toBe('Digital Marketing Manager');
  });

  it('uses a case-insensitive key and keeps the first display spelling', () => {
    expect(catalogKey('  ICU ')).toBe('icu');
    expect(uniqueCatalogNames(['ICU', 'icu', ' ICU\u00a0', 'BLS'])).toEqual(['ICU', 'BLS']);
  });

  it('syncs vacancy skills into the organization catalog idempotently', async () => {
    const create = vi.fn().mockImplementation(async ({ data }) => ({
      ...data,
      id: 'skill-2',
      version: 1,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    const tx = {
      $executeRaw: vi.fn(),
      masterDataValue: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'skill-1',
          name: 'ICU',
          status: 'Inactive',
          code: null,
          organizationId: 'org-1',
          category: 'skills',
          metadata: null,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        }]),
        update: vi.fn(),
        create,
      },
    };

    const service = new MasterDataService({} as never);
    const result = await service.syncSkillsInTransaction(tx as never, 'org-1', [' ICU ', 'BLS', 'bls']);

    expect(result).toEqual(['ICU', 'BLS']);
    expect(tx.masterDataValue.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'skill-1' } }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ name: 'BLS', category: 'skills' }) }));
  });
});
