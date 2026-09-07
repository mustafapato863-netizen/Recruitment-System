import { describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { VacancyCoreService } from '../vacancy-core.service';
import type { PrismaService } from '../../database/prisma.service';
import type { VacancyCoreRepository } from '../vacancy-core.repository';
import type { NotificationsService } from '../../notifications/notifications.service';

describe('Vacancies Export Service', () => {
  const mockVacancies = [
    {
      id: 'vac-1',
      organizationId: 'org-1',
      vacancyCode: 'VAC-2026-001',
      positionId: 'pos-1',
      position: { title: 'ICU Head Nurse', code: 'POS-001' },
      branchId: 'br-1',
      branch: { name: 'Riyadh Main Hospital', code: 'BR-001' },
      legalEntityId: 'le-1',
      legalEntity: { name: 'Saudi German Health LLC', code: 'LE-001' },
      status: 'Open',
      approvedHeadcount: 5,
      joinedHeadcount: 2,
      targetStartDate: new Date('2026-06-01T00:00:00.000Z'),
      assignments: [
        { user: { displayName: 'Mona AlHarbi' }, isActive: true },
      ],
      _count: { applications: 14 },
      createdAt: new Date('2026-01-10T12:00:00.000Z'),
    },
  ];

  it('generates a valid XLSX workbook with vacancies data and remaining headcount', async () => {
    const mockPrisma = {
      vacancy: {
        findMany: vi.fn().mockResolvedValue(mockVacancies),
      },
    } as unknown as PrismaService;

    const mockRepo = {} as VacancyCoreRepository;
    const mockNotifications = {} as NotificationsService;

    const service = new VacancyCoreService(mockRepo, mockPrisma, mockNotifications);
    const buffer = await service.exportExcel('org-1');

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    expect(workbook.SheetNames).toContain('Vacancies');

    const sheet = workbook.Sheets['Vacancies'];
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

    expect(rows[0]).toEqual([
      'Vacancy Code',
      'Position Title',
      'Position Code',
      'Branch Name',
      'Branch Code',
      'Legal Entity',
      'Status',
      'Approved Headcount',
      'Joined Headcount',
      'Remaining Headcount',
      'Applications Count',
      'Primary Recruiter',
      'Target Start Date (UTC)',
      'Created At (UTC)',
    ]);

    expect(rows[1][0]).toBe('VAC-2026-001');
    expect(rows[1][1]).toBe('ICU Head Nurse');
    expect(rows[1][2]).toBe('POS-001');
    expect(rows[1][3]).toBe('Riyadh Main Hospital');
    expect(rows[1][4]).toBe('BR-001');
    expect(rows[1][5]).toBe('Saudi German Health LLC');
    expect(rows[1][6]).toBe('Open');
    expect(rows[1][7]).toBe(5);
    expect(rows[1][8]).toBe(2);
    expect(rows[1][9]).toBe(3); // 5 - 2 = 3 remaining headcount
    expect(rows[1][10]).toBe(14);
    expect(rows[1][11]).toBe('Mona AlHarbi');
    expect(rows[1][12]).toBe('2026-06-01');
  });
});
