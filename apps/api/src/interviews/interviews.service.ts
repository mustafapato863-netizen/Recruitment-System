import {
  BadRequestException,
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
} from '@recruitflow/contracts';
import { PrismaService } from '../database/prisma.service';
import type {
  CreateInterviewDto,
  InterviewQueryDto,
  SubmitScorecardDto,
  UpdateInterviewDto,
} from './interviews.dto';

@Injectable()
export class InterviewsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
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

  async createInterview(
    organizationId: string,
    dto: CreateInterviewDto,
  ): Promise<Interview> {
    const app = await this.prisma.application.findUnique({
      where: { id: dto.applicationId },
    });

    if (!app || app.organizationId !== organizationId) {
      throw new NotFoundException(`Application ${dto.applicationId} was not found.`);
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

    const interviewCode = await this.nextInterviewCode();

    const created = await this.prisma.$transaction(async (tx) => {
      const item = await tx.interview.create({
        data: {
          organizationId,
          interviewCode,
          applicationId: dto.applicationId,
          title: dto.title.trim(),
          interviewType: dto.interviewType,
          scheduledStart: new Date(dto.scheduledStart),
          scheduledEnd: new Date(dto.scheduledEnd),
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

    return this.toInterview(created);
  }

  async updateInterview(
    organizationId: string,
    id: string,
    dto: UpdateInterviewDto,
  ): Promise<Interview> {
    await this.getInterview(organizationId, id);

    const dataToUpdate: Prisma.InterviewUpdateInput = {};
    if (dto.title) dataToUpdate.title = dto.title.trim();
    if (dto.scheduledStart) dataToUpdate.scheduledStart = new Date(dto.scheduledStart);
    if (dto.scheduledEnd) dataToUpdate.scheduledEnd = new Date(dto.scheduledEnd);
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

    return this.toInterview(updated);
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

  private async nextInterviewCode(): Promise<string> {
    const year = new Date().getUTCFullYear();
    const sequence = await this.prisma.codeSequence.upsert({
      where: { key: `INT:${year}` },
      create: { key: `INT:${year}`, lastIssued: 1 },
      update: { lastIssued: { increment: 1 } },
    });

    return `INT-${year}-${String(sequence.lastIssued).padStart(3, '0')}`;
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
