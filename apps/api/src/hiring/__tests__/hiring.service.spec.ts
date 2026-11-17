import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@recruitflow/contracts';
import type { PrismaService } from '../../database/prisma.service';
import type { AuditService } from '../../audit/audit.service';
import type { UserPermissionsService } from '../../common/user-permissions.service';
import { HiringService } from '../hiring.service';

const ORG = '10000000-0000-4000-8000-000000000001';

function actor(roleCodes: string[], userId = 'u-decider'): AuthUser {
  return { userId, organizationId: ORG, tokenVersion: 1, roleCodes };
}

function harness(hasPermission: (userId: string, organizationId: string, code: string) => Promise<boolean> = async () => false) {
  const tx = {
    hiringCaseApproval: { update: vi.fn() },
    hiringCase: { update: vi.fn() },
  };
  const prisma = {
    hiringCase: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'case-1',
        status: 'Pending Final Approval',
        applicationId: 'a1',
        approvals: [{ id: 'ap1', roleCode: 'FINAL_HIRING_APPROVER', status: 'Pending', approverUserId: null }],
      }),
    },
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const audit = { log: vi.fn().mockResolvedValue(undefined) };
  const permissions = { hasPermission: vi.fn(hasPermission) };
  const service = new HiringService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    undefined,
    permissions as unknown as UserPermissionsService,
  );
  return { service, prisma, tx, permissions };
}

describe('HiringService three-role final approval', () => {
  it('refuses a recruiter who is not the named approver and does not hold VACANCY_APPROVE or OFFER_APPROVE', async () => {
    const { service, tx } = harness();
    await expect(service.decideFinalApproval(ORG, 'case-1', { decision: 'Reject' }, actor(['RECRUITER']))).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.hiringCaseApproval.update).not.toHaveBeenCalled();
  });

  it('lets a hiring manager decide a FINAL_HIRING_APPROVER row without a legacy role code', async () => {
    const { service, tx, permissions } = harness();
    await service.decideFinalApproval(ORG, 'case-1', { decision: 'Reject', comment: 'Proceed' }, actor(['HIRING_MANAGER'], 'u-manager'));
    expect(permissions.hasPermission).not.toHaveBeenCalled();
    expect(tx.hiringCaseApproval.update).toHaveBeenCalledWith({
      where: { id: 'ap1' },
      data: expect.objectContaining({ status: 'Rejected', approverUserId: 'u-manager', comment: 'Proceed' }),
    });
    expect(tx.hiringCase.update).toHaveBeenCalledWith({
      where: { id: 'case-1' },
      data: expect.objectContaining({ status: 'Withdrawn' }),
    });
  });

  it.each(['VACANCY_APPROVE', 'OFFER_APPROVE'] as const)('lets a user with %s decide the final hiring approval', async (code) => {
    const { service, tx, permissions } = harness(async (_userId, _orgId, permission) => permission === code);
    await service.decideFinalApproval(ORG, 'case-1', { decision: 'Reject' }, actor(['RECRUITER'], 'u-cap'));
    expect(permissions.hasPermission).toHaveBeenCalledWith('u-cap', ORG, 'VACANCY_APPROVE');
    expect(tx.hiringCaseApproval.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ approverUserId: 'u-cap', status: 'Rejected' }),
    }));
  });

  it('still lets the named approver and an administrator decide', async () => {
    const named = harness();
    named.prisma.hiringCase.findFirst.mockResolvedValue({
      id: 'case-1',
      status: 'Pending Final Approval',
      applicationId: 'a1',
      approvals: [{ id: 'ap1', roleCode: 'FINAL_HIRING_APPROVER', status: 'Pending', approverUserId: 'u-named' }],
    });
    await named.service.decideFinalApproval(ORG, 'case-1', { decision: 'Reject' }, actor(['RECRUITER'], 'u-named'));
    expect(named.permissions.hasPermission).not.toHaveBeenCalled();
    expect(named.tx.hiringCaseApproval.update).toHaveBeenCalled();

    const admin = harness();
    await admin.service.decideFinalApproval(ORG, 'case-1', { decision: 'Reject' }, actor(['ADMINISTRATOR'], 'u-admin'));
    expect(admin.permissions.hasPermission).not.toHaveBeenCalled();
    expect(admin.tx.hiringCaseApproval.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ approverUserId: 'u-admin' }),
    }));
  });

  it('lets HR and talent managers, and a FINAL_HIRING_APPROVAL holder, decide a final-hiring step', async () => {
    for (const role of ['HR_MANAGER', 'TALENT_MANAGER'] as const) {
      const { service, tx, permissions } = harness();
      await service.decideFinalApproval(ORG, 'case-1', { decision: 'Reject' }, actor([role], 'u-role'));
      expect(permissions.hasPermission).not.toHaveBeenCalled();
      expect(tx.hiringCaseApproval.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ approverUserId: 'u-role' }),
      }));
    }

    const permitted = harness(async (_userId, _orgId, code) => code === 'FINAL_HIRING_APPROVAL');
    await permitted.service.decideFinalApproval(ORG, 'case-1', { decision: 'Reject' }, actor(['RECRUITER'], 'u-final'));
    expect(permitted.permissions.hasPermission).toHaveBeenCalledWith('u-final', ORG, 'FINAL_HIRING_APPROVAL');
    expect(permitted.tx.hiringCaseApproval.update).toHaveBeenCalled();
  });

  it('rejects a manager whose reporting line does not include the file recruiter', async () => {
    const { service, prisma, tx } = harness();
    prisma.hiringCase.findFirst.mockResolvedValue({
      id: 'case-1',
      status: 'Pending Final Approval',
      applicationId: 'a1',
      application: { primaryRecruiterId: 'u-rec' },
      approvals: [{ id: 'ap1', roleCode: 'FINAL_HIRING_APPROVER', status: 'Pending', approverUserId: null }],
    });
    Object.assign(prisma, { user: { findMany: vi.fn().mockResolvedValue([{ id: 'other-recruiter' }]) } });
    await expect(service.decideFinalApproval(ORG, 'case-1', { decision: 'Reject' }, actor(['HIRING_MANAGER'], 'u-manager'))).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.hiringCaseApproval.update).not.toHaveBeenCalled();
  });
});
