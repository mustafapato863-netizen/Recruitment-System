import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../database/prisma.service';
import { CandidatesService } from '../candidates.service';

// Meeting notes 2026-11-25 (item 2): candidate nationality from the 'nationalities'
// master-data list; a value outside the list is rejected, and the list can be filtered.
const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'cand-1', organizationId: 'org-1', candidateCode: 'CND-2026-001',
  firstName: 'Sara', lastName: 'Ali', email: 'sara@example.com', phone: null,
  currentTitle: 'Nurse', currentCompany: null, summary: null, source: 'Referral',
  status: 'Active', skills: [], experienceYears: 5, location: 'Cairo',
  nationality: 'Egyptian', certifications: [], languages: [], availability: null,
  metadata: null, createdById: null, createdAt: new Date(), updatedAt: new Date(),
  ...overrides,
});

function serviceFor() {
  const prisma = {
    candidate: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([row()]),
      count: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => row(data)),
      update: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => row(data)),
    },
    masterDataValue: {
      findFirst: vi.fn().mockImplementation(async (args: { where: { OR: Array<{ name?: { equals: string } }> } }) => {
        const wanted = args.where.OR[0]?.name?.equals?.toLowerCase() ?? '';
        return wanted === 'egyptian' ? { name: 'Egyptian' } : null;
      }),
    },
    codeSequence: { upsert: vi.fn().mockResolvedValue({ lastIssued: 1 }) },
  };
  const service = new CandidatesService(prisma as unknown as PrismaService);
  return { service, prisma };
}

describe('meeting notes item 2 — candidate nationality', () => {
  it('stores the canonical nationality on create and rejects a value outside the list', async () => {
    const { service, prisma } = serviceFor();
    const created = await service.createCandidate('org-1', {
      firstName: 'Sara', lastName: 'Ali', email: 'sara@example.com', nationality: 'egyptian',
    });
    expect(created.nationality).toBe('Egyptian');
    expect(prisma.candidate.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ nationality: 'Egyptian' }),
    }));
    await expect(service.createCandidate('org-1', {
      firstName: 'Sara', lastName: 'Ali', email: 'sara@example.com', nationality: 'Martian',
    })).rejects.toMatchObject({ response: { code: 'NATIONALITY_NOT_IN_LIST', field: 'nationality' } });
  });

  it('updates nationality and clears it when set to empty', async () => {
    const { service, prisma } = serviceFor();
    prisma.candidate.findFirst.mockResolvedValueOnce(row());
    const updated = await service.updateCandidate('org-1', 'cand-1', { nationality: 'Egyptian' });
    expect(updated.nationality).toBe('Egyptian');
    prisma.candidate.findFirst.mockResolvedValueOnce(row());
    const cleared = await service.updateCandidate('org-1', 'cand-1', { nationality: '' });
    expect(cleared.nationality).toBeNull();
  });

  it('filters the candidate list by nationality and returns it on each row', async () => {
    const { service, prisma } = serviceFor();
    const result = await service.listCandidates('org-1', { nationality: 'Egyptian' }, { viewPii: true });
    expect(prisma.candidate.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ nationality: 'Egyptian' }),
    }));
    expect(result.data[0]?.nationality).toBe('Egyptian');
  });
});
