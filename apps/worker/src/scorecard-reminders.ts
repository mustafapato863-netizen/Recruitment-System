import type { PrismaClient } from '@recruitflow/database';
import { cairoDate } from './due-reminders';

/**
 * B5 follow-up: remind interviewers whose scorecard is missing after the interview
 * ended. In-app only, at most once per Cairo day per interview and interviewer,
 * idempotent through the B4 reminder sent-log (due_date_reminders, kind "scorecard").
 * Skips cancelled interviews and files that already left the pipeline.
 */
export const SCORECARD_REMINDER_KIND = 'scorecard';
const LOOKBACK_DAYS = 14;

export async function sweepScorecardReminders(prisma: PrismaClient, now: Date = new Date()): Promise<number> {
  if (['false', '0'].includes((process.env.SCORECARD_REMINDER_ENABLED ?? 'true').trim().toLowerCase())) return 0;
  const today = cairoDate(now);
  const reminderDate = new Date(`${today}T00:00:00Z`);
  const interviews = await prisma.interview.findMany({
    where: {
      scheduledEnd: { lte: now, gte: new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000) },
      status: { notIn: ['Cancelled'] },
      application: { stage: { notIn: ['Rejected', 'Joined'] } },
    },
    select: {
      id: true, organizationId: true, title: true, scheduledEnd: true,
      attendees: { select: { userId: true, user: { select: { status: true } } } },
      scorecards: { where: { status: 'Submitted' }, select: { interviewerId: true } },
    },
    take: 500,
  });
  let sent = 0;
  for (const iv of interviews) {
    const done = new Set(iv.scorecards.map((s) => s.interviewerId));
    for (const a of iv.attendees) {
      if (done.has(a.userId) || a.user?.status !== 'Active') continue;
      const created = await prisma.$transaction(async (tx) => {
        const claim = await tx.dueDateReminder.createMany({
          data: [{ organizationId: iv.organizationId, entityType: 'Interview', entityId: iv.id, kind: SCORECARD_REMINDER_KIND, reminderDate, recipientUserId: a.userId }],
          skipDuplicates: true,
        });
        if (claim.count === 0) return false;
        const n = await tx.notification.create({
          data: {
            organizationId: iv.organizationId, recipientUserId: a.userId, type: 'ScorecardReminder',
            title: `Scorecard missing: ${iv.title}`.slice(0, 255),
            message: `The interview "${iv.title}" ended; please submit your scorecard.`,
            entityType: 'Interview', entityId: iv.id,
          },
        });
        await tx.dueDateReminder.updateMany({ where: { entityType: 'Interview', entityId: iv.id, kind: SCORECARD_REMINDER_KIND, reminderDate, recipientUserId: a.userId }, data: { notificationId: n.id } });
        return true;
      });
      if (created) sent += 1;
    }
  }
  return sent;
}
