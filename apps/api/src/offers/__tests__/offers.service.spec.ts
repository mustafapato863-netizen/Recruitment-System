import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@recruitflow/contracts';
import type { PrismaService } from '../../database/prisma.service';
import type { AccessControlService } from '../../access-control/access-control.service';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { UserPermissionsService } from '../../common/user-permissions.service';
import { OffersService } from '../offers.service';

const ORG = '10000000-0000-4000-8000-000000000001';

function actor(roleCodes: string[], userId = 'u-submitter'): AuthUser {
  return { userId, organizationId: ORG, tokenVersion: 1, roleCodes };
}

function harness(permissions?: Pick<UserPermissionsService, 'hasPermission'>) {
  const notifications = { create: vi.fn().mockResolvedValue(undefined) };
  const tx = {
    offerVersion: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), update: vi.fn() },
    offerApproval: { create: vi.fn(), update: vi.fn(), count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
    offer: { update: vi.fn() },
  };
  const prisma = {
    offer: { findFirst: vi.fn() },
    offerVersion: { findUnique: vi.fn(), findFirst: vi.fn() },
    offerApproval: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn() },
    application: { findFirst: vi.fn(), findUnique: vi.fn() },
    user: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn() },
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const accessControl = {
    getApplicationVisibilityWhere: vi.fn().mockResolvedValue({ organizationId: ORG }),
    getApplicationReadVisibilityWhere: vi.fn().mockResolvedValue({ organizationId: ORG }),
  };
  const service = new OffersService(
    prisma as unknown as PrismaService,
    notifications as unknown as NotificationsService,
    accessControl as unknown as AccessControlService,
    undefined,
    permissions as UserPermissionsService | undefined,
  );
  return { service, prisma, notifications, tx };
}

describe('OffersService three-role approvals', () => {
  it('notifies hiring managers, administrators, OFFER_APPROVE holders, and the job owner manager, once, excluding the submitter', async () => {
    const { service, prisma, notifications } = harness();
    prisma.offer.findFirst.mockResolvedValue({
      id: 'o1', organizationId: ORG, applicationId: 'a1', offerCode: 'OFF-9', currentVersionId: 'v1', status: 'Draft',
    });
    prisma.offerVersion.findUnique.mockResolvedValue({ id: 'v1', versionNumber: 3, status: 'Draft' });
    prisma.user.findMany.mockResolvedValue([
      { id: 'u-submitter' },
      { id: 'u-manager' },
      { id: 'u-admin' },
      { id: 'u-manager' },
    ]);
    prisma.application.findFirst.mockResolvedValue({ vacancy: { primaryRecruiter: { managerId: 'u-boss' } } });
    prisma.user.findFirst.mockResolvedValue({ id: 'u-boss' });

    await service.submitOffer(actor(['RECRUITER']), 'o1');

    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        organizationId: ORG,
        status: 'Active',
        userRoles: expect.objectContaining({
          some: expect.objectContaining({
            role: expect.objectContaining({
              OR: expect.arrayContaining([
                { code: { in: ['OFFER_APPROVER', 'HIRING_MANAGER', 'HR_MANAGER', 'TALENT_MANAGER', 'ADMINISTRATOR'] } },
                { permissions: { some: { permission: { code: { in: ['APPROVE_OFFERS', 'OFFER_APPROVE'] }, status: 'Active' } } } },
              ]),
            }),
          }),
        }),
      }),
    }));
    const recipients = notifications.create.mock.calls.map((call) => call[0].recipientUserId);
    expect(recipients).toEqual(['u-manager', 'u-admin', 'u-boss']);
    expect(recipients).not.toContain('u-submitter');
  });

  it('shows pending OFFER_APPROVER items to a hiring manager and to an OFFER_APPROVE holder', async () => {
    const permissions = { hasPermission: vi.fn().mockResolvedValue(false) };
    const manager = harness(permissions as unknown as UserPermissionsService);
    await manager.service.getApprovalInbox(actor(['HIRING_MANAGER'], 'u-manager'), { viewOfferPay: false });
    expect(manager.prisma.offerApproval.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: [
          { approverUserId: 'u-manager' },
          { roleCode: { in: ['HIRING_MANAGER', 'OFFER_APPROVER'] } },
        ],
      }),
    }));

    permissions.hasPermission.mockImplementation(async (_userId: string, _orgId: string, code: string) => code === 'OFFER_APPROVE');
    const permitted = harness(permissions as unknown as UserPermissionsService);
    await permitted.service.getApprovalInbox(actor(['RECRUITER'], 'u-perm'), { viewOfferPay: false });
    expect(permitted.prisma.offerApproval.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: [
          { approverUserId: 'u-perm' },
          { roleCode: { in: ['RECRUITER', 'OFFER_APPROVER'] } },
        ],
      }),
    }));
    expect(permissions.hasPermission).toHaveBeenCalledWith('u-perm', ORG, 'OFFER_APPROVE');
  });

  it('keeps a recruiter without OFFER_APPROVE on their own role codes', async () => {
    const { service, prisma } = harness();
    await service.getApprovalInbox(actor(['RECRUITER'], 'u-rec'), { viewOfferPay: false });
    expect(prisma.offerApproval.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: [
          { approverUserId: 'u-rec' },
          { roleCode: { in: ['RECRUITER'] } },
        ],
      }),
    }));
  });

  it('lets a hiring manager or an OFFER_APPROVE holder decide an OFFER_APPROVER row, and refuses a recruiter', async () => {
    const permissions = { hasPermission: vi.fn().mockResolvedValue(false) };
    const { service, prisma, tx } = harness(permissions as unknown as UserPermissionsService);
    prisma.offerApproval.findFirst.mockResolvedValue({
      id: 'ap1',
      status: 'Pending',
      roleCode: 'OFFER_APPROVER',
      approverUserId: null,
      offerVersionId: 'v1',
      offerVersion: { id: 'v1', offer: { id: 'o1', organizationId: ORG, currentVersionId: 'v1', applicationId: 'a1', offerCode: 'OFF-9' } },
    });
    prisma.application.findUnique.mockResolvedValue({ primaryRecruiterId: 'u-rec' });
    prisma.user.findMany.mockResolvedValue([{ id: 'u-rec' }]);

    await expect(service.submitDecision(actor(['RECRUITER'], 'u-rec'), 'ap1', { decision: 'Reject' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.offerApproval.update).not.toHaveBeenCalled();

    await service.submitDecision(actor(['HIRING_MANAGER'], 'u-manager'), 'ap1', { decision: 'Reject' });
    expect(tx.offerApproval.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'ap1' },
      data: expect.objectContaining({ status: 'Rejected', approver: { connect: { id: 'u-manager' } } }),
    }));

    permissions.hasPermission.mockImplementation(async (_userId: string, _orgId: string, code: string) => code === 'OFFER_APPROVE');
    await service.submitDecision(actor(['RECRUITER'], 'u-perm'), 'ap1', { decision: 'Reject' });
    expect(tx.offerApproval.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ approver: { connect: { id: 'u-perm' } } }),
    }));
    expect(permissions.hasPermission).toHaveBeenCalledWith('u-perm', ORG, 'OFFER_APPROVE');
  });

  it('lets an APPROVE_OFFERS holder decide inside the reporting line and refuses them outside it', async () => {
    const permissions = {
      hasPermission: vi.fn(async (_userId: string, _orgId: string, code: string) => code === 'APPROVE_OFFERS'),
    };
    const { service, prisma, tx } = harness(permissions as unknown as UserPermissionsService);
    prisma.offerApproval.findFirst.mockResolvedValue({
      id: 'ap1',
      status: 'Pending',
      roleCode: 'OFFER_APPROVER',
      approverUserId: null,
      offerVersionId: 'v1',
      offerVersion: { id: 'v1', offer: { id: 'o1', organizationId: ORG, currentVersionId: 'v1', applicationId: 'a1', offerCode: 'OFF-9' } },
    });
    prisma.application.findUnique.mockResolvedValue({ primaryRecruiterId: 'u-rec' });
    prisma.user.findMany.mockResolvedValue([{ id: 'u-rec' }]);

    await service.decideOffer(ORG, 'ap1', { decision: 'Reject' }, actor(['RECRUITER'], 'u-perm'));
    expect(tx.offerApproval.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ approver: { connect: { id: 'u-perm' } } }),
    }));
    expect(permissions.hasPermission).toHaveBeenCalledWith('u-perm', ORG, 'APPROVE_OFFERS');

    tx.offerApproval.update.mockClear();
    prisma.user.findMany.mockResolvedValue([{ id: 'someone-else' }]);
    await expect(service.decideOffer(ORG, 'ap1', { decision: 'Reject' }, actor(['HR_MANAGER'], 'u-hr'))).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.offerApproval.update).not.toHaveBeenCalled();
  });
});
