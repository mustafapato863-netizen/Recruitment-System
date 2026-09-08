import { describe, expect, it, vi } from 'vitest';
import { VacancyCoreService } from '../vacancy-core.service';
import type { VacancyCoreRepository } from '../vacancy-core.repository';
import type { PrismaService } from '../../database/prisma.service';
import type { NotificationsService } from '../../notifications/notifications.service';

describe('VacancyCoreService recruiter assignment', () => {
  it('is idempotent and safely reactivates history through A to B to A to B', async () => {
    type AssignmentRow = { id: string; vacancyId: string; userId: string; roleCode: string; assignmentKind: string; isActive: boolean; assignedAt: Date };
    const rows: AssignmentRow[] = [];
    const tx = {
      vacancyAssignment: {
        findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
          return rows.find((row) => Object.entries(where).every(([key, value]) => row[key as keyof typeof row] === value)) ?? null;
        }),
        updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: { isActive: boolean } }) => {
          let count = 0;
          for (const row of rows) {
            if (Object.entries(where).every(([key, value]) => row[key as keyof typeof row] === value)) {
              row.isActive = data.isActive;
              count++;
            }
          }
          return { count };
        }),
        update: vi.fn(async ({ where, data }: { where: { id: string }; data: { isActive: boolean } }) => {
          const row = rows.find((item) => item.id === where.id)!;
          row.isActive = data.isActive;
          return row;
        }),
        create: vi.fn(async ({ data }: { data: AssignmentRow }) => {
          if (rows.some((row) => row.userId === data.userId && row.roleCode === data.roleCode && row.assignmentKind === data.assignmentKind && row.isActive === data.isActive)) {
            throw new Error('unique constraint');
          }
          rows.push(data);
          return data;
        }),
      },
    };
    const repository = {
      getVacancy: vi.fn().mockResolvedValue({ id: 'vacancy', organizationId: 'org' }),
      ensureUserInOrganization: vi.fn().mockResolvedValue(undefined),
    };
    const prisma = { $transaction: vi.fn(async (callback: (value: typeof tx) => Promise<void>) => callback(tx)) };
    const service = new VacancyCoreService(
      repository as unknown as VacancyCoreRepository,
      prisma as unknown as PrismaService,
      {} as unknown as NotificationsService,
    );
    const assign = (userId: string) => service.assignTeamMember('vacancy', 'org', { userId, roleCode: 'RECRUITER' });

    await assign('A');
    await assign('B');
    await assign('A');
    await assign('B');

    expect(rows.filter((row) => row.isActive).map((row) => row.userId)).toEqual(['B']);
    expect(rows).toHaveLength(2);
    expect(tx.vacancyAssignment.create).toHaveBeenCalledTimes(2);
    expect(tx.vacancyAssignment.update).toHaveBeenCalledTimes(2);
  });
});
