import { describe, expect, it, vi } from 'vitest';
import type { VacancyRequest } from '@recruitflow/contracts';
import type { PrismaService } from '../../database/prisma.service';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { VacancyCoreRepository } from '../vacancy-core.repository';
import { VacancyCoreService } from '../vacancy-core.service';

const now = '2026-09-21T09:00:00.000Z';

function request(overrides: Partial<VacancyRequest> = {}): VacancyRequest {
  return {
    id: 'request-1', organizationId: 'org-1', branchId: 'branch-1', positionId: 'position-1',
    requesterId: 'user-1', requestCode: 'VR-2026-001', status: 'Draft', requestedHeadcount: 1,
    employmentType: 'Full-time', reason: 'New position', budgetStatus: 'Budgeted',
    budgetMin: 10000, budgetMax: 15000, budgetCurrency: 'EGP', criticality: 'Normal',
    targetStartDate: null, targetFillDate: '2026-12-01', recruitmentTiming: 'After Approval',
    plannedOpenDate: null, justification: 'Needed', jobSummary: 'Role', description: null,
    responsibilities: null, qualifications: null, benefits: null, submittedAt: null,
    approvalRevision: 1, approvals: [], createdAt: now, updatedAt: now,
    ...overrides,
  };
}

function serviceFor(value: VacancyRequest) {
  const repository = {
    getRequest: vi.fn().mockResolvedValue(value),
    saveRequest: vi.fn().mockImplementation(async (updated: VacancyRequest) => updated),
    getVacancyByRequestId: vi.fn().mockResolvedValue(null),
    nextVacancyCode: vi.fn().mockResolvedValue('VAC-2026-001'),
    saveRequestAndVacancy: vi.fn().mockResolvedValue(undefined),
  };
  const prisma = { user: { findMany: vi.fn().mockResolvedValue([]) } };
  return {
    service: new VacancyCoreService(repository as unknown as VacancyCoreRepository, prisma as unknown as PrismaService, { create: vi.fn() } as unknown as NotificationsService),
    repository,
  };
}

describe('vacancy request planning', () => {
  it('requires budget and fill plan before submission', async () => {
    const { service, repository } = serviceFor(request({ budgetMin: null, budgetMax: null, budgetCurrency: null }));
    await expect(service.submitRequest('request-1', 'org-1', 'user-1')).rejects.toThrow(/budget range/i);
    expect(repository.saveRequest).not.toHaveBeenCalled();
  });

  it('accepts either AED or EGP and rejects an inverted range', async () => {
    const { service } = serviceFor(request());
    await expect(service.updateRequest('request-1', 'org-1', { budgetMin: 16000 })).rejects.toThrow(/budget range/i);
    const updated = await service.updateRequest('request-1', 'org-1', { budgetMin: 12000, budgetMax: 18000, budgetCurrency: 'AED' });
    expect(updated.budgetCurrency).toBe('AED');
  });

  it('converts deferred recruitment to an on-hold vacancy', async () => {
    const { service, repository } = serviceFor(request({ status: 'Approved', recruitmentTiming: 'Deferred', plannedOpenDate: '2026-10-01' }));
    const result = await service.convertToVacancy('request-1', 'org-1', 'user-1');
    expect(result.vacancy.status).toBe('On Hold');
    expect(repository.saveRequestAndVacancy).toHaveBeenCalledOnce();
  });

  it('submits a complete plan for approval', async () => {
    const { service } = serviceFor(request());
    const result = await service.submitRequest('request-1', 'org-1', 'user-1');
    expect(result.status).toBe('Pending Approval');
  });
});
