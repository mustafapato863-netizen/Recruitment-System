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
  };
  const prisma = {
    vacancy: { findFirst: vi.fn().mockResolvedValue({ id: 'vacancy-1', status, vacancyRequestId: 'request-1' }) },
    application: { count: vi.fn().mockResolvedValue(0) },
    $transaction: vi.fn(async (callback: (tx: typeof transaction) => Promise<void>) => callback(transaction)),
  };
  const service = new VacancyCoreService({} as VacancyCoreRepository, prisma as unknown as PrismaService, {} as NotificationsService);
  return { service, prisma, transaction };
}
const adminUser = { userId: 'admin-1', organizationId: 'org-1' } as AuthUser;

describe('VacancyCoreService DELETE deactivates (B2)', () => {
  it('sets the job and its open requisition to Cancelled and deletes nothing', async () => {
    const { service, transaction } = createService();
    await expect(service.deleteVacancy('vacancy-1', 'org-1', adminUser)).resolves.toEqual({ id: 'vacancy-1', deactivated: true, status: 'Cancelled' });
    expect(transaction.vacancy.update).toHaveBeenCalledWith({ where: { id: 'vacancy-1' }, data: { status: 'Cancelled' } });
    expect(transaction.vacancyRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'Cancelled' } }));
    for (const fn of [transaction.vacancy.delete, transaction.vacancyRequest.delete, transaction.vacancyAssignment.deleteMany, transaction.vacancyRequestApproval.deleteMany]) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  it('is idempotent for an already deactivated job', async () => {
    const { service, prisma } = createService('Cancelled');
    await expect(service.deleteVacancy('vacancy-1', 'org-1', adminUser)).resolves.toMatchObject({ deactivated: true });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses while the job still has open applications (409 with counts)', async () => {
    const { service, prisma } = createService();
    prisma.application.count.mockResolvedValue(2);
    const error = await service.deleteVacancy('vacancy-1', 'org-1', adminUser).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({ counts: { openApplications: 2 } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
