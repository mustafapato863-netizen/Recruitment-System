import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type {
  GenerateSelfScheduleInput,
  GenerateSelfScheduleResult,
  SelfScheduleInvitationView,
  CandidateSelfScheduleSlot,
  BookSelfScheduleInput,
  BookSelfScheduleResult,
  InterviewType,
} from '@recruitflow/contracts';
import { PrismaService } from '../database/prisma.service';
// Runtime service import must remain a value import for Nest DI metadata reflection.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { NotificationsService } from '../notifications/notifications.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { generateIcsCalendar } from './ics-generator';

export interface SelfScheduleTokenPayload {
  applicationId: string;
  organizationId: string;
  title: string;
  interviewType: InterviewType;
  durationMinutes: number;
  attendeeUserIds: string[];
  expiresAt: number; // timestamp in ms
  nonce: string;
}

function resolveHmacSecret(): string {
  const configured = process.env.SELF_SCHEDULE_SECRET;
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SELF_SCHEDULE_SECRET must be configured (min 32 chars) in production');
  }
  return 'recruitflow-dev-self-schedule-secret-key-2026';
}

const HMAC_SECRET = resolveHmacSecret();

@Injectable()
export class SelfScheduleService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  signPayload(payload: SelfScheduleTokenPayload): string {
    const jsonStr = JSON.stringify(payload);
    const dataPart = Buffer.from(jsonStr, 'utf8').toString('base64url');
    const hmac = createHmac('sha256', HMAC_SECRET).update(dataPart).digest('base64url');
    return `${dataPart}.${hmac}`;
  }

  verifyToken(token: string): SelfScheduleTokenPayload {
    if (!token || typeof token !== 'string') {
      throw new BadRequestException('Self-schedule token is required.');
    }
    const parts = token.split('.');
    if (parts.length !== 2) {
      throw new BadRequestException('Malformed self-schedule token.');
    }

    const dataPart = parts[0];
    const signaturePart = parts[1];
    if (!dataPart || !signaturePart) {
      throw new BadRequestException('Malformed self-schedule token parts.');
    }

    const expectedSignature = createHmac('sha256', HMAC_SECRET).update(dataPart).digest('base64url');

    const sigA = Buffer.from(signaturePart, 'utf8');
    const sigB = Buffer.from(expectedSignature, 'utf8');

    if (sigA.length !== sigB.length || !timingSafeEqual(sigA, sigB)) {
      throw new BadRequestException('Invalid self-schedule token signature.');
    }

    try {
      const decodedJson = Buffer.from(dataPart, 'base64url').toString('utf8');
      const payload = JSON.parse(decodedJson) as SelfScheduleTokenPayload;

      if (Date.now() > payload.expiresAt) {
        throw new BadRequestException('This self-scheduling invitation link has expired. Please contact the recruiter for a new link.');
      }

      return payload;
    } catch (err: unknown) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('Invalid self-schedule token content.');
    }
  }

  async createInvitationLink(
    organizationId: string,
    input: GenerateSelfScheduleInput,
  ): Promise<GenerateSelfScheduleResult> {
    const app = await this.prisma.application.findUnique({
      where: { id: input.applicationId },
      include: { candidate: true, vacancy: { include: { position: true } } },
    });

    if (!app || app.organizationId !== organizationId) {
      throw new NotFoundException(`Application ${input.applicationId} was not found.`);
    }

    const durationMinutes = input.durationMinutes && input.durationMinutes > 0 ? input.durationMinutes : 45;
    const expiresInHours = input.expiresInHours && input.expiresInHours > 0 ? input.expiresInHours : 72;
    const expiresAt = Date.now() + expiresInHours * 3600 * 1000;
    const nonce = randomBytes(8).toString('hex');

    const attendeeUserIds = [...new Set(input.attendeeUserIds || [])];
    if (attendeeUserIds.length > 0) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: attendeeUserIds }, organizationId, status: 'Active' },
        select: { id: true },
      });
      if (users.length !== attendeeUserIds.length) {
        throw new BadRequestException('One or more selected interviewers were not found or are inactive.');
      }
    }

    const payload: SelfScheduleTokenPayload = {
      applicationId: app.id,
      organizationId,
      title: input.title.trim(),
      interviewType: input.interviewType,
      durationMinutes,
      attendeeUserIds,
      expiresAt,
      nonce,
    };

    const token = this.signPayload(payload);
    const scheduleUrl = `/schedule/${token}`;

    // Add note to candidate application activity chatter
    await this.prisma.applicationNote.create({
      data: {
        organizationId,
        applicationId: app.id,
        authorId: null,
        content: `Generated candidate self-schedule invitation link for "${payload.title}" (${durationMinutes} mins, expires in ${expiresInHours}h).`,
      },
    });

    return {
      token,
      scheduleUrl,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  async getInvitationView(token: string): Promise<SelfScheduleInvitationView> {
    const payload = this.verifyToken(token);

    const app = await this.prisma.application.findUnique({
      where: { id: payload.applicationId },
      include: {
        candidate: true,
        vacancy: { include: { position: true } },
      },
    });

    if (!app || app.organizationId !== payload.organizationId) {
      throw new NotFoundException('Application associated with this link is no longer available.');
    }

    // Check if an interview has already been scheduled from this or matching title
    const existing = await this.prisma.interview.findFirst({
      where: {
        applicationId: app.id,
        title: payload.title,
        status: { in: ['Scheduled', 'Completed'] },
      },
    });

    if (existing) {
      throw new BadRequestException(
        `An interview for "${payload.title}" has already been scheduled on ${existing.scheduledStart.toUTCString()}.`,
      );
    }

    // Compute candidate available slots
    const availableSlots = await this.computeAvailableSlots(
      payload.organizationId,
      payload.attendeeUserIds,
      payload.durationMinutes,
    );

    const candidateName = app.candidate
      ? `${app.candidate.firstName} ${app.candidate.lastName}`
      : 'Applicant';
    const positionTitle = app.vacancy?.position?.title || 'Open Position';

    return {
      valid: true,
      candidateName,
      positionTitle,
      interviewTitle: payload.title,
      interviewType: payload.interviewType,
      durationMinutes: payload.durationMinutes,
      timezone: 'Asia/Riyadh',
      availableSlots,
      expiresAt: new Date(payload.expiresAt).toISOString(),
    };
  }

  async bookSelfSchedule(
    token: string,
    input: BookSelfScheduleInput,
  ): Promise<BookSelfScheduleResult> {
    const payload = this.verifyToken(token);

    const app = await this.prisma.application.findUnique({
      where: { id: payload.applicationId },
      include: {
        candidate: true,
        vacancy: { include: { position: true } },
      },
    });

    if (!app || app.organizationId !== payload.organizationId) {
      throw new NotFoundException('Application not found.');
    }

    const proposedStart = new Date(input.selectedSlot);
    if (isNaN(proposedStart.getTime())) {
      throw new BadRequestException('Invalid selected slot date time.');
    }

    if (proposedStart.getTime() < Date.now()) {
      throw new BadRequestException('Selected time slot is in the past.');
    }

    const proposedEnd = new Date(proposedStart.getTime() + payload.durationMinutes * 60 * 1000);

    // Check for conflicting interviews for the interviewers
    if (payload.attendeeUserIds.length > 0) {
      const conflicts = await this.prisma.interview.findMany({
        where: {
          organizationId: payload.organizationId,
          status: { not: 'Cancelled' },
          scheduledStart: { lt: proposedEnd },
          scheduledEnd: { gt: proposedStart },
          attendees: {
            some: {
              userId: { in: payload.attendeeUserIds },
            },
          },
        },
        include: {
          attendees: { include: { user: true } },
        },
      });

      if (conflicts.length > 0) {
        throw new ConflictException(
          'The selected slot is no longer available as an interviewer became occupied. Please select another time slot.',
        );
      }
    }

    const interviewCode = await this.nextInterviewCode();

    const created = await this.prisma.$transaction(async (tx) => {
      const item = await tx.interview.create({
        data: {
          organizationId: payload.organizationId,
          interviewCode,
          applicationId: payload.applicationId,
          title: payload.title,
          interviewType: payload.interviewType,
          scheduledStart: proposedStart,
          scheduledEnd: proposedEnd,
          timezone: input.timezone || 'Asia/Riyadh',
          locationUrl: 'https://teams.microsoft.com/l/meetup-join/sgh-telehealth',
          status: 'Scheduled',
        },
      });

      if (payload.attendeeUserIds.length > 0) {
        await tx.interviewAttendee.createMany({
          data: payload.attendeeUserIds.map((userId) => ({
            interviewId: item.id,
            userId,
            role: 'Interviewer',
            response: 'Accepted',
          })),
        });
      }

      await tx.applicationNote.create({
        data: {
          organizationId: payload.organizationId,
          applicationId: payload.applicationId,
          authorId: null,
          content: `Candidate self-scheduled "${payload.title}" for ${proposedStart.toUTCString()} (Asia/Riyadh). Notes: ${
            input.candidateNotes?.trim() || 'None provided'
          }`,
        },
      });

      return item;
    });

    const candidateName = app.candidate
      ? `${app.candidate.firstName} ${app.candidate.lastName}`
      : 'Candidate';

    // Notify attendees
    for (const attendeeUserId of payload.attendeeUserIds) {
      await this.notifications.create({
        organizationId: payload.organizationId,
        recipientUserId: attendeeUserId,
        type: 'InterviewScheduled',
        title: 'Interview Self-Scheduled by Candidate',
        message: `${candidateName} has booked their "${payload.title}" interview for ${proposedStart.toLocaleString(
          'en-US',
          { timeZone: 'Asia/Riyadh' },
        )} (Asia/Riyadh).`,
        entityType: 'Interview',
        entityId: created.id,
      });
    }

    // Enqueue confirmation email with .ics calendar attachment to candidate
    if (app.candidate?.email) {
      const icsData = generateIcsCalendar({
        uid: `${created.interviewCode}@recruitflow.sghgroup.sa`,
        title: created.title,
        description: `Saudi German Health Recruitment: ${created.title} with ${candidateName}.`,
        location: created.locationUrl,
        start: created.scheduledStart,
        end: created.scheduledEnd,
        organizerName: 'Saudi German Health Recruitment',
        organizerEmail: 'careers@sghgroup.sa',
        attendees: [{ name: candidateName, email: app.candidate.email }],
      });

      await this.prisma.emailOutbox.create({
        data: {
          organizationId: payload.organizationId,
          toEmail: app.candidate.email,
          subject: `Interview Confirmed: ${created.title} - Saudi German Health`,
          template: 'interview-self-schedule-confirmation',
          payload: {
            candidateName,
            interviewTitle: created.title,
            scheduledStart: created.scheduledStart.toISOString(),
            scheduledEnd: created.scheduledEnd.toISOString(),
            timezone: created.timezone,
            locationUrl: created.locationUrl,
            icsContent: icsData,
          },
          status: 'Pending',
        },
      });
    }

    return {
      success: true,
      interviewId: created.id,
      interviewCode: created.interviewCode,
      scheduledStart: created.scheduledStart.toISOString(),
      scheduledEnd: created.scheduledEnd.toISOString(),
      message: 'Interview booked successfully! A calendar invitation has been sent to your email.',
    };
  }

  /**
   * Generates next 5 business days of available slots (09:00 - 17:00 Asia/Riyadh)
   * excluding any existing interviews of the assigned interviewers.
   */
  private async computeAvailableSlots(
    organizationId: string,
    attendeeUserIds: string[],
    durationMinutes: number,
  ): Promise<CandidateSelfScheduleSlot[]> {
    const slots: CandidateSelfScheduleSlot[] = [];
    const now = new Date();

    // Start from tomorrow
    const currentDay = new Date(now);
    currentDay.setUTCDate(currentDay.getUTCDate() + 1);
    currentDay.setUTCHours(0, 0, 0, 0);

    // Business hours in Asia/Riyadh (UTC+3):
    // 09:00 AST = 06:00 UTC
    // 17:00 AST = 14:00 UTC
    const startHourUtc = 6;
    const endHourUtc = 14;

    // Fetch all existing interviews for these interviewers in the next 10 days
    const rangeEnd = new Date(currentDay);
    rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 10);

    const existingInterviews = attendeeUserIds.length > 0
      ? await this.prisma.interview.findMany({
          where: {
            organizationId,
            status: { not: 'Cancelled' },
            scheduledStart: { gte: currentDay, lte: rangeEnd },
            attendees: {
              some: { userId: { in: attendeeUserIds } },
            },
          },
          select: { scheduledStart: true, scheduledEnd: true },
        })
      : [];

    let businessDaysAdded = 0;
    let dayOffset = 0;

    while (businessDaysAdded < 5 && dayOffset < 14) {
      const candidateDate = new Date(currentDay);
      candidateDate.setUTCDate(candidateDate.getUTCDate() + dayOffset);
      dayOffset++;

      const dayOfWeek = candidateDate.getUTCDay();
      // Skip Friday (5) and Saturday (6) in Saudi healthcare calendar
      if (dayOfWeek === 5 || dayOfWeek === 6) {
        continue;
      }

      businessDaysAdded++;

      // Slot generator across business hours
      let slotTimeUtc = new Date(candidateDate);
      slotTimeUtc.setUTCHours(startHourUtc, 0, 0, 0);

      const dayEndUtc = new Date(candidateDate);
      dayEndUtc.setUTCHours(endHourUtc, 0, 0, 0);

      while (slotTimeUtc.getTime() + durationMinutes * 60 * 1000 <= dayEndUtc.getTime()) {
        const slotStart = new Date(slotTimeUtc);
        const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000);

        // Check if slot clashes with any existing interview
        const hasClash = existingInterviews.some((int) => {
          return slotStart < int.scheduledEnd && int.scheduledStart < slotEnd;
        });

        if (!hasClash) {
          const formatted = slotStart.toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Riyadh',
          });

          slots.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
            formattedTime: `${formatted} AST`,
          });
        }

        // Advance by slot duration (or 60 mins for 45 min slots)
        const stepMinutes = durationMinutes <= 45 ? 60 : durationMinutes;
        slotTimeUtc = new Date(slotTimeUtc.getTime() + stepMinutes * 60 * 1000);
      }
    }

    return slots;
  }

  private async nextInterviewCode(): Promise<string> {
    const year = new Date().getUTCFullYear();
    const seq = await this.prisma.codeSequence.upsert({
      where: { key: `INT:${year}` },
      create: { key: `INT:${year}`, lastIssued: 1 },
      update: { lastIssued: { increment: 1 } },
    });
    return `INT-${year}-${String(seq.lastIssued).padStart(3, '0')}`;
  }
}
