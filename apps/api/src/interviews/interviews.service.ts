import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@recruitflow/database';
import type {
  Interview,
  InterviewStatus,
  InterviewType,
  InterviewScorecardItem,
  InterviewerConflict,
  AvailabilityResult,
} from '@recruitflow/contracts';
import { PrismaService } from '../database/prisma.service';
// Runtime service import must remain a value import for Nest DI metadata reflection.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { NotificationsService } from '../notifications/notifications.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type {
  CreateInterviewDto,
  InterviewQueryDto,
  SubmitScorecardDto,
  UpdateInterviewDto,
} from './interviews.dto';
import { generateIcsCalendar } from './ics-generator';

@Injectable()
export class InterviewsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async listInterviews(
    organizationId: string,
    query: InterviewQueryDto,
  ): Promise<Interview[]> {
    const where: Prisma.InterviewWhereInput = { organizationId };

    if (query.applicationId) where.applicationId = query.applicationId;
    if (query.status) where.status = query.status;
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { interviewCode: { contains: term, mode: 'insensitive' } },
        { application: { candidate: { firstName: { contains: term, mode: 'insensitive' } } } },
        { application: { candidate: { lastName: { contains: term, mode: 'insensitive' } } } },
      ];
    }

    const items = await this.prisma.interview.findMany({
      where,
      include: {
        application: {
          include: {
            candidate: true,
            vacancy: { include: { position: true } },
          },
        },
        attendees: { include: { user: true } },
        scorecards: { include: { interviewer: true } },
      },
      orderBy: { scheduledStart: 'asc' },
    });

    return items.map((item) => this.toInterview(item));
  }

  async getInterview(organizationId: string, id: string): Promise<Interview> {
    const interview = await this.prisma.interview.findUnique({
      where: { id },
      include: {
        application: {
          include: {
            candidate: true,
            vacancy: { include: { position: true } },
          },
        },
        attendees: { include: { user: true } },
        scorecards: { include: { interviewer: true } },
      },
    });

    if (!interview || interview.organizationId !== organizationId) {
      throw new NotFoundException(`Interview ${id} was not found.`);
    }

    return this.toInterview(interview);
  }

  async checkConflicts(
    organizationId: string,
    attendeeUserIds: string[],
    start: Date,
    end: Date,
    excludeInterviewId?: string,
  ): Promise<InterviewerConflict[]> {
    if (!attendeeUserIds || attendeeUserIds.length === 0) return [];

    const where: Prisma.InterviewWhereInput = {
      organizationId,
      status: { not: 'Cancelled' },
      scheduledStart: { lt: end },
      scheduledEnd: { gt: start },
      attendees: {
        some: {
          userId: { in: attendeeUserIds },
        },
      },
    };

    if (excludeInterviewId) {
      where.id = { not: excludeInterviewId };
    }

    const conflictingInterviews = await this.prisma.interview.findMany({
      where,
      include: {
        attendees: {
          include: { user: true },
        },
      },
    });

    const conflicts: InterviewerConflict[] = [];
    for (const item of conflictingInterviews) {
      for (const att of item.attendees) {
        if (attendeeUserIds.includes(att.userId)) {
          conflicts.push({
            interviewerId: att.userId,
            interviewerName: att.user?.displayName || 'Interviewer',
            interviewId: item.id,
            title: item.title,
            scheduledStart: item.scheduledStart.toISOString(),
            scheduledEnd: item.scheduledEnd.toISOString(),
          });
        }
      }
    }

    return conflicts;
  }

  async getAvailability(
    organizationId: string,
    attendeeUserIds: string[],
    startStr: string,
    endStr: string,
    excludeInterviewId?: string,
  ): Promise<AvailabilityResult> {
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      throw new BadRequestException('Invalid date range for availability check.');
    }

    const conflicts = await this.checkConflicts(
      organizationId,
      attendeeUserIds,
      start,
      end,
      excludeInterviewId,
    );

    return {
      conflicts,
      hasConflict: conflicts.length > 0,
    };
  }

  async createInterview(
    organizationId: string,
    dto: CreateInterviewDto,
  ): Promise<Interview> {
    const app = await this.prisma.application.findUnique({
      where: { id: dto.applicationId },
      include: { candidate: true },
    });

    if (!app || app.organizationId !== organizationId) {
      throw new NotFoundException(`Application ${dto.applicationId} was not found.`);
    }

    const start = new Date(dto.scheduledStart);
    const end = new Date(dto.scheduledEnd);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      throw new BadRequestException('Scheduled end time must be strictly after start time.');
    }

    const attendeeUserIds = [...new Set(dto.attendeeUserIds)];
    if (attendeeUserIds.length > 0) {
      const attendees = await this.prisma.user.findMany({
        where: { id: { in: attendeeUserIds }, organizationId, status: 'Active' },
        select: { id: true },
      });
      if (attendees.length !== attendeeUserIds.length) {
        throw new NotFoundException('One or more interview attendees were not found in this organization.');
      }
    }

    // Conflict detection check
    if (!dto.allowConflict && attendeeUserIds.length > 0) {
      const conflicts = await this.checkConflicts(organizationId, attendeeUserIds, start, end);
      if (conflicts.length > 0) {
        const first = conflicts[0];
        const clashName = first?.interviewerName || 'An interviewer';
        const clashTitle = first?.title || 'an interview';
        throw new ConflictException(
          `Schedule clash: ${clashName} already has "${clashTitle}" scheduled during this time. Please choose another slot or enable conflict override.`,
        );
      }
    }

    const interviewCode = await this.nextInterviewCode();

    const created = await this.prisma.$transaction(async (tx) => {
      const item = await tx.interview.create({
        data: {
          organizationId,
          interviewCode,
          applicationId: dto.applicationId,
          title: dto.title.trim(),
          interviewType: dto.interviewType,
          scheduledStart: start,
          scheduledEnd: end,
          timezone: dto.timezone?.trim() ?? 'UTC',
          locationUrl: dto.locationUrl?.trim() ?? null,
          status: 'Scheduled',
        },
      });

      if (dto.attendeeUserIds.length > 0) {
        await tx.interviewAttendee.createMany({
          data: attendeeUserIds.map((userId) => ({
            interviewId: item.id,
            userId,
            role: 'Interviewer',
            response: 'Accepted',
          })),
        });
      }

      // Log to application activity chatter (authorId = null indicates system actor)
      await tx.applicationNote.create({
        data: {
          organizationId,
          applicationId: dto.applicationId,
          authorId: null,
          content: `Scheduled ${dto.interviewType} Interview: "${dto.title}" for ${start.toLocaleString(
            'en-US',
            { timeZone: dto.timezone || 'Asia/Riyadh' },
          )}.`,
        },
      });

      return tx.interview.findUniqueOrThrow({
        where: { id: item.id },
        include: {
          application: {
            include: {
              candidate: true,
              vacancy: { include: { position: true } },
            },
          },
          attendees: { include: { user: true } },
          scorecards: { include: { interviewer: true } },
        },
      });
    });

    const candidateName = created.application?.candidate
      ? `${created.application.candidate.firstName} ${created.application.candidate.lastName}`
      : 'a candidate';
    for (const attendee of created.attendees) {
      await this.notifications.create({
        organizationId,
        recipientUserId: attendee.userId,
        type: 'InterviewScheduled',
        title: 'Interview scheduled',
        message: `You are an interviewer for "${created.title}" (${candidateName}) on ${created.scheduledStart.toISOString()}.`,
        entityType: 'Interview',
        entityId: created.id,
      });
    }

    // Touch calendar sync timestamp if integration is enabled
    await this.notifyCalendarIntegration(organizationId);

    return this.toInterview(created);
  }

  async updateInterview(
    organizationId: string,
    id: string,
    dto: UpdateInterviewDto,
  ): Promise<Interview> {
    const existing = await this.prisma.interview.findUnique({
      where: { id },
      include: {
        attendees: true,
        application: { include: { candidate: true } },
      },
    });

    if (!existing || existing.organizationId !== organizationId) {
      throw new NotFoundException(`Interview ${id} was not found.`);
    }

    const dataToUpdate: Prisma.InterviewUpdateInput = {};
    if (dto.title) dataToUpdate.title = dto.title.trim();

    const newStart = dto.scheduledStart ? new Date(dto.scheduledStart) : existing.scheduledStart;
    const newEnd = dto.scheduledEnd ? new Date(dto.scheduledEnd) : existing.scheduledEnd;

    if (dto.scheduledStart || dto.scheduledEnd) {
      if (newStart >= newEnd) {
        throw new BadRequestException('Scheduled end time must be strictly after start time.');
      }

      // Check conflict on reschedule
      if (!dto.allowConflict && existing.attendees.length > 0) {
        const attendeeIds = existing.attendees.map((a) => a.userId);
        const conflicts = await this.checkConflicts(
          organizationId,
          attendeeIds,
          newStart,
          newEnd,
          existing.id,
        );
        if (conflicts.length > 0) {
          const first = conflicts[0];
          const clashName = first?.interviewerName || 'An interviewer';
          const clashTitle = first?.title || 'an interview';
          throw new ConflictException(
            `Reschedule conflict: ${clashName} has an overlapping interview "${clashTitle}".`,
          );
        }
      }

      dataToUpdate.scheduledStart = newStart;
      dataToUpdate.scheduledEnd = newEnd;
    }

    if (dto.locationUrl !== undefined) dataToUpdate.locationUrl = dto.locationUrl?.trim() ?? null;
    if (dto.status) dataToUpdate.status = dto.status;

    const updated = await this.prisma.interview.update({
      where: { id },
      data: dataToUpdate,
      include: {
        application: {
          include: {
            candidate: true,
            vacancy: { include: { position: true } },
          },
        },
        attendees: { include: { user: true } },
        scorecards: { include: { interviewer: true } },
      },
    });

    // Handle cancellation or rescheduling chatter notes and notifications
    if (dto.status === 'Cancelled') {
      const reasonText = dto.cancellationReason ? ` Reason: ${dto.cancellationReason}` : '';
      await this.prisma.applicationNote.create({
        data: {
          organizationId,
          applicationId: updated.applicationId,
          authorId: null,
          content: `Cancelled Interview "${updated.title}".${reasonText}`,
        },
      });

      for (const attendee of updated.attendees) {
        await this.notifications.create({
          organizationId,
          recipientUserId: attendee.userId,
          type: 'InterviewCancelled',
          title: 'Interview Cancelled',
          message: `Interview "${updated.title}" scheduled for ${updated.scheduledStart.toISOString()} has been cancelled.${reasonText}`,
          entityType: 'Interview',
          entityId: updated.id,
        });
      }
    } else if (dto.status === 'Rescheduled' || dto.scheduledStart || dto.scheduledEnd) {
      const reasonText = dto.rescheduleReason ? ` Reason: ${dto.rescheduleReason}` : '';
      await this.prisma.applicationNote.create({
        data: {
          organizationId,
          applicationId: updated.applicationId,
          authorId: null,
          content: `Rescheduled Interview "${updated.title}" to ${updated.scheduledStart.toUTCString()}.${reasonText}`,
        },
      });

      for (const attendee of updated.attendees) {
        await this.notifications.create({
          organizationId,
          recipientUserId: attendee.userId,
          type: 'InterviewRescheduled',
          title: 'Interview Rescheduled',
          message: `Interview "${updated.title}" has been moved to ${updated.scheduledStart.toISOString()}.${reasonText}`,
          entityType: 'Interview',
          entityId: updated.id,
        });
      }
    }

    await this.notifyCalendarIntegration(organizationId);

    return this.toInterview(updated);
  }

  async getInterviewIcs(organizationId: string, id: string): Promise<string> {
    const interview = await this.prisma.interview.findUnique({
      where: { id },
      include: {
        application: {
          include: {
            candidate: true,
            vacancy: { include: { position: true } },
          },
        },
        attendees: { include: { user: true } },
      },
    });

    if (!interview || interview.organizationId !== organizationId) {
      throw new NotFoundException(`Interview ${id} was not found.`);
    }

    const candidateName = interview.application?.candidate
      ? `${interview.application.candidate.firstName} ${interview.application.candidate.lastName}`
      : 'Candidate';

    const attendees = interview.attendees.map((a) => ({
      name: a.user?.displayName,
      email: a.user?.email,
    }));

    if (interview.application?.candidate?.email) {
      attendees.push({
        name: candidateName,
        email: interview.application.candidate.email,
      });
    }

    return generateIcsCalendar({
      uid: `${interview.interviewCode}@recruitflow.sghgroup.sa`,
      title: `${interview.title} - ${candidateName}`,
      description: `Saudi German Health Recruitment\nInterview: ${interview.title}\nCandidate: ${candidateName}\nPosition: ${
        interview.application?.vacancy?.position?.title || 'Healthcare Role'
      }\nStatus: ${interview.status}`,
      location: interview.locationUrl || 'Saudi German Health Hospital / Virtual Consultation',
      start: interview.scheduledStart,
      end: interview.scheduledEnd,
      organizerName: 'Saudi German Health Recruitment',
      organizerEmail: 'careers@sghgroup.sa',
      attendees,
      url: interview.locationUrl,
    });
  }

  async submitScorecard(
    organizationId: string,
    interviewId: string,
    interviewerId: string,
    dto: SubmitScorecardDto,
  ): Promise<InterviewScorecardItem> {
    await this.getInterview(organizationId, interviewId);

    const attendee = await this.prisma.interviewAttendee.findUnique({
      where: {
        interviewId_userId: { interviewId, userId: interviewerId },
      },
    });
    if (!attendee) {
      throw new ForbiddenException('Only an assigned interviewer can submit a scorecard.');
    }

    const existing = await this.prisma.interviewScorecard.findUnique({
      where: {
        interviewId_interviewerId: {
          interviewId,
          interviewerId,
        },
      },
    });

    if (existing && existing.isLocked) {
      throw new BadRequestException(
        'Scorecard has been locked and cannot be modified after submission.',
      );
    }

    const scorecard = await this.prisma.interviewScorecard.upsert({
      where: {
        interviewId_interviewerId: {
          interviewId,
          interviewerId,
        },
      },
      create: {
        interviewId,
        interviewerId,
        overallRating: dto.overallRating,
        recommendation: dto.recommendation,
        strengths: dto.strengths?.trim() ?? null,
        concerns: dto.concerns?.trim() ?? null,
        notes: dto.notes?.trim() ?? null,
        isLocked: true, // Lock scorecard upon submission
      },
      update: {
        overallRating: dto.overallRating,
        recommendation: dto.recommendation,
        strengths: dto.strengths?.trim() ?? null,
        concerns: dto.concerns?.trim() ?? null,
        notes: dto.notes?.trim() ?? null,
        isLocked: true,
      },
      include: { interviewer: true },
    });

    return {
      id: scorecard.id,
      interviewId: scorecard.interviewId,
      interviewerId: scorecard.interviewerId,
      interviewerName: scorecard.interviewer?.displayName,
      overallRating: scorecard.overallRating,
      recommendation: scorecard.recommendation as InterviewScorecardItem['recommendation'],
      strengths: scorecard.strengths,
      concerns: scorecard.concerns,
      notes: scorecard.notes,
      isLocked: scorecard.isLocked,
      submittedAt: scorecard.submittedAt.toISOString(),
    };
  }

  private async notifyCalendarIntegration(organizationId: string): Promise<void> {
    try {
      await this.prisma.integration.updateMany({
        where: {
          organizationId,
          category: 'Calendar & Scheduling',
          status: 'Connected',
        },
        data: {
          lastSyncAt: new Date(),
        },
      });
    } catch {
      // Integration sync error should not abort interview booking transaction
    }
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

  private toInterview(
    record: Prisma.InterviewGetPayload<{
      include: {
        application: {
          include: {
            candidate: true;
            vacancy: { include: { position: true } };
          };
        };
        attendees: { include: { user: true } };
        scorecards: { include: { interviewer: true } };
      };
    }>,
  ): Interview {
    return {
      id: record.id,
      organizationId: record.organizationId,
      interviewCode: record.interviewCode,
      applicationId: record.applicationId,
      applicationCode: record.application?.applicationCode,
      candidateName: record.application?.candidate
        ? `${record.application.candidate.firstName} ${record.application.candidate.lastName}`
        : undefined,
      positionTitle: record.application?.vacancy?.position?.title,
      title: record.title,
      interviewType: record.interviewType as InterviewType,
      scheduledStart: record.scheduledStart.toISOString(),
      scheduledEnd: record.scheduledEnd.toISOString(),
      timezone: record.timezone,
      locationUrl: record.locationUrl,
      status: record.status as InterviewStatus,
      attendees: record.attendees.map((att) => ({
        id: att.id,
        interviewId: att.interviewId,
        userId: att.userId,
        userName: att.user?.displayName,
        role: att.role,
        response: att.response,
      })),
      scorecards: record.scorecards.map((sc) => ({
        id: sc.id,
        interviewId: sc.interviewId,
        interviewerId: sc.interviewerId,
        interviewerName: sc.interviewer?.displayName,
        overallRating: sc.overallRating,
        recommendation: sc.recommendation as InterviewScorecardItem['recommendation'],
        strengths: sc.strengths,
        concerns: sc.concerns,
        notes: sc.notes,
        isLocked: sc.isLocked,
        submittedAt: sc.submittedAt.toISOString(),
      })),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
