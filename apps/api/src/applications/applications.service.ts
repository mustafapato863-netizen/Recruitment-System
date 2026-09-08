import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@recruitflow/database';
import type {
  Application,
  ApplicationNote,
  ApplicationStage,
  ApplicationStatusHistoryItem,
  AuthUser,
  Candidate,
  PaginatedResult,
} from '@recruitflow/contracts';
import { PrismaService } from '../database/prisma.service';
// Runtime service import must remain a value import for Nest DI metadata reflection.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { EmailOutboxService } from '../email/email-outbox.service';
import { AccessControlService } from '../access-control/access-control.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { EmailTemplatesService } from '../email-templates/email-templates.service';
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
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    private readonly emailOutbox: EmailOutboxService,
    private readonly emailTemplates: EmailTemplatesService,
    private readonly accessControl: AccessControlService,
  ) {}

  async listApplications(
    organizationId: string,
    query: ApplicationQueryDto,
    user?: AuthUser,
  ): Promise<PaginatedResult<Application>> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ApplicationWhereInput = { organizationId };

    let canViewPii = true;

    if (user) {
      const policy = await this.accessControl.getUserEffectiveScope(
        organizationId,
        user.userId,
        user.roleCodes,
      );
      canViewPii = policy.canViewPii;

      const visibility = await this.accessControl.getApplicationVisibilityWhere(user);
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        visibility,
      ];
    }

    if (query.vacancyId) where.vacancyId = query.vacancyId;
    if (query.candidateId) where.candidateId = query.candidateId;
    if (query.stage) where.stage = query.stage;
    if (query.primaryRecruiterId) where.primaryRecruiterId = query.primaryRecruiterId;

    if (query.search?.trim()) {
      const term = query.search.trim();
      const searchClause: Prisma.ApplicationWhereInput[] = [
        { applicationCode: { contains: term, mode: 'insensitive' } },
        { candidate: { firstName: { contains: term, mode: 'insensitive' } } },
        { candidate: { lastName: { contains: term, mode: 'insensitive' } } },
        { candidate: { email: { contains: term, mode: 'insensitive' } } },
      ];
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        { OR: searchClause },
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

    const data = items.map((app) => this.toApplication(app, canViewPii));
    if (items.length > 0) {
      const applicationIds = items.map((app) => app.id);
      const [histories, notes, followUps] = await Promise.all([
        this.prisma.applicationStatusHistory.findMany({
          where: { applicationId: { in: applicationIds } },
          orderBy: { createdAt: 'desc' },
          select: { applicationId: true, toStage: true, createdAt: true },
        }),
        this.prisma.applicationNote.findMany({
          where: { organizationId, applicationId: { in: applicationIds } },
          orderBy: { createdAt: 'desc' },
          select: { applicationId: true, createdAt: true },
        }),
        this.prisma.task.findMany({
          where: {
            organizationId,
            entityType: 'Candidate',
            entityId: { in: items.map((app) => app.candidateId) },
            type: { startsWith: 'CandidateActivity:' },
            status: { in: ['Open', 'In Progress'] },
            dueAt: { not: null },
          },
          orderBy: { dueAt: 'asc' },
          select: { entityId: true, dueAt: true },
        }),
      ]);
      const latest = new Map<string, { at: Date; label: string }>();
      const nextFollowUpByCandidate = new Map<string, Date>();
      for (const history of histories) {
        if (!latest.has(history.applicationId)) latest.set(history.applicationId, { at: history.createdAt, label: `Moved to ${history.toStage}` });
      }
      for (const note of notes) {
        const current = latest.get(note.applicationId);
        if (!current || note.createdAt > current.at) latest.set(note.applicationId, { at: note.createdAt, label: 'Note added' });
      }
      for (const followUp of followUps) {
        if (followUp.entityId && followUp.dueAt && !nextFollowUpByCandidate.has(followUp.entityId)) {
          nextFollowUpByCandidate.set(followUp.entityId, followUp.dueAt);
        }
      }
      for (const item of data) {
        const event = latest.get(item.id);
        item.lastActivityAt = event?.at.toISOString() ?? item.updatedAt;
        item.lastActivityLabel = event?.label ?? 'Application updated';
        item.nextFollowUpAt = nextFollowUpByCandidate.get(item.candidateId)?.toISOString() ?? null;
      }
    }

    return {
      data,
      total,
      page,
      pageSize,
    };
  }

  async getApplication(
    organizationId: string,
    id: string,
    user?: AuthUser,
  ): Promise<Application> {
    const policy = user
      ? await this.accessControl.getUserEffectiveScope(organizationId, user.userId, user.roleCodes)
      : null;
    const visibility = user
      ? await this.accessControl.getApplicationVisibilityWhere(user)
      : { organizationId };
    const application = await this.prisma.application.findFirst({
      where: { id, ...visibility },
      include: {
        candidate: true,
        vacancy: {
          include: {
            position: true,
            assignments: true,
          },
        },
        primaryRecruiter: true,
        taskOwner: true,
      },
    });

    if (!application || application.organizationId !== organizationId) {
      throw new NotFoundException(`Application ${id} was not found.`);
    }

    return this.toApplication(application, policy?.canViewPii ?? true);
  }

  async createApplication(
    organizationId: string,
    dto: CreateApplicationDto,
    user?: AuthUser,
  ): Promise<Application> {
    const vacancyVisibility = user
      ? await this.accessControl.getVacancyVisibilityWhere(user)
      : { organizationId };
    const applicationVisibility = user
      ? await this.accessControl.getApplicationVisibilityWhere(user)
      : { organizationId };
    const candidateVisibility: Prisma.CandidateWhereInput = user
      ? {
          organizationId,
          OR: [
            { createdById: user.userId },
            { applications: { some: applicationVisibility } },
          ],
        }
      : { organizationId };

    const [vacancy, candidate] = await Promise.all([
      this.prisma.vacancy.findFirst({ where: { id: dto.vacancyId, ...vacancyVisibility } }),
      this.prisma.candidate.findFirst({ where: { id: dto.candidateId, ...candidateVisibility } }),
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
    user?: AuthUser,
  ): Promise<Application> {
    const application = await this.getApplication(organizationId, id, user);

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
      const current = await this.getApplication(organizationId, id, user);
      this.throwTransitionConflict(current);
    }

    // C2 — Enter-stage runner (post-commit, best-effort; errors are logged but never surface to caller)
    this.fireStageAutomation(organizationId, updated!, dto.stage).catch((err: unknown) => {
      this.logger.error(`[automation] stage-enter runner failed for application ${id} → ${dto.stage}: ${err instanceof Error ? err.message : String(err)}`);
    });

    return this.toApplication(updated);
  }

  async updateApplication(
    organizationId: string,
    id: string,
    _actorUserId: string,
    dto: UpdateApplicationDto,
    user?: AuthUser,
  ): Promise<Application> {
    await this.getApplication(organizationId, id, user);

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
    user?: AuthUser,
  ): Promise<ApplicationStatusHistoryItem[]> {
    await this.getApplication(organizationId, id, user);

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
    user?: AuthUser,
  ): Promise<ApplicationNote[]> {
    await this.getApplication(organizationId, applicationId, user);

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
    user?: AuthUser,
  ): Promise<ApplicationNote> {
    await this.getApplication(organizationId, applicationId, user);

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

  private maskEmail(email: string | null | undefined): string {
    if (!email || !email.includes('@')) return '***';
    const parts = email.split('@');
    const local = parts[0] ?? '';
    const domain = parts[1] ?? '';
    const visible = local.length > 2 ? local.slice(0, 2) : local.slice(0, 1);
    return `${visible}***@${domain}`;
  }

  private maskPhone(phone: string | null | undefined): string {
    if (!phone) return '***';
    return phone.length > 4 ? `${phone.slice(0, 4)}****${phone.slice(-2)}` : '****';
  }

  private toApplication(
    record: Prisma.ApplicationGetPayload<{
      include: {
        candidate: true;
        vacancy: { include: { position: true } };
        primaryRecruiter: true;
        taskOwner: true;
      };
    }>,
    canViewPii = true,
  ): Application {
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
            email: canViewPii ? record.candidate.email : this.maskEmail(record.candidate.email),
            phone: canViewPii ? record.candidate.phone : this.maskPhone(record.candidate.phone),
            currentTitle: record.candidate.currentTitle,
            currentCompany: record.candidate.currentCompany,
            summary: record.candidate.summary,
            skills: record.candidate.skills,
            experienceYears: record.candidate.experienceYears,
            location: record.candidate.location,
            certifications: record.candidate.certifications,
            languages: record.candidate.languages,
            availability: record.candidate.availability,
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

  /**
   * C2 — Enter-stage automation runner.
   *
   * Runs AFTER the 409-safe stage commit. Finds the pipeline stage whose name
   * matches `stageName` in the org's default template, then:
   * 1. Resolves the linked EmailTemplate (if any).
   * 2. Interpolates {{candidateName}} / {{positionTitle}} / {{stageName}} / {{organizationName}}.
   * 3. Enqueues a candidate-facing email via the transactional outbox.
   * 4. Creates an ApplicationNote tagged [Automation] for the timeline.
   *
   * All steps run in a single transaction. Failures are caught by the caller
   * and only logged — they never surface as a 5xx to the recruiter.
   */
  private async fireStageAutomation(
    organizationId: string,
    app: Prisma.ApplicationGetPayload<{
      include: {
        candidate: true;
        vacancy: { include: { position: true } };
        primaryRecruiter: true;
        taskOwner: true;
      };
    }>,
    stageName: string,
  ): Promise<void> {
    // Look up default pipeline template for the org
    const defaultTemplate = await this.prisma.pipelineTemplate.findFirst({
      where: { organizationId, isDefault: true, status: { not: 'Archived' } },
      include: {
        stages: {
          where: { status: { not: 'Archived' }, name: stageName },
          include: { emailTemplate: true },
        },
      },
    });

    const matchedStage = defaultTemplate?.stages[0];
    if (!matchedStage?.emailTemplate || matchedStage.emailTemplate.status === 'Archived') {
      return; // No automation configured for this stage
    }

    const template = matchedStage.emailTemplate;
    const candidateName = app.candidate
      ? `${app.candidate.firstName} ${app.candidate.lastName}`.trim()
      : 'Candidate';
    const positionTitle = app.vacancy?.position?.title ?? 'the position';

    // Resolve organization name
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });

    const vars: Record<string, string> = {
      candidateName,
      positionTitle,
      stageName,
      organizationName: org?.name ?? 'Our Organization',
    };

    const renderedSubject = EmailTemplatesService.render(template.subject, vars);
    const renderedBody = EmailTemplatesService.render(template.bodyTemplate, vars);
    const toEmail = app.candidate?.email;

    if (!toEmail) {
      this.logger.warn(`[automation] skipping email for application ${app.id}: candidate has no email address`);
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await this.emailOutbox.enqueueWithTx(tx, {
        toEmail,
        subject: renderedSubject,
        template: 'notification',
        payload: { title: renderedSubject, message: renderedBody },
        organizationId,
      });

      await tx.applicationNote.create({
        data: {
          organizationId,
          applicationId: app.id,
          authorId: null,
          content: `[Automation] Stage email queued: "${renderedSubject}" → ${toEmail}`,
        },
      });
    });

    this.logger.log(`[automation] stage-enter email queued for application ${app.id} (stage=${stageName}, template="${template.name}")`);
  }
}

