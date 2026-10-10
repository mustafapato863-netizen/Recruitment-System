import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@recruitflow/database';
import { sweepScorecardReminders } from '../scorecard-reminders';

function fake(interviews: unknown[]) {
  const log = new Set<string>();
  const notifications: Array<Record<string, unknown>> = [];
  const keys: string[] = [];
  const tx = {
    dueDateReminder: {
      createMany: vi.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
        const d = data[0]!;
        const key = [d.entityType, d.entityId, d.kind, (d.reminderDate as Date).toISOString(), d.recipientUserId].join('|');
        keys.push(key);
        if (log.has(key)) return { count: 0 };
        log.add(key);
        return { count: 1 };
      }),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    notification: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { notifications.push(data); return { id: `n${notifications.length}` }; }) },
  };
  const findMany = vi.fn(async () => interviews);
  const prisma = { interview: { findMany }, $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) };
  return { prisma: prisma as unknown as PrismaClient, notifications, keys, findMany };
}

const iv = (over: Record<string, unknown> = {}) => ({
  id: 'i1', organizationId: 'o', title: 'Panel', scheduledEnd: new Date('2026-10-19T07:00:00Z'),
  attendees: [{ userId: 'a', user: { status: 'Active' } }, { userId: 'b', user: { status: 'Active' } }, { userId: 'gone', user: { status: 'Inactive' } }],
  scorecards: [{ interviewerId: 'b' }],
  ...over,
});

describe('B5 scorecard reminders (worker)', () => {
  it('reminds only interviewers whose submitted scorecard is missing, in-app, once per Cairo day', async () => {
    const f = fake([iv()]);
    const now = new Date('2026-10-19T08:00:00Z'); // 11:00 Cairo, after the interview ended
    expect(await sweepScorecardReminders(f.prisma, now)).toBe(1);
    expect(f.notifications).toEqual([expect.objectContaining({ recipientUserId: 'a', type: 'ScorecardReminder', entityType: 'Interview', entityId: 'i1' })]);
    expect(await sweepScorecardReminders(f.prisma, new Date('2026-10-19T20:00:00Z'))).toBe(0); // same Cairo day (23:00)
    expect(f.keys.at(-1)).toContain('Interview|i1|scorecard|2026-10-19T00:00:00.000Z|a');
    expect(await sweepScorecardReminders(f.prisma, new Date('2026-10-19T21:30:00Z'))).toBe(1); // 00:30 Cairo next day
    expect(f.keys.at(-1)).toContain('2026-10-20T00:00:00.000Z');
  });

  it('queries only ended, non-cancelled interviews on open files, and can be switched off', async () => {
    const f = fake([]);
    const now = new Date('2026-10-19T08:00:00Z');
    await sweepScorecardReminders(f.prisma, now);
    const where = (f.findMany.mock.calls[0] as unknown as [{ where: Record<string, unknown> }])[0].where as { scheduledEnd: { lte: Date }; status: unknown; application: unknown };
    expect(where.scheduledEnd.lte).toBe(now);
    expect(where.status).toEqual({ notIn: ['Cancelled'] });
    expect(where.application).toEqual({ stage: { notIn: ['Rejected', 'Joined'] } });
    process.env.SCORECARD_REMINDER_ENABLED = 'false';
    try { expect(await sweepScorecardReminders(fake([iv()]).prisma, now)).toBe(0); } finally { delete process.env.SCORECARD_REMINDER_ENABLED; }
  });
});
