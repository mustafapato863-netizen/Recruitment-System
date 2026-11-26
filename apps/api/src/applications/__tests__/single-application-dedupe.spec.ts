import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../database/prisma.service';
import type { AccessControlService } from '../../access-control/access-control.service';
import type { EmailOutboxService } from '../../email/email-outbox.service';
import type { EmailTemplatesService } from '../../email-templates/email-templates.service';
import { ApplicationsService } from '../applications.service';
import { CandidatesService } from '../../candidates/candidates.service';

const ORG_ID = 'org-1';

describe('Ticket 09 — single application per candidate per vacancy, concurrency, and identity conflicts', () => {
  it('returns 409 APPLICATION_EXISTS with existing applicationId and stage when candidate already applied (including closed)', async () => {
    const prisma = {
      vacancy: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'vac-1',
          organizationId: ORG_ID,
          vacancyCode: 'VAC-001',
          status: 'Open',
          primaryRecruiterId: 'rec-1',
          assignments: [{ id: 'assign-1' }],
        }),
      },
      candidate: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'cand-1',
          organizationId: ORG_ID,
          firstName: 'Nour',
          lastName: 'Adel',
          source: 'CV import',
        }),
      },
      application: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'app-closed-1',
          applicationCode: 'APP-2026-010',
          stage: 'Rejected',
        }),
      },
    };
    const service = new ApplicationsService(
      prisma as unknown as PrismaService,
      {} as EmailOutboxService,
      {} as EmailTemplatesService,
      {} as AccessControlService,
    );

    await expect(
      service.createApplication(ORG_ID, { vacancyId: 'vac-1', candidateId: 'cand-1' }),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        code: 'APPLICATION_EXISTS',
        details: { applicationId: 'app-closed-1', applicationCode: 'APP-2026-010', stage: 'Rejected' },
      },
    });
  });

  it('handles simultaneous createApplication race (Prisma P2002) cleanly as 409 APPLICATION_EXISTS', async () => {
    let findCalls = 0;
    const prisma = {
      vacancy: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'vac-1',
          organizationId: ORG_ID,
          vacancyCode: 'VAC-001',
          status: 'Open',
          primaryRecruiterId: 'rec-1',
          assignments: [{ id: 'assign-1' }],
        }),
      },
      candidate: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'cand-1',
          organizationId: ORG_ID,
          firstName: 'Nour',
          lastName: 'Adel',
          source: 'CV import',
        }),
      },
      application: {
        findUnique: vi.fn().mockImplementation(async () => {
          findCalls += 1;
          return findCalls === 1
            ? null
            : { id: 'app-winner', applicationCode: 'APP-2026-011', stage: 'Applied' };
        }),
      },
      codeSequence: {
        upsert: vi.fn().mockResolvedValue({ lastIssued: 12 }),
      },
      $transaction: vi.fn().mockRejectedValue(Object.assign(new Error('Unique constraint'), { code: 'P2002' })),
    };
    const service = new ApplicationsService(
      prisma as unknown as PrismaService,
      {} as EmailOutboxService,
      {} as EmailTemplatesService,
      {} as AccessControlService,
    );

    await expect(
      service.createApplication(ORG_ID, { vacancyId: 'vac-1', candidateId: 'cand-1' }),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        code: 'APPLICATION_EXISTS',
        details: { applicationId: 'app-winner', applicationCode: 'APP-2026-011', stage: 'Applied' },
      },
    });
  });

  it('rejects candidate creation with 409 IDENTITY_CONFLICT when email matches person A and phone matches person B', async () => {
    const prisma = {
      candidate: {
        findFirst: vi.fn().mockImplementation(async (args: { where: { OR?: unknown[]; phoneNormalized?: string } }) => {
          if (args.where.OR) return { id: 'cand-a', candidateCode: 'CND-001', email: 'a@example.com' };
          if (args.where.phoneNormalized) return { id: 'cand-b', candidateCode: 'CND-002', phone: '+966501112233' };
          return null;
        }),
      },
    };
    const service = new CandidatesService(prisma as unknown as PrismaService);

    await expect(
      service.createCandidate(ORG_ID, {
        firstName: 'Conflict',
        lastName: 'Case',
        email: 'a@example.com',
        phone: '+966501112233',
      }),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        code: 'IDENTITY_CONFLICT',
        details: { emailCandidateId: 'cand-a', phoneCandidateId: 'cand-b' },
      },
    });
  });

  it('maps simultaneous candidate create P2002 race cleanly to 409 CANDIDATE_EXISTS', async () => {
    let lookedUp = 0;
    const prisma = {
      candidate: {
        findFirst: vi.fn().mockImplementation(async () => {
          lookedUp += 1;
          return lookedUp <= 1 ? null : { id: 'cand-raced', candidateCode: 'CND-099' };
        }),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockRejectedValue(Object.assign(new Error('Unique constraint'), { code: 'P2002' })),
      },
      codeSequence: {
        upsert: vi.fn().mockResolvedValue({ lastIssued: 99 }),
      },
    };
    const service = new CandidatesService(prisma as unknown as PrismaService);

    await expect(
      service.createCandidate(ORG_ID, {
        firstName: 'Race',
        lastName: 'Upload',
        email: 'race@example.com',
      }),
    ).rejects.toThrow(ConflictException);
  });
});
