import type { PrismaClient } from '@recruitflow/database';

/**
 * B4 (v2 §1/§8): due-date reminders for requisitions and their jobs.
 *
 * - "before": N days before the due date (DUE_REMINDER_LEAD_DAYS, default "3,1")
 * - "due": on the due date
 * - "overdue": every day after the due date while the item is still open
 *
 * Dates are Africa/Cairo calendar days. The due date is the requisition's
 * targetFillDate (v2 "due date"). Idempotent: one row per item, kind, Cairo day
 * and recipient in due_date_reminders (unique key); duplicates are skipped.
 * Notifications go through the existing in-app notifications table.
 *
 * Who is reminded:
 * - requisition not yet activated (Draft, Changes Requested, Pending Approval, Approved): the requester
 * - activated requisition: the job's active PRIMARY owner(s), else the assigned employee,
 *   only while the job is Open or Partially Filled (On Hold is off My Work; Filled/Closed are done)
 * - Cancelled / Rejected requisitions: never
 */
export const REMINDER_TIMEZONE = 'Africa/Cairo';
const PRE_ACTIVATION = ['Draft', 'Changes Requested', 'Pending Approval', 'Approved'];
const LIVE_JOB = ['Open', 'Partially Filled'];

export interface DueReminderConfig {
  enabled: boolean;
  leadDays: number[];
  /** Cairo hour (0-23) from which the daily run may send. */
  hour: number;
}

export function dueReminderConfigFromEnv(env: NodeJS.ProcessEnv): DueReminderConfig {
  const leadDays = (env.DUE_REMINDER_LEAD_DAYS ?? '3,1')
    .split(',')
    .map((v) => Number.parseInt(v.trim(), 10))
    .filter((v) => Number.isInteger(v) && v > 0 && v <= 60);
  const hour = Number.parseInt(env.DUE_REMINDER_HOUR_CAIRO ?? '8', 10);
  return {
    enabled: !['false', '0'].includes((env.DUE_REMINDER_ENABLED ?? 'true').trim().toLowerCase()),
    leadDays: leadDays.length ? [...new Set(leadDays)] : [3, 1],
    hour: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 8,
  };
}

/** YYYY-MM-DD of `now` in Cairo. */
export function cairoDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: REMINDER_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function cairoHour(now: Date): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: REMINDER_TIMEZONE, hour: '2-digit', hourCycle: 'h23' }).format(now));
}

function dayDiff(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export type ReminderKind = 'before' | 'due' | 'overdue';

export function reminderKind(today: string, due: string, leadDays: number[]): ReminderKind | null {
  const left = dayDiff(today, due);
  if (left < 0) return 'overdue';
  if (left === 0) return 'due';
  return leadDays.includes(left) ? 'before' : null;
}

export async function sweepDueDateReminders(
  prisma: PrismaClient,
  now: Date = new Date(),
  config: DueReminderConfig = dueReminderConfigFromEnv(process.env),
): Promise<number> {
  if (!config.enabled || cairoHour(now) < config.hour) return 0;
  const today = cairoDate(now);
  const maxLead = Math.max(0, ...config.leadDays);
  const horizon = new Date(Date.parse(`${today}T00:00:00Z`) + maxLead * 86_400_000);

  const requests = await prisma.vacancyRequest.findMany({
    where: {
      targetFillDate: { not: null, lte: horizon },
      status: { in: [...PRE_ACTIVATION, 'Converted to Vacancy'] },
    },
    select: {
      id: true,
      organizationId: true,
      requestCode: true,
      status: true,
      requesterId: true,
      assignedEmployeeId: true,
      requestedHeadcount: true,
      targetFillDate: true,
      position: { select: { title: true } },
      vacancy: {
        select: {
          id: true,
          vacancyCode: true,
          status: true,
          joinedHeadcount: true,
          assignments: { where: { isActive: true, assignmentKind: 'PRIMARY', user: { status: 'Active' } }, select: { userId: true } },
        },
      },
    },
    take: 500,
  });

  let sent = 0;
  for (const request of requests) {
    const due = request.targetFillDate!.toISOString().slice(0, 10);
    const kind = reminderKind(today, due, config.leadDays);
    if (!kind) continue;

    let recipients: string[];
    let subject = `Requisition ${request.requestCode}`;
    if (request.status === 'Converted to Vacancy') {
      const job = request.vacancy;
      if (!job || !LIVE_JOB.includes(job.status)) continue;
      recipients = job.assignments.map((a) => a.userId);
      if (!recipients.length && request.assignedEmployeeId) recipients = [request.assignedEmployeeId];
      subject = `${request.position?.title ?? 'Job'} ${job.vacancyCode}, ${job.joinedHeadcount} of ${request.requestedHeadcount}`;
    } else {
      recipients = [request.requesterId];
    }

    const title = kind === 'overdue' ? `Overdue: ${subject}` : kind === 'due' ? `Due today: ${subject}` : `Due ${due}: ${subject}`;
    const message = kind === 'overdue'
      ? `${subject} was due on ${due} and is still open.`
      : kind === 'due' ? `${subject} is due today (${due}).` : `${subject} is due on ${due}.`;

    for (const recipientUserId of [...new Set(recipients)]) {
      const created = await prisma.$transaction(async (tx) => {
        const claim = await tx.dueDateReminder.createMany({
          data: [{ organizationId: request.organizationId, entityType: 'VacancyRequest', entityId: request.id, kind, reminderDate: new Date(`${today}T00:00:00Z`), recipientUserId }],
          skipDuplicates: true,
        });
        if (claim.count === 0) return false;
        const notification = await tx.notification.create({
          data: {
            organizationId: request.organizationId,
            recipientUserId,
            type: 'DueDateReminder',
            title: title.slice(0, 255),
            message,
            entityType: request.vacancy && request.status === 'Converted to Vacancy' ? 'Vacancy' : 'VacancyRequest',
            entityId: request.vacancy && request.status === 'Converted to Vacancy' ? request.vacancy.id : request.id,
          },
        });
        await tx.dueDateReminder.updateMany({
          where: { entityType: 'VacancyRequest', entityId: request.id, kind, reminderDate: new Date(`${today}T00:00:00Z`), recipientUserId },
          data: { notificationId: notification.id },
        });
        return true;
      });
      if (created) sent += 1;
    }
  }
  return sent;
}
