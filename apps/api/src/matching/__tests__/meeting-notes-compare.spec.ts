import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@recruitflow/contracts';
import { MatchingService } from '../matching.service';

// Meeting notes 2026-11-25 (item 2): Compare shows each candidate's nationality
// against the job's nationality preference — a soft signal, never a score or filter.
const owner: AuthUser = { userId: 'owner', organizationId: 'org', tokenVersion: 1, roleCodes: [] };

function candidate(id: string, firstName: string, nationality: string | null) {
  return {
    id,
    candidateCode: `CAN-${id}`,
    firstName,
    lastName: 'Test',
    currentTitle: 'Analyst',
    location: 'Cairo',
    nationality,
    updatedAt: new Date('2026-02-01T00:00:00Z'),
    skills: ['SQL'],
    applications: [],
    skillLinks: [{
      skillId: 'sk-sql',
      evidence: [{
        id: 'ev1', sourceType: 'CV_TEXT', sourceRef: 'doc-1', snippet: 'Built SQL reports',
        createdAt: new Date('2026-01-01T00:00:00Z'), addedBy: { id: 'u1', displayName: 'Recruiter' },
      }],
    }],
  };
}

function serviceFor() {
  const prisma = {
    vacancy: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'vac', requiredSkills: ['SQL'], status: 'Open', primaryRecruiterId: 'owner',
        nationalityPreference: ['Egyptian'], assignments: [],
      }),
    },
    masterDataValue: { findMany: vi.fn().mockResolvedValue([{ id: 'sk-sql', name: 'SQL' }]) },
    candidate: {
      findMany: vi.fn()
        .mockResolvedValueOnce([candidate('c1', 'Sara', 'Egyptian'), candidate('c2', 'John', null)])
        .mockResolvedValue([
          { id: 'c1', availability: null, nationality: 'Egyptian' },
          { id: 'c2', availability: null, nationality: null },
        ]),
    },
    screeningLog: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const permissions = { hasPermission: vi.fn().mockResolvedValue(false) };
  return { prisma, svc: new MatchingService(prisma as never, permissions as never) };
}

describe('meeting notes item 2 — nationality on Compare', () => {
  it('returns the job preference and each candidate nationality as an info row', async () => {
    const { svc } = serviceFor();
    const res = await svc.compare(owner, 'vac', ['c1', 'c2']);
    expect(res.nationalityPreference).toEqual(['Egyptian']);
    expect(res.candidates).toMatchObject([
      { id: 'c1', nationality: 'Egyptian' },
      { id: 'c2', nationality: null },
    ]);
    const row = res.infoRows.find((r) => r.key === 'nationality');
    expect(row?.label).toBe('Nationality');
    expect(row?.cells).toEqual([
      { candidateId: 'c1', value: 'Egyptian', source: 'profile' },
      { candidateId: 'c2', value: null, source: null },
    ]);
    expect(JSON.stringify(res)).not.toMatch(/score|percent/i);
  });

  it('carries nationality on suggestions without changing the ordering', async () => {
    const { svc } = serviceFor();
    const res = await svc.suggestions(owner, 'vac');
    expect(res.suggestions).toHaveLength(2);
    expect(res.suggestions[0]?.candidate).toMatchObject({ id: 'c1', nationality: 'Egyptian' });
    expect(res.suggestions[1]?.candidate).toMatchObject({ id: 'c2', nationality: null });
  });
});
