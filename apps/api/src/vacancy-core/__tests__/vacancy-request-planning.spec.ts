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
  it('requires salary budget range and fill plan before submission even when budgetStatus is null (Ticket 01)', async () => {
    const { service, repository } = serviceFor(request({ budgetStatus: null, budgetMin: null, budgetMax: null, budgetCurrency: null }));
    await expect(service.submitRequest('request-1', 'org-1', 'user-1')).rejects.toThrow(/budget range/i);
    expect(repository.saveRequest).not.toHaveBeenCalled();
  });

  it('requires both salary bounds before activating a draft', async () => {
    const { service } = serviceFor(request({ budgetMax: null }));
    await expect(service.activateRequest('request-1', 'org-1', 'user-1', {}))
      .rejects.toMatchObject({ response: { field: 'budgetMax' } });
  });

  it('allows incomplete drafts without salary range and validates negative or inverted ranges', async () => {
    const { service } = serviceFor(request({ budgetMin: null, budgetMax: null, budgetCurrency: null }));
    const savedDraft = await service.updateRequest('request-1', 'org-1', { justification: 'Incomplete draft OK' });
    expect(savedDraft.justification).toBe('Incomplete draft OK');
    await expect(service.updateRequest('request-1', 'org-1', { budgetMin: -500 })).rejects.toThrow(/budget range/i);
    await expect(service.updateRequest('request-1', 'org-1', { budgetMin: 16000, budgetMax: 15000 })).rejects.toThrow(/budget range/i);
    const equalRange = await service.updateRequest('request-1', 'org-1', { budgetMin: 15000, budgetMax: 15000, budgetCurrency: 'SAR', budgetPeriod: 'Monthly' });
    expect(equalRange.budgetMin).toBe(15000);
    expect(equalRange.budgetMax).toBe(15000);
    expect(equalRange.budgetCurrency).toBe('SAR');
    expect(equalRange.budgetPeriod).toBe('Monthly');
  });

  it('accepts AED, EGP, SAR, USD and rejects an inverted range', async () => {
    const { service } = serviceFor(request());
    await expect(service.updateRequest('request-1', 'org-1', { budgetMin: 16000 })).rejects.toThrow(/budget range/i);
    const updated = await service.updateRequest('request-1', 'org-1', { budgetMin: 12000, budgetMax: 18000, budgetCurrency: 'AED' });
    expect(updated.budgetCurrency).toBe('AED');
  });

  it('submits a complete plan for approval', async () => {
    const { service } = serviceFor(request());
    const result = await service.submitRequest('request-1', 'org-1', 'user-1');
    expect(result.status).toBe('Pending Approval');
  });
});
