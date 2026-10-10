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
  RedactedVacancy,
  Vacancy,
  VacancyRequest,
  VacancyRequestActionResult,
  VacancyDetailView,
} from '@recruitflow/contracts';
import type { Prisma } from '@recruitflow/database';
import { HAS_VACANCY_OWNER } from '../common/schema-features';
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
  assertDepartment,
  assertJobOwnerOrManager,
  requireReason,
  seatStatus,
  writeJobStatus, parseHoldUntil, resolveJobStatusReason,
  type JobStatus,
} from './vacancy-lifecycle';
import { MasterDataService } from '../master-data/master-data.service';
import type { AuthUser } from '@recruitflow/contracts';
import { assertEligibleOwner } from '../common/access/file-access';

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
      const access = await this.vacancyAccess(organizationId, user);
      const visibility = access.scopeWhere;
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
        if (!access.isFull(v.id)) {
          // B1 redaction: title, site and seats only.
          return [
            '', v.position.title, '', v.branch.name, '', '', v.approvedHeadcount, v.joinedHeadcount,
            '', '', '', '', '',
          ];
        }
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

  /**
   * M1: requisitions with display names, scoped server-side for every non-admin (Manager, Recruiter, HR alike):
   * the ones they requested or are assigned to, plus the same for their direct reports (users.managerId).
   * Administrators see all. Called without a user (internal), no scope.
   */
  async listRequests(organizationId: string, user?: AuthUser): Promise<VacancyRequest[]> {
    const all = await this.repository.listRequests(organizationId);
    const scope = user && !user.roleCodes.includes('ADMINISTRATOR')
      ? {
          OR: [
            { requesterId: user.userId },
            { assignedEmployeeId: user.userId },
            { requester: { managerId: user.userId } },
            { assignedEmployee: { managerId: user.userId } },
          ],
        }
      : {};
    const rows = await this.prisma.vacancyRequest.findMany({
      where: { organizationId, ...scope },
      select: {
        id: true,
        position: { select: { title: true } },
        branch: { select: { id: true, name: true } },
        grade: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        requester: { select: { id: true, displayName: true } },
        assignedEmployee: { select: { id: true, displayName: true } },
        vacancy: { select: { assignments: { where: { isActive: true, assignmentKind: 'PRIMARY' }, take: 1, select: { user: { select: { id: true, displayName: true } } } } } },
      },
    });
    const extra = new Map(rows.map((r) => [r.id, {
      primaryRecruiter: primaryRecruiterOf(r),
      title: r.position.title,
      site: { id: r.branch.id, name: r.branch.name },
      grade: r.grade,
      department: r.department,
      requester: { id: r.requester.id, name: r.requester.displayName },
      requesterName: r.requester.displayName,
      owner: r.assignedEmployee ? { id: r.assignedEmployee.id, name: r.assignedEmployee.displayName } : null,
      ownerName: r.assignedEmployee?.displayName ?? null,
    }]));
    return all.filter((r) => extra.has(r.id)).map((r) => ({ ...r, ...extra.get(r.id)! }));
  }

  /** M1: the requester or the requester's direct manager (users.managerId). */
  private async isRequesterOrManager(requesterId: string, actorUserId: string | null): Promise<boolean> {
    if (!actorUserId) return false;
    if (requesterId === actorUserId) return true;
    const requester = await this.prisma.user.findUnique({ where: { id: requesterId }, select: { managerId: true } });
    return requester?.managerId === actorUserId;
  }

  /**
   * M1: PATCH /vacancy-requests/:id/target — after activation the Manager (requester or their manager) may change
   * seats and/or the due date with a reason. Seats never drop below the number already joined (409). Each change
   * is written to the job's history (vacancy_status_histories, status unchanged) and the audit log.
   */
  async updateRequisitionTarget(
    id: string,
    organizationId: string,
    actorUserId: string,
    input: { seats?: number; dueDate?: string; reason?: string },
  ): Promise<VacancyRequestActionResult> {
    const request = await this.requireRequest(id, organizationId);
    const reason = input.reason?.trim();
    if (!reason) throw new BadRequestException({ code: 'REASON_REQUIRED', message: 'A reason is required to change the target.' });
    if (input.seats === undefined && input.dueDate === undefined) throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'Give seats and/or dueDate.' });
    if (!(await this.isRequesterOrManager(request.requesterId, actorUserId))) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Only the requesting Manager (or their manager) can change the target.' });
    }
    const vacancy = await this.prisma.vacancy.findFirst({ where: { vacancyRequestId: id, organizationId } });
    if (request.status !== 'Converted to Vacancy' || !vacancy) {
      throw new ConflictException({ code: 'REQUISITION_NOT_ACTIVE', message: `Request ${request.requestCode} is not active yet; edit it instead.` });
    }
    if (input.seats !== undefined && input.seats < vacancy.joinedHeadcount) {
      throw new ConflictException({ code: 'SEATS_BELOW_JOINED', message: `Seats cannot drop below the ${vacancy.joinedHeadcount} already joined.`, joined: vacancy.joinedHeadcount });
    }
    if (input.dueDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) {
      throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'dueDate must be YYYY-MM-DD.' });
    }
    const changes: string[] = [];
    const before = { seats: vacancy.approvedHeadcount, dueDate: request.targetFillDate ? String(request.targetFillDate).slice(0, 10) : null };
    if (input.seats !== undefined && input.seats !== before.seats) changes.push(`seats ${before.seats} -> ${input.seats}`);
    if (input.dueDate !== undefined && input.dueDate !== before.dueDate) changes.push(`due date ${before.dueDate ?? 'none'} -> ${input.dueDate}`);
    if (changes.length) {
      await this.prisma.$transaction(async (tx) => {
        if (input.seats !== undefined) {
          await tx.vacancy.update({ where: { id: vacancy.id }, data: { approvedHeadcount: input.seats } });
          await tx.vacancyRequest.update({ where: { id }, data: { requestedHeadcount: input.seats } });
        }
        if (input.dueDate !== undefined) await tx.vacancyRequest.update({ where: { id }, data: { targetFillDate: new Date(`${input.dueDate}T00:00:00Z`) } });
        await tx.vacancyStatusHistory.create({
          data: { vacancyId: vacancy.id, fromStatus: vacancy.status, toStatus: vacancy.status, reason: `Target changed: ${changes.join('; ')}. Reason: ${reason}`, changedById: actorUserId },
        });
        await tx.auditLog.create({
          data: { organizationId, actorUserId, action: 'REQUISITION_TARGET_UPDATE', entityType: 'VacancyRequest', entityId: id, result: 'Success', reason, beforeData: before, afterData: { seats: input.seats ?? before.seats, dueDate: input.dueDate ?? before.dueDate, reason } },
        });
      });
    }
    const saved = await this.requireRequest(id, organizationId);
    const job = await this.repository.getVacancy(organizationId, vacancy.id);
    return { request: saved, ...(job ? { vacancy: job } : {}), idempotent: changes.length === 0 };
  }

  async getRequest(organizationId: string, id: string): Promise<VacancyRequest> {
    const request = await this.repository.getRequest(organizationId, id);
    if (!request) {
      throw new NotFoundException(`Vacancy request ${id} was not found.`);
    }
    // B2-16: the drawer shows the primary recruiter (the job's owner once active, else the assigned employee).
    const people = await this.prisma.vacancyRequest.findFirst({ where: { id, organizationId }, select: {
      assignedEmployee: { select: { id: true, displayName: true } },
      vacancy: { select: { assignments: { where: { isActive: true, assignmentKind: 'PRIMARY' }, take: 1, select: { user: { select: { id: true, displayName: true } } } } } },
    } });
    return { ...request, primaryRecruiter: people ? primaryRecruiterOf(people) : null } as VacancyRequest;
  }

  /** B2-2: Approved requisitions are activated by VACANCY_MANAGE holders or the requesting Manager (or his manager). */
  private async holdsPermission(userId: string, organizationId: string, code: string): Promise<boolean> {
    return (await this.prisma.userRole.count({ where: { userId, user: { organizationId, status: 'Active' }, role: { status: 'Active', permissions: { some: { permission: { code } } } } } })) > 0;
  }

  async listVacancies(organizationId: string, user?: AuthUser, options: { mine?: boolean } = {}): Promise<Array<Vacancy | RedactedVacancy>> {
    // B2: deactivated (Closed) jobs drop out of default lists and pickers;
    // they stay readable by id and in history. Legacy Cancelled jobs too.
    let vacancies = (await this.repository.listVacancies(organizationId)).filter((vacancy) => !INACTIVE_JOB_STATUSES.includes(vacancy.status));
    if (options.mine) {
      if (!user) return [];
      // B3 ?mine=true with B1 ownership: Vacancy.primaryRecruiterId.
      const owned = await this.prisma.vacancy.findMany({ where: { organizationId, primaryRecruiterId: user.userId }, select: { id: true } });
      const ownedIds = new Set(owned.map((o) => o.id));
      vacancies = vacancies.filter((v) => ownedIds.has(v.id));
    }
    if (!user || !this.accessControl || vacancies.length === 0) return vacancies;
    const access = await this.vacancyAccess(organizationId, user);
    const inScope = await this.prisma.vacancy.findMany({
      where: { AND: [access.scopeWhere, { id: { in: vacancies.map((vacancy) => vacancy.id) } }] },
      select: { id: true },
    });
    const ids = new Set(inScope.map((vacancy) => vacancy.id));
    return vacancies
      .filter((vacancy) => ids.has(vacancy.id))
      .map((vacancy) => (access.isFull(vacancy.id) ? vacancy : redactVacancy(vacancy)));
  }

  /**
   * B1 job access for the caller: the scope predicate (which jobs appear at
   * all) and which of them are shown in full. Oversight users see every
   * in-scope job in full; others see full detail only for jobs they own,
   * support, requested, or whose owner reports to them.
   */
  private async vacancyAccess(organizationId: string, user?: AuthUser): Promise<{
    scopeWhere: Prisma.VacancyWhereInput;
    isFull: (vacancyId: string) => boolean;
  }> {
    if (!user || !this.accessControl) {
      return { scopeWhere: { organizationId }, isFull: () => true };
    }
    const [scopeWhere, fullWhere] = await Promise.all([
      this.accessControl.getVacancyScopeWhere(user),
      this.accessControl.getVacancyVisibilityWhere(user),
    ]);
    const full = await this.prisma.vacancy.findMany({ where: fullWhere, select: { id: true } });
    const fullIds = new Set(full.map((vacancy) => vacancy.id));
    return { scopeWhere, isFull: (vacancyId) => fullIds.has(vacancyId) };
  }

  async getWorkQueue(
    organizationId: string,
    query: VacancyWorkQueueQueryDto,
    user?: AuthUser,
  ): Promise<PaginatedResult<JobWorkQueueItem | RedactedVacancy>> {
    const page = Number(query.page) > 0 ? Number(query.page) : 1;
    const pageSize = Number(query.pageSize) > 0 ? Number(query.pageSize) : 20;
    const access = await this.vacancyAccess(organizationId, user);
    // AND-composed so the search OR can never widen the scope predicate.
    const filters: Prisma.VacancyWhereInput[] = [access.scopeWhere];
    // B2: default lists hide deactivated (Closed/legacy Cancelled) jobs.
    filters.push(query.status ? { status: query.status } : { status: { notIn: INACTIVE_JOB_STATUSES } });
    if (query.search?.trim()) {
      const term = query.search.trim();
      filters.push({
        OR: [
          { vacancyCode: { contains: term, mode: 'insensitive' } },
          { position: { title: { contains: term, mode: 'insensitive' } } },
          { branch: { name: { contains: term, mode: 'insensitive' } } },
        ],
      });
    }
    if (query.mine === 'true' || query.mine === true) {
      filters.push({ primaryRecruiterId: user?.userId ?? '00000000-0000-0000-0000-000000000000' });
    }
    const where: Prisma.VacancyWhereInput = { AND: filters };

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
          vacancyRequest: { select: { targetFillDate: true } },
        },
      }),
    ]);

    const data: Array<JobWorkQueueItem | RedactedVacancy> = vacancies.map((vacancy) => {
      if (!access.isFull(vacancy.id)) {
        return redactVacancy({
          id: vacancy.id,
          title: vacancy.position.title,
          branch: vacancy.branch,
          approvedHeadcount: vacancy.approvedHeadcount,
          joinedHeadcount: vacancy.joinedHeadcount,
        });
      }
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
        // B3/E3: the requisition's due date (plain YYYY-MM-DD) and department.
        dueDate: vacancy.vacancyRequest?.targetFillDate ? vacancy.vacancyRequest.targetFillDate.toISOString().slice(0, 10) : null,
        department: vacancy.department ?? null,
        holdUntil: vacancy.holdUntil ? vacancy.holdUntil.toISOString().slice(0, 10) : null,
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
      departmentId: input.departmentId ?? null,
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
    request: { gradeId?: string | null; departmentId?: string | null; assignedEmployeeId?: string | null },
  ): Promise<void> {
    if (request.gradeId) await assertGrade(this.prisma, organizationId, request.gradeId);
    if (request.departmentId) await assertDepartment(this.prisma, organizationId, request.departmentId);
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
    if (input.departmentId !== undefined) request.departmentId = input.departmentId;
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

    // B3 (v2 §7/§8): a requisition cannot leave Draft without a due date.
    if (!request.targetFillDate) {
      throw new BadRequestException({
        code: 'DUE_DATE_REQUIRED',
        message: `Request ${request.requestCode} needs a due date (dueDate / targetFillDate) before it can leave Draft.`,
      });
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
          await tx.application.update({ where: { id: application.id }, data: { stage: 'Rejected', rejectionReason: REQUISITION_CANCELLED_REASON, version: { increment: 1 } } });
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
    // M1: activation needs no sign-off. The requesting Manager (or their manager) activates straight from Draft;
    // the approval path still works for Approved requisitions.
    const fromDraft = request.status === 'Draft';
    if (fromDraft && !(await this.isRequesterOrManager(request.requesterId, actorUserId))) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Only the requesting Manager (or their manager) can activate a Draft requisition.' });
    }
    if (request.status === 'Changes Requested' || request.status === 'Pending Approval') {
      // M1: once an approver is involved, Activate waits until the requisition is (re)submitted and Approved.
      throw new ConflictException({ code: 'REQUISITION_NOT_APPROVED', message: `Request ${request.requestCode} is ${request.status}; resubmit it and get it approved before activating.` });
    }
    if (request.status === 'Approved' && actorUserId && !(await this.isRequesterOrManager(request.requesterId, actorUserId)) && !(await this.holdsPermission(actorUserId, organizationId, 'VACANCY_MANAGE'))) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Only the requesting Manager (or their manager) or a VACANCY_MANAGE holder can activate this requisition.' });
    }
    if (request.status !== 'Approved' && !fromDraft) {
      throw new ConflictException(`Request ${request.requestCode} must be a Draft or Approved to activate.`);
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
      // B1 x B3: the activated job's single owner is the assigned employee. Guarded: the column exists once B1 (#4) is merged.
      if (HAS_VACANCY_OWNER) await tx.vacancy.update({ where: { id: jobId }, data: { primaryRecruiterId: assigneeId } as never });
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

  async getVacancyDetail(organizationId: string, id: string, user?: AuthUser): Promise<VacancyDetailView | RedactedVacancy | null> {
    const level = await this.vacancyAccessLevel(organizationId, id, user);
    if (level === 'none') throw new NotFoundException(`Vacancy ${id} was not found.`);
    const detail = await this.repository.getVacancyDetail(organizationId, id);
    if (!detail) {
      throw new NotFoundException(`Vacancy ${id} was not found.`);
    }
    return level === 'full' ? detail : redactVacancy(detail);
  }

  /** Full detail for an internal caller (no redaction); used by delete. */
  private async getVacancyDetailFull(organizationId: string, id: string, user?: AuthUser): Promise<VacancyDetailView> {
    await this.assertVacancyVisible(organizationId, id, user);
    const detail = await this.repository.getVacancyDetail(organizationId, id);
    if (!detail) throw new NotFoundException(`Vacancy ${id} was not found.`);
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

  async holdVacancy(id: string, organizationId: string, reason: string | null | undefined, user?: AuthUser, opts: { note?: string | null | undefined; holdUntil?: string | null | undefined } = {}): Promise<Vacancy> {
    const holdUntil = parseHoldUntil(opts.holdUntil);
    return this.changeJobStatus(id, organizationId, user, 'hold', reason, () => 'On Hold', { note: opts.note, holdUntil });
  }

  async reopenVacancy(id: string, organizationId: string, reason: string | null | undefined, user?: AuthUser): Promise<Vacancy> {
    return this.changeJobStatus(id, organizationId, user, 'reopen', reason, (job) => {
      if (job.status !== 'On Hold') {
        throw new ConflictException({ code: 'ILLEGAL_JOB_TRANSITION', message: `Only a held job can be reopened (job is ${job.status}).` });
      }
      return seatStatus(job.joinedHeadcount, job.approvedHeadcount);
    });
  }

  async closeVacancy(id: string, organizationId: string, reason: string | null | undefined, user?: AuthUser, opts: { note?: string | null | undefined } = {}): Promise<Vacancy> {
    return this.changeJobStatus(id, organizationId, user, 'close', reason, () => 'Closed', { note: opts.note });
  }

  private async changeJobStatus(
    id: string,
    organizationId: string,
    user: AuthUser | undefined,
    action: 'hold' | 'reopen' | 'close',
    reason: string | null | undefined,
    target: (job: { status: string; joinedHeadcount: number; approvedHeadcount: number }) => JobStatus,
    opts: { note?: string | null | undefined; holdUntil?: Date | null | undefined } = {},
  ): Promise<Vacancy> {
    await this.assertVacancyVisible(organizationId, id, user);
    let text = requireReason(reason, `${action} this job`);
    if (!user) throw new ForbiddenException('Only the job owner or their manager can change job status.');
    await this.prisma.$transaction(async (tx) => {
      const job = await tx.vacancy.findFirst({
        where: { id, organizationId },
        select: { id: true, status: true, joinedHeadcount: true, approvedHeadcount: true },
      });
      if (!job) throw new NotFoundException(`Vacancy ${id} was not found.`);
      await assertJobOwnerOrManager(tx, organizationId, id, user.userId);
      // B3: hold and close reasons come from master data ('hold-reasons' / 'close-reasons');
      // "Other" needs a free-text note. Reopen keeps a free-text reason. Checked after authorization.
      if (action === 'hold' || action === 'close') {
        text = await resolveJobStatusReason(tx, organizationId, action === 'hold' ? 'hold-reasons' : 'close-reasons', text, opts.note);
      }
      const to = target(job);
      if (job.status === to) {
        throw new ConflictException({ code: 'ILLEGAL_JOB_TRANSITION', message: `Job is already ${to}.` });
      }
      await writeJobStatus(tx, job, to, text, user.userId, action === 'hold' ? { holdUntil: opts.holdUntil ?? null } : { holdUntil: null }, action === 'hold' ? opts.holdUntil ?? null : null);
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
      select: { id: true, fromStatus: true, toStatus: true, reason: true, holdUntil: true, changedById: true, createdAt: true },
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

    const assignmentKind = dto.assignmentKind ?? 'PRIMARY';
    // B1: the job owner is never an administrator or an inactive user. Checked
    // before ensureUserInOrganization (which filters on Active) so an inactive
    // owner gets OWNER_NOT_ELIGIBLE instead of a misleading "not in this
    // organization" error (QA BUG-2).
    if (assignmentKind === 'PRIMARY') {
      await assertEligibleOwner(this.prisma, organizationId, dto.userId);
    }
    await this.repository.ensureUserInOrganization(organizationId, dto.userId);
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
        // B1: a job has a single owner, so any active PRIMARY row (whatever
        // its roleCode) is retired. Rows are kept as assignment history.
        await transaction.vacancyAssignment.updateMany({
          where: { vacancyId: id, assignmentKind, isActive: true },
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
      if (assignmentKind === 'PRIMARY') {
        await transaction.vacancy.update({ where: { id }, data: { primaryRecruiterId: dto.userId } });
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

    // B1: no admin bypass. Administrators follow the same permission checks
    // and may never reassign an existing job owner (v2: Admin never owns or
    // reassigns; reassignment proper is B7).

    if (assignmentKind !== 'PRIMARY') {
      if (!canAssign && !canManage) {
        throw new ForbiddenException('Assigning supporting vacancy members requires VACANCY_ASSIGN permission.');
      }
      return;
    }

    const currentPrimary = await this.prisma.vacancyAssignment.findFirst({
      where: {
        vacancyId,
        assignmentKind: 'PRIMARY',
        isActive: true,
      },
      select: { userId: true },
    });
    const isReassignment = Boolean(currentPrimary && currentPrimary.userId !== dto.userId);
    if (isReassignment && isAdmin) {
      throw new ForbiddenException({ code: 'ADMIN_CANNOT_REASSIGN', message: 'Administrators cannot reassign a job owner.' });
    }
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

    const detail = await this.getVacancyDetailFull(organizationId, id, user);
    return detail!;
  }

  /**
   * B2 (v2 §3): no delete for anyone, including Admin. DELETE /vacancies/:id
   * deactivates the job (status Closed; Cancelled is a requisition-only
   * state per v2 §3) and cancels its requisition when that is still open. Assignments, approvals and history are kept.
   */
  async deleteVacancy(
    id: string,
    organizationId: string,
    user?: AuthUser,
  ): Promise<{ id: string; deactivated: true; status: 'Closed' }> {
    // B1 x B2 merge: deactivating is a write, so another owner's job is 403
    // (JOB_NOT_OWNED) and an out-of-scope job is 404, like the other job writes.
    await this.assertVacancyVisible(organizationId, id, user);
    // NEW-3: like close, only the job owner or the owner's manager deactivates a job (403 JOB_NOT_OWNED);
    // VACANCY_MANAGE alone is not enough. Administrators keep B2's deactivate.
    if (user && !user.roleCodes?.includes('ADMINISTRATOR')) await assertJobOwnerOrManager(this.prisma, organizationId, id, user.userId);
    const vacancy = await this.prisma.vacancy.findFirst({
      where: { id, organizationId },
      select: { id: true, status: true, vacancyRequestId: true },
    });
    if (!vacancy) {
      throw new NotFoundException(`Vacancy ${id} was not found.`);
    }

    const openApplications = await this.prisma.application.count({
      where: { vacancyId: id, stage: { notIn: ['Joined', 'Rejected', 'Withdrawn'] } },
    });
    if (openApplications > 0) {
      throw new ConflictException({
        code: 'JOB_HAS_OPEN_APPLICATIONS',
        message: `This job has ${openApplications} open application(s). Close or move them before deactivating the job.`,
        counts: { openApplications },
      });
    }

    if (vacancy.status !== 'Closed') {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.vacancy.update({ where: { id }, data: { status: 'Closed' } });
        await transaction.vacancyRequest.updateMany({
          where: { id: vacancy.vacancyRequestId, status: { notIn: ['Cancelled', 'Rejected'] } },
          data: { status: 'Cancelled' },
        });
      });
    }

    return { id, deactivated: true, status: 'Closed' };
  }

  private async assertVacancyVisible(organizationId: string, id: string, user?: AuthUser): Promise<void> {
    const level = await this.vacancyAccessLevel(organizationId, id, user);
    if (level === 'none') throw new NotFoundException(`Vacancy ${id} was not found.`);
    if (level === 'redacted') {
      throw new ForbiddenException({ code: 'JOB_NOT_OWNED', message: 'Access denied: this job belongs to another owner.' });
    }
  }

  /** 'full' | 'redacted' (another owner's job in scope) | 'none' (out of scope). */
  private async vacancyAccessLevel(organizationId: string, id: string, user?: AuthUser): Promise<'full' | 'redacted' | 'none'> {
    if (!user || !this.accessControl) return 'full';
    const [scopeWhere, fullWhere] = await Promise.all([
      this.accessControl.getVacancyScopeWhere(user),
      this.accessControl.getVacancyVisibilityWhere(user),
    ]);
    const inScope = await this.prisma.vacancy.findFirst({ where: { AND: [{ id, organizationId }, scopeWhere] }, select: { id: true } });
    if (!inScope) return 'none';
    const full = await this.prisma.vacancy.findFirst({ where: { AND: [{ id }, fullWhere] }, select: { id: true } });
    return full ? 'full' : 'redacted';
  }
}

/** B2: jobs in these states are deactivated (hidden from default lists). */
const INACTIVE_JOB_STATUSES: string[] = ['Closed', 'Cancelled'];

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

/** B1 redaction: other owners' jobs expose only title, site and seats. */
export function redactVacancy(vacancy: {
  id: string;
  title?: string | null;
  position?: { title: string } | null;
  branch?: { id: string; name: string } | null;
  approvedHeadcount: number;
  joinedHeadcount: number;
}): RedactedVacancy {
  return {
    id: vacancy.id,
    redacted: true,
    title: vacancy.title ?? vacancy.position?.title ?? null,
    site: vacancy.branch ? { id: vacancy.branch.id, name: vacancy.branch.name } : null,
    seats: { filled: vacancy.joinedHeadcount, target: vacancy.approvedHeadcount },
  };
}

/** B2-16: primary recruiter of a requisition: the job's active PRIMARY assignee once activated, else the assigned employee. */
function primaryRecruiterOf(r: { assignedEmployee: { id: string; displayName: string } | null; vacancy: { assignments: Array<{ user: { id: string; displayName: string } }> } | null }): { id: string; name: string } | null {
  const owner = r.vacancy?.assignments[0]?.user ?? r.assignedEmployee;
  return owner ? { id: owner.id, name: owner.displayName } : null;
}
