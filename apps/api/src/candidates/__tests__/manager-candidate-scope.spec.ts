import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@recruitflow/contracts';
import type { AccessControlService } from '../../access-control/access-control.service';
import type { PrismaService } from '../../database/prisma.service';
import { CandidatesService } from '../candidates.service';

const ORG_ID = 'org-1';
const MANAGER_USER: AuthUser = {
  userId: 'mgr-1',
  organizationId: ORG_ID,
  email: 'mgr@example.com',
  displayName: 'Team Manager',
  roleCodes: ['TALENT_MANAGER'],
};

describe('Ticket 14 — manager candidate scope enforcement', () => {
  it('scopes non-admin manager candidate queries to team applications even when role RLS default is ALL', async () => {
    const teamAppPredicate = {
      AND: [{ organizationId: ORG_ID }, { OR: [{ primaryRecruiterId: 'mgr-1' }] }],
    };
    const prisma = {
      candidate: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const accessControl = {
      getUserEffectiveScope: vi.fn().mockResolvedValue({ dataScope: 'ALL' }),
      getApplicationVisibilityWhere: vi.fn().mockResolvedValue(teamAppPredicate),
    };
    const service = new CandidatesService(
      prisma as unknown as PrismaService,
      undefined,
      accessControl as unknown as AccessControlService,
    );

    const res = await service.listCandidates(ORG_ID, { page: 1, pageSize: 20 }, { viewPii: false }, MANAGER_USER);
    expect(res.data).toEqual([]);
    expect(res.total).toBe(0);
    expect(accessControl.getApplicationVisibilityWhere).toHaveBeenCalledWith(MANAGER_USER);
    expect(prisma.candidate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: ORG_ID,
          OR: [
            { createdById: MANAGER_USER.userId },
            { applications: { some: teamAppPredicate } },
          ],
        }),
      }),
    );
  });

  it('rejects direct getCandidate access for a candidate outside the manager team scope', async () => {
    const prisma = {
      candidate: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const accessControl = {
      getUserEffectiveScope: vi.fn().mockResolvedValue({ dataScope: 'DEPARTMENT' }),
      getApplicationVisibilityWhere: vi.fn().mockResolvedValue({ primaryRecruiterId: 'mgr-1' }),
    };
    const service = new CandidatesService(
      prisma as unknown as PrismaService,
      undefined,
      accessControl as unknown as AccessControlService,
    );

    await expect(
      service.getCandidate(ORG_ID, 'cand-outside-team', { viewPii: false }, MANAGER_USER),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
