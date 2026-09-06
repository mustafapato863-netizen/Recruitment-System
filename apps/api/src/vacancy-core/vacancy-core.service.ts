import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  ApplicationStage,
  CreateVacancyRequestInput,
  JobWorkQueueItem,
  PaginatedResult,
  Vacancy,
  VacancyRequest,
  VacancyRequestActionResult,
  VacancyDetailView,
} from '@recruitflow/contracts';
import type { Prisma } from '@recruitflow/database';
import type {
  CreateVacancyRequestDto,
  VacancyRequestActionDto,
  UpdateVacancyRequestDto,
  UpdateVacancyDto,
  AssignTeamMemberDto,
  VacancyWorkQueueQueryDto,
} from './vacancy-core.dto';
import {
  VACANCY_CORE_REPOSITORY,
  type VacancyCoreRepository,
} from './vacancy-core.repository';
// Runtime service imports must remain value imports for Nest DI metadata reflection.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */

@Injectable()
export class VacancyCoreService {
  constructor(
    @Inject(VACANCY_CORE_REPOSITORY)
    private readonly repository: VacancyCoreRepository,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private notify(input: {
    organizationId: string;
    recipientUserId: string;
    type: string;
    title: string;
    message: string;
    entityType?: string;
    entityId?: string;
  }): Promise<void> {
    return this.notifications.create(input);
  }

  private async findActiveRoleUserIds(organizationId: string, roleCode: string): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        organizationId,
        status: 'Active',
        userRoles: { some: { role: { code: roleCode, status: 'Active' } } },
      },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  listRequests(organizationId: string): Promise<VacancyRequest[]> {
    return this.repository.listRequests(organizationId);
  }

  async getRequest(organizationId: string, id: string): Promise<VacancyRequest> {
    const request = await this.repository.getRequest(organizationId, id);
    if (!request) {
      throw new NotFoundException(`Vacancy request ${id} was not found.`);
    }
    return request;
  }

  listVacancies(organizationId: string): Promise<Vacancy[]> {
    return this.repository.listVacancies(organizationId);
  }

  async getWorkQueue(
    organizationId: string,
    query: VacancyWorkQueueQueryDto,
  ): Promise<PaginatedResult<JobWorkQueueItem>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.VacancyWhereInput = { organizationId };
    if (query.status) where.status = query.status;
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { vacancyCode: { contains: term, mode: 'insensitive' } },
        { position: { title: { contains: term, mode: 'insensitive' } } },
        { branch: { name: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const [total, vacancies] = await Promise.all([
      this.prisma.vacancy.count({ where }),
      this.prisma.vacancy.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          position: { select: { title: true } },
          branch: { select: { id: true, name: true, code: true } },
          assignments: {
            where: { isActive: true },
            orderBy: { assignedAt: 'asc' },
            include: { user: { select: { id: true, displayName: true } } },
          },
          applications: { select: { stage: true, updatedAt: true } },
        },
      }),
    ]);

    const data: JobWorkQueueItem[] = vacancies.map((vacancy) => {
      const pipelineCounts = createPipelineCounts();
      for (const application of vacancy.applications) {
        const stage = application.stage as ApplicationStage;
        if (stage in pipelineCounts) pipelineCounts[stage] += 1;
      }
      const owner = vacancy.assignments[0]?.user ?? null;
      const remaining = Math.max(0, vacancy.approvedHeadcount - vacancy.joinedHeadcount);
      const newApplicants = pipelineCounts.Applied;
      const isTargetPast = Boolean(
        vacancy.targetStartDate && vacancy.targetStartDate.getTime() < Date.now() && remaining > 0,
      );
      const health = !owner
        ? { state: 'attention' as const, reason: 'No active job owner' }
        : isTargetPast
          ? {
              state: 'attention' as const,
              reason: 'Target start date has passed',
              ...(vacancy.targetStartDate ? { dueAt: vacancy.targetStartDate.toISOString() } : {}),
            }
          : null;
      const nextAction = newApplicants > 0
        ? { code: 'review-applicants', label: 'Review applicants', enabled: true, targetStage: 'Screening' as const, requiresReason: false }
        : vacancy.status === 'Pending Activation'
          ? { code: 'activate-job', label: 'Activate job', enabled: true, requiresReason: false }
          : { code: 'open-job', label: 'Open job', enabled: true, requiresReason: false };
      const latestApplication = vacancy.applications.reduce<Date | null>(
        (latest, app) => !latest || app.updatedAt > latest ? app.updatedAt : latest,
        null,
      );
      const lastActivityAt = latestApplication && latestApplication > vacancy.updatedAt
        ? latestApplication
        : vacancy.updatedAt;

      return {
        id: vacancy.id,
        code: vacancy.vacancyCode,
        title: vacancy.position.title,
        branch: vacancy.branch,
        status: vacancy.status as Vacancy['status'],
        owner,
        headcount: { approved: vacancy.approvedHeadcount, joined: vacancy.joinedHeadcount, remaining },
        pipelineCounts,
        needsActionCount: newApplicants,
        health,
        lastActivity: { at: lastActivityAt.toISOString(), label: latestApplication && latestApplication > vacancy.updatedAt ? 'Applicant activity' : 'Job updated' },
        nextAction,
      };
    });

    return { data, total, page, pageSize };
  }

  async getVacancy(organizationId: string, id: string): Promise<Vacancy> {
    const vacancy = await this.repository.getVacancy(organizationId, id);
    if (!vacancy) {
      throw new NotFoundException(`Vacancy ${id} was not found.`);
    }
    return vacancy;
  }

  getContext(organizationId?: string, requesterUserId?: string) {
    return this.repository.getContext(organizationId, requesterUserId);
  }

  async createRequest(
    organizationId: string,
    actorUserId: string,
    input: CreateVacancyRequestDto,
  ): Promise<VacancyRequest> {
    const payload: CreateVacancyRequestInput = {
      organizationId,
      legalEntityId: input.legalEntityId ?? null,
      branchId: input.branchId,
      positionId: input.positionId,
      requesterId: actorUserId,
      requestedHeadcount: input.requestedHeadcount,
      employmentType: input.employmentType ?? null,
      reason: input.reason ?? null,
      budgetStatus: input.budgetStatus ?? null,
      criticality: input.criticality ?? null,
      targetStartDate: input.targetStartDate ?? null,
      justification: input.justification ?? null,
    };

    return this.repository.createRequest(payload);
  }

  async updateRequest(
    id: string,
    organizationId: string,
    input: UpdateVacancyRequestDto,
  ): Promise<VacancyRequest> {
    const request = await this.requireRequest(id, organizationId);
    if (request.status !== 'Draft' && request.status !== 'Changes Requested') {
      throw new ConflictException(`Request ${request.requestCode} cannot be updated from ${request.status}.`);
    }

    if (input.legalEntityId !== undefined) request.legalEntityId = input.legalEntityId;
    if (input.branchId !== undefined) request.branchId = input.branchId;
    if (input.positionId !== undefined) request.positionId = input.positionId;
    if (input.requestedHeadcount !== undefined) request.requestedHeadcount = input.requestedHeadcount;
    if (input.employmentType !== undefined) request.employmentType = input.employmentType;
    if (input.reason !== undefined) request.reason = input.reason;
    if (input.budgetStatus !== undefined) request.budgetStatus = input.budgetStatus;
    if (input.criticality !== undefined) request.criticality = input.criticality;
    if (input.targetStartDate !== undefined) request.targetStartDate = input.targetStartDate;
    if (input.justification !== undefined) request.justification = input.justification;
    request.updatedAt = new Date().toISOString();

    return this.repository.saveRequest(request);
  }

  async submitRequest(
    id: string,
    organizationId: string,
    actorUserId: string,
    action?: VacancyRequestActionDto,
  ): Promise<VacancyRequest> {
    const request = await this.requireRequest(id, organizationId);

    if (request.status !== 'Draft' && request.status !== 'Changes Requested') {
      throw new ConflictException(
        `Request ${request.requestCode} cannot be submitted from ${request.status}.`,
      );
    }

    const now = new Date().toISOString();
    const revision =
      request.status === 'Changes Requested'
        ? request.approvalRevision + 1
        : request.approvalRevision;

    request.status = 'Pending Approval';
    request.approvalRevision = revision;
    request.submittedAt = now;
    request.updatedAt = now;
    request.approvals.push({
      id: randomUUID(),
      revision,
      step: 1,
      roleCode: 'HIRING_MANAGER',
      assigneeUserId: null,
      status: 'Pending',
      comment: action?.comment ?? null,
      decidedAt: null,
      createdAt: now,
    });

    const savedRequest = await this.repository.saveRequest(request);

    const stepRoleUserIds = await this.findActiveRoleUserIds(organizationId, 'HIRING_MANAGER');
    for (const recipientUserId of stepRoleUserIds) {
      if (recipientUserId === actorUserId) continue;
      await this.notify({
        organizationId,
        recipientUserId,
        type: 'VacancyRequestSubmitted',
        title: 'Vacancy request awaiting approval',
        message: `Request ${request.requestCode} was submitted and is pending hiring-manager approval.`,
        entityType: 'VacancyRequest',
        entityId: request.id,
      });
    }

    return savedRequest;
  }

  approveRequest(
    id: string,
    organizationId: string,
    actorUserId: string,
    actorRoleCodes: string[],
    action: VacancyRequestActionDto,
  ): Promise<VacancyRequest> {
    return this.decideRequest(id, organizationId, actorUserId, actorRoleCodes, 'Approved', action);
  }

  requestChanges(
    id: string,
    organizationId: string,
    actorUserId: string,
    actorRoleCodes: string[],
    action: VacancyRequestActionDto,
  ): Promise<VacancyRequest> {
    return this.decideRequest(id, organizationId, actorUserId, actorRoleCodes, 'Changes Requested', action);
  }

  rejectRequest(
    id: string,
    organizationId: string,
    actorUserId: string,
    actorRoleCodes: string[],
    action: VacancyRequestActionDto,
  ): Promise<VacancyRequest> {
    return this.decideRequest(id, organizationId, actorUserId, actorRoleCodes, 'Rejected', action);
  }

  async cancelRequest(
    id: string,
    organizationId: string,
    actorUserId: string,
  ): Promise<VacancyRequest> {
    const request = await this.requireRequest(id, organizationId);
    if (request.status !== 'Draft' && request.status !== 'Pending Approval') {
      throw new ConflictException(`Request ${request.requestCode} cannot be cancelled from ${request.status}.`);
    }

    // Auto-reject pending approval if it exists
    const approval = [...request.approvals]
      .reverse()
      .find(
        (c) => c.revision === request.approvalRevision && c.status === 'Pending',
      );
    if (approval) {
      approval.status = 'Rejected';
      approval.comment = 'Cancelled by requester';
      approval.decidedAt = new Date().toISOString();
      approval.assigneeUserId = actorUserId;
    }

    request.status = 'Cancelled';
    request.updatedAt = new Date().toISOString();
    return this.repository.saveRequest(request);
  }

  async convertToVacancy(
    id: string,
    organizationId: string,
    actorUserId?: string,
  ): Promise<VacancyRequestActionResult> {
    const request = await this.requireRequest(id, organizationId);
    const existingVacancy = await this.repository.getVacancyByRequestId(organizationId, id);

    if (existingVacancy) {
      return { request, vacancy: existingVacancy, idempotent: true };
    }

    if (request.status !== 'Approved') {
      throw new ConflictException(
        `Request ${request.requestCode} must be approved before conversion.`,
      );
    }

    const now = new Date().toISOString();
    const vacancy: Vacancy = {
      id: randomUUID(),
      organizationId: request.organizationId,
      legalEntityId: request.legalEntityId,
      branchId: request.branchId,
      positionId: request.positionId,
      vacancyRequestId: request.id,
      vacancyCode: await this.repository.nextVacancyCode(),
      status: 'Pending Activation',
      approvedHeadcount: request.requestedHeadcount,
      joinedHeadcount: 0,
      openedAt: null,
      targetStartDate: request.targetStartDate,
      assignments: [],
      createdAt: now,
      updatedAt: now,
    };

    request.status = 'Converted to Vacancy';
    request.updatedAt = now;
    await this.repository.saveRequestAndVacancy(request, vacancy);

    if (request.requesterId !== actorUserId) {
      await this.notify({
        organizationId,
        recipientUserId: request.requesterId,
        type: 'VacancyRequestConverted',
        title: 'Vacancy request converted',
        message: `Request ${request.requestCode} was converted into vacancy ${vacancy.vacancyCode}.`,
        entityType: 'VacancyRequest',
        entityId: request.id,
      });
    }

    return { request, vacancy, idempotent: false };
  }

  private async decideRequest(
    id: string,
    organizationId: string,
    actorUserId: string,
    actorRoleCodes: string[],
    outcome: 'Approved' | 'Changes Requested' | 'Rejected',
    action: VacancyRequestActionDto,
  ): Promise<VacancyRequest> {
    const request = await this.requireRequest(id, organizationId);

    if (request.status !== 'Pending Approval') {
      throw new ConflictException(
        `Request ${request.requestCode} cannot be decided from ${request.status}.`,
      );
    }

    const approval = [...request.approvals]
      .reverse()
      .find(
        (candidate) =>
          candidate.revision === request.approvalRevision &&
          candidate.status === 'Pending',
      );

    if (!approval) {
      throw new ConflictException(
        `Request ${request.requestCode} has no pending approval step.`,
      );
    }

    const isAuthorized =
      actorRoleCodes.includes(approval.roleCode) ||
      actorRoleCodes.includes('ADMINISTRATOR') ||
      approval.assigneeUserId === actorUserId;

    if (!isAuthorized) {
      throw new ForbiddenException('You are not authorized for the current approval step.');
    }

    const now = new Date().toISOString();
    approval.status = outcome;
    approval.comment = action.comment ?? null;
    approval.decidedAt = now;
    approval.assigneeUserId = actorUserId;

    if (outcome === 'Approved') {
      const needsOfferApprover = request.budgetStatus !== 'Budgeted';
      const maxStep = needsOfferApprover ? 3 : 2;

      if (approval.step < maxStep) {
        request.approvals.push({
          id: randomUUID(),
          revision: request.approvalRevision,
          step: approval.step + 1,
          roleCode: approval.step === 1 ? 'HR_MANAGER' : 'OFFER_APPROVER',
          assigneeUserId: null,
          status: 'Pending',
          comment: null,
          decidedAt: null,
          createdAt: now,
        });
      } else {
        request.status = 'Approved';
      }
    } else {
      request.status = outcome;
    }

    request.updatedAt = now;

    const savedRequest = await this.repository.saveRequest(request);

    if (request.requesterId !== actorUserId) {
      const outcomeCopy =
        outcome === 'Approved'
          ? 'was approved'
          : outcome === 'Rejected'
            ? 'was rejected'
            : 'had changes requested';
      await this.notify({
        organizationId,
        recipientUserId: request.requesterId,
        type: 'VacancyRequestDecision',
        title: `Vacancy request ${outcome.toLowerCase()}`,
        message: `Request ${request.requestCode} ${outcomeCopy}${action.comment ? `: ${action.comment}` : '.'}`,
        entityType: 'VacancyRequest',
        entityId: request.id,
      });
    }

    if (outcome === 'Approved') {
      const pendingStep = savedRequest.approvals.find(
        (c) => c.revision === request.approvalRevision && c.status === 'Pending',
      );
      if (pendingStep) {
        const nextRoleUserIds = await this.findActiveRoleUserIds(organizationId, pendingStep.roleCode);
        for (const recipientUserId of nextRoleUserIds) {
          if (recipientUserId === actorUserId) continue;
          await this.notify({
            organizationId,
            recipientUserId,
            type: 'VacancyRequestApprovalStep',
            title: 'Vacancy request needs your approval',
            message: `Approval step (${pendingStep.roleCode}) for request ${request.requestCode} is now pending.`,
            entityType: 'VacancyRequest',
            entityId: request.id,
          });
        }
      }
    }

    return savedRequest;
  }

  private async requireRequest(id: string, organizationId: string): Promise<VacancyRequest> {
    if (!id.trim()) {
      throw new BadRequestException('A vacancy request id is required.');
    }

    const request = await this.repository.getRequest(organizationId, id);
    if (!request) {
      throw new NotFoundException(`Vacancy request ${id} was not found.`);
    }

    return request;
  }

  async getApproverInbox(organizationId: string, userRoleCodes: string[]): Promise<VacancyRequest[]> {
    return this.repository.getApproverInbox(organizationId, userRoleCodes);
  }

  async getVacancyDetail(organizationId: string, id: string): Promise<VacancyDetailView | null> {
    const detail = await this.repository.getVacancyDetail(organizationId, id);
    if (!detail) {
      throw new NotFoundException(`Vacancy ${id} was not found.`);
    }
    return detail;
  }

  async updateVacancyStatus(
    id: string,
    organizationId: string,
    status: Vacancy['status'],
  ): Promise<Vacancy> {
    const vacancy = await this.repository.getVacancy(organizationId, id);
    if (!vacancy) {
      throw new NotFoundException(`Vacancy ${id} was not found.`);
    }

    vacancy.status = status;
    if (status === 'Open' && !vacancy.openedAt) {
      vacancy.openedAt = new Date().toISOString();
    }
    vacancy.updatedAt = new Date().toISOString();
    return this.repository.saveVacancy(vacancy);
  }

  async assignTeamMember(
    id: string,
    organizationId: string,
    dto: AssignTeamMemberDto,
  ): Promise<Vacancy> {
    const vacancy = await this.repository.getVacancy(organizationId, id);
    if (!vacancy) {
      throw new NotFoundException(`Vacancy ${id} was not found.`);
    }

    await this.repository.ensureUserInOrganization(organizationId, dto.userId);

    vacancy.assignments = vacancy.assignments.filter((a) => a.roleCode !== dto.roleCode);
    vacancy.assignments.push({
      id: randomUUID(),
      userId: dto.userId,
      roleCode: dto.roleCode,
      isActive: true,
      assignedAt: new Date().toISOString(),
    });

    vacancy.updatedAt = new Date().toISOString();
    return this.repository.saveVacancy(vacancy);
  }

  async updateVacancy(
    id: string,
    organizationId: string,
    dto: UpdateVacancyDto,
  ): Promise<VacancyDetailView> {
    const vacancy = await this.prisma.vacancy.findUnique({
      where: { id },
      include: { position: true },
    });
    if (!vacancy || vacancy.organizationId !== organizationId) {
      throw new NotFoundException(`Vacancy ${id} was not found.`);
    }

    if (dto.approvedHeadcount !== undefined && dto.approvedHeadcount < vacancy.joinedHeadcount) {
      throw new BadRequestException(
        `Approved headcount cannot be less than already joined headcount (${vacancy.joinedHeadcount}).`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      if (
        dto.approvedHeadcount !== undefined ||
        dto.location !== undefined ||
        dto.targetStartDate !== undefined
      ) {
        await tx.vacancy.update({
          where: { id },
          data: {
            ...(dto.approvedHeadcount !== undefined ? { approvedHeadcount: dto.approvedHeadcount } : {}),
            ...(dto.location !== undefined ? { location: dto.location } : {}),
            ...(dto.targetStartDate !== undefined
              ? { targetStartDate: dto.targetStartDate ? new Date(dto.targetStartDate) : null }
              : {}),
          },
        });
      }

      if (dto.title !== undefined || dto.description !== undefined) {
        await tx.position.update({
          where: { id: vacancy.positionId },
          data: {
            ...(dto.title !== undefined ? { title: dto.title } : {}),
            ...(dto.description !== undefined ? { description: dto.description } : {}),
          },
        });
      }
    });

    const detail = await this.getVacancyDetail(organizationId, id);
    return detail!;
  }
}

function createPipelineCounts(): Record<ApplicationStage, number> {
  return {
    Applied: 0,
    Screening: 0,
    Interview: 0,
    Offer: 0,
    'Pre-Hire': 0,
    Joined: 0,
    Rejected: 0,
    Withdrawn: 0,
  };
}
