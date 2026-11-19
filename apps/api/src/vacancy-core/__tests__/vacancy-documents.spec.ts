import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser, JdCriteriaDefinition } from '@recruitflow/contracts';
import { JdParserService } from '../jd-parser.service';
import { VacancyDocumentsService } from '../vacancy-documents.service';

describe('VacancyDocumentsService', () => {
  let service: VacancyDocumentsService;
  type Spy = ReturnType<typeof vi.fn>;
  let mockPrisma: {
    vacancy: { findFirst: Spy; update: Spy };
    vacancyRequest: { findFirst: Spy; update: Spy };
    vacancyDocument: { create: Spy };
  };
  let mockStorage: { put: Spy };
  let jdParser: JdParserService;
  let mockAccessControl: Record<string, never>;

  const mockUser: AuthUser = {
    userId: 'user-recruiter-1',
    organizationId: 'org-1',
    role: 'Recruiter',
    permissions: ['VACANCY_MANAGE', 'VACANCY_VIEW'],
  } as unknown as AuthUser;

  beforeEach(() => {
    mockPrisma = {
      vacancy: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      vacancyRequest: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      vacancyDocument: {
        create: vi.fn(),
      },
    };

    mockStorage = {
      put: vi.fn().mockResolvedValue({
        storageKey: 'org-1/vac-1/sample-jd.txt',
        provider: 'local-private',
      }),
    };

    jdParser = new JdParserService();
    mockAccessControl = {};

    service = new VacancyDocumentsService(
      mockPrisma as never,
      mockStorage as never,
      jdParser,
      mockAccessControl as never,
    );
  });

  describe('uploadVacancyJd', () => {
    it('throws NotFoundException when job is not found', async () => {
      mockPrisma.vacancy.findFirst.mockResolvedValue(null);

      await expect(
        service.uploadVacancyJd(
          'org-1',
          'vac-404',
          { originalname: 'jd.txt', mimetype: 'text/plain', size: 100, buffer: Buffer.from('hello') },
          mockUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('uploads JD text file, parses structured criteria, and updates vacancy', async () => {
      mockPrisma.vacancy.findFirst.mockResolvedValue({
        id: 'vac-1',
        vacancyCode: 'JOB-100',
        requiredSkills: ['Patient Care'],
        status: 'Open',
      });

      mockPrisma.vacancyDocument.create.mockResolvedValue({
        id: 'doc-1',
        vacancyId: 'vac-1',
        documentType: 'JOB_DESCRIPTION',
        fileName: 'jd.txt',
        fileSize: 150,
        mimeType: 'text/plain',
        parserStatus: 'Completed',
        extractionText: 'Requires at least 5 years experience. Must have BLS, ACLS.',
        uploadedBy: { displayName: 'Sarah Ahmed' },
        createdAt: new Date('2026-11-17T12:00:00Z'),
      });

      mockPrisma.vacancy.update.mockResolvedValue({});

      const jdContent = `
Requirements:
- Minimum 5 years experience
- Must have: Patient Care, BLS, ACLS
- Nice to have: ICU
`;

      const result = await service.uploadVacancyJd(
        'org-1',
        'vac-1',
        { originalname: 'jd.txt', mimetype: 'text/plain', size: jdContent.length, buffer: Buffer.from(jdContent) },
        mockUser,
      );

      expect(result.document.id).toBe('doc-1');
      expect(result.criteria.minExperienceYears).toBe(5);
      expect(result.criteria.mustHaveSkills.map((s) => s.name)).toContain('BLS');
      expect(result.criteria.mustHaveSkills.map((s) => s.name)).toContain('ACLS');

      expect(mockStorage.put).toHaveBeenCalledWith('org-1', 'vac-1', 'jd.txt', expect.any(Buffer));
      expect(mockPrisma.vacancy.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'vac-1' },
          data: expect.objectContaining({
            minExperienceYears: 5,
            requiredSkills: expect.arrayContaining(['Patient Care', 'BLS', 'ACLS']),
          }),
        }),
      );
    });
  });

  describe('updateVacancyCriteria', () => {
    it('updates criteria and locks it with recruiter identity and timestamp', async () => {
      const initialCriteria: JdCriteriaDefinition = {
        version: 1,
        isLocked: false,
        minExperienceYears: 3,
        educationLevels: [],
        languages: [],
        mustHaveSkills: [{ id: 'm1', name: 'Clinical Documentation' }],
        niceToHaveSkills: [],
        knockoutRules: [],
        weights: { skills: 50, experience: 30, education: 10, languages: 10 },
      };

      mockPrisma.vacancy.findFirst.mockResolvedValue({
        id: 'vac-1',
        requiredSkills: ['Clinical Documentation'],
        jdCriteria: initialCriteria,
      });

      mockPrisma.vacancy.update.mockResolvedValue({});

      const updated = await service.updateVacancyCriteria(
        'org-1',
        'vac-1',
        {
          isLocked: true,
          weights: { skills: 60, experience: 20, education: 10, languages: 10 },
          minExperienceYears: 4,
          mustHaveSkills: [
            { id: 'm1', name: 'Clinical Documentation' },
            { id: 'm2', name: 'Infection Control' },
          ],
        },
        mockUser,
      );

      expect(updated.version).toBe(2);
      expect(updated.isLocked).toBe(true);
      expect(updated.lockedById).toBe('user-recruiter-1');
      expect(updated.lockedAt).toBeDefined();
      expect(updated.weights.skills).toBe(60);
      expect(updated.minExperienceYears).toBe(4);
      expect(updated.mustHaveSkills.map((s) => s.name)).toContain('Infection Control');

      expect(mockPrisma.vacancy.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'vac-1' },
          data: expect.objectContaining({
            minExperienceYears: 4,
            requiredSkills: expect.arrayContaining(['Clinical Documentation', 'Infection Control']),
          }),
        }),
      );
    });
  });

  describe('getVacancyJd', () => {
    it('returns nulls when job has no uploaded JD document or criteria', async () => {
      mockPrisma.vacancy.findFirst.mockResolvedValue({
        id: 'vac-empty',
        jdCriteria: null,
        documents: [],
      });

      const res = await service.getVacancyJd('org-1', 'vac-empty');
      expect(res.document).toBeNull();
      expect(res.criteria).toBeNull();
    });

    it('returns the latest JD document and structured criteria when present', async () => {
      const mockDoc = {
        id: 'doc-99',
        vacancyId: 'vac-1',
        documentType: 'JOB_DESCRIPTION',
        fileName: 'senior_nurse_jd.pdf',
        fileSize: 45000,
        mimeType: 'application/pdf',
        parserStatus: 'Completed',
        extractionText: 'Parsed text',
        uploadedBy: { displayName: 'Dr. Recruiter' },
        createdAt: new Date('2026-11-17T14:00:00Z'),
      };

      const mockCriteria = {
        version: 2,
        isLocked: true,
        mustHaveSkills: [{ id: 'm1', name: 'ICU' }],
      };

      mockPrisma.vacancy.findFirst.mockResolvedValue({
        id: 'vac-1',
        jdCriteria: mockCriteria,
        documents: [mockDoc],
      });

      const res = await service.getVacancyJd('org-1', 'vac-1');
      expect(res.document?.id).toBe('doc-99');
      expect(res.document?.uploadedByName).toBe('Dr. Recruiter');
      expect(res.criteria?.isLocked).toBe(true);
      expect(res.criteria?.mustHaveSkills[0].name).toBe('ICU');
    });
  });
});
