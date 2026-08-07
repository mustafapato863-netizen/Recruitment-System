import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@recruitflow/database';
import type {
  Application,
  ApplicationStage,
  ApplicationStatusHistoryItem,
  Candidate,
  PaginatedResult,
} from '@recruitflow/contracts';
import { PrismaService } from '../database/prisma.service';
import type {
  ApplicationQueryDto,
  CreateApplicationDto,
  UpdateApplicationStageDto,
} from './applications.dto';

const ALLOWED_STAGE_TRANSITIONS: Record<ApplicationStage, ApplicationStage[]> = {
  Applied: ['Screening', 'Rejected', 'Withdrawn'],
  Screening: ['Interview', 'Rejected', 'Withdrawn'],
  Interview: ['Offer', 'Rejected', 'Withdrawn'],
  Offer: ['Pre-Hire', 'Rejected', 'Withdrawn'],
  'Pre-Hire': ['Joined', 'Rejected', 'Withdrawn'],
  Joined: [],
  Rejected: ['Applied', 'Screening', 'Interview'],
  Withdrawn: ['Applied'],
};

@Injectable()
export class ApplicationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async listApplications(
    organizationId: string,
    query: ApplicationQueryDto,
  ): Promise<PaginatedResult<Application>> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ApplicationWhereInput = { organizationId };

    if (query.vacancyId) where.vacancyId = query.vacancyId;
    if (query.candidateId) where.candidateId = query.candidateId;
    if (query.stage) where.stage = query.stage;
    if (query.primaryRecruiterId) where.primaryRecruiterId = query.primaryRecruiterId;

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { applicationCode: { contains: term, mode: 'insensitive' } },
        { candidate: { firstName: { contains: term, mode: 'insensitive' } } },
        { candidate: { lastName: { contains: term, mode: 'insensitive' } } },
        { candidate: { email: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.application.count({ where }),
      this.prisma.application.findMany({
        where,
        include: {
          candidate: true,
          vacancy: {
            include: { position: true },
          },
          primaryRecruiter: true,
          taskOwner: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    return {
      data: items.map((app) => this.toApplication(app)),
      total,
      page,
      pageSize,
    };
  }

  async getApplication(organizationId: string, id: string): Promise<Application> {
    const application = await this.prisma.application.findUnique({
      where: { id },
      include: {
        candidate: true,
        vacancy: {
          include: { position: true },
        },
        primaryRecruiter: true,
        taskOwner: true,
      },
    });

    if (!application || application.organizationId !== organizationId) {
      throw new NotFoundException(`Application ${id} was not found.`);
    }

    return this.toApplication(application);
  }

  async createApplication(
    organizationId: string,
    dto: CreateApplicationDto,
  ): Promise<Application> {
    const [vacancy, candidate] = await Promise.all([
      this.prisma.vacancy.findUnique({ where: { id: dto.vacancyId } }),
      this.prisma.candidate.findUnique({ where: { id: dto.candidateId } }),
    ]);

    if (!vacancy || vacancy.organizationId !== organizationId) {
      throw new NotFoundException(`Vacancy ${dto.vacancyId} was not found.`);
    }

    if (!candidate || candidate.organizationId !== organizationId) {
      throw new NotFoundException(`Candidate ${dto.candidateId} was not found.`);
    }

    const relatedUserIds = [dto.primaryRecruiterId, dto.taskOwnerId].filter(
      (id): id is string => Boolean(id),
    );
    if (relatedUserIds.length > 0) {
      const users = await this.prisma.user.findMany({
        where: {
          id: { in: [...new Set(relatedUserIds)] },
          organizationId,
          status: 'Active',
        },
        select: { id: true },
      });
      if (users.length !== new Set(relatedUserIds).size) {
        throw new NotFoundException('One or more assigned users were not found in this organization.');
      }
    }

    const existing = await this.prisma.application.findUnique({
      where: {
        vacancyId_candidateId: {
          vacancyId: dto.vacancyId,
          candidateId: dto.candidateId,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Candidate ${candidate.firstName} ${candidate.lastName} has already applied to vacancy ${vacancy.vacancyCode}.`,
      );
    }

    const applicationCode = await this.nextApplicationCode();

    const created = await this.prisma.$transaction(async (tx) => {
      const app = await tx.application.create({
        data: {
          organizationId,
          applicationCode,
          vacancyId: dto.vacancyId,
          candidateId: dto.candidateId,
          stage: 'Applied',
          source: dto.source?.trim() ?? candidate.source ?? null,
          primaryRecruiterId: dto.primaryRecruiterId ?? null,
          taskOwnerId: dto.taskOwnerId ?? null,
        },
        include: {
          candidate: true,
          vacancy: { include: { position: true } },
          primaryRecruiter: true,
          taskOwner: true,
        },
      });

      await tx.applicationStatusHistory.create({
        data: {
          applicationId: app.id,
          fromStage: null,
          toStage: 'Applied',
          reason: 'Initial application submitted',
        },
      });

      return app;
    });

    return this.toApplication(created);
  }

  async updateStage(
    organizationId: string,
    id: string,
    actorUserId: string,
    dto: UpdateApplicationStageDto,
  ): Promise<Application> {
    const application = await this.getApplication(organizationId, id);

    const allowed = ALLOWED_STAGE_TRANSITIONS[application.stage];
    if (!allowed.includes(dto.stage)) {
      throw new BadRequestException(
        `Cannot transition application from ${application.stage} to ${dto.stage}. Allowed transitions: ${allowed.join(', ')}.`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const app = await tx.application.update({
        where: { id },
        data: {
          stage: dto.stage,
        },
        include: {
          candidate: true,
          vacancy: { include: { position: true } },
          primaryRecruiter: true,
          taskOwner: true,
        },
      });

      await tx.applicationStatusHistory.create({
        data: {
          applicationId: id,
          fromStage: application.stage,
          toStage: dto.stage,
          changedById: actorUserId,
          reason: dto.reason?.trim() ?? null,
        },
      });

      return app;
    });

    return this.toApplication(updated);
  }

  async getApplicationHistory(
    organizationId: string,
    id: string,
  ): Promise<ApplicationStatusHistoryItem[]> {
    await this.getApplication(organizationId, id);

    const history = await this.prisma.applicationStatusHistory.findMany({
      where: { applicationId: id },
      include: { changedBy: true },
      orderBy: { createdAt: 'desc' },
    });

    return history.map((h) => ({
      id: h.id,
      applicationId: h.applicationId,
      fromStage: h.fromStage,
      toStage: h.toStage,
      changedById: h.changedById,
      changedByName: h.changedBy?.displayName,
      reason: h.reason,
      createdAt: h.createdAt.toISOString(),
    }));
  }

  private async nextApplicationCode(): Promise<string> {
    const year = new Date().getUTCFullYear();
    const sequence = await this.prisma.codeSequence.upsert({
      where: { key: `APP:${year}` },
      create: { key: `APP:${year}`, lastIssued: 1 },
      update: { lastIssued: { increment: 1 } },
    });

    return `APP-${year}-${String(sequence.lastIssued).padStart(3, '0')}`;
  }

  private toApplication(record: Prisma.ApplicationGetPayload<{
    include: {
      candidate: true;
      vacancy: { include: { position: true } };
      primaryRecruiter: true;
      taskOwner: true;
    };
  }>): Application {
    return {
      id: record.id,
      organizationId: record.organizationId,
      applicationCode: record.applicationCode,
      vacancyId: record.vacancyId,
      candidateId: record.candidateId,
      stage: record.stage as ApplicationStage,
      source: record.source,
      primaryRecruiterId: record.primaryRecruiterId,
      primaryRecruiterName: record.primaryRecruiter?.displayName,
      taskOwnerId: record.taskOwnerId,
      taskOwnerName: record.taskOwner?.displayName,
      candidate: record.candidate
        ? {
            id: record.candidate.id,
            organizationId: record.candidate.organizationId,
            candidateCode: record.candidate.candidateCode,
            firstName: record.candidate.firstName,
            lastName: record.candidate.lastName,
            email: record.candidate.email,
            phone: record.candidate.phone,
            currentTitle: record.candidate.currentTitle,
            currentCompany: record.candidate.currentCompany,
            source: record.candidate.source,
            status: record.candidate.status as Candidate['status'],
            createdAt: record.candidate.createdAt.toISOString(),
            updatedAt: record.candidate.updatedAt.toISOString(),
          }
        : undefined,
      vacancyCode: record.vacancy?.vacancyCode,
      positionTitle: record.vacancy?.position?.title,
      appliedAt: record.appliedAt.toISOString(),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
