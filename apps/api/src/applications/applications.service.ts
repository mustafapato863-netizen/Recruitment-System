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
  ApplicationStageRequirement,
  ApplicationWorkspaceResponse,
  ApplicationWorkspaceStage,
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

type GateContext = {
  application: Application;
  screeningOutcome: string | null;
  interviews: Array<{
    status: string;
    scorecards: Array<{ isLocked: boolean; notes: string | null }>;
  }>;
  offerStatus: string | null;
  hiringStatus: string | null;
  actualJoiningDate: Date | null;
  complianceRequirements: Array<{ status: string; isRequired: boolean }>;
  documentCount: number;
};

const KNOWN_GATE_CODES = new Set([
  'candidate',
  'identity',
  'cv',
  'document',
  'assignment',
  'owner',
  'screening',
  'interview',
  'feedback',
  'scorecard',
  'offer',
  'prehire',
  'compliance',
  'license',
  'joined',
]);

function normalizeGateCode(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (normalized.includes('pre hire') || normalized.includes('pre-hire')) return 'prehire';
  for (const code of KNOWN_GATE_CODES) {
    if (normalized === code || normalized.includes(code)) return code;
  }
  return normalized.replace(/\s+/g, '_') || 'custom';
}

function gateIncompleteReason(code: string): string {
  const reasons: Record<string, string> = {
    candidate: 'Complete the candidate identity and contact details.',
    identity: 'Complete the candidate identity and contact details.',
    cv: 'Upload and verify a candidate document.',
    document: 'Upload and verify a candidate document.',
    assignment: 'Assign a recruiter or owner to this application.',
    owner: 'Assign a recruiter or owner to this application.',
    screening: 'Save a Passed screening result.',
    interview: 'Complete an interview or lock an interviewer scorecard.',
    feedback: 'Lock at least one interviewer scorecard with written notes.',
    scorecard: 'Lock at least one interviewer scorecard with written notes.',
    offer: 'Create a non-rejected offer for this application.',
    prehire: 'Complete required pre-hire compliance checks.',
    compliance: 'Complete required compliance checks.',
    license: 'Verify required licenses or mark them not required.',
    joined: 'Record the candidate as joined.',
  };
  return reasons[code] ?? 'Complete this stage requirement before advancing.';
}

function gateActionLabel(code: string): string {
  if (code === 'screening') return 'Open Screening';
  if (code === 'interview' || code === 'feedback' || code === 'scorecard') return 'Open Interviews';
  if (code === 'offer') return 'Open Offer';
  if (code === 'prehire' || code === 'compliance' || code === 'license') return 'Open Pre-Hire';
  if (code === 'cv' || code === 'document') return 'Open Resume';
  return 'Open Overview';
}

function gateActionTab(code: string): string {
  if (code === 'screening') return 'Screening';
  if (code === 'interview' || code === 'feedback' || code === 'scorecard') return 'Interview';
  if (code === 'offer') return 'Offer';
  if (code === 'prehire' || code === 'compliance' || code === 'license') return 'Pre-Hire';
  if (code === 'cv' || code === 'document') return 'Applied';
  return 'Applied';
}

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
            include: { position: true, branch: true },
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
            branch: true,
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

  /**
   * Return the persisted pipeline context used by the unified Applicant Profile.
   * Pipeline templates are organization-scoped today, so the active default
   * template is the effective workflow until vacancies gain an explicit
   * template relationship.
   */
  async getWorkspace(
    organizationId: string,
    id: string,
    user?: AuthUser,
  ): Promise<ApplicationWorkspaceResponse> {
    const application = await this.getApplication(organizationId, id, user);
    const [template, screening, interviews, offer, hiringCase, documentCount] = await Promise.all([
      this.prisma.pipelineTemplate.findFirst({
        where: { organizationId, isDefault: true, status: { not: 'Archived' } },
        include: {
          stages: {
            where: { status: { not: 'Archived' } },
            orderBy: { sortOrder: 'asc' },
          },
        },
      }),
      this.prisma.screeningLog.findFirst({
        where: { organizationId, applicationId: id },
        orderBy: [{ screenedAt: 'desc' }, { createdAt: 'desc' }],
        select: { outcome: true },
      }),
      this.prisma.interview.findMany({
        where: { organizationId, applicationId: id },
        select: {
          status: true,
          scorecards: { select: { isLocked: true, notes: true } },
        },
      }),
      this.prisma.offer.findFirst({
        where: { organizationId, applicationId: id },
        orderBy: { createdAt: 'desc' },
        select: { status: true },
      }),
      this.prisma.hiringCase.findUnique({
        where: { applicationId: id },
        select: {
          status: true,
          actualJoiningDate: true,
          complianceRequirements: { select: { status: true, isRequired: true } },
        },
      }),
      this.prisma.candidateDocument.count({
        where: {
          organizationId,
          candidateId: application.candidateId,
          deletedAt: null,
        },
      }),
    ]);

    const stages = template?.stages ?? [];
    const currentIndex = stages.findIndex((stage) => stage.name === application.stage);
    const hasCurrentStage = currentIndex >= 0;
    const allowedTransitions = new Set(application.allowedTransitions);
    const context: GateContext = {
      application,
      screeningOutcome: screening?.outcome ?? null,
      interviews,
      offerStatus: offer?.status ?? null,
      hiringStatus: hiringCase?.status ?? null,
      actualJoiningDate: hiringCase?.actualJoiningDate ?? null,
      complianceRequirements: hiringCase?.complianceRequirements ?? [],
      documentCount,
    };

    const workspaceStages: ApplicationWorkspaceStage[] = stages.map((stage, index) => {
      const isCurrent = stage.name === application.stage;
      const isNext = hasCurrentStage && index === currentIndex + 1;
      const isAvailable =
        isCurrent ||
        (hasCurrentStage && index <= currentIndex) ||
        allowedTransitions.has(stage.name as ApplicationStage);
      const requirements = [
        ...this.buildGateRequirements(stage.id, stage.entryGate, 'entry', stage.required, context),
        ...this.buildGateRequirements(stage.id, stage.exitGate, 'exit', stage.required, context),
      ];

      return {
        id: stage.id,
        name: stage.name,
        stageType: stage.stageType,
        sortOrder: stage.sortOrder,
        slaDays: stage.slaDays,
        defaultOwner: stage.defaultOwner,
        entryGate: stage.entryGate,
        exitGate: stage.exitGate,
        required: stage.required,
        isCurrent,
        isCompleted: hasCurrentStage && index < currentIndex,
        isNext,
        isAvailable,
        requirements,
      };
    });

    // Keep the legacy transition contract usable when an organization has not
    // configured a default pipeline yet (or an existing application predates
    // the current template). The persisted pipeline remains authoritative when
    // it contains the current stage; this fallback only prevents the workspace
    // from becoming read-only during migration/setup.
    const legacyNextStage = application.allowedTransitions.find(
      (stage) => stage !== 'Rejected' && stage !== 'Withdrawn',
    ) ?? null;
    const nextStage = workspaceStages.find((stage) => stage.isNext)?.name ?? legacyNextStage;
    const currentStageConfig = stages.find((stage) => stage.name === application.stage);
    const nextStageConfig = stages.find((stage) => stage.name === nextStage);
    const nextStageRequirements = [
      ...this.buildGateRequirements(
        currentStageConfig?.id ?? `${id}:current`,
        currentStageConfig?.exitGate,
        'exit',
        currentStageConfig?.required ?? false,
        context,
      ),
      ...this.buildGateRequirements(
        nextStageConfig?.id ?? `${id}:next`,
        nextStageConfig?.entryGate,
        'entry',
        nextStageConfig?.required ?? false,
        context,
      ),
    ];

    return {
      application,
      templateId: template?.id ?? null,
      templateName: template?.name ?? null,
      stages: workspaceStages,
      nextStage,
      nextStageRequirements,
      canAdvance: Boolean(nextStage) && !nextStageRequirements.some((requirement) => requirement.blocking),
      summary: {
        screeningOutcome: screening?.outcome ?? null,
        interviewCount: interviews.length,
        completedInterviewCount: interviews.filter((item) => item.status === 'Completed').length,
        offerStatus: offer?.status ?? null,
        hiringStatus: hiringCase?.status ?? null,
        actualJoiningDate: hiringCase?.actualJoiningDate?.toISOString() ?? null,
        documentCount,
      },
    };
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
      this.prisma.vacancy.findFirst({
        where: { id: dto.vacancyId, ...vacancyVisibility },
        include: {
          assignments: {
            where: { isActive: true, assignmentKind: 'PRIMARY' },
            select: { id: true },
          },
        },
      }),
      this.prisma.candidate.findFirst({ where: { id: dto.candidateId, ...candidateVisibility } }),
    ]);

    if (!vacancy || vacancy.organizationId !== organizationId) {
      throw new NotFoundException(`Vacancy ${dto.vacancyId} was not found.`);
    }

    if (vacancy.status === 'Open' && vacancy.assignments.length === 0) {
      throw new BadRequestException(
        `Vacancy ${vacancy.vacancyCode} has no assigned primary recruiter. Assign the vacancy before adding candidates.`,
      );
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
          vacancy: { include: { position: true, branch: true } },
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

    // Applications created before a pipeline template was configured (or
    // using a custom stage name) do not have a canonical transition map
    // entry. When a persisted pipeline contains the current stage, its
    // ordering is authoritative; only the immediate next stage (plus the
    // terminal rejection paths) can be selected. The canonical map remains
    // the fallback for legacy records without a matching pipeline stage.
    const allowed = ALLOWED_STAGE_TRANSITIONS[application.stage] ?? [];
    const workspace = await this.getWorkspace(organizationId, id, user);
    const configuredNextAllowed = workspace.stages.some(
      (stage) => stage.isNext && stage.name === dto.stage,
    );
    const hasPersistedCurrentStage = workspace.stages.some((stage) => stage.isCurrent);
    const isTerminalEscape = dto.stage === 'Rejected' || dto.stage === 'Withdrawn';
    const transitionAllowed = hasPersistedCurrentStage
      ? configuredNextAllowed || isTerminalEscape
      : allowed.includes(dto.stage);
    if (!transitionAllowed) {
      throw new BadRequestException(
        `Cannot transition application from ${application.stage} to ${dto.stage}. Allowed transitions: ${allowed.join(', ')}.`,
      );
    }

    const gateRequirements = workspace.nextStage === dto.stage
      ? workspace.nextStageRequirements
      : workspace.stages.find((stage) => stage.name === dto.stage)?.requirements ?? [];
    const blockingRequirements = gateRequirements.filter((requirement) => requirement.blocking);
    if (blockingRequirements.length > 0) {
      throw new BadRequestException({
        code: 'STAGE_GATE_BLOCKED',
        message: `Cannot move to ${dto.stage} until all required stage requirements are complete.`,
        details: { targetStage: dto.stage, requirements: blockingRequirements },
      });
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
          vacancy: { include: { position: true, branch: true } },
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
        vacancy: { include: { position: true, branch: true } },
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

  private buildGateRequirements(
    stageId: string,
    rawGate: string | null | undefined,
    kind: 'entry' | 'exit',
    stageRequired: boolean,
    context: GateContext,
  ): ApplicationStageRequirement[] {
    if (!rawGate?.trim()) return [];

    return rawGate
      .split(/[;,|]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((label, index) => {
        const code = normalizeGateCode(label);
        const complete = this.evaluateGate(code, context);
        const required = stageRequired;
        const isKnown = KNOWN_GATE_CODES.has(code);
        return {
          id: `${stageId}:${kind}:${index}`,
          code,
          label,
          kind,
          required,
          complete,
          blocking: required && !complete,
          reason: complete
            ? null
            : isKnown
              ? gateIncompleteReason(code)
              : 'This custom requirement needs a supported completion signal.',
          actionLabel: complete ? null : gateActionLabel(code),
          actionTab: complete ? null : gateActionTab(code),
        } satisfies ApplicationStageRequirement;
      });
  }

  private evaluateGate(code: string, context: GateContext): boolean {
    switch (code) {
      case 'candidate':
      case 'identity':
        return Boolean(
          context.application.candidate?.firstName &&
            context.application.candidate?.lastName &&
            (context.application.candidate.email || context.application.candidate.phone),
        );
      case 'cv':
      case 'document':
        return context.documentCount > 0;
      case 'assignment':
      case 'owner':
        return Boolean(context.application.primaryRecruiterId || context.application.taskOwnerId);
      case 'screening':
        return context.screeningOutcome === 'Passed';
      case 'interview':
        return context.interviews.some(
          (interview) =>
            interview.status === 'Completed' ||
            interview.scorecards.some((scorecard) => scorecard.isLocked),
        );
      case 'feedback':
      case 'scorecard':
        return context.interviews.some((interview) =>
          interview.scorecards.some((scorecard) => scorecard.isLocked && Boolean(scorecard.notes?.trim())),
        );
      case 'offer':
        return Boolean(context.offerStatus && context.offerStatus !== 'Rejected');
      case 'prehire':
      case 'compliance':
      case 'license':
        return (
          context.hiringStatus === 'Pending Final Approval' ||
          context.hiringStatus === 'Awaiting Joining' ||
          context.hiringStatus === 'Joined'
        ) &&
          context.complianceRequirements.every(
            (requirement) => !requirement.isRequired || requirement.status === 'Verified' || requirement.status === 'Not Required',
          );
      case 'joined':
        return context.hiringStatus === 'Joined' || Boolean(context.actualJoiningDate);
      default:
        return false;
    }
  }

  private toApplication(
    record: Prisma.ApplicationGetPayload<{
      include: {
        candidate: true;
        vacancy: { include: { position: true, branch: true } };
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
      vacancyLocation: record.vacancy?.location ?? record.vacancy?.branch?.name ?? null,
      vacancyBranchName: record.vacancy?.branch?.name ?? null,
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
        vacancy: { include: { position: true, branch: true } };
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

