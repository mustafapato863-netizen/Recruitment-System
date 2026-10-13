import { ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { AuthUser } from '@recruitflow/contracts';
import type { PrismaService } from '../../database/prisma.service';
import { buildWorkflowImpact } from '../workflow-rule-impact';
import { WorkflowRulesService } from '../workflow-rules.service';

describe('workflow rule impact', () => {
  it('keeps a preview when the position holds a protected job and leaves snapshots in place', () => {
    const impact = buildWorkflowImpact({
      positionId: 'p1',
      positionTitle: 'Registered Nurse',
      currentProfile: 'clinical',
      proposedProfile: 'technical',
      vacancies: [
        { id: 'v1', code: 'VAC-2026-011', status: 'Partially Filled', approvedHeadcount: 2, joinedHeadcount: 1 },
        { id: 'v2', code: 'VAC-2026-099', status: 'Open', approvedHeadcount: 1, joinedHeadcount: 0 },
      ],
      applications: [
        { id: 'a1', code: 'APP-1', stage: 'Joined', vacancyCode: 'VAC-2026-011', hasSnapshot: true },
        { id: 'a2', code: 'APP-2', stage: 'Applied', vacancyCode: 'VAC-2026-011', hasSnapshot: false },
      ],
    });
    expect(impact.applyAllowed).toBe(false);
    expect(impact.protectedVacancyCodes).toEqual(['VAC-2026-011']);
    expect(impact.preservedSnapshots).toBe(1);
    expect(impact.openCasesAdoptingProfile.map((row) => row.code)).toEqual(['APP-2']);
    expect(impact.vacancies.find((row) => row.code === 'VAC-2026-011')).toMatchObject({ status: 'Partially Filled', approvedHeadcount: 2, joinedHeadcount: 1 });
    expect(impact.message).toMatch(/preview/);
  });

  it('allows a profile only when none of the protected jobs are on the position', () => {
    const impact = buildWorkflowImpact({
      positionId: 'p2',
      positionTitle: 'Reception',
      currentProfile: null,
      proposedProfile: 'technical',
      vacancies: [{ id: 'v3', code: 'VAC-2026-100', status: 'Open', approvedHeadcount: 1, joinedHeadcount: 0 }],
      applications: [],
    });
    expect(impact.applyAllowed).toBe(true);
    expect(impact.protectedVacancyCodes).toEqual([]);
  });

  it('does not write a profile when the preview is blocked', async () => {
    const updates: string[] = [];
    const prisma = {
      position: {
        findFirst: async () => ({ id: 'p1', title: 'Registered Nurse', metadata: { requirementProfile: 'clinical' } }),
        update: async () => { updates.push('position'); },
      },
      vacancy: {
        findMany: async () => [{
          id: 'v1', vacancyCode: 'VAC-2026-011', status: 'Partially Filled', approvedHeadcount: 2, joinedHeadcount: 1,
          applications: [{ id: 'a1', applicationCode: 'APP-2026-021', stage: 'Applied', hiringCase: null }],
        }],
      },
      auditLog: { create: async () => { updates.push('audit'); } },
    };
    const service = new WorkflowRulesService(prisma as unknown as PrismaService);
    const user = { userId: 'admin', organizationId: 'org', roleCodes: ['ADMINISTRATOR'], email: 'a@recruitflow.local' } as AuthUser;
    await expect(service.apply(user, 'p1', 'technical')).rejects.toBeInstanceOf(ConflictException);
    expect(updates).toEqual([]);
  });
});
