import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JdCriteriaDefinition } from '@recruitflow/contracts';
import { AtsScoringService } from '../ats-scoring.service';

describe('AtsScoringService', () => {
  let service: AtsScoringService;
  let mockPrisma: any;
  let mockPermissions: any;

  beforeEach(() => {
    mockPrisma = {
      application: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      candidate: {
        findFirst: vi.fn(),
      },
      vacancy: {
        findMany: vi.fn(),
      },
    };

    mockPermissions = {
      canViewSalary: vi.fn().mockResolvedValue(false),
    };

    service = new AtsScoringService(mockPrisma, mockPermissions);
  });

  describe('Anti-Bias & Pay Safety Sanitization', () => {
    it('strips protected personal attributes and salary/compensation from candidate inputs', () => {
      const sensitiveCandidate = {
        id: 'cand-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '+966500000000',
        currentCompany: 'Confidential Hospital',
        salary: { expected: 25000, currency: 'SAR' },
        compensation: { bonus: 5000 },
        experienceYears: 6,
        skills: ['Patient Care', 'ICU', 'Triage'],
      };

      const sanitized = service.sanitizeForAtsScoring(sensitiveCandidate);

      expect((sanitized as any).firstName).toBeUndefined();
      expect((sanitized as any).lastName).toBeUndefined();
      expect((sanitized as any).email).toBeUndefined();
      expect((sanitized as any).phone).toBeUndefined();
      expect((sanitized as any).salary).toBeUndefined();
      expect((sanitized as any).compensation).toBeUndefined();

      // Preserves legitimate qualifications
      expect(sanitized.id).toBe('cand-123');
      expect(sanitized.experienceYears).toBe(6);
      expect(sanitized.skills).toEqual(['Patient Care', 'ICU', 'Triage']);
    });
  });

  describe('evaluateApplicationAts', () => {
    it('throws NotFoundException when application does not exist', async () => {
      mockPrisma.application.findFirst.mockResolvedValue(null);

      await expect(
        service.evaluateApplicationAts('org-1', 'app-404'),
      ).rejects.toThrow(NotFoundException);
    });

    it('computes 0-100 score, must-have pass, missing keywords, and evidence snippets', async () => {
      const mockCriteria: JdCriteriaDefinition = {
        version: 1,
        isLocked: true,
        minExperienceYears: 4,
        educationLevels: ['BACHELORS'],
        languages: [{ language: 'English' }],
        workMode: 'On-site',
        mustHaveSkills: [
          { id: 'm1', name: 'TypeScript' },
          { id: 'm2', name: 'PostgreSQL' },
        ],
        niceToHaveSkills: [
          { id: 'n1', name: 'Docker' },
          { id: 'n2', name: 'Kubernetes' },
        ],
        knockoutRules: [
          { id: 'ko-1', field: 'experienceYears', operator: 'GTE', value: 4 },
        ],
        weights: { skills: 50, experience: 30, education: 10, languages: 10 },
      };

      const mockApp = {
        id: 'app-1',
        candidateId: 'cand-1',
        vacancyId: 'vac-1',
        candidate: {
          id: 'cand-1',
          experienceYears: 5,
          skills: ['TypeScript'], // has TypeScript, lacks PostgreSQL & Kubernetes
          skillLinks: [
            {
              skill: { id: 's1', name: 'TypeScript' },
              evidence: [
                { id: 'ev1', snippet: 'Lead developer building web APIs in TypeScript.', sourceType: 'CV_TEXT' },
              ],
            },
          ],
          documents: [
            {
              id: 'doc-1',
              fileName: 'resume.pdf',
              extractionText: '5 years of full stack development. Built microservices with Docker containers.',
            },
          ],
        },
        vacancy: {
          id: 'vac-1',
          vacancyCode: 'JOB-2026-001',
          requiredSkills: ['TypeScript', 'PostgreSQL'],
          minExperienceYears: 4,
          jdCriteria: mockCriteria,
        },
      };

      mockPrisma.application.findFirst.mockResolvedValue(mockApp);
      mockPrisma.application.update.mockResolvedValue(mockApp);

      const result = await service.evaluateApplicationAts('org-1', 'app-1');

      expect(result.applicationId).toBe('app-1');
      expect(result.atsKnockoutPass).toBe(true);
      expect(result.atsScore).toBeGreaterThan(0);
      expect(result.atsScore).toBeLessThanOrEqual(100);

      // Must have check: candidate has TypeScript, but lacks PostgreSQL
      expect(result.breakdown.mustHaveSkillsPassed).toBe(false);
      expect(result.breakdown.mustHaveMatchedCount).toBe(1);
      expect(result.breakdown.mustHaveTotalCount).toBe(2);
      expect(result.breakdown.missingKeywords).toContain('PostgreSQL');

      // Nice to have check: candidate has Docker in CV text snippet, lacks Kubernetes
      expect(result.breakdown.niceToHaveMatchedCount).toBe(1);
      expect(result.breakdown.niceToHaveTotalCount).toBe(2);
      expect(result.breakdown.missingKeywords).toContain('Kubernetes');

      // Evidence snippets attached
      const tsSkill = result.breakdown.skillBreakdown.find((s) => s.skillName === 'TypeScript');
      expect(tsSkill?.matched).toBe(true);
      expect(tsSkill?.evidenceSnippet).toContain('TypeScript');

      const dockerSkill = result.breakdown.skillBreakdown.find((s) => s.skillName === 'Docker');
      expect(dockerSkill?.matched).toBe(true);
      expect(dockerSkill?.evidenceSnippet).toContain('Docker');

      // Verified persistence call to Prisma
      expect(mockPrisma.application.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'app-1' },
          data: expect.objectContaining({
            atsScore: result.atsScore,
            atsKnockoutPass: true,
            atsVersion: 'v2-ats-1.1',
          }),
        }),
      );
    });

    it('enforces knockouts without auto-rejection: caps score at 49 and flags failure', async () => {
      const mockCriteria: JdCriteriaDefinition = {
        version: 1,
        isLocked: true,
        minExperienceYears: 7,
        educationLevels: [],
        languages: [],
        mustHaveSkills: [{ id: 'm1', name: 'Clinical Documentation' }],
        niceToHaveSkills: [],
        knockoutRules: [
          {
            id: 'ko-exp',
            field: 'experienceYears',
            operator: 'GTE',
            value: 7,
            failureMessage: 'Requires minimum 7 years clinical experience.',
          },
        ],
        weights: { skills: 50, experience: 30, education: 10, languages: 10 },
      };

      const mockApp = {
        id: 'app-2',
        candidateId: 'cand-2',
        vacancyId: 'vac-2',
        candidate: {
          id: 'cand-2',
          experienceYears: 2, // Less than 7 years required
          skills: ['Clinical Documentation'],
          skillLinks: [],
          documents: [{ id: 'd1', extractionText: '2 years as nurse doing Clinical Documentation' }],
        },
        vacancy: {
          id: 'vac-2',
          vacancyCode: 'JOB-2026-002',
          requiredSkills: ['Clinical Documentation'],
          minExperienceYears: 7,
          jdCriteria: mockCriteria,
        },
      };

      mockPrisma.application.findFirst.mockResolvedValue(mockApp);
      mockPrisma.application.update.mockResolvedValue(mockApp);

      const result = await service.evaluateApplicationAts('org-1', 'app-2');

      // Knockout failed
      expect(result.atsKnockoutPass).toBe(false);
      expect(result.breakdown.knockoutsPassed).toBe(false);
      expect(result.breakdown.knockoutFailures).toContain('Requires minimum 7 years clinical experience.');

      // Score is capped at 49.0 so recruiter sees the blocker clearly, but application is NOT deleted or auto-rejected
      expect(result.atsScore).toBeLessThanOrEqual(49.0);
    });
  });

    it('does not award unverified qualification points or count a self-reported skill as evidence', async () => {
      const criteria: JdCriteriaDefinition = {
        version: 1, isLocked: true, minExperienceYears: 5,
        educationLevels: ['BACHELORS'], languages: [{ language: 'English' }],
        mustHaveSkills: [{ id: 's1', name: 'ICU' }], niceToHaveSkills: [],
        knockoutRules: [{ id: 'd1', field: 'degree', operator: 'IN', value: ['BACHELORS'] }],
        weights: { skills: 50, experience: 30, education: 10, languages: 10 },
      };
      mockPrisma.application.findFirst.mockResolvedValue({
        id: 'app-review',
        candidate: {
          id: 'candidate-review', experienceYears: null, skills: ['ICU'],
          skillLinks: [], documents: [{ extractionText: 'Clinical work history available upon request.' }],
        },
        vacancy: {
          id: 'vac-review', vacancyCode: 'VAC-REV', requiredSkills: ['ICU'],
          minExperienceYears: 5, jdCriteria: criteria,
        },
      });
      mockPrisma.application.update.mockResolvedValue({});
      const result = await service.evaluateApplicationAts('org-1', 'app-review');

      expect(result.atsScore).toBe(0);
      expect(result.breakdown.mustHaveMatchedCount).toBe(0);
      expect(result.breakdown.manualReviewRequired).toEqual(expect.arrayContaining([
        expect.stringContaining('Education'),
        expect.stringContaining('Language'),
        expect.stringContaining('experience'),
      ]));
      expect(result.breakdown.experienceMatch.actualYears).toBeNull();
      expect(result.breakdown.educationMatch.passed).toBeNull();
      expect(result.breakdown.languagesMatch.passed).toBeNull();
      expect(result.atsKnockoutPass).toBe(true); // Unverified is not automatic rejection.
      expect(mockPrisma.application.update).toHaveBeenCalledTimes(1);
    });

  describe('getJobRecommendationsForCandidate', () => {
    it('ranks open jobs with highest score first and unapplied above applied', async () => {
      const mockCandidate = {
        id: 'cand-1',
        experienceYears: 5,
        skills: ['React', 'TypeScript', 'Node.js'],
        applications: [
          { id: 'app-applied', vacancyId: 'vac-applied', stage: 'Application' },
        ],
        documents: [{ extractionText: 'Expert in React, TypeScript and Node.js with 5 years experience.' }],
      };

      const mockVacancies = [
        {
          id: 'vac-applied',
          vacancyCode: 'VAC-001',
          department: 'Engineering',
          position: { title: 'Senior Frontend Engineer' },
          branch: { name: 'Riyadh' },
          minExperienceYears: 4,
          requiredSkills: ['React', 'TypeScript'],
          jdCriteria: null,
          createdAt: new Date(),
        },
        {
          id: 'vac-unapplied-high',
          vacancyCode: 'VAC-002',
          department: 'Engineering',
          position: { title: 'Lead Fullstack Developer' },
          branch: { name: 'Jeddah' },
          minExperienceYears: 5,
          requiredSkills: ['React', 'TypeScript', 'Node.js'],
          jdCriteria: null,
          createdAt: new Date(),
        },
        {
          id: 'vac-unapplied-low',
          vacancyCode: 'VAC-003',
          department: 'Data',
          position: { title: 'Data Scientist' },
          branch: { name: 'Dammam' },
          minExperienceYears: 8,
          requiredSkills: ['Python', 'Machine Learning', 'TensorFlow'],
          jdCriteria: null,
          createdAt: new Date(),
        },
      ];

      mockPrisma.candidate.findFirst.mockResolvedValue(mockCandidate);
      mockPrisma.vacancy.findMany.mockResolvedValue(mockVacancies);

      const recs = await service.getJobRecommendationsForCandidate('org-1', 'cand-1');

      expect(recs.length).toBe(3);

      // Top recommendation should be the unapplied high-match job
      expect(recs[0].vacancyId).toBe('vac-unapplied-high');
      expect(recs[0].alreadyApplied).toBe(false);
      expect(recs[0].atsScore).toBeGreaterThan(80);

      // Applied job should be ranked lower even if score is high
      const appliedRec = recs.find((r) => r.vacancyId === 'vac-applied');
      expect(appliedRec?.alreadyApplied).toBe(true);
      expect(appliedRec?.existingApplicationId).toBe('app-applied');

      // Low match job has lower score
      const lowRec = recs.find((r) => r.vacancyId === 'vac-unapplied-low');
      expect(lowRec?.atsScore).toBeLessThan(recs[0].atsScore);
    });
  });
});
