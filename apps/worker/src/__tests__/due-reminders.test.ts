import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@recruitflow/database';
import { cairoDate, cairoHour, dueReminderConfigFromEnv, reminderKind, sweepDueDateReminders } from '../due-reminders';

const CONFIG = { enabled: true, leadDays: [3, 1], hour: 8 };
const NOW = new Date('2026-10-19T06:00:00Z'); // 09:00 Cairo

function req(over: Record<string, unknown>) {
  return {
    id: 'r1', organizationId: 'o', requestCode: 'VR-1', status: 'Converted to Vacancy', requesterId: 'mgr', assignedEmployeeId: 'emp',
    requestedHeadcount: 3, targetFillDate: new Date('2026-10-19T00:00:00Z'), position: { title: 'HRIS Developer' },
    vacancy: { id: 'v1', vacancyCode: 'VAC-1', status: 'Open', joinedHeadcount: 1, assignments: [{ userId: 'owner' }] },
    ...over,
  };
}

/** Fake Prisma honouring the unique sent-log key. */
function fakePrisma(requests: unknown[]) {
  const log = new Set<string>();
  const notifications: Array<Record<string, unknown>> = [];
  const tx = {
    dueDateReminder: {
      createMany: vi.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
        const d = data[0]!;
        const key = [d.entityType, d.entityId, d.kind, (d.reminderDate as Date).toISOString(), d.recipientUserId].join('|');
        if (log.has(key)) return { count: 0 };
        log.add(key);
        return { count: 1 };
      }),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    notification: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { notifications.push(data); return { id: `n${notifications.length}` }; }) },
  };
  const prisma = {
    vacancyRequest: { findMany: vi.fn(async () => requests) },
    hiringCase: { findMany: vi.fn(async () => []) },
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return { prisma: prisma as unknown as PrismaClient, notifications, raw: prisma };
}

describe('B4 due-date reminders', () => {
  it('Cairo day and hour', () => {
    expect(cairoDate(new Date('2026-10-18T22:30:00Z'))).toBe('2026-10-19');
    expect(cairoHour(new Date('2026-10-19T05:00:00Z'))).toBe(8);
  });
  it('kind: before (lead days), due, overdue', () => {
    expect(reminderKind('2026-10-16', '2026-10-19', [3, 1])).toBe('before');
    expect(reminderKind('2026-10-17', '2026-10-19', [3, 1])).toBeNull();
    expect(reminderKind('2026-10-18', '2026-10-19', [3, 1])).toBe('before');
    expect(reminderKind('2026-10-19', '2026-10-19', [3, 1])).toBe('due');
    expect(reminderKind('2026-10-25', '2026-10-19', [3, 1])).toBe('overdue');
  });
  it('config from env, default daily at 08:00 Cairo with lead days 3,1', () => {
    expect(dueReminderConfigFromEnv({})).toEqual({ enabled: true, leadDays: [3, 1], hour: 8 });
    expect(dueReminderConfigFromEnv({ DUE_REMINDER_ENABLED: 'false', DUE_REMINDER_LEAD_DAYS: '7, 2,x', DUE_REMINDER_HOUR_CAIRO: '6' })).toEqual({ enabled: false, leadDays: [7, 2], hour: 6 });
  });
  it('reminds the job owner on the due day, once per day (idempotent)', async () => {
    const { prisma, notifications } = fakePrisma([req({})]);
    expect(await sweepDueDateReminders(prisma, NOW, CONFIG)).toBe(1);
    expect(await sweepDueDateReminders(prisma, new Date('2026-10-19T15:00:00Z'), CONFIG)).toBe(0);
    expect(notifications).toEqual([expect.objectContaining({ recipientUserId: 'owner', type: 'DueDateReminder', title: 'Due today: HRIS Developer VAC-1, 1 of 3', entityType: 'Vacancy', entityId: 'v1' })]);
    // next day it is overdue -> a new reminder
    expect(await sweepDueDateReminders(prisma, new Date('2026-10-20T06:00:00Z'), CONFIG)).toBe(1);
    expect(notifications[1]!.title).toMatch(/^Overdue:/);
  });
  it('no reminders for Closed, Filled or held jobs; Cancelled/Rejected requisitions are not queried', async () => {
    const { prisma, notifications, raw } = fakePrisma([
      req({ id: 'a', vacancy: { id: 'v', vacancyCode: 'V', status: 'Closed', joinedHeadcount: 0, assignments: [{ userId: 'owner' }] } }),
      req({ id: 'b', vacancy: { id: 'v', vacancyCode: 'V', status: 'Filled', joinedHeadcount: 3, assignments: [{ userId: 'owner' }] } }),
      req({ id: 'c', vacancy: { id: 'v', vacancyCode: 'V', status: 'On Hold', joinedHeadcount: 0, assignments: [{ userId: 'owner' }] } }),
    ]);
    expect(await sweepDueDateReminders(prisma, NOW, CONFIG)).toBe(0);
    expect(notifications).toEqual([]);
    const where = (raw.vacancyRequest.findMany.mock.calls[0] as unknown as [{ where: { status: { in: string[] } } }])[0].where;
    expect(where.status.in).not.toContain('Cancelled');
    expect(where.status.in).not.toContain('Rejected');
  });
  it('pre-activation requisitions remind the requester; falls back to the assigned employee when the job has no owner', async () => {
    const { prisma, notifications } = fakePrisma([
      req({ id: 'draft', status: 'Draft', vacancy: null }),
      req({ id: 'noowner', vacancy: { id: 'v9', vacancyCode: 'V9', status: 'Open', joinedHeadcount: 0, assignments: [] } }),
    ]);
    expect(await sweepDueDateReminders(prisma, NOW, CONFIG)).toBe(2);
    expect(notifications.map((n) => n.recipientUserId)).toEqual(['mgr', 'emp']);
  });
  it('does nothing before the configured Cairo hour or when disabled', async () => {
    const { prisma } = fakePrisma([req({})]);
    expect(await sweepDueDateReminders(prisma, new Date('2026-10-19T04:00:00Z'), CONFIG)).toBe(0); // 07:00 Cairo
    expect(await sweepDueDateReminders(prisma, NOW, { ...CONFIG, enabled: false })).toBe(0);
  });
});

// Meeting notes 2026-11-25 (item 4): expected joining dates remind the case owner.
describe('due-date reminders — expected joining date', () => {
  function joiningCase(over: Record<string, unknown>) {
    return {
      id: 'case-1', organizationId: 'o', ownerUserId: 'owner', status: 'Awaiting Joining',
      plannedJoiningDate: new Date('2026-10-19T00:00:00Z'),
      application: {
        candidate: { firstName: 'Sara', lastName: 'Ali' },
        vacancy: { position: { title: 'ICU Nurse' } },
      },
      ...over,
    };
  }

  /** Fake Prisma honouring the hiring-case query (status + planned date) and the sent-log key. */
  function fakePrismaWithCases(cases: unknown[]) {
    const log = new Set<string>();
    const notifications: Array<Record<string, unknown>> = [];
    const tx = {
      dueDateReminder: {
        createMany: vi.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
          const d = data[0]!;
          const key = [d.entityType, d.entityId, d.kind, (d.reminderDate as Date).toISOString(), d.recipientUserId].join('|');
          if (log.has(key)) return { count: 0 };
          log.add(key);
          return { count: 1 };
        }),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      notification: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { notifications.push(data); return { id: `n${notifications.length}` }; }) },
    };
    const prisma = {
      vacancyRequest: { findMany: vi.fn(async () => []) },
      hiringCase: {
        findMany: vi.fn(async ({ where }: { where: { plannedJoiningDate: { lte: Date }; status: { in: string[] } } }) =>
          (cases as Array<{ plannedJoiningDate: Date | null; status: string }>).filter(
            (c) => c.plannedJoiningDate && c.plannedJoiningDate <= where.plannedJoiningDate.lte && where.status.in.includes(c.status),
          )),
      },
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    return { prisma: prisma as unknown as PrismaClient, notifications, raw: prisma };
  }

  it('reminds the case owner on the due day, once per day (idempotent)', async () => {
    const { prisma, notifications } = fakePrismaWithCases([joiningCase({})]);
    expect(await sweepDueDateReminders(prisma, NOW, CONFIG)).toBe(1);
    expect(await sweepDueDateReminders(prisma, new Date('2026-10-19T15:00:00Z'), CONFIG)).toBe(0);
    expect(notifications).toEqual([expect.objectContaining({
      recipientUserId: 'owner', type: 'DueDateReminder',
      title: 'Due today: Sara Ali · ICU Nurse joining', entityType: 'HiringCase', entityId: 'case-1',
    })]);
    // next day it is overdue -> a new reminder
    expect(await sweepDueDateReminders(prisma, new Date('2026-10-20T06:00:00Z'), CONFIG)).toBe(1);
    expect(notifications[1]!.title).toMatch(/^Overdue:/);
  });

  it('reminds 3 days before the expected joining date, and not in between lead days', async () => {
    const { prisma, notifications } = fakePrismaWithCases([
      joiningCase({ plannedJoiningDate: new Date('2026-10-22T00:00:00Z') }),
    ]);
    expect(await sweepDueDateReminders(prisma, NOW, CONFIG)).toBe(1);
    expect(notifications[0]!.title).toBe('Due 2026-10-22: Sara Ali · ICU Nurse joining');
    const twoDaysOut = fakePrismaWithCases([joiningCase({ plannedJoiningDate: new Date('2026-10-21T00:00:00Z') })]);
    expect(await sweepDueDateReminders(twoDaysOut.prisma, NOW, CONFIG)).toBe(0);
  });

  it('never reminds Joined, Postponed or No-show cases', async () => {
    const { prisma, notifications, raw } = fakePrismaWithCases([
      joiningCase({ id: 'joined', status: 'Joined' }),
      joiningCase({ id: 'postponed', status: 'Postponed' }),
      joiningCase({ id: 'noshow', status: 'No-show' }),
    ]);
    expect(await sweepDueDateReminders(prisma, NOW, CONFIG)).toBe(0);
    expect(notifications).toEqual([]);
    const where = (raw.hiringCase.findMany.mock.calls[0] as unknown as [{ where: { status: { in: string[] } } }])[0].where;
    expect(where.status.in).toEqual(['Pending Compliance', 'Pending Final Approval', 'Awaiting Joining']);
  });
});
