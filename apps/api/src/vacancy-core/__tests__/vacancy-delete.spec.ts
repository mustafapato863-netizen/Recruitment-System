import { describe, expect, it, vi } from 'vitest';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { VacancyCoreService } from '../vacancy-core.service';
import type { VacancyCoreRepository } from '../vacancy-core.repository';
import type { PrismaService } from '../../database/prisma.service';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { AuthUser } from '@recruitflow/contracts';

function createService() {
  const transaction = {
    vacancyAssignment: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    vacancyRequestApproval: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    vacancy: { delete: vi.fn().mockResolvedValue({ id: 'vacancy-1' }) },
    vacancyRequest: { delete: vi.fn().mockResolvedValue({ id: 'request-1' }) },
  };
  const prisma = {
    user: { findFirst: vi.fn().mockResolvedValue({ id: 'admin-1' }) },
    vacancy: { findFirst: vi.fn().mockResolvedValue({ id: 'vacancy-1', vacancyRequestId: 'request-1' }) },
    application: { count: vi.fn().mockResolvedValue(0) },
    $transaction: vi.fn(async (callback: (tx: typeof transaction) => Promise<void>) => callback(transaction)),
  };
  const service = new VacancyCoreService(
    {} as VacancyCoreRepository,
    prisma as unknown as PrismaService,
    {} as NotificationsService,
  );
  return { service, prisma, transaction };
}

const adminUser = { userId: 'admin-1', organizationId: 'org-1' } as AuthUser;

describe('VacancyCoreService vacancy deletion', () => {
  it('allows an administrator to delete an unstarted vacancy and its setup records', async () => {
    const { service, prisma, transaction } = createService();

    await expect(service.deleteVacancy('vacancy-1', 'org-1', adminUser)).resolves.toEqual({
      deleted: true,
      id: 'vacancy-1',
    });

    expect(prisma.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId: 'org-1' }),
    }));
    expect(transaction.vacancyAssignment.deleteMany).toHaveBeenCalledWith({ where: { vacancyId: 'vacancy-1' } });
    expect(transaction.vacancyRequestApproval.deleteMany).toHaveBeenCalledWith({ where: { vacancyRequestId: 'request-1' } });
    expect(transaction.vacancy.delete).toHaveBeenCalledWith({ where: { id: 'vacancy-1' } });
    expect(transaction.vacancyRequest.delete).toHaveBeenCalledWith({ where: { id: 'request-1' } });
  });

  it('rejects deletion for a non-administrator even when they have vacancy management access', async () => {
    const { service, prisma } = createService();
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.deleteVacancy('vacancy-1', 'org-1', {
      userId: 'manager-1',
      organizationId: 'org-1',
    } as AuthUser)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.vacancy.findFirst).not.toHaveBeenCalled();
  });

  it('keeps vacancies with applications and asks the administrator to cancel instead', async () => {
    const { service, prisma } = createService();
    prisma.application.count.mockResolvedValue(1);

    await expect(service.deleteVacancy('vacancy-1', 'org-1', adminUser)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
