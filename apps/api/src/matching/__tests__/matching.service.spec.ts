import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '@recruitflow/contracts';
import { describe, expect, it, vi } from 'vitest';
import { evaluateSkillEvidence, isNegatedSkillMention } from '../../../../../packages/validation/src/matching';
import { planFillFromCv } from '../../candidates/fill-from-cv';
import { MatchingService, SUGGESTION_ORDER } from '../matching.service';
import { findSkillSnippet } from '../skill-evidence';
import { syncCandidateSkills } from '../skill-links';

describe('negation guard', () => {
  it('returns null for a negated skill and the later positive mention when one exists', () => {
    expect(findSkillSnippet('The candidate has no SQL experience.', 'SQL')).toBeNull();
    expect(findSkillSnippet('Candidate is without React on the frontend.', 'React')).toBeNull();
    expect(findSkillSnippet('The profile lacks React and ships only HTML.', 'React')).toBeNull();
    expect(findSkillSnippet('She is not experienced in Python.', 'Python')).toBeNull();
    expect(findSkillSnippet('No Java experience, but strong SQL experience', 'SQL')).toContain('SQL');
    expect(findSkillSnippet('No Java experience, but strong SQL experience', 'Java')).toBeNull();
    const later = findSkillSnippet(`The candidate has no SQL experience.${' padding'.repeat(30)} She later used SQL daily.`, 'SQL');
    expect(later).toContain('used SQL daily');
    expect(later).not.toContain('no SQL');
  });

  it('ignores negated phrases in fit evidence and keeps a positive mention after a contrast', () => {
    expect(isNegatedSkillMention('The candidate has no SQL experience.', 'SQL')).toBe(true);
    expect(isNegatedSkillMention('without React', 'React')).toBe(true);
    expect(isNegatedSkillMention('No Java experience, but strong SQL experience', 'SQL')).toBe(false);

    const negated = evaluateSkillEvidence('SQL', 'required', {
      skills: [],
      rawText: 'The candidate has no SQL experience.',
      summary: 'The candidate has no SQL experience.',
    });
    expect(negated.score).toBe(0);
    expect(negated.matchLevel).toBe('NO_EVIDENCE');

    const positive = evaluateSkillEvidence('SQL', 'required', {
      skills: [],
      rawText: 'No Java experience, but strong SQL experience building reports.',
      summary: 'No Java experience, but strong SQL experience building reports.',
    });
    expect(positive.score).toBeGreaterThan(0);
    expect(positive.evidence.some((line) => line.toLowerCase().includes('sql'))).toBe(true);
  });
});

describe('planFillFromCv structured metadata', () => {
  it('stores work history and evidence chunks without replacing recruiter metadata', () => {
    const plan = planFillFromCv(
      { skills: [], metadata: { note: 'recruiter', workHistory: [{ jobTitle: 'Kept' }] } },
      {
        skills: ['SQL'],
        workHistory: [{ jobTitle: 'Analyst', description: 'Built SQL reports.' }],
        educationHistory: [{ degree: 'BSc' }],
        projectHistory: [],
        evidenceChunks: [{ text: 'Built SQL reports.', source: 'Work Experience' }],
      },
    );
    expect(plan.filled).toContain('metadata');
    expect(plan.filled).toContain('skills');
    expect(plan.data.metadata).toEqual({
      note: 'recruiter',
      workHistory: [{ jobTitle: 'Kept' }],
      educationHistory: [{ degree: 'BSc' }],
      evidenceChunks: [{ text: 'Built SQL reports.', source: 'Work Experience' }],
    });
    expect(plan.data).not.toHaveProperty('workHistory');
  });
});

describe('deriveEvidence scorecard hygiene', () => {
  it('queries Submitted scorecards and uses only the latest revision per interviewer', async () => {
    const recorded: string[] = [];
    const prisma = {
      candidate: { findFirst: vi.fn().mockResolvedValue({ id: 'c1', organizationId: 'org' }) },
      masterDataValue: { findMany: vi.fn().mockResolvedValue([{ id: 'sk-sql', name: 'SQL' }]) },
      candidateDocument: { findMany: vi.fn().mockResolvedValue([]) },
      screeningLog: { findMany: vi.fn().mockResolvedValue([]) },
      interviewScorecard: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'u2-old', interviewId: 'iv', interviewerId: 'u2', revision: 1, submittedAt: new Date('2026-05-01T00:00:00Z'), notes: 'Uses SQL daily', strengths: null },
          { id: 'u1-new', interviewId: 'iv', interviewerId: 'u1', revision: 2, submittedAt: new Date('2026-02-01T00:00:00Z'), notes: 'Communication only', strengths: 'Teamwork' },
          { id: 'u1-old', interviewId: 'iv', interviewerId: 'u1', revision: 1, submittedAt: new Date('2026-01-01T00:00:00Z'), notes: 'Expert SQL', strengths: null },
          { id: 'u2-new', interviewId: 'iv', interviewerId: 'u2', revision: 4, submittedAt: new Date('2026-03-01T00:00:00Z'), notes: 'SQL architecture review', strengths: null },
        ]),
      },
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<void>) => fn({})),
    };
    const svc = new MatchingService(prisma as never, {} as never);
    vi.spyOn(svc, 'recordEvidence').mockImplementation(async (_tx, _org, _cand, _skill, _type, sourceRef) => {
      recorded.push(String(sourceRef));
      return { id: 'evidence' } as never;
    });

    const out = await svc.deriveEvidence('org', 'c1', 'actor');

    expect(prisma.interviewScorecard.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: 'Submitted', interview: { organizationId: 'org', application: { candidateId: 'c1' } } },
      orderBy: [{ revision: 'desc' }, { submittedAt: 'desc' }],
    }));
    expect(prisma.candidateDocument.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId: 'org', candidateId: 'c1', deletedAt: null }),
    }));
    expect(recorded).toEqual(['u2-new']);
    expect(out.found.map((item) => item.sourceRef)).toEqual(['u2-new']);
  });
});

describe('syncCandidateSkills', () => {
  function skillTx(rows: Array<{ id: string; name: string; evidence: string[] }>) {
    const deleteMany = vi.fn(async (args: { where: { id: { in: string[] } } }) => ({ count: args.where.id.in.length }));
    const tx = {
      masterDataValue: {
        findMany: async () => rows.map((row) => ({ id: row.id, name: row.name })),
      },
      candidateSkill: {
        createMany: async () => ({ count: 1 }),
        findMany: async () => rows.map((row) => ({
          id: row.id,
          skill: { name: row.name },
          evidence: row.evidence.map((sourceType) => ({ sourceType })),
        })),
        deleteMany,
      },
    };
    return { tx, deleteMany };
  }

  it('reports manual links removed from the profile and keeps CV, scorecard, and screening evidence', async () => {
    const { tx, deleteMany } = skillTx([
      { id: 'link-sql', name: 'SQL', evidence: [] },
      { id: 'link-react', name: 'React', evidence: ['MANUAL'] },
      { id: 'link-java', name: 'Java', evidence: ['CV_TEXT'] },
      { id: 'link-py', name: 'Python', evidence: ['SCORECARD'] },
      { id: 'link-go', name: 'Go', evidence: ['SCREENING_NOTE'] },
    ]);
    const result = await syncCandidateSkills(tx as never, 'org', 'c1', ['SQL']);
    expect(result).toEqual({ linked: 1, removed: 1, unlinkedIds: ['link-react'] });
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('reports unevidenced links when the profile skill list is emptied', async () => {
    const { tx, deleteMany } = skillTx([
      { id: 'link-sql', name: 'SQL', evidence: [] },
      { id: 'link-react', name: 'React', evidence: ['IMPORT'] },
      { id: 'link-java', name: 'Java', evidence: ['CV_TEXT'] },
    ]);
    const result = await syncCandidateSkills(tx as never, 'org', 'c1', []);
    expect(result).toEqual({ linked: 0, removed: 2, unlinkedIds: ['link-sql', 'link-react'] });
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('reports no unlinked ids when the client cannot list links', async () => {
    const deleteMany = vi.fn();
    const tx = {
      masterDataValue: { findMany: async () => [{ id: 'sk-sql', name: 'SQL' }] },
      candidateSkill: { createMany: async () => ({ count: 1 }), deleteMany },
    };
    await expect(syncCandidateSkills(tx as never, 'org', 'c1', ['SQL'])).resolves.toEqual({
      linked: 1,
      removed: 0,
      unlinkedIds: [],
    });
    expect(deleteMany).not.toHaveBeenCalled();
  });
});

describe('suggestions contract', () => {
  const owner: AuthUser = { userId: 'owner', organizationId: 'org', tokenVersion: 1, roleCodes: [] };

  function setup(options: {
    status?: string;
    primaryRecruiterId?: string | null;
    assignments?: Array<{ userId: string; user: { managerId: string | null } }>;
    applications?: Array<{ id: string; stage: string }>;
    candidates?: Array<Record<string, unknown>>;
  }) {
    const candidates = options.candidates ?? [{
      id: 'c1',
      candidateCode: 'CAN-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      currentTitle: 'Analyst',
      location: 'Cairo',
      updatedAt: new Date('2026-02-01T00:00:00Z'),
      skillLinks: [{
        skillId: 'sk-sql',
        evidence: [{
          id: 'ev1',
          sourceType: 'CV_TEXT',
          sourceRef: 'doc-1',
          snippet: 'Built SQL reports',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          addedBy: { id: 'u1', displayName: 'Recruiter' },
        }],
      }],
      applications: options.applications ?? [],
    }];
    const prisma = {
      vacancy: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'vac',
          requiredSkills: ['SQL', 'Mystery Lab'],
          status: options.status,
          primaryRecruiterId: options.primaryRecruiterId === undefined ? 'owner' : options.primaryRecruiterId,
          assignments: options.assignments ?? [],
        }),
      },
      masterDataValue: {
        findMany: vi.fn().mockResolvedValue([{ id: 'sk-sql', name: 'SQL' }]),
      },
      candidate: { findMany: vi.fn().mockResolvedValue(candidates) },
    };
    const permissions = { hasPermission: vi.fn().mockResolvedValue(false) };
    return { prisma, permissions, svc: new MatchingService(prisma as never, permissions as never) };
  }

  it('lets the primary recruiter read suggestions with application status and no score keys', async () => {
    const { prisma, permissions, svc } = setup({ status: 'Open', applications: [] });
    const res = await svc.suggestions(owner, 'vac');

    expect(permissions.hasPermission).not.toHaveBeenCalled();
    expect(prisma.vacancy.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({ status: true, primaryRecruiterId: true, requiredSkills: true }),
    }));
    expect(prisma.candidate.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        applications: { where: { vacancyId: 'vac' }, select: { id: true, stage: true }, take: 1 },
      }),
    }));
    expect(res.orderedBy).toEqual(SUGGESTION_ORDER);
    expect(res.unmappedRequiredSkills).toEqual(['Mystery Lab']);
    expect(res.suggestions).toHaveLength(1);
    expect(res.suggestions[0]).toMatchObject({
      applicationId: null,
      alreadyOnJob: false,
      stage: null,
      addable: true,
    });
    expect(res.suggestions[0].matchedSkills[0]).toMatchObject({
      hasEvidence: true,
      evidence: [expect.objectContaining({ snippet: 'Built SQL reports' })],
    });
    expect(res.suggestions[0]).not.toHaveProperty('score');
    expect(res.suggestions[0]).not.toHaveProperty('_evidenced');
    expect(JSON.stringify(res)).not.toMatch(/score|percent/i);
  });

  it.each([
    [undefined, true],
    ['Open', true],
    ['Partially Filled', true],
    ['On Hold', false],
    ['Filled', false],
    ['Closed', false],
  ])('status %s is addable=%s when the person is not already on the job', async (status, addable) => {
    const { svc } = setup({ status, applications: [] });
    const res = await svc.suggestions(owner, 'vac');
    expect(res.suggestions[0]).toMatchObject({ applicationId: null, alreadyOnJob: false, stage: null, addable });
  });

  it('returns the open file and refuses another add while the job is still open', async () => {
    const { svc } = setup({ status: 'Open', applications: [{ id: 'app-1', stage: 'Screening' }] });
    const res = await svc.suggestions(owner, 'vac');
    expect(res.suggestions[0]).toMatchObject({
      applicationId: 'app-1',
      alreadyOnJob: true,
      stage: 'Screening',
      addable: false,
    });
  });

  it('still allows an active primary assignee and their manager, and rejects everyone else', async () => {
    const assigned = setup({
      status: 'Open',
      primaryRecruiterId: 'someone-else',
      assignments: [{ userId: 'owner', user: { managerId: 'manager-user' } }],
    });
    await expect(assigned.svc.suggestions(owner, 'vac')).resolves.toMatchObject({ vacancyId: 'vac' });
    expect(assigned.permissions.hasPermission).not.toHaveBeenCalled();

    const managed = setup({
      status: 'Open',
      primaryRecruiterId: 'someone-else',
      assignments: [{ userId: 'recruiter', user: { managerId: 'owner' } }],
    });
    await expect(managed.svc.suggestions(owner, 'vac')).resolves.toMatchObject({ vacancyId: 'vac' });

    const stranger = setup({
      status: 'Open',
      primaryRecruiterId: 'someone-else',
      assignments: [{ userId: 'recruiter', user: { managerId: 'manager-user' } }],
    });
    const error = await stranger.svc.suggestions({ ...owner, userId: 'stranger' }, 'vac').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toMatchObject({ code: 'NOT_JOB_OWNER' });
    expect(stranger.permissions.hasPermission).toHaveBeenCalledWith('stranger', 'org', 'VACANCY_MANAGE');
  });

  it('orders people with more evidenced skills first', async () => {
    const { svc } = setup({
      status: 'Open',
      candidates: [
        {
          id: 'c-held',
          candidateCode: 'CAN-2',
          firstName: 'Bea',
          lastName: 'Held',
          currentTitle: null,
          location: null,
          updatedAt: new Date('2026-03-01T00:00:00Z'),
          skillLinks: [{ skillId: 'sk-sql', evidence: [] }],
          applications: [],
        },
        {
          id: 'c-evidenced',
          candidateCode: 'CAN-9',
          firstName: 'Ada',
          lastName: 'Evidence',
          currentTitle: null,
          location: null,
          updatedAt: new Date('2026-01-01T00:00:00Z'),
          skillLinks: [{
            skillId: 'sk-sql',
            evidence: [{
              id: 'ev2',
              sourceType: 'CV_TEXT',
              sourceRef: null,
              snippet: 'Uses SQL daily',
              createdAt: new Date('2026-01-02T00:00:00Z'),
              addedBy: null,
            }],
          }],
          applications: [],
        },
      ],
    });
    const res = await svc.suggestions(owner, 'vac');
    expect(res.suggestions.map((item) => item.candidate.id)).toEqual(['c-evidenced', 'c-held']);
    expect(res.suggestions[1]).toMatchObject({ addable: true, alreadyOnJob: false, applicationId: null });
  });

  it('stops counting a skill removed from the profile unless CV, scorecard, or screening evidence remains', async () => {
    const at = new Date('2026-01-01T00:00:00Z');
    const quote = (id: string, sourceType: string) => ({
      id,
      sourceType,
      sourceRef: null,
      snippet: `${sourceType} quote`,
      createdAt: at,
      addedBy: null,
    });
    const library = [
      { id: 'sk-sql', name: 'SQL' },
      { id: 'sk-react', name: 'React' },
      { id: 'sk-py', name: 'Python' },
      { id: 'sk-go', name: 'Go' },
      { id: 'sk-java', name: 'Java' },
      { id: 'sk-excel', name: 'Excel' },
    ];
    const profileSkills = ['Excel'];
    const kept = {
      id: 'c-kept',
      candidateCode: 'CAN-1',
      firstName: 'Ada',
      lastName: 'Kept',
      currentTitle: null,
      location: null,
      updatedAt: new Date('2026-02-01T00:00:00Z'),
      skills: profileSkills,
      skillLinks: [
        { skillId: 'sk-sql', evidence: [quote('ev-sql', 'CV_TEXT')] },
        { skillId: 'sk-react', evidence: [quote('ev-react', 'MANUAL')] },
        { skillId: 'sk-py', evidence: [quote('ev-py', 'SCORECARD')] },
        { skillId: 'sk-go', evidence: [quote('ev-go', 'SCREENING_NOTE')] },
        { skillId: 'sk-java', evidence: [] },
        { skillId: 'sk-excel', evidence: [] },
      ],
      applications: [],
    };
    const dropped = {
      id: 'c-dropped',
      candidateCode: 'CAN-2',
      firstName: 'Bea',
      lastName: 'Dropped',
      currentTitle: null,
      location: null,
      updatedAt: new Date('2026-03-01T00:00:00Z'),
      skills: [] as string[],
      skillLinks: [{ skillId: 'sk-react', evidence: [quote('ev-react-2', 'MANUAL')] }],
      applications: [],
    };
    const listedEvidence = (id: string, sourceType: string) => ({
      id,
      sourceType,
      sourceRef: null,
      snippet: `${sourceType} quote`,
      createdAt: at,
      addedBy: null,
    });
    const prisma = {
      vacancy: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'vac',
          requiredSkills: ['SQL', 'React', 'Python', 'Go', 'Java', 'Excel'],
          status: 'Open',
          primaryRecruiterId: 'owner',
          assignments: [],
        }),
      },
      masterDataValue: { findMany: vi.fn().mockResolvedValue(library) },
      candidate: {
        findMany: vi.fn().mockResolvedValue([kept, dropped]),
        findFirst: vi.fn().mockResolvedValue({ id: 'c-kept', organizationId: 'org', skills: profileSkills }),
      },
      candidateSkill: {
        findMany: vi.fn().mockResolvedValue([
          { skill: { id: 'sk-sql', name: 'SQL', status: 'Active', metadata: null }, evidence: [listedEvidence('ev-sql', 'CV_TEXT')] },
          { skill: { id: 'sk-react', name: 'React', status: 'Active', metadata: null }, evidence: [listedEvidence('ev-react', 'MANUAL')] },
          { skill: { id: 'sk-py', name: 'Python', status: 'Active', metadata: null }, evidence: [listedEvidence('ev-py', 'SCORECARD')] },
          { skill: { id: 'sk-go', name: 'Go', status: 'Active', metadata: null }, evidence: [listedEvidence('ev-go', 'SCREENING_NOTE')] },
          { skill: { id: 'sk-java', name: 'Java', status: 'Active', metadata: null }, evidence: [] },
          { skill: { id: 'sk-excel', name: 'Excel', status: 'Active', metadata: null }, evidence: [] },
        ]),
      },
    };
    const svc = new MatchingService(prisma as never, { hasPermission: vi.fn().mockResolvedValue(false) } as never);

    const res = await svc.suggestions(owner, 'vac');

    expect(prisma.candidate.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({ skills: true }),
    }));
    expect(res.suggestions.map((item) => item.candidate.id)).toEqual(['c-kept']);
    expect(res.suggestions[0].matchedSkills.map((item) => [item.skill.name, item.hasEvidence])).toEqual([
      ['SQL', true],
      ['Python', true],
      ['Go', true],
      ['Excel', false],
    ]);
    expect(res.suggestions[0].missingSkills.map((item) => item.name)).toEqual(['React', 'Java']);

    const listed = await svc.listCandidateSkills('org', 'c-kept');
    expect(prisma.candidate.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      select: { id: true, organizationId: true, skills: true },
    }));
    expect(listed.map((item) => item.skill.name)).toEqual(['SQL', 'Python', 'Go', 'Excel']);
  });
});
