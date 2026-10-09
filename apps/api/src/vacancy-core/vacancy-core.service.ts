import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as XLSX from 'xlsx';
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
import { exportFailed } from '../common/errors/api-error';
import { AccessControlService } from '../access-control/access-control.service';
import {
  CLOSED_APPLICATION_STAGES,
  REQUISITION_CANCELLED_REASON,
  assertEligibleAssignee,
  assertGrade,
  assertJobOwnerOrManager,
  requireReason,
  seatStatus,
  writeJobStatus,
  type JobStatus,
} from './vacancy-lifecycle';
import { MasterDataService } from '../master-data/master-data.service';
import type { AuthUser } from '@recruitflow/contracts';

@Injectable()
export class VacancyCoreService {
  constructor(
    @Inject(VACANCY_CORE_REPOSITORY)
    private readonly repository: VacancyCoreRepository,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Optional() @Inject(AccessControlService) private readonly accessControl?: AccessControlService,
    @Optional() @Inject(MasterDataService) private readonly masterData?: MasterDataService,
  ) {}

  async exportExcel(organizationId: string, user?: AuthUser): Promise<Buffer> {
    try {
      const visibility = user && this.accessControl
        ? await this.accessControl.getVacancyVisibilityWhere(user)
        : { organizationId };
      const applicationVisibility = user && this.accessControl
        ? await this.accessControl.getApplicationVisibilityWhere(user)
        : { organizationId };
      const vacancies = await this.prisma.vacancy.findMany({
        where: visibility,
        orderBy: { createdAt: 'desc' },
        include: {
          position: { select: { title: true, code: true } },
          branch: { select: { name: true, code: true } },
          assignments: {
            where: { isActive: true },
            include: { user: { select: { displayName: true } } },
          },
          applications: { where: applicationVisibility, select: { id: true } },
        },
      });

      const headers = [
        'Vacancy Code',
        'Position Title',
        'Position Code',
        'Branch Name',
        'Branch Code',
        'Status',
        'Approved Headcount',
        'Joined Headcount',
        'Remaining Headcount',
        'Applications Count',
        'Primary Recruiter',
        'Target Start Date (UTC)',
        'Created At (UTC)',
      ];

      const rows = vacancies.map((v) => {
        // Older repository mocks expose _count; production includes the scoped
        // application ids so export totals follow the caller's visibility.
        const applicationCount = Array.isArray(v.applications)
          ? v.applications.length
          : (v as unknown as { _count?: { applications?: number } })._count?.applications ?? 0;
        return [
          v.vacancyCode,
          v.position.title,
          v.position.code,
          v.branch.name,
          v.branch.code,
          v.status,
          v.approvedHeadcount,
          v.joinedHeadcount,
          Math.max(0, v.approvedHeadcount - v.joinedHeadcount),
          applicationCount,
          v.assignments[0]?.user.displayName ?? 'Unassigned',
          v.targetStartDate ? v.targetStartDate.toISOString().slice(0, 10) : '',
          v.createdAt.toISOString(),
        ];
      });

      const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, 'Vacancies');
      return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw exportFailed('Unable to export vacancies workbook.');
    }
  }

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

  async listVacancies(organizationId: string, user?: AuthUser): Promise<Vacancy[]> {
    const vacancies = await this.repository.listVacancies(organizationId);
    if (!user || !this.accessControl || vacancies.length === 0) return vacancies;
    const visibility = await this.accessControl.getVacancyVisibilityWhere(user);
    const visible = await this.prisma.vacancy.findMany({
      where: { ...visibility, id: { in: vacancies.map((vacancy) => vacancy.id) } },
      select: { id: true },
    });
    const ids = new Set(visible.map((vacancy) => vacancy.id));
    return vacancies.filter((vacancy) => ids.has(vacancy.id));
  }

  async getWorkQueue(
    organizationId: string,
    query: VacancyWorkQueueQueryDto,
    user?: AuthUser,
  ): Promise<PaginatedResult<JobWorkQueueItem>> {
    const page = Number(query.page) > 0 ? Number(query.page) : 1;
    const pageSize = Number(query.pageSize) > 0 ? Number(query.pageSize) : 20;
    const where: Prisma.VacancyWhereInput = user && this.accessControl
      ? await this.accessControl.getVacancyVisibilityWhere(user)
      : { organizationId };
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
        : vacancy.status === 'On Hold'
          ? { code: 'reopen-job', label: 'Reopen job', enabled: true, requiresReason: true }
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

  async getVacancy(organizationId: string, id: string, user?: AuthUser): Promise<Vacancy> {
    await this.assertVacancyVisible(organizationId, id, user);
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
      branchId: input.branchId,
      positionId: input.positionId,
      requesterId: actorUserId,
      requestedHeadcount: input.requestedHeadcount,
      employmentType: input.employmentType ?? null,
      reason: input.reason ?? null,
      budgetStatus: input.budgetStatus ?? null,
      budgetMin: input.budgetMin ?? null,
      budgetMax: input.budgetMax ?? null,
      budgetCurrency: input.budgetCurrency ?? null,
      criticality: input.criticality ?? null,
      targetStartDate: input.targetStartDate ?? null,
      targetFillDate: input.targetFillDate ?? null,
      recruitmentTiming: input.recruitmentTiming ?? null,
      plannedOpenDate: input.plannedOpenDate ?? null,
      justification: input.justification ?? null,
      jobSummary: input.jobSummary ?? null,
      description: input.description ?? null,
      responsibilities: input.responsibilities ?? null,
      qualifications: input.qualifications ?? null,
      benefits: input.benefits ?? null,
      gradeId: input.gradeId ?? null,
      assignedEmployeeId: input.assignedEmployeeId ?? null,
    };
    // v2 §7: "due date" is the requisition's targetFillDate; accept either name.
    if (input.dueDate !== undefined) payload.targetFillDate = input.dueDate;

    this.validateRequestPlan(payload, false);
    await this.assertRequisitionRefs(organizationId, payload);
    return this.repository.createRequest(payload);
  }

  /** B3: grade from master data; assigned employee active and non-admin. */
  private async assertRequisitionRefs(
    organizationId: string,
    request: { gradeId?: string | null; assignedEmployeeId?: string | null },
  ): Promise<void> {
    if (request.gradeId) await assertGrade(this.prisma, organizationId, request.gradeId);
    if (request.assignedEmployeeId) await assertEligibleAssignee(this.prisma, organizationId, request.assignedEmployeeId);
  }

  private validateRequestPlan(
    request: Partial<Pick<VacancyRequest, 'budgetMin' | 'budgetMax' | 'budgetCurrency' | 'recruitmentTiming' | 'plannedOpenDate' | 'targetFillDate'>>,
    required: boolean,
  ): void {
    const hasAnyBudgetValue = request.budgetMin != null || request.budgetMax != null || Boolean(request.budgetCurrency);
    if ((required || hasAnyBudgetValue) &&
      (request.budgetMin == null || request.budgetMax == null || !request.budgetCurrency ||
        request.budgetMin <= 0 || request.budgetMax < request.budgetMin)) {
      throw new BadRequestException('Enter a valid budget range from minimum to maximum and select AED or EGP.');
    }
    if (required && (!request.recruitmentTiming || !request.targetFillDate)) {
      throw new BadRequestException('Choose when recruitment starts and a target fill date before submitting.');
    }
    if (request.recruitmentTiming === 'Deferred' && !request.plannedOpenDate) {
      throw new BadRequestException('A deferred request needs a planned opening date.');
    }
    if (request.recruitmentTiming !== 'Deferred' && request.plannedOpenDate) {
      throw new BadRequestException('A planned opening date is only valid for deferred recruitment.');
    }
    if (request.plannedOpenDate && request.targetFillDate && request.targetFillDate < request.plannedOpenDate) {
      throw new BadRequestException('Target fill date must be on or after the planned opening date.');
    }
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

    if (input.branchId !== undefined) request.branchId = input.branchId;
    if (input.positionId !== undefined) request.positionId = input.positionId;
    if (input.requestedHeadcount !== undefined) request.requestedHeadcount = input.requestedHeadcount;
    if (input.employmentType !== undefined) request.employmentType = input.employmentType;
    if (input.reason !== undefined) request.reason = input.reason;
    if (input.budgetStatus !== undefined) request.budgetStatus = input.budgetStatus;
    if (input.budgetMin !== undefined) request.budgetMin = input.budgetMin;
    if (input.budgetMax !== undefined) request.budgetMax = input.budgetMax;
    if (input.budgetCurrency !== undefined) request.budgetCurrency = input.budgetCurrency;
    if (input.criticality !== undefined) request.criticality = input.criticality;
    if (input.targetStartDate !== undefined) request.targetStartDate = input.targetStartDate;
    if (input.targetFillDate !== undefined) request.targetFillDate = input.targetFillDate;
    if (input.recruitmentTiming !== undefined) request.recruitmentTiming = input.recruitmentTiming;
    if (input.plannedOpenDate !== undefined) request.plannedOpenDate = input.plannedOpenDate;
    if (input.justification !== undefined) request.justification = input.justification;
    if (input.jobSummary !== undefined) request.jobSummary = input.jobSummary;
    if (input.description !== undefined) request.description = input.description;
    if (input.responsibilities !== undefined) request.responsibilities = input.responsibilities;
    if (input.qualifications !== undefined) request.qualifications = input.qualifications;
    if (input.benefits !== undefined) request.benefits = input.benefits;
    if (input.dueDate !== undefined) request.targetFillDate = input.dueDate;
    if (input.gradeId !== undefined) request.gradeId = input.gradeId;
    if (input.assignedEmployeeId !== undefined) request.assignedEmployeeId = input.assignedEmployeeId;
    this.validateRequestPlan(request, false);
    await this.assertRequisitionRefs(organizationId, request);
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

    this.validateRequestPlan(request, true);

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

  /**
   * B3 (v2 §3/§4): cancel a requisition, with a reason once it is approved.
   * When it has a live job, in ONE transaction: the job becomes Closed and
   * every live file (not Joined/Rejected/Withdrawn) is Rejected with
   * "Requisition cancelled" plus history. Idempotent: a Cancelled requisition
   * is returned unchanged.
   */
  async cancelRequest(
    id: string,
    organizationId: string,
    actorUserId: string,
    reason?: string | null,
  ): Promise<VacancyRequestActionResult & { rejectedApplications?: number; closedJob?: boolean }> {
    const request = await this.requireRequest(id, organizationId);
    if (request.status === 'Cancelled') return { request, idempotent: true };
    if (request.status === 'Rejected') {
      throw new ConflictException(`Request ${request.requestCode} cannot be cancelled from ${request.status}.`);
    }
    const afterApproval = request.status === 'Approved' || request.status === 'Converted to Vacancy';
    const cancelReason = afterApproval ? requireReason(reason, 'cancel an approved requisition') : (reason?.trim() || null);

    const result = await this.prisma.$transaction(async (tx) => {
      // Re-read under the transaction so a concurrent cancel is a no-op.
      const current = await tx.vacancyRequest.findUniqueOrThrow({ where: { id }, select: { status: true, approvalRevision: true } });
      if (current.status === 'Cancelled') return { idempotent: true, rejected: 0, closed: false };
      const now = new Date();
      await tx.vacancyRequestApproval.updateMany({
        where: { vacancyRequestId: id, revision: current.approvalRevision, status: 'Pending' },
        data: { status: 'Rejected', comment: 'Cancelled by requester', decidedAt: now, assigneeUserId: actorUserId },
      });
      await tx.vacancyRequest.update({
        where: { id },
        data: { status: 'Cancelled', cancelledAt: now, cancelReason },
      });
      const job = await tx.vacancy.findUnique({ where: { vacancyRequestId: id }, select: { id: true, status: true } });
      let rejected = 0;
      let closed = false;
      if (job && job.status !== 'Closed') {
        closed = await writeJobStatus(tx, job, 'Closed', `${REQUISITION_CANCELLED_REASON}: ${cancelReason ?? 'no reason given'}`, actorUserId);
        const live = await tx.application.findMany({
          where: { vacancyId: job.id, stage: { notIn: [...CLOSED_APPLICATION_STAGES] } },
          select: { id: true, stage: true },
        });
        for (const application of live) {
          await tx.application.update({ where: { id: application.id }, data: { stage: 'Rejected', version: { increment: 1 } } });
          await tx.applicationStatusHistory.create({
            data: { applicationId: application.id, fromStage: application.stage, toStage: 'Rejected', changedById: actorUserId, reason: REQUISITION_CANCELLED_REASON },
          });
        }
        rejected = live.length;
      }
      return { idempotent: false, rejected, closed };
    });

    const saved = await this.requireRequest(id, organizationId);
    const vacancy = await this.repository.getVacancyByRequestId(organizationId, id);
    return {
      request: saved,
      ...(vacancy ? { vacancy } : {}),
      idempotent: result.idempotent,
      rejectedApplications: result.rejected,
      closedJob: result.closed,
    };
  }

  /** Back-compat alias for POST /vacancy-requests/:id/convert. Use activate. */
  async convertToVacancy(
    id: string,
    organizationId: string,
    actorUserId?: string,
  ): Promise<VacancyRequestActionResult> {
    return this.activateRequest(id, organizationId, actorUserId ?? null, {});
  }

  /**
   * B3 (v2 §4/§7): activating an approved requisition creates its job and
   * assigns the employee in one step. No Pending Activation. Cancelled -> 409.
   * Idempotent once activated.
   */
  async activateRequest(
    id: string,
    organizationId: string,
    actorUserId: string | null,
    input: { assignedEmployeeId?: string | null },
  ): Promise<VacancyRequestActionResult> {
    const request = await this.requireRequest(id, organizationId);
    if (request.status === 'Cancelled') {
      throw new ConflictException({ code: 'REQUISITION_CANCELLED', message: `Request ${request.requestCode} is Cancelled and cannot be activated.` });
    }
    const existingVacancy = await this.repository.getVacancyByRequestId(organizationId, id);
    if (request.status === 'Converted to Vacancy' && existingVacancy) {
      return { request, vacancy: existingVacancy, idempotent: true };
    }
    if (request.status !== 'Approved') {
      throw new ConflictException(`Request ${request.requestCode} must be approved before activation.`);
    }
    if (!request.targetFillDate) {
      throw new BadRequestException({ code: 'DUE_DATE_REQUIRED', message: `Request ${request.requestCode} needs a due date before activation.` });
    }
    const assigneeId = input.assignedEmployeeId ?? request.assignedEmployeeId ?? null;
    if (!assigneeId) {
      throw new BadRequestException({ code: 'ASSIGNEE_REQUIRED', message: `Request ${request.requestCode} needs an assigned employee before activation.` });
    }

    const deferred = request.recruitmentTiming === 'Deferred';
    const vacancyCode = existingVacancy ? null : await this.repository.nextVacancyCode();
    const vacancyId = await this.prisma.$transaction(async (tx) => {
      await assertEligibleAssignee(tx, organizationId, assigneeId);
      const now = new Date();
      let jobId: string;
      if (existingVacancy) {
        // Placeholder kept by the B3 migration (was Pending Activation): reuse it.
        jobId = existingVacancy.id;
        await tx.vacancy.update({ where: { id: jobId }, data: { status: deferred ? 'On Hold' : 'Open', openedAt: now } });
        await tx.vacancyStatusHistory.create({
          data: { vacancyId: jobId, fromStatus: existingVacancy.status, toStatus: deferred ? 'On Hold' : 'Open', reason: 'Requisition activated', changedById: actorUserId },
        });
      } else {
        jobId = randomUUID();
        await tx.vacancy.create({
          data: {
            id: jobId,
            organizationId,
            branchId: request.branchId,
            positionId: request.positionId,
            vacancyRequestId: request.id,
            vacancyCode: vacancyCode!,
            status: deferred ? 'On Hold' : 'Open',
            approvedHeadcount: request.requestedHeadcount,
            joinedHeadcount: 0,
            openedAt: now,
            targetStartDate: request.targetStartDate ? new Date(request.targetStartDate) : null,
            jobSummary: request.jobSummary,
            description: request.description,
            responsibilities: request.responsibilities,
            qualifications: request.qualifications,
            benefits: request.benefits,
          },
        });
        await tx.vacancyStatusHistory.create({
          data: { vacancyId: jobId, fromStatus: null, toStatus: 'Open', reason: 'Requisition activated', changedById: actorUserId },
        });
        if (deferred) {
          await tx.vacancyStatusHistory.create({
            data: { vacancyId: jobId, fromStatus: 'Open', toStatus: 'On Hold', reason: `Deferred recruitment until ${request.plannedOpenDate ?? 'the planned open date'}`, changedById: actorUserId },
          });
        }
      }
      await tx.vacancyAssignment.updateMany({ where: { vacancyId: jobId, assignmentKind: 'PRIMARY', isActive: true, NOT: { userId: assigneeId } }, data: { isActive: false } });
      const already = await tx.vacancyAssignment.findFirst({ where: { vacancyId: jobId, assignmentKind: 'PRIMARY', isActive: true, userId: assigneeId } });
      if (!already) {
        await tx.vacancyAssignment.create({
          data: { id: randomUUID(), vacancyId: jobId, userId: assigneeId, roleCode: 'RECRUITER', assignmentKind: 'PRIMARY', isActive: true, assignedAt: now },
        });
      }
      await tx.vacancyRequest.update({
        where: { id: request.id },
        data: { status: 'Converted to Vacancy', activatedAt: now, assignedEmployeeId: assigneeId },
      });
      return jobId;
    });

    const savedRequest = await this.requireRequest(id, organizationId);
    const vacancy = await this.repository.getVacancy(organizationId, vacancyId);
    if (request.requesterId !== actorUserId) {
      await this.notify({
        organizationId,
        recipientUserId: request.requesterId,
        type: 'VacancyRequestConverted',
        title: 'Requisition activated',
        message: `Request ${request.requestCode} was activated as job ${vacancy?.vacancyCode ?? ''}.`,
        entityType: 'VacancyRequest',
        entityId: request.id,
      });
    }
    return { request: savedRequest, ...(vacancy ? { vacancy } : {}), idempotent: false };
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

  async getVacancyDetail(organizationId: string, id: string, user?: AuthUser): Promise<VacancyDetailView | null> {
    await this.assertVacancyVisible(organizationId, id, user);
    const detail = await this.repository.getVacancyDetail(organizationId, id);
    if (!detail) {
      throw new NotFoundException(`Vacancy ${id} was not found.`);
    }
    return detail;
  }

  /**
   * B3: job status changes go through the transition table. Hold, reopen and
   * close are owner/manager actions with a required reason and a history row.
   */
  async updateVacancyStatus(
    id: string,
    organizationId: string,
    status: string,
    user?: AuthUser,
    reason?: string | null,
  ): Promise<Vacancy> {
    if (status === 'On Hold') return this.holdVacancy(id, organizationId, reason, user);
    if (status === 'Open') return this.reopenVacancy(id, organizationId, reason, user);
    if (status === 'Closed') return this.closeVacancy(id, organizationId, reason, user);
    throw new BadRequestException(`Status ${status} is set by the system (seats) and cannot be chosen.`);
  }

  async holdVacancy(id: string, organizationId: string, reason: string | null | undefined, user?: AuthUser): Promise<Vacancy> {
    return this.changeJobStatus(id, organizationId, user, 'hold', reason, () => 'On Hold');
  }

  async reopenVacancy(id: string, organizationId: string, reason: string | null | undefined, user?: AuthUser): Promise<Vacancy> {
    return this.changeJobStatus(id, organizationId, user, 'reopen', reason, (job) => {
      if (job.status !== 'On Hold') {
        throw new ConflictException({ code: 'ILLEGAL_JOB_TRANSITION', message: `Only a held job can be reopened (job is ${job.status}).` });
      }
      return seatStatus(job.joinedHeadcount, job.approvedHeadcount);
    });
  }

  async closeVacancy(id: string, organizationId: string, reason: string | null | undefined, user?: AuthUser): Promise<Vacancy> {
    return this.changeJobStatus(id, organizationId, user, 'close', reason, () => 'Closed');
  }

  private async changeJobStatus(
    id: string,
    organizationId: string,
    user: AuthUser | undefined,
    action: 'hold' | 'reopen' | 'close',
    reason: string | null | undefined,
    target: (job: { status: string; joinedHeadcount: number; approvedHeadcount: number }) => JobStatus,
  ): Promise<Vacancy> {
    await this.assertVacancyVisible(organizationId, id, user);
    const text = requireReason(reason, `${action} this job`);
    if (!user) throw new ForbiddenException('Only the job owner or their manager can change job status.');
    await this.prisma.$transaction(async (tx) => {
      const job = await tx.vacancy.findFirst({
        where: { id, organizationId },
        select: { id: true, status: true, joinedHeadcount: true, approvedHeadcount: true },
      });
      if (!job) throw new NotFoundException(`Vacancy ${id} was not found.`);
      await assertJobOwnerOrManager(tx, organizationId, id, user.userId);
      const to = target(job);
      if (job.status === to) {
        throw new ConflictException({ code: 'ILLEGAL_JOB_TRANSITION', message: `Job is already ${to}.` });
      }
      await writeJobStatus(tx, job, to, text, user.userId);
    });
    const updated = await this.repository.getVacancy(organizationId, id);
    if (!updated) throw new NotFoundException(`Vacancy ${id} was not found.`);
    return updated;
  }

  async getVacancyStatusHistory(organizationId: string, id: string, user?: AuthUser) {
    await this.assertVacancyVisible(organizationId, id, user);
    return this.prisma.vacancyStatusHistory.findMany({
      where: { vacancyId: id, vacancy: { organizationId } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, fromStatus: true, toStatus: true, reason: true, changedById: true, createdAt: true },
    });
  }

  async assignTeamMember(
    id: string,
    organizationId: string,
    dto: AssignTeamMemberDto,
    user?: AuthUser,
  ): Promise<Vacancy> {
    await this.assertVacancyVisible(organizationId, id, user);
    const vacancy = await this.repository.getVacancy(organizationId, id);
    if (!vacancy) {
      throw new NotFoundException(`Vacancy ${id} was not found.`);
    }

    await this.repository.ensureUserInOrganization(organizationId, dto.userId);

    const assignmentKind = dto.assignmentKind ?? 'PRIMARY';
    await this.assertAssignmentPermission(id, organizationId, dto, assignmentKind, user);
    await this.prisma.$transaction(async (transaction) => {
      const activeAssignment = await transaction.vacancyAssignment.findFirst({
        where: { vacancyId: id, roleCode: dto.roleCode, assignmentKind, userId: dto.userId, isActive: true },
        select: { userId: true },
      });
      if (activeAssignment) return;

      // Assignment changes are dedicated writes. They never save a stale
      // vacancy snapshot and they retain inactive rows as assignment history.
      if (assignmentKind === 'PRIMARY') {
        await transaction.vacancyAssignment.updateMany({
          where: { vacancyId: id, roleCode: dto.roleCode, assignmentKind, isActive: true },
          data: { isActive: false },
        });
      }
      const historicalAssignment = await transaction.vacancyAssignment.findFirst({
        where: { vacancyId: id, userId: dto.userId, roleCode: dto.roleCode, assignmentKind, isActive: false },
        orderBy: { assignedAt: 'desc' },
        select: { id: true },
      });
      if (historicalAssignment) {
        await transaction.vacancyAssignment.update({
          where: { id: historicalAssignment.id },
          data: { isActive: true, assignedAt: new Date() },
        });
      } else {
        await transaction.vacancyAssignment.create({
          data: {
            id: randomUUID(),
            vacancyId: id,
            userId: dto.userId,
            roleCode: dto.roleCode,
            assignmentKind,
            isActive: true,
            assignedAt: new Date(),
          },
        });
      }
    });

    const updated = await this.repository.getVacancy(organizationId, id);
    if (!updated) throw new NotFoundException(`Vacancy ${id} was not found.`);
    return updated;
  }

  /**
   * VACANCY_MANAGE remains a backwards-compatible super-capability. Focused
   * roles must explicitly receive VACANCY_ASSIGN for a first assignment and
   * VACANCY_REASSIGN for replacing an existing primary owner.
   */
  private async assertAssignmentPermission(
    vacancyId: string,
    organizationId: string,
    dto: AssignTeamMemberDto,
    assignmentKind: string,
    user?: AuthUser,
  ): Promise<void> {
    // Internal callers and the in-memory unit tests do not carry an auth
    // context. HTTP calls are protected by the global JWT/permission guards.
    if (!user) return;

    const actor = await this.prisma.user.findUnique({
      where: { id: user.userId, organizationId, status: 'Active' },
      select: {
        userRoles: {
          where: { role: { status: 'Active' } },
          select: { role: { select: { code: true, permissions: { select: { permission: { select: { code: true } } } } } } },
        },
      },
    });
    const permissionCodes = new Set(
      actor?.userRoles.flatMap((userRole) =>
        userRole.role.permissions.map((rolePermission) => rolePermission.permission.code),
      ) ?? [],
    );
    await this.assertReportsToActor(organizationId, user.userId, dto.userId);

    const isAdmin = actor?.userRoles.some((ur) => ur.role.code === 'ADMINISTRATOR');
    const canManage = permissionCodes.has('VACANCY_MANAGE');
    const canAssign = permissionCodes.has('VACANCY_ASSIGN');
    const canReassign = permissionCodes.has('VACANCY_REASSIGN');

    if (isAdmin) return;

    if (assignmentKind !== 'PRIMARY') {
      if (!canAssign && !canManage) {
        throw new ForbiddenException('Assigning supporting vacancy members requires VACANCY_ASSIGN permission.');
      }
      return;
    }

    const currentPrimary = await this.prisma.vacancyAssignment.findFirst({
      where: {
        vacancyId,
        roleCode: dto.roleCode,
        assignmentKind: 'PRIMARY',
        isActive: true,
      },
      select: { userId: true },
    });
    const isReassignment = Boolean(currentPrimary && currentPrimary.userId !== dto.userId);
    if (isReassignment && !canReassign) {
      throw new ForbiddenException('Reassigning a primary vacancy owner requires VACANCY_REASSIGN permission.');
    }
    if (!isReassignment && !canAssign && !canManage) {
      throw new ForbiddenException('Assigning a vacancy owner requires VACANCY_ASSIGN permission.');
    }
  }

  /** The assignee may be the actor, or anyone who reports up to the actor. */
  private async assertReportsToActor(organizationId: string, actorId: string, assigneeId: string): Promise<void> {
    if (assigneeId === actorId) return;
    const assignee = await this.prisma.user.findFirst({
      where: { id: assigneeId, organizationId, status: 'Active' },
      select: { managerId: true },
    });
    let cursor = assignee?.managerId ?? null;
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor)) {
      if (cursor === actorId) return;
      seen.add(cursor);
      const next = await this.prisma.user.findFirst({
        where: { id: cursor, organizationId },
        select: { managerId: true },
      });
      cursor = next?.managerId ?? null;
    }
    throw new ForbiddenException('Access denied: you can only assign people who report to you.');
  }

  async updateVacancy(
    id: string,
    organizationId: string,
    dto: UpdateVacancyDto,
    user?: AuthUser,
  ): Promise<VacancyDetailView> {
    await this.assertVacancyVisible(organizationId, id, user);
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
      const normalizedRequiredSkills = dto.requiredSkills !== undefined
        ? this.masterData
          ? await this.masterData.syncSkillsInTransaction(tx, organizationId, dto.requiredSkills)
          : dto.requiredSkills
        : undefined;
      if (
        dto.approvedHeadcount !== undefined ||
        dto.location !== undefined ||
        dto.department !== undefined ||
        dto.jobSummary !== undefined ||
        dto.description !== undefined ||
        dto.responsibilities !== undefined ||
        dto.qualifications !== undefined ||
        dto.benefits !== undefined ||
        dto.targetStartDate !== undefined ||
        dto.requiredSkills !== undefined ||
        dto.minExperienceYears !== undefined
      ) {
        await tx.vacancy.update({
          where: { id },
          data: {
            ...(dto.approvedHeadcount !== undefined ? { approvedHeadcount: dto.approvedHeadcount } : {}),
            ...(dto.location !== undefined ? { location: dto.location } : {}),
            ...(dto.department !== undefined ? { department: dto.department } : {}),
            ...(dto.jobSummary !== undefined ? { jobSummary: dto.jobSummary } : {}),
            ...(dto.description !== undefined ? { description: dto.description } : {}),
            ...(dto.responsibilities !== undefined ? { responsibilities: dto.responsibilities } : {}),
            ...(dto.qualifications !== undefined ? { qualifications: dto.qualifications } : {}),
            ...(dto.benefits !== undefined ? { benefits: dto.benefits } : {}),
            ...(normalizedRequiredSkills !== undefined ? { requiredSkills: normalizedRequiredSkills } : {}),
            ...(dto.minExperienceYears !== undefined ? { minExperienceYears: dto.minExperienceYears } : {}),
            ...(dto.targetStartDate !== undefined
              ? { targetStartDate: dto.targetStartDate ? new Date(dto.targetStartDate) : null }
              : {}),
          },
        });
      }

      if (dto.title !== undefined) {
        await tx.position.update({
          where: { id: vacancy.positionId },
          data: { title: dto.title },
        });
      }
    });

    const detail = await this.getVacancyDetail(organizationId, id, user);
    return detail!;
  }

  async deleteVacancy(
    id: string,
    organizationId: string,
    user?: AuthUser,
  ): Promise<{ deleted: true; id: string }> {
    if (!user) {
      throw new ForbiddenException('Only administrators can delete vacancies.');
    }

    // Keep this check server-side and authoritative. The UI hides the action for
    // non-admins, but the role guard must still protect direct API requests.
    const administrator = await this.prisma.user.findFirst({
      where: {
        id: user.userId,
        organizationId,
        status: 'Active',
        userRoles: {
          some: { role: { code: 'ADMINISTRATOR', status: 'Active' } },
        },
      },
      select: { id: true },
    });
    if (!administrator) {
      throw new ForbiddenException('Only administrators can delete vacancies.');
    }

    const vacancy = await this.prisma.vacancy.findFirst({
      where: { id, organizationId },
      select: { id: true, vacancyRequestId: true },
    });
    if (!vacancy) {
      throw new NotFoundException(`Vacancy ${id} was not found.`);
    }

    const applicationCount = await this.prisma.application.count({ where: { vacancyId: id } });
    if (applicationCount > 0) {
      throw new ConflictException(
        'This vacancy has applications and cannot be deleted. Cancel or archive it instead.',
      );
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.vacancyAssignment.deleteMany({ where: { vacancyId: id } });
      await transaction.vacancyRequestApproval.deleteMany({ where: { vacancyRequestId: vacancy.vacancyRequestId } });
      await transaction.vacancy.delete({ where: { id } });
      await transaction.vacancyRequest.delete({ where: { id: vacancy.vacancyRequestId } });
    });

    return { deleted: true, id };
  }

  private async assertVacancyVisible(organizationId: string, id: string, user?: AuthUser): Promise<void> {
    if (!user || !this.accessControl) return;
    const visibility = await this.accessControl.getVacancyVisibilityWhere(user);
    const vacancy = await this.prisma.vacancy.findFirst({ where: { id, ...visibility }, select: { id: true } });
    if (!vacancy) throw new NotFoundException(`Vacancy ${id} was not found.`);
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
