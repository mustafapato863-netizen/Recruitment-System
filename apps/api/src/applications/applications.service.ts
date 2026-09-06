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
  ApplicationNote,
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
  UpdateApplicationDto,
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

    const sortBy = query.sortBy ?? 'updatedAt';
    const sortDirection = query.sortDirection ?? 'desc';

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
        orderBy: { [sortBy]: sortDirection },
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

    if (application.stage !== dto.expectedStage || application.version !== dto.expectedVersion) {
      this.throwTransitionConflict(application);
    }

    const allowed = ALLOWED_STAGE_TRANSITIONS[application.stage];
    if (!allowed.includes(dto.stage)) {
      throw new BadRequestException(
        `Cannot transition application from ${application.stage} to ${dto.stage}. Allowed transitions: ${allowed.join(', ')}.`,
      );
    }

    if (dto.stage === 'Joined') {
      const vacancy = await this.prisma.vacancy.findUnique({
        where: { id: application.vacancyId },
      });
      if (vacancy && vacancy.joinedHeadcount >= vacancy.approvedHeadcount) {
        throw new BadRequestException(
          `Requisition approved headcount is already fulfilled (${vacancy.joinedHeadcount}/${vacancy.approvedHeadcount}).`,
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.application.updateMany({
        where: {
          id,
          organizationId,
          stage: dto.expectedStage,
          version: dto.expectedVersion,
        },
        data: {
          stage: dto.stage,
          version: { increment: 1 },
        },
      });

      if (changed.count !== 1) return null;

      if (dto.stage === 'Joined') {
        const vacancy = await tx.vacancy.findUnique({
          where: { id: application.vacancyId },
        });
        if (vacancy) {
          const newJoined = vacancy.joinedHeadcount + 1;
          const shouldClose = newJoined >= vacancy.approvedHeadcount;
          await tx.vacancy.update({
            where: { id: vacancy.id },
            data: {
              joinedHeadcount: { increment: 1 },
              ...(shouldClose ? { status: 'Closed' } : {}),
            },
          });
        }
      }

      await tx.applicationStatusHistory.create({
        data: {
          applicationId: id,
          fromStage: dto.expectedStage,
          toStage: dto.stage,
          changedById: actorUserId,
          reason: dto.reason?.trim() ?? null,
        },
      });

      return tx.application.findUnique({
        where: { id },
        include: {
          candidate: true,
          vacancy: { include: { position: true } },
          primaryRecruiter: true,
          taskOwner: true,
        },
      });
    });

    if (!updated) {
      const current = await this.getApplication(organizationId, id);
      this.throwTransitionConflict(current);
    }

    return this.toApplication(updated);
  }

  async updateApplication(
    organizationId: string,
    id: string,
    _actorUserId: string,
    dto: UpdateApplicationDto,
  ): Promise<Application> {
    await this.getApplication(organizationId, id);

    const updateData: Prisma.ApplicationUpdateInput = {};

    if (dto.primaryRecruiterId !== undefined) {
      if (dto.primaryRecruiterId === null) {
        updateData.primaryRecruiter = { disconnect: true };
      } else {
        const recruiter = await this.prisma.user.findFirst({
          where: { id: dto.primaryRecruiterId, organizationId, status: 'Active' },
        });
        if (!recruiter) {
          throw new NotFoundException('Recruiter not found in this organization');
        }
        updateData.primaryRecruiter = { connect: { id: dto.primaryRecruiterId } };
      }
    }

    if (dto.taskOwnerId !== undefined) {
      if (dto.taskOwnerId === null) {
        updateData.taskOwner = { disconnect: true };
      } else {
        const owner = await this.prisma.user.findFirst({
          where: { id: dto.taskOwnerId, organizationId, status: 'Active' },
        });
        if (!owner) {
          throw new NotFoundException('Task owner not found in this organization');
        }
        updateData.taskOwner = { connect: { id: dto.taskOwnerId } };
      }
    }

    const updated = await this.prisma.application.update({
      where: { id },
      data: updateData,
      include: {
        candidate: true,
        vacancy: { include: { position: true } },
        primaryRecruiter: true,
        taskOwner: true,
      },
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

  async listNotes(
    organizationId: string,
    applicationId: string,
  ): Promise<ApplicationNote[]> {
    await this.getApplication(organizationId, applicationId);

    const notes = await this.prisma.applicationNote.findMany({
      where: {
        applicationId,
        organizationId,
      },
      include: {
        author: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return notes.map((note) => this.toApplicationNote(note));
  }

  async createNote(
    organizationId: string,
    applicationId: string,
    authorId: string,
    content: string,
  ): Promise<ApplicationNote> {
    await this.getApplication(organizationId, applicationId);

    const trimmed = content.trim();
    if (!trimmed) {
      throw new BadRequestException('Note content cannot be empty.');
    }

    const note = await this.prisma.applicationNote.create({
      data: {
        organizationId,
        applicationId,
        authorId,
        content: trimmed,
      },
      include: {
        author: true,
      },
    });

    return this.toApplicationNote(note);
  }

  private async nextApplicationCode(): Promise<string> {
    const year = new Date().getUTCFullYear();
    const seq = await this.prisma.codeSequence.upsert({
      where: { key: `APP:${year}` },
      create: { key: `APP:${year}`, lastIssued: 1 },
      update: { lastIssued: { increment: 1 } },
    });
    return `APP-${year}-${String(seq.lastIssued).padStart(3, '0')}`;
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
      allowedTransitions: ALLOWED_STAGE_TRANSITIONS[record.stage as ApplicationStage] ?? [],
      version: record.version ?? 1,
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
            consentStatus: record.candidate.consentStatus,
            consentCapturedAt: record.candidate.consentCapturedAt?.toISOString() ?? null,
            consentSource: record.candidate.consentSource,
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

  private throwTransitionConflict(current: Application): never {
    throw new ConflictException({
      code: 'CONFLICT',
      message: 'This application changed before the stage update could be saved.',
      details: {
        currentApplication: current,
        currentStage: current.stage,
        currentVersion: current.version,
      },
    });
  }

  private toApplicationNote(
    record: Prisma.ApplicationNoteGetPayload<{
      include: {
        author: true;
      };
    }>,
  ): ApplicationNote {
    return {
      id: record.id,
      organizationId: record.organizationId,
      applicationId: record.applicationId,
      authorId: record.authorId,
      authorName: record.author?.displayName,
      authorEmail: record.author?.email,
      content: record.content,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
