import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sweepStaleApplicants, sweepConsentExpiry } from '../sweepers';
import type { PrismaClient } from '@recruitflow/database';

type MockFn = ReturnType<typeof vi.fn>;

interface MockSweeperPrisma {
  application: { findMany: MockFn };
  applicationNote: { findFirst: MockFn; create: MockFn };
  candidateDocument: { updateMany: MockFn };
}

describe('Worker Sweepers', () => {
  let mockPrisma: MockSweeperPrisma;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = {
      application: {
        findMany: vi.fn(),
      },
      applicationNote: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      candidateDocument: {
        updateMany: vi.fn(),
      },
    };
  });

  describe('sweepStaleApplicants', () => {
    it('creates [Automation] note for applications that have been stale >7 days', async () => {
      const staleApp = {
        id: 'app-1',
        organizationId: 'org-1',
        stage: 'Screening',
        updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        candidate: { firstName: 'Khalid', lastName: 'Al-Harbi' },
        vacancy: { position: { title: 'Registered Nurse' } },
      };

      mockPrisma.application.findMany.mockResolvedValue([staleApp]);
      mockPrisma.applicationNote.findFirst.mockResolvedValue(null); // No recent nudge
      mockPrisma.applicationNote.create.mockResolvedValue({ id: 'note-1' });

      const nudges = await sweepStaleApplicants(mockPrisma as PrismaClient);

      expect(nudges).toBe(1);
      expect(mockPrisma.applicationNote.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'org-1',
          applicationId: 'app-1',
          authorId: null,
          content: expect.stringContaining('[Automation] Stale applicant alert: "Khalid Al-Harbi"'),
        }),
      });
    });

    it('skips applications that already had a nudge within 24 hours (idempotent)', async () => {
      const staleApp = {
        id: 'app-2',
        organizationId: 'org-1',
        stage: 'Interview',
        updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        candidate: { firstName: 'Fatima', lastName: 'Zahra' },
        vacancy: { position: { title: 'Radiologist' } },
      };

      mockPrisma.application.findMany.mockResolvedValue([staleApp]);
      // Recent nudge found
      mockPrisma.applicationNote.findFirst.mockResolvedValue({ id: 'existing-note' });

      const nudges = await sweepStaleApplicants(mockPrisma as PrismaClient);

      expect(nudges).toBe(0);
      expect(mockPrisma.applicationNote.create).not.toHaveBeenCalled();
    });

    it('returns 0 when no stale applications exist', async () => {
      mockPrisma.application.findMany.mockResolvedValue([]);
      const nudges = await sweepStaleApplicants(mockPrisma as PrismaClient);
      expect(nudges).toBe(0);
      expect(mockPrisma.applicationNote.create).not.toHaveBeenCalled();
    });
  });

  describe('sweepConsentExpiry', () => {
    it('marks expired candidate documents as Expired', async () => {
      mockPrisma.candidateDocument.updateMany.mockResolvedValue({ count: 3 });

      const expiries = await sweepConsentExpiry(mockPrisma as PrismaClient);

      expect(expiries).toBe(3);
      expect(mockPrisma.candidateDocument.updateMany).toHaveBeenCalledWith({
        where: {
          retentionExpiresAt: expect.objectContaining({ lte: expect.any(Date) }),
          consentStatus: { not: 'Expired' },
          deletedAt: null,
        },
        data: { consentStatus: 'Expired' },
      });
    });
  });
});
