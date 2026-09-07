import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { VacancyCoreService } from '../vacancy-core.service';
import type { VacancyCoreRepository } from '../vacancy-core.repository';
import type { PrismaService } from '../../database/prisma.service';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { Vacancy } from '@recruitflow/contracts';

type MockFn = ReturnType<typeof vi.fn>;

interface MockRepository {
  getVacancy: MockFn;
  saveVacancy: MockFn;
}

function buildVacancy(overrides: Partial<Vacancy> = {}): Vacancy {
  return {
    id: 'vac-uuid-1',
    organizationId: 'org-uuid-1',
    legalEntityId: null,
    branchId: 'branch-uuid-1',
    positionId: 'pos-uuid-1',
    vacancyRequestId: 'req-uuid-1',
    vacancyCode: 'VAC-2026-001',
    status: 'Pending Activation',
    approvedHeadcount: 2,
    joinedHeadcount: 0,
    openedAt: null,
    targetStartDate: null,
    assignments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('VacancyCoreService job description requirements', () => {
  let service: VacancyCoreService;
  let mockRepository: MockRepository;

  beforeEach(() => {
    mockRepository = {
      getVacancy: vi.fn(),
      saveVacancy: vi.fn((vacancy: Vacancy) => Promise.resolve(vacancy)),
    };
    service = new VacancyCoreService(
      mockRepository as unknown as VacancyCoreRepository,
      {} as unknown as PrismaService,
      { create: vi.fn() } as unknown as NotificationsService,
    );
  });

  it('blocks opening a vacancy without a job summary', async () => {
    mockRepository.getVacancy.mockResolvedValue(buildVacancy({ jobSummary: null }));

    await expect(service.updateVacancyStatus('vac-uuid-1', 'org-uuid-1', 'Open')).rejects.toThrow(
      BadRequestException,
    );
    expect(mockRepository.saveVacancy).not.toHaveBeenCalled();
  });

  it('blocks opening when the summary is whitespace only', async () => {
    mockRepository.getVacancy.mockResolvedValue(buildVacancy({ jobSummary: '   ' }));

    await expect(service.updateVacancyStatus('vac-uuid-1', 'org-uuid-1', 'Open')).rejects.toThrow(
      /job summary/i,
    );
    expect(mockRepository.saveVacancy).not.toHaveBeenCalled();
  });

  it('opens and stamps openedAt when a job summary exists', async () => {
    mockRepository.getVacancy.mockResolvedValue(
      buildVacancy({ jobSummary: 'Senior ICU nurse for Jeddah' }),
    );

    const result = await service.updateVacancyStatus('vac-uuid-1', 'org-uuid-1', 'Open');

    expect(result.status).toBe('Open');
    expect(result.openedAt).not.toBeNull();
    expect(mockRepository.saveVacancy).toHaveBeenCalledTimes(1);
  });

  it('allows non-Open transitions without a job summary', async () => {
    mockRepository.getVacancy.mockResolvedValue(buildVacancy({ jobSummary: null }));

    const result = await service.updateVacancyStatus('vac-uuid-1', 'org-uuid-1', 'On Hold');

    expect(result.status).toBe('On Hold');
    expect(mockRepository.saveVacancy).toHaveBeenCalledTimes(1);
  });
});
