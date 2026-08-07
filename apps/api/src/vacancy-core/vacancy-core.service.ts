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
  CreateVacancyRequestInput,
  Vacancy,
  VacancyRequest,
  VacancyRequestActionResult,
  VacancyDetailView,
} from '@recruitflow/contracts';
import type {
  CreateVacancyRequestDto,
  VacancyRequestActionDto,
  UpdateVacancyRequestDto,
  AssignTeamMemberDto,
} from './vacancy-core.dto';
import {
  VACANCY_CORE_REPOSITORY,
  type VacancyCoreRepository,
} from './vacancy-core.repository';

@Injectable()
export class VacancyCoreService {
  constructor(
    @Inject(VACANCY_CORE_REPOSITORY)
    private readonly repository: VacancyCoreRepository,
  ) {}

  listRequests(organizationId: string): Promise<VacancyRequest[]> {
    return this.repository.listRequests(organizationId);
  }

  getRequest(organizationId: string, id: string): Promise<VacancyRequest | null> {
    return this.repository.getRequest(organizationId, id);
  }

  listVacancies(organizationId: string): Promise<Vacancy[]> {
    return this.repository.listVacancies(organizationId);
  }

  getVacancy(organizationId: string, id: string): Promise<Vacancy | null> {
    return this.repository.getVacancy(organizationId, id);
  }

  getContext() {
    return this.repository.getContext();
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
    action: VacancyRequestActionDto,
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
      comment: action.comment ?? null,
      decidedAt: null,
      createdAt: now,
    });

    return this.repository.saveRequest(request);
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

    if (!actorRoleCodes.includes(approval.roleCode)) {
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

    return this.repository.saveRequest(request);
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
}
