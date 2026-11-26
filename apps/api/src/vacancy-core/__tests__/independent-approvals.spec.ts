import { ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthUser, VacancyRequest } from '@recruitflow/contracts';
import type { PrismaService } from '../../database/prisma.service';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { AuditService } from '../../audit/audit.service';
import type { AccessControlService } from '../../access-control/access-control.service';
import type { UserPermissionsService } from '../../common/user-permissions.service';
import type { VacancyCoreRepository } from '../vacancy-core.repository';
import { VacancyCoreService } from '../vacancy-core.service';
import { OffersService } from '../../offers/offers.service';
import { OfferDecisionService } from '../../manager-decision/offer-decision.service';
import { HiringService } from '../../hiring/hiring.service';

const ORG = '10000000-0000-4000-8000-000000000001';
const now = '2026-11-26T09:00:00.000Z';

function makeRequest(overrides: Partial<VacancyRequest> = {}): VacancyRequest {
  return {
    id: 'req-1',
    organizationId: ORG,
    branchId: 'branch-1',
    positionId: 'pos-1',
    requesterId: 'emp-1',
    submittedById: null,
    requestCode: 'VR-2026-101',
    status: 'Draft',
    requestedHeadcount: 2,
    employmentType: 'Full-time',
    openingType: 'New position',
    replacedEmployeeId: null,
    nationalityPreference: [],
    reason: 'Team expansion',
    budgetStatus: 'Budgeted',
    budgetMin: 12000,
    budgetMax: 16000,
    budgetCurrency: 'AED',
    budgetPeriod: 'Monthly',
    criticality: 'Normal',
    targetStartDate: null,
    targetFillDate: '2026-12-30',
    recruitmentTiming: 'After Approval',
    plannedOpenDate: null,
    justification: 'Expansion',
    jobSummary: 'Nurse',
    description: null,
    responsibilities: null,
    qualifications: null,
    benefits: null,
    submittedAt: null,
    approvalRevision: 1,
    approvals: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeVacancyHarness(
  initial: VacancyRequest,
  users: Record<string, { id: string; managerId: string | null; status: string }>,
  opts?: { updateManyCount?: () => number },
) {
  let stored = structuredClone(initial);
  const repository = {
    getRequest: vi.fn(async () => structuredClone(stored)),
    saveRequest: vi.fn(async (next: VacancyRequest, pendingApprovalId?: string) => {
      if (pendingApprovalId && opts?.updateManyCount?.() === 0) throw new ConflictException();
      stored = structuredClone(next);
      return structuredClone(stored);
    }),
  };
  const notify = vi.fn().mockResolvedValue(undefined);
  const prisma = {
    user: {
      findFirst: vi.fn(async (args: { where: { id?: string; status?: string } }) => {
        const row = args.where.id ? users[args.where.id] : undefined;
        if (!row) return null;
        if (args.where.status && row.status !== args.where.status) return null;
        return row;
      }),
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
  const service = new VacancyCoreService(
    repository as unknown as VacancyCoreRepository,
    prisma as unknown as PrismaService,
    { create: notify } as unknown as NotificationsService,
  );
  return { service, repository, notify, getStored: () => stored };
}

describe('Ticket 16 — Independent approvals (requisitions, offers, hiring)', () => {
  it('routes a submitted requisition to the responsible manager and notifies only that manager', async () => {
    const { service, notify } = makeVacancyHarness(makeRequest(), {
      'emp-1': { id: 'emp-1', managerId: 'mgr-1', status: 'Active' },
      'mgr-1': { id: 'mgr-1', managerId: null, status: 'Active' },
    });

    const submitted = await service.submitRequest('req-1', ORG, 'emp-1');
    expect(submitted.status).toBe('Pending Approval');
    expect(submitted.submittedById).toBe('emp-1');
    expect(submitted.approvals).toHaveLength(1);
    expect(submitted.approvals[0]?.assigneeUserId).toBe('mgr-1');
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ recipientUserId: 'mgr-1' }));
  });

  it('rejects submission with APPROVAL_MANAGER_MISSING when no active manager is assigned', async () => {
    const { service } = makeVacancyHarness(makeRequest(), {
      'emp-1': { id: 'emp-1', managerId: null, status: 'Active' },
    });

    await expect(service.submitRequest('req-1', ORG, 'emp-1')).rejects.toMatchObject({
      response: { code: 'APPROVAL_MANAGER_MISSING' },
    });
  });

  it('blocks self-approval even when the submitter holds multiple roles including ADMINISTRATOR', async () => {
    const { service } = makeVacancyHarness(makeRequest(), {
      'emp-1': { id: 'emp-1', managerId: 'mgr-1', status: 'Active' },
      'mgr-1': { id: 'mgr-1', managerId: null, status: 'Active' },
    });
    await service.submitRequest('req-1', ORG, 'emp-1');

    await expect(
      service.approveRequest('req-1', ORG, 'emp-1', ['RECRUITER', 'HIRING_MANAGER', 'ADMINISTRATOR'], {}),
    ).rejects.toMatchObject({ response: { code: 'SELF_APPROVAL_FORBIDDEN' } });
  });

  it('blocks an out-of-team manager from viewing or deciding another manager’s assigned requisition', async () => {
    const { service } = makeVacancyHarness(makeRequest(), {
      'emp-1': { id: 'emp-1', managerId: 'mgr-1', status: 'Active' },
      'mgr-1': { id: 'mgr-1', managerId: null, status: 'Active' },
      'other-mgr': { id: 'other-mgr', managerId: null, status: 'Active' },
    });
    await service.submitRequest('req-1', ORG, 'emp-1');

    await expect(
      service.approveRequest('req-1', ORG, 'other-mgr', ['HIRING_MANAGER'], {}),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      service.getRequest(ORG, 'req-1', {
        userId: 'other-mgr',
        organizationId: ORG,
        tokenVersion: 1,
        roleCodes: ['HIRING_MANAGER'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('handles resubmission after Changes Requested on a new revision and prevents duplicate concurrent approval', async () => {
    let claimCalls = 0;
    const { service } = makeVacancyHarness(
      makeRequest(),
      {
        'emp-1': { id: 'emp-1', managerId: 'mgr-1', status: 'Active' },
        'mgr-1': { id: 'mgr-1', managerId: null, status: 'Active' },
      },
      { updateManyCount: () => (++claimCalls === 3 ? 0 : 1) },
    );

    await service.submitRequest('req-1', ORG, 'emp-1');
    const changed = await service.requestChanges('req-1', ORG, 'mgr-1', ['HIRING_MANAGER'], { comment: 'Update budget' });
    expect(changed.status).toBe('Changes Requested');

    const resubmitted = await service.submitRequest('req-1', ORG, 'emp-1');
    expect(resubmitted.approvalRevision).toBe(2);
    expect(resubmitted.approvals.filter((a) => a.revision === 2 && a.status === 'Pending')).toHaveLength(1);

    // First approval succeeds (claimCalls === 2)
    await service.approveRequest('req-1', ORG, 'mgr-1', ['HIRING_MANAGER'], {});
    // Simulated concurrent collision on claimCalls === 3 throws ConflictException
    await expect(
      service.approveRequest('req-1', ORG, 'hr-1', ['HR_MANAGER'], {}),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks self-approval on offers (both inbox and manager-decision) even for multi-role admins', async () => {
    const prisma = {
      offerApproval: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'ap-1',
          status: 'Pending',
          roleCode: 'OFFER_APPROVER',
          approverUserId: null,
          offerVersionId: 'v1',
          offerVersion: {
            id: 'v1',
            submittedById: 'emp-admin',
            offer: { id: 'o1', organizationId: ORG, currentVersionId: 'v1', applicationId: 'a1', offerCode: 'OFF-1' },
          },
        }),
      },
      application: { findUnique: vi.fn().mockResolvedValue({ primaryRecruiterId: 'emp-admin' }) },
    };
    const accessControl = {
      getApplicationReadVisibilityWhere: vi.fn().mockResolvedValue({ organizationId: ORG }),
    };
    const offers = new OffersService(
      prisma as unknown as PrismaService,
      { create: vi.fn() } as unknown as NotificationsService,
      accessControl as unknown as AccessControlService,
    );

    const multiRoleUser: AuthUser = {
      userId: 'emp-admin',
      organizationId: ORG,
      tokenVersion: 1,
      roleCodes: ['RECRUITER', 'HIRING_MANAGER', 'ADMINISTRATOR'],
    };

    await expect(
      offers.submitDecision(multiRoleUser, 'ap-1', { decision: 'Approve' }),
    ).rejects.toMatchObject({ response: { code: 'SELF_APPROVAL_FORBIDDEN' } });

    const decisionService = new OfferDecisionService(
      {
        offerVersion: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'v1',
            status: 'Pending Approval',
            submittedById: 'emp-admin',
            components: [],
            offer: {
              currentVersionId: 'v1',
              offerCode: 'OFF-1',
              application: {
                id: 'a1',
                primaryRecruiterId: 'emp-admin',
                vacancy: { id: 'vac-1', branchId: 'b1', branch: { name: 'Main' }, vacancyRequest: { gradeId: null, grade: null } },
              },
            },
          }),
        },
        vacancy: { findUnique: vi.fn().mockResolvedValue({ primaryRecruiterId: 'emp-admin', assignments: [] }) },
        vacancyAssignment: { findMany: vi.fn().mockResolvedValue([]) },
      } as unknown as PrismaService,
      { hasPermission: vi.fn().mockResolvedValue(true) } as unknown as UserPermissionsService,
      { create: vi.fn() } as unknown as NotificationsService,
    );

    await expect(
      decisionService.decide(multiRoleUser, 'o1', 'v1', { decision: 'Approve' }),
    ).rejects.toMatchObject({ response: { code: 'SELF_APPROVAL_FORBIDDEN' } });
  });

  it('blocks self-approval on final hiring cases even for multi-role admins and writes submit atomically', async () => {
    const tx = {
      hiringCase: { update: vi.fn().mockResolvedValue({ id: 'case-1', status: 'Pending Final Approval' }) },
      hiringCaseApproval: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'ap-1' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      hiringCase: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'case-1',
          status: 'Pending Compliance',
          applicationId: 'a1',
          ownerUserId: 'emp-admin',
          submittedById: 'emp-admin',
          complianceRequirements: [{ isRequired: true, status: 'Verified' }],
          approvals: [{ id: 'ap-1', roleCode: 'FINAL_HIRING_APPROVER', status: 'Pending', approverUserId: null }],
        }),
      },
      user: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({ managerId: 'mgr-1' })
          .mockResolvedValueOnce({ id: 'mgr-1' }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      application: { findUnique: vi.fn().mockResolvedValue({ primaryRecruiterId: 'emp-admin' }) },
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    const hiring = new HiringService(
      prisma as unknown as PrismaService,
      { log: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService,
    );
    const submitter: AuthUser = {
      userId: 'emp-admin',
      organizationId: ORG,
      tokenVersion: 1,
      roleCodes: ['RECRUITER', 'FINAL_HIRING_APPROVER', 'ADMINISTRATOR'],
    };

    const submitted = await hiring.submitForFinalApproval(ORG, 'case-1', submitter);
    expect(submitted.status).toBe('Pending Final Approval');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.hiringCaseApproval.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ approverUserId: 'mgr-1' }),
      }),
    );

    prisma.hiringCase.findFirst.mockResolvedValue({
      id: 'case-1',
      status: 'Pending Final Approval',
      applicationId: 'a1',
      ownerUserId: 'emp-admin',
      submittedById: 'emp-admin',
      approvals: [{ id: 'ap-1', roleCode: 'FINAL_HIRING_APPROVER', status: 'Pending', approverUserId: 'mgr-1' }],
    });

    await expect(
      hiring.decideFinalApproval(ORG, 'case-1', { decision: 'Approve' }, submitter),
    ).rejects.toMatchObject({ response: { code: 'SELF_APPROVAL_FORBIDDEN' } });
  });
});
