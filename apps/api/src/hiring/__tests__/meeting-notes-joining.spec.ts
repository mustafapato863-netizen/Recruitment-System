import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@recruitflow/contracts';
import type { PrismaService } from '../../database/prisma.service';
import type { AuditService } from '../../audit/audit.service';
import { HiringService } from '../hiring.service';
import { caseFingerprint } from '../joining-policy';

// Meeting notes 2026-11-25 (items 4 + 6): the accepted offer's start date becomes
// the expected joining date; joining sets the monthly reporting cycle and prompts
// the hiring manager once to set the joiner's initial activity targets.
const ORG = '10000000-0000-4000-8000-000000000001';
const user: AuthUser = { userId: 'recruiter-1', organizationId: ORG, tokenVersion: 1, roleCodes: ['RECRUITER'] };

const CHECKS = [
  { type: 'ID', verified: true, expiryDate: null, documentId: null },
  { type: 'CONTRACT', verified: true, expiryDate: null, documentId: null },
  { type: 'SCFHS_LICENCE', verified: true, expiryDate: null, documentId: null },
];
const SNAPSHOT = { profile: 'legacy' as const, checks: ['ID', 'CONTRACT', 'SCFHS_LICENCE'] as const };
const FINGERPRINT = caseFingerprint({ snapshot: SNAPSHOT, acceptedOfferVersionId: 'offer-v1', checks: CHECKS });

function loadedApplication() {
  return {
    id: 'app-1', organizationId: ORG, primaryRecruiterId: 'recruiter-1',
    vacancy: { approvedHeadcount: 1, joinedHeadcount: 0, primaryRecruiterId: 'recruiter-1', position: { metadata: null } },
    offers: [{ versions: [{ id: 'offer-v1', status: 'Accepted', versionNumber: 1 }] }],
    hiringCase: {
      ownerUserId: 'recruiter-1', status: 'Awaiting Joining', requirementSnapshot: null,
      approvalFingerprint: FINGERPRINT,
      approvals: [{ status: 'Approved', roleCode: 'FINAL_HIRING_APPROVER', invalidatedAt: null, decisionFingerprint: FINGERPRINT }],
    },
    joiningChecks: CHECKS,
    interviews: [],
  };
}

function hiringCaseRow(status = 'Awaiting Joining') {
  return {
    id: 'case-1', status, applicationId: 'app-1', ownerUserId: 'recruiter-1',
    application: {
      primaryRecruiterId: 'recruiter-1', stage: 'Pre-Hire', vacancyId: 'vac-1',
      candidateId: 'cand-1', vacancy: { primaryRecruiterId: 'recruiter-1', vacancyRequestId: 'req-1' },
    },
  };
}

describe('meeting notes items 4 + 6 — expected joining date and reporting cycle', () => {
  it('copies the accepted offer start date onto the hiring case at creation', async () => {
    const tx = {
      joiningCheck: { findMany: vi.fn().mockResolvedValue([]) },
      hiringCase: { create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'case-1', ...data })) },
      application: { update: vi.fn().mockResolvedValue({}) },
      applicationStatusHistory: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      offer: {
        findFirst: vi.fn().mockImplementation(async (args: { select?: unknown }) =>
          args.select
            ? { applicationId: 'app-1' }
            : {
                id: 'offer-1', applicationId: 'app-1', status: 'Accepted', stage: 'Offer',
                application: { vacancy: { position: { metadata: null } } },
                versions: [{ proposedJoiningDate: new Date('2026-12-15T00:00:00.000Z') }],
              }),
      },
      hiringCase: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    const audit = { log: vi.fn().mockResolvedValue(undefined) };
    const service = new HiringService(prisma as unknown as PrismaService, audit as unknown as AuditService, undefined, undefined);
    const created = await service.createHiringCase(ORG, { offerId: 'offer-1' }, user);
    expect(created.plannedJoiningDate).toEqual(new Date('2026-12-15T00:00:00.000Z'));
  });

  it('leaves the expected joining date unset when the accepted version has no start date', async () => {
    const tx = {
      joiningCheck: { findMany: vi.fn().mockResolvedValue([]) },
      hiringCase: { create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'case-1', ...data })) },
      application: { update: vi.fn().mockResolvedValue({}) },
      applicationStatusHistory: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      offer: {
        findFirst: vi.fn().mockImplementation(async (args: { select?: unknown }) =>
          args.select
            ? { applicationId: 'app-1' }
            : {
                id: 'offer-1', applicationId: 'app-1', status: 'Accepted', stage: 'Offer',
                application: { vacancy: { position: { metadata: null } } },
                versions: [{ proposedJoiningDate: null }],
              }),
      },
      hiringCase: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    const audit = { log: vi.fn().mockResolvedValue(undefined) };
    const service = new HiringService(prisma as unknown as PrismaService, audit as unknown as AuditService, undefined, undefined);
    const created = await service.createHiringCase(ORG, { offerId: 'offer-1' }, user);
    expect(created.plannedJoiningDate).toBeNull();
  });

  it('sets the monthly reporting cycle and creates one manager task when joining is recorded', async () => {
    const app = loadedApplication();
    const tx = {
      application: {
        findFirst: vi.fn().mockResolvedValue(app),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      vacancy: {
        findUnique: vi.fn().mockResolvedValue({ id: 'vac-1', status: 'Filled', joinedHeadcount: 1, approvedHeadcount: 1 }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      hiringCase: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      vacancyRequest: { findUnique: vi.fn().mockResolvedValue({ requesterId: 'manager-1' }) },
      candidate: { findUnique: vi.fn().mockResolvedValue({ firstName: 'Sara', lastName: 'Ali' }) },
      task: { create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'task-1', ...data })) },
      applicationStatusHistory: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue({
          userRoles: [{ role: { code: 'RECRUITER', permissions: [{ permission: { code: 'RECORD_ACTUAL_JOINING' } }] } }],
        }),
      },
      hiringCase: { findFirst: vi.fn().mockResolvedValue(hiringCaseRow()) },
      application: { findFirst: vi.fn().mockResolvedValue(app) },
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    const audit = { log: vi.fn().mockResolvedValue(undefined) };
    const service = new HiringService(prisma as unknown as PrismaService, audit as unknown as AuditService, undefined, undefined);
    const result = await service.confirmJoining(ORG, 'case-1', { status: 'Joined', actualJoiningDate: '2026-12-01' }, user);
    expect(result).toMatchObject({ success: true });
    expect(tx.hiringCase.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'Joined', reportingCycle: 'monthly' }),
    }));
    expect(tx.task.create).toHaveBeenCalledTimes(1);
    expect(tx.task.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'NewJoinerTargets', assigneeUserId: 'manager-1', entityType: 'HiringCase', entityId: 'case-1',
        title: 'Set initial activity targets for Sara Ali',
      }),
    }));
  });

  it('does not create a second manager task when joining is recorded twice', async () => {
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue({
          userRoles: [{ role: { code: 'RECRUITER', permissions: [{ permission: { code: 'RECORD_ACTUAL_JOINING' } }] } }],
        }),
      },
      hiringCase: { findFirst: vi.fn().mockResolvedValue(hiringCaseRow('Joined')) },
      $transaction: vi.fn(),
    };
    const audit = { log: vi.fn().mockResolvedValue(undefined) };
    const service = new HiringService(prisma as unknown as PrismaService, audit as unknown as AuditService, undefined, undefined);
    const result = await service.confirmJoining(ORG, 'case-1', { status: 'Joined', actualJoiningDate: '2026-12-01' }, user);
    expect(result).toEqual({ success: true, alreadyJoined: true });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('lets a recruiter edit the expected joining date without recording a joining status', async () => {
    const tx = {
      hiringCase: { update: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue({
          userRoles: [{ role: { code: 'RECRUITER', permissions: [{ permission: { code: 'RECORD_ACTUAL_JOINING' } }] } }],
        }),
      },
      hiringCase: { findFirst: vi.fn().mockResolvedValue(hiringCaseRow()) },
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    const audit = { log: vi.fn().mockResolvedValue(undefined) };
    const service = new HiringService(prisma as unknown as PrismaService, audit as unknown as AuditService, undefined, undefined);
    await service.confirmJoining(ORG, 'case-1', { status: 'Postponed', plannedJoiningDate: '2026-12-20' }, user);
    expect(tx.hiringCase.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'Postponed', plannedJoiningDate: new Date('2026-12-20') }),
    }));
  });
});
