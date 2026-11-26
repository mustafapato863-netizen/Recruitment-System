import { describe, expect, it, vi } from 'vitest';
import type { VacancyRequest } from '@recruitflow/contracts';
import type { PrismaService } from '../../database/prisma.service';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { VacancyCoreRepository } from '../vacancy-core.repository';
import { VacancyCoreService } from '../vacancy-core.service';

// Meeting notes 2026-11-25 (item 1): opening type, replaced employee, structured
// reason, employment type and nationality preference on vacancy requests.
const now = '2026-09-21T09:00:00.000Z';

const REASONS: Record<string, string> = {
  'team expansion': 'Team expansion',
  replacement: 'Replacement',
  other: 'Other',
};

function request(overrides: Partial<VacancyRequest> = {}): VacancyRequest {
  return {
    id: 'request-1', organizationId: 'org-1', branchId: 'branch-1', positionId: 'position-1',
    requesterId: 'user-1', requestCode: 'VR-2026-001', status: 'Draft', requestedHeadcount: 1,
    employmentType: 'Full-time', openingType: 'New position', replacedEmployeeId: null,
    replacedEmployee: null, nationalityPreference: [], reason: 'Team expansion',
    budgetStatus: 'Budgeted', budgetMin: 10000, budgetMax: 15000, budgetCurrency: 'EGP',
    criticality: 'Normal', targetStartDate: null, targetFillDate: '2026-12-01',
    recruitmentTiming: 'After Approval', plannedOpenDate: null, justification: 'Needed',
    jobSummary: 'Role', description: null, responsibilities: null, qualifications: null,
    benefits: null, submittedAt: null, approvalRevision: 1, approvals: [],
    createdAt: now, updatedAt: now,
    ...overrides,
  } as VacancyRequest;
}

function serviceFor(value: VacancyRequest) {
  const repository = {
    getRequest: vi.fn().mockResolvedValue(value),
    saveRequest: vi.fn().mockImplementation(async (updated: VacancyRequest) => updated),
    createRequest: vi.fn().mockImplementation(async (payload: Record<string, unknown>) => request(payload as Partial<VacancyRequest>)),
    getVacancyByRequestId: vi.fn().mockResolvedValue(null),
    nextVacancyCode: vi.fn().mockResolvedValue('VAC-2026-001'),
    saveRequestAndVacancy: vi.fn().mockResolvedValue(undefined),
  };
  const prisma = {
    masterDataValue: {
      findFirst: vi.fn().mockImplementation(async (args: { where: { OR: Array<{ name?: { equals: string } }> } }) => {
        const wanted = args.where.OR[0]?.name?.equals?.toLowerCase() ?? '';
        const name = REASONS[wanted];
        return name ? { name } : null;
      }),
    },
    user: {
      findFirst: vi.fn().mockImplementation(async (args: { where: { id?: string } }) =>
        (args.where.id === 'user-replaced' ? { id: 'user-replaced' } : null)),
    },
    userRole: { count: vi.fn().mockResolvedValue(0) },
  };
  return {
    service: new VacancyCoreService(
      repository as unknown as VacancyCoreRepository,
      prisma as unknown as PrismaService,
      { create: vi.fn() } as unknown as NotificationsService,
    ),
    repository,
    prisma,
  };
}

const baseInput = {
  branchId: 'branch-1', positionId: 'position-1', requestedHeadcount: 1,
  budgetMin: 10000, budgetMax: 15000, budgetCurrency: 'EGP', targetFillDate: '2026-12-01',
};

describe('meeting notes item 1 — opening type and hiring details', () => {
  it('defaults a new request to a new position and keeps the employment type and nationality preference', async () => {
    const { service, repository } = serviceFor(request());
    const created = await service.createRequest('org-1', 'user-1', {
      ...baseInput, employmentType: 'Contract', nationalityPreference: ['Egyptian', 'Indian'],
    });
    expect(created.openingType).toBe('New position');
    expect(created.employmentType).toBe('Contract');
    expect(created.nationalityPreference).toEqual(['Egyptian', 'Indian']);
    expect(created.replacedEmployeeId).toBeNull();
    expect(repository.createRequest).toHaveBeenCalled();
  });

  it('allows a replacement opening without selecting a replaced employee (Ticket 03)', async () => {
    const { service } = serviceFor(request());
    const created = await service.createRequest('org-1', 'user-1', { ...baseInput, openingType: 'Replacement' });
    expect(created.openingType).toBe('Replacement');
    expect(created.replacedEmployeeId).toBeNull();
  });

  it('preserves an existing historical replacedEmployeeId when editing unrelated fields on a replacement request', async () => {
    const { service } = serviceFor(request({ openingType: 'Replacement', replacedEmployeeId: 'user-replaced' }));
    const updated = await service.updateRequest('request-1', 'org-1', { justification: 'Updated justification only' });
    expect(updated.openingType).toBe('Replacement');
    expect(updated.replacedEmployeeId).toBe('user-replaced');
  });

  it('still rejects an explicit replacedEmployeeId that is not an active user in the org', async () => {
    const { service } = serviceFor(request());
    await expect(service.createRequest('org-1', 'user-1', { ...baseInput, openingType: 'Replacement', replacedEmployeeId: 'user-gone' }))
      .rejects.toMatchObject({ response: { code: 'REPLACED_EMPLOYEE_NOT_FOUND' } });
  });

  it('accepts a replacement with an active employee and resolves a structured reason', async () => {
    const { service } = serviceFor(request());
    const created = await service.createRequest('org-1', 'user-1', {
      ...baseInput, openingType: 'Replacement', replacedEmployeeId: 'user-replaced', reason: 'Replacement',
    });
    expect(created.openingType).toBe('Replacement');
    expect(created.replacedEmployeeId).toBe('user-replaced');
    expect(created.reason).toBe('Replacement');
  });

  it('stores "Other" with its note and rejects a reason outside the list', async () => {
    const { service } = serviceFor(request());
    const created = await service.createRequest('org-1', 'user-1', { ...baseInput, reason: 'Other', reasonNote: 'Backfill after restructure' });
    expect(created.reason).toBe('Other: Backfill after restructure');
    await expect(service.createRequest('org-1', 'user-1', { ...baseInput, reason: 'Other' }))
      .rejects.toMatchObject({ response: { code: 'REASON_REQUIRED' } });
    await expect(service.createRequest('org-1', 'user-1', { ...baseInput, reason: 'Because we feel like it' }))
      .rejects.toMatchObject({ response: { code: 'REASON_NOT_IN_LIST' } });
  });

  it('switching an update back to a new position clears the replaced employee', async () => {
    const { service } = serviceFor(request({ openingType: 'Replacement', replacedEmployeeId: 'user-replaced' }));
    const updated = await service.updateRequest('request-1', 'org-1', { openingType: 'New position' });
    expect(updated.openingType).toBe('New position');
    expect(updated.replacedEmployeeId).toBeNull();
  });
});
