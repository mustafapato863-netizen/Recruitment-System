import { describe, expect, it, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { VacancyCoreService } from '../vacancy-core.service';
import type { VacancyCoreRepository } from '../vacancy-core.repository';
import type { PrismaService } from '../../database/prisma.service';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { AuthUser } from '@recruitflow/contracts';

// B2 (v2 §3): DELETE /vacancies/:id deactivates; nothing is removed.
function createService(status = 'Open') {
  const transaction = {
    vacancy: { update: vi.fn().mockResolvedValue({}), delete: vi.fn() },
    vacancyRequest: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), delete: vi.fn() },
    vacancyAssignment: { deleteMany: vi.fn() },
    vacancyRequestApproval: { deleteMany: vi.fn() },
    vacancyStatusHistory: { create: vi.fn().mockResolvedValue({}) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    vacancy: { findFirst: vi.fn().mockResolvedValue({ id: 'vacancy-1', status, vacancyRequestId: 'request-1' }) },
    application: { count: vi.fn().mockResolvedValue(0) },
    masterDataValue: { findFirst: vi.fn().mockResolvedValue({ name: 'Position no longer needed' }) },
    $transaction: vi.fn(async (callback: (tx: typeof transaction) => Promise<void>) => callback(transaction)),
  };
  const service = new VacancyCoreService({} as VacancyCoreRepository, prisma as unknown as PrismaService, {} as NotificationsService);
  return { service, prisma, transaction };
}
const R = { reason: 'Position no longer needed' };
// Admin DELETE (audited override, reason required) is covered in b2r-job-scope.db.spec.ts.

describe('VacancyCoreService DELETE deactivates (B2)', () => {
  it('closes the job (never Cancelled), cancels its open requisition, and deletes nothing', async () => {
    const { service, transaction } = createService();
    await expect(service.deleteVacancy('vacancy-1', 'org-1', undefined, R)).resolves.toEqual({ id: 'vacancy-1', deactivated: true, status: 'Closed' });
    expect(transaction.vacancy.update).toHaveBeenCalledWith({ where: { id: 'vacancy-1' }, data: expect.objectContaining({ status: 'Closed' }) });
    expect(transaction.vacancyStatusHistory.create).toHaveBeenCalledWith({ data: expect.objectContaining({ toStatus: 'Closed', reason: 'Position no longer needed' }) });
    expect(transaction.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'VACANCY_CLOSE', entityId: 'vacancy-1', reason: 'Position no longer needed' }) });
    expect(JSON.stringify(transaction.vacancy.update.mock.calls)).not.toContain('Cancelled');
    expect(transaction.vacancyRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'Cancelled' } }));
    for (const fn of [transaction.vacancy.delete, transaction.vacancyRequest.delete, transaction.vacancyAssignment.deleteMany, transaction.vacancyRequestApproval.deleteMany]) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  it('is idempotent for an already deactivated job', async () => {
    const { service, prisma } = createService('Closed');
    await expect(service.deleteVacancy('vacancy-1', 'org-1', undefined, R)).resolves.toMatchObject({ deactivated: true });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses while the job still has open applications (409 with counts)', async () => {
    const { service, prisma } = createService();
    prisma.application.count.mockResolvedValue(2);
    const error = await service.deleteVacancy('vacancy-1', 'org-1', undefined, R).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({ counts: { openApplications: 2 } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('NEW-3: a non-admin who is not the owner or the owner\'s manager gets 403 JOB_NOT_OWNED (VACANCY_MANAGE is not enough)', async () => {
    const { service, prisma } = createService();
    prisma.vacancy.findFirst.mockResolvedValue({ id: 'vacancy-1', status: 'Open', vacancyRequestId: 'request-1', vacancyRequest: { requesterId: 'requester', assignedEmployeeId: null }, assignments: [{ userId: 'owner', user: { managerId: 'boss' } }] } as never);
    Object.assign(prisma, { userRole: { count: vi.fn().mockResolvedValue(0) }, user: { findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) => (where.id.in.includes('owner') ? [{ managerId: 'boss' }] : [])) } });
    const tm = { userId: 'talent-manager', organizationId: 'org-1', roleCodes: ['TALENT_MANAGER'] } as AuthUser;
    await expect(service.deleteVacancy('vacancy-1', 'org-1', tm, R)).rejects.toMatchObject({ status: 403, response: { code: 'JOB_NOT_OWNED' } });
    await expect(service.deleteVacancy('vacancy-1', 'org-1', { ...tm, userId: 'requester' }, R)).rejects.toMatchObject({ status: 403 });
    await expect(service.deleteVacancy('vacancy-1', 'org-1', { ...tm, userId: 'boss' }, R)).resolves.toMatchObject({ deactivated: true });
    await expect(service.deleteVacancy('vacancy-1', 'org-1', { ...tm, userId: 'owner' }, R)).resolves.toMatchObject({ deactivated: true });
  });

  it('every DELETE needs a close reason from the list (400 REASON_REQUIRED / REASON_NOT_IN_LIST), checked after ownership', async () => {
    const { service, prisma } = createService();
    await expect(service.deleteVacancy('vacancy-1', 'org-1', undefined)).rejects.toMatchObject({ status: 400, response: { code: 'REASON_REQUIRED', field: 'reason' } });
    prisma.masterDataValue.findFirst.mockResolvedValue(null);
    await expect(service.deleteVacancy('vacancy-1', 'org-1', undefined, { reason: 'made up' })).rejects.toMatchObject({ status: 400 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
